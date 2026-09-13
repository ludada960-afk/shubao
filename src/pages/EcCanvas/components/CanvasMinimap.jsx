/* 9-13：这个文件此前缺 react 钩子导入（守卫测试抓出）。虽然当前画布渲染的是
   CanvasContextMenuPanel 里的实现，但留着一个会崩的副本是隐患 —— 补齐导入。 */
import React, { useEffect, useRef, useState } from 'react';

export function CanvasMinimap({
  nodes = [],
  connections = [],
  viewport = { x: 0, y: 0, scale: 1 },
  worldBounds = { width: 6400, height: 4800, offsetX: 720 - 3200, offsetY: 450 - 2400 },
  onViewportChange,
  onWheelZoom,
  onClose,
  minimapWidth = 200,
  minimapHeight = 140,
}) {
  const ref = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredNode, setHoveredNode] = useState(null);

  // 世界 → 小地图比例 (支持负坐标世界: offsetX/offsetY 为世界原点在小地图外的偏移)
  const scaleX = minimapWidth / Math.max(1, worldBounds.width);
  const scaleY = minimapHeight / Math.max(1, worldBounds.height);

  // Use minimap canvas actual dimensions instead of browser window
  const canvasWidth = minimapWidth - 8;
  const canvasHeight = minimapHeight - 36;
  
  // viewport 矩形宽高以画布实际可见尺寸为准 (canvasWidth/canvasHeight 已扣除 8px/36px 留白),
  // 并对右下角做裁剪, 防止矩形超出容器边界 (用户 9-08 反馈: 右下角被截断)
  // viewport 矩形宽高以画布实际可见尺寸为准 (canvasWidth/canvasHeight 已扣除 8px/36px 留白),
  // 并对右下角做裁剪, 防止矩形超出容器边界 (用户 9-08 反馈: 右下角被截断)
  const visibleRect = {
    x: (-viewport.x / viewport.scale - worldBounds.offsetX) * scaleX,
    y: (-viewport.y / viewport.scale - worldBounds.offsetY) * scaleY,
    w: Math.min(canvasWidth, canvasWidth / viewport.scale * scaleX),
    h: Math.min(canvasHeight, canvasHeight / viewport.scale * scaleY),
  };

  function handlePointerDown(event) {
    setIsDragging(true);
    handlePointerMove(event);
  }

  function handlePointerMove(event) {
    if (!onViewportChange) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    // 小地图上的点 → 世界点 → 让视口中心对准它 (点击任意素材即导航过去)
    const worldX = worldBounds.offsetX + (event.clientX - rect.left) / scaleX;
    const worldY = worldBounds.offsetY + (event.clientY - rect.top) / scaleY;
    onViewportChange({
      x: (globalThis.innerWidth || 1440) / 2 - worldX * viewport.scale,
      y: (globalThis.innerHeight || 900) / 2 - worldY * viewport.scale,
    });
  }

  function handlePointerUp() {
    setIsDragging(false);
  }

  useEffect(() => {
    if (!isDragging) return undefined;
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging]);

  return (
    <div
      className="ec-canvas-minimap"
      style={{ width: minimapWidth, height: minimapHeight }}
      onWheel={event => {
        /* 用户 9-04 反馈: 小地图开着时滚轮不能缩放画布 → 转发为画布中心缩放 */
        event.preventDefault();
        onWheelZoom?.(event.deltaY);
      }}
    >
      <header className="ec-canvas-minimap-header">
        <strong>小地图</strong>
        <span>{nodes.length} 节点</span>
        <button type="button" aria-label="关闭小地图" title="关闭小地图" className="ec-canvas-minimap-close" onClick={() => onClose?.()}>×</button>
      </header>
      <div
        ref={ref}
        className="ec-canvas-minimap-canvas"
        style={{ width: minimapWidth - 8, height: minimapHeight - 36 }}
        onPointerDown={handlePointerDown}
      >
        {/* 连线简化渲染 */}
        <svg viewBox={`0 0 ${minimapWidth} ${minimapHeight}`} width={minimapWidth - 8} height={minimapHeight - 36}>
          {connections.map((conn, i) => {
            const from = nodes.find(n => n.id === (conn.fromNodeId || conn.from));
            const to = nodes.find(n => n.id === (conn.toNodeId || conn.to));
            if (!from || !to) return null;
            const x1 = (from.x - worldBounds.offsetX + (from.w || 0) / 2) * scaleX;
            const y1 = (from.y - worldBounds.offsetY + (from.h || 0) / 2) * scaleY;
            const x2 = (to.x - worldBounds.offsetX + (to.w || 0) / 2) * scaleX;
            const y2 = (to.y - worldBounds.offsetY + (to.h || 0) / 2) * scaleY;
            return <line key={conn.id || i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.18)" strokeWidth="0.6" />;
          })}
        </svg>

        {nodes.map(node => {
          return (
            <div
              key={node.id}
              className="ec-canvas-minimap-node"
              data-kind={node.kind}
              style={{
                left: (node.x - worldBounds.offsetX) * scaleX,
                top: (node.y - worldBounds.offsetY) * scaleY,
                width: Math.max(2, (node.w || 100) * scaleX),
                height: Math.max(2, (node.h || 60) * scaleY),
                background: getStaticNodeColor(node.kind),
                border: hoveredNode === node.id ? '1px solid rgba(255,255,255,0.9)' : '1px solid rgba(255,255,255,0.15)',
              }}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              title={node.name || node.displayLabel || node.kind}
            />
          );
        })}

        <div
          className="ec-canvas-minimap-viewport"
          style={{
            left: Math.max(0, visibleRect.x),
            top: Math.max(0, visibleRect.y),
            width: Math.min(minimapWidth - 8, visibleRect.w),
            height: Math.min(minimapHeight - 36, visibleRect.h),
          }}
        />
      </div>
    </div>
  );
}

function getStaticNodeColor(kind = '') {
  const map = {
    text: '#FFE66D',
    image: '#4ECDC4',
    output: '#4ECDC4',
    video: '#FF6B6B',
    audio: '#A78BFA',
    application: '#FFA500',
    source_group: '#94A3B8',
    'layer-group': '#94A3B8',
    'image-composer': '#06B6D4',
    'text-composer': '#FFE66D',
    'video-composer': '#FF6B6B',
    'suite-composer': '#F97316',
    'smart-remix': '#EC4899',
    'layer-workbench': '#10B981',
    'remove-bg': '#22C55E',
    extend: '#3B82F6',
    inpaint: '#8B5CF6',
    translate: '#F59E0B',
    upscale: '#0EA5E9',
    sticker: '#FACC15',
  };
  return map[kind] || '#888888';
}