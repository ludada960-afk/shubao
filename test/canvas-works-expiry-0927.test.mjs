/* ═══ 门禁：到期墓碑在「我的作品」里也**看得见**（2026-09-27 批 CH）══════════════════════════════
   用户口径（逐字）：「那子页面生成的作品不仅会进子页面右边的历史区，还应该进我的作品里面，
   我的作品不仅收纳子页面的作品，也收纳画布生成的作品，是这样吗？」→ 确认之后追加一句「**可以**」
   （修掉我汇报的第 3 条不一致）：**过期作品在子页面历史里是灰卡，在我作品里原来直接消失了**。

   这一组守三件事：
     ① 墓碑**留在列表里**并且带上 `expired` 标记（不许被"没有图/视频/素材引用"那条整理逻辑丢掉）；
     ② 没有墓碑标记的空记录**照旧丢掉**（不许因为这次改动把噪声放进列表）；
     ③ 界面按 `expired` 走灰卡：写清"已过期、文件已清理"，并且**不给**"打开作品 / 存到资产"。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { normalizeCanvasWorkPanel } from '../src/pages/EcCanvas/canvasWorkModel.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFileSync(join(ROOT, relative), 'utf8');

test('① 墓碑留在列表里并带 expired 标记；没有标记的空记录照旧丢掉', () => {
  const tombstone = { _saveKey: 'w-tomb', title: '秋日限定', category: '电商图片', cover_url: '', image_urls: '[]', expired_at: '2026-09-27 03:06:27', _expired: true };
  const kept = normalizeCanvasWorkPanel({ serverWorks: [tombstone] });
  assert.equal(kept.length, 1, '墓碑不许被"没有媒体引用"那条整理逻辑丢掉（那就是"凭空消失"）');
  assert.equal(kept[0].expired, true, '要带上 expired 标记，界面据此走灰卡');
  assert.equal(kept[0].name, '秋日限定', '墓碑保留原来的标题（清理时**没有**清 title，就是为了让用户认得出来）');
  assert.deepEqual(kept[0].images, [], '墓碑没有图');
  /* 自证：没有墓碑标记的空记录仍必须被丢掉（防"把噪声也放进列表"） */
  assert.equal(normalizeCanvasWorkPanel({ serverWorks: [{ _saveKey: 'w-empty', title: '空记录' }] }).length, 0,
    '没有 expired 标记、又没有媒体的记录必须照旧丢掉 —— 否则这条判据是把噪声也收进来了');
  /* `_expired` 与 `expired_at` 两种形态都认（服务端两种都会给） */
  assert.equal(normalizeCanvasWorkPanel({ serverWorks: [{ ...tombstone, _expired: false }] })[0].expired, true, '只带 expired_at 也要认');
});

test('② 界面：墓碑走灰卡 + 说清后果，且不给"打开作品 / 存到资产"', () => {
  const page = read('src/pages/EcCanvas/index.jsx');
  const block = page.slice(page.indexOf('{work.expired ? ('), page.indexOf(') : (', page.indexOf('{work.expired ? (')));
  assert.ok(block.length > 200, '找不到墓碑分支（我的作品列表里那段）');
  assert.match(block, /已过期/, '灰卡上要写"已过期"（与子页面历史同一个词）');
  assert.match(block, /作品保留 7 天/, '要说清为什么（保留期），与历史面板那句同一口径');
  assert.match(block, /无法再打开或下载/, '要说清后果');
  assert.doesNotMatch(block, /openWork\(/, '墓碑不许给"打开作品"（文件已经清理了，点了就是坑）');
  assert.doesNotMatch(block, /handleAddWorkToLibrary/, '墓碑不许给"加入资产库"');
  assert.doesNotMatch(block, /canRemixWork|remixWorkInWorkbench/, '墓碑不许给"回到工作台"（面板值早清空了）');
  assert.match(block, /deleteWork\(work\.id\)/, '只留"移入回收站"这一颗（用户想清掉自己的列表）');
});
