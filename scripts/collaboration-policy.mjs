import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

export const APPROVED_CODEX_GIT_PREFIX =
  'git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability';

/* ═══ 2026-10-04 批之二十四续：判据**从清单文件读**，不在代码里写死 ═══════════════════════════════
   原来这里写着 `branch.startsWith('codex/')` —— 那是早期的单线约定，后来项目按 RTK 批之十四条
   改成「多条工作线 + 唯一一条发布线」，判据却没跟着改。结果连**项目自己的发布线
   gm/release-merge-1001 都被判 BLOCKED**（实测：branches 全对、runtime 0、ownership 0，
   只因名字不是 codex/ 前缀）。
   ⇒ 名单搬进 docs/collaboration/lines.json，代码只负责读。清单里还有 worktrees[].owns ——
      那让 ownership 判据第一次真的跑起来（原来 CLI 从不传 ownedPaths/peerOwnedPaths，
      overlappingPaths 恒为 0，等于一个永远显示"通过"的空检查）。 */
export const DEFAULT_BRANCH_POLICY = Object.freeze({
  releaseBranch: 'gm/release-merge-1001',
  workBranchPrefixes: ['codex/', 'deploy/', 'glm/', 'glm52/', 'cy/'],
});

export function loadLinesManifest(repoRoot) {
  const file = path.join(repoRoot, 'docs', 'collaboration', 'lines.json');
  if (!fs.existsSync(file)) {
    return { policy: DEFAULT_BRANCH_POLICY, scopes: [], source: '(内置默认，清单文件不存在)' };
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const policy = raw.policy || raw;
  return {
    policy: {
      releaseBranch: policy.releaseBranch || DEFAULT_BRANCH_POLICY.releaseBranch,
      workBranchPrefixes: Array.isArray(policy.workBranchPrefixes) && policy.workBranchPrefixes.length
        ? policy.workBranchPrefixes
        : DEFAULT_BRANCH_POLICY.workBranchPrefixes,
    },
    scopes: Array.isArray(raw.scopes) ? raw.scopes : [],
    source: file,
  };
}

/** 这条分支是「有权部署的那条」，还是「只开发不部署的工作线」？ */
export function classifyBranch(branch, policy = DEFAULT_BRANCH_POLICY) {
  const name = String(branch || '');
  if (name && name === policy.releaseBranch) return 'release';
  if (name && policy.workBranchPrefixes.some(prefix => name.startsWith(prefix))) return 'work';
  return 'unknown';
}

/** 清单里哪一片是「当前这片」，其余的 owns 合起来就是 peerOwnedPaths。
    ⚠️ 按 **scope** 分而不是按工作树分：两条并发会话实测共用同一棵工作树
       （`.worktrees/codex-ecommerce-stability`），按树分谁也认不出谁是谁。 */
export function ownershipFor(manifest, { worktreePath, branch, scopeId = '' }) {
  const norm = value => String(value || '').replace(/\\/g, '/').replace(/\/+$/, '');
  const here = norm(worktreePath);
  const tail = here.slice(here.lastIndexOf('/') + 1);
  const scopes = manifest.scopes || [];
  const match = scopeId
    ? scopes.find(entry => entry.id === scopeId) || null
    : scopes.find(entry => {
      const candidate = norm(entry.worktree);
      if (candidate && (candidate === here || candidate.endsWith(`/${tail}`) || candidate === tail)) return true;
      return Boolean(entry.branch) && entry.branch === branch;
    }) || null;
  const owned = match ? (match.owns || []) : [];
  const peers = scopes.filter(entry => entry !== match).flatMap(entry => entry.owns || []);
  return { entry: match, ownedPaths: owned, peerOwnedPaths: peers };
}

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
  policy = DEFAULT_BRANCH_POLICY,
  ownershipSource = '(未提供)',
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
  const branchKind = classifyBranch(branch, policy);
  /* ⚠️ 判据跟着 RTK 批之十四条走：发布线与工作线**都**算合法分支（分开工作线是对的）。
     只有「既不是发布线、也不是清单里列的工作线前缀」才是 BLOCKED ——
     那是 detached HEAD 之外真正走错地方的情况（比如手滑在 master 上开工）。 */
  const branchReady = branchKind !== 'unknown';
  const ready = Boolean(isLinkedWorktree && branchReady && trackedRuntimePaths.length === 0 && overlappingPaths.length === 0);

  return {
    ready,
    branch,
    branchKind,
    isLinkedWorktree,
    branchReady,
    trackedRuntimePaths,
    ignoredRuntimeChanges,
    overlappingPaths,
    approvedGitPrefix: APPROVED_CODEX_GIT_PREFIX,
    ownershipSource,
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

export function inspectRepository(repoPath, { ownedPaths = [], peerOwnedPaths = [], policy, scopeId = '' } = {}) {
  const root = path.resolve(repoPath);
  const gitDir = path.resolve(root, git(root, 'rev-parse', '--git-dir'));
  const gitCommonDir = path.resolve(root, git(root, 'rev-parse', '--git-common-dir'));
  const manifest = loadLinesManifest(root);
  const branch = git(root, 'branch', '--show-current');
  /* ownership：调用方显式给了就用；没给就从清单里按「当前这棵工作树 + 分支」推 ——
     原来这里默认空数组，等于那个判据从来没跑过（overlappingPaths 恒为 0）。 */
  const inferred = ownershipFor(manifest, { worktreePath: root, branch, scopeId });
  return createCollaborationReport({
    branch,
    isLinkedWorktree: gitDir !== gitCommonDir,
    trackedPaths: lines(git(root, 'ls-files')),
    changedPaths: parseStatusPaths(git(root, 'status', '--porcelain')),
    ownedPaths: ownedPaths.length ? ownedPaths : inferred.ownedPaths,
    peerOwnedPaths: peerOwnedPaths.length ? peerOwnedPaths : inferred.peerOwnedPaths,
    policy: policy || manifest.policy,
    ownershipSource: ownedPaths.length || peerOwnedPaths.length
      ? '(调用方显式传入)'
      : `${manifest.source}${inferred.entry ? ` → 本片=${inferred.entry.id}` : ' → 本片未登记（owns 视为空）'}`,
  });
}

export function formatCollaborationReport(report) {
  const state = report.ready ? 'READY' : 'BLOCKED';
  const kindLabel = { release: '发布线（唯一有权部署）', work: '工作线（只开发，不部署）', unknown: '未登记的分支' };
  const lines = [
    `[collaboration] ${state}`,
    `branch: ${report.branch || '(detached)'}  → ${kindLabel[report.branchKind] || '未知'}`,
    `linked worktree: ${report.isLinkedWorktree ? 'yes' : 'no'}`,
    `tracked runtime paths: ${report.trackedRuntimePaths.length}`,
    `ignored runtime changes: ${report.ignoredRuntimeChanges.length}`,
    `peer ownership conflicts: ${report.overlappingPaths.length}`,
    `ownership source: ${report.ownershipSource}`,
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
