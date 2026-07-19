import React, { useState, useEffect, useRef } from 'react';
import { MdAutoAwesome, MdExpandMore, MdAdd, MdPhotoSizeSelectLarge, MdPalette, MdLabel, MdShoppingCart, MdEdit, MdTune, MdAddPhotoAlternate } from 'react-icons/md';
import { GiTargeting } from 'react-icons/gi';
import { useApp } from '../../store/AppContext';
import SizingPanel from './ec/SizingPanel';
import StylePanel from './ec/StylePanel';
import ParamsPanel from './ec/ParamsPanel';
import SkuPanel from './ec/SkuPanel';
import CopyPanel from './ec/CopyPanel';

/* ═══════ Label helpers ═══════ */
function sizingLabel(sizing, platform) {
  if (sizing?.smart) return '套图配置';
  const pName = { smart: '智能', '淘宝': '淘宝', '京东': '京东', '拼多多': '拼多多', '抖音': '抖音', '小红书': '小红书', '亚马逊': '亚马逊' }[platform] || '';
  return pName ? `${pName} · 自定义` : '套图配置 · 自定义';
}
function styleLabel(v) {
  if (!v || v === 'smart') return '智能风格';
  return { premium_minimal: '高级极简', lifestyle_scene: '生活场景', fashion_editorial: '时尚杂志', warm_natural: '自然暖调', tech_precision: '科技精工' }[v] || v;
}

/* ═══════ EcMode — 三段式第一步：参数配置 ═══════ */
export default function EcMode({ ecStep, setEcStep, onStepChange }) {
  const { state, dispatch } = useApp();

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

  /* — Agent 模式 — */
  const [agentMode, setAgentMode] = useState(true);

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
  const [panelPos, setPanelPos] = useState({ left: 0, width: 0, bottom: 0 });

  /* Esc 关闭 + 点击外部关闭 + 锁定页面滚动 */
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

  const canGen = productImages.length > 0 || description.trim().length > 0;

  /* ── 下一步 → 跳转第二步（不直接生图）── */
  const handleNext = () => {
    if (!canGen) return;
    // 收集所有参数传递给第二步
    onStepChange?.({
      productName: description.trim() || '商品',
      description: description.trim(),
      category: productParams.category || '其他',
      realShots: productImages.map(img => img.url),
      refShots: refImages.map(img => img.url),
      platform,
      sizing,
      styleSkill,
      customColors,
      productParams,
      skus,
      copywriting,
    });
    setEcStep?.(2);
  };

  /* ── 图片上传处理 ── */
  const handleProdUpload = (e) => {
    const files = Array.from(e.target.files || []);
    const newImgs = files.map(f => ({ url: URL.createObjectURL(f), file: f }));
    setProductImages(prev => [...prev, ...newImgs]);
  };
  const handleRefUpload = (e) => {
    const files = Array.from(e.target.files || []);
    const newImgs = files.map(f => ({ url: URL.createObjectURL(f), file: f }));
    setRefImages(prev => [...prev, ...newImgs]);
  };
  const removeProdImg = (idx) => setProductImages(prev => prev.filter((_, i) => i !== idx));
  const removeRefImg = (idx) => setRefImages(prev => prev.filter((_, i) => i !== idx));

  /* ── 6 个按钮定义 ── */
  const BUTTONS = [
    { key: 'sizing', label: sizingLabel(sizing, platform), icon: <MdPhotoSizeSelectLarge size={15} /> },
    { key: 'style', label: styleLabel(styleSkill), icon: <MdPalette size={15} /> },
    { key: 'params', label: '产品参数', icon: <MdLabel size={15} /> },
    { key: 'sku', label: 'SKU变体', icon: <MdShoppingCart size={15} /> },
    { key: 'copy', label: '文案策划', icon: <MdEdit size={15} /> },
  ];

  const isWidePanel = (key) => ['sizing', 'style'].includes(key);

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
                    overflow: 'hidden',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px) rotate(0deg)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'rotate(-5deg)'; e.currentTarget.style.borderColor = 'var(--border)'; }}>
                  <span style={{ display: 'grid', width: 40, height: 40, placeItems: 'center', borderRadius: '50%', background: '#f8f3ea', color: 'var(--text-secondary)', boxShadow: '0 10px 24px rgba(57,45,26,0.12)' }}><MdAddPhotoAlternate size={20} /></span>
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
                  <MdAdd size={18} style={{ color: 'var(--text-muted)' }} />
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
                letterSpacing: 0.5, lineHeight: '14px',
                whiteSpace: 'nowrap',
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
                    overflow: 'hidden',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px) rotate(0deg)'; e.currentTarget.style.borderColor = '#8b5cf6'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'rotate(5deg)'; e.currentTarget.style.borderColor = 'var(--border)'; }}>
                  <span style={{ display: 'grid', width: 40, height: 40, placeItems: 'center', borderRadius: '50%', background: '#f0ecff', color: '#8b5cf6', boxShadow: '0 10px 24px rgba(139,92,246,0.15)' }}><GiTargeting size={20} /></span>
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
                    <MdAdd size={18} style={{ color: 'var(--text-muted)' }} />
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

        {/* ═══ 悬浮配置面板 ═══ */}
        {activePanel && (() => {
          const wide = isWidePanel(activePanel);
          return (
            <div id="ec-floating-panel" style={{
              position: 'absolute',
              bottom: panelPos.bottom,
              ...(wide
                ? { left: 8, right: 8 }
                : { left: panelPos.left, width: panelPos.width }),
              zIndex: 20,
              background: '#fff', borderRadius: 14,
              boxShadow: '0 8px 40px rgba(0,0,0,0.14), 0 2px 12px rgba(0,0,0,0.08)',
              border: '1px solid rgba(0,0,0,0.08)',
              maxHeight: wide ? 480 : 360, overflowY: 'auto',
              animation: 'ecPanelSlideUp 0.2s ease-out',
            }}>
              {activePanel === 'sizing' && (
                <SizingPanel
                  platform={platform} onPlatformChange={setPlatform}
                  sizing={sizing} onSizingChange={setSizing}
                  agentMode={agentMode}
                />
              )}
              {activePanel === 'style' && (
                <StylePanel
                  value={styleSkill} onChange={setStyleSkill}
                  customColors={customColors} onColorsChange={setCustomColors}
                />
              )}
              {activePanel === 'params' && <ParamsPanel params={productParams} onChange={setProductParams} />}
              {activePanel === 'sku' && <SkuPanel skus={skus} onChange={setSkus} />}
              {activePanel === 'copy' && <CopyPanel copywriting={copywriting} onChange={setCopywriting} />}
            </div>
          );
        })()}

        {/* ═══ 配置按钮行 ═══ */}
        <div ref={btnRowRef} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '12px 2px 14px', flexWrap: 'wrap',
          position: 'relative', zIndex: 10,
          borderTop: '1px solid rgba(0,0,0,0.06)',
        }}>
          {/* Agent 模式开关 */}
          <div onClick={() => setAgentMode(!agentMode)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              height: 36, padding: '0 14px', borderRadius: 20,
              cursor: 'pointer',
              border: '2px solid',
              borderColor: agentMode ? '#7c3aed' : 'rgba(0,0,0,0.15)',
              background: agentMode ? 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(236,72,153,0.06))' : '#fff',
              color: agentMode ? '#7c3aed' : 'var(--text-secondary)',
              fontSize: 13, fontWeight: 600,
              fontFamily: 'inherit',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
            }}>
            <MdAutoAwesome size={14} style={{ transition: 'transform 0.3s', transform: agentMode ? 'rotate(45deg)' : 'none' }} />
            <span>{agentMode ? 'Agent' : '手动'}</span>
            <div style={{
              width: 28, height: 16, borderRadius: 8,
              background: agentMode ? '#7c3aed' : 'rgba(0,0,0,0.12)',
              position: 'relative', transition: 'all 0.2s',
            }}>
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                background: '#fff',
                position: 'absolute', top: 2,
                left: agentMode ? 14 : 2,
                transition: 'all 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </div>
          </div>

          {/* 功能按钮 */}
          {BUTTONS.map(btn => (
            <CfgBtn2 key={btn.key} label={btn.label} icon={btn.icon}
              isOpen={activePanel === btn.key}
              btnRef={el => { if (el) btnRefs.current[btn.key] = el; }}
              onClick={() => {
                if (activePanel === btn.key) { setActivePanel(null); return; }
                const el = btnRefs.current[btn.key];
                const card = cardRef.current;
                if (el && card) {
                  const cardRect = card.getBoundingClientRect();
                  const btnRect = el.getBoundingClientRect();
                  const panelW = isWidePanel(btn.key)
                    ? cardRect.width - 16
                    : Math.max(Math.min(btnRect.width + 40, 520), 380);
                  const cardW = cardRect.width;
                  let panelLeft = isWidePanel(btn.key) ? 8 : btnRect.left - cardRect.left;
                  if (!isWidePanel(btn.key)) {
                    if (panelLeft + panelW > cardW) panelLeft = cardW - panelW - 8;
                    if (panelLeft < 8) panelLeft = 8;
                  }
                  const bottomDist = cardRect.bottom - btnRect.top + 8;
                  setPanelPos({ left: panelLeft, width: panelW, bottom: bottomDist });
                }
                setActivePanel(btn.key);
              }} />
          ))}

          {/* 下一步按钮 */}
          <button disabled={!canGen} onClick={handleNext}
            style={{
              marginLeft: 'auto',
              height: 36, padding: '0 20px', borderRadius: 20,
              border: 'none',
              background: canGen
                ? 'linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #f59e0b 100%)'
                : '#ddd',
              color: '#fff', fontSize: 13, fontWeight: 700,
              fontFamily: 'inherit',
              cursor: canGen ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', gap: 6,
              transition: 'all 0.2s',
              boxShadow: canGen
                ? '0 4px 16px rgba(124,58,237,0.3)'
                : 'none',
              flexShrink: 0,
            }}
            onMouseEnter={e => { if (canGen) { e.currentTarget.style.boxShadow = '0 6px 24px rgba(124,58,237,0.4)'; e.currentTarget.style.transform = 'scale(1.02)'; } }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = canGen ? '0 4px 16px rgba(124,58,237,0.3)' : 'none'; e.currentTarget.style.transform = 'none'; }}>
            下一步
            <span style={{ fontSize: 15, lineHeight: 1 }}>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}


/* ═══════ CfgBtn2 ═══════ */
function CfgBtn2({ label, icon, isOpen, onClick, btnRef }) {
  return (
    <div ref={btnRef} onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      height: 36, padding: '0 14px', borderRadius: 20,
      cursor: 'pointer',
      border: '2px solid',
      borderColor: isOpen ? '#1a1a1a' : 'rgba(0,0,0,0.15)',
      background: isOpen ? '#1a1a1a' : '#fff',
      color: isOpen ? '#fff' : 'var(--text-secondary)',
      fontSize: 13, fontWeight: 600,
      fontFamily: 'inherit',
      transition: 'all 0.15s ease',
      boxShadow: isOpen ? 'inset 0 1px 3px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.04)',
      userSelect: 'none', whiteSpace: 'nowrap',
    }}
    onMouseEnter={e => { if (!isOpen) { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.3)'; e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; } }}
    onMouseLeave={e => { if (!isOpen) { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.15)'; e.currentTarget.style.background = '#fff'; } }}>
      <span style={{ display: 'flex', color: isOpen ? '#fff' : '#e74c3c', transition: 'color 0.18s' }}>{icon}</span>
      <span>{label}</span>
      <MdExpandMore size={13} style={{
        opacity: 0.5,
        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 0.22s ease',
      }} />
    </div>
  );
}
