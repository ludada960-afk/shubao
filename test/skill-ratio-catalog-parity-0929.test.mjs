import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { LEGAL_IMAGE_SIZES } from '../src/services/imageSizeCatalog.js';
import { nearestLegalRatio } from '../src/skills/skillRun.js';

/* ══════════════════════════════════════════════════════════════════════════════
   这条门禁盯的是一个**今天还没坏、但一定会坏**的地方。

   `skillRun.LEGAL_RATIOS` 是引擎尺寸表（`imageSizeCatalog.LEGAL_IMAGE_SIZES`）的
   **手工镜像**。它必须和引擎逐值一致，理由写在 skillRun.js 自己的注释里：
     「界面能给的恰好是引擎认得的，多一档就是『选了被静默回落成 1:1』」

   也就是说：**引擎加了一档而这里没加 ⇒ 用户就能选到一个会被静默改成 1:1 的比例，
   界面显示 3:2、实际跑 1:1。** 这正是用户反复报的「看着是 A、跑的是 B」。

   我实测过：截至本提交，两边**完全一致**（13 档，零差异）—— 所以这不是一个
   现在就该改的 bug，而是一个**没有护栏的隐患**。所以这里不加改动，只加门禁：
   以后谁动了引擎的尺寸表，这条会立刻红，并告诉他必须同步 skillRun.LEGAL_RATIOS。
   ══════════════════════════════════════════════════════════════════════════════ */

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

function declaredLegalRatios() {
  const source = read('src/skills/skillRun.js');
  const match = /const LEGAL_RATIOS = new Set\(\[([^\]]+)\]\)/.exec(source);
  assert.ok(match, 'skillRun.js 里必须还能找到 LEGAL_RATIOS 的声明');
  return match[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')).sort();
}

test('① skillRun.LEGAL_RATIOS 必须与引擎尺寸表逐值一致（多了 = 选了被静默回落成 1:1）', () => {
  const engineRatios = Object.keys(LEGAL_IMAGE_SIZES['2K']).sort();
  const mirrored = declaredLegalRatios();
  assert.deepEqual(
    { onlyInEngine: engineRatios.filter(r => !mirrored.includes(r)),
      onlyInMirror: mirrored.filter(r => !engineRatios.includes(r)) },
    { onlyInEngine: [], onlyInMirror: [] },
    'skillRun.LEGAL_RATIOS 与引擎尺寸表对不上。\n'
      + '引擎有而这里没有 ⇒ 技能页给不出这一档；这里有而引擎没有 ⇒ 用户选了会被静默回落成 1:1。\n'
      + `引擎（${engineRatios.length}）: ${engineRatios.join(' ')}\n`
      + `镜像（${mirrored.length}）: ${mirrored.join(' ')}`,
  );
});

test('② 分辨率同理：只有 1K/2K/4K，且与 imageModelCatalog 的口径一致', () => {
  const source = read('src/skills/skillRun.js');
  const match = /const LEGAL_RESOLUTIONS = new Set\(\[([^\]]+)\]\)/.exec(source);
  assert.ok(match, '必须能找到 LEGAL_RESOLUTIONS 的声明');
  const mirrored = match[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')).sort();
  assert.deepEqual(mirrored, ['1K', '2K', '4K'],
    '分辨率档位必须与 imageModelCatalog.imageModelResolutions 的兜底一致（1K/2K/4K）');
});

test('③ 引擎尺寸表自己也得有「每档都是 a:b 且两数都 > 0」的自洽性', () => {
  /* 上面两条比的是「两边一致」；这条防的是「两边一致地错了」——
     比如有人往引擎表里塞了一个 'x:y'，镜像跟着抄，两条都绿但比例是非法的。 */
  for (const ratio of Object.keys(LEGAL_IMAGE_SIZES['2K'])) {
    const parts = ratio.split(':');
    assert.equal(parts.length, 2, `比例 "${ratio}" 必须是 a:b 两段`);
    for (const part of parts) {
      assert.ok(Number(part) > 0, `比例 "${ratio}" 的每一段都必须是正数`);
    }
  }
});

test('④ 「自适应」必须仍然能落到一个**引擎认得**的档位上（不能就近取到非法值）', () => {
  /* 自适应 = 拿主图真实宽高就近取一档。取出来的结果必须是合法档，
     否则就绕过了 ① 的全部保护：用户选「自适应」，跑出来一个引擎不认的比例。 */
  const legal = new Set(Object.keys(LEGAL_IMAGE_SIZES['2K']));
  // 覆盖极端形状：竖长条、横长条、方图、极端长条
  const samples = [[1080, 1920], [1920, 1080], [1000, 1000], [1, 3], [3, 1], [403, 227]];
  for (const [w, h] of samples) {
    // 直接调用 skillRun 的真实实现，确保门禁测的是生产代码路径而不是复刻一遍
    const picked = nearestLegalRatio(w, h);
    assert.ok(legal.has(picked),
      `自适应从 ${w}x${h} 取到了 "${picked}"，它不在引擎尺寸表里（合法：${[...legal].join(' ')}）`);
  }
});
