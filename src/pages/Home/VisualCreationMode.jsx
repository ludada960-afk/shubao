import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePanelScrollLock } from '../../components/ui/usePanelScrollLock.js';
import { Check, Info, LayoutTemplate, Layers3, Monitor, Palette, Sparkles, Type, WandSparkles } from 'lucide-react';
import {
  MdAddPhotoAlternate,
  MdAlternateEmail,
  MdAspectRatio,
  MdAutoAwesome,
  MdCampaign,
  MdCheckCircle,
  MdClose,
  MdDownload,
  MdErrorOutline,
  MdHighQuality,
  MdImage,
  MdOpenInNew,
  MdPalette,
  MdRefresh,
  MdSend,
  MdShare,
  MdTune,
  MdZoomOutMap,
  MdChevronLeft,
  MdChevronRight,
} from 'react-icons/md';

import { useApp } from '../../store/AppContext';
import { uploadEcommerceAssets, regenerateCanvasImage, saveWork } from '../../services/api';
import { IMAGE_MODELS } from '../../services/imageModelCatalog.js';
import { handleGenerationAccessError } from '../../utils/generationAccess.js';
import MentionPromptField from '../../components/creation/MentionPromptField.jsx';
import ResponsiveImage from '../../components/ResponsiveImage.jsx';
import GenSettingsPanel from './ec/GenSettingsPanel.jsx';
import {
  VISUAL_CREATION_SKILLS,
  VISUAL_RATIO_OPTIONS,
  buildVisualCanvasResult,
  buildVisualWorkRecord,
  createVisualRun,
  updateVisualRunSlot,
  visualRetryIndexes,
  visualRunIsBusy,
  visualSkillById,
  resolveVisualSkillRatio,
  visualGenerationEstimate,
} from './visualCreationModel.js';
import './VisualCreationMode.css';
import { IMAGE_PROMPT_LIMIT } from '../../constants/promptLimits.js';

const MAX_REFERENCES = 6;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const VISUAL_SHOWCASE_AUTO_DWELL_MS = 9000;
const VISUAL_SHOWCASE_MANUAL_DWELL_MS = 15000;
const VISUAL_SKILL_ICONS = {
  free: MdAutoAwesome,
  poster: MdCampaign,
  'social-cover': MdShare,
  'brand-kv': MdPalette,
};

function referenceId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function generationErrorMessage(error) {
  if (error?.name === 'AbortError') return '生成已取消';
  return error?.message || '图片生成失败，请稍后重试';
}

function showcaseLoadingPolicy(index) {
  return {
    loading: index < 3 ? 'eager' : 'lazy',
    fetchPriority: index === 0 ? 'high' : 'auto',
  };
}

const VISUAL_RATIO_META = {
  '1:1': { shape: [24, 24], usage: '方形主视觉' },
  '3:4': { shape: [21, 28], usage: '竖版内容' },
  '4:3': { shape: [28, 21], usage: '横版画面' },
  '9:16': { shape: [18, 32], usage: '全屏竖版' },
  '16:9': { shape: [32, 18], usage: '宽屏横幅' },
  '21:9': { shape: [34, 15], usage: '超宽主视觉' },
};

const VISUAL_OPTION_ICONS = [Sparkles, Palette, LayoutTemplate, Layers3];
const VISUAL_PANEL_ICONS = [LayoutTemplate, Layers3, Type, Palette];
const VISUAL_OPTION_HINTS = {
  智能匹配: '由主体、场景与参考素材自动平衡',
  写实摄影: '控制真实光线、材质与空间关系',
  风格插画: '强化笔触、色彩与想象力表达',
  主标题优先: '先建立阅读焦点，再组织辅助信息',
  产品优先: '让主体占据最清晰的视觉位置',
  活动信息优先: '为活动内容预留明确的传播层级',
};

function VisualRatioShape({ ratio, active }) {
  const [width, height] = VISUAL_RATIO_META[ratio]?.shape || [24, 24];
  return (
    <svg className="visual-ratio-shape" width={width + 4} height={height + 4} viewBox={`0 0 ${width + 4} ${height + 4}`} aria-hidden="true">
      <rect x="2" y="2" width={width} height={height} rx="3" fill={active ? '#7c3aed' : 'transparent'} stroke={active ? '#7c3aed' : 'rgba(0,0,0,.32)'} strokeWidth="1.5" />
    </svg>
  );
}

function VisualRecipePanel({ selectedSkill, skillControl, updateSkillControl, panelValues, updatePanelValue, busy }) {
  return (
    <div className="visual-subpanel">
      <div className="visual-panel-section">
        <div className="visual-panel-section-heading"><Sparkles /><div><strong>{selectedSkill.control.label}</strong><small>决定这组画面的主导表达方式</small></div></div>
        <div className="visual-choice-list">
          {selectedSkill.control.options.map((option, index) => {
            const Icon = VISUAL_OPTION_ICONS[index % VISUAL_OPTION_ICONS.length];
            const selected = skillControl === option;
            const optionMeta = selectedSkill.control.optionMeta?.find(item => item.value === option);
            return (
              <button type="button" key={option} className={`visual-choice-card${optionMeta ? ' visual-style-option' : ''}${selected ? ' is-selected' : ''}`} onClick={() => !busy && updateSkillControl(option)} disabled={busy} aria-pressed={selected}>
                {optionMeta ? <img className="visual-style-option-image" src={optionMeta.image} alt="" width="48" height="48" loading="lazy" decoding="async" fetchpriority="auto" /> : <span className="visual-choice-icon"><Icon /></span>}
                <span className="visual-choice-copy"><strong>{option}</strong><small>{optionMeta?.description || VISUAL_OPTION_HINTS[option] || `为${selectedSkill.title}选择更明确的${selectedSkill.control.label}倾向`}</small></span>
                {selected && <Check className="visual-choice-check" />}
              </button>
            );
          })}
        </div>
      </div>
      {selectedSkill.panels?.map((panel, panelIndex) => {
        const PanelIcon = VISUAL_PANEL_ICONS[panelIndex % VISUAL_PANEL_ICONS.length];
        const currentValue = panelValues[panel.id] || panel.options[0];
        return (
          <div className="visual-panel-section" key={panel.id}>
            <div className="visual-panel-section-heading"><PanelIcon /><div><strong>{panel.label}</strong><small>只调整本次生成需要强调的局部规则</small></div></div>
            <div className="visual-choice-grid">
              {panel.options.map((option, index) => {
                const selected = currentValue === option;
                const Icon = VISUAL_OPTION_ICONS[(panelIndex + index + 1) % VISUAL_OPTION_ICONS.length];
                return <button type="button" key={option} className={`visual-choice-card visual-choice-card-compact${selected ? ' is-selected' : ''}`} onClick={() => !busy && updatePanelValue(panel.id, option)} disabled={busy} aria-pressed={selected}><span className="visual-choice-icon"><Icon /></span><span className="visual-choice-copy"><strong>{option}</strong></span>{selected && <Check className="visual-choice-check" />}</button>;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function VisualSpecsPanel({ selectedSkill, ratio, count, onRatioChange, onCountChange, busy }) {
  const options = VISUAL_RATIO_OPTIONS.filter(option => selectedSkill.ratios?.includes(option.id));
  return (
    <div className="visual-subpanel">
      <div className="visual-panel-section">
        <div className="visual-panel-section-heading"><Monitor /><div><strong>输出画幅</strong><small>选择与当前创作方向匹配的画面比例</small></div></div>
        <div className="visual-ratio-grid">
          {options.map(option => {
            const selected = ratio === option.id;
            return <button type="button" key={option.id} className={`visual-ratio-card${selected ? ' is-selected' : ''}`} onClick={() => !busy && onRatioChange(option.id)} disabled={busy} aria-pressed={selected}><span className="visual-ratio-shape-wrap"><VisualRatioShape ratio={option.id} active={selected} /></span><span><strong>{option.label.replace(/\s+/g, ' ')}</strong><small>{VISUAL_RATIO_META[option.id]?.usage}</small></span>{selected && <Check className="visual-choice-check" />}</button>;
          })}
        </div>
      </div>
      <div className="visual-panel-section">
        <div className="visual-panel-section-heading"><Layers3 /><div><strong>生成数量</strong><small>一次生成多张，方便比较不同构图方向</small></div></div>
        <div className="visual-count-grid">
          {[1, 2, 3, 4].map(value => <button type="button" key={value} className={`visual-count-card${count === value ? ' is-selected' : ''}`} onClick={() => !busy && onCountChange(value)} disabled={busy} aria-pressed={count === value}><strong>{value}</strong><span>{value === 1 ? '单张探索' : `${value} 张对比`}</span>{count === value && <Check />}</button>)}
        </div>
      </div>
      <div className="visual-panel-note"><Info /><span>模型、清晰度与生成数量会同步影响预计 AI 积分；生成前仍可随时调整。</span></div>
    </div>
  );
}

function getVisualPanelPosition(panelId, button) {
  const rect = button.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const baseWidth = { recipe: 440, specs: 500, settings: 460 }[panelId] || 460;
  /* 9-11 二轮用户批注: 面板打开要「一眼看全」— 提高目标高度, 并用满可用空间 (最多 92vh) */
  const desiredHeight = { recipe: 720, specs: 620, settings: 740 }[panelId] || 620;
  const width = Math.min(Math.max(baseWidth, 400), Math.max(320, viewportWidth - 32));
  const left = Math.max(16, Math.min(rect.left + rect.width / 2 - width / 2, viewportWidth - width - 16));
  const gap = 10;
  const availableAbove = Math.max(0, rect.top - gap - 16);
  const availableBelow = Math.max(0, viewportHeight - rect.bottom - gap - 16);
  /* 9-11 二轮用户批注: 「一眼看全」优先 — 选空间更大的一侧;
     两侧都不够时允许面板越过触发条 (top:16 起, 最多 92vh), 不再强制在 396px 里滚动。 */
  const openAbove = viewportWidth <= 640 || availableAbove >= availableBelow;
  const availableSpace = openAbove ? availableAbove : availableBelow;
  /* 9-12 用户批注：「面板要吸在按钮上面」——之前空间不够会退化成居中全屏覆盖层，
     结果盖住提示词框左下角的 @ 按钮，看起来像“输入框没有 @”。
     现在改为：永远贴着触发按钮开（上方或下方），空间不足由面板内部滚动承担。 */
  return {
    left,
    top: openAbove ? undefined : Math.max(12, rect.bottom + gap),
    bottom: openAbove ? Math.max(12, viewportHeight - rect.top + gap) : undefined,
    width,
    maxHeight: Math.max(300, Math.min(Math.round(viewportHeight * 0.92), desiredHeight, availableSpace || desiredHeight)),
    anchorX: rect.left + rect.width / 2,
  };
}

function selectedReferencePayload(assets) {
  return assets.map((asset, index) => ({
    sourceNodeId: `visual-reference-${index + 1}`,
    assetId: asset.assetId,
    url: asset.url,
    displayName: `参考图 ${index + 1}`,
    mention: `@参考图 ${index + 1}`,
    role: 'reference',
    order: index,
  }));
}

export default function VisualCreationMode({ recoveryCheckpoint = null, initialSkillId = null }) {
  const { state, dispatch, refreshBillingBalance } = useApp();
  const [skillId, setSkillId] = useState('free');
  const [prompt, setPrompt] = useState('');
  const [references, setReferences] = useState([]);
  const [imageModel, setImageModel] = useState('image2');
  const [ratio, setRatio] = useState('1:1');
  const [resolution, setResolution] = useState('2K');
  const [count, setCount] = useState(1);
  const [run, setRun] = useState(null);
  const [runConfig, setRunConfig] = useState(null);
  const [work, setWork] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showcaseSlide, setShowcaseSlide] = useState(0);
  const [showcaseManualRevision, setShowcaseManualRevision] = useState(0);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);
  const [activeConfigPanel, setActiveConfigPanel] = useState(null);
  /* 9-11 二轮批注: 面板打开 → 页面锁滚, 滚轮只滚面板 */
  usePanelScrollLock(Boolean(activeConfigPanel));
  const [configPanelPos, setConfigPanelPos] = useState({
    left: 16,
    bottom: 100,
    width: 520,
    maxHeight: 420,
    anchorX: 260,
  });
  const [skillControlValues, setSkillControlValues] = useState(() => Object.fromEntries(
    VISUAL_CREATION_SKILLS.map(skill => [skill.id, skill.control?.options?.[0] || '']),
  ));
  const [panelValues, setPanelValues] = useState(() => Object.fromEntries(
    VISUAL_CREATION_SKILLS.flatMap(skill => (skill.panels || []).map(panel => [panel.id, panel.options?.[0] || ''])),
  ));
  const runRef = useRef(null);
  /* 9-12: 自由创作生成完成后自动进画布 —— 记录已自动进入过的 run，避免重复跳转 */
  const autoCanvasRunRef = useRef('');
  const referencesRef = useRef([]);
  const fileInputRef = useRef(null);
  const promptRef = useRef(null);
  const abortRef = useRef(null);
  const configButtonRefs = useRef({});
  const restoredCheckpointRef = useRef('');

  const selectedSkill = visualSkillById(skillId);
  const busy = uploading || visualRunIsBusy(run);
  const retryIndexes = visualRetryIndexes(run);
  const successfulSlots = run?.slots?.filter(slot => slot.status === 'completed') || [];
  const canGenerate = Boolean(prompt.trim() || references.length);
  const generationEstimate = visualGenerationEstimate({ imageModel, resolution, count });
  const estimatedPoints = generationEstimate.points;
  const showcases = selectedSkill.showcases || [];
  const selectedShowcase = showcases[showcaseSlide] || showcases[0];
  const previewItems = selectedShowcase?.assets || [];

  useEffect(() => {
    if (!initialSkillId || initialSkillId === skillId) return;
    setSkillId(visualSkillById(initialSkillId).id);
  }, [initialSkillId]);

  useEffect(() => {
    if (!previewItem) return undefined;
    const move = direction => setPreviewItem(current => {
      if (!current || previewItems.length < 2) return current;
      const index = previewItems.findIndex(item => item.src === current.src);
      return previewItems[(index + direction + previewItems.length) % previewItems.length];
    });
    const onKeyDown = event => {
      if (event.key === 'Escape') setPreviewItem(null);
      if (event.key === 'ArrowLeft') move(-1);
      if (event.key === 'ArrowRight') move(1);
    };
    globalThis.addEventListener?.('keydown', onKeyDown);
    return () => globalThis.removeEventListener?.('keydown', onKeyDown);
  }, [previewItem, previewItems]);
  const skillControl = skillControlValues[skillId] || selectedSkill.control?.options?.[0] || '';
  const mentionOptions = useMemo(() => references.map((reference, index) => ({
    id: reference.id,
    sourceNodeId: `visual-reference-${index + 1}`,
    label: `@参考图 ${index + 1}`,
  })), [references]);

  useEffect(() => {
    setShowcaseSlide(0);
    setShowcaseManualRevision(0);
    setPreviewItem(null);
    setRatio(current => resolveVisualSkillRatio(skillId, current));
  }, [skillId]);

  useEffect(() => {
    const snapshot = recoveryCheckpoint?.version?.inputSnapshot;
    const checkpointId = recoveryCheckpoint?.version?.id || '';
    if (!snapshot || !checkpointId || restoredCheckpointRef.current === checkpointId) return;
    restoredCheckpointRef.current = checkpointId;
    const nextSkill = visualSkillById(snapshot.skillId);
    setSkillId(nextSkill.id);
    setPrompt(String(snapshot.prompt || snapshot.text || '').slice(0, 3000));
    setImageModel(snapshot.imageModel || 'image2');
    setRatio(resolveVisualSkillRatio(nextSkill.id, snapshot.ratio || '1:1'));
    setResolution(snapshot.resolution || '2K');
    if (snapshot.skillControl) {
      setSkillControlValues(current => ({ ...current, [nextSkill.id]: snapshot.skillControl }));
    }
    if (snapshot.panelValues && typeof snapshot.panelValues === 'object') {
      setPanelValues(current => ({ ...current, ...snapshot.panelValues }));
    }
    const restoredReferences = (Array.isArray(snapshot.referenceAssets) ? snapshot.referenceAssets : []).map((asset, index) => ({
      id: `restored-${checkpointId}-${index}`,
      name: asset.displayName || `参考图 ${index + 1}`,
      previewUrl: asset.url,
      asset,
      file: null,
    })).filter(reference => reference.asset?.url);
    setReferences(restoredReferences.slice(0, MAX_REFERENCES));
    setNotice('');
  }, [recoveryCheckpoint]);

  useEffect(() => {
    const media = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (media?.matches) return undefined;
    const delay = showcaseManualRevision ? VISUAL_SHOWCASE_MANUAL_DWELL_MS : VISUAL_SHOWCASE_AUTO_DWELL_MS;
    const timer = globalThis.setTimeout(() => {
      setShowcaseSlide(current => (current + 1) % Math.max(1, showcases.length));
      setShowcaseManualRevision(0);
    }, delay);
    return () => globalThis.clearTimeout(timer);
  }, [skillId, showcaseSlide, showcaseManualRevision, showcases.length]);

  const chooseShowcaseSlide = index => {
    setShowcaseSlide(index);
    setShowcaseManualRevision(revision => revision + 1);
  };

  useEffect(() => {
    runRef.current = run;
  }, [run]);

  useEffect(() => {
    referencesRef.current = references;
  }, [references]);

  useEffect(() => () => {
    abortRef.current?.abort();
    for (const reference of referencesRef.current) {
      if (reference.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(reference.previewUrl);
    }
  }, []);

  const model = useMemo(
    () => IMAGE_MODELS.find(option => option.id === imageModel) || IMAGE_MODELS[0],
    [imageModel],
  );

  const appendFiles = files => {
    setError('');
    const available = MAX_REFERENCES - references.length;
    if (available <= 0) {
      setError(`最多上传 ${MAX_REFERENCES} 张参考图`);
      return;
    }
    const accepted = [];
    for (const file of Array.from(files || [])) {
      if (accepted.length >= available) break;
      if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
        setError('仅支持 JPG、PNG 和 WebP 图片');
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setError('单张图片不能超过 15MB');
        continue;
      }
      accepted.push({
        id: referenceId(),
        file,
        name: file.name || `参考图 ${references.length + accepted.length + 1}`,
        previewUrl: URL.createObjectURL(file),
        asset: null,
      });
    }
    if (accepted.length) setReferences(current => [...current, ...accepted].slice(0, MAX_REFERENCES));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeReference = id => {
    setReferences(current => current.filter(reference => {
      if (reference.id !== id) return true;
      if (reference.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(reference.previewUrl);
      return false;
    }));
  };

  const ensureDurableReferences = async signal => {
    const current = referencesRef.current;
    const missing = current.filter(reference => !reference.asset);
    if (!missing.length) return current.map(reference => reference.asset).filter(Boolean);
    setUploading(true);
    try {
      const uploaded = await uploadEcommerceAssets(missing.map(reference => reference.file), 'reference', { signal });
      const uploadedById = new Map(missing.map((reference, index) => [reference.id, uploaded[index]]));
      const next = current.map(reference => ({
        ...reference,
        asset: reference.asset || uploadedById.get(reference.id) || null,
      }));
      referencesRef.current = next;
      setReferences(next);
      return next.map(reference => reference.asset).filter(Boolean);
    } finally {
      setUploading(false);
    }
  };

  const persistSuccessfulRun = async (completedRun, config) => {
    const hasSuccess = completedRun.slots.some(slot => slot.status === 'completed');
    if (!hasSuccess) return null;
    const nextWork = buildVisualWorkRecord({
      run: completedRun,
      prompt: config.originalPrompt || config.prompt,
      skillId: config.skillId,
      model: config.imageModel,
      ratio: config.ratio,
      resolution: config.resolution,
      referenceAssets: config.referenceAssets,
      skillControl: config.skillControl,
      panelValues: config.panelValues,
    });
    setWork(nextWork);
    dispatch({ type: 'SET_WORKS', works: [nextWork, ...(Array.isArray(state.works) ? state.works.filter(item => String(item._saveKey || item.id) !== String(nextWork._saveKey || nextWork.id)) : [])].slice(0, 50) });
    const saved = await saveWork(nextWork, state.phone);
    setNotice(saved ? '作品已保存，可下载或进入画布继续编辑' : '图片已完成，作品云端保存暂时失败');
    await refreshBillingBalance?.().catch(() => undefined);
    return nextWork;
  };

  const executeSlots = async (baseRun, indexes, config) => {
    let latest = indexes.reduce(
      (current, index) => updateVisualRunSlot(current, index, { status: 'generating', error: '' }),
      baseRun,
    );
    runRef.current = latest;
    setRun(latest);
    setError('');
    setNotice('');

    const referenceMetadata = selectedReferencePayload(config.referenceAssets);
    const primary = config.referenceAssets[0]?.url || '';
    const supplementary = config.referenceAssets.slice(1).map(asset => asset.url);
    const failures = [];

    await Promise.all(indexes.map(async index => {
      const slot = latest.slots[index];
      try {
        const result = await regenerateCanvasImage({
          prompt: config.prompt,
          imageUrl: primary,
          referenceImages: supplementary,
          references: referenceMetadata,
          ratio: config.ratio,
          resolution: config.resolution,
          imageModel: config.imageModel,
          requestKey: slot.requestKey,
          creationIntent: 'visual',
          skillId: config.skillId,
          includeMetadata: true,
          signal: abortRef.current?.signal,
        });
        latest = updateVisualRunSlot(latest, index, {
          status: 'completed',
          url: result.url,
          taskId: result.taskId,
          replay: result.replay,
          error: '',
        });
      } catch (slotError) {
        failures.push(slotError);
        latest = updateVisualRunSlot(latest, index, {
          status: 'failed',
          error: generationErrorMessage(slotError),
        });
      }
      runRef.current = latest;
      setRun(latest);
    }));

    await persistSuccessfulRun(latest, config);
    if (failures.length) {
      const accessResult = handleGenerationAccessError(failures[0], dispatch, {
        source: 'visual-creation',
        ownerEmail: state.phone,
        currency: 'ec_points',
        draftId: baseRun.id,
        action: {
          type: 'visual-creation',
          currency: 'ec_points',
          skillId: config.skillId,
          referenceAssetIds: config.referenceAssets.map(asset => asset.assetId).filter(Boolean),
        },
      });
      if (!accessResult) {
        setError(`${failures.length} 张图片未完成，可只重试失败项`);
      }
    }
    /* 9-12 用户要求：自由创作生成完成后**自动进画布**（与视频生成完成即进画布一致）。
       只在本次确有成功结果时进入，且每次生成只自动进一次；失败/全失败留在原地。 */
    const produced = latest?.slots?.filter(slot => slot.status === 'completed') || [];
    if (produced.length && autoCanvasRunRef.current !== latest?.id) {
      autoCanvasRunRef.current = latest?.id || '';
      try {
        openCanvasWithRun(latest);
      } catch { /* 自动进画布失败不打断用户，可手动点「进入画布」 */ }
    }
  };

  /* 抽成独立函数：手动按钮与「生成完成自动进入」共用同一条路径 */
  const openCanvasWithRun = targetRun => {
    const work = targetRun || run;
    if (!work) return false;
    dispatch({ type: 'SET_RESULT', result: buildVisualCanvasResult(work) });
    dispatch({ type: 'NAVIGATE', page: 'ec-canvas' });
    return true;
  };

  const startGeneration = async () => {
    if (!canGenerate) {
      setError('请先输入画面描述或上传参考素材');
      if (!prompt.trim()) promptRef.current?.focus();
      return;
    }
    if (!state.logged) {
      dispatch({ type: 'SHOW_LOGIN', show: true });
      return;
    }
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setError('');
    setNotice('');
    try {
      const referenceAssets = await ensureDurableReferences(abortRef.current.signal);
      const nextRun = createVisualRun({ count });
      const originalPrompt = prompt.trim();
      const selectedPanelValues = Object.fromEntries((selectedSkill.panels || []).map(panel => [panel.id, panelValues[panel.id] || panel.options?.[0] || '']));
      const panelInstruction = Object.entries(selectedPanelValues).map(([id, value]) => `${id}：${value}`).join('；');
      const config = {
        prompt: `${originalPrompt}\n创作模式：${selectedSkill.title}；${selectedSkill.control.label}：${skillControl}${panelInstruction ? `；扩展设置：${panelInstruction}` : ''}`,
        originalPrompt,
        skillId,
        skillControl,
        panelValues: selectedPanelValues,
        imageModel,
        ratio,
        resolution,
        referenceAssets,
      };
      setRunConfig(config);
      setWork(null);
      runRef.current = nextRun;
      setRun(nextRun);
      await executeSlots(nextRun, nextRun.slots.map((_, index) => index), config);
    } catch (generationError) {
      const accessResult = handleGenerationAccessError(generationError, dispatch, {
        source: 'visual-creation',
        ownerEmail: state.phone,
        currency: 'ec_points',
      });
      if (!accessResult) setError(generationErrorMessage(generationError));
    }
  };

  const retryFailed = async () => {
    if (!run || !runConfig || !retryIndexes.length || busy) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    await executeSlots(run, retryIndexes, runConfig);
  };

  const openCanvas = () => { openCanvasWithRun(run); };

  const insertMention = label => {
    promptRef.current?.insertMention?.(label);
    setShowMentionMenu(false);
  };

  const updateSkillControl = value => {
    setSkillControlValues(current => ({ ...current, [skillId]: value }));
  };

  const updatePanelValue = (id, value) => {
    setPanelValues(current => ({ ...current, [id]: value }));
  };

  const repositionConfigPanel = useCallback(() => {
    if (!activeConfigPanel) return;
    const button = configButtonRefs.current[activeConfigPanel];
    if (!button) return;
    setConfigPanelPos(getVisualPanelPosition(activeConfigPanel, button));
  }, [activeConfigPanel]);

  useEffect(() => {
    if (!activeConfigPanel) return undefined;
    const closeOnEscape = event => {
      if (event.key === 'Escape') setActiveConfigPanel(null);
    };
    const closeOnOutsideClick = event => {
      const panel = document.getElementById('visual-floating-panel');
      const button = configButtonRefs.current[activeConfigPanel];
      if (panel?.contains(event.target) || button?.contains(event.target)) return;
      setActiveConfigPanel(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    const timer = window.setTimeout(() => window.addEventListener('mousedown', closeOnOutsideClick), 0);
    window.addEventListener('resize', repositionConfigPanel);
    window.addEventListener('scroll', repositionConfigPanel, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('mousedown', closeOnOutsideClick);
      window.removeEventListener('resize', repositionConfigPanel);
      window.removeEventListener('scroll', repositionConfigPanel, true);
    };
  }, [activeConfigPanel, repositionConfigPanel]);

  const toggleConfigPanel = panelId => {
    if (busy) return;
    if (activeConfigPanel === panelId) {
      setActiveConfigPanel(null);
      return;
    }
    const button = configButtonRefs.current[panelId];
    if (button) setConfigPanelPos(getVisualPanelPosition(panelId, button));
    setActiveConfigPanel(panelId);
  };

  const showcaseCard = (item, className, index = 0) => item ? (
    <button
      type="button"
      key={`${item.src}-${item.label}-${className}`}
      className={`visual-skill-stage-card ${className}`}
      style={{ '--case-ratio': item.ratio?.replace(':', ' / ') || '1 / 1' }}
      onClick={() => setPreviewItem(item)}
      aria-label={`放大查看${item.label}`}
    >
      <ResponsiveImage src={item.src} alt={item.alt || item.label} variant="thumb" ratio={item.ratio || '1:1'}
        loading={showcaseLoadingPolicy(index).loading} fetchPriority={showcaseLoadingPolicy(index).fetchPriority}
        sizes="(min-width:1080px) 22vw, 32vw" style={{ width: '100%', background: '#f7f5f7' }}
        imgStyle={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      <span>{item.label}</span>
      <MdZoomOutMap aria-hidden="true" />
    </button>
  ) : null;

  const renderConfigPanel = () => {
    if (!activeConfigPanel) return null;
    const panelMeta = {
      /* 9-11 二轮用户批注: 面板头图标必须与下方触发按钮图标一致 (三块面板统一) */
      recipe: { title: `${selectedSkill.title}方向`, description: '调整本次最重要的画面侧重', icon: <MdAutoAwesome /> },
      specs: { title: '画面规格', description: '设置发布比例与本次生成数量', icon: <MdAspectRatio /> },
      settings: { title: '生成设置', description: '沿用电商生图的模型与清晰度控制', icon: <MdHighQuality /> },
    }[activeConfigPanel];
    return createPortal(
      <div
        id="visual-floating-panel"
        className="visual-config-panel"
        role="dialog"
        aria-label={panelMeta?.title || '生成配置面板'}
        style={{
          position: 'fixed',
          left: configPanelPos.left,
          top: configPanelPos.top,
          bottom: configPanelPos.bottom,
          width: configPanelPos.width,
          maxHeight: configPanelPos.maxHeight,
          zIndex: 1100,
          transformOrigin: 'bottom center',
          '--visual-panel-anchor-x': `${Math.max(28, Math.min(configPanelPos.width - 28, configPanelPos.anchorX - configPanelPos.left))}px`,
        }}
      >
        <div className="visual-config-panel-header">
          <span className="visual-config-panel-icon">{panelMeta?.icon}</span>
          <div><strong>{panelMeta?.title}</strong><span>{panelMeta?.description}</span></div>
        </div>
        <div className="visual-config-panel-body">
          {activeConfigPanel === 'recipe' && <VisualRecipePanel selectedSkill={selectedSkill} skillControl={skillControl} updateSkillControl={updateSkillControl} panelValues={panelValues} updatePanelValue={updatePanelValue} busy={busy} />}
          {activeConfigPanel === 'specs' && <VisualSpecsPanel selectedSkill={selectedSkill} ratio={ratio} count={count} onRatioChange={setRatio} onCountChange={setCount} busy={busy} />}
          {activeConfigPanel === 'settings' && <GenSettingsPanel showHeader={false} value={{ imageModel, resolution }} onChange={next => { setImageModel(next.imageModel); setResolution(next.resolution); }} />}
        </div>
      </div>,
      document.body,
    );
  };

  return (
    <section className="visual-creation" aria-labelledby="visual-creation-title">
      <header className="visual-creation-heading">
        <span className="visual-creation-kicker"><MdAutoAwesome />自由创作</span>
        <h2 id="visual-creation-title">自由创作，做出可继续编辑的视觉</h2>
        <p>选择创作方向，再用一句话和参考图开始。</p>
      </header>

      <div className="visual-skill-grid" role="listbox" aria-label="创作配方">
        {VISUAL_CREATION_SKILLS.map(skill => {
          const selected = skill.id === skillId;
          const SkillIcon = VISUAL_SKILL_ICONS[skill.id] || MdAutoAwesome;
          return (
            <button
              type="button"
              role="option"
              aria-selected={selected}
              className={`visual-skill-option${selected ? ' is-selected' : ''}`}
              key={skill.id}
              onClick={() => setSkillId(skill.id)}
            >
              <span className="visual-skill-icon" aria-hidden="true"><SkillIcon /></span>
              <span className="visual-skill-title">
                <strong>{skill.title}</strong>
                <small>{skill.shortDescription}</small>
                {selected && <MdCheckCircle aria-label="已选择" />}
              </span>
            </button>
          );
        })}
      </div>

      <section className={`visual-skill-stage visual-layout-${selectedShowcase?.layout?.type || 'editorial-grid'}${showcaseSlide % 2 ? ' is-alternate' : ''}`} aria-label={`${selectedSkill.title}效果预览`}>
        <div className="visual-skill-stage-copy">
          <span><MdAutoAwesome />{selectedSkill.title}</span>
          <strong>{selectedShowcase?.title || selectedSkill.shortDescription}</strong>
          <p>{selectedShowcase?.description || selectedSkill.outcome}</p>
          <div className="visual-showcase-controls" role="tablist" aria-label={`${selectedSkill.title}案例视图`}>
            {showcases.map((item, index) => <button type="button" role="tab" key={item.title} aria-label={item.title} aria-selected={showcaseSlide === index} className={showcaseSlide === index ? 'is-active' : ''} onClick={() => chooseShowcaseSlide(index)} />)}
          </div>
        </div>
        <div className="visual-skill-stage-art">
          <div className={`visual-skill-stage-outputs is-chapter count-${selectedShowcase?.assets?.length || 0}`}>
            {(selectedShowcase?.assets || []).map((item, index) => showcaseCard(item, `visual-skill-stage-output output-${index}`, index))}
          </div>
        </div>
        <div className="visual-ability-rail" aria-label={`${selectedSkill.title}能力说明`}>
          <div><span>01</span><small>输入保真</small><strong>{selectedSkill.preserves}</strong></div>
          <div><span>02</span><small>生成能力</small><strong>{selectedSkill.outcome}</strong></div>
          <div><span>03</span><small>适用任务</small><strong>{selectedSkill.bestFor}</strong></div>
        </div>
      </section>

      <div className="visual-creation-composer">
        <div
          className="visual-reference-zone"
          onDragOver={event => event.preventDefault()}
          onDrop={event => {
            event.preventDefault();
            if (!busy) appendFiles(event.dataTransfer.files);
          }}
        >
          <div className="visual-reference-heading">
            {/* 9-12 用户批注：文案照小红书那套语义 —— 这里是「我的素材」（主体/产品），
                风格参考只影响构图与色调，同样放这里即可。 */}
            <span><MdAddPhotoAlternate />我的素材 <small>{references.length}/{MAX_REFERENCES}</small></span>
            <small>{selectedSkill.materialHint || '主体或参考图都可以 · 风格参考只影响构图与色调'} · JPG/PNG/WebP，最多 6 张</small>
          </div>
          <div className="visual-reference-list">
            {references.map((reference, index) => (
              <figure className={`visual-reference-item visual-reference-item-${index % 3}`} key={reference.id}>
                <img src={reference.previewUrl} alt={`参考图 ${index + 1}`} width="160" height="160" loading="lazy" decoding="async" fetchpriority="auto" />
                <figcaption>参考图 {index + 1}</figcaption>
                <button
                  type="button"
                  title={`删除参考图 ${index + 1}`}
                  aria-label={`删除参考图 ${index + 1}`}
                  onClick={() => removeReference(reference.id)}
                  disabled={busy}
                ><MdClose /></button>
              </figure>
            ))}
            {references.length < MAX_REFERENCES && (
              <button
                type="button"
                className="visual-reference-add"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
              >
                <span className="visual-reference-add-icon"><MdAddPhotoAlternate /></span>
                <strong>参考图</strong>
                <span>主体、构图或风格</span>
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={event => appendFiles(event.target.files)}
          />
        </div>

        <div className="visual-prompt-field">
          <MentionPromptField
            ref={promptRef}
            value={prompt}
            mentions={mentionOptions}
            maxLength={IMAGE_PROMPT_LIMIT}
            onChange={value => setPrompt(String(value || '').slice(0, IMAGE_PROMPT_LIMIT))}
            onFilesPasted={files => { if (!busy) appendFiles(files); }}
            placeholder={selectedSkill.promptHint ? `${selectedSkill.title}：${selectedSkill.promptHint}` : `描述你想生成的${selectedSkill.title}：主体、场景、构图、文字与限制条件...`}
            aria-label="画面描述"
            className={busy ? 'is-disabled' : ''}
          />
          <div className="visual-prompt-footer">
            <div className="visual-mention-wrap">
              <button
                type="button"
                className="visual-mention-button"
                aria-label="引用参考素材"
                title="引用参考素材"
                disabled={busy || mentionOptions.length === 0}
                onClick={() => setShowMentionMenu(current => !current)}
              ><MdAlternateEmail /></button>
              {showMentionMenu && (
                <div className="visual-mention-menu" role="menu" aria-label="选择参考素材">
                  {mentionOptions.map(option => (
                    <button type="button" role="menuitem" key={option.id} onClick={() => insertMention(option.label)}>{option.label}</button>
                  ))}
                </div>
              )}
            </div>
            <small>{prompt.length}/3000</small>
          </div>
        </div>

        <div className="visual-parameter-bar">
          <div className="visual-config-cluster" aria-label="生成配置">
            <button type="button" ref={element => { configButtonRefs.current.recipe = element; }} className={`visual-config-trigger${activeConfigPanel === 'recipe' ? ' is-open' : ''}`} aria-expanded={activeConfigPanel === 'recipe'} onClick={() => toggleConfigPanel('recipe')}>
              <MdAutoAwesome aria-hidden="true" />
              <span className="visual-config-trigger-copy"><small>创作配方</small><strong>{selectedSkill.title} · {skillControl}</strong></span>
              <MdTune aria-hidden="true" />
            </button>
            <button type="button" ref={element => { configButtonRefs.current.specs = element; }} className={`visual-config-trigger${activeConfigPanel === 'specs' ? ' is-open' : ''}`} aria-expanded={activeConfigPanel === 'specs'} onClick={() => toggleConfigPanel('specs')}>
              <MdAspectRatio aria-hidden="true" />
              <span className="visual-config-trigger-copy"><small>画面规格</small><strong>{ratio} · {count} 张</strong></span>
              <MdTune aria-hidden="true" />
            </button>
            <button type="button" ref={element => { configButtonRefs.current.settings = element; }} className={`visual-config-trigger${activeConfigPanel === 'settings' ? ' is-open' : ''}`} aria-expanded={activeConfigPanel === 'settings'} onClick={() => toggleConfigPanel('settings')}>
              <MdHighQuality aria-hidden="true" />
              <span className="visual-config-trigger-copy"><small>生成设置</small><strong>{model.label} · {resolution}</strong></span>
              <MdTune aria-hidden="true" />
            </button>
          </div>
          {/* 9-12 用户批注：预计积分统一放进按钮里（与电商生图、生视频一致），不再单独挂一条小字 */}
          <button
            type="button"
            className="visual-generate-button shubao-gen-cta"
            title={`${model.label} ${resolution} · 预计 ${estimatedPoints} AI 积分`}
            onClick={startGeneration}
            disabled={!canGenerate || busy}
          >
            {busy ? <><span className="visual-spinner" />{uploading ? '上传中' : '生成中'}</> : <><MdSend />生成图片<span className="shubao-gen-cta-points">{estimatedPoints} 积分</span></>}
          </button>
        </div>
        {renderConfigPanel()}
      </div>

      {(error || notice) && (
        <div className={`visual-feedback ${error ? 'is-error' : 'is-success'}`} role={error ? 'alert' : 'status'}>
          {error ? <MdErrorOutline /> : <MdCheckCircle />}
          <span>{error || notice}</span>
          {retryIndexes.length > 0 && !busy && (
            <button type="button" onClick={retryFailed}><MdRefresh />只重试失败项</button>
          )}
        </div>
      )}

      {run && (
        <div className="visual-results" aria-live="polite">
          <div className="visual-results-heading">
            <span><MdImage />生成结果 <small>{successfulSlots.length}/{run.slots.length}</small></span>
            {work && (
              <button type="button" onClick={openCanvas}><MdOpenInNew />进入画布</button>
            )}
          </div>
          <div className="visual-result-grid">
            {run.slots.map((slot, index) => (
              <article className={`visual-result-item is-${slot.status}`} key={slot.id}>
                {slot.url ? (
                  <img src={slot.url} alt={`${selectedSkill.title}结果 ${index + 1}`} width="512" height="512" loading="lazy" decoding="async" fetchpriority="auto" />
                ) : slot.status === 'failed' ? (
                  <div className="visual-result-state"><MdErrorOutline /><span>{slot.error}</span></div>
                ) : (
                  <div className="visual-result-state"><span className="visual-spinner" /><span>{slot.status === 'generating' ? '正在生成' : '等待生成'}</span></div>
                )}
                <footer>
                  <span>图片 {index + 1}</span>
                  {slot.url && (
                    <a href={slot.url} download={`shubao-${run.id}-${index + 1}.png`} title="下载图片">
                      <MdDownload /><span>下载</span>
                    </a>
                  )}
                </footer>
              </article>
            ))}
          </div>
        </div>
      )}

      {previewItem && (
        <div className="visual-preview-dialog" role="dialog" aria-modal="true" aria-label={previewItem.label} onMouseDown={event => {
          if (event.currentTarget === event.target) setPreviewItem(null);
        }}>
          <div className="visual-preview-dialog-content">
            <button type="button" className="visual-preview-close" aria-label="关闭预览" onClick={() => setPreviewItem(null)}><MdClose /></button>
            {previewItems.length > 1 && <>
              <button type="button" className="visual-preview-previous" aria-label="查看上一张" title="上一张" onClick={() => setPreviewItem(current => { const index = previewItems.findIndex(item => item.src === current?.src); return previewItems[(index - 1 + previewItems.length) % previewItems.length]; })}><MdChevronLeft /></button>
              <button type="button" className="visual-preview-next" aria-label="查看下一张" title="下一张" onClick={() => setPreviewItem(current => { const index = previewItems.findIndex(item => item.src === current?.src); return previewItems[(index + 1) % previewItems.length]; })}><MdChevronRight /></button>
            </>}
            <img src={previewItem.src} alt={previewItem.alt || previewItem.label} width="1024" height="1024" loading="eager" decoding="async" fetchpriority="high" />
            <strong>{previewItem.label}</strong>
          </div>
        </div>
      )}
    </section>
  );
}
