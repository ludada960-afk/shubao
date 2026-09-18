import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Download, RotateCcw, Sparkles, Wand2 } from 'lucide-react';

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
import { getImageSkill } from '../../skills/imageSkills.js';
import { getVideoSkill } from '../../skills/videoSkills.js';
import { boardOfPage, canCarryResultAsInput, fuseActionsOf, hubPath, skillPath as skillDeepLink } from '../../skills/skillDirectory.js';
import {
  clearPendingRun,
  hasUnsettled,
  readPendingRun,
  savePendingRun,
} from '../../skills/pendingRunStore.js';
import {
  buildSkillBrief,
  buildSkillRequest,
  buildSuiteRun,
  initialSkillValues,
  skillEmbedOf,
  skillRunKind,
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
  generateEcommerce,
  recoverCanvasGeneration,
  regenerateCanvasImage,
  deleteWork,
  saveWork,
} from '../../services/api';
import { quoteBillingAction } from '../../services/billing.js';
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
const VISUAL_SKILL_IDS = {
  'image.free': 'free',
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

/* 错误就近显示：把人话放在 CTA 上方，而不是弹一个转瞬即逝的 Toast */
function friendlyError(error) {
  const message = String((error && error.message) || '').trim();
  if (!message) return '生成失败，请重试';
  if (/abort/i.test(message)) return '';
  return message;
}

function RunPanel({ run, skillName, onRetry, onDownload, busy, fuseActions = [], onFuse }) {
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
        {run.slots.map((slot, index) => (
          <div className="media-run-slot" key={slot.id} data-status={slot.status}>
            {slot.url
              ? <img src={slot.url} alt={skillName + ' ' + (index + 1)} loading="lazy" />
              : <span className="media-run-placeholder">{slot.status === 'failed' ? '失败' : (busy ? '生成中' : '待生成')}</span>}
            {slot.error && <p className="media-run-error" role="alert">{slot.error}</p>}
          </div>
        ))}
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
  const [moduleOff, setModuleOff] = useState(() => new Set());
  useEffect(() => { setModuleOff(new Set()); }, [skill && skill.id]);
  const skillModules = useMemo(() => (skill && Array.isArray(skill.modules) ? skill.modules : []), [skill]);
  const selectedModules = useMemo(
    () => skillModules.filter(module => !moduleOff.has(module.name)),
    [skillModules, moduleOff],
  );
  const effectiveValues = useMemo(() => {
    const base = skill ? { ...initialSkillValues(skill), ...values } : values;
    if (skillModules.length) return { ...base, count: Math.max(1, selectedModules.length) };
    return base;
  }, [skill, values, skillModules, selectedModules]);
  const validation = useMemo(() => (skill ? validateSkillInput(skill, effectiveValues) : { ok: false, missing: [] }), [skill, effectiveValues]);
  /* 套图按**套**计价：张数与报价必须来自与面板同一份方案计算（skillRun.buildSuiteRun） */
  const suiteRun = useMemo(() => (skill && suite ? buildSuiteRun(skill, effectiveValues) : null), [skill, suite, effectiveValues]);
  const points = useMemo(
    () => (suite ? (suiteRun?.points || 0) : (skill ? skillPointsEstimate(skill, effectiveValues) : 0)),
    [suite, suiteRun, skill, effectiveValues],
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
      const request = buildSkillRequest(skill, { ...saved.values }, { runId: saved.runId, slotIndex: index });
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
        const time = formatWorkTime(work.createdAt || work.savedAt);
        return {
          id: String(work._saveKey || work.id || ''),
          saveKey: work._saveKey || work.id || '',
          title: String(work.title || skill?.name || ''),
          subtitle: [urls.length ? urls.length + ' 张' : '', time].filter(Boolean).join(' · '),
          cover: urls[0] || '',
          /* 「用这组参数」靠它还原面板：只认**这条技能自己**存下的参数 */
          values: (work.replay && work.replay.mediaSkillId === skill?.id && work.replay.panelValues) ? work.replay.panelValues : null,
          /* 图文没有"面板参数"可还原（它的输入就是一句话提示词）→ 还原提示词本身。
             这类记录因此也要能显示「用这组参数」按钮（判据见 SkillWorkbench）。 */
          restore: (isContentResult(work) && String(work._inputText || '').trim()) ? { prompt: String(work._inputText).trim() } : null,
        };
      })
      .filter(item => item.cover);

    /* 视频：服务端任务列表按技能筛出本页这一份（标记只写在本机，见 videoJobTags）。
       ⚠️ 筛不出来**不代表任务没了** —— 上方嵌进来的工作台里的「生成记录」永远是全量。 */
    const fromVideos = embed === 'video'
      ? videoJobsOfSkill(videoJobs, skill?.id).map(job => {
          const done = job.status === 'completed' && job.resultUrl;
          const seconds = Number(job.duration) || 0;
          return {
            id: String(job.id || ''),
            saveKey: String(job.id || ''),
            title: String(job.prompt || skill?.name || '视频任务').slice(0, 60),
            subtitle: [seconds ? seconds + ' 秒' : '', job.resolution || '', job.aspectRatio || job.aspect_ratio || ''].filter(Boolean).join(' · '),
            cover: '',
            /* 成片用 video 播放（CaseCard 支持），没出片就只留一行状态，不放一张空白封面 */
            video: done ? job.resultUrl : '',
            poster: '',
            badge: done ? '' : String(job.status || '生成中'),
            /* 「用这组参数」还原创作台：任务记录里存着提示词与规格，全部可以还原 */
            restore: {
              videoJob: {
                prompt: String(job.prompt || ''),
                negativePrompt: String(job.negativePrompt || job.negative_prompt || ''),
                duration: seconds,
                ratio: String(job.aspectRatio || job.aspect_ratio || ''),
                resolution: String(job.resolution || ''),
                mode: skillVideoMode(skill) || 'smart',
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
    if (!suite || !suiteRun?.plan?.images?.length) return declared;
    return suiteRun.plan.images.map(image => {
      const type = IMAGE_TYPES.find(item => item.key === image.key);
      const name = (type ? type.label : image.key) + ' × ' + (image.count || 1);
      const ratio = image.ratio ? image.ratio : (type ? type.defaultRatio : '');
      return { name, hint: [ratio, type ? type.desc : ''].filter(Boolean).join(' · ') };
    });
  }, [skill, suite, suiteRun]);

  /* ═══ 左栏的只读清单块（照竞品「包含模块 已选 0/16」的形态）════════════════════════
     竞品那一块是**可勾选**的；我们的张数与报价由方案算死，所以只做只读展示 ——
     用户看到的是"这一套会交出哪几样、全都交"，不是"勾几个改价钱"。
     ⚠️ 清单内容来自声明源（skill.modules，逐条照抄竞品原文），页面不写死任何一条。 */
  const sections = useMemo(() => {
    if (!skill || !skillModules.length) return [];
    return [{
      key: 'modules',
      title: '包含模块',
      /* 用户批注 #3-2 原话：「选中多少个模块就是多少张，并且对应他自己的模块主题不是吗。」
         —— 所以那句说明也跟着改成"勾几个出几张"，不再说"全都交、不能改价"。 */
      note: '勾几个出几张，价钱跟着勾选走（每张的单价与右下角那颗按钮同源）。',
      selectable: true,
      items: skillModules.map(module => ({ ...module, checked: !moduleOff.has(module.name) })),
      onToggle: name => setModuleOff(previous => {
        const next = new Set(previous);
        if (next.has(name)) next.delete(name); else next.add(name);
        /* ⚠️ 一个都不勾 = 要生成 0 张 —— 那不是一个可以下单的请求（报价算不出来、
           出图循环空转）。所以**最后一个不许取消**：点了没反应，比"点了之后按钮变灰
           但用户不知道为什么"更容易理解。 */
        if (next.size >= skillModules.length) return previous;
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

  /* target：回填到哪个字段。缺省用声明源里的 fills（一键解析那颗按钮走这条）。 */
  async function parseProductInfo(target = '') {
    if (!skill || !parseSpec || parsing) return;
    if (!state.logged) {
      dispatch({ type: 'SET_LOGIN_INTENT', intent: { destination: state.page, source: state.page } });
      dispatch({ type: 'SHOW_LOGIN', show: true });
      return;
    }
    const field = target || parseSpec.fills || 'productParams';
    const ready = parseSourceUrls(field);
    if (!ready.length) { setError('先上传商品图，再点它'); return; }
    setParsing(true);
    setError('');
    setNotice('正在解析商品信息…（本次消耗 0.2 积分）');
    try {
      const result = await autoRecognizeEcommerce({ smartBrief: '', refShots: ready.slice(0, 5) });
      const product = result?.product || {};
      const lines = [
        String(product.name || '').trim(),
        product.category ? '品类：' + product.category : '',
        product.material ? '材质：' + product.material : '',
        product.dimensions ? '尺寸：' + product.dimensions : '',
        result?.maintenance ? '保养：' + result.maintenance : '',
      ].filter(Boolean);
      const filled = lines.join('\n');
      if (!filled) { setNotice(''); setError('没解析出可用信息，换一张更清楚的商品图再试'); return; }
      setValues(prev => ({ ...prev, [field]: filled }));
      await refreshBillingBalance?.().catch(() => undefined);
      setNotice('已解析并填入' + (field === 'product' ? '核心卖点' : '商品信息') + '（消耗 0.2 积分），确认后再生成');
    } catch (err) {
      setNotice('');
      handleError(err);
    } finally {
      setParsing(false);
    }
  }

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
      setError('先写几句' + (fieldLabel(target) || '内容') + '，或先点上面的「一键解析商品信息」把商品信息填出来');
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
      if (target) setValues(prev => ({ ...prev, [target]: 'AI推荐' }));
      await refreshBillingBalance?.().catch(() => undefined);
      setNotice('推荐风格：' + label + '（消耗 0.2 积分）');
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
        label: 'AI 润色 · ' + pointsField.label,
        points: 0.2,
        runnable: true,
        busy: polishing,
        busyLabel: '正在润色…',
        note: pointsDraft
          ? '把上面这段' + pointsField.label + '按商品与平台改得更像人写的，再写回原处'
          : '先写几句' + pointsField.label + '，或先点上面的「一键解析商品信息」',
        onRun: () => { void polishPoints(pointsField.key); },
      });
    }
    /* ③ AI 推荐风格分析：竞品在「设计风格」那一排下面还有一颗（他们 0.10 积分）。
       我们的上游其实**能**回风格 —— /api/ecommerce/auto-recognize 的返回里就带 style_skill
       （server/index.mjs 的 STYLE_MAP 把模型答案归一成 5 个 key），只是上一版没接上，
       于是把它写成了 runnable:false 的说明行 —— 那正是用户说的「三个按钮只有一个有效」。
       现在接上：读参考图 + 已填商品信息 → 判定风格 → 把「设计风格」切到「AI推荐」并常驻结论。 */
    const styleField = (skill.fields || []).find(field => field.key === 'style');
    if (styleField) {
      list.push({
        key: 'style-analysis',
        label: 'AI 推荐风格分析',
        points: 0.2,
        runnable: true,
        busy: analyzingStyle,
        busyLabel: '正在分析…',
        note: styleVerdict
          ? '推荐风格：' + styleVerdict + '（已把「' + styleField.label + '」切到 AI推荐，出图按它走）'
          : '读参考图与已填商品信息，判定风格并把「' + styleField.label + '」切到 AI推荐',
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
    const request = buildSkillRequest(skill, effectiveValues, { runId: baseRun.id, slotIndex: index });
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
      /* 作品归到这条技能名下（buildVisualWorkRecord 只认四个视觉方向，这里补上我们的身份） */
      const work = {
        ...record,
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
    const fresh = createVisualRun({ count: settings.count });
    runRef.current = fresh;
    setRun(fresh);
    await executeRun(fresh, Array.from({ length: settings.count }, (_, index) => index));
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
  if (!skill) return <div className="media-creation" data-surface="hub"><MediaHub board={board} onOpenSkill={openSkill} /></div>;

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
  const status = (
    <>
      <RunPanel run={run} skillName={skill.name} busy={busy} onRetry={retryFailedAssets} onDownload={generate} fuseActions={fuseActions} onFuse={fuseFromResult} />
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
        /* 子页面里**不自动跳画布**：结果留在这一页的成片台上（用户 9-17 口径） */
        autoOpenCanvas={false}
        initialMode={skillVideoMode(skill)}
        skillTag={skill.id}
        /* 进子页面就把这条玩法的**配方提示词**预填进创作台（用户口径：skill = 一个具体玩法，
           进去该看到"这条玩法该怎么拍"，而不是一个空白输入框 + 一个名字）。
           历史里点「用这组参数」时，videoSeed 覆盖它（还原那次任务的提示词与规格）。 */
        preset={videoSeed || { prompt: buildSkillBrief(skill, initialSkillValues(skill)), mode: skillVideoMode(skill) }}
        presetNonce={videoSeedNonce}
        onJobs={setVideoJobs}
      />
    ));
  const panel = embed ? <>{announce}{embeddedFlow}</> : null;

  return (
    <div className="media-creation" data-surface="subpage">
      <SkillWorkbench
        board={board}
        skillId={skill.id}
        values={values}
        onFieldChange={(key, value) => setValues(prev => ({ ...prev, [key]: value }))}
        /* ⚠️ 2026-09-19 批 H-8：**不再**往工作台里传 onBack。
           用户批注 #12 把子页面顶栏写定为「左 返回 / 中 名称 / 右 积分账户」——
           返回控件在**顶栏**。原来工作台左栏里还有一个「← 返回创作」，
           两个按钮都回同一个 Hub、上下相距不到 200px，是纯冗余（用户最烦这种）。
           backToHub 本身没消失：它现在作为顶栏返回按钮的 onClick 被 publish 上去（见上面的 useLayoutEffect）。 */        ctaLabel={handoff ? (board === 'video' ? VIDEO_HANDOFF_LABEL : (HANDOFF_LABEL[skill.pipeline] || '去工作台继续')) : '立即生成'}
        ctaPoints={handoff ? null : points}
        ctaDisabled={busy || (!handoff && !validation.ok)}
        ctaHint={!handoff && !validation.ok ? '还差：' + validation.missing.join('、') : ''}
        status={embed ? null : status}
        onGenerate={handoff ? handoffToBoard : (suite ? generateSuite : generate)}
        onHistoryDelete={deleteHistory}
        onHistoryReuse={reuseHistory}
        history={history}
        panel={panel}
        deliverables={deliverables}
        sections={sections}
        paidActions={paidActions}
        parseAction={parseSpec ? {
          label: parseSpec.label || '一键解析',
          points: 0.2,
          busy: parsing,
          hint: '上传商品图后点它，自动把商品名 / 品类 / 材质 / 尺寸填好',
          /* ⚠️ 必须包一层：onClick 会把**点击事件对象**当第一个参数传进来，
             而 parseProductInfo 的第一个参数是"回填到哪个字段" —— 直接挂上去
             会把事件对象当成字段名写进 values，而且必填校验会莫名通过。 */
          onRun: () => { void parseProductInfo(); },
        } : null}
        emptyHistoryHint={embed === 'video'
          ? '这条技能还没有生成记录。这个账号的全部视频任务都在上方工作台的「生成记录」里，结果出来后会同步到这里。'
          : (embed === 'xhs' ? '这条技能还没有生成记录，在上面写好内容点「生成图文」就会存在这里。' : '')}
      />
    </div>
  );
}