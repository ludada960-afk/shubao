// 4c183cd4 续命 P-F 中文 AI 合规水印 — 薯包独门 2/3
// 3 强制法律勾选 UI 组件 (用户原话: "3 强制法律勾选")
//
// 法律依据 (见 server/components/aiCompliance.mjs):
//   1. 《生成式人工智能服务管理暂行办法》(2023-08-15)
//   2. 《互联网信息服务深度合成管理规定》(2023-01-10)
//   3. 《人工智能生成合成内容标识办法 (征求意见稿)》(2024-08)
//
// 用法:
//   <AIComplianceWatermark
//     value={compliance}                     // { generative_ai_interim, deep_synthesis, content_labeling }
//     onChange={setCompliance}               // (next) => void
//     onAllChecked={(v) => ...}              // (allChecked) => void
//     compact={false}                        // true = 仅展示 3 行 + 状态, 不展开
//     disabled={false}                       // 只读
//     error={null}                           // null | string
//   />
//
// 行为:
//   - 任一未勾选 = 阻断孪生体/tts/vision/chain 出件 (与 server 端 evaluateChineseAiCompliance 一致)
//   - 用户在勾选时会即时回调 onChange + onAllChecked, 用于门禁闸门
//   - 任一项变更会重新计算全选状态, 用于驱动上层按钮 disabled
//   - compact 模式只读展示, 用于历史 / 审计面板
//
// 不做的事:
//   - 不直接调任何孪生/tts/vision API (server 端 evaluateChineseAiCompliance 才是法律门禁)
//   - 不写 cookie / localStorage (3 法律勾选必须每次显式确认, 不缓存)
//   - 不做用户身份识别 (登录态由上层容器管)

import React, { useCallback, useEffect, useMemo, useState } from 'react';

const BASE_STYLE = {
  border: '1px solid rgba(190, 24, 93, 0.18)',
  borderRadius: 10,
  background: 'linear-gradient(135deg, rgba(254, 242, 242, 0.95), rgba(255, 247, 237, 0.95))',
  padding: '12px 14px',
  color: '#7c2d12',
  fontFamily: 'inherit',
  fontSize: 13,
  lineHeight: 1.55,
};

const HEADER_STYLE = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 8,
  fontWeight: 700,
  fontSize: 13.5,
  color: '#9f1239',
};

const ROW_STYLE = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  marginTop: 6,
  padding: '6px 8px',
  borderRadius: 6,
  background: 'rgba(255, 255, 255, 0.7)',
  border: '1px solid rgba(190, 24, 93, 0.08)',
};

const LABEL_STYLE = {
  display: 'block',
  cursor: 'pointer',
  userSelect: 'none',
  flex: 1,
};

const CHECK_STYLE = {
  marginTop: 2,
  flexShrink: 0,
};

const COMPACT_ROW_STYLE = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 12,
  color: '#7c2d12',
  marginTop: 4,
};

const STATUS_PILL_BASE = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 8px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

const STATUS_OK = Object.assign({}, STATUS_PILL_BASE, {
  background: 'rgba(16, 185, 129, 0.15)',
  color: '#047857',
  border: '1px solid rgba(16, 185, 129, 0.3)',
});

const STATUS_FAIL = Object.assign({}, STATUS_PILL_BASE, {
  background: 'rgba(244, 63, 94, 0.12)',
  color: '#9f1239',
  border: '1px solid rgba(244, 63, 94, 0.3)',
});

const ERR_STYLE = {
  marginTop: 8,
  fontSize: 12,
  color: '#9f1239',
  fontWeight: 600,
};

// 3 强制法律 UI 元数据 (跟 server/components/aiCompliance.mjs 镜像)
const COMPLIANCE_LEGALS = [
  {
    key: 'generative_ai_interim',
    shortName: '生成式 AI 暂行办法',
    authority: '国家网信办等 7 部门',
    effectiveDate: '2023-08-15 施行',
    userLabel: '我已阅读并同意《生成式人工智能服务管理暂行办法》, 确认 AI 生成内容已显著标识, 不会用于违法违规用途',
  },
  {
    key: 'deep_synthesis',
    shortName: '深度合成管理规定',
    authority: '国家网信办 / 工信部 / 公安部',
    effectiveDate: '2023-01-10 施行',
    userLabel: '我已阅读并同意《互联网信息服务深度合成管理规定》, 确认深度合成内容已显著标识, 已建立内容审核',
  },
  {
    key: 'content_labeling',
    shortName: 'AI 生成内容标识办法',
    authority: '国家网信办',
    effectiveDate: '2024-08 公开征求意见',
    userLabel: '我已阅读并同意《人工智能生成合成内容标识办法》, 同意显式 + 隐式双重水印, 同意服务方保存生成元数据',
  },
];

// 计算全选状态
function isAllChecked(compliance) {
  if (!compliance) return false;
  return COMPLIANCE_LEGALS.every(l => compliance[l.key] === true);
}

function isAnyChecked(compliance) {
  if (!compliance) return false;
  return COMPLIANCE_LEGALS.some(l => compliance[l.key] === true);
}

export default function AIComplianceWatermark({
  value = null,
  onChange = null,
  onAllChecked = null,
  compact = false,
  disabled = false,
  error = null,
  testId = 'ai-compliance-watermark',
}) {
  const safeValue = useMemo(() => {
    const v = value && typeof value === 'object' ? value : {};
    const out = {};
    for (const l of COMPLIANCE_LEGALS) out[l.key] = v[l.key] === true;
    return out;
  }, [value]);

  const allChecked = isAllChecked(safeValue);
  const anyChecked = isAnyChecked(safeValue);

  // 同步通知 onAllChecked
  useEffect(() => {
    if (typeof onAllChecked === 'function') {
      onAllChecked(allChecked);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allChecked]);

  const handleToggle = useCallback((key, next) => {
    if (disabled) return;
    const updated = Object.assign({}, safeValue, { [key]: next });
    if (typeof onChange === 'function') onChange(updated);
  }, [safeValue, onChange, disabled]);

  // compact 模式: 仅 3 行状态 + 摘要
  if (compact) {
    return (
      <div className="ec-ai-compliance-watermark ec-ai-compliance-watermark--compact" data-testid={testId + '-compact'}>
        <div style={COMPACT_ROW_STYLE}>
          <span style={allChecked ? STATUS_OK : STATUS_FAIL}>
            {allChecked ? '✓ 已确认 3 强制法律' : '⚠ 3 强制法律未全选'}
          </span>
          <span style={{ color: '#9f1239', fontSize: 11 }}>
            ({COMPLIANCE_LEGALS.filter(l => safeValue[l.key]).length} / {COMPLIANCE_LEGALS.length})
          </span>
        </div>
      </div>
    );
  }

  return (
    <section
      className="ec-ai-compliance-watermark"
      data-testid={testId}
      data-all-checked={allChecked ? 'true' : 'false'}
      data-any-checked={anyChecked ? 'true' : 'false'}
      style={BASE_STYLE}
    >
      <header style={HEADER_STYLE}>
        <span aria-hidden="true">⚖️</span>
        <span>中国大陆 AI 服务 3 强制法律勾选</span>
        <span style={allChecked ? STATUS_OK : STATUS_FAIL}>
          {allChecked ? '✓ 已全选' : '未全选 — 阻断出件'}
        </span>
      </header>

      <p style={{ margin: '4px 0 6px', fontSize: 12, color: '#7c2d12' }}>
        面向中国大陆用户出件前必须显式勾选 3 项 AI 合规法律; 任一未勾选 = 拒绝出件 (HTTP 451).
      </p>

      <div>
        {COMPLIANCE_LEGALS.map((legal) => {
          const checked = !!safeValue[legal.key];
          return (
            <div key={legal.key} style={ROW_STYLE} data-testid={testId + '-' + legal.key}>
              <input
                type="checkbox"
                id={testId + '-' + legal.key + '-input'}
                style={CHECK_STYLE}
                checked={checked}
                disabled={disabled}
                onChange={(e) => handleToggle(legal.key, e.target.checked)}
                aria-label={legal.userLabel}
              />
              <label htmlFor={testId + '-' + legal.key + '-input'} style={LABEL_STYLE}>
                <div style={{ fontWeight: 600, fontSize: 12.5 }}>{legal.shortName}</div>
                <div style={{ fontSize: 11, color: '#9f1239', marginTop: 1 }}>
                  {legal.authority} · {legal.effectiveDate}
                </div>
                <div style={{ fontSize: 12, marginTop: 2, color: '#444' }}>
                  {legal.userLabel}
                </div>
              </label>
            </div>
          );
        })}
      </div>

      {error ? (
        <div role="alert" style={ERR_STYLE}>
          {error}
        </div>
      ) : null}

      <div style={{ marginTop: 8, fontSize: 11, color: '#9f1239' }}>
        数据回流画布: 完成勾选后, 这 3 项勾选状态会进入孪生体审计 trail (server.twin.api.execute 返回 auditTrail),
        供后续责任追溯与监管报告使用.
      </div>
    </section>
  );
}

// 工具导出 (供其他组件 / 测试复用)
export { COMPLIANCE_LEGALS, isAllChecked, isAnyChecked };
