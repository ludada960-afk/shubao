// test/release-branch-guard-1002.test.mjs
// 2026-10-02：**部署必须从具名发布分支发起**（根因守卫）。
// ─────────────────────────────────────────────────────────────────────────────
// 为什么需要这条：2026-10-01~02 这一天，「刚上线就没了」发生了**十几次**，
// 而**每一次**的根因都一样 —— 有人从 `git worktree add --detach` 建的
// detached 工作树部署。那类提交不在任何分支上，随时与线上分叉。
//
// 之前那道「只进不退」检查挡不住这个：它住在 `scripts/deploy-production.ps1` 里，
// 而对方那次是从一份**更早的脚本**发起的 —— **没有检查的脚本拦不住任何人**。
// ⇒ 只能把"从分叉历史部署"这件事本身变成一条硬规则，且这条规则与"是哪条线"无关。
//
// 另修了一处判据问错对象：只进不退原先拿
// `ls deploy-backups | sort | tail -1`（**最新备份**）当"上一次上线"，
// 而它未必是**当前激活**的 release。⇒ 改成先读 `readlink -f $WebRoot`。
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const deploy = readFileSync(new URL('../scripts/deploy-production.ps1', import.meta.url), 'utf8');

test('① 必须有「拒绝 detached / 非发布分支」的守卫，且挂在最前面', () => {
  assert.match(deploy, /function Assert-DeployIsFromNamedBranch/,
    '必须有 Assert-DeployIsFromNamedBranch 这道根因守卫');
  /* detached：提交不在任何分支上，正是十几次事故的来源 */
  assert.match(deploy, /\$head -eq 'HEAD'/,
    '必须显式判 detached HEAD（rev-parse --abbrev-ref 返回字符串 "HEAD"）');
  assert.match(deploy, /拒绝发布/, '必须真的拒绝，而不是只告警');
  /* 具名但不是约定的发布分支，同样拒绝 —— 否则"换个分支名部署"是现成的绕过口 */
  assert.match(deploy, /\$head -ne \$ReleaseBranch/,
    '必须同时要求「就是约定的发布分支」，否则换个分支名就能绕过');
  assert.match(deploy, /\[string\]\$ReleaseBranch\s*=\s*'[^']+'/,
    '发布分支必须是脚本里的具名常量（可被 -ReleaseBranch 覆盖，但不能没有默认值）');

  /* 挂在只进不退**之前**：分支都不对，就不必再比血统了 */
  const branchAt = deploy.indexOf('Assert-DeployIsFromNamedBranch\n');
  const forwardAt = deploy.indexOf('Assert-ReleaseIsForwardOnly -ThisCommit');
  assert.ok(branchAt > 0 && forwardAt > 0, '两个守卫的调用点都要找得到');
  assert.ok(branchAt < forwardAt, '根因守卫必须排在只进不退之前');
});

test('② 只进不退要比的是「当前真正在跑的 release」，不是「最新备份」', () => {
  assert.match(deploy, /readlink -f '\$WebRoot'/,
    '必须读 $WebRoot 的软链接 —— 那才是当前激活的 release');
  /* 兜底仍允许读 backups，但要排在 current 之后 */
  const cur = deploy.indexOf("readlink -f '$WebRoot'");
  const bak = deploy.indexOf("ls -1 '$BackupRoot'");
  assert.ok(cur > 0 && bak > 0, '两个来源都要找得到');
  assert.ok(cur < bak, 'current 必须**先**试，backups 只作兜底（最新备份未必是当前在跑的那个）');
});

test('③ 逃生口必须存在且留痕（不能为了堵事故把急路也堵死）', () => {
  assert.match(deploy, /\[switch\]\$SkipDetachedDeployCheck/,
    '必须有 -SkipDetachedDeployCheck 逃生口，否则故意回滚时无路可走');
  assert.match(deploy, /if \(\$SkipDetachedDeployCheck\) \{ return \}/,
    '逃生口必须真的跳过这道守卫');
  /* 只进不退那道原有的逃生口不许被顺手删掉 */
  assert.match(deploy, /\[switch\]\$SkipForwardOnlyCheck/, '-SkipForwardOnlyCheck 必须保留');
});

test('④ 门禁自己不许把注释里的字样当成实现', () => {
  /* 这份判据里写着 '拒绝发布'、'HEAD' 这些字样，而它们也出现在注释里 ——
     所以反向断言一律跑在**原文**上（这里不做剥注释），只断言"必须存在"，
     不做"必须不存在"的方向，避免又一次自己骗自己。 */
  const guardStart = deploy.indexOf('function Assert-DeployIsFromNamedBranch');
  const guardEnd = deploy.indexOf('function Assert-ReleaseIsForwardOnly');
  assert.ok(guardStart > 0 && guardEnd > guardStart, '要能截到守卫函数体');
  const body = deploy.slice(guardStart, guardEnd);
  assert.match(body, /git -C \$script:repoPath rev-parse --abbrev-ref HEAD/,
    '必须真的查当前分支名（rev-parse --abbrev-ref HEAD），不能凭空判断');
  assert.match(body, /throw \(/, '必须用 throw 阻断，不能只 Write-Warning');
});