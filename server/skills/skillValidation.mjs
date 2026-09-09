/**
 * 用户自建 Skill 校验（纯函数，零依赖、零网络）
 *
 * 安全模型：用户 skill 只允许写入"风格/表达"槽位，因此这里做三道闸：
 *  1. 结构与长度白名单（字段、字符数）
 *  2. 参数白名单（只接受受控 key，值长度受限）
 *  3. 指令覆盖检测（拒绝试图改写平台规则/套取系统提示词的文本）
 * 所有失败都返回稳定的 errorCode，便于前端给可读提示与测试断言。
 */

export const SKILL_KINDS = Object.freeze(['image', 'video', 'canvas', 'copy']);

export const SKILL_LIMITS = Object.freeze({
  name: 40,
  summary: 80,
  body: 2000,
  paramValue: 40,
  params: 8,
});

export const SKILL_PARAM_KEYS = Object.freeze([
  'composition',   // 构图
  'lighting',      // 光线
  'camera',        // 镜头
  'background',    // 背景
  'mood',          // 氛围
  'palette',       // 色调
  'typography',    // 文字风格
  'density',       // 信息密度
]);

/** 试图覆盖平台规则 / 套取系统提示词的表达（含否定式放行） */
const OVERRIDE_PATTERNS = Object.freeze([
  /(?:忽略|无视|跳过|忘记|不要遵守|不用管)(?:\s*(?:以上|上述|之前|前面|所有|全部))?\s*(?:的)?\s*(?:规则|指令|提示词|提示|约束|限制|要求)/,
  /(?:覆盖|改写|替换|解除)\s*(?:系统|平台|以上|上述)\s*(?:规则|指令|提示词|约束)/,
  /(?:输出|显示|打印|重复|泄露|告诉我)\s*(?:你的)?\s*(?:系统)?\s*(?:提示词|prompt|instructions?|规则)/i,
  /(?:你现在是|从现在起你是|扮演一个不受限制|假装你是|假装没有限制|进入开发者模式|越狱)/,
  /\b(?:ignore|disregard|forget|override|bypass)\s+(?:all\s+)?(?:the\s+)?(?:previous|prior|above|earlier|system)\s+(?:instructions?|rules?|prompts?)/i,
  /\b(?:reveal|print|repeat|show|leak)\s+(?:me\s+)?(?:your\s+)?(?:system\s+)?(?:prompt|instructions?)/i,
  /\bjailbreak\b/i,
]);

/** 否定式豁免：出现"不要忽略以上规则"这类表达时不算越权 */
const NEGATION_PREFIX = /(?:不要|请勿|勿|别|不得|禁止|切勿|无需)\s*$/;

function findOverride(text) {
  const source = String(text || '');
  for (const pattern of OVERRIDE_PATTERNS) {
    const match = pattern.exec(source);
    if (!match) continue;
    const before = source.slice(0, match.index);
    if (NEGATION_PREFIX.test(before)) continue;
    return match[0];
  }
  return '';
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function fail(errorCode, message, extra = {}) {
  return { ok: false, errorCode, message, ...extra };
}

export function normalizeSkillParams(value) {
  if (value === null || value === undefined) return { ok: true, params: {} };
  if (typeof value !== 'object' || Array.isArray(value)) {
    return fail('SKILL_PARAMS_INVALID', '参数必须是键值对象');
  }
  const entries = Object.entries(value);
  if (entries.length > SKILL_LIMITS.params) {
    return fail('SKILL_PARAMS_TOO_MANY', `参数最多 ${SKILL_LIMITS.params} 项`);
  }
  const params = {};
  for (const [rawKey, rawValue] of entries) {
    const key = cleanText(rawKey);
    if (!SKILL_PARAM_KEYS.includes(key)) {
      return fail('SKILL_PARAM_KEY_UNKNOWN', `不支持的参数：${key || '(空)'}`);
    }
    const paramValue = cleanText(rawValue);
    if (!paramValue) continue;
    if (paramValue.length > SKILL_LIMITS.paramValue) {
      return fail('SKILL_PARAM_VALUE_TOO_LONG', `参数 ${key} 过长`);
    }
    params[key] = paramValue;
  }
  return { ok: true, params };
}

/**
 * 校验一份用户 skill 输入。
 * @returns {{ok:true, skill:{kind,name,summary,body,params}} | {ok:false,errorCode:string,message:string,field?:string}}
 */
export function validateUserSkill(input = {}) {
  const kind = cleanText(input.kind);
  if (!SKILL_KINDS.includes(kind)) {
    return fail('SKILL_KIND_INVALID', '请选择技能类型', { field: 'kind' });
  }
  const name = cleanText(input.name);
  if (!name) return fail('SKILL_NAME_REQUIRED', '请填写模块名称', { field: 'name' });
  if (name.length > SKILL_LIMITS.name) {
    return fail('SKILL_NAME_TOO_LONG', `模块名称最多 ${SKILL_LIMITS.name} 字`, { field: 'name' });
  }
  const summary = cleanText(input.summary);
  if (summary.length > SKILL_LIMITS.summary) {
    return fail('SKILL_SUMMARY_TOO_LONG', `模块简介最多 ${SKILL_LIMITS.summary} 字`, { field: 'summary' });
  }
  const body = typeof input.body === 'string' ? input.body.trim() : '';
  if (!body) return fail('SKILL_BODY_REQUIRED', '请填写技能提示词', { field: 'body' });
  if (body.length > SKILL_LIMITS.body) {
    return fail('SKILL_BODY_TOO_LONG', `技能提示词最多 ${SKILL_LIMITS.body} 字`, { field: 'body' });
  }
  const override = findOverride(body);
  if (override) {
    return fail('SKILL_OVERRIDE_REJECTED', '技能提示词不能要求改写或忽略平台规则，请改成描述画面与风格', { field: 'body', matched: override });
  }
  const params = normalizeSkillParams(input.params);
  if (!params.ok) return params;
  return { ok: true, skill: { kind, name, summary, body, params: params.params } };
}
