# 技能来源与配方总表（自动生成，勿手工编辑）

> 生成命令：`node scripts/build-skill-source-doc.mjs`。数据来自 `src/skills/*`（声明与出处台账）与 `docs/design/skill-recipe-library.json`（上游原文快照）。

## 怎么用这份文档

1. 每条技能下面有 **子页面地址**（线上直接打开，就是你验收时要进的那一页）；
2. **我们的配方提示词** = 子页面里预填给用户的那段（进页面就能看到，可直接改）；
3. **来源原文提示词** = 上游那条成熟配方**原封不动**的原文 —— 你要生成案例时照它填；
4. **来源自带案例素材** = 上游那条配方自己的参考图/成片链接，用来对齐效果与做参照；
5. **封面出图配方** = 出这张卡封面时用的版式/色相/标题/主体描述。

来源四类：**official** 上游官方用例（最可信，提示词语法与我们的引擎一致）· **repo** 高星开源库（登记真实 star）· **competitor** 竞品产品侧（开源侧无成熟库的品类，如建筑家装）· **ours** 我们自己跑通的链路。

## 总览

| 板块 | 条数 | 官方 | 高星库 | 竞品 | 自研 |
|---|---|---|---|---|---|
| 图片 | 40 | 0 | 15 | 14 | 11 |
| 视频 | 39 | 22 | 10 | 6 | 1 |

来源渠道（登记时查询的真实 star）：

- Seedance 2.5 **官方 use-cases（10 类约 50 条）+ 官方 guide** —— EvoLinkAI/awesome-seedance-2.5-guide（403★）
- Seedance 2.0 提示词合集 · 九大商用玩法 —— ZeroLu/awesome-seedance（2,415★）
- Seedance 2.0 提示词 2000+ 条（备查） —— YouMind-OpenLab/awesome-seedance-2-prompts（1,998★）
- 图片配方库（电商 35 / 广告创意 54 / 海报 / 人像 / 对比，每条带成品图与出处） —— EvoLinkAI/awesome-gpt-image-2-API-and-Prompts（17,199★）
- 竞品产品侧实测清单（图片 110 / 视频 32） —— 知渔 AI（laoyu.quantv.com）

## 图片板块

### 精品推荐

#### 自由创作 · `image.free`

- **一句话**：一句话起步，画面方向自己定
- **子页面**：`/image-creation?id=image.free`
- **可用性**：ready（现有链路可跑）
- **来源**：我们自研链路 · 
  - 说明：我们自己的自由创作链路（visualCreation + image2），无外部配方依赖
- **我们的配方提示词**（子页面里预填）：

  > 自由创作：{{prompt}}。画面要有一个明确的视觉焦点，空间关系可信，光线有来处，配色克制统一；不要出现水印、logo、二维码或价格文字。

- **来源原文提示词**：暂无（该来源是竞品产品侧或我们自研链路，没有公开配方可抄；需要时以竞品子页面的实际做法为准）

- **封面出图配方**：版式 `hero-single` · 色相 `neutral` · 标题「自由创作」 · 主体：一张风格鲜明的生成插画或摄影作品

#### 海报设计 · `image.poster`

- **一句话**：先立主视觉，再排信息层级
- **子页面**：`/image-creation?id=image.poster`
- **可用性**：ready（现有链路可跑）
- **来源**：高星开源库 · awesome-gpt-image-2（电商用例）（17199★）
  - 具体位置：`cases/poster_zh-CN.md#Case4 Chinese Minimalist S-Shaped Poster`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/blob/main/cases/poster_zh-CN.md
  - 说明：官方仓库中文极简海报（与我们的海报模板同族）
- **我们的配方提示词**（子页面里预填）：

  > 设计一张海报。主题：{{topic}}。画面：{{prompt}}。要求：单一视觉焦点、清晰的信息层级与阅读顺序，并留出安全的标题区；画面内的文字必须逐字准确，不得臆造文案、日期、价格或 logo。

- **来源原文提示词**（照它生成案例）：

  > 极简新中式美学风格，画面以淡雅的灰白色为底，呈现出一种纸艺剪影般的立体感。 一条S形蜿蜒的裂痕状边缘将画面分割，仿佛撕开了一层纸面，露出内部色彩斑斓的东方山水景象。 裂口内，一条蜿蜒的河流自上而下贯穿整个构图，河水以深浅不一的蓝色渲染，层次分明，仿佛流动的丝带。 河岸两侧点缀着青翠的山丘与梯田，色彩柔和，绿红交织，展现出田园的宁静之美。 沿河而建的古风建筑错落有致，飞檐翘角，白墙黛瓦，在光影的映衬下更显古朴典雅。 岸边树木葱茏，枝叶轻盈，一艘小船静泊于水中央，增添了几分悠然意境。 整体构图呈S形曲线，富有韵律感，仿佛自然与人文的和谐共生。 画作边缘采用撕纸效果，营造出立体浮雕般的视觉体验。 下方题字“东方美学”以黑色楷体书写，日期“2026/04/18”与红色印章相呼应，底部“CHINA”字样庄重醒目，署名“@LIYUE”低调收尾，整体氛围静谧深远，充满诗意与哲思。

- **来源自带案例素材**（1 个）：
  - https://raw.githubusercontent.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/main/images/poster_case4/output.jpg

- **封面出图配方**：版式 `poster-style` · 色相 `warm` · 标题「海报设计」 · 主体：一张已经排好信息层级的海报成品

#### 社媒封面 · `image.social_cover`

- **一句话**：缩略图里也看得清主题
- **子页面**：`/image-creation?id=image.social_cover`
- **可用性**：ready（现有链路可跑）
- **来源**：高星开源库 · awesome-gpt-image-2（电商用例）（17199★）
  - 具体位置：`cases/ad-creative.md#Case90 4-Panel Japanese Digital Ad Banner Grid`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/blob/main/cases/ad-creative.md
- **我们的配方提示词**（子页面里预填）：

  > 做一张社媒封面。主题：{{topic}}。画面：{{prompt}}。要求：缩到手机缩略图仍能一眼看懂主题，构图紧凑、焦点明确、留出安全的标题区；不要堆砌元素，不要出现二维码或水印。

- **来源原文提示词**（照它生成案例）：

  > { "type": "2x2 grid of Japanese digital advertisement banners", "layout": { "structure": "4 equal quadrants", "quadrants": [ { "position": "top-left", "theme": "Travel", "subject": "A couple holding hands on a white sand beach, looking out at turquoise ocean water under a bright blue sky.", "elements": ["red hibiscus flower in bottom left corner"], "text_labels": [ "今年こそ、解き放て。", "{argument name=\"travel destination\" default=\"沖縄旅行\"}", "3日間の癒やし旅", "航空券+ホテル", "39,800円〜", "絶景、グルメ、体験 ぜんぶ叶う!" ], "icons": { "count": 3, "descriptions": ["airplane", "hotel building", "car"] } }, { "position": "top-right", "theme": "Skincare", "subject": "Close-up portrait of a young woman with glowing, dewy skin, eyes closed, gently touching her cheeks.", "elements": [ "soft pink gradient background", "dynamic water splash effects", "pink cosmetic jar labeled '{argument name=\"skincare product name\" default=\"LUMIÈRE\"} Brightening Gel'" ], "text_labels": [ "毛穴・くすみ卒業!", "透明感あふれる", "水光肌へ", "新感覚スキンケア", "初回限定 78%OFF", "{argument name=\"discount price\" default=\"1,980円\"}" ], "badges": { "count": 3, "style": "gold circular", "labels": ["毛穴ケア", "高保湿", "ハリ・ツヤ"] } }, { "position": "bottom-left", "theme": "Gou

- **来源自带案例素材**（1 个）：
  - https://raw.githubusercontent.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/main/images/ui_case90/output.jpg

- **封面出图配方**：版式 `poster-style` · 色相 `accent` · 标题「社媒封面」 · 主体：一张移动端缩略图里也读得清的封面成品

#### 电商商品套图 · `image.product_suite`

- **一句话**：主图、场景图、卖点图成套交付
- **子页面**：`/image-creation?id=image.product_suite`
- **可用性**：ready（现有链路可跑）
- **来源**：我们自研链路 · 
  - 说明：我们自己的套图引擎（resolveEcommercePlan 按平台算张数与报价），服务端流水线自研
- **我们的配方提示词**（子页面里预填）：

  > 围绕商品生成一套电商图。商品信息：{{productParams}}。要求：先确保商品本身的结构、颜色、材质与文字被完整保留，再谈场景与氛围；符合目标平台的图片规范。

- **来源原文提示词**：暂无（该来源是竞品产品侧或我们自研链路，没有公开配方可抄；需要时以竞品子页面的实际做法为准）

- **封面出图配方**：版式 `case-3up` · 色相 `warm` · 标题「电商套图」 · 主体：同一款商品的三种电商成品图（白底、场景、卖点）

#### A+ 内容图 · `image.aplus`

- **一句话**：图文并排的模块图，把卖点讲清楚
- **子页面**：`/image-creation?id=image.aplus`
- **可用性**：needs_ref（需要参考素材路由，声明支持但未实测出片）
- **来源**：高星开源库 · awesome-gpt-image-2（电商用例）（17199★）
  - 具体位置：`cases/ecommerce.md#Case155 Earbuds E-commerce Infographic`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/blob/main/cases/ecommerce.md
  - 说明：A+ 图文模块的信息图配方
- **我们的配方提示词**（子页面里预填）：

  > 做一张亚马逊 A+ 内容模块图。商品：{{product}}。这个模块要讲的事：{{module}}。要求：横向构图，图文并排（左图右文或上图下文），信息层级清楚、留出安全的文字区；画面内的文字必须逐字准确，不得臆造文案、参数、认证标识或 logo；商品本身的结构、颜色、材质与包装文字必须完整保留。

- **来源原文提示词**（照它生成案例）：

  > High-impact e-commerce infographic for "{argument name="product" default="Apple Pods Pro 3"}" wireless earbuds. Foreground: An extreme close-up of a hand holding an open glossy white wireless earbud charging case toward the camera. Inside the case are two sleek white earbuds with black speaker accents. A small glowing green LED indicator is visible on the front of the case. The hand and case have slight macro-lens depth blur for realism. Mid-ground: A {argument name="model" default="confident young woman"} with tan skin, brown eyes, and dark hair tied in a messy bun. She has natural makeup with a dewy glow. She is wearing a plain {argument name="clothing" default="yellow athletic t-shirt"} (no logos). One white earbud is in her ear. She is looking directly at the camera with a subtle, confident expression. Background: Clean soft gray gradient studio backdrop with shallow depth of field. Diagonal rainbow prism lens flares and soft light leaks across the scene. Several blurred floating white earbuds in the background for depth and motion. Lighting: Soft professional studio lighting with glossy highlights on the product, subtle rim light on the model, high dynamic range. Typography (m

- **来源自带案例素材**（1 个）：
  - https://raw.githubusercontent.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/main/images/poster_case155/output.jpg

- **封面出图配方**：版式 `case-3up` · 色相 `accent` · 标题「A+内容图」 · 主体：同一个商品的图文模块排版成品（左图右文、标题清晰）

#### 详情页模块 · `image.detail_page`

- **一句话**：首屏、卖点、成分、参数，逐屏出图
- **子页面**：`/image-creation?id=image.detail_page`
- **可用性**：needs_ref（需要参考素材路由，声明支持但未实测出片）
- **来源**：高星开源库 · awesome-gpt-image-2（电商用例）（17199★）
  - 具体位置：`cases/ecommerce.md#Case116 Industrial Design Presentation Sheet`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/blob/main/cases/ecommerce.md
  - 说明：详情页分屏模块的网格版式
- **我们的配方提示词**（子页面里预填）：

  > 做一张电商详情页的「{{module}}」模块图。商品：{{product}}。这一屏要讲的点：{{copy}}。要求：竖版长图构图，信息层级清楚（标题 → 主图 → 说明），阅读顺序自然；画面内文字逐字准确、不臆造；商品的结构、颜色、材质与包装文字必须完整保留。

- **来源原文提示词**（照它生成案例）：

  > Core Subject: [{argument name="reference" default="use the uploaded image"}, keep the details, typography and structure locked 100%] Layout & Composition: A {argument name="presentation type" default="professional industrial design presentation sheet"}. The image should be organized into a clean grid system. Top Row: A 3x3 layout showing top-down flat lay views and close-up macro details of materials. Middle Section: Three hero shots of the product standing upright in different color ways (Matte Black, Arctic White, and accented variants). The products should be slightly tilted to show depth and form. Bottom Section: A dynamic "floating" composition featuring two products overlapping at opposing angles to showcase the front and side profiles simultaneously. Environment & Lighting: Set against a minimalist, neutral studio gray background. Soft top-down lighting with realistic contact shadows. High-end product photography aesthetic. Style & Finish: Matte textures, clean silhouettes, and sharp edges. Leave designated blank areas on the product surfaces for "Placeholder Branding" and "Graphic Mockups." 4k resolution, Unreal Engine 5 render style, hyper-realistic, clean aesthetic.

- **来源自带案例素材**（1 个）：
  - https://raw.githubusercontent.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/main/images/poster_case116/output.jpg

- **封面出图配方**：版式 `poster-style` · 色相 `warm` · 标题「详情页模块」 · 主体：一张竖版详情页模块成品（标题 + 主图 + 说明）

### 电商专区

#### 白底商品图 · `image.white_bg`

- **一句话**：干净白底，多角度呈现细节
- **子页面**：`/image-creation?id=image.white_bg`
- **可用性**：ready（现有链路可跑）
- **来源**：我们自研链路 · 
  - 说明：我们已跑通的内置技能链路（builtinSkill）
- **我们的配方提示词**（子页面里预填）：

  > 生成干净的白底商品图：商品完整居中、边缘锐利、比例真实，柔和的棚拍光影带出材质与体积感，保留商品自身的颜色、结构与文字；不要添加道具、场景或任何文字。

- **来源原文提示词**：暂无（该来源是竞品产品侧或我们自研链路，没有公开配方可抄；需要时以竞品子页面的实际做法为准）

- **封面出图配方**：版式 `hero-single` · 色相 `cool` · 标题「白底商品图」 · 主体：一件商品的白底主图，细节清楚

#### 场景种草图 · `image.scene`

- **一句话**：把商品放进真实使用场景
- **子页面**：`/image-creation?id=image.scene`
- **可用性**：ready（现有链路可跑）
- **来源**：我们自研链路 · 
  - 说明：我们已跑通的内置技能链路
- **我们的配方提示词**（子页面里预填）：

  > 把商品放进真实使用场景：{{scene}}。商品要保持可辨认的结构、颜色与材质，场景的光线、透视与投影要和商品对得上，像一张真实拍出来的生活照；不要出现文字或水印。

- **来源原文提示词**：暂无（该来源是竞品产品侧或我们自研链路，没有公开配方可抄；需要时以竞品子页面的实际做法为准）

- **封面出图配方**：版式 `case-3up` · 色相 `warm` · 标题「场景种草图」 · 主体：同一商品在真实使用场景里的三张成品图

#### 材质细节 · `image.material`

- **一句话**：放大材质与工艺，给出结构证据
- **子页面**：`/image-creation?id=image.material`
- **可用性**：ready（现有链路可跑）
- **来源**：我们自研链路 · 
  - 说明：我们已跑通的内置技能链路
- **我们的配方提示词**（子页面里预填）：

  > 拍一张材质与工艺的细节特写，重点：{{focus}}。用微距级的景深与侧光把纹理、接缝与做工交代清楚，画面干净有质感；不要虚构商品上不存在的结构或接口。

- **来源原文提示词**：暂无（该来源是竞品产品侧或我们自研链路，没有公开配方可抄；需要时以竞品子页面的实际做法为准）

- **封面出图配方**：版式 `case-3up` · 色相 `cool` · 标题「材质细节」 · 主体：同一商品材质与工艺的三张微距特写

#### 多角度套图 · `image.multi_angle`

- **一句话**：同一商品，多角度保持一致
- **子页面**：`/image-creation?id=image.multi_angle`
- **可用性**：ready（现有链路可跑）
- **来源**：我们自研链路 · 
  - 说明：我们已跑通的内置技能链路
- **我们的配方提示词**（子页面里预填）：

  > 生成商品的多角度成套图，视角：{{angle}}。同一件商品在同一组光线与背景下的连拍感，比例、颜色与细节在各角度之间保持一致；不要改变商品结构。

- **来源原文提示词**：暂无（该来源是竞品产品侧或我们自研链路，没有公开配方可抄；需要时以竞品子页面的实际做法为准）

- **封面出图配方**：版式 `case-3up` · 色相 `cool` · 标题「多角度套图」 · 主体：同一商品正面、侧面与俯视的多角度成套图

#### 模特试穿 · `image.try_on`

- **一句话**：把商品穿到模特身上，姿势场景可选
- **子页面**：`/image-creation?id=image.try_on`
- **可用性**：ready（现有链路可跑）
- **来源**：我们自研链路 · 
  - 说明：我们已跑通的内置技能链路
- **我们的配方提示词**（子页面里预填）：

  > 把商品穿到模特身上。场景：{{scene}}。保留模特的五官、身材比例与肤色，商品要贴合身体、褶皱与垂坠自然，光线统一；不要改变商品的颜色与图案。

- **来源原文提示词**：暂无（该来源是竞品产品侧或我们自研链路，没有公开配方可抄；需要时以竞品子页面的实际做法为准）

- **封面出图配方**：版式 `before-after` · 色相 `soft` · 标题「模特试穿」 · 主体：商品平铺图与模特穿着成品的对照画面

#### 批量商品图 · `image.batch`

- **一句话**：商品＋角色＋场景三份素材批量出图
- **子页面**：`/image-creation?id=image.batch`
- **可用性**：needs_ref（需要参考素材路由，声明支持但未实测出片）
- **来源**：我们自研链路 · 
  - 说明：我们已跑通的内置技能链路
- **我们的配方提示词**（子页面里预填）：

  > 用商品图、人物图与场景图合成电商成品图。补充要求：{{prompt}}。三份素材的主体特征都要保留：商品不变形、人物五官不漂移、场景光线与主体一致；不要出现文字。

- **来源原文提示词**：暂无（该来源是竞品产品侧或我们自研链路，没有公开配方可抄；需要时以竞品子页面的实际做法为准）

- **封面出图配方**：版式 `case-3up` · 色相 `warm` · 标题「批量商品图」 · 主体：商品、人物与场景三份素材合成的一组成品图

#### 爆炸分解广告图 · `image.explode`

- **一句话**：商品在半空炸开，碎片与成分定格
- **子页面**：`/image-creation?id=image.explode`
- **可用性**：ready（现有链路可跑）
- **来源**：高星开源库 · awesome-gpt-image-2（广告创意用例）（17199★）
  - 具体位置：`cases/ad-creative.md#Case109 VR Headset Exploded View Poster`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/blob/main/cases/ad-creative.md
  - 说明：官方仓库爆炸视图海报（分层零件 + 标注）
- **我们的配方提示词**（子页面里预填）：

  > 商品广告：{{product}}在空中炸开分解。要求：主体碎裂成多个碎片向四周飞散，悬浮的残骸与颗粒定格在半空，{{layers}}逐层可见，电影慢动作瞬间，逼真物理，细微粉尘与液滴散落，戏剧性景深，高速摄影风格，中心主体锐利对焦，体积光，照片级真实；必须保留商品本身的形状、颜色、材质与包装文字，碎片不得遮住标签。

- **来源原文提示词**（照它生成案例）：

  > { "type": "exploded view product diagram poster", "subject": "VR headset", "style": "clean high-tech 3D render, studio lighting, glowing accents", "background": "{argument name=\"background color\" default=\"soft purple and blue gradient\"}", "header": { "logo": "∞ {argument name=\"product name\" default=\"Meta Quest 3\"}", "subtitle": "{argument name=\"main catchphrase\" default=\"まったく新しい現実を、まったく新しい構造から。\"}" }, "layout": { "centerpiece": "vertically stacked exploded view of a VR headset showing 9 distinct layers of internal components: outer shell, camera sensors, motherboard with chip, pancake lenses, internal frame, battery packs, side straps, top strap, and facial interface cushion.", "callout_labels": { "count": 8, "left_side": [ "Snapdragon® XR2 Gen 2\n圧倒的な処理性能でリアルタイムな体験を。", "調整可能なIPD機構\n幅広いユーザーに快適なフィット感を。", "精密設計されたヘッドストラップ\n快適さと安定性を追求したエルゴノミクス。" ], "right_side": [ "フェイスプレート\n洗練されたデザインと最適な重量バランス。", "トラッキングカメラ\n高精度な位置トラッキングと環境認識を実現。", "パンケーキレンズ\n薄型設計で広い視野角と鮮明な映像を提供。", "高性能バッテリー\n長時間駆動を支える最適化された電源設計。", "柔らかなフェイスインターフェース\n長時間でも快適な装着感を実現。" ] }, "footer": { "left_text_block": { "headline": "{argument name=\"bottom headline\" default=\"体験は、構造から進化する。\"}", "body": "一つひとつのパーツに、没入体験を支

- **来源自带案例素材**（1 个）：
  - https://raw.githubusercontent.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/main/images/poster_case109/output.jpg

- **封面出图配方**：版式 `hero-single` · 色相 `warm` · 标题「爆炸分解」 · 主体：商品在半空炸开、碎片与成分定格的广告画面

#### 极地冰封海报 · `image.ice_ad`

- **一句话**：商品封进巨型冰块，超现实大场面
- **子页面**：`/image-creation?id=image.ice_ad`
- **可用性**：ready（现有链路可跑）
- **来源**：高星开源库 · awesome-gpt-image-2（电商用例）（17199★）
  - 具体位置：`cases/ecommerce.md#Case113 Luxury Amber Perfume Ad`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/blob/main/cases/ecommerce.md
  - 说明：官方仓库奢品广告（暗背景 + 戏剧光 + 内发光）
- **我们的配方提示词**（子页面里预填）：

  > 超现实广告海报：{{product}}被完整封存在一块巨大的透明冰块中央，置于广袤极地冰原，{{tone}}色调，低角度仰拍突出体量感，体积光穿过冰体产生折射与内辉光，冰面裂纹细节，远处暴风雪氛围，电影级广告摄影，超现实商业大片；商品标签与轮廓必须保持清晰可辨，画面内文字逐字准确、不得臆造。

- **来源原文提示词**（照它生成案例）：

  > A luxurious cinematic product photograph of a classic rectangular perfume bottle inspired by {argument name="brand label" default="N°5 CHANEL PARIS PARFUM"}, placed upright on a glossy black marble surface with white veining. The bottle is centered slightly to the right, made of clear faceted glass with a large transparent crystal stopper, filled with rich amber-gold perfume that glows from within. Tiny condensation droplets cover the glass, adding texture and realism. Dramatic warm lighting from the upper left creates golden highlights, deep reflections on the marble, and a soft luminous bloom in the background. Wisps of elegant smoke curl around the bottle on both sides, enhancing a moody high-end advertisement feel. Dark background, shallow depth of field, ultra-detailed studio product photography, luxury beauty campaign aesthetic, crisp focus on the bottle, realistic reflections, warm black-and-gold color palette. Add a small white {argument name="corner logo" default="Pollo.ai"} in the top-right corner. Square composition, premium commercial ad, photorealistic, high contrast, refined and sophisticated.

- **来源自带案例素材**（1 个）：
  - https://raw.githubusercontent.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/main/images/poster_case113/output.jpg

- **封面出图配方**：版式 `poster-style` · 色相 `cool` · 标题「极地冰封」 · 主体：商品被封在巨型冰块中的超现实广告海报

#### 悬浮主视觉 · `image.float_kv`

- **一句话**：产品悬浮 + 单向光，高级静物广告
- **子页面**：`/image-creation?id=image.float_kv`
- **可用性**：ready（现有链路可跑）
- **来源**：高星开源库 · awesome-gpt-image-2（电商用例）（17199★）
  - 具体位置：`cases/ecommerce.md#Case161 Premium product studio shot template`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/blob/main/cases/ecommerce.md
  - 说明：官方仓库"悬浮 + 干净渐变背景 + 三点光"模板
- **我们的配方提示词**（子页面里预填）：

  > 高端产品摄影：{{product}}悬浮于画面中央，{{light}}，背景{{background}}，强烈明暗对比与几何光影切割，大面积暗部保留，产品是唯一视觉焦点，柔和反射，真实摄影质感，品牌主视觉，无杂乱元素；商品结构与包装文字必须完整保留。

- **来源原文提示词**（照它生成案例）：

  > Create a premium product studio image of a [PRODUCT] for [BRAND], designed in line with [BRAND REFERENCE]. Show the [PRODUCT] floating against a clean light gray to soft white gradient background with a minimal high-end tech aesthetic. The [PRODUCT] should feel sleek, modern, refined, and premium, with subtle illuminated accents in [LIGHTING COLOR]. Use a three-quarter front angle so both earcups are visible, with detailed industrial design elements. Include the [BRAND] name cleanly on the product. Lighting should be soft, controlled, and editorial, with crisp highlights, soft shadows, and a subtle colored rim light or glow in [LIGHTING COLOR]. Emphasize material realism and clean geometric forms. Keep the background uncluttered and minimal. No extra props, no people, no text overlays, no packaging, and no distracting elements. Focus entirely on the [PRODUCT] as the hero product.

- **来源自带案例素材**（1 个）：
  - https://raw.githubusercontent.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/main/images/poster_case161/output.jpg

- **封面出图配方**：版式 `hero-single` · 色相 `neutral` · 标题「悬浮主视觉」 · 主体：商品悬浮、单向侧光切过的高级静物广告画面

#### 九宫格 TVC 分镜 · `image.tvc_grid`

- **一句话**：一张图出 3×3 广告分镜板
- **子页面**：`/image-creation?id=image.tvc_grid`
- **可用性**：ready（现有链路可跑）
- **来源**：高星开源库 · awesome-gpt-image-2（电商用例）（17199★）
  - 具体位置：`cases/ecommerce.md#Case2 9-Panel Product TVC Storyboard`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/blob/main/cases/ecommerce.md
  - 说明：官方仓库九宫格 TVC 分镜（含时间码与九格脚本）
- **我们的配方提示词**（子页面里预填）：

  > 做一张九宫格广告分镜板（3×3）：同一个商品在九个镜头里依次出现——{{scenes}}。要求：每格是一帧独立画面，景别与机位有变化，整体色调统一，格与格之间有叙事顺序；商品在每一格里都保持结构、颜色与包装文字一致，画面内文字逐字准确。

- **来源原文提示词**（照它生成案例）：

  > Using the provided reference image, transform the single casual product photo into a polished e-commerce TVC storyboard board for a {argument name="video duration" default="15-second"} ad in a {argument name="aspect ratio" default="9:16"} vertical format, presented as a 9-panel grid. Keep the same blue-and-white ceramic ashtray as the product base, but restage it across cinematic advertising shots with warm premium lighting, shallow depth of field, and a refined lifestyle desktop environment. Add a dark storyboard layout with Chinese titles and timing for each panel. Include exactly 9 scenes: 1) environment-establishing wide shot with desk, books, window, and the product placed in context; 2) hero product medium shot on the table; 3) extreme close-up of the blue floral craftsmanship pattern; 4) use case showing a hand placing a cigarette into the ashtray with visible smoke; 5) top-down capacity display showing multiple cigarette butts inside; 6) cleaning scene under running water in a sink with a hand holding the product; 7) bottom-detail close-up showing the underside and anti-slip pads; 8) mood/lifestyle scene at night with the product on a desk, smoke rising, and ambient lamp li

- **来源自带案例素材**（1 个）：
  - https://raw.githubusercontent.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/main/images/poster_case160/output.jpg

- **封面出图配方**：版式 `case-3up` · 色相 `accent` · 标题「九宫格分镜」 · 主体：同一商品的九格广告分镜板（3×3、含时间码）

#### SKU 多色系列图 · `image.sku_series`

- **一句话**：同款不同配色，整齐排开
- **子页面**：`/image-creation?id=image.sku_series`
- **可用性**：ready（现有链路可跑）
- **来源**：高星开源库 · awesome-gpt-image-2（电商用例）（17199★）
  - 具体位置：`cases/ecommerce.md#Case116 Industrial Design Presentation Sheet`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/blob/main/cases/ecommerce.md
  - 说明：同一产品多配色并置的展示板版式
- **我们的配方提示词**（子页面里预填）：

  > 做一张 SKU 多色系列图：同一款{{product}}的不同配色有序排列——{{colors}}。要求：排列整齐、间距一致，光影与质感完全一致，**只允许颜色不同**，结构与包装文字必须一致，背景干净；画面内不出现臆造的文字与价格。

- **来源原文提示词**（照它生成案例）：

  > Core Subject: [{argument name="reference" default="use the uploaded image"}, keep the details, typography and structure locked 100%] Layout & Composition: A {argument name="presentation type" default="professional industrial design presentation sheet"}. The image should be organized into a clean grid system. Top Row: A 3x3 layout showing top-down flat lay views and close-up macro details of materials. Middle Section: Three hero shots of the product standing upright in different color ways (Matte Black, Arctic White, and accented variants). The products should be slightly tilted to show depth and form. Bottom Section: A dynamic "floating" composition featuring two products overlapping at opposing angles to showcase the front and side profiles simultaneously. Environment & Lighting: Set against a minimalist, neutral studio gray background. Soft top-down lighting with realistic contact shadows. High-end product photography aesthetic. Style & Finish: Matte textures, clean silhouettes, and sharp edges. Leave designated blank areas on the product surfaces for "Placeholder Branding" and "Graphic Mockups." 4k resolution, Unreal Engine 5 render style, hyper-realistic, clean aesthetic.

- **来源自带案例素材**（1 个）：
  - https://raw.githubusercontent.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/main/images/poster_case116/output.jpg

- **封面出图配方**：版式 `case-3up` · 色相 `soft` · 标题「SKU多色图」 · 主体：同款商品不同配色整齐排列的系列图

#### 礼盒场景图 · `image.gift_scene`

- **一句话**：商品进礼盒/桌面场景，同风格可复制
- **子页面**：`/image-creation?id=image.gift_scene`
- **可用性**：ready（现有链路可跑）
- **来源**：高星开源库 · awesome-gpt-image-2（电商用例）（17199★）
  - 具体位置：`cases/ecommerce.md#Case118 Luxury Perfume Ad on Marble Vanity`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/blob/main/cases/ecommerce.md
  - 说明：官方仓库场景静物（台面 + 道具 + 柔光）
- **我们的配方提示词**（子页面里预填）：

  > 把{{product}}放进{{scene}}里拍一张场景图。要求：商品是画面主角、位置自然、留白得当，环境光柔和有来处，材质与色彩克制统一，风格可以复制到同系列的其他商品上；商品结构与包装文字完整保留，不出现臆造的品牌与价格。

- **来源原文提示词**（照它生成案例）：

  > A luxury e-commerce advertising photo of a premium perfume bottle on a polished gray-and-white marble vanity, shot in a warm cinematic studio style with soft golden lighting, shallow depth of field, and elegant reflections. The composition is square and high-end, with the perfume bottle centered slightly right of frame and promotional text on the left. The bottle is a tall sculpted hourglass-shaped glass flacon with smoky transparent gray glass fading darker at the base, a glossy gold spherical cap, a gold collar engraved with fine branding, and a large metallic gold interlocking monogram on the front. Keep the branding-inspired feel but do not add extra products. In the foreground left, include 1 cut-crystal bowl with a gold rim, partially cropped. In the background right, include 1 brushed gold cylindrical vase holding 1 bouquet of soft white flowers, blurred. Behind the bottle, add 1 black marble rectangular box with subtle white veining and gold trim. In the lower right foreground, include 1 draped piece of champagne-colored satin fabric, softly out of focus. The background should be dark, luxurious, and softly blurred, with rich brown-black tones and a vertical shadowed panel 

- **来源自带案例素材**（1 个）：
  - https://raw.githubusercontent.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/main/images/poster_case118/output.jpg

- **封面出图配方**：版式 `hero-single` · 色相 `warm` · 标题「礼盒场景」 · 主体：商品放在礼盒与桌面场景中的成品图

#### 拆解工艺图 · `image.teardown`

- **一句话**：把商品拆成零件，讲清工艺
- **子页面**：`/image-creation?id=image.teardown`
- **可用性**：ready（现有链路可跑）
- **来源**：高星开源库 · awesome-gpt-image-2（广告创意用例）（17199★）
  - 具体位置：`cases/ad-creative.md#Case109 VR Headset Exploded View Poster`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/blob/main/cases/ad-creative.md
  - 说明：拆解 + 标注的官方配方
- **我们的配方提示词**（子页面里预填）：

  > 做一张工艺拆解图：把{{product}}拆成{{parts}}并列展示。要求：零件比例真实、排列有序、质感统一，像产品说明书里的爆炸图，背景干净；画面内文字逐字准确，不得臆造参数与认证标识。

- **来源原文提示词**（照它生成案例）：

  > { "type": "exploded view product diagram poster", "subject": "VR headset", "style": "clean high-tech 3D render, studio lighting, glowing accents", "background": "{argument name=\"background color\" default=\"soft purple and blue gradient\"}", "header": { "logo": "∞ {argument name=\"product name\" default=\"Meta Quest 3\"}", "subtitle": "{argument name=\"main catchphrase\" default=\"まったく新しい現実を、まったく新しい構造から。\"}" }, "layout": { "centerpiece": "vertically stacked exploded view of a VR headset showing 9 distinct layers of internal components: outer shell, camera sensors, motherboard with chip, pancake lenses, internal frame, battery packs, side straps, top strap, and facial interface cushion.", "callout_labels": { "count": 8, "left_side": [ "Snapdragon® XR2 Gen 2\n圧倒的な処理性能でリアルタイムな体験を。", "調整可能なIPD機構\n幅広いユーザーに快適なフィット感を。", "精密設計されたヘッドストラップ\n快適さと安定性を追求したエルゴノミクス。" ], "right_side": [ "フェイスプレート\n洗練されたデザインと最適な重量バランス。", "トラッキングカメラ\n高精度な位置トラッキングと環境認識を実現。", "パンケーキレンズ\n薄型設計で広い視野角と鮮明な映像を提供。", "高性能バッテリー\n長時間駆動を支える最適化された電源設計。", "柔らかなフェイスインターフェース\n長時間でも快適な装着感を実現。" ] }, "footer": { "left_text_block": { "headline": "{argument name=\"bottom headline\" default=\"体験は、構造から進化する。\"}", "body": "一つひとつのパーツに、没入体験を支

- **来源自带案例素材**（1 个）：
  - https://raw.githubusercontent.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/main/images/poster_case109/output.jpg

- **封面出图配方**：版式 `case-3up` · 色相 `cool` · 标题「拆解工艺图」 · 主体：商品拆成零件并列展示的工艺拆解图

#### 微缩场景广告 · `image.diorama`

- **一句话**：商品住进微缩立体世界
- **子页面**：`/image-creation?id=image.diorama`
- **可用性**：ready（现有链路可跑）
- **来源**：高星开源库 · awesome-gpt-image-2（电商用例）（17199★）
  - 具体位置：`cases/ecommerce.md#Case1 Miniature Diorama Skincare Advertisement`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/blob/main/cases/ecommerce.md
  - 说明：官方仓库微缩场景广告（小人 + 脚手架 + 产品）
- **我们的配方提示词**（子页面里预填）：

  > 把{{product}}放进一个微缩立体场景（diorama）里：{{world}}。要求：微缩比例可信、材质分明（黏土/纸艺/树脂质感）、顶光或侧逆光塑形、浅景深，像手工模型摄影；商品本身的结构、颜色与包装文字必须保持真实可辨。

- **来源原文提示词**（照它生成案例）：

  > A hyper-realistic miniature diorama product advertisement featuring an oversized luxury skincare pump bottle labeled "LUXEVEIL Skin Science – Radiance Nourishing Body Lotion" in cream/beige with a polished gold pump top, placed on a circular platform. Tiny figurine construction workers dressed in yellow coveralls and white hard hats swarm around the bottle climbing scaffolding, painting the bottle with rollers, operating a tower crane, working near industrial tanks and pipework, and unloading a miniature flatbed truck. The scene includes metal scaffolding structures, industrial silos, orange traffic cones, wooden barricades, and storage barrels. The overall color palette is warm beige, cream, gold, and mustard yellow. Studio photography style with soft diffused lighting, no shadows, clean beige background. The concept metaphorically shows workers "crafting" or "building" the perfect lotion. Tilt-shift miniature aesthetic, ultra-detailed, commercial product photography, 8K resolution, photorealistic CGI render.

- **来源自带案例素材**（1 个）：
  - https://raw.githubusercontent.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/main/images/poster_case151/output.jpg

- **封面出图配方**：版式 `hero-single` · 色相 `accent` · 标题「微缩场景」 · 主体：商品置于微缩立体场景中的模型感广告画面

### 创意应用

#### 品牌主视觉 · `image.brand_kv`

- **一句话**：把品牌调性扩成一套画面语言
- **子页面**：`/image-creation?id=image.brand_kv`
- **可用性**：ready（现有链路可跑）
- **来源**：高星开源库 · awesome-gpt-image-2（广告创意用例）（17199★）
  - 具体位置：`cases/ad-creative.md#Case45 Glossier 品牌世界拼贴`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/blob/main/cases/ad-creative.md
  - 说明：品牌主视觉以官方仓库品牌企划配方为准
- **我们的配方提示词**（子页面里预填）：

  > 做一张品牌主视觉。主题：{{topic}}。品牌：{{brand}}。画面：{{prompt}}。要求：不是一张孤立的图，而是一套能延展到其他版式的画面语言——构图、材质、光线、色板与图形节奏要统一；品牌标识与产品细节必须原样保留。

- **来源原文提示词**（照它生成案例）：

  > Act as a world-class creative director, brand strategist, and editorial art director with deep expertise in high-impact campaign systems for global brands. Create a bold, visually explosive, densely layered editorial moodboard collage that captures an entire brand identity system in a single frame. The result should feel raw, expressive, and intentionally chaotic, like a brand world exploding on the canvas. BRAND INPUTS: BRAND NAME: GLOSSIER PRODUCT TYPE: beauty / skincare PRIMARY COLOR: soft pink SECONDARY COLOR: white ACCENT: translucent gloss PERSONALITY: fresh, minimal, youthful, clean SLOGAN: SKIN FIRST COMPOSITION: Build a dense, overlapping collage that mixes: • real product photography and lifestyle imagery • packaging elements: bags, boxes, labels, stickers • typography snippets and brand phrases • hand-drawn doodles and illustrated graphics • icons, symbols, and badge / stamp elements • abstract blobs, squiggles, and starbursts • UI-style cards, menus, and label panels • editorial cutouts layered with depth The layout should feel: • asymmetrical, not grid-based • intentionally messy but visually balanced • like a Pinterest board crossed with a high-end campaign shoot • ex

- **封面出图配方**：版式 `hero-single` · 色相 `accent` · 标题「品牌主视觉」 · 主体：一张统一的品牌主视觉成品画面

#### 中文海报 · `image.cn_poster`

- **一句话**：中文标题与画面一起排
- **子页面**：`/image-creation?id=image.cn_poster`
- **可用性**：ready（现有链路可跑）
- **来源**：竞品产品侧 · 知渔 AI 实测清单（图片 110 条 / 视频 32 条）
  - 具体位置：`图片制作 / 创意应用 / 中文海报一键生成`
  - 跟踪链接：https://laoyu.quantv.com
  - 说明：中文排字海报以竞品产品侧为准（官方仓库以英文案例为主）
- **我们的配方提示词**（子页面里预填）：

  > 设计一张中文海报。主题：{{topic}}。画面：{{prompt}}。用途：{{use}}。字体气质：{{font}}。要求：中文标题逐字准确、层级清楚，不出现错字或臆造文案，画面给标题留出安全区。

- **来源原文提示词**：暂无（该来源是竞品产品侧或我们自研链路，没有公开配方可抄；需要时以竞品子页面的实际做法为准）

- **封面出图配方**：版式 `poster-style` · 色相 `warm` · 标题「中文海报」 · 主体：一张中文标题与画面一起排好的海报成品

#### 图文复刻 · `image.copy`

- **一句话**：保住构图与节奏，换成自己的内容
- **子页面**：`/image-creation?id=image.copy`
- **可用性**：needs_ref（需要参考素材路由，声明支持但未实测出片）
- **来源**：竞品产品侧 · 知渔 AI 实测清单（图片 110 条 / 视频 32 条）
  - 具体位置：`图片制作 / 精品推荐 / 图片复刻`
  - 跟踪链接：https://laoyu.quantv.com
- **我们的配方提示词**（子页面里预填）：

  > 按参考图的构图与画面节奏复刻一张新图，把主体换成我的素材。补充要求：{{prompt}}。保留参考图的版式结构、光线方向与色调关系，但内容必须是我的商品或人物，不要照搬参考图里的品牌与文字。

- **来源原文提示词**：暂无（该来源是竞品产品侧或我们自研链路，没有公开配方可抄；需要时以竞品子页面的实际做法为准）

- **封面出图配方**：版式 `before-after` · 色相 `cool` · 标题「图文复刻」 · 主体：参考图与复刻成品的并排对照画面

#### 相似图生成 · `image.similar`

- **一句话**：沿着一张参考图再生成几张
- **子页面**：`/image-creation?id=image.similar`
- **可用性**：needs_ref（需要参考素材路由，声明支持但未实测出片）
- **来源**：竞品产品侧 · 知渔 AI 实测清单（图片 110 条 / 视频 32 条）
  - 具体位置：`图片制作 / 创意应用 / 相似图生成`
  - 跟踪链接：https://laoyu.quantv.com
- **我们的配方提示词**（子页面里预填）：

  > 沿用参考图的风格再生成一张，参考强度：{{strength}}。保留参考图的画面语言（构图习惯、光线、色调、质感），但不要逐像素复制；不要出现水印或 logo。

- **来源原文提示词**：暂无（该来源是竞品产品侧或我们自研链路，没有公开配方可抄；需要时以竞品子页面的实际做法为准）

- **封面出图配方**：版式 `hero-single` · 色相 `neutral` · 标题「相似图生成」 · 主体：由一张参考图延展出的同风格成品画面

#### 小红书图文 · `image.xhs_note`

- **一句话**：一组配图加标题正文，真实感优先
- **子页面**：`/image-creation?id=image.xhs_note`
- **可用性**：ready（现有链路可跑）
- **来源**：我们自研链路 · 
  - 说明：我们自己的小红书图文链路（SSE 流水线），不进画布
- **我们的配方提示词**（子页面里预填）：

  > 围绕这个主题做一组小红书配图。主题：{{prompt}}。文风：{{style}}。要求：真实感优先，像手机随手拍出来的生活记录，不要做成广告海报；不出现水印与二维码。

- **来源原文提示词**：暂无（该来源是竞品产品侧或我们自研链路，没有公开配方可抄；需要时以竞品子页面的实际做法为准）

- **封面出图配方**：版式 `case-3up` · 色相 `soft` · 标题「小红书图文」 · 主体：一组小红书种草图（封面加两张内页）

### 建筑家装

#### 平面转效果图 · `image.floorplan_render`

- **一句话**：一张户型图，长出一套三维效果图
- **子页面**：`/image-creation?id=image.floorplan_render`
- **可用性**：needs_ref（需要参考素材路由，声明支持但未实测出片）
- **来源**：竞品产品侧 · 知渔 AI 实测清单（图片 110 条 / 视频 32 条）
  - 具体位置：`图片制作 / 建筑室内 / 平面转建筑效果图`
  - 跟踪链接：https://laoyu.quantv.com
- **我们的配方提示词**（子页面里预填）：

  > 把这张户型图转成三维室内效果图：{{room}}。要求：房间数量、开间进深、门窗位置与户型图**完全一致**，家具按常规布局摆放且尺度合理，顶面、地面与墙面的材质统一，光线从窗户自然进入；不要新增或删减房间，不要改动承重结构，画面里不出现文字与尺寸标注。

- **来源原文提示词**：暂无（该来源是竞品产品侧或我们自研链路，没有公开配方可抄；需要时以竞品子页面的实际做法为准）

- **封面出图配方**：版式 `before-after` · 色相 `cool` · 标题「平面转效果图」 · 主体：户型平面图与三维室内效果图的并排对照

#### 装修风格转换 · `image.interior_style`

- **一句话**：同一个空间，换成另一种装修风格
- **子页面**：`/image-creation?id=image.interior_style`
- **可用性**：needs_ref（需要参考素材路由，声明支持但未实测出片）
- **来源**：竞品产品侧 · 知渔 AI 实测清单（图片 110 条 / 视频 32 条）
  - 具体位置：`图片制作 / 建筑室内 / 装修风格转换`
  - 跟踪链接：https://laoyu.quantv.com
- **我们的配方提示词**（子页面里预填）：

  > 把这张室内照片的装修风格改成「{{style}}」。要求：空间结构、门窗位置、房间尺寸与机位**完全不变**，只更换硬装材质、家具款式、软装与配色；光线方向与原图一致，材质质感真实（木纹、石材、织物可辨），不出现变形、穿模与多余文字。

- **来源原文提示词**：暂无（该来源是竞品产品侧或我们自研链路，没有公开配方可抄；需要时以竞品子页面的实际做法为准）

- **封面出图配方**：版式 `before-after` · 色相 `warm` · 标题「风格转换」 · 主体：同一空间两种装修风格的并排对照画面

#### 毛坯房设计 · `image.rough_interior`

- **一句话**：毛坯现场照，直接出精装方案
- **子页面**：`/image-creation?id=image.rough_interior`
- **可用性**：needs_ref（需要参考素材路由，声明支持但未实测出片）
- **来源**：竞品产品侧 · 知渔 AI 实测清单（图片 110 条 / 视频 32 条）
  - 具体位置：`图片制作 / 建筑室内 / 毛坯家装设计`
  - 跟踪链接：https://laoyu.quantv.com
- **我们的配方提示词**（子页面里预填）：

  > 把这张毛坯房照片做成精装完成后的样子：{{plan}}。要求：墙体、梁柱、门窗与管道位置**完全保留**，只在其上增加吊顶、地面、墙面饰面与家具；机位与透视不变，光线从原有窗户进入，材质真实、色温统一，不出现结构改动与文字标注。

- **来源原文提示词**：暂无（该来源是竞品产品侧或我们自研链路，没有公开配方可抄；需要时以竞品子页面的实际做法为准）

- **封面出图配方**：版式 `before-after` · 色相 `soft` · 标题「毛坯房设计」 · 主体：毛坯现场与精装完成效果的并排对照

#### 日夜气候切换 · `image.day_night_still`

- **一句话**：同一张图，出白天 / 黄昏 / 夜晚三版
- **子页面**：`/image-creation?id=image.day_night_still`
- **可用性**：needs_ref（需要参考素材路由，声明支持但未实测出片）
- **来源**：竞品产品侧 · 知渔 AI 实测清单（图片 110 条 / 视频 32 条）
  - 具体位置：`图片制作 / 建筑室内 / 日夜气候切换`
  - 跟踪链接：https://laoyu.quantv.com
- **我们的配方提示词**（子页面里预填）：

  > 把这张建筑 / 空间图改成「{{moment}}」的样子。要求：建筑结构、机位、构图与材质**完全不变**，只改变光线方向、色温、天空与阴影；室内灯光在夜景中要自然亮起并有真实反射，地面湿度与反光符合天气设定，不出现结构变化与文字。

- **来源原文提示词**：暂无（该来源是竞品产品侧或我们自研链路，没有公开配方可抄；需要时以竞品子页面的实际做法为准）

- **封面出图配方**：版式 `case-3up` · 色相 `cool` · 标题「日夜切换」 · 主体：同一栋建筑白天、黄昏与夜晚的三张成品

#### 软硬装替换 · `image.furniture_swap`

- **一句话**：结构不动，只换家具与饰面
- **子页面**：`/image-creation?id=image.furniture_swap`
- **可用性**：needs_ref（需要参考素材路由，声明支持但未实测出片）
- **来源**：竞品产品侧 · 知渔 AI 实测清单（图片 110 条 / 视频 32 条）
  - 具体位置：`图片制作 / 建筑室内 / 一键软硬装替换`
  - 跟踪链接：https://laoyu.quantv.com
- **我们的配方提示词**（子页面里预填）：

  > 保持这张空间图的结构与机位**完全不变**，把家具与饰面替换成：{{target}}。要求：只替换可移动家具、灯具、软装与墙地面饰面，墙体、门窗、梁柱与尺寸不动；新家具的比例与透视要和空间吻合，材质光影统一，不出现漂浮、穿模与文字。

- **来源原文提示词**：暂无（该来源是竞品产品侧或我们自研链路，没有公开配方可抄；需要时以竞品子页面的实际做法为准）

- **封面出图配方**：版式 `before-after` · 色相 `accent` · 标题「软硬装替换」 · 主体：结构不变、家具与饰面替换前后的并排对照

#### 效果图质感提升 · `image.render_quality`

- **一句话**：把普通效果图提到商业出图水准
- **子页面**：`/image-creation?id=image.render_quality`
- **可用性**：needs_ref（需要参考素材路由，声明支持但未实测出片）
- **来源**：竞品产品侧 · 知渔 AI 实测清单（图片 110 条 / 视频 32 条）
  - 具体位置：`图片制作 / 建筑室内 / 效果图质感提升`
  - 跟踪链接：https://laoyu.quantv.com
- **我们的配方提示词**（子页面里预填）：

  > 提升这张效果图的画面质感，不改变任何结构、家具与机位。要求：修正材质反射与粗糙度，让木纹、石材、金属、织物各自可辨；补足环境光遮蔽与柔和阴影，降低塑料感与噪点，提亮暗部但不死黑，整体色温统一、画面干净通透，达到商业出图水准。

- **来源原文提示词**：暂无（该来源是竞品产品侧或我们自研链路，没有公开配方可抄；需要时以竞品子页面的实际做法为准）

- **封面出图配方**：版式 `before-after` · 色相 `neutral` · 标题「质感提升」 · 主体：普通效果图与质感提升之后的并排对照

#### 室内 3D 渲染 · `image.interior_3d`

- **一句话**：模型截图 / 白模，渲染成真实照片
- **子页面**：`/image-creation?id=image.interior_3d`
- **可用性**：needs_ref（需要参考素材路由，声明支持但未实测出片）
- **来源**：竞品产品侧 · 知渔 AI 实测清单（图片 110 条 / 视频 32 条）
  - 具体位置：`图片制作 / 建筑室内 / 室内3D模型渲染`
  - 跟踪链接：https://laoyu.quantv.com
- **我们的配方提示词**（子页面里预填）：

  > 把这张室内模型图 / 白模渲染成照片级实景：{{style}}。要求：结构、家具位置与机位**完全不变**，只为材质赋予真实的反射与粗糙度，加上自然光与人工光的混合照明、接触阴影与景深；材质层次分明、色温统一，不出现结构变化、文字与水印。

- **来源原文提示词**：暂无（该来源是竞品产品侧或我们自研链路，没有公开配方可抄；需要时以竞品子页面的实际做法为准）

- **封面出图配方**：版式 `hero-single` · 色相 `accent` · 标题「室内3D渲染」 · 主体：白模渲染成照片级室内实景的成品画面

#### 建筑九宫格分镜 · `image.arch_grid`

- **一句话**：一张九宫格讲完一栋建筑
- **子页面**：`/image-creation?id=image.arch_grid`
- **可用性**：ready（现有链路可跑）
- **来源**：竞品产品侧 · 知渔 AI 实测清单（图片 110 条 / 视频 32 条）
  - 具体位置：`图片制作 / 建筑室内 / 建筑九宫格分镜`
  - 跟踪链接：https://laoyu.quantv.com
- **我们的配方提示词**（子页面里预填）：

  > 做一张建筑九宫格分镜板（3×3）：{{scenes}}。要求：九格是同一栋建筑的九个视角或时段，透视与结构一致，格与格之间有叙事顺序（远景 → 中景 → 细节 → 室内 → 夜景），色调统一，不出现文字、标注与水印。

- **来源原文提示词**：暂无（该来源是竞品产品侧或我们自研链路，没有公开配方可抄；需要时以竞品子页面的实际做法为准）

- **封面出图配方**：版式 `case-3up` · 色相 `cool` · 标题「建筑分镜」 · 主体：同一栋建筑的九个视角九宫格分镜板

### 人像摄影

#### 人像精修 · `image.portrait`

- **一句话**：皮肤、光线与质感一起收拾干净
- **子页面**：`/image-creation?id=image.portrait`
- **可用性**：needs_ref（需要参考素材路由，声明支持但未实测出片）
- **来源**：高星开源库 · awesome-gpt-image-2（电商用例）（17199★）
  - 具体位置：`cases/portrait_zh-CN.md#Case7 Luxury Glam Beauty Portrait`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/blob/main/cases/portrait_zh-CN.md
  - 说明：官方仓库美妆人像（皮肤与光线处理的基准）
- **我们的配方提示词**（子页面里预填）：

  > 精修这张人像。要求：{{prompt}}。保留人物原本的五官特征与身份识别度，皮肤处理自然、保留质感与毛孔，光线过渡干净；不要过度磨皮，不要改变脸型。

- **来源原文提示词**（照它生成案例）：

  > Luxury Glam Beauty Portrait:, Beautiful Black woman, youthful spirit, creamy vanilla, silk press, mahogany red, subtle confidence, textured fabric, sapphire blue, minimal jewelry, beachside breeze, lens flare effect, nostalgic, cinematic lens, symmetrical composition, soft focus, high fashion photography, monochromatic, dewy finish, mysterious tension, layered elements

- **来源自带案例素材**（1 个）：
  - https://raw.githubusercontent.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/main/images/portrait_case7/output.jpg

- **封面出图配方**：版式 `before-after` · 色相 `soft` · 标题「人像精修」 · 主体：人像原片与精修成品的并排对照画面

#### 换发型 · `image.hairstyle`

- **一句话**：保留五官，换一个发型
- **子页面**：`/image-creation?id=image.hairstyle`
- **可用性**：needs_ref（需要参考素材路由，声明支持但未实测出片）
- **来源**：我们自研链路 · 
  - 说明：换发型走我们已跑通的内置技能链路（保五官 + 图生图）；开源侧没有专门覆盖换发型的成熟提示词库，只有虚拟试衣类（OOTDiffusion 6,593★），两者不是一回事，不硬套
- **我们的配方提示词**（子页面里预填）：

  > 保留人物五官与脸型，把发型换成：{{style}}。发丝走向、发量感与光线要自然可信，肤色与背景保持一致；不要改变人物的身份特征。

- **来源原文提示词**：暂无（该来源是竞品产品侧或我们自研链路，没有公开配方可抄；需要时以竞品子页面的实际做法为准）

- **封面出图配方**：版式 `before-after` · 色相 `soft` · 标题「换发型」 · 主体：同一个人换发型前后的并排对照画面

#### 姿势生成 · `image.pose`

- **一句话**：同一个人，换几种姿势
- **子页面**：`/image-creation?id=image.pose`
- **可用性**：needs_ref（需要参考素材路由，声明支持但未实测出片）
- **来源**：高星开源库 · awesome-gpt-image-2（电商用例）（17199★）
  - 具体位置：`cases/poster_zh-CN.md#Case134 16-Panel Dance Pose Reference Sheet`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/blob/main/cases/poster_zh-CN.md
  - 说明：官方仓库 16 格姿势参考表（多姿势出图的基准）
- **我们的配方提示词**（子页面里预填）：

  > 让同一个人换几种姿势：{{pose}}。保持五官、发型、体型与服装一致，只改变姿态与镜头角度，光线与背景保持同一套；不要出现多余的肢体。

- **来源原文提示词**（照它生成案例）：

  > {"type":"dance pose reference sheet","style":"clean studio pose chart, photoreal fitness-dance reference, white seamless background, sharp full-body photography, soft even lighting, minimal shadows, thin black grid lines separating panels","subject":{"count":1,"person":{"gender_presentation":"female","age_appearance":"young adult","build":"slim athletic toned dancer","skin_tone":"light tan","hair":{"color":"{argument name=\"hair color\" default=\"dark brown\"}","style":"high ponytail with loose strands"},"outfit":{"count":3,"items":["white fitted sports bra or cropped athletic tank","baggy blue-gray jogger pants","white sneakers"]}}},"layout":{"rows":4,"columns":4,"total_panels":16,"numbering":"black panel numbers in the top-left corner of each cell, labeled 1 through 16","sections":[{"title":"pose grid","position":"full page","count":16,"labels":["1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16"]}]},"poses":{"count":16,"items":[{"panel":1,"description":"wide stance, knees bent, torso upright, right arm extended straight to the right in a pointing gesture, left arm bent near the body"},{"panel":2,"description":"deep low squat facing forward, feet wide apart, on

- **来源自带案例素材**（1 个）：
  - https://raw.githubusercontent.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/main/images/poster_case134/output.jpg

- **封面出图配方**：版式 `case-3up` · 色相 `soft` · 标题「姿势生成」 · 主体：同一个人三种姿势的三张成品照片

### 图片编辑

#### 去除背景 · `image.remove_bg`

- **一句话**：去掉背景，出透明底或纯色底
- **子页面**：`/image-creation?id=image.remove_bg`
- **可用性**：ready（现有链路可跑）
- **来源**：我们自研链路 · 
  - 说明：去背景走我们已跑通的内置技能链路；竞品把它放在精品推荐位（产品侧可对标），但开源提示词库里没有专门的去背景配方，不编一个 Case 号
- **我们的配方提示词**（子页面里预填）：

  > 去掉背景，只保留主体。底色：{{mode}}。主体边缘要干净，发丝与透明材质要处理好，不要残留原背景，也不要改变主体本身的颜色与结构。

- **来源原文提示词**：暂无（该来源是竞品产品侧或我们自研链路，没有公开配方可抄；需要时以竞品子页面的实际做法为准）

- **封面出图配方**：版式 `hero-single` · 色相 `cool` · 标题「去除背景」 · 主体：去掉背景后的透明底与纯色底商品图

#### 换背景 · `image.swap_bg`

- **一句话**：人物或商品留着，背景换掉
- **子页面**：`/image-creation?id=image.swap_bg`
- **可用性**：needs_ref（需要参考素材路由，声明支持但未实测出片）
- **来源**：竞品产品侧 · 知渔 AI 实测清单（图片 110 条 / 视频 32 条）
  - 具体位置：`图片制作 / 电商专区 / 一键模特换背景`
  - 跟踪链接：https://laoyu.quantv.com
- **我们的配方提示词**（子页面里预填）：

  > 保留主体，把背景换成我给的这张（或按下面的要求）：{{prompt}}。主体的光线要与新背景对得上，投影方向一致，边缘融合自然；不要改变主体的形态与颜色。

- **来源原文提示词**：暂无（该来源是竞品产品侧或我们自研链路，没有公开配方可抄；需要时以竞品子页面的实际做法为准）

- **封面出图配方**：版式 `before-after` · 色相 `cool` · 标题「换背景」 · 主体：原背景与替换后背景的并排对照画面

#### 图片精修 · `image.retouch`

- **一句话**：一张图加一句要求，改到能用
- **子页面**：`/image-creation?id=image.retouch`
- **可用性**：needs_ref（需要参考素材路由，声明支持但未实测出片）
- **来源**：竞品产品侧 · 知渔 AI 实测清单（图片 110 条 / 视频 32 条）
  - 具体位置：`图片制作 / 电商专区 / 照片高质量精修`
  - 跟踪链接：https://laoyu.quantv.com
- **我们的配方提示词**（子页面里预填）：

  > 按这个要求修图：{{prompt}}。只做要求的改动，画面其他部分保持原样；不要改变主体的结构、文字与颜色关系，不要添加原本不存在的东西。

- **来源原文提示词**：暂无（该来源是竞品产品侧或我们自研链路，没有公开配方可抄；需要时以竞品子页面的实际做法为准）

- **封面出图配方**：版式 `before-after` · 色相 `neutral` · 标题「图片精修」 · 主体：修图前后同一张画面的并排对照

#### 材质替换 · `image.style_swap`

- **一句话**：主体不动，换材质或风格
- **子页面**：`/image-creation?id=image.style_swap`
- **可用性**：needs_ref（需要参考素材路由，声明支持但未实测出片）
- **来源**：竞品产品侧 · 知渔 AI 实测清单（图片 110 条 / 视频 32 条）
  - 具体位置：`图片制作 / 电商专区 / 商品风格材质更换`
  - 跟踪链接：https://laoyu.quantv.com
- **我们的配方提示词**（子页面里预填）：

  > 主体不动，把材质或风格换成：{{material}}。新材质的反光、纹理与质感要真实可信，并与环境光一致；保持主体的形状、比例与结构不变。

- **来源原文提示词**：暂无（该来源是竞品产品侧或我们自研链路，没有公开配方可抄；需要时以竞品子页面的实际做法为准）

- **封面出图配方**：版式 `before-after` · 色相 `warm` · 标题「材质替换」 · 主体：主体不变、材质替换前后的并排对照画面

## 视频板块

### 精品推荐

#### 智能成片 · `video.smart`

- **一句话**：一句话起步，镜头与节奏交给模型
- **子页面**：`/video-creation?id=video.smart`
- **可用性**：ready（现有链路可跑）
- **来源**：高星开源库 · Seedance 2.0 九大商用玩法（卡尔的AI沃茨）（2415★）
  - 具体位置：`prompts/commercial-use-cases.md#2 商业广告`
  - 跟踪链接：https://github.com/ZeroLu/awesome-seedance/blob/main/prompts/commercial-use-cases.md
  - 说明：官方商用玩法"商业广告：分镜编排 + 快剪 + 产品一致性"
- **我们的配方提示词**（子页面里预填）：

  > 用上传的素材做一支短视频：开场 1 秒先给一个明确的主体特写抓住注意力，中段展示使用场景与材质细节，结尾回到商品全景并留出放文案的安全区。镜头运动平稳、光线自然，主体始终清晰，不出现水印、价格与无关文字。

- **来源原文提示词**（照它生成案例）：

  > 为图中产品生成一个精美高级的运动饮料广告，注意分镜编排，明快的节奏和快剪，高级的商业广告。

- **封面出图配方**：版式 `case-3up` · 色相 `accent` · 标题「智能成片」 · 主体：一段商品短片的三个关键帧（开场、特写、收束）

#### 首尾帧 · `video.frame`

- **一句话**：两张图锁定镜头起点与终点，中间交给模型
- **子页面**：`/video-creation?id=video.frame`
- **可用性**：ready（现有链路可跑）
- **来源**：我们自研链路 · 
  - 说明：首尾帧是用户批注 #9 点名保留的入口，走我们既有的首尾帧链路；上游公开配方里没有以首尾帧为核心的同款写法，不硬套别的配方
- **我们的配方提示词**（子页面里预填）：

  > 以第一张图作为镜头起点、第二张图作为终点：中间的运动与转场要自然连贯，主体保持同一形状与配色，背景平滑过渡，镜头缓慢推进或平移，不出现跳变、形变与闪烁。

- **来源原文提示词**：暂无（该来源是竞品产品侧或我们自研链路，没有公开配方可抄；需要时以竞品子页面的实际做法为准）

- **封面出图配方**：版式 `case-3up` · 色相 `cool` · 标题「首尾帧」 · 主体：同一镜头首帧与尾帧的对比画面

#### 爆款复刻 · `video.remake`

- **一句话**：保留参考片的节奏与镜头结构，换上你的内容
- **子页面**：`/video-creation?id=video.remake`
- **可用性**：needs_ref（需要参考素材路由，声明支持但未实测出片）
- **来源**：上游官方用例 · Seedance 2.5 官方 use-cases（中文）（403★）
  - 具体位置：`use-cases/zh-CN/02-camera-movement.md#2-3-2-7 超跑广告运镜复刻`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-seedance-2.5-guide/blob/main/use-cases/zh-CN/02-camera-movement.md
  - 说明：官方原话："参考视频1的运镜、画面切换节奏，拿图片1的红色超跑进行复刻"
- **我们的配方提示词**（子页面里预填）：

  > 参考上传视频的节奏与镜头结构，把内容替换成我的商品：保留原来的分镜顺序、景别变化与卡点，画面主体换成我的商品并保持结构、颜色与包装文字一致，光线与原片接近，不出现形变。

- **来源原文提示词**（照它生成案例）：

  > 参考视频1的运镜、画面切换节奏，拿图片1的红色超跑进行复刻。

- **来源自带案例素材**（5 个）：
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-2/7/ref1.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-2/7/ref1.jpg
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-2/7/ref1.mp4
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-2/7/result.jpg
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-2/7/result.mp4

- **封面出图配方**：版式 `case-3up` · 色相 `warm` · 标题「爆款复刻」 · 主体：参考片节奏与替换后成片的对照画面

#### 商品动态展示 · `video.product_motion`

- **一句话**：商品旋转、光影扫过、材质微距，用在主图与详情首屏
- **子页面**：`/video-creation?id=video.product_motion`
- **可用性**：ready（现有链路可跑）
- **来源**：上游官方用例 · Seedance 2.5 官方 use-cases（中文）（403★）
  - 具体位置：`use-cases/zh-CN/02-camera-movement.md#2-3-2-3 产品旋转特写（平板电脑）`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-seedance-2.5-guide/blob/main/use-cases/zh-CN/02-camera-movement.md
  - 说明：官方原话："@图片1的平板电脑作为主体，运镜参考@视频1，推近到屏幕的特写，镜头旋转后平板反转展示全貌"
- **我们的配方提示词**（子页面里预填）：

  > 商品动态展示：从静置开始，缓慢旋转展示结构与材质，光从侧后方扫过突出质感，微距掠过关键细节，最后回到正面全景。背景干净，主体全程锐利对焦，不出现文字与价格。

- **来源原文提示词**（照它生成案例）：

  > @图片1的平板电脑作为主体，运镜参考@视频1，推近到屏幕的特写，镜头旋转后平板 反转展示全貌，屏幕中的数据流一直在变化，周围的环境逐渐变成科幻风格的数据空间

- **来源自带案例素材**（5 个）：
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-2/3/ref1.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-2/3/ref1.jpg
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-2/3/ref1.mp4
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-2/3/result.jpg
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-2/3/result.mp4

- **封面出图配方**：版式 `hero-single` · 色相 `warm` · 标题「商品动态」 · 主体：商品旋转、光影扫过的动态瞬间

#### 内容替换 · `video.content_swap`

- **一句话**：上传人物视频和人物图片，一键换人（知渔同款玩法）
- **子页面**：`/video-creation?id=video.content_swap`
- **可用性**：needs_ref（需要参考素材路由，声明支持但未实测出片）
- **来源**：上游官方用例 · Seedance 2.5 官方 use-cases（中文）（403★）
  - 具体位置：`use-cases/zh-CN/01-consistency.md#2-3-1-2 角色替换 + 风格一致`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-seedance-2.5-guide/blob/main/use-cases/zh-CN/01-consistency.md
  - 说明：官方"角色替换 + 风格一致"用例
- **我们的配方提示词**（子页面里预填）：

  > 保留上传视频里人物的动作与镜头运动，把人物替换成我上传的图片中的人：五官、发型、肤色与服装与图片保持一致，动作连贯自然，边缘干净，不出现脸部抖动或糊边。

- **来源原文提示词**（照它生成案例）：

  > 将@视频1中的女生换成戏曲花旦，场景在一个精美的舞台上，参考@视频1的运镜和 转场效果，利用镜头匹配人物的动作，极致的舞台美感，增强视觉冲击力

- **来源自带案例素材**（4 个）：
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-1/2/ref1.jpg
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-1/2/ref1.mp4
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-1/2/result.jpg
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-1/2/result.mp4

- **封面出图配方**：版式 `case-3up` · 色相 `soft` · 标题「内容替换」 · 主体：同一段动作里人物被替换前后的对照画面

#### 3C 旋转展示 · `video.tech_rotate`

- **一句话**：360 度转一圈，把接口与厚度讲清楚
- **子页面**：`/video-creation?id=video.tech_rotate`
- **可用性**：ready（现有链路可跑）
- **来源**：上游官方用例 · Seedance 2.5 官方 use-cases（中文）（403★）
  - 具体位置：`use-cases/zh-CN/02-camera-movement.md#2-3-2-3 产品旋转特写（平板电脑）`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-seedance-2.5-guide/blob/main/use-cases/zh-CN/02-camera-movement.md
- **我们的配方提示词**（子页面里预填）：

  > 3C 产品旋转展示：产品在纯色台面上缓慢旋转 360 度，途中停两次给特写（接口、按键、厚度侧面），光线干净、反射真实，屏幕与机身质感清晰，全程不出现品牌以外的文字。

- **来源原文提示词**（照它生成案例）：

  > @图片1的平板电脑作为主体，运镜参考@视频1，推近到屏幕的特写，镜头旋转后平板 反转展示全貌，屏幕中的数据流一直在变化，周围的环境逐渐变成科幻风格的数据空间

- **来源自带案例素材**（5 个）：
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-2/3/ref1.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-2/3/ref1.jpg
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-2/3/ref1.mp4
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-2/3/result.jpg
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-2/3/result.mp4

- **封面出图配方**：版式 `hero-single` · 色相 `cool` · 标题「3C旋转展示」 · 主体：数码产品在台面上旋转展示的连续帧

#### 探店漫游 · `video.store_tour`

- **一句话**：推门进去走一圈，把店与货架讲明白
- **子页面**：`/video-creation?id=video.store_tour`
- **可用性**：needs_ref（需要参考素材路由，声明支持但未实测出片）
- **来源**：上游官方用例 · Seedance 2.5 官方 use-cases（中文）（403★）
  - 具体位置：`use-cases/zh-CN/07-continuity.md#2-3-7-1 街头到屋顶追踪跑步`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-seedance-2.5-guide/blob/main/use-cases/zh-CN/07-continuity.md
  - 说明：官方一镜到底（进店 → 动线 → 停留）
- **我们的配方提示词**（子页面里预填）：

  > 探店漫游：镜头从店门口推进，沿动线走过货架与展示区，在重点商品前停留并给特写，最后停在店内最有氛围的一角；运动平稳、光线真实，空间结构一致，不出现虚构的品牌与价格。

- **来源原文提示词**（照它生成案例）：

  > @图片1@图片2@图片3@图片4@图片5，一镜到底的追踪镜头，从街头跟随跑步者上楼梯、 穿过走廊、进入屋顶，最终俯瞰城市。

- **来源自带案例素材**（7 个）：
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-7/1/ref1.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-7/1/ref2.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-7/1/ref3.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-7/1/ref4.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-7/1/ref5.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-7/1/result.jpg
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-7/1/result.mp4

- **封面出图配方**：版式 `case-3up` · 色相 `accent` · 标题「探店漫游」 · 主体：从店门口到货架再到重点商品的三帧

### 热门玩法

#### 图生视频 · `video.image_to_video`

- **一句话**：一张商品图动起来，适合主图视频与详情动效
- **子页面**：`/video-creation?id=video.image_to_video`
- **可用性**：ready（现有链路可跑）
- **来源**：高星开源库 · Seedance 2.0 九大商用玩法（卡尔的AI沃茨）（2415★）
  - 具体位置：`prompts/commercial-use-cases.md#6 动态海报`
  - 跟踪链接：https://github.com/ZeroLu/awesome-seedance/blob/main/prompts/commercial-use-cases.md
  - 说明：官方商用玩法里的"动态海报"：单图动起来
- **我们的配方提示词**（子页面里预填）：

  > 让这张商品图动起来：主体轻微旋转约 15 度展示侧面，环境光缓慢扫过表面形成高光流动，背景保持稳定，镜头微推，画面干净、不出现多余元素与文字。

- **来源原文提示词**（照它生成案例）：

  > 一个15秒竖屏 9:16 的卡点音乐短片，背景音乐使用@音频1，视频全程保持固定机位景别不变，就像是在一个固定的位置定点拍摄一样，视频中的元素陆续按@图片1中的九宫格分镜依次显现，从左上角第一个镜头作为开始从左到右、从上到下依次推进。

- **封面出图配方**：版式 `hero-single` · 色相 `warm` · 标题「图生视频」 · 主体：一件商品静图与它动起来后的画面并置

#### 运镜控制 · `video.camera_move`

- **一句话**：推、拉、摇、移、环绕，指定镜头怎么走
- **子页面**：`/video-creation?id=video.camera_move`
- **可用性**：ready（现有链路可跑）
- **来源**：上游官方用例 · Seedance 2.5 官方 use-cases（中文）（403★）
  - 具体位置：`use-cases/zh-CN/02-camera-movement.md#2-3-2-1 希区柯克变焦 + 机械臂环绕`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-seedance-2.5-guide/blob/main/use-cases/zh-CN/02-camera-movement.md
  - 说明：官方"运镜复刻"整章：希区柯克变焦 / 机械臂环绕 / 推拉跟拍
- **我们的配方提示词**（子页面里预填）：

  > 镜头运动明确：从全景缓慢推近到主体特写，再平移展示侧面，最后拉远回到全景。运动速度均匀、全程对焦稳定，不出现画面抖动与主体漂移。

- **来源原文提示词**（照它生成案例）：

  > 参考@图1的男人形象，他在@图2的电梯中，完全参考@视频1的所有运镜效果还有主角的 面部表情，主角在惊恐时希区柯克变焦，然后几个环绕镜头展示电梯内视角，电梯门打开， 跟随镜头走出电梯，电梯外场景参考@图片3，男人环顾四周，参考@视频1用机械臂多角度 跟随人物的视线

- **来源自带案例素材**（7 个）：
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-2/1/ref1.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-2/1/ref2.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-2/1/ref3.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-2/1/ref1.jpg
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-2/1/ref1.mp4
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-2/1/result.jpg
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-2/1/result.mp4

- **封面出图配方**：版式 `case-3up` · 色相 `accent` · 标题「运镜控制」 · 主体：同一场景下推、移、环绕三种运镜的画面

#### 红绿灯换装 · `video.traffic_swap`

- **一句话**：红灯亮起换一套衣服，卡着信号灯变装
- **子页面**：`/video-creation?id=video.traffic_swap`
- **可用性**：ready（现有链路可跑）
- **来源**：上游官方用例 · Seedance 2.5 官方 use-cases（中文）（403★）
  - 具体位置：`use-cases/zh-CN/03-creative-effects.md#2-3-3-2 鱼眼换装闪切`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-seedance-2.5-guide/blob/main/use-cases/zh-CN/03-creative-effects.md
  - 说明：官方换装闪切用例（每次更换伴随切镜）
- **我们的配方提示词**（子页面里预填）：

  > 红绿灯换装：人物站在路口，信号灯每变一次颜色就换一套完整穿搭（红→绿→黄三套），换装瞬间用轻微的运动模糊或遮挡带过，人物位置与镜头不动，服装材质与配色清晰可辨，节奏跟信号灯同步。

- **来源原文提示词**（照它生成案例）：

  > 参考第一张图片里模特的五官长相。模特分别穿着第2-6张参考图里的服装凑近镜头， 做出调皮、冷酷、可爱、惊讶、耍帅的造型，每一个造型穿着不同服装，每次更换， 画面伴随会切镜，参考视频的里鱼眼镜头效果、重影闪烁的炫影画面效果，参考@视频1

- **来源自带案例素材**（10 个）：
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-3/2/ref1.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-3/2/ref2.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-3/2/ref3.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-3/2/ref4.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-3/2/ref5.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-3/2/ref6.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-3/2/ref1.jpg
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-3/2/ref1.mp4
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-3/2/result.jpg
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-3/2/result.mp4

- **封面出图配方**：版式 `case-3up` · 色相 `accent` · 标题「红绿灯换装」 · 主体：同一个人在同一路口三套穿搭的换装关键帧

#### 车内一周换装 · `video.car_weekly`

- **一句话**：坐进车里，一周七套穿搭依次换
- **子页面**：`/video-creation?id=video.car_weekly`
- **可用性**：ready（现有链路可跑）
- **来源**：上游官方用例 · Seedance 2.5 官方 use-cases（中文）（403★）
  - 具体位置：`use-cases/zh-CN/09-music-sync.md#2-3-9-1 时尚换装卡点`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-seedance-2.5-guide/blob/main/use-cases/zh-CN/09-music-sync.md
  - 说明：官方卡点换装：同一人物持续换装
- **我们的配方提示词**（子页面里预填）：

  > 车内一周换装：固定机位拍车内，同一个人依次换上七套不同穿搭（周一通勤 → 周五休闲 → 周末出游），每次切换用关门、转头或抬手遮挡过渡，坐姿与车内环境不变，服装细节清楚。

- **来源原文提示词**（照它生成案例）：

  > 海报中的女生在不停的换装，服装参考@图片1@图片2的样式，手中提着@图片3的包， 视频节奏参考@视频

- **来源自带案例素材**（8 个）：
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-9/1/ref1.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-9/1/ref2.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-9/1/ref3.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-9/1/ref4.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-9/1/ref1.jpg
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-9/1/ref1.mp4
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-9/1/result.jpg
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-9/1/result.mp4

- **封面出图配方**：版式 `case-3up` · 色相 `soft` · 标题「车内换装」 · 主体：车内固定机位下七套穿搭依次切换的关键帧

#### 服饰变装转场 · `video.outfit_transition`

- **一句话**：卡点或色卡转场，一镜换多套
- **子页面**：`/video-creation?id=video.outfit_transition`
- **可用性**：needs_ref（需要参考素材路由，声明支持但未实测出片）
- **来源**：上游官方用例 · Seedance 2.5 官方 use-cases（中文）（403★）
  - 具体位置：`use-cases/zh-CN/03-creative-effects.md#2-3-3-2 鱼眼换装闪切`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-seedance-2.5-guide/blob/main/use-cases/zh-CN/03-creative-effects.md
  - 说明：官方转场换装（鱼眼镜头 / 重影闪烁）
- **我们的配方提示词**（子页面里预填）：

  > 服饰变装转场：跟着音乐卡点换装，每次转场用一个道具或色卡遮住镜头（挥手、甩发、举卡片），换完立刻接下一套；人物位置、机位与光线保持一致，服装质感与配色清晰，节奏干净利落。

- **来源原文提示词**（照它生成案例）：

  > 参考第一张图片里模特的五官长相。模特分别穿着第2-6张参考图里的服装凑近镜头， 做出调皮、冷酷、可爱、惊讶、耍帅的造型，每一个造型穿着不同服装，每次更换， 画面伴随会切镜，参考视频的里鱼眼镜头效果、重影闪烁的炫影画面效果，参考@视频1

- **来源自带案例素材**（10 个）：
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-3/2/ref1.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-3/2/ref2.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-3/2/ref3.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-3/2/ref4.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-3/2/ref5.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-3/2/ref6.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-3/2/ref1.jpg
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-3/2/ref1.mp4
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-3/2/result.jpg
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-3/2/result.mp4

- **封面出图配方**：版式 `case-3up` · 色相 `accent` · 标题「变装转场」 · 主体：卡点转场换装的连续三帧画面

#### 擦雾出产品 · `video.fog_reveal`

- **一句话**：手指擦开雾气，商品从模糊里露出来
- **子页面**：`/video-creation?id=video.fog_reveal`
- **可用性**：ready（现有链路可跑）
- **来源**：高星开源库 · awesome-gpt-image-2（广告创意用例）（17199★）
  - 具体位置：`cases/ad-creative.md#Case37 SPLASH 液态 Logo`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/blob/main/cases/ad-creative.md
  - 说明：以官方仓库里"揭示式"广告配方为骨架
- **我们的配方提示词**（子页面里预填）：

  > 擦雾出产品：镜头贴着一层雾面（玻璃/镜面/冷藏柜门），一只手从画面一侧擦开雾气，商品从模糊逐渐变清晰，擦过的区域留下清晰的水痕；最后停在商品特写上，光线通透、细节锐利。

- **来源原文提示词**（照它生成案例）：

  > Hyper-realistic fashion campaign poster for brand "SPLASH". A girl (matching the reference photo exactly, same face) seated confidently atop a gleaming, water-like 3D SPLASH logo surrounded by dynamic water splash effects. Editorial pose: one leg loose, one bent. Enormous bold "SPLASH" typography fills the background, partially behind her. Small tagline reads: "Own Your Style." Clothing: contemporary black streetwear (blazer, fitted top, trousers, sneakers). Lighting: cinematic studio setup with soft key light and rim light, glossy reflections on the liquid logo. Style: luxury fashion campaign aesthetic (Zara / H&M), polished clean environment. Shot with an 85mm lens, shallow depth of field, 8K resolution, ultra-detailed, photorealistic.

- **封面出图配方**：版式 `hero-single` · 色相 `cool` · 标题「擦雾出产品」 · 主体：手指擦开雾气后商品从模糊变清晰的一帧

#### 一图裂变展示 · `video.one_image_showcase`

- **一句话**：一张商品图，裂变成一整组展示镜头
- **子页面**：`/video-creation?id=video.one_image_showcase`
- **可用性**：ready（现有链路可跑）
- **来源**：高星开源库 · awesome-gpt-image-2（电商用例）（17199★）
  - 具体位置：`cases/ecommerce.md#Case116 Industrial Design Presentation Sheet`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/blob/main/cases/ecommerce.md
  - 说明：一图裂变成多格展示（工业设计展示板）的视频化
- **我们的配方提示词**（子页面里预填）：

  > 一图裂变展示：从一张商品图开始，画面像卡片一样裂开成多格，每一格展示商品的一个面（正面、侧面、细节、场景、包装），最后所有格子合回完整商品；转场干净、比例一致，商品结构不变。

- **来源原文提示词**（照它生成案例）：

  > Core Subject: [{argument name="reference" default="use the uploaded image"}, keep the details, typography and structure locked 100%] Layout & Composition: A {argument name="presentation type" default="professional industrial design presentation sheet"}. The image should be organized into a clean grid system. Top Row: A 3x3 layout showing top-down flat lay views and close-up macro details of materials. Middle Section: Three hero shots of the product standing upright in different color ways (Matte Black, Arctic White, and accented variants). The products should be slightly tilted to show depth and form. Bottom Section: A dynamic "floating" composition featuring two products overlapping at opposing angles to showcase the front and side profiles simultaneously. Environment & Lighting: Set against a minimalist, neutral studio gray background. Soft top-down lighting with realistic contact shadows. High-end product photography aesthetic. Style & Finish: Matte textures, clean silhouettes, and sharp edges. Leave designated blank areas on the product surfaces for "Placeholder Branding" and "Graphic Mockups." 4k resolution, Unreal Engine 5 render style, hyper-realistic, clean aesthetic.

- **来源自带案例素材**（1 个）：
  - https://raw.githubusercontent.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/main/images/poster_case116/output.jpg

- **封面出图配方**：版式 `case-3up` · 色相 `warm` · 标题「一图裂变」 · 主体：一张商品图裂变成多格展示的关键帧

#### 分镜转视频 · `video.storyboard_to_video`

- **一句话**：把分镜脚本逐格拍成成片
- **子页面**：`/video-creation?id=video.storyboard_to_video`
- **可用性**：ready（现有链路可跑）
- **来源**：上游官方用例 · Seedance 2.5 官方 use-cases（中文）（403★）
  - 具体位置：`use-cases/zh-CN/04-story-completion.md#2-3-4-2 分镜脚本转视频`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-seedance-2.5-guide/blob/main/use-cases/zh-CN/04-story-completion.md
  - 说明：官方"分镜脚本转视频"用例
- **我们的配方提示词**（子页面里预填）：

  > 按上传的分镜脚本逐格生成视频：每个分镜的景别、动作与台词按脚本走，镜头之间用干净的切或短过渡衔接，整体节奏统一；角色、场景与商品在各分镜中保持一致，不出现人物变形或商品改样。

- **来源原文提示词**（照它生成案例）：

  > 参考@图片1的专题片的分镜头脚本，参考@图片1的分镜、景别、运镜、画面和文案， 创作一段15s的关于"童年的四季"的治愈系片头

- **来源自带案例素材**（3 个）：
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-4/2/ref1.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-4/2/result.jpg
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-4/2/result.mp4

- **封面出图配方**：版式 `case-3up` · 色相 `accent` · 标题「分镜转视频」 · 主体：分镜脚本与对应成片的三帧对照

### 人像摄影

#### 模特动态 · `video.model_runway`

- **一句话**：让模特照片走起来：转身、迈步、衣摆飘动
- **子页面**：`/video-creation?id=video.model_runway`
- **可用性**：ready（现有链路可跑）
- **来源**：上游官方用例 · Seedance 2.5 官方 use-cases（中文）（403★）
  - 具体位置：`use-cases/zh-CN/09-music-sync.md#2-3-9-1 时尚换装卡点`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-seedance-2.5-guide/blob/main/use-cases/zh-CN/09-music-sync.md
  - 说明：以官方卡点换装用例为骨架（人物动起来部分）
- **我们的配方提示词**（子页面里预填）：

  > 让模特照片走起来：转身、迈步、衣摆自然飘动，镜头跟随并保持人物在画面中央，光线稳定，布料垂坠感真实，五官与服装细节保持清晰，不出现肢体变形。

- **来源原文提示词**（照它生成案例）：

  > 海报中的女生在不停的换装，服装参考@图片1@图片2的样式，手中提着@图片3的包， 视频节奏参考@视频

- **来源自带案例素材**（8 个）：
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-9/1/ref1.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-9/1/ref2.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-9/1/ref3.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-9/1/ref4.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-9/1/ref1.jpg
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-9/1/ref1.mp4
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-9/1/result.jpg
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-9/1/result.mp4

- **封面出图配方**：版式 `hero-single` · 色相 `soft` · 标题「模特动态」 · 主体：模特转身迈步、衣摆飘动的瞬间

#### 美妆质感特写 · `video.beauty_macro`

- **一句话**：膏体、粉质、上脸，微距讲质感
- **子页面**：`/video-creation?id=video.beauty_macro`
- **可用性**：ready（现有链路可跑）
- **来源**：高星开源库 · awesome-gpt-image-2（电商用例）（17199★）
  - 具体位置：`cases/ecommerce.md#Case114 Skincare Product Studio Shot`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/blob/main/cases/ecommerce.md
  - 说明：官方仓库护肤静物配方（质地 / 成分）的视频化
- **我们的配方提示词**（子页面里预填）：

  > 美妆质感特写：微距镜头依次展示膏体挤出/粉质扫过/液体流动的质感，再切到上脸后的皮肤状态（服帖、光泽、不卡粉），光线柔和不油光；颜色真实，不出现夸大功效的文字。

- **来源原文提示词**（照它生成案例）：

  > A soft {argument name="bottle color" default="cream-colored"} bottle with a {argument name="pump color" default="pastel yellow"} pump stands on a matte podium, surrounded by silky foam and {argument name="flowers" default="chamomile blossoms"}. The background is a pale yellow gradient with subtle bubble details. The label emphasizes organic chamomile and calming care. Fresh chamomile flowers accentuate the gentle appeal.

- **来源自带案例素材**（1 个）：
  - https://raw.githubusercontent.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/main/images/poster_case114/output.jpg

- **封面出图配方**：版式 `hero-single` · 色相 `soft` · 标题「美妆特写」 · 主体：膏体质地与上脸后皮肤状态的微距关键帧

#### 服装街拍带货 · `video.street_style`

- **一句话**：街头走两步，把版型与搭配演出来
- **子页面**：`/video-creation?id=video.street_style`
- **可用性**：ready（现有链路可跑）
- **来源**：上游官方用例 · Seedance 2.5 官方 use-cases（中文）（403★）
  - 具体位置：`use-cases/zh-CN/02-camera-movement.md#2-3-2-2 拐角追逐 + 多场景跟拍`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-seedance-2.5-guide/blob/main/use-cases/zh-CN/02-camera-movement.md
  - 说明：官方跟拍运镜用例
- **我们的配方提示词**（子页面里预填）：

  > 服装街拍带货：模特在街头自然走动、转身、整理衣领，镜头跟随并保持全身入画；展示版型、垂坠与搭配细节，光线是自然日光，背景有城市氛围但不抢主体，服装颜色真实。

- **来源原文提示词**（照它生成案例）：

  > 参考@图1的男人形象，他在@图2的走廊中，完全参考@视频1的所有运镜效果，还有主角的 面部表情，镜头跟随主角在@图2拐角奔跑，然后在@图3的长廊里，镜头从背面的跟随视角， 通过低视角环绕到主角正面；镜头再右摇90度拍摄@图片4的分叉路口，急停后右摇180度， 怼脸拍摄主角正面：主角气喘吁吁，镜头跟随主角的视角环顾四周，参考@视频1里急速的 左右环绕运镜展示场景，后拉到@图片5的场景，继续跟拍主角奔跑的侧面视角

- **来源自带案例素材**（9 个）：
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-2/2/ref1.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-2/2/ref2.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-2/2/ref3.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-2/2/ref4.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-2/2/ref5.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-2/2/ref1.jpg
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-2/2/ref1.mp4
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-2/2/result.jpg
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-2/2/result.mp4

- **封面出图配方**：版式 `case-3up` · 色相 `warm` · 标题「街拍带货」 · 主体：街头走动、转身与细节展示的三个关键帧

#### AI 模特换装 · `video.ai_styling`

- **一句话**：同一模特，把几套衣服依次穿上
- **子页面**：`/video-creation?id=video.ai_styling`
- **可用性**：needs_ref（需要参考素材路由，声明支持但未实测出片）
- **来源**：上游官方用例 · Seedance 2.5 官方 use-cases（中文）（403★）
  - 具体位置：`use-cases/zh-CN/01-consistency.md#2-3-1-2 角色替换 + 风格一致`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-seedance-2.5-guide/blob/main/use-cases/zh-CN/01-consistency.md
  - 说明：官方角色替换 + 风格一致；换装需要参考素材路由
- **我们的配方提示词**（子页面里预填）：

  > AI 模特换装：保持同一位模特的脸、发型与身材不变，依次换上多套服装，每次换装用一个转身或抬手遮挡过渡；服装版型与面料质感真实，站姿与机位保持一致，不出现肢体变形。

- **来源原文提示词**（照它生成案例）：

  > 将@视频1中的女生换成戏曲花旦，场景在一个精美的舞台上，参考@视频1的运镜和 转场效果，利用镜头匹配人物的动作，极致的舞台美感，增强视觉冲击力

- **来源自带案例素材**（4 个）：
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-1/2/ref1.jpg
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-1/2/ref1.mp4
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-1/2/result.jpg
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-1/2/result.mp4

- **封面出图配方**：版式 `case-3up` · 色相 `soft` · 标题「AI模特换装」 · 主体：同一位模特换上多套服装的关键帧

### 创意应用

#### 延长续写 · `video.extend`

- **一句话**：接着上一段往下拍，保持主体与光线连续
- **子页面**：`/video-creation?id=video.extend`
- **可用性**：blocked（上游能力暂缺，上架前必须转 ready）
- **来源**：上游官方用例 · Seedance 2.5 官方 use-cases（中文）（403★）
  - 具体位置：`use-cases/zh-CN/05-video-extension.md#2-3-5-2 健身广告（延长 6s）`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-seedance-2.5-guide/blob/main/use-cases/zh-CN/05-video-extension.md
  - 说明：官方视频延长用例（我们有这条能力后即可转 ready）
- **我们的配方提示词**（子页面里预填）：

  > 在已有成片的最后一帧继续往下拍：动作与光线要接得上，镜头运动与上一段保持一致，主体形状与配色不变，不出现跳帧、闪烁或变形。

- **来源原文提示词**（照它生成案例）：

  > 6s 将视频延长6s，出现电吉他的激昂音乐，视频中间出现"JUST DO IT"的广告字体后逐渐淡化， 镜头上移到天花板，一个健硕的男人拉着吊环，上半身穿着@图1的紧身健身服，背面印有 @图2的"Fitness"logo，男人用健硕的上肢拉上吊环，随后视频中间出现"DO SOME SPORT" 的广告结束字体。

- **来源自带案例素材**（6 个）：
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-5/2/ref1.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-5/2/ref2.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-5/2/ref1.jpg
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-5/2/ref1.mp4
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-5/2/result.jpg
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-5/2/result.mp4

- **封面出图配方**：版式 `case-3up` · 色相 `cool` · 标题「延长续写」 · 主体：同一镜头前后两段连续画面的衔接

#### 节日营销短片 · `video.festival_spot`

- **一句话**：节点氛围 + 商品，适合大促与节日投放
- **子页面**：`/video-creation?id=video.festival_spot`
- **可用性**：ready（现有链路可跑）
- **来源**：高星开源库 · Seedance 2.0 九大商用玩法（卡尔的AI沃茨）（2415★）
  - 具体位置：`prompts/commercial-use-cases.md#3 品牌宣传`
  - 跟踪链接：https://github.com/ZeroLu/awesome-seedance/blob/main/prompts/commercial-use-cases.md
  - 说明：官方商用玩法"品牌宣传片"
- **我们的配方提示词**（子页面里预填）：

  > 做一支节日营销短片：开场用节日氛围元素（灯串、暖光、装饰）铺氛围，中段展示商品与节日场景的结合，结尾回到商品并留出放文案的安全区。色调统一、节奏轻快，不出现臆造的品牌与价格。

- **来源原文提示词**（照它生成案例）：

  > 帮我生成一个讲述无印良品这个品牌的宣传片，中间植入这个台灯

- **封面出图配方**：版式 `poster-style` · 色相 `accent` · 标题「节日短片」 · 主体：节日氛围中的商品短片关键画面

#### 图书知识带货 · `video.book_selling`

- **一句话**：翻页、金句、场景，把一本书讲清楚
- **子页面**：`/video-creation?id=video.book_selling`
- **可用性**：ready（现有链路可跑）
- **来源**：上游官方用例 · Seedance 2.5 官方 use-cases（中文）（403★）
  - 具体位置：`use-cases/zh-CN/04-story-completion.md#2-3-4-1 漫画分格动态演绎`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-seedance-2.5-guide/blob/main/use-cases/zh-CN/04-story-completion.md
  - 说明：官方"分格动态演绎"配方（书页/分格翻动）
- **我们的配方提示词**（子页面里预填）：

  > 图书知识带货：书在桌面被翻开，书页依次翻动并停在几个关键页，穿插书中场景的意象画面，最后回到封面；画面干净、光线柔和，书名字迹清楚，不出现臆造的推荐语与销量数字。

- **来源原文提示词**（照它生成案例）：

  > 将@图1以从左到右从上到下的顺序进行漫画演绎，保持人物说的台词与图片上的一致， 分镜切换以及重点的情节演绎加入特殊音效，整体风格诙谐幽默；演绎方式参考@视频1

- **来源自带案例素材**（4 个）：
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-4/1/ref1.jpg
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-4/1/ref1.mp4
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-4/1/result.jpg
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-4/1/result.mp4

- **封面出图配方**：版式 `case-3up` · 色相 `warm` · 标题「图书带货」 · 主体：书页翻动与封面收束的三个关键帧

#### 美食吃播 ASMR · `video.food_asmr`

- **一句话**：近距离的咀嚼与热气，声音画面一起上
- **子页面**：`/video-creation?id=video.food_asmr`
- **可用性**：needs_ref（需要参考素材路由，声明支持但未实测出片）
- **来源**：上游官方用例 · Seedance 2.5 官方 use-cases（中文）（403★）
  - 具体位置：`use-cases/zh-CN/06-audio-voice.md#2-3-6-0 鱼眼马头 + 多视频音效参考`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-seedance-2.5-guide/blob/main/use-cases/zh-CN/06-audio-voice.md
  - 说明：官方音色/声音整章（吃播的收音与节奏以此为准）
- **我们的配方提示词**（子页面里预填）：

  > 美食吃播 ASMR：近距离镜头对着食物与餐具，收音感强（咀嚼、撕开、倒汤、气泡），热气与油光清晰，镜头缓慢推近并保持稳定；色调暖、氛围安静，不出现文字与价格。

- **来源原文提示词**（照它生成案例）：

  > 固定镜头，中央鱼眼镜头透过圆形孔洞向下窥视，参考视频1的鱼眼镜头，让@视频2中的马 看向鱼眼镜头，参考@视频1中的说话动作，背景BGM参考@视频3中的音效。

- **来源自带案例素材**（6 个）：
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-6/1/ref1.jpg
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-6/1/ref1.mp4
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-6/1/ref2.jpg
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-6/1/ref2.mp4
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-6/1/result.jpg
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-6/1/result.mp4

- **封面出图配方**：版式 `hero-single` · 色相 `warm` · 标题「吃播ASMR」 · 主体：近距离食物与餐具的高收音画面

#### 画面修改 · `video.scene_edit`

- **一句话**：只改指定元素，其它一律不动
- **子页面**：`/video-creation?id=video.scene_edit`
- **可用性**：needs_ref（需要参考素材路由，声明支持但未实测出片）
- **来源**：上游官方用例 · Seedance 2.5 官方 use-cases（中文）（403★）
  - 具体位置：`use-cases/zh-CN/08-video-editing.md#2-3-8-4 背景添加大白鲨 + 发色修改`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-seedance-2.5-guide/blob/main/use-cases/zh-CN/08-video-editing.md
  - 说明：官方"只改指定元素"用例（换发色 / 加背景物体）
- **我们的配方提示词**（子页面里预填）：

  > 只修改画面里指定的那个元素（换发色 / 加一个背景物体 / 去掉杂物），其余一律不动：原片的人物、动作、镜头与构图保持不变，新增元素的光影、景深与色温要和原片一致，不出现边缘割裂或闪烁。

- **来源原文提示词**（照它生成案例）：

  > 将视频1女人发型变成红色长发，图片1中的大白鲨缓缓浮出半个脑袋，在她身后。

- **来源自带案例素材**（5 个）：
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-8/4/ref1.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-8/4/ref1.jpg
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-8/4/ref1.mp4
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-8/4/result.jpg
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-8/4/result.mp4

- **封面出图配方**：版式 `before-after` · 色相 `accent` · 标题「画面修改」 · 主体：同一画面修改前后的并排对照（只换指定元素）

### 建筑家装

#### 空间漫游 · `video.space_tour`

- **一句话**：镜头沿动线走一遍，把空间讲明白
- **子页面**：`/video-creation?id=video.space_tour`
- **可用性**：ready（现有链路可跑）
- **来源**：上游官方用例 · Seedance 2.5 官方 use-cases（中文）（403★）
  - 具体位置：`use-cases/zh-CN/07-continuity.md#2-3-7-1 街头到屋顶追踪跑步`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-seedance-2.5-guide/blob/main/use-cases/zh-CN/07-continuity.md
  - 说明：一镜到底整章（木屋围炉推进 / 飞机窗外到机舱内）是空间漫游的官方骨架
- **我们的配方提示词**（子页面里预填）：

  > 用上传的空间图做一段漫游：镜头从入口缓慢推进，沿动线依次掠过主要区域（客厅 → 餐厅 → 主卧），最后停在视觉中心。运动平稳、透视一致、光线自然，空间比例与材质保持真实，不出现家具变形或穿模。

- **来源原文提示词**（照它生成案例）：

  > @图片1@图片2@图片3@图片4@图片5，一镜到底的追踪镜头，从街头跟随跑步者上楼梯、 穿过走廊、进入屋顶，最终俯瞰城市。

- **来源自带案例素材**（7 个）：
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-7/1/ref1.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-7/1/ref2.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-7/1/ref3.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-7/1/ref4.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-7/1/ref5.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-7/1/result.jpg
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-7/1/result.mp4

- **封面出图配方**：版式 `case-3up` · 色相 `cool` · 标题「空间漫游」 · 主体：镜头沿动线穿过客厅、餐厅、主卧的三个关键帧

#### 光线变化 · `video.light_shift`

- **一句话**：机位不动，只让光线与阴影走一遍
- **子页面**：`/video-creation?id=video.light_shift`
- **可用性**：ready（现有链路可跑）
- **来源**：竞品产品侧 · 知渔 AI 实测清单（图片 110 条 / 视频 32 条）
  - 具体位置：`视频制作 / 建筑室内 / 光线变化`
  - 跟踪链接：https://laoyu.quantv.com
  - 说明：开源侧无成熟库，以竞品产品侧清单为准
- **我们的配方提示词**（子页面里预填）：

  > 机位固定不动，只让光线随时间变化：清晨冷调 → 正午明亮 → 黄昏暖调 → 夜晚灯光亮起。阴影方向与色温随之平滑过渡，画面结构、家具位置保持不变，过渡自然无跳变。

- **来源原文提示词**：暂无（该来源是竞品产品侧或我们自研链路，没有公开配方可抄；需要时以竞品子页面的实际做法为准）

- **封面出图配方**：版式 `case-3up` · 色相 `warm` · 标题「光线变化」 · 主体：同一空间清晨、正午、黄昏、夜晚的四帧光线对比

#### 日夜气候切换 · `video.day_night`

- **一句话**：白天到雨夜，同一场景的四种天气
- **子页面**：`/video-creation?id=video.day_night`
- **可用性**：ready（现有链路可跑）
- **来源**：竞品产品侧 · 知渔 AI 实测清单（图片 110 条 / 视频 32 条）
  - 具体位置：`视频制作 / 建筑室内 / 日夜气候切换`
  - 跟踪链接：https://laoyu.quantv.com
- **我们的配方提示词**（子页面里预填）：

  > 同一个场景在日夜与天气之间切换：白天 → 黄昏 → 夜晚 → 雨夜，云层、反光与地面湿度随之变化，镜头缓慢平移，建筑与空间结构全程保持不变，过渡平滑。

- **来源原文提示词**：暂无（该来源是竞品产品侧或我们自研链路，没有公开配方可抄；需要时以竞品子页面的实际做法为准）

- **封面出图配方**：版式 `case-3up` · 色相 `cool` · 标题「日夜切换」 · 主体：同一场景白天、黄昏、夜晚、雨夜的四帧对比

#### 软装进场 · `video.furnishing_in`

- **一句话**：家具与软装依次落位，空房变样板间
- **子页面**：`/video-creation?id=video.furnishing_in`
- **可用性**：ready（现有链路可跑）
- **来源**：竞品产品侧 · 知渔 AI 实测清单（图片 110 条 / 视频 32 条）
  - 具体位置：`视频制作 / 建筑室内 / 软装进场`
  - 跟踪链接：https://laoyu.quantv.com
- **我们的配方提示词**（子页面里预填）：

  > 家具与软装依次进场：沙发、茶几、灯具、地毯按顺序落位，动作轻快自然，镜头缓慢后退展示整体效果。空间结构与比例不变，材质与配色统一，不出现家具漂浮或穿墙。

- **来源原文提示词**：暂无（该来源是竞品产品侧或我们自研链路，没有公开配方可抄；需要时以竞品子页面的实际做法为准）

- **封面出图配方**：版式 `case-3up` · 色相 `soft` · 标题「软装进场」 · 主体：空房到家具软装依次落位的三个关键帧

#### 户型生长 · `video.floorplan_grow`

- **一句话**：从户型图长出一整套三维空间
- **子页面**：`/video-creation?id=video.floorplan_grow`
- **可用性**：needs_ref（需要参考素材路由，声明支持但未实测出片）
- **来源**：竞品产品侧 · 知渔 AI 实测清单（图片 110 条 / 视频 32 条）
  - 具体位置：`视频制作 / 建筑室内 / 户型生长`
  - 跟踪链接：https://laoyu.quantv.com
- **我们的配方提示词**（子页面里预填）：

  > 从上传的户型图开始生长出三维空间：墙体、地面、家具依次出现并归位，镜头缓慢俯冲进入室内，最后停在主空间全景。生长顺序清楚、比例可信，房间数量与位置与户型图一致。

- **来源原文提示词**：暂无（该来源是竞品产品侧或我们自研链路，没有公开配方可抄；需要时以竞品子页面的实际做法为准）

- **封面出图配方**：版式 `case-3up` · 色相 `accent` · 标题「户型生长」 · 主体：户型图到三维空间生长的三个关键帧

#### 建筑生长 · `video.building_grow`

- **一句话**：建筑从地基逐层长起来
- **子页面**：`/video-creation?id=video.building_grow`
- **可用性**：needs_ref（需要参考素材路由，声明支持但未实测出片）
- **来源**：竞品产品侧 · 知渔 AI 实测清单（图片 110 条 / 视频 32 条）
  - 具体位置：`视频制作 / 建筑室内 / 建筑生长`
  - 跟踪链接：https://laoyu.quantv.com
- **我们的配方提示词**（子页面里预填）：

  > 建筑从地基开始逐层生长：结构、幕墙、灯光依次出现，镜头缓慢环绕上升，最后定格在完整外观。节奏均匀、透视一致，建筑轮廓与层数保持不变，不出现结构错位。

- **来源原文提示词**：暂无（该来源是竞品产品侧或我们自研链路，没有公开配方可抄；需要时以竞品子页面的实际做法为准）

- **封面出图配方**：版式 `hero-single` · 色相 `cool` · 标题「建筑生长」 · 主体：建筑从地基逐层长成的三个关键帧

#### 植物生长 · `video.plant_grow`

- **一句话**：抽芽、展叶、开花，时间加速的连续动作
- **子页面**：`/video-creation?id=video.plant_grow`
- **可用性**：ready（现有链路可跑）
- **来源**：竞品产品侧 · 知渔 AI 实测清单（图片 110 条 / 视频 32 条）
  - 具体位置：`视频制作 / 建筑室内 / 植物生长`
  - 跟踪链接：https://laoyu.quantv.com
- **我们的配方提示词**（子页面里预填）：

  > 植物从幼苗开始生长：抽芽、展叶、开花，时间加速但动作连续不跳跃，镜头缓慢推进，背景与光线保持稳定，叶片形状与色彩自然。

- **来源原文提示词**：暂无（该来源是竞品产品侧或我们自研链路，没有公开配方可抄；需要时以竞品子页面的实际做法为准）

- **封面出图配方**：版式 `hero-single` · 色相 `soft` · 标题「植物生长」 · 主体：植物抽芽、展叶、开花的三帧连续画面

#### 空间叙事短片 · `video.interior_story`

- **一句话**：一支短片讲这个空间的一天
- **子页面**：`/video-creation?id=video.interior_story`
- **可用性**：ready（现有链路可跑）
- **来源**：上游官方用例 · Seedance 2.5 官方 use-cases（中文）（403★）
  - 具体位置：`use-cases/zh-CN/04-story-completion.md#2-3-4-3 图片情绪发散成视频`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-seedance-2.5-guide/blob/main/use-cases/zh-CN/04-story-completion.md
  - 说明：官方"剧情补全"整章是空间叙事的骨架
- **我们的配方提示词**（子页面里预填）：

  > 用一支短片讲这个空间的一天：人物进入、坐下、使用与离开，穿插空间细节与光线变化，镜头语言克制、节奏舒缓，像一支空间宣传片；结尾停在最能代表这个空间的一帧，不出现文字与水印。

- **来源原文提示词**（照它生成案例）：

  > 参考视频1的音频，根据图1、图2、图3、图4、图5为灵感，发散出一条情绪向的视频。 背景音乐参考@视频1

- **来源自带案例素材**（7 个）：
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-4/3/ref1.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-4/3/ref2.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-4/3/ref3.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-4/3/ref4.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-4/3/ref5.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-4/3/result.jpg
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-4/3/result.mp4

- **封面出图配方**：版式 `case-3up` · 色相 `warm` · 标题「空间叙事」 · 主体：人物在空间里一天活动的三个关键帧

### 电商专区

#### 产品爆炸展示 · `video.product_explode`

- **一句话**：商品在空中炸开，零件与成分悬浮
- **子页面**：`/video-creation?id=video.product_explode`
- **可用性**：ready（现有链路可跑）
- **来源**：高星开源库 · awesome-gpt-image-2（广告创意用例）（17199★）
  - 具体位置：`cases/ad-creative.md#Case109 VR Headset Exploded View Poster`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/blob/main/cases/ad-creative.md
  - 说明：爆炸视图配方的视频化（官方用例里是静帧海报）
- **我们的配方提示词**（子页面里预填）：

  > 产品爆炸展示：商品在画面中央炸开成零件与成分，碎片向四周缓慢飞散并悬停，镜头缓慢环绕或推进，最后零件回位复原；物理感真实、节奏由慢到快再收住，商品标签全程可辨。

- **来源原文提示词**（照它生成案例）：

  > { "type": "exploded view product diagram poster", "subject": "VR headset", "style": "clean high-tech 3D render, studio lighting, glowing accents", "background": "{argument name=\"background color\" default=\"soft purple and blue gradient\"}", "header": { "logo": "∞ {argument name=\"product name\" default=\"Meta Quest 3\"}", "subtitle": "{argument name=\"main catchphrase\" default=\"まったく新しい現実を、まったく新しい構造から。\"}" }, "layout": { "centerpiece": "vertically stacked exploded view of a VR headset showing 9 distinct layers of internal components: outer shell, camera sensors, motherboard with chip, pancake lenses, internal frame, battery packs, side straps, top strap, and facial interface cushion.", "callout_labels": { "count": 8, "left_side": [ "Snapdragon® XR2 Gen 2\n圧倒的な処理性能でリアルタイムな体験を。", "調整可能なIPD機構\n幅広いユーザーに快適なフィット感を。", "精密設計されたヘッドストラップ\n快適さと安定性を追求したエルゴノミクス。" ], "right_side": [ "フェイスプレート\n洗練されたデザインと最適な重量バランス。", "トラッキングカメラ\n高精度な位置トラッキングと環境認識を実現。", "パンケーキレンズ\n薄型設計で広い視野角と鮮明な映像を提供。", "高性能バッテリー\n長時間駆動を支える最適化された電源設計。", "柔らかなフェイスインターフェース\n長時間でも快適な装着感を実現。" ] }, "footer": { "left_text_block": { "headline": "{argument name=\"bottom headline\" default=\"体験は、構造から進化する。\"}", "body": "一つひとつのパーツに、没入体験を支

- **来源自带案例素材**（1 个）：
  - https://raw.githubusercontent.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/main/images/poster_case109/output.jpg

- **封面出图配方**：版式 `hero-single` · 色相 `warm` · 标题「产品爆炸」 · 主体：商品在空中炸开、零件悬浮的动态关键帧

#### 零食开箱 · `video.snack_unbox`

- **一句话**：拆袋、倒出、入口，一条龙展示
- **子页面**：`/video-creation?id=video.snack_unbox`
- **可用性**：ready（现有链路可跑）
- **来源**：高星开源库 · Seedance 2.0 九大商用玩法（卡尔的AI沃茨）（2415★）
  - 具体位置：`prompts/commercial-use-cases.md#5 直播带货`
  - 跟踪链接：https://github.com/ZeroLu/awesome-seedance/blob/main/prompts/commercial-use-cases.md
  - 说明：官方商用玩法里的直播带货（拆袋、展示、试吃）
- **我们的配方提示词**（子页面里预填）：

  > 零食开箱：镜头俯拍桌面，手撕开包装袋、把零食倒进盘子里、捏起一块展示质地，最后放进嘴里；动作连贯、声音与画面节奏配合，包装与零食颜色真实，不出现臆造的文字。

- **来源原文提示词**（照它生成案例）：

  > 生成一段 15 秒带货口播视频，产品为图中面霜。要求人物亲手涂手上，给出近景展示，侧脸转动展示细节，镜头从半身到特写切换 3 次。口播要包含卖点，最后给出强行动号召。自动生成字幕，节奏紧凑，带轻微环境音。

- **封面出图配方**：版式 `case-3up` · 色相 `warm` · 标题「零食开箱」 · 主体：拆袋、倒出与捏起零食的三个关键帧

#### 食品馋感特写 · `video.food_craving`

- **一句话**：拉丝、爆汁、冒热气，把馋感拍出来
- **子页面**：`/video-creation?id=video.food_craving`
- **可用性**：ready（现有链路可跑）
- **来源**：高星开源库 · awesome-gpt-image-2（电商用例）（17199★）
  - 具体位置：`cases/ecommerce.md#Case162 Premium food photography template`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/blob/main/cases/ecommerce.md
  - 说明：官方仓库美食摄影模板（热气 / 油光 / 微距）的视频化
- **我们的配方提示词**（子页面里预填）：

  > 食品馋感特写：微距镜头下食物被拉开（拉丝/爆汁/流心），热气缓缓升起，表面油光与颗粒清晰可见，镜头缓慢推进并在最诱人的一刻定格；色调暖、对比强，不出现文字与价格。

- **来源原文提示词**（照它生成案例）：

  > Create a square [ASPECT RATIO] premium food photography image of a steaming [FOOD] served in a dark black stone bowl or cast-iron skillet on a wooden board. The dish should look hot, glossy, spicy, and freshly served, with bite-sized pieces of browned protein, dried red chilies, green scallions, white onion, garlic, chili flakes, and visible Sichuan peppercorns coated in a deep red, oily Szechuan sauce. Use a slightly elevated close-up camera angle with shallow depth of field. Make the food the clear hero of the image, centered and richly detailed. Add visible steam rising naturally from the dish. Surround the bowl with subtle restaurant-style props like a dark red tray, scattered dried chilies, peppercorns, a small sauce bowl, or a blurred teapot in the background. Lighting should feel warm, moody, and editorial, like a high-end restaurant food shoot. Emphasize realistic textures and keep the image appetizing, realistic, cinematic, and polished. Avoid text, logos, hands, people, utensils covering the food, cartoon styling, fake plastic textures, excessive symmetry, or an overly clean stock-photo look.

- **来源自带案例素材**（1 个）：
  - https://raw.githubusercontent.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/main/images/poster_case162/output.jpg

- **封面出图配方**：版式 `hero-single` · 色相 `warm` · 标题「馋感特写」 · 主体：食物拉丝、爆汁、冒热气的微距关键帧

#### 3C 产品 TVC · `video.tech_tvc`

- **一句话**：一支完整的产品广告片：悬念、特写、收束
- **子页面**：`/video-creation?id=video.tech_tvc`
- **可用性**：ready（现有链路可跑）
- **来源**：高星开源库 · Seedance 2.0 九大商用玩法（卡尔的AI沃茨）（2415★）
  - 具体位置：`prompts/commercial-use-cases.md#2 商业广告`
  - 跟踪链接：https://github.com/ZeroLu/awesome-seedance/blob/main/prompts/commercial-use-cases.md
  - 说明：官方商用玩法"商业广告"：分镜编排 + 快剪 + 配乐 slogan
- **我们的配方提示词**（子页面里预填）：

  > 3C 产品 TVC：开场用暗场与一束光制造悬念，中段给产品三组特写（材质、屏幕、结构），穿插一个使用场景，结尾回到产品全景并留出放标语的安全区；镜头语言克制、节奏有起伏，色调统一。

- **来源原文提示词**（照它生成案例）：

  > 为图中产品生成一个精美高级的运动饮料广告，注意分镜编排，明快的节奏和快剪，高级的商业广告。

- **封面出图配方**：版式 `case-3up` · 色相 `cool` · 标题「3C产品TVC」 · 主体：暗场光束到产品特写与使用场景的三帧

#### 家居好物演示 · `video.home_goods_demo`

- **一句话**：在家里用一遍，把省事讲清楚
- **子页面**：`/video-creation?id=video.home_goods_demo`
- **可用性**：ready（现有链路可跑）
- **来源**：上游官方用例 · Seedance 2.5 官方 use-cases（中文）（403★）
  - 具体位置：`use-cases/zh-CN/10-emotion.md#2-3-10-2 油烟机广告（情绪对比）`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-seedance-2.5-guide/blob/main/use-cases/zh-CN/10-emotion.md
  - 说明：官方家电广告用例（使用演示 + 对比）
- **我们的配方提示词**（子页面里预填）：

  > 家居好物演示：真实居家场景里把商品用一遍（拿出、使用、收纳），展示它解决的问题；镜头跟着手走，光线自然，画面干净、不出现杂乱背景，商品细节清楚。

- **来源原文提示词**（照它生成案例）：

  > 这是一个油烟机广告，@图片1作为首帧画面，女人在优雅的做饭，没有烟雾，镜头快速向右边 摇动，拍摄@图片2男人满头大汗面红耳赤在做饭，浓烟滚滚，镜头向左边摇动推进拍摄@图片1 桌面上的��个油烟机，油烟机参考@图片3，油烟机在疯狂抽烟。

- **来源自带案例素材**（5 个）：
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-10/2/ref1.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-10/2/ref2.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-10/2/ref3.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-10/2/result.jpg
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-10/2/result.mp4

- **封面出图配方**：版式 `case-3up` · 色相 `soft` · 标题「家居演示」 · 主体：居家场景里拿出、使用与收纳商品的三帧

#### 多角度展示 · `video.multi_angle_showcase`

- **一句话**：正侧背、材质与细节，一次讲完
- **子页面**：`/video-creation?id=video.multi_angle_showcase`
- **可用性**：ready（现有链路可跑）
- **来源**：上游官方用例 · Seedance 2.5 官方 use-cases（中文）（403★）
  - 具体位置：`use-cases/zh-CN/01-consistency.md#2-3-1-5 产品多角度展示（包包）`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-seedance-2.5-guide/blob/main/use-cases/zh-CN/01-consistency.md
  - 说明：官方原话："对@图片2的包包进行商业化的摄像展示……要求将包包的细节均有所展示"
- **我们的配方提示词**（子页面里预填）：

  > 对上传的商品做一次商业化摄像展示：正面、侧面与背面依次出现，表面材质与五金细节各给一次特写，镜头缓慢环绕并保持主体居中；光线干净、反射真实，商品结构与包装文字全程一致。

- **来源原文提示词**（照它生成案例）：

  > 对@图片2的包包进行商业化的摄像展示，包包的侧面参考@图片1，包包的表面材质参考 @图片3，要求将包包的细节均有所展示，背景音恢宏大气

- **来源自带案例素材**（5 个）：
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-1/5/ref1.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-1/5/ref2.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-1/5/ref3.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-1/5/result.jpg
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-1/5/result.mp4

- **封面出图配方**：版式 `case-3up` · 色相 `cool` · 标题「多角度展示」 · 主体：同一商品正面、侧面与细节的三帧

#### 产品植入 · `video.product_placement`

- **一句话**：把商品自然放进已有视频里
- **子页面**：`/video-creation?id=video.product_placement`
- **可用性**：needs_ref（需要参考素材路由，声明支持但未实测出片）
- **来源**：上游官方用例 · Seedance 2.5 官方 use-cases（中文）（403★）
  - 具体位置：`use-cases/zh-CN/08-video-editing.md#2-3-8-5 炸鸡店产品植入`
  - 跟踪链接：https://github.com/EvoLinkAI/awesome-seedance-2.5-guide/blob/main/use-cases/zh-CN/08-video-editing.md
  - 说明：官方"产品植入"用例：保留原片动作，把商品自然放进画面并给手部特写
- **我们的配方提示词**（子页面里预填）：

  > 把上传的商品植入已有视频：保留原片的人物动作、镜头运动与节奏不变，在指定位置自然地放入商品（桌面、手中或背景货架），并给一次手部特写；商品结构与包装文字清晰，光影与原片一致，不出现悬浮或边缘发虚。

- **来源原文提示词**（照它生成案例）：

  > 视频1镜头右摇，炸鸡老板忙碌地将炸鸡递给排队的客户，用普通话说"做完他的，做你的， 大家文明排队。"一说完，就去拿纸袋子去装炸鸡。特写展示老板拿印有图1的纸袋子， 特写展示递给客户的手部特写。

- **来源自带案例素材**（5 个）：
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-8/5/ref1.png
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-8/5/ref1.jpg
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-8/5/ref1.mp4
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-8/5/result.jpg
  - https://pub-babc88c25d274cfeb8b2ae0cd0816872.r2.dev/assets/2-3-8/5/result.mp4

- **封面出图配方**：版式 `case-3up` · 色相 `warm` · 标题「产品植入」 · 主体：商品被自然放进原片场景的三个关键帧
