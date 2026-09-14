// test/home-gen-settings-visual-0915.test.mjs
// 2026-09-15 用户批注（首页生成设置面板 + 内容规范）：
//  ① 色块/取色器外围不能有固定紫色描边；默认态必须是「未锁定」的中性样式
//  ② 「避免出现的元素」不属于「生成设置」→ 迁到「内容规范」；生成设置面板视觉重做
//  ③ 删掉「当前约 1 AI 积分/张」这句说明，积分只在按钮/右下角动态显示
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const panel = read('src/pages/Home/ec/GenSettingsPanel.jsx');
const constraints = read('src/pages/Home/ec/GenerationConstraintsPanel.jsx');
const ecMode = read('src/pages/Home/EcMode.jsx');

/* ═══ ① 取色器：无固定紫色描边 + 默认未锁定 ═══ */

test('① 色块描边跟随所选颜色本身，锁定态不是写死的紫色 #7c3aed', () => {
  /* 锁定态描边必须由 pickerColor 计算出来，而不是常量紫 */
  assert.ok(
    /border:\s*brandLocked\s*\?\s*`2px solid \$\{pickerColor\}`/.test(panel),
    '锁定态描边必须跟随 pickerColor（用户选什么颜色就是什么颜色的边框）',
  );
  /* 未锁定态：中性灰虚线 + 棋盘底，绝不出现紫色描边 */
  assert.ok(panel.includes('1.5px dashed rgba(45,41,38,0.28)'), '未锁定态必须是中性灰虚线描边');
  assert.ok(panel.includes('repeating-conic-gradient'), '未锁定态色块必须是中性棋盘底，不填充任何颜色');
});

test('① 默认态是「未锁定」：暂存色不再是品牌紫 #7c3aed，取色盘默认收起', () => {
  assert.ok(!panel.includes("'#7c3aed'"), '面板内不得再把 #7c3aed 当作取色器默认值/描边色');
  assert.ok(
    panel.includes("brandLocked && brandColors[0] ? brandColors[0] : '#1F1D1A'"),
    '未锁定时起始色必须是中性色，而不是「看起来已经选了紫色」',
  );
  assert.ok(
    panel.includes('const [pickerOpen, setPickerOpen] = useState(false)'),
    '取色面板默认收起 —— 默认态不能看起来像已经选好了颜色',
  );
  assert.ok(panel.includes('aria-pressed={brandLocked}'), '色块必须向无障碍树暴露「是否已锁定」状态');
});

test('① 文案与状态一致：未锁定时色值输入框显示占位「未锁定」，不预填色值', () => {
  assert.ok(
    panel.includes("value={brandLocked || pickerOpen ? pickerColor : ''}"),
    '未锁定且未展开取色器时输入框必须留空（否则显示色值 = 看起来已选中）',
  );
  assert.ok(panel.includes('placeholder="未锁定"'), '占位文案必须是「未锁定」，与状态严格一致');
  assert.ok(panel.includes("{brandLocked ? '已锁定' : '锁定'}"), '按钮文案必须与锁定状态一致');
  assert.ok(panel.includes('brandColors = null'), '默认参数 brandColors=null（不锁定）');
});

/* ═══ ② 「避免出现的元素」迁出生成设置 ═══ */

test('② 「避免出现的元素」已从生成设置面板移除', () => {
  assert.ok(!panel.includes('避免出现的元素'), '生成设置面板不得再渲染「避免出现的元素」');
  assert.ok(!panel.includes('negativePrompt'), '生成设置面板不得再持有 negativePrompt 字段');
  assert.ok(!panel.includes('ShieldAlert'), '相关的警示图标也应一并移走');
});

test('② 「避免出现的元素」落在「内容规范」面板（语义归属：画面内容约束）', () => {
  assert.ok(constraints.includes('避免出现的元素'), '约束面板必须承载该分组');
  assert.ok(constraints.includes('ShieldAlert'), '沿用原图标，用户认知连续');
  /* 挂在 copy（内容规范）而不是 settings（生成设置） */
  const copyBranch = ecMode.slice(ecMode.indexOf("activePanel === 'copy' && ("), ecMode.indexOf("activePanel === 'settings' &&"));
  assert.ok(copyBranch.includes('GenerationConstraintsPanel'), '约束面板必须挂在「内容规范」下');
  assert.ok(!ecMode.includes("activePanel === 'settings' && <GenSettingsPanel value={genSettings} onChange={setGenSettings} brandColors={customColors} onBrandColorsChange={setCustomColors} />}\n          {activePanel === 'copy' && <GenerationConstraintsPanel"), '不得重复渲染约束面板');
});

test('② 数据链路不变（仍走 genSettings.negativePrompt），画布侧同步不受影响', () => {
  assert.ok(
    ecMode.includes("negativePrompt: genSettings.negativePrompt") === false,
    '不应把 negativePrompt 挪到别的 state',
  );
  assert.ok(
    ecMode.includes('<GenerationConstraintsPanel negativePrompt={genSettings.negativePrompt}'),
    '约束面板仍从 genSettings.negativePrompt 读写（画布侧同一字段）',
  );
  assert.ok(
    ecMode.includes('setGenSettings(current => ({ ...current, negativePrompt: next }))'),
    '写回仍落在 genSettings 上',
  );
});

/* ═══ ③ 删除积分说明句 ═══ */

test('③ 「当前约 X AI 积分/张」说明句已删除', () => {
  assert.ok(!panel.includes('当前约'), '生成设置面板不得再出现「当前约 … AI 积分/张」');
  assert.ok(!panel.includes('AI 积分/张'), '该说明整句删除');
  assert.ok(!panel.includes('Coins'), '配套的 Coins 图标也应移除');
  /* 积分只在按钮/右下角动态显示 */
  assert.ok(ecMode.includes('planPoints.points'), '积分仍随配置实时计算');
  assert.ok(ecMode.includes('shubao-gen-cta-points'), '积分仍显示在主 CTA 上（动态跟随）');
  assert.ok(!ecMode.includes('积 分/张'), '不得再有任何「/张」的静态说明');
});

/* ═══ ② 生成设置面板视觉语言 ═══ */

test('② 生成设置面板消费统一视觉语言规范（无魔法字号/间距）', () => {
  assert.ok(panel.includes("from './panelVisualLanguage.js'"), '必须引入规范');
  for (const token of ['SPACING', 'FONT_SIZE', 'CONTROL_HEIGHT', 'RADIUS', 'sectionStyle', 'groupTitleStyle']) {
    assert.ok(panel.includes(token), '必须消费 ' + token);
  }
  /* 不再出现 9px/10px 的不可读小字（用户批注「做得特别小」） */
  const sizes = [...panel.matchAll(/fontSize:\s*(\d+)/g)].map(m => Number(m[1]));
  for (const s of sizes) assert.ok(s >= 11, '出现小于 11px 的字号：' + s);
});

test('② 分组标题与内容层级明确（标题 13/700，内容间距走阶梯）', () => {
  const titleBlock = panel.match(/<GroupTitle[^>]*>/g) || [];
  assert.ok(titleBlock.length >= 2, '生成设置至少两个分组（生图模型 / 清晰度）');
  const spec = read('src/pages/Home/ec/panelVisualLanguage.js');
  assert.ok(spec.includes('groupTitle: 13'), '分组标题 13px');
  assert.ok(spec.includes('groupTitle: 700'), '分组标题 700 字重');
});

test('② 控件点击区放大到 ≥32px（清晰度分段控件 40px）', () => {
  assert.ok(
    panel.includes('height: CONTROL_HEIGHT.large'),
    '清晰度等分段控件必须用规范的大控件高度（40px），不再是小控件',
  );
  assert.ok(panel.includes('minHeight: CONTROL_HEIGHT.large'), '模型行最小高度也走大控件档');
  assert.ok(panel.includes('height: CONTROL_HEIGHT.base'), '色块/锁定按钮走标准档 36px');
  /* 面板内所有按钮的实测高度必须 ≥32px —— 用规范常量断言，而不是字符串巧合 */
  const heights = [...panel.matchAll(/CONTROL_HEIGHT\.(compact|base|large)/g)].map(m => m[1]);
  assert.ok(heights.length >= 5, '控件高度必须全部取自规范常量，而不是写死像素');
  assert.ok(!/height:\s*30\b/.test(panel), '不得再出现 30px 的小控件（清晰度改造前正是 30px）');
});

/* ═══ ② 六面板宽度统一 ═══ */

test('② 六个参数面板宽度统一（EcMode 两处定位都走 resolvePanelWidth）', () => {
  const calls = [...ecMode.matchAll(/const panelW = resolvePanelWidth\(vw\);/g)];
  assert.equal(calls.length, 2, 'openPanel 与 repositionPanel 都必须用统一宽度解析');
  for (const stale of ['sizing: 480', 'sku: 540', 'style: 520', 'params: 520', 'copy: 620', 'settings: 460']) {
    assert.ok(!ecMode.includes(stale), '仍残留写死宽度：' + stale);
  }
});

test('② 内容规范面板摘要把「约束」也算进去（用户看得到已生效）', () => {
  assert.ok(ecMode.includes('已设生成约束'), '只设约束未填文案时摘要要反映出来');
  assert.ok(ecMode.includes('项文案+约束'), '两者都有时摘要要同时反映');
});
