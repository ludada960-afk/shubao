import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { VIDEO_WORKBENCHES } from '../src/skills/videoWorkbenches.js';
import { specExposureOf } from '../src/skills/videoSpecExposure.js';
import { durationOptionOverrides, isVideoDurationSupported, snapVideoDuration } from '../src/pages/VideoStudio/videoStudioModel.js';
import { VIDEO_PRODUCTS, durationOptionsOf } from '../server/videoCatalog.mjs';

/* ═══ 2026-10-03 批 DE：视频子页面「同一个设置不许画两遍」的门禁 ═════════════════════════════════
   起因（用户 2026-10-03 截图，服装街拍带货那一页）：左栏「比例 / 时长」已经铺成一排药丸，
   下面却又顶着一颗收起的「生成设置 720P · 9:16 · 10s」—— 同一件事给了两个入口。

   交接单上留的问题是「两边的 onChange 是不是写进同一个 state、请求里最终取哪个」。
   本门禁把查清的结论**钉成断言**（原来只有一句人写的结论，改坏了没人知道）：
     ① 同一份 state：左栏药丸（onValueChange）与底栏面板（setRatio / setDuration / selectClarity）
        写的是同一组 ratio / duration / resolution；
     ② 请求取的就是这一份：按钮摘要、方案签名 planSignature、报价、请求体
        （createVideoJob 的 aspectRatio / duration / resolution）全读它
        ⇒ **不存在"谁说了算"**，两处永远同步；
     ③ 同一格只画一处：工作台声明里 bind 过 ratio / duration ⇒ 底栏不再画那一格；
        一组都不剩时那颗触发器也不画（空面板比重复更糟）；
     ④ 判据是"声明里有没有那个 bind"，不是技能名单 —— 名单写两处必然漂移（本仓老教训）。 */

const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const page = source('../src/pages/VideoStudio/index.jsx');
const css = source('../src/pages/VideoStudio/VideoStudio.css');

const bindsOf = spec => new Set((spec.blocks || []).map(block => block.bind).filter(Boolean));
const products = Object.values(VIDEO_PRODUCTS);

/* 与页面 settingsGroups 同一套判据（纯函数版，门禁自己重算一遍而不是读页面的中间变量 ——
   页面那份要靠 React 才跑得到，这里要能逐条对着 56 页说清楚）。 */
function settingsGroupsOf(spec) {
  const exposure = specExposureOf(spec.id);
  const binds = bindsOf(spec);
  const groups = [];
  if (exposure.clarity && !binds.has('resolution')) groups.push('clarity');
  if (!binds.has('ratio')) groups.push('ratio');
  if (exposure.duration && !binds.has('duration')) groups.push('duration');
  return groups;
}

test('① 两处入口写的是同一份 state（左栏药丸 = 底栏面板 = 触发器摘要）', () => {
  /* 左栏药丸的值与回写都在同一组 state 上，没有第二份 ratio/duration 影子状态。 */
  assert.match(page, /values=\{\{ ratio, duration, swapMode: swapTarget, resolution, fps: outputFps, markMode \}\}/,
    'VideoWorkbench 的当前值必须直接来自 ratio / duration / resolution');
  assert.match(page, /if \(bind === 'ratio'\) setRatio\(String\(value\)\);/);
  assert.match(page, /else if \(bind === 'duration'\) setDuration\(snapVideoDuration\(selectedProduct, Number\(value\) \|\| 5\)\);/,
    '左栏时长药丸必须与底栏滑块走同一个 snap（不 snap 就能点出报不出价的秒数，见 ④）');
  assert.match(page, /else if \(bind === 'resolution'\) setResolution\(String\(value\)\);/);
  /* 底栏那一组也写同一组：清晰度走 selectClarity（它 setResolution），比例走 setRatio，时长走 setDuration。 */
  assert.match(page, /const selectClarity = useCallback\(value => \{[\s\S]*?setResolution\(value\);[\s\S]*?\}, \[activeRow, selectedProduct\?\.id\]\);/);
  /* 触发器上那颗「720P · 9:16 · 10s」也读同一组。 */
  assert.match(page, /settings: `\$\{resolution\.toUpperCase\(\)\} · \$\{ratio\} · \$\{duration\}s`/);
});

test('② 请求 / 报价 / 方案签名读的就是这一份（不存在"选了 A 跑出 B"）', () => {
  assert.match(page, /const planSignature = useMemo\(\(\) => JSON\.stringify\(\{[\s\S]*?duration, ratio, resolution,/,
    '方案签名必须含这三个值，否则改完规格还能拿旧方案的确认去生成');
  assert.match(page, /return quoteForVideoProduct\(selectedProduct, duration\);/);
  assert.match(page, /createVideoJob\(\{[\s\S]*?duration,\s*\n\s*aspectRatio: ratio,\s*\n\s*resolution,/,
    '建单请求必须逐项取 ratio / duration / resolution 这三个 state');
});

test('③ 同一格只画一处：左栏声明过的格子，底栏那一组不再出现', () => {
  const duplicated = [];
  for (const [id, spec] of Object.entries(VIDEO_WORKBENCHES)) {
    const binds = bindsOf(spec);
    const groups = settingsGroupsOf({ id, ...spec });
    if (binds.has('ratio') && groups.includes('ratio')) duplicated.push(`${id} 的比例画了两遍`);
    if (binds.has('duration') && groups.includes('duration')) duplicated.push(`${id} 的时长画了两遍`);
    if (binds.has('resolution') && groups.includes('clarity')) duplicated.push(`${id} 的清晰度画了两遍`);
  }
  assert.deepEqual(duplicated, [], `底栏仍在重画左栏已有的格子：\n${duplicated.join('\n')}`);

  /* 页面上三组与触发器都走这一份判据，不许各写各的。 */
  assert.match(page, /settingsGroups\.includes\('clarity'\)/);
  assert.match(page, /settingsGroups\.includes\('ratio'\)/);
  assert.match(page, /settingsGroups\.includes\('duration'\)/);
  assert.match(page, /!\(item\.key === 'settings' && !settingsGroups\.length\)/,
    '面板一组都不剩时那颗触发器也不画（空面板比重复更糟）');
  assert.match(page, /if \(activePanel === 'settings' && !settingsGroups\.length\) return null;/);
  /* 清晰度那一格原来在面板里单算一遍（`specExposure.clarity && !pageOwnsField('resolution')`）。
     现在它只允许作为 settingsGroups 里的**第一行**存在 —— 出现第二次就说明判据又分叉了。 */
  assert.equal(
    (page.match(/specExposure\.clarity && !pageOwnsField\('resolution'\)/g) || []).length, 1,
    '清晰度的露不露只允许在 settingsGroups 里判一次',
  );
  assert.match(page, /const settingsGroups = useMemo\(\(\) => \{[\s\S]*?specExposure\.clarity && !pageOwnsField\('resolution'\)[\s\S]*?pageOwnsField\('ratio'\)[\s\S]*?pageOwnsField\('duration'\)/);

  /* 一格都不剩的页数（写下来是为了让人知道这次改动动了多少页，而不是让人改它）。 */
  const empty = Object.entries(VIDEO_WORKBENCHES).filter(([id, spec]) => settingsGroupsOf({ id, ...spec }).length === 0);
  assert.ok(empty.length >= 40, `预期 40+ 页的面板会一格不剩，实际 ${empty.length}`);
});

test('④ 剩下的那一格必须合法：左栏时长药丸给不出报不出价的秒数', () => {
  /* 复现路径（改代码前真实存在的）：某页声明 [10,15]，型号只认到 10 秒 ⇒ 点「15 秒」
     → quoteForVideoProduct 抛异常 → sku 为空 → 生成按钮永久变灰。 */
  const narrows = products.filter(product => !isVideoDurationSupported(product, 15));
  assert.ok(narrows.length > 0, '本仓确有只认不到 15 秒的型号，这条门禁才有意义');

  let checked = 0;
  for (const [id, spec] of Object.entries(VIDEO_WORKBENCHES)) {
    const blocks = spec.blocks || [];
    const declared = blocks.find(block => block.bind === 'duration');
    if (!declared) continue;
    for (const product of products) {
      const overrides = durationOptionOverrides(blocks, product) || {};
      for (const option of declared.options || []) {
        checked += 1;
        const key = `${declared.key}:${option.value}`;
        const supported = isVideoDurationSupported(product, Number(option.value));
        if (supported) {
          assert.equal(overrides[key], undefined, `${id} 在 ${product.id} 上不该禁 ${option.value} 秒（它支持）`);
          continue;
        }
        /* 不可点 ⇒ 点不进去 ⇒ 那个非法秒数永远到不了 state ⇒ 报价永远拿得到。
           顺带钉住"禁用必须带原因"——批 AM：不给用户一句为什么。 */
        assert.equal(overrides[key]?.disabled, true, `${id} 在 ${product.id} 上的「${option.value} 秒」应不可点`);
        assert.match(String(overrides[key]?.reason || ''), /只支持/,
          `${id} / ${product.id} 的禁用理由要写清当前型号支持哪几档`);
        /* 写入路径那一层也要夹得住（防止覆写键与声明源脱节）。 */
        assert.equal(
          snapVideoDuration(product, Number(option.value)),
          snapVideoDuration(product, Number(option.value)),
        );
        assert.ok(isVideoDurationSupported(product, snapVideoDuration(product, Number(option.value))),
          `${id} 在 ${product.id} 上 snap 之后仍是非法秒数`);
      }
    }
  }
  assert.ok(checked > 40, `应逐条核对几十个（页 × 型号 × 档位）组合，实际 ${checked}`);

  /* live_photo 只认 5 秒 —— 声明源里 15 秒那一档在它上面必须被夹住。 */
  const livePhoto = VIDEO_PRODUCTS.live_photo;
  assert.deepEqual(durationOptionsOf(livePhoto), [5]);
  const overrides = durationOptionOverrides(VIDEO_WORKBENCHES['video.traffic_swap'].blocks, livePhoto);
  assert.equal(overrides['duration:10']?.disabled, true);
  assert.equal(overrides['duration:15']?.disabled, true);
});

test('⑤ 底栏网格的列数跟着实际颗数走（只剩一颗时不能占掉半行）', () => {
  assert.match(page, /'--video-toolbar-columns': String\(toolbarTriggerCount\)/);
  assert.match(css, /repeat\(var\(--video-toolbar-columns, 2\), minmax\(0, 1fr\)\)/,
    'workbench 形态那一行的列数由页面给，缺省仍是 2（首页 / 独立创作台）');
  assert.match(page, /\{toolbarTriggerCount > 0 && <div/, '一颗都不露时整块不渲染');
});
