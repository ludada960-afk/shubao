/* ═══ 2026-09-30 批 DC 续-34：全局默认图片模型 = GPT Image 2.5 Sunburst ═════════════════════════════
   用户拍板（逐字）：「**把默认都换成 2.5 吧，这是长期比较好的做法，你可以全局去调整这个事情。**」
   随后又补充了一条关键的口径（这一条决定了整套改法）：
   > 「首页那些案例的**做同款**用的是 image2，你就把用户模型选择器带到 2 那里呀，
   >   但是后续我们给新的案例以及现在各个子页面和其他地方，**用户没有选择器可以选的时候
   >   都是默认 2.5**，因为之前确实案例是 2 跑出来的，但以后我们提供的服务都要换成 2.5 来服务呀。」

   ⇒ 两条规则，本门禁逐条钉住：
     ① **做同款 / 案例回放留在 image2** —— 那些图就是 2 出的，改了就成"张冠李戴"；
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

test('③ 做同款 / 案例回放**留在 image2**（那些图就是 2 出的）', () => {
  /* 用户原话：「首页那些案例的做同款用的是 image2……但是后续我们给新的案例以及现在各个子页面
     和其他地方，用户没有选择器可以选的时候都是默认 2.5」。
     ⇒ 回放路径是**事实记录**，不是默认值；把它一起改成 2.5 就成了"张冠李戴"。 */
  for (const file of ['src/pages/Home/galleryModel.js', 'scripts/production-visual-case-manifest.mjs']) {
    const src = code(file);
    assert.match(src, /'image2'/, file + '：案例回放必须仍标 image2（它记录的是"这张图当年是谁出的"）');
  }
  /* 而 remix（做同款）那条链在**没有记录**时应当回落到新默认 —— 那是"没得选"的情况。 */
  assert.match(code('src/pages/Home/galleryRemixModel.js'), /DEFAULT_IMAGE_MODEL/,
    'galleryRemixModel 的兜底要走新默认（案例没记模型时，按现在提供的服务 = 2.5）');
});

test('④ 前端不再有"当默认用"的裸 `image2` 字面量（provider 键与案例记录除外）', () => {
  const files = execSync('git ls-files src server', { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
    .split(/\r?\n/).map(s => s.trim()).filter(Boolean)
    .filter(f => /\.(jsx?|mjs)$/.test(f) && f !== 'src/pages/Home/galleryModel.js');
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
         · 案例回放（已单列在 ③）。 */
      if (/provider|adapters|IMAGE2:|IMAGE_MODEL_IDS|modelProviderRouter/.test(line)) return;
      if (/^\s*[:?]\s*'image2'/.test(line)) return;             // 三元分支（provider 选择）
      if (f === 'src/services/imageModelCatalog.js' && /id: 'image2'/.test(line)) return;
      if (f === 'server/index.mjs' && /const DEFAULT_IMAGE_MODEL/.test(line)) return;
      strays.push(`${f}:${i + 1}  ${line.trim().slice(0, 80)}`);
    });
  }
  assert.deepEqual(strays, [],
    '这些地方还写死 image2，用户没选模型时就会退回旧默认：\n  ' + strays.join('\n  '));
});
