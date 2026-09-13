import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePanelScrollLock } from '../../components/ui/usePanelScrollLock.js';
import { Check, Info, LayoutTemplate, Layers3, Monitor, Palette, Sparkles, Type, WandSparkles } from 'lucide-react';
import {
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
import ImageMentionPicker from '../../components/creation/ImageMentionPicker.jsx';
import { insertImageMentionAt } from '../../components/creation/imageMentionModel.js';
import { EcommerceAddCard, EcommerceImageCard } from './ec/components/EcommerceAssetCards.jsx';
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
  visualSkillDefaultRatio,
  visualGenerationEstimate,
} from './visualCreationModel.js';
import './VisualCreationMode.css';
import { IMAGE_PROMPT_LIMIT } from '../../constants/promptLimits.js';

const MAX_REFERENCES = 6;
/* 9-13 二轮批注：跟小红书图文一致 ——「我的素材 ≤6 张；风格参考 ≤3 张」分别上限 */
const MAX_STYLE_REFERENCES = 3;
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

/* 照小红书图文那套：ImageMentionPicker(insert) 把 @引用 插进 textarea 光标处 */
function insertMentionInTextarea(fieldRef, currentValue, setValue, label) {
  const field = fieldRef.current;
  const result = insertImageMentionAt(
    currentValue,
    label,
    field?.selectionStart,
    field?.selectionEnd,
  );
  if (result.value === currentValue) return;
  setValue(result.value);
  const restore = () => {
    field?.focus();
    field?.setSelectionRange?.(result.caret, result.caret);
  };
  if (globalThis.requestAnimationFrame) globalThis.requestAnimationFrame(restore);
  else globalThis.setTimeout?.(restore, 0);
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
  return assets.map((asset, index) => {
    const isStyle = asset.bucket === 'style';
    const displayName = isStyle ? `风格参考 ${asset.bucketIndex}` : `我的素材 ${asset.bucketIndex}`;
    return {
      sourceNodeId: `visual-reference-${index + 1}`,
      assetId: asset.assetId,
      url: asset.url,
      displayName,
      mention: `@${displayName}`,
      role: isStyle ? 'reference' : 'source',
      order: index,
    };
  });
}

export default function VisualCreationMode({ recoveryCheckpoint = null, initialSkillId = null }) {
  const { state, dispatch, refreshBillingBalance } = useApp();
  const [skillId, setSkillId] = useState('free');
  const [prompt, setPrompt] = useState('');
  /* 9-13 二轮批注：跟小红书图文一致，上传区拆成「我的素材 ≤6」与「风格参考 ≤3」两个桶 */
  const [materials, setMaterials] = useState([]);
  const [styles, setStyles] = useState([]);
  const [imageModel, setImageModel] = useState('image2');
  const [ratio, setRatio] = useState('1:1');
  const [resolution, setResolution] = useState('2K');
  const [count, setCount] = useState(1);
  const [run, setRun] = useState(null);
  const [runConfig, setRunConfig] = useState(null);
  const [work, setWork] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  /* 9-13 二轮批注：超限/格式问题时给 toast（小红书同款顶部浮层），不静默丢弃 */
  const [toast, setToast] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showcaseSlide, setShowcaseSlide] = useState(0);
  const [showcaseManualRevision, setShowcaseManualRevision] = useState(0);
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
  const materialsRef = useRef([]);
  const stylesRef = useRef([]);
  const materialInputRef = useRef(null);
  const styleInputRef = useRef(null);
  /* 9-13 二轮批注：恢复检查点时会跳过「切页重置画幅」，避免覆盖断点续传的画幅 */
  const restoreRatioRef = useRef(false);
  const promptRef = useRef(null);
  const abortRef = useRef(null);
  const configButtonRefs = useRef({});
  const restoredCheckpointRef = useRef('');

  const selectedSkill = visualSkillById(skillId);
  const busy = uploading || visualRunIsBusy(run);
  const retryIndexes = visualRetryIndexes(run);
  const successfulSlots = run?.slots?.filter(slot => slot.status === 'completed') || [];
  const canGenerate = Boolean(prompt.trim() || materials.length || styles.length);
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
  /* 照小红书图文那套：ImageMentionPicker 的 images 数组（name 生成 @参考图 N 标签）。
     9-13 二轮批注：我的素材按 source、风格参考按 style 传，与小红书 XhsSupplementDeck 一致 */
  const mentionImages = useMemo(() => [
    ...materials.map((reference, index) => ({
      id: reference.id,
      sourceNodeId: `visual-material-${index + 1}`,
      url: reference.previewUrl,
      name: `我的素材 ${index + 1}`,
      role: 'source',
    })),
    ...styles.map((reference, index) => ({
      id: reference.id,
      sourceNodeId: `visual-style-${index + 1}`,
      url: reference.previewUrl,
      name: `风格参考 ${index + 1}`,
      role: 'style',
    })),
  ], [materials, styles]);

  useEffect(() => {
    setShowcaseSlide(0);
    setShowcaseManualRevision(0);
    setPreviewItem(null);
    /* 9-13 二轮批注：切子页面时底部参数默认值按该板块最合适的画幅重置 */
    if (restoreRatioRef.current) {
      restoreRatioRef.current = false;
    } else {
      setRatio(visualSkillDefaultRatio(skillId));
      setCount(1);
    }
  }, [skillId]);

  useEffect(() => {
    const snapshot = recoveryCheckpoint?.version?.inputSnapshot;
    const checkpointId = recoveryCheckpoint?.version?.id || '';
    if (!snapshot || !checkpointId || restoredCheckpointRef.current === checkpointId) return;
    restoredCheckpointRef.current = checkpointId;
    const nextSkill = visualSkillById(snapshot.skillId);
    setSkillId(nextSkill.id);
    restoreRatioRef.current = true;
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
    const restoredMaterials = (Array.isArray(snapshot.referenceAssets) ? snapshot.referenceAssets : []).map((asset, index) => ({
      id: `restored-${checkpointId}-${index}`,
      name: asset.displayName || `我的素材 ${index + 1}`,
      previewUrl: asset.url,
      asset,
      file: null,
    })).filter(reference => reference.asset?.url);
    setMaterials(restoredMaterials.slice(0, MAX_REFERENCES));
    setStyles([]);
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
    materialsRef.current = materials;
  }, [materials]);

  useEffect(() => {
    stylesRef.current = styles;
  }, [styles]);

  useEffect(() => () => {
    abortRef.current?.abort();
    for (const reference of [...materialsRef.current, ...stylesRef.current]) {
      if (reference.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(reference.previewUrl);
    }
  }, []);

  /* 9-13 二轮批注：toast 自动消失（照小红书 4s） */
  useEffect(() => {
    if (!toast) return undefined;
    const timer = globalThis.setTimeout(() => setToast(null), 4000);
    return () => globalThis.clearTimeout(timer);
  }, [toast]);

  const showToast = (message, type = 'error') => setToast({ message, type });

  const model = useMemo(
    () => IMAGE_MODELS.find(option => option.id === imageModel) || IMAGE_MODELS[0],
    [imageModel],
  );

  /* 9-13 二轮批注：按桶（material/style）上传，超限 toast 提示且不静默丢弃 */
  const appendFiles = (files, role = 'material') => {
    setError('');
    const isStyle = role === 'style';
    const max = isStyle ? MAX_STYLE_REFERENCES : MAX_REFERENCES;
    const noun = isStyle ? '风格参考' : '我的素材';
    const currentLength = isStyle ? styles.length : materials.length;
    const available = max - currentLength;
    const incoming = Array.from(files || []);
    if (available <= 0) {
      showToast(`${noun}最多 ${max} 张，已达上限`, 'error');
      clearFileInputs();
      return;
    }
    if (incoming.length > available) {
      showToast(`${noun}最多 ${max} 张，本次超出 ${incoming.length - available} 张，仅保留前 ${available} 张`, 'error');
    }
    const accepted = [];
    for (const file of incoming.slice(0, available)) {
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
        name: file.name || (isStyle ? `风格参考 ${styles.length + accepted.length + 1}` : `我的素材 ${materials.length + accepted.length + 1}`),
        previewUrl: URL.createObjectURL(file),
        asset: null,
      });
    }
    if (accepted.length) {
      if (isStyle) setStyles(current => [...current, ...accepted].slice(0, MAX_STYLE_REFERENCES));
      else setMaterials(current => [...current, ...accepted].slice(0, MAX_REFERENCES));
    }
    clearFileInputs();
  };

  const clearFileInputs = () => {
    if (materialInputRef.current) materialInputRef.current.value = '';
    if (styleInputRef.current) styleInputRef.current.value = '';
  };

  const removeReference = (id, role) => {
    const setList = role === 'style' ? setStyles : setMaterials;
    setList(current => current.filter(reference => {
      if (reference.id !== id) return true;
      if (reference.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(reference.previewUrl);
      return false;
    }));
  };

  const ensureDurableReferences = async signal => {
    const current = [...materialsRef.current, ...stylesRef.current];
    const missing = current.filter(reference => !reference.asset);
    if (!missing.length) return current.map(reference => reference.asset).filter(Boolean);
    setUploading(true);
    try {
      const uploaded = await uploadEcommerceAssets(missing.map(reference => reference.file), 'reference', { signal });
      const uploadedById = new Map(missing.map((reference, index) => [reference.id, uploaded[index]]));
      const nextMaterials = materialsRef.current.map(reference => ({
        ...reference,
        asset: reference.asset || uploadedById.get(reference.id) || null,
      }));
      const nextStyles = stylesRef.current.map(reference => ({
        ...reference,
        asset: reference.asset || uploadedById.get(reference.id) || null,
      }));
      materialsRef.current = nextMaterials;
      stylesRef.current = nextStyles;
      setMaterials(nextMaterials);
      setStyles(nextStyles);
      return [...nextMaterials, ...nextStyles].map(reference => reference.asset).filter(Boolean);
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
      const durableAssets = await ensureDurableReferences(abortRef.current.signal);
      /* 9-13 二轮批注：参考素材带上桶语义（我的素材/风格参考），生成时按小红书语义命名 */
      const referenceSources = [
        ...materials.map((reference, index) => ({ asset: reference.asset, bucket: 'material', index })),
        ...styles.map((reference, index) => ({ asset: reference.asset, bucket: 'style', index })),
      ].filter(item => item.asset);
      const referenceAssets = referenceSources.map(item => ({
        ...item.asset,
        bucket: item.bucket,
        bucketIndex: item.index + 1,
      }));
      if (!durableAssets.length && referenceAssets.length) {
        throw new Error('参考素材上传失败，请重试');
      }
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
        {/* ═══ 素材上传区 + 输入区 + @引用：照抄小红书图文那套（ec-xhs-composer 暖色渐变面），只改文案 ═══ */}
        <div className="ec-xhs-composer visual-composer-surface">
          <div
            className="ec-xhs-media-column xhs-ecommerce-media-column visual-reference-zone"
            onDragOver={event => event.preventDefault()}
            onDrop={event => {
              event.preventDefault();
              if (!busy) appendFiles(event.dataTransfer.files);
            }}
          >
            {/* 9-13 三轮批注：媒体条照小红书 XhsSupplementDeck 的完整结构（ec-xhs-media-column 包媒体条），
                行内偏移与小红书逐项一致；素材区提示句已删，上限说明移入 @引用行 */}
            <div className="ec-xhs-media-strip xhs-ecommerce-media-strip visual-reference-list">
              {materials.map((reference, index) => (
                <EcommerceImageCard
                  key={reference.id}
                  role="product"
                  image={{ url: reference.previewUrl, status: 'loaded' }}
                  label={`我的素材 ${index + 1}`}
                  index={index}
                  onRemove={() => removeReference(reference.id, 'material')}
                />
              ))}
              {materials.length < MAX_REFERENCES && (
                <EcommerceAddCard
                  role="product"
                  label={materials.length ? '继续添加' : '我的素材'}
                  meta={materials.length ? '补充素材' : '主体与生活细节'}
                  title="添加我的素材"
                  onClick={() => { if (!busy) materialInputRef.current?.click(); }}
                />
              )}
              <span className="ec-xhs-multiply" aria-hidden="true">×</span>
              {styles.map((reference, index) => (
                <EcommerceImageCard
                  key={reference.id}
                  role="reference"
                  image={{ url: reference.previewUrl, status: 'loaded' }}
                  label={`风格参考 ${index + 1}`}
                  index={index}
                  onRemove={() => removeReference(reference.id, 'style')}
                />
              ))}
              {styles.length < MAX_STYLE_REFERENCES && (
                <EcommerceAddCard
                  role="reference"
                  label="风格参考"
                  meta="构图或色调"
                  optional
                  title="添加风格参考"
                  onClick={() => { if (!busy) styleInputRef.current?.click(); }}
                />
              )}
            </div>
            <input
              ref={materialInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              hidden
              onChange={event => appendFiles(event.target.files, 'material')}
            />
            <input
              ref={styleInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              hidden
              onChange={event => appendFiles(event.target.files, 'style')}
            />
          </div>

          <div
            className="ec-textarea-wrap ec-xhs-prompt visual-prompt-field"
            onClick={event => { if (event.target !== promptRef.current) promptRef.current?.focus(); }}
          >
            <textarea
              ref={promptRef}
              value={prompt}
              onChange={event => setPrompt(String(event.target.value || '').slice(0, IMAGE_PROMPT_LIMIT))}
              className="xhs-prompt-field"
              placeholder=""
              aria-label="画面描述"
              onPaste={event => {
                const files = Array.from(event.clipboardData?.files || []).filter(file => ACCEPTED_IMAGE_TYPES.has(file.type));
                if (files.length) { event.preventDefault(); appendFiles(files); }
              }}
            />
            {!prompt && (
              <div className="ec-textarea-placeholder ec-xhs-placeholder ec-xhs-prompt-hints" aria-hidden="true">
                <span className="ec-placeholder-line">{selectedSkill.promptHint ? `${selectedSkill.title}：${selectedSkill.promptHint}` : `描述你想生成的${selectedSkill.title}：主体、场景、构图、文字与限制条件...`}</span>
                {/* 9-13 二轮批注：两条示例按子页面各自独立（不再四个板块共用同一份） */}
                {(selectedSkill.promptExamples || []).map((example, index) => (
                  <span className={`ec-placeholder-line${index === 0 ? ' ec-xhs-example-first' : ''}`} key={example}>{example}</span>
                ))}
              </div>
            )}
          </div>

          <div className="ec-workbench-mention-row">
            <ImageMentionPicker
              images={mentionImages}
              selectionMode="insert"
              onToggle={image => insertMentionInTextarea(promptRef, prompt, setPrompt, image.label)}
            />
            {/* 9-13 三轮批注：上限说明按小红书位置（@引用行右侧，同小红书 ref-hint 的位置）与措辞（计数 + 格式，不加自造句子） */}
            <span className="visual-limit-note">我的素材 {materials.length}/{MAX_REFERENCES} · 风格参考 {styles.length}/{MAX_STYLE_REFERENCES} · JPG/PNG/WebP</span>
          </div>
        </div>

        {/* ═══ 底栏：左侧工具胶囊 + 右侧统一生成按钮（按钮内动态积分），照小红书图文那套 ═══ */}
        <div className="ec-workbench-actions xhs-template-actions visual-parameter-bar">
          <div className="ec-workbench-primary-row">
            <div className="ec-workbench-tools xhs-template-tools visual-config-cluster" aria-label="生成配置">
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
            <button
              type="button"
              className="visual-generate-button shubao-gen-cta ec-workbench-next"
              title={`${model.label} ${resolution} · 预计 ${estimatedPoints} AI 积分`}
              onClick={startGeneration}
              disabled={!canGenerate || busy}
            >
              {busy ? <><span className="visual-spinner" />{uploading ? '上传中' : '生成中'}</> : <><MdSend />生成图片<span className="shubao-gen-cta-points">{estimatedPoints} 积分</span></>}
            </button>
          </div>
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

      {/* 9-13 二轮批注：超限/素材问题的顶部 toast（小红书同款位置与时长） */}
      {toast && (
        <div className="visual-toast" role="status" aria-live="polite" data-toast-type={toast.type}>{toast.message}</div>
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
