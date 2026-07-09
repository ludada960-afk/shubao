import React from 'react';
import { Sparkles, LogIn, Check } from 'lucide-react';
import { IMAGES } from '../../constants/images';
import { useApp } from '../../store/AppContext';
import Button from '../ui/Button';

const NAV_ITEMS = [
  { key: 'home', label: '首页' },
  { key: 'gallery', label: '作品展示' },
  { key: 'pricing', label: '定价' },
  { key: 'works', label: '我的作品' },
];

export default function Navbar() {
  const { state, dispatch } = useApp();
  const { page, logged, credits } = state;

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      height: 'var(--nav-height)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px',
      background: 'rgba(255,250,249,0.85)',
      backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
      borderBottom: '1px solid rgba(240,240,240,0.8)',
    }}>
      {/* Logo */}
      <div
        onClick={() => dispatch({ type: 'NAVIGATE', page: 'home' })}
        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}
      >
        <img src={IMAGES.appicon} alt="薯包AI" style={{ width: 28, height: 28, borderRadius: 7 }} />
        <span style={{
          fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)',
          color: 'var(--red)', fontFamily: 'var(--font-display)', letterSpacing: '0.5px',
        }}>薯包AI</span>
      </div>

      {/* Nav Links */}
      <div style={{ display: 'flex', gap: 4 }}>
        {NAV_ITEMS.map(item => {
          const active = page === item.key;
          return (
            <button key={item.key}
              onClick={() => {
                dispatch({ type: 'NAVIGATE', page: item.key });
                if (item.key === 'home') dispatch({ type: 'SET_MODE', mode: 'content' });
              }}
              style={{
                padding: '6px 16px', borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)',
                fontWeight: active ? 'var(--weight-semibold)' : 'var(--weight-normal)',
                color: active ? 'var(--red)' : 'var(--text-muted)',
                background: active ? 'var(--red-bg)' : 'transparent',
                border: 'none', fontFamily: 'inherit', transition: 'all var(--duration-fast)',
              }}
            >{item.label}</button>
          );
        })}
      </div>

      {/* Right: Dual Credits + Login */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {logged && (
          <>
            <span style={{
              fontSize: 'var(--text-xs)', color: 'var(--red)',
              background: 'var(--red-bg)', padding: '3px 10px',
              borderRadius: 'var(--radius-full)', fontWeight: 'var(--weight-semibold)',
            }}>{credits}套</span>
          </>
        )}
        {logged ? (
          <Button small onClick={() => dispatch({ type: 'SET_LOGGED', logged: false })}
            style={{ background: 'var(--green-bg)', color: 'var(--green)', border: 'none' }}>
            <Check size={12} /> 已登录
          </Button>
        ) : (
          <Button small onClick={() => dispatch({ type: 'SHOW_LOGIN', show: true })}
            style={{ background: 'var(--border-light)', color: 'var(--text-muted)', border: 'none' }}>
            <LogIn size={12} /> 登录
          </Button>
        )}
      </div>
    </nav>
  );
}
