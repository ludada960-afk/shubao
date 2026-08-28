// 4c183cd4 续命 P2 飞书日报 - 每日 18:00 推 1 条 Daily Digest 卡
// 设计: .superpowers/sdd/2026-08-28-feishu-design.md §3.4 卡片 D + §4.5 触发点 5
// 集成: scripts/director-monitor.mjs 5min cron 末尾增量触发 (复用 5min 时窗)
//
// 入口:
//   import { runDailyReport } from "./dailyReport.mjs";
//   await runDailyReport({ cwd: process.cwd(), envPath: ".env" });
//
// CLI 入口 (给 cron 直接调用):
//   node server/feishu/dailyReport.mjs
//
// 行为:
//   1. shouldTriggerDailyReport: 检查当前时间是否在 18:00 ± windowMinutes 内,
//      且今天没跑过 (用 .superpowers/sdd/.feishu-daily-report.lock 标记)
//   2. collectDailyReportData: 跑 git log --since="昨日 18:00" + git diff --stat,
//      读 progress.md 摘今日要点
//   3. buildDailyReportCard: 包 send.mjs 的 CARD_TEMPLATES.dailyReport
//   4. pushDailyReport: 调 send.mjs.sendFeishuMessage 发到 FEISHU_RECEIVE_ID
//   5. 任何阶段失败: 写 director-alerts.log (复用 P0-D 既有日志), 不抛

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { CARD_TEMPLATES, getFeishuConfigFromEnv, sendFeishuMessage } from "./send.mjs";

const DEFAULT_HOUR = 18;          // 设计稿 §4.5: 18:00
const DEFAULT_WINDOW_MIN = 5;     // 5min cron 的容差窗
const LOCK_DIR = ".superpowers/sdd";
const LOCK_FILE = path.join(LOCK_DIR, ".feishu-daily-report.lock");
const ALERT_LOG = path.join(LOCK_DIR, "director-alerts.log");
const PROGRESS_MD = ".superpowers/sdd/progress.md";
const PROGRESS_HEAD_LINES = 80;   // 摘今日要点只看 head 80 行 (避免长 progress 拖慢)

function nowInTimezone(tzOffsetHours = 8) {
  // 中国 UTC+8, 飞书 user 在国内. 避免依赖 Intl 浏览器兼容性.
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  return new Date(utcMs + tzOffsetHours * 3_600_000);
}

function log(line) {
  const ts = new Date().toISOString();
  const out = "[" + ts + "] [feishu-daily] " + line;
  console.log(out);
  try {
    fs.mkdirSync(LOCK_DIR, { recursive: true });
    fs.appendFileSync(ALERT_LOG, out + "\n");
  } catch (e) { /* 日志写不进不阻塞 */ }
}

function safeReadText(p) {
  try { return fs.readFileSync(p, "utf-8"); } catch (e) { return ""; }
}

function safeStatMtimeMs(p) {
  try { return fs.statSync(p).mtimeMs; } catch (e) { return 0; }
}

// 时窗 + 当日去重. 返回 { triggered: bool, reason: string, today: 'YYYY-MM-DD' }
// now 约定: 已被 nowInTimezone 转成 +8 区的 Date 对象, 内部用 UTC* 方法当 wall clock
export function shouldTriggerDailyReport({
  now = nowInTimezone(),
  hour = DEFAULT_HOUR,
  windowMinutes = DEFAULT_WINDOW_MIN,
  lockFile = LOCK_FILE,
} = {}) {
  // wall clock 日期 (now 已被转 +8 区, getUTC* 就是 +8 区 wall clock)
  const y = now.getUTCFullYear();
  const mo = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const today = y + "-" + mo + "-" + d;
  const h = now.getUTCHours();     // +8 区的小时
  const m = now.getUTCMinutes();
  const minutesOfDay = h * 60 + m;
  const target = hour * 60;
  if (minutesOfDay < target || minutesOfDay >= target + windowMinutes) {
    return { triggered: false, reason: "outside-window", today, minutesOfDay };
  }
  let lastDate = "";
  try { lastDate = fs.readFileSync(lockFile, "utf-8").trim(); } catch (e) { /* first run */ }
  if (lastDate === today) {
    return { triggered: false, reason: "already-ran-today", today };
  }
  return { triggered: true, reason: "ok", today };
}

function writeLock(lockFile, today) {
  try {
    fs.mkdirSync(path.dirname(lockFile), { recursive: true });
    fs.writeFileSync(lockFile, today, "utf-8");
  } catch (e) { log("ERR write lock: " + e.message); }
}

// 收集今日数据: commit 数 / diff stat / 今日要点
export function collectDailyReportData({
  cwd = process.cwd(),
  sinceISO,         // e.g. "2026-08-27T18:00:00+08:00" - 昨日 18:00 (本地)
  untilISO,         // e.g. "2026-08-28T18:00:00+08:00" - 今日 18:00 (本地)
  progressPath = PROGRESS_MD,
  maxTopItems = 5,
} = {}) {
  // 1. commit 数 + hash list
  let totalCommits = 0;
  const commitList = [];
  try {
    const args = ["log", "--since=" + sinceISO, "--until=" + untilISO, "--format=%h %s", "--no-merges"];
    const out = execFileSync("git", args, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] });
    const lines = out.split("\n").map(s => s.trim()).filter(Boolean);
    totalCommits = lines.length;
    commitList.push(...lines);
  } catch (e) {
    log("WARN git log 失败: " + e.message);
  }

  // 2. 今日要点: 从 progress.md 头部抓 "## YYYY-MM-DD" section
  const topItems = extractProgressTopItems({
    progressPath: path.join(cwd, progressPath),
    today: untilISO.slice(0, 10),
    maxItems: maxTopItems,
  });

  // 3. diff stat: 跑 head ~1 commit 的 stat (有 commit 就跑最后 1 个)
  let diffStat = "";
  if (commitList.length > 0) {
    try {
      const lastHash = commitList[commitList.length - 1].split(" ")[0];
      diffStat = execFileSync("git", ["show", "--stat", "--format=", lastHash], {
        cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"],
      }).trim().split("\n").slice(0, 5).join("\n");
    } catch (e) { /* skip */ }
  }

  return { totalCommits, commitList, topItems, diffStat };
}

function extractProgressTopItems({ progressPath, today, maxItems }) {
  const txt = safeReadText(progressPath);
  if (!txt) return [];
  const lines = txt.split("\n");
  // 抓 "## 2026-08-28" section
  const headerRe = new RegExp("^##\\s+" + today.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headerRe.test(lines[i])) { startIdx = i; break; }
  }
  if (startIdx < 0) {
    // 没找到今日 section, 用 head N 行的 bullet (兼容旧 progress 没日期 section)
    return lines.slice(0, PROGRESS_HEAD_LINES)
      .filter(l => /^\\s*[-*]\\s+/.test(l))
      .map(l => l.replace(/^\\s*[-*]\\s+/, "").trim())
      .filter(Boolean)
      .slice(0, maxItems);
  }
  const section = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^##\\s+/.test(lines[i])) break;        // 下一个 ## section 结束
    section.push(lines[i]);
  }
  return section
    .filter(l => /^\\s*[-*]\\s+/.test(l))
    .map(l => l.replace(/^\\s*[-*]\\s+/, "").trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

export function buildDailyReportCard({
  date,                  // 'YYYY-MM-DD' (今日, 卡 header 显示)
  totalCommits,
  newTests = 0,
  topItems = [],
  dashboardUrl = "https://shuimg.cn/health",
}) {
  return CARD_TEMPLATES.dailyReport({ date, totalCommits, newTests, topItems, dashboardUrl });
}

export async function pushDailyReport({
  envPath = ".env",
  cwd = process.cwd(),
  card,
  dryRun = false,
} = {}) {
  if (dryRun) {
    log("dryRun: 不实际发送, card keys=" + Object.keys(card || {}).join(","));
    return { ok: true, dryRun: true };
  }
  const env = getFeishuConfigFromEnv(path.join(cwd, envPath)) || {};
  if (!env.FEISHU_APP_ID || !env.FEISHU_APP_SECRET || !env.FEISHU_RECEIVE_ID) {
    return { ok: false, reason: "missing-env", envKeys: Object.keys(env) };
  }
  try {
    const r = await sendFeishuMessage({
      appId: env.FEISHU_APP_ID,
      appSecret: env.FEISHU_APP_SECRET,
      receiveIdType: env.FEISHU_RECEIVE_ID_TYPE || "chat_id",
      receiveId: env.FEISHU_RECEIVE_ID,
      card,
    });
    log("发送 ok msg_id=" + (r?.data?.message_id || "?"));
    return { ok: true, messageId: r?.data?.message_id };
  } catch (e) {
    log("ERR sendFeishuMessage: " + e.message);
    return { ok: false, reason: "send-failed", error: e.message };
  }
}

// 主入口: shouldTrigger + collect + build + push + writeLock
export async function runDailyReport({
  cwd = process.cwd(),
  envPath = ".env",
  dryRun = false,
  hour = DEFAULT_HOUR,
  windowMinutes = DEFAULT_WINDOW_MIN,
  lockFile = LOCK_FILE,
  now = nowInTimezone(),
  force = false,            // 测试用: 跳过 shouldTrigger
  dashboardUrl = "https://shuimg.cn/health",
} = {}) {
  let gate;
  if (force) {
    gate = { triggered: true, reason: "force", today: now.toISOString().slice(0, 10) };
  } else {
    gate = shouldTriggerDailyReport({ now, hour, windowMinutes, lockFile });
  }
  if (!gate.triggered) {
    log("skip: " + gate.reason + " (today=" + gate.today + ")");
    return { triggered: false, reason: gate.reason };
  }
  // since = 昨日 18:00, until = 今日 18:00
  const since = new Date(now.getTime() - 24 * 3_600_000);
  const sinceISO = since.toISOString().slice(0, 19) + "+00:00";
  const untilISO = now.toISOString().slice(0, 19) + "+00:00";
  const data = collectDailyReportData({ cwd, sinceISO, untilISO });
  const card = buildDailyReportCard({
    date: gate.today,
    totalCommits: data.totalCommits,
    newTests: 0,            // P2 不算 test 数 (留扩展位)
    topItems: data.topItems,
    dashboardUrl,
  });
  const sendResult = await pushDailyReport({ envPath, cwd, card, dryRun });
  if (sendResult.ok) {
    writeLock(lockFile, gate.today);
    log("committed today=" + gate.today + " commits=" + data.totalCommits);
  } else {
    log("send failed, 不写 lock, 下个 5min 周期重试. reason=" + sendResult.reason);
  }
  return { triggered: true, today: gate.today, commits: data.totalCommits, ...sendResult };
}

// CLI 入口: 直接 node server/feishu/dailyReport.mjs
if (import.meta.url === "file:///" + process.argv[1].replace(/\\/g, "/")) {
  runDailyReport({ cwd: process.cwd(), dryRun: process.argv.includes("--dry-run") })
    .then(r => { console.log(JSON.stringify(r)); process.exit(0); })
    .catch(e => { console.error("[feishu-daily] crash:", e); process.exit(1); });
}
