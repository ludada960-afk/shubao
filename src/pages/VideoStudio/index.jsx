import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Aperture,
  ChevronDown,
  Clapperboard,
  FileAudio,
  ImagePlus,
  Images,
  Mic2,
  Play,
  Settings2,
  Sparkles,
  Upload,
  Video,
  Volume2,
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
import './VideoStudio.css';

const MODES = [
  { id: 'script', label: '脚本成片', hint: '一句话生成完整镜头与声音' },
  { id: 'frame', label: '首尾帧', hint: '用两张图控制开场与收尾' },
  { id: 'reference', label: '多模态参考', hint: '图片、视频与音频共同控制' },
  { id: 'remake', label: '爆款重构', hint: '保留节奏，替换为你的商品与内容' },
];

const RATIOS = ['9:16', '16:9', '1:1', '4:3', '3:4', '21:9'];
const FINAL = new Set(['completed', 'failed', 'needs_review']);
const TOOLBAR_ITEMS = [
  { key: 'mode', label: '创作模式', icon: Clapperboard, description: '选择镜头生成方式' },
  { key: 'assets', label: '素材参考', icon: Images, description: '上传首尾帧或参考素材' },
  { key: 'shot', label: '镜头规格', icon: Aperture, description: '设置画幅与成片时长' },
  { key: 'sound', label: '声音', icon: Mic2, description: '控制同期声音与音频参考' },
  { key: 'settings', label: '生成设置', icon: Settings2, description: '设置清晰度与高级约束' },
];

function skuFor(resolution, duration) {
  return `video_seedance_${resolution}_${duration <= 8 ? 'short' : 'long'}`;
}

function pointsFor(resolution, duration) {
  const values = { video_seedance_480p_short: 32, video_seedance_480p_long: 40, video_seedance_720p_short: 48, video_seedance_720p_long: 58 };
  return values[skuFor(resolution, duration)];
}

function FilePicker({ accept, icon: Icon, label, files, multiple = false, onChange }) {
  return <label className="video-asset-input">
    <input type="file" accept={accept} multiple={multiple} onChange={event => onChange(Array.from(event.target.files || []))} />
    <Icon size={20} />
    <span>{files.length ? files.map(file => file.name).join('、') : label}</span>
  </label>;
}

function jobStatus(job) {
  if (job?.status === 'completed') return '成片已交付';
  if (job?.status === 'failed') return '未交付，积分已退回';
  if (job?.status === 'needs_review') return '受理结果确认中';
  if (job?.status === 'processing') return `生成中 ${job.progress || 0}%`;
  return '正在提交';
}

export default function VideoStudioPage({ embedded = false }) {
  const { state, dispatch, refreshBillingBalance } = useApp();
  const [capabilities, setCapabilities] = useState({ loading: true, generationEnabled: false });
  const [mode, setMode] = useState('script');
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
  const [activePanel, setActivePanel] = useState(null);
  const [panelPosition, setPanelPosition] = useState({ left: 16, bottom: 80, width: 520, maxHeight: 560, anchor: 260 });
  const pollRef = useRef(null);
  const toolbarRef = useRef(null);
  const buttonRefs = useRef({});
  const openedJobRef = useRef('');

  const sku = useMemo(() => skuFor(resolution, duration), [resolution, duration]);
  const estimatedPoints = pointsFor(resolution, duration);

  useEffect(() => {
    fetchVideoCapabilities()
      .then(setCapabilities)
      .catch(() => setCapabilities({ loading: false, generationEnabled: false }));
    listVideoJobs().then(result => setHistory(result.jobs || [])).catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    setQuote(null);
    setQuoteError('');
    quoteBillingAction({ sku, quantity: 1 })
      .then(result => { if (active) setQuote(result.quote); })
      .catch(() => { if (active) setQuoteError('费用确认暂时不可用'); });
    return () => { active = false; };
  }, [sku]);

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

  function replaceFiles(key, next, limit) {
    setFiles(current => ({ ...current, [key]: next.slice(0, limit) }));
  }

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
    if (submitting || !quote?.quoteId) return;
    setError('');
    setSubmitting(true);
    try {
      const [first, last, images, videos, audios] = await Promise.all([
        uploadFiles(files.first, 'image'),
        uploadFiles(files.last, 'image'),
        uploadFiles(files.images, 'image'),
        uploadFiles(files.videos, 'video'),
        uploadFiles(files.audios, 'audio'),
      ]);
      const urls = Object.fromEntries([...first, ...last, ...images, ...videos, ...audios].map(asset => [asset.id, asset.url]));
      const idempotencyKey = globalThis.crypto?.randomUUID?.() || `video-${Date.now()}`;
      const result = await createVideoJob({
        mode,
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

  const requires = mode === 'frame'
    ? files.first.length && files.last.length
    : mode === 'reference'
      ? files.images.length
      : mode === 'remake'
        ? files.images.length && files.videos.length
        : true;
  const canGenerate = capabilities.generationEnabled && quote?.quoteId && prompt.trim() && requires && !submitting;

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

  const activeMode = MODES.find(item => item.id === mode) || MODES[0];
  const assetCount = Object.values(files).reduce((sum, items) => sum + items.length, 0);
  const assetSummary = mode === 'script' ? '无需参考素材' : assetCount ? `${assetCount} 个素材` : '待上传素材';
  const toolbarSummary = {
    mode: activeMode.label,
    assets: assetSummary,
    shot: `${ratio} · ${duration}秒`,
    sound: sound ? '生成声音' : '无声音',
    settings: `${resolution.toUpperCase()} · Seed ${seed || '随机'}`,
  };

  const renderAssetPickers = () => {
    if (mode === 'script') {
      return <div className="video-panel-empty"><Sparkles size={22} /><strong>脚本成片无需参考素材</strong><span>直接描述主体、动作、镜头和节奏即可。</span></div>;
    }
    if (mode === 'frame') {
      return <div className="video-panel-assets two-columns">
        <FilePicker accept="image/jpeg,image/png,image/webp" icon={ImagePlus} label="上传首帧图" files={files.first} onChange={next => replaceFiles('first', next, 1)} />
        <FilePicker accept="image/jpeg,image/png,image/webp" icon={ImagePlus} label="上传尾帧图" files={files.last} onChange={next => replaceFiles('last', next, 1)} />
      </div>;
    }
    return <div className="video-panel-assets">
      <FilePicker accept="image/jpeg,image/png,image/webp" icon={ImagePlus} label="参考图片（最多 9 张）" files={files.images} multiple onChange={next => replaceFiles('images', next, 9)} />
      <FilePicker accept="video/mp4,video/webm,video/quicktime" icon={Video} label={mode === 'remake' ? '原视频（最多 3 个）' : '参考视频（最多 3 个）'} files={files.videos} multiple onChange={next => replaceFiles('videos', next, 3)} />
      <FilePicker accept="audio/*" icon={FileAudio} label="参考音频（最多 3 个）" files={files.audios} multiple onChange={next => replaceFiles('audios', next, 3)} />
    </div>;
  };

  const renderPanelBody = () => {
    if (activePanel === 'mode') return <div className="video-mode-grid">
      {MODES.map(item => <button key={item.id} type="button" className={mode === item.id ? 'is-selected' : ''} onClick={() => setMode(item.id)}>
        <span>{item.label}</span><small>{item.hint}</small>
      </button>)}
    </div>;
    if (activePanel === 'assets') return renderAssetPickers();
    if (activePanel === 'shot') return <>
      <div className="video-panel-section"><strong>视频画幅</strong><div className="video-ratio-grid">
        {RATIOS.map(value => <button key={value} type="button" className={ratio === value ? 'is-selected' : ''} onClick={() => setRatio(value)}><i style={{ aspectRatio: value.replace(':', ' / ') }} />{value}</button>)}
      </div></div>
      <div className="video-panel-section"><div className="video-panel-section-title"><strong>视频时长</strong><span>{duration} 秒</span></div>
        <input className="video-duration-range" type="range" min="4" max="15" step="1" value={duration} onChange={event => setDuration(Number(event.target.value))} />
        <div className="video-range-labels"><span>4 秒</span><span>15 秒</span></div>
      </div>
    </>;
    if (activePanel === 'sound') return <>
      <button type="button" className={`video-sound-choice${sound ? ' is-selected' : ''}`} onClick={() => setSound(current => !current)}>
        <span><Volume2 size={20} /><strong>生成同期声音</strong><small>根据画面内容生成环境声和动作声音</small></span><i aria-hidden="true" />
      </button>
      {(mode === 'reference' || mode === 'remake') && <div className="video-panel-section"><strong>音频参考</strong><FilePicker accept="audio/*" icon={FileAudio} label="上传参考音频（最多 3 个）" files={files.audios} multiple onChange={next => replaceFiles('audios', next, 3)} /></div>}
    </>;
    if (activePanel === 'settings') return <>
      <div className="video-panel-section"><strong>清晰度</strong><div className="video-resolution-grid">
        <button type="button" className={resolution === '480p' ? 'is-selected' : ''} onClick={() => setResolution('480p')}><b>480P</b><span>快速预览</span></button>
        <button type="button" className={resolution === '720p' ? 'is-selected' : ''} onClick={() => setResolution('720p')}><b>720P</b><span>正式成片</span></button>
      </div></div>
      <label className="video-panel-field"><span>避免出现的内容</span><textarea value={negativePrompt} onChange={event => setNegativePrompt(event.target.value)} maxLength={1200} placeholder="例如：画面抖动、人物结构异常、乱码文字、无关道具" /></label>
      <label className="video-panel-field compact"><span>随机种子</span><input type="number" value={seed} onChange={event => setSeed(Number(event.target.value) || 0)} /><small>填 0 表示随机生成</small></label>
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

  return <main className={`video-studio-page${embedded ? ' is-embedded' : ''}`}>
    {!embedded && <header className="video-studio-heading"><div><span className="video-studio-kicker"><Clapperboard size={16} />视频生成</span><h1>从创意素材到营销成片</h1><p>脚本、参考素材、镜头、声音和交付规格在同一个任务里完成。</p></div><button className="video-balance" type="button" onClick={() => dispatch({ type: 'SHOW_PRICE', show: true })}>AI 积分 <strong>{state.unlimited ? '无限额度' : state.ecPoints}</strong></button></header>}

    <section className="video-composer" aria-label="视频生成工作区">
      <header className="video-composer-heading"><span><Clapperboard size={16} />视频生成</span><h2>把创意素材变成可交付的视频</h2><p>描述内容，再按需调整创作模式、素材、镜头、声音和生成设置。</p></header>
      <div className="video-composer-input">
        {assetCount > 0 && <div className="video-selected-assets">{Object.entries(files).flatMap(([key, items]) => items.map(file => <span key={`${key}-${file.name}`}>{file.name}</span>))}</div>}
        <textarea id="video-prompt" value={prompt} onChange={event => setPrompt(event.target.value)} maxLength={1200} placeholder="描述主体、动作、镜头、场景和节奏。例如：人物拿起香水走向窗边，镜头从产品特写平滑推进到真实使用场景。" />
        <div className="video-text-meta"><span>{prompt.length}/1200</span><span><Sparkles size={14} />提交前锁定本次费用</span></div>
        {job && !FINAL.has(job.status) && <div className="video-job-progress"><span>{jobStatus(job)}</span><progress max="100" value={job.progress || 2} /></div>}
        {error && <div className="video-error">{error}</div>}
        {!capabilities.loading && !capabilities.generationEnabled && <div className="video-error">视频通道尚未完成安全配置，当前不会扣除积分。</div>}
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
        <div className="video-submit-row"><div><strong>{estimatedPoints} AI 积分 / 次</strong><span>{resolution.toUpperCase()} · {duration} 秒 · {sound ? '含声音' : '无声音'}</span></div><button type="button" disabled={!canGenerate} onClick={handleGenerate}><Play size={17} />{submitting ? '正在上传' : quoteError || '开始生成'}</button></div>
      </footer>
    </section>

    {renderFloatingPanel()}

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
