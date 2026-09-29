/**
 * 薯包AI · 精修工坊 — 重构版
 * 智能一键框 + 5 步精细配置
 */
import React, { useState, useRef, useEffect } from 'react';
import { Upload, Sparkle, Package, Gear, Download, MagicWand } from '@phosphor-icons/react';
import { useApp } from '../../store/AppContext';
import { proxyImg, generateEcommerce, generateEcommercePreview, autoRecognizeEcommerce, stitchLongImage, saveWork, regenerateImage } from '../../services/api';
import { downloadFileName } from '../Home/mediaHistoryModel.js';
import { handleGenerationAccessError } from '../../utils/generationAccess.js';
import { EC_CATS, EC_PLATFORM_DIMS, EC_DETAIL_SLICES, EC_SKU_FIELDS } from '../../constants/data';
import { IMAGES } from '../../constants/images';
import { CharImg } from '../../components/ui/index';
import Footer from '../../components/layout/Footer';
import AssetQuickDrag from '../../components/business/AssetQuickDrag.jsx';
import {
  ASSET_DRAG_SOURCES,
  normalizeAssetDragPayload,
} from '../../services/projectAssetDrag.js';
import { createEcommerceDraftId } from '../Home/ec/ecommercePlanModel.js';
import {
  ECOMMERCE_DRAFT_SURFACES,
  acceptEcommerceFinalResult,
  createEcommerceGenerationPreconditionError,
  createEcommerceGenerationToken,
  isEcommerceGenerationTokenCurrent,
  loadOrCreateEcommerceDraft,
  mergeEcommerceInProgressPreview,
  rotateEcommerceDraft,
} from '../Home/ec/ecommerceTaskProgressModel.js';

// ── 平台尺寸 helper ──
const DIMS = Object.fromEntries(
  Object.entries(EC_PLATFORM_DIMS).map(([p, v]) => [p, { 1: v['1:1'], 3: v['3:4'] }])
);
const dimSize = (p, ratio) => {
  const r = DIMS[p]?.[ratio === '3:4' ? 3 : 1] || [1440, 1440];
  return { w: r[0], h: r[1] };
};

/* D3：靛蓝 var(--sb-brand-700) 家族判为历史遗留 → 品牌紫；D4：暖黑描边；D6：圆角 4 档；
   D11：输入框的 UA 轮廓以 0 宽度 + 透明色关闭，焦点可见性由 .ec-studio-field:focus-visible 的
        box-shadow 环提供（见文件末尾样式块，不改边框宽度、不产生布局抖动）。
   全部取值来自 design-tokens-v3.css，不新增数值。 */
const SX = {
  card: { background: 'var(--sb-surface-card)', borderRadius: 'var(--sb-radius-lg)', border: '1px solid var(--sb-border-subtle)', padding: 'var(--sb-space-8)' },
  label: { fontSize: 'var(--sb-text-md)', fontWeight: 'var(--sb-weight-semibold)', color: 'var(--sb-ink-1)', marginBottom: 'var(--sb-space-2)', display: 'block' },
  input: {
    width: '100%', padding: '11px 14px', border: '1px solid var(--sb-border-default)', borderRadius: 'var(--sb-radius-md)',
    fontSize: 'var(--sb-text-md)', fontFamily: 'inherit', outline: '0 solid transparent', boxSizing: 'border-box',
    background: 'var(--sb-surface-sunken)', transition: 'border-color var(--sb-dur-fast)', color: 'var(--sb-ink-1)',
  },
  h3: { fontSize: 'var(--sb-text-lg)', fontWeight: 'var(--sb-weight-semibold)', color: 'var(--sb-ink-1)', marginBottom: 'var(--sb-space-1)', display: 'flex', alignItems: 'center', gap: 'var(--sb-space-2)' },
  hint: { fontSize: 'var(--sb-text-sm)', color: 'var(--sb-ink-3)', lineHeight: 1.7 },
  stepNum: {
    width: 26, height: 26, borderRadius: 'var(--sb-radius-pill)', background: 'var(--sb-brand-600)', color: 'var(--sb-ink-on-dark)',
    fontSize: 'var(--sb-text-md)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
};

const EMPTY_SKU = { color: '', size: '', capacity: '', dimLabel: '' };
const EMPTY_DETAIL_PLAN = {
  sizeAnnot: true, scene: true, qc: false, compare: false, feature: true,
  notes: { sizeAnnot: '', scene: '', qc: '', compare: '', feature: '' },
};
const PLAN_KEY_BY_SLICE = {
  detail_slice_size: 'sizeAnnot',
  detail_slice_scene: 'scene',
  detail_slice_qc: 'qc',
  detail_slice_compare: 'compare',
  detail_slice_feature: 'feature',
};
const SLICE_KEY_BY_PLAN = {
  sizeAnnot: 'detail_slice_size',
  scene: 'detail_slice_scene',
  qc: 'detail_slice_qc',
  compare: 'detail_slice_compare',
  feature: 'detail_slice_feature',
};

let observedEcommerceWorkVersion = 0;

export default function EcStudioPage() {
  const { state, dispatch, fetchCredits } = useApp();
  const ownerEmail = String(state.email || state.phone || '').trim().toLowerCase();
  const workVersion = Number(state._workVersion || 0);
  const [draftId, setDraftId] = useState(() => loadOrCreateEcommerceDraft({
    ownerEmail,
    surface: ECOMMERCE_DRAFT_SURFACES.EC_STUDIO,
    createDraftId: createEcommerceDraftId,
  })?.draftId || '');
  const [smartBrief, setSmartBrief] = useState('');
  const [realShots, setRealShots] = useState([]);
  const [refShots, setRefShots] = useState([]);
  const [product, setProduct] = useState({ name: '', category: '', material: '', dimensions: '' });
  const [skus, setSkus] = useState([{ ...EMPTY_SKU }]);
  const [detailPlan, setDetailPlan] = useState({
    ...EMPTY_DETAIL_PLAN,
    notes: { ...EMPTY_DETAIL_PLAN.notes },
  });
  const [maintenance, setMaintenance] = useState('');
  const [platform, setPlatform] = useState('淘宝');

  const [showPlugin, setShowPlugin] = useState(false);
  const [phase, setPhase] = useState('config'); // config | preview | result
  const [ol, setOl] = useState([]);
  const [olLoad, setOlLoad] = useState(false);
  const [res, setRes] = useState(null);
  const [inProgressPreview, setInProgressPreview] = useState({});
  const [genProgress, setGenProgress] = useState('');
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState('');
  const [recognizing, setRecognizing] = useState(false);
  const [lb, setLb] = useState(null);
  const [stitching, setStitching] = useState(false);
  const generationTokenRef = useRef(null);
  const generationAbortRef = useRef(null);
  const generationIdentityRef = useRef({ ownerEmail, draftId });
  generationIdentityRef.current = { ownerEmail, draftId };
  const beginGeneration = () => {
    const token = createEcommerceGenerationToken({ ownerEmail, draftId });
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
      surface: ECOMMERCE_DRAFT_SURFACES.EC_STUDIO,
      createDraftId: createEcommerceDraftId,
    });
    setDraftId(active?.draftId || '');
    setRes(null);
    setInProgressPreview({});
    setGenerating(false);
    setGenProgress('');
  }, [ownerEmail]);

  useEffect(() => {
    if (!workVersion || workVersion <= observedEcommerceWorkVersion) return;
    observedEcommerceWorkVersion = workVersion;
    generationTokenRef.current = null;
    generationAbortRef.current?.abort();
    generationAbortRef.current = null;
    const rotated = rotateEcommerceDraft({
      ownerEmail,
      surface: ECOMMERCE_DRAFT_SURFACES.EC_STUDIO,
      currentDraftId: draftId,
      createDraftId: createEcommerceDraftId,
    });
    if (!rotated?.draftId) return;
    setDraftId(rotated.draftId);
    setRes(null);
    setInProgressPreview({});
    setPhase('config');
    setGenerating(false);
    setGenProgress('');
  }, [draftId, ownerEmail, workVersion]);

  useEffect(() => () => {
    generationTokenRef.current = null;
    generationAbortRef.current?.abort();
  }, []);
  const [stitchUrl, setStitchUrl] = useState(null);
  const [regKey, setRegKey] = useState('');
  const [regEdit, setRegEdit] = useState({ l: null, p: '', v: false });
  const fReal = useRef(null);
  const fRef = useRef(null);

  const name = product.name;
  const setName = (v) => setProduct((p) => ({ ...p, name: v }));

  // ── 上传图片 helper ──
  const addImg = (files, setter, cur, max) => {
    Array.from(files).slice(0, max - cur.length).forEach((f) => {
      const r = new FileReader();
      r.onload = (e) => setter((p) => (p.length >= max ? p : [...p, e.target.result]));
      r.readAsDataURL(f);
    });
  };

  // ── 1-click 拖入 helper (P-H) ──
  // 把 AssetQuickDrag 的 payload (dataURL / remoteUrl) 落到指定 setter
  const addDragPayload = (setter, cur, max) => (payload) => {
    const normalized = normalizeAssetDragPayload(payload);
    if (!normalized) return false;
    const url = normalized.dataUrl || normalized.remoteUrl || normalized.thumbUrl;
    if (!url) return false;
    setter((p) => (p.length >= max ? p : [...p, url]));
    return true;
  };
  const addRealDragPayload = addDragPayload(setRealShots, realShots, 10);
  const addRefDragPayload = addDragPayload(setRefShots, refShots, 5);
  // 落点 (EcStudio 的 ImageUploader 区域) 状态: 标记正在被 drag over
  const [dragOverTarget, setDragOverTarget] = useState(''); // 'real' | 'ref' | ''

  // ── 智能识别 → 回填 5 步字段 ──
  const goRecognize = async () => {
    if (!smartBrief.trim() && refShots.length === 0) {
      setErr('请填写描述或上传参考图');
      return;
    }
    setRecognizing(true);
    setErr('');
    try {
      const r = await autoRecognizeEcommerce({ smartBrief: smartBrief.trim(), refShots });
      if (r.product) {
        setProduct((p) => ({ ...p, ...r.product, name: r.product.name || p.name }));
      }
      if (Array.isArray(r.skus) && r.skus.length) {
        setSkus(r.skus.map((s) => ({ ...EMPTY_SKU, ...s })));
      }
      if (r.detailPlan) {
        setDetailPlan({
          ...EMPTY_DETAIL_PLAN,
          ...r.detailPlan,
          notes: { ...EMPTY_DETAIL_PLAN.notes, ...(r.detailPlan.notes || {}) },
        });
      }
      if (r.maintenance) setMaintenance(r.maintenance);
    } catch (e) {
      setErr('AI 识别失败：' + (e.message || ''));
    }
    setRecognizing(false);
  };

  // ── SKU 行增删改 ──
  const addSkuRow = () => setSkus((p) => (p.length >= 20 ? p : [...p, { ...EMPTY_SKU }]));
  const delSkuRow = (i) => setSkus((p) => p.filter((_, j) => j !== i));
  const updSku = (i, field, v) => setSkus((p) => p.map((s, j) => (j === i ? { ...s, [field]: v } : s)));

  // ── 详情切片勾选 + 备注 ──
  const toggleSlice = (key) => setDetailPlan((p) => ({ ...p, [key]: !p[key] }));
  const updSliceNote = (key, v) =>
    setDetailPlan((p) => ({ ...p, notes: { ...p.notes, [key]: v } }));

  // ── 构建默认 selections（提交给后端） ──
  const buildSelections = () => {
    const sel = [
      { key: 'white_bg', count: 1 },
      { key: 'main_text', count: 5 },
      { key: 'main_3x4', count: 5 },
      { key: 'transparent', count: 1 },
    ];
    const validSkus = skus.filter((s) => s.color || s.size || s.capacity || s.dimLabel);
    if (validSkus.length) sel.push({ key: 'sku', count: validSkus.length });
    Object.entries(SLICE_KEY_BY_PLAN).forEach(([planKey, sliceKey]) => {
      if (detailPlan[planKey]) {
        sel.push({ key: sliceKey, count: 1, sliceNote: detailPlan.notes[planKey] || '' });
      }
    });
    if (maintenance.trim()) {
      sel.push({ key: 'detail_slice_care', count: 1, sliceNote: maintenance.trim() });
    }
    return sel;
  };

  const total = buildSelections().reduce((s, i) => s + (i.count || 1), 0);

  // ── 预览大纲 ──
  const goPreview = async () => {
    if (!name.trim()) return;
    setOlLoad(true);
    setErr('');
    try {
      const d = await generateEcommercePreview({
        productName: name.trim(),
        category: product.category,
        points: product.material || '',
        refCount: refShots.length,
        hasMaterial: !!product.material,
        imageSelections: buildSelections(),
        skus,
        detailPlan,
        maintenance,
      });
      const o = (d.outline || []).map((i, idx) => ({
        ...i,
        userPrompt: i.outlineText || '',
        refImageIndex: refShots.length > 0 ? idx % refShots.length : -1,
      }));
      setOl(o);
      setPhase('preview');
    } catch (e) {
      setErr('预览失败: ' + (e.message || ''));
    }
    setOlLoad(false);
  };

  // ── 生成 ──
  const goGen = async () => {
    if (!name.trim() || generating) return;
    const generationToken = beginGeneration();
    if (!generationToken) {
      const contextError = createEcommerceGenerationPreconditionError();
      setErr(contextError.message);
      setGenerating(false);
      return;
    }
    const generationController = new AbortController();
    generationAbortRef.current = generationController;
    setGenerating(true);
    setErr('');
    setRes(null);
    setInProgressPreview({});
    setGenProgress('');
    dispatch({ type: 'START_GEN' });
    await new Promise((r) => setTimeout(r, 100));
    dispatch({ type: 'SET_STAGE', stage: 1 });
    await new Promise((r) => setTimeout(r, 100));
    try {
      const d = await generateEcommerce({
        productName: name,
        category: product.category,
        refImgs: refShots,
        realShots,
        platform,
        email: state.phone,
        points: product.material || '',
        skus,
        detailPlan,
        maintenance,
        signal: generationController.signal,
        isCurrent: () => isGenerationCurrent(generationToken),
        material: product.material,
        restrictions: '',
        imageSelections: buildSelections(),
        draftId,
        onProgress: (task) => {
          if (!isGenerationCurrent(generationToken)) return;
          const progress = task?.message || task?.step || task?.assets?.find(asset => asset.userState)?.userState;
          if (progress) setGenProgress(progress);
        },
        /* 2026-09-20 裁定②：自动补跑的事前告知（不允许静默扣）。 */
        onNotice: (notice) => {
          if (!isGenerationCurrent(generationToken)) return;
          if (notice?.text) setGenProgress(notice.text);
        },
        onImage: (image) => {
          if (!isGenerationCurrent(generationToken)) return;
          const url = image?.stableUrl || image?.url;
          if (!image?.id || !url) return;
          setInProgressPreview(previous => mergeEcommerceInProgressPreview(previous, { ...image, url }));
          setGenProgress(`已生成: ${image.label || image.role || image.id}`);
        },
      });
      if (!isGenerationCurrent(generationToken)) return;
      const finalResult = acceptEcommerceFinalResult(d);
      if (!finalResult) throw new Error('任务尚未完成或没有稳定图片，请稍后继续生成');
      dispatch({ type: 'SET_STAGE', stage: 2 });
      await new Promise((r) => setTimeout(r, 800));
      if (!isGenerationCurrent(generationToken)) return;
      dispatch({ type: 'SET_STAGE', stage: 3 });
      await new Promise((r) => setTimeout(r, 600));
      if (!isGenerationCurrent(generationToken)) return;
      dispatch({ type: 'CLOSE_RESULT' });
      setPhase('result');
      setRes(finalResult);
      setInProgressPreview({});
      setGenProgress('');
      setStitchUrl(null);
      /* 批 CY-⑮：保存作品这一步以前是 **fire-and-forget**（没 await、没 catch、返回值丢弃）。
         后果有两个，用户都看不到：
           ① saveWork 失败时**返回 null 而不抛**（services/api.js:1826）⇒ 图已经出了、
              界面写着「生成完成」，但「我的作品」里没有，**一句提示都没有**；
           ② 它带着 generationController.signal —— 用户点一下「继续生成」就会 abort，
              而 abort 之后 api.js:1801 的二次检查直接 return null ⇒ 这一次也白存。
         ⇒ 改成 await + catch + **用本页已有的提示通道告诉用户**。
         ⚠️ 这里刻意用 `setErr`（本页唯一已渲染的提示通道，:522）而不是新造一个 setNotice ——
            我第一版顺手写了 setNotice，而**这个文件里根本没有 setNotice**，
            那就是同一个「用了没声明的标识符」的坑，差点又踩一次（见 jsx-undefined-identifiers-0929）。 */
      try {
        const saved = await saveWork({
          ...finalResult,
          _ecResult: true,
          _saveKey: 'ec-' + Date.now(),
          product_name: name,
          category: product.category,
          platform,
          at: new Date().toLocaleDateString('zh-CN'),
          images: d.images || {},
        }, state.phone);
        if (!saved) setErr('图片已完成，但没能存进「我的作品」—— 请先下载保存，别刷新这一页');
      } catch (saveError) {
        setErr('图片已完成，但没能存进「我的作品」—— 请先下载保存，别刷新这一页');
        if (import.meta.env?.DEV) console.warn('[ec-studio] saveWork 失败', saveError);
      }
      if (!isGenerationCurrent(generationToken)) return;
      fetchCredits(state.phone);
    } catch (e) {
      if (!isGenerationCurrent(generationToken)) return;
      const msg = e.message || '';
      const accessResult = handleGenerationAccessError(e, dispatch, {
        source: 'ecommerce-studio',
        message: '精修工坊中的商品图、SKU、详情配置和说明都已保留，充值后可以继续生成。',
      });
      setErr(accessResult ? '' : '生成失败: ' + (msg.includes('Image API error') ? '图片API暂时不可用，请稍后重试' : msg.slice(0, 100)));
      setPhase('config');
      setGenProgress('');
      dispatch({ type: 'CLOSE_RESULT' });
    } finally {
      if (isGenerationCurrent(generationToken)) {
        setGenerating(false);
        generationTokenRef.current = null;
        generationAbortRef.current = null;
      }
    }
  };

  const startNewProduct = () => {
    generationTokenRef.current = null;
    generationAbortRef.current?.abort();
    generationAbortRef.current = null;
    const rotated = rotateEcommerceDraft({
      ownerEmail,
      surface: ECOMMERCE_DRAFT_SURFACES.EC_STUDIO,
      currentDraftId: draftId,
      createDraftId: createEcommerceDraftId,
    });
    if (!rotated?.draftId) return;
    setDraftId(rotated.draftId);
    setRes(null);
    setInProgressPreview({});
    setGenProgress('');
    setPhase('config');
    setStitchUrl(null);
  };

  // ── 单图重生成 ──
  const goRegen = async (l, p) => {
    if (regKey) return;
    setRegKey(l);
    try {
      const url = await regenerateImage(p || '', product.category);
      if (url) {
        setRes((prev) =>
          prev ? { ...prev, images: { ...prev.images, [l]: url } } : prev
        );
      }
    } catch (e) {
      setErr(e.message || '重生成失败，请重试');
    }
    setRegKey('');
    setRegEdit({ l: null, p: '', v: false });
  };

  // ── 拼长图（详情切片） ──
  const goStitch = async () => {
    const sliceUrls = Object.entries(res?.images || {})
      .filter(([k]) => k.includes('detail_slice'))
      .map(([, u]) => u);
    if (sliceUrls.length < 2) {
      setErr('至少需要 2 张详情切片才能拼长图');
      return;
    }
    setStitching(true);
    setErr('');
    try {
      const r = await stitchLongImage(sliceUrls);
      setStitchUrl(r.url);
    } catch (e) {
      setErr('拼长图失败：' + (e.message || ''));
    }
    setStitching(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F6F7F9' }}>
      <div style={{ maxWidth: 'var(--max-width-narrow)', margin: '0 auto', padding: '32px 24px 80px' }}>
        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--sb-space-2-5)', cursor: 'pointer' }}
            role="button"
            tabIndex={0}
            onClick={() => dispatch({ type: 'NAVIGATE', page: 'home' })}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); () => dispatch({ type: 'NAVIGATE', page: 'home' }); } }}
          >
            <CharImg src={IMAGES.appicon} size={32} float />
            <span style={{ fontSize: 'var(--sb-text-xl)', fontWeight: 650, color: 'var(--sb-danger)' }}>薯包AI</span>
            <span
              style={{
                fontSize: 'var(--sb-text-sm)', color: 'var(--sb-brand-600)', background: 'var(--sb-brand-50)', padding: '3px 10px',
                borderRadius: 'var(--sb-radius-sm)', fontWeight: 500,
              }}
            >
              精修工坊
            </span>
          </div>
          <button
            onClick={() => {
              dispatch({ type: 'NAVIGATE', page: 'home' });
              dispatch({ type: 'SET_MODE', mode: 'ecommerce' });
            }}
            style={{
              fontSize: 'var(--sb-text-md)', color: 'var(--sb-brand-600)', background: 'var(--sb-brand-50)', border: '1px solid var(--sb-brand-200)',
              borderRadius: 'var(--sb-radius-md)', padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 'var(--sb-space-1-5)', whiteSpace: 'nowrap', fontWeight: 500,
            }}
          >
            <Sparkle weight="fill" size={14} /> 一键出图
          </button>
        </div>

        {err && (
          <div
            style={{
              background: 'var(--sb-danger-soft)', border: '1px solid #FED7D7', borderRadius: 'var(--sb-radius-md)',
              padding: '12px 16px', marginBottom: 20, fontSize: 'var(--sb-text-md)', color: 'var(--sb-danger-hover)',
              lineHeight: 1.5,
            }}
          >
            {err}
          </div>
        )}

        {/* ═══════ CONFIG ═══════ */}
        {phase === 'config' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* ① 插件导入卡片（保留不动） */}
            <div style={SX.card}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: 52, height: 52, borderRadius: 'var(--sb-radius-lg)',
                    background: 'linear-gradient(135deg,var(--sb-brand-50),var(--sb-brand-100))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, color: 'var(--sb-brand-700)',
                  }}
                >
                  <Package weight="fill" size={26} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={SX.h3}>🔄 一键复刻爆款商品图</h3>
                  <p style={{ ...SX.hint, marginBottom: 16 }}>
                    看到别人的商品图好看又卖得好？装插件 → 去爆款商品页点一下 → 自动抓取商品名称、多张商品图、卖点文案。
                    <strong>然后直接用薯包AI生成你自己商品的同款风格图片</strong>。
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setShowPlugin(true)}
                      style={{
                        padding: '9px 20px', borderRadius: 'var(--sb-radius-md)', background: 'var(--sb-brand-700)', color: 'var(--sb-neutral-0)',
                        border: 'none', fontSize: 'var(--sb-text-md)', fontWeight: 600, cursor: 'pointer',
                        fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 'var(--sb-space-1-5)',
                        boxShadow: '0 2px 8px var(--sb-brand-a32)',
                      }}
                    >
                      📥 下载插件
                    </button>
                    <span style={{ fontSize: 'var(--sb-text-sm)', color: '#aaa' }}>
                      470KB · Chrome/Edge · 装一次永久用
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                {['抓取爆款商品名称', '抓取多张商品图', '提取卖点与价格', '复刻同款视觉风格'].map((t) => (
                  <span
                    key={t}
                    style={{
                      fontSize: 'var(--sb-text-sm)', color: 'var(--sb-ink-success)', background: '#F0FDF4',
                      padding: '4px 10px', borderRadius: 'var(--sb-radius-sm)', fontWeight: 500,
                    }}
                  >
                    ✅ {t}
                  </span>
                ))}
              </div>
            </div>

            {/* 插件 Modal（保留不动） */}
            {showPlugin && (
              <div
                style={{
                  position: 'fixed', inset: 0, zIndex: 'var(--sb-z-modal)', background: 'rgba(12,10,9,.45)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
                }}
                /* 键盘可达三件套：整屏遮罩点击=关闭（Esc 亦已支持）。给它键盘通道，避免「鼠标能关、键盘不能」。 */
                role="button"
                tabIndex={0}
                aria-label="关闭"
                onClick={() => setShowPlugin(false)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { e.preventDefault(); setShowPlugin(false); } }}
              >
                <div
                  style={{ background: 'var(--sb-neutral-0)', borderRadius: 'var(--sb-radius-xl)', maxWidth: 460, width: '100%', padding: 24 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      marginBottom: 18,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sb-space-2-5)' }}>
                      <img src={IMAGES.appicon} alt="" width="36" height="36" loading="lazy" decoding="async" fetchpriority="auto" style={{ width: 36, height: 36, borderRadius: 'var(--sb-radius-md)' }} />
                      <div>
                        <div style={{ fontSize: 'var(--sb-text-lg)', fontWeight: 600, color: '#1a1a2e' }}>
                          安装薯包AI提取插件
                        </div>
                        <div style={{ fontSize: 'var(--sb-text-xs)', color: 'var(--sb-ink-4)' }}>470KB · Chrome / Edge 浏览器</div>
                      </div>
                    </div>
                    <div
                      /* 键盘可达三件套：关闭按钮（26×26 圆钮）—— 真按钮，不是装饰容器。 */
                      role="button"
                      tabIndex={0}
                      aria-label="关闭"
                      onClick={() => setShowPlugin(false)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowPlugin(false); } }}
                      style={{
                        width: 26, height: 26, borderRadius: '50%', background: 'var(--sb-neutral-100)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: 'var(--sb-ink-3)', fontSize: 'var(--sb-text-md)', lineHeight: 1, flexShrink: 0,
                      }}
                    >
                      ✕
                    </div>
                  </div>
                  <a
                    href="/extensions/shubao-extractor.zip"
                    download
                    style={{
                      display: 'flex', alignItems: 'center', gap: 'var(--sb-space-2-5)', padding: '12px 16px',
                      background: 'var(--sb-brand-50)', borderRadius: 'var(--sb-radius-lg)', textDecoration: 'none', marginBottom: 18,
                    }}
                  >
                    <div
                      style={{
                        width: 40, height: 40, borderRadius: 'var(--sb-radius-md)', background: 'var(--sb-brand-700)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--sb-neutral-0)', fontSize: 'var(--sb-text-xl)',
                      }}
                    >
                      ⬇
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 'var(--sb-text-md)', fontWeight: 600, color: 'var(--sb-ink-1)' }}>下载插件 ZIP 包</div>
                      <div style={{ fontSize: 'var(--sb-text-xs)', color: 'var(--sb-ink-3)', marginTop: 1 }}>
                        470KB · 解压后加载到浏览器即可使用
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 'var(--sb-text-sm)', fontWeight: 600, color: 'var(--sb-brand-700)', background: 'var(--sb-neutral-0)',
                        padding: '6px 14px', borderRadius: 'var(--sb-radius-sm)', border: '1px solid var(--sb-brand-200)',
                      }}
                    >
                      下载
                    </span>
                  </a>
                  <div style={{ fontSize: 'var(--sb-text-md)', fontWeight: 600, color: 'var(--sb-ink-1)', marginBottom: 10 }}>
                    安装步骤
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      '下载 ZIP 包并解压到电脑上的任意文件夹',
                      '地址栏输入 chrome://extensions 或 edge://extensions',
                      '开启右上角「开发者模式」',
                      '点击「加载已解压的扩展程序」→ 选中解压好的文件夹',
                      '打开任意商品页 → 点浏览器右上角的薯包图标 → 自动提取商品信息，一键发送到精修工坊 🎉',
                    ].map((t, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex', gap: 'var(--sb-space-2-5)', alignItems: 'flex-start',
                          padding: '8px 12px',
                          background: i === 4 ? 'linear-gradient(135deg, var(--sb-brand-50), var(--sb-brand-100))' : 'var(--sb-neutral-25)',
                          borderRadius: 'var(--sb-radius-md)', border: `1px solid ${i === 4 ? 'var(--sb-brand-200)' : '#EEEFF2'}`,
                        }}
                      >
                        <div
                          style={{
                            width: 22, height: 22, borderRadius: '50%',
                            background: i === 4 ? 'var(--sb-brand)' : 'var(--sb-brand-700)',
                            color: 'var(--sb-neutral-0)', fontSize: 'var(--sb-text-xs)', fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, marginTop: 1,
                          }}
                        >
                          {i + 1}
                        </div>
                        <div style={{ fontSize: 'var(--sb-text-sm)', color: 'var(--sb-ink-2)', lineHeight: 1.6 }}>{t}</div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowPlugin(false)}
                    style={{
                      width: '100%', padding: '12px 0', border: 'none', borderRadius: 'var(--sb-radius-md)',
                      background: 'var(--sb-brand-700)', color: 'var(--sb-neutral-0)', fontSize: 'var(--sb-text-md)', fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit', marginTop: 16,
                    }}
                  >
                    安装好了，开始使用
                  </button>
                </div>
              </div>
            )}

            {/* 智能一键框 */}
            <div
              style={{
                ...SX.card,
                background: 'linear-gradient(135deg,var(--sb-brand-50), var(--sb-brand-50))',
                borderColor: 'var(--sb-brand-200)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <MagicWand weight="fill" size={20} style={{ color: 'var(--sb-brand-700)' }} />
                <h3 style={{ ...SX.h3, marginBottom: 0 }}>📝 智能一键</h3>
                <span style={{ fontSize: 'var(--sb-text-sm)', color: 'var(--sb-brand-600)', fontWeight: 400 }}>
                  用一段话描述想要的商品图，AI 自动填下方 5 步
                </span>
              </div>
              <textarea
                value={smartBrief}
                onChange={(e) => setSmartBrief(e.target.value)}
                placeholder="例：我要卖一款月岩白的无线蓝牙耳机，材质亲肤硅胶，有3个颜色，主打降噪和长续航，需要尺寸标注和场景图，保养就是避免进水…"
                rows={3}
                style={{
                  ...SX.input, minHeight: 80, resize: 'vertical', fontSize: 'var(--sb-text-md)', lineHeight: 1.6,
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--sb-brand-600)')}
                onBlur={(e) => (e.target.style.borderColor = '#D0D0D8')}
              />
              <div style={{ display: 'flex', gap: 'var(--sb-space-2-5)', marginTop: 12, flexWrap: 'wrap' }}>
                <button
                  onClick={goRecognize}
                  disabled={recognizing}
                  style={{
                    padding: '10px 20px', borderRadius: 'var(--sb-radius-md)', background: 'var(--sb-brand-700)', color: 'var(--sb-neutral-0)',
                    border: 'none', fontSize: 'var(--sb-text-md)', fontWeight: 600,
                    cursor: recognizing ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                    display: 'inline-flex', alignItems: 'center', gap: 'var(--sb-space-1-5)',
                    opacity: recognizing ? 0.6 : 1,
                  }}
                >
                  <Sparkle weight="fill" size={14} /> {recognizing ? 'AI 识别中...' : 'AI 自动识别 · 0.2 AI 积分'}
                </button>
                <span style={{ fontSize: 'var(--sb-text-sm)', color: 'var(--sb-ink-3)', alignSelf: 'center' }}>
                  识别后自动填到下方 5 步，可手动改
                </span>
              </div>
            </div>

            {/* ① 实拍图 */}
            <div style={SX.card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sb-space-2-5)', marginBottom: 8 }}>
                <div style={SX.stepNum}>1</div>
                <h3 style={{ ...SX.h3, marginBottom: 0 }}>上传产品多角度实拍图</h3>
                <div style={{ marginLeft: 'auto' }}>
                  <AssetQuickDrag
                    onPick={(payload) => { addRealDragPayload(payload); }}
                    compact={false}
                  />
                </div>
              </div>
              <p style={{ ...SX.hint, marginBottom: 16 }}>
                推荐角度：正面 / 45°侧面 / 细节 / 包装 / 场景。AI 会以这些实拍为准生成，最多 10 张。
              </p>
              <ImageUploader
                imgs={realShots}
                max={10}
                onPick={() => fReal.current?.click()}
                onDel={(i) => setRealShots((p) => p.filter((_, j) => j !== i))}
                onPreview={setLb}
                dropTargetKey={dragOverTarget === 'real' ? 'real' : ''}
                onDragOverTarget={setDragOverTarget}
                onDragLeaveTarget={(target, e) => {
                  // 仅当真正离开 ImageUploader 容器时才清空
                  if (e && e.currentTarget && e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return;
                  setDragOverTarget((cur) => (cur === target ? '' : cur));
                }}
                onDropAsset={(payload) => { addRealDragPayload(payload); setDragOverTarget(''); }}
              />
              <input
                ref={fReal}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  addImg(e.target.files, setRealShots, realShots, 10);
                  e.target.value = '';
                }}
              />
            </div>

            {/* ② 参考图 */}
            <div style={SX.card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sb-space-2-5)', marginBottom: 8 }}>
                <div style={SX.stepNum}>2</div>
                <h3 style={{ ...SX.h3, marginBottom: 0 }}>上传目标参考图</h3>
                <span style={{ fontSize: 'var(--sb-text-sm)', color: 'var(--sb-ink-5)' }}>选填 · 最多 5 张</span>
                <div style={{ marginLeft: 'auto' }}>
                  <AssetQuickDrag
                    onPick={(payload) => { addRefDragPayload(payload); }}
                    compact={false}
                  />
                </div>
              </div>
              <p style={{ ...SX.hint, marginBottom: 16 }}>
                想模仿的风格 / 竞品爆款图，AI 会学习它的视觉调性。
              </p>
              <ImageUploader
                imgs={refShots}
                max={5}
                onPick={() => fRef.current?.click()}
                onDel={(i) => setRefShots((p) => p.filter((_, j) => j !== i))}
                onPreview={setLb}
                dropTargetKey={dragOverTarget === 'ref' ? 'ref' : ''}
                onDragOverTarget={setDragOverTarget}
                onDragLeaveTarget={(target, e) => {
                  if (e && e.currentTarget && e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return;
                  setDragOverTarget((cur) => (cur === target ? '' : cur));
                }}
                onDropAsset={(payload) => { addRefDragPayload(payload); setDragOverTarget(''); }}
              />
              <input
                ref={fRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  addImg(e.target.files, setRefShots, refShots, 5);
                  e.target.value = '';
                }}
              />
            </div>

            {/* ③ 规格 + SKU */}
            <div style={SX.card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sb-space-2-5)', marginBottom: 16 }}>
                <div style={SX.stepNum}>3</div>
                <h3 style={{ ...SX.h3, marginBottom: 0 }}>产品尺寸颜色规格</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={SX.label}>
                    商品名称 <span style={{ color: 'var(--sb-danger)' }}>*</span>
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="高保湿精华液、无线蓝牙耳机…"
                    style={SX.input}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--sb-brand-600)'; e.target.style.boxShadow = 'var(--sb-shadow-ring)'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#D0D0D8'; e.target.style.boxShadow = ''; }}
                  />
                </div>
                <div>
                  <label style={SX.label}>品类</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sb-space-1-5)' }}>
                    {EC_CATS.map((c) => (
                      <span
                        key={c}
                        /* 键盘可达三件套：类目 chip 是真按钮（点击=选中类目）。 */
                        role="button"
                        tabIndex={0}
                        onClick={() => setProduct((p) => ({ ...p, category: c }))}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setProduct(p => ({ ...p, category: c })); } }}
                        style={{
                          padding: '6px 12px', borderRadius: 'var(--sb-radius-2xl)', fontSize: 'var(--sb-text-sm)', cursor: 'pointer',
                          fontFamily: 'inherit', border: '1.5px solid',
                          background: product.category === c ? 'var(--sb-brand-50)' : 'var(--sb-neutral-0)',
                          borderColor: product.category === c ? 'var(--sb-brand-600)' : 'var(--sb-neutral-200)',
                          color: product.category === c ? 'var(--sb-brand-700)' : 'var(--sb-ink-3)',
                          fontWeight: product.category === c ? 600 : 400,
                        }}
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={SX.label}>尺寸标注（长×宽×高 cm）</label>
                  <input
                    value={product.dimensions}
                    onChange={(e) => setProduct((p) => ({ ...p, dimensions: e.target.value }))}
                    placeholder="20×10×5"
                    style={SX.input}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--sb-brand-600)'; e.target.style.boxShadow = 'var(--sb-shadow-ring)'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#D0D0D8'; e.target.style.boxShadow = ''; }}
                  />
                </div>
                <div>
                  <label style={SX.label}>材质 / 工艺</label>
                  <input
                    value={product.material}
                    onChange={(e) => setProduct((p) => ({ ...p, material: e.target.value }))}
                    placeholder="亲肤硅胶、304不锈钢…"
                    style={SX.input}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--sb-brand-600)'; e.target.style.boxShadow = 'var(--sb-shadow-ring)'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#D0D0D8'; e.target.style.boxShadow = ''; }}
                  />
                </div>
              </div>

              {/* SKU 变体表 */}
              <div style={{ marginTop: 8 }}>
                <div
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: 8,
                  }}
                >
                  <label style={{ ...SX.label, marginBottom: 0 }}>
                    SKU 变体配置（每行 = 一张 SKU 规格图）
                  </label>
                  <button
                    onClick={addSkuRow}
                    style={{
                      padding: '5px 12px', borderRadius: 'var(--sb-radius-sm)', background: 'var(--sb-brand-50)',
                      color: 'var(--sb-brand-700)', border: '1px solid var(--sb-brand-200)', fontSize: 'var(--sb-text-sm)',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    + 添加变体
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {skus.map((s, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex', gap: 8, alignItems: 'center', padding: '8px',
                        background: 'var(--sb-neutral-25)', borderRadius: 'var(--sb-radius-md)', border: '1px solid #EEEEF2',
                      }}
                    >
                      <span style={{ fontSize: 'var(--sb-text-sm)', color: 'var(--sb-ink-3)', minWidth: 28 }}>#{i + 1}</span>
                      {EC_SKU_FIELDS.map((f) => (
                        <input
                          key={f.key}
                          value={s[f.key]}
                          onChange={(e) => updSku(i, f.key, e.target.value)}
                          placeholder={f.placeholder}
                          maxLength={f.maxLen}
                          style={{
                            flex: 1, padding: '7px 10px', border: '1px solid var(--sb-neutral-200)',
                            borderRadius: 'var(--sb-radius-sm)', fontSize: 'var(--sb-text-sm)', fontFamily: 'inherit', outline: '0 solid transparent',
                            boxSizing: 'border-box',
                          }}
                          onFocus={(e) => { e.target.style.borderColor = 'var(--sb-brand-600)'; e.target.style.boxShadow = 'var(--sb-shadow-ring)'; }}
                          onBlur={(e) => { e.target.style.borderColor = 'var(--sb-neutral-200)'; e.target.style.boxShadow = ''; }}
                        />
                      ))}
                      {skus.length > 1 && (
                        <button
                          onClick={() => delSkuRow(i)}
                          style={{
                            width: 24, height: 24, borderRadius: 'var(--sb-radius-sm)', background: 'var(--sb-neutral-0)',
                            border: '1px solid var(--sb-neutral-200)', color: 'var(--sb-danger)', cursor: 'pointer',
                            fontSize: 'var(--sb-text-md)', flexShrink: 0,
                          }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 'var(--sb-text-xs)', color: '#aaa', marginTop: 6 }}>
                  颜色名 ≤4 字，AI 严格按你填的生成，不自创。
                </div>
              </div>
            </div>

            {/* ④ 详情策划 */}
            <div style={SX.card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sb-space-2-5)', marginBottom: 16 }}>
                <div style={SX.stepNum}>4</div>
                <h3 style={{ ...SX.h3, marginBottom: 0 }}>详情页策划思路</h3>
                <span style={{ fontSize: 'var(--sb-text-sm)', color: 'var(--sb-ink-5)' }}>
                  勾选 = 生成一张详情切片（1440 宽）
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sb-space-2-5)' }}>
                {EC_DETAIL_SLICES.filter((s) => s.key !== 'detail_slice_care').map((s) => {
                  const planKey = PLAN_KEY_BY_SLICE[s.key];
                  const checked = detailPlan[planKey];
                  return (
                    <div
                      key={s.key}
                      style={{
                        padding: '10px 12px', borderRadius: 'var(--sb-radius-md)',
                        border: `1px solid ${checked ? 'var(--sb-brand-200)' : '#EEEEF2'}`,
                        background: checked ? 'var(--sb-brand-50)' : 'var(--sb-neutral-25)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sb-space-2-5)' }}>
                        <input
                          type="checkbox"
                          checked={!!checked}
                          onChange={() => toggleSlice(planKey)}
                          style={{ width: 16, height: 16, cursor: 'pointer' }}
                        />
                        <span
                          style={{
                            fontSize: 'var(--sb-text-md)', fontWeight: 600,
                            color: checked ? 'var(--sb-brand-700)' : 'var(--sb-ink-2)',
                          }}
                        >
                          {s.emoji} {s.label}
                        </span>
                        <span style={{ fontSize: 'var(--sb-text-sm)', color: 'var(--sb-ink-3)' }}>{s.desc}</span>
                      </div>
                      {checked && (
                        <input
                          value={detailPlan.notes[planKey] || ''}
                          onChange={(e) => updSliceNote(planKey, e.target.value)}
                          placeholder="补一句自定义文案（选填）"
                          style={{
                            width: '100%', marginTop: 8, padding: '7px 10px',
                            border: '1px solid var(--sb-neutral-200)', borderRadius: 'var(--sb-radius-sm)', fontSize: 'var(--sb-text-sm)',
                            fontFamily: 'inherit', outline: '0 solid transparent', boxSizing: 'border-box',
                          }}
                          onFocus={(e) => { e.target.style.borderColor = 'var(--sb-brand-600)'; e.target.style.boxShadow = 'var(--sb-shadow-ring)'; }}
                          onBlur={(e) => { e.target.style.borderColor = 'var(--sb-neutral-200)'; e.target.style.boxShadow = ''; }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ⑤ 保养维护 */}
            <div style={SX.card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sb-space-2-5)', marginBottom: 8 }}>
                <div style={SX.stepNum}>5</div>
                <h3 style={{ ...SX.h3, marginBottom: 0 }}>保养维护描述</h3>
              </div>
              <p style={{ ...SX.hint, marginBottom: 12 }}>
                用一句话写保养方式，AI 生成 1 张保养说明切片。
              </p>
              <textarea
                value={maintenance}
                onChange={(e) => setMaintenance(e.target.value)}
                placeholder="避免暴晒、温水手洗、存放干燥处…"
                rows={2}
                style={{ ...SX.input, minHeight: 56, resize: 'vertical', fontSize: 'var(--sb-text-md)' }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--sb-brand-600)')}
                onBlur={(e) => (e.target.style.borderColor = '#D0D0D8')}
              />
            </div>

            {/* 平台选择 + 生成 */}
            <div style={SX.card}>
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 12,
                }}
              >
                <h3 style={{ ...SX.h3, marginBottom: 0 }}>
                  <Gear weight="fill" size={18} style={{ color: 'var(--sb-ink-3)' }} /> 目标平台
                </h3>
                <span style={{ fontSize: 'var(--sb-text-md)', color: 'var(--sb-ink-4)' }}>共 {total} 张</span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {['淘宝', '京东', '拼多多', '小红书电商', '抖音电商', '亚马逊'].map((p) => {
                  const d = dimSize(p, '1:1');
                  return (
                    <span
                      key={p}
                      /* 键盘可达三件套：平台 chip 是真按钮（点击=切换平台）。 */
                      role="button"
                      tabIndex={0}
                      onClick={() => setPlatform(p)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPlatform(p); } }}
                      style={{
                        padding: '6px 14px', borderRadius: 'var(--sb-radius-2xl)', fontSize: 'var(--sb-text-sm)', cursor: 'pointer',
                        fontFamily: 'inherit', border: '1.5px solid',
                        background: platform === p ? 'var(--sb-brand-50)' : 'var(--sb-neutral-0)',
                        borderColor: platform === p ? 'var(--sb-brand-600)' : 'var(--sb-neutral-200)',
                        color: platform === p ? 'var(--sb-brand-700)' : 'var(--sb-ink-3)',
                        fontWeight: platform === p ? 600 : 400,
                      }}
                    >
                      {p} · {d.w}×{d.h}
                    </span>
                  );
                })}
              </div>
              <button
                onClick={goPreview}
                disabled={!name.trim() || olLoad}
                style={{
                  width: '100%', padding: '16px 0', border: 'none', borderRadius: 'var(--sb-radius-lg)',
                  fontSize: 'var(--sb-text-lg)', fontWeight: 700, fontFamily: 'inherit',
                  cursor: !name.trim() || olLoad ? 'not-allowed' : 'pointer',
                  background: !name.trim() || olLoad ? 'var(--sb-neutral-200)' : 'var(--sb-brand-700)',
                  color: 'var(--sb-neutral-0)',
                  boxShadow: !name.trim() || olLoad ? 'none' : '0 4px 16px var(--sb-brand-a32)',
                }}
              >
                {olLoad ? '生成大纲中...' : `预览并生成（${total} 张）`}
              </button>
            </div>
          </div>
        )}

        {/* ═══════ PREVIEW ═══════ */}
        {phase === 'preview' && (
          <div style={SX.card}>
            <h3 style={{ ...SX.h3, marginBottom: 4 }}>📋 生成大纲 — 共 {ol.length} 张图</h3>
            <p style={{ ...SX.hint, marginBottom: 20 }}>
              每张图可自定义生成逻辑，确认后开始生成
            </p>
            {refShots.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 'var(--sb-text-sm)', color: 'var(--sb-ink-4)', marginBottom: 8 }}>
                  参考图（{refShots.length} 张）
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {refShots.map((s, i) => (
                    <div
                      key={i}
                      style={{
                        width: 44, height: 44, borderRadius: 'var(--sb-radius-sm)', overflow: 'hidden',
                        border: '1px solid #E8E8EC', cursor: 'pointer',
                      }}
                      role="button"
                      tabIndex={0}
                      onClick={() => setLb(s)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); () => setLb(s); } }}
                    >
                      <img src={s} alt="" width="120" height="120" loading="lazy" decoding="async" fetchpriority="auto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {ol.map((item, idx) => (
              <div
                key={idx}
                style={{
                  marginBottom: 10, padding: '12px 16px', borderRadius: 'var(--sb-radius-md)',
                  background: '#F8F9FA', border: '1px solid #EEEEF2',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span
                    style={{
                      width: 24, height: 24, borderRadius: 'var(--sb-radius-sm)', background: 'var(--sb-brand-700)', color: 'var(--sb-neutral-0)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 'var(--sb-text-xs)', fontWeight: 700, flexShrink: 0,
                    }}
                  >
                    {idx + 1}
                  </span>
                  <span style={{ fontSize: 'var(--sb-text-md)', fontWeight: 600, color: 'var(--sb-ink-1)' }}>
                    {item.emoji || ''} {item.label}
                  </span>
                </div>
                <textarea
                  value={item.userPrompt}
                  onChange={(e) => {
                    const v = e.target.value;
                    setOl((p) => p.map((o, i) => (i === idx ? { ...o, userPrompt: v } : o)));
                  }}
                  style={{
                    width: '100%', padding: '8px 12px', border: '1px solid var(--sb-neutral-200)',
                    borderRadius: 'var(--sb-radius-sm)', fontSize: 'var(--sb-text-sm)', fontFamily: 'inherit', outline: '0 solid transparent',
                    resize: 'vertical', minHeight: 40, boxSizing: 'border-box', background: 'var(--sb-neutral-0)',
                  }}
                  rows={2}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button
                onClick={() => setPhase('config')}
                style={{
                  flex: 1, padding: '13px 0', borderRadius: 'var(--sb-radius-md)', border: '1.5px solid var(--sb-neutral-200)',
                  background: 'var(--sb-neutral-0)', cursor: 'pointer', fontSize: 'var(--sb-text-md)', fontFamily: 'inherit',
                  color: 'var(--sb-ink-3)', fontWeight: 500,
                }}
              >
                ← 返回修改
              </button>
              <button
                onClick={goGen}
                disabled={generating}
                style={{
                  flex: 2, padding: '13px 0', borderRadius: 'var(--sb-radius-md)', border: 'none',
                  background: generating ? 'var(--sb-ink-5)' : 'var(--sb-success)', color: 'var(--sb-neutral-0)', cursor: generating ? 'wait' : 'pointer', fontSize: 'var(--sb-text-md)',
                  fontWeight: 600, fontFamily: 'inherit',
                  boxShadow: '0 2px 8px rgba(5,150,105,.2)',
                }}
              >
                ✅ 确认生成 {ol.length} 张
              </button>
            </div>
            {genProgress && (
              <div style={{ marginTop: 10, textAlign: 'center', fontSize: 'var(--sb-text-sm)', color: 'var(--sb-brand-700)' }}>{genProgress}</div>
            )}
            {Object.keys(inProgressPreview).length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                {Object.values(inProgressPreview).map(image => (
                  <img key={image.id} src={proxyImg(image.url)} alt={image.label || image.role || image.id} width="76" height="76" loading="lazy" decoding="async" fetchpriority="auto" style={{ width: 76, height: 76, objectFit: 'cover', borderRadius: 'var(--sb-radius-md)', border: '1px solid #D1FAE5' }} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════ RESULT ═══════ */}
        {phase === 'result' && res && (
          <div style={SX.card}>
            <div
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <div>
                <span style={{ fontSize: 'var(--sb-text-lg)', fontWeight: 600, color: 'var(--sb-success)' }}>✅ 生成完成</span>
                <span style={{ fontSize: 'var(--sb-text-md)', color: 'var(--sb-ink-4)', marginLeft: 8 }}>
                  {Object.keys(res.images || {}).length} 张图
                </span>
              </div>
              <button
                onClick={startNewProduct}
                style={{
                  padding: '8px 16px', borderRadius: 'var(--sb-radius-md)', border: '1px solid var(--sb-neutral-200)',
                  background: 'var(--sb-neutral-0)', cursor: 'pointer', fontSize: 'var(--sb-text-md)', fontFamily: 'inherit',
                  color: 'var(--sb-ink-3)',
                }}
              >
                继续生成
              </button>
            </div>
            {/* 拼长图按钮 */}
            {Object.keys(res.images || {}).some((k) => k.includes('detail_slice')) && (
              <div
                style={{
                  background: 'var(--sb-brand-50)', borderRadius: 'var(--sb-radius-md)', padding: '12px 16px',
                  marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontSize: 'var(--sb-text-md)', color: 'var(--sb-brand-700)', fontWeight: 500 }}>
                  📦 详情切片可拼成长图（微信分享用）
                </span>
                <button
                  onClick={goStitch}
                  disabled={stitching}
                  style={{
                    padding: '8px 16px', borderRadius: 'var(--sb-radius-sm)', background: 'var(--sb-brand-700)', color: 'var(--sb-neutral-0)',
                    border: 'none', fontSize: 'var(--sb-text-sm)', fontWeight: 600,
                    cursor: stitching ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                    opacity: stitching ? 0.6 : 1,
                  }}
                >
                  {stitching ? '拼接中...' : '🔗 拼成长图'}
                </button>
                {stitchUrl && (
                  <a
                    href={proxyImg(stitchUrl)}
                    /* 批 CY-⑮：原来这里是**裸 download**。`stitchLongImage` 走的是
                       generated-assets（URL 最后一段就是 64 位 sha256，且该路由不设
                       Content-Disposition）⇒ 浏览器直接拿它当文件名，用户下载到的是
                       一串乱码。改走共用的 downloadFileName。 */
                    download={downloadFileName({ title: results?.product_name || '长图', url: stitchUrl, index: 0, count: 1 })}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: '8px 16px', borderRadius: 'var(--sb-radius-sm)', background: 'var(--sb-success)',
                      color: 'var(--sb-neutral-0)', textDecoration: 'none', fontSize: 'var(--sb-text-sm)', fontWeight: 600,
                      display: 'inline-flex', alignItems: 'center', gap: 'var(--sb-space-1-5)',
                    }}
                  >
                    <Download weight="fill" size={14} /> 下载长图
                  </a>
                )}
                {stitchUrl && (
                  <img
                    src={proxyImg(stitchUrl)}
                    alt="长图预览"
                    style={{
                      width: '100%', marginTop: 8, borderRadius: 'var(--sb-radius-md)', border: '1px solid var(--sb-neutral-150)',
                    }}
                  />
                )}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {Object.entries(res.images || {}).map(([l, u]) => (
                <div
                  key={l}
                  style={{ borderRadius: 'var(--sb-radius-md)', overflow: 'hidden', border: '1px solid #EEEEF2' }}
                >
                  <div
                    /* 键盘可达三件套：缩略图点击=放大预览（cursor:zoom-in 已声明它是可点的）。 */
                    role="button"
                    tabIndex={0}
                    aria-label="放大预览"
                    style={{ cursor: 'zoom-in' }}
                    onClick={() => setLb(u)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setLb(u); } }}
                  >
                    <img
                      src={proxyImg(u)}
                      alt={l}
                      style={{
                        width: '100%', display: 'block', aspectRatio: '1/1',
                        objectFit: 'contain', background: '#f8f8f8',
                      }}
                      loading="lazy"
                    />
                  </div>
                  <div
                    style={{
                      padding: '10px 12px', display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', borderTop: '1px solid #EEEEF2',
                    }}
                  >
                    <span style={{ fontSize: 'var(--sb-text-sm)', fontWeight: 600, color: 'var(--sb-ink-3)' }}>{l}</span>
                    {regEdit.v && regEdit.l === l ? (
                      <div style={{ display: 'flex', gap: 'var(--sb-space-1-5)' }}>
                        <button
                          onClick={() => setRegEdit({ l: null, p: '', v: false })}
                          style={{
                            fontSize: 'var(--sb-text-xs)', padding: '4px 10px', borderRadius: 'var(--sb-radius-sm)',
                            border: '1px solid var(--sb-neutral-200)', background: 'var(--sb-neutral-0)', cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          取消
                        </button>
                        <button
                          onClick={() => goRegen(l, regEdit.p)}
                          disabled={!!regKey}
                          style={{
                            fontSize: 'var(--sb-text-xs)', padding: '4px 10px', borderRadius: 'var(--sb-radius-sm)', border: 'none',
                            background: 'var(--sb-brand-700)', color: 'var(--sb-neutral-0)', cursor: 'pointer',
                            fontFamily: 'inherit', opacity: regKey ? 0.5 : 1,
                          }}
                        >
                          {regKey ? '...' : '重新生成'}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          const p =
                            ol.find((o) => o.key === l.replace(/_\d+$/, '') || o.label === l)
                              ?.userPrompt || '';
                          setRegEdit({ l, p, v: true });
                        }}
                        style={{
                          fontSize: 'var(--sb-text-xs)', color: 'var(--sb-brand-700)', cursor: 'pointer',
                          padding: '4px 10px', borderRadius: 'var(--sb-radius-sm)', background: 'var(--sb-brand-50)',
                          border: 'none', fontFamily: 'inherit',
                        }}
                      >
                        重新生成
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lightbox */}
        {lb && (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 'var(--sb-z-modal)', background: 'rgba(12,10,9,.92)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
            role="button"
            tabIndex={0}
            onClick={() => setLb(null)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); () => setLb(null); } }}
          >
            <img
              src={lb.startsWith('data:') ? lb : proxyImg(lb)}
              style={{
                maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 'var(--sb-radius-lg)',
              }}
              alt=""
            />
          </div>
        )}

        <div style={{ marginTop: 48 }}>
          <Footer />
        </div>
      </div>
    </div>
  );
}

// ── 图片上传小组件（实拍图/参考图共用） ──
// 4c183cd4 续命 P-H: 支持 1-click 拖入 (highlight on dragover + drop 接入)
function ImageUploader({ imgs, max, onPick, onDel, onPreview, dropTargetKey = '', onDragOverTarget, onDragLeaveTarget, onDropAsset }) {
  const isDragOver = dropTargetKey !== '';
  return (
    <>
      {imgs.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {imgs.map((s, i) => (
            <div
              key={i}
              style={{
                position: 'relative', width: 72, height: 72, borderRadius: 'var(--sb-radius-md)', overflow: 'hidden',
                border: '1px solid #E8E8EC', cursor: 'pointer',
              }}
              /* 键盘可达三件套：上传的缩略图点击=预览（cursor:pointer 已声明它是可点的）。 */
              role="button"
              tabIndex={0}
              aria-label="预览这张图"
              onClick={() => onPreview(s)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPreview(s); } }}
            >
              <img src={s} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div
                /* 键盘可达三件套：删除角标是真的动作按钮（stopPropagation 只是避免冒泡到父级预览）。 */
                role="button"
                tabIndex={0}
                aria-label="删除这张图"
                onClick={(e) => {
                  e.stopPropagation();
                  onDel(i);
                }}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDel(i); } }}
                style={{
                  position: 'absolute', top: 2, right: 2, width: 18, height: 18,
                  borderRadius: '50%', background: 'var(--sb-danger)', color: 'var(--sb-neutral-0)', fontSize: 'var(--sb-text-2xs)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', border: 'none', fontWeight: 700,
                }}
              >
                ×
              </div>
            </div>
          ))}
        </div>
      )}
      <div
        role="button"
        tabIndex={0}
        onClick={onPick}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick; } }}
        onDragOver={(e) => {
          if (!dropTargetKey) return;
          e.preventDefault();
          try { e.dataTransfer.dropEffect = 'copy'; } catch (err) {}
          onDragOverTarget?.(dropTargetKey);
        }}
        onDragLeave={(e) => {
          if (!dropTargetKey) return;
          onDragLeaveTarget?.(dropTargetKey, e);
        }}
        onDrop={(e) => {
          if (!dropTargetKey) return;
          e.preventDefault();
          let payload = null;
          try {
            const raw = e.dataTransfer.getData('application/x-shubao-asset');
            if (raw) payload = JSON.parse(raw);
          } catch (err) { payload = null; }
          if (!payload) return;
          onDropAsset?.(payload);
        }}
        style={{
          border: isDragOver ? '2px dashed var(--sb-brand-700)' : '2px dashed var(--sb-neutral-200)',
          borderRadius: 'var(--sb-radius-lg)', padding: '24px',
          textAlign: 'center', cursor: 'pointer',
          background: isDragOver ? 'var(--sb-brand-50)' : 'var(--sb-neutral-25)',
          transition: 'all .15s', color: isDragOver ? 'var(--sb-brand-700)' : 'var(--sb-ink-5)',
          boxShadow: isDragOver ? '0 0 0 4px var(--sb-brand-a10) inset' : 'none',
        }}
        onMouseEnter={(e) => {
          if (isDragOver) return;
          e.currentTarget.style.borderColor = 'var(--sb-brand-600)';
          e.currentTarget.style.background = 'var(--sb-brand-50)';
          e.currentTarget.style.color = 'var(--sb-brand-600)';
        }}
        onMouseLeave={(e) => {
          if (isDragOver) return;
          e.currentTarget.style.borderColor = 'var(--sb-neutral-200)';
          e.currentTarget.style.background = 'var(--sb-neutral-25)';
          e.currentTarget.style.color = 'var(--sb-ink-5)';
        }}
        data-testid={`image-uploader-${dropTargetKey || 'default'}`}
        aria-label={isDragOver ? `拖入到 ${dropTargetKey === 'real' ? '实拍图' : '参考图'}` : undefined}
      >
        <Upload
          weight="fill"
          size={22}
          style={{ display: 'block', margin: '0 auto 6px', color: 'inherit' }}
        />
        <div style={{ fontSize: 'var(--sb-text-md)', fontWeight: 500, color: 'inherit' }}>
          {isDragOver ? '松开放入' : `点击上传（${imgs.length}/${max}）`}
        </div>
      </div>
    </>
  );
}
