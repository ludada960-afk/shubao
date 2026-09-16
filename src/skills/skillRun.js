/* ═══ Skill 运行模型：把「工作台上的字段」翻译成「引擎认识的参数」══════════════════
   这一层是工作台能不能真的出图的关键，也是唯一允许做这个翻译的地方
   （页面里不许再拼请求、不许再判断字段）。

   服务端契约（2026-09-17 调研，见 RTK 批次二十三）：
     · 单图链路 = POST /api/canvas/regenerate（经 services/api.js 的 regenerateCanvasImage）
       - prompt 必填；image_url 有值即图生图、无值即文生图（同一个路由）
       - reference_images ≤ 9；reference_metadata ≤ 9
       - ratio ∈ 1:1 | 3:4 | 4:3 | 9:16 | 16:9 | 21:9（非法值静默回落 1:1）
       - resolution ∈ 1K | 2K | 4K（非法值静默降级 2K）
       - creation_intent='visual' + skill_id ∈ free | poster | social-cover | brand-kv
         （服务端白名单只有这四个；非法值静默回落 free —— 所以我们**只映射到这四个**）
       - 计费：先报价再带 billing_quote_id（在 regenerateCanvasImage 内部完成）
       - 断线自愈：网络异常或 409/502/503/504/524 会自动转 status 轮询，不重复扣费
     · 模型：**只传 image2**。它是唯一有真实出图记录的档位（RTK 多次验收任务号）；
       9-13 新增的五档在目录里可选但零真实出图记录，写进来就会重演 9-16「假模型」事故。
       模型该由路由层按 capability 注入（43 §5.3），在台账补齐之前这里只认 image2。

   ⚠️ 本文件是纯函数：不碰 DOM、不发请求，便于门禁直接断言。 */

import { generationUnits } from '../services/imageModelCatalog.js';

/* 服务端唯一认得的四个视觉方向（server/visualCreationSkills.mjs:1） */
export const SERVER_VISUAL_SKILL_IDS = Object.freeze(['free', 'poster', 'social-cover', 'brand-kv']);

/* 唯一有真实出图记录的图片模型。换掉它之前，先拿出新的出图证据。 */
export const DEFAULT_IMAGE_MODEL = 'image2';
export const DEFAULT_RESOLUTION = '2K';

/* 字段 key → 服务端 ratio 的合法值（服务端不认的写法在这里就拦住，不让它静默回落） */
const LEGAL_RATIOS = new Set(['1:1', '3:4', '4:3', '9:16', '16:9', '21:9']);
const LEGAL_RESOLUTIONS = new Set(['1K', '2K', '4K']);

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/* 上传字段的值形状由 FieldRenderer 定义：只有 ready 且带 url 的条目才算数 */
export function readyUploads(value) {
  return (Array.isArray(value) ? value : []).filter(item => item && item.status === 'ready' && text(item.url));
}

/* ── ⓪ 初始值：声明里的默认值在这里落地 ──
   ⚠️ 唯一事实源。工作台的显示值、必填校验、下发参数全部基于它 ——
      三处各算一次的结果就是「按钮写着 2K、跑的是 1K」这类最难查的 bug。 */
export function initialSkillValues(skill) {
  const seed = {};
  for (const field of (skill && skill.fields) || []) {
    if (field.kind === 'stepper') { seed[field.key] = Number(field.min || 1); continue; }
    if (field.kind === 'segmented' || field.kind === 'select') {
      seed[field.key] = field.default ?? (field.options?.[0]?.value ?? '');
      continue;
    }
    seed[field.key] = field.kind === 'upload' ? [] : '';
  }
  return seed;
}

/* ── ① 必填校验：给工作台做「就近错误」，不是提交后才报错 ──
   校验对象是**生效值**（默认值 + 用户填的），否则带默认值的字段会被误判成没填。 */
export function validateSkillInput(skill, values = {}) {
  const effective = { ...initialSkillValues(skill), ...(values || {}) };
  values = effective;
  const missing = [];
  for (const field of (skill && skill.fields) || []) {
    if (!field.required) continue;
    if (field.kind === 'upload') {
      if (!readyUploads(values[field.key]).length) missing.push(field.label);
      continue;
    }
    if (field.kind === 'stepper') continue;   /* stepper 永远有值 */
    if (!text(values[field.key])) missing.push(field.label);
  }
  return { ok: missing.length === 0, missing };
}

/* ── ② 文案组装：把用户填的字段填进该 skill 自己的 brief 模板 ──
   brief 写在声明里（{{key}} 占位），所以新增 skill 仍然只需要加声明。 */
export function buildSkillBrief(skill, values = {}) {
  const template = text(skill && skill.brief);
  const filled = template.replace(/\{\{(\w+)\}\}/g, (_match, key) => text(values[key]));
  /* 未填的可选项会留下空档，压掉多余空白与空标点，避免把「主题：」这种半截话喂给模型 */
  return filled
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*[，。；：]\s*(?=[，。；：])/g, '')
    .replace(/\s+([，。；：])/g, '$1')
    .replace(/^[\s，。；：]+|[\s，。；：]+$/g, '')
    .trim();
}

/* ── ③ 图片：第一个上传位当主图（image_url），其余当参考图（reference_images）──
   服务端上限 9 张参考图；超出直接截断（服务端也会截，但我们在前端就截，免得用户以为多传了有用）。 */
export const MAX_REFERENCE_IMAGES = 9;

export function skillImages(skill, values = {}) {
  const slots = ((skill && skill.fields) || []).filter(field => field.kind === 'upload');
  const primary = slots[0] ? readyUploads(values[slots[0].key]) : [];
  /* fail-closed：主图没就绪就一张图都不给。
     半截素材只会生成出"看着像成功了、其实不是我要的"结果 —— 那是最难查的一类 bug。 */
  if (slots.length && slots[0].required && !primary.length) return { imageUrl: '', referenceImages: [], references: [] };
  const imageUrl = primary.length ? text(primary[0].url) : '';
  const referenceImages = [];
  const references = [];
  for (const field of slots.slice(1)) {
    for (const item of readyUploads(values[field.key])) {
      if (referenceImages.length >= MAX_REFERENCE_IMAGES) break;
      referenceImages.push(text(item.url));
      references.push({
        url: text(item.url),
        assetId: text(item.assetId),
        displayName: text(item.name),
        role: field.role || 'reference',
        order: referenceImages.length - 1,
      });
    }
  }
  /* 主图同时也是最有分量的参考图：把它放进 reference_metadata 让服务端知道来龙去脉 */
  if (imageUrl) {
    references.unshift({ url: imageUrl, assetId: text(primary[0].assetId), displayName: text(primary[0].name), role: slots[0].role || 'product', order: 0 });
  }
  return { imageUrl, referenceImages, references: references.slice(0, MAX_REFERENCE_IMAGES) };
}

/* ── ④ 生成参数：比例 / 清晰度 / 数量 / 模型 / 服务端视觉方向 ── */
export function skillGenerationSettings(skill, values = {}) {
  const ratio = text(values.ratio);
  const resolution = (text(values.clarity) || DEFAULT_RESOLUTION).toUpperCase();
  const count = Math.max(1, Math.min(9, Number.parseInt(values.count, 10) || 1));
  const visual = SERVER_VISUAL_SKILL_IDS.includes(skill && skill.visual) ? skill.visual : 'free';
  return {
    ratio: LEGAL_RATIOS.has(ratio) ? ratio : '1:1',
    resolution: LEGAL_RESOLUTIONS.has(resolution) ? resolution : DEFAULT_RESOLUTION,
    count,
    imageModel: DEFAULT_IMAGE_MODEL,
    visualSkillId: visual,
  };
}

/* ── ⑤ 积分预估：单位与后端 catalog 同源（1 积分 = 1000 units），只用于按钮上展示 ── */
export function skillPointsEstimate(skill, values = {}) {
  const { imageModel, resolution, count } = skillGenerationSettings(skill, values);
  const unitsPerImage = generationUnits(imageModel, resolution) || 0;
  return Number(((unitsPerImage * count) / 1000).toFixed(2));
}

/* ── ⑥ 组装成 regenerateCanvasImage 的入参（页面只调这一个函数）── */
export function buildSkillRequest(skill, values = {}, { runId = '', slotIndex = 0 } = {}) {
  const brief = buildSkillBrief(skill, values);
  const images = skillImages(skill, values);
  const settings = skillGenerationSettings(skill, values);
  return {
    prompt: brief,
    imageUrl: images.imageUrl,
    referenceImages: images.referenceImages,
    references: images.references,
    ratio: settings.ratio,
    resolution: settings.resolution,
    imageModel: settings.imageModel,
    creationIntent: 'visual',
    skillId: settings.visualSkillId,
    requestKey: runId ? runId + ':' + (slotIndex + 1) : '',
  };
}

/* 一键生成不了的 skill：走既有重流程（套图编排 / 小红书图文），工作台只负责带配置过去。
   这两条链路本身是多分钟内、多资产、带方案确认的流水线，硬塞进工作台只会做出一堆半成品。 */
export function isHandoffSkill(skill) {
  return ['ecommerceSuite', 'xhsNote'].includes(skill && skill.pipeline);
}
