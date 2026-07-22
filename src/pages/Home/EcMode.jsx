import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import SizingPanel, { PLATFORM_PRESETS } from './ec/SizingPanel';
import StylePanel from './ec/StylePanel';
import ParamsPanel from './ec/ParamsPanel';
import SkuPanel from './ec/SkuPanel';
import CopyPanel from './ec/CopyPanel';

/* ═══════ 智能方案状态常量 ═══════
 * 智能方案逻辑：
 * - ON:  完全由AI根据产品信息自动选择最佳配置（平台、风格、文案等）
 * - TUNED: 基于智能推荐，但用户在某个面板做了自定义调整
 * - OFF: 完全手动配置，不使用AI推荐
 * 交互规则：
 * - 打开面板修改配置 → 该面板标记为已覆盖（紫色边框+标签）
 * - 关闭智能开关 → 所有配置转为手动，保留当前值
 * - 重新开启智能 → 重置所有覆盖，恢复AI推荐
 */
const SMART_LABELS = { on: 'AI智能方案', tuned: 'AI方案·已微调', off: '手动配置' };

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

  /* ── 产品图上传建议提示 ── */
  const getProdHint = (count) => {
    if (count === 0) return '建议上传 3-5 张产品图（正面、侧面、细节），多角度让 AI 生成更精准';
    if (count === 1) return '✓ 已上传正面图，建议再上传侧面图和细节图';
    if (count === 2) return '✓ 已上传 2 张，建议再上传 1-3 张细节/使用场景图';
    if (count >= 3 && count <= 5) return `✓ 已上传 ${count} 张，数量合适，AI 生成效果最佳`;
    return `已上传 ${count} 张产品图`;
  };

  /* ── 参考图上传建议提示 ── */
  const getRefHint = (count) => {
    if (count === 0) return '可上传竞品图、爆款图或喜欢的风格图（支持批量上传）';
    return `已上传 ${count} 张参考图`;
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

  /* ── 面板定位（相对于按钮行的绝对定位，滚动时跟随）── */
  const openPanel = useCallback((key) => {
    if (activePanel === key) { setActivePanel(null); return; }
    const el = btnRefs.current[key];
    const btnRow = btnRowRef.current;
    if (el && btnRow) {
      const btnRect = el.getBoundingClientRect();
      const rowRect = btnRow.getBoundingClientRect();
      const vw = window.innerWidth;
      
      // 面板宽度：根据内容类型调整
      const isCopyPanel = key === 'copy';
      const isSizingPanel = key === 'sizing';
      const baseWidth = isCopyPanel ? 520 : isSizingPanel ? 460 : 420;
      const maxPW = Math.min(vw - 32, 640);
      const panelW = Math.min(Math.max(baseWidth, 400), maxPW);
      
      // 计算相对于按钮行的位置
      const btnCenterInRow = (btnRect.left - rowRect.left) + btnRect.width / 2;
      let panelLeft = btnCenterInRow - panelW / 2;
      
      // 边缘修正（确保不超出视口）
      const rowLeftInViewport = rowRect.left;
      if (rowLeftInViewport + panelLeft < 16) {
        panelLeft = 16 - rowLeftInViewport;
      }
      if (rowLeftInViewport + panelLeft + panelW > vw - 16) {
        panelLeft = vw - 16 - panelW - rowLeftInViewport;
      }
      
      // 面板底部紧贴按钮上方（相对于按钮行）
      const gap = 8;
      const panelBottom = rowRect.height + gap;
      
      // 安全最大高度
      const maxH = Math.max(300, rowRect.top - 24);
      
      setPanelPos({ 
        left: panelLeft, 
        bottom: panelBottom, 
        width: panelW, 
        maxH, 
        btnCenterX: btnCenterInRow 
      });
    }
    setActivePanel(key);
  }, [activePanel]);

  /* ── 内联渲染面板（相对于按钮行定位，滚动时跟随）── */
  const renderPanel = () => {
    if (!activePanel) return null;
    // 箭头相对于面板的水平位置
    const arrowLeft = Math.max(16, Math.min(panelPos.btnCenterX - panelPos.left, panelPos.width - 16));
    return (
      <>
        {/* ── 连接箭头（指向按钮）── */}
        <div className="ec-panel-arrow" style={{
          position: 'absolute',
          bottom: panelPos.bottom - 6,
          left: panelPos.btnCenterX - 8,
          width: 0, height: 0,
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderTop: '8px solid rgba(255,255,255,0.95)',
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.08))',
          zIndex: 100,
          pointerEvents: 'none',
        }} />
        {/* ── 面板本体 ── */}
        <div id="ec-floating-panel" style={{
          ...GLASS_PANEL,
          position: 'absolute',
          bottom: panelPos.bottom,
          left: panelPos.left,
          width: panelPos.width,
          maxHeight: panelPos.maxH,
          overflowY: 'auto',
          zIndex: 101,
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
      </>
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
      
      {/* ═══ 暖黄色背景卡片（与小红书图文一致）═══ */}
      <div ref={cardRef} style={{ borderRadius: 20, margin: '0 16px', background: '#FAF7F2', padding: '16px 20px 20px', position: 'relative', border: '1px solid rgba(139,92,246,0.06)' }}>
        {/* ═══ 上下布局：上方双列上传区 + 下方文字输入 ═══ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* ── 上方：双列上传区（产品图 × 参考图，斜框对称样式）── */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
            {/* 产品图上传区 - 左歪（基于小红书图文样式） */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div className="ec-upload-tilt-left" style={{
                background: '#fff',
                borderRadius: 16,
                border: '2px dashed #ddd',
                padding: '14px 12px',
                minHeight: 110,
                transition: 'all 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
                transform: 'rotate(-1.5deg)',
                transformOrigin: 'center center',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#7c3aed';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(124,58,237,0.12)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#ddd';
                e.currentTarget.style.boxShadow = 'none';
              }}>
                {/* 标题行 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, transform: 'rotate(1.5deg)' }}>
                  <span style={{ fontSize: 12 }}>📸</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a' }}>产品实拍图</span>
                  <span style={{ fontSize: 10, color: '#7c3aed', background: 'rgba(124,58,237,0.08)', padding: '1px 6px', borderRadius: 8, marginLeft: 'auto', fontWeight: 600 }}>必须</span>
                </div>
                
                {/* 横向滚动的图片行 */}
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, transform: 'rotate(1.5deg)' }}>
                  {productImages.map((img, idx) => (
                    <div key={idx} style={{ 
                      position: 'relative', width: 64, height: 64,
                      borderRadius: 10, overflow: 'hidden',
                      border: '2px solid #eee', flex: '0 0 auto',
                    }}>
                      <img src={img.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div onClick={() => removeProdImg(idx)} style={{ 
                        position: 'absolute', top: -5, right: -5,
                        width: 18, height: 18, borderRadius: '50%',
                        background: '#FF3B5C', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, cursor: 'pointer', border: '2px solid #fff', fontWeight: 700,
                      }}>×</div>
                    </div>
                  ))}
                  
                  {/* 添加按钮 */}
                  <div onClick={() => prodFileRef.current?.click()} style={{
                    width: 64, height: 64, borderRadius: 10,
                    border: '2px dashed #ccc',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 2, cursor: 'pointer', transition: 'all 0.15s',
                    background: '#fff', flex: '0 0 auto',
                  }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = '#7c3aed';
                      e.currentTarget.style.color = '#7c3aed';
                      e.currentTarget.style.background = 'rgba(124,58,237,0.04)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = '#ccc';
                      e.currentTarget.style.color = '#999';
                      e.currentTarget.style.background = '#fff';
                    }}>
                    <ImagePlus size={16} color="#999" />
                    <span style={{ fontSize: 9, color: '#999', fontWeight: 600 }}>{productImages.length === 0 ? '上传' : '+'}</span>
                  </div>
                </div>
                
                {/* 提示文字 */}
                <div style={{ fontSize: 11, color: '#999', marginTop: 8, transform: 'rotate(1.5deg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {getProdHint(productImages.length)}
                </div>
              </div>
              
              <input ref={prodFileRef} type="file" accept="image/*" multiple hidden onChange={handleProdUpload} />
            </div>
            
            {/* 乘号分隔 */}
            <div style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flex: '0 0 auto', padding: '0 4px', alignSelf: 'center',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 14, fontWeight: 800,
                boxShadow: '0 2px 8px rgba(124,58,237,0.3)',
              }}>×</div>
            </div>
            
            {/* 参考图上传区 - 右歪（基于小红书图文样式，对称翻转） */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div className="ec-upload-tilt-right" style={{
                background: '#fff',
                borderRadius: 16,
                border: '2px dashed #ddd',
                padding: '14px 12px',
                minHeight: 110,
                transition: 'all 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
                transform: 'rotate(1.5deg)',
                transformOrigin: 'center center',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#ec4899';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(236,72,153,0.12)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#ddd';
                e.currentTarget.style.boxShadow = 'none';
              }}>
                {/* 标题行 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, transform: 'rotate(-1.5deg)' }}>
                  <span style={{ fontSize: 12 }}>🎨</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a' }}>风格参考图</span>
                  <span style={{ fontSize: 10, color: '#999', background: 'rgba(0,0,0,0.04)', padding: '1px 6px', borderRadius: 8, marginLeft: 'auto', fontWeight: 500 }}>可选</span>
                </div>
                
                {/* 横向滚动的图片行 */}
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, transform: 'rotate(-1.5deg)' }}>
                  {refImages.map((img, idx) => (
                    <div key={idx} style={{ 
                      position: 'relative', width: 64, height: 64,
                      borderRadius: 10, overflow: 'hidden',
                      border: '2px solid #eee', flex: '0 0 auto',
                    }}>
                      <img src={img.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div onClick={() => removeRefImg(idx)} style={{ 
                        position: 'absolute', top: -5, right: -5,
                        width: 18, height: 18, borderRadius: '50%',
                        background: '#FF3B5C', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, cursor: 'pointer', border: '2px solid #fff', fontWeight: 700,
                      }}>×</div>
                    </div>
                  ))}
                  
                  {/* 添加按钮 */}
                  <div onClick={() => refFileRef.current?.click()} style={{
                    width: 64, height: 64, borderRadius: 10,
                    border: '2px dashed #ccc',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 2, cursor: 'pointer', transition: 'all 0.15s',
                    background: '#fff', flex: '0 0 auto',
                  }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = '#ec4899';
                      e.currentTarget.style.color = '#ec4899';
                      e.currentTarget.style.background = 'rgba(236,72,153,0.04)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = '#ccc';
                      e.currentTarget.style.color = '#999';
                      e.currentTarget.style.background = '#fff';
                    }}>
                    <ImagePlus size={16} color="#999" />
                    <span style={{ fontSize: 9, color: '#999', fontWeight: 600 }}>{refImages.length === 0 ? '上传' : '+'}</span>
                  </div>
                </div>
                
                {/* 提示文字 */}
                <div style={{ fontSize: 11, color: '#999', marginTop: 8, transform: 'rotate(-1.5deg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {getRefHint(refImages.length)}
                </div>
              </div>
              
              <input ref={refFileRef} type="file" accept="image/*" multiple hidden onChange={handleRefUpload} />
            </div>
          </div>
          
          {/* ── 下方：产品描述输入区 ── */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="ec-textarea-wrap" style={{ 
              position: 'relative', 
              background: '#fff',
              borderRadius: 12,
              border: '1px solid rgba(0,0,0,0.08)',
              padding: 16,
              minHeight: 120,
            }}>
              {!description && (
                <div className="ec-textarea-placeholder" style={{ 
                  fontSize: 15, lineHeight: '28px', color: '#999',
                  position: 'absolute', top: 16, left: 16, right: 16,
                  pointerEvents: 'none',
                }}>
                  <div>描述你的产品名称、特点、材质、用途…</div>
                  <div style={{ marginTop: 8, color: '#bbb' }}>
                    例如：白色陶瓷马克杯，简约北欧风，容量350ml，带木质把手，适合办公家用，可定制logo
                  </div>
                </div>
              )}
              <textarea 
                value={description} 
                onChange={e => setDescription(e.target.value)}
                placeholder={!description ? '' : '描述你的产品…'}
                style={{
                  width: '100%', height: '100%', minHeight: 100,
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

        {/* ═══ 配置按钮行（相对定位容器，面板在此内部绝对定位）═══ */}
        <div ref={btnRowRef} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '12px 2px 14px', flexWrap: 'wrap',
          position: 'relative', zIndex: 10,
          borderTop: '1px solid rgba(0,0,0,0.06)',
        }}>
          {/* ═══ 面板渲染（内联，相对于按钮行定位）═══ */}
          {renderPanel()}
          {/* ── 5 个功能按钮（带配置回显 - 类似椒图AI）── */}
          {BUTTONS.map(btn => {
            const isOpen = activePanel === btn.key;
            const isOverridden = smartMode && smartOverrides[btn.key];
            // 计算配置摘要（始终显示，类似椒图AI）
            const getConfigSummary = () => {
              switch (btn.key) {
                case 'sizing': {
                  // 智能模式下未覆盖时显示智能推荐
                  if (smartMode && !smartOverrides.sizing) {
                    const preset = PLATFORM_PRESETS[platform] || PLATFORM_PRESETS.smart;
                    return { text: preset.name, isSmart: true };
                  }
                  // 显示具体配置
                  const images = sizing?.images || [];
                  const total = images.reduce((s, img) => s + (img.count || 0), 0);
                  if (total === 0) return { text: '未配置', isSmart: false };
                  const typeLabels = [];
                  images.forEach(img => {
                    if (img.count > 0) {
                      const shortLabel = img.label?.replace('商品', '').replace('图片', '').replace('白底', '白底') || img.key;
                      typeLabels.push(`${img.count}${shortLabel}`);
                    }
                  });
                  const text = typeLabels.slice(0, 2).join('·');
                  return { text: typeLabels.length > 2 ? `${text}…` : text, isSmart: false };
                }
                case 'style': {
                  if (smartMode && !smartOverrides.style) {
                    return { text: '智能匹配', isSmart: true };
                  }
                  const styleMap = {
                    smart: '智能',
                    premium_minimal: '高级极简',
                    lifestyle_scene: '生活场景',
                    fashion_editorial: '时尚杂志',
                    warm_natural: '自然暖调',
                    tech_precision: '科技精工'
                  };
                  const base = styleMap[styleSkill] || styleSkill;
                  const hasColor = customColors && customColors.length > 0;
                  return { text: hasColor ? `${base}+品牌色` : base, isSmart: false };
                }
                case 'params': {
                  if (smartMode && !smartOverrides.params) {
                    return { text: '智能提取', isSmart: true };
                  }
                  const filled = Object.entries(productParams).filter(([k, v]) => v && v.trim?.()).length;
                  return filled > 0
                    ? { text: `${filled}项已填`, isSmart: false }
                    : { text: '未填写', isSmart: false };
                }
                case 'sku': {
                  const validSkus = skus?.filter(s => s.color || s.size || s.capacity) || [];
                  const totalSkuImages = validSkus.reduce((a, s) => a + (s.count || 1), 0);
                  if (validSkus.length === 0) return { text: '未配置', isSmart: false };
                  return { text: `${validSkus.length}变体·${totalSkuImages}张`, isSmart: false };
                }
                case 'copy': {
                  if (smartMode && !smartOverrides.copy) {
                    return { text: '智能生成', isSmart: true };
                  }
                  const fields = ['plan', 'sellingPoints', 'qc', 'details', 'maintenance'];
                  const filled = fields.filter(k => copywriting?.[k]?.trim?.()).length;
                  return filled > 0
                    ? { text: `${filled}项已填`, isSmart: false }
                    : { text: '未填写', isSmart: false };
                }
                default: return { text: null, isSmart: false };
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
                {/* 焦图AI风格：直接显示配置内容，替代原有标签 */}
                {summary.text ? (
                  <span style={{ 
                    color: isOverridden ? '#1a1a1a' : 'var(--text-secondary)',
                    fontWeight: isOverridden ? 700 : 600,
                  }}>{summary.text}</span>
                ) : (
                  <span style={{ color: isOverridden ? '#1a1a1a' : 'var(--text-secondary)' }}>{btn.label}</span>
                )}
                {isOverridden && !summary.text && <span className="ec-override-dot" />}
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
    </div>
  );
}
