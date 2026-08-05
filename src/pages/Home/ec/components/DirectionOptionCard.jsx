import React, { useState, useCallback } from 'react';
import { MdCheck, MdExpandLess, MdExpandMore } from 'react-icons/md';
import {
  getDirectionCardState,
  getDirectionDeliverableGroups,
  getDirectionExecutionGuide,
  getDirectionPlanSummary,
  getDirectionShotRows,
  getReadableTextColor,
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
 * @param {Function} [props.onExecutionGuideChange] - 整套执行说明变化回调 (value) => void
 * @param {Function} [props.onShotChange] - 单张图片计划变化回调 (shotId, value) => void
 */
export default function DirectionOptionCard({
  direction,
  index,
  selected,
  onSelect,
  onExecutionGuideChange,
  onShotChange,
}) {
  const [isPlanExpanded, setIsPlanExpanded] = useState(false);

  // 获取卡片状态
  const cardState = getDirectionCardState({ direction, selected, index });
  const { colors, styles } = cardState;

  const deliverableGroups = getDirectionDeliverableGroups(direction);
  const shotRows = getDirectionShotRows(direction);
  const deliverableSummary = summarizeDirectionDeliverables(direction);
  const planSummary = getDirectionPlanSummary(direction);
  const executionGuide = getDirectionExecutionGuide(direction);
  const visualSystem = direction?.visual_system || {};
  const overallSpec = direction?.overall_spec || {};

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

  return (
    <div
      role="radio"
      aria-checked={selected}
      aria-label={`方案 ${index + 1}: ${direction?.title || ''}`}
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
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

        {/* 用户真正需要先理解的是标题和一句话定位。 */}
        {(direction?.one_liner || direction?.short_desc || direction?.description) && (
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
            {direction.one_liner || direction.short_desc || direction.description}
          </div>
        )}

        <section style={{ marginTop: 12, padding: 12, borderRadius: 7, background: '#f7f8fa', border: '1px solid #e7e9ee' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <strong style={{ fontSize: 12, color: '#25282d' }}>整体设计规范</strong>
            <span style={{ fontSize: 9, color: '#69717d' }}>统一视觉标准，不随单张修改改变</span>
          </div>
          <div style={{ marginTop: 9, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px 12px' }}>
            {[
              ['商业目标', planSummary.commercialObjective],
              ['目标用户', planSummary.audience],
              ['视觉风格', overallSpec.visual_style || (Array.isArray(direction?.visual_tone) ? direction.visual_tone.join('、') : '')],
              ['光线', overallSpec.lighting || visualSystem.lighting],
              ['构图', overallSpec.composition || visualSystem.composition],
              ['镜头', overallSpec.camera_language || visualSystem.camera_language],
              ['背景', overallSpec.background_language || visualSystem.background_language],
              ['字体与文案', [overallSpec.typography_intent || visualSystem.typography_intent, overallSpec.copy_tone || visualSystem.copy_tone].filter(Boolean).join('；')],
            ].filter(([, value]) => value).map(([label, value]) => (
              <div key={label} style={{ minWidth: 0 }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: '#818894' }}>{label}</div>
                <div style={{ marginTop: 2, fontSize: 10, lineHeight: 1.5, color: '#3f454e' }}>{value}</div>
              </div>
            ))}
          </div>
          {(overallSpec.product_fidelity || direction?.consistency_locks?.length) && <div style={{ marginTop: 9, paddingTop: 8, borderTop: '1px solid #e3e6eb', fontSize: 10, lineHeight: 1.5, color: '#555d68' }}>
            <strong>商品一致性：</strong>{overallSpec.product_fidelity || direction.consistency_locks.join('；')}
          </div>}
          {planSummary.strategyItems.length > 0 && (
            <div style={{ marginTop: 9, paddingTop: 8, borderTop: '1px solid #e3e6eb' }}>
              <strong style={{ fontSize: 10, color: '#555d68' }}>商品策略</strong>
              <div style={{ display: 'grid', gap: 5, marginTop: 6 }}>
                {planSummary.strategyItems.map(item => (
                  <div key={item.key} style={{ display: 'grid', gridTemplateColumns: '56px minmax(0, 1fr)', gap: 6, fontSize: 10, lineHeight: 1.5 }}>
                    <span style={{ color: '#818894', fontWeight: 800 }}>{item.label}</span>
                    <span style={{ color: '#3f454e' }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section data-editable-area style={{ marginTop: 12, padding: 12, borderRadius: 7, background: '#fffdf8', border: '1px solid #eee2c8' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <strong style={{ fontSize: 12, color: '#352d23' }}>整套执行说明</strong>
            <span style={{ fontSize: 9, color: '#8a8177' }}>确认后进入后续生成请求</span>
          </div>
          <textarea
            data-editable-area
            value={executionGuide}
            aria-label={`编辑${direction?.title || `方案 ${index + 1}`}的整套执行说明`}
            onFocus={() => onSelect?.(index)}
            onChange={event => onExecutionGuideChange?.(event.target.value)}
            onClick={event => event.stopPropagation()}
            readOnly={!onExecutionGuideChange}
            aria-readonly={!onExecutionGuideChange}
            placeholder="补充这套方案的统一执行说明"
            rows={4}
            maxLength={1200}
            style={{ width: '100%', boxSizing: 'border-box', marginTop: 7, padding: '8px 9px', border: '1px solid #e7dcc1', borderRadius: 6, background: '#fff', color: '#403a34', font: '11px/1.55 inherit', resize: 'vertical', outline: 'none' }}
          />
        </section>

        {deliverableGroups.length > 0 && (
          <div style={{ borderTop: '1px solid #ece9e4', paddingTop: 12, marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10, color: '#8a8177', fontWeight: 700 }}>逐张图片计划</div>
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
                      {groupShots.map((shot, shotIndex) => (
                        <div key={shot.id} style={{ display: 'grid', gridTemplateColumns: '18px minmax(0, 1fr)', gap: 6, marginTop: 8 }}>
                          <span style={{ fontSize: 10, color: colors.primary, fontWeight: 800 }}>{shotIndex + 1}</span>
                          <div>
                            <div style={{ fontSize: 11, color: '#342f2b', fontWeight: 700 }}>{shot.label}</div>
                            {shot.purpose && <div style={{ marginTop: 2, fontSize: 10, lineHeight: 1.45, color: '#625b54' }}>{shot.purpose}</div>}
                            <textarea
                              value={shot.visualExecution || ''}
                              aria-label={`编辑${shot.label}的图片计划`}
                              onFocus={() => onSelect?.(index)}
                              onChange={event => onShotChange?.(shot.id, event.target.value)}
                              onClick={event => event.stopPropagation()}
                              placeholder="写下这张图要怎么拍、突出什么"
                              rows={2}
                              style={{ width: '100%', boxSizing: 'border-box', marginTop: 5, padding: '6px 7px', border: '1px solid #e5e0d9', borderRadius: 6, background: '#fff', color: '#403a34', font: '11px/1.45 inherit', resize: 'vertical', outline: 'none' }}
                            />
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

      </div>
    </div>
  );
}
