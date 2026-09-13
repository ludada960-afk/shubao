// test/composer-ports-and-template-head-0913.test.mjs
// 2026-09-13 用户批注：
//  ① 四个生成面板打开后没有左右加号 → 都要有（hover/选中出现，点开继续创作）
//  ② 工作流模板顶部文字与关闭按钮重叠
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('四个生成面板都挂了左右加号', () => {
  const studio = read('src/pages/EcCanvas/components/CanvasStudio.jsx');
  for (const name of ['CanvasImageComposer', 'CanvasTextGenerationComposer', 'CanvasVideoComposer', 'CanvasEcommerceComposer']) {
    const start = studio.indexOf('export function ' + name + '(');
    assert.ok(start > 0, '缺少组件 ' + name);
    const body = studio.slice(start, start + 12000);
    const end = body.indexOf('\nexport function ');
    const chunk = end > 0 ? body.slice(0, end) : body;
    assert.ok(chunk.includes('onPortPointerDown'), name + ' 未接收端口属性');
    assert.ok(chunk.includes('<DerivePort side="input"'), name + ' 缺少左侧加号');
    assert.ok(/<DerivePort visible=\{handlesVisible\}/.test(chunk), name + ' 缺少右侧加号');
  }
  const canvas = read('src/pages/EcCanvas/index.jsx');
  assert.equal((canvas.match(/handlesVisible/g) || []).length >= 4, true, '四个渲染点都传了 handlesVisible');
});

test('工作流模板顶部不再与关闭按钮重叠', () => {
  const gallery = read('src/pages/EcCanvas/WorkflowTemplateGallery.jsx');
  assert.ok(gallery.includes('paddingRight: 40'), '标题行给关闭按钮留安全区');
  assert.ok(!gallery.includes('一键铺开 · 拖图即跑 · 使用/点赞为真数'), '过长文案已缩短，避免挤压');
});
