import React, { useRef } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { buildUploadDeck, nextProductSlot } from './workbenchState';

function UploadCard({ role, title, hint, preview, onClick, tilt }) {
  return (
    <button type="button" className={`ec-upload-card ec-upload-card-${role} ec-upload-card-${tilt}`} onClick={onClick}>
      {preview ? <img src={preview.url} alt="" /> : <ImagePlus size={22} strokeWidth={1.8} />}
      <span className="ec-upload-card-title">{title}</span>
      <span className="ec-upload-card-hint">{hint}</span>
    </button>
  );
}

function ImageRail({ title, items, role, onAdd, onRemove }) {
  const isProduct = role === 'product';
  return (
    <div className={`ec-media-rail-group ec-media-rail-${role}`}>
      <div className="ec-media-rail-label">{title}</div>
      <div className="ec-media-rail-scroller" aria-label={`${title}已上传图片`}>
        {items.map((image, index) => (
          <div className="ref-thumb ec-media-thumb" key={`${image.url}-${index}`}>
            <img src={image.url} alt="" />
            {isProduct && <span className="ec-media-thumb-slot">{nextProductSlot(index).label}</span>}
            <button type="button" className="ref-remove" aria-label={`移除${title}第${index + 1}张`} onClick={() => onRemove(index)}><X size={10} /></button>
          </div>
        ))}
        <button type="button" className="ref-add ec-media-add" onClick={onAdd} aria-label={`继续添加${title}`}>
          <ImagePlus size={16} />
          <span>{isProduct ? nextProductSlot(items.length).label : '继续添加'}</span>
        </button>
      </div>
    </div>
  );
}

export default function EcommerceWorkbench({
  productImages,
  refImages,
  description,
  onDescriptionChange,
  onProductUpload,
  onReferenceUpload,
  onRemoveProduct,
  onRemoveReference,
}) {
  const productInputRef = useRef(null);
  const referenceInputRef = useRef(null);
  const deck = buildUploadDeck({ productImages, refImages });
  const nextSlot = nextProductSlot(productImages.length);

  return (
    <section className="ec-workbench" aria-label="电商生图工作台">
      <div className="ec-workbench-heading">
        <strong>把商品图变成上新视觉</strong>
        <span>上传产品图与参考图，快速生成主图、详情图和营销素材。</span>
      </div>

      <div className="ec-upload-deck">
        <UploadCard
          role="product"
          tilt="right"
          title={productImages.length ? `继续补充：${nextSlot.label}` : '产品图'}
          hint={productImages.length ? nextSlot.hint : '建议先上传正面主视图'}
          preview={deck.productRail.at(-1)}
          onClick={() => productInputRef.current?.click()}
        />
        <span className="ec-upload-operator" aria-hidden="true">×</span>
        <UploadCard
          role="reference"
          tilt="left"
          title={refImages.length ? '继续添加参考图' : '参考图'}
          hint={refImages.length ? `已添加 ${refImages.length} 张，可继续批量添加` : '竞品图、风格图、店铺详情图'}
          preview={deck.referenceRail.at(-1)}
          onClick={() => referenceInputRef.current?.click()}
        />
      </div>

      <div className="ec-media-rails">
        <ImageRail title="产品图" role="product" items={deck.productRail} onAdd={() => productInputRef.current?.click()} onRemove={onRemoveProduct} />
        <ImageRail title="参考图" role="reference" items={deck.referenceRail} onAdd={() => referenceInputRef.current?.click()} onRemove={onRemoveReference} />
      </div>

      <div className="hero-textarea-wrap ec-brief-input">
        <textarea className="hero-textarea" value={description} onChange={event => onDescriptionChange(event.target.value)} placeholder=" " />
        <div className="custom-placeholder">
          <div className="ph-main">补充商品信息（可选）：名称、卖点、材质、用途或希望避免出现的内容</div>
          <div className="ph-sub">例如：白色陶瓷马克杯，350ml，木质把手；画面干净，不出现错误文字或多余配件</div>
        </div>
      </div>

      <input ref={productInputRef} type="file" accept="image/*" multiple hidden onChange={onProductUpload} />
      <input ref={referenceInputRef} type="file" accept="image/*" multiple hidden onChange={onReferenceUpload} />
    </section>
  );
}
