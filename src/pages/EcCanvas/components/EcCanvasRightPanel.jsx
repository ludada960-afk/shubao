/* 9-13：统一成具名导入（文件内既有 React.useX 也有裸写，守卫测试据此报错） */
import React, { useEffect, useState } from 'react';
import { Coins, Image as ImageIcon, Video as VideoIcon, Volume2, X, Film, Music, Plus } from 'lucide-react';
import ResponsiveImage from '../../../components/ResponsiveImage.jsx';

/* ═══════ 4c183cd4 续命 画布右侧固定面板 (用户 8-29 硬性反馈) ═══════
   资深美工视角: 玻璃+暗色+12px 圆角+柔和阴影, 不破 14px 圆角上限
   产品经理视角: 顶部素材卡 + 中部 14 项派生菜单 + 底部参数调整
   商业化视角: AI 积分消耗徽章永远显示, 让用户每次操作看到成本
   总统筹视角: TapNow 骨架 (右固定面板) + Liblib 补充 (节点卡) + Quantv 辅助 (合规水印, 留位)
   用户 8-29 原话: "那右边这个面板怎么东西都不见了呢? 之前我不是说了吗? 你只要选中一个图片或者是一个视频之类的, 就是画布里面你选中一个单位, 它应该是上面跟右边的面板都同时张开呀"
   现状修复: 派生菜单原本是浮在节点旁边的 popup, 改成 360px 宽固定右滑面板, 跟上方 CanvasObjectToolbar 一起同步张合
   不再写 "(TapNow 风格)" / "(流影AI 风格)" 显示文案 (用户 8-29 反馈 3)
   14 项菜单按 5 原有 + 4 智能分桶, 跟 canvas-derive-menu.css 完全一致 */

const KIND_LABELS = Object.freeze({
  image: '图片',
  video: '视频',
  audio: '音频',
  text: '文本',
  output: '图片',
  source_group: '素材组',
  layer_group: '图层',
  suite_composer: '套图生成',
  image_composer: '图片生成',
  text_composer: '文案生成',
  video_composer: '视频生成',
  smart_remix: '商品改造',
  remove_bg: '去背景',
  layer_workbench: '图层工作台',
  one_click_suite: '1-click 套图',
  one_click_video: '1-click 视频',
  tts_voiceover: 'TTS 配音',
  caption_motion: '字幕动效',
  extend: '智能扩图',
  inpaint: '局部改图',
  translate: '图片翻译',
  upscale: '高清修复',
});

function getKindLabel(kind) {
  return KIND_LABELS[kind] || kind || '素材';
}

/* 简易 hook: 防抖值, 避免 range 拖动时 setState 风暴 */
function useDebouncedValue(value, delay = 120) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function EcCanvasRightPanel({
  node,
  derivedChildren = [],
  onOpenChild,
  onClose,
  onPatch,
  billingCost = 0,
  /* 批 CY-⑯：true = 这个数字来自**估算表**而不是真实记账值，界面要如实说明 */
  billingCostIsEstimate = false,
}) {
  if (!node) return null;
  const kind = node.kind || 'image';
  const isImage = ['image', 'output', 'layer_group', 'source_group'].includes(kind);
  const isVideo = kind === 'video';
  const isAudio = kind === 'audio';
  const isText = kind === 'text';
  const status = node.status || (node.url ? 'ready' : 'draft');
  const previewUrl = node.url || node.assets?.find((asset) => asset?.url)?.url || '';
  const isProcessing = status === 'processing' || status === 'analyzing' || status === 'uploading';
  const isError = status === 'error' || Boolean(node.error);
  const nodeName = node.name || node.displayLabel || node.direction?.purpose || (isImage ? '图片素材' : isVideo ? '视频素材' : isAudio ? '音频素材' : isText ? '文本素材' : '素材');

  /* 调整参数 (双面板联动: 上方 toolbar 跟这个面板永远同步) */
  const opacity = typeof node.opacity === 'number' ? node.opacity : 1;
  const volume = typeof node.volume === 'number' ? node.volume : 1;
  /* 2026-10-02：`const duration = ...` 已删除。
     它只被下面那条**死的**时长滑块消费（那条滑块打在源素材上、不起作用，已改成只读显示
     元素读到的真实时长）。留着会让人以为"节点上还挂着一个可用的时长参数"，
     而实际上它读到的 `node.duration` 就是 0 —— 正是用户截图里那个「0s」的来源。 */
  const ratio = node.ratio || node.direction?.ratio || '1:1';
  const position = node.x != null && node.y != null ? { x: Math.round(node.x), y: Math.round(node.y) } : null;
  const size = node.w != null && node.h != null ? { w: Math.round(node.w), h: Math.round(node.h) } : null;

  const debouncedOpacity = useDebouncedValue(opacity, 80);
  const debouncedVolume = useDebouncedValue(volume, 80);

  /* ═══ 2026-10-02 用户批注（两条，同一处根因）═══════════════════════════════════════
     ① 「你右边这个拍摄面板也很奇怪呀，就是你为什么这里没有视频第一帧的或者说是他的封面的
          样式展示在这里呢。**为什么这里是个黑图呀？**」
     ② 「而且你这条时长的条我其实不是很明白。它是一条进度条，还是当前这个视频有多长的一个
          秒数显示呢？我不管他现在是个什么逻辑，**首先在这里现在是个零，他就绝对是错的**。
          他好像是一个死的条。他好像没有任何的逻辑存在。」

     ① 的病根：`<video preload="metadata">` 只拉元数据，**不解码第一帧** ⇒ 首帧位置是黑的。
        修法：`loadedmetadata` 后把 `currentTime` 拨到 0.05s，逼浏览器解码并画出第一帧。
        （不加 poster 属性是因为我们**没有**独立的封面图，帧是从视频本身取的。）

     ② 的病根比 ① 更根本：**「时长」是"生成参数"，不是"文件属性"**。
        它写的是 `onPatch({ duration })` —— 打到**上传来的源视频节点**上，
        而时长真正生效的地方是视频**生成框**的「生成配置（清晰度·画幅·时长）」。
        ⇒ 源素材上的这个滑块**改了不起任何作用**，是一条"死的条"，
        正是用户说的「他好像没有任何的逻辑存在」。
        而且 `node.duration` 实测就是 **0**（不是缺省 5）⇒ 标签显示「0s」，滑块却被 min=2 顶到最左。

        ⇒ 这里改成**只读地显示这个视频自己的真实时长**（从元素 `duration` 读），
          语义说清楚：它是"这条视频多长"，不是"你要生成多长"。
          真要改生成时长，去视频生成框的「生成配置」里改。 */
  const [probedDuration, setProbedDuration] = React.useState(0);
  const heroVideoRef = React.useRef(null);

  React.useEffect(() => {
    const onMeta = (event) => {
      const el = event.currentTarget;
      if (Number.isFinite(el.duration) && el.duration > 0) setProbedDuration(Math.round(el.duration * 10) / 10);
      // 拨一下时间轴，逼浏览器解码并画出第一帧（否则首帧位置是黑的）
      if (!el.currentTime) { try { el.currentTime = 0.05; } catch { /* 元数据还没就绪，忽略 */ } }
    };
    heroVideoRef.current?.addEventListener('loadedmetadata', onMeta);
    return () => heroVideoRef.current?.removeEventListener('loadedmetadata', onMeta);
  }, [previewUrl]);

  React.useEffect(() => {
    if (debouncedOpacity !== opacity && onPatch) onPatch({ opacity: debouncedOpacity });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedOpacity]);
  React.useEffect(() => {
    if (debouncedVolume !== volume && onPatch) onPatch({ volume: debouncedVolume });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedVolume]);

  return (
    <aside className="ec-canvas-right-panel" aria-label={`${nodeName} 创作面板`} role="complementary">
      <button type="button" className="ec-canvas-right-panel__close" aria-label="关闭创作面板" onClick={onClose}>
        <X size={14} />
      </button>

      {/* ── 顶部素材卡 ── */}
      <div className="ec-canvas-right-panel__hero">
        <div className="ec-canvas-right-panel__thumb">
          {previewUrl && isImage ? (
            <ResponsiveImage
              src={previewUrl}
              alt={nodeName}
              variant="thumb"
              ratio="1:1"
              sizes="78px"
              style={{ width: '100%', height: '100%' }}
              imgStyle={{ objectFit: 'cover' }}
            />
          ) : previewUrl && isVideo ? (
            /* 2026-10-02：ref + onLoadedMetadata —— 拨一下 currentTime 逼它解码第一帧，
               否则这个 78px 的缩略图位置是**黑的**（用户原话「为什么这里是个黑图呀」）。 */
            <video
              ref={heroVideoRef}
              src={previewUrl}
              muted
              playsInline
              preload="metadata"
              onLoadedMetadata={(event) => {
                const el = event.currentTarget;
                if (Number.isFinite(el.duration) && el.duration > 0) {
                  setProbedDuration(Math.round(el.duration * 10) / 10);
                }
                if (!el.currentTime) { try { el.currentTime = 0.05; } catch { /* 忽略 */ } }
              }}
            />
          ) : previewUrl && isAudio ? (
            <div className="ec-canvas-right-panel__thumb-icon"><Music size={26} /></div>
          ) : isText ? (
            <div className="ec-canvas-right-panel__thumb-icon"><span style={{ fontSize: 24, fontWeight: 800 }}>T</span></div>
          ) : isVideo ? (
            <div className="ec-canvas-right-panel__thumb-icon"><Film size={26} /></div>
          ) : (
            <div className="ec-canvas-right-panel__thumb-icon"><ImageIcon size={26} /></div>
          )}
        </div>
        <div className="ec-canvas-right-panel__meta">
          <div className="ec-canvas-right-panel__name" title={nodeName}>{nodeName}</div>
          <div className="ec-canvas-right-panel__badges">
            <span className="ec-canvas-right-panel__badge">{getKindLabel(kind)}</span>
            {ratio && <span className="ec-canvas-right-panel__badge">{ratio}</span>}
            {isProcessing && <span className="ec-canvas-right-panel__badge is-processing">处理中</span>}
            {isError && <span className="ec-canvas-right-panel__badge is-error">出错</span>}
            {status === 'ready' && !isError && !isProcessing && <span className="ec-canvas-right-panel__badge is-magic">就绪</span>}
          </div>
        </div>
      </div>

      {/* ── 中部 派生结果看板 (用户 9-05 定稿: 右面板只展示"这个素材派生了什么",
          点击子节点即定位; 生成类入口只在素材右侧 + 里) ── */}
      <div className="ec-canvas-right-panel__menu">
        {Array.isArray(derivedChildren) && derivedChildren.length > 0 ? (
          <ul className="ec-canvas-right-panel__children-list">
            {derivedChildren.map(child => (
              <li key={child.id}>
                <button
                  type="button"
                  className="ec-canvas-right-panel__child"
                  onClick={() => onOpenChild?.(child.id)}
                  title={`定位到 ${child.name}`}
                >
                  <span className="ec-canvas-right-panel__child-thumb">
                    {child.thumb
                      ? <img src={child.thumb} alt="" loading="lazy" />
                      : <span className="ec-canvas-right-panel__child-kind">{getKindLabel(child.kind)}</span>}
                  </span>
                  <span className="ec-canvas-right-panel__child-meta">
                    <strong>{child.name}</strong>
                    <em className={child.status === 'error' ? 'is-error' : child.status === 'processing' ? 'is-processing' : ''}>
                      {child.status === 'processing' ? '处理中' : child.status === 'error' ? '出错' : child.status === 'ready' ? '就绪' : '草稿'}
                    </em>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ec-canvas-right-panel__menu-hint">
            还没有派生结果。点素材右侧的
            {/* ═══ 批 CY-㊴（2026-10-01）：这个 + 原本是**一个文本字符**（不是图标） ═══
                用户原话：「这个+号的图标明显是歪的，向下歪了呀，
                  你不是应该跟真正画布上的+号图标一致才对嘛」
                根因：文本字符走的是面板字体、坐在基线上，而画布上那个是
                30px 圆钮里的 SVG 图标（`DerivePort` 用的 `Plus`）—— 两者根本不是同一种东西。
                ⇒ 这里换成**同一个 SVG 图标 + 同一个圆钮外观**（类名与画布端口一致）。 */}
            <span className="ec-canvas-node-port is-hint" aria-hidden="true"><Plus size={16} /></span>
            拖出连线即可从这里继续创作
          </p>
        )}
      </div>

      {/* ── 底部 调整参数 + AI 积分消耗 ── */}
      <div className="ec-canvas-right-panel__adjust">
        <p className="ec-canvas-right-panel__adjust-title">调整参数</p>

        {(isImage || isVideo) && (
          <>
            <div className="ec-canvas-right-panel__row">
              <span className="ec-canvas-right-panel__row-label">透明度</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={opacity}
                aria-label="调整透明度"
                onChange={(event) => onPatch?.({ opacity: Number(event.target.value) })}
              />
              <span className="ec-canvas-right-panel__row-value">{Math.round(opacity * 100)}%</span>
            </div>
            {size && (
              <div className="ec-canvas-right-panel__row">
                <span className="ec-canvas-right-panel__row-label">尺寸</span>
                <div style={{ gridColumn: '2 / -1', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                  <input
                    type="number"
                    min={40}
                    max={4000}
                    value={size.w}
                    aria-label="素材宽度"
                    onChange={(event) => onPatch?.({ w: Math.min(4000, Math.max(40, Number(event.target.value) || 40)) })}
                    style={{ width: 58, height: 24, padding: '0 4px', border: '1px solid var(--sb-border-subtle, rgba(15,23,42,.12))', borderRadius: 6, background: 'var(--sb-surface-card, #fff)', color: 'inherit', fontSize: 11, textAlign: 'right' }}
                  />
                  <span style={{ color: 'var(--sb-ink-4, #6b7280)' }}>×</span>
                  <input
                    type="number"
                    min={40}
                    max={4000}
                    value={size.h}
                    aria-label="素材高度"
                    onChange={(event) => onPatch?.({ h: Math.min(4000, Math.max(40, Number(event.target.value) || 40)) })}
                    style={{ width: 58, height: 24, padding: '0 4px', border: '1px solid var(--sb-border-subtle, rgba(15,23,42,.12))', borderRadius: 6, background: 'var(--sb-surface-card, #fff)', color: 'inherit', fontSize: 11, textAlign: 'right' }}
                  />
                  <span style={{ color: 'var(--sb-ink-4, #6b7280)', fontSize: 10 }}>px</span>
                </div>
              </div>
            )}
            {position && (
              <div className="ec-canvas-right-panel__row">
                <span className="ec-canvas-right-panel__row-label">位置</span>
                <span className="ec-canvas-right-panel__row-value" style={{ gridColumn: '2 / -1', textAlign: 'right' }}>
                  x {position.x} · y {position.y}
                </span>
              </div>
            )}
          </>
        )}

        {isVideo && (
          /* 2026-10-02：这一格原来是**可拖的时长滑块**（min2/max15 → `onPatch({duration})`），
             但它打在**上传来的源视频节点**上，而时长真正生效的地方是视频生成框的
             「生成配置（清晰度·画幅·时长）」⇒ **拖它不起任何作用**，是一条"死的条"。
             而且 `node.duration` 实测就是 0 ⇒ 标签显示「0s」、滑块却被 min=2 顶到最左。

             ⇒ 改成**只读**地显示这条视频自己的真实时长（从元素读，不是从 node 字段读），
               并把语义写清楚。生成时长要去生成框改。 */
          <div className="ec-canvas-right-panel__row">
            <span className="ec-canvas-right-panel__row-label">视频时长</span>
            {/* 不再挂内联 flex —— 父级是 grid，flex 完全无效（2026-09-14 就写了，一直没生效）。
                右对齐交给 .ec-canvas-right-panel__row-value:nth-child(2) 的 grid-column。 */}
            <span className="ec-canvas-right-panel__row-value">
              {probedDuration > 0 ? `${probedDuration}s` : '读取中…'}
            </span>
          </div>
        )}

        {isAudio && (
          <div className="ec-canvas-right-panel__row">
            <span className="ec-canvas-right-panel__row-label">
              <Volume2 size={11} style={{ display: 'inline', marginRight: 2, verticalAlign: -1 }} />
              音量
            </span>
            <input
              type="range"
              min={0}
              max={2}
              step={0.05}
              value={volume}
              aria-label="调整音轨音量"
              onChange={(event) => onPatch?.({ volume: Number(event.target.value) })}
            />
            <span className="ec-canvas-right-panel__row-value">{Math.round(volume * 100)}%</span>
          </div>
        )}

        {isText && (
          <div className="ec-canvas-right-panel__row">
            <span className="ec-canvas-right-panel__row-label">内容</span>
            <span className="ec-canvas-right-panel__row-value" style={{ gridColumn: '2 / -1', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {(node.text || node.prompt || '空').toString().slice(0, 16)}
            </span>
          </div>
        )}

        {/* AI 积分 (用户 9-05 反馈: 展示当前素材 + 它派生出的全部子节点的消耗)
            批 CY-⑯：数字以前**结构上恒为 0**（读的那三个字段全仓没有一处写），
            现在改成「真实记账值优先、估算兜底」。
            ⚠️ 兜底走的是 estimateNodeCost 那张**估算表** —— 把估算标成「消耗」，
            用户会以为那就是实际扣的钱。所以两种情况分别写「累计消耗」与「预计消耗」。 */}
        <div
          className="ec-canvas-right-panel__cost"
          aria-label={billingCostIsEstimate
            ? '当前素材与派生链的 AI 积分预计消耗（按成本表估算，非实际扣费）'
            : '当前素材与派生链的 AI 积分累计消耗'}
        >
          <span className="ec-canvas-right-panel__cost-label">
            <Coins size={12} />
            {billingCostIsEstimate ? '派生链预计消耗' : '派生链累计消耗'}
          </span>
          <span className="ec-canvas-right-panel__cost-value">{Number(billingCost || 0).toFixed(1)}</span>
        </div>
      </div>

    </aside>
  );
}

export default EcCanvasRightPanel;
