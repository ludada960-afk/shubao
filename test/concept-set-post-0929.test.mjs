import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/* ═══ 2026-09-28 批 DC 续-7 门禁：一次下单 = 一篇图文；张数写在脸上；六处界面问题 ═════════════
   用户 2026-09-28 当面提的问题（逐字，两条）：
     ① 「它到底生成的是一整套的小红书图片还是一张一张的生成呢？……**因为你这个工作台里面并没有给我
        张数呀。我根本就不知道你产出的到底是多少张**？」
     ② 「如果你要产出的是一整套的小红书图文的话，那肯定是**文案一起出**的话会更加统一吧……
        **很有可能你先去生成图片，然后再拿图片去生成文案，这样的话会很混乱**。」
   本文件把这两条 + 那六处界面批注逐条钉住。判据分两类，**不混**：
     · 能**算**的用纯函数跑（张数、预设、报价、请求体）；
     · 只能**读源码**的用正则咬住关键那几行（界面文案、样式数值、接线顺序）。
   ⚠️ 本文件**不许**断言"页面长得好看"—— 那是人眼的事；这里只保证"源码约定没被改回去"。 */
import { CONCEPT_DEFAULT_PRESET, CONCEPT_SHOT_MODULES, CONCEPT_SHOT_PRESETS, getImageSkill } from '../src/skills/imageSkills.js';
import {
  buildSkillCopyRequest,
  initialSkillValues,
  skillBatchQuote,
  skillCopyShouldRun,
  skillGenerationSettings,
  skillInitialModuleOff,
  skillPointsEstimate,
  skillShotMix,
} from '../src/skills/skillRun.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFileSync(join(ROOT, relative), 'utf8');
const SHELL = read('src/components/media/WorkbenchShell.jsx');
const SHELL_CSS = read('src/components/media/WorkbenchShell.css');
const PAGE = read('src/pages/MediaCreation/index.jsx');
const SIDEBAR = read('src/styles/app-sidebar.css');
const FIELD = read('src/components/media/FieldRenderer.jsx');

const skill = getImageSkill('image.concept_set');
const modules = CONCEPT_SHOT_MODULES();
const seed = initialSkillValues(skill);

test('① 三档规模预设 = 轻量 4 / 标准 6 / 完整 10，且默认是「标准」', () => {
  const presets = CONCEPT_SHOT_PRESETS();
  assert.deepEqual(presets.map(item => item.count), [4, 6, 10], '三档的��量（实测口径：单篇 4~18 张、均值 10.3）');
  assert.equal(CONCEPT_DEFAULT_PRESET, 'standard', '默认必须是中间那一档（用户已拍板）');
  assert.equal(presets.find(item => item.value === CONCEPT_DEFAULT_PRESET).count, 6);
  /* ⚠️ 预设**不许手写手法名单**：声明源是 CONCEPT_SHOT_MODULES 派生的前 N 个。
     手写名单必然与手法表漂（增删档位时三档会指向不存在的名字）。 */
  presets.forEach(preset => {
    assert.ok(preset.count <= modules.length, '预设张数不能超过手法总数');
    assert.ok(String(preset.hint || '').length >= 4, '每一档都要有一句人话（用户点之前看得见差别）');
  });
  assert.equal(skill.modulesPresets.length, presets.length, '声明源要把三档交给页面（skillInitialModuleOff 读它）');
});

test('② 进页面就按「标准」勾好 6 张 —— 这是「没有张数」那条投诉的根因修复', () => {
  const off = skillInitialModuleOff(skill, modules);
  const on = modules.filter(module => !off.has(module.name));
  assert.equal(on.length, 6, '默认必须勾满 6 张（原来一个都不勾、CTA 是灰的）');
  assert.equal(skillGenerationSettings(skill, { ...seed, count: on.length }).count, 6,
    '勾 6 种 ⇒ 下发 6 张（勾选 → 张数那条链是唯一入口）');
  /* 没有 modulesPresets 的技能照旧"一个都不勾"（批 AW 用户拍板：A+ 内容的 16 个模块不默认勾）。
     这一条不许被 ① 的改动顺手改掉 —— 两处是两次不同的用户口径。 */
  const other = getImageSkill('image.brand_kv');
  const otherModules = Array.isArray(other.modules) ? other.modules : [];
  if (otherModules.length) {
    assert.equal(skillInitialModuleOff(other, otherModules).size, otherModules.length,
      '没声明 modulesPresets 的技能仍然默认全不勾（批 AW 用户原话「跟他们一样做就好」）');
  }
});

test('③ 清单块标题把「这一篇几张」写在脸上（页面上不许只剩「已选 6/10」）', () => {
  assert.match(SHELL, /这一篇 \$\{checkedCount\} 张/, '清单标题必须先说这一篇几张');
  assert.match(SHELL, /已选 \$\{checkedCount\}\/\$\{section\.items\.length\}/, '再跟上勾选进度');
  assert.match(SHELL, /selectable \? `这一篇/, '只读清单块沿用原措辞（不是每条技能都改一遍）');
});

test('④ 主按钮写清单价与总额：`6 张 × 2 + 文案 0.5 = 12.5 积分`', () => {
  const values = { ...seed, count: 6 };
  const quote = skillBatchQuote(skill, values, { copyPoints: 0.5 });
  assert.equal(quote.count, 6, '报价里的张数就是这一篇的张数');
  assert.equal(quote.imagePoints, skillPointsEstimate(skill, values), '图那一项与既有报价同一个函数算出来');
  assert.equal(quote.total, Number((quote.imagePoints + 0.5).toFixed(2)), '总额 = 图 + 文案（**相加**，不是两次确认）');
  assert.match(quote.detail, /^6 张 × [\d.]+ \+ 文案 0\.5 = [\d.]+ 积分$/, '一句话里说清张数、单价、总额');
  /* 关掉文案开关时，同一句话不能塌成裸数字（用户还是在按张买图） */
  const noCopy = skillBatchQuote(skill, values, { copyPoints: 0 });
  assert.equal(noCopy.detail, `6 张 × ${noCopy.perImage} = ${noCopy.imagePoints} 积分`);
  assert.match(SHELL, /ctaPriceNote/, '按钮副行优先显示这一句（没给 ctaPriceNote 的技能一个字不变）');
  assert.match(PAGE, /ctaPriceNote=\{handoff \|\| !batchQuote \|\| \(skill\.previewStep && !planApplied\) \? '' : batchQuote\.detail\}/,
    '预览步不给整单报价（那 0.5 是"预览这一步"的钱，报整单会误导 —— 用户批注 #3-6）');
});

test('⑤ 文案与图**同源**：同一份 brief 的摘要，请求体里没有任何图片地址', () => {
  /* ⚠️ 2026-09-29 批 DC 续-16：人物形态**逐张**之后没有"这一篇的人物形态"了。
     文案是**篇级**的那一跳，它拿到的是这一篇出现**最多**的那一档（众数）。 */
  const shotNames6 = modules.slice(0, 6).map(m => m.name);
  const shotPerson6 = skillShotMix(skill, shotNames6).map(row => row.person);
  const request = buildSkillCopyRequest(skill, {
    ...seed, shots: modules.slice(0, 6).map(m => m.value), shotNames: shotNames6, shotPerson: shotPerson6,
  });
  assert.ok(request.theme, '母体必须带（服务端要它）');
  assert.equal(request.shots.length, 6, '带的是这一篇那 6 种手法');
  const tally = {};
  for (const p of shotPerson6) tally[p] = (tally[p] || 0) + 1;
  const modal = Object.keys(tally).sort((a, b) => tally[b] - tally[a] || shotPerson6.indexOf(a) - shotPerson6.indexOf(b))[0];
  assert.equal(request.person, modal, '文案那一跳带的是这一篇的**众数**人物形态（篇级概括，不是逐张）');
  assert.ok(request.person, '人物形态不能整段丢掉（那会让文案失去"这篇有没有人"的信号）');
  /* ⚠️ 这是本批最关键的一条判据：文案**不许看图**。
     一旦请求体里出现任何图片地址，模型就会退化成"图片说明"
     （"这是一张木桌上的白瓷器"）—— 那是最烂的小红书文案。
     用户原话：「很有可能你先去生成图片，然后再拿图片去生成文案，这样的话会很混乱。」 */
  assert.equal(request.imageUrl, '', '不许传图（imageUrl 恒空）');
  assert.deepEqual(request.referenceImages, [], '不许传参考图');
  const json = JSON.stringify(request);
  assert.doesNotMatch(json, /https?:\/\/|\/api\/generated-assets|data:image|\.jpg|\.png|\.webp/,
    '整个请求体里不许出现任何图片地址（正则兜底，防将来加了别的键）');
  assert.equal(request.attempt, 0, '随篇首发 = 第 0 版（与「再来一版」的 1,2… 不撞幂等键）');
});

test('⑥ 一次提交 = 一个确认框 + 图文**并行**，不是两次确认、不是串行', () => {
  const body = PAGE.slice(PAGE.indexOf('async function generate()'), PAGE.indexOf('function generateSuite('));
  assert.equal((body.match(/dialog\.confirm\(/g) || []).length, 1, '这一跳只弹一次确认');
  assert.match(body, /quote\.detail/, '确认框里要写清单价与总额那一行');
  assert.match(body, /某一张没跑成只退那一张/, '逐张隔离照旧要在确认框里说清');
  assert.match(body, /Promise\.all\(\[/, '图与文案并行发起（出图 20~40 秒、文案 3~5 秒，串起来是加法）');
  assert.match(body, /runPostCopy\(0\)/, '随篇首发那一跳是 attempt 0');
  /* 开关：默认开，关掉之后**这一页一个字都不变**（连确认框都不弹） */
  assert.match(PAGE, /useState\(true\);[\s\S]{0,400}postCopyEnabled/, '文案开关默认开（用户定的口径：一套图文要一起出）');
  assert.match(PAGE, /copySupported = skill \? skillCopyShouldRun\(skill, \{ \.\.\.effectiveValues, postCopyEnabled: true \}\) : false/,
    '「支不支持」与「这一次要不要」要分开判，否则关掉开关就再也开不回来');
  assert.equal(skillCopyShouldRun(skill, { postCopyEnabled: false }), false, '关掉 = 这一次不出');
  assert.equal(skillCopyShouldRun(skill, { postCopyEnabled: true }), true);
  assert.equal(skillCopyShouldRun(getImageSkill('image.brand_kv'), { postCopyEnabled: true }), false,
    '别的技能不许长出这颗开关');
});

test('⑦ 文案失败**不动图那一份**：它的 catch 里不许碰 run', () => {
  const fetcher = PAGE.slice(PAGE.indexOf('async function runPostCopy('), PAGE.indexOf('async function writePostCopy('));
  assert.doesNotMatch(fetcher, /setRun\(|updateVisualRunSlot\(|setModuleOff\(|setValues\(/,
    '文案这一跳只准动文案自己的 state（图那 N 张的 hold 与状态一律不碰）');
  assert.match(fetcher, /setPostCopy\(/, '失败要落在文案自己的结果位上');
  assert.match(fetcher, /不扣积分/, '失败要如实说没有扣积分');
});

test('⑧ 参考图排第一（站内 44 个带上传的 skill 里 41 个是这么排的）', () => {
  assert.equal(skill.fields[0].key, 'assets', '第一个字段必须是参考图');
  /* 组序跟着走：groupFields 按组名首次出现排序 ⇒ 第一组是「素材」而不是「本篇方案」。 */
  assert.equal(skill.fields[0].group, '素材');
  assert.equal(skill.fields[1].group, '本篇方案');
});

test('⑨ 比例与清晰度：现在收进「画面规格」面板（全宽），标签仍是纯数字，默认仍是 3:4', () => {
  const ratio = skill.fields.find(item => item.key === 'ratio');
  const clarity = skill.fields.find(item => item.key === 'clarity');
  const config = skill.fields.find(item => item.key === 'genConfig');
  /* ⚠️ 2026-09-29 批 DC 续-8：这两格**不再**并排摆在左栏网格里了 ——
     它们被 `genConfig` 那一行触发器收进「画面规格」面板（用户 2026-09-29：「你就只排两个按钮进去
     子页面里面不就好了吗」），所以 `span:'half'` 那一套半宽机制**在这里用不上了**。
     面板是全宽的 ⇒ 之前那条"半宽 186px 里塞 7 档比例、只能排 4 行"的挤压**自然消失**。
     ⚠️ 判据改成"它们必须在 covers 里"（那是真正生效的那条），而不是继续钉 span ——
        钉一个已经不参与布局的属性，等于给一段死配置上锁。 */
  assert.ok(config && config.covers.includes('ratio') && config.covers.includes('clarity'),
    '比例与清晰度必须被「生成配置」那一格收走（否则左栏还是原来那两排药丸）');
  assert.equal(ratio.span, undefined, '收进面板后不再声明 span（面板是全宽的，半宽只会把 8 档挤成 4 行）');
  assert.equal(clarity.span, undefined, '同上');
  assert.equal(ratio.default, '3:4', '签名竖版不变（这一条是全站唯一的固定默认，见 export-and-adaptive-ratio-0929）');
  /* ═══ 2026-09-29 批 CY-⑭：比例第一位多一档「自适应」（用户逐字点名，全局）══════════════════════
     ⇒ 这一页的比例是 8 档（自适应 + 原 7 档），标签仍是**纯数字**、默认仍是 3:4。 */
  assert.deepEqual(ratio.options.map(o => o.label), ['自适应', '1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9'],
    '纯数字标签（知渔的实测写法，见 imageSkills 的注释）；最前面那一档是批 CY-⑭ 加的「自适应」');
  /* ⚠️ 真机复核（我自己看渲染截图）后补：8 个选项会被 FieldRenderer 的默认折叠
     收成「6 颗 + 一颗『更多』」，**9:16 与 16:9 看不见**。用户早就批过这种折叠。
     判据用 FieldRenderer 的那条真实规则算，不手抄 6：
       collapsible = options.length > maxVisible + 1  ⇒  只有 8 > maxVisible + 1 才折叠。 */
  const ratioMax = Number(ratio.maxVisible ?? 6);
  assert.ok(!(ratio.options.length > ratioMax + 1),
    '比例这一栏不许折成「更多」—— ' + (ratio.options.length - ratioMax - 1) + ' 档会被藏起来，用户选不到');
  assert.equal(ratio.maxVisible, 8, '显式写死 8：判据写"折叠上限必须覆盖全部选项"，来源仍是这一栏自己的选项数');
  assert.equal(clarity.options.length, 3, '清晰度还是三档');
  /* 半宽机制本身**仍然留着**（还有别的技能在用），只是这一页不再依赖它 —— 门禁守着它没被删。 */
  assert.match(SHELL_CSS, /data-span="half"\] \.media-field-segmented \{\s*grid-template-columns: repeat\(auto-fill, minmax\(min\(64px, 100%\), 1fr\)\)/,
    '半宽字段的药丸密度覆盖仍在（别的技能还在用这一套，不许被"这一页不用了"顺手删掉）');
});

test('⑩ 模型选择换站内事实标准（.sb-opt 行），全站只留一份实现', () => {
  const model = skill.fields.find(item => item.key === 'imageModel');
  assert.equal(model.variant, 'model', '声明侧打一个 variant 标记（kind 仍是 select —— 门禁 0925 ⑧ 钉着它）');
  assert.match(FIELD, /if \(field\.variant === 'model'\)[\s\S]{0,800}?ModelOptionRows/,
    'FieldRenderer 的 select 分支见到 model 标记就走共用组件（改前是原生 <select>）');
  /* ⚠️ 窗口从 320 放宽到 800：这一格里夹着注释与那层 role=group 包装，写死小窗口等于
     "以后不许在这一段附近加任何说明" —— 部署时真的被它打红过一次（注释一加长就越界）。
     真正要守的是**走向**（这一支渲染的是共用组件），不是字符距离。 */
  assert.match(FIELD, /role="group" aria-label=\{field\.label\}/,
    '换掉原生 <select> 之后这一格必须有字段名（否则读屏只剩一堆没名字的按钮）');
  assert.match(read('src/pages/Home/ec/GenSettingsPanel.jsx'), /<ModelOptionRows/,
    '首页/六个面板那一侧也换成同一个组件（消灭第二份真相）');
  const rows = read('src/components/media/ModelOptionRows.jsx');
  assert.match(rows, /SELECTABLE_IMAGE_MODELS/,
    '选项只有模型目录一份（不摊第二份名单）');
  /* ⚠️ 不能用 `[^>]*` 跨过去：`onPick={model => onChange(model.id)}` 里那个箭头自带 `>`，
     会在到达 disabled 之前就截断（第一次写就踩了，断言静默不成立）。 */
  assert.match(FIELD, /ModelOptionRows[\s\S]{0,200}?disabled=\{disabled\}/,
    '生成中这一格必须点不动 —— 那一单已经按旧模型报价冻结了');
  assert.match(rows, /disabled=\{disabled\}/, '共用组件要真的接住 disabled（原来是个没人传的摆设属性）');
});

test('⑪ 版式族卡片只讲这一族长什么样，内部分析搬到结果区', () => {
  const layout = skill.fields.find(item => item.key === 'layout');
  layout.options.forEach(option => {
    assert.doesNotMatch(String(option.hint || ''), /实测|他的|竞品|账号/,
      '选版式族的当场不许出现我们的话（用户批注图2-②：「不要在线上把这些文字打出来啊」）：' + option.label);
  });
  /* 分析不删，搬家**：落到"看完这一篇的图、决定拼不拼"的那一刻。 */
  assert.match(PAGE, /media-run-sheet-analysis/, '结果区要有这一行');
  assert.match(PAGE, /只有 60 张（14\.9%）是拼版/, '实测结论原样搬过去，不许悄悄改数字');
  /* 那两句不许再出现在**会发给用户的字符串**里。
     ⚠️ 只扫声明源里"去掉注释之后"的正文：这一批我在注释里**如实写下了改前那句话**
     （为什么删、原来是什么），那是留给后人的记录，不是不合格产物 ——
     早先那条直接扫整文件的断言就是把注释也咬了，误报。 */
  const code = read('src/skills/imageSkills.js')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /（实测他 85% 的图都是单图）/);
  assert.doesNotMatch(code, /（他的第二大族）/);
  assert.doesNotMatch(code, /第二大族/, '声明源正文里不许还留着竞品内部分析的口吻');
});

test('⑬ 清单**插在指定分组之后**，而那个组名必须真的存在（批 DC 续-16）', () => {
  /* 用户 2026-09-29 逐字：「然后**你的连拍组去哪了呢？你是还没做进来吗？**」
     它没丢 —— `sections.map` 原来硬编码在**所有字段组之后**，而这一页的「版式族」是
     四张长卡片，连拍药丸被压在底下，滚过去才看得见。 */
  assert.equal(skill.modulesAfterGroup, '本篇方案', '声明了清单插在哪个组之后');
  /* ⚠️ 这一条才是真判据：组名写错的后果是**静默**的 ——
     WorkbenchShell 按组名去 map 里取，取不到就整块不渲染（第一版还把它从末尾列表里
     也过滤掉了），清单凭空消失、moduleGate 永远不满足、CTA 一直灰着。
     端到端当场抓到：「image.aplus：配齐之后 CTA 仍然是禁用」。 */
  const groupNames = new Set(skill.fields.map(field => field.group || ''));
  assert.ok(groupNames.has(skill.modulesAfterGroup),
    'afterGroup 指向的分组必须真的存在，否则清单会整块丢掉。实有分组：' + [...groupNames].join(' / '));
  assert.equal(skill.fields.filter(field => field.group === skill.modulesAfterGroup).length > 0, true,
    '「本篇方案」组里必须还有字段（清单一插进去，空组会看不见它）');

  /* WorkbenchShell：取不到组名时要**退回末尾**，而不是把这一块弄丢。 */
  const shell = read('src/components/media/WorkbenchShell.jsx');
  assert.match(shell, /if \(groups\.some\(group => group\.name === section\.afterGroup\)\) anchored\.set/,
    '只有组名对得上才插进去');
  assert.match(shell, /else orphanSections\.push\(section\)/,
    '组名对不上要退回"排在最后"（声明写错不该让整块清单消失）');
  assert.match(shell, /\{orphanSections\.map\(renderSection\)\}/, '退回的那几块仍然要渲染');
  /* 页面侧：绝不能在这里写死默认值 —— 只有技能自己声明了才带上 afterGroup。 */
  assert.match(PAGE, /\.\.\.\(skill\.modulesAfterGroup \? \{ afterGroup: String\(skill\.modulesAfterGroup\) \} : \{\}\)/,
    'afterGroup 只能由技能声明；写死默认值会让没有那个组名的技能（A+/详情图）丢掉清单');
  /* 页面确实用了 modulesAfterGroup */
  assert.match(PAGE, /skill\.modulesAfterGroup/, '页面要读这个声明');
});

test('⑭ 清单有逐行控件时必须**单列** —— 类名与 CSS 要一起在（批 DC 续-16）', () => {
  /* ⚠️ 这一条是补一条**已经漏掉过**的：单列那条 CSS（`grid-template-columns: 1fr`）
     当时写了，可 JSX 上忘了挂 `is-person` ⇒ 规则是**死的**。
     而它**看不出来**：左栏 386px 本来就小于 480px 的两列阈值，
     `auto-fit minmax(min(240px,100%),1fr)` 照样给一列，页面完全正常；
     要等左栏变宽（CSS 注释里量到过 570px）才会炸成两列、把行撑破。
     ⇒ 这类"开关类名"必须在门禁里核对 CSS 与 JSX **两头都在**。 */
  const shell = read('src/components/media/WorkbenchShell.jsx');
  assert.match(shell, /\(section\.personField \? ' is-person' : ''\)/,
    '清单 section 上必须挂 is-person（单列规则的开关）');
  const shellCss = read('src/components/media/WorkbenchShell.css');
  assert.match(shellCss, /\.media-workbench-checklist\.is-person \.media-workbench-checklist-items \{ grid-template-columns: 1fr; \}/,
    '单列规则要在，且选择器与那个类名对得上');
  /* 行内那颗下拉的宽度：原生 <select> 在 flex 父级里 + width:100% 会塌成两个字宽 */
  assert.match(shellCss, /media-workbench-checklist-person select\.media-field-control \{[\s\S]*?width: auto;[\s\S]*?min-width: 112px;/,
    '行内下拉必须 width:auto + min-width（否则「空镜」被截成「空」）');
});

test('⑫ 结果区与页签的控件不再"小一号"（用户批注图1-③）', () => {
  const pills = read('src/pages/MediaCreation/MediaCreation.css');
  assert.match(pills, /min-height: 32px;\s*padding: 0 15px;\s*font-size: 12\.576px;\s*font-weight: 700;/,
    '结果区 14 颗药丸统一到 32px / 12.576px / 700 —— 照站内 inline-action 那一档，不新造尺寸');
  /* 页签（示例/历史）改前只有 30px 高（padding 9px + 13.6px 行高），比同页最小控件还矮 */
  assert.match(SHELL_CSS, /\.media-workbench-tabs button \{[\s\S]*?padding: 11px 20px;/, '页签内边距抬到 11px');
  assert.match(SHELL_CSS, /\.media-workbench-tabs button \{[\s\S]*?font-weight: 700;/, '页签字重 700（它是导航，不是正文说明）');
});

test('⑬ 侧栏：**两层必须同尺寸**（用户 2026-09-29 第四次纠正 —— 「样式要做回之前的样子」）', () => {
  /* ⚠️⚠️⚠️⚠️ 这一条被**推翻过四次**。把四次的错法与最终结构一起钉住，因为它们是同一条错误的不同阶段：
     · 续-7：看到"两层紫" ⇒ 撤掉静止态那条品牌色渐变，当成"多余的紫色底"；
     · 续-8：把 hover/选中底色压成中性 tint-strong；
     · 续-9：给**整格 78×80** 铺了 a18 紫底 —— 而渐变遮罩只在**磁贴 38×38** 上
       （实测：遮罩只占整格 23%，底色在左 20 / 右 20 / 上 12 全露出来）。
     · 续-10：把渐变搬去**整格**、并把磁贴自己的底/描边/发光全撤 ⇒ **用户：「连个框都不见了？
       你怎么把整个按钮都给改了呀？你的样式要做回之前的样子。」**

     ⚠️⚠️ 关键教训（四轮错法的**共同根因**）：
       用户从头到尾说的**只是"两个矩形要对齐"**，而我每一轮都在改**层次**。
       用户 2026-09-29 第四次把话挑明了：「我只是让你去解决**紫色底色和他上面的这个遮罩的大小覆盖
         到底有没有拉齐**？……我们要解决的是**渐变遮罩和紫色底色之间不匹配**的问题呀。」

     最终结构（其余**全部还原**，只留"对齐"这一处修改）：
       ① **格子回中性**（`--sb-surface-tint-strong`）—— 整格那层紫**就是**那个比遮罩大的底，
          用户要的是"不匹配的底"消失，不是"要一块更大的底"。
       ② **磁贴还原成那颗看得见的方块**：描边在悬停时消失 + 面上 135deg 紫渐变 + 白图标。
          ⇒ 「紫色底色」与「渐变遮罩」**就是同一个 38×38 圆角矩形**，天生对齐。
       ③ **磁贴的紫色发光去掉**（`box-shadow: 0 5px 12px var(--sb-brand-a18)`）：
          它是唯一一处**比遮罩大**的紫色（12px 模糊铺在 38px 方块外）——
          「它的边缘明显还有一层紫色的底」指的就是它。去掉后紫色就只有那一块。 */
  const resting = SIDEBAR.slice(SIDEBAR.indexOf('.app-sidebar-cell {'), SIDEBAR.indexOf('.app-sidebar-cell::after'));
  assert.match(resting, /background-color: var\(--sb-surface-tint\)/, '静止态：白底方块 + 紫色图标（用户原话「周边的方块整体是白色」）');
  assert.match(resting, /background-image: none;/, '静止态：格面不挂渐变');

  /* ① 格子：三态都回**中性** —— 整格那层紫就是"比遮罩大的底"，要去掉的是它，不是"再换一块更大的"。 */
  for (const [label, selector] of [
    ['hover', '.app-sidebar-cell:hover {'],
    ['选中', '.app-sidebar-cell.is-active {'],
    ['任务在跑', '.app-sidebar-task.is-live {'],
  ]) {
    const at = SIDEBAR.indexOf(selector);
    assert.ok(at > 0, `自证：${label} 那条规则找得到`);
    const block = SIDEBAR.slice(at, SIDEBAR.indexOf('}', at));
    assert.match(block, /background-color: var\(--sb-surface-tint-strong\)/, `${label}：格底是中性色（用户原话「周边的方块整体是白色」）`);
    assert.doesNotMatch(block, /background-image/, `${label}：格子不许挂渐变 —— 渐变是**遮罩**，只在磁贴那一块上`);
  }
  /* ② 磁贴：三态**逐值相同** = 一颗看得见的方块（描边消失 + 135deg 紫渐变 + 白图标）。 */
  for (const [label, selector] of [
    ['hover', '.app-sidebar-cell:hover .app-sidebar-tile {'],
    ['选中', '.app-sidebar-cell.is-active .app-sidebar-tile {'],
    ['任务在跑', '.app-sidebar-task.is-live .app-sidebar-tile {'],
  ]) {
    const at = SIDEBAR.indexOf(selector);
    assert.ok(at > 0, `自证：${label} 的磁贴规则找得到`);
    const block = SIDEBAR.slice(at, SIDEBAR.indexOf('}', at));
    assert.match(block, /background-image: linear-gradient\(135deg, var\(--sb-brand-\d+\), var\(--sb-brand-\d+\)\)/,
      `${label}：遮罩就是这颗方块（用户原话「紫色渐变的图层」）`);
    assert.match(block, /border-color: transparent;/, `${label}：描边消失（照知渔实测，渐变盖住描边）`);
    assert.match(block, /color: var\(--sb-brand-ink\)/, `${label}：白图标压在紫渐变上才看得见`);
  }
  /* ③ ★ 本批真正的修复点：**磁贴不许有任何比它自己大的紫色**。
     那圈 `box-shadow: 0 5px 12px var(--sb-brand-a18)` 是 12px 模糊铺在 38px 方块**外面**的 ——
     「它这个方块的边缘明显还有一层紫色的底」「渐变紫，它的边缘还有一层的样式」指的就是它。
     这是全文件里唯一"比遮罩大"的紫色，去掉之后两层就同尺寸了。 */
  for (const [label, selector] of [
    ['hover', '.app-sidebar-cell:hover .app-sidebar-tile {'],
    ['选中', '.app-sidebar-cell.is-active .app-sidebar-tile {'],
    ['任务在跑', '.app-sidebar-task.is-live .app-sidebar-tile {'],
  ]) {
    const at = SIDEBAR.indexOf(selector);
    const block = SIDEBAR.slice(at, SIDEBAR.indexOf('}', at));
    assert.match(block, /box-shadow: none;/,
      `${label}：磁贴不许有外扩的紫色发光 —— 它比渐变遮罩大，就是"边缘那层紫底"`);
  }
  /* ⚠️ 文件级判据必须**剥注释**再扫 —— 上面那条注释里**如实写下了被删掉的那个值**（为什么删），
     不剥注释就会把「说明」当成「代码」。这个坑本批已经踩到第二次。 */
  const sidebarCode = SIDEBAR.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(sidebarCode, /0 5px 12px var\(--sb-brand-a18\)/, '全文件不许再有那圈外扩的紫色发光');
  assert.doesNotMatch(sidebarCode, /0 4px 14px var\(--sb-brand-a18\)/, '续-10 加在整格上的那圈光晕也一并撤掉（同样比遮罩大）');

  /* 充能条：压在**中性**格底上 ⇒ 品牌紫渐变；左缘钉在磁贴左缘（续-9 那条"从中间张开"的修正保留）。 */
  const barTint = SIDEBAR.slice(SIDEBAR.indexOf('.app-sidebar-cell::after'), SIDEBAR.indexOf('.app-sidebar-cell:hover::after'));
  assert.match(barTint, /linear-gradient\(to right, var\(--sb-brand-400\)/,
    '充能条是品牌紫（它压在浅色格底上，不是压在紫面上）');

  /* 三态的磁贴阴影：三处都不许有 —— 上面 ③ 已经逐条钉过，这里只做反向保险。 */
  const shadows = SIDEBAR.match(/box-shadow: 0 \d+px \d+px var\(--sb-brand-a\d+\);/g) || [];
  assert.equal(shadows.length, 0, '磁贴/格子都不许有外扩的紫色发光：' + shadows.join(' | '));
  assert.doesNotMatch(SIDEBAR, /0 8px 18px var\(--sb-brand-a32\)/, '旧那档光晕不许留着');
  const gradients = SIDEBAR.match(/background-image: linear-gradient\(135deg, var\(--sb-brand-\d+\), var\(--sb-brand-\d+\)\);/g) || [];
  assert.equal(new Set(gradients).size, 1,
    '磁贴上那 135deg 品牌渐变三处同档（原来 is-live 还在用 500→700 的同色相邻档）：' + gradients.join(' | '));

  /* ═══ 2026-09-29 批 DC 续-8：磁贴下面那条**也是紫的**，必须与磁贴**嵌套成一体** ══════════════
     用户原话（第二次当面指出）：「你确定你真的有对导航栏这里的紫色底层进行解决吗？…这种紫色的图标，
       它下面是不是还有一层紫色呀？…我怀疑你渐变层的底部有一层多余的紫色的底。」
     实测（上一批的错）：充能条 **78px 通栏、4px 高、圆角 0、渐变 to right brand-500→700**，
       磁贴 **38px、圆角 12px、渐变 135deg brand-400→700** ——
       宽不同 / 圆角不同 / 角度不同 / 上下隔 17px ⇒ 读成两块紫。
       上一批只撤掉了「格底那条淡紫渐变」就宣布修好了，**漏了这条**。
     ⇒ 判据锁三件事：① 宽度必须与磁贴同一个变量；② 位置必须由磁贴算出来（不是 bottom:0 贴格底）；
        ③ 磁贴自己也必须用那个变量（否则两边各写一份尺寸，加一起又会错位）。 */
  /* ⚠️ 2026-09-29 批 DC 续-12：充能条**做回原来的位置**（用户 2026-09-29 第五次指出）═════════════
     用户原话：「另外你下面这个充能条应该**做回去原来的样式**，之前是像这样**在文字下面的**啊，
       然后**不能溢出这个框**。」（同一张图上还写着「我觉得你依然是**渐变层下面有一个纯紫色的图层**，
       边缘没有拉齐啊，感觉是没覆盖到。」）

     ⚠️⚠️ 逐元素审计证实了后一句：**那层"纯紫"就是这条充能条本身** ——
       续-9 我把它从"贴格底通栏"挪到了"磁贴正下方、同宽"，
       于是它紧贴圆角 12px 的渐变方块、直边 2px 圆角 ⇒ 边缘对不上 ⇒
       **读成"渐变下面又垫了一层紫"**。
       我扫遍整格所有元素与伪元素，紫色形状当时只剩三个：磁贴渐变、这条、标签文字。
       ⇒ 前五轮我一次都没做过这个"逐元素列出所有紫色形状"的审计，
          一直在凭印象改 —— 这次是量出来的。

     判据：① 位置必须是 `bottom: 0` + `left: 0`（贴格底、在文字下面）；
          ② 宽度必须是 `100%`（通栏），**不许**与磁贴同宽（同宽就贴到磁贴底下了）；
          ③ 不许有 `top:` —— 有 top 意味着它在磁贴下面那一行；
          ④ 不许再有 `translateX` 居中（那会让充能变成"从中间对称张开"）。 */
  const bar = SIDEBAR.slice(SIDEBAR.indexOf('.app-sidebar-cell::after'), SIDEBAR.indexOf('.app-sidebar-tile {'));
  assert.match(bar, /bottom: 0;/, '充能条贴格底（在文字下面，照 liuyingai 实测，也是原本的样式）');
  assert.match(bar, /left: 0;/, '充能条从左缘起（left:0，充能时向右推进）');
  assert.doesNotMatch(bar, /top:/, '不许再有 top —— 那样它就跑到磁贴下面那一行，正是"渐变下面一层紫"的来源');
  assert.match(bar, /width: 100%/, '悬停时通栏充满（docs/design/83：整条从左往右充满）');
  assert.doesNotMatch(bar, /width: var\(--sb-app-tile\)/, '不许再与磁贴同宽 —— 同宽就贴在磁贴正下方了');
  assert.doesNotMatch(bar, /translateX\(-50%\)/, '不许用 translateX 居中 —— 那样 width 过渡会变成"从中间对称张开"（用户 2026-09-29 明确否定过）');
  assert.match(bar, /height: 4px/, '充能条 4px 高（docs/design/54 / 83 实测值）');
  assert.match(bar, /transition: width \.7s cubic-bezier\(\.4,0,\.2,1\)/, '靠 width 过渡、左缘钉死（实测不是 transform / scaleX）');
  /* 「不能溢出这个框」：通栏的条要靠格子的 overflow:hidden + 圆角裁住，否则两端支出到格外。 */
  assert.match(resting, /overflow: hidden;/, '格子必须 overflow:hidden —— 充能条通栏，靠它裁成与格子同圆角（用户：「不能溢出这个框」）');
  assert.match(resting, /border-radius: 14px/, '格子圆角 14px（条被裁成同一个圆角）');
  /* 磁贴尺寸仍走那一个变量（续-8 起；窄屏也只覆盖它一处）。 */
  const tile = SIDEBAR.slice(SIDEBAR.indexOf('.app-sidebar-tile {'), SIDEBAR.indexOf('.app-sidebar-label {'));
  assert.match(tile, /width: var\(--sb-app-tile\)/, '磁贴走那个尺寸变量（两边各写一份尺寸，加起来会错位）');
  assert.match(tile, /height: var\(--sb-app-tile\)/, '磁贴高度同理');
  /* ★ 2026-09-29 批 DC 续-13：`background-origin` 的**初始值是 `padding-box`**
     （初始值是 `border-box` 的是 `background-clip` —— 这两条我先前记反了，代价就是下面这条）。
     磁贴是 `box-sizing: border-box` + 1px 边框 ⇒ 盒子 40×40、padding box 只有 38×38。
     于是悬停那条紫渐变**只画 38×38**，边框那 1px 环里露出来的是 `background-color:#F4F4F4`（浅灰）——
     12 倍放大看就是渐变方块四周一圈更浅的边（用户 2026-09-29 第六次指出：
     「你看不到这里边缘是有个**不重叠的区域**吗」）。
     ⇒ 必须显式 `background-origin: border-box`：渐变铺满 40×40，再由
        `background-clip: border-box` + 12px 圆角裁成圆角方块 —— 边缘既没有环、也没有溢出。 */
  assert.match(tile, /background-origin: border-box;/,
    '磁贴的渐变必须从 border-box 起画 —— 否则它只覆盖 padding box，边框那 1px 环露浅色底（用户说的"边缘不重叠"）');
  assert.match(tile, /box-sizing|^\s*width: var\(--sb-app-tile\)/, '自证：磁贴尺寸规则找得到');
  /* ⚠️ `--sb-app-tile-top`（磁贴到格顶的距离）在续-12 已删：条做回贴格底之后就没有调用方了。
     留着它 = 留一个改了不起的死配置。 */
  assert.doesNotMatch(sidebarCode, /--sb-app-tile-top/, '没有调用方的变量要删干净（条已不依赖磁贴位置）');
  /* 那条"左侧 3px 指示条"是 `left:-8px` + 格子的 overflow:hidden ⇒ **从来没被渲染过**。
     留着它，后天有人为了修光晕溢出把 overflow 去掉，它会突然冒出来变成三重指示。
     ⚠️ 必须**剥掉注释再判** —— 我在注释里如实写下了它的选择器（为什么删），
     而这正是本批已经踩过一次的坑：源码级判据不剥注释，就会把"说明"当成"代码"。 */
  assert.doesNotMatch(sidebarCode, /\.app-sidebar-cell\.is-active::before/, '那条从未被渲染的左侧指示条不许复活');
});

test('⑭ 预览步也要说清"确认后会出几张"（否则整页没有一处写着张数）', () => {
  assert.match(PAGE, /这一步只出方案；确认后将出 ' \+ n \+ ' 张图'/,
    '预览步按钮下面要说清张数 —— 这一步只显示 0.5 预览价，不写张数整页就没有一处数字（用户批注图1-②）');
  assert.match(PAGE, /copyInBatch \? ' 和一组发布文案' : ''/, '预览步也要说清文案跟不跟着出');
  assert.match(PAGE, /ctaHint=\{previewHint \|\| gateHint\}/, '不覆盖掉"还差什么"那一句（灰按钮必须说原因）');
});
