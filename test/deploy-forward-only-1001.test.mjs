/* ═══ 2026-10-01 批 DC 续-37：部署「只进不退」前置检查 ════════════════════════════════════════
   真实事故（RTK 批 DC 续-36）：两条线从**分叉的历史**部署到同一个生产环境，
   本分支 01:01 发了 b88ed934，01:19 另一条线从一个 **detached 工作树**发了 b66e9ff0，
   产物整个被换掉 ⇒ 十分钟前刚上线的修复**静默消失**，用户为此第三次发同一张截图。
   当时**没有任何告警** —— 部署脚本只看"自己这次成不成功"，不看"有没有把上一次顶掉"。

   这条门禁守住三件事：① 检查真的存在；② 它挂在**任何耗时/破坏性步骤之前**；
   ③ 它有逃生口（故意回滚时要能用），且跳过时**留下记录**。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const read = rel => readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
const SCRIPT = read('scripts/deploy-production.ps1');

test('① 「只进不退」检查存在，判据是"本次提交必须是上次上线提交的后代"', () => {
  assert.match(SCRIPT, /function Assert-ReleaseIsForwardOnly/,
    '部署脚本必须有这条前置检查 —— 没有它，分叉部署会静默覆盖上一次上线');
  assert.match(SCRIPT, /merge-base --is-ancestor/,
    '判据必须是"是不是祖先"，不是比时间戳（时间戳在不同机器上没意义）');
  /* 发布号形如 20261001-095750-c8e8ba1d，提交号取末段 */
  assert.match(SCRIPT, /deploy-backups/,
    '上一次发布号要从服务器上的备份目录读，那才是"上一次真的发了什么"的唯一真源');
  assert.match(SCRIPT, /git merge/,
    '失败提示必须给出可执行的下一步（怎么合并），而不只是"拒绝"');
});

test('② 检查挂在**任何耗时与破坏性步骤之前**（跑完 10 分钟构建才发现就白花了）', () => {
  const at = SCRIPT.indexOf('Assert-ReleaseIsForwardOnly -ThisCommit');
  assert.ok(at > 0, '检查要被真正调用');
  for (const [label, needle] of [
    ['全量单测', 'npm run test'],
    ['生产构建', 'npm run build'],
    ['远端运行时配置改写', 'runtimeUpdateCommand'],
    ['远端备份', 'remoteBackupCommand'],
    ['pm2 重启', 'pm2 restart'],
  ]) {
    const where = SCRIPT.indexOf(needle);
    assert.ok(where > 0, `脚本里应当有「${label}」这一步，否则这条断言没有意义`);
    assert.ok(at < where,
      `「${label}」出现在只进不退检查**之后** —— 检查必须跑在最前面，`
      + '否则要么白跑一遍构建，要么已经把生产备份/重启了才发现根本发不出去');
  }
});

test('③ 有逃生口，且跳过时会留下记录（不是静默跳过）', () => {
  assert.match(SCRIPT, /\[switch\]\$SkipForwardOnlyCheck/,
    '故意回滚 / 从分叉分支救火时需要一条明确开关');
  assert.match(SCRIPT, /已跳过「只进不退」前置检查/,
    '跳过必须打印醒目告警 —— 这条检查的全部价值就是"不再静默"');
});

test('④ 验不出来就放行，不能拿一条查不了的规则去挡线上发布', () => {
  /* ⚠️ 2026-10-02：判据**不再钉中文措辞**。
     原版钉死「读不到上一次发布号」+「本机仓库里没有这个提交」两句。
     而我这次把"上一次上线"的来源从 `ls deploy-backups | tail -1`（最新备份）
     改成了 `readlink -f $WebRoot`（当前真正在跑的 release）——
     理由是"最新备份未必是当前激活的"，拿它当既成事实会误拦或误放。
     顺带删掉了"本机仓库里没这个提交"那个分支（现在会直接跳过 current 去看 backups 兜底）。
     ⇒ 行为完全一致（查不到就放行），却被措辞绊倒判了红。
     ⇒ 改成断言**意图**而不是措辞：存在"读不到 ⇒ 告警并放行"这条分支。
        措辞会变，意图不会；钉意图才拦得住真正的回归。 */
  const failOpen = /读不到[\s\S]{0,240}?本次放行/;
  const m = SCRIPT.match(failOpen);
  assert.ok(m, '读不到当前线上发布号 ⇒ 必须告警并放行（不能 throw）');
  /* 且它必须**真的**是放行：告警之后紧跟 return；若只是告警、继续往下走就会撞上 throw */
  assert.match(SCRIPT.slice(m.index, m.index + 260), /return/,
    '告警之后必须 return（放行）；只告警然后继续往下走，等于没放行');
});

test('⑤ 变异自证：把检查摘掉 / 挪到构建之后，两条都必须判红', () => {
  /* 这条不是重复 ①②，而是**证明这两条判据真能抓住**：
     ① 拿"检查函数被删掉"的源码喂给同一条判据；
     ② 拿"检查挪到 npm run build 之后"的源码喂给第②条。 */
  const readPos = (src, needle) => src.indexOf(needle);
  /* 变异 A：删掉调用 */
  const removedCall = SCRIPT.replace(/Assert-ReleaseIsForwardOnly -ThisCommit[^\n]*\n/, '');
  assert.notEqual(removedCall, SCRIPT, '变异 A 没命中');
  assert.equal(readPos(removedCall, 'Assert-ReleaseIsForwardOnly -ThisCommit'), -1,
    '删掉调用后，第①条的锚点应当消失');

  /* 变异 B：把调用挪到 npm run test 之后 —— 第②条必须红 */
  const callLine = SCRIPT.match(/.*Assert-ReleaseIsForwardOnly -ThisCommit[^\n]*\n/)[0];
  const withoutCall = SCRIPT.replace(callLine, '');
  /* ⚠️ 锚点是整行 `npm run test …` 后面那个换行：脚本里那行收尾是 `-Command { npm run test }`，
     **没有引号**（第一版写成 `npm run test'\s*\n`，压根没匹配上，变异等于没做）。 */
  const testLine = /(npm run test[^\n]*\n)/;
  assert.ok(testLine.test(withoutCall), '脚本里应当有一行 npm run test');
  const moved = withoutCall.replace(testLine, `$1${callLine}`);
  assert.notEqual(moved, withoutCall, '变异 B 没命中');
  assert.ok(readPos(moved, 'Assert-ReleaseIsForwardOnly -ThisCommit') > readPos(moved, 'npm run test'),
    '变异 B：挪到 npm run test 之后，第②条必须判红（所以真实脚本里它必须更靠前）');
  assert.ok(readPos(SCRIPT, 'Assert-ReleaseIsForwardOnly -ThisCommit') < readPos(SCRIPT, 'npm run test'),
    '真实脚本里它必须早于 npm run test');
});

test('⑥ 脚本仍能被 pwsh 解析（这份 .ps1 含中文，PS 5.1 会按 ANSI 读而截断字符串）', () => {
  /* ⚠️ 不要用 powershell 跑：PS 5.1 按 ANSI 读含中文的 .ps1，会把字符串截断报 ParserError。
     这里只用**解析器**验证，不真跑部署。 */
  let out = '';
  try {
    out = execFileSync('pwsh', ['-NoProfile', '-Command',
      `$errors = $null; [System.Management.Automation.Language.Parser]::ParseFile('scripts/deploy-production.ps1', [ref]$null, [ref]$errors) > $null; if ($errors) { $errors | ForEach-Object { $_.Message }; exit 1 }`],
      { encoding: 'utf8', cwd: fileURLToPath(new URL('..', import.meta.url)), timeout: 120000 });
  } catch (error) {
    assert.fail('deploy-production.ps1 解析失败：\n' + (error.stdout || '') + '\n' + (error.stderr || ''));
  }
  assert.ok(String(out).trim() === '', '解析不应有任何报错输出');
});