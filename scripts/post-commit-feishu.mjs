#!/usr/bin/env node
// 4c183cd4 续命 P0-D Day 5: git commit hook -> 飞书任务进度卡
// 设计: .superpowers/sdd/2026-08-28-feishu-design.md §6 commit hook
// 用法: cp scripts/post-commit-feishu.mjs .git/hooks/post-commit && chmod +x

import { execSync } from "node:child_process";
import { sendFeishuMessage, CARD_TEMPLATES, getFeishuConfigFromEnv } from "../server/feishu/send.mjs";

const env = getFeishuConfigFromEnv(".env") || {};
if (!env.FEISHU_APP_ID || !env.FEISHU_APP_SECRET || !env.FEISHU_RECEIVE_ID) {
  console.log("[feishu] 未配置 FEISHU_APP_ID/SECRET/RECEIVE_ID, skip");
  process.exit(0);
}

try {
  const subject = execSync("git log -1 --format=%s", { encoding: "utf8" }).trim();
  const hash = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  const card = CARD_TEMPLATES.taskProgress({
    taskName: hash + " " + subject.slice(0, 30),
    status: "success",
    points: null,
    duration: null,
  });
  const r = await sendFeishuMessage({
    appId: env.FEISHU_APP_ID,
    appSecret: env.FEISHU_APP_SECRET,
    receiveIdType: env.FEISHU_RECEIVE_ID_TYPE || "chat_id",
    receiveId: env.FEISHU_RECEIVE_ID,
    card: card,
  });
  console.log("[feishu] taskProgress 卡发送 ok, msg_id:", r.data && r.data.message_id);
} catch (e) {
  console.error("[feishu] 发送失败 (不阻塞 commit):", e.message);
  process.exit(0);
}