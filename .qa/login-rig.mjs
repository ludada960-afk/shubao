/* ═══ 登录台（批 CW 用）：给用户一个**独立 Chromium 窗口**自己登录知渔 / 刘颖AI ═══════════════════
   为什么这么设计：
     · **不用 ZCode 客户端**：打包版要开调试口必须整进程重启，会打断用户正在用的会话（RTK 有记录）。
     · **配置目录放在仓外**（%LOCALAPPDATA%\\shubao-competitor-profile）：cookie/会话**绝不进项目文件**，
       也不写进任何提交（本项目铁律：不在项目文件或聊天记录里写凭据）。
     · 开 `--remote-debugging-port` 之后，抓取脚本用 connectOverCDP 复用它 —— 这正是 2026-09-20
       那份知渔实采（quantv-video-pages.json）的采法。
   用法：node .qa/login-rig.mjs        （窗口会弹出来，用户在里面登录；脚本常驻并每 5 秒报一次状态）
────────────────────────────────────────────────────────────────────────────────────────────── */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';

const PORT = Number(process.env.SHUBO_CDP_PORT) > 0 ? Number(process.env.SHUBO_CDP_PORT) : 9333;
const PROFILE = process.env.SHUBO_COMPETITOR_PROFILE
  || join(process.env.LOCALAPPDATA || os.homedir(), 'shubao-competitor-profile');
mkdirSync(PROFILE, { recursive: true });
console.log('浏览器配置目录（仓外）：' + PROFILE);
console.log('调试端口：' + PORT + '（抓取脚本用 connectOverCDP 复用它）');

const TARGETS = [
  ['知渔 · 画布编辑器', 'https://laoyu.quantv.com/canvas/editor'],
  ['知渔 · 视频工作台（登录后才有内容）', 'https://laoyu.quantv.com/ai-video'],
  ['刘颖AI · 画布', 'https://liuyingai.cn/canvas-studio'],
];

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: null,
  args: [`--remote-debugging-port=${PORT}`, '--start-maximized', '--no-first-run'],
});

/* 打开目标页（已存在的标签页会被复用） */
const existing = new Set(ctx.pages().map(p => p.url()));
for (const [label, url] of TARGETS) {
  if ([...existing].some(u => u.startsWith(url.split('?')[0]))) continue;
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  console.log('已打开：' + label + ' → ' + url);
}

/* 每 5 秒报一次"看到的是登录页还是工作台" —— 只读，不点任何按钮、不触发任何生成 */
const probe = async () => {
  for (const page of ctx.pages()) {
    const url = page.url();
    if (!/quantv\.com|liuyingai\.cn/.test(url)) continue;
    const info = await page.evaluate(() => {
      const text = (document.body?.innerText || '').replace(/\s+/g, ' ');
      return {
        title: document.title.slice(0, 30),
        hasLogin: /登录|注册|扫码/.test(text),
        hasWorkbench: /积分|会员|我的作品|资产库|新建|工作流|画布|模板/.test(text),
        head: text.slice(0, 90),
      };
    }).catch(() => null);
    if (!info) continue;
    const host = new URL(url).host;
    console.log(`[${new Date().toLocaleTimeString()}] ${host}  title=${info.title}  登录页特征=${info.hasLogin ? '有' : '无'}  工作台特征=${info.hasWorkbench ? '有' : '无'}  | ${info.head}`);
  }
};
await probe();
setInterval(() => { probe().catch(() => {}); }, 5000);
console.log('\n请在弹出的窗口里登录知渔（和需要看的刘颖AI）。登录完成后**不要关这个窗口**，告诉我一声即可。');
console.log('（脚本现在常驻；抓取时我会连上同一个浏览器读 DOM，不会代你点任何生成按钮。）');
