// test/canvas-p0-four-fixes-1002.test.mjs
// 2026-10-02 用户 6 张批注里的四条「画布本体」问题（这一批只管这四条，其余另立项）。
// ─────────────────────────────────────────────────────────────────────────────
// ① 派生卡片右侧留白：「右边还是有大量的留白呀……你稍微把右边的积分和箭头往左边文字这一块挤一点」
// ② 左下角三颗按钮不互斥：「为什么他们都能同时触发呀？……点击其中某一个的话，另外一个就应该关掉呀」
// ③ 底部那颗「添加图片」应改成「上传素材」：「它应该可以上传任意素材上来才对」
// ④ 右面板视频缩略图是黑图 + 时长条恒为 0
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️⚠️ **为什么这里直接读原文、而不是"剥注释后再判"**（这一点我试错了两次，值得记）：
//
//   ① 用正则剥注释 → 这个文件里有 `accept="image/*"`，字符串里那个斜杠星号
//      被当成注释开始，一路吞到后面某个星号斜杠，**把真正的代码一起吃掉**，
//      于是「统一选择器必须三类都收」报假红。
//   ② 改用 esbuild 剥 → esbuild 会把 JSX **整个化掉**（`trailing={<>…}` 变成
//      createElement 调用），于是「要能定位到 trailing 槽」这类**结构**判据全废；
//      而且它还会把单引号归一成双引号，字面量判据跟着一起红。
//
//   ⇒ 结论：这个文件里**同时**存在"字符串里藏注释定界符"和"JSX 结构"，两种清洗各废一半。
//      所以：**结构判据一律读原文**；"某样东西不许存在"的判据靠**变异测试**证明抓得住。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
/* CSS **可以**用正则剥注释（CSS 里没有"字符串里藏注释定界符"这种写法），
   而 JSX/JS 不行 —— 上面 ①②③ 三条注释说的就是这件事。
   ⚠️ 这条是本文件第三次栽在同一个区分上：判 `.ec-canvas-derive-tile` 那条规则时
   直接读原文，结果 `[^}]*` 把**规则体内那整段解释性注释**也吃进来了，
   而注释里就写着「不许再写 min-height 地板」⇒ 报了个假的"有 min-height"。 */
const stripCss = s => s.replace(/\/\*[\s\S]*?\*\//g, '');

const INDEX = 'src/pages/EcCanvas/index.jsx';
const CHROME = 'src/pages/EcCanvas/components/CanvasChrome.jsx';
const PANEL = 'src/pages/EcCanvas/components/EcCanvasRightPanel.jsx';
const DERIVE_CSS = 'src/styles/canvas-derive-menu.css';

test('① 派生卡片：内容整体靠左聚成团，右侧留白挪到末尾', async t => {
  const css = read(DERIVE_CSS);
  const base = /\.ec-canvas-derive-tile\s*\{([^}]*)\}/.exec(stripCss(css));
  assert.ok(base, '要能定位到 .ec-canvas-derive-tile 的基线规则');
  assert.match(base[1], /grid-template-columns:\s*auto\s+minmax\(0,\s*max-content\)\s+auto/,
    '标题轨必须是 max-content（按文字实际宽度给）');
  assert.match(base[1], /justify-content:\s*start/, '整条轨道必须靠左');
  assert.match(base[1], /gap:\s*0 8px/, '图标/文字/积分之间 8px');
  assert.doesNotMatch(base[1], /min-height/, '不许有 min-height 地板（那会让卡片空着 22px）');

  let browser;
  try { browser = await chromium.launch(); } catch { t.skip('playwright 不可用'); return; }
  const TOKENS = read('src/styles/design-tokens-v3.css');
  const ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/></svg>';
  const ARROW = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17 17 7"/></svg>';
  const card = (label, price) => `<button type="button" class="ec-canvas-derive-tile">
    <span class="ec-canvas-derive-chip">${ICON}</span>
    <span class="ec-canvas-derive-copy"><strong>${label}</strong><small aria-hidden="true">d</small></span>
    <span class="ec-canvas-derive-meta">${price ? `<em>${price}</em>` : ''}${ARROW}</span>
  </button>`;
  const html = `<!doctype html><html lang="zh"><head><meta charset="utf-8"><style>${TOKENS}${css}
    body{margin:0;padding:16px;background:#fff;font-family:system-ui,"Microsoft YaHei",sans-serif}</style></head>
    <body><div class="ec-canvas-derive-menu"><div class="ec-canvas-derive-bucket is-core">
    <div class="ec-canvas-derive-bucket-label"><span>核心常用</span></div>
    <div class="ec-canvas-derive-grid">${card('生成文案', '')}${card('图片生成', '')}${card('生成视频', '32积分起')}</div>
    </div></div></body></html>`;

  const page = await browser.newPage({ viewport: { width: 1440, height: 600 } });
  await page.setContent(html);
  const rows = await page.evaluate(() => [...document.querySelectorAll('.ec-canvas-derive-tile')].map(t => {
    const s = t.querySelector('.ec-canvas-derive-copy strong');
    const range = document.createRange(); range.selectNodeContents(s);   // 量文字**墨迹**，不是 strong 的盒子
    const ink = range.getBoundingClientRect();
    const mr = t.querySelector('.ec-canvas-derive-meta').getBoundingClientRect();
    const chip = t.querySelector('.ec-canvas-derive-chip').getBoundingClientRect();
    const tr = t.getBoundingClientRect();
    return {
      label: s.textContent,
      gap: +(mr.left - ink.right).toFixed(1),
      chipW: +chip.width.toFixed(1),
      trailing: +(tr.right - mr.right).toFixed(1),
    };
  }));
  await page.close(); await browser.close();

  for (const r of rows) {
    assert.ok(r.gap <= 12, `${r.label}：文字与积分之间仍夹着 ${r.gap}px 空白（用户要的是挤一点）`);
    assert.equal(r.chipW, 24, `${r.label}：图标被挤了（${r.chipW}px）`);
    assert.ok(r.trailing > r.gap, `${r.label}：留白必须落在末尾（${r.trailing}px），而不是夹在中间（${r.gap}px）`);
  }
});

test('② 左下角三颗面板按钮必须互斥：开一个先关掉其它', () => {
  const idx = read(INDEX);
  const grab = name => {
    const m = new RegExp('const ' + name + ' = useCallback\\(([\\s\\S]*?)\\n  \\}, \\[').exec(idx);
    assert.ok(m, `要能取到 ${name} 的函数体`);
    return m[1];
  };
  const layers = grab('handleToggleLayersPanel');
  assert.match(layers, /dismissAllCanvasSurfacesExcept\('layersPanelOpen'\)/, '开图层必须先关掉其它浮层');
  assert.match(layers, /setMinimapOpen\(false\)/, '开图层必须收起小地图（它不在登记册里，只能显式关）');
  const mini = grab('handleToggleMinimap');
  assert.match(mini, /dismissCanvasSurfaces\('blank'\)/, '开小地图必须关掉其它已登记浮层');

  const t0 = idx.indexOf('trailing={<>');
  assert.ok(t0 > 0, '要能定位到左下角那排按钮的 trailing 槽');
  const t1 = idx.indexOf('</>}', t0);
  assert.ok(t1 > t0, '要能定位到该槽的闭合');
  const buttons = idx.slice(t0, t1);
  for (const [label, handler] of [['图层', 'handleToggleLayersPanel'], ['小地图', 'handleToggleMinimap'], ['水印', 'handleToggleWatermarkPanel']]) {
    assert.match(buttons, new RegExp('aria-label="' + label + '"[\\s\\S]{0,300}onClick=\\{' + handler + '\\}'),
      `「${label}」按钮必须走 ${handler}`);
  }
});

test('③ 底部工具栏：一颗「上传素材」收全部类型，图标不再是"图片"', () => {
  const chrome = read(CHROME);
  assert.match(chrome, /\{ id: 'upload', label: '上传素材：图片 \/ 视频 \/ 音频', icon: Upload, onClick: onUpload \}/,
    '工具项必须是「上传素材」且用 Upload 图标');
  assert.doesNotMatch(chrome, /\{ id: 'image', label: '添加图片'/, '「添加图片」那一项必须消失');
  assert.doesNotMatch(chrome, /^\s*ImageUp,$/m, 'ImageUp 在 import 里必须删掉（已成死引用）');
  assert.match(chrome, /export function CanvasBottomToolbar\(\{ activeTool, onToolChange, onUpload, onText \}\)/,
    '组件签名必须收 onUpload');

  const idx = read(INDEX);
  assert.match(idx, /onUpload=\{\(\) => \{ materialUploadRef\.current\?\.click\(\); setActiveTool\('select'\); \}\}/,
    '那颗按钮必须点开统一的选择器');
  assert.match(idx, /accept="[^"]*image\/png[^"]*video\/mp4[^"]*audio\/mpeg[^"]*"/,
    '统一选择器必须三类都收（逐类型写全，不用通配 —— 通配里的斜杠星号会被门禁的剥注释正则当成注释开始）');
  assert.match(idx, /const materialUploadRef = useRef\(null\)/, '统一选择器的 ref 必须声明');
  const dispatch = /const uploadCanvasMaterials = useCallback\(([\s\S]*?)\n  \}, \[/.exec(idx);
  assert.ok(dispatch, '要能取到 uploadCanvasMaterials 的函数体');
  for (const h of ['handleCanvasSourceUpload', 'handleCanvasVideoUpload', 'handleCanvasAudioUpload']) {
    assert.match(dispatch[1], new RegExp(h), `${h} 必须被统一入口调用`);
  }
  assert.match(idx, /await uploadCanvasMaterials\(dropped\)/, '拖拽也必须走同一个函数');

  const defAt = idx.indexOf('const uploadCanvasMaterials = useCallback');
  const useAt = idx.search(/\}, \[uploadCanvasMaterials\]\);/);
  assert.ok(defAt > 0 && useAt > 0, '两个锚点都要找得到');
  assert.ok(defAt < useAt, `定义(${defAt}) 必须排在依赖数组(${useAt})之前，否则 TDZ 崩`);
});

test('④ 右面板视频：缩略图不再是黑图 + 时长显示真实时长且不可拖', () => {
  const panel = read(PANEL);
  assert.match(panel, /onLoadedMetadata=/, '缩略图那个 video 必须有 onLoadedMetadata');
  assert.match(panel, /el\.currentTime = 0\.05/, '必须拨一下 currentTime 逼它解码第一帧');
  assert.match(panel, /ref=\{heroVideoRef\}/, '必须挂 ref');
  assert.match(panel, /setProbedDuration\(Math\.round\(el\.duration \* 10\) \/ 10\)/, '真实时长从 video.duration 读');

  assert.doesNotMatch(panel, /aria-label="调整视频时长"/, '源素材上不许再有那条改不动的时长滑块');
  assert.doesNotMatch(panel, /onPatch\?\.\(\{ duration:/, '时长不许再写回源素材节点');
  assert.doesNotMatch(panel, /const duration = typeof node\.duration/, 'node.duration 那行已作废，留着会误导');
  assert.match(panel, /视频时长/, '必须改成说清语义的「视频时长」');
  assert.match(panel, /probedDuration > 0 \? `\$\{probedDuration\}s` : '读取中…'/,
    '显示的必须是**从元素读到**的真实时长');
});
