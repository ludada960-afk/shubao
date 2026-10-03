import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Maximize2, Minimize2, Redo2, RotateCcw, Trash2, Undo2 } from 'lucide-react';

/* 显示框（= 框选坐标系的大小）由视频**固有尺寸**算出，见 videoRegionGeometry.js 的说明：
   2026-10-03 用户批注「点击擦除为什么是这样的」—— 原先读的是祖先容器的 offsetWidth，
   而那个容器被 `max-height:280px` 夹过 ⇒ 画面只剩顶部一条横带，字幕框不到。 */
import { fitRegionBox, REGION_BOX_MAX_H, REGION_BOX_MAX_W } from './videoRegionGeometry.js';

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

const VideoRegionPicker = forwardRef(function VideoRegionPicker({
  videoUrl = '',
  regions = [],
  onChange = () => {},
  hint = '',
  disabled = false,
  /* 上限：与交互稿一致（"3/5"）。上限来自调用方（SUBTITLE_ERASE_MODES），
     不在这里写死 —— 又一份常量就又一处会对不上。 */
  maxRegions = 8,
  /* ═══ 2026-10-04：**显示框上限**由调用方给 ══════════════════════════════════════════════
     默认值是 videoRegionGeometry 的 720×560（够整页用）。
     画布上那一格传的是**节点自己的媒体盒尺寸** —— 于是"框选坐标系有多大"仍然只有一处决定
     （fitRegionBox），而画布把节点矩形交出去，两边不会各自猜一个。
     ⚠️ 不传就是旧的整页行为，一处一行都不用改。 */
  maxBoxWidth = undefined,
  maxBoxHeight = undefined,
  /* ═══ 2026-10-04：**自带控件**开关 ══════════════════════════════════════════════════════
     画布上这一格不再自己渲染「放大/撤销/重做/重置/删除 + N/上限 + 区域清单」——
     用户要的是「**在画布上直接框**」，控件归画布那条底部操作条（交互稿那一行）。
     这里传 false ⇒ 只剩"视频 + 拖拽面 + 已框的框"，控件由调用方按交互稿排。
     ⚠️ 这不是把控件删了，是**换了归属**：撤销/重做的历史仍在下面（见 syncHistory），
        画布那条操作条通过 ref 调的正是这同一份历史，
        所以不会出现"框了一格、底部说 0 格"这种两处对不上的情况。 */
  chrome = true,
}, ref) {
  const videoRef = useRef(null);
  const surfaceRef = useRef(null);
  const dragRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0, displayWidth: 0, displayHeight: 0 });
  const [zoomed, setZoomed] = useState(false);
  const [draft, setDraft] = useState(null);
  /* 框选历史的**指针**落在哪一版上；frames 存已提交的快照。
     每次 onChange 之前先把当前版本压栈，于是撤销/重做都是真历史。 */
  const historyRef = useRef({ past: [], present: null, future: [] });
  const syncHistory = next => {
    const h = historyRef.current;
    h.past = [...h.past, h.present];
    h.present = next;
    h.future = [];
    onChange(next);
  };
  /* 外部改了 regions（切换节点）⇒ 历史重置，别把别的节点的框带过来 */
  const lastRegionsKeyRef = useRef(null);
  const regionsKey = JSON.stringify(regions || []);
  if (lastRegionsKeyRef.current !== null && lastRegionsKeyRef.current !== regionsKey && !draft) {
    /* onChange 触发的回填不动历史；只有"外部来的"变化才重置。
       判据：变化后的值与 history.present 相同 ⇒ 是我们自己的回填。 */
    if (JSON.stringify(historyRef.current.present) !== regionsKey) {
      historyRef.current = { past: [], present: regions || [], future: [] };
    }
  }
  lastRegionsKeyRef.current = regionsKey;

  const canUndo = historyRef.current.past.length > 0;
  const canRedo = historyRef.current.future.length > 0;
  const undo = () => {
    const h = historyRef.current;
    if (!h.past.length) return;
    h.future = [h.present, ...h.future];
    h.present = h.past[h.past.length - 1];
    h.past = h.past.slice(0, -1);
    onChange(h.present);
  };
  const redo = () => {
    const h = historyRef.current;
    if (!h.future.length) return;
    h.past = [...h.past, h.present];
    h.present = h.future[0];
    h.future = h.future.slice(1);
    onChange(h.present);
  };
  const reset = () => syncHistory([]);
  const removeLast = () => syncHistory((regions || []).slice(0, -1));

  /* 2026-10-04：`chrome={false}` 时控件在调用方（画布那条操作条），
     而"撤销/重做"的历史只有这一份 —— 所以把它按命令**交出去**，不复制一份到外面。
     canUndo/canRedo 在 render 里算完就冻住：undo/redo 会先改 historyRef 再调 onChange，
     onChange 引发父级重渲染，于是下一帧读到的就是新的 canUndo/canRedo。 */
  useImperativeHandle(ref, () => ({
    zoomIn: () => setZoomed(true),
    zoomOut: () => setZoomed(false),
    toggleZoom: () => setZoomed(current => !current),
    get zoomed() { return zoomed; },
    undo, redo, reset, removeLast,
    get canUndo() { return canUndo; },
    get canRedo() { return canRedo; },
  }), [zoomed, canUndo, canRedo, regions]);

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
    const box = fitRegionBox(intrinsicW, intrinsicH, maxBoxWidth ?? REGION_BOX_MAX_W, maxBoxHeight ?? REGION_BOX_MAX_H);
    setSize({ width: intrinsicW, height: intrinsicH, displayWidth: box.width, displayHeight: box.height });
    /* 让首帧真的画出来（只 preload=metadata 时很多浏览器是一片黑，用户没法对着框） */
    if (video.readyState >= 1 && video.currentTime === 0) {
      try { video.currentTime = 0.1; } catch { /* 某些浏览器 metadata 阶段还不允许 seek */ }
    }
  }, [maxBoxWidth, maxBoxHeight]);

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

  /* ═══ 2026-10-04：**显示像素 → 布局像素**的比例**从 DOM 量出来** ══════════════════════════════
     原来这里是 `(event.clientX - rect.left) / zoom`，`zoom` 是上面那个 `ZOOM = 1.8` 常量。
     那个写法只在"框选器是页面里唯一的变换"时成立 —— 而 2026-10-04 起它**内嵌在画布里**，
     画布 stage 自己带 `transform: scale(viewport.scale)`，于是框出来的区域整体偏了
     viewport.scale 倍（用户框左下角的字幕、擦掉的是画面中间那块）。

     ⇒ 比例直接量：`rect.width / box.width`。
       `rect` 是 `getBoundingClientRect()`（**视觉**像素，含所有祖先 transform），
       `box.width` 是这个 surface 的**布局**像素（它就是框选坐标系的大小）。
       两者一除，框选器自身的放大、画布的缩放，**一并**进去 —— 一个数，不写死。
     ⚠️ 顺带把 `ZOOM` 常量从这行移除：CSS 里的 `scale(1.8)` 与这里的常量一旦不同步，
        偏移量还不小（1.8 vs 2 就是 10%）。这里量出来就没这个同步问题了。 */
  const pointerPosition = event => {
    const node = surfaceRef.current;
    if (!node) return { x: 0, y: 0 };
    const rect = node.getBoundingClientRect();
    const ratio = box.width > 0 ? rect.width / box.width : 1;
    const s = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
    return { x: (event.clientX - rect.left) / s, y: (event.clientY - rect.top) / s };
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
    if ((regions || []).length >= maxRegions) return;
    syncHistory([...(regions || []), region]);
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
      {videoUrl && chrome && (
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
          {/* 2026-10-03 交互稿：框选那一档底部是「撤销 / 重做 / 重置 / 删除」四个，
              外加 `N/上限` 计数。
              ⚠️ 撤销/重做必须是**真的历史**：这里保留一个已提交区域的栈，
                 每次框选/删除都压栈；"撤销"回退一格、"重做"再前进一格。
                 只做"删除最后一条"那种假撤销，用户第二次就会发现不对。 */}
          <button type="button" className="video-region-clear" disabled={disabled || !canUndo} onClick={undo} title="撤销上一次框选">
            <Undo2 size={13} />撤销
          </button>
          <button type="button" className="video-region-clear" disabled={disabled || !canRedo} onClick={redo} title="重做">
            <Redo2 size={13} />重做
          </button>
          <button type="button" className="video-region-clear" disabled={disabled || !historyRef.current.length} onClick={reset} title="清空全部">
            <RotateCcw size={13} />重置
          </button>
          <button type="button" className="video-region-clear" disabled={disabled || !regions.length} onClick={removeLast} title="删除最后一个框">
            <Trash2 size={13} />删除
          </button>
          <span className="video-region-count">{regions.length}/{maxRegions}</span>
        </div>
      )}
      {/* 区域按**源像素**列出来（服务端 delogo 用的就是这几个数）：框了什么、下发什么，看得见。
          `chrome={false}`（画布上那一格）不画它 —— 一列坐标压在视频上只会挡住画面。 */}
      {chrome && regions.length > 0 && (
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
      {chrome && hint && <small className="video-region-hint">{hint}</small>}
    </div>
  );
});

export default VideoRegionPicker;
