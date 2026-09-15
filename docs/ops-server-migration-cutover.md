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

### 第 1 步（用户）：把 `shuimg.cn` 的 A 记录指向新机
在 Cloudflare 面板把 **代理状态保持开启（橙云）**，把源站 IP 从
`43.129.180.134` 改为 **`114.132.157.250`**。
（`www.shuimg.cn` 若也配了记录，一并改。）

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
