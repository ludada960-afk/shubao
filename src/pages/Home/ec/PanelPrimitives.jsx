import React from 'react';
import { ICON_SIZE, fieldLabelStyle, groupTitleStyle } from './panelVisualLanguage.js';

/* ═══════════════════════════════════════════════════════════════════════
   面板标题与字段标签：全局唯一实现（2026-09-15）
   ═══════════════════════════════════════════════════════════════════════

   为什么要有这个文件（不是抽公共组件的洁癖，是用户点名的问题）：
   用户批注图6-⑧：「我感觉你现在好像整个这下面所有的面板啊，他们的标题的设计方式
   好像都参差不齐的……同一阶梯的东西，同一个维度的东西，那就应该把他们统一起来，
   同一套的设计语言，同一套的字体大小字体间距字体色彩字体的方案等等的体系呀。」

   实测「参差不齐」的四个来源，全部在本文件里收口：
     ① GenSettingsPanel 自己实现了一套 GroupTitle：10px / bold / --sb-text-hint（灰）；
        而其它面板是 13 / 700 / --sb-ink-1（近黑）—— 同一个「分组标题」两种长相；
     ② SizingPanel 的「图片类型」是**裸的** 13/700、没有图标，
        而 GenerationConstraintsPanel 的「避免出现的元素」有图标 —— 同一档两种长相；
     ③ CopyPanel 与 SkuPanel 各自复制了一份 GroupTitle（其中 CopyPanel 那份删标题后已零调用）；
     ④ SkuPanel 的 FieldLabel 自己写死 12/600/ink-2，与 TEXT_ROLE.fieldLabel 是两份真相。

   统一后只剩两档，全部从 TEXT_ROLE 取值（本文件不写任何字号/颜色字面量）：
     · **GroupTitle** 13/700/ink-1 + 14px 图标 —— 一组内容的名字，最重；
     · **FieldLabel** 12/600/ink-2 + 12px 图标 —— 「这格叫什么」，比它的控件值轻一档。

   两条用法约束（契约测试 test/workbench-panel-ux-0915.test.mjs 在守）：
     · 分组标题**必须带图标**（否则又会出现「图片类型」那种裸标题）；
     · 面板里**不许再出现**自写的分组标题/字段标签样式（grep 直接守）。

   ⚠️ 图标尺寸一律取 ICON_SIZE，不许在调用点写 size={13} 这种字面量。 */

/**
 * 分组标题：一组内容的名字。
 * @param {{icon: React.ComponentType, children: React.ReactNode}} props
 *   icon 必填（约定 + 契约测试）。忘了传不会崩，只是会退回「裸标题」那种参差长相。
 */
export function GroupTitle({ icon: Icon, children }) {
  return (
    <div style={groupTitleStyle}>
      {/* ═══ 图标染色：用户点名要的全局方案（2026-09-16 批注图10-②）═══
          原话：「标题的图标，它是一个颜色的。然后标题是另一个颜色。我觉得这样会更好一些。
          你可以全局按这个套路去做吧。」—— 他说的是自由创作方向面板那套（图标品牌紫、标题深墨），
          而其它面板的图标当时是中性灰，所以看起来「四个板块跟别的面板不一样」。
          现在全局统一成：**图标走品牌主色，标题文字走中性深墨**。
          与原则 6.1 不冲突：那条禁止的是「把层级标签的**文字**染成品牌色」，
          这里文字仍是 --sb-ink-1，品牌色只由图标承担识别作用。 */}
      {Icon ? <Icon size={ICON_SIZE.groupTitle} color="var(--sb-brand-600)" style={{ flexShrink: 0 }} aria-hidden="true" /> : null}
      <span>{children}</span>
    </div>
  );
}

/**
 * 字段标签：「这格叫什么」。
 * @param {{icon?: React.ComponentType, children: React.ReactNode}} props
 *   icon 可选：同一组里反复出现的字段可以不加图标，避免视觉噪声。
 */
export function FieldLabel({ icon: Icon, children }) {
  return (
    <div style={fieldLabelStyle}>
      {Icon ? <Icon size={ICON_SIZE.fieldLabel} color="var(--sb-brand-600)" style={{ flexShrink: 0 }} aria-hidden="true" /> : null}
      <span>{children}</span>
    </div>
  );
}

export default GroupTitle;
