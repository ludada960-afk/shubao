import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/design-tokens.css';
import './styles/theme.css';
import './styles/semanticTokens.css';
import { initThemeMode } from './utils/themeMode.js';

// P3 双主题 (4c183cd4 续命): 在 React 挂载前同步 <html data-theme>,
// 避免 hydration 期间出现 light → dark 闪屏.
if (typeof window !== 'undefined') {
  initThemeMode();
}

// Google Fonts
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = 'https://fonts.googleapis.com/css2?family=ZCOOL+KuaiLe&family=Fredoka:wght@400..700&family=Noto+Sans+SC:wght@400..700&display=swap';
document.head.appendChild(link);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
