// 4c183cd4 续命 P0-D 飞书可视化 MVP - 出站消息模块
// 设计: .superpowers/sdd/2026-08-28-feishu-design.md
// 调研: .superpowers/sdd/2026-08-28-feishu-research.md

import fs from "node:fs";

const FEISHU_BASE = "https://open.feishu.cn/open-apis";

// 获取 tenant_access_token (2h 有效, 缓存到内存)
let cachedToken = null;
let cachedTokenExp = 0;
async function getTenantToken({ appId, appSecret }) {
  if (cachedToken && Date.now() < cachedTokenExp - 60000) return cachedToken;
  const r = await fetch(`${FEISHU_BASE}/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  if (!r.ok) throw new Error(`feishu auth failed: ${r.status}`);
  const data = await r.json();
  if (data.code !== 0) throw new Error(`feishu auth error: ${data.msg}`);
  cachedToken = data.tenant_access_token;
  cachedTokenExp = Date.now() + data.expire * 1000;
  return cachedToken;
}

// 5 类卡片模板 (按设计稿)
// - projectStatus: 蓝色, header+当前任务+进度+最近 commit
// - taskProgress: 绿/黄/红, 一次一推
// - exception: 红色, 绕过限流
// - dailyReport: 蓝色, 18:00 推
// - screenshot: 蓝色, image_key
export const CARD_TEMPLATES = {
  projectStatus({ title, currentTask, progress, recentCommits, dashboardUrl }) {
    return {
      msg_type: "interactive",
      card: {
        config: { wide_screen_mode: true },
        header: { template: "blue", title: { tag: "plain_text", content: title || "项目状态" } },
        elements: [
          { tag: "div", text: { tag: "lark_md", content: `**当前任务**: ${currentTask || "无"}\n**进度**: ${progress ?? "?"}%` } },
          { tag: "hr" },
          { tag: "div", text: { tag: "lark_md", content: `**最近 commits**:\n${(recentCommits || []).map(c => `\u2022 ${c}`).join("\n")}` } },
          { tag: "action", actions: [{ tag: "button", text: { tag: "plain_text", content: "看项目" }, type: "primary", url: dashboardUrl }] },
        ],
      },
    };
  },
  taskProgress({ taskName, status, points, duration, errorMessage }) {
    const color = status === "success" ? "green" : status === "failed" ? "red" : "yellow";
    return {
      msg_type: "interactive",
      card: {
        header: { template: color, title: { tag: "plain_text", content: `任务: ${taskName}` } },
        elements: [
          { tag: "div", text: { tag: "lark_md", content: `**状态**: ${status}\n**积分**: ${points ?? "?"} · **耗时**: ${duration ?? "?"}s${errorMessage ? "\n**错误**: " + errorMessage : ""}` } },
        ],
      },
    };
  },
  exception({ source, message, stack, dashboardUrl }) {
    return {
      msg_type: "interactive",
      card: {
        header: { template: "red", title: { tag: "plain_text", content: `异常: ${source}` } },
        elements: [
          { tag: "div", text: { tag: "lark_md", content: `**消息**: ${message}\n\`\`\`${(stack || "").slice(0, 500)}\`\`\`` } },
          { tag: "action", actions: [{ tag: "button", text: { tag: "plain_text", content: "看 dashboard" }, type: "danger", url: dashboardUrl }] },
        ],
      },
    };
  },
  dailyReport({ date, totalCommits, newTests, topItems, dashboardUrl }) {
    return {
      msg_type: "interactive",
      card: {
        header: { template: "blue", title: { tag: "plain_text", content: `每日日报 ${date}` } },
        elements: [
          { tag: "div", text: { tag: "lark_md", content: `**commits**: ${totalCommits}\n**新测试**: ${newTests}\n**今日要点**:\n${(topItems || []).map(i => `\u2022 ${i}`).join("\n")}` } },
          { tag: "action", actions: [{ tag: "button", text: { tag: "plain_text", content: "看 dashboard" }, type: "primary", url: dashboardUrl }] },
        ],
      },
    };
  },
  screenshot({ title, imageKey, dashboardUrl }) {
    return {
      msg_type: "interactive",
      card: {
        header: { template: "blue", title: { tag: "plain_text", content: title || "截图" } },
        elements: [
          { tag: "img", img_key: imageKey },
          { tag: "action", actions: [{ tag: "button", text: { tag: "plain_text", content: "看 dashboard" }, type: "primary", url: dashboardUrl }] },
        ],
      },
    };
  },
};

// 发消息到飞书 chat (用 chat_id 或 open_id)
export async function sendFeishuMessage({ appId, appSecret, receiveIdType, receiveId, card }) {
  if (!appId || !appSecret) throw new Error("feishu appId/appSecret required");
  const token = await getTenantToken({ appId, appSecret });
  const r = await fetch(`${FEISHU_BASE}/im/v1/messages?receive_id_type=${receiveIdType}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ receive_id: receiveId, ...card }),
  });
  if (!r.ok) throw new Error(`feishu send failed: ${r.status}`);
  const data = await r.json();
  if (data.code !== 0) throw new Error(`feishu send error: ${data.msg}`);
  return data;
}

// 读 .env 拿飞书配置
export function getFeishuConfigFromEnv(envPath = ".env") {
  if (!fs.existsSync(envPath)) return null;
  const txt = fs.readFileSync(envPath, "utf-8");
  const cfg = {};
  for (const line of txt.split("\n")) {
    const m = line.match(/^\s*(FEISHU_[A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m) cfg[m[1]] = m[2].replace(/^["\x27]|["\x27]$/g, "");
  }
  return cfg;
}