// test/workflow-template-billing-copy-0913.test.mjs
// 2026-09-13 用户批注（关键澄清）：模板是「铺开 = 只把节点放到画布」；
//   **真正的收费发生在用户在画布上点生成时**，与普通创作同一条计费链路 —— 不需要另定免费规则。
// 原文案「P3 前不可扣费运行」把「不能运行」写成了「不可扣费」，容易读成有免费额度，必须改掉。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('模板库文案：不说“不可扣费”，并明说铺开不产生费用、生成时计费', () => {
  const gallery = read('src/pages/EcCanvas/WorkflowTemplateGallery.jsx');
  assert.ok(!gallery.includes('不可扣费运行'), '不得再出现“不可扣费运行”这种误导文案');
  assert.ok(gallery.includes('待 P3 · 暂不可运行'), 'P3 模板说明“暂不可运行”');
  assert.ok(gallery.includes('铺开只放节点、不产生费用；生成时按目录计费'), '全表统一口径');
});

test('画布内铺开提示：能运行才给运行按钮，且显示预计积分', () => {
  const canvas = read('src/pages/EcCanvas/index.jsx');
  assert.ok(/<span className="ec-canvas-workflow-offer__cost">预计 \{workflowRunOffer\.estimatedUnits\} 积分<\/span>/.test(canvas), '常规模板显示预计积分');
  assert.ok(canvas.includes('能力接入中，暂不可运行（未运行即不产生费用）'), 'P3 模板说明未运行即不产生费用');
  assert.ok(/!workflowRunOffer\.requiresAudioVideo && \(/.test(canvas), '只有可运行的模板才给运行按钮');
});
