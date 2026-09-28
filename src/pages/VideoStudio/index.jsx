import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { VIDEO_WORKBENCHES } from '../../skills/videoWorkbenches.js';
import { specExposureOf } from '../../skills/videoSpecExposure.js';
/* ═══ 2026-09-25 批 AM：本地方案（视频高清 / 视频字幕去除）的技能声明 ═══════════════════════════
   docs/design/69 的 `plan`：engine='local-render' / hideModel / productId 都从这一份取，
   页面里不写第二份判断（"哪一页不给模型格"只有一个出处）。 */
import { LOCAL_RENDER_ENGINE, UPSTREAM_PROCESS_ENGINE, videoSkillPlanOf } from '../../skills/videoSkills.js';
/* 批 AO：每条视频子页面的**方案默认规格**（比例/时长/清晰度）—— 判据是工作台声明的第一档 */
import { videoPlanSettingsOf } from '../../skills/videoPlanSettings.js';
import {
  Aperture,
  Check,
  ChevronDown,
  Clapperboard,
  Crop,
  FileAudio,
  ImagePlus,
  Loader2,
  Lock,
  Mic2,
  Play,
  RefreshCw,
  Settings2,
  Maximize2,
  MonitorPlay,
  Sparkles,
  Timer,
  Trash2,
  Upload,
  Video,
  Volume2,
  X,
} from 'lucide-react';
import MentionPromptField from '../../components/creation/MentionPromptField.jsx';
/* ═══ 2026-09-24 批 BB：面板里的「分组标题」改用**图片侧同一个实现**（用户批注，逐字）═════════════
   原话：「你整体的样式和标题都要跟图片生成那边的**生成配置样式是一样的**。这个问题为什么那么难
   解决呢？我都跟你提过无数次这个需求了。就是你现在视频生成和图片生成他们下面的模型选择和生成设置
   他们的东西都是类似的。所以你整体的 UI 还有你的按钮的这些规则，还有面板的这些样式，**标题、图标、
   规则这些东西都得是类似的**。你必须要统一他们的样式，交互 UI。」
   ⇒ 视频侧原来自己写 `<strong>清晰度</strong>`（裸标题、无图标、13px），图片侧是
     `PanelPrimitives.GroupTitle`（**带品牌色图标** + 13/700/近黑）。现在两边共用同一个组件，
     这也是 `test/workbench-panel-ux-0915` 第 ⑮ 条要的方向（分组标题唯一实现、必须带图标）。 */
import { GroupTitle } from '../Home/ec/PanelPrimitives.jsx';
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
/* 2026-09-28 批 CY：@ 菜单里给有图的素材显示缩略图（共用件默认行也是这个组件） */
import ResponsiveImage from '../../components/ResponsiveImage.jsx';
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
  localJobPoints,
  localQuoteFor,
  quoteForVideoProduct,
  resolveVideoApiMode,
  snapVideoDuration,
  videoDurationRange,
} from './videoStudioModel.js';
import { buildVideoPlan, VIDEO_PROMPT_MAX_LENGTH } from './videoPlanModel.js';
/* ═══ 2026-09-25 批 BM：模型下拉的「家族分组 + 型号合并 + 清晰度档位」三件事的唯一实现 ═══════════
   用户原话：「**为什么 seedance 不放到一起呢？mini max 你也没有放到一起**。……**为什么会有 720P 的
   特定模型呢？720P 应该在生成设置里面去选的呀**，用户在这里就只负责选相应的模型就可以了，
   然后参数是在生成设置里面去做的呀。」
   ⇒ 目录给的是平铺的产品（一条产品一条价档，钱路不许动），折成「家族 → 型号 → 清晰度档位」
      这一层放在 videoModelRows.js 里（纯函数，门禁可直接断言），页面只消费它的结果。 */
import { buildVideoModelRows, detectPromptResolution, productForResolution, rowOfVariant, videoModelChip } from './videoModelRows.js';
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
import { usePlanLeaveGuard } from '../../components/plan-preview/usePlanLeaveGuard.js';
/* 批 CE：「把素材带回去」的两个纯函数收在这个模块里（`.jsx` node 直接 import 会报扩展名错，
   而这两件事必须有门禁真跑 —— 见 test/save-to-assets-and-video-materials-0927）。 */
import { normalizePresetMaterials, restoredAssetCount } from './videoMaterialsModel.js';
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

/* ═══ 菜单行自绘（2026-09-28 批 CY 修）═══════════════════════════════════════════════════════════
   用户原话（逐字）：「你看首页视频生成这边的 @ 按钮的张开面板这个逻辑其实做的已经挺好了，
   但是也存在一个问题。就是你**为什么没有映射到当前这个素材它的图片呢**？」
   改前：这里一律用类型图标（ImagePlus / Video / FileAudio）—— 图片素材明明有画面却不显示，
   与首页图片生成那一套（缩略图 + 名称 + 用途）**长得不一样**，用户一眼就看出来了。
   缩略图从哪来（实测过三种来源，别只认一种）：
     · `item.thumb` —— 目前没人填，留着给以后（比如服务端缩略图）；
     · `item.file.previewUrl` —— 本地 object URL（槽位那些文件会带）；
     · **上传记录里的 `asset.url`** —— 作曲台里真正在用的那一条（素材卡第 1946 行就是取它）。
   最后一条必须由调用方给 resolver（`uploadsRef` 在组件作用域里），所以这里收第二个参数；
   这样也不用把 `uploadFor` 写进任何 deps —— 它定义在 `mentionedAssets` **之后**，
   在渲染期引用会 TDZ（本仓踩过多次）。 */
/* 导出给门禁做**单元级**判据：探针环境里 tus 上传跑不完、拿不到素材 URL，
   所以"菜单行会不会出缩略图"这件事只能在渲染层直接验（test/canvas-… 见 cy 门禁）。 */
export function renderVideoMentionItem(item, resolveUpload = null) {
  const thumb = item?.thumb || item?.file?.previewUrl || item?.url || (resolveUpload ? resolveUpload(item?.file) : '') || '';
  const hasThumb = Boolean(thumb) && item?.kind !== 'audio';
  if (hasThumb) {
    return <React.Fragment>
      <span className="image-mention-kind is-thumb" aria-hidden="true">
        <ResponsiveImage src={thumb} alt="" variant="thumb" ratio={item.ratio || '1:1'} style={{ width: '100%', height: '100%' }} imgStyle={{ objectFit: 'contain' }} />
      </span>
      <span><b>{item.name}</b><small>{item.kindLabel}</small></span>
    </React.Fragment>;
  }
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
/* ═══ 2026-09-25 批 BG：底座尺寸与**内层品牌标**必须同尺寸（用户图2 原话，逐字）══════════════════
   「你的视频模型和你的图片模型必须是一致的 UI……这些图标**有大有小，完全就不是一回事**。」
   实测两处根因：
     ① 底座被 `.video-inline-menu.is-model > button > span { flex: 1 1 auto }` 这条过宽的选择器
        一起拉满了剩余宽度 → 底座宽度 27/49/73/106 各不相同（而图片侧固定 32）；
     ② 内层 ModelLogo 写死 18 —— 图片侧是"底座 32 / 标 32"（标占满底座），我们这里是 32 的底座里
        放 18 的标，同一个模型在两侧看起来差一半。
   ⇒ 尺寸由调用方给（触发 28 / 行 32，与图片侧 ICON_SIZE.modelTrigger/modelOption 同值），
     内层品牌标 = 底座尺寸（半径按 0.28 缩，与图片侧 modelIcon 同一算法）。 */
function VideoModelMark({ product = null, provider = '', size = 32 }) {
  const logo = videoProductLogo(product) || (String(provider).toLowerCase().includes('minimax') ? brandLogo('minimax') : brandLogo('bytedance'));
  return <span className="video-model-mark" aria-hidden="true">
    <ModelLogo logo={logo} size={size} radius={Math.round(size * 0.28)} />
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
  /* 批 CE：历史「用这组参数」带回来的素材（**已上传资产**，不是本地文件）。
     它们在提交时并进 refs，界面上单独一条显示、可逐张移除。 */
  const [restoredAssets, setRestoredAssets] = useState(() => normalizePresetMaterials(null));
  /* 批 T：工作台里**除主文本格以外**的文本（门店信息这类），按 block.key 存 —— 见 VideoWorkbench 的说明 */
  const [blockTexts, setBlockTexts] = useState({});
  /* ═══ 2026-09-27 批 CG：「生成记录」搬进右栏历史区（用户原话，逐字）══════════════════════════════
     原话：「你看你下面还是有这个生成结果的一个展示区，为什么还会有呢？…你这个生成结果必须在右边的
     历史区里面呀。这个地方一定是要删掉的呀。」
     ⇒ 找右栏那个**常驻挂载点**（WorkbenchShell 的 `[data-history-host]`），找到就 portal 过去，
       找不到（首页 / 独立创作台 / 独立路由：没有那个壳）就照旧内联渲染 —— 一条代码路径，不靠模式开关。
     ⚠️ 挂载后才有 DOM，所以只能在 effect 里取（首帧不能读 document）。 */
  const [historyHost, setHistoryHost] = useState(null);
  useEffect(() => {
    setHistoryHost(document.querySelector('[data-history-host]'));
  }, []);
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
  /* ═══ 2026-09-25 批 AM：本地方案的两格规格 + 框选区域 + 源视频时长 ═══════════════════════════
     为什么时长要单独存：去字幕**按秒计费**（0.04 积分/秒），而且服务端要求它是**真值**
     （建单校验 LOCAL_PLAN_DURATION_INVALID）。它从用户上传的那条视频里读
     （HTMLVideoElement.duration，见下方的探针），不是让用户手填。 */
  const [outputFps, setOutputFps] = useState(null);
  const [markMode, setMarkMode] = useState('manual');
  const [regions, setRegions] = useState([]);
  const [sourceSeconds, setSourceSeconds] = useState(0);
  const [sourcePreview, setSourcePreview] = useState('');
  /* 批 AZ（数字人）：驱动音频那一档的秒数与本地可播地址 —— 这一档**按音频秒数**计费，
     秒数只能从音频文件本身读出来（见下面的音频探针），不能拿视频时长顶替。 */
  const [audioSeconds, setAudioSeconds] = useState(0);
  const [audioPreview, setAudioPreview] = useState('');
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
  /* ═══ 批 BX：弹窗**收起来 ≠ 丢掉脚本**（与图片侧同一条口径，用户逐字）══════════════════════
     「生成预览方案和生成脚本这种弹窗形式的，应该是用户可以关掉这个弹窗，但是**再点一次这个按钮
      可以回到这个弹窗里面**啊。」
     ⇒ `daweiOpen` 只管"展不展开"，`daweiUnapplied` 是"手上有一份没应用的脚本"（离开时据此拦一下）。 */
  const [daweiOpen, setDaweiOpen] = useState(false);
  const [daweiUnapplied, setDaweiUnapplied] = useState(false);
  /* 换技能（`skillId` 变）就把这份会话丢掉：它的 prompt/materials 属于上一条玩法，留着会串味。 */
  useEffect(() => {
    setDaweiPreview(null);
    setDaweiOpen(false);
    setDaweiUnapplied(false);
  }, [skillId]);
  usePlanLeaveGuard(daweiUnapplied);
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
  /* 批 BM：两条派生（都来自 products，不另存状态 —— 清单变了它们自动跟着变）。
       · modelRows  = 「家族 → 型号行 → 档位产品」，模型下拉的渲染结构；
       · activeRow  = 当前选中型号那一行，清晰度药丸与型号名从它取。
     判据用 variant 而不是 product id：同一型号的多条产品（720P / 2K 那种）在用户眼里**是一个模型**，
     选了 2K 之后那一行仍然是"当前选中的模型"（否则勾会跑掉）。 */
  const modelRows = useMemo(() => buildVideoModelRows(products), [products]);
  const activeRow = useMemo(() => rowOfVariant(modelRows, selectedProduct?.variant), [modelRows, selectedProduct?.variant]);
  /* 批 BM：清晰度档位 = **当前型号**的全部清晰度（同一型号下"只有分辨率不同"的那些产品合并成一排）。
     选中哪一档就切到那条产品 —— 价目、时长上限、素材上限随之变化（按钮上的积分实时跟着变）。
     hint 用该档产品自己的限制文案（例如 1080P 档只支持 5-9 秒），鼠标停上去看得到，
     避免"选了 1080P 才发现只能出 9 秒"这种事后才发现的意外。 */
  const clarityOptions = useMemo(() => {
    const values = activeRow?.resolutions?.length ? activeRow.resolutions : (selectedProduct?.resolutions || ['720p']);
    return values.map(value => {
      const product = activeRow ? productForResolution(activeRow, value) : selectedProduct;
      return { value, productId: product?.id || '', hint: product?.limitations || product?.description || '' };
    });
  }, [activeRow, selectedProduct]);

  const selectClarity = useCallback(value => {
    setPlanReviewed(false);
    const next = activeRow ? productForResolution(activeRow, value) : null;
    if (next && next.id !== selectedProduct?.id) setSelectedProductId(next.id);
    setResolution(value);
  }, [activeRow, selectedProduct?.id]);

  /* ═══ 2026-09-26 批 BP-1：**提示词里明确写了分辨率就顺着用户**（用户口径，逐字）═══════════════
     用户原话：「1080P 如果适合的模型太少就算了吧，就直接开 480P 的，**1080P 的就是用户有明确在
     提示词里就可以用给他**。」
     行为：提示词里出现"1080P / 2K / 720P / 480P"这类**明确档位词**，且**当前型号支持**那一档 ⇒
     自动把清晰度切过去（价格随档位实时变化，按钮上看得见）；型号不支持 ⇒ 什么都不做
     （不假装能出、也不拦着用户 —— 上游按它自己的路由输出）。
     ⚠️ 两个防打架的细节：
       · 只在该档词**首次出现**时切一次（promptResolutionRef），用户之后手动改清晰度不会被抢回来；
       · 只认明确档位词，不认"高清/清晰"这类形容词（见 detectPromptResolution）。 */
  const promptResolutionRef = useRef('');
  useEffect(() => {
    const mentioned = detectPromptResolution(prompt);
    if (!mentioned || promptResolutionRef.current === mentioned) return;
    promptResolutionRef.current = mentioned;
    if (!activeRow?.resolutions?.includes(mentioned)) return;   // 型号不支持 ⇒ 不动
    if (resolution === mentioned) return;                       // 已经是这一档 ⇒ 不动
    selectClarity(mentioned);
  }, [prompt, activeRow, resolution, selectClarity]);
  const workbenchMode = Boolean(embedded && workbench && (workbench.blocks || []).length);
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
  /* ═══ 2026-09-25 批 AO：**方案默认规格**（docs/design/69 §3.2 的"规格由方案定"）══════════════
     现状（批 AG 之前）：每条子页面进创作台都用同一套全局初值（9:16 / 5 秒 / 720P）——
     于是「建筑图转视频」和「豪门恩怨短剧」进去长得一模一样，用户还得自己改一遍，
     这正是用户骂的"千页一面"的另一半（那一半是 AG 解决的"露不露"，这一半是"默认是什么"）。
     现在：每页用**它自己那一页**的默认档起步（判据 = 工作台声明的第一档，唯一事实源；
     本地方案显式声明的 defaults 优先）。
     ⚠️ **只应用一次 / 每个技能一次**：用 ref 记住已应用的技能 id —— 否则用户在创作台里改过的
        比例会被这里反复覆盖回默认值（本仓"注释过期差点删掉功能"那类坑的反面：这里必须防的是
        "默认值偷偷覆盖用户输入"）。
     ⚠️ 位置很重要：这个 effect 必须**声明在 preset（历史"用这组参数"还原）之前**，
        这样"还原历史"总是后跑、总是赢（用户明确点了还原，就该覆盖方案默认）。 */
  const planSettingsAppliedRef = useRef('');
  useEffect(() => {
    if (!workbenchMode || !workbenchSkillId) return;
    if (planSettingsAppliedRef.current === workbenchSkillId) return;
    planSettingsAppliedRef.current = workbenchSkillId;
    const settings = videoPlanSettingsOf(workbenchSkillId);
    setRatio(settings.ratio);
    setDuration(settings.duration);
    setResolution(settings.resolution);
    setPlanReviewed(false);
  }, [workbenchMode, workbenchSkillId]);
  const slotKindOf = useCallback(slotKey => {
    const block = (workbench?.blocks || []).find(item => item.key === slotKey && item.kind === 'upload');
    const accept = String(block?.accept || '');
    if (accept.includes('video')) return 'video';
    if (accept.includes('audio')) return 'audio';
    return 'image';
  }, [workbench]);

  const slotEntries = useMemo(() => Object.entries(slotFiles)
    .flatMap(([slotKey, items]) => (Array.isArray(items) ? items : []).map((file, index) => ({ file, slotKey, index }))), [slotFiles]);
  /* 槽位里的**图片**才并进 images：视频/音频槽位（本地方案的源视频）有自己的归属 ——
     把它们塞进参考图会让上游那条路收到一条视频当图片（服务端会 400）。 */
  const slotImageFiles = useMemo(
    () => slotEntries.filter(item => slotKindOf(item.slotKey) === 'image').map(item => item.file),
    [slotEntries, slotKindOf],
  );
  const slotVideoFiles = useMemo(
    () => slotEntries.filter(item => slotKindOf(item.slotKey) === 'video').map(item => item.file),
    [slotEntries, slotKindOf],
  );
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

  /* ⚠️ 这条判据（嵌入形态 + 有工作台声明）**必须声明在下面那批 useMemo 之前**：批 AM 的
     本地方案那一段要用它，而 const 有暂时性死区（依赖数组是渲染期求值）——
     test/no-tdz-before-init 是硬门禁，本仓 2026-09-16 的白屏事故就是这一类。 */

  /* ═══ 2026-09-25 批 AM：**本地方案**（视频高清 / 视频字幕去除，docs/design/69 的 plan）════════
     这两条不走上游模型：本机 ffmpeg 提分辨率 / 擦字幕。声明源是 skill 的 plan 字段，
     页面据此决定四件事（都**只在这里判一次**）：
       · 产品：不是"用户选的模型"，而是方案指定的那一条（plan.productId）；
       · 模型格：**不给**（plan.hideModel）—— 上游那套"选模型"在这里没有意义；
       · 规格格：照知渔那一页给（输出分辨率 / FPS / 字幕标记方式），值进 localSpecs；
       · 生成闸门：**不要**"分析并生成方案"（那是上游生成的方案费；本地方案的方案就是渲染清单）。
     ⚠️ 这一段必须放在**任何引用它的 useMemo/useEffect 之前**：依赖数组在渲染期求值，
        const 有暂时性死区 —— 放到后面就是整页落错误边界（本仓 2026-09-16 白屏事故同一类，
        test/no-tdz-before-init 是硬门禁）。 */
  const localPlan = workbenchMode ? videoSkillPlanOf(workbenchSkillId) : null;
  const localEngine = localPlan?.engine === LOCAL_RENDER_ENGINE;
  /* ═══ 2026-09-26 批 AU：**上游处理的方案页**（数字人）不许落到"上游生成"那条默认分支上 ═══════
     数字人的方案引擎是 upstream-process（真人视频 + 驱动配音 → 火山口型对齐）：
     它不吃提示词、不是"选一个模型出片"，所以这一页必须走**处理已有视频**那条分支
     （报价按秒、没有方案分析费、没有生成设置）。
     ⚠️ 为什么要有这道拦：产品与 SKU 在接线完成之前是 public:false。这一页若走默认分支，
        用户填了文件、点一下，会拿**默认模型**出一条普通视频并照常扣费 —— 那既不是他要的数字人，
        也违反"不可用的功能不许变成可点的选项"（铁律）。
     ⇒ 判据取**服务端的只读状态**（capabilities.digitalHuman.available），不在页面里写死条件。
     ═══ 2026-09-26 批 AZ：接线完成 ⇒ 判据从 `localEngine` 推广成 **process 产品** ═════════════
     本地执行（localEngine：视频高清 / 视频字幕去除）与上游执行（upstreamProcessPlan：数字人）
     **共用同一条分支**：报价按秒（或按条）、没有"分析并生成方案"那一步、没有生成设置。
     原先这一串判断只认 localEngine，数字人一页翻公开就会掉进上游生成分支（见上）——
     现在统一成 processPlan，两种执行方式的差别只剩两处：谁执行（本机要不要 ffmpeg）
     与计费秒数取哪一档（本地取源视频、数字人取**驱动音频**）。 */
  const upstreamProcessPlan = localPlan?.engine === UPSTREAM_PROCESS_ENGINE;
  const processPlan = Boolean(localEngine || upstreamProcessPlan);
  const digitalHuman = capabilities.digitalHuman || null;
  const processPlanBlocked = upstreamProcessPlan && digitalHuman?.available !== true;
  const processPlanBlockedReason = digitalHuman?.reason || '这个功能还在施工中，暂时不能生成。';
  const localProducts = Array.isArray(capabilities.localProducts) ? capabilities.localProducts : [];
  /* ═══ 2026-09-26 批 AR：**自动标记**那一档的服务端状态（只读）══════════════════════════════════
     它走火山 MediaKit（不是本机、不是"模型"），所以既不在 localProducts 里也不在模型清单里 ——
     单独一份状态：产品公开 + 凭据齐 = 可用；不可用时前端保持"不可选 + 写明原因"。 */
  const subtitleAuto = capabilities.subtitleAuto || null;
  const subtitleAutoReady = subtitleAuto?.available === true;
  /* ═══ 2026-09-26 批 AZ：**process 产品的统一取法**（本机那两条 + 上游那条数字人）═══════════════
     "这一页用哪个产品、报价多少、露哪几格、按什么数量计费"必须**只从服务端目录取**：
       · 本机执行的两条在 capabilities.localProducts 里（形状见 localVideoProducts）；
       · 上游执行的数字人在 capabilities.digitalHuman 里（它不是本机方案，所以不进 localProducts）。
     这里把它们归成**同一形状**，页面其余部分（报价 / 闸门 / 按钮价目 / 建单）就只剩一条路径 ——
     两处各写一份判断正是"图片侧一套、视频侧另一套"那类返工的来源。
     ⚠️ 页面**不写死**规格与价：`localSpec`（露哪几格）、`billingQuantity`（按秒还是按条）、
        `modes`（建单模式 process/local）全部来自产品声明。 */
  const processProducts = useMemo(() => {
    const rows = localProducts.map(product => ({ ...product, engine: 'local' }));
    if (digitalHuman?.productId) {
      rows.push({
        id: digitalHuman.productId,
        label: digitalHuman.label || '数字人',
        description: '',
        limitations: '',
        durations: { ...(digitalHuman.durations || {}) },
        resolutions: [],
        modes: Array.isArray(digitalHuman.modes) ? [...digitalHuman.modes] : [],
        localSpec: { ...(digitalHuman.localSpec || {}) },
        billingQuantity: digitalHuman.billingQuantity,
        quotes: digitalHuman.quotes,
        engine: 'volc',
        /* 要**驱动音频**那一档：产出长度与账都跟着音频走（服务端 localSpec.audio 同一判据） */
        requiresAudio: digitalHuman.requiresAudio === true || digitalHuman.localSpec?.audio === true,
      });
    }
    return rows;
  }, [digitalHuman, localProducts]);
  const processProduct = processPlan
    ? processProducts.find(product => product.id === localPlan.productId) || null
    : null;
  /* 本地方案的"子模式"：手动（本机 delogo）与自动（火山）是同一页的两条实现，
     各自一个产品、各自一档价。选中的是哪条由这一页的「字幕标记方式」决定。
     ⚠️ 这一段**必须**声明在下面的时长探针之前：探针要读"当前这条产品"的规格与时长上限
        （自动档与手动档不是同一个产品），而 const 有暂时性死区。 */
  const autoModeSelected = localEngine && String(markMode) === 'auto' && subtitleAutoReady;
  const activeProcessProduct = autoModeSelected && subtitleAuto
    ? {
      id: subtitleAuto.productId,
      label: subtitleAuto.label || '视频字幕去除 · 自动',
      billingQuantity: subtitleAuto.billingQuantity,
      quotes: subtitleAuto.quotes,
      /* 规格 / 时长上限 / 建单模式一律取**服务端产品声明**（原来页面自己写死了一份镜像，见服务端注释） */
      localSpec: subtitleAuto.localSpec || {},
      durations: subtitleAuto.durations || {},
      modes: Array.isArray(subtitleAuto.modes) ? subtitleAuto.modes : [],
      engine: 'volc',
      requiresAudio: false,
    }
    : processProduct;
  const processSpec = activeProcessProduct?.localSpec || {};
  /* 探针上限取**产品声明的最长时长**（页面不写死数字）：本机那两条 300 秒、数字人 1800 秒（30 分钟）。
     它与服务端 durationAllowed 同一口径 —— 界面能读出来的秒数必须是服务端愿意收的秒数。 */
  const processMaxSeconds = Number(activeProcessProduct?.durations?.max) > 0
    ? Number(activeProcessProduct.durations.max)
    : 300;
  /* 这一档要不要**驱动音频**（数字人：产出长度与账都按音频秒数走，视频时长不参与） */
  const processAudioSlot = processSpec.audio === true;
  /* 本机渲染组件（ffmpeg）在不在 —— 服务端实测过报（capabilities.localEngineReady）。
     缺了就如实说明 + 禁用，而不是让用户点了等一句"本机渲染组件未就绪"。 */
  const localEngineReady = capabilities.localEngineReady !== false;
  /* 页面自己声明过的字段（bind = resolution / fps …）：创作台**不重复画**同一格 ——
     同一个值两处渲染就是"改了一处、另一处还显示旧值"那类 bug 的温床。 */
  const pageOwnsField = useCallback(
    key => (workbench?.blocks || []).some(block => block.bind === key),
    [workbench],
  );
  /* process 方案的槽位：**从声明源派生**（哪个上传块的 accept 收视频 / 收音频），不在页面里写死 key。
     视频槽位：本地那两条与数字人都有（源视频 / 人物视频）；
     音频槽位：只有要驱动音频的那一档有（数字人，见 processAudioSlot）。 */
  const processSourceKey = useMemo(() => {
    if (!processPlan) return '';
    const block = (workbench?.blocks || []).find(item => item.kind === 'upload' && String(item.accept || '').includes('video'));
    return block?.key || '';
  }, [processPlan, workbench]);
  const processAudioKey = useMemo(() => {
    if (!processPlan || !processAudioSlot) return '';
    const block = (workbench?.blocks || []).find(item => item.kind === 'upload' && String(item.accept || '').includes('audio'));
    return block?.key || '';
  }, [processPlan, processAudioSlot, workbench]);
  /* 槽位素材的种类**由声明决定**：原来一律按 image 上传 —— 视频槽位会被当成图片传上去
     （服务端 415）。这类方案的上传位按块声明走（视频传视频、音频传音频）。 */
  /* 去字幕页的「自动标记」：服务端说可用才放开（否则保持声明源里的 disabled + 原因） */
  const workbenchOptionOverrides = useMemo(() => (
    localEngine && subtitleAutoReady
      ? { 'markMode:auto': { disabled: false } }
      : {}
  ), [localEngine, subtitleAutoReady]);
  const processSourceFile = processSourceKey ? (slotFiles[processSourceKey] || [])[0] || null : null;
  const processAudioFile = processAudioKey ? (slotFiles[processAudioKey] || [])[0] || null : null;
  const processSourceSeconds = Number(sourceSeconds) || 0;
  const processAudioSeconds = Number(audioSeconds) || 0;
  /* 这一单的**计费数量取哪一档的秒数**：要驱动音频的方案（数字人）按**音频**秒数，其余按**源视频**秒数。
     服务端 billableQuantity({ sku, seconds }) 与它同一口径 —— 两边不一致就是 409「费用确认不一致」。 */
  const billingSeconds = processAudioSlot ? processAudioSeconds : processSourceSeconds;
  /* 源视频在本地的可播地址（对象 URL）：① 区域框选要在它上面拖框；② 时长探针读它的元数据。
     用对象 URL 而不是服务端地址：文件刚选进来就能用（不必等上传完），也不受签名地址过期影响。 */
  useEffect(() => {
    if (!processPlan || !processSourceFile) {
      setSourcePreview('');
      return undefined;
    }
    const url = URL.createObjectURL(processSourceFile);
    setSourcePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [processPlan, processSourceFile]);
  /* 驱动音频在本地的可播地址 —— 它只为**时长探针**服务（这一档按音频秒数计费）。 */
  useEffect(() => {
    if (!processAudioSlot || !processAudioFile) {
      setAudioPreview('');
      return undefined;
    }
    const url = URL.createObjectURL(processAudioFile);
    setAudioPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [processAudioSlot, processAudioFile]);
  /* ═══ 源视频时长探针（按秒计费的档位与渲染长度都要它）════════════════════════════════════════
     按秒计费 ⇒ 服务端**必须**拿到真实秒数（缺失直接 400，不猜、不默认）。
     这里用 HTMLVideoElement 读元数据（与浏览器实际播放到的一致），向上取整到整秒：
     不足一秒按一秒算 —— 与服务端 billableQuantity 同一口径（两处都取整，才不会 409）。
     上限取产品声明的时长上限（processMaxSeconds），不在页面里写死。 */
  useEffect(() => {
    if (!processPlan || !sourcePreview) {
      setSourceSeconds(0);
      return undefined;
    }
    let cancelled = false;
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.muted = true;
    const onLoaded = () => {
      if (cancelled) return;
      const value = Number(probe.duration);
      setSourceSeconds(Number.isFinite(value) && value > 0 ? Math.min(processMaxSeconds, Math.ceil(value)) : 0);
    };
    probe.addEventListener('loadedmetadata', onLoaded);
    probe.src = sourcePreview;
    return () => {
      cancelled = true;
      probe.removeEventListener('loadedmetadata', onLoaded);
      probe.removeAttribute('src');
    };
  }, [processPlan, processMaxSeconds, sourcePreview]);
  /* ═══ 驱动音频的时长探针（2026-09-26 批 AZ · 数字人）══════════════════════════════════════════
     这一档**按音频秒数**计费（0.12 积分/秒），产出长度也由音频决定（enable_video_loop 固定 true）——
     分钟数只有从音频读得出来：拿视频时长去报，用户就会"按 8 秒的片子收到 30 秒的账"
     （或反过来少收）。所以与源视频探针同一套做法（HTMLAudioElement 读元数据 + 向上取整），
     只是元素与上限换成音频这一档的（上限取产品声明的 1800 秒 = 30 分钟）。 */
  useEffect(() => {
    if (!processAudioSlot || !audioPreview) {
      setAudioSeconds(0);
      return undefined;
    }
    let cancelled = false;
    const probe = document.createElement('audio');
    probe.preload = 'metadata';
    const onLoaded = () => {
      if (cancelled) return;
      const value = Number(probe.duration);
      setAudioSeconds(Number.isFinite(value) && value > 0 ? Math.min(processMaxSeconds, Math.ceil(value)) : 0);
    };
    probe.addEventListener('loadedmetadata', onLoaded);
    probe.src = audioPreview;
    return () => {
      cancelled = true;
      probe.removeEventListener('loadedmetadata', onLoaded);
      probe.removeAttribute('src');
    };
  }, [processAudioSlot, processMaxSeconds, audioPreview]);
  const selectedQuote = useMemo(() => {
    /* process 方案不走上游那套产品契约（它没有 durationOptions 白名单），报价另算：
       quantity 可能是秒数（去字幕 0.04 积分/秒、数字人 0.12 积分/秒），见 videoStudioModel 的 localQuoteFor。 */
    if (processPlan) return activeProcessProduct ? localQuoteFor(activeProcessProduct, billingSeconds) : null;
    if (!selectedProduct) return null;
    try {
      return quoteForVideoProduct(selectedProduct, duration);
    } catch {
      return null;
    }
  }, [activeProcessProduct, billingSeconds, duration, processPlan, selectedProduct]);
  const sku = selectedQuote?.sku || '';
  const estimatedPoints = processPlan
    ? localJobPoints(activeProcessProduct, billingSeconds)
    : Math.ceil(Number(quote?.totalUnits ?? selectedQuote?.units ?? 0) / 1000);
  /* ═══ 2026-09-16 用户批注（图2-② / 图3-①，已问到第三次）═══
     原话：「现在不是已经有预设了一套方案在这里吗？为什么你的积分还是一积分呢？这个问题你怎么还是
     没有回答我呀？……肯定是按他整个视频要收多少钱去告诉他呀。」
     参考流影AI：480P/720P/1080P 各对应 120/210/525，换档位按钮上的数字立刻变。
     这里把「整个任务要花多少」算出来挂在按钮上（方案分析费 + 成片预估）：
       · 未确认方案 → 按钮「分析并生成方案」，积分 = 1 + 成片预估（这一档就会随模型/时长变）；
       · 已确认方案 → 按钮「开始生成」，积分 = 成片预估（服务端报价，唯一事实源）。
     ⚠️ 拆分说明放 title，按钮上只留一个总数 —— 用户要的是「我这一下要花多少」。
     ⚠️ 批 AM：process 方案**没有**"方案分析"这一步（1 积分）—— 它的"方案"就是产品声明的那件事
        （擦字幕 / 提分辨率 / 口型对齐），不存在模型侧的口味问题，收那 1 积分等于凭空多收钱。
        所以总价 = 成片报价本身。 */
  const totalJobPoints = processPlan
    ? estimatedPoints
    : (estimatedPoints > 0 ? estimatedPoints + ANALYSIS_POINTS : 0);
  /* process 方案按钮上的**价目说明**（悬停才看到的那句）：价从**产品目录**取，页面不写死数字 ——
     写死就会在下一档产品上线时显示成别人的价（数字人 0.12 积分/秒、按**配音**秒数算，
     与"去字幕 0.04 积分/秒、按视频秒数算"不是同一件事）。 */
  const processPriceHint = (() => {
    const unit = Number(activeProcessProduct?.quotes?.short?.units);
    if (!Number.isFinite(unit) || unit <= 0) return '按本单报价计费';
    const points = (unit / 1000).toFixed(2);
    return activeProcessProduct?.billingQuantity === 'seconds'
      ? `按${processAudioSlot ? '配音' : '源视频'}时长计费：${points} 积分/秒`
      : `按条计费：${points} 积分/条`;
  })();
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
     presetNonce 是"又点了一次同一条"的判据：没有它，第二次点同一条不会重新生效。
     ═══ 2026-09-27 批 CE：**素材也一起还原** ═══════════════════════════════════════════════════
     用户口径（逐字）：「而且重新生成是不是也要像做同款那样，**把素材和提示词和配置都填回去工作台**呢？」
     —— 上一版只还原了提示词与规格（时长/比例/清晰度/创作方式），**素材没回来**。
     服务端 `video_jobs.refs_json` 里其实**一直存着**输入素材（{firstImage,lastImage,images,videos,audios,urls}），
     所以这里把它们还原成"已经上传好的素材"（`{id,url,name}`），走**与本地文件同一套提交路径**：
     提交时并进 refs，界面上单独一条「已带入的素材」显示（可逐张移除）。
     ⚠️ 它们**不是 File**，所以不进 `files`（那条链路要从本地读文件、还要走上传）；
        合并发生在 `handleGenerate` 里 —— 一处，不散落。 */
  const emptyRestored = { first: [], last: [], images: [], videos: [], audios: [] };
  /* 批 CE：带回来的素材也要能逐张拿掉（用户可能只想要其中一张） */
  const dropRestoredAsset = (key, id) => setRestoredAssets(current => ({
    ...current,
    [key]: (current[key] || []).filter(item => item.id !== id),
  }));
  const restoredCount = restoredAssetCount(restoredAssets, mode);
  useEffect(() => {
    if (!preset) return;
    if (preset.mode && VIDEO_CREATION_MODES.some(item => item.id === preset.mode)) setMode(preset.mode);
    /* ═══ 2026-09-27 批 CL：**配方提示词不预填**（用户改向，逐字）═══════════════════════════════════
       原话：「你现在这个提示词框里面依然是默认会有这段提示词出来，我不明白这是为什么呀？你这个问题
       一定要把它解决掉呀。我现在只要一刷新页面，它这段提示词就会出现的。」
       ⇒ 带 `source: 'skill'` 的 preset（配方）**只设规格、不写提示词**；历史「用这组参数」/做同款
         那一份不带这个标记，提示词照旧还原。值本身仍然是挂在页面上的 `data-video-recipe`（断言锚点）。 */
    if (typeof preset.prompt === 'string' && preset.source !== 'skill') setPrompt(preset.prompt);
    if (typeof preset.negativePrompt === 'string') setNegativePrompt(preset.negativePrompt);
    if (Number.isFinite(Number(preset.duration)) && Number(preset.duration) > 0) setDuration(Number(preset.duration));
    if (preset.ratio) setRatio(preset.ratio);
    if (preset.resolution) setResolution(preset.resolution);
    if (typeof preset.sound === 'boolean') setSound(preset.sound);
    /* 批 CE：素材（那次任务真实用过的输入）也一起带回创作台 */
    setRestoredAssets(normalizePresetMaterials(preset.materials));
    /* 参数变了 → 之前确认过的方案不能再算数（否则会用旧方案去生成新内容） */
    setPlanReviewed(false);
  }, [presetNonce]);

  useEffect(() => {
    let active = true;
    setQuote(null);
    setQuoteError('');
    if (!sku) return () => { active = false; };
    /* ═══ 批 AM / 批 AZ：份数一律由**服务端**定 ═══════════════════════════════════════════════
       按秒计价的档（去字幕 0.04 积分/秒、数字人 0.12 积分/秒）份数 = 整秒数，
       而这个秒数取哪一档由产品声明决定（数字人取**配音**秒数，见 billingSeconds）——
       只有服务端能把它算成份数（它同时决定建单时冻结多少，两边不一致就是 409「费用确认不一致」）。
       所以这里只报"这条片子/这段配音多少秒"这个**事实**，不报份数、更不报金额：
       按条的 SKU 仍然 quantity=1（客户端传的 seconds 会被忽略）。
       ⚠️ 这是 pricing-single-source 门禁要的方向：前端不得把"算出来的份数/金额"发给服务端。 */
    quoteBillingAction(processPlan
      ? { sku, seconds: billingSeconds || 1 }
      : { sku, quantity: 1 })
      .then(result => { if (active) setQuote(result.quote); })
      .catch(() => { if (active) setQuoteError('费用确认暂时不可用'); });
    return () => { active = false; };
  }, [billingSeconds, processPlan, sku]);

  /* 源视频/配音换了（或时长读出来了）⇒ 之前的报价作废重报：按秒计价时"秒数变了价就变了"。
     依赖里带 selectedQuote?.quantity 就够了（它就是秒数），不必再盯 sourceSeconds。 */

  useEffect(() => {
    /* process 方案不套上游那套产品契约（时长白名单 / 清晰度档位 / 创作模式），
       它的规格由页面自己的控件与源文件决定 —— 见 localPlan 那一段的说明。
       ⚠️ 这条判据必须按 **processPlan** 而不是 localEngine：数字人那一页若被上游契约接管，
          时长会被 snap 到默认模型的档位（5/10/15 秒），而它的账本来就不看这个数。 */
    if (processPlan) return;
    if (!selectedProduct) return;
    setDuration(current => snapVideoDuration(selectedProduct, current));
    if (!selectedProduct.resolutions?.includes(resolution)) {
      setResolution(selectedProduct.resolutions?.[0] || '720p');
    }
    if (!selectedProduct.modes?.includes(resolveVideoApiMode(mode, files))) setMode('smart');
    if (mode === 'frame' && selectedProduct.frameAudio === false) setSound(false);
  }, [selectedProductId]);

  /* ═══ 本地方案的**默认规格**（照 plan.defaults 落一次）══════════════════════════════════════
     为什么要有这一步：上游那条路是靠"选产品"把默认值带出来的（选哪条模型反推出分辨率/时长）；
     本地方案没有模型可选，默认值只能来自方案声明（docs/design/69 的 `defaults`：
     「规格由方案定，不由用户逐页调」）。只在进入有本地方案的那一页时落一次。
     ⚠️ 只对本机那两条有意义（数字人的 defaults 是空的、规格三项全 false），所以这条**保持**
        按 localEngine 判 —— 它不是"process 产品的通用行为"，而是"本地方案的规格落默认"。 */
  useEffect(() => {
    if (!localEngine || !processProduct) return;
    const defaults = localPlan?.defaults || {};
    if (processSpec.resolution && defaults.resolution) setResolution(String(defaults.resolution));
    setOutputFps(processSpec.fps ? (Number(defaults.fps) || 30) : null);
    setMarkMode(String(defaults.markMode || 'manual'));
  }, [localEngine, localPlan, processProduct, processSpec.fps, processSpec.resolution]);

  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    sync();
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  useEffect(() => () => clearTimeout(pollRef.current), []);

  /* ═══ 2026-09-27 批 CJ：**浮层必须让开左侧导航栏**（用户实测给出的真因，逐字）═══════════════════
     原话：「具体被截断是什么宽度？我也不知道呀，你自己看不就知道了吗？…目前的情况应该是**被左边
     这个导航栏给盖住了**，所以显得是一个被截断的状态。」
     ⇒ 实测确认：弹出层是 `position: fixed`，而它的 left 只 clamp 到 **12**；左侧导航是**不透明**的
       浮层（z 更高），于是 `left=12` 的那一半被导航压住 ⇒ 看起来"左边被截断"。
       菜单（模型）与面板（生成设置/镜头规格/声音）用的是同一个 clamp，所以**两处都得改**。
     取法：运行时量导航的右沿（不写死宽度：窄屏导航会变成图标条），再留 12px 呼吸。 */
  const floatingLeftInset = useCallback(() => {
    const nav = document.querySelector('.app-side-nav, .app-sidebar, aside.app-side-nav, .app-shell > aside, nav[aria-label]');
    const right = nav ? nav.getBoundingClientRect().right : 0;
    return Math.max(12, Math.round(right) + 12);
  }, []);

  const positionPanel = useCallback((key = activePanel) => {
    if (!key) return;
    const button = buttonRefs.current[key];
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const minLeft = floatingLeftInset();
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
    const left = Math.max(minLeft, Math.min(rect.left + rect.width / 2 - width / 2, viewportWidth - width - 12));
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
    /* ═══ 2026-09-25 批 BG：高度也照图片侧那条规则（用户图2「数量比你这个要多一些」）══════════════
       实测改前：CSS 里写死 `max-height: min(58vh, 460px)` ⇒ 12 个模型只露出 6 个，
       而图片侧是"高度取触发按钮上方的可用空间（最多 92vh）"，8 个模型一屏看得完。
       ⇒ 下拉向上张开，能用多少用多少（`rect.top - 20` 就是按钮上方的空间），
         再用 92vh 封顶（与图片侧 getVisualPanelPosition 的上限同一条）。 */
    /* ═══ 2026-09-25 批 BM：上限改成**与图片侧模型面板同一档**（用户原话，逐字）════════════════════
       「你这个视频模型的面板是不是**有点太高了**？你应该**跟图片生成那边的模型的面板高度保持一致**呀。
         然后有更多的模型在下面的话，你就**右边要搞一条这种拉动条**可以往下面拉不就行了吗？
         你一次性全部张开会不会太多了呀。你一次性张开的这些按钮数目，你可以**按照图片生成那边的数量
         去做同步的适配**，然后如果下面还有比较多的话，你就右边搞一条拉动条就可以了。」
       实测：图片侧面板高 555（8 行 × 56 + 标题 + 内边距）；视频侧原来取"按钮上方可用空间"（可达 800+）
       ⇒ 一次摊开 12 个模型。现在封顶 **520**（同档），超出部分由右侧滚动条承担（滚动条已在 CSS 里恢复显示）。 */
    const availableAbove = rect.top - 20;
    const maxHeight = Math.max(240, Math.min(520, availableAbove));
    setModelAnchor({
      left: Math.max(floatingLeftInset(), Math.min(rect.left + rect.width / 2 - width / 2, viewportWidth - width - 12)),
      bottom: Math.max(12, window.innerHeight - rect.top + 8),
      width,
      maxHeight,
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
    /* 批 N：按 skill 声明的槽位素材走同一条上传链路 ——
       ⚠️ 批 AM：种类按**块声明**给（原来一律 image，本地方案的视频槽位会被传成图片） */
    Object.entries(slotFiles).forEach(([slotKey, items]) => {
      const kind = slotKindOf(slotKey);
      (Array.isArray(items) ? items : []).forEach(file => selected.set(file, kind));
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
  }, [files, refreshUploads, slotFiles, slotKindOf, startUpload, state.logged]);

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

  /* ═══ process 方案的提交（2026-09-25 批 AM；2026-09-26 批 AZ 推广到上游执行那一档）════════════
     与上游"生成"那条路**不是同一份报文**：这类方案要的是「一条源视频（数字人还要一段驱动音频）
     + 规格（分辨率/帧率）或区域」，没有提示词、没有比例、没有拍摄方案
     （服务端对 process 产品走 validateLocalPlanInput）。几处与上游不同的地方，逐条都有理由：
       ① `mode` —— 从**产品声明的 modes** 取（本机那两条 = 'local'，数字人 = 'process'）；
          服务端也是按产品声明认这一档，页面不自己发明第三种写法。
       ② `duration` = **计费数量的那一档秒数**（billingSeconds）：本机两条取源视频整秒数（渲染长度
          也是它），数字人取**配音**整秒数（成片长度由音频决定，视频时长与账无关）。
          它同时是服务端建单前的必填校验项 —— 缺失会被拒（不猜、不默认）。
       ③ `localSpecs` = { fps, regions } —— 分辨率与时长已有列，这两样只属于本地方案。
       ④ 数字人还多**一段驱动音频**：上传与 references.audios 都要带上（服务端缺音频直接 400，
          而且是在冻结积分之前 —— 用户补个文件就能过）。
     ⚠️ 幂等键把两种素材的 id、规格与区域都算进去：换了配音、改了分辨率或重框了区域
        就是**另一次处理**（与上游同一条纪律）。 */
  async function submitProcessJob() {
    if (!activeProcessProduct) {
      setError('该功能暂时不可用，请稍后再试');
      return;
    }
    if (!processSourceFile) {
      setError(processAudioSlot ? '请先上传人物视频' : '请先上传要处理的视频');
      return;
    }
    if (processAudioSlot && !processAudioFile) {
      setError('请先上传驱动配音');
      return;
    }
    if (!billingSeconds) {
      setError(processAudioSlot
        ? '还没读出这段配音的时长，请稍候或重新选择文件'
        : '还没读出这条视频的时长，请稍候或重新选择文件');
      return;
    }
    if (processSpec.regions && !regions.length) {
      setError('请先在视频上框选要擦除的字幕区域');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const [source] = await uploadFiles([processSourceFile], 'video');
      if (!source?.id) throw new Error(processAudioSlot ? '人物视频上传失败，请重试' : '源视频上传失败，请重试');
      const [audio] = processAudioSlot ? await uploadFiles([processAudioFile], 'audio') : [];
      if (processAudioSlot && !audio?.id) throw new Error('驱动配音上传失败，请重试');
      const idempotencyKey = stableCanvasActionId([
        'video-process-job',
        activeProcessProduct.id,
        source.id,
        audio?.id || '',
        resolution,
        processSpec.fps ? String(outputFps || '') : '',
        processSpec.regions ? JSON.stringify(regions) : '',
        String(billingSeconds),
      ].join('\u0000'));
      const result = await createVideoJob({
        productId: activeProcessProduct.id,
        /* 建单模式取产品声明（本机 = 'local'，火山 = 'process'）：服务端两边都认，但请求里
           写的一定要是这条产品真正的模式，否则报文本身就在说假话。 */
        mode: activeProcessProduct.modes?.[0] || 'local',
        duration: billingSeconds,
        resolution,
        /* process 方案不裁比例、不用提示词：服务端也是这么收的（空串是"这一栏不适用"的明确写法） */
        aspectRatio: '',
        generateAudio: false,
        billingQuoteId: quote.quoteId,
        localSpecs: {
          fps: processSpec.fps ? outputFps : null,
          regions: processSpec.regions ? regions : [],
        },
        references: {
          videos: [source.id],
          audios: audio?.id ? [audio.id] : [],
          urls: { [source.id]: source.url, ...(audio?.id ? { [audio.id]: audio.url } : {}) },
        },
      }, idempotencyKey);
      recordCreatedJob(result);
    } catch (generationError) {
      if (generationError?.status === 402 || generationError?.code === 'BILLING_INSUFFICIENT_CREDITS') {
        dispatch({ type: 'OPEN_PAYWALL', reason: 'INSUFFICIENT_CREDITS' });
      }
      setError(generationError?.message || '任务创建失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  /* ═══ 建单成功之后的三件事（本地方案与上游共用这一处）══════════════════════════════════════════
     原位打技能标记 → 结果上台 → 开始轮询。抽出来不只是为了少写两遍：
     ① `tagVideoJob` 只允许在"创建成功之后"出现一次（test/media-skill-embed-0918 ⑤ 守的就是
        它不许混进计费/幂等判断）—— 复制第二份就会被那条门禁抓住，而这里只有一处；
     ② 三条动作少一条都会出真问题（不给标记 → 子页面历史里看不到这次任务；
        不上台 → 用户以为没跑；不轮询 → 永远停在"提交中"）。 */
  function recordCreatedJob(result) {
    if (skillTag) tagVideoJob(result.job.id, skillTag);
    setJob(result.job);
    setHistory(current => [result.job, ...current.filter(item => item.id !== result.job.id)].slice(0, 20));
    void poll(result.job.id);
  }

  async function handleGenerate() {
    if (submitting || !quote?.quoteId) return;
    /* process 方案：报价到手就能跑（没有"先出方案、确认后再生成"那一步）。 */
    if (processPlan) {
      await submitProcessJob();
      return;
    }
    if (!planReviewed || !effectivePlan.ready || !activeAnalysis || analyzedSignature !== planSignature) return;
    setError('');
    setSubmitting(true);
    try {
      /* 批 N：按 skill 声明的**槽位素材**也是这次生成的输入（它们与「图片」同一类，只是各有各的标题） */
      const selected = mode === 'frame'
        ? { first: files.first, last: files.last, images: [], videos: [], audios: [] }
        : { first: [], last: [], images: [...files.images, ...slotImageFiles], videos: files.videos, audios: files.audios };
      const reusable = plannedUploads?.signature === planSignature ? plannedUploads.assets : null;
      const [uploadedFirst, uploadedLast, uploadedImages, uploadedVideos, uploadedAudios] = reusable
        ? [reusable.first, reusable.last, reusable.images, reusable.videos, reusable.audios]
        : await Promise.all([
          uploadFiles(selected.first, 'image'),
          uploadFiles(selected.last, 'image'),
          uploadFiles(selected.images, 'image'),
          uploadFiles(selected.videos, 'video'),
          uploadFiles(selected.audios, 'audio'),
        ]);
      /* 批 CE：把"带回来的素材"并进这次生成的输入 —— **只在这一处合并**（上面上传出的那几组同形）。 */
      const [first, last, images, videos, audios] = [
        [...restoredAssets.first, ...uploadedFirst].slice(0, mode === 'frame' ? 1 : undefined),
        [...restoredAssets.last, ...uploadedLast].slice(0, mode === 'frame' ? 1 : undefined),
        [...restoredAssets.images, ...uploadedImages].slice(0, 9),
        [...restoredAssets.videos, ...uploadedVideos].slice(0, 9),
        [...restoredAssets.audios, ...uploadedAudios].slice(0, 9),
      ];
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
      recordCreatedJob(result);
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
  /* ═══ 2026-09-26 批 CA：**必须素材的模式，缺素材时按钮要暗着**（用户本轮批注，逐字）══════════
     原话：「你这个按钮不是必须要上传相关的素材才能实现吗？那你为什么不让他暗下去呢？应该要拥护
     他达到某种条件之后它才能亮起来吧。图片生成那边，我们不是已经做了相关的配置吗？为什么视频生
     成这边的子页面你不做这些配置呢？」
     ⚠️ 判据只有一条：requires（= hasRequiredVideoInputs(mode, files)）。
       · 智能成片这类**不强制素材**的模式：requires 恒为 true → 写了提示词就亮
         （用户早前的规矩：「如果你这个 skill 不需要一定要上传素材…只要用户他输入了提示词，这里就会亮起来」）；
       · 首尾帧 / 参考素材这类模式：requires 由素材决定 → 没传素材时按钮**暗着**，
         正好与下面 submitHint ②「不该出现时不出现」成对。 */
  const canAnalyze = capabilities.generationEnabled && selectedProduct && hasAnyInput && requires;
  /* process 方案的可生成判据（与上游不同，见 submitProcessJob 的说明）：
     报价到手 + 该有的素材都在（数字人还要驱动配音）+ 计费那一档的秒数读出来了
     + （要区域的那一档）区域框好了 + **本机执行**才要求本机渲染组件在。
     ⚠️ 上游执行那一档（数字人）不走 ffmpeg：本机渲染组件在不在与它无关，
        所以这里按"谁执行"判，而不是一律要求 localEngineReady。 */
  const processReady = processPlan
    ? Boolean(
      activeProcessProduct && quote?.quoteId && processSourceFile
      && (!processAudioSlot || processAudioFile)
      && billingSeconds
      && (!localEngine || autoModeSelected || localEngineReady)
      && (!processSpec.regions || regions.length),
    )
    : false;
  const canGenerate = processPlanBlocked
    ? false
    : (processPlan
      ? processReady && !submitting
      : (capabilities.generationEnabled && selectedProduct && quote?.quoteId && prompt.trim() && requires && planReviewed && effectivePlan.ready && activeAnalysis && !submitting && !planning));
  /* ═══ 2026-09-25 批 BN：CTA 下面那行「还差什么」（视频侧原来没有，图片侧有 ctaHint）══════════════
     用户原话：「他们这个按钮是当用户没有满足条件的时候，这个按钮是不能够亮起来的。然后当你这个是
     必须要上传素材的时候，**它下面是会有一个提示**必须要上传的。如果你这个 skill 不需要一定要上传
     素材，那就不会有这个提示，就是**只要用户他输入了提示词，这里就会亮起来**。」
     ⇒ 三条规矩：
       ① **缺什么说什么，一次只说最该先做的那一步**（把 6 个条件一次倒出来，用户反而不知道先做哪个）；
       ② **不该出现时不出现**（智能成片这类不强制素材的模式，输入提示词就不该被提示拦着）；
       ③ 文案是**用户要做的事**，不写内部原因（"requires=false" 这种话不进界面）。 */
  const submitHint = (() => {
    if (submitting) return '';
    if (!state.logged) return '登录后即可生成';
    if (!capabilities.generationEnabled) return '视频生成暂未开放';
    if (processPlanBlocked) return processPlanBlockedReason || '';
    if (processPlan) {
      /* 上游/本机处理那一档（视频高清 / 去字幕 / 数字人）：要的是"一条源片子 + 它自己的规格" */
      if (!processSourceFile) return '请先上传要处理的视频';
      if (processAudioSlot && !processAudioFile) return '请先上传配音文件';
      if (processSpec.regions && !regions.length) return '请先在画面上框选要处理的区域';
      if (localEngine && !autoModeSelected && !localEngineReady) return '本机渲染组件未就绪，暂时不能生成';
      if (!quote?.quoteId) return '正在确认费用…';
      return '';
    }
    if (!String(prompt || '').trim()) return '请输入画面描述';
    if (!requires) return mode === 'frame' ? '请先上传首帧和尾帧' : '请先上传参考图片和参考视频';
    if (!activeAnalysis || !planReviewed) return '请先「分析并生成方案」并确认';
    if (!quote?.quoteId) return '正在确认费用…';
    return '';
  })();

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
    /* ⚠️ 批 BX：这里**不重置弹窗内部状态**（组件没卸载）—— 需求/素材没变的话，
       弹窗自己会把上一份脚本原样摆回来（不请求、不重复扣费）；变了才是新的一份。 */
    setDaweiPreview({ materials, prompt: String(prompt || '').trim() });
    setDaweiOpen(true);
    return undefined;
  };

  /* 「确认并应用」= 把方案正文写回脚本输入框（知渔第 3 步原文也是「确认脚本并应用」）。 */
  const applyDaweiPreview = text => {
    setPrompt(String(text || '').slice(0, VIDEO_PROMPT_MAX_LENGTH));
    setPlanReviewed(false);
    setDaweiOpen(false);
    setDaweiUnapplied(false);
    return undefined;
  };

  /* ═══ 2026-09-24 批 AG：**规格暴露**（用户：「为什么还有这种模型 / 清晰度 / 时长都全部做进去的情况呢，
     我不是说了所有子页面一比一对应知渔的视频生成和图片生成的页面吗」）═══════════════════════════
     逐页探针（真浏览器，30 个有对照页的技能）查出：**每一页都渲染同一套** ——
     生成设置面板里固定有「清晰度 / 画面比例 / 视频时长」，工具栏固定有一颗「模型」。
     而知渔那 30 页里：**清晰度 0 页有、模型 5 页有、时长 6 页有**。
     ⇒ 子页面按 `videoSpecExposure`（由知渔实采派生、有门禁钉住）决定这三格露不露；
       首页/独立路由（非子页面）保持原样（它是"通用创作台"，本来就该给全部规格）。 */
  /* 批 CE：带回来的素材也算这次的输入（否则"CTA 说没素材、但提交里其实有图"账实不符）。 */
  const assetCount = (mode === 'frame' ? files.first.length + files.last.length : materialEntries.length) + restoredCount;
  /* 首尾帧那两格是"起点/终点"两个固定位，没有"素材集合"可清、也不该整屏铺开 ——
     所以清空与全屏只长在真正有素材集合的档位上（给一个点了没意义的按钮比不给更糟）。 */
  const deckMode = mode !== 'frame';
  const toolbarSummary = {
    shot: `${ratio} · ${duration}秒`,
    sound: sound ? '生成声音' : '无声音',
    /* 批 BB：「Seed 随机」从这颗按钮的摘要里去掉 —— 面板里那一格已经删了，
       摘要再挂着它就等于"删了 UI、还留一句残留说明"（用户批注：「随机种子又是要干嘛的呢」）。 */
    /* 批 BF：照知渔那颗胶囊里的写法（值是「值 · 值 · 值」，一眼看全当前配置） */
    settings: `${resolution.toUpperCase()} · ${ratio} · ${duration}s`,
    /* 9-12 用户批注：技能选择的结果要显示在「技能库」这一项下面（生成设置里那份去掉） */
    skills: userSkills.length ? userSkills.map(skill => skill.name).join(' · ') : '未选技能',
  };

  /* ═══ 批 CE：「已带入的素材」（历史「用这组参数」带回来的那次输入）═════════════════════════════
     用户口径：「重新生成是不是也要像做同款那样，把**素材**和提示词和配置都填回去工作台呢？」
     ⇒ 带回来的素材单独一条显示：看得见、可逐张移除、并且**真的会进这次生成**（见 handleGenerate 的合并）。
     ⚠️ 它**不是**本地文件，所以不进上面的 FilePicker（那条链路要从磁盘读文件、还要上传）；
        这里只做展示 + 移除，提交时按 `{id,url}` 并进 refs。 */
  const renderRestoredAssets = () => {
    const rows = [];
    const push = (key, kind) => (restoredAssets[key] || []).forEach(item => rows.push({ key, kind, item }));
    push('first', 'image');
    push('last', 'image');
    push('images', 'image');
    push('videos', 'video');
    push('audios', 'audio');
    if (!rows.length) return null;
    const label = { first: '首帧', last: '尾帧', images: '图片', videos: '视频', audios: '音频' };
    return (
      <div className="video-restored-materials" role="note">
        <strong>已带入的素材（{rows.length}）</strong>
        <small>这条记录生成时用到的素材，已经放进这次生成；不想要的可以逐张移除。</small>
        <ul>
          {rows.map(({ key, kind, item }) => (
            <li key={key + ':' + item.id}>
              {kind === 'image' ? <img src={item.url} alt="" loading="lazy" />
                : kind === 'video' ? <video src={item.url} muted playsInline preload="metadata" />
                  : <span className="video-restored-audio" aria-hidden="true">♪</span>}
              <span>{label[key]}{item.name ? ' · ' + item.name : ''}</span>
              <button type="button" aria-label={'移除' + label[key] + '素材'} onClick={() => dropRestoredAsset(key, item.id)}>×</button>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const renderAssetPickers = () => {
    if (mode === 'frame') {      /* ═══ 2026-09-19 批 I-⑥（用户批注 #1-5 / #2-1）══════════════════════════════════════
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
      {/* ⚠️ 批 AM：本地方案的「输出分辨率」长在**它自己的字段块**里（照知渔把这一格放在
          「视频设置」下那一页的左栏，而不是通用创作台的生成设置里）。
          判据：工作台已经声明了 bind='resolution' 的块 ⇒ 这里不再画第二份（同一格两处渲染，
          改了这处那处还显示旧值）。 */}
      {specExposure.clarity && !pageOwnsField('resolution') && (
      <div className="video-panel-section"><GroupTitle icon={MonitorPlay}>清晰度</GroupTitle>
        <div className="video-resolution-pills">
          {clarityOptions.map(option => <button key={option.value} type="button" className={resolution === option.value ? 'is-selected' : ''} title={option.hint} onClick={() => selectClarity(option.value)}>{option.value.toUpperCase()}</button>)}
        </div>
      </div>
      )}
      {/* ═══ 批 Y：「镜头规格」那颗按钮已下线 ⇒ 画幅与时长**并进这一面板**（照知渔的「视频设置」）═══
          知渔的「视频设置」就是 分辨率 / 画面比例 / 视频时长 三组，我们原来把后两组拆在另一颗按钮里。 */}
      <>
        <div className="video-panel-section"><GroupTitle icon={Crop}>画面比例</GroupTitle>
          <div className="video-ratio-cards">
            {RATIOS.map(value => <button key={value} type="button" className={ratio === value ? 'is-selected' : ''} onClick={() => { setPlanReviewed(false); setRatio(value); }}><i style={{ aspectRatio: value.replace(':', ' / ') }} aria-hidden="true" /><span>{value}</span></button>)}
          </div>
        </div>
        {specExposure.duration && (
        <div className="video-panel-section"><GroupTitle icon={Timer}>视频时长</GroupTitle>
          <div className="video-duration-inline">
            <input className="video-duration-range" type="range" min={durationRange.min} max={durationRange.max} step={durationRange.step} value={duration} onChange={event => { setPlanReviewed(false); setDuration(snapVideoDuration(selectedProduct, Number(event.target.value))); }} />
            <input className="video-duration-number" type="number" min={durationRange.min} max={durationRange.max} value={duration} onChange={event => { setPlanReviewed(false); setDuration(snapVideoDuration(selectedProduct, Number(event.target.value))); }} />
            <span>秒</span>   {/* 批 BK：用户「你这个 s 是不是应该改成秒会比较好呀？」 */}
          </div>
        </div>
        )}
      </>
      {/* ⚠️ 批 BK：「视频时长」这组外面原来多了一个裸的 `}`（写成了 `</>}`）——
          那个花括号会被当成**文本节点**渲染出来，就是用户截图里时长下面单独一行的「}」。
          实测复现：面板里「视频时长」下面独立一行只有一个「}」。现已删除。 */}
      {/* ═══ 批 W（2026-09-21）：**「避免出现的内容」整块删除**（用户原话，逐字）══════════════════
          原话（图二）：「这个**避免出现的内容去掉**，这块**没有意义**。」
          ⚠️ 状态与请求体字段都**保留**（negativePrompt 仍会随请求下发，默认空字符串），
             只是页面上不再给这一格 —— 删的是一块用户判断为无意义的输入，不是抽掉一个链路。
          ⚠️ 知渔那两页也没有这一格（他们的负面约束写在各自模板的提示词里）。 */}
      {/* 9-12 用户批注：技能相关从生成设置里去掉 —— 已选技能显示在工具栏「技能库」上（见 toolbarSummary.skills） */}
      {/* ═══ 2026-09-24 批 BB：**「随机种子」整行删除**（用户改向，逐字）═══════════════════════════
          原话：「然后就是下面这个**随机种子又是要干嘛的呢**？而且你还有一个**括号**在那里，
          是要干嘛呢？」⇒ 这一格与那句说明（"填 0 表示随机生成"）一起下掉。
          ⚠️ `seed` 这个**字段本身保留**（请求体里照旧下发，默认 0 = 随机）——删的是那一格 UI，
             不是链路（与批 W 删「避免出现的内容」同一处理方式）。 */}
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
  /* ═══ 2026-09-27 批 CG：「生成记录」这一段 JSX（搬进右栏历史区）═════════════════════════════════
     类名（`.video-history` / `.video-history-title` / `.video-history-empty`）**一个都不改**：
     e2e 与门禁按它们找；改的只是它渲染在哪儿。`homeComposer` 那一支保持原样（首页只留入口按钮）。
     （批 CD 走过一版又被回退，原因与时间线见下面渲染处那段注释。） */
  /* 批 CM：工作台声明的「生成脚本」动作（键 script）—— 它现在渲染在底部动作区，与图片侧同级 */
  const scriptAction = ((workbench && workbench.blocks) || []).find(block => block.kind === 'text' && block.action && block.action.key === 'script')?.action || null;
  const disabledForActions = !capabilities.generationEnabled || !state.logged || planning;

  const videoHistoryBlock = (
    <div className="video-history">
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
  );

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
          /* 批 AM：槽位里已选素材的可播地址（区域框选要拿它当画布）——
             key 是块 key，只有 process 方案那条视频槽位会用上 */
          slotPreviews={processSourceKey ? { [processSourceKey]: sourcePreview } : {}}
          regions={regions}
          onRegionsChange={next => { setPlanReviewed(false); setRegions(next); }}
          blockValues={blockTexts}
          onBlockValueChange={(key, value) => { setPlanReviewed(false); setBlockTexts(current => ({ ...current, [key]: String(value || '').slice(0, VIDEO_PROMPT_MAX_LENGTH) })); }}
          prompt={prompt}
          onPromptChange={value => { setPlanReviewed(false); setPrompt(String(value || '').slice(0, VIDEO_PROMPT_MAX_LENGTH)); }}
          values={{ ratio, duration, swapMode: swapTarget, resolution, fps: outputFps, markMode }}
          optionOverrides={workbenchOptionOverrides}
          onValueChange={(bind, value) => {
            setPlanReviewed(false);
            if (bind === 'ratio') setRatio(String(value));
            else if (bind === 'duration') setDuration(Number(value) || 5);
            else if (bind === 'swapMode') setSwapTarget(String(value));
            /* 本地方案的两格（知渔「视频设置」下的输出分辨率与 FPS）：直接进请求 */
            else if (bind === 'resolution') setResolution(String(value));
            else if (bind === 'fps') setOutputFps(Number(value) || null);
            else if (bind === 'markMode') setMarkMode(String(value));
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
        {/* ═══ 批 CE：「已带入的素材」要**两种形态都渲染** ═══════════════════════════════════════
            ⚠️ 上一版把它放进了 `{!workbenchMode && …}` 那一块 —— 而技能子页面走的正是
               **workbenchMode**（工作台整块渲染），于是"带回来的素材"在子页面上根本看不见；
               e2e ⑫b 当场判红（`「用这组参数」把那次任务的素材也带回创作台`）。
            ⇒ 移到这层：它同时覆盖工作台形态与通用创作台形态，两处一视同仁。 */}
        {renderRestoredAssets()}
        {!workbenchMode && <section className="video-materials" aria-label="上传素材">
          {/* ═══ 2026-09-24 批 AV：这一行**整块搬到下面 @ 那一层**（用户图二批注 6）═════════════════
              用户原话：「你这个部分留白也确实太多了。我搞不明白你这**三张卡片上面**为什么要有
              这么多留白呢。右边的这个全屏按钮，你可以想一下放在其他地方或者怎么样。你也许可以
              放在 **@ 的那一层**那里吧，然后上面就不要留白这么多呀，稍微往上面调整呀！」
              诊断（量过）：全屏按钮那一行高 26，把三张素材卡整整压下去 **24px** ——
              而图片生成那边素材卡上方没有这么一行，两边第一块内容的起点因此差一截。
              ⇒ 动作按钮（N 个 / 清空素材 / 全屏）搬到 `.video-skill-row`（@ 那一行）的右端。 */}
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
              /* 缩略图解析器：上传记录里的素材 URL（与素材卡同一条来源）——
                 写成渲染期的箭头函数，取到的一定是最新值，也不会把 uploadFor 拖进任何 deps（TDZ）。 */
              renderItem={item => renderVideoMentionItem(item, file => uploadsRef.current?.get?.(file)?.asset?.url || '')}
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
              {/* ═══ 2026-09-26 批 CB：文案改站内叫法（用户本轮批注，逐字）════════════════════════
                 原话：「什么叫代为撰写呀？我们这里把代为撰写**已经改了一个称呼了**呀。你这里
                 不是有一个叫**生成脚本**的按钮吗？这个按钮是不是就是他们的那个代为撰写呀？」
                 ⇒ 与工作台里那颗付费动作同名（SCRIPT_ACTION.label = 生成脚本），类名保持不变
                   （门禁 / e2e 都按 `.video-dawei-entry` 找它，改的只是给用户看的字）。 */}
              生成脚本
            </button>}
            {/* ═══ 2026-09-24 批 AV：素材动作（N 个 / 清空素材 / 全屏）从素材格上方**搬到这一行**════════
                用户原话（图二批注 6）：「我搞不明白你这三张卡片上面为什么要有这么多留白呢。
                右边的这个**全屏按钮**，你可以想一下放在其他地方或者怎么样。你也许可以放在
                **@ 的那一层**那里吧，然后上面就不要留白这么多呀」。
                ⇒ 它们本来就是"动作"而不是说明文字（批 I-⑦ 的结论），放在 @ 这一行的右端
                   既不占额外高度、也不跟素材格抢注意力。只在 deckMode（首页/独立创作台）出现。 */}
            {/* 批 BF：「全屏」与档位无关 —— 首尾帧那一档也要有（用户原话：
                「现在首尾帧和图片生成那边，他们都没有这个全屏按钮，**这个你也要加上去**」）。
                N 个 / 清空素材 仍只长在真有素材集合的档位上（首尾帧是两张固定位，没有"集合"可清）。 */}
            <div className="video-materials-actions">
              {deckMode && assetCount > 0 && <b>{assetCount} 个</b>}
              {deckMode && assetCount > 0 && <button type="button" className="video-materials-clear" onClick={clearMaterials}><Trash2 size={13} />清空素材</button>}
              <button type="button" className="video-materials-fullscreen" aria-pressed={fullscreen} title={fullscreen ? '退出全屏' : '全屏创作台'} onClick={toggleFullscreen}><Maximize2 size={13} />{fullscreen ? '退出全屏' : '全屏'}</button>
            </div>
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
          {/* ═══ 批 AM：process 方案的两句"实话"（照"不许放点了必失败的东西"那条铁律）══════════════
              ① 本机渲染组件不在（服务端实测报的 localEngineReady=false）⇒ 说明 + 按钮禁用；
              ② 计费那一档的秒数还没读出来 ⇒ 说明为什么按钮还不能点（按秒计费要用它）。
                 数字人那档读的是**配音**的秒数，所以文案跟着那一档走（不说"视频时长"）。
              两句都不是安慰话，是**当前真实状态**，所以都带得出"下一步做什么"。 */}
          {localEngine && !localEngineReady && (
            <div className="video-error">本机渲染组件未就绪，该功能暂时不可用；已上传的素材不会计费。</div>
          )}
          {processPlan && !processPlanBlocked
            && (!localEngine || autoModeSelected || localEngineReady)
            && (processAudioSlot ? processAudioFile : processSourceFile) && !billingSeconds && (
            <div className="video-error">
              {processAudioSlot
                ? '正在读取配音时长…（这一档按配音秒数计费，需要先读到时长）'
                : '正在读取视频时长…（按秒计费的档位需要先读到时长）'}
            </div>
          )}
          {!capabilities.loading && !capabilities.generationEnabled && !processPlan && <div className="video-error">视频生成功能尚未开放，当前不会扣除积分。</div>}
          {/* 批 AU：上游处理的方案页（数字人）—— 服务端说还不可用时如实说明原因（不写死文案）。
              ⚠️ 批 AZ：加 `!capabilities.loading` —— 能力位还没回来时 available 不是 false 而是"还不知道"，
                 那一刻写"还在施工/不可用"就是对用户说假话（这一页本来就用不了，按钮也还点不动）。 */}
          {processPlanBlocked && !capabilities.loading && (
            <div className="video-error">{processPlanBlockedReason}</div>
          )}
        </div>
      </section>
      </ComposerSurface>

        <footer className="video-toolbar" ref={toolbarRef}>
          <div className="video-toolbar-controls">
            <div className="video-quick-tools" ref={quickToolsRef}>
              {/* 2026-09-16：这里原来还有一个重复的 @（底栏版）。两套 @ 两套菜单正是
                 用户说的「为什么跟其他板块的艾特键不一样」—— 现在只剩输入框下方那一个共用组件。 */}
               {/* ⚠️ 批 AM：本地方案**不给模型格**（plan.hideModel）—— 它不是"某个模型"，
                   而是本机渲染的一个方案；知渔那两页也没有模型选择器（去字幕页的
                   「视频模型：智能去字幕」是静态文案，由工作台的 static 块渲染）。 */}
               {specExposure.model && !localPlan?.hideModel && <span className="video-inline-control">
                {/* 9-11 用户批注: 模型控件比其它按钮矮一截 → 统一成「小标题 + 参数」两行结构与同高 */}
                <button ref={modelButtonRef} type="button" className={'video-config-trigger is-model' + (inlineMenu === 'model' ? ' is-open' : '')} aria-expanded={inlineMenu === 'model'} onClick={toggleModelMenu}>
                  <VideoModelMark product={selectedProduct} provider={selectedProduct?.providerLabel} size={28} />
                  {/* ⚠️ 文案那一层必须带 `.video-model-copy`：下面 CSS 里那条 flex: 1 1 auto 只该作用于它，
                      不能再像原来那样用 `> span` 把图标底座一起拉宽（批 BG 的实测根因）。 */}
                  <span className="video-model-copy"><small>视频模型</small><strong>{activeRow?.label || selectedProduct?.label || '选择视频模型'}</strong></span>
                  <ChevronDown size={14} />
                </button>
                {inlineMenu === 'model' && <div className="video-inline-menu is-model" style={{ left: modelAnchor?.left, bottom: modelAnchor?.bottom, width: modelAnchor?.width, maxHeight: modelAnchor?.maxHeight }}><div className="video-model-menu-head"><GroupTitle icon={Sparkles}>视频模型</GroupTitle></div>{/* 批 BM：家族分组。⚠️ 每组用 Fragment 包（**不套 div**）—— 模型行的样式全是
    `.video-inline-menu > button` 这种直接子选择器（1177/1187/1190/1203/1210 行那一族），
    套一层 div 会让整族样式静默失配（这就是"两边两套东西"的成因之一）。 */}{/* 批 BR-2：**不再渲染家族标题行**（用户原话：「没必要分类完把名字都当标题再各自做一行啊，都应该去掉」）。
    Fragment 保留：同一家族的型号依旧连续排列（分组只是"排序 + 相邻"，不是"画一行标题"）。
   */}{modelRows.families.map(family => <React.Fragment key={family.key}>{family.rows.map(row => <button key={row.variant} type="button" aria-pressed={activeRow?.variant === row.variant} className={activeRow?.variant === row.variant ? 'is-selected' : ''} onClick={() => { setPlanReviewed(false); const next = productForResolution(row, resolution); if (next) setSelectedProductId(next.id); setInlineMenu(null); }}><VideoModelMark product={row.primary} provider={row.primary.providerLabel} size={32} /><span className="video-model-copy"><b>{row.label}<em>{videoModelChip(row, activeRow?.variant === row.variant ? (selectedProduct?.tierLabel || row.tierLabel) : row.tierLabel)}</em></b><small>{row.description}</small>
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
                </span>{activeRow?.variant === row.variant && <Check size={16} />}</button>)}</React.Fragment>)}
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
            {TOOLBAR_ITEMS
              /* ⚠️ 批 AM：本地方案的子页面**不给「生成设置」**（清晰度 / 比例 / 时长 / Seed）——
                 那几样对"处理一条已有片子"没有意义：分辨率与帧率是这一页自己的字段，
                 比例不裁、时长由源片决定、Seed 也没有模型可播种；知渔那两页同样没有这一栏
                 （他们有「视频设置」，即本页那两组字段）。上游页面一字未动。 */
              .filter(item => item.key !== 'skills' && item.key !== 'shot'
                && !(processPlan && item.key === 'settings'))
              .map(item => {
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
          {/* ═══ 批 AM：process 方案（本机执行 + 上游执行）**没有"分析并生成方案"那一步**（不收那 1 积分）
              它的"方案"就是产品声明的那件事（擦字幕 / 提分辨率 / 口型对齐），没有模型侧的口味要确认，
              所以直接给「开始生成」，价格 = 这一单的报价本身。上游"生成"那条路的两次点击一字未动。
              ⚠️ 批 AZ：按钮上的价目说明也从**产品目录**派生（原来写死 0.04/0.50 两个数字）——
                 数字人那一档是 0.12 积分/秒、按**配音**秒数算，写死就会显示成别人的价。 */}
          {processPlan ? (
<div className="video-submit-row"><div className={'video-submit-actions' + (submitHint ? ' has-hint' : '')}>{/* 批 BN：提示在按钮**下方**居中（与图片侧同一个类，规格只有一份） */}
              <button
                type="button"
                className={`video-generate-trigger shubao-gen-cta${quote?.quoteId ? ' is-armed' : ''}${submitting ? ' is-busy' : ''}`}
                disabled={!canGenerate}
                onClick={handleGenerate}
                title={processPriceHint}
              >
                {quote?.quoteId && !submitting && <Lock size={13} />}<Play size={17} />
                {submitting ? '正在提交' : (quoteError || <>{'开始生成'}<span className="shubao-gen-cta-points">{estimatedPoints} 积分</span></>)}
              </button>
              {submitHint ? <p className="shubao-gen-cta-hint">{submitHint}</p> : null}
            </div></div>
          ) : (
          <div className="video-submit-row"><div className={'video-submit-actions' + (submitHint ? ' has-hint' : '')}>{workbenchMode && scriptAction ? <button type="button" className="video-script-trigger" disabled={disabledForActions} onClick={runDawei}><Sparkles size={14} />{scriptAction.label}<span className="video-script-trigger-points">{scriptAction.points} 积分</span></button> : null}{!planReviewed ? <button type="button" className={`video-generate-trigger shubao-gen-cta${planning ? ' is-busy' : ''}`} disabled={planning || !canAnalyze} onClick={openVideoPlan}>{planning ? <Loader2 size={16} /> : <Aperture size={15} />}{planning ? '正在分析素材' : <>{activeAnalysis ? '查看并确认方案' : '分析并生成方案'}<span className="shubao-gen-cta-points" title={estimatedPoints > 0 ? `方案分析 ${ANALYSIS_POINTS} 积分 + 成片预估 ${estimatedPoints} 积分（随模型 / 时长 / 清晰度实时变化）` : '方案分析费'}>{totalJobPoints || ANALYSIS_POINTS} 积分</span></>}</button> : <><button type="button" className="video-plan-trigger" onClick={openVideoPlan}><Aperture size={15} />查看方案</button><button type="button" className={`video-generate-trigger shubao-gen-cta${quote?.quoteId ? ' is-armed' : ''}${submitting ? ' is-busy' : ''}`} disabled={!canGenerate} onClick={handleGenerate}>{quote?.quoteId && !submitting && <Lock size={13} />}<Play size={17} />{submitting ? '正在提交' : (quoteError || <>{'开始生成'}<span className="shubao-gen-cta-points">{estimatedPoints} 积分</span></>)}</button></>}{submitHint ? <p className="shubao-gen-cta-hint">{submitHint}</p> : null}</div></div>
          )}
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
        {/* ═══ 2026-09-26 批 BY / 2026-09-27 批 CG：**左栏不再有「生成记录」**════════════════════════
             BY 只做到"子页面整段不渲染"，但用户又看了一次并指出：那块**还在**（截图里它就在 CTA 下面），
             并明说「你这个生成结果必须在右边的历史区里面呀。这个地方一定是要删掉的呀」。
             ⇒ 原来这一处的 JSX 已提成 `videoHistoryBlock`（**类名一个都不改**），在 `</section>` 之后
               统一渲染：有右栏挂载点就 portal 进「历史」页签，没有（首页 / 独立创作台 / 独立路由）才内联。
             ⚠️ **不能删**（e2e 硬要求）：`.video-history` 必须在 DOM 里、里面必须有按钮、点一条要把
                成片放上结果台 —— 它是**全部**视频任务的唯一入口（没有 skill 标记的任务只在这里看得到）。
             📌 时间线：批 CD（提交 c23dcd81）走过一版又被回退 —— 那次提交把**正在被另一条线改到一半**
                的这个文件抓进了历史（`setRestoredAssets` 调用点在、声明不在）⇒ 产物抛 ReferenceError。
                他们的批 CD/CE 完整落库后，本批 CG 重落（此注释即那次事故的留档，别再踩）。 */}
      </div></section>}{(!embedded || inlineResult) && !homeComposer && (historyHost ? createPortal(videoHistoryBlock, historyHost) : videoHistoryBlock)}
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
    {/* 批 K-D：视频侧「代为撰写」——与图片侧「生成预览」是**同一个组件、同一条服务端流水线**。
        ⚠️ 批 BX：**组件保持挂载**（`open` 由 daweiOpen 控制）—— 关掉只是收起来，
           脚本与用户在里面改过的东西都留着，再点一次「代为撰写 / 生成脚本」立刻回来。 */}
    {daweiPreview && (
      <PlanPreviewDialog
        open={daweiOpen}
        surface="video"
        /* 批 BW：子页面里的「代为撰写」按**这条视频 skill** 取解析方案；
           首页那种没有具体 skill 的入口 skillId 为空，退回通用档（服务端兜底）。 */
        skillId={workbenchSkillId}
        skillName={skillTag || '视频创作'}
        prompt={daweiPreview.prompt}
        materials={daweiPreview.materials}
        onClose={() => setDaweiOpen(false)}
        onApply={applyDaweiPreview}
        onSkip={() => { setDaweiOpen(false); setDaweiUnapplied(false); }}
        onPlanStateChange={setDaweiUnapplied}
      />
    )}
  </main>;
}
