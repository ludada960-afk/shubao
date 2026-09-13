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

test('素材上限说明可见且按「我的素材 ≤6 / 风格参考 ≤3」表达', () => {
  /* 与小红书同款位置：上传媒体条下方的素材区提示行 */
  assert.match(source, /visual-upload-hint/, '存在素材区提示行');
  assert.match(source, /我的素材 \{materials\.length\}\/\{MAX_REFERENCES\}/, '我的素材计数可见');
  assert.match(source, /风格参考 \{styles\.length\}\/\{MAX_STYLE_REFERENCES\}/, '风格参考计数可见');
  assert.match(source, /最多 \{MAX_REFERENCES\} 张/, '我的素材上限「最多 6 张」');
  assert.match(source, /最多 \{MAX_STYLE_REFERENCES\} 张/, '风格参考上限「最多 3 张」');
  assert.match(source, /JPG\/PNG\/WebP/, '格式说明仍在');
  assert.match(source, /MAX_STYLE_REFERENCES = 3/, '风格参考上限常量');
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

  const materialHints = [...model.matchAll(/materialHint: '([^']+)'/g)].map(match => match[1]);
  assert.equal(new Set(materialHints).size, 4, '四个素材提示（materialHint）互不相同');

  /* placeholder 用子页面示例数组渲染 */
  assert.match(source, /selectedSkill\.promptExamples/, 'placeholder 渲染子页面示例');
});

test('切子页面后底部参数默认值按板块取最合适画幅', () => {
  assert.match(source, /setRatio\(visualSkillDefaultRatio\(skillId\)\)/, '切页时按板块默认画幅重置');
  assert.match(model, /export function visualSkillDefaultRatio/, '模型提供默认画幅函数');
  assert.match(model, /ratios\[0\]/, '默认取该板块第一个（最合适）画幅');
});
