import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workbench = readFileSync(new URL('../src/pages/Home/ec/EcommerceWorkbench.jsx', import.meta.url), 'utf8');
const ecMode = readFileSync(new URL('../src/pages/Home/EcMode.jsx', import.meta.url), 'utf8');
const direction = readFileSync(new URL('../src/pages/Home/ec/DesignDirection.jsx', import.meta.url), 'utf8');
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
