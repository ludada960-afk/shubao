/* ═══ 门禁：孤儿生成图清理的**可删判定**（2026-09-27 批 CF）════════════════════════════════════
   用户口径：「保留期要不要清理，其实取决于我们服务器压力大不大，我觉得如果生成太多肯定是要清理的」
   「**开吧**」。开门后实测发现真正占空间的是**没有任何记录引用的孤儿文件**
   （生产：2072 个文件 6.81GB 里，1973 个 6.47GB 是孤儿）—— 所以有了这个一次性清理脚本。

   这一组只守一件事：**可删判定**必须"宁可少删" ——
     ① 有任何引用就不删；② 没到年龄下限就不删；③ 名字不合法根本不进候选（脚本层面）。
   纯函数 `pickDeletable` 拿出来就是为了能这样直接跑。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { SWEEP_DEFAULT_MIN_AGE_DAYS, pickDeletable } from '../scripts/sweep-orphan-assets.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFileSync(join(ROOT, relative), 'utf8');
const DAY = 86400000;

test('① 有任何引用的不删；没到年龄下限的不删（宁可少删，绝不误删）', () => {
  const now = Date.parse('2026-09-27T12:00:00Z');
  const old = now - 60 * DAY;
  const fresh = now - 2 * DAY;
  const files = [
    { name: 'a'.repeat(64) + '.png', size: 100, mtimeMs: old },
    { name: 'b'.repeat(64) + '.png', size: 200, mtimeMs: old },
    { name: 'c'.repeat(64) + '.png', size: 300, mtimeMs: fresh },
  ];
  const referenced = new Set(['b'.repeat(64) + '.png']);
  const { deletable, young } = pickDeletable({ files, referenced, now, minAgeDays: 30 });
  assert.deepEqual(deletable.map(f => f.name), ['a'.repeat(64) + '.png'], '只有"没人引用 + 够老"的那一个能删');
  assert.deepEqual(young, ['c'.repeat(64) + '.png'], '够新的一律留着（可能是正在生成/还没落库的）');
  assert.equal(SWEEP_DEFAULT_MIN_AGE_DAYS, 30, '默认门槛 30 天');
  /* 自证：把"有引用也删"写进判定，第一条断言必须红 */
  const naive = files.filter(f => (now - f.mtimeMs) / DAY >= 30);
  assert.equal(naive.length, 2, '不去看引用的话会多删一个 ⇒ 这条判据不是空转');
});

test('② 引用扫描是**全库全列** + **仓库侧名单**（不是只查 works）', () => {
  const source = read('scripts/sweep-orphan-assets.mjs');
  assert.match(source, /SELECT name FROM sqlite_master WHERE type='table'/, '要遍历所有表');
  assert.match(source, /PRAGMA table_info/, '要遍历每张表的列');
  assert.match(source, /NAME_IN_TEXT_RE/, '在文本里抽 64 位十六进制的生成图名（URL 可能嵌在 JSON 里）');
  /* ═══ 两条**差点删掉前台内容**的引用源，必须一直在扫描范围里 ═════════════════════════════════
     ① 部署出去的静态目录（`--scan-dir`）：案例 JSON 构建后进 dist/gallery；
     ② **仓库侧名单**（`--refs-file`）：案例 JSON 只存在于仓库、服务器上没有（实测 find 一个都没有），
        所以服务器侧的目录扫描看不见它们 —— 第一次 dry-run 就是因此把那 12 张案例图算成了孤儿。 */
  assert.match(source, /collectReferencedNamesFromDirs/, '要扫磁盘目录');
  assert.match(source, /statSync\(full\)\.isDirectory\(\)/, '要**跟着符号链接**走（部署目录里 gallery 是链接）');
  assert.match(source, /refsFile\) \{[\s\S]{0,200}referenced\.add\(name\)/, '要支持 --refs-file 带上仓库侧名单');
  assert.equal(read('scripts/data/gallery-asset-refs.txt').split(/\r?\n/).filter(line => /^[a-f0-9]{64}\.(?:jpg|png|webp)$/i.test(line.trim())).length >= 1, true,
    '仓库侧名单文件不能是空的（它是那 12 张案例图的保护名单）');
  /* 默认 dry-run + 审计日志 —— 删之前先报，删之后能对账 */
  assert.match(source, /mode: apply \? 'apply' : 'dry-run'/, '默认 dry-run');
  assert.match(source, /const lines = \['# 孤儿生成图清理/, '真删时要写审计清单');
  /* 只碰命名合法的文件 */
  assert.match(source, /const ASSET_NAME_RE = \/\^\[a-f0-9\]\{64\}\\\.\(\?:jpg\|png\|webp\)\$\/i/, '只碰合法命名的生成图');
});
