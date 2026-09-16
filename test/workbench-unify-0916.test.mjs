// test/workbench-unify-0916.test.mjs
// 2026-09-16 用户第 11 张批注图（11 组问题）—— 逐条落成契约。
// ─────────────────────────────────────────────────────────────────────────────
// 本批最大的特点：**一半的问题不是视觉，是链路断了**。
// 用户原话：「你确定现在所有的这些逻辑都是打通的情况吗？都是确确实实能够带入到设计方案里面，
// 然后去激活生成逻辑的吗？」—— 审计结论是没打通，所以本文件里有多条是**行为断言**
// （直接 import 服务端模块跑一遍），而不是 grep 字面量。
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { stripComments } from '../scripts/lib/token-scope.mjs';
import { buildAssetPlan } from '../server/ecommerceEngine/assetPlanner.mjs';
import { compileAssetRequest } from '../server/ecommerceEngine/promptCompiler.mjs';
import { assembleStructuredPrompt } from '../server/ecommerceEngine/promptAssembler.mjs';

const readRaw = rel => readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
const read = rel => stripComments(readRaw(rel));

const GEN = 'src/pages/Home/ec/GenSettingsPanel.jsx';
const LADDER = 'src/pages/Home/ec/panelVisualLanguage.js';
const PRIMITIVES = 'src/pages/Home/ec/PanelPrimitives.jsx';
const GLYPH = 'src/pages/Home/ec/ImageTypeGlyph.jsx';
const CONSTRAINTS = 'src/pages/Home/ec/GenerationConstraintsPanel.jsx';
const ECMODE = 'src/pages/Home/EcMode.jsx';
const VIDEO = 'src/pages/VideoStudio/index.jsx';
const VCSS = 'src/pages/VideoStudio/VideoStudio.css';
const PICKER = 'src/components/creation/ImageMentionPicker.jsx';
const VISUAL = 'src/pages/Home/VisualCreationMode.jsx';

/* ═══ ① 模型图标：一层，不是两层（图1-①）═══ */
test('① 模型图标只能有一层框：不得再套外层底色（否则图形被压到 0.72 倍，看起来很小）', () => {
  const panel = read(GEN);
  /* 用户原话：「我觉得你这些模型图标是有两个边缘的啊，就是图标本身是有一层边缘的，
     你的外面还加了一层边缘……图标有多层框，这个问题导致图标看起来很小啊」。 */
  assert.ok(!/background: 'var\(--sb-surface-tint\)'/.test(panel),
    '模型图标外层不得再有底色方框（那层框 + 品牌标自带的框 = 双层）');
  assert.match(panel, /<ModelLogo[\s\S]{0,120}size=\{size\}/, '品牌标必须按设定尺寸整幅渲染');
  assert.ok(!/size \* 0\.72/.test(panel), '不得再打 0.72 折（打折不等于留白，等于把图形做小）');
});

/* ═══ ② 品牌色锁定后必须一路带到生成（图2-①）═══ */
test('② 锁定品牌色必须真的生效：custom_colors 要一路带到出图请求', () => {
  const canvas = read('src/pages/EcCanvas/index.jsx');
  const api = read('src/services/api.js');
  /* 用户原话：「你锁定一个色调为什么没有下面的面板里面显示调整啊，你是不是没有把调整的逻辑啊」。
     实测：canvasPlanLaunch 的非 quick 分支**没有**把 launch 的配置写进套图节点，
     而套图节点是「应用到画布」时**新建**的 —— 它的默认 configuration 里 customColors 是 null，
     于是用户锁的颜色在生成侧永远是空的。 */
  assert.match(canvas, /const launchParams = node\.ecParams \|\| \{\}/,
    '方向节点必须把第 1 步的整份配置带进新建的套图节点');
  assert.match(canvas, /Array\.isArray\(launchParams\.customColors\)[\s\S]{0,80}customColors: launchParams\.customColors/,
    '品牌色必须随配置一起过来');
  assert.match(canvas, /customColors: Array\.isArray\(configuration\.customColors\)/,
    '出图调用必须把品牌色发出去');
  assert.match(api, /body\.custom_colors = customColors/, 'api 层必须映射到服务端已有字段 custom_colors');
});

/* ═══ ③ 图片类型：每类一个识别色 + 动效（图3-①）═══ */
test('③ 图片类型必须有配色差异与动效，不许四行同一个紫色', () => {
  const ladder = read(LADDER);
  const glyph = read(GLYPH);
  /* 用户原话：「你现在这些框都是都是紫色的也很单一啊……你好歹要有一些动效和交互效果和配色差异啊，
     主色次色和主次都要深度的处理啊」。 */
  assert.match(ladder, /export const ACCENT = Object\.freeze\(\{/, '必须有识别色族');
  for (const name of ['violet', 'blue', 'green', 'amber']) {
    assert.ok(ladder.includes(name + ':'), '识别色族缺少：' + name);
  }
  const mapping = glyph.match(/const TYPE_ACCENT = Object\.freeze\(\{([\s\S]*?)\n\}\);/);
  assert.ok(mapping, '必须有「类型 → 识别色」映射');
  const accents = [...mapping[1].matchAll(/:\s*'([a-z]+)'/g)].map(m => m[1]);
  assert.ok(new Set(accents).size >= 4,
    '四类图片至少要有 4 种不同识别色（实测用户看到的「全是紫色」就是这么来的）');
  /* 动效：只允许用权威动效 token，不写死 ms */
  const tile = read('src/pages/Home/ec/imageTypeTile.css');
  assert.match(tile, /--sb-dur-/, '动效时长必须走 --sb-dur-* token');
  assert.ok(!/\b\d+ms\b/.test(tile), '不得写死毫秒（RTK 教训：自造同义 token/数值会静默覆盖）');
  assert.match(tile, /prefers-reduced-motion/, '必须尊重「减少动态效果」的无障碍设置');
});

/* ═══ ④ 面板必须一次看全：maxHeight 不得超出可用空间（图10-①）═══ */
test('④ 面板高度不得「托底」超出可用空间（那正是被截断的根因）', () => {
  const visual = read(VISUAL);
  const ecMode = read(ECMODE);
  /* 用户原话：「你现在张开之后都不是一般能够看全……都需要往下滚动一下鼠标才能够看全所有的信息点，
     这个是违背我们逻辑的」。根因：maxHeight 被 Math.max(300, …) 托底，可以比可用空间还大。 */
  assert.ok(!/maxHeight: Math\.max\(300/.test(visual),
    '不得再用 300 托底 —— 它会让面板高过可用空间、直接被视口切掉');
  /* 两条要求同时成立，缺一不可：
     ① 面板永远贴着触发按钮（不能退化成盖住输入区的全屏层）；
     ② 内容一屏看全（不能让用户滚鼠标）。
     所以高度**严格等于该侧可用空间**（绝不越界 = 绝不截断），装不下时切紧凑档压内容。 */
  /* 2026-09-16 二次返工：原来还把 desiredHeight(720/620/740) 当上限，于是**内容比它还高就开始滚**
     （实测创作配方内容约 800px，被 720 卡住）。关键：max-height **不会**撑高面板，
     面板实际高度 = 内容高度（仅受 max-height 封顶），所以上限就该直接取可用空间。 */
  assert.match(visual, /Math\.min\(Math\.round\(viewportHeight \* 0\.92\), Math\.max\(availableSpace \|\| desiredHeight, 160\)\)/,
    '面板高度上限必须直接取可用空间（desiredHeight 不再参与封顶，否则内容比它高就开始滚动）');
  assert.ok(!/Math\.min\([^)]*desiredHeight, Math\.max/.test(visual), '不得再把 desiredHeight 塞进封顶表达式');
  assert.match(visual, /const compact = maxHeight < desiredHeight/, '空间不够时必须切紧凑档');
  assert.match(visual, /data-density=\{configPanelPos\.compact/, '面板必须把密度传下去（用 data-*，不用内联样式串选择器）');
  assert.match(read('src/pages/Home/VisualCreationMode.css'), /\.visual-config-panel\[data-density="compact"\]/,
    '紧凑档必须有真实样式规则，否则「切档」只是换了个属性名');
  assert.ok(!/Math\.max\(300, Math\.min\(620, btnRect\.top - 24\)\)/.test(ecMode),
    '电商面板同样不得用 300 托底（同一个坑在两边各有一份）');
});

/* ═══ ⑤ 技能「使用」必须把正文写进输入框（图5-①）═══ */
test('⑤ 技能库点「使用」必须把技能正文带进输入框（三处共用同一实现）', () => {
  const model = read('src/pages/EcCanvas/canvasStudioModel.js');
  const ecMode = read(ECMODE);
  const video = read(VIDEO);
  /* 用户原话：「技能库里面我点击使用，他并没有把技能带入到输入框这边呀。
     你之前的一个版本里面是有做到的，是有实现的。现在怎么把他们全部拿掉了呀？」 */
  assert.match(model, /current\.includes\(text\)/, '共用实现必须去重（点两次不会出现两份）');
  const appendLine = model.split('\n').find(line => line.includes('appendBody'));
  assert.ok(appendLine, '必须有追加语义的实现（appendBody）');
  assert.ok(model.includes('\\n\\n'), '非空时必须**追加**（空行分隔）而不是覆盖用户已写内容');
  assert.ok(!/prompt: String\(prompt \|\| ''\)\.trim\(\) \? String\(prompt\) : body/.test(model),
    '不得退回「非空就什么都不做」的旧写法（那样用户点了使用会觉得没反应）');
  assert.match(ecMode, /setDescription\(current => applyCanvasSkill\(/, '首页电商：使用技能必须写进提示词');
  assert.match(video, /setPrompt\(current => applyCanvasSkill\(/, '视频生成：同上');
  /* 同一份正文不许进两次：输入框里一次 + user_skills 段一次 */
  assert.match(ecMode, /userSkills: \(userSkills \|\| \[\]\)\.map\(\(\{ id, name, version \}\)/,
    'chip 只发名字，不发 body（否则同一份正文进两次提示词）');
  assert.match(video, /userSkills: userSkills\.map\(skill => \(\{ id: skill\.id, name: skill\.name, version: skill\.version \}\)\)/,
    '视频侧同样只发名字');
});

/* ═══ ⑥ 视频 @ 键：共用组件 + 没素材要变暗 + 不是死按钮（图7-①）═══ */
test('⑥ 视频 @ 必须是全站共用组件，且没素材时禁用变暗', () => {
  const video = read(VIDEO);
  const picker = read(PICKER);
  const css = read('src/pages/VideoStudio/VideoStudio.css');
  /* 用户原话：「你视频生成这边的这个艾特键，为什么跟其他板块的艾特键不一样呢？……
     正常的情况应该是用户他没有上传任何东西的话，这个按钮它是暗的……你这是个死按钮呀！」 */
  assert.match(video, /<ImageMentionPicker/, '视频必须用全站共用的 @ 组件');
  assert.ok(!/video-icon-tool[^>]*aria-label="引用素材"/.test(video),
    '不得再有视频私有那套 @ 触发器（两套 @ 正是「跟别人不一样」的来源）');
  assert.match(picker, /disabled=\{disabled \|\| !available\.length\}/, '没素材必须自动禁用（变暗）');
  /* 死按钮根因：点外面就关的判定只认底栏容器 → 菜单项一按下就被卸载、click 永不触发 */
  assert.match(video, /target\.closest\('\.video-inline-control, \.video-inline-menu'\)/,
    '内联菜单的「点外面」判定必须覆盖所有内联控件容器，不能只认底栏');
  const pickerCss = read('src/components/creation/ImageMentionPicker.css');
  assert.match(pickerCss, /image-mention-trigger:disabled/, '@ 组件必须自带禁用态的视觉（变暗）');
  assert.ok(!/\.video-quick-tools \.video-inline-control:has/.test(css), '藏重复 @ 的那条规则必须一并删除');
});

/* ═══ ⑦ 视频底部两行提示删除（图7-②）═══ */
test('⑦ 视频：字数计数与「提交前锁定本次费用」两句不得再上屏', () => {
  const video = read(VIDEO);
  /* 用户原话：「我觉得你下面没有必要写这个限制多少次，还有右边这个『提交时锁定本次费用』这一句，
     就是你这行可以去掉的，不需要去提示这个。」 */
  assert.ok(!/\{prompt\.length\}\/1200/.test(video), '字数计数不得再上屏');
  assert.ok(!/提交前锁定本次费用/.test(video), '费用锁定说明不得再上屏');
});

/* ═══ ⑧ 积分按钮：颜色必须跟电商一致（图8-①）═══ */
test('⑧ 主 CTA 里的积分不得被面板的通用 span 规则刷成灰色', () => {
  const css = read(VCSS);
  /* 用户原话：「你这个积分也应该变成白色呀，不然你跟这个底色一样，就看不出来这个积分是多少呀？
     你自己去看看电商生图，他们那边是怎么做的这个按钮和这个文案的变色逻辑。」 */
  assert.ok(!/^\.video-submit-row span \{/m.test(css),
    '不得再用后代选择器 .video-submit-row span（它会把按钮内部的积分一起刷灰）');
  assert.match(css, /\.video-submit-row > \.video-submit-meta span/, '只作用于说明区');
  /* 自证：旧写法确实会被这条判据抓住。 */
  assert.ok(/^\.video-submit-row span \{/m.test('.video-submit-row span { color: #928b84; }'),
    '自证：旧写法能被该判据命中');
});

/* ═══ ⑨ 避免出现的元素：同级 + 无分割线 + 无说明句（图6-①②）═══ */
test('⑨ 避免出现的元素必须与上面四个字段同级，且没有分割线和多余空白', () => {
  const panel = read(CONSTRAINTS);
  const ecMode = read(ECMODE);
  /* 用户原话：「你这个避免出现的元素，这标题还是太大了呀。它跟上面的这四个标题是不一致大小的……
     就显得他特别突出啊，这是不对的。然后避免出现的元素，这个上面为什么会有这么多的空白处呢？
     是不是有一条分割线啊？这个分割线你为什么不拿掉，然后把它挤上去呢？」 */
  assert.match(panel, /<FieldLabel icon=\{ShieldAlert\}>避免出现的元素<\/FieldLabel>/,
    '必须用字段标签档（12/600），不是分组标题档（13/700）');
  assert.ok(!/<GroupTitle/.test(panel), '不得再用分组标题档渲染它');
  assert.ok(!/CopyPanelDivider/.test(ecMode), '分割线组件必须删除');
  assert.match(ecMode, /<GenerationConstraintsPanel flushTop/, '必须紧贴上一段（去掉重复的顶部内边距）');
  assert.ok(!/这些约束会随本次套图一起下发/.test(panel), '那句链路说明必须删除（用户点名）');
  /* 画布侧此前根本没有这一段 —— 同一个「内容规范」两边内容不一致 */
  assert.match(read('src/pages/EcCanvas/components/CanvasStudio.jsx'), /<GenerationConstraintsPanel flushTop/,
    '画布侧必须补齐「避免出现的元素」（此前只有首页有）');
});

/* ═══ ⑩ 标题配色：图标一色、文字另一色（图10-② / 图11-①）═══ */
test('⑩ 分组标题：图标走品牌色、文字走中性深墨（全站同一套）', () => {
  const primitives = read(PRIMITIVES);
  /* 用户原话：「我觉得这里的UI逻辑还稍微更好一些。就是标题的图标，它是一个颜色的。
     然后标题是另一个颜色。我觉得这样会更好一些。你可以全局按这个套路去做吧。」 */
  assert.match(primitives, /color="var\(--sb-brand-600\)"/, '分组标题的图标必须是品牌色');
  assert.match(read(LADDER), /groupTitle: Object\.freeze\(\{ size: 13, weight: 700, tone: 'var\(--sb-ink-1\)' \}\)/,
    '标题文字仍然是中性深墨（原则 6.1 守的是文字，不是图标）');
});

/* ═══ ⑪ 输入链路打通：行为断言（图4-① 的核心问题）═══ */
const TRUTH = Object.freeze({
  productName: '保温杯', category: '家居日用',
  sourceAssetIds: ['product-front', 'product-side'],
  materials: ['304 不锈钢'],
});
const BIBLE = Object.freeze({ confirmed: true, referenceAssetIds: ['style-board'] });

test('⑪ 变体说明必须逐条进入生成提示词（不是只取第一个，也不是糊成一段散文）', () => {
  /* 用户原话：「像这种 sku 变体，如果用户他添加了多个的话，然后又把各种细节调的非常非常的细的话，
     你对于这些复杂的情况，你的判断你确定都有代入吗？」—— 审计结论：此前**全链路丢失**。 */
  const plan = buildAssetPlan({
    productTruth: TRUTH, campaignBible: BIBLE, platform: '淘宝',
    sizing: { resolution: '2K', images: [{ key: 'white_bg', count: 1, ratio: '1:1' }] },
    skus: [
      { color: '磨砂黑', capacity: '500ml', note: '仅 500ml 装，含硅胶密封圈' },
      { color: '奶白', capacity: '750ml', note: '大容量款，杯身有刻度线' },
    ],
  });
  const skuItems = plan.filter(item => item.role === 'sku');
  assert.equal(skuItems.length, 2, '两个变体应产出两张 SKU 图');
  assert.deepEqual(skuItems.map(item => item.variantNote), ['仅 500ml 装，含硅胶密封圈', '大容量款，杯身有刻度线'],
    '每个变体的说明必须绑定到它自己的 item 上');
  const compiled = compileAssetRequest({
    assetPlanItem: skuItems[0], productTruth: TRUTH, campaignBible: BIBLE, assets: {},
  });
  assert.match(compiled.prompt, /仅 500ml 装/, '变体说明必须真的进 prompt');
  assert.doesNotMatch(compiled.prompt, /大容量款/, '不得把别的变体的说明混进这一张');
});

test('⑪b 避免出现的元素必须成为提示词里的硬排除段（服务端此前 0 命中）', () => {
  /* 用户原话：「你确定现在所有的这些逻辑都是打通的情况吗？」—— 这个面板前端发了、
     服务端从来不读，用户写的「不要出现人物」一条都没生效。 */
  const plan = buildAssetPlan({
    productTruth: TRUTH, campaignBible: BIBLE, platform: '淘宝',
    sizing: { resolution: '2K', images: [{ key: 'white_bg', count: 1, ratio: '1:1' }] },
  });
  const compiled = compileAssetRequest({
    assetPlanItem: plan[0], productTruth: TRUTH, campaignBible: BIBLE, assets: {},
    negativeConstraints: '不要出现人物、不要出现手部, 不要出现文字水印',
  });
  assert.match(compiled.prompt, /userExclusions/, '必须有专门的排除段');
  assert.match(compiled.prompt, /"不要出现人物"/, '必须按分隔符切成独立条目');
  assert.match(compiled.prompt, /hard exclusion/, '必须声明为硬排除');
  /* 优先级：排除项必须排在 userSkill **之后**（更晚出现 = 更高优先级） */
  const order = read('server/ecommerceEngine/promptAssembler.mjs');
  const idxSkill = order.indexOf("'userSkill',");
  const idxExclusions = order.indexOf("'userExclusions',");
  assert.ok(idxExclusions > idxSkill, '排除段必须排在 userSkill 之后（风格指引不得压过排除项）');
  /* 没写排除项时不得凭空多出一个空段 */
  const clean = compileAssetRequest({
    assetPlanItem: plan[0], productTruth: TRUTH, campaignBible: BIBLE, assets: {},
  });
  assert.doesNotMatch(clean.prompt, /userExclusions/, '没填排除项时不得出现空段');
});

test('⑪c 结构化提示词必须仍然是合法 JSON schema（新增段不能破坏格式）', () => {
  const prompt = assembleStructuredPrompt({ ratio: '1:1', sections: { roleObjective: { role: 'sku' }, userExclusions: { forbidden: ['不要出现人物'] } } });
  const json = prompt.slice(prompt.indexOf('{'));
  const parsed = JSON.parse(json);
  assert.equal(parsed.schemaVersion, 'ecommerce-indexed-multipart-v1');
  assert.deepEqual(parsed.sections.userExclusions.forbidden, ['不要出现人物']);
  assert.equal(parsed.sections.unknownSection, undefined, '不在白名单里的段不得被静默渲染');
});

/* ═══ ⑫ 视频清晰度：1080P 未上架是**计费决策**，不许被顺手打开 ═══ */
test('⑫ 1080P 未上架：计费 SKU 必须保持 public:false（没签字不许开通）', () => {
  const catalog = read('server/billing/catalog.mjs');
  /* 用户问：「1080P呢，是我们的视频 API 上有没有提供吗？还是你压根就没有打算做进去呢？」
     事实：上游有货源、计费 SKU 已留档，但**没接生产路由、价格没签字**。
     铁律①：未经用户确认不得开始计费 —— 所以这条要守住「不许偷偷打开」。 */
  const entry = catalog.match(/video_seedance_1080p:\s*\{([^}]*)\}/);
  assert.ok(entry, '计费 SKU 必须仍然存在（留档）');
  assert.match(entry[1], /public:\s*false/, '未签字前必须保持 public:false');
  const catalog970 = read('server/videoCatalog.mjs');
  assert.ok(!/resolutions:\s*\['1080p'\]/.test(catalog970),
    '没有任何视频产品可以声明 1080p —— 那会让用户选到一个走不通的档位并被扣费');
});
