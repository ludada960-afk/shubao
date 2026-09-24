# 76 · 交接（2026-09-24 晚）：项目进程 + 下一会话怎么接

> 这份是**给下一个会话看的**。读完这份 + `RTK.md` 最后两批（AX / AY）+ `docs/design/74`、`75`
> 就够接手，不必翻历史对话。

---

## 一、当前线上状态（写这份时的事实）

| 项 | 值 |
|---|---|
| 线上版本 | `https://shuimg.cn/` 部署自 **`e727c7cf`**（其后只有 RTK 的文档提交） |
| 分支 | `codex/ecommerce-stability`（**绝对不许新建分支**） |
| worktree | `F:/da/shubao/.worktrees/codex-ecommerce-stability` |
| 测试 | 全量 `npm run test` **4045 pass / 0 fail**（4055 条）；`npm run precommit` 全绿（构建 + 38 门禁 + e2e） |
| 生产 | `ubuntu@114.132.157.250`，pm2 进程 `shubao-production`，发布目录 `/var/www/shubao/releases` |
| 火山 MediaKit Key | 已在生产 `server/.env`（`VOLC_MEDIAKIT_API_KEY=AKLTNmQ5…`）—— **部署会把 .env 一起回滚**，所以要在部署**之前**确认它在 |

---

## 二、这个项目是什么（一句话）

**薯包 AI**：电商/内容视觉的生成平台。核心产品形态是「**技能＝方案，模型＝实现细节**」
（docs/design/69）——每条 skill 有自己的子页面与字段，照竞品**知渔**（laoyu.quantv.com）
的页面 1:1 抄字段与档位；图片侧与视频侧必须**同一套视觉语言与交互**。

**用户最在意的几件事**（这几条反复强调，违反任何一条都算没做到）：
1. **钱**：不许在没有用户明确批准时新增/变更收费项或扣费金额；不许跑付费生成（哪怕"验证一下"）。
2. **不许放"点了必失败"的东西**：不可用/未接通的功能一律 `public:false` 或不渲染，且要写清原因。
3. **不许猜上游字段名**：每个模型的完整参数表在 `/api/pricing` 的 `api_doc` 里。
4. **两边一致**：图片生成与视频生成的首页/子页面，间距、按钮、控件、动效要同一套；
   用户原话「**你现在是两套东西在做呀**」是最常见的返工原因。
5. **UI 要照留影AI（liuyingai.cn）**：悬停时图标块铺品牌渐变 + 图标转白 + 标题转品牌色 +
   底部 4px 能量条从左到右充满 + 右下柔光球。逐值实测数据在 `.tmp/ui-recon/liuying-cell-delta.json`。

---

## 三、已做完的（按批，带提交号）

| 批 | 内容 | 提交 |
|---|---|---|
| AM–AR | 本地视频链路（视频高清 / 手动去字幕＝本机 ffmpeg）、火山字幕擦除「自动标记」真机跑通并公开 | 更早 |
| AU | **数字人（火山口型对齐）**：共用 HTTP 底座 `volcMediaKitClient.mjs` + `volcLipSync.mjs` + 产品 + 计费 + 派发 + 技能声明 | `24aa7bf0` / `408bfc8c` |
| AV | UI 第一批：预览窗（方形图不裁 + 删多余行 + 右对齐不越界）、首页间距统一、**12 宫格动效搬到入口卡**、总页面 LOGO 找回、工作台两列清单/左右比例/按钮贴底 | `7a351525` |
| AW | **包含模块默认 0/16**（照知渔）+ **模型面板逐属性换成图片侧同一批 token**（"暖色背景"根因：图片侧用 `--sb-l3-option`，视频侧用了更深的 `--sb-surface-sunken`） | `e0f10b78` |
| AX | **数字人真机实测**（任务 `amk-tool-lip-sync-1401540081154`，成片 7.28 秒，成本 ¥0.12，抽帧确认嘴型跟随）→ 台账转 callable | `30807609` |
| AX | **内容安全闸门第一阶段**（提示词侧，纯本地零成本，五类，命中即 400 不扣费不发上游） | `f728ba77` |
| AX | doc 75（安全闸门两阶段设计） | `6e4e6408` |
| AX | **微动效短视频内核**（本机 ffmpeg，零上游成本，三档动效） | `e5e5a1a7` |
| AY | **小红书子页面接上「让它动」**：`POST/GET /api/motion-still` + 结果卡入口 + 门禁第⑤条 | `e727c7cf` |

**关键调研结论（别重做）**：
- **@Aura 的 ¥8000 是商单报价**，不是广告位费。第三方拆解（圆噗噗）写明它的定位是
  「**品牌视觉创作者，而非普通好物分享博主**」，卖「一套完整的小型品牌广告方案」；
  素材：粉丝 3764 / 赛道「AI好物图文」。我实测过它一条笔记 = **10 张图的一整组 campaign**、
  全是品牌官方物料级复刻、**一张脸都没有**。拆解原图在 `.tmp/xhs/note/raw-2.jpg`、`raw-3.jpg`。
- **小红书抓取**：带 token 的分享链接 `/discovery/item/<id>?source=webshare&xsec_token=…&xsec_source=pc_share`
  用**手机 UA** 能读**全文 + 全部原图**（一条链接 = 一条笔记）；页面只带出作者其他笔记的**标题**，
  **没有 id/token** ⇒ 全量仍要登录态。桌面端被 IP 风控挡（300012）。
- **实况图**：真·Live Photo 只能 App 内从相册发；**账号内容生产不需要它**——出 2~3 秒竖版短视频
  直接发即可（用户原话「目的只是发到小红书上成为他的笔记内容」）。

---

## 四、待做的（只剩三条，按优先级）

### ② 数字人创作台接线（**下一步做这个**）
**为什么必须做**：实测通过、价格已确认，但 VideoStudio 里没有 `upstream-process` 引擎的分支。
现在产品是 `public:false`，而 `processPlanBlocked` 在拦——**一旦翻公开而不接线，用户进那一页会
落到"上游生成"的默认分支**（拿默认模型出一段普通视频并照常扣费）。

**要做四件事**（都在 `src/pages/VideoStudio/index.jsx` 的 process-product 分支上）：
1. 把 `localEngine` 那一串判断推广成"**process 产品**"（`localEngine || upstreamProcessPlan`）；
2. **音频槽位的时长探针**（现在只对源视频探时长；这一档要按**音频秒数**计费）；
3. 报价数量取**音频秒数**（服务端 `billableQuantity({sku, seconds})` 已支持，页面还没传）；
4. `plan.engine` 判据、生成按钮闸门（已写成读服务端 `capabilities.digitalHuman.available`，
   接线完成后会自动放开）。

**接完要做的**：产品 `lipsync_volc.public` 与两条 SKU `public` 一起翻 `true`；
技能 `video.digital_human` 的 `availability: 'blocked'` 改 `'ready'`；台账已经是 `callable`。
**价格**：0.12 积分/秒（用户已确认「你利润这块觉得还可以就行」；对标知渔 2.40 积分/分钟）。

### ③ 内容检测第二阶段（设计已写好在 `docs/design/75`）
顺序按"先找免费的地方"：① 复用已有 LLM 调用做**顺带判定**（0 元）；② **翻译上游的内容策略拒绝**
（0 元，现在它被当成我们的故障，用户看到的是"生成失败"）；③ 图片分级只做**抽检**（要花钱，最后）。

### ④ 发布包 —— 用户明确说「先等等，没考虑好」⇒ **不要动**。

---

## 五、每批的固定流程（照做，别跳）

```
改 → npm run test（全量，必须 0 fail）→ npm run precommit（构建 + 38 门禁 + e2e）
  → git commit（写清依据与用户原话）
  → 部署 → 生产复验 → RTK 追加
```

**部署**（约 10 分钟，含 600 秒 canary）：
```cmd
cd /d F:/da/_deploy-b39 && git fetch "F:/da/shubao" codex/ecommerce-stability
cd /d F:/da/_deploy-b39 && git checkout --detach <新提交 sha>
cd /d F:/da/_deploy-b39 && pwsh -NoProfile -File scripts/deploy-production.ps1 -RepoPath F:/da/_deploy-b39 -SkipPublicChecks
```
⚠️ **部署前先确认生产 `.env` 里那把 MediaKit Key 还在**（`grep VOLC_MEDIAKIT_API_KEY /home/ubuntu/shubao/.env`）——
上一批就是部署失败回滚把 .env 一起还原、Key 丢了。
⚠️ **canary 的 600 秒里绝对不要动生产**（我上次在 canary 里跑了 `pm2 restart`，直接判成失败并回滚）。
⚠️ 等部署收尾的判据**只认** `Deployed <sha> to https://…` 这一句——那三行「校验跳过」的警告里带
`failed`/`canary failed`，用宽判据会连续误判。

---

## 六、环境坑（都是今天踩过的，别再踩）

1. **环境是 cmd**：不要用 `;` 串命令；**多行 Node 代码一律写成 `.tmp/*.mjs` 再跑**
   —— `node -e` 遇到换行/引号会被吃掉字符、**静默失效**（今天为此浪费了三次：RTK 追加两次、
   测试追加一次，都是"命令返回成功但什么都没写进去"）。
2. **读 `RTK.md` 用 `fs.readFileSync` 按行切片**，绝不要用 Read 工具（2000 行处截断，本项目因此丢过 4020 行）。
3. 生产复验**从服务器本机发请求**（我这台机器直连 `shuimg.cn` 全部 ECONNRESET）：
   `ssh -i ~/.ssh/shubao_deploy_ed25519 ubuntu@114.132.157.250 "curl -s https://shuimg.cn/api/video/capabilities"`。
4. `git add` 不要用 `-A`：仓库根目录有几百个 `.tmp-*`、`.qa/`、`docs/...` 未跟踪文件，
   只按路径 `git add <文件>`。
5. 本地探页面：`node server/index.mjs`（在 **9233** 端口、自己发 dist）+ `npm run build`；
   登录遮罩 `.ld-overlay` 在探针里 `remove()` 掉即可（只影响那次探测的 DOM）。
6. 改判据时必须写明是「**事实变了**」还是「**用户改向**」——本项目的门禁是审计记录，
   每处改动都要带理由（今天的例子：数字人台账 unverified→callable 是"事实变了"；
   预览窗"必须有标签行"→"不许有"是"用户改向"）。

---

## 七、用户协作方式

- 他会**带坐标/截图**提 UI 批注，一次十几条 —— 先逐条落到代码位置，再成批改，**不要漏**。
- 他反复强调的两句，出现即返工：**「你现在是两套东西在做呀」**（两边不一致）、
  **「你有没有用鼠标去挪一下？」**（要真的去竞品页面上实测动效，不要凭截图猜）。
- **素材/验证类的事自己做**：他原话「真人视频你自己可以找呀，网上一大堆，我们反正只是测试呀」
  「你自己想办法解决调研问题吧，**不要抛给我**」。
- 报告要**先给结论**，再给证据；做不到就直说，不要"看起来完成了"。
