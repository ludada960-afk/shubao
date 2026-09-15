import React from 'react';
import { Lightbulb, Target, ShieldCheck, Search, HeartHandshake } from 'lucide-react';
import ResizableTextarea from './ResizableTextarea.jsx';
import { SPACING, groupTitleStyle, sectionStyle } from './panelVisualLanguage.js';

/* ═══════ 内容规范面板（正向文案）═══════
   2026-09-15 用户批注①（子项 2/3）：
   「这些输入区都特别小……我觉得每一个输入框右下角还是得有一个可以拉伸的按钮」
   「你这些面板最好宽度都是统一的，不能太宽，太宽信息会被分散掉。
    但也不能粗暴地匹配到一致 —— 里面还有很多按钮逻辑、内容逻辑，要相应适配。」

   重排逻辑（不是粗暴对齐宽度）：
   · 面板统一 480px 后，「创意思路」占满整行（它是定性输入，需要宽度）；
     4 个并列小项改 2 列（每列 ~210px，中文标签 + 输入内容都舒适）。
   · 每个多行输入框都挂统一拉伸手柄（右下角 12×12 角标，键盘可达）。
   · 分组标题 13/700，字段标签 12/600，间距全部走视觉语言规范阶梯。

   本面板是「内容规范」的首段：正向要什么（创意思路/卖点/质检/细节/保养）。
   反向不要什么由同面板的 GenerationConstraintsPanel 承接（避免出现的元素）。 */

/* 分组标题行 */
function GroupTitle({ icon: Icon, children }) {
  return (
    <div style={groupTitleStyle}>
      <Icon size={14} style={{ flexShrink: 0 }} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export default function CopyPanel({ copywriting, onChange, available = null }) {
  const setF = (key, val) => onChange({ ...copywriting, [key]: val });

  const detailFields = [
    { key: 'sellingPoints', label: '核心卖点', icon: Target, ph: '每行一个卖点，例：\n24小时持久保湿\n温和不刺激' },
    { key: 'qc', label: '质检报告', icon: ShieldCheck, ph: '合格证编号、检测机构、通过项目…' },
    { key: 'details', label: '细节特写', icon: Search, ph: '材质纹理、接缝工艺、包装细节…' },
    { key: 'maintenance', label: '保养维护', icon: HeartHandshake, ph: '使用注意事项、保养方法、储存条件…' },
  ];

  return (
    <div style={{ padding: 0 }}>
      <div style={{ padding: `${SPACING.sp6}px ${SPACING.sp5}px`, display: 'flex', flexDirection: 'column', gap: SPACING.sp4 }}>

        {/* ── 分组 1：创意思路（满宽，定性输入需要宽度） ── */}
        <div style={sectionStyle}>
          <GroupTitle icon={Lightbulb}>创意思路</GroupTitle>
          <ResizableTextarea
            aria-label="创意思路"
            value={copywriting.plan || ''}
            onChange={e => setF('plan', e.target.value)}
            available={available}
            placeholder="整体策划方向、产品定位、目标人群…例：25-35岁精致女性，强调天然成分和长效保湿"
          />
        </div>

        {/* ── 分组 2：交付要点（2 列，每列在 480px 面板内约 210px） ── */}
        <div style={sectionStyle}>
          <GroupTitle icon={Target}>交付要点</GroupTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACING.sp3 }}>
            {detailFields.map(f => (
              <div key={f.key} style={sectionStyle}>
                <div style={{ ...groupTitleStyle, fontSize: 12, fontWeight: 600, color: 'var(--sb-ink-2)' }}>
                  <f.icon size={12} style={{ flexShrink: 0 }} aria-hidden="true" />
                  <span>{f.label}</span>
                </div>
                <ResizableTextarea
                  aria-label={f.label}
                  value={copywriting[f.key] || ''}
                  onChange={e => setF(f.key, e.target.value)}
                  available={available}
                  minHeight={80}
                  maxHeight={260}
                  placeholder={f.ph}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
