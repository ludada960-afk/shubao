// test/visual-creation-xhs-composer-parity-0913.test.mjs
// 2026-09-13 用户批注：
//  自由创作的上传区 + 输入区必须复用小红书图文那一套（只改文案），四个子页面都要一致。
//  ① 生成按钮统一挂 .shubao-gen-cta，按钮内显示动态积分（shubao-gen-cta-points）
//  ② 上传区与输入区在同一张卡片内（照小红书 ec-xhs-composer 渐变面 + 媒体条 + 无边框提示词 + ImageMentionPicker insert）
//  ③ 文案含「我的素材」、保留 references 计数、不含违禁词
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const source = read('src/pages/Home/VisualCreationMode.jsx');
const css = read('src/pages/Home/VisualCreationMode.css');

test('生成按钮统一挂 .shubao-gen-cta 并在按钮内显示动态积分', () => {
  assert.match(source, /visual-generate-button shubao-gen-cta/, 'CTA 挂统一类');
  assert.match(source, /shubao-gen-cta-points/, '积分用统一容器');
  assert.match(source, /\{estimatedPoints\} 积分/, '按钮内显示动态积分');
  assert.match(source, /disabled={!canGenerate || busy}/, '可生成性语义不变');
});

test('上传区与输入区在同一张卡片内（照小红书那套结构标记）', () => {
  /* 四个子页面共享同一段 composer JSX：全文件只有一处 composer 容器 */
  assert.equal(
    (source.match(/className="visual-creation-composer"/g) || []).length,
    1,
    '四个子页面共用同一条 composer JSX',
  );
  /* 同一张卡：ec-xhs-composer 渐变面内同时包含 素材区 / 提示词区 / @引用行 */
  const surfaceBlock = source.slice(
    source.indexOf('className="ec-xhs-composer visual-composer-surface"'),
    source.indexOf('ec-workbench-actions'),
  );
  assert.ok(surfaceBlock.length > 0, '找到小红书同款渐变面');
  assert.ok(surfaceBlock.includes('visual-reference-zone'), '素材上传区在渐变卡片内');
  assert.ok(surfaceBlock.includes('ec-textarea-wrap ec-xhs-prompt'), '提示词输入区在渐变卡片内');
  assert.ok(surfaceBlock.includes('ec-workbench-mention-row'), '@ 引用行在渐变卡片内');
  /* 同款上传卡结构：与小红书 XhsSupplementDeck 一样复用 ec-xhs-media-strip + EcommerceAssetCards */
  assert.match(source, /ec-xhs-media-strip xhs-ecommerce-media-strip/, '复用小红书媒体条');
  assert.match(source, /<EcommerceImageCard/, '复用小红书图片缩略卡');
  assert.match(source, /<EcommerceAddCard/, '复用小红书添加卡');
  assert.match(source, /ec-xhs-multiply/, '保留 × 分隔徽标');
  /* 同款输入框：无边框 textarea（xhs-prompt-field）+ 占位提示 */
  assert.match(source, /<textarea[\s\S]*?className="xhs-prompt-field"/, '无边框 textarea');
  assert.match(source, /ec-xhs-placeholder ec-xhs-prompt-hints/, '占位提示同款');
  /* 同款 @ 引用入口：ImageMentionPicker selectionMode="insert" */
  assert.match(source, /<ImageMentionPicker/, '@ 引用入口同款');
  assert.match(source, /selectionMode="insert"/, 'insert 模式同款');
  /* 同款底栏：白底上边条 + 左侧工具胶囊 + 右侧统一生成按钮 */
  assert.match(source, /ec-workbench-actions xhs-template-actions visual-parameter-bar/, '底栏结构同款');
  assert.ok(css.includes('.visual-parameter-bar {'), '底栏样式存在');
});

test('文案：素材区标题「我的素材」并保留计数；不含违禁词', () => {
  assert.match(source, /我的素材/, '素材区标题用「我的素材」');
  assert.ok(source.includes('{references.length}/{MAX_REFERENCES}'), '保留 references 计数');
  assert.match(source, /风格参考只影响构图与色调/, '风格参考提示文案保留');
  for (const word of ['上游', '供应商', '备用', '任务号']) {
    assert.ok(!source.includes(word), '自由创作文案不得出现「' + word + '」');
  }
});
