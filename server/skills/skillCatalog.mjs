import { getSkillList, getSkillByKey, buildSkillDescription, STYLE_SKILL_DEFS } from '../ecommerceEngine/styleSkills.mjs';
import { listVideoSkillTemplates } from '../videoSkillTemplates.mjs';

/**
 * 统一的内置 Skill 目录（2026-09-10）
 *
 * 目的：把此前分散在 5 处的"技能类"资产收敛成同一个只读视图，前端一套 UI 展示。
 * 内置 skill 是代码常量（随发布版本走），不入库、用户不可删改，只能选择或"派生"。
 * 2026-09-10（用户反馈）：内置技能必须带完整提示词正文——否则用户点"派生"拿到的是空壳，
 * 不知道这个技能到底会怎么画。正文从内置风格包的真实参数生成，保证"所派生即所得"。
 */
export const SKILL_CATALOG_SCHEMA_VERSION = 2;

const IMAGE_STYLE_SUMMARY = Object.freeze({
  premium_minimal: '克制留白、材质优先，适合高客单与品牌感商品',
  lifestyle_scene: '真实生活场景，自然光与使用关系，适合种草与详情页',
  fashion_editorial: '杂志级时装光影与版式，适合服饰、鞋包与配饰',
  warm_natural: '暖调自然光与柔和色彩，适合家居、食品与母婴',
  tech_precision: '冷色精密光影与结构证据，适合数码、家电与工具',
});

/** 把内置风格包的参数翻译成用户可读、可编辑的提示词正文（与实际注入参数同源） */
function builtinImageBody(key) {
  const skill = getSkillByKey(key);
  if (!skill || !skill.campaignLock) return '';
  const description = buildSkillDescription(key);
  const lines = [
    `- 模块名: ${skill.name}`,
    `- 风格基调: ${skill.desc || ''}`,
    '',
    '【画面方向】',
    description.replace(/^STYLE DIRECTION: /m, '- 视觉方向: ').replace(/^LIGHTING: /m, '- 光线: ').replace(/^COLOR: /m, '- 色彩: ').replace(/^COMPOSITION: /m, '- 构图: '),
    '',
    '【通用约束】',
    '- 保持商品结构与材质真实，不改变商品的数量、比例与颜色',
    '- 画面干净克制，不添加与商品无关的装饰元素',
    '- 不得出现拼贴、多图拼接或画中画构图',
  ];
  return lines.join('\n');
}

function builtinVideoBody(templateId) {
  const templates = {
    'product-ad-v1': [
      '- 模块名: 商品广告短片',
      '- 画面任务: 从商品素材出发，产出一条 5-15 秒的可投放广告短片',
      '- 镜头结构: 开场 0-2s 建立商品第一印象 → 中段 3-10s 展示核心卖点与使用场景 → 结尾 2s 收束到品牌/购买理由',
      '- 镜头候选: 每个段落先给 2-3 个候选镜头（角度/景别/运动方式），确认后进时间线',
      '- 商品呈现: 商品在画面中的比例、角度、颜色与真实素材一致，不虚构功能与配件',
      '- 交付: 镜头清单 + 时间线 + 每镜头画面描述，确认后再生成',
    ].join('\n'),
    'reference-video-reconstruction-v1': [
      '- 模块名: 参考视频同款重建',
      '- 画面任务: 分析参考视频的镜头结构、节奏与转场方式，用自有素材重建同款',
      '- 分析维度: 镜头数量、每镜头时长、景别与运动、转场类型、情绪节奏',
      '- 重建原则: 只复用"结构与节奏"，画面内容全部来自用户自有素材，不复制原视频的受版权保护元素',
      '- 交付: 参考视频结构表 + 自有素材映射表 + 重建时间线，确认后再生成',
    ].join('\n'),
  };
  return templates[templateId] || '';
}

function builtinImageSkills() {
  return getSkillList().map(skill => ({
    id: `builtin:image:${skill.key}`,
    scope: 'builtin',
    kind: 'image',
    key: skill.key,
    name: skill.name,
    summary: IMAGE_STYLE_SUMMARY[skill.key] || '',
    body: builtinImageBody(skill.key),
    editable: false,
  }));
}

const VIDEO_SUMMARY = Object.freeze({
  'product-ad-v1': '从商品素材到成片的广告短片工作流，含镜头候选与时间线确认',
  'reference-video-reconstruction-v1': '分析参考视频的镜头结构，用自有素材重建同款节奏',
});

function builtinVideoSkills() {
  return listVideoSkillTemplates().map(template => ({
    id: `builtin:video:${template.templateId}`,
    scope: 'builtin',
    kind: 'video',
    key: template.templateId,
    name: template.title,
    summary: template.summary || template.description || VIDEO_SUMMARY[template.templateId] || '',
    body: builtinVideoBody(template.templateId),
    editable: false,
  }));
}

/** 内置目录按类型返回；未知类型返回空数组（前端按 Tab 拉取） */
export function listBuiltinSkills(kind = '') {
  const all = [...builtinImageSkills(), ...builtinVideoSkills()];
  const normalized = String(kind || '').trim();
  return normalized ? all.filter(skill => skill.kind === normalized) : all;
}

export function getBuiltinSkill(id) {
  return listBuiltinSkills().find(skill => skill.id === String(id || '')) || null;
}
