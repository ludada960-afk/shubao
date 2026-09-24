# 2026-09-25 · 艺术指导 / 内容体系 调研摘要（四路并行）

> 用途：给 `docs/design/78-content-system-and-art-direction.md` 做证据底座。
> **证据分级**：(a) 官方文档/法规原文/学术文献；(b) 从业者方法或媒体转述；(c) 调研者的推断。
> 凡"未能验证"的条目**单列在文末**，不要当事实使用。
>
> ⚠️ 本次调研环境有网络限制，调研者已逐一说明可达性：通用搜索引擎（Google/DuckDuckGo/Brave）
> 多数不可达；Wikipedia 本体、adage.com、docs.midjourney.com、platform.openai.com、Reddit、知乎、
> HuggingFace 等站点 403/超时。因此 **Midjourney 参数细节来自镜像站与中文技术博客（二手）**，
> 其余以官方文档站（fal / docs.bfl.ml / docs.comfy.org / experienceleague.adobe.com / recraft.ai /
> cms.gov.cn 等）为一手来源。

---

## 一、广告业的艺术指导体系（创意流程 / KV / 视觉识别）

### 1.1 流程与产物（(a) 文献支持）

| 阶段 | 产物 | 来源 |
|---|---|---|
| 客户需求 | client brief | [Creative brief — Wikipedia 镜像](https://everything.explained.today/Creative_brief/) |
| 研究/洞察 | insight、value proposition | [Account planning](https://everything.explained.today/Account_planning/) |
| 策略固化 | **creative brief**（含 Single message / Tone of voice / Mandatories / Deliverables） | 同上 Creative brief |
| 概念 | big idea / concept platform / campaign theme | [Art director](https://everything.explained.today/Art_director/) · [Advertising campaign](https://everything.explained.today/Advertising_campaign/) |
| 视觉定义 | **key visual / key art（单张奠基图）** | [Key visual](https://everything.explained.today/Key_visual/) |
| 风格定义 | moodboard、art direction、style guide | 见 1.2 / 1.3 |
| 规模化 | adaptation / 延展 | 定义有出处，**具体操作规范未找到权威文档**（见文末） |

**可直接抄的两句关键定义**：
- creative brief 必须同时是 **directional（营销约束）+ inspirational（语气与感觉）**：
  "A creative brief must be directional and inspirational."（同上）
- campaign 就是 **"a series of advertisement messages that share a single idea and theme"**，
  其 **campaign theme** "sets the motif for the series of individual advertisements"。
  ⇒ **这就是"恒定层 / 可变层"分离的文献依据**：主题恒定，单条只是 series 里的一个 instance。

**creative brief 的标准字段清单**（可直接当输入 schema）：
Background / Target audience（他们现在怎么想、要避免什么）/ Key insight / Objectives /
**Single message** / Desired customer behavior / **Tone of voice** / **Mandatories**（强制元素：logo 等）/
Deliverables / Timeline（含几轮 revision）/ Budget / Approvals。

**Account planning（专门生产 insight 的职能）的纪律**：**"planning truly begins when research ends"**
—— 洞察不是数据摘要，是从数据里提炼出**关于人的判断**。人物可溯源：Stanley Pollitt、
**Stephen King**（JWT）、**Tony Stead**（"account planning" 命名者）、Jane Newman（美国首个部门，Chiat\Day 1982）。

### 1.2 KV / 主视觉（(a)）

- **定义**：key art = "the artwork which is **repeated across media**"（海报/印刷/电视/数字/缩略图/包装）。
- **记协（The Hollywood Reporter）的 campaign 级表述**：key art 是
  "the **singular, iconographic image** that is the foundation upon which a movie's marketing campaign is built"。
- 媒介形态规则：电视 KV 横向（16:9），游戏 KV 产出更早（还兼作内部对齐工具）。
- KPI 参考：Netflix 称其研究显示人们注视 key art 约 **1.8 秒**，且它是影响是否点开的最大因素。
- 中文业界把这条链叫 **主视觉 / KV / 延展**（只核到标题级证据，未读正文）。

### 1.3 视觉识别 / 一致性（(a)）

- **corporate visual identity** 的成文内容：logo 与 supporting devices 之外，汇编成
  **corporate guidelines** —— "usually include **approved color palettes, typefaces, page layouts, fonts**"。
- **四条品牌要求**：Differentiation / Relevance / **Coherence** / Esteem；Coherence 的定义是
  "All the messages, all the marketing communication, all the brand experiences ... need to
  **hang together and add up to something meaningful**"。
- **style guide 是级联结构**：项目级 style sheet → 组织级 house style → 行业级 manual。
  ⇒ 可直接映射成我们的资产分层（本篇 / 账号 / 平台惯例）。

### 1.4 网格系统：唯一的经典"结构恒定 / 内容可变"实现（(a)）

- 网格的定义：**"armature or framework"**，诞生动因就是"a flexible system able to help designers
  achieve **coherency**"；经典出处 **Müller-Brockmann《Grid systems in graphic design》**，
  源头 Tschichold《Die neue Typographie》，关联 International Typographic Style。
- ⚠️ 该条目也记录了反弹：1980 年代起对"网格教条化"的反动，今天网格是
  "a useful tool for some projects, **not as a requirement or starting point for all page design**"。

### 1.5 differentiation vs distinctiveness（**最重要的一条纠偏**）(a)

- 来源：[Ehrenberg-Bass Institute](https://marketingscience.info/news-and-insights/differentiation-versus-distinctiveness)、
  [distinctive assets](https://marketingscience.info/news-and-insights/branding-bananas-leveraging-distinctive-assets)。
- **differentiation 讲产品/服务特征**；**distinctiveness 讲"让品牌被轻易认出"**
  （"Brand names, logos, jingles, slogans and **house styles** contribute to this — 例：McDonald's 的黄色 M"）。
- **distinctive assets 的成文定义**："devices, aside from the brand name, that help identify a brand ...
  can be **colors, graphics, shapes, or anything else** that identifies it"，且**要长期不变**。
- **Tropicana 反例**：移除"带吸管的大橙子 + 强烈橙色"两个识别装置，首季销量跌 **20%（约 3300 万美元）**，
  原因是购物者"**找不到**"，不是情感。（转述自 AMA 专栏，机构背书但非同行评议。）
- 溯源：**Byron Sharp《How Brands Grow》(2010) 第 8 章**；配 **category entry points → mental availability → salience**。

### 1.6 创意想法从哪来：具名 ideation 方法论（(a)）

| 方法 | 机制 | 出处 |
|---|---|---|
| **SCAMPER** | 7 个显式算子：Substitute / Combine / Adjust / Modify(magnify·minify) / Put to other uses / Eliminate / Reverse | Bob Eberle 1971，受 Osborn《Applied Imagination》启发 · [来源](https://everything.explained.today/SCAMPER/) |
| **CPS（Osborn–Parnes）** | **分离发散与收敛两种思维** —— 先创造、后评估 | [Creative problem solving](https://everything.explained.today/Creative_problem_solving/) |
| **Bisociation** | "a blending of elements drawn from **two previously unrelated matrices of thought** into a new matrix of meaning"；**艺术领域是两个母体"held in juxtaposition"** | Koestler《The Act of Creation》1964 · [来源](https://everything.explained.today/Bisociation/) |
| **Synectics** | "**making the familiar strange and the strange familiar**"、"Trust things that are alien, and alienate things that are trusted"；有 springboarding 与 Idea Development 两步 | Gordon & Prince，Arthur D. Little 1950s · [来源](https://everything.explained.today/Synectics/) |
| **General Morphological Analysis** | "a method for **exploring all possible solutions** to a multi-dimensional, non-quantified problem" | [来源](https://everything.explained.today/Morphological_analysis/)（正文很薄，仅一句定义） |
| 其它具名 | TRIZ（含 contradiction matrix）/ Lateral thinking / Six Thinking Hats（de Bono）/ Brainstorming（Osborn）/ Brainwriting / bodystorming（Gijs van Wulfen） | [Creativity techniques](https://everything.explained.today/Creativity_techniques/) · [Ideation](https://everything.explained.today/Ideation_(creative_process)) |

**brainstorming 的 7 条规则**（可直接当"批量出创意"的流程约束，来源 IxDF
[ideation 方法](https://www.interaction-design.org/literature/article/learn-how-to-use-the-best-ideation-methods-brainstorming-braindumping-brainwriting-and-brainwalking)）：
① 设时限（15–60 分钟）；② 从 problem statement / "How Might We" 出发并保持聚焦；③ **延迟判断**；
④ 鼓励荒诞（Osborn："It is easier to tone down a wild idea than to think up a new one"）；
⑤ **追求数量**（"quantity breeds quality"）；⑥ 在彼此想法上叠加；⑦ **可视化**。

**视觉元素/原则的成文清单**（同上 IxDF 引 Hashimoto & Clayton）：
7 元素 = line / shape / negative space / volume / value / colour / texture；
8 原则 = unity / gestalt / hierarchy / balance / contrast / scale / dominance / similarity。
可直接当"签名规范"的维度表。
**value（明暗）的规则**：高对比 → 清晰感；相近明度 → 微妙感。

**art director 的学科定义**（(a)）："**translating desired moods, messages, concepts, and
underdeveloped ideas into imagery**"，并"solidifying the vision of the collective imagination while
resolving conflicting agendas and inconsistencies"；**不必会手绘**（条目明确说）。
术语由 **Wilfred Buckland 1914 年首用**；双人组（art director + copywriter）由 **DDB 的 Bill Bernbach 首创**。

---

## 二、AI 出图「系列一致性 + 刻意变化」的实战机制

### 2.1 三种"风格承载"，本质是把风格从文本搬到更强载体（(a)/(b)）

| 机制 | 精确写法 / 参数 | 限制 | 来源 |
|---|---|---|---|
| MJ 风格参考 `--sref` | `--sref <url>`；多张 `--sref a b c`；权重 `::`（0–100）；**也支持纯数字风格码** | 只控风格不控身份；"契合度并不会达到 100%" | chloevolution / uisdc / CSDN（**二手**） |
| MJ 风格权重 `--sw` | 默认 100，范围 0–1000 | **<15–20 基本无效；>700 易变形** | 同上（二手） |
| MJ 情绪板 Moodboards | 具名图集 = 一个"风格"，有唯一 ID，用时生成 code | **一改就生成新 code**；**与 `--sw`/`--sv` 不兼容** | docs.midjourney.com（**官方，经代理读取**） |
| MJ 角色参考 `--cref` + `--cw` | `--cw 0` 只关注脸（可换装） | 参数须放提示词最后 | CSDN/360 检索（二手） |
| MJ Style Creator | 样图网格里反复挑图 → 生成新 `--sref` code | "Most styles stabilize after 5–10 rounds"；**"Each set of preview images uses your GPU time"** | docs.midjourney.com（官方） |
| MJ 官方 API | **无官方 API** | 程序化批量只能第三方或人工 | 二手 |
| 本地 IP-Adapter | `weight`（默认 1.0，-1~5）、`weight_type`（**15 种枚举**）、`start_at/end_at`、`embeds_scaling` | README 建议 `weight ≤ 0.8`；仓库 2025-04 起仅维护 | [IPAdapterPlus.py](https://raw.githubusercontent.com/cubiq/ComfyUI_IPAdapter_plus/main/IPAdapterPlus.py)（官方源码） |
| StyleAligned | **attention sharing**，一次 inversion 取参考风格，**无需微调** | — | [arXiv 2312.02133](https://arxiv.org/abs/2312.02133) |
| LoRA 训练 | Replicate：**12–20 张图**、steps 起 1000、约 **$1.85**、20–30 分钟 | 产物是权重，不可移植 | [replicate.com/blog/fine-tune-flux](https://replicate.com/blog/fine-tune-flux) |
| 托管多图条件 | gpt-image-2.5 `image_urls` **最多 16 张**；nano-banana-pro **14 图 / 5 人**；Kontext pro 输入+输出合计 **9MP**；Qwen 节点 **10 张带角色槽**（"Character, product, background plate, style reference"） | — | fal.ai / docs.bfl.ml / blog.comfy.org（官方） |

### 2.2 刻意变化：**必须显式枚举，且所有成熟工具都配了上限**（(a)）

- **MJ 排列提示词**：`{}` 内逗号分隔备选，**可对提示词任意部分做组合排列**。
- **A1111 X/Y/Z plot + Prompt matrix**：Prompt matrix 用 `|` 分隔，**为每个组合各出一张且共享同一 seed**；
  另有 **Prompt S/R**（搜索替换）与 **Variation seed + strength**。
- **sd-dynamic-prompts**（组合枚举的事实标准语法）：`{a|b|c}`、`{2$$a|b|c}`、`__wildcard__`、
  **Combinatorial generation**（生成每一种可能组合）；**`Max Generations` 上限**防"意外产出上千张图"。
- **ComfyUI Impact Pack**：`ImpactWildcardProcessor` 等，`__wildcard__` / `{a|b|c}`，
  有 **populate（每次重新组合）/ fixed** 两种模式。
- **One Button Prompt**：`Insanity level`、`Overwrite subject`（"create unlimited variants of a subject"）；
  **关键区别：batch 数 = 每张一个新 prompt，batch size = 复用同一 prompt**。
- **概念层枚举（开源 UPG 项目）**：slot 系统 S1–S5（anchor / contrast / adjacent / oblique / absence）
  + 8 个创作透镜（PHOTO / CINE / TEXTURAL / PAINT / ENV / SYMBOLIC / MINIMAL / SENSORY）；
  含 **BAN REGISTRY**（禁用 "soft/subtle/elegant"、"essence/harmony"，理由是会把 prompt 稀释成
  "stock-photo mush"）与 **Ring Test**（防某个 slot 塌回上一个）。
  ⚠️ 但另一路调研**在 GitHub 上搜不到这个项目**（见文末未验证项）。

### 2.3 "提示词 = 美术指导"的块化写法（(a) 官方模板）

- **BFL 官方注解模板**（直接拼在场景描述后，可得到 "consistent aesthetics"）：
  `[Scene description]. Style: Country chic meets luxury lifestyle editorial. Mood: Serene, romantic, grounded.`
  `[Scene description]. Shot on 35mm film (Kodak Portra 400) with shallow depth of field ...`
  → [docs.bfl.ml/guides/prompting_unified_style.md](https://docs.bfl.ml/guides/prompting_unified_style.md)
- **BFL 多参考的角色声明**（**按位置引用**："image 1"、"image 2"，并要求"describe the role of each image"）
  → [docs.bfl.ml multi_reference](https://docs.bfl.ml/guides/prompting_editing_multi_reference.md)
- **"look sheet" 的工程规范**（最完整的一份实现说明）：session 级 look sheet，
  内容规格 **60–120 词、现在时、不含动作与镜头**，覆盖 medium/material、palette、light grammar；
  **注入顺序固定**为 `rules → "Established look:" → 之前的 directions → 最新 direction`；
  更新策略是**派生一次后不再自动重派生**。
  → [github.com/joshcoolman/genzen/issues/633](https://github.com/joshcoolman/genzen/issues/633)

### 2.4 提示词的字段结构（4 套差异明显的 schema，可抄）

| # | 名称 | 字段与顺序 | 来源 |
|---|---|---|---|
| A | FLUX 官方基础结构 | `[SUBJECT],[LOCATION],[STYLE],[CAMERA SETTINGS],[LIGHTING],[COLORS],[EFFECT],[ADDITIONAL ELEMENTS]`（官方强调"a useful starting structure, **not a strict formula**"） | [docs.bfl.ml](https://docs.bfl.ml/guides/prompting_unified_basics.md) |
| B | GPT Image 2.5 分块法 | `PURPOSE → SUBJECT → MATERIALS → LIGHT → CAMERA AND FRAME → EXCLUDE`；官方："blocks 赢在**可维护性**" | [fal.ai](https://fal.ai/learn/tools/how-to-use-gpt-image-2-5) |
| C | 中文通用 10 段 | 主体→动作→场景→构图→视觉风格→光线→色彩→镜头与效果→细节→限制 | CSDN |
| D | "AI 导演"分镜 schema | 景别/视角/构图/核心主体/情绪动作/场景/艺术风格/氛围光线/色调 + 运镜语言 | 腾讯新闻 |

**共识**：几乎所有 schema 都把"**光线 / 镜头 / 排除项**"独立成段
（BFL 称 lighting 对产出质量"greatest single impact"）。

### 2.5 用 LLM 生成"概念"（美术指导用法）

- **meta-prompting**（OpenAI cookbook 官方范式）：用强模型改写提示词再交给便宜模型执行，
  以 "**Only return the prompt**" 收尾。
- **产品化流水线**：**Treatment → Style Bible → Shotlist → Storyboard**，
  其中 Style Bible 含 color palettes / lighting rules / camera grammar（来源 magigenai.com）。
- **中文侧的"多套方案"实例**（原文形态）："……套方案，每套包含海报主标题、副标题、简短 slogan、
  画面构图描述、配色建议。**不要图片，只输出文字方案**"。
- **让图像模型自己当分镜师**（Seedream 实测提示词）："分析这张图片，推测并创作一个可能导致该场景的
  事件时间线。以电影分镜方式……制作成 9 格分镜网格"。

### 2.6 失败模式（都有出处，是我们做产品时要防的）

1. **系列越长越飘**：链式只用上一镜末帧 → "**beat 4 is four reinterpretations from beat 1**"。
   对策：**每张重新注入 look sheet**。（genzen issue 633）
2. **参考图过强 → 内容泄漏 / 主体迁移**：IPAdapter issue 原话
   "**I just want to copy the paint style not the bunny keyword**"；中文叫"风格污染/内容泄漏"。
   对策：用专用 `weight_type` 或风格/结构双通道。
3. **权重过头直接坏图**：`--sw > 700` 易变形；IPAdapter 建议 `weight ≤ 0.8`。
4. **参考图把"打光"冻成"解剖"**：做 turnaround 表要用"even, shadowless studio light against a
   neutral grey background"，否则下游模型"**treat that pattern as anatomy**"。
5. **左右不可靠**："**left and right are the least dependable instructions**"。
6. **参考槽位语义搞反**：Ideogram 把 `reference_image_urls`（角色）与 `image_urls`（风格）弄反
   → "wearing somebody else's face"。
7. **长前缀被稀释**：主体必须前置、一次只改一处。
8. **模板化 → 千篇一律**：UPG 的显式表述（禁用 "soft/subtle/elegant"）+
   中文生态里大量"万能提示词模板"本身就是同质化来源。
9. **一致性有天花板**：`--sref` 官方口径"契合度并不会达到 100%"；Nano Banana 官方
   "may not be 100% reliable"。
10. **模型自带偏差**：gpt-image-1 "always add a distinctive yellow tint" 且身份频繁变化；
    Kontext Pro 面部 artifact 常致废图；Runway Gen-4 **不能**用于整体重风格化。
11. **枚举会失控**：sd-dynamic-prompts 必须配 `Max Generations`。
12. **大批量 QA 要成流程**：真实 issue 里能看到"check all 1,100 images for style drift and
    prompt artifacts"，检查项含 "Style inconsistency across the set"。

**另一条值得注意的产品化信号**：有实测文章写"**即梦生图有个很鸡肋的地方，就是不能生宫格图，
每次只能一张一张图出**" —— 说明"一次出一套"在中文产品里也是被用户明确点名的缺口。

---

## 三、内容账号的选题与运营（自媒体视角）

### 3.1 选题库：中文内容运营里唯一被普遍标准化的第一步（(b)）

- 被反复复制的量化公式：**爆款 = 50% 选题 + 20% 标题封面 + 20% 文案 + 10% 其他**；
  "凡是能做到小红书稳定起号的，**前三天都不写内容，只干一件事 —— 建选题库**"。
  来源：青瓜传媒（作者 且行舟）https://www.opp2.com/386067.html
- **入库标准三原则**：① 站在用户视角（写不出"帮用户解决了什么具体问题"就不做）；
  ② 受众要广泛（核心关键词搜索**低于 1 万篇慎选、高于 10 万篇说明受众够大**）；
  ③ **追热度上涨期**（优先 30 天内上升的；找到方向后**连续输出 10 条**吃红利）。
- **判断价值看比例不看绝对值**：收藏率（收藏/点赞）、评论率、分享率。
- **三库一体**：标题库 + 文案库 + 对标库。

### 3.2 对标拆解：最容易被做错的一条（(b)）

**正确用法不是抄最火那篇，而是找"超出对标自身平均水平的入池选题"**：
"平时平均 10 个赞，突然一篇 42 个赞，说明这个选题在他的账号里测试出了流量，是一个**入池选题**，
可以直接拿来用"；做法是**翻最近 30 篇算平均点赞，把高于平均 2 倍以上的选题全部记下**。
对标数量 4–5 个（另一说 5–10 个），六维拆解：人设/内容/选题/爆款/粉丝/变现。同上来源。

### 3.3 原创选题的最强来源：货架差评区（(b)）

- 方法论是**冲突营销**（作者点名叶茂中冲突营销理论）三层：**发现冲突 / 解决冲突 / 制造冲突**。
- 四步操作：① 找同品类卖得好但仍有部分不满的产品；② **中差评 + 追评 + 问大家放在一起看**；
  ③ 按问题分类（产品效果/使用体验/适用人群/使用场景/预期落差）；④ 回小红书验证冲突是否成立。
- **底层判断（最关键）**："高赞笔记拆解已经**没有信息差**"（竞品、服务商、达人甚至 AI 都在拆同样的
  笔记，导致同质化严重）；**差评区给你的是"一个还没有被解决的问题"，爆文库给你的是"一篇已经写完的内容"**。
  来源：https://www.opp2.com/386115.html

### 3.4 关键词选题与一个重要的失效信号（(b)）

- 搜索下拉词法：收前 10 个下拉词；实操路径 `搜索关键词 → 全部 → 最多点赞 → 图文 → 一周之内`，
  每周 30 分钟筛 20 篇高赞存库。长尾词法：核心词拓展 ≥20 个。
- ⚠️ **2026-09 从业者公开宣称"小红书笔记埋词打法正式失效"**：过去"关键词分配到不同笔记、
  标题埋词"的做法不再有效，搜索算法已升级。https://www.opp2.com/386069.html
- ⚠️ **千瓜用户协议明令禁止公开披露/传播其预估数据**，所以"千瓜公开报告"里的预估数据
  **不能作为对外可引用来源**。https://www.qian-gua.com/report

### 3.5 系列化 / 栏目化（(b)）

- 栏目概念借用自电视台（"栏目是每天播出的相对独立的信息单元"）；**作用**是
  "让用户形成稳定预期"；要素 = 固定几个精品栏目 + **固定命名** + **固定更新频次** + 合集沉淀。
- **最值得抄的形态**：带序号的**固定句式**连载（如"实名……第多少天"），
  拆解出的三个作用：类比定位（借熟悉的品牌做参照锚点）、实名画面提供公开承诺暗示、
  **"第多少天"让栏目自带连续性**（作者不必每期重想开场，且每篇都是主页入口）。
  https://www.opp2.com/386378.html
- **"一个账号跑几个栏目"没有权威数字**；能拿到的从业者建议是"测试 3–5 个不同内容方向"再收敛，
  反面清单是"不要大杂烩，今天美食明天美妆后天职场"。
- **内容配比**（起号建议）：前 20 篇 **70% 做痛点/干货/测评，30% 再植入商业内容**。

### 3.6 日常产出 SOP（(b)，可直接当骨架）

八阶段：账号定位与主页搭建 → 选题库 → 笔记标准化生产 → 发布前合规自检 → 发布与冷启动 →
日常运维 → 数据复盘（日/周/月）→ 商业内容运营。
关键细节：
- **更新频率口径**："**稳定大于数量**，每周 3–4 篇优于断断续续日更，不要一天狂发 5–6 篇，
  容易被判定机器批量操作"。
- **发布后 0–24h**：前 1 小时重点盯评论并及时回复；**不要频繁删除、反复编辑刚发布的笔记**；
  发布半天后搜索核心关键词**检查是否被收录**。
- **冷启动诊断表**：点击率低→改封面标题；点开就划走→开头钩子弱；阅读高收藏少→缺干货价值；
  阅读高评论少→结尾缺互动引导。
- **三阶段复盘**：单篇（24–48h）× 周（固定 30 分钟：拆最好 2–3 篇 + 统计搜索收录率 + 更新选题库）×
  月（看哪类选题持续好→加大产出；沉淀封面模板、标题公式、爆款选题库）。
https://www.opp2.com/386131.html

### 3.7 商业化（(b)，报价类数字均为经验值且互相矛盾）

- **商单链路**：达人筛选 → 输出 Brief → 初稿审核 → **平台报备发布** → 冷跑 24h → 数据归档。
- Brief 要写清**产品卖点、禁止的功效话术、笔记场景、避雷点、交付时间**；有的还写"禁止抄袭其他达人笔记"。
- **品牌方可在蒲公英勾选"笔记审核"权限**；**所有商业合作笔记必须走蒲公英报备**
  （私下置换不报备，后续无法投流且有处罚风险）。
- **接单门槛**：入驻蒲公英，千粉可申请；企业蓝 V 专业号 600 元/年。
- **报价两套口径互相矛盾**（都是公众号经验值）：`粉丝量 × 0.1–0.3` 与 `粉丝量的 5–8%`。
  ⚠️ 不要当定价依据。

### 3.8 合规（法规条文为 (a)，但调研者未能打开官方原文页，属高置信转引）

- **《人工智能生成合成内容标识办法》**（国信办、工信部、公安部、广电总局；
  国信办通字〔2025〕2 号；**2025-09-01 施行**）——**原文已核到**：
  [cac.gov.cn](https://www.cac.gov.cn/2025-03/14/c_1743654684782215.htm)
  - 第三条：标识分**显式标识**（用户可明显感知）与**隐式标识**（文件数据中）。
  - 第四条：显式标识要求 —— "（三）在**图片的适当位置添加显著的提示标识**"。
  - 第五条：应在**文件元数据**中添加隐式标识（内容属性、服务提供者名称或编码、内容编号）。
  - 第六条：**传播平台**义务 —— 核验元数据、对疑似生成内容加提示标识、必须提供标识功能并提醒用户声明。
  - 第十条：`用户……发布生成合成内容的，应当主动声明并使用服务提供者提供的标识功能进行标识`；
    `任何组织和个人不得恶意删除、篡改、伪造、隐匿……标识`。
  - 第九条：可申请不含显式标识，但要以用户协议承接标识义务，且**平台留存日志不少于六个月**。
- **强制国标 GB 45438-2025《网络安全技术 人工智能生成合成内容标识方法》**：
  **强标 / 现行 / 发布 2025-02-28 / 实施 2025-09-01**。
  [国家标准全文公开系统](https://openstd.samr.gov.cn/bzgk/gb/std_list?p.p1=0&p.p90=circulation_date&p.p91=desc&p.p2=45438)
- **广告可识别性**：《广告法》第十四条 + 《互联网广告管理办法》第九条第三款
  （通过**知识介绍、体验分享、消费测评**等形式推销并**附加购物链接**的，应显著标明"广告"）；
  专业解读指出该款**未穷尽列举**，"不挂链接"不等于不是广告。
  ⚠️ 条文文字来自多家专业机构转引（中国市场监管报、市场监管半月沙龙、威科先行、腾讯广告法务），
  **调研者未能打开人大网/总局官方原文页**。
- **平台侧（第三方转述，未见官方页面）**：抖音 2023-05-09 发布《关于人工智能生成内容的平台规范
  暨行业倡议》共 11 条 + 配套水印与元数据规范；2026-09 从业者解读称
  "**批量无脑生成的流水线 AI 低质内容，会被系统识别降权**"；
  小红书被指 2026-03 处置账号 6378 个、全面封禁 AI 托管账号，措辞"**标了不一定限流，不标一定限流**"。
- **AI 产出必须人工二次改写**：青瓜 SOP 明确"AI 产出笔记必须人工二次改写润色，不能直接复制输出"；
  "收录失败"排查项把"高度同质化、AI 无改写直接输出"列为病因之一。

---

## 四、市场产品形态：方向 / 风格系统（竞品视角）

### 4.1 "风格"只有三种承载形式（(a) 官方文档）

内建枚举预设（Firefly `style.presets` + `strength`、Ideogram curated styles、Krea 1000+）/
参考图·参考码（MJ `--sref`+Moodboards、Recraft V4 Styles 1–10 图、Ideogram 自定义 ≤3 图）/
私有训练资产（Firefly Custom Model asset ID、Krea 自训、LoRA）。**三者都不是可编辑的"方向文档"。**

### 4.2 品牌规则作为数据：GenStudio 是最完整样本（(a)）

- 可"**upload a brand guide**, manually create a brand, or **create a brand from a URL**"，
  由生成式 AI **抽取** brand voice / **image guidelines（可按 "General art guidelines"、
  "Product photography" 分类）** / channel guidelines / Logos / Colors(hex/RGB)；
  另有 Personas、Products、Audiences（接入 Adobe RTCDP，需人工 onboarding，耗时数天）。
- 生成侧："Image variants incorporate **set guidelines, parameters, and a thoughtfully-crafted prompt**"，
  默认出 4 个变体，并有 **Content check（Brand validation）** 面板
  "ensure strict adherence to brand identity, platform guidelines, and accessibility standards"。
- 发布时可挂 **Campaigns 或 Channels** 标签 —— **campaign 在这里只是元数据**。
  [experienceleague.adobe.com](https://experienceleague.adobe.com/en/docs/genstudio-for-performance-marketing/user-guide/guidelines/add-guidelines)

### 4.3 Canva 的"资产 + 强制"双层（(a)）

- **Brand Kit**：集中管理 "official **logos, colors, fonts, and assets**"；"Each Brand Kit includes
  **assets and guidelines**"；可为不同团队/客户/campaign 建多个 kit。
- **Brand Controls**："To **restrict** them to using only colors and fonts that are in Brand Kits"。
  [canva.com/help/brand-kit](https://www.canva.com/help/brand-kit/)
  ⇒ **"方向可下发 / 约束可强制 / 结果可校验"三段式。**

### 4.4 定位已升到"品牌规则层"的产品（(a)）

- **Typeface**："Your brand guidelines, audiences, assets, and campaign learnings, held as
  **structured intelligence agents can act on and enforce**"；"Every campaign starts smarter"。
- **Jasper**："Jasper IQ embeds your **brand voice, style guides, audience profiles, and product
  knowledge** into every output"；"**Admins set the rules once; every generation follows them.**"；
  明确提到 "extend **visual guidelines to image outputs**"，并可通过 **MCP** 把品牌上下文带到别的 AI 工具。

### 4.5 「一套图」作为产物单位（(a)）

**Recraft 明确说出来**："**Generate a whole set of branded images in one click** ... The **image set
generator** lets you create sets of branded images in one go ... while maintaining quality and
**brand consistency**"；V4 Styles "holds the whole **composition — texture, palette, and rendering** ...
**with no training required**"（1–10 张参考图）。
[recraft.ai blog](https://www.recraft.ai/blog/how-to-create-branded-ai-images-for-social-media)

### 4.6 商业空白（调研者的推断，已标注）

1. 没有"跨天/跨批次的项目级方向对象"；2. 风格资产没有版本/回滚/A-B；
3. **"方向稳定性"与"单图差异度"没有解耦**；4. 视觉一致性没有自动验收；
5. 没有产品以"日更一套"为默认工作循环；6. 探索方向要花算力（MJ 明确扣 GPU 时间）。

---

## 五、未能验证的点（**不要当事实使用**）

1. **"visual territory"、"brand codes / traffic-light system"、"master visual system"** 三个术语
   均**无权威来源**。可用替代：key visual / key art、distinctive assets、house styles、
   corporate visual identity。
2. **"KV → 延展/adaptation"的具体操作规范未找到权威文档**（有定义的是"KV 是跨媒介重复的那张图"）。
3. **"同一 campaign 内刻意制造差异"没有命名框架**。可迁移的是 SCAMPER / 形态分析 / aleatory 随机词
   （de Bono 的 provocation），但"变量矩阵 + 算子扰动"是**本文档的构造**，不是行业框架。
4. **小红书官方规则原文一条都没拿到**：`crown/community/agreement` 与 `/convention` 均为 JS 空壳。
   §3.8 里"处置 6378 个账号""2026-03-10 打击 AI 托管""2025-08 上线 AI 内容声明"等
   **全部是第三方转述**。另有"2026 年 1 月起实施《AI 生成内容管理规范》"来自单一自媒体，**疑似自造文件名**。
5. **《广告法》第十四条与《互联网广告管理办法》第九条只有转引**，官方原文页未能打开。
6. **抖音官方规则页打不开**，2023-05-09 公告的 11 条只核到媒体转述与片段。
7. **报价类数字全部是自媒体经验值且互相矛盾**，无官方/4A 支撑。
8. **"一个账号应该跑几个栏目"没有权威数字**；英文 content pillars 的"10–20 个子主题"是 SEO 场景，
   不能直接迁移到小红书（且中文"内容矩阵"多指**多账号矩阵**，不是内容支柱）。
9. **千瓜/新榜/巨量算数的报告正文未能取到**（千瓜用户协议禁止公开预估数据），本摘要未引用其统计值。
10. **开源侧没有"图像版 design tokens"**：最接近的是 ComfyUI workflow JSON、A1111 X/Y/Z、
    StoryDiffusion 的算法级一致性，以及一批星数极低的个人 prompt 框架。DTCG 标准在 UI 侧存在，
    图像侧缺位（调研者基于检索无命中得出的推断）。
11. **"UPG"开源项目**：一路调研读到其 README（slot S1–S5、BAN REGISTRY、Ring Test），
    另一路在 GitHub 搜不到该项目名。**存在性存疑**，引用时请注明。
12. **知渔**：另一路用中英文多轮检索**找不到以此命名的 AI 设计/视觉产品** ——
    这与我们本仓已有的知渔实测记录（docs/design/46/59/64/67 等）矛盾，**以本仓实测为准**。
13. **Google Flow 的内部抽象、Ideogram 3.0 的 style codes、Canva Brand Voice、
    Firefly 网页版 style reference、Pencil / Icon、TapNow / Lovart / Flova 官方文档**：均未验证。
14. **Krea** 引用来自 `krea.im`（`krea.ai` 直连失败），**可能不是官方域名**。
15. **社区抱怨语料（Reddit/知乎/G2）全部不可达**，§2.6 的失败模式主要由官方文档自曝的硬约束与 HN 评论支撑。
