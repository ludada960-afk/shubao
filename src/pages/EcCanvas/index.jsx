import React, { useCallback, useRef, useEffect, useState } from 'react';
import { Tldraw } from '@tldraw/tldraw';
import '@tldraw/tldraw/tldraw.css';
import { MdArrowBack, MdDownload } from 'react-icons/md';
import { useApp } from '../../store/AppContext';
import ContextMenu from './ContextMenu';

/* ═══════ EcCanvas — 无限画布工作台（三段式第三步）═══ */
export default function EcCanvas() {
  const { state, dispatch } = useApp();
  const result = state.result || {};
  const images = result.images || {};
  const [loaded, setLoaded] = useState(false);
  const editorRef = useRef(null);

  // 图片标签映射
  const LABEL_MAP = {
    white_bg: '白底图', main_text: '主图', main_3x4: '3:4主图',
    transparent: '透明PNG', sku: 'SKU规格图',
    detail_slice_size: '尺寸标注', detail_slice_scene: '场景拍摄',
    detail_slice_qc: '质检报告', detail_slice_compare: '优势对比',
    detail_slice_feature: '细节功能', detail_slice_care: '保养维护',
  };

  // 从 result.images 提取所有图片
  const imageList = Object.entries(images).map(([label, url], i) => ({
    label,
    url,
    title: LABEL_MAP[label.replace(/_\d+$/, '')] || label,
    index: i,
  }));

  // 右键菜单状态
  const [ctxMenu, setCtxMenu] = useState({ visible: false, x: 0, y: 0, image: null });

  // 全局右键监听（捕获画布上的右键事件）
  useEffect(() => {
    const handler = (e) => {
      // 检查是否右键点击了图片
      const img = e.target.closest('img');
      if (img && img.src) {
        e.preventDefault();
        const matchedImage = imageList.find(il => il.url === img.src);
        setCtxMenu({ visible: true, x: e.clientX, y: e.clientY, image: matchedImage || null });
      }
    };
    window.addEventListener('contextmenu', handler);
    return () => window.removeEventListener('contextmenu', handler);
  }, [imageList]);

  // 画布加载后自动布局图片
  const handleMount = useCallback((editor) => {
    editorRef.current = editor;
    if (loaded) return;

    // 等一帧让画布初始化
    setTimeout(() => {
      if (!editor || imageList.length === 0) { setLoaded(true); return; }

      const CARD_W = 300;
      const GAP = 40;
      const COLS = Math.min(imageList.length, 4);

      imageList.forEach((img, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        const x = col * (CARD_W + GAP);
        const y = row * (CARD_W + GAP + 40);

        // 创建一个图片形状
        const assetId = editor.createAssetId();
        editor.createAssets([{
          id: assetId,
          type: 'image',
          typeName: 'asset',
          props: {
            name: img.title,
            src: img.url,
            w: CARD_W,
            h: CARD_W,
            mimeType: 'image/png',
            isUploaded: true,
          },
        }]);

        // 创建图片形状
        const shapeId = editor.createShapeId();
        editor.createShapes([{
          id: shapeId,
          type: 'image',
          x,
          y,
          props: {
            assetId,
            w: CARD_W,
            h: CARD_W,
          },
        }]);

        // 创建标注文字
        const textId = editor.createShapeId();
        editor.createShapes([{
          id: textId,
          type: 'text',
          x,
          y: y + CARD_W + 8,
          props: {
            text: `${img.title}`,
            size: 's',
            font: 'draw',
            color: 'black',
          },
        }]);
      });

      // 适配视口
      editor.zoomToFit({ animation: { duration: 500 } });
      setLoaded(true);
    }, 300);
  }, [imageList, loaded]);

  const handleBack = () => {
    dispatch({ type: 'NAVIGATE', page: 'home' });
  };

  const handleDownloadAll = async () => {
    // 逐张下载
    for (const img of imageList) {
      if (!img.url) continue;
      const a = document.createElement('a');
      a.href = img.url;
      a.download = `${img.title}.png`;
      a.click();
      await new Promise(r => setTimeout(r, 200));
    }
  };

  const handleCtxAction = (action) => {
    const img = ctxMenu.image;
    if (!img) return;
    switch (action) {
      case 'export': {
        const a = document.createElement('a');
        a.href = img.url;
        a.download = `${img.title}.png`;
        a.click();
        break;
      }
      case 'redraw':
        alert('局部重绘功能开发中…');
        break;
      default:
        alert(`${img.title} — 该功能开发中…`);
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#f8f9fa' }}>
      {/* ── 顶部工具栏 ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 52,
        background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.08)',
        display: 'flex', alignItems: 'center', padding: '0 16px',
        zIndex: 100, gap: 12,
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}>
        {/* 返回 */}
        <div onClick={handleBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '6px 12px', borderRadius: 8,
            border: '1px solid rgba(0,0,0,0.1)',
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
            color: 'var(--text-secondary)', transition: 'all 0.15s',
          }}>
          <MdArrowBack size={16} /> 返回
        </div>

        {/* 标题 */}
        <div style={{ fontSize: 15, fontWeight: 800, color: '#1a1a1a' }}>
          电商素材工作台
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {imageList.length} 张素材 · 双指缩放/拖拽画布 · 右键图片查看 AI 能力
        </div>

        {/* 右侧操作 */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div onClick={handleDownloadAll}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 14px', borderRadius: 8,
              background: '#1a1a1a', color: '#fff',
              cursor: 'pointer', fontSize: 12, fontWeight: 600,
              transition: 'all 0.15s',
            }}>
            <MdDownload size={14} /> 全部下载
          </div>
        </div>
      </div>

      {/* ── tldraw 画布 ── */}
      <div style={{ position: 'absolute', top: 52, left: 0, right: 0, bottom: 0 }}>
        <Tldraw
          onMount={handleMount}
          hideUi={false}
          components={{}}
        />
      </div>

      {/* ── 空状态 ── */}
      {imageList.length === 0 && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center', color: 'var(--text-muted)',
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎨</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>暂无生成结果</div>
          <div style={{ fontSize: 13 }}>请先完成图片生成</div>
          <div onClick={handleBack} style={{
            marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '10px 24px', borderRadius: 12,
            background: '#1a1a1a', color: '#fff',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>返回生成</div>
        </div>
      )}

      {/* ── 右键菜单 ── */}
      <ContextMenu
        visible={ctxMenu.visible}
        x={ctxMenu.x}
        y={ctxMenu.y}
        onClose={() => setCtxMenu(prev => ({ ...prev, visible: false }))}
        onAction={handleCtxAction}
      />
    </div>
  );
}
