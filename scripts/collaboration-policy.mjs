import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const APPROVED_CODEX_GIT_PREFIX =
  'git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability';

const RUNTIME_PREFIXES = [
  'dist/',
  'server/uploads/',
  'server/cache_img/',
  'server/cache_overlay/',
  'server/generated-assets/',
  'server/temp_uploads/',
];

const RUNTIME_FILES = new Set([
  'server/works.db',
  'server/works.db-shm',
  'server/works.db-wal',
  'server/works.json',
  'server/users.json',
  'server/bookmarklet_store.json',
]);

function normalizePath(value = '') {
  return String(value).replaceAll('\\', '/').replace(/^\.\//, '');
}

export function classifyWorkspacePath(value) {
  const normalized = normalizePath(value);
  if (RUNTIME_FILES.has(normalized)) return 'runtime';
  if (RUNTIME_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return 'runtime';
  return 'source';
}

function belongsTo(pathname, prefixes) {
  const normalized = normalizePath(pathname);
  return prefixes.some((prefix) => {
    const owner = normalizePath(prefix);
    return normalized === owner.replace(/\/$/, '') || normalized.startsWith(owner.endsWith('/') ? owner : `${owner}/`);
  });
}

export function createCollaborationReport({
  branch,
  isLinkedWorktree,
  trackedPaths = [],
  changedPaths = [],
  ownedPaths = [],
  peerOwnedPaths = [],
}) {
  const trackedRuntimePaths = trackedPaths
    .map(normalizePath)
    .filter((entry) => classifyWorkspacePath(entry) === 'runtime')
    .sort();
  const ignoredRuntimeChanges = changedPaths
    .map(normalizePath)
    .filter((entry) => classifyWorkspacePath(entry) === 'runtime')
    .sort();
  const overlappingPaths = changedPaths
    .map(normalizePath)
    .filter((entry) => belongsTo(entry, peerOwnedPaths) && !belongsTo(entry, ownedPaths))
    .sort();
  const branchReady = branch.startsWith('codex/');
  const ready = Boolean(isLinkedWorktree && branchReady && trackedRuntimePaths.length === 0 && overlappingPaths.length === 0);

  return {
    ready,
    branch,
    isLinkedWorktree,
    branchReady,
    trackedRuntimePaths,
    ignoredRuntimeChanges,
    overlappingPaths,
    approvedGitPrefix: APPROVED_CODEX_GIT_PREFIX,
  };
}

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function lines(value) {
  return value ? value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : [];
}

function parseStatusPaths(value) {
  return lines(value).map((line) => normalizePath(line.slice(3).split(' -> ').at(-1)));
}

export function inspectRepository(repoPath, { ownedPaths = [], peerOwnedPaths = [] } = {}) {
  const root = path.resolve(repoPath);
  const gitDir = path.resolve(root, git(root, 'rev-parse', '--git-dir'));
  const gitCommonDir = path.resolve(root, git(root, 'rev-parse', '--git-common-dir'));
  return createCollaborationReport({
    branch: git(root, 'branch', '--show-current'),
    isLinkedWorktree: gitDir !== gitCommonDir,
    trackedPaths: lines(git(root, 'ls-files')),
    changedPaths: parseStatusPaths(git(root, 'status', '--porcelain')),
    ownedPaths,
    peerOwnedPaths,
  });
}

export function formatCollaborationReport(report) {
  const state = report.ready ? 'READY' : 'BLOCKED';
  const lines = [
    `[collaboration] ${state}`,
    `branch: ${report.branch || '(detached)'}`,
    `linked worktree: ${report.isLinkedWorktree ? 'yes' : 'no'}`,
    `tracked runtime paths: ${report.trackedRuntimePaths.length}`,
    `ignored runtime changes: ${report.ignoredRuntimeChanges.length}`,
    `peer ownership conflicts: ${report.overlappingPaths.length}`,
    `approved git prefix: ${report.approvedGitPrefix}`,
  ];
  for (const [label, entries] of [
    ['tracked runtime', report.trackedRuntimePaths],
    ['ownership conflict', report.overlappingPaths],
  ]) {
    for (const entry of entries.slice(0, 10)) lines.push(`${label}: ${entry}`);
    if (entries.length > 10) lines.push(`${label}: ... ${entries.length - 10} more`);
  }
  return `${lines.join('\n')}\n`;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  const repoIndex = process.argv.indexOf('--repo');
  const repoPath = repoIndex >= 0 ? process.argv[repoIndex + 1] : path.resolve(path.dirname(invokedPath), '..');
  const report = inspectRepository(repoPath);
  process.stdout.write(process.argv.includes('--json') ? `${JSON.stringify(report, null, 2)}\n` : formatCollaborationReport(report));
  process.exitCode = report.ready ? 0 : 1;
}
