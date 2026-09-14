import React, { useState, useEffect } from 'react';
import { Image, ShoppingBag, Megaphone } from 'lucide-react';
import { MdAutoAwesome, MdLogin, MdCheck, MdMenu, MdClose } from 'react-icons/md';
import { IMAGES } from '../../constants/images';
import { useApp } from '../../store/AppContext';
import { signOut } from '../../services/auth';

/**
 * 薯包AI 导航 — 灵图风格：72px 浮动玻璃导航
 */
export default function Navbar() {
  const { state, dispatch, fetchCredits } = useApp();
  const { page, logged, credits, unlimited } = state;
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (logged && state.phone) fetchCredits(state.phone);
  }, [logged, state.phone]);

  const nav = (p) => { dispatch({ type: 'NAVIGATE', page: p }); setMobileOpen(false); };

  const isActive = (p) => page === p;

  const navItems = [
    { key: 'home', label: '首页' },
    { key: 'gallery', label: '作品展示' },
    { key: 'works', label: '我的作品' },
  ];

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 'var(--sb-z-sticky)',
      userSelect: 'none',
      paddingTop: 16,
    }}>
      <div style={{
        margin: '0 auto',
        height: 'var(--nav-height)',
        width: 'calc(100% - 32px)',
        maxWidth: 'var(--max-width)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, padding: '0 16px',
        background: 'rgba(255,255,255,0.75)',
        border: '1px solid rgba(255,255,255,0.60)',
        borderRadius: 'var(--radius-full)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 12px 30px rgba(57,45,26,0.10)',
      }}>
        {/* Left: Logo */}
        {/* D11 键盘可达：Logo 是「回首页」导航动作 → button（.a11y-reset 归零 UA 默认外观） */}
        <button type="button" className="a11y-reset" aria-label="回到首页" onClick={() => nav('home')}
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--sb-space-2)', cursor: 'pointer', flexShrink: 0 }}>
          <span style={{
            display: 'flex', width: 42, height: 42, borderRadius: 'var(--sb-radius-lg)', overflow: 'hidden', flexShrink: 0,
            alignItems: 'center', justifyContent: 'center',
            background: 'var(--sb-brand-gradient)',
            boxShadow: '0 14px 28px rgba(124,92,255,0.24)',
          }}>
            <MdAutoAwesome size={22} color="#fff" fill="#fff" />
          </span>
          <span style={{
            fontSize: 'var(--sb-text-2xl)', fontWeight: 900, lineHeight: 1,
            color: 'var(--accent)', letterSpacing: '-0.3px',
          }}>薯包AI</span>
        </button>

        {/* Center: Nav items */}
        <div style={{
          display: 'flex', gap: 'var(--sb-space-1)', alignItems: 'center', margin: '0 auto',
        }}>
          {navItems.map(item => (
            <button key={item.key} onClick={() => nav(item.key)}
              style={{
                padding: '7px 18px', border: 'none',
                background: isActive(item.key) ? 'rgba(255,255,255,0.85)' : 'transparent',
                borderRadius: 'var(--radius-full)',
                fontFamily: 'inherit', fontSize: 'var(--sb-text-md)',
                fontWeight: isActive(item.key) ? 900 : 500,
                color: isActive(item.key) ? 'var(--accent)' : 'var(--text-muted)',
                cursor: 'pointer', transition: 'all 0.15s ease',
                backdropFilter: isActive(item.key) ? 'blur(8px)' : 'none',
                boxShadow: isActive(item.key) ? '0 1px 3px rgba(12,10,9,0.06)' : 'none',
              }}>
              {item.label}
            </button>
          ))}
        </div>

        {/* Right: Credits + Auth + Mobile toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* Credits */}
          {logged && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 14px 5px 12px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(8px)',
              fontSize: 13, fontWeight: 900, color: 'var(--accent)',
              whiteSpace: 'nowrap',
            }}>
              {/* 积分图标走「铁律 4」的积分金（--sb-credit），不用警告橙（那表示"快不够了"）。
                  原 fill/color 是 --amber-400/500 —— 全仓无定义，SVG 属性被忽略后
                  星标退回继承色（近黑），与积分语义不符。 */}
              <MdAutoAwesome size={14} fill="var(--sb-credit)" color="var(--sb-credit-ink)" />
              <span>{credits}</span>
              <span style={{ fontWeight: 500, fontSize: 11, opacity: 0.5 }}>套</span>
            </div>
          )}

          {/* 套餐 button (lingtuai style) */}
          <button onClick={() => { dispatch({ type: 'SHOW_PRICE', show: true }); }}
            style={{
              height: 40, display: 'none', alignItems: 'center', gap: 'var(--sb-space-2)',
              padding: '0 18px', border: 'none', borderRadius: 'var(--radius-full)',
              background: 'var(--accent)',
              color: 'var(--sb-neutral-0)', fontSize: 13, fontWeight: 900,
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 14px 32px rgba(28,25,23,0.18)',
              transition: 'all 0.15s ease',
            }}
            className="show-sm-flex"
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.background = '#2A2521'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.background = 'var(--accent)'; }}>
            <MdAutoAwesome size={15} fill="rgba(252,211,77,0.8)" color="#FCD34D" />
            套餐
          </button>

          {/* Login / Logged */}
          {logged ? (
            <button onClick={async () => { await signOut(); dispatch({ type: 'SET_LOGGED', logged: false, phone: '' }); }}
              style={{
                height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 'var(--sb-space-2)', padding: '0 18px', border: 'none', borderRadius: 'var(--radius-full)',
                background: 'transparent', fontFamily: 'inherit',
                fontSize: 'var(--sb-text-md)', fontWeight: 700, color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}>
              <MdCheck size={14} /> 已登录
            </button>
          ) : (
            <button onClick={() => dispatch({ type: 'SHOW_LOGIN', show: true })}
              style={{
                height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 'var(--sb-space-2)', padding: '0 20px', border: 'none', borderRadius: 'var(--radius-full)',
                background: 'transparent', fontFamily: 'inherit',
                fontSize: 'var(--sb-text-md)', fontWeight: 700, color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}>
              去登录
            </button>
          )}

          {/* Mobile toggle */}
          <button onClick={() => setMobileOpen(!mobileOpen)}
            style={{
              display: 'none', width: 38, height: 38, padding: 0, border: 'none',
              borderRadius: 'var(--radius-full)', background: 'transparent',
              alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-muted)',
            }}
            className="show-mobile-flex">
            {mobileOpen ? <MdClose size={20} /> : <MdMenu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div style={{
          margin: '6px 16px',
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(20px)',
          borderRadius: 'var(--radius-md)',
          padding: '6px',
          boxShadow: '0 18px 46px rgba(57,45,26,0.16)',
          animation: 'fadeIn 0.12s ease',
        }}>
          {[...navItems, { key: 'pricing', label: '套餐' }].map(item => (
            <button key={item.key} onClick={() => nav(item.key)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 18px', width: '100', border: 'none',
                background: isActive(item.key) ? 'rgba(12,10,9,0.06)' : 'transparent',
                borderRadius: 12, fontFamily: 'inherit', fontSize: 15,
                fontWeight: isActive(item.key) ? 700 : 500,
                color: isActive(item.key) ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}>
              <span>{item.label}</span>
              {isActive(item.key) && (
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Display control styles */}
      <style>{`
        @media (min-width: 640px) {
          .show-sm-flex { display: flex !important; }
        }
        @media (max-width: 639px) {
          .show-mobile-flex { display: flex !important; }
        }
      `}</style>
    </nav>
  );
}
