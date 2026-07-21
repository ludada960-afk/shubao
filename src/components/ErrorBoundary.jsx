import React from 'react';
import { MdRefresh } from 'react-icons/md';

/**
 * B6/B8: 增强版 ErrorBoundary
 * - 自动恢复（非致命错误）
 * - 错误计数 + 防抖（连续 3 次错误才显示崩溃页）
 * - 保留错误堆栈供调试
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorCount: 0, lastErrorTime: 0 };
  }

  static getDerivedStateFromError(error) {
    const now = Date.now();
    return (prevState) => {
      // 10 秒内的连续错误计数
      const withinWindow = now - prevState.lastErrorTime < 10000;
      const count = withinWindow ? prevState.errorCount + 1 : 1;
      // 连续 3 次才显示崩溃页
      if (count >= 3) {
        return { hasError: true, error, errorCount: count, lastErrorTime: now };
      }
      // 否则静默恢复
      return { hasError: false, error: null, errorCount: count, lastErrorTime: now };
    };
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
          minHeight: '100vh', padding: 40, background: '#F5F3EF', color: '#1a1a1a',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>页面出了点问题</h1>
          <p style={{ fontSize: 14, color: '#888', marginBottom: 24, textAlign: 'center', maxWidth: 400, lineHeight: 1.6 }}>
            发生了一个意外错误。这不影响您的数据，请尝试刷新页面。
          </p>
          <div style={{
            fontSize: 12, color: '#bbb', marginBottom: 20, fontFamily: 'monospace',
            padding: '10px 16px', background: '#eee', borderRadius: 8,
            maxWidth: '100%', overflowX: 'auto',
          }}>
            {this.state.error?.message || '未知错误'}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={this.handleDismiss}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 12,
                background: 'rgba(0,0,0,0.06)', color: '#666', border: 'none', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
              尝试继续
            </button>
            <button onClick={this.handleRefresh}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 12,
                background: '#1a1a1a', color: '#fff', border: 'none', fontSize: 15, fontWeight: 700,
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
