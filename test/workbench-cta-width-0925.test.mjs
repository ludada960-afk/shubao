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
     （一边一种灰）：同一件事两个长相正是用户最烦的"两套东西"。 */
  assert.match(disabled, /background: var\(--sb-state-disabled-bg\)/);
  assert.match(disabled, /color: var\(--sb-state-disabled-ink\)/);
  assert.doesNotMatch(disabled, /opacity/, '禁用主块里不许再有 opacity（那是"品牌紫淡化"的老写法）');
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
  /* 提示与 has-hint 绑定：没有提示时保持原来那一行（次按钮 + 主按钮并排） */
  assert.match(page, /submitHint \? ' has-hint' : ''/);
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
test('⑤ 主 CTA 启用态：常驻纯色 + 悬停 135° 渐变（留影AI 形态），三处同一份来源', () => {
  const shared = read('src/styles/generate-cta.css');
  const shellCss = read('src/components/media/WorkbenchShell.css');
  const videoCss = read('src/pages/VideoStudio/VideoStudio.css');

  /* 常驻 = **纯色品牌紫**（这是既有裁定：功能 CTA 不许渐变，另有门禁守着），
     留影那套的"渐变"出现在**悬停**（他们 12 宫格默认全白、悬停才出 135° 渐变）。
     ⇒ 两条都要钉住：常驻不许是渐变，悬停必须是"亮一档的 135° 渐变"。 */
  assert.match(shared, /--sb-cta-grad-hover:\s*linear-gradient\(135deg, var\(--sb-brand-500\) 0%, var\(--sb-brand-600\) 100%\)/,
    '悬停渐变：135°、整体亮一档（brand-500 → brand-600）');
  assert.doesNotMatch(shared, /--sb-cta-grad:/, '不许再有"常驻渐变"那条变量（与纯色裁定冲突）');
  const restRule = shared.slice(shared.indexOf('.shubao-gen-cta {'), shared.indexOf('.shubao-gen-cta:hover'));
  assert.match(restRule, /background: var\(--sb-brand-600\)/, '常驻底色 = 品牌紫纯色');
  assert.doesNotMatch(restRule, /linear-gradient/, '常驻态不许出现渐变');
  /* 三处同源：全局 CTA / 图片侧工作台 / 视频侧主 CTA */
  /* ⚠️ 窗口别收太窄：实测 background 那行距块首约 430 字符（中间有注释），400 会漏判。 */
  assert.match(shellCss, /\.media-workbench-submit \{[\s\S]{0,700}background: var\(--sb-brand-600\)/, '图片侧常驻纯色');
  assert.match(videoCss, /\.video-submit-row button \{[\s\S]{0,600}background: var\(--sb-brand-600\)/, '视频侧常驻纯色');
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
