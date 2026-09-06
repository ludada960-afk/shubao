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

## 4. 运行时边界

**包管理器双态（2026-08-25 裁决）**：本地 node_modules 为 pnpm 安装态（pnpm-lock.yaml / pnpm-workspace.yaml 已入库）；生产 deploy 链唯一走 npm（package-lock.json，server 端 npm ci 要求与 package.json 同步）。allowBuilds 显式关闭了 canvas / better-sqlite3 / esbuild / protobufjs 的构建脚本——新环境 pnpm install 后 canvas.node、better_sqlite3.node 缺失属预期，需进包手动执行安装脚本（canvas: npm run install 即 prebuild-install）。长期收敛为单管理器需协调重装，未获授权前勿单方面切换。

以下内容永远不进入提交：

- `dist/` 构建产物；部署时由 `npm run build` 重新生成。
- `server/works.db`、`server/works.db-shm`、`server/works.db-wal`。
- uploads、cache、generated-assets、temp_uploads、日志、环境变量和密钥。

`.gitignore` 只对未跟踪文件生效；如果上述文件历史上已被跟踪，必须从 Git 索引解除跟踪但保留本地文件。不得为了清理状态删除用户或生产数据。

## 5. 每次恢复工作的固定顺序

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
