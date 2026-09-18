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
    /* ═══ 2026-09-19：把编辑器的临时目录排除在文件监视之外 ═══════════════════════════════
       症状：dev server 会**毫无征兆地整个崩掉**，栈顶是
         Error: EBUSY: resource busy or locked, watch '...\.RTK.md.19908.<uuid>.tmpdir\RTK.md.tmp'
       根因不是我们的代码 —— 是"改文件"这个动作本身：写盘工具走的是
       **同目录临时文件 + rename**（.RTK.md.<pid>.<uuid>.tmpdir/RTK.md.tmp），
       而 vite 的 watcher 会把仓库里任何新出现的路径都收进去监视；
       Windows 上那个临时文件在 rename 的瞬间是**被占用**的 → watcher 抛 EBUSY → 进程退出。
       所以每次编辑根目录下的文件（RTK.md 这种）都有概率把开发服务器打死，
       然后下一轮 work 就全是"页面打不开"的假故障。
       修法：把这类临时目录整类排除（它们永远不会是页面资源）。
       ⚠️ 不要改成 chokidar 的 usePolling：那会更慢，而且没解决"watch 一个不该 watch 的路径"。 */
    watch: {
      ignored: ['**/.*.tmpdir/**', '**/*.tmpdir/**'],
    },
  },
  build: {
        cssCodeSplit: false,
    outDir: 'dist',
    sourcemap: false,
  },
});
