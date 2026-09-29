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

test('⑫ 结果区与页签的控件不再"小一号"（用户批注图1-③）', () => {
  const pills = read('src/pages/MediaCreation/MediaCreation.css');
  assert.match(pills, /min-height: 32px;\s*padding: 0 15px;\s*font-size: 12\.576px;\s*font-weight: 700;/,
    '结果区 14 颗药丸统一到 32px / 12.576px / 700 —— 照站内 inline-action 那一档，不新造尺寸');
  /* 页签（示例/历史）改前只有 30px 高（padding 9px + 13.6px 行高），比同页最小控件还矮 */
  assert.match(SHELL_CSS, /\.media-workbench-tabs button \{[\s\S]*?padding: 11px 20px;/, '页签内边距抬到 11px');
  assert.match(SHELL_CSS, /\.media-workbench-tabs button \{[\s\S]*?font-weight: 700;/, '页签字重 700（它是导航，不是正文说明）');
});

test('⑬ 左侧导航的紫是**两层嵌套**：格底一层紫底 + 磁贴一层紫渐变（用户 2026-09-29 第二次当面纠正）', () => {
  /* ⚠️⚠️ 这一条被**推翻过两次**，两次都改反了方向，所以这里把整段口径写清楚：
     · 批 DC 续-7：用户说「这个里面两层紫色…你怀疑你渐变层的底部有一层多余的紫色的底」
       ⇒ 我把**静止态**那条品牌色渐变撤掉，当成"多余的紫色底"；
     · 批 DC 续-8：用户又说「你没有做干净…它这个方块的周边是有一个底层依然是一个紫色的。
       但是它表面这一层已经是一个紫色的渐变动效了」⇒ 我把 hover/选中底色压成中性 tint-strong。
     两次都在"**消掉**那层紫"，而用户要的是"**留住**那层紫，只是要和表面那层渐变**嵌套**"。
     实测（改前真机读计算样式）：hover 时 `cellBgColor = rgba(12,10,9,0.06)` —— 底层一点紫都没有，
     当然看不见"下面还有一层"。 */
  const resting = SIDEBAR.slice(SIDEBAR.indexOf('.app-sidebar-cell {'), SIDEBAR.indexOf('.app-sidebar-cell::after'));
  assert.match(resting, /background-color: var\(--sb-surface-tint\)/, '静止态：格底是中性色（白底方块 + 紫色图标）');
  assert.match(resting, /background-image: none;/, '静止态：格底不挂渐变（渐变是 hover 才有的「表面那层」）');

  /* hover / 选中 / 任务在跑：三处**都要**铺同一档紫色底。 */
  const hover = SIDEBAR.slice(SIDEBAR.indexOf('.app-sidebar-cell:hover {'), SIDEBAR.indexOf('.app-sidebar-cell:hover .app-sidebar-tile'))
    .replace(/\/\*[\s\S]*?\*\//g, '');   // 规则块里那条注释**提到**了 background-image，别把它算成声明
  assert.match(hover, /background-color: var\(--sb-brand-a\d+\);/,
    'hover：格底要铺一层**紫底**（用户原话「整个方块被紫色包裹…周边有一个底层依然是一个紫色的」）');
  assert.doesNotMatch(hover, /background-image/, '但底层**不许**用渐变画 —— 渐变留给磁贴那层；混在一起就永远查不清"这格有没有渐变"');
  assert.match(SIDEBAR, /\.app-sidebar-cell\.is-active \{[^}]*background-color: var\(--sb-brand-a\d+\);/,
    '选中：与 hover 同一档紫底（改前是中性 tint-strong，选中格一眼就看出缺了底层）');
  assert.match(SIDEBAR, /\.app-sidebar-task\.is-live \{[^}]*background-color: var\(--sb-brand-a\d+\);/,
    '任务在跑：同样是两层（磁贴渐变 + 格底紫底），三处必须一致');

  /* 发光收敛，且 hover / 选中 / 任务在跑**三处同一档**。 */
  const shadows = SIDEBAR.match(/box-shadow: 0 \d+px \d+px var\(--sb-brand-a\d+\);/g) || [];
  assert.ok(shadows.length >= 3, '自证：hover / 选中 / is-live 三处磁贴阴影都找得到，实得 ' + shadows.length);
  assert.equal(new Set(shadows).size, 1, '三处必须同档：' + shadows.join(' | '));
  assert.doesNotMatch(SIDEBAR, /0 8px 18px var\(--sb-brand-a32\)/, '旧那档光晕不许留着');
  const gradients = SIDEBAR.match(/background-image: linear-gradient\(135deg, var\(--sb-brand-\d+\), var\(--sb-brand-\d+\)\);/g) || [];
  assert.equal(new Set(gradients).size, 1,
    '磁贴上那 135deg 品牌渐变也只有一档（原来 is-live 还在用 500→700 的同色相邻档）：' + gradients.join(' | '));

  /* ═══ 2026-09-29 批 DC 续-8：磁贴下面那条**也是紫的**，必须与磁贴**嵌套成一体** ══════════════
     用户原话（第二次当面指出）：「你确定你真的有对导航栏这里的紫色底层进行解决吗？…这种紫色的图标，
       它下面是不是还有一层紫色呀？…我怀疑你渐变层的底部有一层多余的紫色的底。」
     实测（上一批的错）：充能条 **78px 通栏、4px 高、圆角 0、渐变 to right brand-500→700**，
       磁贴 **38px、圆角 12px、渐变 135deg brand-400→700** ——
       宽不同 / 圆角不同 / 角度不同 / 上下隔 17px ⇒ 读成两块紫。
       上一批只撤掉了「格底那条淡紫渐变」就宣布修好了，**漏了这条**。
     ⇒ 判据锁三件事：① 宽度必须与磁贴同一个变量；② 位置必须由磁贴算出来（不是 bottom:0 贴格底）；
        ③ 磁贴自己也必须用那个变量（否则两边各写一份尺寸，加一起又会错位）。 */
  /* ⚠️ 切片要**连 hover / is-active 两条变体一起取**：基础那条是 `width: 0`（未充能），
     写死宽度的恰恰是后两条。只切基础规则会误判成"没改成同宽"。 */
  const bar = SIDEBAR.slice(SIDEBAR.indexOf('.app-sidebar-cell::after'), SIDEBAR.indexOf('.app-sidebar-tile {'));
  assert.match(bar, /width: var\(--sb-app-tile\)/, '充能条必须与磁贴**同宽**（不是通栏 100%）');
  assert.doesNotMatch(bar, /width: 100%/, '充能条不许再通栏 —— 那正是"下面还有一层紫"的来源');
  assert.match(bar, /top: calc\(var\(--sb-app-tile-top\) \+ var\(--sb-app-tile\) \+ 2px\)/,
    '充能条必须**紧贴磁贴正下方**，位置由磁贴尺寸算出（不是 bottom:0 贴格底）');
  assert.doesNotMatch(bar, /bottom: 0/, '不许再贴格底（与磁贴之间隔着文字行，两块紫就分家了）');
  /* ⚠️ 批 DC 续-9：左缘必须**钉死在磁贴左缘**，不许用 `left:50% + translateX(-50%)` ——
     那会让左缘随宽度一起动，动画变成"从中心对称张开"，把"充能"（左侧钉死、向右推进）整个抹掉。
     用户 2026-09-29 当面指出：「你怎么把导航栏下面的这条脉冲条变成中间往两边张开了呀。」
     判据：必须有 `calc(50% - 磁贴/2)`，且**不许**再有 translateX。 */
  assert.match(bar, /left: calc\(50% - var\(--sb-app-tile\) \/ 2\);/,
    '充能条左缘钉在磁贴左缘（满宽时与磁贴左右对齐，动画期间只向右长）');
  assert.doesNotMatch(bar, /translateX\(-50%\)/, '不许再用 translateX 居中 —— 那样 width 过渡会变成"从中间对称张开"');
  const tile = SIDEBAR.slice(SIDEBAR.indexOf('.app-sidebar-tile {'), SIDEBAR.indexOf('.app-sidebar-label {'));
  assert.match(tile, /width: var\(--sb-app-tile\)/, '磁贴自己必须走同一个变量（两边各写一份尺寸，加起来就会错位）');
  assert.match(tile, /height: var\(--sb-app-tile\)/, '磁贴高度同理');
  /* 那条"左侧 3px 指示条"是 `left:-8px` + 格子的 overflow:hidden ⇒ **从来没被渲染过**。
     留着它，后天有人为了修光晕溢出把 overflow 去掉，它会突然冒出来变成三重指示。
     ⚠️ 必须**剥掉注释再判** —— 我在注释里如实写下了它的选择器（为什么删），
     而这正是本批已经踩过一次的坑：源码级判据不剥注释，就会把"说明"当成"代码"。 */
  const sidebarCode = SIDEBAR.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(sidebarCode, /\.app-sidebar-cell\.is-active::before/, '那条从未被渲染的左侧指示条不许复活');
  /* 窄屏那一档必须跟着一起收，否则条会停在老位置和磁贴脱开。 */
  assert.match(SIDEBAR, /@media \(max-width: 900px\)[\s\S]*?--sb-app-tile-top: 7px;/,
    '窄屏要一起收磁贴到格顶的距离（改前条是通栏所以没这个依赖，改成紧贴就必须跟）');
});

test('⑭ 预览步也要说清"确认后会出几张"（否则整页没有一处写着张数）', () => {
  assert.match(PAGE, /这一步只出方案；确认后将出 ' \+ n \+ ' 张图'/,
    '预览步按钮下面要说清张数 —— 这一步只显示 0.5 预览价，不写张数整页就没有一处数字（用户批注图1-②）');
  assert.match(PAGE, /copyInBatch \? ' 和一组发布文案' : ''/, '预览步也要说清文案跟不跟着出');
  assert.match(PAGE, /ctaHint=\{previewHint \|\| gateHint\}/, '不覆盖掉"还差什么"那一句（灰按钮必须说原因）');
});
