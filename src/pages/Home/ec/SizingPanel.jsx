import React, { useMemo, useCallback } from 'react';
import { Check, Info, ChevronDown, Zap, Pencil } from 'lucide-react';

/* ═══════ 图片类型组件库 ═══════ */
const IMAGE_TYPES = [
  { key: 'white_bg', label: '白底首图', icon: '⬜', defaultRatio: '1:1', defaultCount: 1,
    desc: '纯白底产品居中，电商必选', usage: '淘宝/京东/亚马逊首图', maxCount: 5 },
  { key: 'main_text', label: '商品主图 1:1', icon: '🖼️', defaultRatio: '1:1', defaultCount: 5,
    desc: '核心卖点展示，可含促销文字', usage: '淘宝/京东/拼多多主图', maxCount: 5 },
  { key: 'main_3x4', label: '商品主图 3:4', icon: '📱', defaultRatio: '3:4', defaultCount: 5,
    desc: '竖版主图，适合移动端展示', usage: '抖音/小红书/移动端主图', maxCount: 5 },
  { key: 'transparent', label: '透明 PNG', icon: '🔲', defaultRatio: '1:1', defaultCount: 1,
    desc: '去底素材，方便二次设计', usage: '通用素材/合成用', maxCount: 1 },
  { key: 'sku', label: 'SKU 规格图', icon: '🏷️', defaultRatio: '1:1', defaultCount: 0,
    desc: '同款不同色/规格展示', usage: '详情页/SKU选择', maxCount: 20 },
  { key: 'detail', label: '详情切片', icon: '📋', defaultRatio: '3:4', defaultCount: 6,
    desc: '长图详情页切片，含多种子类', usage: '详情页长图拼接', maxCount: 6 },
  { key: 'poster', label: '营销海报', icon: '🎯', defaultRatio: '3:4', defaultCount: 0,
    desc: '促销活动、节日海报、Banner', usage: '活动推广/社媒分享', maxCount: 5 },
];

/* ═══════ 比例选项（带用途注释）═══ */
const RATIOS = [
  { key: '1:1', label: '1:1', usage: '淘宝/京东商品主图' },
  { key: '3:4', label: '3:4', usage: '抖音/小红书竖版主图' },
  { key: '4:3', label: '4:3', usage: '横版详情/PC端展示' },
  { key: '9:16', label: '9:16', usage: '小红书种草竖图/手机全屏' },
  { key: '16:9', label: '16:9', usage: '宽屏海报/Banner' },
];

/* ═══════ 平台推荐组合 ═══════ */
const PLATFORM_PRESETS = {
  smart:     { name: '智能推荐', icon: '🤖', desc: 'AI 根据产品自动选择最佳平台和套餐', types: ['white_bg', 'main_text', 'main_3x4', 'transparent', 'detail'] },
  '淘宝':    { name: '淘宝/天猫', icon: '🟠', desc: '首图1440×1440，品质优先，可含促销文字', types: ['white_bg', 'main_text', 'main_3x4', 'transparent', 'detail'] },
  '京东':    { name: '京东', icon: '🔴', desc: '品质优先，主图1440×1440', types: ['white_bg', 'main_text', 'main_3x4', 'transparent', 'detail'] },
  '拼多多':  { name: '拼多多', icon: '🟢', desc: '可含促销文字，性价比风格', types: ['main_text', 'main_3x4', 'transparent', 'detail'] },
  '抖音':    { name: '抖音小店', icon: '🎵', desc: '竖版为主，移动优先，动态感', types: ['white_bg', 'main_3x4', 'transparent', 'detail'] },
  '小红书':  { name: '小红书商城', icon: '📕', desc: '3:4竖版为主，生活方式调性', types: ['main_3x4', 'transparent', 'detail'] },
  '亚马逊':  { name: 'Amazon', icon: '🌐', desc: '首图纯白底必选，不可含文字', types: ['white_bg', 'main_text', 'transparent'] },
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

/* ═══════ 构建默认 images 数组 ═══════ */
function buildDefaultImages(typeKeys) {
  return IMAGE_TYPES
    .filter(t => typeKeys.includes(t.key))
    .map(t => ({ key: t.key, count: t.defaultCount, ratio: t.defaultRatio, label: t.label }));
}

/* ═══════ SizingPanel — 图片类型组件库 + 平台推荐 ═══════ */
export default function SizingPanel({
  platform = 'smart',
  onPlatformChange,
  sizing = { smart: true, images: [] },
  onSizingChange,
  smartMode = true,
  onOverride,
}) {
  // 当前激活的图片类型列表
  const activeImages = sizing.images?.length ? sizing.images : buildDefaultImages(PLATFORM_PRESETS[platform]?.types || PLATFORM_PRESETS.smart.types);
  // 已激活的 key 集合
  const activeKeys = useMemo(() => new Set(activeImages.map(i => i.key)), [activeImages]);
  // 是否已被用户自定义
  const isCustomized = sizing.smart === false || (sizing.images?.length > 0 && !sizing.smart);

  /* ── 平台切换 ── */
  const handlePlatform = useCallback((key) => {
    onPlatformChange?.(key);
    const preset = PLATFORM_PRESETS[key] || PLATFORM_PRESETS.smart;
    const newImages = buildDefaultImages(preset.types);
    onSizingChange?.({ smart: true, images: newImages });
  }, [onPlatformChange, onSizingChange]);

  /* ── 切换图片类型勾选 ── */
  const toggleType = useCallback((typeKey) => {
    const typeDef = IMAGE_TYPES.find(t => t.key === typeKey);
    if (!typeDef) return;
    let next;
    if (activeKeys.has(typeKey)) {
      // 取消勾选 → 移除
      next = activeImages.filter(i => i.key !== typeKey);
    } else {
      // 勾选 → 添加（默认数量）
      next = [...activeImages, { key: typeKey, count: typeDef.defaultCount || 1, ratio: typeDef.defaultRatio, label: typeDef.label }];
    }
    onSizingChange?.({ smart: false, images: next });
    onOverride?.();
  }, [activeKeys, activeImages, onSizingChange, onOverride]);

  /* ── 修改数量 ── */
  const updateCount = useCallback((typeKey, count) => {
    const next = activeImages.map(i => i.key === typeKey ? { ...i, count: Math.max(0, Math.min(count, IMAGE_TYPES.find(t => t.key === typeKey)?.maxCount || 20)) } : i);
    onSizingChange?.({ smart: false, images: next });
    onOverride?.();
  }, [activeImages, onSizingChange, onOverride]);

  /* ── 修改比例 ── */
  const updateRatio = useCallback((typeKey, ratio) => {
    const next = activeImages.map(i => i.key === typeKey ? { ...i, ratio } : i);
    onSizingChange?.({ smart: false, images: next });
    onOverride?.();
  }, [activeImages, onSizingChange, onOverride]);

  const totalImages = activeImages.reduce((s, img) => s + (img.count || 0), 0);
  const pDef = PLATFORM_PRESETS[platform] || PLATFORM_PRESETS.smart;

  return (
    <div style={{ padding: 0 }}>
      {/* ── 智能方案指示 ── */}
      {smartMode && !isCustomized && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 16px', background: 'linear-gradient(135deg, rgba(34,197,94,0.08), rgba(34,197,94,0.04))',
          borderBottom: '1px solid rgba(34,197,94,0.12)',
          fontSize: 12, fontWeight: 600, color: '#16a34a',
        }}>
          <Zap size={14} />
          <span>当前：已启用智能方案 · 系统根据平台自动推荐最佳图片组合</span>
        </div>
      )}
      {isCustomized && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 16px', background: 'linear-gradient(135deg, rgba(124,58,237,0.06), rgba(124,58,237,0.03))',
          borderBottom: '1px solid rgba(124,58,237,0.1)',
          fontSize: 12, fontWeight: 600, color: '#7c3aed',
        }}>
          <Pencil size={14} />
          <span>已自定义配置 · 基于智能推荐修改</span>
        </div>
      )}

      <div style={{ padding: '14px 16px 12px' }}>
        {/* ── 平台选择 ── */}
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: 0.3 }}>目标平台</div>
        <div style={{ display: 'flex', gap: 5, marginBottom: 16, flexWrap: 'wrap' }}>
          {PLATFORMS.map(p => {
            const active = platform === p.key;
            return (
              <div key={p.key} onClick={() => handlePlatform(p.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '7px 14px', borderRadius: 10, cursor: 'pointer',
                  border: '1.5px solid', fontSize: 12, fontWeight: 600,
                  borderColor: active ? '#1a1a1a' : 'rgba(0,0,0,0.1)',
                  background: active ? '#1a1a1a' : 'rgba(0,0,0,0.03)',
                  color: active ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.18s ease', whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(0,0,0,0.06)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'rgba(0,0,0,0.03)'; }}>
                <span>{p.icon}</span><span>{p.label}</span>
              </div>
            );
          })}
        </div>

        {/* ── 平台说明 ── */}
        {pDef.desc && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)', marginBottom: 14, padding: '6px 10px', background: 'rgba(0,0,0,0.025)', borderRadius: 8 }}>
            <Info size={12} /> {pDef.desc}
          </div>
        )}

        {/* ── 图片类型列表 ── */}
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: 0.3 }}>图片类型</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {IMAGE_TYPES.map(typeDef => {
            const checked = activeKeys.has(typeDef.key);
            const activeItem = activeImages.find(i => i.key === typeDef.key);
            return (
              <div key={typeDef.key} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 10,
                background: checked ? 'rgba(0,0,0,0.03)' : 'transparent',
                border: `1.5px solid ${checked ? 'rgba(0,0,0,0.1)' : 'transparent'}`,
                transition: 'all 0.15s',
              }}>
                {/* 勾选框 */}
                <div onClick={() => toggleType(typeDef.key)} style={{
                  width: 20, height: 20, borderRadius: 6, cursor: 'pointer',
                  border: `2px solid ${checked ? '#1a1a1a' : 'rgba(0,0,0,0.15)'}`,
                  background: checked ? '#1a1a1a' : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s', flexShrink: 0,
                }}>
                  {checked && <Check size={12} color="#fff" strokeWidth={3} />}
                </div>

                {/* 图标 + 标签 */}
                <span style={{ fontSize: 14, flexShrink: 0 }}>{typeDef.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{typeDef.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{typeDef.desc}</div>
                </div>

                {/* 数量 + 比例（勾选后显示） */}
                {checked && activeItem && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>数量</span>
                    <input type="number" min={0} max={typeDef.maxCount || 20}
                      value={activeItem.count}
                      onChange={e => updateCount(typeDef.key, parseInt(e.target.value) || 0)}
                      style={{
                        width: 38, height: 26, textAlign: 'center', borderRadius: 6,
                        border: '1px solid rgba(0,0,0,0.12)', background: '#fff',
                        fontSize: 12, fontWeight: 600, outline: 'none', fontFamily: 'inherit',
                        color: 'var(--text-primary)',
                      }} />
                    <select value={activeItem.ratio}
                      onChange={e => updateRatio(typeDef.key, e.target.value)}
                      style={{
                        height: 26, borderRadius: 6, padding: '0 4px',
                        border: '1px solid rgba(0,0,0,0.12)', background: '#fff',
                        fontSize: 11, fontWeight: 600, outline: 'none', fontFamily: 'inherit',
                        color: 'var(--text-primary)', cursor: 'pointer',
                      }}>
                      {RATIOS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                    </select>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── 底部统计 ── */}
        <div style={{
          marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(0,0,0,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
        }}>
          <span>共 <b style={{ color: 'var(--text-primary)' }}>{totalImages}</b> 张图片</span>
          {platform === '亚马逊' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#e67e22', fontSize: 11 }}>
              <Info size={12} /> 亚马逊首图须纯白底
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export { IMAGE_TYPES, PLATFORM_PRESETS, RATIOS };
