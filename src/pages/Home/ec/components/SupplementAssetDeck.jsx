import React, { useRef, useState, useCallback } from 'react';
import { MdAddPhotoAlternate, MdClose } from 'react-icons/md';
import SupplementImageCard from './SupplementImageCard';
import {
  getUploadPlaceholderText,
  getSupplementStats,
  PRODUCT_IMAGE_SUGGESTIONS,
  REFERENCE_IMAGE_SUGGESTIONS,
} from './supplementUploadModel';

/**
 * SupplementAssetDeck - 补充素材上传展示组件
 *
 * 用于第二步"补充调整"，展示和上传产品图、参考图
 * 纯受控组件，不调用 API，不操作 localStorage，不使用 AppContext
 *
 * @param {Object} props
 * @param {Array} props.productImages - 产品图数组
 * @param {Array} props.referenceImages - 参考图数组
 * @param {Array} [props.inheritedProductImages] - 从第一步带入的产品图
 * @param {Array} [props.inheritedReferenceImages] - 从第一步带入的参考图
 * @param {Function} props.onAddProductImages - 添加产品图回调 (files) => void
 * @param {Function} props.onAddReferenceImages - 添加参考图回调 (files) => void
 * @param {Function} props.onRemoveProductImage - 删除产品图回调 (image) => void
 * @param {Function} props.onRemoveReferenceImage - 删除参考图回调 (image) => void
 * @param {Function} [props.onPreviewImage] - 预览图片回调 (image) => void
 */
export default function SupplementAssetDeck({
  productImages = [],
  referenceImages = [],
  inheritedProductImages = [],
  inheritedReferenceImages = [],
  onAddProductImages,
  onAddReferenceImages,
  onRemoveProductImage,
  onRemoveReferenceImage,
  onPreviewImage,
  productTitle = '补充产品图',
  productHint = '多角度拍摄，提升生成效果',
  productUploadLabel = '',
  productContinuationLabel = '',
  referenceTitle = '补充参考图',
  referenceHint = '竞品/爆款风格参考',
  productSuggestions = PRODUCT_IMAGE_SUGGESTIONS,
  referenceSuggestions = REFERENCE_IMAGE_SUGGESTIONS,
  productColor = '#7c3aed',
  referenceColor = '#ec4899',
  maxProductImages = 6,
  maxReferenceImages = 6,
  tilted = true,
  className = '',
}) {
  const productInputRef = useRef(null);
  const referenceInputRef = useRef(null);
  const productScrollRef = useRef(null);
  const referenceScrollRef = useRef(null);

  // 合并继承和新增的图片
  const allProductImages = [...inheritedProductImages, ...productImages];
  const allReferenceImages = [...inheritedReferenceImages, ...referenceImages];

  // 统计信息
  const stats = getSupplementStats(allProductImages, allReferenceImages);
  const productCardTransform = tilted ? 'rotate(1.5deg)' : 'none';
  const productTrackTransform = tilted ? 'rotate(-1.5deg)' : 'none';
  const referenceCardTransform = tilted ? 'rotate(-1.5deg)' : 'none';
  const referenceTrackTransform = tilted ? 'rotate(1.5deg)' : 'none';

  // 处理文件选择
  const handleProductFileSelect = useCallback(
    (e) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onAddProductImages?.(files);
        // 重置 input
        e.target.value = '';
      }
    },
    [onAddProductImages]
  );

  const handleReferenceFileSelect = useCallback(
    (e) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onAddReferenceImages?.(files);
        // 重置 input
        e.target.value = '';
      }
    },
    [onAddReferenceImages]
  );

  // 处理滚轮横向滚动
  const handleWheel = useCallback((e, scrollRef) => {
    if (scrollRef.current) {
      e.preventDefault();
      scrollRef.current.scrollLeft += e.deltaY;
    }
  }, []);

  // 上传按钮组件
  const UploadButton = ({ type, onClick, count }) => {
    const isProduct = type === 'product';
    const color = isProduct ? productColor : referenceColor;
    const max = isProduct ? maxProductImages : maxReferenceImages;
    const placeholder = count === 0 && isProduct && productUploadLabel
      ? productUploadLabel
      : count > 0 && isProduct && productContinuationLabel
        ? productContinuationLabel
        : getUploadPlaceholderText(count, type);

    return (
      <div
        onClick={count >= max ? undefined : onClick}
        className={`supplement-upload-button supplement-upload-button--${type}`}
        aria-disabled={count >= max}
        style={{
          width: 80,
          height: 80,
          borderRadius: 8,
          border: `2px dashed ${color}40`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          cursor: count >= max ? 'default' : 'pointer',
          opacity: count >= max ? 0.55 : 1,
          transition: 'all 0.15s',
          background: '#fff',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = color;
          e.currentTarget.style.background = `${color}08`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = `${color}40`;
          e.currentTarget.style.background = '#fff';
        }}
      >
        <MdAddPhotoAlternate size={20} style={{ color }} />
        <span
          style={{
            fontSize: 9,
            color,
            fontWeight: 600,
            textAlign: 'center',
            padding: '0 4px',
          }}
        >
          {count >= max ? '已达上传上限' : placeholder}
        </span>
      </div>
    );
  };

  // 建议提示组件
  const SuggestionTips = ({ type }) => {
    const isProduct = type === 'product';
    const suggestions = isProduct ? productSuggestions : referenceSuggestions;
    const color = isProduct ? productColor : referenceColor;
    const title = isProduct ? `${productTitle}建议` : `${referenceTitle}建议`;

    return (
      <div className={`supplement-suggestion supplement-suggestion--${type}`}
        style={{
          marginTop: 8,
          padding: '8px 10px',
          background: `${color}08`,
          borderRadius: 8,
          fontSize: 10,
          color: '#666',
          lineHeight: 1.5,
        }}
      >
        <span style={{ fontWeight: 600, color }}>{title}：</span>
        {suggestions.map((s, i) => s.label).join(' · ')}
      </div>
    );
  };

  return (
    <div className={`supplement-asset-deck ${className}`} style={{ display: 'flex', width: '100%', minWidth: 0, gap: 16, flexWrap: 'wrap' }}>
      {/* 左侧：产品图上传区 */}
      <div className="supplement-asset-deck-lane supplement-asset-deck-lane--product" style={{ flex: '1 1 320px', minWidth: 0 }}>
        {/* 标题 */}
        <div className="supplement-asset-deck-header"
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: productColor,
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span>📸</span>
          {productTitle}
          <span style={{ fontSize: 10, color: '#999', fontWeight: 400 }}>
            · {productHint}
          </span>
          {stats.product.inherited > 0 && (
            <span
              style={{
                marginLeft: 'auto',
                padding: '2px 6px',
                borderRadius: 4,
                background: `${productColor}20`,
                color: productColor,
                fontSize: 9,
              }}
            >
              已带入 {stats.product.inherited} 张
            </span>
          )}
        </div>

        {/* 产品图卡片 */}
        <div className="supplement-asset-deck-card supplement-asset-deck-card--product"
          style={{
            transform: productCardTransform,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #FAF7F2 0%, #F5F0FF 100%)',
            border: '2px dashed rgba(124,58,237,0.2)',
            padding: 12,
          }}
        >
          {/* 图片横向滚动轨道 */}
          <div
            ref={productScrollRef}
            onWheel={(e) => handleWheel(e, productScrollRef)}
            className="supplement-asset-deck-track supplement-asset-deck-track--product"
            style={{
              display: 'flex',
              minWidth: 0,
              maxWidth: '100%',
              gap: 12,
              overflowX: 'auto',
              paddingBottom: 20, // 为建议标签留出空间
              transform: productTrackTransform,
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(124,58,237,0.3) transparent',
            }}
          >
            {/* 已有图片 */}
            {allProductImages.slice(0, maxProductImages).map((img, idx) => (
              <SupplementImageCard
                key={img.id || idx}
                image={img}
                index={idx}
                type="product"
                onRemove={onRemoveProductImage}
                onPreview={onPreviewImage}
                suggestions={productSuggestions}
              />
            ))}

            {/* 上传按钮 */}
            {allProductImages.length < maxProductImages && <UploadButton type="product" count={allProductImages.length} onClick={() => productInputRef.current?.click()} />}
          </div>

          {/* 隐藏的文件输入 */}
          <input
            ref={productInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={handleProductFileSelect}
          />
        </div>

        {/* 建议提示 */}
        <SuggestionTips type="product" />
      </div>

      {/* 中间：乘号 */}
      <div className="supplement-asset-deck-divider"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: 24,
        }}
      >
        <span
          style={{
            fontSize: 20,
            color: '#ccc',
            fontWeight: 300,
          }}
        >
          ×
        </span>
      </div>

      {/* 右侧：参考图上传区 */}
      <div className="supplement-asset-deck-lane supplement-asset-deck-lane--reference" style={{ flex: '1 1 320px', minWidth: 0 }}>
        {/* 标题 */}
        <div className="supplement-asset-deck-header"
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: referenceColor,
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span>🎨</span>
          {referenceTitle}
          <span style={{ fontSize: 10, color: '#999', fontWeight: 400 }}>
            · {referenceHint}
          </span>
          {/* 可选标记 */}
          <span
            style={{
              marginLeft: 'auto',
              padding: '2px 8px',
              borderRadius: 4,
              background: '#f3f4f6',
              color: '#6b7280',
              fontSize: 9,
              fontWeight: 500,
            }}
          >
            可选
          </span>
          {stats.reference.inherited > 0 && (
            <span
              style={{
                marginLeft: 4,
                padding: '2px 6px',
                borderRadius: 4,
                background: `${referenceColor}20`,
                color: referenceColor,
                fontSize: 9,
              }}
            >
              已带入 {stats.reference.inherited} 张
            </span>
          )}
        </div>

        {/* 参考图卡片 */}
        <div className="supplement-asset-deck-card supplement-asset-deck-card--reference"
          style={{
            transform: referenceCardTransform,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #FFF5F7 0%, #FDF2F8 100%)',
            border: '2px dashed rgba(236,72,153,0.2)',
            padding: 12,
          }}
        >
          {/* 图片横向滚动轨道 */}
          <div
            ref={referenceScrollRef}
            onWheel={(e) => handleWheel(e, referenceScrollRef)}
            className="supplement-asset-deck-track supplement-asset-deck-track--reference"
            style={{
              display: 'flex',
              minWidth: 0,
              maxWidth: '100%',
              gap: 12,
              overflowX: 'auto',
              paddingBottom: 20,
              transform: referenceTrackTransform,
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(236,72,153,0.3) transparent',
            }}
          >
            {/* 已有图片 */}
            {allReferenceImages.slice(0, maxReferenceImages).map((img, idx) => (
              <SupplementImageCard
                key={img.id || idx}
                image={img}
                index={idx}
                type="reference"
                onRemove={onRemoveReferenceImage}
                onPreview={onPreviewImage}
                suggestions={referenceSuggestions}
              />
            ))}

            {/* 上传按钮 */}
            {allReferenceImages.length < maxReferenceImages && <UploadButton type="reference" count={allReferenceImages.length} onClick={() => referenceInputRef.current?.click()} />}
          </div>

          {/* 隐藏的文件输入 */}
          <input
            ref={referenceInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={handleReferenceFileSelect}
          />
        </div>

        {/* 建议提示 */}
        <SuggestionTips type="reference" />
      </div>
    </div>
  );
}
