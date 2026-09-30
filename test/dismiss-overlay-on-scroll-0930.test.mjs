/* ═══ 2026-09-29 批 DC 续-18：**滚轮一滚，浮层就关**（全局口径，用户实测知渔后定的）══════════════════
   用户逐字：
   > 「他们好像全局都是把这种按钮张开面板的时候，如果用户去滚动鼠标滚轮的话，**面板就会自动关闭**。
   >   我们现在的情况是不管首页的两个板块，还是各种子页面，还是画布里面？所有的地方我们的面板逻辑
   >   跟他们都不一样。现在我们滚动我们的滚轮的话，这个面板只要是张开的状态，**它会跟着滚动**，
   >   这其实可能会造成很多的 bug。我觉得还不如就照他那种做法……
   >   **你全局都要去实现这个方案。**」

   浮层总数 **56 个**（`.tmp/overlay-inventory.md`），其中 ~28 是一次性实现。
   本门禁守的是**机制**与**已接的面**，不是"全部 56 个都接完了"——
   后者还没做到（见下面 ④），写成"必须全绿"只会让判据永远红、等于把它废掉。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ROOT_URL = new URL('..', import.meta.url);
const ROOT = ROOT_URL.pathname.replace(/^\//, '').replace(/\/$/, '');
const read = rel => readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
const code = rel => read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('① 只有一个全局监听（不是每处一份）', () => {
  const bus = code('src/components/media/useDismissOverlay.js');
  /* 三条"用户动页面了"的信号都收：主动滚轮 / 代码滚动 / 视口变化 */
  assert.match(bus, /addEventListener\('wheel', dismiss, \{ capture: true/,
    '要收 wheel，且用 capture（左栏、面板内部都是独立滚动容器，冒泡阶段收不到）');
  assert.match(bus, /addEventListener\('scroll', dismiss, \{ capture: true/, '也要兜住 scroll');
  assert.match(bus, /addEventListener\('resize', dismiss/, '视口变了也要收');
  /* 幂等：多处调用只装一个 */
  assert.match(bus, /if \(installed \|\| typeof document === 'undefined'\) return;/,
    '安装必须幂等（56 个浮层都会用到，装 56 次就成了 56 个监听）');
  /* 面板内部的滚动不许关自己 */
  assert.match(bus, /OVERLAY_ROOT_ATTR/, '要有一个"浮层根"标记，供内部滚动豁免用');
  assert.match(bus, /composedPath\(\)/, '豁免判据必须用事件路径（那个节点在不在浮层里）');
  /* onClose 走 ref 转发，调用方不必把它塞进依赖数组 */
  assert.match(bus, /const latest = useRef\(onClose\)/, 'onClose 要走 ref 转发，否则每次渲染都退订重订');
});

test('② 已经接上的三处：子页面 / 首页 / 画布（EcMode）', () => {
  /* 子页面（生图模型 · 画面规格）*/
  const sub = code('src/components/media/ConfigTriggers.jsx');
  assert.match(sub, /useDismissOverlay\(Boolean\(open\), \(\) => setOpen\(null\)\)/, '子页面面板要接');
  assert.match(sub, /\[OVERLAY_ROOT_ATTR\]/, '子页面面板要标浮层根（面板内部滚动不关自己）');
  assert.doesNotMatch(sub, /addEventListener\('scroll'/,
    '子页面面板**不许再跟着滚** —— 那一行就是"面板跟着滚动"的全部来源');

  /* 首页两个板块 */
  const home = code('src/pages/Home/VisualCreationMode.jsx');
  assert.match(home, /useDismissOverlay\(Boolean\(activeConfigPanel\), \(\) => setActiveConfigPanel\(null\)\)/, '首页面板要接');
  assert.match(home, /id="visual-floating-panel"[\s\S]{0,200}?data-overlay-root="true"/, '首页面板要标浮层根');
  assert.doesNotMatch(home, /addEventListener\('scroll', repositionConfigPanel/,
    '首页面板**不许再跟着滚**');

  /* 画布 / 电商模式 */
  const ec = code('src/pages/Home/EcMode.jsx');
  assert.match(ec, /useDismissOverlay\(Boolean\(activePanel\), \(\) => setActivePanel\(null\)\)/, '画布那块面板要接');
  assert.match(ec, /id="ec-floating-panel"[\s\S]{0,240}?data-overlay-root="true"/, '画布面板要标浮层根');
});

test('③ `usePanelScrollLock` 的"把滚轮喂给面板"已经删掉（那正是要改掉的行为）', () => {
  const lock = code('src/components/ui/usePanelScrollLock.js');
  assert.doesNotMatch(lock, /addEventListener\('wheel'/, '不许再自己监听 wheel（全局总线已经有一份）');
  assert.doesNotMatch(lock, /preventDefault/, '不许再 preventDefault 滚轮');
  assert.doesNotMatch(lock, /scrollTop \+= delta/, '**这条就是"面板跟着滚"的全部来源**，必须删');
  /* 但页面锁要留着：面板开着时底下别跟着滚。 */
  assert.match(lock, /acquirePageScrollLock\(\)/, '页面滚动锁要保留（面板开着时底下别跟着滚）');
  /* 签名保持不变 ⇒ 两处调用点不用动 */
  assert.match(lock, /export function usePanelScrollLock\(open, \{ panelSelector = DEFAULT_PANEL_SELECTOR \}/,
    '导出签名不能变（EcMode.jsx:538 与 VisualCreationMode.jsx:403 两处调用点靠它兼容）');
});

test('④ 全站**没有**浮层还在跟着滚（这才是"全局"的判据）', () => {
  /* 这一条是本门禁真正的覆盖面检查：逐个文件找"**添加**的 scroll 监听"，
     判它的回调是不是在做重新定位（getBoundingClientRect / setPosition / reposition…）。
     ⚠️ 必须排除 `removeEventListener` —— 它**包含** `addEventListener` 这个子串，
        按子串找会把清理代码当成"还在跟滚"（第一版就误报了两处）。 */
  const files = execSync('git ls-files src', { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
    .split(/\r?\n/).map(s => s.trim()).filter(Boolean).filter(f => /\.(jsx?|mjs)$/.test(f));
  const stillFollowing = [];
  for (const file of files) {
    let src;
    try { src = readFileSync(new URL('../' + file, ROOT_URL), 'utf8'); } catch { continue; }
    const re = /(?<!remove)addEventListener\(\s*['"]scroll['"]\s*,\s*([A-Za-z_$][\w$]*)/g;
    let m;
    while ((m = re.exec(src))) {
      const fn = m[1];
      const at = Math.max(src.indexOf(`function ${fn}`), src.indexOf(`const ${fn}`));
      const body = at >= 0 ? src.slice(at, at + 700) : '';
      if (/getBoundingClientRect|setPosition|setMenuStyle|setPlacement|reposition|updateMenuPosition|updatePanelPosition|positionPanel/.test(body)) {
        stillFollowing.push(`${file} → ${fn}()`);
      }
    }
  }
  assert.deepEqual(stillFollowing, [],
    '这些浮层还在跟着滚（全局口径是"滚一滚就关"）：\n  ' + stillFollowing.join('\n  '));
});

test('⑤ 画布：登记册加一列 `scroll`，一次订阅覆盖全部浮层', () => {
  const reg = code('src/pages/EcCanvas/canvasSurfaceDismiss.js');
  assert.match(reg, /scroll: true/, '登记册要有 scroll 列');
  /* 连线拖拽中不登记 scroll：拖线时画布本来就在动，滚轮不该把用户正在拉的线打断。 */
  assert.match(reg, /connectionDraft: \{[^}]*scroll: false/,
    'connectionDraft 不许登记 scroll（那会打断正在拖的连线）');
  const index = code('src/pages/EcCanvas/index.jsx');
  assert.match(index, /useDismissOverlay\(true,[\s\S]{0,200}?dismissCanvasSurfaces\('scroll'\)/,
    '画布只订阅**一次**全局总线，按登记册统一关（13 个浮层一次到位，不用逐个接）');
});

test('⑥ 共享底座接一次覆盖多个：AnchoredPortal(4) / ImageMentionPicker(8)', () => {
  /* 这两处原先都是 `addEventListener('scroll', 重新定位, true)` = 跟着滚。 */
  for (const [file, what] of [
    ['src/components/ui/AnchoredPortal.jsx', 'AnchoredPortal（品牌色取色盘 / 比例 12 档 / 平台 / 语言）'],
    ['src/components/creation/ImageMentionPicker.jsx', 'ImageMentionPicker（全站 8 个挂载点的 @ 菜单）'],
  ]) {
    const src = code(file);
    assert.match(src, /useDismissOverlay\(/, `${what} 要接上"滚一滚就关"`);
    assert.doesNotMatch(src, /(?<!remove)addEventListener\(\s*'scroll'/,
      `${what} 不许再跟着滚（resize 留着 —— 视口尺寸真变了，重量坐标是对的）`);
    /* 自身可滚的浮层必须打浮层根标记，否则在面板里滚一下会把自己关掉。 */
    assert.match(src, /OVERLAY_ROOT_ATTR|overlay-root/,
      `${what} 自身可滚 ⇒ 必须标成浮层根，否则用户在面板内部滚动会把它自己关掉`);
  }
  /* 另两处一次性实现也接了 */
  assert.match(code('src/components/layout/CreativeDomainNav.jsx'), /useDismissOverlay\(Boolean\(openGroupId\)/,
    '创作台导航面板要接（它还是悬停触发的，跟滚 + 悬停两个状态机叠着最不可预期）');
  assert.match(code('src/pages/VideoStudio/index.jsx'), /useDismissOverlay\(Boolean\(activePanel\)/,
    '视频侧配置面板要接');
  assert.match(code('src/pages/VideoStudio/index.jsx'), /video-config-panel[\s\S]{0,200}?data-overlay-root="true"/,
    '视频侧面板自身可滚 ⇒ 要标浮层根');
});

test('⑦ 画布那个 rAF 跟随**保留**（它服务的是另一个用户要求，删掉会静默回退）', () => {
  /* 我一度把它删了，理由是"看着像面板死死粘在节点上" —— **那是误判**：
     ① 它服务 2026-09-28 用户原话「不管用户怎么拖动素材，张开的面板都必须如影随形」；
     ② **画布平移是 pointer 驱动的，不是 scroll 事件** ⇒ 新的"滚一滚就关"根本不会
        因为拖动画布而触发，所以"删掉跟随就能自动关"这个推理不成立。
     真正的"粘住"由画布那一次全局订阅（登记册 scroll 列）把面板整个收掉，两者不冲突。 */
  const studio = code('src/pages/EcCanvas/components/CanvasStudio.jsx');
  const hook = studio.slice(studio.indexOf('export function useCanvasPopoverAnchor'));
  assert.match(hook, /requestAnimationFrame/, '拖动画布/拖节点时锚点仍要逐帧跟随（2026-09-28 用户要求）');
  assert.match(hook, /cancelAnimationFrame/, '关闭时要停掉轮询（不许留常驻开销）');
  assert.match(hook, /if \(!openKey\) return undefined/, '弹层没开时不许轮询');
  /* 画布弹层自身可滚 ⇒ 也要标浮层根 */
  /* 画布弹层自身可滚 ⇒ 也要标浮层根（面板的 JSX 离函数声明两行多，窗口放宽）。 */
  assert.match(studio, /CanvasPopoverPortal[\s\S]{0,3200}?data-overlay-root="true"/,
    '画布弹层自身可滚 ⇒ 必须标浮层根');
});

test('⑧ 渲染按钮的字段**不许包 <label>**（用户点名的"点空地就张开面板"那一族）', () => {
  const fr = code('src/components/media/FieldRenderer.jsx');
  /* 判据是"这一格有没有一个可关联的表单控件"，不是逐个 kind 列举 ——
     逐个列举过一次（只列了 segmented/choice/cards/multi），结果漏了 config/stepper/counts/slot。 */
  assert.match(fr, /const hasOwnControl = kind === 'select'[\s\S]{0,160}?kind === 'upload';/,
    '要按"有没有自己的表单控件"来判定');
  assert.match(fr, /const Wrapper = hasOwnControl \? 'label' : 'div';/,
    '渲染按钮的 kind 一律 <div>（<label> 的隐式关联控件是第一个 labelable 后代，而 <button> 就是）');
  assert.match(fr, /role: 'group'/, '改用 <div> 时要补 role="group"（语义不丢）');
  assert.match(fr, /const labelId = hasOwnControl \? undefined :/,
    '走 <div> 的那几格也要有可访问名（labelId 要按实际 Wrapper 算，不是按 isOptionGroup）');
  /* config 就是这次点名的那个（生图模型 / 画面规格）——
     ⚠️ `ConfigTriggers` 出现在 80+ 行之后（中间有注释与逻辑），所以窗口放宽。 */
  assert.match(fr, /if \(kind === 'config'\)[\s\S]{0,1200}?<ConfigTriggers/,
    '生成设置那一格走 ConfigTriggers（两颗按钮）—— 它正是被点名的那个');
});
