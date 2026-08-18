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

- 2026-08-16，AI 视频 P2 SkillRun 预览/检查点切片已在本地完成。新增有界的
  声明式 SkillRun 规范化、owner/project 隔离的 `video_skill_runs` 与追加式
  `video_skill_run_events`，以及预览、读取、检查点确认的签名接口。预览使用已有
  项目幂等键，确认要求 `expectedRevision`，并只写 SkillRun 事件，不创建 provider
  任务、generation run、usage、wallet、quote 或 billing hold。焦点回归 `30/30`、
  全量回归 `1663/1663`、`npm run check`、6510 模块构建和 diff 检查通过；工作台仍
  默认关闭，未触发付费视频生成。提交 `834cfa6` 已完成，但发布脚本因当前
  进程无法读取受控 SSH 私钥而在远端变更前停止；公开视频契约与计费校验通过，
  新 SkillRun 路由线上仍为 `404`，所以不能声称已上线。唯一下一边界是恢复受控
  发布凭据后通过同一脚本完成 600 秒 Canary，并记录 PM2、锁释放和独立复核。

- 2026-08-16，AI 视频 P2 已在本地进入 clone/remix 切片。新增
  `POST /api/video/projects/:projectId/workbench/replay-manifests/:manifestId/clone`，
  从不可变 replay manifest 原子复制出新的 owner 草稿项目，保留素材版本、分镜绑定、
  候选选择和时间线，并清空 generation job 归属以避免伪造供应商交付。复制前校验
  manifest 的规范化 SHA-256，跨账号统一隐藏，重复 Idempotency-Key 返回同一草稿；
  全程不写 provider、generation runs、usage、wallet、quote 或 billing hold。客户端已
  增加签名调用。焦点回归 `25/25` 通过，完整回归、构建、部署和公网 Canary 尚待本切片
  release gate；工作台仍默认关闭，未触发付费视频生成。

- 2026-08-16，AI 视频 P2 “可复用创作配方”代码候选已完成。新增版本化、
  规范化 SHA-256 replay manifest，包含项目图、素材版本、分镜绑定、时间线、
  Skill/模型目录快照和版权确认；播放签名 URL 与内部账号字段不会落盘。新增
  owner-scoped 不可变存储、创建/读取 API 和签名客户端，重复哈希复用，默认工作台
  仍关闭且不触碰 provider/billing/wallet。焦点 `24/24`、全量 `1655/1655`、
  `npm run check`、6510 模块构建和视频工作台无计费验证均通过。首次 P2 发布曾成功
  切换但部署包装器在重启后读取 Canary token 时因 PowerShell SSH 无界等待而中断；
  该版本没有执行无护栏回滚。随后电商增量覆盖了线上 P2 路由，独立校验已确认这一点。
  `scripts/deploy-production.ps1` 现已加入 30 秒有界 SSH 捕获及回归测试。提交 `5b80bcd`
  已通过唯一入口完成发布；PM2 PID `2802100` 的完整 600 秒 Canary、健康、117 张图库、
  两个公开视频产品、认证无计费视频校验、计费校验和电商稳定资产校验均通过，锁持有进程
  已释放，独立复核再次通过。P2 可进入 clone/remix 设计，但工作台仍保持默认关闭。

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

## 2026-08-16 AI Video Foundation Production Release

## 2026-08-16 AI Video P1 Owner Pilot Gate

- P1 owner-gated workbench commit `0afad54` is now live at `https://shuimg.cn/`
  through `scripts/deploy-production.ps1`. The first deployment attempt stopped
  before switching the active release; a retry completed migration checks, PM2
  reload, Nginx validation and a full 600-second canary. Repeated public health,
  117-image gallery, ecommerce stable-asset and authenticated non-billing video
  contract checks passed. The public capability contract still reports
  `workbenchEnabled=false`, while the two Seedance products and `tus` upload remain
  available. No paid generation was requested or submitted.
- Independent online read-only verification agrees with the release output. The
  previous symlink target remains available for rollback and the remote deployment
  lock is free. Do not enable the owner pilot until an operator explicitly approves
  it after owner browser acceptance and stable stage SLO evidence; deployment alone
  does not open the flag.

- 本地 owner pilot 已完成：`VIDEO_PLATFORM_P1_WORKBENCH` 仍默认关闭，服务端新增 owner
  cohort gate，能力发现和全部 workbench 路由均受保护；普通测试账号统一返回不可用 404，
  不泄露灰度资格。
- SQLite workbench 新增 append-only operation telemetry 与只读 funnel/SLO 快照，后台展示
  owner pilot 的 started、approved assets、storyboard ready、candidate/timeline、stale、
  24h success rate 和 p95 latency。
- `npm test` `1651/1651`、重点回归 `30/30`、`npm run check`、`npm run build`（6510 modules）、
  `npm run verify:video-workbench-pilot`、`git diff --check` 全部通过。十个隔离项目全部达到
  approved asset/storyboard readiness，40/40 operations 成功，未写入 `video_jobs`、
  `usage_events`、`billing_holds` 或 wallet。
- 本地 HTTP 验收已证明匿名 capability=false、owner 可创建项目/资产/分镜并读取 workbench、
  tester 路由不可见。既有浏览器验收覆盖 P1 UI；本轮 Playwright daemon 不可用，未进行任何
  付费视频生成。下一门槛是仅通过 `scripts/deploy-production.ps1` 做默认关闭生产发布和
  600 秒金丝雀，随后再评估是否开启 owner pilot。

- AI 视频 P0 可靠媒体、任务、尝试、交付、账务、Outbox/恢复底座，以及 P1 六阶段项目
  工作台已随提交 `5d933c2` 通过唯一入口 `scripts/deploy-production.ps1` 发布至
  `https://shuimg.cn/`。Nginx `current` 指向
  `/var/www/shubao/releases/20260816-105210-5d933c2`，PM2
  `shubao-production` PID 为 `2707250`，健康接口 `ready=true`，远端部署锁已释放。
- P1 工作台仍由服务端能力开关保持默认关闭，公开契约返回
  `workbenchEnabled=false`；现有单次视频生成入口保留两个 Seedance 2.0 产品、`tus`
  断点上传和原计费链路。本轮未触发付费视频生成，本地验证为
  `paidGenerationRequested=false`、`providerSubmissions=0`，生产只执行带认证的非计费
  视频契约 Canary。
- 发布门通过：定向部署/空间门禁 `23/23`、全量测试 `1643/1643`、`npm run check`、
  `npm run verify`、`6510` 模块生产构建、117 张图库、2 个公开视频产品、账务/会话契约、
  真实电商任务和完整 600 秒观察流程。任务
  `ec_85448885-1c9c-4de3-b65a-9c79518a2ba6` 与
  `ec_9d4e3129-4cb1-493e-8183-7205929379ec` 均交付 3 个稳定资产；观察期后的首个方向
  分析探针降级一次，部署脚本按上限重试后成功，未绕过验收。
- 早先发布尝试失败的根因是陈旧回滚备份把根盘推至 99%，SQLite 持久化返回
  `ENOSPC`，不是新视频状态机本身失效。只清理了已核实的陈旧部署备份，未触碰数据库、
  上传、生成作品、当前 release 或必要回滚点。正式部署脚本现会在创建备份前仅保留最近
  两个旧回滚备份，并在可用空间少于 2 GiB 时拒绝发布。独立核验可用空间为
  `3,448,340 KiB`（根盘使用约 92%），当前保留 3 个回滚备份。
- 长期路线继续以
  `docs/superpowers/plans/2026-08-14-ai-video-platform-roadmap.md` 为事实源。下一门槛是给
  P1 建立 owner cohort，完成桌面/移动浏览器验收与 10 个不触发计费的项目闭环并观察
  阶段 SLO；通过前不得开放公共开关。P2 声明式 Skill/项目记忆/精确做同款和 P3 区间
  重拍/延长/追踪替换/智能路由，继续由前序阶段证据解锁，不并行对外发布。

## 2026-08-16 AI Video P2 SkillRun Execution Preview

- 本地 `codex/video-platform-p0` 新增纯执行计划底座：SkillRun 规范化会拒绝循环依赖，
  `buildSkillRunExecutionPlan` 根据已完成步骤稳定计算 ready、blocked、complete 状态，
  并拒绝未知或重复的完成步骤。聚焦回归 `33/33`、全量测试 `1666/1666`、`npm run check`、
  6510 模块构建和 `git diff --check` 全部通过；无 provider、generation、usage、wallet 或
  billing 写入，也未触发付费视频生成。
- 该切片尚未部署。唯一发布入口因当前环境无法读取受控 SSH key 而在远端变更前停止；公网
  视频/账务检查仍通过，新 SkillRun 路由返回 `404`，因此不能声称已上线。待受控凭据恢复后，
  必须重新走 `scripts/deploy-production.ps1` 和独立 600 秒 Canary。

## 2026-08-16 AI Video P2 SkillRun Step Events

- 本地 SkillRun 已接入 owner/project-scoped `step.completed` 追加事件：只有声明的步骤、
  依赖全部完成且 revision 匹配时才可推进；执行计划在读取和每次变更时稳定投影，状态由
  `preview` 经 `running` 到 `complete`。路由与客户端均使用签名会话，不信任 body owner。
- 聚焦回归 `31/31`、全量测试 `1669/1669`、`npm run check`、6510 模块构建、工作台验证和
  `git diff --check` 全部通过；没有 provider/generation/usage/wallet/billing 写入，也未触发
  付费视频生成。该切片尚未部署，待受控 SSH key 恢复后必须通过唯一入口和 600 秒 Canary。

## 2026-08-16 AI Video P2 SkillRun Replay Snapshot

- 回放清单现在保存受限的 SkillRun 配方快照：Skill 标识与版本、输入、步骤、检查点、模型策略、
  输出契约，以及已完成步骤和执行状态。快照经过字段白名单、稳定排序和 32KB 上限处理，排除了
  owner、project/run/step-event ID、provider job、会话和计费内部字段。
- 创建清单时通过 owner/project 作用域解析 `skillRunId`；克隆时只把快照写入新项目版本的
  `plan_snapshot`，不复用旧运行实例，不创建 provider/generation/usage/wallet/billing 写入。
  这补齐了“做同款”缺少执行配方的问题，同时保持现有回放幂等和权限边界。
- 定向回归 `35/35`、全量测试 `1671/1671`、`npm run check`、6510 模块生产构建、工作台验证和
  `git diff --check` 全部通过；本切片没有触发付费视频生成，也没有修改电商、图库、Home、Canvas
  或生产展示代码。
- 本切片仍未部署。唯一发布入口因当前环境无法读取受控 SSH key 而在远端变更前停止；公网视频/账务
  检查仍通过，新 SkillRun 路由在生产返回 `404`。待受控凭据恢复后，必须重新走
  `scripts/deploy-production.ps1` 和独立 600 秒 Canary，不能据此声称已上线。

## 2026-08-16 AI Video P2 Project Memory

- 本地分支 `codex/video-platform-p0` 的提交 `01eb149` 新增项目记忆层。SQLite 表
  `video_project_memory_facts` 以 `(owner_email, project_id, fact_key)` 唯一约束保存事实，
  采用 `user`、`approved_asset`、`skill` 三类来源，最多 64 条事实、128 字符键、8 KiB
  序列化值、16 个素材引用和 6 层 JSON 深度；事实更新使用 `expectedRevision` 乐观并发，
  删除为可审计软删除。
- API 为 owner 签名会话保护的
  `GET/PUT/DELETE /api/video/projects/:projectId/workbench/memory` 及 fact-key 子路径。
  素材引用必须属于同一 owner/project 且为 approved version；跨 owner、未批准素材、过期
  revision 和非法边界均返回受控错误，不信任请求体中的 owner。
- `listWorkbench` 一次返回活动 memory；回放清单只保留有界的脱敏事实；clone/remix 将
  事实和素材引用重映射到新项目，不复用旧运行 ID、会话、provider job 或计费字段。工作台
  的 `项目记忆` 面板沿用现有受控 workbench UI，支持 JSON 编辑、revision 保存和软删除。
- 验证证据：项目记忆/回放/工作台定向回归 `23/23`，全量 `npm test` 为 `1678/1678`，
  `npm run check` 通过，生产构建成功（6510 modules），`git diff --check` 通过。该切片
  未调用 provider、未创建 generation/usage/wallet/billing 写入，也未触发付费视频生成。
- 发布状态：`01eb149` 尚未部署；线上仍是此前已发布的 P1/P2 前置 release，新增 memory/
  SkillRun 路由在生产不可用，不能声称已上线。当前环境无法读取受控 SSH key；恢复凭据后
  只能通过 `scripts/deploy-production.ps1` 发布，并重新执行视频契约、账务契约和有界 600
  秒 Canary。P2-02 的生产退出证据（至少两个真实 Skill 工作流的回放/项目记忆证据）仍未满足。

## 2026-08-17 AI Video P2 Proven Skill Templates

- 本地分支 `codex/video-platform-p0` 新增 `server/videoSkillTemplates.mjs`，注册两个版本化、
  默认关闭的真实工作台模板：`product-ad-v1`（智能成片/产品广告）和
  `reference-video-reconstruction-v1`（爆款重构/参考视频重构）。模板来源对应现有
  `videoStudioModel.js` 的 `smart`、`remake` 模式，不引入新的供应商或隐藏提示词。
- 模板输入只接受有界文本和同 owner/project 的素材 ID；服务端重新构造 SkillRun DAG、检查点、
  能力与输出契约，拒绝越界引用和缺失参考视频/替换素材。`GET .../skill-templates` 与模板预览
  入口沿用现有 owner/cohort gate、签名会话和幂等链路；预览只落本地计划/事件，不创建 provider、
  generation、usage、wallet 或 billing 记录。
- 相关文件：`server/videoSkillTemplates.mjs`、`server/videoSkillRun.mjs`、
  `server/videoWorkbenchRoutes.mjs`、`server/videoWorkbenchStore.mjs`、
  `src/services/videoWorkbench.js` 及三组路由/客户端/SkillRun 测试。
- 验证证据：模板/工作台定向测试 `31/31`，全量 `npm test` 为 `1687/1687`，
  `npm run check` 通过，生产构建成功（6510 modules），`git diff --check` 通过；本切片没有触发
  付费视频生成。
- 发布状态：当前切片尚未部署。受控 SSH key 在本环境仍不可读，因此不能声称线上已生效；恢复凭据后
  必须只经 `scripts/deploy-production.ps1` 发布，并重新做 owner 隔离、零计费副作用与独立 600 秒
  Canary。未取得这些证据前，P2-03 只算本地验证完成。

## 2026-08-17 AI Video P2-04 Template Replay Provenance

- 回放清单现在保留模板来源：模板预览生成的规范化 SkillRun plan 会携带 `templateId`，
  `videoReplayManifest` 将其写入脱敏的不可变快照，owner-scoped clone 再从 project version
  snapshot 还原；旧的非模板运行保持原有精确对象形状。runtime run ID、owner 身份、播放 URL
  不会进入快照。
- 验证证据：SkillRun/模板/工作台/回放/Store 定向组合测试 `54/54`，全量 `npm test` 为
  `1687/1687`，`npm run check`、6510 modules 生产构建、`git diff --check` 全部通过；没有调用
  provider、generation、usage、wallet 或 billing，也没有触发付费视频生成。
- 发布状态：该修复尚未部署。受控 SSH key 仍因环境权限不可读，不能声称线上生效；凭据恢复后必须
通过 `scripts/deploy-production.ps1` 发布，验证 owner 隔离、模板 ID 回放/克隆和零计费副作用，
再执行带回滚证据的 600 秒 Canary。

## 2026-08-17 AI Video P2-06 Audio Continuity

- 本地分支 `codex/video-platform-p0` 新增 owner/project-scoped、revisioned 的
  `video_audio_tracks`。音轨只能绑定已批准的 `voice`/`music` 音频素材版本，并校验时长、
  音量、静音、语言、声线锚点、节拍标记和字幕 cue 的边界；创建/编辑 API 使用签名会话和
  `expectedRevision`，不信任 body owner。
- replay manifest 会保存脱敏的连续性元数据但排除播放 URL；clone/remix 会将音轨及其已批准
  素材版本 ID 一起映射到新草稿项目。该切片未做音频转码、波形渲染、TTS、供应商路由或付费
  生成，属于 P2 的本地候选，不改变默认关闭的生产开关。
- 实施计划为 `docs/superpowers/plans/2026-08-17-ai-video-p2-audio-continuity.md`。聚焦测试、
  全量回归、静态检查和生产构建完成后，仍须通过唯一部署脚本、owner cohort 与 600 秒 Canary
  才能推进生产状态；当前受控 SSH key 仍不可读，因此不能声称已上线。

## 2026-08-17 AI Video P2-06 Workbench Audio Surface

- 视频项目工作台继续保持默认关闭，但已在本地暴露最小可用的连续性操作：仅显示已确认的
  voice/music 音频版本；存在视觉时间线后可加入音轨；重复素材版本会被禁用；已有音轨可用
  owner-scoped optimistic revision 调整音量或切换静音。面板只展示并修改已持久化的时长/音量
  元数据，不伪造波形、转码、TTS 或供应商结果。
- 证据：UI/model focused tests 与全量 `npm test` `1694/1694`、`npm run check`、6510
  modules 生产构建、`git diff --check` 均通过；没有 provider、generation、usage、wallet、
  billing 或付费视频调用。提交后仍需受控 SSH key 恢复，再经唯一部署入口和 600 秒 Canary，
  目前不得报告为线上生效。

## 2026-08-17 AI Video P2-06 Release Gate

- 已对提交 `b20f794` 执行唯一标准部署脚本；本地门禁（1694/1694、check、6510 modules build）
  通过。
- 远端阶段 fail-closed：`C:\\Users\\SHEJI\\.ssh\\shubao_deploy_ed25519` 对当前进程不可读，
  SSH 返回 `Permission denied`，因此未执行远程上传、切换、重启、回滚或 Canary。
- 后续仅在受控凭据恢复后重跑 `scripts/deploy-production.ps1`；在此之前不得把本地 P2-06
  音频连续性/工作台面板描述为已上线。

## 2026-08-18 AI Video Delivery Gate and Deployment Truth

- 提交 `0f06ade` 将候选交付边界收紧：只有已完成、非空、带哈希且 MIME 为 `video/*` 的媒体
  才能进入候选版本；工作台对缺失或加载失败的预览显示明确的不可用状态，不再留下空白占位。
  定向覆盖 `49/49`，全量 `npm test` `1727/1727`，`npm run check`、6510 模块构建和
  `git diff --check` 均通过；没有调用视频供应商或产生付费视频。
- 提交 `77ff79e` 新增发布金丝雀前电商余额门禁：会先读取主账号 `ec_points`，余额不足 3000 单位时在上传
  素材和多模态分析前失败，避免重试制造已知失败任务。线上只读核验显示主账号余额为 0，
  最近电商任务错误均为“AI 积分不足，请购买套餐后继续”。
- 已按唯一入口尝试发布 `0f06ade`：本地构建、远端重启/健康、图库/视频契约和非计费视频检查
  均通过；电商金丝雀因余额为 0 失败，脚本已自动回滚并释放部署锁。线上健康接口正常，当前
  active release 是回滚前版本（远端仓库 `73f3dfb`），`0f06ade` 尚未上线，生产
  `workbenchEnabled=false`。在主账号补足可验证的电商金丝雀额度前，不得声称本地 AI 视频
  工作台已上线，也不得绕过电商验收门禁。

## 2026-08-18 AI Video Production Dependency Rollback Hotfix

- 只读线上复核发现 Nginx 502：PM2 进程仍显示 online，但 3002 没有监听；日志为
  `ERR_MODULE_NOT_FOUND: @tus/file-store`。根因是旧版回滚只恢复 `server/`，没有同时恢复
  `package.json`、`package-lock.json` 和依赖目录，造成代码与依赖图混用。
- 已在远端执行一次不改代码的紧急修复：按现有版本安装 `@tus/file-store`/`@tus/server` 并重启
  PM2；`https://shuimg.cn/health` 与 `/api/video/capabilities` 已恢复 200。此操作未调用视频供应商、
  未生成付费视频、未将 AI 工作台发布上线。
- `scripts/deploy-production.ps1` 已修复：备份时保存两个 package manifest，回滚时恢复它们并先执行
  `npm ci --omit=dev` 再启动 PM2；`test/deploy-script.test.mjs` 聚焦覆盖 `25/25`。以后回滚不会再留下
  仅恢复业务代码而依赖图不一致的状态。

## 2026-08-18 AI Video Export Manifest Local Slice

- 本地 `codex/video-platform-p0` 新增可审计的视频导出清单边界：只读取当前项目中非 stale 的已选视频候选、有效裁剪区间、已审核 voice/music 版本、字幕与节拍元数据，按规范化内容生成 SHA-256 hash，并通过 owner/project-scoped API 持久化与幂等读取。
- 工作台新增“导出准备”面板，明确提示“仅生成可审计交付清单，尚未调用渲染器/供应商，不会扣积分”；没有生成下载 URL、没有提交 provider、没有创建 wallet/usage/billing 记录。导出清单不是 MP4 成品，后续仍需 renderer worker、代理文件、断点恢复与下载链路。
- 证据：导出/工作台定向 `10/10`、相关工作台/回放定向 `74/74`、全量 `npm test` `1736/1736`、`npm run check`、6510 模块生产构建、`git diff --check`、非计费 pilot verifier 全部通过；`npm run collab:check` 因当前 linked worktree 无协作标记而按策略 BLOCKED。
- 本切片尚未部署，生产 `workbenchEnabled=false`，未触发任何付费视频生成。完成真实 renderer 与 Stage 1 退出证据前，不得把“导出准备”描述为线上 MP4 导出已上线。

## 2026-08-18 AI Video Export Manifest Integrity

- 导出清单读取现在会对持久化 JSON 重新计算 SHA-256，并校验存储的 `schemaVersion` 与 `kind`；被篡改、部分写入或哈希不一致的记录不会被当作可交付结果返回。
- API 将此类情况统一返回 `EXPORT_MANIFEST_INTEGRITY_INVALID`（500），提示重新生成清单；该切片仍然没有渲染器、下载 URL、provider 调用或计费写入。

## 2026-08-18 AI Video Export Duration Feedback Fix

- 工作台导出状态现在从 `manifest.timeline.durationMs` 读取清单时长；此前错误读取顶层 `manifest.durationMs` 会让成功保存的清单一直显示“时长待定”。已补充 UI 回归断言，未引入 provider、渲染器或计费路径。

## 2026-08-18 AI Video Renderer Handoff Contract

- 导出清单现在可以在本地被幂等冻结为 owner/project-scoped 的 `video_export_jobs` 任务，初始状态为
  `waiting_renderer`。状态机只允许 `rendering -> failed/completed/canceled`、失败重试回到等待和终态锁定，
  完成必须带非空输出资产与地址；任务与清单均用 SHA-256 做完整性校验。
- 创建或内部 worker 状态迁移前会重建当前时间线清单；用户编辑时间线后旧任务返回 `EXPORT_JOB_STALE`，
  不会把过期版本送入未来渲染器。读取篡改行返回 `EXPORT_JOB_INTEGRITY_INVALID`。
- `POST/GET /api/video/projects/:projectId/workbench/export-jobs` 及详情读取只负责任务交接和状态查询，
  没有真实 renderer/provider、下载 URL、usage/wallet/billing 副作用，工作台仍默认关闭，生产未部署。

## 2026-08-18 AI Video Renderer Lease and Recovery (Local Only)

- `video_export_jobs` 现在持久化 `worker_id`、`lease_token`、`lease_expires_at`，启动时会给旧 SQLite 表自动迁移这三列。
- worker 只能领取 `waiting_renderer` 任务，只有持有匹配且未过期租约的 worker 才能续租或完成；租约过期会一次性恢复为
  `failed/EXPORT_JOB_LEASE_EXPIRED`，显式回到 `waiting_renderer` 后才能重试。整个恢复过程不改 provider、usage、钱包或计费。
- 领取、续租、恢复和状态迁移前都会重新构建当前时间线清单并校验清单/任务哈希；用户编辑时间线后，旧 handoff
  fail-closed，不会送入未来 renderer。
- 证据：租约 job/store 定向 `12/12`、全量 `npm test` `1751/1751`、`npm run check`、6510 模块构建、`git diff --check`
  和 10 项非计费视频工作台 pilot 均通过；`billingMutated=false`。这只是本地可靠性切片，生产 `workbenchEnabled=false`，没有真实
  renderer/provider，也没有触发付费视频生成。
- 下一门禁是 provider-neutral renderer adapter、outbox/reconciliation 和断线故障矩阵；在这些完成前不能把排队状态描述成已生成 MP4，
  也不能开放生产视频工作台。
