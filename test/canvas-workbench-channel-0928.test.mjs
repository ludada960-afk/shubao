/* ══════════════════════════════════════════════════════════════════════════════════════════════
   2026-09-28 批 CY-⑨ 门禁（CV-2 第 2 步）：**画布节点 ↔ 子页面工作台**（用户已拍板入口在节点上）

   用户口径（docs/design/89 §5 第 2 步 / §7 第 3 条）：
     · 画布 → 子页面：**节点上**「在完整工作台里编辑」（打开对应 skill 子页面，参数带过去）；
     · 子页面 → 画布：「送到画布」（下一批）。
     拍板原话（§7 第 3 条）：入口放哪 = **节点上**（竞品都是节点级，顶栏只留"模板广场"）——
     用户本轮回复「画布↔子页面的入口位置，可以，你做吧」。

   这条判据守的是"**能到、带得对、不乱收费、接不通就不给入口**"四件事：
     ① 解析：从节点能算出子页面坐标（先认建节点时存下的 id，再按名字精确回查；解析不出 ⇒ null）；
     ② 带参数：只带**这条技能真声明了的字段**（不许瞎塞 key）；
     ③ 不收费：这条链路上**不许出现任何扣费调用**（钱只发生在按报价确认之后）；
     ④ 接不通不渲染：`onOpenWorkbench` 为 null 时那颗按钮根本不出现（视频技能正是这一类）。
   实测：`.qa/cy9-canvas-workbench-channel.mjs` —— 建节点(6→7) → 技能层里有那颗按钮 → 点击落到
   `/image-creation?id=image.product_suite` 且提示词已预填 → **全程 0 次 POST** → 清掉技能后按钮消失。
   ⚠️ 探针环境教训（写进脚本注释了）：第一版"点了不跳"其实是 **dev server 的模块图坏了**
     （`Failed to fetch dynamically imported module`），第二次跑全 200 —— 别把环境问题当接线问题。
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canvasNodeSeedValues, canvasWorkbenchTargetOf } from '../src/pages/EcCanvas/canvasWorkbenchBridge.js';
import { IMAGE_SKILLS } from '../src/skills/imageSkills.js';

const stripComments = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const read = rel => readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
const readCode = rel => stripComments(read(rel));

test('① 解析子页面坐标：先认节点上存的 id；再按**名字精确相等**回查；都不中就是 null（不猜）', () => {
  const suite = IMAGE_SKILLS.find(item => item.id === 'image.product_suite');
  assert.ok(suite, '前提：声明源里有 image.product_suite');

  /* 建节点时存下的 id（CV-2 之后新建/改过技能的节点走这条） */
  assert.equal(canvasWorkbenchTargetOf({ subpageSkillId: 'image.product_suite' })?.skillId, 'image.product_suite');
  /* 老节点/草稿没有这个字段 ⇒ 按技能名精确回查 */
  assert.equal(canvasWorkbenchTargetOf({ skillLabel: suite.name })?.skillId, 'image.product_suite');
  /* 名字对不上、id 对不上 ⇒ 不猜 */
  assert.equal(canvasWorkbenchTargetOf({ skillLabel: '不存在的技能' }), null);
  assert.equal(canvasWorkbenchTargetOf({}), null);
  assert.equal(canvasWorkbenchTargetOf(null), null);
  /* 明确标了别的板块（视频）⇒ 一律不给（视频侧还没接落地链路，给了就是"点了没反应"） */
  assert.equal(canvasWorkbenchTargetOf({ subpageSkillId: 'image.product_suite', subpageDomain: 'video' }), null);
});

test('② 带过去的参数：只带这条技能**真声明了**的字段（不许瞎塞 key）', () => {
  const withRatio = { fields: [{ key: 'ratio' }, { key: 'resolution' }, { key: 'count' }] };
  const seed = canvasNodeSeedValues({ ratio: '3:4', resolution: '2K', count: 2 }, withRatio);
  assert.deepEqual(seed, { ratio: '3:4', resolution: '2K', count: 2 }, '声明了的三项都要带过去');

  /* 清晰度在另一族技能里叫 clarity ⇒ 谁在给谁（不重复塞两个 key） */
  const clarityOnly = { fields: [{ key: 'clarity' }, { key: 'ratio' }] };
  assert.deepEqual(canvasNodeSeedValues({ ratio: '1:1', resolution: '4K' }, clarityOnly), { ratio: '1:1', clarity: '4K' });

  /* 技能没声明的字段，一个都不许出现（否则子页面会多出无主的值） */
  const ratioOnly = { fields: [{ key: 'ratio' }] };
  assert.deepEqual(canvasNodeSeedValues({ ratio: '1:1', resolution: '2K', count: 3 }, ratioOnly), { ratio: '1:1' });
  /* 空值/非法数量不带 */
  assert.deepEqual(canvasNodeSeedValues({ ratio: '', resolution: '', count: 0 }, withRatio), {});
  assert.deepEqual(canvasNodeSeedValues(null, withRatio), {});
});

test('③ 这条链路上不许出现扣费调用（钱只发生在按报价确认之后）', () => {
  const bridge = readCode('src/pages/EcCanvas/canvasWorkbenchBridge.js');
  assert.doesNotMatch(bridge, /settle|charge|billing|hold|扣费|支付/i, '桥里不许有任何计费调用（它只算数据）');
  const idx = readCode('src/pages/EcCanvas/index.jsx');
  const start = idx.indexOf('const openNodeInWorkbench = useCallback');
  assert.ok(start > 0, '必须有 openNodeInWorkbench 这个入口');
  const block = idx.slice(start, idx.indexOf('selectedWorkbenchOpen', start));
  assert.match(block, /SET_CREATION_LAUNCH/, '它只发一个 launch');
  assert.match(block, /NAVIGATE', page: 'image-creation'/, '跳到图片子页面（与"做同款/回到工作台"同一条路）');
  assert.doesNotMatch(block, /settle|charge|billing|hold|扣费|支付/i, '打开工作台不收费（铁律）');
  const media = readCode('src/pages/MediaCreation/index.jsx');
  assert.match(media, /launch\.kind === 'work-remix' \|\| launch\.kind === 'canvas-node-edit'/,
    '子页面落地**复用** work-remix 那一段（不新写第二套还原逻辑）');
  assert.match(media, /carryHintRef\.current = launch\.kind === 'canvas-node-edit'/, '提示语要说明"这次是从画布那个节点来的"');
});

test('④ 接不通就不给入口：按钮只在 onOpenWorkbench 非空时渲染，且节点上记了子页面坐标', () => {
  const studio = readCode('src/pages/EcCanvas/components/CanvasStudio.jsx');
  assert.match(studio, /\{onOpenWorkbench && <button type="button" className="ec-canvas-skill-workbench"/,
    '为 null 时那颗按钮根本不出现（不许渲染一个点了没反应的入口）');
  assert.match(studio, /在完整工作台里编辑/, '文案照 docs/design/89 §5 第 2 步的原话');
  /* 只在"技能"这一格里给入口 —— 不在参数行/顶栏再造重复入口（用户反复点名过） */
  const controls = studio.slice(studio.indexOf('function CanvasSkillControl'), studio.indexOf('function CanvasParameterControls'));
  assert.match(controls, /ec-canvas-skill-workbench/, '入口在技能弹层里');
  const idx = readCode('src/pages/EcCanvas/index.jsx');
  assert.match(idx, /subpageSkillId: skill\.id \|\| ''/, '建节点时要记下子页面 id');
  assert.match(idx, /subpageSkillId: skill\.id \|\| '', subpageDomain: target\.domain === 'video' \? 'video' : 'image'/,
    '换技能时连子页面坐标一起换');
  const css = readCode('src/pages/EcCanvas/EcCanvas.css');
  assert.match(css, /button\.ec-canvas-skill-workbench \{/, '那一行要有自己的样式（默认那套是 grid 竖排，图标会被挤到第二行）');
  assert.doesNotMatch(css.slice(css.indexOf('ec-canvas-skill-workbench') - 40, css.indexOf('ec-canvas-skill-workbench') + 900), /!important/,
    '不许用 !important 覆盖（提高选择器优先级即可）');
});
