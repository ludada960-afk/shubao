import React from 'react';
import { IMAGES } from '../../constants/images';
import { useApp } from '../../store/AppContext';

export default function Footer() {
  const { dispatch } = useApp();
  const go = (page, mode) => {
    dispatch({ type: 'NAVIGATE', page });
    if (mode) dispatch({ type: 'SET_MODE', mode });
  };

  return (
    <footer style={{
      padding: '28px 20px', background: 'var(--surface-raised)',
      borderTop: '1px solid var(--border)',
    }}>
      <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
          <img src={IMAGES.appicon} style={{ width: 18, height: 18, borderRadius: 4 }} alt="" />
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)' }}>薯包AI</span>
        </div>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-hint)', margin: '0 0 8px' }}>
          AI 小红书爆款图文 + 电商商品图生成
        </p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', fontSize: 'var(--text-xs)', color: 'var(--text-invisible)' }}>
          <span style={{ cursor: 'pointer' }} onClick={() => go('home', 'content')}>小红书图文</span>
          <span style={{ cursor: 'pointer' }} onClick={() => go('home', 'ecommerce')}>电商图生成</span>
          <span style={{ cursor: 'pointer' }} onClick={() => go('pricing')}>定价</span>
          <span style={{ cursor: 'pointer' }} onClick={() => go('works')}>我的作品</span>
        </div>
        <div style={{ fontSize: 8, color: '#e8e8e8', marginTop: 12 }}>© 2026 薯包AI</div>
      </div>
    </footer>
  );
}
