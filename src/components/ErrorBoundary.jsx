import React from 'react';
import { MdRefresh } from 'react-icons/md';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error.message, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh', padding: 40, background: '#F5F3EF', color: '#1a1a1a',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>页面出了点问题</h1>
          <p style={{ fontSize: 14, color: '#888', marginBottom: 24, textAlign: 'center', maxWidth: 400, lineHeight: 1.6 }}>
            发生了一个意外错误。这不影响您的数据，请尝试刷新页面。
          </p>
          <div style={{ fontSize: 12, color: '#bbb', marginBottom: 20, fontFamily: 'monospace', padding: '10px 16px', background: '#eee', borderRadius: 8, maxWidth: '100%', overflowX: 'auto' }}>
            {this.state.error?.message || '未知错误'}
          </div>
          <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 12,
              background: '#1a1a1a', color: '#fff', border: 'none', fontSize: 15, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
            <MdRefresh size={18} /> 刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
