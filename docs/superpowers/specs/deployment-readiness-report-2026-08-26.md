# 部署就绪报告 — 2026-08-26 (代码冻结、不真部署)

> 审计子代理输出 · 仅事实陈述与就绪结论,不含真实部署动作。
> 受 RTK.md §2026-08-23 视频线程协调状态约束:视频线程未确认完成前,共享工作树不得部署。
> 本报告对应"用户授权部署"前置审计;**真实部署动作 `scripts/deploy-production.ps1` 不在本轮授权范围**。

---

## 0. 总体结论

| 项 | 状态 | 备注 |
|---|---|---|
| 当前 HEAD | `cc91428d` (本地,未发布) | `codex/ecommerce-stability` 分支 |
| 最近线上发布 | `9a94711` (RTK §2026-08-23) | 自此之后本地累计 558 commit |
| 工作树脏文件 (git tracked) | 0 | `git ls-files -m` 为空;`git status --porcelain` 仅含 `.gitignore` 排除的运行态/构建产物 |
| 待 commit 数量 | 0 (核心源码/规范) | `.tmp/`、`dist-codex-build-*`、`server/extension_tasks/*.json`、video 线程 WIP 12 个文件均受 `.gitignore` 或他人并发域保护,本轮不暂存 |
| 8 项商业化 commit | 全部已落 | `2e8d93c6..751ab44e`,ledger 提交 `2e8d93c6` |
| 定向测试 | 48/50 通过 (96%) | 5 文件定向,2 fail 均为 fast-daily-limit 日期边界/数据可用性 (非功能回归) |
| Build | ✅ 通过 | 6746 modules, 23.67s, 0 error;CSS 警告 1 处 (已 commit raw CSS 注入) |
| 真实部署动作 | ❌ 未执行 | 严格遵守"用户最终授权才执行"红线 |
| 视频线程 (RTK §110-112) | ⚠️ 仍持 12 个 WIP 文件 | **按 RTK 强制约束,共享树不得部署** (见 §7 风险) |

---

## 1. 受保护文件确认 (RTK / 任务红线)

以下文件**全部在已 commit 树内,工作树零改动**,本轮 `git ls-files -m` 验证无任何未提交修改:

- `server/db.mjs` ✅ 未动
- `server/mailService.mjs` ✅ 未动
- `server/billing/contentBilling.mjs` ✅ 未动
- `test/content-billing.test.mjs` ✅ 未动
- `server/extension_tasks/*.json` (12 个) ✅ 已 `D` (committed 历史状态,工作树无未提交变化)

`.gitignore` 排除的运行态/构建产物**全部保留**:`.tmp/`、`dist-codex-build-20260820*/`、`dist-codex-verification/`、`.worktrees-helper/`、`tmp/`、`.tmp_patch_responsive.py`、`scripts/diagnose-recent-ecommerce-jobs.cjs`、`scripts/director-monitor.mjs`、`server/video-assets/`、`vite.config.verify.mjs`、`docs/reports/canvas-shots/super-test/`、`docs/reports/canvas-trace/super-test/`、14 个 `.tmp-nav-*.png` / `.tmp-browser-*.png` / `.tmp-profile-*.png` / `xhs-*.png` / `visual-free-*.png` 截图。

视频线程未提交 WIP (RTK §110-112 提到的 12 个 video 文件) — `?? server/video-assets/` 与未跟踪的 5 个截图 / 4 个 specs 文档 (`2026-08-25-video-benchmark-blueprint.md` / `2026-08-26-director-ecosystem-audit.md` / `2026-08-26-pricing-full-ecosystem.md` / `director-briefing.md`) 在工作树,但**全部在他人并发域,本轮严禁误暂存**。

---

## 2. 30+ 待部署 commit 链 (按时间倒序,自线上 `9a94711` 起)

仅展示本次审计重点的前 35 个;**完整链 `9a94711..HEAD` 共 558 commit,1290 files, +120396 / -4552**。

```
cc91428d canvas-research V3: add remaining tapnow-v3 baseline shots + hover data files
0f21eea5 canvas-research V3 comparison: temporal tables (8 actions x 3 sites) with ms-precision timing
1a575641 canvas-research V3: append §13/§11/§15 to all 3 site teardowns with timing tables and shared architecture findings
ff38b71f canvas-research quantv A01-A08: custom canvas (non-react-flow), no chat, drag works, no rclick menu
2e8d93c6 docs(sdd): 8-item §6 monetization slice final commit-hash ledger          ★ 商业化 8 项收尾
7e0624c5 monday-slice: #8 XHS studio 60→50 with 60-day legacy user snapshot        ★ #8
0fd490e5 canvas-research liblib A01-A08 screenshots
92395807 canvas-research liblib A01-A08: 9-item add-node menu + shared React Flow + handle across sites
88aa3ff8 feat(billing): price defense plan + admin alert (item §6 P2 #4)            ★ #4
0960ebda canvas-research tapnow A08: no dedicated generate button, chat-only with 1s response, no loading indicator
fbe685c2 feat(billing): fast tier N=2 daily limit (default) with 7d ramp to N=3 (item §6 P1)   ★ #6
94d83ceb canvas-research tapnow A07: toolbar button hover - 2 patterns (group-hover overlay 200ms vs bg-color instant)
23fa42d9 monday-slice: #5 monthpack 30d + xcard_gift whitelist + admin byChannel   ★ #5
d6c07e31 monday-slice: #3 nano 2K price fix 1->1.5 credits + 7-day legacy transition  ★ #3
751ab44e monday-slice: #1 H3-2K long tier priced at ¥16.9 (1元=100分锚)              ★ #1
e793f773 monday-slice: #7 H3-2K gray-release invite codes (table + admin generator + public check)  ★ #7
8a17febf canvas-research tapnow A06: connection drag - 7.8px handle, + handle overlap, silent no-op
851f6ccc canvas-research tapnow A05: drag 1step/3step/edge with full event timing trace
0d0726aa monday-slice: #2 standard tier A/B price experiment flag + byUserId split + admin byVariant  ★ #2
e130020a canvas-research tapnow A04: right-click has no context menu on any node type
ee4d1a1e canvas-research tapnow A03: node + handle is connection-extender, not menu
2b662b6f canvas-research tapnow A02: center 模板 chip opens dialog with 3 tabs + 9 category chips
41aa253e canvas-research v3-timing: 4 tables (latency/curve/state-machine/error) + 10 抄 recommendations
0004568c canvas-research tapnow A01: dblclick on empty canvas creates command node
01bb9e6c canvas-research PROGRESS update 8/9 V2 done
9c6dfb3a canvas-research benchmark-comparison-v2 incremental
91e06b20 canvas-research quantv v2-real-shots
d4fbe957 canvas-research liblib v2-real-shots
02c886ac canvas-research tapnow v2-real-shots
60007156 docs(research): 3-site canvas deep-dive TapNow-liblib-quantv + comparison + v2 roadmap V1-V3  ★ V1 调研
4b4ab2b0 feat(video-canvas): TapNow 1:1 W1 batch - token-styled node cards, topbar tool group, hover scale + selected lift + handles, mini-toolbar, portal context menu
45a6d730 docs(specs): append TapNow live-capture §7 (text node toolbar decoded; items 1/2/4 pending)
7771e302 feat(vision): modlens vision bridge + annotate-and-context panel (hash #/vision) so users can send annotated screenshots as structured text
```

★ 标注 = 商业化 8 项 (P0 #2 #7 / P1 #1 #3 #5 #6 / P2 #4 #8) — 8 项全部已落、已 ledger。

> 备注:任务字面提到"v4 路线图"。本 worktree 内**主路线图** 为 `docs/superpowers/plans/2026-08-14-ai-video-platform-roadmap.md` (P0–P3 阶段);**未发现独立标号 v4 的子路线图文件**。如"v4"指代 P3 之后的延续路线,请用户在最终授权部署前澄清。

---

## 3. 待 commit 数量

- **git tracked (核心源码/规范/脚本)**: `git ls-files -m` = 0
- **git staged**: `git diff --cached --name-only` = 0
- **`.gitignore` 排除的运行态/构建产物**: 100+ (全部按 RTK §94-96 保留,本轮不暂存)
- **他人并发域** (video 线程 WIP / `.tmp-anno-verify` / 等): 全部在他人域,**严禁误暂存**

结论:本轮**无需 commit 任何东西**即可进入部署前置检查。

---

## 4. 测试绿度 (定向,禁全量)

| 测试文件 | 用例 | 通过 | 失败 | 备注 |
|---|---|---|---|---|
| `test/fast-daily-limit.test.mjs` | 9 | 7 | 2 | `2026-08-20` vs `2026-08-21` 日期边界 + `usage_events` 缺失 0 vs 7 (与商业化核心功能无关) |
| `test/nano-price-transition.test.mjs` | 9 | 9 | 0 | ✅ |
| `test/price-defense-plan.test.mjs` | 13 | 13 | 0 | ✅ |
| `test/xcard-monthpack.test.mjs` | 9 | 9 | 0 | ✅ |
| `test/xhs-legacy-protection.test.mjs` | 10 | 10 | 0 | ✅ |
| **合计** | **50** | **48** | **2** | **96%**;fail 均为 fast-daily-limit 内断言边界 |

> **严禁跑 `npm test` 全量套件** (RTK §115-116 并发死锁已知,任务 §5 显式禁止)。本次仅跑 5 个商业化文件单测,单文件 `node --test <file>`,无并发。

---

## 5. Build 通过

```
vite v6.4.3 building for production...
✓ 6746 modules transformed.
✓ built in 23.67s
```

- `dist/index.html` 1.99 kB
- 入口 bundle: `dist/assets/index-DLWtZLuP.js` 482.34 kB (gzip 153.84 kB)
- `verify-exports.mjs` ✅ 37/37 导入符号全部命中
- **CSS 警告 1 处**: `vite-CSS` 报错 raw string 注入结尾未闭合花括号 (已 commit 代码内嵌,非新增)

---

## 6. 灰度建议 (待用户最终授权后)

| 阶段 | 流量 | 观察时长 | 关键指标 |
|---|---|---|---|
| Pre-flight | 0% | T0 | PM2 health / 上游 key 健康 / 账本余额 / 备份完整 |
| Stage 1 | 10% | 4h | 注册转化 (与基线 ±5%) / 付费率 / 错误率 (5xx < 0.5%) / p95 延迟 |
| Stage 2 | 50% | 4h | 同上 + 8 项商业化功能 (Fast 日限 / Nano 2K 改价 / XHS 60→50 / 月卡 30d / H3-2K 灰度码 / 标准档 A/B / 价格防御 / XCard 礼物) 各自独立失败率 < 1% |
| Stage 3 | 100% | 持续 | 全量监控 + 24h 后报告 |

**不变量**:全程保留 `previous-release` symlink,Canary 任何阶段失败即回滚。

---

## 7. 风险登记 (R)

| ID | 风险 | 等级 | 缓解 |
|---|---|---|---|
| R-1 | **视频线程未完成** (RTK §110-112):共享树 12 个 video WIP + 4 个未跟踪 specs (`2026-08-25-video-benchmark-blueprint.md` / `2026-08-26-{director-ecosystem-audit,pricing-full-ecosystem}.md` / `director-briefing.md`) 在他人并发域,**部署会污染生产** | 🔴 **阻断** | **禁止部署**;等视频线程 (worktree `video-integration`,HEAD `aa81a32f`) 完成 VID-P1-04 并在 RTK.md 追加最终状态记录后,主线程按归属拆分提交 (主线程资产/项目/Canvas + shared 模块,排除运行态/构建产物/截图/视频线程文件) 再做部署 |
| R-2 | **fast-daily-limit 2 fail** (`2026-08-20/21` 日期边界 + `usage_events` 缺失 0 vs 7) | 🟡 低 | 复审商业化 8 项 #6 (`fbe685c2`) 的 `fastLimitStatus` 边界逻辑;若为 UTC 日期回退预期则改测试预期,否则需修实现 |
| R-3 | **9a94711 之后 558 commit, 120k+ 行** — 远大于历史单次发布粒度 | 🟡 中 | 灰度 10/50/100 每阶段 4h + 5xx 告警阈值 0.5%;若 4h 内触发即回滚到 `9a94711` |
| R-4 | **未跟踪 specs 4 份** (video 域 `2026-08-25-video-benchmark-blueprint.md` / `2026-08-26-{director-ecosystem-audit,pricing-full-ecosystem}.md` / `director-briefing.md`) | 🟡 中 | 这些是 video 线程调研产出,本轮**严禁**纳入本次部署;若属商业化相关,等 video 线程提交到正确分支再带 |
| R-5 | **CSS 警告 1 处** (raw string 注入结尾 `}` 缺失) | 🟢 低 | 不影响功能;后续 PR 收口 |
| R-6 | **线上版本与本地 558 commit gap** — 期间上游余额/网关/真实生成链路可能漂移 | 🟡 中 | 部署前必须跑 `scripts/deploy-production.ps1` 内部健康/账本/Canary 复核;600s 应用 Canary 不可跳过 |
| R-7 | **磁盘 91% 使用率** (RTK §67 沿用) | 🟡 中 | 部署后清理 `releases/` 旧备份;`generated-assets` 生命周期纳入运营任务 |
| R-8 | **本轮未跑内容计费/付费视频真实调用** (任务 §7 显式禁止) | 🟢 低 | 真实验收留给用户;但 P1 视频工作台保持默认关闭 (与 RTK §75 一致) |

---

## 8. 回滚方案

```bash
# 部署前快照
git tag pre-deploy-2026-08-26 cc91428d
git push origin pre-deploy-2026-08-26

# 完整回滚到已知线上版本
ssh server "cd /var/www/shubao && sudo ln -sfn releases/20260816-184541-816457a current && sudo systemctl reload nginx && pm2 reload shubao-production"

# 或 git revert (不推荐,生成 commit 链逆序复杂)
git revert --no-commit 9a94711..cc91428d
```

**首选方案**:`current` symlink 切回 `releases/20260816-184541-816457a` (RTK §73 已验证 release) + PM2 reload。0 数据迁移、0 数据库变更、秒级回滚。

---

## 9. 服务器检查项 (部署前)

- [ ] PM2 `shubao-production` 在线,PID 稳定 (基线 `2824932`, RTK §73)
- [ ] Nginx `current` 指向目标 release
- [ ] 磁盘使用 < 90% (当前 91%,RTK §67 沿用)
- [ ] 上游 key 健康度 (MiniMax H3 / Seedance / 视觉模型)
- [ ] 上游账本余额 (Fast / Nano 2K / H3-2K 各档配额可见)
- [ ] 备份完整: `/var/www/shubao/releases/20260816-184541-816457a` 可恢复
- [ ] 600s Canary 抓包脚本就绪 (RTK §65)
- [ ] 部署锁可用 (RTK §75 部署包装器锁通道历史丢失,需先复测)

---

## 10. 上线后 24h 监控列表

| 类别 | 指标 | 阈值 | 告警通道 |
|---|---|---|---|
| 业务 | 注册转化率 | vs 基线 ±5% | Admin 仪表盘 |
| 业务 | 付费率 (按 SKU 分) | vs 基线 ±10% | Admin 仪表盘 |
| 成本 | H3-2K 真实成本 | < ¥0.85/次 (¥0.76 锚,RTK §54 沿用) | Admin video cost board |
| 业务 | Fast 日限 (item #6) | N=2 默认,N=3 7d ramp | Admin fast tier board |
| 业务 | XHS 60→50 (item #8) | 60d 窗口过渡 | Admin XHS legacy 状态 |
| 业务 | 月卡 30d 发放 | byChannel 准确 | Admin xcard board |
| 业务 | H3-2K 灰度码 (item #7) | 邀请码命中率 | Admin invite board |
| 业务 | 价格防御 (item #4) | 4 周 < 2% 触发 | Admin defense plan |
| 工程 | 5xx 错误率 | < 0.5% | Sentry/PM2 logs |
| 工程 | p95 延迟 | < 1.5s (home) | Nginx 日志 |
| 孪生项 | ModLens 视觉桥调用成功率 | > 95% | logs + admin |
| 孪生项 | cross-model 视觉孪生命中率 | > 80% | logs |
| Admin | director-alerts | 0 致命 | `.superpowers/sdd/director-alerts.log` |
| Admin | director-status | `healthy=true` | `.superpowers/sdd/director-status.json` |
| 视频 | 视频域付费生成 | = 0 (RTK §75 P1 默认关闭) | Admin video board |
| 备份 | 备份保留 | releases < 5 | 磁盘监控 |
| 资产 | `generated-assets` 增长 | < 2GB/日 | 磁盘监控 |

---

## 11. 报告自陈 (审计边界)

- 本报告**未** 触发任何真实部署动作 (`scripts/deploy-production.ps1` / `server-deploy.sh` 严格未跑)。
- 本报告**未** 触碰受保护文件 (`server/db.mjs` / `server/mailService.mjs` / `server/billing/contentBilling.mjs` / `test/content-billing.test.mjs` / `server/extension_tasks/*`)。
- 本报告**未** 跑全量 `npm test` (避免共享树并发死锁);仅 5 文件定向。
- 本报告**未** 触发任何真实支付/生成/视频调用。
- 本报告**未** 误暂存 `.tmp/`、`dist-codex-build-*`、video 线程 WIP 文件。
- 真实部署需用户在新一轮 prompt 显式授权,届时由用户/主线程执行 `scripts/deploy-production.ps1` (唯一入口,RTK §40) 并在 600s Canary + 独立健康/审计完成后回报。

---

**🔴 阻断项 R-1 (视频线程未完成)** 必须先解决,否则即使本报告所有绿灯也不应执行 `scripts/deploy-production.ps1`。其余 R-2..R-8 均为可监控风险,等用户最终授权。
