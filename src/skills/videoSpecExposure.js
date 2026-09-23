/* ═══ 规格暴露表：**知渔那一页有没有「模型 / 清晰度 / 时长」这几格** ═══════════════════════════
   为什么要这张表（用户 2026-09-24 的方向性批评）：
     「你为什么还有这种**模型 / 清晰度 / 时长都全部做进去**的情况呢，我不是说了所有子页面
      **一比一对应**知渔的视频生成和图片生成的页面吗，还有这种情况出现说明还是没有对齐呀，
      你要**深度的全面核查**解决对齐呀」

   核查方法（可复跑）：把 `docs/design/data/quantv-video-pages.json`（知渔 32 页的实采全文）
   按对照表逐页取过来，检索那一页有没有「视频模型 / 分辨率(清晰度) / 时长」这三格。
   核查结果（30 个有对应页的视频 skill）：
     · **清晰度**：知渔 **0 页**有 —— 我们 **30 页**全给了；
     · **模型**：知渔 5 页有 —— 我们 25 页给了；
     · **时长**：知渔 6 页有 —— 我们 24 页给了。
   ⇒ 所以这张表默认是"三项全 false"（不暴露），只有知渔那一页确实有的才为 true。
     ⚠️ 表由证据派生，**不许手改**：门禁 test/video-spec-exposure-0924.test.mjs 会用同一份
        实采数据重新派生并逐条比对，手改必红（本仓的"名单写两处必然漂移"教训）。
   ⚠️ 知渔没有对应页的 26 条（自有玩法）：按其所属分类的**多数形态**处理 —— 这批数据里
      它们是"单图/首尾图 + 比例"这一族，所以同样不暴露三项（见文件末尾的 fallback）。 */
export const VIDEO_SPEC_EXPOSURE = Object.freeze({
  'video.smart': { model: true, clarity: false, duration: false },   // 智能成片
  'video.remake': { model: true, clarity: false, duration: false },   // 爆款复刻
  'video.image_to_video': { model: false, clarity: false, duration: false },   // 图生视频
  'video.content_swap': { model: false, clarity: false, duration: false },   // 内容替换
  'video.model_runway': { model: false, clarity: false, duration: false },   // 模特动态
  'video.light_shift': { model: false, clarity: false, duration: false },   // 光线变化
  'video.day_night': { model: false, clarity: false, duration: true },   // 日夜气候切换
  'video.furnishing_in': { model: false, clarity: false, duration: false },   // 软装进场
  'video.floorplan_grow': { model: false, clarity: false, duration: false },   // 户型生长
  'video.building_grow': { model: false, clarity: false, duration: false },   // 建筑生长
  'video.plant_grow': { model: false, clarity: false, duration: false },   // 植物生长
  'video.tech_tvc': { model: true, clarity: false, duration: false },   // 3C 产品 TVC
  'video.book_selling': { model: true, clarity: false, duration: false },   // 图书知识带货
  'video.food_asmr': { model: true, clarity: false, duration: false },   // 美食吃播 ASMR
  'video.store_tour': { model: false, clarity: false, duration: true },   // 探店漫游
  'video.storyboard_to_video': { model: false, clarity: false, duration: true },   // 分镜转视频
  'video.shower_showcase': { model: false, clarity: false, duration: false },   // 淋浴展示
  'video.basin_showcase': { model: false, clarity: false, duration: false },   // 台盆展示
  'video.lighting_showcase': { model: false, clarity: false, duration: false },   // 灯具展示
  'video.dining_table_showcase': { model: false, clarity: false, duration: false },   // 餐桌展示
  'video.bathroom_activity': { model: false, clarity: false, duration: false },   // 浴室洗漱
  'video.study_activity': { model: false, clarity: false, duration: false },   // 书房学习
  'video.bedroom_activity': { model: false, clarity: false, duration: false },   // 卧室就寝
  'video.dining_activity': { model: false, clarity: false, duration: false },   // 餐厅聚餐
  'video.interior_renovation': { model: false, clarity: false, duration: false },   // 室内装修
  'video.home_staging': { model: false, clarity: false, duration: false },   // 家装布置
  'video.drama_modern_family': { model: false, clarity: false, duration: true },   // 现代豪门婆媳
  'video.drama_palace': { model: false, clarity: false, duration: true },   // 华丽古典后宫
  'video.drama_feud': { model: false, clarity: false, duration: true },   // 豪门恩怨短剧
  'video.talk_show': { model: false, clarity: false, duration: false },   // 趣味脱口秀
  /* ═══ 2026-09-25 批 AM：本地方案两条（照知渔两条路由页派生）══════════════════════════════════
     派生判据（门禁 test/video-spec-exposure-0924 用同一份实采全文重算）：
       · 视频高清   /video-high-definition 的 panelText 里有「输出分辨率」⇒ clarity: true；
         没有「模型」与「时长」⇒ 另两项 false。
         ⚠️ 这一格的落点与上游不同：它不在创作台的「生成设置」面板里，而是**这一页自己的字段块**
            （知渔也把它放在「视频设置」下）。所以创作台那边见到本地方案就不再重复画一遍
            （判据：workbench 里已经声明了 bind 为 resolution 的块 ⇒ 创作台不再渲染清晰度段）。
       · 视频字幕去除 /video-subtitle-removal 的 panelText 里有「视频模型」⇒ model: true。
         ⚠️ 但它是**静态一行**（不在 panelButtons 里 ⇒ 不是可选控件）：所以这一页按 plan.hideModel
            渲染成"标题 + 值"的只读行（智能去字幕），**不给模型选择器** —— 本地方案没有模型可选。 */
  'video.upscale': { model: false, clarity: true, duration: false },   // 视频高清
  'video.desubtitle': { model: true, clarity: false, duration: false },   // 视频字幕去除
  /* ═══ 2026-09-26 批 AU：数字人（口型对齐）═════════════════════════════════════════════════════
     派生自知渔 /digital-human 的实采 panelText（那页抓到的是第 01 步「IP 深度学习」的文案表单：
     「生成爆款文案（0.25 积分）· 视频类型 口播/剧情 · 文案类型 人设型/卖点型 · 行业+人设/
     产品业务/卖点+价格/其他要求」）——**三项都没有**（没有"模型"、没有"清晰度/分辨率"、没有"时长"），
     所以与 fallback 同形。这一页露出来的两格是**我们自己的输入契约**（人物视频 / 驱动配音），
     不是知渔那页的规格格 —— 与"规格暴露"这件事不是一回事。 */
  'video.digital_human': { model: false, clarity: false, duration: false },   // 数字人
});

/* 知渔没有对应页的自有玩法：不暴露这三项（与"建筑室内那一族"的形态一致） */
export const SPEC_EXPOSURE_FALLBACK = Object.freeze({ model: false, clarity: false, duration: false });

export function specExposureOf(skillId) {
  return VIDEO_SPEC_EXPOSURE[skillId] || SPEC_EXPOSURE_FALLBACK;
}
