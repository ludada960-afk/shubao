# 77 · 「概念视觉方案」skill：字段、镜头与提示词配方（设计稿）

> 用户需求（2026-09-24 原话归纳）：
> 「他们每天发的不同一篇图文，很可能每一篇都有自己的一套风格和设计方向……每一篇都有一个很可控的方向，
> 在同样的审美方向下生成内容」＋「有没有人开源了方法论？或者我们用什么办法做到和他一样」＋
> 「**你把方案和提示词和设置这些东西都帮我想好了吗？继续啊**」
>
> 上一轮已验证：① Aura 篇内色差显著小于篇间（A 型 5.11×，B 型 1.19×）；② 他本人确认用 MJ +
> 「需要自己后期，不要直发」+「一整套没有单一提示词」；③ 开源里最可抄的是
> jingzao-image-forge 的 `visual_generation_spec`（palette / tone_locks / continuity_locks /
> allowed_variation / constraints）与 pushing-creation 的「风格块 + 镜头表」形态。
>
> 这一篇就是**实施设计稿**：字段、镜头库、提示词模板、默认值、UI 形态、计费边界。
> 用户拍板后照此实施。

---

## 一、形态：一条新 skill「概念视觉方案」（`image.concept_set`）

**不是**「一次出 9 张」（用户已否掉 xhs_note 那种一次 9 张：不好控制每张内容），
而是：**一份方案 + 勾选镜头 → 逐张生成，每张 = 方案前缀 + 镜头句**。

- 一次只出**一张**（与首页图片生成同一条生成链路、同一种计费），
  但**方案是持久的**：本次会话里勾 6 个镜头就点 6 次（或排队连出），**每一张自动带同一套前缀**；
- 页面分两栏：左栏 = 方案表单 + 镜头勾选；右栏 = 已出图的结果墙（按镜头归位）+「让它动」。

## 二、方案表单（7 个维度 → 9 个输入位）

照 jingzao 的字段精神，但压缩成**用户真的会填的粒度**。⭐ = 必填，其余可留空（留空的维度不进前缀）。

| # | 字段 | 表单形态 | 默认 | 进前缀的方式 |
|---|---|---|---|---|
| 1 | ⭐**概念主题** | 单行文本 | 空 | `Concept: {v}` —— 整套图的"一句话方向" |
| 2 | ⭐**主色调** | 色板选择（预设 8 组 + 自定义色值） | 暖砂金 | `Palette: {swatch names + hex}` |
| 3 | **材质关键词** | 多选 chips：磨砂玻璃/金属/皮革/丝绸/陶土/石材/亚克力/鲜花/水果 | 空 | `Materials: {v}` |
| 4 | **场景世界观** | 单行文本（如"海边礁石与白沙""粉色摄影棚"） | 空 | `World: {v}` |
| 5 | **光位** | 单选：柔光罩拍 / 硬日光 / 逆光光斑 / 影棚戏剧光 / 黄昏暖光 | 柔光罩拍 | `Lighting: {v}` |
| 6 | **人物规则** | 单选：只出手部 / 手与身体局部 / 允许背影侧影 / 无人物 | 只出手部 | `People rule: {v}` —— 硬约束，进 negative |
| 7 | **品牌字标** | 单行文本（可空；填了才渲染字标） | 空 | 字标规则见镜头库第 9 号 |
| 8 | **禁止项** | 多选 chips：无面部 / 无文字 / 无 logo / 无手 / 无水印感 | 无面部 | 进 negative prompt |
| 9 | **风格锚** | 上传 1~3 张参考图（可选） | 无 | 走**参考图通道**（对应 jingzao 的 reference-profile） |

**与参考图的关系（关键设计，照抄 jingzao 的互斥通道）**：
- 「风格锚」参考图 = **这一篇的方向证据**（拼进每次请求的参考图位）；
- 方案字段 = **这一篇的可复用规则**（拼进提示词前缀）；
- 两者**分开渲染、分开标注**，不让"像这张图"和"守这套规则"互相打架。

## 三、镜头库（勾选制，默认全不勾 —— 复用「包含模块」已上线的判定）

每条镜头 = **一个模板句**，出图时拼成 `方案前缀 + 镜头句 + 比例`。模板里的 `{品牌}` `{产品}` `{概念}` `{主色}` 引用表单值。

| # | 镜头 | 模板句（中文写给用户的说明 / 实际下发为英文） | 默认比例 |
|---|---|---|---|
| 1 | ⭐ 主图 | Hero product shot: {产品} as the absolute hero, {概念} world around it, {主色} palette, {光位}, {材质} surfaces, centered with generous negative space | 3:4 |
| 2 | 场景叙事 | Editorial scene: {产品} placed inside {场景}, a human hand (no face) interacting naturally, {主色} palette, {光位} | 3:4 |
| 3 | 静物组合 | Still-life arrangement: {产品} grouped with {道具}suggesting props, sculptural composition, {主色}, {光位} | 3:4 |
| 4 | 细节微距 | Macro detail: extreme close-up of {产品}'s {材质} surface and craft details, shallow depth of field | 1:1 |
| 5 | 悬浮/失重 | Levitation shot: {产品} floating with {道具} elements orbiting, {主色} seamless background | 3:4 |
| 6 | 平铺俯拍 | Flat-lay: {产品} and props arranged top-down on {场景} surface, {主色} palette | 3:4 |
| 7 | 反常识钩子 | Conceptual twist: {产品} reimagined as {概念} object (surreal scale or context), still premium and believable | 3:4 |
| 8 | 空镜（无产品） | Empty scene: the {概念} world without any product — {场景}, {主色}, {光位} (used as breathing page) | 3:4 |
| 9 | 字标海报 | Typography lockup: {品牌} wordmark set large over {概念} visual, text rendered exactly as provided, everything else minimal | 3:4 |
| 10 | 手持特写 | In-hand close-up: fingers holding {产品}, tactile {材质} feel, face never visible | 1:1 |

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

## 五、默认预设（让用户第一次打开就能出片）

预置 4 套「方案模板」（一键填充表单，用户再改）：

| 模板 | 概念示例 | 主色 | 材质 | 场景 | 光位 |
|---|---|---|---|---|---|
| 夏日海岸 | 海岛假期 | 海蓝×柑橘橘×沙白 | 玻璃、柑橘、白沙 | 礁石与海浪 | 硬日光 |
| 秋日粉调 | 秋日限定 | 玫瑰粉×奶咖 | 丝绸、鲜花、哑光陶瓷 | 粉白摄影棚 | 柔光+光斑 |
| 新中式清冷 | 东方留白 | 黛青×宣纸白 | 陶土、宣纸、枝条 | 留白中式场景 | 侧逆柔光 |
| 节日礼赠 | 七夕心意 | 正红×鎏金 | 缎带、礼盒、金属 | 礼盒静物台 | 影棚戏剧光 |

（这四套就是 Aura 41 条里出现频次最高的四个季节色调簇。）

## 六、结果区与后处理

- 结果墙**按镜头归位**（每格标注镜头名），失败的镜头单独标原因、可单独重出；
- 每格两个动作：**让它动**（复用已上线的 `/api/motion-still`，本机 ffmpeg、不扣积分）、**下载**；
- **发布前加工程序**（博主亲口说要后期）——第一阶段先给一个「统一加工」按钮：
  对本套全部已出图跑一遍站内已有的 `image.retouch`（图片精修）或 `render_quality`（质感提升），
  **按套同一参数**（这就是"统一 LUT/颗粒"的低配版，先不做自定义 LUT）；
  ⚠️ 精修是**付费 skill**，调用时走它自己的正常计费与确认，不偷偷打包收费。

## 七、计费边界（铁律相关，先说死）

- **方案本身免费**：填方案、勾镜头、存方案都不收钱；
- **只有生图按现有图片档计费**（模型 × 清晰度 × 张数），每次出图前走既有报价确认，**不新增收费项**；
- 「统一加工」调用既有付费 skill，按它的价目与确认流程走；
- 「让它动」不扣积分（已上线的口径不变）。

## 八、实施清单（拍板后照此做）

1. `src/skills/imageSkills.js` 加 `image.concept_set`（skill 声明 + 出处登记：自有玩法，
   方法论参照 jingzao/pushing-creation，写 sourceNote）；
2. `src/skills/imageWorkbenches.js`（或图片侧对应工作台声明处）加两栏布局：方案表单 + 镜头勾选；
3. 前端状态：方案对象（9 字段）+ 已勾镜头 + 已出图结果墙（按镜头归位）；
4. 服务端：拼装器（方案前缀 + 镜头句），走既有 `/api/generate`（visual 链路），
   negative prompt 按第六节拼；**不加新路由、不加计费**；
5. 预设 4 套模板（第五节）做成一键填充；
6. 「统一加工」按钮（调用既有 retouch，走它自己的计费确认）；
7. 结果区接「让它动」；
8. 门禁：新 skill 进出处登记（provenance）、镜头库**默认全不勾**（与包含模块同一判定）、
   镜头 9 在无字标时必须禁用、方案字段为空时前缀里**不许出现空槽位**（"Concept: " 后面是空也算 bug）；
9. 全量 test → precommit → 提交 → 部署 → 生产复验 → RTK（批 AZ）。

## 九、待用户拍板的三个点

1. **镜头库这 10 条**够不够？要加/删哪些（比如要不要"模特全身不露脸"这一档）？
2. **预设 4 套模板**对不对味？要不要按你打算做的第一个选题定制一套？
3. 页面名与入口位置：叫「概念视觉方案」放在图片生成板块哪个位置（精品推荐 / 创意应用）？
