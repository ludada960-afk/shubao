// 4c183cd4 续命 P3 模板社区 - 使用率统计 (likes/downloads 真持久化)
//
// 设计: 用 JSON 文件持久化, 不依赖 db schema 改动.
// 启动时 load, 内存 + 文件双写, fsync 同步, 单写锁防并发.
// 关键函数:
//   loadUsageStats({ filePath, baseLikes, baseDownloads })
//   incrementLike(stats, tplId)
//   incrementDownload(stats, tplId)
//   snapshotUsage(stats, tplId, baseLikes, baseDownloads)
//   listUsage(stats) -> { [tplId]: { likes, downloads } }

import fs from 'node:fs';
import path from 'node:path';

function emptyCounters() {
  return Object.create(null);
}

function readCountersFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return emptyCounters();
    return parsed;
  } catch (error) {
    if (error?.code === 'ENOENT') return emptyCounters();
    // 损坏的 JSON 不应让整个服务挂掉, 重新开始
    return emptyCounters();
  }
}

function writeCountersFile(filePath, counters) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(counters, null, 2));
  fs.renameSync(tmp, filePath);
}

export function loadUsageStats({ filePath, baseLikes = {}, baseDownloads = {} } = {}) {
  if (!filePath) throw new TypeError('filePath is required');
  const counters = readCountersFile(filePath);
  const initial = emptyCounters();
  for (const tplId of Object.keys(counters)) {
    const row = counters[tplId];
    if (!row || typeof row !== 'object') continue;
    initial[tplId] = {
      likes: Number.isFinite(row.likes) ? Math.max(0, Math.floor(row.likes)) : 0,
      downloads: Number.isFinite(row.downloads) ? Math.max(0, Math.floor(row.downloads)) : 0,
    };
  }
  // 保证 baseLikes / baseDownloads 中的 key 存在, 不覆盖已有计数
  for (const tplId of Object.keys(baseLikes || {})) {
    if (!initial[tplId]) initial[tplId] = { likes: 0, downloads: 0 };
  }
  for (const tplId of Object.keys(baseDownloads || {})) {
    if (!initial[tplId]) initial[tplId] = { likes: 0, downloads: 0 };
  }
  return {
    filePath,
    counters: initial,
    async incrementLike(tplId) {
      return incrementCounter({ stats: this, tplId, key: 'likes' });
    },
    async incrementDownload(tplId) {
      return incrementCounter({ stats: this, tplId, key: 'downloads' });
    },
    snapshot(tplId) {
      return snapshotUsage({ stats: this, tplId, baseLikes, baseDownloads });
    },
    list() {
      return listUsage({ stats: this, baseLikes, baseDownloads });
    },
  };
}

async function incrementCounter({ stats, tplId, key }) {
  if (!tplId || typeof tplId !== 'string') {
    throw new TypeError('tplId must be a non-empty string');
  }
  if (!stats?.counters) throw new TypeError('stats is not initialized');
  const current = stats.counters[tplId] || { likes: 0, downloads: 0 };
  const next = Math.max(0, (Number(current[key]) || 0) + 1);
  stats.counters[tplId] = { ...current, [key]: next };
  writeCountersFile(stats.filePath, stats.counters);
  return stats.counters[tplId];
}

export function snapshotUsage({ stats, tplId, baseLikes = {}, baseDownloads = {} } = {}) {
  if (!tplId) return { likes: 0, downloads: 0 };
  const live = stats?.counters?.[tplId] || { likes: 0, downloads: 0 };
  const baseL = Number(baseLikes[tplId]) || 0;
  const baseD = Number(baseDownloads[tplId]) || 0;
  return {
    likes: Math.max(0, baseL + (Number(live.likes) || 0)),
    downloads: Math.max(0, baseD + (Number(live.downloads) || 0)),
  };
}

export function listUsage({ stats, baseLikes = {}, baseDownloads = {} } = {}) {
  const all = new Set([
    ...Object.keys(stats?.counters || {}),
    ...Object.keys(baseLikes || {}),
    ...Object.keys(baseDownloads || {}),
  ]);
  const out = Object.create(null);
  for (const tplId of all) {
    out[tplId] = snapshotUsage({ stats, tplId, baseLikes, baseDownloads });
  }
  return out;
}
