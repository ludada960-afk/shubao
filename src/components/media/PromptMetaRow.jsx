import React from 'react';
import { Maximize2 } from 'lucide-react';
import ImageMentionPicker from '../creation/ImageMentionPicker.jsx';

/* ═══ PromptMetaRow：提示词框**下面那一行**（两个板块共用一份）═══════════════════════════════════
   2026-09-27 批 CP —— 用户原话（逐字）：
   ① 「你把 @ 和放大按钮，还有字数的限制是多少？这三个东西都**放到同一行**去，这样不是更好吗？」
   ② 「这个按钮图片生成那边应该是没有的，如果你这边要做的话，**那边是不是也可以考虑做呢**？」
   ③ 「同等级的东西，你应该**同等级的去进行设计**呀。」
   ⇒ 视频侧（批 CK）先前各写了一套（.video-wb-meta / .video-wb-at）—— 批 CP **合并成这一份**：
     图片侧（FieldRenderer 的多行字段）与视频侧（VideoWorkbench 的脚本格）都用它，
     位置、间距、字号两边一致。

   ═══ 2026-09-28 批 CY：@ 换成**全站共用的 `ImageMentionPicker`**（用户点名，原话逐字）═══════════
   「这个@ 按钮为什么没有照首页那边的做法去做呢？真正的这种按钮，它是**向上张开面板**。
    然后要**映射你现在的这一个上传的素材的命名还有图标**等方案呀。而且我发现你首页那边的图片生成和
    视频生成似乎也没有做好这个按钮的统一规划呀。我现在要求你把整个网站里面所有的这种 @ 按钮，
    就是不管是首页或者各种子页面或者画布里面涉及到的这个按钮，你都要**统一同一个类型的标准**。」
   「你看首页图片生成这边就是有的。他这个 @ 按钮的逻辑会更正确。你现在全局都要按照这个逻辑去做呀，
    统一规范，明白吗？包括张开的面板是**向上**的，然后这个**大小、宽度**这些东西你都要对齐呀。」
   改前（本文件自己写的那套）：`.media-field-meta-at-menu` 是**行内 span、往下开**、只有纯文字行、
   没素材时点开只是一句提示 —— 与首页那一套（portal 到 body + 上方放不下才翻下 + 34px 缩略图 +
   名称 + 没素材自动变暗）**是两套东西**。
   ⇒ 现在这一行的 @ 就是 `ImageMentionPicker` 本体：触发按钮、面板宽度/内边距、行排版、
     上下翻转规则、空态禁用全部与首页/画布**同源**，不再各写一套。
   · 放大：图片侧原来钉在框内右上角（会压住首行文字）⇒ 现在在这一行（用户点名要的）。
   · 字数：`当前 / 上限`（上限由调用方按 min(区块声明, 全局上限) 算好传进来）。 */
export default function PromptMetaRow({
  id, label, value = '', maxLength = 0, assets = [], disabled = false,
  onInsert, onExpand,
}) {
  const text = String(value || '');
  const list = Array.isArray(assets) ? assets.filter(Boolean) : [];
  /* 素材 → @ 引用项：**保留素材自己的命名**（用户要的"映射当前上传素材的命名"），
     只补组件要的最小字段；没有 url 的条目直接丢掉（否则菜单里会出现点不了的假行）。 */
  const normalize = items => (Array.isArray(items) ? items : [])
    .map((item, index) => ({
      id: item.id || item.assetId || item.url || `asset-${index + 1}`,
      url: item.url || item.thumb || '',
      name: item.name || item.label || item.title || `素材${index + 1}`,
      role: item.role || 'reference',
    }))
    .filter(item => Boolean(item.url));
  const insert = item => {
    const assetId = item.id || '';
    const name = item.name || '素材';
    const sep = !text || /\s$/.test(text) ? '' : ' ';
    onInsert?.(`${text}${sep}@[${name}](${assetId}) `);
  };
  return (
    <span className="media-field-meta">
      {/* 与首页/画布同一个 @ 入口（无素材时它自己就是"禁用 + 变暗"态） */}
      <ImageMentionPicker
        images={list}
        selectionMode="insert"
        normalize={normalize}
        onToggle={insert}
        disabled={disabled}
        menuTitle="引用素材"
        triggerLabel="引用素材"
      />
      {onExpand && (
        <button
          type="button"
          className="media-field-meta-expand"
          disabled={disabled}
          aria-label={(label || '文本') + '放大编辑'}
          title="放大编辑"
          onClick={onExpand}
        ><Maximize2 size={13} />放大</button>
      )}
      <span className="media-field-meta-count">{text.length} / {maxLength}</span>
    </span>
  );
}
