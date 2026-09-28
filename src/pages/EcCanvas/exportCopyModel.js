/* ═══════════════════════════════════════════════════════════════════════════
   导出弹窗文案 —— 2026-09-29 批 CY-⑭
   ═══════════════════════════════════════════════════════════════════════════

   用户原话（逐字，朋友的反馈 + 用户本人的判断）：
     「点击之后是之前的那个**电商套图的那个导出的模式**。我觉得那个模式现在也存在很大的问题。」
     「你看现在他单独对一张图片进行右键或者点击图片上面的选项最右边的这个下载按钮。都会出来这一个弹窗的
       形式。你这里的描述其实写的也不对。**为什么叫导出整套图片呀？**这让我那个朋友很疑惑。他作为用户的
       角度，他看到这个导出整套图片，他就有点劝退他了。**因为他明明只是对一张图片去进行操作呀，那肯定就是
       导出一张图片呀。**」
     「还有就是你现在这个左上角的标题**命名为什么是电商图片交付**呢。我都跟你说了，我们现在要做的是比较
       全面的一个**商业模式**了，我们的用户不只是电商用户，在我们这里生成的图片也不一定全部都是电商图片。
       所以我跟你说了，你必需要把这个问题给解决掉。把这个命名，你自己要重新想一个命名。
       我们现在是面向的是**通用的用户**，什么图片都可以在我们这里生成并且导出的。」

   事故根因（`index.jsx` 改前 8227/8229/8230 三行）：
     文案由 `exportIntent` 这个**入口标记**决定，而 `exportIntent` 只有在**逐图入口**
     （`handleDownload`）才会被置成 `'single'`；从顶栏「导出」进来是 `'suite'`、
     从多选工具条进来是 `'selection'`，**哪怕最后只剩 1 张可交付图片，标题仍然是
     「电商图片交付」、主选项仍然是「导出整套图片」**。
     ⇒ 用户看到的是"我只是点了一张图的下载，它却要我导出一整套"。

   修法的口径（**以实际可交付张数为准，不以入口为准**）：
     · 只有 1 张 ⇒ 「导出这张图片」，并且**整块隐藏**「合成并导出详情长图」——
       单图场景下那个选项是纯噪音（改前是"渲染出来但置灰"，用户照样会读到它）。
     · 多张 ⇒ 「导出 N 张图片」/「导出全部图片」，并按需给出长图选项。
     · 标题去掉「电商」二字：我们是通用创作平台，不只是电商。

   纯函数：门禁直接断言它，不依赖 React。
   ═══════════════════════════════════════════════════════════════════════════ */

const LONG_DETAIL_MIN = 2;

/**
 * @param {object} input
 * @param {number} input.count       实际可交付张数（已过滤掉原始素材等被排除项）
 * @param {number} input.excludedCount 被排除的原始素材张数
 * @param {boolean} input.longDetail  是否在「合成详情长图」那一档
 * @param {boolean} input.canLongDetail 长图是否凑得齐
 */
export function exportDialogCopy({ count = 0, excludedCount = 0, longDetail = false, canLongDetail = false } = {}) {
  const total = Math.max(0, Number(count) || 0);
  const single = !longDetail && total === 1;
  const longDetailVisible = !single && (canLongDetail || total >= LONG_DETAIL_MIN);

  const title = longDetail
    ? '合成详情长图'
    : single
      ? '导出这张图片'
      : total > 1
        ? `导出 ${total} 张图片`
        : '没有可导出的图片';

  const subtitle = longDetail
    ? '把选中的详情图按下面这个顺序拼成一张长图'
    : single
      ? '保存为一张图片'
      : total > 1
        ? `${excludedCount > 0 ? `已排除 ${excludedCount} 张原始素材，` : ''}只导出生成出来的图片`
        : '这张画布上没有可导出的生成结果';

  const options = [
    {
      mode: 'images',
      label: longDetail
        ? '改为逐张导出'
        : single
          ? '导出这张图片'
          : `导出 ${total} 张图片`,
      description: single ? '保存为一张图片' : '选择保存位置，按原文件名逐张写入',
    },
  ];
  /* 单图场景**整块不渲染**长图选项（改前是"渲染出来但置灰"，用户照样会读它、照样困惑）。 */
  if (longDetailVisible) {
    options.push({
      mode: 'long-detail',
      label: '合成并导出详情长图',
      description: canLongDetail ? '按下方顺序无缝拼接为一张长图' : `至少需要 ${LONG_DETAIL_MIN} 张已生成的详情图`,
    });
  }
  return { total, single, title, subtitle, options, longDetailVisible };
}
