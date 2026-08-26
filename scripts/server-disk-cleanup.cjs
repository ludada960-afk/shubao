#!/usr/bin/env node
/**
 * 服务器磁盘治理 · 只读盘点版（2026-08-26 生产演练裁定项③的部署侧准备）。
 *
 * 用途：下次部署前在服务器上执行，产出磁盘占用清单与「可清理候选」建议。
 * 红线：本脚本绝不删除、移动或写入任何业务文件；所有清理动作只打印为
 *       「建议命令」文本，由运维人工复核后自行执行。
 *
 * 盘点范围（均可经环境变量覆盖）：
 *   - SHUBAO_ROOT（默认 /home/ubuntu/shubao）
 *       releases/            每个发布目录体积与时间；保留最新 KEEP_RELEASES 个，其余列为候选
 *       deploy-backups/      部署备份目录（全部列为候选，需人工确认保留策略）
 *       server/works.db(+wal/shm)
 *       server/generated-assets/   用户资产数据 —— 标记 NEVER-DELETE，仅报体积
 *       server/generated-assets/.derivatives/  可重建派生缓存（候选）
 *       server/cache_img/          外链代理缓存，TTL 过期部分可清（候选）
 *       server/video-upload-staging/ server/temp_uploads/  上传暂存（候选）
 *   - /tmp/shubao-deploy-*.tgz 与 /tmp/shubao-runtime-tools-*（历史部署遗留）
 *   - ~/.npm/_cacache（npm 缓存，npm ci 前可清出临时空间）
 *
 * 用法：
 *   node scripts/server-disk-cleanup.cjs [--json]
 *   SHUBAO_ROOT=/home/ubuntu/shubao KEEP_RELEASES=2 node scripts/server-disk-cleanup.cjs
 *
 * 退出码恒为 0（纯盘点）；单项目录读取失败会记入 errors 字段继续。
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const AS_JSON = process.argv.slice(2).includes('--json');
const SHUBAO_ROOT = path.resolve(process.env.SHUBAO_ROOT || '/home/ubuntu/shubao');
const SERVER_DIR = path.join(SHUBAO_ROOT, 'server');
const KEEP_RELEASES = Math.max(0, Number(process.env.KEEP_RELEASES || 2) || 2);
const HOUR_MS = 60 * 60 * 1000;
const PROXY_TTL_MS = (Number(process.env.PROXY_CACHE_TTL_HOURS || 72) || 72) * HOUR_MS;

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) { value /= 1024; unitIndex += 1; }
  return (value >= 100 || unitIndex === 0 ? String(Math.round(value)) : value.toFixed(1)) + ' ' + units[unitIndex];
}

function walkStats(rootDir) {
  let totalBytes = 0;
  let fileCount = 0;
  let oldestMtimeMs = Number.POSITIVE_INFINITY;
  const visit = dir => {
    let dirents;
    try { dirents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const dirent of dirents) {
      const childPath = path.join(dir, dirent.name);
      if (dirent.isDirectory()) { visit(childPath); continue; }
      if (!dirent.isFile()) continue;
      let stats = null;
      try { stats = fs.statSync(childPath); } catch { continue; }
      totalBytes += stats.size;
      fileCount += 1;
      if (stats.mtimeMs < oldestMtimeMs) oldestMtimeMs = stats.mtimeMs;
    }
  };
  if (fs.existsSync(rootDir)) visit(rootDir);
  return { totalBytes, fileCount, oldestMtimeMs };
}

function entry(dirOrGlobLabel, absPath, disposition, extra = {}) {
  const exists = fs.existsSync(absPath);
  const stats = exists ? walkStats(absPath) : { totalBytes: 0, fileCount: 0, oldestMtimeMs: Number.POSITIVE_INFINITY };
  return {
    label: dirOrGlobLabel,
    path: absPath,
    exists,
    bytes: stats.totalBytes,
    files: stats.fileCount,
    oldestAt: Number.isFinite(stats.oldestMtimeMs) ? new Date(stats.oldestMtimeMs).toISOString() : null,
    disposition, // keep | candidate | never-delete | observe
    ...extra,
  };
}

function listReleases(releasesDir) {
  if (!fs.existsSync(releasesDir)) return [];
  let names = [];
  try { names = fs.readdirSync(releasesDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name); } catch { return []; }
  const rows = names.map(name => {
    const dirPath = path.join(releasesDir, name);
    const stats = walkStats(dirPath);
    let mtimeMs = stats.oldestMtimeMs;
    try { mtimeMs = Math.min(mtimeMs, fs.statSync(dirPath).mtimeMs); } catch {}
    return { name, path: dirPath, bytes: stats.totalBytes, files: stats.fileCount, mtimeMs };
  }).sort((left, right) => right.mtimeMs - left.mtimeMs);
  // 最新 KEEP_RELEASES 个保留，其余按演练口径列为候选（人工确认后手动删除）。
  return rows.map((row, index) => ({
    ...row,
    disposition: index < KEEP_RELEASES ? 'keep' : 'candidate',
    oldestAt: Number.isFinite(row.mtimeMs) ? new Date(row.mtimeMs).toISOString() : null,
  }));
}

function main() {
  const errors = [];
  const entries = [];

  entries.push(entry('releases/(全部)', path.join(SHUBAO_ROOT, 'releases'), 'observe'));
  const releases = listReleases(path.join(SHUBAO_ROOT, 'releases'));
  for (const release of releases) {
    entries.push({
      label: `releases/${release.name}`,
      path: release.path,
      exists: true,
      bytes: release.bytes,
      files: release.files,
      oldestAt: release.oldestAt,
      disposition: release.disposition,
    });
  }

  entries.push(entry('deploy-backups/', path.join(SHUBAO_ROOT, 'deploy-backups'), 'candidate', {
    note: '部署前备份；确认当前版本稳定后可清旧',
  }));

  const listTmp = matcher => {
    try {
      return fs.readdirSync('/tmp').filter(name => matcher(name)).map(name => {
        const target = path.join('/tmp', name);
        let bytes = 0;
        try { bytes = fs.statSync(target).size; } catch {}
        return { target, bytes };
      });
    } catch { return []; }
  };
  const tmpDeployPackages = listTmp(name => /^shubao-deploy-.+\.tgz$/.test(name));
  const tmpToolDirs = listTmp(name => name.startsWith('shubao-runtime-tools-'));
  const sumOf = rows => ({ bytes: rows.reduce((sum, row) => sum + row.bytes, 0), count: rows.length });
  const deploySummary = sumOf(tmpDeployPackages);
  const toolSummary = sumOf(tmpToolDirs);
  entries.push({
    label: '/tmp/shubao-deploy-*.tgz',
    path: '/tmp',
    exists: deploySummary.count > 0,
    bytes: deploySummary.bytes,
    files: deploySummary.count,
    oldestAt: null,
    disposition: 'candidate',
    note: '历史部署包；具体文件见 candidateCommands',
  });
  entries.push({
    label: '/tmp/shubao-runtime-tools-*',
    path: '/tmp',
    exists: toolSummary.count > 0,
    bytes: toolSummary.bytes,
    files: toolSummary.count,
    oldestAt: null,
    disposition: 'candidate',
  });
  entries.push(entry('~/.npm/_cacache', path.join(os.homedir(), '.npm', '_cacache'), 'candidate', {
    note: 'npm 缓存；磁盘 <3G 时 npm ci 会失败，可安全清除',
  }));

  entries.push(entry('server/works.db', path.join(SERVER_DIR, 'works.db'), 'never-delete', { note: '生产数据库' }));
  entries.push(entry('server/works.db-wal', path.join(SERVER_DIR, 'works.db-wal'), 'never-delete'));
  entries.push(entry('server/works.db-shm', path.join(SERVER_DIR, 'works.db-shm'), 'never-delete'));
  entries.push(entry('server/generated-assets/', path.join(SERVER_DIR, 'generated-assets'), 'never-delete', {
    note: '用户资产原图（约 GB 级），任何情况下不得删除；长期正解=对象存储+CDN',
  }));
  entries.push(entry('server/generated-assets/.derivatives/', path.join(SERVER_DIR, 'generated-assets', '.derivatives'), 'candidate', {
    note: 'sharp 派生缓存，可由原图重建',
  }));
  entries.push(entry('server/cache_img/', path.join(SERVER_DIR, 'cache_img'), 'candidate', {
    note: `外链代理缓存，TTL ${Math.round(PROXY_TTL_MS / HOUR_MS)}h，过期部分可清`,
  }));
  entries.push(entry('server/temp_uploads/', path.join(SERVER_DIR, 'temp_uploads'), 'candidate'));
  entries.push(entry('server/video-upload-staging/', path.join(SERVER_DIR, 'video-upload-staging'), 'candidate'));

  const tmpDeployTargets = tmpDeployPackages.map(row => row.target);
  const tmpToolTargets = tmpToolDirs.map(row => row.target);

  const candidateCommands = [
    ...releases.filter(row => row.disposition === 'candidate').map(row => `rm -rf ${row.path}`),
    ...tmpDeployTargets.map(target => `rm -f ${target}`),
    ...tmpToolTargets.map(target => `rm -rf ${target}`),
    'rm -rf ~/.npm/_cacache/*',
    `find ${path.join(SERVER_DIR, 'cache_img')} -type f -mmin +${Math.round(PROXY_TTL_MS / 60000)} -delete`,
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    root: SHUBAO_ROOT,
    keepReleases: KEEP_RELEASES,
    readonly: true,
    tmpDeployPackages: tmpDeployTargets,
    tmpToolDirs: tmpToolTargets,
    entries,
    totals: {
      candidateBytes: entries.filter(row => row.disposition === 'candidate').reduce((sum, row) => sum + row.bytes, 0),
      neverDeleteBytes: entries.filter(row => row.disposition === 'never-delete').reduce((sum, row) => sum + row.bytes, 0),
    },
    // 以下仅为建议文本，本脚本不会执行任何删除。
    candidateCommands,
    errors,
  };

  if (AS_JSON) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log('=== 服务器磁盘只读盘点（不删除任何文件） ===');
  console.log('root:', SHUBAO_ROOT, '· 时间:', report.generatedAt, '· 保留最近', KEEP_RELEASES, '个 release');
  console.log('');
  for (const row of entries) {
    if (!row.exists) continue;
    const tag = { keep: '[保留]', candidate: '[候选]', 'never-delete': '[禁删]', observe: '[观测]' }[row.disposition] || '';
    console.log(`${tag} ${formatBytes(row.bytes).padStart(9)}  ${String(row.files).padStart(6)} 文件  ${row.label}${row.note ? '  —— ' + row.note : ''}`);
  }
  if (tmpDeployPackages.length || tmpToolDirs.length) {
    console.log('');
    console.log('/tmp 遗留：');
    for (const item of [...tmpDeployPackages, ...tmpToolDirs]) console.log('  ', item);
  }
  console.log('');
  console.log('可清理候选合计:', formatBytes(report.totals.candidateBytes), '· 禁删数据合计:', formatBytes(report.totals.neverDeleteBytes));
  console.log('');
  console.log('=== 建议命令（仅打印，脚本不会执行；请人工复核后再运行） ===');
  for (const command of candidateCommands) console.log('  ' + command);
}

try {
  main();
} catch (error) {
  // 盘点失败也要给出可诊断输出，但保持只读承诺。
  console.error('[server-disk-cleanup] 盘点失败:', (error && error.stack) || error);
  process.exitCode = 0;
}
