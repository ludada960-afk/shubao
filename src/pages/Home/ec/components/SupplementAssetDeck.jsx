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
    const color = isProduct ? '#7c3aed' : '#ec4899';
    const placeholder = getUploadPlaceholderText(count, type);

    return (
      <div
        onClick={onClick}
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
          cursor: 'pointer',
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
          {placeholder}
        </span>
      </div>
    );
  };

  // 建议提示组件
  const SuggestionTips = ({ type }) => {
    const suggestions = type === 'product' ? PRODUCT_IMAGE_SUGGESTIONS : REFERENCE_IMAGE_SUGGESTIONS;
    const color = type === 'product' ? '#7c3aed' : '#ec4899';
    const title = type === 'product' ? '产品图建议' : '参考图建议';

    return (
      <div
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
    <div style={{ display: 'flex', gap: 16 }}>
      {/* 左侧：产品图上传区 */}
      <div style={{ flex: 1 }}>
        {/* 标题 */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#7c3aed',
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span>📸</span>
          补充产品图
          <span style={{ fontSize: 10, color: '#999', fontWeight: 400 }}>
            · 多角度拍摄，提升生成效果
          </span>
          {stats.product.inherited > 0 && (
            <span
              style={{
                marginLeft: 'auto',
                padding: '2px 6px',
                borderRadius: 4,
                background: '#7c3aed20',
                color: '#7c3aed',
                fontSize: 9,
              }}
            >
              已带入 {stats.product.inherited} 张
            </span>
          )}
        </div>

        {/* 产品图卡片 - 轻微右倾 */}
        <div
          style={{
            transform: 'rotate(1.5deg)',
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
            style={{
              display: 'flex',
              gap: 12,
              overflowX: 'auto',
              paddingBottom: 20, // 为建议标签留出空间
              transform: 'rotate(-1.5deg)', // 抵消父容器倾斜
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(124,58,237,0.3) transparent',
            }}
          >
            {/* 已有图片 */}
            {allProductImages.map((img, idx) => (
              <SupplementImageCard
                key={img.id || idx}
                image={img}
                index={idx}
                type="product"
                onRemove={onRemoveProductImage}
                onPreview={onPreviewImage}
              />
            ))}

            {/* 上传按钮 */}
            <UploadButton
              type="product"
              count={allProductImages.length}
              onClick={() => productInputRef.current?.click()}
            />
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
      <div
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
      <div style={{ flex: 1 }}>
        {/* 标题 */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#ec4899',
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span>🎨</span>
          补充参考图
          <span style={{ fontSize: 10, color: '#999', fontWeight: 400 }}>
            · 竞品/爆款风格参考
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
                background: '#ec489920',
                color: '#ec4899',
                fontSize: 9,
              }}
            >
              已带入 {stats.reference.inherited} 张
            </span>
          )}
        </div>

        {/* 参考图卡片 - 轻微左倾 */}
        <div
          style={{
            transform: 'rotate(-1.5deg)',
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
            style={{
              display: 'flex',
              gap: 12,
              overflowX: 'auto',
              paddingBottom: 20,
              transform: 'rotate(1.5deg)', // 抵消父容器倾斜
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(236,72,153,0.3) transparent',
            }}
          >
            {/* 已有图片 */}
            {allReferenceImages.map((img, idx) => (
              <SupplementImageCard
                key={img.id || idx}
                image={img}
                index={idx}
                type="reference"
                onRemove={onRemoveReferenceImage}
                onPreview={onPreviewImage}
              />
            ))}

            {/* 上传按钮 */}
            <UploadButton
              type="reference"
              count={allReferenceImages.length}
              onClick={() => referenceInputRef.current?.click()}
            />
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
