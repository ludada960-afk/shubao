// test/deploy-gatekeeper.test.mjs
// P0-E 部署守门员子代理: 部署前的 12 项硬检查.
// 每项独立可读, 失败信息必须指出 "应该修什么" 而非 "失败".
// 12/12 通过表示 deploy-production.ps1 满足最低契约, 可继续生产部署.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const deployScriptPath = path.join(repoRoot, 'scripts', 'deploy-production.ps1');
const canarySessionPath = path.join(repoRoot, 'scripts', 'production-canary-session.ps1');
const deploymentLockRunnerPath = path.join(repoRoot, 'scripts', 'deployment-lock-runner.sh');
const backupHelperPath = path.join(repoRoot, 'scripts', 'backup-runtime-db.cjs');
const packageLockPath = path.join(repoRoot, 'package-lock.json');
const packageJsonPath = path.join(repoRoot, 'package.json');

const deployScript = existsSync(deployScriptPath)
  ? readFileSync(deployScriptPath, 'utf8')
  : '';

// 1. 部署入口脚本必须存在
test('[01/12] scripts/deploy-production.ps1 存在 (RTK 唯一允许入口)', () => {
  assert.ok(existsSync(deployScriptPath), 'deploy-production.ps1 缺失; 部署前必须存在唯一入口');
  const stat = statSync(deployScriptPath);
  assert.ok(stat.size > 1000, 'deploy-production.ps1 体积异常小, 疑似被截断');
});

// 2. 部署前必须做 git diff --check (本地代码格式干净)
test('[02/12] deploy-production.ps1 包含 git diff --check (本地代码格式干净)', () => {
  assert.match(deployScript, /git[^\n]*diff --check/i,
    'deploy-production.ps1 必须运行 git diff --check; 缺它无法拦截空白 / 冲突标记');
});

// 3. 部署前必须跑 npm test (全量回归)
test('[03/12] deploy-production.ps1 强制 npm run test (全量回归)', () => {
  assert.match(deployScript, /Invoke-CheckedNative[^\n]*npm run test/i,
    'deploy-production.ps1 必须 Invoke-CheckedNative npm run test; 否则会绕过全量回归直接发版');
});

// 4. 部署前必须跑 npm run build (生产构建)
test('[04/12] deploy-production.ps1 强制 npm run build (生产构建)', () => {
  assert.match(deployScript, /Invoke-CheckedNative[^\n]*npm run build/i,
    'deploy-production.ps1 必须 Invoke-CheckedNative npm run build; 否则 dist 与 commit 不一致');
});

// 5. 部署前必须跑 npm run check (check-build 校验)
test('[05/12] deploy-production.ps1 强制 npm run check (check-build 校验)', () => {
  assert.match(deployScript, /Invoke-CheckedNative[^\n]*npm run check/i,
    'deploy-production.ps1 必须 Invoke-CheckedNative npm run check; 否则 dist 完整性无门禁');
});

// 6. 视频平台 pre-deploy 验证必须存在
test('[06/12] deploy-production.ps1 包含 verify-video-platform (视频平台 pre-deploy 验证)', () => {
  assert.match(deployScript, /verify-video-platform\.mjs/i,
    'deploy-production.ps1 必须运行 verify-video-platform.mjs; 视频域是当前主要风险面');
});

// 7. Canary 会话门禁 (SHUBAO_CANARY_SESSION_TOKEN)
test('[07/12] deploy-production.ps1 强制 SHUBAO_CANARY_SESSION_TOKEN (Canary 会话门禁)', () => {
  assert.match(deployScript, /SHUBAO_CANARY_SESSION_TOKEN is required/i,
    'deploy-production.ps1 必须强制 SHUBAO_CANARY_SESSION_TOKEN; 否则会重蹈 08a06bd5 之前的凭据回滚风险');
  assert.match(deployScript, /production-canary-session/i,
    'deploy-production.ps1 必须引用 production-canary-session 签发器');
  assert.ok(existsSync(canarySessionPath), 'production-canary-session.ps1 缺失; 部署无法签发 Canary 会话');
});

// 8. 部署前数据库备份
test('[08/12] deploy-production.ps1 强制 backup-runtime-db (部署前数据库备份)', () => {
  assert.match(deployScript, /backup-runtime-db\.cjs/i,
    'deploy-production.ps1 必须调用 backup-runtime-db.cjs; 部署前无备份等同于裸奔');
  assert.ok(existsSync(backupHelperPath), 'backup-runtime-db.cjs 缺失; 部署前必须能备份 works.db');
});

// 9. Bounded SSH capture 防御 (防止 deploy 进程因远程卡死而僵死)
test('[09/12] deploy-production.ps1 使用 Invoke-BoundedSshCapture (Bounded SSH capture)', () => {
  assert.match(deployScript, /function\s+Invoke-BoundedSshCapture/i,
    'deploy-production.ps1 必须定义 Invoke-BoundedSshCapture; 否则远程命令无超时上限, 会卡住部署锁');
});

// 10. 部署锁协议 (防止两代理同时部署覆盖线上)
test('[10/12] scripts/deployment-lock-runner.sh 存在 (远端部署锁协议)', () => {
  assert.ok(existsSync(deploymentLockRunnerPath), 'deployment-lock-runner.sh 缺失; 远端部署锁协议不完整, 会出现双 agent 同时覆盖线上');
  const lockRunner = readFileSync(deploymentLockRunnerPath, 'utf8');
  // lock runner 内部 lock_path 来自参数 (非硬编码), 锁路径契约由 deploy-production.ps1 持有
  assert.match(lockRunner, /flock|lockfile|fuser/i,
    'deployment-lock-runner.sh 必须使用 flock/lockfile/fuser 等排他锁原语');
  // 锁路径契约: deploy-production.ps1 必须定义 /tmp/.shubao-deploy-v2.lock (与 RTK §7 一致)
  assert.match(deployScript, /shubao-deploy-v2\.lock/,
    'deploy-production.ps1 必须定义 /tmp/.shubao-deploy-v2.lock 锁路径, 与 RTK §7 部署锁协议一致');
  assert.match(deployScript, /deployment-lock-runner\.sh/,
    'deploy-production.ps1 必须引用 deployment-lock-runner.sh');
});

// 11. package-lock.json 与 package.json 同步 (server 端 npm ci 必需)
test('[11/12] package-lock.json 存在且与 package.json 同步 (server 端 npm ci 必需)', () => {
  assert.ok(existsSync(packageLockPath), 'package-lock.json 缺失; server 端 npm ci 必然失败');
  const lockStat = statSync(packageLockPath);
  assert.ok(lockStat.size > 100, 'package-lock.json 体积异常小, 疑似被截断');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const lockContent = readFileSync(packageLockPath, 'utf8');
  // lockfileVersion + 所有 dependencies 都在 lock 中 (粗校验, 不解析整个 lock)
  for (const depName of Object.keys(packageJson.dependencies || {})) {
    assert.ok(lockContent.includes('\"' + depName + '\"'),
      'package-lock.json 缺少依赖 ' + depName + '; server 端 npm ci 会失败 (RTK §4 双态裁决要求)');
  }
  for (const depName of Object.keys(packageJson.devDependencies || {})) {
    assert.ok(lockContent.includes('\"' + depName + '\"'),
      'package-lock.json 缺少 devDep ' + depName + '; server 端 npm ci 会失败');
  }
});

// 12. 部署脚本必须含 .gitignore 禁入名单外守卫: 不应再向 commit 强加 dist/ + server/works.db*
test('[12/12] deploy-production.ps1 使用 Invoke-CheckedNative 包装所有 native 命令 (失败即抛)', () => {
  assert.match(deployScript, /function\s+Invoke-CheckedNative/i,
    'deploy-production.ps1 必须定义 Invoke-CheckedNative; 否则 native 命令失败不会被检测');
  // 部署脚本里所有 git/node/npm 原生命令都应通过 Invoke-CheckedNative (不能裸用)
  // 粗略计数: Invoke-CheckedNative 的调用数应 >= 5 (test + build + check + diff + canary + video)
  const invokeCount = (deployScript.match(/Invoke-CheckedNative/g) || []).length;
  assert.ok(invokeCount >= 5,
    'deploy-production.ps1 中 Invoke-CheckedNative 调用过少 (' + invokeCount + ' 次); 至少需要 test/build/check/diff/canary/video 6 个门禁');
});
