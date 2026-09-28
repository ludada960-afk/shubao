import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

/* ═══ 批 BF（2026-09-25）门禁：**图片侧与视频侧是同一套配置控件语言** ═══════════════════════════
   用户原话（逐字）：
     「我们现在**两套语言体系**，这是完全不对的……你现在这个视频模型**东倒西歪的**，
      所有的 LOGO 大小都是不一致的。而且跟图片生成那边也完全不一样。我觉得你现在先冷静下来，
      你**深度思考一下能不能把视频生成和图片生成这边他们的这两个按钮，还有他们张开的面板
      去重新设计**吧。」
     「你现在是两套东西在做呀。」

   这个文件不是"再补一条断言"，而是**把"两套东西"这件事变成机器能拦住的**：
   从两份 CSS 里把同一语义的规则块抽出来，逐属性比较（忽略空白与书写顺序）。
   以后谁只改了一边，这里当场红 —— 历史上反复发生过的正是这种漂移：
     · 触发按钮 4 颗出现过 210 / 161 / 180 / 180 四种宽度（用户："东倒西歪"）；
     · 模型标出现过 24 / 28 / 32 三种尺寸（用户："所有的 LOGO 大小都是不一致的"）；
     · 面板内边距一档 14/16、一档 24/20；选项控件两种圆角、两套状态色。
   ⚠️ 比较的是**两边写出来的取值**，不是"看起来差不多"。 */

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const strip = css => css.replace(/\/\*[\s\S]*?\*\//g, '');
/* 归一化：空白折叠成一个空格 + 逗号后统一补一个空格 —— 既让 rgba(35,31,27,.11) 与
   rgba(35, 31, 27, .11) 视为同一个值，又保留 padding 这类多值属性的空格分隔
   （不能整段去空格：0 20px 会被粘成 020px，边界就丢了）。 */
const N = v => String(v).replace(/\s+/g, ' ').replace(/,\s*/g, ', ').trim();

const videoCss = strip(read('src/pages/VideoStudio/VideoStudio.css'));
const imageCss = strip(read('src/pages/Home/VisualCreationMode.css'));

/** 把 CSS 里所有「选择器 → 声明表」抽出来（媒体查询里的规则同样会被抽到，选择器即内层选择器）。 */
function rules(css) {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const selector = m[1].replace(/\s+/g, ' ').trim();
    const decls = {};
    for (const part of m[2].split(';')) {
      const i = part.indexOf(':');
      if (i < 0) continue;
      decls[part.slice(0, i).trim()] = N(part.slice(i + 1));
    }
    out.push({ selector, decls, raw: m[2] });
  }
  return out;
}

const videoRules = rules(videoCss);
const imageRules = rules(imageCss);

/** 取某个选择器的规则块。
 *  ⚠️ 同一选择器在本仓常常有多条定义（叠加式改造留下的），而媒体查询 / `prefers-reduced-motion`
 *     里还会再出现一次同名规则 —— 直接取第一条会拿到 `{ transition: none }` 这种空壳（本轮踩到）。
 *  所以：默认取第一条，`prop:` 指定"必须声明该属性"的那一条，`last: true` 取最后一条。 */
function blockOf(list, selector, where, opts = {}) {
  /* 选择器可以是**逗号列表**里的一项（本仓大量使用 `.a, .b { … }` 合写），所以按项匹配。
     ⚠️ 2026-09-26 批 BT：滚动悬停守卫的前缀 `html:not([data-scrolling]) ` 对这条判据**透明** ——
        它只是"滚动那 150ms 不呈现悬停"，不代表这条规则不存在。比对前先剥掉。 */
  const strip = s => s.replace(/^html:not\(\[data-scrolling\]\)\s+/, '');
  const hits = list.filter(r => r.selector.split(',').map(s => strip(s.trim())).includes(selector));
  assert.ok(hits.length > 0, where + ' 里必须有 ' + selector + ' 这条规则');
  const usable = opts.prop ? hits.filter(r => r.decls[opts.prop] !== undefined) : hits;
  assert.ok(usable.length > 0, where + ' 的 ' + selector + ' 没有声明 ' + opts.prop);
  return opts.last ? usable.at(-1) : usable[0];
}

/** 逐属性比较：两边都必须**写出**这些属性，且取值归一化后完全相同。 */
function sameDecls(a, b, props, label) {
  for (const prop of props) {
    assert.ok(a.decls[prop] !== undefined, label + '：图片侧缺 ' + prop + '（' + a.selector + '）');
    assert.ok(b.decls[prop] !== undefined, label + '：视频侧缺 ' + prop + '（' + b.selector + '）');
    assert.equal(a.decls[prop], b.decls[prop],
      label + '：' + prop + ' 两侧不一致 —— 图片侧「' + a.decls[prop] + '」/ 视频侧「' + b.decls[prop]
      + '」。同一个语义的控件必须读同一批值（用户说的"两套东西"就是从这里开始的）。');
  }
}

const px = v => { assert.ok(v !== undefined, '缺一个像素值'); return Math.round(parseFloat(v)); };

/* ── ① 触发按钮：四颗同一套 ───────────────────────────────────────────────────────────── */
test('① 触发按钮：图片侧与视频侧逐属性同一套', () => {
  const a = blockOf(imageRules, '.visual-config-trigger', 'VisualCreationMode.css');
  const b = blockOf(videoRules, '.video-config-trigger', 'VideoStudio.css');
  sameDecls(a, b, [
    'min-width', 'width', 'flex', 'height', 'padding', 'gap', 'border-radius',
    'border', 'background', 'color', 'box-shadow', 'backdrop-filter',
    /* ═══ 2026-09-27 批 CS：把 `transition` 补进比较名单 ═══════════════════════════════════════
       为什么必须补（事实变了）：批 BF 把"视频侧照图片侧逐值抄"这件事写成了门禁，但名单里**没有
       transition**，于是这一条一直漂着 —— 实机实测（`.qa/cs-motion-and-counter.mjs`，读 computed style）：
         视频侧 .video-config-trigger      = 0.2s  / transform·border-color·background·box-shadow
         图片侧 .visual-config-trigger     = 0.16s / border-color·box-shadow·transform
       同一档按钮、同一批"逐值抄"的规则，两侧差 40ms（用户原话：「同等级的东西，你应该同等级的去
       进行设计呀。」「你现在是两套东西在做呀。」）。
       ⇒ 本批把两侧写成**逐字相同**的一条 + 把 transition 放进逐属性比较：以后谁只改一边，这里当场红。 */
    'transition',
  ], '触发按钮');
  assert.equal(a.decls.width, '180px', '触发按钮宽度 = 180（四颗同宽；改前 210/161/180/180）');
  /* 钉住"两侧同档"这件事本身：这条 transition 里**每一个时长都必须是 .16s** ——
     光比较两侧相等还不够（两边一起被改成别的值也算"相等"，而用户要的是与站内小控件同一档）。
     0.16s 是本站小控件的既有档：WorkbenchShell(.16s×4 处) / generate-cta / login-dialog 都是它。 */
  const durs = (a.decls['transition'].match(/[\d.]+s/g) || []);
  assert.ok(durs.length >= 3, '触发按钮的 transition 至少要声明 3 个时长（实测图片侧 3 项 / 视频侧 4 项）');
  for (const d of durs) assert.equal(d, '.16s', '触发按钮动效必须与站内小控件同一档 .16s，实测 ' + a.decls['transition']);
});

/* ── ② 触发按钮里的文字：小标题 / 值 / 箭头同档 ───────────────────────────────────────── */
test('② 触发按钮文字与箭头两侧同档', () => {
  for (const [img, vid] of [
    ['.visual-config-trigger-copy small', '.video-config-trigger small'],
    ['.visual-config-trigger-copy strong', '.video-config-trigger strong'],
  ]) {
    sameDecls(blockOf(imageRules, img, '图片侧'), blockOf(videoRules, vid, '视频侧'),
      ['font-size', 'font-weight', 'color'], '触发按钮文字 ' + img);
  }
  assert.match(blockOf(imageRules, '.visual-config-trigger-copy strong', '图片侧').decls['font-size'],
    /^(12px|var\(--sb-text-sm\))$/, '值那一行必须是 12 档（两侧同时改）');
  /* 两颗图片侧按钮的箭头图标与视频侧同尺寸 —— 由 JSX 决定，这里守 CSS 侧的收起/展开动效同款 */
  assert.equal(
    blockOf(imageRules, '.visual-config-trigger', '图片侧').decls['border-radius'],
    blockOf(videoRules, '.video-config-trigger', '视频侧').decls['border-radius']);
});

/* ── ②b 触发按钮里那支箭头的动效：两侧同一条（批 CS 补）────────────────────────────────────
   事实（实测，读 computed style）：原来 视频侧 = `transform .2s ease`、图片侧 =
   `transform var(--sb-dur-normal) var(--sb-ease-out)` —— 时长一样（200ms）但**曲线不同**
   （`ease` 是 (0.25,0.1,0.25,1)，`--sb-ease-out` 是 (0.22,1,0.36,1)），展开时箭头的"回弹感"不一样。
   判据：两侧必须写出同一条（统一到图片侧那份 token 写法）。 */
test('②b 箭头（chevron）动效两侧同一条', () => {
  const a = blockOf(imageRules, '.visual-config-trigger-chevron', '图片侧');
  const b = blockOf(videoRules, '.video-config-trigger > svg:last-child', '视频侧');
  sameDecls(a, b, ['transition'], '触发按钮箭头');
  assert.match(a.decls['transition'], /var\(--sb-dur-normal\)/, '箭头动效走时长 token（--sb-dur-normal = 200ms）');
  assert.match(a.decls['transition'], /var\(--sb-ease-out\)/, '箭头动效走缓动 token（--sb-ease-out = cubic-bezier(.22,1,.36,1)）');
});

/* ── ③ 面板容器：圆角 / 底 / 描边 / 阴影 ─────────────────────────────────────────────── */
test('③ 面板容器：圆角 / 底 / 描边 / 阴影两侧同值', () => {
  const a = blockOf(imageRules, '.visual-config-panel', 'VisualCreationMode.css');
  const b = blockOf(videoRules, '.video-config-panel', 'VideoStudio.css', { prop: 'border-radius' });
  sameDecls(a, b, ['border', 'border-radius', 'background', 'box-shadow'], '面板容器');
  assert.equal(a.decls['border-radius'], '20px',
    '两侧面板圆角 20（规范 radius.panel = 20 / 知渔实测 19.84；改前 8 —— 比内层控件 12 还尖，嵌套倒置）');
});

/* ── ④ 面板内节奏：首区上 24 / 左右 20 / 区与区 16 / 末区下 24 ────────────────────────── */
test('④ 面板内节奏：两侧同一档（24 / 20 / 16 / 24）', () => {
  const vidPadding = blockOf(videoRules, '.video-config-panel-body', 'VideoStudio.css').decls.padding;
  const vidNums = vidPadding.split(' ').map(px);
  const vidRhythm = {
    top: vidNums[0],
    inline: vidNums[1] ?? vidNums[0],
    gap: px(blockOf(videoRules, '.video-panel-section + .video-panel-section', 'VideoStudio.css').decls['margin-top']),
    bottom: vidNums[0],
  };

  assert.equal(blockOf(imageRules, '.visual-config-panel-body', '图片侧', { prop: 'padding' }).decls.padding, '0',
    '图片侧面板 body 不带内边距（节奏挂在区上 —— 因为它的"生成设置"面板自带内联 24/20）');
  const sectionPadding = imageRules.filter(r => r.selector === '.visual-panel-section').map(r => r.decls.padding).filter(Boolean);
  assert.equal(sectionPadding.length, 1, '图片侧 .visual-panel-section 只允许一条内边距定义');
  const imgNums = sectionPadding[0].split(' ').map(px);
  const imgRhythm = {
    top: px(blockOf(imageRules, '.visual-panel-section:first-child', '图片侧').decls['padding-top']),
    inline: imgNums[1] ?? imgNums[0],
    gap: px(blockOf(imageRules, '.visual-panel-section + .visual-panel-section', '图片侧').decls['margin-top']),
    bottom: px(blockOf(imageRules, '.visual-panel-section:last-child', '图片侧').decls['padding-bottom']),
  };

  assert.deepEqual(imgRhythm, vidRhythm,
    '两侧面板内节奏必须同值（同一种面板，首行落点 / 区距 / 末行落点都不许两样）');
  assert.deepEqual(vidRhythm, { top: 24, inline: 20, gap: 16, bottom: 24 }, '面板语言这一档的取值');
});

/* ── ⑤ 所有"选一个值"的控件读同一批 token ──────────────────────────────────────────── */
test('⑤ 所有"选一个值"的控件读同一批 token', () => {
  const videoOpts = ['.video-inline-menu > button', '.video-ratio-cards button', '.video-resolution-pills button'];
  const imageOpts = ['.visual-choice-card', '.visual-ratio-card', '.visual-spec-chip'];
  for (const [list, opts, name] of [[videoRules, videoOpts, '视频侧'], [imageRules, imageOpts, '图片侧']]) {
    for (const selector of opts) {
      const r = blockOf(list, selector, name, { prop: 'border-radius', last: true });
      assert.equal(r.decls.border, '1.5px solid transparent',
        name + ' ' + selector + '：描边必须是 1.5px 透明**占位**（否则选中加描边时整块会抖）');
      assert.equal(r.decls['border-radius'], 'var(--sb-radius-card)', name + ' ' + selector + '：圆角走 --sb-radius-card');
      assert.equal(r.decls.background, 'var(--sb-l3-option)', name + ' ' + selector + '：默认底走 --sb-l3-option');
    }
  }
  for (const [a2, b2] of [
    ['.visual-ratio-card:hover:not(:disabled):not(.is-selected)', '.video-ratio-cards button:hover:not(:disabled):not(.is-selected)'],
    ['.visual-spec-chip:hover:not(:disabled)', '.video-resolution-pills button:hover:not(:disabled):not(.is-selected)'],
    ['.visual-choice-card:hover:not(:disabled):not(.is-selected)', '.video-inline-menu > button:hover:not(.is-selected)'],
  ]) {
    assert.equal(blockOf(imageRules, a2, '图片侧').decls.background, 'var(--sb-l3-option-hover)', '图片侧 hover 底：' + a2);
    assert.equal(blockOf(videoRules, b2, '视频侧').decls.background, 'var(--sb-l3-option-hover)', '视频侧 hover 底：' + b2);
  }
  for (const [a2, b2] of [
    ['.visual-ratio-card.is-selected', '.video-ratio-cards button.is-selected'],
    ['.visual-spec-chip.is-selected', '.video-resolution-pills button.is-selected'],
    ['.visual-choice-card.is-selected', '.video-inline-menu > button.is-selected'],
  ]) {
    const a = blockOf(imageRules, a2, '图片侧', { prop: 'border-color' });
    const b = blockOf(videoRules, b2, '视频侧', { prop: 'border-color' });
    for (const prop of ['background', 'border-color', 'box-shadow']) {
      assert.equal(a.decls[prop], b.decls[prop], '选中态 ' + prop + ' 两侧不一致：' + a2 + ' vs ' + b2);
    }
    assert.equal(a.decls.background, 'var(--sb-sel-bg)');
    assert.equal(a.decls['border-color'], 'var(--sb-sel-line)');
    assert.equal(a.decls['box-shadow'], 'var(--sb-shadow-ring)');
  }
});

/* ── ⑥ 卡内尺寸与文字：比例卡 / 分辨率药丸两侧同值 ─────────────────────────────────── */
test('⑥ 比例卡与分辨率药丸：卡内尺寸同值', () => {
  /* ⚠️ 图片侧 .visual-ratio-card 有两条规则（主定义 + 紧凑档），主定义在**后面** ⇒ 取 last */
  const imgCard = blockOf(imageRules, '.visual-ratio-card', '图片侧', { prop: 'min-height', last: true });
  const vidCard = blockOf(videoRules, '.video-ratio-cards button', '视频侧');
  for (const prop of ['min-height', 'padding', 'gap', 'border-radius', 'background']) {
    assert.equal(imgCard.decls[prop], vidCard.decls[prop], '比例卡 ' + prop + ' 两侧不一致');
  }
  assert.equal(imgCard.decls['min-height'], '68px', '比例卡最小高 68（两侧同值）');

  const imgPill = blockOf(imageRules, '.visual-spec-chip', '图片侧');
  const vidPill = blockOf(videoRules, '.video-resolution-pills button', '视频侧');
  for (const prop of ['min-height', 'padding', 'border-radius', 'background']) {
    assert.equal(imgPill.decls[prop], vidPill.decls[prop], '分辨率药丸 ' + prop + ' 两侧不一致');
  }
  assert.equal(imgPill.decls['min-height'], '45px', '分辨率药丸最小高 45（两侧同值）');

  assert.equal(blockOf(videoRules, '.video-ratio-cards i', '视频侧').decls.border, '2px solid currentColor',
    '视频侧比例图形 = 2px currentColor（图片侧那枚 SVG 同款，颜色跟着卡片文字走）');
});

/* ── ⑦ 模型标：**两侧同一个尺寸档**（图片侧的常量就是真源） ──────────────────────────── */
test('⑦ 模型标尺寸与动效：视频侧与图片侧同源', () => {
  const lang = read('src/pages/Home/ec/panelVisualLanguage.js');
  const trigger = Number((lang.match(/modelTrigger:\s*(\d+)/) || [])[1]);
  const option = Number((lang.match(/modelOption:\s*(\d+)/) || [])[1]);
  assert.equal(trigger, 28, '图片侧触发行的模型标 = 28（真源）');
  assert.equal(option, 32, '图片侧选项行的模型标 = 32（真源）');
  assert.equal(blockOf(videoRules, '.video-config-trigger.is-model .video-model-mark', '视频侧').decls.width, trigger + 'px',
    '视频侧触发行的模型标必须与图片侧同尺寸');
  assert.equal(blockOf(videoRules, '.video-inline-menu.is-model .video-model-mark', '视频侧').decls.width, option + 'px',
    '视频侧选项行的模型标必须与图片侧同尺寸');
  /* 悬停动效同一套：静止 .88 → 悬停/选中回 1（图片侧是 .ec-model-mark > * 的 0.88 → 1） */
  assert.equal(blockOf(videoRules, '.video-model-mark', '视频侧', { prop: 'transform', last: true }).decls.transform, 'scale(.88)',
    '视频侧模型标静止态 = 0.88（与图片侧同一套动效）');
  assert.match(read('src/styles/design-tokens-v3.css'), /\.ec-model-mark > \*\s*\{[^}]*transform:\s*scale\(0\.88\)/,
    '图片侧 .ec-model-mark 的静止态就是 0.88 —— 两边同源');
});

/* ── ⑧ 全屏按钮：两侧同一颗（图片侧是本批新加的 —— 用户点名「这个你也要加上去」） ──────── */
test('⑧ 全屏按钮：图片侧与视频侧同一套', () => {
  const imagePage = read('src/pages/Home/VisualCreationMode.jsx');
  assert.match(imagePage, /className="visual-materials-fullscreen"[^>]*aria-pressed=\{fullscreen\}/,
    '图片侧的「全屏」按钮要有 aria-pressed（与视频侧同一实现）');
  assert.match(imagePage, /requestFullscreen/, '图片侧走原生 Fullscreen API（与视频侧同一套）');
  assert.match(imagePage, /fullscreen && composerRef\.current \? composerRef\.current : document\.body/,
    '全屏时配置浮层必须挂到全屏元素自己（挂 body 的浮层在全屏下根本不渲染）');
  assert.match(imagePage, /addEventListener\('fullscreenchange'/, '状态从 fullscreenchange 读回来（按 ESC 后不许说反话）');

  for (const [imgSel, vidSel] of [
    ['.visual-materials-actions', '.video-materials-actions'],
    ['.visual-materials-fullscreen', '.video-materials-fullscreen'],
    ['.visual-materials-fullscreen:hover', '.video-materials-fullscreen:hover'],
  ]) {
    const vid = blockOf(videoRules, vidSel, '视频侧');
    sameDecls(blockOf(imageRules, imgSel, '图片侧'), vid, Object.keys(vid.decls), '全屏按钮 ' + vidSel);
  }
});

/* ── ⑨ 模型面板的**内边距与上下节奏**：视频侧按图片侧的取值算出来 ─────────────────────────────
   用户原话（逐字，7 张批注图第 5 条）：
     「你现在**生图模型**这边的张开面板，左右两边的间距，上下的间距，我觉得做的也还行吧，可是你
       **视频生成那边的模型选择面板**似乎是不一样的。」「你看很明显视频生成这边的模型选择的面板。
       他这些按钮**左右两边的空白间距是跟图片生成那边不一样的**。这个你也得去**对齐**一下。」
   实测（.qa/cy2-model-panels.mjs，1440×1000；两个面板同为 480 宽 / 圆角 20）：
     图片侧 `.visual-config-panel`（基准）：行左/右内缩 21（= 1px 边框 + 20）、顶到首行 57
       （= 1 + 24 + 标题 20 + 12）、末行到面板底 31（= 1 + 24 + 面板自身 6）、行间距 8。
     视频侧改前：行左/右内缩 **9**、顶到首行 50、末行到面板底 **9**。
   这条判据**不写死视频侧的那组数**，而是从图片侧的真源算出来再比 —— 以后谁把图片侧的 20/24/12
   改了，视频侧不跟着算就会当场红（这正是"两套东西"复发的那条路）。 */
test('⑨ 模型面板内边距与上下节奏：视频侧必须由图片侧的取值算出来', () => {
  const section = blockOf(imageRules, '.visual-panel-section', '图片侧');
  const padX = px(section.decls.padding.split(/\s+/)[1]);
  const padTop = px(blockOf(imageRules, '.visual-panel-section:first-child', '图片侧').decls['padding-top']);
  const padBottom = px(blockOf(imageRules, '.visual-panel-section:last-child', '图片侧').decls['padding-bottom']);
  const headGap = px(blockOf(imageRules, '.visual-panel-section-heading', '图片侧').decls['margin-bottom']);
  const panelPadBottom = px(blockOf(imageRules, '.visual-config-panel', '图片侧', { prop: 'padding-bottom' }).decls['padding-bottom']);
  assert.equal(padX, 20, '图片侧分区左右内边距 = 20（真源）');
  assert.equal(padTop, 24, '图片侧首段上内边距 = 24（真源）');
  assert.equal(padBottom, 24, '图片侧末段下内边距 = 24（真源）');
  assert.equal(headGap, 12, '图片侧标题到第一行 = 12（真源）');
  assert.equal(panelPadBottom, 6, '图片侧面板自身下内边距 = 6（真源）');

  /* padding 允许简写（CSS 的 3 值写法 = 上 / 左右 / 下）—— 按 CSS 的展开规则补全成上右下左再比，
     否则"写法不同"会被误判成"取值不同"。 */
  const expand = parts => { const [t, r = t, b = t, l = r] = parts.map(v => px(v)); return [t, r, b, l]; };
  const videoPad = expand(blockOf(videoRules, '.video-inline-menu.is-model', '视频侧', { prop: 'padding' })
    .decls.padding.split(/\s+/));
  assert.deepEqual(videoPad, [padTop, padX, padBottom + panelPadBottom, padX],
    '视频侧模型面板的内边距 = [图片侧首段顶, 图片侧左右, 图片侧末段底 + 面板自身底, 图片侧左右]；'
    + '实测 ' + JSON.stringify(videoPad) + '，应为 ' + JSON.stringify([padTop, padX, padBottom + panelPadBottom, padX]));

  /* 标题到第一行：容器是 `display: grid; gap: var(--sb-space-2)`，面板头**也是网格项**，
     所以那 12px 里有一部分是容器给的 —— 头自己的下内边距 + 容器 gap 必须正好等于 12。 */
  const token = Number((read('src/styles/design-tokens-v3.css').match(/--sb-space-2:\s*(\d+)px/) || [])[1]);
  const menuGap = blockOf(videoRules, '.video-inline-menu', '视频侧', { prop: 'gap' }).decls.gap;
  assert.equal(menuGap, 'var(--sb-space-2)', '模型列表的行距读的是那个间距 token（与图片侧同源的 8）');
  assert.equal(px(menuGap.replace(/var\(--sb-space-2\)/, token + 'px')), 8, '--sb-space-2 = 8');
  const headPad = blockOf(videoRules, '.video-inline-menu.is-model .video-model-menu-head', '视频侧')
    .decls.padding.split(/\s+/).map(v => px(v));
  assert.equal(headPad[2] + token, headGap, '头部下内边距 + 容器 gap 必须等于图片侧的 12px（实测 ' + (headPad[2] + token) + '）');

  /* 行按钮自身（内边距 / 圆角 / 间距）两侧本来就同值 —— 一起钉住，防止下次从这一侧被改动。
     ⚠️ `last: true`：`.video-inline-menu > button` 在本仓有**多条叠加**定义（376 行那条是 8px 的老版），
        生效值在最后一条 —— 取第一条会拿到早已被覆盖的旧值（本轮踩到）。 */
  const row = blockOf(videoRules, '.video-inline-menu > button', '视频侧', { prop: 'padding', last: true });
  assert.equal(row.decls.padding, 'var(--sb-space-2) var(--sb-space-3)', '模型行自身内边距仍读站内 token（8/12）');
  assert.equal(row.decls['border-radius'], 'var(--sb-radius-card)', '模型行圆角 = 卡片档（图片侧同档）');
});
