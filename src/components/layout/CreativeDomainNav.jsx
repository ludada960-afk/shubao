import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  ChevronDown,
  Menu,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import {
  Camera,
  CardsThree,
  FilmStrip,
  FolderOpen,
  FrameCorners,
  ImageSquare,
  MagicWand,
  Notebook,
  Package,
  Presentation,
  Shapes,
  SquaresFour,
  StackSimple,
  TShirt,
} from '@phosphor-icons/react';
import { useApp } from '../../store/AppContext';
import {
  CREATIVE_NAV_GROUPS,
  getNavigationItem,
  getNavigationTarget,
  isNavigationGroupActive,
} from './creativeDomainNavigation.js';

const ICONS = {
  'shopping-bag': Package,
  clapperboard: FilmStrip,
  'notebook-pen': Notebook,
  'wand-sparkles': MagicWand,
  'layout-dashboard': SquaresFour,
};

const ITEM_ICONS = {
  'cards-three': CardsThree,
  't-shirt': TShirt,
  'frame-corners': FrameCorners,
  'film-strip': FilmStrip,
  notebook: Notebook,
  camera: Camera,
  'magic-wand': MagicWand,
  shapes: Shapes,
  'image-square': ImageSquare,
  presentation: Presentation,
  'stack-simple': StackSimple,
  'folder-open': FolderOpen,
};

const DOMAIN_THEMES = Object.freeze({
  commerce: 'commerce',
  video: 'video',
  content: 'content',
  visual: 'visual',
  workspace: 'workspace',
});

function CreativeNavGlyph({ Icon, motion, size = 25 }) {
  return (
    <span className={`creative-nav-glyph creative-nav-glyph--${motion}`} aria-hidden="true">
      <span className="creative-nav-glyph-glow" />
      <span className="creative-nav-glyph-orbit" />
      <span className="creative-nav-glyph-stack creative-nav-glyph-stack--back" />
      <span className="creative-nav-glyph-stack creative-nav-glyph-stack--front" />
      <Icon className="creative-nav-glyph-core" size={size} weight="duotone" />
    </span>
  );
}

const DESKTOP_PANEL_WIDTHS = Object.freeze({
  commerce: 430,
  video: 430,
  content: 460,
  visual: 520,
});

function getDesktopPanelWidth(group) {
  return DESKTOP_PANEL_WIDTHS[group.id] || 520;
}

function isProtectedTarget(action) {
  return action?.type === 'OPEN_CANVAS' || (action?.type === 'NAVIGATE' && action.page === 'video-studio');
}

function CreativeDomainNav() {
  const { state, dispatch } = useApp();
  const [openGroupId, setOpenGroupId] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileGroupId, setMobileGroupId] = useState('commerce');
  const [scrolled, setScrolled] = useState(false);
  const [panelPosition, setPanelPosition] = useState(null);
  const [pinnedGroupId, setPinnedGroupId] = useState(null);
  const navRootRef = useRef(null);
  const viewportRef = useRef(null);
  const triggerRefs = useRef({});
  const closeTimer = useRef(null);
  const openTimer = useRef(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 32);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [mobileOpen]);

  useEffect(() => {
    const handleDocumentPointerDown = event => {
      if (!openGroupId) return;
      if (navRootRef.current?.contains(event.target) || viewportRef.current?.contains(event.target)) return;
      closeDesktopMenu();
    };
    const handleDocumentFocusIn = event => {
      if (!openGroupId) return;
      if (navRootRef.current?.contains(event.target) || viewportRef.current?.contains(event.target)) return;
      closeDesktopMenu();
    };
    const handleDocumentKeyDown = event => {
      if (event.key !== 'Escape' || !openGroupId) return;
      event.preventDefault();
      const groupId = openGroupId;
      closeDesktopMenu();
      triggerRefs.current[groupId]?.focus();
    };
    document.addEventListener('pointerdown', handleDocumentPointerDown);
    document.addEventListener('focusin', handleDocumentFocusIn);
    document.addEventListener('keydown', handleDocumentKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown);
      document.removeEventListener('focusin', handleDocumentFocusIn);
      document.removeEventListener('keydown', handleDocumentKeyDown);
    };
  }, [openGroupId]);

  useEffect(() => {
    if (!openGroupId) return undefined;
    const updatePanelPosition = () => {
      const trigger = triggerRefs.current[openGroupId];
      if (!trigger) return;
      const group = CREATIVE_NAV_GROUPS.find(entry => entry.id === openGroupId);
      if (!group) return;
      const rect = trigger.getBoundingClientRect();
      const width = Math.min(getDesktopPanelWidth(group), window.innerWidth - 32);
      const triggerCenter = rect.left + rect.width / 2;
      const left = Math.max(16, Math.min(window.innerWidth - width - 16, triggerCenter - width / 2));
      const arrowLeft = Math.max(30, Math.min(width - 30, rect.left + rect.width / 2 - left));
      setPanelPosition({ left, top: rect.bottom, width, arrowLeft });
    };
    updatePanelPosition();
    window.addEventListener('resize', updatePanelPosition, { passive: true });
    window.addEventListener('scroll', updatePanelPosition, { passive: true });
    return () => {
      window.removeEventListener('resize', updatePanelPosition);
      window.removeEventListener('scroll', updatePanelPosition);
    };
  }, [openGroupId]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const handleKeyDown = event => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen]);

  useEffect(() => () => {
    window.clearTimeout(closeTimer.current);
    window.clearTimeout(openTimer.current);
  }, []);

  const clearCloseTimer = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };

  const clearOpenTimer = () => {
    if (openTimer.current) window.clearTimeout(openTimer.current);
    openTimer.current = null;
  };

  const openDesktopGroup = groupId => {
    clearCloseTimer();
    clearOpenTimer();
    openTimer.current = window.setTimeout(() => {
      setOpenGroupId(groupId);
      if (pinnedGroupId) setPinnedGroupId(groupId);
      setPanelPosition(null);
      openTimer.current = null;
    }, 80);
  };

  const toggleDesktopGroup = groupId => {
    clearCloseTimer();
    clearOpenTimer();
    if (openGroupId === groupId && pinnedGroupId === groupId) {
      closeDesktopMenu();
      return;
    }
    setPinnedGroupId(groupId);
    setOpenGroupId(groupId);
    setPanelPosition(null);
  };

  const closeDesktopMenu = () => {
    clearCloseTimer();
    clearOpenTimer();
    setOpenGroupId(null);
    setPinnedGroupId(null);
    setPanelPosition(null);
  };

  const scheduleDesktopClose = () => {
    if (pinnedGroupId) return;
    clearCloseTimer();
    closeTimer.current = window.setTimeout(closeDesktopMenu, 260);
  };

  const requestLogin = action => {
    dispatch({ type: 'SET_LOGIN_INTENT', intent: { destination: action.type === 'OPEN_CANVAS' ? 'ec-canvas' : action.page, source: state.page } });
    dispatch({ type: 'SHOW_LOGIN', show: true });
  };

  const runTarget = (groupId, itemId) => {
    const item = getNavigationItem(groupId, itemId);
    const action = item?.action || getNavigationTarget(groupId, itemId);
    if (!action) return;
    if (isProtectedTarget(action) && !state.logged) {
      requestLogin(action);
      closeDesktopMenu();
      setMobileOpen(false);
      return;
    }
    if (action.type === 'SET_MODE') {
      if (state.page !== 'home') dispatch({ type: 'NAVIGATE', page: 'home' });
      dispatch(action);
      if (item?.launch) {
        dispatch({ type: 'SET_CREATION_LAUNCH', launch: { ...item.launch, nonce: `${Date.now()}-${item.id}` } });
      }
    } else if (action.type === 'OPEN_CANVAS') {
      dispatch(action);
    } else {
      dispatch(action);
    }
    closeDesktopMenu();
    setMobileOpen(false);
  };

  const handleTriggerKeyDown = (event, groupId) => {
    const groupIndex = CREATIVE_NAV_GROUPS.findIndex(group => group.id === groupId);
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const next = CREATIVE_NAV_GROUPS[(groupIndex + direction + CREATIVE_NAV_GROUPS.length) % CREATIVE_NAV_GROUPS.length];
      document.getElementById(`creative-nav-trigger-${next.id}`)?.focus();
      setOpenGroupId(next.id);
    } else if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setOpenGroupId(groupId);
      requestAnimationFrame(() => document.getElementById(`creative-nav-item-${groupId}-0`)?.focus());
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeDesktopMenu();
      event.currentTarget.focus();
    }
  };

  const handlePanelKeyDown = (event, groupId, itemIndex) => {
    const group = CREATIVE_NAV_GROUPS.find(entry => entry.id === groupId);
    if (!group) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDesktopMenu();
      document.getElementById(`creative-nav-trigger-${groupId}`)?.focus();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const last = group.items.length - 1;
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? last : (itemIndex + (event.key === 'ArrowDown' ? 1 : -1) + group.items.length) % group.items.length;
    document.getElementById(`creative-nav-item-${groupId}-${nextIndex}`)?.focus();
  };

  const renderGroupPanel = group => {
    const theme = DOMAIN_THEMES[group.id] || 'commerce';
    return (
      <div className={`creative-nav-panel creative-nav-panel--${theme} creative-nav-panel--items-${group.items.length}`} id={`creative-nav-panel-${group.id}`} role="region" aria-label={`${group.label}入口`}>
        <div className="creative-nav-panel-links">
          {group.items.map((item, index) => {
            const ItemIcon = ITEM_ICONS[item.icon] || Sparkles;
            return (
              <button
                type="button"
                id={`creative-nav-item-${group.id}-${index}`}
                className={`creative-nav-link creative-nav-link--${item.motion}`}
                key={item.id}
                onClick={() => runTarget(group.id, item.id)}
                onKeyDown={event => handlePanelKeyDown(event, group.id, index)}
              >
                <span className="creative-nav-item-icon"><CreativeNavGlyph Icon={ItemIcon} motion={item.motion} /></span>
                <span className="creative-nav-link-copy"><strong>{item.label}</strong><small>{item.description}</small></span>
                <span className="creative-nav-link-action"><small>{item.hint}</small><ArrowRight size={18} /></span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDesktopViewport = () => {
    if (!openGroupId || !panelPosition || typeof document === 'undefined') return null;
    const group = CREATIVE_NAV_GROUPS.find(entry => entry.id === openGroupId);
    if (!group) return null;
    return createPortal(
      <div
        ref={viewportRef}
        className="creative-nav-viewport"
        style={{
          left: panelPosition.left,
          top: panelPosition.top,
          width: panelPosition.width,
          '--creative-nav-arrow-left': `${panelPosition.arrowLeft}px`,
        }}
        onPointerEnter={clearCloseTimer}
        onPointerLeave={scheduleDesktopClose}
      >
        <div className="creative-nav-viewport-bridge" aria-hidden="true" />
        {renderGroupPanel(group)}
      </div>,
      document.body,
    );
  };

  return (
    <div ref={navRootRef} className={`creative-nav-wrap${scrolled ? ' is-scrolled' : ''}${openGroupId ? ' is-open' : ''}`}>
      <div className="creative-nav-desktop" onPointerEnter={() => { clearCloseTimer(); clearOpenTimer(); }} onPointerLeave={scheduleDesktopClose}>
        <div className="creative-nav-triggers" role="menubar" aria-label="创作入口">
          {CREATIVE_NAV_GROUPS.map(group => {
            const active = isNavigationGroupActive(group.id, state);
            const open = group.id === openGroupId;
            const Icon = ICONS[group.icon] || Sparkles;
            return (
              <div className={`creative-nav-trigger-slot${open ? ' is-open' : ''}`} key={group.id} onPointerEnter={() => openDesktopGroup(group.id)}>
                <button
                  type="button"
                  id={`creative-nav-trigger-${group.id}`}
                  className={`creative-nav-trigger${active ? ' is-active' : ''}`}
                  role="menuitem"
                  aria-haspopup="true"
                  aria-expanded={open}
                  aria-controls={`creative-nav-panel-${group.id}`}
                  ref={node => { triggerRefs.current[group.id] = node; }}
                  onClick={() => toggleDesktopGroup(group.id)}
                  onFocus={event => {
                    if (!event.currentTarget.matches(':focus-visible')) return;
                    clearCloseTimer();
                    clearOpenTimer();
                    setOpenGroupId(group.id);
                  }}
                  onKeyDown={event => handleTriggerKeyDown(event, group.id)}
                >
                  <span className="creative-nav-trigger-glyph"><Icon size={18} weight="duotone" /></span><span className="creative-nav-trigger-label">{group.label}</span><ChevronDown size={13} className="creative-nav-chevron" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {renderDesktopViewport()}

      <button type="button" className="creative-nav-mobile-trigger" aria-label={mobileOpen ? '关闭创作导航' : '打开创作导航'} aria-expanded={mobileOpen} onClick={() => setMobileOpen(value => !value)}>
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}<span>创作</span>
      </button>

      {mobileOpen && typeof document !== 'undefined' && createPortal(
        <div className="creative-nav-mobile-backdrop" role="presentation" onClick={() => setMobileOpen(false)}>
          <aside className="creative-nav-mobile-drawer" role="dialog" aria-modal="true" aria-label="创作导航" onClick={event => event.stopPropagation()}>
            <div className="creative-nav-mobile-head"><div><small>薯包 AI</small><strong>选择你的创作方向</strong></div><button type="button" aria-label="关闭创作导航" onClick={() => setMobileOpen(false)}><X size={19} /></button></div>
            <div className="creative-nav-mobile-groups">
              {CREATIVE_NAV_GROUPS.map(group => {
                const Icon = ICONS[group.icon] || Sparkles;
                const expanded = mobileGroupId === group.id;
                return (
                  <section className={`creative-nav-mobile-group${expanded ? ' is-expanded' : ''}`} key={group.id}>
                    <button type="button" className="creative-nav-mobile-group-button" aria-expanded={expanded} onClick={() => setMobileGroupId(expanded ? null : group.id)}><Icon size={19} weight="duotone" /><span>{group.label}</span><ChevronDown size={16} /></button>
                    {expanded && <div className="creative-nav-mobile-links">{group.items.map(item => { const ItemIcon = ITEM_ICONS[item.icon] || Sparkles; return <button type="button" className={`creative-nav-mobile-link creative-nav-link--${item.motion}`} key={item.id} onClick={() => runTarget(group.id, item.id)}><span className="creative-nav-item-icon"><CreativeNavGlyph Icon={ItemIcon} motion={item.motion} size={21} /></span><span><strong>{item.label}</strong><small>{item.description}</small></span><ArrowRight size={15} /></button>; })}</div>}
                  </section>
                );
              })}
            </div>
            <button type="button" className="creative-nav-mobile-primary" onClick={() => runTarget(mobileGroupId || 'commerce', CREATIVE_NAV_GROUPS.find(group => group.id === (mobileGroupId || 'commerce'))?.items[0]?.id)}><Plus size={16} /> 开始创作</button>
          </aside>
        </div>,
        document.body,
      )}
    </div>
  );
}

export default CreativeDomainNav;
