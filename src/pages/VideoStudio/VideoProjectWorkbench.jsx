import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronRight,
  CircleAlert,
  Clapperboard,
  Clock3,
  Film,
  FolderKanban,
  ImagePlus,
  Layers3,
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { createProject, listProjects } from '../../services/projects.js';
import {
  addTimelineClip,
  approveWorkbenchAssetVersion,
  bindShotAssetVersion,
  createStoryboardShot,
  createWorkbenchAsset,
  getVideoWorkbench,
  importJobCandidate,
  importWorkbenchAssetVersion,
  removeVideoProjectMemoryFact,
  selectShotCandidate,
  upsertVideoProjectMemoryFact,
  updateStoryboardShot,
} from '../../services/videoWorkbench.js';
import {
  approvedAssetVersions,
  availableUploadedAssets,
  candidateJobsForProject,
  nextShotPosition,
  nextTimelinePosition,
  selectedCandidateForShot,
  videoProjects,
  workbenchStageSummary,
} from './videoProjectWorkbenchModel.js';
import './VideoProjectWorkbench.css';

const STAGES = [
  { id: 'project', label: '项目', icon: FolderKanban },
  { id: 'assets', label: '素材', icon: ImagePlus },
  { id: 'shots', label: '分镜', icon: Clapperboard },
  { id: 'candidates', label: '候选', icon: Sparkles },
  { id: 'timeline', label: '时间线', icon: Layers3 },
  { id: 'ready', label: '交付', icon: Film },
];

const ASSET_KINDS = [
  ['product', '商品'], ['person', '人物'], ['wardrobe', '服饰'], ['scene', '场景'],
  ['prop', '道具'], ['style', '风格'], ['voice', '声线'], ['music', '音乐'],
];

const BINDING_ROLES = [
  ['subject', '主体'], ['product', '商品'], ['wardrobe', '服饰'], ['scene', '场景'],
  ['prop', '道具'], ['style', '风格'], ['voice', '声线'], ['music', '音乐'],
  ['first_frame', '首帧'], ['last_frame', '尾帧'], ['motion_reference', '动作参考'],
];

const DEFAULT_ASSET_KIND = Object.freeze({ image: 'product', video: 'style', audio: 'voice' });
const DEFAULT_BINDING_ROLE = Object.freeze({
  product: 'product', person: 'subject', wardrobe: 'wardrobe', scene: 'scene',
  prop: 'prop', style: 'style', voice: 'voice', music: 'music',
});

function keyFor(prefix) {
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${id}`;
}

function uploadName(upload) {
  return String(upload?.file?.name || upload?.asset?.fileName || upload?.asset?.name || '项目素材').trim();
}

function mediaKind(upload) {
  return upload?.asset?.kind || upload?.kind || 'image';
}

function displayError(error) {
  if (error?.status === 409 || error?.code === 'VERSION_CONFLICT') {
    return '内容已在其他位置更新，已刷新项目，请检查后重试。';
  }
  return error?.message || '操作没有完成，请刷新后重试。';
}

function memoryValueText(value) {
  return JSON.stringify(value, null, 2);
}

function memorySourceLabel(source) {
  return ({ user: '用户设定', approved_asset: '已确认素材', skill: '工作流记录' })[source] || '项目记录';
}

function ProjectMedia({ version, name }) {
  if (!version?.stableUrl) return null;
  const mediaUrl = version.playbackUrl || version.stableUrl;
  if (String(version.mimeType).startsWith('video/')) {
    return <video src={mediaUrl} aria-label={name} controls playsInline preload="metadata" />;
  }
  if (String(version.mimeType).startsWith('audio/')) {
    return <audio src={mediaUrl} aria-label={name} controls preload="metadata" />;
  }
  return <img src={mediaUrl} alt={name} loading="lazy" />;
}

function CandidateMedia({ candidate, label }) {
  return <video src={candidate.playbackUrl || candidate.stableUrl} aria-label={label} controls playsInline preload="metadata" />;
}

export default function VideoProjectWorkbench({ enabled = false, logged = false, uploadRecords = [], jobs = [], onProjectChange }) {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [workbench, setWorkbench] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [assetKinds, setAssetKinds] = useState({});
  const [bindingChoices, setBindingChoices] = useState({});
  const [shotEdits, setShotEdits] = useState({});
  const [memoryDrafts, setMemoryDrafts] = useState({});
  const [newMemory, setNewMemory] = useState({ key: '', value: '{\n  \n}', source: 'user' });
  const [shotDraft, setShotDraft] = useState({ purpose: '', duration: 6, cameraLanguage: '', prompt: '' });
  const selectedProjectRef = useRef('');
  const requestSequenceRef = useRef(0);

  useEffect(() => {
    onProjectChange?.(projectId || '');
  }, [onProjectChange, projectId]);

  const uploads = useMemo(() => availableUploadedAssets(uploadRecords), [uploadRecords]);
  const completedJobs = useMemo(() => candidateJobsForProject(jobs, projectId), [jobs, projectId]);
  const approved = useMemo(() => approvedAssetVersions(workbench), [workbench]);
  const stageSummary = useMemo(() => workbenchStageSummary(workbench), [workbench]);
  const importedSourceIds = useMemo(() => new Set((workbench?.assets || []).flatMap(asset =>
    (asset.versions || []).map(version => version.sourceProjectAssetId).filter(Boolean))), [workbench]);
  const activeClipShotIds = useMemo(() => new Set((workbench?.timelineClips || [])
    .filter(clip => clip.status === 'active').map(clip => clip.shotId)), [workbench]);

  const loadWorkbench = useCallback(async (id, { quiet = false } = {}) => {
    if (!id) {
      setWorkbench(null);
      return;
    }
    const requestSequence = ++requestSequenceRef.current;
    if (!quiet) setLoading(true);
    try {
      const next = await getVideoWorkbench(id);
      if (requestSequence !== requestSequenceRef.current || selectedProjectRef.current !== id) return;
      setWorkbench(next);
      setError('');
    } catch (loadError) {
      if (requestSequence !== requestSequenceRef.current || selectedProjectRef.current !== id) return;
      setWorkbench(null);
      setError(displayError(loadError));
    } finally {
      if (requestSequence === requestSequenceRef.current) setLoading(false);
    }
  }, []);

  const loadProjects = useCallback(async preferredId => {
    setLoading(true);
    try {
      const next = videoProjects(await listProjects());
      setProjects(next);
      const jobProjectId = jobs.find(item => item?.projectId && next.some(project => project.id === item.projectId))?.projectId;
      const target = [preferredId, selectedProjectRef.current, jobProjectId, next[0]?.id]
        .find(id => id && next.some(project => project.id === id)) || '';
      selectedProjectRef.current = target;
      setProjectId(target);
      if (!target) setWorkbench(null);
      setError('');
    } catch (loadError) {
      setError(displayError(loadError));
    } finally {
      setLoading(false);
    }
  }, [jobs]);

  useEffect(() => {
    if (!enabled || !logged) return undefined;
    let active = true;
    listProjects().then(result => {
      if (!active) return;
      const next = videoProjects(result);
      setProjects(next);
      const jobProjectId = jobs.find(item => item?.projectId && next.some(project => project.id === item.projectId))?.projectId;
      const target = jobProjectId || next[0]?.id || '';
      selectedProjectRef.current = target;
      setProjectId(target);
    }).catch(loadError => {
      if (active) setError(displayError(loadError));
    });
    return () => { active = false; requestSequenceRef.current += 1; };
  }, [enabled, logged]);

  useEffect(() => {
    selectedProjectRef.current = projectId;
    if (projectId) void loadWorkbench(projectId);
    else setWorkbench(null);
  }, [loadWorkbench, projectId]);

  const runMutation = useCallback(async (key, action) => {
    if (!projectId || busy) return;
    setBusy(key);
    setError('');
    try {
      await action();
      await loadWorkbench(projectId, { quiet: true });
    } catch (mutationError) {
      setError(displayError(mutationError));
      if (mutationError?.status === 409 || mutationError?.code === 'VERSION_CONFLICT') {
        await loadWorkbench(projectId, { quiet: true });
      }
    } finally {
      setBusy('');
    }
  }, [busy, loadWorkbench, projectId]);

  async function handleCreateProject(event) {
    event.preventDefault();
    const title = projectTitle.trim();
    if (!title || busy) return;
    setBusy('project:create');
    setError('');
    try {
      const project = await createProject({ kind: 'video', title, idempotencyKey: keyFor('video-project') });
      setProjectTitle('');
      await loadProjects(project.id);
    } catch (createError) {
      setError(displayError(createError));
    } finally {
      setBusy('');
    }
  }

  function selectProject(nextId) {
    requestSequenceRef.current += 1;
    selectedProjectRef.current = nextId;
    setProjectId(nextId);
    setWorkbench(null);
    setError('');
  }

  function handleImportUpload(upload) {
    const sourceId = upload.asset.id;
    const kind = assetKinds[sourceId] || DEFAULT_ASSET_KIND[mediaKind(upload)] || 'style';
    void runMutation(`asset:${sourceId}`, async () => {
      const asset = await createWorkbenchAsset(projectId, { kind, name: uploadName(upload) });
      const version = await importWorkbenchAssetVersion(projectId, asset.id, {
        videoAssetId: upload.asset.id,
        metadata: { source: 'video-studio-upload' },
      });
      await approveWorkbenchAssetVersion(projectId, asset.id, {
        versionId: version.id,
        expectedRevision: asset.revision,
      });
    });
  }

  function handleCreateShot(event) {
    event.preventDefault();
    const purpose = shotDraft.purpose.trim();
    const prompt = shotDraft.prompt.trim();
    if (!purpose || !prompt) return;
    void runMutation('shot:create', async () => {
      await createStoryboardShot(projectId, {
        position: nextShotPosition(workbench?.shots),
        purpose,
        durationMs: Math.round(Number(shotDraft.duration) * 1000),
        cameraLanguage: shotDraft.cameraLanguage.trim(),
        prompt,
      });
      setShotDraft({ purpose: '', duration: 6, cameraLanguage: '', prompt: '' });
    });
  }

  function handleUpdateShot(shot) {
    const edit = shotEdits[shot.id];
    if (!edit) return;
    void runMutation(`shot:update:${shot.id}`, async () => {
      await updateStoryboardShot(projectId, shot.id, {
        expectedRevision: shot.revision,
        patch: {
          purpose: String(edit.purpose || '').trim(),
          durationMs: Math.round(Number(edit.duration) * 1000),
          cameraLanguage: String(edit.cameraLanguage || '').trim(),
          prompt: String(edit.prompt || '').trim(),
        },
      });
      setShotEdits(current => {
        const next = { ...current };
        delete next[shot.id];
        return next;
      });
    });
  }

  function handleBind(shot, encoded) {
    const [assetId, assetVersionId, assetKind, roleChoice] = String(encoded || '').split('|');
    if (!assetId || !assetVersionId) return;
    const role = roleChoice || DEFAULT_BINDING_ROLE[assetKind] || 'style';
    void runMutation(`binding:${shot.id}`, () => bindShotAssetVersion(projectId, shot.id, {
      assetId,
      assetVersionId,
      role,
    }));
  }

  function handleImportCandidate(shot, job) {
    void runMutation(`candidate:${shot.id}:${job.id}`, () => importJobCandidate(projectId, shot.id, {
      generationJobId: job.id,
    }));
  }

  function handleSelectCandidate(shot, candidate) {
    void runMutation(`select:${shot.id}:${candidate.id}`, () => selectShotCandidate(projectId, shot.id, {
      candidateId: candidate.id,
      expectedRevision: shot.revision,
    }));
  }

  function handleAddTimeline(shot) {
    const candidate = selectedCandidateForShot(shot);
    if (!candidate) return;
    void runMutation(`timeline:${shot.id}`, () => addTimelineClip(projectId, {
      shotId: shot.id,
      candidateId: candidate.id,
      position: nextTimelinePosition(workbench?.timelineClips),
      trimStartMs: 0,
      trimEndMs: shot.durationMs,
      muted: false,
    }));
  }

  function parseMemoryValue(text) {
    try {
      return JSON.parse(text);
    } catch {
      setError('项目记忆值必须是有效 JSON，例如字符串需要加引号。');
      return undefined;
    }
  }

  function handleSaveMemory(fact) {
    const text = memoryDrafts[fact.key] ?? memoryValueText(fact.value);
    const value = parseMemoryValue(text);
    if (value === undefined) return;
    void runMutation(`memory:update:${fact.key}`, () => upsertVideoProjectMemoryFact(projectId, fact.key, {
      value,
      source: fact.source,
      assetRefs: fact.assetRefs,
      expectedRevision: fact.revision,
    }));
  }

  function handleDeleteMemory(fact) {
    void runMutation(`memory:delete:${fact.key}`, () => removeVideoProjectMemoryFact(projectId, fact.key, fact.revision));
  }

  function handleCreateMemory(event) {
    event.preventDefault();
    const key = newMemory.key.trim();
    if (!key) return;
    const value = parseMemoryValue(newMemory.value);
    if (value === undefined) return;
    void runMutation(`memory:create:${key}`, async () => {
      await upsertVideoProjectMemoryFact(projectId, key, {
        value,
        source: newMemory.source,
        expectedRevision: null,
      });
      setNewMemory({ key: '', value: '{\n  \n}', source: 'user' });
    });
  }

  if (!enabled || !logged) return null;

  const currentStageIndex = Math.max(0, STAGES.findIndex(stage => stage.id === stageSummary.stage));
  const totalDuration = (workbench?.timelineClips || []).filter(clip => clip.status === 'active')
    .reduce((sum, clip) => sum + Math.max(0, clip.trimEndMs - clip.trimStartMs), 0);

  return <section className="video-project-workbench" aria-label="视频项目工作台" aria-busy={loading || Boolean(busy)}>
    <header className="video-project-workbench-header">
      <div><span><Film size={16} />项目工作台</span><h2>把素材、分镜和候选版本组织成一条可回看的创作过程</h2><p>所有选择都保存到当前项目；工作台本身不会发起生成或扣除积分。</p></div>
      <button type="button" className="video-project-refresh" aria-label="刷新视频项目" title="刷新视频项目" disabled={Boolean(busy) || loading} onClick={() => void loadProjects(projectId)}>
        <RefreshCw size={17} />
      </button>
    </header>

    <ol className="video-project-stages" aria-label="项目进度">
      {STAGES.map((stage, index) => {
        const Icon = stage.icon;
        return <li key={stage.id} className={index < currentStageIndex ? 'is-complete' : index === currentStageIndex ? 'is-current' : ''}>
          <span><Icon size={15} /></span><strong>{stage.label}</strong>{index < STAGES.length - 1 && <ChevronRight size={13} aria-hidden="true" />}
        </li>;
      })}
    </ol>

    {error && <div className="video-project-alert" role="alert"><CircleAlert size={17} /><span>{error}</span><button type="button" onClick={() => projectId ? void loadWorkbench(projectId) : void loadProjects()}>重试</button></div>}

    <section className="video-project-band is-project" aria-labelledby="video-project-heading">
      <header><div><small>01</small><span><h3 id="video-project-heading">项目</h3><p>选择已有项目，或先建立一个新的创作空间。</p></span></div></header>
      <div className="video-project-controls">
        <label><span>当前项目</span><select value={projectId} disabled={Boolean(busy) || loading} onChange={event => selectProject(event.target.value)}>
          <option value="">选择视频项目</option>
          {projects.map(project => <option key={project.id} value={project.id}>{project.title || '未命名视频项目'}</option>)}
        </select></label>
        <form onSubmit={handleCreateProject}><label><span>新项目名称</span><input value={projectTitle} maxLength="80" placeholder="例如：秋季新品短片" onChange={event => setProjectTitle(event.target.value)} /></label><button type="submit" disabled={Boolean(busy) || !projectTitle.trim()}><Plus size={16} />建立项目</button></form>
      </div>
    </section>

    {!projectId && <div className="video-project-empty"><FolderKanban size={25} /><strong>先选择或建立一个视频项目</strong><span>项目会承载素材版本、分镜、候选和时间线。</span></div>}

    {projectId && <>
      <section className="video-project-band" aria-labelledby="video-assets-heading">
        <header><div><small>02</small><span><h3 id="video-assets-heading">素材</h3><p>把上方已经持久化的上传导入项目并确认版本。</p></span></div><b>{stageSummary.counts?.approvedAssets || 0} 个已确认</b></header>
        <div className="video-project-upload-list">
          {uploads.map(upload => {
            const sourceId = upload.asset.id;
            const imported = importedSourceIds.has(sourceId);
            return <article key={sourceId}>
              <div><span className={`is-${mediaKind(upload)}`}><ImagePlus size={17} /></span><strong>{uploadName(upload)}</strong><small>{mediaKind(upload) === 'audio' ? '音频' : mediaKind(upload) === 'video' ? '视频' : '图片'}</small></div>
              <select aria-label={`设置${uploadName(upload)}的素材类型`} disabled={Boolean(busy) || imported} value={assetKinds[sourceId] || DEFAULT_ASSET_KIND[mediaKind(upload)] || 'style'} onChange={event => setAssetKinds(current => ({ ...current, [sourceId]: event.target.value }))}>
                {ASSET_KINDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <button type="button" disabled={Boolean(busy) || imported} onClick={() => handleImportUpload(upload)}>{imported ? <><Check size={15} />已导入</> : busy === `asset:${sourceId}` ? <><LoaderCircle className="is-spinning" size={15} />导入中</> : '导入并确认'}</button>
            </article>;
          })}
          {!uploads.length && <p className="video-project-inline-empty">先在上方上传图片、视频或音频；上传完成后会出现在这里。</p>}
        </div>
        {!!approved.length && <div className="video-project-approved-assets">{approved.map(({ asset, version }) => <article key={asset.id}>
          <div className="video-project-media"><ProjectMedia version={version} name={asset.name} /></div><span><small>{ASSET_KINDS.find(([value]) => value === asset.kind)?.[1] || '素材'} · V{version.sequence}</small><strong>{asset.name}</strong><em><Check size={13} />已确认</em></span>
        </article>)}</div>}
      </section>

      <section className="video-project-band video-project-memory-band" aria-labelledby="video-memory-heading">
        <header><div><small>记忆</small><span><h3 id="video-memory-heading">项目记忆</h3><p>保存会影响后续创作的风格、角色和交付约束，并随项目回放。</p></span></div><b>{workbench?.memory?.length || 0} 条</b></header>
        <div className="video-project-memory-list">
          {(workbench?.memory || []).map(fact => <article key={fact.key} className="video-project-memory-row">
            <div className="video-project-memory-meta"><strong>{fact.key}</strong><span>{memorySourceLabel(fact.source)} · 修订 {fact.revision}</span></div>
            <textarea aria-label={`编辑项目记忆 ${fact.key}`} value={memoryDrafts[fact.key] ?? memoryValueText(fact.value)} onChange={event => setMemoryDrafts(current => ({ ...current, [fact.key]: event.target.value }))} />
            <div className="video-project-memory-actions"><button type="button" title="保存项目记忆" aria-label={`保存项目记忆 ${fact.key}`} disabled={Boolean(busy)} onClick={() => handleSaveMemory(fact)}>{busy === `memory:update:${fact.key}` ? <LoaderCircle className="is-spinning" size={15} /> : <Save size={15} />}</button><button type="button" title="删除项目记忆" aria-label={`删除项目记忆 ${fact.key}`} disabled={Boolean(busy)} onClick={() => handleDeleteMemory(fact)}><Trash2 size={15} /></button></div>
          </article>)}
          {!workbench?.memory?.length && <p className="video-project-inline-empty">还没有项目记忆。保存第一条创作约束后，后续回放会自动带上它。</p>}
        </div>
        <form className="video-project-memory-create" onSubmit={handleCreateMemory}>
          <label><span>记忆键</span><input value={newMemory.key} maxLength="128" placeholder="例如：brandTone" onChange={event => setNewMemory(current => ({ ...current, key: event.target.value }))} /></label>
          <label className="is-value"><span>记忆值（JSON）</span><textarea value={newMemory.value} maxLength="8192" onChange={event => setNewMemory(current => ({ ...current, value: event.target.value }))} /></label>
          <label><span>来源</span><select value={newMemory.source} onChange={event => setNewMemory(current => ({ ...current, source: event.target.value }))}><option value="user">用户设定</option><option value="approved_asset">已确认素材</option><option value="skill">工作流记录</option></select></label>
          <button type="submit" disabled={Boolean(busy) || !newMemory.key.trim()}><Plus size={15} />新增记忆</button>
        </form>
      </section>

      <section className="video-project-band" aria-labelledby="video-shots-heading">
        <header><div><small>03</small><span><h3 id="video-shots-heading">分镜</h3><p>每个镜头独立定义目的、时长、镜头语言和提示。</p></span></div><b>{workbench?.shots?.length || 0} 个镜头</b></header>
        <form className="video-project-shot-form" onSubmit={handleCreateShot}>
          <label><span>镜头目的</span><input required maxLength="500" value={shotDraft.purpose} placeholder="例如：3 秒内建立商品记忆点" onChange={event => setShotDraft(current => ({ ...current, purpose: event.target.value }))} /></label>
          <label className="is-duration"><span>时长</span><input required type="number" min="0.5" max="120" step="0.5" value={shotDraft.duration} onChange={event => setShotDraft(current => ({ ...current, duration: event.target.value }))} /><small>秒</small></label>
          <label><span>镜头语言</span><input maxLength="2000" value={shotDraft.cameraLanguage} placeholder="中景跟拍，缓慢推进" onChange={event => setShotDraft(current => ({ ...current, cameraLanguage: event.target.value }))} /></label>
          <label className="is-prompt"><span>镜头提示</span><textarea required maxLength="8000" value={shotDraft.prompt} placeholder="只描述这一镜要发生的动作、场景与节奏" onChange={event => setShotDraft(current => ({ ...current, prompt: event.target.value }))} /></label>
          <button type="submit" disabled={Boolean(busy) || !shotDraft.purpose.trim() || !shotDraft.prompt.trim()}><Plus size={16} />添加分镜</button>
        </form>

        <div className="video-project-shot-list">{(workbench?.shots || []).map((shot, index) => {
          const selected = selectedCandidateForShot(shot);
          const edit = shotEdits[shot.id];
          const existingJobIds = new Set((shot.candidates || []).map(candidate => candidate.generationJobId));
          const bindingValue = bindingChoices[shot.id] || '';
          return <article key={shot.id} className={shot.status === 'stale' ? 'is-stale' : ''}>
            <header><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{shot.purpose || '未命名镜头'}</strong><small><Clock3 size={12} />{(shot.durationMs / 1000).toFixed(1)} 秒 · {shot.cameraLanguage || '未设置镜头语言'}</small></div>{shot.status === 'stale' && <em>需重新确认</em>}</header>
            <p>{shot.prompt || '未填写镜头提示'}</p>
            <div className="video-project-bind-row">
              <select aria-label={`为镜头${index + 1}绑定素材`} disabled={Boolean(busy) || !approved.length} value={bindingValue} onChange={event => {
                const value = event.target.value;
                setBindingChoices(current => ({ ...current, [shot.id]: value }));
                handleBind(shot, value);
              }}>
                <option value="">绑定已确认素材</option>
                {approved.flatMap(({ asset, version }) => BINDING_ROLES
                  .filter(([role]) => role === (DEFAULT_BINDING_ROLE[asset.kind] || 'style'))
                  .map(([role, roleLabel]) => <option key={`${asset.id}-${role}`} value={`${asset.id}|${version.id}|${asset.kind}|${role}`}>{roleLabel} · {asset.name}</option>))}
              </select>
              <span>{shot.bindings?.length || 0} 个绑定</span>
            </div>

            <details className="video-project-shot-edit"><summary>调整镜头信息</summary><div>
              <label><span>镜头目的</span><input value={edit?.purpose ?? shot.purpose} onChange={event => setShotEdits(current => ({ ...current, [shot.id]: { purpose: event.target.value, duration: edit?.duration ?? shot.durationMs / 1000, cameraLanguage: edit?.cameraLanguage ?? shot.cameraLanguage, prompt: edit?.prompt ?? shot.prompt } }))} /></label>
              <label><span>时长（秒）</span><input type="number" min="0.5" max="120" step="0.5" value={edit?.duration ?? shot.durationMs / 1000} onChange={event => setShotEdits(current => ({ ...current, [shot.id]: { purpose: edit?.purpose ?? shot.purpose, duration: event.target.value, cameraLanguage: edit?.cameraLanguage ?? shot.cameraLanguage, prompt: edit?.prompt ?? shot.prompt } }))} /></label>
              <label><span>镜头语言</span><input value={edit?.cameraLanguage ?? shot.cameraLanguage} onChange={event => setShotEdits(current => ({ ...current, [shot.id]: { purpose: edit?.purpose ?? shot.purpose, duration: edit?.duration ?? shot.durationMs / 1000, cameraLanguage: event.target.value, prompt: edit?.prompt ?? shot.prompt } }))} /></label>
              <label className="is-wide"><span>镜头提示</span><textarea value={edit?.prompt ?? shot.prompt} onChange={event => setShotEdits(current => ({ ...current, [shot.id]: { purpose: edit?.purpose ?? shot.purpose, duration: edit?.duration ?? shot.durationMs / 1000, cameraLanguage: edit?.cameraLanguage ?? shot.cameraLanguage, prompt: event.target.value } }))} /></label>
              <button type="button" disabled={Boolean(busy) || !edit} onClick={() => handleUpdateShot(shot)}><Save size={14} />保存调整</button>
            </div></details>

            <section className="video-project-candidates" aria-label={`镜头${index + 1}候选`}>
              <header><strong>候选版本</strong><span>只显示当前项目已完成的真实任务</span></header>
              {!!completedJobs.length && <div className="video-project-job-imports">{completedJobs.map(job => <button type="button" key={job.id} disabled={Boolean(busy) || existingJobIds.has(job.id)} onClick={() => handleImportCandidate(shot, job)}>{existingJobIds.has(job.id) ? '已导入' : `导入：${String(job.prompt || '已完成成片').slice(0, 24)}`}</button>)}</div>}
              <div className="video-project-candidate-grid">{(shot.candidates || []).map((candidate, candidateIndex) => <article key={candidate.id} className={selected?.id === candidate.id ? 'is-selected' : ''}>
                <CandidateMedia candidate={candidate} label={`镜头${index + 1}候选${candidateIndex + 1}`} />
                <footer><span>版本 {candidateIndex + 1}</span><button type="button" disabled={Boolean(busy) || selected?.id === candidate.id} onClick={() => handleSelectCandidate(shot, candidate)}>{selected?.id === candidate.id ? <><Check size={14} />已选定</> : '选用此版'}</button></footer>
              </article>)}</div>
              {!shot.candidates?.length && <p className="video-project-inline-empty">当前镜头还没有候选。先在上方完成一次属于本项目的视频任务，再导入这里。</p>}
            </section>
            <button type="button" className="video-project-timeline-action" disabled={Boolean(busy) || !selected || activeClipShotIds.has(shot.id) || shot.status === 'stale'} onClick={() => handleAddTimeline(shot)}>{activeClipShotIds.has(shot.id) ? <><Check size={15} />已加入时间线</> : '把选定版本加入时间线'}</button>
          </article>;
        })}</div>
        {!workbench?.shots?.length && <p className="video-project-inline-empty">确认至少一个素材版本后，就可以建立第一条分镜。</p>}
      </section>

      <section className="video-project-band is-timeline" aria-labelledby="video-timeline-heading">
        <header><div><small>05</small><span><h3 id="video-timeline-heading">时间线与交付</h3><p>只接收每个镜头当前选定且未过期的候选版本。</p></span></div><b>{(totalDuration / 1000).toFixed(1)} 秒</b></header>
        <div className="video-project-timeline">{(workbench?.timelineClips || []).map((clip, index) => {
          const shot = workbench.shots.find(item => item.id === clip.shotId);
          return <article key={clip.id} className={clip.status !== 'active' ? 'is-stale' : ''} style={{ '--clip-weight': Math.max(1, clip.trimEndMs - clip.trimStartMs) }}><span>{index + 1}</span><div><strong>{shot?.purpose || '镜头片段'}</strong><small>{((clip.trimEndMs - clip.trimStartMs) / 1000).toFixed(1)} 秒</small></div></article>;
        })}</div>
        {!workbench?.timelineClips?.length && <p className="video-project-inline-empty">选定镜头候选后，将它加入时间线；空时间线不会显示伪导出按钮。</p>}
        <footer className="video-project-delivery-status"><Film size={18} /><div><strong>{stageSummary.stage === 'ready' ? '基础时间线已就绪' : '继续完成上方步骤'}</strong><span>{stageSummary.stage === 'ready' ? '项目、素材版本、分镜、选定候选与时间线均已持久化。' : '交付只根据真实保存状态判断，不会提前标记完成。'}</span></div></footer>
      </section>
    </>}
  </section>;
}
