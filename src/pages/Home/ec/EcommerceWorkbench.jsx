import React, { useRef, useState } from 'react';
import { ArrowRight, Check, ImagePlus, Sparkles, UserRound, X } from 'lucide-react';
import ResponsiveImage from '../../../components/ResponsiveImage.jsx';
import ImageMentionPicker from '../../../components/creation/ImageMentionPicker.jsx';
import MentionPromptField from '../../../components/creation/MentionPromptField.jsx';
import { appendImageMention, buildImageMentions, removeImageMention } from '../../../components/creation/imageMentionModel.js';
import { buildUploadDeck, nextProductSlot } from './workbenchState';
import { ECOMMERCE_ABILITY_RECIPES } from '../../../../shared/ecommerceAbilityRecipes.mjs';

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
  return (
    <section className="ec-tryon-showcase" aria-label="万物上身效果预览">
      <div className="ec-tryon-showcase-copy">
        <span className="ec-showcase-kicker"><Sparkles size={13} />能力预览</span>
        <strong>{personMode === 'reference' ? '复刻参考模特，精准上身' : '深度解析商品，自动组合穿搭'}</strong>
        <span>先看清输入与结果的关系，再开始上传你的真实素材。</span>
      </div>
      <div className="ec-tryon-showcase-visual">
        <div className="ec-tryon-showcase-source">
          <ResponsiveImage src="/images/home/ability-tryon-example-input.png" variant="thumb" ratio="1:1" alt="原创商品穿搭素材示例" />
          <span>商品与穿搭</span>
        </div>
        <div className="ec-tryon-showcase-arrow" aria-hidden="true"><ArrowRight size={22} /></div>
        <div className="ec-tryon-output-stack">
          {[0, 1, 2].map(index => (
            <div key={index} className={`ec-tryon-output-card ec-tryon-output-card-${index}`}>
              <ResponsiveImage src="/images/home/ability-tryon-example-output.png" variant="thumb" ratio="4:5" alt="原创模特上身效果示例" />
            </div>
          ))}
          <span className="ec-tryon-output-label">上身结果</span>
        </div>
      </div>
      <div className="ec-tryon-showcase-facts">
        <div><b>保留</b><span>商品颜色、材质、版型与数量</span></div>
        <div><b>生成</b><span>自然穿搭、接触关系与场景光线</span></div>
        <div><b>适合</b><span>上新主图、穿搭展示与场景化商品图</span></div>
      </div>
    </section>
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
    onDescriptionChange(selected ? removeImageMention(description, image.label) : appendImageMention(description, image.label));
  };

  const selectRecipe = id => onAbilityRecipeChange?.(id);
  return (
    <section className="ec-workbench" aria-label="电商生图工作台">
      {showAbilitySelector && (
        <div className="ec-ability-selector" aria-label="选择电商创作能力">
          <div className="ec-ability-selector-heading"><span><Sparkles size={14} />能力配方</span><small>默认商品套图保持原有流程；专用能力只改变输入角色和生成目标</small></div>
          <div className="ec-ability-selector-options">
            {ECOMMERCE_ABILITY_RECIPES.map(recipe => {
              const selected = recipe.id === abilityRecipeId;
              return (
                <button type="button" key={recipe.id} className={`ec-ability-selector-option ${selected ? 'is-selected' : ''}`} aria-pressed={selected} onClick={() => selectRecipe(recipe.id)}>
                  <span className="ec-ability-selector-thumb"><ResponsiveImage src={recipe.id === 'anything_tryon' ? '/images/home/ability-tryon-example-output.png' : '/images/home/entry-ecommerce.png'} variant="thumb" ratio="1:1" alt="" /></span>
                  <span className="ec-ability-selector-copy"><strong>{recipe.label}</strong><small>{recipe.summary}</small><em>{recipe.id === 'anything_tryon' ? '商品 + 模特 + 场景' : '产品图 × 参考图'}</em></span>
                  {selected && <Check size={16} className="ec-ability-selector-check" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="ec-workbench-heading">
        <strong>{isTryOn ? '把商品放到模特身上，生成可交付穿搭' : heading}</strong>
        <span>{isTryOn ? '商品决定真实细节，模特与场景决定呈现方式；一句话补充你希望看到的穿搭关系。' : subheading}</span>
      </div>

      {isTryOn && <TryOnShowcase personMode={personMode} />}

      <div className={`ec-xhs-composer ${isTryOn ? 'is-tryon-composer' : ''}`}>
        <div className="ec-xhs-media-column">
          {isTryOn ? (
            <div className="ec-tryon-input-stage">
              <TryOnImageStack role="items" label="商品与穿搭" images={tryOnImages.items} max={5} onAdd={() => itemsInputRef.current?.click()} onRemove={index => onRoleRemove?.('items', index)} />
              <span className="ec-tryon-lane-symbol" aria-hidden="true">×</span>
              <div className="ec-tryon-person-lane">
                <div className="ec-tryon-person-mode" role="group" aria-label="模特生成方式">
                  <button type="button" className={personMode === 'smart' ? 'is-selected' : ''} onClick={() => onPersonModeChange?.('smart')}><Sparkles size={13} />智能模特</button>
                  <button type="button" className={personMode === 'reference' ? 'is-selected' : ''} onClick={() => onPersonModeChange?.('reference')}><UserRound size={13} />参考模特</button>
                </div>
                {personMode === 'reference' && <TryOnImageStack role="person" label="模特参考" images={tryOnImages.person} max={1} onAdd={() => personInputRef.current?.click()} onRemove={index => onRoleRemove?.('person', index)} />}
                {personMode === 'smart' && <div className="ec-tryon-smart-note"><Sparkles size={17} /><div><strong>AI 生成匹配模特</strong><span>按商品类别、版型和场景自动匹配人物比例与姿态</span></div></div>}
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
          <MentionPromptField value={description} mentions={selectedMentionImages} onChange={value => onDescriptionChange(value)} className={!description ? 'ec-empty' : ''} placeholder="" aria-label="补充商品信息和生成要求" />
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
