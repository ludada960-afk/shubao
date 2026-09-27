import React, { useState } from 'react';
import { Maximize2 } from 'lucide-react';

/* ═══ PromptMetaRow：提示词框**下面那一行**（两个板块共用一份）═══════════════════════════════════
   2026-09-27 批 CP —— 用户原话（逐字）：
   ① 「你把 @ 和放大按钮，还有字数的限制是多少？这三个东西都**放到同一行**去，这样不是更好吗？」
   ② 「这个按钮图片生成那边应该是没有的，如果你这边要做的话，**那边是不是也可以考虑做呢**？」
   ③ 「同等级的东西，你应该**同等级的去进行设计**呀。」
   ⇒ 视频侧（批 CK）先前各写了一套（.video-wb-meta / .video-wb-at）—— 本批**合并成这一份**：
     图片侧（FieldRenderer 的多行字段）与视频侧（VideoWorkbench 的脚本格）都用它，
     样式只有一份（.media-field-meta*），位置、间距、字号、@ 菜单的长相两边完全一致。
   · @：点开列出**这条技能里已经上传的素材**，选一个就把 `@[名字](id)` 插进提示词
     （蓝色胶囊由各自的 mention 解析负责，两边是同一份规则）。
   · 放大：图片侧原来钉在框内右上角（会压住首行文字）⇒ 现在搬到这一行（用户点名要的）。
   · 字数：`当前 / 上限`（上限默认取字段自己声明的那个数）。 */
export default function PromptMetaRow({
  id, label, value = '', maxLength = 0, assets = [], disabled = false,
  onInsert, onExpand,
}) {
  const [open, setOpen] = useState(false);
  const text = String(value || '');
  const list = Array.isArray(assets) ? assets.filter(Boolean) : [];
  return (
    <>
      <span className="media-field-meta">
        <button
          type="button"
          className="media-field-meta-at"
          disabled={disabled}
          aria-expanded={open}
          aria-label="引用素材"
          title="引用已上传的素材"
          onClick={() => setOpen(o => !o)}
        >@</button>
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
      {open && (
        <span className="media-field-meta-at-menu" role="menu" aria-label="选择要引用的素材">
          {list.length ? list.map((item, i) => (
            <button
              key={item.id || item.url || i}
              type="button"
              role="menuitem"
              data-asset={item.id || item.url || ''}
              onClick={() => {
                const assetId = item.id || item.assetId || item.url || '';
                const name = item.name || item.label || item.title || `素材 ${i + 1}`;
                const sep = !text || /\s$/.test(text) ? '' : ' ';
                onInsert?.(`${text}${sep}@[${name}](${assetId}) `);
                setOpen(false);
              }}
            >{item.name || item.label || item.title || `素材 ${i + 1}`}</button>
          )) : <small>还没有上传素材 —— 先在上面上传，再回来 @</small>}
        </span>
      )}
    </>
  );
}
