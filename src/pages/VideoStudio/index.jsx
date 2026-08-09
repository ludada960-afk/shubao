import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clapperboard, FileAudio, ImagePlus, Play, Sparkles, Upload, Video, Volume2 } from 'lucide-react';
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

export default function VideoStudioPage() {
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
  const pollRef = useRef(null);

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

  return <main className="video-studio-page">
    <header className="video-studio-heading">
      <div>
        <span className="video-studio-kicker"><Clapperboard size={16} />AI 营销视频工作台</span>
        <h1>从素材到成片，逐镜头可控</h1>
        <p>脚本、参考素材、声音和交付规格在一个任务里完成。</p>
      </div>
      <button className="video-balance" type="button" onClick={() => dispatch({ type: 'SHOW_PRICE', show: true })}>
        AI 积分 <strong>{state.unlimited ? '无限额度' : state.ecPoints}</strong>
      </button>
    </header>

    <section className="video-workbench">
      <aside className="video-controls" aria-label="视频生成设置">
        <div className="video-segments" role="tablist" aria-label="创作模式">
          {MODES.map(item => <button key={item.id} type="button" className={mode === item.id ? 'active' : ''} onClick={() => setMode(item.id)}>{item.label}</button>)}
        </div>
        <p className="video-mode-hint">{MODES.find(item => item.id === mode)?.hint}</p>

        {mode !== 'script' && <div className="video-field"><label>上传素材</label>
          <div className="video-assets">
            {mode === 'frame' ? <>
              <FilePicker accept="image/jpeg,image/png,image/webp" icon={ImagePlus} label="首帧图" files={files.first} onChange={next => replaceFiles('first', next, 1)} />
              <FilePicker accept="image/jpeg,image/png,image/webp" icon={ImagePlus} label="尾帧图" files={files.last} onChange={next => replaceFiles('last', next, 1)} />
            </> : <>
              <FilePicker accept="image/jpeg,image/png,image/webp" icon={ImagePlus} label="参考图片（最多 9 张）" files={files.images} multiple onChange={next => replaceFiles('images', next, 9)} />
              <FilePicker accept="video/mp4,video/webm,video/quicktime" icon={Video} label="参考视频" files={files.videos} multiple onChange={next => replaceFiles('videos', next, 3)} />
              <FilePicker accept="audio/*" icon={FileAudio} label="参考音频" files={files.audios} multiple onChange={next => replaceFiles('audios', next, 3)} />
            </>}
          </div>
        </div>}

        <div className="video-field"><label htmlFor="video-prompt">视频内容</label>
          <textarea id="video-prompt" value={prompt} onChange={event => setPrompt(event.target.value)} maxLength={1200}
            placeholder="描述主体、动作、镜头、场景和节奏，例如：不锈钢便捷酱料盒在厨房台面，镜头从产品特写平滑推进到真实使用场景。" />
          <div className="video-text-meta"><span>{prompt.length}/1200</span><span><Sparkles size={14} />任务提交后不会偷偷改价</span></div>
        </div>

        <details className="video-advanced"><summary>高级控制</summary>
          <label>排除内容<textarea value={negativePrompt} onChange={event => setNegativePrompt(event.target.value)} maxLength={1200} placeholder="不希望出现的画面、动作或风格" /></label>
          <label>随机种子<input type="number" value={seed} onChange={event => setSeed(Number(event.target.value) || 0)} /></label>
        </details>

        <div className="video-inline-fields">
          <label>清晰度<select value={resolution} onChange={event => setResolution(event.target.value)}><option value="480p">480P 快速预览</option><option value="720p">720P 正式成片</option></select></label>
          <label>画幅<select value={ratio} onChange={event => setRatio(event.target.value)}>{RATIOS.map(value => <option key={value}>{value}</option>)}</select></label>
          <label>时长<select value={duration} onChange={event => setDuration(Number(event.target.value))}>{Array.from({ length: 12 }, (_, index) => index + 4).map(value => <option key={value} value={value}>{value} 秒</option>)}</select></label>
          <label className="video-sound-toggle"><span>生成声音</span><input type="checkbox" checked={sound} onChange={event => setSound(event.target.checked)} /><Volume2 size={17} /></label>
        </div>

        {error && <div className="video-error">{error}</div>}
        {!capabilities.loading && !capabilities.generationEnabled && <div className="video-error">视频通道尚未完成安全配置，当前不会扣除积分。</div>}
        <div className="video-submit-row">
          <div><strong>{estimatedPoints} AI 积分 / 次</strong><span>{resolution.toUpperCase()} · {duration} 秒 · {sound ? '含声音' : '无声音'}</span></div>
          <button type="button" disabled={!canGenerate} onClick={handleGenerate}><Play size={17} />{submitting ? '正在上传素材' : quoteError || '开始生成'}</button>
        </div>
      </aside>

      <div className="video-stage">
        <div className="video-frame" style={{ aspectRatio: ratio.replace(':', ' / ') }}>
          {job?.status === 'completed' && job.resultUrl
            ? <video src={job.resultUrl} controls playsInline />
            : <div className="video-empty"><Upload size={30} /><strong>{job ? jobStatus(job) : '成片会显示在这里'}</strong><span>{job?.error || '只在确认交付后扣费，失败自动退回冻结积分'}</span>{job && !FINAL.has(job.status) && <progress max="100" value={job.progress || 2} />}</div>}
        </div>
        <div className="video-history">
          <div className="video-history-title"><strong>生成记录</strong><span>刷新页面后任务仍会继续</span></div>
          {history.length ? history.slice(0, 8).map(item => <button key={item.id} type="button" className={job?.id === item.id ? 'active' : ''} onClick={() => { setJob(item); if (!FINAL.has(item.status)) void poll(item.id); }}>
            <span>{item.prompt || '视频任务'}</span><small>{jobStatus(item)}</small>
          </button>) : <p className="video-history-empty">暂无视频任务</p>}
        </div>
      </div>
    </section>
  </main>;
}
