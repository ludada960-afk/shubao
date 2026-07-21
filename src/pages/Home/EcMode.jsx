import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles, ChevronDown, Plus, ImagePlus,
  // 高级 AI 感图标
  Images,  // 套图配置
  Wand2,   // 画面风格
  SlidersHorizontal, // 产品参数
  Package, // SKU 变体
  FileText // 文案策划
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import SizingPanel from './ec/SizingPanel';
import StylePanel from './ec/StylePanel';
import ParamsPanel from './ec/ParamsPanel';
import SkuPanel from './ec/SkuPanel';
import CopyPanel from './ec/CopyPanel';

/* ═══════ 智能方案状态常量 ═══════ */
const SMART_LABELS = { on: '智能生图方案', tuned: '智能方案（已微调）', off: '手动配置' };

/* ═══════ 统一按钮样式（升级：胶囊形状+渐变）═══════ */
const BTN_BASE = {
  height: 40, padding: '0 18px', borderRadius: 20,
  fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
  border: '1.5px solid transparent', 
  background: 'rgba(255,255,255,0.8)',
  color: 'var(--text-secondary)', 
  transition: 'all 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
  whiteSpace: 'nowrap', userSelect: 'none', flexShrink: 0,
  boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
};

/* ═══════ 玻璃拟态面板样式（AI 感升级）═══════ */
const GLASS_PANEL = {
  borderRadius: 20,
  background: 'rgba(255, 255, 255, 0.85)',
  backdropFilter: 'blur(40px) saturate(220%)',
  WebkitBackdropFilter: 'blur(40px) saturate(220%)',
  border: '1px solid rgba(255, 255, 255, 0.7)',
  boxShadow: '0 12px 48px rgba(124, 58, 237, 0.15), 0 4px 16px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -1px 0 rgba(255,255,255,0.5)',
  animation: 'ecGlassSlideUp 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
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
  const handleOverride = useCallback((panel, isOverridden = true) => {
    setSmartOverrides(prev => ({ ...prev, [panel]: isOverridden }));
  }, []);

  /* — 重置特定面板的 override 状态 —— */
  const resetOverride = useCallback((panel) => {
    setSmartOverrides(prev => ({ ...prev, [panel]: false }));
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
  const removeProdImg = (idx) => {
    setProductImages(prev => {
      const removed = prev[idx];
      if (removed?.url?.startsWith('blob:')) URL.revokeObjectURL(removed.url);
      return prev.filter((_, i) => i !== idx);
    });
  };
  const removeRefImg = (idx) => {
    setRefImages(prev => {
      const removed = prev[idx];
      if (removed?.url?.startsWith('blob:')) URL.revokeObjectURL(removed.url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  /* ── 组件卸载时释放所有 Object URL 防止内存泄漏 ── */
  useEffect(() => {
    return () => {
      productImages.forEach(img => { if (img?.url?.startsWith('blob:')) URL.revokeObjectURL(img.url); });
      refImages.forEach(img => { if (img?.url?.startsWith('blob:')) URL.revokeObjectURL(img.url); });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── 智能方案切换 ── */
  const toggleSmart = () => {
    const next = !smartMode;
    setSmartMode(next);
    if (next) {
      setSmartOverrides({ sizing: false, style: false, params: false, copy: false });
    }
  };

  /* ── 5 个功能按钮（AI 感图标升级）── */
  const BUTTONS = [
    { key: 'sizing', label: '套图配置', icon: <Images size={15} strokeWidth={1.8} /> },
    { key: 'style', label: '画面风格', icon: <Wand2 size={15} strokeWidth={1.8} /> },
    { key: 'params', label: '产品参数', icon: <SlidersHorizontal size={15} strokeWidth={1.8} /> },
    { key: 'sku', label: 'SKU 变体', icon: <Package size={15} strokeWidth={1.8} /> },
    { key: 'copy', label: '文案策划', icon: <FileText size={15} strokeWidth={1.8} /> },
  ];

  /* ── 面板定位（Portal 视口坐标，吸附按钮正上方）── */
  const openPanel = useCallback((key) => {
    if (activePanel === key) { setActivePanel(null); return; }
    const el = btnRefs.current[key];
    if (el) {
      const vw = window.innerWidth;
      const btnRect = el.getBoundingClientRect();
      // 面板宽度：根据内容类型调整，文案策划更宽
      const isCopyPanel = key === 'copy';
      const isSizingPanel = key === 'sizing';
      const baseWidth = isCopyPanel ? 520 : isSizingPanel ? 460 : 420;
      const maxPW = Math.min(vw - 32, 640);
      const panelW = Math.min(Math.max(baseWidth, 400), maxPW);
      let panelLeft = btnRect.left + btnRect.width / 2 - panelW / 2;
      // 边缘修正
      if (panelLeft < 16) panelLeft = 16;
      if (panelLeft + panelW > vw - 16) panelLeft = vw - panelW - 16;
      // 面板底部紧贴按钮上方（吸附效果：gap 减小到 6px）
      const gap = 6;
      const panelBottom = window.innerHeight - btnRect.top + gap;
      // 安全最大高度 = 按钮上方可用空间
      const maxH = Math.max(280, btnRect.top - 24);
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
            onResetOverride={() => resetOverride('style')}
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

  // 步骤指示器组件
  const StepIndicator = () => {
    const steps = [
      { num: 1, label: '上传产品', desc: '上传实拍图+描述' },
      { num: 2, label: '确认方向', desc: 'AI分析生成方案' },
      { num: 3, label: '生成套图', desc: '无限画布编辑' },
    ];
    
    return (
      <div style={{ 
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 8, marginBottom: 16, padding: '0 16px',
      }}>
        {steps.map((step, idx) => {
          const isActive = ecStep === step.num;
          const isCompleted = ecStep > step.num;
          const isLast = idx === steps.length - 1;
          
          return (
            <React.Fragment key={step.num}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 16px',
                borderRadius: 12,
                background: isActive 
                  ? 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)' 
                  : isCompleted 
                    ? 'rgba(124,58,237,0.1)' 
                    : 'rgba(0,0,0,0.03)',
                border: isActive 
                  ? 'none' 
                  : isCompleted 
                    ? '1px solid rgba(124,58,237,0.2)' 
                    : '1px solid rgba(0,0,0,0.06)',
                transition: 'all 0.3s ease',
              }}>
                {/* 步骤数字 */}
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 800,
                  background: isActive 
                    ? 'rgba(255,255,255,0.2)' 
                    : isCompleted 
                      ? '#7c3aed' 
                      : 'rgba(0,0,0,0.08)',
                  color: isActive || isCompleted ? '#fff' : '#999',
                }}>
                  {isCompleted ? '✓' : step.num}
                </div>
                
                {/* 步骤文字 */}
                <div>
                  <div style={{
                    fontSize: 13, fontWeight: 700,
                    color: isActive ? '#fff' : isCompleted ? '#1a1a1a' : '#999',
                  }}>
                    {step.label}
                  </div>
                  <div style={{
                    fontSize: 10,
                    color: isActive ? 'rgba(255,255,255,0.8)' : isCompleted ? '#666' : '#bbb',
                  }}>
                    {step.desc}
                  </div>
                </div>
              </div>
              
              {/* 连接线 */}
              {!isLast && (
                <div style={{
                  width: 24, height: 2,
                  background: isCompleted 
                    ? 'linear-gradient(90deg, #7c3aed, #a78bfa)' 
                    : 'rgba(0,0,0,0.06)',
                  borderRadius: 1,
                }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  return (
    <div>
      {/* ═══ 步骤指示器 ═══ */}
      <StepIndicator />
      
      {/* ═══ 白色卡片 ═══ */}
      <div ref={cardRef} style={{ borderRadius: 20, margin: '0 16px', background: '#fff', padding: '16px 20px 20px', position: 'relative' }}>
        {/* ═══ 左右分栏布局：左侧上传区 + 右侧文字输入 ═══ */}
        <div style={{ display: 'flex', gap: 20, minHeight: 280 }}>
          
          {/* ── 左侧：上传区 ── */}
          <div style={{ 
            width: 280, flexShrink: 0,
            borderRadius: 16, 
            background: 'linear-gradient(180deg, #FAF7F2 0%, #FDF9F5 100%)',
            border: '1px solid rgba(139,92,246,0.08)',
            padding: 16,
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            {/* 产品图上传区 */}
            <div>
              <div style={{ 
                display: 'flex', alignItems: 'center', gap: 6, 
                marginBottom: 10,
                fontSize: 13, fontWeight: 700, color: '#1a1a1a' 
              }}>
                <span style={{ 
                  width: 22, height: 22, borderRadius: 6,
                  background: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12,
                }}>📸</span>
                产品实拍图
                <span style={{ 
                  fontSize: 10, fontWeight: 500, color: '#7c3aed',
                  background: 'rgba(124,58,237,0.1)', padding: '2px 8px',
                  borderRadius: 10, marginLeft: 'auto',
                }}>必须</span>
              </div>
              
              {/* 产品图网格 */}
              <div style={{ 
                display: 'flex', flexWrap: 'wrap', gap: 8,
                minHeight: 90, alignContent: 'flex-start',
              }}>
                {productImages.map((img, idx) => (
                  <div key={idx} style={{ 
                    position: 'relative', 
                    width: 72, height: 72,
                    borderRadius: 10,
                    overflow: 'hidden',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  }}>
                    <img src={img.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div onClick={() => removeProdImg(idx)} style={{ 
                      position: 'absolute', top: 2, right: 2,
                      width: 18, height: 18, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.7)', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, cursor: 'pointer', zIndex: 2,
                    }}>×</div>
                  </div>
                ))}
                
                {/* 添加按钮 */}
                <div onClick={() => prodFileRef.current?.click()} style={{
                  width: 72, height: 72, borderRadius: 10,
                  border: '2px dashed rgba(124,58,237,0.3)',
                  background: 'rgba(255,255,255,0.8)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 4, cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = '#7c3aed';
                    e.currentTarget.style.background = 'rgba(124,58,237,0.05)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'rgba(124,58,237,0.3)';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.8)';
                  }}>
                  <ImagePlus size={18} color="#7c3aed" />
                  <span style={{ fontSize: 9, color: '#7c3aed', fontWeight: 600 }}>
                    {productImages.length === 0 ? '点击上传' : '+添加'}
                  </span>
                </div>
              </div>
              
              {/* 提示文字 */}
              <div style={{ fontSize: 11, color: '#999', marginTop: 6 }}>
                {productImages.length === 0 ? '建议上传正面、侧面、细节图' : `已上传 ${productImages.length} 张`}
              </div>
            </div>
            
            <input ref={prodFileRef} type="file" accept="image/*" multiple hidden onChange={handleProdUpload} />
            
            {/* 分隔线 */}
            <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '4px 0' }} />
            
            {/* 参考图上传区 */}
            <div>
              <div style={{ 
                display: 'flex', alignItems: 'center', gap: 6, 
                marginBottom: 10,
                fontSize: 13, fontWeight: 700, color: '#1a1a1a' 
              }}>
                <span style={{ 
                  width: 22, height: 22, borderRadius: 6,
                  background: 'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12,
                }}>🎨</span>
                风格参考图
                <span style={{ 
                  fontSize: 10, fontWeight: 500, color: '#999',
                  background: 'rgba(0,0,0,0.04)', padding: '2px 8px',
                  borderRadius: 10, marginLeft: 'auto',
                }}>可选</span>
              </div>
              
              {/* 参考图网格 */}
              <div style={{ 
                display: 'flex', flexWrap: 'wrap', gap: 8,
                minHeight: 72, alignContent: 'flex-start',
              }}>
                {refImages.map((img, idx) => (
                  <div key={idx} style={{ 
                    position: 'relative', 
                    width: 64, height: 64,
                    borderRadius: 8,
                    overflow: 'hidden',
                    boxShadow: '0 3px 10px rgba(0,0,0,0.08)',
                  }}>
                    <img src={img.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div onClick={() => removeRefImg(idx)} style={{ 
                      position: 'absolute', top: 2, right: 2,
                      width: 16, height: 16, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.7)', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, cursor: 'pointer', zIndex: 2,
                    }}>×</div>
                  </div>
                ))}
                
                {/* 添加按钮 */}
                <div onClick={() => refFileRef.current?.click()} style={{
                  width: 64, height: 64, borderRadius: 8,
                  border: '2px dashed rgba(236,72,153,0.3)',
                  background: 'rgba(255,255,255,0.8)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 3, cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = '#ec4899';
                    e.currentTarget.style.background = 'rgba(236,72,153,0.05)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'rgba(236,72,153,0.3)';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.8)';
                  }}>
                  <ImagePlus size={16} color="#ec4899" />
                  <span style={{ fontSize: 8, color: '#ec4899', fontWeight: 600 }}>
                    {refImages.length === 0 ? '上传' : '+添加'}
                  </span>
                </div>
              </div>
              
              {/* 提示文字 */}
              <div style={{ fontSize: 11, color: '#999', marginTop: 6 }}>
                {refImages.length === 0 ? '上传竞品参考图，AI学习其风格' : `已上传 ${refImages.length} 张`}
              </div>
            </div>
            
            <input ref={refFileRef} type="file" accept="image/*" multiple hidden onChange={handleRefUpload} />
          </div>
          
          {/* ── 右侧：文字输入区 ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ 
              display: 'flex', alignItems: 'center', gap: 6, 
              marginBottom: 12,
              fontSize: 13, fontWeight: 700, color: '#1a1a1a' 
            }}>
              <span style={{ 
                width: 22, height: 22, borderRadius: 6,
                background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12,
              }}>📝</span>
              产品描述
            </div>
            
            <div className="ec-textarea-wrap" style={{ 
              position: 'relative', 
              flex: 1,
              background: 'linear-gradient(180deg, #FAF7F2 0%, #FDF9F5 100%)',
              borderRadius: 12,
              border: '1px solid rgba(139,92,246,0.08)',
              padding: 16,
            }}>
              {!description && (
                <div className="ec-textarea-placeholder" style={{ 
                  fontSize: 15, lineHeight: '28px', color: '#999',
                  position: 'absolute', top: 16, left: 16, right: 16,
                  pointerEvents: 'none',
                }}>
                  <div>描述你的产品名称、特点、材质、用途…</div>
                  <div style={{ marginTop: 12, color: '#bbb' }}>
                    例如：<br/>
                    • 白色陶瓷马克杯，简约北欧风<br/>
                    • 容量350ml，带木质把手<br/>
                    • 适合办公家用，可定制logo
                  </div>
                </div>
              )}
              <textarea 
                value={description} 
                onChange={e => setDescription(e.target.value)}
                placeholder={!description ? '' : '描述你的产品…'}
                style={{
                  width: '100%', height: '100%', minHeight: 180,
                  border: 'none', background: 'transparent',
                  padding: 0, fontSize: 15, lineHeight: '28px', 
                  color: 'var(--text-primary)',
                  outline: 'none', resize: 'none', fontFamily: 'inherit',
                  position: 'relative', zIndex: 1,
                }}
              />
            </div>
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

          {/* ── 5 个功能按钮（带配置回显）── */}
          {BUTTONS.map(btn => {
            const isOpen = activePanel === btn.key;
            const isOverridden = smartMode && smartOverrides[btn.key];
            // 计算配置摘要
            const getConfigSummary = () => {
              if (!smartMode || !isOverridden) return null;
              switch (btn.key) {
                case 'sizing': {
                  if (sizing?.smart) return null;
                  const counts = sizing?.images?.reduce((acc, img) => {
                    acc[img.type] = (acc[img.type] || 0) + 1;
                    return acc;
                  }, {});
                  const parts = [];
                  if (counts?.white) parts.push(`${counts.white}白底`);
                  if (counts?.main) parts.push(`${counts.main}主图`);
                  if (counts?.detail) parts.push(`${counts.detail}详情`);
                  return parts.length ? parts.join('·') : null;
                }
                case 'style': {
                  if (styleSkill === 'smart') return null;
                  const styleMap = { clean: '简约白', scene: '场景图', brand: '品牌色' };
                  const colorCount = customColors?.length || 0;
                  const base = styleMap[styleSkill] || styleSkill;
                  return colorCount ? `${base}+${colorCount}色` : base;
                }
                case 'params': {
                  const filled = Object.entries(productParams).filter(([k, v]) => v && v.trim?.()).map(([k]) => k);
                  return filled.length ? `${filled.length}项已填` : null;
                }
                case 'sku': {
                  const validSkus = skus?.filter(s => s.color || s.size || s.capacity) || [];
                  return validSkus.length ? `${validSkus.length}个变体` : null;
                }
                case 'copy': {
                  const hasCopy = copywriting?.sellingPoints || copywriting?.plan;
                  return hasCopy ? '已配置' : null;
                }
                default: return null;
              }
            };
            const summary = getConfigSummary();
            return (
              <div key={btn.key} ref={el => { if (el) btnRefs.current[btn.key] = el; }}
                onClick={() => openPanel(btn.key)}
                className={isOverridden ? 'ec-btn-overridden' : ''}
                style={{
                  ...BTN_BASE,
                  borderColor: isOverridden ? '#7c3aed' : 'rgba(0,0,0,0.08)',
                  borderStyle: 'solid',
                  background: isOpen 
                    ? 'linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(236,72,153,0.08) 100%)' 
                    : isOverridden 
                      ? 'linear-gradient(135deg, rgba(124,58,237,0.06) 0%, rgba(255,255,255,0.95) 100%)'
                      : 'rgba(255,255,255,0.85)',
                  position: 'relative',
                  boxShadow: isOpen 
                    ? '0 4px 16px rgba(124,58,237,0.2), inset 0 1px 0 rgba(255,255,255,0.8)' 
                    : isOverridden 
                      ? '0 2px 8px rgba(124,58,237,0.12), inset 0 1px 0 rgba(255,255,255,0.9)'
                      : BTN_BASE.boxShadow,
                }}
                onMouseEnter={e => { 
                  if (!isOpen) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(255,255,255,0.98) 100%)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(124,58,237,0.15), inset 0 1px 0 rgba(255,255,255,0.9)';
                  }
                }}
                onMouseLeave={e => { 
                  if (!isOpen) {
                    e.currentTarget.style.background = isOverridden 
                      ? 'linear-gradient(135deg, rgba(124,58,237,0.06) 0%, rgba(255,255,255,0.95) 100%)'
                      : 'rgba(255,255,255,0.85)';
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = isOverridden 
                      ? '0 2px 8px rgba(124,58,237,0.12), inset 0 1px 0 rgba(255,255,255,0.9)'
                      : BTN_BASE.boxShadow;
                  }
                }}>
                <span style={{ 
                  color: isOverridden ? '#7c3aed' : 'var(--text-muted)', 
                  flexShrink: 0,
                  filter: isOverridden ? 'drop-shadow(0 1px 2px rgba(124,58,237,0.2))' : 'none',
                }}>{btn.icon}</span>
                <span style={{ color: isOverridden ? '#1a1a1a' : 'var(--text-secondary)' }}>{btn.label}</span>
                {summary && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: '#7c3aed',
                    background: 'rgba(124,58,237,0.1)', padding: '2px 8px',
                    borderRadius: 10, marginLeft: 4,
                    border: '1px solid rgba(124,58,237,0.15)',
                  }}>{summary}</span>
                )}
                {isOverridden && !summary && <span className="ec-override-dot" />}
                <ChevronDown size={13} style={{
                  opacity: isOpen ? 0.8 : 0.4,
                  color: isOverridden ? '#7c3aed' : 'var(--text-muted)',
                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.22s ease, opacity 0.2s',
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
