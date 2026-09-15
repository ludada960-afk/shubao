import React from 'react';
import { ShieldAlert } from 'lucide-react';
import ResizableTextarea from './ResizableTextarea.jsx';
import { SPACING, fieldStackStyle } from './panelVisualLanguage.js';
import { FieldLabel } from './PanelPrimitives.jsx';

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

/* ⚠️ 2026-09-15 用户批注（图6-②）：这里原有的 5 个预置标签（商品结构变形 / 异常手部 /
   乱码文字 / 无关道具 / 多余水印）**整块删除**。用户原话：
   「我觉得你这里为什么会有 5 个可被填入的标签呀？你这又是什么逻辑呀？我觉得没有必要有
   这些东西啊，你有这些东西用户他就不自由了，用户他应该自由地去填他产品相关的一些禁忌吧。」
   —— 这是一条产品判断：**禁忌是品类相关的**（食品怕「变质暗示」、服装怕「走光」、
   3C 怕「接口错误」），给一组通用标签反而把用户往这 5 个词上引，既不全也误导。
   保留手输 + 一行格式提示（placeholder）即可。 */

export default function GenerationConstraintsPanel({ negativePrompt = '', onChange, available = null, flushTop = false }) {
  /* flushTop：当本面板**紧接在 CopyPanel 后面**（内容规范 = 正向 + 反向两段）时，
     顶部内边距归零 —— 否则两段各自 24px 上下内边距会叠成 48px 的死白，
     再加一条分割线，就是用户批注图6-① 说的「上面为什么会有这么多的空白处」。 */
  return (
    <div style={{ padding: 0 }}>
      <div style={{
        padding: flushTop ? `0 ${SPACING.sp5}px ${SPACING.sp6}px` : `${SPACING.sp6}px ${SPACING.sp5}px`,
        display: 'flex', flexDirection: 'column', gap: SPACING.sp2,
      }}>
        {/* ═══ 标题降档 + 去掉说明句（2026-09-16 用户批注图6-①②）═══
            ① 标题：「你这个避免出现的元素，这标题还是太大了呀。它跟上面的这四个标题是不一致大小的，
               你知道吗？就显得他特别突出啊，这是不对的。」
               → 从「分组标题档」13/700 降到**字段标签档** 12/600（12/ink-2），
                 与上面四个（核心卖点/质检报告/细节特写/保养维护）**逐像素同级**。
                 内容规范这一段本来就不是「一个分组」，而是与上面四个并列的第五个字段，
                 用分组标题档才是错的。
            ② 说明句「这些约束会随本次套图一起下发，画布侧节点同步生效。」整句删除 ——
               用户原话：「你下面为什么要加这一句呢？这句可以去掉啊。」
               （它是写给维护者看的链路说明，不是用户需要的信息。） */}
        <div style={fieldStackStyle}>
          <FieldLabel icon={ShieldAlert}>避免出现的元素</FieldLabel>
            {/* 多行 + 右下角拉伸手柄（统一规范） */}
            <ResizableTextarea
              aria-label="避免出现的元素"
              value={negativePrompt}
              onChange={event => onChange?.(event.target.value)}
              available={available}
              /* 2026-09-15：占位提示不再列举那 5 个通用词。
                 删掉按钮却把同一份清单留在占位里，对用户的引导作用是一样的（契约当场抓到这个半成品）。
                 改成教「怎么想」：禁忌是品类相关的，不同品类怕的东西完全不同。 */
              placeholder="用「、」分隔，写你这个品类最怕出现的东西（食品怕变质暗示、服装怕走光）"
            />
        </div>
      </div>
    </div>
  );
}
