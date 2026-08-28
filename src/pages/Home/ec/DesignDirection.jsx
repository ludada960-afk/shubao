import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MdAutoAwesome, MdArrowBack, MdChevronLeft, MdChevronRight, MdClose, MdRefresh } from 'react-icons/md';
import {
  getDesignDirections,
  generateEcommerce,
  polishECText,
  uploadEcommerceAssets,
} from '../../../services/api';
import { quoteBillingAction } from '../../../services/billing.js';
import { attachProductProfileImages } from '../../../services/projects.js';
import {
  createBoundedRequestLifecycle,
  requestFailureMessage,
} from '../../../services/requestLifecycle.js';
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
import { buildAbilityAssetRoles, buildSupplementDeck, withEcommerceCanvasSources } from './workbenchState';
import EcommerceDesignPlanEditor from './EcommerceDesignPlanEditor.jsx';
import { applyCanvasSuitePlanToDirection } from '../../EcCanvas/canvasSuitePlanModel.js';
import { appendSupplementFiles, validateImageFile } from './components/supplementUploadModel';
import ResponsiveImage from '../../../components/ResponsiveImage.jsx';
import {
  clearEcommerceDirectionRefreshAction,
  acceptEcommerceFinalResult,
  createEcommerceGenerationLifecycleController,
  ecommerceLoginPreflight,
  loadEcommerceDirectionRefreshAction,
  mergeEcommerceStableImageList,
  resolveEcommerceSupplementUpload,
  saveEcommerceDirectionRefreshAction,
  startEcommerceGenerationLifecycle,
} from './ecommerceTaskProgressModel.js';
import {
  getDirectionExecutionGuide,
} from './components/directionUiModel.js';
import { normalizeCommerceContext } from './internationalCommerceRegistry.js';

function normalizeDirectionImages(images = []) {
  const seen = new Set();
  return (Array.isArray(images) ? images : []).map(image => typeof image === 'string' ? { url: image } : { ...(image || {}), url: image?.url || image?.src || image?.image_url || '' })
    .filter(image => image.url && !seen.has(image.url) && seen.add(image.url));
}

function mergeDirectionImages(...groups) {
  const seen = new Set();
  return groups.flatMap(group => normalizeDirectionImages(group)).filter(image => {
    const key = String(image.assetId || image.id || image.url || '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function tryOnRecipeId(params) {
  return params?.abilityRecipe?.id || params?.ability_recipe?.id || params?.recipeId || 'product_suite';
}

function roleImagesFromParams(params = {}, role) {
  const roleImages = params.roleImages && typeof params.roleImages === 'object' ? params.roleImages : {};
  if (role === 'items') return mergeDirectionImages(roleImages.items, params.realShots, params.productImages);
  if (role === 'person') return mergeDirectionImages(roleImages.person, params.personShots);
  return mergeDirectionImages(roleImages.scene, params.sceneShots, params.refShots);
}

function createClientCreativeAttemptId() {
  return `ec-route-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
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
  const [errorStage, setErrorStage] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(''); // C4: SSE 进度文本
  const [genStage, setGenStage] = useState(0); // C4: 生成阶段
  const [assetProgress, setAssetProgress] = useState([]);
  const [stableImages, setStableImages] = useState([]);
  const [previewImageIndex, setPreviewImageIndex] = useState(-1);
  const [polishing, setPolishing] = useState(false);

  // 补充输入
  const [extraDesc, setExtraDesc] = useState(params?.description || '');
  // 补充上传图片必须保持产品事实与视觉参考两条独立数据流。
  const [extraProductImages, setExtraProductImages] = useState([]);
  const [extraReferenceImages, setExtraReferenceImages] = useState([]);
  const [extraPersonImages, setExtraPersonImages] = useState([]);
  const abilityRecipeId = tryOnRecipeId(params);
  const isTryOn = abilityRecipeId === 'anything_tryon';
  const [activePersonMode, setActivePersonMode] = useState(
    params?.personMode === 'reference' || params?.person_mode === 'reference' ? 'reference' : 'smart',
  );
  const initialTryOnItems = roleImagesFromParams(params, 'items');
  const initialTryOnPerson = roleImagesFromParams(params, 'person');
  const initialTryOnScene = roleImagesFromParams(params, 'scene');
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
  const supplementBlobUrlsRef = useRef(new Set());
  const directionRefreshActionRef = useRef(null);
  const analysisRequestRef = useRef(null);
  const creativeAttemptRef = useRef(createClientCreativeAttemptId());
  const recentCreativeRoutesRef = useRef([]);
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
    analysisRequestRef.current?.cancel();
    analysisRequestRef.current?.cleanup();
    analysisRequestRef.current = null;
    generationLifecycle.invalidate();
    setGenerating(false);
    setStableImages([]);
    setAssetProgress([]);
    setGenProgress('');
    creativeAttemptRef.current = createClientCreativeAttemptId();
    recentCreativeRoutesRef.current = [];
    directionRefreshActionRef.current = loadEcommerceDirectionRefreshAction({ ownerEmail, draftId })?.actionId || null;
  }, [ownerEmail, draftId]);

  useEffect(() => () => {
    analysisRequestRef.current?.cancel();
    analysisRequestRef.current?.cleanup();
    generationLifecycle.unmount();
    supplementBlobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    supplementBlobUrlsRef.current.clear();
  }, []);

  useEffect(() => {
    [...extraProductImages, ...extraReferenceImages, ...extraPersonImages].forEach(image => {
      if (image?.url?.startsWith('blob:')) supplementBlobUrlsRef.current.add(image.url);
    });
  }, [extraProductImages, extraReferenceImages, extraPersonImages]);

  useEffect(() => {
    if (previewImageIndex < 0) return undefined;
    const handlePreviewKey = (event) => {
      if (event.key === 'Escape') setPreviewImageIndex(-1);
      if (event.key === 'ArrowLeft') {
        setPreviewImageIndex(index => (index - 1 + stableImages.length) % stableImages.length);
      }
      if (event.key === 'ArrowRight') {
        setPreviewImageIndex(index => (index + 1) % stableImages.length);
      }
    };
    globalThis.addEventListener?.('keydown', handlePreviewKey);
    return () => globalThis.removeEventListener?.('keydown', handlePreviewKey);
  }, [previewImageIndex, stableImages.length]);

  const commerceContext = useMemo(() => normalizeCommerceContext({
    ...(params?.commerceContext || {}),
    platform: params?.commerceContext?.platform || params?.platform,
    contentType: params?.commerceContext?.contentType || params?.contentType,
    targetLanguage: params?.commerceContext?.targetLanguage || params?.targetLanguage,
  }), [params?.commerceContext, params?.contentType, params?.platform, params?.targetLanguage]);
  const ecommercePlan = useMemo(() => resolveEcommercePlan({
    platform: commerceContext.platform,
    sizing: { ...(params?.sizing || {}), contentType: commerceContext.contentType },
    resolution: params?.genSettings?.resolution || '2K',
    imageModel: params?.genSettings?.imageModel || 'image2',
    skus: params?.skus || [],
  }), [commerceContext.contentType, commerceContext.platform, params?.genSettings?.imageModel, params?.genSettings?.resolution, params?.sizing, params?.skus]);
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

  const loadDirections = async ({
    refreshBilling = null,
    creativeAttemptId = creativeAttemptRef.current,
    recentRoutes = recentCreativeRoutesRef.current,
  } = {}) => {
    analysisRequestRef.current?.cancel();
    analysisRequestRef.current?.cleanup();
    const analysisRequest = createBoundedRequestLifecycle();
    analysisRequestRef.current = analysisRequest;
    setLoading(true);
    setError('');
    setErrorStage('');
    setLoadStage(0);
    let timer1;
    let timer2;
    try {
      timer1 = setTimeout(() => {
        if (analysisRequestRef.current === analysisRequest) setLoadStage(1);
      }, 2000);
      timer2 = setTimeout(() => {
        if (analysisRequestRef.current === analysisRequest) setLoadStage(2);
      }, 4000);

      const uploadedSupplement = await uploadSupplementAssetsForAnalysis(analysisRequest.signal);
      const semanticRoleImages = isTryOn ? {
        items: mergeDirectionImages(initialTryOnItems, uploadedSupplement.product),
        person: activePersonMode === 'reference' ? mergeDirectionImages(initialTryOnPerson, uploadedSupplement.person) : [],
        scene: mergeDirectionImages(initialTryOnScene, uploadedSupplement.reference),
      } : null;

      const res = await getDesignDirections({
        product_name: params?.productName || params?.description?.slice(0, 20) || '商品',
        description: extraDesc || params?.description || '',
        category: params?.category || '其他',
        real_shots: isTryOn
          ? semanticRoleImages.items
          : [...(params?.realShots || []), ...uploadedSupplement.product],
        ref_shots: isTryOn
          ? semanticRoleImages.scene
          : [...(params?.refShots || []), ...uploadedSupplement.reference],
        ...(isTryOn ? {
          abilityRecipe: params?.abilityRecipe || params?.ability_recipe || { id: abilityRecipeId, version: 1 },
          personMode: activePersonMode,
          roleImages: semanticRoleImages,
        } : {}),
        platform: commerceContext.platform,
        content_type: commerceContext.contentType,
        target_language: commerceContext.targetLanguage,
        commerce_context: commerceContext,
        style_skill: params?.styleSkill || 'smart',
        product_params: params?.productParams || {},
        skus: params?.skus || [],
        copywriting: params?.copywriting || {},
        requested_images: ecommercePlan.images,
        creative_attempt_id: creativeAttemptId,
        recent_creative_routes: recentRoutes,
        refresh: Boolean(refreshBilling),
        billingQuoteId: refreshBilling?.quoteId,
        billingActionId: refreshBilling?.actionId,
      }, { signal: analysisRequest.signal });

      if (analysisRequestRef.current !== analysisRequest) return;

      setLoadStage(3);

      setAnalysis(res.analysis || null);
      const enrichedDirections = (res.directions || []).map(direction => ({
        ...direction,
        analysis: res.analysis || null,
        productName: params?.productName || params?.description?.slice(0, 20) || '商品',
        category: params?.category || '其他',
        commerce_context: commerceContext,
      }));
      setDirections(enrichedDirections);
      if (res.creativeRoute?.attemptId) creativeAttemptRef.current = res.creativeRoute.attemptId;
      if (res.creativeRoute?.route) {
        recentCreativeRoutesRef.current = [
          res.creativeRoute.route,
          ...recentCreativeRoutesRef.current.filter(route => route?.id !== res.creativeRoute.route.id),
        ].slice(0, 6);
      }
      if (enrichedDirections.length) setSelected(0);
    } catch (e) {
      if (analysisRequestRef.current !== analysisRequest) return;
      const message = requestFailureMessage(e, analysisRequest);
      if (refreshBilling) {
        if (!message) return;
        throw Object.assign(new Error(message), {
          code: e?.code,
          status: e?.status,
          billing: e?.billing,
        });
      }
      if (message) {
        setErrorStage('analysis');
        setError(message);
      }
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
      analysisRequest.cleanup();
      if (analysisRequestRef.current === analysisRequest) {
        analysisRequestRef.current = null;
        setLoading(false);
      }
    }
  };

  const handleRefreshDirections = async () => {
    if (loading) return;
    try {
      const { quote } = await quoteBillingAction({ sku: 'ec_direction_refresh', quantity: 1 });
      const actionId = directionRefreshActionRef.current
        || `ec-direction-refresh-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
      directionRefreshActionRef.current = actionId;
      saveEcommerceDirectionRefreshAction({ ownerEmail, draftId, actionId });
      const nextCreativeAttemptId = createClientCreativeAttemptId();
      const currentRoute = directions[selected]?.creative_route;
      const recentRoutes = [
        ...(currentRoute ? [currentRoute] : []),
        ...recentCreativeRoutesRef.current,
      ].filter((route, index, list) => route && list.findIndex(item => item?.id === route.id) === index).slice(0, 6);
      await loadDirections({
        refreshBilling: {
          quoteId: quote.quoteId,
          actionId,
        },
        creativeAttemptId: nextCreativeAttemptId,
        recentRoutes,
      });
      clearEcommerceDirectionRefreshAction({ ownerEmail, draftId, actionId });
      directionRefreshActionRef.current = null;
      fetchCredits(state.phone || '');
    } catch (e) {
      if (e?.code === 'CANVAS_BILLING_ACTION_RELEASED') {
        const actionId = directionRefreshActionRef.current;
        clearEcommerceDirectionRefreshAction({ ownerEmail, draftId, actionId });
        directionRefreshActionRef.current = null;
      }
      const accessResult = handleGenerationAccessError(e, dispatch, {
        source: 'ecommerce-direction-refresh',
        ownerEmail,
        route: globalThis.location?.pathname || '/',
        draftId,
        currency: 'ec_points',
      });
      if (!accessResult) {
        setErrorStage('analysis');
        setError(e?.message || '重新分析失败，请稍后重试');
      }
    }
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
      const setter = type === 'product'
        ? setExtraProductImages
        : type === 'person' ? setExtraPersonImages : setExtraReferenceImages;
      setter(prev => appendSupplementFiles(prev, validFiles, { sourceType: type }));
      setBlockedByCredits(false);
    }
    event.target.value = '';
  };
  const removeSupplementImage = (type, index) => {
    const setter = type === 'product'
      ? setExtraProductImages
      : type === 'person' ? setExtraPersonImages : setExtraReferenceImages;
    setter(prev => {
      const removed = prev[index];
      if (removed?.url?.startsWith('blob:')) URL.revokeObjectURL(removed.url);
      return prev.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  const uploadSupplementAssets = async ({ generationToken, signal } = {}) => {
    const [product, reference, person] = await Promise.all([
      uploadEcommerceAssets(extraProductImages, 'product', { signal }),
      uploadEcommerceAssets(extraReferenceImages, 'reference', { signal }),
      isTryOn ? uploadEcommerceAssets(extraPersonImages, 'person', { signal }) : Promise.resolve([]),
    ]);
    const uploaded = resolveEcommerceSupplementUpload({
      product,
      reference,
      person,
      generationToken,
      isGenerationCurrent,
    });
    if (!uploaded) return null;
    setExtraProductImages(uploaded.product);
    setExtraReferenceImages(uploaded.reference);
    return { ...uploaded, person: Array.isArray(person) ? person : [] };
  };
  const uploadSupplementAssetsForAnalysis = (signal) => uploadSupplementAssets({ signal });
  const uploadSupplementAssetsForGeneration = (generationToken, signal) => uploadSupplementAssets({ generationToken, signal });

  /* ── 确认方向 → 生成 ── */
  const handleConfirm = async () => {
    if (generating) return;
    const loginPreflight = ecommerceLoginPreflight({ logged: state.logged });
    if (!loginPreflight.allowed) {
      dispatch(loginPreflight.action);
      setError('');
      return;
    }
    const generation = startEcommerceGenerationLifecycle({
      lifecycle: generationLifecycle,
      quoteReady: Boolean(billingQuote && ecommercePlan.quoteRequest),
      onError: (preconditionError) => {
        setErrorStage('generation');
        setError(preconditionError.message);
        setGenerating(false);
      },
    });
    if (!generation) return;
    const { token: generationToken, signal: generationSignal } = generation;
    setGenerating(true);
    setError('');
    setErrorStage('generation');
    setBlockedByCredits(false);
    setGenProgress('正在生成…');
    setGenStage(0);
    setAssetProgress([]);
    setStableImages([]);
    setPreviewImageIndex(-1);
    let pendingAction = null;
    let submissionQuote = billingQuote;
    try {
      // The direction page can stay open longer than the signed quote TTL.
      // Refresh immediately before creating work so a stale page never submits a dead quote.
      const freshQuoteResponse = await quoteBillingAction(ecommercePlan.quoteRequest, { signal: generationSignal });
      submissionQuote = freshQuoteResponse?.quote;
      if (!submissionQuote?.quoteId) {
        throw Object.assign(new Error('费用确认失败，请重新获取费用后再生成'), {
          code: 'BILLING_QUOTE_REQUIRED',
          status: 409,
          reQuoteRequired: true,
        });
      }
      if (!isGenerationCurrent(generationToken)) return;
      setBillingQuote(submissionQuote);
      setQuoteError('');
      setQuoteNotice('费用已重新确认');
      const uploadedSupplement = await uploadSupplementAssetsForGeneration(generationToken, generationSignal);
      if (!isGenerationCurrent(generationToken) || !uploadedSupplement) return;
      const semanticRoleAssets = isTryOn ? {
        items: mergeDirectionImages(initialTryOnItems, uploadedSupplement.product),
        person: activePersonMode === 'reference' ? mergeDirectionImages(initialTryOnPerson, uploadedSupplement.person) : [],
        scene: mergeDirectionImages(initialTryOnScene, uploadedSupplement.reference),
      } : null;
      const semanticAssetRoles = isTryOn ? buildAbilityAssetRoles(semanticRoleAssets) : [];
      const abilityRecipe = isTryOn
        ? (params?.abilityRecipe || params?.ability_recipe || { id: abilityRecipeId, version: 1 })
        : undefined;
      const dir = directions[selected];
      const editableBrief = dir?.brief || dir?.execution_guide || dir?.description || dir?.short_desc || '';
      const directionBrief = [dir?.title, dir?.one_liner, editableBrief].filter(Boolean).join('。');
      pendingAction = buildEcommercePendingAction({
        platform: commerceContext.platform,
        commerceContext,
        direction: {
          id: dir?.id,
          brief: editableBrief || dir?.one_liner || '',
        },
        sizing: {
          ...(params?.sizing || {}),
          contentType: commerceContext.contentType,
          resolution: params?.genSettings?.resolution || params?.sizing?.resolution || '2K',
          imageModel: params?.genSettings?.imageModel || params?.sizing?.imageModel || 'image2',
        },
        skus: params?.skus || [],
        customColors: params?.customColors || [],
        originalProductAssets: isTryOn ? semanticRoleAssets.items : params?.realShots || [],
        supplementalProductAssets: isTryOn ? [] : uploadedSupplement.product,
        originalReferenceAssets: isTryOn ? semanticRoleAssets.scene : params?.refShots || [],
        supplementalReferenceAssets: isTryOn ? [] : uploadedSupplement.reference,
        ...(isTryOn ? {
          abilityRecipe,
          personMode: activePersonMode,
          roleAssets: semanticRoleAssets,
          assetRoles: semanticAssetRoles,
        } : {}),
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
        platform: commerceContext.platform,
        contentType: commerceContext.contentType,
        targetLanguage: commerceContext.targetLanguage,
        commerceContext,
        email: state.phone,
        refImgs: isTryOn ? [] : [...(params?.refShots || []), ...uploadedSupplement.reference],
        realShots: isTryOn ? semanticRoleAssets.items : [...(params?.realShots || []), ...uploadedSupplement.product],
        ...(isTryOn ? {
          abilityRecipe,
          roleAssets: semanticRoleAssets,
          assetRoles: semanticAssetRoles,
          personMode: activePersonMode,
        } : {}),
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
          editableBrief,
        },
        billingQuoteId: submissionQuote.quoteId,
        draftId: params?.draftId || '',
        retry: false,
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
            setStableImages(previous => mergeEcommerceStableImageList(previous, image));
          }
        },
      });
      if (!isGenerationCurrent(generationToken)) return;
      const finalDelivery = acceptEcommerceFinalResult(result);
      if (finalDelivery) {
        if (!isGenerationCurrent(generationToken)) return;
        const finalResult = withEcommerceCanvasSources({
          ...finalDelivery,
          product_name: params?.productName || '商品',
          _ecResult: true,
          _direction: dir,
          category: params?.category || '其他',
          platform: commerceContext.platform,
          contentType: commerceContext.contentType,
          targetLanguage: commerceContext.targetLanguage,
          commerceContext,
        }, {
          productAssets: isTryOn ? semanticRoleAssets.items : [...(params?.realShots || []), ...uploadedSupplement.product],
          referenceAssets: isTryOn ? semanticRoleAssets.scene : [...(params?.refShots || []), ...uploadedSupplement.reference],
          ...(isTryOn ? {
            itemAssets: semanticRoleAssets.items,
            personAssets: semanticRoleAssets.person,
            sceneAssets: semanticRoleAssets.scene,
            abilityRecipe,
            personMode: activePersonMode,
            assetRoles: semanticAssetRoles,
          } : {}),
        });

        // 生成完成后新资产自动挂到当前商品档案，形成越用越全的闭环；归档失败不阻断交付。
        const archiveProfileId = String(params?.activeProductProfileId || '').trim();
        if (archiveProfileId && Array.isArray(finalDelivery.imageRecords) && finalDelivery.imageRecords.length) {
          try {
            await attachProductProfileImages(archiveProfileId, finalDelivery.imageRecords);
          } catch {
            // 归档失败只影响档案沉淀，不改变本次生成结果
          }
        }

        const phone = state.phone || '';
        if (!isGenerationCurrent(generationToken)) return;
        fetchCredits(phone);

        // 存储结果到全局 state 并跳转到画布
        dispatch({ type: 'SET_RESULT', result: finalResult });
        dispatch({ type: 'NAVIGATE', page: 'ec-canvas' });
        dispatch({ type: 'CLEAR_PAYWALL' });
        onGenerated?.();
      } else {
        setErrorStage('generation');
        setError('任务尚未完成或没有稳定图片，请稍后继续生成');
      }
    } catch (e) {
      if (!isGenerationCurrent(generationToken)) return;
      const failedQuoteId = submissionQuote?.quoteId || billingQuote?.quoteId || '';
      const fallbackDirection = directions[selected] || {};
      const accessResult = handleGenerationAccessError(e, dispatch, {
        source: 'ecommerce-direction',
        ownerEmail: state.phone,
        route: globalThis.location?.pathname || '/',
        draftId: params?.draftId || '',
        quoteId: failedQuoteId,
        action: pendingAction || buildEcommercePendingAction({
          platform: commerceContext.platform,
          commerceContext,
          direction: {
            ...fallbackDirection,
            brief: getDirectionExecutionGuide(fallbackDirection),
          },
          sizing: {
            ...(params?.sizing || {}),
            contentType: commerceContext.contentType,
            resolution: params?.genSettings?.resolution || params?.sizing?.resolution || '2K',
            imageModel: params?.genSettings?.imageModel || params?.sizing?.imageModel || 'image2',
          },
          skus: params?.skus || [],
          customColors: params?.customColors || [],
          originalProductAssets: isTryOn ? initialTryOnItems : params?.realShots || [],
          supplementalProductAssets: extraProductImages,
          originalReferenceAssets: isTryOn ? initialTryOnScene : params?.refShots || [],
          supplementalReferenceAssets: extraReferenceImages,
          ...(isTryOn ? {
            abilityRecipe: params?.abilityRecipe || params?.ability_recipe || { id: abilityRecipeId, version: 1 },
            personMode: activePersonMode,
            roleAssets: {
              items: mergeDirectionImages(initialTryOnItems, extraProductImages),
              person: activePersonMode === 'reference' ? mergeDirectionImages(initialTryOnPerson, extraPersonImages) : [],
              scene: mergeDirectionImages(initialTryOnScene, extraReferenceImages),
            },
            assetRoles: buildAbilityAssetRoles({
              items: mergeDirectionImages(initialTryOnItems, extraProductImages),
              person: activePersonMode === 'reference' ? mergeDirectionImages(initialTryOnPerson, extraPersonImages) : [],
              scene: mergeDirectionImages(initialTryOnScene, extraReferenceImages),
            }),
          } : {}),
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
        setAssetProgress([]);
        setStableImages([]);
        setPreviewImageIndex(-1);
        setErrorStage('generation');
        setError(e.message || '部分图片暂未完成，已生成的结果已经保留。请在任务记录中补全未完成图片。');
      } else if (e?.code === 'ECOMMERCE_POLL_TIMEOUT' || e?.resumeable === true) {
        setErrorStage('generation');
        setError('任务还在后台生成，已为你保留进度。稍后继续生成会自动接着当前任务，不会从头开始。');
      } else {
        setErrorStage('generation');
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
    { label: '整理商品事实', desc: '核对主体、材质、结构与不确定信息' },
    { label: '提炼商业与视觉策略', desc: '结合用户要求、参考图和目标平台' },
    { label: '编排完整设计方案', desc: '统一整体规范，并为每张图片分配职责、比例与执行要求' },
  ];

  const inheritedProductImages = normalizeDirectionImages([...(params?.realShots || []), ...(params?.productImages || [])]);
  const inheritedReferenceImages = normalizeDirectionImages(params?.refShots || []);
  const supplementDeck = buildSupplementDeck({
    inheritedProductImages,
    addedProductImages: extraProductImages,
    inheritedReferenceImages,
    addedReferenceImages: extraReferenceImages,
  });
  const abilitySupplementRoleImages = isTryOn ? {
    items: [
      ...initialTryOnItems.map(image => ({ ...image, locked: true })),
      ...normalizeDirectionImages(extraProductImages),
    ],
    person: [
      ...initialTryOnPerson.map(image => ({ ...image, locked: true })),
      ...normalizeDirectionImages(extraPersonImages),
    ],
    scene: [
      ...initialTryOnScene.map(image => ({ ...image, locked: true })),
      ...normalizeDirectionImages(extraReferenceImages),
    ],
  } : {};
  const inheritedProductCount = inheritedProductImages.length;
  const inheritedReferenceCount = inheritedReferenceImages.length;
  const inheritedTryOnCounts = {
    items: initialTryOnItems.length,
    person: initialTryOnPerson.length,
    scene: initialTryOnScene.length,
  };

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
            确认设计方案
          </h2>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 4 }}>
            AI 已结合商品事实、参考图与平台要求制定完整视觉方案
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

        {/* ── 统一设计方案 ── */}
        {!loading && directions.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 850, color: '#1f2937' }}>方案总览</div>
                <div style={{ marginTop: 4, fontSize: 13, color: '#756d64' }}>先查看方案依据，再调整核心叙事和逐图执行。</div>
              </div>
              <button
                type="button"
                className="ec-direction-action ec-direction-action--refresh"
                onClick={handleRefreshDirections}
                disabled={loading}
              >
                <MdRefresh size={14} />换一套创意路线 · 1 AI 积分
              </button>
            </div>
            <div className="ec-direction-plan-stack">
              <EcommerceDesignPlanEditor
                direction={directions[selected] || directions[0]}
                prompt={extraDesc || params?.description}
                onChange={plan => {
                const activeIndex = Math.min(selected, directions.length - 1);
                setDirections(previous => previous.map((item, itemIndex) => itemIndex === activeIndex
                  ? {
                    ...item,
                    ...applyCanvasSuitePlanToDirection(plan, item),
                    ...plan,
                    brief: plan.brief,
                    one_liner: plan.brief,
                    execution_guide: plan.brief,
                  }
                  : item));
                setBlockedByCredits(false);
                }}
              />

              {/* ── 补充素材与调整：复用第一步工作台 ── */}
              <div className="ec-direction-supplement">
              <EcommerceWorkbench
                productImages={supplementDeck.productImages}
                refImages={supplementDeck.referenceImages}
                roleImages={abilitySupplementRoleImages}
                unmappedImages={params?.unmappedImages || []}
                abilityRecipeId={abilityRecipeId}
                showAbilitySelector={false}
                personMode={activePersonMode}
                onPersonModeChange={mode => setActivePersonMode(mode === 'reference' ? 'reference' : 'smart')}
                onRoleUpload={isTryOn ? (role, event) => appendSupplementImages(
                  event,
                  role === 'items' ? 'product' : role === 'person' ? 'person' : 'reference',
                ) : undefined}
                onRoleRemove={isTryOn ? (role, index) => {
                  const inheritedCount = inheritedTryOnCounts[role] || 0;
                  if (index < inheritedCount) return;
                  removeSupplementImage(
                    role === 'items' ? 'product' : role === 'person' ? 'person' : 'reference',
                    index - inheritedCount,
                  );
                } : undefined}
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
                <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                  <button
                    type="button"
                    className="ec-direction-action ec-direction-action--polish"
                    onClick={handlePolish}
                    disabled={!extraDesc.trim() || polishing}
                  >
                    <MdAutoAwesome size={13} />{polishing ? '润色中…' : 'AI 润色补充说明 · 0.2 AI 积分'}
                  </button>
                </div>
              </div>

              {blockedByCredits && <div style={{ marginTop: 12, borderRadius: 12, padding: '10px 12px', background: '#FFF8E7', border: '1px solid #F4D88A', color: '#73510D', fontSize: 12 }}>当前方案和补充内容已经保留。完成充值后，直接点击下方“继续生成”即可。</div>}
              </div>
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
            {error && errorStage === 'generation' && (
              <div role="alert" style={{ maxWidth: 720, margin: '14px auto 0', padding: '12px 16px', borderRadius: 12, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', fontSize: 13, lineHeight: 1.55 }}>
                <strong style={{ display: 'block', marginBottom: 3 }}>这次生成没有交付成品</strong>
                <span>{error}</span>
              </div>
            )}
            <div style={{ textAlign: 'center', marginTop: 9, fontSize: 12, fontWeight: 700, color: quoteError ? '#b91c1c' : '#6b625a' }}>
              {quoteError || quoteNotice || quoteText}
            </div>

            {/* ── 生成进度面板（可折叠）── */}
            {(generating || assetProgress.length > 0 || stableImages.length > 0) && (
              <div className="ec-generation-progress" style={{
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
                    <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>可继续浏览其他页面；每张完成图片都会自动保存到“我的作品”</div>
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
                      <div key={asset.id || `${asset.role}-${asset.label}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8, alignItems: 'center', padding: '7px 9px', borderRadius: 8, background: '#FAF8FC', fontSize: 12 }}>
                        <span style={{ color: '#4B4453' }}>{asset.role || '图片'} · {asset.label || '待处理图片'}</span>
                        <span style={{ color: asset.error ? '#B91C1C' : '#7C3AED', fontWeight: 700 }}>{asset.userState || '正在生成'}</span>
                        {asset.error && <span role="alert" style={{ gridColumn: '1 / -1', color: '#B91C1C', lineHeight: 1.45 }}>{asset.error}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {stableImages.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                    {stableImages.map((image, index) => (
                      <button key={image.id} type="button" onClick={() => setPreviewImageIndex(index)} aria-label={`放大查看${image.label || image.role || '生成图'}`} style={{ width: 74, height: 74, padding: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid #E9DDF8', background: '#fff', cursor: 'zoom-in' }}>
                        <ResponsiveImage src={image.stableUrl} variant="thumb" ratio="1:1" alt={image.label || image.role || '稳定生成图'} style={{ width: '100%', height: '100%' }} imgStyle={{ objectFit: 'cover' }} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
        {previewImageIndex >= 0 && stableImages[previewImageIndex] && (
          <div role="dialog" aria-modal="true" aria-label="生成图片预览" onClick={() => setPreviewImageIndex(-1)} style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'grid', placeItems: 'center', background: 'rgba(18,16,20,.86)', padding: 24 }}>
            <button type="button" title="关闭预览" aria-label="关闭预览" onClick={() => setPreviewImageIndex(-1)} style={{ position: 'absolute', top: 18, right: 18, width: 40, height: 40, border: 0, borderRadius: '50%', background: 'rgba(255,255,255,.14)', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><MdClose size={24} /></button>
            {stableImages.length > 1 && <button type="button" title="上一张" aria-label="上一张" onClick={(event) => { event.stopPropagation(); setPreviewImageIndex(index => (index - 1 + stableImages.length) % stableImages.length); }} style={{ position: 'absolute', left: 18, width: 44, height: 52, border: 0, borderRadius: 8, background: 'rgba(255,255,255,.14)', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><MdChevronLeft size={30} /></button>}
            <img onClick={event => event.stopPropagation()} src={stableImages[previewImageIndex].stableUrl} alt={stableImages[previewImageIndex].label || stableImages[previewImageIndex].role || '生成图片预览'} width="1200" height="800" loading="eager" decoding="async" fetchpriority="high" draggable="false" style={{ maxWidth: 'min(92vw, 1200px)', maxHeight: '86vh', objectFit: 'contain' }} />
            {stableImages.length > 1 && <button type="button" title="下一张" aria-label="下一张" onClick={(event) => { event.stopPropagation(); setPreviewImageIndex(index => (index + 1) % stableImages.length); }} style={{ position: 'absolute', right: 18, width: 44, height: 52, border: 0, borderRadius: 8, background: 'rgba(255,255,255,.14)', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><MdChevronRight size={30} /></button>}
          </div>
        )}

        {/* ── 无方向数据 ── */}
        {!loading && directions.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '60px 20px',
            color: 'var(--text-muted)', fontSize: 14,
          }}>
            {error && errorStage === 'analysis' && <div role="alert" style={{ maxWidth: 520, margin: '0 auto 18px', padding: '12px 16px', borderRadius: 12, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', lineHeight: 1.55 }}>{error}</div>}
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
