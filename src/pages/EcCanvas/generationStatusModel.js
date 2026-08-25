const UNSAFE_PROVIDER_DETAILS = /(?:api|key|token|authorization|authentication|vision|provider|invalid[_\s-]?request|401|403|\{\s*"?error)/i;

const BUSY_CODES = new Set([
  'NANO_BANANA_TIMEOUT',
  'NANO_BANANA_PROVIDER_BUSY',
  'PROVIDER_NETWORK_ERROR',
  'PROVIDER_POLL_TIMEOUT',
  'VISUAL_ANALYSIS_TIMEOUT',
  'VISUAL_ANALYSIS_UNAVAILABLE',
]);

function firstErrorDetail(task = {}) {
  const errors = task?.output?.errors || task?.errors || [];
  const detail = Array.isArray(errors) ? errors.find(item => item && typeof item === 'object') || {} : {};
  return {
    ...detail,
    code: String(detail.code || task?.code || '').trim(),
    status: Number.isInteger(detail.status) ? detail.status : undefined,
    required: Number.isSafeInteger(detail.required) ? detail.required : undefined,
    available: Number.isSafeInteger(detail.available) ? detail.available : undefined,
  };
}

function rawMessage(task = {}) {
  return String(task.error
    || task?.output?.errors?.find?.(item => item?.error || item?.message)?.error
    || '').trim();
}

function hasDeliveredImages(task = {}) {
  if (Number.isSafeInteger(task?.progress?.completed) && task.progress.completed > 0) return true;
  const images = task?.output?.images;
  return Boolean(images && typeof images === 'object' && Object.values(images).some(Boolean));
}

export function toGenerationStatus(task = {}) {
  const state = String(task.status || task.state || '').toLowerCase();
  const raw = rawMessage(task);
  const detail = firstErrorDetail(task);
  if (state === 'needs_review') {
    return { tone: 'review', title: '图片待补全', detail: '可用结果已经保留，你可以继续补全这张图片。', retryable: true, action: 'retry' };
  }
  // 失败/取消按真实原因分类，避免所有失败都被笼统说成“视觉服务不可用”。
  if (detail.code === 'BILLING_INSUFFICIENT_CREDITS' || detail.status === 402 || state === 'failed' && /积分不足/.test(raw)) {
    const need = Number.isSafeInteger(detail.required) ? detail.required : null;
    const have = Number.isSafeInteger(detail.available) ? detail.available : null;
    const balance = need !== null && have !== null ? `本次需要 ${need} 积分，当前可用 ${have}。` : '';
    return { tone: 'error', title: 'AI 积分不足', detail: `未完成图片未计费。${balance}充值后即可重新生成。`, retryable: true, action: 'retry' };
  }
  if (detail.reQuoteRequired === true || detail.code === 'BILLING_QUOTE_REQUIRED') {
    return { tone: 'error', title: '费用确认已过期', detail: '生成费用报价已过期或与方案不一致，请重新确认费用后再生成。', retryable: true, action: 'retry' };
  }
  if (state === 'failed' || state === 'cancelled') {
    const delivered = hasDeliveredImages(task);
    const charged = delivered ? '已完成的图片正常计费并保留；' : '';
    if (state === 'cancelled') {
      return { tone: 'neutral', title: '任务已停止', detail: `本次生成已停止，${charged}未完成图片不会计费。`, retryable: true, action: 'retry' };
    }
    if (BUSY_CODES.has(detail.code) || detail.retryable === true) {
      return { tone: 'error', title: '生成服务繁忙', detail: `图片服务暂时繁忙或超时，已自动重试仍未完成。${charged}未完成图片未计费，请稍后重试。`, retryable: true, action: 'retry' };
    }
    if (UNSAFE_PROVIDER_DETAILS.test(raw)) {
      return { tone: 'error', title: '暂时无法生成', detail: `图片服务暂时不可用。${charged}未完成图片未计费，请稍后重试。`, retryable: true, action: 'retry' };
    }
    const reason = raw || '本轮套图未能完成';
    return { tone: 'error', title: '暂时无法生成', detail: `${reason}${charged ? `（${charged}）` : ''}，请重试未完成的图片。`, retryable: true, action: 'retry' };
  }
  if (state === 'completed') return { tone: 'success', title: '已完成', detail: '图片已保存到作品与画布。', retryable: false, action: 'open' };
  return { tone: 'progress', title: '正在生成', detail: '可离开当前页面，完成后会保存到作品。', retryable: false, action: 'wait' };
}
