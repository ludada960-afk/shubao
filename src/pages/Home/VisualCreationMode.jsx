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

export default function VisualCreationMode() {
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
  const [skillControlValues, setSkillControlValues] = useState(() => Object.fromEntries(
    VISUAL_CREATION_SKILLS.map(skill => [skill.id, skill.control?.options?.[0] || '']),
  ));
  const runRef = useRef(null);
  const referencesRef = useRef([]);
  const fileInputRef = useRef(null);
  const promptRef = useRef(null);
  const abortRef = useRef(null);

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
  }, [skillId]);

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
    });
    setWork(nextWork);
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
      const config = {
        prompt: `${originalPrompt}\n创作模式：${selectedSkill.title}；${selectedSkill.control.label}：${skillControl}`,
        originalPrompt,
        skillId,
        skillControl,
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

  const showcaseCard = (item, className) => item ? (
    <button
      type="button"
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

      <section className="visual-skill-stage" aria-label={`${selectedSkill.title}效果预览`}>
        <div className="visual-skill-stage-copy">
          <span><MdAutoAwesome />{selectedSkill.title}</span>
          <strong>{selectedShowcase?.title || selectedSkill.shortDescription}</strong>
          <p>{selectedShowcase?.description || selectedSkill.outcome}</p>
          <div className="visual-showcase-controls" role="tablist" aria-label={`${selectedSkill.title}案例视图`}>
            {showcases.map((item, index) => <button type="button" role="tab" key={item.title} aria-label={item.title} aria-selected={showcaseSlide === index} className={showcaseSlide === index ? 'is-active' : ''} onClick={() => chooseShowcaseSlide(index)} />)}
          </div>
        </div>
        <div className="visual-skill-stage-art">
          {selectedShowcase?.input ? (
            <>
              {showcaseCard(selectedShowcase.input, 'visual-skill-stage-input')}
              <span className="visual-skill-stage-operator" aria-hidden="true"><MdSend /></span>
              <div className={`visual-skill-stage-outputs count-${selectedShowcase.outputs?.length || 1}`}>
                {(selectedShowcase.outputs || [selectedShowcase.output]).filter(Boolean).map((item, index) => showcaseCard(item, `visual-skill-stage-output output-${index}`))}
              </div>
            </>
          ) : (
            <div className={`visual-skill-stage-outputs is-result-only count-${selectedShowcase.outputs?.length || 1}`}>
              {(selectedShowcase.outputs || [selectedShowcase.output]).filter(Boolean).map((item, index) => showcaseCard(item, `visual-skill-stage-result-only output-${index}`))}
            </div>
          )}
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
          <label className="visual-skill-control" title={selectedSkill.control.label}>
            <MdAutoAwesome />
            <span>{selectedSkill.control.label}</span>
            <select value={skillControl} onChange={event => updateSkillControl(event.target.value)} disabled={busy}>
              {selectedSkill.control.options.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label title="图片模型">
            <MdTune />
            <span className="sr-only">图片模型</span>
            <select value={imageModel} onChange={event => setImageModel(event.target.value)} disabled={busy}>
              {IMAGE_MODELS.map(option => <option key={option.id} value={option.id}>模型 · {option.label}</option>)}
            </select>
          </label>
          <label title="图片画幅">
            <MdAspectRatio />
            <span className="sr-only">图片画幅</span>
            <select value={ratio} onChange={event => setRatio(event.target.value)} disabled={busy}>
              {VISUAL_RATIO_OPTIONS.map(option => <option key={option.id} value={option.id}>画幅 · {option.label}</option>)}
            </select>
          </label>
          <label title="图片清晰度">
            <MdHighQuality />
            <span className="sr-only">图片清晰度</span>
            <select value={resolution} onChange={event => setResolution(event.target.value)} disabled={busy}>
              {['1K', '2K', '4K'].map(option => <option key={option} value={option}>清晰度 · {option}</option>)}
            </select>
          </label>
          <fieldset className="visual-count-control" disabled={busy}>
            <legend className="sr-only">生成数量</legend>
            {[1, 2, 3, 4].map(value => (
              <button
                type="button"
                key={value}
                className={count === value ? 'is-selected' : ''}
                aria-pressed={count === value}
                onClick={() => setCount(value)}
              >{value} 张</button>
            ))}
          </fieldset>
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
