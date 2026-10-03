// test/provider-model-unavailable-overflow-1004.test.mjs
// 门禁：主通道「没有这个模型 / 这个分组没权限」时，必须切到兜底（2026-10-04）
// ─────────────────────────────────────────────────────────────────────────────
// 生产实测（65535 + `image2-5-sunburst`），两条**真实**回复：
//   · 403 {"message":"group \"任务专用分组\" not authorized for model image2-5-sunburst"}
//   · 503 {"detail":"No available channel for model image2-5-sunburst under group default"}
//
// 原来 `canOverflow` 只认 PROVIDER_NETWORK_ERROR，而上面两条经 providerError 落成
// PROVIDER_ERROR（403 甚至 retryable:false）⇒ **都不切兜底**。
// ⇒ 把 IP233 接成兜底之后，2.5 这条路实际上一根手指都没够着：
//   用户看到的还是「生成不出来」，而我们以为已经修好了。
//
// 这条门禁钉住：403 / 503 这两种"主通道自己没有这个模型"要切；
// 429（限速）**不许**切（既有 ecommerce-provider-router 那条守的就是不绕过限速）
// 用户自己的问题（400 参数错、内容被拒）**不许**切（备用那边同样会失败，
// 切过去只是白跑一趟 + 多一次上游请求；内容拒单尤其不能切）。
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';

import { createProviderRouter } from '../server/ecommerceEngine/providerRouter.mjs';

function adapter({ submit, poll }) {
  return {
    submitEdit: submit,
    poll: poll || (async jobId => ({ jobId, status: 'completed', outputUrl: `https://cdn.test/${jobId}.png` })),
    pollUntilReady: async jobId => (poll || (async id => ({ jobId: id, status: 'completed' })))(jobId),
  };
}

/** 主通道抛这个错，兜底记录自己被调过没有。 */
function routerThatFailsPrimaryWith(error) {
  const calls = [];
  const router = createProviderRouter({
    primary: adapter({ submit: async () => { calls.push('primary'); throw error; } }),
    overflow: adapter({ submit: async () => { calls.push('overflow'); return { jobId: 'backup-1', status: 'queued' }; } }),
  });
  return { router, calls };
}

/* ── 该切的：主通道自己"没有这个模型 / 分组没权限" ── */

test('① 503「无可用渠道」要切兜底（用户反馈里那条原文）', async () => {
  const { router, calls } = routerThatFailsPrimaryWith(Object.assign(
    new Error('No available channel for model image2-5-sunburst under group default (distributor)'),
    { code: 'PROVIDER_ERROR', status: 503, retryable: true },
  ));
  assert.deepEqual(await router.submitEdit({}), { jobId: 'overflow:backup-1', status: 'queued' });
  assert.deepEqual(calls, ['primary', 'overflow']);
});

test('② 403「分组无权用这个模型」要切兜底（2026-10-04 生产实测的那条）', async () => {
  /* ⚠️ 注意这条 retryable 是 **false** —— 原判据第二个条件就过不去。
     「这个分组没这个模型的权限」不是"可以重试"，是"换一个地方去"，
     所以不能拿 retryable 当闸门。 */
  const { router, calls } = routerThatFailsPrimaryWith(Object.assign(
    new Error('group "任务专用分组" not authorized for model image2-5-sunburst'),
    { code: 'PROVIDER_ERROR', status: 403, retryable: false },
  ));
  assert.deepEqual(await router.submitEdit({}), { jobId: 'overflow:backup-1', status: 'queued' });
  assert.deepEqual(calls, ['primary', 'overflow']);
});

test('③ 中文说法同样认（供应商换壳子换了语言，不能只匹配英文）', async () => {
  for (const detail of ['无可用渠道', '无权使用该模型', 'model gpt-image-2.5 not found']) {
    const { router, calls } = routerThatFailsPrimaryWith(
      Object.assign(new Error(detail), { code: 'PROVIDER_ERROR', status: 503 }),
    );
    await router.submitEdit({});
    assert.deepEqual(calls, ['primary', 'overflow'], `「${detail}」应当切兜底`);
  }
});

/* ── 不该切的：切过去只会白跑一趟 ── */

test('④ 429 限速**不许**切（绕过供应商限速是既有门禁明确禁止的）', async () => {
  const { router, calls } = routerThatFailsPrimaryWith(Object.assign(
    new Error('slow down'), { status: 429, code: 'PROVIDER_ERROR', retryable: true },
  ));
  await assert.rejects(() => router.submitEdit({}), /slow down/);
  assert.deepEqual(calls, ['primary'], '一次上游请求都不该多发');
});

test('⑤ 内容被拒**不许**切（用户原话：「为什么还要重新花钱呢」）', async () => {
  const { router, calls } = routerThatFailsPrimaryWith(Object.assign(
    new Error('内容不符合规范'), { code: 'CONTENT_REJECTED', status: 400, retryable: false },
  ));
  await assert.rejects(() => router.submitEdit({}), /内容不符合规范/);
  assert.deepEqual(calls, ['primary'], '内容拒单在备用那边同样会失败，不该再花一次');
});

test('⑥ 一般的 4xx（参数错）**不许**切：备用那边也会同样报错', async () => {
  const { router, calls } = routerThatFailsPrimaryWith(Object.assign(
    new Error('invalid parameter: size'), { code: 'PROVIDER_ERROR', status: 400, retryable: false },
  ));
  await assert.rejects(() => router.submitEdit({}), /invalid parameter/);
  assert.deepEqual(calls, ['primary']);
});

test('⑦ 已经受理过的（有 jobId）**绝不**二次提交：会重复出图 + 重复扣费', async () => {
  const { router, calls } = routerThatFailsPrimaryWith(Object.assign(
    /* 连 detail 都写着「无可用渠道」—— 也不能切，因为上游**已经受理**了 */
    new Error('No available channel for model X, retry later'),
    { code: 'PROVIDER_ERROR', status: 503, retryable: true, jobId: 'accepted-1' },
  ));
  await assert.rejects(() => router.submitEdit({}), /No available channel/);
  assert.deepEqual(calls, ['primary'], '受理过的单子换供应商重投 = 两张图、两次扣费');
});

test('⑧ 兜底自己也失败时，抛的是**兜底**那条错（最后发生的事就是真相）', async () => {
  /* 口径说明：这里不吞掉兜底的错。理由是"最后真正发生的事"才是真相 ——
     把主通道那条「分组无权」抛给用户会让人以为主通道坏了，而实际两条路都坏了。
     代价是丢掉了"两条都试过"这层诊断，所以路由层保留 console.warn 记录两边详情。 */
  const router = createProviderRouter({
    primary: adapter({ submit: async () => { throw Object.assign(new Error('group not authorized for model X'), { code: 'PROVIDER_ERROR', status: 403 }); } }),
    overflow: adapter({ submit: async () => { throw Object.assign(new Error('backup has no key'), { code: 'PROVIDER_ERROR', status: 401 }); } }),
  });
  await assert.rejects(() => router.submitEdit({}), /backup has no key/);
});