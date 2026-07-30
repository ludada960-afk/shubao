const UNSAFE_PROVIDER_DETAILS = /(?:api|key|token|authorization|authentication|vision|provider|invalid[_\s-]?request|401|403|\{\s*"?error)/i;

export function toGenerationStatus(task = {}) {
  const state = String(task.status || task.state || '').toLowerCase();
  const raw = String(task.error || task?.output?.errors?.find?.(item => item?.error || item?.message)?.error || '');
  if (state === 'needs_review') {
    return { tone: 'review', title: '需要确认', detail: '这张图片未达到交付标准，未扣除本次积分。你可以查看结果后重试或保留为素材。', retryable: true, action: 'retry' };
  }
  if (UNSAFE_PROVIDER_DETAILS.test(raw) || state === 'failed') {
    return { tone: 'error', title: '暂时无法生成', detail: '视觉服务暂时不可用，未扣除本次积分，请稍后重试。', retryable: true, action: 'retry' };
  }
  if (state === 'completed') return { tone: 'success', title: '已完成', detail: '图片已保存到作品与画布。', retryable: false, action: 'open' };
  return { tone: 'progress', title: '正在生成', detail: '可离开当前页面，完成后会保存到作品。', retryable: false, action: 'wait' };
}
