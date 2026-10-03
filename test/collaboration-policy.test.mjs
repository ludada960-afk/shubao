import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  APPROVED_CODEX_GIT_PREFIX,
  classifyBranch,
  classifyWorkspacePath,
  createCollaborationReport,
  DEFAULT_BRANCH_POLICY,
  formatCollaborationReport,
  loadLinesManifest,
  ownershipFor,
} from '../scripts/collaboration-policy.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('classifies generated and runtime paths as forbidden for commits', () => {
  for (const path of [
    'dist/index.html',
    'dist/assets/index-demo.js',
    'server/works.db',
    'server/works.db-shm',
    'server/works.db-wal',
    'server/uploads/a.png',
    'server/cache_img/a.webp',
    'server/generated-assets/a.png',
  ]) {
    assert.equal(classifyWorkspacePath(path), 'runtime', path);
  }
  assert.equal(classifyWorkspacePath('server/billing/catalog.mjs'), 'source');
});

test('publishes the exact approved git prefix used by Codex', () => {
  assert.equal(
    APPROVED_CODEX_GIT_PREFIX,
    'git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability',
  );
});

test('collaboration report blocks tracked runtime files and overlapping ownership', () => {
  const report = createCollaborationReport({
    branch: 'codex/ecommerce-stability',
    isLinkedWorktree: true,
    trackedPaths: ['server/works.db', 'src/pages/Home/EcMode.jsx'],
    changedPaths: ['server/works.db-wal', 'server/billing/catalog.mjs'],
    ownedPaths: ['server/billing/'],
    peerOwnedPaths: ['src/components/billing/'],
  });

  assert.deepEqual(report.trackedRuntimePaths, ['server/works.db']);
  assert.deepEqual(report.ignoredRuntimeChanges, ['server/works.db-wal']);
  assert.deepEqual(report.overlappingPaths, []);
  assert.equal(report.ready, false);

  const overlap = createCollaborationReport({
    branch: 'codex/ecommerce-stability',
    isLinkedWorktree: true,
    trackedPaths: [],
    changedPaths: ['src/components/billing/BillingBalanceCard.jsx'],
    ownedPaths: ['server/'],
    peerOwnedPaths: ['src/components/billing/'],
  });
  assert.deepEqual(overlap.overlappingPaths, ['src/components/billing/BillingBalanceCard.jsx']);
  assert.equal(overlap.ready, false);
});

test('repository publishes one durable AI collaboration entrypoint', () => {
  assert.equal(readFileSync(path.join(repoRoot, 'AGENTS.md'), 'utf8').trim(), '@RTK.md');
  const protocol = readFileSync(path.join(repoRoot, 'RTK.md'), 'utf8');
  for (const required of [
    'codex/ecommerce-stability',
    APPROVED_CODEX_GIT_PREFIX,
    '.superpowers/sdd/progress.md',
    'server/works.db',
    'GLM',
    '部署锁',
  ]) {
    assert.match(protocol, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['collab:check'], 'node scripts/collaboration-policy.mjs');
});

test('production deployment script enforces a remote deployment lock', () => {
  const deploy = readFileSync(path.join(repoRoot, 'scripts', 'deploy-production.ps1'), 'utf8');
  assert.match(deploy, /\.shubao-deploy-v2\.lock/);
  assert.match(deploy, /try\s*\{/);
  assert.match(deploy, /finally\s*\{/);
  assert.match(deploy, /Released remote deployment lock/);
});

test('preflight output stays concise when many runtime files exist', () => {
  const output = formatCollaborationReport({
    ready: true,
    branch: 'codex/ecommerce-stability',
    isLinkedWorktree: true,
    branchReady: true,
    trackedRuntimePaths: [],
    ignoredRuntimeChanges: Array.from({ length: 50 }, (_, index) => `dist/file-${index}.js`),
    overlappingPaths: [],
    approvedGitPrefix: APPROVED_CODEX_GIT_PREFIX,
  });
  assert.match(output, /READY/);
  assert.match(output, /ignored runtime changes: 50/);
  assert.doesNotMatch(output, /file-49/);
});

/* ═══ 2026-10-04：判据从「分支名必须以 codex/ 开头」改成**读清单** ═══════════════════════════════════
   原来那条把项目自己的发布线 gm/release-merge-1001 判成 BLOCKED（实测：其余判据全绿，
   只因名字不是 codex/ 前缀）。RTK 批之十四条已经把形态改成「多条工作线 + 唯一一条发布线」，
   判据没跟着改。这几条把它钉住。 */
test('① 发布线与工作线都算合法分支，只有未登记的才 BLOCKED', () => {
  assert.equal(classifyBranch('gm/release-merge-1001'), 'release');
  assert.equal(classifyBranch('deploy/aigc-1003'), 'work');
  assert.equal(classifyBranch('codex/ecommerce-stability'), 'work');
  assert.equal(classifyBranch('glm/canvas-node-ui-v2'), 'work');
  /* detached / 手滑在别处开工 ⇒ unknown ⇒ BLOCKED（这一条才是这条判据真正要拦的） */
  assert.equal(classifyBranch(''), 'unknown');
  assert.equal(classifyBranch('master'), 'unknown');
  assert.equal(classifyBranch('随手起的一条'), 'unknown');

  for (const branch of ['gm/release-merge-1001', 'deploy/aigc-1003', 'codex/ecommerce-stability']) {
    const report = createCollaborationReport({ branch, isLinkedWorktree: true, trackedPaths: [], changedPaths: [] });
    assert.equal(report.ready, true, `${branch} 不该被判 BLOCKED`);
  }
  const stray = createCollaborationReport({ branch: 'master', isLinkedWorktree: true, trackedPaths: [], changedPaths: [] });
  assert.equal(stray.ready, false, '未登记的分支必须 BLOCKED');
  assert.equal(stray.branchKind, 'unknown');
});

test('② 清单是唯一事实源：发布线与 deploy 脚本的 -ReleaseBranch 必须一致', () => {
  const manifest = loadLinesManifest(repoRoot);
  assert.match(manifest.source, /docs[\\/]collaboration[\\/]lines\.json$/, '判据必须来自清单文件，不许硬编码');
  assert.equal(manifest.policy.releaseBranch, DEFAULT_BRANCH_POLICY.releaseBranch);

  const deploy = readFileSync(path.join(repoRoot, 'scripts', 'deploy-production.ps1'), 'utf8');
  const defaultBranch = (deploy.match(/\$ReleaseBranch\s*=\s*'([^']+)'/) || [])[1];
  assert.equal(defaultBranch, manifest.policy.releaseBranch,
    'deploy-production.ps1 的 -ReleaseBranch 与清单里的 releaseBranch 不一致 —— 部署线到底在哪条，两处必须说同一句话');
});

test('③ ownership 判据真的接上了（原来 CLI 从不传参 ⇒ 恒为 0，等于空检查）', () => {
  const manifest = loadLinesManifest(repoRoot);
  assert.ok(manifest.scopes.length >= 2, '清单里至少要有两片，否则 peer 判据还是空的');

  const mine = ownershipFor(manifest, { worktreePath: 'F:/da/shubao/.worktrees/codex-ecommerce-stability', branch: 'deploy/aigc-1003' });
  assert.ok(mine.entry, '认不出当前这片');
  assert.equal(mine.entry.id, 'workbench-parity-1004');
  assert.ok(mine.ownedPaths.length > 0, '本片的 owns 不该是空的');
  assert.ok(mine.peerOwnedPaths.length > 0, 'peer 的 owns 不该是空的 —— 空的话这个判据抓不住任何东西');
  assert.deepEqual(
    mine.peerOwnedPaths,
    manifest.scopes.filter(e => e !== mine.entry).flatMap(e => e.owns || []),
  );

  /* 落在我 owns 里的文件改动 ⇒ 不算冲突（那是我自己的活） */
  const ownPath = mine.ownedPaths.find(p => p.endsWith('/'));
  const own = createCollaborationReport({
    branch: 'deploy/aigc-1003', isLinkedWorktree: true, trackedPaths: [],
    changedPaths: [ownPath + 'SomeFile.jsx'],
    ownedPaths: mine.ownedPaths, peerOwnedPaths: mine.peerOwnedPaths,
  });
  assert.deepEqual(own.overlappingPaths, [], '自己 owns 范围内的改动不算 ownership 冲突');

  /* 落在 peer owns 里的文件改动 ⇒ 必须被抓出来，否则这个检查等于没有 */
  const peerPath = mine.peerOwnedPaths.find(p => p.endsWith('/'));
  const conflict = createCollaborationReport({
    branch: 'deploy/aigc-1003', isLinkedWorktree: true, trackedPaths: [],
    changedPaths: [peerPath + 'SomebodyElves.jsx'],
    ownedPaths: mine.ownedPaths, peerOwnedPaths: mine.peerOwnedPaths,
  });
  assert.equal(conflict.overlappingPaths.length, 1, '改了别人 owns 里的文件必须报冲突');
  assert.equal(conflict.ready, false);
});

test('④ 两条并发会话共用一棵工作树 —— 所以归属必须按 scope 分，不能按工作树', () => {
  const manifest = loadLinesManifest(repoRoot);
  const sameTree = manifest.scopes.filter(s => s.worktree === 'codex-ecommerce-stability');
  assert.ok(sameTree.length >= 2,
    '清单里应当能看到"同一棵工作树被两个 scope 同时认领"这一现实，否则这份清单没有描述真实情况');
  const a = ownershipFor(manifest, { worktreePath: 'F:/da/shubao/.worktrees/codex-ecommerce-stability', branch: 'deploy/aigc-1003', scopeId: 'workbench-parity-1004' });
  const b = ownershipFor(manifest, { worktreePath: 'F:/da/shubao/.worktrees/codex-ecommerce-stability', branch: 'deploy/aigc-1003', scopeId: 'nano-model-single-source' });
  assert.notEqual(a.entry.id, b.entry.id);
  assert.ok(b.peerOwnedPaths.includes('src/pages/VideoStudio/'), '反过来看，A 那片应当出现在 B 的 peer 里');
  assert.ok(a.peerOwnedPaths.includes('server/ecommerceEngine/'), 'A 的 peer 里应当有 B 那片');
});
