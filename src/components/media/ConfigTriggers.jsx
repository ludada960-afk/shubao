import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { MdCropFree } from 'react-icons/md';

import ModelLogo from '../ModelLogo.jsx';
import { brandLogo } from '../../services/modelLogos.js';
import { SELECTABLE_IMAGE_MODELS, normalizeImageModel } from '../../services/imageModelCatalog.js';
import { useDismissOverlay, OVERLAY_ROOT_ATTR } from './useDismissOverlay.js';
import './ConfigTriggers.css';

/* ═══ 生成配置的两颗触发器（生图模型 / 画面规格）**共用组件**（2026-09-29 批 DC 续-8）════════════
   用户 2026-09-29 逐字（指概念视觉方案那一页）：
     「你不可以像首页这样就是做成一个**生图模型的按钮和面板**，还有一个**画面规格的一个按钮和面板**吗？
       你就只排两个按钮进去子页面里面不就好了吗？然后用户他点击之后就可以在面板里面选中相应的配置。
       这样不是更干净简洁吗？**你为什么要把子页面的规划搞得乱七八糟呢？**」
     「当然你张开的面板，你也要好好的做好适配，因为**之前视频生成那边就存在过这个问题。就是相应的模型
       选择按钮打开之后，它的面板是会被左边导航栏截断的。**」

   为什么是**抽组件**而不是各写一份：
     首页那一套（`VisualCreationMode.jsx` 的 `visual-config-trigger` + portal 面板）已经是站内事实标准，
     用户说的就是"像首页这样"。子页面再写一份，就是本仓最忌讳的第二套实现 ——
     历史上"两套东西在做"这句话用户说过不止一次（config-kit-parity-0925 那条门禁就是为此存在的）。
   ⚠️ 面板**内容**不重写控件：规格面板里那两格直接交给 `FieldRenderer` 渲染原来的字段声明
     （比例 / 清晰度），所以药丸外观、折叠规则、必填标记、禁用逻辑全都是**原来那一份**。
     本组件只负责"两颗按钮 + 一个浮层 + 坐标计算"。 */

/** 左侧导航栏的右缘：浮层的 x 坐标必须让开它。
 *  视频侧早就写过一份（`VideoStudio/index.jsx` 的 `floatingLeftInset`），这里同一条纪律。
 *  ⚠️ 侧栏在窄屏会变成底栏，那时 `right` 会盖住整条视口宽度 —— 所以只在它**确实是左侧一条竖栏**时让位。 */
function sidebarInset() {
  if (typeof document === 'undefined') return 12;
  const nav = document.querySelector('.app-sidebar');
  if (!nav) return 12;
  const rect = nav.getBoundingClientRect();
  /* 底栏形态（宽度接近整屏）不该让位，否则浮层会被推到屏幕外。 */
  if (rect.width > window.innerWidth * 0.5) return 12;
  return Math.max(12, Math.round(rect.right) + 12);
}

/** 浮层坐标：**吸附到触发按钮**，下方放不下就翻到上方，再夹进视口。
 *
 *  ⚠️⚠️ 2026-09-29 批 DC 续-17：这一段被同一批用户**两次**纠正过，第三次才落对。
 *    批 DC 续-14 我把它改成「一律顶到视口上沿」（用户当时说「你把面板居最上面」）；
 *    批 DC 续-15 又因为「滑动就脱离」把 scroll 监听**整条删掉** —— 那次是**修错了地方**：
 *      脱离的根因不是"跟着滚"，而是锚点选错了：我当时拿 `.app-topbar` 的下沿当锚，
 *      而顶栏是 sticky、滚过 120px 会加 `.is-compact` **改变自身高度** ⇒ 位置一跳一跳。
 *    批 DC 续-17（用户 2029-09-29 第三次原话：「**它必须吸附在按钮上呀，你这个又没有吸附住**」）
 *      把两件事一起定了：锚点换成**按钮自己的视口矩形**，scroll 监听**加回来**。
 *      按钮在视口坐标系里的 rect 随滚动**稳定变化**（它就是要跟着按钮走），
 *      所以"跟着按钮"和"不脱离"这两件事**不矛盾** —— 上一批把它们当成互斥，才是错的。
 *
 *  高度与翻转：优先**按钮下方**（`rect.bottom + 10`）；下方不够就翻到**上方**
 *  （`rect.top - 10 - height`）；两侧都不够才夹进视口，并且**永不超过视口**。
 *  ⇒ 批 DC 续-14 那个"互相截断"的担心仍然被满足，但不再以"脱离按钮"为代价。 */
function panelPosition(button, desiredHeight) {
  const rect = button.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const leftInset = sidebarInset();
  const width = Math.min(420, Math.max(240, viewportWidth - leftInset - 16));
  /* 顶栏之下是禁区：面板不许压到顶栏上。量不到顶栏就退回 12。 */
  const bar = document.querySelector('.app-topbar');
  const ceil = Math.max(12, (bar ? Math.round(bar.getBoundingClientRect().bottom) : 0) + 12);
  const floor = viewportHeight - 12;
  const gap = 10;

  const roomBelow = floor - (rect.bottom + gap);
  const roomAbove = (rect.top - gap) - ceil;
  const cap = Math.max(160, Math.min(Math.round(viewportHeight * 0.92), viewportHeight - ceil));

  /* ⚠️⚠️ 往**上**开的时候必须按 `bottom` 定位，**不能**按 `top` 算。
     第一版翻到上方时写的是 `top = rect.top - gap - maxHeight` —— 那是拿**上限高度**倒推，
     而面板实际渲染高度是**内容高度**（实测 maxHeight 714、实高 554）⇒ 面板底边离按钮
     差了 162px，看起来又"脱离"了。
     ⇒ 改成只给 `bottom`（离视口底多少），让 CSS 把面板底边钉在按钮上方 gap 处；
        面板多高就多高，永远贴着。（首页 `getVisualPanelPosition` 当初也是这么写的。）
     ⚠️ 判据也从「下方至少还有 160px」改成「下方**放得下这一块**」——
        否则在「生成设置」那个位置（下方 236px / 上方 714px）会硬开在下方并被视口底边切掉。 */
  const place = roomBelow >= desiredHeight
    ? { top: rect.bottom + gap, bottom: undefined, maxHeight: Math.min(roomBelow, cap) }
    : roomAbove >= Math.min(desiredHeight, 160)
      ? { top: undefined, bottom: Math.max(12, Math.round(viewportHeight - rect.top + gap)), maxHeight: Math.min(roomAbove, cap) }
      /* 两侧都不够：取空间多的一侧夹进视口，宁可内部滚动。 */
      : roomBelow >= roomAbove
        ? { top: Math.min(rect.bottom + gap, Math.max(ceil, floor - cap)), bottom: undefined, maxHeight: Math.min(Math.max(160, roomBelow), cap) }
        : { top: undefined, bottom: Math.max(12, Math.round(viewportHeight - rect.top + gap)), maxHeight: Math.min(Math.max(160, roomAbove), cap) };

  return {
    left: Math.max(leftInset, Math.min(rect.left + rect.width / 2 - width / 2, viewportWidth - width - 16)),
    top: place.top == null ? undefined : Math.round(place.top),
    bottom: place.bottom,
    width,
    maxHeight: Math.round(Math.max(160, place.maxHeight)),
    anchorX: rect.left + rect.width / 2,
  };
}

/* ═══ 2026-09-29 批 DC 续-19：这一份从**硬编码**改成**声明驱动** ═══════════════════════════════════════
   改前是 `{ model: {title:'生图模型', …}, specs: {title:'画面规格', …} }` 写死在这里 ——
   于是「两颗触发器」这个形态**只能长在图片技能上**：视频侧要显示「视频模型 / 视频规格」
   就必须先改这个文件（而它被 `config-triggers-0929` 门禁逐字钉着）。
   ⇒ 现在标题与说明由**字段声明**给（`modelLabelText` / `specLabelText` / `modelNote` / `specNote`），
      不给就用下面这份默认 —— 45+ 条既有声明一个字不用改，行为逐字不变。
   ⚠️ 下面这行默认值**仍然被门禁逐字钉着**（`config-triggers-0929` ② 就是查它），
      改它之前先想清楚是不是要连门禁一起改。 */
const PANEL_META = {
  model: { title: '生图模型', note: '换模型会按它的能力夹取清晰度档位' },
  specs: { title: '画面规格', note: '比例与清晰度决定这张图的实际尺寸' },
};

/** 触发器上那行摘要：把每一格的**当前值**翻成标签（药丸上是标签、不是 value）。
 *  ⚠️ 传进来的是已经渲染好的节点，拿不到声明，所以标签由调用方一起给（`specSummaries`）。 */
function specSummaryOf(values, specNodes, specSummaries) {
  if (Array.isArray(specSummaries) && specSummaries.length) return specSummaries.filter(Boolean).join(' · ');
  return specNodes.length ? specNodes.length + ' 项' : '';
}

export default function ConfigTriggers({
  /* ⚠️ 2026-09-29 批 DC 续-19：`triggers` 决定**渲染几颗按钮**。
     默认两颗（图片侧既有形态）；`['specs']` = 只有规格（给那 44 条"规格散落、
     本来就没有模型选择器"的技能用的降级形态 —— 不该为了统一硬塞一个模型按钮）。 */
  triggers = ['model', 'specs'],
  modelKey = '',
  modelLabel = '',
  modelBrand = '',
  modelNode = null,
  modelLabelText = '',
  specLabelText = '',
  modelNote = '',
  specNote = '',
  specNodes = [],
  specSummaries = [],
  values = {},
  disabled = false,
  onChange,
  /* ⚠️ 2026-09-29 批 DC 续-14：`coverLabels` 这个 prop **删掉了**。
     它本来渲染的是「改完点面板外面收起。」—— 用户 2026-09-29 逐字要求删掉同一类的
     下面那句「模型与画面规格收在这里，点开改；下面清单里的手法不受影响」：
       「这句不要有啊，删掉」。
     两句都是我自己加的**教学/操作说明**，不是用户要的信息 ——
     点开面板、点外面收起，本来就是浮层的既有行为，写出来只是占地方。
     ⇒ 一次把两句都删干净，不留"改了一句留一句"。 */
}) {
  const [open, setOpen] = useState(null);        // null | 'model' | 'specs'
  const [pos, setPos] = useState(null);
  const buttonRefs = { model: useRef(null), specs: useRef(null) };
  const model = normalizeImageModel(modelKey ? values[modelKey] : '');
  /* 标题/说明：声明给了就用声明的，没给才落回那份（被门禁钉着的）默认。 */
  const metaOf = panelId => ({
    title: (panelId === 'model' ? modelLabelText : specLabelText) || PANEL_META[panelId].title,
    note: (panelId === 'model' ? modelNote : specNote) || PANEL_META[panelId].note,
  });

  const measure = useCallback(panel => {
    const button = buttonRefs[panel] && buttonRefs[panel].current;
    if (!button) return;
    setPos(panelPosition(button, panel === 'model' ? 520 : 460));
  }, []);

  const toggle = panel => {
    if (open === panel) { setOpen(null); return; }
    measure(panel);
    setOpen(panel);
  };

  /* 打开时算一次坐标，之后**跟着按钮走**（这就是「吸附在按钮上」）。
   *
   * ⚠️ 2026-09-29 批 DC 续-17：批 DC 续-15 把 scroll 监听**整条删掉**了，
   *   理由是"滚动时重算会脱离"。**那个诊断错了**：脱离的根因是**锚点选错** ——
   *   当时拿 `.app-topbar` 的下沿当锚，而顶栏是 sticky、滚过 120px 会加 `.is-compact`
   *   **改变自身高度**，所以 top 跳来跳去。
   *   锚点因此换成**按钮自己的视口矩形**。
   *
   * ⚠️⚠️ 2026-09-29 批 DC 续-18：**这段 scroll 跟随被整条删掉了**。
   *   用户实测知渔之后的全局口径是「**滚轮一滚，浮层就关**」，所以浮层**不再需要跟着滚** ——
   *   跟着滚的那套（重算坐标、翻上翻下、防撕裂）在"滚一下就关"面前全是白做的。
   *   ⇒ 现在只在**打开时**量一次 + `resize` 时重量；滚轮/滚动/缩放一律走
   *     `useDismissOverlay` 收起。批 DC 续-15 与续-17 在这条上反复改了三版，
   *     根因是**问题问错了**（在"怎么跟得稳"上找答案，而正确答案是"根本不用跟"）。 */
  useLayoutEffect(() => { if (open) measure(open); }, [open, measure]);
  useEffect(() => {
    if (!open) return undefined;
    const onResize = () => measure(open);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open, measure]);
  /* 全局口径：滚轮 / 滚动 / 缩放 ⇒ 收起（实现见 useDismissOverlay.js，那里只有一个全局监听）。 */
  useDismissOverlay(Boolean(open), () => setOpen(null));

  /* 点外面 / ESC 收起。⚠️ 监听用 capture：**面板与触发器都在 React 树里**，
     而这段代码活在 useEffect 里（不在渲染期），直接监听不会撞上"打开的那一下"就立刻关闭。 */
  useEffect(() => {
    if (!open) return undefined;
    const onKey = event => { if (event.key === 'Escape') setOpen(null); };
    const onDown = event => {
      const panel = document.getElementById('config-triggers-panel');
      const button = buttonRefs[open] && buttonRefs[open].current;
      if (panel && panel.contains(event.target)) return;
      if (button && button.contains(event.target)) return;
      setOpen(null);
    };
    const timer = window.setTimeout(() => document.addEventListener('mousedown', onDown, true), 0);
    window.addEventListener('keydown', onKey);
    return () => { window.clearTimeout(timer); document.removeEventListener('mousedown', onDown, true); window.removeEventListener('keydown', onKey); };
  }, [open]);

  const specSummary = specSummaryOf(values, specNodes, specSummaries);

  const panel = open && pos ? (
    <div
      id="config-triggers-panel"
      className="visual-config-panel"
      data-portal-host="workbench"
      /* 标成"浮层根"：全局那个滚轮监听据此**放过面板内部的滚动** ——
         用户在比例那 12 档列表里上下翻，不该把面板自己关掉。 */
      {...{ [OVERLAY_ROOT_ATTR]: 'true' }}
      data-density={pos.maxHeight < (open === 'model' ? 520 : 460) ? 'compact' : 'comfortable'}
      role="dialog"
      aria-label={metaOf(open).title}
      style={{
        position: 'fixed',
        left: pos.left, top: pos.top, bottom: pos.bottom,
        width: pos.width, maxHeight: pos.maxHeight,
        transformOrigin: 'bottom center',
        '--visual-panel-anchor-x': `${Math.max(28, Math.min(pos.width - 28, pos.anchorX - pos.left))}px`,
      }}
    >
      <div className="visual-config-panel-body">
        {open === 'model' && modelNode}
        {open === 'specs' && specNodes}
      </div>
    </div>
  ) : null;

  return (
    <div className="visual-config-cluster media-workbench-config-triggers" aria-label="生成配置">
      {triggers.includes('model') && modelNode && (
        <button
          type="button"
          ref={node => { buttonRefs.model.current = node; }}
          className={'visual-config-trigger' + (open === 'model' ? ' is-open' : '')}
          aria-expanded={open === 'model'}
          disabled={disabled}
          onClick={() => toggle('model')}
        >
          <span className="visual-config-trigger-mark" aria-hidden="true">
            <ModelLogo logo={brandLogo(modelBrand || 'openai')} size={28} radius={8} />
          </span>
          <span className="visual-config-trigger-copy">
            <small>{modelLabelText || '生图模型'}</small>
            <strong>{modelLabel || model || '未选择'}</strong>
          </span>
          <ChevronDown className="visual-config-trigger-chevron" size={14} aria-hidden="true" />
        </button>
      )}
      {triggers.includes('specs') && specNodes.length > 0 && (
        <button
          type="button"
          ref={node => { buttonRefs.specs.current = node; }}
          className={'visual-config-trigger' + (open === 'specs' ? ' is-open' : '')}
          aria-expanded={open === 'specs'}
          disabled={disabled}
          onClick={() => toggle('specs')}
        >
          <MdCropFree aria-hidden="true" />
          <span className="visual-config-trigger-copy">
            <small>{specLabelText || '画面规格'}</small>
            <strong>{specSummary || '未选择'}</strong>
          </span>
          <ChevronDown className="visual-config-trigger-chevron" size={14} aria-hidden="true" />
        </button>
      )}
      {panel ? createPortal(panel, document.body) : null}
    </div>
  );
}
