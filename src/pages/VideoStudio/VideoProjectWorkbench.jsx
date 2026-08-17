import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Music2,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clapperboard,
  Clock3,
  Copy,
  Eye,
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
  Volume2,
  VolumeX,
} from 'lucide-react';
import { createProject, listProjects } from '../../services/projects.js';
import {
  addTimelineClip,
  approveVideoWorkbenchPlan,
  approveWorkbenchAssetVersion,
  bindShotAssetVersion,
  createStoryboardShot,
  createWorkbenchAsset,
  createVideoAudioTrack,
  createVideoReplayManifest,
  cloneVideoReplayManifest,
  getVideoReplayManifest,
  listVideoReplayManifests,
  getVideoWorkbench,
  getVideoWorkbenchPlan,
  importJobCandidate,
  importWorkbenchAssetVersion,
  removeVideoProjectMemoryFact,
  selectShotCandidate,
  upsertVideoProjectMemoryFact,
  updateStoryboardShot,
  updateTimelineClip,
  updateVideoAudioTrack,
} from '../../services/videoWorkbench.js';
import {
  approvedAssetVersions,
  approvedAudioAssetVersions,
  availableUploadedAssets,
  audioTrackDurationMs,
  audioTrackForAsset,
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
  const [clipDrafts, setClipDrafts] = useState({});
  const [replayManifest, setReplayManifest] = useState(null);
  const [replayManifests, setReplayManifests] = useState([]);
  const [replayManifestPreview, setReplayManifestPreview] = useState(null);
  const [workbenchPlan, setWorkbenchPlan] = useState(null);
  const [memoryDrafts, setMemoryDrafts] = useState({});
  const [newMemory, setNewMemory] = useState({ key: '', value: '{\n  \n}', source: 'user' });
  const [shotDraft, setShotDraft] = useState({ purpose: '', duration: 6, cameraLanguage: '', prompt: '' });
  const selectedProjectRef = useRef('');
  const requestSequenceRef = useRef(0);
  const replayRequestSequenceRef = useRef(0);
  const planRequestSequenceRef = useRef(0);

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
      setWorkbenchPlan(null);
      return;
    }
    const requestSequence = ++requestSequenceRef.current;
    if (!quiet) setLoading(true);
    try {
      const next = await getVideoWorkbench(id);
      if (requestSequence !== requestSequenceRef.current || selectedProjectRef.current !== id) return;
      setWorkbench(next);
      setWorkbenchPlan(null);
      setError('');
    } catch (loadError) {
      if (requestSequence !== requestSequenceRef.current || selectedProjectRef.current !== id) return;
      setWorkbench(null);
      setError(displayError(loadError));
    } finally {
      if (requestSequence === requestSequenceRef.current) setLoading(false);
    }
  }, []);

  const loadReplayManifests = useCallback(async id => {
    const requestSequence = ++replayRequestSequenceRef.current;
    if (!id) {
      setReplayManifests([]);
      setReplayManifest(null);
      setReplayManifestPreview(null);
      return;
    }
    try {
      const manifests = await listVideoReplayManifests(id, { limit: 20 });
      if (requestSequence !== replayRequestSequenceRef.current || selectedProjectRef.current !== id) return;
      setReplayManifests(manifests);
      setReplayManifest(current => manifests.find(item => item.id === current?.id) || manifests[0] || null);
    } catch (loadError) {
      if (requestSequence !== replayRequestSequenceRef.current || selectedProjectRef.current !== id) return;
      setReplayManifests([]);
      setReplayManifest(null);
      setReplayManifestPreview(null);
      setError(displayError(loadError));
    }
  }, []);

  const loadProjects = useCallback(async preferredId => {
    planRequestSequenceRef.current += 1;
    setWorkbenchPlan(null);
    setLoading(true);
    try {
      const next = videoProjects(await listProjects());
      setProjects(next);
      const jobProjectId = jobs.find(item => item?.projectId && next.some(project => project.id === item.projectId))?.projectId;
      const target = [preferredId, selectedProjectRef.current, jobProjectId, next[0]?.id]
        .find(id => id && next.some(project => project.id === id)) || '';
      selectedProjectRef.current = target;
      setProjectId(target);
      if (!target) {
        setWorkbench(null);
        setWorkbenchPlan(null);
        void loadReplayManifests('');
      }
      setError('');
    } catch (loadError) {
      setError(displayError(loadError));
    } finally {
      setLoading(false);
    }
  }, [jobs, loadReplayManifests]);

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
    if (projectId) {
      void loadWorkbench(projectId);
      void loadReplayManifests(projectId);
    } else {
      setWorkbench(null);
      setWorkbenchPlan(null);
      void loadReplayManifests('');
    }
  }, [loadReplayManifests, loadWorkbench, projectId]);

  const runMutation = useCallback(async (key, action) => {
    if (!projectId || busy) return;
    setBusy(key);
    setError('');
    try {
      await action();
      setWorkbenchPlan(null);
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

  const handleCheckGenerationPlan = useCallback(async () => {
    if (!projectId || busy) return;
    const requestSequence = ++planRequestSequenceRef.current;
    setBusy('plan:read');
    setError('');
    try {
      const plan = await getVideoWorkbenchPlan(projectId, {
        productId: 'seedance_standard',
        mode: 'smart',
        resolution: '720p',
        generateAudio: true,
      });
      if (requestSequence !== planRequestSequenceRef.current || selectedProjectRef.current !== projectId) return;
      setWorkbenchPlan(plan);
    } catch (planError) {
      if (requestSequence !== planRequestSequenceRef.current || selectedProjectRef.current !== projectId) return;
      setWorkbenchPlan(null);
      setError(displayError(planError));
    } finally {
      if (requestSequence === planRequestSequenceRef.current) setBusy('');
    }
  }, [busy, projectId]);

  const handleApproveGenerationPlan = useCallback(async () => {
    if (!projectId || busy || workbenchPlan?.status !== 'ready' || !workbenchPlan.planHash) return;
    setBusy('plan:approve');
    setError('');
    try {
      const approval = await approveVideoWorkbenchPlan(projectId, {
        productId: workbenchPlan.options?.productId,
        mode: workbenchPlan.options?.mode,
        resolution: workbenchPlan.options?.resolution,
        generateAudio: workbenchPlan.options?.generateAudio,
        planHash: workbenchPlan.planHash,
      });
      setWorkbenchPlan(current => current ? { ...current, approval } : current);
    } catch (approvalError) {
      setError(displayError(approvalError));
      setWorkbenchPlan(null);
    } finally {
      setBusy('');
    }
  }, [busy, projectId, workbenchPlan]);

  function handleSaveReplayManifest() {
    if (!workbench?.project?.id || busy) return;
    const rightsConfirmations = (workbench.assets || []).map(asset => ({
      assetId: asset.id,
      confirmation: 'owned_or_licensed',
    }));
    void runMutation('replay:save', async () => {
      const manifest = await createVideoReplayManifest(projectId, {
        skillId: 'video-workbench',
        skillVersion: 1,
        rightsConfirmations,
      });
      setReplayManifestPreview(null);
      setReplayManifest(manifest);
      setReplayManifests(current => [manifest, ...current.filter(item => item.id !== manifest.id)]);
    });
  }

  function handleCloneReplayManifest() {
    if (!replayManifest?.id || busy) return;
    setBusy('replay:clone');
    setError('');
    void cloneVideoReplayManifest(projectId, replayManifest.id, {
      title: `${workbench?.project?.title || '视频项目'} · 复用`,
    }).then(cloned => {
      setReplayManifest(null);
      setReplayManifestPreview(null);
      return loadProjects(cloned.project.id);
    }).catch(cloneError => {
      setError(displayError(cloneError));
    }).finally(() => setBusy(''));
  }

  function handleOpenReplayManifest() {
    if (!replayManifest?.id || busy) return;
    setBusy('replay:read');
    setError('');
    void getVideoReplayManifest(projectId, replayManifest.id)
      .then(manifest => setReplayManifestPreview(manifest))
      .catch(readError => setError(displayError(readError)))
      .finally(() => setBusy(''));
  }

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
    planRequestSequenceRef.current += 1;
    selectedProjectRef.current = nextId;
    setProjectId(nextId);
    setWorkbench(null);
    setWorkbenchPlan(null);
    setReplayManifest(null);
    setReplayManifests([]);
    setReplayManifestPreview(null);
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

  function updateClipDraft(clip, field, value) {
    setClipDrafts(current => ({
      ...current,
      [clip.id]: {
        start: current[clip.id]?.start ?? clip.trimStartMs / 1000,
        end: current[clip.id]?.end ?? clip.trimEndMs / 1000,
        [field]: value,
      },
    }));
  }

  function handleSaveClipTrim(clip) {
    const draft = clipDrafts[clip.id];
    if (!draft) return;
    const trimStartMs = Math.round(Number(draft.start) * 1000);
    const trimEndMs = Math.round(Number(draft.end) * 1000);
    if (!Number.isFinite(trimStartMs) || !Number.isFinite(trimEndMs)) return;
    void runMutation(`timeline:trim:${clip.id}`, async () => {
      await updateTimelineClip(projectId, clip.id, {
        expectedRevision: clip.revision,
        patch: { trimStartMs, trimEndMs },
      });
      setClipDrafts(current => {
        const next = { ...current };
        delete next[clip.id];
        return next;
      });
    });
  }

  function handleMoveTimelineClip(clip, delta) {
    if (!clip?.id) return;
    void runMutation(`timeline:position:${clip.id}`, () => updateTimelineClip(projectId, clip.id, {
      expectedRevision: clip.revision,
      patch: { position: Math.max(0, clip.position + delta) },
    }));
  }

  function handleToggleTimelineClip(clip) {
    if (!clip?.id) return;
    void runMutation(`timeline:mute:${clip.id}`, () => updateTimelineClip(projectId, clip.id, {
      expectedRevision: clip.revision,
      patch: { muted: !clip.muted },
    }));
  }

  function handleAddAudioTrack({ asset, version }) {
    if (!asset?.id || !version?.id || audioTrackForAsset(workbench, asset.id, version.id)) return;
    void runMutation(`audio:create:${asset.id}`, () => createVideoAudioTrack(projectId, {
      kind: asset.kind,
      assetId: asset.id,
      assetVersionId: version.id,
      startMs: 0,
      durationMs: audioTrackDurationMs(workbench),
      volume: 1,
      muted: false,
      language: asset.kind === 'voice' ? 'zh-CN' : '',
      voiceAnchor: asset.kind === 'voice' ? asset.name : '',
      beatMarkers: [],
      subtitleCues: [],
    }));
  }

  function handleToggleAudioTrack(track) {
    if (!track?.id) return;
    void runMutation(`audio:mute:${track.id}`, () => updateVideoAudioTrack(projectId, track.id, {
      expectedRevision: track.revision,
      patch: { muted: !track.muted },
    }));
  }

  function handleSetAudioVolume(track, event) {
    if (!track?.id) return;
    const volume = Math.min(2, Math.max(0, Number(event.target.value)));
    if (!Number.isFinite(volume) || volume === track.volume) return;
    void runMutation(`audio:volume:${track.id}`, () => updateVideoAudioTrack(projectId, track.id, {
      expectedRevision: track.revision,
      patch: { volume },
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
  const audioSources = approvedAudioAssetVersions(workbench);
  const audioTracks = Array.isArray(workbench?.audioTracks) ? workbench.audioTracks : [];

  return <section className="video-project-workbench" aria-label="视频项目工作台" aria-busy={loading || Boolean(busy)}>
    <header className="video-project-workbench-header">
      <div><span><Film size={16} />项目工作台</span><h2>把素材、分镜和候选版本组织成一条可回看的创作过程</h2><p>所有选择都保存到当前项目；工作台本身不会发起生成或扣除积分。</p></div>
      <div className="video-project-header-actions">
        {projectId && <button type="button" className="video-project-plan-check" disabled={Boolean(busy) || loading} onClick={handleCheckGenerationPlan}>
          {busy === 'plan:read' ? <LoaderCircle className="is-spinning" size={15} /> : <CircleAlert size={15} />} {busy === 'plan:read' ? '检查中…' : '检查生成计划'}
        </button>}
        <button type="button" className="video-project-replay-save" disabled={Boolean(busy) || loading || !workbench?.assets?.length} onClick={handleSaveReplayManifest}>
          {busy === 'replay:save' ? <LoaderCircle className="is-spinning" size={15} /> : <Save size={15} />}保存创作配方
        </button>
        {replayManifests.length > 0 && <label className="video-project-replay-picker">
          <span>已保存配方</span>
          <select aria-label="选择已保存配方" value={replayManifest?.id || ''} disabled={Boolean(busy) || loading} onChange={event => {
            const next = replayManifests.find(item => item.id === event.target.value) || null;
            setReplayManifest(next);
            setReplayManifestPreview(null);
          }}>
            {replayManifests.map((manifest, index) => <option key={manifest.id} value={manifest.id}>
              {manifest.skill?.id || '视频工作流'} · {manifest.manifestHash?.slice(0, 8) || `配方 ${index + 1}`}
            </option>)}
          </select>
        </label>}
        {replayManifest?.manifestHash && <div className="video-project-replay-status" role="status">
          <span>配方已保存 · {replayManifest.manifestHash.slice(0, 10)}</span>
          <button type="button" disabled={Boolean(busy)} onClick={handleOpenReplayManifest}>{busy === 'replay:read' ? <LoaderCircle className="is-spinning" size={14} /> : <Eye size={14} />}查看创作过程</button>
          <button type="button" disabled={Boolean(busy)} onClick={handleCloneReplayManifest}>{busy === 'replay:clone' ? <LoaderCircle className="is-spinning" size={14} /> : <Copy size={14} />}复用为新项目</button>
        </div>}
        <button type="button" className="video-project-refresh" aria-label="刷新视频项目" title="刷新视频项目" disabled={Boolean(busy) || loading} onClick={() => void loadProjects(projectId)}>
          <RefreshCw size={17} />
        </button>
      </div>
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

    {replayManifestPreview && <section className="video-project-replay-preview" aria-labelledby="video-replay-preview-heading">
      <header>
        <div><small>只读流程</small><h3 id="video-replay-preview-heading">创作过程预览</h3><p>这里展示已保存配方的结构摘要；不会复制私有素材地址，也不会重新生成。</p></div>
        <button type="button" disabled={Boolean(busy)} onClick={() => setReplayManifestPreview(null)}>关闭过程预览</button>
      </header>
      <div className="video-project-replay-summary">
        <div><span>工作流</span><strong>{replayManifestPreview.skill?.id || 'video-workbench'} · v{replayManifestPreview.skill?.version || 1}</strong></div>
        <div><span>素材版本</span><strong>{replayManifestPreview.assets?.length || 0} 个</strong></div>
        <div><span>分镜</span><strong>{replayManifestPreview.shots?.length || 0} 个</strong></div>
        <div><span>时间线</span><strong>{replayManifestPreview.timelineClips?.length || 0} 段</strong></div>
        <div><span>音轨</span><strong>{replayManifestPreview.audioTracks?.length || 0} 条</strong></div>
        <div><span>版权确认</span><strong>{replayManifestPreview.rightsConfirmations?.length || 0} 项</strong></div>
      </div>
      <ol className="video-project-replay-shots">
        {(replayManifestPreview.shots || []).map((shot, index) => <li key={shot.id || `${shot.purpose}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{shot.purpose || '未命名镜头'}</strong><small>{Math.round(Number(shot.durationMs || 0) / 100) / 10}s · {shot.bindings?.length || 0} 个素材绑定</small></div></li>)}
        {!replayManifestPreview.shots?.length && <li className="is-empty">当前配方还没有分镜。</li>}
      </ol>
      <footer>配方校验哈希：<code>{replayManifestPreview.manifestHash}</code></footer>
    </section>}

    {projectId && workbenchPlan && <section className={`video-project-plan ${workbenchPlan.status === 'ready' ? 'is-ready' : 'is-blocked'}`} aria-labelledby="video-generation-plan-heading">
      <header>
        <div><small>生成前检查</small><h3 id="video-generation-plan-heading">视频生成计划</h3><p>先确认项目完整性与成本，再进入后续生成流程。</p></div>
        <button type="button" disabled={Boolean(busy)} onClick={() => setWorkbenchPlan(null)}>清除检查结果</button>
      </header>
      <div className="video-project-plan-summary">
        <div><span>状态</span><strong>{workbenchPlan.status === 'ready' ? <><Check size={13} />可进入生成</> : <><CircleAlert size={13} />暂不可生成</>}</strong></div>
        <div><span>产品</span><strong>{workbenchPlan.product?.label || workbenchPlan.options?.productId || '视频产品'}</strong></div>
        <div><span>分镜</span><strong>{workbenchPlan.shots?.length || 0} 个 · {(Number(workbenchPlan.totalDurationMs || 0) / 1000).toFixed(1)} 秒</strong></div>
        <div><span>预计积分</span><strong>{Number(workbenchPlan.quote?.points || 0)} AI 积分</strong></div>
      </div>
      {!!workbenchPlan.blockers?.length && <ul className="video-project-plan-issues" aria-label="生成计划阻断原因">
        {workbenchPlan.blockers.slice(0, 8).map((item, index) => <li key={`${item.code}-${item.shotId || index}`}><CircleAlert size={14} /><span>{item.detail}</span></li>)}
      </ul>}
      {!!workbenchPlan.warnings?.length && <ul className="video-project-plan-warnings" aria-label="生成计划提示">
        {workbenchPlan.warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
      </ul>}
      <footer>
        <span>目录版本 {workbenchPlan.catalogVersion || workbenchPlan.quote?.catalogVersion || '未知'} · {workbenchPlan.approval ? `计划已确认 · ${workbenchPlan.approval.planHash.slice(0, 10)}` : '确认只保存计划快照，不会生成视频或扣除积分。'}</span>
        {workbenchPlan.status === 'ready' && <button type="button" className="video-project-plan-approve" disabled={Boolean(busy) || Boolean(workbenchPlan.approval)} onClick={handleApproveGenerationPlan}>
          {busy === 'plan:approve' ? <LoaderCircle className="is-spinning" size={13} /> : <Check size={13} />} {workbenchPlan.approval ? '计划已确认' : '确认生成计划'}
        </button>}
      </footer>
    </section>}

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
          const draft = clipDrafts[clip.id] || { start: clip.trimStartMs / 1000, end: clip.trimEndMs / 1000 };
          return <article key={clip.id} className={clip.status !== 'active' ? 'is-stale' : ''} style={{ '--clip-weight': Math.max(1, clip.trimEndMs - clip.trimStartMs) }}>
            <span>{index + 1}</span>
            <div className="video-project-timeline-main"><strong>{shot?.purpose || '镜头片段'}</strong><small>{((clip.trimEndMs - clip.trimStartMs) / 1000).toFixed(1)} 秒{clip.muted ? ' · 已静音' : ''}</small>
              <div className="video-project-timeline-edit" aria-label={`编辑${shot?.purpose || '镜头片段'}`}>
                <label><span>起点</span><input type="number" min="0" step="0.1" value={draft.start} disabled={Boolean(busy)} onChange={event => updateClipDraft(clip, 'start', event.target.value)} onBlur={() => handleSaveClipTrim(clip)} /></label>
                <label><span>终点</span><input type="number" min="0" step="0.1" value={draft.end} disabled={Boolean(busy)} onChange={event => updateClipDraft(clip, 'end', event.target.value)} onBlur={() => handleSaveClipTrim(clip)} /></label>
              </div>
              <div className="video-project-timeline-actions">
                <button type="button" aria-label="片段前移" title="片段前移" disabled={Boolean(busy) || clip.status !== 'active' || clip.position === 0} onClick={() => handleMoveTimelineClip(clip, -1)}><ChevronLeft size={13} /></button>
                <button type="button" aria-label="片段后移" title="片段后移" disabled={Boolean(busy) || clip.status !== 'active'} onClick={() => handleMoveTimelineClip(clip, 1)}><ChevronRight size={13} /></button>
                <button type="button" aria-label={clip.muted ? '取消片段静音' : '片段静音'} title={clip.muted ? '取消片段静音' : '片段静音'} disabled={Boolean(busy) || clip.status !== 'active'} onClick={() => handleToggleTimelineClip(clip)}>{clip.muted ? <VolumeX size={13} /> : <Volume2 size={13} />}</button>
              </div>
            </div>
          </article>;
        })}</div>
        {!workbench?.timelineClips?.length && <p className="video-project-inline-empty">选定镜头候选后，将它加入时间线；空时间线不会显示伪导出按钮。</p>}
        <footer className="video-project-delivery-status"><Film size={18} /><div><strong>{stageSummary.stage === 'ready' ? '基础时间线已就绪' : '继续完成上方步骤'}</strong><span>{stageSummary.stage === 'ready' ? '项目、素材版本、分镜、选定候选与时间线均已持久化。' : '交付只根据真实保存状态判断，不会提前标记完成。'}</span></div></footer>
      </section>

      <section className="video-project-band is-audio" aria-labelledby="video-audio-heading">
        <header><div><small>06</small><span><h3 id="video-audio-heading">声音与字幕</h3><p>把已确认的声线或配乐放入项目，回放时保留连续性元数据。</p></span></div><b>{audioTracks.length} 条音轨</b></header>
        <div className="video-project-audio-sources">
          {audioSources.map(({ asset, version }) => {
            const existing = audioTrackForAsset(workbench, asset.id, version.id);
            return <article key={`${asset.id}:${version.id}`}>
              <span><Music2 size={16} /></span><div><strong>{asset.name}</strong><small>{asset.kind === 'voice' ? '声线' : '配乐'} · V{version.sequence}</small></div>
              <button type="button" disabled={Boolean(busy) || Boolean(existing) || !workbench?.timelineClips?.length} onClick={() => handleAddAudioTrack({ asset, version })}>{existing ? <><Check size={14} />已加入</> : '加入音轨'}</button>
            </article>;
          })}
          {!audioSources.length && <p className="video-project-inline-empty">先导入并确认音频素材，确认后才能加入音轨。</p>}
        </div>
        <div className="video-project-audio-tracks">
          {audioTracks.map(track => <article key={track.id}>
            <span className="video-project-audio-track-icon">{track.muted ? <VolumeX size={15} /> : <Volume2 size={15} />}</span>
            <div><strong>{audioSources.find(({ asset }) => asset.id === track.assetId)?.asset.name || '项目音轨'}</strong><small>{track.kind === 'voice' ? '声线' : '配乐'} · {(track.durationMs / 1000).toFixed(1)} 秒 · 音量 {Math.round(track.volume * 100)}%</small><label className="video-project-audio-volume"><span>音量</span><input type="range" min="0" max="2" step="0.05" value={track.volume} aria-label={`调整${track.kind === 'voice' ? '声线' : '配乐'}音量`} disabled={Boolean(busy)} onChange={event => handleSetAudioVolume(track, event)} /></label></div>
            <button type="button" className="video-project-audio-toggle" disabled={Boolean(busy)} onClick={() => handleToggleAudioTrack(track)}>{track.muted ? '取消静音' : '静音'}</button>
          </article>)}
          {!audioTracks.length && <p className="video-project-inline-empty">时间线加入镜头后，可从上方已确认素材中选择声音。</p>}
        </div>
      </section>
    </>}
  </section>;
}
