import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Upload, ChevronRight, ShoppingCart, Target, RefreshCw, Copy, Monitor, ChevronDown, ChevronUp, Eye, RotateCcw as RotateIcon, Settings } from 'lucide-react';
import { MdAutoAwesome, MdExpandMore, MdAdd, MdEdit, MdGpsFixed, MdPalette, MdRefresh, MdContentCopy, MdVerified, MdChevronRight, MdVisibility, MdCheck, MdClose, MdRotateLeft, MdLightbulb, MdAddPhotoAlternate } from 'react-icons/md';
import { useApp } from '../../store/AppContext';
import { IMAGES } from '../../constants/images';
import { GALLERY, QUICK_HINTS, EC_CATS, EC_PLATFORM_DIMS, EC_IMG_RATIOS, EC_MAIN_TYPES } from '../../constants/data';
// 兼容：旧版首页电商 tab 仍引用已删除的 EC_ADV_TYPES / EC_STYLE_PACKS。
// 用本地 stub 保持旧 tab 的运行行为不变（type-shape 与常量同名；服务端忽略 stylePack）。
const EC_ADV_TYPES = [
  { key:'scene',        label:'使用场景图', emoji:'🌿', mandatory:false, defaultCount:0, maxCount:4, desc:'产品出现在真实使用环境中' },
  { key:'detail',       label:'详情图',     emoji:'📋', mandatory:false, defaultCount:0, maxCount:6, desc:'每张讲一个卖点' },
  { key:'feature',      label:'卖点解说图', emoji:'💬', mandatory:false, defaultCount:0, maxCount:6, desc:'在白底/场景上加卖点标注' },
  { key:'composite',    label:'组合图',     emoji:'🎁', mandatory:false, defaultCount:0, maxCount:2, desc:'全家福 / 套装组合' },
  { key:'package',      label:'包装图',     emoji:'📦', mandatory:false, defaultCount:0, maxCount:2, desc:'外包装 / 配件 / 标签' },
  { key:'macro',        label:'特写图',     emoji:'🔍', mandatory:false, defaultCount:0, maxCount:3, desc:'材质/工艺微距' },
  { key:'comparison',   label:'对比图',     emoji:'⚖️', mandatory:false, defaultCount:0, maxCount:2, desc:'vs 同款 / 自家多色' },
];
const EC_STYLE_PACKS = [
  { key:'scene_selling', label:'场景种草', subtitle:'卖场景', desc:'产品放在真实使用场景里', img:'', ar:'1/1' },
  { key:'detail_selling',label:'卖点图解', subtitle:'卖功能', desc:'每张图讲一个核心卖点',    img:'', ar:'1/1' },
  { key:'ugc_trust',     label:'买家秀风', subtitle:'真实感',desc:'模拟用户晒单的口吻',       img:'', ar:'1/1' },
  { key:'brand_unified', label:'品牌统一', subtitle:'统一感',desc:'全套视觉风格一致',          img:'', ar:'1/1' },
  { key:'promo_sale',    label:'促销热卖', subtitle:'促销感',desc:'价格/优惠/抢购角标',        img:'', ar:'1/1' },
  { key:'',              label:'无风格（默认）', subtitle:'自动',desc:'AI 自由发挥',         img:'', ar:'1/1' },
];
import { proxyImg, generateContent, generatePlogContent, generateEcommerce, generateEcommercePreview, regenerateImage, saveWork, uploadEcommerceAssets } from '../../services/api';
import { handleGenerationAccessError } from '../../utils/generationAccess.js';
import {
  acceptAuthoritativeContentCompletion,
  buildContentPendingAction,
  createContentDraftId,
} from '../contentGenerationModel.js';
import { createEcommerceDraftId } from './ec/ecommercePlanModel.js';
import {
  ECOMMERCE_DRAFT_SURFACES,
  acceptEcommerceFinalResult,
  createEcommerceGenerationPreconditionError,
  createEcommerceGenerationToken,
  isEcommerceGenerationTokenCurrent,
  loadOrCreateEcommerceDraft,
  mergeEcommerceInProgressPreview,
  rotateEcommerceDraft,
} from './ec/ecommerceTaskProgressModel.js';
import { CharImg } from '../../components/ui/index';
import Button from '../../components/ui/Button';
import CreationShowcase from './CreationShowcase.jsx';
import ImageMentionPicker from '../../components/creation/ImageMentionPicker.jsx';
import SupplementAssetDeck from './ec/components/SupplementAssetDeck.jsx';
import { insertImageMentionAt } from '../../components/creation/imageMentionModel.js';
import './Home.css';

// 提取会话守卫（模块级，跨 StrictMode 双渲染保持状态）
let _extractSessionToken = null;
let observedEcommerceWorkVersion = 0;

function insertMentionInTextarea(fieldRef, currentValue, setValue, label) {
  const field = fieldRef.current;
  const result = insertImageMentionAt(
    currentValue,
    label,
    field?.selectionStart,
    field?.selectionEnd,
  );
  if (result.value === currentValue) return;
  setValue(result.value);
  const restore = () => {
    field?.focus();
    field?.setSelectionRange?.(result.caret, result.caret);
  };
  if (globalThis.requestAnimationFrame) globalThis.requestAnimationFrame(restore);
  else globalThis.setTimeout?.(restore, 0);
}

function XhsSupplementDeck({ styleImages, sourceImages, onAdd, onRemove, plog = false }) {
  const toImages = (values, role) => values.map((url, index) => ({
    id: `${plog ? 'plog' : 'xhs'}-${role}-${index}`,
    url,
    status: 'loaded',
    isAdded: true,
  }));
  const removeAt = role => image => {
    const values = role === 'style' ? styleImages : sourceImages;
    const index = values.findIndex(url => url === image?.url);
    if (index >= 0) onRemove(role, index);
  };
  return (
    <SupplementAssetDeck
      productImages={toImages(sourceImages, 'source')}
      referenceImages={toImages(styleImages, 'style')}
      onAddProductImages={files => onAdd('source', files)}
      onAddReferenceImages={files => onAdd('style', files)}
      onRemoveProductImage={removeAt('source')}
      onRemoveReferenceImage={removeAt('style')}
      productTitle={plog ? '生活素材' : '我的素材'}
      productHint={plog ? '保留人物、空间与生活细节' : '保留主体、人物与产品细节'}
      referenceTitle="风格参考"
      referenceHint="借鉴构图、色调与版式，不复制主体"
      productSuggestions={[
        { label: '主体清晰图' }, { label: '人物或空间' }, { label: '细节补充图' },
      ]}
      referenceSuggestions={[
        { label: '整体气质' }, { label: '构图参考' }, { label: '色调与版式' },
      ]}
      productColor={plog ? '#be185d' : '#e84142'}
      referenceColor={plog ? '#8b5cf6' : '#c2185b'}
      maxProductImages={6}
      maxReferenceImages={3}
    />
  );
}

export default function HomePage({ inlineMode, compactMode, renderMode, xhsSubMode: xhsSubModeProp, setXhsSubMode: setXhsSubModeProp, recoveryCheckpoint = null }) {
  const { state, dispatch, fetchCredits, refreshBillingBalance } = useApp();
  const { inputText, logged, ecPoints, unlimited, mode } = state;
  const ownerEmail = String(state.email || state.phone || '').trim().toLowerCase();
  const workVersion = Number(state._workVersion || 0);
  const [err, setErr] = useState('');
  const [refImages, setRefImages] = useState([]);
  const [xhsSourceImages, setXhsSourceImages] = useState([]);
  const xhsPromptRef = useRef(null);
  const [xhsContentDraftId, setXhsContentDraftId] = useState(() => createContentDraftId({ ownerEmail, source: 'xhs-content' }));
  const [xhsReferenceAssetIds, setXhsReferenceAssetIds] = useState([]);
  const [xhsSourceAssetIds, setXhsSourceAssetIds] = useState([]);
  // 小红书子模式：content(种草) / plog(生活碎片) — 支持外部传入或内部管理
  const [xhsSubModeInternal, setXhsSubModeInternal] = useState('content');
  const xhsSubMode = xhsSubModeProp !== undefined ? xhsSubModeProp : xhsSubModeInternal;
  const setXhsSubMode = setXhsSubModeProp || setXhsSubModeInternal;

  // Plog 专属状态
  const [plogText, setPlogText] = useState('');
  const [plogStyle, setPlogStyle] = useState('ins-minimal');
  const [plogLayout, setPlogLayout] = useState('casual');
  const [plogStyleImages, setPlogStyleImages] = useState([]);
  const [plogSourceImages, setPlogSourceImages] = useState([]);
  const plogPromptRef = useRef(null);
  const [homePlogDraftId, setHomePlogDraftId] = useState(() => createContentDraftId({ ownerEmail, source: 'xhs-plog' }));
  const [homePlogReferenceAssetIds, setHomePlogReferenceAssetIds] = useState([]);
  const [homePlogSourceAssetIds, setHomePlogSourceAssetIds] = useState([]);

  const [ecName, setEcName] = useState('');
  const [ecCat, setEcCat] = useState('美妆护肤');
  const [ecRefImgs, setEcRefImgs] = useState([]);
  const [ecStylePack, setEcStylePack] = useState('');
  const [ecSelections, setEcSelections] = useState([]);
  const [ecPlatform, setEcPlatform] = useState('淘宝');
  const [ecProductPoints, setEcProductPoints] = useState(''); // 逗号/分号/换行分隔
  const [ecBeauty, setEcBeauty] = useState(false);
  const [ecMaterial, setEcMaterial] = useState('');
  const [ecTargetAudience, setEcTargetAudience] = useState('');
  const [ecRestrictions, setEcRestrictions] = useState('');
  const [ecCollapsed, setEcCollapsed] = useState(false); // 图片配置折叠
  const [toast, setToast] = useState(null);
  const [topicsOpen, setTopicsOpen] = useState(false);
  const [plogOptionsOpen, setPlogOptionsOpen] = useState(false);
  const [extractingProduct, setExtractingProduct] = useState(false); // 插件数据反推加载中
  const ecFileRef = useRef(null);
  const [showRefModal, setShowRefModal] = useState(false);

  // Toast 自动消失
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // 平台尺寸映射（共享常量）
  const ALL_TYPES = [...EC_MAIN_TYPES, ...EC_ADV_TYPES];
  const getDim = (key) => EC_PLATFORM_DIMS[ecPlatform]?.[EC_IMG_RATIOS[key] || '1:1'] || [800,800];
  // 生成流程状态: config → preview → generating → result
  const [genPhase, setGenPhase] = useState('config');
  const [genECLoading, setGenECLoading] = useState(false);
  const [ecLoadingMsg, setEcLoadingMsg] = useState('');
  const [ecOutline, setEcOutline] = useState([]);       // 大纲列表（含用户编辑后的 prompt）
  const [ecOutlineLoading, setEcOutlineLoading] = useState(false);
  const [ecResults, setEcResults] = useState(null);      // 生成结果
  const [inProgressPreview, setInProgressPreview] = useState({});
  const [ecRegeneratingKey, setEcRegeneratingKey] = useState('');
  const [ecRegenEdit, setEcRegenEdit] = useState({ label: null, prompt: '', visible: false }); // 重生成prompt编辑器
  const [ecLightbox, setEcLightbox] = useState(null); // 图片放大查看
  const [ecPreviewLightbox, setEcPreviewLightbox] = useState(null); // 参考图放大查看
  const [ecDraftId, setEcDraftId] = useState(() => loadOrCreateEcommerceDraft({
    ownerEmail,
    surface: ECOMMERCE_DRAFT_SURFACES.XHS_ECOMMERCE,
    createDraftId: createEcommerceDraftId,
  })?.draftId || '');
  const generationTokenRef = useRef(null);
  const generationAbortRef = useRef(null);
  const generationIdentityRef = useRef({ ownerEmail, draftId: ecDraftId });
  generationIdentityRef.current = { ownerEmail, draftId: ecDraftId };
  const beginGeneration = () => {
    const token = createEcommerceGenerationToken({ ownerEmail, draftId: ecDraftId });
    generationTokenRef.current = token;
    return token;
  };
  const isGenerationCurrent = (token) => isEcommerceGenerationTokenCurrent(token, {
    currentToken: generationTokenRef.current,
    ownerEmail: generationIdentityRef.current.ownerEmail,
    draftId: generationIdentityRef.current.draftId,
  });

  useEffect(() => {
    generationTokenRef.current = null;
    generationAbortRef.current?.abort();
    generationAbortRef.current = null;
    const active = loadOrCreateEcommerceDraft({
      ownerEmail,
      surface: ECOMMERCE_DRAFT_SURFACES.XHS_ECOMMERCE,
      createDraftId: createEcommerceDraftId,
    });
    setEcDraftId(active?.draftId || '');
    setEcResults(null);
    setInProgressPreview({});
    setGenECLoading(false);
    setEcLoadingMsg('');
  }, [ownerEmail]);

  useEffect(() => {
    const kind = recoveryCheckpoint?.project?.kind;
    const snapshot = recoveryCheckpoint?.version?.inputSnapshot;
    if (!snapshot || typeof snapshot !== 'object') return;
    if (kind === 'xiaohongshu') {
      dispatch({ type: 'SET_INPUT', text: typeof snapshot.text === 'string' ? snapshot.text : '' });
      if (Array.isArray(snapshot.referenceAssetIds)) setXhsReferenceAssetIds(snapshot.referenceAssetIds);
      if (Array.isArray(snapshot.referenceImages)) {
        setRefImages(snapshot.referenceImages.filter(value => typeof value === 'string' && value.trim()).slice(0, 3));
        setXhsReferenceAssetIds([]);
      }
      if (Array.isArray(snapshot.referenceAssets?.source)) {
        setXhsSourceAssetIds(snapshot.referenceAssets.source);
      }
    }
    if (kind === 'plog') {
      setPlogText(typeof snapshot.text === 'string' ? snapshot.text : '');
      if (typeof snapshot.style === 'string') setPlogStyle(snapshot.style);
      if (typeof snapshot.layout === 'string') setPlogLayout(snapshot.layout);
      if (Array.isArray(snapshot.referenceAssetIds)) setHomePlogReferenceAssetIds(snapshot.referenceAssetIds);
      if (Array.isArray(snapshot.referenceAssets?.source)) setHomePlogSourceAssetIds(snapshot.referenceAssets.source);
    }
  }, [recoveryCheckpoint]);

  useEffect(() => {
    if (!workVersion || workVersion <= observedEcommerceWorkVersion) return;
    observedEcommerceWorkVersion = workVersion;
    generationTokenRef.current = null;
    generationAbortRef.current?.abort();
    generationAbortRef.current = null;
    const rotated = rotateEcommerceDraft({
      ownerEmail,
      surface: ECOMMERCE_DRAFT_SURFACES.XHS_ECOMMERCE,
      currentDraftId: ecDraftId,
      createDraftId: createEcommerceDraftId,
    });
    if (!rotated?.draftId) return;
    setEcDraftId(rotated.draftId);
    setEcResults(null);
    setInProgressPreview({});
    setEcName('');
    setGenPhase('config');
    setGenECLoading(false);
    setEcLoadingMsg('');
  }, [ecDraftId, ownerEmail, workVersion]);

  useEffect(() => () => {
    generationTokenRef.current = null;
    generationAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    setXhsContentDraftId(createContentDraftId({ ownerEmail, source: 'xhs-content' }));
    setHomePlogDraftId(createContentDraftId({ ownerEmail, source: 'xhs-plog' }));
    dispatch({ type: 'SET_INPUT', text: '' });
    setXhsReferenceAssetIds([]);
    setXhsSourceAssetIds([]);
    setRefImages([]);
    setXhsSourceImages([]);
    setPlogText('');
    setPlogStyle('ins-minimal');
    setPlogLayout('casual');
    setHomePlogReferenceAssetIds([]);
    setHomePlogSourceAssetIds([]);
    setPlogStyleImages([]);
    setPlogSourceImages([]);
  }, [ownerEmail]);

  const setMode = (m) => dispatch({ type: 'SET_MODE', mode: m });
  const setText = (t) => dispatch({ type: 'SET_INPUT', text: t });
  const xhsMentionImages = useMemo(() => [
    ...refImages.map((url, index) => ({ id: `xhs-style-${index}`, url, name: `风格参考 ${index + 1}`, role: 'style' })),
    ...xhsSourceImages.map((url, index) => ({ id: `xhs-source-${index}`, url, name: `我的素材 ${index + 1}`, role: 'source' })),
  ], [refImages, xhsSourceImages]);
  const plogMentionImages = useMemo(() => [
    ...plogStyleImages.map((url, index) => ({ id: `plog-style-${index}`, url, name: `风格参考 ${index + 1}`, role: 'style' })),
    ...plogSourceImages.map((url, index) => ({ id: `plog-source-${index}`, url, name: `生活素材 ${index + 1}`, role: 'source' })),
  ], [plogStyleImages, plogSourceImages]);

  // 检查书签工具返回的提取数据
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('extract_token');
    if (!token) return;
    // 模块级守卫：防 React StrictMode 双渲染导致第二个实例读取已删除的数据
    if (_extractSessionToken === token) return;
    _extractSessionToken = token;

    // 先切到电商 tab 并显示加载状态
    setMode('ecommerce');
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
    setEcCat(''); // 清掉默认「美妆护肤」，避免智能推荐误加美妆报告
    setExtractingProduct(true);

    (async () => {
      try {
        const { getExtractData } = await import('../../services/api');
        // 轮询等待分析（最多 12 次 × 2s = 24 秒，覆盖 Vision 下载+分析时间）
        let d = null;
        for (let i = 0; i < 12; i++) {
          d = await getExtractData(token);
          if (!d || !d.ok) break;
          if (d.ready) break;
          await new Promise(r => setTimeout(r, 2000));
        }
        // 如果轮询结束还没 ready，再取一次（此时 data 应有图+卖点，只差 analysis）
        if ((!d || !d.ok || !d.ready) && token) {
          const last = await getExtractData(token);
          if (last && last.ok) d = last;
        }

        if (d && d.ok && d.title) {
          setEcName(d.title);
          // 有反推结果 → 自动配置参数
          if (d.analysis) {
            if (d.analysis.category) setEcCat(d.analysis.category);
            if (d.analysis.stylePack) setEcStylePack(d.analysis.stylePack);
            if (d.analysis.material) setEcMaterial(d.analysis.material);
            if (d.analysis.keySellingPoints?.length) setEcProductPoints(d.analysis.keySellingPoints.join(', '));
          } else {
            // 没反推结果 → 不污染默认类目（避免默认「美妆护肤」导致美妆报告）
            setEcCat('');
          }
          // sellingPoints 直接从 POST 数据来，analysis 没有也能用
          if (d.sellingPoints?.length && !d.analysis?.keySellingPoints?.length) setEcProductPoints(d.sellingPoints.join(', '));
          if (d.images?.length) setEcRefImgs(d.images.slice(0, 8));

          setExtractingProduct(false);
          // 统计提取了哪些信息
          const extracted = [];
          if (d.analysis?.category) extracted.push(`品类·${d.analysis.category}`);
          if (d.analysis?.stylePack) extracted.push('风格');
          if (d.sellingPoints?.length || d.analysis?.keySellingPoints?.length) extracted.push('卖点');
          if (d.images?.length) extracted.push(`${d.images.length}张参考图`);
          setToast({
            message: d.analysis
              ? `✅ 已提取「${d.title.slice(0, 16)}」— ${extracted.join('、')}`
              : `✅ 已提取「${d.title.slice(0, 18)}」— ${extracted.join('、')}，分析完成后将自动更新`,
            type: 'success',
          });

          // 如果分析还没完成，后台继续等，完成后自动更新表单
          if (!d.analysis) {
            (async function waitAnalysis() {
              try {
                for (let i = 0; i < 15; i++) {
                  await new Promise(r => setTimeout(r, 3000));
                  const upd = await getExtractData(token);
                  if (!upd || !upd.ok) break;
                  if (upd.analysis) {
                    if (upd.analysis.category) setEcCat(upd.analysis.category);
                    if (upd.analysis.stylePack) setEcStylePack(upd.analysis.stylePack);
                    if (upd.analysis.material) setEcMaterial(upd.analysis.material);
                    if (upd.analysis.keySellingPoints?.length) setEcProductPoints(upd.analysis.keySellingPoints.join(', '));
                    setToast({ message: `✅ 视觉分析完成：${upd.analysis.category} · 风格已自动匹配`, type: 'success' });
                    break;
                  }
                }
              } catch (_) {}
            })();
          }
        } else {
          // 没标题但有其他数据
          const hasImages = !!(d && d.ok && d.images?.length);
          const hasPoints = !!(d && d.ok && d.sellingPoints?.length);
          const anyData = d && d.ok && (hasImages || hasPoints);

          if (anyData) {
            if (d.images?.length) setEcRefImgs(d.images.slice(0, 8));
            setEcName('未命名商品');
            setEcCat('');
            setExtractingProduct(false);
            const parts = [];
            if (hasImages) parts.push(`${d.images.length}张参考图`);
            if (hasPoints) parts.push(`${d.sellingPoints.length}个卖点`);
            setToast({ message: `✅ 已提取${parts.join('、')}，填写商品名称即可生成`, type: 'success' });
          } else {
            // 真正的无数据
            setExtractingProduct(false);
            if (d && d.ok) {
              setToast({ message: '⚠️ 提取到商品数据为空，请用爆款复刻或手动填写', type: 'error' });
            } else {
              setToast({ message: '⚠️ 数据读取失败，请刷新页面或手动填写', type: 'error' });
            }
          }
        }
        window.history.replaceState({}, '', window.location.pathname);
      } catch (e) {
        setExtractingProduct(false);
        console.warn('书签数据读取失败', e);
        setToast({ message: '⚠️ 数据读取失败，请手动填写', type: 'error' });
      }
    })();
  }, []);
  const ecLabel = (key) => ALL_TYPES.find(t => t.key === key)?.label || key;
  const baseKey = (k) => k.replace(/_\d+$/, '');

  // 解析卖点文案（逗号/分号/换行分隔）
  const parsePoints = (str) => str.split(/[,;，；\n]+/).map(s => s.trim()).filter(Boolean);

  // 智能推荐 — 每个风格包推荐贴合其核心用途的图片类型
  // 切换风格包时清空旧推荐，不混合保留
  const prevStyleRef = useRef(ecStylePack);
  // 每个风格包推荐一套完整的默认图片组，覆盖主图+核心配图
  useEffect(() => {
    const points = parsePoints(ecProductPoints);
    const pointsCount = points.length;
    const recs = [];
    const dim = (key) => { const d = getDim(key); return { width:d[0], height:d[1] }; };

    switch (ecStylePack) {
      case 'scene_selling':
        // 场景种草：场景图为主 + 白底图兜底
        recs.push({ key:'scene', count:2, ...dim('scene'), reason:'场景种草风格，2 张不同使用场景' });
        recs.push({ key:'white_bg', count:1, ...dim('white_bg'), reason:'保留 1 张白底图作为平台首图' });
        if (pointsCount) recs.push({ key:'detail', count:Math.min(pointsCount, 2), ...dim('detail'), reason:'搭配场景的详情图，每张讲一个卖点' });
        break;
      case 'detail_selling':
        // 卖点解说：白底图 + 每卖点一张详情图
        recs.push({ key:'white_bg', count:1, ...dim('white_bg'), reason:'白底图作为搜索首图' });
        if (pointsCount) recs.push({ key:'detail', count:Math.min(pointsCount, 4), ...dim('detail'), reason:'每张详情图聚焦一个卖点，配中文标注讲清楚' });
        else recs.push({ key:'detail', count:2, ...dim('detail'), reason:'详情图展示产品核心卖点与细节' });
        break;
      case 'ugc_trust':
        // 真实买家感：场景图 + 白底图
        recs.push({ key:'scene', count:2, ...dim('scene'), reason:'真实感场景图，看起来像买家实拍' });
        recs.push({ key:'white_bg', count:1, ...dim('white_bg'), reason:'留一张白底图，平台搜索需要' });
        break;
      case 'brand_unified':
        // 品牌质感：组合图 + 白底图 + 场景图
        recs.push({ key:'composite', count:1, ...dim('composite'), reason:'组合图=主图+细节+场景三合一，品牌展示核心' });
        recs.push({ key:'white_bg', count:1, ...dim('white_bg'), reason:'干净的白底图保持搜索可见' });
        recs.push({ key:'scene', count:1, ...dim('scene'), reason:'品牌调性场景图' });
        break;
      case 'promo_sale':
        // 促销大促：主图文案 + 详情图标价格
        recs.push({ key:'main_text', count:1, ...dim('main_text'), reason:'主图带促销文案角标，大促吸引点击' });
        if (pointsCount) recs.push({ key:'detail', count:Math.min(pointsCount, 2), ...dim('detail'), reason:'详情图标价格/折扣信息' });
        break;
      default:
        // 官方主图风格：白底图为主
        recs.push({ key:'white_bg', count:2, ...dim('white_bg'), reason:'官方主图风格，纯白底棚拍，不同角度各一张' });
        if (pointsCount) recs.push({ key:'detail', count:Math.min(pointsCount, 1), ...dim('detail'), reason:'配 1 张卖点详情图' });
        break;
    }

    const styleChanged = prevStyleRef.current !== ecStylePack;
    prevStyleRef.current = ecStylePack;
    setEcSelections(prev => {
      if (styleChanged) return [...recs];
      const recMap = new Map(recs.map(r => [r.key, r]));
      const manual = prev.filter(p => !recMap.has(p.key));
      return [...manual, ...recs];
    });
  }, [ecProductPoints, ecMaterial, ecRefImgs.length, ecCat, ecStylePack, ecPlatform]);

  const updateSelection = (key, delta) => {
    setEcSelections(prev => {
      const existing = prev.find(s => s.key === key);
      const type = ALL_TYPES.find(t => t.key === key);
      if (!type) return prev;
      if (existing) {
        const newCount = existing.count + delta;
        if (newCount <= 0) return prev.filter(s => s.key !== key);
        if (type.mandatory && newCount < 1) return prev;
        return prev.map(s => s.key === key ? { ...s, count: Math.min(newCount, type.maxCount) } : s);
      }
      if (delta > 0) return [...prev, { key, count: delta }];
      return prev;
    });
  };

  // 更新图片类型的自定义尺寸
  const updateDimension = (key, dimKey, value) => {
    setEcSelections(prev => {
      const v = Math.max(100, Math.min(9999, parseInt(value) || 0));
      return prev.map(s => s.key === key ? { ...s, [dimKey]: v } : s);
    });
  };

  // 链接提取已交由插件处理，不再使用服务端解析

  // 计算总生成张数
  const totalImageCount = ecSelections.reduce((sum, s) => sum + s.count, 0);

  // 预览大纲
  const doPreviewOutline = async () => {
    if (!ecName.trim()) return;
    // if (!logged) { dispatch({ type: 'SHOW_LOGIN', show: true }); return; } // 测试环境跳过登录
    setEcOutlineLoading(true);
    setErr('');
    try {
      const data = await generateEcommercePreview({
        productName: ecName.trim(),
        category: ecCat,
        points: ecProductPoints.trim(),
        refCount: ecRefImgs.length,
        hasMaterial: !!ecMaterial,
        stylePack: ecStylePack || null,
      });
      // 按用户当前的 ecSelections 过滤大纲，去掉用户取消的图片类型
      const keptCounts = {};
      const outlined = (data.outline || [])
        .filter(item => {
          const sel = ecSelections.find(s => s.key === item.key);
          if (!sel) return false; // 用户没选 → 去掉
          keptCounts[item.key] = (keptCounts[item.key] || 0) + 1;
          return keptCounts[item.key] <= sel.count; // 超过用户选择的张数 → 去掉
        })
        .map((item, idx) => ({
          ...item,
          userPrompt: item.outlineText || '',
          refImageIndex: ecRefImgs.length > 0 ? (idx % ecRefImgs.length) : -1,
        }));
      setEcOutline(outlined);
      setGenPhase('preview');
      setTimeout(() => {
        const el = document.querySelector('.ec-preview-header');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    } catch (e) {
      setErr('预览失败: ' + (e.message || '请稍后重试'));
    }
    setEcOutlineLoading(false);
  };

  // 更新大纲中某张的提示词
  const updateOutlinePrompt = (idx, text) => {
    setEcOutline(prev => prev.map((item, i) => i === idx ? { ...item, userPrompt: text } : item));
  };

  const startNewProduct = () => {
    generationTokenRef.current = null;
    generationAbortRef.current?.abort();
    generationAbortRef.current = null;
    const rotated = rotateEcommerceDraft({
      ownerEmail,
      surface: ECOMMERCE_DRAFT_SURFACES.XHS_ECOMMERCE,
      currentDraftId: ecDraftId,
      createDraftId: createEcommerceDraftId,
    });
    if (!rotated?.draftId) return;
    setEcDraftId(rotated.draftId);
    setEcResults(null);
    setInProgressPreview({});
    setEcLoadingMsg('');
    setEcName('');
    setGenPhase('config');
  };

  const doGenEC = async () => {
    if (!ecName.trim()) return;
    const generationToken = beginGeneration();
    if (!generationToken) {
      const contextError = createEcommerceGenerationPreconditionError();
      setErr(contextError.message);
      setGenECLoading(false);
      return;
    }
    const generationController = new AbortController();
    generationAbortRef.current = generationController;
    setErr('');
    setEcResults(null);
    setInProgressPreview({});
    dispatch({ type: 'START_GEN' });
    dispatch({ type: 'SET_STAGE', stage: 1 });
    setGenECLoading(true);
    setEcLoadingMsg('正在分析商品信息...');
    try {
      // 长描述和普通描述都走同一条电商任务链：统一 SSE、任务记录、额度和失败状态。
      // 长描述只把文本作为更多上下文，并减少默认输出为 5 张主视觉图。
      const isRaw = ecName.trim().length >= 80;
      setEcLoadingMsg(isRaw ? '正在按完整商品描述生成…' : '正在调用 AI 生成商品图...');
      const data = await generateEcommerce({
        productName: isRaw ? ecName.trim().slice(0, 120) : ecName.trim(),
        category: ecCat,
        platform: ecPlatform,
        points: [ecProductPoints, isRaw ? ecName.trim() : ''].filter(Boolean).join('\n'),
        refImgs: ecRefImgs,
        realShots: [],
        email: state.phone,
        material: ecMaterial,
        restrictions: ecRestrictions,
        imageSelections: isRaw ? [{ key: 'main_3x4', count: 5 }] : ecSelections,
        imageSize: null,
        draftId: ecDraftId,
        signal: generationController.signal,
        isCurrent: () => isGenerationCurrent(generationToken),
        onProgress: (task) => {
          if (!isGenerationCurrent(generationToken)) return;
          const progress = task?.message || task?.step || task?.assets?.find(asset => asset.userState)?.userState;
          if (progress) setEcLoadingMsg(progress);
        },
        onImage: (image) => {
          if (!isGenerationCurrent(generationToken)) return;
          const url = image?.stableUrl || image?.url;
          if (!image?.id || !url) return;
          setInProgressPreview(previous => mergeEcommerceInProgressPreview(previous, { ...image, url }));
          setEcLoadingMsg(`已生成: ${image.label || image.role || image.id}`);
        },
      });
      if (!isGenerationCurrent(generationToken)) return;
      const finalResult = acceptEcommerceFinalResult(data);
      if (!finalResult) throw new Error('任务尚未完成或没有稳定图片，请稍后继续生成');
      setEcResults({ ...finalResult, product_name: ecName.trim().slice(0, 80), raw_mode: isRaw });
      setInProgressPreview({});
      // 自动保存。保存失败不影响当前结果展示，但不吞掉生成任务错误。
      try {
        await saveWork({ ...finalResult, _ecResult: true, _saveKey: 'ec-' + Date.now(), product_name: ecName, category: ecCat, platform: ecPlatform, at: new Date().toLocaleDateString('zh-CN'), images: finalResult.images || {} }, state.phone, { signal: generationController.signal });
      } catch (saveError) { console.warn('[home ecommerce] 保存作品失败:', saveError.message); }
      if (!isGenerationCurrent(generationToken)) return;
      fetchCredits(state.phone);
      dispatch({ type: 'SET_STAGE', stage: 2 });
      await new Promise(r => setTimeout(r, 800));
      setGenECLoading(false);
      dispatch({ type: 'CLOSE_RESULT' });
      setGenPhase('result');
    } catch (e) {
      if (!isGenerationCurrent(generationToken)) return;
      const accessResult = handleGenerationAccessError(e, dispatch, {
        source: 'home-ecommerce',
        message: '当前商品图片、套图配置和提示词都已保留，充值后可以继续生成。',
      });
      setErr(accessResult ? '' : '生成失败: ' + (e.message || '未知错误'));
      setGenECLoading(false);
      dispatch({ type: 'CLOSE_RESULT' });
    } finally {
      if (isGenerationCurrent(generationToken)) {
        setGenECLoading(false);
        generationTokenRef.current = null;
        generationAbortRef.current = null;
      }
    }
  };

  // 单张重生成
  const doRegenerateImage = async (label, editedPrompt) => {
    if (ecRegeneratingKey) return;
    setEcRegeneratingKey(label);
    try {
      const prompt = editedPrompt || ecOutline.find(o => o.key === baseKey(label) || o.label === label)?.userPrompt || '';
      const url = await regenerateImage(prompt, ecCat);
      if (url) {
        setEcResults(prev => prev ? { ...prev, images: { ...prev.images, [label]: url } } : prev);
      }
    } catch (e) {
      setToast({ message: e.message || '重生成失败，请重试', type: 'error' });
    }
    setEcRegeneratingKey('');
    setEcRegenEdit({ label: null, prompt: '', visible: false });
  };

  // B4: SSE 流泄漏修复 — 组件卸载时 AbortController 中断
  const genAbortRef = useRef(null);
  useEffect(() => {
    return () => { if (genAbortRef.current) genAbortRef.current.abort(); };
  }, []);

  const doGenXHS = async () => {
    if (!inputText.trim()) return;
    const usePreview = !logged;
    let ownedStyleAssetIds = xhsReferenceAssetIds;
    let ownedSourceAssetIds = xhsSourceAssetIds;
    let referenceAssetIds = [...ownedStyleAssetIds, ...ownedSourceAssetIds];
    setErr('');
    dispatch({ type: 'START_GEN' });
    // 创建 AbortController 以便组件卸载时中断
    genAbortRef.current = new AbortController();
    try {
      if (!usePreview && (refImages.length || xhsSourceImages.length)) {
        const [styleUploads, sourceUploads] = await Promise.all([
          refImages.length ? uploadEcommerceAssets(refImages, 'style', { signal: genAbortRef.current.signal }) : Promise.resolve([]),
          xhsSourceImages.length ? uploadEcommerceAssets(xhsSourceImages, 'reference', { signal: genAbortRef.current.signal }) : Promise.resolve([]),
        ]);
        ownedStyleAssetIds = styleUploads.map(asset => asset.assetId);
        ownedSourceAssetIds = sourceUploads.map(asset => asset.assetId);
        referenceAssetIds = [...ownedStyleAssetIds, ...ownedSourceAssetIds];
        setXhsReferenceAssetIds(ownedStyleAssetIds);
        setXhsSourceAssetIds(ownedSourceAssetIds);
      }
      const result = await generateContent(inputText, usePreview ? refImages : [], {
        preview: usePreview,
        referenceAssets: {
          style: usePreview ? refImages : ownedStyleAssetIds,
          source: usePreview ? xhsSourceImages : ownedSourceAssetIds,
        },
        referenceAssetIds,
        signal: genAbortRef.current.signal,
        onProgress: (d) => {
          if (d.step === 'content_analysis' || d.step === 'visual_planning')
            dispatch({ type: 'SET_STAGE', stage: 1 });
          else if (d.step === 'generating_images')
            dispatch({ type: 'SET_STAGE', stage: 2 });
          else if (d.step === 'assembling')
            dispatch({ type: 'SET_STAGE', stage: 3 });
        },
      });
      const accepted = acceptAuthoritativeContentCompletion(result);
      if (!accepted) throw new Error('服务端尚未完成稳定作品交付，请稍后重试');
      dispatch({ type: 'SET_STAGE', stage: 4 });
      await new Promise(r => setTimeout(r, 800));
      const work = { ...accepted.result, _inputText: inputText, _saveKey: 'gen-' + Date.now(), _preview: usePreview, at: new Date().toLocaleDateString('zh-CN'), id: Date.now() };
      dispatch({ type: 'SET_RESULT', result: work });
      if (!usePreview) {
        await saveWork(work, state.phone).catch(() => null);
        await refreshBillingBalance().catch(() => undefined);
        dispatch({ type: 'CLEAR_PAYWALL' });
      }
    } catch (e) {
      const accessResult = handleGenerationAccessError(e, dispatch, {
        source: 'xhs-content',
        currency: 'ec_points',
        draftId: xhsContentDraftId,
        action: buildContentPendingAction({
          type: 'xhs-content',
          draftId: xhsContentDraftId,
          referenceAssetIds,
          billingCurrency: 'ec_points',
        }),
      });
      setErr(accessResult ? '' : (e.message || '生成失败'));
      dispatch({ type: 'CLOSE_RESULT' });
    }
  };

  const doGenPlog = async () => {
    if (!plogText.trim()) return;
    const usePreview = !logged;
    let ownedStyleAssetIds = homePlogReferenceAssetIds;
    let ownedSourceAssetIds = homePlogSourceAssetIds;
    let referenceAssetIds = [...ownedStyleAssetIds, ...ownedSourceAssetIds];
    setErr('');
    dispatch({ type: 'START_GEN' });
    try {
      if (!usePreview && (plogStyleImages.length || plogSourceImages.length)) {
        const [styleUploads, sourceUploads] = await Promise.all([
          plogStyleImages.length ? uploadEcommerceAssets(plogStyleImages, 'style') : Promise.resolve([]),
          plogSourceImages.length ? uploadEcommerceAssets(plogSourceImages, 'reference') : Promise.resolve([]),
        ]);
        ownedStyleAssetIds = styleUploads.map(asset => asset.assetId);
        ownedSourceAssetIds = sourceUploads.map(asset => asset.assetId);
        referenceAssetIds = [...ownedStyleAssetIds, ...ownedSourceAssetIds];
        setHomePlogReferenceAssetIds(ownedStyleAssetIds);
        setHomePlogSourceAssetIds(ownedSourceAssetIds);
      }
      const result = await generatePlogContent({
        text: plogText.trim(),
        style: plogStyle,
        layout: plogLayout,
        coverVariant: 'collage',
        referenceAssets: {
          style: usePreview ? plogStyleImages : ownedStyleAssetIds,
          source: usePreview ? plogSourceImages : ownedSourceAssetIds,
        },
        referenceAssetIds,
        preview: usePreview,
      }, {
        onProgress: d => {
          const stageMap = { scene: 1, lens: 1, tone: 1, generating: 2 };
          dispatch({ type: 'SET_STAGE', stage: stageMap[d.step] || 1 });
        },
        onImage: () => dispatch({ type: 'SET_STAGE', stage: 2 }),
      });
      const accepted = acceptAuthoritativeContentCompletion(result);
      if (!accepted) throw new Error('服务端尚未完成稳定作品交付，请稍后重试');
      const work = { ...accepted.result, _plogResult: true, _preview: usePreview, _saveKey: 'plog-' + Date.now(), images: { cover: accepted.result.cover_url } };
      dispatch({ type: 'SET_RESULT', result: work });
      if (logged) {
        await saveWork(work, state.phone).catch(() => null);
        await refreshBillingBalance().catch(() => undefined);
        dispatch({ type: 'CLEAR_PAYWALL' });
      }
    } catch (e) {
      const accessResult = handleGenerationAccessError(e, dispatch, {
        source: 'xhs-plog',
        currency: 'ec_points',
        draftId: homePlogDraftId,
        action: buildContentPendingAction({
          type: 'xhs-plog',
          draftId: homePlogDraftId,
          referenceAssetIds,
          billingCurrency: 'ec_points',
        }),
      });
      setErr(accessResult ? '' : (e.message || '生成失败'));
      dispatch({ type: 'CLOSE_RESULT' });
    }
  };

  const addRefImage = (files, setter, current, max) => {
    Array.from(files).slice(0, max - current.length).forEach(f => {
      const reader = new FileReader();
      reader.onload = (ev) => setter(p => p.length >= max ? p : [...p, ev.target.result]);
      reader.readAsDataURL(f);
    });
  };

  const addRoleImages = (role, files) => {
    const style = role === 'style';
    if (style) setXhsReferenceAssetIds([]);
    else setXhsSourceAssetIds([]);
    addRefImage(files, style ? setRefImages : setXhsSourceImages, style ? refImages : xhsSourceImages, style ? 3 : 6);
  };

  const removeRoleImage = (role, index) => {
    const style = role === 'style';
    (style ? setRefImages : setXhsSourceImages)(current => current.filter((_, itemIndex) => itemIndex !== index));
    (style ? setXhsReferenceAssetIds : setXhsSourceAssetIds)([]);
  };

  const addPlogRoleImages = (role, files) => {
    const style = role === 'style';
    if (style) setHomePlogReferenceAssetIds([]);
    else setHomePlogSourceAssetIds([]);
    addRefImage(files, style ? setPlogStyleImages : setPlogSourceImages, style ? plogStyleImages : plogSourceImages, style ? 3 : 6);
  };

  const removePlogRoleImage = (role, index) => {
    const style = role === 'style';
    (style ? setPlogStyleImages : setPlogSourceImages)(current => current.filter((_, itemIndex) => itemIndex !== index));
    (style ? setHomePlogReferenceAssetIds : setHomePlogSourceAssetIds)([]);
  };

  const isXHS = mode === 'content';

  /* ═════ compactMode: 纯 XHS 输入表单（灵图AI下拉面板风格）═════ */
  if (compactMode) {
    // 灵图AI风格下拉面板样式
    const panelStyle = {
      background: '#fff',
      borderRadius: 16,
      boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
      border: '1px solid rgba(0,0,0,0.06)',
      padding: '16px',
      marginTop: 8,
      animation: 'fadeIn 0.15s ease',
    };
    // 灵图AI风格选项按钮
    const optBtn = (active, accentColor) => ({
      padding: '8px 14px',
      borderRadius: 10,
      border: active ? `1.5px solid ${accentColor || 'var(--accent)'}` : '1.5px solid transparent',
      background: active ? (accentColor || 'var(--accent)') : 'rgba(0,0,0,0.04)',
      color: active ? '#fff' : 'var(--text-muted)',
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer',
      fontFamily: 'inherit',
      transition: 'all 0.12s',
      textAlign: 'center',
    });
    // 灵图AI风格标签文字
    const labelStyle = { fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10, letterSpacing: 0.2 };

    return (
      <div>
        <CreationShowcase mode="content" subMode={xhsSubMode} />
        {/* ═══ 白色卡片（标签在白色上）═══ */}
        <div style={{
          borderRadius: 20, margin: '0 16px',
          background: '#fff',
          padding: '20px 20px 20px',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* 子模式标签 — 在渐变区内 */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            <button onClick={() => setXhsSubMode('content')}
              style={{
                padding: '9px 20px', borderRadius: 20,
                border: 'none',
                background: xhsSubMode === 'content' ? '#1a1a1a' : 'rgba(0,0,0,0.05)',
                color: xhsSubMode === 'content' ? '#fff' : '#666',
                fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.2s',
                boxShadow: xhsSubMode === 'content' ? 'inset 0 1px 3px rgba(0,0,0,0.2)' : 'none',
              }}
              onMouseEnter={e => { if (xhsSubMode !== 'content') { e.currentTarget.style.background = 'rgba(0,0,0,0.10)'; e.currentTarget.style.color = '#333'; } }}
              onMouseLeave={e => { if (xhsSubMode !== 'content') { e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; e.currentTarget.style.color = '#666'; } }}>
              📝 种草图文
            </button>
            <button onClick={() => setXhsSubMode('plog')}
              style={{
                padding: '9px 20px', borderRadius: 20,
                border: 'none',
                background: xhsSubMode === 'plog' ? '#1a1a1a' : 'rgba(0,0,0,0.05)',
                color: xhsSubMode === 'plog' ? '#fff' : '#666',
                fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.2s',
                boxShadow: xhsSubMode === 'plog' ? 'inset 0 1px 3px rgba(0,0,0,0.2)' : 'none',
              }}
              onMouseEnter={e => { if (xhsSubMode !== 'plog') { e.currentTarget.style.background = 'rgba(0,0,0,0.10)'; e.currentTarget.style.color = '#333'; } }}
              onMouseLeave={e => { if (xhsSubMode !== 'plog') { e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; e.currentTarget.style.color = '#666'; } }}>
              📸 Plog 生活碎片
            </button>
          </div>

          {/* ── 种草图文 ── */}
          {xhsSubMode === 'content' && (
            <div style={{ flex:1, display:'flex', flexDirection:'column' }}>
              <div style={{ display:'grid', gridTemplateColumns:'130px minmax(0,1fr)', gap:12, flex:1, borderRadius:16, padding:'4px', background:'linear-gradient(90deg, #FAF0E4 0%, #FBF3EA 50%, #FDF9F5 75%, #FFFFFF 100%)' }}>
                <div style={{ gridColumn:'1 / -1' }}>
                  <XhsSupplementDeck styleImages={refImages} sourceImages={xhsSourceImages} onAdd={addRoleImages} onRemove={removeRoleImage} />
                </div>
                <div className="ec-textarea-wrap" style={{ flex:1, display:'flex', flexDirection:'column', padding:'12px 20px 12px 8px' }}>
                  {!inputText && (
                    <div className="ec-textarea-placeholder" style={{ fontSize:15, lineHeight:'28px' }}>
                      <span className="ec-placeholder-line"><span className="ec-cursor" aria-hidden="true"></span>写什么？一句话就够了</span>
                      <span className="ec-placeholder-line" style={{ marginTop:28 }}>例：厦门3天2夜旅游攻略</span>
                      <span className="ec-placeholder-line">例：平价好用的防晒霜推荐</span>
                      <span className="ec-placeholder-line">例：独居女生的晚间护肤流程</span>
                    </div>
                  )}
                  <textarea ref={xhsPromptRef} value={inputText} onChange={e => { setText(e.target.value); setErr(''); }}
                    className={!inputText ? 'ec-empty' : ''}
                    style={{
                      width:'100%', flex:1, minHeight:180, border:'none', background:'transparent',
                      fontSize:15, lineHeight:'28px', color:'var(--text-primary)',
                      outline:'none', resize:'none', fontFamily:'inherit',
                      position:'relative', zIndex:1,
                    }} />
                </div>
              </div>
              <div style={{ display:'flex', gap:8, marginTop:8, flexWrap:'wrap', alignItems:'center' }}>
                <ImageMentionPicker
                  images={xhsMentionImages}
                  selectionMode="insert"
                  onToggle={image => insertMentionInTextarea(xhsPromptRef, inputText, setText, image.label)}
                />
              </div>
            </div>
          )}

          {/* ── Plog ── */}
          {xhsSubMode === 'plog' && (
            <div style={{ flex:1, display:'flex', flexDirection:'column' }}>
              <div style={{ display:'grid', gridTemplateColumns:'130px minmax(0,1fr)', gap:12, flex:1, borderRadius:16, padding:'4px', background:'linear-gradient(90deg, #FAF0E4 0%, #FBF3EA 50%, #FDF9F5 75%, #FFFFFF 100%)' }}>
                <div style={{ gridColumn:'1 / -1' }}>
                  <XhsSupplementDeck plog styleImages={plogStyleImages} sourceImages={plogSourceImages} onAdd={addPlogRoleImages} onRemove={removePlogRoleImage} />
                </div>
                <div className="ec-textarea-wrap" style={{ flex:1, display:'flex', flexDirection:'column', padding:'12px 20px 12px 8px' }}>
                  {!plogText && (
                    <div className="ec-textarea-placeholder" style={{ fontSize:15, lineHeight:'28px' }}>
                      <span className="ec-placeholder-line"><span className="ec-cursor" aria-hidden="true"></span>描述你想记录的生活瞬间</span>
                      <span className="ec-placeholder-line" style={{ marginTop:28 }}>例：周末午后，阳光洒进房间，猫趴在窗台打盹</span>
                      <span className="ec-placeholder-line">例：下班路上买了一束花，回家插在玻璃瓶里</span>
                      <span className="ec-placeholder-line">例：雨天窝在沙发上看书喝热可可</span>
                    </div>
                  )}
                  <textarea ref={plogPromptRef} value={plogText} onChange={e => setPlogText(e.target.value)}
                    className={!plogText ? 'ec-empty' : ''}
                    style={{
                      width:'100%', flex:1, minHeight:180, border:'none', background:'transparent',
                      fontSize:15, lineHeight:'28px', color:'var(--text-primary)',
                      outline:'none', resize:'none', fontFamily:'inherit',
                      position:'relative', zIndex:1,
                    }} />
                </div>
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:8 }}>
                <ImageMentionPicker
                  images={plogMentionImages}
                  selectionMode="insert"
                  onToggle={image => insertMentionInTextarea(plogPromptRef, plogText, setPlogText, image.label)}
                />
              </div>
            </div>
          )}

          {/* ═══ 底栏按钮 — 灵图风格 ═══ */}
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'12px 2px 14px', marginTop:8,
            borderTop: '1px solid var(--border-light)',
          }}>
            {/* Left: 热门主题 / Plog设置 按钮 — 深色框 */}
            <div style={{ flex:1 }}>
              {xhsSubMode === 'content' && (
                <button onClick={() => setTopicsOpen(!topicsOpen)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    height: 36, padding: '0 16px',
                    borderRadius: 'var(--radius-full)',
                    border: '2px solid rgba(0,0,0,0.15)',
                    background: topicsOpen ? '#1a1a1a' : 'rgba(0,0,0,0.04)',
                    fontSize: 13, fontWeight: 600,
                    color: topicsOpen ? '#fff' : '#444',
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all 0.2s',
                    boxShadow: topicsOpen ? 'inset 0 1px 3px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                  onMouseEnter={e => { if (!topicsOpen) { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.3)'; e.currentTarget.style.background = 'rgba(0,0,0,0.08)'; } }}
                  onMouseLeave={e => { if (!topicsOpen) { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.15)'; e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; } }}>
                  <MdLightbulb size={15} /> 热门主题
                  <MdExpandMore size={13} style={{ transform: topicsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
              )}
              {xhsSubMode === 'plog' && (
                <button onClick={() => setPlogOptionsOpen(!plogOptionsOpen)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    height: 36, padding: '0 16px',
                    borderRadius: 'var(--radius-full)',
                    border: '2px solid rgba(0,0,0,0.15)',
                    background: plogOptionsOpen ? '#1a1a1a' : 'rgba(0,0,0,0.04)',
                    fontSize: 13, fontWeight: 600,
                    color: plogOptionsOpen ? '#fff' : '#444',
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all 0.2s',
                    boxShadow: plogOptionsOpen ? 'inset 0 1px 3px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                  onMouseEnter={e => { if (!plogOptionsOpen) { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.3)'; e.currentTarget.style.background = 'rgba(0,0,0,0.08)'; } }}
                  onMouseLeave={e => { if (!plogOptionsOpen) { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.15)'; e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; } }}>
                  <MdPalette size={15} /> Plog 设置
                  <MdExpandMore size={13} style={{ transform: plogOptionsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
              )}
            </div>

            {/* Right: 生成按钮 — 彩色AI渐变风格 */}
            <button onClick={xhsSubMode === 'content' ? doGenXHS : doGenPlog}
              disabled={xhsSubMode === 'content' ? !inputText.trim() : !plogText.trim()}
              style={{
                width:42, height:42, borderRadius:'50%', border:'none',
                background: (xhsSubMode === 'content' ? !inputText.trim() : !plogText.trim())
                  ? '#ddd'
                  : 'linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #f59e0b 100%)',
                color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
                cursor: (xhsSubMode === 'content' ? !inputText.trim() : !plogText.trim()) ? 'not-allowed' : 'pointer',
                transition:'all 0.2s',
                boxShadow: (xhsSubMode === 'content' ? !inputText.trim() : !plogText.trim())
                  ? 'none'
                  : '0 4px 20px rgba(124,58,237,0.35), 0 2px 6px rgba(236,72,153,0.2)',
                flexShrink: 0,
              }}
              onMouseEnter={e => { if (!(xhsSubMode === 'content' ? !inputText.trim() : !plogText.trim())) { e.currentTarget.style.boxShadow = '0 6px 28px rgba(124,58,237,0.45), 0 3px 10px rgba(236,72,153,0.3)'; e.currentTarget.style.transform = 'scale(1.06)'; } }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = (xhsSubMode === 'content' ? !inputText.trim() : !plogText.trim()) ? 'none' : '0 4px 20px rgba(124,58,237,0.35), 0 2px 6px rgba(236,72,153,0.2)'; e.currentTarget.style.transform = 'none'; }}>
              <MdAutoAwesome size={18} fill="#fff" />
            </button>
          </div>

          {/* ═══ 热门主题下拉面板 — 灵图AI风格 ═══ */}
          {xhsSubMode === 'content' && topicsOpen && (
            <div style={panelStyle}>
              <div style={labelStyle}>💡 点击主题快速填入</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {QUICK_HINTS.map((h, i) => (
                  <button key={i} onClick={() => { setText(h); setTopicsOpen(false); }}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 10,
                      border: '1.5px solid rgba(0,0,0,0.06)',
                      background: '#fff',
                      fontSize: 13, fontWeight: 500,
                      cursor: 'pointer', fontFamily: 'inherit',
                      color: 'var(--text-secondary)',
                      transition: 'all 0.12s',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = '#f8f3ea'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)'; e.currentTarget.style.background = '#fff'; }}>
                    {h}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ═══ Plog 设置下拉面板 — 灵图AI风格 ═══ */}
          {xhsSubMode === 'plog' && plogOptionsOpen && (
            <div style={panelStyle}>
              <div style={labelStyle}>🎨 色调风格</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom: 16 }}>
                {[
                  { k:'ins-minimal', label:'🤍 Ins极简', c:'#555' },
                  { k:'korean-clear', label:'💎 韩系清透', c:'#4A6FA5' },
                  { k:'japanese-cream', label:'🍦 日系奶油', c:'#B8956A' },
                  { k:'film-vintage', label:'🎞️ 胶片复古', c:'#8B6F47' },
                ].map(s => (
                  <button key={s.k} onClick={() => setPlogStyle(s.k)}
                    style={optBtn(plogStyle === s.k, s.c)}>
                    {s.label}
                  </button>
                ))}
              </div>
              <div style={labelStyle}>📐 排版样式</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {[
                  { k:'casual', label:'📸 碎片风' },
                  { k:'polaroid', label:'📷 拍立得' },
                  { k:'cinematic', label:'🎬 电影感' },
                  { k:'journal', label:'📔 手账风' },
                  { k:'magazine', label:'✨ 杂志风' },
                ].map(t => (
                  <button key={t.k} onClick={() => setPlogLayout(t.k)}
                    style={optBtn(plogLayout === t.k, '#BE185D')}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {err && <div style={{ padding:'8px 14px', margin:'4px 16px 0', background:'#FEF2F0', borderRadius:10, color:'var(--red)', fontSize:13, fontWeight:600 }}>{err}</div>}
      </div>
    );
  }

  return (
    <div style={inlineMode ? { position: 'relative', zIndex: 10 } : { minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Toast 通知 */}
      {toast && (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
          background: toast.type === 'success' ? '#065F46' : '#991B1B',
          color: '#fff', padding: '12px 24px', borderRadius: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          fontSize: 14, fontWeight: 500, maxWidth: '90vw',
          animation: 'slideDown 0.3s ease',
        }}>{toast.message}</div>
      )}
      {/* 商品反推加载遮罩 */}
      {extractingProduct && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(255,255,255,0.9)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
        }}>
          <div className="loading-spinner" style={{
            width: 40, height: 40, border: '3px solid #E5E7EB', borderTopColor: '#6366F1',
            borderRadius: '50%', animation: 'spin 0.8s linear infinite',
          }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: '#374151' }}>🔄 正在分析商品图片...</div>
          <div style={{ fontSize: 12, color: '#9CA3AF' }}>AI 正在识别类目、风格、颜色、材质等参数</div>
        </div>
      )}
      <section className="hero-section" style={{ paddingTop: 40 }}>
        <div style={{
          display:'inline-flex', alignItems:'center', gap:4,
          padding:'3px 12px', borderRadius:20, background:'#FFF0F0', color:'#e84142',
          fontSize:11, fontWeight:600, letterSpacing:0.5, marginBottom:12,
        }}>
          <span style={{ width:5, height:5, borderRadius:'50%', background:'#e84142', display:'inline-block' }} />
          AI 图文创作工具
        </div>
        <h1 className="hero-title">AI 一键生成<span className="hero-accent">电商商品图</span></h1>
        <p className="hero-sub">电商卖家用它出商品图，小红书博主用它做图文</p>
        <div className="mode-tabs">
          <button className={`mode-tab ${isXHS ? 'active-xhs' : ''}`} onClick={() => setMode('content')}><MdEdit size={14} /> 小红书图文</button>
          <button className={`mode-tab ${!isXHS ? 'active-ec' : ''}`} onClick={() => setMode('ecommerce')}><MdShoppingCart size={14} /> 电商商品图</button>
        </div>
        <div className="input-area">
          <div className={`input-card ${isXHS ? 'xhs-border' : 'ec-border'}`}>
            <div className="input-header">
              <div className={`input-dot ${isXHS ? 'red' : 'blue'}`} />
              <span>{isXHS ? '输入主题，一键生成' : '输入商品信息，生成商品图'}</span>
            </div>

            {isXHS && (
              <div>
                {/* 子模式切换 */}
                <div style={{ display:'flex', gap:3, margin:'12px 16px', padding:3, background:'#e8e8e8', borderRadius:10 }}>
                  <div onClick={() => setXhsSubMode('content')}
                    style={{
                      flex:1, padding:'8px 0', borderRadius:7, cursor:'pointer', fontSize:12, fontWeight:500,
                      textAlign:'center', transition:'all .12s', letterSpacing:0.3,
                      background: xhsSubMode === 'content' ? '#fff' : 'transparent',
                      color: xhsSubMode === 'content' ? '#e84142' : '#888',
                      boxShadow: xhsSubMode === 'content' ? '0 1px 6px rgba(0,0,0,0.12)' : 'none',
                      border: xhsSubMode === 'content' ? '1px solid rgba(0,0,0,0.04)' : '1px solid transparent',
                      position:'relative',
                    }}
                    onMouseEnter={e => { if(xhsSubMode !== 'content') e.currentTarget.style.background = '#f0f0f0'; }}
                    onMouseLeave={e => { if(xhsSubMode !== 'content') e.currentTarget.style.background = 'transparent'; }}>
                    种草图文
                    <div style={{
                      position:'absolute', bottom:-1, left:'50%', transform:'translateX(-50%)',
                      width: xhsSubMode === 'content' ? 16 : 0, height:2.5, borderRadius:2,
                      background:'#e84142', transition:'all .2s',
                    }} />
                  </div>
                  <div onClick={() => setXhsSubMode('plog')}
                    style={{
                      flex:1, padding:'8px 0', borderRadius:7, cursor:'pointer', fontSize:12, fontWeight:500,
                      textAlign:'center', transition:'all .12s', letterSpacing:0.3,
                      background: xhsSubMode === 'plog' ? '#fff' : 'transparent',
                      color: xhsSubMode === 'plog' ? '#c2185b' : '#888',
                      boxShadow: xhsSubMode === 'plog' ? '0 1px 6px rgba(0,0,0,0.12)' : 'none',
                      border: xhsSubMode === 'plog' ? '1px solid rgba(0,0,0,0.04)' : '1px solid transparent',
                      position:'relative',
                    }}
                    onMouseEnter={e => { if(xhsSubMode !== 'plog') e.currentTarget.style.background = '#f0f0f0'; }}
                    onMouseLeave={e => { if(xhsSubMode !== 'plog') e.currentTarget.style.background = 'transparent'; }}>
                    Plog 生活碎片
                    <div style={{
                      position:'absolute', bottom:-1, left:'50%', transform:'translateX(-50%)',
                      width: xhsSubMode === 'plog' ? 16 : 0, height:2.5, borderRadius:2,
                      background:'#c2185b', transition:'all .2s',
                    }} />
                  </div>
                </div>
                {xhsSubMode === 'content' && (
                  <div>
                    <div className="hero-textarea-wrap">
                      <textarea ref={xhsPromptRef} className="hero-textarea" value={inputText} onChange={e => setText(e.target.value)} placeholder=" " />
                      <div className="custom-placeholder">
                        <div className="ph-main">✍️ 在这里输入创作主题，一句话就够了…</div>
                        <div className="ph-sub">例如：厦门3天2夜旅游攻略、百元蓝牙耳机测评</div>
                      </div>
                    </div>
                    <XhsSupplementDeck styleImages={refImages} sourceImages={xhsSourceImages} onAdd={addRoleImages} onRemove={removeRoleImage} />
                    <div className="ref-images-row">
                      <ImageMentionPicker
                        images={xhsMentionImages}
                        selectionMode="insert"
                        onToggle={image => insertMentionInTextarea(xhsPromptRef, inputText, setText, image.label)}
                      />
                      <span className="ref-hint">素材会保留主体，风格参考只影响视觉方法</span>
                    </div>
                    <div className="tags-cloud-wrap">
                      <div className="tags-hint"><span>💡 试试这些热门主题，点击即可填入</span></div>
                      <div className="tags-cloud">{QUICK_HINTS.map((h, i) => (<button key={i} className="hint-tag" onClick={() => setText(h)}>{h}</button>))}</div>
                    </div>
                    {err && <div className="error-bar">{err}</div>}
                    <button className="gen-btn xhs" onClick={doGenXHS} disabled={!inputText.trim()}>
                      <MdAutoAwesome size={14} /> {!logged ? '免费预览（文案+封面）' : unlimited ? '一键生成爆款图文' : '一键生成爆款图文'}
                    </button>
                    <div className="gen-hint">{!logged ? '免费预览：生成文案和 1 张封面，不消耗 AI 积分' : unlimited ? '完整图文包含文章与 9 张配图' : `剩余 ${ecPoints ?? 0} AI 积分 · 完整 9 图套装 = 9 AI 积分`}</div>
                  </div>
                )}
                {xhsSubMode === 'plog' && (
                  <div>
                    {/* 输入 */}
                    <div className="hero-textarea-wrap">
                      <textarea ref={plogPromptRef} className="hero-textarea" value={plogText} onChange={e => setPlogText(e.target.value)} placeholder=" " />
                      <div className="custom-placeholder">
                        <div className="ph-main">📝 描述你的生活场景</div>
                        <div className="ph-sub">例如：独居日常｜周末宅家看书喝咖啡</div>
                      </div>
                    </div>
                    <XhsSupplementDeck plog styleImages={plogStyleImages} sourceImages={plogSourceImages} onAdd={addPlogRoleImages} onRemove={removePlogRoleImage} />
                    <div className="ref-images-row" style={{ borderBottom:'none', padding:'12px 16px', background:'#FAFBFC', borderTop:'1.5px solid var(--border)' }}>
                      <ImageMentionPicker
                        images={plogMentionImages}
                        selectionMode="insert"
                        onToggle={image => insertMentionInTextarea(plogPromptRef, plogText, setPlogText, image.label)}
                      />
                      <span style={{ fontSize:13, color:'#999' }}>生活素材用于保留真实主体，风格参考用于统一视觉气质</span>
                    </div>
                    {/* 风格 + 排版设置 */}
                    <div className="tags-cloud-wrap" style={{ borderTop:'none', padding:'8px 16px 10px' }}>
                      <div className="tags-hint"><span>🎨 选择色调风格</span></div>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
                        {[
                          { k:'ins-minimal', label:'🤍 Ins极简', color:'#555' },
                          { k:'korean-clear', label:'💎 韩系清透', color:'#4A6FA5' },
                          { k:'japanese-cream', label:'🍦 日系奶油', color:'#B8956A' },
                          { k:'film-vintage', label:'🎞️ 胶片复古', color:'#8B6F47' },
                        ].map(s => {
                          const active = plogStyle === s.k;
                          return (
                            <div key={s.k} onClick={() => setPlogStyle(s.k)}
                              style={{
                                padding:'4px 10px', borderRadius:8, cursor:'pointer', fontSize:11, whiteSpace:'nowrap',
                                transition:'all .12s', lineHeight:'20px',
                                background: active ? s.color : '#f5f5f5',
                                color: active ? '#fff' : '#666',
                                boxShadow: active ? '0 1px 4px ' + s.color + '50' : 'none',
                                border: active ? '1px solid ' + s.color : '1px solid #eee',
                              }}
                              onMouseEnter={e => { if(!active) { e.currentTarget.style.borderColor = '#ccc'; } }}
                              onMouseLeave={e => { if(!active) { e.currentTarget.style.borderColor = '#eee'; } }}>
                              {s.label}
                            </div>
                          );
                        })}
                      </div>
                      <div className="tags-hint" style={{ marginTop:4 }}><span>📐 选择排版样式</span></div>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                        {[
                          { k:'casual', label:'📸 碎片风' },
                          { k:'polaroid', label:'📷 拍立得' },
                          { k:'cinematic', label:'🎬 电影感' },
                          { k:'journal', label:'📔 手账风' },
                          { k:'magazine', label:'✨ 杂志风' },
                        ].map(t => {
                          const active = plogLayout === t.k;
                          return (
                            <div key={t.k} onClick={() => setPlogLayout(t.k)}
                              style={{
                                padding:'4px 10px', borderRadius:8, cursor:'pointer', fontSize:11, transition:'all .12s',
                                background: active ? '#BE185D' : '#fff',
                                color: active ? '#fff' : '#BE185D',
                                border: active ? '1px solid #BE185D' : '1px solid #f0d4df',
                                fontWeight: active ? 600 : 400,
                              }}
                              onMouseEnter={e => { if(!active) { e.currentTarget.style.background = '#fdf2f8'; e.currentTarget.style.borderColor = '#BE185D'; } }}
                              onMouseLeave={e => { if(!active) { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#f0d4df'; } }}>
                              {t.label}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {err && <div className="error-bar">{err}</div>}
                    <button className="gen-btn xhs" onClick={doGenPlog} disabled={!plogText.trim()}
                      style={{ background: !plogText.trim() ? 'var(--border)' : 'linear-gradient(135deg,#BE185D,#DB2777)' }}>
                      🎨 生成{['碎片风','拍立得','电影感','手账风','杂志风'][['casual','polaroid','cinematic','journal','magazine'].indexOf(plogLayout)] || '碎片风'} Plog
                    </button>
                    <div className="gen-hint">{!plogText.trim() ? '✏️ 输入场景描述后即可生成 9 张生活碎片' : '✨ 1套 = 9 张 Plog 碎片 + 情绪文案'}</div>
                  </div>
                )}

              </div>
            )}

            {!isXHS && (
              <div style={{ padding:'0 0 16px' }}>
                {/* 平台选择 — 横向滑动 */}
                <div style={{ display:'flex', gap:8, padding:'14px 16px', borderBottom:'1.5px solid var(--border)', background:'#FAFBFC', alignItems:'center', overflowX:'auto', flexWrap:'nowrap', WebkitOverflowScrolling:'touch' }}>
                  {['淘宝','京东','拼多多','抖音','小红书','亚马逊'].map(p => (
                    <span key={p} className={`ec-cat-pill ${ecPlatform === p ? 'on' : ''}`} onClick={() => setEcPlatform(p)}
                      style={{ flexShrink:0 }}>
                      {p === '淘宝' ? '🟠' : p === '京东' ? '🛒' : p === '拼多多' ? '🟢' : p === '抖音' ? '🎵' : p === '小红书' ? '📕' : '🌐'} {p}
                    </span>
                  ))}
                  <span style={{ marginLeft:'auto', fontSize:12, color:'#4338CA', cursor:'pointer', whiteSpace:'nowrap', padding:'5px 12px', borderRadius:6, background:'#EEF2FF', fontWeight:500, transition:'all 0.12s', border:'1px solid #C7D2FE', flexShrink:0 }}
                    onClick={() => dispatch({ type:'NAVIGATE', page:'ec-studio' })}
                    onMouseEnter={e => { e.currentTarget.style.background = '#C7D2FE'; e.currentTarget.style.borderColor = '#818CF8'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#EEF2FF'; e.currentTarget.style.borderColor = '#C7D2FE'; }}>
                    🔧 精修工坊
                  </span>
                </div>

                {/* 输入框 */}
                <div className="hero-textarea-wrap">
                  <textarea className="hero-textarea" value={ecName} onChange={e => setEcName(e.target.value)} placeholder=" " />
                  <div className="custom-placeholder">
                    <div className="ph-main">
                      ✍️ 描述你的商品，AI 自动生成全套商品图
                    </div>
                    <div className="ph-sub">
                      例如：白色陶瓷杯简约办公风、无线蓝牙耳机入耳式...<br />
                      也可输入详细描述，AI按需求生成全套商品图
                    </div>
                  </div>
                </div>

                {/* 参考图 — 弹窗上传 */}
                <div className="ref-images-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
                    <button onClick={() => setShowRefModal(true)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 14px', borderRadius: 8,
                        border: '1px solid #e0e0e0', background: '#fff',
                        cursor: 'pointer', fontSize: 12, color: '#555',
                        fontFamily: 'inherit', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#4338CA'; e.currentTarget.style.color = '#4338CA'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0e0e0'; e.currentTarget.style.color = '#555'; }}>
                      <Upload size={13} /> 上传商品参考图
                      {ecRefImgs.length > 0 && <span style={{ background: '#EEF2FF', color: '#4338CA', fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 10 }}>{ecRefImgs.length}</span>}
                    </button>
                    <span className="ref-hint">正面照最有用，1 张也能出图</span>
                  </div>
                  {ecRefImgs.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, overflowX: 'auto', paddingBottom: 4, flexWrap: 'nowrap' }}>
                      {ecRefImgs.map((src, i) => (
                        <div key={i} style={{ position:'relative', width:68, height:68, borderRadius:8, overflow:'hidden', border:'1px solid #e0e0e0', flexShrink:0, cursor:'pointer' }}
                          onClick={() => setEcPreviewLightbox(src)}>
                          <img src={src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                          <div onClick={e => { e.stopPropagation(); setEcRefImgs(p => p.filter((_, j) => j !== i)); }}
                            style={{ position:'absolute', top:2, right:2, width:18, height:18, borderRadius:'50%', background:'#FF4757', color:'#fff', fontSize:10, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', border:'none', fontWeight:700, lineHeight:1, boxShadow:'0 1px 3px rgba(0,0,0,0.3)' }}>×</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 卖点+材质 — 与 tags-cloud-wrap 相同的 padding 和分隔线 */}
                <div style={{ display:'flex', gap:10, padding:'12px 16px', borderBottom:'1.5px solid var(--border)' }}>
                    <input className="ec-link-input" value={ecProductPoints} onChange={e => setEcProductPoints(e.target.value)}
                    placeholder="卖点（逗号分隔）例如：高保湿, 24小时持久" style={{ flex:2 }} />
                  <input className="ec-link-input" value={ecMaterial} onChange={e => setEcMaterial(e.target.value)}
                    placeholder="材质/规格（选填）" style={{ flex:1 }} />
                </div>

                {err && <div className="error-bar">{err}</div>}
                <button className="gen-btn" onClick={doGenEC} disabled={!ecName.trim() || genECLoading}
                  style={{ margin:'12px 16px', width:'calc(100% - 32px)', display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'11px 24px', border:'none', borderRadius:10, background: genECLoading ? '#999' : '#4338CA', color:'#fff', fontSize:14, fontWeight:600, cursor: genECLoading ? 'not-allowed' : 'pointer', fontFamily:'inherit', boxShadow: genECLoading ? 'none' : '0 4px 16px rgba(67,56,202,0.25)' }}>
                  <MdAutoAwesome size={15} /> {genECLoading ? '生成中...' : '一键生成全套电商图'}
                </button>
                <div className="gen-hint" style={{ padding:'0 16px', marginTop:8, color:'#888', fontSize:12 }}>
                  {!ecName.trim() ? '输入商品描述，AI自动生成全套商品图' :
                   ecName.trim().length >= 80 ? '📝 详细模式 · 按描述精确执行' :
                   '📐 标准模式 · AI 自动生成全套套图'}
                </div>

                {genECLoading && (
                  <div style={{ margin:'12px 16px', padding:'14px 16px', background:'#F5F3FF', borderRadius:10, textAlign:'center' }}>
                    <div style={{ width:32, height:32, border:'2px solid #E0E7FF', borderTopColor:'#4338CA', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 10px' }} />
                    <div style={{ fontSize:13, color:'#4338CA', fontWeight:500 }}>{ecLoadingMsg}</div>
                    {Object.keys(inProgressPreview).length > 0 && (
                      <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center', marginTop:12 }}>
                        {Object.values(inProgressPreview).map(image => (
                          <img key={image.id} src={proxyImg(image.url)} alt={image.label || image.role || image.id}
                            style={{ width:74, height:74, objectFit:'cover', borderRadius:8 }} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {!genECLoading && Object.keys(inProgressPreview).length > 0 && (
                  <div style={{ margin:'12px 16px', padding:'12px 14px', background:'#F8FAFF', borderRadius:10, border:'1px solid #C7D2FE' }}>
                    <div style={{ fontSize:12, color:'#4338CA', fontWeight:600, marginBottom:8 }}>生成中预览 · 任务仍可继续</div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      {Object.values(inProgressPreview).map(image => (
                        <img key={image.id} src={proxyImg(image.url)} alt={image.label || image.role || image.id}
                          style={{ width:82, height:82, objectFit:'cover', borderRadius:8 }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {!isXHS && genPhase === 'result' && ecResults && (
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <div style={{ fontSize:15, fontWeight:600, color:'#059669' }}>✅ 生成完成</div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={startNewProduct}
                      style={{ padding:'6px 14px', borderRadius:6, border:'1px solid #e0e0e0', background:'#fff', cursor:'pointer', fontSize:12, fontFamily:'inherit', color:'#666' }}>
                      继续生成
                    </button>
                    <button onClick={() => dispatch({ type: 'NAVIGATE', page: 'ec-studio' })}
                      style={{ padding:'6px 14px', borderRadius:6, border:'1px solid #4338CA', background:'#EEF2FF', cursor:'pointer', fontSize:12, fontFamily:'inherit', color:'#4338CA', fontWeight:500 }}>
                      去精修工坊
                    </button>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(120px,1fr))', gap:10 }}>
                  {Object.entries(ecResults.images||{}).map(([label,url]) => (
                    <div key={label} style={{ background:'#f8f8f8', borderRadius:8, overflow:'hidden', border:'1px solid #f0f0f0' }}>
                      <div style={{ aspectRatio:'1/1', background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', cursor:'pointer' }}
                        onClick={() => setEcLightbox(url)}>
                        <img src={proxyImg(url)} alt={label} style={{ width:'100%', height:'100%', objectFit:'contain' }} loading="lazy" />
                      </div>
                      <div style={{ padding:'6px 8px', display:'flex', justifyContent:'space-between', alignItems:'center', borderTop:'1px solid #f0f0f0' }}>
                        <span style={{ fontSize:10, fontWeight:600, color:'#666' }}>{ecLabel(baseKey(label))}</span>
                        <button onClick={() => { const a=document.createElement('a'); a.href=url; a.download=label+'.png'; a.click(); }}
                          style={{ fontSize:9, padding:'2px 6px', borderRadius:4, background:'#EEF2FF', border:'none', color:'#4338CA', cursor:'pointer', fontWeight:500, fontFamily:'inherit' }}>
                          下载
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {ecLightbox && (
                  <div style={{ position:'fixed', inset:0, zIndex:99999, background:'rgba(0,0,0,0.92)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}
                    onClick={() => setEcLightbox(null)}>
                    <img src={ecLightbox} style={{ maxWidth:'90%', maxHeight:'90vh', objectFit:'contain', borderRadius:8 }} alt="" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="stats-row">
          {isXHS ? (
            <><div className="stat"><div className="stat-num red">15s</div><div className="stat-label">出图速度</div></div><div className="stat"><div className="stat-num red">14</div><div className="stat-label">覆盖赛道</div></div><div className="stat"><div className="stat-num red">9张</div><div className="stat-label">完整配图</div></div></>
          ) : (
            <><div className="stat"><div className="stat-num blue">6种</div><div className="stat-label">视觉风格</div></div><div className="stat"><div className="stat-num blue">6大</div><div className="stat-label">电商平台</div></div><div className="stat"><div className="stat-num blue">9种</div><div className="stat-label">图片类型</div></div></>
          )}
        </div>
      </section>

      {/* 参考图放大查看 Lightbox */}
      {ecPreviewLightbox && (
        <div className="ec-lightbox-overlay" style={{ zIndex: 999999 }} onClick={() => setEcPreviewLightbox(null)}>
          <div className="ec-lightbox-content" onClick={e => e.stopPropagation()}>
            <button className="ec-lightbox-close" onClick={() => setEcPreviewLightbox(null)}>×</button>
            <img src={ecPreviewLightbox} alt="参考图放大" className="ec-lightbox-img" />
            <div className="ec-lightbox-hint">点击空白处关闭</div>
          </div>
        </div>
      )}

      {/* 上传参考图弹窗 */}
      {showRefModal && (
        <div style={{ position:'fixed', inset:0, zIndex:99999, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={() => setShowRefModal(false)}>
          <div style={{ background:'#fff', borderRadius:16, maxWidth:600, width:'100%', maxHeight:'85vh', overflow:'auto', padding:28 }}
            onClick={e => e.stopPropagation()}>
            {/* 头部 */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <div style={{ fontSize:17, fontWeight:600, color:'#333' }}>📸 上传商品实拍图</div>
              <div onClick={() => setShowRefModal(false)} style={{ width:28, height:28, borderRadius:'50%', background:'#f5f5f5', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#999', fontSize:16, lineHeight:1 }}>✕</div>
            </div>

            {/* 主体 */}
            <div style={{ marginBottom:16 }}>
              {/* 上传区 — 居中 */}
              <div onClick={() => ecFileRef.current?.click()} style={{
                border:'2px dashed #d0d0d0', borderRadius:12, padding:'36px 20px',
                textAlign:'center', cursor:'pointer', marginBottom:12,
                background:'#FAFBFC', transition:'all 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#4338CA'; e.currentTarget.style.background = '#F5F3FF'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#d0d0d0'; e.currentTarget.style.background = '#FAFBFC'; }}>
                <Upload size={28} style={{ color:'#bbb', marginBottom:8 }} />
                <div style={{ fontSize:15, fontWeight:600, color:'#555' }}>点击上传商品参考图</div>
              </div>
              <div style={{ fontSize:11, color:'#bbb', textAlign:'center', marginBottom:16, lineHeight:1.6 }}>
                支持 JPG / PNG / WebP，每张不超过 5MB<br />
                建议 1:1 或 3:4 比例，产品居中、背景简洁效果最好
              </div>
              <input ref={ecFileRef} type="file" accept="image/*" multiple hidden onChange={e => { addRefImage(e.target.files, setEcRefImgs, ecRefImgs, 10); e.target.value=''; }} />

              {/* 已上传 — 显示在下方 */}
              {ecRefImgs.length > 0 && (
                <div>
                  <div style={{ fontSize:13, fontWeight:500, color:'#555', marginBottom:10 }}>已上传 {ecRefImgs.length}/10 张</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                    {ecRefImgs.map((src, i) => (
                      <div key={i} style={{ position:'relative', aspectRatio:'1/1', borderRadius:8, overflow:'hidden', border:'1px solid #e8e8e8', cursor:'pointer' }}
                        onClick={() => setEcPreviewLightbox(src)}>
                        <img src={src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                        <div onClick={e => { e.stopPropagation(); setEcRefImgs(p => p.filter((_, j) => j !== i)); }}
                          style={{ position:'absolute', top:-4, right:-4, width:20, height:20, borderRadius:'50%', background:'#FF4757', color:'#fff', fontSize:10, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', border:'2px solid #fff', fontWeight:700, lineHeight:1 }}>×</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 拍摄建议 */}
            <div style={{ background:'#F5F3FF', borderRadius:10, padding:14, marginBottom:20 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#4338CA', marginBottom:8 }}>🎯 什么样的图最有用？</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px 16px', fontSize:12, color:'#555', lineHeight:1.8 }}>
                <span>• <b>正面照</b> — 产品整体外观</span>
                <span>• <b>侧面45°</b> — 展示立体感</span>
                <span>• <b>细节特写</b> — 材质/工艺放大</span>
                <span>• <b>包装图</b> — 外包装+配件</span>
                <span>• <b>使用场景</b> — 模拟真实环境</span>
                <span>• <b>多角度</b> — 背面/顶部/底部</span>
              </div>
              <div style={{ fontSize:11, color:'#888', marginTop:8 }}>只要 1 张正面照也能出图，拍得越清晰 AI 效果越好</div>
            </div>

            <button onClick={() => setShowRefModal(false)}
              style={{ width:'100%', padding:'12px 0', border:'none', borderRadius:10, background:'#4338CA', color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
              完成 ({ecRefImgs.length} 张)
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
