/**
 * 读图解析进度模块
 *
 * 展示读图到解析的 5 个细分阶段：
 *   uploading → cropping → feature_extraction → style_analysis → parameter_adaptation
 * 每个阶段有独立状态反馈。
 */

import React from 'react';
import { CheckCircle, Loader, AlertCircle } from 'lucide-react';

const STAGES = [
  { key: 'uploading',       label: '上传图片',     icon: '📤' },
  { key: 'cropping',        label: '智能裁剪降噪', icon: '✂️' },
  { key: 'feature_extraction', label: '特征提取', icon: '🔍' },
  { key: 'style_analysis',  label: '光影/构图/色彩解析', icon: '🎨' },
  { key: 'parameter_adaptation', label: '参数适配', icon: '⚙️' },
];

export default function ReadProgress({ currentStage, error }) {
  const currentIdx = STAGES.findIndex(s => s.key === currentStage);

  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
        📖 读图解析
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {STAGES.map((s, i) => {
          const isDone = currentIdx > i;
          const isCurrent = currentIdx === i;
          const isError = error && isCurrent;

          return (
            <div key={s.key} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '6px 10px', borderRadius: 8,
              background: isCurrent ? 'rgba(99,102,241,0.06)' : 'transparent',
              transition: 'all 0.2s',
            }}>
              {/* 状态图标 */}
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                background: isError ? 'rgba(232,84,75,0.12)' :
                            isDone ? 'rgba(92,168,108,0.12)' :
                            isCurrent ? 'rgba(99,102,241,0.12)' : 'rgba(0,0,0,0.04)',
              }}>
                {isError ? <AlertCircle size={12} color="#E8544B" /> :
                 isDone ? <CheckCircle size={12} color="#5CA86C" /> :
                 isCurrent ? <Loader size={12} color="#6366F1" className="animate-spin" /> :
                 <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{i + 1}</span>}
              </div>

              {/* 阶段名 */}
              <span style={{
                flex: 1, fontSize: 12, fontWeight: isCurrent ? 600 : 500,
                color: isError ? 'var(--red)' :
                       isDone ? 'var(--text-muted)' :
                       isCurrent ? 'var(--accent)' : 'var(--text-faint)',
              }}>
                {s.icon} {s.label}
              </span>

              {/* 状态文字 */}
              <span style={{
                fontSize: 10, fontWeight: 600,
                color: isError ? 'var(--red)' :
                       isDone ? '#5CA86C' :
                       isCurrent ? '#6366F1' : 'transparent',
              }}>
                {isError ? '失败' : isDone ? '完成' : isCurrent ? '进行中' : ''}
              </span>
            </div>
          );
        })}
      </div>
      {error && (
        <div style={{
          marginTop: 8, padding: '8px 12px', borderRadius: 8,
          background: '#FEF2F0', fontSize: 11, color: 'var(--red)',
          lineHeight: 1.5, fontWeight: 500,
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
