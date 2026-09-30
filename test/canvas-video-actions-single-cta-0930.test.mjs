// test/canvas-video-actions-single-cta-0930.test.mjs
// 批 CY-㊴：画布视频生成面板 —— **任何时刻只有一个主按钮** + 「技能」不许出现两次
// 用户 2026-09-30 逐字：
//   「为什么会有两个生成按钮呢？一个是分析并生成方案，一个是生成视频。
//     你首页那边生成视频的这个板块明明只有一个按钮呀……」
//   「而且你这个技能的这个按钮上面怎么还有一个技能呀？」
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const studio = read('src/pages/EcCanvas/components/CanvasStudio.jsx');
const videoStudio = read('src/pages/VideoStudio/index.jsx');

/** 取 CanvasVideoComposer 的函数体 */
function videoComposerSource() {
  const start = studio.indexOf('export function CanvasVideoComposer(');
  assert.ok(start > 0, '找不到 CanvasVideoComposer');
  const rest = studio.slice(start + 1);
  const end = rest.indexOf('\nexport function ');
  return rest.slice(0, end > 0 ? end : 9000);
}

test('① 未确认方案时**只渲染**「分析并生成方案」，不是把它置灰', () => {
  const body = videoComposerSource();
  const actions = body.match(/<div className="ec-canvas-video-actions">[\s\S]*?<\/div>\s*$/m) || body.match(/<div className="ec-canvas-video-actions">[\s\S]{0,2600}?\n      <\/div>/);
  assert.ok(actions, '找不到 ec-canvas-video-actions 块');
  const block = actions[0];
  /* 互斥的判据：主 CTA 必须落在 !planReviewed 的 false 分支里 */
  assert.match(block, /\{!node\.planReviewed/, '两个按钮必须由 planReviewed 互斥');
  assert.match(block, /: <>/, '已确认分支要放两个按钮（查看方案 + 开始生成）');
  /* 关键：主 CTA 那一行必须出现在 : <> 之后、未确认分支之外 */
  const ternarySplit = block.indexOf(': <>');
  const ctaAt = block.indexOf('ec-canvas-composer-cta');
  assert.ok(ternarySplit > 0, '找不到互斥的 else 分支');
  assert.ok(ctaAt > ternarySplit, '「生成视频/开始生成」主按钮必须在**已确认方案**分支里，未确认时压根不渲染');
  /* 且未确认分支里不能再出现第二个按钮 */
  const beforeTernary = block.slice(0, ternarySplit);
  assert.ok(!/ec-canvas-composer-cta/.test(beforeTernary), '未确认方案分支里不许出现主 CTA');
});

test('② 主按钮文案要与首页同一口径（「开始生成」，不是「生成视频」）', () => {
  const body = videoComposerSource();
  assert.match(body, /<Clapperboard size=\{15\} \/>开始生成/, '画布主按钮 = 开始生成');
  assert.doesNotMatch(body, /<Clapperboard size=\{15\} \/>生成视频/, '不许再写「生成视频」');
  /* 首页同一口径（互斥 + 开始生成） */
  assert.match(videoStudio, /\{!planReviewed \?/, '首页也是 planReviewed 互斥');
  assert.match(videoStudio, /'开始生成'/, '首页主按钮 = 开始生成');
});

test('③ 「技能」在视频面板里只许出现一次（控件自带标题，外面不许再写一遍）', () => {
  const body = videoComposerSource();
  assert.doesNotMatch(body, /<label className="ec-canvas-video-field">技能/,
    '不许再套一层写死「技能」的 label —— CanvasSkillControl 的触发器标题本身就是「技能」');
  assert.match(body, /<CanvasSkillControl[^>]*domain="video"/, '技能控件本身要在（它自带标题 + 值）');
  /* 对照组：图片侧一直是直接渲染控件、没有那层 label（所以只有视频面板中招） */
  assert.doesNotMatch(studio, /<label[^>]*>技能<CanvasSkillControl/,
    '全仓都不许出现"label 写死技能 + CanvasSkillControl"的组合');
});

test('④ 未确认方案时，主按钮的 disabled 条件里不该再出现 planReviewed（已经分支出去了）', () => {
  const body = videoComposerSource();
  const cta = body.match(/className="shubao-gen-cta ec-canvas-composer-cta" disabled=\{([^}]*)\}/);
  assert.ok(cta, '找不到主 CTA 的 disabled 条件');
  assert.doesNotMatch(cta[1], /planReviewed/, '已在互斥分支里，再判一次 planReviewed 是冗余且会误导');
});
