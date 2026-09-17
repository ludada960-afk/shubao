import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown, FolderOpen, Home, Image as ImageIcon, Images, Layers,
  NotebookPen, PanelLeftClose, PanelLeftOpen, ShoppingBag, Sparkles, Video, Wand2,
} from 'lucide-react';
import { useApp } from '../../store/AppContext.jsx';
import { hubPath, skillPath } from '../../skills/skillDirectory.js';
import { skillsOfBoard } from '../../skills/skillDirectory.js';

/* ═══ 左侧常驻导航（2026-09-18 用户批注 #1 / #14）══════════════════════════════════
   用户原话：「我们现在这些 skill 他们的总页面必须是有一个常驻入口的。左边的导航栏其实是
   很适合做的，你就直接把他们给做进左边的导航栏按钮这里面吧。而且我认为也许左边的导航栏
   他们也得是一个张开的形式了……是不是可以有一个把它们作为侧边栏再折叠起来的一个设计呢？
   就是平时可以张开，但是如果用户需要折叠的时候，他们又可以被折叠起来这样。」

   三条设计判断（写下来，免得下次又靠感觉）：
   ① **默认展开**：只有图标时用户不知道每个按钮是什么（用户原话），展开才能建立心智；
      折叠态保留原图标栏的观感（老用户熟悉的那个悬浮胶囊样式），一键切换。
   ② **技能入口分两级**：一级是"图片生成 / 视频生成"两个总页面（常驻、点了进 Hub），
      二级是这两个总页面下的**精品推荐**（照竞品那 6 / 7 条，用户批注 #13 要求对齐），
      最后一行的「查看全部 N 个技能」进总页面。这样"总页面有常驻入口"和
      "首页保持干净"两件事同时成立。
   ③ **技能清单不在这里手抄**：一律从声明源（skillsOfBoard + 精品位）取，
      技能改名/上下线这里自动跟着变（抄一份必然漂移）。 */

const COLLAPSE_KEY = 'sb-sidebar-collapsed';

function readCollapsed() {
  try {
    const raw = window.localStorage.getItem(COLLAPSE_KEY);
    if (raw == null) return false;          /* 默认展开（用户口径：平时张开） */
    return raw === '1';
  } catch { return false; }
}

export default function AppSidebar() {
  const { state, dispatch } = useApp();
  const { page, mode } = state;
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [openGroups, setOpenGroups] = useState({ image: true, video: true });
  /* 地址栏是技能身份的真源（子页面就是 ?id=）——导航要据此点亮 */
  const [activeSkillId, setActiveSkillId] = useState(() => new URLSearchParams(window.location.search).get('id') || '');

  useEffect(() => {
    const sync = () => setActiveSkillId(new URLSearchParams(window.location.search).get('id') || '');
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  useEffect(() => {
    /* 换页时重读一次：pushState 之后 popstate 不会触发 */
    setActiveSkillId(new URLSearchParams(window.location.search).get('id') || '');
  }, [page]);

  useEffect(() => {
    try { window.localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch { /* 隐私模式忽略 */ }
  }, [collapsed]);

  const requestLogin = target => {
    const destination = typeof target === 'string' ? target : target?.type === 'OPEN_CANVAS' ? 'ec-canvas' : target?.page;
    dispatch({
      type: 'SET_LOGIN_INTENT',
      intent: { destination, source: state.page, ...(typeof target === 'object' && target?.tab ? { canvasTab: target.tab } : {}) },
    });
    dispatch({ type: 'SHOW_LOGIN', show: true });
  };

  /* 精品位清单：与首页那一排、总页面顶部同一份数据源（featuredSkills 的排序规则） */
  const boards = useMemo(() => ([
    { id: 'image', label: '图片生成', icon: ImageIcon, skills: skillsOfBoard('image').filter(skill => skill.category === '精品推荐' && skill.tier !== 'assistant').sort((a, b) => (a.featuredRank || 99) - (b.featuredRank || 99)), total: skillsOfBoard('image').filter(skill => skill.tier !== 'assistant').length },
    { id: 'video', label: '视频生成', icon: Video, skills: skillsOfBoard('video').filter(skill => skill.category === '精品推荐' && skill.tier !== 'assistant').sort((a, b) => (a.featuredRank || 99) - (b.featuredRank || 99)), total: skillsOfBoard('video').filter(skill => skill.tier !== 'assistant').length },
  ]), []);

  const openSkill = skill => {
    window.history.pushState({}, '', skillPath(skill));
    dispatch({ type: 'NAVIGATE', page: skill.board === 'video' ? 'video-creation' : 'image-creation' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openHub = board => {
    window.history.pushState({}, '', hubPath(board));
    dispatch({ type: 'NAVIGATE', page: board === 'video' ? 'video-creation' : 'image-creation' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goMode = nextMode => {
    window.history.pushState({}, '', '/');
    dispatch({ type: 'NAVIGATE', page: 'home' });
    dispatch({ type: 'SET_MODE', mode: nextMode });
  };

  const workspace = [
    { key: 'canvas', label: '无限画布', icon: Layers, active: page === 'ec-canvas', onClick: () => (state.logged ? dispatch({ type: 'OPEN_CANVAS' }) : requestLogin('ec-canvas')) },
    { key: 'works', label: '我的作品', icon: FolderOpen, active: false, onClick: () => (state.logged ? dispatch({ type: 'OPEN_CANVAS', tab: 'works' }) : requestLogin({ type: 'OPEN_CANVAS', tab: 'works' })) },
    { key: 'assets', label: '我的资产', icon: Images, active: page === 'ec-canvas' && state.canvasEntryTab === 'assets', onClick: () => (state.logged ? dispatch({ type: 'OPEN_CANVAS', tab: 'assets' }) : requestLogin({ type: 'OPEN_CANVAS', tab: 'assets' })) },
  ];

  const modes = [
    { key: 'ecommerce', label: '电商生图', icon: ShoppingBag },
    { key: 'content', label: '小红书图文', icon: NotebookPen },
    { key: 'visual', label: '自由创作', icon: Wand2 },
  ];

  return (
    <nav className={'app-sidebar' + (collapsed ? ' is-collapsed' : '')} aria-label="主导航">
      <div className="app-sidebar-head">
        <button
          type="button"
          className="app-sidebar-home"
          aria-current={page === 'home' ? 'page' : undefined}
          onClick={() => { window.history.pushState({}, '', '/'); dispatch({ type: 'NAVIGATE', page: 'home' }); }}
        >
          <Sparkles size={18} aria-hidden="true" />
          <span className="app-sidebar-label">首页</span>
        </button>
        <button
          type="button"
          className="app-sidebar-toggle"
          aria-label={collapsed ? '展开侧边栏' : '折叠侧边栏'}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(value => !value)}
        >
          {collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
        </button>
      </div>

      <div className="app-sidebar-scroll">
        {boards.map(board => {
          const Icon = board.icon;
          const open = collapsed ? false : openGroups[board.id] !== false;
          const hubActive = page === (board.id === 'video' ? 'video-creation' : 'image-creation');
          return (
            <section className="app-sidebar-group" key={board.id}>
              <div className="app-sidebar-group-row">
                <button
                  type="button"
                  className={'app-sidebar-item is-group' + (hubActive && !activeSkillId ? ' is-active' : '')}
                  onClick={() => { openHub(board.id); if (!collapsed) setOpenGroups(current => ({ ...current, [board.id]: true })); }}
                  title={board.label}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span className="app-sidebar-label">{board.label}</span>
                </button>
                {!collapsed && (
                  <button
                    type="button"
                    className="app-sidebar-caret"
                    aria-label={(open ? '收起' : '展开') + board.label + '的精品推荐'}
                    aria-expanded={open}
                    onClick={() => setOpenGroups(current => ({ ...current, [board.id]: !open }))}
                  >
                    <ChevronDown size={15} className={open ? 'is-open' : ''} aria-hidden="true" />
                  </button>
                )}
              </div>
              {open && (
                <ul className="app-sidebar-sublist">
                  {board.skills.map(skill => (
                    <li key={skill.id}>
                      <button
                        type="button"
                        className={'app-sidebar-subitem' + (activeSkillId === skill.id ? ' is-active' : '')}
                        onClick={() => openSkill(skill)}
                      >
                        {skill.name}
                      </button>
                    </li>
                  ))}
                  <li>
                    <button type="button" className="app-sidebar-subitem is-more" onClick={() => openHub(board.id)}>
                      查看全部 {board.total} 个技能
                    </button>
                  </li>
                </ul>
              )}
            </section>
          );
        })}

        <div className="app-sidebar-divider" role="presentation" />

        {modes.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              className={'app-sidebar-item' + (page === 'home' && mode === item.key ? ' is-active' : '')}
              onClick={() => goMode(item.key)}
              title={item.label}
            >
              <Icon size={18} aria-hidden="true" />
              <span className="app-sidebar-label">{item.label}</span>
            </button>
          );
        })}

        <div className="app-sidebar-divider" role="presentation" />

        {workspace.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              className={'app-sidebar-item' + (item.active ? ' is-active' : '')}
              onClick={item.onClick}
              title={item.label}
            >
              <Icon size={18} aria-hidden="true" />
              <span className="app-sidebar-label">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
