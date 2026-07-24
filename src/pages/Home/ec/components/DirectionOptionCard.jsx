import React, { useState, useRef, useCallback } from 'react';
import { MdCheck, MdEdit } from 'react-icons/md';
import {
  getDirectionCardState,
  normalizeDirectionTags,
  getReadableTextColor,
  normalizeDirectionColor,
} from './directionUiModel';

/**
 * DirectionOptionCard - 设计方向选择卡片
 *
 * 纯展示、受控组件，不调用 API，不使用全局状态
 *
 * @param {Object} props
 * @param {Object} props.direction - 方向数据对象
 * @param {string} props.direction.id - 方向唯一标识
 * @param {string} props.direction.title - 方案标题（只读）
 * @param {string} [props.direction.one_liner] - 方案定位（只读）
 * @param {string} [props.direction.visual_tone] - 视觉调性标签（只读）
 * @param {string} [props.direction.short_desc] - 简短描述（只读）
 * @param {string} [props.direction.description] - 完整描述（只读）
 * @param {string} [props.direction.execution_guide] - 方案执行说明（可编辑）
 * @param {string[]} [props.direction.preview_colors] - 预览配色
 * @param {number} props.index - 卡片索引
 * @param {boolean} props.selected - 是否选中
 * @param {Function} props.onSelect - 选择回调 (index) => void
 * @param {string} [props.editableDescription] - 可编辑的描述文本
 * @param {Function} [props.onDescriptionChange] - 描述变化回调 (value) => void
 */
export default function DirectionOptionCard({
  direction,
  index,
  selected,
  onSelect,
  editableDescription = '',
  onDescriptionChange,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const textareaRef = useRef(null);

  // 获取卡片状态
  const cardState = getDirectionCardState({ direction, selected, index });
  const { colors, styles, editableStyles } = cardState;

  // 处理标签
  const tags = normalizeDirectionTags(direction?.visual_tone);

  // 处理选择 - 点击编辑区时不触发
  const handleCardClick = useCallback(
    (e) => {
      // 如果点击的是编辑区域或其子元素，不触发选择
      if (e.target.closest('[data-editable-area]')) {
        return;
      }
      onSelect?.(index);
    },
    [index, onSelect]
  );

  // 处理键盘选择
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect?.(index);
      }
    },
    [index, onSelect]
  );

  // 编辑区聚焦
  const handleEditFocus = () => {
    setIsEditing(true);
  };

  // 编辑区失焦
  const handleEditBlur = () => {
    setIsEditing(false);
  };

  // 编辑区变化
  const handleEditChange = (e) => {
    onDescriptionChange?.(e.target.value);
  };

  // 计算当前编辑区样式
  const getEditAreaStyle = () => {
    if (isEditing) {
      return editableStyles.focus;
    }
    if (isHovered) {
      return editableStyles.hover;
    }
    return editableStyles.default;
  };

  const editAreaStyle = getEditAreaStyle();

  return (
    <div
      role="radio"
      aria-checked={selected}
      aria-label={`方案 ${index + 1}: ${direction?.title || ''}`}
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: styles.background,
        borderRadius: 16,
        padding: 0,
        cursor: 'pointer',
        overflow: 'hidden',
        border: styles.border,
        boxShadow: styles.boxShadow,
        transition: 'all 0.2s ease',
        position: 'relative',
        outline: 'none',
      }}
    >
      {/* 顶部渐变条 */}
      <div
        style={{
          height: 8,
          background: styles.headerGradient,
        }}
      />

      <div style={{ padding: '16px 18px' }}>
        {/* 标题行 + 选中标记 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 800,
              color: colors.cardText,
              lineHeight: 1.3,
            }}
          >
            {direction?.title}
          </h3>

          {/* 选中状态指示器 */}
          {selected && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: colors.primary,
                }}
              >
                已选择
              </span>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: colors.primary,
                  color: getReadableTextColor(colors.primary),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <MdCheck size={14} />
              </div>
            </div>
          )}
        </div>

        {/* 一句话定位 */}
        {direction?.one_liner && (
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: colors.primary,
              marginBottom: 8,
              padding: '4px 10px',
              background: `${colors.primary}10`,
              borderRadius: 8,
              display: 'inline-block',
            }}
          >
            {direction.one_liner}
          </div>
        )}

        {/* 视觉调性标签 */}
        {tags.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: 4,
              flexWrap: 'wrap',
              marginBottom: 10,
            }}
          >
            {tags.map((tag, j) => (
              <span
                key={j}
                style={{
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: selected
                    ? `${colors.primary}12`
                    : 'rgba(0,0,0,0.03)',
                  fontSize: 10,
                  fontWeight: 600,
                  color: selected ? colors.primary : 'var(--text-muted, #666)',
                  transition: 'all 0.15s',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* 简短描述 */}
        {(direction?.short_desc || direction?.description) && (
          <p
            style={{
              margin: 0,
              fontSize: 12,
              lineHeight: 1.5,
              color: 'var(--text-secondary, #666)',
              marginBottom: 12,
            }}
          >
            {direction?.short_desc ||
              direction?.description?.slice(0, 80) +
                (direction?.description?.length > 80 ? '...' : '')}
          </p>
        )}

        {/* 可编辑区域 - 方案执行说明 */}
        {onDescriptionChange && (
          <div
            data-editable-area
            style={{
              marginTop: 12,
              padding: '10px 12px',
              borderRadius: 10,
              transition: 'all 0.15s ease',
              ...editAreaStyle,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 6,
              }}
            >
              <MdEdit
                size={14}
                style={{
                  color: isEditing ? colors.primary : 'var(--text-muted, #999)',
                  transition: 'color 0.15s',
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: isEditing
                    ? colors.primary
                    : 'var(--text-muted, #999)',
                  transition: 'color 0.15s',
                }}
              >
                方案执行说明
              </span>
              {!isEditing && (
                <span
                  style={{
                    fontSize: 10,
                    color: 'var(--text-muted, #999)',
                    marginLeft: 'auto',
                  }}
                >
                  点击编辑
                </span>
              )}
            </div>
            <textarea
              ref={textareaRef}
              value={editableDescription}
              onChange={handleEditChange}
              onFocus={handleEditFocus}
              onBlur={handleEditBlur}
              onClick={(e) => e.stopPropagation()}
              placeholder="补充或修改方案执行细节..."
              style={{
                width: '100%',
                minHeight: 60,
                padding: 0,
                border: 'none',
                background: 'transparent',
                fontSize: 12,
                lineHeight: 1.6,
                color: colors.cardText,
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
                cursor: 'text',
              }}
            />
          </div>
        )}

        {/* 配色预览 */}
        {direction?.preview_colors?.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: 6,
              marginTop: 12,
              alignItems: 'center',
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: '#999',
                marginRight: 4,
              }}
            >
              配色:
            </span>
            {direction.preview_colors.slice(0, 5).map((c, j) => (
              <div
                key={j}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: normalizeDirectionColor(c),
                  border: '2px solid #fff',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
