import React from 'react';
import { Target, ShieldCheck, Search, HeartHandshake } from 'lucide-react';
import ResizableTextarea from './ResizableTextarea.jsx';
import { SPACING, groupTitleStyle, sectionStyle, textRoleStyle } from './panelVisualLanguage.js';

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

        {/* ── 正向文案的 4 个字段（2 列，每列在 480px 面板内约 210px）──
            2026-09-15 用户批注（图6-⑤⑦）：删掉两个分组标题。
            · 「创意思路」整块删除 —— 用户原话：「实际上它的创意思路肯定会在提示词里面写的，
              上面已经有提示词框了，你这个地方再写一个创意思路有点多余」。
              ⚠️ 注意这不只是「重复」，是**错层**：创意思路属于表达层（提示词的地盘），
                 放进配置面板等于把方向盘装进保险丝盒。
            · 「交付要点」只删标题、保留下面 4 个字段 —— 用户原话：「这种什么交付要点啊，也要去掉」。
            copywriting.plan 字段保留在数据层（历史草稿仍可读），只是不再在本面板上屏。 */}
        <div style={sectionStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACING.sp3 }}>
            {detailFields.map(f => (
              <div key={f.key} style={sectionStyle}>
                {/* 字段标签走阶梯里的 fieldLabel 档（11/600），比下面的控件值轻一档 ——
                    用户批注图3-② 要的就是这条主次关系。 */}
                <div style={{ ...textRoleStyle('fieldLabel'), display: 'flex', alignItems: 'center', gap: SPACING.sp1 }}>
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
