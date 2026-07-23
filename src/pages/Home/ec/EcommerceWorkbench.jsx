import React, { useRef } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { buildUploadDeck, nextProductSlot } from './workbenchState';

function InlineUploadGroup({ role, title, hint, items, onAdd, onRemove }) {
  const isProduct = role === 'product';
  const nextSlot = isProduct ? nextProductSlot(items.length) : null;

  return (
    <div className={`ec-inline-upload-group ec-inline-upload-group-${role}`}>
      <span className="ec-inline-upload-label">{title}</span>
      <div className="ec-inline-upload-track" aria-label={`${title}上传区`}>
        {items.map((image, index) => (
          <div className="ref-thumb ec-inline-thumb" key={`${image.url}-${index}`}>
            <img src={image.url} alt={`${title}${index + 1}`} />
            {isProduct && <span className="ec-inline-thumb-label">{nextProductSlot(index).label}</span>}
            <button
              type="button"
              className="ref-remove"
              aria-label={`移除${title}第${index + 1}张`}
              onClick={() => onRemove(index)}
            >
              <X size={10} />
            </button>
          </div>
        ))}
        <button type="button" className="ref-add ec-inline-add" onClick={onAdd}>
          <ImagePlus size={15} />
          <span>{isProduct ? (items.length ? `继续${nextSlot.label}` : '产品图') : (items.length ? '继续添加' : '参考图')}</span>
          {!items.length && <small>{hint}</small>}
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

  return (
    <section className="ec-workbench" aria-label="电商生图工作台">
      <div className="ec-workbench-heading">
        <strong>把商品图变成上新视觉</strong>
        <span>上传产品图与参考图，快速生成主图、详情图和营销素材。</span>
      </div>

      <div className="hero-textarea-wrap ec-brief-input">
        <div className="ec-inline-upload-row">
          <InlineUploadGroup
            role="product"
            title="产品图"
            hint="建议先传正面主视图"
            items={deck.productRail}
            onAdd={() => productInputRef.current?.click()}
            onRemove={onRemoveProduct}
          />
          <span className="ec-upload-operator" aria-hidden="true">×</span>
          <InlineUploadGroup
            role="reference"
            title="参考图"
            hint="竞品图、风格图、详情图"
            items={deck.referenceRail}
            onAdd={() => referenceInputRef.current?.click()}
            onRemove={onRemoveReference}
          />
        </div>

        <textarea
          className="hero-textarea"
          value={description}
          onChange={event => onDescriptionChange(event.target.value)}
          placeholder=" "
          aria-label="补充商品信息"
        />
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
