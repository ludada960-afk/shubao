import React, { useState, useCallback, useEffect } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Check, Lock, Unlock, Wand2 } from 'lucide-react';
import { fetchSkillLibrary } from '../../../services/skills.js';

/* 9-11 二轮用户批注:「画面风格」不再自建一套 —— 真源 = 技能库「生图」内置技能。
   本表只保留卡片视觉 (渐变/色调文案), 风格是否有、叫什么、怎么写提示词, 全部由技能库决定。 */
const STYLE_VISUALS = Object.freeze({
  premium_minimal: { gradient: 'linear-gradient(135deg, var(--sb-neutral-100), #e5e5e5)', tone: '白灰低饱和' },
  lifestyle_scene: { gradient: 'linear-gradient(135deg, #f5f0eb, #d1fae5)', tone: '暖调自然光' },
  fashion_editorial: { gradient: 'linear-gradient(135deg, #1a1a2e, #d4a574)', tone: '暗调高对比' },
  warm_natural: { gradient: 'linear-gradient(135deg, #fde68a, #fed7aa)', tone: '米棕柔光' },
  tech_precision: { gradient: 'linear-gradient(135deg, var(--sb-info), #60a5fa)', tone: '冷蓝金属' },
});
const SMART_STYLE = Object.freeze({ key: 'smart', label: '智能风格', tone: '由 AI 决定', gradient: 'linear-gradient(135deg, var(--sb-brand-600) 0%, #ec4899 50%, var(--sb-warning) 100%)' });

/* 技能库不可用 (离线/接口异常) 时的显示兜底 —— 只提供卡片视觉与文案,
   技能是否存在、提示词怎么写, 一律以技能库为准 (9-11 二轮批注: 不再自建第二套风格真源)。 */
const FALLBACK_STYLE_SKILLS = [
  {
    key: 'smart',
    label: '智能风格',
    desc: 'AI 根据品类自动匹配',
    gradient: 'linear-gradient(135deg, var(--sb-brand-600) 0%, #ec4899 50%, var(--sb-warning) 100%)',
    tone: '由AI决定'
  },
  {
    key: 'premium_minimal',
    label: '高级极简',
    desc: '低饱和·白灰·大量留白',
    gradient: 'linear-gradient(135deg, var(--sb-neutral-100), #e5e5e5)',
    tone: '白灰低饱和'
  },
  {
    key: 'lifestyle_scene',
    label: '生活场景',
    desc: '暖调·自然光·家居感',
    gradient: 'linear-gradient(135deg, #f5f0eb, #d1fae5)',
    tone: '暖调自然光'
  },
  {
    key: 'fashion_editorial',
    label: '时尚杂志',
    desc: '高对比·暗调·戏剧光',
    gradient: 'linear-gradient(135deg, #1a1a2e, #d4a574)',
    tone: '暗调高对比'
  },
  {
    key: 'warm_natural',
    label: '自然暖调',
    desc: '柔光·米棕·治愈系',
    gradient: 'linear-gradient(135deg, #fde68a, #fed7aa)',
    tone: '米棕柔光'
  },
  {
    key: 'tech_precision',
    label: '科技精工',
    desc: '冷蓝·锐利·金属质感',
    gradient: 'linear-gradient(135deg, var(--sb-info), #60a5fa)',
    tone: '冷蓝金属'
  }
];

export default function StylePanel({ value = 'smart', onChange, customColors, onColorsChange, userSkills = [], onAddSkill, onRemoveSkill, onOpenSkillLibrary }) {
  const [showBrandColor, setShowBrandColor] = useState(false);
  /* 未锁定时的中性起始色：从 token 读，不再硬编码品牌紫（原则 6.3） */
  const [pickerColor, setPickerColor] = useState(() => (
    typeof window !== 'undefined'
      ? (getComputedStyle(document.documentElement).getPropertyValue('--sb-text-primary').trim() || 'rgb(26, 22, 20)')
      : 'rgb(26, 22, 20)'
  ));
  /* hover 用 state，避免内联改 style 覆盖声明式选中态（原则 4.3） */
  const [hoverCard, setHoverCard] = useState('');
  /* 9-11 二轮批注: 「画面风格」= 技能库「生图」内置技能 (唯一真源); 拉取失败才回落兜底视觉。 */
  const [library, setLibrary] = useState({ loading: true, error: '', builtin: [] });
  useEffect(() => {
    let cancelled = false;
    fetchSkillLibrary({ kind: 'image' })
      .then(data => {
        if (cancelled) return;
        setLibrary({ loading: false, error: '', builtin: Array.isArray(data?.builtin) ? data.builtin : [] });
      })
      .catch(error => {
        if (cancelled) return;
        setLibrary({ loading: false, error: error?.message || '技能库暂时不可用', builtin: [] });
      });
    return () => { cancelled = true; };
  }, []);
  const librarySkills = library.builtin.length
    ? library.builtin
    : FALLBACK_STYLE_SKILLS.map(item => ({ id: `builtin:image:${item.key}`, key: item.key, name: item.label, summary: item.desc, body: '' }));
  const styleCards = [
    { key: 'smart', label: SMART_STYLE.label, tone: SMART_STYLE.tone, gradient: SMART_STYLE.gradient },
    ...librarySkills
      .filter(skill => STYLE_VISUALS[skill.key])
      .map(skill => ({ key: skill.key, label: skill.name, tone: STYLE_VISUALS[skill.key].tone, gradient: STYLE_VISUALS[skill.key].gradient })),
  ];
  /* 任务型技能 (白底主图 / 模特试穿 …) = 可叠加进本次生成的技能, 与画布同源 */
  const taskSkills = librarySkills.filter(skill => skill.key !== 'smart' && !STYLE_VISUALS[skill.key]);
  const chosenSkillIds = new Set((userSkills || []).map(item => item.id));

  // 外部 customColors 变化时同步取色器
  useEffect(() => {
    if (customColors && customColors[0]) {
      setPickerColor(customColors[0]);
    }
  }, [customColors]);

  /* ── 选择风格（完整方案）── */
  const handleStyle = useCallback(
    (key) => {
      onChange(key);
      // 切换风格时，如果品牌色锁定开着就保留，关着就跟着风格走
      // 风格自带色调，不需要额外设置 customColors
    },
    [onChange]
  );

  /* ── 品牌色锁定开关 ── */
  const toggleBrandLock = useCallback(() => {
    if (customColors && customColors.length > 0) {
      // 关闭 → 解除锁定
      onColorsChange?.([]);
    } else {
      // 开启 → 锁定当前取色器颜色
      onColorsChange?.([pickerColor, pickerColor]);
    }
  }, [customColors, pickerColor, onColorsChange]);

  /* ── 取色器拖动 ── */
  const handlePickerChange = useCallback(
    (color) => {
      setPickerColor(color);
      if (customColors) {
        // 品牌色已锁定 → 实时更新
        onColorsChange?.([color, color]);
      }
    },
    [customColors, onColorsChange]
  );

  const brandLocked = customColors && customColors !== null;
  const currentStyle = styleCards.find((s) => s.key === value) || styleCards[0];

  return (
    <div style={{ padding: 0 }}>
      <div style={{ padding: '14px 16px 12px' }}>
        {/* ── 画面风格: 与「技能库 · 生图」同源 (9-11 二轮批注) ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 0.3 }}>画面风格</div>
          <button
            type="button"
            className="ec-skill-entry"
            onClick={() => onOpenSkillLibrary?.('image')}
            /* 用户要求点击区 ≥32px（改造前此处仅 26px）→ --sb-control-md(32) */
            style={{ height: 'var(--sb-control-md)', padding: '0 var(--sb-space-2)', borderRadius: 'var(--sb-radius-control)', border: '1px solid var(--sb-border-default)', background: 'var(--sb-surface-tint)', color: 'var(--sb-text-secondary)', fontSize: 'var(--sb-text-2xs)', fontWeight: 'var(--sb-weight-semibold)', fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
          >
            <Wand2 size={12} /> 技能库{userSkills.length ? `（${userSkills.length}/2）` : ''}
          </button>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>
          与技能库同一份「生图技能」：选中即带完整光影、色调与构图方案进入本次生成
        </div>
        {library.error && (
          <div role="status" style={{ marginBottom: 8, padding: 'var(--sb-space-2)', borderRadius: 'var(--sb-radius-control)', background: 'var(--sb-warning-bg)', color: 'var(--sb-warning)', fontSize: 'var(--sb-text-2xs)', lineHeight: 'var(--sb-leading-normal)' }}>
            技能库暂时不可用，已用内置风格兜底：{library.error}
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 6,
            marginBottom: 16
          }}
        >
          {styleCards.map((card) => {
            const active = value === card.key;
            return (
              <div
                key={card.key}
                onClick={() => handleStyle(card.key)}
                onMouseEnter={() => setHoverCard(card.key)}
                onMouseLeave={() => setHoverCard('')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 'var(--sb-space-1)',
                  padding: 'var(--sb-space-3) var(--sb-space-1)',
                  cursor: 'pointer',
                  borderRadius: 'var(--sb-radius-control)',
                  /* D2：hover 只换中性底色；selected = 三件套 + ring（边框恒宽，零抖动） */
                  background: active ? 'var(--sb-state-selected-bg)' : hoverCard === card.key ? 'var(--sb-state-hover-bg)' : 'var(--sb-surface-tint)',
                  border: `1.5px solid ${active ? 'var(--sb-state-selected-line)' : 'transparent'}`,
                  boxShadow: active ? 'var(--sb-shadow-ring)' : 'none',
                  transition: 'background-color var(--sb-duration-fast) var(--sb-ease-out), box-shadow var(--sb-duration-fast) var(--sb-ease-out), border-color var(--sb-duration-fast) var(--sb-ease-out)'
                }}
              >
                {/* 风格预览色条：card.gradient 是该风格的**示意色**（内容的一部分，
                    不是 UI 装饰色），按原则属合法例外，保留原值。 */}
                <div
                  style={{
                    width: 36,
                    height: 20,
                    borderRadius: 'var(--sb-radius-chip)',
                    background: card.gradient,
                    border: '1px solid var(--sb-border-default)',
                  }}
                />
                <span
                  style={{
                    fontSize: 'var(--sb-text-2xs)',
                    fontWeight: 'var(--sb-weight-semibold)',
                    color: active ? 'var(--sb-state-selected-ink)' : 'var(--sb-text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    textAlign: 'center'
                  }}
                >
                  {card.label}
                </span>
                <span
                  style={{
                    fontSize: 'var(--sb-text-2xs)',
                    fontWeight: 'var(--sb-weight-regular)',
                    color: active ? 'var(--sb-state-selected-ink)' : 'var(--sb-text-muted)',
                    textAlign: 'center',
                    lineHeight: 'var(--sb-leading-tight)'
                  }}
                >
                  {card.tone}
                </span>
              </div>
            );
          })}
        </div>

        {/* ── 任务型技能（技能库 · 生图）：可叠加进本次生成, 与画布同源 ── */}
        {taskSkills.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 2 }}>按技能生成</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 7 }}>技能库里的任务型技能（白底图、模特上身等），最多同时叠加 2 个</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {taskSkills.map(skill => {
                const active = chosenSkillIds.has(skill.id);
                return (
                  <button
                    key={skill.id}
                    type="button"
                    className={`ec-skill-chip${active ? ' is-active' : ''}`}
                    aria-pressed={active}
                    title={skill.summary || skill.name}
                    onClick={() => (active ? onRemoveSkill?.(skill.id) : onAddSkill?.(skill))}
                    /* 用户要求点击区 ≥32px（改造前 28px）→ --sb-control-md(32) */
                    style={{ height: 'var(--sb-control-md)', padding: '0 var(--sb-space-2)', borderRadius: 'var(--sb-radius-pill)', border: `1px solid ${active ? 'var(--sb-state-selected-line)' : 'var(--sb-border-default)'}`, background: active ? 'var(--sb-brand-wash)' : 'var(--sb-surface-card)', color: active ? 'var(--sb-state-selected-ink)' : 'var(--sb-text-secondary)', fontSize: 'var(--sb-text-2xs)', fontWeight: 'var(--sb-weight-semibold)', fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 'var(--sb-space-1)' }}
                  >
                    {active && <Check size={11} />}{skill.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 已选技能（可移除）── */}
        {(userSkills || []).length > 0 && (
          <div style={{ marginBottom: 14, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(userSkills || []).map(skill => (
              <span key={skill.id} className="ec-skill-chip is-active" style={{ height: 'var(--sb-control-md)', padding: '0 var(--sb-space-2)', borderRadius: 'var(--sb-radius-pill)', border: '1px solid var(--sb-state-selected-line)', background: 'var(--sb-brand-wash)', color: 'var(--sb-state-selected-ink)', fontSize: 'var(--sb-text-2xs)', fontWeight: 'var(--sb-weight-semibold)', display: 'inline-flex', alignItems: 'center', gap: 'var(--sb-space-1)' }}>
                <Wand2 size={12} /> {skill.name}
                <button type="button" aria-label={`移除技能 ${skill.name}`} onClick={() => onRemoveSkill?.(skill.id)} /* 移除按钮此前 padding:0 且无尺寸 = 极小点击目标。
   按用户「点击区不许缩水」给到 32×32 抓取区（视觉仍是 × 字形）。 */
  style={{ border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 0, width: 'var(--sb-control-md)', height: 'var(--sb-control-md)', display: 'inline-grid', placeItems: 'center', marginLeft: 'calc(var(--sb-space-1) * -1)' }}>×</button>
              </span>
            ))}
          </div>
        )}

        {/* ── 品牌色锁定（可选覆盖）── */}
        <div
          style={{
            background: brandLocked ? 'var(--sb-brand-wash)' : 'var(--sb-surface-tint)',
            borderRadius: 'var(--sb-radius-card)',
            padding: 'var(--sb-space-3)',
            border: `1px solid ${brandLocked ? 'var(--sb-state-selected-line)' : 'var(--sb-border-subtle)'}`,
            transition: 'border-color var(--sb-duration-fast) var(--sb-ease-out)'
          }}
        >
          <div
            onClick={toggleBrandLock}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {brandLocked ? <Lock size={13} color="var(--sb-brand)" /> : <Unlock size={13} color="var(--text-muted)" />}
              <div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-secondary)'
                  }}
                >
                  锁定品牌主色调
                </span>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--text-muted)',
                    marginTop: 1
                  }}
                >
                  {brandLocked ? '已锁定，将覆盖风格自带色调' : '品牌色固定时开启，叠加在风格之上'}
                </div>
              </div>
            </div>
            <div
              style={{
                width: 36,
                height: 20,
                borderRadius: 'var(--sb-radius-card)',
                background: brandLocked ? 'var(--sb-brand)' : 'var(--sb-border-strong)',
                position: 'relative',
                transition: 'all 0.2s',
                flexShrink: 0
              }}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: 'var(--sb-surface-card)',
                  position: 'absolute',
                  top: 2,
                  left: brandLocked ? 18 : 2,
                  transition: 'all 0.2s',
                  boxShadow: 'var(--sb-shadow-md)'
                }}
              />
            </div>
          </div>

          {/* ── 取色器（仅品牌色锁定时展开）── */}
          {brandLocked && (
            <div
              style={{
                marginTop: 12,
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start'
              }}
            >
              <div style={{ flexShrink: 0 }}>
                <HexColorPicker color={pickerColor} onChange={handlePickerChange} style={{ width: 160, height: 140 }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    marginBottom: 4
                  }}
                >
                  品牌主色
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 8
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 'var(--sb-radius-control)',
                      background: pickerColor,
                      border: '2px solid var(--sb-border-default)',
                      boxShadow: 'var(--sb-shadow-md)',
                      flexShrink: 0
                    }}
                  />
                  <input
                    value={pickerColor}
                    onChange={(e) => {
                      setPickerColor(e.target.value);
                      handlePickerChange(e.target.value);
                    }}
                    placeholder="未锁定"
                    style={{
                      width: '100%',
                      height: 28,
                      padding: '0 8px',
                      borderRadius: 'var(--sb-radius-chip)',
                      border: '1px solid var(--sb-border-default)',
                      background: 'var(--sb-surface-card)',
                      fontSize: 11,
                      fontWeight: 600,
                      fontFamily: 'monospace',
                      color: 'var(--text-primary)',
                      outline: 'none'
                    }}
                  />
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--text-muted)',
                    lineHeight: 1.4
                  }}
                >
                  品牌色会叠加在「{currentStyle.label}
                  」的光影和构图之上，保留风格的同时突出品牌辨识度
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
