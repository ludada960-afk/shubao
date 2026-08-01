import React, { useState, useCallback } from 'react';
import { MdCheck, MdEdit, MdExpandLess, MdExpandMore } from 'react-icons/md';
import {
  getDirectionCardState,
  getDirectionDeliverableGroups,
  getDirectionPlanSummary,
  getDirectionShotRows,
  normalizeDirectionTags,
  getReadableTextColor,
  normalizeDirectionColor,
  shouldActivateDirection,
  summarizeDirectionDeliverables,
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
  const [isPlanExpanded, setIsPlanExpanded] = useState(false);

  // 获取卡片状态
  const cardState = getDirectionCardState({ direction, selected, index });
  const { colors, styles, editableStyles } = cardState;

  // 处理标签
  const tags = normalizeDirectionTags(direction?.visual_tone);
  const planSummary = getDirectionPlanSummary(direction);
  const deliverableGroups = getDirectionDeliverableGroups(direction);
  const shotRows = getDirectionShotRows(direction);
  const deliverableSummary = summarizeDirectionDeliverables(direction);

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
      const withinEditableArea = Boolean(e.target.closest?.('[data-editable-area]'));
      if (!shouldActivateDirection({ key: e.key, withinEditableArea })) return;
      e.preventDefault();
      onSelect?.(index);
    },
    [index, onSelect]
  );

  // 编辑区聚焦
  const handleEditFocus = () => {
    setIsEditing(true);
    onSelect?.(index);
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
        borderRadius: 8,
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
      {/* 顶部方案色条 */}
      <div
        style={{
          height: 5,
          background: styles.headerGradient,
        }}
      />

      <div style={{ padding: '16px 18px 18px' }}>
        {/* 标题行 + 选中标记 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: 15,
                fontWeight: 800,
                color: colors.cardText,
                lineHeight: 1.3,
              }}
            >
              {direction?.title || `设计方向 ${index + 1}`}
            </h3>
            <div style={{ marginTop: 4, fontSize: 10, color: '#8a8177' }}>
              已结合商品、参考图与本轮套图配置
            </div>
          </div>

          {/* 选中状态指示器 */}
          <div
            style={{
              flexShrink: 0,
              minWidth: 72,
              height: 26,
              borderRadius: 999,
              padding: '0 9px',
              border: `1px solid ${selected ? colors.primary : 'rgba(0,0,0,.12)'}`,
              background: selected ? colors.primary : '#fff',
              color: selected ? getReadableTextColor(colors.primary) : '#8a8177',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              fontSize: 10,
              fontWeight: 800,
            }}
          >
            {selected ? <><MdCheck size={13} />已选择</> : '点击选择'}
          </div>
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
                  background: '#F3F1ED',
                  border: '1px solid #E7E2DA',
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#5F574F',
                  transition: 'all 0.15s',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {(planSummary.commercialObjective || planSummary.audience) && (
          <div style={{ borderTop: '1px solid #ece9e4', paddingTop: 12, marginTop: 10 }}>
            {planSummary.commercialObjective && (
              <div style={{ display: 'grid', gridTemplateColumns: '66px minmax(0, 1fr)', gap: 8, fontSize: 11, lineHeight: 1.55 }}>
                <span style={{ color: '#8a8177', fontWeight: 700 }}>商业目标</span>
                <span style={{ color: '#302c28' }}>{planSummary.commercialObjective}</span>
              </div>
            )}
            {planSummary.audience && (
              <div style={{ display: 'grid', gridTemplateColumns: '66px minmax(0, 1fr)', gap: 8, marginTop: 6, fontSize: 11, lineHeight: 1.55 }}>
                <span style={{ color: '#8a8177', fontWeight: 700 }}>目标用户</span>
                <span style={{ color: '#302c28' }}>{planSummary.audience}</span>
              </div>
            )}
          </div>
        )}

        {planSummary.strategyItems.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px 16px', marginTop: 12 }}>
            {planSummary.strategyItems.map(item => (
              <div key={item.key} style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10, color: '#8a8177', fontWeight: 700 }}>{item.label}</div>
                <div style={{ marginTop: 3, fontSize: 11, lineHeight: 1.5, color: '#3f3933' }}>{item.value}</div>
              </div>
            ))}
          </div>
        )}

        {deliverableGroups.length > 0 && (
          <div style={{ borderTop: '1px solid #ece9e4', paddingTop: 12, marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10, color: '#8a8177', fontWeight: 700 }}>本方案将生成</div>
                <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.5, color: '#292622', fontWeight: 700 }}>{deliverableSummary}</div>
              </div>
              {shotRows.length > 0 && (
                <button
                  type="button"
                  data-editable-area
                  aria-expanded={isPlanExpanded}
                  onClick={(event) => {
                    event.stopPropagation();
                    setIsPlanExpanded(value => !value);
                  }}
                  style={{
                    flexShrink: 0,
                    height: 30,
                    padding: '0 9px',
                    borderRadius: 6,
                    border: '1px solid #ded9d2',
                    background: '#fff',
                    color: '#504941',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    cursor: 'pointer',
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {isPlanExpanded ? '收起逐张计划' : `查看 ${shotRows.length} 张计划`}
                  {isPlanExpanded ? <MdExpandLess size={15} /> : <MdExpandMore size={15} />}
                </button>
              )}
            </div>

            {isPlanExpanded && (
              <div data-editable-area style={{ marginTop: 10, borderTop: '1px solid #f0ede8' }}>
                {deliverableGroups.map(group => {
                  const groupShots = shotRows.filter(shot => shot.role === group.role);
                  return (
                    <section key={group.role} style={{ padding: '10px 0', borderBottom: '1px solid #f0ede8' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                        <strong style={{ fontSize: 11, color: '#2f2b27' }}>{group.label} · {group.count} 张</strong>
                        <span style={{ fontSize: 10, color: '#8a8177' }}>{group.ratio}</span>
                      </div>
                      {group.strategy && <p style={{ margin: '4px 0 0', fontSize: 10, color: '#756d65', lineHeight: 1.5 }}>{group.strategy}</p>}
                      {groupShots.map((shot, shotIndex) => (
                        <div key={shot.id} style={{ display: 'grid', gridTemplateColumns: '18px minmax(0, 1fr)', gap: 6, marginTop: 8 }}>
                          <span style={{ fontSize: 10, color: colors.primary, fontWeight: 800 }}>{shotIndex + 1}</span>
                          <div>
                            <div style={{ fontSize: 11, color: '#342f2b', fontWeight: 700 }}>{shot.label}</div>
                            {shot.purpose && <div style={{ marginTop: 2, fontSize: 10, lineHeight: 1.45, color: '#625b54' }}>{shot.purpose}</div>}
                            {shot.visualExecution && <div style={{ marginTop: 2, fontSize: 10, lineHeight: 1.45, color: '#8a8177' }}>{shot.visualExecution}</div>}
                          </div>
                        </div>
                      ))}
                    </section>
                  );
                })}
              </div>
            )}
          </div>
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
                整套执行说明可编辑
              </span>
              {!isEditing && (
                <span
                  style={{
                    fontSize: 10,
                    color: 'var(--text-muted, #999)',
                    marginLeft: 'auto',
                  }}
                >
                  生成前可继续加工
                </span>
              )}
            </div>
            <textarea
              value={editableDescription}
              aria-label={`编辑${direction?.title || `方向 ${index + 1}`}的执行说明`}
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
