import React, { useEffect, useMemo, useRef, useState } from 'react';
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
} from 'react-icons/md';

import { useApp } from '../../store/AppContext';
import { uploadEcommerceAssets, regenerateCanvasImage, saveWork } from '../../services/api';
import { IMAGE_MODELS, generationUnits } from '../../services/imageModelCatalog.js';
import { handleGenerationAccessError } from '../../utils/generationAccess.js';
import MentionPromptField from '../../components/creation/MentionPromptField.jsx';
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
} from './visualCreationModel.js';
import './VisualCreationMode.css';

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

export default function VisualCreationMode({ recoveryCheckpoint = null }) {
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
  const [skillControlValues, setSkillControlValues] = useState(() => Object.fromEntries(
    VISUAL_CREATION_SKILLS.map(skill => [skill.id, skill.control?.options?.[0] || '']),
  ));
  const [panelValues, setPanelValues] = useState(() => Object.fromEntries(
    VISUAL_CREATION_SKILLS.flatMap(skill => (skill.panels || []).map(panel => [panel.id, panel.options?.[0] || ''])),
  ));
  const runRef = useRef(null);
  const referencesRef = useRef([]);
  const fileInputRef = useRef(null);
  const promptRef = useRef(null);
  const abortRef = useRef(null);
  const restoredCheckpointRef = useRef('');

  const selectedSkill = visualSkillById(skillId);
  const busy = uploading || visualRunIsBusy(run);
  const retryIndexes = visualRetryIndexes(run);
  const successfulSlots = run?.slots?.filter(slot => slot.status === 'completed') || [];
  const estimatedPoints = ((generationUnits(imageModel, resolution) || 0) * count) / 1000;
  const showcases = selectedSkill.showcases || [];
  const selectedShowcase = showcases[showcaseSlide] || showcases[0];
  const skillControl = skillControlValues[skillId] || selectedSkill.control?.options?.[0] || '';
  const mentionOptions = useMemo(() => references.map((reference, index) => ({
    id: reference.id,
    sourceNodeId: `visual-reference-${index + 1}`,
    label: `@参考图 ${index + 1}`,
  })), [references]);

  useEffect(() => {
    setShowcaseSlide(0);
    setShowcaseManualRevision(0);
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
    setNotice('已载入案例参数，可直接调整后生成');
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
  };

  const startGeneration = async () => {
    if (!prompt.trim()) {
      setError('请先描述你想创作的画面');
      promptRef.current?.focus();
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

  const openCanvas = () => {
    if (!work) return;
    dispatch({ type: 'SET_RESULT', result: buildVisualCanvasResult(work) });
    dispatch({ type: 'NAVIGATE', page: 'ec-canvas' });
  };

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

  const toggleConfigPanel = panelId => {
    if (busy) return;
    setActiveConfigPanel(current => current === panelId ? null : panelId);
  };

  const showcaseCard = (item, className) => item ? (
    <button
      type="button"
      key={`${item.src}-${item.label}-${className}`}
      className={`visual-skill-stage-card ${className}`}
      onClick={() => setPreviewItem(item)}
      aria-label={`放大查看${item.label}`}
    >
      <img src={item.src} alt={item.alt || item.label} />
      <span>{item.label}</span>
      <MdZoomOutMap aria-hidden="true" />
    </button>
  ) : null;

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

      <section className={`visual-skill-stage visual-layout-${selectedShowcase?.layout?.type || 'editorial-grid'}`} aria-label={`${selectedSkill.title}效果预览`}>
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
            {(selectedShowcase?.assets || []).map((item, index) => showcaseCard(item, `visual-skill-stage-output output-${index}`))}
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
            <span><MdAddPhotoAlternate />参考素材 <small>{references.length}/{MAX_REFERENCES}</small></span>
            <small>JPG、PNG、WebP · 最多 6 张</small>
          </div>
          <div className="visual-reference-list">
            {references.map((reference, index) => (
              <figure className={`visual-reference-item visual-reference-item-${index % 3}`} key={reference.id}>
                <img src={reference.previewUrl} alt={`参考图 ${index + 1}`} />
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
            onChange={value => setPrompt(String(value || '').slice(0, 3000))}
            placeholder={`描述你想生成的${selectedSkill.title}：主体、场景、构图、文字与限制条件...`}
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
            <button type="button" className={`visual-config-trigger${activeConfigPanel === 'recipe' ? ' is-open' : ''}`} aria-expanded={activeConfigPanel === 'recipe'} onClick={() => toggleConfigPanel('recipe')}>
              <MdAutoAwesome aria-hidden="true" />
              <span className="visual-config-trigger-copy"><small>创作配方</small><strong>{selectedSkill.title} · {skillControl}</strong></span>
              <MdTune aria-hidden="true" />
            </button>
            <button type="button" className={`visual-config-trigger${activeConfigPanel === 'specs' ? ' is-open' : ''}`} aria-expanded={activeConfigPanel === 'specs'} onClick={() => toggleConfigPanel('specs')}>
              <MdAspectRatio aria-hidden="true" />
              <span className="visual-config-trigger-copy"><small>画面规格</small><strong>{ratio} · {count} 张</strong></span>
              <MdTune aria-hidden="true" />
            </button>
            <button type="button" className={`visual-config-trigger${activeConfigPanel === 'settings' ? ' is-open' : ''}`} aria-expanded={activeConfigPanel === 'settings'} onClick={() => toggleConfigPanel('settings')}>
              <MdHighQuality aria-hidden="true" />
              <span className="visual-config-trigger-copy"><small>生成设置</small><strong>{model.label} · {resolution}</strong></span>
              <MdTune aria-hidden="true" />
            </button>
          </div>
          {activeConfigPanel && (
            <div className="visual-config-panel" role="dialog" aria-label="生成配置面板">
              {activeConfigPanel === 'recipe' && (
                <>
                  <div className="visual-config-panel-heading"><strong>{selectedSkill.title} 配方</strong><span>必选创作方向与 Skill 扩展能力</span></div>
                  <label className="visual-config-field"><span>{selectedSkill.control.label}</span><select value={skillControl} onChange={event => updateSkillControl(event.target.value)} disabled={busy}>{selectedSkill.control.options.map(option => <option key={option} value={option}>{option}</option>)}</select></label>
                  <div className="visual-config-panel-grid">
                    {(selectedSkill.panels || []).map(panel => (
                      <label className="visual-config-field" key={panel.id}><span>{panel.label}</span><select value={panelValues[panel.id] || panel.options[0]} onChange={event => updatePanelValue(panel.id, event.target.value)} disabled={busy}>{panel.options.map(option => <option key={option} value={option}>{option}</option>)}</select></label>
                    ))}
                  </div>
                </>
              )}
              {activeConfigPanel === 'specs' && (
                <>
                  <div className="visual-config-panel-heading"><strong>画面规格</strong><span>先确定发布比例，再设置本次生成数量</span></div>
                  <div className="visual-config-panel-grid">
                    <label className="visual-config-field"><span>输出画幅</span><select value={ratio} onChange={event => setRatio(event.target.value)} disabled={busy}>{VISUAL_RATIO_OPTIONS.filter(option => selectedSkill.ratios?.includes(option.id)).map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
                    <fieldset className="visual-config-field visual-count-control" disabled={busy}><legend>生成数量</legend><div>{[1, 2, 3, 4].map(value => <button type="button" key={value} className={count === value ? 'is-selected' : ''} aria-pressed={count === value} onClick={() => setCount(value)}>{value} 张</button>)}</div></fieldset>
                  </div>
                </>
              )}
              {activeConfigPanel === 'settings' && (
                <>
                  <div className="visual-config-panel-heading"><strong>生成设置</strong><span>沿用电商生图的模型与清晰度控制</span></div>
                  <div className="visual-config-panel-grid">
                    <label className="visual-config-field"><span>图片模型</span><select value={imageModel} onChange={event => setImageModel(event.target.value)} disabled={busy}>{IMAGE_MODELS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
                    <label className="visual-config-field"><span>清晰度</span><select value={resolution} onChange={event => setResolution(event.target.value)} disabled={busy}>{['1K', '2K', '4K'].map(option => <option key={option} value={option}>{option}</option>)}</select></label>
                  </div>
                </>
              )}
            </div>
          )}
          <span className="visual-cost" title={`${model.label} ${resolution} 预计用量`}>
            预计 {estimatedPoints} AI 积分
          </span>
          <button
            type="button"
            className="visual-generate-button"
            onClick={startGeneration}
            disabled={busy}
          >
            {busy ? <><span className="visual-spinner" />{uploading ? '上传中' : '生成中'}</> : <><MdSend />生成图片</>}
          </button>
        </div>
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
                  <img src={slot.url} alt={`${selectedSkill.title}结果 ${index + 1}`} />
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
            <img src={previewItem.src} alt={previewItem.alt || previewItem.label} />
            <strong>{previewItem.label}</strong>
          </div>
        </div>
      )}
    </section>
  );
}
