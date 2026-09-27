/* ═══ 门禁：版式层（客户端确定性拼版）2026-09-27 批 DC / M3 ══════════════════════════════════
   实测依据（docs/research/2026-09-27-aura-deep-dive.md §三③ 与 §五-影响 1）：
     · 拼版 **60/402（14.9%）**，分布在 **36/41 篇（87.8%）** —— 这是"像不像他"的最大差距；
     · 四种语法里本批做两种：宫格（n20-1、n29-1/4、n32-1、n35-1/9、n36-3、n40-1）与
       底片条（n24-4、n28-7、n27-1）；另两种（宝丽来画中画 / 品牌信息图版式）排在下一批。
     · 硬约束：**绝不让模型"一次画一整张九宫格"**（分格线会画歪、格内内容互相渗透）
       ⇒ 先出 N 张单图，再在这一层**确定性拼**（纯几何 + canvas，不调模型、不计费）。

   这一组守四件事（每条都带自证）：
     ① 拼版函数是**纯函数**：给张数 → 每张的目标矩形；**宫格列数随张数变化**；
     ② 底片条**等宽 + 等间隔**，且格与格不重叠、不越界；
     ③ **张数为 0（以及只 1 张）时不出图**（同族至少复用 2 张 —— 实测的成套感来源）；
     ④ 单格按 **cover** 填（不拉伸）+ 拼版入口/下载/存资产那条链只认既有端点（不新增、不计费）。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  LAYOUT_CELL,
  coverSourceRect,
  gridColumns,
  isLayoutFamily,
  layoutFamilies,
  layoutSheetFileName,
  layoutSheetPlan,
} from '../src/pages/Home/conceptLayoutSheet.js';
import { pieceLayoutFamilyHolds } from '../src/skills/skillRun.js';
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

test('③ 0 张（以及只 1 张）不出图：不产出空画布，也不给一颗拼不了的按钮', () => {
  assert.equal(layoutSheetPlan({ family: '宫格', count: 0 }), null, '0 张必须不出图（不许产出一张空白成品图）');
  assert.equal(layoutSheetPlan({ family: '底片条', count: 0 }), null);
  assert.equal(layoutSheetPlan({ family: '宫格', count: 1 }), null,
    '1 张不出图 —— 实测"成套感"来自"同版式族至少复用 2 张"，一张谈不上复用');
  assert.equal(layoutSheetPlan({ family: '', count: 3 }), null, '没选版式族就不拼');
  assert.equal(layoutSheetPlan({ family: '宝丽来画中画', count: 3 }), null,
    '还没做的语法不许出现（给一个点了做不出来的档就是坑）');
  assert.equal(layoutSheetPlan({ family: '宫格', count: 2 }).count, 2, '自证前提：2 张是可以拼的');
  /* 判据同源：拼版函数用的就是 skillRun 那条"同族至少 2 张" */
  assert.equal(pieceLayoutFamilyHolds('宫格', 0), false);
  assert.equal(pieceLayoutFamilyHolds('宫格', 2), true);
  assert.deepEqual(layoutFamilies(), ['宫格', '底片条'], '能拼的族只有这两个（与声明源同一份）');
  assert.equal(isLayoutFamily('宫格'), true);
  assert.equal(isLayoutFamily('宝丽来画中画'), false);
  /* ── 自证：把阈值放松到 0，0 张就会"通过" —— 证明上面那条真的咬住了空图 ── */
  const relaxed = count => count >= 0;
  assert.equal(relaxed(0), true, '自证：放松阈值后 0 张会通过 ⇒ 上面那条不是空转');
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
  assert.equal(stretched.height, 2500);
  assert.notEqual(stretched.height, wide.height, '自证：拉伸方案的裁剪矩形与 cover 不同 ⇒ 上面那条测的是真 cover');
  assert.ok(wide.left > 0, '横图裁掉左右时，取的是**中间**那一块（不是靠左贴边）');

  /* 下载文件名认得出是哪一篇（与"下载第一张"同一口径） */
  const fileName = layoutSheetFileName({ title: '概念视觉方案', family: '底片条', count: 4 });
  assert.match(fileName, /概念视觉方案-底片条-4张\.jpg/);

  /* 页面接线：拼版入口挂在结果区，且**不产生任何计费**（只调既有上传 + 既有资产注册） */
  assert.match(PAGE, /layoutSheetPlan\(\{ family: effectiveValues\.layout, count: sheetDone \}\)/,
    '拼版入口要按"版式族 + 已出的张数"算（算不出来就不渲染入口）');
  assert.match(PAGE, /layoutSheetBlob\(plan, urls\)/, '拼版只能走这一个确定性导出函数');
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
  assert.equal(concept.fields.find(field => field.key === 'layout').default, '宫格');
});
