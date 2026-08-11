import React, { useRef, useState } from 'react';
import {
  ArrowRight,
  Eye,
  ImagePlus,
  Info,
  MapPin,
  Shirt,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import ResponsiveImage from '../../../components/ResponsiveImage.jsx';
import ImageMentionPicker from '../../../components/creation/ImageMentionPicker.jsx';
import MentionPromptField from '../../../components/creation/MentionPromptField.jsx';
import { appendImageMention, buildImageMentions, removeImageMention } from '../../../components/creation/imageMentionModel.js';
import { ECOMMERCE_ABILITY_RECIPES } from '../../../../shared/ecommerceAbilityRecipes.mjs';
import { buildAbilityUploadDeck } from './workbenchState.js';

const NOOP = () => {};

function roleIcon(role) {
  if (role === 'person') return <UserRound size={16} strokeWidth={1.8} />;
  if (role === 'scene') return <MapPin size={16} strokeWidth={1.8} />;
  return <Shirt size={16} strokeWidth={1.8} />;
}

function recipePreview(recipe) {
  return recipe.examples?.[0]?.outputAssetUrls?.[0]
    || recipe.examples?.[0]?.inputAssetUrls?.[0]
    || '/images/home/entry-ecommerce.png';
}

function RecipeRail({ selectedId, onChange }) {
  return (
    <section className="ec-ability-rail" aria-label="电商能力配方">
      <div className="ec-ability-rail-heading">
        <div>
          <span className="ec-ability-kicker"><Sparkles size={13} />能力配方</span>
          <strong>按结果选择工作方式</strong>
        </div>
        <span className="ec-ability-rail-note">每种配方都会说明输入、保留与结果</span>
      </div>
      <div className="ec-ability-recipe-list" role="tablist" aria-label="电商能力配方选择">
        {ECOMMERCE_ABILITY_RECIPES.map(recipe => {
          const selected = recipe.id === selectedId;
          return (
            <button
              type="button"
              role="tab"
              aria-selected={selected}
              aria-label={`${recipe.label}：${recipe.summary}`}
              className={`ec-ability-recipe${selected ? ' is-selected' : ''}`}
              key={`${recipe.id}-${recipe.version}`}
              onClick={() => onChange(recipe.id)}
            >
              <span className="ec-ability-recipe-preview">
                <img src={recipePreview(recipe)} alt="" loading="eager" />
              </span>
              <span className="ec-ability-recipe-copy">
                <strong>{recipe.label}</strong>
                <span>{recipe.outcome}</span>
              </span>
              <span className="ec-ability-recipe-mark" aria-hidden="true">{selected ? '当前' : '选择'}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function AbilityInspector({ recipe }) {
  const [open, setOpen] = useState(recipe.id === 'anything_tryon');
  const example = recipe.examples?.[0] || null;
  const inputAsset = example?.inputAssetUrls?.[0] || '';
  const outputAsset = example?.outputAssetUrls?.[0] || '';
  React.useEffect(() => {
    setOpen(recipe.id === 'anything_tryon');
  }, [recipe.id]);
  return (
    <section className={`ec-ability-inspector${open ? ' is-open' : ''}`} aria-label={`${recipe.label}效果说明`}>
      <button
        type="button"
        className="ec-ability-inspector-toggle"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        <span className="ec-ability-inspector-title"><Eye size={15} />看懂结果</span>
        <span>{recipe.summary}</span>
        <Info size={14} aria-hidden="true" />
      </button>
      {open && (
        <div className="ec-ability-inspector-body">
          {inputAsset && outputAsset && (
            <div className="ec-ability-example-flow" aria-label={`${recipe.label}输入输出示例`}>
              <figure>
                <img src={inputAsset} alt={`${recipe.label}上传素材示例`} loading="eager" />
                <figcaption>上传素材</figcaption>
              </figure>
              <span className="ec-ability-example-arrow" aria-hidden="true"><ArrowRight size={17} /></span>
              <figure>
                <img src={outputAsset} alt={`${recipe.label}生成效果示例`} loading="eager" />
                <figcaption>生成效果</figcaption>
              </figure>
            </div>
          )}
          <div className="ec-ability-facts">
            <div><b>保留</b><span>{recipe.preserves.join('、')}</span></div>
            <div><b>结果</b><span>{recipe.outcome}</span></div>
            <div><b>适合</b><span>{recipe.bestFor.join('、')}</span></div>
          </div>
        </div>
      )}
    </section>
  );
}

function ImageCard({ image, label, index, onRemove, locked = false }) {
  return (
    <div className="ec-ability-image-card">
      <ResponsiveImage
        src={image.url}
        variant="thumb"
        ratio="1:1"
        alt={label}
        style={{ width: '100%', height: '100%', background: '#fff' }}
        imgStyle={{ objectFit: 'cover' }}
      />
      <span className="ec-ability-image-label">{label}</span>
      {!locked && (
        <button type="button" className="ec-ability-image-remove" aria-label={`移除${label}`} onClick={() => onRemove(index)}>
          <X size={11} />
        </button>
      )}
    </div>
  );
}

function AbilitySlot({ slot, inputRef, onUpload, onRemove, onModeChange }) {
  const isPerson = slot.id === 'person';
  return (
    <article className={`ec-ability-slot ec-ability-slot-${slot.id}`} data-slot={slot.id}>
      <header className="ec-ability-slot-header">
        <span className="ec-ability-slot-icon">{roleIcon(slot.id)}</span>
        <div>
          <strong>{slot.label}</strong>
          <span>{slot.required ? '必需' : '可选'} · {slot.count}/{slot.max}</span>
        </div>
      </header>
      <p className="ec-ability-slot-hint">
        {slot.id === 'items' && '上传服饰、鞋包或配件，AI 只以这里的商品为准'}
        {slot.id === 'person' && '提供人物参考，或让 AI 为商品生成匹配模特'}
        {slot.id === 'scene' && '补充环境与光线，让商品进入真实使用场景'}
        {slot.id === 'product' && '上传清晰商品图，建立真实商品事实'}
        {slot.id === 'reference' && '可选的风格、场景或构图参考'}
      </p>
      {isPerson && (
        <div className="ec-ability-person-mode" role="group" aria-label="模特生成方式">
          {slot.modeOptions.map(option => (
            <button
              type="button"
              key={option.id}
              className={slot.selectedMode === option.id ? 'is-selected' : ''}
              aria-pressed={slot.selectedMode === option.id}
              onClick={() => onModeChange(option.id)}
              title={option.description}
            >
              {option.id === 'smart' ? '智能模特' : '参考模特图'}
            </button>
          ))}
        </div>
      )}
      <div className="ec-ability-slot-rail">
        {slot.images.map((image, index) => (
          <ImageCard
            key={`${image.assetId || image.url}-${index}`}
          image={image}
          label={`${slot.label}${slot.max > 1 ? ` ${index + 1}` : ''}`}
          index={index}
          locked={Boolean(image.locked)}
          onRemove={onRemove}
        />
        ))}
        {slot.canAdd && (
          <button
            type="button"
            className="ec-ability-add"
            onClick={() => inputRef.current?.click()}
            aria-label={`添加${slot.label}`}
            title={`添加${slot.label}`}
          >
            <span><ImagePlus size={19} /></span>
            <strong>{slot.images.length ? '继续添加' : `添加${slot.label}`}</strong>
            <small>{slot.max > 1 ? `最多 ${slot.max} 张` : '单张图片'}</small>
          </button>
        )}
        {!slot.images.length && !slot.canAdd && slot.id === 'person' && slot.selectedMode === 'smart' && (
          <div className="ec-ability-smart-empty"><Sparkles size={16} /><span>AI 将生成匹配模特</span></div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={slot.accept || 'image/*'}
        multiple={slot.max > 1}
        hidden
        onChange={event => onUpload(event)}
      />
    </article>
  );
}

export default function EcommerceWorkbench({
  productImages = [],
  refImages = [],
  roleImages = {},
  unmappedImages = [],
  abilityRecipeId = 'product_suite',
  personMode = 'smart',
  onPersonModeChange = NOOP,
  onAbilityRecipeChange = NOOP,
  onRoleUpload,
  onRoleRemove,
  description = '',
  onDescriptionChange = NOOP,
  onProductUpload = NOOP,
  onReferenceUpload = NOOP,
  onRemoveProduct = NOOP,
  onRemoveReference = NOOP,
  heading,
  subheading,
  promptTitle,
  promptExamples,
}) {
  const [mentionedIds, setMentionedIds] = useState([]);
  const inputRefs = useRef({});
  const deck = buildAbilityUploadDeck({
    recipeId: abilityRecipeId,
    personMode,
    roleImages,
    productImages,
    refImages,
  });
  const recipe = deck.recipe;
  const activeHeading = heading || (recipe.id === 'anything_tryon'
    ? '把商品放到模特身上，生成可交付穿搭'
    : '上传商品素材，生成整套电商视觉');
  const activeSubheading = subheading || (recipe.id === 'anything_tryon'
    ? '商品决定真实细节，模特与场景决定呈现方式。'
    : '先放入一张清晰商品图；补充角度或参考图，能让画面更贴近你的商品。');
  const activePromptTitle = promptTitle || (recipe.id === 'anything_tryon'
    ? '描述穿搭关系、姿势和场景，一句话就够了'
    : '描述想生成的商品视觉，一句话就够了');
  const activePromptExamples = promptExamples || (recipe.id === 'anything_tryon'
    ? ['例：都市通勤，保持服饰纹理，人物自然行走', '例：把商品组合成春季街拍，画面干净、主体清晰']
    : ['例：为白色陶瓷杯生成高级简约的电商详情页', '例：保留商品结构，换成清透夏日场景']);
  const roleImagesForMentions = deck.slots.flatMap(slot => slot.images.map((image, index) => ({
    ...image,
    id: image.id || image.assetId || `${slot.id}-${index}`,
    name: `${slot.label}${slot.max > 1 ? ` ${index + 1}` : ''}`,
    role: slot.id === 'product' ? 'product' : slot.id === 'reference' ? 'reference' : slot.id,
  })));
  const mentionImages = buildImageMentions(roleImagesForMentions);
  const selectedMentionImages = mentionImages.filter(image => mentionedIds.includes(String(image.sourceNodeId)));
  const handleMentionToggle = image => {
    const id = String(image?.id || image?.sourceNodeId || '');
    if (!id) return;
    const selected = mentionedIds.includes(id);
    setMentionedIds(previous => selected ? previous.filter(value => value !== id) : [...previous, id]);
    onDescriptionChange(selected ? removeImageMention(description, image.label) : appendImageMention(description, image.label));
  };
  const uploadForSlot = (slotId, event) => {
    if (onRoleUpload) onRoleUpload(slotId, event);
    else if (slotId === 'product') onProductUpload(event);
    else if (slotId === 'reference') onReferenceUpload(event);
  };
  const removeForSlot = (slotId, index) => {
    if (onRoleRemove) onRoleRemove(slotId, index);
    else if (slotId === 'product') onRemoveProduct(index);
    else if (slotId === 'reference') onRemoveReference(index);
  };
  const renderInputRef = slotId => {
    if (!inputRefs.current[slotId]) inputRefs.current[slotId] = React.createRef();
    return inputRefs.current[slotId];
  };

  return (
    <section className="ec-workbench" aria-label="电商生图工作台">
      <RecipeRail selectedId={abilityRecipeId} onChange={onAbilityRecipeChange} />
      <AbilityInspector recipe={recipe} />
      <div className="ec-workbench-heading">
        <strong>{activeHeading}</strong>
        <span>{activeSubheading}</span>
      </div>

      <div className={`ec-xhs-composer ec-ability-composer${recipe.id === 'anything_tryon' ? ' is-tryon' : ''}`}>
        <div className="ec-ability-slot-grid">
          {deck.slots.map(slot => (
            <AbilitySlot
              key={slot.id}
              slot={slot}
              inputRef={renderInputRef(slot.id)}
              onUpload={event => uploadForSlot(slot.id, event)}
              onRemove={index => removeForSlot(slot.id, index)}
              onModeChange={onPersonModeChange}
            />
          ))}
        </div>

        {unmappedImages.length > 0 && (
          <div className="ec-ability-unmapped" role="status">
            <Info size={15} />
            <div><strong>待整理素材</strong><span>这些参考图已保留，没有自动当作模特或场景，避免误用。</span></div>
            <span className="ec-ability-unmapped-count">{unmappedImages.length} 张</span>
          </div>
        )}

        <div className="ec-textarea-wrap ec-xhs-prompt">
          {!description && (
            <div className="ec-textarea-placeholder ec-xhs-placeholder ec-xhs-prompt-hints">
              <span className="ec-placeholder-line">{activePromptTitle}</span>
              {activePromptExamples.slice(0, 2).map((example, index) => <span key={example} className={`ec-placeholder-line ${index === 0 ? 'ec-xhs-example-first' : ''}`}>{example}</span>)}
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
            images={roleImagesForMentions}
            selectedImages={selectedMentionImages}
            selectionMode="insert"
            onToggle={handleMentionToggle}
          />
        </div>
      </div>
    </section>
  );
}
