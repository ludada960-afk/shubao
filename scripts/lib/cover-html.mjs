/* ═══ 封面编排（构建期专用）：封面 = 该 skill 的**案例**排出来的 ═════════════════════
   2026-09-16 用户指正（截图 + 三句话），推翻了我前两版的理解：
     ① 「他上面推荐的板块是没有标题文字的，下面的子页面都是有标题，但都是在上面呀，
         下面才是遮罩的标题呀」
        → 推荐位封面**不烤字**；专区封面**烤字，但字在上方**；卡片**底部是遮罩标题**。
     ② 「他们的排版应该是基于里面生成案例去做的封面，不是直接做封面」
        → 封面**不是单独设计的一张图**，而是**把该 skill 的案例（作品示例）排在一起**。
          所以"封面"和"点进去看到的案例"必须是同一批素材 —— 这也正好是我们要的：
          封面即案例，点进去还是它，用户不会觉得被骗。
   于是本文件只做一件事：把**给定的一批真实案例图**按版式排成 4:3 封面。
   素材从哪来由 build-skill-covers.mjs 决定（它读 skill.cases），这里不碰数据。 */

const FONT = "'PingFang SC','Microsoft YaHei','Noto Sans SC','Source Han Sans SC','Hiragino Sans GB',system-ui,-apple-system,'Segoe UI',sans-serif";

/* 五个色相：与 COVER_ACCENTS 同名同义。底色一律浅色（缩到卡片尺寸不糊），
   主色只出现在标题装饰条、对比箭头这类小面积元素上。 */
export const COVER_THEME = {
  warm:    { bg1: '#FDF8F2', bg2: '#F2E2D2', ink: '#2E2118', sub: '#7A6252', a1: '#E8A87C', a2: '#C2704A' },
  soft:    { bg1: '#FDF7F6', bg2: '#F6E7E7', ink: '#332A2E', sub: '#7A666C', a1: '#E7B6BD', a2: '#C98A93' },
  cool:    { bg1: '#F8FBFD', bg2: '#E2EDF4', ink: '#1F2C35', sub: '#5C7080', a1: '#8FB6CC', a2: '#5B8AA6' },
  accent:  { bg1: '#F7F4FF', bg2: '#E7E0FA', ink: '#241A3D', sub: '#655A82', a1: '#A78BFA', a2: '#7C3AED' },
  neutral: { bg1: '#F7F7F8', bg2: '#E6E6EA', ink: '#18181B', sub: '#5C5C66', a1: '#B39BFF', a2: '#7C3AED' },
};

export function themeOf(accent) { return COVER_THEME[accent] || COVER_THEME.neutral; }

function esc(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* 版式常量（同一版式的每一张封面必须逐字一致）：
   标题在上方、字号克制（1600 宽下 68px，缩到 274 宽约 12px，作为封面内的字够用）；
   案例区从标题下方铺到接近底边；四边留白 ≥ 88px。 */
const PAD = 88;
const TITLE_PX = 68;
const TITLE_TOP = 84;
const AREA_TOP = 214;
const AREA_BOTTOM = 1140;

function head(copy, showTitle) {
  if (!showTitle) return '';
  return `
    <div class="head">
      <span class="rule"></span>
      <h1 class="title">${esc(copy.title)}</h1>
    </div>`;
}

/* case-3up：三张真实案例错落叠压（沿用我们自己素材卡的 -4° / 0 / +4° 扇形语言） */
function case3up(copy, tiles, showTitle) {
  const shown = tiles.slice(0, 3);
  return `
  ${head(copy, showTitle)}
  <div class="fan">
    ${shown.map((tile, index) => `<figure class="tile t${index}"><img src="${esc(tile)}" alt=""></figure>`).join('')}
  </div>`;
}

/* hero-single：一张真实案例为主体 */
function heroSingle(copy, tiles, showTitle) {
  return `
  ${head(copy, showTitle)}
  <div class="hero"><img src="${esc(tiles[0])}" alt=""></div>`;
}

/* poster-style：整幅真实案例铺满（海报类案例本身自带完整画面） */
function posterStyle(copy, tiles, showTitle) {
  return `
  ${head(copy, showTitle)}
  <div class="poster-panel"><img src="${esc(tiles[0])}" alt=""></div>`;
}

/* before-after：原图 → 成品。修图 / 复刻 / 试穿类的正解（43 §10.4），竞品也是这么做的。 */
function beforeAfter(copy, tiles, showTitle) {
  const [before, after] = tiles;
  return `
  ${head(copy, showTitle)}
  <div class="ba">
    <figure class="ba-tile"><img src="${esc(before)}" alt=""><figcaption>原图</figcaption></figure>
    <span class="ba-arrow" aria-hidden="true">→</span>
    <figure class="ba-tile"><img src="${esc(after)}" alt=""><figcaption>成品</figcaption></figure>
  </div>`;
}

const LAYOUTS = { 'case-3up': case3up, 'hero-single': heroSingle, 'poster-style': posterStyle, 'before-after': beforeAfter };

function css(theme, showTitle) {
  const areaTop = showTitle ? AREA_TOP : PAD;
  return `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1600px; height: 1200px; overflow: hidden; }
  body { font-family: ${FONT}; -webkit-font-smoothing: antialiased; }
  #cover { position: relative; width: 1600px; height: 1200px; overflow: hidden;
           background: linear-gradient(135deg, ${theme.bg1} 0%, ${theme.bg2} 100%); }
  #cover::after { content: ''; position: absolute; inset: 0; pointer-events: none;
                  background: radial-gradient(940px 720px at 78% 6%, rgba(255,255,255,0.88), rgba(255,255,255,0) 72%); }
  .head { position: absolute; left: ${PAD}px; top: ${TITLE_TOP}px; z-index: 6; display: flex; align-items: center; gap: 26px; }
  .rule { width: 76px; height: 10px; border-radius: 5px; background: linear-gradient(90deg, ${theme.a1}, ${theme.a2}); }
  .title { font-size: ${TITLE_PX}px; font-weight: 900; letter-spacing: 2px; color: ${theme.ink}; line-height: 1; }
  /* ── 案例区：从 ${areaTop}px 铺到底部留白 ── */
  .fan { position: absolute; left: 0; right: 0; top: ${areaTop}px; height: ${AREA_BOTTOM - areaTop}px;
         display: flex; align-items: center; justify-content: center; z-index: 4; }
  .tile { width: 396px; height: 396px; border-radius: 34px; overflow: hidden; background: #FFFFFF;
          box-shadow: 0 28px 58px rgba(24,18,12,0.16), 0 0 0 9px rgba(255,255,255,0.92); }
  .tile + .tile { margin-left: -62px; }
  .tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .t0 { transform: rotate(-4deg); z-index: 1; }
  .t1 { transform: translateY(-28px) scale(1.05); z-index: 3; }
  .t2 { transform: rotate(4deg); z-index: 2; }
  .hero { position: absolute; left: 50%; top: ${areaTop}px; transform: translateX(-50%);
          height: ${AREA_BOTTOM - areaTop}px; aspect-ratio: 1 / 1; border-radius: 48px; overflow: hidden; z-index: 4;
          background: #FFFFFF; box-shadow: 0 40px 80px rgba(24,18,12,0.18), 0 0 0 10px rgba(255,255,255,0.92); }
  .hero img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .poster-panel { position: absolute; left: ${PAD}px; right: ${PAD}px; top: ${areaTop}px; height: ${AREA_BOTTOM - areaTop}px;
                  border-radius: 44px; overflow: hidden; z-index: 4; background: #FFFFFF;
                  box-shadow: 0 40px 80px rgba(24,18,12,0.20); }
  .poster-panel img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .ba { position: absolute; left: 0; right: 0; top: ${areaTop}px; height: ${AREA_BOTTOM - areaTop}px;
        display: flex; align-items: center; justify-content: center; gap: 44px; z-index: 4; }
  .ba-tile { position: relative; height: 100%; aspect-ratio: 1 / 1; border-radius: 40px; overflow: hidden; background: #FFFFFF;
             box-shadow: 0 32px 64px rgba(24,18,12,0.18), 0 0 0 9px rgba(255,255,255,0.92); }
  .ba-tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .ba-tile figcaption { position: absolute; left: 20px; bottom: 20px; padding: 8px 20px; border-radius: 999px;
                        font-size: 27px; font-weight: 700; color: ${theme.ink}; background: rgba(255,255,255,0.9); }
  .ba-arrow { font-size: 72px; font-weight: 900; color: ${theme.a2}; line-height: 1; }
  `;
}

/* 对外唯一入口：版式 + 文案 + **该 skill 的案例图** → 一整页 HTML（截图 1600×1200）。 */
export function renderCoverHtml({ layout, accent, title, showTitle = true, tiles = [] }) {
  const theme = themeOf(accent);
  const render = LAYOUTS[layout] || LAYOUTS['hero-single'];
  const copy = { title };
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>${css(theme, showTitle)}</style></head>
<body><div id="cover" data-layout="${esc(layout)}" data-accent="${esc(accent)}" data-title="${showTitle ? 'on' : 'off'}">${render(copy, tiles, showTitle)}</div></body></html>`;
}
