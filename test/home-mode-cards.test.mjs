import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import sharp from 'sharp';

import { stripComments } from '../scripts/lib/token-scope.mjs';

const source = readFileSync(new URL('../src/pages/Home/index.jsx', import.meta.url), 'utf8');
const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const footer = readFileSync(new URL('../src/components/layout/Footer.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/pages/Home/Home.css', import.meta.url), 'utf8');

test('home presents the two confirmed entries (视频生成 / 图片生成) in one workspace family', () => {
  const options = source.match(/const modeOptions = \[([\s\S]*?)\n  \];/)?.[1] || '';
  /* ═══ 2026-09-17 用户拍板：一级入口从**四张收敛成两张**（43 §3.1 判据①）═══
     四个老模式没有消失，只是换了入口 —— 电商生图 → 技能「电商商品套图」的子页面、
     小红书图文 → 技能「小红书图文」、自由创作 → 技能「自由创作」，
     都能从左侧导航与技能库进，能力一点没少。所以这里断言的是"只剩两张入口卡"，
     以及"两个模式各自的实现仍然装配在首页"。 */
  assert.equal((options.match(/mode: '(?:ecommerce|video|content|visual)'/g) || []).length, 2);
  assert.doesNotMatch(options, /page: 'video-studio'/);
  assert.match(options, /mode: 'video'[\s\S]*mode: 'visual'/, '视频生成在前（用户批注 #1）');
  assert.match(options, /title: '视频生成'/);
  assert.match(options, /title: '图片生成'/);
  assert.match(source, /homepage-mode-cards/);
  assert.match(source, /<VideoStudioPage embedded/);
  assert.match(source, /<VisualCreationMode/);
  assert.match(options, /entry-video\.png/);
  assert.match(options, /entry-visual\.png/);
  assert.match(options, /entry-video\.png\?v=20260812/);
  assert.match(options, /entry-visual\.png\?v=20260812/);
  /* 老模式不许再作为一级入口出现，也不许把它们的素材留在 modeOptions 里 */
  assert.doesNotMatch(options, /entry-ecommerce\.png|entry-xhs\.png/);
  assert.doesNotMatch(source, /reference-card-/);
  assert.doesNotMatch(source, /homepage-mode-indicator/);
  assert.match(source, /上传创意素材，生成/);
  assert.match(source, /从一张素材开始，生成能上架、能种草、能传播的专业视觉/);
  assert.doesNotMatch(source, /在同一个工作台完成/);
  assert.match(page, /智能视觉内容创作平台/);
  assert.match(footer, /AI 视觉内容策划、生成与编辑/);
  /* ═══ 2026-09-19 批 I-⑤：判据**第二次反转** —— 扇子又回来了（用户批注 #4-1）══════════
     ⚠️ 这一条同样改的是产品口径，不是为了让测试变绿而回退 UI。
     批 G 把这两张卡从「扇形歪卡」改成「对齐卡片」（零倾斜），理由写在上面那条注释里：
     「继续守旧的 rotate(-6deg) 等于逼着下一轮把歪卡加回来」。**这一轮用户就是要求加回来**：
       用户对着「潮际好麦」那张图说：「图片生成和视频生成切换卡片样式……应该抄他们这种做法，
       就是**背景圆角的框，里面是卡片扇形张开的样式，外面是白色，上面标题是黑色，
       然后对称的斜放着啊**。」
     （配套的 #1-8：「上面的卡片也是**这个标题有白色背景啊**……而且你这个背景也不好看啊」——
       所以白色从"每张卡各一块"上收到"整组一张框"，卡变透明。）

     新契约（守的是**用户这一次要的那把扇子**，不是无边界的"随便歪"）：
       ① **必须**对称倾斜：card-1 -5° / card-2 +5°，且支点在底边中点
          （transform-origin: 50% 100%）—— 下沿仍是一条水平线，整组的层次不变；
       ② **必须**对称：两片同宽（单一宽度规则 232）、中间是缝（20px）而不是负外边距叠压；
       ③ hover / active **必须把旋转带回去** —— 不带就会"鼠标一移上去卡片就回正"，
          扇子当场散架（这是这一版最容易漏、也最难看的一处）；
       ④ 两条负外边距仍然只允许"整组探进下面那张工作台卡"那一处。 */
  assert.match(styles, /\.homepage-mode-card\.card-1 \{ transform: rotate\(-5deg\); \}/, '左片必须 -5°（用户 #4-1：对称的斜放着）');
  assert.match(styles, /\.homepage-mode-card\.card-2 \{ transform: rotate\(5deg\); \}/, '右片必须 +5°（与左片对称）');
  assert.match(styles, /\.homepage-mode-card \{[^}]*transform-origin:\s*50% 100%/, '支点必须在底边中点（下沿才是一条水平线）');
  assert.match(styles, /\.homepage-mode-card\.card-1:hover \{ transform: translateY\(-14px\) rotate\(-5deg\); \}/, 'hover 必须把旋转带回去（否则一悬停扇子就散架）');
  assert.match(styles, /\.homepage-mode-card\.card-2:hover \{ transform: translateY\(-14px\) rotate\(5deg\); \}/, 'hover 必须把旋转带回去');
  assert.match(styles, /\.homepage-mode-card\.card-1:active \{ transform: translateY\(-8px\) rotate\(-5deg\); \}/, 'active 也要带回旋转');
  assert.doesNotMatch(styles, /\.homepage-mode-card\.card-1 \{[^}]*margin-right:\s*-\d+px/, '两片不互相压边（歪的是角度，不是位置）');
  assert.match(styles, /\.homepage-mode-cards \{[^}]*gap:\s*20px/, '两片之间是缝（转 5° 后左右各外扩约 7px，缝要留够），不是负外边距');
  /* 圆角的框：白色上收到**一层**（#4-1 的「背景圆角的框…外面是白色」+ #1-8 的「标题有白色背景」） */
  assert.match(styles, /\.homepage-mode-cards \{[^}]*border-radius:\s*24px/, '整组必须有一张圆角的框');
  assert.match(styles, /\.homepage-mode-cards \{[^}]*background:\s*var\(--sb-surface-card\)/, '框是白色（用户 #4-1：外面是白色）');
  assert.match(styles, /\.homepage-mode-card \{[^}]*background:\s*transparent/, '卡本身必须透明（白色不许各占一块 —— 用户 #1-8）');
  assert.match(styles, /\.homepage-mode-card \{[^}]*width:\s*232px/, '两片同宽（单一宽度规则）');
  /* 2026-09-15 V3：hover 与 focus-visible 从「合并选择器」拆成各自独立的规则 ——
     原则 4.2 要求 focus 必须独立于 hover 可见（键盘用户看不到 hover），
     合并写法会让焦点环被 hover 的 transform 规则牵连。契约不变：hover 仍是上浮 16px。 */
  assert.match(styles, /\.homepage-mode-card:hover \{[\s\S]*?transform:\s*translateY\(-14px\)/);
  assert.match(styles, /\.homepage-mode-card:focus-visible/);
  assert.match(styles, /\.homepage-mode-card:active/);
  assert.doesNotMatch(styles, /\.homepage-mode-card\.is-active[^}]*rotate\(0\)/);
  /* 2026-09-15 V3：时长/缓动改走 token（--sb-duration-* + --sb-ease-out），
     契约「位移有过渡、且是产品级缓动」不变，只是取值来源统一。 */
  assert.match(styles, /\.homepage-mode-card \{[\s\S]*?transition:\s*transform var\(--sb-duration-normal\)/);
  assert.doesNotMatch(styles, /\.homepage-mode-card:hover \.homepage-mode-card-visual img/);
  /* hover 规则不得带 z-index（避免 hover 制造层叠事故） */
  const hoverRule = styles.match(/\.homepage-mode-card:hover \{([^}]*)\}/)?.[1] || '';
  assert.ok(hoverRule, 'hover 规则存在');
  assert.doesNotMatch(hoverRule, /z-index\s*:/);
  /* 原则 4.3：hover 不得染紫（只允许中性 token） */
  assert.doesNotMatch(hoverRule, /--sb-brand/, 'hover 不得出现品牌色');
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.homepage-mode-card/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.homepage-mode-card \{[^}]*width:\s*min\(/);
  assert.match(styles, /\.homepage-mode-card-visual img \{[^}]*object-fit:\s*contain/);
});

/* ═══ 批 J-⑥：选中那一片要再抬高一点点（用户批注 #5-1，2026-09-19）════════════════════════
   用户原话：「用户他点击这两张卡片的任意一张，他应该是会再抬高一点点的。你现在情况就是
   这两张他都是埋下去的。如果用户他点击其中一张，选中其中一张的话，他应该再稍微抬高一点点。」
   改前选中态只有"描边 + 浅底"、**位置与未选中一模一样** —— 那就是"都是埋下去的"。
   契约：选中 = 抬 10px（比 hover 的 14px 轻一档，因为它是持久状态不是掠过反馈），
   且每一条都要把 ±5° 的旋转带回去（不带的话选中瞬间扇子就散架）。 */
test('J-⑥ 选中的模式卡比未选中的再抬高一点点，且旋转不掉', () => {
  assert.match(styles, /\.homepage-mode-card\.card-1\.is-active \{ transform: translateY\(-10px\) rotate\(-5deg\); \}/,
    '左片选中要抬 10px 并保住 -5°');
  assert.match(styles, /\.homepage-mode-card\.card-2\.is-active \{ transform: translateY\(-10px\) rotate\(5deg\); \}/,
    '右片选中要抬 10px 并保住 +5°');
  /* 选中与未选中必须在**同一个方向**上拉开差距：抬起来，而不是压下去。 */
  const lift = Number(styles.match(/\.homepage-mode-card\.card-1\.is-active \{ transform: translateY\((-?\d+)px\)/)?.[1]);
  assert.ok(lift < 0, '选中必须是"抬起来"（负的 translateY），不能是压下去');
  const hoverLift = Number(styles.match(/\.homepage-mode-card\.card-1:hover \{ transform: translateY\((-?\d+)px\)/)?.[1]);
  assert.ok(Math.abs(lift) < Math.abs(hoverLift), '选中的抬升要**轻于** hover（持久状态 vs 掠过反馈）');
  /* 选中之后仍然要能响应 hover / 按下（否则选中那片变成一潭死水）。 */
  assert.match(styles, /\.homepage-mode-card\.card-1\.is-active:hover \{ transform: translateY\(-16px\) rotate\(-5deg\); \}/,
    '选中 + hover 要再抬一点');
  assert.match(styles, /\.homepage-mode-card\.card-2\.is-active:active \{ transform: translateY\(-6px\) rotate\(5deg\); \}/,
    '选中 + 按下要有按压反馈');
});

test('mode cards use original normalized artwork with transparent margins', async () => {
  const assets = [
    '../public/images/home/entry-ecommerce.png',
    '../public/images/home/entry-video.png',
    '../public/images/home/entry-xhs.png',
    '../public/images/home/entry-visual.png',
  ];

  const manifest = JSON.parse(readFileSync(new URL('../public/images/home/entry-assets.manifest.json', import.meta.url), 'utf8'));
  assert.equal(Object.keys(manifest.assets).length, 8);
  for (const item of Object.values(manifest.assets)) {
    assert.match(item.path, /^\/images\/(?:home|visual-recipes)\/[a-z-]+\.png$/);
    assert.equal(item.alpha, true);
    assert.match(item.promptSummary, /^Original /);
  }

  for (const asset of assets) {
    const input = readFileSync(new URL(asset, import.meta.url));
    const metadata = await sharp(input).metadata();
    const alpha = await sharp(input).extractChannel('alpha').stats();
    assert.equal(metadata.format, 'png');
    assert.equal(metadata.width, 420);
    assert.equal(metadata.height, 360);
    assert.equal(metadata.hasAlpha, true);
    assert.equal(alpha.channels[0].min, 0);
    assert.ok(alpha.channels[0].max >= 250);
    const name = new URL(asset, import.meta.url).pathname.split('/').pop();
    assert.equal(manifest.assets[name].sha256, createHash('sha256').update(input).digest('hex'));
  }

  for (const copiedAsset of [
    '../public/images/home/reference-card-product.png',
    '../public/images/home/reference-card-fashion.png',
    '../public/images/home/reference-card-video.png',
    '../public/images/home/reference-card-remix.png',
  ]) assert.equal(existsSync(new URL(copiedAsset, import.meta.url)), false);
});

test('ecommerce controls: 模型优先; 避免出现的元素归内容规范; 画面风格=技能库真源 (9-11 二轮 + 9-15 批注)', () => {
  const ecMode = readFileSync(new URL('../src/pages/Home/EcMode.jsx', import.meta.url), 'utf8');
  const settings = readFileSync(new URL('../src/pages/Home/ec/GenSettingsPanel.jsx', import.meta.url), 'utf8');
  const style = readFileSync(new URL('../src/pages/Home/ec/StylePanel.jsx', import.meta.url), 'utf8');
  const catalog = readFileSync(new URL('../src/services/imageModelCatalog.js', import.meta.url), 'utf8');
  const buttons = ecMode.match(/const DEFAULT_BUTTONS = \[([\s\S]*?)\n  \];/)?.[1] || '';

  assert.match(buttons.trimStart(), /^\{\s*key: 'settings'/);
  /* 2026-09-15 用户批注：「避免出现的元素为什么要放在生成设置里？它不应该在这个面板。」
     生成设置 = 模型/清晰度/品牌主色（设备与输出参数）；
     「避免出现的元素」= 画面内容约束 → 迁到「内容规范」（正向要什么 + 反向不要什么）。
     数据链路不变（仍是 genSettings.negativePrompt），画布侧同步不受影响。 */
  /* ⚠️ 一律**先剥注释**再断言（复用 scripts/lib/token-scope.mjs 的同一份实现）：
     解释「为什么删掉那 5 个标签」的注释里必然会写到它们的名字，
     门禁若把注释算成用法，就是在惩罚「把来龙去脉写清楚」。 */
  const constraints = stripComments(readFileSync(new URL('../src/pages/Home/ec/GenerationConstraintsPanel.jsx', import.meta.url), 'utf8'));
  assert.doesNotMatch(settings, /避免出现的元素/, '生成设置面板不得再渲染该分组');
  assert.match(constraints, /避免出现的元素/, '该分组已落到内容规范面板');
  /* 2026-09-15 用户批注（图6-②）：常用约束快选**整块删除**（本条由「保留」反转为「不得出现」）。
     用户原话：「我觉得你这里为什么会有 5 个可被填入的标签呀？……你有这些东西用户他就不自由了，
     用户他应该自由地去填他产品相关的一些禁忌吧。」
     —— 禁忌是**品类相关**的（食品怕「变质暗示」、服装怕「走光」、3C 怕「接口错误」），
     给一组通用标签反而把用户往这 5 个词上引，既不全也误导。保留手输 + 格式提示即可。 */
  assert.doesNotMatch(constraints, /商品结构变形|异常手部|乱码文字|无关道具|多余水印/,
    '不得再出现预置约束标签（用户明确要求自由填写）');
  assert.match(constraints, /ResizableTextarea/, '手输入口必须保留');
  assert.match(ecMode, /negativePrompt=\{genSettings\.negativePrompt\}/, '数据仍走 genSettings.negativePrompt');
  assert.doesNotMatch(style, /避免出现的元素/);
  /* 积分说明句已删（2026-09-15 批注③）：积分只在主 CTA 动态显示 */
  assert.doesNotMatch(settings, /generationUnits/, '不再在面板内展示「当前约 N AI 积分/张」');
  /* 9-11 三轮: 模型卡片改用真实品牌标 (ModelLogo + brandLogo), 不再用 1.5MB 示例大图 */
  /* 2026-09-16：断言从「单行字面量」改成「跨行结构」—— 模型图标改成单层后属性换行了，
     判据（模型卡片必须用真实品牌标）一字未变。 */
  assert.match(settings, /<ModelLogo[\s\S]{0,80}logo=\{brandLogo\(model\.brand\)\}/);
  assert.doesNotMatch(settings, /model\.visual/);
  /* 画面风格 = 技能库「生图」内置技能 (唯一真源), 本地只留兜底视觉 */
  assert.match(style, /fetchSkillLibrary\(\{ kind: 'image' \}\)/);
  assert.match(style, /FALLBACK_STYLE_SKILLS/);
  assert.doesNotMatch(style, /const STYLES = \[/);
  /* 9-11 三轮: 视觉方向面板被技能库取代 — 触发按钮直接开技能库, StylePanel 不再挂首页 */
  assert.match(ecMode, /opensSkillLibrary: true/);
  assert.match(ecMode, /if \(key === 'skills'\)/);
  assert.doesNotMatch(ecMode, /activePanel === 'style'/);
  /* 2026-09-15：标题从「锁定品牌主色调」改为「品牌主色调」——
     默认必须表示「未锁定任何颜色」（用户批注①），标题自称「锁定」会与默认态矛盾。
     锁定与否由色块描边 + 按钮文案（锁定/已锁定）表达。 */
  assert.match(settings, /品牌主色调/);
  assert.match(settings, /\{brandLocked \? '已锁定' : '锁定'\}/);
  /* 9-11 三轮: 三个模型的视觉标识改为品牌 key (openai / gemini), 由 modelLogos 统一解析成 SVG 标 */
  /* 9-13 扩档：目录现有 8 档（原 3 档 + 新增 2.5 两个变体 / MDKJ / Gemini 3 / Midjourney）；
     品牌 key 由 modelLogos 统一解析成 SVG 标，仍然是“不再用示例大图”这条契约。 */
  assert.equal((catalog.match(/brand: '(openai|gemini|midjourney|qwen|alibaba|seedream)'/g) || []).length, 8);
  assert.doesNotMatch(catalog, /images\/models\//);
});