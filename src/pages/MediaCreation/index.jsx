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
  initialSkillValues,
  isHandoffSkill,
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
import { buildCanvasGenerationBody, recoverCanvasGeneration, regenerateCanvasImage, saveWork } from '../../services/api';
import { handleGenerationAccessError } from '../../utils/generationAccess.js';
import { useWorksSync } from '../../store/useWorksSync.js';
import '../Home/MediaHub.css';
import '../Home/SkillWorkbench.css';
import './MediaCreation.css';

/* 板块 ↔ 总页面 的对应只有 skillDirectory 一份（首页热门条、Hub、工作台共用） */
const BOARD_BY_PAGE = { 'image-creation': 'image', 'video-creation': 'video' };

/* 重流程（多分钟、多资产、带方案确认）不在这里重写：只把配置带回去。 */
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

  /* 生效值 = 声明源默认值 + 用户改动。校验、积分、下发参数一律基于它（与界面显示同源）。 */
  const effectiveValues = useMemo(() => (skill ? { ...initialSkillValues(skill), ...values } : values), [skill, values]);
  const validation = useMemo(() => (skill ? validateSkillInput(skill, effectiveValues) : { ok: false, missing: [] }), [skill, effectiveValues]);
  const points = useMemo(() => (skill ? skillPointsEstimate(skill, effectiveValues) : 0), [skill, effectiveValues]);
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
    return works
      .filter(work => work && work.mediaSkillId === skill?.id)
      .map(work => {
        const images = Array.isArray(work.images) ? work.images : (Array.isArray(work.imageRecords) ? work.imageRecords : []);
        const urls = images.map(image => image?.url).filter(Boolean);
        return {
          id: String(work._saveKey || work.id || ''),
          title: String(work.title || skill?.name || ''),
          subtitle: [urls.length ? urls.length + ' 张' : '', formatWorkTime(work.createdAt || work.savedAt)].filter(Boolean).join(' · '),
          cover: urls[0] || '',
        };
      })
      .filter(item => item.cover);
  }, [skill, state.works]);
  /* 视频侧全部走既有视频工作台：视频是多分钟、带分镜与方案的流水线，
     而且 videoSkills 目前没有 brief —— 就地生成会发出空提示词的扣费请求。 */
  const handoff = board === 'video' || Boolean(skill && isHandoffSkill(skill));

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

  async function persistRun(finalRun) {
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

  /* 重试按钮：用户手势入口② —— 只重跑失败槽位（成功的不会重跑，也就不会重复扣费） */
  async function retryFailedAssets() {
    const current = runRef.current;
    if (!current) return;
    const indexes = visualRetryIndexes(current);
    if (!indexes.length) return;
    await executeRun(current, indexes);
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

  const status = (
    <>
      <RunPanel run={run} skillName={skill.name} busy={busy} onRetry={retryFailedAssets} onDownload={generate} />
      {error && <p className="media-run-global" role="alert"><AlertCircle size={14} />{error}</p>}
      {notice && <p className="media-run-notice">{notice}</p>}
    </>
  );

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
        status={status}
        onGenerate={handoff ? handoffToBoard : generate}
        history={history}
      />
    </div>
  );
}