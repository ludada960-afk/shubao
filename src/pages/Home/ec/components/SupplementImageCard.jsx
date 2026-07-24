import React, { useState } from 'react';
import { MdClose, MdZoomIn, MdImage } from 'react-icons/md';
import {
  canRemoveSupplementImage,
  getImageStatusLabel,
  getNextProductImageSuggestion,
  getNextReferenceImageSuggestion,
} from './supplementUploadModel';

/**
 * SupplementImageCard - 单张补充图片卡片
 *
 * @param {Object} props
 * @param {Object} props.image - 图片数据对象
 * @param {number} props.index - 图片索引
 * @param {string} props.type - 'product' | 'reference'
 * @param {Function} props.onRemove - 删除回调 (image) => void
 * @param {Function} props.onPreview - 预览回调 (image) => void
 */
export default function SupplementImageCard({
  image,
  index,
  type,
  onRemove,
  onPreview,
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const canRemove = canRemoveSupplementImage(image);
  const statusLabel = getImageStatusLabel(image);

  // 获取建议文本
  const getSuggestion = () => {
    if (type === 'product') {
      return getNextProductImageSuggestion(index);
    }
    return getNextReferenceImageSuggestion(index);
  };

  const suggestion = getSuggestion();

  // 处理删除
  const handleRemove = (e) => {
    e.stopPropagation();
    if (canRemove) {
      onRemove?.(image);
    }
  };

  // 处理预览
  const handlePreview = (e) => {
    e.stopPropagation();
    onPreview?.(image);
  };

  // 加载失败占位
  if (loadError) {
    return (
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 8,
          background: 'rgba(0,0,0,0.05)',
          border: '1px solid rgba(0,0,0,0.08)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          flexShrink: 0,
        }}
      >
        <MdImage size={24} color="#999" />
        <span style={{ fontSize: 9, color: '#999' }}>加载失败</span>
      </div>
    );
  }

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'relative',
        flexShrink: 0,
        cursor: 'pointer',
      }}
    >
      {/* 图片 */}
      <img
        src={image.url}
        alt={suggestion?.label || '图片'}
        onError={() => setLoadError(true)}
        onClick={handlePreview}
        style={{
          width: 80,
          height: 80,
          objectFit: 'cover',
          borderRadius: 8,
          border: '1px solid rgba(0,0,0,0.08)',
          display: 'block',
        }}
      />

      {/* 状态标签 */}
      {statusLabel && (
        <div
          style={{
            position: 'absolute',
            top: 4,
            left: 4,
            padding: '2px 6px',
            borderRadius: 4,
            background:
              statusLabel === '已带入'
                ? 'rgba(124,58,237,0.9)'
                : 'rgba(34,197,94,0.9)',
            color: '#fff',
            fontSize: 9,
            fontWeight: 600,
            pointerEvents: 'none',
          }}
        >
          {statusLabel}
        </div>
      )}

      {/* 悬停操作层 */}
      {isHovered && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 8,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {/* 预览按钮 */}
          <button
            onClick={handlePreview}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: 'none',
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'transform 0.15s',
            }}
            title="预览"
          >
            <MdZoomIn size={16} color="#333" />
          </button>

          {/* 删除按钮 - 只有新增图片可以删除 */}
          {canRemove && (
            <button
              onClick={handleRemove}
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: 'none',
                background: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'transform 0.15s',
              }}
              title="删除"
            >
              <MdClose size={16} color="#fff" />
            </button>
          )}
        </div>
      )}

      {/* 建议标签 */}
      {suggestion && (
        <div
          style={{
            position: 'absolute',
            bottom: -18,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontSize: 9,
            color: '#666',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {suggestion.label}
        </div>
      )}
    </div>
  );
}
