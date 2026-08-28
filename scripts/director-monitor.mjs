#!/usr/bin/env node
// 薯包总监子代理监控脚本 - 每 5 分钟跑一次
import fs from 'fs';

const PROGRESS = '.superpowers/sdd/progress.md';
const BRIEF = 'docs/superpowers/specs/director-briefing.md';
const ALERT_LOG = '.superpowers/sdd/director-alerts.log';

function log(line) {
  const ts = new Date().toISOString();
  const out = '[' + ts + '] ' + line;
  console.log(out);
  try { fs.appendFileSync(ALERT_LOG, out + String.fromCharCode(10)); } catch (e) {}
}

try {
  const stat = fs.statSync(PROGRESS);
  const ageMin = Math.round((Date.now() - stat.mtimeMs) / 60000);
  log('progress.md mtime=' + stat.mtime.toISOString() + ' age=' + ageMin + 'min');
  if (ageMin > 1440) log('WARN: progress.md >24h not refreshed');
} catch (e) { log('ERR progress.md: ' + e.message); }

try {
  const b = fs.statSync(BRIEF);
  log('briefing.md size=' + b.size + ' ageMin=' + Math.round((Date.now()-b.mtimeMs)/60000));
} catch (e) { log('ERR briefing.md: ' + e.message); }

const dItems = ['D1:user-decide-6-8-items','D2:admin-net-contribution','D3:h3-2k-first-bill','D4:11.9-vs-12.9-ab','D5:ip233-cheap-channel','D6:monthly-card-39-59','D7:gallery-28-to-56','D8:chat-tweaks-cameramove','D9:director-inspector','D10:timeline-trim','D11:cross-domain-bridge','D12:tts-sku','D13:ffmpeg-render','D14:end-to-end-canvas','D15:5-seeds-posts','D16:gallery-56','D17:beta-10-20','D18:sep-monthly-report'];
const status = {};
dItems.forEach(function(k){ status[k] = 'pending'; });
try {
  fs.writeFileSync('.superpowers/sdd/director-status.json', JSON.stringify({ts: new Date().toISOString(), status: status}, null, 2));
} catch(e) { log('ERR status write: ' + e.message); }
log('18 D items status snapshot written. Waiting for user decision on 6-8 items.');

// P2 飞书日报增量: 5min cron 末尾检查 18:00 时窗, 触发 dailyReport.mjs
// 设计: .superpowers/sdd/2026-08-28-feishu-design.md §4.5 触发点 5
// dailyReport 内部自带 shouldTriggerDailyReport 去重, 5min 内只推 1 次
try {
  const { runDailyReport } = await import('../server/feishu/dailyReport.mjs');
  const r = await runDailyReport({ cwd: process.cwd(), envPath: '.env' });
  log('dailyReport gate=' + (r.triggered ? 'fired' : 'skip:' + (r.reason || '?')));
  if (r.triggered && r.ok) log('dailyReport ok today=' + r.today + ' commits=' + r.commits);
  if (r.triggered && !r.ok) log('dailyReport send failed reason=' + (r.reason || '?'));
} catch (e) { log('ERR dailyReport: ' + e.message); }

log('--- monitor complete ---');
