import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildPlanPreviewRequest,
  createPlanPreviewService,
  normalizePlanPreview,
  normalizeSafety,
  safetyBlockedReason,
} from '../server/planPreview.mjs';

/* ═══ 2026-09-24 批 BA：内容检测第二阶段 · **顺带判定**（docs/design/75 §三.1）═════════════════════
   用户口径（原话）：
     「内容检测的话，**为什么还要重新花钱呢**，用户上传素材和提示词不是本来就要识别一次吗，
       为什么我们还要再识别一次呢？**没有低成本的过滤方案吗**」
     「而且有这种内容肯定是要**直接拒**的」
   ⇒ 这一层**不新开一次审核调用**：站内「生成预览 / 代为撰写」本来就要调一次 LLM，
     在那份 JSON 里**多要一个 safety 字段**，把"顺带判定"的结论拿回来 —— 成本 0。
   判据五条（每条都对应一个"不守就会静默放过去"的坑）：
     ① 字段真的进了**给模型的 schema**（不是只在解析端等一个永远不会来的字段）；
     ② 三态：`ok:true` / `ok:false` / **没答（null）** —— 没答不许当成"审核通过"；
     ③ `ok:false` ⇒ 这次**不出方案**（走降级那条路，路由对降级**不扣费**）、提示词清空、
        原因写清类别；
     ④ 界面：内容不合规时**不给「跳过方案，直接生成」**（那是把刚被判违规的内容送出去）；
     ⑤ 边界：这一层只判**显式违规**（与本地词表同一口径），拿不准就放行 ——
        真正的召回靠本地闸门（第一阶段）+ 上游拒绝翻译（批 BA 的另一条）。 */

const source = path => readFile(new URL(path, import.meta.url), 'utf8');

test('① 判定字段真的进了给模型的 schema，且写清了「只判显式、拿不准放行」的口径', () => {
  const request = buildPlanPreviewRequest({ surface: 'video', prompt: '给这个产品做一条口播' });
  assert.match(request.systemPrompt, /"safety": \{ "ok": true, "categories": \[\] \}/,
    'schema 里必须有 safety 字段（否则这一层只是在解析端等一个永远不会来的字段）');
  assert.match(request.systemPrompt, /只判显式/, '判定口径要写清：只判显式违规');
  assert.match(request.systemPrompt, /色情低俗/, '类别口径与第一阶段同一份（五类）');
  assert.match(request.systemPrompt, /内衣、泳装、美妆/, '正常商业表达不算违规（误判会把正常用户挡在门外）');
});

test('② 三态：true / false / **没答（null）** —— 没答不许当成"审核通过"', () => {
  assert.deepEqual(normalizeSafety({ ok: true }), { ok: true, categories: [] });
  assert.deepEqual(normalizeSafety({ ok: false, categories: ['色情低俗'] }), { ok: false, categories: ['色情低俗'] });
  assert.deepEqual(normalizeSafety(undefined), { ok: null, categories: [] }, '模型没答这个字段 ⇒ null（"这次没判"）');
  assert.deepEqual(normalizeSafety({}), { ok: null, categories: [] });
  assert.deepEqual(normalizeSafety({ ok: 'false' }), { ok: null, categories: [] }, '字符串不算布尔');
  assert.equal(normalizePlanPreview({ plan: { promptText: 'x' } }).safety.ok, null, '整条方案没带 safety ⇒ null');
});

test('③ 判为不合规 ⇒ 不出方案 + 提示词清空 + 原因写清类别（且走**降级**那条不扣费的路）', async () => {
  const service = createPlanPreviewService({
    completeText: async () => JSON.stringify({
      safety: { ok: false, categories: ['色情低俗'] },
      materials: [],
      plan: { title: '不该出现的方案', summary: '违规方案', promptText: '一段违规的图片提示词', steps: [], notes: [] },
    }),
  });
  const composed = await service.compose({ surface: 'image', prompt: '违规素材' });
  assert.equal(composed.safety.ok, false);
  assert.equal(composed.blocked, true, '要能被识别成"这一次是被内容闸门拦下的"');
  assert.equal(composed.degraded, true, '必须走降级那条路 —— 路由对降级结果**不扣费**（billing.charged=false）');
  assert.equal(composed.plan.promptText, '', '违规的提示词不许留在用户手里（那是"直接把违禁品递过去"）');
  assert.match(composed.reason, /色情低俗/, '原因要写清是哪一类，用户才知道改哪里');
  assert.match(composed.reason, /请更换后重试/);
  assert.equal(safetyBlockedReason({ categories: [] }), '这段需求或素材未通过内容规范检查，请更换后重试');
});

test('③b 判为合规 / 没答 ⇒ 方案原样返回（不许因为"多要了一个字段"改变正常路径）', async () => {
  const okService = createPlanPreviewService({
    completeText: async () => JSON.stringify({
      safety: { ok: true, categories: [] },
      materials: [],
      plan: { title: '正常方案', summary: '正常', promptText: '一段可以用的提示词', steps: [], notes: [] },
    }),
  });
  const ok = await okService.compose({ surface: 'image', prompt: '正常需求' });
  assert.equal(ok.safety.ok, true);
  assert.equal(ok.degraded, false, '合规就不是降级（照旧计费、照旧可用）');
  assert.equal(ok.plan.promptText, '一段可以用的提示词');

  const silentService = createPlanPreviewService({
    completeText: async () => JSON.stringify({
      materials: [],
      plan: { title: '正常方案', summary: '正常', promptText: '一段可以用的提示词', steps: [], notes: [] },
    }),
  });
  const silent = await silentService.compose({ surface: 'image', prompt: '正常需求' });
  assert.equal(silent.safety.ok, null, '模型没答 ⇒ null');
  assert.equal(silent.blocked, undefined, '**没答不等于违规**（不许拿"没判"当拒绝理由）');
  assert.equal(silent.degraded, false);
});

test('④ 界面：内容不合规时不给「跳过方案，直接生成」，模型不可用时照旧给', async () => {
  const dialog = await source('../src/components/plan-preview/PlanPreviewDialog.jsx');
  assert.match(dialog, /plan\?\.safety\?\.ok === false/,
    '界面要能分出"被判违规"与"模型不可用"两种降级');
  assert.match(dialog, /plan\?\.safety\?\.ok === false\s*\n\s*\?[\s\S]{0,120}关闭/,
    '被判违规时那颗主按钮只能是关闭');
  assert.match(dialog, /跳过方案，直接生成/, '模型不可用那条路一个字没变（仍给"跳过方案直接生成"）');
});

test('⑤ 边界：这一层不新增调用（服务只接受既有的 completeText），也不假装覆盖图片分级', async () => {
  const module = await source('../server/planPreview.mjs');
  /* 只多要一个字段：调用参数没多、没多一次请求 */
  const composeBody = module.slice(module.indexOf('async compose(input = {})'));
  assert.equal((composeBody.slice(0, 1400).match(/completeText\(/g) || []).length, 1,
    '一次 compose 只调一次模型（"顺带判定"的全部意义就在这里）');
  assert.match(module, /不是"全面检测"/, '边界要写在文件里：这一层只是顺带判定，不吹成全面检测');
});
