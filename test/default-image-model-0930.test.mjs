/* ═══ 2026-09-30 批 DC 续-34：全局默认图片模型 = GPT Image 2.5 Sunburst ═════════════════════════════
   用户拍板（逐字）：「**把默认都换成 2.5 吧，这是长期比较好的做法，你可以全局去调整这个事情。**」
   随后又补充了一条关键的口径（这一条决定了整套改法）：
   > 「首页那些案例的**做同款**用的是 image2，你就把用户模型选择器带到 2 那里呀，
   >   但是后续我们给新的案例以及现在各个子页面和其他地方，**用户没有选择器可以选的时候
   >   都是默认 2.5**，因为之前确实案例是 2 跑出来的，但以后我们提供的服务都要换成 2.5 来服务呀。」

   ⇒ 两条规则，本门禁逐条钉住：
     ① **做同款带出去的模型 = 案例自己当年那条记录**，读不到才回落到 2.5 ——
        那天 30 张案例恰好都是 2 出的，所以"留在 image2"当时是对的；把它写成代码里的常量
        就把**当前正确性**写死成了**未来错误**（用户 2026-09-30 明确纠正过这一点，见 ③）；
     ② **其余一切默认 2.5** —— 46 个没有模型选择器的图片子页面、画布、首页、估算、报价、
        服务端兜底，全都走这一个默认。
   ⚠️ 服务端与前端**各有一份**常量（服务端不能 import `src/`，发布归档里没有 src/），
     所以这条门禁同时守着「两边不许走岔」。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

import { DEFAULT_IMAGE_MODEL, SELECTABLE_IMAGE_MODELS, generationUnits, imageModelResolutions } from '../src/services/imageModelCatalog.js';

const read = rel => readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
const code = rel => read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('① 默认档 = GPT Image 2.5 Sunburst，且它可计费、支持全三档', () => {
  assert.equal(DEFAULT_IMAGE_MODEL, 'image2-5-sunburst', '全局默认');
  assert.ok(SELECTABLE_IMAGE_MODELS.some(m => m.id === DEFAULT_IMAGE_MODEL),
    '默认档必须在可选目录里（否则界面上选不到、却按它跑）');
  assert.equal(generationUnits(DEFAULT_IMAGE_MODEL, '2K'), 1500, '2K 单价 1500 units = 1.5 积分');
  assert.deepEqual(imageModelResolutions(DEFAULT_IMAGE_MODEL), ['1K', '2K', '4K'],
    '换默认不能悄悄砍掉一档清晰度（image2 也是 1K/2K/4K，持平）');
});

test('② 前端目录是**唯一真源**；服务端那份只是发布归档的副本，两边不许走岔', () => {
  /* ⚠️ 这条是被真实事故逼出来的：我第一版在 `server/index.mjs` 里
     `import { DEFAULT_IMAGE_MODEL } from '../src/services/imageModelCatalog.js'`，
     被 `test/server-shipping-boundary-0926` 当场判红 —— 那条门禁说得对：
     **发布归档里没有 src/**，这一行到了线上就是 `Cannot find module`，整个服务起不来。 */
  const server = read('server/index.mjs');
  assert.doesNotMatch(server, /from '\.\.\/src\//,
    'server/** 不许 import src/（发布归档里没有 src/，线上会挂）');
  const declared = /const DEFAULT_IMAGE_MODEL = '([^']+)'/.exec(code('server/index.mjs'));
  assert.ok(declared, '服务端必须自己声明一份默认值（不能靠 import）');
  assert.equal(declared[1], DEFAULT_IMAGE_MODEL,
    '服务端那份与前端目录里的**必须一致** —— 两份各写各的，早晚走岔');
});

test('③ 做同款**逐案例读自己的记录**；没记录才回落默认 —— 不许写死 image2', () => {
  /* 用户 2026-09-30 原话：「我们以后肯定还会再添加案例进来呀。如果以后再添加其他的案例进来，
     他们的导向就是他们生成时候的各种各样的模型和配置方案呀。你不要把这个做同款给写死了，
     就是完全指向 2 啊。」
     ⚠️ 这条把本门禁原来的 ③ **反转**了：原来那版断言 `galleryModel.js` 里**必须**有 'image2'，
     等于给"写死"背书 —— 今天 30 张案例恰好都是 2 出的，所以写死碰巧是对的；
     一旦新增一张用 2.5 / Midjourney 出的案例，做同款就会拿 2 去重跑，那正是"张冠李戴"。
     ⇒ "做同款留在 image2" 只对**当时确实是 2 出的那些案例**成立：它是一条逐案例的**记录**，
     不是一条全局规则。行为自证（假案例塞 image2，必须原样带出、不能被默认的 2.5 顶掉）
     在 test/production-case-catalog.test.mjs。 */
  const src = code('src/pages/Home/galleryModel.js');
  assert.doesNotMatch(src, /'image2'/,
    'galleryModel.js 不许再出现裸 image2 —— 案例的模型是逐案例记录，不是写死的值');
  assert.match(src, /recordedImageModel/, '做同款必须从案例/资产自带的 imageModel 记录里取');
  assert.match(src, /DEFAULT_IMAGE_MODEL/, '确实没有记录时才回落全局默认（回落才是"没得选"）');
  /* 记录的**上游**也不许退化成又一个静默默认值：新增案例漏写必须报错。 */
  const manifest = code('scripts/production-visual-case-manifest.mjs');
  assert.match(manifest, /imageModel is required/,
    '生成声明里新增案例漏写 imageModel 必须报错，而不是静默套用旧模型');
  /* 而 remix（做同款）那条链在**没有记录**时应当回落到新默认 —— 那是"没得选"的情况。 */
  assert.match(code('src/pages/Home/galleryRemixModel.js'), /DEFAULT_IMAGE_MODEL/,
    'galleryRemixModel 的兜底要走新默认（案例没记模型时，按现在提供的服务 = 2.5）');
});

test('④ 前端不再有"当默认用"的裸 `image2` 字面量（provider 键与案例记录除外）', () => {
  const files = execSync('git ls-files src server', { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
    .split(/\r?\n/).map(s => s.trim()).filter(Boolean)
    .filter(f => /\.(jsx?|mjs)$/.test(f));
  const strays = [];
  for (const f of files) {
    let src;
    try { src = code(f); } catch { continue; }
    src.split('\n').forEach((line, i) => {
      if (!/'image2'/.test(line)) return;
      /* 下面几类**不是**"用户没得选时的默认"，是另外的事，放行：
         · **provider / 上游适配器名** —— `provider: 'image2'`、`IMAGE2: 'image2'`，
           以及三元里挑 provider 的那一支（`: 'image2';`）。
           2.5 走的是**同一个适配器**（`generationBillingSku` 里 `image2-5-sunburst`
           → `ec_image25_*`），改这里会打断路由。
         · 目录里 image2 **这一档自己的定义**（id/label/badge）—— 那是模型清单，不是默认值。
         · **逐案例的出图模型记录**：具名常量声明那一行
           （`const PRODUCTION_CASE_IMAGE_MODEL = 'image2'`）。它是"这批案例当年是谁出的"
           这条事实的落点，且 ③ 钉着它不许变成"新增案例漏写就静默继承"。 */
      if (/provider|adapters|IMAGE2:|IMAGE_MODEL_IDS|modelProviderRouter/.test(line)) return;
      if (/^\s*[:?]\s*'image2'/.test(line)) return;             // 三元分支（provider 选择）
      if (/^const [A-Z0-9_]*IMAGE_MODEL\s*=/.test(line)) return; // 逐案例记录用的具名常量
      if (f === 'src/services/imageModelCatalog.js' && /id: 'image2'/.test(line)) return;
      if (f === 'server/index.mjs' && /const DEFAULT_IMAGE_MODEL/.test(line)) return;
      strays.push(`${f}:${i + 1}  ${line.trim().slice(0, 80)}`);
    });
  }
  assert.deepEqual(strays, [],
    '这些地方还写死 image2，用户没选模型时就会退回旧默认：\n  ' + strays.join('\n  '));
});
