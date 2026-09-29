import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { MdCropFree } from 'react-icons/md';

import ModelLogo from '../ModelLogo.jsx';
import { brandLogo } from '../../services/modelLogos.js';
import { SELECTABLE_IMAGE_MODELS, normalizeImageModel } from '../../services/imageModelCatalog.js';
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

/** 浮层坐标：**顶到视口上沿**，横向跟着触发按钮，高度按可用空间封顶。
 *
 *  ⚠️ 2026-09-29 批 DC 续-14（用户 2026-09-29 逐字）：
 *    「子页面的模型和规格的面板应该**尽量跟首页的样式和间距和 UI 等等保持一致**，
 *      如果会有适配上面**互相截断**等问题，你就把面板**居最上面**，
 *      这样应该就不会和其他的部分打架了。」
 *
 *  改前是"按可用空间决定向上还是向下开"（搬自首页 `getVisualPanelPosition`）。
 *  那是**首页**那套：首页的两颗按钮在页面**底部**，向上开正好落在空白区。
 *  子页面这两颗在**左栏中部**，向上开就压在大标题、说明文字、输入框上（实测截图就是这样）。
 *  ⇒ 改成**一律顶到上沿**（顶栏之下留一档），横向仍跟着触发按钮并夹住：
 *     这样面板永远落在"最上面那条空白带"里，不与页面正文打架；
 *     代价是不再"贴着按钮下沿"，但换来的是**任何滚动位置、任何触发器位置都不打架**。
 *  ⚠️ 视觉规格/内边距与首页同源那部分**没动**（`ConfigTriggers.css` 复用 `.visual-config-*`），
 *     这次只改**开在哪**。
 */
function panelPosition(button, desiredHeight) {
  const rect = button.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const leftInset = sidebarInset();
  const width = Math.min(420, Math.max(240, viewportWidth - leftInset - 16));
  /* 顶栏之下留 12px；顶栏本身是 fixed 高约 64px，所以从 64 起算，不是从 0。
     量不到顶栏就退回 12 —— 那时面板会贴着视口顶，仍然不与正文打架。 */
  const bar = document.querySelector('.app-topbar');
  const barBottom = bar ? Math.round(bar.getBoundingClientRect().bottom) : 0;
  const top = Math.max(12, barBottom + 12);
  const maxHeight = Math.min(Math.round(viewportHeight * 0.92) - top, Math.max(desiredHeight, 160));
  return {
    left: Math.max(leftInset, Math.min(rect.left + rect.width / 2 - width / 2, viewportWidth - width - 16)),
    top,
    bottom: undefined,
    width,
    maxHeight: Math.max(160, maxHeight),
    anchorX: rect.left + rect.width / 2,
  };
}

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
  modelKey = '',
  modelLabel = '',
  modelBrand = '',
  modelNode = null,
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

  /* 滚动 / 缩放时贴着按钮走（浮层是 fixed 的，不跟着动就会飘）。 */
  useLayoutEffect(() => { if (open) measure(open); }, [open, measure]);
  useEffect(() => {
    if (!open) return undefined;
    const onMove = () => measure(open);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open, measure]);

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
      data-density={pos.maxHeight < (open === 'model' ? 520 : 460) ? 'compact' : 'comfortable'}
      role="dialog"
      aria-label={PANEL_META[open].title}
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
      {modelNode && (
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
            <small>生图模型</small>
            <strong>{modelLabel || model || '未选择'}</strong>
          </span>
          <ChevronDown className="visual-config-trigger-chevron" size={14} aria-hidden="true" />
        </button>
      )}
      {specNodes.length > 0 && (
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
            <small>画面规格</small>
            <strong>{specSummary || '未选择'}</strong>
          </span>
          <ChevronDown className="visual-config-trigger-chevron" size={14} aria-hidden="true" />
        </button>
      )}
      {panel ? createPortal(panel, document.body) : null}
    </div>
  );
}
