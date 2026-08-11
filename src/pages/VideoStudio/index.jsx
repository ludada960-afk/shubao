import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Aperture,
  AtSign,
  Check,
  ChevronDown,
  Clapperboard,
  FileAudio,
  ImagePlus,
  Mic2,
  Play,
  Plus,
  Settings2,
  Sparkles,
  Upload,
  Video,
  Volume2,
  X,
} from 'lucide-react';
import { useApp } from '../../store/AppContext.jsx';
import { quoteBillingAction } from '../../services/billing.js';
import {
  createVideoJob,
  fetchVideoCapabilities,
  getVideoJob,
  listVideoJobs,
  uploadVideoAsset,
} from '../../services/video.js';
import {
  VIDEO_CREATION_MODES,
  hasRequiredVideoInputs,
  quoteForVideoProduct,
  resolveVideoApiMode,
} from './videoStudioModel.js';
import { buildVideoPlan } from './videoPlanModel.js';
import './VideoStudio.css';

const RATIOS = ['9:16', '16:9', '1:1', '4:3', '3:4', '21:9'];
const FINAL = new Set(['completed', 'failed', 'needs_review']);
const TOOLBAR_ITEMS = [
  { key: 'shot', label: '镜头规格', icon: Aperture, description: '设置画幅与成片时长' },
  { key: 'sound', label: '声音', icon: Mic2, description: '控制同期声音与音频参考' },
  { key: 'settings', label: '生成设置', icon: Settings2, description: '设置清晰度与高级约束' },
];

function fileKind(file) {
  const type = String(file?.type || '').toLowerCase();
  const name = String(file?.name || '').toLowerCase();
  if (type.startsWith('image/') || /\.(png|jpe?g|webp|gif|avif)$/.test(name)) return 'image';
  if (type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/.test(name)) return 'video';
  if (type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|flac)$/.test(name)) return 'audio';
  return '';
}

function MediaPreview({ file }) {
  const [source, setSource] = useState('');
  const kind = fileKind(file);

  useEffect(() => {
    if (!file || !globalThis.URL?.createObjectURL) return undefined;
    const nextSource = globalThis.URL.createObjectURL(file);
    setSource(nextSource);
    return () => globalThis.URL.revokeObjectURL(nextSource);
  }, [file]);

  if (kind === 'image' && source) return <img className="video-media-preview" src={source} alt="" />;
  if (kind === 'video' && source) return <video className="video-media-preview" src={source} muted preload="metadata" />;
  return <span className="video-media-audio-preview"><FileAudio size={25} /><small>{kind === 'audio' ? '音频' : '素材'}</small></span>;
}

function FilePicker({ accept, icon: Icon, label, files, multiple = false, onChange, onRemove, inputRef }) {
  const file = files[0];
  return <div className={`video-media-card video-media-picker${file ? ' has-file' : ''}`}>
    <label className="video-media-picker-control">
      <input ref={inputRef} type="file" accept={accept} multiple={multiple} onChange={event => {
        onChange(Array.from(event.target.files || []));
        event.target.value = '';
      }} />
      {file ? <MediaPreview file={file} /> : <>
        <span className="video-media-add-icon"><Icon size={20} /></span>
        <strong>{label}</strong>
        <small>点击选择文件</small>
      </>}
      {file && <span className="video-media-caption">{files.length > 1 ? `${label} · ${files.length} 个` : label}</span>}
    </label>
    {file && onRemove && <button type="button" className="video-media-remove" aria-label={`移除${label}`} onClick={onRemove}><X size={14} /></button>}
  </div>;
}

function jobStatus(job) {
  if (job?.status === 'completed') return '成片已交付';
  if (job?.status === 'failed') return '未交付，积分已退回';
  if (job?.status === 'needs_review') return '受理结果确认中';
  if (job?.status === 'processing') return `生成中 ${job.progress || 0}%`;
  return '正在提交';
}

function VideoPlanModal({ plan, onClose, onConfirm }) {
  if (!plan) return null;
  return createPortal(<div className="video-plan-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="video-plan-modal" role="dialog" aria-modal="true" aria-labelledby="video-plan-title">
      <header className="video-plan-header">
        <div><span className="video-plan-eyebrow"><Sparkles size={14} />生成前方案</span><h2 id="video-plan-title">先确认镜头怎么走，再提交生成</h2><p>这一步只整理你已上传的素材与设置，不调用上游，也不会扣积分。</p></div>
        <button type="button" className="video-plan-close" aria-label="关闭生成方案" onClick={onClose}><X size={18} /></button>
      </header>
      <div className="video-plan-summary">
        <div><small>创作路径</small><strong>{plan.laneLabel}</strong></div>
        <div><small>输出规格</small><strong>{plan.output.ratio} · {plan.output.duration} 秒 · {plan.output.resolution.toUpperCase()}</strong></div>
        <div><small>素材数量</small><strong>{plan.assets.length ? `${plan.assets.length} 个已编排` : '无上传素材'}</strong></div>
      </div>
      <div className="video-plan-body">
        <section className="video-plan-section"><div className="video-plan-section-title"><strong>素材如何进入镜头</strong><span>{plan.mode === 'frame' ? '精确起止' : '按角色引用'}</span></div><div className="video-plan-material-map">{plan.materialMap.map(item => <div className="video-plan-material-item" key={`${item.label}-${item.detail}`}><span>{item.label}</span><strong>{item.detail}</strong><small>{item.count ? `${item.count} 个` : '待补充'}</small></div>)}</div></section>
        <section className="video-plan-section"><div className="video-plan-section-title"><strong>镜头节奏</strong><span>本地推演</span></div><div className="video-plan-beats">{plan.beats.map(beat => <article key={`${beat.time}-${beat.label}`}><span>{beat.time}</span><div><strong>{beat.label}</strong><p>{beat.detail}</p></div><small>{beat.source}</small></article>)}</div></section>
        {(plan.blockers.length > 0 || plan.warnings.length > 0) && <section className="video-plan-section video-plan-notices"><div className="video-plan-section-title"><strong>提交前检查</strong><span>{plan.blockers.length ? `${plan.blockers.length} 项待处理` : '可以继续'}</span></div>{plan.blockers.map(item => <div className="video-plan-notice is-blocking" key={item.code}><X size={15} /><span><strong>{item.title}</strong><small>{item.detail}</small></span></div>)}{plan.warnings.map(item => <div className="video-plan-notice" key={item.code}><Aperture size={15} /><span><strong>{item.title}</strong><small>{item.detail}</small></span></div>)}</section>}
      </div>
      <footer className="video-plan-footer"><span>{plan.cost ? `本次预计 ${Math.ceil(Number(plan.cost.units || 0) / 1000)} AI 积分，点击开始生成后才会冻结` : '报价加载中，提交时会再次校验费用'}</span><div><button type="button" className="video-plan-secondary" onClick={onClose}>返回调整</button><button type="button" className="video-plan-primary" disabled={!plan.ready} onClick={onConfirm}><Check size={16} />确认生成方案</button></div></footer>
    </section>
  </div>, document.body);
}

export default function VideoStudioPage({ embedded = false }) {
  const { state, dispatch, refreshBillingBalance } = useApp();
  const [capabilities, setCapabilities] = useState({ loading: true, generationEnabled: false });
  const [selectedProductId, setSelectedProductId] = useState('');
  const [mode, setMode] = useState('smart');
  const [files, setFiles] = useState({ first: [], last: [], images: [], videos: [], audios: [] });
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [resolution, setResolution] = useState('720p');
  const [ratio, setRatio] = useState('9:16');
  const [duration, setDuration] = useState(8);
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
  const [activePanel, setActivePanel] = useState(null);
  const [inlineMenu, setInlineMenu] = useState(null);
  const [panelPosition, setPanelPosition] = useState({ left: 16, bottom: 80, width: 520, maxHeight: 560, anchor: 260 });
  const pollRef = useRef(null);
  const toolbarRef = useRef(null);
  const quickToolsRef = useRef(null);
  const materialInputRef = useRef(null);
  const firstFrameInputRef = useRef(null);
  const lastFrameInputRef = useRef(null);
  const buttonRefs = useRef({});
  const openedJobRef = useRef('');

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
      .catch(() => setCapabilities({ loading: false, generationEnabled: false }));
  }, []);

  useEffect(() => {
    if (!state.logged) {
      setHistory([]);
      return;
    }
    listVideoJobs().then(result => setHistory(result.jobs || [])).catch(() => {});
  }, [state.logged]);

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
    const min = Number(selectedProduct.durations?.min) || 4;
    const max = Number(selectedProduct.durations?.max) || 15;
    setDuration(current => Math.max(min, Math.min(max, current)));
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
      if (!quickToolsRef.current?.contains(event.target)) setInlineMenu(null);
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

  function replaceFiles(key, next, limit) {
    setPlanReviewed(false);
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
    setFiles(current => ({ ...current, [key]: current[key].filter((_, itemIndex) => itemIndex !== index) }));
  }

  function appendQuickFiles(items) {
    setPlanReviewed(false);
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

  const openMaterialPicker = useCallback(() => {
    if (mode === 'frame') {
      if (!files.first.length) {
        firstFrameInputRef.current?.click();
        return;
      }
      if (!files.last.length) {
        lastFrameInputRef.current?.click();
        return;
      }
      firstFrameInputRef.current?.click();
      return;
    }
    materialInputRef.current?.click();
  }, [files.first.length, files.last.length, mode]);

  async function uploadFiles(items, kind) {
    const uploaded = [];
    for (const file of items) uploaded.push(await uploadVideoAsset(file, kind));
    return uploaded;
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
    if (submitting || !quote?.quoteId || !planReviewed || !videoPlan.ready) return;
    setError('');
    setSubmitting(true);
    try {
      const selected = mode === 'frame'
        ? { first: files.first, last: files.last, images: [], videos: [], audios: [] }
        : { first: [], last: [], images: files.images, videos: files.videos, audios: files.audios };
      const [first, last, images, videos, audios] = await Promise.all([
        uploadFiles(selected.first, 'image'),
        uploadFiles(selected.last, 'image'),
        uploadFiles(selected.images, 'image'),
        uploadFiles(selected.videos, 'video'),
        uploadFiles(selected.audios, 'audio'),
      ]);
      const urls = Object.fromEntries([...first, ...last, ...images, ...videos, ...audios].map(asset => [asset.id, asset.url]));
      const idempotencyKey = globalThis.crypto?.randomUUID?.() || `video-${Date.now()}`;
      const result = await createVideoJob({
        productId: selectedProduct.id,
        mode: resolveVideoApiMode(mode, files),
        prompt,
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
  const canGenerate = capabilities.generationEnabled && selectedProduct && quote?.quoteId && prompt.trim() && requires && planReviewed && videoPlan.ready && !submitting;

  const openVideoPlan = () => {
    setError('');
    setPlanOpen(true);
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
        video: { url: videoJob.resultUrl },
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
    ...files.images.map((file, index) => ({ file, key: 'images', index, kind: 'image', label: '图片' })),
    ...files.videos.map((file, index) => ({ file, key: 'videos', index, kind: 'video', label: '视频' })),
    ...files.audios.map((file, index) => ({ file, key: 'audios', index, kind: 'audio', label: '音频' })),
  ];
  const assetCount = mode === 'frame' ? files.first.length + files.last.length : materialEntries.length;
  const toolbarSummary = {
    shot: `${ratio} · ${duration}秒`,
    sound: sound ? '生成声音' : '无声音',
    settings: `${resolution.toUpperCase()} · Seed ${seed || '随机'}`,
  };

  const renderAssetPickers = () => {
    if (mode === 'frame') {
      return <div className="video-media-deck is-frame">
        <FilePicker accept="image/jpeg,image/png,image/webp" icon={ImagePlus} label="上传首帧图" files={files.first} onChange={next => replaceFiles('first', next, 1)} onRemove={() => removeFile('first', 0)} inputRef={firstFrameInputRef} />
        <FilePicker accept="image/jpeg,image/png,image/webp" icon={ImagePlus} label="上传尾帧图" files={files.last} onChange={next => replaceFiles('last', next, 1)} onRemove={() => removeFile('last', 0)} inputRef={lastFrameInputRef} />
        <div className="video-media-guidance"><strong>用两张画面定义镜头起点与终点</strong><small>中间动作、运镜和节奏在下方描述。</small></div>
      </div>;
    }
    return <div className={`video-media-deck${materialEntries.length ? '' : ' is-empty'}`}>
      {materialEntries.map(item => <article key={`${item.key}-${item.index}-${item.file.name}`} className={`video-media-card video-media-preview-card is-${item.kind}`}>
        <MediaPreview file={item.file} />
        <span className="video-media-type">{item.label}</span>
        <span className="video-media-caption">{item.file.name}</span>
        <button type="button" className="video-media-remove" aria-label={`移除${item.file.name}`} onClick={() => removeFile(item.key, item.index)}><X size={14} /></button>
      </article>)}
      {materialEntries.length < 9 && <label className="video-media-card video-media-add-card">
        <input ref={materialInputRef} type="file" accept="image/*,video/*,audio/*" multiple onChange={event => {
          appendQuickFiles(Array.from(event.target.files || []));
          event.target.value = '';
        }} />
        <span className="video-media-add-icon"><Plus size={20} /></span>
        <strong>添加素材</strong>
        <small>图片、视频或音频</small>
      </label>}
      {!materialEntries.length && <div className="video-media-guidance">
        <strong>{mode === 'remake' ? '先放入参考视频，再补充要替换进去的商品素材' : '把产品、人物或场景素材放在这里'}</strong>
        <small>{mode === 'remake' ? '至少需要 1 个参考视频和 1 组替换素材，最多 9 个素材。' : '支持图片、视频和音频，最多 9 个素材。'}</small>
        <span><i><ImagePlus size={14} />图片</i><i><Video size={14} />视频</i><i><FileAudio size={14} />音频</i></span>
      </div>}
    </div>;
  };

  const renderPanelBody = () => {
    if (activePanel === 'shot') return <>
      <div className="video-panel-section"><strong>视频画幅</strong><div className="video-ratio-grid">
        {RATIOS.map(value => <button key={value} type="button" className={ratio === value ? 'is-selected' : ''} onClick={() => { setPlanReviewed(false); setRatio(value); }}><i style={{ aspectRatio: value.replace(':', ' / ') }} />{value}</button>)}
      </div></div>
      <div className="video-panel-section"><div className="video-panel-section-title"><strong>视频时长</strong><span>{duration} 秒</span></div>
        <input className="video-duration-range" type="range" min={selectedProduct?.durations?.min || 4} max={selectedProduct?.durations?.max || 15} step="1" value={duration} onChange={event => { setPlanReviewed(false); setDuration(Number(event.target.value)); }} />
        <div className="video-range-labels"><span>{selectedProduct?.durations?.min || 4} 秒</span><span>{selectedProduct?.durations?.max || 15} 秒</span></div>
      </div>
    </>;
    if (activePanel === 'sound') return <>
      <button type="button" className={`video-sound-choice${sound ? ' is-selected' : ''}`} onClick={() => { setPlanReviewed(false); setSound(current => !current); }}>
        <span><Volume2 size={20} /><strong>生成同期声音</strong><small>根据画面内容生成环境声和动作声音</small></span><i aria-hidden="true" />
      </button>
      {mode !== 'frame' && <div className="video-panel-section"><strong>音频参考</strong><FilePicker accept="audio/*" icon={FileAudio} label="上传参考音频" files={files.audios} multiple onChange={next => replaceFiles('audios', next, 3)} /></div>}
    </>;
    if (activePanel === 'settings') return <>
      <div className="video-panel-section"><strong>清晰度</strong><div className="video-resolution-grid">
        {(selectedProduct?.resolutions || ['720p']).map(value => <button key={value} type="button" className={resolution === value ? 'is-selected' : ''} onClick={() => { setPlanReviewed(false); setResolution(value); }}><b>{value.toUpperCase()}</b><span>{value === '2k' ? '精制成片' : '正式成片'}</span></button>)}
      </div></div>
      <label className="video-panel-field"><span>避免出现的内容</span><textarea value={negativePrompt} onChange={event => { setPlanReviewed(false); setNegativePrompt(event.target.value); }} maxLength={1200} placeholder="例如：画面抖动、人物结构异常、乱码文字、无关道具" /></label>
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

  const mentionedAssets = mode === 'frame' ? [...files.first, ...files.last] : materialEntries.map(item => item.file);
  const promptPlaceholder = mode === 'remake'
    ? '说明要保留的镜头节奏、转场和叙事，再写清要替换进去的商品、人物或场景。'
    : mode === 'frame'
      ? '描述首帧到尾帧之间的动作、镜头运动、场景变化和节奏。'
      : '描述主体、动作、镜头、场景和节奏。例如：人物拿起香水走向窗边，镜头从产品特写平滑推进到真实使用场景。';
  const insertMention = file => {
    setPlanReviewed(false);
    setPrompt(current => `${current}${current && !/\s$/.test(current) ? ' ' : ''}@${file.name} `);
    setInlineMenu(null);
  };

  return <main className={`video-studio-page${embedded ? ' is-embedded' : ''}`}>
    {!embedded && <header className="video-studio-heading"><div><span className="video-studio-kicker"><Clapperboard size={16} />视频生成</span><h1>从创意素材到营销成片</h1><p>脚本、参考素材、镜头、声音和交付规格在同一个任务里完成。</p></div><button className="video-balance" type="button" onClick={() => dispatch({ type: 'SHOW_PRICE', show: true })}>AI 积分 <strong>{state.unlimited ? '无限额度' : state.ecPoints}</strong></button></header>}

    <section className="video-composer" aria-label="视频生成工作区">
      <header className="video-composer-heading"><span><Clapperboard size={16} />视频生成</span><h2>把创意素材变成可交付的视频</h2><p>选择创作方式，上传参考素材，再描述你要的镜头和节奏。</p></header>
      <div className="video-mode-tabs" role="tablist" aria-label="视频创作模式">
        {VIDEO_CREATION_MODES.map(item => <button key={item.id} type="button" role="tab" aria-selected={mode === item.id} className={mode === item.id ? 'is-selected' : ''} onClick={() => { setPlanReviewed(false); setMode(item.id); }}>
          <strong>{item.label}</strong><span>{item.hint}</span>
        </button>)}
      </div>
      <section className="video-content-composer">
        <section className="video-materials" aria-label="上传素材">
          <header><div><Upload size={17} /><span><strong>上传素材</strong><small>{mode === 'frame' ? '首尾帧用于控制镜头起点与终点' : mode === 'remake' ? '先上传参考视频，再补充要替换的商品素材' : '支持图片、视频和音频，智能成片可只写一句话起步'}</small></span></div>{assetCount > 0 && <b>{assetCount} 个</b>}</header>
          {renderAssetPickers()}
        </section>
        <div className="video-composer-input">
          <textarea id="video-prompt" value={prompt} onChange={event => { setPlanReviewed(false); setPrompt(event.target.value); }} maxLength={1200} placeholder={promptPlaceholder} />
          <div className="video-text-meta"><span>{prompt.length}/1200</span><span><Sparkles size={14} />提交前锁定本次费用</span></div>
          {job && !FINAL.has(job.status) && <div className="video-job-progress"><span>{jobStatus(job)}</span><progress max="100" value={job.progress || 2} /></div>}
          {error && <div className="video-error">{error}</div>}
          {!capabilities.loading && !capabilities.generationEnabled && <div className="video-error">视频通道尚未完成安全配置，当前不会扣除积分。</div>}
        </div>

        <div className="video-quick-tools" ref={quickToolsRef}>
          <button type="button" className="video-icon-tool" aria-label="添加素材" title="添加素材" onClick={openMaterialPicker}><Plus size={18} /></button>
          <span className="video-inline-control">
            <button type="button" className="video-icon-tool" aria-label="引用素材" title="引用素材" aria-expanded={inlineMenu === 'mentions'} onClick={() => setInlineMenu(current => current === 'mentions' ? null : 'mentions')}><AtSign size={17} /></button>
            {inlineMenu === 'mentions' && <div className="video-inline-menu is-mentions"><strong>引用素材</strong>{mentionedAssets.length ? mentionedAssets.map((file, index) => <button key={`${file.name}-${index}`} type="button" onClick={() => insertMention(file)}><span>{file.name}</span><small>插入提示词</small></button>) : <p>上传素材后可在提示词中引用</p>}</div>}
          </span>
          <span className="video-inline-control">
            <button type="button" className="video-model-trigger" aria-expanded={inlineMenu === 'model'} onClick={() => setInlineMenu(current => current === 'model' ? null : 'model')}><Sparkles size={15} /><span>{selectedProduct ? 'Seedance 2.0 · ' + selectedProduct.label : '选择视频模型'}</span><ChevronDown size={13} /></button>
            {inlineMenu === 'model' && <div className="video-inline-menu is-model"><strong>视频模型</strong>{products.map(product => <button key={product.id} type="button" className={selectedProduct?.id === product.id ? 'is-selected' : ''} onClick={() => { setPlanReviewed(false); setSelectedProductId(product.id); setInlineMenu(null); }}><span><b>{product.label}</b><small>{product.id === 'seedance_fast' ? '更快出片，适合试稿与高频迭代' : '稳定生成营销短片，适合正式交付'}</small></span>{selectedProduct?.id === product.id && <Check size={16} />}</button>)}</div>}
          </span>
        </div>

        <footer className="video-toolbar" ref={toolbarRef}>
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
          <div className="video-submit-row"><div><strong>{estimatedPoints} AI 积分 / 次</strong><span>{resolution.toUpperCase()} · {duration} 秒 · {sound ? '含声音' : '无声音'}</span></div><div className="video-submit-actions"><button type="button" className="video-plan-trigger" onClick={openVideoPlan}><Aperture size={15} />{planReviewed ? '方案已确认' : '预览生成方案'}</button><button type="button" disabled={!canGenerate} onClick={handleGenerate}><Play size={17} />{submitting ? '正在上传' : quoteError || '开始生成'}</button></div></div>
        </footer>
      </section>
    </section>

    {renderFloatingPanel()}
    {planOpen && <VideoPlanModal plan={videoPlan} onClose={() => setPlanOpen(false)} onConfirm={() => { setPlanReviewed(true); setPlanOpen(false); }} />}

    {!embedded && <section className="video-workbench"><div className="video-stage">
        <div className="video-frame" style={{ aspectRatio: ratio.replace(':', ' / ') }}>
          {job?.status === 'completed' && job.resultUrl
            ? <video src={job.resultUrl} controls playsInline />
            : <div className="video-empty"><Upload size={30} /><strong>{job ? jobStatus(job) : '成片会显示在这里'}</strong><span>{job?.error || '只在确认交付后扣费，失败自动退回冻结积分'}</span>{job && !FINAL.has(job.status) && <progress max="100" value={job.progress || 2} />}</div>}
        </div>
        {job?.status === 'completed' && job.resultUrl && <button className="video-open-canvas" type="button" onClick={() => openJobInCanvas(job)}>在画布中继续</button>}
        <div className="video-history">
          <div className="video-history-title"><strong>生成记录</strong><span>刷新页面后任务仍会继续</span></div>
          {history.length ? history.slice(0, 8).map(item => <button key={item.id} type="button" className={job?.id === item.id ? 'active' : ''} onClick={() => { setJob(item); if (!FINAL.has(item.status)) void poll(item.id); }}>
            <span>{item.prompt || '视频任务'}</span><small>{jobStatus(item)}</small>
          </button>) : <p className="video-history-empty">暂无视频任务</p>}
        </div>
      </div></section>}
  </main>;
}
