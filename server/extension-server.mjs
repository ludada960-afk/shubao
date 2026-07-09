/**
 * 薯包AI 扩展端独立服务器
 *
 * 专门处理扩展提交的数据采集、AI 分析、复刻生成。
 * 与主服务器 (index.mjs) 共享端口或独立运行。
 *
 * 用法：
 *   node server/extension-server.mjs
 *   或集成到主服务器（已在 index.mjs 中挂载）
 */

import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '.env');

// 加载 .env
try {
  const fs = await import('fs');
  if (fs.existsSync(envPath)) {
    const dotenv = await import('dotenv');
    dotenv.config({ path: envPath });
  }
} catch {}

import { mountOnApp } from './extensionRoutes.mjs';

const PORT = process.env.EXT_PORT || 3098;

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 基本健康检查
app.get('/health', (req, res) => res.json({ ok: true, service: 'extension' }));

// 挂载扩展端路由
mountOnApp(app);

// 启动
app.listen(PORT, () => {
  console.log(`\n🔌 薯包AI 扩展端服务运行中 http://localhost:${PORT}`);
  console.log(`   接口列表:`);
  console.log(`   POST /api/extension/collect    接收采集数据`);
  console.log(`   GET   /api/extension/task/:id  查询任务状态`);
  console.log(`   POST /api/extension/analyze    触发 AI 分析`);
  console.log(`   POST /api/extension/regenerate  触发复刻生成`);
  console.log('');
});
