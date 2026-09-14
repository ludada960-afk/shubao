/* 视频测试共用：方案闸门注入（2026-09-18 总统筹拍板）
 *
 * createJob 现在要求 videoPlan + planConfirmed:true（服务端硬校验，见
 * server/videoPlanCompiler.mjs assertVideoPlanConfirmed）。这是**正确**的业务要求，
 * 但大量既有用例写于"方案还不是必填"的年代 —— 它们测的是计费/投递/重试，
 * 不是方案本身。所以统一由本 helper 给这些用例补一份已确认方案，
 * 让它们继续聚焦原本的断言；闸门本身由 video-plan-billing-chain-0918 专测。 */
export const CONFIRMED_TEST_PLAN = Object.freeze({
  summary: '测试方案',
  creativeStrategy: '按测试节奏',
  beats: [
    { time: '0-2s', label: '开场', detail: '主体入画' },
    { time: '2-5s', label: '展开', detail: '细节展示' },
    { time: '5-8s', label: '收尾', detail: '定格' },
  ],
  risks: ['不要出现测试用占位文字'],
  optimizedPrompt: '测试用可执行提示词',
});

/** 包一层：任何 createJob 调用自动带上已确认方案 */
export function withConfirmedPlan(service) {
  const original = service.createJob.bind(service);
  service.createJob = (params = {}) => original({
    ...params,
    input: { videoPlan: CONFIRMED_TEST_PLAN, planConfirmed: true, ...(params.input || {}) },
  });
  return service;
}
