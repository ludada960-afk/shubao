import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles, ChevronDown, Plus, ImagePlus,
  // 高级 AI 感图标
  Images,  // 套图配置
  Wand2,   // 画面风格
  SlidersHorizontal, // 产品参数
  Package, // SKU 变体
  FileText, // 文案策划
  Settings2, // 生图设置
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import SizingPanel, { PLATFORM_PRESETS } from './ec/SizingPanel';
import StylePanel from './ec/StylePanel';
import ParamsPanel from './ec/ParamsPanel';
import SkuPanel from './ec/SkuPanel';
import CopyPanel from './ec/CopyPanel';
import GenSettingsPanel from './ec/GenSettingsPanel';
import EcommerceWorkbench from './ec/EcommerceWorkbench';

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

// 3–5 张清晰、多角度的产品实拍通常能提供足够的商品事实，继续堆叠近似角度反而会稀释参考。
const PRODUCT_SHOT_PLAN = [
  { title: '正面主视图', short: '正面图', hint: '完整展示商品正面与轮廓' },
  { title: '侧面 45°', short: '侧面图', hint: '补足厚度、结构与比例' },
  { title: '核心细节', short: '细节图', hint: '材质、接口、纹理或工艺特写' },
  { title: '背面 / 俯视', short: '背面图', hint: '补足背部、顶部或底部信息' },
  { title: '使用尺度', short: '场景图', hint: '有人手持或真实场景，便于判断大小' },
];

/* ═══════ 统一按钮样式（升级：胶囊形状+渐变）═══════ */
const BTN_BASE = {
  height: 40, padding: '0 18px', borderRadius: 20,
  fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
  border: '1px solid rgba(28, 25, 23, 0.10)',
  background: '#fff',
  color: 'var(--text-secondary)', 
  transition: 'all 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
  whiteSpace: 'nowrap', userSelect: 'none', flexShrink: 0,
  boxShadow: '0 2px 7px rgba(62,43,26,0.07)',
};

/* ═══════ 玻璃拟态面板样式（AI 感升级）═══════ */
const GLASS_PANEL = {
  borderRadius: 20,
  background: '#fff',
  border: '1px solid rgba(28, 25, 23, 0.09)',
  boxShadow: '0 18px 48px rgba(62,43,26,0.16), 0 4px 14px rgba(62,43,26,0.08)',
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
    sizing: false, style: false, params: false, copy: false, settings: false,
  });

  /* — 配置 — */
  const [platform, setPlatform] = useState('smart');
  const [sizing, setSizing] = useState({ smart: true, images: [] });
  const [styleSkill, setStyleSkill] = useState('smart');
  const [customColors, setCustomColors] = useState(null);
  const [productParams, setProductParams] = useState({ category: '', size: '', baseColor: '', accentColor: '', material: '', craft: '' });
  const [skus, setSkus] = useState([{ id: `sku_${Date.now()}`, color: '', size: '', capacity: '', dimLabel: '', count: 1 }]);
  const [copywriting, setCopywriting] = useState({ plan: '', sellingPoints: '', qc: '', details: '', maintenance: '' });

  /* — 生图设置（分辨率/品质/创意度/反向提示词/种子） — */
  const [genSettings, setGenSettings] = useState({
    resolution: '1K',
    negativePrompt: '',
  });

  /* — 面板（Portal 定位用视口坐标）—— */
  const [activePanel, setActivePanel] = useState(null);
  const [panelPos, setPanelPos] = useState({ left: 0, bottom: 0, width: 0, maxH: 400, btnCenterX: 0 });

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
      genSettings,
    });
    setEcStep?.(2);
  };

  /* ── 图片上传 ── */
  const handleProdUpload = (e) => {
    const files = Array.from(e.target.files || []);
    setProductImages(prev => [...prev, ...files.map(f => ({ url: URL.createObjectURL(f), file: f }))]);
    e.target.value = '';
  };
  const handleRefUpload = (e) => {
    const files = Array.from(e.target.files || []);
    setRefImages(prev => [...prev, ...files.map(f => ({ url: URL.createObjectURL(f), file: f }))]);
    e.target.value = '';
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

  const getNextProductShot = (count) => PRODUCT_SHOT_PLAN[Math.min(count, PRODUCT_SHOT_PLAN.length - 1)];

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
      setSmartOverrides({ sizing: false, style: false, params: false, copy: false, settings: false });
    }
  };

  /* ── 6 个功能按钮（AI 感图标升级）── */
  const BUTTONS = [
    { key: 'sizing', label: '套图方案', icon: <Images size={15} strokeWidth={1.8} /> },
    { key: 'sku', label: 'SKU变体', icon: <Package size={15} strokeWidth={1.8} /> },
    { key: 'style', label: '视觉方向', icon: <Wand2 size={15} strokeWidth={1.8} /> },
    { key: 'params', label: '商品信息', icon: <SlidersHorizontal size={15} strokeWidth={1.8} /> },
    { key: 'copy', label: '内容规范', icon: <FileText size={15} strokeWidth={1.8} /> },
    { key: 'settings', label: '生成设置', icon: <Settings2 size={15} strokeWidth={1.8} /> },
  ];

  /* ── 面板定位：Portal 固定到当前按钮，并在滚动时持续跟随 ── */
  const repositionPanel = useCallback(() => {
    if (!activePanel) return;
    const el = btnRefs.current[activePanel];
    if (!el) return;
    const btnRect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const baseWidth = activePanel === 'copy' ? 520 : activePanel === 'sizing' ? 460 : activePanel === 'settings' ? 420 : 420;
    const panelW = Math.min(Math.max(baseWidth, 400), Math.max(320, vw - 32));
    const btnCenterX = btnRect.left + btnRect.width / 2;
    setPanelPos({
      left: Math.max(16, Math.min(btnCenterX - panelW / 2, vw - panelW - 16)),
      bottom: Math.max(16, window.innerHeight - btnRect.top + 10),
      width: panelW,
      maxH: Math.max(300, Math.min(620, btnRect.top - 24)),
      btnCenterX,
    });
  }, [activePanel]);

  useEffect(() => {
    if (!activePanel) return;
    repositionPanel();
    window.addEventListener('resize', repositionPanel);
    window.addEventListener('scroll', repositionPanel, true);
    return () => {
      window.removeEventListener('resize', repositionPanel);
      window.removeEventListener('scroll', repositionPanel, true);
    };
  }, [activePanel, repositionPanel]);

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
      const isSettingsPanel = key === 'settings';
      const baseWidth = isCopyPanel ? 520 : isSizingPanel ? 460 : isSettingsPanel ? 380 : 420;
      const maxPW = Math.min(vw - 32, 640);
      const panelW = Math.min(Math.max(baseWidth, 400), maxPW);
      
      // 使用 Portal 固定在视口：不受顶部导航、父级 overflow 或卡片高度裁切。
      const btnCenterX = btnRect.left + btnRect.width / 2;
      const panelLeft = Math.max(16, Math.min(btnCenterX - panelW / 2, vw - panelW - 16));
      const panelBottom = Math.max(16, window.innerHeight - btnRect.top + 10);
      const maxH = Math.max(300, Math.min(620, btnRect.top - 24));
      
      setPanelPos({ 
        left: panelLeft, 
        bottom: panelBottom, 
        width: panelW, 
        maxH, 
        btnCenterX
      });
    }
    setActivePanel(key);
  }, [activePanel]);

  /* ── 浮层渲染：Portal 到 body，彻底避免卡片与导航裁切 ── */
  const renderPanel = () => {
    if (!activePanel) return null;
    return createPortal(
        <div id="ec-floating-panel" style={{
          ...GLASS_PANEL,
          position: 'fixed',
          bottom: panelPos.bottom,
          left: panelPos.left,
          width: panelPos.width,
          maxHeight: panelPos.maxH,
          overflowY: 'auto',
          zIndex: 1100,
          transformOrigin: 'bottom center',
        }}>
        {activePanel === 'sizing' && (
          <SizingPanel
            platform={platform} onPlatformChange={setPlatform}
            sizing={sizing} onSizingChange={setSizing}
            smartMode={smartMode} onOverride={(isOverridden) => handleOverride('sizing', isOverridden)}
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
          <SkuPanel skus={skus} onChange={setSkus} sizing={sizing} onSizingChange={setSizing} />
        )}
        {activePanel === 'copy' && (
          <CopyPanel copywriting={copywriting} onChange={setCopywriting}
            smartMode={smartMode} onOverride={() => handleOverride('copy')} />
        )}
        {activePanel === 'settings' && (
          <GenSettingsPanel value={genSettings} onChange={setGenSettings} />
        )}
      </div>,
      document.body,
    );
  };

  const restoreSmartPlan = () => {
    setPlatform('smart');
    setSizing({ smart: true, images: [] });
    setStyleSkill('smart');
    setCustomColors(null);
    setCopywriting({ plan: '', sellingPoints: '', qc: '', details: '', maintenance: '' });
    setGenSettings({ resolution: '1K', negativePrompt: '' });
    setSmartMode(true);
    setSmartOverrides({ sizing: false, style: false, params: false, copy: false, settings: false });
    setActivePanel(null);
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
      {/* ═══ 暖黄色背景卡片（与小红书图文一致）═══ */}
      <div ref={cardRef} style={{ borderRadius: 20, margin: '0 16px', background: '#fff', padding: '16px 20px 20px', position: 'relative' }}>
        <EcommerceWorkbench
          productImages={productImages}
          refImages={refImages}
          description={description}
          onDescriptionChange={setDescription}
          onProductUpload={handleProdUpload}
          onReferenceUpload={handleRefUpload}
          onRemoveProduct={removeProdImg}
          onRemoveReference={removeRefImg}
        />
        {/* ═══ 上下布局：上方双列上传区 + 下方文字输入 ═══ */}
        <div style={{ display: 'none' }}>

          {/* ── 上方：双列上传区（产品图 × 参考图，小红书同款样式）── */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
            {/* 产品图上传区 */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', transform: 'rotate(-1.25deg)' }}>
              <div style={{
                background: '#fff',
                borderRadius: 16,
                border: '2px solid var(--red)',
                boxShadow: '0 6px 32px rgba(255,71,87,0.18)',
                padding: '14px 12px',
                minHeight: 110,
                transition: 'all 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--red)';
                e.currentTarget.style.boxShadow = '0 6px 32px rgba(255,71,87,0.25)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--red)';
                e.currentTarget.style.boxShadow = '0 6px 32px rgba(255,71,87,0.18)';
              }}>
                {/* 标题行 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <span style={{ fontSize: 12 }}>📸</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a' }}>产品图</span>
                  <span style={{ fontSize: 10, color: '#fff', background: 'var(--red)', padding: '2px 8px', borderRadius: 8, marginLeft: 'auto', fontWeight: 600 }}>必须</span>
                </div>

                {/* 横向滚动的图片行 */}
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 7, scrollbarWidth: 'thin' }}>
                  {productImages.map((img, idx) => (
                    <div key={idx} style={{
                      position: 'relative', width: 64, height: 64,
                      borderRadius: 10, overflow: 'hidden',
                      border: '2px solid #eee', flex: '0 0 auto',
                    }}>
                      <img src={img.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '3px 4px', background: 'linear-gradient(transparent, rgba(0,0,0,0.72))', color: '#fff', fontSize: 8, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {PRODUCT_SHOT_PLAN[Math.min(idx, PRODUCT_SHOT_PLAN.length - 1)].short}
                      </div>
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
                      e.currentTarget.style.borderColor = 'var(--red)';
                      e.currentTarget.style.color = 'var(--red)';
                      e.currentTarget.style.background = '#FFF5F5';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = '#ccc';
                      e.currentTarget.style.color = '#999';
                      e.currentTarget.style.background = '#fff';
                    }}>
                    <ImagePlus size={16} color="#999" />
                    <span style={{ fontSize: 9, color: '#999', fontWeight: 600 }}>+ {getNextProductShot(productImages.length).short}</span>
                  </div>
                </div>

                {/* 提示文字 */}
                <div style={{ fontSize: 11, color: '#999', marginTop: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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

            {/* 参考图上传区 */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', transform: 'rotate(1.25deg)' }}>
              <div style={{
                background: '#fff',
                borderRadius: 16,
                border: '2px solid var(--blue)',
                boxShadow: '0 6px 32px rgba(102,126,234,0.18)',
                padding: '14px 12px',
                minHeight: 110,
                transition: 'all 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--blue)';
                e.currentTarget.style.boxShadow = '0 6px 32px rgba(102,126,234,0.25)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--blue)';
                e.currentTarget.style.boxShadow = '0 6px 32px rgba(102,126,234,0.18)';
              }}>
                {/* 标题行 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <span style={{ fontSize: 12 }}>🎨</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a' }}>参考图</span>
                  <span style={{ fontSize: 10, color: '#666', background: 'rgba(0,0,0,0.04)', padding: '2px 8px', borderRadius: 8, marginLeft: 'auto', fontWeight: 500 }}>可选</span>
                </div>

                {/* 横向滚动的图片行 */}
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 7, scrollbarWidth: 'thin' }}>
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
                      e.currentTarget.style.borderColor = 'var(--blue)';
                      e.currentTarget.style.color = 'var(--blue)';
                      e.currentTarget.style.background = 'rgba(102,126,234,0.04)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = '#ccc';
                      e.currentTarget.style.color = '#999';
                      e.currentTarget.style.background = '#fff';
                    }}>
                    <ImagePlus size={16} color="#999" />
                    <span style={{ fontSize: 9, color: '#999', fontWeight: 600 }}>{refImages.length === 0 ? '上传参考' : '+ 继续添加'}</span>
                  </div>
                </div>

                {/* 提示文字 */}
                <div style={{ fontSize: 11, color: '#999', marginTop: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {getRefHint(refImages.length)}
                </div>
              </div>

              <input ref={refFileRef} type="file" accept="image/*" multiple hidden onChange={handleRefUpload} />
            </div>
          </div>

          {/* ── 下方：产品描述输入区（小红书同款 textarea）── */}
          <div className="hero-textarea-wrap" style={{ margin: 0 }}>
            <textarea
              className="hero-textarea"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder=" "
            />
            <div className="custom-placeholder">
              <div className="ph-main">描述你的产品名称、特点、材质、用途…</div>
              <div className="ph-sub">例如：白色陶瓷马克杯，简约北欧风，容量350ml，带木质把手，适合办公家用</div>
            </div>
          </div>
        </div>

        {/* ═══ 配置按钮行（相对定位容器，面板在此内部绝对定位）═══ */}
        <div ref={btnRowRef} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '12px 2px 14px', flexWrap: 'wrap',
          position: 'relative', zIndex: 10,
          borderTop: '1px solid rgba(28,25,23,0.08)',
          background: '#fff',
        }}>
          {/* ═══ 面板渲染（内联，相对于按钮行定位）═══ */}
          {renderPanel()}
          {/* ── 6 个功能按钮（带配置回显 - 类似椒图AI）── */}
          {BUTTONS.map(btn => {
            const isOpen = activePanel === btn.key;
            const isOverridden = smartMode && smartOverrides[btn.key];
            // 计算配置摘要（始终显示，类似椒图AI）
            const getConfigSummary = () => {
              switch (btn.key) {
                case 'sizing': {
                  // 始终显示具体配置摘要（类似椒图AI）
                  const images = sizing?.images || [];
                  const total = images.reduce((s, img) => s + (img.count || 0), 0);
                  if (total === 0) return { text: '套图配置', isSmart: false };
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
                  const styleMap = {
                    smart: '智能风格',
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
                  const filled = Object.entries(productParams).filter(([k, v]) => v && v.trim?.()).length;
                  return filled > 0
                    ? { text: `${filled}项参数`, isSmart: false }
                    : { text: '产品参数', isSmart: false };
                }
                case 'sku': {
                  const validSkus = skus?.filter(s => s.color || s.size || s.capacity) || [];
                  const totalSkuImages = validSkus.reduce((a, s) => a + (s.count || 1), 0);
                  if (validSkus.length === 0) return { text: 'SKU变体', isSmart: false };
                  return { text: `${validSkus.length}变体·${totalSkuImages}张`, isSmart: false };
                }
                case 'copy': {
                  const fields = ['plan', 'sellingPoints', 'qc', 'details', 'maintenance'];
                  const filled = fields.filter(k => copywriting?.[k]?.trim?.()).length;
                  return filled > 0
                    ? { text: `${filled}项文案`, isSmart: false }
                    : { text: '文案策划', isSmart: false };
                }
                case 'settings': {
                  const { resolution = '1K' } = genSettings;
                  return { text: `${resolution}·最佳质量`, isSmart: false };
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
                  borderColor: isOpen ? '#8b5cf6' : isOverridden ? 'rgba(139,92,246,0.55)' : 'rgba(28,25,23,0.10)',
                  borderStyle: 'solid',
                  background: isOpen ? '#f1e9ff' : isOverridden ? '#fbf8ff' : '#fff',
                  position: 'relative',
                  boxShadow: isOpen 
                    ? '0 4px 14px rgba(124,58,237,0.15)'
                    : isOverridden 
                      ? '0 3px 10px rgba(124,58,237,0.10)'
                      : BTN_BASE.boxShadow,
                }}
                onMouseEnter={e => { 
                  if (!isOpen) {
                    e.currentTarget.style.background = '#faf7ff';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(62,43,26,0.10)';
                  }
                }}
                onMouseLeave={e => { 
                  if (!isOpen) {
                    e.currentTarget.style.background = isOverridden ? '#fbf8ff' : '#fff';
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = isOverridden 
                      ? '0 3px 10px rgba(124,58,237,0.10)'
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
          {hasOverrides && (
            <button type="button" onClick={restoreSmartPlan} style={{
              ...BTN_BASE, height: 34, padding: '0 12px', borderColor: 'rgba(124,58,237,0.22)',
              background: 'rgba(124,58,237,0.06)', color: '#6d28d9', fontSize: 12,
              marginLeft: 'auto', flexShrink: 0,
            }}>恢复智能方案</button>
          )}

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
