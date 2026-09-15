import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { detectHardConstraintConflicts, isStructuralIntent } from '../../EcCanvas/canvasPromptAuthority.js';
import { SPACING, helperTextStyle } from './panelVisualLanguage.js';

/* ═══════ 提示词 ↔ 配置面板：撞车时才说话 ═══════
   2026-09-15 用户批注（图6-⑦）—— 这是他自己提出的核心困惑：
   「用户他可能提示词里面已经写过一遍这些类似配置的这些东西了，那现在我们的配置面板里面
    还要让他再配置一次，很有可能信息它是会冲突的，然后对用户来说他也可能会很迷茫……
    所以我很困惑，现在该怎么去解决这个问题？」

   结论：**冲突不该被避免，而该被显性化**。
     · 面板 = 保险丝：设了就一定生效（材质、禁忌、比例张数、平台合规）——机器必须精确知道的；
     · 提示词 = 方向盘：这一批图长什么样（画面、构图、情绪、文案）——人想表达的；
     · 两者相撞时**以面板为准**，并且**当场告诉用户**，而不是默默按一个来。

   ⚠️ 两轮返工记录（都写在这里，别再犯）：
    ① **曾经有一条常驻说明句**（"配置面板里的设定……面板留空 = 不限制"）。
       用户实测：提示词一个字没写、只是在面板里点了个技能，它就冒出来了 ——
       「我提示词里面并没有写入任何东西啊，为什么我只是在面板个技能它就会出来这个呢。」
       裁决（2026-09-15）：**删掉**。理由：没冲突时用户不需要上课；常驻说明等于在
       用户没提问的时候先回答一遍，反而像报错。**只在真撞车时才出现** —— 见下方
       「空提示词必须什么都不渲染」的契约测试。
    ② 首版文案是写给审核者看的（"硬约束""以配置为准"）。用户原话：
       「你这个表达不够接地气呀，用户根本不知道这是什么意思，你这句像是在对我交代的，
        根本不是对用户交代的呀。」→ 全部改成**用户看得懂、并且知道下一步点哪里**的说法。

   ⚠️ 判定逻辑**不是新造的**：`canvasPromptAuthority.detectHardConstraintConflicts` /
      `isStructuralIntent` 早已存在（画布侧一直在用）。本组件只负责「在用户此刻正在操作的
      地方露面」，不改判定。 */

export default function PromptAuthorityNote({ prompt = '', negative = '' }) {
  const hard = detectHardConstraintConflicts({ prompt, negative });
  const structural = isStructuralIntent(prompt);

  /* 没撞车 = 一个字都不出现（含提示词为空）。
     这条不是"优化"，是用户明确要求的契约：空提示词下本组件渲染 null。 */
  if (hard.conflicts.length === 0 && !structural.structural) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sp1, marginTop: SPACING.sp2 }}>
      {hard.conflicts.length > 0 && (
        <div role="status" style={{
          ...helperTextStyle,
          display: 'flex', alignItems: 'flex-start', gap: SPACING.sp1,
          color: 'var(--sb-warning, var(--sb-ink-2))',
        }}>
          <ShieldAlert size={12} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
          <span>
            你写的「{hard.reason}」和上面「避免出现的元素」里填的冲突了。
            出图会按「避免出现的元素」来，画面里不会出现它 —— 确实想要，就把那一项删掉。
          </span>
        </div>
      )}

      {structural.structural && (
        <div role="status" style={{
          ...helperTextStyle,
          display: 'flex', alignItems: 'flex-start', gap: SPACING.sp1,
          color: 'var(--sb-warning, var(--sb-ink-2))',
        }}>
          <ShieldAlert size={12} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
          <span>
            你写了{structural.reason}，但这次出几张、多大尺寸是「套图方案」定的 ——
            这一句不会生效。想改就点下面的「套图方案」。
          </span>
        </div>
      )}
    </div>
  );
}
