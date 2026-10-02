// test/home-lazy-modes-1001.test.mjs
// 批 CY-㊴ 之二十二（2026-10-01）。用户原话：「首页不是只有一个图片生成和视频生成
// 的入口吗？」—— 对，所以首页**默认不渲染**电商/图文那几支，它们进首屏包纯属白扛。
//
// 实测收益（服务器侧记录、1440×900、每变体 3 次取中位数）：
//   JS    571 KB → 500 KB   (−71 KB)
//   CSS    89 KB →  80 KB
//   合计 1372 KB → 1292 KB
//   渲染健康度：文字 594→594、DOM 716→716、<img> 20→20、默认视频工作台仍在、报错 0
//
// ⚠️ 这条门禁和它防的那件事都来自之二十一的白屏教训：
//   lazy 化如果**漏了 Suspense**，用户切到那个模式时就会崩；
//   而"首页默认页正常"**证明不了**这一点（默认页根本不渲染它们），
//   所以还必须单独验证这些 chunk 能不能被 import 出 default。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const home = read('src/pages/Home/index.jsx');

test('1. 三个默认不渲染的模式必须懒加载', () => {
  /* 这三个只有 mode==='content' / 'ecommerce' 时才渲染（深链进技能子页面、
     或「做同款」/ 恢复链路）。首页默认是 mode='video'，一次都不画。 */
  for (const [name, spec] of [
    ['EcMode', './EcMode'],
    ['XhsContentMode', './XhsContentMode'],
    ['DesignDirection', './ec/DesignDirection'],
  ]) {
    assert.match(home, new RegExp("const " + name + " = lazy\\(\\(\\) => import\\('" +
      spec.replace(/\//g, '\\/') + "'\\)\\);"),
      name + ' 必须改成 lazy（它默认不渲染，不该进首屏包）');
    assert.doesNotMatch(home, new RegExp("import " + name + " from"),
      name + ' 不许再有静态 import');
  }
});

test('2. 每个 lazy 都必须有 Suspense（漏了就会在切过去时崩）', () => {
  const lazyNames = ['EcMode', 'XhsContentMode', 'DesignDirection'];
  for (const name of lazyNames) {
    const used = home.match(new RegExp('<' + name + '[\\s/>]', 'g')) || [];
    assert.ok(used.length > 0, name + ' 应该被渲染（否则懒加载没有意义）');
    /* 每个使用点都必须落在 <Suspense …>…</Suspense> 里。
       做法：从使用点往前找最近的 <Suspense，往后找最近的 </Suspense>，看范围。 */
    for (const at of used.map(m => home.indexOf(m))) {
      const before = home.lastIndexOf('<Suspense', at);
      const after = home.indexOf('</Suspense>', at);
      assert.ok(before >= 0 && after > at,
        name + ' 的使用点不在任何 Suspense 里 —— 切到该模式时会因缺 fallback 报错');
    }
  }
  /* fallback 不能是 null：用户会看到"啪"地缩回去再撑开。
     ⚠️ fallback 里是 `<ModeLoading … />` 自闭合写法，匹配到 `}` 而不是 `>`。 */
  const fallbacks = home.match(/<Suspense fallback=\{[^}]*\}/g) || [];
  assert.ok(fallbacks.length >= 3, '三处 Suspense 都要有 fallback');
  for (const f of fallbacks) {
    assert.doesNotMatch(f, /fallback=\{null\}/,
      'fallback 不能是 null —— 要给一块有高度的占位，避免布局跳动');
    assert.match(f, /<ModeLoading/,
      'fallback 应当是 ModeLoading 占位（有 aria-live，屏幕阅读器也能播）');
  }
});

test('3. 默认落地的视频工作台不许被 lazy 化（它是首屏就要用的）', () => {
  /* 之二十一的教训：VideoStudio 一旦 lazy，页面**直接白屏**
     （Home ⇄ VideoStudio 循环依赖 ⇒ 懒加载拿到的 default 是 undefined）。
     而且它本来就是首屏渲染的（mode 默认 'video'），lazy 没有意义。 */
  assert.match(home, /import VideoStudioPage from '\.\.\/VideoStudio'/,
    'VideoStudioPage 必须保持静态 import');
  assert.doesNotMatch(home, /lazy\(\(\) => import\('\.\.\/VideoStudio'\)\)/,
    'VideoStudioPage 不许 lazy —— 既是首屏必需，也会因循环依赖而白屏');
  /* 默认 mode 仍是 video */
  const ctx = read('src/store/AppContext.jsx');
  assert.match(ctx, /mode:\s*'video'/,
    'AppContext 的默认 mode 必须是 video（首页落地即视频工作台）');
});

test('4. 首页只有两个入口，不许被改出第三个来', () => {
  const block = home.slice(home.indexOf('const modeOptions'), home.indexOf('const modeOptions') + 700);
  assert.match(block, /mode:\s*'video'[\s\S]*?title:\s*'视频生成'/);
  assert.match(block, /mode:\s*'visual'[\s\S]*?title:\s*'图片生成'/);
  assert.doesNotMatch(block, /mode:\s*'ecommerce'/,
    'modeOptions 里不许再出现电商入口（首页只有图片/视频两个入口）');
});