import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  Clapperboard,
  LayoutDashboard,
  Menu,
  NotebookPen,
  Plus,
  ShoppingBag,
  Sparkles,
  WandSparkles,
  X,
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import {
  CREATIVE_NAV_GROUPS,
  getNavigationItem,
  getNavigationTarget,
  isNavigationGroupActive,
} from './creativeDomainNavigation.js';

const ICONS = {
  'shopping-bag': ShoppingBag,
  clapperboard: Clapperboard,
  'notebook-pen': NotebookPen,
  'wand-sparkles': WandSparkles,
  'layout-dashboard': LayoutDashboard,
};

function isProtectedTarget(action) {
  return action?.type === 'OPEN_CANVAS' || (action?.type === 'NAVIGATE' && action.page === 'video-studio');
}

function CreativeDomainNav() {
  const { state, dispatch } = useApp();
  const [openGroupId, setOpenGroupId] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileGroupId, setMobileGroupId] = useState('commerce');
  const [scrolled, setScrolled] = useState(false);
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
      openTimer.current = null;
    }, 80);
  };

  const closeDesktopMenu = () => {
    clearCloseTimer();
    clearOpenTimer();
    setOpenGroupId(null);
  };

  const scheduleDesktopClose = () => {
    clearCloseTimer();
    closeTimer.current = window.setTimeout(closeDesktopMenu, 180);
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
    const Icon = ICONS[group.icon] || Sparkles;
    return (
      <div className="creative-nav-panel" id={`creative-nav-panel-${group.id}`} role="region" aria-label={`${group.label}入口`}>
        <div className="creative-nav-panel-intro">
          <span className="creative-nav-panel-icon"><Icon size={20} strokeWidth={1.8} /></span>
          <small>{group.eyebrow}</small>
          <strong>{group.label}</strong>
          <p>{group.description}</p>
          <button type="button" className="creative-nav-panel-primary" onClick={() => runTarget(group.id, group.items[0].id)}>
            开始创作 <ArrowRight size={15} />
          </button>
        </div>
        <div className="creative-nav-panel-links">
          <span className="creative-nav-section-label">进入工作台</span>
          {group.items.map((item, index) => (
            <button
              type="button"
              id={`creative-nav-item-${group.id}-${index}`}
              className="creative-nav-link"
              key={item.id}
              onClick={() => runTarget(group.id, item.id)}
              onKeyDown={event => handlePanelKeyDown(event, group.id, index)}
            >
              <span><strong>{item.label}</strong><small>{item.description}</small></span>
              <ArrowRight size={15} />
            </button>
          ))}
          <div className="creative-nav-panel-note"><Sparkles size={13} /> 所有结果都可以继续进入画布编辑</div>
        </div>
      </div>
    );
  };

  return (
    <div className={`creative-nav-wrap${scrolled ? ' is-scrolled' : ''}${openGroupId ? ' is-open' : ''}`} onMouseLeave={scheduleDesktopClose}>
      <div className="creative-nav-desktop" onMouseEnter={() => { clearCloseTimer(); clearOpenTimer(); }}>
        <div className="creative-nav-triggers" role="menubar" aria-label="创作入口">
          {CREATIVE_NAV_GROUPS.map(group => {
            const active = isNavigationGroupActive(group.id, state);
            const open = group.id === openGroupId;
            const Icon = ICONS[group.icon] || Sparkles;
            return (
              <div className={`creative-nav-trigger-slot${open ? ' is-open' : ''}`} key={group.id} onMouseEnter={() => openDesktopGroup(group.id)}>
                <button
                  type="button"
                  id={`creative-nav-trigger-${group.id}`}
                  className={`creative-nav-trigger${active ? ' is-active' : ''}`}
                  role="menuitem"
                  aria-haspopup="true"
                  aria-expanded={open}
                  aria-controls={`creative-nav-panel-${group.id}`}
                  onClick={() => runTarget(group.id, group.items[0].id)}
                  onFocus={event => {
                    if (!event.currentTarget.matches(':focus-visible')) return;
                    clearCloseTimer();
                    clearOpenTimer();
                    setOpenGroupId(group.id);
                  }}
                  onKeyDown={event => handleTriggerKeyDown(event, group.id)}
                >
                  <Icon size={15} strokeWidth={2} /> <span>{group.label}</span><ChevronDown size={13} className="creative-nav-chevron" />
                </button>
                {open && renderGroupPanel(group)}
              </div>
            );
          })}
        </div>
      </div>

      <button type="button" className="creative-nav-mobile-trigger" aria-label={mobileOpen ? '关闭创作导航' : '打开创作导航'} aria-expanded={mobileOpen} onClick={() => setMobileOpen(value => !value)}>
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}<span>创作</span>
      </button>

      {mobileOpen && (
        <div className="creative-nav-mobile-backdrop" role="presentation" onClick={() => setMobileOpen(false)}>
          <aside className="creative-nav-mobile-drawer" role="dialog" aria-modal="true" aria-label="创作导航" onClick={event => event.stopPropagation()}>
            <div className="creative-nav-mobile-head"><div><small>薯包 AI</small><strong>选择你的创作方向</strong></div><button type="button" aria-label="关闭创作导航" onClick={() => setMobileOpen(false)}><X size={19} /></button></div>
            <div className="creative-nav-mobile-groups">
              {CREATIVE_NAV_GROUPS.map(group => {
                const Icon = ICONS[group.icon] || Sparkles;
                const expanded = mobileGroupId === group.id;
                return (
                  <section className={`creative-nav-mobile-group${expanded ? ' is-expanded' : ''}`} key={group.id}>
                    <button type="button" className="creative-nav-mobile-group-button" aria-expanded={expanded} onClick={() => setMobileGroupId(expanded ? null : group.id)}><Icon size={17} /><span>{group.label}</span><ChevronDown size={16} /></button>
                    {expanded && <div className="creative-nav-mobile-links">{group.items.map(item => <button type="button" key={item.id} onClick={() => runTarget(group.id, item.id)}><span><strong>{item.label}</strong><small>{item.description}</small></span><ArrowRight size={15} /></button>)}</div>}
                  </section>
                );
              })}
            </div>
            <button type="button" className="creative-nav-mobile-primary" onClick={() => runTarget(mobileGroupId || 'commerce', CREATIVE_NAV_GROUPS.find(group => group.id === (mobileGroupId || 'commerce'))?.items[0]?.id)}><Plus size={16} /> 开始创作</button>
          </aside>
        </div>
      )}
    </div>
  );
}

export default CreativeDomainNav;
