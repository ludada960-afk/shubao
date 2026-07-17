/**
 * 薯包AI v4 Agent 模式自动决策引擎
 *
 * 全自动判断用户输入、选择合适的 Skill 包、设定所有参数。
 * 用户零操作，一句话出图。
 */

import { recommendSkill, getSkillList } from './styleSkills.mjs';
import { getCategoryInfo, getGenStrategy } from './categoryKnowledge.mjs';
import { getInputMode } from './vlmSchema.mjs';

// ============================================================
// 输入类型判断
// ============================================================

/**
 * @typedef {'empty'|'short_text'|'long_text'|'has_real_shot'|'has_style_ref'|'has_both'|'has_text_and_images'} InputType
 */

/**
 * 判断用户输入类型
 * @param {string} text - 用户输入的文本
 * @param {string[]} realShots - 实拍图
 * @param {string[]} styleRefs - 风格参考图
 * @returns {InputType}
 */
function classifyInput(text, realShots = [], styleRefs = []) {
  const hasReal = realShots.length > 0;
  const hasStyle = styleRefs.length > 0;
  const hasText = text && text.trim().length > 0;
  const isLong = hasText && text.trim().length >= 80;

  if (hasReal && hasStyle) return 'has_both';
  if (hasReal && hasText) return 'has_text_and_images';
  if (hasReal) return 'has_real_shot';
  if (hasStyle && hasText) return 'has_text_and_images';
  if (hasStyle) return 'has_style_ref';
  if (isLong) return 'long_text';
  if (hasText) return 'short_text';
  return 'empty';
}

// ============================================================
// 自动决策
// ============================================================

/**
 * @typedef {Object} AgentDecision
 * @property {string} styleSkill     - 选中的 Style Skill key
 * @property {string} category       - 推断的品类
 * @property {number} productFidelity - 产品保真权重
 * @property {number} styleTransfer   - 风格迁移权重
 * @property {number} creativity      - 创意度
 * @property {string[]} imageTypes    - 图片类型列表
 * @property {number[]} imageCounts   - 各类型的数量
 * @property {Object} qualityConfig   - 质检配置
 * @property {boolean} qualityConfig.enabled
 * @property {boolean} qualityConfig.autoRegen
 * @property {number} postProcess     - 后处理等级 0/1/2
 */

/**
 * 根据输入自动决策全套参数
 * @param {string} text
 * @param {string[]} realShots
 * @param {string[]} styleRefs
 * @param {Object} [options]
 * @param {string} [options.forcedCategory] - 用户指定的品类
 * @returns {AgentDecision}
 */
function decide(text = '', realShots = [], styleRefs = [], options = {}) {
  const inputType = classifyInput(text, realShots, styleRefs);

  // 根据品类和输入类型决策
  const category = options.forcedCategory || inferCategory(text, realShots);
  const skillKey = recommendSkill(category);
  const genStrategy = getGenStrategy(category);

  // 默认决策
  const decision = {
    styleSkill: skillKey,
    category,
    realShots,
    styleRefs,
    productFidelity: 0.85,
    styleTransfer: 0.65,
    creativity: 0.3,
    imageTypes: genStrategy.preferWhiteBg
      ? ['white_bg', 'main_text', 'main_3x4', 'transparent']
      : ['main_text', 'main_3x4', 'transparent'],
    imageCounts: genStrategy.preferWhiteBg ? [1, 5, 5, 1] : [5, 5, 1],
    detailSlices: genStrategy.detailSlices || ['feature'],
    showSKU: genStrategy.showSKU,
    qualityConfig: {
      enabled: true,
      autoRegen: true,
    },
    postProcess: 1,
  };

  // 根据输入类型微调
  switch (inputType) {
    case 'empty':
      // 无法处理
      break;

    case 'short_text':
      // 简短描述 → 标准出图，高创意
      decision.creativity = 0.4;
      break;

    case 'long_text':
      // 长描述 → 低创意外推 (用户描述很详细)
      decision.creativity = 0.2;
      decision.productFidelity = 0.9;
      break;

    case 'has_real_shot':
      // 有实拍图 → 高保真
      decision.productFidelity = 0.9;
      decision.creativity = 0.25;
      break;

    case 'has_style_ref':
      // 有风格参考 → 中等迁移
      decision.styleTransfer = 0.7;
      decision.creativity = 0.35;
      break;

    case 'has_both':
      // 双图 → 平衡
      decision.productFidelity = 0.85;
      decision.styleTransfer = 0.7;
      decision.creativity = 0.3;
      break;

    case 'has_text_and_images':
      // 文本 + 图 → 文本主导，图作为参考
      if (realShots.length > 0 && styleRefs.length === 0) {
        decision.productFidelity = 0.9;
      } else if (styleRefs.length > 0 && realShots.length === 0) {
        decision.styleTransfer = 0.75;
      }
      break;
  }

  return decision;
}

/**
 * 从文本和实拍图推断品类 (简易版)
 * @param {string} text
 * @param {string[]} realShots
 * @returns {string}
 */
function inferCategory(text, realShots) {
  // 关键词匹配 (无 LLM 时的 fallback)
  const keywords = {
    '美妆护肤': ['护肤', '面霜', '精华', '口红', '粉底', '眼影', '腮红', '化妆', '美容', '防晒', '面膜', '洁面'],
    '数码3C': ['耳机', '蓝牙', '手机', '充电', '平板', '电脑', '键盘', '鼠标', '音箱', '手表', '智能', '数码'],
    '食品饮料': ['食品', '零食', '饮料', '茶', '咖啡', '酒', '牛奶', '巧克力', '饼干', '坚果', '调味', '粮油'],
    '服饰穿搭': ['衣服', 'T恤', '衬衫', '裙子', '裤子', '鞋子', '包', '帽子', '围巾', '穿搭', '时装', '运动鞋'],
    '家居生活': ['家居', '家具', '收纳', '杯子', '碗', '盘子', '花瓶', '灯具', '地毯', '窗帘', '床品', '厨房'],
    '母婴用品': ['母婴', '婴儿', '宝宝', '奶瓶', '尿不湿', '玩具', '童装', '推车', '儿童', '孕妇'],
    '宠物用品': ['宠物', '猫', '狗', '猫粮', '狗粮', '宠物玩具', '猫砂', '狗窝'],
  };

  const textLower = text.toLowerCase();
  let bestMatch = '其他';
  let maxScore = 0;

  for (const [cat, words] of Object.entries(keywords)) {
    const score = words.reduce((sum, w) => sum + (textLower.includes(w) ? 1 : 0), 0);
    if (score > maxScore) {
      maxScore = score;
      bestMatch = cat;
    }
  }

  // 如果有实拍图且文本匹配度低，使用 VLM 会识别得更准
  return bestMatch;
}

/**
 * 用 LLM 做智能品类识别和参数推荐 (需要 LLM API)
 * @param {string} text
 * @param {string[]} realShotUrls
 * @returns {Promise<Object>}
 */
async function smartDecide(text, realShotUrls = []) {
  // 预留：当 LLM API 可用时，用 LLM 做更精准的识别
  // 当前 fallback 到关键词匹配
  return decide(text, realShotUrls, []);
}
