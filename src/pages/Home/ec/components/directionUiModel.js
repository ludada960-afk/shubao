/**
 * directionUiModel.js
 * 设计方向卡片 UI 状态管理纯函数
 * 不包含任何副作用，不调用 API，不使用全局状态
 */

/**
 * 颜色对比度计算 - 基于相对亮度公式
 * @param {string} hex - 十六进制颜色值
 * @returns {number} 相对亮度值 0-1
 */
function getRelativeLuminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 1;

  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((val) => {
    const s = val / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * 十六进制转 RGB
 * @param {string} hex
 * @returns {{r: number, g: number, b: number} | null}
 */
function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  if (isNaN(bigint)) return null;

  if (clean.length === 3) {
    const r = (bigint >> 8) & 0xf;
    const g = (bigint >> 4) & 0xf;
    const b = bigint & 0xf;
    return {
      r: (r << 4) | r,
      g: (g << 4) | g,
      b: (b << 4) | b,
    };
  }

  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

/**
 * 标准化方向颜色 - 确保颜色格式正确并返回安全值
 * @param {string | null | undefined} color
 * @param {string} fallback - 回退颜色
 * @returns {string} 标准化后的十六进制颜色
 */
export function normalizeDirectionColor(color, fallback = '#7c3aed') {
  if (!color || typeof color !== 'string') return fallback;

  const clean = color.trim();
  if (!clean) return fallback;

  // 支持 #RGB 和 #RRGGBB 格式
  const hexMatch = clean.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hexMatch) {
    return `#${hexMatch[1].toLowerCase()}`;
  }

  // 尝试解析 rgb/rgba
  const rgbMatch = clean.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`;
  }

  return fallback;
}

/**
 * 计算可读文字颜色 - 基于背景色对比度
 * 返回黑色或白色以确保足够的对比度 (WCAG AA 标准)
 * @param {string} backgroundColor
 * @param {string} darkColor - 深色文字回退
 * @param {string} lightColor - 浅色文字回退
 * @returns {string} 推荐文字颜色
 */
export function getReadableTextColor(
  backgroundColor,
  darkColor = '#1a1a1a',
  lightColor = '#ffffff'
) {
  const normalized = normalizeDirectionColor(backgroundColor, '#ffffff');
  const luminance = getRelativeLuminance(normalized);

  // 亮度阈值 0.5，确保对比度
  return luminance > 0.5 ? darkColor : lightColor;
}

/**
 * 判断键盘事件是否应该激活方向卡片。编辑区域内的空格和回车属于文本输入，
 * 不能冒泡成卡片选择。
 */
export function shouldActivateDirection({ key, withinEditableArea = false } = {}) {
  if (withinEditableArea) return false;
  return key === 'Enter' || key === ' ';
}

/**
 * 获取方向卡片状态 - 包含颜色、选中状态样式等
 * @param {Object} params
 * @param {Object} params.direction - 方向数据对象
 * @param {boolean} params.selected - 是否选中
 * @param {number} params.index - 卡片索引
 * @returns {Object} 卡片状态对象
 */
export function getDirectionCardState({ direction, selected, index }) {
  const rawColors = direction?.preview_colors || [];

  // 预览色可以很浅，但选择边框必须始终清晰可见。
  const visualPrimaryColor = normalizeDirectionColor(rawColors[0], '#7c3aed');
  const secondaryColor = normalizeDirectionColor(rawColors[1], '#a78bfa');
  const accentCandidate = getRelativeLuminance(visualPrimaryColor) <= 0.78
    ? visualPrimaryColor
    : secondaryColor;
  const primaryColor = getRelativeLuminance(accentCandidate) <= 0.78
    ? accentCandidate
    : '#7c3aed';

  // 计算文字颜色确保对比度
  const primaryTextColor = getReadableTextColor(primaryColor);
  const cardTextColor = '#1a1a1a'; // 卡片内文字固定深色

  // 生成渐变背景
  const gradientColors = rawColors.slice(0, 4).length >= 2
    ? rawColors.slice(0, 4).map(c => normalizeDirectionColor(c)).join(', ')
    : `${primaryColor}, ${secondaryColor}`;

  return {
    index,
    selected,
    colors: {
      primary: primaryColor,
      secondary: secondaryColor,
      gradient: gradientColors,
      primaryText: primaryTextColor,
      cardText: cardTextColor,
    },
    styles: {
      border: selected ? `2px solid ${primaryColor}` : '2px solid rgba(0,0,0,0.06)',
      background: selected ? `${primaryColor}08` : '#ffffff',
      boxShadow: selected
        ? `0 4px 20px ${primaryColor}30`
        : '0 2px 8px rgba(0,0,0,0.04)',
      headerGradient: `linear-gradient(90deg, ${gradientColors})`,
    },
    // 编辑区域样式
    editableStyles: {
      default: {
        border: '1px solid transparent',
        background: 'transparent',
      },
      hover: {
        border: `1px solid ${primaryColor}40`,
        background: `${primaryColor}08`,
      },
      focus: {
        border: `2px solid ${primaryColor}`,
        background: '#ffffff',
        boxShadow: `0 0 0 3px ${primaryColor}20`,
      },
    },
  };
}

/**
 * 标准化方向标签 - 处理视觉调性标签
 * @param {string | string[] | null | undefined} tags
 * @param {Object} options
 * @param {number} options.maxCount - 最大标签数量
 * @param {string} options.delimiter - 分隔符
 * @returns {string[]} 标准化后的标签数组
 */
export function normalizeDirectionTags(
  tags,
  { maxCount = 3, delimiter = /[·/、,，\s]+/ } = {}
) {
  if (!tags) return [];

  let tagArray = [];

  if (typeof tags === 'string') {
    tagArray = tags
      .split(delimiter)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  } else if (Array.isArray(tags)) {
    tagArray = tags
      .map((t) => (typeof t === 'string' ? t.trim() : String(t)))
      .filter((t) => t.length > 0);
  }

  return tagArray.slice(0, maxCount);
}

/**
 * 验证方向数据结构
 * @param {Object} direction
 * @returns {boolean}
 */
export function isValidDirection(direction) {
  if (!direction || typeof direction !== 'object') {
    return false;
  }
  return (
    typeof direction.id === 'string' &&
    typeof direction.title === 'string'
  );
}

/**
 * 获取方向编辑状态
 * @param {Object} params
 * @param {string} params.description - 当前描述
 * @param {string} params.originalDescription - 原始描述
 * @returns {Object} 编辑状态
 */
export function getDirectionEditState({ description, originalDescription }) {
  const hasChanged = description !== originalDescription;
  const isEmpty = !description || description.trim().length === 0;
  const charCount = description?.length || 0;

  return {
    hasChanged,
    isEmpty,
    charCount,
    canSave: !isEmpty && charCount <= 500,
    isOverLimit: charCount > 500,
  };
}

const SAFE_DIRECTION_ROLES = new Set([
  'white_background',
  'white_bg',
  'main',
  'main_text',
  'main_3x4',
  'transparent',
  'sku',
  'detail',
]);

function safeDirectionText(value, maxLength = 600) {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  if (!text || ['__proto__', 'constructor', 'prototype'].includes(text.toLowerCase())) return '';
  return text.slice(0, maxLength);
}

function safeDirectionRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function safeDirectionCount(value) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.min(20, Math.trunc(count))) : 0;
}

/**
 * Returns the decision-level information a merchant needs before selecting a
 * direction. The visual details stay separate from the editable execution
 * guide so a text edit cannot silently change the requested image package.
 */
export function getDirectionPlanSummary(direction = {}) {
  const source = safeDirectionRecord(direction);
  const strategy = safeDirectionRecord(source.product_strategy || source.productStrategy);
  const strategyFields = [
    ['hero_focus', 'heroFocus', '核心主张'],
    ['angle_plan', 'anglePlan', '视角计划'],
    ['interaction_plan', 'interactionPlan', '使用关系'],
    ['scenario_plan', 'scenarioPlan', '场景计划'],
  ];
  const strategyItems = strategyFields.flatMap(([snakeKey, camelKey, label]) => {
    const value = safeDirectionText(strategy[snakeKey] ?? strategy[camelKey]);
    return value ? [{ key: snakeKey, label, value }] : [];
  });
  return {
    commercialObjective: safeDirectionText(
      source.commercial_objective ?? source.commercialObjective ?? source.objective,
    ),
    audience: safeDirectionText(source.audience ?? source.target_audience),
    strategyItems,
  };
}

/** Normalizes the configured output groups without inventing missing assets. */
export function getDirectionDeliverableGroups(direction = {}) {
  const source = safeDirectionRecord(direction);
  const groups = Array.isArray(source.deliverables) ? source.deliverables : [];
  return groups.flatMap((value) => {
    const group = safeDirectionRecord(value);
    const role = safeDirectionText(group.role ?? group.key, 48).toLowerCase();
    const count = safeDirectionCount(group.count);
    if (!SAFE_DIRECTION_ROLES.has(role) || count <= 0) return [];
    const label = safeDirectionText(group.label ?? group.name, 60) || '商品图片';
    return [{
      role,
      label,
      count,
      ratio: safeDirectionText(group.ratio, 24),
      strategy: safeDirectionText(group.group_strategy ?? group.groupStrategy ?? group.strategy),
    }];
  });
}

/** Provides a compact but complete disclosure of the exact requested suite. */
export function summarizeDirectionDeliverables(direction = {}) {
  return getDirectionDeliverableGroups(direction)
    .map(group => `${group.count}${group.label}`)
    .join(' / ');
}

/** Flattens the model's shot manifest for the expandable second-step preview. */
export function getDirectionShotRows(direction = {}) {
  const source = safeDirectionRecord(direction);
  const rawGroups = Array.isArray(source.deliverables) ? source.deliverables : [];
  const normalizedGroups = getDirectionDeliverableGroups(source);
  const groupByRole = new Map(normalizedGroups.map(group => [group.role, group]));
  const rows = [];
  for (const rawValue of rawGroups) {
    const rawGroup = safeDirectionRecord(rawValue);
    const role = safeDirectionText(rawGroup.role ?? rawGroup.key, 48).toLowerCase();
    const group = groupByRole.get(role);
    if (!group) continue;
    const shots = Array.isArray(rawGroup.shots) ? rawGroup.shots : [];
    shots.slice(0, group.count).forEach((rawShot, index) => {
      const shot = safeDirectionRecord(rawShot);
      const label = safeDirectionText(shot.label ?? shot.title ?? shot.name, 100);
      if (!label) return;
      rows.push({
        id: `${role}-${index}`,
        role,
        groupLabel: group.label,
        ratio: group.ratio,
        index,
        label,
        purpose: safeDirectionText(shot.purpose ?? shot.objective, 300),
        visualExecution: safeDirectionText(
          shot.visual_execution ?? shot.visualExecution ?? shot.execution,
          600,
        ),
      });
    });
  }
  return rows;
}
