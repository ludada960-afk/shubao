# 生产服务器迁移 —— 现状与切流手册（2026-09-15）

> 触发：用户「旧机马上要过期了，你全部引导新机器吧」。
> 本文件记录**实测结论**与**剩余步骤**。凡未实测的一律标注为「未验证」。

---

## 一、结论先说：迁移**尚未对用户生效**

| | 旧机 | 新机 |
|---|---|---|
| 公网 IP | `43.129.180.134` | `114.132.157.250` |
| 内网 IP | `10.5.0.14` | `172.16.0.17` |
| hostname | `VM-0-14-ubuntu` | `VM-0-17-ubuntu` |
| 磁盘 | 40G / 用 65% | 99G / 用 24% |
| release | `20260914-143446-c1594d5f` | `20260915-125818-3e71ad83`（本次部署） |
| **公网流量** | **✅ 100% 在这里** | **❌ 0**（nginx 日志仅 7 行，全是 127.0.0.1） |
| 插件 zip | **36810B（旧坏包）** | **60403B（已修）** |

**判定依据（硬证据，不是推断）**：
- 旧机 `/var/log/nginx/access.log` 里是 **Cloudflare 边缘 IP** 的真实流量：
  `104.22.17.84` / `172.69.134.58` / `162.158.167.212` 等，含真实用户
  `GET /api/ecommerce/jobs`，也含我自己的探测请求。
- 新机 `/var/log/nginx/access.log`：**共 7 行，全部来自 127.0.0.1**（我自己的 curl）。
- 公网 `/health` 返回 `pid=84674`（= 旧机）；新机是 `pid=52907`。
- 公网取新 release 的 `assets/index-FayBLSHy.js` → **404**；取旧的 `index-BnNidX4X.js` → 200。

> ⚠️ **一处必须更正的历史误判**：本会话早期我曾据「新机 `current/index.html` 与公网取回的入口 bundle
> 同名」断定「公网服务的就是新机」。**那是错的** —— 当时两台机器跑的是**同一个旧 release**
> （`c1594d5f`），bundle 同名**无法区分**是哪台在服务。
> 正确判据是 **pid / nginx 访问日志来源 / 新资源可得性**，三者都指向旧机。

---

## 二、回源机制（实测）

- `shuimg.cn` 走 **Cloudflare 代理**（`server: cloudflare`、有 `CF-RAY`）。
- 但**不是**走命名隧道：两台机器上 `cloudflared` **都没有运行**
  （systemd 无 `cloudflared.service`；PM2 里那条 `cloudflare-tunnel` 是 **errored**，
  因为它的 `script` 写的是 **Windows 路径** `C:\Program Files (x86)\cloudflared\cloudflared.exe`）。
- 旧机 nginx 收到的是 **CF 边缘 IP 直连** → 说明 CF 用的是 **代理型 A 记录直连源站**。
- 新机 `/etc/cloudflared/config.yml` 配的是隧道 `a05fc5c5-d174-4909-b4e7-206dec3300a5`
  → `shuimg.cn` → `http://localhost:3001`，**端口是错的**（应用监听 **3002**）。
  已改为 **3002** 并备份原文件（`config.yml.bak-*`）；该隧道当前未启用，改动无即时影响。

---

## 三、已完成（本次，均有实测）

1. **部署已成功落到新机**：`Deployed 3e71ad83 to https://shuimg.cn/`
   （本地全量测试 3771/0 红 → 构建 → 上传 → PM2 重启 → `Public production health is ready` →
   600s Canary；判定为 frontend-only，**跳过付费电商验证**）。
2. **插件 zip 修复已上线到新机**：`/var/www/shubao/current/extensions/shuabao-extractor.zip` = **60403B**
   （旧机仍是 36810B）。
3. **数据体检 + DB 同步**：dry-run rsync 实测 —— `generated-assets`(7.92GB)、`uploads`、
   `extension_downloads`、`backups`、`video-assets` **均 0 个文件需传输（已同步）**；
   只有 `cache_img` 差 222 文件 / 34.2MB（可再生缓存）；**DB 滞后**（新机 10:24 vs 旧机 12:46）。
   已用 `scripts/backup-runtime-db.cjs`（SQLite **在线备份 API**）从旧机取一致性快照并换入新机。
   **换库后计数逐项一致**：tables=98 / auth_users=2 / billing_holds=57 / canvas_sessions=84（与旧机相同）。
   旧库已备份至 `/home/ubuntu/works.db.pre-sync-20260915-131924`。
4. **部署入口已切**：`scripts/deploy-production.ps1` / `sync-production-visual-assets.ps1` 默认
   `HostName` → `114.132.157.250`（提交 `81be7972`）。
5. **清理**：删掉新旧机上那条不可能工作的 `cloudflare-tunnel` PM2 进程（Windows 路径，重启 16/18 次）；
   新机 `pm2 save` 已固化。

---

## 四、剩余步骤（**需要用户操作**：Cloudflare DNS）

> 我有服务器 SSH（两台都能登），但**没有 Cloudflare 账号权限**，改不了 A 记录。

> ⚠️ **2026-09-15 更正**：用户按「旧机 IP 换新机 IP」的思路改了解析，但**改在 DNSPod 控制台**。
> 而 `shuimg.cn` 的权威 NS 是 `karl.ns.cloudflare.com` / `hope.ns.cloudflare.com` ——
> **DNS 托管在 Cloudflare，DNSPod 不是权威**（直接问 `ns2.dnspod.net` 对 shuimg.cn 回
> 「不知道这样的主机」）。所以那次改动**对公网零影响**：裸域仍由 Cloudflare 指向旧机
> （`/health` 仍是旧机 pid 84674），`www.shuimg.cn` 直接 **NXDOMAIN**。
> **要改的是 Cloudflare，不是 DNSPod。**

### 第 0 步（用户，**当前硬阻塞**）：给新机开放 80 / 443

**现在把 DNS 切过去 = 全站 522。** 实测（两个**独立外部观察点**：本机 + 旧机）：

| 目标 | 22 | 80 | 443 | 3002 |
|---|---|---|---|---|
| 新机 `114.132.157.250` | ✅ 通 | ❌ **不通** | ❌ **不通** | ❌ 不通 |
| 旧机 `43.129.180.134`（对照） | ✅ 通 | ✅ 通 | ✅ 通 | ❌ 不通 |

主机侧已排查干净：`ufw status` 明确 `ALLOW IN 80/tcp`、`443/tcp (Anywhere)`；
nginx 监听 `0.0.0.0:80` 与 `0.0.0.0:443`；本机 `curl -H "Host: shuimg.cn" https://127.0.0.1/` 返回 200；
`YJ-FIREWALL-INPUT` 链只 REJECT 了一个无关 IP。
→ 丢包发生在**到达主机之前**，即**腾讯云安全组没放行 80/443**。

**操作**：腾讯云控制台 → 该实例 → 安全组 → 入站规则，添加 **TCP 80** 与 **TCP 443**，来源 `0.0.0.0/0`。

> 若安全组里本来就有 80/443 却仍不通，则另一种可能是**大陆机房的 ICP 备案策略**
> （新机是大陆 IP，旧机在香港）—— 那种情况要先备案，改安全组解决不了。

### 第 1 步（用户）：把 `shuimg.cn` 的 A 记录指向新机（**在 Cloudflare 里改**）
Cloudflare 面板 → 选中 `shuimg.cn` → DNS → 记录：源站 IP 从
`43.129.180.134` 改为 **`114.132.157.250`**，**代理状态保持开启（橙云）**。

> ⚠️ **暂时不要加 `www.shuimg.cn`**：新机回源证书的 SAN **只有 `DNS:shuimg.cn`**
> （`openssl s_client` 实测），不含 www。加上 www 后 Cloudflare 在 Full (strict) 下会直接 **526**。
> 新机 nginx 的 `server_name` 已经写了 `shuimg.cn www.shuimg.cn`，**缺的只是证书** ——
> 要支持 www 得先重签含 www 的证书，那属**新增能力**，不在换机范围内。

**替代方案**：把 Cloudflare **API Token**（Zone.DNS 编辑权限）交给我，我可以自己改并验证。

### 第 2 步（我）：切流前的最后一次增量同步
DNS 改动前需要再做一次 DB 快照 + 换库（覆盖第 3 步那次），因为旧机从 13:19 之后仍在写入。
命令与我本次用的完全相同（见第五节脚本）。

### 第 3 步（我）：切流后验证
- 公网 `https://shuimg.cn/health` 的 `pid` **等于新机 pid**；
- 公网能取到新 release 的 `assets/index-*.js`（不再是 404）；
- 公网 `/extensions/shubao-extractor.zip` 为 **60403B**；
- 新机 nginx access log 出现 **Cloudflare 边缘 IP** 的真实流量；
- 旧机 nginx access log **不再有**新流量；
- 登录 / 作品列表 / 计费目录 / 一次真实电商任务。

### 切流前**就绪清单**（第 2 轮实测，全部通过）

> 旧机即将过期、**没有回滚点**，所以切流前把「新机自己能不能活下来」逐条验过：

| 检查项 | 实测 |
|---|---|
| nginx 开机自启 | `enabled` ✅ + `active` ✅ |
| PM2 开机自启 | `pm2-ubuntu.service` **enabled** ✅（unit 文件在位）|
| `pm2 save` 快照内容 | **进程数 = 1**，只有 `shubao-production` → `server/index.mjs` ✅ |
| `cloudflare-tunnel` 是否还在快照里 | **0 次匹配** ✅（重启不会把它复活）|
| `/health` | 200 `ready:true` ✅ |
| `https://127.0.0.1/`（Host: shuimg.cn）| 200 ✅ |
| 证书 | `CN=shuimg.cn`，有效至 **2026-10-15** ✅ |
| 运行时数据 | `works.db` 14,286,848B（与旧机一致性快照同尺寸）、`generated-assets` 7.92GB ✅ |
| DB 计数 | tables=98 / auth_users=2 / billing_holds=57 / canvas_sessions=84 —— **与旧机逐项一致** ✅ |
| 明文密钥 | `LLM_API_KEY` 已移除（`null`）✅；4 个必需网关 key 齐全 ✅ |
| 磁盘 | 99G / 用 24% ✅ |
| **公网 80 / 443 可达** | ❌ **两个外部观察点实测均不通** —— 见第 0 步 |

> ⚠️ **清单更正（2026-09-15）**：上面这一版「全部通过」是**假的通过** —— 它只验了
> 「新机在自己内部能不能活」（本机 curl、`nginx -t`、开机自启、DB 计数），
> **唯独没验「外网能不能连上它」**，而恰恰是这一条不通。
> 教训与 RTK §3.1-10 同一条：**验判据，不验代理指标** —— 本机返回 200 **不等于**公网可达。

跨公网同步通道（**切流后必须清理**）：新机 → 旧机放了一把临时密钥
（`~/.ssh/migrate-tmp`，旧机 `authorized_keys` 里注释为 `temp-migration-key-new-server`）。

### 第 4 步（我，可选）：停掉旧机的 nginx / PM2
确认新机稳定运行一段时间后再停旧机，保留一段可回滚窗口（旧机是当前唯一回滚点）。

---

## 五、可复用脚本与配方

### 5.1 「在工作区很脏时部署」的配方（本次踩出来的）

本工作区长期有 **1000+ 个未跟踪/已修改文件**（用户运行态 + 并行线在途），
而 `deploy-production.ps1` 会跑 `git diff --check` 校验**整个工作区** →
**永远不可能通过**（实测报了 19 个文件 / 599 处 trailing whitespace，**没有一个是本次发布的**）。

**不要**为此放宽门禁。正确做法是**从 HEAD 的干净工作树部署**：

```powershell
$clean = 'F:/da/_deploy-clean'
git -C <worktree> worktree add --detach $clean HEAD
New-Item -ItemType Junction -Path "$clean/node_modules" -Target "<worktree>/node_modules"
pwsh -File scripts/deploy-production.ps1 -RepoPath $clean
git -C <worktree> worktree remove --force $clean
```

好处：① `git diff --check` 干净；② **不会把别人未提交的脏文件打进发布包**。

### 5.2 两台机器之间的同步通道

新机 → 旧机放了一把**临时**密钥（仅用于迁移，切流完成后应删除）：

```bash
# 新机上
rsync -a -e "ssh -i ~/.ssh/migrate-tmp -o StrictHostKeyChecking=accept-new" \
  ubuntu@43.129.180.134:/home/ubuntu/shubao/server/<dir>/ /home/ubuntu/shubao/server/<dir>/
```

**收尾清理**（切流完成后务必执行）：
- 旧机 `~/.ssh/authorized_keys` 里删除 `temp-migration-key-new-server` 那一行；
- 新机删除 `~/.ssh/migrate-tmp` / `migrate-tmp.pub`；
- 新机删除 `/home/ubuntu/.delta-check.sh`；
- 旧机删除 `/home/ubuntu/works-snapshot.db`。

---

### 5.3 换机收尾的最终数据库同步（脚本）

`scripts/cutover-final-db-sync.sh`（在**新机**上跑）。

**为什么必须有这一步**：运行时库是 SQLite **WAL 模式** —— 实测切换前
旧机 `works.db-wal` 有 **4,140,632 B** 未落盘的页、新机 `works.db-wal` 同时也在写。
所以直接 `cp works.db` 会**漏掉这些写入**；脚本走 better-sqlite3 的 online backup API
（`scripts/backup-runtime-db.cjs`）取一致性快照，并**先冻结旧机应用**再取。

**顺序**（脚本会自动做 0–6 步，并在 sha256 不一致时中止）：

1. **前置自检**：公网 `/health` 的 pid 必须已等于新机 pid；不等则拒绝执行（除非 `--force`）。
   —— 防止在 DNS 还没生效时把库换掉。
2. 旧机 `pm2 stop shubao-production`（**冻结数据源**）。
3. 旧机生成快照。
4. 拉取到新机并**两端 sha256 比对**。
5. 停新机应用 → 备份现有库为 `works.db.pre-final-sync-<stamp>` → 清 `-wal`/`-shm` → 装入快照 → 跑 `pragma quick_check`。
6. 起新机应用 → 复验 `/health` → 打印收尾清理清单。

> 第 2 步之后旧机应用处于 stopped：若仍有边缘节点缓存着旧 IP，那些用户会短暂报错。
> 这是**为避免丢数据**而接受的代价，窗口应尽量短。

---

## 六、未验证 / 待观察

- **切换后 Cloudflare 缓存**：实测公网当前稳定返回旧 HTML（3/3 次，带 cache-busting 参数也一样）。
  切流后需确认 CF 是否缓存了 `index.html`；nginx 已给 `index.html` 配 `no-cache, must-revalidate`，
  必要时在 CF 面板 **Purge Everything**。
- **新机的 `cache_img` 比旧机少 34.2MB**（222 个文件）：属可再生缓存，未同步；
  如切换后发现有图片变慢，再补同步。
- **新机上仍有旧 release 的 assets 残留**（`assets/style-*.css` 有 40+ 个历史版本），
  属 releases 目录累积，未清理。
- 旧机与新机**不在同一 VPC**（10.5.0.14 vs 172.16.0.17），跨公网同步；
  本次数据量小（DB 14MB）无影响。

---

## 七、⚠️ 未备案域名的拦截**按来源 IP 类型**分 —— 别用机房观察点下结论（2026-09-15）

### 事实（四个观察点实测）

| 观察点 | 443 + SNI=`shuimg.cn` | 443 + 无 SNI | 80 + Host |
|---|---|---|---|
| **大陆新机本体（广州）** | **200** ✅ | 200 | 302 |
| 我本机（云/隧道出口） | **握手被重置**（`code=000`，0.03–0.05s）❌ | 200 | — |
| 香港旧机（腾讯云机房） | **握手被重置**（`code=000`，0.003s）❌ | 200 | — |
| **用户自测（住宅宽带，大陆 + 海外）** | **正常打开** ✅ | — | — |

→ 拦截**不是全域的**：**住宅来源正常，机房/云来源被重置**；当时域名确实**未备案**。

### 我在本轮犯的两个错（写在这里，免得下一个人重犯）

1. **「站点对用户不可用」—— 口径错了。** 我的两个观察点都是机房 IP，我把「我这里不通」
   当成了「全体用户不通」，还据此让你改回橙云。**你自己一测就能打开。**
   → **判据：观测点本身是变量，机房视角 ≠ 用户视角。**
2. **「快了 40 倍」—— 度量错了。** 我用 `curl -w "%{time_total}"` 只读了**耗时**、
   **没读状态码**；那个 0.04s 是**连接被重置的失败耗时**，不是成功响应。
   → **判据：任何延迟/可用性断言必须同时打印 `%{http_code}`** ——
   只看时间会把「快速失败」误读成「很快」（本次两个错都出自这一条）。

### 由此定下的操作规则

- **不能从机房观察点判定站点可用性。** 验证公网路径一律在**大陆节点本机**上做：
  ```bash
  curl -sk --resolve shuimg.cn:443:<源站IP> https://shuimg.cn/health
  ```
  那才是「大陆用户视角」。（本手册第 0 步当时用**不带 SNI** 的测试得出「无备案拦截」，
  方法本身不成立 —— 浏览器一定会发 SNI。）
- **灰云（仅 DNS）方案的残余风险**（备案完成前）：搜索引擎爬虫（Googlebot / 百度蜘蛛）
  与部分企业网 / VPN 出口也是机房 IP → 可能抓不到站点，**影响收录**。备案完成后消失。

### 现状（2026-09-15 晚）

- 公网解析 → `114.132.157.250`（**仅 DNS / 灰云**），大陆用户可正常访问；
- 大陆节点实测 `/health`、`/`、`/pricing`、插件 zip **全部 200**（13–19ms）；
- 证书 = 源站 Let's Encrypt（`CN=shuimg.cn`，有效至 2026-10-15，`certbot.timer` 在跑）；
- `server_tokens off` 已生效（响应头 `server: nginx`，不再暴露版本号）；
- 备案完成后：确认收录恢复；如需重新开启代理，把 Cloudflare 的云点回橙色即可。
