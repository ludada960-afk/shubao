/* ═══ 门禁：**用户提示词优先于 skill 内置文案**（2026-09-25 批 BL，用户拍板）══════════════
   用户原话：「我觉得不行，你还是要**优先用户的提示词先**，内置的 skill 用户**根本看不到**，
             所以还是要提示词优先。」
   ⇒ 这是**用户改口径**，不是"事实变了"：批 BK 查清的事实是"模板固定句与用户内容被拼成同一段、
     中间没有裁决者"，用户据此决定按"提示词优先"处理。
   ── 这一组断言守什么 ────────────────────────────────────────────────────
     ① 用户填了内容时，最终提示词里**必须**出现显式优先级声明（用户的内容为准）；
     ② 用户什么都没填时**不许**加那句（纯噪声 + 白花 token）；
     ③ 用户只选了不进提示词的字段（比例/清晰度）时也**不许**加；
     ④ 判定要按**模板里真实用到的占位符**取，不能看"有没有任意非空值"；
     ⑤ 模板本身**不许被删改**（手艺不能被优先级调整削掉，也不许静默改写用户看不见的文本）；
     ⑥ 自证：把声明去掉的版本必须被判红（否则这组断言是空转）。 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSkillBrief, USER_PRIORITY_CLAUSE } from '../src/skills/skillRun.js';
import { IMAGE_SKILLS } from '../src/skills/imageSkills.js';

const skillOf = id => IMAGE_SKILLS.find(skill => skill.id === id);

test('① 用户填了内容 → 提示词里必须有显式优先级声明', () => {
  const skill = skillOf('image.cn_poster');
  const filled = buildSkillBrief(skill, { topic: '春季书展', prompt: '暖色灯光下的展台' });
  assert.ok(filled.includes(USER_PRIORITY_CLAUSE), '缺少优先级声明：用户看不见模板，必须显式告诉他谁说了算');
  assert.match(filled, /以用户填写的内容为准/);
});

test('② 用户什么都没填 → 不许加那句（噪声 + 白花 token）', () => {
  const skill = skillOf('image.cn_poster');
  const empty = buildSkillBrief(skill, {});
  assert.ok(!empty.includes(USER_PRIORITY_CLAUSE), '全空时不该出现优先级声明');
  /* 顺带守住原有的"不留半截话/不重复标点"口径（2026-09-19 批 O-⑥ 那条的回归） */
  assert.doesNotMatch(empty, /[，。；：][ ]*[，。；：]/);
  assert.doesNotMatch(empty, /\{\{/);
});

test('③ 只填了不进提示词的字段（比例/清晰度）→ 也不许加', () => {
  const skill = skillOf('image.cn_poster');
  const onlySettings = buildSkillBrief(skill, { ratio: '3:4', resolution: '2K' });
  assert.ok(!onlySettings.includes(USER_PRIORITY_CLAUSE),
    '比例/清晰度走协议字段、不进提示词，不该因此出现"以用户内容为准"这句没有对象的声明');
});

test('④ 判定按"模板里真实用到的占位符"取，不是"有没有任意非空值"', () => {
  /* 构造一条只用到 {{a}} 的假技能；用户只填了模板里没有的 b —— 不该加声明 */
  const fake = { id: 'image.fake', brief: '做一张图。{{a}}。要求：克制。' };
  assert.ok(!buildSkillBrief(fake, { b: '只填了没被引用的字段' }).includes(USER_PRIORITY_CLAUSE));
  assert.ok(buildSkillBrief(fake, { a: '填了被引用的字段' }).includes(USER_PRIORITY_CLAUSE));
});

test('⑤ 模板本身不许被删改：冲突的两句都要在，只是声明了谁说了算', () => {
  /* 取一条真实的、模板自带"品牌标识必须保留"的技能（批 BK 审出来的例子） */
  const skill = skillOf('image.brand_kv');
  assert.ok(skill, 'image.brand_kv 必须还在（这条断言以它为样本）');
  const userDemand = '画面内不出现任何品牌标识';
  const filled = buildSkillBrief(skill, { topic: '秋日限定', brand: 'X', prompt: userDemand });
  /* 用户的话必须在 */
  assert.ok(filled.includes(userDemand), '用户的要求被丢了');
  /* 模板自带的反向句子**必须还在**（不许静默删改用户看不见的文本） */
  assert.match(filled, /品牌标识与产品细节必须原样保留/, '模板被静默改写了 —— 那是更坏的修法');
  /* 而"谁说了算"必须被显式声明 */
  assert.ok(filled.includes(USER_PRIORITY_CLAUSE), '两句冲突却没有裁决声明');
});

test('⑥ 自证：把优先级声明去掉的实现必须被判红（否则这组断言是空转）', () => {
  const skill = skillOf('image.cn_poster');
  const filled = buildSkillBrief(skill, { topic: '春季书展' });
  const withoutClause = filled.replace(USER_PRIORITY_CLAUSE, '').trim();
  assert.ok(!withoutClause.includes('以用户填写的内容为准'),
    '去掉声明后仍能匹配 ⇒ ① 那条断言测的不是声明本身');
  assert.notEqual(withoutClause, filled, '替换没生效，这条自证无效');
});

test('⑦ 全量：每条图片技能只要有用户内容，就都带上声明（没有漏网的路径）', () => {
  const samples = { assets: [], product: '杯子', drink: '气泡水', topic: '春季', brand: 'X', prompt: '暖光', scene: '桌面', notes: '便签', points: '卖点', title: '标题', detail: '细节' };
  const missing = [];
  for (const skill of IMAGE_SKILLS) {
    const keys = [...String(skill.brief || '').matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]);
    if (!keys.length) continue;
    const values = {};
    for (const key of keys) if (samples[key]) values[key] = samples[key];
    if (!Object.keys(values).length) continue;
    if (!buildSkillBrief(skill, values).includes(USER_PRIORITY_CLAUSE)) missing.push(skill.id);
  }
  assert.deepEqual(missing, [], '这些技能的用户内容没有拿到优先级声明：' + missing.join(', '));
});
