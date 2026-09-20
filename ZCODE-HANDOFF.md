# 薯包 AI（shuimg.cn）项目交接 —— 给 zcode 的完整信息对齐

> 写于 2026-09-19（批 R 结束时）。作者：接手本项目的 AI 开发代理。
> 目的：让另一个工具（zcode）**零信息差**接上这个项目继续跑任务。
> 阅读顺序：§0 → §1 → §4 → §5，然后按 §9 的起手式开工；要动某个板块再看 §2/§3。

---

## §0 三十秒上手

| 项 | 值 |
|---|---|
| 工作树 | `F:/da/shubao/.worktrees/codex-ecommerce-stability` |
| 分支 | `codex/ecommerce-stability`（**不许新建分支**，一直在这条线上提交） |
| 产品 | 薯包 AI（线上 shuimg.cn）—— 电商 AIGC 平台（图片生成 + 视频生成） |
| 对标竞品 | 知渔 `https://laoyu.quantv.com`（**唯一对标对象**，见 §3 取证方法） |
| 主命令 | `npm run test`（全量契约）→ `npm run precommit`（硬门禁）→ `npm run build` + `node scripts/media-workbench-e2e.mjs`（真浏览器端到端） |
| 唯一事实源 | 技能与字段声明在 `src/skills/*.js`；页面只渲染，不许自己写控件（见 §4.1） |
| 跨对话记忆 | 仓库根的 `RTK.md`（4900+ 行，按批次记录每次改动的**判据 + 证据 + 踩坑**）；本文件是它的浓缩版 |
| 本文件对应的提交 | `dd13c10c`（批 R 代码 + 门禁 + 本文件），**已部署线上并复验通过**；`fb41ae77` 是随后的 RTK 记录 |
| 上一个已部署批次 | `f927a86a`（批 Q-⑨） |
| 一句话铁律 | 竞品有的必须一模一样地有；竞品没有的不许自己加；**任何可点元素都要真的点过并留下反馈** |

---

## §1 用户要什么（铁律，逐字引用，任何判据都必须能引用到其中一句）

1. **抄明白，不要原创**：
   > 「我不需要你做太多原创性的东西，你就是负责把他们的东西全部抄明白就对了。各种按钮以及各种 UI 的文案表述可以不一样……但是**所有的逻辑，所有的布局，所有的规范都得是一模一样的**，然后**不能有任何的 bug 出现**。」
2. **1:1 抄子页面**：
   > 「你要确认，视频生成和图片生成的各个子页面对应知渔的各个子页面，分别去对应他们的工作台做专属设计」
   > 「工作台**该滑动的地方要滑动，要选项的地方要选项，该切换的地方要切换，抄到位**」
   > 「我希望你这个图片生成这边，你也要**全部去把这些子页面 1:1 的去把它们抄过来**。」（第 19 轮）
3. **不许凭想象，要实测**：
   > 「你不要凭想象……你要真的去抓他们的**字段名、全部选项、上传位数、按钮价格、编号交付清单**，然后照着做，不要凭想象。」
4. **不许有死配置/死按钮**：
   > 「这些按钮都是不能点击的，完全是死按钮……你连按钮都没法交互，那背后的生成逻辑肯定也是没打通的呀，**要彻底的打通逻辑呀**。」
   > 「不能让一些按钮或者配置成为**死的配置**」
5. **钱路红线**：
   - 不许在没有用户明确批准的情况下新增/变更**收费项或扣费金额**；
   - 不许真实跑付费生成/付费视频（上游一律打桩）；
   - 不许用假图、假数据、假占位冒充成品。
6. **每批的验收流程**（缺一步都不算完成）：
   全量 `npm run test` + `npm run precommit` 全绿 → 部署线上 → **线上复验**（真页面真点击）→ 把判据/证据/踩坑写进 `RTK.md`。
7. 用户第 21 轮（本批 R 的起因，逐字）：
   > 「模型选择不用纠结啊，他们子页面的模型不也是首页的模型吗，**直接引用就好了呀**，比例里的「自适应」我不知道是不是指原来各个 skill 自己的尺寸比例方案，各个 skill 他们自己有最适配的方案吗，有的话就可以作为自适应去做吧？案例图不急，你**先确保你现在线上所有的 skill 来源和工作台功能打通，所有适配方案都确确实实没有任何问题**我们再来跑案例，**你自己要深度核查一遍**。然后我现在打算把任务在 zcode 上跑，试试看你们的差异怎么样，所以你现在先把我们项目的**一切和经历都描述清楚**，然后我可以精准对齐信息差，无缝衔接到 zcode 去跑任务」

---

## §2 代码地图（改任何东西前先看这张表）

### 2.1 声明源（**唯一事实源**：新增技能/字段只改这里，不写页面）
| 文件 | 内容 |
|---|---|
| `src/skills/imageSkills.js` | 图片侧 **50 条**技能声明：id / 名称 / 分类 / tier / pipeline / visual / brief（提示词模板）/ fields（字段）/ cases / deliverables / fuses |
| `src/skills/videoSkills.js` | 视频侧 **42 条**技能声明 |
| `src/skills/videoWorkbenches.js` | 视频工作台形态（哪些技能有专属工作台、哪些走自有链路 `ownWorkbench()`） |
| `src/skills/quantvImageParity.js` | 图片技能 ↔ 知渔页面**对照表**（34 条有对应页 + 16 条自有玩法，各带理由） |
| `src/skills/quantvVideoParity.js` | 视频技能 ↔ 知渔页面对照表（**16 条有对应页 + 26 条自有**，逐条写理由） |
| `src/skills/skillDirectory.js` | 声明源的汇总入口（Hub / 子页面 / 融合动作都从这里取） |

### 2.2 运行层（纯函数，**不碰 DOM、不发请求**，门禁可直接断言）
| 文件 | 职责 |
|---|---|
| `src/skills/skillRun.js` | ① 初始值 `initialSkillValues` ② 校验 `validateSkillInput` ③ 提示词 `buildSkillBrief` ④ 图片 `skillImages`（第一个上传位 = 主图 `image_url`，其余 = 参考图，**上限 8**）⑤ 生成参数 `skillGenerationSettings`（比例/清晰度/数量/**模型**）⑥ 积分 `skillPointsEstimate` ⑦ 请求体 `buildSkillRequest` ⑧ 运行方式 `skillRunKind`（inline / suite / embed / handoff） |
| `src/services/imageModelCatalog.js` | **模型目录（唯一来源）**：8 档模型 + 每档支持的清晰度 + `generationBillingSku` + `generationUnits`（1 积分 = 1000 units） |
| `src/services/imageSizeCatalog.js` | 尺寸表前端镜像（**权威在服务端** `server/ecommerceEngine/modelCatalog.mjs` 的 `LEGAL_IMAGE_SIZES`） |
| `src/services/planPreview.js` | 预览报价（0.5 积分，SKU `ec_plan_preview`） |

### 2.3 渲染层（控件只有一份实现）
| 文件 | 职责 |
|---|---|
| `src/components/media/FieldRenderer.jsx` | **字段控件唯一实现**：9 种 kind = `select / segmented / cards / stepper / textarea / text / slot / upload / counts`；上传框（一体式，含"选择文件 / 从资产库选择"两颗按钮）、计数在标签行、`optionsFrom` 联动、`visibleWhen` 条件显示 |
| `src/components/media/WorkbenchShell.jsx` + `.css` | 工作台骨架：左栏字段 / 右栏结果、分组标题、字体档位、CTA（含积分）、嵌入分支（`.media-skill-card`） |
| `src/pages/Home/SkillWorkbench.jsx` + `.css` | 技能子页面外壳：标题行、编号交付清单、示例卡（方形 191×191） |
| `src/pages/MediaCreation/index.jsx` | 图片子页面总装：字段 → 请求 → 就地出图 → 历史；付费前置动作（一键润色卖点 / 一键解析风格） |
| `src/pages/VideoStudio/index.jsx` + `VideoWorkbench.jsx` | 视频侧总装（含 7 条独立路由页：`/ai-video` `/video-recreation` `/store-visit-video` `/content-replace` `/digital-human` `/video-high-definition` `/video-subtitle-removal`） |

### 2.4 服务端（钱与尺寸的权威）
| 文件 | 职责 |
|---|---|
| `server/ecommerceEngine/modelCatalog.mjs` | `LEGAL_IMAGE_SIZES`（比例 × 清晰度 → 实际像素，**尺寸唯一真源**）、模型路由 `buildModelRoute` |
| `server/ecommerceEngine/ecommerceBilling.mjs` | 由尺寸表反查分辨率档位（`SIZE_TO_RESOLUTION`），不维护第二份清单 |
| `server/billing/catalog.mjs` | SKU 单价（units） |
| `server/videoGeneration.mjs` | 视频比例白名单 `['21:9','16:9','4:3','1:1','3:4','9:16']`（**没有自适应**，未知值会静默回落） |

---

## §3 竞品取证方法（这个项目最重要的方法论，必须沿用）

**只信实测，不信记忆**。所有"竞品是这样的"结论都必须有一份可复查的证据文件。

1. **CDP 驱动真 Chrome**：调试端口 **9333**（profile 在仓库外），辅助脚本 `.tmp/cdp.mjs`（`openTab` / `goto` / `eval`）。
2. **证据落库**（committed，进 `docs/design/data/`）：
   | 文件 | 内容 |
   |---|---|
   | `quantv-image-apps.json` | 104 个图片应用的 `inputConfigs`（字段名/类型/选项数/必填/占位） |
   | `quantv-image-pages.json` | 34 个图片对照页的 DOM 实采（左栏全文 + 原生 select 全部选项 + 面板文案） |
   | `quantv-image-builtin-pages.json` | 6 个内置页（`?tool=`）实采 |
   | `quantv-image-workbenches.json` | 104 个应用的工作台规格（含 `help` 原文——**"自适应"的语义就是从这里查到的**） |
   | `quantv-video-workbenches.json` / `quantv-video-pages.json` | 视频侧 25 个应用 / 31 个页面 |
3. **页面 URL 形态**（对应关系必须按这个走）：
   - 图片应用页：`/image-creation?id=<appId>`；图片内置页：`/image-creation?tool=<tool>`
   - 视频应用页：`/apps?id=<appId>`；视频路由页：`/ai-video` 等 7 条
4. **量尺寸/字号**：`getBoundingClientRect()` + `getComputedStyle()` 逐元素量，不靠肉眼估（本项目的字号档位 13.624 / 14.672 / 12.576 就是这么量出来的）。
5. **每条"我们照抄了"的结论都要能被门禁复查**：机检脚本比对"字段数 / 控件类型 / 档位数 / **档位文案** / 上传上限 / 必填"。

---

## §4 硬规范（违反任何一条，门禁会红；也不要绕过门禁）

### 4.1 字段声明契约
- 只能使用 `FIELD_KINDS` 里登记的 9 种 kind；页面**不许**自己写控件。
- 每个字段必须有 `group`（否则页面上会冒出没有标题的孤儿块）。
- 条件显示写 `visibleWhen: { key, equals }`；选项随别的字段变写 `optionsFrom: { key, map }`；不画标题写 `hideLabel: true`（label 仍必填，读屏与契约要用）。
- 半宽字段写 `span: 'half'`；选项超过 6 档自动折叠成「更多」（`maxVisible` 可逐字段覆盖，实测知渔"光影氛围"8 档不折）。
- 多选写 `multiple: true`（知渔「选择视角（多选）」那一格）。

### 4.2 比例白名单链（**加一档比例必须同时改 4 处**，否则用户选了会被服务端**静默回落成 1:1**）
`server/ecommerceEngine/modelCatalog.mjs` 的 `LEGAL_IMAGE_SIZES`（权威）→ `src/services/imageSizeCatalog.js`（前端镜像）→ `src/skills/skillRun.js` 的 `LEGAL_RATIOS` → `test/ecommerce-model-routing.test.mjs`（尺寸门禁）。
当前合法比例（10 档）：`1:1 3:4 4:3 9:16 16:9 21:9 2:3 3:2 4:5 5:4`。
计费不用手改：`ecommerceBilling.mjs` 遍历尺寸表建 `SIZE_TO_RESOLUTION`。

### 4.3 计费链（**单一来源**）
页面 CTA 上的积分 = `skillPointsEstimate` = `generationUnits(imageModel, resolution) × count / 1000`。
后端 SKU 由 `generationBillingSku(imageModel, resolution)` 决定（例：`ec_image_2k`=1000 units、`ec_mj_2k`=3500、`ec_gemini3_4k`=3000）。
⇒ **换模型 = 换 SKU = 换价格**，所以模型选择是钱路上的字段（本批 R 才接上，见 §7）。

### 4.4 已知代码坑（都踩过，别再踩）
| 坑 | 说明 |
|---|---|
| `stripComments` 不是字符串感知的 | 注释里也不能写十六进制色值（`media-language-unify-0916` 门禁） |
| CSS 注释不能嵌套 | 注释正文里出现注释开始符会让整段样式失效（`css-comment-integrity` 硬门禁，曾导致 35 条 token 静默失效） |
| JSX 注释位置 | `{items.map(x => ( {/*注释*/} <div/> ))}` 会编译失败（本批踩过，`source-syntax-integrity` 抓到）。注释要放在 JSX children 层 |
| 渲染期 TDZ | 依赖数组里引用后面才声明的 `const` → 整页白屏（`render-order-tdz-0917` / `no-tdz-before-init` 硬门禁） |
| 提交纪律 | **只用显式路径提交**（`git commit -- <paths>`），**永不** `git add -A`；提交后看 `git show --numstat` 确认没有异常删除 |
| 门禁判据变更 | 判据要变必须在测试文件里写清"**判据未变、事实变了**"以及依据的用户原话/实测数据 |

---

## §5 工作流（每条都真跑过）

```powershell
# 1) 全量契约（500+ 个 test 文件，串行跑，几分钟）
npm run test

# 2) 硬门禁（BLOCKING 全绿才算过；ADVISORY 是进度条，红了只提示）
npm run precommit

# 3) 构建 + 真浏览器端到端（上游全部打桩，**零额度消耗**）
npm run build
node scripts/media-workbench-e2e.mjs      # 逐条打印 PASS/FAIL，退出码 0 = 全绿

# 4) 部署（把 worktree 的提交同步到部署仓库再跑部署脚本）
cd F:/da/_deploy-b39
git fetch F:/da/shubao/.worktrees/codex-ecommerce-stability codex/ecommerce-stability
git checkout --detach FETCH_HEAD
pwsh -NoProfile -File scripts/deploy-production.ps1 -RepoPath "F:/da/_deploy-b39" -SkipPublicChecks
#    需要 $env:SHUBAO_CANARY_SESSION_TOKEN（脚本自带 npm test 关卡）

# 5) 线上复验（SSH 隧道 → 本地 CDP 打开线上页面量数字）
ssh -i ~/.ssh/shubao_deploy_ed25519 -N -L 3999:127.0.0.1:3002 ubuntu@114.132.157.250
#    隧道会时不时掉，掉了重开；线上验证脚本见 .tmp/verify-online-Q9.mjs（同类脚本可复用）
```

**e2e 覆盖的坑**（`scripts/media-workbench-e2e.mjs`，上游打桩）：必填未填 → CTA 禁用 + 就近说明；上传失败**原地可重试**；请求体契约（prompt/image_url/ratio/resolution/model/visual/幂等键/报价）；结果留在工作台不跳画布；失败只重试失败项并沿用同一幂等键；未登录/余额不足不发请求；502 走 status 轮询自愈；数量 N 发 N 次；刷新后历史还在；**92 页全量扫描**（每条技能都进页面、配齐、发合法请求、拿到结果）；以及本批新增的**模型选择与自适应比例真点一遍**。

---

## §6 当前状态（2026-09-19，批 R）

### 6.1 已经做完并线上验证过的（批次 A…Q，简表）
| 批次 | 内容 |
|---|---|
| A–O | 媒体架构重构（声明源 + FieldRenderer 唯一控件 + 工作台统一）；电商套图/A+/详情图/图片复刻/AI换装/小红书图文等子页面逐页对齐；比例表补 2:3 3:2 4:5 5:4；模型族扩容（8 档）；预览报价 0.5；付费前置动作 |
| **P** | 图片 50 + 视频 42 条技能 ↔ 知渔**逐页对应确认**；图片 28 条 app 页**逐字段机检 SAME**；视频如实二分（16 有对应 / 26 自有玩法，各写理由）；新增两条机检门禁 |
| **Q** | 按用户 13 条批注重做商品套图页；字重/字号层级逐元素重校；A+/详情图切换逐档有内容；上传框改成一体式（照知渔 432×168 虚线框 + 框内两颗按钮）；示例区改方形卡；app 页左栏收敛成**单一「参数配置」组**；视频子页面顶部收口（第一个字段 y=329→233）；**死配置端到端门禁**（92 页 0 处死配置，含自证） |
| **R**（本批） | 模型选择接通 + 比例「自适应」实现 + 深度核查（见 §7） |

### 6.2 线上已验证的数字（部署后可复验）
- 图片 50 页 / 视频 39 页全量扫描：图片首组 y ≤ 130、视频首个字段 y = 233、0 处上传框异常。
- 字体档位：组标题 13.624px/500、字段标题 14.672px/500、药丸与 CTA 14.672px/500、说明 12.576px/400、右栏价格 12.576px/400。
- 示例卡：191×191、间距 13。
- 视频子页面顶部信息卡 519×100。
- 121 个对照字段 0 处多余文案（逐字段比对结论）。

---

## §7 批 R 做了什么（可直接复用的判据）

### 7.1 模型选择（钱路字段，终于接通）
- **范围照知渔**：他们工作台里只有 3 页有「模型选择」——图片复刻（`?tool=image-clone`）、AI换装（`?tool=ai-outfit`）、即梦seedream5.0pro（app 页，我们没有对应技能）。其余 101 个应用页**没有这一格**（`quantv-image-workbenches.json` 逐字段可查）⇒ 我们**不给全站每页塞下拉**（那是我们自己的长相）。
- **选项来源**：`services/imageModelCatalog.js` 的 `SELECTABLE_IMAGE_MODELS`（8 档，与首页模型挑选器同一份目录）；默认档 = 目录第一档 = `image2`（唯一有真实出图记录的模型）。
- **真的接通**：字段 `key: 'imageModel'` → `skillGenerationSettings().imageModel` → `buildSkillRequest().imageModel` → 请求体 `image_model`；`skillPointsEstimate` 读同一个 settings ⇒ **换模型，CTA 上的积分跟着变**。
- **档位联动**：清晰度声明 `optionsFrom: { key: 'imageModel', map: MODEL_RESOLUTION_LIMITS }`（表由目录算出：Midjourney 上游只有 1K/2K）⇒ 选 Midjourney 时 4K 那一颗**消失**；运行层再夹一次（`imageModelResolutions`），并且 `reconcileFieldValues` 在换模型的那一刻把已选的 4K 夹到 2K（**不是显示 4K 按 2K 跑**）。
- **判据/门禁**：`test/image-model-selection-0921.test.mjs`（5 条，已挂进 precommit BLOCKING）；e2e 新增场景 ⑳ 真点一遍（下拉切换 → 价格变化 → 4K 消失 → 请求体里的模型 = 页面上选中的那一档）。

### 7.2 比例「自适应」
- **语义是查出来的，不是猜的**：知渔自己的 `help` 原文 ——
  > 「选择生成图片的宽高比例，「**自适应**」将**根据模特图自动匹配最接近的比例**」
  （证据：`docs/design/data/quantv-image-workbenches.json`）
  ⇒ 不是"每个技能配一个固定比例"，而是**按上传主图的实际宽高就近取一档**。
- **实现**：控件层在上传就绪后量一次 `naturalWidth/Height` 写进条目（`FieldRenderer` 的 `measureBox`，并在 DOM 上留 `data-box="WxH"` 作为可观测状态）；运行层纯函数 `nearestLegalRatio(w,h)`（**对数距离**就近，10 档白名单内取值）；量不到就回落声明默认档（1:1）——**绝不猜**；「自适应」这个界面档位**永不**下发给引擎。
- **范围照知渔**：只有图片复刻与 AI换装这两页有「自适应」这一档（他们实测 14 档 / 6 档）。
- 顺带修正：这两页的分辨率档位照他们实测改成**裸档位** `1K / 2K / 4K`（原来写成"1K 标准/2K 高清/4K 超清"，是别的页面的写法）。
- 图片复刻的「生成数量」按知渔删掉了（他们那一页**没有**张数档）—— 见 §8 待办第 3 条（钱路）。

### 7.3 深度核查结论（用户要求"你自己要深度核查一遍"）
- 50 条图片技能 + 42 条视频技能：来源（有对应页 / 自有玩法）与工作台形态**逐条可查**，无"说不上来"的第三种状态（e2e 全量扫描断言）。
- 92 个页面的字段 → 请求链路：0 处死配置、0 处非法值、0 处上传框异常。
- 本批新增/修正的门禁：`image-model-selection-0921`（新）、`quantv-image-parity-machine-0920`（补内置页的模型/分辨率/比例逐档断言）、`skill-tier-0918`（数量控件下限 8→7，附理由）。

---

## §8 已知缺口与**待用户拍板**的事（不要自己决定）

1. **案例图**：用户明说「案例图不急」——先不跑，等用户发话。
2. **比例 9:21 / 2:1 / 1:2**：已逐份证据扫过 —— 这三档**只出现在知渔的「图片复刻」那一页**
   （`quantv-image-builtin-pages.json` 的 image.copy.panelText；其余 100+ 个应用页与全部视频页都没有）。
   我们引擎尺寸表里没有这三个尺寸 ⇒ 那一页如实缺档（其余档位一档不缺）。要补必须：先按
   `validateGenerationSize` 约束（16 的倍数 / 长边 ≤3840 / 像素 ≤8,294,400）定出三个尺寸 →
   改 §4.2 的 4 处 → **实测上游是否收**（需要一次付费生成，**须用户批准**）。
3. ~~图片复刻固定出 6 张~~ —— **已按用户口径修正（2026-09-21）**：不是固定 6 张。
   用户原话：「他这里的案例指的是上面 3 张原图分别对应下面 3 张的复刻结果啊，用户上传一张肯定就复刻一张，
   上传两张就复刻两张，上传 3 张就复刻 3 张不是吗？」知渔示例区原文也是这么写的：
   「上传风格参考图与商品图包，AI **按参考图数量**批量输出风格高度一致的商品主图。」
   实现：`image.copy` 声明 `runsFollow: 'source'` ⇒ 张数 = 参考图那一格已就绪的张数（0 张 → 1 张），
   第 i 次运行只带第 i 张参考图，报价按张数走（N 张 = N × 单价，点之前就能看到）。
   附注：知渔 CTA 是**一口价 0.60 积分**（实测上传 1/3/4 张商品图、1/3/6/11 张参考图价格都不变），
   他们按次收费、我们按张收费，价格口径本来就不同源。
4. **知渔有、我们没有的应用**：如 `即梦seedream5.0pro`（含「模型选择」radio 一档）等 —— 需要用户决定是否补技能。
5. **视频侧模型选择**：已取证 —— 知渔的 25 个视频应用 + 31 个视频页面证据里**没有**任何模型字段
   （`quantv-video-workbenches.json` / `quantv-video-pages.json` 全文检索"模型"= 0 命中）
   ⇒ 视频侧**不该**加模型下拉（加了就是"我们自己的长相"）。图片侧只有那 2 页有。
   **视频模型下架清理（2026-09-21）**：用户说「视频模型有些现在下架了，你就拿走吧，没有了就不用显示出来了」。
   零成本只读复核（`GET /v1/models` 返回 115 个模型，逐条比对目录里全部 13 条路由）：
   只有 `grok-imagine-video`（Grok 极速）不在清单里 ⇒ 产品转 `public: false`、台账转 `retired`
   （老任务/老订单仍可读，计费 SKU 保留）。公开档 10 → 9。
   ⚠️ 没有做"非法时长提交"探针：那条手法在 `sd-reference-image-25` 上**真的建过任务**
   （见 `docs/design/61-ip233-video-models.md` 的探针安全事故），本次只用只读 `/models` + 用户口径两条证据。
   ⚠️ 另一条观察（未动，等用户拍板）：`kling-3.0` / `kling-3.0-pro` / `veo-3.1-fast` 三条
   现在**又出现在** `/v1/models` 里了（台账 09-19 记的是 retired）。要不要按同样的零成本手法复核后恢复上架，
   需要用户一句话 —— 恢复上架 = 让用户能花钱买它，不能只凭"名字出现在清单里"。
6. **视频路由页顶部高度**：7 条独立路由页（`/ai-video` 等）比子页面更"头重"（我们的页头 + 页签 + 输入框把第一个字段推到 ~400px），子页面已收口到 233 —— 待按知渔实测再收。
7. **模型选择的页面范围**：用户 2026-09-21 已拍板 —— **不扩到全站**，全站默认一个模型
   （照知渔：他们也只有那 2 页给模型选择）。下面第 8 条是默认档的取舍依据。

8. **默认模型选 image2 还是 GPT Image 2.5？**（用户 2026-09-21 提问，数据如下，结论：**保持 image2**）

   | 档位（2K） | 扣费 | 面值（锚 ¥0.00026184/unit） | 上游成本 | 面值毛利 |
   |---|---|---|---|---|
   | `image2`（GPT Image 2） | 1000 units = 1 积分 | ¥0.262 | **¥0.038** | **≈85.5%** |
   | `image2-5-sunburst`（旗舰） | 1500 units = 1.5 积分 | ¥0.393 | ¥0.0975 | ≈75.2% |
   | `image2-5-flare`（极速） | 1500 units = 1.5 积分 | ¥0.393 | ¥0.0975 | ≈75.2% |
   | `mdkj-super` | 1000 units = 1 积分 | ¥0.262 | ¥0.026 | ≈90%（但无出图记录） |
   | `gemini-3-image` | 2000 units = 2 积分 | ¥0.524 | ¥0.12 | ≈77% |
   | `midjourney` | 3500 units = 3.5 积分 | ¥0.916 | ¥0.39 | ≈57% |

   - **利润**：image2 最高（85.5%），且上游成本只有 2.5 的 **39%**（¥0.038 vs ¥0.0975，2.6 倍差）。
   - **效果**：2.5 的文案定位是"最新旗舰、画质与指令理解更强"，但**它没有真实出图记录** ——
     RTK 明确记着「只有 image2 有真实出图记录（多次稳定资产验收）；9-13 新增五档在目录里可选但
     **零真实出图记录**」（RTK:2138）。把没验收过的档位放到**全站默认**（每个技能都走它）=
     把可用性风险直接暴露给用户，正是本项目出过的 P0（"上架了永远调不通的模型"）。
   - ⇒ **建议保持 image2 为全站默认**（利润最高 + 唯一有出图记录）；
     想要旗舰画质的人在图片复刻 / AI换装那两页自己选 2.5（1.5 积分），**不额外承担风险**。
     若用户仍要把 2.5 设为默认：先各跑**一次真实付费验收**（2.5 2K = 1.5 积分 ≈ ¥0.39），
     确认 id 可用 + 产物质量达标，然后改 `DEFAULT_IMAGE_MODEL` 一处 + 更新对应门禁即可。

---

## §9 给 zcode 的起手式（可直接当任务模板用）

**第 0 步：建立基线（不改任何代码）**
```
npm run test          # 必须全绿；若红，先判断是不是并发写入的中间态（重跑一次再定性）
npm run precommit     # BLOCKING 必须全绿
```
**第 1 步：确认你要改的那一页在知渔长什么样**（不许凭记忆）
- 用 CDP（端口 9333）打开对应 URL（§3.3），把字段名、全部选项、上传位数、按钮价格、编号交付清单**逐条抄下来**，存成证据文件（`docs/design/data/` 或 `.tmp/`）。
**第 2 步：只改声明源**（`src/skills/*.js`）+ 必要的运行层；**不要**在页面里写控件。
**第 3 步：把结论写成门禁**（能机检的必须机检），并在测试文件里写清：用户原话 / 实测证据 / 判据。
**第 4 步：跑完 §5 的 1→5 步**（test → precommit → build+e2e → 部署 → 线上复验）。
**第 5 步：把本批写进 `RTK.md`**（判据、证据、踩坑、未完成项）。

**不要做的事**：不要新建分支；不要 `git add -A`；不要为了"让测试过"而删功能或放宽判据（要放宽必须写明"判据未变、事实变了"及依据）；不要真实跑付费生成；不要在没批准的情况下动价格；不要用假图/假数据冒充成品。

---

## §10 术语表
| 词 | 含义 |
|---|---|
| 知渔 | 竞品 `laoyu.quantv.com`，本项目的对标对象 |
| 声明源 | `src/skills/*.js`，技能与字段的唯一事实源 |
| 机检门禁 | `test/*.test.mjs` 里能自动跑、红了就拦提交的断言 |
| 打桩 | e2e 里把上游 `/api/*` 换成本地假响应，**零额度** |
| 92 页扫描 | e2e 里对每条技能都走一遍真实页面的全量扫描 |
| tier | 技能层级：主技能 / `assistant`（辅助能力，不单独进 Hub） |
| fuses | 融合形态：辅助能力以"控件/结果区动作"的形式长在主技能上 |
| RTK.md | 跨对话记忆文件（每次改动的判据 + 证据 + 踩坑） |
