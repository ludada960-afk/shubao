import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workbench = readFileSync(new URL('../src/pages/Home/ec/EcommerceWorkbench.jsx', import.meta.url), 'utf8');
const ecMode = readFileSync(new URL('../src/pages/Home/EcMode.jsx', import.meta.url), 'utf8');
const direction = readFileSync(new URL('../src/pages/Home/ec/DesignDirection.jsx', import.meta.url), 'utf8');
const paramsPanel = readFileSync(new URL('../src/pages/Home/ec/ParamsPanel.jsx', import.meta.url), 'utf8');
const catalog = readFileSync(new URL('../src/pages/Home/productionCaseCatalog.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/pages/Home/Home.css', import.meta.url), 'utf8');

test('default ecommerce workbench preserves the established product-reference framework', () => {
  assert.match(workbench, /buildUploadDeck/);
  assert.match(workbench, /nextProductSlot/);
  assert.match(workbench, /ec-xhs-media-strip/);
  assert.match(workbench, /role="product"/);
  assert.match(workbench, /ec-xhs-multiply/);
  assert.match(workbench, /role="reference"/);
  assert.match(workbench, /上传商品素材，生成整套电商视觉/);
  assert.doesNotMatch(workbench, /ec-ability-rail/);
  assert.doesNotMatch(workbench, /ec-ability-example-flow/);
  assert.doesNotMatch(workbench, /ec-ability-slot-grid/);
});

test('try-on is exposed as an explicit ability layer while the default product rail remains intact', () => {
  assert.match(workbench, /anything_tryon/);
  assert.match(workbench, /ProductSuiteShowcase/);
  assert.match(workbench, /productionCaseById\('product-suite'\)/);
  assert.match(workbench, /ec-ability-selector/);
  assert.match(workbench, /ec-tryon-showcase/);
  assert.match(workbench, /personMode === 'reference'/);
  assert.doesNotMatch(workbench, /buildAbilityUploadDeck/);
  assert.match(ecMode, /anything_tryon/);
  assert.match(ecMode, /roleImages\.items/);
  assert.match(ecMode, /roleImages\.person/);
  assert.match(ecMode, /roleImages\.scene/);
  assert.match(direction, /showAbilitySelector=\{false\}/);
});

test('try-on showcase uses deliberate dwell and a keyboard-accessible gallery', () => {
  assert.match(workbench, /TRYON_AUTO_DWELL_MS/);
  assert.match(workbench, /TRYON_MANUAL_DWELL_MS/);
  assert.match(workbench, /ec-tryon-preview-modal/);
  assert.match(workbench, /ec-tryon-showcase-card/);
  assert.match(workbench, /ArrowLeft/);
  assert.match(workbench, /ArrowRight/);
  assert.match(workbench, /event\.key === 'ArrowLeft'/);
  assert.match(workbench, /event\.key === 'ArrowRight'/);
  assert.match(workbench, /ec-tryon-preview-previous/);
  assert.match(workbench, /ec-tryon-preview-next/);
});

test('try-on showcase renders complete zoomable workflow banners without re-cropping portrait sources', () => {
  assert.match(workbench, /productionCaseById\('tryon-angles'\)/);
  assert.match(workbench, /productionCaseById\('tryon-reference'\)/);
  assert.match(workbench, /displayRole === 'workflowBanner'/);
  assert.match(workbench, /ec-tryon-workflow-banner/);
  assert.doesNotMatch(workbench, /--tryon-image|sourcePosition|referencePosition/);
  assert.match(styles, /\.ec-tryon-workflow-banner\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*9/);
  assert.match(styles, /\.ec-tryon-workflow-banner img\s*\{[^}]*object-fit:\s*contain/);
});

test('try-on showcase gives every rendered asset a stable React key', () => {
  assert.match(workbench, /key=\{item\.id \|\| item\.src\}/);
});

test('product suite showcase uses a real premium earbuds production workflow', () => {
  assert.match(catalog, /earbuds-suite/);
  assert.doesNotMatch(catalog, /cobalt-lamp/);
  assert.doesNotMatch(catalog, /curated-showcase/);
  assert.match(workbench, /productionCaseById\('product-suite'\)/);
  assert.match(workbench, /displayRole === 'finalComposite'/);
  assert.match(workbench, /ec-product-suite-final/);
  assert.doesNotMatch(workbench, /className="ec-product-suite-source"/);
  assert.doesNotMatch(workbench, /className="ec-product-suite-results"/);
  assert.match(styles, /\.ec-product-suite-showcase/);
  assert.match(styles, /\.ec-product-suite-final\s*\{[^}]*width:\s*min\(720px,\s*100%\)[^}]*aspect-ratio:\s*4\s*\/\s*3/);
});

test('ability selector uses three rich product previews and one wide try-on fan', () => {
  assert.match(workbench, /AbilitySelectorFan/);
  assert.match(workbench, /ec-ability-selector-fan/);
  assert.match(workbench, /displayRole === 'selectorPreview'/);
  assert.match(workbench, /asset\.selectorPreview === true/);
  assert.match(workbench, /assets\.length === 1 \? 'is-single' : ''/);
  assert.doesNotMatch(workbench, /ability-product-suite-wide\.webp|ability-tryon-wide\.webp/);
  assert.match(styles, /\.ec-ability-selector-option\s*\{[^}]*min-height:\s*58px/);
  assert.match(styles, /\.ec-ability-selector-fan\.is-single/);
});

test('ecommerce showcases use one continuous surface without nested panel backgrounds', () => {
  assert.match(styles, /--ec-showcase-surface:/);
  assert.match(styles, /\.ec-product-suite-showcase-copy,\s*\.ec-product-suite-showcase-visual,\s*\.ec-tryon-showcase-copy,\s*\.ec-tryon-showcase-visual\s*\{[^}]*background:\s*transparent/);
});

test('ability switch presents concise user outcomes instead of internal implementation notes', () => {
  assert.match(workbench, /生成整套主图与详情视觉/);
  assert.match(workbench, /把商品自然穿到模特身上/);
  assert.doesNotMatch(workbench, /能力配方/);
  assert.doesNotMatch(workbench, /默认商品套图保持原有流程/);
  assert.doesNotMatch(workbench, /专用能力只改变输入角色和生成目标/);
  assert.doesNotMatch(workbench, /产品图 × 参考图/);
});

test('try-on uses a focused four-panel configuration instead of inheriting SKU and copywriting controls', () => {
  assert.match(ecMode, /abilityRecipeId === 'anything_tryon'/);
  assert.match(ecMode, /label: '成片规格'/);
  assert.match(ecMode, /label: '商品细节'/);
  assert.match(ecMode, /TryOnPlanPanel/);
});

test('try-on preservation principles are mandatory advantages instead of opt-out controls', () => {
  assert.match(paramsPanel, /preserveMaterial/);
  assert.match(paramsPanel, /preservePattern/);
  assert.match(paramsPanel, /consistentPersonScene/);
  assert.match(paramsPanel, /ec-tryon-principles/);
  assert.match(paramsPanel, /ec-tryon-principle-index/);
  assert.match(paramsPanel, /锁定材质纹理/);
  assert.match(paramsPanel, /锁定图案与标识/);
  assert.match(paramsPanel, /保持人物与场景/);
  assert.doesNotMatch(paramsPanel, /type="checkbox"/);
  assert.doesNotMatch(paramsPanel, /activeHelp/);
  assert.doesNotMatch(ecMode, /preserveMaterial\s*\|\s*preservePattern/);
});

test('EcMode carries recipe and role assets through the step boundary', () => {
  assert.match(ecMode, /abilityRecipe/);
  assert.match(ecMode, /roleImages/);
  assert.match(ecMode, /switchAbilityRecipe/);
  assert.match(ecMode, /personMode/);
});

test('direction confirmation preserves try-on role lanes into analysis, generation, and Canvas', () => {
  assert.match(direction, /extraPersonImages/);
  assert.match(direction, /abilityRecipe/);
  assert.match(direction, /roleAssets/);
  assert.match(direction, /personMode/);
  assert.match(direction, /personAssets/);
  assert.match(direction, /sceneAssets/);
  assert.match(direction, /sceneShots/);
});

test('established ecommerce media strip keeps its responsive contract', () => {
  assert.match(styles, /\.ec-xhs-media-strip/);
  assert.match(styles, /\.ec-xhs-upload-card/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.ec-xhs/);
});
