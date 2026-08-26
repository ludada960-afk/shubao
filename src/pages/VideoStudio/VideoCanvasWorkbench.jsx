import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CircleAlert,
  Clapperboard,
  Clock3,
  Film,
  Gauge,
  ImagePlus,
  Layers3,
  LoaderCircle,
  MessageSquareText,
  MousePointerSquareDashed,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  SendHorizontal,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../store/AppContext.jsx';
import VideoCanvasFlowCanvas from './VideoCanvasFlowCanvas.jsx';
import { createProject, listProjectAssetLibrary, listProjects } from '../../services/projects.js';
import { quoteBillingAction } from '../../services/billing.js';
import { createVideoJob, getVideoJob } from '../../services/video.js';
import {
  applyShotCandidateToTimeline,
  approveVideoWorkbenchPlan,
  approveWorkbenchAssetVersion,
  createStoryboardShot,
  createVideoExportManifest,
  createVideoWorkbenchGenerationDraft,
  createWorkbenchAsset,
  getVideoWorkbench,
  getVideoWorkbenchPlan,
  importJobCandidate,
  importProjectAssetVersion,
  importWorkbenchAssetVersion,
  replaceTimelineClipCandidate,
  selectShotCandidate,
  updateStoryboardShot,
  updateTimelineClip,
} from '../../services/videoWorkbench.js';
import {
  CHAT_TWEAK_CHIPS,
  composeTweakPrompt,
  confirmedDecisionPromptParts,
  decisionQueueItems,
  emptyDecisionState,
  shotEventGroups,
  tweakRegenerationReady,
} from './directorPanelModel.js';
import {
  activeTimelineClips,
  clampTrimPatch,
  clipDurationMs,
  clipRebindOptions,
  clipTrimBounds,
  exportManifestSummary,
  exportReadiness,
  timelineTotalDurationMs,
} from './timelineDrawerModel.js';
import { DELIVERY_METADATA_SOURCE } from './videoDeliveryModel.js';
import {
  allowedGenerationModes,
  buildCanvasEdges,
  buildCanvasNodes,
  CAMERA_MOVE_CHIPS,
  CANVAS_GENERATION_MODES,
  canvasNodeSize,
  defaultCanvasLayout,
  importedVideoAssetIds,
  materialNaming,
  marqueeSelectAssetNodes,
  planPointsRange,
  pointsEstimateRange,
  resolveCanvasApiMode,
  schemeGate,
  selectionReferencePayload,
  shotGenerationReadiness,
} from './videoCanvasModel.js';
import { reusableProjectAssets, candidateJobsForProject, nextShotPosition, nextTimelinePosition, selectedCandidateForShot } from './videoProjectWorkbenchModel.js';
import { availableUploadedAssets } from './videoProjectWorkbenchModel.js';
import { quoteForVideoProduct } from './videoStudioModel.js';
import './VideoCanvasWorkbench.css';

const RATIOS = ['9:16', '16:9', '1:1', '4:3', '3:4', '21:9'];
const FINAL_JOB_STATES = new Set(['completed', 'failed', 'needs_review']);
const DEFAULT_PRODUCT_ID = 'seedance_standard';

function displayError(error) {
  if (error?.status === 409 || error?.code === 'VERSION_CONFLICT') {
    return '内容已在其他位置更新，已刷新项目，请检查后重试。';
  }
  return error?.message || '操作没有完成，请刷新后重试。';
}

function normalizeBudgetCapInput(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return undefined;
  const points = Number(normalized);
  if (!Number.isSafeInteger(points) || points < 0) throw new Error('预算上限必须是非负整数积分');
  return points;
}

function clampDurationSeconds(seconds, product) {
  const min = Number(product?.durations?.min) || 4;
  const max = Number(product?.durations?.max) || 15;
  const rounded = Math.round(Number(seconds) || min);
  return Math.max(min, Math.min(max, rounded));
}

function keyFor(prefix) {
  const id = globalThis.crypto?.randomUUID?.() || (Date.now() + '-' + Math.random().toString(36).slice(2));
  return prefix + '-' + id;
}

function NodePreview({ url, kind, label }) {
  if (!url) {
    return <span className={'vcb-node-placeholder is-' + kind}><Film size={18} aria-hidden="true" /><small>{label}</small></span>;
  }
  if (kind === 'video') return <video src={url} aria-label={label} preload="metadata" playsInline muted />;
  if (kind === 'audio') return <span className={'vcb-node-placeholder is-audio'}><Film size={18} aria-hidden="true" /><small>{label}</small></span>;
  return <img src={url} alt={label} loading="lazy" />;
}

export default function VideoCanvasWorkbench({
  enabled = false,
  logged = false,
  planningOnly = false,
  uploadRecords = [],
  jobs = [],
  products = [],
  onProjectChange,
  onPlanApprovalChange,
}) {
  const { dispatch, refreshBillingBalance } = useApp();
  const [projects, setProjects] = useState([]);
  const [libraryRows, setLibraryRows] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [workbench, setWorkbench] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [intent, setIntent] = useState({ goal: '', sellingPoints: '', duration: 8, ratio: '9:16', mode: 'smart', cameraMove: '' });
  const [plan, setPlan] = useState(null);
  const [generationDraft, setGenerationDraft] = useState(null);
  const [budgetCapPoints, setBudgetCapPoints] = useState('');
  const [positions, setPositions] = useState({});
  const [selectedIds, setSelectedIds] = useState([]);
  const [marquee, setMarquee] = useState(null);
  const [expandedShots, setExpandedShots] = useState({});
  const [shotDrafts, setShotDrafts] = useState({});
  const [shotErrors, setShotErrors] = useState({});
  const [trackedJobs, setTrackedJobs] = useState({});
  // P2 右栏导演检查器：决策卡 / 改稿对话
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [decisions, setDecisions] = useState(emptyDecisionState);
  const [tweak, setTweak] = useState({ shotId: '', instruction: '', chips: [] });
  // P2 底部时间线抽屉
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [clipDrafts, setClipDrafts] = useState({});
  const [clipError, setClipError] = useState('');
  const [exportManifest, setExportManifest] = useState(null);
  const [exportBusy, setExportBusy] = useState(false);

  const stageRef = useRef(null);
  const [flowOn] = useState(() => { try { return typeof localStorage !== 'undefined' && localStorage.getItem('shubao_flow_canvas') === '1'; } catch { return false; } });
  // W2 持久化（本地快照级）：按项目记忆画布摆位，刷新不丢
  useEffect(() => {
    try { localStorage.setItem('shubao_vcb_positions_' + (projectId || 'default'), JSON.stringify(positions)); } catch {}
  }, [positions, projectId]);
  const requestSequenceRef = useRef(0);
  const attachedJobIdsRef = useRef(new Set());
  // interaction: null | { kind:'drag', id, offsetX, offsetY } | { kind:'marquee', startX, startY }
  const [interaction, setInteraction] = useState(null);

  const uploads = useMemo(() => availableUploadedAssets(uploadRecords), [uploadRecords]);
  const libraryAssets = useMemo(() => reusableProjectAssets(libraryRows), [libraryRows]);
  const nodes = useMemo(() => buildCanvasNodes({ uploads, libraryAssets, workbench }), [uploads, libraryAssets, workbench]);
  const laidOutNodes = useMemo(() => {
    const defaults = defaultCanvasLayout(nodes);
    return nodes.map(node => ({ ...node, ...(positions[node.id] || defaults[node.id] || { x: 32, y: 32 }) }));
  }, [nodes, positions]);
  const nodesById = useMemo(() => {
    const map = new Map();
    laidOutNodes.forEach(node => map.set(node.id, node));
    return map;
  }, [laidOutNodes]);
  const edges = useMemo(() => buildCanvasEdges(workbench), [workbench]);
  const selectedNodes = useMemo(
    () => selectedIds.map(id => nodesById.get(id)).filter(Boolean),
    [nodesById, selectedIds],
  );
  const modeAvailability = useMemo(() => allowedGenerationModes(selectedNodes), [selectedNodes]);
  const gate = useMemo(() => schemeGate(plan), [plan]);
  const planRange = useMemo(() => planPointsRange(plan), [plan]);
  const product = useMemo(
    () => products.find(item => item?.id === (plan?.options?.productId || DEFAULT_PRODUCT_ID)) || products[0] || null,
    [products, plan?.options?.productId],
  );
  const estimateRange = useMemo(() => planRange || pointsEstimateRange(product), [planRange, product]);
  const namedUploads = useMemo(() => materialNaming(uploads.map(upload => ({
    key: upload.asset.id,
    kind: upload.asset.kind,
    name: upload.file?.name || upload.asset.fileName || upload.asset.name || '上传素材',
    upload,
  }))), [uploads]);
  const namedLibrary = useMemo(() => materialNaming(libraryAssets.map(item => ({
    key: item.projectAssetId,
    kind: item.mediaKind,
    item,
  }))), [libraryAssets]);
  const completedJobs = useMemo(() => candidateJobsForProject(jobs, projectId), [jobs, projectId]);
  const shots = useMemo(() => Array.isArray(workbench?.shots) ? workbench.shots : [], [workbench]);
  const importedUploadIds = useMemo(() => importedVideoAssetIds(workbench), [workbench]);
  const importedLibraryKeys = useMemo(() => new Set((Array.isArray(workbench?.assets) ? workbench.assets : []).flatMap(asset =>
    (Array.isArray(asset?.versions) ? asset.versions : [])
      .map(version => version?.metadata?.sourceProjectAssetRef?.projectAssetId)
      .filter(Boolean))), [workbench]);
  // P2 接收侧：其他画布/电商套图「发往视频项目」送达的素材（按投递元数据识别）。
  const deliveredAssets = useMemo(() => (Array.isArray(workbench?.assets) ? workbench.assets : []).filter(asset =>
    (Array.isArray(asset?.versions) ? asset.versions : []).some(version => version?.metadata?.source === DELIVERY_METADATA_SOURCE)), [workbench]);
  // P2 右栏检查器派生数据
  const decisionItems = useMemo(() => decisionQueueItems(decisions), [decisions]);
  const decisionPromptParts = useMemo(() => confirmedDecisionPromptParts(decisions), [decisions]);
  const eventGroups = useMemo(() => shotEventGroups({ shots, trackedJobs, planShots: plan?.shots || [] }), [shots, trackedJobs, plan]);
  // P2 时间线抽屉派生数据
  const timelineClips = useMemo(() => activeTimelineClips(workbench), [workbench]);
  const timelineTotalMs = useMemo(() => timelineTotalDurationMs(timelineClips), [timelineClips]);
  const exportReady = useMemo(() => exportReadiness(workbench), [workbench]);
  const manifestSummary = useMemo(() => exportManifestSummary(exportManifest), [exportManifest]);

  const setShotError = useCallback((shotId, message) => {
    setShotErrors(current => ({ ...current, [shotId]: message }));
  }, []);

  const loadWorkbench = useCallback(async (id, { quiet = false } = {}) => {
    if (!id) {
      setWorkbench(null);
      setPlan(null);
      setGenerationDraft(null);
      return;
    }
    const sequence = ++requestSequenceRef.current;
    if (!quiet) setLoading(true);
    try {
      const next = await getVideoWorkbench(id);
      if (sequence !== requestSequenceRef.current) return;
      setWorkbench(next);
      setError('');
      setPositions((() => { try { return JSON.parse(localStorage.getItem('shubao_vcb_positions_' + (id || 'default')) || '{}') || {}; } catch { return {}; } })());
      setSelectedIds([]);
    } catch (loadError) {
      if (sequence !== requestSequenceRef.current) return;
      setWorkbench(null);
      setError(displayError(loadError));
    } finally {
      if (sequence === requestSequenceRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled || !logged) return undefined;
    let active = true;
    Promise.all([listProjects(), listProjectAssetLibrary({ limit: 200 }).catch(() => [])])
      .then(([projectRows, library]) => {
        if (!active) return;
        const videoProjects = (Array.isArray(projectRows) ? projectRows : []).filter(item => item?.kind === 'video');
        setProjects(videoProjects);
        setLibraryRows(Array.isArray(library) ? library : []);
        setProjectId(current => current || videoProjects[0]?.id || '');
      })
      .catch(loadError => {
        if (active) setError(displayError(loadError));
      });
    return () => { active = false; };
  }, [enabled, logged]);

  useEffect(() => {
    onProjectChange?.(projectId || '');
    if (projectId) void loadWorkbench(projectId);
    else {
      setWorkbench(null);
      setPlan(null);
      setGenerationDraft(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    onPlanApprovalChange?.(gate.approvedPlanHash || '');
  }, [gate.approvedPlanHash, onPlanApprovalChange]);

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

  // ── 左栏：方案卡（只读检查 → 审批门 → 草稿）───────────────────────────
  const handleCheckScheme = useCallback(async () => {
    if (!projectId || busy) return;
    let budgetCap;
    try {
      budgetCap = normalizeBudgetCapInput(budgetCapPoints);
    } catch (budgetError) {
      setError(budgetError.message);
      return;
    }
    setBusy('scheme:check');
    setError('');
    try {
      const checked = await getVideoWorkbenchPlan(projectId, {
        productId: DEFAULT_PRODUCT_ID,
        mode: 'smart',
        resolution: '720p',
        generateAudio: true,
        budgetCapPoints: budgetCap,
      });
      setPlan(checked);
      setGenerationDraft(null);
    } catch (planError) {
      setPlan(null);
      setError(displayError(planError));
    } finally {
      setBusy('');
    }
  }, [budgetCapPoints, busy, projectId]);

  const handleApproveScheme = useCallback(async () => {
    if (!projectId || busy || !plan?.planHash || plan.status !== 'ready') return;
    setBusy('scheme:approve');
    setError('');
    try {
      const approval = await approveVideoWorkbenchPlan(projectId, {
        productId: plan.options?.productId || DEFAULT_PRODUCT_ID,
        mode: plan.options?.mode || 'smart',
        resolution: plan.options?.resolution || '720p',
        generateAudio: plan.options?.generateAudio !== false,
        planHash: plan.planHash,
        budgetCapPoints: plan.options?.budgetCapPoints,
      });
      setPlan(current => (current ? { ...current, approval } : current));
      const draft = await createVideoWorkbenchGenerationDraft(projectId, {
        productId: plan.options?.productId || DEFAULT_PRODUCT_ID,
        mode: plan.options?.mode || 'smart',
        resolution: plan.options?.resolution || '720p',
        generateAudio: plan.options?.generateAudio !== false,
        planHash: plan.planHash,
        budgetCapPoints: plan.options?.budgetCapPoints,
      }).catch(() => null);
      setGenerationDraft(draft);
    } catch (approveError) {
      setError(displayError(approveError));
    } finally {
      setBusy('');
    }
  }, [busy, plan, projectId]);

  // ── 单镜流：镜头节点发起生成（复用现有 provider-neutral 生成链）─────────
  const initiateShotGeneration = useCallback(async (shot, { promptOverride = '', extraPromptParts = [] } = {}) => {
    if (!projectId || !shot?.id) return;
    const readiness = shotGenerationReadiness(gate, { planningOnly });
    if (!readiness.ok) {
      setShotError(shot.id, readiness.reason);
      return;
    }
    if (!product?.id) {
      setShotError(shot.id, '视频产品暂不可用，请稍后重试');
      return;
    }
    const durationSeconds = clampDurationSeconds((shot.durationMs || 8000) / 1000, product);
    let skuQuote;
    try {
      skuQuote = quoteForVideoProduct(product, durationSeconds);
    } catch (quoteError) {
      setShotError(shot.id, quoteError.message);
      return;
    }
    setShotError(shot.id, '');
    setBusy('generate:' + shot.id);
    try {
      const quoteResponse = await quoteBillingAction({ sku: skuQuote.sku, quantity: 1 });
      const referenceNodes = selectedNodes.filter(node => node.type === 'asset');
      const references = selectionReferencePayload(referenceNodes);
      const apiMode = resolveCanvasApiMode(intent.mode, referenceNodes);
      const cameraChip = CAMERA_MOVE_CHIPS.find(chip => chip[0] === intent.cameraMove);
      const promptParts = [
        promptOverride || shot.prompt || intent.goal || ('围绕「' + (shot.purpose || '商品短片') + '」完成这一镜'),
        intent.sellingPoints ? ('卖点：' + intent.sellingPoints) : '',
        cameraChip ? ('运镜：' + cameraChip[1]) : '',
        ...extraPromptParts,
      ].filter(Boolean);
      const created = await createVideoJob({
        projectId,
        workbenchPlanHash: gate.approvedPlanHash,
        productId: product.id,
        mode: apiMode,
        prompt: promptParts.join('。'),
        duration: durationSeconds,
        aspectRatio: RATIOS.includes(intent.ratio) ? intent.ratio : '9:16',
        resolution: '720p',
        generateAudio: true,
        billingQuoteId: quoteResponse.quote?.quoteId || quoteResponse.quoteId,
        references: {
          firstImage: apiMode === 'frame' ? (references.images[0] || '') : '',
          lastImage: apiMode === 'frame' ? (references.images[1] || '') : '',
          images: apiMode === 'frame' ? [] : references.images,
          videos: references.videos,
          audios: references.audios,
        },
      }, keyFor('canvas-shot-job'));
      setTrackedJobs(current => ({
        ...current,
        [created.job.id]: { jobId: created.job.id, shotId: shot.id, status: created.job.status, progress: created.job.progress || 2 },
      }));
    } catch (generateError) {
      if (generateError?.status === 402 || generateError?.code === 'BILLING_INSUFFICIENT_CREDITS') {
        dispatch({ type: 'OPEN_PAYWALL', reason: 'INSUFFICIENT_CREDITS' });
      }
      setShotError(shot.id, generateError?.message || '视频任务创建失败，请稍后重试');
    } finally {
      setBusy('');
    }
  }, [dispatch, gate, intent, planningOnly, product, projectId, selectedNodes, setShotError]);

  // 生成中任务的轮询与候选回挂
  const pollTrackedJobs = useCallback(async () => {
    const entries = Object.values(trackedJobs);
    if (!entries.length || !projectId) return;
    await Promise.all(entries.map(async entry => {
      if (FINAL_JOB_STATES.has(entry.status)) return;
      try {
        const response = await getVideoJob(entry.jobId);
        const next = response?.job;
        if (!next) return;
        setTrackedJobs(current => ({ ...current, [next.id]: { ...current[next.id], jobId: next.id, shotId: entry.shotId, status: next.status, progress: next.progress, error: next.error } }));
        if (FINAL_JOB_STATES.has(next.status)) {
          void refreshBillingBalance?.({ force: true }).catch(() => {});
          if (next.status === 'completed' && !attachedJobIdsRef.current.has(next.id)) {
            attachedJobIdsRef.current.add(next.id);
            try {
              await importJobCandidate(projectId, entry.shotId, { generationJobId: next.id });
              await loadWorkbench(projectId, { quiet: true });
            } catch (attachError) {
              setShotError(entry.shotId, displayError(attachError));
            }
          }
          if (next.status !== 'completed') {
            setShotError(entry.shotId, next.error || '生成未交付，可在该镜头就近重试');
          }
          setTimeout(() => {
            setTrackedJobs(current => {
              const nextEntries = { ...current };
              delete nextEntries[next.id];
              return nextEntries;
            });
          }, 8000);
        }
      } catch {
        // 单次轮询失败保持状态，下一轮继续
      }
    }));
  }, [loadWorkbench, projectId, refreshBillingBalance, setShotError, trackedJobs]);

  useEffect(() => {
    const timer = setInterval(() => { void pollTrackedJobs(); }, 5000);
    return () => clearInterval(timer);
  }, [pollTrackedJobs]);

  // ── 画布交互：拖拽摆位 / 框选素材 ──────────────────────────────────────
  const stagePoint = useCallback(event => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }, []);

  const handleNodePointerDown = useCallback((node, event) => {
    if (event.target.closest('button,input,select,textarea,a,[data-no-drag]')) return;
    event.preventDefault();
    const point = stagePoint(event);
    setInteraction({ kind: 'drag', id: node.id, offsetX: point.x - node.x, offsetY: point.y - node.y });
  }, [stagePoint]);

  const handleStagePointerDown = useCallback(event => {
    if (event.target.closest('[data-node],[data-generation-bar],.vcb-stage-hints')) return;
    const point = stagePoint(event);
    setInteraction({ kind: 'marquee', startX: point.x, startY: point.y });
    setMarquee({ x: point.x, y: point.y, width: 0, height: 0 });
  }, [stagePoint]);

  useEffect(() => {
    if (!interaction) return undefined;
    const handleMove = event => {
      const point = stagePoint(event);
      if (interaction.kind === 'drag') {
        setPositions(current => ({
          ...current,
          [interaction.id]: { x: Math.max(0, point.x - interaction.offsetX), y: Math.max(0, point.y - interaction.offsetY) },
        }));
        return;
      }
      setMarquee({
        x: Math.min(interaction.startX, point.x),
        y: Math.min(interaction.startY, point.y),
        width: Math.abs(point.x - interaction.startX),
        height: Math.abs(point.y - interaction.startY),
      });
    };
    const handleUp = () => {
      if (interaction.kind === 'marquee') {
        setMarquee(currentRect => {
          setSelectedIds(marqueeSelectAssetNodes(laidOutNodes, currentRect));
          return null;
        });
      }
      setInteraction(null);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [interaction, laidOutNodes, stagePoint]);

  // ── 左栏素材带入：导入并确认（与旧瀑布同一持久化链）───────────────────
  function handleImportUpload(row) {
    if (!projectId || busy || importedUploadIds.has(row.key)) return;
    const upload = row.upload;
    const kind = upload.asset.kind === 'video' ? 'scene' : upload.asset.kind === 'audio' ? 'music' : 'product';
    void runMutation('asset-import:' + row.key, async () => {
      const asset = await createWorkbenchAsset(projectId, { kind, name: row.objectiveName });
      const version = await importWorkbenchAssetVersion(projectId, asset.id, {
        videoAssetId: upload.asset.id,
        metadata: { source: 'video-canvas-upload' },
      });
      await approveWorkbenchAssetVersion(projectId, asset.id, {
        versionId: version.id,
        expectedRevision: asset.revision,
      });
    });
  }

  function handleImportLibrary(row) {
    if (!projectId || busy || importedLibraryKeys.has(row.key)) return;
    const item = row.item;
    const kind = item.mediaKind === 'video' ? 'scene' : item.mediaKind === 'audio' ? 'music' : 'style';
    void runMutation('library-import:' + row.key, async () => {
      const asset = await createWorkbenchAsset(projectId, { kind, name: row.objectiveName });
      const version = await importProjectAssetVersion(projectId, asset.id, {
        projectId: item.sourceProject.id,
        projectAssetId: item.projectAssetId,
        role: kind,
        expectedContentHash: item.contentHash,
      }, { source: 'project-asset-library' });
      await approveWorkbenchAssetVersion(projectId, asset.id, {
        versionId: version.id,
        expectedRevision: asset.revision,
      });
    });
  }

  // ── 镜头编辑 / 候选 ───────────────────────────────────────────────────
  function toggleShotEditor(shotId) {
    setExpandedShots(current => ({ ...current, [shotId]: !current[shotId] }));
    setShotDrafts(current => {
      if (current[shotId]) return current;
      const shot = shots.find(item => item.id === shotId);
      return {
        ...current,
        [shotId]: {
          purpose: shot?.purpose || '',
          prompt: shot?.prompt || '',
          duration: (shot?.durationMs || 8000) / 1000,
        },
      };
    });
  }

  function handleSaveShot(shot) {
    const draft = shotDrafts[shot.id];
    if (!draft) return;
    void runMutation('shot:' + shot.id, async () => {
      await updateStoryboardShot(projectId, shot.id, {
        expectedRevision: shot.revision,
        patch: {
          purpose: String(draft.purpose || '').trim().slice(0, 500),
          prompt: String(draft.prompt || '').trim(),
          durationMs: Math.round(Number(draft.duration) * 1000),
        },
      });
    });
  }

  function handleSelectCandidate(shot, candidate) {
    void runMutation('select:' + candidate.id, () => selectShotCandidate(projectId, shot.id, {
      candidateId: candidate.id,
      expectedRevision: shot.revision,
    }));
  }

  function handleImportJobCandidate(shot, job) {
    void runMutation('import:' + job.id, () => importJobCandidate(projectId, shot.id, { generationJobId: job.id }));
  }

  // ── P2 右栏导演检查器：决策卡 / 任务事件流 / 改稿对话 ───────────────────
  function toggleDecisionOption(cardId, value) {
    setDecisions(current => ({
      ...current,
      values: { ...current.values, [cardId]: current.values[cardId] === value ? '' : value },
      confirmed: { ...current.confirmed, [cardId]: false },
    }));
  }

  function confirmDecision(cardId) {
    setDecisions(current => ({ ...current, confirmed: { ...current.confirmed, [cardId]: true } }));
  }

  function toggleTweakChip(chipId) {
    setTweak(current => ({
      ...current,
      chips: current.chips.includes(chipId)
        ? current.chips.filter(id => id !== chipId)
        : [...current.chips, chipId],
    }));
  }

  function handleTweakSubmit(shot) {
    if (!projectId || !shot?.id) return;
    const composed = composeTweakPrompt({ basePrompt: shot.prompt || '', instruction: tweak.instruction, chipIds: tweak.chips });
    const readinessCheck = shotGenerationReadiness(gate, { planningOnly });
    if (!readinessCheck.ok && !planningOnly) {
      setShotError(shot.id, readinessCheck.reason);
      return;
    }
    const regen = tweakRegenerationReady({ prompt: composed, gatePhase: gate.phase });
    if (!regen.ok && !planningOnly) {
      setShotError(shot.id, regen.reason);
      return;
    }
    void runMutation('tweak:' + shot.id, async () => {
      await updateStoryboardShot(projectId, shot.id, {
        expectedRevision: shot.revision,
        patch: { prompt: composed.slice(0, 4000) },
      });
      await loadWorkbench(projectId, { quiet: true });
      if (!planningOnly) {
        await initiateShotGeneration({ ...shot, prompt: composed }, {
          promptOverride: composed,
          extraPromptParts: decisionPromptParts,
        });
      }
    });
    setTweak(current => ({ ...current, instruction: '' }));
  }

  // ── P2 时间线抽屉：trim 手柄接字段 / 候选换绑 / 导出清单 ─────────────────
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
    if (!draft || !projectId) return;
    const shot = shots.find(item => item.id === clip.shotId);
    let patch;
    try {
      patch = clampTrimPatch({ clip, shot, trimStartMs: Number(draft.start) * 1000, trimEndMs: Number(draft.end) * 1000 });
    } catch (trimError) {
      setClipError(trimError.message);
      return;
    }
    setClipError('');
    void runMutation('timeline:trim:' + clip.id, () => updateTimelineClip(projectId, clip.id, {
      expectedRevision: clip.revision,
      patch,
    }));
  }

  function handleReplaceTimelineClipCandidate(clip, candidateId) {
    if (!projectId || !candidateId) return;
    void runMutation('timeline:replace:' + clip.id, () => replaceTimelineClipCandidate(projectId, clip.id, {
      expectedRevision: clip.revision,
      candidateId,
    }));
  }

  function handleAddClipToTimeline(shot, candidate) {
    if (!projectId || !shot?.id || !candidate?.id) return;
    void runMutation('timeline:add:' + shot.id, () => applyShotCandidateToTimeline(projectId, shot.id, {
      candidateId: candidate.id,
      expectedShotRevision: shot.revision,
      position: nextTimelinePosition(workbench?.timelineClips),
      trimStartMs: 0,
      trimEndMs: shot.durationMs,
      muted: false,
    }));
  }

  async function handleCreateExportManifest() {
    if (!projectId || exportBusy || !exportReady.ok) return;
    setExportBusy(true);
    setError('');
    try {
      const manifest = await createVideoExportManifest(projectId);
      setExportManifest(manifest);
    } catch (exportError) {
      setError(displayError(exportError));
    } finally {
      setExportBusy(false);
    }
  }

  function handleCreateShot() {
    if (!projectId) return;
    const purpose = (intent.goal || '新镜头').slice(0, 120);
    void runMutation('shot:create', async () => {
      await createStoryboardShot(projectId, {
        position: nextShotPosition(shots),
        purpose,
        durationMs: clampDurationSeconds(intent.duration, product) * 1000,
        prompt: intent.goal || purpose,
      });
    });
  }

  function handleCreateProject(event) {
    event.preventDefault();
    const title = newProjectTitle.trim();
    if (!title || busy) return;
    setBusy('project:create');
    setError('');
    createProject({ kind: 'video', title, idempotencyKey: keyFor('video-project') })
      .then(created => {
        setNewProjectTitle('');
        setProjects(current => [created, ...current.filter(item => item.id !== created.id)]);
        setProjectId(created.id);
      })
      .catch(createError => setError(displayError(createError)))
      .finally(() => setBusy(''));
  }

  if (!enabled || !logged) return null;

  const trackedByShot = {};
  Object.values(trackedJobs).forEach(entry => {
    if (!trackedByShot[entry.shotId]) trackedByShot[entry.shotId] = [];
    trackedByShot[entry.shotId].push(entry);
  });

  const edgeGeometry = edges.map(edge => {
    const to = nodesById.get(edge.to);
    const from = edge.fromProjectAssetId
      ? laidOutNodes.find(node => node.sourceKey === edge.fromProjectAssetId && node.source === 'library')
      : nodesById.get(edge.from);
    if (!from || !to) return null;
    const fromSize = canvasNodeSize(from.type);
    const toSize = canvasNodeSize(to.type);
    return {
      edge,
      x1: from.x + fromSize.width / 2,
      y1: from.y + fromSize.height,
      x2: to.x + toSize.width / 2,
      y2: to.y,
    };
  }).filter(Boolean);

  return <section className="video-canvas-workbench" aria-label="视频画布工作台" aria-busy={loading || Boolean(busy)}>
    <header className="vcb-topbar">
      <div className="vcb-topbar-title"><Clapperboard size={16} /><strong>视频创作工作台</strong>
        <span className={'vcb-mode-chip' + (planningOnly ? ' is-planning' : ' is-live')}>
          <ShieldCheck size={13} />{planningOnly ? 'PLANNING · 规划不扣费' : 'LIVE'}
        </span>
      </div>
      <label className="vcb-project-picker"><span>项目</span>
        <select value={projectId} onChange={event => setProjectId(event.target.value)} disabled={Boolean(busy)}>
          <option value="">选择视频项目</option>
          {projects.map(item => <option key={item.id} value={item.id}>{item.title || '未命名视频项目'}</option>)}
        </select>
      </label>
      <form className="vcb-project-create" onSubmit={handleCreateProject}>
        <input value={newProjectTitle} maxLength={80} placeholder="新项目名称" onChange={event => setNewProjectTitle(event.target.value)} />
        <button type="submit" disabled={Boolean(busy) || !newProjectTitle.trim()}><Plus size={14} />建立</button>
      </form>
      <button type="button" className={'vcb-drawer-toggle' + (inspectorOpen ? ' is-open' : '')} aria-label="切换导演检查器" aria-pressed={inspectorOpen} onClick={() => setInspectorOpen(current => !current)}>
        <Gauge size={15} />导演检查器
      </button>
      <button type="button" className={'vcb-drawer-toggle' + (timelineOpen ? ' is-open' : '')} aria-label="切换时间线抽屉" aria-pressed={timelineOpen} onClick={() => setTimelineOpen(current => !current)}>
        <ListVideo size={15} />时间线{timelineClips.length ? ' · ' + timelineClips.length : ''}
      </button>
      <button type="button" className="vcb-refresh" aria-label="刷新画布工作台" disabled={Boolean(busy) || loading} onClick={() => { void loadWorkbench(projectId); }}>
        <RefreshCw size={15} />
      </button>
    </header>

    {planningOnly && <div className="vcb-planning-banner" role="status">
      <ShieldCheck size={15} />规划模式：可摆位、连线、检查方案；不会调用供应商，也不会扣除积分。
    </div>}
    {error && <div className="vcb-alert" role="alert"><CircleAlert size={16} /><span>{error}</span><button type="button" onClick={() => void loadWorkbench(projectId)}>重试</button></div>}

    {!projectId && <div className="vcb-empty"><Clapperboard size={26} /><strong>先选择或建立一个视频项目</strong><span>项目承载素材版本、分镜、候选与时间线。</span></div>}

    {projectId && <div className={'vcb-columns' + (inspectorOpen ? ' has-inspector' : '')}>
      <aside className="vcb-left" aria-label="输入与方案">
        <section className="vcb-card" aria-labelledby="vcb-assets-heading">
          <h3 id="vcb-assets-heading"><ImagePlus size={15} />素材带入</h3>
          <p className="vcb-card-hint">上传或来自其他项目的素材按「产品图N」客观命名；图片可作商品图 × 参考图。</p>
          <ul className="vcb-asset-list">
            {namedUploads.map(row => (
              <li key={row.key}>
                <span className="vcb-asset-name">{row.objectiveName}</span>
                <em>{row.badge}</em>
                <small>{row.name}</small>
                <button type="button" data-no-drag className="vcb-import"
                  disabled={Boolean(busy) || importedUploadIds.has(row.key)}
                  onClick={() => handleImportUpload(row)}>
                  {importedUploadIds.has(row.key) ? <>已导入</> : busy === ('asset-import:' + row.key) ? '导入中…' : '导入并确认'}
                </button>
              </li>
            ))}
            {namedLibrary.map(row => (
              <li key={row.key}>
                <span className="vcb-asset-name">{row.objectiveName}</span>
                <em>{row.badge}</em>
                <small>{row.item.metadata?.displayName || row.item.name || row.key}</small>
                <button type="button" data-no-drag className="vcb-import"
                  disabled={Boolean(busy) || importedLibraryKeys.has(row.key)}
                  onClick={() => handleImportLibrary(row)}>
                  {importedLibraryKeys.has(row.key) ? <>已导入</> : busy === ('library-import:' + row.key) ? '导入中…' : '导入并确认'}
                </button>
              </li>
            ))}
            {!namedUploads.length && !namedLibrary.length && <li className="is-empty">先在上方快速生成区上传素材，或从项目素材库导入。</li>}
          </ul>
          {!!workbench?.assets?.length && <p className="vcb-approved-count"><Check size={13} />已确认素材 {workbench.assets.length} 个已作为画布素材卡展示。</p>}
          {deliveredAssets.length > 0 && <div className="vcb-received" data-testid="canvas-delivery-inbox">
            <span className="vcb-received-title"><SendHorizontal size={13} />从画布发来 · {deliveredAssets.length}</span>
            <ul>
              {deliveredAssets.slice(0, 6).map(asset => <li key={asset.id}>
                <strong>{asset.name || '投递素材'}</strong>
                <small>{(asset.versions || []).find(version => version?.metadata?.source === DELIVERY_METADATA_SOURCE)?.metadata?.sourceSurface === 'ecommerce-workbench' ? '来自电商套图' : '来自画布'}</small>
              </li>)}
            </ul>
          </div>}
        </section>

        <section className="vcb-card" aria-labelledby="vcb-intent-heading">
          <h3 id="vcb-intent-heading"><Sparkles size={15} />意图输入</h3>
          <label><span>一句话目标</span>
            <textarea value={intent.goal} maxLength={1200} rows={3} placeholder="例如：为新品耳机制作一支 15 秒发布短片" onChange={event => setIntent(current => ({ ...current, goal: event.target.value }))} />
          </label>
          <label><span>卖点</span>
            <input value={intent.sellingPoints} maxLength={400} placeholder="降噪 · 续航 · 佩戴舒适" onChange={event => setIntent(current => ({ ...current, sellingPoints: event.target.value }))} />
          </label>
          <div className="vcb-intent-row">
            <label><span>时长（秒）</span>
              <input type="number" min={product?.durations?.min || 4} max={product?.durations?.max || 15} value={intent.duration} onChange={event => setIntent(current => ({ ...current, duration: Number(event.target.value) }))} />
            </label>
            <label><span>比例</span>
              <select value={intent.ratio} onChange={event => setIntent(current => ({ ...current, ratio: event.target.value }))}>
                {RATIOS.map(ratio => <option key={ratio} value={ratio}>{ratio}</option>)}
              </select>
            </label>
          </div>
        </section>

        <section className={'vcb-card vcb-scheme' + (gate.phase === 'approved' ? ' is-approved' : '')} aria-labelledby="vcb-plan-heading">
          <h3 id="vcb-plan-heading"><Layers3 size={15} />方案卡</h3>
          <div className="vcb-cost-badge" data-testid="credit-estimate-range">
            {estimateRange
              ? <strong>积分预估区间 {estimateRange.minPoints}{estimateRange.minPoints === estimateRange.maxPoints ? '' : ' – ' + estimateRange.maxPoints} AI 积分</strong>
              : <strong>积分预估待方案检查后给出</strong>}
            <small>{plan ? ((plan.shots?.length || 0) + ' 个镜头 · 共 ' + Number(plan.totalDurationMs || 0) / 1000 + ' 秒') : '尚未检查方案'}</small>
          </div>
          {plan && <ul className="vcb-plan-shots">
            {(plan.shots || []).map(shotItem => <li key={shotItem.id}>
              <span>{shotItem.purpose || '未命名镜头'}</span>
              <b>{shotItem.cost?.points != null ? shotItem.cost.points + ' 积分' : '—'}</b>
            </li>)}
          </ul>}
          {!!plan?.blockers?.length && <ul className="vcb-plan-blockers">{plan.blockers.slice(0, 6).map((blocker, index) => <li key={index}><CircleAlert size={12} />{blocker.detail}</li>)}</ul>}
          <div className="vcb-scheme-actions">
            <button type="button" onClick={() => void handleCheckScheme()} disabled={Boolean(busy)}>
              {busy === 'scheme:check' ? <LoaderCircle size={14} className="is-spinning" /> : <ShieldCheck size={14} />}检查生成方案
            </button>
            <button type="button" className="vcb-approve" onClick={() => void handleApproveScheme()}
              disabled={Boolean(busy) || !gate.canApprove}
              title={gate.phase === 'approved' ? '已批准的方案快照 ' + gate.approvedPlanHash.slice(0, 10) : '批准后才允许创建扣费生成任务'}>
              {busy === 'scheme:approve' ? <LoaderCircle size={14} className="is-spinning" /> : <Check size={14} />}
              {gate.phase === 'approved' ? '方案已批准' : '批准生成'}
            </button>
          </div>
          <small className="vcb-gate-hint">审批门：未批准前不会产生扣费任务；镜头上的「发起生成」在批准后解锁。</small>
          {gate.phase === 'blocked' && <small className="vcb-gate-hint is-blocked">当前方案暂不可生成，请先处理阻断项。</small>}
          {generationDraft && <small className="vcb-gate-hint">逐镜头草稿已编译（{generationDraft.shots?.length || 0} 镜），供单镜生成复用。</small>}
        </section>
      </aside>

      <div
        className={'vcb-stage' + (flowOn ? ' is-flow' : '')}
        ref={stageRef}
        onPointerDown={handleStagePointerDown}
        role="application"
        aria-label="中央无限画布：拖拽摆位卡片，框选素材浮出生成条，连线表达续写与首尾帧关系"
      >
        {flowOn && <VideoCanvasFlowCanvas domainNodes={nodes} domainEdges={edges} workbenchShots={shots || []} />}
        <svg className="vcb-edge-layer" aria-hidden="true">
          {edgeGeometry.map(({ edge, x1, y1, x2, y2 }) => <g key={edge.id}>
            <line className={'vcb-edge is-' + edge.kind} x1={x1} y1={y1} x2={x2} y2={y2} />
            <text className="vcb-edge-label" x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 4}>{edge.label}</text>
          </g>)}
        </svg>

        {laidOutNodes.map(node => {
          const size = canvasNodeSize(node.type);
          const style = { left: node.x, top: node.y, width: size.width };
          if (node.type === 'asset') {
            return <article key={node.id} data-node={node.id}
              className={'vcb-node is-asset' + (selectedIds.includes(node.id) ? ' is-selected' : '') + (node.kind === 'video' ? ' is-video' : node.kind === 'audio' ? ' is-audio' : '')}
              style={style} onPointerDown={event => handleNodePointerDown(node, event)}>
              <header><MousePointerSquareDashed size={12} /><span>{node.title.slice(0, 18)}</span></header>
              <NodePreview url={node.previewUrl} kind={node.kind} label={node.title} />
              <footer>{node.source === 'upload' ? '上传素材' : node.source === 'library' ? '项目素材库' : '已确认'}</footer>
            </article>;
          }
          if (node.type === 'candidate') {
            const shot = shots.find(item => item.id === node.shotId);
            const selectedCandidate = selectedCandidateForShot(shot);
            return <article key={node.id} data-node={node.id}
              className={'vcb-node is-candidate' + (node.selected ? ' is-selected' : '')}
              style={style} onPointerDown={event => handleNodePointerDown(node, event)}>
              <header><Film size={12} /><span>候选</span>{node.selected && <Check size={12} />}</header>
              <NodePreview url={node.previewUrl} kind="video" label="候选成片预览" />
              <footer>
                <button type="button" data-no-drag disabled={Boolean(busy) || selectedCandidate?.id === node.sourceKey}
                  onClick={() => handleSelectCandidate(shot, { id: node.sourceKey })}>
                  {selectedCandidate?.id === node.sourceKey ? '已选定' : '选用此版'}
                </button>
                {node.selected && <button type="button" data-no-drag disabled={Boolean(busy)}
                  title={planningOnly ? 'PLANNING 模式不装配时间线' : '把该候选按镜头时长加入时间线'}
                  onClick={() => handleAddClipToTimeline(shot, shot?.candidates?.find(item => item.id === node.sourceKey))}>
                  加入时间线
                </button>}
              </footer>
            </article>;
          }
          const shotIndex = shots.findIndex(item => item.id === node.shotId);
          const shot = shots[shotIndex];
          const planShot = (plan?.shots || []).find(item => item?.id === shot?.id);
          const readiness = shotGenerationReadiness(gate, { planningOnly });
          const tracked = trackedByShot[node.shotId] || [];
          const runningJob = tracked.find(entry => !FINAL_JOB_STATES.has(entry.status));
          return <article key={node.id} data-node={node.id} className="vcb-node is-shot" style={style} onPointerDown={event => handleNodePointerDown(node, event)}>
            <header><Clock3 size={12} /><span>镜头 {String(shotIndex + 1).padStart(2, '0')}</span><small>{((shot?.durationMs || 0) / 1000).toFixed(1)}s{planShot?.cost?.points != null ? ' · 约 ' + planShot.cost.points + ' 积分' : ''}</small></header>
            <strong>{shot?.purpose || '未命名镜头'}</strong>
            <p>{shot?.prompt || '未填写镜头提示'}</p>
            <div className="vcb-shot-actions">
              <button type="button" data-no-drag onClick={() => toggleShotEditor(node.shotId)}>编辑</button>
              <button type="button" data-no-drag className="vcb-shot-generate"
                title={readiness.ok ? '为本镜头发起一次真实生成任务' : readiness.reason}
                disabled={Boolean(busy) || busy === ('generate:' + node.shotId)}
                onClick={() => void initiateShotGeneration(shot)}>
                {busy === ('generate:' + node.shotId) ? <LoaderCircle size={13} className="is-spinning" /> : <Play size={13} />}发起生成
              </button>
            </div>
            {runningJob && <small className="vcb-shot-status is-running" role="status">生成中 {runningJob.progress || 2}%</small>}
            {shotErrors[node.shotId] && <small className="vcb-shot-status is-error" role="alert">
              <CircleAlert size={11} />{shotErrors[node.shotId]}
              <button type="button" data-no-drag onClick={() => void initiateShotGeneration(shot)}>重试</button>
            </small>}
            {expandedShots[node.shotId] && shot && <div className="vcb-shot-editor" data-no-drag>
              <input aria-label={'镜头' + (shotIndex + 1) + '目的'} value={shotDrafts[node.shotId]?.purpose ?? shot.purpose} onChange={event => setShotDrafts(current => ({ ...current, [node.shotId]: { ...current[node.shotId], purpose: event.target.value } }))} />
              <textarea aria-label={'镜头' + (shotIndex + 1) + '提示'} rows={2} value={shotDrafts[node.shotId]?.prompt ?? shot.prompt} onChange={event => setShotDrafts(current => ({ ...current, [node.shotId]: { ...current[node.shotId], prompt: event.target.value } }))} />
              <label><span>秒</span><input type="number" min="0.5" step="0.5" value={shotDrafts[node.shotId]?.duration ?? shot.durationMs / 1000} onChange={event => setShotDrafts(current => ({ ...current, [node.shotId]: { ...current[node.shotId], duration: event.target.value } }))} /></label>
              <button type="button" data-no-drag disabled={Boolean(busy)} onClick={() => handleSaveShot(shot)}>保存调整</button>
              {!!completedJobs.length && <div className="vcb-shot-imports">
                <span>导入已完成任务为候选：</span>
                {completedJobs.slice(0, 3).map(job => {
                  const alreadyImported = (shot.candidates || []).some(candidate => candidate.generationJobId === job.id);
                  return <button type="button" key={job.id} data-no-drag disabled={Boolean(busy) || alreadyImported} onClick={() => handleImportJobCandidate(shot, job)}>
                    {alreadyImported ? '已导入' : '导入候选'}
                  </button>;
                })}
              </div>}
            </div>}
          </article>;
        })}

        {marquee && marquee.width > 2 && marquee.height > 2 && <div className="vcb-marquee" style={{ left: marquee.x, top: marquee.y, width: marquee.width, height: marquee.height }} aria-hidden="true" />}

        {selectedNodes.length > 0 && <div className="vcb-generation-bar" data-generation-bar="true" role="toolbar" aria-label="画布生成条">
          <span className="vcb-generation-bar-title">框选 {selectedNodes.length} 个素材</span>
          <div className="vcb-generation-modes">
            {CANVAS_GENERATION_MODES.map(mode => (
              <button key={mode.id} type="button" data-no-drag
                className={intent.mode === mode.id ? 'is-selected' : ''}
                disabled={!modeAvailability[mode.id]}
                title={modeAvailability[mode.id] ? mode.hint : '当前框选素材不满足该模式'}
                onClick={() => setIntent(current => ({ ...current, mode: mode.id }))}>
                {mode.label}
              </button>
            ))}
          </div>
          <div className="vcb-camera-chips" aria-label="运镜 chips">
            {CAMERA_MOVE_CHIPS.map(chip => (
              <button key={chip[0]} type="button" data-no-drag
                className={intent.cameraMove === chip[0] ? 'is-selected' : ''}
                onClick={() => setIntent(current => ({ ...current, cameraMove: current.cameraMove === chip[0] ? '' : chip[0] }))}>
                {chip[1]}
              </button>
            ))}
          </div>
          <button type="button" data-no-drag className="vcb-bar-create" disabled={Boolean(busy)} onClick={handleCreateShot} title="把当前框选意图存为画布新镜头（规划动作，不扣费）">
            <Plus size={13} />存为新镜头
          </button>
          <button type="button" data-no-drag onClick={() => setSelectedIds([])}>清除选择</button>
        </div>}

        <footer className="vcb-stage-hints">
          <span>拖拽卡片摆位</span><span>空白处框选素材浮出生成条</span><span>镜头间连线＝续写，素材到镜头＝首帧/尾帧链（视觉）</span>
          {shots.length === 0 && <span>还没有镜头：框选素材后在生成条里「存为新镜头」，再点镜头上的「发起生成」。</span>}
        </footer>
      </div>

      {inspectorOpen && <aside className="vcb-inspector" aria-label="导演检查器">
        {/* 分区一：决策卡队列——未确认不写入提示词、不产生扣费任务 */}
        <section className="vcb-card vcb-decisions" data-testid="decision-card-queue" aria-labelledby="vcb-decisions-heading">
          <h3 id="vcb-decisions-heading"><Gauge size={15} />决策卡队列</h3>
          <p className="vcb-card-hint">视角 / 风格 / 节奏 / 镜权重。确认后才并入镜头提示词；确认前不产生任何扣费。</p>
          {decisionItems.map(item => <div key={item.id} className={'vcb-decision' + (item.confirmed ? ' is-confirmed' : '')}>
            <header><strong>{item.title}</strong>
              {item.confirmed
                ? <small className="is-ok">已确认{item.valueLabel ? ' · ' + item.valueLabel : ''}</small>
                : <small>{item.value ? '待确认（未确认不扣费）' : '未选择'}</small>}
            </header>
            <div className="vcb-decision-options">
              {item.options.map(([value, label]) => (
                <button key={value} type="button" data-no-drag
                  className={item.value === value ? 'is-selected' : ''}
                  onClick={() => toggleDecisionOption(item.id, value)}>{label}</button>
              ))}
            </div>
            {!!item.value && !item.confirmed && <button type="button" data-no-drag className="vcb-decision-confirm" onClick={() => confirmDecision(item.id)}>
              <Check size={12} />确认{item.title}
            </button>}
          </div>)}
          {!!decisionPromptParts.length && <p className="vcb-gate-hint is-ok">已确认决策将并入每次生成的提示词：{decisionPromptParts.join('；')}</p>}
        </section>

        {/* 分区二：任务事件流按镜分组——就近重试 + 显示扣费（预估） */}
        <section className="vcb-card vcb-events" data-testid="task-event-stream" aria-labelledby="vcb-events-heading">
          <h3 id="vcb-events-heading"><Clock3 size={15} />任务事件流</h3>
          {!eventGroups.length && <p className="vcb-card-hint">还没有任务。批准方案后点镜头上的「发起生成」，事件会按镜分组显示在这里。</p>}
          {eventGroups.map(group => <div key={group.shotId} className="vcb-event-group">
            <header><strong>{group.label}</strong><small>{group.purpose || '—'}{group.points != null ? ` · 约 ${group.points} 积分（预估）` : ''}</small></header>
            <ul>
              {group.events.map(event => <li key={event.jobId} className={'is-' + event.tone}>
                <span>{event.text}</span>
                {event.retryable && <button type="button" data-no-drag onClick={() => {
                  const shot = shots.find(item => item.id === group.shotId);
                  if (shot) void initiateShotGeneration(shot, { extraPromptParts: decisionPromptParts });
                }}>就近重试</button>}
              </li>)}
            </ul>
          </div>)}
        </section>

        {/* 分区三：改稿对话——运镜词 chips 注入重生成 */}
        <section className="vcb-card vcb-tweaks" data-testid="chat-tweaks" aria-labelledby="vcb-tweaks-heading">
          <h3 id="vcb-tweaks-heading"><MessageSquareText size={15} />改稿对话</h3>
          <label><span>改哪一镜</span>
            <select value={tweak.shotId} onChange={event => setTweak(current => ({ ...current, shotId: event.target.value }))} disabled={Boolean(busy) || !shots.length}>
              <option value="">自动选第一镜</option>
              {shots.map((shot, index) => <option key={shot.id} value={shot.id}>镜头 {String(index + 1).padStart(2, '0')} · {shot.purpose || '未命名'}</option>)}
            </select>
          </label>
          <div className="vcb-camera-chips" aria-label="改稿运镜 chips">
            {CHAT_TWEAK_CHIPS.map(chip => (
              <button key={chip[0]} type="button" data-no-drag
                className={tweak.chips.includes(chip[0]) ? 'is-selected' : ''}
                onClick={() => toggleTweakChip(chip[0])}>{chip[1]}</button>
            ))}
          </div>
          <label><span>自然语言微调</span>
            <textarea rows={2} maxLength={600} value={tweak.instruction} placeholder="例如：产品再亮一点，结尾停在logo"
              onChange={event => setTweak(current => ({ ...current, instruction: event.target.value }))} />
          </label>
          <button type="button" data-no-drag className="vcb-tweak-send" disabled={Boolean(busy) || !shots.length}
            title={planningOnly ? 'PLANNING 模式只改写提示词，不发起扣费重生成' : '保存新提示词并就地重生成这一镜'}
            onClick={() => {
              const shot = shots.find(item => item.id === tweak.shotId) || shots[0];
              if (shot) handleTweakSubmit(shot);
            }}>
            <SendHorizontal size={13} />{planningOnly ? '应用改稿（仅改写）' : '注入并重生成'}
          </button>
          <small className="vcb-gate-hint">重生成走既有审批门与账务：未批准方案时只会保存提示词，不会创建扣费任务。</small>
        </section>
      </aside>}
    </div>}

    {projectId && timelineOpen && <section className="vcb-timeline" data-testid="timeline-drawer" aria-label="时间线抽屉">
      <header>
        <strong><ListVideo size={14} />时间线</strong>
        <small>{timelineClips.length} 个片段 · 共 {(timelineTotalMs / 1000).toFixed(1)} 秒（按裁剪后计）</small>
        <span className="vcb-timeline-note">导出先产出清单；ffmpeg 真渲染在 P3 接入。</span>
      </header>
      {!timelineClips.length && <p className="vcb-card-hint">时间线还没有片段：点候选卡上的「加入时间线」，把选定候选装配成片。</p>}
      <ul className="vcb-clip-list">
        {timelineClips.map(clip => {
          const shot = shots.find(item => item.id === clip.shotId);
          const bounds = clipTrimBounds(clip, shot);
          const draft = clipDrafts[clip.id] || { start: bounds.startMs / 1000, end: bounds.endMs / 1000 };
          const rebindOptions = clipRebindOptions(workbench, clip);
          return <li key={clip.id} className="vcb-clip">
            <div className="vcb-clip-head">
              <strong>{shot?.purpose || '镜头片段'}</strong>
              <small>{(clipDurationMs(clip) / 1000).toFixed(1)}s{clip.muted ? ' · 静音' : ''}</small>
            </div>
            {/* trim 手柄接字段：入点/出点手柄与数字字段双向绑定 trimStartMs / trimEndMs */}
            <div className="vcb-trim" role="group" aria-label={'裁剪' + (shot?.purpose || '片段')}>
              <label><span>入点</span>
                <input type="number" min={bounds.minMs / 1000} max={bounds.maxMs / 1000} step={0.1}
                  value={draft.start}
                  onChange={event => updateClipDraft(clip, 'start', Number(event.target.value))} />
              </label>
              <input className="vcb-trim-handle is-start" type="range" aria-label="入点手柄"
                min={bounds.minMs / 1000} max={bounds.maxMs / 1000} step={0.1}
                value={Math.min(Number(draft.start) || bounds.startMs / 1000, Number(draft.end) || bounds.endMs / 1000)}
                onChange={event => updateClipDraft(clip, 'start', Number(event.target.value))} />
              <input className="vcb-trim-handle is-end" type="range" aria-label="出点手柄"
                min={bounds.minMs / 1000} max={bounds.maxMs / 1000} step={0.1}
                value={Math.max(Number(draft.end) || bounds.endMs / 1000, Number(draft.start) || bounds.startMs / 1000)}
                onChange={event => updateClipDraft(clip, 'end', Number(event.target.value))} />
              <label><span>出点</span>
                <input type="number" min={bounds.minMs / 1000} max={bounds.maxMs / 1000} step={0.1}
                  value={draft.end}
                  onChange={event => updateClipDraft(clip, 'end', Number(event.target.value))} />
              </label>
              <button type="button" data-no-drag disabled={Boolean(busy)} onClick={() => handleSaveClipTrim(clip)}>应用裁剪</button>
            </div>
            {!!rebindOptions.length && <div className="vcb-rebind" aria-label="换绑候选">
              <span>换绑：</span>
              {rebindOptions.slice(0, 3).map(option => <button key={option.candidateId} type="button" data-no-drag
                disabled={Boolean(busy)}
                title={option.isCurrentSelected ? '当前选定候选' : option.label}
                onClick={() => handleReplaceTimelineClipCandidate(clip, option.candidateId)}>{option.label}</button>)}
            </div>}
          </li>;
        })}
      </ul>
      {clipError && <p className="vcb-clip-error" role="alert"><CircleAlert size={13} />{clipError}</p>}
      <footer className="vcb-export" data-testid="export-manifest-panel">
        <button type="button" data-no-drag className="vcb-export-btn" disabled={!exportReady.ok || exportBusy || Boolean(busy)}
          title={exportReady.ok ? '生成可交接的导出清单（含字幕与音轨）' : exportReady.reason}
          onClick={() => void handleCreateExportManifest()}>
          {exportBusy ? <LoaderCircle size={14} className="is-spinning" /> : <Layers3 size={14} />}生成导出清单
        </button>
        {manifestSummary && <div className="vcb-manifest-summary" role="status">
          <strong>清单已生成{manifestSummary.replayed ? '（复用既有清单）' : ''}</strong>
          <ul>
            <li>{manifestSummary.clipCount} 个片段 · {(manifestSummary.totalDurationMs / 1000).toFixed(1)} 秒</li>
            <li>{manifestSummary.options.resolution?.toUpperCase()} · {String(manifestSummary.options.fps || '')}fps · {String(manifestSummary.options.format || '').toUpperCase()}</li>
            <li>音轨 {manifestSummary.audioTrackCount} 条 · 字幕 {manifestSummary.subtitleCueCount} 条</li>
            <li>哈希 {manifestSummary.manifestHash.slice(0, 12)}… · 渲染器 {manifestSummary.renderer}{manifestSummary.rendered === false ? '（P3 真渲染接入前不产出成片）' : ''}</li>
          </ul>
        </div>}
      </footer>
    </section>}
  </section>;
}
