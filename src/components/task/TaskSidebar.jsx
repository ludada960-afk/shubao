import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  MdAutoAwesome,
  MdCheckCircle,
  MdClose,
  MdDeleteOutline,
  MdError,
  MdHourglassTop,
  MdOutlineFactCheck,
  MdSchedule,
} from 'react-icons/md';
import { useTasks } from '../../store/taskStore';
import { quoteFailedEcommerceTask, retryFailedEcommerceTask } from '../../services/api.js';
import { useDialog } from '../ui/DialogProvider.jsx';

const STATUS_META = {
  queued: { icon: MdSchedule, color: '#7c746d', label: '排队中' },
  analyzing: { icon: MdOutlineFactCheck, color: '#4778c7', label: '正在分析商品' },
  reading: { icon: MdOutlineFactCheck, color: '#4778c7', label: '正在分析商品' },
  parsing: { icon: MdOutlineFactCheck, color: '#6b5fc7', label: '正在准备方案' },
  generating: { icon: MdAutoAwesome, color: '#c97728', label: '正在生成' },
  completed: { icon: MdCheckCircle, color: '#3f8a5d', label: '已完成' },
  done: { icon: MdCheckCircle, color: '#3f8a5d', label: '已完成' },
  needs_review: { icon: MdError, color: '#bd7026', label: '部分图片待补全' },
  failed: { icon: MdError, color: '#c34f49', label: '生成未完成' },
  error: { icon: MdError, color: '#c34f49', label: '生成未完成' },
  cancelled: { icon: MdClose, color: '#8b8580', label: '已取消' },
};

const ACTIVE_STATES = new Set(['queued', 'analyzing', 'reading', 'parsing', 'generating']);

function progressText(task) {
  if (!task.total) return STATUS_META[task.status]?.label || '等待更新';
  if (task.failed > 0) return `${task.done}/${task.total} 张已生成，${task.failed} 张待补全`;
  return `${task.done}/${task.total} 张完成`;
}

export default function TaskSidebar() {
  const { tasks, activeCount, errorCount, loadError, refreshTasks, dismissTask } = useTasks();
  const { confirm } = useDialog();
  const [open, setOpen] = useState(false);
  const [retryingTaskId, setRetryingTaskId] = useState('');
  const [dismissingTaskId, setDismissingTaskId] = useState('');
  const [retryErrors, setRetryErrors] = useState({});
  const [dismissErrors, setDismissErrors] = useState({});
  const dockRef = useRef(null);

  /* ═══ 批 J-④：这个按钮从"左下角浮着"搬进**左边导航栏**（用户批注 #2-4）═══════════════════
     用户原话：「你这个**生成过程的这个按钮不应该放在这里**呀，我都说了你应该**放到左边的
     导航栏里面去**，你可以放在导航栏的**下面这个位置**啊。然后你要跟上面的那些按钮做
     **同样的那种规划**。」
     改前：position:fixed + left:侧栏宽+16 + bottom:86 —— 一颗**孤零零浮在内容区左下角**的
     图标按钮，跟导航栏没有任何视觉关系（用户框的就是它，坐标 7.1% / 89.3%）。
     改后：**挂进侧栏底部**（AppSidebar 的 .app-sidebar-foot 插槽），并且**整格复用
     .app-sidebar-cell** —— 同一块面、同一条底边渐变进度条、同一个 hover 充能、同一套文字
     变色。「同样的那种规划」落到实现上就是**同一个 class**，不是"看起来像"。
     ⚠️ 画布页整屏自己排版、**不渲染侧栏**，那里没有插槽 —— 此时自动回落到原来的左下角
        浮按钮（全站唯一没有侧栏的页面，行为与从前一致）。
     ⚠️ 用 layoutEffect 而非 useEffect：它在**浏览器绘制之前**同步补一次渲染，
        所以不会出现"先闪一下浮按钮、再跳到侧栏"。每次都重新取一次节点，这样
        画布页⟷普通页来回切时能自愈（挂载/卸载都会跟着变）。 */
  const [slot, setSlot] = useState(null);
  useLayoutEffect(() => {
    const node = document.getElementById('sb-task-dock-slot');
    if (node !== slot) setSlot(node);
  });
  const inline = Boolean(slot);

  /* ═══ 2026-09-24 批 BB：画布页的浮按钮要**让开小地图**（用户批注，逐字）══════════════════════════
     原话：「你这个地图明显是跟左边的这个**生成过程**的这个按钮**叠在一起**了。
     我觉得这个生成过程，这个按钮你要不就**放到地图的上面**去吧？」
     实测（1600×1000）：小地图占 (16…216, 70…250)，浮按钮 16…62 / 86…132 —— 整个落在小地图里，
     而且 z-index 更高（panel 4e7 > hud 1e7）盖在它上面。
     ⇒ 浮层底边 = 小地图顶沿 + 12。小地图**可被用户拖拽改尺寸**，所以这里读它的实时矩形
       （ResizeObserver + window resize），不用写死的 px 算术 —— 写死的话用户一缩地图就又叠上。
     非画布页没有小地图 ⇒ 沿用原来的 86（位置逐像素不变）。 */
  const [floatBottom, setFloatBottom] = useState(86);
  useLayoutEffect(() => {
    if (inline) { setFloatBottom(86); return undefined; }
    let observer = null;
    let presence = null;
    let timer = null;
    let tries = 0;
    const FALLBACK = 86;
    const apply = next => setFloatBottom(current => (Math.abs(current - next) > 1 ? next : current));
    const sync = () => {
      const minimap = document.querySelector('.ec-canvas-minimap');
      /* ═══ 批 CY-㊴（2026-10-01）：小地图**不在**时必须复位，不能停在旧值上 ═══
         用户截图里这个按钮压在小地图上。改前 `sync()` 在找不到小地图时直接 return false，
         而调用方（轮询超时后那次 attach）又是另一条分支 —— 于是"小地图关掉再打开"
         之后，按钮会一直停在上一次**开着**时算出来的偏移，看起来就压住了。
         ⇒ 找不到就复位到 FALLBACK（找不到时是**找得到**才谈得上有小地图）。 */
      if (!minimap) { apply(FALLBACK); return false; }
      const rect = minimap.getBoundingClientRect();
      apply(Math.max(72, Math.round(window.innerHeight - rect.top + 12)));
      return true;
    };
    /* ⚠️ 画布是**异步**挂上来的：第一次渲染时 `.ec-canvas-minimap` 往往还不存在
       （实测就是这样 —— 提前 return 的话按钮会一直停在 86 上，依旧压着小地图）。
       所以先轮询等它出现（最多 5 秒），再挂 ResizeObserver（小地图可被拖拽改尺寸）。 */
    const attach = () => {
      sync();
      const minimap = document.querySelector('.ec-canvas-minimap');
      observer = typeof ResizeObserver === 'function' && minimap
        ? new ResizeObserver(sync)
        : null;
      observer?.observe(minimap);
    };
    if (!sync()) {
      timer = setInterval(() => {
        tries += 1;
        if (sync() || tries >= 20) { clearInterval(timer); timer = null; attach(); }
      }, 250);
    } else {
      attach();
    }
    /* ⚠️ ResizeObserver **只对尺寸变化触发**；而小地图的**开/关**改的是它**在不在**，
       面板开合改的是**位置**。这两类都不触发它 —— 这就是用户看到错位的原因。
       ⇒ 另挂一个 childList 观察：小地图挂载/卸载/换位都重算一次。 */
    if (typeof MutationObserver === 'function' && document.body) {
      presence = new MutationObserver(() => { attach(); });
      presence.observe(document.body, { childList: true, subtree: true });
    }
    window.addEventListener('resize', sync);
    return () => {
      if (timer) clearInterval(timer);
      observer?.disconnect();
      presence?.disconnect();
      window.removeEventListener('resize', sync);
    };
  }, [inline]);

  /* 底边那条进度条在导航格上是 **hover 充能**（纯装饰），在这一格上放**真实进度** ——
     同一门语言，但这一条说的是真话：有任务在跑、且后端报了张数时才出现。 */
  const activeTasks = tasks.filter(task => ACTIVE_STATES.has(task.status));
  const plannedTotal = activeTasks.reduce((sum, task) => sum + (Number(task.total) || 0), 0);
  const plannedDone = activeTasks.reduce((sum, task) => sum + (Number(task.done) || 0), 0);
  const barPercent = plannedTotal > 0 ? Math.min(100, Math.round((plannedDone / plannedTotal) * 100)) : null;

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = event => {
      if (!dockRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKeyDown = event => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const noticeCount = errorCount || activeCount;

  const retryFailedAssets = async task => {
    if (!task?.id || retryingTaskId) return;
    setRetryingTaskId(task.id);
    setRetryErrors(current => ({ ...current, [task.id]: '' }));
    try {
      const retryQuote = await quoteFailedEcommerceTask(task.id);
      const confirmed = await confirm({
        title: '补全未完成图片',
        message: `${retryQuote.quantity} 张未完成图片将单独补全，成功后消耗 ${retryQuote.quote.totalUnits} 电商图片 / 画布 AI 积分。`,
        confirmLabel: '开始补全',
      });
      if (!confirmed) return;
      await retryFailedEcommerceTask(task.id, { billingQuoteId: retryQuote.quote.quoteId });
      await refreshTasks();
    } catch (error) {
      setRetryErrors(current => ({
        ...current,
        [task.id]: error?.message || '补全图片失败，请稍后重试',
      }));
    } finally {
      setRetryingTaskId('');
    }
  };

  const dismissTerminalTask = async task => {
    if (!task?.id || dismissingTaskId || !task.actions?.includes('dismiss')) return;
    const confirmed = await confirm({
      title: '删除任务记录',
      message: '仅从任务列表移除这条记录，已生成图片和账务记录不会删除。',
      confirmLabel: '删除记录',
    });
    if (!confirmed) return;
    setDismissingTaskId(task.id);
    setDismissErrors(current => ({ ...current, [task.id]: '' }));
    try {
      await dismissTask(task.id);
    } catch (error) {
      setDismissErrors(current => ({
        ...current,
        [task.id]: error?.message || '删除任务记录失败，请稍后重试',
      }));
    } finally {
      setDismissingTaskId('');
    }
  };

  const triggerIcon = activeCount > 0
    ? <MdHourglassTop size={inline ? 19 : 20} className="animate-spin" />
    : errorCount > 0 ? <MdError size={inline ? 19 : 20} /> : <MdAutoAwesome size={inline ? 19 : 20} />;

  /* ═══ 侧栏格（批 J-④）：**整格就是 .app-sidebar-cell** ═══════════════════════════════
     与上面那几格同一块面、同一条底边渐变进度条、同一个 hover 充能、同一套文字变色。
     ⚠️ 有真实进度时挂 has-progress —— CSS 里会把装饰性的 hover 条藏掉，
        两条进度条不会同时出现（否则"充能"和"真进度"会互相打架）。 */
  const sidebarTrigger = (
    <button
      type="button"
      className={
        'app-sidebar-cell app-sidebar-task'
        + (open ? ' is-active' : '')
        + (activeCount > 0 ? ' is-live' : '')
        + (barPercent === null ? '' : ' has-progress')
      }
      title="生成过程"
      aria-label="打开任务列表"
      aria-expanded={open}
      aria-controls="global-task-dock-panel"
      onClick={() => setOpen(value => !value)}
    >
      <span className="app-sidebar-tile" aria-hidden="true">{triggerIcon}</span>
      <span className="app-sidebar-label">生成过程</span>
      {noticeCount > 0 && (
        <span className={'app-sidebar-task-badge' + (errorCount > 0 ? ' is-error' : '')} aria-hidden="true">
          {noticeCount}
        </span>
      )}
      {barPercent !== null && (
        <span className="app-sidebar-task-bar" style={{ width: barPercent + '%' }} aria-hidden="true" />
      )}
    </button>
  );

  /* ═══ 浮按钮（只剩画布页在用）：没有侧栏可供挂载时的回落形态 ═══════════════════════ */
  const floatingTrigger = (
    <button
      type="button"
      aria-label="打开任务列表"
      aria-expanded={open}
      aria-controls="global-task-dock-panel"
      onClick={() => setOpen(value => !value)}
      style={{
        position: 'relative',
        width: 46,
        height: 46,
        border: '1px solid rgba(70, 52, 38, 0.1)',
        borderRadius: 'var(--sb-radius-lg)',
        background: activeCount > 0 ? '#1f8a83' : '#fffaf4',
        color: activeCount > 0 ? 'var(--sb-neutral-0)' : '#554a42',
        boxShadow: '0 12px 30px rgba(84, 55, 35, 0.16)',
        cursor: 'pointer',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      {triggerIcon}
      {noticeCount > 0 && (
        <span style={{
          position: 'absolute',
          top: -7,
          right: -7,
          minWidth: 20,
          height: 20,
          padding: '0 5px',
          borderRadius: 'var(--sb-radius-pill)',
          background: errorCount > 0 ? '#c34f49' : '#db7c2d',
          color: 'var(--sb-neutral-0)',
          border: '2px solid #fffaf4',
          fontSize: 'var(--sb-text-xs)',
          fontWeight: 800,
          lineHeight: '16px',
        }}>
          {noticeCount}
        </span>
      )}
    </button>
  );

  const dock = (
    <div
      className={inline ? 'app-sidebar-task-host' : 'task-sidebar'}
      ref={dockRef}
      style={inline ? undefined : {
        position: 'fixed',
        /* 让位左侧常驻导航（用户 9-18 批注 #1 新增侧栏）：--sb-app-sidebar-w 由 .app-shell 提供，
           没有侧栏的页面（画布）回落到 0，浮层位置与从前完全一致。 */
        left: 'calc(var(--sb-app-sidebar-w, 0px) + 16px)',
        /* 画布页由上面那个 effect 量出小地图的实时顶沿，摆在它**上方 12px**；其余页面 86。
           ⚠️ 2026-10-01：小地图现在会把这根 `--ec-canvas-hud-clearance` **发布**出来
           （见 CanvasMinimap 的 useLayoutEffect），所以这里优先读它 —— 没有轮询窗口。
           原来只有下面那段 250ms 轮询去 `getBoundingClientRect`，而小地图是**异步**挂上来的，
           头几秒按钮还停在写死的 86 上，**正好压在小地图上**（实测 1280×800 重叠 46×46）。
           变量不存在（离开画布 / 小地图关掉 / 老逻辑没跑）时回落到算出来的 floatBottom。 */
        bottom: `var(--ec-canvas-hud-clearance, ${floatBottom}px)`,
        zIndex: 'var(--sb-z-panel)',
        display: 'flex',
        alignItems: 'flex-end',
        gap: 'var(--sb-space-2-5)',
      }}
    >
      {inline ? sidebarTrigger : floatingTrigger}

      {open && (
        <section
          id="global-task-dock-panel"
          aria-label="最近的生成任务"
          style={{
            /* ═══ 面板落点随挂载形态走（批 J-④）═════════════════════════════════════════
               侧栏形态：按钮在**侧栏底部**，面板就开在侧栏**右边**、与视口底对齐
                 （不再有"让位侧栏"的偏移量 —— 它本来就在侧栏外面）。
               浮按钮形态（画布页）：与从前的数值一模一样，一行不动。 */
            ...(inline ? {
              position: 'fixed',
              left: 'calc(var(--sb-app-sidebar-w, 0px) + 12px)',
              bottom: 16,
              zIndex: 'var(--sb-z-panel)',
              width: 'min(350px, calc(100vw - var(--sb-app-sidebar-w, 0px) - 24px))',
              maxHeight: 'min(620px, calc(100vh - 32px))',
            } : {}),
            width: inline ? undefined : 'min(350px, calc(100vw - 84px))',
            maxHeight: inline ? undefined : 'min(620px, calc(100vh - 150px))',
            overflow: 'hidden',
            border: '1px solid rgba(70, 52, 38, 0.1)',
            borderRadius: 'var(--sb-radius-2xl)',
            background: 'rgba(255, 252, 247, 0.98)',
            backdropFilter: 'blur(18px)',
            boxShadow: '0 22px 60px rgba(70, 44, 28, 0.2)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <header style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '15px 16px 12px',
            borderBottom: '1px solid rgba(70, 52, 38, 0.08)',
          }}>
            <div>
              <div style={{ fontSize: 'var(--sb-text-md)', fontWeight: 800, color: '#342b25' }}>生成任务</div>
              <div style={{ marginTop: 2, fontSize: 'var(--sb-text-xs)', color: '#867970' }}>离开当前页面也会继续更新</div>
            </div>
            <button
              type="button"
              aria-label="关闭任务列表"
              onClick={() => setOpen(false)}
              style={{
                width: 32,
                height: 32,
                border: 0,
                borderRadius: 'var(--sb-radius-md)',
                background: 'rgba(70, 52, 38, 0.06)',
                color: '#6c6058',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <MdClose size={17} />
            </button>
          </header>

          <div style={{ overflowY: 'auto', padding: 10 }}>
            {loadError && (
              <div role="alert" style={{
                margin: '2px 2px 10px',
                padding: '10px 12px',
                borderRadius: 'var(--sb-radius-lg)',
                background: '#fff0ed',
                color: '#a8403a',
                fontSize: 'var(--sb-text-sm)',
              }}>
                {loadError}
                <button type="button" onClick={refreshTasks} style={{ marginLeft: 8 }}>重新加载</button>
              </div>
            )}

            {tasks.length === 0 ? (
              <div style={{ padding: '34px 20px', textAlign: 'center' }}>
                <MdAutoAwesome size={28} color="#b6a89d" />
                <div style={{ marginTop: 10, fontSize: 'var(--sb-text-md)', fontWeight: 700, color: '#5f534b' }}>还没有生成任务</div>
                <div style={{ marginTop: 4, fontSize: 'var(--sb-text-xs)', lineHeight: 1.6, color: '#93867d' }}>开始生成后，可在这里随时查看进度和失败原因。</div>
              </div>
            ) : tasks.map(task => {
              const meta = STATUS_META[task.status] || STATUS_META.queued;
              const Icon = meta.icon;
              const active = ACTIVE_STATES.has(task.status);
              const percent = task.total > 0 ? Math.min(100, Math.round((task.done / task.total) * 100)) : 0;
              const assetErrors = (task.assets || []).filter(asset => asset.error);
              const retryError = retryErrors[task.id];
              const dismissError = dismissErrors[task.id];
              const retrying = retryingTaskId === task.id;
              const dismissing = dismissingTaskId === task.id;
              return (
                <article
                  key={task.id}
                  style={{
                    marginBottom: 8,
                    padding: 12,
                    border: '1px solid rgba(70, 52, 38, 0.08)',
                    borderRadius: 'var(--sb-radius-lg)',
                    background: 'var(--sb-neutral-0)',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      padding: 0,
                      background: 'transparent',
                      color: 'inherit',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sb-space-2-5)' }}>
                      <span style={{
                        width: 32,
                        height: 32,
                        flex: '0 0 32px',
                        borderRadius: 'var(--sb-radius-md)',
                        background: `${meta.color}18`,
                        color: meta.color,
                        display: 'grid',
                        placeItems: 'center',
                      }}>
                        <Icon size={17} className={active ? 'animate-spin' : ''} />
                      </span>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: 'block', fontSize: 'var(--sb-text-md)', fontWeight: 800, color: '#3a302a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {task.title || task.params?.product_name || '电商套图'}
                        </span>
                        <span style={{ display: 'block', marginTop: 2, fontSize: 'var(--sb-text-xs)', color: meta.color, fontWeight: 700 }}>
                          {meta.label}
                        </span>
                      </span>
                    </div>

                    {task.total > 0 && (
                      <span style={{ display: 'block', marginTop: 10 }}>
                        <span style={{ display: 'block', height: 5, overflow: 'hidden', borderRadius: 'var(--sb-radius-xs)', background: '#eee8e2' }}>
                          <span style={{ display: 'block', width: `${percent}%`, height: '100%', borderRadius: 'var(--sb-radius-xs)', background: task.failed > 0 ? '#bd7026' : '#1f8a83' }} />
                        </span>
                        <span style={{ display: 'block', marginTop: 5, fontSize: 'var(--sb-text-xs)', color: '#7d7169' }}>{progressText(task)}</span>
                      </span>
                    )}
                  </div>

                  {(task.error || assetErrors.length > 0) && (
                    <div role="alert" style={{ marginTop: 9, padding: '8px 10px', borderRadius: 'var(--sb-radius-md)', background: '#fff3ee', color: '#9f493c', fontSize: 'var(--sb-text-xs)', lineHeight: 1.5 }}>
                      {task.error && <div>{task.error}</div>}
                      {assetErrors.map(asset => (
                        <div key={asset.id} style={{ marginTop: task.error ? 5 : 0 }}>
                          <strong>{asset.label}</strong>：{asset.error}
                        </div>
                      ))}
                    </div>
                  )}

                  {retryError && (
                    <div role="alert" style={{ marginTop: 9, padding: '8px 10px', borderRadius: 'var(--sb-radius-md)', background: '#fff3ee', color: '#9f493c', fontSize: 'var(--sb-text-xs)', lineHeight: 1.5 }}>
                      {retryError}
                    </div>
                  )}

                  {dismissError && (
                    <div role="alert" style={{ marginTop: 9, padding: '8px 10px', borderRadius: 'var(--sb-radius-md)', background: '#fff3ee', color: '#9f493c', fontSize: 'var(--sb-text-xs)', lineHeight: 1.5 }}>
                      {dismissError}
                    </div>
                  )}

                  {task.actions?.includes('retry_failed') && (
                    <button
                      type="button"
                      onClick={() => retryFailedAssets(task)}
                      disabled={retrying || Boolean(retryingTaskId)}
                      style={{
                        marginTop: 9,
                        width: '100%',
                        minHeight: 34,
                        border: '1px solid rgba(189, 112, 38, 0.25)',
                        borderRadius: 'var(--sb-radius-md)',
                        background: '#fff8ef',
                        color: '#9a591f',
                        fontSize: 'var(--sb-text-sm)',
                        fontWeight: 700,
                        cursor: retrying || retryingTaskId ? 'wait' : 'pointer',
                        opacity: retrying || retryingTaskId ? 0.65 : 1,
                      }}
                    >
                      {retrying ? '正在确认费用…' : '补全未完成图片'}
                    </button>
                  )}
                  {task.actions?.includes('dismiss') && (
                    <button
                      type="button"
                      onClick={() => dismissTerminalTask(task)}
                      disabled={dismissing}
                      aria-label={`删除任务记录：${task.title || '电商套图'}`}
                      style={{
                        marginTop: 7,
                        width: '100%',
                        minHeight: 32,
                        border: '1px solid rgba(70, 52, 38, 0.12)',
                        borderRadius: 'var(--sb-radius-md)',
                        background: 'var(--sb-neutral-0)',
                        color: '#756a62',
                        fontSize: 'var(--sb-text-sm)',
                        fontWeight: 700,
                        cursor: dismissing ? 'wait' : 'pointer',
                        opacity: dismissing ? 0.65 : 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 'var(--sb-space-1-5)',
                      }}
                    >
                      <MdDeleteOutline size={15} />
                      {dismissing ? '正在删除…' : '删除任务记录'}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );

  /* 侧栏存在 → 挂进侧栏底部插槽；不存在（画布页）→ 原地做左下角浮按钮。 */
  return inline ? createPortal(dock, slot) : dock;
}