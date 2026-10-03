// test/adaptive-ratio-priority-1003.test.mjs
// 比例与「自适应」的判定规则 —— 2026-10-03 / 10-04
//
// 这份文件的判据在 10-04 改过一次，原因写在下面：
//
// 用户投诉「自适配会自动篡改我的尺寸，然后导致先后产出的尺寸不一致」。
// 追下来的根因链（全部实测，非推测）：
//   ① handleMediaNaturalSize 把节点 ratio 写成 '2304:1856' 这种精确值，
//      而它又是下一次生成的面板比例来源 —— 测量值覆盖了用户设置。
//   ② '自适应' 原样进请求体，被服务端静默回落成 1:1（不报错、不提示）。
//   ③ 「自适应」此前会被翻译成一个**具体档位**（按参考图宽高就近取档），
//      这就是用户说的"自作主张替他匹配最近的标准尺寸"。
//
// 10-04 改判（用户拍板）：自适应 = **不指定比例**，交给上游按内容分配宽高。
// 竞品的自适应档正是这个口径：「固定总像素量级 + 模型根据内容分配宽高」。
// 实测依据（本项目自己付费跑）：
//   · image2 不传 size  → 一律 2048x2048 方图（两个不同内容都如此）
//   · nano  不传 aspect → 1376x768 横图（内容相关，横构图合理）
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { protocolRatioForNodes, resolveProtocolRatio, resolveAdaptiveRatio, ADAPTIVE_RATIO } from '../src/pages/EcCanvas/canvasAdaptiveRatio.js';
import { resolveGenerationSize, buildModelRoute, LEGAL_IMAGE_SIZES } from '../server/ecommerceEngine/modelCatalog.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');

/* ───────────────────────── ① 用户选了具体档位：照做 ───────────────────────── */

test('① 显式档位原样透传，提示词里写什么都不许覆盖', () => {
  assert.equal(resolveProtocolRatio({ ratio: '3:4', prompt: '给我一张 16:9 的' }), '3:4');
  assert.equal(protocolRatioForNodes({ ratio: '16:9', prompt: '竖版' }), '16:9');
  assert.equal(resolveProtocolRatio({ ratio: '5:4', prompt: '' }), '5:4');
});

test('② 面板外的值（节点精确比例 2304:1856 等）吸附到合法档，不原样外发', () => {
  /* handleMediaNaturalSize 写的精确值同时是下一次生成的面板比例来源；
     原样外发会被服务端 400。吸附后必然是合法档。 */
  assert.equal(protocolRatioForNodes({ ratio: '2304:1856' }), '5:4');
  assert.equal(resolveProtocolRatio({ ratio: '16x9' }), '16:9');
  for (const raw of ['2304:1856', '16x9', '1:1', '2000x2000']) {
    const out = resolveProtocolRatio({ ratio: raw });
    assert.ok(Object.values(LEGAL_IMAGE_SIZES).some(table => Object.hasOwn(table, out)),
      raw + ' 吸附后仍是非法档 ' + out);
  }
});

/* ─────────────────── ② 提示词里写了尺寸：按它（比档位更硬） ─────────────────── */

test('③ 自适应 + 提示词写了比例 → 按提示词来', () => {
  assert.equal(resolveProtocolRatio({ ratio: ADAPTIVE_RATIO, prompt: '帮我出 16:9 的图' }), '16:9');
  assert.equal(resolveProtocolRatio({ ratio: ADAPTIVE_RATIO, prompt: '要 9:16' }), '9:16');
});

/* ───────────── ③ 其余情况：不指定比例，交给上游（2026-10-04 新规则） ───────────── */

test('④ 自适应且提示词没写尺寸 → 返回空串（= 不指定），不是 1:1', () => {
  /* 这条是 10-04 的核心改判。此前这里会返回一个具体档位，那正是"篡改尺寸"。 */
  assert.equal(resolveProtocolRatio({ ratio: ADAPTIVE_RATIO, prompt: '一张秋日静物' }), '');
  assert.equal(resolveProtocolRatio({ ratio: ADAPTIVE_RATIO, prompt: '' }), '');
  assert.equal(protocolRatioForNodes({ ratio: ADAPTIVE_RATIO, prompt: '随便什么画面' }), '');
});

test('⑤ 参考图再大再小也不影响自适应结果（不再"就近取档"）', () => {
  /* 用户把 2200×1927（1.142）贴进来，自适应必须**不指定**，而不是吸到 5:4。 */
  const withBigRef = protocolRatioForNodes({
    ratio: ADAPTIVE_RATIO, prompt: '改一下这张图',
    sourceNodes: [{ naturalWidth: 2200, naturalHeight: 1927 }],
  });
  assert.equal(withBigRef, '', '参考图比例不得再参与自适应判定');
});

test('⑥ 节点显示框（w/h）同样不参与 —— 拖一下框不该改变出图比例', () => {
  assert.equal(
    protocolRatioForNodes({ ratio: ADAPTIVE_RATIO, sourceNodes: [{ w: 900, h: 200 }] }),
    '',
  );
});

/* ─────────────── ④ 服务端：自适应 = 真的不传 size / aspectRatio ─────────────── */

test('⑦ 服务端把空比例标记成 autoRatio，并保留可用的默认尺寸供计费/校验', () => {
  const auto = resolveGenerationSize({ resolution: '2K', ratio: '' });
  assert.equal(auto.autoRatio, true, '空比例必须被标记为自适应');
  assert.ok(auto.size && typeof auto.size === 'string', '计费/校验仍需要一份合法默认值');
  assert.ok(Object.values(LEGAL_IMAGE_SIZES).some(t => Object.hasOwn(t, auto.ratio)));

  const explicit = resolveGenerationSize({ resolution: '2K', ratio: '3:4' });
  assert.equal(explicit.autoRatio, false, '用户选了档位就不算自适应');
});

test('⑧ route 把 autoRatio 带下去（请求构造层靠它决定传不传 size）', () => {
  assert.equal(buildModelRoute({ imageModel: 'image2', resolution: '2K', ratio: '' }).autoRatio, true);
  assert.equal(buildModelRoute({ imageModel: 'image2', resolution: '2K', ratio: '3:4' }).autoRatio, false);
});

test('⑨ image2 请求体在自适应时**不带 size**，只带 resolution', () => {
  const source = read('server/ecommerceEngine/providerAdapter.mjs');
  assert.match(source, /autoRatio: own\(route, 'autoRatio'\) === true/,
    '必须把 autoRatio 传进尺寸解析');
  assert.match(source, /if \(autoRatio\) return \{ resolution:/,
    '自适应时只返回 resolution，不返回 size —— 那是"不指定宽高比"的唯一实现方式');
  assert.match(source, /resolution: cleanString\(own\(route, 'resolution'\)/,
    'resolution 必须单独从 route 取：pixelSize 是像素串，自适应分支要的是档位名');
  assert.match(source, /throw new RangeError\('native task size must be a catalog-owned legal image size'\)/,
    '非自适应时那道闸必须还在：用户显式选了档位就必须是那一档');
});

test('⑩ nano 请求体在自适应时**不带 aspectRatio**，但 imageSize 照传', () => {
  const source = read('server/ecommerceEngine/nanoBananaProviderAdapter.mjs');
  assert.match(source, /if \(!autoRatio\) imageConfig\.aspectRatio = /,
    '自适应时不能带 aspectRatio —— 带着就等于我们替它指定了');
  assert.match(source, /imageConfig = \{ imageSize:/,
    '画质档两种情况都要传：那才是"固定总像素量级"');
});

/* ─────────────── ⑤ 非法比例仍然硬拒绝（不许因为放宽而松掉） ─────────────── */

test('⑪ 非法的**显式**比例仍然 400，不许静默回落 1:1', () => {
  assert.throws(
    () => resolveGenerationSize({ resolution: '2K', ratio: '5:3' }),
    error => error?.code === 'INVALID_IMAGE_RATIO' && error?.status === 400,
  );
  /* 但「自适应」这个字面量不再是"非法比例"，而是"不指定" —— 它在 resolveGenerationSize
     里已被 ADAPTIVE_RATIO_MARKER 归入 autoRatio，不该再抛。 */
  assert.equal(resolveGenerationSize({ resolution: '2K', ratio: ADAPTIVE_RATIO }).autoRatio, true);
});

test('⑫ 合法的十三档一档都不受影响（这道门禁不许被放松）', () => {
  for (const resolution of Object.keys(LEGAL_IMAGE_SIZES)) {
    for (const ratio of Object.keys(LEGAL_IMAGE_SIZES[resolution])) {
      assert.equal(resolveGenerationSize({ resolution, ratio, imageModel: 'image2' }).ratio, ratio);
    }
  }
});

/* ─────────────── ⑥ 保留的旧语义解析器（仍被测试引用） ─────────────── */

test('⑬ resolveAdaptiveRatio 本身没被改（它仍认提示词语义与参考图）', () => {
  /* 它已不在自适应主链路上，但仍是可测的语义解析器：撤销引用时要能看清它还剩什么。 */
  assert.equal(resolveAdaptiveRatio({ prompt: '做一张 16:9 的海报' }).ratio, '16:9');
  assert.equal(resolveAdaptiveRatio({ prompt: '竖版的手持机' }).ratio, '9:16');
});

/* ───────────────────────── ⑦ 接线不许回退 ───────────────────────── */

test('⑭ 画布出图路径仍必须过协议比例转换', () => {
  const source = read('src/pages/EcCanvas/index.jsx');
  const withoutResolvedCalls = source.replace(/protocolRatioForNodes\(\{[^}]*\}\)/g, 'RESOLVED');
  const raw = withoutResolvedCalls.match(/ratio:\s*(?:composer|node|source)\.ratio\b/g) || [];
  assert.deepEqual(raw, [], '这些地方又把面板值原样传下去了：' + raw.join(' / '));
  assert.match(source, /protocolRatioForNodes/);
});

test('⑮ 合成器（控制面）不得被素材测量改写比例', () => {
  /* 测量值覆盖用户设置 —— 这是"自适配篡改尺寸"的第一个根因。 */
  const source = read('src/pages/EcCanvas/index.jsx');
  const set = source.match(/const MEDIA_FIT_KINDS = new Set\(\[([^\]]*)\]\)/)?.[1] || '';
  assert.ok(set, '必须仍能找到 MEDIA_FIT_KINDS');
  assert.doesNotMatch(set, /image-composer/, '合成器的 ratio 是用户设置，不许被测量回调覆盖');
});

test('⑯ 参考图尺寸解析的死代码不许复活', () => {
  const source = read('src/pages/EcCanvas/canvasAdaptiveRatio.js');
  assert.doesNotMatch(source, /function referenceBoxOf/, '自适应不再按参考图取档');
  assert.doesNotMatch(source, /function boxFromRatioText/, '同上');
});
