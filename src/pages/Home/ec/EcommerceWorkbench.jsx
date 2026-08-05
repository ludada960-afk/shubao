import React, { useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import ResponsiveImage from '../../../components/ResponsiveImage.jsx';
import ImageMentionPicker from '../../../components/creation/ImageMentionPicker.jsx';
import MentionPromptField from '../../../components/creation/MentionPromptField.jsx';
import { appendImageMention, buildImageMentions, removeImageMention } from '../../../components/creation/imageMentionModel.js';
import { buildUploadDeck, nextProductSlot } from './workbenchState';

function ImageCard({ role, image, label, index, onRemove }) {
  return (
    <div className={`ec-xhs-upload-card ec-xhs-image-card ec-xhs-card-${role}`}>
      <ResponsiveImage src={image.url} variant="thumb" ratio="4:5" alt={label} style={{ width: '100%', height: '100%', background: '#fff' }} imgStyle={{ objectFit: 'cover' }} />
      <span className="ec-xhs-card-caption">{label}</span>
      {image.status && <span style={{ position: 'absolute', left: 6, top: 6, padding: '2px 6px', borderRadius: 999, background: image.locked ? 'rgba(17,24,39,.76)' : 'rgba(180,83,9,.86)', color: '#fff', fontSize: 8, fontWeight: 800 }}>{image.status}</span>}
      {!image.locked && (
        <button type="button" className="ec-xhs-card-remove" aria-label={`移除${label}`} onClick={() => onRemove(index)}>
          <X size={10} />
        </button>
      )}
    </div>
  );
}

function AddCard({ role, label, meta, onClick, title }) {
  return (
    <button type="button" className={`ec-xhs-upload-card ec-xhs-add-card ec-xhs-card-${role}`} onClick={onClick} title={title}>
      <span className="ec-xhs-add-icon"><ImagePlus size={20} /></span>
      {role === 'reference' && <span className="ec-xhs-optional">可选</span>}
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
  heading = '上传商品素材，生成整套电商视觉',
  subheading = '先放入一张清晰商品图；补充角度或参考图，能让画面更贴近你的商品。',
  promptTitle = '描述想生成的商品视觉，一句话就够了',
  promptExamples = ['例：为白色陶瓷杯生成高级简约的电商详情页', '例：保留商品结构，换成清透夏日场景'],
}) {
  const productInputRef = useRef(null);
  const referenceInputRef = useRef(null);
  const [mentionedIds, setMentionedIds] = useState([]);
  const deck = buildUploadDeck({ productImages, refImages });
  const nextSlot = nextProductSlot(productImages.length);
  const mentionImages = [
    ...deck.productRail.map((image, index) => ({ ...image, id: image.id || `product-${index}`, name: nextProductSlot(index).label, role: 'product' })),
    ...deck.referenceRail.map((image, index) => ({ ...image, id: image.id || `reference-${index}`, name: `参考图 ${index + 1}`, role: 'reference' })),
  ];
  const normalizedMentionImages = buildImageMentions(mentionImages);
  const selectedMentionImages = normalizedMentionImages.filter(image => mentionedIds.includes(String(image.sourceNodeId)));
  const handleMentionToggle = image => {
    const id = String(image?.id || image?.sourceNodeId || '');
    if (!id) return;
    const selected = mentionedIds.includes(id);
    setMentionedIds(previous => selected ? previous.filter(value => value !== id) : [...previous, id]);
    onDescriptionChange(selected ? removeImageMention(description, image.label) : appendImageMention(description, image.label));
  };

  return (
    <section className="ec-workbench" aria-label="电商生图工作台">
      <div className="ec-workbench-heading">
        <strong>{heading}</strong>
        <span>{subheading}</span>
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
              meta={productImages.length ? '建议补充' : '清晰商品图'}
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
              meta={refImages.length ? '继续添加' : '竞品或风格'}
              title="可上传竞品主图、详情图、店铺视觉或希望借鉴的风格图片"
              onClick={() => referenceInputRef.current?.click()}
            />
          </div>
        </div>

        <div className="ec-textarea-wrap ec-xhs-prompt">
          {!description && (
            <div className="ec-textarea-placeholder ec-xhs-placeholder ec-xhs-prompt-hints">
              <span className="ec-placeholder-line"><span className="ec-cursor ec-xhs-cursor" aria-hidden="true" />{promptTitle}</span>
              {promptExamples.slice(0, 2).map((example, index) => <span key={example} className={`ec-placeholder-line ${index === 0 ? 'ec-xhs-example-first' : ''}`}>{example}</span>)}
            </div>
          )}
          <MentionPromptField
            value={description}
            mentions={selectedMentionImages}
            onChange={value => onDescriptionChange(value)}
            className={!description ? 'ec-empty' : ''}
            placeholder=""
            aria-label="补充商品信息和生成要求"
          />
        </div>
        <div className="ec-workbench-mention-row">
          <ImageMentionPicker
            images={mentionImages}
            selectedImages={selectedMentionImages}
            selectionMode="insert"
            onToggle={handleMentionToggle}
          />
        </div>
      </div>

      <input ref={productInputRef} type="file" accept="image/*" multiple hidden onChange={onProductUpload} />
      <input ref={referenceInputRef} type="file" accept="image/*" multiple hidden onChange={onReferenceUpload} />
    </section>
  );
}
