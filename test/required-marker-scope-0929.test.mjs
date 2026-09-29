/* ═══ 2026-09-29 批 DC 续-8：着重号只给「可操作区」，不给「区块总标题」 ═══════════════════════════════
   用户原话（逐字，完整）：
     「还有就是我一直觉得你现在对于哪些标题应该加着重号，你好像没有搞得很明白。你现在应该加着重号的
       其实是这种**前面有紫色竖杠**的这种地方。然后他们上面我打个比方，就像这里的上面这个
       **产品卖点与设计风格**，这句应该就不是要加着重号的。真正要加着重号的其实是**每一个用户操作区**，
       他那个位置需要加标题着重号。而不是每一个**区块的总标题**那个地方要加着重号。总而言之，
       就是你要**以功能和操作区为主**。然后不管是图片生成还是视频生成他们的子页面，
       你都要跟着去解决这个问题去进行调整和优化。」

   ⚠️ 这条门禁守的**不是"星号画在哪"**（星号一直就只在字段标签上），而是三件真正会跑偏的事：
     ① **层级倒挂**：改前区块总标题 14/800/墨色，字段标签 14.672/500/墨色 ——
        总标题比下面每一个可操作区都重，视觉上就是"总标题被着重了"。
     ② **竖条被套到不可操作的块上**（视频侧）：panel / note / tags 三种块都没有输入，
        却挂了带 3px 品牌竖条的 `.media-field-label` —— 竖条在说"这里能点"，而它不能点。
     ③ **必填星号两套颜色**：图片侧 `--sb-brand-600`、视频侧 `--sb-ink-danger-strong`。
        同一件事两套颜色，就是"没搞得很明白"的一部分。 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
/* ⚠️ 剥注释再判：本批已经踩过一次 —— 我在注释里如实写下了某个被删的选择器，
   不剥注释就会把「说明」当成「代码」。源码级判据不剥注释 = 静默误判。 */
const code = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const num = (css, prop) => {
  const m = css.match(new RegExp(prop + '\\s*:\\s*([\\d.]+)px'));
  return m ? Number(m[1]) : null;
};

const SHELL = read('src/components/media/WorkbenchShell.css');
const VSHELL = read('src/components/media/VideoWorkbench.css');
const VJSX = read('src/components/media/VideoWorkbench.jsx');
const VDECL = read('src/skills/videoWorkbenches.js');

test('① 层级不倒挂：区块总标题必须比每一个可操作区**轻**', () => {
  const groupTitle = SHELL.slice(SHELL.indexOf('.media-workbench-group-title {'), SHELL.indexOf('}', SHELL.indexOf('.media-workbench-group-title {')));
  const fieldLabel = SHELL.slice(SHELL.indexOf('.media-field-label {'), SHELL.indexOf('}', SHELL.indexOf('.media-field-label {')));
  assert.ok(groupTitle && fieldLabel, '自证：两条规则都找得到');
  const gSize = num(groupTitle, 'font-size');
  const fSize = num(fieldLabel, 'font-size');
  const gWeight = Number((groupTitle.match(/font-weight:\s*(\d+)/) || [])[1]);
  const fWeight = Number((fieldLabel.match(/font-weight:\s*(\d+)/) || [])[1]);
  assert.ok(fSize > gSize, `字段标签必须比区块总标题**大**（操作区是主角）：实得 ${fSize} vs ${gSize}`);
  assert.ok(gWeight < 800, `区块总标题不许再是 800 —— 那是批 BL 的旧结论，已被 2026-09-29 的口径推翻。实得 ${gWeight}`);
  assert.ok(fWeight >= gWeight, '字段标签字重不低于区块总标题（操作区是主角）');
  /* 色阶同理：总标题是灰的，字段标签是墨的。 */
  assert.match(groupTitle, /color:\s*var\(--sb-ink-3\)/, '区块总标题回到灰档（规格 docs/design/60:687-692）');
});

test('② 竖条只在 `.media-field-label` 上（它的原意是"这里可被操作"）', () => {
  const shellCode = code(SHELL);
  const bars = shellCode.match(/^[^\n{]*::before[^\n{]*\{/gm) || [];
  const barRules = bars.filter(rule => /linear-gradient\(180deg, var\(--sb-brand-500\)/.test(
    SHELL.slice(SHELL.indexOf(rule), SHELL.indexOf('}', SHELL.indexOf(rule))),
  ));
  assert.equal(barRules.length, 1, '自证：品牌竖条只有一条规则，实得 ' + barRules.length);
  assert.match(barRules[0], /^\.media-field-label::before/, '竖条只挂在字段标签上');
  assert.doesNotMatch(shellCode, /\.media-workbench-group-title[^{]*::before/, '区块总标题不许带竖条');
  /* 视频侧：三种**没有输入**的块不许再用 .media-field-label。 */
  const vcode = code(VJSX);
  const nonOperable = ['panel', 'note', 'tags'];
  for (const kind of nonOperable) {
    const branch = vcode.slice(vcode.indexOf(`block.kind === '${kind}'`));
    const head = branch.slice(0, branch.indexOf('</h3>'));
    assert.ok(head.length > 0, `自证：${kind} 分支找得到`);
    assert.doesNotMatch(head, /media-field-label/, `${kind} 块没有输入，不许带"可操作区"的竖条（用户：真正要加着重号的是每一个用户操作区）`);
    assert.match(head, /video-wb-block-title/, `${kind} 块改用无竖条的标题类`);
  }
  /* 那三类块确实都没有输入控件（这是上面那条判据成立的前提，写死免得后人改声明时 unnoticed）。 */
  for (const maker of ['noteBlock', 'tagsBlock']) {
    const line = VDECL.split('\n').find(l => l.startsWith(`const ${maker} =`));
    assert.ok(line && /kind: '(note|tags)'/.test(line), `自证：${maker} 产出的是只读块`);
  }
  assert.match(VDECL, /const actionBlock = \(\{[\s\S]*?kind: 'panel'/, '自证：actionBlock 产出的是按钮列表块（无输入）');
  assert.match(VSHELL, /\.video-wb-block-title \{[^}]*font-size: 14\.672px/, '无竖条那一类仍与字段标签同字号（只是不声称"可操作"）');
});

test('③ 必填星号全站同色，且声明了 required 的块真能显示出来', () => {
  /* 颜色：图片侧 `.media-field-label b` 已是品牌紫；视频侧原来��红色 danger。 */
  const shellCode = code(SHELL);
  const bRule = shellCode.slice(shellCode.indexOf('.media-field-label b {'));
  assert.match(bRule.slice(0, bRule.indexOf('}')), /color:\s*var\(--sb-brand-600\)/, '图片侧星号 = 品牌紫');
  const vRule = VSHELL.slice(VSHELL.indexOf('.video-wb-required {'));
  assert.match(vRule.slice(0, vRule.indexOf('}')), /color:\s*var\(--sb-brand-600\)/,
    '视频侧星号必须与图片侧**同色**（同一件事两套颜色 = "没搞得很明白"）');
  assert.doesNotMatch(vRule.slice(0, vRule.indexOf('}')), /danger/, '不许再是危险红');
  /* 透传：textBlock 改前把 required 直接丢掉，声明了也不会显示。 */
  const factory = VDECL.slice(VDECL.indexOf('const textBlock ='), VDECL.indexOf('const actionBlock ='));
  assert.match(factory, /required = false/, 'textBlock 必须接住 required');
  assert.match(factory, /emptyHint, required,/, '并且把它放进产出的块里（改前只挑自己认识的键）');
  /* 两处渲染都要读它：chips 那一支本来就读，text 那一支改前没读。 */
  const textBranch = VJSX.slice(VJSX.indexOf("block.kind === 'text'"), VJSX.indexOf("block.kind === 'panel'"));
  assert.match(textBranch, /block\.required && <i className="video-wb-required"/, 'text 块也要渲染必填星号');
});

test('④ 自证：把总标题改回 800 必须被判红（否则 ① 是空转）', () => {
  const broken = SHELL.replace('font-weight: 500;\n  color: var(--sb-ink-3);', 'font-weight: 800;\n  color: var(--sb-ink-3);');
  assert.notEqual(broken, SHELL, '替换没生效，这条自证无效');
  const groupTitle = broken.slice(broken.indexOf('.media-workbench-group-title {'), broken.indexOf('}', broken.indexOf('.media-workbench-group-title {')));
  const gWeight = Number((groupTitle.match(/font-weight:\s*(\d+)/) || [])[1]);
  assert.ok(!(gWeight < 800), '换成 800 竟然没被判红 ⇒ ① 是空转');
});
