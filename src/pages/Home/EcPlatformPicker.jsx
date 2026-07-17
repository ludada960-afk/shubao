import React from 'react';

export default function EcPlatformPicker({ platform, onChange }) {
  const platforms = [
    { key: '淘宝', icon: '🟠', desc: '800×800 / 白底+场景' },
    { key: '京东', icon: '🛒', desc: '800×800 / 主图+场景' },
    { key: '拼多多', icon: '🟢', desc: '750×750 / 白底优先' },
    { key: '抖音', icon: '🎵', desc: '800×800 / 竖版适配' },
    { key: '小红书', icon: '📕', desc: '1:1 / 3:4 双比例' },
    { key: '亚马逊', icon: '🌐', desc: '1600×1600 / 白底刚需' },
  ];

  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.6 }}>
        直接复用内置的各平台默认尺寸参数，无需重新配置
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {platforms.map(p => {
          const active = platform === p.key;
          return (
            <div key={p.key}
              onClick={() => onChange(p.key)}
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer', transition: 'all 0.15s',
                background: active ? 'var(--accent)' : 'rgba(255,255,255,0.7)',
                color: active ? '#fff' : 'var(--text-secondary)',
                border: active ? 'none' : '1px solid var(--border)',
                fontSize: 13, fontWeight: active ? 600 : 450,
                minWidth: 100,
              }}>
              <div>{p.icon} {p.key}</div>
              <div style={{
                fontSize: 11, marginTop: 3,
                opacity: active ? 0.8 : 0.6,
              }}>{p.desc}</div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-faint)', padding: '8px 12px', background: 'var(--accent-bg)', borderRadius: 'var(--radius-sm)' }}>
        💡 平台决定输出图片的尺寸标准。比例/分辨率/白底要求等参数自动适配，无需手动填写
      </div>
    </div>
  );
}
