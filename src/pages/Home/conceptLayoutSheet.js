/* ═══ 「概念视觉方案」的**版式层**：客户端确定性拼版（2026-09-27 批 DC / M3）════════════════════
   实测依据（docs/research/2026-09-27-aura-deep-dive.md §三③ 与 §五-影响 1）：
     · 拼版 **60/402 张（14.9%）**，分布在 **36/41 篇（87.8%）** —— 这是"像不像他"的最大差距
       （现在的工作台是一张一张出成品图，`docs/design/78` 还写着"不要拼贴边框"，**方向与实作相反**，
        本批按 docs/design/90 §六 改口径：拼版是**确定性渲染层**）。
     · 四种成体系语法：**宫格**（n20-1、n29-1/4、n32-1、n35-1/9、n36-3、n40-1、n19-1、n25-7、n31-3）、
       **底片条**（n24-4、n28-7、n27-1 —— 带齿孔与边框码）、宝丽来画中画（10 张）、品牌信息图版式。
       ⇒ 本批只做**前两种**（M3 的范围；后两种排在 M5）。

   ⚠️⚠️ 一条硬约束（实测踩出来的，写在这里免得下一轮有人"优化"掉）────────────────────────────
     **绝不能让模型"一次画一整张九宫格"** —— 那样分格线会画歪、格内内容互相渗透。
     正确做法是**先出 N 张单图，再在这一层拼**。所以这一层是纯几何 + canvas 绘制：
     **不调模型、不计费、不新增服务端端点**（要留档时走既有的上传/资产链路，见 saveSheetToAssets）。

   ── 文件结构 ──────────────────────────────────────────────────────────────
     前半部分是**纯函数**（不碰 DOM、不碰 canvas）—— 门禁直接断言矩形，
     所以"列数随张数变化 / 底片条等宽间隔 / 0 张不产出空图"这些判据才能自动跑。
     后半部分是浏览器侧的绘制与导出（loadImage / renderLayoutSheet / layoutSheetBlob）。

   导出尺寸取 **1080 宽/格**：实测 Aura 的内页图就是 **1080 宽**（deep-dive 附录：img/n01..n41 全 1080 宽），
   按这个尺寸拼出来的成品图与平台原生宽度一致。 */
import { CONCEPT_COMPOSE_FAMILIES, CONCEPT_LAYOUT_FAMILIES } from '../../skills/imageSkills.js';
import { LAYOUT_FAMILY_NONE, pieceLayoutFamilyHolds } from '../../skills/skillRun.js';

/* 单格 = 本账号签名 3:4（与工作台「比例」默认档 3:4 同源） */
export const LAYOUT_CELL = Object.freeze({ width: 1080, height: 1350 });
/* 宫格之间留一条白缝（实测那种"杂志内页"的格子不是贴死的） */
const GRID_GAP = 18;
/* 底片条：外框、齿孔条高度、格与格之间的缝
   ⚠️ 外框从 26 加到 46（2026-09-28）：26 的框里放不下那行边框码，码只能贴着画布下边缘
      （复核原话："距画布下边缘只有 6px……字高只有 14px，按正常看图尺寸折算约 3px 高，仍然基本看不见"）。 */
const STRIP_FRAME = 46;
const STRIP_HOLE_BAR = 30;
const STRIP_GAP = 16;
/* ═══ 宝丽来画中画（2026-09-28 批 DC 续-3）════════════════════════════════════════════════════
   实测（deep-dive §三③-3）：白框/宝丽来相纸 14 张、落在 8 篇（n22-2、n24-2/9、n26-7、n27-2、
   n29-2、n34-1/6/11、n23-5/9/10、n32-4）—— 与"品牌信息图版式"并列第二大树。
   形制照 n34-1（三个宝丽来框竖排）与 n22-2（框里再叠框）：相纸是**下方留宽边**的白框，
   纸面上轻微旋转、带投影 —— 所以几何里要带 `rotate`（纯函数可断言），
   反旋转溢出由画布外边距兜住（ROTATE_MARGIN）。 */
const POLAROID_PAD = 58;
const POLAROID_BAND = 168;
const POLAROID_GAP = 74;
const POLAROID_STAGGER = 132;      /* 单数列（奇数行）横向错开半张卡，像摊在桌上的照片 */
const ROTATE_MARGIN = 96;
/* 固定旋转序列（可复现：同一组勾选永远得到同一张成品图）——角度都压在 3° 内，像随手摆放而不是歪 */
const POLAROID_ANGLES = [2.2, -1.8, 1.4, -2.6, 1.1, -1.5, 2.0, -1.2];
/* ═══ 品牌"信息图"版式（2026-09-28 批 DC 续-3）══════════════════════════════════════════════════
   实测（deep-dive §三③-4）：14 张、落在 6 篇（n33-4/8、n35-6、n36-4/6/10、n20-2/9/12、n37-2/3/4、n38-3）。
   三种模板是实测里反复出现的三种排法（x 上是"一张图 + 一块排版"）：
     · 左图右文（n33-4/8、n36-4/6/10、n37-2）
     · 词典卡（n35-6：`miutine｜ˈmjuːtiːn｜adj. …` 那种释义排法）
     · 大字色块（n20-2/9/12、n26-11、n37-8、n38-2/9、n19-7：整幅图 + 大字/色带）
   ⚠️ 文案**由用户自己写**（可编辑文本框，默认只有标题、正文空着）：实测那些页里写的是品牌方
      的英文句子与产品名，我们**不许替他编品牌文案**，也不把这段文字送进模型（它是拼版层加的）。 */
export const LAYOUT_INFO_TEMPLATES = () => ([
  { value: '左图右文', label: '左图右文', hint: '左边一张图、右边一块文字版式（他的信息图里最常见的一种）' },
  { value: '词典卡', label: '词典卡', hint: '图在上、下面像词典条目：大词 + 音标式分隔 + 释义行' },
  { value: '大字色块', label: '大字色块', hint: '整幅图压一条色带，放大字标题' },
]);
export const LAYOUT_INFO_DEFAULT_TEMPLATE = '左图右文';

/* ═══ 版式层的**作品用色**（一处声明，2026-09-28 批 DC 续-3）═════════════════════════════════
   ⚠️ 这些不是界面主题色，是**印在成品图里的颜色**（拼出来的那张 JPEG 就是交付物）：
      canvas 读不到 CSS token，而"作品长什么样"也不该跟着站点主题变 —— 所以它们必须是字面量。
      同类的还有 server/motionStillRender 与 videoExportRender 的渲染色。
   ⇒ 设计 token 棘轮把这一处登记为**合法业务色**（`docs/design/token-ratchet-baseline.json`），
      与那条门禁的告警语里写的"作品渲染色请走人工评审后登记"是同一件事。
      集中在这一个对象里（而不是散在几十行绘图代码里）就是为了"一眼能审"。 */
export const LAYOUT_INK = Object.freeze({
  paper: '#ffffff',        /* 宫格/信息图的纸面 */
  paperWarm: '#f2ece3',    /* 宝丽来的暖纸面 */
  filmBase: '#141414',     /* 底片条的片基 */
  filmHole: '#f2f2f2',     /* 底片条齿孔 */
  card: '#fffdf8',         /* 宝丽来相纸 */
  infoPanel: '#f4f0ea',    /* 信息图"左图右文"右侧纸色版 */
  ink: '#1b1b1f',          /* 正文墨色 */
  inkStrong: '#141418',    /* 标题墨色 */
  inkSoft: '#5a5148',      /* 宝丽来相纸上的手写体色 */
  onBand: '#f7f4ef',       /* 色带上的正文 */
  onBandStrong: '#ffffff', /* 色带上的标题 */
});

export function isInfoTemplate(value) {
  return LAYOUT_INFO_TEMPLATES().some(item => item.value === String(value || '').trim());
}

/* ═══ 「不拼版」那一档 = 这一篇不拼（中性档）════════════════════════════════════════════════════
   2026-09-28 用户口径：「版式族为什么一定要选呢……是必须选吗」。它不是一个"族"，只是声明"不拼"，
   所以下面的判据里它一律走"拼不了"那条路（不渲染拼版入口、不产出空图）。 */
export function isLayoutNONE(value) {
  return String(value || '').trim() === LAYOUT_FAMILY_NONE;
}

/** 这一条技能现在**拼得出来**的族（不含「不拼版」；判据来自声明源，不在这里另写一份名单）。 */
export function layoutFamilies() {
  return CONCEPT_COMPOSE_FAMILIES();
}

/** 声明源里的全部档位（含「不拼版」）—— 结果区那颗"想拼就选一族"的入口按它渲染。 */
export function layoutFamilyOptions() {
  return CONCEPT_LAYOUT_FAMILIES();
}

export function isLayoutFamily(family) {
  return layoutFamilies().includes(String(family || '').trim());
}

/* ── ① 版式计划（纯函数）：给出张数与族，返回成图尺寸 + 每一张的目标矩形 ──────────────
   返回 null = **这一篇现在拼不了**（0 张 / 1 张 / 选了「不拼版」/ 认不出的族）——
   调用方据此不渲染按钮、也不产出空图。 */
export function layoutSheetPlan({ family = '', count = 0, cell = LAYOUT_CELL, template = '' } = {}) {
  const total = Math.max(0, Number.parseInt(count, 10) || 0);
  const name = String(family || '').trim();
  /* ⚠️ 「至少 2 张」是**渲染下限**（1 张拼不出东西）—— 判据只有一份，在 skillRun.pieceLayoutFamilyHolds
     （它的依据在 2026-09-28 改过一次：原来那条"同族复用 74/402"属于出图侧，已经挪去「连拍组」）。 */
  if (!pieceLayoutFamilyHolds(name, total)) return null;
  if (!isLayoutFamily(name)) return null;
  if (name === '底片条') return stripPlan(total, cell);
  if (name === '宝丽来画中画') return polaroidPlan(total, cell);
  if (name === '品牌信息图') return infoSheetPlan(total, cell, template);
  return gridPlan(total, cell);
}

/* 宫格：**列数随张数变化**（ceil(√n)）：2→2 列、3~4→2 列、5~9→3 列……
   ⚠️ 2026-09-28：列数可显式传入（信息图用它做到"3 张以内一行放满"，不留孤零零的最后一行）。 */
export function gridColumns(count) {
  const total = Math.max(1, Number.parseInt(count, 10) || 1);
  return Math.ceil(Math.sqrt(total));
}

function gridPlan(count, cell, columns = gridColumns(count)) {
  const rows = Math.ceil(count / columns);
  const width = columns * cell.width + (columns - 1) * GRID_GAP;
  const height = rows * cell.height + (rows - 1) * GRID_GAP;
  const cells = [];
  for (let index = 0; index < count; index += 1) {
    const row = Math.floor(index / columns);
    const column = index % columns;
    /* 最后一行不满时**居中**：3 张排 2×2 时右下角空一格会让整张图明显歪向一边。
       （纯几何、可复现 —— 门禁断言 3 张时第三格是居中的那一格。） */
    const inRow = Math.min(columns, count - row * columns);
    const rowWidth = inRow * cell.width + (inRow - 1) * GRID_GAP;
    const offset = Math.round((width - rowWidth) / 2);
    cells.push({
      index,
      left: offset + column * (cell.width + GRID_GAP),
      top: row * (cell.height + GRID_GAP),
      width: cell.width,
      height: cell.height,
    });
  }
  /* columns / rows 一并返回：界面上要说"这一篇排 2×2 还是 3×3"，门禁也据此断言"列数随张数变化"
     （不许用"去重后的 left 个数"当列数 —— 最后一行居中时那个数会多算一列，实测踩过）。 */
  return { family: '宫格', count, width, height, gap: GRID_GAP, frame: 0, holeBar: 0, columns, rows, cells };
}

/* 底片条：一排**等宽格 + 等间隔**，外面一圈深色边框，上下各一条齿孔带（画的时候用） */
function stripPlan(count, cell) {
  const width = STRIP_FRAME * 2 + count * cell.width + (count - 1) * STRIP_GAP;
  const height = STRIP_FRAME * 2 + STRIP_HOLE_BAR * 2 + cell.height;
  const cells = Array.from({ length: count }, (_, index) => ({
    index,
    left: STRIP_FRAME + index * (cell.width + STRIP_GAP),
    top: STRIP_FRAME + STRIP_HOLE_BAR,
    width: cell.width,
    height: cell.height,
  }));
  return {
    family: '底片条', count, width, height,
    gap: STRIP_GAP, frame: STRIP_FRAME, holeBar: STRIP_HOLE_BAR,
    columns: count, rows: 1, cells,
  };
}

/* ── 宝丽来画中画：纸面上一张张相纸，奇数行错开半张、每张一个固定的小角度 ══════════════════════
   每格返回的是**卡片本身**（含内嵌图区与下方留白边），以及 `rotate`（角度）与 `photo`（内嵌图区）。
   ⚠️ 旋转会让四角超出未旋转的矩形，超出的量由 ROTATE_MARGIN 兜住（画布外边距按它取），
      所以"格子不许跑到画布外"这条判据对旋转后的卡片也成立 —— 门禁用的是 `bounds`。 */
function polaroidPlan(count, cell) {
  const card = {
    width: cell.width + POLAROID_PAD * 2,
    height: cell.height + POLAROID_PAD + POLAROID_BAND,
  };
  const columnsMax = 2;
  const rows = Math.ceil(count / columnsMax);
  const contentWidth = columnsMax * card.width + (columnsMax - 1) * POLAROID_GAP;
  const marginX = Math.round(POLAROID_STAGGER / 2) + ROTATE_MARGIN;
  const marginY = ROTATE_MARGIN;
  const width = contentWidth + marginX * 2;
  const cells = [];
  for (let index = 0; index < count; index += 1) {
    const row = Math.floor(index / columnsMax);
    const column = index % columnsMax;
    const inRow = Math.min(columnsMax, count - row * columnsMax);
    const rowWidth = inRow * card.width + (inRow - 1) * POLAROID_GAP;
    /* 每行居中；奇数行额外错开半个身位（像随手摊开，而不是排表格） */
    const stagger = row % 2 === 1 ? Math.round(POLAROID_STAGGER / 2) : 0;
    const offset = Math.round((contentWidth - rowWidth) / 2) + stagger;
    const rotate = POLAROID_ANGLES[index % POLAROID_ANGLES.length];
    cells.push({
      index,
      left: marginX + offset + column * (card.width + POLAROID_GAP),
      top: marginY + row * (card.height + POLAROID_GAP) + (row % 2 === 1 ? 26 : 0),
      width: card.width,
      height: card.height,
      rotate,
      card: { pad: POLAROID_PAD, band: POLAROID_BAND },
      /* 内嵌图区：上方留 PAD、左右留 PAD、下方留 BAND（宝丽来相纸的签名形制） */
      photo: { left: POLAROID_PAD, top: POLAROID_PAD, width: cell.width, height: cell.height },
      bounds: rotatedBounds(card.width, card.height, rotate),
    });
  }
  const height = marginY * 2 + rows * card.height + (rows - 1) * POLAROID_GAP + 26;
  return {
    family: '宝丽来画中画', count, width, height,
    gap: POLAROID_GAP, frame: 0, holeBar: 0,
    columns: columnsMax, rows, paper: LAYOUT_INK.paperWarm, cells,
  };
}

/* 旋转后包围盒相对中心的半宽/半高（纯算术：门禁据此断言"旋转也不出画布"） */
export function rotatedBounds(width, height, degrees) {
  const rad = (Math.abs(Number(degrees) || 0) * Math.PI) / 180;
  return {
    halfWidth: (Math.abs(width) * Math.cos(rad) + Math.abs(height) * Math.sin(rad)) / 2,
    halfHeight: (Math.abs(width) * Math.sin(rad) + Math.abs(height) * Math.cos(rad)) / 2,
  };
}

/* ── 品牌信息图：每张做成一张"版式卡"（图 + 一块排版），按宫格的排法成页 ════════════════════════
   三种模板的差别只在**图区与文字区怎么分**（实测的三种排法），卡面尺寸与宫格一致。 */
function infoSheetPlan(count, cell, template) {
  const name = isInfoTemplate(template) ? String(template).trim() : LAYOUT_INFO_DEFAULT_TEMPLATE;
  const base = gridPlan(count, cell, infoSheetColumns(count));
  const cells = base.cells.map(item => ({ ...item, zones: infoCardZones(name, item) }));
  return { ...base, family: '品牌信息图', template: name, paper: LAYOUT_INK.paper, cells };
}

/* 一张信息图卡里的两个区（纯矩形；渲染层照着画）。三种模板各自的实测出处见文件头注释。
   ⚠️ 这里是**固定窗口 + cover（温和裁剪）**，不是 contain：第二轮真机复核把 contain 的问题点得很准
      ——"四张素材原始比例差很大（1.78/1.77/1.01/0.75），统一按宽度铺满后四张图高度差 2.4 倍，
      上排变成细条、下排很大，2×2 视觉重量一边倒"，而且"照片左边缘就在 x=0，纸色只出现在上下"。
      所以两族都改成：图区是一个**比例固定的窗口**（≈3:4 或 ≈4:3），裁一点、但不留大片纸色、
      也不让相邻两张图大小差一倍。窗口自己**垂直居中**在卡里。 */
export function infoCardZones(template, cell) {
  const width = cell.width;
  const height = cell.height;
  const name = isInfoTemplate(template) ? String(template).trim() : LAYOUT_INFO_DEFAULT_TEMPLATE;
  if (name === '词典卡') {
    /* 图在上（68% 高）、词典条目在下：文字区一直伸到卡底附近，整卡不再"上面满、下面空一大块" */
    const imageHeight = Math.round(height * 0.68);
    return {
      template: name,
      image: { left: 0, top: 0, width, height: imageHeight },
      text: { left: 96, top: imageHeight + 54, width: width - 192, height: height - imageHeight - 96 },
      rule: true,
    };
  }
  if (name === '大字色块') {
    const bandHeight = Math.round(height * 0.34);
    return {
      template: name,
      image: { left: 0, top: 0, width, height },
      text: { left: 84, top: height - bandHeight + 62, width: width - 168, height: bandHeight - 124 },
      band: { left: 0, top: height - bandHeight, width, height: bandHeight },
    };
  }
  /* 左图右文：左边一个**竖窗**（58% 宽 × 62% 高，比例≈3:4 ⇒ 竖图几乎不裁、横图温和裁两侧），
     窗口在卡里垂直居中；右侧一整块纸色版，文字在其中垂直居中。 */
  const imageWidth = Math.round(width * 0.58);
  const imageHeight = Math.round(height * 0.62);
  return {
    template: '左图右文',
    image: { left: 0, top: Math.round((height - imageHeight) / 2), width: imageWidth, height: imageHeight },
    text: { left: imageWidth + 76, top: 132, width: width - imageWidth - 152, height: height - 264 },
    panel: { left: imageWidth + 38, top: 64, width: width - imageWidth - 76, height: height - 128 },
  };
}

/* 信息图每行放几张：**3 张以内就一行放满**（不留"最后一行只有一张居中"的空档 ——
   第二轮复核里 3 张的图被读成"下排只有一张卡、左右各 549px 纯白，整张排版不成立"），
   4 张以上沿用宫格的 ceil(√n)。 */
export function infoSheetColumns(count) {
  const total = Math.max(1, Number.parseInt(count, 10) || 1);
  return total <= 3 ? total : gridColumns(total);
}

/* ── ② 单格填充方式（纯函数）：按 **cover** 填满，不拉伸 ─────────────────────────
   返回源图上的裁剪矩形；宽高比与目标格**一致**（门禁断言这一点：
   拉伸会把人物拍扁，而"主体比例可信"是本账号纪律里的一条）。 */
export function coverSourceRect(sourceWidth, sourceHeight, targetWidth, targetHeight) {
  const sw = Number(sourceWidth) || 0;
  const sh = Number(sourceHeight) || 0;
  const tw = Number(targetWidth) || 0;
  const th = Number(targetHeight) || 0;
  if (!(sw > 0) || !(sh > 0) || !(tw > 0) || !(th > 0)) return null;
  const scale = Math.max(tw / sw, th / sh);
  const width = Math.min(sw, Math.max(1, Math.round(tw / scale)));
  const height = Math.min(sh, Math.max(1, Math.round(th / scale)));
  return { left: Math.round((sw - width) / 2), top: Math.round((sh - height) / 2), width, height };
}

/* ═══ ③ 绘制（浏览器侧）══════════════════════════════════════════════════════════════════════
   ⚠️ 生成图是本站同源地址（/api/generated-assets/…），所以不需要 crossOrigin 处理；
     若某天真要跨域，这里必须显式开 crossOrigin 并加 canvas 污染的处理 —— 现在没有这条路。 */
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('有一张图没能读进来，拼版中断'));
    image.src = url;
  });
}

function roundRect(context, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

/* 把一个矩形画进目标区（默认 **cover**：不拉伸，裁掉多的那一边）—— 各族共用同一份，
   所以"人物不被拍扁"这条在宝丽来/信息图上也自动成立。
   ⚠️ 信息图的「左图右文」「词典卡」用 **contain**（fit='contain'）：那一格里图的宽高比是被版式
      决定的（左图右文那一格是窄竖条），cover 会把平铺静物裁成一条中缝 —— 真机复核时被点名
      （"平铺静物只剩中间一条"）。contain 宁可留一点纸色边，也不把照片裁得看不懂。 */
function drawCover(context, image, target, { fit = 'cover' } = {}) {
  const source = coverSourceRect(
    image.naturalWidth || image.width, image.naturalHeight || image.height, target.width, target.height,
  );
  if (!source) return;
  if (fit === 'contain') {
    const sw = image.naturalWidth || image.width;
    const sh = image.naturalHeight || image.height;
    const scale = Math.min(target.width / sw, target.height / sh);
    const width = Math.max(1, Math.round(sw * scale));
    const height = Math.max(1, Math.round(sh * scale));
    context.drawImage(
      image, 0, 0, sw, sh,
      target.left + Math.round((target.width - width) / 2),
      target.top + Math.round((target.height - height) / 2),
      width, height,
    );
    return;
  }
  context.drawImage(
    image,
    source.left, source.top, source.width, source.height,
    target.left, target.top, target.width, target.height,
  );
}

/* 折行（中文按字、英文按词），并做一条最简的**禁则处理**：标点不许落在行首。
   ⚠️ 第一版是"逐字符无脑折"，真机导出来一看就出事：英文单词被劈成 `ke` / `pt`，
      中文标题被劈成「秋日限／定·灰／调大地」（是视觉复核抓到的，不是门禁抓到的）。
      所以现在：拉丁字母串整块当一个单位（按空格切），CJK 一字一单位。 */
const LINE_HEAD_FORBIDDEN = '，。、；：！？）】》」』…·,.;:!?)]}';
export function wrapTextLines(context, value, maxWidth = 0) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text || !(maxWidth > 0)) return [];
  const units = [];
  for (const paragraph of text.split('\n')) {
    if (units.length) units.push({ text: '', br: true });
    /* 拉丁词整块（含数字与小数点）；其余（CJK、标点）逐字 */
    for (const token of paragraph.match(/[A-Za-z0-9][A-Za-z0-9'’.\-]*|\s+|[^A-Za-z0-9\s]/g) || []) {
      if (/^\s+$/.test(token)) { units.push({ text: ' ', space: true }); continue; }
      units.push({ text: token });
    }
  }
  const lines = [];
  let line = '';
  for (const unit of units) {
    if (unit.br) { lines.push(line.trim()); line = ''; continue; }
    if (unit.space && !line) continue;                       /* 行首不留空格 */
    const next = line + unit.text;
    if (line && context.measureText(next).width > maxWidth) {
      /* 禁则：要换行时，下一个单位如果是标点，就让它跟着这一行走（宁可略微超宽） */
      if (LINE_HEAD_FORBIDDEN.includes(unit.text)) { lines.push(next.trim()); line = ''; continue; }
      lines.push(line.trim());
      line = unit.space ? '' : unit.text;
      continue;
    }
    line = next;
  }
  if (line.trim()) lines.push(line.trim());
  return lines.filter((item, index) => item || index === 0).length ? lines : [];
}

/* 文字块的**自适应**：从建议字号往下试，直到整段能装进文字区；再垂直居中。
   ⚠️ 两轮真机复核各抓到一半：
     第一版是硬折行 ⇒ 「灰调大地」被甩出一个孤字「地」（每张卡都有）；
     第二版加了"装不下就缩字号"，但**只按高度判**，而那个孤字恰好是"高度装得下、读起来很丑"
     —— 复核原话："第二行墨迹 97px = 正好一个汉字「地」，差 2% 就能一行放下却没缩字号"。
   ⇒ 现在多一条**孤字判据**：标题折行后如果最后一行短于区域宽度的 40%，就继续往小试
     （宁可整块小一档，也不要甩一个孤零零的字）。 */
function fitCopyBlock(context, zone, copy = {}, { headlineMax = 84, bodySize = 34 } = {}) {
  const headline = String(copy.headline || '').trim();
  const body = String(copy.body || '').trim();
  const measure = size => {
    context.font = '700 ' + size + 'px "Songti SC", "Noto Serif SC", Georgia, serif';
    const headLines = headline ? wrapTextLines(context, headline, zone.width) : [];
    const widow = headLines.length > 1
      && context.measureText(headLines[headLines.length - 1]).width < zone.width * 0.4;
    context.font = '400 ' + bodySize + 'px "Songti SC", "Noto Serif SC", Georgia, serif';
    const bodyLines = body ? wrapTextLines(context, body, zone.width) : [];
    const height = headLines.length * Math.round(size * 1.18) + (headLines.length && bodyLines.length ? 28 : 0)
      + bodyLines.length * Math.round(bodySize * 1.5);
    return { size, headLines, bodyLines, height, widow };
  };
  const sizes = [];
  for (let size = headlineMax; size >= Math.round(headlineMax * 0.5); size -= 2) sizes.push(size);
  let fallback = measure(sizes[0]);
  for (const size of sizes) {
    const candidate = measure(size);
    /* 装得下 + 没有孤字 = 就用它（最小的那一档会最先撞到下限，所以从大往小试） */
    if (candidate.height <= zone.height && !candidate.widow) return candidate;
    if (candidate.height <= zone.height) fallback = candidate;
  }
  return fallback;
}

/* 在给定的文字区里排一段（标题 + 正文）—— 信息图与宝丽来共用。返回实际排了几行（便于门禁/调试）。
   `rule` 传进来时，会在**标题排完之后**画一条细线（词典卡那条分隔线）——
   ⚠️ 它必须跟着标题走，不能钉在固定坐标上：文字块改垂直居中之后，钉死的那条线跑到了大词**上面**
      （复核原话："顺序由'大词→横线→释义'变成'横线→大词→释义'，词典条目的读法变了"）。 */
function drawCopyBlock(context, zone, copy = {}, { headlineSize = 84, bodySize = 34, color = LAYOUT_INK.ink, headlineColor = '', center = false, rule = false } = {}) {
  const fitted = fitCopyBlock(context, zone, copy, { headlineMax: headlineSize, bodySize });
  let cursor = center ? zone.top + Math.max(0, Math.round((zone.height - fitted.height) / 2)) : zone.top;
  let used = 0;
  if (fitted.headLines.length) {
    context.fillStyle = headlineColor || color;
    context.font = '700 ' + fitted.size + 'px "Songti SC", "Noto Serif SC", Georgia, serif';
    context.textBaseline = 'top';
    const step = Math.round(fitted.size * 1.18);
    for (const line of fitted.headLines) {
      if (cursor + step > zone.top + zone.height) break;
      context.fillText(line, zone.left, cursor);
      cursor += step;
      used += 1;
    }
    if (rule) {
      context.fillStyle = 'rgba(27,27,31,.32)';
      context.fillRect(zone.left, cursor + 14, zone.width, 3);
      cursor += 14 + 3;
    }
    if (fitted.bodyLines.length) cursor += 28;
  }
  if (fitted.bodyLines.length) {
    context.fillStyle = color;
    context.globalAlpha = 0.78;
    context.font = '400 ' + bodySize + 'px "Songti SC", "Noto Serif SC", Georgia, serif';
    context.textBaseline = 'top';
    const step = Math.round(bodySize * 1.5);
    for (const line of fitted.bodyLines) {
      if (cursor + step > zone.top + zone.height) break;
      context.fillText(line, zone.left, cursor);
      cursor += step;
      used += 1;
    }
    context.globalAlpha = 1;
  }
  return used;
}

export async function renderLayoutSheet(plan, urls = [], { createCanvas = () => document.createElement('canvas'), copy = {} } = {}) {
  if (!plan || !Array.isArray(plan.cells) || !plan.cells.length) throw new Error('这一篇还拼不了版式');
  const list = (Array.isArray(urls) ? urls : []).slice(0, plan.cells.length);
  if (!list.length) throw new Error('这一篇还没有可拼的图');
  const images = await Promise.all(list.map(loadImage));
  const canvas = createCanvas();
  canvas.width = plan.width;
  canvas.height = plan.height;
  const context = canvas.getContext('2d');
  /* 底色：宫格/信息图是白纸；底片条整张是深色片基；宝丽来是暖纸面（见 plan.paper） */
  context.fillStyle = plan.family === '底片条' ? LAYOUT_INK.filmBase : (plan.paper || LAYOUT_INK.paper);
  context.fillRect(0, 0, plan.width, plan.height);
  if (plan.family === '底片条') {
    /* 齿孔：上下各一条圆角白格（实测 n24-4 / n28-7 的胶片齿孔就是这么排的） */
    const holeWidth = 34;
    const holeHeight = plan.holeBar - 12;
    const step = holeWidth * 2;
    for (let x = plan.frame + 6; x + holeWidth <= plan.width - plan.frame - 6; x += step) {
      context.fillStyle = LAYOUT_INK.filmHole;
      roundRect(context, x, plan.frame + 6, holeWidth, holeHeight, 5);
      context.fill();
      roundRect(context, x, plan.height - plan.frame - 6 - holeHeight, holeWidth, holeHeight, 5);
      context.fill();
    }
  }
  if (plan.family === '宝丽来画中画') {
    /* 纸面纹理：极淡的一层横线（实测是纸/布的质感，不是纯色）——不做渐变，保持确定性 */
    context.fillStyle = 'rgba(0,0,0,.028)';
    for (let y = 0; y < plan.height; y += 6) context.fillRect(0, y, plan.width, 1);
  }
  images.forEach((image, index) => {
    const cell = plan.cells[index];
    if (!cell) return;
    if (plan.family === '宝丽来画中画') {
      /* 旋转的相纸：先把它画在**自己的坐标系**里（含投影与白框），再整体旋一点角度 */
      const centerX = cell.left + cell.width / 2;
      const centerY = cell.top + cell.height / 2;
      context.save();
      context.translate(centerX, centerY);
      context.rotate(((Number(cell.rotate) || 0) * Math.PI) / 180);
      context.translate(-cell.width / 2, -cell.height / 2);
      context.shadowColor = 'rgba(24,20,14,.22)';
      context.shadowBlur = 26;
      context.shadowOffsetY = 12;
      context.fillStyle = LAYOUT_INK.card;
      context.fillRect(0, 0, cell.width, cell.height);
      context.shadowColor = 'transparent';
      context.shadowBlur = 0;
      context.shadowOffsetY = 0;
      drawCover(context, image, cell.photo);
      /* 相纸下方那一条宽边：实测宝丽来框上是**手写/印刷的短句**；我们不编内容 ——
         只有用户自己写了文案才排，默认留白（那就是一张干净的宝丽来）。 */
      const caption = String(copy.headline || '').trim();
      if (caption) {
        context.fillStyle = LAYOUT_INK.inkSoft;
        context.font = '400 30px "Songti SC", "Noto Serif SC", Georgia, serif';
        context.textBaseline = 'middle';
        const lines = wrapTextLines(context, caption, cell.width - cell.card.pad * 2).slice(0, 2);
        lines.forEach((line, lineIndex) => {
          const y = cell.height - cell.card.band / 2 + (lineIndex - (lines.length - 1) / 2) * 40;
          context.fillText(line, cell.card.pad, y);
        });
      }
      context.restore();
      return;
    }
    if (plan.family === '品牌信息图') {
      const zones = cell.zones || infoCardZones(LAYOUT_INFO_DEFAULT_TEMPLATE, cell);
      /* 卡面底：白纸（实测那些版式页都是干净的白/纸色底） */
      context.fillStyle = LAYOUT_INK.paper;
      context.fillRect(cell.left, cell.top, cell.width, cell.height);
      const shifted = rect => ({ ...rect, left: rect.left + cell.left, top: rect.top + cell.top });
      if (zones.panel) {
        context.fillStyle = LAYOUT_INK.infoPanel;
        context.fillRect(cell.left, cell.top, cell.width, cell.height);
      }
      /* 图区：三个模板**都用 cover** —— 图窗是固定比例的窗口（见 infoCardZones），
         窗内就会填满、四张图等高。
         ⚠️ 踩过一脚：窗口改成固定比例之后，这里**忘了把 contain 换掉**，结果窗变高了、图还是
            fit 进去的 ⇒ 四张图高度仍差 2.38 倍、照片只占卡面积 15%（真机复核原话：
            "#4 与上一轮像素级几乎相同"）。判据靠不住的时候，只有看图才知道。 */
      drawCover(context, image, shifted(zones.image));
      if (zones.band) {
        context.fillStyle = 'rgba(20,18,24,.82)';
        context.fillRect(shifted(zones.band).left, shifted(zones.band).top, zones.band.width, zones.band.height);
      }
      if (zones.rule) {
        context.fillStyle = 'rgba(27,27,31,.32)';
        context.fillRect(shifted(zones.rule).left, shifted(zones.rule).top, zones.rule.width, zones.rule.height);
      }
      const onBand = Boolean(zones.band);
      /* ⚠️ center: true —— 文字块在区域里**垂直居中**。第一版是顶对齐，真机导出来右边/下面
         空一大块（复核原话："下方约 700px 全空"、"底部 398px 是纯空白，像半成品"）。 */
      drawCopyBlock(context, shifted(zones.text), copy, {
        headlineSize: zones.template === '大字色块' ? 104 : (zones.template === '词典卡' ? 92 : 84),
        bodySize: 34,
        color: onBand ? LAYOUT_INK.onBand : LAYOUT_INK.ink,
        headlineColor: onBand ? LAYOUT_INK.onBandStrong : LAYOUT_INK.inkStrong,
        center: true,
        rule: zones.rule === true,
      });
      return;
    }
    drawCover(context, image, cell);
  });
  if (plan.family === '底片条') {
    /* 边框码：实测底片条边框上有「125 PX / #01 / 43」这类小字 —— 我们只写序号，
       **不写任何品牌名或账号署名**（署名是用户自己的事，我们不许往上加东西）。
       ⚠️ 位置改过两次（都是真机复核抓的）：第一版把码画在**齿孔那一行**上，结果"第 1 格的 01
          被孔完全盖住，只看到一片灰糊"（而且格宽不是孔距的整数倍，相位还逐格错开）；
          第二版移到下边框带里，但框只有 26px ⇒ "码距画布下边缘只有 6px……字高折算约 3px，
          仍然基本看不见"。现在外框加宽到 46、码排在下边框的中线上、字号 26、内缩 18。 */
    context.fillStyle = 'rgba(255,255,255,.92)';
    context.font = '700 26px ui-monospace, SFMono-Regular, Menlo, monospace';
    context.textBaseline = 'middle';
    const codeY = plan.height - Math.round(plan.frame / 2);
    plan.cells.forEach((cell, index) => {
      context.fillText('#' + String(index + 1).padStart(2, '0'), cell.left + 18, codeY);
    });
  }
  return canvas;
}

/* 导出成品图：统一用 JPEG（摄影内容；同一份 blob 既给下载也给上传留档，
   上传走 /api/ecommerce/assets 时要求 ≤15MB，PNG 拼版很容易超）。 */
export async function layoutSheetBlob(plan, urls, { type = 'image/jpeg', quality = 0.92, copy = {} } = {}) {
  const canvas = await renderLayoutSheet(plan, urls, { copy });
  const blob = await new Promise(resolve => canvas.toBlob(resolve, type, quality));
  if (!blob) throw new Error('拼版导出失败，请重试');
  return blob;
}

/* 成品图的名字：让用户下到本地认得出来是哪一篇（与下载第一张同一口径） */
export function layoutSheetFileName({ title = '概念视觉方案', family = '宫格', count = 0 } = {}) {
  const safe = String(title || '概念视觉方案').replace(/[\\/:*?"<>|]/g, '').slice(0, 40) || '概念视觉方案';
  return safe + '-' + String(family || '宫格') + '-' + Math.max(0, Number(count) || 0) + '张.jpg';
}
