import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const homeCss = readFileSync(new URL('../src/pages/Home/Home.css', import.meta.url), 'utf8');
const shellCss = readFileSync(new URL('../src/styles/app-shell.css', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const homeSource = readFileSync(new URL('../src/pages/Home/index.jsx', import.meta.url), 'utf8');
const ecommerceModeSource = readFileSync(new URL('../src/pages/Home/EcMode.jsx', import.meta.url), 'utf8');
const shellMobileRules = shellCss.match(/@media \(max-width: 639px\) \{([\s\S]*?)\n\}/)?.[1] || '';

test('mobile ecommerce workbench reserves space above the fixed navigation', () => {
  const mobileRules = homeCss.match(/@media \(max-width: 639px\) \{([\s\S]*?)\n\}/)?.[1] || '';
  assert.match(mobileRules, /\.ec-main-card \{[^}]*padding-bottom:\s*max\(84px, calc\(72px \+ env\(safe-area-inset-bottom\)\)\)/);
  assert.match(shellMobileRules, /\.app-side-nav \{[^}]*bottom:\s*max\(10px, env\(safe-area-inset-bottom\)\)/);
});

test('mobile ecommerce actions stay compact and remain in flow below the composer', () => {
  const mobileRules = homeCss.match(/@media \(max-width: 639px\) \{([\s\S]*?)\n\}/)?.[1] || '';

  assert.match(ecommerceModeSource, /className="ec-workbench-actions(?:\s|\")/);
  assert.match(ecommerceModeSource, /className="ec-workbench-tools"/);
  /* 9-12 用户批注：生成按钮统一挂主 CTA 类（样式与动态积分全站一致）。
     2026-09-15 V3：类名从 .shubao-gen-cta 迁到 token 化的 .ec-workbench-cta
     （前者含紫→粉→橙渐变，属 V3 停用的功能按钮渐变）。 */
  assert.match(ecommerceModeSource, /className="ec-workbench-next ec-workbench-cta"/);
  assert.match(mobileRules, /\.ec-workbench-actions \{[^}]*position:\s*relative[^}]*bottom:\s*auto/);
  assert.match(mobileRules, /\.ec-workbench-actions \{[^}]*flex-direction:\s*column/);
  assert.match(mobileRules, /\.ec-workbench-primary-row \{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto/);
  assert.match(mobileRules, /\.ec-workbench-submit-actions \{[^}]*gap:\s*6px/);
  assert.match(mobileRules, /\.ec-workbench-tools \{[^}]*overflow-x:\s*auto[^}]*flex-wrap:\s*nowrap/);
});

test('homepage clips only horizontal decoration so sticky mobile actions can follow vertical scrolling', () => {
  assert.match(homeSource, /overflowX:\s*'clip'/);
  assert.doesNotMatch(homeSource, /overflow:\s*'hidden'/);
});

test('mobile top bar keeps the product brand on one line without crowding account actions', () => {
  assert.match(appSource, /app-topbar/);
  /* ⚠️ 2026-09-19 批 I-③（门禁改判据，理由如下）：
     原来这条断言的是字面量 className="topbar-row"。批 I-③ 给这一行加了
     **子页面修饰类**（className={'topbar-row' + (subpageHeader ? ' is-subpage' : '')}，
     用户批注 #12 要求子页面顶栏换成「左返回/中名称/右积分账户」三格），
     字面量形式就不存在了。
     判据改成「这一行仍然存在、且类名仍然是 topbar-row（可带修饰类）」——
     断言的原意（移动端顶栏这一行没被改名/删掉）一字不变，只是允许了修饰类。 */
  assert.match(appSource, /className={[^}]*'topbar-row'[^}]*}/);
  assert.match(appSource, /className="topbar-brand"/);
  assert.match(appSource, /className="topbar-actions"/);
  /* ═══ 2026-09-24 批 BC：**判据改向**（用户：「LOGO 和文字还是做得不好，这块还是要重做」）═══════
     原来这一条守的是 `.topbar-logo { white-space: nowrap }` —— 那是在守"用 HTML 文本拼的字标不许折行"。
     现在品牌标**换成一份设计好的资产**（`IMAGES.wordmark`：吉祥物 + 定制字形，单张图），
     HTML 里已经没有 `.topbar-logo` 这个节点，"折行"这件事自然不存在了。
     守的东西换成同一件事的两条（判据换写法，不是放宽）：
       ① 品牌标仍是**一个**资产节点（不许各页各做一份）；
       ② 窄屏给的是**缩小版**而不是压扁 —— 只改 height、宽度自适应 ⇒ 比例不变形。 */
  assert.match(appSource, /className="topbar-brand-lockup"/, '品牌标是同一个资产节点（不是各页各做一份）');
  assert.match(shellMobileRules, /\.topbar-subpage-lead \.topbar-brand-lockup \{ height: 24px; \}/,
    '窄屏品牌标取缩小版（值变小、比例不变）');
  assert.match(shellMobileRules, /\.topbar-row \{[^}]*padding-inline:\s*14px/);
  assert.match(shellMobileRules, /\.topbar-actions button \{[^}]*padding-inline:\s*12px/);
});

test('global task dock uses a stable accessible button instead of an eight pixel hover strip', () => {
  const source = readFileSync(new URL('../src/components/task/TaskSidebar.jsx', import.meta.url), 'utf8');
  assert.match(source, /aria-label="打开任务列表"/);
  assert.match(source, /aria-expanded=\{open\}/);
  assert.match(source, /onClick=\{\(\) => setOpen/);
  assert.doesNotMatch(source, /SIDEBAR_WIDTH_COLLAPSED\s*=\s*8/);
});

test('mobile Canvas action picker remains in transformed world coordinates', () => {
  const workflowCss = readFileSync(new URL('../src/pages/EcCanvas/components/workflowNodes/workflowNodes.css', import.meta.url), 'utf8');
  const mobileBlock = workflowCss.match(/@media \(max-width: 700px\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.doesNotMatch(mobileBlock, /\.workflow-action-picker\s*\{[\s\S]*?position:\s*fixed/);
  assert.match(workflowCss, /\.workflow-picker-list\s*\{[^}]*overflow-y:\s*auto/);
});
