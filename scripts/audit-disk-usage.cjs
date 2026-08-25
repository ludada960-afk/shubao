#!/usr/bin/env node
/**
 * 磁盘占用盘点脚本（只读，绝不删除任何文件）。
 *
 * 统计三个膨胀源的总字节与文件数：
 *   1. server/generated-assets/              —— 用户资产原图（按 retentionService 分级口径归类）
 *   2. server/generated-assets/.derivatives/ —— sharp 派生图缓存（可随时由原图重建）
 *   3. server/cache_img/                     —— 外链代理缓存（可随时重新拉取）
 *
 * 复用 server/projects/retentionService.mjs 的分级逻辑：
 *   - 常量 RETENTION_MS 直接从该 ESM 模块动态导入；
 *   - 到期公式与 markExpired 一致：expires_at ?? created_at + RETENTION_MS[retention_class]。
 *
 * 用法：
 *   node scripts/audit-disk-usage.cjs [--json]
 *   SHUBAO_SERVER_DIR=<server 目录> 覆盖默认定位（默认取本脚本 ../server）。
 *
 * 数据库只读打开（better-sqlite3 readonly）；打开失败时自动降级为“仅体积统计”。
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const AS_JSON = process.argv.slice(2).includes('--json');
const SERVER_DIR = path.resolve(process.env.SHUBAO_SERVER_DIR || path.join(__dirname, '..', 'server'));
const GENERATED_ROOT = path.join(SERVER_DIR, 'generated-assets');
const DERIVATIVES_ROOT = path.join(GENERATED_ROOT, '.derivatives');
const PROXY_CACHE_ROOT = path.join(SERVER_DIR, 'cache_img');
const WORKS_DB_PATH = path.join(SERVER_DIR, 'works.db');

const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_PROXY_TTL_MS = 72 * HOUR_MS;
const DEFAULT_DERIVATIVES_MAX_BYTES = 2 * 1024 * 1024 * 1024;

function parsePositiveNumberEnv(raw, fallback) {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const PROXY_TTL_MS = parsePositiveNumberEnv(process.env.PROXY_CACHE_TTL_HOURS, 72) * HOUR_MS;
const DERIVATIVES_MAX_BYTES = parsePositiveNumberEnv(
  process.env.DERIVATIVES_MAX_BYTES,
  DEFAULT_DERIVATIVES_MAX_BYTES,
);

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const rounded = value >= 100 || unitIndex === 0 ? String(Math.round(value)) : value.toFixed(1);
  return rounded + ' ' + units[unitIndex];
}

/** 深度优先收集文件（只读 stat，不修改任何东西）。目录缺失返回空数组。 */
function walkFiles(rootDir) {
  const files = [];
  const walk = dir => {
    let dirents;
    try {
      dirents = fs.readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      if (error && error.code === 'ENOENT') return;
      throw error;
    }
    for (const dirent of dirents) {
      const childPath = path.join(dir, dirent.name);
      if (dirent.isDirectory()) {
        walk(childPath);
        continue;
      }
      if (!dirent.isFile()) continue;
      let stats = null;
      try {
        stats = fs.statSync(childPath);
      } catch (error) {
        if (error && error.code !== 'ENOENT') throw error;
      }
      if (stats) files.push({ path: childPath, size: stats.size, mtimeMs: stats.mtimeMs });
    }
  };
  if (fs.existsSync(rootDir)) walk(rootDir);
  return files;
}

function summarize(entries) {
  return {
    fileCount: entries.length,
    totalBytes: entries.reduce((sum, entry) => sum + entry.size, 0),
  };
}

function openReadonlyDb(dbPath) {
  if (!fs.existsSync(dbPath)) return { db: null, reason: 'works.db 不存在 (' + dbPath + ')' };
  try {
    // 延迟加载，未安装 better-sqlite3 时脚本仍可输出纯体积统计。
    const Database = require('better-sqlite3');
    return { db: new Database(dbPath, { readonly: true, fileMustExist: false }) };
  } catch (error) {
    return { db: null, reason: '无法只读打开 works.db: ' + (error && error.message) };
  }
}

/**
 * 与 retentionService.markExpired 同一套到期公式。
 * 返回 Map<assetId(小写), Array<row>>。
 */
function loadAssetRetentionIndex(db) {
  const index = new Map();
  if (!db) return index;
  const hasTable = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'project_assets'").get();
  if (!hasTable) return index;
  const rows = db.prepare(
    'SELECT asset_id, retention_class, retention_state, retention_pinned, expires_at, created_at FROM project_assets',
  ).all();
  for (const row of rows) {
    const key = String(row.asset_id || '').trim().toLowerCase();
    if (!key) continue;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(row);
  }
  return index;
}

function computeExpiryMs(row, retentionMs) {
  const explicit = Date.parse(row.expires_at);
  if (Number.isFinite(explicit)) return explicit;
  const created = Date.parse(row.created_at);
  if (!Number.isFinite(created)) return NaN;
  return created + (retentionMs[row.retention_class] || retentionMs.completed);
}

/**
 * 单个原图文件的 retention 分级：
 *   pinned     —— retention_pinned=1 或 permanent 类（受保护，不清）
 *   temporary / unfinished / completed —— 未到期的活跃资产（按最近到期行的类别归档）
 *   expired    —— 所有引用行均已到期或处于 deleted 状态（retention 服务最终回收的对象）
 *   untracked  —— 数据库无记录（需人工确认的历史遗留）
 */
function classifyOriginalFile(assetFileName, rowIndex, nowMs, retentionMs) {
  const rows = rowIndex.get(String(assetFileName).toLowerCase());
  if (!rows || !rows.length) return 'untracked';
  if (rows.some(row => Number(row.retention_pinned) === 1 || row.retention_class === 'permanent')) return 'pinned';
  const liveRows = rows.filter(row => String(row.retention_state) !== 'deleted');
  const futureRows = liveRows
    .map(row => ({ row, expiryMs: computeExpiryMs(row, retentionMs) }))
    .filter(entry => Number.isFinite(entry.expiryMs) && entry.expiryMs > nowMs)
    .sort((left, right) => left.expiryMs - right.expiryMs);
  if (futureRows.length) {
    const retentionClass = futureRows[0].row.retention_class;
    return ['temporary', 'unfinished', 'completed'].includes(retentionClass) ? retentionClass : 'completed';
  }
  return 'expired';
}

async function main() {
  const nowMs = Date.now();
  let retentionMs;
  let retentionImportNote = '';
  try {
    const retentionModuleUrl = pathToFileURL(path.join(SERVER_DIR, 'projects', 'retentionService.mjs')).href;
    ({ RETENTION_MS: retentionMs } = await import(retentionModuleUrl));
  } catch (error) {
    // 与 retentionService 相同的内置常量兜底，保证脚本仍能输出分级。
    retentionMs = { temporary: 24 * HOUR_MS, unfinished: 7 * 24 * HOUR_MS, completed: 30 * 24 * HOUR_MS };
    retentionImportNote = 'retentionService.mjs 导入失败，使用内置同值常量: ' + (error && error.message);
  }

  const originals = walkFiles(GENERATED_ROOT).filter(entry => !entry.path.startsWith(DERIVATIVES_ROOT + path.sep));
  const derivatives = walkFiles(DERIVATIVES_ROOT);
  const proxyCache = walkFiles(PROXY_CACHE_ROOT);

  const { db, reason: dbReason } = openReadonlyDb(WORKS_DB_PATH);
  let retentionIndex = new Map();
  let classificationNote = '';
  if (db) {
    try {
      retentionIndex = loadAssetRetentionIndex(db);
    } catch (error) {
      classificationNote = 'project_assets 读取失败，原图分级降级为 untracked: ' + (error && error.message);
    }
  } else {
    classificationNote = '数据库不可用（' + dbReason + '），原图分级降级为 untracked';
  }
  if (db) {
    try { db.close(); } catch { /* 忽略关闭错误 */ }
  }

  const originalBuckets = { temporary: [], unfinished: [], completed: [], pinned: [], expired: [], untracked: [] };
  for (const entry of originals) {
    const bucket = classificationNote
      ? 'untracked'
      : classifyOriginalFile(path.basename(entry.path), retentionIndex, nowMs, retentionMs);
    (originalBuckets[bucket] || originalBuckets.untracked).push(entry);
  }

  const staleThreshold = nowMs - PROXY_TTL_MS;
  const proxyStale = proxyCache.filter(entry => entry.mtimeMs < staleThreshold);
  const derivativeStale = derivatives.filter(entry => entry.mtimeMs < staleThreshold);
  const derivativeExcessBytes = Math.max(0, summarize(derivatives).totalBytes - DERIVATIVES_MAX_BYTES);

  const report = {
    generatedAt: new Date(nowMs).toISOString(),
    readOnly: true,
    serverDir: SERVER_DIR,
    config: {
      proxyCacheTtlHours: PROXY_TTL_MS / HOUR_MS,
      derivativesMaxBytes: DERIVATIVES_MAX_BYTES,
    },
    totals: {
      generatedAssets: summarize(originals),
      derivativesCache: summarize(derivatives),
      proxyCache: summarize(proxyCache),
    },
    generatedAssetsByRetention: Object.fromEntries(
      Object.entries(originalBuckets).map(([bucket, entries]) => [bucket, summarize(entries)]),
    ),
    cleanableEstimate: {
      generatedAssetsExpiredAndUntracked: summarize([...originalBuckets.expired, ...originalBuckets.untracked]),
      derivativesEntireCache: summarize(derivatives),
      derivativesOverCapacityBytes: derivativeExcessBytes,
      proxyCacheOlderThanTtl: summarize(proxyStale),
      proxyCacheEntireCache: summarize(proxyCache),
    },
    ageBuckets: {
      ttlMs: PROXY_TTL_MS,
      derivativesOlderThanTtl: summarize(derivativeStale),
      proxyOlderThanTtl: summarize(proxyStale),
    },
    notes: [retentionImportNote, classificationNote].filter(Boolean),
  };

  if (AS_JSON) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const line = '='.repeat(64);
  console.log(line);
  console.log('薯包磁盘占用盘点（只读，不删除任何文件）');
  console.log('时间: ' + report.generatedAt + '    目录: ' + SERVER_DIR);
  console.log('策略: PROXY_CACHE_TTL_HOURS=' + report.config.proxyCacheTtlHours
    + 'h  DERIVATIVES_MAX_BYTES=' + formatBytes(report.config.derivativesMaxBytes));
  console.log(line);

  const row = (label, summary) => console.log(
    label.padEnd(36) + String(summary.fileCount).padStart(8) + ' 个文件' + formatBytes(summary.totalBytes).padStart(12),
  );
  console.log('');
  console.log('[总体积]');
  row('generated-assets/（原图）', report.totals.generatedAssets);
  row('generated-assets/.derivatives/', report.totals.derivativesCache);
  row('cache_img/（外链代理缓存）', report.totals.proxyCache);

  console.log('');
  console.log('[原图 retention 分级]（口径同 server/projects/retentionService.mjs）');
  for (const bucket of ['temporary', 'unfinished', 'completed', 'pinned', 'expired', 'untracked']) {
    row('  ' + bucket, report.generatedAssetsByRetention[bucket]);
  }

  console.log('');
  console.log('[可清理量级估算]（仅供人工决策，本脚本不做任何删除）');
  row('  原图 expired（已到期）', report.generatedAssetsByRetention.expired);
  row('  原图 untracked（无库记录）', report.generatedAssetsByRetention.untracked);
  row('  .derivatives 整体（可重建）', report.cleanableEstimate.derivativesEntireCache);
  row('  .derivatives 超容量部分(字节)', { fileCount: 0, totalBytes: report.cleanableEstimate.derivativesOverCapacityBytes });
  row('  cache_img 超 TTL 部分', report.cleanableEstimate.proxyCacheOlderThanTtl);
  row('  cache_img 整体（可重拉）', report.cleanableEstimate.proxyCacheEntireCache);
  console.log('  （"超容量部分"只计字节；实际淘汰文件数由 LRU 从最旧开始决定）');

  if (report.notes.length) {
    console.log('');
    console.log('[提示]');
    for (const note of report.notes) console.log('  - ' + note);
  }
  console.log(line);
}

main().then(() => {
  process.exitCode = 0;
}, error => {
  console.error('[audit-disk-usage] 盘点失败:', (error && error.stack) || error);
  process.exitCode = 1;
});
