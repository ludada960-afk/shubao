// 4c183cd4 续命 P-H 画布 1-click 拖入素材 持久面板
// 在 EcCanvas 顶部工具区显示「商品档案」「公共素材库」「本地上传」3 路快速拖入按钮
// 不再依赖悬浮按钮, 用户随时可拖; AssetQuickDrag 是单按钮, 这里做成 3 按钮平铺
// 完成后调 onPick 把素材落到画布 (图片节点 or 视频节点)
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ASSET_DRAG_SOURCES,
  ASSET_DRAG_SOURCE_LABELS,
  ASSET_DRAG_PRESET_BUTTONS,
  loadProductProfileDragPayloads,
  loadPublicTemplateDragPayloads,
  buildUserUploadDragPayload,
  normalizeAssetDragPayload,
} from '../../../services/projectAssetDrag.js';
import AssetQuickDrag from '../../../components/business/AssetQuickDrag.jsx';

const BTN = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '5px 9px',
  borderRadius: 8,
  border: '1px solid rgba(67, 56, 202, 0.18)',
  background: 'rgba(238, 242, 255, 0.95)',
  color: '#3730A3',
  fontSize: 11.5,
  fontWeight: 600,
  fontFamily: 'inherit',
  cursor: 'pointer',
  userSelect: 'none',
  transition: 'all 0.18s cubic-bezier(0.22, 1, 0.36, 1)',
  whiteSpace: 'nowrap',
};

const BTN_ACTIVE = { ...BTN, background: '#4338CA', color: '#fff', borderColor: '#4338CA' };

export default function CanvasAssetQuickPanel({ onDragStart, onPick, onUploadPayload }) {
  const [activeSource, setActiveSource] = useState('');
  const fileInputRef = useRef(null);

  const handleClick = useCallback((source) => {
    setActiveSource(prev => (prev === source ? '' : source));
  }, []);

  const handleUploadClick = useCallback(() => {
    if (fileInputRef.current) fileInputRef.current.click();
  }, []);

  const handleFileChange = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const payload = await buildUserUploadDragPayload(file);
    onUploadPayload?.(payload, file);
    event.target.value = '';
  }, [onUploadPayload]);

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, position: 'relative' }}>
      <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>1-click 拖入素材:</span>
      <button type="button" aria-label="商品档案" title="拖入已上架的商品档案" style={activeSource === ASSET_DRAG_SOURCES.PRODUCT_PROFILE ? BTN_ACTIVE : BTN} onClick={() => handleClick(ASSET_DRAG_SOURCES.PRODUCT_PROFILE)}>
        📦 商品档案
      </button>
      <button type="button" aria-label="公共素材库" title="拖入公共素材库的模板" style={activeSource === ASSET_DRAG_SOURCES.PUBLIC_TEMPLATE ? BTN_ACTIVE : BTN} onClick={() => handleClick(ASSET_DRAG_SOURCES.PUBLIC_TEMPLATE)}>
        🎨 公共素材库
      </button>
      <button type="button" aria-label="本地上传" title="上传本地图片/视频" style={BTN} onClick={handleUploadClick}>
        ⬆️ 本地上传
      </button>
      <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFileChange} style={{ display: 'none' }} />
      {activeSource && (
        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 950, marginTop: 8 }}>
          <AssetQuickDrag onDragStart={onDragStart} onPick={onPick} />
        </div>
      )}
    </div>
  );
}
