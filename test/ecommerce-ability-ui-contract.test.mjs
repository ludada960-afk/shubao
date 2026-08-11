import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workbench = readFileSync(new URL('../src/pages/Home/ec/EcommerceWorkbench.jsx', import.meta.url), 'utf8');
const ecMode = readFileSync(new URL('../src/pages/Home/EcMode.jsx', import.meta.url), 'utf8');
const direction = readFileSync(new URL('../src/pages/Home/ec/DesignDirection.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/pages/Home/Home.css', import.meta.url), 'utf8');

test('ecommerce workbench renders a shared ability recipe rail with effect language', () => {
  assert.match(workbench, /ECOMMERCE_ABILITY_RECIPES|EcommerceAbilityRecipe/);
  assert.match(workbench, /保留/);
  assert.match(workbench, /结果/);
  assert.match(workbench, /适合/);
  assert.match(workbench, /aria-selected/);
  assert.match(workbench, /anything_tryon/);
  assert.match(workbench, /ec-ability-example-flow/);
  assert.match(workbench, /inputAssetUrls/);
  assert.match(workbench, /outputAssetUrls/);
  assert.match(workbench, /上传素材/);
  assert.match(workbench, /生成效果/);
});

test('try-on workbench swaps to semantic item, person, and scene slots and has one upload surface per slot', () => {
  assert.match(workbench, /buildAbilityUploadDeck/);
  assert.match(workbench, /roleImages/);
  assert.match(workbench, /items/);
  assert.match(workbench, /person/);
  assert.match(workbench, /scene/);
  assert.match(workbench, /智能模特/);
  assert.match(workbench, /参考模特图/);
  assert.match(workbench, /待整理素材/);
  assert.doesNotMatch(workbench, /ec-workbench-bottom-upload/);
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

test('recipe rail and role slots have responsive and reduced-motion contracts', () => {
  assert.match(styles, /\.ec-ability-rail/);
  assert.match(styles, /\.ec-ability-slot/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.ec-ability/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.ec-ability-rail/);
});
