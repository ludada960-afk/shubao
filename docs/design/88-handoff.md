# 88 · 交接说明（2026-09-27，视频/图片工作台对齐这条线）

> 这份是**给下一个会话**看的交接：环境、铁律、当前状态、未完成清单、已知的坑、可复用的探针。
> 配合两份一起读：`RTK.md`（跨会话记忆，**必须用 node 按行切片读，不能用 Read 工具**）
> 与 `docs/design/87-workbench-parity-audit.md`（两侧对齐的实测事实表）。

## 1. 环境与铁律

- 工作树 `F:/da/shubao/.worktrees/codex-ecommerce-stability`，分支 `codex/ecommerce-stability`。
  **绝对不许新建分支。** 部署仓 `F:/da/_deploy-b39`。生产 https://shuimg.cn/。
- **RTK.md 必须用 node `fs.readFileSync` 按行切片读**（Read 工具会在 2000 行截断，项目曾因此丢过 4020 行）。
- 每一批的完整流程，一步都不许省：
  改 → `npm run test`（全量，0 fail）→ `npm run precommit`（build + render smoke +
  `scripts/media-workbench-e2e.mjs` 约 271 条断言 + 38 个 BLOCKING 门禁）→ `git commit`
  （写清「证据」+「用户原话逐字」；`git add` **只按路径**，不许 `-A`）→ 部署 → 服务器上复验 → RTK 追加。
- 部署（cmd 里单独一条，不许用 `;` 串）：
  ```
  cd /d F:/da/_deploy-b39 && git fetch "F:/da/shubao" codex/ecommerce-stability && git checkout --detach <sha> && pwsh -NoProfile -File scripts/deploy-production.ps1 -RepoPath F:/da/_deploy-b39 -SkipPublicChecks
  ```
  **唯一成功判据**：`Deployed <sha> to https://shuimg.cn/` + `Released remote deployment lock`。
  部署前先确认 `VOLC_MEDIAKIT_API_KEY` 还在（ssh + grep，应为 1）。线上复验要在**服务器上**跑（ssh + curl）。
- **钱的铁律**：没有用户明确批准，不许新增/变更收费项或扣费金额；不许跑付费生成（哪怕"验证一下"）；
  不可用/未接通的功能一律 `public:false` 或不渲染，并在注释里写明原因。
- 改判据必须写明是「事实变了」还是「用户改向」，并把用户原话写进断言；不许为了让断言过而删真实功能。
- 用户的元要求：他说的**每一条都要做完**，不许只做一点就交代；「同等级的东西必须同等级设计」。

## 2. 当前状态（交付时刻）

- 生产已上线（本线按时间）：`50d7d061`(CA 去框 + 缺素材 CTA 变暗)、`64d367e1`(CB)、`434de42c`(CC)、
  `0afd67e1`(CG 生成记录搬进右栏)、`67bc633c`(CH 放大不压字/框高 150/撤掉左槽)、
  `138ece5d`(CI 按钮区空地不再点亮第一颗)、`1e6ef84c`(CJ 浮层让开导航 + 提示挪按钮下方)、
  `fe5307ca`(CK @/放大/字数同一行)、`a3582459`(CL 去掉预填提示词)、`33dc2fb5`(CM 生成脚本按钮到底部动作区)、
  `7b322e28`(CN 脚本框吃掉尾部死空白)、`cf58acb3`(CO 拉高手柄)、**`aa8e1f43`(CP 那一行两板块共用、图片侧也有 @)**
  —— 已确认：`Deployed aa8e1f43`，release `20260927-170223-aa8e1f43`，`/api/health` 200。
- 最近提交：`418ef3c2`（docs：87 对账表 + 批 CR 记录）。

## 3. 未完成清单（按优先级）

1. **动效对表补完**：视频侧「分段/胶囊」那一档没量到 —— `video.smart` 不声明 chips，
   探针取到的是**元素不存在**，不是"没有动效"。要挑一条**有 chips 的技能页**（如爆款复刻
   `video.remake` 的「替换对象」两颗胶囊）与图片侧对表；并给 `.video-config-trigger` 的 **0.2s**
   vs 其它件 **0.18s** 一个说法（统一，或写明为什么配置按钮可以慢 20ms）。
   脚本：`.qa/cr-narrow-and-motion.mjs`。
2. **字数上限口径不一致**：字段真实上限 `promptMaxLength=8000`，区块声明 `max=10000`，页面显示的是后者
   （`VideoWorkbench` 里 `counterMax={block.max}`）。**这是"定数"的事，先问用户**。
3. **【用户点名最重、一直没做】知渔 `/apps` 各子页面逐页对表**：现在只对过「页面形态 + 字段清单」
   （`src/skills/quantvVideoParity.js` 那张表）。建议：先把他们约 32 个页面的几何与控件抓一遍
   （CDP/浏览器），再与我们两侧逐项对，产出**带实测值**的表，不写"应该差不多"。
4. 任何新批注：用户会持续用「截图 + 框选」给意见 —— 框选里的原话**逐字**进提交说明与 RTK。

## 4. 已知的坑（这一批全踩过）

- **cmd 里多行 `node -e` 会被拆坏** ⇒ 要写多行脚本就落成 `.tmp/*.cjs` 再 `node` 跑（本批因此返工约十次）。
- **precommit / e2e 不许并行跑**：端口默认 4197（现可用 `SHUBO_E2E_PORT` 覆盖）。跑前
  `netstat -ano | findstr :4197 | findstr LISTENING`，有残留先 kill。
- **「元素被裁」先看层叠**（谁盖谁、`elementsFromPoint` 命中谁），不要只量"在不在视口内"——
  我在 1440 下量了三次都说"没越界"，真相是**被左侧导航压住**。
- **加了新组件/新 import 后先跑一次 `.qa` 页面探针再跑 precommit**：漏 import 会让页面进错误边界，
  探针 3 秒能 dump 出错误文案（如「PromptMetaRow is not defined」），端到端要 20 秒超时才暴露。
- 工作树红在**别人路径**的文件上时：**不要改别人的文件**；用隔离 worktree 验证自己的提交 ——
  `git worktree add F:/da/shubao/.worktrees/<name> --detach <sha>` +
  `cmd /c mklink /J <dir>\node_modules <主工作树>\node_modules` → 里面跑 `npm run precommit`
  → `git worktree remove --force` + `rmdir` 那个联接。
- **并发危险**：别的会话会同时改 `src/pages/MediaCreation/index.jsx`、`src/pages/Home/SkillWorkbench.*`、
  `scripts/media-workbench-e2e.mjs`。提交前看 `git status`，**不要提交正在被别人写一半的文件**
  （批 CD 就是这么把产物搞崩的：调用点在、声明不在 ⇒ ReferenceError ⇒ e2e 红 ⇒ 只能回退重做）。
- 探针里"没有输出"要区分**元素不存在**与**值为空**（我差点把"元素不存在"写成"没有动效"）。

## 5. 可复用的探针（都在 `.qa/`，启动方式照抄任意一个）

`cb-diag`（框/内缩/按钮宽度）、`cc-toolbar-width`（6 档视口控件宽度）、`ch-diag`（面板/放大压字/滚动槽）、
`ci-hover-empty4`（空地悬停是否点亮第一颗按钮）、`cj-verify`（导航右沿/浮层 left/CTA 与提示 y 关系）、
`ck-script-block`（框下那一行的结构）、`cm-script-button`（脚本按钮位置）、`cn-blanks` + `cq-below-bar`（留白来源）、
`co-resize`（拉高手柄）、`cp-meta-row` + `cp-image-crash`（两侧那一行 / 图片页是否崩）、`cl-prefill`（进页面是否预填）、
`cr-narrow-and-motion`（窄屏浮层 + 动效）。

## 6. 写法与风格

- 注释里保留「用户原话（逐字）+ 实测数值 + 根因」—— 这是本仓的规矩，下一个人靠它判断"能不能改"。
- 不要为了"看起来完成"而放宽判据；不确定就写"未量/未做"，并说清下一个动作是什么。
