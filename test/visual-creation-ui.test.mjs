import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { stripComments } from '../scripts/lib/token-scope.mjs';

const source = readFileSync(new URL('../src/pages/Home/VisualCreationMode.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/pages/Home/VisualCreationMode.css', import.meta.url), 'utf8');
const model = readFileSync(new URL('../src/pages/Home/visualCreationModel.js', import.meta.url), 'utf8');
/* ⚠️ 「某个类名必须没了」这类断言一律在**剥掉注释**的样式上做：
   本文件按仓储习惯会把"为什么删掉它"写成注释留在原处，带注释匹配会把解释本身当成命中。 */
const stylesCode = stripComments(styles);

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
  assert.match(source, /我的素材 \{materials\.length\}\/\{MAX_REFERENCES\}/);
  assert.match(source, /风格参考 \{styles\.length\}\/\{MAX_STYLE_REFERENCES\}/);
  /* 9-13：提示词引导按子页面走 selectedSkill.promptHint（缺省回落到通用文案） */
  assert.match(source, /selectedSkill\.promptHint/);
  assert.match(source, /只重试失败项/);
  assert.match(source, /进入画布/);
  assert.match(source, /下载/);
  assert.match(source, /creationIntent:\s*'visual'/);
  assert.match(source, /自由创作，做出可继续编辑的视觉/);
  assert.match(source, /VISUAL_SHOWCASE_AUTO_DWELL_MS/);
  assert.match(source, /VISUAL_SHOWCASE_MANUAL_DWELL_MS/);
  /* 9-13 更新预期：照小红书那套 —— ImageMentionPicker(insert) + 无边框 textarea */
  assert.match(source, /ImageMentionPicker/);
  assert.match(source, /xhs-prompt-field/);
  assert.match(source, /insertMentionInTextarea/);
  assert.match(source, /visual-showcase-controls/);
  assert.match(source, /visual-skill-stage-card/);
  assert.match(source, /selectedSkill\.showcases/);
  assert.match(model, /productionCaseById/);
  assert.match(source, /visual-preview-dialog/);
  assert.match(source, /visual-preview-previous/);
  assert.match(source, /visual-preview-next/);
  assert.match(source, /ArrowLeft/);
  assert.match(source, /ArrowRight/);
  assert.match(source, /setPreviewItem\(null\);/);
  assert.match(source, /setRatio\(visualSkillDefaultRatio\(skillId\)\)/, '切子页面按板块默认画幅重置');
  assert.match(source, /visual-ability-rail/);
  assert.match(source, /selectedSkill\.preserves/);
  assert.match(source, /selectedSkill\.outcome/);
  assert.match(source, /selectedSkill\.bestFor/);
  assert.match(source, /selectedShowcase\?\.assets/);
  assert.match(source, /showcaseLoadingPolicy/);
  assert.match(source, /fetchPriority=\{showcaseLoadingPolicy/);
  assert.match(source, /loading=\{showcaseLoadingPolicy/);
  assert.match(source, /visual-config-trigger/);
  assert.match(source, /visual-config-panel/);
  assert.match(source, /创作配方/);
  assert.match(source, /生成设置/);
  assert.match(source, /createPortal/);
  assert.match(source, /id="visual-floating-panel"/);
  assert.match(source, /configButtonRefs/);
  assert.match(source, /repositionConfigPanel/);
  assert.match(source, /getVisualPanelPosition/);
  assert.match(source, /GenSettingsPanel/);
  assert.match(source, /VisualRecipePanel/);
  assert.match(source, /optionMeta/);
  assert.match(source, /visual-style-option-image/);
  assert.match(source, /visualGenerationEstimate/);
  assert.match(source, /canGenerate/);
  assert.match(source, /disabled=\{!canGenerate \|\| busy\}/);
  /* ⚠️ 2026-09-18 批 C（用户批注 12）：配置顺序 = 模型 → 分辨率 → 尺寸 → 数量。
     旧断言守的是"画面规格"这个把尺寸与数量合在一起的面板；现在拆成两块，
     顺序由**触发条的先后**表达（用户看的就是这条）。这里按触发条的实际次序断言，
     不是按它们在文件里出现的次序 —— 所以先取出工具条那一段再比位置。 */
  assert.match(source, /VisualSizePanel/);
  assert.match(source, /VisualCountPanel/);
  assert.match(source, /画面尺寸/);
  assert.match(source, /生成数量/);
  const bar = source.slice(source.indexOf('aria-label="生成配置"'), source.indexOf('visual-generate-button'));
  const order = ['生成设置', '画面尺寸', '生成数量', '创作配方'].map(text => bar.indexOf(text));
  assert.ok(order.every(index => index >= 0), '四档配置都必须出现在配置条里');
  assert.deepEqual(order, [...order].sort((a, b) => a - b), '配置条顺序必须是 模型/分辨率 → 尺寸 → 数量 → 配方');
  assert.doesNotMatch(source, /visual-panel-section-heading[^]*?<strong>画面规格<\/strong>/);
  assert.match(styles, /\.visual-choice-card/);
  assert.match(styles, /\.visual-ratio-card/);
  assert.match(styles, /\.visual-panel-note/);
  assert.match(source, /recoveryCheckpoint/);
  assert.doesNotMatch(source, /className="visual-skill-preview"/);
  assert.doesNotMatch(source, /className="visual-skill-facts"/);
  assert.doesNotMatch(source, /<b>保留<\/b>|<b>适合<\/b>|<b>结果<\/b>/);
  /* ⚠️ 2026-09-18 批 C 把这条断言**反向**了（不是为了让测试过而回退 UI）：
     用户批注 6 要求首页去掉四个模式卡（自由创作 / 海报设计 / 社媒封面 / 品牌主视觉），
     它们已是独立 skill（左侧导航 + 总页面直达）。旧断言 .visual-skill-grid 守的是
     **已被产品决定删掉的**那份入口 —— 继续守它等于逼着下一轮把卡片加回来。
     现在守的是新契约本身：首页不得再出现模式卡，且必须给得出"两张卡 + 输入框 + 配置"。 */
  assert.doesNotMatch(source, /visual-skill-option|visual-skill-grid|VISUAL_SKILL_ICONS/);
  assert.doesNotMatch(stylesCode, /\.visual-skill-option|\.visual-skill-grid/);
  assert.match(source, /我的素材 \{materials\.length\}/);
  assert.match(source, /风格参考 \{styles\.length\}/);
  assert.match(styles, /width:\s*min\(1240px,\s*100%\)/);
  assert.match(styles, /\.visual-skill-stage/);
  assert.match(styles, /--visual-showcase-height:/);
  assert.match(styles, /height:\s*var\(--visual-showcase-height\)/);
  assert.match(styles, /padding:\s*clamp\(/);
  assert.match(styles, /\.visual-skill-stage-card/);
  assert.match(styles, /\.visual-showcase-controls/);
  assert.match(styles, /\.visual-layout-platform-fan\.is-alternate/);
  assert.match(styles, /\.visual-layout-platform-fan \.visual-skill-stage-outputs\.is-chapter\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*minmax\(0,\s*1\.45fr\)\s*minmax\(0,\s*1fr\)[^}]*grid-template-rows:\s*1fr/);
  assert.match(styles, /\.visual-layout-platform-fan \.visual-skill-stage-outputs\.is-chapter \.output-0\s*\{[^}]*rotate\(-4deg\)/);
  assert.match(styles, /\.visual-layout-platform-fan \.visual-skill-stage-outputs\.is-chapter \.output-2\s*\{[^}]*rotate\(4deg\)/);
  assert.match(styles, /\.visual-layout-platform-fan \.visual-skill-stage-outputs\.is-chapter \.output-0,[\s\S]*?\.output-2\s*\{[^}]*width:\s*165px[^}]*height:\s*220px/);
  assert.match(styles, /\.visual-layout-platform-fan\.is-alternate \.visual-skill-stage-outputs\.is-chapter \.output-0\s*\{[^}]*grid-column:\s*1/);
  assert.match(styles, /\.visual-layout-platform-fan\.is-alternate \.visual-skill-stage-outputs\.is-chapter \.output-2\s*\{[^}]*grid-column:\s*3/);
  assert.match(styles, /\.visual-ability-rail/);
  assert.match(styles, /\.visual-creation-composer/);
  assert.match(styles, /\.visual-config-trigger/);
  assert.match(styles, /\.visual-config-panel/);
  assert.doesNotMatch(styles, /width:\s*200%/);
  assert.doesNotMatch(styles, /margin-left:\s*-100%/);
  assert.match(styles, /@media \(max-width: 640px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});