import React from 'react';

/**
 * 提示词 / 面板尺寸冲突提示条 (2026-09-10)
 * 纯展示组件：不发起任何请求，冲突由 detectSizingConflict() 本地算出后传入。
 * 用 createElement 书写（非 JSX），以便 node:test 直接 import 做真实渲染断言。
 * 设计原则：面板是硬参数事实源，这里只把冲突显性化 + 提供一键切换。
 */
const h = React.createElement;

const BOX_STYLE = {
  marginTop: 10,
  padding: '10px 12px',
  borderRadius: 12,
  background: '#FFF8E7',
  border: '1px solid #F3D9A4',
  color: '#7A4E00',
  fontSize: 12,
  lineHeight: 1.6,
  display: 'flex',
  gap: 10,
  alignItems: 'flex-start',
  flexWrap: 'wrap',
};

export function promptSizeConflictText(conflict) {
  if (!conflict) return '';
  const panelText = conflict.panelRatios && conflict.panelRatios.length
    ? conflict.panelRatios.join(' / ')
    : '空';
  const tail = conflict.canApply
    ? `（可把主图类改为 ${conflict.ratio}，详情保持不变）。`
    : '。';
  return `⚠️ 提示词里提到「${conflict.label}」，但当前套图配置是 ${panelText}。系统会按面板配置出图${tail}`;
}

export default function PromptSizeConflictNotice({ conflict, onApply, onDismiss }) {
  if (!conflict) return null;
  const children = [
    h('span', { key: 'text', style: { flex: '1 1 260px' } }, promptSizeConflictText(conflict)),
  ];
  if (conflict.canApply) {
    children.push(h('button', {
      key: 'apply',
      type: 'button',
      className: 'ec-direction-action',
      onClick: () => onApply && onApply(conflict),
    }, `把主图改为 ${conflict.ratio}`));
  }
  children.push(h('button', {
    key: 'dismiss',
    type: 'button',
    className: 'ec-direction-action',
    onClick: () => onDismiss && onDismiss(conflict),
  }, '忽略'));
  return h('div', { role: 'status', 'data-testid': 'prompt-size-conflict', style: BOX_STYLE }, children);
}
