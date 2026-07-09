import React, { useState, useRef, useCallback, useMemo } from 'react';
import { Upload, X, Loader2, Link, ChevronRight, ChevronLeft, Check, Download, RefreshCw, Edit3, Sparkles, Settings, Eye, Plus, Minus, Lock } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { generateEcommerce, generateEcommercePreview, proxyImg, extractProductLink } from '../../services/api';
import { EC_CATS, EC_PLATFORMS, EC_PLATFORM_DESC, EC_PLATFORM_SPECS } from '../../constants/data';
import Button from '../../components/ui/Button';
import { PRICING_EC } from '../../constants/data';

/* ══════════════════════════════════════════════════════════════════
   图片类型定义（含emoji/说明/推荐规则 — 卖家用得懂的语言）
   ══════════════════════════════════════════════════════════════════ */
const IMAGE_TYPES = [
  {
    key: 'main_white',
    label: '白底主图',
    emoji: '⬜',
    mandatory: true,
    maxCount: 3,
    explainer: '买家搜到你第一眼看到的图，纯白底+产品居中，淘宝/京东/拼多多都合规',
    desc: '必选。至少 1 张，刚上架可以多角度出 2-3 张',
  },
  {
    key: 'feature',
    label: '卖点图',
    emoji: '📋',
    mandatory: false,
    maxCount: 6,
    explainer: '每张图突出一个卖点，中文标注+图标，买家不用问客服就知道好在哪',
    desc: '推荐：你填了几个卖点就出几张，一张对应一个卖点效果最好',
  },
  {
    key: 'scene',
    label: '场景图',
    emoji: '🌿',
    mandatory: false,
    maxCount: 4,
    explainer: '产品在真实场景里的效果，让买家想象"我用是什么样"',
    desc: '推荐 1-2 张，特别是家居、美妆、食品类效果好',
  },
  {
    key: 'detail',
    label: '材质细节',
    emoji: '🔍',
    mandatory: false,
    maxCount: 3,
    explainer: '微距特写材质和工艺，适合高客单价商品展示品质',
    desc: '如果你填了材质/规格信息，推荐出 1 张',
  },
  {
    key: 'sku',
    label: 'SKU多色',
    emoji: '🎨',
    mandatory: false,
    maxCount: 3,
    explainer: '多种颜色/尺寸排在一起，买家一眼看到全部选项',
    desc: '你上传了多张参考图，推荐出 1 张对比图',
  },
  {
    key: 'comparison',
    label: '效果对比',
    emoji: '↔️',
    mandatory: false,
    maxCount: 2,
    explainer: '使用前/后对比，最有说服力的图',
    desc: '美妆/护肤/清洁类目推荐出 1 张',
  },
  {
    key: 'package',
    label: '包装组合',
    emoji: '📦',
    mandatory: false,
    maxCount: 2,
    explainer: '全套包装+配件一图展示，适合礼盒装',
    desc: '有礼盒装或套装建议出 1 张',
  },
  {
    key: 'beauty_report',
    label: '美妆分析报告',
    emoji: '📊',
    mandatory: false,
    maxCount: 1,
    explainer: '肤质分析+产品推荐做在一张信息图里，提升信任感',
    desc: '美妆护肤类目可选，顾客很吃这一套',
  },
  {
    key: 'transparent',
    label: '透明PNG',
    emoji: '🖼️',
    mandatory: false,
    maxCount: 1,
    explainer: '去底透明PNG，拿去做自己排版合成用',
    desc: '电商美工需要素材时选，普通卖家可以不选',
  },
];

const STYLE_PACKS = [
  { key: 'default', label: '爆款白底', sub: '纯白棚拍，主图合规首选', emoji: '⬜', value: '✅ 所有平台合规  ✅ 转化最稳  ✅ 可叠加促销角标' },
  { key: 'scene_selling', label: '场景融入', sub: '让用户想象"我用是什么效果"', emoji: '🌿', value: '✅ 降低决策门槛  ✅ 提升加购率  ✅ 美妆/家居最合适' },
  { key: 'detail_selling', label: '卖点清晰', sub: '把优势讲清楚，不用问客服', emoji: '📋', value: '✅ 每张聚焦一个卖点  ✅ 减少咨询  ✅ 结构化排版' },
  { key: 'ugc_trust', label: '真实感', sub: '像真实买家秀，打消顾虑', emoji: '📱', value: '✅ 看起来像实拍  ✅ 提升信任  ✅ 降低退货率' },
  { key: 'brand_unified', label: '品牌统一', sub: '多款商品像同一家店出品', emoji: '💎', value: '✅ 统一风格  ✅ 提升溢价  ✅ 店铺专业感' },
  { key: 'promo_sale', label: '促销活动', sub: '大促价格一目了然', emoji: '🏷️', value: '✅ 价格区醒目  ✅ 双11/618适配  ✅ 点击率提升' },
];

/* ══════════════════════════════════════════════════════════════════
   主组件
   ══════════════════════════════════════════════════════════════════ */
export default function EcommercePage() {
  const { state, dispatch } = useApp();

  // Step tracking
  const [step, setStep] = useState(1); // 1=填信息, 2=选图, 3=大纲预览, 4=生成中, 5=结果
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null); // 大纲数据
  const [result, setResult] = useState(null); // 生成结果
  const [error, setError] = useState('');

  // Step 1: 商品信息
  const [name, setName] = useState('');
  const [cat, setCat] = useState('美妆护肤');
  const [points, setPoints] = useState('');
  const [material, setMaterial] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [restrictions, setRestrictions] = useState('');
  const [refImgs, setRefImgs] = useState([]);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const fileRef = useRef(null);

  // Step 2: 选图 + 配置
  const [imageSelections, setImageSelections] = useState([]); // [{key, count}]
  const [stylePack, setStylePack] = useState('default');
  const [platform, setPlatform] = useState('淘宝');
  const [customSizeEnabled, setCustomSizeEnabled] = useState(false);
  const [customW, setCustomW] = useState('');
  const [customH, setCustomH] = useState('');

  // 免费试用检测 — 区分"首次免费"和"额度用完"
  const [trialUsed, setTrialUsed] = useState(() => {
    try { return localStorage.getItem('sb-ec-trial-used') === '1'; } catch { return false; }
  });

  const tierInfo = useMemo(() => {
    const hasCredits = state.logged && state.credits > 0;
    const canFreeTrial = !trialUsed; // 首次（无论登录与否）都可以免费试一次
    const needsCredits = !hasCredits && !canFreeTrial;

    let label = '';
    let canGenerate = false;
    let generateLabel = '';
    let freeTierKeys = [];

    if (hasCredits) {
      label = '额度充足';
      canGenerate = true;
      generateLabel = '生成全套图片';
      freeTierKeys = [];
    } else if (canFreeTrial) {
      label = '🎁 首次免费试用';
      canGenerate = true;
      generateLabel = '🎁 免费试用（出3张样品）';
      freeTierKeys = ['main_white', 'detail', 'sku'];
    } else {
      label = '额度不足';
      canGenerate = false;
      generateLabel = '需要购买额度';
      freeTierKeys = [];
    }

    return { label, canGenerate, generateLabel, freeTierKeys, hasCredits, canFreeTrial, needsCredits };
  }, [state.logged, state.credits, trialUsed]);

  // Step 5: 单图编辑
  const [editModal, setEditModal] = useState(null); // {label, prompt} or null

  const addImage = (files) => {
    Array.from(files).slice(0, 5 - refImgs.length).forEach(f => {
      const reader = new FileReader();
      reader.onload = (ev) => setRefImgs(p => p.length >= 5 ? p : [...p, ev.target.result]);
      reader.readAsDataURL(f);
    });
  };

  const extractLink = async () => {
    if (!linkUrl.trim()) return;
    setLinkLoading(true);
    try {
      const data = await extractProductLink(linkUrl.trim());
      if (data.title) setName(data.title);
      if (data.category && EC_CATS.includes(data.category)) setCat(data.category);
      if (data.sellingPoints?.length) setPoints(data.sellingPoints.join('\n'));
      if (data.materials) setMaterial(data.materials);
      if (data.images?.length) {
        const imgs = data.images.slice(0, 5);
        setRefImgs(imgs);
      }
    } catch (e) {
      setError('链接提取失败：' + (e.message || '请检查链接'));
    }
    setLinkLoading(false);
  };

  const goToStep2 = async () => {
    if (!name.trim()) return setError('请填写商品名称');
    setError('');
    setLoading(true);
    try {
      const data = await generateEcommercePreview({
        productName: name,
        category: cat,
        points,
        refCount: refImgs.length,
        hasMaterial: !!material,
      });
      setPreviewData(data);
      // 根据推荐初始化 imageSelections
      const initial = (data.imageTypes || []).filter(t => t.recommended > 0).map(t => ({
        key: t.key,
        count: t.recommended,
      }));
      setImageSelections(initial);
      setStep(2);
    } catch (e) {
      setError('预览失败：' + (e.message || '请重试'));
    }
    setLoading(false);
  };

  const updateSelection = (key, count) => {
    const type = IMAGE_TYPES.find(t => t.key === key);
    if (!type) return;
    const clamped = Math.max(type.mandatory ? 1 : 0, Math.min(count, type.maxCount));
    setImageSelections(p => {
      const existing = p.find(s => s.key === key);
      if (existing) {
        if (clamped === 0) return p.filter(s => s.key !== key);
        return p.map(s => s.key === key ? { ...s, count: clamped } : s);
      }
      return clamped > 0 ? [...p, { key, count: clamped }] : p;
    });
  };

  const getSelectionCount = (key) => {
    const s = imageSelections.find(s => s.key === key);
    return s ? s.count : 0;
  };

  const goToStep3 = () => {
    if (imageSelections.length === 0) return setError('请至少选择一种图片类型');
    setError('');
    setStep(3);
  };

  const regeneratePreview = () => {
    goToStep2();
  };

  const startGeneration = async () => {
    setLoading(true);
    setError('');
    try {
      // 把 feature 类型的次数还原成卖点图列表
      const allSelections = [];
      for (const sel of imageSelections) {
        if (sel.key === 'feature') {
          const pointsList = points.split('\n').filter(Boolean);
          for (let i = 0; i < sel.count; i++) {
            allSelections.push({ key: 'feature', count: 1, label: `卖点图${i + 1}：${pointsList[i] || pointsList[0] || ''}` });
          }
        } else {
          allSelections.push(sel);
        }
      }

      // 免费/额度 用户：只生成 3 张核心图
      let selectionsToGenerate = allSelections;
      let lockedSlots = [];
      const isFreeTrial = tierInfo.canFreeTrial;
      const isOutOfCredits = tierInfo.needsCredits;
      if (tierInfo.freeTierKeys.length > 0) {
        selectionsToGenerate = allSelections.filter(s => tierInfo.freeTierKeys.includes(s.key));
        lockedSlots = allSelections.filter(s => !tierInfo.freeTierKeys.includes(s.key));
        // 限制最多 3 张，且必须包含主图
        if (selectionsToGenerate.length === 0) {
          selectionsToGenerate = [{ key: 'main_white', count: 1, label: '白底主图' }];
        }
      }

      const data = await generateEcommerce({
        productName: name,
        category: cat,
        refImgs,
        platform,
        points,
        stylePack,
        material,
        targetAudience,
        restrictions,
        imageSelections: selectionsToGenerate,
        imageSize: customSizeEnabled && customW && customH ? { width: +customW, height: +customH } : null,
      });
      setResult(data);
      setResult(p => ({ ...p, _tierInfo: { ...tierInfo, usedFreeTrial: isFreeTrial }, _lockedSlots: lockedSlots }));
      // 用了免费试用的标记本地
      if (isFreeTrial) {
        try { localStorage.setItem('sb-ec-trial-used', '1'); } catch {}
        setTrialUsed(true);
      }
      setStep(5);
    } catch (e) {
      setError('生成失败：' + (e.message || '请重试'));
    }
    setLoading(false);
  };

  const downloadImg = (url, label) => {
    const cleanUrl = url?.startsWith('data:') ? url : proxyImg(url);
    fetch(cleanUrl).then(r => r.blob()).then(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${name}-${label}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    }).catch(() => {});
  };

  const regenerateSingle = async (label) => {
    // 重生成单张图 - 简化版本：重新调用生成，只取这张
    setLoading(true);
    try {
      const data = await generateEcommerce({
        productName: name,
        category: cat,
        refImgs,
        platform,
        points,
        stylePack,
        material,
        targetAudience,
        restrictions,
        imageSelections: [{ key: 'main_white', count: 1, label }],
      });
      if (data.images?.[label]) {
        setResult(p => ({ ...p, images: { ...p.images, [label]: data.images[label] } }));
      }
    } catch (e) {
      setError('重生成失败：' + e.message);
    }
    setLoading(false);
  };

  const handleUnlock = () => {
    if (!state.logged) {
      dispatch({ type: 'SHOW_LOGIN', show: true });
    } else {
      dispatch({ type: 'NAVIGATE', page: 'pricing' });
    }
  };

  return (
    <div style={{
      maxWidth: 'var(--max-width-narrow)', margin: '0 auto',
      padding: '30px 28px 60px',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h1 style={{
          fontSize: 'var(--text-3xl)', fontWeight: 'var(--weight-heavy)',
          margin: '0 0 4px', letterSpacing: '-0.5px',
        }}>
          🛍️ 电商商品图生成
        </h1>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: 0 }}>
          智能选图 → 预览大纲 → 一键生成 → 单张微调
        </p>
      </div>

      {/* Steps indicator */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 0, marginBottom: 24,
      }}>
        {['填信息', '选图片', '生成'].map((s, i) => (
          <React.Fragment key={s}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 'var(--radius-full)',
              background: step >= i + 1 && step <= 5 ? 'var(--red)' : 'var(--border-light)',
              color: step >= i + 1 && step <= 5 ? '#fff' : 'var(--text-muted)',
              fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
              transition: 'all 0.2s',
            }}>
              <span style={{
                width: 18, height: 18, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: step >= i + 1 && step <= 5 ? 'rgba(255,255,255,0.2)' : 'var(--border)',
                fontSize: 10, fontWeight: 700,
              }}>{i + 1}</span>
              {s}
            </div>
            {i < 2 && <div style={{
              width: 24, height: 2, background: step >= i + 2 && step <= 5 ? 'var(--red)' : 'var(--border)',
              transition: 'background 0.3s',
            }} />}
          </React.Fragment>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          background: '#FFF5F5', border: '1px solid #FED7D7',
          borderRadius: 'var(--radius-md)', padding: '10px 14px',
          marginBottom: 14, fontSize: 'var(--text-sm)', color: '#C53030',
        }}>{error}</div>
      )}

      {/* ========== STEP 1: 填信息 ========== */}
      {step === 1 && (
        <Step1Form
          name={name} setName={setName}
          cat={cat} setCat={setCat}
          points={points} setPoints={setPoints}
          material={material} setMaterial={setMaterial}
          targetAudience={targetAudience} setTargetAudience={setTargetAudience}
          restrictions={restrictions} setRestrictions={setRestrictions}
          refImgs={refImgs} setRefImgs={setRefImgs}
          fileRef={fileRef} addImage={addImage}
          linkUrl={linkUrl} setLinkUrl={setLinkUrl}
          linkLoading={linkLoading} extractLink={extractLink}
          onNext={goToStep2}
          loading={loading}
        />
      )}

      {/* ========== STEP 2: 选图 ========== */}
      {step === 2 && (
        <Step2SelectImages
          imageSelections={imageSelections}
          updateSelection={updateSelection}
          getSelectionCount={getSelectionCount}
          stylePack={stylePack} setStylePack={setStylePack}
          platform={platform} setPlatform={setPlatform}
          customSizeEnabled={customSizeEnabled} setCustomSizeEnabled={setCustomSizeEnabled}
          customW={customW} setCustomW={setCustomW}
          customH={customH} setCustomH={setCustomH}
          previewData={previewData}
          cat={cat} points={points}
          onBack={() => setStep(1)}
          onNext={goToStep3}
        />
      )}

      {/* ========== STEP 3: 大纲预览 ========== */}
      {step === 3 && (
        <Step3Outline
          previewData={previewData}
          imageSelections={imageSelections}
          cat={cat}
          points={points}
          name={name}
          onBack={() => setStep(2)}
          onRegenerate={regeneratePreview}
          onStart={startGeneration}
          loading={loading}
          tierInfo={tierInfo}
          onUnlock={handleUnlock}
        />
      )}

      {/* ========== STEP 4: 生成中 ========== */}
      {step === 4 && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Loader2 size={44} style={{ color: 'var(--red)' }} className="animate-spin" />
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)', marginTop: 18, marginBottom: 4 }}>
            正在生成...
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            GPT Image 2 生成中，约 15-30 秒/张
          </div>
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
            {imageSelections.map(s => {
              const t = IMAGE_TYPES.find(it => it.key === s.key);
              return (
                <span key={s.key} style={{
                  fontSize: 'var(--text-xs)', padding: '4px 12px',
                  background: 'var(--border-light)', borderRadius: 'var(--radius-md)',
                }}>
                  {t?.emoji || '🖼️'} {t?.label || s.key} ×{s.count}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* ========== STEP 5: 结果 ========== */}
      {step === 5 && result && (
        <Step5Results
          result={result}
          name={name}
          onDownload={downloadImg}
          onRegenerate={regenerateSingle}
          onEdit={(k, v) => setEditModal({ label: k, prompt: v })}
          onNew={() => {
            setStep(1); setResult(null); setPreviewData(null);
            setImageSelections([]); setError('');
          }}
          loading={loading}
          tierInfo={tierInfo}
          onUnlock={handleUnlock}
        />
      )}

      {/* Edit prompt modal */}
      {editModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 20,
        }} onClick={() => setEditModal(null)}>
          <div style={{
            background: '#fff', borderRadius: 'var(--radius-xl)',
            maxWidth: 520, width: '100%', padding: 24,
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14,
            }}>
              <span style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)' }}>
                ✏️ 编辑 Prompt — {editModal.label}
              </span>
              <div onClick={() => setEditModal(null)} style={{ cursor: 'pointer', color: 'var(--text-ghost)' }}>
                <X size={18} />
              </div>
            </div>
            <div style={{
              fontSize: 'var(--text-xs)', color: 'var(--text-hint)', marginBottom: 8,
              background: 'var(--bg-gray)', padding: '10px 14px', borderRadius: 'var(--radius-md)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 300, overflow: 'auto',
              lineHeight: 1.6,
            }}>
              {editModal.prompt || '（该图已生成，提示词在服务端构建）'}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-faint)', textAlign: 'center' }}>
              单图编辑提示词功能开发中...
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Step 1: 填商品信息
   ══════════════════════════════════════════════════════════════════ */
function Step1Form({
  name, setName, cat, setCat, points, setPoints,
  material, setMaterial, targetAudience, setTargetAudience, restrictions, setRestrictions,
  refImgs, setRefImgs, fileRef, addImage,
  linkUrl, setLinkUrl, linkLoading, extractLink,
  onNext, loading,
}) {
  return (
    <div style={{
      borderRadius: 'var(--radius-xl)', background: '#fff',
      padding: 24, boxShadow: 'var(--shadow-md)',
    }}>
      {/* 粘贴链接 */}
      <Field label="粘贴商品链接（可选 — 自动填信息）" small>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
            placeholder="粘贴淘宝/京东/拼多多商品链接..."
            style={{ ...inputStyle, flex: 1 }} />
          <button onClick={extractLink} disabled={linkLoading || !linkUrl.trim()} style={{
            padding: '0 16px', border: 'none', borderRadius: 'var(--radius-lg)',
            background: linkLoading ? 'var(--border)' : 'var(--red)',
            color: '#fff', cursor: linkLoading ? 'not-allowed' : 'pointer',
            fontSize: 'var(--text-sm)', fontWeight: 600, fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
          }}>
            {linkLoading ? <Loader2 size={14} className="animate-spin" /> : <Link size={14} />}
            提取
          </button>
        </div>
      </Field>

      {/* 商品名称 */}
      <Field label="商品名称 *">
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="例如：高保湿精华液、无线蓝牙耳机、纯棉T恤..."
          style={inputStyle} />
      </Field>

      {/* 品类 */}
      <Field label="品类">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {EC_CATS.map(c => (
            <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Chip>
          ))}
        </div>
      </Field>

      {/* 卖点 */}
      <Field label="卖点文案（一行一个卖点）" small>
        <textarea value={points} onChange={e => setPoints(e.target.value)}
          placeholder={'例如：\n高保湿锁水\n24小时持久\n敏感肌适用\n清爽不黏腻'}
          style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} />
      </Field>

      {/* 材质/规格 目标人群 限制 — 折叠高级选项 */}
      <details style={{ marginBottom: 18 }}>
        <summary style={{
          fontSize: 'var(--text-xs)', color: 'var(--text-hint)',
          cursor: 'pointer', marginBottom: 8, userSelect: 'none',
        }}>
          更多商品信息（选填，越详细生成效果越好）
        </summary>
        <div style={{ padding: '8px 0' }}>
          <Field label="材质/规格" small>
            <input value={material} onChange={e => setMaterial(e.target.value)}
              placeholder="例如：玻尿酸、304不锈钢、纯棉 240g..."
              style={inputStyle} />
          </Field>
          <Field label="目标人群" small>
            <input value={targetAudience} onChange={e => setTargetAudience(e.target.value)}
              placeholder="例如：25-35岁女性、学生党、健身人群..."
              style={inputStyle} />
          </Field>
          <Field label="避免的内容" small>
            <input value={restrictions} onChange={e => setRestrictions(e.target.value)}
              placeholder="例如：不要出现人物、不要手部特写..."
              style={inputStyle} />
          </Field>
        </div>
      </details>

      {/* 参考图上传 */}
      <Field label="商品参考图（可选，最多5张 — 有参考图效果更好）">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {refImgs.map((src, i) => (
            <div key={i} style={{ position: 'relative', width: 60, height: 60, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '2px solid var(--border)' }}>
              <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div onClick={() => setRefImgs(p => p.filter((_, j) => j !== i))} style={{
                position: 'absolute', top: -5, right: -5, width: 16, height: 16,
                borderRadius: '50%', background: 'var(--red)', color: '#fff',
                fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', border: '2px solid #fff', fontWeight: 700, lineHeight: 1,
              }}>×</div>
            </div>
          ))}
          {refImgs.length < 5 && (
            <div onClick={() => fileRef.current?.click()} style={{
              width: 60, height: 60, borderRadius: 'var(--radius-md)',
              border: '2px dashed var(--border-hover)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-ghost)',
            }}>
              <Upload size={16} />
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" multiple hidden
            onChange={e => { addImage(e.target.files); e.target.value = ''; }} />
        </div>
      </Field>

      {/* 下一步 */}
      <button onClick={onNext} disabled={loading || !name.trim()} style={{
        width: '100%', padding: '13px 0', border: 'none',
        borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-base)',
        fontWeight: 'var(--weight-semibold)', fontFamily: 'inherit',
        background: (loading || !name.trim()) ? 'var(--border)' : 'var(--red)',
        color: '#fff', cursor: (loading || !name.trim()) ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s', marginTop: 4,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        {loading ? <Loader2 size={16} className="animate-spin" /> : null}
        智能推荐图片方案 <ChevronRight size={16} />
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Step 2: 选图片类型 + 配置
   ══════════════════════════════════════════════════════════════════ */
function Step2SelectImages({
  imageSelections, updateSelection, getSelectionCount,
  stylePack, setStylePack, platform, setPlatform,
  customSizeEnabled, setCustomSizeEnabled, customW, setCustomW, customH, setCustomH,
  previewData, cat, points,
  onBack, onNext,
}) {
  return (
    <div>
      {/* 图片类型选择 */}
      <div style={{
        borderRadius: 'var(--radius-xl)', background: '#fff',
        padding: 24, marginBottom: 16, boxShadow: 'var(--shadow-md)',
      }}>
        <div style={{
          fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)',
          marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Sparkles size={18} /> 要生成哪些图？
          {previewData?.imageTypes && (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-hint)', fontWeight: 400 }}>
              （根据你的信息智能推荐）
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {IMAGE_TYPES.map(t => {
            const count = getSelectionCount(t.key);
            const rec = previewData?.imageTypes?.find(ri => ri.key === t.key);
            const isRecommended = rec?.recommended > 0;
            const reason = rec?.recommendReason || t.desc;

            return (
              <div key={t.key} style={{
                borderRadius: 'var(--radius-lg)',
                border: `2px solid ${count > 0 ? 'var(--red)' : 'var(--border)'}`,
                padding: '12px 14px', cursor: 'pointer',
                transition: 'all 0.15s',
                background: count > 0 ? 'var(--red-bg)' : '#fff',
              }} onClick={() => {
                // Click to toggle: enable with recommended count or 1
                if (count > 0) {
                  updateSelection(t.key, 0);
                } else {
                  // 推荐写法：用 ref_ecommendations 或默认 1
                  const def = isRecommended ? rec.recommended : 1;
                  const init = t.mandatory ? Math.max(1, def) : def;
                  updateSelection(t.key, init);
                }
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flex: 1 }}>
                    <span style={{ fontSize: 22, lineHeight: 1 }}>{t.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)',
                        display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
                      }}>
                        {t.label}
                        {t.mandatory && <span style={{
                          fontSize: 9, background: 'var(--red)', color: '#fff',
                          padding: '1px 6px', borderRadius: 4, fontWeight: 500,
                        }}>必选</span>}
                        {isRecommended && <span style={{
                          fontSize: 9, background: 'var(--green)', color: '#fff',
                          padding: '1px 6px', borderRadius: 4, fontWeight: 500,
                        }}>推荐</span>}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.5 }}>
                        {t.explainer}
                      </div>
                    </div>
                  </div>

                  {/* Stepper */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 10 }}>
                    {count > 0 && (
                      <>
                        <div onClick={e => { e.stopPropagation(); updateSelection(t.key, count - 1); }}
                          style={{
                            width: 24, height: 24, borderRadius: 6,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: count > (t.mandatory ? 1 : 0) ? 'pointer' : 'not-allowed',
                            background: count > (t.mandatory ? 1 : 0) ? 'var(--red-bg)' : 'var(--border-light)',
                            color: count > (t.mandatory ? 1 : 0) ? 'var(--red)' : 'var(--text-ghost)',
                          }}><Minus size={12} /></div>
                        <span style={{
                          width: 24, textAlign: 'center', fontSize: 'var(--text-sm)',
                          fontWeight: 'var(--weight-bold)', color: 'var(--red)',
                        }}>{count}</span>
                        <div onClick={e => { e.stopPropagation(); updateSelection(t.key, count + 1); }}
                          style={{
                            width: 24, height: 24, borderRadius: 6,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: count < t.maxCount ? 'pointer' : 'not-allowed',
                            background: count < t.maxCount ? 'var(--red-bg)' : 'var(--border-light)',
                            color: count < t.maxCount ? 'var(--red)' : 'var(--text-ghost)',
                          }}><Plus size={12} /></div>
                      </>
                    )}
                  </div>
                </div>

                {isRecommended && reason && (
                  <div style={{
                    marginTop: 6, fontSize: 'var(--text-xs)',
                    color: 'var(--red)', lineHeight: 1.4,
                  }}>💡 {reason}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 风格包选择 */}
      <div style={{
        borderRadius: 'var(--radius-xl)', background: '#fff',
        padding: 24, marginBottom: 16, boxShadow: 'var(--shadow-md)',
      }}>
        <div style={{
          fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)',
          marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Settings size={18} /> 选风格
        </div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-hint)', marginBottom: 12 }}>
          所有图片共用这个风格，保持统一
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {STYLE_PACKS.map(s => (
            <div key={s.key} onClick={() => setStylePack(s.key)}
              style={{
                border: `2px solid ${stylePack === s.key ? 'var(--red)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-lg)', padding: '12px 14px', cursor: 'pointer',
                transition: 'all 0.15s',
                background: stylePack === s.key ? 'var(--red-bg)' : '#fff',
              }}>
              <div style={{ fontSize: 18 }}>{s.emoji}</div>
              <div style={{
                fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)',
                marginTop: 4,
              }}>{s.label}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                {s.sub}
              </div>
              {stylePack === s.key && (
                <div style={{
                  fontSize: 10, color: 'var(--red)', marginTop: 4,
                  lineHeight: 1.4,
                }}>{s.value}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 平台 + 尺寸 */}
      <div style={{
        borderRadius: 'var(--radius-xl)', background: '#fff',
        padding: 24, marginBottom: 16, boxShadow: 'var(--shadow-md)',
      }}>
        <div style={{
          fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)',
          marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Eye size={18} /> 输出尺寸
        </div>

        <Field label="目标平台" small>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {EC_PLATFORMS.map(p => (
              <Chip key={p} active={platform === p} onClick={() => setPlatform(p)}>{p}</Chip>
            ))}
          </div>
          {!customSizeEnabled && (
            <div style={{
              marginTop: 6, background: 'var(--bg-gray)', borderRadius: 'var(--radius-md)',
              padding: '8px 12px', fontSize: 'var(--text-sm)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ color: 'var(--text-secondary)' }}>📐 默认尺寸</span>
              <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)' }}>
                {EC_PLATFORM_SPECS[platform]?.sizes?.['白底主图']?.split('·')?.[0]?.trim() || '800×800'}
              </span>
            </div>
          )}
        </Field>

        <label style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 'var(--text-xs)', color: 'var(--text-muted)', cursor: 'pointer',
          marginTop: 8,
        }}>
          <input type="checkbox" checked={customSizeEnabled}
            onChange={e => setCustomSizeEnabled(e.target.checked)}
            style={{ accentColor: 'var(--red)' }} />
          {customSizeEnabled ? '✏️ 自定义尺寸已开启' : '🎯 自定义尺寸（不勾选则用平台预设）'}
        </label>

        {customSizeEnabled && (
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-hint)', marginBottom: 2 }}>宽 (px)</div>
              <input type="number" value={customW} onChange={e => setCustomW(e.target.value)}
                placeholder="800" style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-hint)', marginBottom: 2 }}>高 (px)</div>
              <input type="number" value={customH} onChange={e => setCustomH(e.target.value)}
                placeholder="800" style={inputStyle} />
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onBack} style={{
          flex: 1, padding: '13px 0', border: '2px solid var(--border)',
          borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-base)',
          fontWeight: 'var(--weight-semibold)', fontFamily: 'inherit',
          background: '#fff', color: 'var(--text-secondary)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <ChevronLeft size={16} /> 返回修改
        </button>
        <button onClick={onNext} style={{
          flex: 2, padding: '13px 0', border: 'none',
          borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-base)',
          fontWeight: 'var(--weight-semibold)', fontFamily: 'inherit',
          background: 'var(--red)', color: '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          预览大纲 <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Step 3: 大纲预览
   ══════════════════════════════════════════════════════════════════ */
function Step3Outline({ previewData, imageSelections, cat, points, name, onBack, onRegenerate, onStart, loading, tierInfo, onUnlock }) {
  const outlineItems = imageSelections.flatMap(sel => {
    const t = IMAGE_TYPES.find(it => it.key === sel.key);
    const items = [];
    for (let i = 0; i < sel.count; i++) {
      const isFeature = sel.key === 'feature';
      const sp = isFeature
        ? (points.split('\n').filter(Boolean)[i] || points.split('\n').filter(Boolean)[0] || '')
        : '';
      let desc = '';
      switch (sel.key) {
        case 'main_white': desc = `${name} — 纯白底主图，产品居中展示`; break;
        case 'feature': desc = sp ? `${name} — 卖点「${sp}」` : `${name} — 卖点展示图`; break;
        case 'scene': desc = `${name} — 使用场景图，让买家想象使用效果`; break;
        case 'detail': desc = `${name} — 材质细节特写，展示工艺品质`; break;
        case 'sku': desc = `${name} — 多颜色/多规格并排对比`; break;
        case 'comparison': desc = `${name} — 使用前/使用后效果对比`; break;
        case 'package': desc = `${name} — 全套包装+配件展示`; break;
        case 'beauty_report': desc = `${name} — 美妆分析信息图：肤质分析+产品推荐+试色`; break;
        case 'transparent': desc = `${name} — 去底透明PNG素材`; break;
        default: desc = `${name} — 商品图`; break;
      }
      items.push({
        key: sel.key,
        instance: i + 1,
        label: sel.count > 1 ? `${t?.emoji || '🖼️'} ${t?.label || sel.key} ${i + 1}` : `${t?.emoji || '🖼️'} ${t?.label || sel.key}`,
        desc,
      });
    }
    return items;
  });

  const totalPoints = imageSelections.reduce((sum, s) => sum + s.count, 0);

  return (
    <div>
      <div style={{
        borderRadius: 'var(--radius-xl)', background: '#fff',
        padding: 24, marginBottom: 16, boxShadow: 'var(--shadow-md)',
      }}>
        <div style={{
          fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)',
          marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Check size={18} style={{ color: 'var(--green)' }} /> 生成计划
        </div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-hint)', marginBottom: 14 }}>
          {name} · {cat} · 共 {totalPoints} 张图 · {stylePack === 'default' ? '爆款白底' : stylePack === 'scene_selling' ? '场景融入' : stylePack === 'detail_selling' ? '卖点清晰' : stylePack === 'ugc_trust' ? '真实感' : stylePack === 'brand_unified' ? '品牌统一' : '促销活动'}风格
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {outlineItems.map((item, i) => (
            <div key={`${item.key}-${item.instance}`} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px',
              borderRadius: 'var(--radius-lg)',
              background: i % 2 === 0 ? 'var(--bg-gray)' : '#fff',
            }}>
              <span style={{
                width: 24, height: 24, borderRadius: 'var(--radius-sm)',
                background: 'var(--red)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>{i + 1}</span>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)',
                }}>{item.label}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 1 }}>
                  {item.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onBack} style={{
          flex: 1, padding: '13px 0', border: '2px solid var(--border)',
          borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-base)',
          fontWeight: 'var(--weight-semibold)', fontFamily: 'inherit',
          background: '#fff', color: 'var(--text-secondary)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <ChevronLeft size={16} /> 返回调整
        </button>
        <button onClick={() => {
          if (tierInfo.needsCredits) { onUnlock?.(); return; }
          onStart();
        }} disabled={loading || tierInfo.needsCredits} style={{
          flex: 2, padding: '13px 0', border: 'none',
          borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-base)',
          fontWeight: 'var(--weight-semibold)', fontFamily: 'inherit',
          background: (loading || tierInfo.needsCredits) ? 'var(--border)' : 'var(--red)',
          color: '#fff', cursor: (loading || tierInfo.needsCredits) ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          {tierInfo.canFreeTrial ? '🎁 免费试用（出3张样品）'
            : tierInfo.needsCredits ? '🔒 需要购买额度'
            : `🚀 消耗 1 次额度生成（${totalPoints} 张）`}
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Step 5: 结果展示
   ══════════════════════════════════════════════════════════════════ */
function Step5Results({ result, name, onDownload, onRegenerate, onEdit, onNew, loading, tierInfo, onUnlock }) {
  const realImages = Object.entries(result.images || {});
  const resultTier = result._tierInfo || tierInfo;
  const isFreeTrial = resultTier.usedFreeTrial || (resultTier.canFreeTrial && resultTier.freeTierKeys.length > 0);
  const isLocked = isFreeTrial || (resultTier.needsCredits);
  const lockedSlots = result._lockedSlots || [];
  const totalCount = realImages.length + lockedSlots.length;

  // 免费用户：锁定图用 placeholder
  const displaySlots = [
    ...realImages.map(([label, url]) => ({ type: 'real', label, url })),
    ...lockedSlots.map(s => {
      const typeInfo = IMAGE_TYPES.find(t => t.key === s.key);
      return { type: 'locked', label: s.label || typeInfo?.label || s.key, emoji: typeInfo?.emoji || '🔒' };
    }),
  ];
  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
      }}>
        <div>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>商品：</span>
          <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)' }}>
            {result.product_name}
          </span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-hint)', marginLeft: 8 }}>
            {result.platform} · {result.category}
          </span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginLeft: 8 }}>
            · 共 {totalCount} 张 · {isFreeTrial ? '🎁 免费试用' : resultTier.hasCredits ? '完整版' : '🔒 额度不足'}
          </span>
        </div>
      </div>

      {isLocked && (
        <div style={{
          background: isFreeTrial ? 'linear-gradient(135deg, var(--red), #FF6B81)' : 'linear-gradient(135deg, #666, #888)',
          borderRadius: 'var(--radius-lg)', padding: '14px 18px',
          marginBottom: 16, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12,
        }}>
          <div style={{ fontSize: 'var(--text-sm)', lineHeight: 1.5 }}>
            <strong>{isFreeTrial ? `🎁 免费预览 ${realImages.length} 张样品` : '🔒 你的额度已用完'}</strong>
            <div style={{ fontSize: 'var(--text-xs)', opacity: 0.85, marginTop: 2 }}>
              {isFreeTrial ? `付费解锁全部 ${totalCount} 张高清原图 · 下载 · 单图编辑` : '购买套餐后解锁全部图片 · 下载 · 编辑'}
            </div>
          </div>
          <button onClick={onUnlock} style={{
            padding: '8px 20px', border: '2px solid #fff', borderRadius: 'var(--radius-full)',
            background: 'transparent', color: '#fff', fontFamily: 'inherit',
            fontSize: 'var(--text-sm)', fontWeight: 700, cursor: 'pointer',
            whiteSpace: 'nowrap', transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.target.style.background = '#fff'; e.target.style.color = isFreeTrial ? 'var(--red)' : '#666'; }}
            onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = '#fff'; }}>
            {isFreeTrial ? `解锁全部 · ¥${PRICING_EC[1]?.price || 49}起` : '查看套餐'}
          </button>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
          <Loader2 size={20} style={{ display: 'inline', marginRight: 8, color: 'var(--red)' }} className="animate-spin" />
          正在重新生成...
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
        {displaySlots.map((slot, i) => (
          <div key={`${slot.label}-${i}`} style={{
            background: '#fff', borderRadius: 'var(--radius-lg)', overflow: 'hidden',
            boxShadow: slot.type === 'locked' ? '0 2px 12px rgba(0,0,0,0.08)' : 'var(--shadow-md)',
            position: 'relative',
          }}>
            <div style={{
              background: slot.type === 'locked' ? '#f5f5f5' : 'var(--surface-raised)',
              padding: '10px 14px',
              borderBottom: slot.type === 'locked' ? '1px solid #eee' : '1px solid var(--border)',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--weight-semibold)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span>{slot.type === 'locked' ? `${slot.emoji || '🔒'} ${slot.label}` : slot.label}</span>
              {slot.type === 'locked' && (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Lock size={11} /> 付费解锁
                </span>
              )}
            </div>

            {slot.type === 'real' ? (
              <>
                <img src={slot.url?.startsWith('data:') ? slot.url : proxyImg(slot.url)} alt={slot.label} style={{
                  width: '100%', display: 'block', aspectRatio: '1/1', objectFit: 'cover',
                }} loading="lazy" />
                <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
                  <button onClick={() => onDownload(slot.url, slot.label)} style={actionBtnStyle}>
                    <Download size={12} /> 下载
                  </button>
                  <button onClick={() => onRegenerate(slot.label)} disabled={loading} style={actionBtnStyle}>
                    <RefreshCw size={12} /> 重生成
                  </button>
                  <button onClick={() => onEdit(slot.label, '')} style={actionBtnStyle}>
                    <Edit3 size={12} /> 编辑
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{
                  width: '100%', aspectRatio: '1/1',
                  background: '#f9f9f9',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: 8, color: 'var(--text-muted)',
                }}>
                  <Lock size={28} style={{ opacity: 0.4 }} />
                  <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-ghost)' }}>
                    {slot.label}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}>
                    付费解锁后可生成
                  </div>
                </div>
                <button onClick={onUnlock} style={{
                  width: 'calc(100% - 16px)', margin: '8px',
                  padding: '8px 0', border: '1px solid var(--red)',
                  borderRadius: 'var(--radius-md)', fontFamily: 'inherit',
                  background: '#fff', color: 'var(--red)', cursor: 'pointer',
                  fontSize: 'var(--text-sm)', fontWeight: 600,
                  transition: 'all 0.15s',
                }}>
                  解锁这张图
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {result.errors?.length > 0 && (
        <div style={{
          marginTop: 14, background: '#FFF5F5', borderRadius: 'var(--radius-md)',
          padding: '10px 14px', fontSize: 'var(--text-xs)', color: '#C53030',
        }}>
          {result.errors.map((e, i) => <div key={i}>⚠️ {e.style} 失败: {e.error}</div>)}
        </div>
      )}

      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        {isLocked ? (
          <>
            <button onClick={onUnlock} style={{
              flex: 2, padding: '11px 0', border: 'none',
              borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)',
              fontWeight: 'var(--weight-semibold)', fontFamily: 'inherit',
              background: 'var(--red)', color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              🔓 解锁全部 {totalCount} 张图
            </button>
            <button onClick={onNew} style={{
              flex: 1, padding: '11px 0', border: '2px solid var(--border)',
              borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)',
              fontWeight: 'var(--weight-semibold)', fontFamily: 'inherit',
              background: '#fff', color: 'var(--text-secondary)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              重新生成
            </button>
          </>
        ) : (
          <>
            <button onClick={() => {
              realImages.forEach(([label, url]) => onDownload(url, label));
            }} style={{
              flex: 1, padding: '11px 0', border: '2px solid var(--border)',
              borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)',
              fontWeight: 'var(--weight-semibold)', fontFamily: 'inherit',
              background: '#fff', color: 'var(--text-secondary)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <Download size={14} /> 全部下载
            </button>
            <button onClick={onNew} style={{
              flex: 2, padding: '11px 0', border: 'none',
              borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)',
              fontWeight: 'var(--weight-semibold)', fontFamily: 'inherit',
              background: 'var(--red)', color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              重新生成新的商品
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const actionBtnStyle = {
  flex: 1, padding: '8px 0', border: 'none', borderRight: '1px solid var(--border)',
  fontSize: 'var(--text-xs)', fontFamily: 'inherit', cursor: 'pointer',
  background: '#fff', color: 'var(--text-secondary)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, transition: 'background 0.15s',
};

/* ══════════════════════════════════════════════════════════════════
   子组件
   ══════════════════════════════════════════════════════════════════ */
function Field({ label, children, small }) {
  return (
    <div style={{ marginBottom: small ? 10 : 18 }}>
      <label style={{
        fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
        color: 'var(--text-secondary)', marginBottom: 6, display: 'block',
      }}>{label}</label>
      {children}
    </div>
  );
}

function Chip({ children, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '7px 16px', borderRadius: 'var(--radius-md)',
      fontSize: 'var(--text-sm)', fontFamily: 'inherit', cursor: 'pointer',
      fontWeight: active ? 'var(--weight-semibold)' : 'var(--weight-normal)',
      background: active ? 'var(--red)' : 'var(--border-light)',
      color: active ? '#fff' : 'var(--text-secondary)',
      border: 'none', transition: 'all var(--duration-fast)',
    }}>
      {children}
    </button>
  );
}

const inputStyle = {
  width: '100%', padding: '12px 14px',
  border: '2px solid var(--border)', borderRadius: 'var(--radius-lg)',
  fontSize: 'var(--text-sm)', fontFamily: 'inherit', outline: 'none',
  boxSizing: 'border-box', transition: 'border-color 0.2s',
};
