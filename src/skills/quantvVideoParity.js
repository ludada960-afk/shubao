/* ═══ 视频侧「skill ↔ 知渔对应页」对照表（单一事实源）════════════════════════════════
   为什么要有这个文件（与图片侧的 src/skills/quantvImageParity.js 同一个理由）：
   用户第 20 轮原话：「你要确认，视频生成和图片生成的各个子页面对应知渔的各个子页面，
     分别去对应他们的工作台做专属设计」。
   —— "对应"这件事**必须是仓库里能查、门禁能钉的一层**，不能只活在我上一轮的临时脚本与口头说明里。

   ⚠️ 判据（三条，逐条都要过）：
     ① 语义：是不是同一件事（不是关键词蒙的）；
     ② 字段形态：知渔那一页的字段序列，我们的工作台能不能一模一样地摆出来；
     ③ 出处：URL 必须是**实采**到的（docs/design/data/quantv-video-pages.json 的 31 条之一）。
   三种结论，都要显式写：
     · kind: 'page'  —— 知渔有同一件事的页面，工作台**逐字段照抄**那一页；
     · kind: 'shape' —— 知渔有**同形态**的页面（例如"单图 + 比例"这一族），我们的玩法不同但字段形态照抄；
     · counterpart: null —— 知渔**没有**对应页（我们自有的玩法）。"没有"也是明确结论，
       而且**不许借一个相近页面充数**（上一版就是这么干的：8 条自有玩法都指向「灯具展示」）。

   知渔视频侧一共 **31 个子页面**（7 个路由页 + 24 个应用市场的 app），逐条实采：
     · 路由页 7：视频创作 / 爆款复刻 / 探店视频 / 内容替换 / 数字人 / 视频高清 / 视频字幕去除
     · app 24：淋浴展示 / 台盆展示 / 灯具展示 / 餐桌展示 / 光线变化 / 户型生长 / 软装进场 / 浴室洗漱 /
       书房学习 / 室内装修 / 卧室就寝 / 餐厅聚餐 / 家装布置 / 建筑生长 / 植物生长 / 模特服装展示 /
       建筑分镜电影制作 / 商业热闹 / 寒冬降临 / 建筑图转视频 / 现代豪门婆媳… / 华丽古典后宫… /
       [短剧风格]豪门恩怨… / 趣味脱口秀（+ 内容替换 app = 25 个 enabled app） */

export const QUANTV_VIDEO_BASE = 'https://laoyu.quantv.com';

/* 知渔视频侧 31 个子页面（实采清单，门禁用它核对"我们引用的 URL 都真实存在"） */
export const QUANTV_VIDEO_PAGES = Object.freeze([
  QUANTV_VIDEO_BASE + '/ai-video',
  QUANTV_VIDEO_BASE + '/video-recreation',
  QUANTV_VIDEO_BASE + '/store-visit-video',
  QUANTV_VIDEO_BASE + '/content-replace',
  QUANTV_VIDEO_BASE + '/digital-human',
  QUANTV_VIDEO_BASE + '/video-high-definition',
  QUANTV_VIDEO_BASE + '/video-subtitle-removal',
  QUANTV_VIDEO_BASE + '/apps?id=cmra7sgh009eg9vzgzwmnn68g',
  QUANTV_VIDEO_BASE + '/apps?id=cmra7o96y09cj9vzg3oml6su6',
  QUANTV_VIDEO_BASE + '/apps?id=cmra7k5zy09am9vzg3m52gaud',
  QUANTV_VIDEO_BASE + '/apps?id=cmra7fik209979vzgmz2vpwy7',
  QUANTV_VIDEO_BASE + '/apps?id=cmr97klck001i9vzg58za4env',
  QUANTV_VIDEO_BASE + '/apps?id=cmr9777qu013q2xm0qrvn3cdi',
  QUANTV_VIDEO_BASE + '/apps?id=cmr973iuh011n2xm0giaodt4m',
  QUANTV_VIDEO_BASE + '/apps?id=cmr96y3mb00ys2xm0z0y7540a',
  QUANTV_VIDEO_BASE + '/apps?id=cmr96q1ai00u82xm0zp8dhinr',
  QUANTV_VIDEO_BASE + '/apps?id=cmr96eilw00p42xm0uocpkuwp',
  QUANTV_VIDEO_BASE + '/apps?id=cmr96b5p400mb2xm006sh9o35',
  QUANTV_VIDEO_BASE + '/apps?id=cmr965qf700k52xm0d3q3g1dv',
  QUANTV_VIDEO_BASE + '/apps?id=cmr960avj00j52xm0cv4e527q',
  QUANTV_VIDEO_BASE + '/apps?id=cmr95whex00hm2xm0mxtqjly9',
  QUANTV_VIDEO_BASE + '/apps?id=cmr95g674008o2xm0e6tk58ne',
  QUANTV_VIDEO_BASE + '/apps?id=cmr94utrm000b2xm0zvqfb49a',
  QUANTV_VIDEO_BASE + '/apps?id=cmr1w901f011114i3dyig00lf',
  QUANTV_VIDEO_BASE + '/apps?id=cmr1w8xhw010z14i3i9kz9a7q',
  QUANTV_VIDEO_BASE + '/apps?id=cmr1w8rja010u14i3hpueua4o',
  QUANTV_VIDEO_BASE + '/apps?id=cmr1w8lt2010q14i3bfmj1xvn',
  QUANTV_VIDEO_BASE + '/apps?id=cmr1w7wvz00z914i3f5h4hifu',
  QUANTV_VIDEO_BASE + '/apps?id=cmr1w7twq00z514i3hw6s0clk',
  QUANTV_VIDEO_BASE + '/apps?id=cmr1w7qqt00z314i3r4rnmzfs',
  QUANTV_VIDEO_BASE + '/apps?id=cmr1w7n9000z114i3rvzyd4c8',
]);

/* 对照记录：id → { counterpart, kind: 'page' | 'shape' | null, note | reason } */
export const QUANTV_VIDEO_COUNTERPARTS = Object.freeze({
  /* ── 知渔有同一件事的页面：工作台逐字段照抄（kind: 'page'）────────────────────── */
  'video.smart': { counterpart: QUANTV_VIDEO_BASE + '/ai-video', kind: 'page', note: '视频创作：0/6 选择图片 + 脚本（0/10000，占位「输入视频脚本，使用 @ 指定参考素材，或」+ 代为撰写）' },
  'video.remake': { counterpart: QUANTV_VIDEO_BASE + '/video-recreation', kind: 'page', note: '爆款复刻：参考视频 + AI分析 + 参考视频要求 4 条 + 适合上传的视频 5 个 + 参考图片 0/6 + 素材分析 + 补充说明' },
  'video.content_swap': { counterpart: QUANTV_VIDEO_BASE + '/content-replace', kind: 'page', note: '内容替换：参考视频（最长支持15秒）+ 上传图片（模特或产品）+ 背景图（可上传，未上传则不替换背景）+ 换模特/换产品' },
  'video.store_tour': { counterpart: QUANTV_VIDEO_BASE + '/store-visit-video', kind: 'page', note: '探店视频：探店素材 0/6 + 门店信息（AI分析）+ 模特选择 0/3 + 补充说明（生成脚本）+ 空态「暂未生成脚本」' },
  'video.model_runway': { counterpart: QUANTV_VIDEO_BASE + '/apps?id=cmr94utrm000b2xm0zvqfb49a', kind: 'page', note: '模特服装展示：穿搭图1 / 穿搭图2 / 穿搭图3 / 椅子图（四格上传，无比例）' },
  'video.light_shift': { counterpart: QUANTV_VIDEO_BASE + '/apps?id=cmr97klck001i9vzg58za4env', kind: 'page', note: '光线变化：参考图（要求：人视图）+ 比例五档' },
  'video.furnishing_in': { counterpart: QUANTV_VIDEO_BASE + '/apps?id=cmr973iuh011n2xm0giaodt4m', kind: 'page', note: '软装进场：参考图（要求：人视图）+ 比例五档' },
  'video.floorplan_grow': { counterpart: QUANTV_VIDEO_BASE + '/apps?id=cmr9777qu013q2xm0qrvn3cdi', kind: 'page', note: '户型生长：参考图（要求：平面图）+ 比例五档' },
  'video.building_grow': { counterpart: QUANTV_VIDEO_BASE + '/apps?id=cmr95whex00hm2xm0mxtqjly9', kind: 'page', note: '建筑生长：首图要求：建筑场景空地图 + 尾图要求：建筑效果图 + 比例' },
  'video.plant_grow': { counterpart: QUANTV_VIDEO_BASE + '/apps?id=cmr95g674008o2xm0e6tk58ne', kind: 'page', note: '植物生长：首图要求：景观空地图 + 尾图要求：景观效果图 + 比例' },
  'video.storyboard_to_video': { counterpart: QUANTV_VIDEO_BASE + '/apps?id=cmr1w901f011114i3dyig00lf', kind: 'page', note: '建筑分镜电影制作：参考图（要求：分镜图需包含多个分镜）+ 比例 + 时长 5/10/15' },
  /* ═══ 2026-09-25 批 AM：**本地方案的两条路由页**（视频高清 / 视频字幕去除）═══════════════════
     这两条是知渔的**路由页**（/video-high-definition、/video-subtitle-removal，不是 /apps?id=…），
     实采全文在 docs/design/data/quantv-video-pages.json 里，逐字抄录：
       · 视频高清：上传视频 0/1 + 视频设置（输出分辨率 720p/1080p/2k、FPS 30fps/60fps）+ 消耗 0.50 积分
       · 视频字幕去除：视频模型（静态一行「智能去字幕」）+ 上传原视频 0/1 + 字幕标记方式
         （自动标记 / 手动标记：放大视频并手动框选字幕区域）+ 本次消耗 0.04 积分
     ⚠️ 它们**不走上游模型**：高清＝本机 ffmpeg scale、去字幕＝本机 delogo（user:「为什么一切都要
        追究模型呢」）。"知渔的页面"仍是唯一依据 —— 字段、档位、价目都照它。 */
  'video.upscale': { counterpart: QUANTV_VIDEO_BASE + '/video-high-definition', kind: 'page', note: '视频高清：上传视频 0/1 + 视频设置（输出分辨率 720p/1080p/2k + FPS 30fps/60fps）+ 消耗 0.50 积分（**没有模型格**）' },
  'video.desubtitle': { counterpart: QUANTV_VIDEO_BASE + '/video-subtitle-removal', kind: 'page', note: '视频字幕去除：视频模型（静态一行「智能去字幕」，不是选择器）+ 上传原视频 0/1 + 字幕标记方式（自动标记 / 手动标记：放大视频并手动框选字幕区域）+ 本次消耗 0.04 积分' },
  /* ═══ 2026-09-26 批 AU：数字人（口型对齐）═════════════════════════════════════════════════════
     知渔 /digital-human 的实采 panelText 是**第 01 步「IP 深度学习」**那一屏（生成爆款文案 0.25 积分 /
     视频类型 口播·剧情 / 文案类型 人设型·卖点型 / 行业+人设·产品/业务·卖点+价格·其他要求），
     整条流水线的字段在 docs/design/72 的六步表里（02 音视频生成 = 音色三来源 + 选择形象（只能自带视频）
     + 生成口播视频 2.40 积分/分钟）。
     ⇒ 我们这一页抄的是**第 02 步的形态**（形象 + 音频 → 口播视频），不是第 01 步的文案表单：
        文案那一步是"IP 深度学习"整条流水线的一环，我们没有那条链路，就不做样子的输入框。 */
  'video.digital_human': { counterpart: QUANTV_VIDEO_BASE + '/digital-human', kind: 'page', note: '数字人：知渔叫「数字人」，实查就是换口型（模型入参 source_video_url + source_audio_url，bundle 里 lipsync/heygen 全库 0 命中）；他们 02 步 = 音色 + 选择形象（只能自带视频，新账号无内置形象）+ 生成口播视频 2.40 积分/分钟 ⇒ 我们这页 = 人物视频 + 驱动配音两格' },

  /* ── 知渔有同形态的页面：字段形态照抄，玩法不同（kind: 'shape'）───────────────── */
  'video.image_to_video': { counterpart: QUANTV_VIDEO_BASE + '/apps?id=cmr1w8lt2010q14i3bfmj1xvn', kind: 'shape', note: '建筑图转视频是"单图 → 视频"这一形态（参考图 + 比例六档，比同族多一档 21:9）；我们这条是通用图生视频' },
  'video.day_night': { counterpart: QUANTV_VIDEO_BASE + '/apps?id=cmr1w8rja010u14i3hpueua4o', kind: 'shape', note: '寒冬降临是"单图控气候变化"（参考图（要求：鸟瞰图，带环境）+ 比例 + 时长），他们那页的例子是季节，我们这条做日夜与天气' },
  'video.tech_tvc': { counterpart: QUANTV_VIDEO_BASE + '/ai-video', kind: 'shape', note: '脚本型：形态同「视频创作」（素材 0/6 + 脚本 + 代为撰写），我们这条是 3C 产品 TVC' },
  'video.book_selling': { counterpart: QUANTV_VIDEO_BASE + '/ai-video', kind: 'shape', note: '脚本型：形态同「视频创作」（素材 0/6 + 脚本 + 代为撰写）' },
  'video.food_asmr': { counterpart: QUANTV_VIDEO_BASE + '/ai-video', kind: 'shape', note: '脚本型：形态同「视频创作」（素材 0/6 + 脚本 + 代为撰写）' },

  /* ═══ 2026-09-23 批 AA：照知渔补齐的那 14 页 ═══════════════════════════════════════════
     用户原话：「你不如**全抄知渔**的视频生成和图片生成的 skill 子页面…**工作台直接照抄他的就好**，
     其他你自己硬造的子页面我觉得**就去掉吧**，**尽可能跟他一致**。」
     全部 kind: 'app'（都在知渔应用市场里），字段逐条照实采 json；note 写清抄到的是什么。 */
  'video.shower_showcase': { counterpart: QUANTV_VIDEO_BASE + '/apps?id=cmra7sgh009eg9vzgzwmnn68g', kind: 'app', note: '淋浴展示：参考图（要求：淋浴图）+ 比例五档' },
  'video.basin_showcase': { counterpart: QUANTV_VIDEO_BASE + '/apps?id=cmra7o96y09cj9vzg3oml6su6', kind: 'app', note: '台盆展示：参考图（要求：台盆图）+ 比例五档' },
  'video.lighting_showcase': { counterpart: QUANTV_VIDEO_BASE + '/apps?id=cmra7k5zy09am9vzg3m52gaud', kind: 'app', note: '灯具展示：参考图（要求：灯具图）+ 比例五档' },
  'video.dining_table_showcase': { counterpart: QUANTV_VIDEO_BASE + '/apps?id=cmra7fik209979vzgmz2vpwy7', kind: 'app', note: '餐桌展示：参考图（要求：餐桌图）+ 比例五档' },
  'video.bathroom_activity': { counterpart: QUANTV_VIDEO_BASE + '/apps?id=cmr96y3mb00ys2xm0z0y7540a', kind: 'app', note: '浴室洗漱：参考图（要求：浴室图）+ 比例五档（人物活动）' },
  'video.study_activity': { counterpart: QUANTV_VIDEO_BASE + '/apps?id=cmr96q1ai00u82xm0zp8dhinr', kind: 'app', note: '书房学习：参考图（要求：书房图）+ 比例五档（人物活动）' },
  'video.bedroom_activity': { counterpart: QUANTV_VIDEO_BASE + '/apps?id=cmr96b5p400mb2xm006sh9o35', kind: 'app', note: '卧室就寝：参考图（要求：卧室图）+ 比例五档（人物活动）' },
  'video.dining_activity': { counterpart: QUANTV_VIDEO_BASE + '/apps?id=cmr965qf700k52xm0d3q3g1dv', kind: 'app', note: '餐厅聚餐：参考图（要求：餐厅图）+ 比例五档（人物活动）' },
  'video.interior_renovation': { counterpart: QUANTV_VIDEO_BASE + '/apps?id=cmr96eilw00p42xm0uocpkuwp', kind: 'app', note: '室内装修：首图要求：室内毛坯图 + 尾图要求：室内效果图 + 比例五档' },
  'video.home_staging': { counterpart: QUANTV_VIDEO_BASE + '/apps?id=cmr960avj00j52xm0cv4e527q', kind: 'app', note: '家装布置：首图要求：室内空房图 + 尾图要求：室内效果图 + 比例五档' },
  'video.drama_modern_family': { counterpart: QUANTV_VIDEO_BASE + '/apps?id=cmr1w7wvz00z914i3f5h4hifu', kind: 'app', note: '现代豪门婆媳：参考图 1 + 时长 10/15 + 比例（9:16 打头）' },
  'video.drama_palace': { counterpart: QUANTV_VIDEO_BASE + '/apps?id=cmr1w7twq00z514i3hw6s0clk', kind: 'app', note: '华丽古典后宫：参考图 1 + 时长 10/15 + 比例（9:16 打头）' },
  'video.drama_feud': { counterpart: QUANTV_VIDEO_BASE + '/apps?id=cmr1w7qqt00z314i3r4rnmzfs', kind: 'app', note: '豪门恩怨短剧：参考图 1 + 时长 10/15 + 比例（9:16 打头）' },
  'video.talk_show': { counterpart: QUANTV_VIDEO_BASE + '/apps?id=cmr1w7n9000z114i3rvzyd4c8', kind: 'app', note: '趣味脱口秀：主题 + 角色图 0/1 + 脱口秀名字 + 带货产品图 0/8 + 比例（9:16 打头）' },

  /* ── 知渔**没有**对应页：我们自有的玩法（"没有"也是明确结论，不借 URL 充数）─────── */
  'video.frame': { counterpart: null, reason: '首尾帧：知渔 31 个子页面里没有这一档（他们视频侧只有单图 / 首尾图 / 脚本 / 参考视频四种形态，没有"首尾帧"页）' },
  'video.product_motion': { counterpart: null, reason: '商品动态展示：知渔的"单图控制"页是按对象拆的（淋浴 / 台盆 / 灯具 / 餐桌展示），没有通用商品运镜页' },
  'video.space_tour': { counterpart: null, reason: '空间漫游：知渔这一族是按房间拆的单图页（淋浴 / 台盆 / 浴室 / 书房 / 卧室 / 餐厅），没有"通用空间漫游"页' },
  'video.interior_story': { counterpart: null, reason: '空间叙事短片：知渔那一族是"单图 / 首尾图的变化效果"，没有叙事片这一档' },
  'video.traffic_swap': { counterpart: null, reason: '红绿灯换装：知渔的换装只在短剧风格三页（豪门婆媳 / 后宫宫斗 / 豪门恩怨）里，那是剧情带货，语义不同' },
  'video.car_weekly': { counterpart: null, reason: '车内一周换装：知渔换装玩法同上（剧情短剧），没有车内换装页' },
  'video.outfit_transition': { counterpart: null, reason: '服饰变装转场：知渔没有卡点变装转场页' },
  'video.fog_reveal': { counterpart: null, reason: '擦雾出产品：知渔的单图控制族里没有这一档' },
  'video.one_image_showcase': { counterpart: null, reason: '一图裂变展示：知渔没有"一图裂变"页' },
  'video.scene_stitch': { counterpart: null, reason: '多场景拼接：知渔没有多场景拼接页' },
  'video.beat_mashup': { counterpart: null, reason: '卡点混剪：知渔没有"多张图卡点"页（他们的爆款复刻是参考一条片子，不是多图卡点）' },
  'video.product_explode': { counterpart: null, reason: '产品爆炸展示：知渔的爆炸是**图片**侧的「电影级高端产品爆炸瞬间海报」，视频侧没有' },
  'video.snack_unbox': { counterpart: null, reason: '零食开箱：知渔没有开箱页' },
  'video.tech_rotate': { counterpart: null, reason: '3C 旋转展示：知渔的单图控制族里没有 3C 旋转页' },
  'video.food_craving': { counterpart: null, reason: '食品馋感特写：知渔视频侧没有食品特写页' },
  'video.home_goods_demo': { counterpart: null, reason: '家居好物演示：知渔没有"在家用一遍"页' },
  'video.multi_angle_showcase': { counterpart: null, reason: '多角度展示：知渔的"多角度"是**图片**侧的「商品多角度多视图」，视频侧没有同页' },
  'video.product_placement': { counterpart: null, reason: '产品植入：知渔只有内容替换（换模特 / 换产品），没有"植入到已有视频"页' },
  'video.text_consistency': { counterpart: null, reason: '文字一致性广告：知渔没有这一页（文案约束写在各自 app 的提示词里）' },
  'video.ai_styling': { counterpart: null, reason: 'AI 模特换装：知渔只有一页模特服装展示（穿搭图1/2/3 + 椅子图），"同一模特换几套"是另一种字段形态' },
  'video.street_style': { counterpart: null, reason: '服装街拍带货：知渔只有一页模特服装展示，没有街拍页' },
  'video.beauty_macro': { counterpart: null, reason: '美妆质感特写：知渔视频侧没有美妆微距页' },
  'video.festival_spot': { counterpart: null, reason: '节日营销短片：知渔没有节点氛围片页' },
  'video.scene_edit': { counterpart: null, reason: '辅助能力（tier: assistant，没有自己的子页面）：长在 video.product_placement / video.content_swap / video.remake 的创作台上（fuses 已声明归宿）；知渔也没有"只改指定元素"页' },
  'video.extend': { counterpart: null, reason: '辅助能力（tier: assistant，没有自己的子页面）：知渔也没有续写页' },
  'video.camera_move': { counterpart: null, reason: '辅助能力（tier: assistant，没有自己的子页面）：知渔的运镜写在各自 app 的提示词里，没有独立的运镜控制页' },
});

/* 有对应页的那些（门禁用它来核对覆盖率） */
export function quantvVideoCounterpartOf(skillId) {
  return QUANTV_VIDEO_COUNTERPARTS[skillId] || null;
}

/* ═══ 左栏「参数配置」组头：知渔视频侧**全量计数**的结论（不是抽样）═══════════════════════
   用户铁律：「所有的逻辑，所有的布局，所有的规范都得是一模一样的」。
   批 Q-⑥ 给视频子页面加了「参数配置」组头，那一版是照 **app 页**实测的（/apps?id=… 有组头）——
   本轮把 32 个子页面**逐条计数**（证据 docs/design/data/quantv-video-pages.json 的 panelText 全文检索）：
     · 有「参数配置」**25** 条；**没有**的 **7** 条（下面这份名单就是那 7 条，逐字来自实采）。
   ⇒ 判据不能用"app 页有、路由页没有"去猜：那两句话各有一个反例 ——
       · **视频字幕去除**（路由页）实测**有**组头；
       · **趣味脱口秀**（app 页）实测**没有**组头。
     所以这里直接登记**没有组头的那 7 个 URL**（要证"没有"就把名单摊开，不用近似规则），
     门禁 test/video-route-subpage-parity-0921 拿这份名单与实采 json **逐条**核对：
     名单与证据一旦漂移就红。 */
const PAGES_WITHOUT_PARAM_GROUP = new Set([
  QUANTV_VIDEO_BASE + '/ai-video',                  // 视频创作
  QUANTV_VIDEO_BASE + '/video-recreation',          // 爆款复刻
  QUANTV_VIDEO_BASE + '/store-visit-video',         // 探店视频
  QUANTV_VIDEO_BASE + '/content-replace',           // 内容替换（路由页）
  QUANTV_VIDEO_BASE + '/digital-human',             // 数字人
  QUANTV_VIDEO_BASE + '/video-high-definition',     // 视频高清
  QUANTV_VIDEO_BASE + '/apps?id=cmr1w7n9000z114i3rvzyd4c8',   // 趣味脱口秀（app 页里唯一没有组头的）
]);

export function quantvVideoShowsParamGroup(skillId) {
  const record = QUANTV_VIDEO_COUNTERPARTS[skillId];
  /* 自有玩法（counterpart: null）知渔没有对应页可比：沿用现状（渲染组头）——
     32 条里 25 条有组头，这是多数形态，且这是"不改动既有页面"的保守取法。 */
  if (!record || !record.counterpart) return true;
  return !PAGES_WITHOUT_PARAM_GROUP.has(String(record.counterpart));
}

export function videoSkillsWithCounterpart() {
  return Object.entries(QUANTV_VIDEO_COUNTERPARTS)
    .filter(([, v]) => v && v.counterpart)
    .map(([id]) => id);
}

export function videoSkillsWithoutCounterpart() {
  return Object.entries(QUANTV_VIDEO_COUNTERPARTS)
    .filter(([, v]) => v && v.counterpart === null)
    .map(([id]) => id);
}
