import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles,
  ChevronDown,
  Plus,
  ImagePlus,
  // 高级 AI 感图标
  Images, // 套图配置
  Wand2, // 画面风格
  SlidersHorizontal, // 产品参数
  Package, // SKU 变体
  FileText, // 文案策划
  Settings2 // 生图设置
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import SizingPanel from './ec/SizingPanel';
import StylePanel from './ec/StylePanel';
import ParamsPanel from './ec/ParamsPanel';
import SkuPanel from './ec/SkuPanel';
import CopyPanel from './ec/CopyPanel';
import GenSettingsPanel from './ec/GenSettingsPanel';
import TryOnPlanPanel from './ec/TryOnPlanPanel';
import EcommerceWorkbench from './ec/EcommerceWorkbench';
import EcProfileRail from './ec/EcProfileRail.jsx';
import ProductChip from './ec/ProductChip.jsx';
import { deriveEffectiveSmartOverrides, summarizeCommerceConfiguration } from './ec/workbenchState.js';
import { uploadEcommerceAssets } from '../../services/api.js';
import { archiveProductProfile, createProductProfile, getProjectAsset, listProductProfiles } from '../../services/projects.js';
import { createEcommerceDraftId, resolveSizingImages } from './ec/ecommercePlanModel.js';
import { normalizeCommerceContext } from './ec/internationalCommerceRegistry.js';
import { createEcommerceGenerationPreconditionError, createEcommerceGenerationToken, ecommerceLoginPreflight, invalidateEcommerceGenerationRequest, isEcommerceGenerationTokenCurrent } from './ec/ecommerceTaskProgressModel.js';
import { restoreCheckpointIntoEditor } from './ec/projectLifecycleModel.js';
import { applyProductProfileToEcState, buildProductProfileSaveRequest } from './ec/productProfileShelfModel.js';
import { buildProductProfileMediaState } from './ec/productProfileModel.js';
import { getEcommerceAbilityRecipe } from '../../../shared/ecommerceAbilityRecipes.mjs';
import { createAbilityEditorState, switchAbilityRecipe } from './ec/workbenchState.js';

// 3–5 张清晰、多角度的产品实拍通常能提供足够的商品事实，继续堆叠近似角度反而会稀释参考。
const PRODUCT_SHOT_PLAN = [
  { title: '正面主视图', short: '正面图', hint: '完整展示商品正面与轮廓' },
  { title: '侧面 45°', short: '侧面图', hint: '补足厚度、结构与比例' },
  { title: '核心细节', short: '细节图', hint: '材质、接口、纹理或工艺特写' },
  { title: '背面 / 俯视', short: '背面图', hint: '补足背部、顶部或底部信息' },
  {
    title: '使用尺度',
    short: '场景图',
    hint: '有人手持或真实场景，便于判断大小'
  }
];

let observedEcommerceWorkVersion = 0;

/* ═══════ 统一按钮样式（升级：胶囊形状+渐变）═══════ */
const BTN_BASE = {
  height: 40,
  padding: '0 18px',
  borderRadius: 20,
  fontSize: 13,
  fontWeight: 600,
  fontFamily: 'inherit',
  border: '1px solid rgba(28, 25, 23, 0.10)',
  background: '#fff',
  color: 'var(--text-secondary)',
  transition: 'all 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  whiteSpace: 'nowrap',
  userSelect: 'none',
  flexShrink: 0,
  boxShadow: '0 2px 7px rgba(62,43,26,0.07)'
};

/* ═══════ 玻璃拟态面板样式（AI 感升级）═══════ */
const GLASS_PANEL = {
  borderRadius: 20,
  background: '#fff',
  border: '1px solid rgba(28, 25, 23, 0.09)',
  boxShadow: '0 18px 48px rgba(62,43,26,0.16), 0 4px 14px rgba(62,43,26,0.08)',
  animation: 'ecGlassSlideUp 0.3s cubic-bezier(0.22, 1, 0.36, 1)'
};

/* ═══════ EcMode — 三段式第一步：参数配置 ═══════ */
export default function EcMode({ ecStep, setEcStep, onStepChange, recoveryCheckpoint = null, initialRecipeId = null }) {
  const { state, dispatch } = useApp();
  const ownerEmail = String(state.email || state.phone || '')
    .trim()
    .toLowerCase();
  const profileAccess = Boolean(state.logged && ownerEmail);
  const workVersion = Number(state._workVersion || 0);
  const [draftId, setDraftId] = useState(createEcommerceDraftId);
  const generationTokenRef = useRef(null);
  const generationAbortRef = useRef(null);
  const profileSaveNonceRef = useRef(0);
  const profileLoadNonceRef = useRef(0);
  const profileApplyNonceRef = useRef(0);
  const profileDetailNonceRef = useRef(0);
  const [productProfiles, setProductProfiles] = useState([]);
  // 商品档案体系：悬浮抽屉承载列表+详情+素材聚合（默认收起，编辑区宽度零影响）。
  const [productProfilesOpen, setProductProfilesOpen] = useState(false);
  const [profileRailTab, setProfileRailTab] = useState('list');
  const [activeProfileId, setActiveProfileId] = useState('');
  const [detailProfileId, setDetailProfileId] = useState('');
  const [detailMedia, setDetailMedia] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [productProfilesLoading, setProductProfilesLoading] = useState(false);
  const [productProfileSaving, setProductProfileSaving] = useState(false);
  const [productProfileApplying, setProductProfileApplying] = useState('');
  const [productProfileError, setProductProfileError] = useState('');
  const profileAccessRef = useRef({ allowed: profileAccess, ownerEmail });
  profileAccessRef.current = { allowed: profileAccess, ownerEmail };
  const generationIdentityRef = useRef({ ownerEmail, draftId });
  generationIdentityRef.current = { ownerEmail, draftId };
  const beginGeneration = () => {
    const token = createEcommerceGenerationToken({ ownerEmail, draftId });
    generationTokenRef.current = token;
    return token;
  };
  const isGenerationCurrent = (token) =>
    isEcommerceGenerationTokenCurrent(token, {
      currentToken: generationTokenRef.current,
      ownerEmail: generationIdentityRef.current.ownerEmail,
      draftId: generationIdentityRef.current.draftId
    });

  const refreshProductProfiles = useCallback(async () => {
    const loadNonce = profileLoadNonceRef.current + 1;
    profileLoadNonceRef.current = loadNonce;
    const accessAtStart = { ...profileAccessRef.current };
    if (!profileAccess) {
      setProductProfiles([]);
      return;
    }
    setProductProfilesLoading(true);
    setProductProfileError('');
    try {
      const profiles = await listProductProfiles({ status: 'active', limit: 100 });
      const access = profileAccessRef.current;
      if (profileLoadNonceRef.current !== loadNonce
        || !access.allowed
        || access.ownerEmail !== accessAtStart.ownerEmail) return;
      setProductProfiles(profiles);
    } catch (error) {
      setProductProfileError(error?.message || '暂时无法读取商品档案');
    } finally {
      setProductProfilesLoading(false);
    }
  }, [ownerEmail, profileAccess]);

  useEffect(() => {
    refreshProductProfiles();
  }, [refreshProductProfiles]);

  const currentProductProfileEditor = () => ({
    description,
    productParams,
    skus,
    copywriting,
    productImages,
    referenceImages: refImages,
    roleImages,
    platform,
    sizing,
    genSettings,
  });

  const saveCurrentProductProfile = async () => {
    if (!profileAccess) {
      setProductProfileError('请先登录后保存商品档案');
      return;
    }
    setProductProfileSaving(true);
    setProductProfileError('');
    try {
      profileSaveNonceRef.current += 1;
      const profile = await createProductProfile(buildProductProfileSaveRequest({
        draftId,
        editor: currentProductProfileEditor(),
        saveNonce: profileSaveNonceRef.current,
      }));
      setProductProfiles(previous => [profile, ...previous.filter(item => item.profileId !== profile.profileId)]);
      setActiveProfileId(profile.profileId);
      setProfileRailTab('list');
      setProductProfilesOpen(true);
    } catch (error) {
      setProductProfileError(error?.message || '商品档案保存失败，请稍后重试');
    } finally {
      setProductProfileSaving(false);
    }
  };

  const applySavedProductProfile = async profile => {
    const applyNonce = profileApplyNonceRef.current + 1;
    profileApplyNonceRef.current = applyNonce;
    const accessAtStart = { ...profileAccessRef.current };
    setProductProfileApplying(profile?.profileId || 'profile');
    setProductProfileError('');
    const next = applyProductProfileToEcState(profile, currentProductProfileEditor());
    setDescription(next.description);
    setProductParams(next.productParams);
    setSkus(next.skus);
    setCopywriting(next.copywriting);
    try {
      const profileAssets = Array.isArray(profile?.assets) ? profile.assets : [];
      const resolvedAssets = (await Promise.all(profileAssets.map(async profileAsset => {
        if (!profileAsset?.projectId || !profileAsset?.projectAssetId || !profileAsset?.expectedContentHash) return null;
        try {
          const asset = await getProjectAsset(profileAsset.projectId, profileAsset.projectAssetId, 'reuse');
          return { profileAsset, asset };
        } catch {
          return null;
        }
      }))).filter(Boolean);
      const access = profileAccessRef.current;
      if (profileApplyNonceRef.current !== applyNonce
        || !access.allowed
        || access.ownerEmail !== accessAtStart.ownerEmail) return;
      const media = buildProductProfileMediaState(profile, resolvedAssets);
      if (abilityRecipeId === 'anything_tryon') {
        setProductImages(current => current.length ? current : media.productImages);
        setRoleImages(current => ({
          ...current,
          items: current.items?.length ? current.items : media.roleImages.items,
          person: current.person?.length ? current.person : media.roleImages.person,
          scene: current.scene?.length ? current.scene : media.roleImages.scene,
        }));
      } else {
        setProductImages(current => current.length ? current : media.productImages);
        setRefImages(current => current.length ? current : media.referenceImages);
      }
      const requestedCount = profileAssets.length;
      const hydratedCount = media.productImages.length + media.referenceImages.length
        + media.roleImages.person.length + media.roleImages.scene.length;
      if (requestedCount > hydratedCount) {
        setProductProfileError('商品信息已应用，部分素材已过期或暂不可复用');
      }
    } catch (error) {
      if (profileApplyNonceRef.current === applyNonce) {
        setProductProfileError(error?.message || '商品信息已应用，但素材暂时无法带入');
      }
    } finally {
      if (profileApplyNonceRef.current === applyNonce) setProductProfileApplying('');
    }
  };

  // 「当前商品」全局生效：选中档案即带入商品事实，并自动把主图填入商品槽位。
  const selectActiveProductProfile = async profile => {
    if (!profile?.profileId) return;
    setActiveProfileId(profile.profileId);
    await applySavedProductProfile(profile);
  };

  // 档案详情：把该商品名下全部弱关联素材逐一解析成可预览 URL 后聚合展示。
  const openProfileDetail = async profile => {
    const profileId = String(profile?.profileId || '').trim();
    if (!profileId || !profileAccessRef.current.allowed) return;
    const nonce = ++profileDetailNonceRef.current;
    setProfileRailTab('detail');
    setDetailProfileId(profileId);
    setDetailMedia([]);
    setDetailLoading(true);
    try {
      const refs = Array.isArray(profile?.assets) ? profile.assets : [];
      const resolved = (await Promise.all(refs.map(async ref => {
        if (!ref?.projectId || !ref?.projectAssetId || !ref?.expectedContentHash) return null;
        try {
          const asset = await getProjectAsset(ref.projectId, ref.projectAssetId, 'reuse');
          const url = asset.stableUrl || asset.url;
          if (!url || (asset.mediaKind && asset.mediaKind !== 'image')) return null;
          const role = ['product', 'generated', 'reference', 'person', 'scene'].includes(ref.role) ? ref.role : 'product';
          return { role, url, label: asset.metadata?.displayName || '' };
        } catch {
          return null;
        }
      }))).filter(Boolean);
      if (profileDetailNonceRef.current !== nonce) return;
      setDetailMedia(resolved);
    } catch {
      if (profileDetailNonceRef.current === nonce) setDetailMedia([]);
    } finally {
      if (profileDetailNonceRef.current === nonce) setDetailLoading(false);
    }
  };

  const archiveSavedProductProfile = async profile => {
    if (!profile?.profileId || !profileAccessRef.current.allowed) return;
    setProductProfileError('');
    try {
      await archiveProductProfile(profile.profileId);
      setProductProfiles(previous => previous.filter(item => item.profileId !== profile.profileId));
    } catch (error) {
      setProductProfileError(error?.message || '商品档案归档失败，请稍后重试');
    }
  };

  useEffect(() => {
    invalidateEcommerceGenerationRequest({
      tokenRef: generationTokenRef,
      abortRef: generationAbortRef
    });
    setDraftId(createEcommerceDraftId());
    setUploadingAssets(false);
    setAssetUploadError('');
  }, [ownerEmail]);

  useEffect(() => {
    if (!workVersion || workVersion <= observedEcommerceWorkVersion) return;
    observedEcommerceWorkVersion = workVersion;
    invalidateEcommerceGenerationRequest({
      tokenRef: generationTokenRef,
      abortRef: generationAbortRef
    });
    setDraftId(createEcommerceDraftId());
    setUploadingAssets(false);
    setAssetUploadError('');
  }, [draftId, ownerEmail, workVersion]);

  useEffect(
    () => () => {
      invalidateEcommerceGenerationRequest({
        tokenRef: generationTokenRef,
        abortRef: generationAbortRef
      });
    },
    []
  );

  /* — 图片 — */
  const [productImages, setProductImages] = useState([]);
  const [refImages, setRefImages] = useState([]);
  const [abilityRecipeId, setAbilityRecipeId] = useState('product_suite');
  const [personMode, setPersonMode] = useState('smart');
  const [roleImages, setRoleImages] = useState(() => createAbilityEditorState().roleImages);
  const [unmappedImages, setUnmappedImages] = useState([]);
  const [uploadingAssets, setUploadingAssets] = useState(false);
  const [assetUploadError, setAssetUploadError] = useState('');
  const objectUrlsRef = useRef(new Set());
  const prodFileRef = useRef(null);
  const refFileRef = useRef(null);
  const cardRef = useRef(null);
  const btnRowRef = useRef(null);
  const btnRefs = useRef({});

  /* — 文字 — */
  const [description, setDescription] = useState('');

  /* — 配置 — */
  const [platform, setPlatform] = useState('taobao');
  const [sizing, setSizing] = useState({ smart: true, images: [] });
  const productSuiteSizingRef = useRef({ smart: true, images: [] });
  const contentType = 'main';
  const [targetLanguage, setTargetLanguage] = useState('zh-CN');
  const [styleSkill, setStyleSkill] = useState('smart');
  const [customColors, setCustomColors] = useState(null);
  const [productParams, setProductParams] = useState({
    category: '',
    size: '',
    baseColor: '',
    accentColor: '',
    material: '',
    craft: ''
  });
  const [skus, setSkus] = useState([]);
  const [copywriting, setCopywriting] = useState({
    plan: '',
    sellingPoints: '',
    qc: '',
    details: '',
    maintenance: ''
  });

  /* — 生图设置（分辨率/品质/创意度/反向提示词/种子） — */
  const [genSettings, setGenSettings] = useState({
    resolution: '2K',
    imageModel: 'image2',
    negativePrompt: ''
  });

  useEffect(() => {
    if (!recoveryCheckpoint || recoveryCheckpoint.project?.kind !== 'ecommerce') return;
    const restored = restoreCheckpointIntoEditor(recoveryCheckpoint);
    const restoredCommerceContext = normalizeCommerceContext({
      ...(restored.commerceContext || {}),
      platform: restored.commerceContext?.platform || restored.platform
    });
    setDescription(restored.description);
    setPlatform(restoredCommerceContext.platform);
    setSizing(restored.sizing);
    setTargetLanguage(restoredCommerceContext.targetLanguage);
    setStyleSkill(restored.styleSkill);
    setCustomColors(restored.customColors);
    setProductParams(restored.productParams);
    setSkus(restored.skus);
    setCopywriting(restored.copywriting);
    setGenSettings(restored.genSettings);
    setProductImages(restored.productImages);
    setRefImages(restored.referenceImages);
    const restoredRecipeId = restored.abilityRecipe?.id || restored.recipeId || 'product_suite';
    let restoredRecipe;
    try {
      restoredRecipe = getEcommerceAbilityRecipe(restoredRecipeId);
    } catch {
      restoredRecipe = getEcommerceAbilityRecipe('product_suite');
    }
    setAbilityRecipeId(restoredRecipe.id);
    setPersonMode(restored.personMode === 'reference' ? 'reference' : 'smart');
    setRoleImages({
      items: Array.isArray(restored.roleImages?.items) ? restored.roleImages.items : [],
      person: Array.isArray(restored.roleImages?.person) ? restored.roleImages.person : [],
      scene: Array.isArray(restored.roleImages?.scene) ? restored.roleImages.scene : [],
    });
    setUnmappedImages(Array.isArray(restored.unmappedImages) ? restored.unmappedImages : []);
  }, [recoveryCheckpoint]);

  /* — 面板（Portal 定位用视口坐标）—— */
  const [activePanel, setActivePanel] = useState(null);
  const [panelPos, setPanelPos] = useState({
    left: 0,
    bottom: 0,
    width: 0,
    maxH: 400,
    btnCenterX: 0
  });

  /* Esc 关闭 + 点击外部关闭 */
  useEffect(() => {
    if (!activePanel) {
      return;
    }
    const handleKey = (e) => {
      if (e.key === 'Escape') setActivePanel(null);
    };
    const handleClick = (e) => {
      const panel = document.getElementById('ec-floating-panel');
      const btnRow = btnRowRef.current;
      if (panel && panel.contains(e.target)) return;
      if (btnRow && btnRow.contains(e.target)) return;
      if (e.target?.closest?.('[data-anchored-portal="true"]')) return;
      setActivePanel(null);
    };
    window.addEventListener('keydown', handleKey);
    setTimeout(() => window.addEventListener('mousedown', handleClick), 0);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('mousedown', handleClick);
    };
  }, [activePanel]);

  const adjustedPanels = deriveEffectiveSmartOverrides({
    platform,
    sizing,
    styleSkill,
    customColors,
    productParams,
    skus,
    copywriting,
    genSettings,
    commerceContext: { platform, contentType, targetLanguage }
  });
  const activeProductProfile = productProfiles.find(profile => profile.profileId === activeProfileId) || null;
  const activeAbilityRecipe = getEcommerceAbilityRecipe(abilityRecipeId);
  const activeItemImages = abilityRecipeId === 'anything_tryon' ? roleImages.items : productImages;
  const canGen = abilityRecipeId === 'anything_tryon'
    ? activeItemImages.length > 0
    : productImages.length > 0 || description.trim().length > 0;

  /* ── 下一步 ── */
  const handleNext = async () => {
    if (!canGen || uploadingAssets) return;
    const loginPreflight = ecommerceLoginPreflight({ logged: state.logged });
    if (!loginPreflight.allowed) {
      dispatch(loginPreflight.action);
      setAssetUploadError('');
      return;
    }
    const generationToken = beginGeneration();
    if (!generationToken) {
      const contextError = createEcommerceGenerationPreconditionError();
      setAssetUploadError(contextError.message);
      setUploadingAssets(false);
      return;
    }
    const generationController = new AbortController();
    generationAbortRef.current = generationController;
    setUploadingAssets(true);
    setAssetUploadError('');
    const commerceContext = normalizeCommerceContext({
      platform,
      contentType,
      targetLanguage
    });
    const effectiveSizing = {
      smart: sizing.smart !== false,
      resolution: genSettings.resolution,
      imageModel: genSettings.imageModel || 'image2',
      contentType: commerceContext.contentType,
      images: resolveSizingImages(commerceContext.platform, {
        ...sizing,
        resolution: genSettings.resolution
      })
    };
    const effectiveStyle = styleSkill;
    const effectiveParams = productParams;
    const effectiveCopy = copywriting;

    try {
      const tryOn = abilityRecipeId === 'anything_tryon';
      const [realShots, refShots, personShots, sceneShots] = tryOn
        ? await Promise.all([
          uploadEcommerceAssets(roleImages.items, 'product', { signal: generationController.signal }),
          Promise.resolve([]),
          uploadEcommerceAssets(roleImages.person, 'person', { signal: generationController.signal }),
          uploadEcommerceAssets(roleImages.scene, 'scene', { signal: generationController.signal }),
        ])
        : await Promise.all([
          uploadEcommerceAssets(productImages, 'product', { signal: generationController.signal }),
          uploadEcommerceAssets(refImages, 'reference', { signal: generationController.signal }),
          Promise.resolve([]),
          Promise.resolve([]),
        ]);
      if (!isGenerationCurrent(generationToken)) return;
      const roleAssetGroups = tryOn
        ? { items: realShots, person: personShots, scene: sceneShots }
        : { product: realShots, reference: refShots };
      const assetRoles = Object.entries(roleAssetGroups).flatMap(([role, assets]) => assets.map((asset, ordinal) => ({
        assetId: asset.assetId,
        role,
        ordinal,
      })));
      onStepChange?.({
        draftId,
        activeProductProfileId: activeProfileId,
        productName: description.trim() || '商品',
        description: description.trim(),
        category: effectiveParams.category || '其他',
        realShots,
        refShots,
        productImages: realShots,
        personShots,
        sceneShots,
        abilityRecipe: {
          id: activeAbilityRecipe.id,
          version: activeAbilityRecipe.version,
          ...(tryOn ? {
            constraints: {
              preserveMaterial: effectiveParams.preserveMaterial !== false,
              preservePattern: effectiveParams.preservePattern !== false,
              consistentPersonScene: effectiveParams.consistentPersonScene !== false,
            },
          } : {}),
        },
        assetRoles,
        roleImages: roleAssetGroups,
        personMode: tryOn ? personMode : 'smart',
        unmappedImages,
        platform: commerceContext.platform,
        contentType: commerceContext.contentType,
        targetLanguage: commerceContext.targetLanguage,
        commerceContext,
        sizing: effectiveSizing,
        styleSkill: effectiveStyle,
        customColors,
        productParams: effectiveParams,
        skus,
        copywriting: effectiveCopy,
        genSettings
      });
      setEcStep?.(2);
    } catch (error) {
      if (!isGenerationCurrent(generationToken)) return;
      setAssetUploadError(error?.message || '原图上传失败，请重试');
    } finally {
      if (isGenerationCurrent(generationToken)) {
        setUploadingAssets(false);
        generationTokenRef.current = null;
        generationAbortRef.current = null;
      }
    }
  };

  /* ── 图片上传：统一按能力配方的语义槽处理 ── */
  const appendRoleFiles = (role, event) => {
    const files = Array.from(event?.target?.files || []);
    const recipe = getEcommerceAbilityRecipe(abilityRecipeId);
    const slot = recipe.inputSlots.find(item => item.id === role);
    if (!slot) return;
    const current = role === 'product'
      ? productImages
      : role === 'reference' ? refImages : (roleImages[role] || []);
    const available = Math.max(0, slot.max - current.length);
    if (!available) {
      setAssetUploadError(`${slot.label}最多上传 ${slot.max} 张`);
      event.target.value = '';
      return;
    }
    const additions = files.slice(0, available).map(file => {
      const url = URL.createObjectURL(file);
      objectUrlsRef.current.add(url);
      return { url, file };
    });
    const next = [...current, ...additions];
    if (role === 'product' || role === 'items') setProductImages(next);
    if (role === 'reference') setRefImages(next);
    setRoleImages(previous => ({ ...previous, [role]: next }));
    setAssetUploadError('');
    event.target.value = '';
  };

  const handleRoleUpload = (role, event) => {
    if (role === 'person' && event?.target?.files?.length) setPersonMode('reference');
    appendRoleFiles(role, event);
  };
  const handleProdUpload = event => appendRoleFiles(abilityRecipeId === 'anything_tryon' ? 'items' : 'product', event);
  const handleRefUpload = event => appendRoleFiles(abilityRecipeId === 'anything_tryon' ? 'scene' : 'reference', event);

  const handlePersonModeChange = mode => {
    const nextMode = mode === 'reference' ? 'reference' : 'smart';
    if (nextMode === 'smart') {
      (roleImages.person || []).forEach(image => {
        if (image?.url?.startsWith('blob:')) {
          URL.revokeObjectURL(image.url);
          objectUrlsRef.current.delete(image.url);
        }
      });
      setRoleImages(previous => ({ ...previous, person: [] }));
    }
    setPersonMode(nextMode);
  };

  const removeRoleImage = (role, index) => {
    const current = role === 'product'
      ? productImages
      : role === 'reference' ? refImages : (roleImages[role] || []);
    const removed = current[index];
    if (removed?.url?.startsWith('blob:')) {
      URL.revokeObjectURL(removed.url);
      objectUrlsRef.current.delete(removed.url);
    }
    const next = current.filter((_, itemIndex) => itemIndex !== index);
    if (role === 'product' || role === 'items') setProductImages(next);
    if (role === 'reference') setRefImages(next);
    if (role === 'person' && next.length === 0) setPersonMode('smart');
    setRoleImages(previous => ({ ...previous, [role]: next }));
  };

  const handleRecipeChange = nextRecipeId => {
    if (nextRecipeId === abilityRecipeId) return;
    const switched = switchAbilityRecipe({
      currentRecipeId: abilityRecipeId,
      nextRecipeId,
      currentRoleImages: {
        ...roleImages,
        product: productImages,
        reference: refImages,
        unmapped: unmappedImages,
      },
      productImages,
      refImages,
    });
    setAbilityRecipeId(nextRecipeId);
    setPersonMode(switched.personMode || 'smart');
    setUnmappedImages(switched.unmappedImages || []);
    if (nextRecipeId === 'anything_tryon') {
      productSuiteSizingRef.current = sizing;
      setSizing({
        smart: false,
        images: [{ key: 'main_3x4', label: '穿搭成片', count: 4, ratio: '3:4', targetRatio: '3:4', cropPolicy: 'none' }],
      });
      setRoleImages({
        items: switched.roleImages.items || [],
        person: switched.roleImages.person || [],
        scene: switched.roleImages.scene || [],
      });
      setProductImages(switched.roleImages.items || []);
      setRefImages([]);
    } else {
      setSizing(productSuiteSizingRef.current || { smart: true, images: [] });
      setProductImages(switched.productImages || []);
      setRefImages(switched.refImages || []);
      setRoleImages({ items: [], person: [], scene: [] });
    }
    setAssetUploadError('');
  };

  useEffect(() => {
    if (!initialRecipeId || initialRecipeId === abilityRecipeId) return;
    try {
      handleRecipeChange(getEcommerceAbilityRecipe(initialRecipeId).id);
    } catch {
      // Ignore stale navigation intents and keep the default recipe.
    }
  }, [initialRecipeId]);

  const removeProdImg = index => removeRoleImage(abilityRecipeId === 'anything_tryon' ? 'items' : 'product', index);
  const removeRefImg = index => removeRoleImage(abilityRecipeId === 'anything_tryon' ? 'scene' : 'reference', index);

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
  useEffect(() => () => {
    objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    objectUrlsRef.current.clear();
  }, []);

  /* ── 6 个功能按钮（AI 感图标升级）── */
  const DEFAULT_BUTTONS = [
    {
      key: 'settings',
      label: '生成设置',
      icon: <Settings2 size={15} strokeWidth={1.8} />
    },
    {
      key: 'sizing',
      label: '套图方案',
      icon: <Images size={15} strokeWidth={1.8} />
    },
    {
      key: 'sku',
      label: 'SKU变体',
      icon: <Package size={15} strokeWidth={1.8} />
    },
    {
      key: 'style',
      label: '视觉方向',
      icon: <Wand2 size={15} strokeWidth={1.8} />
    },
    {
      key: 'params',
      label: '商品信息',
      icon: <SlidersHorizontal size={15} strokeWidth={1.8} />
    },
    {
      key: 'copy',
      label: '内容规范',
      icon: <FileText size={15} strokeWidth={1.8} />
    }
  ];
  const BUTTONS = abilityRecipeId === 'anything_tryon'
    ? [
      DEFAULT_BUTTONS[0],
      { ...DEFAULT_BUTTONS[1], label: '成片规格' },
      DEFAULT_BUTTONS[3],
      { ...DEFAULT_BUTTONS[4], label: '商品细节' },
    ]
    : DEFAULT_BUTTONS;

  /* ── 面板定位：Portal 固定到当前按钮，并在滚动时持续跟随 ── */
  const repositionPanel = useCallback(() => {
    if (!activePanel) return;
    const el = btnRefs.current[activePanel];
    if (!el) return;
    const btnRect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const baseWidth =
      {
        sizing: 560,
        sku: 540,
        style: 520,
        params: 520,
        copy: 620,
        settings: 460
      }[activePanel] || 520;
    const panelW = Math.min(Math.max(baseWidth, 400), Math.max(320, vw - 32));
    const btnCenterX = btnRect.left + btnRect.width / 2;
    setPanelPos({
      left: Math.max(16, Math.min(btnCenterX - panelW / 2, vw - panelW - 16)),
      bottom: Math.max(16, window.innerHeight - btnRect.top + 10),
      width: panelW,
      maxH: Math.max(300, Math.min(620, btnRect.top - 24)),
      btnCenterX
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

  const openPanel = useCallback(
    (key) => {
      if (activePanel === key) {
        setActivePanel(null);
        return;
      }
      const el = btnRefs.current[key];
      const btnRow = btnRowRef.current;
      if (el && btnRow) {
        const btnRect = el.getBoundingClientRect();
        const rowRect = btnRow.getBoundingClientRect();
        const vw = window.innerWidth;

        // 面板宽度：根据内容类型调整
        const baseWidth =
          {
            sizing: 560,
            sku: 540,
            style: 520,
            params: 520,
            copy: 620,
            settings: 460
          }[key] || 520;
        const maxPW = Math.min(vw - 32, 680);
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
    },
    [activePanel]
  );

  /* ── 浮层渲染：Portal 到 body，彻底避免卡片与导航裁切 ── */
  const renderPanel = () => {
    if (!activePanel) return null;
    const panelMeta = BUTTONS.find((item) => item.key === activePanel);
    return createPortal(
      <div
        id="ec-floating-panel"
        className="ec-config-panel"
        data-panel={activePanel}
        style={{
          ...GLASS_PANEL,
          position: 'fixed',
          bottom: panelPos.bottom,
          left: panelPos.left,
          width: panelPos.width,
          maxHeight: panelPos.maxH,
          overflowY: 'auto',
          zIndex: 1100,
          transformOrigin: 'bottom center',
          '--ec-panel-anchor-x': `${Math.max(28, Math.min(panelPos.width - 28, panelPos.btnCenterX - panelPos.left))}px`
        }}
      >
        <div className="ec-config-panel-header">
          <span className="ec-config-panel-icon">{panelMeta?.icon}</span>
          <div>
            <strong>{panelMeta?.label}</strong>
            <span>{abilityRecipeId === 'anything_tryon' ? '调整本次上身成片的生成规则' : '调整本次电商套图的生成规则'}</span>
          </div>
        </div>
        <div className="ec-config-panel-body">
          {activePanel === 'sizing' && (abilityRecipeId === 'anything_tryon'
            ? <TryOnPlanPanel sizing={sizing} onSizingChange={setSizing} />
            : <SizingPanel platform={platform} onPlatformChange={setPlatform} sizing={sizing} onSizingChange={setSizing} resolution={genSettings.resolution} targetLanguage={targetLanguage} onTargetLanguageChange={setTargetLanguage} />)}
          {activePanel === 'style' && <StylePanel value={styleSkill} onChange={setStyleSkill} customColors={customColors} onColorsChange={setCustomColors} negativePrompt={genSettings.negativePrompt} onNegativePromptChange={(negativePrompt) => setGenSettings(current => ({ ...current, negativePrompt }))} />}
          {activePanel === 'params' && <ParamsPanel mode={abilityRecipeId === 'anything_tryon' ? 'tryon' : 'product'} params={productParams} onChange={setProductParams} />}
          {activePanel === 'sku' && <SkuPanel skus={skus} onChange={setSkus} sizing={sizing} onSizingChange={setSizing} />}
          {activePanel === 'copy' && <CopyPanel copywriting={copywriting} onChange={setCopywriting} />}
          {activePanel === 'settings' && <GenSettingsPanel value={genSettings} onChange={setGenSettings} />}
        </div>
      </div>,
      document.body
    );
  };

  // 步骤指示器组件
  const StepIndicator = () => {
    const steps = [
      { num: 1, label: '上传产品', desc: '上传实拍图+描述' },
      { num: 2, label: '确认方向', desc: 'AI分析生成方案' },
      { num: 3, label: '生成套图', desc: '无限画布编辑' }
    ];

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          marginBottom: 16,
          padding: '0 16px'
        }}
      >
        {steps.map((step, idx) => {
          const isActive = ecStep === step.num;
          const isCompleted = ecStep > step.num;
          const isLast = idx === steps.length - 1;

          return (
            <React.Fragment key={step.num}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 16px',
                  borderRadius: 12,
                  background: isActive ? 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)' : isCompleted ? 'rgba(124,58,237,0.1)' : 'rgba(0,0,0,0.03)',
                  border: isActive ? 'none' : isCompleted ? '1px solid rgba(124,58,237,0.2)' : '1px solid rgba(0,0,0,0.06)',
                  transition: 'all 0.3s ease'
                }}
              >
                {/* 步骤数字 */}
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 800,
                    background: isActive ? 'rgba(255,255,255,0.2)' : isCompleted ? '#7c3aed' : 'rgba(0,0,0,0.08)',
                    color: isActive || isCompleted ? '#fff' : '#999'
                  }}
                >
                  {isCompleted ? '✓' : step.num}
                </div>

                {/* 步骤文字 */}
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: isActive ? '#fff' : isCompleted ? '#1a1a1a' : '#999'
                    }}
                  >
                    {step.label}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: isActive ? 'rgba(255,255,255,0.8)' : isCompleted ? '#666' : '#bbb'
                    }}
                  >
                    {step.desc}
                  </div>
                </div>
              </div>

              {/* 连接线 */}
              {!isLast && (
                <div
                  style={{
                    width: 24,
                    height: 2,
                    background: isCompleted ? 'linear-gradient(90deg, #7c3aed, #a78bfa)' : 'rgba(0,0,0,0.06)',
                    borderRadius: 1
                  }}
                />
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
      <div
        ref={cardRef}
        className="ec-main-card"
        style={{
          borderRadius: 20,
          margin: '0 16px',
          background: '#fff',
          padding: '16px 20px 20px',
          position: 'relative'
        }}
      >
        <div className="ec-mode-columns">
        <EcProfileRail
          open={productProfilesOpen}
          tab={profileRailTab}
          profiles={productProfiles}
          loading={productProfilesLoading}
          saving={productProfileSaving}
          applying={productProfileApplying}
          error={productProfileError}
          activeProfileId={activeProfileId}
          detailProfileId={detailProfileId}
          detailMedia={detailMedia}
          detailLoading={detailLoading}
          onToggle={() => {
            setProductProfilesOpen(open => !open);
            if (!productProfilesOpen) refreshProductProfiles();
          }}
          onTabChange={setProfileRailTab}
          onRefresh={refreshProductProfiles}
          onSave={saveCurrentProductProfile}
          onSelect={selectActiveProductProfile}
          onOpenDetail={openProfileDetail}
          onArchive={archiveSavedProductProfile}
        />
        <div className="ec-mode-main">
        <EcommerceWorkbench
          productImages={productImages}
          refImages={refImages}
          roleImages={roleImages}
          unmappedImages={unmappedImages}
          abilityRecipeId={abilityRecipeId}
          personMode={personMode}
          onPersonModeChange={handlePersonModeChange}
          onAbilityRecipeChange={handleRecipeChange}
          onRoleUpload={handleRoleUpload}
          onRoleRemove={removeRoleImage}
          description={description}
          onDescriptionChange={setDescription}
          onProductUpload={handleProdUpload}
          onReferenceUpload={handleRefUpload}
          onRemoveProduct={removeProdImg}
          onRemoveReference={removeRefImg}
        />
        {/* ═══ 上下布局：上方双列上传区 + 下方文字输入 ═══ */}
        {false && (
          <div style={{ display: 'none' }}>
            {/* ── 上方：双列上传区（产品图 × 参考图，小红书同款样式）── */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
              {/* 产品图上传区 */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  transform: 'rotate(-1.25deg)'
                }}
              >
                <div
                  style={{
                    background: '#fff',
                    borderRadius: 16,
                    border: '2px solid var(--red)',
                    boxShadow: '0 6px 32px rgba(255,71,87,0.18)',
                    padding: '14px 12px',
                    minHeight: 110,
                    transition: 'all 0.25s cubic-bezier(0.22, 1, 0.36, 1)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--red)';
                    e.currentTarget.style.boxShadow = '0 6px 32px rgba(255,71,87,0.25)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--red)';
                    e.currentTarget.style.boxShadow = '0 6px 32px rgba(255,71,87,0.18)';
                  }}
                >
                  {/* 标题行 */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginBottom: 10
                    }}
                  >
                    <span style={{ fontSize: 12 }}>📸</span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#1a1a1a'
                      }}
                    >
                      产品图
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: '#fff',
                        background: 'var(--red)',
                        padding: '2px 8px',
                        borderRadius: 8,
                        marginLeft: 'auto',
                        fontWeight: 600
                      }}
                    >
                      必须
                    </span>
                  </div>

                  {/* 横向滚动的图片行 */}
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      overflowX: 'auto',
                      paddingBottom: 7,
                      scrollbarWidth: 'thin'
                    }}
                  >
                    {productImages.map((img, idx) => (
                      <div
                        key={idx}
                        style={{
                          position: 'relative',
                          width: 64,
                          height: 64,
                          borderRadius: 10,
                          overflow: 'hidden',
                          border: '2px solid #eee',
                          flex: '0 0 auto'
                        }}
                      >
                        <img
                          src={img.url}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            bottom: 0,
                            padding: '3px 4px',
                            background: 'linear-gradient(transparent, rgba(0,0,0,0.72))',
                            color: '#fff',
                            fontSize: 8,
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {PRODUCT_SHOT_PLAN[Math.min(idx, PRODUCT_SHOT_PLAN.length - 1)].short}
                        </div>
                        <div
                          onClick={() => removeProdImg(idx)}
                          style={{
                            position: 'absolute',
                            top: -5,
                            right: -5,
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            background: '#FF3B5C',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            cursor: 'pointer',
                            border: '2px solid #fff',
                            fontWeight: 700
                          }}
                        >
                          ×
                        </div>
                      </div>
                    ))}

                    {/* 添加按钮 */}
                    <div
                      onClick={() => prodFileRef.current?.click()}
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 10,
                        border: '2px dashed #ccc',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 2,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        background: '#fff',
                        flex: '0 0 auto'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--red)';
                        e.currentTarget.style.color = 'var(--red)';
                        e.currentTarget.style.background = '#FFF5F5';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#ccc';
                        e.currentTarget.style.color = '#999';
                        e.currentTarget.style.background = '#fff';
                      }}
                    >
                      <ImagePlus size={16} color="#999" />
                      <span style={{ fontSize: 9, color: '#999', fontWeight: 600 }}>+ {getNextProductShot(productImages.length).short}</span>
                    </div>
                  </div>

                  {/* 提示文字 */}
                  <div
                    style={{
                      fontSize: 11,
                      color: '#999',
                      marginTop: 8,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {getProdHint(productImages.length)}
                  </div>
                </div>

                <input ref={prodFileRef} type="file" accept="image/*" multiple hidden onChange={handleProdUpload} />
              </div>

              {/* 乘号分隔 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: '0 0 auto',
                  padding: '0 4px',
                  alignSelf: 'center'
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 800,
                    boxShadow: '0 2px 8px rgba(124,58,237,0.3)'
                  }}
                >
                  ×
                </div>
              </div>

              {/* 参考图上传区 */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  transform: 'rotate(1.25deg)'
                }}
              >
                <div
                  style={{
                    background: '#fff',
                    borderRadius: 16,
                    border: '2px solid var(--blue)',
                    boxShadow: '0 6px 32px rgba(102,126,234,0.18)',
                    padding: '14px 12px',
                    minHeight: 110,
                    transition: 'all 0.25s cubic-bezier(0.22, 1, 0.36, 1)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--blue)';
                    e.currentTarget.style.boxShadow = '0 6px 32px rgba(102,126,234,0.25)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--blue)';
                    e.currentTarget.style.boxShadow = '0 6px 32px rgba(102,126,234,0.18)';
                  }}
                >
                  {/* 标题行 */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginBottom: 10
                    }}
                  >
                    <span style={{ fontSize: 12 }}>🎨</span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#1a1a1a'
                      }}
                    >
                      参考图
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: '#666',
                        background: 'rgba(0,0,0,0.04)',
                        padding: '2px 8px',
                        borderRadius: 8,
                        marginLeft: 'auto',
                        fontWeight: 500
                      }}
                    >
                      可选
                    </span>
                  </div>

                  {/* 横向滚动的图片行 */}
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      overflowX: 'auto',
                      paddingBottom: 7,
                      scrollbarWidth: 'thin'
                    }}
                  >
                    {refImages.map((img, idx) => (
                      <div
                        key={idx}
                        style={{
                          position: 'relative',
                          width: 64,
                          height: 64,
                          borderRadius: 10,
                          overflow: 'hidden',
                          border: '2px solid #eee',
                          flex: '0 0 auto'
                        }}
                      >
                        <img
                          src={img.url}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                        />
                        <div
                          onClick={() => removeRefImg(idx)}
                          style={{
                            position: 'absolute',
                            top: -5,
                            right: -5,
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            background: '#FF3B5C',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            cursor: 'pointer',
                            border: '2px solid #fff',
                            fontWeight: 700
                          }}
                        >
                          ×
                        </div>
                      </div>
                    ))}

                    {/* 添加按钮 */}
                    <div
                      onClick={() => refFileRef.current?.click()}
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 10,
                        border: '2px dashed #ccc',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 2,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        background: '#fff',
                        flex: '0 0 auto'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--blue)';
                        e.currentTarget.style.color = 'var(--blue)';
                        e.currentTarget.style.background = 'rgba(102,126,234,0.04)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#ccc';
                        e.currentTarget.style.color = '#999';
                        e.currentTarget.style.background = '#fff';
                      }}
                    >
                      <ImagePlus size={16} color="#999" />
                      <span style={{ fontSize: 9, color: '#999', fontWeight: 600 }}>{refImages.length === 0 ? '上传参考' : '+ 继续添加'}</span>
                    </div>
                  </div>

                  {/* 提示文字 */}
                  <div
                    style={{
                      fontSize: 11,
                      color: '#999',
                      marginTop: 8,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {getRefHint(refImages.length)}
                  </div>
                </div>

                <input ref={refFileRef} type="file" accept="image/*" multiple hidden onChange={handleRefUpload} />
              </div>
            </div>

            {/* ── 下方：产品描述输入区（小红书同款 textarea）── */}
            <div className="hero-textarea-wrap" style={{ margin: 0 }}>
              <textarea className="hero-textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder=" " />
              <div className="custom-placeholder">
                <div className="ph-main">描述你的产品名称、特点、材质、用途…</div>
                <div className="ph-sub">例如：白色陶瓷马克杯，简约北欧风，容量350ml，带木质把手，适合办公家用</div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ 配置按钮行（相对定位容器，面板在此内部绝对定位）═══ */}
        <div
          ref={btnRowRef}
          className="ec-workbench-actions ec-commerce-workbench-actions"
          style={{
            padding: '12px 2px 14px',
            position: 'relative',
            zIndex: 10,
            borderTop: '1px solid rgba(28,25,23,0.08)',
            background: '#fff'
          }}
        >
          <div className="ec-workbench-primary-row">
            <div className="ec-workbench-tools">
              {/* ═══ 常驻「当前商品」chip：点击弹出档案选择器，选中后全局生效 ═══ */}
              <ProductChip
                profile={activeProductProfile}
                profiles={productProfiles}
                loading={productProfilesLoading}
                onSelect={selectActiveProductProfile}
              />
              {/* ═══ 面板渲染（Portal 到 body）═══ */}
              {renderPanel()}
              {/* ── 6 个功能按钮（带配置回显 - 类似椒图AI）── */}
              {BUTTONS.map((btn) => {
                const isOpen = activePanel === btn.key;
                const isAdjusted = adjustedPanels[btn.key];
                // 计算配置摘要（始终显示，类似椒图AI）
                const getConfigSummary = () => {
                  switch (btn.key) {
                    case 'sizing': {
                      const images = resolveSizingImages(platform, {
                        ...sizing,
                        resolution: genSettings.resolution
                      });
                      return {
                        text: summarizeCommerceConfiguration('sizing', {
                          images
                        }),
                        isSmart: false
                      };
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
                      return {
                        text: hasColor ? `${base}+品牌色` : base,
                        isSmart: false
                      };
                    }
                    case 'params': {
                      return {
                        text: summarizeCommerceConfiguration('params', {
                          productParams
                        }),
                        isSmart: false
                      };
                    }
                    case 'sku': {
                      return {
                        text: summarizeCommerceConfiguration('sku', { skus }),
                        isSmart: false
                      };
                    }
                    case 'copy': {
                      const fields = ['plan', 'sellingPoints', 'qc', 'details', 'maintenance'];
                      const filled = fields.filter((k) => copywriting?.[k]?.trim?.()).length;
                      return filled > 0 ? { text: `${filled}项文案`, isSmart: false } : { text: '文案策划', isSmart: false };
                    }
                    case 'settings': {
                      const { resolution = '2K', imageModel = 'image2' } = genSettings;
                      const modelLabel = imageModel === 'nano-banana-pro' ? 'Nano Pro' : imageModel === 'nano-banana-2' ? 'Nano 2' : 'Image 2';
                      return { text: `${modelLabel}·${resolution}`, isSmart: false };
                    }
                    default:
                      return { text: null, isSmart: false };
                  }
                };
                const summary = getConfigSummary();
                return (
                  <button
                    type="button"
                    key={btn.key}
                    ref={(el) => {
                      if (el) btnRefs.current[btn.key] = el;
                    }}
                    onClick={() => openPanel(btn.key)}
                    aria-label={`${btn.label}：${summary.text || btn.label}`}
                    aria-expanded={isOpen}
                    className={`ec-config-trigger${isOpen ? ' is-open' : ''}${isAdjusted ? ' is-adjusted' : ''}`}
                    style={{
                      ...BTN_BASE,
                      appearance: 'none',
                      border: `1.5px solid ${activePanel === btn.key ? '#1f2937' : 'rgba(28,25,23,.28)'}`,
                      borderColor: isOpen ? '#8b5cf6' : isAdjusted ? 'rgba(139,92,246,0.55)' : 'rgba(28,25,23,0.10)',
                      background: isOpen ? '#f1e9ff' : isAdjusted ? '#fbf8ff' : '#fff',
                      position: 'relative',
                      boxShadow: isOpen ? '0 4px 14px rgba(124,58,237,0.15)' : isAdjusted ? '0 3px 10px rgba(124,58,237,0.10)' : BTN_BASE.boxShadow
                    }}
                    onMouseEnter={(e) => {
                      if (!isOpen) {
                        e.currentTarget.style.background = '#faf7ff';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(62,43,26,0.10)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isOpen) {
                        e.currentTarget.style.background = isAdjusted ? '#fbf8ff' : '#fff';
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.boxShadow = isAdjusted ? '0 3px 10px rgba(124,58,237,0.10)' : BTN_BASE.boxShadow;
                      }
                    }}
                  >
                    <span
                      style={{
                        color: isAdjusted ? '#7c3aed' : 'var(--text-muted)',
                        flexShrink: 0,
                        filter: isAdjusted ? 'drop-shadow(0 1px 2px rgba(124,58,237,0.2))' : 'none'
                      }}
                    >
                      {btn.icon}
                    </span>
                    {/* 焦图AI风格：直接显示配置内容，替代原有标签 */}
                    <span className="ec-config-trigger-copy">
                      <span>{btn.label}</span>
                      <strong>{summary.text || btn.label}</strong>
                    </span>
                    {isAdjusted && <span className="ec-config-adjusted-badge">已调整</span>}
                    <ChevronDown
                      size={13}
                      style={{
                        opacity: isOpen ? 0.8 : 0.4,
                        color: isAdjusted ? '#7c3aed' : 'var(--text-muted)',
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.22s ease, opacity 0.2s'
                      }}
                    />
                  </button>
                );
              })}
            </div>

            {/* ── 下一步按钮 ── */}
            {assetUploadError && (
              <div role="alert" style={{ color: '#b91c1c', fontSize: 12, marginRight: 8 }}>
                {assetUploadError}
              </div>
            )}
            <div className="ec-workbench-submit-actions">
              <button
                className="ec-workbench-next"
                disabled={!canGen || uploadingAssets}
                onClick={handleNext}
                style={{
                  height: 38,
                  padding: '0 22px',
                  borderRadius: 12,
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: 'inherit',
                  background: canGen && !uploadingAssets ? 'linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #f59e0b 100%)' : '#e5e5e5',
                  color: canGen && !uploadingAssets ? '#fff' : '#aaa',
                  cursor: canGen && !uploadingAssets ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.2s',
                  flexShrink: 0,
                  boxShadow: canGen && !uploadingAssets ? '0 4px 16px rgba(124,58,237,0.3)' : 'none'
                }}
                onMouseEnter={(e) => {
                  if (canGen && !uploadingAssets) {
                    e.currentTarget.style.transform = 'scale(1.02)';
                    e.currentTarget.style.boxShadow = '0 6px 24px rgba(124,58,237,0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = canGen && !uploadingAssets ? '0 4px 16px rgba(124,58,237,0.3)' : 'none';
                }}
              >
                {uploadingAssets ? '正在上传原图…' : '下一步'} <span style={{ fontSize: 15, lineHeight: 1 }}>→</span>
              </button>
            </div>
          </div>
        </div>
        </div>
        </div>
      </div>
    </div>
  );
}
