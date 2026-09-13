// test/composer-ports-and-template-head-0913.test.mjs
// 2026-09-13 用户批注：
//  ① 四个生成面板打开后没有左右加号 → 都要有（hover/选中出现，点开继续创作）
//  ② 工作流模板顶部文字与关闭按钮重叠
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('加号挂在画布节点框左右，生成面板不再挂加号', () => {
  const studio = read('src/pages/EcCanvas/components/CanvasStudio.jsx');
  /* 9-13 修正：加号必须挂在**画布节点框**的左右（不是下面的生成面板）。
     生成节点：输入锚点 + 输出加号，且不再限定 video/layer-group。 */
  const nodeStart = studio.indexOf('export function CanvasGenerationNode(');
  const nodeBody = studio.slice(nodeStart, studio.indexOf('export function CanvasDirectionNode('));
  assert.ok(nodeBody.includes('<DerivePort side="input"'), '节点缺少左侧加号');
  assert.ok((nodeBody.match(/<DerivePort/g) || []).length >= 2, '节点左右都要有加号');
  assert.ok(!/isVideo \|\| isLayerGroup\) && <DerivePort/.test(nodeBody), '不再只给视频/图层加右侧加号');
  /* 四个生成面板不得再挂加号（用户明确：加号要在框的左右，不在输入区） */
  for (const name of ['CanvasImageComposer', 'CanvasTextGenerationComposer', 'CanvasVideoComposer', 'CanvasEcommerceComposer']) {
    const start = studio.indexOf('export function ' + name + '(');
    assert.ok(start > 0, '缺少组件 ' + name);
    const rest = studio.slice(start + 1);
    const end = rest.indexOf('\nexport function ');
    const chunk = rest.slice(0, end > 0 ? end : 8000);
    assert.ok(!chunk.includes('<DerivePort'), name + ' 面板上不应再挂加号');
  }
});

test('工作流模板顶部不再与关闭按钮重叠', () => {
  const gallery = read('src/pages/EcCanvas/WorkflowTemplateGallery.jsx');
  assert.ok(gallery.includes('paddingRight: 40'), '标题行给关闭按钮留安全区');
  assert.ok(!gallery.includes('一键铺开 · 拖图即跑 · 使用/点赞为真数'), '过长文案已缩短，避免挤压');
});
