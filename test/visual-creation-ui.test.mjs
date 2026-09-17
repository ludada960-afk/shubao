import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { stripComments } from '../scripts/lib/token-scope.mjs';

const source = readFileSync(new URL('../src/pages/Home/VisualCreationMode.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/pages/Home/VisualCreationMode.css', import.meta.url), 'utf8');
const model = readFileSync(new URL('../src/pages/Home/visualCreationModel.js', import.meta.url), 'utf8');
/* 案例预览的**新家**：首页精选 skill 的悬停窗（批注 #2-② 把案例台从首页删掉，
   那份「左介绍 + 右案例」的版式搬到了这里）。所以这个门禁要跨两个文件看。 */
const skillRow = readFileSync(new URL('../src/components/media/SkillEntryRow.jsx', import.meta.url), 'utf8');
const home = readFileSync(new URL('../src/pages/Home/index.jsx', import.meta.url), 'utf8');
/* ⚠️ 「某个类名必须没了」这类断言一律在**剥掉注释**的样式上做：
   本文件按仓储习惯会把"为什么删掉它"写成注释留在原处，带注释匹配会把解释本身当成命中。 */
const stylesCode = stripComments(styles);

/* ═══ 2026-09-19 批 G（用户批注 #2-② / #5-① / #6 / #7）判据更新说明 ═══════════════
   本轮用户把首页图片生成这一块**重新定义**了两次，判据跟着走，不是为了让测试变绿而回退 UI：

   ① 「首页这两块视频生成和图片生成的地方，它就只能是这种上传区和输入区，
       不要有这种预览的地方，预览的地方必须在他们下面的那些按钮里面做预览。」
      → 案例台（.visual-skill-stage / .visual-showcase-controls / .visual-ability-rail /
        .visual-layout-*）整块从首页删除，连样式一起（96 条规则）；
        随之而去的还有它专属的"自动轮播 / 手动停留 / 灯箱看案例"三件套。
        原判据守的正是这三件套 —— 继续守它们等于逼着下一轮把案例台加回来。

   ② 「图片生成这里只要两个面板就可以了，一个是选模型的面板，另一个就是把这些尺寸啊、
       数量啊、清晰度啊集合到同一个面板里面的就可以了。」
      → 触发条从四档（模型/尺寸/数量/配方）收敛到**两颗**：生图模型 + 画面规格；
        原判据按四档顺序断言，现按两颗断言，并额外守住"一屏铺开"的新面板。

   ③ 结果灯箱是**留下的**、而且是**接通了的**：案例台删掉后 previewItem 一度没有生产者，
      于是把结果图接上（点图放大 / Escape 关 / 左右键翻）—— 删的是"看案例"，不是"看清结果"。 */

test('visual creation is a complete conversation-style image workbench', () => {
  assert.match(source, /VISUAL_CREATION_SKILLS/);
  assert.match(source, /uploadEcommerceAssets/);
  assert.match(source, /regenerateCanvasImage/);
  assert.match(source, /includeMetadata:\s*true/);
  assert.match(source, /taskId:\s*result\.taskId/);
  assert.match(source, /visualGenerationEstimate/);
  assert.match(source, /saveWork/);
  assert.match(source, /buildVisualCanvasResult/);
  /* 9-12 用户批注：文案照小红书语义改为「我的素材 + 风格参考」，格式提示仍在；
     9-13 三轮批注：上限按小红书位置（@引用行）与措辞（计数+格式），不再有自造提示句 */
  assert.match(source, /我的素材/);
  assert.match(source, /JPG\/PNG\/WebP/);
  /* ⚠️ 2026-09-19 批 H（用户批注 #3）：「这一句不要放啊……素材和风格图你完全不用说有多少张呀？」
     —— 「我的素材 n/30 · 风格参考 n/12 · JPG/PNG/WebP」整行**已删除**，判据随之反转：
     界面上不许再出现“素材/风格参考 + 计数 + 斜杠 + 上限”这行。 */
  assert.doesNotMatch(source, /我的素材 \{materials\.length\}\//);
  assert.doesNotMatch(source, /风格参考 \{styles\.length\}\//);
  assert.doesNotMatch(source, /JPG\/PNG\/WebP\}<\/span>/);
  /* 反向守住"别把格式与上限也一起删没了"：accept 仍然限制格式，上限仍在声明里 */
  assert.match(source, /ACCEPTED_IMAGE_TYPES/);
  assert.match(source, /const MAX_REFERENCES = \d+;/, '上传口上限必须仍然存在（只是不再上屏）');
  /* 9-13：提示词引导按子页面走 selectedSkill.promptHint（缺省回落到通用文案） */
  assert.match(source, /selectedSkill\.promptHint/);
  assert.match(source, /只重试失败项/);
  assert.match(source, /进入画布/);
  assert.match(source, /下载/);
  assert.match(source, /creationIntent:\s*'visual'/);
  /* ⚠️ 2026-09-19：标题从「自由创作，做出可继续编辑的视觉」改成「把一句话变成能用的图」——
     用户批注 #5-② 原话：「我们现在不能再给之前的那几个页面，就是电商生成、小红书图文、自由创作，
     他们单独做一个首页的入口了。他们现在只有高度定制的子页面。」
     首页这一块是**图片生成**这件事本身，所以标题写板块能力，不写"自由创作"这个技能名。 */
  assert.match(source, /把一句话变成能用的图/);
  assert.doesNotMatch(source, /自由创作，做出可继续编辑的视觉/);
  /* 9-13 更新预期：照小红书那套 —— ImageMentionPicker(insert) + 无边框 textarea */
  assert.match(source, /ImageMentionPicker/);
  assert.match(source, /xhs-prompt-field/);
  assert.match(source, /insertMentionInTextarea/);
  assert.match(model, /productionCaseById/);

  /* ── 判据 ①：首页不得再有案例台（正面断言"没有"，见文件头说明） ───────────────── */
  assert.doesNotMatch(source, /visual-skill-stage|visual-showcase-controls|visual-ability-rail/);
  assert.doesNotMatch(stylesCode, /\.visual-skill-stage|\.visual-showcase-controls|\.visual-ability-rail|\.visual-layout-/);
  assert.doesNotMatch(stylesCode, /--visual-showcase-height/);
  /* 案例**数据**没删（深链子页面还按 skill 取案例图），删的是首页那份展示位 */
  assert.match(model, /showcases: visualShowcases/);

  /* ── 判据 ①（续）：案例预览搬进精选 skill 的悬停窗，且首页确实把案例喂给了它 ───── */
  assert.match(skillRow, /skill-entry-button/);
  assert.match(skillRow, /skill-preview/);
  assert.match(skillRow, /CLOSE_DELAY_MS/);
  assert.match(home, /previewAssets/);
  assert.match(home, /skill\.cases/);

  /* ── 判据 ③：结果灯箱是活的（有生产者、有键盘路径），不是删剩的空壳 ───────────── */
  assert.match(source, /openResultPreview/);
  assert.match(source, /stepPreview/);
  assert.match(source, /visual-result-zoom/);
  assert.match(source, /visual-preview-dialog/);
  assert.match(source, /visual-preview-previous/);
  assert.match(source, /visual-preview-next/);
  assert.match(source, /ArrowLeft/);
  assert.match(source, /ArrowRight/);
  assert.match(source, /setPreviewItem\(null\);/);
  assert.match(source, /setRatio\(visualSkillDefaultRatio\(skillId\)\)/, '切子页面按板块默认画幅重置');

  /* ── 判据 ②：配置条只剩**两颗**触发，且顺序 = 模型 → 规格 ─────────────────────── */
  assert.match(source, /visual-config-trigger/);
  assert.match(source, /visual-config-panel/);
  assert.match(source, /VisualSpecsPanel/);
  assert.match(source, /分辨率/);
  assert.match(source, /画面尺寸/);
  assert.match(source, /生成数量/);
  /* 分辨率 / 尺寸 / 数量必须落在**同一个** VisualSpecsPanel 里（用户要的是"一屏配好"） */
  /* ⚠️ 一律在**剥掉注释**的源码上比："为什么删掉生成数量"这段解释本身就会写到那四个字，
     带注释比会让这条断言靠注释通过（等于没测）。 */
  const sourceCode = stripComments(source);
  const specs = sourceCode.slice(sourceCode.indexOf('function VisualSpecsPanel'), sourceCode.indexOf('function getVisualPanelPosition'));
  for (const text of ['分辨率', '画面尺寸']) {
    assert.ok(specs.includes(text), `「${text}」必须在同一个画面规格面板里，而不是各自一个面板`);
  }
  /* ⚠️ 2026-09-19 批 H（用户批注 #1）：「这个生成数量我觉得也不应该有，就是默认一张，
     因为其他家也是这么做的。」—— 数量选择器整块删除（判据反转）。 */
  assert.doesNotMatch(sourceCode, /生成数量/);
  assert.doesNotMatch(sourceCode, /visual-count-grid|visual-count-card|VisualCountPanel/);
  assert.doesNotMatch(stylesCode, /\.visual-count-grid|\.visual-count-card/);
  assert.doesNotMatch(source, /VisualSizePanel|VisualCountPanel/);
  const bar = source.slice(source.indexOf('aria-label="生成配置"'), source.indexOf('visual-generate-button'));
  /* 数的是**按钮实例**（className={`visual-config-trigger…）而不是裸类名 ——
     每颗按钮里还有一个 .visual-config-trigger-copy 子元素，按裸类名数会翻倍。 */
  const triggers = bar.match(/className=\{\s*`visual-config-trigger/g) || [];
  assert.equal(triggers.length, 2, '配置条只该有两颗触发按钮：生图模型 + 画面规格');
  const order = ['生图模型', '画面规格'].map(text => bar.indexOf(text));
  assert.ok(order.every(index => index >= 0), '两颗触发都必须出现在配置条里');
  assert.deepEqual(order, [...order].sort((a, b) => a - b), '配置条顺序必须是 模型 → 规格');
  assert.doesNotMatch(source, /visual-panel-section-heading[^]*?<strong>画面规格<\/strong>/);

  assert.match(source, /VisualRecipePanel/);
  assert.match(source, /optionMeta/);
  assert.match(source, /visual-style-option-image/);
  assert.match(source, /createPortal/);
  assert.match(source, /id="visual-floating-panel"/);
  assert.match(source, /configButtonRefs/);
  assert.match(source, /repositionConfigPanel/);
  assert.match(source, /getVisualPanelPosition/);
  assert.match(source, /GenSettingsPanel/);
  assert.match(source, /canGenerate/);
  assert.match(source, /disabled=\{!canGenerate \|\| busy\}/);
  assert.match(source, /recoveryCheckpoint/);
  assert.doesNotMatch(source, /className="visual-skill-preview"/);
  assert.doesNotMatch(source, /className="visual-skill-facts"/);
  assert.doesNotMatch(source, /<b>保留<\/b>|<b>适合<\/b>|<b>结果<\/b>/);
  /* ⚠️ 2026-09-18 批 C 把这条断言**反向**了（不是为了让测试过而回退 UI）：
     用户批注 6 要求首页去掉四个模式卡（自由创作 / 海报设计 / 社媒封面 / 品牌主视觉），
     它们已是独立 skill（左侧导航 + 总页面直达）。旧断言 .visual-skill-grid 守的是
     **已被产品决定删掉的**那份入口 —— 继续守它等于逼着下一轮把卡片加回来。 */
  assert.doesNotMatch(source, /visual-skill-option|visual-skill-grid|VISUAL_SKILL_ICONS/);
  assert.doesNotMatch(stylesCode, /\.visual-skill-option|\.visual-skill-grid/);
  /* 卡片标签仍然是「我的素材 N / 风格参考 N」（那是每张图自己的名字，不是汇总行） */
  assert.match(source, /label=\{`我的素材 \$\{index \+ 1\}`\}/);
  assert.match(source, /label=\{`风格参考 \$\{index \+ 1\}`\}/);

  /* ═══ 样式契约 ═══════════════════════════════════════════════════════════════ */
  assert.match(styles, /width:\s*min\(1240px,\s*100%\)/);
  assert.match(styles, /padding:\s*clamp\(/);
  assert.match(styles, /\.visual-creation-composer/);
  assert.match(styles, /\.visual-choice-card/);
  assert.match(styles, /\.visual-ratio-card/);
  assert.match(styles, /\.visual-panel-note/);
  /* 一屏看全是本轮的硬要求（批注 #2-③）：「哪怕用户上传完素材，他也得一屏能看完信息」 */
  assert.match(styles, /\.visual-spec-row/);
  assert.match(styles, /\.visual-spec-chip/);
  assert.match(styles, /\.visual-config-trigger/);
  assert.match(styles, /\.visual-config-panel/);
  assert.match(styles, /\.visual-result-zoom(?![\w-])/);
  /* 结果图放大入口是**按钮**，可点必有 hover（门禁 interactive-state-coverage 同款口径） */
  assert.match(styles, /\.visual-result-zoom:hover/);
  assert.doesNotMatch(styles, /width:\s*200%/);
  assert.doesNotMatch(styles, /margin-left:\s*-100%/);
  assert.match(styles, /@media \(max-width: 640px\)/);
  /* 案例台删掉时，挂在"自动轮播"上的 prefers-reduced-motion 判断一起没了 ——
     本板块自己还有 4 处过渡 + 2 个关键帧，这一条**必须**补回来（见 CSS 内注释）。 */
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});
