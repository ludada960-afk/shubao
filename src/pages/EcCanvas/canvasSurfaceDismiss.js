/* ═══════════════════════════════════════════════════════════════════════════
   画布浮层「关闭仲裁」—— 2026-09-29 批 CY-⑭
   ═══════════════════════════════════════════════════════════════════════════

   用户原话（逐字，两条一起看）：
     ① 「然后我点击打开水印面板的话，我再去点击其他的功能区，比如我点击我们现在画布左边的这个加号，
         这个加号会弹出来那些选项，可是你这个水印面板并不会自己关掉。也就是说你对于面板的一个关闭的
         判断，现在还没有搞得特别明白。有可能会出现这个水印面板在左边张开，然后我点击左边这个加号，
         他也在左边张开，那他们两者就打架了的一个情况。这种情况他应该不是一个孤立的情况，
         可能还有很多其他的情况也是类似的问题。所以我只是举了一个例子，
         你自己要全面的思考这些逻辑，要怎么去判断，怎么去解决。」
     ② 「他们拉出来这块选项面板是没错的，但是当我点击其他空地的时候，这块面板却没有自动关掉。」

   事故根因（`index.jsx` 逐条查出来的，不是猜的）：
     · 画布上每个浮层都是**各自独立的 `useState`**，一共 16 个，**没有任何登记册**；
     · 「点空白 = 收起全部功能栏」那段代码（`handlePointerDown` 的 `else`/pan 分支）
       **对于默认的框选工具是死代码** —— `getCanvasPointerIntent` 在 select 工具 + 左键
       + 空白处返回的是 `'marquee'`，所以 `else` 那一支永远走不到，
       `setConnectionPicker(null)` 永远不执行 ⇒ 派生菜单点空白不关；
     · 水印面板（`watermarkPanelOpen`）**根本没有 outside-click，也根本不接 Escape**，
       只有自己的 ✕ / 取消 / 确定三个出口；
     · Escape 处理器（两处）各自只清自己那几个 key，谁也不管谁。

   本模块就是那张**缺失的登记册**：谁在画布上开浮层、它叫什么、点空白/Escape 时该不该一起收起。
   `index.jsx` 的 `dismissAllCanvasSurfaces` 按这张表逐个关；
   门禁 `test/canvas-surface-dismiss-0929.test.mjs` 断言「每一个浮层 state 都登记在册」，
   下次有人再加一个浮层却忘了登记，门禁会红。
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 画布上的**临时浮层**登记册。
 *
 * `blank`  = 点画布空白处要不要一起收起（用户 ① ② 的核心诉求）
 * `escape` = 按 Esc 要不要一起收起
 * 两者都为 true 的才是「跟随型」浮层；模态（资产库/模板广场/工作流）由自己的遮罩管，不在此册。
 */
export const CANVAS_TRANSIENT_SURFACES = Object.freeze({
  addMenuOpen: { label: '左侧「+」添加菜单', blank: true, escape: true },
  connectionPicker: { label: '素材派生菜单（左右加号）', blank: true, escape: true },
  activeComposerSurface: { label: '生成框参数弹层（模型 / 生成配置 / 技能）', blank: true, escape: true },
  contextMenu: { label: '节点右键菜单', blank: true, escape: true },
  canvasContextPanel: { label: '画布右键面板', blank: true, escape: true },
  addNodePanel: { label: '双击空白的新增面板', blank: true, escape: true },
  watermarkPanelOpen: { label: '水印面板', blank: true, escape: true },
  layersPanelOpen: { label: '图层面板', blank: true, escape: true },
  focusedEditor: { label: '图片编辑器', blank: true, escape: true },
  imageInfoNode: { label: '图片信息弹窗', blank: true, escape: true },
  outpaintDraft: { label: '扩图草稿', blank: true, escape: true },
  textInspectorNodeId: { label: '文字图层检查器', blank: true, escape: true },
  editingTextNodeId: { label: '文字工具条', blank: true, escape: true },
  nodeActionBar: { label: '节点悬浮工具条', blank: true, escape: true },
  connectionDraft: { label: '连线拖拽中', blank: false, escape: true },
});

/** 登记册里全部 key（门禁用）。 */
export function canvasTransientSurfaceKeys() {
  return Object.keys(CANVAS_TRANSIENT_SURFACES);
}

/**
 * 给「按空白」与「按 Esc」两个场景，各返回一份该关的 key 清单。
 * 纯函数：门禁可以直接断言结果，不依赖 React。
 */
export function canvasSurfacesToDismiss(trigger = 'blank') {
  return canvasTransientSurfaceKeys().filter(key => CANVAS_TRANSIENT_SURFACES[key]?.[trigger] === true);
}

/** 某个浮层打开时，**必须先关掉**的那些浮层（自己除外）——用来做「开一个关其它」。 */
export function canvasSurfacesSuppressedBy(openingKey) {
  return canvasTransientSurfaceKeys().filter(key => key !== openingKey && CANVAS_TRANSIENT_SURFACES[key]?.blank === true);
}
