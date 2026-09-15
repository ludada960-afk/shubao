import React from 'react';
import { Info, ShieldAlert } from 'lucide-react';
import { detectHardConstraintConflicts, isStructuralIntent } from '../../EcCanvas/canvasPromptAuthority.js';
import { SPACING, helperTextStyle } from './panelVisualLanguage.js';

/* ═══════ 提示词 ↔ 配置面板：谁说了算 ═══════
   2026-09-15 用户批注（图6-⑦）—— 这是他自己提出的核心困惑：
   「用户他可能提示词里面已经写过一遍这些类似配置的这些东西了，那现在我们的配置面板里面
    还要让他再配置一次，很有可能信息它是会冲突的，然后对用户来说他也可能会很迷茫……
    所以我很困惑，现在该怎么去解决这个问题？」

   结论（也是本组件的存在理由）：**冲突不该被避免，而该被显性化**。
     · 面板 = 保险丝：设了就一定生效（材质、禁忌、比例张数、平台合规）——机器必须精确知道的；
     · 提示词 = 方向盘：这一批图长什么样（画面、构图、情绪、文案）——人想表达的；
     · 两者相撞时**以面板为准**，并且**当场告诉用户**，而不是默默按一个来。

   ⚠️ 这套判定**不是新造的**：`canvasPromptAuthority.detectHardConstraintConflicts` /
      `isStructuralIntent` 早已存在（画布侧一直在用，DesignDirection 也有尺寸冲突提示条）。
      缺的只是「在用户此刻正在操作的地方露面」——本组件做的就是这件事。 */

export default function PromptAuthorityNote({ prompt = '', negative = '' }) {
  const hard = detectHardConstraintConflicts({ prompt, negative });
  const structural = isStructuralIntent(prompt);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sp1, marginTop: SPACING.sp2 }}>
      {/* 常驻一句：分工写清楚，用户就不必猜「我是不是还要再填一遍」 */}
      <div style={{ ...helperTextStyle, display: 'flex', alignItems: 'flex-start', gap: SPACING.sp1 }}>
        <Info size={12} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
        <span>配置面板里的设定（张数 / 比例 / 材质 / 禁忌）对每一张图都生效；提示词负责画面与表达。面板留空 = 不限制。</span>
      </div>

      {hard.conflicts.length > 0 && (
        <div role="status" style={{
          ...helperTextStyle,
          display: 'flex', alignItems: 'flex-start', gap: SPACING.sp1,
          color: 'var(--sb-warning, var(--sb-ink-2))',
        }}>
          <ShieldAlert size={12} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
          <span>提示词里出现了「{hard.reason}」，而配置面板把它们列为不要出现 —— 出图时<strong>以配置为准</strong>。要改就改面板那一栏。</span>
        </div>
      )}

      {structural.structural && (
        <div role="status" style={{
          ...helperTextStyle,
          display: 'flex', alignItems: 'flex-start', gap: SPACING.sp1,
          color: 'var(--sb-warning, var(--sb-ink-2))',
        }}>
          <ShieldAlert size={12} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
          <span>提示词里写了{structural.reason}，但出图结构由「套图方案」决定 —— 这一句不会改变张数或比例。</span>
        </div>
      )}

    </div>
  );
}