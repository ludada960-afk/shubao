import React from 'react';
import { ShieldAlert, Ban } from 'lucide-react';
import ResizableTextarea from './ResizableTextarea.jsx';
import { SPACING, FONT_SIZE, CONTROL_HEIGHT, groupTitleStyle, helperTextStyle } from './panelVisualLanguage.js';

/* ═══════ 生成约束面板 ═══════
   2026-09-15 用户批注①（子项 2）：
   「而且避免出现的元素为什么要放在生成设置里？它不应该在这个面板。
    你要有整体规划思维……重新设计它们的布局。」

   ── 为什么它不属于「生成设置」──
   「生成设置」回答的是「用什么规格出图」：模型 / 清晰度 / 品牌主色调 ——
   全部是**设备与输出参数**，与「画什么」无关。
   而「避免出现的元素」回答的是「画面里不要有什么」，是一条**画面内容约束**，
   它的天然归属是描述画面内容的那个面板 —— 也就是「内容规范」。

   ── 为什么不新开一个面板 ——
   用户同一条批注里明确反对「硬塞」与「一个面板塞好几个项目」的失衡；
   再挂第 7 个按钮会让触发条拥挤、且它与「内容规范」是同一次思考的两面
   （正向要什么 / 反向不要什么）。故落到「内容规范」，作为独立分组呈现，
   与「创意思路 / 核心卖点」并列但语义自洽。
   注意：数据仍走 genSettings.negativePrompt 这一条链路，**画布侧同步不受影响**
   （见报告里的画布对照说明）。 */

const PRESETS = ['商品结构变形', '异常手部', '乱码文字', '无关道具', '多余水印'];

export default function GenerationConstraintsPanel({ negativePrompt = '', onChange, available = null }) {
  /* 点击预设 = 追加一条约束（已存在则忽略），与手输完全同一条数据链路 */
  const append = (term) => {
    const current = String(negativePrompt || '');
    const terms = current.split(/[，,、\n]/).map(t => t.trim()).filter(Boolean);
    if (terms.includes(term)) return;
    onChange?.([...terms, term].join('、'));
  };
  const activeTerms = String(negativePrompt || '').split(/[，,、\n]/).map(t => t.trim()).filter(Boolean);

  return (
    <div style={{ padding: 0 }}>
      <div style={{ padding: `${SPACING.sp6}px ${SPACING.sp5}px`, display: 'flex', flexDirection: 'column', gap: SPACING.sp4 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sp5 }}>
          <div style={groupTitleStyle}>
            <ShieldAlert size={14} style={{ flexShrink: 0 }} aria-hidden="true" />
            <span>避免出现的元素</span>
          </div>

          {/* 常用约束：一键追加，省去重复手输 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACING.sp2 }}>
            {PRESETS.map(term => {
              const active = activeTerms.includes(term);
              return (
                <button
                  key={term}
                  type="button"
                  aria-pressed={active}
                  onClick={() => append(term)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: SPACING.sp1,
                    height: CONTROL_HEIGHT.compact, padding: `0 ${SPACING.sp3}px`,
                    borderRadius: 'var(--sb-radius-pill)', fontFamily: 'inherit',
                    fontSize: FONT_SIZE.helper, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${active ? 'var(--sb-state-selected-line)' : 'var(--sb-border-default)'}`,
                    background: active ? 'var(--sb-brand-wash)' : 'var(--sb-surface-card)',
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }}
                >
                  <Ban size={11} />
                  {term}
                </button>
              );
            })}
          </div>

          {/* 多行 + 右下角拉伸手柄（统一规范） */}
          <ResizableTextarea
            aria-label="避免出现的元素"
            value={negativePrompt}
            onChange={event => onChange?.(event.target.value)}
            available={available}
            placeholder="用「、」分隔，例如：商品结构变形、异常手部、乱码文字、无关道具"
          />

          <p style={{ ...helperTextStyle, margin: 0 }}>
            这些约束会随本次套图一起下发，画布侧节点同步生效。
          </p>
        </div>
      </div>
    </div>
  );
}
