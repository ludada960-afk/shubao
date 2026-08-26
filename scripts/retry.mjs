#!/usr/bin/env node
// scripts/retry.mjs — 无限重试包装器（429/5xx/网络抖动）
// 用法: node scripts/retry.mjs -- npm test
//       node scripts/retry.mjs -- npm run build
// 任何被包装命令失败时按指数退避无限重试（默认上限 999999 次，间隔 1→2→4→…→60s）
const args = process.argv.slice(2);
const sep = args.indexOf('--');
if (sep < 0) { console.error('用法: node scripts/retry.mjs -- <命令> [参数...]'); process.exit(2); }
const cmd = args.slice(sep + 1);
const MAX = Number(process.env.RETRY_MAX || 999999);
const BASE_MS = Number(process.env.RETRY_BASE_MS || 1000);
const CAP_MS = Number(process.env.RETRY_CAP_MS || 60000);
const TRANSIENT = /429|503|502|504|ETIMEDOUT|ECONNRESET|EAI_AGAIN|ENOTFOUND|EPIPE/i;
import { spawn } from 'node:child_process';
let attempt = 0;
while (attempt < MAX) {
  attempt++;
  const code = await new Promise(resolve => {
    const p = spawn(cmd[0], cmd.slice(1), { stdio: 'inherit', shell: process.platform === 'win32' });
    p.on('close', c => resolve(c ?? 1));
  });
  if (code === 0) { console.error('\n[retry] 成功于第 ' + attempt + ' 次尝试'); process.exit(0); }
  const wait = Math.min(CAP_MS, BASE_MS * Math.pow(2, Math.min(attempt - 1, 6)));
  console.error('\n[retry] 退出码=' + code + ' attempt=' + attempt + '/' + MAX + ' → ' + wait + 'ms 后重试');
  await new Promise(r => setTimeout(r, wait));
}
console.error('[retry] 达到最大尝试次数 ' + MAX);
process.exit(1);
