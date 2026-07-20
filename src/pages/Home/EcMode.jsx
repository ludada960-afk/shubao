import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, LayoutGrid, Palette, Tag, ShoppingBag, PenLine, ChevronDown, Plus, ImagePlus } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import SizingPanel from './ec/SizingPanel';
import StylePanel from './ec/StylePanel';
import ParamsPanel from './ec/ParamsPanel';
import SkuPanel from './ec/SkuPanel';
import CopyPanel from './ec/CopyPanel';

/* ═══════ 智能方案状态常量 ═══════ */
const SMART_LABELS = { on: '智能生图方案', tuned: '智能方案（已微调）', off: '手动配置' };

/* ═══════ 统一按钮样式 ═══════ */
const BTN_BASE = {
  height: 38, padding: '0 16px', borderRadius: 12,
  fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
  border: '1.5px solid transparent', background: 'rgba(0,0,0,0.04)',
  color: 'var(--text-secondary)', transition: 'all 0.18s ease',
  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
  whiteSpace: 'nowrap', userSelect: 'none', flexShrink: 0,
};

/* ═══════ 统一面板样式 ═══════ */
const PANEL_STYLE = {
  borderRadius: 16, background: '#fff',
  boxShadow: '0 -8px 40px rgba(57,45,26,0.14), 0 -2px 12px rgba(57,45,26,0.08)',
  border: '1px solid rgba(0,0,0,0.06)',
  overflowY: 'auto',
  animation: 'ecPanelSlideUp 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
};

const WIDE_PANELS = ['sizing', 'style', 'sku'];

/* ═══════ EcMode — 三段式第一步：参数配置 ═══════ */
export default function EcMode({ ecStep, setEcStep, onStepChange }) {
  const { state } = useApp();

  /* — 图片 — */
  const [productImages, setProductImages] = useState([]);
  const [refImages, setRefImages] = useState([]);
  const prodFileRef = useRef(null);
  const refFileRef = useRef(null);
  const cardRef = useRef(null);
  const btnRowRef = useRef(null);
  const btnRefs = useRef({});

  /* — 文字 — */
  const [description, setDescription] = useState('');

  /* — 智能方案 — */
  const [smartMode, setSmartMode] = useState(true);
  const [smartOverrides, setSmartOverrides] = useState({
    sizing: false, style: false, params: false, copy: false,
  });

  /* — 配置 — */
  const [platform, setPlatform] = useState('smart');
  const [sizing, setSizing] = useState({ smart: true, images: [] });
  const [styleSkill, setStyleSkill] = useState('smart');
  const [customColors, setCustomColors] = useState(null);
  const [productParams, setProductParams] = useState({ category: '', size: '', baseColor: '', accentColor: '', material: '', craft: '' });
  const [skus, setSkus] = useState([]);
  const [copywriting, setCopywriting] = useState({ plan: '', sellingPoints: '', qc: '', details: '', maintenance: '' });

  /* — 面板 — */
  const [activePanel, setActivePanel] = useState(null);
  const [panelPos, setPanelPos] = useState({ left: 0, width: 0, bottom: 0, maxH: 440 });

  /* — SKU 初始化（修复 remount 丢失 bug）—— */
  useEffect(() => {
    if (skus.length === 0) {
      setSkus([{ id: Date.now(), color: '', size: '', capacity: '', dimLabel: '', count: 1 }]);
    }
  }, []);

  /* Esc 关闭 + 点击外部关闭 */
  useEffect(() => {
    if (!activePanel) { document.body.style.overflow = ''; return; }
    const handleKey = (e) => { if (e.key === 'Escape') setActivePanel(null); };
    const handleClick = (e) => {
      const panel = document.getElementById('ec-floating-panel');
      const btnRow = btnRowRef.current;
      if (panel && panel.contains(e.target)) return;
      if (btnRow && btnRow.contains(e.target)) return;
      setActivePanel(null);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKey);
    setTimeout(() => window.addEventListener('mousedown', handleClick), 0);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('mousedown', handleClick);
    };
  }, [activePanel]);

  /* — 智能方案 override 回调 —— */
  const handleOverride = useCallback((panel) => {
    setSmartOverrides(prev => ({ ...prev, [panel]: true }));
  }, []);

  /* — 智能方案标签 —— */
  const smartLabel = smartMode
    ? (Object.values(smartOverrides).some(Boolean) ? SMART_LABELS.tuned : SMART_LABELS.on)
    : SMART_LABELS.off;
  const hasOverrides = Object.values(smartOverrides).some(Boolean);

  const canGen = productImages.length > 0 || description.trim().length > 0;

  /* ── 下一步 → 跳转第二步 ── */
  const handleNext = () => {
    if (!canGen) return;
    const effectiveSizing = (smartMode && !smartOverrides.sizing) ? { smart: true, images: [] } : sizing;
    const effectiveStyle = (smartMode && !smartOverrides.style) ? 'smart' : styleSkill;
    const effectiveParams = (smartMode && !smartOverrides.params) ? productParams : productParams;
    const effectiveCopy = (smartMode && !smartOverrides.copy) ? copywriting : copywriting;

    onStepChange?.({
      productName: description.trim() || '商品',
      description: description.trim(),
      category: effectiveParams.category || '其他',
      realShots: productImages.map(img => img.url),
      refShots: refImages.map(img => img.url),
      platform,
      sizing: effectiveSizing,
      styleSkill: effectiveStyle,
      customColors,
      productParams: effectiveParams,
      skus,
      copywriting: effectiveCopy,
    });
    setEcStep?.(2);
  };

  /* ── 图片上传 ── */
  const handleProdUpload = (e) => {
    const files = Array.from(e.target.files || []);
    setProductImages(prev => [...prev, ...files.map(f => ({ url: URL.createObjectURL(f), file: f }))]);
  };
  const handleRefUpload = (e) => {
    const files = Array.from(e.target.files || []);
    setRefImages(prev => [...prev, ...files.map(f => ({ url: URL.createObjectURL(f), file: f }))]);
  };
  const removeProdImg = (idx) => setProductImages(prev => prev.filter((_, i) => i !== idx));
  const removeRefImg = (idx) => setRefImages(prev => prev.filter((_, i) => i !== idx));

  /* ── 智能方案切换 ── */
  const toggleSmart = () => {
    const next = !smartMode;
    setSmartMode(next);
    if (!next) {
      // 关闭智能 → 保持当前面板值（用户手动配置）
    } else {
      // 开启智能 → 重置所有 override
      setSmartOverrides({ sizing: false, style: false, params: false, copy: false });
    }
  };

  /* ── 5 个功能按钮 ── */
  const BUTTONS = [
    { key: 'sizing', label: '套图配置', icon: <LayoutGrid size={15} /> },
    { key: 'style', label: '画面风格', icon: <Palette size={15} /> },
    { key: 'params', label: '产品参数', icon: <Tag size={15} /> },
    { key: 'sku', label: 'SKU 变体', icon: <ShoppingBag size={15} /> },
    { key: 'copy', label: '文案策划', icon: <PenLine size={15} /> },
  ];

  /* ── 面板定位（向上吸附按钮行）── */
  const openPanel = useCallback((key) => {
    if (activePanel === key) { setActivePanel(null); return; }
    const el = btnRefs.current[key];
    const card = cardRef.current;
    const btnRow = btnRowRef.current;
    if (el && card && btnRow) {
      const cardRect = card.getBoundingClientRect();
      const btnRect = el.getBoundingClientRect();
      const btnRowRect = btnRow.getBoundingClientRect();
      const cardW = cardRect.width;
      const maxPW = Math.min(cardW - 16, 580);
      const panelW = WIDE_PANELS.includes(key)
        ? maxPW
        : Math.max(Math.min(btnRect.width + 40, maxPW), 360);
      let panelLeft = WIDE_PANELS.includes(key)
        ? (cardW - panelW) / 2
        : btnRect.left - cardRect.left + btnRect.width / 2 - panelW / 2;
      // 窄面板边缘修正
      if (!WIDE_PANELS.includes(key)) {
        if (panelLeft + panelW > cardW - 8) panelLeft = cardW - panelW - 8;
        if (panelLeft < 8) panelLeft = 8;
      }
      // 面板从按钮行上方展开（向上）
      const btnRowTopInCard = btnRowRect.top - cardRect.top;
      const availableAbove = btnRowTopInCard - 10;
      const panelBottom = cardRect.height - btnRowTopInCard + 6;
      const maxPanelH = Math.min(440, Math.max(200, availableAbove));
      setPanelPos({ left: panelLeft, width: panelW, bottom: panelBottom, maxH: maxPanelH });
    }
    setActivePanel(key);
  }, [activePanel]);

  return (
    <div>
      {/* ═══ 白色卡片 ═══ */}
      <div ref={cardRef} style={{ borderRadius: 20, margin: '0 16px', background: '#fff', padding: '16px 20px 20px', position: 'relative' }}>
        {/* ═══ 暖色渐变区：上传+文字 ═══ */}
        <div style={{ borderRadius: 16, padding: '4px', background: 'linear-gradient(90deg, #FAF0E4 0%, #FBF3EA 50%, #FDF9F5 75%, #FFFFFF 100%)', overflow: 'visible', position: 'relative' }}>
          {/* ── 上传行 ── */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, overflow: 'visible', padding: '12px 16px 4px 28px', position: 'relative', zIndex: 2 }}>
            {/* 产品图区域 */}
            {productImages.length === 0 ? (
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div onClick={() => prodFileRef.current?.click()}
                  style={{
                    width: 86, height: 108, borderRadius: 16, background: '#fff',
                    transform: 'rotate(-5deg)', cursor: 'pointer',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                    border: '2px dashed var(--border)',
                    boxShadow: '0 14px 36px rgba(57,45,26,0.10)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px) rotate(0deg)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'rotate(-5deg)'; e.currentTarget.style.borderColor = 'var(--border)'; }}>
                  <span style={{ display: 'grid', width: 40, height: 40, placeItems: 'center', borderRadius: '50%', background: '#f8f3ea', color: 'var(--text-secondary)', boxShadow: '0 10px 24px rgba(57,45,26,0.12)' }}><ImagePlus size={20} /></span>
                  <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--text-secondary)' }}>产品图</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>最多 5 张</span>
                </div>
                <input ref={prodFileRef} type="file" accept="image/*" multiple hidden onChange={handleProdUpload} />
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {productImages.map((img, idx) => (
                  <div key={idx} style={{ position: 'relative', flexShrink: 0, transform: 'rotate(-5deg)' }}>
                    <img src={img.url} style={{ width: 86, height: 108, objectFit: 'cover', borderRadius: 16, boxShadow: '0 14px 36px rgba(57,45,26,0.10)' }} />
                    <div onClick={() => removeProdImg(idx)} style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, cursor: 'pointer' }}>×</div>
                  </div>
                ))}
                <div onClick={() => prodFileRef.current?.click()} style={{ width: 86, height: 108, borderRadius: 16, border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transform: 'rotate(-5deg)' }}>
                  <Plus size={18} style={{ color: 'var(--text-muted)' }} />
                </div>
                <input ref={prodFileRef} type="file" accept="image/*" multiple hidden onChange={handleProdUpload} />
              </div>
            )}

            {/* × 分隔符 */}
            <div style={{ display: 'flex', alignItems: 'center', height: 108, color: 'var(--text-muted)', fontSize: 14, fontWeight: 600, flexShrink: 0, paddingLeft: 2, paddingRight: 2 }}>×</div>

            {/* 参考图区域 */}
            <div style={{ position: 'relative', flexShrink: 0, zIndex: 3 }}>
              <div style={{
                position: 'absolute', top: -4, right: -4, zIndex: 10,
                background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
                color: '#fff', fontSize: 9, fontWeight: 700,
                padding: '2px 6px', borderRadius: 8,
                boxShadow: '0 2px 8px rgba(139,92,246,0.3)',
                letterSpacing: 0.5, lineHeight: '14px', whiteSpace: 'nowrap',
              }}>可选</div>
              {refImages.length === 0 ? (
                <div onClick={() => refFileRef.current?.click()}
                  style={{
                    width: 86, height: 108, borderRadius: 16, background: '#fff',
                    transform: 'rotate(5deg)', cursor: 'pointer',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                    border: '2px dashed var(--border)',
                    boxShadow: '0 14px 36px rgba(57,45,26,0.10)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px) rotate(0deg)'; e.currentTarget.style.borderColor = '#8b5cf6'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'rotate(5deg)'; e.currentTarget.style.borderColor = 'var(--border)'; }}>
                  <span style={{ display: 'grid', width: 40, height: 40, placeItems: 'center', borderRadius: '50%', background: '#f0ecff', color: '#8b5cf6', boxShadow: '0 10px 24px rgba(139,92,246,0.15)' }}><ImagePlus size={20} /></span>
                  <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--text-secondary)' }}>参考图</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>可选</span>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {refImages.map((img, idx) => (
                    <div key={idx} style={{ position: 'relative', flexShrink: 0, transform: 'rotate(5deg)' }}>
                      <img src={img.url} style={{ width: 86, height: 108, objectFit: 'cover', borderRadius: 16, boxShadow: '0 14px 36px rgba(57,45,26,0.10)' }} />
                      <div onClick={() => removeRefImg(idx)} style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, cursor: 'pointer' }}>×</div>
                    </div>
                  ))}
                  <div onClick={() => refFileRef.current?.click()} style={{ width: 86, height: 108, borderRadius: 16, border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transform: 'rotate(5deg)' }}>
                    <Plus size={18} style={{ color: 'var(--text-muted)' }} />
                  </div>
                </div>
              )}
              <input ref={refFileRef} type="file" accept="image/*" multiple hidden onChange={handleRefUpload} />
            </div>
          </div>

          {/* ── 文字输入框 ── */}
          <div className="ec-textarea-wrap" style={{ position: 'relative', margin: '8px 16px 16px 28px' }}>
            {!description && (
              <div className="ec-textarea-placeholder" style={{ fontSize: 15, lineHeight: '28px' }}>
                <span className="ec-placeholder-line">描述你的产品…</span>
                <span className="ec-placeholder-line" style={{ marginTop: 28 }}>例：白色陶瓷杯，简约北欧风，350ml</span>
                <span className="ec-cursor" style={{ position: 'absolute', top: 4, left: 0 }}></span>
              </div>
            )}
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              className={!description ? 'ec-empty' : ''}
              placeholder={!description ? '' : '描述你的产品…\n例：白色陶瓷杯，简约北欧风，350ml'}
              style={{
                width: '100%', minHeight: 140, border: 'none', background: 'transparent',
                padding: '4px 0', fontSize: 15, lineHeight: '28px', color: 'var(--text-primary)',
                outline: 'none', resize: 'none', fontFamily: 'inherit',
                position: 'relative', zIndex: 1,
              }}
            />
          </div>
        </div>

        {/* ═══ 配置按钮行 ═══ */}
        <div ref={btnRowRef} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '12px 2px 14px', flexWrap: 'wrap',
          position: 'relative', zIndex: 10,
          borderTop: '1px solid rgba(0,0,0,0.06)',
        }}>
          {/* ── 智能方案开关 ── */}
          <div onClick={toggleSmart}
            style={{
              ...BTN_BASE,
              height: 38, padding: '0 14px', borderRadius: 20,
              border: `2px solid ${smartMode ? '#7c3aed' : 'rgba(0,0,0,0.15)'}`,
              background: smartMode
                ? (hasOverrides
                  ? 'linear-gradient(135deg, rgba(124,58,237,0.06), rgba(236,72,153,0.04))'
                  : 'linear-gradient(135deg, rgba(124,58,237,0.10), rgba(236,72,153,0.08))')
                : '#fff',
              color: smartMode ? '#7c3aed' : 'var(--text-secondary)',
            }}>
            <Sparkles size={14} style={{ transition: 'transform 0.3s', transform: smartMode ? 'rotate(15deg) scale(1.1)' : 'none' }} />
            <span style={{ fontSize: 12, fontWeight: 700 }}>{smartLabel}</span>
            <div style={{
              width: 28, height: 16, borderRadius: 8,
              background: smartMode ? '#7c3aed' : 'rgba(0,0,0,0.12)',
              position: 'relative', transition: 'all 0.2s', flexShrink: 0,
            }}>
              <div style={{
                width: 12, height: 12, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 2,
                left: smartMode ? 14 : 2,
                transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </div>
          </div>

          {/* ── 5 个功能按钮 ── */}
          {BUTTONS.map(btn => {
            const isOpen = activePanel === btn.key;
            const isOverridden = smartMode && smartOverrides[btn.key];
            return (
              <div key={btn.key} ref={el => { if (el) btnRefs.current[btn.key] = el; }}
                onClick={() => openPanel(btn.key)}
                style={{
                  ...BTN_BASE,
                  // 黑边 = 智能方案下有人工干预
                  borderColor: isOverridden ? '#1a1a1a' : 'transparent',
                  borderStyle: 'solid',
                  // 打开状态 = 轻微背景高亮
                  background: isOpen ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.04)',
                  position: 'relative',
                }}
                onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = 'rgba(0,0,0,0.08)'; }}
                onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}>
                <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{btn.icon}</span>
                <span>{btn.label}</span>
                <ChevronDown size={13} style={{
                  opacity: 0.5,
                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.22s ease',
                }} />
              </div>
            );
          })}

          {/* ── 下一步按钮 ── */}
          <button disabled={!canGen} onClick={handleNext}
            style={{
              marginLeft: 'auto', height: 38, padding: '0 22px', borderRadius: 12,
              border: 'none', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
              background: canGen
                ? 'linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #f59e0b 100%)'
                : '#e5e5e5',
              color: canGen ? '#fff' : '#aaa', cursor: canGen ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', gap: 6,
              transition: 'all 0.2s', flexShrink: 0,
              boxShadow: canGen ? '0 4px 16px rgba(124,58,237,0.3)' : 'none',
            }}
            onMouseEnter={e => { if (canGen) { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(124,58,237,0.4)'; } }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = canGen ? '0 4px 16px rgba(124,58,237,0.3)' : 'none'; }}>
            下一步 <span style={{ fontSize: 15, lineHeight: 1 }}>→</span>
          </button>
        </div>

        {/* ═══ 悬浮配置面板（向上吸附按钮行）═══ */}
        {activePanel && (
          <div id="ec-floating-panel" style={{
            ...PANEL_STYLE,
            position: 'absolute',
            bottom: panelPos.bottom,
            left: panelPos.left,
            width: panelPos.width,
            maxHeight: panelPos.maxH,
            zIndex: 20,
          }}>
            {activePanel === 'sizing' && (
              <SizingPanel
                platform={platform} onPlatformChange={setPlatform}
                sizing={sizing} onSizingChange={setSizing}
                smartMode={smartMode} onOverride={() => handleOverride('sizing')}
              />
            )}
            {activePanel === 'style' && (
              <StylePanel
                value={styleSkill} onChange={setStyleSkill}
                customColors={customColors} onColorsChange={setCustomColors}
                smartMode={smartMode} onOverride={() => handleOverride('style')}
              />
            )}
            {activePanel === 'params' && (
              <ParamsPanel params={productParams} onChange={setProductParams}
                smartMode={smartMode} onOverride={() => handleOverride('params')} />
            )}
            {activePanel === 'sku' && (
              <SkuPanel skus={skus} onChange={setSkus} />
            )}
            {activePanel === 'copy' && (
              <CopyPanel copywriting={copywriting} onChange={setCopywriting}
                smartMode={smartMode} onOverride={() => handleOverride('copy')} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
