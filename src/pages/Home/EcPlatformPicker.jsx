import React, { useState } from 'react';
import { Settings } from 'lucide-react';

const PLATFORMS = [
  { key: '淘宝', icon: '🟠', desc: '800×800 / 白底+场景' },
  { key: '京东', icon: '🛒', desc: '800×800 / 主图+场景' },
  { key: '拼多多', icon: '🟢', desc: '750×750 / 白底优先' },
  { key: '抖音', icon: '🎵', desc: '800×800 / 竖版适配' },
  { key: '小红书', icon: '📕', desc: '1:1 / 3:4 双比例' },
  { key: '亚马逊', icon: '🌐', desc: '1600×1600 / 白底刚需' },
];

const RATIOS = [
  { key: '1:1', label: '1:1 方形' },
  { key: '3:4', label: '3:4 竖版' },
  { key: '4:3', label: '4:3 横版' },
  { key: '16:9', label: '16:9 宽屏' },
];

const RESOLUTIONS = [
  { key: '1K', label: '1024×1024' },
  { key: '1.5K', label: '1536×1536' },
  { key: '2K', label: '2048×2048' },
];

export default function EcPlatformPicker({ platform, onChange }) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customRatio, setCustomRatio] = useState('1:1');
  const [customRes, setCustomRes] = useState('1K');
  const [customCount, setCustomCount] = useState(5);

  const handleCustomToggle = () => {
    setCustomOpen(!customOpen);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {PLATFORMS.map(p => {
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
                minWidth: 90,
              }}>
              <div>{p.icon} {p.key}</div>
              <div style={{ fontSize: 11, marginTop: 3, opacity: active ? 0.8 : 0.6 }}>{p.desc}</div>
            </div>
          );
        })}
      </div>

      {/* 智能默认 / 自定义切换 */}
      <div style={{
        padding: '10px 14px',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border-light)',
        background: 'rgba(0,0,0,0.02)',
        marginBottom: customOpen ? 10 : 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
            <span style={{ fontSize: 13, marginRight: 6 }}>⚙️</span>
            {customOpen ? '自定义参数' : '智能默认 — 按平台自动适配'}
          </div>
          <div onClick={handleCustomToggle}
            style={{
              fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer',
              padding: '3px 10px', borderRadius: 'var(--radius-sm)',
              background: 'rgba(0,0,0,0.04)',
            }}>
            {customOpen ? '使用智能默认' : '自定义比例'}
          </div>
        </div>

        {customOpen && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12, animation: 'fadeIn 0.15s ease' }}>
            {/* 比例选择 */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>画面比例</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {RATIOS.map(r => {
                  const active = customRatio === r.key;
                  return (
                    <div key={r.key} onClick={() => setCustomRatio(r.key)}
                      style={{
                        padding: '6px 14px', borderRadius: 'var(--radius-sm)',
                        fontSize: 12, cursor: 'pointer',
                        background: active ? 'var(--accent)' : '#fff',
                        color: active ? '#fff' : 'var(--text-secondary)',
                        border: active ? 'none' : '1px solid var(--border)',
                        fontWeight: active ? 600 : 400,
                      }}>
                      {r.label}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 清晰度 */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>清晰度</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {RESOLUTIONS.map(r => {
                  const active = customRes === r.key;
                  return (
                    <div key={r.key} onClick={() => setCustomRes(r.key)}
                      style={{
                        padding: '6px 14px', borderRadius: 'var(--radius-sm)',
                        fontSize: 12, cursor: 'pointer',
                        background: active ? 'var(--accent)' : '#fff',
                        color: active ? '#fff' : 'var(--text-secondary)',
                        border: active ? 'none' : '1px solid var(--border)',
                        fontWeight: active ? 600 : 400,
                      }}>
                      {r.label}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 生成张数 */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>生成张数</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="range" min="1" max="20" value={customCount}
                  onChange={e => setCustomCount(parseInt(e.target.value))}
                  style={{ flex: 1, accentColor: 'var(--accent)' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', minWidth: 24 }}>{customCount}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {!customOpen && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-faint)', padding: '6px 12px', background: 'var(--accent-bg)', borderRadius: 'var(--radius-sm)' }}>
          💡 智能默认按平台规格自动匹配比例和尺寸。点击「自定义比例」可手动调整
        </div>
      )}
    </div>
  );
}
