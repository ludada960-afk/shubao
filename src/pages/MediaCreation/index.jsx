import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Download, RotateCcw, Sparkles } from 'lucide-react';

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
import { videoJobsOfSkill } from '../VideoStudio/videoJobTags.js';
import { getImageSkill } from '../../skills/imageSkills.js';
import { getVideoSkill } from '../../skills/videoSkills.js';
import { boardOfPage, hubPath, skillPath as skillDeepLink } from '../../skills/skillDirectory.js';
import {
  clearPendingRun,
  hasUnsettled,
  readPendingRun,
  savePendingRun,
} from '../../skills/pendingRunStore.js';
import {
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

function RunPanel({ run, skillName, onRetry, onDownload, busy }) {
  if (!run) return null;
  const done = run.slots.filter(slot => slot.status === 'completed' && slot.url);
  const failed = visualRetryIndexes(run);
  const finished = !visualRunIsBusy(run);
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
    </section>
  );
}

export default function MediaCreationPage() {
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

  useEffect(() => {
    const sync = () => setSkillId(skillFromUrl(board));
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [board]);

  /* 换技能 / 回 Hub 时清掉上一次的运行，避免"上一条技能的结果留在这一条上" */
  useEffect(() => {
    runRef.current = null;
    setRun(null);
    setError('');
    setNotice('');
  }, [board, skillId]);

  useEffect(() => () => { try { abortRef.current?.abort?.(); } catch { /* 卸载时忽略 */ } }, []);


  const openSkill = useCallback(id => {
    window.history.pushState({}, '', skillDeepLink({ id, board }));
    setSkillId(id);
    setValues({});
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
  const effectiveValues = useMemo(() => (skill ? { ...initialSkillValues(skill), ...values } : values), [skill, values]);
  const validation = useMemo(() => (skill ? validateSkillInput(skill, effectiveValues) : { ok: false, missing: [] }), [skill, effectiveValues]);
  /* 套图按**套**计价：张数与报价必须来自与面板同一份方案计算（skillRun.buildSuiteRun） */
  const suiteRun = useMemo(() => (skill && suite ? buildSuiteRun(skill, effectiveValues) : null), [skill, suite, effectiveValues]);
  const points = useMemo(
    () => (suite ? (suiteRun?.points || 0) : (skill ? skillPointsEstimate(skill, effectiveValues) : 0)),
    [suite, suiteRun, skill, effectiveValues],
  );
  const busy = visualRunIsBusy(run);

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

  /* 统一失焦：登录 / 余额不足交给既有守卫处理，其余就地显示 */
  const handleError = useCallback((err) => {
    const access = handleGenerationAccessError(err, dispatch, { source: 'visual_creation' });
    if (access) return true;
    const message = friendlyError(err);
    if (message) setError(message);
    return false;
  }, [dispatch]);

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


  if (!skill) return <div className="media-creation"><MediaHub board={board} onOpenSkill={openSkill} /></div>;

  /* 就近反馈（错误 / 提示）单独拎出来：嵌入形态下它要挂到页面**顶部**那条线上，
     而不是塞在右栏页签上面 —— 用户点完历史里的「用这组参数」会被滚回顶部，
     提示却留在页面下方的话，等于没提示。 */
  const announce = (
    <>
      {error && <p className="media-run-global" role="alert"><AlertCircle size={14} />{error}</p>}
      {notice && <p className="media-run-notice">{notice}</p>}
    </>
  );
  const status = (
    <>
      <RunPanel run={run} skillName={skill.name} busy={busy} onRetry={retryFailedAssets} onDownload={generate} />
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
        preset={videoSeed}
        presetNonce={videoSeedNonce}
        onJobs={setVideoJobs}
      />
    ));
  const panel = embed ? <>{announce}{embeddedFlow}</> : null;

  return (
    <div className="media-creation">
      <SkillWorkbench
        board={board}
        skillId={skill.id}
        values={values}
        onFieldChange={(key, value) => setValues(prev => ({ ...prev, [key]: value }))}
        onBack={backToHub}
        ctaLabel={handoff ? (board === 'video' ? VIDEO_HANDOFF_LABEL : (HANDOFF_LABEL[skill.pipeline] || '去工作台继续')) : '立即生成'}
        ctaPoints={handoff ? null : points}
        ctaDisabled={busy || (!handoff && !validation.ok)}
        ctaHint={!handoff && !validation.ok ? '还差：' + validation.missing.join('、') : ''}
        status={embed ? null : status}
        onGenerate={handoff ? handoffToBoard : (suite ? generateSuite : generate)}
        onHistoryDelete={deleteHistory}
        onHistoryReuse={reuseHistory}
        history={history}
        panel={panel}
        emptyHistoryHint={embed === 'video'
          ? '这条技能还没有生成记录。这个账号的全部视频任务都在上方工作台的「生成记录」里，结果出来后会同步到这里。'
          : (embed === 'xhs' ? '这条技能还没有生成记录，在上面写好内容点「生成图文」就会存在这里。' : '')}
      />
    </div>
  );
}