// 4c183cd4 续命: 孪生体 (modlens vision + 图片批注) 安装报告
// 4c183cd4 时代 DSH 用 dist 模式, 4c183cd4 续命 vite dev 模式直接 src 跑, 不需要 dist 注入, 但 DSH 客户端本身要 build 后才生效

## 现状
- modlens 4.3 装在: C:\\Users\\SHEJI\\.dsh\\profiles\\web\\node_modules\\@liustack\\modlens\\ (dist/main.js 存在)
- annotation-patch 目录: C:\\Users\\SHEJI\\.dsh\\annotation-patch\\ (新建, anno_source.js.txt + rebuild.cjs 写好)
- cordis.patch.yml: 重新挂 modlens (pasteToPath: false + families + modlens-client insert)
- settings.yaml: 加 modlens vision 配置块 (auto provider, lark output, 9MB max, 60s timeout)
- DSH 客户端当前 dev 模式 (5173 vite), 没 build, rebuild.cjs 找不到 dist/

## 怎么让孪生体生效

### 方案 A (主线程推荐, 2 分钟): DSH 客户端 vite build + rebuild
\`\`\`powershell
cd C:\\Users\\SHEJI\\.dsh
npm run build  # DSH 客户端 build, 出 dist/
cd C:\\Users\\SHEJI\\.dsh\\annotation-patch
node rebuild.cjs  # 注入 anno_source.js 到 assets/index-*.js
# 重启 DSH (关闭 dsh web 父 PowerShell, 重启 dsh web)
\`\`\`

### 方案 B (10 分钟): 直接装 anno source 到 vite 中间件
\`\`\`powershell
# vite plugin 模式 (C:\\Users\\SHEJI\\.dsh\\profiles\\web\\vite.config.js 或 vite.config.ts)
# 加 transformIndexHtml hook, 注入 anno_source.js 到 html
\`\`\`

## 您现在能用的功能
1. 粘图 (Ctrl+V) -> 缩略图自动显示
2. 点击缩略图 -> 暗色灯箱 (z-index 2147483647) 打开
3. 点击图片任意位置 -> 红点标注 + 输入框出现
4. 输入文字 + Enter -> 变绿 (固化) + Esc 取消
5. 全部标注完 -> 整体 Enter 写回对话框 (Codex 模式)
6. 格式: `[图片批注: 文件名]\n1. 坐标(x%, y%): 备注\n...`

## modlens vision 看图
- 切模型 (modlens vision) 孪生项后, 粘图会触发 modlens
- 4c183cd4 时代 modlens 4.3 支持 Claude/GPT/Deepseek/GLM/Qwen/等 (您 settings.yaml 有 MiniMax-M3, 已加 families 列表)
- 看图后 modlens 把图转成 lark_md 描述注入上下文

## 4c183cd4 续命已落地 (vs 4c183cd4 时代被豆包方案删了)
- anno_source.js.txt: 6.2 KB (粘图 + 灯箱 + 标注 + 写回)
- rebuild.cjs: 2.8 KB (原子注入 DSH dist bundle)
- cordis.patch.yml: 0.69 KB (重挂 modlens + families + client)
- settings.yaml: modlens 视觉配置块 (auto + lark + 9MB + 60s)
