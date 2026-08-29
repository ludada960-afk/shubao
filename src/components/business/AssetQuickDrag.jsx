/**
 * P-H 画布 1-click 拖入素材 (4c183cd4 续命)
 *
 * 3 路入口悬浮按钮:
 *   1) 📦 商品档案    → listProductProfiles 拉取, 选 profile 后列出 assets
 *   2) 🎨 公共素材库  → /api/templates/public?cat=product-main,product-scene
 *   3) ⬆️ 本地上传    → <input type=file> 选图 → 转 dataURL
 *
 * 每路点击后展开"可拖动素材卡"缩略图, 用户把缩略图拖到画布节点
 * (EcStudio ImageUploader / EcCanvas ImageNode) 即可落入。
 *
 * 入参 / 回调:
 *   onDragStart(payload)  用户开始拖动, payload 形如 { source, ref, label, mime, dataUrl, remoteUrl, thumbUrl }
 *   onPick(payload)       用户直接"点击素材卡"快速放入 (可作为 dragstart 的兜底, 移动端不支持 drag)
 *   compact               true = 仅渲染一个 mini 按钮 (默认 false = 完整 3 路按钮组)
 *
 * 不做的事:
 *   * 不改 services 层 (复用 projectAssetDrag.js)
 *   * 不实现真正的 drop (落点由宿主实现)
 *   * 不依赖后端 (3 路源可全部 fallback 为空, 不报错)
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  ASSET_DRAG_SOURCES,
  ASSET_DRAG_SOURCE_LABELS,
  ASSET_DRAG_PRESET_BUTTONS,
  loadProductProfileDragPayloads,
  loadPublicTemplateDragPayloads,
  buildUserUploadDragPayload,
  normalizeAssetDragPayload,
} from '../../services/projectAssetDrag.js';

const BTN_BASE = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid rgba(67, 56, 202, 0.18)',
  background: 'rgba(238, 242, 255, 0.95)',
  color: '#3730A3',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: 'inherit',
  cursor: 'pointer',
  userSelect: 'none',
  transition: 'all 0.18s cubic-bezier(0.22, 1, 0.36, 1)',
  whiteSpace: 'nowrap',
};

const BTN_ACTIVE = {
  ...BTN_BASE,
  background: '#4338CA',
  color: '#fff',
  borderColor: '#4338CA',
  boxShadow: '0 6px 18px rgba(67, 56, 202, 0.28)',
};

const PANEL = {
  position: 'absolute',
  zIndex: 950,
  marginTop: 8,
  padding: 12,
  borderRadius: 14,
  background: '#FFFFFF',
  border: '1px solid rgba(67, 56, 202, 0.14)',
  boxShadow: '0 18px 48px rgba(28, 25, 23, 0.16), 0 4px 14px rgba(28, 25, 23, 0.08)',
  minWidth: 260,
  maxWidth: 360,
  maxHeight: 320,
  overflow: 'auto',
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 8,
};

const THUMB = {
  position: 'relative',
  width: '100%',
  aspectRatio: '1 / 1',
  borderRadius: 8,
  overflow: 'hidden',
  border: '1px solid rgba(28, 25, 23, 0.10)',
  background: '#FAFAFB',
  cursor: 'grab',
  transition: 'transform 0.18s ease, box-shadow 0.18s ease',
};

const THUMB_HOVER = {
  transform: 'translateY(-2px)',
  boxShadow: '0 8px 22px rgba(67, 56, 202, 0.20)',
};

const THUMB_LABEL = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  padding: '3px 6px',
  fontSize: 10,
  fontWeight: 600,
  color: '#fff',
  background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 100%)',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
};

function Thumb({ payload, onDragStart, onPick }) {
  const [hover, setHover] = useState(false);
  const url = payload.thumbUrl || payload.remoteUrl || payload.dataUrl;
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onDragStart={(e) => {
        try {
          e.dataTransfer.effectAllowed = 'copy';
          e.dataTransfer.setData('application/x-shubao-asset', JSON.stringify(payload));
          e.dataTransfer.setData('text/plain', payload.label || payload.ref);
        } catch (err) {
          // 某些浏览器(老 Safari) setData 会抛错, 不阻断 UI 反馈
        }
        onDragStart?.(payload);
      }}
      onClick={() => onPick?.(payload)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPick?.(payload);
        }
      }}
      style={{ ...THUMB, ...(hover ? THUMB_HOVER : {}) }}
      aria-label={`拖入素材 ${payload.label}`}
    >
      {url ? (
        <img
          src={url}
          alt={payload.label}
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A0A0A8', fontSize: 11 }}>
          {ASSET_DRAG_SOURCE_LABELS[payload.source] || '素材'}
        </div>
      )}
      <div style={THUMB_LABEL}>{payload.label}</div>
    </div>
  );
}

async function loadSourcePayloads(source, { signal } = {}) {
  if (signal?.aborted) return [];
  if (source === ASSET_DRAG_SOURCES.PRODUCT_PROFILE) {
    try { return await loadProductProfileDragPayloads({ status: 'active', limit: 50 }); }
    catch (e) { return []; }
  }
  if (source === ASSET_DRAG_SOURCES.PUBLIC_TEMPLATE) {
    try { return await loadPublicTemplateDragPayloads({ cats: ['product-main', 'product-scene'], limit: 12 }); }
    catch (e) { return []; }
  }
  return [];
}

export default function AssetQuickDrag({ onDragStart, onPick, compact = false, style }) {
  const [openSource, setOpenSource] = useState('');
  const [payloads, setPayloads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const fileInputRef = useRef(null);
  const wrapperRef = useRef(null);
  const abortRef = useRef(null);

  const closePanel = useCallback(() => {
    setOpenSource('');
    setPayloads([]);
    setErr('');
    abortRef.current?.abort();
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (!openSource) return undefined;
    if (openSource === ASSET_DRAG_SOURCES.USER_UPLOAD) return undefined;
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setErr('');
    loadSourcePayloads(openSource, { signal: controller.signal })
      .then((list) => {
        if (controller.signal.aborted) return;
        setPayloads(Array.isArray(list) ? list : []);
        setLoading(false);
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setErr(e?.message || '加载失败');
        setLoading(false);
      });
    return () => controller.abort();
  }, [openSource]);

  // 外部点击关闭
  useEffect(() => {
    if (!openSource) return undefined;
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) closePanel();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openSource, closePanel]);

  const handleButton = useCallback((source) => {
    if (openSource === source) { closePanel(); return; }
    setOpenSource(source);
  }, [openSource, closePanel]);

  const handleFilePicked = useCallback(async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const payload = await buildUserUploadDragPayload(file);
      const normalized = normalizeAssetDragPayload(payload);
      if (!normalized) return;
      setOpenSource('');
      onPick?.(normalized);
    } catch (err) {
      setErr(err?.message || '上传失败');
    }
  }, [onPick]);

  return (
    <div ref={wrapperRef} style={{ position: 'relative', display: 'inline-flex', gap: 6, ...style }}>
      {ASSET_DRAG_PRESET_BUTTONS.map((btn) => {
        const isOpen = openSource === btn.key;
        return (
          <button
            key={btn.key}
            type="button"
            onClick={() => {
              if (btn.key === ASSET_DRAG_SOURCES.USER_UPLOAD) {
                fileInputRef.current?.click();
                return;
              }
              handleButton(btn.key);
            }}
            style={isOpen ? BTN_ACTIVE : BTN_BASE}
            aria-haspopup={btn.key !== ASSET_DRAG_SOURCES.USER_UPLOAD ? 'listbox' : undefined}
            aria-expanded={isOpen}
            aria-label={`1-click 拖入素材 - ${btn.label}`}
          >
            <span aria-hidden>{btn.icon}</span>
            {!compact && <span>{btn.label}</span>}
          </button>
        );
      })}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFilePicked}
        data-testid="asset-quick-drag-upload"
      />

      {openSource && openSource !== ASSET_DRAG_SOURCES.USER_UPLOAD && (
        <div style={PANEL} role="listbox" data-testid={`asset-quick-drag-panel-${openSource}`}>
          {loading && (
            <div style={{ gridColumn: '1 / -1', padding: 16, textAlign: 'center', color: '#888', fontSize: 12 }}>
              加载中...
            </div>
          )}
          {!loading && err && (
            <div style={{ gridColumn: '1 / -1', padding: 12, color: '#B91C1C', fontSize: 12 }}>
              {err}
            </div>
          )}
          {!loading && !err && payloads.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: 16, textAlign: 'center', color: '#888', fontSize: 12 }}>
              暂无{ASSET_DRAG_SOURCE_LABELS[openSource]}素材
            </div>
          )}
          {!loading && !err && payloads.map((p, idx) => (
            <Thumb key={`${p.source}-${p.ref}-${idx}`} payload={p} onDragStart={onDragStart} onPick={(payload) => { closePanel(); onPick?.(payload); }} />
          ))}
        </div>
      )}
    </div>
  );
}
