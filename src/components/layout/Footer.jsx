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
      /* 2026-09-20 幽灵变量：var(--surface-raised) 全仓无定义 → 背景静默透明。
         改 V3 表面阶梯 L3（轻着色面），与页脚"比页面略高一层"的意图一致。 */
      padding: '28px 20px', background: 'var(--sb-surface-tint)',
      borderTop: '1px solid var(--sb-border-default)',
    }}>
      <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--sb-space-1-5)', marginBottom: 8 }}>
          <img src={IMAGES.appicon} style={{ width: 18, height: 18, borderRadius: 4 }} alt="" />
          <span style={{ fontSize: 'var(--sb-text-md)', fontWeight: 'var(--sb-weight-bold)' }}>薯包AI</span>
        </div>
        <p style={{ fontSize: 'var(--sb-text-xs)', color: 'var(--sb-ink-4)', margin: '0 0 8px' }}>
          一站式 AI 视觉内容策划、生成与编辑
        </p>
        {/* 原则 4.1：页脚导航原为 <span onClick>，键盘不可达 → button + .a11y-reset。
            fontSize/color 继承自父容器（.a11y-reset 已 font:inherit/color:inherit）→ 视觉零变化。 */}
        {/* 批 BQ（hallmark gate 49）：窄屏下这四个文字按钮会折成两行 ⇒ nowrap + 允许换行排布 */}
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', fontSize: 'var(--sb-text-xs)', color: 'var(--sb-ink-3)', whiteSpace: 'nowrap' }}>
          <button type="button" className="a11y-reset" style={{ cursor: 'pointer' }} onClick={() => go('home', 'content')}>小红书图文</button>
          <button type="button" className="a11y-reset" style={{ cursor: 'pointer' }} onClick={() => go('home', 'ecommerce')}>电商图生成</button>
          <button type="button" className="a11y-reset" style={{ cursor: 'pointer' }} onClick={() => go('pricing')}>定价</button>
          <button type="button" className="a11y-reset" style={{ cursor: 'pointer' }} onClick={() => go('works')}>我的作品</button>
        </div>
        <div style={{ fontSize: 10, color: 'var(--sb-neutral-200)', marginTop: 12 }}>© 2026 薯包AI</div>
      </div>
    </footer>
  );
}
