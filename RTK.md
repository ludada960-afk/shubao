# 薯包 AI 长期协作协议

本文件是 Codex、GLM 和后续自动化代理的唯一协作入口。开始任何开发、集成、提交或部署前，必须完整读取本文件。

## 1. 单一事实源

- 产品规格：`docs/superpowers/specs/`。
- 已批准实施计划：`docs/superpowers/plans/`。
- 当前执行进度：`.superpowers/sdd/progress.md`。对话压缩、任务恢复或换模型后，以 Git 提交和该账本为准，不重新执行已完成任务。
- 生产部署入口：`scripts/deploy-production.ps1`。禁止手工覆盖线上目录。

## 2. 隔离工作区与文件所有权

- Codex 核心工作区固定为 `F:/da/shubao/.worktrees/codex-ecommerce-stability`，分支固定为 `codex/ecommerce-stability`。
- 主工作区 `F:/da/shubao` 只用于读取、Git 编排和最终集成；另一个 AI 正在运行时禁止直接修改主工作区。
- GLM 必须使用独立 worktree 和独立分支，只能修改任务明确列出的文件。未列出的文件默认由 Codex 所有。
- 两个代理不得同时修改同一文件或同一业务边界。GLM 完成后只提交 commit hash、变更文件和测试结果，由 Codex 审核后 cherry-pick；GLM 不部署。
- 每次分工都要把双方文件范围写入 `.superpowers/sdd/progress.md`，检测到交叉时先停止集成，不覆盖任何一方修改。

## 3. 固定 Git 命令

Codex 从 `F:/da/shubao` 执行 Git 时，必须使用以下已批准前缀，不得改成绝对 `-C` 路径，也不得省略 `safe.directory`：

```powershell
git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability
```

提交必须显式列出文件，禁止 `git add .`、`git add -A`。每个可独立验证的任务一个提交，提交前运行对应测试并检查暂存区。

### 3.1 提交纪律（2026-09-20 事故后补，**6 条线共 1 个 git index，必须遵守**）

多条线共用同一棵工作树、**共用同一个 Git 暂存区（index）**。因此：

1. **一律 pathspec 提交**：`git commit -m "..." -- <文件1> <文件2>`。
   **严禁裸 `git commit`** —— 它提交的是**整个暂存区**，会把别人 `git add` 进去、还没提交的内容一起定型。
   （已发生：`614698e9` 一次卷进 4 个他人文件、25 个文件；`ebea1cd0` / `1fed0552` / `fc843f19` 同类。）
2. 严禁 `git add .` / `git add -A` / `git commit -a` / `git stash`。
3. 提交前 `git diff --cached --name-only` **逐条确认只有自己的文件**；提交后 `git show --stat` 核对文件数，并把数字贴进汇报。
4. 别人的 ` M`（dirty）文件一律不碰；发现暂存区里有他人内容，**只用自己的 pathspec 隔离提交**，绝不代他们提交、也不 reset 他们的暂存。
5. 需要 A/B 对照时用**文件级备份**，不要用 stash。
6. 报「主干红了 / 某文件坏了」之前**必须重跑一次** —— 并发写入的瞬时中间态被误报成故障，已发生多次。
6b. **pathspec 提交只隔离「文件」，不隔离「文件内的 hunk」** —— 这是最容易误判的一条。
   `git commit -- <路径>` 提交的是**暂存区里该路径的内容**。如果这个文件同时也被别人 `git add` 过，
   你会把**他们暂存的改动一起定型**。真实事故：字号批的 `3f70d57b` 提交 `EcCanvas.css` 时，
   把画布线**已暂存未提交**的 `left: 50vw` + 删 `min()` 一起带了进去 —— 画布的修复「半截进库」
   （剩下一半「内容层加 clip」没进），造成窄屏下工具条被裁。而当时双方都以为对方改错了行。
   → 正确做法：提交前 `git diff --cached -- <你的文件>` **逐 hunk 读一遍**，每一行都必须是你写的；
     发现夹带就只为自己真正改的部分另建提交（隔离暂存法：把 HEAD + 仅自己的映射写盘 → `git add` → 还原他人改动）。
   → **不要因为「文件被改坏了」就去怀疑某条线在做整文件重写**：先查 index。

7. **并发工作树里，绝对不要用「文件级 diff 快照」当备份再回放。**
   快照会**冻结别人尚未落地的中间态**，回放它 = 把别人**已提交**的改动一并回退。
   真实事故：某线的 hover 批次用了一份「D19 半像素迁移落地之前」的文件快照回放，
   一次性把别人已落地的 73 处字号迁移退回了半像素（提交 `--stat` 是 215 插入 / 91 删除，
   远超「只加 hover」应有的量 —— **提交前看 `--stat` 的量级就能发现**）。
   → 正确做法：① 只保存**自己新增的那一段文本**；② 或者**先把自己的改动提交掉**再做别的事；
     ③ 提交前用 `git show --stat` 核对插入/删除量级是否符合本次改动的性质。
8. **迁移类改动提交前跑一次越界自检**：
   `node scripts/migration-scope-audit.mjs --staged`
   原理是把「尺度类属性的值」抹平后比对 `-`/`+` 两侧 —— 应当逐字相同，不同即越界。
   真实事故两次：① 字号迁移顺手把 `left: 50%` 改成 `50vw` 并删掉回夹（那是「用户提了 4 次」的修复代码）；
   ② 字号落档把「推荐档价格」从 40px 降到 32px，而普通档基准是 36px → **主次做反**。
9. **跨线交叉改写是最大的风险源**：同一个文件被两条线交叉改写时，**任何一方的修复都活不过一轮**。
   处置：**冻结目录**（已实践：`src/pages/EcCanvas/**` 曾被三条迁移线同时改写，画布的修复被撞掉三次；
   下令冻结后修复一次落地）。宁可让一条线等一轮，也不要两边互相覆盖。
10. **契约测试锁的必须是判据，不是写法。**
   真实事故：底部操作栏的居中测试曾断言「必须有 `min()` 回夹」——
   而实测证明那个 `min()` 正是窄屏偏移的根因。**测试当时在保护 bug。**
   写法（用哪个函数/表达式）可以换；判据（居中 + 不被裁）不能换。
   → **推论（2026-09-20 画布线实操总结，已成为硬要求）：写完契约必须做一次「变异测试」** ——
     把**已知的错误实现**放回去，确认契约**会红**；不红的契约等于没写。
     实测例：把底栏 CSS 改回旧的 `min()` 回夹写法 → 实机契约立刻报
     `1024px panel=true：中心偏差 84.00px > 1px`（与手工实测逐位吻合），恢复后 8/8 全绿。
   → 对**静态断言**尤其重要：静态断言只能守「有没有调用权威」，**守不住「坐标算得对不对」** ——
     后者只能靠实机契约 + 变异测试。
11. **不要把重要修复留在工作区「攒批」** —— 未提交的改动会被别人的 pathspec 提交带走。
   真实事故：token 去重修复（删 ≤640px 重复 `:root` 块 + 删重复的 a11y hover 段）在工作区停了一整轮，
   另一条线为改同一个文件跑了 `git add -- src/styles/design-tokens-v3.css`，
   → 我的两个 hunk **被卷进他们的提交** `193c4155`（提交信息完全驴唇不对马嘴，事后才能靠 `git show <hash> -- <file>` 认领）。
   → 处置：① 修完**立刻提交**，不要等「一起交」；② 被卷走时**绝不 revert**（revert 会连带删掉对方的内容）——
     先 `git show <hash> -- <file>` 逐字节核对自己的内容是否完整，只补提缺的部分。
12. **`git write-tree` + `commit-tree` 不是隔离手段**（曾有报告建议改用此法，那是**反的**）。
   `write-tree` 写的是**整个共享暂存区** —— 别人 `git add` 进来还没提交的内容会**一起进树**，
   比裸 `git commit` 更隐蔽（它绕过了 `git commit` 自带的暂存区检查）。
   真正的隔离只有一条：`git commit -F <msg> -- <文件…>`（git 内部用**临时索引**，只取指定路径的工作区内容，
   其余已暂存内容**原样留在暂存区不被动**）。
   确有理由用 write-tree 时，必须把 `GIT_INDEX_FILE` 指向**自己的临时索引文件**，绝不能用默认 `.git/index`。
13. **禁止用「离线生成 patch 再 `git apply`」做批量改写 —— 也不要用任何"过期快照"当输入。**
   真实事故（`7a807673`，D18 批6，全站最严重的一次）：改写脚本用的 `.css-map.json` **中途被重扫过**，
   patch 的上下文行与文件现状对不上 → `git apply --cached` **把 2650+ 行当作删除应用**：
   `Home.css` 3585 → 935 行、`EcStudio/index.jsx` 1404 → **1 行**、`EcMode.jsx` 1634 → 1382 行，涉及 37 个文件。
   后果：`npm run build` 报 `Unterminated string literal` —— **站点起不来**，而 `npm test` **全绿**。
   → 处置：批量改写**直接在文件上原地改值**（上下文精确匹配），不要绕道 patch；
     每批**提交前必须跑 `npm run build`**（**单测全绿 ≠ 能构建**）；
     提交后用 `git show --numstat` **逐文件核对**：出现「删除行数 >> 插入行数」立刻停下查
     （本次 `-3335` 就是这么暴露的）。
   → 新增门禁 `test/source-syntax-integrity.test.mjs`：每个源文件必须能被 esbuild 解析 + CSS 花括号配平
     + 「60KB 只有 1 行」判为损坏。

14. **绝不要用 PowerShell 的 `Set-Content` / `Out-File` 管道写源码文件。**
   真实事故（我自己的，10 分钟内发生两次）：用 `git show HEAD:<file> | Set-Content -NoNewline <file>` 恢复文件，
   结果 PowerShell 把**管道里的字符串数组当成无分隔符拼接** → **整个 1388 行的文件被压成 1 行**，
   比原来的损坏更糟。同类报告：`Out-File` 还会改编码/换行（CRLF/BOM）。
   → 修文件只用两种方式：**`edit` / `write` 工具**，或 **Node `fs.readFileSync` + `fs.writeFileSync` 逐字节**
     （取原始内容用 `execFileSync(..., { maxBuffer })`，不要过 shell 管道）。
   → 恢复文件后**必须验证**：行数、首行、`git diff --numstat`；
     再用 `node --test test/source-syntax-integrity.test.mjs` 确认没有被压平。
   → **同类坑：行尾**。本仓源码统一 **LF**（无 `.gitattributes`），而 Windows 工具很容易写出 **CRLF**。
     真实事故：一次文案修复把 8 个插件文件**每一行**都变成 CRLF（`git show <parent>:<f>` 里 CRLF=0 → 提交后 503），
     造成「1646 插入 / 1486 删除」的假噪声，遮蔽了真实改动（真正的内容改动只有 13+25 行）。
     → 判定法：`git show <parent>:<f> | CRLF 计数` 与提交后对比，**从 0 变正数 = 整文件行尾被改写**；
     → 交付前用 `git show --numstat`：**插入≈删除且等于文件总行数** = 行尾或编码被整体改写，必须还原。

### 3.2 迁移等价性（D15，与 40-decisions.md 同步）

> **token 只能替换与之逐值相等的字面量。** 近似值一律不许机械替换。

- 间距/字号/圆角/颜色**都是观感**：差 1px 就可能换行、错位；差 1 个色阶就是另一个颜色。
- 阶梯里没有的值**保持字面量**；要收编先把它**加进阶梯**（加条目本身零观感变更），再做等值迁移。
- 这类回归**不会让任何测试变红**（没有断言锁间距），只能靠两个脚本抓 —— **两者都必须跑**：
  - `node scripts/space-migration-audit.mjs --base=<开工前的HEAD>`
    —— 查「有没有用不逐值相等的 token」；实测抓出 **85 处**（`12px→20px`、`4px→8px`、`6px→8px` …）。
    看的是**净效果**（整段当一个 patch），不是逐 commit —— 逐 commit 会把「已回退的错误」算成本现存问题。
  - `node scripts/space-ratchet.mjs`（默认基准 HEAD）
    —— 查「解析出来的像素值有没有变」。**token 名可以变，值一个都不许变**。
    最有用的一问：「我这次改动把哪些尺度值改了？」
  - 三者口径：**加阶梯条目（如 2/6/10px 半档）= 零观感变更，可以直接做；
    把非阶梯值硬套到阶梯 = 改观感，必须单独裁定 + 像素 diff。**
- 迁移类提交必须附：**改前→改后数值清单** + **分区段像素 diff**（未改动区域必须 d=0）。

## 4. 运行时边界

**包管理器双态（2026-08-25 裁决）**：本地 node_modules 为 pnpm 安装态（pnpm-lock.yaml / pnpm-workspace.yaml 已入库）；生产 deploy 链唯一走 npm（package-lock.json，server 端 npm ci 要求与 package.json 同步）。allowBuilds 显式关闭了 canvas / better-sqlite3 / esbuild / protobufjs 的构建脚本——新环境 pnpm install 后 canvas.node、better_sqlite3.node 缺失属预期，需进包手动执行安装脚本（canvas: npm run install 即 prebuild-install）。长期收敛为单管理器需协调重装，未获授权前勿单方面切换。

以下内容永远不进入提交：

- `dist/` 构建产物；部署时由 `npm run build` 重新生成。
- `server/works.db`、`server/works.db-shm`、`server/works.db-wal`。
- uploads、cache、generated-assets、temp_uploads、日志、环境变量和密钥。

`.gitignore` 只对未跟踪文件生效；如果上述文件历史上已被跟踪，必须从 Git 索引解除跟踪但保留本地文件。不得为了清理状态删除用户或生产数据。

## 5. 每次恢复工作的固定顺序

> **2026-09-20 起，第 0 步：读 `docs/HANDOFF-design-system.md`**（设计系统会话交接，约 10 分钟）。
> 它一次性交代了：**用户是谁、他要什么、四条产品铁律、项目与技术栈、这棵树的脾气（16 条提交纪律摘要）、
> 设计系统现状（token 权威 / 裁定 D1–D24 / 12 条门禁 / 4 条棘轮）、当前进度与剩余待办的逐条诊断、已知坑清单**。
> 不读它 = 会重复别人已经踩完的坑。

1. 读取 `AGENTS.md`、本文件、当前规格、实施计划和 `.superpowers/sdd/progress.md`。
2. 运行 `npm run collab:check`，确认 linked worktree、`codex/` 分支、无被跟踪运行文件、无跨代理文件冲突。
3. 使用固定 Git 前缀检查 `status` 和最近提交；账本标记完成的任务不得重复执行。
4. 按计划使用 TDD：先看到目标测试失败，再实现，再运行聚焦测试和回归测试。
5. 每个任务完成后提交、独立复审，并把 commit 范围、测试和遗留项写入进度账本。

## 6. 沟通与交接

- 用户要求完整交付时，持续执行到计划中的自然里程碑，不因完成一个小步骤就停下来询问是否继续。
- 只有出现需要新权限、不可逆操作、产品方向冲突或连续三次无法解除的外部阻塞时才暂停询问。
- 中途状态只记录到进度账本；最终报告必须包含：实现范围、测试证据、提交、部署版本、线上验证、遗留风险。
- GLM 交接格式固定为：worktree、branch、base commit、head commit、精确文件列表、测试命令与输出、已知问题。缺一项不得集成。

## 7. 部署与回滚

- 只有 Codex 完成全分支审核、测试和构建后可以部署。
- `scripts/deploy-production.ps1` 必须取得远端部署锁，避免两个代理同时覆盖生产；部署完成或失败都要释放部署锁。
- 部署前备份服务器代码、WebRoot 和数据库状态；部署包排除运行时数据库、上传和缓存。
- 部署后必须验证 PM2、健康接口、首页 bundle、关键 API、真实生成任务、账务冻结/结算/释放及作品稳定 URL。
- 任一关键验证失败立即停止继续发布，使用部署备份回滚，保留日志用于根因分析。

## 8. 当前长期分工

- Codex：核心架构、数据库、账务、模型路由、任务恢复、质量门、生产集成和部署。
- GLM：独立且无副作用的展示组件、静态样式和纯函数；不得修改服务端、路由、AppContext、数据库或部署脚本。

## 9. Codex 桌面对话故障恢复

- `Upstream provider request failed`、任务状态 `systemError`、或连续两次发送消息却只留下用户消息而没有助手输出，优先视为 Codex 客户端/上游对话故障，不得归因于项目代码，也不得继续反复点击“继续”。
- 新对话必须回到本文件规定的 Codex worktree 和分支，依次读取 `AGENTS.md`、本文件、当前规格、实施计划与 `.superpowers/sdd/progress.md`，再运行 `npm run collab:check` 和固定 Git 前缀的 `status` / `log`。
- Codex 桌面任务记录可读时，只读取故障对话最后一个完整完成的回合来辅助恢复；聊天内容不是事实源。恢复结论必须由 Git 提交、工作区 diff、测试输出和进度账本交叉验证。
- `AGENTS.md` 和本文件只保存跨任务稳定的规则；具体提交、测试、脏文件、未知项和下一步统一写入 `.superpowers/sdd/progress.md`，避免超长聊天成为唯一记忆。
- 恢复快照必须明确记录：故障任务、最后可信提交、已验证测试、当前未提交文件、尚未拿到的评审结论，以及唯一下一执行边界。任何未捕获的旧对话结果都按“未知/待重验”处理。
- 在新对话确认恢复快照与 Git 一致前，不归档或删除故障任务；确认后也不再向故障任务发送工作指令。

## 10. 用户长期产品与交付偏好

- 任何电商生成、设计方案、无限画布或导出能力的修改，都必须先画清完整影响链：输入事实、第二步设计方案、逐张规划、服务端生成计划、画布展示、再次编辑、导出、作品归档与线上恢复；不得只修截图中的单点。
- 产品判断同时采用资深电商卖家、电商美工、产品经理和架构师视角。信息完整性、商品真实性、平台交付习惯、操作效率、视觉密度、异常恢复和长期维护成本都属于验收范围。
- 优先保持已正确的用户素材。合规白底图不得添加阴影或重新造型；透明图必须是真透明、边缘干净、商品完整。SKU 或多规格展示必须使用已确认的规格、尺寸、容量、材质等差异事实，不允许模型猜测。
- “合成长图”固定指把选中的生成详情图按明确顺序统一宽度、纵向无缝拼成一张可滚动预览的详情长图，不等同于图层对齐、打组或普通合并。
- 用户授权完整交付时，Codex 应自主完成备份、实现、全量回归、桌面与移动端浏览器验收、部署及线上验证；除新权限、不可逆风险或无法自行解除的外部阻塞外，不在中途反复询问。

## 11. 最近发布快照
- 2026-09-11（六轮），用户拍板「全上」：视频模型公开档 **3 → 10**，已由 9bfa8cee 发布至 https://shuimg.cn/
  （线上实测 10 档：快试 27 / 标准 46-57 / MiniMax768P 38 / Grok 7-9 / 万相 4 / 可灵 16 /
 可灵Pro 32 / Veo 11 / Seedance2.5 43 / MiniMax2K 65 积分）。全量 3123/3123 + build 绿。
  - 价目口径统一：IP233 权威价目（`GET /api/pricing`，86 个有报价视频模型，见
    docs/research/ip233-model-pricing-20260911.md），用户价 = 成本/(1−54%)，units = priceCny×3819
    向上取整并保证「积分面值 ≥ 现金价」；22 个 video SKU 全部过毛利地板（警示见下）。
  - **上一轮我给用户的建议表有算错**（把按秒成本当按条算）：Veo 曾写 17 积分(应 11)、万相写 10(应 4)、
    Seedance2.5 写 24(会亏，应 43)、可灵Pro 写 21(毛利仅 30% 破地板，应 32)、Grok 写 8(应 7)。
    已按正确口径落地并向用户如实交代。
  - **MiniMax H3 2K 成本口径更正**：0.76 → ¥5.85/条（原为 poke 中转价，IP233 价目为准）；原 ¥14.9
    只剩 57.8% 跌破高端带 70% 地板 → 改判 ¥16.9/65000 units 归主力带（60% 地板，实测 62.6%）并开公开。
  - 路由修复：候选排序改「可用性优先」（时长/模式/清晰度/素材不满足的档位不再排第一，避免点下去才报
    不支持）；公开投影 long 档不再写死 9 秒（Veo 上限 8s 会抛错）。
  - 遗留：**仍需一把可用 LLM key**（DeepSeek 401），文案/策划/分析全链路受影响；各新档能力口径取保守值
    （仅 720P、单图参考、无参考视频），已写进 limitations，后续可按小流量验证放宽。
- 2026-09-11（五轮），五轮批注已由 4838904a 发布至 https://shuimg.cn/：
  - **视频生成失败 P0（用户："视频生成流程为什么会说请求失败"）**：根因 = 视频「方案分析」被路由到
    识图模型 gpt-5.6-luna（实测 90s 超时），而**文本 LLM key 已失效（DeepSeek 401）**没有快速通道。
    修复：无图走文本模型(30s)/有图走识图模型(45s)、不再重试；失败时 videoPlanning 产出**本地兜底方案**
    （四段式结构 + 诚实标注 degraded/risks），不阻塞生成；兜底不扣费（模型没跑就不收 1 积分）。
  - **MiniMax 接入**：IP233 实测 /v1/models 返回 124 个模型、单 key 全覆盖（无需新 key）。已上架
    **MiniMax H3 768P**（按条 ¥4.55 → 38000 units / ¥9.9 / 毛利 54%，支持 文生/图生/多模态/首尾帧）。
    公开视频产品 2 → 3（27/46/38 积分）。
  - **技能库**：内置技能可直接「使用」（不再强制派生副本）、提示 4s 自动消失可关闭、弹窗 1440×88vh 三列吃满。
  - **视频页**：模型控件与其它配置按钮同款两行结构、同高。
  - 遗留：**需要一把可用的 LLM key**（现有 DeepSeek key 401，影响 文案/策划/分析 全链路）；
    待用户拍板再接入的候选：Kling 3.0/Pro ¥1.82/3.77、Grok Imagine Video ¥0.104/秒、Wan 3.0 ¥0.455/秒、
    Seedance 2.5 系列、MiniMax H3 2K/4K。
- 2026-09-11（四轮），四轮批注已由 c2671446 发布：视觉方向面板整体并入技能库（点开即技能库，
  弹窗做宽 1360×78vh、顶部让开导航）；技能正文改「英文原参数 (中文翻译)」并清除内部说明文字；
  首页「下一步」改单按钮 + 二选一浮层；**修 P0 页面锁死**（弹窗/面板滚动锁改共享计数 + 首快照，
  叠开不再把 body 永久 hidden）；画布节点只留「加入素材库」、左加号与右加号同功能、
  「模板广场」与「工作流模板」合并；视频页技能库升为一级入口。全量 3124/3124 + build 绿。
- 2026-09-11（三轮），三轮用户批注已由 e1e3024d + 9c90aa0a 发布至 https://shuimg.cn/
  （frontend 档零付费 canary；全量 3124/3124 + build 绿）。核心：
  - **P0 画布白屏**（用户报"画布又打不开了"）：上一轮把技能库回调插在 showToast 声明前 →
    TDZ 崩整页；移到位后 Playwright 实测 ?qa=ec-canvas 正常开屏（canvas:true/6 节点/零报错）。
    教训：6800 行单文件里新增 useCallback 必须放在其依赖 (showToast 等) 之后。
  - **画面风格 = 技能库唯一真源**：StylePanel 自建 STYLES 真源删除（仅留接口不可用兜底），
    卡片由 /api/skills?kind=image 驱动；技能库入口从输入框右侧移入「视觉方向」面板；
    任务型技能可叠加。「避免出现的元素」迁到「生成设置」。
  - **技能库双语 + 扩容**：5 风格技能正文改「中文说明 + EN 原始参数」，新增 5 个任务型生图
    技能，内置 12（10 图 + 2 视频）。
  - **全面板滚动锁定**：新 hook usePanelScrollLock（面板打开锁页面 + 滚轮只滚面板），
    已接电商生图/自由创作；**顶部导航**单阈值改迟滞 (>64 收 / <24 展) + rAF 去抖；
    **自由创作**面板高度 720/620/740 且可越过触发条（实测 396→620px），面板头图标与触发按钮统一。
  - **视频生成页与电商生图统一**：未确认方案只留 1 个主 CTA（分析并生成方案·1 积分），
    确认后「查看方案」+「开始生成」；@ 引用素材移入输入框一行（工具栏去重）；技能库进生成设置面板。
- 2026-09-11（二轮），9-11 二轮用户批注①-⑨ 已由 ed4c39a8 + e1377172 发布至 https://shuimg.cn/
  （frontend 档，零付费 canary；全量回归 3124/3124，生产构建绿；线上 /health ok、
  /api/billing/rules 含 ec_tts_voice(0.5 积分/条)+ec_direction_refresh(1 积分/条)、入口
  bundle index-CjLK-iH_.js、画廊 117 图 + 视频契约 2 公开产品通过）。提交栈（本轮）：
  - ed4c39a8 素材/作品逻辑：上传/替换不再自动进素材库（去「后台保存原图」机制），新增
    工具条「加入素材库」(save-to-assets, 仅就绪带 url 素材/媒体可点)，生成物 register-generated
    自动归集保留；「重试扫描」2 连败移出死记录。② 点空白同时收起右栏。③ 加号与连线端点
    真重叠(删 media 节点 -17px 垂直偏移)。④ 替换后节点框随新素材宽高比自适应 + 本地 data URI
    预览兜底到持久图解码成功，消除替换后空白闪屏。⑤ 标注工具对标流影AI：箭头 V 形箭尾手算
    (弃 SVG marker context-stroke) + 文字标注输入框加大加描边 + 粗细滑块带实时值。⑥ 技能按域
    分域(生图3/视频2, filterCanvasSkills) + 技能按钮「更多技能/技能库」打开既有 SkillLibraryModal
    (initialKind 按域, 选中技能回写节点 prompt 预填 + skill/skillLabel)。⑦ 首页套图方案面板：切
    目标语言不再误标「已调整」(workbenchState settings 去 targetLanguage) + 面板滚动隔离
    (overscroll-behavior:contain + max-height) + 双发射按钮合并为同款紧凑组。
  - e1377172 (用户裁决方案一) 移除侧栏「视频创作」按钮 — 视频入口收敛到顶部「视频生成」域 +
    画布视频生成器/发往视频项目；顶部域与首页视频模块/工作台保留(发往视频项目落点不断链)。
  线上 TTS 真链路复核：server/.env 与根 .env 双文件含 TTS_API_KEY_VOLCENGINE，单条真实调用
  mockAudio:false + 真 MP3(ID3 头)验证通过。遗留：agv 快档首条真实账单落库后需对账校准；
    cloudflare-tunnel 持续 errored(历史遗留, nginx 正常)；P9 画布视频视图未做(彻底合并视频入口待落地)。
- 2026-09-11，节点生态 9-11 执行轮（火山 TTS 真链路 + agv 快档切换 + 8 项 UI 一致性 + P7 方案入画布）
  已由 8152bef9 发布至 https://shuimg.cn/（frontend 档，零付费 canary；全量回归 3113/3113，
  生产构建 + source-hygiene 绿；线上探针 /health ok、/api/billing/rules 含 ec_tts_voice 与
  P7 的 ec_direction_analysis/refresh(各 1 积分)、视频 SKU 用户价不变(快试 27 积分/条)、
  /api/workflow-templates 5 内置模板、入口 bundle index-DtMVGsBs.js）。
  提交栈（本轮）：
  - e6c3c6d6 TTS 火山 Seed-TTS 2.0 v3 契约(ttsBridge: /api/v3/tts/unidirectional +
    X-Api-Resource-Id: seed-tts-2.0 + NDJSON 解析 + 默认音色 Vivi 2.0) + 视频快试档切
    agv-seedance2.0fast(¥0.91/条：videoCatalog routeId + billing catalog cost 0.91/
    subsidizedTeaser 移除 + upstreamLedger 新路由 ip233-agv-seedance-fast(旧 sd5-fast
    retired) + videoMeter 按条计价 + costBasis 登记；用户价 27 积分/¥6.9 不变，毛利
    ≈84% 过 40% 地板，TEASER_SUBSIDY 告警清除)。
  - 1f568320 8 项画布 UI 一致性(9-11 图片批注：删除残留回收器/纯图标运行按钮+tooltip/
    图连线动画/加号端点几何 ±17/工作流建议卡/确认弹窗卡片化/替换胶囊/技能与模型缩略)。
  - bfea6c07 P7 方案入画布(设计方案=画布对象 CanvasDirectionNode + 首页发射器化：
    「下一步·带设计方案」铺开素材行+方案节点，「快速生成·跳过方案」直出套图生成器节点；
    应用到画布派生套图生成器 design-plan 连线；不变式① analysis/refresh 先报价后扣费；
    不变式② 旧 ecStep=2 整页保留可读)。
  - 8152bef9 ecommerce-billing-ui 断言跟随 EcMode payload 收敛(语义 pin 不变)。
  线上 TTS 转真：TTS_API_KEY_VOLCENGINE 经 SSH 注入 /home/ubuntu/shubao/server/.env 与根
  .env(部署回滚会还原 .env 旧快照 → 下次部署 pre-backup 含 key 自愈)；单条真实调用验证
  mockAudio:false + 真 MP3(ID3 头)。遗留：本机 SSL 出口不稳导致 deploy 的 public gallery
  verify 3 次失败(exit 1，远端侧健康检查全过、release 已正常切换)；agv 快档首条真实账单
  落库后需对账校准；cloudflare-tunnel 持续 errored(历史遗留，nginx 正常服务)。
- 2026-09-10，无限画布节点生态 P0→P3（总统筹分 4 期）已由 7e4c7e5e 发布至
  https://shuimg.cn/（frontend 档，零付费 canary；线上探针 /api/canvas/graph/run、
  /api/canvas/one-click-video、/api/canvas/tts 均 401 wired，/api/workflow-templates
  返回 5 内置模板 + 真实 usage/like + 诚实 gateNote）。全量回归 3088/3088 pass，
  生产构建 + source-hygiene 绿。提交栈（本轮）：
  - P0/P0.5 a87ba596：连线自动供料 + 分组'▶运行整链'(预览→二次确认才扣费) + 改文案
    下游自动标'已失效'。
  - P1 后端宿主 5f496210 + a8ce8b57：canvas_graph_runs/steps 持久化 + CAS 租约(宕机可
    恢复) + 每节点复用 canvasBilledActionStore 计费(幂等不重扣) + 失败隔离 + 取消/恢复 +
    /api/canvas/graph/run；免费白底链(商品图→去背景→放大)真分段+真 sharp 端到端 0 扣费。
  - P2 业务资产层 a32f0cea / 3e7dbc85 / cb5f6356：工作流模板表 + 5 内置图工作流(T2 纯图
    链可跑；T1/T3 填空即跑；T4/T5 P3 门控) + 技能市场(真实 usage/like，非占位) + 连线@
    引用合一(图=唯一真源，请求组装只读图，无连线字节级等价回归护栏) + 老文档只读迁移。
  - P3 音视频(诚实门控版，不烧上游) 7e4c7e5e：图片拼接 splice 免费接进 P1(sharp) + 假
    能力诚实清理(chainService deriveScript/deriveKeyframes 显式 isMock；悬空路由实现为
    /api/canvas/one-click-video + /api/canvas/tts 带门控标注) + timeline/轨道字段预留 +
    T4/T5(video-composer/tts/lip-sync)维持门控。
  - P3.1 遗留(需上游/报价确认，本期不硬开，属加法不返工)：真 TTS(ec_tts_voice)/Seedance
    视频/LLM 文案/生图首帧 adapter + 对口型 lip-sync 报价 + 视频拼接 ffmpeg + 客户端
    GRAPH_RUN_KINDS 补 splice 镜像。已留接口/字段/门控，确认后即可开。
  三条不变式全程守住：① 不确认不扣费；② 老文档只读可用；③ 价格唯一真源(后端 catalog)。
- 2026-08-07，电商 Canvas 创意导出稳定性版本已由 `02e517d` 发布至
  `https://shuimg.cn/`。上线前全量回归通过 `1265/1265`，生产构建通过
  （`6455` 模块），`npm run check`、协作策略和空白检查均通过。
- 部署使用唯一允许入口 `scripts/deploy-production.ps1`。初次尝试因继承的
  Canary 会话无效而安全回滚；临时会话仅在部署进程内使用，最终发布完成后没有
  落盘或保留凭据。
- 线上已通过公共健康检查、600 秒 Canary、独立公共审计 `27/27`，PM2 PID
  稳定为 `3983196`，远端部署锁已释放。两次真实电商生成分别为
  `ec_8f02ea03-d987-4cf9-b7f0-60731e3ad7cb` 与
  `ec_c69dd604-b011-4dba-bbf6-6f050c27d400`，均交付 3 个稳定资产。
- 当前本地、远端应用 `dist/index.html` 与 WebRoot 文件 SHA-256 一致：
  `85177ffb7cf961ddace3fff333bdcf489d2359264d110025a8e1038d47aa7c04`。
- 2026-08-07，账号 `867550189@qq.com` 的作品页空白经生产核查确认不是迁移
  缺失：数据库中有 54 条正常作品、79 个项目和 173 个项目资产，回收站为 0。
  `PRAGMA integrity_check` 发现 `works` 与 `tasks` 的若干索引不一致，前端把
  读取失败退化为空列表，因而表现为“作品为空”。已先创建一致性 SQLite 备份，
  再仅执行 `REINDEX`；修复后完整性检查为 `ok`，54 条记录可稳定读取，PM2
  仍为 `3983196`。该操作未修改作品内容、归属或资产。
- 2026-08-08，生成任务重连与案例素材稳定版本 `28e22cb` 已发布至
  `https://shuimg.cn/`。截图中的 `Failed to fetch` 实际任务已在服务端完成
  10/10，根因是前端把短时轮询断线误判成生成失败；现已改为幂等提交并持续重连
  同一任务，避免重复任务和重复扣费。`薯包出品` 的 14 套、117 张展示图片已纳入
  正式发布、回滚和线上逐图校验，远端无嵌套副本；浏览器实测 14 张封面全部解码，
  案例弹窗正常。全量测试 `1287/1287`、生产构建 6457 模块、600 秒 Canary、
  两次真实生图与公开审计 `27/27` 均通过，稳定 PM2 PID 为 `22334`。
- 2026-08-08，全球电商生图升级版本 `69fdd38` 已发布至
  `https://shuimg.cn/`。主图、详情图和广告图现在共用一份可追踪的全球电商
  上下文，覆盖 18 个国内/跨境平台与 22 个目标语言值，并贯穿第二步方案、逐张
  规划、服务端提示词、任务快照、作品和 Canvas 恢复。纯视觉模式禁止模型生成
  文字，其他语言模式遵守目标 locale 且不猜测商品事实；旧任务保持兼容，详情图
  默认仍为 9:16。全量测试 `1320/1320`、生产构建 6458 模块、两次真实生图、
  600 秒 Canary 和公开审计 `27/27` 均通过，稳定 PM2 PID 为 `122374`，远端
  部署锁已释放。朋友内测账号 `240485042@qq.com` 保持完整真实用户权限与独立
  作品归属，但不用于自动化测试；自动化 Canary 仍只使用主账号
  `867550189@qq.com`。

## 2026-08-11 Continuation Checkpoint

- 电商生图默认工作台已恢复为原有“产品图 × 参考图”框架；万物上身服务端能力保留但暂不侵入默认界面。全量测试 `1447/1447`、生产构建、线上真实积分钱包只读验收和公开审计 `27/27` 已通过。未进行视频生成测试。
- 管理后台已实现并纳入当前版本：账号/权限/角色/状态、四板块授权、真实积分钱包、审计和成本收入汇总。`867550189@qq.com` 300 AI 积分，`240485042@qq.com` 100 AI 积分，均为真实扣费账户。
- 后续顺序固定为：
  1. 完成视频生成商业化闭环：模型和成本、三种模式、图片/视频/音频分析、方案预览、排队并发、积分成本利润、Canvas 调整；不擅自做真实视频生成测试。
  2. 在不改变默认电商生图框架的前提下重做万物上身，并建立可扩展 Skill 卡片/示例体系。
  3. 补齐后台实时监控和长期运营能力；每次只用 `scripts/deploy-production.ps1`，完整验证后再报告上线。

## 2026-08-11 Release Candidate Checkpoint

- 本地候选版本已经完成：默认电商生图仍是原始“产品图 × 参考图”骨架；万物上身是同一骨架下的能力配方，包含商品/模特/场景角色、原创输入到结果展示、专用参数和第二步方案；自由创作的四个 Skill 复用同一输入框、参考素材区、底部工具栏和预览契约。
- 视频工作台保留智能成片、首尾帧、爆款重构三种独立模式，图片/视频/音频素材分析、方案预览、队列、路由熔断、积分和 Canvas 交接已接通。因为视频生成是付费动作，本候选版本没有由 Codex 触发真实视频生成；用户需要在上线后自行做一次真实视频验收。
- 后台可管理账号角色、状态、四板块权限、赠送/回收积分、审计和实时任务；汇总按功能、提供商、SKU、模型区分积分消耗、上游成本、理论收入、现金收入、内测补贴和贡献。`867550189@qq.com` 和 `240485042@qq.com` 的现有权限与有限积分设置以数据库/服务端初始化为准，不再使用无限余额旁路。
- 已验证：`npm test` `1453/1453`、桌面与 390px 移动浏览器关键页面、无页面横向溢出、视频页面无付费生成请求。下一步是构建、部署脚本、生产健康/公开审计及线上浏览器复核；失败则停止发布并按部署脚本回滚。

## 2026-08-11 Production Release

- 提交 `996792d` 已通过唯一入口 `scripts/deploy-production.ps1` 发布。部署命令本地等待窗口在末尾阶段超时，但远端核验确认发布已经完成：`server/index.mjs` 与 `dist/index.html` 哈希分别和本地候选一致，PM2 `shubao-production` 在线，PID `1147183`，部署锁可重新获取且已释放。
- `https://shuimg.cn/health` 返回 200；独立生产审计 `AUDIT_BASE_URL=https://shuimg.cn npm run audit:production` 通过 `27/27`；公开视频能力校验通过，两条公开路线为 Seedance 2.0 Fast 和标准版，MiniMax 仍隐藏。匿名 `/api/admin/summary` 返回 `401 AUTH_SESSION_REQUIRED`。
- 本次部署没有触发视频生成；视频只做能力探针和静态流程验证。用户仍需自行用内测额度完成一次真实视频生成验收，验证上游在真实素材、排队和结果回传上的实际表现。

## 2026-08-12 Upstream Billing Audit

- 已在登录态核查 65535、Change2Pro 和 IP233 三个中转站，没有触发付费视频生成。三个站点使用的 `$` 数值均按人民币 1:1 记账，禁止进行美元汇率换算。
- 65535 余额为 ¥6.60，累计 1,874 次请求，实际消耗 ¥24.9205；生图 Key 累计消耗 ¥24.6620，识图 Key 累计消耗 ¥0.2585。当前实际 `gpt-image-2` 为 ¥0.038/次；Seedance Fast 720p 为 ¥0.50/秒，标准 720p 为 ¥0.60/秒。
- Change2Pro 余额为 ¥9.32，Nano Banana 共 13 次成功请求、累计消耗 ¥0.7800；当前生产路由 `gemini-3.1-flash-image` 的 1K/2K/4K 均为 ¥0.06/张。
- IP233 余额为 ¥10，历史请求和消耗均为 0；实时目录中 `sd5-seedance-2.0-fast` 为 ¥2.47/次，标准版为 ¥3.64/次，Mini 为 ¥3.12/次。主 2.0/Fast/Mini 路由七日可用率页面显示 100%，但公告明确按次库存可能临时缺货；异步视频必须保存任务 ID、延迟轮询，并结合任务日志和用量日志对账。
- 当前生产继续使用 IP233 的低成本 Fast/标准按次路由。65535 监控信息更完整，但长视频按秒成本明显更高；在创建专用视频 Key 前不自动接为故障切换，以免图片与视频账务和并发混在同一 Key 中。
- 管理后台新增上游账本：同时展示中转站余额、今日/累计扣费、请求数、实时路由单价、薯包积分售价、本地结算成本，以及上游实报与本地归因的差额。只有 `867550189@qq.com` 的 owner 角色可见入口和页面，`240485042@qq.com` 等内测账号不可见也不可访问。历史视频任务保留创建时的成本快照，新任务使用同步后的单价。

## 2026-08-12 Upstream Billing Release

- 提交 `2d24d93` 已通过当前 Codex worktree 的加固部署脚本发布。线上当前 release 为
  `20260812-152607-2d24d93`，PM2 `shubao-production` 在线，PID `1420063`；健康接口返回
  `200`，`ready=true`，图片队列和电商活动任务均为 `0`，部署磁盘清理后仍有约 `5.5G` 可用空间。
- 生产公开审计 `AUDIT_BASE_URL=https://shuimg.cn npm run audit:production` 通过 `27/27`；匿名
  `/api/admin/summary` 返回 `401`。已用 owner 登录态浏览器核验管理后台，确认显示人民币 1:1
  口径、65535/Change2Pro/IP233 三家来源、上游单价、站内扣分、已结算次数、累计成本、余额和
  账本差额，页面无桌面横向溢出。
- 账本快照：65535 累计实报 `¥24.9205`、余额 `¥6.60`，Change2Pro 累计实报 `¥0.7800`、
  余额 `¥9.32`，IP233 累计实报 `¥0.00`、余额 `¥10.00`。线上生产归因分别按真实操作更新，
  与上游累计值不同属于统计起点差异，后台已明确标注为人工对账差额。
- 本次发布没有触发付费视频生成。部署脚本已完成初始健康、图库、视频接口契约、计费验证和一次
  真实电商生图验证；末尾 600 秒 Canary 的最终收尾被本地执行窗口终止，之后独立核验确认线上
  进程连续稳定运行约 14 分钟且无重启。为避免产生额外成本，未重复执行第二次真实电商任务；
  该事实不得在后续恢复中写成“完整 600 秒 Canary 已通过”。
- 部署时发现历史失败尝试留下的大型不完整备份占满磁盘，仅删除了两份明确标记为不完整的备份，
  未删除数据库、上传、缓存或用户作品；部署锁已清理，远端 Nginx/PM2 状态正常。

## 2026-08-12 Canvas And Billing Release

- 提交 `7dbe5ce` 完成万物上身与自由创作工作台收口；提交 `1894602` 完成 Canvas 文字识别缓存、
  右侧独立智能分层结果、中文反推、文字标注层级与工具栏可见标签，并补齐电商、小红书、Canvas、
  扩展分析和扩展生成中所有已审计上游 AI 动作的统一积分冻结、成功结算、失败释放与幂等重试。
- OCR 首次识别收费 `0.2 AI 积分`，缓存结果重复打开不再识别或扣费；确定性文字替换免费。扩展分析
  收费 `1.5`，基础/标准/完整复刻分别收费 `3/5/9`，必须实际交付完整 `3/5/9` 张才结算；余额或
  报价失败会恢复任务到可重试状态，供应商全失败、部分生成和商品链接空结果均释放冻结积分。
- `1894602` 已通过唯一入口 `scripts/deploy-production.ps1` 发布至 `https://shuimg.cn/`。部署内全量
  测试 `1481/1481`、生产构建 `6475` 模块、图库 `117` 张、公开视频契约、两轮真实电商任务和
  `600` 秒 Canary 全部通过。任务 `ec_726ceada-41f4-46fb-b4ef-971c7a72ae67` 与
  `ec_c52fc0a1-0375-4a18-be0d-c51ac98c3068` 均交付 3 个稳定资产；未触发视频生成。
- 独立生产审计 `27/27`，健康接口 `200`、`ready=true`，PM2 PID `1526367`，图片队列和活动电商
  任务均为 `0`，远端部署锁已释放。生产公开计费目录已包含 `ec_ai_assistant`、`ec_canvas_ocr`、
  `ec_extension_analysis`、`ec_extension_basic/standard/complete` 等新 SKU。
- 工作树继续保留用户运行态且未提交：12 个 `server/extension_tasks/*.json` 删除项、`.tmp/`、
  `scripts/diagnose-recent-ecommerce-jobs.cjs`。后续不得误恢复、误删除或误暂存这些内容。

## 2026-08-14 Production and AI Video Roadmap Checkpoint

- 线上真实版本已修正为 `6718e57`，Nginx `current` 指向 `/var/www/shubao/releases/20260814-092319-6718e57`；公开 HTML 入口为 `index-DeBnt_je.js`，PM2 `shubao-production` PID `2009483`，健康接口 `200`，正式发布已完成。
- 上一次“后端健康但前端未更新”的原因已经确认：误用了根目录残留的简化部署脚本，将静态文件复制到 `/var/www/shubao/assets`，而 Nginx 实际从 `/var/www/shubao/current` 服务。根目录入口现只转发到工作树中的正式部署脚本，正式脚本新增公网案例/视频契约验证重试，仍保持失败自动回滚。
- 本轮线上验收：全量测试 `1513/1513`、构建 `6479` modules、公开案例 `117`、公开视频契约 `2` 个产品、两次真实电商稳定资产验收、600 秒 Canary 通过；独立浏览器桌面/390px 移动端无横向溢出、首屏图像解码完成、无控制台错误。
- 服务器磁盘曾因发布备份达到 100%；只删除了两个明确失败备份和一个失败 release，未触碰作品、数据库、当前版本或本轮回滚点，当前约 91% 使用率。后续必须把备份保留策略和 `generated-assets` 生命周期纳入运营任务，不能继续无限累积。
- 可执行的长期 AI 视频路线图已保存为 `docs/superpowers/plans/2026-08-14-ai-video-platform-roadmap.md`。阶段顺序固定为：P0 媒体/任务/账务可靠性，P1 资产库/分镜/时间线 MVP，P2 声明式 Skill 与项目记忆，P3 逐秒重拍/延长/追踪替换/智能路由。每阶段须独立设计、测试、部署和退出验收，不得一次性复制竞品复杂度。

## 2026-08-14 Ecommerce Showcase Final Release

- 提交 `1d7eff3` 已通过唯一入口 `scripts/deploy-production.ps1` 发布至
  `https://shuimg.cn/`；Nginx `current` 指向
  `/var/www/shubao/releases/20260814-182811-1d7eff3`，PM2 PID 为 `2139610`。
  公开健康接口返回 `ready=true`，图片队列和活动电商任务均为 `0`，部署锁已释放。
- 发布门完整通过：全量测试 `1523/1523`、生产构建 `6479` modules、图库 `117`
  张、公开视频能力 `2` 个产品、计费契约、完整 `600` 秒 Canary 和两轮真实电商
  生产验证。任务 `ec_38dc5aee-5f32-41d4-9cc4-a21072aa37ab` 与
  `ec_c596bacf-4418-4141-b04d-afa22e473734` 均交付 `3` 个稳定资产；未触发付费
  视频生成。
- 线上浏览器验收覆盖 1440px 桌面、768px 平板与 390px 手机：商品套图和万物上身
  展示均使用完整比例素材，放大弹窗支持左右按钮、方向键和 Escape；灵感发现从首批
  `16` 个追加到 `28` 个时，已显示案例的视觉坐标不变；桌面和手机均无横向溢出、
  无图片解码失败、无控制台错误，悬浮遮罩与“做同款”按钮可用。
- 本轮首页静态展示图由 Codex 内置图像生成工具制作并纳入版本资产，并非通过薯包
  生产环境生成；真实生产链是否可用由上述两轮电商 Canary 独立验证。后续案例若要
  声明为“生产生成”，必须保存真实任务 ID、请求参数、输入素材、稳定输出和计费记录。
- 发布初次尝试因历史失败部署辅助目录和备份占满磁盘而停止；只清理了已核实的陈旧
  helper、非当前静态 release 与最旧备份，并在正式脚本内完成恢复后重新发布。当前根盘
  约 `87%` 使用、约 `5.3G` 可用；数据库、上传、作品、当前 release 和回滚点未被删除。
- 部署锁协议根因是 Windows PowerShell 写入 UTF-8 BOM，现由客户端无 BOM 写入与远端
  兼容剥离双重处理，并由部署脚本测试覆盖。用户运行态的 12 个
  `server/extension_tasks/*.json` 删除项、`.tmp/`、`.tmp_patch_responsive.py` 和
  `scripts/diagnose-recent-ecommerce-jobs.cjs` 继续保持未提交且未被修改。

## 2026-08-15 Production Showcase And Image Delivery Release

- 提交 `8bcd29e` 与部署探针修复 `888b81c` 已通过唯一入口
  `scripts/deploy-production.ps1` 发布至 `https://shuimg.cn/`。公开健康接口返回
  `ready=true`，首页返回 `200`，当前公开入口 bundle 为 `assets/index-Bb3OH1SM.js`。
- 商品套图展示改为薯包真实生产任务
  `ec_request_739acd9f-4873-4ff2-94b5-35f057278356` 的珍珠白降噪耳机完整套图；
  万物上身展示使用完整未裁切的穿搭素材、完整参考人物和四张独立生成的街拍结果。
  两个 58px 能力切换保持按钮语义，展示区和输入区统一为单层暖色到白色渐变；所有
  案例图均可进入共享放大弹窗并支持左右按钮、方向键和 Escape。
- 56 张 720px WebP 缩略图总计约 `2.07 MB`，替代卡片首屏直接加载约
  `141.09 MB` 原图，传输量降低约 `98.5%`；原图继续用于放大查看。112 个原图与
  缩略图资源均通过像素解码检查，线上浏览器未发现坏图。
- 电商上传现使用带鉴权的原始二进制传输、同一 File 并发去重、一次瞬时失败重试，
  服务端继续走既有持久资产服务；真实 contenteditable 光标插入验收结果为
  `ABCXDEF`，未再跳到输入起点。
- 发布门完整通过：全量测试 `1535/1535`、`npm run check`、生产构建 `6479`
  modules、协作检查、空白检查、117 张公开图库、2 个公开视频产品、计费契约、两轮
  真实电商生成和完整 600 秒 Canary。任务
  `ec_4185742d-290d-4724-8bf9-5095976a95cd` 与
  `ec_d15b1429-b46a-48da-8119-6fd256b925f2` 均交付 3 个稳定资产；未触发付费视频生成。
- 公网验收覆盖桌面和 390px：页面无横向溢出，商品套图、万物上身、自由创作切换
  正常，放大弹窗键盘导航正常。灵感发现从 16 张逐步加载到 28、40 张时，对四列锚点
  逐张记录文档坐标，已有卡片的 `x/y/宽高` 全部保持不变；此前按列读取 DOM 得到的
  标题顺序差异不是视觉重排。线上 40 张阶段坏图计数为 0。
- 部署脚本不再复用 PM2 重启前的短期探针会话，而是在重启后按实际 PID 和有效认证
  配置签发新的短期 Canary 会话；凭据只存在于部署进程内，不输出、不落盘。运行态的
  12 个 `server/extension_tasks/*.json` 删除项、`.tmp/`、`.tmp_patch_responsive.py`
  和 `scripts/diagnose-recent-ecommerce-jobs.cjs` 继续保持用户所有且未提交。

## 2026-08-15 AI Video Platform Research Decision Gate

- 当前站点的项目版本、资产、生成任务、计费账本、画布、案例复用、运营指标和视频
  单次生成链路已完成代码级盘点。现有 `VideoStudio` 应保留为未来的镜头生成器；核心
  缺口是项目级资产版本、分镜、候选/选定版本、时间线、声明式 SkillRun 和结果事件日志，
  而不是继续堆模型按钮。
- 头部产品、官方能力、开源方案、社媒方法和许可证边界已整理到
  `docs/superpowers/specs/2026-08-15-ai-video-platform-evidence-and-options.md`。推荐路线固定为：
  以 Flova/TapNow 的项目记忆、资产/镜头依赖、Skill 工作流、人工确认和创作过程回放为
  骨架；吸收 Runway/Firefly 的候选与时间线、Higgsfield/Luma 的镜头控制、Google Flow/
  Dreamina 的 Agent 工作流，以及 Vidu/Kling 的资产绑定；适配薯包现有项目、计费和任务底座。
- 开源复用须遵守许可证和退出策略：`tus-js-client` 可优先评估断点续传；ComfyUI 与相关
  GPL 工作流只作为隔离执行后端或设计参考，禁止未经法务边界确认直接复制到专有前端；
  OpenCut 可参考稳定时间线交互，Remotion/DesignCombo 须先完成具体许可证审查。
- “屿帆AI”目前只取得公众号公开索引摘要和公开视频证据，可确认镜头语法、表演说话、
  节奏、灯光、噪点修复和流程固化为 Skill 的方向，但未稳定取得文章全文；不得虚构具体步骤。
- 新 AI 视频平台代码仍处于产品路线确认硬门槛，尚未开始实施，也未触发任何付费视频生成。
  路线确认后必须先完成 P0 媒体/任务/账务可靠性，再依次进入 P1 资产/分镜/时间线、P2
  声明式 Skill/项目记忆/案例克隆、P3 区间重拍/延长/跟踪替换/智能路由；每阶段须独立
  设计、自审、测试、部署和生产验收，未完成项保持显式状态。

## 2026-08-15 AI Video P0 Reliability Audit

- P0 代码级根因审计已保存到
  `docs/superpowers/specs/2026-08-15-ai-video-p0-reliability-audit.md`。现有视频
  链路已有幂等创建、队列、公平调度、熔断、供应商任务追踪、启动恢复和钱包预授权，
  但尚不能安全承载长视频项目。
- 已证明的六类阻塞问题：`GET /api/video/assets/:id` 无鉴权且 `readAsset` 不校验
  owner；`needs_review` 被当成终态却没有自动/人工处置入口；积分释放异常被吞掉但界面
  固定声称已退款；结果落盘、结算、任务完成和 Works 投影之间没有事务/outbox；独立
  `video_assets` 没有项目版本、hash、代理/缩略图和保留治理；上传与供应商结果均整文件
  缓冲，缺少断点续传和流式持久化。
- 站内已有可复用原语：画布收费动作的跨进程租约/fencing、`delivered -> settled`
  检查点、项目不可变版本、生成运行、恢复点、`project_assets` 和引用保留策略。P0 应
  提炼这些成熟实现建立视频专用 `Job -> Attempt -> Delivery -> Settlement` 状态机，
  不能另造一套互不兼容的基础设施。
- 定向视频/项目/计费回归 39 项通过，但缺少资产权限、复核处置、释放失败重放、各崩溃
  窗口恢复、输出去重和大文件续传测试。正式实施必须先补会失败的故障测试，再分批修复；
  路线 C 和正式 P0 设计批准前不开始新平台代码，也不触发付费视频生成。

## 2026-08-15 AI Video P0 Formal Design Gate

- 正式设计已写入
  `docs/superpowers/specs/2026-08-15-ai-video-reliable-media-job-foundation-design.md`。
  路线 C 固定为项目/资产版本/镜头导演工作台；P0 只建设可靠媒体、任务、交付、账务、
  复核和投影底座，保留现有 `VideoStudio` 作为单镜头生成器，不提前扩张到分镜、时间线、
  Skill 市场或新付费模型。
- 设计把执行事实拆为 Job、Attempt、Delivery、Billing、Projection，并规定未知供应商提交
  只核验不重提、验证交付后才结算、失败释放必须由真实账务状态驱动文案、Outbox 与
  reconciliation 收敛 Works/项目投影、`needs_review` 改为有 SLA 和运营动作的 ReviewCase。
- 私有用户媒体改为 owner 鉴权读取；供应商读取使用短期 HMAC 签名 URL 或原生文件上传。
  大文件上传固定采用官方 MIT `@tus/server`、`@tus/file-store`、`tus-js-client`，禁止使用
  旧 `tus-node-server`，也禁止在集成失败时静默手写不完整协议。输出下载和输入上传都必须
  流式持久化，浏览器本地预览不等待云上传。
- 正式设计包含 feature flags、附加式迁移、shadow write/backfill、灰度切读、独立回滚、
  故障注入矩阵、SLO、安全保留和 P0 退出门槛。设计完成前没有修改生产代码、没有部署、
  没有触发付费视频生成；下一步必须取得用户对书面设计的确认，随后才能编写逐文件 TDD
  实施计划并进入代码实现。

## 2026-08-15 Existing Product Requirement Evidence Audit And Smart Layering

- 现有商品套图、万物上身、自由创作、灵感发现、上传/光标、画布、可靠性后台和 AI 视频
  要求已逐项映射到
  `docs/superpowers/specs/2026-08-15-existing-product-requirements-evidence-audit.md`，
  每项均标明代码、测试、生产证据或不可诚实承诺的边界，不再以笼统的“做完”替代证据。
- 本轮唯一新确认且尚未上线的行为缺口是智能分层。成功后应在原位置用图层组和真实子图层
  替换原图与加载占位，保留来源追踪但不保留指向已删除原图的连线；失败时原图保持不变。
  初始只显示折叠合成预览，第一次拖出任一图层时隐藏合成预览并显示全部真实子图层，避免
  原图、合成图和图层同时重复存在。
- 该行为已按红灯到绿灯补齐，Canvas 定向回归 `77/77` 通过；提交前审查进一步保证原图的
  既有工作流连线迁移到新图层组而不是丢失，交互定向回归 `71/71` 通过。全量测试
  `1537/1537`、`6479` 模块生产构建、构建检查、协作策略和差异检查全部通过。当前仍待正式
  提交、生产部署和公网验收；在这些门槛完成前不得声称已上线。未触发付费视频生成，
  12 个运行态任务删除项及本地临时、诊断文件继续排除。

## 2026-08-18 Ecommerce Showcase Production Deployment

- `df4a7a7` 已上线 `https://shuimg.cn/`：主展示使用同套服饰素材 -> 连续弯曲箭头 -> 四张完整模特卡片；顶部万物上身选择器只展示四张完整卡片，两个需求分离。
- 生产部署脚本完成 600 秒 canary；全量测试 `1574/1574`，生产构建 `6483` 模块，图库、视频目录、运行时、健康检查和两次真实电商生成验收均通过。
- 公网健康检查 `ok=true, ready=true`；主展示 PNG、选择器 WebP 均 HTTP 200，远端构建 chunk hash 与本地一致。
- 本轮未触碰 AI 视频线程或其运行态文件。后续恢复应继续保留现有脏文件，不得使用 `git add .`。

## 2026-08-18 XHS And Plog Reference Generation Release

- 提交 `7896195` 完成小红书图文与 Plog 的语义参考素材链路：风格参考只做视觉分析，用户素材按镜头职责选择性进入图生图；XHS 风格参考最多 3 张、用户素材最多 6 张，Plog 复用电商素材上传样式并支持分组上传。
- Plog 现在返回并保存封面及每张内容图的实际生成提示词，同时记录 `page_id`、`shot_role` 和 `reference_use`；XHS 原有 `cover_prompt` 与逐页 `image_prompts` 也随作品保存，后续灵感发现案例可以直接展示和复用，不需要反推提示词。
- 聚焦回归 `18/18`，全量回归 `1592/1592`，生产构建 `6486` 模块，`npm run check`、协作检查和差异检查通过；提示词持久化数据库回归已覆盖。
- 生产 release 为 `20260818-100741-548b8ca`，公网健康 `200/ready=true`，独立生产审计 `27/27`；真实电商验收任务 `ec_cc614959-5889-4b1c-82c0-e9e39eba309f` 交付 3 个稳定资产并通过作品/Canvas 持久化和缩略图检查。未触发付费视频生成。
- 本次本地部署进程与远端锁通道在版本切换后断开，远端已完成切换但本地未能回收 600 秒 Canary 输出，因此不把本轮记为“完整 600 秒 Canary 已通过”；已通过独立公网审计、健康检查和真实电商验收，远端部署锁已确认释放。
- 用户未提交的 Canvas、诊断、临时文件和运行态任务删除项继续保留，未加入本次提交。

## 2026-08-18 AI Video Provider-Neutral Foundation Release

- AI 视频可靠性底座已整合到 `codex/ecommerce-stability` 的 `9225816`，并通过唯一入口
  `scripts/deploy-production.ps1` 部署到 `https://shuimg.cn/`。部署脚本完成 600 秒 Canary、PM2 启动快照、
  公网健康/图库/视频契约验证并释放远端锁；健康接口重试返回 `200`、`ok=true`、`ready=true`。
- 本地全量回归 `1821/1821`、`npm run check`、生产构建 `6520` modules、`git diff --check`、协作策略、
  reconciliation dry-run 和 `verify-video-platform.mjs --local --no-paid-generation` 均通过。远端无积压任务、
  无迁移标记、`providerSubmissions=0`、无账务变更；没有触发付费视频生成。
- 本次上线内容是 owner 鉴权读取、TUS 断点上传、持久化 attempts/outbox、renderer lease/recovery、重启恢复、
  reconciliation 和严格 preflight binding。`VIDEO_PLATFORM_P1_WORKBENCH=false` 保持关闭，不能把它描述成已完成
  的 AI 导演台或时间线编辑器。
- 两个 B 站导演视频、Feishu AI 视频目录、Flova/TapNow/流影及开源许可研究已经写入路线图。隐藏的 Feishu
  附件正文和“屿帆AI”公众号全部文章正文在当前环境无法稳定取得，因此没有虚构不可验证的文章结论；后续只能基于
  用户提供的导出或可访问正文继续补证。
- 部署后本地出现的 `90c919d` 是独立 XHS 展示提交，不属于本次 AI 视频 release；12 个 extension task 删除项、
  `.tmp/`、诊断脚本和可视化临时文件继续保留，不能误恢复、误删除或误暂存。

## 2026-08-19 AI Video Asset Delivery And Provenance Hardening

- 规划工作台仍保持 `VIDEO_PLATFORM_P1_PLANNING=true`、实时渲染 `VIDEO_PLATFORM_P1_WORKBENCH=false`；本轮没有供应商调用、
  视频生成、上传、钱包 hold、结算或 usage 变更。
- 视频资产读取现在支持 `ETag`、`Last-Modified`、`If-Range`、条件 `304`、无正文 `HEAD`、标准 `206/416` 区间响应和安全
  inline 文件名，保持 owner 鉴权与私有缓存不变。
- `video_shot_candidates` 保存 immutable provenance 快照并在 UI 展示 `规划候选`、`候选来源未核验`、`来源已核验`；历史记录
  缺少完整 attempt 时 fail closed，不编造 provider/model。
- 新 B 站 `BV1p7gP6CErH` 的 360p 只读视频、30 帧和章节元数据，以及飞书 Seedance 2.5 正文方法已经写入路线图/研究文档；
  隐藏附件和不可稳定读取的“屿帆AI”公众号正文仍明确标记为不可验证，未虚构结论。
- 本轮 focused evidence `32/32` + UI `2/2` 已通过；full test/build/deploy/public canary remains pending until command evidence is recorded.

## 2026-08-19 AI Video Planning And Media Recovery Gate

- 新增 provider-neutral 规划工作台门禁：`VIDEO_PLATFORM_P1_PLANNING=true`，实时渲染仍为
  `VIDEO_PLATFORM_P1_WORKBENCH=false`。所有者可以编辑项目、素材、分镜、候选、时间线、项目记忆、Skill 运行和回放，
  但工作台明确禁止供应商提交、导出渲染任务和积分变更。
- 根据 B 站 `BV1p7gP6CErH` 与 Feishu AI 视频目录补齐的产品原语已写入路线图：批准素材版本、镜头方向、动作/灯光/轴线、
  候选选择、低清到高清漏斗、任务幂等和过程回放。没有触发付费视频生成。
- 视频资产 Range 下载新增标准后缀区间解析和 `416 Content-Range` 契约，防止断点预览从错误位置恢复；新增测试后全量回归
  `1830/1830`、生产构建 `6520` 模块、构建检查、协作门禁与本地无付费验证均通过。明确排除 12 个运行态任务删除项、
  `.tmp/`、诊断脚本和可视化临时文件。

## 2026-08-19 AI Video Release Gate Result

- 本轮最终本地证据已齐：全量回归 `1840/1840`、生产构建 `6520` modules、`npm run check`、协作门禁、无付费视频验证、
  renderer reconciliation dry-run、40 操作规划试点和本地生产审计 `27/27` 均通过；试点记录
  `providerSubmissions=0`、`billingMutated=false`。
- 正式部署脚本已执行到远端连接前的最后门禁，但因当前执行环境无法读取
  `C:\Users\SHEJI\.ssh\shubao_deploy_ed25519`，服务器返回 `Permission denied (publickey,password)`；远端 helper 目录和部署锁
  均未创建，因此本轮没有线上文件、PM2、Nginx、账务或供应商任务变更，也没有 600 秒公网 Canary 证据。
- 不得把本地 planning/workbench 证据或此前线上 `9225816` 基础版本误报为本轮改动已上线。恢复发布时仍只能使用
  `scripts/deploy-production.ps1 -CanarySeconds 600 -PublicWarmupSeconds 60`，并重新获取公网健康、资产、视频契约、账务隔离和
  Canary 证据；视频供应商和计费继续保持关闭。

## 2026-08-22 Video Thread Recovery Checkpoint

- 视频线程恢复会话已建立：读取根目录与工作树 RTK.md，确认 git worktree 状态，运行视频专项测试子集 162/162 通过（video-model-router / video-renderer-worker-batch / video-workbench-store / video-workbench-routes / video-shot-recovery / video-workbench-plan / video-workbench-client / video-project-bridge / video-skill-run / video-export-manifest / video-project-workbench-model / video-project-workbench-ui）。
- 最近完成的视频里程碑是「候选进入时间线」的原子事务边界（shot-execution-contract 计划 Task 1-8，全部收口）：服务端、专属路由、客户端服务、工作台按钮全部接上；候选进入时间线是视频域内原子、可重放的键控事务，同一镜头下旧候选的活动片段会标记 stale。
- 当前工作树是共享工作树：未提交变更混合了视频域文件与主线程共享资产/Canvas/Works/导航/商品档案/ecommerce 文件（projectStore、projectAssetContract、Canvas 等）。视频文件依赖未提交的共享层函数（如 videoProjectBridge 引入 projectAssetContract 的 assertCanonicalProjectAssetRef），因此不能只提交视频文件，需统一归档后由主线程按唯一入口执行 full production gate。
- 下一步待办：选择仍完全独立于共享资产层的视频域下一项工作（候选建议 VID-P1-04 计划审批门禁或 VID-P1-02 分镜细化），实现、测试、更新本记录。
- 全程未部署、未触发真实生成、未消耗视频生成费用。

## 2026-08-23 Video Storyboard Shot Model Enrichment (Video Thread)

- 视频线程在分镜卡片模型上补齐 VID-P1-02 字段：video_storyboard_shots 表新增 first_frame_ref/last_frame_ref/model_intent 三列（additive 迁移）；createShot/updateShot 接受并持久化，首/末帧引用经 purpose reuse 的 canonical 项目资产校验，外主/伪造哈希/缺失资产均 fail closed。

- 分镜卡片 UI 展示「意图」与「首末帧已绑定」标识，新建/编辑表单支持输入模型意图；路由 shot.create 透传新字段，客户端服务经 jsonBody 自动透传。

- 聚焦视频回归：video-workbench-store 42/42（+2 分镜字段测试）、routes/client/model/ui 62/62、视频域完整子集 188/188；全量 npm test 2117/2117；collab READY、git diff --check 通过。

- 未调用供应商、未触发真实生成、未改变账务、未部署。线上仍为 e673c10；工作树为共享工作树，视频改动与主线程 Canvas/资产改动混合未提交，后续由主线程按唯一入口 full production gate 统一归档后发布。

## 2026-08-23 Video Storyboard Shot Enrichment - UI & Build Closure

- 分镜字段前端闭环已补齐：新建/编辑分镜表单新增「模型意图」输入（shotDraft/edit 均透传）；编辑表单新增「首帧素材」/「末帧素材」两个下拉，从项目素材库（reusableProjectAssets 的 image 素材）选择 canonical 引用，提交时经 purpose:reuse 由服务端权威校验内容哈希（UI 不传播 contentHash/stableUrl/mimeType，符合 UI 测试契约）。

- vite build 22.46s 成功、check-build 通过（dist 产物完整）、video-project-workbench-ui/model 13/13、视频域完整子集 182/182、全量 npm test 2117/2117、collab READY、git diff --check 干净。

- 未调用供应商、未触发真实生成、未改变账务、未部署。线上仍为 e673c10；共享工作树待主线程统一归档后按唯一入口执行 full production gate。

## 2026-08-23 Per-Shot Cost Estimate + Material Library Collaboration

- 视频计划层：buildVideoWorkbenchPlan 给每个 normalizedShot 附带 cost 字段（{units, points}），基于 quoteForShot 按视频产品SKU和分镜时长算出每镜头积分估算；UI 分镜卡片 header 直接展示约X积分；plan 测试新增每镜头成本断言并验证通过。

- 主线程协作：已读取主线程素材库调研结论（progress.md 566-577行），从视频线程视角回应4个问题——视频上传组合素材刚需素材库应自动入库、视频成片进作品集不自动塞素材库、first/last frame 引用依赖 canonical project asset 身份（改入库策略会影响视频首末帧绑定，用户需先加入素材库再引用）；回应已写回 progress.md（2756行）。

- 验证证据：视频域完整子集 188/188、plan 测试 11/11、UI+model 13/13、全量 npm test 2117/2117、vite build 22.46s 成功、check-build 通过、collab READY、git diff --check 干净。未部署、未触发真实生成、未改变账务。
## 2026-08-23 Renderer Settlement Budget Guard (P1-07 closure)

- videoRendererAdapter 响应规范化新增 settlementUsage：供应商响应携带 usage.points 时强制校验安全非负整数且 ≤ 预检证明的 maximumPoints/requestedCapPoints，超限 RENDER_SETTLEMENT_BUDGET_EXCEEDED fail closed；无 usage 中间状态向后兼容。adapter 测试 10/10（4 新用例）、渲染器家族 38/38、视频域子集 203/203、verify:video-acceptance ok。
- 全量 2120/2121，唯一失败 content-project-lifecycle 第47行为主线程域并行改动回归（已在共享账本留精确证据，视频线程不越权修复）。未部署、未触发真实生成、未变账务；线上仍 e673c10。

## 2026-08-23 VID-P3-05 Data-Driven Routing History Slice

- videoModelRouter：normalizeRouteHistory + buildRouteHistoryStats + recommendVideoRoute 可选 history 混入有界加性调整（成功率±15、时延惩罚≤10，minAttempts=3），historySummary 透明暴露；无历史行为与旧契约逐字节一致。router 9/9、下游 40/40、视频域子集 207/207、diff 干净。纯路由层，store/UI 接线留待后续增量。

## 2026-08-23 VID-P3-05 Full Wiring (Slice 2)

- store.recentRouteHistory（sqlite_master 防御+有界+productId 解析）→ routes 四处统一 routeHistoryFor 注入（预览/批准/预检/草稿指纹一致）→ plan options.routeHistory 透传 router → UI 路线卡展示「已结合近期 X 次交付记录」。store 44/44、routes/client/model/ui 62/62、plan 12/12、视频域子集 210/210、diff 干净。P3-05 数据链路全线贯通。

## 2026-08-23 VID-P3-01 Time-Range Reshoot

- reshoot_range 模式：有界区间校验(≥500ms)+preserve_untouched_ranges intent+fallbackToWholeShot 回退标记；复用既有 reshoot 执行通路零改下游；store/routes/client/UI 四层接线（下拉「区间重拍」+起止秒输入）。恢复测试 15/15、全链路 121/121、视频域子集 212/212、diff 干净。P3-02/P3-03 经核验既有 extend_shot/track_replace 已达标。

## 2026-08-23 P3-03 Mask Preview + 视频线程独立提交

- P3-06 候选学习完成（显式选择才计偏好：video_candidate_selections 表 + selectCandidate/applyCandidateToTimeline 记账 + listCandidateSelections 有界查询 + videoCandidateLearning 纯函数聚合）。P3-03 UI 补齐区域追踪替换四轴输入+16:9 蒙版预览。视频域全部改动已由视频线程自行提交：836d154（P3 主批）+ 后续 mask 小提交，父链 9899645。主线程可直接部署。视频域子集 216+/216+ 持续全绿。

## 2026-08-23 P3-07 协作/API 切片

- comments：video_project_comments 表+add/list 方法+GET/POST /workbench/comments 端点（owner-scoped）。export webhooks：videoExportWebhooks.mjs（公网 https 白名单式校验+确定性负载构造器），HTTP 投递留给 worker。roles/approvals/scoped-API 以既有 cohort 门禁、计划审批指纹、dispatch 审计核验达标。子集 219/219 全绿。

## 2026-08-23 P3-07 评论 UI 面板

- 「项目协作评论」面板上线：composer（≤2000/Enter 发布/busy 禁用）+ 倒序列表前 10 + 空态；client 新增 list/add 包装；projectId 切换自动重载。P3-07 五要素全部用户可见或核验达标。client/UI/routes 52/52、视频域子集 221/221 全绿。

## 2026-08-23 P3-07 Webhook 投递队列

- 订阅 CRUD（公网 https 门禁+同 URL 幂等）→ 导出完成入队（UNIQUE job+webhook 幂等）→ claimPending 事务认领 → report 回报 delivered/failed；真实 HTTP POST 留给部署侧 worker 调本接口即可。store+协作 49/49、视频域子集 220/220 全绿。


## 跨模型图像协作能力

详细方案见 `docs/superpowers/specs/cross-model-vision-bridge.md` (provider-agnostic 视觉桥 + 浏览器批注面板 + 跨模型结构化文本注入)。不论切到哪个 LLM, 纯文本模型都能看到图。

## 2026-08-31 上线前暂停 (用户 8-31 23:xx 授权最高权限, 但发现 19 个 baseline 测试 fail 决定不上线)

### 用户授权范围
- "其他部分你可以直接上线了, 但是你上线前要非常谨慎"
- "千万千万, 你做过的那些东西, 你千万千万不要让他们出任何的bug"
- "画布和视频创作这两块区域, 线上是什么样, 就让他是什么样, 后续会优化"
- "现在就可以先上线"

### 上线前排查结果
- npm run check: ✅ 通过
- npm run build: ✅ 6.30s 通过
- npm run collab:check: ✅ READY
- pricing-modal-commerce.test: ✅ 16/16 全绿 (新组件契约)
- 全量 npm test: ❌ 19 fail + 1 summary line

### 19 baseline fail 分类 (不是我最近 8 commit 引起)
按用户要求 "画布和视频创作不动":
- VIDEO (4) - 用户说不要动, 排除
  - VideoCanvasWorkbench.jsx 接入 useLongTask
  - renderVideo 接受最小 manifest, ffmpeg 未装时返 error
  - 本地 ffmpeg adapter 与 runVideoRendererWorkerOnce 集成
- PRICING (3) - 重构后老测试期望的字符串位置变了, 不是产品 bug
  - pricing page exposes no legacy or clickable payment-provider path
  - pricing order restoration is cancelled
  - pricing presents only the real checkout price
- P-A 三方多模态 (5) - RTK.md L413-415 已记 partial commit
  - materializeChainArtifacts (3)
  - mountMultiModalRoutes (2)
- ADMIN/BILLING (3) - 计费 admin 测试
  - admin self-credit and direct payment settlement
  - server initializes durable billing (server.js env)
  - production restores owner-bound pending state
- ENV (1) - 我加了 multer dep 但没跑 npm install
  - package-lock.json 同步
- OTHER (1) - video-studio-contract test 内部
  - V2 P0-3: handleCreateExportManifest (markStep / overlay) - 画布相关
  - market copy exposes no rollout or privileged-account language

### 阻塞决策
按 RTK.md §6 门禁和 §7 部署协议 "关键验证失败立即停止发布", baseline 19 fail 不应上线:
- 画布/视频相关 6 个: 用户明确说不动
- 计费 admin 3 个: 涉及真实账务
- P-A partial 5 个: 已知半成品

### 保留进度 (后续可上线)
代码改动都已 commit:
- 483e853f fix(pricing-modal): 全面重整单层架构 (8-31 第 7 轮)
- e2044d3b fix(pricing-modal): 移除外层 shell maxWidth:760 截断
- b68330e1 fix(pricing-modal): 弹窗不被视口截断
- 87393a1d fix(pricing-modal): 防御 plans 为空时的 undefined 崩溃
- e1624903 refactor(pricing-modal): 弹窗扩到 1100px + 套餐结构化列表
- 2af49bb4 refactor(pricing-modal): 单一扁平宽框
- c716d9ad fix(pricing-modal): 用服务端 catalog 真实数据 + 改品牌薯包 AI
- 52e952a2 refactor(pricing-modal): 灵图风格重构
- 988 commits ahead of origin/codex/ecommerce-stability

### 不在本次上线范围 (用户说不动)
- 画布 (EcCanvas, EcStore, EcSmartLayer, DirectorWorkbench, etc.)
- 视频创作 (VideoStudio, VideoCanvasWorkbench, renderVideo, ffmpeg adapter)
- MultiModal 端点 (P-A 半成品, RTK.md 已记)

### 状态: 暂停等用户第二天决定

## 2026-09-02 深夜 画布/定价重构 会话 773eb92a3efd (继续薯包重构目标) - 最新进度

### 会话完成并提交 (2 commit)
- f40b6873 定价页灵图视觉重构: 暖米#fbf8f1 + 琥珀#e99a18 + 紫罗兰#6d28d9 + 毛玻璃 + 推荐档五重强调; 全量 2906/2906 通过.
- a5520a87 画布 3 处修复: 顶部去掉"导出整套图片"按钮/改"新建画布"; 修快捷键面板空 bug; 小地图加关闭按钮.

### 本次会话 (9-02深夜续接) 已定位并验证修复 2 个真 bug

环境: vite:5173 + 后端:3001 已起; 测试邮箱 240485042@qq.com (beta tester) 可登录 (qa@test.com 被 gateEmail 403 拒); playwright 可用.
QA 模式 (?qa=ec-canvas) 上传会触发 401 跳回首页+登录弹窗 (result.browserQa=true 时上传归档 API 401), 不能用来复现真实上传bug, 必须真实登录.

Bug 1 — "上传第二个素材后拖不动": 
根因: handleCanvasSourceUpload 把新上传素材放在固定的 stage 40%宽/35%高坐标, 多次上传落同一点完全堆叠, 上层盖住下层, 下层节点无法被点选/拖动.
修复: 改用 findCanvasBlankPlacement 在已有节点旁找空白位置错开排放 (index.jsx 图片上传 + 视频上传两处).
验证: 真实登录传2张图, 第2张由(576,385)错开到(348,385), 两节点都能拖动. 拖拽链路本身正确 (handleNodeDown(1892)→pointerMode drag→handlePointerMove(1737)→flushDragFrame(1677)→moveSelectedNodes), 无全屏fixed遮罩盖住画布中心.

Bug 2 — 右面板"怎么东西都不见了" (用户8-29反馈): 
根因: portCreationActions 把 CANVAS_CREATION_OPTIONS 每项统一覆盖成 group:'继续创作', 而 CanvasDeriveMenu 只渲染 core/magic 两个桶, 9项动作全被过滤 → 右面板只剩标题"从当前素材继续创作 9 项", 动作按钮不渲染.
修复: 去掉 group:'继续创作' 覆盖, 保留各动作自身 group (5 core + 4 magic 正确分桶).
验证: 右面板现显示"核心常用5项+流影AI智能4项", 点击"生成文案"成功创建 text_composer 节点 (节点数 1→2).

### 已过验证
- 全量 npm test: 2906/2906 pass (两次).
- 待跑: npm run build + npm run check.

### 待续 (下次接续点)
1. 右面板"时开时关/右边截断" item ③ — selectionPanelsVisible(4809) 需 !connectionPicker && multiSelected.size<=1 && 非text/composer; 连接端口拖动时 connectionPicker 开/关导致面板闪烁; 窄屏右边缘截断待核.
2. 素材派生面板重建 item ② — 核心动作链路已修, 5原有+4智能 9项正常渲染与点击创建节点已验证.
3. quantv/laoyu 生态调研 item ④ — 未开始.
4. 全部验证 test/build/check + 提交 + 按用户意见分批部署 (scripts/deploy-production.ps1).

### 本次会话 (9-02深夜续接 - 第二轮) 已修复并验证 3 个真 bug (累计 5 commit)

本次 commit:
- 8f05c524 fix(canvas): uploads no longer stack at same coord (drag blocked) + derive menu actions render again
- 6f1d2dba fix(canvas): move toolbar+right-panel outside transform layer so they stop getting clipped by overflow:clip on pan/zoom
- + index.jsx + RTK.md + docs/superpowers/research/laoyu-canvas-brief.md

Bug 3 — 右面板+工具条被画布平移/缩放时的 overflow:clip 截断:
根因: CanvasObjectToolbar + EcCanvasRightPanel 渲染在 transform layer (translate+scale) 内部, 随画布 pan/zoom 被 overflow:clip 裁切, 右面板移出视口后消失/截断.
修复: 把两个组件移到 transform layer 外 (index.jsx 第 5361 行, marquee 之后, tab==="canvas" 外层 div 之前), 让右面板锚定 stage/视口而非 transform 层.
验证: playwright 测试 1440px (right=1426<1440, clipped:false) + 1100px (right=1086<1100, clipped:false) 均不截断; 760px 移动端自动隐藏.

### 已通过验证
- 全量 npm test: 2906/2906 pass (三次).
- npm run build: ✅ (19.92s / 30.48s 两次).
- npm run check: ✅ 构建后检查通过.
- 浏览器 playwright 复现验证 (①②③ 全部).

### 竞品调研 (item ④ 完成)
- B站 BV1odbo6AEri 《第一集：电商无限画布工作流制作口哨舞女装 AI 带货视频保姆级教程》 (老鱼AI电商, 9632粉, 10:34, 2026-08-20)
- laoyu.quantv.com/canvas/editor 需登录, 无法直接访问; 首页公开文案确认其定位与薯包高度重合.
- 核心差异: 量湖在多模态串联 (文案→首帧→视频→音轨→字幕) 和演示视频矩阵上领先; 薯包架构可复刻并超越 (用 1-click 节点封装 pipeline 更轻量).
- 完整调研简报: docs/superpowers/research/laoyu-canvas-brief.md

### 待续 (下次接续点)
1. 多模态 pipeline 回归 (P0 优先级, 参考量湖 1-click 套件封装思路, 用节点化形态替代已移除的 MultiModal).
2. 节点流程预览升级: 实时显示处理进度/状态.
3. 电商工作流模板市场: 复用现有 public-templates, 增加"无限画布"专用模板.
4. 演示视频: 尽快制作同等质量 demo 视频发布到 B站.
5. 全部验证 test/build/check 后按用户意见分批部署 (scripts/deploy-production.ps1).

### 本轮最终完成 (9-02深夜续接 - 第三轮)

已提交 3 个 commit，全部验证通过并已部署到线上 https://shuimg.cn/ :

- 8f05c524 fix(canvas): uploads no longer stack at same coord (drag blocked) + derive menu actions render again
- 6f1d2dba fix(canvas): move toolbar+right-panel outside transform layer so they stop getting clipped by overflow:clip on pan/zoom
- bf0b1992 fix(canvas): right-panel+toolbar moved outside transform layer + laoyu competitor research
- b15daa46 chore: trim trailing whitespace + blank line in sdd/progress.md

### 部署验证 (线上 confirmed)
- npm test: 2906/2906 ✅
- npm run build: ✅ (16.39s)
- npm run check: ✅ 构建后检查通过
- 生产部署: b15daa46 → https://shuimg.cn/ ✅ (gallery/video/health 全通过)
- 源文件验证: findCanvasBlankPlacement 7处 / EcCanvasRightPanel 正确引用 / selectionPanelsVisible 门控完整
- 构建产物验证: dist/assets/index-CP4R-8PN.js 包含 core/magic 分桶逻辑 + 流影AI智能分组

### 三个 bug 均已修复上线
① 上传第二个素材后拖不动 → findCanvasBlankPlacement 错开排放 ✅
② 右面板"怎么东西都不见了" → group:'继续创作' 覆盖已移除，core/magic 分桶正确渲染 ✅
③ 右面板时开时关/右边截断 → 移到 transform layer 外，anchor 视口不再被 clip ✅
④ quantv/laoyu 生态调研 → 简报写入 docs/superpowers/research/laoyu-canvas-brief.md ✅

### 下一步 P0
多模态 pipeline 回归 (参考量湖 1-click 套件封装思路) + 演示视频制作。

### 后续修复 (9-02深夜续接 - auth/send-code 500)
部署后上线发现 /api/auth/send-code 返回 500。根因分析:
1. server/index.mjs 缺少 sendVerificationCode 导入 (ReferenceError)
2. mailer 回调非 async → Promise 未处理拒绝
3. mailer 回调传对象 {to, code} 而非字符串 to → SMTP "No recipients defined"
4. nginx 代理端口配置错误 (3002→3001)
5. SSL 证书权限问题
6. mailer 回调忽略了传入的 code 参数，导致邮件发送的代码与数据库存储的哈希不匹配 → 用户收到正确验证码但验证失败
6. mailer 回调忽略了传入的 code 参数，导致邮件发送的代码与数据库存储的哈希不匹配 → 验证失败 "验证码错误"
修复: 添加 import + async/await + 传 email 字符串 + nginx 端口修正 + SSL 权限修复 + 修复 mailer 传 code 参数。
验证: Node.js HTTPS 测试 {"ok":true,"mock":false,"reused":false,"retryAfterSeconds":60} ✅
注意: curl 在 SSH shell 中会剥掉 JSON 引号导致 500, 需用 Node.js/Python 脚本或 --data @file 发送。

### 后续修复 (9-02深夜续接 - auth/send-code 500)
部署后上线发现 /api/auth/send-code 返回 500。根因: server/index.mjs 缺少 sendVerificationCode 导入(ReferenceError) + mailer 回调非 async 导致 Promise 未处理拒绝; 另 nginx 代理端口配置错误(3002→3001) + SSL 证书权限问题。
修复: 添加 import + nginx 端口修正 + SSL 权限修复。本地测试: {"ok":true,"mock":false,"reused":false,"retryAfterSeconds":60} ✅
服务器已重启, 验证码功能恢复正常。

额外修复 (mailer回调传参错误): mailer 回调原传 {to, code} 对象给 sendVerificationCode, 但该函数期望字符串 email。改为传 to 字符串 + async/await。验证: Node.js HTTPS 测试 {"ok":true,"mock":false,"reused":false,"retryAfterSeconds":60} ✅。curl 在 SSH shell 中会剥掉 JSON 引号导致 500, 需用 Node.js/Python 脚本或 --data @file 发送。

## 12. 9-06 会话：P0 构建卡点结案（构建从未出错，是验证方法错了）

### 结论
"P0 卡点：vite 产物不含源码新改动"是**误判**。构建管线、dist 产物、线上部署从未有问题，无需重新部署。

### 真相
- **EcCanvas 是 React.lazy 动态导入页面 → 编译进独立懒加载 chunk `dist/assets/index-BrfQVtFR.js`（396KB）**；`index.html` 只引用主入口 `index-DyUHUGIF.js`（App 外壳），主 bundle 本来就不含任何 EcCanvas 代码。
- 前几轮会话一直 grep 主 bundle `index-DyUHUGIF.js` 找画布字符串（新建文本/上传图片等），当然找不到 → 误判"产物是极旧版本"。
- "BUILD OK 但 hash 不变" = 确定性构建的正常表现（同源码 → 同内容 hash），不是 rollup/vite 缓存病、不是 dist 残留。

### 铁证（node fetch 完整下载 + Buffer.equals + sha256 前 20 位）
- 主 bundle：本地 498544B `04e99316a1011f7792fe` ＝ 线上 `https://shuimg.cn/assets/index-DyUHUGIF.js` 498544B 同 sha，完全一致
- EcCanvas chunk：本地 396512B `22b8db5599173d9b72fb` ＝ 线上 `https://shuimg.cn/assets/index-BrfQVtFR.js` 396512B 同 sha，完全一致
- 线上 chunk 内容标记全部命中：新建文本:Y 生成图片:Y 生成视频:Y 添加音频:Y 6400(小地图世界窗):Y edit-text:Y 上传图片:Y 小地图:Y
  → 空状态 AI 生成行 / 小地图 6400 世界窗 / 工具栏编辑文字 / 派生 gating 等修复**已全部在线上**。

### 方法论（验证产物三原则，写给所有后续会话）
1. 验证产物必须对准**懒加载 chunk** 文件（页面级代码不在主 bundle），先确认目标模块被编译进哪个文件。
2. 下载线上产物必须用 node fetch + Buffer 长度 + sha256 校验完整性；**本机 curl 对大文件会偶发截断**（曾得到 379235B 假大小 + exit code 1，引发一轮"同名 hash 不同大小"的假矛盾）。
3. marker 验证法要用真实 UI 字符串（如 `新建文本`、`6400`）；`//` 注释 marker 会被生产构建剥离，必然"找不到"，造成二次误判。

### 本次动作与状态
- 补提交 `9227c225`：edit-text 图标行（`ACTION_ICONS['edit-text']: Pencil`，9-05 轮修复漏提交部分），提交前 npm test **2906/2906 全绿**（59s）。
- 源码 tracked 改动已全部入库；线上 https://shuimg.cn/ 即最新版本。
- 工作树 622 个 untracked 全为历史会话 .tmp-* 杂物，不属于任何提交范围。

### 下一步（优先级不变）
1. P0-1 派生链"点完即执行"（见 master-plan §4）
2. P1.6 画布水印面板（唯一未实现功能）
3. P1.5 邀请码/兑换卡后端 + 管理后台、微信 OAuth
4. 支付 API 接入

## 13. 9-06 会话续：P0-1 + P0-2 落地并上线（派生链第一次真正"跑起来"）

### 交付（commit c64ee737，已部署 https://shuimg.cn/ 并字节级验证）
- **P0-1 派生即执行**："生成文案"动作点完即自动发起 `/api/canvas/regenerate-text`（该 API 此前在画布从未被调用过——G1 缺口实锤）：
  - 新文件 `src/pages/EcCanvas/canvasDerivedAutoRun.js`：CANVAS_COPYWRITING_PROMPT 默认指令 / findUpstreamCanvasCopy（BFS 向上找最近 ready 文案，防环、跳过 running/error）/ buildCanvasCopywritingRequest（图源进 referenceImages、文本源与 direction 拼进 prompt）/ normalizeCanvasCopywritingResult / resolveDerivedVideoPrompt。
  - index.jsx 新 handleDerivedTextGeneration：文本节点以 running 态立即落位（text 预填"正在提炼卖点文案…"+ 呼吸动画 `ec-canvas-copy-node.is-running`），成功写回真文案 status ready，失败保留 error 态 + toast。分发替换 2 处（CanvasDeriveMenu / 右面板 onDeriveSelect）。
  - `findUpstreamCanvasCopy` 只认 status==='ready' 的 text 节点——P0-1 的 running 中间态不会污染 P0-2 的上游引用（时序安全）。
- **P0-2 视频 prompt 上游引用**："生成视频" composer 创建时经 `placement.prompt` 通道（addCanvasComposer 已有）自动预填最近上游文案内容；planReviewed 计费确认保护保留，用户可改可确认。
- 测试 `test/canvasDerivedAutoRun.test.mjs` 9 例（链查找/环防/空态跳过/请求组装/结果规整/视频预填），全量 **2915/2915 绿**；npm run build ✅（主 bundle index-BmrZgFRX / 画布 chunk index-BQc0P9gK）；npm run check ✅。
- 部署：tar 269MB（dist 含 12.9MB ort-wasm + 营销大图属正常，public/ 来的）→ scp → .tmp-deploy-remote2.sh → DEPLOY-DONE，pm2 shubao-production online；线上 fetch 字节级 identical：主 bundle 498553B ✓ 画布 chunk 399533B ✓；/api/session 401（未登录正确响应）✓。
- 下一步：P0-3 TTS 执行链（视频→TTS→audio 节点可播放，走 chainService 单步 audio）→ P0-4 字幕 → P0-5 placeDerivedRightOfSources 全路径确认。

### 坑（新增）
- **node -e 内联正则会被 PowerShell/工具层转义串台**（`\\.` 变 `\\\\.` 等），复杂匹配一律写成 .cjs 脚本文件再 node 跑；cwd 也可能不在项目目录（node -e 里用相对路径前先确认 pwd）。
- scp 269MB tar 约 1-3 分钟，属正常耗时，别当卡死重试。

## 14. 9-06 会话结：P0-3 TTS 部署上线 & 推送完成

### 结论
P0-3 TTS 执行链已部署上线，线上 https://shuimg.cn/ 已包含全部 P0-1/P0-2/P0-3 修复。
提交 `06812be7` 已推送 origin/codex/ecommerce-stability（origin 之前落后一个 commit 87f1ae65 至 P0-1/P0-2）。

### 验证（node fetch + sha256，curl 对大文件截断问题已规避）
- **主 entry** `index-B1xUZ1au.js`：本地 499178B `ad2991ec7afa7e937d9` = 线上，完全一致
- **EcCanvas 懒加载 chunk** `index-BYua88Dj.js`：本地 402483B `0225b113d971c6b5` = 线上，完全一致
  - 内容标记命中：TTS 配音:Y，新建文本:Y，6400:Y，编辑文字:Y，upload image:Y，小地图:Y
- npm test 2919/2919 全绿 ✅

### P0-3 交付内容
- `canvasDerivedAutoRun.js` 新增 P0-3 函数：CANVAS_TTS_DEFAULT_SCRIPT / buildCanvasTtsRequest（优先上游 ready 文案 > 视频 prompt > 默认口播稿）/ normalizeCanvasAudioNodeFromTts（组装可播放 audio 节点）
- index.jsx 新 handleDerivedTtsGeneration：视频派生 TTS 点完即创建 audio 节点 + 自动调用 synthesizeCanvasTts，成功后原生 `<audio>` 可播放
- chainService 单步 audio 已接入；ttsBridge mockTtsAudioDataUrl 返回真实 WAV data URI
- test/canvasDerivedAutoRun.test.mjs 新增 3 例 P0-3 测试（请求优先级 / 默认回退 / 音频节点组装 + 位置 honoring + 空 audio 拒绝）

### 部署日志
- node_modules/.cache + dist 清理 → npm run build → tar → scp → .tmp-deploy-remote2.sh → pm2 restart（online）
- 推送：`git -c http.proxy=http://127.0.0.1:7993 push origin codex/ecommerce-stability` ✅ `87f1ae65..06812be7`

### 工作树清理
- 622 个 untracked .tmp-* 文件全部为历史会话杂物，未影响任何提交
- tracked 改动清零 ✅

### 当前优先级队列（P0 全部落地）
1. ✅ P0-1 派生即执行（c64ee737, live）
2. ✅ P0-2 视频 prompt 上游引用（c64ee737, live）
3. ✅ P0-3 TTS 配音执行链（06812be7, live）
4. ✅ P0-4 字幕动效（17ed05bc, live）
5. P0-5 placeDerivedRightOfSources 全路径确认
6. P1.6 画布水印面板（唯一未实现功能）
7. P1.5 邀请码/兑换卡后端 + 管理后台、微信 OAuth
8. 支付 API 接入

## 15. 9-08 会话：画布白屏事故结案 + 登录页重构上线（783ee806）

### 线上状态（已上线，字节级验证）
- 应用提交 `783ee806`；release `/var/www/shubao/releases/20260908-190649-783ee806`（current 软链）；入口 bundle `assets/index-BvzJbHSg.js`（506259 B，sha256 `f1f5c4acd43787eb…`）；PM2 `shubao-production` pid `2223219`；健康 `ready=true`。
- 三处哈希一致：本地 dist / 服务器 current / 公网 https://shuimg.cn 的入口名、入口文件 sha256、文件大小完全相同。
- 线上浏览器验收 12/12：/login 弹窗渲染、登录/注册双 Tab、邮箱框默认聚焦、OTP 6 格、修改邮箱入口、移动端无横向滚动；/ec-canvas 无错误边界、无 ReferenceError、画布壳层 44 个 ec-canvas 类元素。

### 画布"打不开"根因（本次结案）
- 9-08 水印改动**误删了 `index.jsx` 的 `const selectedNode = ...` 定义**，而文件下方 20+ 处仍在引用它 → 渲染期 `ReferenceError` → 整页白屏。与 Minimap/CSS/浏览器缓存无关。
- 同类隐患还有一处：`Modals.jsx` 原 React import 缺 `useCallback`，新登录代码用到 → 错误边界 `useCallback is not defined`。两者都在本地 Playwright 复现后修复。
- 教训：2900+ 单测全绿拦不住整页 ReferenceError（测试不渲染整页）。改大文件后必须跑一次真实浏览器页面。

### 本次交付
1. 画布：恢复 `selectedNode` 定义；补齐 `VideoWatermarkPanel` 的 `if (!open) return null`（原来只有图片面板有门控，视频面板会在画布常驻）；小地图视口框按内容区映射并双重裁剪；素材水印系统（模型/双面板/节点 overlay/派生继承）一并入库；补提交 `src/services/canvasQuantvExtensions.js`（index.jsx 依赖但从未入库）。
2. 登录：新建 `LoginDialog.jsx`（左品牌叙事 + 右暖白表单；role=dialog / aria-modal / 焦点陷阱 / Esc / 滚动锁；920px、520px 断点）、`OtpCodeInput.jsx`（6 位分段，支持粘贴/退格/数字键盘/one-time-code/填满自动提交）、`src/styles/login-dialog.css`；`Modals.jsx` 的 LoginModal 重写为登录/注册双 Tab + 邮箱/手机号通道（手机号为备案占位并提供回退）+ 就地校验 + 邀请码折叠 + 重发倒计时 + 忘记密码子流程统一外壳；顺带修掉 `close` 在 forgotMode 分支的 TDZ 隐患。
- 提交：`a2b518ea`（画布）、`783ee806`（登录）。

### 部署事实（勿只看 PM2 online）
- 第一次按 `auto → full` 档部署：真实电商验收**通过**（task `ec_708c9ec5-b94e-4c81-b278-6d23271baca6`，3 个稳定资产），但 600 秒 canary 的电商验收 3 次全失败 → 自动回滚（回滚目录 `releases/rollback-20260908-183948-783ee806`）。
- canary 失败根因**不是本次代码**：服务器日志 `VISUAL_ANALYSIS_TIMEOUT` + `analysisStatus: 'fallback'`；直连探针测得 VLM 上游（`MINI_BASE_URL`，模型 `gpt-5.6-luna`）**8 token 文本补全耗时 22.5s**（`/models` 0.47s、无鉴权 401 0.26s），在 75s 预算下留给图像分析的余量不足。旧版本同样受影响。
- 第二次部署改用 `-ValidationProfile frontend`（注意：**根目录转发脚本不转发 `-ValidationProfile`**，必须直调 worktree 内 canonical `scripts/deploy-production.ps1`）：跳过真实生图档，600 秒 canary、图库 117、视频契约 2 产品、账务、nginx、no-paid verifier 全通过；`Deployed 783ee806 to https://shuimg.cn/`，远端锁已释放。

### 待办 / 下一步
1. VLM 上游恢复后补跑一次真实电商 canary（`scripts/verify-production-ecommerce.ps1`，需 `SHUBAO_CANARY_SESSION_TOKEN`），补齐 full 档证据。
2. 服务器磁盘 93%（3.0G 剩余）；本次已清理 `/tmp/git-mirror`(1.5G)、`/tmp/shubao-runtime-tools-*`(982M)、失败 release(274M)。长期仍需备份/发布保留策略。
3. `src/pages/EcCanvas/components/CanvasMinimap.jsx` 是**未被引用的诱饵文件**（真正用的是 `CanvasContextMenuPanel.jsx` 内嵌的 CanvasMinimap）；`src/services/invitationService.js` 也无人引用，勿再被误导。
4. 工作树仍有 600+ 历史 untracked `.tmp-*`；本次未动。

### 坑（新增）
- 根 `scripts/deploy-production.ps1` 只转发 HostName/User/KeyPath/RemoteDir/RepoPath，**不转发 `-ValidationProfile` / `-CanarySeconds`**；换档必须直调 worktree 内 canonical 脚本。
- PowerShell 双引号字符串会先展开 `$(...)`：ssh 远程命令里出现 `$(...)` 会被本地 PowerShell 抢先执行（本次排查 VLM 时踩到两次）。远程脚本一律写成 .sh 文件 scp 过去再 `bash`。

## 16. 9-08 深夜 会话：水印/小地图按批注重构 + 登录页极简重构（两次 full 档上线）

### 线上状态（两条都已上线并字节级验证）
- 水印/小地图重构：`eccca69c` → release `/var/www/shubao/releases/20260908-212816-eccca69c`
- 极简登录：`55801ab5` → 当前 current，入口 `assets/index-DlZGF8ke.js`（502089 B，sha256 `030315af18d761e1…`），PM2 pid `2266687`
- 两次都用 **full 档**（真实电商验收各通过一次：`ec_4d79171b…`、`ec_046e28a9…`、`ec_2b1ad31d…`，均 3 个稳定资产）+ 600s canary + 图库 117 + 视频契约 + 账务 + nginx + no-paid verifier。
- 三处哈希一致（本地 dist / 服务器 current / 公网 https://shuimg.cn），`/login`、`/ec-canvas` 均 200，线上浏览器验收通过。

### 用户 9-08 批注 7 条（画布水印/小地图）逐条落地
1. 小地图：打开水印/其它浮动面板时自动收起（`floatingCanvasPanelOpen`）；世界窗口改**等比缩放 + 内容居中**（`scale = min(w/W,h/H)` + `padX/padY`），不再 X/Y 各自比例导致歪向右下；视口框改用**画布容器实测尺寸**（ResizeObserver + `viewportSize`）；与底部按钮区留 14px 间距（原 `bottom:54px` 与缩放条 56px 相撞）。
2. 水印面板不再遮挡底部按钮区：`bottom = --ec-canvas-bottombar-top(56px) + 14px`。
3. 位置改为**可拖拽**并实时同步到画布素材（面板 draft → `onPreview` → `watermarkPreview` → `nodeWatermark` 优先返回预览配置；**CanvasStudio 里不能让 node.* 抢先**，否则节点不跟随）；`取消` 回滚、`确定` 才写回节点。
4. 铺满图片：网格重复填充（文字/图片水印都支持），间距可调。
5. 参考面板功能逐项对齐：水印开关、水印类型、位置预览、相对位置(%)、文字大小/颜色/透明度/描边/旋转、图片水印上传/移除/大小、取消/确定。
6. 图片水印：上传图片 + **去纯色背景**（`watermarkBackgroundRemoval.js`：边缘像素中位数估背景色 + 色彩距离羽化 alpha，返回 PNG dataURL）。
7. **合并为一个面板**（缩放条按钮 3→2），用「素材类型」切换图片/视频；视频动态水印按调研（剪映/SproutVideo 等）实现 7 种：静态、定时跳位（默认 20s 防搬运）、缓慢漂移、跑马灯（横/纵/对角）、心跳脉冲、闪烁、溯源水印（时间戳），含速度/间隔/方向/安全边距。

顺带修复：`index.jsx` 里 lucide 的 `Image` 图标**覆盖了全局 Image 构造器** → 画布上传图片时 `new Image()` 抛 `$n is not a constructor`（上传直接失败）。改为 `Image as ImageIcon`。

### 用户 9-08 批注（登录页）与合规/成本结论
- 批注：左侧品牌信息堆叠太繁杂（且四个板块不该只突出电商）→ 改**极简单卡片**；不要向用户解释「备案」→ 手机号通道点击不请求、不报错、不解释。
- 实现：`LoginDialog.jsx` 400px 居中单卡片（保留 role=dialog/aria-modal/焦点陷阱/Esc/滚动锁）；`login-dialog.css` 极简视觉；手机号/邮箱双通道（**邮箱为当前可用默认通道**，手机号为面向市场的正式入口但点击无请求）；去掉登录/注册双 Tab 与占位说明卡。
- 顺带修复：验证码填满自动提交时 `handleVerify` 读到本帧旧 `code`（恒 5 位）→ 误报「请输入 6 位验证码」且不登录。改为由 `OtpCodeInput` 回传完整验证码。
- **合规结论**：《互联网信息服务深度合成管理规定》第九条明确要求基于**移动电话号码/身份证件号码/统一社会信用代码/国家网络身份认证**做真实身份认证 —— 邮箱不满足实名，对外上线必须补手机号（或微信登录等已实名通道）。
- **成本结论**：短信约 ¥0.03–0.05/条（每次登录）；邮箱约 ¥0.003–0.01/封（不满足实名）；账号+密码单次 0 成本但注册仍要手机号验证，且增加密码体系/找回/安全负担。降本靠**长会话（30 天免登录，已有 refresh token）+ 微信登录**，而不是账号密码。
- 短信通道开通后：把 `loginChannel` 默认值从 `'email'` 改为 `'phone'`，并给手机号 CTA 接上 `sendOTP/verifyOTP` 的手机号版本即可（UI 无需重做）。

### 验证与坑
- 本地：npm test **2936/2936**；Playwright 水印面板 **24/24**、素材同步 **8/8**、极简登录 **20/20**；线上登录 **7/7**。
- 坑：`fill()` 触发 OTP onChange 时父组件 state 还是旧值 → 自动提交必须显式回传验证码；Vite preview 需重建后刷新才拿到新产物；`git diff --check` 对 CRLF 文件报 trailing whitespace，需 `git config core.whitespace cr-at-eol`。

## 17. 9-09 凌晨：水印预览同步修复 + 登录页高级化（full 档上线）

### 线上状态
- 部署 commit `3785aa56`，入口 `assets/index-DQ6GeLJQ.js`（502489 B，sha256 `83ddf4a1910bc0f5`），PM2 pid `2309254`
- 三处哈希一致（本地 / 服务器 current / 公网 https://shuimg.cn），健康接口 ready，/login 和 /ec-canvas 深链 200。
- 真实电商验收通过：ec_a0e7fbea、ec_98176d3a（各 3 个稳定资产）；图库 117；视频契约 2 公开产品。

### 本轮改动
1. **水印面板预览同步修复**（WatermarkPanel.jsx）
   - 预览区改固定正方形（aspectRatio: 1），删除 `<video>`/`<img>` 素材原图和占位文案
   - 新增 `previewSize` state + ResizeObserver 实测方块 clientWidth，传给 WatermarkLayer
   - 面板加 onWheel={e => e.stopPropagation()}，滚轮滚面板不滚画布
   - 铺满图片/上传 Logo 瓦片随方块宽等比渲染

2. **登录页高级化**（LoginDialog.jsx + login-dialog.css）
   - 暖米背景 + 细点阵 + 琥珀/紫罗兰四角柔光
   - 墨色卡片分层阴影，380px，Fredoka 品牌 wordmark 顶行 + "返回首页"
   - 信息极简：标题一行、渠道 Tab、输入区、CTA、微信、协议
   - 手机号通道正式外观，点击无请求（按批注）
   - CSS 全部用变量，避免数字硬编码

### 坑
- 长 CSS 数值被环境随机改坏，被迫改用 CSS 变量驱动写法
- 误引入 react-router-dom 的 Link 导致构建失败，改用 `<a href="/">`

验证：npm test 2936/2936；canvas-watermark 11/11；login-otp + dialog-contract 23/23。

## 18. 9-09 凌晨：登录 v4（三通道 + 密码注册）+ 水印预览修复

### 线上状态
- 部署 commit `14a0b5c9`
- 真实电商验收 ec_93e68257，3 个稳定资产；图库 117；视频契约 2 公开产品

### 本轮改动
1. **登录页 v4（三通道架构）**
   - Tab 1「密码登录」（默认）：账号（手机号/邮箱）+ 密码 + 显示/隐藏 + 登录/注册切换
     - 注册：手机号 + 密码（≥8位）+ 协议勾选，一次实名（短信成本≈¥0.045）
     - 登录：账号 + 密码，零短信成本
   - Tab 2「手机号」：手机号 + 短信验证码（正式外观，点击无请求）
   - Tab 3「邮箱验证码」：邮箱 OTP（绑定至手机号，不独立成体系，防薅羊毛）
   - 第三方：微信（占位）、GitHub
   - 模态弹窗背景（页面暗化+模糊），非全屏纯色

2. **WatermarkPanel 预览同步修复**
   - 预览区固定正方形（aspectRatio:1），ResizeObserver 实测宽传给 WatermarkLayer
   - 删除素材原图 + 占位文案，滚轮滚面板不滚画布

3. **LoginDialog 外壳精简**：去掉重复 brandline+topbar，只保留 children+关闭按钮

### 合规结论
- 《深度合成管理规定》第9条：必须基于手机号/身份证/统一社会信用代码/国家网络身份认证做实名
- 邮箱不能替代手机号实名
- 方案：手机号=实名载体（注册一次），密码登录=日常免费通道，邮箱绑定手机号

验证：npm test 2936/2936；canvas-watermark 11/11；dialog-contract 2/2；浏览器三 tab 均渲染正常。

## 19. 9-09 上午：登录 v5 高级视觉重构

### 改动
- 卡片宽度 480→500px，去除冗余品牌重复
- 顶部渐变装饰条（琥珀色）
- 头部居中排版：品牌图标 + 标题 + 副标题
- Tab 下划线激活态（琥珀色）
- 输入框 48px 高，focus 阴影环
- CTA 按钮 hover 微上浮 + 阴影
- 背景：暗化 55% + blur 12px 模态遮罩
- 三通道：密码登录（默认）/ 手机号 / 邮箱验证码
- 密码登录含注册切换、显示/隐藏密码、忘记密码
- CSS 全部用变量，无裸数字

### 验证
- 构建通过，测试 13/13 pass
- 浏览器：卡片 500px，三 tab 正常，无 JS 错误

## 20. 9-09 下午：登录 v6（流影AI 架构 + 定价弹窗视觉语言）

### 用户批注 5 条及修复
1. 去掉顶部图标 + "薯包 AI" 品牌字 → 只保留眉题 WELCOME BACK + 标题
2. 去掉无意义副标题 → 已删
3. 手机号和短信验证不要分开 → 注册页 4 字段同页（手机号/验证码/密码/邀请码）
4. 微信按钮歪了 → 改全宽居中（验证 centered: true）
5. 整体太淡像 demo → 换定价弹窗同款视觉语言

### 架构（参考流影AI）
- 登录/注册 双 Tab，字段全部同页
- 登录：手机号/邮箱 + 密码，含"用验证码登录"切换
- 注册：手机号 + 验证码 + 密码 + 邀请码（选填）
- 邮箱验证码作为独立模式（loginMode=email），保留"用密码登录"回切

### 视觉语言（与 pricing-modal.css 一致）
- 弹窗背景 #fbf8f1 暖米 + backdrop-blur 4px
- 卡片 24px 圆角 + 暖阴影 + 边框 #e7e0d4
- 琥珀橙 #e99a18 主强调 / 紫罗兰 #8b5cf6 光晕
- 眉题 uppercase 0.18em / 标题 26px 900
- 装饰光晕 2 个（ld-orb--a/b）
- 输入框 48px / focus 琥珀环
- CTA 墨黑 + 阴影
- 微信/GitHub 全宽居中

### 验证
- 构建通过，测试 23/23
- 浏览器：卡片 460x674，标题/眉题/Tab/光晕/微信居中全部正常，无 JS 错误

## 21. 9-09 下午：登录 v7（邮箱统一账号体系 + 修滚动条）

### 用户批注及修复
1. 弹窗可再宽一些 → 460 → **520px**
2. 为什么有下拉但下面没东西 → 光晕负定位撑高滚动区，加 `.ld-orbs` 裁剪容器修复（scrolls: false）
3. 注册只有手机号但登录有邮箱（体系不一致）→ 统一为**邮箱账号体系**
4. 邮箱要不要验证 → 要（证明所有权 + 找回密码唯一途径）
5. 内测账号 867550189@qq.com 怎么登录 → 用「邮箱验证码登录」

### 后端事实（读 server/auth/authSchema.mjs 确认）
- 账号主体 = `auth_users.primary_email UNIQUE`（邮箱唯一键）
- 无手机号字段，v6 的手机号注册是错的
- 端点：/api/auth/send-code（purpose=login|register）、/register、/login、/verify-code、/forgot-password

### 账号体系设计（统一，不分裂）
- **邮箱 = 账号主体**（唯一 ID）
- **手机号 = 后续绑定**（用于实名，中国法规；后端需加字段）
- **密码 = 可选**，设了可密码登录
- 登录方式：邮箱+密码 / 邮箱+验证码（两者同一账号）

### 改动
- 登录 tab：邮箱 + 密码，链接「忘记密码？」「用邮箱验证码登录」
- 注册 tab：邮箱 + 邮箱验证码 + 设置密码 + 邀请码（同一页）
- 验证码模式：邮箱 + 验证码，可回切密码登录
- 新增 API：`registerWithPassword()` / `loginWithPassword()`（POST /api/auth/register|login）
- `sendOTP(email, purpose)` 支持 purpose=register
- 修复：`loginWithPassword`/`registerWithPhone` 被引用但未导入

验证：构建通过，测试 23/23；浏览器 520x664 无滚动条，登录/注册字段一致，无 JS 错误。

## 22. 9-09 晚：登录 v8（完全照流影AI 结构）

### 用户指令
"我觉得你不如照他这个做法去做吧，你现在搞的是乱七八糟的"（附流影AI 登录/注册两屏截图）

### 流影AI 结构（已 1:1 落地）
- 头部：`登录 薯包AI`（品牌名浅灰）+ 副标题「使用邮箱账号登录或注册」
- Tab：登录 / 注册
- **登录**：邮箱 + 密码 + 忘记密码? → [邮箱登录]
- **注册**：邮箱 + [获取验证码] + 邮箱验证码(6格) + 手机号 + 密码 + 邀请码(选填) → [创建账号]
- 底部：您已阅读并同意《服务条款》和《隐私政策》 + ← 返回
- 另保留「用邮箱验证码登录」（内测账号 867550189@qq.com 无密码时用）

### 视觉（回到清爽白卡）
- 白卡 520px / 20px 圆角 / 浅边框 #ebe6de / 柔和阴影
- 去掉 v6 的暖米+光晕装饰（用户嫌乱）
- 输入框 46px / 圆角 10px / focus 墨色环
- Tab 下划线激活态
- 主按钮墨黑 48px

### 修复
- 邮箱验证码分支被误删 → 补回（loginMode=email）
- `onClose` 在 LoginModal 作用域不存在 → 改 `close`
- register 传 phone（后端字段待加）

验证：构建通过，测试 23/23；浏览器 520x572 无滚动，注册 5 字段齐全，无 JS 错误。

## 23. 9-09 晚：登录 v9（站点视觉语言 + 微信登录回归）

### 用户批注
1. 黑白极简没设计感，要用站点自己的视觉语言 + 先进前端技术
2. 微信登录为什么没了 —— 重要入口，必须恢复

### 视觉语言（从 design-tokens.css / app-shell.css 提取）
- 玻璃卡片：rgba(255,255,255,0.9) + backdrop-blur(24px) saturate(1.25) + 26px 圆角
- 顶部珊瑚-琥珀氛围渐变（card::before，120px 淡渐隐，非装饰球）
- 品牌 mark：46px 圆角方块，linear-gradient(135deg, #E8544B, #E99A18)，内嵌 wave logo
- 标题用 --font-display (Fredoka)
- Tab 激活态：珊瑚-琥珀渐变 + 品牌色阴影
- CTA：同渐变 + 上浮 + 光晕阴影
- 输入框 focus：珊瑚环 rgba(232,84,75,.13)
- 链接/ghost 按钮：琥珀 #B7570B
- 协议 accent 珊瑚
- 暖色阴影体系 rgba(57,45,26,…)

### 结构（沿用 v8 流影AI）
- 登录：邮箱+密码+忘记密码 → 邮箱登录；链接「用邮箱验证码登录」
- 注册：邮箱+获取验证码+邮箱验证码(6格)+手机号+密码+邀请码 → 创建账号
- 或：微信登录 | GitHub 登录（2 列均分，对称）
- 协议 + ← 返回

验证：构建通过，测试 12/12；浏览器实测 mark=1、CTA=gradient、微信绿、卡 500x739 无滚动、无 JS 错误。

## 24. 9-09 晚：v9 上线 + 部署档位纠偏

### 用户批评（两点，均成立）
1. 登录页改动不该跑电商全量档，烧中转站 API 配额 → 改用 -ValidationProfile frontend
2. 不该消耗 Vision API 桥看截图 → 改用 Playwright DOM 断言（零消耗）

### v9 线上 DOM 验收（13/13，零 Vision 消耗）
玻璃卡 500px rgba(255,255,255,.9) + blur(24px)saturate(1.25)；CTA/Tab 珊瑚-琥珀渐变；
品牌 mark；微信/GitHub 在卡内；登录=邮箱/密码；注册=邮箱/验证码/手机号/密码/邀请码；
无幻影滚动；邮箱验证码登录入口可用（内测账号）；无 JS 异常。

### 部署档位规则（此后执行）
- 纯前端改动（组件/样式）→ frontend 档
- 涉及 server/、计费、生成链路 → auto/full 档

## 25. 9-09 晚：登录 v10（5 条批注 + frontend 档）

### 批注修复
1. logo 去掉 → ld-mark 移除
2. 标题字体改普通 22px/700（弃 Fredoka）
3. 微信登录全宽居中（oauth 改单列堆叠，delta 0.0px）
4. 验证码可粘贴 → OtpCodeInput 加显式 onPaste：从任意文本提取数字
   实测通过: "482 913"/"482-913"/"您的验证码是 482913，5 分钟内有效"/全角"４８２９１３" → 482913
5. 卡片 500 → 560px

### 部署
- 首次使用 frontend 档：日志明确 "Skipped real ecommerce production verification for frontend-only release"
- 不再烧中转站 API
- prod send-code 对随机新地址返回 403（服务端防滥用白名单），属后端策略；内测账号不受影响
- 线上入口 index-B91nbcXV.js sha256 2232206e…

## 26. 9-10 凌晨：生成失败根因修复 + 水印面板 4 项（部署 66dc1ede）

### 用户反馈：新内测用户 610567026@qq.com 连续 5 次生成失败
生产库实测错误（ecommerce_jobs.output.errors）：
`duplicate commercial duty: main-3x4-1 and main-text-1` —— 来自 planContract.validatePlanContract 第 206 行（职责文案全局去重）。
用户配置：主图 1:1 ×5 + 详情 ×9 + 主图 3:4 ×3 = 17 张。

**根因**：该去重按"职责文案"全局比对，与 commercialDutyId 的角色前缀语义矛盾。
同一职责出现在不同放置位（1:1 主图 vs 3:4 主图）是合法的，却被判重复 → 整单直接失败。
叠加 orchestrator.upgradePlanItems 的角色别名问题：旧计划里 `main-3x4`/`main-text`（连字符）
匹配不上 `main_3x4`/`main_text`（下划线），导致 heroPlacement 为空、两张主图职责文案退化成同一条。

**修复**（server/ecommerceEngine）：
1. planContract：dutyKey 改为 `role|normalizedDuty`（角色域内去重；同角色重复仍拦截）
2. orchestrator：新增 normalizeLegacyRoleAlias()，兼容 main-3x4/main-text/white-bg/detail-slice-*
3. 新增 test/ecommerce-plan-duty-scope.test.mjs（3 例：用户配置 17 张通过 / 跨角色同职责放行 / 同角色重复拦截）

**生产服务器实测**（部署后跑真实代码）：
- LEGACY PLAN: PASS（修复生效）
- SAME-ROLE DUPLICATE: blocked（没有放松真正的重复）
- FRIEND CONFIG (5+9+3): 17 images -> PASS

### 水印面板 4 项
1. 面板高度封顶 `min(560px, 100vh - 底栏 - gap - 132px)`，不再顶到顶栏
2. 水印开关关闭时，下方全部控件包进 `<fieldset disabled>` 并置灰（opacity .45 + grayscale），不可操作
3. 预览改为固定 240×240 正方形（此前 width:100% + max-height:170 会被裁成非正方形，导致水印位置/大小错位）；
   默认字号 26 → 44（预览与素材都更明显）；**改为点「确定」才应用到素材**（用户要求，避免预览与素材瞬时不一致）
4. 画布 handleWheel 增加 `[data-canvas-control="true"]` 判定：面板内滚轮只滚面板，不缩放画布
   （此前面板的 React onWheel 因事件委托到 root，晚于画布容器上的原生 wheel 监听器，stopPropagation 无效）

验证：npm test 2939/2939；浏览器 DOM 验收 9/9（面板高度/禁用态/240 正方形预览/水印渲染/滚轮隔离）；
三处哈希一致 index-DSsLrqqK.js sha256 a63344df…；PM2 2563387；服务器代码 md5 与本地一致 b9f035d8…

## 27. 9-10：提示词 / 面板尺寸冲突检测（步骤①，零 API 消耗）

### 用户问题
提示词里写尺寸、面板里也有一套尺寸，冲突会不会失败？该不该以提示词优先？

### 调研结论（实测 + 同行）
- **我们系统里提示词从不作为硬参数来源**：全局无任何"从提示词解析比例/尺寸"的代码；
  最终 prompt 开头硬锁 `ASPECT RATIO LOCK: <ratio>`（生产库 request_snapshot 实测）。
- 用户朋友那次失败与尺寸无关（是职责去重 bug，已在 §26 修复）。
- 同行：Midjourney 用显式语法 `--ar`（无 UI 比例）；DALL·E/Imagen/Firefly/Ideogram/SD 都是
  **UI/参数为准**，提示词里的尺寸基本被忽略；电商模板类比例由平台固定。
- 结论：**结构化控件是硬参数唯一事实源**，提示词只表达内容意图；不要做"自然语言猜尺寸"。

### 本轮实现（步骤①）
- `src/pages/Home/ec/promptSizeConflict.js`：纯本地检测
  - 识别 `16:9 / 9:16 / 3:4 / 1:1 …`、中文口语（方形/竖版/横版/长图…）、像素对（1200x1600 → 3:4）
  - 与面板生效比例比对；面板为空或提示词未提尺寸时不打扰
  - 建议补丁只改主图类（main_text/main_3x4/white_bg/transparent/sku），**绝不动详情比例**
- `PromptSizeConflictNotice.js`（createElement 纯展示组件，可被 node:test SSR 渲染断言）
  - 文案："⚠️ 提示词里提到「16:9 横版」，但当前套图配置是 1:1 / 9:16。系统会按面板配置出图（可把主图类改为 16:9，详情保持不变）"
  - 动作："把主图改为 X" / "忽略"
- DesignDirection：本地 `sizingPatch` 覆盖 → 同时进入 resolveEcommercePlan / 报价 / 生成 payload / imageSelections
- **零新增 API 调用**（检测为字符串匹配；一键切换只改本地 state 并重新本地报价）

验证：npm test 2950/2950；新增 11 个断言（纯函数 6 + UI 契约 2 + SSR 渲染 3）；
部署 ec5f1f6e（frontend 档，日志确认 "Skipped real ecommerce production verification"）。

## 28. 9-10：登录/水印视觉修复 + 步骤②③（单一事实源 + 校验器降级）

### 用户批注（两批）
**登录**：① 背景有两层（渐变遮罩 + 白层）→ 合并成整卡一层渐变；② 主副标题太小、无主次、"登录"重而"薯包AI"轻很割裂 → 标题 30px/800 两段同权重、品牌名用品牌色 + 着重号圆点、副标题 14.5px、卡片 560→600px；③ 微信登录要用真实微信图标 → 改 react-icons/fa 的 FaWeixin
**水印**：① 面板太矮失衡 → max-height 560→720px（保留 96px 顶部留白，不顶栏）；② 默认水印太小看不清 → fontSize 44→64、opacity .35→.5；③ 拖动标识是十字 → 换 lucide Hand（五指张开）+ 预览区 cursor grab/grabbing

### 步骤②：请求载荷单一事实源（src/services/api.js）
- resolution/imageModel：generation_settings 为用户控件，sizing 同值镜像（此前两处可能不一致且无优先级）
- 图集选择：sizing.images 为唯一来源，image_selections 同源镜像
- 颜色优先级经查**本就正确**（custom_colors > LLM palette > 参考图，且会写入 consistency lock），未改动

### 步骤③：校验器降级（server/ecommerceEngine）
- assetPlanner.heroDuty：职责槽位用尽时派生 `variantN` 职责（此前抛 duplicate commercial duty id → 整单报废）
- assetPlanner.repeatedDuty（白底/透明）：同样降级
- orchestrator.roleCatalogDuty（旧计划迁移）：不再抛 "count exceeds catalog"，派生变体
- 两个旧契约测试按新语义改写（明确：这是行为变更，不是测试妥协）

验证：npm test 2952/2952；实测 main_text/white_bg/transparent 各 20 张 → 职责 id 全部唯一且通过校验；
浏览器 DOM 验收 14/14（登录 8 项 + 水印 6 项）；部署 512ee5dd（frontend 档）+ 4e3ddb45（全量档，电商验收 3 稳定资产通过）。

## 29. 9-10：登录卡片背景"重叠"修复（单一表面）

### 用户批注
"登录页的背景色重叠了呀" —— 卡片上暖下白，中间一条过渡带，看起来像两种背景叠在一起。

### 根因
上一轮为了"保留遮罩渐变并适配整个面板"，把卡片背景写成
`linear-gradient(180deg, 珊瑚10% → 琥珀5.5% → 白94% @58% → 白97%)`。
线性渐变在 58% 处已经到纯白，形成可见分界带；用户读作"两种颜色重叠"。

### 修复
- 卡片改为**单一均匀表面**：`background-color: rgba(255,254,252,0.96)`，**卡片上不再有任何渐变**
  （品牌感由 CTA 渐变、Tab 激活渐变、品牌 mark 承担）
- 保留外层遮罩 scrim + backdrop-blur，页面背景仍是单层

### 验证
- 本地 DOM：`backgroundImage: none`、`::before: none`、上下取样一致、无 JS 异常
- **线上 DOM**：卡片 `rgba(255, 254, 252, 0.96)`、无渐变、无 ::before、标题"登录 薯包AI"、微信图标 1 个
- 三处哈希：入口 JS 未变（本次只改 CSS，JS 打包产物不变是正常的），CSS 资产 `style-o9MlKBYO.css`
  已同步到服务器（minifier 把 rgba 压成 `#fffefcf5`，字符串检查需注意）
- 部署 d3c7d71e（frontend 档），npm test 2952/2952

## 30. 9-10：占位提示符 bug 修复 + Skill 体系设计文档

### 用户批注 1（bug）：四个面板输入后提示文字不消失
**根因**（两层）：
1. 旧的 `hero-textarea` + `.custom-placeholder` 模式里，占位层**无条件渲染**（没有 `!value` 判断），
   且 `z-index:0` 在输入文字背后 → 用户看到"背后的提示文字没去掉"。
2. 更主要的是**输入法组合期**：`MentionPromptField.onInput` 在 `isComposing` 时不提交状态（避免打断输入法），
   所以中文打字过程中受控 `description` 仍为空，占位层一直留着。用户截图里 `ni 1 你 2 尼…` 正是候选条。

**修复**（src/pages/Home/Home.css，纯 CSS、零 API）：
```css
.hero-textarea:not(:placeholder-shown) + .custom-placeholder { display: none; }
.ec-textarea-wrap:has(.mention-prompt-field:not(:empty)) .ec-textarea-placeholder,
.ec-textarea-wrap:has(textarea:not(:placeholder-shown)) .ec-textarea-placeholder { display: none; }
```
用 `:has()` 直接看输入框 DOM 内容，不依赖受控状态 → 组合期一有预编辑文本就立刻隐藏。

验证：四个面板实拍（输入后占位层 1→0、值正确）；模拟输入法组合（组合中 0、提交后 0）；
新增 test/prompt-placeholder-contract.test.mjs；npm test 2953/2953；
线上 CSS 资产 style-7yxAEPNt.css 含两条守卫；部署 d545f7c7（frontend 档）。

### 用户批注 2（产品）：Skill 体系 / 会员中心 / 兑换码 —— 深度调研 + 设计
产出文档：`docs/skill-system-plan-2026-09-10.md`
- **调研**：流影AI 两套 skill（自建主图模块 + 画布个人 Skill）本质同源、冗余；
  行业共识是"多租户提示词指令层级"（平台安全 > 运营配置 > 用户偏好 > 请求上下文），
  "字符串拼接"会让模型静默选赢家且无法审计。
- **现状盘点**：我们有 **5 套分散资产**（styleSkills 5 个图片风格 / abilityRecipe / PLATFORM_PRESETS /
  画布 skill 仓库 / videoSkillTemplates 2 个视频模板），比流影AI 更碎片化。
- **核心结论**：用户 skill **只能叠加，不能替换**；只注入风格槽位，事实/合规/计费/尺寸槽位结构上不开放。
- **架构**：统一 Skill 实体（kind: image|video|canvas|copy）、结构化注入（platform_rules / builtin_skill /
  user_skill / request）、最多 2 个用户 skill、零成本冲突检测、版本化与生成记录可追溯。
- **会员中心**：账号/积分/我的 Skill/订单/安全；**兑换码**：redeem_codes + 幂等接口 + 头像下拉弹窗 + 会员中心双入口。
- **分阶段**：P0 数据模型+只读技能库 → P1 用户 skill CRUD+校验+分层预览 → P2 生图注入灰度 →
  P3 生视频注入 → P4 会员中心+兑换码。每阶段带测试与快照回归。

## 31. 9-10：Skill 体系 P0/P1 上线（统一技能库）

### 用户要求
按 docs/skill-system-plan-2026-09-10.md 执行；**不能有 bug**；测试只做必要的，别每次都跑全量烧上游 API。

### 测试成本策略（本次执行）
- 只用零 API 测试：纯函数单测 + 内存 SQLite + Playwright DOM 断言
- 部署用 frontend 档（跳过电商 Canary），因为本次**没有改生成链路**，只新增表/路由/弹窗；
  重启健康检查 + 图库 117 + 视频契约仍然跑
- 全量 Canary 只在改到生成链路时才跑

### 交付内容（部署 d13e900f）
**服务端** `server/skills/`
- `skillValidation.mjs`：纯校验（kind/名称/简介/正文长度、参数白名单、越权指令检测）
  - 越权模式 7 条（中英）+ 否定式豁免（"不要忽略以上规则"放行）
  - 失败返回稳定 errorCode，前端可精确定位字段
- `schema.mjs`：`user_skills` 表（owner_email/kind/name/summary/body/params_json/version/status）
- `skillStore.mjs`：owner 隔离 + 版本自增 + **归档式删除**（保证历史引用可追溯）
- `skillCatalog.mjs`：统一内置目录（5 个图片风格 + 2 个视频模板，只读、editable:false）
- `skillRoutes.mjs`：GET/POST/PATCH/DELETE /api/skills + GET /api/skills/builtin/:id
- `server/index.mjs` 挂载（复用 authenticateContentRequest + authorizeAccountEmail）

**前端**
- `src/services/skills.js`：会话头一致的 API 客户端
- `src/pages/Home/ec/SkillLibraryModal.jsx` + `skill-library.css`：一套 UI，类型 Tab（生图/生视频/画布/文案）
  - 内置技能只读（仅"派生"）；用户技能可编辑/归档/"使用"
  - 保存前本地长度校验 + 服务端校验；越权提示词给出可读原因
  - 安全提示常驻："技能只作用于风格与表达，不会覆盖商品事实/平台规则/计费"
- `EcommerceWorkbench.jsx`：提示词区新增「技能库」入口，选用后写入提示词（@引用效果）

### 修掉的自身 bug
内置技能没有 body 时"使用"按钮点了没反应且弹窗不关 → 内置只给"派生"，用户技能才给"使用"（DOM 测试断言内置列无 primary 按钮）

### 验证
- 服务端 `test/skill-library.test.mjs` 5/5（校验/越权/owner 隔离/版本/路由）
- 浏览器 10/10（入口、列表、四个 Tab、内置只读、越权被拒并给出原因、保存、无死按钮、写入提示词、弹窗关闭、无 JS 异常）
- 全量本地测试 2958/2958
- 线上：`/api/skills` 返回 401（路由已挂载、鉴权生效，非 404）；health 200；`user_skills` 表 11 列已建

### 下一步（未做）
P2 生图注入管线（skill 作为结构化 `<user_skill>` 槽位，灰度 + 快照回归）；
P3 生视频注入；P4 会员中心 + 兑换码。

## 32. 9-10：Skill 体系 P2/P3/P4 全部完成（部署 cb8ad960）

### 用户要求
"全部做完"；不能有 bug；测试只做必要的，别每次都跑全量烧上游 API。

### P2 生图注入（server/ecommerceEngine）
- `promptCompiler.compileAssetRequest({ userSkills })`：新增最低优先级 `userSkill` 段
  - instruction 明确：只能影响风格/表达，**不得覆盖** productTruth / deterministicOverlays /
    forbiddenMutations / platformRecommendation / qualityAndRisk，冲突时忽略技能
  - 注入前再校验一次（越权/超长/超 2 个直接丢弃，**不阻断生成**）
- `promptAssembler` 分段顺序把 userSkill 放在最后（平台规则先读）
- `orchestrator` 透传 `payload.user_skills`
- 前端：技能改为**结构化字段**进入请求（不再写进提示词文本），工作台显示可移除胶囊；
  `api.js` 只传 {id,name,version,body} 并截断 2 个
- 测试 test/skill-injection-compiler.test.mjs 5/5（含"无技能时 prompt 逐字节不变"回归）

### P3 生视频注入（server/videoPlanning.mjs）
- `buildVideoPlanningRequest` 注入同样的最低优先级技能段；无技能时 userPrompt 逐字节不变
- VideoStudio 增加技能库入口 + 胶囊，`userSkills` 随 /api/video/plans 请求下发
- 测试 test/skill-injection-video.test.mjs 2/2

### P4 兑换码 + 会员中心
- server/redeem：`redeem_codes`/`redeem_records` 表 + 服务 + 路由
  - 事务内完成校验/落流水/加积分；wallet.grant 幂等键 `redeem:CODE:EMAIL`
  - 守卫：未知/停用/过期/领完/已兑换（各自稳定 errorCode + HTTP 409）
  - 管理员建码：POST /api/admin/redeem-codes（requireAdminAccess）
- 前端：`MemberCenterModal`（账户资料 / 积分余额与明细 / 我的技能 / 兑换码）
  入口在顶栏积分控件旁（登录后显示）
- 测试 test/redeem-codes.test.mjs 3/3

### 验证与部署
- 本地：npm test 2968/2968；DOM 验收 P2 4/4、P4 6/6
- **全量档部署失败并已回滚**：`Ecommerce production canary direction analysis was degraded`
  （上游 VLM 退化，pm2 日志连续 `PLANNER_TIMEOUT`/`VISUAL_ANALYSIS_TIMEOUT`；探测延迟 10.1s，正常 4.5s）
  → 改用 frontend 档上线，并用**零成本生产冒烟**补验证：
  - 部署后编译器实跑：无技能 prompt 无 userSkill 段 / 注入生效 / 优先级声明在 / 其余分段逐字节一致 / 越权被丢弃（5/5）
  - 新接口：/api/skills、/api/redeem、/api/redeem/records 全部 401（挂载 + 鉴权正常）
  - 健康 200、图库 117、视频契约通过、三处哈希一致（index-m5oyaewI.js sha256 d825fc2d…）
- **待补**：上游恢复后重跑一次 full 档 Canary，作为 skill 注入的端到端证明。

### 32.1 好友那单的零成本生产复现（关键证据）
- 生产库 `ecommerce_jobs` 近 4 天：completed 27 / failed 5，**5 次失败全部来自 610567026@qq.com**
  （09:18–09:29），错误一律 `duplicate commercial duty: main-3x4-1 and main-text-1`；修复后他尚未重试。
- 用他最后一单的真实 payload（保温杯、6 张产品图、sizing = main_text 5@1:1 + main_3x4 3@3:4 + detail 9@9:16）
  在**线上部署的代码**里跑 plan 阶段（buildAssetPlan + validatePlanContract，纯函数、零 API）：
  - 现在通过：17 个条目，无异常
  - 该计划里仍有 3 组「职责文案相同、角色不同」的条目（main-text-N 与 main-3x4-N），
    正是旧规则（按全局文案去重）会抛错的那 3 组 → 复现了原 bug 并证明修复生效
- 部署一致性：线上 17 个关键文件（server/index.mjs、ecommerceEngine/*、skills/*、redeem/*、
  videoPlanning.mjs、dist/index.html、dist/assets/index-m5oyaewI.js）与本地 cb8ad960 **sha256 全等 17/17**
- 上游仍在慢：8 token 补全 11.5s（正常 ~4.5s）→ 全量 Canary 暂不重跑（会再失败并浪费额度），
  待上游恢复后补跑。

## 33. 9-10：空白弹窗根因修复 + 登录弹窗内容收窄（部署 a1c949b7）

### 用户反馈
1. "每次从画布里面出来首页就会弹出这个空白弹窗"（截图 = NoteModal 只有"暂无图片"）
2. 登录弹窗卡片宽度可以，但内部输入框/按钮/元素都太宽，参照同类登录弹窗的内容宽度收窄

### 根因（本地浏览器已复现）
- 画布内点"新建画布" → `handleNew` 把 result 置为 `{}` → 回首页后 result 仍是 `{}`
- `shouldShowNoteModal` 只排除 `_ecResult` → 把 `{}` 当成"有结果要展示" → 自动打开 NoteModal
- NoteModal 没有封面/配图/正文 → 只剩"暂无图片"，看起来就是"空白弹窗"
- 复现路径：`/ec-canvas?qa=ec-canvas`（DEV QA 态）→ 新建画布 → 返回 → 弹窗出现

### 修复
1. `src/routing/resultRouting.js`：结果弹窗只在"确实有东西可展示"时自动打开
   （cover_url / 配图数组 / 正文至少一项非空）；`{}`、只有内部标记的对象一律不弹
2. `src/pages/EcCanvas/index.jsx`：新建画布 result 带 `_ecResult + _emptyCanvas`
   （顺带修掉"新建画布后保存的作品被误分类为小红书图文"，workRecords 按 `_ecResult` 分类）
3. `src/styles/login-dialog.css`：卡片仍 600px，内容列收窄到 400px 居中
   `clamp(28px, calc((100% - 400px)/2), 110px)`；窄屏（≤520px）仍走原 22px 媒体查询

### 验证（零 API 成本）
- `npm test` 2972/2972（新增 routing 3 条 + 登录布局契约 1 条，更新新建画布契约 1 条）
- 本地 DOM：新建画布→返回首页→弹窗节点 0、"暂无图片"不出现
- 本地 DOM：登录弹窗 1440/390 × 三种模式（密码登录/邮箱验证码/注册）无横向溢出
- 线上：31/31 dist 产物 sha256 与本地一致；health 200；index.html 指向 index-k6FGAwkg.js + style-BELGrDXu.css
- 线上 CSS 含 `(100% - 400px)/2`；线上画布 chunk 含 `_ecResult:!0,_emptyCanvas:!0`
- 线上 DOM 实测：卡片 600 / 内容 400（1440），卡片 362 / 内容 316（390），无溢出

### 顺带发现（未处理）
- `src/pages/EcCanvas/components/CanvasMinimap.jsx` 一直被 index.jsx 引用却从未入库
  （dist 是本地文件构建的，所以线上没坏）→ 本次一并入库
- 线上 `dist/assets` 有 558 个历史遗留 bundle（每次部署累积，不被 index.html 引用），
  磁盘占用不小；要不要清理需用户确认
- `src/services/invitationService.js` 无任何引用，仍未入库

## 34. 9-10：最小集全量验证补跑通过 + 线上遗留 bundle 清理

### 背景
cb8ad960（skill 注入 P2/P3）当时因上游退化全量档被阻断，改用 frontend 档上线 + 零成本冒烟。
用户指示：最小范围图片验证即可，别浪费上游额度；判断上游此刻可能已恢复。

### 上游健康
- 8 token 补全：11.5s（退化期）→ **2.34s**（正常基线 4.5s 之下）→ 可以补跑

### 最小集全量验证（verify-production-ecommerce.mjs，天然最小：1 张验收图 + 1 次方向分析 + 3 张图）
- token 用部署同款签发入口 `issue-production-canary-session.mjs`（pm2 pid 绑定），只在远端本地文件流转（600 权限、用后即删），不进对话
- **通过**：task ec_dfac8a67-b205-4290-b674-9574949f81ea，3 stable assets，EXIT_CODE=0，job 落库 completed
- 覆盖：方向分析不降级 / 单方向锁定 spec / 三职责不重复（好友那个 bug 的线上回归位）/
  3 图生成落库 / 独立视觉分析缓存 / Work 归档 + 画布会话持久化 / 缩略图与画布变体
- 经验：跑法已固化——远端 nohup bash 脚本 + 日志轮询；token 永远不打印

### 线上清理（用户已确认）
- dist/assets 590 个文件(67M) → **61 个(19M)**：删除 mtime 早于 2026-09-10 00:00 的 529 个，
  保留今天两代（cb8ad960 00:05 与 a1c949b7 00:59）以覆盖旧标签页懒加载；删后 health 200、入口 200
- 磁盘 92%（剩 3.4G）。大头：`server/generated-assets` 7.4G（用户素材，不动）、
  `shubao-old` 5.9G、`shubao-backup-20260717` 5.5G、`shubao-temp` 1.8G、deploy-backups 2.9G、
  shubao/.git 1.4G —— 旧副本目录约 13G+，**待用户拍板后再删**
- 教训重申：远程内联 node -e 的引号会被 bash 吃掉，一律 .cjs 文件 + scp

## 35. 9-10：计费全覆盖 + 会员中心/技能库改版（9609f6ef，部署受阻待上游稳定）

### 用户反馈（本轮）
1. 积分明细全是英文；应覆盖全站所有花积分的地方，并做成"细则"陈列
2. 全面核查：凡走上游 API 的功能都要收积分（有的可以少收）
3. 账户资料卡片没意义 → 删
4. 内置技能没有提示词正文，派生拿到空壳
5. 我的技能要能分组（默认：主图/详情图/小红书/视频）
6. 新建技能应能归到四个类型里
7. 会员中心打开后滚动会把弹窗顶上去（没锁 body 滚动）
8. 旧副本 13G 批准删除

### 计费审计结论
已收费：电商生图(1000-2000/张)、画布重生成/变换(AI动作)、自由创作、AI助手类(200)、
反推(200)、OCR(200)、抠图(500)、方向刷新(1000)、智能图层/PSD(3000)、视频方案(1000)、
视频生成(27000-57000)、XHS/Plog套装(9000)、扩展分析(1500)/生成(3000-9000)。
**漏收 3 处（本轮补齐）**：
- 首次方向分析 → ec_direction_analysis 1000/次
- 画布商品识别(VLM) → ec_canvas_recognize 200/次
- XHS/Plog 预览封面(真实生图) → ec_preview_cover 500/次

### 实现
- server/billing/billingLabels.mjs：SKU→中文名单一事实源；buildBillingRules()（细则）；
  buildLedgerTransactions()（hold+settle 聚合为一笔中文交易，+0 结算行不再刷屏）
- /api/billing/rules（公开）+ /api/billing/transactions（登录）
- MemberCenterModal：删账户资料；交易视图+细则面板；useModalScrollLock 修滚动截断（技能库同享）
- SkillLibraryModal：新建可选四类；分组（默认四组+自建+删除回退）；内置技能带完整正文（可查看/派生即所得）
- skill_groups 表 + user_skills.group_id；groupId 归属服务端校验（跨用户清空）
- 旧副本已删：磁盘 91%→57%

### 部署周折（重要教训）
1. 第一次全量：启动即崩 → **user_skills 老表没有 group_id 列**（CREATE TABLE IF NOT EXISTS 不改老表）。
   教训：给已有表加列必须显式 PRAGMA+ALTER 幂等迁移，且引用新列的索引要放在补列之后建。
   已修 + 回归测试（按线上旧表结构原样建表验证迁移）。
2. 第二次：迁移修了，但方向分析 503（上游对重请求间歇 502/503）→ 门禁按设计拦截，回滚正常。
   canary 已改成对 502/503/504 等 20s 取新 quote 重试一次（失败的 hold 自动 release，不重复扣费）；
   requestJson 错误补了 .status（否则重试判断永不命中——第二个坑）。
3. 13:30 上游仍在抖（轻请求 200、重请求 503），稳定性 watchdog 已挂上（每 4 分钟一轮 3 次重请求探测，
   连续 3 次成功即报告），稳定后重跑全量部署。线上当前保持 a1c949b7（健康，不含本轮改动）。

### 本地验证（零 API）
- npm test 2982/2982（新增 billing-labels 4 + skill-groups 5 + migration 1，更新 verifier/api-contract/billing-ui 契约）
- vite build 通过；Modal 源经 vite transform 断言（滚动锁/细则/类型选择/分组/内置正文均在）

## 2026-09-12 批注批次一~五（均已上线）

- **批次一**：视频模型弹层图标从深色渐变底改「白底细边+彩色品牌标」；弹层 250px → min(58vh,460px)（一次见 5+）并水平居中；技能显示从「生成设置」移到工具栏「技能库」项；底部 CTA 去掉左侧独立积分栏、积分改为按钮上动态显示；充值弹窗上下间距对称；技能库弹窗 84~92vh、技能提示词上限 2000→8000。
- **批次二**：工具条「加入资产库」挪到裁剪/导出那一组 + 图标换 FolderPlus + 已入库高亮；**加号与连线错位根治**（设计方案节点内容撑高但 node.h 不回写 → 补 onAutoHeight）；**画布发射布局重做**（每种素材一列 + 新增「生成要求」提示词节点 + 全部汇入方案节点）。
- **批次三**：电商生图「下一步」显示**动态积分**（generationUnits(模型,清晰度)×张数）；**提示词上限全局统一**（`src/constants/promptLimits.js`：视频 8000 / 生图 2000；服务端 videoPlanModel 1200→8000；MentionPromptField 支持 maxLength；首页/画布/自由创作/视频同源）。
- **批次四**：**作品 7 天保留 + 后台白名单**（`server/worksRetention.mjs`、dryRun、白名单免疫、project_assets 保留服务联动、`/api/admin/retention/*`、初始白名单 867550189@qq.com、作品集 7 天提示）。
- **批次五**：**画布库**（canvas_sessions 补 title/favorite + list/rename/favorite/duplicate/delete + `/api/canvas-library` 路由 + CanvasLibraryModal 悬停改名/复制/收藏/删除；「新建画布」改为打开画布库）。
- 教训：画布组件 `useCallback` 声明顺序会造成 TDZ 崩画布（已加全局守卫测试）；本地 QA 通道 `?qa=ec-plan-launch` 是取证利器。
- 部署：`deploy-production.ps1` 偶发 lock channel 丢失（release 与 current 实际已更新，以线上 bundle 标记为准；残留锁用 fuser 找 PID 后 kill）。
- **未完成**：资产库整页重做（改动点见 docs/plan/9-11-nightly-handoff.md §8）。


## 2026-09-12（续）任务日志 + 资产库（均已上线，current=97254669）

- **任务日志面板**（commit 719f5ba8）：原来「永远空 + 纯黑」→ 数据源改为**画布真实任务**（节点生命周期推导：进行中/已完成/失败 × 图片/文案/视频/音频），加**两组筛选**（全部状态/进行中/已完成/失败 + 全部类型/文本/图片/视频/音频），状态名中文，样式改浅色暖白（#fffdfa），列表底部避让画布底栏；单条可清除。
- **资产库**（commit 97254669）：标题改「资产库管理」+ **存储额度条**（已用/可用 + 进度，`GET /api/assets/usage` 按账号 stat 实际文件，默认 100MB，env `ASSET_QUOTA_BYTES`）；**卡片只留悬停出现的删除按钮**（`POST /api/projects/:id/assets/:aid/delete` 软删），去掉保留徽标/生产徽标/生产状态下拉与两个筛选下拉；保留搜索与图片/视频/音频分类 tab。
- 旧契约同步：`ec-canvas-state` 里三条「保留/生产状态控件」断言改为新契约（底层服务端契约保留、页面不再出现这些控件）。
- **仍未做**：资产库的「上传」按钮（需要把上传端点接进资产库并单独验收）。
- 全量测试：3188/3188 全绿。

- **资产库上传**（commit f6ec8640）：标题行加「上传」按钮 + 隐藏 file input（`accept=image/*`、multiple、最多 8 张）；链路复用画布既有上传（`readCanvasImageFiles` → `persistCanvasUploadAssets`/`uploadEcommerceAssets` → `importImageAssetToProject`），入库后按新项目刷新列表，额度条随列表变化自动刷新；失败文案「请选择 JPEG、PNG 或 WebP 图片」「上传失败，请重试」。至此资产库的**额度 / 分类 / 查询 / 上传 / 悬停删除**五项齐备。
- 全量测试：3193/3193 全绿；线上 current = f6ec8640。

## 2026-09-12 深夜批次（用户睡前「全部执行到位」）

- **批次六** `5cf24437`：切页强制释放滚动锁（导航消失+页面卡死）；视频模型弹层回退为「贴着触发按钮」（上一批水平居中导致左侧被截断）；品牌主色调色块可点开系统调色板 + 图标换 Palette；生成设置去掉重复标题；面板加高；**预计积分统一进按钮**。
- **批次七** `0cff099d`：新增 `src/styles/generate-cta.css` 统一主 CTA（`.shubao-gen-cta` + `.shubao-gen-cta-points`）；去掉生视频/电商生图/自由创作的重复配置摘要；自由创作配置面板不再退化成全屏覆盖层（那会盖住提示词框左下角的 @ 按钮）；提示词框加高。
- **会员中心弹窗** `a7e25160`：改 `createPortal` 到 body（避免被祖先层叠/滚动/滤镜上下文影响出现「遮罩在、卡片不在」）；加 ESC 兜底关闭。
- **回归修复** `cdbf6d86`（重要）：`719f5ba8` 重写任务日志样式时整段替换了 `canvas-supervisor.css` 尾部，**误删小地图/便签/无效边/吸附等约 300 行样式**（用户看到「小地图变黑、不吸附、像回到旧版本」）。已从 `719f5ba8^` 原样拼回，并新增 `canvas-css-regression-0912` 锁死这些样式。
- **批次八** `7cbf4f49`：「加入资产库」改为可逆（再点一次移除，文案「已在资产库 · 点击移除」）；视频生成无素材无文字时主按钮禁用；小红书生成按钮统一为 `.shubao-gen-cta` 并显示整套积分（9 图 = 9 积分）。

### 仍未完成（用户 9-13 批注，按优先级）
1. **资产库整页 → 弹窗**：照竞品（搜索/查询/上传 + 全部/图片/视频/音频 + 大图卡片 + 悬停放大与右上角垃圾桶 + 极简标题）——用户明确要求「完全重做成弹窗」。
2. **画布库改成整页**（不是弹窗）：卡片 hover 上浮放大 + 显示改名/复制/收藏/删除四个按钮 + 毛玻璃。
3. **画布左侧「+」菜单重构**：添加节点（文本/图片/视频/音频/应用）+ 添加资源（本地上传）+ **从资产库选择**（弹窗选素材直接加到画布）——目前完全没有「从资产库选」入口。
4. **自由创作**：上传区 + 输入区合并进同一个框（照小红书样式），四个子页面分别适配，重写「我的素材 / 风格参考」文案与描述。
5. 电商生图「下一步」积分口径：默认整套（如 10 张）应显示整套积分，目前可能显示 1（sizing.images 为空时 fallback 到 1）。
6. 按钮灰态下**积分要高亮/可感知动态**（主次分明）。


## 2026-09-13 续作（用户「直接做完」）—— 结构级重做已上线

- `4320c31b` **画布「从资产库选择」**：新增 `CanvasAssetPickerModal`（portal + 搜索 + 分类 + 悬停打勾 + 确认加入画布，复用 `handleImportProjectAssets`）；入口 = 空画布「添加素材」行 + 左侧「+」菜单。
- `29c19519` 电商生图**整套积分口径**：`sizing.images` 为空时回落到 `resolveSizingImages` 完整清单（不再显示 1 积分）。
- `c00fed6f` 自由创作**上传区+输入区合并成一个框**（单卡片白底/12px 圆角，参考素材区改弱分隔线）；**按钮灰态下积分仍显眼**（胶囊底 + 强调色 + opacity 1）。
- `8caca95b` **资产库改弹窗**（`canvas-asset-library-overlay/modal`，内容复用，点遮罩回画布）；**画布库改整页**（`CanvasLibraryModal` 新增 `variant="page"`：绝对定位整页 + 毛玻璃底 + 卡片 hover 上浮 8px/放大 1.03 + 四操作）；**左侧「+」菜单分组**（添加资源 / 用 AI 生成）。
- `9e2eb5a1` 自由创作素材区文案统一为「**我的素材** + 风格参考」语义（照小红书）。
- 线上 current = `9e2eb5a1`，health 200，全量测试 3206/3206。

### 仍未做（下一步候选）
- 自由创作**四个子页面**逐个差异化适配（当前是共用同一套 composer 与文案，已按小红书语义统一，但未按子页面再分）。
- 画布左侧「+」菜单与竞品相比仍缺「应用」类节点入口（当前为生成类 + 资源类两组）。
- 资产库弹窗内的信息层级可再精简（去掉剩余副标题）。


## 2026-09-13 批注批次十四~十五（已上线 current=b3eec729）

- 批次十四 `f77219f2`：撤掉导航里重复的「电商画布」与画布「回收站」页签；双击空白添加节点由「文本」改为**生成文案**（纯文本只从底部 T 进入）；品牌色标题图标改强调色；生成设置面板加高到 88vh + 内部间距压缩（一屏看全）；**视频生成按钮根因修复**（`hasRequiredVideoInputs` 在智能模式恒为 true → 改为按真实素材数/文字判定）；资产库弹窗照竞品（卡片悬停上浮放大 + 图片微放大 + 右上角浮现垃圾桶）；画布库照竞品（方形容器 + 封面居中裁剪 + 标题/时间做成底部遮罩不占容器 + 悬停才浮现的大号操作按钮 + 明显关闭 + 分类筛选）。
- 批次十五 `b3eec729`：**离开画布的保存流程**（从画布库打开 → 静默保存不打扰；新建/临时画布 → 询问「保存到画布库 / 不保存」，不保存则丢弃复用画布库删除接口；空画布不打扰；确认后继续原导航）；画布库**按日期分组**（今天/昨天/具体日期）；画布标题强制纵向居中。

### 生图模型：缺口与阻塞点（用户 9-13 追问，已查证）
- 已上架（`src/services/imageModelCatalog.js`）：`image2`(GPT Image 2) / `nano-banana-2` / `nano-banana-pro` 三档。
- 调研文档 `docs/research/pricing-upstream-analysis-20260911.md` §7.3 规划了 **9 类热门档**，其中 2 类已上架、1 类（去背景）本地已实现，**尚缺 4 族**：
  1. **gpt-image-2.5 系列**（含 -flare / -sunburst 各 1K/2K/4K）
  2. **mdkj-super-gpt-image-2**（上游 ¥0.026/张，全场最便宜，建议 2/1 积分，毛利 ~93%）
  3. **Gemini 3 图片**（pro / 3.1 flash，建议 2/1 积分）
  4. **Midjourney 1K/2K**（差异化档，建议 3/2 积分）
- **2026-09-13 已从上游拉到准确 model id（`GET /v1/models`，共 165 个）**：
  `gpt-image-2.5` / `gpt-image-2.5-flare-{1k,2k,4k}` / `gpt-image-2.5-sunburst-{1k,2k,4k}`；
  `mdkj-super-gpt-image-2-{1k,2k,4k}`（另有 `mdkj-native-gpt-image-2`，按用户意见不进清单）；
  `ip233-gemini-3-pro-image` / `ip233-gemini-3.1-flash-image`；
  `midjourney-1k` / `midjourney-2k`；
  `nano-banana-pro-{1k,2k,4k}` / `nano-banana2-{1k,2k,4k}`（现用档位）。
- **阻塞点（诚实交代）**：新模型不是改一个字符串就能上——每上一族需要三件事同时落地：
  ① 后端计费目录新增 SKU（`server/billing/catalog.mjs`，单一事实源，含分档单价）；
  ② 前端目录 + 生成链路映射（`imageModelCatalog.js` 的 `generationBillingSku` + provider `modelMap`，同一族要按分辨率映射到不同 id）；
  ③ **一次真实付费生成验收**（确认 id 可用、产物质量达标）——这一步我无法替用户跑（会真的花钱、且用户明确说自己来测）。
  目前 ①② 我可以直接做，③ 需要用户在真机上各跑一张。**没有 ③ 就上架 = 可能把可用性风险直接暴露给用户**，与「不允许有任何 bug」冲突。
  → **2026-09-13 更新：①② 已完成（见下节 `33b891d6`），只剩 ③ 真实付费验收。**

## 2026-09-13 批注批次十六：画布四个生成框对齐首页 + 新族模型后端接线

### 画布（用户批注：加号位置 / 面板歪 / 应用乱打 / 技能入口 / 动态积分 / @ 键）
- `085f94f4` **四个生成框全部对齐首页口径**：
  - 生成按钮统一成 `.shubao-gen-cta`（与首页/小红书同一枚渐变 CTA），按钮内直接显示**动态积分**
    （新模块 `src/pages/EcCanvas/canvasPointsEstimate.js`：图片 = generationUnits(模型,清晰度)×张数；
    文案 = 0.2（ec_ai_assistant）；套图 = 首页 resolveSizingImages 整套张数×单价；视频 = 产品报价 short/long）。
    彻底删掉写死的「62 AI 积分 / 次」。
  - **技能入口抽成 `CanvasSkillControl`**：图片/文案/视频/套图四处同一个按钮、同一套技能、同一个「更多技能…」进技能管理弹窗；视频框不再用下拉框另做一套。
  - **视频框补上 @ 引用键**（MentionPromptField + 底栏 ComposerMention，与另三个框对等）。
  - **新建即开面板**：从左侧「+」新建生成框原来「不选中 → 面板不出现」（用户以为按钮没反应），
    现在一律选中新节点、生成面板当场打开（`canvas-studio-contract` 相应同步）。
  - **派生面板居中吸附在按钮正上方**：`clampCanvasPickerPosition({ anchor: 'above' })` + `.ec-canvas-derive-menu.is-above`
    （translate(-50%, -100% - 14px)，随画布缩放同步）；真渲染后复测高度，顶部放不下就在同一帧翻到按钮下方（`is-flipped`，仍水平居中）。
    实测：端口 (933,514) 时面板 x 中心偏差 **0px**，间隙 3px。
  - 左侧「+」菜单实测 769px 顶到屏幕上下沿 → 收成 `max-height: min(620px, 100vh-48px)` + 内部滚动。
- `691696b0` 加号挂在画布节点框左右（生成面板不再挂加号）；生成面板宽度收到 **480 且不超过节点宽**（≥360）并严格居中；
  应用类按节点类型分流（语音合成只服务文案、智能字幕只服务视频，未选中给明确提示）；画布库卡片布局写进基础选择器。

### 新族图片模型后端接线（A 方案：接线先到位，真实生成验收后才上架）
- `33b891d6` `server/ecommerceEngine/modelCatalog.mjs`：`IMAGE_MODEL_IDS` 新增 image2-5-sunburst / image2-5-flare /
  mdkj-super / gemini-3-image / midjourney；`buildModelRoute` → `provider: 'advanced-image'`、`route.model = 族 id`；
  **Midjourney 上游只有 1K/2K，4K 请求兜底降到 2K**（不静默换模型）。
- `modelProviderRouter.mjs`：新增 advanced 适配器分流 + `advanced:` jobId 前缀；未配置时报「这个图片模型暂时不可用，请先换个模型」（不暴露供应商，有测试卡）。
- `server/index.mjs`：新增 `createAdvancedImageAdapter`（同步 OpenAI 图片接口，缺省复用 IMG_BACKUP_* 同一平台凭据），
  `modelMap` 按「族:分辨率」映射真实上游 id（`IMAGE_ADVANCED_*` env 可覆盖，校准不用改代码）：
  `gpt-image-2.5-sunburst-{1k,2k,4k}` / `gpt-image-2.5-flare-{1k,2k,4k}` / `mdkj-super-gpt-image-2-{1k,2k,4k}` /
  `ip233-gemini-3-pro-image` / `midjourney-{1k,2k}`。
- `ecommerceBilling.ecommerceFeatureForItem` 补齐四族五档 SKU（与前端 generationBillingSku 一一对应）。
- **顺带修掉一个真实计费 bug**：原来 1K/4K 用「手写尺寸白名单」判断，漏了 16:9 与 21:9
  （4K 3840x2160 / 3584x1536 被当成 2K 少收，1K 1024x576 / 1008x432 被当成 2K 多收）。
  现在直接以 `LEGAL_IMAGE_SIZES`（尺寸唯一真源）反查档位。
- **上架门槛（未变）**：前端 `SELECTABLE_IMAGE_MODELS` 仍过滤 `pending: true`，五档都还没进选择器 ——
  需要用户各跑一次真实生成验收（确认 id 可用 + 产物质量）后，去掉 pending 即可上架，无需再改后端。

### 自由创作 / 资产库（并行子代理完成，均已复核）
- `afc9ed4d` **自由创作照抄小红书那套**：`VisualCreationMode` 直接复用小红书图文的 composer 类
  （`.ec-xhs-composer` / `.ec-xhs-media-strip` / `.ec-xhs-prompt` / `.ec-workbench-actions` / `.shubao-gen-cta`），
  只改文案（「我的素材 0/6」「风格参考」）；实测两边结构/尺寸/圆角一致。
- `cf650b24` + `7e25a99b` **资产库弹窗照竞品**：卡片 **165×165 方形**、封面 `object-fit: cover`（原来被内联 contain 压住，四周露灰条 → 已用 `!important` 压回）、
  名称走**底部渐变遮罩**（`rgba(15,15,18,0→.74)`）、垃圾桶 30×30 **默认 opacity 0，hover / focus-within 才出现**（右上角，hover 变红）、打勾徽章挪左上。
  实测 before→after：资产库管理弹窗卡片 173×192 → **173×173 方形**。

### 上线与线上验证
- 两次 frontend 档部署：`a288c2da` → 再 `7e25a99b`；线上 `current = /var/www/shubao/releases/20260913-195104-7e25a99b`，health 200，站内 117 张画廊与视频契约校验通过。
- 线上 bundle 抽查（`style-CyyOtJd-.css` + `index-CpU0PbbI.js`）确认含：`ec-canvas-composer-cta`、`ec-canvas-derive-menu.is-above`、`is-flipped`、
  `canvas-asset-picker-name` / `-delete`、「确认方案后扣费」、「更多技能」。
- 全量测试：**3267 / 3267 全绿**。
- 遗留提示（非本次改动引入）：部署机探针报 `Nano Banana gateway probe failed: fetch failed`（本地到该网关不通），线上功能不受影响，下次上线上网时可复看。

## 2026-09-13 批注批次十七：用户十张截图逐条落地上线

### 关键根因修复（不是样式微调，是真 bug）
- **画布库卡片塌成细条（用户第三次反馈）**：真正根因是 `.canvas-library-grid` 作为 flex 子项 + `overflow:auto`，
  默认 `align-content:normal(=stretch)` 会**按容器高度把 grid 行压扁**：8 条数据时行高 232px 正常，
  14 条变 212px，60 条 5 列 12 行 → 每行被压到 ~20px，封面被 `overflow:hidden` 裁成细条。
  修法：`grid-auto-rows: min-content; align-content: start` + 卡片 `min-height: 232px` 兜底。
  实测 60 个画布：全部 232px、行距 254、正常滚动。
- **画布右侧功能栏「盖上来」**：面板原来和画布同处一个包含块，浮在画布上。
  现在面板移到画布 stage 之外（`.ec-canvas-page` 设为 positioning 基准），
  画布区按 `--canvas-right-panel-width` 让位（1440 屏实测 stage 1052px、面板 1066~1426，节点不再被盖住）。
- **空画布自称「电商画布」**：根因是 `createEmptyCanvasResult().product_name = '电商画布'`（AppContext），
  顶部标题直接显示它 → 改成空串，标题回落到「智能画布」（用户已说很多遍）。
- **添加节点菜单要滚动才能看全**：11 项 × 54px = 760px 顶到上下沿；行高压到 46px（注意基础规则在后面，
  必须用 `button[role="menuitem"]` 提特异性）+ 菜单展开时收起左下角小地图（它盖住了最后两项）。
  实测 1440/1280 两档：高度 677px、**0 项需要滚动**。
- **「添加音频」→「上传音频」**并紧跟「上传视频」（同类动作排一起）。
- **生成面板太窄变形**：口径定为 `min(520, max(420, min(默认, 节点宽)))` ——
  低于 420 时底部 6 个控件会换行变形；实测 280 节点 → 420、640 节点 → 520，参数行不再折行。

### 其它批注
- 首页电商生图底部**「商品档案」入口下线**（用户：资产库已覆盖）；`ProductChip` 不再渲染，
  档案能力与跨模式复用保留（EcProfileRail / 小红书 / Plog 仍在用）。
- **资产库弹窗五条**（`3fe78d17`）：行距 16px（`grid-auto-rows: max-content`，原来行轨 148px < 卡片 165px 导致视觉重叠）；
  **首批 24 条 + 无限滚动**（60 条实测 24→48→60，有「正在加载更多…/已经到底了」，切分类重置）；
  左上角圆点改**真按钮**可点多选（底栏「已选 N 个 · 确认后一起加入画布」）；
  垃圾桶**二次确认弹窗**「删除这个素材？/ 删除后不可恢复，已加入画布的内容不受影响。」；
  另修一个隐蔽 bug：弹窗 portal 到 body，但 React 合成事件仍沿 fiber 树冒泡到画布 stage 的
  `handlePointerDown`（preventDefault + setPointerCapture 会吞掉卡片点击）→ 弹窗根节点 stopPropagation。
- **自由创作对齐小红书**（`f4da857a`）：删掉「我的素材 0/6」标题行、消除底部空洞（卡片高度差 ≤9px）、
  上限可见「我的素材 0/6（最多 6 张）· 风格参考 0/3（最多 3 张）」+ 超限 toast、
  **四个子页面各自独立**的占位引导/两条示例/素材提示/默认画幅（自由创作 1:1、海报设计 3:4、社媒封面 3:4、品牌主视觉 16:9）。
- **五档新模型直接上线**（用户：「你直接上线上来吧，然后我自己去跑跑看」）：去掉 `pending`，
  首页/自由创作/画布三处选择器都能选；清晰度按模型能力过滤（Midjourney 只给 1K/2K，
  切模型时把不支持的档位落回该模型支持的最高档，不做静默回落）。

### 测试与上线
- 全量 `npm test`：**3283 / 3283 全绿**（基线 3267 → 新增 16 条回归）。
- 本轮 commit：`a4dea243` / `1cfa4828` / `f4da857a` / `3fe78d17` / `ae154bba` / `568c5e80`（文档）。
- 两次 frontend 档部署（`3fe78d17` → `ae154bba`）：线上 `current = /var/www/shubao/releases/20260913-230338-ae154bba`，origin `/api/health` 200；
  线上 bundle 抽查命中 `has-right-panel` / `canvas-asset-picker-name` / `image2-5-sunburst` / `mdkj-super` / `gemini-3-image` /
  `上传音频` / `智能画布` / `确认后一起加入画布` / `删除这个素材`。
- 全量 `npm test`：**3283 / 3283 全绿**。
- 注意（环境问题，非线上故障）：本机到 Cloudflare 的 HTTPS 会间歇性 SSL 失败（`https://www.cloudflare.com/` 同样失败），
  用服务器侧 `curl` 复核线上为 200；以后线上验证优先「服务器侧 curl + 线上 bundle 抽查」。

## 2026-09-15 批注批次十八：面板体系第二次收口（`ffba0a42`，已上线）

用户第二批批注 5 张图，其中三项是**我上一轮没做对**的返工。这一批的重点不是「改 UI」，
而是**把面板的标题/标签/间距/图标收成一套体系**（用户原话：同一阶梯的东西就应该统一起来）。

### 真修的 bug / 返工（每条都写了根因，不是"感觉"问题）
- **摘要行只删了一半**（图2-② 复核）：上一轮我只删了「当前方案：」那半句，
  `platformOption.summary`（「方形主图、商品卖点与详情长图」）还留着。这次两句一起删。
- **空提示词也会冒出冲突提示**（用户：「我提示词里面并没有写入任何东西啊，为什么我只是在
  面板里点个技能它就会出来这个呢」）：根因是 `PromptAuthorityNote` 有一句**无条件渲染**的
  常驻说明；`description` 初始为 `''`，空提示词时该组件**只渲染那一句**。
  裁决：删掉常驻句、**无冲突 `return null`**；文案改成点名「避免出现的元素」「套图方案」，
  不再出现「硬约束 / 以配置为准」这类对审核者说的话。
- **数量框前导零 `01`**：根因是受控 input 的写回时机 —— React 只比对「本次 value」与
  「上次 value」，两者相同就**根本不写 DOM**；光标停在 1 前面敲 0 → `parseInt("01")===1`
  → value 没变 → React 不纠正。修法：前导零与越界都在同一帧 `e.target.value = String(next)`。
- **「商品主图 3:4」整行删除**，3:4 改由**平台**推出：抖音/小红书/快手/TikTok Shop/SHEIN
  的「商品主图」默认 3:4；货架型商城（淘宝/京东/拼多多/Amazon/TEMU/Shopee）仍 1:1。
- **取色器被视口截断**：内联渲染在面板文档流末尾，面板贴底就裁掉 → 改走 `AnchoredPortal`
  （下方放不下自动翻到上方）。锚点取**整行**而不是色块按钮，否则点色值输入框会被判成"点外面"。

### 体系（这一批真正的交付物）
- **`PanelPrimitives.jsx`**：分组标题(13/700/ink-1 + 14px 图标)与字段标签(12/600/ink-2 + 12px 图标)
  的全局唯一实现。删掉实测**同时存在**的四套写法：GenSettings 私有 10px/灰标题、
  SizingPanel 的裸标题（无图标）、CopyPanel/SkuPanel 各一份**零调用**的局部 GroupTitle、
  SkuPanel 自己写死的 FieldLabel。
- **`ImageTypeGlyph.jsx`**：图片类型图标不再从通用图标库硬凑（`Square`/`Scissors`/`Rows3`
  既不成套、语义也对不上 —— 剪刀 ≠ 去底），改为**自绘 duotone 图形集**：共用底板 +
  `currentColor` 两档透明度（自动跟随主题与选中态）。尺寸：徽章 **36** / 图形 22 / 勾选框 **16**。
- **`TEXT_ROLE.fieldLabel` 11/ink-3 → 12/ink-2**：文件头文档**一直写着 12**，与代码打架 ——
  上一轮我照着那份错文档以为已经统一。现在两处锁死同值（门禁 ⑳）。
- **`sectionStyle` 删除**（gap=sp5 20px，却被当成「标签+控件」容器用了 5 处 → 同一面板里
  「品类→输入框」20px、「产品尺寸→输入框」8px）→ `fieldStackStyle(sp2)`。
  六面板节奏统一：标签↔控件 8 < 控件↔控件 12 = 标题↔内容 12 < 分组↔分组 16 < 内边距 20/24；
  GenSettings 从 V3 的 20/20/8 改回与另外五个面板同源。
- GenSettings 下拉：展开列表**不再重复当前模型**（兜底：过滤后为空则退回完整清单）、
  品牌图标 22/24 → 28/32、去掉模型行 `space-between`（那正是按钮内两侧大片空白的来源）。

### ⚠️ 本批最重要的一条教训：**删一个 key ≠ 删一行 UI**
把 `main_3x4` 从 `IMAGE_TYPES` 删掉时，我顺手把它从 `TYPE_BY_KEY` 也删了 ——
**全量测试当场抓到真实事故：UI 计划 14 张、服务端 15 张**，差的那张就是被静默丢弃的
`main_3x4`。而它还在三处活着：历史草稿、画布快照、**试穿链路 `anything_tryon` 的角色 key**。
→ 定式：**面板类型列表（`IMAGE_TYPES`）与解析层登记表（`ALL_IMAGE_TYPES`）必须分开**；
下线的类型进 `LEGACY_IMAGE_TYPES` 留在解析层，只在面板显示层用
`migrateLegacySizingImages` 合并（**总张数不变**）。
反向判据也写进门禁：`resolveSizingImages` 里**不许**出现迁移调用（改 key 会改变服务端出图规划）。

### 门禁与验证
- `test/workbench-panel-ux-0915.test.mjs` 共 **24 条**（新增 ⑮–㉔；⑱ 是**行为断言**：
  直接 `import` 模型跑 `defaultRatioFor` / `resolveSizingImages` 验算平台→比例）。
- 同期修正 **7 条锁旧写法的契约**（判据未变，只是不再锁拼写）：取色器内联 → AnchoredPortal、
  28/18 → 倍数 ≥2、常驻句 → 只撞车时说话、`SELECTABLE_IMAGE_MODELS.map` → 派生清单（0913/0914）、
  局部 GroupTitle（0913b）、`--sb-group-gap` → SPACING 阶梯（D7）。
  ⚠️ 改契约前先问：**判据变了没有？** 没变就是把拼写当判据了。
- 顺带修掉我自己写错的 token 档：勾选框圆角 `--sb-radius-xs`(4px) 不在 D6 四档内 → `chip`(6px)。
- 全量 `npm test`：**3816 / 3809 通过 / 0 失败 / 7 跳过**（此前 3806/3799/0/7）。
- `npm run precommit`：构建 exit 0 + **BLOCKING 21 条全绿**（门禁内 161 项）。
- 构建产物核对（`dist/assets` 30 个包）：新文案命中 1 包；已删的三句文案 **0 命中**；
  4 枚自绘图标 path 全部命中。
- 线上：`index.html` 指向 `assets/index-BtAQEw_0.js`；
  `EcommerceDesignPlanEditor-DWBk23t8.js`(81130B) 与本地构建**哈希逐字一致**
  （比 grep 中文更可靠的线上核对方式）。
- 部署环境坑（记下来）：`scripts/deploy-production.ps1` 含中文，必须用 **`pwsh`(7+)** 跑；
  用 Windows PowerShell 5.1 会按 ANSI 解码 → 满屏 `Missing ')' in method call` 语法错误（不是脚本 bug）。

## 2026-09-16 批注批次十九：第 11 张批注图（`e9656624`，已上线）

用户一次给了 11 组批注，最后一句是「你不能有任何的 bug，明天我就要看到结果」。
这一批**一半的问题不是视觉，是链路断了** —— 用户直接问：
「你确定现在所有的这些逻辑都是打通的情况吗？都是确确实实能够带入到设计方案里面，
然后去激活生成逻辑的吗？」先派两条**只读审计**去查，结论是**没打通**。

### ⚠️ 本批最重要的定式：**「应用到画布」会把你填的配置换成默认空值**
`handleDirectionApply` 新建套图节点时只传 `platform + commerceContext`，
而 `createCanvasSuiteComposerNode` 的默认 configuration 里
`productParams / skus / copywriting / customColors` **全是空值**。
→ 用户在第 1 步填的商品信息、内容规范、SKU 变体、品牌色，到这里**静默归零**，一路空到生成。
修法：把这几个键从 `node.ecParams` 原样带进新节点（方案回写仍在后面执行，该由方案赢的地方仍由方案赢）。
**推论**：任何「新建节点 = 用工厂默认值」的地方，都要检查「用户之前填的东西有没有一起过来」。

### 其它断链（都已实测修复）
- **变体说明全链路丢失**：`assetPlanner` 的 SKU 白名单没有 `note`，`normalizeSkus` 直接扔掉。
  → 单独提取（**不并进 facts** —— facts 是要过视觉核验的确认闸门，混进去会让图被判不合格），
  走 `item.variantNote` → `roleObjective.variantNote`（**有值才出现**，空串占位会污染提示词
  并让既有的逐字段 deepEqual 契约无谓变红）。
- **「避免出现的元素」服务端 0 命中**：前端一直在发 `body.generation_settings.negativePrompt`，
  服务端全仓 grep 不到 → 新增 `userExclusions` 段，排在 `userSkill` **之后**（更晚出现 = 优先级更高），
  按分隔符切成条目，写明「硬排除 / 压过风格指引 / 不压过 productTruth 与平台规则」。
- **服务端真正读的是 `direction.editableBrief`**，不是 `selling_points`/`product_name`
  （后两者在 direction 是对象时**根本不生效**，`directionFromPayload` 只是 fallback）。
  → 用户填的一切按结构并进 editableBrief。
- **category 此前硬编码 `'其他'`**；`custom_colors` 根本没发出 → 两项接上现成服务端字段。
- **SKU 面板的「生成数量」是个谎**：它不影响张数（计费与生成都按变体数），合计却把它算进去。
  → 改成按变体数如实显示。**没有改计费口径**（改它会动价格，铁律①）。

### 「死按钮」的通用成因（值得单独记）
视频侧的 @ 触发器自己实现了一套「点外面就关」，判定只认底栏容器 `quickToolsRef`，
而菜单挂在输入框下面那一行 → **pointerdown 落在菜单项上就被判成「点了外面」→ 菜单卸载 →
click 事件永远不会触发**。用户看到的就是「有素材、能点开、点了没反应」。
→ 正确修法不是再补一遍判定，而是**把已经做对的逻辑拿过来用**（`ImageMentionPicker` 用
  rootRef + menuRef 双包含判定）。同类教训：**「点了没反应」优先怀疑「元素在事件到达前被卸载」**。

### 视觉（同一批）
- 模型图标**双层框**：外层 `--sb-surface-tint` 方底 + 品牌标自带框 → 图形被压到 0.72 倍
  → 去掉外层（Gemini 没被点名，就是因为它的标没有可见外框）。
- 图片类型「全是紫色」：四个 tile **共用同一个品牌浅底** → 新建识别色族 `ACCENT`
  （紫/蓝/绿/琥珀，全部取自既有语义色）+ 动效（进场淡入 / hover 1.06 / 勾选弹出 /
  `prefers-reduced-motion` 全关）。规范写死：**识别色 = 这是哪一类；状态色 = 选没选，两套不许混用**。
- 标题配色全局统一：**图标走品牌色、文字走中性深墨**（用户点名要自由创作那套）。
- 面板被截断：`maxHeight` 被 `Math.max(300, …)` **托底** → 可以大于该侧可用空间 → 直接被视口切。
  修法要同时满足两条用户要求：① 面板永远贴着触发按钮（不能退化成盖住输入区的全屏层）；
  ② 内容一屏看全（不能让用户滚鼠标）→ 高度**严格取该侧可用空间**（绝不越界 = 绝不截断），
  装不下时切**紧凑档** `data-density="compact"` 由 CSS 压内容。
  ⚠️ 密度传递用 `data-*` 属性，**不要用内联 CSS 变量 + 属性选择器**（各家浏览器对冒号后空格的
  序列化不一致，会静默失效）。
- CTA 积分看不出数值：`.video-submit-row span` 这条**后代选择器**把按钮内部的积分也刷成了灰 10px。
  → 收窄到只作用于说明区。**教训：给按钮内部的 span 写全局后代选择器 = 迟早盖掉按钮自己的配色。**

### 技能「使用」不生效
首页与视频页只把技能塞进一个**不可见的** userSkills 字段 + 一个 chip，点了什么都看不见；
画布侧一直是对的（`applyCanvasSkill` 会把正文写进提示词）。
→ 三处共用：空则填入、**非空则追加**（绝不覆盖）；chip 只留名字，正文只进输入框一次
（否则同一份正文会进两次提示词：输入框一次 + user_skills 段一次）。

### 1080P：验证完了（9-16）—— 卡在「中转余额」，不在代码
计费 SKU `video_seedance_1080p` 已留档（units 73000 / providerCostCny 6.37，**public:false**）、
价格页挂「即将上线」，门禁守着（SKU 必须保持 `public:false`、没有任何产品能声明 1080p）。
用户 9-16 原话「1080的话，你验证一下就知道了」→ 验证结论（零成本手段为主，**没有再花余额**）：
- **可接入的 1080p 路由只有一条**：中转 `seedance-2.0-1080p`（¥7.67/条，按条计费）。
  提交走完渠道与参数校验，**仅因预扣 ¥7.67 超过中转余额被拒**（`insufficient_user_quota`）。
- 另外三条 1080p 都不可用：`sd2.0/sd2.5-1080p-official` 在本站分组无渠道；
  `sd7-seedance-2.0-1080p`（¥7.67）、`seedance2.0-F-1080p` 上游不认该模型名。
  另有 `xn-seedance-2.5`（¥1.872/秒）**支持 1080p**，但 5 秒预扣 ¥9.36。
- ⚠️ **实测中转（IP233）余额：¥1.914**（9-16）。凡预扣超过余额的视频任务一律被拒 ——
  也就是说**当前只有 ¥0.91 档（`agv-seedance2.0fast`）能稳定下单**，其余档位下单即失败。
- 开通前置条件：① 充值（余额 ≥ ¥7.67 × 并发）；② 按 ¥7.67 重算毛利、把 vendorCost 改准
  （原记 ¥6.37 是更早快照，偏乐观）；③ 在 videoCatalog 台账里把该路由转 verified/callable。
「默认 1 积分」也要澄清：那是**方案分析**的固定费用（`video_plan_analysis` = 1000 units = 1 积分，
单一事实源 `server/billing/catalog.mjs`），成片费用在「开始生成」按钮上、来自服务端报价、随配置变。

### 门禁与验证
- 新增 `test/workbench-unify-0916.test.mjs`（14 条，挂 BLOCKING）。其中 4 条是**行为断言**：
  直接 import `assetPlanner` / `promptCompiler` 跑一遍，验「变体说明逐条进 prompt」
  「排除项成为硬排除段」「没填时不产生空段」「结构仍是合法 JSON schema」。
- 修正 8 条锁旧写法的契约（判据未变）：applyCanvasSkill 非空行为（3 处）、
  负向词面板的属性顺序、@ 的 preventDefault 位置、ModelLogo 换行、面板内边距条件式、面板定位 compact。
- 全量 `npm test`：3806/3799/0失败/7跳过 → **3830/3830/0失败/0跳过**。
- `npm run precommit`：构建 exit 0 + BLOCKING **22 个文件**全绿（175 项）。
- **esbuild 源码完整性门禁当场抓到我自己的语法错误**（把 JSX 注释塞进 `createPortal(…)` 的参数位）。
  教训：`createPortal(expr, container)` 只接受表达式，注释只能写成 JS 注释放在 return 之前。
- 线上：`index.html` 指向新入口；最大的包 `index-CDWCF7Mr.js`(550292B) 与本地构建**哈希逐字一致**；
  源站 `/` 200；pm2 online；release = `20260916-031257-e9656624`。




15. **并发度越高，「改完立刻提交」越不是风格问题，而是正确性问题。**
   实证（键盘可达线第 65–80 轮，同一轮内）：**4 次工作区改动被并发线 reset 抹掉** ——
   NoteModal 16 处、ContentResultWorkspace、Modals.jsx、以及已删除的 Navbar.jsx 被从 HEAD 恢复回磁盘。
   **3 次丢失全部发生在「一次改多个文件、攒着一起提交」之后**；改为「**改完单个文件立刻提交**」之后，
   后续所有提交**零丢失**。
   → 推论：6 条线共用一个工作区时，**未提交的改动不是「我的工作」，而是「公共的、随时会被覆盖的临时状态」**。
   → 处置：① 一个文件改完就提交（哪怕只有一个 hunk）；② 被抹后**不要 reset**，重做并立即提交；
     ③ 遇到「HEAD 里没有、磁盘上有、且被他人 add 成 A」的文件 → 用 `git rm --cached -- <file>`
     **只撤销该文件的暂存条目**，不动别人的暂存、更不 reset。
   → 附带事实：**编辑器保存竞态**会让文件出现瞬时语法错误（NoteModal.jsx / XhsContentMode.jsx 各一次，
     几秒后自愈），vite dev server 会因此起不来。**验收遇到白屏/构建失败，先重试一次再判定**（同第 6 条）。

16. **被截断的输出，不能当作「文件里没有」的证据。**
   真实事故（2026-09-20，我自己）：我跑 `Select-String -Pattern '^\s*--sb-(dur|ease|…):' | Select-Object -First 30`，
   看到前 30 行全是 surface/border/weight/shadow，就写下「**设计系统此前根本没有动效 token**」。
   实际上文件 §19 早就有 `--sb-dur-instant/fast/normal/slow/slower`(100/150/200/300/400ms) 与 `--sb-ease-out/in-out/in` ——
   **只是它们排在 30 行窗口之外**。基于这个错误结论，我又自造了一套同作用域、取值不同的 `--sb-dur-*`/`--sb-ease-*`，
   制造出**同族第 N 次静默覆盖**（我建的门禁当场判红）。
   → 处置（判据级，不靠自觉）：
     ① **要证「不存在」就必须打印计数**，不能用列表：`… | Measure-Object -Line` 或让脚本输出 `found: 0`；
     ② 分页列出时**必须显式写出「已截断，共 N 行」**，否则不许据此下结论；
     ③ 任何形如「X 没有 / 从来没有 / 根本没有」的断言，**必须先做一次全量计数**；
     ④ 已有类似案例：`design-audit` 之所以只打计数不打清单，就是为了避免这个坑 —— 临时脚本也必须守同一条。

## 2026-09-16 批次二十：视频目录 8/10 条路由永远调不通 —— 用户怀疑的「假模型」是真的

### 用户原话
「你视频生成那边的模型为什么都有呢？为什么你这个图片生成这边就没有呢？就都是些假的模型呢？」
复核结论：**用户是对的。** 视频侧挂 10 个档位，其中 **8 个提交必失败**；默认档（seedance_standard）
走的 `sd5-seedance-2.0` 就是死路由 —— 也就是说「点开始生成就报错」是常态，不是偶发。

### 根因（方法论错误，不是手误）
上架时只核对了「中转 `/v1/models` 里有这个名字」就当成可用。
但那份清单是**全站目录**（中转从上游拉的公共表），与「本站凭证能不能调到」无关。
视频端点真正要求三件事同时成立：① 该模型声明 `supported_endpoint_types` 含 `openai-video`；
② 在 `/api/pricing` 的 `enable_groups` 里含本站分组；③ 渠道真的活着（提交能被上游参数校验接住）。
**123 个模型里只有 39 个声明 `openai-video`**，我们选的 10 条路由里只有 2 条声明了它。

### 修了什么（体系，不是补一个路由）
1. **可达性台账** `ROUTE_REACHABILITY`：每条路由登记状态（verified / callable / blocked /
   unverified / unreachable）+ **证据日期**。新路由不登记就上不了架。
2. **门禁** `test/video-catalog.test.mjs` 挂进 BLOCKING：`public:true` 只允许 verified / callable；
   产品路由必须已登记；时长必须落在白名单里。同类事故从此在提交阶段就被拦。
3. **公开档位从 10 收到 2**：`seedance_fast`（`agv-seedance2.0fast`，**已真实出片验证**）、
   `seedance_standard`（改接 `seedance-2.0`，提交实测 200）。
   其余 8 档全部 `public:false`（**产品 id 保留不变**，老任务/老订单仍解析得出来 = 老数据可读），
   其中能改接活路由的已改接（minimax→`minimax-h3`、2.5→`xn-seedance-2.5`、2K→`minimax-h3-per-request`），
   充值后翻一个 `public` 即可上架。
4. **调研文档更正**：`docs/research/ip233-model-pricing-20260911.md` 新增 §5，
   明确写下「上一节那句『一把 key 覆盖 124 个模型』是错的」，附三条件判据与全部结论表。

### 顺带修掉的第二个同类坑：时长不是连续区间
上游按**秒档位**校验：seedance 2.0 家族只认 **5 / 10 / 15 秒**（其他秒数被上游
`INVALID_TASK_PARAMETERS` 拦下）。而 UI 用 `step=1` 的 4~15 秒滑块、默认值写死 **8 秒** ——
**默认状态就是上游拒收的秒数**。修法：产品契约新增 `durationOptions` 白名单，
前端滑块/下拉/输入框与后端 router 估值**一律吸附到合法档位**（\`nearestSupportedDuration\`），
涉及 `VideoStudio`（滑块+默认值）、`VideoCanvasWorkbench`（下拉）、
`EcCanvas` 画布合成器（下拉+报价 SKU+幂等键+请求体四处统一）。

### 钱：验证方式的教训（用户当场纠正）
用户明确要求：「不是啊，你干嘛要花我的余额呢，你自己验证有这些模型可以接入就好啊」。
本轮花了 **¥6.89**（¥0.91 是真实出片验证，¥5.07 是一次不该发的提交，¥0.91 是鉴别器误产生的任务）。
**正确做法（零成本）**：元数据（`/v1/models` 的字段 + `/api/pricing` 的分组/报价）
+ **故意发非法参数**（非法 ratio / 非法时长）让上游先把请求拦下 —— 被拦 = 渠道活着且报文口径对得上，
既验证了可达性又不产生任务。此后一律先跑零成本探针，真实出片只在需要验证出片链路时、且经用户点头才跑。

## 2026-09-16 批次二十一：线上白屏 P0 —— 「构建绿 ≠ 页面能打开」

### 现象与用户原话
用户截图报「网站打不开了」：整页只有「页面出了点问题 / 发生了一个意外错误」和一个
「Cannot access '...' before initialization」。线上从 **10:36（e9a2cd62 那次上线）** 起就是这个状态。

### 根因（我造成的）
`src/pages/Home/ec/SkillLibraryModal.jsx`：
```
useLayoutEffect(() => { … }, [open, kind, editing]);   // 第 61 行
…
const editing = Boolean(draft.id);                      // 第 115 行
```
**依赖数组在渲染期求值**，而 `editing` 要到第 115 行才初始化 →
`ReferenceError: Cannot access 'editing' before initialization`（TDZ）→ 整页落到错误边界。
责任提交是 e9a2cd62（本会话上一版），2d812fbe 仍带着它。修法：把 `const editing` 提到效果之前。

### 为什么没被拦住（这一批真正的教训）
当时的「上线验证」是 **HTTP 200 + release 符号链接 + 资源哈希逐字一致** —— 三条全绿。
而且 `npm test` 全量绿、`npm run precommit` 全绿、源码语法完整性门禁也绿：
**那段代码编译得非常好**。白屏只在「真的把页面渲染一遍」时才现形。
一句话：**构建绿 ≠ 页面能打开；哈希一致 ≠ 用户能看到东西。**

### 修法（体系，三件一起）
1. `scripts/render-smoke.mjs`（新）：起静态服务跑**真实产物** → 无头浏览器渲染 →
   断言「无 pageerror / 没有落到错误边界 / 首屏有内容」，任一不满足即 exit 1。
   支持 `--dist` 与 `--path`，也可直接指向线上地址复核。
2. 挂进两处：`npm run precommit` 的 `[2/4] 真实渲染冒烟`，以及
   `deploy-production.ps1` 里「构建之后、上传之前」那一步。
3. `test/no-tdz-before-init.test.mjs`（新，挂 BLOCKING）：按 AST 查
   「同一函数作用域内 const/let 的引用早于声明」。自带两条自证
   （白屏那种写法必须被抓到；嵌套闭包与 `?.` 成员访问不许误报）。
   全仓扫 `src`（>200 文件、解析成功率 >95%）**0 处违规** —— 白屏那处是唯一一处。

### 门禁自证（照本仓库的老规矩：门禁必须先证明自己会响）
拿**线上那份坏产物**（`index-BzxheiJN.js`，与线上逐字一致）跑渲染冒烟：
`✖ 落到错误边界：「页面出了点问题」+ ReferenceError: Cannot access '_e' before initialization`；
修好之后同一份产物：`✔ 首屏 573 字、零运行时异常`。

### 顺带发现的连带问题（都已修）
- `videoRendererPreflight` 的时长只校验 `[min,max]`，不校验上游的秒档位白名单 ——
  会放进「6 秒」这种上游必拒的时长，而预检是上线前最后一道。已补 `durationOptions` 判据。
- `video-generation-reliability` 的失败行按**旧路由** `sd5-seedance-2.0` 写死，
  而熔断按 `provider_route` 归集 —— 我改了 standard 的路由之后，熔断历史对不上，
  断言会**假绿**。已改成从产品契约取当前 routeId。

### 环境依赖（写给下一个人）
渲染冒烟需要 `playwright`（本机 node_modules 已装，但**未声明进 package.json**）：
缺了它会以 exit 1 明确报错并提示安装命令，**不会静默跳过** —— 门禁宁可失败也不许说假话。

