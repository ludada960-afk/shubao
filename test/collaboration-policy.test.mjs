import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  APPROVED_CODEX_GIT_PREFIX,
  classifyWorkspacePath,
  createCollaborationReport,
  formatCollaborationReport,
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
  assert.match(deploy, /\.shubao-deploy\.lock/);
  assert.match(deploy, /try\s*\{/);
  assert.match(deploy, /finally\s*\{/);
  assert.match(deploy, /Release remote deployment lock/);
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
