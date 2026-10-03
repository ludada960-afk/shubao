import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, Trash2 } from 'lucide-react';

/* 显示框（= 框选坐标系的大小）由视频**固有尺寸**算出，见 videoRegionGeometry.js 的说明：
   2026-10-03 用户批注「点击擦除为什么是这样的」—— 原先读的是祖先容器的 offsetWidth，
   而那个容器被 `max-height:280px` 夹过 ⇒ 画面只剩顶部一条横带，字幕框不到。 */
import { fitRegionBox } from './videoRegionGeometry.js';

import './VideoRegionPicker.css';

/* ═══ VideoRegionPicker：在视频上**手动框选**要擦除的区域（视频字幕去除那一页的核心控件）════════
   用户口径（照知渔 /video-subtitle-removal 的「字幕标记方式 · 手动标记」）：
     「放大视频并手动框选字幕区域。」
   为什么必须有它：去字幕的本地实现是 ffmpeg `delogo`，它要的是**源视频像素坐标**的矩形。
   没有这一格，"手动标记"就只是一个说法 —— 服务端拿不到区域，点了必失败（铁律不许）。

   三件事是这一格的判据（每条都对应一个会真出错的地方）：
     ① **坐标换算成源像素**：屏幕上拖的是 CSS 像素，视频是 videoWidth × videoHeight。
        比例算错一格，擦的位置整体偏移（用户框字幕、结果擦在画面中间）。
     ② **放大**：知渔原文里就有这一步（字幕常常只占画面很窄一条，不放大框不准）。
        实现是给"画布"（视频 + 覆盖层）加 CSS scale —— 坐标换算按**放大后的实际边框**除回来，
        所以放大只影响看得清不清楚，不影响精度。
     ③ **可框多个区域 / 能删能清空**：delogo 支持多条；框错了要能单独删。
     ④ 空帧也要能框：进页面不等播放（`preload="metadata"` + seek 到 0.1 秒让首帧真的画出来）。

   ⚠️ 输出一律是**源像素整数**。服务端 localVideoPlan.normalizeRegion 还会再判一次
      （≥8×8、非负、超界丢弃）：两处都判不是重复 —— 页面这层保证"用户看到的框 = 下发的框"，
      服务端那层保证"编不出来的参数绝不下滤镜"（本仓既有纪律：宁可不动，也别把片子擦坏）。 */
const MIN_REGION = 8;
const ZOOM = 1.8;

function clampRect(start, end, bounds) {
  const x1 = Math.max(0, Math.min(start.x, end.x));
  const y1 = Math.max(0, Math.min(start.y, end.y));
  const x2 = Math.min(bounds.width, Math.max(start.x, end.x));
  const y2 = Math.min(bounds.height, Math.max(start.y, end.y));
  return { x: x1, y: y1, w: Math.max(0, x2 - x1), h: Math.max(0, y2 - y1) };
}

export default function VideoRegionPicker({
  videoUrl = '',
  regions = [],
  onChange = () => {},
  hint = '',
  disabled = false,
}) {
  const videoRef = useRef(null);
  const surfaceRef = useRef(null);
  const dragRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0, displayWidth: 0, displayHeight: 0 });
  const [zoomed, setZoomed] = useState(false);
  const [draft, setDraft] = useState(null);

  const readGeometry = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    /* ⚠️ 2026-10-03 用户批注：「点击擦除为什么是这样的」——
       原来这里读的是 `surface.offsetWidth/offsetHeight`，而那个 surface 是
       `.video-region-canvas` 的 `inset:0` 子元素，**尺寸完全取决于祖先**
       （曾经祖先是 `max-height:280px` + auto 宽度），也就是说
       "框选坐标系"建立在**一个我们自己都没约束过的容器**上：
         · 容器一改（加 letterbox、加祖先 transform、滚动条出现），
           所有已框的区域立刻整体错位；
         · `ready` 只判 display>0，而 metadata 未到时 `videoWidth=0`
           ⇒ scale 变成 0 ⇒ 框全塌成 {0,0,0,0}，再被 MIN_REGION 静默丢掉。

       ⇒ 改成**按视频固有尺寸算框**（纯函数、无 DOM 读），并把这个框
         写成内联宽高，于是"显示框"与"坐标系"从此是同一个数。 */
    const intrinsicW = Number(video.videoWidth) || 0;
    const intrinsicH = Number(video.videoHeight) || 0;
    const box = fitRegionBox(intrinsicW, intrinsicH);
    setSize({ width: intrinsicW, height: intrinsicH, displayWidth: box.width, displayHeight: box.height });
    /* 让首帧真的画出来（只 preload=metadata 时很多浏览器是一片黑，用户没法对着框） */
    if (video.readyState >= 1 && video.currentTime === 0) {
      try { video.currentTime = 0.1; } catch { /* 某些浏览器 metadata 阶段还不允许 seek */ }
    }
  }, []);

  useEffect(() => { setDraft(null); setSize({ width: 0, height: 0, displayWidth: 0, displayHeight: 0 }); }, [videoUrl]);
  useEffect(() => {
    if (!videoUrl) return undefined;
    const onResize = () => readGeometry();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [readGeometry, videoUrl]);

  const ready = Boolean(videoUrl) && size.width > 0 && size.height > 0
    && size.displayWidth > 0 && size.displayHeight > 0;
  /* 显示框就是坐标系：框出来的显示坐标 × scaleX = 源像素。 */
  const scaleX = ready ? size.width / size.displayWidth : 1;
  const scaleY = ready ? size.height / size.displayHeight : 1;
  const box = { width: size.displayWidth, height: size.displayHeight };

  const pointerPosition = event => {
    const node = surfaceRef.current;
    if (!node) return { x: 0, y: 0 };
    /* rect 是**放大后**的实际边框 ⇒ 除以 zoom 得到未缩放的显示坐标（与 offsetWidth 同一坐标系） */
    const rect = node.getBoundingClientRect();
    const zoom = zoomed ? ZOOM : 1;
    return { x: (event.clientX - rect.left) / zoom, y: (event.clientY - rect.top) / zoom };
  };

  const startDrag = event => {
    if (disabled || !ready) return;
    const node = surfaceRef.current;
    if (!node) return;
    const start = pointerPosition(event);
    dragRef.current = { start };
    setDraft({ x: start.x, y: start.y, w: 0, h: 0 });
    node.setPointerCapture?.(event.pointerId);
  };

  const moveDrag = event => {
    const drag = dragRef.current;
    if (!drag) return;
    setDraft(clampRect(drag.start, pointerPosition(event), box));
  };

  const endDrag = event => {
    const drag = dragRef.current;
    dragRef.current = null;
    surfaceRef.current?.releasePointerCapture?.(event.pointerId);
    if (!drag) return;
    const rect = clampRect(drag.start, pointerPosition(event), box);
    setDraft(null);
    const region = {
      type: 'delogo',
      x: Math.round(rect.x * scaleX),
      y: Math.round(rect.y * scaleY),
      w: Math.round(rect.w * scaleX),
      h: Math.round(rect.h * scaleY),
    };
    /* 太小的框（误点）不记：服务端也会丢，但"多一条废区域"会让用户以为框上了 */
    if (region.w < MIN_REGION || region.h < MIN_REGION) return;
    onChange([...regions, region].slice(0, 8));
  };

  const displayOf = region => ({ x: region.x / scaleX, y: region.y / scaleY, w: region.w / scaleX, h: region.h / scaleY });

  return (
    <div className="video-region-picker" data-empty={videoUrl ? 'false' : 'true'}>
      {!videoUrl && (
        <div className="video-region-empty">
          <strong>先上传要处理的视频</strong>
          <small>上传之后就能在这条视频上框选字幕区域</small>
        </div>
      )}
      {videoUrl && (
        <div className={'video-region-stage' + (zoomed ? ' is-zoomed' : '')}>
          {/* 显示框的尺寸写成内联 —— 它同时就是框选坐标系的大小，
              不再让 CSS 与 JS 各自猜一套。 */}
          <div
            className="video-region-canvas"
            style={{
              width: box.width || undefined,
              height: box.height || undefined,
              transform: zoomed ? `scale(${ZOOM})` : undefined,
            }}
          >
            {/* 没有 controls：整块被拖拽面盖住，播放控制在这里没有意义（要的是"框住那一行字"） */}
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={videoRef}
              className="video-region-video"
              src={videoUrl}
              playsInline
              muted
              preload="metadata"
              onLoadedMetadata={readGeometry}
              onLoadedData={readGeometry}
            />
            <div
              ref={surfaceRef}
              className="video-region-surface"
              role="presentation"
              onPointerDown={startDrag}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              {regions.map((region, index) => {
                const rect = displayOf(region);
                return (
                  <span
                    key={`region-${index}-${region.x}-${region.y}-${region.w}-${region.h}`}
                    className="video-region-box"
                    style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
                  ><i>{index + 1}</i></span>
                );
              })}
              {draft && <span className="video-region-box is-draft" style={{ left: draft.x, top: draft.y, width: draft.w, height: draft.h }} />}
            </div>
          </div>
        </div>
      )}
      {videoUrl && (
        <div className="video-region-actions">
          <button
            type="button"
            className="video-region-zoom"
            disabled={disabled || !ready}
            aria-pressed={zoomed}
            onClick={() => setZoomed(current => !current)}
          >
            {zoomed ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {zoomed ? '退出放大' : '放大视频'}
          </button>
          {regions.length > 0 && (
            <button type="button" className="video-region-clear" disabled={disabled} onClick={() => onChange([])}>
              <Trash2 size={13} />清空区域
            </button>
          )}
          {regions.length > 0 && <span className="video-region-count">已框选 {regions.length} 个区域</span>}
        </div>
      )}
      {/* 区域按**源像素**列出来（服务端 delogo 用的就是这几个数）：框了什么、下发什么，看得见 */}
      {regions.length > 0 && (
        <ul className="video-region-list">
          {regions.map((region, index) => (
            <li key={`item-${index}-${region.x}-${region.y}`}>
              <span>区域 {index + 1}：{region.w} × {region.h} @ ({region.x}, {region.y})</span>
              <button
                type="button"
                aria-label={`删除区域 ${index + 1}`}
                disabled={disabled}
                onClick={() => onChange(regions.filter((_, itemIndex) => itemIndex !== index))}
              >×</button>
            </li>
          ))}
        </ul>
      )}
      {hint && <small className="video-region-hint">{hint}</small>}
    </div>
  );
}
