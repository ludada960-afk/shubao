/* ═══ 2026-09-30 批 DC 续-16 补：引用不许指向**没被跟踪**的文件 ═══════════════════════════════
   为什么有这条：`docs/research/2026-09-27-aura-composition-direction.md` 一直**没被 git 跟踪**，
   而 **5 个已跟踪的文件**在引用它（`docs/design/90`、`docs/design/91`、`src/skills/imageSkills.js`、
   `src/skills/skillRun.js`、`test/concept-set-set-generation-0927.test.mjs`）
   ⇒ 每一条引用都是**断链**：本地能打开（文件在磁盘上），别人 clone 下来就**打不开**。

   这与本批记下的那条纪律是同一件事：
     「注释里凡声称『实测表明…』，必须同时写清**跑哪个脚本 / 哪条门禁 / 得到几个数**」
   —— 如果那个"脚本"在别人打不开的地方，这条纪律就是空的。

   ⚠️ **只查 `docs/research/`**，不查全仓。
     实测全仓有 **330 处**引用指向磁盘上已不存在的路径，绝大多数在 `docs/design/` 的历史文档里
     （文件后来改名/挪走）。那是**另一批**的活（考古 30/31/32/46/49/55/68…），不该混进来，
     更不该因为它把这条门禁写成"永远红"—— 那等于把判据废掉。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url);

/** git 跟踪的文件集合。用 `git ls-files` 而不是自己遍历 ——
 *  「在磁盘上」与「在版本控制里」是两件事，只有后者才是别人 clone 得到的东西。 */
const tracked = new Set(
  execSync('git ls-files', { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split(/\r?\n/).map(line => line.trim()).filter(Boolean),
);

const read = relative => readFileSync(new URL(relative, ROOT), 'utf8');

test('① docs/research 下被引用的每一份调研，都**在版本控制里**（不许是断链）', () => {
  /* 只扫会写实现/判据的文件；docs/research 内部的互相引用不管（那是笔记的目录）。 */
  const sources = [...tracked]
    .filter(file => /^(src|test|scripts|server)\//.test(file) && /\.(jsx?|mjs|css)$/.test(file));
  assert.ok(sources.length > 100, '自证：真的扫到了源文件（不是空跑通过），实际 ' + sources.length);

  const CITE = /docs\/research\/[A-Za-z0-9_\-.]+\.md/g;
  const broken = [];
  let cited = 0;
  for (const file of sources) {
    let text;
    try { text = readFileSync(new URL(file, ROOT), 'utf8'); } catch { continue; }
    for (const match of text.matchAll(CITE)) {
      cited += 1;
      const ref = match[0];
      if (!existsSync(new URL(ref, ROOT))) broken.push(file + ' → ' + ref + '（磁盘上就没有）');
      else if (!tracked.has(ref)) broken.push(file + ' → ' + ref + '（磁盘上有，但**没被跟踪** ⇒ 别人打不开）');
    }
  }
  assert.equal(broken.length, 0,
    '这些引用是断链（clone 下来点不开）：\n  ' + broken.join('\n  ') + '\n共扫描 ' + cited + ' 处引用');
});

test('② 那一篇构图方向调研**已被跟踪**，且内容对得上被引用的数字', () => {
  /* 这一条是 ① 的自证：把那份文件从跟踪里摘掉，① 必须变红 ——
     否则 ① 可能是"扫不到任何引用"的空转（那种门禁最没用）。 */
  const REF = 'docs/research/2026-09-27-aura-composition-direction.md';
  assert.ok(tracked.has(REF), REF + ' 必须被跟踪（5 个文件在引用它）');
  const text = read(REF);
  /* ⚠️ 这里只列**代码注释真的引它、且它真的写了**的那几个数字。
     我第一版是凭印象写了 `60/402` / `14.9%`（拼版口径），当场被门禁判红 ——
     那两个数在 **deep-dive** 里（拼版是 deep-dive 的结论，不是构图方向那篇的），
     这份文件里 0 处。**断言必须按文件实际内容写，不能按"我以为它写了什么"写。**
     下面每一个都对应一条真实引用：
       · 74/402 + 18.4% ⇒ skillRun.js / imageSkills.js 的连拍注释（批 DC 续-15）
       · 86.1%          ⇒ 「居中式大留白是基本盘」⇒ 构图方向**不做**逐张化的依据
       · 17.2%          ⇒ 镜面对称 69 张 */
  for (const needle of ['74/402', '18.4', '86.1', '17.2']) {
    assert.ok(text.includes(needle),
      REF + ' 里应当能找到 ' + needle + '（代码注释引的就是这几个数）；' +
      '若调研结论变了，改**这里**和那几处注释，别只改一处。');
  }
  /* 人物形态那份逐张分布是**另一篇**（deep-dive）的事 —— 别引错文件。 */
  const deep = read('docs/research/2026-09-27-aura-deep-dive.md');
  for (const needle of ['206', '51.2%', '18.4%', '16.4%', '86.1%']) {
    assert.ok(deep.includes(needle),
      'deep-dive 里应当能找到 ' + needle + '（批 DC 续-16 的逐张权重就出自这张表 :346-359）');
  }
});

test('③ 原始抓取素材**不入库**，但脚本名在调研文档里有登记（与姊妹篇一致）', () => {
  /* `.tmp/` 现在进了 .gitignore（实测 24406 文件 / 2.6 GB）——
     调研的**结论**入库、**原始素材**不入库，两边都要说得清。 */
  const ignore = read('.gitignore');
  assert.match(ignore, /^\.tmp\/$/m, '.tmp/ 必须在 .gitignore 里（否则一次 git add -A 就是 2.6 GB）');
  assert.ok(!tracked.has('.tmp'), '.tmp 下不许有被跟踪的文件（原始抓取素材不入库）');
  /* 而脚本名登记在**已跟踪**的那份 deep-dive 里 —— 这样"跑哪个脚本"这句话有落点。 */
  const deep = read('docs/research/2026-09-27-aura-deep-dive.md');
  assert.match(deep, /classify\.cjs/, '逐张标注脚本名应登记在 deep-dive 的脚本表里（引用才有落点）');
});
