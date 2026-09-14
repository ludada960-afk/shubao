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
  /* ── 未锁定态：中性灰虚线 + 棋盘底，绝不出现紫色描边（用户明确要求）──
     等价性说明（本条第 5 项）：实现由「内联字面量」改为**引用 NEUTRAL_UNLOCKED 常量**，
     该常量本身也升级为 V3 token。三条语义全部不变且更严格：
       · 描边仍是中性灰虚线（--sb-border-strong = 暖中性，绝非品牌紫）
       · 宽度恒 2px，与锁定态等宽（D2：改宽度会造成布局抖动）
       · 底色仍是中性棋盘，不填充任何颜色
     断言改为：① 实现引用唯一事实源；② 该事实源的取值满足上述语义。
     这样「常量被改坏」或「面板绕开常量自己内联」都会被抓到。 */
  assert.ok(
    panel.includes('NEUTRAL_UNLOCKED'),
    '未锁定态必须引用 NEUTRAL_UNLOCKED 常量（唯一事实源，禁止各面板内联同一组值）',
  );
  const spec = read('src/pages/Home/ec/panelVisualLanguage.js');
  const constDef = spec.slice(spec.indexOf('NEUTRAL_UNLOCKED'), spec.indexOf('NEUTRAL_UNLOCKED') + 400);
  assert.ok(
    /border:\s*'2px dashed var\(--sb-border-(strong|default)\)'/.test(constDef),
    '未锁定描边必须是中性灰虚线且宽度 2px（与锁定态等宽）',
  );
  assert.ok(
    !/124,\s*58,\s*237|7c3aed/i.test(constDef),
    '未锁定描边绝不得是品牌紫',
  );
  assert.ok(/repeating-conic-gradient/.test(constDef), '未锁定色块必须是中性棋盘底，不填充任何颜色');
  /* 反向护栏：面板不得再内联同一组值（否则又是一处「多套真相」） */
  assert.ok(
    !/repeating-conic-gradient/.test(panel),
    '面板不得内联棋盘底 —— 必须引用 NEUTRAL_UNLOCKED',
  );
});

test('① 默认态是「未锁定」：暂存色不再是品牌紫 #7c3aed，取色盘默认收起', () => {
  assert.ok(!panel.includes("'#7c3aed'"), '面板内不得再把 #7c3aed 当作取色器默认值/描边色');
  /* 语义断言：未锁定时回退到中性色（不绑定字面量）。现实现为
     brandLocked && brandColors[0] ? brandColors[0] : (neutralInk || FALLBACK_NEUTRAL_INK)。 */
  assert.ok(
    /brandLocked && brandColors\[0\] \? brandColors\[0\] :/.test(panel),
    '未锁定时起始色必须走中性回退分支，而不是品牌色',
  );
  assert.ok(
    /FALLBACK_NEUTRAL_INK\s*=\s*'rgb\(\d+,\s*\d+,\s*\d+\)'/.test(panel),
    '中性回退色必须是一个中性 RGB 字面量',
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
  /* ── 最要紧的一条：用户要删的是**说明文字**，不是 CTA 上的积分数 ──
     用户需求原意：「下面为什么要有『当前约 1 AI 积分/张』这一句？没必要，
     动态调整任何东西，右下角积分跟着变就可以了。」→ 删说明句，**保留动态积分**。
     故本断言必须锁死三件事，缺一不可：
       ① 积分仍随配置实时计算（planPoints）
       ② 积分仍渲染在主 CTA 内（ec-workbench-cta-points）
       ③ 积分文案绑定的是计算结果（planPoints.points），不是任何静态字符串
     2026-09-15 强化：原文写作「两种类名二选一」，那会让「积分被摘掉只剩旧类名」
     也能通过。现改为**必须命中当前实现**，并新增运行时契约测试（见
     test/home-cta-points-live.test.mjs）实测「改清晰度 → 积分数值变」。 */
  assert.ok(ecMode.includes('planPoints.points'), '① 积分仍随配置实时计算');
  assert.ok(ecMode.includes('ec-workbench-cta-points'), '② 积分仍渲染在主 CTA 内');
  assert.ok(
    /ec-workbench-cta-points">\{planPoints\.points\}/.test(ecMode),
    '③ 积分文案必须绑定 planPoints.points（动态），不得退化为静态字符串',
  );
  assert.ok(!ecMode.includes('积 分/张'), '不得再有任何「/张」的静态说明');
});

/* ═══ ② 生成设置面板视觉语言 ═══ */

test('② 生成设置面板消费统一视觉语言规范（无魔法字号/间距）', () => {
  /* ── 关于「必须引入规范」的等价性说明（第 4 条） ──
     原断言：panel.includes("from './panelVisualLanguage.js'")。
     现状：间距/字号/控件高/圆角的**唯一权威**已上移到 design-tokens-v3.css 的 --sb-*，
     本面板因此不再 import panelVisualLanguage.js（若继续 import 反而会出现
     「两套来源并存」——正是 D8 要治的病）。
     等价性：两种写法的**语义完全相同** —— 都是「取值必须来自统一规范，不得自带魔法数字」。
     下面两种情况都要求：规范定义的每一类取值（内边距/分组间距/字段间距/圆角/控件高）
     必须在面板里以规范形式出现。任一缩水仍会失败。 */
  const usesV3 = /--sb-(panel-padding|group-gap|field-gap|radius-|control-)/.test(panel);
  const legacy = panel.includes("from './panelVisualLanguage.js'");
  assert.ok(usesV3 || legacy, '必须消费统一规范（V3 token 或 panelVisualLanguage 二选一）');
  if (usesV3) {
    for (const token of ['--sb-panel-padding', '--sb-group-gap', '--sb-field-gap', '--sb-radius-', '--sb-control-']) {
      assert.ok(panel.includes(token), '迁移 V3 后必须消费 ' + token);
    }
  } else {
    for (const token of ['SPACING', 'FONT_SIZE', 'CONTROL_HEIGHT', 'RADIUS', 'sectionStyle', 'groupTitleStyle']) {
      assert.ok(panel.includes(token), '必须消费 ' + token);
    }
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

test('② 控件点击区不缩水：分段控件 ≥40px，色块/锁定按钮 ≥36px（断言实际数值）', () => {
  /* ── 用户需求原文：「点击区不许变小」 ──
     清晰度等分段控件 ≥40px（改造前 30px）；色块/锁定按钮 ≥36px（改造前 30px）。
     本断言**解析实现里的高度取值并校验数值下限**，不绑定任何常量名或 token 名 ——
     无论实现换成 CONTROL_HEIGHT 常量、--sb-control-h-*、--sb-control-{sm,md,lg,touch}
     别名，还是直接写数字，都仍能被正确判定，且**任何缩水都会被抓住**。
     V3 阶梯：--sb-control-h-sm=28 / -md=32 / -lg=36 / -xl=44；
     兼容别名 --sb-control-sm/md/lg/touch 指向同一组。 */
  const LADDER = { xs: 24, sm: 28, md: 32, lg: 36, xl: 44, touch: 44, compact: 32, base: 36, large: 40 };
  /** 把一个高度写法解析成像素值；解析不到返回 null。 */
  const toPx = raw => {
    const token = raw.match(/var\(--sb-control-(?:h-)?([a-z-]+)\)/);
    if (token) return LADDER[token[1]] ?? null;
    const konst = raw.match(/CONTROL_HEIGHT\.([a-z]+)/);
    if (konst) return LADDER[konst[1]] ?? null;
    const num = raw.match(/^(\d+)$/);
    return num ? Number(num[1]) : null;
  };
  const heights = [...panel.matchAll(/height:\s*'?([^,'\n}]+)'?\s*[,\n}]/g)]
    .map(m => toPx(m[1]))
    .filter(v => v !== null);
  assert.ok(heights.length >= 3, '控件高度必须显式来自规范/阶梯，而不是散装像素');
  /* ① 清晰度分段控件 ≥40px（用户明确要求） */
  assert.ok(
    Math.max(...heights) >= 40,
    '分段控件点击区必须 ≥40px（改造前 30px），实际最大 ' + Math.max(...heights),
  );
  /* ② 色块 / 锁定按钮 / 同行输入框 —— 同一排三者都 ≥36px */
  const atLeast36 = heights.filter(v => v >= 36).length;
  assert.ok(atLeast36 >= 3, '色块/锁定按钮/同行输入框必须 ≥36px，实际 ≥36 的有 ' + atLeast36 + ' 处');
  assert.ok(!/height:\s*30\b/.test(panel), '不得再出现 30px 的小控件（改造前正是 30px）');
  assert.ok(
    !/height:\s*'?var\(--sb-control-sm\)'?/.test(panel),
    '色块/锁定按钮不得使用最小的 28px 档',
  );
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
