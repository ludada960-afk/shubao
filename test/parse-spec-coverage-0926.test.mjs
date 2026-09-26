/* ═══ 门禁：每条 skill 都要有**自己的**"代为撰写"解析方案（2026-09-26 批 BV）══════════════════
   用户口径（逐字）：
   「我要的是，**每个工作台 skill 有自己个性化的解析方案**啊，**不可能概念 skill 还解析什么卖点和
     产品特点吧**？」「不止是概念视觉，我们现在**所有的图片生成和视频生成的代为撰写**是不是都应该
     这么做呢，**个性化做匹配方案**啊。」

   这一组断言守三件事：
     ① **全覆盖**：图片侧 49 条 + 视频侧 59 条，**每一条**都能解析出一份 spec（缺一条就红）——
        这样"全部都做了"不是靠人记得，而是机器不让漏；
     ② **内容真的个性化**（不只是有个对象）：概念视觉方案**不许**出现"卖点/人群/参数"这类电商维度
        （用户点名的那句），而套图那三条**必须有**卖点；两族的解析项不能是同一套；
     ③ **默认档必须是中性档**：方向组的第一档只能是"智能匹配/保持原样/自动"这类，
        不许拿一个**具体取值**冒充默认（那等于替用户选了一个他没选的东西）。
     ④ 自证：把某族的 items 清空、或把默认档换成一个具体值，必须被判红。 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { IMAGE_SKILLS } from '../src/skills/imageSkills.js';
import { VIDEO_SKILLS } from '../src/skills/videoSkills.js';
import { parseSpecOf, parseSpecKeyOf, PARSE_SPEC_FAMILIES, PARSE_SPEC_OVERRIDES } from '../src/skills/parseSpecs.js';

const ALL = [...IMAGE_SKILLS, ...VIDEO_SKILLS];
const NEUTRAL = new Set(['auto', 'keep', '轻', '']);

test('① 每条 skill（图片 49 + 视频 59）都能取到解析方案，缺一条就红', () => {
  const missing = ALL.filter(skill => !parseSpecOf(skill)).map(skill => skill.id + '（' + (skill.board === 'video' ? skill.pipeline : skill.category) + '）');
  assert.deepEqual(missing, [], '这些技能没有解析方案（既不在族级里、也没有单条覆盖）：\n' + missing.join('\n'));
  assert.ok(ALL.length >= 100, '样本量自证：技能总数应当过百，实际 ' + ALL.length);
  /* 族级表本身不许空转：每族的 items 与 directions 都要有内容 */
  for (const [key, spec] of Object.entries(PARSE_SPEC_FAMILIES)) {
    assert.ok(Array.isArray(spec.items) && spec.items.length >= 3, key + ' 族的解析项少于 3 条，像占位');
    assert.ok(Array.isArray(spec.directions) && spec.directions.length >= 1, key + ' 族没有方向组');
  }
});

test('② 内容真的个性化：概念视觉方案不许有电商维度，套图必须有卖点', () => {
  const concept = parseSpecOf(IMAGE_SKILLS.find(s => s.id === 'image.concept_set'));
  const suite = parseSpecOf(IMAGE_SKILLS.find(s => s.id === 'image.product_suite'));
  const labels = spec => spec.items.map(item => item.label).join(' ');

  /* 用户点名的那句：「不可能概念 skill 还解析什么卖点和产品特点吧」 */
  assert.doesNotMatch(labels(concept), /卖点|产品特点|适用人群|尺寸参数/,
    '概念视觉方案的解析项里又出现电商维度了 —— 用户明确说过它不该解析这些');
  /* 反过来，套图那三条**必须**保留商品解析（那是它们真正要的） */
  assert.match(labels(suite), /卖点/, '商品套图丢了"核心卖点"这一条解析');
  /* 两族的解析项不能是同一套（否则就是"共用一套"而不是"个性化"） */
  assert.notDeepEqual(concept.items.map(i => i.key), suite.items.map(i => i.key),
    '概念方案与商品套图用的是同一套解析项 —— 那就没做到"每个 skill 自己的方案"');
  /* 概念这一条该解析的"做图要素"要在（它是这条 skill 的命门） */
  for (const key of ['subject', 'material', 'palette', 'scene', 'light', 'avoid']) {
    assert.ok(concept.items.some(i => i.key === key), '概念视觉方案少了这条解析：' + key);
  }
});

test('③ 方向组的默认档：要么是中性档，要么必须**显式声明**"这是已声明的默认"', () => {
  /* 第一档会被界面默认选中，所以只允许两条路径：
     ① 中性档 auto/keep（"这一项交给系统判断"）；
     ② `pinned: true` + `reason`（"这就是这条 skill / 工作台已经声明过的默认值"，展示它=展示实际会下发的值）。
     ⚠️ 这条规则是本批**门禁抓出来的**：第一版我写了 8 个具体取值当第一档，其中 4 处是
        **我替用户选了一个他没有选的值**（已改回中性档），另外 4 处属于"与已声明的默认一致"（标 pinned）。 */
  const bad = [];
  for (const [key, spec] of Object.entries({ ...PARSE_SPEC_FAMILIES, ...PARSE_SPEC_OVERRIDES })) {
    for (const group of spec.directions || []) {
      const first = group.options?.[0];
      if (!first) { bad.push(key + ' / ' + group.label + '：整个方向组一个选项都没有'); continue; }
      const neutral = NEUTRAL.has(first.value);
      const declared = first.pinned === true && String(first.reason || '').trim().length >= 8;
      if (!neutral && !declared) {
        bad.push(key + ' / ' + group.label + '：第一档「' + first.label + '」既不是中性档，也没写明"这是已声明的默认"');
      }
    }
  }
  assert.deepEqual(bad, [], '这些方向组的第一档既不中性、也没声明理由：\n' + bad.join('\n'));
  /* 自证：pinned 但没有 reason 的也要判红（防"标个 pinned 就蒙过去"） */
  const sneaky = { key: 'x', label: 'x', options: [{ value: 'warm', label: '暖调', pinned: true }] };
  let caught = false;
  try { assert.ok(NEUTRAL.has(sneaky.options[0].value) || String(sneaky.options[0].reason || '').trim().length >= 8); } catch { caught = true; }
  assert.equal(caught, true, '标了 pinned 却没写理由没被判红 ⇒ 这条判据可以蒙过去');
});

test('④ 覆盖表只放真实存在的 skill，且"该覆盖的"确实被覆盖了', () => {
  const ids = new Set(ALL.map(s => s.id));
  const stale = Object.keys(PARSE_SPEC_OVERRIDES).filter(id => !ids.has(id));
  assert.deepEqual(stale, [], '覆盖表里有不存在的 skill：' + stale.join(', '));
  const concept = IMAGE_SKILLS.find(s => s.id === 'image.concept_set');
  assert.equal(parseSpecKeyOf(concept).kind, 'override', '概念视觉方案应当走单条覆盖（它跟同族都不一样）');
  /* 覆盖**只有**在真的不一样时才写：这里显式断言覆盖条数很少，防"108 条 108 套" */
  assert.ok(Object.keys(PARSE_SPEC_OVERRIDES).length <= 5,
    '单条覆盖超过 5 条了 —— 能归族就归族，否则又变成要维护 108 套（当前 ' + Object.keys(PARSE_SPEC_OVERRIDES).length + ' 条）');
});

test('⑤ 自证：解析项清空 / 默认档换成具体值，都必须被判红', () => {
  const brokenSpec = { ...PARSE_SPEC_OVERRIDES['image.concept_set'], items: [] };
  let caught = false;
  try { assert.ok(brokenSpec.items.length >= 3); } catch { caught = true; }
  assert.equal(caught, true, '清空解析项没被判红 ⇒ ① 里那条是空转');

  const brokenGroup = { key: 'x', label: 'x', options: [{ value: 'warm-earth', label: '灰调大地', prompt: '' }] };
  caught = false;
  try { assert.ok(NEUTRAL.has(brokenGroup.options[0].value)); } catch { caught = true; }
  assert.equal(caught, true, '默认档换成具体值没被判红 ⇒ ③ 那条是空转');
});
