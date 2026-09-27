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
import { CONCEPT_LAYOUT_FAMILIES } from '../../skills/imageSkills.js';
import { pieceLayoutFamilyHolds } from '../../skills/skillRun.js';

/* 单格 = 本账号签名 3:4（与工作台「比例」默认档 3:4 同源） */
export const LAYOUT_CELL = Object.freeze({ width: 1080, height: 1350 });
/* 宫格之间留一条白缝（实测那种"杂志内页"的格子不是贴死的） */
const GRID_GAP = 18;
/* 底片条：外框、齿孔条高度、格与格之间的缝 */
const STRIP_FRAME = 26;
const STRIP_HOLE_BAR = 30;
const STRIP_GAP = 16;

/** 这一条技能现在能拼的两族（判据来自声明源，不在这里另写一份名单）。 */
export function layoutFamilies() {
  return CONCEPT_LAYOUT_FAMILIES().map(item => item.value);
}

export function isLayoutFamily(family) {
  return layoutFamilies().includes(String(family || '').trim());
}

/* ── ① 版式计划（纯函数）：给出张数与族，返回成图尺寸 + 每一张的目标矩形 ──────────────
   返回 null = **这一篇现在拼不了**（0 张 / 1 张 / 没选族 / 认不出的族）——
   调用方据此不渲染按钮、也不产出空图。 */
export function layoutSheetPlan({ family = '', count = 0, cell = LAYOUT_CELL } = {}) {
  const total = Math.max(0, Number.parseInt(count, 10) || 0);
  const name = String(family || '').trim();
  /* ⚠️ 「同族至少复用 2 张」是实测出来的硬规则（篇内同版式族反复用 74/402 张 = 18.4%，
     落在 21 篇；"成套感"来自版式反复而不是张张不同）——
     一张的篇谈不上复用，所以这里直接拒绝（判据在 skillRun.pieceLayoutFamilyHolds，只有一份）。 */
  if (!pieceLayoutFamilyHolds(name, total)) return null;
  if (!isLayoutFamily(name)) return null;
  return name === '底片条' ? stripPlan(total, cell) : gridPlan(total, cell);
}

/* 宫格：**列数随张数变化**（ceil(√n)）：2→2 列、3~4→2 列、5~9→3 列…… */
export function gridColumns(count) {
  const total = Math.max(1, Number.parseInt(count, 10) || 1);
  return Math.ceil(Math.sqrt(total));
}

function gridPlan(count, cell) {
  const columns = gridColumns(count);
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

export async function renderLayoutSheet(plan, urls = [], { createCanvas = () => document.createElement('canvas') } = {}) {
  if (!plan || !Array.isArray(plan.cells) || !plan.cells.length) throw new Error('这一篇还拼不了版式');
  const list = (Array.isArray(urls) ? urls : []).slice(0, plan.cells.length);
  if (!list.length) throw new Error('这一篇还没有可拼的图');
  const images = await Promise.all(list.map(loadImage));
  const canvas = createCanvas();
  canvas.width = plan.width;
  canvas.height = plan.height;
  const context = canvas.getContext('2d');
  /* 底色：宫格留白缝是白的；底片条整张是深色片基 */
  context.fillStyle = plan.family === '底片条' ? '#141414' : '#ffffff';
  context.fillRect(0, 0, plan.width, plan.height);
  if (plan.family === '底片条') {
    /* 齿孔：上下各一条圆角白格（实测 n24-4 / n28-7 的胶片齿孔就是这么排的） */
    const holeWidth = 34;
    const holeHeight = plan.holeBar - 12;
    const step = holeWidth * 2;
    for (let x = plan.frame + 6; x + holeWidth <= plan.width - plan.frame - 6; x += step) {
      context.fillStyle = '#f2f2f2';
      roundRect(context, x, plan.frame + 6, holeWidth, holeHeight, 5);
      context.fill();
      roundRect(context, x, plan.height - plan.frame - 6 - holeHeight, holeWidth, holeHeight, 5);
      context.fill();
    }
  }
  images.forEach((image, index) => {
    const cell = plan.cells[index];
    if (!cell) return;
    const source = coverSourceRect(image.naturalWidth || image.width, image.naturalHeight || image.height, cell.width, cell.height);
    if (!source) return;
    context.drawImage(
      image,
      source.left, source.top, source.width, source.height,
      cell.left, cell.top, cell.width, cell.height,
    );
  });
  if (plan.family === '底片条') {
    /* 边框码：实测底片条边框上有「125 PX / #01 / 43」这类小字 —— 我们只写序号，
       **不写任何品牌名或账号署名**（署名是用户自己的事，我们不许往上加东西）。 */
    context.fillStyle = 'rgba(255,255,255,.72)';
    context.font = '600 22px ui-monospace, SFMono-Regular, Menlo, monospace';
    context.textBaseline = 'middle';
    plan.cells.forEach((cell, index) => {
      context.fillText('#' + String(index + 1).padStart(2, '0'), cell.left + 4, plan.height - plan.frame - plan.holeBar / 2);
    });
  }
  return canvas;
}

/* 导出成品图：统一用 JPEG（摄影内容；同一份 blob 既给下载也给上传留档，
   上传走 /api/ecommerce/assets 时要求 ≤15MB，PNG 拼版很容易超）。 */
export async function layoutSheetBlob(plan, urls, { type = 'image/jpeg', quality = 0.92 } = {}) {
  const canvas = await renderLayoutSheet(plan, urls);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, type, quality));
  if (!blob) throw new Error('拼版导出失败，请重试');
  return blob;
}

/* 成品图的名字：让用户下到本地认得出来是哪一篇（与下载第一张同一口径） */
export function layoutSheetFileName({ title = '概念视觉方案', family = '宫格', count = 0 } = {}) {
  const safe = String(title || '概念视觉方案').replace(/[\\/:*?"<>|]/g, '').slice(0, 40) || '概念视觉方案';
  return safe + '-' + String(family || '宫格') + '-' + Math.max(0, Number(count) || 0) + '张.jpg';
}
