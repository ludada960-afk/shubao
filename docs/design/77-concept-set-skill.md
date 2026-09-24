# 77 · 「概念视觉方案」skill：字段、镜头与提示词配方（设计稿 v2）

> 用户需求（2026-09-24 原话归纳）：
> 「他们每天发的不同一篇图文，很可能每一篇都有自己的一套风格和设计方向……每一篇都有一个很可控的方向，
> 在同样的审美方向下生成内容」＋「有没有人开源了方法论？或者我们用什么办法做到和他一样」＋
> 「**你把方案和提示词和设置这些东西都帮我想好了吗？继续啊**」
>
> 上一轮已验证：① Aura 篇内色差显著小于篇间（A 型 5.11×，B 型 1.19×）；② 他本人确认用 MJ +
> 「需要自己后期，不要直发」+「一整套没有单一提示词」；③ 4 张封面逐个看过，得出**四手法**：
> **概念钩子 + 品牌语言 + 场景叙事 + 棚拍静物**（`docs/design/73` §一）。
>
> 这一篇就是**实施设计稿**：字段、镜头库、提示词模板、默认值、UI 形态、计费边界、单独调整。
> 用户拍板后照此实施。
>
> ═══ v2（2026-09-24 深夜）改了四处，都是把"拍脑袋"换成"有证据" ═══════════════════════
>   1. **预设换成实测色簇**：v1 那 4 套是**按季节编的**（夏日海岸 / 秋日粉调 / 新中式清冷 / 节日礼赠），
>      还写着"这是 Aura 出现频次最高的四个色调簇"——**这句话当时没有证据**。本轮把 41 张封面**全量取色 + 聚类**
>      （`.tmp/xhs-aura-cluster.mjs` → `.tmp/xhs/aura-clusters/covers.json`），得到**5 个色簇**，
>      预设改成这 5 个（见 §五），并把原话改成"实测"。
>   2. **补 §六「单独调整 / 单独设计」**——用户在同一个问题里明确问了
>      「**或者我需要单独调整，单独设计的话，该怎么样呢**」，v1 只在 §四留了一句"[用户补充] 单张微调框"，
>      不够答这个问题。
>   3. **实施清单的文件位置改对**：v1 写的是 `src/skills/imageWorkbenches.js`，
>      **这个文件不存在**（图片侧没有对应的 workbench 声明文件）—— 真实落点见 §九。
>   4. v1 引用的两个开源仓库（jingzao-image-forge / pushing-creation）**全仓只有这一篇提过**，
>      没有仓库地址与 star 数 ⇒ 按 `skillSources.js` 自己定的规矩（"不写不可核对的措辞"），
>      v2 不再把它们当作出处依据，出处登记改走 `ours`（见 §九 步骤 1）。

---

## 一、形态：一条新 skill「概念视觉方案」（`image.concept_set`）

**不是**「一次出 9 张」（用户已否掉 xhs_note 那种一次 9 张：不好控制每张内容），
而是：**一份方案 + 勾选镜头 → 逐张生成，每张 = 方案前缀 + 镜头句**。

- 一次只出**一张**（与首页图片生成同一条生成链路、同一种计费），
  但**方案是持久的**：本次会话里勾 6 个镜头就点 6 次（或排队连出），**每一张自动带同一套前缀**；
- 页面分两栏：左栏 = 方案表单 + 镜头勾选；右栏 = 已出图的结果墙（按镜头归位）+「让它动」。

## 二、方案表单（7 个维度 → 9 个输入位 + 3 格生成设置）

设计意图：**7 个维度**（方向 / 色彩 / 材质 / 世界观 / 光线 / 人 / 品牌），每个维度落到 1 个输入位，
再加 3 格走协议的生成设置（比例 / 清晰度 / 模型）。⭐ = 必填，其余可留空（留空的维度不进前缀）。

⚠️ 本节下面两处写着"照 jingzao 的做法"（字段互斥通道 / reference-profile）——
**那是描述一种做法，不是出处**：该仓库的地址与 star 数我们没有核实过，
按 §九 步骤 1 的结论，出处登记不引它；真要引，先把坐标核实了再写。

⚠️ **「表单形态」一列必须是 `FIELD_KINDS` 里真实存在的 kind**（`src/skills/imageSkills.js` 第 28 行：
`['select','segmented','cards','stepper','textarea','text','slot','upload','counts']`）——
v1 这里写的是"色板选择""多选 chips"，**这两种 kind 不存在**，照着写会卡住。真实映射如下：

| # | 字段 | 表单形态（真实 kind） | 默认 | 进前缀的方式 |
|---|---|---|---|---|
| 1 | ⭐**概念主题** | `text` | 空 | `Concept: {v}` —— 整套图的"一句话方向" |
| 2 | ⭐**主色调** | `segmented`（§五 的 5 套预设，单选）+ 一个 `text`「自定义色值」（可选，填了盖过预设） | 灰调大地 | `Palette: {swatch names + hex}` |
| 3 | **材质关键词** | `segmented` + `multiple: true`（磨砂玻璃/金属/皮革/丝绸/陶土/石材/亚克力/鲜花/水果） | 不选 | `Materials: {v}` |
| 4 | **场景世界观** | `text` | 空 | `World: {v}` |
| 5 | **光位** | `segmented`（柔光罩拍 / 硬日光 / 逆光光斑 / 影棚戏剧光 / 黄昏暖光） | 柔光罩拍 | `Lighting: {v}` |
| 6 | **人物规则** | `segmented`（只出手部 / 手与身体局部 / 允许背影侧影 / 无人物） | 只出手部 | `People rule: {v}` —— 硬约束，进 negative |
| 7 | **品牌字标** | `text`（可空） | 空 | 字标规则见镜头库第 9 号 |
| 8 | **禁止项** | `segmented` + `multiple: true`（无面部 / 无文字 / 无 logo / 无手 / 无水印感） | 无面部 | 进 negative prompt |
| 9 | **风格锚** | `upload`，`maxImages: 3`、`role: 'reference'` | 无 | 走**参考图通道**（对应 jingzao 的 reference-profile） |
| 10 | 比例 / 清晰度 / 模型 | 直接复用 `ratioField()` / `clarityField()` / 模型那一条（都在 `imageSkills.js` 里现成） | — | 不下发进提示词，走协议字段 |

**镜头勾选**也用 `segmented + multiple: true`（10 档，**不给 `default`**）——
仓库里已有同款先例：`image.multi_angle` 的「选择视角（多选）」就是
`{ kind:'segmented', required:true, multiple:true, options:[…] }` 且无 `default`，
渲染出来就是**全不勾**。这正是镜头库要的默认态（与「包含模块」默认 0/16 同口径）。

**条件字段**用 `visibleWhen: { key, equals }`（`styleFields()` 里有现成用法）：
例如「品牌字标」只在勾了镜头 9 时才需要、「自定义色值」只在选了"自定义"时才出现。


**与参考图的关系（关键设计，照抄 jingzao 的互斥通道）**：
- 「风格锚」参考图 = **这一篇的方向证据**（拼进每次请求的参考图位）；
- 方案字段 = **这一篇的可复用规则**（拼进提示词前缀）；
- 两者**分开渲染、分开标注**，不让"像这张图"和"守这套规则"互相打架。

## 三、镜头库（勾选制，默认全不勾 —— 复用「包含模块」已上线的判定）

每条镜头 = **一个模板句**，出图时拼成 `方案前缀 + 镜头句 + 比例`。模板里的 `{品牌}` `{产品}` `{概念}` `{主色}` 引用表单值。

**哪些是实测到的、哪些是我们的加法**（v2 补上这一列，免得把加法当证据）：

| # | 镜头 | 依据 | 默认比例 | 模板句（人读中文 / 实际下发英文） |
|---|---|---|---|---|
| 1 | ⭐ 主图 | 实测·棚拍静物（兰蔻粉水） | 3:4 | Hero product shot: {产品} as the absolute hero, {概念} world around it, {主色} palette, {光位}, {材质} surfaces, centered with generous negative space |
| 2 | 场景叙事 | 实测（Urban Decay 电梯亮片礼服） | 3:4 | Editorial scene: {产品} placed inside {场景}, a human hand (no face) interacting naturally, {主色} palette, {光位} |
| 3 | 静物组合 | 实测（Valentino 巧克力砖静物） | 3:4 | Still-life arrangement: {产品} grouped with {道具} suggesting props, sculptural composition, {主色}, {光位} |
| 4 | 细节微距 | 我们加法（补全成套） | 1:1 | Macro detail: extreme close-up of {产品}'s {材质} surface and craft details, shallow depth of field |
| 5 | 悬浮/失重 | 我们加法 | 3:4 | Levitation shot: {产品} floating with {道具} elements orbiting, {主色} seamless background |
| 6 | 平铺俯拍 | 实测（Armani 引擎盖平铺概念图） | 3:4 | Flat-lay: {产品} and props arranged top-down on {场景} surface, {主色} palette |
| 7 | 反常识钩子 | 实测·概念钩子（它最核心的一手） | 3:4 | Conceptual twist: {产品} reimagined as {概念} object (surreal scale or context), still premium and believable |
| 8 | 空镜（无产品） | 我们加法（当呼吸页用） | 3:4 | Empty scene: the {概念} world without any product — {场景}, {主色}, {光位} |
| 9 | 字标海报 | 实测·品牌语言（"品牌字样清晰可读"） | 3:4 | Typography lockup: {品牌} wordmark set large over {概念} visual, text rendered exactly as provided, everything else minimal |
| 10 | 手持特写 | 我们加法 | 1:1 | Hand-held close-up: fingers holding {产品}, tactile {材质} feel, face never visible |

**镜头 9 的字标纪律**（照首页 poster 档的既有规则）：**用户填了品牌字标才渲染，且"文字必须原样、不许自己编"**；没填就禁用这一档（不许出"编造品牌名"的图）。

**一条笔记的推荐勾法**（写进页面提示）：1 + 2 + 3 + 4 + 8（5 张起步），爆了再补 5/6/7/10。

## 四、下发提示词的完整拼装（服务端实现口径）

```
[方案前缀]（一次拼好，每张都带）
Visual set direction — keep every image in this set coherent:
Concept: {概念主题}
Palette: {主色名} ({hex}), supporting tones derived from it
Materials: {材质列表}
World: {场景世界观}
Lighting: {光位}
Consistency rules: same palette, same lighting family, same grade across the set;
  premium editorial quality; believable materials; no plastic look;
  {人物规则 → 同时进 negative: no faces / hands only …}
  {禁止项 → negative}
{风格锚有图时} Reference images define the direction evidence; follow their palette,
  lighting and mood; treat them as evidence, not content to copy.

[本张] Shot {n}/{总数} — {镜头模板句}

[用户补充]（可选的单张微调框，默认空）
```

- **negative prompt**：`faces, portrait, logo (unless shot 9), watermark, text artifacts, plastic skin, oversaturated, cluttered composition` + 用户勾的禁止项；
- **比例**：每条镜头自带默认比例，用户可在出图前整体改（3:4 / 1:1 / 9:16 三选）；
- **清晰度**：默认 2K（与站内图片档一致），可在「画面规格」里改；
- **模型**：页面给模型选择（与首页同一份模型目录），默认站内默认图模型；**用 Midjourney 时**额外提示"可用 --sref 锁风格"（只在 MJ 档显示这条提示）。

## 五、预设方案（v2：实测色簇，不是按季节编的）

**做法**：把 Aura 41 张封面**全量**取色（缩 96×96、剔除近纯白/近纯黑后取均值，与
`.tmp/xhs-palette-coherence.mjs` 同一口径），再对 41 个主色做 k-means（k=5）。
产物：`.tmp/xhs-aura-cluster.mjs` → `.tmp/xhs/aura-clusters/covers.json`。

**实测结果：5 个色簇，41 篇全部有归属**（按篇数排序）：

| 簇 | 主色 | 篇数 | 辅色（成员实测） | 备注 |
|---|---|---|---|---|
| 灰调大地 | `#94847A` rgb(148,132,122) | **11/41** | `#8F8E93` 灰蓝 · `#CAB3AE` 裸粉 · `#6B7076` 深灰 | 最高频；低饱和暖灰打底 |
| 海蓝灰雾 | `#8B9EAB` rgb(139,158,171) | **9/41** | `#91B5CB` · `#C8DDE9` 浅天蓝 · `#0A4E71` 深海 | 辅色是明确的天蓝/海蓝 |
| 柔雾浅粉 | `#BDB6BC` rgb(189,182,188) | **8/41** | `#EFD3CF` 雾粉 · `#ABCDD9` 浅蓝灰 · `#E7B5B1` | 高调（浅）、棚拍通透 |
| 暖砂裸粉 | `#BF9A8B` rgb(191,154,139) | **7/41** | `#D7C5AF` 奶咖 · `#F3D1AC` 暖砂 · `#D06F71` 一点胭脂 | 暖调裸色系 |
| 深棕暗红 | `#765149` rgb(118,81,73) | **6/41** | `#88584A` 巧克力棕 · `#8D030F` 勃艮第红 · `#271A15` 近黑 | 低调（深）、暗场戏剧 |

⇒ **预设就用这 5 套**（名字与主色直接取上表），选一组即填好「主色调」字段；
用户仍可自定义色值。v1 那 4 套季节名（夏日海岸 / 秋日粉调 / 新中式清冷 / 节日礼赠）**废掉**，原因是它们
**只对上实测 5 簇里的 2 个**：海蓝 ≈「夏日海岸 / 新中式清冷」，粉 ≈「秋日粉调」；
而**最大的「灰调大地」（11/41）与深色系的「深棕暗红」（6/41）根本没有对应预设** ——
也就是说按 v1 那 4 套选，最常出现的那一类反而选不出来。
（「节日礼赠 正红×鎏金」也不是"没有红"：第 35 篇实测辅色是 `#8D030F` 暗红，
但与它同框的是近黑 `#271A15` 而不是鎏金 —— 红出现过，只是形态是**暗红配近黑**。）

**给"概念主题"预填的示例词**（照抄实测里最常见的立意方式，用户可改）：
海岛假期 / 秋日限定 / 东方留白 / 一场盛夏雨 / 把夏天留在身上 / 落日柔光。
（这些直接从 41 篇标题里取，见 `.tmp/xhs/aura-clusters/covers.json` 的 `title` 字段。）

## 六、单独调整 / 单独设计（回答用户那半句问话）

用户原话：「**或者我需要单独调整，单独设计的话，该怎么样呢**」。三条路径，从"只动一张"到"完全脱离方案"：

### A. 改这一张（方案内微调，不脱离套装）
- 结果墙每一格常驻一颗「**改这一张**」；点开是一个**默认空**的文本框；
- 填进去的内容作为 §四 的 `[用户补充]` **只拼进这一张** —— 不改方案、不影响其它格；
- 填过之后该格显示一个「已单独调整」小标记（否则下次忘了哪张被动过）；
- 存进历史时把这段补充一起存，重出时默认带回来，可清空。

### B. 重出这一张（方案内，换一版）
- 每格「**重出这一张**」＝ 用**同一个方案 + 同一个镜头 + 同一段补充**再出一张（不满意就再摇一次）；
- 走的是既有 `runSlot` 那条路（`regenerateCanvasImage`：**先报价再扣费、必须由用户手势触发**），
  与「只重试失败项」**同一条代码路径** ⇒ 计费、幂等键、失败重试全部复用，**不新增扣费点**；
- 计费口径：一张算一张（模型 × 清晰度），出图前给报价确认，与首页一致；
- 结果墙保留这一格的**历史版本**（可回退到上一张），不让"重出"把满意的那张顶掉。

### C. 看 / 改这一张最终下发的提示词（高级，默认收起）
- 每格可以展开「**这一张要发出去的原话**」：把 §四 拼装后的**最终英文提示词**原样显示出来；
- 旁边允许直接改 —— 改过的这张按**改后的原话**发（方案前缀不再叠加，避免两套指令打架）；
- 这一条是回答"**要用哪些提示词**"最直白的方式：用户看得见、也改得动，不用猜我们在背后发了什么。
- 只读态永远可用（能看），改是可选动作（要看产出对不上预期时才有用）。

### D. 自由单张（完全脱离方案单独设计）
- 同一页给一个「**自由单张**」入口：不套方案前缀、不算镜头，就是一个提示词框 + 上传位；
- 其实就是站内既有的自由创作（`visualCreation` 链路）在子页面里的形态；
- 用途：整篇按方案走，但某一篇想要一张完全不守规矩的封面；
- 计费同上（一张一张算），不新增收费项。

**方案的存取**：存方案**免费**（9 个字段 + 勾选），可命名、可一键载入（这是"一系列笔记同一审美方向"的落点，
也是 Aura 最核心的特征）；预设 5 套一键填充也是免费的。

## 七、结果区与后处理

- 结果墙**按镜头归位**（每格标注镜头名），失败的镜头单独标原因、可单独重出；
- 每格动作：**让它动**（复用已上线的 `/api/motion-still`，本机 ffmpeg、不扣积分）、**下载**、
  **改这一张 / 重出这一张 / 看提示词**（见 §六）；
- **发布前加工程序**（博主亲口说要后期）——第一阶段先给一个「统一加工」按钮：
  对本套全部已出图跑一遍站内已有的 `image.retouch`（图片精修）或 `render_quality`（质感提升），
  **按套同一参数**（这就是"统一 LUT/颗粒"的低配版，先不做自定义 LUT）；
  ⚠️ 精修是**付费 skill**，调用时走它自己的正常计费与确认，不偷偷打包收费。

## 八、计费边界（铁律相关，先说死）

- **方案本身免费**：填方案、勾镜头、存方案、载入预设、看最终提示词都不收钱；
- **只有生图按现有图片档计费**（模型 × 清晰度 × 张数），每次出图前走既有报价确认，**不新增收费项**；
  「重出这一张」＝ 再买一张，同样先报价；
- 「统一加工」调用既有付费 skill，按它的价目与确认流程走；
- 「让它动」不扣积分（已上线的口径不变）。

## 九、实施清单（拍板后照此做 · v2 已把落点核实过）

1. **`src/skills/imageSkills.js`** 加 `image.concept_set`：
   - skill 声明（`board:'image'`、`category:'精品推荐'`、`complexity`、`summary`、`brief`、`availability:'ready'`、
     `visual:'free'`、`history:true`）；
   - ⚠️ **必须带封面计划**，否则门禁直接红（BLOCKING 门禁里两条：① 每个图片 Skill 都要有封面计划、
     模板与色相在白名单里；② 封面统一 4:3）。合法取值来自 `src/skills/coverTemplates.js`：
     模板 `case-3up` / `hero-single` / `poster-style` / `before-after`，色相 `warm` / `soft` / `cool` / `accent` / `neutral`。
     本 skill 建议 `cover: { template: 'case-3up', accent: 'soft' }`（"案例三拼"+柔调，对应柔雾浅粉簇）；
   - `fields` 与「镜头勾选」按 §二 那张表声明（**kind 只能用第 28 行那 9 种**，
     多选用 `segmented + multiple:true` 且**不写 default**，条件字段用 `visibleWhen`；
     现成范例：`image.multi_angle` 的「选择视角（多选）」）。
     **图片侧是声明式的，没有 `imageWorkbenches.js` 这个文件** ——
     布局由既有渲染器按 `kind`/`group` 统一渲染，不新写一套布局组件。
   - 文案字段（`brief`）用 `{{字段key}}` 取值（同文件里 `image.product_suite` 的写法），
     但本 skill 的前缀拼装比 `brief` 复杂（§四 是多段结构 + negative），
     所以拼装器放在 run 构建那一层，`brief` 只留一句给人看的摘要。
2. **`src/skills/skillSources.js`** 加出处登记：
   - 按 v2 的更正，走 **`kind: 'ours'`**，`note` 写明："方案前缀 + 镜头勾选的成套方法是我们的实现；
     参照对象是竞品账号 @Aura 的 41 篇公开笔记（本仓实测：篇内色差 << 篇间、5 个色簇），
     不引用外部配方" —— 这是 `ours` 那一档要求的"说明为什么不需要外部来源"；
   - ⚠️ **不要**照 v1 写 jingzao-image-forge / pushing-creation：全仓只有 v1 提过它们，
     没有仓库地址与 star 数，写成 `repo` 会违反这个文件自己定的规矩（"只登记事实"）。
     **若确实要用它们做出处，先去核实仓库名与当时的 star 数**，再按 `{ kind:'repo', name, repo, stars, ref, note }` 登记。
3. **出图链路**：走既有 `visualCreation` 管道（`IMAGE_PIPELINES` 里那一条：自由创作/海报/封面，
   含参考图、单图同步）→ `/api/generate`；**不加新路由、不加计费**。
   pipeline 的 run 构建在 `src/pages/MediaCreation/index.jsx`（`buildSuiteRun` 一族都在这个文件里）
   与 `src/skills/skillRun.js`；拼装器（方案前缀 + 镜头句 + negative）按 §四 实现。
4. **前端状态**：方案对象（9 字段）+ 已勾镜头 + 结果墙（按镜头归位，含每格的补充/历史版本）。
5. **§六 的四条路径**：改这一张 / 重出这一张 / 看改提示词 / 自由单张。
6. **预设 5 套**（§五）一键填充。
7. **「统一加工」按钮**（调用既有 retouch，走它自己的计费确认）。
8. **结果区接「让它动」**（复用 `generateMotionStill`）。
9. **门禁**（新增断言，别等人肉发现）：新 skill 进出处登记（provenance）、镜头库**默认全不勾**
   （与包含模块同一判定）、镜头 9 在无字标时必须禁用、方案字段为空时前缀里**不许出现空槽位**
   （`Concept: ` 后面是空也算 bug）、「重出这一张」必须与「只重试失败项」走同一条扣费路径（不许新增扣费点）。
10. 全量 `npm run test` → `npm run precommit` → 提交 → 部署 → 生产复验 → RTK。
    ⚠️ 跑 precommit 前先确认**没有别的 e2e 链在跑**（它写死端口 4197，并发会让 `[3/5]` 静默变红，见批 BE 记录）。

## 十、待用户拍板的点（v2：三条 + 一条附）

1. **镜头库这 10 条**够不够？其中 **1/2/3/6/7/9 有实测依据**，**4/5/8/10 是我们的加法** ——
   要不要只先上"有依据的那 6 条"，把加法那 4 条留到后面按需加？
2. **预设 5 套**（§五，实测色簇）对不对味？要不要按你打算做的第一个选题**定制一套**？
   （v1 那 4 套季节名已废，原因见 §五。）
3. 页面名与入口：叫「概念视觉方案」还是别的？放在图片生成板块的哪个位置（精品推荐 / 创意应用）？
4. （附）§六 D「自由单张」要不要做？—— 它与站内自由创作功能重叠，做的话只是"在同一个子页面里省一次跳转"。

---

## 十一、附录：一条**完整拼好的例子**（可以直接照着跑，不用再翻译）

上面 §四 是模板；这一节把模板**填成一条真实的、最终会发出去的原话**，
这样"到底用哪些提示词"是可以逐字看到的。选的是实测最高频的色簇（灰调大地）+ 一个秋日选题。

**表单这么填**：

| 字段 | 填什么 |
|---|---|
| 概念主题 | 秋日限定 |
| 主色调 | 灰调大地 `#94847A`（辅 `#8F8E93` 灰蓝 / `#CAB3AE` 裸粉） |
| 材质关键词 | 陶土、丝绸 |
| 场景世界观 | 米灰石膏台面与干枝 |
| 光位 | 柔光罩拍 |
| 人物规则 | 只出手部 |
| 品牌字标 | （空 ⇒ **镜头 9 自动禁用**） |
| 禁止项 | 无面部、无水印感 |
| 风格锚 | 无 |
| 勾选镜头 | 1 主图 · 2 场景叙事 · 3 静物组合 · 4 细节微距 · 8 空镜（推荐勾法） |

**① 方案前缀（5 张每张都带，只拼一次）**：

```
Visual set direction — keep every image in this set coherent:
Concept: Autumn limited edition
Palette: warm grey earth (#94847A), supporting tones #8F8E93 (grey blue) and #CAB3AE (bare pink)
Materials: terracotta, silk
World: warm grey plaster surface with dried branches
Lighting: softbox studio light
Consistency rules: same palette, same lighting family, same grade across the set;
premium editorial quality; believable materials; no plastic look;
hands only, never show a face
```

**negative（每张都带）**：

```
faces, portrait, logo, watermark, text artifacts, plastic skin, oversaturated, cluttered composition, watermark feel
```

**② 逐张的镜头句（Shot n 那一行）**：

```
Shot 1/5 — Hero product shot: the product as the absolute hero, Autumn limited edition world around it,
warm grey earth palette (#94847A, #8F8E93, #CAB3AE), softbox studio light, terracotta and silk surfaces,
centered with generous negative space

Shot 2/5 — Editorial scene: the product placed inside warm grey plaster surface with dried branches,
a human hand (no face) interacting naturally, warm grey earth palette, softbox studio light

Shot 3/5 — Still-life arrangement: the product grouped with terracotta and dried branches as props,
sculptural composition, warm grey earth palette, softbox studio light

Shot 4/5 — Macro detail: extreme close-up of the product's silk and terracotta surface and craft details,
shallow depth of field

Shot 5/5 — Empty scene: the Autumn limited edition world without any product —
warm grey plaster surface with dried branches, warm grey earth palette, softbox studio light
(used as breathing page)
```

**③ 设置（协议字段，不写进提示词）**：

| 项 | 值 | 说明 |
|---|---|---|
| 比例 | 镜头 1/2/3/5 = `3:4`；镜头 4 = `1:1` | 每条镜头自带默认比例，出图前可整体改（3:4 / 1:1 / 9:16） |
| 清晰度 | `2K` | 与站内图片档一致 |
| 模型 | 站内默认图模型 | 想要更强氛围可换 MJ（页面会显示 `--sref` 锁风格提示） |
| 张数 | **1 张 / 次** | 勾了 5 个镜头 = 点 5 次（或排队），不是一次 5 张 |

**④ 上面这条例子如果单独调**（对应 §六）：
- 第 3 张想换构图 → 「改这一张」填 `switch to a low three-quarter angle, deeper shadows`，
  这一句只进第 3 张的 `[用户补充]`，其它 4 张不受影响；
- 第 1 张不满意 → 「重出这一张」（同方案同镜头再摇一次，先报价再扣费，旧版可回退）；
- 想确认我们到底发了什么 → 「这一张要发出去的原话」里就是上面那段，**可看可改**。

