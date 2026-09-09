import { getSkillList } from '../ecommerceEngine/styleSkills.mjs';
import { listVideoSkillTemplates } from '../videoSkillTemplates.mjs';

/**
 * 统一的内置 Skill 目录（2026-09-10）
 *
 * 目的：把此前分散在 5 处的"技能类"资产收敛成同一个只读视图，前端一套 UI 展示。
 * 内置 skill 是代码常量（随发布版本走），不入库、用户不可删改，只能选择或"派生"。
 */
export const SKILL_CATALOG_SCHEMA_VERSION = 1;

const IMAGE_STYLE_SUMMARY = Object.freeze({
  premium_minimal: '克制留白、材质优先，适合高客单与品牌感商品',
  lifestyle_scene: '真实生活场景，自然光与使用关系，适合种草与详情页',
  fashion_editorial: '杂志级时装光影与版式，适合服饰、鞋包与配饰',
  warm_natural: '暖调自然光与柔和色彩，适合家居、食品与母婴',
  tech_precision: '冷色精密光影与结构证据，适合数码、家电与工具',
});

function builtinImageSkills() {
  return getSkillList().map(skill => ({
    id: `builtin:image:${skill.key}`,
    scope: 'builtin',
    kind: 'image',
    key: skill.key,
    name: skill.name,
    summary: IMAGE_STYLE_SUMMARY[skill.key] || '',
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
