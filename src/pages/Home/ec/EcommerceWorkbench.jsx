import React, { useRef } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { buildUploadDeck, nextProductSlot } from './workbenchState';

function ImageCard({ role, image, label, index, onRemove }) {
  return (
    <div className={`ec-xhs-upload-card ec-xhs-image-card ec-xhs-card-${role}`}>
      <img src={image.url} alt={label} />
      <span className="ec-xhs-card-caption">{label}</span>
      <button type="button" className="ec-xhs-card-remove" aria-label={`移除${label}`} onClick={() => onRemove(index)}>
        <X size={10} />
      </button>
    </div>
  );
}

function AddCard({ role, label, meta, onClick, title }) {
  return (
    <button type="button" className={`ec-xhs-upload-card ec-xhs-add-card ec-xhs-card-${role}`} onClick={onClick} title={title}>
      <span className="ec-xhs-add-icon"><ImagePlus size={20} /></span>
      <span className="ec-xhs-card-title">{label}</span>
      <span className="ec-xhs-card-meta">{meta}</span>
    </button>
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

      <div className="ec-xhs-composer">
        <div className="ec-xhs-media-column">
          <div className="ec-xhs-media-strip">
            {deck.productRail.map((image, index) => (
              <ImageCard
                key={`product-${image.url}-${index}`}
                role="product"
                image={image}
                label={nextProductSlot(index).label}
                index={index}
                onRemove={onRemoveProduct}
              />
            ))}
            <AddCard
              role="product"
              label={productImages.length ? nextSlot.label : '产品图'}
              meta={productImages.length ? '建议补充' : '正面图'}
              title={nextSlot.hint}
              onClick={() => productInputRef.current?.click()}
            />

            <span className="ec-xhs-multiply" aria-hidden="true">×</span>

            {deck.referenceRail.map((image, index) => (
              <ImageCard
                key={`reference-${image.url}-${index}`}
                role="reference"
                image={image}
                label={`参考图 ${index + 1}`}
                index={index}
                onRemove={onRemoveReference}
              />
            ))}
            <AddCard
              role="reference"
              label="参考图"
              meta={refImages.length ? '继续添加' : '风格参考'}
              title="可上传竞品主图、详情图、店铺视觉或希望借鉴的风格图片"
              onClick={() => referenceInputRef.current?.click()}
            />
          </div>
        </div>

        <div className="ec-textarea-wrap ec-xhs-prompt">
          {!description && (
            <div className="ec-textarea-placeholder ec-xhs-placeholder">
              <span className="ec-placeholder-line"><span className="ec-cursor ec-xhs-cursor" aria-hidden="true" />描述想生成的商品视觉，一句话就够了</span>
              <span className="ec-placeholder-line ec-xhs-example-first">例：为白色陶瓷杯生成高级简约的电商详情页</span>
              <span className="ec-placeholder-line">例：保留商品结构，替换成清透夏日场景</span>
            </div>
          )}
          <textarea
            value={description}
            onChange={event => onDescriptionChange(event.target.value)}
            className={!description ? 'ec-empty' : ''}
            aria-label="补充商品信息和生成要求"
          />
        </div>
      </div>

      <input ref={productInputRef} type="file" accept="image/*" multiple hidden onChange={onProductUpload} />
      <input ref={referenceInputRef} type="file" accept="image/*" multiple hidden onChange={onReferenceUpload} />
    </section>
  );
}
