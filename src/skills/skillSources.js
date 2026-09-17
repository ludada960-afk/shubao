/* ═══ 技能出处台账（每条 skill 的配方是哪来的）═══════════════════════════════════
   用户 9-17 的硬要求：「我不要你自己硬造 Skill 方案，我要**成熟的方案**去使用。」
   「你是怎么找的？纯社媒网站去找吗？没去 GitHub 或者插件库这些渠道找找吗？」

   所以从这一版起，**每一条 skill 都必须在这里登记出处**（门禁强制，缺一条就红）。
   四类来源，按可信度从高到低：

     · 'official'   —— **上游官方用例/官方指南**（Seedance 2.5 官方 use-cases / 官方 guide）。
                       最高可信度：它讲的就是我们这条引擎怎么用，提示词语法（@图片1 / @视频1）
                       与我们创作台的 @ 引用**完全一致**，可以直接抄进 brief。
     · 'repo'       —— **高星开源提示词库**（取实时 star 为准，登记到具体 case）。
                       这些是别人反复验证、带成品图的配方；image2 侧尤其完整。
     · 'competitor' —— **竞品产品侧**（知渔 AI 的子页面与分类实测清单）。
                       开源侧没有成熟库的品类（例如建筑家装）只能以产品侧为准，如实标注。
     · 'ours'       —— **我们自己已跑通的既有链路**（套图 / 白底 / 试穿这类工程化能力）。
                       这类不引用外部配方；必须写 note 说明"为什么不需要外部来源"。

   ⚠️ 这张表**只登记事实**：stars 是查询当时的真实数字，ref 指向具体文件/锚点；
      不写"参考了某某思路"这种不可核对的措辞。 */
export const SOURCE_KINDS = ['official', 'repo', 'competitor', 'ours'];

/* 常用来源的简写（同一来源被多条 skill 引用时只写一次） */
const SEEDANCE_OFFICIAL = { kind: 'official', name: 'Seedance 2.5 官方 use-cases（中文）', repo: 'EvoLinkAI/awesome-seedance-2.5-guide', stars: 403 };
const SEEDANCE_PROMPTS = { kind: 'repo', name: 'awesome-seedance（Seedance 2.0 提示词合集）', repo: 'ZeroLu/awesome-seedance', stars: 2415 };
const SEEDANCE_COMMERCIAL = { kind: 'repo', name: 'Seedance 2.0 九大商用玩法（卡尔的AI沃茨）', repo: 'ZeroLu/awesome-seedance', stars: 2415 };
const GPT_IMAGE2_ECOMMERCE = { kind: 'repo', name: 'awesome-gpt-image-2（电商用例）', repo: 'EvoLinkAI/awesome-gpt-image-2-API-and-Prompts', stars: 17199 };
const GPT_IMAGE2_AD = { kind: 'repo', name: 'awesome-gpt-image-2（广告创意用例）', repo: 'EvoLinkAI/awesome-gpt-image-2-API-and-Prompts', stars: 17199 };
const QUANTV = { kind: 'competitor', name: '知渔 AI 实测清单（图片 110 条 / 视频 32 条）', repo: 'laoyu.quantv.com' };

export const SKILL_SOURCES = Object.freeze({
  /* ── 视频：上游官方用例能直接对上的，一律以官方为准 ───────────────────────── */
  'video.smart': { ...SEEDANCE_COMMERCIAL, ref: 'prompts/commercial-use-cases.md#2 商业广告', note: '官方商用玩法"商业广告：分镜编排 + 快剪 + 产品一致性"' },
  'video.frame': { kind: 'ours', note: '首尾帧是用户批注 #9 点名保留的入口，走我们既有的首尾帧链路；上游公开配方里没有以首尾帧为核心的同款写法，不硬套别的配方' },
  'video.remake': { ...SEEDANCE_OFFICIAL, ref: 'use-cases/zh-CN/02-camera-movement.md#2-3-2-7 超跑广告运镜复刻', note: '官方原话："参考视频1的运镜、画面切换节奏，拿图片1的红色超跑进行复刻"' },
  'video.image_to_video': { ...SEEDANCE_COMMERCIAL, ref: 'prompts/commercial-use-cases.md#6 动态海报', note: '官方商用玩法里的"动态海报"：单图动起来' },
  'video.product_motion': { ...SEEDANCE_OFFICIAL, ref: 'use-cases/zh-CN/02-camera-movement.md#2-3-2-3 产品旋转特写（平板电脑）', note: '官方原话："@图片1的平板电脑作为主体，运镜参考@视频1，推近到屏幕的特写，镜头旋转后平板反转展示全貌"' },
  'video.content_swap': { ...SEEDANCE_OFFICIAL, ref: 'use-cases/zh-CN/01-consistency.md#2-3-1-2 角色替换 + 风格一致', note: '官方"角色替换 + 风格一致"用例' },
  'video.model_runway': { ...SEEDANCE_OFFICIAL, ref: 'use-cases/zh-CN/09-music-sync.md#2-3-9-1 时尚换装卡点', note: '以官方卡点换装用例为骨架（人物动起来部分）' },
  'video.camera_move': { ...SEEDANCE_OFFICIAL, ref: 'use-cases/zh-CN/02-camera-movement.md#2-3-2-1 希区柯克变焦 + 机械臂环绕', note: '官方"运镜复刻"整章：希区柯克变焦 / 机械臂环绕 / 推拉跟拍' },
  'video.extend': { ...SEEDANCE_OFFICIAL, ref: 'use-cases/zh-CN/05-video-extension.md#2-3-5-2 健身广告（延长 6s）', note: '官方视频延长用例（我们有这条能力后即可转 ready）' },
  'video.festival_spot': { ...SEEDANCE_COMMERCIAL, ref: 'prompts/commercial-use-cases.md#3 品牌宣传', note: '官方商用玩法"品牌宣传片"' },
  'video.space_tour': { ...SEEDANCE_OFFICIAL, ref: 'use-cases/zh-CN/07-continuity.md#2-3-7-1 街头到屋顶追踪跑步', note: '一镜到底整章（木屋围炉推进 / 飞机窗外到机舱内）是空间漫游的官方骨架' },
  'video.light_shift': { ...QUANTV, ref: '视频制作 / 建筑室内 / 光线变化', note: '开源侧无成熟库，以竞品产品侧清单为准' },
  'video.day_night': { ...QUANTV, ref: '视频制作 / 建筑室内 / 日夜气候切换' },
  'video.furnishing_in': { ...QUANTV, ref: '视频制作 / 建筑室内 / 软装进场' },
  'video.floorplan_grow': { ...QUANTV, ref: '视频制作 / 建筑室内 / 户型生长' },
  'video.building_grow': { ...QUANTV, ref: '视频制作 / 建筑室内 / 建筑生长' },
  'video.plant_grow': { ...QUANTV, ref: '视频制作 / 建筑室内 / 植物生长' },
  'video.interior_story': { ...SEEDANCE_OFFICIAL, ref: 'use-cases/zh-CN/04-story-completion.md#2-3-4-3 图片情绪发散成视频', note: '官方"剧情补全"整章是空间叙事的骨架' },
  'video.traffic_swap': { ...SEEDANCE_OFFICIAL, ref: 'use-cases/zh-CN/03-creative-effects.md#2-3-3-2 鱼眼换装闪切', note: '官方换装闪切用例（每次更换伴随切镜）' },
  'video.car_weekly': { ...SEEDANCE_OFFICIAL, ref: 'use-cases/zh-CN/09-music-sync.md#2-3-9-1 时尚换装卡点', note: '官方卡点换装：同一人物持续换装' },
  'video.outfit_transition': { ...SEEDANCE_OFFICIAL, ref: 'use-cases/zh-CN/03-creative-effects.md#2-3-3-2 鱼眼换装闪切', note: '官方转场换装（鱼眼镜头 / 重影闪烁）' },
  'video.fog_reveal': { ...GPT_IMAGE2_AD, ref: 'cases/ad-creative.md#Case37 SPLASH 液态 Logo', note: '以官方仓库里"揭示式"广告配方为骨架' },
  'video.one_image_showcase': { ...GPT_IMAGE2_ECOMMERCE, ref: 'cases/ecommerce.md#Case116 Industrial Design Presentation Sheet', note: '一图裂变成多格展示（工业设计展示板）的视频化' },
  'video.product_explode': { ...GPT_IMAGE2_AD, ref: 'cases/ad-creative.md#Case109 VR Headset Exploded View Poster', note: '爆炸视图配方的视频化（官方用例里是静帧海报）' },
  'video.snack_unbox': { ...SEEDANCE_COMMERCIAL, ref: 'prompts/commercial-use-cases.md#5 直播带货', note: '官方商用玩法里的直播带货（拆袋、展示、试吃）' },
  'video.tech_rotate': { ...SEEDANCE_OFFICIAL, ref: 'use-cases/zh-CN/02-camera-movement.md#2-3-2-3 产品旋转特写（平板电脑）' },
  'video.food_craving': { ...GPT_IMAGE2_ECOMMERCE, ref: 'cases/ecommerce.md#Case162 Premium food photography template', note: '官方仓库美食摄影模板（热气 / 油光 / 微距）的视频化' },
  'video.tech_tvc': { ...SEEDANCE_COMMERCIAL, ref: 'prompts/commercial-use-cases.md#2 商业广告', note: '官方商用玩法"商业广告"：分镜编排 + 快剪 + 配乐 slogan' },
  'video.home_goods_demo': { ...SEEDANCE_OFFICIAL, ref: 'use-cases/zh-CN/10-emotion.md#2-3-10-2 油烟机广告（情绪对比）', note: '官方家电广告用例（使用演示 + 对比）' },
  'video.beauty_macro': { ...GPT_IMAGE2_ECOMMERCE, ref: 'cases/ecommerce.md#Case114 Skincare Product Studio Shot', note: '官方仓库护肤静物配方（质地 / 成分）的视频化' },
  'video.street_style': { ...SEEDANCE_OFFICIAL, ref: 'use-cases/zh-CN/02-camera-movement.md#2-3-2-2 拐角追逐 + 多场景跟拍', note: '官方跟拍运镜用例' },
  'video.ai_styling': { ...SEEDANCE_OFFICIAL, ref: 'use-cases/zh-CN/01-consistency.md#2-3-1-2 角色替换 + 风格一致', note: '官方角色替换 + 风格一致；换装需要参考素材路由' },
  'video.book_selling': { ...SEEDANCE_OFFICIAL, ref: 'use-cases/zh-CN/04-story-completion.md#2-3-4-1 漫画分格动态演绎', note: '官方"分格动态演绎"配方（书页/分格翻动）' },
  'video.food_asmr': { ...SEEDANCE_OFFICIAL, ref: 'use-cases/zh-CN/06-audio-voice.md#2-3-6-0 鱼眼马头 + 多视频音效参考', note: '官方音色/声音整章（吃播的收音与节奏以此为准）' },
  'video.store_tour': { ...SEEDANCE_OFFICIAL, ref: 'use-cases/zh-CN/07-continuity.md#2-3-7-1 街头到屋顶追踪跑步', note: '官方一镜到底（进店 → 动线 → 停留）' },
  'video.text_consistency': { ...SEEDANCE_OFFICIAL, ref: 'use-cases/zh-CN/01-consistency.md#2-3-1-4 商品细节 + 文字一致性（磁吸蝴蝶结广告）', note: '官方原话用 0-2 秒/3-6 秒逐段写画面与画外音 —— 这条配方专门解决"包装文字糊掉"的电商硬伤' },
  'video.scene_stitch': { ...SEEDANCE_OFFICIAL, ref: 'use-cases/zh-CN/01-consistency.md#2-3-1-6 多场景空间拼接', note: '官方原话："把@图片1作为画面的首帧图，第一人称视角……上方场景参考@图片2，左边场景参考@图片3"' },
  'video.beat_mashup': { ...SEEDANCE_OFFICIAL, ref: 'use-cases/zh-CN/09-music-sync.md#2-3-9-2 多风格图片卡点混剪', note: '官方"音乐卡点"章的图片混剪用例' },
  'video.multi_angle_showcase': { ...SEEDANCE_OFFICIAL, ref: 'use-cases/zh-CN/01-consistency.md#2-3-1-5 产品多角度展示（包包）', note: '官方原话："对@图片2的包包进行商业化的摄像展示……要求将包包的细节均有所展示"' },
  'video.product_placement': { ...SEEDANCE_OFFICIAL, ref: 'use-cases/zh-CN/08-video-editing.md#2-3-8-5 炸鸡店产品植入', note: '官方"产品植入"用例：保留原片动作，把商品自然放进画面并给手部特写' },
  'video.scene_edit': { ...SEEDANCE_OFFICIAL, ref: 'use-cases/zh-CN/08-video-editing.md#2-3-8-4 背景添加大白鲨 + 发色修改', note: '官方"只改指定元素"用例（换发色 / 加背景物体）' },
  'video.storyboard_to_video': { ...SEEDANCE_OFFICIAL, ref: 'use-cases/zh-CN/04-story-completion.md#2-3-4-2 分镜脚本转视频', note: '官方"分镜脚本转视频"用例' },

  /* ── 图片：高星配方库（电商 / 广告创意）与竞品清单 ─────────────────────────── */
  'image.free': { kind: 'ours', note: '我们自己的自由创作链路（visualCreation + image2）', reference: { ...GPT_IMAGE2_AD, name: '参考效果：awesome-gpt-image-2（广告创意）', ref: 'cases/ad-creative.md#Case24 Tropical Product Ad Poster' } },
  'image.poster': { ...GPT_IMAGE2_ECOMMERCE, ref: 'cases/poster_zh-CN.md#Case4 Chinese Minimalist S-Shaped Poster', note: '官方仓库中文极简海报（与我们的海报模板同族）' },
  'image.social_cover': { ...GPT_IMAGE2_ECOMMERCE, ref: 'cases/ad-creative.md#Case90 4-Panel Japanese Digital Ad Banner Grid' },
  'image.product_suite': { kind: 'ours', note: '我们自己的套图引擎（resolveEcommercePlan 按平台算张数与报价），服务端流水线自研', reference: { ...GPT_IMAGE2_ECOMMERCE, name: '参考效果：awesome-gpt-image-2（电商）', ref: 'cases/ecommerce.md#Case3 Burger hero image plus 9-cell ad storyboard' } },
  'image.live_ui': { ...GPT_IMAGE2_ECOMMERCE, ref: 'cases/ecommerce.md#Case89 E-commerce Live Stream UI Mockup', note: '官方仓库的直播 UI 假图配方（主播 + 两侧品牌色块 + 底部信息条）' },
  'image.callout_diagram': { ...GPT_IMAGE2_ECOMMERCE, ref: 'cases/ecommerce.md#Case14 冰淇淋配料标注广告', note: '官方仓库的标注图解配方（引线指向 + 短标注）' },
  'image.giant_product': { ...GPT_IMAGE2_AD, ref: 'cases/ad-creative.md#Case42 Ray-Ban 巨型飞行员墨镜广告', note: '官方仓库巨型产品配方（人物与巨型商品同框 + 背景品牌大字）' },
  'image.liquid_logo': { ...GPT_IMAGE2_AD, ref: 'cases/ad-creative.md#Case37 SPLASH 液态 Logo 时尚海报', note: '官方仓库液态 Logo 配方；原文强调"轮廓必须仍然是 logo 本身"' },
  'image.landscape_logo': { ...GPT_IMAGE2_AD, ref: 'cases/ad-creative.md#Case36 隐藏 Logo 地景幻象', note: '官方仓库地景幻象配方（形状由地貌构成，不许后期贴图）' },
  'image.sticker_collage': { ...GPT_IMAGE2_AD, ref: 'cases/ad-creative.md#Case181 Sticker Reality Product Collage', note: '官方仓库贴纸拼贴配方（保主体构图，叠加贴纸/剪贴/便签）' },
  'image.showroom_still': { ...GPT_IMAGE2_AD, ref: 'cases/ad-creative.md#Case27 Showroom Still Life Merch Drop', note: '官方仓库限量发售静物配方（品牌分析 → 台面静物）' },
  'image.tropical_poster': { ...GPT_IMAGE2_ECOMMERCE, ref: 'cases/ecommerce.md#Case115 Tropical Citrus Soda Ad Poster', note: '官方仓库热带饮品海报配方' },
  'image.mono_pastel_ad': { ...GPT_IMAGE2_ECOMMERCE, ref: 'cases/ecommerce.md#Case159 Pastel Blue Crocs Fashion Ad', note: '官方仓库单色系配方（巨型品牌字 + 镜面地板 + 品牌标位）' },
  'image.grain_ad_board': { ...GPT_IMAGE2_ECOMMERCE, ref: 'cases/ecommerce.md#Case154 Premium Grain Powder Ad Board', note: '官方仓库中文电商广告板配方（中文排版 + 卖点 + 规格带）' },
  'image.aplus': { ...GPT_IMAGE2_ECOMMERCE, ref: 'cases/ecommerce.md#Case155 Earbuds E-commerce Infographic', note: 'A+ 图文模块的信息图配方' },
  'image.detail_page': { ...GPT_IMAGE2_ECOMMERCE, ref: 'cases/ecommerce.md#Case116 Industrial Design Presentation Sheet', note: '详情页分屏模块的网格版式' },
  'image.explode': { ...GPT_IMAGE2_AD, ref: 'cases/ad-creative.md#Case109 VR Headset Exploded View Poster', note: '官方仓库爆炸视图海报（分层零件 + 标注）' },
  'image.ice_ad': { ...GPT_IMAGE2_ECOMMERCE, ref: 'cases/ecommerce.md#Case113 Luxury Amber Perfume Ad', note: '官方仓库奢品广告（暗背景 + 戏剧光 + 内发光）' },
  'image.float_kv': { ...GPT_IMAGE2_ECOMMERCE, ref: 'cases/ecommerce.md#Case161 Premium product studio shot template', note: '官方仓库"悬浮 + 干净渐变背景 + 三点光"模板' },
  'image.tvc_grid': { ...GPT_IMAGE2_ECOMMERCE, ref: 'cases/ecommerce.md#Case2 9-Panel Product TVC Storyboard', note: '官方仓库九宫格 TVC 分镜（含时间码与九格脚本）' },
  'image.sku_series': { ...GPT_IMAGE2_ECOMMERCE, ref: 'cases/ecommerce.md#Case116 Industrial Design Presentation Sheet', note: '同一产品多配色并置的展示板版式' },
  'image.gift_scene': { ...GPT_IMAGE2_ECOMMERCE, ref: 'cases/ecommerce.md#Case118 Luxury Perfume Ad on Marble Vanity', note: '官方仓库场景静物（台面 + 道具 + 柔光）' },
  'image.teardown': { ...GPT_IMAGE2_AD, ref: 'cases/ad-creative.md#Case109 VR Headset Exploded View Poster', note: '拆解 + 标注的官方配方' },
  'image.diorama': { ...GPT_IMAGE2_ECOMMERCE, ref: 'cases/ecommerce.md#Case1 Miniature Diorama Skincare Advertisement', note: '官方仓库微缩场景广告（小人 + 脚手架 + 产品）' },
  'image.floorplan_render': { ...QUANTV, ref: '图片制作 / 建筑室内 / 平面转建筑效果图' },
  'image.interior_style': { ...QUANTV, ref: '图片制作 / 建筑室内 / 装修风格转换' },
  'image.rough_interior': { ...QUANTV, ref: '图片制作 / 建筑室内 / 毛坯家装设计' },
  'image.day_night_still': { ...QUANTV, ref: '图片制作 / 建筑室内 / 日夜气候切换' },
  'image.furniture_swap': { ...QUANTV, ref: '图片制作 / 建筑室内 / 一键软硬装替换' },
  'image.render_quality': { ...QUANTV, ref: '图片制作 / 建筑室内 / 效果图质感提升' },
  'image.interior_3d': { ...QUANTV, ref: '图片制作 / 建筑室内 / 室内3D模型渲染' },
  'image.arch_grid': { ...QUANTV, ref: '图片制作 / 建筑室内 / 建筑九宫格分镜' },
  'image.white_bg': { kind: 'ours', note: '我们已跑通的内置技能链路（builtinSkill）', reference: { ...GPT_IMAGE2_ECOMMERCE, name: '参考效果：awesome-gpt-image-2（电商棚拍）', ref: 'cases/ecommerce.md#Case153 Premium Gaming Motherboard Studio Shot' } },
  'image.scene': { kind: 'ours', note: '我们已跑通的内置技能链路', reference: { ...GPT_IMAGE2_ECOMMERCE, name: '参考效果：awesome-gpt-image-2（生活场景）', ref: 'cases/ecommerce.md#Case117 Luxury Fur-Lined Loafer Lifestyle Photo' } },
  'image.material': { kind: 'ours', note: '我们已跑通的内置技能链路', reference: { ...GPT_IMAGE2_ECOMMERCE, name: '参考效果：awesome-gpt-image-2（质地特写）', ref: 'cases/ecommerce.md#Case114 Skincare Product Studio Shot' } },
  'image.multi_angle': { kind: 'ours', note: '我们已跑通的内置技能链路', reference: { ...GPT_IMAGE2_ECOMMERCE, name: '参考效果：awesome-gpt-image-2（多视角展示板）', ref: 'cases/ecommerce.md#Case116 Industrial Design Presentation Sheet' } },
  'image.try_on': { kind: 'ours', note: '我们已跑通的内置技能链路', reference: { ...GPT_IMAGE2_ECOMMERCE, name: '参考效果：awesome-gpt-image-2（海报库·服饰大片）', ref: 'cases/poster_zh-CN.md#Case71 Streetwear Fashion Campaign Asian Apparel Poster' } },
  'image.batch': { kind: 'ours', note: '我们已跑通的内置技能链路', reference: { ...GPT_IMAGE2_ECOMMERCE, name: '参考效果：awesome-gpt-image-2（海报库·多格企划）', ref: 'cases/poster_zh-CN.md#Case52 6-Block Fashion Campaign Prompt Formula' } },
  'image.brand_kv': { ...GPT_IMAGE2_AD, ref: 'cases/ad-creative.md#Case45 Glossier 品牌世界拼贴', note: '品牌主视觉以官方仓库品牌企划配方为准' },
  'image.cn_poster': { ...QUANTV, ref: '图片制作 / 创意应用 / 中文海报一键生成', note: '中文排字海报以竞品产品侧为准（官方仓库以英文案例为主）' },
  'image.copy': { ...QUANTV, ref: '图片制作 / 精品推荐 / 图片复刻' },
  'image.similar': { ...QUANTV, ref: '图片制作 / 创意应用 / 相似图生成' },
  'image.xhs_note': { kind: 'ours', note: '我们自己的小红书图文链路（SSE 流水线），不进画布', reference: { ...GPT_IMAGE2_ECOMMERCE, name: '参考效果：awesome-gpt-image-2（海报库·九宫格分镜）', ref: 'cases/poster_zh-CN.md#Case229 9-Frame Cinematic Storyboard Grid' } },
  'image.portrait': { ...GPT_IMAGE2_ECOMMERCE, ref: 'cases/portrait_zh-CN.md#Case7 Luxury Glam Beauty Portrait', note: '官方仓库美妆人像（皮肤与光线处理的基准）' },
  'image.hairstyle': { kind: 'ours', note: '换发型走我们已跑通的内置技能链路（保五官 + 图生图）；开源侧没有专门覆盖换发型的成熟提示词库，只有虚拟试衣类（OOTDiffusion 6,593★），两者不是一回事，不硬套' },
  'image.pose': { ...GPT_IMAGE2_ECOMMERCE, ref: 'cases/poster_zh-CN.md#Case134 16-Panel Dance Pose Reference Sheet', note: '官方仓库 16 格姿势参考表（多姿势出图的基准）' },
  'image.remove_bg': { kind: 'ours', note: '去背景走我们已跑通的内置技能链路；竞品把它放在精品推荐位（产品侧可对标），但开源提示词库里没有专门的去背景配方，不编一个 Case 号' },
  'image.swap_bg': { ...QUANTV, ref: '图片制作 / 电商专区 / 一键模特换背景' },
  'image.retouch': { ...QUANTV, ref: '图片制作 / 电商专区 / 照片高质量精修' },
  'image.style_swap': { ...QUANTV, ref: '图片制作 / 电商专区 / 商品风格材质更换' },
});

export function sourceOf(skillId) {
  const key = typeof skillId === 'string' ? skillId.trim() : '';
  return SKILL_SOURCES[key] || null;
}
