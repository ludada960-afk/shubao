import React, { useState } from 'react';
import { MdFlashOn, MdCheck, MdInfoOutline } from 'react-icons/md';

/* ═══════ 平台默认套餐 ═══════ */
const PLATFORM_DEFAULTS = {
  smart: {
    name: '智能推荐',
    desc: 'AI 根据产品自动选择最佳平台和套餐',
    icon: '🤖',
    images: [
      { key: 'white_bg', count: 1, ratio: '1:1', size: '800×800', label: '白底主图', emoji: '⬜' },
      { key: 'main_text', count: 5, ratio: '1:1', size: '1440×1440', label: '主图 1:1', emoji: '🖼️' },
      { key: 'main_3x4', count: 5, ratio: '3:4', size: '1440×1920', label: '主图 3:4', emoji: '📱' },
      { key: 'transparent', count: 1, ratio: '1:1', size: '800×800', label: '透明PNG', emoji: '🔲' },
      { key: 'detail', count: 6, ratio: '3:4', size: '1440宽', label: '详情切片', emoji: '📋' },
    ],
  },
  '淘宝': {
    name: '淘宝/天猫',
    desc: '首图1440×1440，品质优先，可含促销文字',
    icon: '🟠',
    images: [
      { key: 'white_bg', count: 1, ratio: '1:1', size: '800×800', label: '白底主图', emoji: '⬜' },
      { key: 'main_text', count: 5, ratio: '1:1', size: '1440×1440', label: '主图 1:1', emoji: '🖼️' },
      { key: 'main_3x4', count: 5, ratio: '3:4', size: '1440×1920', label: '主图 3:4', emoji: '📱' },
      { key: 'transparent', count: 1, ratio: '1:1', size: '800×800', label: '透明PNG', emoji: '🔲' },
      { key: 'detail', count: 6, ratio: '3:4', size: '1440宽', label: '详情切片', emoji: '📋' },
    ],
  },
  '京东': {
    name: '京东',
    desc: '品质优先，主图1440×1440',
    icon: '🔴',
    images: [
      { key: 'white_bg', count: 1, ratio: '1:1', size: '800×800', label: '白底主图', emoji: '⬜' },
      { key: 'main_text', count: 5, ratio: '1:1', size: '1440×1440', label: '主图 1:1', emoji: '🖼️' },
      { key: 'main_3x4', count: 5, ratio: '3:4', size: '1440×1920', label: '主图 3:4', emoji: '📱' },
      { key: 'transparent', count: 1, ratio: '1:1', size: '800×800', label: '透明PNG', emoji: '🔲' },
      { key: 'detail', count: 6, ratio: '3:4', size: '1440宽', label: '详情切片', emoji: '📋' },
    ],
  },
  '拼多多': {
    name: '拼多多',
    desc: '可含促销文字，性价比风格',
    icon: '🟢',
    images: [
      { key: 'main_text', count: 5, ratio: '1:1', size: '1440×1440', label: '主图 1:1', emoji: '🖼️' },
      { key: 'main_3x4', count: 5, ratio: '3:4', size: '1440×1920', label: '主图 3:4', emoji: '📱' },
      { key: 'transparent', count: 1, ratio: '1:1', size: '800×800', label: '透明PNG', emoji: '🔲' },
      { key: 'detail', count: 6, ratio: '3:4', size: '1440宽', label: '详情切片', emoji: '📋' },
    ],
  },
  '抖音': {
    name: '抖音小店',
    desc: '竖版为主，移动优先，动态感',
    icon: '🎵',
    images: [
      { key: 'white_bg', count: 1, ratio: '1:1', size: '800×800', label: '白底主图', emoji: '⬜' },
      { key: 'main_3x4', count: 8, ratio: '3:4', size: '1440×1920', label: '主图 3:4', emoji: '📱' },
      { key: 'transparent', count: 1, ratio: '1:1', size: '800×800', label: '透明PNG', emoji: '🔲' },
      { key: 'detail', count: 6, ratio: '9:16', size: '1440×2560', label: '详情切片', emoji: '📋' },
    ],
  },
  '小红书': {
    name: '小红书商城',
    desc: '3:4竖版为主，生活方式调性',
    icon: '📕',
    images: [
      { key: 'main_3x4', count: 8, ratio: '3:4', size: '1440×1920', label: '主图 3:4', emoji: '📱' },
      { key: 'transparent', count: 1, ratio: '1:1', size: '800×800', label: '透明PNG', emoji: '🔲' },
      { key: 'detail', count: 6, ratio: '9:16', size: '1440×2560', label: '详情切片', emoji: '📋' },
    ],
  },
  '亚马逊': {
    name: 'Amazon',
    desc: '首图纯白底必选，不可含文字',
    icon: '🌐',
    images: [
      { key: 'white_bg', count: 1, ratio: '1:1', size: '1000×1000', label: '白底主图(必选)', emoji: '⬜' },
      { key: 'main_text', count: 6, ratio: '1:1', size: '1000×1000', label: '主图 1:1', emoji: '🖼️' },
      { key: 'transparent', count: 1, ratio: '1:1', size: '800×800', label: '透明PNG', emoji: '🔲' },
    ],
  },
};

const PLATFORMS = [
  { key: 'smart', label: '智能', icon: '🤖' },
  { key: '淘宝', label: '淘宝', icon: '🟠' },
  { key: '京东', label: '京东', icon: '🔴' },
  { key: '拼多多', label: '拼多多', icon: '🟢' },
  { key: '抖音', label: '抖音', icon: '🎵' },
  { key: '小红书', label: '小红书', icon: '📕' },
  { key: '亚马逊', label: '亚马逊', icon: '🌐' },
];

const RATIOS = [
  { key: '1:1', label: '1:1', desc: '正方形（电商主图）' },
  { key: '3:4', label: '3:4', desc: '商品竖版主图' },
  { key: '4:3', label: '4:3', desc: '商品横版' },
  { key: '9:16', label: '9:16', desc: '手机竖屏（小红书/详情）' },
  { key: '16:9', label: '16:9', desc: '宽屏海报 / Banner' },
  { key: '21:9', label: '21:9', desc: '超宽全景横屏' },
];

/* ═══════ SizingPanel — 合并平台+套图+高级 ═══════ */
export default function SizingPanel({
  platform = 'smart',
  onPlatformChange,
  sizing = { smart: true, images: [] },
  onSizingChange,
  agentMode = true,
}) {
  const [showCustom, setShowCustom] = useState(!sizing.smart);
  const pDef = PLATFORM_DEFAULTS[platform] || PLATFORM_DEFAULTS.smart;
  const activeImages = showCustom ? (sizing.images.length ? sizing.images : pDef.images) : pDef.images;

  const handlePlatform = (key) => {
    onPlatformChange?.(key);
    const def = PLATFORM_DEFAULTS[key] || PLATFORM_DEFAULTS.smart;
    onSizingChange?.({ smart: !showCustom, images: def.images.map(i => ({ ...i })) });
  };

  const toggleSmart = () => {
    const next = !showCustom;
    setShowCustom(next);
    onSizingChange?.({ smart: !next, images: pDef.images.map(i => ({ ...i })) });
  };

  const updateImage = (idx, patch) => {
    const next = activeImages.map((img, i) => i === idx ? { ...img, ...patch } : img);
    onSizingChange?.({ smart: false, images: next });
  };

  const totalImages = activeImages.reduce((s, img) => s + (img.count || 0), 0);

  return (
    <div style={{ padding: '16px 20px 14px' }}>
      {/* ── 平台选择 ── */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: 0.3 }}>目标平台</div>
      <div style={{ display: 'flex', gap: 5, marginBottom: 16, flexWrap: 'wrap' }}>
        {PLATFORMS.map(p => {
          const active = platform === p.key;
          return (
            <div key={p.key} onClick={() => handlePlatform(p.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '7px 14px', borderRadius: 10, cursor: 'pointer',
                border: '1.5px solid', fontSize: 12, fontWeight: 600,
                borderColor: active ? '#1a1a1a' : 'rgba(0,0,0,0.08)',
                background: active ? '#1a1a1a' : 'rgba(0,0,0,0.02)',
                color: active ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.18s ease',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(0,0,0,0.06)'; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'rgba(0,0,0,0.02)'; }}>
              <span>{p.icon}</span>
              <span>{p.label}</span>
            </div>
          );
        })}
      </div>

      {/* ── 智能套餐展示 ── */}
      <div style={{
        background: agentMode && !showCustom ? 'linear-gradient(135deg, rgba(124,58,237,0.06), rgba(236,72,153,0.04))' : 'rgba(0,0,0,0.02)',
        borderRadius: 12, padding: '14px 16px', marginBottom: 14,
        border: `1.5px solid ${agentMode && !showCustom ? 'rgba(124,58,237,0.15)' : 'rgba(0,0,0,0.06)'}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>{pDef.icon}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a' }}>{pDef.name} · 智能套餐</span>
          </div>
          <div onClick={toggleSmart}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', borderRadius: 8, cursor: 'pointer',
              fontSize: 11, fontWeight: 600,
              background: showCustom ? '#1a1a1a' : 'rgba(124,58,237,0.1)',
              color: showCustom ? '#fff' : '#7c3aed',
              transition: 'all 0.18s',
            }}>
            {showCustom ? '自定义' : '智能'}
            <div style={{
              width: 28, height: 16, borderRadius: 8,
              background: showCustom ? 'rgba(255,255,255,0.25)' : '#fff',
              position: 'relative', transition: 'all 0.2s',
            }}>
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                background: showCustom ? '#fff' : '#7c3aed',
                position: 'absolute', top: 2,
                left: showCustom ? 14 : 2,
                transition: 'all 0.2s',
              }} />
            </div>
          </div>
        </div>

        {pDef.desc && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 10 }}>{pDef.desc}</div>
        )}

        {/* 套餐明细 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {activeImages.map((img, idx) => (
            <div key={idx} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 0', fontSize: 11, color: 'var(--text-secondary)',
            }}>
              <span style={{ fontSize: 12 }}>{img.emoji}</span>
              <span style={{ fontWeight: 600, minWidth: 60 }}>{img.label}</span>
              <span style={{ color: 'var(--text-muted)' }}>×</span>
              {showCustom ? (
                <input type="number" min={0} max={20} value={img.count}
                  onChange={e => updateImage(idx, { count: Math.max(0, parseInt(e.target.value) || 0) })}
                  style={{
                    width: 36, height: 22, textAlign: 'center', borderRadius: 6,
                    border: '1px solid rgba(0,0,0,0.1)', background: '#fff',
                    fontSize: 11, fontWeight: 600, outline: 'none', fontFamily: 'inherit',
                  }} />
              ) : (
                <span style={{ fontWeight: 600 }}>{img.count}</span>
              )}
              <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{img.ratio}</span>
              <span style={{ color: 'var(--text-faint)', fontSize: 10 }}>{img.size}</span>
              {showCustom && (
                <select value={img.ratio}
                  onChange={e => updateImage(idx, { ratio: e.target.value })}
                  style={{
                    marginLeft: 'auto', height: 22, borderRadius: 6,
                    border: '1px solid rgba(0,0,0,0.1)', background: '#fff',
                    fontSize: 10, outline: 'none', fontFamily: 'inherit',
                    color: 'var(--text-secondary)', padding: '0 4px',
                  }}>
                  {RATIOS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                </select>
              )}
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.05)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 11, color: 'var(--text-muted)',
        }}>
          <span>共 <b style={{ color: '#1a1a1a' }}>{totalImages}</b> 张图片</span>
          {platform === '亚马逊' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#e67e22', fontSize: 10 }}>
              <MdInfoOutline size={12} /> 亚马逊首图须纯白底
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export { PLATFORM_DEFAULTS };
