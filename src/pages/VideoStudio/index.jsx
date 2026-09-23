import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { VIDEO_WORKBENCHES } from '../../skills/videoWorkbenches.js';
import { specExposureOf } from '../../skills/videoSpecExposure.js';
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
  Maximize2,
  Sparkles,
  Trash2,
  Upload,
  Video,
  Volume2,
  X,
} from 'lucide-react';
import MentionPromptField from '../../components/creation/MentionPromptField.jsx';
import MediaAssetCard from '../../components/media/MediaAssetCard.jsx';
import '../../components/media/MediaAssetCard.css';
/* 素材卡：**与图片侧同一份实现**（用户 9-18 批注 3：「视频素材改成三张对称卡片，
   样式从图片侧复制，不要歪卡」）。这里不复制样式，直接复用电商生图那两个组件 ——
   样式值全部来自 Home.css 的 .ec-xhs-upload-card 一族，视频侧只覆盖两处：
   ① 三张卡不许歪（图片侧靠 race 倾斜做视觉节奏，这里是三个并列的种类，歪了就是"歪卡"）；
   ② 卡宽按素材条宽度自适应（图片侧 86px 固定宽，视频侧要铺满一行）。 */
import { EcommerceAddCard, EcommerceImageCard } from '../Home/ec/components/EcommerceAssetCards.jsx';
/* .ec-xhs-upload-card 一族定义在 Home.css。首页虽然是常驻挂载的，但**依赖别人 import 过**
   属于隐式依赖（构建顺序一变就静默失效，样式没了还不报错）；显式引一次，
   构建器会把顺序排成 Home.css → VideoStudio.css，本文件的两条覆盖正好压在上面。
   XhsContentMode 也是这么做的。 */
import '../Home/Home.css';
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
  uploadVideoAsset,
} from '../../services/video.js';
import {
  DEFAULT_VIDEO_MODE,
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
import { tagVideoJob } from './videoJobTags.js';
import { CAMERA_MOVES, SCENE_EDITS, composeVideoPrompt, planToContextText, workbenchExtraInstructions } from './cameraMoves.js';
import VideoWorkbench from '../../components/media/VideoWorkbench.jsx';
/* 批 K-D：视频侧「代为撰写」与图片侧「生成预览」共用同一个三步方案预览对话框 */
import PlanPreviewDialog from '../../components/plan-preview/PlanPreviewDialog.jsx';
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

/* ═══ 批 T（2026-09-21）：暖色渐变面的**条件外壳**（照图片侧的包覆关系）════════════════════
   为什么单独抽一个组件而不是内联三元：外壳要多包一层 div，若写成
   `{cond ? <div>{children}</div> : children}`，React 每次渲染都会看到一个新的元素类型，
   子树会被**整棵重挂载** —— 提示词、已选素材、已确认方案全部丢（那是会花钱的 bug）。
   放在模块作用域里，类型是稳定的；开关切换时才重建。
   不成立时返回 fragment：**不套任何元素**（子页面工作台保持原样，一个像素不动）。 */
function ComposerSurface({ on, children }) {
  return on ? <div className="video-composer-surface">{children}</div> : <>{children}</>;
}

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

/* ⚠️ 2026-09-18 批「三张对称卡」时删掉了这里的 MediaPreview 与 UploadStatus：
   MediaPreview 的每一处返回值都没有被任何 JSX 引用过（实测 grep：0 个渲染点），
   是"卡片内部自绘缩略图"那个已被 MediaAssetCard 取代的旧实现的残留；
   UploadStatus 同理 —— 上传进度现在由素材卡自己的 data-status 表达。
   保留它们的代价是**多条契约测试在守不存在的 DOM**（video-studio-contract 里就有两条），
   下一个人会以为进度条还在那里。判据改成守真正在跑的那条链路（见同文件门禁）。 */
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

/* 素材卡：**只有一个实现** —— src/components/media/MediaAssetCard（图片/视频板块共用）。
   2026-09-16 用户批注（图 #2）：「他现在视频生成的样式并不是这样的…要按我们电商生图这边的
   卡片歪过来的形式来上传素材，样式逻辑得是类似的」。
   此前这里手写了一套 video-media-card（扇形数值靠 CSS 复制），与图片侧是两份实现；
   现在空态仍由本地 label 承载（要触发原生文件选择器），已选态一律交给 MediaAssetCard 渲染，
   重复实现随之删除。判据见 test/media-language-unify-0916.test.mjs。 */
function FilePicker({ accept, icon: Icon, label, files, multiple = false, onChange, onRemove, inputRef, upload, onRetry, onPreview }) {
  const file = files[0];
  const kind = accept?.startsWith('video') ? 'video' : accept?.startsWith('audio') ? 'audio' : 'image';
  if (file) {
    return <MediaAssetCard
      kind={kind}
      src={file.previewUrl || file.url || ''}
      label={files.length > 1 ? `${label} · ${files.length} 个` : label}
      status={upload?.status === 'uploading' ? 'uploading' : upload?.status === 'error' ? 'error' : 'ready'}
      progress={upload?.progress || 0}
      onPreview={onPreview ? () => onPreview({ file }) : null}
      onRemove={onRemove || null}
    />;
  }
  return <div className="video-media-card video-media-picker">
    <label className="video-media-picker-control">
      <input ref={inputRef} type="file" accept={accept} multiple={multiple} onChange={event => {
        onChange(Array.from(event.target.files || []));
        event.target.value = '';
      }} />
      <span className="video-media-add-icon"><Icon size={20} /></span>
      <strong>{label}</strong>
      <small>点击选择文件</small>
    </label>
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

/* ═══ 嵌入形态（子页面里整块复用本工作台）═══════════════════════════════════════
   用户 9-17：「生成结果直接在工作台里面展示，不必像之前一样生成完就一定要跳进去画布里面……
   如果是在子页面的工作台生成的，结果就会在各自的子页面历史记录里面。」
   于是本组件多出四个**只在子页面用**的入参（首页那条路径一个都不传，行为与从前完全一致）：
     · inlineResult  结果台（成片播放器 + 生成记录）在嵌入形态下也渲染 —— 生成完就在原地看成片；
     · initialMode   按技能落创作方式页签（skillRun.skillVideoMode），不用用户自己再选一次；
     · skillTag      这次任务属于哪条技能 → 记在本机（videoJobTags），供子页面历史筛选用；
     · onJobs        把服务端的任务列表回传给外层，让子页面能把它渲染成自己的历史；
     · preset/presetNonce 历史里点「用这组参数」时，把提示词与规格还原回创作台。
     · autoOpenCanvas  成片完成后是否**自动**进画布。默认 true（独立路由与首页输入框保持 9-12 的策略：
                       首页那两个输入框生成完自动进画布继续加工，用户 9-17 也认可这一点）。
                       技能**子页面**必须传 false —— 用户 9-17 的原话是「生成结果直接在工作台里面展示，
                       不必像之前一样生成完就一定要跳进去画布里面」，自动跳走等于把结果从眼前拿走。
   ⚠️ 入参叫 preset 不叫 seed：本组件里 seed 已经是「随机种子」那个数字（下方 useState(0)），
      同名会直接编译失败（esbuild: The symbol "seed" has already been declared）。 */
export default function VideoStudioPage({
  embedded = false,
  inlineResult = false,
  initialMode = '',
  skillTag = '',
  onJobs = null,
  preset = null,
  presetNonce = 0,
  autoOpenCanvas = true,
  /* ═══ 批 N：这条 skill 的**左栏工作台规格**（来自声明源 src/skills/videoWorkbenches.js）═══
     用户第 18 轮：「他们这些 skill 页面……每个工作台都是不一样的呀，你现在完全没抄，
       用的依然是我们之前首页的视频生成版本糊弄我……对应的一比一去抄啊」。
     传了它 = 子页面按**这条 skill 自己的**工作台渲染（知渔 20 个页面逐页抄来的规格）；
     不传（首页输入框 / 独立路由）= 与从前**完全一致**，一个像素都不动。 */
  workbench = null,
  workbenchSkillId: skillId = '',
  /* ═══ 批 S：左栏那一行组头（「参数配置」）═══════════════════════════════════════════════
     知渔视频侧 32 个子页面**逐条计数**：25 条有这一行、7 条没有（6 条路由页 + 趣味脱口秀）。
     ⇒ 组头由页面按对照表传进来（quantvVideoShowsParamGroup），不在渲染层写死一刀切。
     ⚠️ 属性名与图片侧 WorkbenchShell 的同名入参一致（groupTitle），两处判据同一份。 */
  groupTitle = '参数配置',
}) {
  /* ═══ 首页形态 vs 技能子页面形态（用户 9-18 批注 2 / 3 / 8 / 9 / 10 / 11 / 12）══════
     用户口径：「首页就是要让用户快速的去生成去跑一遍呀，你不要把功能做的太杂了，做的太杂，
     没有人会去用你的」「选模型的地方只能选模型」「配置就是这么点而已，更精细化的配置
     就是要进到相关的子页面里面去做的」。
     判据：首页用的是 <VideoStudioPage embedded inlineResult />（**没有 skillTag、没有 initialMode**）；
     skill 子页面一定带 skillTag（MediaCreation 传的）。所以 skillTag 为空 = 首页形态。
     ⚠️ 子页面形态下**一个功能都不许少**：三档创作方式、技能库、镜头规格、运镜、"只改一个元素"、
        生成记录，全部保持原样（用户批注 15：子页面才是精细化调参的地方）。 */
  const homeComposer = Boolean(embedded) && !skillTag;
  const { state, dispatch, refreshBillingBalance } = useApp();
  const [capabilities, setCapabilities] = useState({ loading: true, generationEnabled: false, workbenchEnabled: false, workbenchMode: 'planning', workbenchPlanningOnly: false });
  const [activeVideoProjectId, setActiveVideoProjectId] = useState('');
  const [activeVideoPlanHash, setActiveVideoPlanHash] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  /* 默认创作方式 = 智能成片；技能子页面用 initialMode 指定自己那一档（skillVideoMode） */
  const [mode, setMode] = useState(() => initialMode || DEFAULT_VIDEO_MODE);
  const [files, setFiles] = useState({ first: [], last: [], images: [], videos: [], audios: [] });
  /* ═══ 批 N：按 skill 声明的**多槽位素材**（知渔：探店素材 0/6、模特选择 0/3、穿搭图1/2/3、椅子图…）═══
     为什么不塞进 files.images：知渔的每一块素材都有自己的**标题、说明、上限、接受类型**，
     合并成一堆就再也说不出"这一张是门店照还是模特照"。上传与生成仍走**同一条链路**（下面合并）。 */
  const [slotFiles, setSlotFiles] = useState({});
  /* 批 T：工作台里**除主文本格以外**的文本（门店信息这类），按 block.key 存 —— 见 VideoWorkbench 的说明 */
  const [blockTexts, setBlockTexts] = useState({});
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
  /* 批 N：知渔「内容替换」页里的两颗胶囊（换模特 / 换产品）—— 它是**一个控制项**，
     选中后往提示词追加一句明确的替换指令（与运镜 / 只改一个元素同一条机制）。 */
  const [swapTarget, setSwapTarget] = useState('model');
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState('');
  const [job, setJob] = useState(null);
  const [history, setHistory] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [planOpen, setPlanOpen] = useState(false);
  /* ═══ 2026-09-19 批 K-D：视频侧「代为撰写」═══════════════════════════════════════════════
     用户第 16 轮原话：「视频生成这边的话，代为撰写，它就是代为撰写。它的原理就是**帮你把这个视频的
     脚本给完善起来**。」「他们这两套东西**本质上都是一个设计方案**，只是在它里面**有不同的入口**。」
     ⇒ 与图片侧「生成预览」共用**同一份** PlanPreviewDialog（服务端也是同一条 /api/plan-preview）。 */
  const [daweiPreview, setDaweiPreview] = useState(null);
  const [planReviewed, setPlanReviewed] = useState(false);
  const [analyzedPlan, setAnalyzedPlan] = useState(null);
  const [analyzedSignature, setAnalyzedSignature] = useState('');
  const [plannedUploads, setPlannedUploads] = useState(null);
  const [planning, setPlanning] = useState(false);
  const [activePanel, setActivePanel] = useState(null);
  const [inlineMenu, setInlineMenu] = useState(null);
  /* 批 T：模型菜单的浮层坐标（居中于按钮上方；与配置面板同一套算法，见 positionModelMenu） */
  const [modelAnchor, setModelAnchor] = useState(null);
  const modelButtonRef = useRef(null);
  const [panelPosition, setPanelPosition] = useState({ left: 16, bottom: 80, width: 520, maxHeight: 560, anchor: 260 });
  /* 全屏（用户批注 3）：走浏览器原生 fullscreen，ESC 由浏览器接管 ——
     所以状态必须从 fullscreenchange 读回来，不能只在按钮里翻布尔（按 ESC 后界面会说反话）。 */
  const [fullscreen, setFullscreen] = useState(false);
  const pollRef = useRef(null);
  const toolbarRef = useRef(null);
  const quickToolsRef = useRef(null);
  /* 三个素材种类各自的 file input（点卡片 → 开对应那一类），以及创作台本体（全屏用）。
     input 不放进卡片里：卡片是 button，内部再套 label 会让选择器弹两次。 */
  const quickInputRefs = useRef({});
  const composerRef = useRef(null);
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
  /* ═══ 融合控件（运镜 / 只改一个元素）═══════════════════════════════════════════
     声明源里的 video.camera_move 与 video.scene_edit 是**辅助能力**，它们不占独立玩法，
     而是长在这个创作台里的两个控制项（用户 9-17：「融合在一些主 skill 里面」）。
     选中后只做一件事：往真正下发的提示词末尾追加一句明确的镜头/编辑指令。
     ⚠️ 幂等键与请求体都取这一份 composedPrompt —— 两处不同源就会出现
        "键一样、内容不一样"的重放事故（用户以为没重复扣费，其实跑的是另一次生成）。 */
  const [cameraMove, setCameraMove] = useState('');
  const [sceneEdit, setSceneEdit] = useState('');
  const activeAnalysis = analyzedSignature === planSignature ? analyzedPlan : null;
  /* ⚠️ 批 S 修 bug：这里原来无条件把三条指令拼进去，而 swapTarget 的初始值是 'model'
     ⇒ 每个视频页面（含没有"替换对象"控件的视频创作 / 爆款复刻 / 探店视频）都往提示词里
        悄悄追加「把原片里的人物替换成我上传的人物图片…」，界面上还写着"将追加到提示词"。
     现在改成**由这一页真的声明了哪些控件派生**（规则与理由见 cameraMoves.js 的
     workbenchExtraInstructions，纯函数、门禁直接断言）。 */
  const extraInstructions = useMemo(
    () => workbenchExtraInstructions({ blocks: workbench?.blocks || [], cameraMove, sceneEdit, swapTarget }),
    [workbench, cameraMove, sceneEdit, swapTarget],
  );
  /* ⚠️ 只有 activeAnalysis 存在时才取它的 optimizedPrompt（方案确认过的那版），
      否则取用户输入的原文 —— 其余情况一律不拼，避免把"还没分析"的提示词当分析结果用。
      批 T：工作台里的**非主文本格**（门店信息这类）作为背景信息拼在最前面，
      与页面上从上到下的阅读顺序一致；空的不拼（不留空段）。 */
  const workbenchContext = useMemo(() => {
    const blocks = workbench?.blocks || [];
    return blocks
      .filter(block => block.kind === 'text' && block.key !== 'prompt')
      .map(block => {
        const text = String(blockTexts[block.key] || '').trim();
        return text ? block.title + '：' + text : '';
      })
      .filter(Boolean)
      .join('\n');
  }, [workbench, blockTexts]);
  const composedPrompt = useMemo(
    () => composeVideoPrompt(
      [workbenchContext, activeAnalysis ? activeAnalysis.optimizedPrompt : prompt].filter(Boolean).join('\n'),
      extraInstructions,
    ),
    [workbenchContext, activeAnalysis, prompt, extraInstructions],
  );
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

  /* 任务列表回传给外层（子页面把它渲染成自己的「历史」页签）。
     ⚠️ onJobs 用 ref 持有：把它放进依赖数组，外层每次渲染换个函数字面量就会无限回传。 */
  const onJobsRef = useRef(onJobs);
  onJobsRef.current = onJobs;
  useEffect(() => { onJobsRef.current?.(history); }, [history]);

  /* 历史里点「用这组参数」→ 把那次任务的提示词与规格还原回创作台。
     presetNonce 是"又点了一次同一条"的判据：没有它，第二次点同一条不会重新生效。 */
  useEffect(() => {
    if (!preset) return;
    if (preset.mode && VIDEO_CREATION_MODES.some(item => item.id === preset.mode)) setMode(preset.mode);
    if (typeof preset.prompt === 'string') setPrompt(preset.prompt);
    if (typeof preset.negativePrompt === 'string') setNegativePrompt(preset.negativePrompt);
    if (Number.isFinite(Number(preset.duration)) && Number(preset.duration) > 0) setDuration(Number(preset.duration));
    if (preset.ratio) setRatio(preset.ratio);
    if (preset.resolution) setResolution(preset.resolution);
    if (typeof preset.sound === 'boolean') setSound(preset.sound);
    /* 参数变了 → 之前确认过的方案不能再算数（否则会用旧方案去生成新内容） */
    setPlanReviewed(false);
  }, [presetNonce]);

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

  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    sync();
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  useEffect(() => () => clearTimeout(pollRef.current), []);

  const positionPanel = useCallback((key = activePanel) => {
    if (!key) return;
    const button = buttonRefs.current[key];
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    /* ═══ 批 T：生成设置面板宽度取**知渔 dashboard 的实测值 521**（用户指着图八说照抄）═══════
       他们那一栏的内宽因此正好是 521 − 2×25 = 471 = 3 张 150 宽的比例卡 + 2 条 10 的缝 ——
       这不是随手写的数，是"照抄"这条要求落到的具体几何（实测见 .tmp/qy-settings-report.txt）。
       其余面板（镜头规格 / 声音）宽度不变，它们没有对应页可比。 */
    /* ═══ 批 U（2026-09-21）：宽度统一到**图片侧那一档 480**（用户本轮原话）══════════════════════
       原话：「视频生成和图片生成的这两块地方……都是选模型，还有一个配置这两个按钮，那他们的面板
       为什么不能做样式一致的做法呢？……**比例大小、里面做的东西、规格、色彩、UI、交互都应该保持
       一致**呀。……视频生成那边就**按照图片生成这边的规格去做**。」
       ⇒ 这条**推翻上一版**（上一版照知渔 dashboard 用了 521 + 内边距 25，那组数是"照抄竞品"来的）；
         本轮用户要的是**站内两个板块一致**，所以两个视频面板（生成设置 / 镜头规格 / 模型菜单）
         全部对齐图片侧 `.visual-config-panel` 的 **480**。 */
    const preferred = key === 'settings' ? 480 : key === 'assets' ? 480 : 480;
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

  /* ═══ 批 T（2026-09-21）：模型菜单的**定位 + 与配置面板互斥**（用户本轮原话，逐字）══════════
     原话：「你再看一下图七。你现在这些**张开的面板是会打架的**。我点击这些按钮。他们向上张开面板
     就必须**只能有一个张开**，不能互相打架，明白吗？而且他们是**可以超出这些输入框的界限**的。
     你必须让这些向上张开的配置面板，他们要**居中于按钮的上方**。」
     改前（实测 .tmp/ours-cta.txt 同法）：模型菜单是 `.video-inline-control` 里的 absolute 元素，
     `left: 0; bottom: calc(100% + 8px)` —— 它贴着按钮**左边**展开（9-12 为了让"左侧不被截断"
     才这么写的，那条判据本轮被用户推翻），而且被 `.video-composer { overflow: hidden }` 裁掉；
     更糟的是它与工具栏那套 `.video-config-panel`（activePanel）**两套状态各自为政**，
     两件事可以同时展开、叠在一起 —— 用户截图里看到的就是这个。
     ⇒ ① 位置：`position: fixed` + 由按钮矩形算出**居中于按钮上方**的坐标（视口 12px 安全边内夹取）；
        ② 越界：fixed 元素不受任何祖先 overflow 裁切（已实测祖先链上无 transform/filter）；
        ③ 互斥：openPanel 关模型菜单、开模型菜单关面板（见下面两处）。 */
  const positionModelMenu = useCallback(() => {
    const button = modelButtonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    /* 批 U：宽度与图片侧的模型面板同一档（480）—— 用户要求两块保持一致的规格 */
    const width = Math.min(480, viewportWidth - 24);
    setModelAnchor({
      left: Math.max(12, Math.min(rect.left + rect.width / 2 - width / 2, viewportWidth - width - 12)),
      bottom: Math.max(12, window.innerHeight - rect.top + 8),
      width,
    });
  }, []);

  const toggleModelMenu = useCallback(() => {
    setInlineMenu(current => {
      if (current === 'model') return null;
      setActivePanel(null);        /* 互斥：模型菜单展开时收起配置面板 */
      positionModelMenu();
      return 'model';
    });
  }, [positionModelMenu]);

  const openPanel = useCallback((key) => {
    /* 9-11 三轮批注: 技能库是一级入口 (直接弹技能库, 不再是浮层面板) */
    if (key === 'skills') {
      setActivePanel(null);
      setInlineMenu(null);         /* 互斥：技能库弹层也是"向上张开"的一层，不能与模型菜单叠着 */
      setSkillOpen(current => !current);
      return;
    }
    if (activePanel === key) {
      setActivePanel(null);
      return;
    }
    setInlineMenu(null);           /* 互斥：配置面板展开时收起模型菜单（用户本轮：只能有一个张开） */
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
    /* ═══ 批 U（2026-09-21）：面板必须**吸在按钮上**（用户本轮原话，逐字）═══════════════════════
       原话：「你现在这个视频模型的面板是**会脱离你的这个按钮的**，这个是不行的，**一定是要吸附在
       上面的**。」
       根因：模型菜单是 `position: fixed` + **开面板那一刻**算出来的坐标（positionModelMenu），
       之后页面一滚、窗口一缩，按钮跑了，面板还钉在原地 —— 两张皮。
       图片侧的面板一直有这两个监听（见 VisualCreationMode 里同一个 effect），视频侧漏了。
       ⇒ 补齐：滚动（捕获阶段，左栏内部滚也吃得到）与缩放都重新定位，与配置面板同一个口径。 */
    const followButton = () => positionModelMenu();
    window.addEventListener('resize', followButton);
    window.addEventListener('scroll', followButton, true);
    const closeOnEscape = event => {
      if (event.key === 'Escape') setInlineMenu(null);
    };
    document.addEventListener('pointerdown', closeMenu);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeMenu);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', followButton);
      window.removeEventListener('scroll', followButton, true);
    };
  }, [inlineMenu, positionModelMenu]);

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
    /* 批 N：按 skill 声明的槽位素材（全部是图片）走同一条上传链路 */
    Object.values(slotFiles).forEach(items => (Array.isArray(items) ? items : []).forEach(file => selected.set(file, 'image')));
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
  }, [files, slotFiles, refreshUploads, startUpload, state.logged]);

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

  /* 清空素材（用户批注 3）：一张不留，且**连带清掉已上传记录** ——
     只清界面上的卡片、服务端那条上传还在的话，下一次生成会带着"看不见的素材"去跑。 */
  function clearMaterials() {
    setPlanReviewed(false);
    setPlannedUploads(null);
    setFiles({ first: [], last: [], images: [], videos: [], audios: [] });
    setSlotFiles({});
  }
  /* 批 N：槽位素材的增删。replace=true 表示整组替换（删掉某一张），否则是追加。 */
  function updateSlotFiles(slotKey, next, options = {}) {
    setPlanReviewed(false);
    setPlannedUploads(null);
    setSlotFiles(current => {
      const limit = Number(options.limit || 0) || 9;
      const merged = options.replace ? next : [...(current[slotKey] || []), ...next];
      return { ...current, [slotKey]: merged.slice(0, limit) };
    });
  }

  const toggleFullscreen = useCallback(async () => {
    const node = composerRef.current;
    if (!node) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await node.requestFullscreen?.();
    } catch {
      /* 浏览器不允许（非用户手势 / 权限）时什么都不做，按钮标题里已写明这是全屏 */
    }
  }, []);

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
      /* ⚠️ 服务端这次没给出任务（网关抖动 / 任务被清理 / 响应形状变了）时，
         **绝不能**把 undefined 写进状态：
           ① 会把用户正在看的成片清空（明明已经出来了）；
           ② 会往生成记录里塞一个 undefined —— 渲染 item.id 时整页白屏。
         正确的做法是当作"这一次没问着"，过一会儿再问。 */
      if (!next) {
        pollRef.current = setTimeout(() => poll(id), 8000);
        return;
      }
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
      /* 批 N：按 skill 声明的**槽位素材**也是这次生成的输入（它们与「图片」同一类，只是各有各的标题） */
      const selected = mode === 'frame'
        ? { first: files.first, last: files.last, images: [], videos: [], audios: [] }
        : { first: [], last: [], images: [...files.images, ...slotImageFiles], videos: files.videos, audios: files.audios };
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
        composedPrompt,
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
        prompt: composedPrompt,
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
      /* 这次任务是哪条技能发起的 —— 只写本机标记，供子页面历史筛选（不参与计费与幂等） */
      if (skillTag) tagVideoJob(result.job.id, skillTag);
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
        : { first: [], last: [], images: [...files.images, ...slotImageFiles], videos: files.videos, audios: files.audios };
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
      /* ═══ 批 U：分析结论**自动落进**工作台里那一格「背景信息」（用户：「可以吧，让它自动落进去」）═══
         知渔那一页的行为是：AI 分析完，结论直接写在「门店信息」的输入框里、用户还能改。
         我们上一批只做了"可编辑"，没有落点 —— 这一条补上。
         ⚠️ 两条纪律：① **只在那一格为空时**写（绝不覆盖用户已经写下的内容）；
                    ② 只写声明了这种"非主文本格"的技能（探店漫游那一页有，别的页没有就不写）。 */
      const contextBlock = (workbench?.blocks || []).find(block => block.kind === 'text' && block.key !== 'prompt');
      if (contextBlock) {
        const filled = planToContextText(result.plan);
        if (filled) {
          setBlockTexts(current => (String(current[contextBlock.key] || '').trim() ? current : { ...current, [contextBlock.key]: filled }));
        }
      }
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

  /* ⚠️ autoOpenCanvas=false（技能子页面）时**不自动跳**：结果就留在这一页的成片台上，
     想去画布继续加工的，点成片台下面那个「在画布中继续」就走同一条路。
     判据是"这次生成发生在哪一页"，不是"用户在不在首页"。 */
  useEffect(() => {
    if (!autoOpenCanvas) return;
    if (job?.status !== 'completed' || !job.resultUrl || openedJobRef.current === job.id) return;
    openedJobRef.current = job.id;
    openJobInCanvas(job);
  }, [job, autoOpenCanvas]);

  /* 批 K-D：视频侧「代为撰写」= 图片侧「生成预览」的同一条流水线（同一个对话框、同一个端点）。
     ⚠️ 空输入时照知渔的实测行为：**只给一句提示，不发任何请求** ——
        他们原文是「请先上传参考元素或简单描述脚本。」（实测 0 次网络请求、不消耗任何积分）。 */
  const runDawei = async () => {
    if (!String(prompt || '').trim()) {
      setError('请先上传参考元素或简单描述脚本。');
      return undefined;
    }
    setError('');
    const materials = [];
    for (const [index, file] of files.images.slice(0, 6).entries()) {
      try {
        const asset = await uploadVideoAsset(file, 'image');
        materials.push({
          id: String(asset?.id || asset?.assetId || ('video-image-' + (index + 1))),
          name: String(file?.name || ('图片' + (index + 1))),
          url: String(asset?.url || ''),
        });
      } catch {
        /* 单张素材传不上去就跳过：少一张参考图不该让整条流水线失败。 */
      }
    }
    setDaweiPreview({ materials, prompt: String(prompt || '').trim() });
    return undefined;
  };

  /* 「确认并应用」= 把方案正文写回脚本输入框（知渔第 3 步原文也是「确认脚本并应用」）。 */
  const applyDaweiPreview = text => {
    setPrompt(String(text || '').slice(0, VIDEO_PROMPT_MAX_LENGTH));
    setPlanReviewed(false);
    setDaweiPreview(null);
    return undefined;
  };

  const workbenchMode = Boolean(embedded && workbench && (workbench.blocks || []).length);
  /* ═══ 2026-09-24 批 AG：**规格暴露**（用户：「为什么还有这种模型 / 清晰度 / 时长都全部做进去的情况呢，
     我不是说了所有子页面一比一对应知渔的视频生成和图片生成的页面吗」）═══════════════════════════
     逐页探针（真浏览器，30 个有对照页的技能）查出：**每一页都渲染同一套** ——
     生成设置面板里固定有「清晰度 / 画面比例 / 视频时长」，工具栏固定有一颗「模型」。
     而知渔那 30 页里：**清晰度 0 页有、模型 5 页有、时长 6 页有**。
     ⇒ 子页面按 `videoSpecExposure`（由知渔实采派生、有门禁钉住）决定这三格露不露；
       首页/独立路由（非子页面）保持原样（它是"通用创作台"，本来就该给全部规格）。 */
  const workbenchSkillId = useMemo(() => {
    if (skillId) return skillId;                       // 显式传进来的（MediaCreation 传 skill.id）
    if (!workbench) return '';
    /* 回退：对象身份反查 —— ⚠️ 实测这条**不可靠**（拿到的是不同引用，会成全空），
       所以 MediaCreation 那边改成了显式传 id；这里只作兜底，不要把主路径压在这上面。 */
    const hit = Object.entries(VIDEO_WORKBENCHES).find(([, value]) => value === workbench);
    return hit ? hit[0] : '';
  }, [skillId, workbench]);
  const specExposure = workbenchMode
    ? specExposureOf(workbenchSkillId)
    : { model: true, clarity: true, duration: true };
  const slotEntries = useMemo(() => Object.entries(slotFiles)
    .flatMap(([slotKey, items]) => (Array.isArray(items) ? items : []).map((file, index) => ({ file, slotKey, index }))), [slotFiles]);
  const slotImageFiles = useMemo(() => slotEntries.map(item => item.file), [slotEntries]);
  const materialEntries = [
    ...files.images.map((file, index) => ({ file, key: 'images', index, kind: 'image', label: '图片', name: `图片${index + 1}` })),
    ...slotEntries.map((item, index) => ({ file: item.file, key: 'slots', index, kind: 'image', label: '图片', name: `图片${files.images.length + index + 1}` })),
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
  /* 首尾帧那两格是"起点/终点"两个固定位，没有"素材集合"可清、也不该整屏铺开 ——
     所以清空与全屏只长在真正有素材集合的档位上（给一个点了没意义的按钮比不给更糟）。 */
  const deckMode = mode !== 'frame';
  const toolbarSummary = {
    shot: `${ratio} · ${duration}秒`,
    sound: sound ? '生成声音' : '无声音',
    settings: `${resolution.toUpperCase()} · Seed ${seed || '随机'}`,
    /* 9-12 用户批注：技能选择的结果要显示在「技能库」这一项下面（生成设置里那份去掉） */
    skills: userSkills.length ? userSkills.map(skill => skill.name).join(' · ') : '未选技能',
  };

  const renderAssetPickers = () => {
    if (mode === 'frame') {
      /* ═══ 2026-09-19 批 I-⑥（用户批注 #1-5 / #2-1）══════════════════════════════════════
         原话：「这两张卡片依然没有学习图片生成那边的样式啊……首尾帧的是两张卡片，
         完全可以像图片生成那边做成**两张卡片对称歪着，中间一个乘号**这样做呀，
         你复制过来然后改一下文案就好呀。」
         以及：「首尾帧和图片生成都应该是左右歪的，然后样式要统一这种呀，一模一样就好。」
         落点就是「复制过来改文案」这五个字：
           · 中间那个乘号直接用图片侧**同一个**节点（.ec-xhs-multiply，定义在 Home.css），
             不新造一个长得像的；
           · ±5° 对称歪由 CSS 按位置给（见 VideoStudio.css 的 .is-frame 两条），
             ⚠️ 用 :nth-of-type(1)/(2) 而不是 :nth-child —— 中间插了那个 span，
             两张卡是第 1、3 个子节点，但仍是第 1、2 个 div。
           · 歪的是**外壳**，所以空态（.video-media-picker）与已选态（MediaAssetCard）
             两种长相都会跟着歪，不会"放上图片以后突然摆正"。 */
      return <div className="video-media-deck is-frame">
        <FilePicker accept="image/jpeg,image/png,image/webp" icon={ImagePlus} onPreview={setLightboxEntry} label="上传首帧图" files={files.first} onChange={next => replaceFiles('first', next, 1)} onRemove={() => removeFile('first', 0)} inputRef={firstFrameInputRef} upload={uploadFor(files.first[0])} onRetry={() => retryUpload(files.first[0], 'image')} />
        <span className="ec-xhs-multiply" aria-hidden="true">×</span>
        <FilePicker accept="image/jpeg,image/png,image/webp" icon={ImagePlus} onPreview={setLightboxEntry} label="上传尾帧图" files={files.last} onChange={next => replaceFiles('last', next, 1)} onRemove={() => removeFile('last', 0)} inputRef={lastFrameInputRef} upload={uploadFor(files.last[0])} onRetry={() => retryUpload(files.last[0], 'image')} />
        <div className="video-media-guidance"><strong>用两张画面定义镜头起点与终点</strong><small>中间动作、运镜和节奏在下方描述。</small></div>
      </div>;
    }
    /* ═══ 2026-09-18 用户批注 3：三张对称卡片（图片 / 视频 / 音频）+ 清空素材 + 全屏 ═══════
       原话：「视频素材这边你也得像图片那边一样，三张卡是对称的，样式从图片侧复制，
       不要歪卡，再加一个清空素材和一个全屏的按钮。」
       落点（三件事一起做才叫"复制过来"）：
         ① **结构**：ec-xhs-media-column → ec-xhs-media-strip，与图片侧 .visual-reference-zone 逐层同构；
         ② **卡片**：直接用 EcommerceAddCard / EcommerceImageCard（图片侧同一份实现），
            视频侧不写卡片内部结构、不复制样式值；
         ③ **对称**：图片侧靠 .ec-xhs-card-product/.ec-xhs-card-reference 的 ±5deg 倾斜做视觉节奏，
            这里是三个并列的素材种类，倾斜就是用户说的"歪卡" → 在 .video-material-strip 里清零。
       ⚠️ 三个 file input 仍然各自独立（accept 不同），点哪张卡就开哪一类的选择器。 */
    const uploadActions = mode === 'remake'
      ? [
        { kind: 'image', key: 'images', label: '替换图片', hint: '商品、人物或场景', accept: 'image/*' },
        { kind: 'video', key: 'videos', label: '参考视频', hint: '提取节奏与镜头结构', accept: 'video/*' },
        { kind: 'audio', key: 'audios', label: '参考音频', hint: '音乐、对白或声音', accept: 'audio/*' },
      ]
      : [
        { kind: 'image', key: 'images', label: '图片', hint: '商品、人物与场景', accept: 'image/*' },
        { kind: 'video', key: 'videos', label: '视频', hint: '动作、运镜与节奏', accept: 'video/*' },
        { kind: 'audio', key: 'audios', label: '音频', hint: '音乐、对白与声音', accept: 'audio/*' },
      ];
    /* 已选素材：走图片侧那张**带缩略图**的卡（ec-xhs-image-card），与三张空卡同宽同高，
       于是"选了一张图"这件事在视觉上就是同一张卡被填上了内容，不会再长出第二种长相。
       上传状态沿用局部 FilePicker/UploadStatus 的判据（uploading / error / ready）。 */
    const mediaCardStatus = file => {
      const state = uploadFor(file)?.status;
      return state === 'uploading' ? 'uploading' : state === 'error' ? 'error' : 'ready';
    };
    return <div className="video-material-workspace">
      <div className="ec-xhs-media-column video-material-column" aria-label="选择素材类型">
        <div className="ec-xhs-media-strip video-material-strip">
          {materialEntries.map(item => <EcommerceImageCard
            key={`${item.key}-${item.index}-${item.file.name}`}
            role="product"
            image={{ url: item.previewUrl || item.url || uploadFor(item.file)?.asset?.url || '', status: mediaCardStatus(item.file) }}
            label={item.label}
            index={item.index}
            onRemove={() => removeFile(item.key, item.index)}
          />)}
          {uploadActions.map(action => <EcommerceAddCard
            key={action.kind}
            role="product"
            kind={action.kind}
            label={action.label}
            meta={action.hint}
            title={`添加${action.label}`}
            onClick={() => quickInputRefs.current[action.kind]?.click()}
          />)}
        </div>
      </div>
      {/* ⚠️ input 放在**卡片外面**：卡片内部再套一个 label 会同时触发两次选择器
          （label + 冒泡到 onClick），用户会看到文件框连开两次。 */}
      {uploadActions.map(action => <input
        key={action.kind}
        ref={element => { quickInputRefs.current[action.kind] = element; }}
        className="video-material-input"
        type="file"
        accept={action.accept}
        multiple
        tabIndex={-1}
        aria-hidden="true"
        onChange={event => { appendQuickFiles(Array.from(event.target.files || [])); event.target.value = ''; }}
      />)}
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
      {/* ═══ 批 T（2026-09-21）：生成设置**照知渔 dashboard 那张面板重做**（用户本轮原话）═══════
          原话：「另外我跟你说过很多遍了。你这个**生成设置现在里面的东西完全是错的**，你要
          **照抄图八的这些面板样式** https://laoyu.quantv.com/dashboard 去做呀。」
          实测那张面板（CDP 逐元素读计算样式，落档 .tmp/qy-settings-report.txt）：
            · 面板：宽 521 / 内边距 24.8 / 圆角 19.84 / 白底 / 描边 rgba(0,0,0,.06) / 最高 min(60vh,520)
            · 分辨率：**两颗等宽药丸** 230×45（圆角 14.88 / 选中=#f0f0f0 底 + 0.8px 深描边）
            · 画面比例：**3 列 × 2 行卡片** 150×61（卡里上面是画幅图形、下面是档位文案）
            · 视频时长：**滑块 + 数字框 + 单位 s**（不在滑块下面铺一排刻度文案）
          我们原来这一栏是「清晰度（两张大卡，每张带一句说明）+ 避免出现的内容（文本域）+ 随机种子」——
          三样都和那一页对不上，正是用户说的"里面完全是错的"。现在三组照抄。
          ⚠️ 比例与时长**只在首页这一档出现**：首页按用户定的形态只有「模型 / 生成设置」两颗按钮，
            所以这一栏承担知渔「视频设置」的完整内容；子页面的工具栏里「镜头规格」已经管画幅与时长，
            两边都放同一件事就是重复（那才是"没抄明白"）。判据可复查：homeComposer。 */}
      {specExposure.clarity && (
      <div className="video-panel-section"><strong>清晰度</strong>
        <div className="video-resolution-pills">
          {(selectedProduct?.resolutions || ['720p']).map(value => <button key={value} type="button" className={resolution === value ? 'is-selected' : ''} onClick={() => { setPlanReviewed(false); setResolution(value); }}>{value.toUpperCase()}</button>)}
        </div>
      </div>
      )}
      {/* ═══ 批 Y：「镜头规格」那颗按钮已下线 ⇒ 画幅与时长**并进这一面板**（照知渔的「视频设置」）═══
          知渔的「视频设置」就是 分辨率 / 画面比例 / 视频时长 三组，我们原来把后两组拆在另一颗按钮里。 */}
      <>
        <div className="video-panel-section"><strong>画面比例</strong>
          <div className="video-ratio-cards">
            {RATIOS.map(value => <button key={value} type="button" className={ratio === value ? 'is-selected' : ''} onClick={() => { setPlanReviewed(false); setRatio(value); }}><i style={{ aspectRatio: value.replace(':', ' / ') }} aria-hidden="true" /><span>{value}</span></button>)}
          </div>
        </div>
        {specExposure.duration && (
        <div className="video-panel-section"><strong>视频时长</strong>
          <div className="video-duration-inline">
            <input className="video-duration-range" type="range" min={durationRange.min} max={durationRange.max} step={durationRange.step} value={duration} onChange={event => { setPlanReviewed(false); setDuration(snapVideoDuration(selectedProduct, Number(event.target.value))); }} />
            <input className="video-duration-number" type="number" min={durationRange.min} max={durationRange.max} value={duration} onChange={event => { setPlanReviewed(false); setDuration(snapVideoDuration(selectedProduct, Number(event.target.value))); }} />
            <span>s</span>
          </div>
        </div>
        )}
      </>}
      {/* ═══ 批 W（2026-09-21）：**「避免出现的内容」整块删除**（用户原话，逐字）══════════════════
          原话（图二）：「这个**避免出现的内容去掉**，这块**没有意义**。」
          ⚠️ 状态与请求体字段都**保留**（negativePrompt 仍会随请求下发，默认空字符串），
             只是页面上不再给这一格 —— 删的是一块用户判断为无意义的输入，不是抽掉一个链路。
          ⚠️ 知渔那两页也没有这一格（他们的负面约束写在各自模板的提示词里）。 */}
      {/* 9-12 用户批注：技能相关从生成设置里去掉 —— 已选技能显示在工具栏「技能库」上（见 toolbarSummary.skills） */}
      <label className="video-panel-field compact"><span>随机种子</span><input type="number" value={seed} onChange={event => { setPlanReviewed(false); setSeed(Number(event.target.value) || 0); }} /><small>填 0 表示随机生成</small></label>
    </>;
    return null;
  };

  const renderFloatingPanel = () => {
    if (!activePanel) return null;
    const meta = TOOLBAR_ITEMS.find(item => item.key === activePanel);
    const Icon = meta?.icon || Settings2;
    /* ⚠️ 2026-09-23 批 Z-③：**全屏时这个浮层的挂载点必须是全屏元素自己**。
       挂到 document.body 的浮层在全屏下根本不渲染（浏览器在 top layer 里只画全屏元素
       这棵子树）——也就是说全屏之后"视频模型 / 生成设置"两颗参数卡点了没反应。
       照知渔（用户图八）的口径，这两颗参数卡本来就该在卡内可用，所以容器跟着全屏走。
       非全屏仍是 document.body（行为与改动前一致）。 */
    return createPortal(<section
      id="video-floating-panel"
      className="video-config-panel"
      data-panel={activePanel}
      role="dialog"
      aria-label={meta?.label || '视频配置面板'}
      style={{
        left: panelPosition.left,
        bottom: panelPosition.bottom,
        width: panelPosition.width,
        maxHeight: panelPosition.maxHeight,
        '--video-panel-anchor-x': `${panelPosition.anchor}px`,
      }}
    >
      {/* ⚠️ 2026-09-19 批 H-5（用户批注 #10）：
          「配置这边不就这三个维度吗？你要搞那么复杂干什么呢？
            还有那些多余的上面的标题什么的那些都不要呀，就只要这个分辨率画面比例视频时长就可以了呀。」
          —— 面板顶部的**图标 + 标题 + 描述**整块删除（图片侧在批 H-1 已经删过同一块，
             这里当时漏了，于是两边的配置面板长得不一样）。
          面板是被工具栏那颗按钮点开的，用户知道自己在配什么；再来一行大字只是噪声。
          aria-label 仍然带标题（见下面的 aria-label 属性），读屏不受影响。 */}
      <div className="video-config-panel-body">{renderPanelBody()}</div>
    </section>, fullscreen && composerRef.current ? composerRef.current : document.body);
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

  /* ⚠️ data-video-mode 是**当前创作方式**的稳定观测点（批 N）：
     子页面按 skill 声明渲染工作台之后不再显示「智能成片 / 首尾帧 / 爆款重构」那排页签
     （知渔 20 个 skill 页都没有 —— 创作方式是 skill 自带的属性），
     但"这一页落在哪一档"这件事仍然必须可观测、可断言，所以把它如实挂在这里。 */
  /* ⚠️ data-video-recipe 是**这条 skill 的配方提示词**（进子页面时被预填进创作台的那一份）。
     为什么要有这个观测点：知渔「建筑室内」那 9 页（我们对应的是单参考图 + 比例那一档）
     **页面上没有补充说明框** —— 他们的"怎么拍"是模板自带的，我们的对应物就是声明源里的 brief。
     照抄之后这一档不再有输入框，但"配方真的被带进这次生成"这件事仍然必须可断言，
     所以把它如实挂在页面上（值与预填进 prompt 的是同一份，不是另写一份）。 */
  return <main className={`video-studio-page${embedded ? ' is-embedded' : ''}`} data-video-mode={mode} data-video-recipe={preset?.prompt || ''}>
    <MediaLightbox entry={lightboxEntry} onClose={() => setLightboxEntry(null)} />
    {!embedded && <header className="video-studio-heading"><div><span className="video-studio-kicker"><Clapperboard size={16} />视频生成</span><h1>从创意素材到营销成片</h1><p>脚本、参考素材、镜头、声音和交付规格在同一个任务里完成。</p></div><button className="video-balance" type="button" onClick={() => dispatch({ type: 'SHOW_PRICE', show: true })}>AI 积分 <strong>{state.unlimited ? '无限额度' : state.ecPoints}</strong></button></header>}

    <section ref={composerRef} className={"video-composer" + (homeComposer ? " is-home" : "") + (workbenchMode ? " is-workbench" : "") + (fullscreen ? " is-fullscreen" : "")} aria-label="视频生成工作区">
      {/* ═══ 2026-09-23 批 Z-③：全屏照知渔 = **一张居中的白色圆角大卡**（用户图八）═══════════
          用户原话：他们全屏是一张居中的白色圆角大卡，卡内 = 模式页签 + 素材格 + 提示词 +
          底部两条参数卡。所以这里给全部内容套一层卡容器：
            · 非全屏：`.video-composer-card { display: contents }` —— 对布局完全透明，
              子元素仍当直接子元素参与 .video-composer 的排版（改动前后逐像素一致）；
            · 全屏：它才变成那张卡（宽度上限 + 居中 + 白底 + 圆角 + 大投影），见 VideoStudio.css。
          ⚠️ 卡只能做在内层：全屏元素自己被 UA 样式锁成 100%×100% + margin:0，改不动它的盒子。 */}
      <div className="video-composer-card">
      {/* ═══ 2026-09-19 批 Q-⑥：**子页面不再渲染这块营销大标题** ═══════════════════════════════
          用户批注（本轮）：「你不能把整体的东西往上面顶上去吗？为什么一定要放到下面去呢？」
          知渔的视频子页面左栏从「返回」→「信息卡 411x128」→「参数配置」直接开始，
          **没有**「视频生成」角标 + 「把创意素材变成吸引人的短片」这种大标题（那是首页的写法）。
          首页与独立路由（!embedded）行为不变 —— 它们本来就该有这块。 */}
      {/* ═══ 批 T（2026-09-21）：独立路由**不再重复画一遍标题**（用户「按知渔收口」）══════════════
          实测（.tmp 里的 /video-studio 探针）：这一页同时渲染了 `.video-studio-heading`
          （页面级大标题「从创意素材到营销成片」）与这里的 `.video-composer-heading`
          （「视频生成 / 把创意素材变成吸引人的短片 / 选择创作方式…」）—— 同一页两套标题，
          把第一个字段推到 **y≈504**（知渔 /ai-video 是 179）。
          首页那一档只有这一个标题（宿主卡里没有别的标题），所以**只在独立路由去掉重复的那一份**。 */}
      {/* ═══ 批 W（2026-09-21）：**「视频生成」标题区整块删除**（用户原话，逐字）══════════════════
          原话：「你的视频生成和图片生成上面的标题文案：『视频生成 / 把创意素材变成吸引人的短片 /
          选择创作方式，上传参考素材，再描述你要的镜头和节奏。』……（图片生成那三行同理）
          **这些都不要了，去掉之后，把下面的内容和功能适配上去**，
          不能因为去掉一块部分你就没把其他的内容适配了哦。」
          ⇒ 标题、副标题整块下线；创作方式页签与素材区随之**上移接上**（见 VideoStudio.css 里
             .video-composer-surface 的 margin-top 那一处适配）。
             ⚠️ 知渔的视频子页面也没有这块营销标题（批 Q-⑥ 已按它收过一次口），现在首页这一档也去掉。 */}
      {/* ═══ 批 N：skill 子页面**不显示创作方式切换** ═══════════════════════════════════════
          依据（用户第 18 轮原话）：「他们这些 skill 页面……**每个工作台都是不一样的呀**，
            你现在完全没抄，**用的依然是我们之前首页的视频生成版本糊弄我**」。
          知渔 20 个视频 skill 页实测（docs/design/64 §8）：**没有任何一页有创作方式切换** ——
            创作方式是**这条 skill 自带的属性**（探店视频就是探店视频），不是让用户在页面上再选一次。
          我们原来所有子页面都顶着「智能成片 / 首尾帧 / 爆款重构」三档，正是"每页长得都一样"的来源。
          做法：workbenchMode 下整块不渲染；mode 仍由 skillVideoMode(skill) 通过 initialMode 定死。
          ⚠️ 与批 I 那条「子页面一个功能都不许少」的关系：那条针对的是**精细化调参控件**
            （技能库 / 镜头规格 / 生成设置 / 运镜 / 生成记录）—— 它们全部保留；
            这里去掉的是"换一种玩法"，那是**换一个 skill**，入口在 hub 与左侧导航，不是在这一页里。 */}
      {!workbenchMode && <div className="video-mode-tabs" role="tablist" aria-label="视频创作模式">
        {/* 首页只留两档（用户批注 3：「下面你就得像他们这样了，就是可能就是一个全能参考，
            还有一个首尾针的切换按钮而已」）。爆款重构是独立 skill，从左侧导航/总页面进。 */}
        {(homeComposer ? VIDEO_CREATION_MODES.filter(item => item.id === 'smart' || item.id === 'frame') : VIDEO_CREATION_MODES).map(item => {
          const ModeIcon = VIDEO_MODE_ICONS[item.id] || Clapperboard;
          return <button key={item.id} type="button" role="tab" aria-selected={mode === item.id} className={mode === item.id ? 'is-selected' : ''} onClick={() => { setPlanReviewed(false); setMode(item.id); }}>
            <span className="video-mode-icon" aria-hidden="true"><ModeIcon size={18} /></span><span className="video-mode-copy"><strong>{item.label}</strong><small>{item.hint}</small></span><i aria-hidden="true" />
          </button>;
        })}
      </div>}
      <ComposerSurface on={!workbenchMode}>
      <section className={'video-content-composer' + (workbenchMode ? ' is-workbench' : '')}>
        {/* ═══ 批 N：子页面按**这条 skill 自己的**工作台渲染（声明源 src/skills/videoWorkbenches.js）═══
            用户第 18 轮原话：「他们这些 skill 页面……**每个工作台都是不一样的呀**，你现在完全没抄，
              用的依然是我们之前首页的视频生成版本糊弄我……**对应的一比一去抄啊**」。
            规格逐条来自知渔 20 个视频 skill 页面的 CDP 抄录（docs/design/64 §8），
            页面里**不写死任何一块**。
            ⚠️ 首页输入框与独立路由**不传 workbench** ⇒ 走下面那条分支，行为与从前一个像素都不变。 */}
        {workbenchMode && <VideoWorkbench
          workbench={workbench}
          groupTitle={groupTitle}
          slots={slotFiles}
          onSlotFiles={updateSlotFiles}
          blockValues={blockTexts}
          onBlockValueChange={(key, value) => { setPlanReviewed(false); setBlockTexts(current => ({ ...current, [key]: String(value || '').slice(0, VIDEO_PROMPT_MAX_LENGTH) })); }}
          prompt={prompt}
          onPromptChange={value => { setPlanReviewed(false); setPrompt(String(value || '').slice(0, VIDEO_PROMPT_MAX_LENGTH)); }}
          values={{ ratio, duration, swapMode: swapTarget }}
          onValueChange={(bind, value) => {
            setPlanReviewed(false);
            if (bind === 'ratio') setRatio(String(value));
            else if (bind === 'duration') setDuration(Number(value) || 5);
            else if (bind === 'swapMode') setSwapTarget(String(value));
          }}
          mentions={mentionedAssets}
          promptFieldRef={promptFieldRef}
          promptMaxLength={VIDEO_PROMPT_MAX_LENGTH}
          onFilesPasted={files => appendQuickFiles(files)}
          disabled={submitting}
          uploadFor={uploadFor}
          retryUpload={retryUpload}
          onRunAction={key => { if (key === 'script') runDawei(); else if (key === 'analyze') openVideoPlan(); }}
        />}
        {!workbenchMode && <section className="video-materials" aria-label="上传素材">
          <header>
            {/* ═══ 2026-09-19 批 I-⑦（用户批注 #1-3 与 #1-7，坐标同一列 27%）══════════════════
                两条批注说的是同一行字：
                  #1-3：「这里要么叫智能成品，要么叫全能参考，**不要冲突啊**。」
                  #1-7：「这里也不该有文字啊，**上面选中切换区就好了呀**。」
                原来的那一行是「全能参考 + 一句说明」。它有两个毛病：
                  ① 名字跟上面那排模式页签（智能成片）撞车 —— 一块区域顶着另一个模式的名字；
                  ② 它本来就**不该存在** —— "我在哪一档""这一档收什么素材"上面那排页签
                     和每张卡自己的文案已经说完了，再来一行大字只是噪声。
                所以不是"换个名字"，是**整行删掉**（换名字只能解决 ①，#1-7 要的是 ②）。
                ⚠️ 右侧那组按钮（N 个 / 清空素材 / 全屏）留着 —— 它们是**动作**，不是说明文字。 */}
            <div className="video-materials-actions">
              {assetCount > 0 && <b>{assetCount} 个</b>}
              {/* 用户批注 3：清空素材 + 全屏。清空只在真有素材时出现（空集合上摆一个按钮是噪音）。 */}
              {deckMode && assetCount > 0 && <button type="button" className="video-materials-clear" onClick={clearMaterials}><Trash2 size={13} />清空素材</button>}
              {deckMode && <button type="button" className="video-materials-fullscreen" aria-pressed={fullscreen} title={fullscreen ? '退出全屏' : '全屏创作台'} onClick={toggleFullscreen}><Maximize2 size={13} />{fullscreen ? '退出全屏' : '全屏'}</button>}
            </div>
          </header>
          {renderAssetPickers()}
        </section>}
        <div className="video-composer-input">
          {!workbenchMode && <>
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
            {/* ═══ 批 K-D：视频侧的「代为撰写」入口 ═══════════════════════════════════════════
                位置照知渔实测：**输入框旁**（他们放在输入框下方那一行的右端，原文「代为撰写」）。
                ⚠️ 它是一条**纯文字按钮**，不是胶囊：无底色、无边框、无圆角，靠 font-bold + 80% 透明度
                  + sparkles 图标区分于正文（docs/design/61 §3 原话：「重点在克制：不要给它加胶囊底色」）。
                点开的是与图片侧「生成预览」**同一份**三步方案预览，只是文案与入口不同。
                ═══ 批 U（2026-09-21）：**首页那一档不再渲染它**（用户本轮原话，逐字）══════════════
                原话：「还有你下面的那个输入区和 @ 都应该往左边和下面适配啊，然后那个**代为撰写
                首页这边是不需要的，我们的竞争对手他们也没有这个呀**。」
                实测确是如此：知渔 /ai-video（我们要照的那一页）输入框那一行只有 @，没有「代为撰写」
                —— 那一颗出现在**其它**路由页（爆款复刻 / 探店视频那几条）里。
                独立创作台（/video-studio，不是首页）保留：那一页是"首页输入框"的等价物，
                且它的方案入口只有这一个；首页的等价入口是右下角那颗主 CTA（分析并生成方案）。 */}
            {!homeComposer && <button type="button" className="video-dawei-entry" onClick={runDawei}>
              <Sparkles size={14} />
              代为撰写
            </button>}
          </div>
          </>}
          {/* ═══ 批 W（2026-09-21）：融合控件（运镜 / 只改一个元素）**整行删除**（用户原话，逐字）════
             原话：「第 4 条**运镜这个没必要啊，这个没有什么意思，去掉**。」
             （上文第 4 条 = 我在 RTK 里报的「运镜 / 只改一个元素这两行知渔没有」那条冲突。）
             ⚠️ 这两条本来就是**我们自己的**融合控件（用户 9-17 那句「融合在一些主 skill 里面」的产物），
                知渔 31 个子页面里**一个都没有** —— 用户本轮判定它们没有价值，于是按"照抄"的原则去掉。
             ⚠️ 运行层的机制**保留**（`workbenchExtraInstructions` 仍然只追加"这一页真的渲染过的控件"
                的值；控件没了 ⇒ cameraMove/sceneEdit 恒为空 ⇒ 不会往提示词里追加任何东西，
                这是批 S 那条门禁守的行为，一个字没动）。 */}
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
      </section>
      </ComposerSurface>

        <footer className="video-toolbar" ref={toolbarRef}>
          <div className="video-toolbar-controls">
            <div className="video-quick-tools" ref={quickToolsRef}>
              {/* 2026-09-16：这里原来还有一个重复的 @（底栏版）。两套 @ 两套菜单正是
                 用户说的「为什么跟其他板块的艾特键不一样」—— 现在只剩输入框下方那一个共用组件。 */}
               {specExposure.model && <span className="video-inline-control">
                {/* 9-11 用户批注: 模型控件比其它按钮矮一截 → 统一成「小标题 + 参数」两行结构与同高 */}
                <button ref={modelButtonRef} type="button" className={'video-config-trigger is-model' + (inlineMenu === 'model' ? ' is-open' : '')} aria-expanded={inlineMenu === 'model'} onClick={toggleModelMenu}>
                  <VideoModelMark product={selectedProduct} provider={selectedProduct?.providerLabel} />
                  <span><small>视频模型</small><strong>{selectedProduct?.label || '选择视频模型'}</strong></span>
                  <ChevronDown size={14} />
                </button>
                {inlineMenu === 'model' && <div className="video-inline-menu is-model" style={{ left: modelAnchor?.left, bottom: modelAnchor?.bottom, width: modelAnchor?.width }}><strong>视频模型</strong>{products.map(product => <button key={product.id} type="button" className={selectedProduct?.id === product.id ? 'is-selected' : ''} onClick={() => { setPlanReviewed(false); setSelectedProductId(product.id); setInlineMenu(null); }}><VideoModelMark product={product} provider={product.providerLabel} /><span><b>{product.label}<em>{product.tierLabel}</em></b><small>{product.description}</small>
                {/* ═══ 2026-09-16 用户批注（图2-②）：「你为什么这里会有两套描述呢？
                   你只要保留一套就好了呀。然后你的积分其实是不能在这里说的。」
                   —— 模型列表原本一行里塞了 4 段文字（型号+档位 / 描述 / 限制 / 积分），
                      现在只留**一段描述**；积分只出现在右下角按钮上，并随选择实时变化。
                   ═══ 2026-09-19 批 H 修（用户批注 #11-②「你这下面完全是乱码的」）═══════
                   根因有两条，都在这一个注释容器里：
                     ① 注释正文里**又写了注释符号本身**（成对的斜杠星号）——
                        注释在那一对符号处就**提前结束**了，后面的正文变成 JSX 文本被渲染出来；
                     ② 容器收尾处多了一个右花括号，同样被当成文本节点渲染。
                   现在：正文里不再出现任何注释符号，容器只有一个花括号收尾。
                   ⚠️ 往后的规矩：JSX 子节点位置的注释用花括号包起来（表达式容器），
                      并且**正文里绝不能再写注释符号**。 */}
                </span>{selectedProduct?.id === product.id && <Check size={16} />}</button>)}
                {/* ═══ 批 T（2026-09-21）：未上架模型那一行说明**整块删除**（用户本轮原话）═════
                    原话：「你这些视频生成模型下面的这句：另外 4 个模型暂不可选：Grok 极速（上游已下架
                    该模型）、可灵 3.0（上游已下架该模型）、可灵 3.0 Pro（上游已下架该模型）、
                    Veo 3.1 Fast（上游已下架该模型）**没有必要展示啊，要把它删掉**。」
                    它与批 H-7 的取舍不同：那时用户问的是「模型为什么都不见了」，
                    所以补一行实话解释；现在这些模型已经**从目录里下架干净**，
                    再在模型面板底下挂一串"暂不可选 + 上游已下架"是对用户毫无用处的内部账。
                    能力没丢：服务端那份**未上架清单**仍然保留（老任务 / 老订单仍能解析），
                    只是前端不再渲染它 —— 门禁 test/video-studio-contract 也按这一条改了判据
                    （依据就是上面那句用户原话）。 */}
               </div>}
               </span>}
            </div>
            <div className="video-toolbar-buttons">
            {/* ═══ 批 Y（2026-09-21）：工具栏**只留「模型 + 生成设置」两颗**（用户原话，逐字）════════
                原话：「你的视频生成的各个子页面问题还是非常的多，比如你现在**很多的配置面板**和什么运镜、
                **怎么使用这条技能，这些都是不要的东西啊，这些东西没有必要存在呀**……
                尽可能一比一的去核对知渔那边的做法，跟他们尽可能一致，**很多多余的部分该拿掉的就拿掉**。」
                实测知渔 /video-recreation 底栏就是**两张卡**（模型 / 视频设置）+ 整条 CTA ⇒
                我们原来四颗（视频模型 / 技能库 / 镜头规格 / 生成设置）里：
                  · **镜头规格**（画幅 + 时长）与「生成设置」重复 —— 它的内容已经并进生成设置（见 renderPanelBody）；
                  · **技能库**在子页面上是冗余的（这一页的"技能"就是它自己；再挂一个别的技能正文进脚本 =
                    两个技能混在一份提示词里）—— 首页那一档本来就不显示它，现在子页面也不显示。
                ⇒ 两处都过滤掉，所有形态统一成「模型 + 生成设置」两颗卡 + CTA（与知渔同形）。 */}
            {TOOLBAR_ITEMS.filter(item => item.key !== 'skills' && item.key !== 'shot').map(item => {
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
      </div>
    </section>

    {renderFloatingPanel()}
    {planOpen && <VideoPlanModal plan={effectivePlan} onClose={() => setPlanOpen(false)} onConfirm={() => { setPlanReviewed(true); setPlanOpen(false); }} />}

    {/* 结果台：独立路由与「嵌入 + inlineResult」（首页输入框 / 技能子页面）都要渲染 ——
        用户口径是"生成完就在工作台里看结果"，不是"生成完必须跳进画布"。
            ⚠️ 嵌入形态（首页输入框 / 技能子页面）下**成片台只在有任务时才铺**：
           那块「成片会显示在这里」的空白台子有 700px 高，摆在创作台下面就是一大片空场
           （实测截图确认过）。任务一提交（job 出现）它立刻出现，观感没有损失；
           独立路由保留原先的常驻空台（那是它既有的版式，不改）。
        ⚠️ 但「生成记录」**任何时候都要渲染**：它是这个账号全部视频任务的唯一入口
           （子页面的历史是按技能筛过的一份视图，筛不到不等于任务没了）。
           曾经把整段一起收起来过 —— 结果"标记缺失时任务就看不见了"，E2E 当场抓住。 */}
    {/* ═══ 2026-09-19 批 H（用户批注 #5-④）：「你这一块就不要吧，就是这个生成的作品啊，
        包括后面这个白色的底，你就都拿掉吧，你先拿掉吧，我感觉真的太难看了。」
        —— 首页创作台的**空成片台 + 白底卡 + 「我生成的作品」按钮**整块删除。
        为什么可以删而没有信息损失：
          · 空成片台在没任务时本来就只是一句「成片会显示在这里」；
          · 「我生成的作品」本来就是把人送到画布的作品页 —— 左侧导航**已经有「我的作品」**这一项，
            同一件事不需要在同一屏出现两次（这也是用户批注 #11-③「不如就放到左边的导航栏里」的落点）。
        子页面（!homeComposer）照旧铺完整生成记录 —— 那是这个账号全部视频任务的唯一入口。 */}
    {(!embedded || inlineResult) && !homeComposer && <section className="video-result-workbench"><div className="video-stage">
        {(!embedded || job) && <>
          <div className="video-frame" style={{ aspectRatio: ratio.replace(':', ' / ') }}>
            {job?.status === 'completed' && job.resultUrl
              ? <video src={job.resultUrl} controls playsInline />
              : <div className="video-empty"><Upload size={30} /><strong>{job ? jobStatus(job) : '成片会显示在这里'}</strong><span>{job?.error || '只在确认交付后扣费，失败自动退回冻结积分'}</span>{job && !FINAL.has(job.status) && <progress max="100" value={job.progress || 2} />}</div>}
          </div>
          {job?.status === 'completed' && job.resultUrl && <button className="video-open-canvas" type="button" onClick={() => openJobInCanvas(job)}>在画布中继续</button>}
        </>}
        <div className="video-history">
          {/* 首页只留一个入口（用户批注 2：「你像生成记录这个就没有必要放在这里呀，
              这个最多就是放一个按钮而已，让用户跳到我的作品里面去」）。
              子页面照旧铺完整的生成记录 —— 它是这个账号全部视频任务的唯一入口。 */}
          {homeComposer ? (
            <button
              type="button"
              className="video-history-more"
              onClick={() => { if (!state.logged) { dispatch({ type: 'SET_LOGIN_INTENT', intent: { destination: 'ec-canvas', source: state.page } }); dispatch({ type: 'SHOW_LOGIN', show: true }); return; } dispatch({ type: 'OPEN_CANVAS', tab: 'works' }); }}
            >我生成的作品 →</button>
          ) : (
          <>
          <div className="video-history-title"><strong>生成记录</strong><span>任务、素材与结果自动保存</span></div>
          {history.length ? history.slice(0, 8).map(item => <button key={item.id} type="button" className={job?.id === item.id ? 'active' : ''} onClick={() => { setJob(item); if (!FINAL.has(item.status)) void poll(item.id); }}>
            <span>{item.prompt || '视频任务'}</span><small>{jobRecordStatus(item)}</small>
          </button>) : <p className="video-history-empty">暂无视频任务</p>}
          </>
          )}
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
    {/* 批 K-D：视频侧「代为撰写」——与图片侧「生成预览」是**同一个组件、同一条服务端流水线**。 */}
    {daweiPreview && (
      <PlanPreviewDialog
        open
        surface="video"
        skillName={skillTag || '视频创作'}
        prompt={daweiPreview.prompt}
        materials={daweiPreview.materials}
        onClose={() => setDaweiPreview(null)}
        onApply={applyDaweiPreview}
        onSkip={() => setDaweiPreview(null)}
      />
    )}
  </main>;
}
