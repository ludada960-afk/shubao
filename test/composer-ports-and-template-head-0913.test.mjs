// test/composer-ports-and-template-head-0913.test.mjs
// 2026-09-13 用户批注 + 2026-09-15 复核：
//  ① **生成前无加号、生成结果必须有加号** —— 生成框结果未落框前左右都不挂加号；
//     结果落入框内（canvasGenerationBoxHasResult）后左右渲染输入锚点 + 输出加号；
//     text-composer / suite-composer 的框是控制台（结果以独立节点出现），始终不挂加号。
//  ② 工作流模板顶部文字与关闭按钮重叠
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('加号只挂在“已产出结果的节点”左右，生成面板不再挂加号', () => {
  const studio = read('src/pages/EcCanvas/components/CanvasStudio.jsx');
  /* 9-15 用户决定：“生成之前（现在的样式）这四个框可以不用左右加号；生成结果出来之后左右必须有加号”。
     生成节点（CanvasGenerationNode）：左右加号用 nodeHasResult 门控（canvasGenerationBoxHasResult）。 */
  const nodeStart = studio.indexOf('export function CanvasGenerationNode(');
  const nodeBody = studio.slice(nodeStart, studio.indexOf('export function CanvasDirectionNode('));
  assert.ok(nodeBody.includes('nodeHasResult = canvasGenerationBoxHasResult(node)'), '生成节点必须用 canvasGenerationBoxHasResult 判定“结果已落框”');
  /* ⚠️ 2026-09-30 批 CY-㊴：这条判据**方向错了**，按用户新要求推翻。
     用户原话：「他为什么不能够跟我们当前的任意节点创建连接呢？」——
     他要的就是往一个**还没出结果的生成框**里再送一份素材共同创作；
     而 text-composer / suite-composer 的 canvasGenerationBoxHasResult 恒为 false，
     等于这两类框**永远**没有任何端口，线根本落不上去。
     ⇒ 拆成两条各司其职：**输入**锚点 = "上游可以接进来"，无条件渲染；
       **输出**加号 = "从这张图继续派生"，仍然只在结果落框后出现（没有结果确实无从派生）。 */
  assert.ok(nodeBody.includes('<DerivePort side="input" visible={selected || connectActive}'),
    '左侧**输入**加号必须无条件渲染（它是"上游接进来"的入口，与本框有没有结果无关）');
  assert.ok(nodeBody.includes('{nodeHasResult && <DerivePort visible={selected || connectActive}'),
    '右侧**输出**加号仍然只在结果落框后渲染（没有结果无从派生）');
  assert.ok((nodeBody.match(/<DerivePort/g) || []).length >= 2, '结果节点左右都要有加号（输入锚点 + 输出加号）');
  assert.ok(nodeBody.includes('生成前无加号、生成结果必须有加号'), '必须写明用户决定');
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
