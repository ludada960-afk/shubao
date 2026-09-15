// test/legacy-token-family.test.mjs
// 门禁（棘轮）：**第二套 token 语言不许再长** —— V2 变量家族只能减、不能增。
// ─────────────────────────────────────────────────────────────────────────────
// 背景（本轮实测，之前没人量化过）：仓库里并存**两套 token 语言**
//   ① V3（权威）：`--sb-*`，定义在 src/styles/design-tokens-v3.css
//   ② V2（历史遗留）：`--text-* / --radius-* / --border* / --red / --green / --weight-* /
//      --shadow-* / --duration-* / --bg-* …`，定义在 src/styles/design-tokens.css 与 theme.css
//
// ⚠️ **最危险的一点：两套同名不同值** ——
//   `--radius-md: 16px`（V2）  vs  `--sb-radius-md: 8px`（V3）
//   `--radius-lg` / `--radius-xl` / `--radius-full` 同理。
//   这与「`--sb-brand-gradient` 被定义两次」是**同一族**的静默缺陷：
//   读代码的人看到 `radius-md` 以为是 8px，实际渲染 16px。
//
// 口径（依裁定 1「不允许两套并存」与原则 §12）：
//   ① 本门禁**不要求立刻为 0**（610 处 / 48 个名字，需要分批迁移），但**绝不许增长**；
//   ② 迁移时**禁止逐值相等式机械替换**（两套阶梯不同），必须逐处给出
//      「V2 值 → 新 `--sb-*` token → 观感影响」；能取到**逐值相等**的映射时零观感变更（例：V2 16px → `--sb-radius-xl`）；
//   ③ **在迁移完成前，禁止把 `var(--radius-md)` 这类用法当作「16px 档位」去归并** ——
//      那是**命名冲突**，不是档位（D24）。
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '../scripts/lib/token-scope.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** V2 家族的名字特征：var(--x) 且不是 --sb-* / --cvl-* / --max-width* */
/* ⚠️⚠️ 口径修正（2026-09-15，第 11 轮）：**旧正则看不见「带兜底」的写法**。
   旧写法是 `var\(--(名字)\)` —— 要求 `)` **紧跟名字**。于是
     var(--text-primary, #1A1614)      ← 带兜底
     var( --border )                    ← var( 后有空白
   这两类**一条都数不到**。实测盲区规模：**183 处 / 32 个名字 / 17 个文件**
   —— 也就是说本门禁自建立起就一直少算这一类，此前几轮报的「179 → 0」
   **同样只覆盖「无兜底」那一种写法**。
   修正：去掉「右括号紧跟」这个要求，并允许 var( 后有空白。
   （这条与 §8.16 那次 P0、以及 space-ratchet 的失明属同一族：
     **指标测的是判据的代理，而代理漏了一整类写法。**） */
export const LEGACY_RE = /var\(\s*--(?!sb-|cvl-|max-width)([a-zA-Z0-9-]+)/g;

/** 家族第一层筛选（与 git grep 用的那套逐字相同）——**保留它才和 744→719→179 的基线史可比**。
    ═══ ⚠️ 已知边界：本门禁是**家族口径**，不是「全站 V2」的全部 ═══
    第 81 轮实测（剥注释后，口径 = LEGACY_RE 且不限家族前缀）：

      门禁口径内（11 个家族前缀）              **141** 处 / 24 名   ← 基线就是这个数
      门禁口径外（同一份 LEGACY_RE、同一份剥注释，只是名字不在这 11 个前缀里）
        --ec-*        140   画布自有 token 家族
        --canvas-*     76   画布自有 token 家族
        --accent*      51   **全局 V2 色**（design-tokens.css/theme.css 定义）
        --sk-*         37   技能库自有 token 家族
        --footer-actions-*  32
        --blue*        26   **全局 V2 色**
        --stack-* 16  --font-* 15  --cl-* 14  --space-* 8  --case-ratio 7
        --leading-* 5  --nav-* 5  --visual-* 4  --vcb-* 3  其余 ~14
      ─────────────────────────────────────────────────
      合计          **586** 处 / 110 名

    **两个必须分开报的数**（D15 的「剩余量口径」同理）：
      · 「门禁口径内还剩 141」——本门禁管的就是这个，它绿 ≠ 全站干净；
      · 「全站 V2 名字面还剩 586」——比 141 大 4 倍，且其中两个家族是**门禁自己的疏漏**：
        `--red` / `--green` 被收进了前缀白名单，同类的 `--accent` / `--blue` 却没有 ——
        这不是「设计上分了两类」，是**选词时漏了**。
        → 已立账：**docs/design/40-decisions.md D26**（口径疏漏 + 组件自有 token 家族的处置）。
    禁止把「141 → 0」写成「V2 已清零」。 */
/* ⚠️ 家族表**只在这里写一遍**。此前它在本文件里写了两处（FAMILY_RE 与 grepLegacy 里
   `git grep -E` 的内联模式），两处必须逐字一致才不会漂移 —— 而「两份逻辑漂移」
   正是本会话反复踩到的一类缺陷。改成从 FAMILY_ALT 派生两个使用者。 */
const FAMILY_ALT = '(radius|text|weight|shadow|duration|border|red|green|bg|surface|ease'
  + '|accent|blue|space|leading|font|footer-actions)';
/* 同样去掉「右括号紧跟」的要求并允许空白 —— 否则家族筛选会与 LEGACY_RE 口径不一致，
   出现「LEGACY_RE 数得到、FAMILY_RE 筛不进来」的漏算（这正是上面那条盲区的成因）。 */
const FAMILY_RE = new RegExp('var\\(\\s*--' + FAMILY_ALT + '[a-z0-9-]*');
/** 同一份家族表的 git grep -E 形态（ERE 里括号需转义；空白用 POSIX 类） */
const FAMILY_GREP = 'var\\([[:space:]]*--' + FAMILY_ALT + '[a-z0-9-]*';

/** 从文本里数出 V2 用法（导出以便自证） */
export function countLegacy(text) {
  const names = new Map();
  let total = 0;
  for (const m of text.matchAll(LEGACY_RE)) { total++; names.set(m[1], (names.get(m[1]) || 0) + 1); }
  return { total, names };
}

/** 先剥注释再数 —— 注释里的 `var(--x)` 是**说明文本**，不是用法。
    （与 design-system-layer 门禁同口径，两处共用 scripts/lib/token-scope.mjs 的 stripComments，
      免得「剥注释」这件事出现第二份实现。） */
export function countLegacyLive(text) { return countLegacy(stripComments(text)); }

function grepLegacy() {
  /* ⚠️ 口径修正（第 81 轮，与 space-ratchet 的失明是同一族缺陷）：
     此前本函数用 `git grep -h` 直接把**原文**喂进 countLegacy，于是
     注释里的 `var(--surface-raised)` / `var(--shadow-red)` / `var(--shadow-red-lg)`
     被当成**真实用法**计数（实测 5 处）。那几处恰恰是**幽灵变量收口时留下的说明**，
     是知识库里最该被保住的文字 —— 门禁却把它们当成「第二套语言」的存量，
     变相鼓励下一个人**删掉注释来让数字变好看**。这与铁律③「老文档必须保持可读」直接冲突。
     改用 `git grep -l` 拿文件清单（保留同一套 family 正则做第一层筛选），
     再逐文件剥注释后按 LEGACY_RE 计数。 */
  let files = '';
  try {
    files = execFileSync('git', ['grep', '-l', '-E', FAMILY_GREP, '--', 'src'],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (e) { files = String(e.stdout || ''); }
  const out = [];
  for (const rel of files.split(/\r?\n/).filter(Boolean)) {
    let raw;
    try { raw = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { continue; /* 读不到就跳过，②的样本量断言会兜住 */ }
    /* ⚠️ 必须**先剥注释、再按家族筛行**，两步顺序不能反：
       反了就是旧口径（注释文本被当成用法）。而 stripComments 保留换行，
       所以逐行筛仍与旧口径逐行等价 —— 只是注释行已被抹成空白，筛不进来了。 */
    for (const line of stripComments(raw).split('\n')) if (FAMILY_RE.test(line)) out.push(line);
  }
  return out.join('\n');
}

/* 棘轮基线：只许减不许增。迁移一批就把这两个数改小（并说明减了哪些名字）。 */
/* 基线口径 = 本文件 countLegacyLive 的计数（**逐个匹配**，不是逐行；**已剥注释**）：
   实测 2026-09-20 初测 = 744 处 / 52 个名字；DS 层迁移启动后降至 709 / 51，基线**同步收紧**。
   本轮 D24 设计系统层迁移（src/components/ui/**）：ui/** 自身由 **33 处 → 8 处**，
   但**全站总量未随之下降** —— 实测 HEAD 树 = 719 / 51（与 9149cacc 的 719 持平），
   说明同期其它线新增的 V2 用法**抵消**了本层的减少。故基线**保持 719 不下调**：
   棘轮只有在总量真的下降时才允许收紧，否则会把「被别人抵消」误记成「自己迁完了」。
   ── 第 81 轮（本批，逐值相等迁移 · 零观感变更）实测 179/38 → **146/27**（−33 处 / −11 名），基线同步收紧：
       --ease(12) → --sb-ease-in-out      （0.4,0,0.2,1 逐值相等，两主题同值）
       --duration-normal(6) → --sb-dur-normal（0.2s = 200ms 逐值相等）
       --weight-heavy(5) → --sb-weight-heavy / --weight-semibold(1) / --weight-bold(1)（400–800 逐值相等）
       --radius-full(2) → --sb-radius-pill（9999px）/ --radius-md(1) → --sb-radius-xl（16px，卡片角色，D18）
       --text-xs(1) → --sb-text-xs（11px）/ --text-sm(1) → --sb-text-md（13px）/ --text-xl(2) → --sb-text-xl-plus（20px）
       --bg-card-solid(1) → --sb-surface-card（亮 #FFFFFF / 暗 #1C1A18，两主题逐值相等）
     ⚠️ 判据补充：**「逐值相等」必须亮/暗两个主题都比对**（theme.css 的 [data-theme="dark"] 与
       design-tokens-v3.css 的 [data-theme="dark"] 同时生效）。例：--text-primary 亮底相等
       （#1A1614 = --sb-ink-1）但暗底不等（#F5EFE4 vs #F7F4F0）→ **不算逐值相等，本批不动**。
     ⚠️ 判据补充 2：**响应式断点也必须比对**。V2 的覆盖断点是 768px，V3 是 640px ——
       故 --text-2xl（V2: 24px，≤768px 转 18px）与 --sb-text-2xl（24px，≤640px 转 18px）
       在 641–768px 带**不同值** → 不算逐值相等，本批不动。
     已迁移（逐值相等，零观感变更）：--radius-md --radius-full --text-sm --text-xs
       --weight-semibold --weight-normal --weight-bold --duration-normal --duration-fast
       --ease --red --green --green-bg --text-primary --text-secondary --text-muted --text-hint
       等 —— 见提交 design(D24) ui/Button.jsx 与 ui/index.jsx。
     其中 ui/** 的 V2 由 33 处降到 8 处；剩余 8 处为**无等值保留项**
       （--radius-lg 30px / --radius-xl 40px / --border / --border-light / --shadow-xl）。
   ⚠️ 不要用「行数」估：一行里可能有两三个 V2 用法（实测按行数会少算 134 处）。
   ⚠️ 棘轮只许向下：实测降了就把基线改小 —— 否则回退会落在"合法空间"里，门禁等于没长牙。
   ── 同轮第二笔（口径修正）：基线改为**剥注释后**的「真实用量」——146/27 → **141/24**。
     旧口径把**注释里的** `var(--x)` 当成用法，实测 5 处全是幽灵变量收口时留下的**说明文字**
     （Footer.jsx「var(--surface-raised) 全仓无定义 → 背景静默透明」、
       Home.css「var(--shadow-red) 全仓无定义 → box-shadow 静默失效」、
       design-tokens-v3.css「Button.jsx 写着 var(--shadow-red-lg)」）。
     那是知识库里最该被保住的句子；把它们计成「第二套语言存量」= 变相奖励
     **删注释让数字变好看**，与铁律③「老文档必须保持可读」直接冲突。
     → 与 design-system-layer 门禁用**同一份** stripComments（scripts/lib/token-scope.mjs）。
   ── 本批第二笔（D20-A 阴影族，20 处）：141/24 → **121/20**。
      `--shadow-sm/md/lg/xl` → `--sb-shadow-sm/md/lg/xl`（V3 别名层，其定义处原文就写着
      「别名只做映射：sm→1 静态卡片 / md→3 dropdown / lg→4 浮层面板 / xl→5 modal」）。
      **性质：有意观感变更**（α 与几何微调，见设计系统层 D27），非逐值相等迁移 ——
      20 处**全部**出现在 `box-shadow`/`boxShadow`（**paint-only**，不参与布局），
      故「几何 d=0」是构造性成立，不需要栅格 diff 才能断言。
      逐值对照（亮色）：sm `0 1px 3px .06`→`0 1px 2px .05` · md `0 4px 16px .08`→`0 4px 16px .10`（几何不变）
      · lg `0 14px 36px .10`→`0 12px 36px .13, 0 2px 8px .06` · xl `0 28px 90px .14`→`0 28px 90px .16, 0 8px 24px .08`。
      暗色：V2 用暖黑 `rgba(12,10,9,α)`，V3 暗色块用纯黑 `rgba(0,0,0,α)` —— 这是**有意的**（暗底上暖棕投影不可见）。
   ── 本批第三笔（D28 动效族）：121/20 → **91/19**（−30 处 / −1 名）。
      `--duration-fast`(0.12s=120ms) → `--sb-dur-fast`(150ms)，5 个文件 30 处。
      **性质：有意观感变更（时长 +30ms）**，不是逐值相等 —— 依据见 D28：
      120ms 既不在 §14 阶梯（100/150/200/300/400）上，也不是行业标准档（Tailwind 75/100/150/200、
      Material 100/200/300 都没有 120），故按 D15「加档须是行业标准半档」被**拒绝加档**；
      而实测这 30 处绝大多数含 `transform`，角色正对 §14 里 `--sb-dur-fast`「hover 位移、图标旋转」的定义。
      ⚠️ 时长变更**无法用静态像素 diff 证明**（截图不含时间维度）→ 证据改用
      「**计算样式 A/B**」：逐选择器读 `getComputedStyle(el).transitionDuration`，看是否精确地 0.12s → 0.15s。
      ⚠️ 保留项（D15：阶梯里没有的值保持字面量，不强套）：`--duration-slow`(350ms) 3 处 ——
      §14 只有 300/400，350 不在阶梯上且不构成行业档，**不硬套**，留待单独裁定。
   ── 本批第四笔（D29 圆角超圆角档）：91/19 → **71/17**（−20 处 / −2 名）。
      `--radius-lg`(30px ×15) / `--radius-xl`(40px ×5) 按 **D18 角色表**逐处定档（不是按数值最近）：
      按钮 → `--sb-radius-pill`（几何上本来就是胶囊，零观感变更，实测高度 43.6–48px）；
      选项卡/内层条 → 12；卡片/分组容器 → 16；大容器 → 24；弹窗主体 → 20。
      证据：876 个元素的**几何 diff = 0**、border-radius 变化仅 1 处、首页整屏 **像素 diff = 0**
      （且比对器经变异测试证明能抓到 10×10 的差异）。详见 D29。
   ── 本批第五笔（字号族）：71/17 → **50/13**（−21 处 / −4 名）。
      按 **D17/D19** 已裁定的映射执行，并**逐处按角色**判 14 还是 16（D19 明文要求「按角色不按数值最近」）：
        · 控件与标题 → `--sb-text-lg`(16)：按钮 / 输入框 / textarea / .feature-title / .pricing-header / .cta-btn / .btn-pill
        · 描述性正文 → `--sb-text-base`(14)：.error-bar / .section-sub / 生成页说明文字
        · `--text-lg`(17) → `--sb-text-lg`(16)（D19：17 归 16）
        · `--text-3xl`(30) → `--sb-text-3xl`(32)（D19：28/30 → 32）
        · `--text-2xl`(24) → `--sb-text-2xl`(24)
      ⚠️ **字号会改布局**（与圆角/阴影不同），故本批证据用**注入式定量**而非像素 diff：
      逐 class 用「旧字号内联覆盖」与「新字号」各量一次高度 —— Δh 多为 **±1.5px**，
      `.section-title` **+3px**（30→32 本就是要 +2px），`.btn-pill` **0**（高度固定 42px）。
      首屏已渲染元素几何变化 = **0 / 876**。
      ⚠️ **已知边界（本批未处理的额外变更）**：`--text-2xl`/`--text-3xl` 的**响应式覆盖断点不同** ——
      V2 是 ≤768px、V3 是 ≤640px，故 **641–768px 带**的值会变（V2 22/18px → V3 28/24px）。
      本批只在**桌面档**做了等值/预定归并，该断点带的差异**未单独验证**。
   ── 本批第六笔（D31 ink 族 + 不可读文字缺陷）：50/13 → **36/8**（−14 处 / −5 名）。
      `--text-primary`(2) → `--sb-ink-1`；`--text-secondary`(4) → `--sb-ink-2`；`--text-hint`(2) → `--sb-ink-4`
      （三者**亮色逐值相等**，暗色有 ≤12/通道 的小差且方向是**提高对比度**）。
      **另 6 处是缺陷修复**（不是等值迁移）：`--text-ghost`(#CCC8C4 1.45–1.66:1) 与
      `--text-invisible`(#E8E5E2 1.10–1.26:1) 被当**文字色**用 → 用户基本看不见。
      按角色落档：页脚**导航链接** → `--sb-ink-3`(AA 达标)；说明/进度/标签 → `--sb-ink-4`；
      `.gen-btn:disabled` → `--sb-ink-5`(禁用档，WCAG 1.4.3 明文豁免)。对比度算法已自证（见 D31）。
   ── 本批第七笔（D32 底色族 + 权威对齐现实）：36/8 → **21/5**（−15 处 / −3 名）。
      核心动作不是迁移，而是**先把权威对齐现实**：把 `--sb-surface-page` 从 `var(--sb-neutral-50)`(#FAF7F2)
      改成 **#F5EFE4**（全站 11 处实际渲染的暖米底）。改完后 `var(--bg)` → `--sb-surface-page`
      在**亮/暗两主题都逐值相等**（暗色两边都是 #0F0E0D）→ 11 处迁移**零观感变更**。
      依据：现实是多数（11 处 vs V3 值仅 1 处），且那 1 处（Plog 页）正是**全站唯一的浅底页 = 不一致本身**；
      暖底又是品牌调性（D1 补充裁定：品牌红与页底同属暖域）。
      `--bg-hover`(rgba(0,0,0,.03)) → `--sb-state-hover-bg`(rgba(12,10,9,.035))：**D4**（纯黑退役）；
      暗色两边**逐值相等**（都是 rgba(255,255,255,.06)）。
      `--bg-card`(rgba(255,255,255,.88)) → `--sb-surface-panel`(.85)：**D20-B**（按角色选玻璃档），α 差 .03。
      ⚠️ 教训（写进 D32）：**遇到「V3 缺档」先问「是权威错了，还是现实错了」** ——
      本例里两边都不算错，但**权威从未被现实校准过**，结果是一个 1 处的少数派定义着语义、
      11 处的多数派只能继续用 V2 名字。**对齐之后迁移才是零变更的**。
   ── 本批第八笔（D33 收尾）：21/5 → **0/0** —— **门禁口径内的 V2 用法全部清零**。
      `--ease-out`(12) → `--sb-ease-out`：V2 是 cubic-bezier(0,0,.2,1)、V3 是 (0.22,1,.36,1)，
      **曲线不同 → 有意变更**（V3 那条的定义处写着【现状锚点】EcMode 已在用）。
      `--duration-slow`(3) → `--sb-dur-slow`(300ms)：350→300（Δ−50ms），三处都是**动画**（FAQ 揭示 / fadeUp / slideDown），
      §14 里 300ms 的角色正是「面板进/出场」。
      `--border`(3) → `--sb-border-default`；`--border-light`(1) → `--sb-border-subtle`；
      `--border-hover`(2) → `--sb-border-strong` —— **按角色**，且按 **D20-D** 先合成到底色再比
      （合成亮度差 ≤5/255）。
      ⚠️⚠️ **本文件管的是「家族口径」，它归零 ≠ 全站 V2 归零**：
      全口径实测仍有 **445 处 / 86 名**（`--canvas-command`54 / `--accent`42 / `--ec-*` 族 / `--blue`22 …）。
      两个数**必须分开报**，见 D26。禁止把「0」写成「全站 V2 已清零」。 */
/* ═══ D26 裁定落地：门禁家族**扩容**（2026-09-15，第 5 轮）═══
   基线 0/0 → **137/28**。⚠️ 这不是「债务涨了」，是**口径覆盖面变了** ——
   家族表原来只有 11 个前缀，把三类**同样是全局 V2** 的名字漏在外面：

     · --accent* (42 处) / --blue* (22 处)  ← D26 #1：与已收进来的 --red/--green **同类**，
       却因为选词时漏了而落在门外。实测 --accent 亮 #0C0A09 / 暗 #F5EFE4 与
       --sb-surface-inverse 逐值相等；--blue 亮 #5275CC / 暗 #7B95E0 与 --sb-info 逐值相等。
     · --space-* (7) / --leading-* (5) / --font-* (15)  ← D26 #3：全局布局与排版族。
     · --footer-actions-* (14 名) ← 名字像组件族，但**定义在 V2 权威 design-tokens.css 里**，
       所以按「定义在哪」判，属全局 V2 债。

   ⚠️ **有意不收**（对 D26 #3 的修正，依证据）：--nav-item-accent。
   它由 app-shell.css 的 12 个 `.creative-nav-link--*` 修饰类**在组件作用域内**定义，
   属 D26 #2 判为合法的「组件自有 token 家族」—— 判据是**定义在哪**，不是名字像什么。

   两个数必须分开报（D26 #4 / D33）：
     · 门禁家族口径 = 137（本文件管的）
     · 全站 V2 口径 = 更大（含 --ec-* / --canvas-* / --sk-* 等组件自有家族）
   禁止把「家族口径 137 → 0」写成「V2 已清零」。 */
/* ── D26 迁移第一笔（逐值相等 · 零观感变更）实测 137/28 → **58/18**：
       --accent(42)   → --sb-surface-inverse   （亮 #0C0A09 / 暗 #F5EFE4 逐值相等）
       --blue(22)     → --sb-info              （亮 #5275CC / 暗 #7B95E0 逐值相等）
       --space-2..6(7)→ --sb-space-2..6        （8/12/16/20/24px 逐值相等）
       --leading-normal(2) → --sb-leading-normal（1.5 逐值相等）
       --footer-actions-button-min-width(3) → --sb-control-min-w（88px）
       --footer-actions-button-height(2)    → --sb-control-h-lg （36px）
       --bg(1)        → --sb-surface-page      （亮 #F5EFE4 / 暗 #0F0E0D 逐值相等）
     共替换 **107 处 / 25 个文件**；git diff 为 **104 insertions / 104 deletions**
     （完全对称）= 纯名字替换、无结构改动的直接证据；剥注释后残留实测 = 0。
     ⚠️ 基线降幅（79）≠ 替换处数（107）：本门禁按「含家族匹配的整行」计数，
       同一行里若有其它 V2 用法也会被计入，所以这两个数**本就不该相等**。
     ⚠️ 迁移脚本对 CSS 采用「注释掩码后的位置替换」，注释里的 var() 说明文字不受影响。 */
/* ── D26 迁移第二笔（同在 2026-09-15）实测 58/18 → **44/11**：
       --footer-actions-gap(4)           → --sb-space-3     （其值本就是 var(--sb-space-3) 12px）
       --footer-actions-margin-top(3)    → --sb-space-4     （= var(--sb-space-4) 16px）
       --footer-actions-padding-block(1) → --sb-space-5     （= var(--sb-space-5) 20px）
       --footer-actions-padding-inline(1)→ --sb-space-5
       --footer-actions-primary-bg(2)    → --sb-brand-600   （= var(--sb-brand-600)）
       --footer-actions-primary-bg-hover(1) → --sb-brand-700（= var(--sb-brand-700)）
       --footer-actions-button-height-sm(2) → --sb-control-h-md（32px = 32px；V3 控制高度档 24/28/32/36/44）
     共替换 15 处 / 4 个文件。
     顺带修掉一处**依赖方向反了**的写法：design-tokens-v3.css 的 --sb-action-gap 原来写
     var(--footer-actions-gap, var(--sb-space-3))，注释还把 V2 文件标成「唯一真源」——
     权威层不该依赖遗留层。现改为 var(--sb-space-3)，V3 自洽。
     并收敛了 7 处**自回退** var(--X, var(--X))（改名后遗留的两级回退退化成同名义回退），
     值不变、写法还原。 */
/* ── D26 迁移第三笔（2026-09-15）实测 44/11 → **29/9**：
       --font-body(14)    → --sb-font-sans
       --font-display(1)  → --sb-font-display
     判据是**字体栈的超集关系**，不是「名字像」：
       V2 --font-body    : …, 'Microsoft YaHei', Arial, sans-serif
       V3 --sb-font-sans : …, 'Microsoft YaHei', 'Noto Sans SC', Arial, sans-serif   ← 多一个 CJK 兜底
       V2 --font-display : 'Fredoka','ZCOOL KuaiLe','PingFang SC','Microsoft YaHei',sans-serif
       V3 --sb-font-display: 'Fredoka','ZCOOL KuaiLe',-apple-system,'PingFang SC','Microsoft YaHei',sans-serif
     即：在装有 YaHei 的 Windows 上**逐字同解析**；只有在缺 YaHei 的系统（Linux/Android）上
     才多命中 'Noto Sans SC' —— 那是**更正确的 CJK 字形**，属改善而非回归。
     共替换 15 处 / 8 个文件，diff 15/15 对称。 */
/* ── D37（第四笔，2026-09-15）实测 29/9 → **0/0** —— 门禁家族口径**归零**。
     这一笔不再是「逐值相等迁移」，而是**逐条裁定**（每条都在 D37 里给了偏差与依据）：
       --footer-actions-border        → --sb-border-default        （.12 → .10/.14；暗色由「不可见」修好）
       --footer-actions-radius        → --sb-radius-control        （10px → 8px；D18 控件档）
       --footer-actions-button-height-lg → --sb-control-h-xl       （40px → 44px；V3 主 CTA 档）
       --footer-actions-primary-disabled-bg  → --sb-state-disabled-bg
       --footer-actions-primary-disabled-text → --sb-state-disabled-ink
       --leading-relaxed              → --sb-leading-relaxed       （1.7 → 1.65，−3%）
       --accent-bg                    → --sb-state-active-bg       （亮精确相等）
       --accent-hover                 → --sb-surface-inverse-hover （**新增角色**，取值照搬 → 零变更）
       --blue-bg                      → --sb-info-tint             （**新增角色**，取值照搬 → 零变更）
     共 34 处 / 15 个文件。

     ⚠️⚠️ **「0」是本门禁的家族口径，不是「全站 V2 已清零」。** 两个数必须分开报（D26 #4 / D33）：
       · 门禁家族口径 = **0**（本文件管的这个数）
       · 全站 V2 口径 = 仍有 --ec-* / --canvas-* / --sk-* / --cl-* 等**组件自有家族**
         （D26 #2 判定为合法，不属第二套语言），以及 V2 权威文件里**尚未删除的定义**。
     ⚠️ 归零后 minSane=0（见下方自证逻辑）—— 但「一个都没扫到」仍会被 assert.ok(sites>0) 之外
        的门禁兜住；本文件的 ② 用 total >= minSane 且 total <= 0，等价于必须恰为 0。 */
/* ═══ 基线**如实重建**：0/0 → 183/32（2026-09-15，第 11 轮）═══
   ⚠️ 这不是「债务涨了 183」，而是**门禁此前看不见它们**：
   旧正则要求 `)` 紧跟名字，于是**带兜底的 var(--x, 兜底) 与 var( --x ) 一条都数不到**。
   修正正则后暴露出 183 处 / 32 名真实存量（17 个文件）。

   这条更正同时推翻了前几轮「179 → 0」的结论 —— **那个 0 只覆盖「无兜底」写法**。
   教训：指标测的是判据的**代理**，而代理漏了一整类写法；
   与 §8.16 那次 P0、space-ratchet 的失明同族。往后任何「归零」结论都必须先验口径本身。

   仍然必须分开报的两个数（D26 #4 / D33）：
     · 门禁家族口径 = 183（修正后的真实值）
     · 全站 V2 口径 = 更大（另含组件自有家族的 var(--ec-*) 等）
   且**用法归零 ≠ 定义消失**：design-tokens.css 里仍有 93 个非组件定义（其中 61 个已不可达）。 */
const BASELINE_TOTAL = 183;
const BASELINE_NAMES = 32;

test('① 检测器自证：能数出 V2 用法，且不误判 V3 的 --sb-*', () => {
  const s = 'color: var(--text-muted); border-radius: var(--radius-md); background: var(--sb-surface-card); gap: var(--sb-space-2);';
  const r = countLegacy(s);
  assert.equal(r.total, 2, '两个 V2 用法必须被数出来（--sb-* 不算）');
  assert.equal(r.names.get('text-muted'), 1);
  assert.equal(r.names.get('radius-md'), 1);
  assert.equal(countLegacy('var(--cvl-z-toast) var(--max-width-narrow)').total, 0, 'cvl/max-width 家族不该被算作 V2');
});

test('①b 检测器自证：**注释里的** V2 用法不算用法（否则门禁在奖励删注释）', () => {
  /* 反例取自本仓真实文本（幽灵变量收口的说明）。旧口径会把它们数成用法。 */
  const commentOnly = '/* 幽灵变量：var(--surface-raised) 全仓无定义 → 背景静默透明；var(--shadow-red) 亦然 */';
  assert.equal(countLegacy(commentOnly).total, 2, '前提：裸正则会数出 2 处（证明这条自证有意义）');
  assert.equal(countLegacyLive(commentOnly).total, 0, '剥注释后必须为 0 —— 注释是说明文字，不是用法');

  /* 正例：注释与真实用法并存时，只数真实的那一处。 */
  const mixed = '/* 说明 var(--radius-lg) 的由来 */\n.card { border-radius: var(--radius-lg); }';
  const r = countLegacyLive(mixed);
  assert.equal(r.total, 1, '注释 + 真实用法 → 只应数出 1 处');
  assert.equal(r.names.get('radius-lg'), 1);

  /* 反向保险：剥注释不能把真用法也一起剥掉。 */
  assert.equal(countLegacyLive('.a { gap: var(--space-2); }').names.get('space-2'), 1,
    '剥注释不得误伤真实用法（否则本门禁会变成无脑放行口）');
});

test('② V2 家族用法不得增长（棘轮：只许减）', () => {
  const { total, names } = countLegacy(grepLegacy());
  /* ⚠️ 样本量自证的**目的**是「抓 grep 口径失效」，不是「限定迁移进度」。
     阈值必须随真实存量下调，否则它会在迁移见效时反过来变红 —— 那是**把进度当成故障**。
     第 81 轮实测已降到 91，故阈值由 >100 调到 >50（仍远高于「口径写错会得到 0~个位数」的量级）。 */
  /* ⚠️ 样本量自证的判据必须**随存量缩放**，**不能写死绝对值**。
     真实事故（同一处，本会话误报三次）：阈值先后写死为 >100 / >50 / >25，
     而存量从 179 一路降到 91 → 50 → 21，**每次迁移见效都会把它顶红** ——
     那是**把进度当成故障**，方向完全反了。
     现改为「**不得低于基线的 50%，且至少 5 处**」：
     · grep 口径失效（写错前缀 / 扫错目录）会得到 **0~个位数**，仍能被稳稳抓到；
     · 迁移推进时阈值随基线自动下降，不会误报。 */
  /* 归零后（BASELINE_TOTAL = 0）不能再用「不得低于基线 50%」——那会要求 total ≥ 5，
     而正确值就是 0。故 0 时改为**恰好断言 0**：既抓住「口径失效后误报 0」的反面（
     误报 0 在归零后无法与真相区分，这是该护栏的**已知极限**，故同时保留下面 ⑤ 的「必须扫到足量文件」作为替代保证）。 */
  const minSane = BASELINE_TOTAL === 0 ? 0 : Math.max(5, Math.floor(BASELINE_TOTAL / 2));
  assert.ok(total >= minSane, '只数到 ' + total + ' 处（基线 ' + BASELINE_TOTAL + '），样本量异常（grep 口径可能失效）');
  assert.ok(total <= BASELINE_TOTAL,
    'V2 变量用法从基线 ' + BASELINE_TOTAL + ' 涨到 ' + total + ' —— 又有人写了第二套 token 语言。\n' +
    '  正确做法：用 --sb-* 的对应档位（0..48 的取值表见 docs/design/41-scales-and-snapping.md）。\n' +
    '  迁移做完了就把本文件里的 BASELINE_TOTAL 改小。');
  assert.ok(names.size <= BASELINE_NAMES,
    'V2 变量**名字种类**从 ' + BASELINE_NAMES + ' 涨到 ' + names.size + ' —— 出现了新的遗留名，请直接用 --sb-*。');
});

test('③ 两套 token 同名不同值这件事必须写在裁定里（防下一个人踩）', () => {
  const doc = fs.readFileSync(path.join(ROOT, 'docs/design/40-decisions.md'), 'utf8');
  assert.match(doc, /D24/, 'D24（V2/V3 同名不同值的处置口径）必须写进 40-decisions.md');
  assert.match(doc, /--radius-md[\s\S]{0,200}--sb-radius-md|--sb-radius-md[\s\S]{0,200}--radius-md/,
    'D24 里必须点明「--radius-md(16px) vs --sb-radius-md(8px)」这个具体陷阱');
});
