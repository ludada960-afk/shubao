#!/usr/bin/env node
// scripts/precommit-check.mjs —— 提交前必跑（npm run precommit）
// ═══════════════════════════════════════════════════════════════════════════
// 为什么存在：本工作树由多条线共用，本轮已发生三次本可被一次检查挡下的事故：
//   ① 离线 patch 上下文过期 → 37 个文件被当删除应用（Home.css 3585→935、EcStudio 1404→1 行）
//      → 构建全红、单测全绿，站点起不来；
//   ② 一次文案修复把 8 个插件文件整体改成 CRLF → 1646/1486 假 diff，真改动被淹没；
//   ③ 单文件半改状态挂了 4 轮 → 9 条线的验证结论全部不可信。
// 三条都能被同一次检查拦住：构建 + 源码完整性 + 门禁套件。
//
// ⚠️ 两类必须分开，否则进度条会让谁都提交不了，工具就没人用了：
//   BLOCKING = 断言「必须为 0 / 不得回退」→ 红了是**回归**，停下修；
//   ADVISORY = 记录**已知未完成量**（进度条）→ 红了只提示，不拦提交。
// 并发提示：若报红先重跑一次再定性（别人正在保存的瞬时态很常见，RTK §3.1-6）。
// ═══════════════════════════════════════════════════════════════════════════
import { spawnSync } from 'node:child_process';

const BLOCKING = [
  'test/source-syntax-integrity.test.mjs',
  'test/interactive-state-coverage.test.mjs',
  'test/focus-visible-baseline.test.mjs',
  'test/token-no-duplicate-definitions.test.mjs',
  'test/token-vars-defined.test.mjs',
  'test/legacy-token-family.test.mjs',
  'test/design-system-layer.test.mjs',
  'test/ink-contrast.test.mjs',
  'test/no-upstream-leakage.test.mjs',
  'test/charge-requires-confirmation.test.mjs',
  /* 渲染期 TDZ：2026-09-17 同一个坑在同一文件踩了两次（依赖数组引用了后面才声明的 const
     → 整页落错误边界）。2026-09-16 的线上白屏事故也是同一类。
     判据干净：const/let 有暂时性死区、函数声明会提升 —— 依赖数组里的 const/let 必须先声明。 */
  'test/render-order-tdz-0917.test.mjs',
  'test/pricing-single-source.test.mjs',
  /* 键盘不可达回归：2026-09-20 起**已归零**（79 → 0），因此从"进度条"升为**硬门禁**。 */
  'test/no-clickable-div.test.mjs',
  /* CSS 注释完整性：2026-09-15 起为**硬门禁**。
     起因是一次 P0 —— token 权威文件里一条注释**自己写了一个注释结束符**，
     导致注释提前闭合、紧随其后的 :root（兼容别名层）被并进非法选择器**整条丢弃**，
     35 条别名 token、240 个引用点静默失效（首页品牌主色色块渲染成 4px）。
     幽灵变量 / 同作用域重复定义 / 源码完整性三条门禁**都看不见**这一类，
     只有实机契约抓到了它 —— 本门禁把它变成静态可查。 */
  'test/css-comment-integrity.test.mjs',
  /* 第三套 token 语言防复发：2026-09-15 起为**硬门禁**。
     起因是真实事故 —— 仓库里除 V2 / V3 外还躺着第三个 token 文件 semanticTokens.css，
     10 个 token 里 7 个全仓零引用，且在 main.jsx 里排在 theme.css 之后 import，
     于是它的 :root 值**静默压过** theme.css 的回退值：.theme-switcher 的焦点描边
     实测渲染 rgb(37,99,235)，而作者写在文件里的回退值是 --sb-info 的 #5275CC。
     口径是**棘轮**（主题作用域内非 --sb-* 定义 177 处 / 105 名不许再涨），
     不是「必须为 0」—— 现存 177 处都属已登记待迁的 V2 / 已判合法的组件自有家族。
     幽灵变量 / 重复定义 / 家族棘轮 / DS 层四条门禁**都看不见**这一类。 */
  'test/token-root-scope-language.test.mjs',
  /* 断言「token 拼写」的契约文件：2026-09-15 起为**硬门禁**。
     起因是本轮 D26 迁移（--accent → --sb-surface-inverse 等）改了 token 名，
     这四份契约里有 8 条断言在做**逐字匹配**，于是集体失效 ——
     而 precommit 的 14 条门禁里**没有**它们，逐文件 precommit 全绿，
     直到**部署的 npm test 步骤**才把它们挡下来（部署 exit 1）。
     把这类文件挂进 BLOCKING 之后，同类失效会在 precommit 阶段就暴露。
     （另注：dsh 的部署脚本自带 npm test，是当前唯一能覆盖全量契约的关卡。） */
  'test/footer-actions-contract.test.mjs',
  'test/canvas-derive-menu.test.mjs',
  'test/video-canvas-tapnow-w1.test.mjs',
  'test/visual-system-contract.test.mjs',
  /* nano 上游模型名单一来源：2026-09-15 起为**硬门禁**。
     起因：目录写死 'gemini-2.5-flash-image'、供应商下架换成 3.1，而适配器用自己的默认值
     做白名单校验 —— 两处各写一份，用户得到「模型当前不可用」。
     本门禁守住「只有一处声明」，并自带两条自证（过期名字抓得到 / 注释与别族不误报）。 */
  'test/nano-model-single-source.test.mjs',
  /* 首屏/面板图片体积契约：2026-09-15 起为**硬门禁**。
     起因：9-14 的审计发现首屏 9.4MB（源图直引），首屏修好之后**非首屏又踩了一次**
     —— 视觉创作面板 48×48 的图标位直引 5–7MB 源 PNG，14 张翻一遍 ≈ 84MB。
     在 3Mbps 出口的机器上，这类回归用户立刻能感觉到，必须拦在提交前。 */
  'test/home-first-screen-image-policy.test.mjs',
  /* 工作台面板 UX 契约：2026-09-15 起为**硬门禁**。
     来源是用户对六个面板的一次集中批注（12 条），每条都写了「用户原话 → 根因 → 判据」。
     挂进硬门禁的理由：这一批里有 3 条是**真 bug**（色盘点了不弹、调数量被取消选中、
     技能库把未登录渲染成英文报错），另有 2 条是**同类复发**（源图直引、间距贴死），
     都属于「不拦就会再犯」的类型。
     ⚠️ 本文件一律先剥注释再断言 —— 初版没剥，被自己解释根因的注释顶红过两次。 */
  'test/workbench-panel-ux-0915.test.mjs',
  /* 2026-09-16 第 11 张批注图（11 组）。挂进硬门禁的理由与上一批相同，但这一批更硬：
     一半的问题**不是视觉，是链路断了** —— 用户问「你确定现在所有的这些逻辑都是打通的情况吗？」
     审计结论是没打通（变体说明被白名单丢掉、避免出现的元素服务端 0 命中、
     品牌色与商品信息在「应用到画布」时被换成默认空值）。
     所以本文件里有多条是**行为断言**：直接 import 服务端模块跑一遍，而不是 grep 字面量。
     另有两条是「不许偷偷开通」的守门（1080P 计费 SKU 必须保持 public:false）。 */
  'test/workbench-unify-0916.test.mjs',
  /* 视频路由可达性：2026-09-16 起为**硬门禁**。
     起因是一次「上架了 8 个永远调不通的模型」：上架时只核对了「中转 /v1/models 里有这个名字」，
     但那份清单是全站目录，不代表本站凭证能调到 —— 视频端点只认声明 openai-video 的 id，
     再叠加分组授权与渠道是否活着。结果 10 条路由里 8 条提交即被上游拒收，
     用户侧的表现就是「模型看着有、点了就失败」（用户原话：都是些假的模型）。
     同类风险还有第二次：时长按 [min,max] 夹取，而上游按秒档位校验（seedance 2.0 只认 5/10/15），
     默认 8 秒的初始状态同样会被上游拒收。
     本门禁同时守住三件事：① 公开产品只允许走台账里 verified/callable 的路由；
     ② 每条产品路由都必须在台账里登记并带证据日期（新路由不能悄悄上线）；
     ③ 时长只能落在白名单里，吸附不得夹取成非法值。 */
  'test/video-catalog.test.mjs',
  /* 渲染期 TDZ：2026-09-16 起为**硬门禁**（当天线上白屏 P0 的直接产物）。
     起因：SkillLibraryModal 的 useLayoutEffect 依赖数组引用了第 115 行才声明的 const editing，
     依赖数组在渲染期求值 → ReferenceError → 整页落到错误边界。
     构建绿、单测全绿、资源哈希逐字一致都拦不住它：源码语法完整性只看「能不能编译」，
     而这段代码**编译得非常好**。本门禁按 AST 查「同作用域内引用早于 const/let 声明」，
     自带两条自证（白屏那种写法必须被抓到 / 嵌套闭包与 ?. 成员访问不许误报）。 */
  'test/no-tdz-before-init.test.mjs',
  /* 媒体板块「同一套语言」：2026-09-16 起为**硬门禁**。
     用户批注：图片生成与视频生成两个板块的素材卡/布局/按钮必须同源，不能各长一套
     （原话：「那我觉得是不行的…样式逻辑得是类似的」）。
     本批先收口两件可验证的事：视频侧素材卡复用图片侧「扇形歪卡」的同一组数值；
     主流程不再询问「要不要生成声音」（默认出声音）。跨板块一致性靠 review 记不住，靠测试才守得住。 */
  'test/media-language-unify-0916.test.mjs',
  /* Skill 声明契约：2026-09-16 起为**硬门禁**。
     这次重构的前提是「新增 Skill = 加一条声明，不写页面」——声明文件是 Hub 的唯一输入，
     它长歪了后面 40 个 Skill 会一起歪。本门禁守：形状合法（id/复杂度/pipeline/封面）、
     字段只能用 FieldRenderer 登记过的档位（页面不得手写控件）、
     简单档真的简单（≤4 字段）、未知 id 返回 null 而不是半成品。 */
  'test/skill-declaration-contract-0916.test.mjs',
  /* 封面产线契约：2026-09-16 起为**硬门禁**。
     用户批注（图 #13）：「你把每一类的封面它的整体的提示词给到我，我去生成之后自己上传上来」
     —— 风格一致靠的是统一 4:3 + 同族版式 + 同族色相，不是靠审美。
     本门禁守：每个 Skill 都有封面计划（Hub 上不许出现没封面的空卡）、
     模板/色相必须在白名单里、标题不超 8 字、提示词必须真的带上 4:3/色相/标题/禁止项。 */
  'test/cover-template-contract-0916.test.mjs',
  /* 视频 Skill 库契约：2026-09-16 起为**硬门禁**。
     用户批注（图 #9）：保留智能成片/首尾帧，爆款复刻转 skill，并要一份"前沿视频玩法"的 skill 库。
     最容易犯的错是把跑不通的玩法写成能用（9-16 那批 8 条死路由就是这么来的），
     所以本门禁把 availability（ready / needs_ref / blocked）变成**必须如实标注**的硬字段。 */
  'test/video-skill-library-contract-0916.test.mjs',
];

/* 当前没有进度条类门禁（键盘可达已归零）。将来若有"已知未完成量"，加在这里，不要塞进 BLOCKING。 */
const ADVISORY = [];

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const failed = [];

console.log('[1/4] npm run build …');
if (spawnSync(npm, ['run', 'build'], { stdio: 'inherit', shell: process.platform === 'win32' }).status !== 0) failed.push('npm run build');

/* ⚠️ 这一格是 2026-09-16 白屏事故后补的：当时构建 exit 0、单测全绿、资源哈希逐字一致，
   而线上整页落在错误边界（SkillLibraryModal 里 useLayoutEffect 依赖数组引用了后面才声明的
   const editing → 渲染期 TDZ）。**构建绿不等于页面能打开**，中间缺的正是「真的渲染一遍」。 */
console.log('[2/5] 真实渲染冒烟（产物必须能打开，不能只看构建绿）…');
if (spawnSync(process.execPath, ['scripts/render-smoke.mjs'], { stdio: 'inherit' }).status !== 0) failed.push('真实渲染冒烟');

/* ⚠️ 这一格是 2026-09-17 补的：渲染冒烟只能证明"页面能打开"，证明不了
   "技能工作台真的能把字段翻译成引擎参数、出图、存作品、失败能只重试失败项"。
   所以把**端到端**也挂进来（上游 /api/* 按服务端真实契约打桩 → 零额度消耗）。
   它抓到过一个真 bug：上传用旧闭包写回，缩略图上传成功后消失。 */
console.log('[3/5] 技能工作台端到端（字段→参数→出图→存作品→失败重试）…');
if (spawnSync(process.execPath, ['scripts/media-workbench-e2e.mjs'], { stdio: 'inherit' }).status !== 0) failed.push('技能工作台端到端');

console.log('[4/5] BLOCKING 门禁（' + BLOCKING.length + ' 个）…');
if (spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...BLOCKING], { stdio: 'inherit' }).status !== 0) failed.push('BLOCKING 门禁');

console.log('[5/5] ADVISORY 进度条（' + ADVISORY.length + ' 个，不拦提交）…');
/* ⚠️ 本格曾经**对开发者说假话**（2026-09-15 修正）：ADVISORY 为空时，
   `node --test` 不带文件参数会走**默认发现** —— 于是它把 test/ 之外的东西也跑了：
   实测 fail=20 = **15 个 test/qa/ 浏览器探针脚本**（未纳入 git 的临时件，需要 dev server 才能跑）
   + **5 条 npm test 有意跳过的用例**（--test-skip-pattern）。
   然后本格把它们报成「仍有未完成量……属任务清单，见 §8.14」——
   而 §8.14 与这 20 条**毫无关系**。每次 precommit 都在给下一个人一条错误的线索。
   （与 legacy-token-family 那条「承诺了不存在的 ⑤」同族：**指标测的是判据的代理**。）
   修正：**没有 ADVISORY 就明确说没有，不要跑任何东西**。
   要恢复这条线，就老老实实往 ADVISORY 里填**契约文件名**。 */
if (ADVISORY.length === 0) {
  console.log('  ↳ 当前没有进度条类门禁（键盘可达已归零）。');
} else {
  const adv = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...ADVISORY], { stdio: 'pipe', encoding: 'utf8' });
  const m = (String(adv.stdout || '') + String(adv.stderr || '')).match(/fail\s+(\d+)/);
  if (adv.status !== 0) console.log('  ↳ 仍有未完成量（fail=' + (m ? m[1] : '?') + '）—— 属任务清单，见 docs/design/34-status-and-handover.md §8.14');
}

if (failed.length) {
  console.error('');
  console.error('✖ precommit 未通过：' + failed.join(' / '));
  console.error('  → 不要提交。先修，再重跑一次。');
  console.error('  → 红在别人路径内的文件：不要代修，报告给对应线（RTK §3.1-4）。');
  process.exit(1);
}
console.log('');
console.log('✅ precommit 通过：构建 exit 0 + BLOCKING 门禁全绿 —— 可以提交。');
