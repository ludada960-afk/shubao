// test/visual-creation-xhs-parity-v2-0913.test.mjs
// 2026-09-13 二轮用户批注（自由创作页对齐小红书图文）：
//  ① 删掉 composer 顶部「我的素材 0/6 + 长提示」标题行，素材卡直接贴卡片顶部
//  ② 素材上限明确可见：我的素材 ≤6 / 风格参考 ≤3，超限给 toast 且不静默丢弃
//  ③ 四个子页面各自的占位引导、两条示例、素材提示、底部默认画幅互不相同
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const source = read('src/pages/Home/VisualCreationMode.jsx');
const css = read('src/pages/Home/VisualCreationMode.css');
const model = read('src/pages/Home/visualCreationModel.js');

test('composer 顶部不再有「我的素材 0/6 + 长提示」标题行（素材卡贴顶）', () => {
  assert.ok(!source.includes('visual-reference-heading'), 'JSX 已删除 .visual-reference-heading 标题行');
  assert.ok(!css.includes('.visual-reference-heading'), '样式里也不残留标题行规则');
  /* 素材卡直接与卡片顶部相邻：媒体条不再有 10px 上外边距 */
  const listRule = css.match(/\.visual-reference-list \{([^}]*)\}/)?.[1] || '';
  assert.ok(!/margin-top:\s*10px/.test(listRule), '媒体条不再向下推 10px');
});

test('素材上限说明按小红书位置（@引用行）与措辞（计数+格式）表达，不再有提示句', () => {
  /* ⚠️ 2026-09-19 批 H（用户批注 #3）：那一行「素材/风格参考 + 计数 + 格式」被用户点名删除：
     「这一句不要放啊……素材和风格图你完全不用说有多少张呀？」
     判据反转成：**汇总计数与格式说明都不许再上屏**；
     但 .visual-limit-note 这个位置保留给唯一一句信息量不为零的话 ——
     「就绪参考图超过服务端一次能吃下的 8 张时，告诉用户这次会用到几张」。 */
  assert.ok(!source.includes('visual-upload-hint'), '独立提示行已删除');
  assert.ok(!source.includes('主体或参考图都可以'), '自造提示句已删除');
  assert.match(source, /visual-limit-note/, '这个位置保留给「超限告知」那一句');
  assert.doesNotMatch(source, /我的素材 \{materials\.length\}\/\{MAX_REFERENCES\}/, '不再显示我的素材计数');
  assert.doesNotMatch(source, /风格参考 \{styles\.length\}\/\{MAX_STYLE_REFERENCES\}/, '不再显示风格参考计数');
  assert.doesNotMatch(source, /JPG\/PNG\/WebP\}<\/span>/, '格式说明也不再堆在这一行');
  assert.match(source, /serverCappedReferences > 0/, '超限时才提示，且只说这一件事');
  /* 上限常量：素材口放开到 30 / 风格 12（用户：「张数应该多一些呀……不应该过分的去限制」） */
  assert.match(source, /MAX_REFERENCES = 30/, '素材上传口放开');
  assert.match(source, /MAX_STYLE_REFERENCES = 12/, '风格参考上传口放开');
});

test('超限时给 toast 提示且不静默丢弃', () => {
  assert.match(source, /showToast/, '有 toast 通道');
  assert.match(source, /已达上限/, '达到上限时有明确反馈');
  assert.match(source, /本次超出/, '一次选多张超限时说明丢弃了几张（不静默）');
  assert.match(css, /\.visual-toast/, 'toast 有样式');
});

test('四个子页面各自的占位引导、两条示例、素材提示互不相同且非空', () => {
  const expectedIds = ['free', 'poster', 'social-cover', 'brand-kv'];
  assert.deepEqual([...model.matchAll(/^ {4}id: '([^']+)',$/gm)].map(match => match[1]), expectedIds);
  const exampleCount = (model.match(/例：/g) || []).length;
  assert.ok(exampleCount >= 8, '共至少 8 条示例（每页 2 条），实际 ' + exampleCount);

  const allExamples = [...model.matchAll(/例：[^'"\n]+/g)].map(match => match[0].trim());
  assert.ok(allExamples.every(example => example.length > 0), '示例文案非空');
  assert.ok(allExamples.length >= 8, '示例总数不少于 8，实际 ' + allExamples.length);
  assert.equal(new Set(allExamples).size, allExamples.length, '四条示例文案两两互不相同');

  const hints = [...model.matchAll(/promptHint: '([^']+)'/g)].map(match => match[1]);
  assert.equal(new Set(hints).size, 4, '四个占位引导（promptHint）互不相同');

  /* 9-13 三轮：素材区提示句随小红书对齐删除，materialHint 不再渲染 */
  assert.equal((model.match(/materialHint:/g) || []).length, 0, '不再保留 materialHint 字段');
  assert.ok(!source.includes('selectedSkill.materialHint'), '素材区不再渲染提示句');

  /* placeholder 用子页面示例数组渲染 */
  assert.match(source, /selectedSkill\.promptExamples/, 'placeholder 渲染子页面示例');
});

test('切子页面后底部参数默认值按板块取最合适画幅', () => {
  assert.match(source, /setRatio\(visualSkillDefaultRatio\(skillId\)\)/, '切页时按板块默认画幅重置');
  assert.match(model, /export function visualSkillDefaultRatio/, '模型提供默认画幅函数');
  assert.match(model, /ratios\[0\]/, '默认取该板块第一个（最合适）画幅');
});
