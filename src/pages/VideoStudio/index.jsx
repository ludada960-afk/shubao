import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Aperture,
  Check,
  ChevronDown,
  Clapperboard,
  FileAudio,
  ImagePlus,
  Loader2,
  Lock,
  Mic2,
  Play,
  RefreshCw,
  Settings2,
  Sparkles,
  Upload,
  Video,
  Volume2,
  X,
} from 'lucide-react';
import MentionPromptField from '../../components/creation/MentionPromptField.jsx';
import { applyCanvasSkill } from '../EcCanvas/canvasStudioModel.js';
/* 2026-09-16 用户批注（图7-①）：视频侧自己那套 @ 触发器 + 弹出菜单**已删除**，
   改用全站共用的 ImageMentionPicker（电商生图 / 小红书图文 / 视频生成 三处同一个实现）。
   删它的原因不是样式，是逻辑：视频侧「点外面就关」只认底栏容器 quickToolsRef，
   而那个 @ 菜单挂在输入框下面那一行 —— 菜单项一按下就被判成「点了外面」→ 菜单卸载 →
   click 永远不会触发。用户看到的「有素材、能点开、点了没反应 = 死按钮」就是它。
   共用组件早就把判定做对了（rootRef + menuRef 双包含），所以正确修法是**把逻辑拿过来用**。 */
import ImageMentionPicker from '../../components/creation/ImageMentionPicker.jsx';
import { useApp } from '../../store/AppContext.jsx';
import { quoteBillingAction } from '../../services/billing.js';
import { stableCanvasActionId } from '../../services/api.js';
import {
  analyzeVideoPlan,
  createVideoJob,
  fetchVideoCapabilities,
  getVideoJob,
  listVideoJobs,
  createImmediateMediaPreview,
  createVideoAssetUpload,
} from '../../services/video.js';
import {
  VIDEO_CREATION_MODES,
  hasRequiredVideoInputs,
  quoteForVideoProduct,
  resolveVideoApiMode,
  snapVideoDuration,
  videoDurationRange,
} from './videoStudioModel.js';
import { buildVideoPlan, VIDEO_PROMPT_MAX_LENGTH } from './videoPlanModel.js';
import SkillLibraryModal from '../Home/ec/SkillLibraryModal.jsx';
import ModelLogo from '../../components/ModelLogo.jsx';
import { brandLogo, videoProductLogo } from '../../services/modelLogos.js';
import { inspectVideoPlanningFiles } from './videoAssetAnalysis.js';
import VideoProjectWorkbench from './VideoProjectWorkbench.jsx';
import VideoCanvasWorkbench from './VideoCanvasWorkbench.jsx';
import DirectorWorkbench from './DirectorWorkbench.jsx';
import './VideoStudio.css';

/* ═══ 视频素材 → @ 引用项（共用 ImageMentionPicker 的口子）═══
   视频侧的命名是「图片1 / 视频1 / 音频1」（见 mentionedAssets），与电商的「产品图N / 参考图N」不同 ——
   这里只补齐组件需要的最小字段，**绝不重命名**：引用标签必须与输入框里渲染出的 token
   逐字一致，重命名等于「插进去的字在框里匹配不上」，那就又变成一次点了没反应。 */
function videoMentionItems(list) {
  return (Array.isArray(list) ? list : []).map((item, index) => {
    const id = item?.id || item?.sourceNodeId || 'video-asset-' + (index + 1);
    const name = item?.name || '素材' + (index + 1);
    return {
      ...item,
      id,
      sourceNodeId: item?.sourceNodeId || id,
      name,
      label: item?.label || '@' + name,
      kindLabel: item?.kind === 'video' ? '镜头参考' : item?.kind === 'audio' ? '声音参考' : '视觉参考',
    };
  });
}

/* 菜单行自绘：视频素材没有统一缩略图（音频根本没有），所以用类型图标 + 名称 + 用途。 */
function renderVideoMentionItem(item) {
  const Icon = item?.kind === 'video' ? Video : item?.kind === 'audio' ? FileAudio : ImagePlus;
  return <React.Fragment>
    <span className="image-mention-kind" aria-hidden="true"><Icon size={15} /></span>
    <span><b>{item.name}</b><small>{item.kindLabel}</small></span>
  </React.Fragment>;
}

const RATIOS = ['9:16', '16:9', '1:1', '4:3', '3:4', '21:9'];
const FINAL = new Set(['completed', 'failed', 'needs_review']);
/* 方案分析固定 1 积分（与计费 SKU video_plan_analysis 一致），显示在按钮上而不是写死在说明里 */
const ANALYSIS_POINTS = 1;

const TOOLBAR_ITEMS = [
  /* 9-11 三轮用户批注: 技能库必须是一级入口 (与首页一致), 不藏在生成设置里 */
  { key: 'skills', label: '技能库', icon: Sparkles, description: '选择生视频技能，带完整提示词进入本次生成' },
  { key: 'shot', label: '镜头规格', icon: Aperture, description: '设置画幅与成片时长' },
  /* 9-16 用户批注（图 #5）：「默认就是视频会生成声音的呀，为什么我们自己要做一个生成声音这样子的东西呢」
     —— 主流程撤下这个开关，`sound` 状态默认 true（上游 generate_audio 默认就是 true），
     只有产品明确不支持时才由代码自动关（见 frameAudio 分支）。 */
  { key: 'settings', label: '生成设置', icon: Settings2, description: '设置清晰度与高级约束' },
];
const VIDEO_MODE_ICONS = Object.freeze({
  smart: Sparkles,
  frame: Aperture,
  remake: RefreshCw,
});

function fileKind(file) {
  const type = String(file?.type || '').toLowerCase();
  const name = String(file?.name || '').toLowerCase();
  if (type.startsWith('image/') || /\.(png|jpe?g|webp|gif|avif)$/.test(name)) return 'image';
  if (type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/.test(name)) return 'video';
  if (type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|flac)$/.test(name)) return 'audio';
  return '';
}

function MediaPreview({ file, upload }) {
  const [source, setSource] = useState('');
  const previewRef = useRef(null);
  const kind = fileKind(file);

  useEffect(() => {
    if (!file) return undefined;
    const preview = createImmediateMediaPreview(file);
    previewRef.current = preview;
    setSource(preview.url);
    return () => {
      preview.revoke();
      if (previewRef.current === preview) previewRef.current = null;
    };
  }, [file]);

  useEffect(() => {
    if (!upload.asset?.url || !previewRef.current) return;
    previewRef.current.revoke();
    previewRef.current = null;
    setSource('');
  }, [upload.asset?.url]);

  const persistedSource = upload.asset?.url || source;
  if (kind === 'image' && persistedSource) return <img className="video-media-preview" src={persistedSource} alt="" />;
  if (kind === 'video' && persistedSource) return <video className="video-media-preview" src={persistedSource} muted preload="metadata" />;
  return <span className="video-media-audio-preview"><FileAudio size={25} /><small>{kind === 'audio' ? '音频' : '素材'}</small></span>;
}


function MediaLightbox({ entry, onClose }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!entry) { setUrl(''); return undefined; }
    if (entry.upload?.asset?.url) { setUrl(entry.upload.asset.url); return undefined; }
    const preview = createImmediateMediaPreview(entry.file);
    setUrl(preview.url);
    return () => preview.revoke();
  }, [entry]);
  if (!entry) return null;
  const kind = fileKind(entry.file);
  return <div className="video-lightbox" role="dialog" aria-modal="true" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="video-lightbox-body">
      <header><strong>{entry.file.name}</strong><button type="button" className="video-lightbox-close" aria-label="关闭预览" onClick={onClose}><X size={16} /></button></header>
      {kind === 'image' && url ? <img src={url} alt={entry.file.name} /> : null}
      {kind === 'video' && url ? <video src={url} controls autoPlay /> : null}
      {kind === 'audio' && url ? <div className="video-lightbox-audio"><FileAudio size={42} /><audio src={url} controls autoPlay /></div> : null}
      <footer>Esc 或点击空白处关闭</footer>
    </div>
  </div>;
}

function UploadStatus({ upload, onRetry }) {
  if (!upload) return null;
  if (upload.status === 'uploading') return <span className="video-upload-status is-uploading">
    <span>上传中 {upload.progress || 0}%</span><i><b style={{ width: `${upload.progress || 0}%` }} /></i>
  </span>;
  if (upload.status === 'error') return <button type="button" className="video-upload-status is-error" onClick={event => {
    event.preventDefault();
    event.stopPropagation();
    onRetry?.();
  }}><RefreshCw size={11} />重试上传</button>;
  if (upload.status === 'completed') return <span className="video-upload-status is-completed" title="已上传"><Check size={11} /></span>;
  return null;
}

function FilePicker({ accept, icon: Icon, label, files, multiple = false, onChange, onRemove, inputRef, upload, onRetry, onPreview }) {
  const file = files[0];
  return <div className={`video-media-card video-media-picker${file ? ' has-file' : ''}`} title={file ? '双击预览' : undefined} onDoubleClick={() => { if (file && onPreview) onPreview({ file }); }}>
    <label className="video-media-picker-control">
      <input ref={inputRef} type="file" accept={accept} multiple={multiple} onChange={event => {
        onChange(Array.from(event.target.files || []));
        event.target.value = '';
      }} />
      {file ? <MediaPreview file={file} upload={upload || {}} /> : <>
        <span className="video-media-add-icon"><Icon size={20} /></span>
        <strong>{label}</strong>
        <small>点击选择文件</small>
      </>}
      {file && <span className="video-media-caption">{files.length > 1 ? `${label} · ${files.length} 个` : label}</span>}
    </label>
    {file && <UploadStatus upload={upload} onRetry={onRetry} />}
    {file && onRemove && <button type="button" className="video-media-remove" aria-label={`移除${label}`} onClick={onRemove}><X size={14} /></button>}
  </div>;
}

function jobStatus(job) {
  if (job?.status === 'completed') return '成片已交付';
  if (job?.status === 'failed') return '未交付，积分已退回';
  if (job?.status === 'reconciling') return '未交付，账务处理中';
  if (job?.status === 'needs_review') return '受理结果确认中';
  if (job?.status === 'processing') return `生成中 ${job.progress || 0}%`;
  return '正在提交';
}

function jobRecordStatus(job) {
  const status = jobStatus(job);
  return job?.projectId ? `项目已保存 · ${status}` : status;
}

/* 9-11 用户批注: 视频模型的 LOGO 不对 → 用真实品牌标 (字节 / MiniMax / 可灵 / Google / 通义 / xAI),
   取不到官方标识的品牌走同尺寸品牌色字标兜底。 */
function VideoModelMark({ product = null, provider = '' }) {
  const logo = videoProductLogo(product) || (String(provider).toLowerCase().includes('minimax') ? brandLogo('minimax') : brandLogo('bytedance'));
  return <span className="video-model-mark" aria-hidden="true">
    <ModelLogo logo={logo} size={18} />
  </span>;
}

function VideoPlanModal({ plan, onClose, onConfirm }) {
  if (!plan) return null;
  return createPortal(<div className="video-plan-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="video-plan-modal" role="dialog" aria-modal="true" aria-labelledby="video-plan-title">
      <header className="video-plan-header">
        <div><span className="video-plan-eyebrow"><Sparkles size={14} />素材分析与生成前方案</span><h2 id="video-plan-title">先确认素材怎么用、镜头怎么走</h2><p>{plan.analyzed ? '已完成真实素材分析，本次分析已结算 1 AI 积分；正式成片费用尚未冻结。' : '先补齐必要输入，再进行 1 AI 积分的真实素材分析。'}</p></div>
        <button type="button" className="video-plan-close" aria-label="关闭生成方案" onClick={onClose}><X size={18} /></button>
      </header>
      <div className="video-plan-summary">
        <div><small>创作路径</small><strong>{plan.laneLabel}</strong></div>
        <div><small>输出规格</small><strong>{plan.output.ratio} · {plan.output.duration} 秒 · {plan.output.resolution.toUpperCase()}</strong></div>
        <div><small>素材数量</small><strong>{plan.assets.length ? `${plan.assets.length} 个已编排` : '无上传素材'}</strong></div>
      </div>
      <div className="video-plan-body">
        <section className="video-plan-section"><div className="video-plan-section-title"><strong>素材如何进入镜头</strong><span>{plan.mode === 'frame' ? '精确起止' : plan.analyzed ? '逐项识别' : '按角色引用'}</span></div><div className="video-plan-material-map">{(plan.analyzed && plan.assets.length ? plan.assets : plan.materialMap).map((item, index) => <div className="video-plan-material-item" key={`${item.name || item.label}-${index}`}><span>{item.role || item.label}</span><strong>{item.name || item.detail}</strong><small>{item.use || (item.count ? `${item.count} 个` : '待补充')}</small>{item.observations?.length > 0 && <p>{item.observations.join('；')}</p>}</div>)}</div></section>
        <section className="video-plan-section"><div className="video-plan-section-title"><strong>镜头节奏</strong><span>{plan.analyzed ? '多模态分析' : '等待分析'}</span></div><div className="video-plan-beats">{plan.beats.map(beat => <article key={`${beat.time}-${beat.label}`}><span>{beat.time}</span><div><strong>{beat.label}</strong><p>{beat.detail}</p>{beat.camera && <p>镜头：{beat.camera}</p>}{beat.audio && <p>声音：{beat.audio}</p>}</div><small>{beat.source}</small></article>)}</div></section>
        {plan.analyzed && (plan.creativeStrategy || plan.risks?.length > 0) && <section className="video-plan-section video-plan-notices"><div className="video-plan-section-title"><strong>策略与风险</strong><span>提交前可返回调整</span></div>{plan.creativeStrategy && <div className="video-plan-strategy">{plan.creativeStrategy}</div>}{plan.risks?.map((item, index) => <div className="video-plan-notice" key={`${item}-${index}`}><Aperture size={15} /><span><strong>需要留意</strong><small>{item}</small></span></div>)}</section>}
        {(plan.blockers.length > 0 || plan.warnings.length > 0) && <section className="video-plan-section video-plan-notices"><div className="video-plan-section-title"><strong>提交前检查</strong><span>{plan.blockers.length ? `${plan.blockers.length} 项待处理` : '可以继续'}</span></div>{plan.blockers.map(item => <div className="video-plan-notice is-blocking" key={item.code}><X size={15} /><span><strong>{item.title}</strong><small>{item.detail}</small></span></div>)}{plan.warnings.map(item => <div className="video-plan-notice" key={item.code}><Aperture size={15} /><span><strong>{item.title}</strong><small>{item.detail}</small></span></div>)}</section>}
      </div>
      {/* 9-18（P0）「值对了，覆盖面没到」——本处原先自写 footer（自写 flex/gap/高度/圆角/渐变主按钮），
          现改用契约类；主按钮由**双色渐变**改为**品牌实底纯色**（D1：渐变禁用于功能按钮），
          与次按钮的重量差随之收敛。 */}
      <div className="ui-modal-footer is-lg video-plan-footer">
        <span className="ui-modal-footer-meta">{plan.cost ? `成片预计 ${Math.ceil(Number(plan.cost.units || 0) / 1000)} AI 积分，点击开始生成后才会冻结` : '成片报价加载中，提交时会再次校验费用'}</span>
        <div className="ui-modal-footer-actions">
          <button type="button" className="ui-btn ui-btn-secondary" onClick={onClose}>返回调整</button>
          <button type="button" className="ui-btn ui-btn-primary" disabled={!plan.ready || !plan.analyzed} onClick={onConfirm}><Check size={16} />确认生成方案</button>
        </div>
      </div>
    </section>
  </div>, document.body);
}

export default function VideoStudioPage({ embedded = false }) {
  const { state, dispatch, refreshBillingBalance } = useApp();
  const [capabilities, setCapabilities] = useState({ loading: true, generationEnabled: false, workbenchEnabled: false, workbenchMode: 'planning', workbenchPlanningOnly: false });
  const [activeVideoProjectId, setActiveVideoProjectId] = useState('');
  const [activeVideoPlanHash, setActiveVideoPlanHash] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [mode, setMode] = useState('smart');
  const [files, setFiles] = useState({ first: [], last: [], images: [], videos: [], audios: [] });
  const [prompt, setPrompt] = useState('');
  const [userSkills, setUserSkills] = useState([]);
  const [skillOpen, setSkillOpen] = useState(false);
  const [negativePrompt, setNegativePrompt] = useState('');
  const [resolution, setResolution] = useState('720p');
  const [ratio, setRatio] = useState('9:16');
  /* 默认 5 秒：上游按秒档位校验（seedance 2.0 只认 5/10/15），
     原来写死 8 秒会让默认状态就落在上游拒收的秒数上。 */
  const [duration, setDuration] = useState(5);
  const [sound, setSound] = useState(true);
  const [seed, setSeed] = useState(0);
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState('');
  const [job, setJob] = useState(null);
  const [history, setHistory] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [planOpen, setPlanOpen] = useState(false);
  const [planReviewed, setPlanReviewed] = useState(false);
  const [analyzedPlan, setAnalyzedPlan] = useState(null);
  const [analyzedSignature, setAnalyzedSignature] = useState('');
  const [plannedUploads, setPlannedUploads] = useState(null);
  const [planning, setPlanning] = useState(false);
  const [activePanel, setActivePanel] = useState(null);
  const [inlineMenu, setInlineMenu] = useState(null);
  const [panelPosition, setPanelPosition] = useState({ left: 16, bottom: 80, width: 520, maxHeight: 560, anchor: 260 });
  const pollRef = useRef(null);
  const toolbarRef = useRef(null);
  const quickToolsRef = useRef(null);
  const promptFieldRef = useRef(null);
  const firstFrameInputRef = useRef(null);
  const lastFrameInputRef = useRef(null);
  const buttonRefs = useRef({});
  const openedJobRef = useRef('');
  const uploadsRef = useRef(new Map());
  const [uploadRevision, setUploadRevision] = useState(0);

  const products = Array.isArray(capabilities.products) ? capabilities.products : [];
  const selectedProduct = products.find(product => product.id === selectedProductId)
    || products.find(product => product.id === capabilities.defaultProductId)
    || products[0]
    || null;
  const selectedQuote = useMemo(() => {
    if (!selectedProduct) return null;
    try {
      return quoteForVideoProduct(selectedProduct, duration);
    } catch {
      return null;
    }
  }, [duration, selectedProduct]);
  const sku = selectedQuote?.sku || '';
  const estimatedPoints = Math.ceil(Number(quote?.totalUnits ?? selectedQuote?.units ?? 0) / 1000);
  /* ═══ 2026-09-16 用户批注（图2-② / 图3-①，已问到第三次）═══
     原话：「现在不是已经有预设了一套方案在这里吗？为什么你的积分还是一积分呢？这个问题你怎么还是
     没有回答我呀？……肯定是按他整个视频要收多少钱去告诉他呀。」
     参考流影AI：480P/720P/1080P 各对应 120/210/525，换档位按钮上的数字立刻变。
     这里把「整个任务要花多少」算出来挂在按钮上（方案分析费 + 成片预估）：
       · 未确认方案 → 按钮「分析并生成方案」，积分 = 1 + 成片预估（这一档就会随模型/时长变）；
       · 已确认方案 → 按钮「开始生成」，积分 = 成片预估（服务端报价，唯一事实源）。
     ⚠️ 拆分说明放 title，按钮上只留一个总数 —— 用户要的是「我这一下要花多少」。 */
  const totalJobPoints = estimatedPoints > 0 ? estimatedPoints + ANALYSIS_POINTS : 0;
  const videoPlan = useMemo(() => buildVideoPlan({
    mode,
    prompt,
    files,
    duration,
    ratio,
    resolution,
    sound,
    product: selectedProduct,
  }), [duration, files, mode, prompt, ratio, resolution, selectedProduct, sound]);
  const planSignature = useMemo(() => JSON.stringify({
    productId: selectedProduct?.id || '', mode, prompt, negativePrompt, duration, ratio, resolution, sound, seed,
    files: Object.fromEntries(Object.entries(files).map(([key, items]) => [key, (items || []).map(file => ({ name: file.name, size: file.size, type: file.type, modified: file.lastModified }))])),
  }), [duration, files, mode, negativePrompt, prompt, ratio, resolution, seed, selectedProduct?.id, sound]);
  const activeAnalysis = analyzedSignature === planSignature ? analyzedPlan : null;
  const effectivePlan = useMemo(() => activeAnalysis ? {
    ...videoPlan,
    ...activeAnalysis,
    assets: activeAnalysis.assets?.length ? activeAnalysis.assets : videoPlan.assets,
    beats: activeAnalysis.beats?.length ? activeAnalysis.beats : videoPlan.beats,
    analyzed: true,
  } : { ...videoPlan, analyzed: false }, [activeAnalysis, videoPlan]);

  useEffect(() => {
    if (analyzedSignature && analyzedSignature !== planSignature) {
      setPlanReviewed(false);
      setPlanOpen(false);
    }
    setActiveVideoPlanHash('');
  }, [analyzedSignature, planSignature]);

  useEffect(() => {
    fetchVideoCapabilities()
      .then(result => {
        setCapabilities(result);
        const available = Array.isArray(result.products) ? result.products : [];
        setSelectedProductId(current => (
          available.some(product => product.id === current)
            ? current
            : result.defaultProductId || available[0]?.id || ''
        ));
      })
      .catch(() => setCapabilities({ loading: false, generationEnabled: false, workbenchEnabled: false, workbenchMode: 'planning', workbenchPlanningOnly: false }));
  }, [state.logged]);

  useEffect(() => {
    if (!state.logged || state.browserQa) {
      setHistory([]);
      return;
    }
    listVideoJobs().then(result => setHistory(result.jobs || [])).catch(() => {});
  }, [state.logged, state.browserQa]);

  useEffect(() => {
    let active = true;
    setQuote(null);
    setQuoteError('');
    if (!sku) return () => { active = false; };
    quoteBillingAction({ sku, quantity: 1 })
      .then(result => { if (active) setQuote(result.quote); })
      .catch(() => { if (active) setQuoteError('费用确认暂时不可用'); });
    return () => { active = false; };
  }, [sku]);

  useEffect(() => {
    if (!selectedProduct) return;
    setDuration(current => snapVideoDuration(selectedProduct, current));
    if (!selectedProduct.resolutions?.includes(resolution)) {
      setResolution(selectedProduct.resolutions?.[0] || '720p');
    }
    if (!selectedProduct.modes?.includes(resolveVideoApiMode(mode, files))) setMode('smart');
    if (mode === 'frame' && selectedProduct.frameAudio === false) setSound(false);
  }, [selectedProductId]);

  useEffect(() => () => clearTimeout(pollRef.current), []);

  const positionPanel = useCallback((key = activePanel) => {
    if (!key) return;
    const button = buttonRefs.current[key];
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const preferred = key === 'settings' ? 600 : key === 'assets' ? 580 : 520;
    const width = Math.min(Math.max(360, preferred), viewportWidth - 24);
    const left = Math.max(12, Math.min(rect.left + rect.width / 2 - width / 2, viewportWidth - width - 12));
    setPanelPosition({
      left,
      bottom: Math.max(12, window.innerHeight - rect.top + 12),
      width,
      maxHeight: Math.max(280, Math.min(590, rect.top - 24)),
      anchor: Math.max(28, Math.min(width - 28, rect.left + rect.width / 2 - left)),
    });
  }, [activePanel]);

  const openPanel = useCallback((key) => {
    /* 9-11 三轮批注: 技能库是一级入口 (直接弹技能库, 不再是浮层面板) */
    if (key === 'skills') {
      setActivePanel(null);
      setSkillOpen(current => !current);
      return;
    }
    if (activePanel === key) {
      setActivePanel(null);
      return;
    }
    positionPanel(key);
    setActivePanel(key);
  }, [activePanel, positionPanel]);

  useEffect(() => {
    if (!activePanel) return undefined;
    const handlePointerDown = (event) => {
      if (event.target.closest?.('.video-config-panel')) return;
      if (event.target.closest?.('.video-config-trigger')) return;
      setActivePanel(null);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setActivePanel(null);
    };
    const handleViewportChange = () => positionPanel();
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [activePanel, positionPanel]);

  useEffect(() => {
    if (!inlineMenu) return undefined;
    const closeMenu = event => {
      /* ⚠️ 这里曾经只认 quickToolsRef（底栏工具区）。
         视频侧那个 @ 菜单挂在输入框下面那一行，不在底栏里 —— 菜单项一按下就被判成「点了外面」、
         菜单卸载、click 永不触发（就是用户报的「死按钮」）。
         @ 现在换成共用组件（自己管开合），但这条判定对**其它内联菜单**仍是同一个坑，
         所以改成按「内联控件容器」判，而不是按「底栏」判。 */
      const target = event.target;
      if (target instanceof Element && target.closest('.video-inline-control, .video-inline-menu')) return;
      if (quickToolsRef.current?.contains(target)) return;
      setInlineMenu(null);
    };
    const closeOnEscape = event => {
      if (event.key === 'Escape') setInlineMenu(null);
    };
    document.addEventListener('pointerdown', closeMenu);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeMenu);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [inlineMenu]);

  const refreshUploads = useCallback(() => setUploadRevision(value => value + 1), []);

  const startUpload = useCallback((file, kind, { force = false } = {}) => {
    const current = uploadsRef.current.get(file);
    if (current && !force) {
      if (current.asset) return Promise.resolve(current.asset);
      if (current.status === 'uploading') return current.promise;
    }
    current?.abort?.();
    const entry = { file, kind, status: 'uploading', progress: 0, asset: null, error: null, promise: null, abort: null };
    const operation = createVideoAssetUpload(file, kind, {
      resumable: capabilities.uploadMode !== 'direct',
      onProgress({ progress }) {
        if (uploadsRef.current.get(file) !== entry) return;
        entry.progress = progress;
        refreshUploads();
      },
    });
    entry.abort = operation.abort;
    entry.promise = operation.promise.then(asset => {
      if (uploadsRef.current.get(file) === entry) {
        entry.status = 'completed';
        entry.progress = 100;
        entry.asset = asset;
        refreshUploads();
      }
      return asset;
    }).catch(uploadError => {
      if (uploadsRef.current.get(file) === entry) {
        entry.status = uploadError?.name === 'AbortError' ? 'cancelled' : 'error';
        entry.error = uploadError;
        refreshUploads();
      }
      throw uploadError;
    });
    entry.promise.catch(() => {});
    uploadsRef.current.set(file, entry);
    refreshUploads();
    return entry.promise;
  }, [capabilities.uploadMode, refreshUploads]);

  const ensureUpload = useCallback((file, kind) => {
    const current = uploadsRef.current.get(file);
    if (current?.asset) return Promise.resolve(current.asset);
    if (current?.status === 'uploading') return current.promise;
    return startUpload(file, kind, { force: true });
  }, [startUpload]);

  const retryUpload = useCallback((file, kind) => {
    if (!file) return;
    void startUpload(file, kind, { force: true }).catch(() => {});
  }, [startUpload]);

  const uploadFor = useCallback(file => uploadsRef.current.get(file), []);
  const [lightboxEntry, setLightboxEntry] = useState(null);
  const uploadRecords = useMemo(() => Array.from(uploadsRef.current.values()), [uploadRevision]);

  useEffect(() => {
    if (!state.logged) {
      uploadsRef.current.forEach(entry => entry.abort?.());
      uploadsRef.current.clear();
      refreshUploads();
      return undefined;
    }
    const selected = new Map();
    Object.entries(files).forEach(([key, items]) => {
      const kind = key === 'videos' ? 'video' : key === 'audios' ? 'audio' : 'image';
      items.forEach(file => selected.set(file, kind));
    });
    selected.forEach((kind, file) => {
      if (!uploadsRef.current.has(file)) void startUpload(file, kind).catch(() => {});
    });
    uploadsRef.current.forEach((entry, file) => {
      if (selected.has(file)) return;
      entry.abort?.();
      uploadsRef.current.delete(file);
    });
    refreshUploads();
    return undefined;
  }, [files, refreshUploads, startUpload, state.logged]);

  useEffect(() => () => {
    uploadsRef.current.forEach(entry => entry.abort?.());
    uploadsRef.current.clear();
  }, []);

  function replaceFiles(key, next, limit) {
    setPlanReviewed(false);
    setPlannedUploads(null);
    setFiles(current => {
      if (!['images', 'videos', 'audios'].includes(key)) return { ...current, [key]: next.slice(0, limit) };
      const occupied = ['images', 'videos', 'audios']
        .filter(itemKey => itemKey !== key)
        .reduce((sum, itemKey) => sum + current[itemKey].length, 0);
      return { ...current, [key]: next.slice(0, Math.min(limit, Math.max(0, 9 - occupied))) };
    });
  }

  function removeFile(key, index) {
    setPlanReviewed(false);
    setPlannedUploads(null);
    setFiles(current => ({ ...current, [key]: current[key].filter((_, itemIndex) => itemIndex !== index) }));
  }

  function appendQuickFiles(items) {
    setPlanReviewed(false);
    setPlannedUploads(null);
    setFiles(current => {
      if (mode === 'frame') {
        const images = items.filter(file => fileKind(file) === 'image');
        const frames = [...current.first, ...current.last, ...images].slice(0, 2);
        return { ...current, first: frames.slice(0, 1), last: frames.slice(1, 2) };
      }
      const available = Math.max(0, 9 - current.images.length - current.videos.length - current.audios.length);
      const accepted = items.filter(file => fileKind(file)).slice(0, available);
      return {
        ...current,
        images: [...current.images, ...accepted.filter(file => fileKind(file) === 'image')],
        videos: [...current.videos, ...accepted.filter(file => fileKind(file) === 'video')],
        audios: [...current.audios, ...accepted.filter(file => fileKind(file) === 'audio')],
      };
    });
  }

  async function uploadFiles(items, kind) {
    return Promise.all(items.map(file => ensureUpload(file, kind)));
  }

  async function poll(id) {
    clearTimeout(pollRef.current);
    try {
      const next = (await getVideoJob(id)).job;
      setJob(next);
      setHistory(current => [next, ...current.filter(item => item.id !== next.id)].slice(0, 20));
      if (FINAL.has(next.status)) {
        await refreshBillingBalance?.({ force: true }).catch(() => {});
        return;
      }
      pollRef.current = setTimeout(() => poll(id), 5000);
    } catch {
      pollRef.current = setTimeout(() => poll(id), 8000);
    }
  }

  async function handleGenerate() {
    if (submitting || !quote?.quoteId || !planReviewed || !effectivePlan.ready || !activeAnalysis || analyzedSignature !== planSignature) return;
    setError('');
    setSubmitting(true);
    try {
      const selected = mode === 'frame'
        ? { first: files.first, last: files.last, images: [], videos: [], audios: [] }
        : { first: [], last: [], images: files.images, videos: files.videos, audios: files.audios };
      const reusable = plannedUploads?.signature === planSignature ? plannedUploads.assets : null;
      const [first, last, images, videos, audios] = reusable
        ? [reusable.first, reusable.last, reusable.images, reusable.videos, reusable.audios]
        : await Promise.all([
          uploadFiles(selected.first, 'image'),
          uploadFiles(selected.last, 'image'),
          uploadFiles(selected.images, 'image'),
          uploadFiles(selected.videos, 'video'),
          uploadFiles(selected.audios, 'audio'),
        ]);
      const urls = Object.fromEntries([...first, ...last, ...images, ...videos, ...audios].map(asset => [asset.id, asset.url]));
      /* 2026-09-17 第六批（收费链路真实端到端验收）：
         幂等键原来每次点击新随机 UUID → 服务端 videoGeneration.createJob 按
         (owner_email, idempotency_key) 查重**永不命中**。
         实测（真实接口、无打桩）画布同链路：随机键连点 3 次 = 2 个真实视频任务 / 92,000 积分；
         同一稳定键连点 3 次 = 1 个任务 / replay:true / 额外扣费 0。
         稳定键 = 「同一份素材 + 同一提示词 + 同一规格」，改了任一项即视为另一次生成。 */
      const idempotencyKey = stableCanvasActionId([
        'video-job',
        analyzedSignature || planSignature,
        selectedProduct?.id || '',
        String(activeAnalysis.optimizedPrompt || prompt || '').trim(),
        mode,
        duration,
        ratio,
        resolution,
        sound ? 'audio' : 'silent',
        [...first, ...last, ...images, ...videos, ...audios].map(asset => asset.id).join(','),
      ].join('\u0000'));
      const result = await createVideoJob({
        projectId: activeVideoProjectId || undefined,
        workbenchPlanHash: activeVideoPlanHash || undefined,
        productId: selectedProduct.id,
        mode: resolveVideoApiMode(mode, files),
        prompt: activeAnalysis.optimizedPrompt || prompt,
        negativePrompt,
        duration,
        aspectRatio: ratio,
        resolution,
        generateAudio: sound,
        seed,
        billingQuoteId: quote.quoteId,
        references: {
          firstImage: first[0]?.id || '',
          lastImage: last[0]?.id || '',
          images: images.map(asset => asset.id),
          videos: videos.map(asset => asset.id),
          audios: audios.map(asset => asset.id),
          urls,
        },
      }, idempotencyKey);
      setJob(result.job);
      setHistory(current => [result.job, ...current.filter(item => item.id !== result.job.id)].slice(0, 20));
      void poll(result.job.id);
    } catch (generationError) {
      if (generationError?.status === 402 || generationError?.code === 'BILLING_INSUFFICIENT_CREDITS') {
        dispatch({ type: 'OPEN_PAYWALL', reason: 'INSUFFICIENT_CREDITS' });
      }
      setError(generationError?.message || '视频任务创建失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  const requires = hasRequiredVideoInputs(mode, files);
  /* 9-12 用户批注：用户什么都没做（没上传素材、没写文字）时按钮不该亮着 ——
     与其它三个板块一致，无输入即禁用灰态。 */
  /* 注意: requires(hasRequiredVideoInputs) 在默认「智能成片」模式下**恒为 true**，
     拿它判断「用户有没有输入」会导致按钮永远亮着（用户 9-13 再次指出）→ 改为只数真实素材与文字。 */
  const uploadedFileCount = ['images', 'videos', 'audios', 'first', 'last', 'media']
    .reduce((sum, key) => sum + (Array.isArray(files?.[key]) ? files[key].length : 0), 0);
  const hasAnyInput = uploadedFileCount > 0 || Boolean(String(prompt || '').trim());
  const canAnalyze = capabilities.generationEnabled && selectedProduct && hasAnyInput;
  const canGenerate = capabilities.generationEnabled && selectedProduct && quote?.quoteId && prompt.trim() && requires && planReviewed && effectivePlan.ready && activeAnalysis && !submitting && !planning;

  const openVideoPlan = async () => {
    setError('');
    if (!videoPlan.ready) {
      setPlanOpen(true);
      return;
    }
    if (activeAnalysis) {
      setPlanOpen(true);
      return;
    }
    if (planning) return;
    setPlanning(true);
    try {
      const selected = mode === 'frame'
        ? { first: files.first, last: files.last, images: [], videos: [], audios: [] }
        : { first: [], last: [], images: files.images, videos: files.videos, audios: files.audios };
      const inspected = await inspectVideoPlanningFiles(selected);
      const originalImageCount = selected.first.length + selected.last.length + selected.images.length;
      const analysisFrames = inspected.frames.slice(0, Math.max(0, 9 - originalImageCount));
      const [first, last, images, videos, audios, frames] = await Promise.all([
        uploadFiles(selected.first, 'image'),
        uploadFiles(selected.last, 'image'),
        uploadFiles(selected.images, 'image'),
        uploadFiles(selected.videos, 'video'),
        uploadFiles(selected.audios, 'audio'),
        uploadFiles(analysisFrames, 'image'),
      ]);
      const planQuote = (await quoteBillingAction({ sku: 'video_plan_analysis', quantity: 1 })).quote;
      /* 2026-09-17 第六批（收费链路真实端到端验收）：
         actionId 原来每次新随机 UUID → 服务端按 actionId 去重失效，
         实测画布同链路连点 3 次 = 4000 积分（4×）。这里同样改稳定键：
         同一份素材/提示词/规格 = 同一次分析，重复点击由服务端 replay，不再扣费。 */
      const planActionKey = stableCanvasActionId([
        'video-plan',
        planSignature,
        String(prompt || '').trim(),
        selectedProduct?.id || '',
        mode,
        duration,
        ratio,
        resolution,
        sound ? 'audio' : 'silent',
      ].join('\u0000'));
      const result = await analyzeVideoPlan({
        billingQuoteId: planQuote.quoteId,
        billingActionId: planActionKey,
        productId: selectedProduct?.id,
        mode,
        prompt,
        negativePrompt,
        duration,
        ratio,
        resolution,
        sound,
        manifest: inspected.manifest,
        /* 只发名字：技能正文已经在输入框（prompt）里了，再发 body 会让同一份正文进两次提示词。 */
        userSkills: userSkills.map(skill => ({ id: skill.id, name: skill.name, version: skill.version })),
        analysisImageIds: [...first, ...last, ...images, ...frames].map(asset => asset.id),
      });
      setPlannedUploads({ signature: planSignature, assets: { first, last, images, videos, audios } });
      setAnalyzedPlan(result.plan);
      setAnalyzedSignature(planSignature);
      setPlanReviewed(false);
      setPlanOpen(true);
      await refreshBillingBalance?.({ force: true }).catch(() => {});
    } catch (planError) {
      if (planError?.status === 402 || planError?.code === 'BILLING_INSUFFICIENT_CREDITS') {
        dispatch({ type: 'OPEN_PAYWALL', reason: 'INSUFFICIENT_CREDITS' });
      }
      setError(planError?.message || '素材分析暂时失败，请稍后重试');
    } finally {
      setPlanning(false);
    }
  };

  const openJobInCanvas = (videoJob = job) => {
    if (!videoJob?.resultUrl) return;
    dispatch({
      type: 'SET_RESULT',
      result: {
        ...videoJob,
        id: videoJob.workId || videoJob.id,
        taskId: videoJob.id,
        product_name: videoJob.prompt || '视频作品',
        workType: 'video',
        category: 'video',
        videoUrl: videoJob.resultUrl,
        video_url: videoJob.resultUrl,
        projectId: videoJob.projectId || '',
        projectAssetRefs: videoJob.projectAssetRef ? [videoJob.projectAssetRef] : [],
        video: { url: videoJob.resultUrl, ...(videoJob.projectAssetRef ? { projectAssetRef: videoJob.projectAssetRef } : {}) },
        canvasImportId: globalThis.crypto?.randomUUID?.() || `video-${videoJob.id}-${Date.now()}`,
      },
    });
    dispatch({ type: 'NAVIGATE', page: 'ec-canvas' });
  };

  useEffect(() => {
    if (job?.status !== 'completed' || !job.resultUrl || openedJobRef.current === job.id) return;
    openedJobRef.current = job.id;
    openJobInCanvas(job);
  }, [job]);

  const materialEntries = [
    ...files.images.map((file, index) => ({ file, key: 'images', index, kind: 'image', label: '图片', name: `图片${index + 1}` })),
    ...files.videos.map((file, index) => ({ file, key: 'videos', index, kind: 'video', label: '视频', name: `视频${index + 1}` })),
    ...files.audios.map((file, index) => ({ file, key: 'audios', index, kind: 'audio', label: '音频', name: `音频${index + 1}` })),
  ];
  const mentionedAssets = useMemo(() => {
    if (mode === 'frame') {
      return [...files.first, ...files.last].map((file, index) => ({
        file,
        id: `video-frame-${index + 1}`,
        sourceNodeId: `video-frame-${index + 1}`,
        kind: 'image',
        name: `图片${index + 1}`,
        label: `@图片${index + 1}`,
      }));
    }
    const counters = { image: 0, video: 0, audio: 0 };
    const names = { image: '图片', video: '视频', audio: '音频' };
    return materialEntries.map(item => {
      counters[item.kind] += 1;
      const name = `${names[item.kind]}${counters[item.kind]}`;
      return {
        file: item.file,
        id: `video-${item.kind}-${counters[item.kind]}`,
        sourceNodeId: `video-${item.kind}-${counters[item.kind]}`,
        kind: item.kind,
        name,
        label: `@${name}`,
      };
    });
  }, [files, mode]);
  const assetCount = mode === 'frame' ? files.first.length + files.last.length : materialEntries.length;
  const toolbarSummary = {
    shot: `${ratio} · ${duration}秒`,
    sound: sound ? '生成声音' : '无声音',
    settings: `${resolution.toUpperCase()} · Seed ${seed || '随机'}`,
    /* 9-12 用户批注：技能选择的结果要显示在「技能库」这一项下面（生成设置里那份去掉） */
    skills: userSkills.length ? userSkills.map(skill => skill.name).join(' · ') : '未选技能',
  };

  const renderAssetPickers = () => {
    if (mode === 'frame') {
      return <div className="video-media-deck is-frame">
        <FilePicker accept="image/jpeg,image/png,image/webp" icon={ImagePlus} onPreview={setLightboxEntry} label="上传首帧图" files={files.first} onChange={next => replaceFiles('first', next, 1)} onRemove={() => removeFile('first', 0)} inputRef={firstFrameInputRef} upload={uploadFor(files.first[0])} onRetry={() => retryUpload(files.first[0], 'image')} />
        <FilePicker accept="image/jpeg,image/png,image/webp" icon={ImagePlus} onPreview={setLightboxEntry} label="上传尾帧图" files={files.last} onChange={next => replaceFiles('last', next, 1)} onRemove={() => removeFile('last', 0)} inputRef={lastFrameInputRef} upload={uploadFor(files.last[0])} onRetry={() => retryUpload(files.last[0], 'image')} />
        <div className="video-media-guidance"><strong>用两张画面定义镜头起点与终点</strong><small>中间动作、运镜和节奏在下方描述。</small></div>
      </div>;
    }
    const uploadActions = mode === 'remake'
      ? [
        { kind: 'image', key: 'images', label: '替换图片', hint: '商品、人物或场景', icon: ImagePlus, accept: 'image/*', count: files.images.length },
        { kind: 'video', key: 'videos', label: '参考视频', hint: '提取节奏与镜头结构', icon: Video, accept: 'video/*', count: files.videos.length },
        { kind: 'audio', key: 'audios', label: '参考音频', hint: '音乐、对白或声音', icon: FileAudio, accept: 'audio/*', count: files.audios.length },
      ]
      : [
        { kind: 'image', key: 'images', label: '图片', hint: '商品、人物与场景', icon: ImagePlus, accept: 'image/*', count: files.images.length },
        { kind: 'video', key: 'videos', label: '视频', hint: '动作、运镜与节奏', icon: Video, accept: 'video/*', count: files.videos.length },
        { kind: 'audio', key: 'audios', label: '音频', hint: '音乐、对白与声音', icon: FileAudio, accept: 'audio/*', count: files.audios.length },
      ];
    return <div className="video-material-workspace">
      <div className="video-material-actions" aria-label="选择素材类型">
        {uploadActions.map(action => <label key={action.kind} className={`video-material-action is-${action.kind}`}>
          <input type="file" accept={action.accept} multiple onChange={event => { appendQuickFiles(Array.from(event.target.files || [])); event.target.value = ''; }} />
          <span><action.icon size={19} /></span><strong>{action.label}</strong><small>{action.hint}</small>{action.count > 0 && <b>{action.count}</b>}
        </label>)}
      </div>
      {materialEntries.length > 0 && <div className="video-media-deck">
        {materialEntries.map(item => <article
          key={`${item.key}-${item.index}-${item.file.name}`}
          className={`video-media-card video-media-preview-card is-${item.kind}`}
          title="双击预览大图 / 播放"
          onDoubleClick={() => setLightboxEntry({ file: item.file, upload: uploadFor(item.file) })}
        >
          <MediaPreview file={item.file} upload={uploadFor(item.file) || {}} />
          <span className="video-media-type">{item.label}</span>
          <span className="video-media-caption">{item.name}</span>
          <UploadStatus upload={uploadFor(item.file)} onRetry={() => retryUpload(item.file, item.kind)} />
          <button type="button" className="video-media-remove" aria-label={`移除${item.file.name}`} onClick={() => removeFile(item.key, item.index)}><X size={14} /></button>
        </article>)}
      </div>}
    </div>;
  };

  /* 轨道范围与档位标签都来自产品契约：声明了时长白名单就只暴露合法档位，
     避免出现「界面能选 8 秒、上游只认 5/10/15」的死角。 */
  const durationRange = videoDurationRange(selectedProduct);

  const renderPanelBody = () => {
    if (activePanel === 'shot') return <>
      <div className="video-panel-section"><strong>视频画幅</strong><div className="video-ratio-grid">
        {RATIOS.map(value => <button key={value} type="button" className={ratio === value ? 'is-selected' : ''} onClick={() => { setPlanReviewed(false); setRatio(value); }}><i style={{ aspectRatio: value.replace(':', ' / ') }} />{value}</button>)}
      </div></div>
      <div className="video-panel-section"><div className="video-panel-section-title"><strong>视频时长</strong><span>{duration} 秒</span></div>
        <input className="video-duration-range" type="range" min={durationRange.min} max={durationRange.max} step={durationRange.step} value={duration} onChange={event => { setPlanReviewed(false); setDuration(snapVideoDuration(selectedProduct, Number(event.target.value))); }} />
        <div className="video-range-labels">{durationRange.declared
          ? durationRange.options.map(seconds => <span key={seconds}>{seconds} 秒</span>)
          : <><span>{durationRange.min} 秒</span><span>{durationRange.max} 秒</span></>}</div>
      </div>
    </>;
    if (activePanel === 'sound') return <>
      <button type="button" className={`video-sound-choice${sound ? ' is-selected' : ''}`} onClick={() => { setPlanReviewed(false); setSound(current => !current); }}>
        <span><Volume2 size={20} /><strong>生成同期声音</strong><small>根据画面内容生成环境声和动作声音</small></span><i aria-hidden="true" />
      </button>
      {mode !== 'frame' && <div className="video-panel-section"><strong>音频参考</strong><FilePicker accept="audio/*" onPreview={setLightboxEntry} icon={FileAudio} label="上传参考音频" files={files.audios} multiple onChange={next => replaceFiles('audios', next, 3)} upload={uploadFor(files.audios[0])} onRetry={() => retryUpload(files.audios[0], 'audio')} /></div>}
    </>;
    if (activePanel === 'settings') return <>
      <div className="video-panel-section"><strong>清晰度</strong><div className="video-resolution-grid">
        {(selectedProduct?.resolutions || ['720p']).map(value => <button key={value} type="button" className={resolution === value ? 'is-selected' : ''} onClick={() => { setPlanReviewed(false); setResolution(value); }}><b>{value.toUpperCase()}</b><span>{value === '2k' ? '精制成片' : '正式成片'}</span></button>)}
      </div></div>
      <label className="video-panel-field"><span>避免出现的内容</span><textarea value={negativePrompt} onChange={event => { setPlanReviewed(false); setNegativePrompt(event.target.value); }} maxLength={1200} placeholder="例如：画面抖动、人物结构异常、乱码文字、无关道具" /></label>
      {/* 9-12 用户批注：技能相关从生成设置里去掉 —— 已选技能显示在工具栏「技能库」上（见 toolbarSummary.skills） */}
      <label className="video-panel-field compact"><span>随机种子</span><input type="number" value={seed} onChange={event => { setPlanReviewed(false); setSeed(Number(event.target.value) || 0); }} /><small>填 0 表示随机生成</small></label>
    </>;
    return null;
  };

  const renderFloatingPanel = () => {
    if (!activePanel) return null;
    const meta = TOOLBAR_ITEMS.find(item => item.key === activePanel);
    const Icon = meta?.icon || Settings2;
    return createPortal(<section
      id="video-floating-panel"
      className="video-config-panel"
      data-panel={activePanel}
      style={{
        left: panelPosition.left,
        bottom: panelPosition.bottom,
        width: panelPosition.width,
        maxHeight: panelPosition.maxHeight,
        '--video-panel-anchor-x': `${panelPosition.anchor}px`,
      }}
    >
      <header><span><Icon size={19} /></span><div><strong>{meta?.label}</strong><small>{meta?.description}</small></div></header>
      <div className="video-config-panel-body">{renderPanelBody()}</div>
    </section>, document.body);
  };

  const promptPlaceholder = mode === 'remake'
    ? '说明要保留的镜头节奏、转场和叙事，再写清要替换进去的商品、人物或场景。'
    : mode === 'frame'
      ? '描述首帧到尾帧之间的动作、镜头运动、场景变化和节奏。'
      : '描述主体、动作、镜头、场景和节奏。例如：人物拿起香水走向窗边，镜头从产品特写平滑推进到真实使用场景。';
  const insertMention = file => {
    setPlanReviewed(false);
    promptFieldRef.current?.insertMention(file.label);
    setInlineMenu(null);
  };

  return <main className={`video-studio-page${embedded ? ' is-embedded' : ''}`}>
    <MediaLightbox entry={lightboxEntry} onClose={() => setLightboxEntry(null)} />
    {!embedded && <header className="video-studio-heading"><div><span className="video-studio-kicker"><Clapperboard size={16} />视频生成</span><h1>从创意素材到营销成片</h1><p>脚本、参考素材、镜头、声音和交付规格在同一个任务里完成。</p></div><button className="video-balance" type="button" onClick={() => dispatch({ type: 'SHOW_PRICE', show: true })}>AI 积分 <strong>{state.unlimited ? '无限额度' : state.ecPoints}</strong></button></header>}

    <section className="video-composer" aria-label="视频生成工作区">
      <header className="video-composer-heading"><span><Clapperboard size={16} />视频生成</span><h2>把创意素材变成吸引人的短片</h2><p>选择创作方式，上传参考素材，再描述你要的镜头和节奏。</p></header>
      <div className="video-mode-tabs" role="tablist" aria-label="视频创作模式">
        {VIDEO_CREATION_MODES.map(item => {
          const ModeIcon = VIDEO_MODE_ICONS[item.id] || Clapperboard;
          return <button key={item.id} type="button" role="tab" aria-selected={mode === item.id} className={mode === item.id ? 'is-selected' : ''} onClick={() => { setPlanReviewed(false); setMode(item.id); }}>
            <span className="video-mode-icon" aria-hidden="true"><ModeIcon size={18} /></span><span className="video-mode-copy"><strong>{item.label}</strong><small>{item.hint}</small></span><i aria-hidden="true" />
          </button>;
        })}
      </div>
      <section className="video-content-composer">
        <section className="video-materials" aria-label="上传素材">
          <header><div><Upload size={17} /><span><strong>全能参考</strong><small>{mode === 'frame' ? '首尾帧用于控制镜头起点与终点' : mode === 'remake' ? '先上传参考视频，再补充要替换的商品素材' : '支持图片、视频和音频，智能成片可只写一句话起步'}</small></span></div>{assetCount > 0 && <b>{assetCount} 个</b>}</header>
          {renderAssetPickers()}
        </section>
        <div className="video-composer-input">
          <MentionPromptField
            ref={promptFieldRef}
            id="video-prompt"
            value={prompt}
            mentions={mentionedAssets}
            maxLength={VIDEO_PROMPT_MAX_LENGTH}
            onChange={value => { setPlanReviewed(false); setPrompt(String(value || '').slice(0, VIDEO_PROMPT_MAX_LENGTH)); }}
            onFilesPasted={files => appendQuickFiles(files)}
            placeholder={promptPlaceholder}
            className="video-prompt-mentions"
          />
          <div className="video-skill-row">
            {/* @ 引用素材：全站共用组件（与电商生图同一个实现、同一个长相）。
                内置两条用户点名要的行为：①没过素材时按钮**自动禁用变暗**；
                ②菜单 portal 到 body + 双包含判定，点菜单项一定插得进去（图7-① 的死按钮）。 */}
            <ImageMentionPicker
              images={mentionedAssets}
              selectedImages={mentionedAssets}
              selectionMode="insert"
              normalize={videoMentionItems}
              renderItem={renderVideoMentionItem}
              menuTitle="引用素材"
              triggerLabel="引用素材"
              onToggle={insertMention}
            />
            {userSkills.map(skill => (
              <span key={skill.id} className="ec-skill-chip">
                <Sparkles size={12} /> {skill.name}
                <button type="button" aria-label={`移除技能 ${skill.name}`} onClick={() => setUserSkills(current => current.filter(item => item.id !== skill.id))}>×</button>
              </span>
            ))}
          </div>
          {/* 2026-09-16 用户批注（图7-②）：「你下面没有必要写这个限制多少次，还有右边这个
              『提交时锁定本次费用』这一句，就是你这行可以去掉的，不需要去提示这个。」
              → 整行删除。字数上限是**约束**不是**说明**：MentionPromptField 到 1200 会自己截断，
              不需要在旁边再写一个计数器；计费在按钮上已经实时显示，不必再解释一遍。 */}
          <SkillLibraryModal
            open={skillOpen}
            onClose={() => setSkillOpen(false)}
            initialKind="video"
            onPick={skill => {
              if (!skill?.body) return;
              /* 2026-09-16 用户批注（图5-①）：技能「使用」必须把正文写进输入框 ——
                 与首页电商、画布三处共用 applyCanvasSkill（不覆盖已写内容，追加到末尾）。 */
              setPrompt(current => applyCanvasSkill({ prompt: current, skill: skill.slug || skill.name, skillBody: skill.body }).prompt);
              setUserSkills(current => (current.some(item => item.id === skill.id) ? current : [...current, { id: skill.id, name: skill.name, version: skill.version || 1, body: skill.body }].slice(0, 2)));
              setSkillOpen(false);
              setPlanReviewed(false);
            }}
          />
          {job && !FINAL.has(job.status) && <div className="video-job-progress"><span>{jobStatus(job)}</span><progress max="100" value={job.progress || 2} /></div>}
          {error && <div className="video-error">{error}</div>}
          {!capabilities.loading && !capabilities.generationEnabled && <div className="video-error">视频生成功能尚未开放，当前不会扣除积分。</div>}
        </div>

        <footer className="video-toolbar" ref={toolbarRef}>
          <div className="video-toolbar-controls">
            <div className="video-quick-tools" ref={quickToolsRef}>
              {/* 2026-09-16：这里原来还有一个重复的 @（底栏版）。两套 @ 两套菜单正是
                 用户说的「为什么跟其他板块的艾特键不一样」—— 现在只剩输入框下方那一个共用组件。 */}
              <span className="video-inline-control">
                {/* 9-11 用户批注: 模型控件比其它按钮矮一截 → 统一成「小标题 + 参数」两行结构与同高 */}
                <button type="button" className="video-config-trigger is-model" aria-expanded={inlineMenu === 'model'} onClick={() => setInlineMenu(current => current === 'model' ? null : 'model')}>
                  <VideoModelMark product={selectedProduct} provider={selectedProduct?.providerLabel} />
                  <span><small>视频模型</small><strong>{selectedProduct?.label || '选择视频模型'}</strong></span>
                  <ChevronDown size={14} />
                </button>
                {inlineMenu === 'model' && <div className="video-inline-menu is-model"><strong>视频模型</strong>{products.map(product => <button key={product.id} type="button" className={selectedProduct?.id === product.id ? 'is-selected' : ''} onClick={() => { setPlanReviewed(false); setSelectedProductId(product.id); setInlineMenu(null); }}><VideoModelMark product={product} provider={product.providerLabel} /><span><b>{product.label}<em>{product.tierLabel}</em></b><small>{product.description}</small>{/* 2026-09-16 用户批注（图2-②）：「你为什么这里会有两套描述呢？你只要保留一套就好了呀。
   然后你的积分其实是不能在这里说的。」—— 模型列表原本一行里塞了 4 段文字
   （型号+档位 / 描述 / 限制 / 积分），现在只留**一段描述**；
   积分只出现在右下角按钮上，并随选择实时变化（见 totalJobPoints）。
   ⚠️ 这里是 JSX **子节点**位置，注释必须写成 {/* … */}，写成 /* … */ 会直接编译失败。 */}</span>{selectedProduct?.id === product.id && <Check size={16} />}</button>)}</div>}
              </span>
            </div>
            <div className="video-toolbar-buttons">
            {TOOLBAR_ITEMS.map(item => {
              const Icon = item.icon;
              const isOpen = activePanel === item.key;
              return <button
                key={item.key}
                type="button"
                ref={element => { if (element) buttonRefs.current[item.key] = element; }}
                className={`video-config-trigger${isOpen ? ' is-open' : ''}`}
                aria-expanded={isOpen}
                aria-controls="video-floating-panel"
                onClick={() => openPanel(item.key)}
              ><Icon size={17} /><span><small>{item.label}</small><strong>{toolbarSummary[item.key]}</strong></span><ChevronDown size={14} /></button>;
            })}
            </div>
          </div>
          {/* 9-11 二轮用户批注: 与电商生图统一为「一个主 CTA + 一个次按钮」—
              未确认方案时只有主按钮 (分析并生成方案, 1 积分); 方案确认后才出现「开始生成」主按钮 + 「查看方案」次按钮。 */}
                    {/* 9-12 用户批注：
             ① 去掉左侧那个独立的积分栏，改成**按钮上直接显示动态积分**；
             ② 积分必须跟随配置实时变化（estimatedPoints 来自服务端报价，方案分析另计 1 积分）；
             ③ 按钮排版与文案一并规范化（未确认方案 = 分析并生成方案；已确认 = 开始生成）。 */}
          {/* 9-12 用户批注：面板里已经选过的配置不用在按钮旁再写一遍 → 去掉这行摘要，信息只留在各面板与按钮积分上 */}
          <div className="video-submit-row"><div className="video-submit-actions">{!planReviewed ? <button type="button" className={`video-generate-trigger shubao-gen-cta${planning ? ' is-busy' : ''}`} disabled={planning || !canAnalyze} onClick={openVideoPlan}>{planning ? <Loader2 size={16} /> : <Aperture size={15} />}{planning ? '正在分析素材' : <>{activeAnalysis ? '查看并确认方案' : '分析并生成方案'}<span className="shubao-gen-cta-points" title={estimatedPoints > 0 ? `方案分析 ${ANALYSIS_POINTS} 积分 + 成片预估 ${estimatedPoints} 积分（随模型 / 时长 / 清晰度实时变化）` : '方案分析费'}>{totalJobPoints || ANALYSIS_POINTS} 积分</span></>}</button> : <><button type="button" className="video-plan-trigger" onClick={openVideoPlan}><Aperture size={15} />查看方案</button><button type="button" className={`video-generate-trigger shubao-gen-cta${quote?.quoteId ? ' is-armed' : ''}${submitting ? ' is-busy' : ''}`} disabled={!canGenerate} onClick={handleGenerate}>{quote?.quoteId && !submitting && <Lock size={13} />}<Play size={17} />{submitting ? '正在提交' : (quoteError || <>{'开始生成'}<span className="shubao-gen-cta-points">{estimatedPoints} 积分</span></>)}</button></>}</div></div>
        </footer>
      </section>
    </section>

    {renderFloatingPanel()}
    {planOpen && <VideoPlanModal plan={effectivePlan} onClose={() => setPlanOpen(false)} onConfirm={() => { setPlanReviewed(true); setPlanOpen(false); }} />}

    {!embedded && <section className="video-result-workbench"><div className="video-stage">
        <div className="video-frame" style={{ aspectRatio: ratio.replace(':', ' / ') }}>
          {job?.status === 'completed' && job.resultUrl
            ? <video src={job.resultUrl} controls playsInline />
            : <div className="video-empty"><Upload size={30} /><strong>{job ? jobStatus(job) : '成片会显示在这里'}</strong><span>{job?.error || '只在确认交付后扣费，失败自动退回冻结积分'}</span>{job && !FINAL.has(job.status) && <progress max="100" value={job.progress || 2} />}</div>}
        </div>
        {job?.status === 'completed' && job.resultUrl && <button className="video-open-canvas" type="button" onClick={() => openJobInCanvas(job)}>在画布中继续</button>}
        <div className="video-history">
          <div className="video-history-title"><strong>生成记录</strong><span>任务、素材与结果自动保存</span></div>
          {history.length ? history.slice(0, 8).map(item => <button key={item.id} type="button" className={job?.id === item.id ? 'active' : ''} onClick={() => { setJob(item); if (!FINAL.has(item.status)) void poll(item.id); }}>
            <span>{item.prompt || '视频任务'}</span><small>{jobRecordStatus(item)}</small>
          </button>) : <p className="video-history-empty">暂无视频任务</p>}
        </div>
      </div></section>}
    {!embedded && capabilities.directorUi === true && state.logged && <DirectorWorkbench capabilities={capabilities} />}
    {!embedded && capabilities.directorUi !== true && capabilities.workbenchEnabled && state.logged && (
      // 瀑布三段式默认下线：仅当服务端显式打开 waterfallWorkbench 时回退旧布局。
      capabilities.waterfallWorkbench === true
        ? <VideoProjectWorkbench
          enabled={capabilities.workbenchEnabled}
          logged={state.logged}
          mode={capabilities.workbenchMode}
          planningOnly={capabilities.workbenchPlanningOnly}
          uploadRecords={uploadRecords}
          jobs={history}
          onProjectChange={setActiveVideoProjectId}
          onPlanApprovalChange={setActiveVideoPlanHash}
        />
        : <VideoCanvasWorkbench
          enabled={capabilities.workbenchEnabled}
          logged={state.logged}
          planningOnly={capabilities.workbenchPlanningOnly}
          uploadRecords={uploadRecords}
          jobs={history}
          products={products}
          onProjectChange={setActiveVideoProjectId}
          onPlanApprovalChange={setActiveVideoPlanHash}
        />
    )}
  </main>;
}
