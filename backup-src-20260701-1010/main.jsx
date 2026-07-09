import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '../shubao-final.jsx';

// 加载设计系统 CSS tokens
import './styles/design-tokens/index.css';

// 浏览器预览模式：用 localStorage 模拟 Tauri storage API
if (!window.storage) {
  window.storage = {
    get: async (key) => {
      const val = localStorage.getItem(key);
      return val ? { value: val } : null;
    },
    set: async (key, val) => {
      localStorage.setItem(key, val);
    },
  };
}

// 加载 Google Fonts (ZCOOL KuaiLe + Fredoka + Noto Sans SC)
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = 'https://fonts.googleapis.com/css2?family=ZCOOL+KuaiLe&family=Fredoka:wght@400..700&family=Noto+Sans+SC:wght@400..700&display=swap';
document.head.appendChild(link);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
