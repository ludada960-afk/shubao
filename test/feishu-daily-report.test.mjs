// 4c183cd4 续命 P2 飞书日报 contract test
// 设计: .superpowers/sdd/2026-08-28-feishu-design.md §3.4 / §4.5
// 覆盖 shouldTriggerDailyReport + buildDailyReportCard + collectDailyReportData + pushDailyReport(dryRun)

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  shouldTriggerDailyReport,
  buildDailyReportCard,
  collectDailyReportData,
  pushDailyReport,
  runDailyReport,
} from "../server/feishu/dailyReport.mjs";

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "feishu-dr-"));
}

function makeNow(hour, minute = 0) {
  // 构造一个 +8 区的小时数, 喂给 shouldTriggerDailyReport 的 now
  // dailyReport 用 nowInTimezone 返回 Date, 内部用 getUTCHours 取 +8 小时
  // 我们直接传 now, shouldTriggerDailyReport 内部调 now.getUTCHours()
  // 所以 now 必须是"已转 +8 区"的 Date. 简化: 用 2000-01-01 + 8h offset
  const base = new Date(Date.UTC(2000, 0, 1, hour, minute, 0));
  return base;
}

// === shouldTriggerDailyReport ===
test("shouldTriggerDailyReport 时窗内 + 无 lock → triggered", () => {
  const dir = tmpDir();
  const lock = path.join(dir, "lock");
  const r = shouldTriggerDailyReport({ now: makeNow(18, 0), hour: 18, windowMinutes: 5, lockFile: lock });
  assert.equal(r.triggered, true);
  assert.equal(r.reason, "ok");
});

test("shouldTriggerDailyReport 时窗外 → 不触发 (before)", () => {
  const dir = tmpDir();
  const r = shouldTriggerDailyReport({ now: makeNow(17, 59), hour: 18, windowMinutes: 5, lockFile: path.join(dir, "lock") });
  assert.equal(r.triggered, false);
  assert.equal(r.reason, "outside-window");
});

test("shouldTriggerDailyReport 时窗外 → 不触发 (after)", () => {
  const dir = tmpDir();
  const r = shouldTriggerDailyReport({ now: makeNow(18, 6), hour: 18, windowMinutes: 5, lockFile: path.join(dir, "lock") });
  assert.equal(r.triggered, false);
  assert.equal(r.reason, "outside-window");
});

test("shouldTriggerDailyReport 今日已跑 → 不再触发", () => {
  const dir = tmpDir();
  const lock = path.join(dir, "lock");
  const today = "2026-08-28";
  fs.writeFileSync(lock, today, "utf-8");
  // now 约定: 已转 +8 区 wall clock. 用 Date.UTC 直接放 wall clock 字段.
  const now = new Date(Date.UTC(2026, 7, 28, 18, 1, 0));
  const r = shouldTriggerDailyReport({ now, hour: 18, windowMinutes: 5, lockFile: lock });
  assert.equal(r.triggered, false);
  assert.equal(r.reason, "already-ran-today");
  assert.equal(r.today, today);
});

// === buildDailyReportCard ===
test("buildDailyReportCard 用 send.mjs dailyReport 模板 (蓝色 header)", () => {
  const card = buildDailyReportCard({
    date: "2026-08-28",
    totalCommits: 8,
    newTests: 0,
    topItems: ["D9 总监调研", "D5 IP233 通道"],
    dashboardUrl: "https://shuimg.cn/health",
  });
  assert.equal(card.msg_type, "interactive");
  assert.equal(card.card.header.template, "blue");
  assert.match(card.card.header.title.content, /2026-08-28/);
  // 至少包含 commits 数 + 要点
  const text = JSON.stringify(card);
  assert.match(text, /commits/);
  assert.match(text, /8/);
  assert.match(text, /D9/);
});

test("buildDailyReportCard topItems 空时仍能生成 card", () => {
  const card = buildDailyReportCard({ date: "2026-08-28", totalCommits: 0, topItems: [] });
  assert.equal(card.card.header.template, "blue");
  const text = JSON.stringify(card);
  assert.match(text, /0/);
});

// === pushDailyReport dryRun ===
test("pushDailyReport dryRun 跳过实际发送", async () => {
  const r = await pushDailyReport({
    envPath: ".env",
    cwd: process.cwd(),
    card: buildDailyReportCard({ date: "2026-08-28", totalCommits: 1 }),
    dryRun: true,
  });
  assert.equal(r.ok, true);
  assert.equal(r.dryRun, true);
});

test("pushDailyReport 缺 env 时返 missing-env, 不抛", async () => {
  const dir = tmpDir();
  // dir 里没 .env
  const r = await pushDailyReport({
    envPath: ".env",
    cwd: dir,
    card: buildDailyReportCard({ date: "2026-08-28", totalCommits: 0 }),
  });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "missing-env");
});

// === collectDailyReportData ===
test("collectDailyReportData 在 git repo 里能跑通 (当前 worktree)", () => {
  // 用 .worktrees/codex-ecommerce-stability 作为 cwd, since = 2 天前
  const cwd = path.resolve(".");
  const since = new Date(Date.now() - 2 * 86400_000).toISOString().slice(0, 19) + "+00:00";
  const until = new Date(Date.now() + 1 * 86400_000).toISOString().slice(0, 19) + "+00:00";
  const data = collectDailyReportData({ cwd, sinceISO: since, untilISO: until });
  assert.ok(typeof data.totalCommits === "number");
  assert.ok(Array.isArray(data.topItems));
  assert.ok(Array.isArray(data.commitList));
  // 2 天内应该有 commit
  if (data.totalCommits > 0) {
    assert.ok(data.commitList.length === data.totalCommits);
  }
});

test("collectDailyReportData 在非 git dir 里优雅降级 (totalCommits=0)", () => {
  const dir = tmpDir();
  const since = new Date(Date.now() - 86400_000).toISOString();
  const until = new Date().toISOString();
  const data = collectDailyReportData({ cwd: dir, sinceISO: since, untilISO: until });
  assert.equal(data.totalCommits, 0);
  assert.deepEqual(data.commitList, []);
  assert.deepEqual(data.topItems, []);
});

// === runDailyReport force=true ===
test("runDailyReport force=true 跳过 shouldTrigger, dryRun 走完流程", async () => {
  const dir = tmpDir();
  // 在 worktree 里跑, 这样 git log 能拿到 commits
  const cwd = path.resolve(".");
  const r = await runDailyReport({
    cwd,
    envPath: ".env",
    dryRun: true,
    force: true,
    lockFile: path.join(dir, "lock"),
  });
  assert.equal(r.triggered, true);
  assert.equal(r.ok, true);
  assert.equal(r.dryRun, true);
});

test("runDailyReport 非 force + 时窗外 → 不触发, 不发卡", async () => {
  const dir = tmpDir();
  // 注入 now: 构造一个 today 18:00 之前的 Date
  const now = makeNow(8, 0);  // 上午 8 点, 不在 18:00 时窗
  const r = await runDailyReport({
    cwd: process.cwd(),
    envPath: ".env",
    dryRun: true,
    now,
    lockFile: path.join(dir, "lock"),
  });
  assert.equal(r.triggered, false);
  assert.equal(r.reason, "outside-window");
});
