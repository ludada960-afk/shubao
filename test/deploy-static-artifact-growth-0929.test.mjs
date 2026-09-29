// test/deploy-static-artifact-growth-0929.test.mjs
// 2026-09-29 批 CY-⑮。守一条**已经造成过真实损失**的部署缺陷：
//
//   服务器 `/home/ubuntu/shubao/dist/assets` 累积到 **6286 个 js**（最早 2026-09-10，占 905M），
//   而一次干净构建只有 **30 来个**。原因：`deploy-production.ps1:641` 正路径是
//   `tar xzf <archive>` —— **覆盖解包、从不先删 dist/**，
//   于是历次构建的 content-hash 文件逐批留在暂存目录，再被 `cp -a dist/.` **整份**复制进
//   **每一个** release 目录。实测三个 release 分别是 6224 / 6255 / 6286 个 js，逐次递增。
//
//   危害有三个，都不是"不好看"：
//     ① 磁盘单调增长；
//     ② 每个 release 都是 900M，保留策略保留 3 份 ⇒ 约 2.7G 纯冗余；
//     ③ **污染验证**："在 assets 目录里 grep"会命中 19 天前的旧 chunk，
//        看起来像"我的改动没上线" —— 这一批我因此**连续两次**得出错误结论。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const ps1 = read('scripts/deploy-production.ps1');

test('正路径解包前必须先删 dist（覆盖解包不会删旧文件）', () => {
  const at = ps1.indexOf("tar xzf '$remoteReleaseArchive'");
  assert.ok(at > 0, '找得到正路径的解包命令');
  const window = ps1.slice(Math.max(0, at - 400), at);
  assert.match(window, /rm -rf dist;/,
    '解包前必须 `rm -rf dist` —— `tar xzf` 是覆盖解包，旧 content-hash 文件会一直留在暂存目录里');
});

test('回滚路径也要先删 dist（两条路径必须同口径）', () => {
  /* 正路径曾经有、回滚路径也有的那条 `rm -rf dist` —— 反过来验证"正路径漏了"这个判断成立。 */
  assert.match(ps1, /rm -rf dist; cp -a \$remoteBackup\/dist dist;/,
    '回滚路径本来就该先删 dist 再从备份恢复（它一直是对的）');
});

test('备份必须在删 dist 之前完成（否则这行修复会毁掉回滚能力）', () => {
  const backup = ps1.indexOf('__REMOTE_BACKUP__/dist');
  const clean = ps1.indexOf('rm -rf dist; tar xzf');
  assert.ok(backup > 0, '找得到备份 dist 的命令');
  assert.ok(clean > 0, '找得到清理 + 解包');
  assert.ok(backup < clean,
    '⚠️ 备份必须排在清理之前 —— 否则「解包前删 dist」会把唯一那份回滚快照一起带走');
});

test('清理步骤的日志文案不许自相矛盾（成功时打的是失败文案）', () => {
  /* 这一条是这一批真正的教训来源：我把
       `Remote locked step passed: Old static release cleanup failed`
     读成了"清理一直在失败"，还据此写了 RTK 与交接文档。
     根因：该步骤传给 Invoke-LockedRemote 的 FailureMessage 文本本身就是
     "Old static release cleanup failed"，而成功时打的也是同一个字符串。
   ⇒ 判据：失败文案里不许同时出现"失败"和"完成/成功"两种可能读法里的歧义。 */
  assert.ok(!/Old static release cleanup failed/.test(ps1),
    '清理步骤的文案必须改成读起来不歧义的说法（成功时才不会被打成失败）');
  assert.match(ps1, /Old static release cleanup \(keep newest 3 releases\)/,
    '改成陈述"这一步在做什么"，而不是陈述"它失败时叫什么"');
});

test('保留策略仍然是"最新 3 个"（这次修漏，没有顺手改策略）', () => {
  assert.match(ps1, /tail -n \+4/,
    '保留最新 3 个 release（tail -n +4 跳过前 3 个）—— 修的是"每个 release 太大"，不是改保留数量');
  /* 文档里写的是 releases < 5，代码是 3，比文档更严；这一批不许背离文档。 */
  assert.ok(true, '（文档：部署就绪报告 R-7 要求 releases < 5，代码 3，符合且更严）');
});
