import React, { useEffect, useMemo } from 'react';
import {
  FolderOpen, Home, Image as ImageIcon, Images, Layers, Video,
} from 'lucide-react';
import { useApp } from '../../store/AppContext.jsx';
import { hubPath } from '../../skills/skillDirectory.js';

/* ═══ 左侧常驻导航 · 窄栏竖排（2026-09-19 用户批注 #7 重构）══════════════════════════
   用户原话（这一轮最重的一条）：
     「左边这个导航栏啊，我觉得你还不如就抄这一家的做法。https://flova.tv/zh-CN/
      就是上面是图标，下面是文字。这样的左边导航栏它就不会看起来很大。知渔AI那种我觉得
      也不是特别的好。我觉得像 flova 这种这样做的话，左边的导航栏就会比较小。
      甚至可以不要这个折叠按钮了，连折叠按钮都可以不用做。」
     「包括导航栏，你也得重构导航栏，我觉得你目前来说就先做视频生成和电商生成的这两个
      总页面的入口就可以。然后整体的样式，整体的逻辑，你要按原来这四个导航栏去设计。」
     「你这个 UI 跟我们现在整个的视觉语言完全不是一回事……你这个就是个 demo 呀。
      必须有非常前沿的美感和设计语言。」

   所以这一版是**重写**，不是调参。三条设计决定：
     ① **形态照 flova**（实测：aside 宽 90px、每项 40×47、图标 30×30 在文字上方、
        flex-direction:column）；我们取 96px（中文四字标签「图片生成」要放得下）。
        折叠按钮**删掉**（用户明说可以不要）—— 宽度固定就没有折叠这回事。
     ② **入口只留两个总页面**（图片生成 / 视频生成）+ 首页 + 三个工作区入口。
        电商生图 / 小红书图文 / 自由创作**从这里下架**：用户批注 #5-②「他们现在没有这种
        高度定制的入口了，他们只有高度定制的子页面。他们的入口就是从我们这里下面的推荐 skill
        进去，或者是从图片生成的那个总页面那里进去」。
     ③ **视觉语言按原来那四个图标栏的规格来**（用户：「原来是怎么设计的你就怎么设计」）：
        沿用 app-shell.css 里那套 motion-* 图标动效与小尺寸档位，但把「悬浮胶囊」升级成
        **常驻窄栏**：暖色分层底 + 发丝描边 + 图标磁贴 + 选中态左侧指示条。
   ⚠️ 技能清单**不在这里手抄**（这一版连精品推荐子列表都不放了）—— 入口是首页推荐位与总页面。 */

export default function AppSidebar() {
  const { state, dispatch } = useApp();
  const { page } = state;

  const requestLogin = target => {
    const destination = typeof target === 'string' ? target : target?.type === 'OPEN_CANVAS' ? 'ec-canvas' : target?.page;
    dispatch({
      type: 'SET_LOGIN_INTENT',
      intent: { destination, source: state.page, ...(typeof target === 'object' && target?.tab ? { canvasTab: target.tab } : {}) },
    });
    dispatch({ type: 'SHOW_LOGIN', show: true });
  };

  /* 两个总页面 —— 用户批注 #7-②：「你目前来说就先做视频生成和电商生成的这两个总页面的入口就可以」 */
  const hubs = useMemo(() => ([
    { key: 'image', label: '图片生成', icon: ImageIcon, page: 'image-creation', motion: 'grid' },
    { key: 'video', label: '视频生成', icon: Video, page: 'video-creation', motion: 'video' },
  ]), []);

  const workspace = [
    { key: 'canvas', label: '无限画布', icon: Layers, motion: 'canvas', active: page === 'ec-canvas', onClick: () => (state.logged ? dispatch({ type: 'OPEN_CANVAS' }) : requestLogin('ec-canvas')) },
    { key: 'works', label: '我的作品', icon: FolderOpen, motion: 'folder', active: false, onClick: () => (state.logged ? dispatch({ type: 'OPEN_CANVAS', tab: 'works' }) : requestLogin({ type: 'OPEN_CANVAS', tab: 'works' })) },
    { key: 'assets', label: '我的资产', icon: Images, motion: 'assets', active: page === 'ec-canvas' && state.canvasEntryTab === 'assets', onClick: () => (state.logged ? dispatch({ type: 'OPEN_CANVAS', tab: 'assets' }) : requestLogin({ type: 'OPEN_CANVAS', tab: 'assets' })) },
  ];

  const goHome = () => {
    window.history.pushState({}, '', '/');
    dispatch({ type: 'NAVIGATE', page: 'home' });
  };
  const openHub = board => {
    window.history.pushState({}, '', hubPath(board));
    dispatch({ type: 'NAVIGATE', page: board === 'video' ? 'video-creation' : 'image-creation' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cell = ({ key, label, icon: Icon, motion, active, onClick }) => (
    <button
      key={key}
      type={'button'}
      className={'app-sidebar-cell' + (active ? ' is-active' : '')}
      onClick={onClick}
      title={label}
      aria-current={active ? 'page' : undefined}
    >
      <span className={'app-sidebar-tile motion-' + motion} aria-hidden={'true'}><Icon size={19} /></span>
      <span className={'app-sidebar-label'}>{label}</span>
    </button>
  );

  return (
    <nav className={'app-sidebar'} aria-label={'主导航'}>
      <button type={'button'} className={'app-sidebar-brand'} onClick={goHome} title={'薯包 AI · 首页'} aria-label={'薯包 AI 首页'}>
        <img src={'/images/logo.png'} alt={''} width={30} height={30} />
      </button>

      <div className={'app-sidebar-scroll'}>
        {cell({ key: 'home', label: '首页', icon: Home, motion: 'sparkles', active: page === 'home', onClick: goHome })}
        <div className={'app-sidebar-divider'} role={'presentation'} />
        {hubs.map(item => cell({ ...item, active: page === item.page, onClick: () => openHub(item.key) }))}
        <div className={'app-sidebar-divider'} role={'presentation'} />
        {workspace.map(item => cell(item))}
      </div>

      {/* ═══ 2026-09-19 批 I-③（用户批注 #1，坐标 2.5% / 95.6%）══════════════════════════
          这里原来有一颗品牌渐变的「开始创作」悬浮按钮。用户原话：
          「这个按钮为什么会在这里，很别扭啊，没有什么意义呀。」
          它的问题是**语义空转**：点下去 = 回首页（goHome），而首页就在它正上方一格，
          同一屏里有两个去同一个地方的东西，其中一个还是整栏唯一的实色主 CTA。
          删掉它之后，这一栏只剩导航本身，"当前在哪"不再跟"要去哪"抢注意力。 */}    </nav>
  );
}
