# 薯包AI 深度健康体检报告（只读）

> 范围：React 18 + Vite 6 + Express 4 + better-sqlite3 全栈（线上 https://shuimg.cn/，origin 43.129.180.134）
> 日期：2026-09-14　方式：全程只读（除本报告外零改动）；本地静态分析 + 线上 SSH/pm2/nginx/SQLite 实测 + 头部 Chrome 采样
> 基线：git HEAD `6abd385c`（线上 current 即 6abd385c，`/var/www/shubao/current -> releases/20260914-004057-6abd385c`，index.html 哈希与本地 dist 一致）
> 全部证据含"命令/文件:行/实测数据"，每条均给出 影响 → 修法 → 风险等级（P0=立即 / P1=本周 / P2=排期）

---

## 0. 结论摘要（Top 10）

| # | 发现 | 一句话影响 | 等级 |
|---|------|-----------|------|
| 1 | **计费口径双实现不一致**：前端 `ec_nano_flash_2k / ec_nano_pro_2k`=1000 积分，服务端已调为 **1500**（见 3.4） | 用户看预估 1000、实扣 1500，积分对不上，客诉/信任风险 | **P0** |
| 2 | **`server/generated-assets` 已占 7.5GB 且无自动清理**（RETENTION_PURGE_ENABLED 未开，启动 sweep 为 dryRun） | 40G 磁盘已用 65%，按当前速度年内会顶满 → 服务不可写 | **P0** |
| 3 | **首屏传输 9.4MB / 46 请求**：Home 入口与案例卡直接引用源 PNG（含 6.3MB 合成图），Google Fonts CSS 222KB+197 个字体 URL | 弱网/移动端首屏数秒空白，直接影响"网站打不开"类投诉 | **P1** |
| 4 | **单文件 CSS 654KB（cssCodeSplit:false）+ 286 处同选择器同属性不同值**（.ec-canvas-composer-source 等 5 处定义 width 74→48→62→72→76px） | "改一处被别处覆盖"事故的根因，视觉回归高发 | **P1** |
| 5 | 入口 chunk 524KB（raw）**包含整个 React vendor，未做 manualChunks 拆分** | 每次业务发布 vendor 哈希全变（长缓存失效面大）+ 首屏解析大 | **P1** |
| 6 | **无 CSP、无 eslint（hooks 依赖零约束）**：EcCanvas/index.jsx 41 个 useEffect、38 个空依赖闭包 | XSS 纵深缺一层；React Hooks 隐晦 bug 无门禁 | **P1** |
| 7 | 内存/容量：2GB RAM **无 swap**、pm2 max_memory_restart=1G；kill_timeout=1_200_000ms（20 分钟） | 组合场景（sharp/canvas/onnx 并发）内存尖峰时宿主 OOM 风险；部署优雅停机可能卡 20 分钟 | **P1** |
| 8 | AdminConsole 整页（含"供应商与路由/视频模型通道"文案）打进公开 bundle（index-B9HRdYUi.js） | 运营侧内部措辞任何访客可下载翻看（接口仍有鉴权） | **P2** |
| 9 | 已核验死代码一批：Toast.jsx 整模块、getBillingTone、beginLoginAttempt、stepStatusLabel/Icon、deriveProgressMeta、projectAssetToEcommerceImages、navigationGroupById、EC_STYLES、VIDEO_TIER_METADATA 等（见 1.4） | 维护噪音 + 构建体积，未来误改误导 | **P2** |
| 10 | 历史重启 251 次的真相=**高频部署的优雅重启**（207 次干净启动+deploy-backups 每小时多次），早期两次启动崩溃（provider 凭据/TDZ）均已修复；磁盘冗余 works.json 死文件与 deploy-backups 2.8GB 需轮换 | 明确"重启次数≠有 bug"，但暴露部署过于频繁、缺回滚门禁 | **P2** |

**建议修复排序（一次惊动最小的执行序）**：先 P0-1 计费口径（纯前端一处值+加断言，5 分钟）→ P0-2 磁盘清理（先 dryRun 审计再开 purge + 清 deploy-backups）→ P1-1 首屏瘦身（Home 原图换 thumbs，立省 ~8MB）→ P1-2 CSS/构建（vendor 拆分 + cssCodeSplit）→ P1-3 安全头（CSP）与运维参数（swap/kill_timeout）→ P2 批次（死代码、文案、eslint、虚拟化）。逐条修法见各节。

---

## 1. 前端健康

### 1.1 构建产物 Top 10 chunk（dist/assets，当前 release 6abd385c）

实测命令：遍历 dist/assets 计算 raw 与 gzip 体积。

| 排名 | 文件 | raw | gzip | 归属/加载时机 |
|---|---|---|---|---|
| 1 | ort-wasm-simd-threaded-Cpm-ox6i.wasm | 13.16MB | 3.38MB | onnxruntime，仅画布"分割"场景由 canvasSegmentationWorker 按需取（Cache Storage，SHA256 校验）——不阻塞首屏，但首次点分割要拉 3.4MB |
| 2 | style-CIrakEGJ.css | 654KB | 113KB | **全站唯一 CSS**（cssCodeSplit:false，5199 条顶层规则）→ 见 1.3 |
| 3 | index-CM8Ogs9U.js | 524KB | 166KB | **入口 chunk，内含 React + App + api.js 等全部顶层依赖**（无 manualChunks） |
| 4 | index-Bs7l25BC.js | 513KB | 158KB | Home/XHS 主包（懒加载） |
| 5 | index-BTGtD1J5.js | 394KB | 122KB | VideoStudio 主包（懒加载） |
| 6 | index-CTAOtBH4.js | 249KB | 82KB | Home 电商相关（懒加载） |
| 7 | canvasNames-DaUM43Qv.js | 106KB | 31KB | 画布命名 |
| 8 | jszip.min-C1uNpVuJ.js | 95KB | 30KB | 打包下载 |
| 9 | canvasSegmentationWorker-DPmE4sge.js | 77KB | 26KB | 分割 worker（引用 #1 wasm） |
| 10 | EcommerceDesignPlanEditor-CxdVFtO4.js | 66KB | 21KB | 设计方案编辑器（懒加载） |

- 证据：dist/assets 共 32 个文件；首屏实际只取 index.html + 入口 JS + CSS + 预载图（见 5.1 实测 9.4MB）——注意 Top10 里 1/8/9 为按需加载，不阻塞首屏。
- 影响：入口 chunk 524KB 未拆 vendor → 发版换哈希、全量重下；CSS 全站单文件 → 每个页面都解析 5199 条规则。
- 修法：（1）`vite.config.js` build.rollupOptions.output.manualChunks：`react/react-dom` 拆 `vendor-react`，`lucide/phosphor/react-icons` 拆 `vendor-icons`（当前三套图标库同装，见 1.5）→ 长缓存 + 首屏解析下降；（2）`cssCodeSplit:false` 恢复默认按路由分 CSS；（3）保持 wasm 按需（勿改预载）。
- 风险：**P1**（构建架构，非紧急线上故障）。

### 1.2 超大页面组件（>2000 行清单）

实测：src 全量 259,537 行（js/jsx/mjs/css，262 源文件 + 46 个 css）。>2000 行共 2 个：

| 文件 | 行数 | 说明 |
|---|---|---|
| src/pages/EcCanvas/index.jsx | **7107** | 画布整页单体，41 个 useEffect、38 个空依赖闭包（见 3.3） |
| src/services/api.js | 2012 | fetch 包装全部堆这里（入口依赖，随入口 chunk 进首屏） |

接近线（1500~1800 行）：VideoCanvasWorkbench 1774 / XhsContentMode 1749 / VideoProjectWorkbench 1678 / EcMode 1672 / CanvasStudio 1657 / EcStudio 1400。

- 影响：7000+ 行单文件意味着状态机/上下文散落闭包中，改一处容易串；是 1.3/4.3 事故的温床。
- 修法（排序靠后）：按"行为模块"切分（node 模型/交互/渲染视图/右键菜单），每切一刀跑全量测试 `npm test` + build gate；不要为拆而拆。
- 风险：**P2**（工程债）。

### 1.3 CSS 重复/冲突规则（"改一处被别处覆盖"根因）

实测（dist 唯一 CSS 解析）：**5199 条顶层规则；202 个选择器被 ≥2 处定义；286 处"同一选择器+同一属性、值不同"**（源码顺序后者胜出 = 条件覆盖事故面）。sourcemap 关闭，归因用 src 侧同选择器扫描。

重灾区（4~5 次定义）：

| 选择器 | 次数 | 冲突示例（首值 → 尾值） |
|---|---|---|
| .ec-canvas-composer-source | 5 | width 74px→48px→62px→72px→76px；display grid→block；>b 的 background `#20242a9e`→`#eef2f6`（暗色遮罩→亮色底板翻转） |
| .ec-canvas-composer-source-add | 5 | width 74→48→62→72→76；display grid→flex；overflow hidden→visible |
| .ec-ability-selector-thumb | 4 | width min(46%,228px)→44px→54px |
| .ec-product-suite-source | 4 | width 168→92→132→94→116→88px；height 190px→auto |
| .ec-ability-selector-option | 4 | min-height 58→70→94px；padding 7px 34px 7px 7px→9px 38px 9px 10px |
| .ec-tryon-showcase-results .result-0 | 4 | width 190→155px；z-index 2→3 |
| .ec-tryon-preview-dialog>img | 3 | max-height 72vh→66vh |
| :root | 7 | 主题变量被覆盖 7 次 |

- 来源：46 个散落 css。`src/pages/EcCanvas/EcCanvas.css` 一处就出现同一选择器连续 5 段"验收覆盖块"（.ec-canvas-composer-source 74px→48→62→72→76px 逐段覆盖，靠源码顺序取胜）；`src/pages/Home/Home.css`、`CreationShowcase.css` 同样（.ec-ability-selector-thumb/.ec-ability-selector-option 多段媒体查询与验收覆盖）。
- 影响：任何一次"改一个尺寸"都可能被后续覆盖块盖掉；同一属性并存矛盾语义（grid vs block、绝对定位 vs static、遮罩 vs 底板）说明历史上有过形态切换但旧定义未删，当前生效值只取决于 import/源码顺序，非常脆弱。
- 修法：
  1. 一次性清理：用本报告同类解析脚本输出全量 286 冲突 → 逐条以"最终生效值"为准合并进唯一定义处，删旧块（保留媒体查询内真实意图）。
  2. 规范写入 AGENTS.md：同页 CSS 单源；禁止无注释覆盖块；CI 加 stylelint 或最小脚本（重复选择器数超阈值即失败）。
  3. 先清 3 个高危：.ec-canvas-composer-source>b（两套 bg 语义矛盾）、.ec-product-suite-source（height 190 vs auto）、.ec-tryon-preview-dialog>img（max-height 72vh vs 66vh）。
- 风险：**P1**（线上视觉回归高发区）。

### 1.4 未使用导出 / 死代码（引用计数 Top 20，含人工核验）

方法：全 src 提取 export → 统计其他文件 import/引用（词边界），再对前 30 名逐项 grep 核验。确认确死或仅自引：

| # | 标识符 | 位置 | 引用 |
|---|---|---|---|
| 1 | ToastProvider / useToast | src/components/ui/Toast.jsx:11/:65 | **0（整个 Toast 模块无人用）** |
| 2 | getBillingTone | src/components/billing/billingUiModel.js:45 | 仅本文件 :83 自用 |
| 3 | beginLoginAttempt | src/components/business/loginOtpState.js:11 | 仅本文件 :23 |
| 4 | stepStatusLabel / stepStatusIcon / deriveProgressMeta | src/components/chain/ChainProgress.jsx:15/:22/:32 | 仅本文件 |
| 5 | projectAssetToEcommerceImages | src/components/ProjectAssetPicker.jsx:131 | 0 |
| 6 | navigationGroupById | src/components/layout/creativeDomainNavigation.js:68 | 仅本文件 :74/:78 |
| 7 | EC_STYLES | src/constants/data.js:114 | 0 |
| 8 | VIDEO_TIER_METADATA | src/components/billing/pricingCatalogModel.js:149 | 仅本文件 :197 |
| 9 | default:useModalScrollLock | src/components/ui/useModalScrollLock.js:74 | 0（命名导出 useModalScrollLock / resetPageScrollLock 均在用） |
| 10 | RESPONSIVE_IMAGE_WIDTHS / rawImageUrl | src/components/responsiveImageModel.js:3/:6 | 仅本文件内部（导出但无人 import） |
| 11 | COMPLIANCE_LEGALS | src/components/business/AIComplianceWatermark.jsx:263 | 仅本文件 |
| 12 | isAllChecked / isAnyChecked | src/components/business/AIComplianceWatermark.jsx:263 | 仅本文件内部（为内部 helper，导出多余） |
| 13 | CANVAS_SHOT_PREFIXES | src/constants/canvasNames.js:5 | 疑似仅自引（清理时复核） |

- 影响：陈旧导出会被新人误当 API；Toast 模块若将来接入需重写；白占构建体积（小）。
- 修法：按上表删除/内部化；把 `npm run verify`（scripts/verify-exports.mjs，现只查 api.js 导出被引用）扩展为全 src"无引用导出"告警。
- 风险：**P2**。

### 1.5 依赖面杂音（顺带）

- package.json 同装三套图标库：`@phosphor-icons/react` + `lucide-react` + `react-icons`（App.jsx 混用 react-icons 的 Md 系与 lucide 系、画布用 phosphor）→ 收敛为 1~2 套（**P2**）。
- `onnxruntime-web` 1.27 + 13MB wasm 仅用于一个分割功能，低频可评估替换方案（**P2**）。

---

## 2. 运行时健康（线上实测 2026-09-14 01:00~01:10 UTC+8）

### 2.1 origin / pm2 / 内存

- 主机：up 61 天，load 0.00/0.01/0.03；**内存 1963MB 总量、free 102MB、buff/cache 1342MB、Swap 0**（若计入 buff/cache 可用 1248MB）。
- pm2：`shubao-production` fork 模式、node 22.23.1、uptime 13m、RSS 182.6MB、restarts **251**（用户此前看到 248，仍在增长）、max_memory_restart 1073741824（1G）。
- pm2 code metrics：Heap Usage 78.51%、Used Heap 26.22MB、Event Loop Latency 0.09ms（p95 0.92ms）、HTTP P95 27ms —— 当前进程健康，但**刚重启 13 分钟**（00:53 部署）。
- `cloudflare-tunnel` 在服务器 pm2 里 **errored（pid 0，重启 18 次）**——站点实际由 nginx（443，TLS 由 Let's Encrypt 终结）+ `location /api/ -> 127.0.0.1:3002` 提供；tunnel 进程废弃未移除（**P2**：删该 pm2 app）。

### 2.2 重启 251 次的解读（用户问"说明了什么"）

证据链：
- out log 有 **207 次** "薯包AI 后端服务运行中" 干净启动 + `[shutdown] 收到 SIGINT` 优雅停机标记 —— pm2 reload 部署会先 SIGINT。
- deploy-backups 目录 09-13 23:46 / 09-14 00:27 / 00:53 三次交付备份（间隔 40 分钟~1 小时级），与 out log 启动时间戳吻合 → **绝大多数重启 = 部署触发的优雅重启**（本项目每天多次发版，见 git log 单日十几条）。
- 历史上两次崩溃型重启（均已在当前代码修复、线上已生效）：
  - 09-12 10:59 起循环 `未处理Promise拒绝: exactly one provider auth credential is required`（providerAdapter.mjs:81；index.mjs:4034 createBackupImageAdapter 传空凭据；index.mjs:4074 有修复注释）。
  - retention 启动 sweep TDZ：error log 每 20–60 分钟一条 `[retention] startup sweep failed: Cannot access 'worksRetentionService' before initialization` 直至 09-14 00:34:58——35ec0f1e 已修（index.mjs:457-463 把服务提前创建），00:53:45 最新启动日志已干净（`[retention] startup sweep {"scanned":111,"expired":73,"skippedWhitelisted":38,"dryRun":true}`）。
- 结论：**当前没有被内存打崩的证据**（两日志无 OOM/restarting 记录）；重启多=部署频繁。真正的隐患见 2.4 环境参数。

### 2.3 SQLite 与日志表增长

- `server/works.db` 14.2MB + WAL 4.1MB + shm 32KB；表 **142 张**（渐进式建表，80+ 张 0 行：video_*、product_profile_*、payment_orders、redeem_*、provider_configs、billing_catalog 等）。
- 有数据表行数（本地只读打开线上拷回副本实测）：works=163、projects=75、auth_users=2、wallets=3、auth_sessions=34、auth_refresh_history=342、wallet_ledger=177、billing_holds=57、billing_hold_items=117、usage_events=96、video_upload_sessions=190（残留）、ecommerce_asset_records=66、retention_whitelist=1。
- **没有膨胀的日志表**；增长主要来自 deploy-backups 每发版拷一份 DB（14MB×N）累计 **2.8GB**。
- 留存策略当前为**只读观测**：`RETENTION_PURGE_ENABLED` 未开，启动 sweep 是 dryRun（见 2.2 日志），`generated-assets` 2039 文件 **7.5GB** 无清理（见 2.4）。
- 建议：价目表变更写 `admin_audit_log`（现仅 3 行）；80+ 空表做一次归并/删除（保留迁移脚本兼容）（**P2**）。

### 2.4 磁盘占用 Top 与容量风险

- `df -h`：/ 40G，已用 25G（**65%**），剩 14G。
- du Top：server/generated-assets **7.5G**（2039 文件，最早 07-24，最新 09-12）、deploy-backups **2.8G**、node_modules 482M、dist 411M、public 255M、薯包出品 224M、给cozi的文件夹 113M、server/works.db 14M。
- 影响：无 purge 的 generated-assets + 每次发版备份 = 磁盘线性增长，40G 顶满时上传/生成/写库全挂（用户侧就是"打不开/传不上"）。
- 修法（**P0**，执行序）：
  1. 先 `POST /api/admin/retention/preview` 复核 dryRun 清单（73 个过期作品、38 个白名单已在启动日志列全）；
  2. 确认后 `RETENTION_PURGE_ENABLED=true` 重载，让 assetStore.remove（index.mjs:470-475）真正删除过期资产；
  3. 清理 deploy-backups 保留最近 5 份 + server/works.json 与 4 个 bak 死文件（07-22 后不再更新，573KB×5）；
  4. 复用已有 retentionSweep（24h 定时，index.mjs:487-491）持续清理。
- 环境加固（**P1**）：加 2G swap 或升 4G 内存（2G 无 swap + 1G max_memory_restart，sharp/canvas/onnx 并发时宿主 OOM 风险）；`kill_timeout: 1_200_000`（20 分钟）调短至 60_000~120_000，避免优雅停机失败卡部署。

---

## 3. 正确性风险

### 3.1 TDZ（const/let 定义前被引用）

- 静态扫描（262 个源文件，模块顶层"调用早于声明"）：**src 0 命中**。
- 线上历史实证：retention TDZ 曾让**每次启动报错**（见 2.2），35ec0f1e 修复 + 线上 00:53:45 干净启动 → **已修复，需回归 guard**。
- 修法：把本报告扫描逻辑固化为 `scripts/check-tdz.mjs` 进 build 门禁，杜绝复发。
- 风险：已修，**P2** 收尾。

### 3.2 未捕获 async（浮空 Promise）

- 静态启发式：src 34 个疑似行经人工核验**全部为误报**（Map.delete / video.load / location.reload 等），未发现真"fetch 无 catch"；服务端有 401 自愈包装与统一 try/catch。
- 但线上曾出现 `‼️ 未处理Promise拒绝`（09-12 provider 崩溃期）说明生产异常路径仍会漏。
- 修法：入口加 `window.addEventListener('unhandledrejection'…)` 上报 + 服务端 `process.on('unhandledRejection')` 打结构化日志（各 1 行）。
- 风险：**P2**。

### 3.3 React Hook 依赖错误

- 证据：项目**无 eslint 配置**（eslint 未装）→ `react-hooks/exhaustive-deps` 从未生效；EcCanvas/index.jsx 41 个 useEffect、**38 个空依赖 `[]` 闭包**（实测 `},\s*\[\]\)` 匹配 38 处）；VideoCanvasWorkbench 10/3、XhsContentMode 9/3。
- 影响：闭包读旧 state/props 的隐晦 bug 只能靠撞；7107 行单文件放大风险。
- 修法：装 eslint + eslint-plugin-react-hooks，先只阻断 "exhaustive-deps" 错误级，其余 warn；大文件分批改。
- 风险：**P1**（正确性门禁）。

### 3.4 "同一功能两处实现、规则不一致"（重点）

**P0 实证 —— 计费/积分口径：**
- 前端 `src/services/imageModelCatalog.js:86-97` `generationUnits()`：`ec_nano_flash_2k: 1000`、`ec_nano_pro_2k: 1000`（1K/2K/4K 同价）。
- 服务端 `server/billing/catalog.mjs:62,65`：`ec_nano_flash_2k: { units: 1500 }`、`ec_nano_pro_2k: { units: 1500 }`（2026-08-26 已按注释"图片动价 1→1.5 积分"调价）。
- 前端画布用 `canvasPointsEstimate.js` 展示预估，服务端按 catalog 实扣 → **用户看 1000、实际扣 1500（+50%）**。其余 SKU 已核对一致（image2 1000、mdkj 1000、mj 3500、image25 1500/2000、gemini3 2000/3000）。
- 价目表实际存在 4 处：前端 generationUnits（client）、catalog.mjs（authoritative）、billingLabels.mjs（展示文案）、upstreamLedger.mjs（对账 SKU 集）。
- 修法（**P0**，5 分钟级）：
  1. 前端 `ec_nano_flash_2k / ec_nano_pro_2k` 改为 1500；
  2. verify 门禁加断言：generationUnits() 输出与 server/billing/catalog.mjs units 全量相等（双实现哨兵）；
  3. 中期改为服务端 `/api/catalog` 下发（前端不硬编码），彻底消除双源。

**模型清单双实现：** 前端 `services/imageModelCatalog.js`（8 档）+`services/modelLogos.js`（品牌映射）双文件，服务端 `server/billing/catalog.mjs` 同 8 档（units/providerCostCny）——ID 集需两端手动同步，已产生上述 nano 漂移；建议 ID/单位单一来源 + 一致性测试。

**技能清单多处硬编码：** `src/pages/EcCanvas/canvasStudioModel.js:15` CANVAS_SKILLS、`src/pages/Home/visualCreationModel.js:14` VISUAL_CREATION_SKILLS、`src/pages/Home/ec/StylePanel.jsx:19` FALLBACK_STYLE_SKILLS，另有 server 侧 `server/skills/`、`server/visualCreationSkills.mjs`、`server/videoSkillTemplates.mjs` → 同一"技能"概念 3 处前端 + 3 处后端；建议收敛为单一 catalog（服务端下发或 shared/ 单源）+ 一致性测试。风险：**P1**。

---

## 4. 性能与体验风险

### 4.1 首屏请求数与体积（headless Edge 实测 https://shuimg.cn/）

- **46 个资源、合计 9,454KB（≈9.4MB）**首屏传输；TTFB 285ms、domReady 819ms（审计机跨境直连，仅代表量级）。
- 大头账单（按 resource 列表）：
  - `/images/home/ecommerce-showcase/earbuds-suite-composite-v3.png`（**6.3MB 源 PNG**；src/pages/Home/productionCaseCatalog.js:56 直引）；
  - `/images/home/entry-video.png / entry-xhs.png / entry-visual.png`（源 PNG 直引；src/pages/Home/index.jsx:68/73/78，带 `?v=20260812`）；
  - `/images/home/tryon-showcase/editorial-multi-angle-fan-v7.webp`（源图直引；productionCaseCatalog.js:112）；
  - Google Fonts css2（222KB，197 个字体 URL）；cloudflare beacon+rum；`/api/gallery-image?...&variant=w640`（这块是正确的缩略用法）。
- **Google Fonts（main.jsx 运行时注入）**：`fonts.googleapis.com/css2?family=ZCOOL+KuaiLe&family=Fredoka:wght@400..700&family=Noto+Sans+SC:wght@400..700` → 222KB CSS + **197 个 gstatic 字体 URL**（CJK 变量字体按 unicode-range 分片，中文页几乎全触发）→ 移动端首屏额外 1~2MB + 第三方会话。
- 修法（**P1**）：
  1. 三个 entry 卡 + 案例卡全部改用 `.thumbs` 720px webp（dist 已有同路径缩略，index.html 预载 `entry-ecommerce.webp` 的做法即正确示范）；放大查看才用源图 → 首屏立省 ~8MB。
  2. Google Fonts 自托管 + woff2 子集化，或去掉 Fredoka/ZCOOL 之一（已 display=swap，但体积仍在）。
  3. 静态资源已 1y immutable（nginx），瓶颈只在这些"源图直引"与字体。
- 风险：**P1**。

### 4.2 ResponsiveImage 尺寸参数

- 组件自查：`src/components/ResponsiveImage.jsx` 内置 avif/webp **srcset（320/640/960/1600）** + 按 variant 的 sizes 缺省（display=`min(100vw,1600px)`、canvas=960px、其余 320px）+ 失败重试（750ms/2s/5s）+ 骨架屏 —— 设计良好；responsiveImageModel.js:35 候选链（proxy → full → 源图）回退严谨。
- 38 个调用点实测：37/38 带 ratio；19/38 显式 sizes（其余走组件缺省，thumb=320px 合理）；srcset 由组件内部生成（调用点无 srcset 属正常）。
- 结论：**组件层健康**；问题只在 4.1 的"绕过组件直引源图"处。
- 风险：**P2**（顺手让入口卡走 ResponsiveImage）。

### 4.3 长列表虚拟化

- 全 src 无 react-window / react-virtualized / useVirtual 引用（grep=0）。
- 资产库弹窗是手写"首批 24 条 + 滚动追加"（commit 3fe78d17 无限滚动）；项目库/作品列表为服务端分页 + 前端 map。
- 影响：画布节点数、资产网格超 200 条时全量 DOM；当前规模（works=163、assets=171）尚可，不必现在重写。
- 修法：资产网格与画布节点区预留窗口化抽象（IntersectionObserver 分页即可），测 `npm test` 回归。风险：**P2**。

### 4.4 交互延迟采样（Playwright trace；本机 headless Edge）

- 工具链备注：项目内无 playwright；本次用临时 playwright-core + 本机 Edge 对线上首页采样（trace 存审计机，方法可复现）。
- 结果：首页 domcontentloaded+6s 内完成；**无 >50ms 长任务**（主线程不卡）；"开始创作"CTA 点击→响应 ≈86ms（1.9s 中含固定 1.8s 等待）；无 INP 级卡顿。
- 局限：未登录，画布交互（7k 行组件的理论高延迟点）未采样；建议登录态补"拖动节点 / 快速切换 tab / 资产库打开"trace。
- 结论：**当前首页交互 OK，瓶颈在网络负载（4.1）不在 JS 主线程**；画布专项复测列入 **P2**。

---

## 5. 安全与合规

### 5.1 密钥 / 内网地址是否进 bundle

- dist/assets 全量扫 `ak-|sk-|Bearer \S{20}|SECRET|API_KEY[:=]|password[:=]`：**0 个真实命中**（4 个命中均为 React 内部 error-decoder 串）。
- 供应商域名 `65535.space / task-api / api2` 在 dist **0 命中**（只在 server env 与启动横幅）；`IP233` 仅出现在 src 注释（imageModelCatalog.js:17 "同一上游 IP233"），构建剥离注释不进产物。
- `server/.env` 未入 git（git ls-files 仅 `.env.example`）。
- 结论：**无密钥泄露**（**P2** 保持）。顺手：`server/.env.bak-911` 等副本别提交；工作树大量未跟踪 tmp 文件加 .gitignore（见 6）。

### 5.2 CORS / CSP / 安全头

- CORS：index.mjs:615-621 白名单 allowlist；evil origin 实测 401 且无 ACAO → **正确**。
- `/api/proxy-image`（index.mjs:2949-2958）对图片响应 `Access-Control-Allow-Origin: *`——开放图片代理 + 限流 + **SSRF 防护完善**（imageDelivery.mjs:86-98 isSafeRemoteImageUrl 拒绝私有 IP/内网/localhost/0x/纯数字编码；imageRouteRateLimiter 限流）。风险可接受，但存在"借 shuimg.cn 拉任意公网图"的带宽面（**P2**：加每日配额）。
- **无 Content-Security-Policy**（nginx 各 location 均无；live curl 确认）。修法：落地宽松起点 `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; script-src 'self' https://static.cloudflareinsights.com 'unsafe-inline'` 后迭代收紧（项目含内联 style/事件，需逐项放行）。风险：**P1**。
- 已有：HSTS(1y)、X-Frame-Options SAMEORIGIN、X-Content-Type-Options、Referrer-Policy、Permissions-Policy；/api 实测响应头含 nosniff。

### 5.3 用户可见文案是否泄露供应商信息

- dist 全量检索 `上游/供应商/备用/任务号/IP233/change2pro`：`备用/任务号/IP233/change2pro` **0 命中**；`上游/供应商` 9 处，逐一核验均为产品/法律文案：
  - 良性/合规：FAQ"上游或服务异常导致失败时冻结额度全额释放"（index-CAvCF44O）、定价页"价格随上游成本变动时同步更新"（入口 chunk）、"未识别的文件不会被发送给上游"（画布校验文案）、隐私条款"传递给模型服务供应商进行推理计算…不用于其自身模型训练之外的用途"（index-BQML-Kjv）。
  - **建议改（内部术语外露，P2）**：
    - VideoStudio 用户可见大量"供应商"：`VideoProjectWorkbench.jsx:1293/1424/1435/1440/1442/1771`（"不会调用供应商""供应商提交门禁""供应商提交阻断原因""尚未调用供应商"）、`VideoCanvasWorkbench.jsx:1259` → 改"模型服务/调度器"话术。
    - TTS 功能 "(5 家供应商可选)"（src 对应 dist index-Bs7l25BC）→ "多种音色可选"，不暴露供应商数量。
    - AdminConsole 整页（"供应商与路由/视频模型通道"，index-B9HRdYUi.js 51KB）打进公开 bundle：接口已有 requireAdmin 鉴权，但运营措辞任何访客可下载；建议 admin 拆独立部署或维持现状（**P2**）。
  - 结论：**未发现具体供应商名/密钥/内网地址泄露**；清理的是术语与 bundle 暴露面。

---
---

## 6. 其他工程卫生（顺带清单）

- 工作树根目录大量历史调试文件（`.tmp-*`、eval*.js、png/jpg、zip/tar.gz、交接文档），git status 大量未跟踪 → 加 .gitignore + 定时清理（**P2**）。
- `public/` 内有 6.9MB 级源 PNG 多张（visual-recipes/cases、ecommerce-showcase）随部署包分发给 nginx（dist/images 411MB）→ 大图进仓库拖慢发布与磁盘（**P2**：压缩/外置）。
- index.html 缓存治理已上线（no-cache, must-revalidate）与 `vite:preloadError` 自动重载 + RootErrorBoundary（main.jsx）——白屏兜底完备（9-13 事故复盘产物），勿删。
- deploy 侧已有独立公共审计 `npm run audit:production` 27/27 + 600s canary + `/health` 探针 —— 好基建；建议把"计费口径一致性检查"加进该审计（1 条）。

---

## 7. 修复排序总表

| 序 | 项 | 等级 | 工作量 | 验证方式 |
|----|----|----|----|----|
| 1 | 计费口径 nano 2K 1000→1500 + 一致性断言入 verify | P0 | 0.5h | `npm run verify` + 线上 nano 2K 对照扣费 |
| 2 | generated-assets 清理：复核 dryRun → 开 purge → 清 deploy-backups/works.json | P0 | 1h（含审计） | `du -sh` 趋势、`/api/admin/retention/preview` |
| 3 | 首屏瘦身：Home 入口/案例卡改 .thumbs webp + 字体自托管 | P1 | 0.5~1d | Playwright 复测传输 ≤3MB |
| 4 | CSS 286 冲突清理 + 单源规范 + 门禁 | P1 | 1~2d | 样式回归批量截图 + 冲突数归 0 |
| 5 | vendor 拆分 manualChunks + cssCodeSplit | P1 | 0.5d | 构建 hash 稳定 + 首屏 parse 时间 |
| 6 | CSP 落地 + admin 包独立/鉴权前置 + 文案去术语 | P1/P2 | 1d | curl -I 头检查；bundle 检索归 0 |
| 7 | 运维参数：swap/内存、kill_timeout 缩到 60s、删 cloudflare-tunnel 僵尸 | P1 | 0.5h | pm2 env + free -m |
| 8 | eslint+hooks 接入、TDZ 门禁、unhandledrejection 兜底 | P2 | 1d | lint 0 error + 注入测试 |
| 9 | 死代码清理（1.4 清单）、技能清单收敛、空表归并 | P2 | 1d | verify 通过 + 全量 test |
| 10 | 虚拟化/画布交互专项复测、依赖收敛（图标库）、public 大图压缩 | P2 | 2d | trace + 体积统计 |

## 8. 复现命令速查（附录）

```bash
# 线上
ssh -i C:\Users\SHEJI\.ssh\shubao_deploy_ed25519 ubuntu@43.129.180.134
pm2 describe shubao-production; pm2 list; df -h
sudo du -sh /home/ubuntu/shubao/server/* | sort -rh | head
tail -c 6000 /home/ubuntu/.pm2/logs/shubao-production-error.log
grep "后端服务运行中" /home/ubuntu/.pm2/logs/shubao-production-out.log | tail
# 本地（只读复现，脚本见审计会话 tmp）
node cssdup2.cjs dist/assets/style-*.css     # 286 冲突
node scan1.cjs src                           # TDZ / 浮空 Promise
node scan2.cjs src                           # 未用导出
npm run audit:production                     # 27/27 线上审计
# 浏览器采样
cd %TEMP%/pwq && node sample2.mjs            # 首屏 9.4MB + trace.zip
```

> 局限说明：浏览器指标来自审计机（跨境直连 origin）非 CDN 视角；登录态画布交互未采样；dist 分析基于当前 release 产物；本轮所有建议均未执行（只读轮）。
