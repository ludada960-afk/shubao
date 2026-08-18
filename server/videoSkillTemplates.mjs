import { normalizeSkillRunSpec } from './videoSkillRun.mjs';

const MAX_INPUT_BYTES = 16_000;
const MAX_REF_COUNT = 6;
const MAX_TEXT = 1_200;

function invalid(message) {
  return Object.assign(new Error(message), { code: 'INVALID_SKILL_TEMPLATE' });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function boundedText(value, label, max = MAX_TEXT) {
  const text = String(value ?? '').trim();
  if (!text || text.length > max) throw invalid(`${label} is invalid`);
  return text;
}

function boundedInput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid('template input must be an object');
  let input;
  try { input = clone(value); } catch { throw invalid('template input is not serializable'); }
  if (Buffer.byteLength(JSON.stringify(input), 'utf8') > MAX_INPUT_BYTES) throw invalid('template input is too large');
  const prompt = boundedText(input.prompt, 'prompt');
  const normalized = { prompt };
  if (input.negativePrompt !== undefined) normalized.negativePrompt = boundedText(input.negativePrompt, 'negativePrompt');
  for (const key of ['images', 'videos', 'audios']) {
    if (input[key] === undefined) continue;
    if (!Array.isArray(input[key]) || input[key].length > MAX_REF_COUNT) throw invalid(`${key} references are invalid`);
    normalized[key] = input[key].map((ref, index) => {
      if (!ref || typeof ref !== 'object' || Array.isArray(ref)) throw invalid(`${key} reference ${index} is invalid`);
      const assetId = boundedText(ref.assetId, `${key} reference ${index} assetId`, 200);
      return { assetId };
    });
  }
  if (input.referenceVideo !== undefined) {
    if (!input.referenceVideo || typeof input.referenceVideo !== 'object' || Array.isArray(input.referenceVideo)) {
      throw invalid('reference video is invalid');
    }
    normalized.referenceVideo = { assetId: boundedText(input.referenceVideo.assetId, 'reference video assetId', 200) };
  }
  if (input.replacementImages !== undefined) {
    if (!Array.isArray(input.replacementImages) || input.replacementImages.length > MAX_REF_COUNT) {
      throw invalid('replacement images are invalid');
    }
    normalized.replacementImages = input.replacementImages.map((ref, index) => ({
      assetId: boundedText(ref?.assetId, `replacement image ${index} assetId`, 200),
    }));
  }
  return normalized;
}

const TEMPLATE_DEFINITIONS = Object.freeze([
  Object.freeze({
    templateId: 'product-ad-v1',
    skillId: 'product-advertisement',
    skillVersion: 1,
    title: '产品广告短片',
    mode: 'smart',
    sourceWorkflow: 'video-studio.smart',
    inputContract: {
      required: ['prompt'],
      optional: ['images', 'videos', 'audios', 'negativePrompt'],
      mediaLimit: MAX_REF_COUNT,
      semantics: '一句话起步，可选商品、人物、场景和声音素材',
    },
    steps: [
      { id: 'brief', kind: 'brief', label: '整理广告目标与素材清单', requires: [] },
      { id: 'asset-plan', kind: 'assets', label: '确认商品、人物与场景资产', requires: ['brief'] },
      { id: 'shot-plan', kind: 'storyboard', label: '拆解镜头节奏与交付结构', requires: ['asset-plan'] },
      { id: 'candidate-review', kind: 'candidate-review', label: '审核逐镜头候选版本', requires: ['shot-plan'] },
      { id: 'timeline-ready', kind: 'timeline', label: '整理选定镜头进入时间线', requires: ['candidate-review'] },
    ],
    checkpoints: [
      { id: 'approve-plan', label: '确认广告方案' },
      { id: 'approve-candidates', label: '确认镜头候选' },
    ],
    capabilities: ['image_reference', 'video_generation', 'audio_optional', 'storyboard', 'timeline'],
    modelPolicy: { strategy: 'capability-fit', userIntent: 'balanced', allowFallback: true },
    outputContract: { required: ['storyboard', 'selectedCandidates', 'timeline'], maxDurationSeconds: 30 },
    rightsPolicy: { preserveUserAssets: true, requireUserRightsConfirmation: true },
  }),
  Object.freeze({
    templateId: 'reference-video-reconstruction-v1',
    skillId: 'reference-video-reconstruction',
    skillVersion: 1,
    title: '参考视频重构',
    mode: 'remake',
    sourceWorkflow: 'video-studio.remake',
    inputContract: {
      required: ['prompt', 'referenceVideo', 'replacementImages'],
      optional: ['audios', 'negativePrompt'],
      mediaLimit: MAX_REF_COUNT,
      semantics: '分析参考视频节奏与镜头结构，用自有素材重构内容',
    },
    steps: [
      { id: 'inspect-reference', kind: 'analysis', label: '分析参考视频镜头与节奏', requires: [] },
      { id: 'extract-beats', kind: 'storyboard', label: '提取可复用的镜头结构', requires: ['inspect-reference'] },
      { id: 'bind-replacements', kind: 'assets', label: '绑定自有主体与场景素材', requires: ['extract-beats'] },
      { id: 'candidate-review', kind: 'candidate-review', label: '审核重构镜头候选版本', requires: ['bind-replacements'] },
      { id: 'timeline-ready', kind: 'timeline', label: '整理选定镜头进入时间线', requires: ['candidate-review'] },
    ],
    checkpoints: [
      { id: 'approve-structure', label: '确认参考结构' },
      { id: 'approve-replacement', label: '确认替换内容' },
    ],
    capabilities: ['video_analysis', 'reference_video', 'image_reference', 'video_generation', 'storyboard', 'timeline'],
    modelPolicy: { strategy: 'capability-fit', userIntent: 'balanced', allowFallback: true },
    outputContract: { required: ['referenceAnalysis', 'storyboard', 'selectedCandidates', 'timeline'], maxDurationSeconds: 30 },
    rightsPolicy: {
      preserveUserAssets: true,
      requireUserRightsConfirmation: true,
      disallowCopyingProtectedPeopleBrands: true,
      referenceUse: 'borrow rhythm and shot structure only',
    },
  }),
]);

function templateView(definition) {
  const value = clone(definition);
  return Object.freeze(value);
}

export function listVideoSkillTemplates() {
  return TEMPLATE_DEFINITIONS.map(templateView);
}

export function getVideoSkillTemplate(templateId) {
  const normalized = String(templateId ?? '').trim();
  const definition = TEMPLATE_DEFINITIONS.find(template => template.templateId === normalized);
  if (!definition) throw invalid('skill template is not available');
  return templateView(definition);
}

export function buildSkillRunSpecFromTemplate(templateId, { input = {} } = {}) {
  const template = getVideoSkillTemplate(templateId);
  const normalizedInput = boundedInput(input);
  if (template.templateId === 'reference-video-reconstruction-v1'
    && (!normalizedInput.referenceVideo || !normalizedInput.replacementImages?.length)) {
    throw invalid('reference video and replacement images are required');
  }
  const spec = normalizeSkillRunSpec({
    templateId: template.templateId,
    skillId: template.skillId,
    skillVersion: template.skillVersion,
    input: normalizedInput,
    steps: template.steps,
    checkpoints: template.checkpoints,
    modelPolicy: template.modelPolicy,
    outputContract: template.outputContract,
  });
  return { ...spec, templateId: template.templateId };
}

export const VIDEO_SKILL_TEMPLATE_LIMITS = Object.freeze({ MAX_INPUT_BYTES, MAX_REF_COUNT, MAX_TEXT });
