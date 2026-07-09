import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/design-tokens.css';

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
