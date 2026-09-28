/* ══════════════════════════════════════════════════════════════════════════════════════════════
   2026-09-25 批 BN 门禁：**工作台底部生成按钮**（通栏 / 禁用"不亮" / 提示在按钮下方）

   用户原话（逐字，两张批注图）：
     「你这个按钮还是没做对呀。我说了好多次了，就是你工作台下面的这个生成按钮，不管是生成预览
      还是生成图片，生成视频。**你这个按钮不能搞得这么的窄呀**，你应该学习知渔他们的做法呀。」
     「你好好看一下他们这个按钮是怎么做的，他们做的是大概多宽，然后怎么样去适配的？然后他们
      这个按钮是**当用户没有满足条件的时候，这个按钮是不能够亮起来的**。然后当你这个是必须要上传
      素材的时候，**它下面是会有一个提示必须要上传的**。如果你这个 skill 不需要一定要上传素材，
      那就不会有这个提示，就是只要用户他输入了提示词，这里就会亮起来。」

   知渔实测（用户截图 2560×1280 **逐像素**，脚本 .qa/bn-measure-quantv-cta.mjs）：
     按钮 x 152→789（638 device = **319 CSS px**，左栏内容宽 356 ⇒ **通栏**）、y 1130→1197
     （68 device = 34 CSS px）；未满足条件时底 #8f8f8f（灰）+ 白字；提示在按钮下方 ~18px、居中、
     灰字 #6b7280 / #9ca1aa ≈13px（y≈1235-1250）。

   ⚠️ 判据变更说明：**用户改向**（不是事实变了）——
     批 BF 曾要求「按钮不要那么宽」（于是改成 width:auto + min-width:220 + 右对齐），
     本轮用户明确要求照知渔做通栏。两次原话都留在 CSS 注释里。
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');

test('① 图片侧工作台：CTA **通栏**，且不存在"窄按钮"的残留（min-width:220 / 右对齐）', () => {
  const css = read('src/components/media/WorkbenchShell.css');
  const ctaBlock = css.slice(css.indexOf('.media-workbench-cta {'), css.indexOf('.media-workbench-submit {'));
  const submitBlock = css.slice(css.indexOf('.media-workbench-submit {'), css.indexOf('.media-workbench-submit:hover'));

  assert.match(ctaBlock, /display: flex;/, 'CTA 容器仍是 flex（按钮 + 提示两行）');
  assert.match(ctaBlock, /flex-direction: column;/, '容器竖排：按钮在上、提示在下（知渔实测形态）');
  assert.doesNotMatch(ctaBlock, /justify-content: flex-end/, '不许再把整行推到右边（用户改向）');
  assert.match(submitBlock, /width: 100%;/, '按钮通栏');
  assert.doesNotMatch(submitBlock, /min-width: 220px/, '窄按钮的 min-width 必须删掉（就是它让按钮"这么窄"）');
  assert.doesNotMatch(submitBlock, /justify-self: end/, '不再右对齐');
  assert.match(submitBlock, /justify-content: center;/, '内容居中（知渔那颗按钮的文字也是居中的）');
});

test('② 禁用态"不亮"：灰底静音字，不再是品牌紫淡化；但积分 chip 仍显眼', () => {
  const css = read('src/components/media/WorkbenchShell.css');
  /* 只切到"禁用主块"结束（下一条禁用规则开头），不要一路切到很远的注释处 ——
     那样会把别的规则的 opacity 也算进来（本仓同名选择器多、区间别切太宽）。 */
  const disabledStart = css.indexOf('.media-workbench-submit:disabled {');
  const disabled = css.slice(disabledStart, css.indexOf('.media-workbench-submit:disabled .media-workbench-points'));
  const points = css.slice(css.indexOf('.media-workbench-submit:disabled .media-workbench-points'), css.indexOf('.media-workbench-submit-label'));
  /* 禁用底色/字色必须与全局 CTA 用**同一对** token —— 实机探针抓到过一次两边不一致
     （一边一种灰）：同一件事两个长相正是用户最烦的"两套东西"。
     ═══ 2026-09-28 批 CY-⑤（**用户改向**，同一批的图4/图7）：这行判据原来要求"底 = token 本体"，
       而那个 token 是 **rgba(12,10,9,.04) 半透明** —— 于是禁用时**背后内容从按钮里透出来**
       （用户原话：「就是我去**滑动它还是能够看到它背后的那个工作台的内容**。还是会被露出来。
        **这个问题已经有让你去解决啦**，你还是没解决掉呀。」实测那颗灰按钮左右两半
       245,245,245 与 243,242,244 —— 同一颗按钮两种灰就是透出来的证据）。
       ⇒ 判据收窄为"那层半透明灰必须**叠在**一层不透明的卡片底上"：渲染结果与原来逐像素相同，
         但下面再没有东西能透过来。完整理由见 generate-cta.css 同一段。 */
  assert.match(disabled, /background: linear-gradient\(var\(--sb-state-disabled-bg\), var\(--sb-state-disabled-bg\)\), var\(--sb-surface-card\);/,
    '禁用底 = 半透明灰叠在不透明卡片底上（不许直接写半透明 token）');
  assert.match(disabled, /color: var\(--sb-state-disabled-ink\)/);
  assert.doesNotMatch(disabled, /opacity/, '禁用主块里不许再有 opacity（那是"品牌紫淡化"的老写法，也会让背后内容透出来）');
  assert.match(disabled, /cursor: not-allowed/);
  /* 9-12 的用户口径：按钮可以是灰的，但积分必须仍然显眼 */
  assert.match(points, /background: var\(--sb-brand-a10\)/);
  assert.match(points, /color: var\(--sb-brand-700\)/);
});

test('③ 提示：规格**只有一份**（generate-cta.css），图片侧与视频侧共用同一个类', () => {
  const shared = read('src/styles/generate-cta.css');
  const shell = read('src/components/media/WorkbenchShell.css');
  const shellJsx = read('src/components/media/WorkbenchShell.jsx');
  const videoJsx = read('src/pages/VideoStudio/index.jsx');
  const videoCss = read('src/pages/VideoStudio/VideoStudio.css');
  const main = read('src/main.jsx');

  assert.match(main, /styles\/generate-cta\.css/, '共享样式表必须是**全局**加载的（否则视频侧拿不到样式）');
  assert.match(shared, /\.shubao-gen-cta-hint \{[\s\S]{0,240}text-align: center;/, '提示居中（知渔实测居中）');
  assert.match(shared, /\.shubao-gen-cta-hint \{[\s\S]{0,240}color: var\(--sb-ink-3\)/, '提示是灰字');
  /* 图片侧：节点上必须**两个类都在** —— 共享类给样式，media- 类给门禁/e2e 选择器 */
  assert.match(shellJsx, /className="media-workbench-cta-hint shubao-gen-cta-hint"/);
  assert.match(shell, /\.media-workbench-cta-hint \{ margin: 0; \}/, 'media- 类只留类名，不再重复定义规格');
  /* 视频侧：用同一个共享类 */
  assert.match(videoJsx, /className="shubao-gen-cta-hint"/, '视频侧提示用共享类（两边同一套规格）');
  assert.match(videoCss, /\.video-submit-actions\.has-hint \{ flex-direction: column; align-items: stretch; \}/);
});

test('④ 视频侧：缺什么说什么（只在真缺东西时出现），且不写内部原因', () => {
  const page = read('src/pages/VideoStudio/index.jsx');
  const hint = page.slice(page.indexOf('const submitHint = (() =>'), page.indexOf('})();', page.indexOf('const submitHint = (() =>')));
  for (const text of ['登录后即可生成', '视频生成暂未开放', '请输入画面描述', '请先上传首帧和尾帧', '请先上传参考图片和参考视频', '请先「分析并生成方案」并确认']) {
    assert.ok(hint.includes(text), '缺料提示里应有：' + text);
  }
  assert.doesNotMatch(hint, /requires=false|undefined|null/, '文案里不许出现内部原因/空值');
  /* 提示与 has-hint 绑定：没有提示时保持原来那一行（次按钮 + 主按钮并排）
     ═══ 2026-09-28 批 CY-②：**用户改向** —— 这行提示只在**子页面工作台**挂，首页不许挂 ═══════════
     用户原话（逐字）：「然后你按钮下面这个输入描述这个东西，你为什么要放在这里呢？他跟首页没有任何关系呀，
       首页不需要这个呀。首页这个视频生成的这个按钮这里你要**做回原来的样子**呀，不能加入这个东西，明白吗？」
     背景：这行提示本身是批 BN 照**知渔的子页面**加的（当时原话：「他们这个按钮是当用户没有满足条件的时候……
       它下面是会有一个提示必须要上传的」），对照物是子页面而不是首页。
     ⇒ 判据从 `submitHint ? …` 改成 `showSubmitHint ? …`（= `workbenchMode && submitHint`）；
       文案与"缺什么说什么"三条规矩**一字未改**，只是不再往首页渲染。 */
  assert.match(page, /const showSubmitHint = workbenchMode && Boolean\(submitHint\)/,
    '提示必须被 workbenchMode 限定（首页不挂）');
  assert.match(page, /showSubmitHint \? ' has-hint' : ''/);
  assert.equal((page.match(/has-hint/g) || []).length, 2, '两条 CTA 通道（process / 上游）都要挂');
});

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   第五节（批 BO）：主 CTA 的**启用态**按留影AI 按钮策略（docs/design/83）给"修饰"，且三处同一份来源。

   用户原话：「你这个按钮满足所有需求之后，它亮起来是紫色，对吗？紫色其实也不是特别好呀。
   就是**没有任何修饰的紫色**，确实是太简单粗暴了，我之前不是有跟你说过按钮要去遵循我们之前抄
   那个留影AI他们的那个按钮的规则去做吗？你有没有按照那个规则去实现呢？」

   实测（`.qa/bo-verify.mjs`）：
     启用态 backgroundImage = `linear-gradient(135deg, rgb(124,58,237) 0%, rgb(109,40,217) 100%)`
     hover  = `linear-gradient(135deg, rgb(139,92,246) 0%, rgb(124,58,237) 100%)`（整体亮一档）
     —— 两端**同色相**（brand-600/700 与 brand-500/600），不是 9-18 否过的"双色渐变"。
   ⚠️ 判据变更 = **用户改向**：`裁定 2`（功能按钮禁止渐变）是既有裁定，本批按用户最新口径收窄为
      "同色相两档、远看仍是品牌实底"；`Home.css` 的 `.ec-workbench-cta` 那条门禁（d-1）**没动**。
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
test('⑤ 主 CTA 启用态：常驻 + 悬停都是 135° 同色相渐变（三处同一份来源，用户 9-26 批准常驻渐变）', () => {
  const shared = read('src/styles/generate-cta.css');
  const shellCss = read('src/components/media/WorkbenchShell.css');
  const videoCss = read('src/pages/VideoStudio/VideoStudio.css');

  /* 常驻 = **纯色品牌紫**（这是既有裁定：功能 CTA 不许渐变，另有门禁守着），
     留影那套的"渐变"出现在**悬停**（他们 12 宫格默认全白、悬停才出 135° 渐变）。
     ⇒ 两条都要钉住：常驻不许是渐变，悬停必须是"亮一档的 135° 渐变"。 */
  assert.match(shared, /--sb-cta-grad-hover:\s*linear-gradient\(135deg, var\(--sb-brand-400\) 0%, var\(--sb-brand-600\) 55%/,
    '悬停渐变：亮端到 brand-400，但 55% 处就落回 brand-600（文字所在的中间区保持够深）');
  /* 2026-09-26 批 BP：用户批准「主 CTA **常驻态库可以做成渐变的**」⇒ 常驻渐变回来了，
     判据随之改成"常驻必须是那条渐变变量、135°、同色相两档"（仍然是品牌紫一个色相，不是双色）。 */
  /* 批 BS：跨度拉开（用户：「你这个样式依然没有渐变变化呀」）——两端差两档，肉眼看得出来。 */
  assert.match(shared, /--sb-cta-grad:\s*linear-gradient\(135deg, var\(--sb-brand-500\) 0%, var\(--sb-brand-700\) 100%\)/,
    '常驻渐变：135°、brand-500 → brand-700（跨度两档）');
  const restRule = shared.slice(shared.indexOf('.shubao-gen-cta {'), shared.indexOf('.shubao-gen-cta:hover'));
  assert.match(restRule, /background: var\(--sb-cta-grad\)/, '常驻底色 = --sb-cta-grad（同色相两档渐变）');
  /* 三处同源：全局 CTA / 图片侧工作台 / 视频侧主 CTA */
  /* ⚠️ 窗口别收太窄：实测 background 那行距块首约 430 字符（中间有注释），400 会漏判。 */
  assert.match(shellCss, /\.media-workbench-submit \{[\s\S]{0,700}background: var\(--sb-cta-grad\)/, '图片侧常驻渐变');
  assert.match(videoCss, /\.video-submit-row button \{[\s\S]{0,600}background: var\(--sb-cta-grad\)/, '视频侧常驻渐变');
  /* hover 三处都要亮一档（缺一处就是"两套东西"） */
  for (const [name, src] of [['全局 CTA', shared], ['图片侧', shellCss], ['视频侧', videoCss]]) {
    assert.match(src, /:hover:not\(:disabled\)[\s\S]{0,220}background: var\(--sb-cta-grad-hover\)/, name + ' hover 必须亮一档');
  }
  /* 本轮只动"带文字的主 CTA"：Home.css 的 .ec-workbench-cta（另一条 d-1 门禁守着的那个）不碰 */
  assert.doesNotMatch(read('src/pages/Home/Home.css').slice(read('src/pages/Home/Home.css').indexOf('.ec-workbench-cta {'), read('src/pages/Home/Home.css').indexOf('.homepage-mode-showcase {')), /linear-gradient/);
});

test('⑥ 缺料提示说**人话**（知渔式整句），且句子里保留字段名（阻塞判据要"点名"）', () => {
  const page = read('src/pages/MediaCreation/index.jsx');
  assert.match(page, /const gateHint = useMemo/, '提示文案由一个函数统一产出');
  assert.match(page, /'请先' \+ verb \+ field\.label \+ '（至少 ' \+ min \+ ' 张）'/, '上传位：请先{字段名}（至少 N 张）');
  assert.match(page, /'请先填写' \+ \(first \|\| '必填项'\)/, '文本位：请先填写{字段名}');
  assert.doesNotMatch(page, /'还差：' \+ validation\.missing/, '旧的生硬简写已下线');
  assert.match(page, /'请先勾选要生成的内容模块'/, '模块闸门也改成人话');
});

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   第六节（批 CY-⑤）：**白底要铺满 + 禁用档不许透明**（用户批注图7 / 图4）

   用户原话（逐字）：「你好好看一下现在你这个**生成预览或者生成图片、生成视频的这个按钮**，
   它**左右两边实际上好像还是没有覆盖满**。就是我去**滑动它还是能够看到它背后的那个工作台的内容**。
   还是会被露出来。**这个问题已经有让你去解决啦**，你还是没解决掉呀。」

   两处成因（都不是猜的，逐像素量出来的：`.qa/cy2-cta-edges.mjs` + 用户截图像素）：
     · 图7：左栏自己有 `padding: 24px 20px 0`，而 CTA 是它**内容盒**里的 sticky 长条 ⇒ 白底只铺到
       内容盒（x 140→526），左 20px / 右 31px（20 内边距 + 11 滚动条槽）留在外面。图6（背后恰好是
       白底）看不出来；**图7 露馅**：被压在下面的「设计风格」行里那颗紫边「AI推荐」按钮的左边缘
       （约 4px 宽、50px 高、RGB≈(224,208,251)）从「生成预览」按钮左沿外透出来。
     · 图4/图7：三处主 CTA 的禁用底色是 `--sb-state-disabled-bg` = **rgba(12,10,9,.04) 半透明** ⇒
       禁用时**背后内容从按钮里透出来**（图4 那颗灰按钮左右两半实测 245,245,245 与 243,242,244 ——
       同一颗按钮两种灰，就是下层输入框的白底圆角透出来的证据）。
   ⚠️ 这两条判据都**不写死数字/色值**：白底那条从"左栏自己的内边距"算出来比，禁用那条要求
      "半透明 token 必须叠在一层不透明的卡片底上"。以后谁改了一边，这里当场红。
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
test('⑦ 图片侧底栏白底：左右**铺满左栏**（负外边距 + 等量内边距，数值跟着左栏内边距走）', () => {
  const css = read('src/components/media/WorkbenchShell.css');
  const leftBlock = css.slice(css.indexOf('.media-workbench-left {'), css.indexOf('}', css.indexOf('.media-workbench-left {')));
  const pad = (leftBlock.match(/padding:\s*([^;]+);/) || [, ''])[1].trim().split(/\s+/);
  const padX = parseFloat(pad.length >= 2 ? pad[1] : pad[0]);
  assert.equal(padX, 20, '左栏左右内边距 = 20（真源：`.media-workbench-left { padding: 24px 20px 0 }`）');

  const ctaBlock = css.slice(css.indexOf('.media-workbench-cta {'), css.indexOf('.media-workbench-submit {'));
  assert.match(ctaBlock, new RegExp('margin-left:\\s*-' + padX + 'px;'), 'CTA 要用负外边距把左栏那圈内边距吃进来（左右都算）');
  assert.match(ctaBlock, new RegExp('margin-right:\\s*-' + padX + 'px;'), '右边同样要吃（只修一边＝还是没铺满）');
  assert.match(ctaBlock, new RegExp('padding-left:\\s*' + padX + 'px;'), '补回等量内边距，按钮本体位置不变');
  assert.match(ctaBlock, new RegExp('padding-right:\\s*' + padX + 'px;'), '补回等量内边距（右）');
  assert.match(ctaBlock, /background: var\(--sb-surface-card\);/, '底栏必须有**不透明**底色（白底才谈得上"铺满"）');
  /* 上下两条是批 BL/BM 定过的，不许被这次改动带歪。 */
  assert.match(ctaBlock, /padding-top: 20px;/, '上内边距仍是批 BL 定的 20（不动）');
  assert.match(ctaBlock, /padding-bottom: 28px;/, '下内边距仍是批 BM 定的 28（不动）');
});

test('⑧ 三处主 CTA 的禁用档：半透明 token 必须叠在**不透明的卡片底**上（否则背后内容透出来）', () => {
  const layered = /background:\s*linear-gradient\(var\(--sb-state-disabled-bg\), var\(--sb-state-disabled-bg\)\),\s*var\(--sb-surface-card\);/;
  const files = [
    ['全局 CTA', 'src/styles/generate-cta.css', /\.shubao-gen-cta:disabled \{[\s\S]*?\}/],
    ['图片侧工作台', 'src/components/media/WorkbenchShell.css', /\.media-workbench-submit:disabled \{[\s\S]*?\}/],
    ['视频侧工作台', 'src/pages/VideoStudio/VideoStudio.css', /\.video-submit-row button:disabled \{[\s\S]*?\}/],
  ];
  for (const [name, file, re] of files) {
    const css = read(file);
    const block = (css.match(re) || [''])[0];
    assert.ok(block, name + ' 必须有一条 :disabled 规则');
    assert.match(block, layered, name + ' 的禁用底色 = 半透明灰**叠**在不透明卡片底上（不许只写 token）');
    assert.doesNotMatch(block, /background:\s*var\(--sb-state-disabled-bg\);/, name + ' 不许把半透明 token 直接当底色（那就是"透出来"的成因）');
  }
  /* token 本体保持原样（另有 17 处引用：Button.jsx / SizingPanel / Pricing / Plog…，本批一条都不碰） */
  const tokens = read('src/styles/design-tokens-v3.css');
  assert.match(tokens, /--sb-state-disabled-bg:\s*rgba\(12, 10, 9, 0\.04\)/, '亮色主题的禁用底仍是那个半透明值（所以要靠"叠"来不透明）');
  assert.match(tokens, /--sb-state-disabled-bg:\s*rgba\(255, 255, 255, 0\.05\)/, '暗色主题同理（5% 白）');
});
