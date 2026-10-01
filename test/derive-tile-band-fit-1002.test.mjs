// test/derive-tile-band-fit-1002.test.mjs
// 2026-10-02：派生卡片在 **621~960px 那一档**的标题截断（批 CY-㊴ 之十六 的遗留项）。
// ─────────────────────────────────────────────────────────────────────────────
// 背景：卡片改成单行「图标 | 标题 | 价格徽标 | 箭头」之后，
//   · 桌面（菜单 480 两列 ⇒ 卡 237px）：标题要 52px、实得 101px，不截断 ✅
//   · 窄屏（≤620 单列 ⇒ 卡 320px）：不截断 ✅
//   · **621~960（菜单收窄到 360 但仍是两列 ⇒ 卡 177px）**：
//     价格徽标 54.58px + 图标 24 + 箭头 14 + 内外边距把 1fr 挤到只剩 42.42px，
//     而「生成视频」需要 52px ⇒ **被省略号砍成「生成...」**。
//
// 为什么不能「这一档也改单列」：单列 ⇒ 卡宽 320px 而标题只有 52px，
//   右侧会空出 ~230px —— 正是用户骂的「右边的留白太多」。已否决，写进注释。
//
// 为什么不能动字号/文案：字号已是 `--sb-text-xs`（11px，阶梯最小一档）；
//   「32积分起」去掉「起」会丢掉起价信息。
// ⇒ 只能收紧那一档的横向内边距与列间距（实测腾出 12px，够补那 10px）。
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const CSS_PATH = 'src/styles/canvas-derive-menu.css';
const TOKENS_PATH = 'src/styles/design-tokens-v3.css';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const css = read(CSS_PATH);

/* 取**基线**规则与那一档的覆盖规则。
   ⚠️ 必须剥注释再取 —— 本文件自己的注释里就写着「padding: 10px→6」「min-height: 62px」
   这些字样，不剥会读出根本不存在的声明（这个坑本批已经栽过三次，见 RTK）。 */
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ');
const flat = strip(css);

test('① 那一档的收紧规则存在，且只作用于 621~960（不许波及 ≤620 与桌面）', () => {
  const band = /@media\s*\(min-width:\s*621px\)\s*and\s*\(max-width:\s*960px\)\s*\{([\s\S]*?)\n\}/.exec(flat);
  assert.ok(band, '要能找到 min-width:621px and max-width:960px 那一档的 @media');
  assert.match(band[1], /\.ec-canvas-derive-tile\s*\{[^}]*padding:\s*8px 6px/,
    '那一档必须把卡片横向内边距收到 6px');
  assert.match(band[1], /\.ec-canvas-derive-tile\s*\{[^}]*column-gap:\s*6px/,
    '那一档必须把列间距收到 6px');
  /* 有 min-width 下界 ⇒ ≤620（本来就单列、卡宽 320px）不会被跟着收紧 */
  assert.match(flat, /@media\s*\(min-width:\s*621px\)/,
    '必须带 min-width 下界，否则 ≤620 那档本来宽裕也会被收紧');
});

test('② ⚠️ 收紧规则必须在基线规则**之后**（同特异度下靠后者赢）', () => {
  /* 我第一版把这条 @media 放在文件开头那堆 @media 旁边，而基线 `.ec-canvas-derive-tile`
     在它**下面** ⇒ 整条覆盖被基线吃掉，实测 900px 仍然「缺 10px」，看起来像没生效。
     这条判据就是为钉住那个顺序而存在的 —— 只断言"规则写了"会漏掉它。 */
  const baseAt = flat.search(/\.ec-canvas-derive-tile\s*\{/);
  const bandAt = flat.search(/@media\s*\(min-width:\s*621px\)/);
  assert.ok(baseAt > 0, '要能定位到基线规则');
  assert.ok(bandAt > 0, '要能定位到那一档的 @media');
  assert.ok(bandAt > baseAt,
    `收紧规则必须排在基线规则之后（同特异度下位置更靠后的赢）；现在基线@${baseAt} / 覆盖@${bandAt}`);
});

test('③ 基线仍然是「单行 + 高度由内容决定」，没被这一批改回去', () => {
  const base = /\.ec-canvas-derive-tile\s*\{([^}]*)\}/.exec(flat);
  assert.ok(base, '要能定位到基线规则');
  assert.match(base[1], /grid-template-areas:\s*"chip copy meta"/, '基线必须是单行布局');
  assert.doesNotMatch(base[1], /min-height/, '基线不许有 min-height 地板（那会让卡片空着 22px）');
});

/* ④ 真正证明"不截断"的那一条：**实机量**。
   静态断言只能证明"规则写了"，证明不了"标题真的放得下" ——
   而这一批的病根正是"看着写了、实际被盖掉"。所以这里用真 CSS + 真 DOM 量一遍。 */
test('④ 实机：那一档标题不得被省略号砍掉，且图标不许被挤', async t => {
  let browser;
  try { browser = await chromium.launch(); }
  catch { t.skip('playwright 不可用'); return; }

  const ACTIONS = [
    { label: '生成文案', priceLabel: '' },
    { label: '图片生成', priceLabel: '' },
    { label: '电商套图', priceLabel: '' },
    { label: '上传视频', priceLabel: '' },
    { label: '生成视频', priceLabel: '32积分起' },
  ];
  const ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
  const ARROW = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17 17 7M8 7h9v9"/></svg>';
  const tiles = ACTIONS.map(a => `<button type="button" class="ec-canvas-derive-tile">
    <span class="ec-canvas-derive-chip">${ICON}</span>
    <span class="ec-canvas-derive-copy"><strong>${a.label}</strong><small aria-hidden="true">d</small></span>
    <span class="ec-canvas-derive-meta">${a.priceLabel ? `<em>${a.priceLabel}</em>` : ''}${ARROW}</span>
  </button>`).join('\n');

  const html = `<!doctype html><html lang="zh"><head><meta charset="utf-8"><style>
${read(TOKENS_PATH)}
${css}
body{margin:0;padding:16px;background:#fff;font-family:system-ui,"Microsoft YaHei",sans-serif}
</style></head><body><div class="ec-canvas-derive-menu"><div class="ec-canvas-derive-bucket is-core">
<div class="ec-canvas-derive-bucket-label"><span>核心常用</span></div>
<div class="ec-canvas-derive-grid">${tiles}</div></div></div></body></html>`;

  const page = await browser.newPage({ viewport: { width: 900, height: 500 } });
  await page.setContent(html);
  const rows = await page.evaluate(() => [...document.querySelectorAll('.ec-canvas-derive-tile')].map(t => {
    const s = t.querySelector('.ec-canvas-derive-copy strong');
    const chip = t.querySelector('.ec-canvas-derive-chip').getBoundingClientRect();
    return {
      label: s.textContent,
      truncated: s.scrollWidth > s.clientWidth + 0.5,
      short: +(s.scrollWidth - s.clientWidth).toFixed(1),
      chipW: +chip.width.toFixed(1), chipH: +chip.height.toFixed(1),
      tileH: +t.getBoundingClientRect().height.toFixed(1),
    };
  }));
  await page.close();
  await browser.close();

  const bad = rows.filter(r => r.truncated);
  assert.deepEqual(bad.map(r => `${r.label}(缺${r.short})`), [],
    `900px 那一档标题被截断了：${JSON.stringify(bad)}`);
  /* 用户原话「那四个图标现在很挤」⇒ 图标尺寸不许动 */
  for (const r of rows) {
    assert.equal(r.chipW, 24, `${r.label} 的图标被挤了（宽 ${r.chipW}）`);
    assert.equal(r.chipH, 24, `${r.label} 的图标被挤了（高 ${r.chipH}）`);
  }
  assert.ok(rows.every(r => r.tileH <= 44), `卡片高度必须由内容决定（实测 ${rows.map(r => r.tileH).join(',')}）`);
});
