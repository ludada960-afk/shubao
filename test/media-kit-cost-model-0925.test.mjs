import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { FEATURE_SKUS, MARGIN_BANDS, pointsFaceAnchorCny } from '../server/billing/catalog.mjs';
import { createVolcSubtitleAdapter, volcSubtitleReadiness } from '../server/volcSubtitleErase.mjs';

/* ═══ 2026-09-25 批 AQ：火山 AI MediaKit 的**成本模型门禁** ═══════════════════════════════════════
   用户：「你把成本算好，我目前没有充值」—— 成本算在 docs/design/71 里，这条门禁负责让那份账**不会烂**：
   上游单价（0.4 / 1 / 1 元/分钟）与站内面值锚、毛利公式全部现场重算，改动任何一边都会在这里报出来。
   同时钉住三件"钱"上的事实：
     ① 自动标记**不能**与手动档同价（33.3% / −62.1%，都过不了 40% 地板）；
     ② 建议价（0.05 / 0.12 积分/秒）确实过地板，且 1 积分 = 1000 units ⇒ 整数 units；
     ③ 本机路线（手动去字幕 / 视频高清）在价格上完胜上游同类能力（成本 0 vs ¥0.4~2.5/分钟）。 */

const anchor = pointsFaceAnchorCny();
const FLOOR = MARGIN_BANDS.traffic.floor;             // 引流带 40%
const UNITS_PER_POINT = 1000;
const marginOf = (faceCny, costCny) => (faceCny * 0.97 - costCny) / faceCny;

/* 官方计费页的原文单价（元/分钟）——改这里就等于改台账，必须与 docs/design/71 同步 */
const UPSTREAM_CNY_PER_MINUTE = Object.freeze({
  subtitleEraseStandard: 0.4,
  subtitleEraseRefined: 1,
  lipSync: 1,
  frameInterpolation: 0.6,
  qualityEnhanceLlm: 2.5,
  subtitleOcr: 0.25,
  subtitleAsr: 0.03,
});

test('① 换算前提：1 积分 = 1000 units，面值锚 = 199 元 / 760000 units（与 catalog 同源）', () => {
  assert.ok(Math.abs(anchor - 199 / 760000) < 1e-12, `面值锚必须还是 199/760000，实际 ${anchor}`);
  assert.ok(Math.abs(anchor * UNITS_PER_POINT - 0.26184210526315794) < 1e-9, '1 积分面值 ≈ ¥0.2618');
  assert.equal(FLOOR, 0.4, '引流带地板 40%（成本换算表用的就是它）');
});

test('② 上游 ¥/分钟 → 我们该卖多少积分/秒：最低合规价与建议档都必须过地板', () => {
  const cases = [
    { name: '字幕擦除·标准版', cnyPerMinute: UPSTREAM_CNY_PER_MINUTE.subtitleEraseStandard, suggestedUnits: 50, suggestedMargin: 0.461 },
    { name: '字幕擦除·精细化版', cnyPerMinute: UPSTREAM_CNY_PER_MINUTE.subtitleEraseRefined, suggestedUnits: 120, suggestedMargin: 0.440 },
    { name: '视频口型对齐', cnyPerMinute: UPSTREAM_CNY_PER_MINUTE.lipSync, suggestedUnits: 120, suggestedMargin: 0.440 },
  ];
  for (const item of cases) {
    const costPerSecond = item.cnyPerMinute / 60;
    /* 最低合规价：面值 ≥ 成本 / (1 − 3% − 地板) */
    const minUnits = Math.ceil((costPerSecond / (1 - 0.03 - FLOOR)) / anchor);
    const suggestedFace = item.suggestedUnits * anchor;
    assert.ok(item.suggestedUnits >= minUnits,
      `${item.name} 的建议价 ${item.suggestedUnits} units/秒 低于最低合规价 ${minUnits}（会跌破 40% 地板）`);
    const margin = marginOf(suggestedFace, costPerSecond);
    assert.ok(margin >= FLOOR, `${item.name} 建议价毛利 ${(margin * 100).toFixed(1)}% 必须过地板`);
    assert.ok(Math.abs(margin - item.suggestedMargin) < 0.005,
      `${item.name} 的毛利应在 ${(item.suggestedMargin * 100).toFixed(1)}% 附近（docs/design/71 的表要同步）`);
    /* 整数 units（站内计费是整数单位，1 积分 = 1000 units ⇒ 0.05 积分/秒 = 50 units） */
    assert.ok(Number.isSafeInteger(item.suggestedUnits), `${item.name} 的 units 必须是整数`);
  }
});

/* ⚠️ 2026-10-04：手动档改成**按次固定价**（用户要「固定的费用」），这一条的结论没变，
     只是"比"的对象变了：
       · 手动（本机 delogo，成本 ¥0）1 积分/次 ⇒ 无论片子多长都是纯利；
       · 自动（火山标准版 ¥0.4/分钟）**≤60 秒一律 3 积分/次**，超出才按 0.05 积分/秒。
     ⇒ 「自动不能与手动同价」现在要验两件更要紧的事：
       ① 平价档那 3 积分，**按封顶那么长的片子**去比上游成本，仍要过 40% 地板。
          （只按 1 秒算成本会得出 98% 的假毛利 —— 那正是这条模型最初要防的事，
            而"perSecond 归一"这种记账口径最容易被平价绕过。）
       ② 平价档在封顶处的**折合每秒单价**恰好等于原来的按秒单价（3000/60 = 50 units/秒），
          也就是说这次没让用户变贵，只是不再让那个数随片子长短浮动。 */
test('③ 自动标记**不能**与手动档同价：这是本模型最重要的一条结论', () => {
  const manual = FEATURE_SKUS.video_desubtitle_local_short;
  const auto = FEATURE_SKUS.video_desubtitle_volc_short;
  const cap = auto.flatMaxSeconds;

  /* 手动档：成本 0、固定价 ⇒ 纯利，且与时长无关 */
  assert.equal(manual.providerCostCny, 0, '本机 delogo 的上游成本必须记 0（localEngine 类别）');
  assert.notEqual(manual.perSecond, true, '手动档已改按次');
  assert.ok(marginOf(manual.units * anchor, manual.providerCostCny) > 0.95, '手动档毛利应 >95%');

  /* 自动档：平价那一条必须按**封顶时长**的真实成本来算毛利 */
  const autoFace = auto.flatUnits * anchor;
  const costAtCap = UPSTREAM_CNY_PER_MINUTE.subtitleEraseStandard / 60 * cap;
  const autoMargin = marginOf(autoFace, costAtCap);
  assert.ok(autoMargin >= FLOOR,
    `封顶 ${cap}s 的平价档毛利 ${(autoMargin * 100).toFixed(1)}% 必须过 ${FLOOR} 地板（成本要按 ${cap} 秒算，不是 1 秒）`);
  assert.ok(marginOf(autoFace, costAtCap / cap) > 0.95,
    '只按 1 秒成本算会得到 ~98% 的假毛利 —— 这条门禁就是为了不让那种算法混进来');

  /* 反过来：自动档**必须贵过**手动档（手动是纯利，同价就是白送上游的钱） */
  assert.ok(auto.flatUnits > manual.units, `自动 ${auto.flatUnits} 必须贵过手动 ${manual.units}`);
  /* 封顶处的折合每秒单价 = 原来那个按秒单价：这次没让用户变贵，只是不再浮动 */
  assert.equal(auto.flatUnits / cap, auto.units,
    `平价在封顶处的折合单价应等于每秒单价（${auto.units} units/秒），否则等于悄悄涨价`);
});

test('④ 本机路线在价格上完胜上游同类能力（同一条判据的两个例子）', () => {
  /* 视频高清：本机重采样 0.5 积分/条（面值 ¥0.131） vs 画质增强大模型 2.5 元/分钟 */
  const upscale = FEATURE_SKUS.video_upscale_local_short;
  const upscaleFace = upscale.units * anchor;
  const llmEnhance30s = UPSTREAM_CNY_PER_MINUTE.qualityEnhanceLlm * 0.5;
  assert.ok(upscaleFace < llmEnhance30s,
    `本机高清一条的面值 ¥${upscaleFace.toFixed(3)} 应低于上游大模型增强 30 秒的成本 ¥${llmEnhance30s.toFixed(3)}`);
  /* 插帧：本机 fps 滤镜免费，上游 0.6 元/分钟 */
  assert.ok(UPSTREAM_CNY_PER_MINUTE.frameInterpolation > 0, '上游插帧是要钱的（我们本机免费做）');
});

test('⑤ 凭据门禁：没有 Key 时适配器不许假装能用（用户目前未充值 ⇒ 更不许乱发请求）', async () => {
  const adapter = createVolcSubtitleAdapter({ apiKey: '' });
  assert.equal(adapter.enabled, false);
  await assert.rejects(() => adapter.submit({ videoUrl: 'https://example.com/a.mp4' }),
    error => error.code === 'VOLC_SUBTITLE_NOT_CONFIGURED');
  const readiness = volcSubtitleReadiness('');
  assert.match(readiness.reason, /VOLC_MEDIAKIT_API_KEY/, '要告诉运维把 Key 放哪个变量里');
  /* 有 Key 时 enabled 为真（但"能不能真跑"由账户余额决定 —— 那是运维事实，不是代码能保证的） */
  assert.equal(createVolcSubtitleAdapter({ apiKey: 'AKLT_test' }).enabled, true);
});

test('⑥ 文档与代码同源：docs/design/71 里的关键数字必须与这份模型一致', () => {
  const doc = readFileSync(new URL('../docs/design/71-media-kit-cost-model.md', import.meta.url), 'utf8');
  for (const needle of ['0.4 元/分钟', '1 元/分钟', '0.05 积分/秒', '0.12 积分/秒', '33.3%', '−62.1%', '次日下午 6 点', '72 小时']) {
    assert.ok(doc.includes(needle), `docs/design/71 里必须写明「${needle}」（否则账目与代码会脱节）`);
  }
});
