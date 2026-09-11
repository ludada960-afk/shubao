import React, { useState, useCallback, useEffect } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Check, Lock, Unlock, Wand2 } from 'lucide-react';
import { fetchSkillLibrary } from '../../../services/skills.js';

/* 9-11 二轮用户批注:「画面风格」不再自建一套 —— 真源 = 技能库「生图」内置技能。
   本表只保留卡片视觉 (渐变/色调文案), 风格是否有、叫什么、怎么写提示词, 全部由技能库决定。 */
const STYLE_VISUALS = Object.freeze({
  premium_minimal: { gradient: 'linear-gradient(135deg, #f5f5f5, #e5e5e5)', tone: '白灰低饱和' },
  lifestyle_scene: { gradient: 'linear-gradient(135deg, #f5f0eb, #d1fae5)', tone: '暖调自然光' },
  fashion_editorial: { gradient: 'linear-gradient(135deg, #1a1a2e, #d4a574)', tone: '暗调高对比' },
  warm_natural: { gradient: 'linear-gradient(135deg, #fde68a, #fed7aa)', tone: '米棕柔光' },
  tech_precision: { gradient: 'linear-gradient(135deg, #3b82f6, #60a5fa)', tone: '冷蓝金属' },
});
const SMART_STYLE = Object.freeze({ key: 'smart', label: '智能风格', tone: '由 AI 决定', gradient: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #f59e0b 100%)' });

/* 技能库不可用 (离线/接口异常) 时的显示兜底 —— 只提供卡片视觉与文案,
   技能是否存在、提示词怎么写, 一律以技能库为准 (9-11 二轮批注: 不再自建第二套风格真源)。 */
const FALLBACK_STYLE_SKILLS = [
  {
    key: 'smart',
    label: '智能风格',
    desc: 'AI 根据品类自动匹配',
    gradient: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #f59e0b 100%)',
    tone: '由AI决定'
  },
  {
    key: 'premium_minimal',
    label: '高级极简',
    desc: '低饱和·白灰·大量留白',
    gradient: 'linear-gradient(135deg, #f5f5f5, #e5e5e5)',
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
    gradient: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
    tone: '冷蓝金属'
  }
];

export default function StylePanel({ value = 'smart', onChange, customColors, onColorsChange, userSkills = [], onAddSkill, onRemoveSkill, onOpenSkillLibrary }) {
  const [showBrandColor, setShowBrandColor] = useState(false);
  const [pickerColor, setPickerColor] = useState('#7c3aed');
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
            style={{ height: 26, padding: '0 9px', borderRadius: 7, border: '1px solid rgba(124,58,237,0.22)', background: '#faf8ff', color: '#6d28d9', fontSize: 11, fontWeight: 650, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
          >
            <Wand2 size={12} /> 技能库{userSkills.length ? `（${userSkills.length}/2）` : ''}
          </button>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>
          与技能库同一份「生图技能」：选中即带完整光影、色调与构图方案进入本次生成
        </div>
        {library.error && (
          <div role="status" style={{ marginBottom: 8, padding: '6px 8px', borderRadius: 7, background: 'rgba(245,158,11,0.10)', color: '#b45309', fontSize: 10, lineHeight: 1.5 }}>
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
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  padding: '10px 4px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  border: '1.5px solid',
                  borderColor: active ? '#1a1a1a' : 'rgba(0,0,0,0.08)',
                  background: active ? '#1a1a1a' : 'rgba(0,0,0,0.03)',
                  transition: 'all 0.18s ease'
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = 'rgba(0,0,0,0.06)';
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = 'rgba(0,0,0,0.03)';
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 20,
                    borderRadius: 4,
                    background: card.gradient,
                    border: `1px solid ${active ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.08)'}`,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: active ? '#fff' : 'var(--text-secondary)',
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
                    fontSize: 9,
                    fontWeight: 500,
                    color: active ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)',
                    textAlign: 'center',
                    lineHeight: 1.2
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
                    style={{ height: 28, padding: '0 10px', borderRadius: 999, border: `1px solid ${active ? 'rgba(124,58,237,0.45)' : 'rgba(0,0,0,0.10)'}`, background: active ? 'rgba(124,58,237,0.10)' : '#fff', color: active ? '#6d28d9' : 'var(--text-secondary)', fontSize: 11, fontWeight: 650, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
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
              <span key={skill.id} className="ec-skill-chip is-active" style={{ height: 28, padding: '0 8px 0 10px', borderRadius: 999, border: '1px solid rgba(124,58,237,0.45)', background: 'rgba(124,58,237,0.10)', color: '#6d28d9', fontSize: 11, fontWeight: 650, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Wand2 size={12} /> {skill.name}
                <button type="button" aria-label={`移除技能 ${skill.name}`} onClick={() => onRemoveSkill?.(skill.id)} style={{ border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 0 }}>×</button>
              </span>
            ))}
          </div>
        )}

        {/* ── 品牌色锁定（可选覆盖）── */}
        <div
          style={{
            background: brandLocked ? 'rgba(124,58,237,0.04)' : 'rgba(0,0,0,0.03)',
            borderRadius: 10,
            padding: '10px 12px',
            border: `1px solid ${brandLocked ? 'rgba(124,58,237,0.15)' : 'rgba(0,0,0,0.06)'}`,
            transition: 'all 0.2s'
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
              {brandLocked ? <Lock size={13} color="#7c3aed" /> : <Unlock size={13} color="var(--text-muted)" />}
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
                borderRadius: 10,
                background: brandLocked ? '#7c3aed' : 'rgba(0,0,0,0.12)',
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
                  background: '#fff',
                  position: 'absolute',
                  top: 2,
                  left: brandLocked ? 18 : 2,
                  transition: 'all 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
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
                      borderRadius: 8,
                      background: pickerColor,
                      border: '2px solid rgba(0,0,0,0.1)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      flexShrink: 0
                    }}
                  />
                  <input
                    value={pickerColor}
                    onChange={(e) => {
                      setPickerColor(e.target.value);
                      handlePickerChange(e.target.value);
                    }}
                    placeholder="#FFFFFF"
                    style={{
                      width: '100%',
                      height: 28,
                      padding: '0 8px',
                      borderRadius: 6,
                      border: '1px solid rgba(0,0,0,0.12)',
                      background: '#fff',
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
