import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Copy, Download, Layers, RotateCcw, Sparkles, Wand2 } from 'lucide-react';

/* ═══ 媒体板块页（图片 / 视频共用一个页面）═══════════════════════════════════════
   做法参照竞品实测：**一个页面按 ?id= 渲染全部技能**（他们也是 /image-creation?id=<skillId>），
   而不是"一个技能一个页面文件" —— 这是能不能批量做到 40+ 个技能的前提。
   表达是我们自己的：分组、卡片、文案、配色全部来自声明源与 --sb-* token。

   三个视图：
     · 无 ?id=            → Hub（分组 + 案例卡网格）
     · 有 ?id= 且是轻技能 → Skill 工作台，**就地生成**（单图链路 /api/canvas/regenerate）
     · 有 ?id= 且是重技能 → Skill 工作台，带着配置回到既有重流程（套图编排 / 小红书图文）
   运行态复用既有模型（pages/Home/visualCreationModel.js 的 run/slot），
   所以「进度 / 只重试失败项 / 存作品」的行为与自由创作完全一致，不另造一套。 */
import { useApp } from '../../store/AppContext';
/* 批 J-⑭：预览型技能要"先预览、确认后再生成"，用全站统一的对话框承载预览体。 */
/* 批 K-C：图片侧「预览」= 三步方案预览（与视频侧「代为撰写」共用同一份组件与同一条服务端流水线） */
import PlanPreviewDialog from '../../components/plan-preview/PlanPreviewDialog.jsx';
/* 批 Q：「生成预览」按钮上要写**预览这一步**的价格（0.5 积分/次，SKU ec_plan_preview），
   不是整单出图的报价 —— 用户批注 #3-6。价格常量与服务端 catalog 同源（写在 planPreview.js）。 */
import { PLAN_PREVIEW_POINTS } from '../../services/planPreview.js';
import { usePlanLeaveGuard } from '../../components/plan-preview/usePlanLeaveGuard.js';
import MediaHub from '../Home/MediaHub.jsx';
import SkillWorkbench from '../Home/SkillWorkbench.jsx';
/* 小红书图文与视频这两条链路各自已有**跑通的完整工作台**（分步确认 / 方案弹窗 / 任务轮询）。
   子页面的做法不是重写一遍，而是把那个组件整块嵌进来（用户 9-17：「不必生成完就跳进去画布」）。 */
import XhsContentMode from '../Home/XhsContentMode.jsx';
import VideoStudioPage from '../VideoStudio/index.jsx';
import { contentResultPages, isContentResult } from '../Home/contentResultModel.js';
/* 套图的交付清单必须与**方案真源**同源（IMAGE_TYPES 的标签 + resolveEcommercePlan 算出的张数），
   否则会出现"示例里写着 5 样、实际只交付 3 样"这种自相矛盾（计价按张数走，写错就是钱的问题）。 */
import { IMAGE_TYPES } from '../Home/ec/ecommercePlanModel.js';
import { videoJobsOfSkill } from '../VideoStudio/videoJobTags.js';
/* 批 CE：视频任务的输入素材 → 创作台形状（纯函数，门禁能直接跑） */
import { videoJobMaterials } from '../VideoStudio/videoMaterialsModel.js';
import { EXPIRED_NOTE, downloadFileName, isExpiredWork, videoStatusLabel } from '../Home/mediaHistoryModel.js';
/* 批 DC（M3）：版式层（客户端确定性拼版 —— 纯几何 + canvas，不调模型、不计费）
   批 DC 续-3：扩到四族（宫格/底片条/宝丽来画中画/品牌信息图），并给"不拼版"这个中性档、
   信息图的三种排法与用户自己写的文案各留了入口（判据都在 conceptLayoutSheet 里）。 */
import {
  LAYOUT_INFO_DEFAULT_TEMPLATE,
  LAYOUT_INFO_TEMPLATES,
  isLayoutNONE,
  layoutFamilies,
  layoutFamilyOptions,
  layoutSheetBlob,
  layoutSheetFileName,
  layoutSheetPlan,
} from '../Home/conceptLayoutSheet.js';
/* 批 CD：存到我的资产（自动建/复用「生成作品」项目 + 注册 + 入库，幂等） */
import { saveGeneratedUrlsToAssets } from '../Home/saveWorkToAssets.js';
import { getImageSkill } from '../../skills/imageSkills.js';
/* 批 BP-3：首页案例区「做同款」→ 落到哪条技能 + 预填什么，判断收在那一个纯函数模块里 */
import { remixSeedValuesOf, remixSkillIdOf } from '../Home/galleryRemixTarget.js';
/* 批 Q-⑨：app 页要在左栏只显示一个「参数配置」组头 —— 判据来自对照表本身 */
import { isQuantvAppPage } from '../../skills/quantvImageParity.js';
import { getVideoSkill, videoSkillPlanOf } from '../../skills/videoSkills.js';
import { getVideoWorkbench } from '../../skills/videoWorkbenches.js';
/* 批 S：视频子页面的「参数配置」组头照知渔逐页计数决定 —— 判据同样来自对照表 */
import { quantvVideoShowsParamGroup } from '../../skills/quantvVideoParity.js';
import { boardOfPage, canCarryResultAsInput, fuseActionsOf, hubPath, skillPath as skillDeepLink } from '../../skills/skillDirectory.js';
import {
  clearPendingRun,
  hasUnsettled,
  readPendingRun,
  savePendingRun,
} from '../../skills/pendingRunStore.js';
import {
  SKILL_MODULES_PRESET_KEY,
  buildSkillBrief,
  buildSkillCopyRequest,
  buildSkillRequest,
  buildSuiteRun,
  initialSkillValues,
  reconcileFieldValues,
  skillBatchQuote,
  skillCopyShouldRun,
  skillEmbedOf,
  skillInitialModuleOff,
  skillPieceMark,
  skillRunKind,
  skillShotValues,
  skillValuesForShot,
  skillVideoMode,
  skillGenerationSettings,
  skillPointsEstimate,
  validateSkillInput,
} from '../../skills/skillRun.js';
import {
  buildVisualWorkRecord,
  createVisualRun,
  updateVisualRunSlot,
  visualRetryIndexes,
  visualRunIsBusy,
} from '../Home/visualCreationModel.js';
import {
  autoRecognizeEcommerce,
  polishECText,
  buildCanvasGenerationBody,
  createLivePhotoClip,
  fetchLivePhotoOffer,
  fetchLivePhotoStatus,
  generateEcommerce,
  recoverCanvasGeneration,
  regenerateCanvasImage,
  deleteWork,
  saveWork,
  uploadEcommerceAsset,
} from '../../services/api';
/* ⚠️ 上面那段 import 里**不许写注释**：`scripts/verify-exports.mjs` 用正则扫这段，
   注释文字会被当成一个"被导入的符号"，构建直接判红（本批实测踩过一次）。
   `uploadEcommerceAsset` 是批 DC（M3）加的：拼版成品图要留档时，先经既有上传链路落成稳定素材。 */
import { quoteBillingAction } from '../../services/billing.js';
/* 「做成动图」要的那一样既有能力：点之前的计费确认框（与 NoteModal 的「重新生成这张图片？」同一口径）。
   ⚠️ 查任务状态的那一个（曾从 services/video.js 引 getVideoJob）**已在 2026-09-28 批 CY-2 撤掉**：
      视频任务口挂的是 `video_generation` 权限，而这一页归 `ecommerce_image` —— 两把锁不同，
      只开电商生图的账号会"钱花了却查不到自己的动图"。现在状态查这一档自己的口
      （services/api.js 的 fetchLivePhotoStatus，同一条 GET + ?jobId=）。
   ⚠️ 注释写在 import **外面**：verify-exports 用正则扫 import 块，块内注释会被当成导入的符号。 */
import { useDialog } from '../../components/ui/DialogProvider.jsx';
/* 「代写这一篇的文案」（2026-09-28 批 DC 续-6）：价格来自目录（CONCEPT_COPY_POINTS），
   生成走先报价 → 确认 → 请求的同一条链（失败不扣）。风格语法（句式库/判重）在服务端。 */
import { CONCEPT_COPY_POINTS, generateConceptCopy } from '../../services/conceptCopy.js';
import { handleGenerationAccessError } from '../../utils/generationAccess.js';
import { useWorksSync } from '../../store/useWorksSync.js';
import '../Home/MediaHub.css';
import '../Home/SkillWorkbench.css';
import './MediaCreation.css';

/* 服务端 /api/ecommerce/auto-recognize 把风格归一成这 5 个 key（见 server/index.mjs 的 STYLE_MAP），
   这里做**唯一的反查**：key → 界面上给用户看的中文名。
   ⚠️ 两处必须同步改：服务端 STYLE_MAP 加档时，这里要跟着加，否则会出现"分析成功但没名字"。 */
const STYLE_SKILL_LABEL = Object.freeze({
  premium_minimal: '高级极简',
  lifestyle_scene: '生活场景',
  fashion_editorial: '时尚杂志',
  warm_natural: '自然暖调',
  tech_precision: '科技精工',
});

/* 板块 ↔ 总页面 的对应只有 skillDirectory 一份（首页热门条、Hub、工作台共用） */
const BOARD_BY_PAGE = { 'image-creation': 'image', 'video-creation': 'video' };

/* ⚠️ 这一张表现在是**兜底**，当前没有任何技能会走到它：
   小红书图文与视频都已改成 embed（把既有工作台整块嵌进本页，结果与历史都留在本页）。
   保留它是为了"既跑不完、又没有组件可嵌"的将来 —— 那时宁可老实把人送去对应工作台，
   也不要在这里做个半成品。判据见 skillRun.skillRunKind 的注释。 */
const HANDOFF_BY_PIPELINE = {
  ecommerceSuite: { mode: 'ecommerce', recipeId: 'product_suite' },
  xhsNote: { mode: 'content', subMode: 'content' },
  videoSmart: { mode: 'video' },
  videoFrame: { mode: 'video' },
  videoRemake: { mode: 'video' },
  videoReference: { mode: 'video' },
};
const HANDOFF_LABEL = { ecommerceSuite: '去套图工作台', xhsNote: '去图文工作台' };
const VIDEO_HANDOFF_LABEL = '去视频工作台';
/* ═══ 「做成动图」挂在哪条技能上（2026-09-27 批 DC-4）══════════════════════════════════════════
   用户口径：「**动图选 A 吧**」—— A 就是"工作台里对**已生成的那张**给一颗「做成动图」"，
   而那个工作台指的是**概念视觉方案**（docs/design/90 §7.2 的 M4 就是照这条写的）。
   ⚠️ 所以这一颗只长在概念视觉方案的结果区：它不是通用能力（别的技能的结果图没有"一条 shoot 的
      成套感"这个前提，硬塞进去等于给所有结果都加一个付费按钮）。 */
const LIVE_PHOTO_SKILL_ID = 'image.concept_set';
/* 轮询节奏：上游 5 秒档实测约 2~3 分钟出片（台账里的真实出片记录是 156 秒），
   所以 5 秒问一次、最多问 90 次（7.5 分钟）—— 超了就如实说"还在做，去任务记录看"，
   绝不假装失败（任务链路上它还在跑，回来还会退或结算）。 */
const LIVE_PHOTO_POLL_MS = 5000;
const LIVE_PHOTO_POLL_MAX = 90;

const VISUAL_SKILL_IDS = {
  /* ⚠️ 2026-09-23 批 AB：`image.free`（自由创作）已按用户指令下架，这里那条映射一并删除。
     自由创作**这条链路本身还在**（首页的 visualCreation 模式是页面级模式，不是这张技能卡），
     所以删掉的只是"某条 skill 深链到 free 视觉模式"这一个入口。 */
  'image.poster': 'poster',
  'image.social_cover': 'social-cover',
  'image.brand_kv': 'brand-kv',
};

function skillFromUrl(board) {
  const params = new URLSearchParams(window.location.search);
  const id = (params.get('id') || '').trim();
  if (!id) return '';
  return board === 'video' ? (getVideoSkill(id) ? id : '') : (getImageSkill(id) ? id : '');
}

/* 历史条目上的时间：同一条技能会生成很多次，只写技能名根本分不清哪次是哪次 */
function formatWorkTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = number => String(number).padStart(2, '0');
  return pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
}

/* ═══ 批 BZ：视频任务的**状态标签**（卡片左上角那枚遮罩标签）与下载文件名 ═════════════════════
   用户问：「他们是不是也得有一个遮罩的标签这样？那这个标签应该备注是什么呢？」
   实现与口径都在 `../Home/mediaHistoryModel.js`（纯函数，门禁能直接跑）。 */
/* 历史操作③：下载（批 BZ）——见下方 downloadHistory */

/* 批 CE：视频任务的输入素材 → 创作台能吃的形状 —— 纯函数收在 VideoStudio/videoMaterialsModel.js
   （`.jsx` node 直接 import 会报扩展名错，而这件事必须有门禁真跑）。 */

/* 错误就近显示：把人话放在 CTA 上方，而不是弹一个转瞬即逝的 Toast */
function friendlyError(error) {
  const message = String((error && error.message) || '').trim();
  if (!message) return '生成失败，请重试';
  if (/abort/i.test(message)) return '';
  return message;
}

function RunPanel({ run, skillName, onRetry, onDownload, busy, fuseActions = [], onFuse, sheet = null, livePhoto = null, postCopy = null, onSendToCanvas = null }) {
  if (!run) return null;
  const done = run.slots.filter(slot => slot.status === 'completed' && slot.url);
  const failed = visualRetryIndexes(run);
  const finished = !visualRunIsBusy(run);
  /* ═══ 结果区的「下一步」：辅助能力长在这里，而不是单独占一张卡 ═══════════════════
     用户 9-17 口径：「有些 skill 其实是辅助作用的……融合在一些主 skill 里面」。
     所以刚出一张图时，把**主技能的下游动作**直接摆在这一排（照这张图提升质感 / 再来一张相似的）。
     ⚠️ 点它**只把这张结果带过去、绝不生成**（不扣费）—— 与"没有用户确认绝不扣费"一致：
        用户到了下一条链路还会再点一次「立即生成」，那一次才计费。
     ⚠️ 地址读不回来就不显示（canCarryResultAsInput 对着服务端白名单判）——
        宁可少一个按钮，也不许用户点了之后撞"图片地址无效"。 */
  const carryUrl = done.length ? String(done[0].url || '') : '';
  const usable = finished && carryUrl && canCarryResultAsInput(carryUrl)
    ? fuseActions.filter(action => action && action.skillId)
    : [];
  return (
    <section className="media-run" aria-live="polite">
      <header className="media-run-head">
        <strong>{busy ? '正在生成…' : (done.length ? skillName + ' · 本次结果' : '生成未完成')}</strong>
        <span>{done.length}/{run.slots.length} 张</span>
      </header>
      <div className="media-run-grid">
        {run.slots.map((slot, index) => {
          /* ═══ 2026-09-27 批 DC-4：「做成动图」**逐张**长在这一张图下面 ═════════════════════════
             用户口径：「**动图选 A 吧**」—— 对**已生成的那张**给一颗。所以：
               · 只有这张真出了图（slot.url）才出现这颗按钮（没有图 = 没有可动的东西）；
               · 正在做的时候说清"做好之前不会扣积分"；做完了就在原地给**下载**；
               · 失败**就近说明**（这一张下面那行 role="alert"，不是转瞬即逝的 toast），并写清没扣积分。 */
          const clip = livePhoto?.states?.[index] || null;
          /* ⚠️ `!clip?.jobId`：只要这一张**已经建过单**（不管当时是超时还是查不到），就只给
             「再看一眼」，不再给「做成动图」—— 否则按钮上写着"扣 15 积分"，点下去其实命中的是
             幂等回放（服务端按"属主+产品+这张图"派生同一个键），文案与实际不符；
             更要紧的是"同一张图两条任务"这种误会不该由用户去猜。 */
          const canMake = finished && Boolean(slot.url) && Boolean(livePhoto?.offer)
            && !clip?.jobId && clip?.status !== 'working' && clip?.status !== 'pending' && !clip?.url;
          return (
            <div className="media-run-slot" key={slot.id} data-status={slot.status} data-live-photo={clip?.status || ''}>
              {slot.url
                ? <img src={slot.url} alt={skillName + ' ' + (index + 1)} loading="lazy" />
                : <span className="media-run-placeholder">{slot.status === 'failed' ? '失败' : (busy ? '生成中' : '待生成')}</span>}
              {slot.error && <p className="media-run-error" role="alert">{slot.error}</p>}
              {clip?.status === 'working' && (
                <p className="media-run-live-note">正在做成动图…（通常 1~3 分钟，做好之前不会扣积分）</p>
              )}
              {clip?.note && <p className="media-run-live-note" role="alert">{clip.note}</p>}
              {clip?.url && (
                <div className="media-run-live-clip">
                  <video src={clip.url} controls muted loop playsInline preload="metadata" aria-label="动图成片" />
                  <button type="button" className="media-run-live-download" onClick={() => livePhoto.onDownload?.(index)}>
                    <Download size={14} />下载这张动图
                  </button>
                </div>
              )}
              {/* ═══ 「再看一眼」（2026-09-28 批 CY-2）═══════════════════════════════════════════
                  上游比预期慢（超时）或中途查不到进度时，取回成片的入口**就留在这一张下面** ——
                  不把用户推去「任务记录」：那个入口挂的是另一个权限（video_generation），
                  只开了电商生图的账号进不去，等于"钱花了却没有任何地方能取回"。
                  ⚠️ 这一颗只读状态，**不再建单、不再冻结**（钱在第一次点击时就定下了）。 */}
              {clip?.jobId && (clip.status === 'pending' || clip.status === 'failed') && (
                <button type="button" className="media-run-live-recheck" onClick={() => livePhoto.onRecheck?.(index)}>
                  <RotateCcw size={14} />再看一眼
                </button>
              )}
              {canMake && (
                <button type="button" className="media-run-live-make" onClick={() => livePhoto.onMake?.(index)}>
                  <Sparkles size={14} />做成动图 · {livePhoto.offer.points} 积分
                </button>
              )}
              {/* ═══ 2026-09-28 批 CY-⑩（CV-2 第 2 步·反向）：**逐张「送到画布」**══════════════════════
                  用户拍板：「画布↔子页面的入口位置，可以，你做吧」（docs/design/89 §5 第 2 步）。
                  为什么长在**这一张下面**（而不是 CTA 旁边另立一个主入口）：
                    · 它和「做成动图」是同一类东西 —— **对着这一张成品的下一步动作**，
                      站内已有先例（批 DC-4 把「做成动图」也放在这一张下面），照同一格排下去即可；
                    · 用户历史上反复点名"一个页面只能有一个主入口"，主 CTA 那一块一个字不动。
                  为什么只给**成品**：没 url 的占位/失败项送到画布就是空壳节点（铁律：不摆假东西）。 */}
              {finished && Boolean(slot.url) && onSendToCanvas && (
                <button type="button" className="media-run-send-canvas" onClick={() => onSendToCanvas(index)}>
                  <Layers size={14} />送到画布
                </button>
              )}
            </div>
          );
        })}
      </div>
      {finished && failed.length > 0 && (
        <div className="media-run-actions">
          <p className="media-run-hint" role="alert">
            <AlertCircle size={14} />{failed.length} 张没生成成功，可以只重试这几张（成功的不会重跑，也不会重复扣费）
          </p>
          <button type="button" className="media-run-retry" onClick={onRetry}><RotateCcw size={14} />只重试失败项</button>
        </div>
      )}
      {finished && done.length > 0 && (
        <div className="media-run-actions">
          <a className="media-run-download" href={done[0].url} target="_blank" rel="noreferrer" download><Download size={14} />下载第一张</a>
          <button type="button" className="media-run-again" onClick={onDownload}><Sparkles size={14} />重新生成一组</button>
        </div>
      )}
      {/* ═══ 「代写这一篇的文案」（2026-09-28 批 DC 续-6）══════════════════════════════════════
          用户口径（逐字）：「文案这块怎么办呢……我们要**避免文案千篇一律**，但是也要**成功模仿他们的
          风格**」。架构 = 分开生成、共享上下文（文案是发布层，图里没有字 —— 他的 402 张也如此）。
          风格语法（句式库/密度/判重/纪律复核）**全在服务端**，这里只负责"看得见、改得动、拿得走"：
          标题三选一、正文与标签可编辑、一键复制、再来一版（再来一版是新动作，确认框里写明扣多少）。
          ⚠️ 它要花钱（0.5 积分/次），所以按钮上写价、点前确认 —— 与「做成动图」同一条铁律。 */}
      {finished && postCopy && (
        <div className="media-run-copy">
          <div className="media-run-copy-head">
            <span className="media-run-copy-lead">
              {postCopy.state?.status === 'ready' ? '这一篇的发布文案（挑一个标题，正文与标签可以改）' : '发布文案'}
            </span>
            <button
              type="button"
              className="media-run-copy-write"
              disabled={postCopy.busy}
              onClick={() => postCopy.onWrite?.()}
            >
              <Sparkles size={14} />
              {postCopy.busy ? '正在写…' : (postCopy.state?.status === 'ready' ? '再来一版 · ' + postCopy.points + ' 积分' : '代写这一篇的文案 · ' + postCopy.points + ' 积分')}
            </button>
          </div>
          {postCopy.state?.note && <p className="media-run-copy-note" role="alert">{postCopy.state.note}</p>}
          {postCopy.state?.status === 'ready' && (
            <>
              <ul className="media-run-copy-titles">
                {(postCopy.state.titles || []).map((title, index) => (
                  <li key={index}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={Number(postCopy.state.picked) === index}
                      className={'media-run-copy-title' + (Number(postCopy.state.picked) === index ? ' is-active' : '')}
                      onClick={() => postCopy.onPick?.(index)}
                    >{title}</button>
                  </li>
                ))}
              </ul>
              <textarea
                className="media-run-copy-body"
                rows={7}
                maxLength={600}
                value={postCopy.state.body || ''}
                aria-label="正文（可编辑）"
                onChange={event => postCopy.onEdit?.('body', event.target.value)}
              />
              <input
                type="text"
                className="media-run-copy-tags"
                maxLength={240}
                value={postCopy.state.tags || ''}
                aria-label="话题标签（可编辑，空格分隔，不带 # ）"
                placeholder="话题标签（空格分隔，粘贴时会自己加 # ）"
                onChange={event => postCopy.onEdit?.('tags', event.target.value)}
              />
              <div className="media-run-actions">
                <button type="button" className="media-run-copy-all" onClick={() => postCopy.onCopyAll?.()}>
                  <Copy size={14} />复制标题 + 正文 + 标签
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {/* ═══ 版式层（客户端确定性拼版）══════════════════════════════════════════════════════════
          实测：拼版 60/402（14.9%）分布在 36/41 篇（87.8%），而我们现在只会一张一张出成品图 ——
          这是"像不像他"的最大差距（docs/design/90 §六-2）。
          ⚠️ 先出单图再拼：**绝不让模型一次画一整张九宫格**（分格线会画歪、格内内容互相渗透）。
          ⚠️ 这一步**免费**：纯 canvas 几何，不调模型、不计费（所以按钮上不写积分）。
          ⚠️ 2026-09-28 批 DC 续-3：**四族齐备 + 「不拼版」是中性档**（用户原话：「版式族为什么
             一定要选呢，只有两个选项呀，是必须选吗」）。所以这一段现在：① 入口常在（选族可写回）、
             ② 信息图多一个三种排法的选择、③ 文案由用户自己写（我们不许替他编品牌文案）。 */}
      {finished && sheet?.available && (
        <div className="media-run-sheet">
          {/* ═══ 2026-09-28 批 DC 续-7：内部分析**搬到结果区**（用户批注图2-②，原话）══════════════
              「这些你在你的输出结果这里告诉我就可以了，**不要在线上把这些文字打出来啊**」
              改前那两句（「实测他 85% 的图都是单图」「（他的第二大族）」）长在**选版式族的卡片上** ——
              那是**我们的话**（拿竞品做的分析），用户在"我要不要拼版"的当场看到只会莫名其妙。
              ⇒ 卡片 hint 只讲这一族长什么样（见 CONCEPT_LAYOUT_FAMILIES）；
                这条实测结论落在下面这一行：**看完这一篇的图、决定拼不拼的那一刻**，才是它该出现的地方。 */}
          <p className="media-run-sheet-analysis">
            顺带一句内部参照：把对标账号 402 张图逐张看过，只有 60 张（14.9%）是拼版，
            85% 是单图 —— 所以默认给你「不拼版」，想拼随时在这一行换一族，免费的。
          </p>
          <div className="media-run-sheet-pick">
            <span className="media-run-sheet-lead">
              {sheet.url
                ? '这一篇拼出来是这样（换一种版式就重拼一次，不额外扣积分）'
                : (sheet.isNone
                  ? '这一篇现在是「不拼版」（每张独立成图）。想拼成一张，选一个版式族：'
                  : '这一篇的 ' + sheet.count + ' 张可以按「' + sheet.family + '」拼成一张成品图（不额外扣积分）')}
            </span>
            <span className="media-run-sheet-families" role="radiogroup" aria-label="版式族">
              {(sheet.familyOptions || []).map(option => <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={String(sheet.family) === String(option.value)}
                className={'media-run-sheet-family' + (String(sheet.family) === String(option.value) ? ' is-active' : '')}
                title={option.hint || ''}
                onClick={() => sheet.onPickFamily?.(option.value)}
              >{option.label}</button>)}
            </span>
          </div>
          {/* 信息图：三种实测排法（左图右文 / 词典卡 / 大字色块） */}
          {sheet.family === '品牌信息图' && (
            <span className="media-run-sheet-templates" role="radiogroup" aria-label="信息图排法">
              {(sheet.templates || []).map(option => <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={String(sheet.template) === String(option.value)}
                className={'media-run-sheet-template' + (String(sheet.template) === String(option.value) ? ' is-active' : '')}
                title={option.hint || ''}
                onClick={() => sheet.onPickTemplate?.(option.value)}
              >{option.label}</button>)}
            </span>
          )}
          {/* 文案：**用户自己写**（实测那些版式页上的字是品牌方的话，我们不替他编、也不送进模型） */}
          {sheet.needsCopy && (
            <div className="media-run-sheet-copy">
              <input
                type="text"
                className="media-run-sheet-copy-headline"
                maxLength={60}
                value={sheet.copy?.headline || ''}
                placeholder={sheet.family === '宝丽来画中画' ? '相纸下方那一行短句（可留空）' : '标题（可留空，例如母体名）'}
                onChange={event => sheet.onCopyChange?.('headline', event.target.value)}
                aria-label="版式文案标题"
              />
              {sheet.family === '品牌信息图' && <textarea
                rows={3}
                className="media-run-sheet-copy-body"
                maxLength={240}
                value={sheet.copy?.body || ''}
                placeholder="正文（可留空）：一两句英文或中文，例如「A quiet morning, kept in amber.」"
                onChange={event => sheet.onCopyChange?.('body', event.target.value)}
                aria-label="版式文案正文"
              />}
            </div>
          )}
          {sheet.url
            ? (
              <div className="media-run-sheet-result">
                <img src={sheet.url} alt={(sheet.family + (sheet.template ? ' · ' + sheet.template : '')) + '拼版成品图'} />
                <div className="media-run-actions">
                  <button type="button" className="media-run-sheet-download" onClick={() => sheet.onDownload?.()}>
                    <Download size={14} />下载这张拼版
                  </button>
                  <button type="button" className="media-run-sheet-save" disabled={sheet.saving} onClick={() => sheet.onSaveAssets?.()}>
                    {sheet.saving ? '存入中…' : '存到我的资产'}
                  </button>
                  <button type="button" className="media-run-sheet-again" disabled={sheet.busy} onClick={() => sheet.onCompose?.()}>
                    重新拼一次
                  </button>
                </div>
              </div>
            )
            : (
              <div className="media-run-actions">
                <button
                  type="button"
                  className="media-run-sheet-compose"
                  disabled={sheet.busy || !sheet.canCompose}
                  onClick={() => sheet.onCompose?.()}
                >
                  {sheet.busy ? '正在拼版…' : (sheet.canCompose ? '拼成一张成品图' : '这一篇至少要有 2 张才能拼')}
                </button>
              </div>
            )}
        </div>
      )}
      {usable.length > 0 && (
        <div className="media-run-next" aria-label="下一步可以">
          <span className="media-run-next-label">拿这张图接着做</span>
          {usable.map(action => (
            <button
              key={action.skillId}
              type="button"
              className="media-run-next-btn"
              title={action.note || ''}
              onClick={() => onFuse?.(action, carryUrl)}
            >
              <Wand2 size={14} />{action.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/* ═══ 批 K-C：三步方案预览要用的三个取值器 ═══════════════════════════════════════════════
   为什么写在组件外：它们是纯函数，而且**不能**再往组件里加 hook（这个文件的提前返回踩过雷）。 */
export function collectPlanMaterials(values, skill) {
  const out = [];
  for (const field of (skill?.fields || []).filter(item => item.kind === 'upload')) {
    const items = Array.isArray(values?.[field.key]) ? values[field.key] : [];
    for (const item of items) {
      if (!item || item.status !== 'ready') continue;
      out.push({
        id: String(item.assetId || item.url || (field.key + '-' + out.length)),
        name: String(item.name || field.label || '素材'),
        url: String(item.url || ''),
        previewUrl: String(item.previewUrl || ''),
      });
      if (out.length >= 6) return out;
    }
  }
  return out;
}

/* 需求正文 = 用户在这条技能里填的所有文字字段（规格类不进，它们不是"需求"）。 */
export function collectPlanPrompt(values, skill) {
  const rows = [];
  for (const field of skill?.fields || []) {
    if (field.kind === 'upload') continue;
    if (['imageModel', 'resolution', 'ratio', 'count'].includes(field.key)) continue;
    const value = values?.[field.key];
    if (typeof value !== 'string' || !value.trim()) continue;
    rows.push((field.label || field.key) + '：' + value.trim());
  }
  return rows.join('\n').slice(0, 1500);
}

/* 「确认并应用」写回哪个字段：优先多行文本位，其次名字像需求的，最后兜底第一个非上传字段。 */
export function planPreviewTargetKey(skill) {
  const fields = (skill?.fields || []).filter(field => field.kind !== 'upload');
  const textarea = fields.find(field => field.kind === 'textarea');
  if (textarea) return textarea.key;
  const preferred = fields.find(field => /prompt|desc|require|content|brief|文案|描述|需求/i.test(String(field.key)));
  return String((preferred || fields[0])?.key || '');
}

export default function MediaCreationPage({ onSubpageHeader = null }) {
  const { state, dispatch, refreshBillingBalance } = useApp();
  const board = boardOfPage(state.page);
  const basePath = hubPath(board);
  const [skillId, setSkillId] = useState(() => skillFromUrl(board));
  const [values, setValues] = useState({});
  const [run, setRun] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  /* 视频：嵌进来的工作台把服务端的任务列表回传上来，本页据此渲染「历史」页签 */
  const [videoJobs, setVideoJobs] = useState([]);
  /* 视频：历史里点「用这组参数」→ 还原到创作台。nonce 让"再点同一条"也能重新生效。 */
  const [videoSeed, setVideoSeed] = useState(null);
  const [videoSeedNonce, setVideoSeedNonce] = useState(0);
  const runRef = useRef(null);
  const abortRef = useRef(null);

  /* 历史要能跨刷新存活：作品列表在这里同步（与首页同一份实现） */
  useWorksSync();

  /* ═══ 地址栏是技能的唯一真源（两个总页面共用一个组件）══════════════════════════
     ⚠️ 这里踩过一个真的会让人以为"功能没做"的坑：
        图片页与视频页**是同一个组件**（App 的 pageMap 两处指向 MediaCreationPage，
        key 还是 _workVersion 而不是 page），所以从一个板块跳到另一个板块时组件**不会重挂载**，
        skillId 状态会停在上一块的值。于是出现：地址栏已经是 /video-creation?id=video.smart，
        页面却显示视频 Hub（因为 getVideoSkill('image.poster') 找不到 → skill 为空 → 渲染 Hub），
        而且没有"返回创作"可点 —— 用户只会说"点了没反应"。
     三件事一起做才治得住：
       ① 地址栏变化（含一级导航手动派发的 popstate）→ 重读；
       ② **板块变化**（跨板块跳转）→ 重读（此时 board 才是新的，skillFromUrl 才能查对声明源）；
       ③ 地址栏里的 id 若不属于当前板块（脏链接/技能下线）→ 把地址栏改回 Hub，
          不留"URL 说是海报、页面却是 Hub"这种自相矛盾的状态。 */
  useEffect(() => {
    const sync = () => setSkillId(skillFromUrl(board));
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [board]);

  useEffect(() => {
    setSkillId(skillFromUrl(board));
  }, [board]);

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('id') || '';
    if (!raw) return;
    /* ⚠️ 判据取自**地址栏**而不是 skillId 状态：同一次提交里 setSkillId 还没生效，
       用状态判会把刚刚跳进来的合法深链当成脏链接改掉。 */
    const known = board === 'video' ? getVideoSkill(raw) : getImageSkill(raw);
    if (!known) window.history.replaceState({}, '', hubPath(board));
  }, [board]);

  /* 换技能 / 回 Hub 时清掉上一次的运行，避免"上一条技能的结果留在这一条上"。
     ⚠️ 融合动作（"拿这张图接着做"）会在同一次切换里留下一条提示，而那一次提示
        正是用户理解"刚才发生了什么、下一步该点哪"的唯一线索 —— 这里必须让它活过清理，
        否则用户只看到页面跳了、素材位多了张图，不知道为什么。 */
  const carryHintRef = useRef('');
  const [carryHint, setCarryHint] = useState('');
  useEffect(() => {
    runRef.current = null;
    setRun(null);
    setError('');
    setNotice('');
    setCarryHint(carryHintRef.current || '');
    carryHintRef.current = '';
  }, [board, skillId]);

  useEffect(() => () => { try { abortRef.current?.abort?.(); } catch { /* 卸载时忽略 */ } }, []);


  /* seed：融合动作把"上一步那张结果"带进来时用的初始素材位。
     ⚠️ 只写值、不触发生成 —— 扣费一律等用户再点「立即生成」。 */
  const openSkill = useCallback((id, seed = null) => {
    window.history.pushState({}, '', skillDeepLink({ id, board }));
    setSkillId(id);
    setValues(seed && typeof seed === 'object' ? seed : {});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [board]);

  const backToHub = useCallback(() => {
    window.history.pushState({}, '', basePath);
    setSkillId('');
    /* ⚠️ 批 CY-⑫：这里**不再** scrollTo(0) —— 归位统一由上面那个 effect 负责
       （有记录就回记录处、没记录就回 0）。留在这儿的 smooth 滚回顶部会和恢复动画打架：
       用户会先看到"跳到最上方"再被拉回来。 */
  }, [board]);

  const skill = useMemo(
    () => (skillId ? (board === 'video' ? getVideoSkill(skillId) : getImageSkill(skillId)) : null),
    [board, skillId],
  );

  /* ═══ 把子页面的「我是谁 / 返回去哪」交给顶栏（2026-09-19 批 H-8，用户批注 #12）══════
     子页面顶栏写定为「左 返回 / 中 名称 / 右 积分账户」；这三格里有两格的内容只有本页知道，
     所以由本页 publish 到 AppRouter，再由 TopBar 渲染。
     ⚠️ useLayoutEffect 而不是 useEffect：后者在**浏览器绘制之后**才跑，
        会先画一帧「LOGO 顶栏」再跳成「返回顶栏」—— 深链直接进子页面时这一帧很明显。
     ⚠️ 深链（/image-creation?id=xxx 直接打开）也必须 publish：那不是"没进子页面"，
        用户第一眼看到的就是这一页，顶栏同样得是返回 + 名称。
     ⚠️ 卸载/返回 Hub 时置 null：否则顶栏会留着上一条技能的名字（见 AppRouter 的 reset）。 */
  useLayoutEffect(() => {
    if (!onSubpageHeader) return undefined;
    if (!skill) { onSubpageHeader(null); return undefined; }
    onSubpageHeader({ name: skill.name, onBack: backToHub });
    return () => onSubpageHeader(null);
  }, [onSubpageHeader, skill, backToHub]);

  /* 运行方式（skillRun.skillRunKind）：inline 就地出图 / suite 套图 /
     embed 把既有工作台整块嵌进本页 / handoff 兜底（当前没有技能走这一态）。
     ⚠️ 这几行必须放在 skill 之后、所有用到它们的 useMemo 之前 ——
        依赖数组是在**渲染期**求值的，放在后面用就会 TDZ 崩整页（本项目已踩过两次）。 */
  const runKind = skill ? skillRunKind(skill) : 'inline';
  const suite = runKind === 'suite';
  const handoff = runKind === 'handoff';
  /* 'xhs' | 'video' | ''：嵌哪一块既有工作台 */
  const embed = runKind === 'embed' && skill ? skillEmbedOf(skill) : '';

  /* 生效值 = 声明源默认值 + 用户改动。校验、积分、下发参数一律基于它（与界面显示同源）。 */
  /* ═══ 包含模块：勾选真的生效（2026-09-19 批 I-9，用户批注 #10 / #3-2）═══════════════════
     用户原话：「这些按钮都是不能点击的，完全是死按钮……你连按钮都没法交互，
       那背后的生成逻辑肯定也是没打通的呀，要彻底的打通逻辑呀。」
     以及：「**选中多少个模块就是多少张**，并且对应他自己的模块主题不是吗，
       为什么要自己写多少张的数量呢？」
     所以这里把三件事接成一条链：
       勾选 → selectedModules → effectiveValues.count → 报价（skillPointsEstimate）
                                              → 出图循环（skillGenerationSettings.count）
     ⚠️ 接在 effectiveValues 上是**故意的**：报价、校验、下发请求三处早就都从它取数，
        注入这一个字段就等于三处同时生效，不需要在页面里各写一遍。 */
  /* ═══ 2026-09-24 批 AW：默认**一个都不勾**（用户原话：「包含模块跟他们一样做就好」）═══════════
     知渔实采那一块写的是「已选 **0/16**」（docs/design/data 里的 A+-内容页全文），
     而我们是 16/16 —— 用户看图后点名这一条：「而且好像他们也不是默认打勾的吧」，
     本轮拍板「**跟他们一样做就好**」。
     ⇒ 进页面时 `moduleOff` 就是**全部模块**；用户自己勾，勾几个出几张（报价跟着走）。
     ⚠️ 原来是"全都勾上、最后一个不许取消"（那时 0 张算不出报价）。现在 0 张是**合法起点**，
        所以那条"最后一个不许取消"的禁令一并删掉 —— 改由下面的 count 与校验如实拦住
        （见 effectiveValues 与 moduleGate）。 */
  const [moduleOff, setModuleOff] = useState(() => new Set());
  const skillModules = useMemo(() => (skill && Array.isArray(skill.modules) ? skill.modules : []), [skill]);
  useEffect(() => { setModuleOff(skillInitialModuleOff(skill, skillModules)); }, [skill?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const selectedModules = useMemo(
    () => skillModules.filter(module => !moduleOff.has(module.name)),
    [skillModules, moduleOff],
  );
  /* 勾了 0 个不是"没得选"，是一个**明确的未完成状态**：按钮禁用 + 说明缺什么。
     与其它必填项走同一条路（validation.missing），用户看到的是一句人话而不是灰按钮。 */
  /* ⚠️ 2026-09-27 批 DC：这句话可以让技能自己声明（`modulesGate`）—— 概念的清单是"手法"、
     套图/A+ 的清单是"内容模块"，用同一句话会说错东西。没声明的技能一个字不变。 */
  const moduleGate = skillModules.length > 0 && selectedModules.length === 0
    ? (String(skill?.modulesGate || '').trim() || '请先勾选要生成的内容模块')
    : '';
  /* ═══ 2026-09-25 批 BO：禁用原因说**人话**（用户批注，逐字）══════════════════════════════════
     用户原话：「你这个按钮这里为什么要写**还差图片**呢？你面向用户，难道可以用这种简单的描述吗？
     知鱼他们是怎么做的你知道吗？你为什么要用这种特别生硬的语气，特别简单的表达去向用户做这种
     表达呢？特别的奇怪啊。」
     知渔实测那句 = 「请先上传至少一张产品图片」⇒ 这里按**缺的那个字段的类型**给一句完整的话：
       · 上传位   → 请先{字段名}（至少 N 张）
       · 数字/张数 → 请先设置{字段名}（字段名里已带"至少 N 张"）
       · 文本位   → 请先填写{字段名}
     ⚠️ 句子里**必须保留字段名原文**：media-workbench-e2e 第①幕是阻塞判据
        （禁用原因要"点名缺的是哪个字段"）。改文案时别把字段名改掉。 */

  const baseValues = useMemo(() => {
    const base = skill ? { ...initialSkillValues(skill), ...values } : values;
    /* ⚠️ 原来这里是 Math.max(1, …) —— 那是"全选为默认"时代的兜底；现在 0 要如实传下去，
       否则会出现"界面写着 0 张、后台按 1 张跑"的账实不符。 */
    if (skillModules.length) return { ...base, count: selectedModules.length };
    return base;
  }, [skill, values, skillModules, selectedModules]);
  /* ═══ 2026-09-27 批 DC（M2）：「一篇」的把手法清单也放进生效值 ═══════════════════════════════
     勾中的那几种手法 → `effectiveValues.shots`（这一篇每一张的 {{shots}}）。
     ⚠️ 单独一层是**故意**的：上面那一行 `count: selectedModules.length` 是
        `workbench-quantv-parity-0918` ④ 逐字钉着的锚点（"勾选数 → 张数"的唯一入口），
        不能再往它后面塞东西；而报价/校验/下发三处都从 effectiveValues 取数，
        所以注入进它 = 三处同时生效，页面里不必各写一遍。 */
  const effectiveValues = useMemo(() => {
    const shots = skillShotValues(skill, selectedModules);
    const merged = shots.length ? { ...baseValues, shots } : baseValues;
    /* ⚠️ 批 DC（M2）：下发前再夹一次（声明里 `disabledWhen` 锁住的字段回到它自己的默认档）。
       面板里改字段时已经夹过（onFieldChange 的那条链），这一行管的是**带进来的旧值**那条路 ——
       历史还原 / 做同款 / 断线补跑，免得出现"界面锁着、请求里还带着旧方向"。 */
    return reconcileFieldValues(skill?.fields, merged);
  }, [skill, baseValues, selectedModules]);
  const validation = useMemo(() => (skill ? validateSkillInput(skill, effectiveValues) : { ok: false, missing: [] }), [skill, effectiveValues]);
  const gateHint = useMemo(() => {
    if (moduleGate) return moduleGate;
    if (handoff || validation.ok) return '';
    const first = validation.missing[0] || '';
    const field = (skill?.fields || []).find(item => item.label && first.startsWith(item.label));
    if (field?.kind === 'upload') {
      const verb = /^(上传|选择|添加|导入)/.test(field.label) ? '' : '上传';
      const min = Math.max(1, Number(field.min) || 1);
      return '请先' + verb + field.label + '（至少 ' + min + ' 张）';
    }
    if (field?.kind === 'counts') return '请先设置' + field.label;
    return '请先填写' + (first || '必填项');
  }, [handoff, moduleGate, skill, validation]);
  /* 套图按**套**计价：张数与报价必须来自与面板同一份方案计算（skillRun.buildSuiteRun） */
  const suiteRun = useMemo(() => (skill && suite ? buildSuiteRun(skill, effectiveValues) : null), [skill, suite, effectiveValues]);
  const points = useMemo(
    () => (suite ? (suiteRun?.points || 0) : (skill ? skillPointsEstimate(skill, effectiveValues) : 0)),
    [suite, suiteRun, skill, effectiveValues],
  );
  /* ═══ 2026-09-28 批 DC 续-7：文案**默认并进这一次出图**（用户 2026-09-28 当面定的口径）══════════
     用户原话：「如果你要产出的是一整套的小红书图文的话，那肯定是文案一起出的话会更加统一吧……
       很有可能你先去生成图片，然后再拿图片去生成文案，这样的话会很混乱。」
     ⇒ 默认开（一次下单 = N 张图 + 1 组文案，一个确认框、一个总价，两者并行发起）。
     这颗开关留给"我只想看图"的场合：关掉之后这一页一个字都不变（连确认框都不弹）。
     ⚠️ state 声明**放在这里**而不是文案结果区那一段：它要被下面的 batchQuote 与 CTA 读到，
        而那两处在它前面（同作用域里 const 用在声明之前 = TDZ，整个组件直接崩）。 */
  const [postCopyEnabled, setPostCopyEnabled] = useState(true);
  /* 「这一页支不支持顺带出文案」与「这一次要不要出」是**两件事**：
     开关关掉之后那颗开关本身**必须还在**（不然用户就再也开不回来了），
     所以这里先判支持、再判这一次。 */
  const copySupported = skill ? skillCopyShouldRun(skill, { ...effectiveValues, postCopyEnabled: true }) : false;
  const copyInBatch = copySupported && postCopyEnabled;
  /* ═══ 2026-09-28 批 DC 续-7：**这一篇的清单价与总额**（张数 × 单价 + 文案，价只有这一份算）══════
     用户原话：「因为**你这个工作台里面并没有给我张数呀**，我就根本就不知道你产出的到底是多少张？」
     ⇒ 按钮上不再是孤零零一个「12 积分」，而是「6 张 × 2 + 文案 0.5 = 12.5 积分」——
        张数、单价、总额一次说清（按张计价的页面必须这么写）。
        把文案那 0.5 关掉时，同一句话变成「6 张 × 2 = 12 积分」—— 还是说得清有几张、单价多少。 */
  const batchQuote = useMemo(
    () => (skill && copySupported
      ? skillBatchQuote(skill, effectiveValues, { copyPoints: copyInBatch ? CONCEPT_COPY_POINTS : 0 })
      : null),
    [skill, effectiveValues, copySupported, copyInBatch],
  );
  const busy = visualRunIsBusy(run);

  /* 这条主技能出完图以后，结果区该长出哪些辅助动作（声明源里的 fuses.slot === 'result'）。
     取法只有 skillDirectory.fuseActionsOf 一份 —— 页面不许自己写"哪些技能能接哪一步"。 */
  const fuseActions = useMemo(
    () => (skill && board ? fuseActionsOf(board, skill.id, 'result') : []),
    [board, skill],
  );

  /* 进行中的运行落盘：刷新/误关标签页之后还能把图找回来（出图是要花钱的，不能白丢） */
  useEffect(() => {
    if (!skill || !run) return;
    if (hasUnsettled(run)) savePendingRun(skill.id, { runId: run.id, startedAt: run.createdAt, values: effectiveValues, slots: run.slots });
    else clearPendingRun(skill.id);
  }, [skill, run, effectiveValues]);

  /* 回到页面时：如果上一轮还没等到结果，按**同一个请求体**去服务端把结果要回来。
     幂等键相同 → 服务端认得出是同一次请求 → **不会重复扣费**。 */
  useEffect(() => {
    if (!skill) return undefined;
    const saved = readPendingRun(skill.id);
    if (!saved || !hasUnsettled(saved)) { if (saved) clearPendingRun(skill.id); return undefined; }
    const restored = { id: saved.runId, createdAt: saved.startedAt, slots: saved.slots };
    runRef.current = restored;
    setRun(restored);
    setValues(prev => ({ ...saved.values, ...prev }));
    setNotice('上一次的生成还没结束，正在把结果找回来…');
    let active = true;
    const controller = new AbortController();
    abortRef.current = controller;
    const pendingIndexes = saved.slots.flatMap((slot, index) => (slot.status === 'pending' || slot.status === 'generating') ? [index] : []);
    Promise.all(pendingIndexes.map(async index => {
      /* ⚠️ 批 DC（M2）：恢复也必须**逐张收窄**（第 i 张用第 i 种手法）——
         否则补跑出来的图与前一次不是同一套（request_key 以外的提示词不一样）。
         saved.values 里存着整份 shots，收窄是纯函数，不额外存东西。 */
      const request = buildSkillRequest(skill, skillValuesForShot({ ...saved.values }, index), { runId: saved.runId, slotIndex: index });
      try {
        /* ⚠️ 必须用与生成时**同一个**构造器：request_key 是参数指纹的哈希，
           手拼一份"看起来一样"的请求体会导致指纹对不上、查不到任何结果。 */
        const { requestBody } = buildCanvasGenerationBody({
          prompt: request.prompt,
          imageUrl: request.imageUrl,
          referenceImages: request.referenceImages,
          references: request.references,
          ratio: request.ratio,
          resolution: request.resolution,
          imageModel: request.imageModel,
          requestKey: restored.slots[index]?.requestKey || (saved.runId + ':' + (index + 1)),
          creationIntent: 'visual',
          skillId: request.skillId,
        });
        const result = await recoverCanvasGeneration(requestBody, { signal: controller.signal });
        if (!active) return;
        const next = updateVisualRunSlot(runRef.current, index, { status: 'completed', url: result.url, taskId: result.taskId || '', error: '' });
        runRef.current = next;
        setRun(next);
      } catch (err) {
        if (!active) return;
        const next = updateVisualRunSlot(runRef.current, index, { status: 'failed', error: friendlyError(err) || '这次生成没有拿到结果，可以重试' });
        runRef.current = next;
        setRun(next);
      }
    })).then(() => {
      if (!active) return;
      setNotice('');
      const settled = runRef.current;
      if (settled && settled.slots.some(slot => slot.status === 'completed' && slot.url)) persistRun(settled);
    });
    return () => { active = false; try { controller.abort(); } catch { /* ignore */ } };
  }, [skill]);
  /* 历史 = 这条技能名下已保存的作品（saveWork 时写了 mediaSkillId，按它筛）。
     ⚠️ 作品列表由 useWorksSync 拉取 —— 少了这一步，刷新后历史永远是空的。 */
  const history = useMemo(() => {
    const works = Array.isArray(state.works) ? state.works : [];
    const fromWorks = works
      .filter(work => work && work.mediaSkillId === skill?.id)
      .map(work => {
        /* 小红书图文的作品不是「一组图」而是「一组图 + 标题正文」：
           图片在 cover_url / image_urls 里（contentResultModel 是唯一解析处），
           按 work.images 去读只会得到 0 张、然后被下面的 filter 静默丢掉。 */
        const content = isContentResult(work) ? contentResultPages(work) : [];
        const images = Array.isArray(work.images) ? work.images : (Array.isArray(work.imageRecords) ? work.imageRecords : []);
        const urls = content.length ? content.map(page => page.url) : images.map(image => image?.url).filter(Boolean);
        const time = formatWorkTime(work.createdAt || work.savedAt || work.created_at);
        const stamp = String(work.createdAt || work.savedAt || work.created_at || '');
        /* ═══ 批 CA：到期墓碑 ═══════════════════════════════════════════════════════════════
           服务端到期后不再整行删（留 `expired_at` + 清空媒体字段），这里渲染成**灰卡 + 已过期**：
           说明"东西去哪了"，并且**不给**还原/下载/看大图（文件已回收，给了就是坑）。 */
        const expired = isExpiredWork(work);
        return {
          id: String(work._saveKey || work.id || ''),
          saveKey: work._saveKey || work.id || '',
          title: String(work.title || skill?.name || ''),
          subtitle: expired
            ? ['已过期', time].filter(Boolean).join(' · ')
            : [urls.length ? urls.length + ' 张' : '', time].filter(Boolean).join(' · '),
          cover: expired ? '' : (urls[0] || ''),
          expired,
          expiredNote: expired ? EXPIRED_NOTE : '',
          /* 批 CB：按天分组要用到原始时间戳（`time` 是给人看的 `MM-DD HH:MM`，不能拿它算日期） */
          createdAt: stamp,
        /* 批 BZ：「下载」要下的是**这一组全部**（图片/图文都是多张），不是只下封面那张 */
        downloads: expired ? [] : urls,
        /* ═══ 批 DC（M2）：篇标记 —— 一次生成 = 一篇（历史里一篇一张卡，卡上写着它的手法清单）═══
           过期墓碑不给（面板值早清空了，给了就是"点回去是空的"）。 */
        piece: (!expired && work._piece && Array.isArray(work._piece.shots) && work._piece.shots.length)
          ? { id: String(work._piece.id || ''), shots: work._piece.shots.map(String), size: Number(work._piece.size) || work._piece.shots.length }
          : null,
          /* 「用这组参数」靠它还原面板：只认**这条技能自己**存下的参数；过期的记录不再给还原 */
          values: expired ? null : ((work.replay && work.replay.mediaSkillId === skill?.id && work.replay.panelValues) ? work.replay.panelValues : null),
          /* 图文没有"面板参数"可还原（它的输入就是一句话提示词）→ 还原提示词本身。
             这类记录因此也要能显示「用这组参数」按钮（判据见 SkillWorkbench）。 */
          restore: (!expired && isContentResult(work) && String(work._inputText || '').trim()) ? { prompt: String(work._inputText).trim() } : null,
        };
      })
      .filter(item => item.cover || item.expired);

    /* 视频：服务端任务列表按技能筛出本页这一份（标记只写在本机，见 videoJobTags）。
       ⚠️ 筛不出来**不代表任务没了** —— 它的结果仍然在「我的作品」里（用户口径：
          子页面生成的东西，一边进这条技能的历史、一边进我的作品）。 */
    const fromVideos = embed === 'video'
      ? videoJobsOfSkill(videoJobs, skill?.id).map(job => {
          const done = job.status === 'completed' && job.resultUrl;
          const seconds = Number(job.duration) || 0;
          /* ═══ 批 BZ：视频历史**也要有时间** ═══════════════════════════════════════════════
             用户口径：「它的**排版**，它的**时间**这些东西是不是也得加进去呢？」
             实测：图片那条副标题是 `N 张 · 时间`，视频那条只有 `秒数 · 分辨率 · 比例` —— 漏了时间。
             与其他记录同一口径（`formatWorkTime`），排在最后一位。 */
          const time = formatWorkTime(job.createdAt || job.created_at || job.updatedAt || '');
          return {
            id: String(job.id || ''),
            saveKey: String(job.id || ''),
            title: String(job.prompt || skill?.name || '视频任务').slice(0, 60),
            subtitle: [seconds ? seconds + ' 秒' : '', job.resolution || '', job.aspectRatio || job.aspect_ratio || '', time].filter(Boolean).join(' · '),
            createdAt: String(job.createdAt || job.created_at || job.updatedAt || ''),
            cover: '',
            /* 成片用 video 播放（CaseCard 支持），没出片就只留一行状态，不放一张空白封面 */
            video: done ? job.resultUrl : '',
            poster: '',
            /* 批 BZ：成片可下载（没出片就没有可下的东西，按钮也不会出现） */
            downloads: done ? [job.resultUrl] : [],
            /* ═══ 批 BZ：状态标签统一成**用户看得懂的中文**（与设计稿 86 的五个词一致）═══════════
               改前直接把服务端状态拼上去（`String(job.status)`）—— 界面会冒英文状态词。
               规矩：**正常不显示标签**（有成品就是干净的一张卡），只有"不正常"才说明情况。
               ⚠️ 映射表只有这几档；出现没见过的状态时按"生成中"兜底，但**不许原样透传英文**。 */
            badge: done ? '' : videoStatusLabel(job.status),
            /* 「用这组参数」还原创作台：任务记录里存着提示词与规格，全部可以还原 */
            restore: {
              videoJob: {
                prompt: String(job.prompt || ''),
                negativePrompt: String(job.negativePrompt || job.negative_prompt || ''),
                duration: seconds,
                ratio: String(job.aspectRatio || job.aspect_ratio || ''),
                resolution: String(job.resolution || ''),
                mode: skillVideoMode(skill) || 'smart',
                /* ═══ 批 CE：**素材也一起带回去**（用户口径：「把素材和提示词和配置都填回去工作台」）═══
                   服务端 `video_jobs.refs_json` 里一直存着那次任务的输入素材
                   （`{firstImage,lastImage,images:[id],videos:[id],audios:[id],urls:{id:url}}`），
                   这里把它翻成创作台能直接吃下的 `{id,url}` 形状（纯函数在 VideoStudio 里做归一）。
                   ⚠️ 没有 refs 的老任务就退回空集合（新老任务都不炸）。 */
                materials: videoJobMaterials(job.references),
              },
            },
          };
        })
      : [];
    return [...fromVideos, ...fromWorks];
  }, [skill, state.works, embed, videoJobs]);
  /* 运行方式（skillRun.skillRunKind）：inline 就地出图 / suite 套图 / handoff 回既有工作台。
     ⚠️ 这里必须显式区分：套图走的是**多张、按套计价**的引擎，
        若它掉进单图分支，会按 1 积分发一次单图请求 —— 既不是用户要的东西，也把计价搞错了。
        所以在套图就地跑通之前，它走 handoff（带着配置回既有套图工作台），绝不走单图。 */

  /* 交付清单：套图走方案算出来的真实清单；其它技能（A+/详情图/复刻）走声明源里的 deliverables。
     ⚠️ 竞品那套「包含模块」是**可勾选**的（勾几个就出几个、价钱跟着变）；
        我们的套图张数与报价由平台方案算死，**不能**照抄成可勾选 —— 那会让报价与产出对不上。
        所以这里只做**只读的交付说明**，如实告诉用户"这一套会交出哪几样、各几张"。 */
  const deliverables = useMemo(() => {
    if (!skill) return [];
    const declared = Array.isArray(skill.deliverables) ? skill.deliverables : [];
    /* ═══ 批 K-E：视频侧右栏与图片侧**结构对齐** ═══════════════════════════════════════════
       线上实测：图片子页面的「示例」页签给的是一份**编号交付清单**（01 白底主图 02 …），
       而视频子页面只剩一句「示例正在补充，先直接生成试试。」—— 同一条工作台两边结构不一样，
       这正是用户说的「视频生成这一块要跟图片生成这边是一样的」。
       视频技能的交付物本身是确定的（一条成片），如实写清即可；
       ⚠️ **不写死规格数字**（模型/清晰度/时长/比例都是用户在左边自己选的），
          免得写出一句与实际不符的话 —— 本站铁律：界面上每一句都得是真的会发生的事。 */
    if (!declared.length && embed === 'video') {
      /* ⚠️ 批 AM：本地方案（视频高清 / 视频字幕去除）**没有模型 / 时长 / 比例**这几样 ——
         它们处理的是你已经拍好的片子，规格只有"输出分辨率 / 帧率 / 擦除区域"。
         照抄上面那句会写出一句与实际不符的话（本站铁律：界面上每一句都得是真的会发生的事）。 */
      const localPlan = videoSkillPlanOf(skill.id);
      if (localPlan?.engine === 'local-render') {
        return [{
          name: '成片 × 1',
          hint: localPlan.userFields?.includes('regions')
            ? '在你上传的那条视频上按框选的区域擦除字幕，原声与其余画面原样保留'
            : '按你选的输出分辨率与帧率处理你上传的那条视频，原声与画面内容原样保留',
        }];
      }
      return [{ name: '成片 × 1', hint: '按你在左边选的模型、清晰度、时长与比例交付一条短视频' }];
    }
    if (!suite || !suiteRun?.plan?.images?.length) return declared;
    return suiteRun.plan.images.map(image => {
      const type = IMAGE_TYPES.find(item => item.key === image.key);
      const name = (type ? type.label : image.key) + ' × ' + (image.count || 1);
      const ratio = image.ratio ? image.ratio : (type ? type.defaultRatio : '');
      return { name, hint: [ratio, type ? type.desc : ''].filter(Boolean).join(' · ') };
    });
  }, [skill, suite, suiteRun, embed]);

  /* ═══ 左栏的只读清单块（照竞品「包含模块 已选 0/16」的形态）════════════════════════
     竞品那一块是**可勾选**的；我们的张数与报价由方案算死，所以只做只读展示 ——
     用户看到的是"这一套会交出哪几样、全都交"，不是"勾几个改价钱"。
     ⚠️ 清单内容来自声明源（skill.modules，逐条照抄竞品原文），页面不写死任何一条。 */
  const sections = useMemo(() => {
    if (!skill || !skillModules.length) return [];
    return [{
      key: 'modules',
      /* ⚠️ 批 DC（M2）：标题与说明可以**由技能自己声明** —— 概念的清单勾的是"手法"，
         A+ 那条勾的是"内容模块"，同一句话套上去会说错东西。没声明的一律走原来的文案。 */
      title: String(skill.modulesTitle || '').trim() || '包含模块',
      /* 用户批注 #3-2 原话：「选中多少个模块就是多少张，并且对应他自己的模块主题不是吗。」
         —— 所以那句说明也跟着改成"勾几个出几张"，不再说"全都交、不能改价"。 */
      note: String(skill.modulesNote || '').trim() || '勾几个出几张，价钱跟着勾选走（每张的单价与右下角那颗按钮同源）。',
      selectable: true,
      items: skillModules.map(module => ({ ...module, checked: !moduleOff.has(module.name) })),
      /* 勾选开关：只剩"点一下切换"这一件事 —— "最后一个不许取消"的禁令随默认值一起删掉了
         （现在的默认是"一个都不勾"，那条禁令只会让用户点了没反应）。 */
      onToggle: name => setModuleOff(previous => {
        const next = new Set(previous);
        if (next.has(name)) next.delete(name); else next.add(name);
        return next;
      }),
    }];
  }, [skill, skillModules, moduleOff]);

  /* ── 一键解析（付费前置动作，0.2 积分）──────────────────────────────────────
     照竞品做法：先上传商品图 → 点「一键解析」→ 字段自动填好 → 用户改细节 → 再生成。
     ⚠️ 它**扣费**（SKU ec_ai_assistant = 200 units = 0.2 积分），所以：
        ① 只能由用户手势触发（按钮 onClick），不许放进 effect / 渲染期
           —— 由 test/charge-requires-confirmation 守着；
        ② 没登录先走登录守卫，不发请求；
        ③ 报价在 autoRecognizeEcommerce 内部完成（先报价后扣费），失败就近提示。
     解析结果（商品名 / 品类 / 材质 / 尺寸 / 保养）按技能声明的 fills 回填到对应字段。 */
  const [parsing, setParsing] = useState(false);
  /* ② 文案润色 / ③ 风格分析各自的在途态：两颗按钮要能**各转各的**，
     共用一个 busy 会让"点了一颗两颗一起转"，看不出到底哪颗在跑。 */
  const [polishing, setPolishing] = useState(false);
  const [analyzingStyle, setAnalyzingStyle] = useState(false);
  /* ③ 的产物：分析出来的风格名（写回 note 常驻显示，不是一闪而过的 toast ——
     付费买到的结论必须留在页面上）。 */
  const [styleVerdict, setStyleVerdict] = useState('');
  const parseSpec = skill && skill.parse && !embed ? skill.parse : null;
  /* ⚠️ 解析的**取图位**必须按目标字段算，不能统一读 values.assets：
     「图片复刻」没有 assets（它的两个上传位叫 reference / source），
      写死 assets 会让那颗按钮永远提示"先上传商品图"—— 明明是死路却看着像能用。
     判据：目标字段是卖点类 → 第一个 upload 位就是商品图；其余情况取 assets。
     见 test/workbench-quantv-parity-0918 第 ⑤ 条（它自带反例）。 */
  function parseSourceUrls(target) {
    const isPoints = target === 'product' || target === 'productParams';
    const slots = (skill?.fields || []).filter(field => field.kind === 'upload');
    const key = isPoints && slots.length ? slots[0].key : 'assets';
    return (Array.isArray(effectiveValues[key]) ? effectiveValues[key] : [])
      .filter(item => item && item.status === 'ready' && item.url)
      .map(item => item.url);
  }
  /* 字段 key → 界面上那个 label（提示语里要说"人话"，不能把 key 抛给用户） */
  function fieldLabel(key) {
    return (skill?.fields || []).find(field => field.key === key)?.label || '';
  }

  /* ═══ 批 U（2026-09-21）：`parseProductInfo` **删除**，回填并进 ③ 那次调用 ═════════════════════
     用户本轮原话：「『产品卖点与设计风格，一键解析商品信息，0.2 积分』这个**也是多余的**呀，
     下面不是都有一键润色卖点和一键解析风格吗，**各个子页面应该都有这个问题，你要去掉呀**。」
     ⇒ 组行那颗按钮不再渲染（`parseAction={null}`）；**但它背后那条"读图回填商品字段"的能力不能丢**：
       ③「一键解析风格」调用的本来就是**同一条上游** `autoRecognizeEcommerce`
       （返回里同时有 product 与 style_skill，见本文件下方 paidActions 的注释），
       所以把回填并进 ③ —— 一次点击、一次扣费、两份产物（商品字段 + 推荐风格）。
     ⚠️ 钱路门禁（test/charge-requires-confirmation）当场抓到过这一删除的副作用：
       `parseProductInfo` 失去了用户手势入口、变成"无人察觉即可扣费"的悬挂链路。
       并进 ③ 之后，它的手势入口就是「一键解析风格」那颗按钮 —— 门禁恢复绿，且没有走豁免清单。 */

  /* ③ 之下的回填：把同一次分析的 product 片段写成商品字段（**只在空的时候写**，不覆盖用户已写内容） */
  function productInfoText(result) {
    const product = result?.product || {};
    return [
      String(product.name || '').trim(),
      product.category ? '品类：' + product.category : '',
      product.material ? '材质：' + product.material : '',
      product.dimensions ? '尺寸：' + product.dimensions : '',
      result?.maintenance ? '保养：' + result.maintenance : '',
    ].filter(Boolean).join('\n');
  }

  /* ③ 的取图位：**所有上传位里已经就绪的图**（商品图 + 参考图都算）。
     与 ① 的 parseSourceUrls 有意不同：① 只认"商品图那一个位"，
     ③ 要的是"用户给过的全部视觉证据"—— 参考排版、场景参考都在里面。 */
  function styleRefUrls() {
    const urls = [];
    for (const slot of (skill?.fields || []).filter(field => field.kind === 'upload')) {
      const list = Array.isArray(effectiveValues[slot.key]) ? effectiveValues[slot.key] : [];
      for (const item of list) if (item && item.status === 'ready' && item.url) urls.push(item.url);
    }
    return urls.slice(0, 5);
  }

  /* ═══ 批 U：原来这里有一个 `parseProductInfo`（组行那颗「一键解析商品信息」的手势入口）═══════════
     用户本轮把它整块去掉了 ⇒ 这一条就**没有独立入口**了。它不能以"函数留着但没人调"的形式存在：
     钱路门禁（test/charge-requires-confirmation）会当场判红 ——
     「这些扣费点既追溯不到用户手势、也不在豁免清单里 —— 用户可能在毫无察觉时被扣费」。
     ⇒ 回填逻辑改成下面那个纯函数 `productInfoText`，由 ③「一键解析风格」在同一次调用里使用
       （同一条上游、同一次扣费、两份产物）；扣费点因此仍然挂在**用户点过的那颗按钮**上。 */

  /* ═══ ② AI 润色：把已写好的卖点交给 /api/polish-ec-text（SKU ec_ai_assistant = 0.2 积分）═══
     这是**另一条上游**，不是 auto-recognize 的换皮：识别链路只回结构化商品字段，
     润色链路才回文案。用户批注 #14 要"每颗按钮都真的有效"，所以它必须有自己的产物。 */
  async function polishPoints(target) {
    if (!skill || polishing) return;
    if (!state.logged) {
      dispatch({ type: 'SET_LOGIN_INTENT', intent: { destination: state.page, source: state.page } });
      dispatch({ type: 'SHOW_LOGIN', show: true });
      return;
    }
    const text = String(effectiveValues[target] || '').trim();
    /* ⚠️ 空内容**不做死按钮**：点了必须有事发生 —— 就地告诉用户缺什么、缺的那一步在哪。
       （给一个点了没反应的付费按钮比不给更糟，是本项目铁律。） */
    if (!text) {
      setNotice('');
      setError('先写几句' + (fieldLabel(target) || '内容') + '，再点这颗按钮润色');
      return;
    }
    setPolishing(true);
    setError('');
    setNotice('正在润色' + (fieldLabel(target) || '内容') + '…（本次消耗 0.2 积分）');
    try {
      const source = String(effectiveValues.productParams || effectiveValues.product || '').trim();
      const productName = source.split('\n')[0].trim();
      const result = await polishECText({
        text,
        product_name: productName || skill.name,
        category: skill.name,
      });
      const polished = String(result?.polished || '').trim();
      if (!polished) { setNotice(''); setError('这次没有返回可用文案，稍后再试'); return; }
      setValues(prev => ({ ...prev, [target]: polished }));
      await refreshBillingBalance?.().catch(() => undefined);
      setNotice('已润色并写回' + (fieldLabel(target) || '') + '（消耗 0.2 积分），确认后再生成');
    } catch (err) {
      setNotice('');
      handleError(err);
    } finally {
      setPolishing(false);
    }
  }

  /* ═══ ③ AI 推荐风格分析（竞品那颗 0.10 积分风格的按钮）═══════════════════════════
     输入与①不同：①看**商品图**回字段，③看**参考图 + 已填商品信息**，回它判定的风格。
     上游是同一条 auto-recognize —— 它本来就在同一次推理里同时给出 product / style_skill /
     skus，所以这不是"同一颗按钮换个名字"，而是同一次分析能力的**第三种用法**。
     产物落在两处：把「设计风格」切到「AI推荐」（口径一致），并把判定结果常驻在按钮下面。 */
  async function analyzeStyle(target) {
    if (!skill || analyzingStyle) return;
    if (!state.logged) {
      dispatch({ type: 'SET_LOGIN_INTENT', intent: { destination: state.page, source: state.page } });
      dispatch({ type: 'SHOW_LOGIN', show: true });
      return;
    }
    const refs = styleRefUrls();
    const brief = String(effectiveValues.productParams || effectiveValues.product || '').trim();
    if (!refs.length && !brief) {
      setNotice('');
      setError('先上传商品图或参考图，或者把商品信息填好，再点它');
      return;
    }
    setAnalyzingStyle(true);
    setError('');
    setNotice('正在分析参考图与商品信息…（本次消耗 0.2 积分）');
    try {
      const result = await autoRecognizeEcommerce({ smartBrief: brief, refShots: refs });
      const label = STYLE_SKILL_LABEL[result?.style_skill] || '';
      if (!label) { setNotice(''); setError('这次没分析出明确的风格，换一张更聚焦的参考图再试'); return; }
      setStyleVerdict(label);
      /* 批 Q（用户批注 #3-1）：「你没有输入框的话，那你这个 AI 推荐要推荐在哪里呢？
         你肯定要有一个输入框让 AI 推荐把结果给显示在里面呀。」⇒ 结论写进**可编辑的输入框**，
         不是只挂在按钮下面的一句提示（提示会随下一次操作消失，用户也没法改）。 */
      /* ⚠️ 写回的是**那个字段自己的默认档**（`style.default`）——两条内置页的档位名不一样
         （商品套图叫「AI推荐」、A+/详情图叫「爆款风格」），硬写 'AI推荐' 会让 A+/详情图落到一个
         **不存在的档位**上（界面显示"没选中任何一档"）。 */
      if (target) {
        const styleDefault = (skill.fields || []).find(field => field.key === target)?.default || 'AI推荐';
        setValues(prev => ({ ...prev, [target]: styleDefault, styleBrief: label }));
      }
      await refreshBillingBalance?.().catch(() => undefined);
      /* 批 U：同一次分析里的 product 片段**一并回填商品字段** ——
         这原来是组行那颗「一键解析商品信息」干的活（同一条上游：autoRecognizeEcommerce
         的返回里同时有 product 与 style_skill）。用户本轮把那颗按钮去掉了，
         能力不能跟着丢，所以并进这一次点击里：一次扣费、两份产物（推荐风格 + 商品字段）。
         ⚠️ 只在字段为空时写 —— 用户自己写过的内容不许被模型覆盖。 */
      const infoTarget = parseSpec?.fills || 'productParams';
      const infoText = productInfoText(result);
      const alreadyWritten = String(effectiveValues[infoTarget] || '').trim();
      if (infoText && !alreadyWritten && (skill.fields || []).some(field => field.key === infoTarget)) {
        setValues(prev => ({ ...prev, [infoTarget]: infoText }));
        setNotice('推荐风格：' + label + '；' + (infoTarget === 'product' ? '核心卖点' : '商品信息') + '也一并填好了（消耗 0.2 积分）');
      } else {
        setNotice('推荐风格：' + label + '（消耗 0.2 积分）');
      }
    } catch (err) {
      setNotice('');
      handleError(err);
    } finally {
      setAnalyzingStyle(false);
    }
  }

  /* 统一失焦：登录 / 余额不足交给既有守卫处理，其余就地显示 */
  const handleError = useCallback((err) => {
    const access = handleGenerationAccessError(err, dispatch, { source: 'visual_creation' });
    if (access) return true;
    const message = friendlyError(err);
    if (message) setError(message);
    return false;
  }, [dispatch]);

  /* ═══ 字段旁的付费动作：**三颗按钮，三条真的走得通的路**（2026-09-19 批 G 逐颗接通）═══
     用户批注 #14 原话：「你这三个按钮里面只有一个按钮是有效的……你要真正的去点击它的
     各种按钮，还有它的各个选项。」—— 照做：三颗各自打**不同的输入、不同的产物**，
     没有一颗是摆设（上一版第③颗是 runnable:false 的说明行，正是用户说的「无效」）。
       ① 一键解析商品信息（上面的 parseAction）：读**商品图** → 回填商品信息字段（auto-recognize）
       ② AI 润色 · 卖点：把已写好的卖点交给 /api/polish-ec-text 润色回填（polishECText）——
          **另一条上游**：识别链路只回结构化商品字段，润色链路才回文案。
       ③ AI 推荐风格分析：读**参考图 + 已填商品信息**，拿回模型判定的 style_skill，
          把「设计风格」切到「AI推荐」并把判定结果常驻显示在按钮下面。
          上游与①同一条，但这不是「换个名字」：auto-recognize 本来就在同一次推理里
          同时给出 product / style_skill / skus，①③ 是这份分析能力的两种用法。
     计费：三颗都走 ec_ai_assistant = 200 units = **0.2 积分**（与竞品那两颗 0.10 不同）。
     ⚠️ 计价改成 0.10 是**动钱路**的事（catalog 里每条 SKU 都带真实上游成本与毛利带），
        必须用户点头，不许静默调价 —— 所以按钮上如实写 0.2 积分，不照抄他们的数字。
     ⚠️ 前置条件不满足时**仍然渲染成按钮**，点了就地说明缺什么（见 polishPoints 的空文本分支）——
        渲染成禁用行会让用户以为按钮坏了；有明确回应的按钮才是活的。
     ⚠️ 依赖数组里的 parseProductInfo / polishPoints / analyzeStyle 都是**函数声明**（会提升），
        不是 const —— 这里若引用后面才声明的 const，就是本项目踩过两次的渲染期 TDZ 白屏。 */
  const paidActions = useMemo(() => {
    if (!skill || embed) return [];
    const list = [];
    /* ② AI 润色 · 卖点：套图 / A+ / 详情图 / 复刻四条都有卖点字段，润色回填到它自己那一个。
       ⚠️ 它**不**调 parseProductInfo —— 那一颗是「读图回字段」，这一颗是「把手上的文案改好」，
          两条上游不同（auto-recognize vs polish-ec-text），产物也不同。 */
    const pointsField = (skill.fields || []).find(field => field.key === 'productParams' || field.key === 'product');
    if (pointsField) {
      const pointsDraft = String(effectiveValues[pointsField.key] || '').trim();
      list.push({
        key: 'ai-polish',
        /* ═══ 2026-09-19 批 O-⑪：**anchor = 贴着这个字段的标签行渲染**（照知渔）══════════════
           用户第 19 轮批注：「你这些按钮的布局还有规划都完全不一样呀。」
           实测知渔：这颗按钮是**行内小胶囊**，挂在「产品卖点」那一行的右端（与字段标题同高），
           不是独立成行的大卡。anchor 让渲染器把它放进对应的字段标签行里。 */
        anchor: pointsField.key,
        /* ⚠️ 标签里**不写价格** —— 价格由 points 走 em 渲染（按钮上那 0.2 积分）。
           知渔那一页写的是「AI生成 · 0.10 积分/张」（**他们的价格**），我们按自己的真价显示，
           两处都写就会出现"0.10 积分/张 0.2 积分"这种自相矛盾。 */
        /* ═══ 2026-09-19 批 Q：**改名叫「一键润色卖点」** ══════════════════════════════════════
           用户批注：「这个按钮不该就 AI 生成吧，他们叫一键解析更贴切，我们想想有没有更合适的叫法啊，
             你抄东西不能只抄表面啊。」
           —— 它做的事是"把已写好的卖点交给模型改写回填"，叫「AI 生成」会让人以为是从零生成。
             按知渔「一键解析」的命名法改成动宾结构：**一键润色卖点**（做什么、对谁做，一眼看懂）。 */
        label: '一键润色卖点',
        points: 0.2,
        runnable: true,
        busy: polishing,
        busyLabel: '正在润色…',
        note: pointsDraft
          ? '把上面这段' + pointsField.label + '按商品与平台改得更像人写的，再写回原处'
          : '先写几句' + pointsField.label + '，再点这颗按钮润色',
        onRun: () => { void polishPoints(pointsField.key); },
      });
    }
    /* ③ AI 推荐风格分析：竞品在「设计风格」那一排下面还有一颗（他们 0.10 积分）。
       我们的上游其实**能**回风格 —— /api/ecommerce/auto-recognize 的返回里就带 style_skill
       （server/index.mjs 的 STYLE_MAP 把模型答案归一成 5 个 key），只是上一版没接上，
       于是把它写成了 runnable:false 的说明行 —— 那正是用户说的「三个按钮只有一个有效」。
       现在接上：读参考图 + 已填商品信息 → 判定风格 → 把「设计风格」切到「AI推荐」并常驻结论。 */
    const styleField = (skill.fields || []).find(field => field.key === 'style');
    /* ═══ 2026-09-19 批 Q：这颗只在**"AI 推荐"那一档**出现（照知渔）══════════════════════════
       知渔实测：选「参考排版 / 参考自定义风格」时，那一行下面换出来的是**上传区 + 设计要求**，
       而「AI推荐风格分析」那颗按钮只在 AI 档下出现（.tmp/laoyu2/qy-suite-switch.mjs）。
       我们上一版不管切到哪一档，这颗都挂在那儿 —— 用户批注 #3-2「这两个按钮打开里面都是空的」。 */
    /* ═══ 2026-09-19 批 Q：**这颗不再随切换消失** ═════════════════════════════════════════════
       用户批注（本轮）：「为什么我切换了一下按钮就没有右上角的 AI 积分呢？」
       —— 我上一版按知渔"分析按钮只在 AI 档出现"做了显隐，用户的实际感受是"切一下功能就没了"。
         功能不该因为切档而消失（切档只换下面的内容区：上传参考图 / 设计要求 / 结论栏），
         所以恢复成**三档都在**。 */
    if (styleField) {
      list.push({
        key: 'style-analysis',
        anchor: styleField.key,
        /* 批 Q：同理改名为「一键解析风格」（知渔那一页叫「AI推荐风格分析 · 0.10 积分」，
           我们沿用自己「一键解析 XX」的命名法，用户说这样更贴切）。 */
        label: '一键解析风格',
        points: 0.2,
        runnable: true,
        busy: analyzingStyle,
        busyLabel: '正在分析…',
        note: styleVerdict
          ? '推荐风格：' + styleVerdict + '（已把「' + styleField.label + '」切到 AI 档，出图按它走）'
          : '读参考图与已填商品信息，判定风格并把「' + styleField.label + '」切到 AI 档',
        onRun: () => { void analyzeStyle(styleField.key); },
      });
    }
    return list;
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [skill, embed, parsing, polishing, analyzingStyle, styleVerdict, effectiveValues]);

  /* ── 生成：命名函数，不用 useCallback 包 ──────────────────────────────────
     ⚠️ runSlot 是**扣费点**（regenerateCanvasImage 内部会先报价再扣费）。
        它只能由用户手势链调用：generate（CTA 的 onGenerate）与 retryFailed（重试按钮）。
        **不许从 useEffect / 渲染期调用** —— 这条由 test/charge-requires-confirmation 守着，
        所以这里刻意写成具名函数，让门禁能把调用链追溯到手势，而不是靠豁免放行。 */
  async function runSlot(baseRun, index) {
    const slot = baseRun.slots[index];
    /* ═══ 批 DC（M2）：**逐张换手法** —— 第 i 次请求的提示词只放第 i 种手法 ═══════════════════
       其余字段（主题意象 / 人物形态 / 比例 / 清晰度 / 参考图）全篇相同，所以一篇里每张的
       "方向"是同一份、只有手法不同 —— 这正是 docs/design/82 读出来的那套纪律。
       ⚠️ 每次请求各自带报价（regenerateCanvasImage 内部先报价再扣费），所以某一张失败
         只释放那一张的 hold、不牵连其它张（服务端 oneShotBilling 的 fail-safe）。 */
    const request = buildSkillRequest(skill, skillValuesForShot(effectiveValues, index), { runId: baseRun.id, slotIndex: index });
    try {
      const result = await regenerateCanvasImage({
        prompt: request.prompt,
        imageUrl: request.imageUrl,
        referenceImages: request.referenceImages,
        references: request.references,
        ratio: request.ratio,
        resolution: request.resolution,
        imageModel: request.imageModel,
        requestKey: slot.requestKey,
        creationIntent: 'visual',
        skillId: request.skillId,
        includeMetadata: true,
        signal: abortRef.current?.signal,
      });
      const next = updateVisualRunSlot(runRef.current, index, { status: 'completed', url: result.url, taskId: result.taskId || '', error: '' });
      runRef.current = next;
      setRun(next);
      return true;
    } catch (err) {
      const next = updateVisualRunSlot(runRef.current, index, { status: 'failed', error: friendlyError(err) || '生成失败' });
      runRef.current = next;
      setRun(next);
      handleError(err);
      return false;
    }
  }

  async function executeRun(baseRun, indexes) {
    let current = indexes.reduce((acc, index) => updateVisualRunSlot(acc, index, { status: 'generating', error: '' }), baseRun);
    runRef.current = current;
    setRun(current);
    setError('');
    setNotice('');
    setCarryHint('');   /* 用户已经动手了，带过来的那条说明就该退场 */
    abortRef.current = new AbortController();
    await Promise.all(indexes.map(index => runSlot(current, index)));
    await refreshBillingBalance?.().catch(() => undefined);
    const finished = runRef.current;
    if (finished && finished.slots.some(slot => slot.status === 'completed' && slot.url)) await persistRun(finished);
  }

  async function persistRun(finalRun, taskId = '') {
    const settings = skillGenerationSettings(skill, effectiveValues);
    const request = buildSkillRequest(skill, effectiveValues, { runId: finalRun.id });
    try {
      const record = buildVisualWorkRecord({
        run: finalRun,
        prompt: request.prompt,
        skillId: settings.visualSkillId,
        model: settings.imageModel,
        ratio: settings.ratio,
        resolution: settings.resolution,
      });
      /* ═══ 批 DC（M2）：**篇标记** —— 一次生成 = 一篇（同一个 run = 同一个 `_saveKey`）═══════════
         这一篇勾了哪几种手法由 skillPieceMark 算出来，写进作品（服务端 payload 原样存回，
         未知字段不会丢），历史据此把这一篇当**一组**展示、也据此还原面板的勾选。
         ⚠️ 没有清单的技能拿到 null，这里就一个字段都不加（其余技能的作品形状不变）。 */
      const piece = skillPieceMark(skill, { runId: finalRun.id, selectedModules, values: effectiveValues });
      /* 作品归到这条技能名下（buildVisualWorkRecord 只认四个视觉方向，这里补上我们的身份） */
      const work = {
        ...record,
        ...(piece ? { _piece: piece } : {}),
        product_name: skill.name,
        title: skill.name,
        category: skill.category,
        visualSkillId: skill.id,
        mediaSkillId: skill.id,
        /* 套图：用服务端任务号当作品身份 —— 服务端也会为同一个任务落一条作品，
           同一个 taskId 才能被合并成一条，而不是在「我的作品」里出现两条。 */
        ...(taskId ? { taskId, _saveKey: taskId } : {}),
        replay: { ...record.replay, mediaSkillId: skill.id, panelValues: { ...effectiveValues } },
      };
      const saved = await saveWork(work, state.phone);
      dispatch({ type: 'SET_WORKS', works: [work, ...(Array.isArray(state.works) ? state.works.filter(item => String(item._saveKey || item.id) !== String(work._saveKey || work.id)) : [])].slice(0, 50) });
      setNotice(saved ? '作品已保存，可在「我的作品」里继续编辑或下载' : '图片已完成，但作品云端保存暂时失败');
      return work;
    } catch (err) {
      setNotice((err && err.message) || '图片已完成，但没有可保存的稳定图片');
      return null;
    }
  }

  /* CTA：用户手势入口① */
  async function generate() {
    if (!state.logged) {
      dispatch({ type: 'SET_LOGIN_INTENT', intent: { destination: state.page, source: state.page } });
      dispatch({ type: 'SHOW_LOGIN', show: true });
      return;
    }
    const check = validateSkillInput(skill, effectiveValues);
    if (!check.ok) { setError('还差：' + check.missing.join('、')); return; }
    setError('');
    const settings = skillGenerationSettings(skill, effectiveValues);
    /* ═══ 2026-09-28 批 DC 续-7 · 一：**一次下单 = N 张图 + 1 组文案**（用户当面定的口径）══════════
       用户原话：「如果你要产出的是一整套的小红书图文的话，那肯定是文案一起出的话会更加统一吧……
         很有可能你先去生成图片，然后再拿图片去生成文案，这样的话会很混乱。」
       ⇒ **一个确认框、一个总价、两者并行发起**（串起来是加法：出图 20~40 秒、文案 3~5 秒）。
       拆开的是**计费与重做**，不是交付单元：改标题只需再付 0.5，不必把图的钱再付一遍。
       ⚠️ 确认框只在这一条链上弹（图与文案**相加**是两项报价，不弹两次 ——
          弹两次就是"下单要确认两遍"，那正是用户说的"很混乱"）。其它技能一个字不变。 */
    if (copyInBatch) {
      const quote = batchQuote || skillBatchQuote(skill, effectiveValues, { copyPoints: CONCEPT_COPY_POINTS });
      const confirmed = await dialog.confirm({
        title: `出这一篇的 ${quote.count} 张图和一组文案？`,
        message: `${quote.detail}。图与文案同时开始；某一张没跑成只退那一张，文案没写出来不扣那 0.5。`,
        confirmLabel: '出这一篇',
      });
      if (!confirmed) return;
    }
    const fresh = createVisualRun({ count: settings.count });
    runRef.current = fresh;
    setRun(fresh);
    /* 新的一轮 = 新的一篇：上一张拼版属于上一批图，不能再挂在这一轮下面（挂错了就是图文不符） */
    setSheet(null);
    /* ⚠️ 两跳**并行**，谁也不等谁：文案等图出来就退化成"看图说话"（那是最差的文案），
       图等文案就白等 3~5 秒。各自独立报价与 hold，所以失败也互不牵连。 */
    await Promise.all([
      executeRun(fresh, Array.from({ length: settings.count }, (_, index) => index)),
      copyInBatch ? runPostCopy(0) : Promise.resolve(),
    ]);
  }

  /* ── 套图：就地跑既有套图引擎（一次任务出一套 N 张，按套计价）──────────────
     ⚠️ 这条链路上有三条钱规矩，一条都不能破：
       ① **报价张数**必须与方案一致：用与面板同一份 resolveEcommercePlan 算（服务端建 hold 前会
          校验报价，数量对不上就直接报错 —— 干净失败，不扣费）；
       ② **幂等**：提交由 generateEcommerce 内部按草稿持久化的 Idempotency-Key 兜底，
          连点不会重复下单；
       ③ **部分交付不许整单重跑** —— 那会把已交付的那几张再买一遍。缺的图引导去「任务记录」补跑
          （那里走 retry-plan → retry-failed，只为缺的图报价）。 */
  async function generateSuite() {
    if (!skill) return;
    if (!state.logged) {
      dispatch({ type: 'SET_LOGIN_INTENT', intent: { destination: state.page, source: state.page } });
      dispatch({ type: 'SHOW_LOGIN', show: true });
      return;
    }
    const check = validateSkillInput(skill, effectiveValues);
    if (!check.ok) { setError('还差：' + check.missing.join('、')); return; }
    const plan = buildSuiteRun(skill, effectiveValues);
    if (!plan.productInputs.length) { setError('商品图还没上传完成'); return; }
    if (!plan.plan.quoteRequest) { setError('套图方案为空，先检查平台设置'); return; }

    setError('');
    setNotice('正在确认本次费用…');
    let quote = null;
    try {
      const response = await quoteBillingAction(plan.plan.quoteRequest);
      quote = response?.quote || null;
    } catch (err) {
      setNotice('');
      handleError(err);
      return;
    }
    if (!quote?.quoteId) { setNotice(''); setError('暂时无法确认本次处理费用，请重试'); return; }

    const fresh = createVisualRun({ count: plan.plan.quantity });
    let current = fresh.slots.reduce((acc, _slot, index) => updateVisualRunSlot(acc, index, { status: 'generating' }), fresh);
    runRef.current = current;
    setRun(current);
    setNotice('套图任务已提交，正在出图（一套 ' + plan.plan.quantity + ' 张）…');
    abortRef.current = new AbortController();

    let delivered = 0;
    const markRemainingFailed = reason => {
      let settled = runRef.current;
      settled.slots.forEach((slot, index) => {
        if (slot.status === 'completed') return;
        settled = updateVisualRunSlot(settled, index, { status: 'failed', error: reason });
      });
      runRef.current = settled;
      setRun(settled);
      return settled;
    };

    try {
      const result = await generateEcommerce({
        productName: plan.productName,
        realShots: plan.productInputs,
        platform: plan.platform,
        sizing: plan.sizing,
        generationSettings: { resolution: plan.sizing.resolution, imageModel: plan.sizing.imageModel },
        billingQuoteId: quote.quoteId,
        signal: abortRef.current.signal,
        onProgress: task => {
          const label = String(task?.message || '').trim();
          const assets = task?.assets && typeof task.assets === 'object' ? Object.keys(task.assets).length : 0;
          setNotice(label || ('正在出图：已交付 ' + Math.max(delivered, assets) + '/' + plan.plan.quantity + ' 张…'));
        },
        onImage: image => {
          const url = String(image?.stableUrl || image?.url || '');
          if (!url || delivered >= plan.plan.quantity) return;
          const index = delivered;
          delivered += 1;
          const next = updateVisualRunSlot(runRef.current, index, { status: 'completed', url, taskId: String(image?.id || '') });
          runRef.current = next;
          setRun(next);
        },
      });

      const taskId = String(result?.taskId || '');
      const settled = markRemainingFailed('这一张没有交付');
      if (delivered > 0) await persistRun(settled, taskId);
      setNotice(delivered >= plan.plan.quantity
        ? ''
        : '已交付 ' + delivered + '/' + plan.plan.quantity + ' 张。缺的图请在左下角「任务记录」里补跑 —— 别在这一页整单重跑，那会把已交付的再买一遍。');
    } catch (err) {
      const message = friendlyError(err) || '套图任务没有完成';
      markRemainingFailed(message);
      setNotice('');
      handleError(err);
    }
  }

  /* 重试按钮：用户手势入口② —— 只重跑失败槽位（成功的不会重跑，也就不会重复扣费） */
  async function retryFailedAssets() {
    const current = runRef.current;
    if (!current) return;
    const indexes = visualRetryIndexes(current);
    if (!indexes.length) return;
    await executeRun(current, indexes);
  }

  /* 历史操作①：用这组参数 —— **只还原面板，不直接扣费**。
     直接重跑会让用户在没看清的情况下被扣一次，与"没有用户确认绝不扣费"冲突。 */
  function reuseHistory(item) {
    if (!item) return;
    /* ① 图文记录：能还原的只有那句话 —— 写回图文输入框（它就是这条链路的全部输入） */
    if (item.restore?.prompt) {
      dispatch({ type: 'SET_INPUT', text: item.restore.prompt });
      setError('');
      setNotice('提示词已还原，确认后点「生成图文」——这一次会重新计费');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    /* ② 视频任务：提示词与规格（时长/比例/清晰度/创作方式）一起还原回创作台 */
    if (item.restore?.videoJob) {
      setVideoSeed({ ...item.restore.videoJob });
      setVideoSeedNonce(nonce => nonce + 1);
      setError('');
      setNotice('这条任务的提示词与规格已还原到上面的创作台，确认后点「分析并生成方案」——这一次会重新计费');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    /* ③ 图片技能：还原面板参数。**只还原面板，不直接扣费** ——
       直接重跑会让用户在没看清的情况下被扣一次，与"没有用户确认绝不扣费"冲突。 */
    if (!item.values) { setError('这条记录没有存下参数，无法还原'); return; }
    const keys = new Set(((skill && skill.fields) || []).map(field => field.key));
    const restored = Object.fromEntries(Object.entries(item.values).filter(([key]) => keys.has(key)));
    setValues(prev => ({ ...prev, ...restored }));
    /* ═══ 批 DC（M2）：勾选清单的勾也要还原 ═══════════════════════════════════════════════════
       篇标记里存着这一篇勾过哪几种手法 —— 不还原的话，"用这组参数"会出现"参数回来了、
       清单还是空的"，用户得自己重新勾（那一篇就不再是原来那一篇）。
       ⚠️ 只对**有篇标记的记录**动手：老记录（没有 _piece）保持用户当前的勾选，不给他清空。 */
    const pieceShots = Array.isArray(item.piece?.shots) ? item.piece.shots : [];
    if (skillModules.length && pieceShots.length) {
      setModuleOff(new Set(skillModules.filter(module => !pieceShots.includes(module.name)).map(module => module.name)));
    }
    setError('');
    setNotice('参数已还原，确认后点「立即生成」——这一次会重新计费');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ═══ 结果区的融合动作：把"刚才那张结果"带进辅助链路 ══════════════════════════
     用户 9-17 口径：「有些 skill 其实是辅助作用的……融合在一些主 skill 里面」。
     这一步做三件事，顺序不能换：
       ① 找到目标能力的**第一个上传位**（skillImages 就是拿它当主图，所以必须是它）；
       ② 用这张结果的地址预填成一张已就绪素材（字段值的形状由 FieldRenderer 定义）；
       ③ 跳到那条能力的子页面，并说清"下一步点哪里、这一次会重新计费"。
     ⚠️ 绝不在这里调用生成 —— 扣费必须由用户再点一次 CTA（test/charge-requires-confirmation）。 */
  function fuseFromResult(action, url) {
    if (!action || !action.skillId || !url) return;
    const target = board === 'video' ? getVideoSkill(action.skillId) : getImageSkill(action.skillId);
    if (!target) { setError('这条能力已经下线了'); return; }
    const slot = (target.fields || []).find(field => field.kind === 'upload');
    if (!slot) { setError('这条能力没有能接收图片的素材位'); return; }
    /* ⚠️ 走**独立通道**（carryHint）而不是共用的 notice：上一次运行结束时异步落下的
       「作品已保存」会晚一步把 notice 顶掉，用户就看不到"我刚才那一下到底干了什么"。 */
    carryHintRef.current = '已把刚才那张结果放进「' + target.name + '」的素材位，确认后点「立即生成」——这一次会重新计费';
    openSkill(target.id, { [slot.key]: [{ status: 'ready', url, name: '上一步的结果' }] });
  }

  /* ═══ 2026-09-26 批 BP-3：消费首页案例区的「做同款」══════════════════════════════════════
     来龙去脉：首页把案例装进 creationLaunch（kind='gallery-remix'）后跳到本页；
     这里负责把它**落到对应技能子页面**并预填素材/提示词，然后清空 launch
     （不清就会被下一次导航重复应用 —— 这是本项目"过期 launch"踩过的坑）。
     ⚠️ 只预填、不触发生成。没有对应技能时退到 Hub，也比留在首页旧工作台正确。

     ═══ 2026-09-27 批 CB：同一条路多了一个入口 ——「回到生成它的工作台」══════════════════════
     用户口径（逐字）：「他点击这个作品的话，这个作品会把它**带到原来的生成时的工作台**里面，
     然后把之前生成时的那些**提示词和素材和配置都一起展示在工作台里**……重新生成出来的结果
     **可以是一个新的结果，而不是覆盖掉它原来生成的那个作品**。」
     ⇒ 画布工作区（我的作品）里点「回到工作台」发的是 `kind: 'work-remix'`，载着
       `{skillId, panelValues, prompt}`；这里和"做同款"走**同一段落地逻辑**：
         · 落到那条技能的子页面；
         · 预填整份面板值（panelValues 里含**上传位素材**，所以素材也一起回来）；
         · **不触发生成**，并且明说"再点生成会重新计费"；
         · 新结果照旧存成**新的一条作品**（每次生成都有自己的 saveKey，不覆盖旧的那条）——
           两条都在历史里、都带时间，用户据此对比。 */
  useEffect(() => {
    const launch = state.creationLaunch;
    if (!launch) return;
    /* ═══ 2026-09-28 批 CY-⑨（CV-2 第 2 步）：**画布节点 → 子页面工作台** ══════════════════════════
       画布那边按用户拍板把入口放在**节点上**（「在完整工作台里编辑」，docs/design/89 §5 第 2 步），
       发出的 launch 是 `kind: 'canvas-node-edit'`，载荷与 work-remix **同一个形状**
       （skillId / panelValues / prompt / title）⇒ 这里**不新写一段落地逻辑**，只换一句提示语
       （让用户知道"这次是从画布那个节点来的"）。素材不带：CV-2 第 2 步的原文就是
       「打开对应 skill 子页面，**参数带过去**」。 */
    if (launch.kind === 'work-remix' || launch.kind === 'canvas-node-edit') {
      const target = launch.skillId ? getImageSkill(launch.skillId) : null;
      if (!target) { backToHub(); dispatch({ type: 'SET_CREATION_LAUNCH', launch: null }); return; }
      const seed = { ...(launch.panelValues || {}) };
      if (launch.prompt) seed[planPreviewTargetKey(target)] = launch.prompt;
      carryHintRef.current = launch.kind === 'canvas-node-edit'
        ? '已从画布节点「' + (launch.title || target.name) + '」把参数与提示词带过来，'
          + '确认后点「立即生成」——这一次会重新计费；生成结果是新的一条记录'
        : '已带出「' + (launch.title || '这条记录') + '」的素材与配置，'
          + '确认后点「立即生成」——这一次会重新计费；生成结果是新的一条记录，不会覆盖原来那条';
      openSkill(target.id, seed);
      dispatch({ type: 'SET_CREATION_LAUNCH', launch: null });
      return;
    }
    if (launch.kind !== 'gallery-remix') return;
    const skillIdForRemix = remixSkillIdOf(launch.checkpoint);
    const target = skillIdForRemix ? getImageSkill(skillIdForRemix) : null;
    if (target) {
      carryHintRef.current = '已带出案例「' + (launch.checkpoint?.project?.title || '同款')
        + '」的素材与提示词，确认后点「立即生成」——这一次会重新计费';
      openSkill(target.id, remixSeedValuesOf(target, launch.checkpoint));
    } else {
      backToHub();
    }
    dispatch({ type: 'SET_CREATION_LAUNCH', launch: null });
  }, [state.creationLaunch, openSkill, backToHub, dispatch]);

  /* ═══ 历史操作③：下载（批 BZ）═══════════════════════════════════════════════════════════
     用户问：「是不是会有……**下载**的功能？」「它的**时间**这些东西是不是也得加进去呢？」
     —— 记录只留 7 天（服务端保留期），所以"能拿走"是这个列表最基本的出口。
     做法：同源地址直接 `<a download>` 逐个触发（资产就在本站 `/api/generated-assets/…`，
     不走后端新接口、也没有跨域问题）。图片/图文是**一组多张**，全下；视频下成片。
     ⚠️ 文件名用作品标题（去掉路径不安全字符）+ 序号 + 扩展名 —— 用户下到本地要认得出是哪一次。 */
  function downloadHistory(item) {
    const urls = (Array.isArray(item?.downloads) ? item.downloads : []).filter(Boolean);
    if (!urls.length) { setError('这条记录没有可下载的文件'); return; }
    for (const [index, url] of urls.entries()) {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = downloadFileName({
        title: item?.title,
        fallback: skill?.name,
        url,
        index,
        count: urls.length,
        video: item?.video,
      });
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    }
    setError('');
    setNotice(urls.length > 1 ? '已开始下载 ' + urls.length + ' 个文件' : '已开始下载');
  }

  /* ═══ 历史操作④：存到我的资产（批 CD）═══════════════════════════════════════════════════
     用户问的「是不是会有……**导入到我的资产**里面的功能？」。
     落点：站里没有"手动建项目"的入口（核查过：项目只由画布媒体保存/视频项目那几条链路**隐式**产生），
     `project_assets.project_id` 又是 NOT NULL ⇒ 照**已有的隐式建项目**做法，自动建/复用一个
     名为「生成作品」的项目（幂等键写死），再把图注册进去并设成在资产库可见。细节见 saveWorkToAssets.js。 */
  async function saveHistoryToAssets(item) {
    const urls = (Array.isArray(item?.downloads) ? item.downloads : []).filter(Boolean);
    if (!urls.length) { setError('这条记录没有可以存进资产库的图片'); return; }
    setHistorySavingId(String(item?.id || ''));
    setError('');
    try {
      const result = await saveGeneratedUrlsToAssets(urls, { title: item?.title || skill?.name || '' });
      if (result.added) setNotice('已存到「我的资产」（' + result.added + ' 张）——长期保留，可当参考图继续用');
      else if (result.skipped) setNotice('这些图已经在「我的资产」里了');
      else setError('存进资产库失败，请稍后重试');
    } catch (failure) {
      setError(failure?.message || '存进资产库失败，请稍后重试');
    } finally {
      setHistorySavingId('');
    }
  }

  /* ═══ 版式层（M3 → 2026-09-28 批 DC 续-3 扩到四族）的三个动作（拼 / 下 / 存）════════════════════
     依据 docs/design/90 §6.2：版式层 = **确定性渲染**（我们自己的模板，不调模型），
     所以这一整段**没有报价、没有扣费**，也不新增任何服务端端点。
     ⚠️ 拼版只能由**用户手势**触发（按钮 onClick）—— 与"没有用户确认绝不扣费"同一纪律，
        虽然它不花钱，但也不许偷偷占用户 CPU/内存。
     ⚠️ 2026-09-28：`template`（信息图的三种排法）与 `copy`（用户自己写的标题/正文）
        **只在这一层用**，不进提示词、不进请求 —— 文案是后期排版加上去的。 */
  async function composeSheet() {
    const urls = (runRef.current?.slots || []).filter(slot => slot.status === 'completed' && slot.url).map(slot => slot.url);
    const plan = layoutSheetPlan({
      family: effectiveValues.layout, count: urls.length, template: sheetTemplate,
    });
    if (!plan) {
      setError(isLayoutNONE(effectiveValues.layout)
        ? '这一篇现在是「不拼版」——想拼一张的话，先在下面选一个版式族'
        : '这一篇至少要有 2 张图，才能按版式族拼成一张');
      return;
    }
    setSheetBusy(true);
    setError('');
    try {
      const blob = await layoutSheetBlob(plan, urls, { copy: sheetCopy });
      const url = URL.createObjectURL(blob);
      setSheet({ url, blob, family: plan.family, count: urls.length, plan, template: plan.template || '' });
      setNotice('拼好了：' + plan.family + (plan.template ? ' · ' + plan.template : '') + ' · ' + plan.count + ' 张（这一步不扣积分）');
    } catch (failure) {
      setError(failure?.message || '拼版失败，请重试');
    } finally {
      setSheetBusy(false);
    }
  }

  function downloadSheet() {
    if (!sheet?.url) return;
    const anchor = document.createElement('a');
    anchor.href = sheet.url;
    anchor.download = layoutSheetFileName({ title: skill?.name, family: sheet.family, count: sheet.count });
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setNotice('已开始下载这张拼版');
  }

  /* ═══ 2026-09-27 批 DC-4：「做成动图」（结果区逐张）═══════════════════════════════════════════
     用户口径（逐字）：「**动图选 A 吧**」（工作台里对**已生成的那张**给一颗「做成动图」：
     静图 → 2~3 秒循环短片、可下载、电脑端直接传）+「即便是在服务端做，**你也要收费呀**……
     而且你确定你的方案没有成本吗，**你这个不是用到图生视频吗**」。
     ⇒ 这一颗是**真的花钱**的：服务端按最短档 5 秒去上游做一次图生视频（成本 ¥0.91/条），
        交付前本地裁到 2~3 秒 —— 所以按钮上写价、点前确认、失败不扣（三条都是铁律）。

     ⚠️ 为什么"轮询"这一半必须自己写：服务端那一步是**视频任务**（实测 2~3 分钟），
        与拼版那种同步活儿不同。轮询走**这一档自己的口**（`GET /api/concept/live-photo?jobId=`，
        与价目同一条 GET，路由没变）—— 2026-09-28 批 CY-2 从"查既有的 /api/video/jobs/:id"
        改过来，原因是**两处权限不是同一把锁**：概念视觉方案归 `ecommerce_image`，视频任务那几个口
        挂的是 `video_generation`。只开了电商生图的账号点了这颗按钮，会钱已花、片已出却看不到也拿不到
        （任务记录同样进不去）。任务本身仍是同一条视频任务，在「任务记录」里也照样看得到。
     ⚠️ 扣费点（createLivePhotoClip → 服务端建单 + hold）**只能从用户手势链发起**，
        顺序固定为：按钮 onClick → dialog.confirm → 确认后才调 —— test/charge-requires-confirmation
        追溯的就是这条链；金额与幂等都由服务端定（客户端一个金额字段都不传）。 */
  async function pollLivePhotoJob(jobId) {
    for (let attempt = 0; attempt < LIVE_PHOTO_POLL_MAX; attempt += 1) {
      const payload = await fetchLivePhotoStatus(jobId).catch(() => null);
      const job = payload?.job || null;
      /* ⚠️ "查不到进度"和"没做出来"是两回事，绝不能混成一句话（钱的状态完全不同）：
         走到这里时**这一单已经建好了**（createLivePhotoClip 已经返回），所以下面这条例外
         会被 makeLivePhoto 的 catch 单独认出来 —— 那时**不许**说"本次不扣积分"（那是假话：
         钱按最短路已经花了，任务还在跑）。带一个标记就是为了让那句话说得准。 */
      if (!job) {
        throw Object.assign(new Error('这一单已经建好了，但进度暂时查不到（不会重复扣费）。稍后点「再看一眼」取回这条动图。'),
          { livePhotoLookupFailed: true, jobId });
      }
      if (job.status === 'completed') return job;
      if (job.status === 'failed' || job.status === 'cancelled' || job.status === 'needs_review') return job;
      await new Promise(resolve => { setTimeout(resolve, LIVE_PHOTO_POLL_MS); });
    }
    /* 超时不假装失败：任务还在跑，链路上它回来还会结算/退回 —— 如实告诉用户去哪儿看 */
    return { status: 'timeout' };
  }

  /* 把"服务端给的那条任务"落成这一张的状态（成功 / 还在做 / 没做出来 三种）。
     ⚠️ 单独抽出来是因为它有**两个调用点**：点按钮那一次（makeLivePhoto）与事后「再看一眼」
     （recheckLivePhoto）—— 两处必须同一套判据，否则"过一会儿回来查"会得到另一种结论。 */
  async function settleLivePhoto(index, job, created) {
    if (job.status === 'completed' && job.resultUrl) {
      setLivePhoto(current => ({
        ...current,
        [index]: { status: 'done', url: job.resultUrl, seconds: Number(created?.seconds) || 0 },
      }));
      setNotice('动图做好了，可以直接下载发给小红书（发布时选「视频」）');
      await refreshBillingBalance?.().catch(() => undefined);
      return;
    }
    if (job.status === 'timeout') {
      /* 超时不假装失败：任务还在跑。⚠️ 这一档**不把"去哪儿看"推给「任务记录」**——
         那个入口挂的是另一个权限（video_generation），只开电商生图的账号进不去。
         所以留在原地给一颗「再看一眼」（jobId 一起存下来），用户在这张图下面就能取回成片。 */
      setLivePhoto(current => ({
        ...current,
        [index]: { status: 'pending', jobId: created.jobId, note: '还在做（通常 1~3 分钟）。做好之前不会扣积分；稍后点「再看一眼」取回这条动图。' },
      }));
      return;
    }
    /* 服务端建单失败会 releaseItem（退冻结），所以这里说"没有扣积分"是**如实**的。
       ⚠️ 服务端有些文案自己已经带了这句（例如裁切失败那条），不要再叠一遍。 */
    const reason = String(job.error || '').trim() || '这条没有做出来，换一张图或稍后再试';
    setLivePhoto(current => ({
      ...current,
      [index]: { status: 'failed', note: /不扣积分/.test(reason) ? reason : reason + '；本次不扣积分。' },
    }));
  }

  /* 「再看一眼」：拿先前存下的 jobId 再查一次（同一条口，属主核过）。
     ⚠️ 钱这一层在这里**不重复发生**：建单与冻结在第一次点击时就完成了，这里只是读状态。 */
  async function recheckLivePhoto(index) {
    const jobId = String(livePhoto?.[index]?.jobId || '');
    if (!jobId) return;
    setLivePhoto(current => ({ ...current, [index]: { status: 'working', jobId } }));
    try {
      const job = await pollLivePhotoJob(jobId);
      await settleLivePhoto(index, job, { jobId });
    } catch (failure) {
      const note = String(failure?.message || '').trim() || '这条动图任务暂时查不到，稍后再试。';
      setLivePhoto(current => ({ ...current, [index]: { status: 'failed', jobId, note } }));
    }
  }

  async function makeLivePhoto(index) {
    const slot = runRef.current?.slots?.[index];
    const url = String(slot?.url || '');
    if (!url || !livePhotoOffer) return;
    if (!state.logged) {
      dispatch({ type: 'SET_LOGIN_INTENT', intent: { destination: state.page, source: state.page } });
      dispatch({ type: 'SHOW_LOGIN', show: true });
      return;
    }
    /* 铁律②：先确认，再扣费。价格来自服务端价目（livePhotoOffer.points），不在这里写死。 */
    const confirmed = await dialog.confirm({
      title: '把这张做成动图？',
      message: `会按这张图生成一小段 ${livePhotoOffer.maxSeconds} 秒以内的循环短片，`
        + `可直接下载发小红书。本次扣 ${livePhotoOffer.points} 积分，做不出来不扣积分。`,
      confirmLabel: '做成动图',
    });
    if (!confirmed) return;
    setError('');
    setLivePhoto(current => ({ ...current, [index]: { status: 'working' } }));
    try {
      const created = await createLivePhotoClip({ imageUrl: url, ratio: effectiveValues?.ratio || '' });
      const job = await pollLivePhotoJob(created.jobId);
      await settleLivePhoto(index, job, created);
    } catch (failure) {
      /* 就近说明（不是转瞬即逝的 toast）：说的位置就在那一张图下面，见 RunPanel 的 livePhoto 段。
         ⚠️ 三种失败必须说三种话（钱的真相不同）：
            · 没登录/没权限 —— 请求根本没发出去 ⇒ "还没有开始做，本次不扣积分"；
            · **建单之后查不到进度** —— 钱已经花了、任务还在跑 ⇒ 只能如实说"查不到进度"，
              **不许**说"不扣积分"（那是把花了钱说成没花钱）；并且留下 jobId，让「再看一眼」能取回。
            · 建单本身失败 —— 服务端已退回冻结 ⇒ "本次不扣积分"（服务端文案自带这句的不叠）。 */
      const access = handleGenerationAccessError(failure, dispatch, { source: 'concept_live_photo' });
      const message = String(failure?.message || '').trim() || '做成动图失败，请稍后再试';
      if (access) {
        setLivePhoto(current => ({ ...current, [index]: { status: 'failed', note: '还没有开始做，本次不扣积分。' } }));
        return;
      }
      if (failure?.livePhotoLookupFailed) {
        setLivePhoto(current => ({ ...current, [index]: { status: 'failed', jobId: failure.jobId || '', note: message } }));
        return;
      }
      setLivePhoto(current => ({ ...current, [index]: { status: 'failed', note: message + '；本次不扣积分。' } }));
    }
  }

  function downloadLivePhoto(index) {
    const clip = livePhoto?.[index];
    if (!clip?.url) return;
    const anchor = document.createElement('a');
    anchor.href = clip.url;
    /* 文件名要认得出是**哪一张**（用户下到本地要分得清，与历史下载同一口径）：
       标题取技能名（概念视觉方案）+ 这一张的序号，扩展名按地址里的 .mp4。 */
    anchor.download = downloadFileName({
      title: skill?.name,
      fallback: '动图',
      url: clip.url,
      index,
      count: 1,
      video: true,
    });
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setNotice('已开始下载这张动图');
  }

  /* ═══ 「代写这一篇的文案」（2026-09-28 批 DC 续-6）════════════════════════════════════════════
     用户口径（逐字）：「文案这块怎么办呢，我们文案要另外生成吗，统一一起生成的话，会不会更适配呢？
     我们生成的文案能不能实现他们的那种风格呢，我们要**避免文案千篇一律**，但是也要**成功模仿他们的
     风格**」。
     架构 = **分开生成、共享上下文**：他的 402 张图里几乎没有要读的字（英文文案条是拼版后期加的），
     文案全部活在发布层 ⇒ 生成时带上这一篇的全部要素（母体/手法/人物/补充），读起来才像同一次策划。
     防千篇一律的四条机制全在服务端（句式轮换/意象密度/判重/纪律复核，见 conceptCopywriting.mjs）——
     前端不写第二份。**扣费铁律**：按钮 onClick → 确认框（写明这一次扣多少）→ 确认后才发请求；
     失败/模型不可用由服务端释放 hold（如实告知"没有扣积分"）。
     ⚠️ 2026-09-28 批 DC 续-7：这一段从"只能单独点"改成**两条路共用一个函数**：
        ① 出图那一次提交里**并行**跑的那一跳（attempt=0，见 generate → runBatchCopy）；
        ② 结果区那颗「代写文案 / 再来一版」按钮（attempt=1,2…）。
        两条路写出来的结果落在**同一块**（图在上、文案在下），所以"两套文案"这件事根本不会出现。 */
  /** 请求 → 落到 postCopy state。两处调用方共用（成功路径只有这一份实现）。 */
  async function runPostCopy(attempt) {
    setPostCopyBusy(true);
    setError('');
    try {
      /* ⚠️ 入参是 **buildSkillCopyRequest**（纯函数，门禁逐字断言它不带任何图片地址）。
         随手把图塞进来 = 让文案"看图说话"，那是最差的一版文案（见 skillRun 里的注释）。 */
      const payload = await generateConceptCopy(buildSkillCopyRequest(skill, effectiveValues, { attempt }));
      const copy = payload?.copy || {};
      const titles = (Array.isArray(copy.titles) ? copy.titles : []).filter(Boolean);
      if (!titles.length && !String(copy.body || '').trim()) throw new Error('这一版没写出东西，请再试一次');
      setPostCopy({
        status: 'ready',
        attempt,
        titles,
        picked: 0,
        body: String(copy.body || ''),
        tags: (Array.isArray(copy.tags) ? copy.tags : []).join(' '),
        /* 把服务端的纪律复核结果如实带出来（用户看得到"为什么这一版被要求重写过"） */
        note: copy.discipline && copy.discipline.ok === false
          ? '有一处纪律没满足，已经自动重写过一版：' + copy.discipline.reasons.join('；')
          : '',
      });
      setNotice('文案写好了：挑一个标题，正文与标签可以直接改，改完复制走');
      await refreshBillingBalance?.().catch(() => undefined);
      return true;
    } catch (failure) {
      /* ⚠️ 这里**只动文案自己的 state**：出图那 N 张的 hold 与状态一律不碰
         （用户 2026-09-28 的顾虑「文案跟图片不在一个体系内」在失败隔离上同样成立 ——
          文案失败只退那 0.5，图照常出、照常交付）。 */
      const access = handleGenerationAccessError(failure, dispatch, { source: 'concept_copy' });
      const message = String(failure?.message || '').trim() || '文案没写出来，请稍后再试';
      setPostCopy(current => ({
        ...(current || {}),
        status: 'failed',
        attempt,
        note: access ? '还没有开始写，本次不扣积分。' : message + '（这次不扣积分）',
      }));
      return false;
    } finally {
      setPostCopyBusy(false);
    }
  }

  async function writePostCopy() {
    if (!state.logged) {
      dispatch({ type: 'SET_LOGIN_INTENT', intent: { destination: state.page, source: state.page } });
      dispatch({ type: 'SHOW_LOGIN', show: true });
      return;
    }
    const attempt = (Number(postCopy?.attempt) || 0) + 1;
    const isRedo = attempt > 1;
    const confirmed = await dialog.confirm({
      title: isRedo ? '再来一版文案？' : '代写这一篇的文案？',
      message: '会按这一篇的母体、手法与补充写一组发布文案（标题 3 选 1 + 正文 + 话题标签），'
        + `正文与标签可以自己改。本次扣 ${CONCEPT_COPY_POINTS} 积分，写不出来不扣积分。`,
      confirmLabel: isRedo ? '再来一版' : '代写文案',
    });
    if (!confirmed) return;
    await runPostCopy(attempt);
  }

  /* 一键复制的文本：标题取选中的那一个 + 正文 + 标签（**发布时粘一次就够**） */
  function copyPostCopyAll() {
    const titles = Array.isArray(postCopy?.titles) ? postCopy.titles : [];
    const title = titles[Number(postCopy?.picked) || 0] || titles[0] || '';
    const text = [title, String(postCopy?.body || '').trim(), String(postCopy?.tags || '').trim()]
      .filter(Boolean).join('\n\n');
    if (!text) return;
    const write = globalThis.navigator?.clipboard?.writeText;
    if (typeof write === 'function') {
      write.call(globalThis.navigator.clipboard, text)
        .then(() => setNotice('已复制：标题 + 正文 + 标签，直接粘到小红书'))
        .catch(() => setNotice('复制失败，可以手动选中这一段'));
      return;
    }
    setNotice('这个浏览器不让自动复制，手动选中这一段吧');
  }

  /* ═══ 存到我的资产：拼版图**服务端还不知道它**，所以要走既有的上传链路先落成稳定素材 ═══════════
     实测（saveWorkToAssets / server/ecommerceEngine/assetUpload）：能进资产库的只有
     `/api/generated-assets/<64hex>.(jpg|png|webp)` 这种稳定地址。
     所以顺序是：① 把 blob 当 dataURL 传给既有的 /api/ecommerce/assets（本站上传链路，
     role=reference）→ 拿回稳定地址；② 再用既有的 saveGeneratedUrlsToAssets 注册进资产库。
     ⚠️ 全程不新增端点、不重复实现一遍资产注册（幂等由这两条既有链路各自保证）。 */
  async function saveSheetToAssets() {
    if (!sheet?.blob) return;
    if (!state.logged) {
      dispatch({ type: 'SET_LOGIN_INTENT', intent: { destination: state.page, source: state.page } });
      dispatch({ type: 'SHOW_LOGIN', show: true });
      return;
    }
    setSheetSaving(true);
    setError('');
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('这张拼版读不出来，请重新拼一次'));
        reader.readAsDataURL(sheet.blob);
      });
      const uploaded = await uploadEcommerceAsset({ data: dataUrl, role: 'reference' });
      const result = await saveGeneratedUrlsToAssets([uploaded?.url].filter(Boolean), { title: skill?.name || '拼版成品图' });
      if (result.added) setNotice('拼版已存到「我的资产」（长期保留，可当参考图继续用）');
      else if (result.skipped) setNotice('这张拼版已经在「我的资产」里了');
      else setError('存进资产库失败，请稍后重试');
    } catch (failure) {
      if (!handleError(failure)) setError(failure?.message || '存进资产库失败，请稍后重试');
    } finally {
      setSheetSaving(false);
    }
  }

  /* 历史操作②：删除（软删除，服务端可恢复） */
  async function deleteHistory(item) {
    const saveKey = item?.saveKey;
    if (!saveKey) return;
    setError('');
    const ok = await deleteWork(saveKey).catch(() => false);
    if (!ok) { setError('删除失败，请稍后再试'); return; }
    dispatch({
      type: 'SET_WORKS',
      works: (Array.isArray(state.works) ? state.works : []).filter(work => String(work._saveKey || work.id) !== String(saveKey)),
    });
    setNotice('已从历史里删除（服务端仍可恢复）');
  }

  function handoffToBoard() {
    const plan = HANDOFF_BY_PIPELINE[skill.pipeline] || { mode: 'visual' };
    const visualSkillId = VISUAL_SKILL_IDS[skill.id];
    dispatch({ type: 'NAVIGATE', page: 'home' });
    dispatch({ type: 'SET_MODE', mode: plan.mode });
    dispatch({
      type: 'SET_CREATION_LAUNCH',
      launch: {
        mode: plan.mode,
        nonce: Date.now() + '-' + skill.id,
        ...(plan.recipeId ? { recipeId: plan.recipeId } : {}),
        ...(plan.subMode ? { subMode: plan.subMode } : {}),
        ...(visualSkillId ? { skillId: visualSkillId } : {}),
      },
    });
  }


  /* data-surface 是**三级视觉语言**的挂点（用户批注 #11-④）：
       hub = 总页面（浏览面，近白微暖）· subpage = 子页面（工作面，纯白）。
       首页（营销面）不在这里 —— 它是暖米底，由 .homepage-shell 一族负责。
       挂成属性而不是两个类名，是为了让"这一屏属于哪一级"在 DOM 上可被断言。 */
  /* ═══ ⚠️ 2026-09-19 批 J-⑭ 修：**这个 hook 必须在下面那个 early return 之前** ═══════════════
     下面那行 `if (!skill) return <div data-surface="hub">` 是**提前返回**：返回 Hub 时它一跳过，
     后面所有 hook 就都不执行了 —— React 直接抛
       「Rendered fewer hooks than expected. This may be caused by an accidental early return statement」，
     整页塌成错误页。实测：在子页面点顶栏「返回」→ 地址栏变回 /image-creation，**页面一片空白只剩报错**。
     （这是 e2e 抓到的：它点完返回等 .media-hub，等 15s 等不到。之前那条 .topbar-back 点击超时
       把真正的症状盖住了 —— 元素"不稳定"其实是因为**它所在的树正在崩**。）
     ⚠️ 规则：**任何新加的 hook 都得放在最早的那个提前返回之前**，不能图省事写在 JSX 前面。
     （批 K-C：这里那个 useDialog() 曾是预览确认框用的；预览改走三步方案预览组件后它没有调用方了，
       于是**连 hook 带 import 一起删掉** —— 留着就是一段没人用的死代码。
       ⚠️ 踩坑记录：删 import 时漏删了这里的调用，实测**整页塌成错误页**
       「useDialog is not defined」——e2e 因为只钩了 pageerror 没抓到，是我用 CDP 直接读页面文案才看见的。
       ⚠️ 2026-09-27 批 DC-4：**它又回来了**，但这一次有真的调用方 ——
          「做成动图」这颗按钮点下去会**扣积分**，按铁律②「没有用户确认绝不扣费」，
          点之前必须先弹一次确认（沿用全站同一个 DialogProvider，与 NoteModal 那颗
          「重新生成这张图片？」同一口径）。没有第二个 hook 被加回来。） */
  const dialog = useDialog();
  /* ═══ 2026-09-19 批 K-C：图片侧「预览」升级成三步方案预览 ═══════════════════════════════════
     用户第 16 轮原话：「图片生成这边是没有这个代为撰写的，这个分析方案的步骤是在那个**预览**的那个地方……
     这个预览实际上就跟这个代为撰写是一样的东西……它实际上就是**一个设计方案**。然后再进行生成。」
     ⇒ 入口留在配置面板的「生成预览」按钮（previewStep 那两条技能），
       点开就是与视频侧**同一份**三步对话框（① 素材理解可改 ② 方向与偏好 ③ 方案预览可改、确认并应用）。
     ⚠️ 它是 state 不是 hook，但**照样必须待在这里**（最早的提前返回之前）——
       上一轮教学示例的 useMemo 写在返回之后，点「返回」直接把整页搞崩过。 */
  /* ═══ 批 BX：**会话**而不是"打开一次就丢" ═══════════════════════════════════════════════
     用户口径（逐字）：「生成预览方案和生成脚本这种弹窗形式的，应该是用户可以关掉这个弹窗，
     但是**再点一次这个按钮可以回到这个弹窗里面**啊。」
     ⇒ 这一个 state 同时带着三件事：这次用的输入（prompt/materials）、弹窗是否展开（opened）、
       以及"有没有一份还没应用的方案"（由弹窗报上来，planUnapplied）。
       关掉只把 opened 置 false —— 组件不卸载，方案与用户在步①/②/③ 改过的东西都还在。 */
  const [planSession, setPlanSession] = useState(null);
  const [planUnapplied, setPlanUnapplied] = useState(false);
  /* 批 CD：正在存进资产库的那条记录（防连点，也用来显示"存入中…"） */
  const [historySavingId, setHistorySavingId] = useState('');
  /* ═══ 批 DC（M3）：版式层的成品图（拼完的结果 + 它用的是哪一族）══════════════════════════════
     形状：{ url（objectURL）, blob, family, count }；没拼过就是 null。
     ⚠️ objectURL 必须在换一篇/卸载时 revoke（否则每拼一次泄漏一份几 MB 的 blob）。 */
  const [sheet, setSheet] = useState(null);
  const [sheetBusy, setSheetBusy] = useState(false);
  const [sheetSaving, setSheetSaving] = useState(false);
  /* ═══ 2026-09-27 批 DC-4：「做成动图」的两个 state ═══════════════════════════════════════════
     · livePhotoOffer —— 服务端给的**价目与规格**（按钮上那个数字就是它的 points；
       取不到就**不渲染这颗按钮**：宁可少一颗，也不许在页面上写死一个价）。
     · livePhoto —— **逐张**的状态（{ [slotIndex]: { status, url, note, seconds } }）：
       用户可能只给其中一张做动图，也可能几张同时在做，所以状态按槽位分开存，
       「正在做 / 做完了给下载 / 没做出来（并说明没扣积分）」都就近长在那一张下面。 */
  const [livePhotoOffer, setLivePhotoOffer] = useState(null);
  const [livePhoto, setLivePhoto] = useState({});
  /* ═══ 版式层的两个"只在拼版时用"的输入（2026-09-28 批 DC 续-3）════════════════════════════════
     · sheetTemplate —— 信息图的三种排法（左图右文 / 词典卡 / 大字色块）；
     · sheetCopy     —— 用户自己写的标题与正文（宝丽来用它当相纸上的短句，信息图用它当版式里的字）。
     ⚠️ 两者都**不进提示词、不进请求**：它们是拼版层加的东西（实测那些版式页上的文字是后期排的），
        所以用户改文案不需要重新出图，重新拼一次就好。 */
  const [sheetTemplate, setSheetTemplate] = useState(LAYOUT_INFO_DEFAULT_TEMPLATE);
  const [sheetCopy, setSheetCopy] = useState({ headline: '', body: '' });
  /* ═══ 「代写这一篇的文案」（2026-09-28 批 DC 续-6）══════════════════════════════════════════
     状态按**这一篇**存（{ status, titles[], picked, body, tags, note }）：
     标题三选一（radio）、正文/标签都可编辑（模型给的只是初稿，用户改完再复制走）；
     attempt 计数让「重新生成」成为有意的新动作（服务端照 0.5 积分/次，确认框里看得见）。
     ⚠️ 只对概念视觉方案出现（CONCEPT_SKILL_ID 同 LIVE_PHOTO_SKILL_ID 的判据）。 */
  const [postCopy, setPostCopy] = useState(null);
  const [postCopyBusy, setPostCopyBusy] = useState(false);
  useEffect(() => () => { if (sheet?.url) { try { URL.revokeObjectURL(sheet.url); } catch { /* 忽略 */ } } },
    [sheet?.url]);
  /* ═══ 「做成动图」的价目：进这条技能时问一次服务端（**不是扣费调用**，只是一次只读读取）══════
     为什么不写在页面里：铁律「定价只有一个来源 = 后端目录」（test/pricing-single-source）。
     所以按钮上的数字 = 服务端从 catalog 算出来的 points；取不到就 null ⇒ 那颗按钮根本不渲染，
     绝不会出现"页面上写着一个价、账上按另一个价扣"。
     ⚠️ 读失败**不报错**：这条链路取不到价就退化成"这一版没有这颗按钮"，不该让整页顶一条红字。 */
  useEffect(() => {
    if (skill?.id !== LIVE_PHOTO_SKILL_ID) { setLivePhotoOffer(null); return undefined; }
    let cancelled = false;
    fetchLivePhotoOffer()
      .then(offer => { if (!cancelled) setLivePhotoOffer(offer?.ready ? offer : null); })
      .catch(() => { if (!cancelled) setLivePhotoOffer(null); });
    /* 换技能/换一篇就把上一轮的动图状态清掉：它是**这一篇那几张**的产物，留着会挂错图 */
    setLivePhoto({});
    return () => { cancelled = true; };
  }, [skill?.id]);
  const closePlanPreview = () => setPlanSession(current => (current ? { ...current, opened: false } : null));
  /* 换技能就把这份会话丢掉：它的 prompt/materials 来自上一条技能的字段，留着会串味。
     ⚠️ 这同时是"确认离开"之后的收尾 —— 那份方案确实没地方可去了（提示里就是这么说的）。 */
  useEffect(() => {
    setPlanSession(null);
    setPlanUnapplied(false);
    /* 换技能／换一篇就把上一张拼版丢掉：它是**这一篇**的成品图，留着只会让人以为拼错了 */
    setSheet(null);
  }, [skill?.id]);
  /* ⚠️ 这个 hook 必须**放在那个 `if (!skill) return <MediaHub/>` 提前返回之前** ——
     放后面就会出现"这一轮少调了一个 hook"，整页塌成错误页（本文件踩过同类雷）。 */
  usePlanLeaveGuard(planUnapplied);
  /* ⚠️ 批 K-C 实测抓到的真 bug：方案应用之后如果不再记一笔，用户点「生成图片」会**又弹一次**
     三步方案预览（previewStep 仍然是 true）—— 用户会以为点了没反应，其实是又回到了方案页。
     e2e 当场卡在这里：对话框走完了、第二次点 CTA 又把对话框打开了。
     ⇒ 记住「这条技能这次已经出过方案」，第二次点 CTA 就直接生成。换技能时重置。 */
  const [planApplied, setPlanApplied] = useState(false);
  useEffect(() => { setPlanApplied(false); }, [skill?.id]);
  /* ═══ 2026-09-28 批 DC 续-7：预览那一步的按钮旁**说清"确认后会出几张"** ═══════════════════════
     用户原话：「**因为你这个工作台里面并没有给我张数呀。我根本就不知道你产出的到底是多少张？**」
     —— 而这一页默认先走方案预览，按钮上那 0.5 是"预览这一步"的钱，
     于是整页从头到尾**没有一个数字说这一篇会出几张**。
     ⇒ 预览步（`skill.previewStep && !planApplied`）时在按钮下面写这一句。
        它说的是**将要发生的事**，不是解释这个按钮是干什么的（那种话批 BF 已经删过一次）。
     ⚠️ 位置在 `planApplied` 声明之后：它是 state，同作用域里 const 声明之前用就是 TDZ。 */
  const previewHint = useMemo(() => {
    if (!skill?.previewStep || planApplied || handoff) return '';
    const n = skillGenerationSettings(skill, effectiveValues).count;
    if (!n) return '';
    return '这一步只出方案；确认后将出 ' + n + ' 张图' + (copyInBatch ? ' 和一组发布文案' : '');
  }, [skill, planApplied, handoff, effectiveValues, copyInBatch]);
  /* ═══ 2026-09-19 批 J-⑭ 后半句：教学示例（用户批注 image#1）═══════════════════════════════
     用户原话：「他视频制作这边的子页面**绝大部分是有教学示例的**，你要**结合教学示例做深度匹配**，
     按他的讲解 + 工作台里**真实有的按钮和功能**去做规划和设计。」
     ⚠️ 内容全部来自**声明源**，一句都不编：媒体位只放这条技能**真实存在的案例封面**，
        没有就如实写「教学示例还在制作中」（本站铁律：生成结果一律不许伪造）；
        文字块 = 要准备什么（字段分组）/ 它会交出什么（交付清单）/ 这条技能在做什么（能力说明）。
     ⚠️ **它是 hook，必须待在这个位置**（最早的提前返回之前）—— 上一版写在返回之后，
        结果"点返回"直接把整页搞崩（见上面那条注释）。 */
  const tutorial = useMemo(() => {
    if (!skill) return null;
    const media = (Array.isArray(skill.cases) ? skill.cases : [])
      .map(item => item && item.cover)
      .filter(Boolean)
      .slice(0, 3);
    const blocks = [];
    const groups = [];
    /* ⚠️ 有分组用分组名（图片侧的技能都分了组）；**没有分组就用字段名** ——
       视频侧那 42 条技能的字段就是「模型 / 清晰度 / 时长 / 运镜」这几档，本身已经是一份
       "你要准备什么" 的清单元数据。不加这条兜底，视频侧的教学示例就只剩一块正文
       （而这恰恰是用户要"按教学示例深度匹配"的那一侧）。 */
    for (const field of skill.fields || []) {
      const label = field.group || field.label;
      if (label && !groups.includes(label)) groups.push(label);
    }
    if (groups.length) blocks.push({ title: "要准备什么", lines: groups });
    if (deliverables.length) {
      blocks.push({
        title: "它会交出什么",
        lines: deliverables.map(item => item.name + (item.hint ? "（" + item.hint + "）" : "")),
      });
    }
    const about = skill.outcome || skill.summary || skill.brief || skill.description || "";
    if (about) blocks.push({ title: "这条技能在做什么", lines: [about] });
    return { media, blocks };
  }, [skill, deliverables]);
  /* ═══ 2026-09-28 批 CY-⑫：**从哪儿进来的，「返回」就退回哪儿**（用户原话，逐字）══════════════════════
     用户原话：「我现在在图片生成和视频生成的任意一个子页面去点击进去访问之后，**当我点击左上角的返回按钮
       之后，它出来好像一直都会出现在这两个总页面的最上方**，这肯定是不对的呀。**我在哪个页面点进去的？
       那我退出来，当然是在这个刚点击进去的时候的这个地方呀。**」
     根因：`openSkill` 与 `backToHub` 都写死 `window.scrollTo({ top: 0 })` —— 进子页面当然要从顶上开始，
     但**回 Hub 时把用户原来的位置也一起抹掉了**（Hub 与子页面是**同一个页面**，只是带不带 ?id，
     所以滚动位置本来就是同一个文档的，记一下就能还回去）。
     ⇒ 从 Hub 点卡片时记下当时的 scrollY，回 Hub 时恢复；深链/换板块进来的没记过 ⇒ 回 0（与从前一致）。 */
  const hubScrollRef = useRef(0);
  const openSkillFromHub = useCallback(id => {
    hubScrollRef.current = (typeof window !== 'undefined' ? window.scrollY : 0) || 0;
    openSkill(id);
  }, [openSkill]);
  /* 回到 Hub 之后再恢复（放在 effect 里：这时 Hub 已经渲染完，高度撑起来了，
     在 backToHub 里直接 scrollTo 会**因为页面还没长高而被裁到 0**）。 */
  useEffect(() => {
    if (skillId) return undefined;
    const top = hubScrollRef.current || 0;   /* 没记过（深链/换板块进来）= 0，与从前一致 */
    const frame = window.requestAnimationFrame(() => window.scrollTo({ top, behavior: 'auto' }));
    return () => window.cancelAnimationFrame(frame);
  }, [skillId]);

  if (!skill) return <div className="media-creation" data-surface="hub"><MediaHub board={board} onOpenSkill={openSkillFromHub} /></div>;

  /* 就近反馈（错误 / 提示）单独拎出来：嵌入形态下它要挂到页面**顶部**那条线上，
     而不是塞在右栏页签上面 —— 用户点完历史里的「用这组参数」会被滚回顶部，
     提示却留在页面下方的话，等于没提示。 */
  const announce = (
    <>
      {error && <p className="media-run-global" role="alert"><AlertCircle size={14} />{error}</p>}
      {notice && <p className="media-run-notice">{notice}</p>}
      {/* 融合动作带过来的说明：说清"这张结果是从哪来的、下一步点哪里、会不会再花钱" */}
      {carryHint && <p className="media-run-carry">{carryHint}</p>}
    </>
  );
  /* 版式层（M3；2026-09-28 四族齐备）：只有"能拼"时才把这颗入口交给结果区 ——
     available 的判据与拼版函数同一份（layoutSheetPlan 返回 null 就是拼不了）。
     ⚠️ 「不拼版」（中性档）时**入口仍然在**：拼版是免费的后期动作，实测 85% 的图虽然是单图，
        但"这一篇要不要拼一张"完全可以在**看完结果之后**再决定（不必先回面板改字段）。
        所以这一段给的是"选一族"的入口，选完写回**同一个字段**（onPickFamily → setValues），
        值仍然只有一处（声明源那一栏），这里只是第二个入口。 */
  const sheetDone = (run?.slots || []).filter(slot => slot.status === 'completed' && slot.url).length;
  const sheetPlan = layoutSheetPlan({
    family: effectiveValues.layout, count: sheetDone, template: sheetTemplate,
  });
  const sheetAction = {
    available: true,
    family: String(effectiveValues.layout || ''),
    familyOptions: layoutFamilyOptions(),
    isNone: isLayoutNONE(effectiveValues.layout),
    families: layoutFamilies(),
    templates: LAYOUT_INFO_TEMPLATES(),
    template: sheetTemplate,
    copy: sheetCopy,
    needsCopy: effectiveValues.layout === '品牌信息图' || effectiveValues.layout === '宝丽来画中画',
    canCompose: Boolean(sheetPlan),
    count: sheetDone,
    planFamily: sheetPlan ? sheetPlan.family : '',
    url: sheet?.url || '',
    busy: sheetBusy,
    saving: sheetSaving,
    onCompose: () => { void composeSheet(); },
    onDownload: downloadSheet,
    onSaveAssets: () => { void saveSheetToAssets(); },
    onPickFamily: value => {
      /* 换族就把上一张成品图撤掉：它是**另一族**的产物，留着会让人以为换族没生效 */
      setSheet(null);
      setValues(prev => reconcileFieldValues(skill.fields, { ...prev, layout: value }));
    },
    onPickTemplate: value => { setSheet(null); setSheetTemplate(value); },
    onCopyChange: (key, value) => setSheetCopy(prev => ({ ...prev, [key]: value })),
  };
  /* 「做成动图」：把**服务端给的价目**与逐张状态交给结果区。
     ⚠️ 取不到价目（offer 为 null）就整个不渲染 —— 宁可少一颗按钮，也不许在页面上写死一个价。 */
  const livePhotoAction = livePhotoOffer
    ? {
        offer: livePhotoOffer,
        states: livePhoto,
        onMake: index => { void makeLivePhoto(index); },
        onRecheck: index => { void recheckLivePhoto(index); },
        onDownload: downloadLivePhoto,
      }
    : null;
  /* 「代写这一篇的文案」：只在概念视觉方案上出现（与「做成动图」同一条判据），
     一次 0.5 积分（价格来自目录常量，与确认框里的数字同源）。 */
  const postCopyAction = skill?.id === LIVE_PHOTO_SKILL_ID
    ? {
        points: CONCEPT_COPY_POINTS,
        state: postCopy,
        busy: postCopyBusy,
        onWrite: () => { void writePostCopy(); },
        onPick: index => setPostCopy(current => (current ? { ...current, picked: index } : current)),
        onEdit: (key, value) => setPostCopy(current => (current ? { ...current, [key]: value } : current)),
        onCopyAll: copyPostCopyAll,
        onReset: () => setPostCopy(null),
      }
    : null;
  /* ═══ 2026-09-28 批 CY-⑩（CV-2 第 2 步·反向）：**子页面 → 画布**（逐张「送到画布」）══════════════
     用户拍板：「画布↔子页面的入口位置，可以，你做吧」。这条与"画布 → 子页面"（批 CY-⑨）**对称**：
       · 载体仍是**同一个**跨路由 `creationLaunch`（站内只有一个，别再造第二个），kind = `to-canvas`；
       · 节点上的 `skillId / title / prompt` 一起带过去 ⇒ 到了画布上还能原路回这一页（闭环）；
       · **不花一分钱**：只发数据 + 导航（画布侧只 append 一个节点，见 canvasWorkbenchInbound.js）。
     ⚠️ 只送**已就绪、有 url 的成品**；占位/失败项不送（送了就是空壳节点）。 */
  /* ⚠️ **必须是普通函数，不能写成 useCallback** —— 这一行在 `if (!skill) return <MediaHub/>` **之后**
     （那个提前返回在第 1941 行附近），在这里调 hook 就会出现"这一轮少调了一个 hook"，
     整页塌成错误页：本批第一版就是这么栽的 —— e2e 场景 ⑱b（子页面点「返回」→ 等 `.media-hub`）
     当场 15 秒超时，而**纯 HEAD 复跑同一条 e2e 是全绿的**（那次判别把锅认定在我这边）。
     本文件对这个坑有前车之鉴：`usePlanLeaveGuard` 上面那段注释写着同一句话。 */
  const sendResultToCanvas = index => {
    const slot = run?.slots?.[index];
    const url = String(slot?.url || '').trim();
    if (!url) { setNotice('这一张还没有成图，先等它生成完'); return; }
    const planField = planPreviewTargetKey(skill);
    dispatch({
      type: 'SET_CREATION_LAUNCH',
      launch: {
        kind: 'to-canvas',
        skillId: skill.id,
        title: skill.name || '工作台结果',
        prompt: String(values?.[planField] || ''),
        images: [{ url, assetId: slot.assetId || '', name: `${skill.name || '结果'} ${index + 1}` }],
      },
    });
    /* ⚠️ 必须用 **OPEN_CANVAS**，不是 `NAVIGATE page:'ec-canvas'` —— 两者差别是实测出来的：
       用 NAVIGATE 时画布会挂载、图也加上了，但**两三秒后被弹回子页面**
       （`canvasEntryTab` / `galleryItem` 没被一起复位，画布进的是上一次的入口态）；
       换成 App 打开画布的规范动作（侧边栏「无限画布」走的就是它，见 CreativeDomainNav 的
       `action.type === 'OPEN_CANVAS'` 分支：**只 dispatch、不推 URL**）之后，落上去就稳住了
       （`.qa/cy10-send-to-canvas.mjs` 第 ⑥ 步"3 秒后仍在画布上"守着这条）。 */
    dispatch({ type: 'OPEN_CANVAS' });
  };
  const status = (
    <>
      <RunPanel run={run} skillName={skill.name} busy={busy} onRetry={retryFailedAssets} onDownload={generate} fuseActions={fuseActions} onFuse={fuseFromResult} sheet={sheetAction} livePhoto={livePhotoAction} postCopy={postCopyAction} onSendToCanvas={sendResultToCanvas} />
      {announce}
    </>
  );

  /* ═══ 整块嵌入的既有工作台（小红书图文 / 视频）══════════════════════════════════
     用户 9-17：「生成结果直接在工作台里面展示，不必像之前一样生成完就一定要跳进去画布里面」。
     这两条链路各自的参数控件与生成按钮**都在它自己的工作台里**，所以这里不再渲染通用字段栏与通用 CTA
     （两个 CTA 会让人不知道按哪个）；结果与历史仍然落在这一页：
       · 结果：图文走既有的结果视图，视频走嵌入工作台里的结果台（inlineResult）；
       · 历史：右侧「历史」页签按这条技能筛（图文按 mediaSkillId，视频按本机任务标记）。
     ⚠️ key={skill.id}：换技能必须**重挂载**嵌入的工作台 —— 否则上一条技能的提示词、素材、
        已确认方案会留在下一次生成里（这是会花钱的串味，不是显示问题）。 */
  const embeddedFlow = !embed ? null : (embed === 'xhs'
    ? <XhsContentMode key={skill.id} compactMode historySkillId={skill.id} />
    : (
      <VideoStudioPage
        key={skill.id}
        embedded
        inlineResult
        /* ═══ 批 N：这条 skill 的**左栏工作台规格**（声明源 src/skills/videoWorkbenches.js）═══════
            用户第 18 轮：「他们这些 skill 页面……**每个工作台都是不一样的呀**，你现在完全没抄，
              用的依然是我们之前首页的视频生成版本糊弄我……**对应的一比一去抄啊**」。
            规格逐条抄自知渔 20 个视频 skill 页面（docs/design/64 §8 的逐字抄录）。
            没有声明的工作台（辅助能力那三条，它们本来就没有自己的子页面）= null ⇒ 与从前一致。 */
        workbench={getVideoWorkbench(skill.id)}
        /* 批 AG：把 skill id 一并传下去 —— 创作台要按 videoSpecExposure 决定
           「模型 / 清晰度 / 时长」这三格露不露（照知渔那一页，用户口径：一比一对应）。
           ⚠️ 探针实测过：靠对象身份在创作台里反查 id 会拿到空值（拿到的是不同的引用），
              于是全都走了 fallback（三项全隐藏）—— 连知渔**有**模型格的 5 页也被隐藏了。
              所以这里必须**显式传**，不许再靠身份反查。 */
        workbenchSkillId={skill?.id || ''}
        /* ═══ 批 S：视频子页面的「参数配置」组头**照知渔逐页全量计数**决定（不是全站一刀切）═════
           证据：docs/design/data/quantv-video-pages.json 的 32 条 panelText 全文检索 ——
             · 有「参数配置」25 条：24 个 app 页 + 1 条路由页（视频字幕去除）
             · 没有 7 条：6 条路由页（视频创作 / 爆款复刻 / 探店视频 / 内容替换 / 数字人 / 视频高清）
               + 趣味脱口秀（app）
           ⇒ 路由型（/ai-video 这一族）**不渲染组头**（第一格直接是字段），app 页保持组头。
           判据从对照表派生（quantvVideoShowsParamGroup），页面里不写第二份名单。 */
        groupTitle={quantvVideoShowsParamGroup(skill.id) ? '参数配置' : ''}
        /* 子页面里**不自动跳画布**：结果留在这一页的成片台上（用户 9-17 口径） */
        autoOpenCanvas={false}
        initialMode={skillVideoMode(skill)}
        skillTag={skill.id}
        /* ═══ 2026-09-27 批 CL：**配方提示词不再预填**（用户改向，原话逐字）══════════════════════
           原话：「你现在这个提示词框里面**依然是默认会有这段提示词出来**，我不明白这是为什么呀？
           你这个问题一定要把它解决掉呀。我现在只要一刷新页面，它这段提示词就会出现的。」
           ⇒ 这条判据（"进子页面该看到这条玩法该怎么拍"）是 2026-09-17 定的，本轮被用户推翻：
             输入框进去必须是**空的**（配方仍挂在 `data-video-recipe` 上做断言锚点，值不变）。
           ⚠️ **历史里点「用这组参数」仍然要还原**（那条是用户主动点的）⇒ 两件事必须分开：
             这里的配方带 `source: 'skill'`，VideoStudio 见到它**只设规格、不填提示词**；
             videoSeed（历史还原 / 做同款）不带这个标记，照旧预填提示词与规格。 */
        preset={videoSeed || { prompt: buildSkillBrief(skill, initialSkillValues(skill)), mode: skillVideoMode(skill), source: 'skill' }}
        presetNonce={videoSeedNonce}
        onJobs={setVideoJobs}
      />
    ));
  const panel = embed ? <>{announce}{embeddedFlow}</> : null;

  /* ═══ 2026-09-19 批 J-⑭：预览型技能**先预览、确认后再生成** ═══════════════════════════════
     用户原话（这一轮最重的一条）：
       「它里面有一个叫**代为撰写**的功能。这个功能它实际上就是**我们图片生成那边的板块里面的
        那个预览的功能**。只是图片的话，他在生成的配置做好之后**进行预览，然后再去生成**，
        这样的流程会更合理一些……**但他们的内在逻辑其实是一样的。**
        你照抄他的思路去做就对了，**整个UI和设计你也要跟他一样去做**。」
     所以：商品套图 / A+内容 / 详情图这三条（竞品对应 CTA 原文也是「生成预览」）
     点主按钮**先摊开"这次到底要发什么"**，用户确认之后才真出图、才扣积分。
     ⚠️ 竞品那一步是**花积分**的（生成预览 0.10）；我们这一步**不额外收费** ——
        它只是把配置摊开看一眼，生成时仍按原价扣。要不要收费是定价决定，不由这一轮擅自定。
     ⚠️ 预览里写的每一句都必须是**真的会发生的事**：规格来自当前选中的值、交付清单来自
        声明源或平台方案。绝不写"AI 已经帮你写好了"这种我们没做的事。 */
  /* ⚠️ **套图（suite）不再叠一层对话框**：它自己的流程本来就是"先出方案 + 报价，确认后才跑"
     （方案编辑器 + 报价弹窗），那**就是**这条技能的预览步 —— 再叠一层就是让用户连点两次确认。
     所以：对话框只给"点下去会直接出图"的那几条预览型技能（A+内容 / 详情图）；
     套图的按钮文案照样写「生成预览」（它确实先给方案），但走它自己那套确认。 */
  const previewStep = Boolean(skill?.previewStep) && !handoff && !suite;
  /* ⚠️ 批 K-C **改判**（有授权的改判，依据 docs/design/62-batch-K-annotations.md 第一节/第二节）：
     批 J-⑭ 时这一步不额外收费，因为那时它只是把配置摊开看一眼、没有任何模型调用；
     现在它升级成**三步方案预览**（素材理解 → 方向偏好 → 方案生成），**真的会调用模型**，
     所以按用户拍板的 **0.5 积分/次** 收费（SKU ec_plan_preview：先报价、用户确认才扣、失败不扣）。
     旧的 buildPreviewBody（把配置摊开看一眼的那一版）已删除：它没有调用方了。 */
  /* 预览型的技能改走这条路；其余技能（去除背景 / 图片复刻 / AI换装…）点下去就是直出，
     与现在完全一致 —— 用户批注 #1-1：「有些 skill 是直接生成图片，不会生成预览」。 */
  /* ⚠️ 真出图这一步单独起一个**命名处理器**：charge-requires-confirmation 门禁要求
     「每个扣费点都能追溯到用户手势」，而 onGenerate 是三元表达式里的箭头函数，
     AST 拿不到稳定函数名 → 追溯会断在 (anonymous) 上（实测：把调用挪进 runGenerate 后门禁转绿，
     之前它是靠函数体里的 dialog.confirm 当锚点才过的 —— 那个确认框已经被 K-C 的三步对话框取代）。 */
  const runGenerate = () => (suite ? generateSuite() : generate());
  const onGenerate = handoff ? handoffToBoard : async () => {
    if (previewStep && !planApplied) {
      /* 批 K-C：预览型技能先走**三步方案预览**（0.5 积分/次，点之前弹计费确认，失败不扣）。
         「确认并应用」把方案正文写回配置里的文字字段，用户再点一次才是真出图 ——
         与知渔第 3 步「确认脚本并应用」同一口径（他们也是应用回输入框，再点生成）。
         ⚠️ 批 BX：**关掉弹窗不等于丢掉方案** —— 用户口径「生成预览方案……这种弹窗形式的，
            应该是用户可以关掉这个弹窗，但是再点一次这个按钮可以回到这个弹窗里面啊」。
            所以这里只把弹窗**收起来**（open=false，组件不卸载、方案与用户改过的东西都留着），
            而弹窗自己比对输入签名：需求/素材没变就直接摆回上一份，变了才是新的一份。 */
      setPlanSession(current => ({
        materials: collectPlanMaterials(effectiveValues, skill),
        prompt: collectPlanPrompt(effectiveValues, skill),
        opened: true,
        /* 上一次那轮已经生成过方案 ⇒ 保持同一个会话对象，让弹窗自己决定"摆回旧方案还是重新走" */
        session: current?.session || 0,
      }));
      return undefined;
    }
    return runGenerate();
  };

  const applyPlanPreview = text => {
    const key = planPreviewTargetKey(skill);
    if (key) setValues(previous => ({ ...previous, [key]: text }));
    setPlanSession(current => (current ? { ...current, opened: false } : null));
    setPlanApplied(true);
    return undefined;
  };

  /* 降级时（模型没连上、方案是空的、一分钱没扣）的出口：关掉对话框，直接走原来的生成路径。 */
  const skipPlanPreview = () => {
    setPlanSession(null);
    setPlanUnapplied(false);
    setPlanApplied(true);
    return undefined;
  };

  /* ═══ 2026-09-19 批 J-⑭ 后半句：教学示例（用户批注 image#1）═══════════════════════════════
     用户原话：「他视频制作这边的子页面**绝大部分是有教学示例的**，你要**结合教学示例做深度匹配**，
     按他的讲解 + 工作台里**真实有的按钮和功能**去做规划和设计。」
     ⚠️ 内容全部来自**声明源**，一句都不编：媒体位只放这条技能**真实存在的案例封面**，
        没有就如实写「教学示例还在制作中」（本站铁律：生成结果一律不许伪造）；
        文字块 = 要准备什么（字段分组）/ 它会交出什么（交付清单）/ 这条技能在做什么（能力说明）。 */
  /* ⚠️ 批 J-⑭ 的教学示例 useMemo **已在这里删除**：它原本写在下面那个 early return 之后，
     返回 Hub 时被跳过 ⇒ React 抛「Rendered fewer hooks than expected」⇒ 整页塌成错误页。
     功能代码保留在提交 b6f5b388，重新落地时**务必放在最早的提前返回之前**。 */
  return (
    <div className="media-creation" data-surface="subpage">
      <SkillWorkbench
        board={board}
        skillId={skill.id}
        values={values}
        /* ⚠️ 2026-09-19 批 R：改一个字段要**连带夹取**依赖它的字段（声明源写 optionsFrom）。
           真事：模型选 Midjourney（上游只有 1K/2K）时清晰度若停在 4K，
           界面显示 4K、请求按 2K 跑、也按 2K 计费 —— "看着是 A、跑的是 B"。
           夹取规则只有一份实现（skillRun.reconcileFieldValues），这里不另写一遍。 */
        onFieldChange={(key, value) => {
          /* 2026-09-28 批 DC 续-7：改「本篇张数」那一格 = **把勾选清单重置成这一档**。
             这一格是清单规模的唯一入口（用户在清单里手动增删之后又回来调张数，
             期望就是"回到这一档的标准搭配"，所以这里覆盖而不是合并）。 */
          if (key === SKILL_MODULES_PRESET_KEY && Array.isArray(skill.modulesPresets) && skill.modulesPresets.length) {
            const preset = skill.modulesPresets.find(item => item && item.value === value);
            const count = Math.max(0, Math.min(skillModules.length, Number(preset && preset.count) || 0));
            setModuleOff(new Set(skillModules.slice(count).map(module => module.name)));
          }
          setValues(prev => reconcileFieldValues(skill.fields, { ...prev, [key]: value }));
        }}
        /* ⚠️ 2026-09-19 批 H-8：**不再**往工作台里传 onBack。
           用户批注 #12 把子页面顶栏写定为「左 返回 / 中 名称 / 右 积分账户」——
           返回控件在**顶栏**。原来工作台左栏里还有一个「← 返回创作」，
           两个按钮都回同一个 Hub、上下相距不到 200px，是纯冗余（用户最烦这种）。
           backToHub 本身没消失：它现在作为顶栏返回按钮的 onClick 被 publish 上去（见上面的 useLayoutEffect）。 */        /* ═══ 2026-09-19 批 I-11：主按钮文案按 skill 走，且必须**说的是真发生的事** ═══════════════
   用户批注 #1-1 原话：「他们的**不同skill有不同的策略**，这个 A+ 内容是生成预览，
   后续才会生成图片的，有些 skill 是直接生成图片，不会生成预览，**所以这个你自己也得做好判断啊**。」
   按用户要求去对比了竞品每个页面的主 CTA 原文（docs/design/50，CDP 实访）：
     商品套图 / A+内容 / 详情图 → **生成预览**（0.10 积分，两步走）
     图片复刻 / AI换装           → **生成图片**（0.60 积分，直出）
     去除背景                    → **去除背景**（0.40 积分，一键，用自己的动作名）
   ⚠️ **我们这三条"预览型"目前没有预览步**：点下去就是按张真出图、按张真扣费
      （我们 1.00 积分/张，竞品的预览只要 0.10）。所以按钮上**不能写「生成预览」** ——
      那会变成一句假话：用户以为先看到草稿，实际已经在花钱出正片了。
      诚实做法：写「生成图片」（= 真的会发生的事），把"要不要给这三条加预览步"留给用户拍板。
   所以这里的取值顺序是：技能自带 ctaLabel（如「去除背景」）→ 默认「生成图片」。 */
      /* ⚠️ 2026-09-19 批 J-⑭：三条预览型技能现在**真的有预览步**（见上面 previewStep 那段），
         所以按钮可以、也必须写真话「生成预览」—— 竞品那三条页面的 CTA 原文也是「生成预览」。
         之前这里只能写「生成图片」，是因为当时点下去就是按张真出图、按钮写「预览」会是假话。
         ⚠️ 批 DC 续-7 往后多了一档「出这一篇」，但**预览那档必须排在它前面**：
            方案还没确认时点下去只出方案，那一步只花 0.5 —— 标「出这一篇」就是把方案说成一篇图文。 */
      ctaLabel={handoff
        ? (board === 'video' ? VIDEO_HANDOFF_LABEL : (HANDOFF_LABEL[skill.pipeline] || '去工作台继续'))
        : ((skill.previewStep && !planApplied)
            ? '生成预览'
            : (copySupported ? '出这一篇' : (skill.ctaLabel || '生成图片')))}
        /* ═══ 2026-09-19 批 Q：**预览型技能，按钮上写的是"预览这一步"的价格** ═══════════════
           用户批注 #3-6：「我不明白为什么生成一下预览就要 7 点积分，我们的竞品他们就只有 0 点几的积分，
             你为什么不把那个生成预览的积分放上去呢？」
           原来是拿**整单出图**的报价（套图 7 积分）当预览价。预览这一步的真实价格是
           ec_plan_preview = 0.5 积分/次（用户已批准，先报价→确认→才扣）。
           方案确认之后按钮回到「生成图片」并显示真实出图报价（那时才是 7）。 */
        ctaPoints={handoff ? null : ((skill.previewStep && !planApplied) ? PLAN_PREVIEW_POINTS : points)}
        /* 2026-09-28 批 DC 续-7：副行改说**清单价与总额**（张数 × 单价 + 文案）。
           ⚠️ 预览步（方案还没确认）不给它 —— 那 0.5 是"预览这一步"的钱，
              整单报价在方案确认前说出来只会误导（用户批注 #3-6 的原意就是这个）。
              改由 ctaHint 那一句把"确认之后会出几张"说清楚（见下面 gateHint 的合并）。 */
        ctaPriceNote={handoff || !batchQuote || (skill.previewStep && !planApplied) ? '' : batchQuote.detail}
        /* 「同时出这一篇的发布文案」开关（默认开）。关掉 = 只出图，连确认框都不弹；
           ⚠️ 判据是 copySupported 而不是 copyInBatch —— 关掉之后这颗开关必须还在，
              否则用户开过一次就再也开不回来了。 */
        ctaExtra={copySupported ? (
          <label className="media-workbench-copy-toggle">
            <input
              type="checkbox"
              checked={postCopyEnabled}
              onChange={event => setPostCopyEnabled(event.target.checked)}
            />
            <span>同时出这一篇的发布文案（标题 + 正文 + 话题标签）· {CONCEPT_COPY_POINTS} 积分</span>
          </label>
        ) : null}
        ctaDisabled={busy || (!handoff && (!validation.ok || Boolean(moduleGate)))}
        ctaHint={previewHint || gateHint}
        status={embed ? null : status}
        onGenerate={onGenerate}
        onHistoryDelete={deleteHistory}
        onHistoryReuse={reuseHistory}
        onHistoryDownload={downloadHistory}
        onHistorySaveAssets={saveHistoryToAssets}
        historySavingId={historySavingId}
        history={history}
        panel={panel}
        tutorial={tutorial}
        /* ═══ 2026-09-19 批 Q-⑨：app 页左栏**只有一个「参数配置」组头**（照知渔实测）═══════════
           CDP 逐页量过（.tmp/qy-paramgroup2.mjs）：知渔电商海报设计 / 相似图生成 / 平面转建筑效果图
           的左栏都是 技能名 → 分类 → **参数配置**(y≈202) → 第一个字段(y≈252)，只有一个组头。
           内置 ?tool= 页（商品套图 / A+ / 详情图 / 复刻 / 去背 / 换装）是真有分组名的，保持原样。
           判据来自对照表本身（quantvImageParity.isQuantvAppPage），不在页面里再写一份名单。 */
        groupTitle={skill && board === 'image' && isQuantvAppPage(skill.id) ? '参数配置' : ''}
        deliverables={deliverables}
        sections={sections}
        paidActions={paidActions}
        /* ═══ 批 U（2026-09-21）：左栏那一颗「一键解析商品信息」**整块删除**（用户本轮原话）════
           原话：「你看一下图一，『产品卖点与设计风格，一键解析商品信息，0.2 积分』，这个**也是多余的**呀，
           下面不是都有一键润色卖点和一键解析风格吗，**各个子页面应该都有这个问题，你要去掉呀**。」
           —— 三颗都挂在同一片区域上：组行那颗读**商品图**回填商品字段，下面两颗一颗润色卖点文字、
              一颗判设计风格；而「判风格」与「读商品图」本来就是**同一次 auto-recognize 推理的两种用法**
              （见下面 paidActions 的注释），所以组行那一颗是重复入口。
           ⇒ 不再渲染 parseAction（组件那一侧的能力保留、调用点传 null，别的页面要复用还有路）；
              parseProductInfo 这条链路仍然活着：它现在是「一键解析风格」那次调用的同一份产物。
           ⚠️ 两处提到它的说明文案一并改掉（否则页面上会指着一颗不存在的按钮让用户去点）。 */
        parseAction={null}
        /* ═══ 2026-09-19 用户口径（本轮澄清，原文）═══════════════════════════════════════════
           「各个子skill自己的页面跑生成的话，一方面是会在工作台右边的**历史**里面展示自己这个
             skill 生成的历史记录，另一方面**同时也**会进入**我的作品**里面去。」
           「「生成记录」是什么鬼，不需要啊，左边导航栏有**我的作品**就够了。」
           所以空态文案改成说**这件事本身**：这条技能的历史在这里，同时也会进「我的作品」——
           不再把用户指去别处找什么「生成记录」（那个东西不存在，也不该存在）。 */
        emptyHistoryHint={embed === 'video'
          ? '这条技能还没有生成记录。在这里生成的视频会出现在这一栏里，同时也会进「我的作品」。'
          : (embed === 'xhs' ? '这条技能还没有生成记录，在上面写好内容点「生成图文」就会存在这里，同时也会进「我的作品」。' : '')}
      />
      {/* 批 K-C：三步方案预览（图片侧入口）。与视频侧「代为撰写」是同一个组件、同一条服务端流水线。
          ⚠️ 批 BX：**组件保持挂载**（`open` 在这里由 opened 控制，不再用 `{planSession && …}` 卸载）——
             关掉弹窗只是收起来，方案与用户改过的东西都留着，再点入口按钮立刻回来（不重新请求、不重复扣费）。 */}
      {planSession && (
        <PlanPreviewDialog
          open={planSession.opened}
          surface="image"
          /* 批 BW：把**这条 skill 是谁**带进去 —— 服务端据此取它自己的解析方案
             （概念视觉方案不会去解析卖点/人群/参数，见 src/skills/parseSpecs.js）。 */
          skillId={skill.id}
          skillName={skill.name}
          prompt={planSession.prompt}
          materials={planSession.materials}
          onClose={closePlanPreview}
          onApply={applyPlanPreview}
          onSkip={skipPlanPreview}
          onPlanStateChange={setPlanUnapplied}
        />
      )}
    </div>
  );
}