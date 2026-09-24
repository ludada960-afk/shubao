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
  /* ═══ 2026-09-24 批 BD：**判据再换一次**（用户：「还是不对啊……你不如重新推翻重新设计吧」）═══
     批 BC 那条守的是 `.topbar-brand-lockup { height: 24px }`（那版品牌标是一张现成资产图）。
     本版把标拆成 **mark（脚本合成的磁贴）+ 排版字标**，资产不再是一个 lockup 图，
     所以守的点回到"磁贴"这一层：① 顶栏与子页面共用**同一个**资产节点；
     ② 子页面/窄屏取**缩小版**（值变小、比例不变）。守的东西仍然是那件事：
        品牌标只有一个实现，且小屏不许被压扁。 */
  assert.match(appSource, /className="topbar-brand-mark"/, '品牌标是同一个资产节点（不是各页各做一份）');
  /* ⚠️ 2026-09-25 批 BF：**判据换第三次 —— 这次是「事实变了」，不是为了让断言过**。
     用户原话（逐字）：「正常的这个 LOGO 它是展示全部的，然后当我往下滚动的时候，LOGO 才会缩成
     这个比较小的这个样式。你现在的情况是它永远是比较小的样式，这是不对的。」
     于是两态**反过来**了：顶部 = 完整标（34px + 「薯包 AI」），滚动后 = `.app-topbar.is-compact` 缩到 26px。
     同一轮用户还要求「子页面的 LOGO 要跟其他页面一样放到左边导航栏的左上角」，所以子页面**不再单独缩标**
     —— `.topbar-brand.is-compact-mark` 这个类已经不存在（两处共用同一个标、同一个位置）。
     断言的**原意一字不变**：品牌标只有一个实现，且"缩"只改尺寸、不改比例（不允许压扁）。
     守的对象从"子页面那份缩小版"换成"滚动那份缩小版"。 */
  assert.match(shellCss, /\.app-topbar\.is-compact \.topbar-brand-mark \{ width: 26px; height: 26px;/,
    '滚动后取缩小版（只改尺寸、比例不变）');
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
