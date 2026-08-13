import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ImagePlus, Maximize2, Plus, Sparkles, UserRound, X } from 'lucide-react';
import ResponsiveImage from '../../../components/ResponsiveImage.jsx';
import ImageMentionPicker from '../../../components/creation/ImageMentionPicker.jsx';
import MentionPromptField from '../../../components/creation/MentionPromptField.jsx';
import { buildImageMentions, removeImageMention } from '../../../components/creation/imageMentionModel.js';
import { buildUploadDeck, nextProductSlot } from './workbenchState';
import { ECOMMERCE_ABILITY_RECIPES } from '../../../../shared/ecommerceAbilityRecipes.mjs';
import { productionCaseById } from '../productionCaseCatalog.js';

const ABILITY_RESULT_COPY = {
  product_suite: '生成整套主图与详情视觉',
  anything_tryon: '把商品自然穿到模特身上',
};

const TRYON_AUTO_DWELL_MS = 9000;
const TRYON_MANUAL_DWELL_MS = 15000;

function ImageCard({ role, image, label, index, onRemove }) {
  return (
    <div className={`ec-xhs-upload-card ec-xhs-image-card ec-xhs-card-${role}`}>
      <ResponsiveImage src={image.url} variant="thumb" ratio="4:5" alt={label} style={{ width: '100%', height: '100%', background: '#fff' }} imgStyle={{ objectFit: 'cover' }} />
      <span className="ec-xhs-card-caption">{label}</span>
      {image.status && <span className="ec-xhs-card-status">{image.status}</span>}
      {!image.locked && (
        <button type="button" className="ec-xhs-card-remove" aria-label={`移除${label}`} onClick={() => onRemove(index)}>
          <X size={10} />
        </button>
      )}
    </div>
  );
}

function AddCard({ role, label, meta, onClick, title, optional = false }) {
  return (
    <button type="button" className={`ec-xhs-upload-card ec-xhs-add-card ec-xhs-card-${role}`} onClick={onClick} title={title}>
      <span className="ec-xhs-add-icon"><ImagePlus size={20} /></span>
      {optional && <span className="ec-xhs-optional">可选</span>}
      <span className="ec-xhs-card-title">{label}</span>
      <span className="ec-xhs-card-meta">{meta}</span>
    </button>
  );
}

function TryOnImageStack({ images, label, role, onRemove, onAdd, max = 5 }) {
  return (
    <div className={`ec-tryon-lane ec-tryon-lane-${role}`}>
      <div className="ec-tryon-lane-head"><span>{label}</span><small>{images.length}/{max}</small></div>
      <div className="ec-tryon-lane-assets">
        {images.map((image, index) => <ImageCard key={`${role}-${image.url}-${index}`} role={role} image={image} label={`${label}${index + 1}`} index={index} onRemove={onRemove} />)}
        {images.length < max && <AddCard role={role} label={images.length ? '继续添加' : '添加素材'} meta={role === 'items' ? '衣物、鞋包、配饰' : role === 'person' ? '人物全身参考' : '空间与光线参考'} optional={role !== 'items'} onClick={onAdd} title={`添加${label}`} />}
      </div>
    </div>
  );
}

function TryOnShowcase({ personMode }) {
  const [activeSlide, setActiveSlide] = useState(personMode === 'reference' ? 1 : 0);
  const [manualRevision, setManualRevision] = useState(0);
  const [previewItem, setPreviewItem] = useState(null);
  const angleCase = productionCaseById('tryon-angles');
  const referenceCase = productionCaseById('tryon-reference');
  const slides = [
    {
      id: 'angles',
      eyebrow: '多视角成片',
      title: '一套商品，生成不同展示角度',
      description: '正面、侧面、背面与动态姿态，一次形成可选成片。',
      source: angleCase.assets.find(asset => asset.role === 'source'),
      results: angleCase.assets.filter(asset => asset.role === 'result'),
    },
    {
      id: 'reference',
      eyebrow: '参考模特',
      title: '保留人物气质，把商品准确换上身',
      description: '人物和场景保持连贯，商品颜色、版型与搭配关系清晰可见。',
      source: referenceCase.assets.find(asset => asset.role === 'source'),
      reference: referenceCase.assets.find(asset => asset.role === 'reference'),
      results: referenceCase.assets.filter(asset => asset.role === 'result'),
    },
  ];

  useEffect(() => {
    setActiveSlide(personMode === 'reference' ? 1 : 0);
  }, [personMode]);

  useEffect(() => {
    const media = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (media?.matches) return undefined;
    const delay = manualRevision ? TRYON_MANUAL_DWELL_MS : TRYON_AUTO_DWELL_MS;
    const timer = globalThis.setTimeout(() => {
      setActiveSlide(current => (current + 1) % slides.length);
      setManualRevision(0);
    }, delay);
    return () => globalThis.clearTimeout(timer);
  }, [activeSlide, manualRevision]);

  useEffect(() => {
    if (!previewItem) return undefined;
    const changePreview = direction => setPreviewItem(current => {
      if (!current) return current;
      const nextIndex = (current.index + direction + current.items.length) % current.items.length;
      return { ...current.items[nextIndex], index: nextIndex, items: current.items, title: current.title, description: current.description };
    });
    const close = event => {
      if (event.key === 'Escape') setPreviewItem(null);
      if (event.key === 'ArrowLeft') changePreview(-1);
      if (event.key === 'ArrowRight') changePreview(1);
    };
    globalThis.addEventListener?.('keydown', close);
    return () => globalThis.removeEventListener?.('keydown', close);
  }, [previewItem]);

  const slide = slides[activeSlide];
  const previewItems = [slide.source, slide.reference, ...slide.results].filter(Boolean);
  const chooseSlide = index => {
    setActiveSlide(index);
    setManualRevision(revision => revision + 1);
  };
  const openPreview = item => setPreviewItem({ ...item, index: previewItems.indexOf(item), items: previewItems, title: slide.title, description: slide.description });
  const movePreview = direction => setPreviewItem(current => {
    const nextIndex = (current.index + direction + current.items.length) % current.items.length;
    return { ...current.items[nextIndex], index: nextIndex, items: current.items, title: current.title, description: current.description };
  });
  const renderCard = (item, className, alt) => (
    <button key={item.id || item.src} type="button" className={`ec-tryon-showcase-card ${className}`} style={{ '--case-ratio': item.ratio.replace(':', ' / ') }} onClick={() => openPreview(item)} aria-label={`放大查看${item.label}`}>
      <ResponsiveImage src={item.src} variant="display" ratio={item.ratio} alt={alt || item.label} imgStyle={{ objectFit: 'contain' }} />
      <span>{item.label}</span><Maximize2 size={14} />
    </button>
  );
  return (
    <>
      <section className="ec-tryon-showcase" aria-label="万物上身效果预览">
        <div className="ec-tryon-showcase-copy">
          <span className="ec-showcase-kicker">{slide.eyebrow}</span>
          <strong>{slide.title}</strong>
          <span>{slide.description}</span>
          <div className="ec-tryon-showcase-controls" role="tablist" aria-label="万物上身案例">
            {slides.map((item, index) => <button type="button" role="tab" key={item.id} aria-label={item.title} aria-selected={index === activeSlide} className={index === activeSlide ? 'is-active' : ''} onClick={() => chooseSlide(index)} />)}
          </div>
        </div>
        <div className={`ec-tryon-showcase-visual is-${slide.id}`} aria-live="polite">
          {renderCard(slide.source, 'ec-tryon-showcase-source-card', '商品与穿搭素材')}
          {slide.reference && (
            <>
              <span className="ec-tryon-showcase-operator" aria-hidden="true"><Plus size={20} /></span>
              {renderCard(slide.reference, 'ec-tryon-showcase-reference-card', '参考模特')}
            </>
          )}
          <span className="ec-tryon-showcase-operator" aria-hidden="true"><ArrowRight size={22} /></span>
          <div className={`ec-tryon-showcase-results count-${slide.results.length}`}>
            {slide.results.map((result, index) => renderCard(result, `ec-tryon-result-card card-${index}`, result.label))}
          </div>
        </div>
      </section>
      {previewItem && (
        <div className="ec-tryon-preview-modal" role="dialog" aria-modal="true" aria-label={`${previewItem.label}大图`} onMouseDown={event => { if (event.target === event.currentTarget) setPreviewItem(null); }}>
          <div className="ec-tryon-preview-dialog">
            <button type="button" className="ec-tryon-preview-close" onClick={() => setPreviewItem(null)} aria-label="关闭大图"><X size={20} /></button>
            <button type="button" className="ec-tryon-preview-previous" onClick={() => movePreview(-1)} aria-label="查看上一张"><ArrowLeft size={20} /></button>
            <ResponsiveImage src={previewItem.src} variant="display" ratio={previewItem.ratio} alt={`${previewItem.label}大图`} imgStyle={{ objectFit: 'contain' }} />
            <button type="button" className="ec-tryon-preview-next" onClick={() => movePreview(1)} aria-label="查看下一张"><ArrowRight size={20} /></button>
            <div><strong>{previewItem.label}</strong><span>{previewItem.description}</span></div>
          </div>
        </div>
      )}
    </>
  );
}

function ProductSuiteShowcase() {
  const suiteCase = productionCaseById('product-suite');
  const source = suiteCase.assets.find(asset => asset.role === 'source');
  const results = suiteCase.assets.filter(asset => asset.role === 'result');
  return <section className="ec-product-suite-showcase" aria-label="商品套图效果预览">
    <div className="ec-product-suite-showcase-copy"><span className="ec-showcase-kicker">一套成片</span><strong>从商品素材，到一组能直接使用的视觉</strong><span>统一商品身份、光影和版式语言，同时生成主图与详情视觉。</span></div>
    <div className="ec-product-suite-showcase-visual">
      <span className="ec-product-suite-source"><ResponsiveImage src={source.src} ratio={source.ratio} alt={source.label} /></span>
      <span className="ec-tryon-showcase-operator" aria-hidden="true"><ArrowRight size={22} /></span>
      <div className="ec-product-suite-results">{results.map((result, index) => <span key={`${result.src}:${index}`} className={`result-${index}`}><ResponsiveImage src={result.src} ratio={result.ratio} alt={result.label} /><b>{result.label}</b></span>)}</div>
    </div>
  </section>;
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
  roleImages = { items: [], person: [], scene: [] },
  abilityRecipeId = 'product_suite',
  onAbilityRecipeChange,
  onRoleUpload,
  onRoleRemove,
  personMode = 'smart',
  onPersonModeChange,
  showAbilitySelector = true,
  heading = '上传商品素材，生成整套电商视觉',
  subheading = '先放入一张清晰商品图；补充角度或参考图，能让画面更贴近你的商品。',
  promptTitle = '描述想生成的商品视觉，一句话就够了',
  promptExamples = ['例：为白色陶瓷杯生成高级简约的电商详情页', '例：保留商品结构，换成清透夏日场景'],
}) {
  const productInputRef = useRef(null);
  const referenceInputRef = useRef(null);
  const itemsInputRef = useRef(null);
  const personInputRef = useRef(null);
  const sceneInputRef = useRef(null);
  const promptFieldRef = useRef(null);
  const [mentionedIds, setMentionedIds] = useState([]);
  const isTryOn = abilityRecipeId === 'anything_tryon';
  const deck = buildUploadDeck({ productImages, refImages });
  const nextSlot = nextProductSlot(productImages.length);
  const tryOnImages = {
    items: Array.isArray(roleImages.items) ? roleImages.items : [],
    person: Array.isArray(roleImages.person) ? roleImages.person : [],
    scene: Array.isArray(roleImages.scene) ? roleImages.scene : [],
  };
  const mentionImages = isTryOn
    ? [
      ...tryOnImages.items.map((image, index) => ({ ...image, id: image.id || `items-${index}`, name: `商品${index + 1}`, role: 'items' })),
      ...tryOnImages.person.map((image, index) => ({ ...image, id: image.id || `person-${index}`, name: `模特参考${index + 1}`, role: 'person' })),
      ...tryOnImages.scene.map((image, index) => ({ ...image, id: image.id || `scene-${index}`, name: `场景参考${index + 1}`, role: 'scene' })),
    ]
    : [
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
    if (selected) onDescriptionChange(removeImageMention(description, image.label));
    else promptFieldRef.current?.insertMention(image.label);
  };

  const selectRecipe = id => onAbilityRecipeChange?.(id);
  return (
    <section className="ec-workbench" aria-label="电商生图工作台">
      {showAbilitySelector && (
        <div className="ec-ability-selector" role="tablist" aria-label="选择电商创作能力">
          <div className="ec-ability-selector-options">
            {ECOMMERCE_ABILITY_RECIPES.map(recipe => {
              const selected = recipe.id === abilityRecipeId;
              return (
                <button type="button" role="tab" key={recipe.id} className={`ec-ability-selector-option ${selected ? 'is-selected' : ''}`} aria-selected={selected} onClick={() => selectRecipe(recipe.id)}>
                  <span className="ec-ability-selector-thumb"><ResponsiveImage src={recipe.id === 'anything_tryon' ? '/images/home/tryon-showcase/reference-result.png' : '/images/home/entry-ecommerce.png'} variant="thumb" ratio="1:1" alt="" /></span>
                  <span className="ec-ability-selector-copy"><strong>{recipe.label}</strong><span>{ABILITY_RESULT_COPY[recipe.id]}</span></span>
                  {selected && <Check size={16} className="ec-ability-selector-check" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="ec-workbench-heading">
        <strong>{isTryOn ? '把商品放到模特身上，生成可交付穿搭' : heading}</strong>
        <span>{isTryOn ? '商品定细节，模特定呈现。' : subheading}</span>
      </div>

      {isTryOn && <TryOnShowcase personMode={personMode} />}
      {!isTryOn && <ProductSuiteShowcase />}

      <div className={`ec-xhs-composer ${isTryOn ? 'is-tryon-composer' : ''}`}>
        <div className="ec-xhs-media-column">
          {isTryOn ? (
            <div className="ec-tryon-input-stage">
              <TryOnImageStack role="items" label="商品与穿搭" images={tryOnImages.items} max={5} onAdd={() => itemsInputRef.current?.click()} onRemove={index => onRoleRemove?.('items', index)} />
              <div className="ec-tryon-person-lane">
                <div className="ec-tryon-person-mode" role="group" aria-label="模特生成方式">
                  <button type="button" className={personMode === 'smart' ? 'is-selected' : ''} onClick={() => onPersonModeChange?.('smart')}><Sparkles size={13} />智能模特</button>
                  <button type="button" className={personMode === 'reference' ? 'is-selected' : ''} onClick={() => onPersonModeChange?.('reference')}><UserRound size={13} />参考模特</button>
                </div>
                {personMode === 'reference' && <TryOnImageStack role="person" label="模特参考" images={tryOnImages.person} max={1} onAdd={() => personInputRef.current?.click()} onRemove={index => onRoleRemove?.('person', index)} />}
                {personMode === 'smart' && <div className="ec-tryon-smart-note"><UserRound size={18} /><div><strong>智能匹配模特</strong><span>按商品版型匹配人物比例与姿态</span></div></div>}
              </div>
              <TryOnImageStack role="scene" label="场景参考" images={tryOnImages.scene} max={1} onAdd={() => sceneInputRef.current?.click()} onRemove={index => onRoleRemove?.('scene', index)} />
            </div>
          ) : (
            <div className="ec-xhs-media-strip">
              {deck.productRail.map((image, index) => <ImageCard key={`product-${image.url}-${index}`} role="product" image={image} label={nextProductSlot(index).label} index={index} onRemove={onRemoveProduct} />)}
              <AddCard role="product" label={productImages.length ? nextSlot.label : '产品图'} meta={productImages.length ? '建议补充' : '清晰商品图'} title={nextSlot.hint} onClick={() => productInputRef.current?.click()} />
              <span className="ec-xhs-multiply" aria-hidden="true">×</span>
              {deck.referenceRail.map((image, index) => <ImageCard key={`reference-${image.url}-${index}`} role="reference" image={image} label={`参考图 ${index + 1}`} index={index} onRemove={onRemoveReference} />)}
              <AddCard role="reference" label="参考图" meta={refImages.length ? '继续添加' : '竞品或风格'} title="可上传竞品主图、详情图、店铺视觉或希望借鉴的风格图片" onClick={() => referenceInputRef.current?.click()} />
            </div>
          )}
        </div>

        <div className="ec-textarea-wrap ec-xhs-prompt">
          {!description && <div className="ec-textarea-placeholder ec-xhs-placeholder ec-xhs-prompt-hints"><span className="ec-placeholder-line">{isTryOn ? '描述人物、穿搭关系和使用场景，一句话就够了' : promptTitle}</span>{(isTryOn ? ['例：年轻女性穿着整套搭配，在城市街区自然行走', '例：保留商品颜色与版型，生成 3 张不同姿态'] : promptExamples).slice(0, 2).map((example, index) => <span key={example} className={`ec-placeholder-line ${index === 0 ? 'ec-xhs-example-first' : ''}`}>{example}</span>)}</div>}
          <MentionPromptField ref={promptFieldRef} value={description} mentions={selectedMentionImages} onChange={value => onDescriptionChange(value)} className={!description ? 'ec-empty' : ''} placeholder="" aria-label="补充商品信息和生成要求" />
        </div>
        <div className="ec-workbench-mention-row"><ImageMentionPicker images={mentionImages} selectedImages={selectedMentionImages} selectionMode="insert" onToggle={handleMentionToggle} /></div>
      </div>

      <input ref={productInputRef} type="file" accept="image/*" multiple hidden onChange={onProductUpload} />
      <input ref={referenceInputRef} type="file" accept="image/*" multiple hidden onChange={onReferenceUpload} />
      <input ref={itemsInputRef} type="file" accept="image/*" multiple hidden onChange={event => onRoleUpload?.('items', event)} />
      <input ref={personInputRef} type="file" accept="image/*" hidden onChange={event => onRoleUpload?.('person', event)} />
      <input ref={sceneInputRef} type="file" accept="image/*" hidden onChange={event => onRoleUpload?.('scene', event)} />
    </section>
  );
}
