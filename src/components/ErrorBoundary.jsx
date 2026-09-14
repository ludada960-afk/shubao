import React from 'react';
import { MdRefresh } from 'react-icons/md';

/**
 * B6/B8: 页面级错误兜底。
 * React 的错误边界必须同步返回状态对象；错误发生时直接展示可操作的恢复页，避免整页只剩背景色。
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorCount: 0, lastErrorTime: 0 };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error, errorCount: 1, lastErrorTime: Date.now() };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error.message, errorInfo?.componentStack);
  }

  handleRefresh = () => {
    this.setState({ hasError: false, error: null, errorCount: 0 });
    window.location.reload();
  };

  handleDismiss = () => {
    this.setState({ hasError: false, error: null, errorCount: 0 });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh', padding: 40, background: '#F5F3EF', color: 'var(--sb-ink-1)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>页面出了点问题</h1>
          <p style={{ fontSize: 14, color: 'var(--sb-ink-3)', marginBottom: 24, textAlign: 'center', maxWidth: 400, lineHeight: 1.6 }}>
            发生了一个意外错误。这不影响您的数据，请尝试刷新页面。
          </p>
          <div style={{
            fontSize: 12, color: 'var(--sb-ink-5)', marginBottom: 20, fontFamily: 'monospace',
            padding: '10px 16px', background: 'var(--sb-neutral-150)', borderRadius: 8,
            maxWidth: '100%', overflowX: 'auto',
          }}>
            {this.state.error?.message || '未知错误'}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={this.handleDismiss}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 12,
                background: 'rgba(12,10,9,0.06)', color: 'var(--sb-ink-3)', border: 'none', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
              尝试继续
            </button>
            <button onClick={this.handleRefresh}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 12,
                background: 'var(--sb-ink-1)', color: 'var(--sb-neutral-0)', border: 'none', fontSize: 15, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
              <MdRefresh size={18} /> 刷新页面
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
