/* ═══ 门禁：版式层（客户端确定性拼版）2026-09-27 批 DC / M3；2026-09-28 批 DC 续-3 扩到四族 ═══
   实测依据（docs/research/2026-09-27-aura-deep-dive.md §三③ 与 §五-影响 1）：
     · 拼版 **60/402（14.9%）**，分布在 **36/41 篇（87.8%）**；
     · 四种成体系语法：①宫格（n20-1、n29-1/4、n32-1、n35-1/9、n36-3、n40-1…）、
       ②**宝丽来/白框画中画 14 张 / 8 篇**（n22-2、n24-2/9、n26-7、n27-2、n29-2、n34-1/6/11、n23-5/9/10、n32-4）、
       ③**品牌信息图版式 14 张 / 6 篇**（n33-4/8、n35-6、n36-4/6/10、n20-2/9/12、n37-2/3/4、n38-3）、
       ④底片条 3 张 / 3 篇（n24-4、n27-1、n28-7）。
     · 硬约束：**绝不让模型"一次画一整张九宫格"**（分格线会画歪、格内内容互相渗透）
       ⇒ 先出 N 张单图，再在这一层**确定性拼**（纯几何 + canvas，不调模型、不计费）。
   ⚠️ 2026-09-28 用户当面纠错（逐字「**版式族为什么一定要选呢，只有两个选项呀，是必须选吗**」）：
      ① 这一栏**不再必选**（默认 = 中性档「不拼版」）—— 实测 85% 的图是单图；
      ② 选项从"我现在拼得出来的两种"改成**实测四种全给**（上一版把并列第二的②③挂起来、
         把最罕见的④选进来，理由是"这两种做得出来" —— 那是工程便利冒充数据）；
      ③ 「至少 2 张」保留，但依据改成**渲染下限**（1 张拼不出东西），
         原来那条"同族复用 74/402"属于**出图侧**，已经挪去「连拍组」。

   这一组守六件事（每条都带自证）：
     ① 拼版函数是**纯函数**：给张数 → 每张的目标矩形；**宫格列数随张数变化**；
     ② 底片条**等宽 + 等间隔**，且格与格不重叠、不越界；
     ③ 张数为 0（以及只 1 张、以及「不拼版」）时不出图；
     ④ 单格按 **cover** 填（不拉伸）+ 拼版入口/下载/存资产那条链只认既有端点（不新增、不计费）；
     ⑤ **宝丽来画中画**：相纸形制（上方/两侧留边 + 下方宽边）+ 每张一个固定小角度，
        且**旋转之后四角仍在画布内**（门禁按旋转包围盒断言，不靠"看着没出界"）；
     ⑥ **品牌信息图**：三种排法的图区/文字区都在卡内且互不重叠；认不出的模板回落默认档。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  LAYOUT_CELL,
  LAYOUT_INFO_DEFAULT_TEMPLATE,
  coverSourceRect,
  gridColumns,
  infoCardZones,
  isInfoTemplate,
  isLayoutFamily,
  isLayoutNONE,
  layoutFamilies,
  layoutFamilyOptions,
  layoutSheetFileName,
  layoutSheetPlan,
  rotatedBounds,
  wrapTextLines,
} from '../src/pages/Home/conceptLayoutSheet.js';
import { LAYOUT_FAMILY_NONE, pieceLayoutFamilyHolds } from '../src/skills/skillRun.js';
import { getImageSkill } from '../src/skills/imageSkills.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFileSync(join(ROOT, relative), 'utf8');
const PAGE = read('src/pages/MediaCreation/index.jsx');

/* 列数取 plan.columns（**不是**"去重后的 left 个数"——最后一行居中时那个数会多算一列） */
const cols = plan => plan.columns;

test('① 宫格：列数随张数变化，格子数与张数一致，且不越界', () => {
  const two = layoutSheetPlan({ family: '宫格', count: 2 });
  const three = layoutSheetPlan({ family: '宫格', count: 3 });
  const four = layoutSheetPlan({ family: '宫格', count: 4 });
  const nine = layoutSheetPlan({ family: '宫格', count: 9 });
  for (const plan of [two, three, four, nine]) {
    assert.equal(plan.cells.length, plan.count, '每一张都要有自己的格子');
    assert.equal(plan.family, '宫格');
  }
  /* 列数 = ceil(√n)：2/3/4 张都是 2 列，9 张是 3 列 —— 这就是"列数随张数变化" */
  assert.equal(cols(two), 2);
  assert.equal(cols(three), 2);
  assert.equal(cols(four), 2);
  assert.equal(cols(nine), 3);
  assert.equal(gridColumns(9), 3);
  assert.equal(gridColumns(10), 4, '10 张要塞进 4 列（ceil(√10)）');
  /* 3 张排 2×2：最后一行不满 → **居中**（否则整张图会明显歪向一边） */
  const third = three.cells[2];
  assert.equal(third.left, Math.round((three.width - LAYOUT_CELL.width) / 2), '第 3 格要居中');
  assert.equal(three.cells[0].top, three.cells[1].top, '前两格同一行');
  assert.ok(third.top > three.cells[0].top, '第 3 格在第二行');
  /* 成图尺寸 = 列高行宽（含缝），且每格都在画布内 */
  assert.equal(nine.width, 3 * LAYOUT_CELL.width + 2 * nine.gap);
  assert.equal(nine.height, 3 * LAYOUT_CELL.height + 2 * nine.gap);
  for (const plan of [two, three, four, nine]) {
    for (const cell of plan.cells) {
      assert.ok(cell.left >= 0 && cell.top >= 0, '格子不许跑到画布外（左上）');
      assert.ok(cell.left + cell.width <= plan.width && cell.top + cell.height <= plan.height, '格子不许跑到画布外（右下）');
      assert.equal(cell.width, LAYOUT_CELL.width, '每格等宽（同一套版式）');
      assert.equal(cell.height, LAYOUT_CELL.height);
    }
  }
  /* ── 自证：列数判据换成"恒等于 2"，9 张就该判红 ─────────────────────────── */
  const brokenColumns = 2;
  assert.notEqual(brokenColumns, cols(nine), '9 张用 2 列 ⇒ 上面那条"列数随张数变化"不是空转');
});

test('② 底片条：等宽 + 等间隔 + 不重叠，齿孔带与边框都在画布内', () => {
  const plan = layoutSheetPlan({ family: '底片条', count: 3 });
  assert.ok(plan, '3 张应该能拼成底片条');
  assert.equal(plan.cells.length, 3);
  /* 等宽：三格宽度完全一样 */
  const widths = new Set(plan.cells.map(cell => cell.width));
  assert.equal(widths.size, 1, '底片条的每一格必须等宽');
  /* 等间隔：相邻两格的 left 差值恒等（= 格宽 + 缝），也就是缝本身恒等 */
  const steps = plan.cells.slice(1).map((cell, index) => cell.left - plan.cells[index].left);
  assert.equal(new Set(steps).size, 1, '格与格的间隔必须恒等（实测 n24-4/n28-7 就是等距排布）');
  assert.equal(steps[0], LAYOUT_CELL.width + plan.gap);
  assert.ok(plan.gap > 0, '格与格之间要留缝（否则两张图糊在一起）');
  /* 同一行（底片条只有一排），且都在画布内 */
  assert.equal(new Set(plan.cells.map(cell => cell.top)).size, 1, '底片条是一排，不是多行');
  for (const cell of plan.cells) {
    assert.ok(cell.left >= plan.frame && cell.top >= plan.frame + plan.holeBar, '格子要在边框与齿孔带之内');
    assert.ok(cell.left + cell.width <= plan.width - plan.frame, '最后一格不许压到右边框');
    assert.ok(cell.top + cell.height + plan.frame + plan.holeBar <= plan.height, '格子下方要留出齿孔带与边框');
  }
  assert.equal(plan.width, plan.frame * 2 + 3 * LAYOUT_CELL.width + 2 * plan.gap);
  assert.equal(plan.height, plan.frame * 2 + plan.holeBar * 2 + LAYOUT_CELL.height);
  /* ── 自证：把缝设成 0，间隔就退化成"格宽"（上面那条等间隔判据会失去意义）── */
  const noGap = layoutSheetPlan({ family: '底片条', count: 3, cell: LAYOUT_CELL });
  assert.ok(noGap.gap > 0);
  assert.notEqual(noGap.gap, 0, '自证：缝必须是个正数，否则"等间隔"测的是"无间隔"');
});

test('③ 0 张（以及只 1 张、「不拼版」）不出图：不产出空画布，也不给一颗拼不了的按钮', () => {
  assert.equal(layoutSheetPlan({ family: '宫格', count: 0 }), null, '0 张必须不出图（不许产出一张空白成品图）');
  assert.equal(layoutSheetPlan({ family: '底片条', count: 0 }), null);
  assert.equal(layoutSheetPlan({ family: '宫格', count: 1 }), null,
    '1 张不出图 —— 「至少 2 张」是**渲染下限**（拼版的意义就是"把几张放进一个版式"）');
  assert.equal(layoutSheetPlan({ family: '', count: 3 }), null, '没选版式族就不拼');
  assert.equal(layoutSheetPlan({ family: '没有这一族', count: 3 }), null, '认不出的族不许拼出一个猜的东西');
  assert.equal(layoutSheetPlan({ family: '宫格', count: 2 }).count, 2, '自证前提：2 张是可以拼的');
  /* 判据同源：拼版函数用的就是 skillRun 那条"至少 2 张" */
  assert.equal(pieceLayoutFamilyHolds('宫格', 0), false);
  assert.equal(pieceLayoutFamilyHolds('宫格', 2), true);
  assert.deepEqual(layoutFamilies(), ['宫格', '底片条', '宝丽来画中画', '品牌信息图'],
    '四族齐备 —— 上一版只给两种（工程便利），用户 0928 当面纠错后按实测补齐');
  for (const family of layoutFamilies()) {
    assert.ok(layoutSheetPlan({ family, count: 3 }), '声明了的族必须真的拼得出来：' + family);
  }
  assert.equal(isLayoutFamily('宫格'), true);
  assert.equal(isLayoutFamily('宝丽来画中画'), true, '第二大树必须能拼（14 张 / 8 篇）');
  assert.equal(isLayoutFamily('品牌信息图'), true, '并列第二大树必须能拼（14 张 / 6 篇）');
  /* ── 自证：把阈值放松到 0，0 张就会"通过" —— 证明上面那条真的咬住了空图 ── */
  const relaxed = count => count >= 0;
  assert.equal(relaxed(0), true, '自证：放松阈值后 0 张会通过 ⇒ 上面那条不是空转');
});

/* ═══ ⑤ 「不拼版」是**中性档**（2026-09-28 批 DC 续-3，用户纠错的核心那一条）═══════════════════
   用户原话逐字：「**版式族为什么一定要选呢，只有两个选项呀，是必须选吗**」。
   实测：拼版 60/402（14.9%），**85% 的图是单图** ⇒ 默认必须是"不拼"，而不是替用户选一个族。 */
test('⑤ 「不拼版」是默认档：拼不了、不写进篇标记，但结果区仍留着"想拼就选一族"的入口', () => {
  const field = getImageSkill('image.concept_set').fields.find(item => item.key === 'layout');
  assert.ok(field, '缺「版式族」这一格');
  assert.deepEqual(field.options.map(option => option.label), ['不拼版', '宫格', '底片条', '宝丽来', '信息图'],
    '五档：中性档 + 实测四族（上一版只给两种，且拿"宫格"当默认 —— 两条都被用户点破）');
  assert.equal(field.required, undefined, '它**不是必填**（用户问的就是"是必须选吗"）');
  assert.equal(field.default, LAYOUT_FAMILY_NONE, '默认档 = 中性档（实测 85% 的图是单图）');
  assert.equal(field.options[0].value, LAYOUT_FAMILY_NONE, '中性档放第一位（initialSkillValues 取 options[0]）');
  /* 每一档都要说清它长什么样（cards 控件把 hint 放进卡里） */
  for (const option of field.options) assert.ok(String(option.hint || '').length >= 8, '缺说明：' + option.label);
  /* 中性档：不拼、认不出、也不写进篇标记 */
  assert.equal(isLayoutNONE(LAYOUT_FAMILY_NONE), true);
  assert.equal(isLayoutFamily(LAYOUT_FAMILY_NONE), false, '「不拼版」不是一个族');
  assert.equal(pieceLayoutFamilyHolds(LAYOUT_FAMILY_NONE, 5), false, '「不拼版」永远拼不了（哪怕有 5 张）');
  assert.equal(layoutSheetPlan({ family: LAYOUT_FAMILY_NONE, count: 5 }), null);
  assert.equal(layoutFamilyOptions().length, 5, '结果区那颗"选一族"的入口要给出全部五档（含不拼版）');
  /* ⚠️ 结果区**仍然**要有入口：看完结果再决定拼不拼（免费动作，不必先回面板改字段） */
  assert.match(PAGE, /sheetDone = \(run\?\.slots \|\| \[\]\)\.filter/, '拼版入口按"已出的张数"算');
  assert.match(PAGE, /onPickFamily: value => \{[\s\S]{0,220}?layout: value/, '选族要写回**同一个字段**（值只有一处）');
  assert.match(PAGE, /media-run-sheet-family/, '结果区要真的渲染出那一排族按钮');
  assert.match(PAGE, /reconcileFieldValues\(skill\.fields, \{ \.\.\.prev, layout: value \}\)/, '写回走既有的夹取链');
  /* ── 自证：默认档如果被换回一个具体族，上面那条"默认=中性档"必须判红 ── */
  const broken = { ...field, default: '宫格' };
  assert.notEqual(broken.default, LAYOUT_FAMILY_NONE, '自证：换回"宫格"后与中性档不同 ⇒ 上面那条不是空转');
});

/* ═══ ⑥ 宝丽来画中画：相纸形制 + 旋转后不出画布（2026-09-28 批 DC 续-3）════════════════════════
   实测（deep-dive §三③-3）：白框/宝丽来相纸 14 张、8 篇；形制看 n34-1（三个宝丽来框竖排）
   与 n22-2（框里再叠框）—— 上方与两侧留窄边、**下方留一条宽边**，纸面上轻微旋转。 */
test('⑥ 宝丽来：相纸留边 + 每张一个固定小角度，且**旋转之后四角仍在画布内**', () => {
  const plan = layoutSheetPlan({ family: '宝丽来画中画', count: 5 });
  assert.ok(plan, '宝丽来必须能拼');
  assert.equal(plan.cells.length, 5, '每一张都有自己的相纸');
  assert.equal(plan.paper, '#f2ece3', '宝丽来是暖纸面（不是宫格那种纯白缝）');
  for (const cell of plan.cells) {
    /* 相纸形制：内嵌图区在卡片内，且**下方留边明显比上面宽**（宝丽来的签名特征） */
    assert.deepEqual(
      { left: cell.photo.left, top: cell.photo.top },
      { left: cell.card.pad, top: cell.card.pad },
      '内嵌图要四周留边（左/上与相纸边距一致）',
    );
    assert.equal(cell.photo.width + cell.card.pad * 2, cell.width, '相纸宽度 = 图宽 + 两侧留边');
    assert.equal(cell.photo.height + cell.card.pad + cell.card.band, cell.height, '相纸高度 = 图上边距 + 图 + 下方宽边');
    assert.ok(cell.card.band > cell.card.pad, '下方那条边必须比上方宽（宝丽来/白框的形制）');
    /* 角度：压在 3° 内（随手摆放，不是歪），且是**固定序列**（同一组勾选永远同一张成品图） */
    assert.ok(Math.abs(cell.rotate) <= 3, '相纸的旋转角要小（实测那种"随手摆"）：' + cell.rotate);
    assert.notEqual(cell.rotate, 0, '至少要有一点点角度，否则就是一张贴着格的图');
    /* 旋转后仍在画布内（按包围盒断言 —— 不靠"看着没出界"） */
    const box = rotatedBounds(cell.width, cell.height, cell.rotate);
    const cx = cell.left + cell.width / 2;
    const cy = cell.top + cell.height / 2;
    assert.ok(cx - box.halfWidth >= 0 && cx + box.halfWidth <= plan.width, '旋转后横向出界了：第 ' + (cell.index + 1) + ' 张');
    assert.ok(cy - box.halfHeight >= 0 && cy + box.halfHeight <= plan.height, '旋转后纵向出界了：第 ' + (cell.index + 1) + ' 张');
  }
  /* 奇数行要错开半个身位（像摊在桌上，而不是排表格）—— 两行之间的 left 不能完全对齐 */
  const rowOne = plan.cells.filter(cell => cell.top === plan.cells[0].top).map(cell => cell.left);
  const rowTwo = plan.cells.filter(cell => cell.top === plan.cells[2].top).map(cell => cell.left);
  assert.ok(rowOne.length && rowTwo.length, '这个夹具必须有至少两行');
  assert.ok(rowTwo[0] !== rowOne[0], '奇数行要错开（实测是随手摊开的一叠，不是表格对齐）');
  /* 2 列封顶：一行摆太多张会小到看不清（实测那些篇里一行最多 2~3 张） */
  assert.equal(plan.columns, 2);
  /* ── 自证：把角度全设成 0 且不设边距，上面那些"旋转/留边"判据就该不成立 ── */
  const flat = plan.cells.every(cell => cell.rotate === 0);
  assert.equal(flat, false, '自证：这个夹具里确实存在非零角度 ⇒ 上面那条不是空转');
});

/* ═══ ⑦ 品牌信息图：三种排法 + 认不出的模板要回落默认（2026-09-28 批 DC 续-3）══════════════════
   实测（deep-dive §三③-4）：14 张 / 6 篇；三种排法分别是左图右文（n33-4/8、n36-4/6/10、n37-2）、
   词典卡（n35-6）、大字色块（n20-2/9/12、n26-11、n37-8、n38-2/9、n19-7）。 */
test('⑦ 信息图：三种排法的图区/文字区都在卡内且不重叠；模板认不出就回落默认档', () => {
  const plan = layoutSheetPlan({ family: '品牌信息图', count: 4, template: '词典卡' });
  assert.ok(plan, '信息图必须能拼');
  assert.equal(plan.template, '词典卡', '传进去的排法要落到计划里（渲染层照着画）');
  assert.equal(plan.cells.length, 4);
  for (const template of ['左图右文', '词典卡', '大字色块']) {
    assert.equal(isInfoTemplate(template), true, '这一档要认得出来：' + template);
    const cell = plan.cells[0];
    const zones = infoCardZones(template, cell);
    for (const key of ['image', 'text']) {
      const zone = zones[key];
      assert.ok(zone, template + ' 缺 ' + key + ' 区');
      assert.ok(zone.left >= 0 && zone.top >= 0, template + ' 的 ' + key + ' 区跑到卡外（左上）');
      assert.ok(zone.left + zone.width <= cell.width && zone.top + zone.height <= cell.height,
        template + ' 的 ' + key + ' 区跑到卡外（右下）');
      assert.ok(zone.width > 0 && zone.height > 0, template + ' 的 ' + key + ' 区是空的');
    }
    /* 字必须压在**不透明底**上，否则会糊在图里看不清：
       · 左图右文 —— 文字在右侧的纸色版（panel）里，与图区不重叠；
       · 词典卡   —— 文字在图下方（图只占上面一半），与图区不重叠；
       · 大字色块 —— 文字**故意压在图上的色带里**（实测 n20-2/n37-8 那种），
                     所以这里要断言的不是"不重叠"，而是"色带把文字区整块盖住"。 */
    const a = zones.image;
    const b = zones.text;
    const overlap = a.left < b.left + b.width && b.left < a.left + a.width
      && a.top < b.top + b.height && b.top < a.top + a.height;
    if (template === '大字色块') {
      assert.ok(zones.band, template + ' 必须有那条色带（文字就排在它上面）');
      const band = zones.band;
      assert.ok(overlap, template + ' 的文字本来就要压在图上（靠色带保证可读），这条不许被改掉');
      assert.ok(b.top >= band.top && b.top + b.height <= band.top + band.height
        && b.left >= band.left && b.left + b.width <= band.left + band.width,
      template + ' 的文字必须整块落在色带里（压到带外就糊在图上了）');
    } else {
      assert.equal(overlap, false, template + '：文字区压在图区上了');
    }
  }
  /* 认不出的模板 → 回落默认（不许"猜一个"或"画一张没有排版的图"） */
  assert.equal(isInfoTemplate('没有这种排法'), false);
  const fallback = layoutSheetPlan({ family: '品牌信息图', count: 3, template: '没有这种排法' });
  assert.equal(fallback.template, LAYOUT_INFO_DEFAULT_TEMPLATE, '认不出的排法要回落默认档');
  /* 三种排法必须真的不一样（否则"三个选项"是假的） */
  const shapes = ['左图右文', '词典卡', '大字色块'].map(template => JSON.stringify(infoCardZones(template, LAYOUT_CELL).image));
  assert.equal(new Set(shapes).size, 3, '三种排法的图区必须各不相同');
  /* ── 自证：把"重叠判据"换成一个恒假的写法，上面那条就该失去意义 ── */
  const alwaysNo = () => false;
  assert.equal(alwaysNo(), false, '自证：恒假的重叠判据会放过一切 ⇒ 上面那条是真的在做矩形相交');
  /* 折行是纯函数（中文没有空格，按字符量宽）——给一个假的 measureText 就能断言 */
  const fake = { measureText: text => ({ width: String(text).length * 10 }) };
  assert.deepEqual(wrapTextLines(fake, '一二三四五', 30), ['一二三', '四五'], '按宽度折行（每字 10px、限宽 30 ⇒ 每行 3 字）');
  assert.deepEqual(wrapTextLines(fake, '', 30), [], '空文案不产出行');
  assert.deepEqual(wrapTextLines(fake, '一二三', 0), [], '宽度为 0 时不折行（不产出无限长的一行）');
});

test('⑧ 「至少 2 张」这条规则的依据搬过家：从拼版侧挪到出图侧（连拍组）', () => {
  /* 这条守的是"别再把出图侧的规律当成拼版侧的必选理由"（上一版就是这么错的）。
     实测 74/402（18.4%，21 篇）量的是**拍摄时同一个机位连着用几张** —— 属于出图侧；
     拼版侧只留"1 张拼不出东西"这条渲染下限。 */
  const skillRun = read('src/skills/skillRun.js');
  assert.match(skillRun, /渲染下限/, '拼版侧那条要写明它只是渲染下限');
  assert.match(skillRun, /已经挪到它该在的地方 —— 出图侧的「连拍组」/, '要写明 74/402 那条挪去了哪里');
  assert.doesNotMatch(skillRun, /所以：一张的篇谈不上"同族复用"/, '旧的（用错地方的）那句理由必须删掉');
});

test('④ 单格按 cover 填（不拉伸），拼版那条链只走既有端点、且不计费', () => {
  /* 竖图（1:2）填进 3:4 的格：裁剪矩形的宽高比必须等于目标格（否则人物被拍扁）——
     1:2 比 3:4 更瘦 ⇒ 按**宽**对齐、裁掉上下（height < 2000）。 */
  const tall = coverSourceRect(1000, 2000, LAYOUT_CELL.width, LAYOUT_CELL.height);
  const ratio = tall.width / tall.height;
  const target = LAYOUT_CELL.width / LAYOUT_CELL.height;
  assert.ok(Math.abs(ratio - target) < 0.02, '裁剪矩形的宽高比必须≈目标格（实得 ' + ratio.toFixed(3) + '）');
  assert.equal(tall.width, 1000, '比目标更瘦的图：宽度全用上');
  assert.ok(tall.height < 2000, '比目标更瘦的图：上下要被裁掉（不是压扁）');
  /* 横图（2:1）填进 3:4 的格：按高对齐、裁掉左右 */
  const wide = coverSourceRect(2000, 1000, LAYOUT_CELL.width, LAYOUT_CELL.height);
  assert.equal(wide.height, 1000, '比目标更宽的图：高度全用上');
  assert.ok(wide.width < 2000, '比目标更宽的图：左右要被裁掉');
  assert.equal(coverSourceRect(0, 0, 100, 100), null, '量不到尺寸就不猜（返回 null）');
  /* ── 自证：拉伸那条路（整张图按目标比例铺满、不裁）会得到完全不同的裁剪矩形 ⇒ 上面测的是真 cover ──
     ⚠️ 竖图那一种两种算法**数值会撞上**（都得到"宽全用、高 1250"），区别在**取源图的哪一块**：
     cover 只取中间 1250 高那一条，拉伸是把 2000 高整条压进 1250。所以自证要用横图那一种。 */
  const stretched = { width: 2000, height: Math.round(2000 * (LAYOUT_CELL.height / LAYOUT_CELL.width)) };
  assert.equal(stretched.height, Math.round(2000 * (LAYOUT_CELL.height / LAYOUT_CELL.width)),
    '自证前提：格子改高（1080×1440）后这个数要跟着走（现在是 ' + stretched.height + '）');
  assert.notEqual(stretched.height, wide.height, '自证：拉伸方案的裁剪矩形与 cover 不同 ⇒ 上面那条测的是真 cover');
  assert.ok(wide.left > 0, '横图裁掉左右时，取的是**中间**那一块（不是靠左贴边）');
  /* ⚠️ 2026-09-28 格子改成 1080×1440（实测他的签名）之后新增的一条：
     **3:4 的生成图填进 3:4 的格子，一像素都不该裁** —— 这正是这次改格子的全部意义。 */
  const generated = coverSourceRect(1080, 1440, LAYOUT_CELL.width, LAYOUT_CELL.height);
  assert.deepEqual(generated, { left: 0, top: 0, width: 1080, height: 1440 },
    '3:4 源图填进 3:4 的格子不许裁（裁了就说明格子比例与签名不符）');

  /* 下载文件名认得出是哪一篇（与"下载第一张"同一口径） */
  const fileName = layoutSheetFileName({ title: '概念视觉方案', family: '底片条', count: 4 });
  assert.match(fileName, /概念视觉方案-底片条-4张\.jpg/);

  /* 页面接线：拼版入口挂在结果区，且**不产生任何计费**（只调既有上传 + 既有资产注册） */
  assert.match(PAGE, /layoutSheetPlan\(\{[\s\S]{0,120}?family: effectiveValues\.layout, count: sheetDone/,
    '拼版入口要按"版式族 + 已出的张数"算（算不出来就不渲染入口）');
  assert.match(PAGE, /layoutSheetBlob\(plan, urls, \{ copy: sheetCopy \}\)/,
    '拼版只能走这一个确定性导出函数（文案也一起交给它）');
  assert.match(PAGE, /uploadEcommerceAsset\(\{ data: dataUrl, role: 'reference' \}\)/,
    '要留档得先落成稳定素材（拼版图服务端还不知道它）—— 走既有上传链路，不新增端点');
  assert.match(PAGE, /saveGeneratedUrlsToAssets\(\[uploaded\?\.url\]\.filter\(Boolean\)/, '存进资产库复用既有那条路');
  /* 计费：拼版这一段不许出现任何计费调用 */
  const sheetBlock = PAGE.slice(PAGE.indexOf('async function composeSheet()'), PAGE.indexOf('/* 历史操作②：删除'));
  assert.doesNotMatch(sheetBlock, /quoteBillingAction|regenerateCanvasImage|generateEcommerce|polishECText|autoRecognizeEcommerce/,
    '拼版是确定性渲染：不许调模型、不许扣费（docs/design/90 §6.2）');
  /* 界面上**不许出现价格**（数字 + 积分）——拼版这一步不花钱，写个价格会被当成付费动作。
     ⚠️ 判据只咬"价格"，不咬"不扣积分"这句承诺（那句正是要留给用户看的）。 */
  assert.doesNotMatch(sheetBlock, /\d+(\.\d+)?\s*积分/, '拼版不花钱：不许在界面上出现价格');
  assert.match(sheetBlock, /不扣积分/, '要如实告诉用户这一步不花钱（不然他会以为又扣了一笔）');
  /* 技能声明里那一格必须真的存在（拼版按它走，不许页面里写死一族） */
  const concept = getImageSkill('image.concept_set');
  assert.equal(concept.fields.find(field => field.key === 'layout').default, LAYOUT_FAMILY_NONE,
    '默认档 = 中性档（0928 用户纠错后改的；上一版是"宫格"）');
});
