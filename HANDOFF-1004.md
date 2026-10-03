【接手：shubao 第 3 节四条未完线 —— 已收口 + 协同与部署现状】

> 上一份是 `HANDOFF-1003.md`。那份第 3 节的四条线**本轮全部做完了**，
> 第 4 节的待决事项仍然原样未动。本份新增：协同机制的修法、当前谁能部署、以及我犯的一个错误。

## 0. 先读这个

**工作目录**：`F:\da\shubao\.worktrees\codex-ecommerce-stability`
**分支**：`deploy/aigc-1003`（工作线，**不是**发布线）

| 我这条线已提交 | 内容 |
|---|---|
| `ad068c07` | 第 3 节四条线 + 四个新门禁（13 文件，+767/−39） |
| `ccf6f848` | 补交 2026-10-03 知渔实采两份（漏 add，门禁的判据源） |
| `baaf75fc` | collaboration-policy 两处判据改成读清单（3 文件） |

⚠️ **并发会话正在 `gm-b4`（发布线）上干活**，改的是画布端口定位
（`EcCanvas/canvasGeometry.js`、`EcCanvas/index.jsx`、`EcCanvas/nodeWorkflow.js`
+ 未跟踪的 `EcCanvas/canvasNodeRects.js`）。**别往那条线合第三次**，会撞。

## 1. 第 3 节四条线的结论

### ① 视频页「同一个设置画两遍」—— 不存在「谁说了算」

实测与源码双向确认：左栏药丸与底栏面板写的是**同一份 state**
（`ratio` / `duration` / `resolution`）；底栏按钮摘要、`planSignature`、报价、
`createVideoJob` 的 `aspectRatio`/`duration`/`resolution` 全读它。**两处永远同步。**

真问题两个：
- **同一格画两遍**：44 页的比例、5 页的时长。⇒ 新增 `settingsGroups` 单一判据
  （三组与那颗触发器共用）；左栏声明过 bind ⇒ 底栏不画；一格不剩 ⇒ **连触发器也不画**，
  网格列数改由 `--video-toolbar-columns` 给（写死两列会让单颗占半行）。
- **左栏时长药丸不过 `snapVideoDuration`**：底栏滑块 max 来自产品契约、物理上点不出越界秒数，
  药丸能。点下去 `quoteForVideoProduct` 抛 ⇒ sku 为空 ⇒ 生成按钮永久变灰且无提示。
  20 条产品里 11 条 `durations.max < 15`，另有 `live_photo` 只认 5 秒。
  ⇒ `videoStudioModel.durationOptionOverrides()` 逐档禁用 + 写入路径 snap。

门禁 `test/video-spec-single-surface-1003.test.mjs`。

### ② 右栏双滚动条 —— 是左栏套着视频创作台，**不要关**

实机量（1440×900）：图片子页面 0 层、首页视频创作台 0 层、**视频子页面 2 层**
（`div.media-workbench-left` 溢出 78px，套着 `section.video-content-composer` 溢出 425px）。
不是左右两栏，`.video-composer.is-fullscreen` 没参与。

**不能简单关外层**：`WorkbenchShell.css:1396-1400` 记着试过 `overflow:hidden`，
把面板下面那块「生成记录/成片台」一起裁掉了 —— 那 78px 正是它留在栏外的高度。
要收成一层，得先把成片台搬进创作台，独立一步。

### ③ 按钮左边阴影被截断 —— 已修（第一版结论是错的，已回退）

第一版探针用 `blur` 当伸远量（大了两倍），据此改了画布三个 HUD 的内缩。
**4 倍放大截图推翻了这个结论，那三处已全部回退。**
正确口径 `blur/2 + spread ± offset`。重扫九个路由后唯一真问题：
选中药丸的 3px 选中环（`--sb-shadow-ring`）左半边被 `.video-content-composer` 切掉
（药丸行紧贴容器左内边缘，实测左边距 0.0px）。
`overflow-x:auto` + `overflow-y:visible` 在 CSS 里不可能同时成立，环跑不出去。
⇒ 容器补 4px 左右内边距 + 等量负外边距（**零位移**，药丸仍是 x=140）。复扫 9 路由：0 处。

### ④ 图片侧按实采收形态（四条全做）

判据全部由 `docs/design/data/quantv-image-tools-20261003.json` 的 `NOT_HAS` / `control` 派生。

- **新增 `src/skills/imageSpecExposure.js`**：详情图 / A+内容 / 商品套图 不再给规格入口。
  **默认值与视频侧相反**（图片侧 43 条自有玩法 ⇒ fallback 全露，只有实采记了的才收）。
  字段声明**留着**当取值与报价的真源，只是不画。
- **AI换装四组改手风琴卡**：默认展开、**组头本身是收放按钮**、chevron 随状态反向，
  折叠时内容从 DOM 移除。走既有 `workbench.groupLayouts` 机制。
- **AI换装分辨率 / 生成张数改原生下拉**（原药丸 / 步进器）。
  `clarityField` 是 20 多条共用的，所以 `kind` 做成调用方参数 —— 凭一页实测动另外 20 页是反的。
- **图片复刻「复刻程度」改卡片选择器**，说明进每张卡（字段级 `hint` 一字未删，它进提示词）。

门禁：`image-spec-exposure-1003` / `image-tryon-parity-1003` / `image-copy-parity-1003`。

## 2. 我犯的一个错误（请先看这条）

清理 detached 工作树时，我本想**保留 3 棵有未提交改动的**
（`cd-verify2` / `cy11-verify` / `deploy-legacy-image-task`），
但守卫集合里我写了反斜杠路径，而 `git worktree list` 给的是正斜杠，Set 查找全部落空 ——
**这 3 棵被一起删掉了，共 8 个文件的未提交内容没了，不可恢复**（fsck 查过，没留下对象）。

**提交本身没丢**：三棵的 HEAD（`923f6ca7` / `e62428da` / `9cf4cc63`）都仍被分支包含。
丢的只是工作区里那些还没提交的改动。

教训：**路径比较要先归一化再进 Set**，`git worktree list` 的输出形态和
`fs.existsSync` 用的形态不一定一致。删任何东西之前，先把"要保留的名单"打印出来核对。

顺带救回两条：`cy46`(`c9325aa7`) 与 `dep-cy30`(`1cb2acc6`) 的 HEAD **不在任何分支上**
—— 正是 RTK 批之十四条记的那次事故的形态。已建 `keep/c9325aa7`、`keep/1cb2acc6` 保住。

## 3. 协同机制：两处判据都在空转，已修

`npm run collab:check` 原来长期显示 `peer ownership conflicts: 0`，**看起来在检查、
其实什么都没查**；而且它把**项目自己的发布线 `gm/release-merge-1001` 判成 BLOCKED**
（规则写的是「分支名必须以 `codex/` 开头」，那是单线时代的旧约定，批之十四条改了形态它没跟）。

已改成读 `docs/collaboration/lines.json`：
- `policy`：发布线 + 工作线前缀清单；两处说同一句话（门禁 ② 会 cross-check
  `deploy-production.ps1` 的 `-ReleaseBranch`）。
- `scopes[]`：**按范围分，不按工作树分** —— 实测两条并发会话**共用同一棵工作树**，
  按树分谁也认不出谁是谁（门禁 ④ 把这一现实钉住）。

现在 `deploy/aigc-1003` 上跑是 `READY`。门禁 ③ 是**反向验证**：造一个落在别人
owns 里的改动必须被抓出来，否则这个检查等于又变回空转。

## 4. 部署：现在**不该发**，两个原因

**为什么不发**：
1. 发布线 `gm/release-merge-1001` 已被并发会话占用（有未提交的画布改动）。
   批之十四条的操作手册要求「离线一条链 commit → merge → deploy」把窗口压到秒 ——
   而现在 merge 这一步就会失败，谈不上"一条链"。
2. 我最后一次跑发布线全量是绿的（**4785 tests / 0 fail**），但那是**并发会话的画布
   改动出现在那棵工作树之前**。现在那份改动在工作区里没提交，
   此刻发出去等于把别人半成品的时间点钉在生产上。

**发的时候要记住的**：
- 只有 `gm/release-merge-1001` 有权部署，脚本会因分支不对直接 throw。
- **`-SkipForwardOnlyCheck` 绝对不要加**（那是"两条线互相覆盖生产"的守卫，见批 DC 续-36）。
- 这台机器连不上公网，必须 `-SkipPublicChecks`，用了它就要**从服务器上复跑那些校验**：
  `ssh ubuntu@114.132.157.250`（密钥 `C:/Users/SHEJI/.ssh/shubao_deploy_ed25519`）。
- 部署前把 `deploy/aigc-1003` 合并进发布线（现在工作线领先发布线 1 条：`baaf75fc`）。

## 5. 还没动的（第 4 节的待决事项，仍然原样）

- **parity 门禁的过期基准**怎么处理 —— 需要你拍板，我没动判据。
- `Home.css` 归位（`XhsContentMode.jsx:53` 与 `VideoStudio/index.jsx:60` 两个引用方，
  3900 行跨 5 个文件互相覆盖）。独立的 CSS 工程。
- `CreationShowcase.jsx/.css` 零引用孤儿，删不删待定。

## 6. 最后一次核对时的新事实（2026-10-04 凌晨）

- **并发会话往 `deploy/aigc-1003` 上提交了**（和我们同一条分支）：
  `809d3f54`（nano 上游模型名收敛到单点声明）、`e037da05`（自适应改为「不指定比例」）。
  所以「工作线独有 4 条」里有两条不是我写的。
- 工作线脏文件只剩 1 个：`src/pages/Home/ec/DesignDirection.jsx`（并发会话在写）。
  发布线脏 3 个：`EcCanvas/canvasGeometry.js` / `index.jsx` / `nodeWorkflow.js`。
- 工作树 19 → 8，**detached 归零**。孤儿提交已由 `keep/c9325aa7`、`keep/1cb2acc6` 保住。
- **工作线全量 4803 tests / 0 fail / 3 skipped**（含并发会话已提交的那两条）。

⇒ 下一步很明确：等并发会话把 `DesignDirection.jsx` 与画布那 3 个文件提交掉，
再把工作线合并进 `gm/release-merge-1001`，然后才轮到部署。

## 7. 复跑命令

```pwsh
# 工作线全量（约 7 分钟）
cd F:\da\shubao\.worktrees\codex-ecommerce-stability
npm test

# 协同自检（应当 READY）
npm run collab:check

# 实机截图与测量报告
.qa\1003-*.png
.tmp-anno-verify\*.txt
```
