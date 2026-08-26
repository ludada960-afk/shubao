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

test('profile rail renders as a floating overlay drawer that never squeezes the workbench', () => {
  // 基准：WeShop 工作台左缘滑出抽屉——覆盖而非挤压；唯一入口是「当前商品」chip，
  // 左缘竖排入口钮已废除（贴边 x≈0 无法命中）。
  assert.match(css, /\.ec-profile-rail\s*\{[^}]*position:\s*fixed/);
  assert.match(css, /\.ec-profile-rail\s*\{[^}]*width:\s*min\(340px,\s*88vw\)/);
  assert.match(rail, /ec-profile-rail-scrim/);
  assert.match(rail, /aria-label="关闭商品档案抽屉"/);
  assert.match(rail, /event\.key === 'Escape'/);
  // 层级契约：抽屉必须 Portal 到 body。若留在 .surface-card(z-index:4) 子树内，
  // fixed z-1300 被祖先层叠上下文封顶，会被 app-side-nav(z-200) 等页面浮层盖住
  // （浏览器 elementFromPoint 实证）。Portal 后高于页面浮层、低于全局模态。
  assert.match(rail, /createPortal\(rail, document\.body\)/);
  assert.doesNotMatch(css, /z-index:\s*(?:1[4-9]\d{3}|[2-9]\d{3,})/); // 不靠堆更高数字硬压全局模态
  assert.match(css, /\.ec-profile-rail\s*\{[^}]*z-index:\s*1300;/);
  assert.match(ecMode, /setProductProfilesOpen\] = useState\(false\)/);
  assert.doesNotMatch(css, /\.ec-profile-rail\.is-collapsed/);
  // 入口唯一性：组件与样式层面都不再存在任何独立入口钮。
  assert.doesNotMatch(rail, /ec-profile-rail-expand/);
  assert.doesNotMatch(css, /ec-profile-rail-expand/);
  assert.match(css, /@media \(max-width: 1100px\)[\s\S]*\.ec-profile-rail\s*\{[\s\S]*?min\(320px,\s*86vw\)/);
});

test('drawer z-index sits between page overlays and global modals (site-wide audit)', () => {
  // 2026-08-26 全站浮层 z-index 审计结论（src 全量 grep 定值依据）：
  //   页面内浮层 ≤1200 —— surface-card 4、creative-nav 120、app-side-nav 200、
  //   ContentResultWorkspace 900、VisualCreationMode 弹层 1104、VideoStudio 面板 1200；
  //   全局模态 ≥1500 —— VideoStudio 导出弹层 1500、tryon 预览 1800、
  //   app-shell 提示/命令 2200 与 3200、NoteModal 9998、图库 lightbox 9999+。
  // 商品档案抽屉定值 1300：高于一切页面浮层，低于一切全局模态；
  // scrim 用 z-index:-1 留在抽屉自身的 1300 层叠上下文内，不参与全局竞争。
  const values = [...css.matchAll(/z-index:\s*(-?\d+)/g)].map(m => Number(m[1]));
  assert.deepStrictEqual(values.sort((a, b) => b - a), [1300, -1]);
});

test('bottom generation settings bar keeps a persistent current-product chip with selector', () => {
  assert.match(ecMode, /<ProductChip[\s\S]*?profile=\{activeProductProfile\}/);
  assert.match(ecMode, /onSelect=\{selectActiveProductProfile\}/);
  assert.match(chip, /data-testid="ec-current-product-chip"/);
  assert.match(chip, /当前商品/);
  // 入口收敛：chip 不再自带选择器弹层，点击直接呼出档案抽屉（唯一入口）。
  assert.doesNotMatch(chip, /createPortal/);
  assert.doesNotMatch(chip, /role="listbox"/);
  assert.match(chip, /aria-haspopup="dialog"/);
  assert.match(ecMode, /onOpen=\{openProfileDrawer\}/);
  assert.match(css, /\.ec-product-chip \{/);
  // chip 视觉规格并入邻近按钮体系：复用 .ec-config-trigger token（尺寸/圆角/hover/展开态），
  // 行内 flex 布局由 .ec-product-chip 自身补齐（邻近按钮的 flex 来自 BTN_BASE 内联样式）。
  assert.match(chip, /ec-config-trigger ec-product-chip/);
  assert.match(chip, /profile \? ' is-adjusted' : ''/);
  assert.match(css, /\.ec-product-chip \{[^}]*display:\s*inline-flex/);
  assert.match(css, /\.ec-product-chip \{[^}]*align-items:\s*center/);
  assert.doesNotMatch(css, /border-radius:\s*19px/);
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
