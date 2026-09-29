import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

/* ══════════════════════════════════════════════════════════════════════════════
   视频比例白名单在**七个地方**各自声明了一份（批 CY-㉒ 实测）：
     src/pages/EcCanvas/components/CanvasStudio.jsx      VIDEO_ASPECT_OPTIONS
     src/pages/VideoStudio/index.jsx                      RATIOS
     src/pages/VideoStudio/VideoCanvasWorkbench.jsx       RATIOS
     src/skills/videoWorkbenches.js                       RATIO_EC
     src/skills/videoWorkbenches.js                       RATIO_INTERIOR
     src/skills/videoWorkbenches.js                       RATIO_INTERIOR_WIDE
     src/skills/videoWorkbenches.js                       RATIO_TALK

   权威是**服务端**：`server/videoGeneration.mjs:44`
     const RATIOS = new Set(['21:9','16:9','4:3','1:1','3:4','9:16']);

   我实测过：截至本提交，七处**没有一处给出服务端不认的比例**（0 drift）。
   收窄的三处（RATIO_EC / RATIO_INTERIOR / RATIO_TALK 少了 21:9）也**不是漏项** ——
   那是照抄知渔那一页的实测档位（videoWorkbenches.js:38-49 写明了出处与顺序敏感性）。

   ⇒ 所以这不是一个现在该改的 bug，而是**七份手抄本没有护栏**。
   服务端哪天加一档（比如 3:2），客户端就会开始提供服务端不认的比例 ⇒
   用户选了一个会被静默改写的比例 —— 正是用户反复报的「看着是 A、跑的是 B」。

   这条门禁的作用：**客户端只许给服务端认得的档位**（不许多），
   至于「少给」那是产品决策（收窄），本门禁不干预，但会在输出里列出来让人看见。
   ══════════════════════════════════════════════════════════════════════════════ */

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

function serverRatios() {
  const src = read('server/videoGeneration.mjs');
  const m = /const RATIOS = new Set\(\[([^\]]+)\]\)/.exec(src);
  assert.ok(m, 'server/videoGeneration.mjs 里必须还能找到 RATIOS 的声明（它是权威）');
  return m[1].split(',').map(s => s.trim().replace(/^'|'$/g, ''));
}

const SITES = [
  ['src/pages/EcCanvas/components/CanvasStudio.jsx', 'VIDEO_ASPECT_OPTIONS', /const VIDEO_ASPECT_OPTIONS = Object\.freeze\(\[([^\]]+)\]\)/],
  ['src/pages/VideoStudio/index.jsx', 'RATIOS', /const RATIOS = \[([^\]]+)\]/],
  ['src/pages/VideoStudio/VideoCanvasWorkbench.jsx', 'RATIOS', /const RATIOS = \[([^\]]+)\]/],
  ['src/skills/videoWorkbenches.js', 'RATIO_EC', /const RATIO_EC = \[([^\]]+)\]/],
  ['src/skills/videoWorkbenches.js', 'RATIO_INTERIOR', /const RATIO_INTERIOR = \[([^\]]+)\]/],
  ['src/skills/videoWorkbenches.js', 'RATIO_INTERIOR_WIDE', /const RATIO_INTERIOR_WIDE = \[([^\]]+)\]/],
  ['src/skills/videoWorkbenches.js', 'RATIO_TALK', /const RATIO_TALK = \[([^\]]+)\]/],
];

function declaredValues(file, re) {
  const src = read(file);
  const m = re.exec(src);
  assert.ok(m, `${file} 里必须还能找到该常量（若它被重命名/删除，请同步更新本门禁的 SITES）`);
  return m[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}

test('① 服务端白名单本身是自洽的（六个合法比例，无重复无空值）', () => {
  const ratios = serverRatios();
  assert.ok(ratios.length > 0, '服务端白名单不能为空');
  assert.equal(new Set(ratios).size, ratios.length, '服务端白名单里有重复项');
  for (const r of ratios) {
    const parts = r.split(':');
    assert.equal(parts.length, 2, `比例 "${r}" 必须是 a:b 两段`);
    for (const p of parts) assert.ok(Number(p) > 0, `比例 "${r}" 的每一段都必须是正数`);
  }
});

test('② 七处客户端声明里，没有任何一处给出服务端不认的比例', () => {
  const server = new Set(serverRatios());
  const offenders = [];
  for (const [file, name, re] of SITES) {
    for (const value of declaredValues(file, re)) {
      if (!server.has(value)) offenders.push(`${file} :: ${name} -> "${value}"`);
    }
  }
  assert.deepEqual(
    offenders, [],
    '这些档位服务端不认 ⇒ 用户能选到一个会被静默改写的比例（界面显示 A、实际跑 B）：\n  '
      + offenders.join('\n  '),
  );
});

test('③ 每一份声明的**顺序**也被钉住（比例档位是顺序敏感的，照抄竞品时不能串）', () => {
  /* RATIO_TALK 的顺序与 RATIO_EC **故意不同**（videoWorkbenches.js:45-49 记了原因：
     知渔「趣味脱口秀」那页实测是 9:16/16:9/**4:3/3:4/1:1**，照短剧那套写成 1:1/3:4/4:3
     时门禁直接报「比例档位对不上」）。顺序敏感 ⇒ 逐值比对，不许排序后比。 */
  const expected = {
    'src/pages/EcCanvas/components/CanvasStudio.jsx|VIDEO_ASPECT_OPTIONS': ['9:16', '16:9', '1:1', '4:3', '3:4', '21:9'],
    'src/pages/VideoStudio/index.jsx|RATIOS': ['9:16', '16:9', '1:1', '4:3', '3:4', '21:9'],
    'src/pages/VideoStudio/VideoCanvasWorkbench.jsx|RATIOS': ['9:16', '16:9', '1:1', '4:3', '3:4', '21:9'],
    'src/skills/videoWorkbenches.js|RATIO_EC': ['9:16', '16:9', '1:1', '3:4', '4:3'],
    'src/skills/videoWorkbenches.js|RATIO_INTERIOR': ['1:1', '3:4', '4:3', '9:16', '16:9'],
    'src/skills/videoWorkbenches.js|RATIO_INTERIOR_WIDE': ['1:1', '3:4', '4:3', '9:16', '16:9', '21:9'],
    'src/skills/videoWorkbenches.js|RATIO_TALK': ['9:16', '16:9', '4:3', '3:4', '1:1'],
  };
  for (const [file, name, re] of SITES) {
    const actual = declaredValues(file, re);
    assert.deepEqual(
      actual, expected[`${file}|${name}`],
      `${file} :: ${name} 的档位或顺序变了。\n`
        + '若这是有意的（比如照新的竞品实测改了顺序），请把新顺序同步写进门禁并在 RTK 记下依据；\n'
        + '若不是，那就是「照抄竞品时串了顺序」—— 用户会看到与竞品不同的档位排列。',
    );
  }
});

test('④ 收窄的三处必须仍然写明「这是照抄竞品的实测档位」，不许变成无人解释的少数派', () => {
  /* RATIO_EC / RATIO_INTERIOR / RATIO_TALK 都比服务端少 21:9。
     那是**有意的**（竞品那几页就没有 21:9），但它必须是**看得见的决定**，
     而不是「手抄时漏了一档」—— 两者在界面上长得一模一样。 */
  const src = read('src/skills/videoWorkbenches.js');
  for (const name of ['RATIO_EC', 'RATIO_INTERIOR', 'RATIO_TALK']) {
    const values = declaredValues('src/skills/videoWorkbenches.js', new RegExp(`const ${name} = \\[([^\\]]+)\\]`));
    const server = serverRatios();
    const narrowed = server.filter(v => !values.includes(v));
    if (!narrowed.length) continue;
    const idx = src.indexOf(`const ${name} = `);
    /* 往前回看 900 字：出处与理由应当在这一段里 */
    const context = src.slice(Math.max(0, idx - 900), idx);
    assert.match(
      context, /知渔|竞品|实测/,
      `${name} 收窄掉了 ${narrowed.join(' ')}，但它上面没有写明依据。\n`
        + '收窄是产品决策、手抄漏项是事故 —— 两者在界面上完全一样，只差这一句注释。',
    );
  }
});

test('⑤ 画布视频框与 VideoStudio 用的是同一份全集（不一致会让同一个比例在两处表现不同）', () => {
  const canvas = declaredValues('src/pages/EcCanvas/components/CanvasStudio.jsx', /const VIDEO_ASPECT_OPTIONS = Object\.freeze\(\[([^\]]+)\]\)/);
  const studio = declaredValues('src/pages/VideoStudio/index.jsx', /const RATIOS = \[([^\]]+)\]/);
  const workbench = declaredValues('src/pages/VideoStudio/VideoCanvasWorkbench.jsx', /const RATIOS = \[([^\]]+)\]/);
  assert.deepEqual(canvas, studio, '画布与视频工作台的比例档位必须一致');
  assert.deepEqual(canvas, workbench, '画布与视频工作台子页的比例档位必须一致');
  // 三处都应等于服务端全集
  assert.deepEqual([...canvas].sort(), [...serverRatios()].sort(),
    '这三处应当正好是服务端白名单的全集（收窄的活儿只在 videoWorkbenches 那一族里做）');
});
