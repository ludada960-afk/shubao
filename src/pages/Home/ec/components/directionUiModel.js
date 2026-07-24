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
 * 获取方向卡片状态 - 包含颜色、选中状态样式等
 * @param {Object} params
 * @param {Object} params.direction - 方向数据对象
 * @param {boolean} params.selected - 是否选中
 * @param {number} params.index - 卡片索引
 * @returns {Object} 卡片状态对象
 */
export function getDirectionCardState({ direction, selected, index }) {
  const rawColors = direction?.preview_colors || [];

  // 获取主色和辅色
  const primaryColor = normalizeDirectionColor(
    rawColors[0],
    '#7c3aed'
  );
  const secondaryColor = normalizeDirectionColor(
    rawColors[1],
    '#a78bfa'
  );

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
