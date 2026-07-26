import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MdAutoAwesome, MdArrowBack, MdRefresh } from 'react-icons/md';
import {
  getDesignDirections,
  generateEcommerce,
  saveWork,
  polishECText,
  uploadEcommerceAssets,
} from '../../../services/api';
import { quoteBillingAction } from '../../../services/billing.js';
import { useApp } from '../../../store/AppContext';
import { handleGenerationAccessError } from '../../../utils/generationAccess.js';
import EcommerceWorkbench from './EcommerceWorkbench';
import {
  buildEcommercePendingAction,
  ecommerceQuoteRequestKey,
  formatEcommerceQuote,
  invalidateEcommerceQuote,
  resolveEcommercePlan,
} from './ecommercePlanModel.js';
import { buildSupplementDeck } from './workbenchState';
import DirectionOptionCard from './components/DirectionOptionCard';
import { appendSupplementFiles, validateImageFile } from './components/supplementUploadModel';
import {
  createEcommerceGenerationLifecycleController,
  resolveEcommerceSupplementUpload,
  startEcommerceGenerationLifecycle,
} from './ecommerceTaskProgressModel.js';

function normalizeDirectionImages(images = []) {
  const seen = new Set();
  return images.map(image => typeof image === 'string' ? { url: image } : { ...(image || {}), url: image?.url || image?.src || image?.image_url || '' })
    .filter(image => image.url && !seen.has(image.url) && seen.add(image.url));
}

/* ═══════ 设计方向确认页（三段式第二步）═══ */
export default function DesignDirection({ params, onBack, onGenerated }) {
  const { state, dispatch, fetchCredits } = useApp();
  const [loading, setLoading] = useState(true);
  const [loadStage, setLoadStage] = useState(0); // 0=产品分析, 1=参考图分析, 2=生成方案
  const [directions, setDirections] = useState([]);
  const [selected, setSelected] = useState(0);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(''); // C4: SSE 进度文本
  const [genStage, setGenStage] = useState(0); // C4: 生成阶段
  const [assetProgress, setAssetProgress] = useState([]);
  const [stableImages, setStableImages] = useState([]);
  const [retryTaskRequested, setRetryTaskRequested] = useState(false);
  const [polishing, setPolishing] = useState(false);

  // 补充输入
  const [extraDesc, setExtraDesc] = useState(params?.description || '');
  // 补充上传图片必须保持产品事实与视觉参考两条独立数据流。
  const [extraProductImages, setExtraProductImages] = useState([]);
  const [extraReferenceImages, setExtraReferenceImages] = useState([]);
  const [blockedByCredits, setBlockedByCredits] = useState(false);
  const [supplementError, setSupplementError] = useState('');
  const [billingQuote, setBillingQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [quoteNotice, setQuoteNotice] = useState('');
  const [quoteRefreshVersion, setQuoteRefreshVersion] = useState(0);
  const ownerEmail = String(state.email || state.phone || '').trim().toLowerCase();
  const draftId = String(params?.draftId || '').trim();
  const generationTokenRef = useRef(null);
  const generationAbortRef = useRef(null);
  const generationLifecycleRef = useRef(null);
  if (!generationLifecycleRef.current) {
    generationLifecycleRef.current = createEcommerceGenerationLifecycleController({
      ownerEmail,
      draftId,
      tokenRef: generationTokenRef,
      abortRef: generationAbortRef,
    });
  }
  const generationLifecycle = generationLifecycleRef.current;
  generationLifecycle.syncContext({ ownerEmail, draftId });
  const isGenerationCurrent = (token) => generationLifecycle.isCurrent(token);

  useEffect(() => {
    generationLifecycle.invalidate();
    setGenerating(false);
    setStableImages([]);
    setAssetProgress([]);
    setGenProgress('');
  }, [ownerEmail, draftId]);

  useEffect(() => () => {
    generationLifecycle.unmount();
  }, []);

  const ecommercePlan = useMemo(() => resolveEcommercePlan({
    platform: params?.platform || 'smart',
    sizing: params?.sizing || {},
    resolution: params?.genSettings?.resolution || '2K',
    skus: params?.skus || [],
  }), [params?.genSettings?.resolution, params?.platform, params?.sizing, params?.skus]);
  const quoteText = formatEcommerceQuote({
    quantity: ecommercePlan.quantity,
    quote: billingQuote,
    unlimited: state.unlimited,
  });
  const quoteRequestKey = ecommerceQuoteRequestKey(
    ecommercePlan.quoteRequest,
    quoteRefreshVersion,
  );

  useEffect(() => {
    loadDirections();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setBillingQuote(null);
    setQuoteError('');
    if (!ecommercePlan.quoteRequest) {
      setQuoteNotice('');
      return () => { cancelled = true; };
    }
    setQuoteLoading(true);
    quoteBillingAction(ecommercePlan.quoteRequest)
      .then(response => {
        if (!cancelled) {
          setBillingQuote(response?.quote || null);
          setQuoteNotice('');
        }
      })
      .catch(error => {
        if (!cancelled) {
          setQuoteNotice('');
          setQuoteError(error?.message || '费用计算失败，请稍后重试');
        }
      })
      .finally(() => {
        if (!cancelled) setQuoteLoading(false);
      });
    return () => { cancelled = true; };
  }, [quoteRequestKey]);

  const loadDirections = async () => {
    setLoading(true);
    setError('');
    setLoadStage(0);
    try {
      const timer1 = setTimeout(() => setLoadStage(1), 2000);
      const timer2 = setTimeout(() => setLoadStage(2), 4000);

      const uploadedSupplement = await uploadSupplementAssetsForAnalysis();

      const res = await getDesignDirections({
        product_name: params?.productName || params?.description?.slice(0, 20) || '商品',
        description: extraDesc || params?.description || '',
        category: params?.category || '其他',
        real_shots: [...(params?.realShots || []), ...uploadedSupplement.product],
        ref_shots: [...(params?.refShots || []), ...uploadedSupplement.reference],
        platform: params?.platform || 'smart',
        style_skill: params?.styleSkill || 'smart',
        product_params: params?.productParams || {},
        skus: params?.skus || [],
        copywriting: params?.copywriting || {},
      });

      clearTimeout(timer1);
      clearTimeout(timer2);
      setLoadStage(3);

      setDirections(res.directions || []);
      setAnalysis(res.analysis || null);
      if (res.directions?.length) setSelected(0);
    } catch (e) {
      setError(e.message || '加载失败');
    }
    setLoading(false);
  };

  const updateDirection = (index, key, value) => {
    setDirections(prev => prev.map((direction, i) => i === index ? { ...direction, [key]: value } : direction));
  };

  /* ── AI 润色文案 ── */
  const handlePolish = async () => {
    if (!extraDesc.trim() || polishing) return;
    setPolishing(true);
    try {
      const result = await polishECText({ text: extraDesc, product_name: params?.productName || '商品', category: params?.category || '其他' });
      if (result?.polished) setExtraDesc(result.polished);
    } catch (e) { console.warn('[polish]', e.message); }
    setPolishing(false);
  };

  /* ── 补充图片上传 ── */
  const appendSupplementImages = (event, type) => {
    const files = Array.from(event.target.files || []);
    const checked = files.map(file => ({ file, result: validateImageFile(file) }));
    const validFiles = checked.filter(item => item.result.valid).map(item => item.file);
    const rejected = checked.find(item => !item.result.valid);
    setSupplementError(rejected ? `${rejected.file.name || '图片'}：${rejected.result.error}` : '');
    if (validFiles.length) {
      const setter = type === 'product' ? setExtraProductImages : setExtraReferenceImages;
      setter(prev => appendSupplementFiles(prev, validFiles, { sourceType: type }));
      setBlockedByCredits(false);
    }
    event.target.value = '';
  };
  const removeSupplementImage = (type, index) => {
    const setter = type === 'product' ? setExtraProductImages : setExtraReferenceImages;
    setter(prev => {
      const removed = prev[index];
      if (removed?.url?.startsWith('blob:')) URL.revokeObjectURL(removed.url);
      return prev.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  const uploadSupplementAssets = async ({ generationToken, signal } = {}) => {
    const [product, reference] = await Promise.all([
      uploadEcommerceAssets(extraProductImages, 'product', { signal }),
      uploadEcommerceAssets(extraReferenceImages, 'reference', { signal }),
    ]);
    const uploaded = resolveEcommerceSupplementUpload({
      product,
      reference,
      generationToken,
      isGenerationCurrent,
    });
    if (!uploaded) return null;
    setExtraProductImages(uploaded.product);
    setExtraReferenceImages(uploaded.reference);
    return uploaded;
  };
  const uploadSupplementAssetsForAnalysis = () => uploadSupplementAssets();
  const uploadSupplementAssetsForGeneration = (generationToken, signal) => uploadSupplementAssets({ generationToken, signal });

  /* ── 确认方向 → 生成 ── */
  const handleConfirm = async () => {
    if (generating) return;
    const generation = startEcommerceGenerationLifecycle({
      lifecycle: generationLifecycle,
      quoteReady: Boolean(billingQuote && ecommercePlan.quoteRequest),
      onError: (preconditionError) => {
        setError(preconditionError.message);
        setGenerating(false);
      },
    });
    if (!generation) return;
    const { token: generationToken, signal: generationSignal } = generation;
    setGenerating(true);
    setBlockedByCredits(false);
    setGenProgress('正在生成…');
    setGenStage(0);
    let pendingAction = null;
    try {
      const uploadedSupplement = await uploadSupplementAssetsForGeneration(generationToken, generationSignal);
      if (!isGenerationCurrent(generationToken) || !uploadedSupplement) return;
      const dir = directions[selected];
      const directionBrief = [dir?.title, dir?.one_liner, dir?.description].filter(Boolean).join('。');
      pendingAction = buildEcommercePendingAction({
        platform: params?.platform || '淘宝',
        direction: {
          id: dir?.id,
          brief: dir?.description || dir?.short_desc || dir?.one_liner || '',
        },
        sizing: {
          ...(params?.sizing || {}),
          resolution: params?.genSettings?.resolution || params?.sizing?.resolution || '2K',
        },
        skus: params?.skus || [],
        customColors: params?.customColors || [],
        originalProductAssets: params?.realShots || [],
        supplementalProductAssets: uploadedSupplement.product,
        originalReferenceAssets: params?.refShots || [],
        supplementalReferenceAssets: uploadedSupplement.reference,
        promptText: extraDesc,
        promptReferences: [
          { key: 'product_name', text: params?.productName || '' },
          { key: 'category', text: params?.category || '' },
          { key: 'description', text: params?.description || '' },
          { key: 'selling_points', text: params?.copywriting?.sellingPoints || '' },
          { key: 'direction_brief', text: directionBrief },
        ],
      });
      const result = await generateEcommerce({
        productName: params?.productName || params?.description?.slice(0, 20) || '商品',
        category: params?.category || '其他',
        points: [params?.copywriting?.sellingPoints || params?.description || '', directionBrief].filter(Boolean).join('。设计方向：'),
        platform: params?.platform || '淘宝',
        email: state.phone,
        refImgs: [...(params?.refShots || []), ...uploadedSupplement.reference],
        realShots: [...(params?.realShots || []), ...uploadedSupplement.product],
        skus: params?.skus || [],
        detailPlan: params?.copywriting?.detailPlan || {},
        maintenance: params?.copywriting?.maintenance || '',
        material: params?.productParams?.material || '',
        restrictions: params?.restrictions || '',
        // B5/B9: 正确传递场景预设和图片选择
        imageSelections: params?.imageSelections || params?.sizing?.images || null,
        imageSize: params?.imageSize || (params?.sizing?.smart ? null : null),
        generationSettings: params?.genSettings || null,
        // B5: 场景预设通过 style_skill 字段传递，不是 imageSelections
        styleSkill: params?.styleSkill || 'smart',
        customColors: params?.customColors || null,
        sizing: params?.sizing || null,
        direction: {
          ...dir,
          editableBrief: dir?.description || dir?.short_desc || '',
        },
        billingQuoteId: billingQuote.quoteId,
        draftId: params?.draftId || '',
        retry: retryTaskRequested,
        signal: generationSignal,
        isCurrent: () => isGenerationCurrent(generationToken),
        onProgress: (task) => {
          if (!isGenerationCurrent(generationToken)) return;
          // C4: SSE 实时进度
          if (Array.isArray(task.assets)) setAssetProgress(task.assets);
          if (task.step) setGenProgress(task.step);
          if (task.stage) setGenStage(task.stage);
          if (task.message) setGenProgress(task.message);
        },
        onImage: (image) => {
          if (!isGenerationCurrent(generationToken)) return;
          // C4: 每张图片生成时更新进度
          if (image.id) setGenProgress(`已生成: ${image.label || image.role || image.id}`);
          if (image.id && image.stableUrl) {
            setStableImages(previous => previous.some(item => item.id === image.id && item.stableUrl === image.stableUrl)
              ? previous
              : [...previous, image]);
          }
        },
      });
      if (!isGenerationCurrent(generationToken)) return;
      const hasStableResult = Object.keys(result?.images || {}).length > 0;
      const hasFinalStatus = result?.status === 'completed' || result?.status === 'needs_review';
      if (result && hasFinalStatus && hasStableResult) {
        if (!isGenerationCurrent(generationToken)) return;
        const finalResult = { ...result, product_name: params?.productName || '商品', _ecResult: true, _direction: dir, category: params?.category || '其他', platform: params?.platform || '淘宝' };

        // ★ 立即保存到服务器作品集
        const phone = state.phone || '';
        const imageEntries = Object.entries(finalResult.images || {});
        const serverWork = {
          product_name: finalResult.product_name,
          category: finalResult.category,
          platform: finalResult.platform,
          _ecResult: true,
          at: new Date().toLocaleDateString('zh-CN'),
          images: imageEntries.map(([key, url]) => ({ url, key, label: key, style: key })),
        };
        try {
          await saveWork(serverWork, phone, { signal: generationSignal });
          console.log('[EC] ★ 作品已保存到服务器:', finalResult.product_name);
        } catch (e) {
          console.warn('[EC] 服务器保存失败:', e.message);
        }
        if (!isGenerationCurrent(generationToken)) return;
        fetchCredits(phone);

        // 存储结果到全局 state 并跳转到画布
        dispatch({ type: 'SET_RESULT', result: finalResult });
        dispatch({ type: 'NAVIGATE', page: 'ec-canvas' });
        dispatch({ type: 'CLEAR_PAYWALL' });
        setRetryTaskRequested(false);
        onGenerated?.();
      } else {
        setError('任务尚未完成或没有稳定图片，请稍后继续生成');
      }
    } catch (e) {
      if (!isGenerationCurrent(generationToken)) return;
      const failedQuoteId = billingQuote?.quoteId || '';
      const accessResult = handleGenerationAccessError(e, dispatch, {
        source: 'ecommerce-direction',
        ownerEmail: state.phone,
        route: globalThis.location?.pathname || '/',
        draftId: params?.draftId || '',
        quoteId: failedQuoteId,
        action: pendingAction || buildEcommercePendingAction({
          platform: params?.platform || '淘宝',
          direction: directions[selected] || {},
          sizing: {
            ...(params?.sizing || {}),
            resolution: params?.genSettings?.resolution || params?.sizing?.resolution || '2K',
          },
          skus: params?.skus || [],
          customColors: params?.customColors || [],
          originalProductAssets: params?.realShots || [],
          supplementalProductAssets: extraProductImages,
          originalReferenceAssets: params?.refShots || [],
          supplementalReferenceAssets: extraReferenceImages,
          promptText: extraDesc,
          promptReferences: [
            { key: 'product_name', text: params?.productName || '' },
            { key: 'category', text: params?.category || '' },
            { key: 'description', text: params?.description || '' },
            { key: 'selling_points', text: params?.copywriting?.sellingPoints || '' },
          ],
        }),
      });
      if (e?.reQuoteRequired === true) {
        const invalidated = invalidateEcommerceQuote({
          quote: billingQuote,
          refreshVersion: quoteRefreshVersion,
        });
        setBillingQuote(null);
        setQuoteLoading(true);
        setQuoteError('');
        setQuoteNotice(invalidated.message);
        setQuoteRefreshVersion(invalidated.refreshVersion);
        setError('');
      } else if (accessResult === 'credits') {
        setBlockedByCredits(true);
        setError('');
      } else if (accessResult === 'login') {
        setError('');
      } else if (e?.code === 'ECOMMERCE_TASK_RETRY_REQUIRED') {
        setRetryTaskRequested(true);
        setError('上次任务未完成。请确认后再次点击“继续生成”以创建新任务。');
      } else {
        setError(e.message || '生成失败');
      }
    } finally {
      if (isGenerationCurrent(generationToken)) {
        setGenerating(false);
        setGenProgress('');
        setGenStage(0);
        generationLifecycle.release(generationToken);
      }
    }
  };

  const LOAD_STAGES = [
    { label: 'VLM 解析产品图', desc: '锁定外形、材质、配色...' },
    { label: 'VLM 解析参考图', desc: '提取光影氛围、布景调性...' },
    { label: '生成设计方案', desc: 'AI 设计师构思差异化方向...' },
  ];

  const inheritedProductImages = normalizeDirectionImages([...(params?.realShots || []), ...(params?.productImages || [])]);
  const inheritedReferenceImages = normalizeDirectionImages(params?.refShots || []);
  const supplementDeck = buildSupplementDeck({
    inheritedProductImages,
    addedProductImages: extraProductImages,
    inheritedReferenceImages,
    addedReferenceImages: extraReferenceImages,
  });
  const inheritedProductCount = inheritedProductImages.length;
  const inheritedReferenceCount = inheritedReferenceImages.length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 100 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 16px' }}>
        {/* ── 顶部导航 ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div onClick={onBack} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '8px 14px', borderRadius: 12,
            background: '#fff', border: '1px solid rgba(0,0,0,0.08)',
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
            color: 'var(--text-secondary)', transition: 'all 0.15s',
          }}>
            <MdArrowBack size={16} /> 返回
          </div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1a1a1a' }}>
            确认设计方向
          </h2>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 4 }}>
            AI 已为你的产品设计了多套视觉方案
          </span>
        </div>

        {/* ── 加载进度 ── */}
        {loading && (
          <div style={{
            background: '#fff', borderRadius: 16, padding: '32px 28px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
            border: '1px solid rgba(0,0,0,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <MdAutoAwesome size={20} style={{ color: '#7c3aed', animation: 'spin 1.5s linear infinite' }} />
              <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>AI 正在分析产品并设计方案…</span>
            </div>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            {LOAD_STAGES.map((stage, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 0',
                opacity: loadStage >= i ? 1 : 0.35,
                transition: 'opacity 0.4s',
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                  background: loadStage > i ? '#22c55e' : loadStage === i ? '#7c3aed' : '#e5e7eb',
                  color: loadStage >= i ? '#fff' : '#9ca3af',
                  transition: 'all 0.3s',
                }}>
                  {loadStage > i ? '✓' : i + 1}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: loadStage >= i ? '#1a1a1a' : '#9ca3af' }}>{stage.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{stage.desc}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── 错误 ── */}
        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12,
            padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 13, color: '#dc2626' }}>{error}</span>
            <div onClick={loadDirections} style={{
              marginLeft: 'auto', padding: '4px 12px', borderRadius: 8,
              background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
            }}>重试</div>
          </div>
        )}

        {/* ── 方向卡片 ── */}
        {!loading && directions.length > 0 && (
          <>
            {/* 2×2 对称布局 */}
            <div role="radiogroup" aria-label="选择一个设计方向" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, marginBottom: 24 }}>
              {directions.map((dir, i) => (
                <DirectionOptionCard
                  key={dir.id || i}
                  direction={dir}
                  index={i}
                  selected={selected === i}
                  onSelect={index => { setSelected(index); setBlockedByCredits(false); }}
                  editableDescription={dir.description || dir.short_desc || ''}
                  onDescriptionChange={value => { updateDirection(i, 'description', value); setBlockedByCredits(false); }}
                />
              ))}
            </div>

            {/* ── 补充素材与调整：复用第一步工作台 ── */}
            <div style={{ background: '#fff', borderRadius: 16, padding: '16px 18px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.06)', marginBottom: 20 }}>
              <EcommerceWorkbench
                productImages={supplementDeck.productImages}
                refImages={supplementDeck.referenceImages}
                description={extraDesc}
                onDescriptionChange={value => { setExtraDesc(value); setBlockedByCredits(false); }}
                onProductUpload={event => appendSupplementImages(event, 'product')}
                onReferenceUpload={event => appendSupplementImages(event, 'reference')}
                onRemoveProduct={index => { if (index >= inheritedProductCount) removeSupplementImage('product', index - inheritedProductCount); }}
                onRemoveReference={index => { if (index >= inheritedReferenceCount) removeSupplementImage('reference', index - inheritedReferenceCount); }}
                heading="补充素材与调整方向"
                subheading="第一步素材已经带入；还可以补充商品角度、竞品风格或新的生成要求。"
                promptTitle="补充你希望调整的画面、卖点或场景"
                promptExamples={['例：主图更突出材质和尺寸感，减少装饰元素', '例：参考竞品构图，但保留我的品牌配色和商品结构']}
              />

              {supplementError && (
                <div role="alert" style={{ marginTop: 10, padding: '9px 12px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', fontSize: 11 }}>
                  {supplementError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 11, color: '#8A8177', lineHeight: 1.5 }}>已带入素材不可在这里删除；“本轮新增”素材可随时移除，不影响第一步内容。</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={handlePolish} disabled={!extraDesc.trim() || polishing} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 10, border: '1px solid #DED7CC', background: '#fff', color: '#5F574F', fontSize: 12, fontWeight: 700, cursor: !extraDesc.trim() || polishing ? 'not-allowed' : 'pointer', opacity: !extraDesc.trim() ? .45 : 1 }}>
                    <MdAutoAwesome size={13} />{polishing ? '润色中…' : 'AI 润色补充说明'}
                  </button>
                  <button type="button" onClick={loadDirections} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 10, border: 0, background: '#1F2937', color: '#fff', fontSize: 12, fontWeight: 800, cursor: loading ? 'wait' : 'pointer' }}>
                    <MdRefresh size={14} />重新分析四个方向
                  </button>
                </div>
              </div>

              {blockedByCredits && <div style={{ marginTop: 12, borderRadius: 12, padding: '10px 12px', background: '#FFF8E7', border: '1px solid #F4D88A', color: '#73510D', fontSize: 12 }}>当前方案和补充内容已经保留。完成充值后，直接点击下方“继续生成”即可。</div>}
            </div>

            {/* ── 确认按钮 ── */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button onClick={handleConfirm} disabled={generating || quoteLoading || !billingQuote || !ecommercePlan.quoteRequest}
                style={{
                  padding: '14px 48px', borderRadius: 25,
                  border: 'none', fontSize: 16, fontWeight: 800,
                  fontFamily: 'inherit',
                   background: generating || quoteLoading || !billingQuote ? '#ddd' : 'linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #f59e0b 100%)',
                   color: '#fff', cursor: generating || quoteLoading || !billingQuote ? 'not-allowed' : 'pointer',
                   boxShadow: generating || quoteLoading || !billingQuote ? 'none' : '0 6px 24px rgba(124,58,237,0.35)',
                  transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                {generating ? (
                  <><MdAutoAwesome size={18} style={{ animation: 'spin 1s linear infinite' }} /> {genProgress || '正在生成图片，请稍候…'}</>
                ) : (
                  <>{blockedByCredits ? '继续生成' : '确认方向，开始生成'} <span style={{ fontSize: 18 }}>→</span></>
                )}
              </button>
            </div>
            <div style={{ textAlign: 'center', marginTop: 9, fontSize: 12, fontWeight: 700, color: quoteError ? '#b91c1c' : '#6b625a' }}>
              {quoteError || quoteNotice || quoteText}
            </div>

            {/* ── 生成进度面板（可折叠）── */}
            {(generating || assetProgress.length > 0 || stableImages.length > 0) && (
              <div style={{
                background: '#fff', borderRadius: 16, padding: '16px 20px',
                boxShadow: '0 4px 20px rgba(124,58,237,0.15)',
                border: '2px solid rgba(124,58,237,0.2)',
                marginTop: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <MdAutoAwesome size={18} color="#fff" style={{ animation: 'spin 1.5s linear infinite' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>AI 正在生成图片</div>
                    <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>生成过程中请勿关闭页面，图片将自动保存到您的账户</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed' }}>{genProgress || '准备中…'}</div>
                </div>
                {/* 进度条 */}
                <div style={{ height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    background: 'linear-gradient(90deg, #7c3aed, #ec4899)',
                    width: genProgress?.includes('%') ? genProgress : '30%',
                    transition: 'width 0.5s ease',
                  }} />
                </div>
                {assetProgress.length > 0 && (
                  <div style={{ display: 'grid', gap: 6, marginTop: 14 }}>
                    {assetProgress.map(asset => (
                      <div key={asset.id || `${asset.role}-${asset.label}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 9px', borderRadius: 8, background: '#FAF8FC', fontSize: 12 }}>
                        <span style={{ color: '#4B4453' }}>{asset.role || '图片'} · {asset.label || '待处理图片'}</span>
                        <span style={{ color: '#7C3AED', fontWeight: 700 }}>{asset.userState || '正在生成'}</span>
                      </div>
                    ))}
                  </div>
                )}
                {stableImages.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                    {stableImages.map(image => (
                      <img key={`${image.id}-${image.stableUrl}`} src={image.stableUrl} alt={image.label || image.role || '稳定生成图'} style={{ width: 74, height: 74, objectFit: 'cover', borderRadius: 8, border: '1px solid #E9DDF8' }} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── 无方向数据 ── */}
        {!loading && !error && directions.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '60px 20px',
            color: 'var(--text-muted)', fontSize: 14,
          }}>
            <p>未生成设计方向，请检查输入后重试</p>
            <div onClick={loadDirections} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '8px 18px', borderRadius: 10,
              background: '#1a1a1a', color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              marginTop: 12,
            }}>重试</div>
          </div>
        )}
      </div>
    </div>
  );
}
