import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// 商品档案体系源码契约：左侧栏 tab 化(列表+详情素材聚合)、底部当前商品 chip、
// 动词排只留上传动作、生成后自动归档联动。
const ecMode = await readFile(new URL('../src/pages/Home/EcMode.jsx', import.meta.url), 'utf8');
const rail = await readFile(new URL('../src/pages/Home/ec/EcProfileRail.jsx', import.meta.url), 'utf8');
const chip = await readFile(new URL('../src/pages/Home/ec/ProductChip.jsx', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/pages/Home/ec/EcProfileRail.css', import.meta.url), 'utf8');
const workbench = await readFile(new URL('../src/pages/Home/ec/EcommerceWorkbench.jsx', import.meta.url), 'utf8');
const direction = await readFile(new URL('../src/pages/Home/ec/DesignDirection.jsx', import.meta.url), 'utf8');

test('ecommerce suite page hosts the tabbed profile rail instead of the mixed-in shelf', () => {
  assert.match(ecMode, /<EcProfileRail/);
  assert.doesNotMatch(ecMode, /<ProductProfileShelf/);
  assert.match(rail, /role="tablist"/);
  assert.match(rail, /aria-label="商品档案列表"/);
  assert.match(rail, /aria-label="商品档案详情"/);
  // 详情聚合展示该商品下所有素材（按角色分组）
  assert.match(rail, /PROFILE_MEDIA_GROUPS/);
  assert.match(rail, /素材聚合/);
  assert.match(rail, /ec-profile-media-group/);
});

test('bottom generation settings bar keeps a persistent current-product chip with selector', () => {
  assert.match(ecMode, /<ProductChip[\s\S]*?profile=\{activeProductProfile\}/);
  assert.match(ecMode, /onSelect=\{selectActiveProductProfile\}/);
  assert.match(chip, /data-testid="ec-current-product-chip"/);
  assert.match(chip, /当前商品/);
  assert.match(chip, /role="listbox"/);
  assert.match(css, /\.ec-product-chip \{/);
});

test('selecting a profile applies globally and fills the product slot from saved media', () => {
  assert.match(ecMode, /const selectActiveProductProfile = async profile => \{/);
  assert.match(ecMode, /setActiveProfileId\(profile\.profileId\)/);
  assert.match(ecMode, /applySavedProductProfile\(profile\)/);
  assert.match(ecMode, /buildProductProfileMediaState/);
  assert.match(ecMode, /activeProductProfileId: activeProfileId,/);
  // 生成完成后新资产自动挂到当前档案（失败不阻断交付）
  assert.match(direction, /attachProductProfileImages\(archiveProfileId, finalDelivery\.imageRecords\)/);
  assert.match(direction, /params\?\.activeProductProfileId/);
});

test('creation verb row keeps upload actions only and drops the library button', () => {
  assert.doesNotMatch(workbench, /从素材库选择/);
  assert.doesNotMatch(workbench, /ProjectAssetPicker/);
  assert.doesNotMatch(workbench, /onPickFromLibrary/);
  assert.match(workbench, /'产品图'/);
  assert.match(workbench, /label="参考图"/);
});
