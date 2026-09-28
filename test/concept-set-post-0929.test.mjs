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
  const request = buildSkillCopyRequest(skill, { ...seed, shots: modules.slice(0, 6).map(m => m.value) });
  assert.ok(request.theme, '母体必须带（服务端要它）');
  assert.equal(request.shots.length, 6, '带的是这一篇那 6 种手法');
  assert.equal(request.person, seed.person, '人物形态同一份');
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

test('⑨ 比例 + 分辨率同一行（span: half），比例标签换成纯数字', () => {
  const ratio = skill.fields.find(item => item.key === 'ratio');
  const clarity = skill.fields.find(item => item.key === 'clarity');
  assert.equal(ratio.span, 'half', '比例占半列');
  assert.equal(clarity.span, 'half', '分辨率占半列');
  assert.equal(ratio.default, '3:4', '签名竖版不变');
  assert.deepEqual(ratio.options.map(o => o.label), ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9'],
    '半宽放不下「3:4 竖版海报」这种长标签（知渔的纯数字写法，实采见 imageSkills 的注释）');
  assert.equal(clarity.options.length, 3, '清晰度还是三档');
  /* 半列只有 ~212px，而药丸列最小宽 140px ⇒ 不收窄就是"每行一颗、7 行" */
  assert.match(SHELL_CSS, /data-span="half"\] \.media-field-segmented \{\s*grid-template-columns: repeat\(auto-fill, minmax\(min\(64px, 100%\), 1fr\)\)/,
    '半宽字段里的药丸列最小宽要收到 64px（否则两列并排反而把 7 档比例排成 7 行）');
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

test('⑫ 结果区与页签的控件不再"小一号"（用户批注图1-③）', () => {
  const pills = read('src/pages/MediaCreation/MediaCreation.css');
  assert.match(pills, /min-height: 32px;\s*padding: 0 15px;\s*font-size: 12\.576px;\s*font-weight: 700;/,
    '结果区 14 颗药丸统一到 32px / 12.576px / 700 —— 照站内 inline-action 那一档，不新造尺寸');
  /* 页签（示例/历史）改前只有 30px 高（padding 9px + 13.6px 行高），比同页最小控件还矮 */
  assert.match(SHELL_CSS, /\.media-workbench-tabs button \{[\s\S]*?padding: 11px 20px;/, '页签内边距抬到 11px');
  assert.match(SHELL_CSS, /\.media-workbench-tabs button \{[\s\S]*?font-weight: 700;/, '页签字重 700（它是导航，不是正文说明）');
});

test('⑬ 左侧导航那"第二层紫"删干净了（用户批注图1-④：「你没有做干净」）', () => {
  /* 静止态那一格不许再铺品牌色渐变 —— 那一层就是截图里"后面一层紫"的来源。 */
  const resting = SIDEBAR.slice(SIDEBAR.indexOf('.app-sidebar-cell {'), SIDEBAR.indexOf('.app-sidebar-cell::after'));
  assert.match(resting, /background-image: none;/, '静止态：格底回到中性纯色（留影AI 实测他们的卡就是 backgroundImage:none）');
  assert.doesNotMatch(resting, /linear-gradient\(90deg, var\(--sb-neutral-0\)[^;]*brand/, '不许再铺那条 5% 品牌色横向渐变');
  /* hover 也不该用"渐变画纯色"—— 计算值一样，但会让"这格有没有渐变"永远查不清。
     （规则块里有注释，所以用 [\s\S]{0,400}? 跨过去，而不是 \s* —— 早先那条 \s* 断言误报。） */
  const hover = SIDEBAR.slice(SIDEBAR.indexOf('.app-sidebar-cell:hover {'), SIDEBAR.indexOf('.app-sidebar-cell:hover .app-sidebar-tile'))
    .replace(/\/\*[\s\S]*?\*\//g, '');   // 规则块里那条注释**提到**了 background-image，别把它算成声明
  assert.match(hover, /background-color: var\(--sb-surface-tint-strong\);/, 'hover 用纯色档，不用渐变');
  assert.doesNotMatch(hover, /background-image/, 'hover 不许再挂任何 background-image（那正是查不清"两层紫"的根源）');
  /* 发光收敛，且 hover / 选中 / 任务在跑**三处同一档** ——
     原来这一列里同时存在 8px/32% 与 5px/18% 两套，同一颗磁贴三种状态三种光晕。 */
  const shadows = SIDEBAR.match(/box-shadow: 0 \d+px \d+px var\(--sb-brand-a\d+\);/g) || [];
  assert.ok(shadows.length >= 3, '自证：hover / 选中 / is-live 三处磁贴阴影都找得到，实得 ' + shadows.length);
  assert.equal(new Set(shadows).size, 1, '三处必须同档：' + shadows.join(' | '));
  assert.doesNotMatch(SIDEBAR, /0 8px 18px var\(--sb-brand-a32\)/, '旧那档光晕不许留着');
  const gradients = SIDEBAR.match(/background-image: linear-gradient\(135deg, var\(--sb-brand-\d+\), var\(--sb-brand-\d+\)\);/g) || [];
  assert.equal(new Set(gradients).size, 1,
    '磁贴上那 135deg 品牌渐变也只有一档（原来 is-live 还在用 500→700 的同色相邻档）：' + gradients.join(' | '));
});

test('⑭ 预览步也要说清"确认后会出几张"（否则整页没有一处写着张数）', () => {
  assert.match(PAGE, /这一步只出方案；确认后将出 ' \+ n \+ ' 张图'/,
    '预览步按钮下面要说清张数 —— 这一步只显示 0.5 预览价，不写张数整页就没有一处数字（用户批注图1-②）');
  assert.match(PAGE, /copyInBatch \? ' 和一组发布文案' : ''/, '预览步也要说清文案跟不跟着出');
  assert.match(PAGE, /ctaHint=\{previewHint \|\| gateHint\}/, '不覆盖掉"还差什么"那一句（灰按钮必须说原因）');
});
