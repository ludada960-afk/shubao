import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// dev 防呆：后端(3001)未启动时，/api 经代理会返回纯文本 500 "Internal Server Error"，
// 页面弹窗只会显示这串英文。启动 dev server 时主动探测一次，提前给出可执行提示。
function warnWhenBackendDown() {
  return {
    name: 'shubao-warn-when-backend-down',
    configureServer() {
      const probe = fetch('http://localhost:3001/api/session')
        .catch(() => null)
        .then((res) => {
          if (res) return;
          console.warn('');
          console.warn('‼️  后端服务未检测到 (http://localhost:3001)');
          console.warn('   /api 请求会返回 "Internal Server Error"。请先启动后端：');
          console.warn('     npm run start        # 同时启动 server + vite');
          console.warn('     node server/index.mjs  # 仅启动后端');
          console.warn('');
        });
      void probe;
    },
  };
}

export default defineConfig({
  plugins: [react(), warnWhenBackendDown()],
  root: '.',
  publicDir: 'public',
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
