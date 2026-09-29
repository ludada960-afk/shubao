import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildEcAutoStudioHandoff, canOpenEcAutoStudioHandoff } from '../src/pages/EcAuto/ecAutoStudioHandoff.js';
import { getImageSkill } from '../src/skills/imageSkills.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const page = read('src/pages/EcAuto/index.jsx');

const SKILL_ID = 'image.product_suite';
const skill = getImageSkill(SKILL_ID);
const results = {
  product_name: '蓝牙耳机',
  images: {
    '主图-白底': 'https://cdn.example.com/a.png',
    '主图-场景': 'https://cdn.example.com/b.png',
  },
};

/* ══════════════════════════════════════════════════════════════════════════════
   EcAuto「去精修工坊微调」以前是**空手跳转**（批 CY-㉑）：
     onClick={() => dispatch({ type: 'NAVIGATE', page: 'ec-studio' })}

   只换页面、不带任何东西；而 EcStudio 挂载时只读 loadOrCreateEcommerceDraft(...)，
   **从不读任何传入载荷** ⇒ 用户点「微调」到了一张空白配置页，刚生成的图一张也没跟过去。

   用户原话（同一批上下文）：「这种情况他应该不是一个孤立的情况，可能还有很多其他的
   情况也是类似的问题。」⇒ 这类「点了像没点」的入口要一条条接上真实链路。
   ══════════════════════════════════════════════════════════════════════════════ */

test('① 目标技能存在，且有上传位（否则素材带不过去，这条链路就不该存在）', () => {
  assert.ok(skill, `技能 ${SKILL_ID} 必须存在`);
  assert.equal(canOpenEcAutoStudioHandoff(skill), true, '目标技能必须有 upload 字段');
});

test('② 结果图 + 提示词会变成一条 canvas-node-edit 载荷', () => {
  const launch = buildEcAutoStudioHandoff({ results, prompt: '白色耳机，突出降噪', skillId: SKILL_ID, skill });
  assert.ok(launch, '必须产出 launch');
  // 与 work-remix / canvas-node-edit **同一个形状**（MediaCreation:1604 认这个 kind）
  assert.equal(launch.kind, 'canvas-node-edit');
  assert.equal(launch.skillId, SKILL_ID);
  assert.equal(launch.prompt, '白色耳机，突出降噪');
  assert.equal(launch.title, '蓝牙耳机');
});

test('③ 只写该技能自己声明过的字段（写不存在的 key = 界面不显示但参数照发，本仓最贵的 bug）', () => {
  const launch = buildEcAutoStudioHandoff({ results, prompt: '测试', skillId: SKILL_ID, skill });
  const declared = new Set((skill.fields || []).map(f => f.key));
  for (const key of Object.keys(launch.panelValues)) {
    assert.ok(declared.has(key), `panelValues 写进了未声明的字段 "${key}"`);
  }
  assert.ok(launch.panelValues.assets, '主素材应落在第一个上传位 assets');
  assert.ok(launch.panelValues.productParams, '提示词应落在 productParams');
});

test('④ 素材形状必须是 FieldRenderer 认得的「ready + url」', () => {
  const launch = buildEcAutoStudioHandoff({ results, prompt: 'x', skillId: SKILL_ID, skill });
  const assets = launch.panelValues.assets;
  assert.equal(assets.length, 2, '两张结果图都要带过去');
  for (const item of assets) {
    assert.equal(item.status, 'ready', '占位/未就绪的项不算数（铁律：不摆假东西）');
    assert.ok(item.url, '每项都必须有 url');
  }
});

test('⑤ 取不出图 / 取不到技能 / 没有上传位 → 返回 null，调用方要说人话', () => {
  assert.equal(buildEcAutoStudioHandoff({ results: null, prompt: 'x', skillId: SKILL_ID, skill }), null);
  assert.equal(buildEcAutoStudioHandoff({ results: { images: {} }, prompt: 'x', skillId: SKILL_ID, skill }), null);
  // url 是空串的项必须被丢掉（不能变成一个空素材槽）
  assert.equal(
    buildEcAutoStudioHandoff({ results: { images: { a: '   ' } }, prompt: 'x', skillId: SKILL_ID, skill }),
    null,
    '只有空白的图不算数',
  );
  assert.equal(buildEcAutoStudioHandoff({ results, prompt: 'x', skillId: SKILL_ID, skill: null }), null);
  assert.equal(
    buildEcAutoStudioHandoff({ results, prompt: 'x', skillId: SKILL_ID, skill: { fields: [{ key: 'a', kind: 'text' }] } }),
    null,
    '没有上传位的技能带不了图',
  );
});

test('⑥ 没有提示词时也照样能带图过去（提示词是可选的，不是前置条件）', () => {
  const launch = buildEcAutoStudioHandoff({ results, prompt: '', skillId: SKILL_ID, skill });
  assert.ok(launch, '没提示词也必须能跳转');
  assert.equal(launch.prompt, '');
  assert.ok(launch.panelValues.assets.length === 2, '图照样要带全');
  assert.equal(launch.title, '蓝牙耳机', '标题回落到商品名');
});

test('⑦ 页面真的换成了带载荷的跳转（不再有裸 NAVIGATE ec-studio）', () => {
  assert.match(page, /onClick=\{openStudioHandoff\}/, '按钮必须走带载荷的 handler');
  /* 只看代码不看注释 —— 解释性注释里本来就要写出旧文案，否则后来人不知道改的是什么 */
  const code = page.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
  assert.doesNotMatch(code, /去精修工坊微调/, '旧文案已经改成「带着这批图去精修」，不该再有');
  // 顶部那颗「精修工坊」是**纯导航**（用户主动换页面，不是在交接结果）—— 明确写下来免得下一个人"顺手修"
  const navOnly = /<button onClick=\{\(\) => dispatch\(\{ type: 'NAVIGATE', page: 'ec-studio' \}\)\}/;
  assert.match(page, navOnly, '顶部导航按钮保留裸跳转是有意的：它是换页面，不是交接结果');
});

test('⑧ 只预填、不触发生成（扣费必须在目标页由用户点「立即生成」）', () => {
  const handler = page.slice(page.indexOf('const openStudioHandoff'), page.indexOf('const downloadAll'));
  assert.doesNotMatch(handler, /autoGenerate|generateCanvasImage|regenerateCanvasImage/,
    '跳转 handler 里**不许**出现任何生成调用 —— 那会静默扣费');
  assert.match(handler, /SET_CREATION_LAUNCH/);
  assert.match(handler, /NAVIGATE', page: 'image-creation'/);
});

test('⑨ 载荷走的是既有的跨路由载体（站内跨路由只有 creationLaunch 一个，别再造第二个）', () => {
  const mc = read('src/pages/MediaCreation/index.jsx');
  assert.match(mc, /launch\.kind === 'work-remix' \|\| launch\.kind === 'canvas-node-edit'/,
    'MediaCreation 必须仍然认 canvas-node-edit 这个 kind');
});
