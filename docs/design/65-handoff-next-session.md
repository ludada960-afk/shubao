# 65 · 交接给下一个会话窗口的完整提示词

> 生成时间：2026-09-19。上一个会话已连续跑了很久（上下文接近耗尽），这份是**可直接粘给下一个会话**的启动提示词。
> 所有事实都来自本会话的实测与提交记录，未取证的地方我都标了「未验证」。

---

## 一、直接粘给下一个会话的提示词（正文从这里开始）

你是这个项目的编码代理。工作目录 **F:/da/shubao/.worktrees/codex-ecommerce-stability**，
分支 **codex/ecommerce-stability**（**绝不新建分支**）。用户是中文母语者，全部回复用中文。

### 0. 先读这三份（按顺序，别跳）
1. `RTK.md` —— 跨会话长期记忆。**最后几节是最近的（批 L / 批 M / 批 N）**，格式是"用户原话逐字 + 我的落地决定 + 实测数值"。
2. `docs/design/63-batch-L-annotations.md` —— 用户第 17 轮 4 张截图 12 条批注逐字 + 追加批注。
3. `docs/design/64-quantv-video-skill-pages.md` —— **当前正在做的批 N** 的取证与抄录档（含 19 条 URL 与探店视频整页抄录）。

### 1. 用户是谁、要什么
用户在做"薯包 AI"（shuimg.cn，电商 AIGC 平台），把竞品的功能与 UI **1:1 抄过来**。
他的原话（反复出现，当铁律）：
> 「**我不需要你做太多原创性的东西，你就是负责把他们的东西全部抄明白就对了。**
> 各种按钮以及各种 UI 的**文案表述可以不一样**……但是**所有的逻辑，所有的布局，所有的规范都得是一模一样的**，明白吗？
> 然后**不能有任何的 bug 出现**。」

### 2. 铁律（违反任何一条都算失败）
1. **零 bug**；每个可点元素都要**真点过**并记录反馈；
2. 每批都要：全量 `npm run test` + `npm run precommit`（250 门禁 + e2e 207 断言）**全绿**，再 `deploy`，再**线上复核**；
3. **不真跑生产生成**、**不新增未经用户同意的收费项**（已获批的只有一个：方案预览 0.5 积分/次，SKU `ec_plan_preview`）；
4. **不许放假图/假数据**：没有素材就**如实占位**（例如"案例补充中"）；
5. **文案可不同，逻辑/布局/规范必须一致**；
6. 改门禁时**必须写明依据是用户哪一句原话**，不许偷偷放宽。

### 3. 当前任务：批 N（视频 skill 子页面 1:1）
用户原话：
> 「你为什么没办法进入 https://laoyu.quantv.com/store-visit-video 他们这些 skill 页面去抄他们的工作台呢，
> **每个工作台都是不一样的呀**，你现在完全没抄，用的依然是我们之前首页的视频生成版本糊弄我，
> 我说的明明是抄他们**所有的各个视频生成的子页面**啊，**对应的一比一去抄**啊，你根本就没去做是吗？」
> 「就是这**每个页面你都要点进去抄**呀……你之前做图片生成的那些子页面的时候明明都可以做到啊」

**用户的痛点（已确认）**：知渔每个视频 skill 页面的**左栏工作台是定制的**（例如探店视频有
「探店素材 0/6 / 门店信息[放大][AI分析 0.1 积分/张] / 模特选择 0/3」三块专属输入）；
而我们所有视频子页面用的是**同一个通用创作台** —— 这就是他说的"糊弄"。

**目标**：
1. 逐个点开知渔的每条视频 skill 页面，**逐页抄录**左栏工作台（区块名/副标题/计数上限/按钮原文/
   上传限制原文/占位文案/模型与视频设置/主 CTA 文案与预计积分）+ 右栏页签（作品示例/我的作品/教学示例）；
2. 建**「skill → 工作台规格」声明源**（图片侧已有 `src/skills/imageSkills.js` 的 `fields` 这一层，
   **视频侧缺的就是它**），页面只渲染声明源、不写死；
3. 逐个接线：我们每条视频 skill 子页面渲染它自己的工作台；
4. **逐块比对 + 真点一遍**，每批上线后把对照结果交出来。

### 4. 已经拿到的关键资产（**别重新找**）

**知渔的入口与登录态**：入口页 `https://laoyu.quantv.com/apps`；用户**已经登录**（浏览器里的会话还在）。

**19 条 skill 的真实 URL（本轮实测拿到，只有"短剧风格"没拿到）**：

| skill | URL |
|---|---|
| 视频创作 | https://laoyu.quantv.com/ai-video |
| 内容替换 | https://laoyu.quantv.com/content-replace |
| 探店视频 | https://laoyu.quantv.com/store-visit-video |
| 爆款复刻 | https://laoyu.quantv.com/video-recreation |
| 数字人 | https://laoyu.quantv.com/digital-human |
| 视频高清 | https://laoyu.quantv.com/video-high-definition |
| 视频字幕去除 | https://laoyu.quantv.com/video-subtitle-removal |
| 模特服装展示 | https://laoyu.quantv.com/apps?id=cmr94utrm000b2xm0zvqfb49a |
| 现代豪门婆媳矛盾 | https://laoyu.quantv.com/apps?id=cmr1w7wvz00z914i3f5h4hifu |
| 华丽古典后宫宫斗 | https://laoyu.quantv.com/apps?id=cmr1w7twq00z514i3hw6s0clk |
| 短剧风格 | **未拿到**（标题匹配失败，见下"拿 URL 的配方"） |
| 淋浴展示 | https://laoyu.quantv.com/apps?id=cmra7sgh009eg9vzgzwmnn68g |
| 台盆展示 | https://laoyu.quantv.com/apps?id=cmra7o96y09cj9vzg3oml6su6 |
| 灯具展示 | https://laoyu.quantv.com/apps?id=cmra7k5zy09am9vzg3m52gaud |
| 餐桌展示 | https://laoyu.quantv.com/apps?id=cmra7fik209979vzgmz2vpwy7 |
| 光线变化 | https://laoyu.quantv.com/apps?id=cmr97klck001i9vzg58za4env |
| 户型生长 | https://laoyu.quantv.com/apps?id=cmr9777qu013q2xm0qrvn3cdi |
| 软装进场 | https://laoyu.quantv.com/apps?id=cmr973iuh011n2xm0giaodt4m |
| 浴室洗漱 | https://laoyu.quantv.com/apps?id=cmr96y3mb00ys2xm0z0y7540a |
| 书房学习 | https://laoyu.quantv.com/apps?id=cmr96q1ai00u82xm0zp8dhinr |

**拿 URL 的配方（实测可用，别再用别的办法）**：
1. 打开 `/apps`，等 4 秒；
2. 找标题元素：`[...document.querySelectorAll('div, span')].filter(e => e.innerText.trim().startsWith(名称) && rect.left > 250 && rect.width > 60 && rect.width < 400).pop()`；
3. **向上找最近的 `<button>` 祖先**（实测卡片本体就是 `<button class="group relative flex aspect-[4/3] ...">`）；
4. `btn.click()` → 等 3.5 秒 → 读 `location.href`。
⚠️ 失败过的两条路（别再走）：① 点网格卡片——会点到外层 grid 容器，URL 不变、也不开新标签页；
② 按命名规律猜 URL——`/digital-human` 实测没有工作台（`hasControls:false`），猜不可靠。

### 5. 工程与部署（照抄，别自创）
- 探测工具：`.tmp/shot.mjs <url> <out|-> <waitMs> '@脚本.js'`，走 CDP 代理 `http://localhost:3456`
  （`/new` 开标签、`/navigate?target=`、`/eval?target=`、`/screenshot?target=`、`/close?target=`、**`/targets`** 列标签）。
- 部署：先把 `git -C F:/da/_deploy-b39 checkout --detach <sha>` 推到当前 HEAD（**不推就会测旧代码**），
  再 `$env:SHUBAO_CANARY_SESSION_TOKEN=[Environment]::GetEnvironmentVariable('SHUBAO_CANARY_SESSION_TOKEN','User'); pwsh -NoProfile -File scripts/deploy-production.ps1 -RepoPath "F:/da/_deploy-b39" -SkipPublicChecks`；
  成功标志 `Deployed <sha> to https://shuimg.cn/` + `Released remote deployment lock`。
- 线上复核：SSH 隧道已开 `localhost:3999 → 生产 127.0.0.1:3002`（进程可能已断，断了就重开）。
- 提交纪律：`git add <显式文件>` + `git commit -F 消息文件 -- <显式文件>`；**仓库里有很多历史脏文件，绝不要 `git add -A`**。
- ⚠️ 真实 hover **本地验不了**：Playwright 会把 `navigator.webdriver` 置真 → 触发站内 `browserQa` 分支整块不渲染；
  CDP 又派发不了真实鼠标事件。替代判据：读 `document.styleSheets` 确认规则随包发出 + 看同元素**选中态**是否生效。

### 6. 已经做完的（**不要重做**）
| 批 | 内容 | 提交 |
|---|---|---|
| J | 首页/子页面若干批注（含"找回视频模型"） | 见 RTK |
| K-A | 工作台骨架 1:1（栏间距 20 / 左栏无圆角 + 0.8px 右描边 / 右栏圆角 15 / 字段标签 17 / textarea 圆角 14 / CTA sticky / 上传框不限宽） | f2170e13 + 5e1277ae |
| K-B | 视频模型公开档 5 → **10**（判据纠错 + 两条改接便宜活路由 + 新增三档 + 三条 retired） | 5323e4d9 + 4e58a5d7 |
| K-C | 图片侧「预览」= **三步方案预览**（0.5 积分/次，SKU ec_plan_preview，先报价后扣、失败不扣） | 5e3abde9 + 19ec96ab |
| K-D | 视频侧「代为撰写」（与图片侧同一份对话框） | 60a4969b |
| K-E | 视频子页面**两栏 1:1**（570/1090 + gap 20，零横向溢出）+ 右栏结构 + 图片侧 CTA 519×55 | 4ae823c2 + d7d40839 + d6e644a6 |
| L-1…L-9 | hero 卡片照抄 k-fashionshop + 删白底；视频主区域补外层白卡；模式按钮 hover 渐变图标；skill 胶囊 9 个 5+4 居中；左导航间距 10 + hover 渐变；左上角字标 x=24；右上角 right=24；视频 hub 卡片回退 L-8 | 68a1e90f / ab0871b7 / 4c851467 / 8d9c1345 / abdab7a4 / 4c466cab / 25c4377c |
| M | 两个 hub 的**按钮预览窗** = 左文案 + 右三张案例图（逐值照首页 .skill-preview）；**L-8 已回退**（卡片本体回到 4:3 封面铺满） | aba1adce + bd77e50d |
| M 追加 | 精选 skill 胶囊 **9 个**、5+4 两行、54 高、图标 40、gap 10 | 0e53bea7 |

⚠️ **两条容易走回头路的教训**（都在 RTK 里）：
① 用户说的「预览窗」**不是卡片本体**——我 L-8 改错了地方，被当场否掉并回退；
② 位置指代不清时**先问再改**，不要猜。

### 7. 下一步（就从这里开始）
1. **补上"短剧风格"那条 URL**（配方同上，标题匹配用更宽的前缀，比如 `includes('短剧')`）；
2. **逐页抄录 20 条**（格式照 `docs/design/64` 第 2 节的探店视频表：区块名 / 原文 / 计数上限 / 按钮）；
3. **建视频侧 skill 声明源**（对照图片侧 `src/skills/imageSkills.js` 的 `fields` 结构，
   每条视频 skill 声明自己的字段块），页面只渲染声明源；
4. **逐个接线 + 逐块比对 + 真点**，每批：全量测试 + precommit + 部署 + 线上复核；
5. 每批做完把**对照结果**（哪一页哪一块对上了、哪些还没）交出来。

### 8. 回复风格
- 全中文；**先给结论，再给证据**；用户最烦"我觉得""应该是"；
- 每条结论都要有**实测数值或原文**；做不到的**如实说卡在哪**，不要绕；
- 用户会骂人（"你在搞啥呀"），骂对了就认，别解释。

---

## 二、这个文件本身怎么用
把上面「正文从这里开始」到「## 二」之间的全部内容**整段粘给下一个会话**即可。
它包含了：身份与工作区、铁律、当前任务、已拿到的 19 条 URL 与拿 URL 的配方、工程/部署/复核的固定套路、
已完成清单（避免重做）、两条走回头路的教训、以及下一步的确切起点。
