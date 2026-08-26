import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Clapperboard, Maximize2, Plus, Sparkles, UserRound, X } from 'lucide-react';
import ResponsiveImage from '../../../components/ResponsiveImage.jsx';
import ImageMentionPicker from '../../../components/creation/ImageMentionPicker.jsx';
import MentionPromptField from '../../../components/creation/MentionPromptField.jsx';
import { buildImageMentions, removeImageMention } from '../../../components/creation/imageMentionModel.js';
import VideoProjectDeliveryDialog from '../../VideoStudio/VideoProjectDeliveryDialog.jsx';
import { DELIVERY_SOURCE_SURFACES, deliverableRefFrom } from '../../VideoStudio/videoDeliveryModel.js';
import { buildUploadDeck, nextProductSlot } from './workbenchState';
import { ECOMMERCE_ABILITY_RECIPES } from '../../../../shared/ecommerceAbilityRecipes.mjs';
import { productionCaseById } from '../productionCaseCatalog.js';
import { EcommerceAddCard, EcommerceImageCard } from './components/EcommerceAssetCards.jsx';

const ABILITY_RESULT_COPY = {
  product_suite: '生成整套主图与详情视觉',
  anything_tryon: '把商品自然穿到模特身上',
};

const TRYON_AUTO_DWELL_MS = 9000;
const TRYON_MANUAL_DWELL_MS = 15000;

function AbilitySelectorFan({ recipeId }) {
  const showcaseCase = productionCaseById(recipeId === 'anything_tryon' ? 'tryon-angles' : 'product-suite');
  const assets = (showcaseCase?.assets || [])
    .filter(asset => asset.displayRole === 'selectorPreview' || asset.selectorPreview === true)
    .slice(0, 3);
  return (
    <span className={`ec-ability-selector-fan ${assets.length === 1 ? 'is-single' : ''}`} aria-hidden="true">
      {assets.map((asset, index) => (
        <span key={asset.id} className={`ec-ability-selector-fan-card fan-card-${index}`} style={{ '--case-ratio': asset.ratio.replace(':', ' / ') }}>
          <ResponsiveImage src={asset.src} variant="thumb" ratio={asset.ratio} alt="" imgStyle={{ objectFit: assets.length === 1 ? 'contain' : 'cover' }} />
        </span>
      ))}
    </span>
  );
}

const ImageCard = EcommerceImageCard;
const AddCard = EcommerceAddCard;

// P2 跨域投递入口 b：电商套图成图卡 → 「发往视频项目」。
// 仅当图片带 canonical 引用（projectId + projectAssetId + 内容哈希，
// 如素材库/商品档案带入的图）时浮出按钮；投递链路复用既有 API。
function DeliverableImageCard({ image, deliverLabel, onRemove, onSendToVideo }) {
  const ref = deliverableRefFrom(image);
  if (!ref) return <ImageCard role={deliverLabel.role} image={image} label={deliverLabel.label} index={deliverLabel.index} onRemove={onRemove} />;
  return (
    <span className="ec-xhs-card-deliver-wrap" data-video-delivery-card="true">
      <ImageCard role={deliverLabel.role} image={image} label={deliverLabel.label} index={deliverLabel.index} onRemove={onRemove} />
      <button type="button" className="ec-xhs-card-send-video" aria-label={`发往视频项目：${deliverLabel.label}`} title="把这张成图发往视频项目（可绑镜头首帧）" onClick={() => onSendToVideo?.(ref)}>
        <Clapperboard size={11} /><span>发往视频</span>
      </button>
    </span>
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
  const slides = [
    {
      id: 'angles',
      eyebrow: '多视角成片',
      title: '一套穿搭，拍出完整时尚角度',
      description: '正面、四分之三、侧面与背面都保留完整造型，适合商品页和广告投放。',
      // 尺寸审计(2026-08 二次复核)：旧竖条平铺源图(475×1254，1:2.64)为裁剪条图，禁止上屏；
      // 源卡改用同套完整平铺原图 editorial-flatlay-matched-v1.webp(720×900，4:5)，与四角度街拍同套服饰。
      source: { src: '/images/home/tryon-showcase/editorial-flatlay-matched-v1.webp', label: '平铺穿搭' },
      // 四张角度照片组：正面 / 四分之三 / 侧面 / 背面（全部为完整原图，contain 不裁剪）
      results: [
        { src: '/images/home/tryon-showcase/angle-front.png', label: '正面' },
        { src: '/images/home/tryon-showcase/angle-side.png', label: '四分之三' },
        { src: '/images/home/tryon-showcase/angle-motion.png', label: '侧面' },
        { src: '/images/home/tryon-showcase/angle-back.png', label: '背面' },
      ],
    },
    {
      id: 'reference',
      eyebrow: '场景上身',
      title: '让完整穿搭进入真实街拍场景',
      description: '从头到脚保留商品版型与搭配关系，用动态姿态呈现可投放的时尚画面。',
      // 审计结论：旧 reference-*.png(315~390×1254) 为裁剪条图，不得再上头图；
      // 改用同套生产原图（1086×1448，完整输出）：平铺穿搭 → ＋ → 模特街拍原图 → 弧箭头 → 上身效果。
      source: { src: '/images/home/tryon-showcase/editorial-flatlay-v3.webp', label: '平铺穿搭' },
      reference: { src: '/images/home/tryon-showcase/editorial-model-v3.webp', label: '模特街拍原图' },
      results: [{ src: '/images/home/tryon-showcase/editorial-street-result-v3.webp', label: '上身效果街拍' }],
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
      return { ...current.items[nextIndex], index: nextIndex, items: current.items };
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
  const previewItems = slides
    .flatMap(item => [item.source, ...(item.reference ? [item.reference] : []), ...item.results])
    .filter(Boolean);
  const chooseSlide = index => {
    setActiveSlide(index);
    setManualRevision(revision => revision + 1);
  };
  const openPreview = item => {
    const index = previewItems.findIndex(preview => preview.src === item.src);
    setPreviewItem({ ...previewItems[index], index, items: previewItems });
  };
  const movePreview = direction => setPreviewItem(current => {
    const nextIndex = (current.index + direction + current.items.length) % current.items.length;
    return { ...current.items[nextIndex], index: nextIndex, items: current.items };
  });
  // 基准版式卡片：原始整图直接呈现，object-fit: contain，不裁剪。
  const renderCard = (item, className) => (
    <button key={item.id || item.src} type="button" className={className} onClick={() => openPreview(item)} aria-label={`放大查看${item.label}`}>
      <img src={item.src} alt={item.label} loading="lazy" />
      <span>{item.label}</span>
      <Maximize2 size={13} />
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
          {/* 基准版式：平铺穿搭 → ＋ → 模特街拍原图 → 弧形箭头 → 上身效果街拍 */}
          <div className="ec-tryon-flow">
            {renderCard(slide.source, 'ec-tryon-flow-card is-source')}
            {slide.reference && (
              <>
                <span className="ec-tryon-flow-plus" aria-hidden="true"><Plus size={14} /></span>
                {renderCard(slide.reference, 'ec-tryon-flow-card is-reference')}
              </>
            )}
            {/* 细弧箭头：细线 + 沿流向渐显（尾淡头浓），弱化不抢戏 */}
            <span className="ec-tryon-flow-arrow" aria-hidden="true">
              <svg viewBox="0 0 64 32" fill="none">
                <defs>
                  <linearGradient id="ec-tryon-arrow-fade" x1="3" y1="27" x2="60" y2="10" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="currentColor" stopOpacity="0.12" />
                    <stop offset="0.55" stopColor="currentColor" stopOpacity="0.5" />
                    <stop offset="1" stopColor="currentColor" stopOpacity="0.95" />
                  </linearGradient>
                </defs>
                <path d="M3 27 C 20 23, 42 19, 58.5 10.5" stroke="url(#ec-tryon-arrow-fade)" strokeWidth="1.7" strokeLinecap="round" />
                <path d="M51 7 L59.5 10 L55.5 17.5" stroke="currentColor" strokeOpacity="0.9" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div className={`ec-tryon-flow-results count-${slide.results.length}`}>
              {slide.results.map((result, index) => renderCard(result, `ec-tryon-flow-card is-result result-${index}`))}
            </div>
          </div>
        </div>
      </section>
      {previewItem && (
        <div className="ec-tryon-preview-modal" role="dialog" aria-modal="true" aria-label={`${previewItem.label}大图`} onMouseDown={event => { if (event.target === event.currentTarget) setPreviewItem(null); }}>
          <div className="ec-tryon-preview-dialog">
            <button type="button" className="ec-tryon-preview-close" onClick={() => setPreviewItem(null)} aria-label="关闭大图"><X size={20} /></button>
            <button type="button" className="ec-tryon-preview-previous" onClick={() => movePreview(-1)} aria-label="查看上一张"><ArrowLeft size={20} /></button>
            <img src={previewItem.src} alt={`${previewItem.label}大图`} />
            <button type="button" className="ec-tryon-preview-next" onClick={() => movePreview(1)} aria-label="查看下一张"><ArrowRight size={20} /></button>
            <div><strong>{previewItem.label}</strong><span>作品库原图 · 放大查看完整画面</span></div>
          </div>
        </div>
      )}
    </>
  );
}

function ProductSuiteShowcase() {
  const [previewIndex, setPreviewIndex] = useState(-1);
  const suiteCase = productionCaseById('product-suite');
  const finalComposite = suiteCase.assets.find(asset => asset.displayRole === 'finalComposite');
  const previewItems = [finalComposite].filter(Boolean);
  useEffect(() => {
    if (previewIndex < 0) return undefined;
    const onKeyDown = event => {
      if (event.key === 'Escape') setPreviewIndex(-1);
    };
    globalThis.addEventListener?.('keydown', onKeyDown);
    return () => globalThis.removeEventListener?.('keydown', onKeyDown);
  }, [previewIndex, previewItems.length]);
  const preview = previewItems[previewIndex];
  return <><section className="ec-product-suite-showcase" aria-label="商品套图效果预览">
    <div className="ec-product-suite-showcase-copy"><span className="ec-showcase-kicker">真实套图</span><strong>从一款商品，到可直接投放的完整视觉</strong><span>同一副珍珠白耳机，主图建立质感，场景图讲使用价值，详情长图解释功能与工艺。</span></div>
    <div className="ec-product-suite-showcase-visual">
      <button type="button" className="ec-product-suite-final" onClick={() => setPreviewIndex(0)} aria-label={`放大查看${finalComposite.label}`}><ResponsiveImage src={finalComposite.src} variant="display" ratio={finalComposite.ratio} alt={finalComposite.label} imgStyle={{ objectFit: 'contain' }} /><Maximize2 size={16} /></button>
    </div>
  </section>{preview && <div className="ec-tryon-preview-modal" role="dialog" aria-modal="true" aria-label={`${preview.label}大图`} onMouseDown={event => { if (event.target === event.currentTarget) setPreviewIndex(-1); }}>
    <div className="ec-tryon-preview-dialog">
      <button type="button" className="ec-tryon-preview-close" onClick={() => setPreviewIndex(-1)} aria-label="关闭大图"><X size={20} /></button>
      <ResponsiveImage src={preview.src} variant="display" ratio={preview.ratio} alt={`${preview.label}大图`} imgStyle={{ objectFit: 'contain' }} />
      <div><strong>{preview.label}</strong><span>正式生产套图成片</span></div>
    </div>
  </div>}</>;
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
  const [videoDelivery, setVideoDelivery] = useState(null); // P2: {refs, surface}
  const handleSendToVideoProject = ref => setVideoDelivery({ refs: [ref], surface: DELIVERY_SOURCE_SURFACES.ecommerceWorkbench });
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
  // 粘贴图片进提示词 → 归位到商品素材槽，而不是留在输入框。
  const handlePromptFilesPasted = files => {
    if (!files?.length) return;
    onProductUpload?.({ target: { files, value: '' } });
  };
  return (
    <section className="ec-workbench" aria-label="电商生图工作台">
      {showAbilitySelector && (
        <div className="ec-ability-selector" role="tablist" aria-label="选择电商创作能力">
          <div className="ec-ability-selector-options">
            {ECOMMERCE_ABILITY_RECIPES.map(recipe => {
              const selected = recipe.id === abilityRecipeId;
              return (
                <button type="button" role="tab" key={recipe.id} className={`ec-ability-selector-option ${recipe.id === 'anything_tryon' ? 'is-wide-showcase' : ''} ${selected ? 'is-selected' : ''}`} aria-selected={selected} onClick={() => selectRecipe(recipe.id)}>
                  <AbilitySelectorFan recipeId={recipe.id} />
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
              {deck.productRail.map((image, index) => <DeliverableImageCard key={`product-${image.url}-${index}`} image={image} deliverLabel={{ role: 'product', label: nextProductSlot(index).label, index }} onRemove={onRemoveProduct} onSendToVideo={handleSendToVideoProject} />)}
              <AddCard role="product" label={productImages.length ? nextSlot.label : '产品图'} meta={productImages.length ? '建议补充' : '清晰商品图'} title={nextSlot.hint} onClick={() => productInputRef.current?.click()} />
              <span className="ec-xhs-multiply" aria-hidden="true">×</span>
              {deck.referenceRail.map((image, index) => <DeliverableImageCard key={`reference-${image.url}-${index}`} image={image} deliverLabel={{ role: 'reference', label: `参考图 ${index + 1}`, index }} onRemove={onRemoveReference} onSendToVideo={handleSendToVideoProject} />)}
              <AddCard role="reference" label="参考图" meta={refImages.length ? '继续添加' : '竞品或风格'} title="可上传竞品主图、详情图、店铺视觉或希望借鉴的风格图片" onClick={() => referenceInputRef.current?.click()} />
            </div>
          )}
        </div>

        <div className="ec-textarea-wrap ec-xhs-prompt" onClick={() => promptFieldRef.current?.focus()}>
          {!description && <div className="ec-textarea-placeholder ec-xhs-placeholder ec-xhs-prompt-hints"><span className="ec-placeholder-line">{isTryOn ? '描述人物、穿搭关系和使用场景，一句话就够了' : promptTitle}</span>{(isTryOn ? ['例：年轻女性穿着整套搭配，在城市街区自然行走', '例：保留商品颜色与版型，生成 3 张不同姿态'] : promptExamples).slice(0, 2).map((example, index) => <span key={example} className={`ec-placeholder-line ${index === 0 ? 'ec-xhs-example-first' : ''}`}>{example}</span>)}</div>}
          <MentionPromptField ref={promptFieldRef} value={description} mentions={selectedMentionImages} onChange={value => onDescriptionChange(value)} onFilesPasted={handlePromptFilesPasted} className={!description ? 'ec-empty' : ''} placeholder="" aria-label="补充商品信息和生成要求" />
        </div>
        <div className="ec-workbench-mention-row"><ImageMentionPicker images={mentionImages} selectedImages={selectedMentionImages} selectionMode="insert" onToggle={handleMentionToggle} /></div>
      </div>

      <input ref={productInputRef} type="file" accept="image/*" multiple hidden onChange={onProductUpload} />
      <input ref={referenceInputRef} type="file" accept="image/*" multiple hidden onChange={onReferenceUpload} />
      <input ref={itemsInputRef} type="file" accept="image/*" multiple hidden onChange={event => onRoleUpload?.('items', event)} />
      <input ref={personInputRef} type="file" accept="image/*" hidden onChange={event => onRoleUpload?.('person', event)} />
      <input ref={sceneInputRef} type="file" accept="image/*" hidden onChange={event => onRoleUpload?.('scene', event)} />

      {/* P2: 跨域投递对话框（电商套图 → 视频项目） */}
      <VideoProjectDeliveryDialog
        open={Boolean(videoDelivery)}
        refs={videoDelivery?.refs || []}
        surface={videoDelivery?.surface || ''}
        onClose={() => setVideoDelivery(null)}
      />
    </section>
  );
}
