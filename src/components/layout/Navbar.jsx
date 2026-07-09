import React, { useState } from 'react';
import { Sparkles, LogIn, Check, Menu, X } from 'lucide-react';
import { IMAGES } from '../../constants/images';
import { useApp } from '../../store/AppContext';

const NAV_ITEMS = [
  { key: 'home', label: '首页' },
  { key: 'gallery', label: '作品展示' },
  { key: 'pricing', label: '定价' },
  { key: 'works', label: '我的作品' },
];

export default function Navbar() {
  const { state, dispatch } = useApp();
  const { page, logged, credits } = state;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState(null);

  return (
    <nav className="sb-navbar">
      <div className="sb-navbar-inner">
        {/* Logo */}
        <div className="sb-nav-logo" onClick={() => { dispatch({ type: 'NAVIGATE', page: 'home' }); setMobileOpen(false); }}>
          <div className="sb-nav-logo-icon">
            <img src={IMAGES.appicon} alt="薯包AI" />
          </div>
          <span className="sb-nav-logo-text">薯包AI</span>
        </div>

        {/* Desktop nav links */}
        <div className="sb-nav-links">
          {NAV_ITEMS.map(item => {
            const active = page === item.key;
            return (
              <button key={item.key} className={`sb-nav-link ${active ? 'active' : ''} ${hoveredItem === item.key ? 'hovered' : ''}`}
                onClick={() => {
                  dispatch({ type: 'NAVIGATE', page: item.key });
                  if (item.key === 'home') dispatch({ type: 'SET_MODE', mode: 'content' });
                }}
                onMouseEnter={() => setHoveredItem(item.key)}
                onMouseLeave={() => setHoveredItem(null)}
              >
                <span className="sb-nav-link-text">{item.label}</span>
                {active && <span className="sb-nav-link-indicator" />}
              </button>
            );
          })}
        </div>

        {/* Right side */}
        <div className="sb-nav-right">
          {logged && (
            <div className="sb-nav-credits">
              <Sparkles size={13} />
              <span>{credits}</span>
              <span className="sb-nav-credits-unit">套</span>
            </div>
          )}
          {logged ? (
            <button className="sb-nav-login-btn logged" onClick={() => dispatch({ type: 'SET_LOGGED', logged: false })}>
              <Check size={14} />
              <span>已登录</span>
            </button>
          ) : (
            <button className="sb-nav-login-btn" onClick={() => dispatch({ type: 'SHOW_LOGIN', show: true })}>
              <LogIn size={14} />
              <span>登录</span>
            </button>
          )}

          {/* Mobile toggle */}
          <button className="sb-nav-mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="sb-nav-mobile-menu">
            {NAV_ITEMS.map(item => {
              const active = page === item.key;
              return (
                <button key={item.key} className={`sb-nav-mobile-item ${active ? 'active' : ''}`}
                  onClick={() => {
                    dispatch({ type: 'NAVIGATE', page: item.key });
                    if (item.key === 'home') dispatch({ type: 'SET_MODE', mode: 'content' });
                    setMobileOpen(false);
                  }}
                >
                  <span>{item.label}</span>
                  {active && <div className="sb-nav-mobile-active-dot" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}
