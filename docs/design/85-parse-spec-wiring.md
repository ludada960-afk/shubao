# 85 · 「代为撰写」的解析方案接线（parseSpec → 界面 / 流水线）

> 批 BW（2026-09-26）。承接 `src/skills/parseSpecs.js`（批 BV 只入库、没接线）。
> 用户口径（逐字）：
> ①「用户输入他的提示词或者图片之后，你会有**解析的方案**吗？**为什么我现在看起来就是一些标签而已啊**」
> ②「我要的是，**每个工作台 skill 有自己个性化的解析方案**啊，**不可能概念 skill 还解析什么卖点和产品特点吧**？」
> ③「不止是概念视觉，我们现在**所有的图片生成和视频生成的代为撰写**是不是都应该这么做呢，**个性化做匹配方案**啊。」
> ④（版式）「你要按照他这种**排版和设计思路**去做……**设计思路和 UI 样式可以抄呀**」（七张知渔「代为撰写」实拍图）

## 一、改前 / 改后（用户看到的东西）

| | 改前（批 BV 结束时） | 改后（本批） |
|---|---|---|
| 步① 素材理解 | 只有"每张素材的一段理解" | 素材理解 **＋ 这条技能的解析条目卡**：一行一条（声明源出"解析什么"，模型出结论），可改、可删、**卡片底部 + 添加一条** |
| 步② 方向与偏好 | **全站共用**三组胶囊（业务场景/内容类型/拍摄方式），且**一个都没选中** | **这条 skill 自己的**方向组，且**默认选中每组第一档**（中性档"智能匹配"，或该 skill 已声明过的默认值） |
| 步③ 方案预览 | 一坨长文本 + 分步条 | 分节块：**本次解析 / 分步 / 正文 / 需要注意** |
| 模型收到的活 | 永远按"商品名/卖点/人群/场景/参数"那一套问 | **按这条 skill 声明的解析项问**，并明说"不要解析清单之外的东西" |
| 概念视觉方案 | 会去解析卖点、人群、参数（用户点名这是错的） | 解析：主体物/材质与质感/色调归属/场景与背景/现有光线/要避开的/可用手法建议/方向建议；方向组 = 工作台自己的 **20 条母体 + 10 种手法 + 比例口径** |

## 二、四条接线的落点

1. **方案表在前端算，服务端只接收消毒后的结果**（`planPreviewModel.planPreviewSpecFor`）
   一条 skill id ⇒ 它自己的解析项（`items`）与方向组（`directions`），随请求一起下发；
   服务端 `sanitizeSpecItems` / `sanitizeDirections` 只保证形状与长度可控，
   然后据此组织 systemPrompt：逐项列出 key（label + hint），并写死一句
   「不要解析这份清单之外的任何东西（比如卖点、适用人群、价格、尺寸参数）」。
   前端没下发（首页那种没有具体 skill 的入口、老客户端）⇒ **退回**表面级通用三组 —— 老契约不变。

   ### ⚠️ 为什么不是"服务端按 skillId 自己查表"（真实事故，已回滚）
   第一版就是那么写的：`server/planPreview.mjs` 里 `import '../src/skills/parseSpecs.js'`。
   本地 `npm run test` 全绿、`npm run precommit` 全绿 —— **因为本地有 `src/`**。
   一上生产：服务端在 **import 期** MODULE_NOT_FOUND，进程起不来，健康检查 60 次全部
   `connection refused`，部署脚本按设计**自动回滚**（生产未受影响，回滚步骤自己也通过了）。
   根因在打包清单（`scripts/deploy-production.ps1`，第 540 行附近）：发布的归档只有
   `dist server shared scripts/...` —— **不含 `src/`**。`src/` 是只在开发机与构建期存在的东西。
   ⇒ 配套两条：① 服务端与前端共用逻辑一律放 **`shared/`**（那里真的会被发布）；
     ② 门禁 `test/server-shipping-boundary-0926.test.mjs` 扫 `server/**` 的相对 import，
        落在 `src/`（或 `dist/`）上直接判红，并核对打包清单本身没写歪。

2. **归一化只认声明里的键**（`normalizePlanItems`）
   模型只负责给 `value`，`label/hint` 一律来自声明源；模型自己冒出来的键（例如它自作主张回的
   `sellingPoints`）**直接丢掉** —— 否则"这条 skill 不该解析卖点"会被模型的自由发挥绕过。

3. **界面**（`PlanPreviewDialog.jsx` + `planPreviewModel.js` + `plan-preview.css`）
   步① 的**行在打开对话框时就建好了**（模型还没答时值为空）—— "这条技能要解析什么"是看得见的，
   不是等模型返回才知道。用户改过的条目：进 `actionId`（= 另一份方案，另算 0.5 积分）、
   应用时并进正文（`【按你的修正】`），改完再点「重新生成方案」时作为**已确认结论**下发给模型。

4. **两个入口都把 skill 带进去**
   图片侧 `skillId={skill.id}`（MediaCreation）、视频侧 `skillId={workbenchSkillId}`（VideoStudio 子页面）。
   视频侧首页形态没有 skill ⇒ 空 id ⇒ 通用档；技能子页面里「代为撰写」的入口是**工作台的付费动作**
   （`SCRIPT_ACTION`，label「生成脚本」），不是首页那个 `.video-dawei-entry` —— 两者走同一个 `runDawei()`。

## 三、方向组可以**继承工作台自己的档位**（`fromField`）

```js
{ key: 'theme', label: '主题意象', fromField: 'theme', options: [AUTO] }
```
- 含义："这一组的档位就是这条 skill 工作台里那一格的档位"。市场/语言/风格/背景这些格子**每条 skill
  本来就不一样**（A+ 的语言档与详情图的不是同一张表），预览里再抄一份就是**第二份会漂的表**。
- **继承来的档位只能往后接**：第一档永远是声明里的第一档（门禁③ 认可的中性档或 pinned），
  否则"默认选中"的判据会被继承悄悄改掉（`parse-spec-wiring` 门禁① 守这条）。
- 取不到那一格就退回本组自己声明的 `options` ⇒ 同族里没有这格的技能仍然合法。

实际生效的继承（实测）：概念视觉方案 `theme` 20 条母体 / `shot` 10 种手法；商品套图
`market`(10) / `platform`(6) / `language`(15)；建筑家装 `style` / `lightMood`；人像 `style`；图片编辑 `backdrop`。

## 四、默认档的两条合法路径（沿用批 BV 的裁定）

第一档会被界面**默认选中**，所以它只能是：① 中性档 `auto`/`keep`；或 ② `pinned: true` + `reason`
（"这就是这条 skill / 工作台已经声明过的默认值"）。批 BV 那条规则抓出过我替用户拍板的 4 处取值，
本批的 `resolveParseDirections` 因此**不允许**继承顶掉第一档。

## 五、视频侧 59 条的核查结论（用户问过"视频那边是不是也全都没解决"）

- **解析方案**：59 条按 id 全部取得到（`videoSmart`/`videoFrame`/`videoRemake`/`videoReference`/`videoLocal`
  五套族级 + 单条覆盖），门禁① 现在**按界面真正走的那条路**（id + 板子）逐条断言，不只按对象。
- **版式**：视频侧**没有**图片侧那个"按钮被收起来 / 宽度不固定"的缺陷 —— 它自己在批 BB（2026-09-24）
  就修过同源问题，根因写在该文件里："按钮的宽度由文字决定（inline-flex），不由容器决定（grid 1fr）"，
  `.video-mode-tabs` 补了 `display: flex` + `flex-wrap: wrap` + `gap: 24px`，
  `.video-resolution-pills` 是 `repeat(2, minmax(0,1fr))` 的定宽列，`.video-config-trigger` 走固定 180px。
- **返回按钮对齐**：视频 skill 子页面就是 MediaCreation 的子页面（`<VideoStudioPage embedded workbenchSkillId=… />`），
  顶栏是同一套 `topbar-row.is-subpage` ⇒ 批 BS 的全局对齐修复**已经覆盖**它们。

## 六、门禁

`test/parse-spec-wiring-0926.test.mjs`（7 条）：
① 108 条**按 id 在前端算**都能取到自己的方案 + 解析后第一档仍是中性/pinned（含自证）；
② 概念视觉方案的步② 是它自己的工作台档位（21/11/1），且通用三组**不出现**在它的预览里，
   无 skillId / 不存在的 id / `__proto__` 一律返回 null（界面据此退回通用档，而不是编一份）；
③ 服务端请求体逐项列出解析项 + 明说别解析清单外的东西 + **没下发声明时不要求 items、退回表面三组** + 消毒（去重/去空/封顶）；
④ 模型编出来的键被丢掉、没答的项留空行、也容忍 `{key: value}` 对象形状；
⑤ 降级时行照常给出、值为空（不假装、也不把"要解析什么"藏掉）+ **没下发声明时不许凭空长出解析条目**；
⑥ 客户端纯函数（行/修正/应用正文/预选）与两个调用点、actionId 都带条目；
⑦ 自证：第一档换成具体取值必须判红（防"继承"把判据架空）。

`test/server-shipping-boundary-0926.test.mjs`（3 条，本批事故的直接产物）：
① `server/**` 里所有相对 import 必须落在会被发布的目录（`server/ shared/ scripts/`），
   落在 `src/` 或 `dist/` 上判红并逐条列出行号；② 自证（塞一段 `../src/…` 样本必须红，
   而 `../shared/…`、`./x.mjs`、`node:fs` 不算）；③ 核对打包清单那一行与这条口径一致
   （清单里真的没有 `src/`、而 `shared/` 真的存在且被发布）。

**变异自证**：① 把概念覆盖的 `fromField: 'theme'` 改成不存在的字段 → ② 立刻红两条，改回即绿；
② 往 `server/planPreview.mjs` 顶部塞一行 `import ... from '../src/skills/parseSpecs.js'` →
   shipping-boundary ① 立刻红并点名 `server/planPreview.mjs -> ../src/skills/parseSpecs.js`，删掉即绿。

**生产分层干跑**（`.tmp/bw-ship-sim.mjs`，非门禁、一次性取证）：只拷 `server/` + `shared/`
（**不含 `src/`**）到一个临时目录，在那里真的 `import('./server/planPreview.mjs')` 并构一次请求 ——
证明"发布包里也装得起来"。事故前这个干跑会直接 MODULE_NOT_FOUND。
