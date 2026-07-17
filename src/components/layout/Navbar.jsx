import React, { useState, useEffect } from 'react';
import { Sparkles, LogIn, Check, Menu, X, Image, ShoppingBag } from 'lucide-react';
import { IMAGES } from '../../constants/images';
import { useApp } from '../../store/AppContext';

export default function Navbar() {
  const { state, dispatch, fetchCredits } = useApp();
  const { page, logged, credits, mode } = state;
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (logged && state.phone) fetchCredits(state.phone);
  }, [logged, state.phone]);

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'transparent',
      userSelect: 'none',
    }}>
      <div style={{
        maxWidth: 'var(--max-width)', margin: '0 auto', height: 'var(--nav-height)',
        display: 'flex', alignItems: 'center', padding: '0 32px',
      }}>
        {/* Logo */}
        <div onClick={() => { dispatch({ type: 'NAVIGATE', page: 'home' }); setMobileOpen(false); }}
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flexShrink: 0 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, overflow: 'hidden', flexShrink: 0,
            transition: 'transform 0.2s ease',
          }}>
            <img src={IMAGES.appicon} alt="薯包AI" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <span style={{
            fontSize: 18, fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.3px',
            fontFamily: '-apple-system, PingFang SC, Noto Sans SC, sans-serif'
          }}>薯包AI</span>
        </div>

        {/* Desktop nav links */}
        <div style={{
          display: 'flex', gap: 4, alignItems: 'center', margin: '0 auto', padding: '0 20px'
        }}>
          {[
            { key: 'home', label: '首页' },
            { key: 'gallery', label: '作品展示' },
            { key: 'pricing', label: '套餐' },
            { key: 'works', label: '我的作品' },
          ].map(item => {
            const active = page === item.key;
            return (
              <button key={item.key} onClick={() => { dispatch({ type: 'NAVIGATE', page: item.key }); }}
                style={{
                  position: 'relative',
                  padding: '8px 18px',
                  border: 'none',
                  background: active ? 'rgba(255,255,255,0.7)' : 'transparent',
                  borderRadius: 'var(--radius-full)',
                  fontFamily: 'inherit',
                  fontSize: 14,
                  fontWeight: active ? 600 : 450,
                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  backdropFilter: active ? 'blur(8px)' : 'none',
                }}>
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {logged && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 14px 5px 12px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(8px)',
              fontSize: 13, fontWeight: 700, color: 'var(--accent)',
              whiteSpace: 'nowrap',
            }}>
              <Sparkles size={13} />
              <span>{credits}</span>
              <span style={{ fontWeight: 400, fontSize: 11, opacity: 0.6 }}>套</span>
            </div>
          )}

          {logged ? (
            <button onClick={() => dispatch({ type: 'SET_LOGGED', logged: false, phone: '' })}
              className="btn-pill btn-ghost" style={{ fontSize: 13, height: 36 }}>
              <Check size={13} /> 已登录
            </button>
          ) : (
            <button onClick={() => dispatch({ type: 'SHOW_LOGIN', show: true })}
              className="btn-pill btn-ghost" style={{ fontSize: 13, height: 36 }}>
              <LogIn size={13} /> 登录
            </button>
          )}

          {/* Mobile toggle */}
          <button onClick={() => setMobileOpen(!mobileOpen)}
            className="btn-pill btn-ghost"
            style={{ display: 'none', width: 36, height: 36, padding: 0, '@media(max-width:768px)': { display: 'flex' } }}>
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div style={{
          position: 'absolute', top: 'var(--nav-height)', left: 0, right: 0,
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(20px)',
          padding: '8px 16px 16px',
          display: 'flex', flexDirection: 'column', gap: 2,
          zIndex: 99,
          boxShadow: 'var(--shadow-lg)',
          animation: 'fadeIn 0.15s ease',
        }}>
          {[
            { key: 'home', label: '首页' },
            { key: 'gallery', label: '作品展示' },
            { key: 'pricing', label: '套餐' },
            { key: 'works', label: '我的作品' },
          ].map(item => {
            const active = page === item.key;
            return (
              <button key={item.key} onClick={() => { dispatch({ type: 'NAVIGATE', page: item.key }); setMobileOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', border: 'none',
                  background: active ? 'var(--accent-bg)' : 'transparent',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'inherit', fontSize: 15,
                  fontWeight: active ? 600 : 450,
                  color: active ? 'var(--accent)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}>
                <span>{item.label}</span>
                {active && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />}
              </button>
            );
          })}
        </div>
      )}
    </nav>
  );
}
