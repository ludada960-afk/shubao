// 4c183cd4 续命 P0-D 飞书可视化 - webhook 入站 (Day 3-4)
// 设计: .superpowers/sdd/2026-08-28-feishu-design.md

import crypto from "node:crypto";

// 验证 URL (飞书 challenge) - GET /feishu/events
export function handleFeishuChallenge(verificationToken, query) {
  if (query && query.challenge && query.token === verificationToken) {
    return { challenge: query.challenge };
  }
  return null;
}

// 验证事件签名 (Encrypt key) - POST /feishu/events
export function verifyFeishuSignature({ encryptKey, body, timestamp, nonce, signature }) {
  if (!encryptKey || !body || !timestamp || !nonce || !signature) return false;
  const stringToSign = timestamp + nonce + encryptKey + body;
  const sha256 = crypto.createHash("sha256").update(stringToSign).digest("hex");
  return sha256 === signature;
}

// 解密事件 (encrypt key 模式)
export function decryptFeishuEvent(encryptKey, encrypted) {
  const key = crypto.createHash("sha256").update(encryptKey).digest();
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, Buffer.alloc(16));
  let decrypted = decipher.update(encrypted, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return JSON.parse(decrypted);
}

// 6 类事件触发点 (按设计稿)
// 1. url_verification - GET 验证
// 2. event_callback - POST 事件回调 (commit / 任务进度 / 异常 / 5min 心跳 / 18:00 日报 / 截图)
export function dispatchFeishuEvent(event, handlers) {
  const type = event && event.header && event.header.event_type;
  const fn = type === "url_verification" ? handlers.urlVerification : (type === "event_callback" ? handlers.eventCallback : null);
  return fn ? fn(event) : null;
}