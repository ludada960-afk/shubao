import React from 'react';
import { Coins, Image as ImageIcon, Video as VideoIcon, Volume2, X, Film, Music, Plus } from 'lucide-react';
import { CanvasDeriveMenu } from './CanvasStudio.jsx';
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
  deriveActions = [],
  onDeriveSelect,
  onClose,
  onPatch,
  billingCost = 0,
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

  /* 派生菜单中按 group 排序, 5 原有 core 先, 4 流影AI magic 后
     资深美工视角: 不写 "(流影AI 风格)" 文字, 直接走 group label */
  const orderedActions = React.useMemo(() => {
    const groupOrder = { core: 0, magic: 1 };
    return [...deriveActions].sort((a, b) => (groupOrder[a.group] ?? 99) - (groupOrder[b.group] ?? 99));
  }, [deriveActions]);

  /* 调整参数 (双面板联动: 上方 toolbar 跟这个面板永远同步) */
  const opacity = typeof node.opacity === 'number' ? node.opacity : 1;
  const volume = typeof node.volume === 'number' ? node.volume : 1;
  const duration = typeof node.duration === 'number' ? node.duration : (node.videoDuration || 5);
  const ratio = node.ratio || node.direction?.ratio || '1:1';
  const position = node.x != null && node.y != null ? { x: Math.round(node.x), y: Math.round(node.y) } : null;
  const size = node.w != null && node.h != null ? { w: Math.round(node.w), h: Math.round(node.h) } : null;

  const debouncedOpacity = useDebouncedValue(opacity, 80);
  const debouncedVolume = useDebouncedValue(volume, 80);
  React.useEffect(() => {
    if (debouncedOpacity !== opacity && onPatch) onPatch({ opacity: debouncedOpacity });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedOpacity]);
  React.useEffect(() => {
    if (debouncedVolume !== volume && onPatch) onPatch({ volume: debouncedVolume });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedVolume]);

  /* P0-2: 派生菜单默认收进 "+" 按钮, 点开才铺开全部创作方式 */
  const [menuOpen, setMenuOpen] = React.useState(false);

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
            <video src={previewUrl} muted playsInline preload="metadata" />
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

      {/* ── 中部 派生菜单 (默认收进 "+", 点开展开全部创作方式) ── */}
      <div className="ec-canvas-right-panel__menu">
        <div className="ec-canvas-right-panel__menu-head">
          <span>继续创作</span>
          <button
            type="button"
            className={"ec-canvas-right-panel__menu-toggle" + (menuOpen ? " is-open" : "")}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "收起创作菜单" : "展开创作菜单"}
            title={menuOpen ? "收起创作菜单" : "展开创作菜单"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Plus size={15} />
          </button>
        </div>
        {menuOpen ? (
          <CanvasDeriveMenu
            actions={orderedActions}
            position={{ position: 'static', left: undefined, top: undefined, transform: undefined }}
            title="从当前素材继续创作"
            onSelect={onDeriveSelect}
          />
        ) : (
          <p className="ec-canvas-right-panel__menu-hint">点 <strong>+</strong> 展开 {orderedActions.length} 种创作方式</p>
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
                <span className="ec-canvas-right-panel__row-value" style={{ gridColumn: '2 / -1', textAlign: 'right' }}>
                  {size.w} × {size.h} px
                </span>
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
          <div className="ec-canvas-right-panel__row">
            <span className="ec-canvas-right-panel__row-label">时长</span>
            <input
              type="range"
              min={2}
              max={15}
              step={1}
              value={duration}
              aria-label="调整视频时长"
              onChange={(event) => onPatch?.({ duration: Number(event.target.value) })}
            />
            <span className="ec-canvas-right-panel__row-value">{duration}s</span>
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

        {/* AI 积分消耗 (商业化视角: 永远显示, 用户每次操作看到成本) */}
        <div className="ec-canvas-right-panel__cost" aria-label="本次创作预计 AI 积分消耗">
          <span className="ec-canvas-right-panel__cost-label">
            <Coins size={12} />
            AI 积分
          </span>
          <span className="ec-canvas-right-panel__cost-value">{Number(billingCost || 0).toFixed(1)}</span>
        </div>
      </div>
    </aside>
  );
}

export default EcCanvasRightPanel;
