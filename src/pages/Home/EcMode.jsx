import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
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

/* ═══════ 玻璃拟态面板样式 ═══════ */
const GLASS_PANEL = {
  borderRadius: 16,
  background: 'rgba(255, 255, 255, 0.78)',
  backdropFilter: 'blur(32px) saturate(200%)',
  WebkitBackdropFilter: 'blur(32px) saturate(200%)',
  border: '1px solid rgba(255, 255, 255, 0.6)',
  boxShadow: '0 8px 40px rgba(0,0,0,0.12), 0 2px 12px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 0 rgba(255,255,255,0.4)',
  animation: 'ecGlassSlideUp 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
};

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

  /* — 面板（Portal 定位用视口坐标）—— */
  const [activePanel, setActivePanel] = useState(null);
  const [panelPos, setPanelPos] = useState({ left: 0, bottom: 0, width: 0, maxH: 400, btnCenterX: 0 });

  /* — SKU 初始化 —— */
  useEffect(() => {
    if (skus.length === 0) {
      setSkus([{ id: Date.now(), color: '', size: '', capacity: '', dimLabel: '', count: 1 }]);
    }
  }, []);

  /* Esc 关闭 + 点击外部关闭 */
  useEffect(() => {
    if (!activePanel) { return; }
    const handleKey = (e) => { if (e.key === 'Escape') setActivePanel(null); };
    const handleClick = (e) => {
      const panel = document.getElementById('ec-floating-panel');
      const btnRow = btnRowRef.current;
      if (panel && panel.contains(e.target)) return;
      if (btnRow && btnRow.contains(e.target)) return;
      setActivePanel(null);
    };
    window.addEventListener('keydown', handleKey);
    setTimeout(() => window.addEventListener('mousedown', handleClick), 0);
    return () => {
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

  /* ── blob URL → base64 data URL（外部API需要）── */
  const blobToBase64 = (blobUrl) => new Promise((resolve) => {
    fetch(blobUrl).then(r => r.blob()).then(blob => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    }).catch(() => resolve(blobUrl));
  });

  const imageToBase64 = async (imgs) => {
    const results = [];
    for (const img of imgs) {
      let url = img.url;
      if (url.startsWith('blob:')) url = await blobToBase64(url);
      else if (!url.startsWith('data:')) { results.push(url); continue; }
      // 压缩：限制最大边 800px，JPEG 0.7 质量
      const compressed = await compressImage(url, 800, 0.7);
      results.push(compressed);
    }
    return results;
  };

  /* ── 图片压缩工具 ── */
  const compressImage = (dataUrl, maxDim = 800, quality = 0.7) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        const scale = maxDim / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });

  /* ── 下一步 ── */
  const handleNext = async () => {
    if (!canGen) return;
    const effectiveSizing = (smartMode && !smartOverrides.sizing) ? { smart: true, images: [] } : sizing;
    const effectiveStyle = (smartMode && !smartOverrides.style) ? 'smart' : styleSkill;
    const effectiveParams = (smartMode && !smartOverrides.params) ? productParams : productParams;
    const effectiveCopy = (smartMode && !smartOverrides.copy) ? copywriting : copywriting;

    const realShots = await imageToBase64(productImages);
    const refShots = await imageToBase64(refImages);

    onStepChange?.({
      productName: description.trim() || '商品',
      description: description.trim(),
      category: effectiveParams.category || '其他',
      realShots,
      refShots,
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
    if (next) {
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

  /* ── 面板定位（Portal 视口坐标，紧贴按钮正上方）── */
  const openPanel = useCallback((key) => {
    if (activePanel === key) { setActivePanel(null); return; }
    const el = btnRefs.current[key];
    if (el) {
      const vw = window.innerWidth;
      const btnRect = el.getBoundingClientRect();
      // 所有面板统一居中于自己的按钮
      const maxPW = Math.min(vw - 32, 580);
      const panelW = Math.min(Math.max(btnRect.width + 80, 380), maxPW);
      let panelLeft = btnRect.left + btnRect.width / 2 - panelW / 2;
      // 边缘修正
      if (panelLeft < 16) panelLeft = 16;
      if (panelLeft + panelW > vw - 16) panelLeft = vw - panelW - 16;
      // 面板底部紧贴按钮上方（留 10px 给连接箭头）
      const gap = 10;
      const panelBottom = window.innerHeight - btnRect.top + gap;
      // 安全最大高度 = 按钮上方可用空间
      const maxH = Math.max(240, btnRect.top - 16);
      // 按钮中心 X（用于箭头定位）
      const btnCenterX = btnRect.left + btnRect.width / 2;
      setPanelPos({ left: panelLeft, bottom: panelBottom, width: panelW, maxH, btnCenterX });
    }
    setActivePanel(key);
  }, [activePanel]);

  /* ── Portal 渲染面板 ── */
  const renderPanel = () => {
    if (!activePanel) return null;
    // 箭头相对于面板的水平位置
    const arrowLeft = Math.max(16, Math.min(panelPos.btnCenterX - panelPos.left, panelPos.width - 16));
    return createPortal(
      <>
        {/* ── 连接箭头（指向按钮）── */}
        <div className="ec-panel-arrow" style={{
          position: 'fixed',
          bottom: panelPos.bottom - 8,
          left: panelPos.btnCenterX - 8,
          width: 0, height: 0,
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderTop: '8px solid rgba(255,255,255,0.78)',
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.08))',
          zIndex: 9999,
          pointerEvents: 'none',
        }} />
        {/* ── 面板本体 ── */}
        <div id="ec-floating-panel" style={{
          ...GLASS_PANEL,
          position: 'fixed',
          bottom: panelPos.bottom,
          left: panelPos.left,
          width: panelPos.width,
          maxHeight: panelPos.maxH,
          overflowY: 'auto',
          zIndex: 10000,
          transformOrigin: 'bottom center',
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
      </>,
      document.body
    );
  };

  return (
    <div>
      {/* ═══ 白色卡片 ═══ */}
      <div ref={cardRef} style={{ borderRadius: 20, margin: '0 16px', background: '#fff', padding: '16px 20px 20px', position: 'relative' }}>
        {/* ═══ 暖色渐变区：上传+文字 ═══ */}
        <div style={{ borderRadius: 16, padding: '4px', background: 'linear-gradient(90deg, #FAF0E4 0%, #FBF3EA 50%, #FDF9F5 75%, #FFFFFF 100%)', overflow: 'visible', position: 'relative' }}>

          {/* ── 上传行：单排横滚，产品图左倾/参考图右倾，对称互歪 ── */}
          <div style={{ padding: '14px 16px 0 20px', position: 'relative', zIndex: 2 }}>

            {/* 单排滚动容器：paddingTop/Bottom 给旋转留空间 */}
            <div style={{
              display: 'flex', gap: 10, alignItems: 'flex-end',
              overflowX: 'auto', paddingTop: 16, paddingBottom: 14,
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.12) transparent',
            }}>

              {/* ── 产品实拍图区 ── */}
              {productImages.map((img, idx) => (
                <div key={idx} style={{ position: 'relative', flexShrink: 0, transform: 'rotate(-3deg)', transition: 'transform 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.transform='rotate(-3deg) translateY(-6px)'}
                  onMouseLeave={e => e.currentTarget.style.transform='rotate(-3deg)'}>
                  <img src={img.url} style={{ width: 74, height: 92, objectFit: 'cover', borderRadius: 11, boxShadow: '0 8px 22px rgba(57,45,26,0.18)', display: 'block' }} />
                  <div onClick={() => removeProdImg(idx)} style={{ position: 'absolute', top: -5, right: -5, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.72)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, cursor: 'pointer', zIndex: 2 }}>×</div>
                </div>
              ))}

              {/* 产品图空插槽（左倾 + 标签嵌入） */}
              <div onClick={() => prodFileRef.current?.click()} style={{
                width: 74, height: 92, borderRadius: 11, background: 'rgba(255,255,255,0.95)',
                transform: 'rotate(-3deg)', cursor: 'pointer', flexShrink: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5,
                border: '2px dashed rgba(0,0,0,0.16)',
                boxShadow: '0 6px 18px rgba(57,45,26,0.08)',
                transition: 'all 0.2s', position: 'relative',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform='rotate(-3deg) translateY(-6px)'; e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.boxShadow='0 12px 28px rgba(124,58,237,0.18)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform='rotate(-3deg)'; e.currentTarget.style.borderColor='rgba(0,0,0,0.16)'; e.currentTarget.style.boxShadow='0 6px 18px rgba(57,45,26,0.08)'; }}>
                {/* 小标签 */}
                {productImages.length === 0 && (
                  <div style={{ position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%) rotate(3deg)', background: 'var(--accent)', color: '#fff', fontSize: 8, fontWeight: 800, padding: '1px 6px', borderRadius: 5, whiteSpace: 'nowrap' }}>📸 产品图</div>
                )}
                <span style={{ display: 'grid', width: 26, height: 26, placeItems: 'center', borderRadius: '50%', background: '#f8f3ea', color: 'var(--text-secondary)' }}><ImagePlus size={13} /></span>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.4, whiteSpace: 'pre-line' }}>
                  {productImages.length === 0 ? '上传产品\n实拍图' : productImages.length === 1 ? '建议补充\n侧面图' : productImages.length === 2 ? '建议补充\n细节特写' : '+添加'}
                </span>
              </div>
              <input ref={prodFileRef} type="file" accept="image/*" multiple hidden onChange={handleProdUpload} />

              {/* ── × 分隔符 ── */}
              <div style={{ flexShrink: 0, alignSelf: 'center', fontSize: 20, color: 'rgba(0,0,0,0.15)', fontWeight: 200, lineHeight: 1, padding: '0 2px', userSelect: 'none' }}>×</div>

              {/* ── 参考图区 ── */}
              {refImages.map((img, idx) => (
                <div key={idx} style={{ position: 'relative', flexShrink: 0, transform: 'rotate(3deg)', transition: 'transform 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.transform='rotate(3deg) translateY(-6px)'}
                  onMouseLeave={e => e.currentTarget.style.transform='rotate(3deg)'}>
                  <img src={img.url} style={{ width: 74, height: 92, objectFit: 'cover', borderRadius: 11, boxShadow: '0 8px 22px rgba(139,92,246,0.20)', display: 'block' }} />
                  <div onClick={() => removeRefImg(idx)} style={{ position: 'absolute', top: -5, right: -5, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.72)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, cursor: 'pointer', zIndex: 2 }}>×</div>
                </div>
              ))}

              {/* 参考图空插槽（右倾 + "可选"标签嵌入） */}
              <div onClick={() => refFileRef.current?.click()} style={{
                width: 74, height: 92, borderRadius: 11, background: 'rgba(255,255,255,0.95)',
                transform: 'rotate(3deg)', cursor: 'pointer', flexShrink: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5,
                border: '2px dashed rgba(139,92,246,0.28)',
                boxShadow: '0 6px 18px rgba(139,92,246,0.08)',
                transition: 'all 0.2s', position: 'relative',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform='rotate(3deg) translateY(-6px)'; e.currentTarget.style.borderColor='#8b5cf6'; e.currentTarget.style.boxShadow='0 12px 28px rgba(139,92,246,0.22)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform='rotate(3deg)'; e.currentTarget.style.borderColor='rgba(139,92,246,0.28)'; e.currentTarget.style.boxShadow='0 6px 18px rgba(139,92,246,0.08)'; }}>
                {/* "可选" badge 嵌在参考图插槽上 */}
                <div style={{ position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%) rotate(-3deg)', background: 'rgba(139,92,246,0.12)', color: '#8b5cf6', fontSize: 8, fontWeight: 800, padding: '1px 7px', borderRadius: 5, border: '1px solid rgba(139,92,246,0.25)', whiteSpace: 'nowrap' }}>🎨 参考图 可选</div>
                <span style={{ display: 'grid', width: 26, height: 26, placeItems: 'center', borderRadius: '50%', background: '#f0ecff', color: '#8b5cf6' }}><ImagePlus size={13} /></span>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#8b5cf6', textAlign: 'center', lineHeight: 1.4, whiteSpace: 'pre-line' }}>
                  {refImages.length === 0 ? '上传竞品\n参考图' : '+添加'}
                </span>
              </div>
              <input ref={refFileRef} type="file" accept="image/*" multiple hidden onChange={handleRefUpload} />
            </div>
          </div>

          {/* ── 文字输入框 ── */}
          <div className="ec-textarea-wrap" style={{ position: 'relative', margin: '8px 16px 16px 20px' }}>
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
                className={isOverridden ? 'ec-btn-overridden' : ''}
                style={{
                  ...BTN_BASE,
                  borderColor: isOverridden ? '#1a1a1a' : 'transparent',
                  borderStyle: 'solid',
                  background: isOpen ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.04)',
                  position: 'relative',
                }}
                onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = 'rgba(0,0,0,0.08)'; }}
                onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}>
                <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{btn.icon}</span>
                <span>{btn.label}</span>
                {isOverridden && <span className="ec-override-dot" />}
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
      </div>

      {/* ═══ 玻璃拟态面板（Portal → body 层）═══ */}
      {renderPanel()}
    </div>
  );
}
