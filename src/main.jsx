import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/design-tokens.css';
import './styles/design-tokens-v3.css'; // V3 视觉体系 token（--sb-* 纯新增，见 docs/design/00-principles.md）
import './styles/theme.css';
// 本轮：删除 './styles/semanticTokens.css' —— 仓库里的「第三套 token 语言」。
// 该文件 12 行 / 10 个 token，其中 7 个全仓零引用（--success / --warning / --danger /
// --neutral-surface / --image-loading / --image-error / --image-selected），
// 剩下 3 个（--command / --command-hover / --focus-ring）只被 theme.css 与 EcCanvas.css 各引用一次。
// 它在本文件里排在 theme.css **之后** import，于是它的 :root 值会静默压过其它文件的回退值。
// 处置与证据见 docs/design/40-decisions.md D35。
import './styles/generate-cta.css';
import { initThemeMode } from './utils/themeMode.js';
/* 批 BT：滚动期间的"假悬停"防护（滚轮滚动不触发鼠标事件，浏览器会把 hover 留在旧元素上） */
import { installScrollHoverGuard } from './utils/scrollHoverGuard.js';

// P3 双主题 (4c183cd4 续命): 在 React 挂载前同步 <html data-theme>,
// 避免 hydration 期间出现 light → dark 闪屏.
if (typeof window !== 'undefined') {
  initThemeMode();
installScrollHoverGuard();
}

/* ═══ 9-13 用户两次反馈「网站打不开」的加固 ═══
   线上实测：origin 200、nginx 零 5xx、Cloudflare 200，但用户侧仍可能遇到**白屏**：
   ① 浏览器还持着旧版 HTML（启发式缓存），它引用的 chunk 已被新 release 替换；
   ② 网络抖动导致某个 chunk 请求失败。
   两种情况现在的表现都是一片白 —— 用户只能说"打不开"。这里做两层兜底：
   第一层：chunk 加载失败自动硬刷新一次（15 秒内只自动重试一次，避免死循环）；
   第二层：真渲染崩了就显示「重新加载」兜底页，至少让用户知道发生了什么、能自救。 */
const CHUNK_RELOAD_KEY = 'shubao:chunk-reload-at';

function recoverFromChunkFailure() {
  try {
    const last = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
    if (Date.now() - last < 15_000) return false;
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  } catch {
    /* 隐私模式下 sessionStorage 可能不可用：仍然重载一次 */
  }
  window.location.reload();
  return true;
}

if (typeof window !== 'undefined') {
  /* Vite 在动态 import / preload 失败时会派发这个事件 */
  window.addEventListener('vite:preloadError', event => {
    event?.preventDefault?.();
    recoverFromChunkFailure();
  });
  /* 兜底：入口 <script> 本身加载失败（老 HTML + 新资源名）也会走这里 */
  window.addEventListener('error', event => {
    const target = event?.target;
    if (target && target.tagName === 'SCRIPT' && target.src) recoverFromChunkFailure();
  }, true);
}

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    /* 技术细节只进控制台，不给用户看（用户侧只看到「重新加载」） */
    console.error('[app] 页面渲染失败:', error, info?.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#fffdfa' }}>
      <div style={{ maxWidth: 420, textAlign: 'center' }}>
        <strong style={{ display: 'block', fontSize: 'var(--sb-text-xl)', color: '#1c1917' }}>页面没能加载成功</strong>
        <p style={{ margin: '10px 0 18px', color: '#78716c', fontSize: 'var(--sb-text-md)', lineHeight: 1.6 }}>
          通常是网络波动或版本刚更新导致的。点下面的按钮重新加载即可 —— 你的作品、画布和积分都不会丢。
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            height: 42, padding: '0 22px', border: 0, borderRadius: 'var(--sb-radius-md)',
            /* §18 裁定 2：功能按钮禁止渐变 → 品牌紫纯色。 */
            background: 'var(--sb-btn-primary-bg)',
            color: '#fff', fontFamily: 'inherit', fontSize: 'var(--sb-text-md)', fontWeight: 700, cursor: 'pointer',
          }}
        >重新加载</button>
      </div>
    </div>;
  }
}

// Google Fonts
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = 'https://fonts.googleapis.com/css2?family=ZCOOL+KuaiLe&family=Fredoka:wght@400..700&family=Noto+Sans+SC:wght@400..700&display=swap';
document.head.appendChild(link);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
);
