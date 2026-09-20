/* ═══ 图片侧「skill ↔ 知渔对应页」对照表（单一事实源）═══════════════════════════════
   为什么要有这个文件：
   用户第 19 轮批注：「你一直跟我说你现在全部有去映射，有去核查。可是在我看来根本就没有变化呀。」
   —— 我上一轮的映射表**只存在于临时脚本里**，落不了库、下一轮就丢，而且我当时还漏填了 4 条
      （商品套图 / A+内容 / 详情图 / 图片复刻 有对应页却没写进表）。
   所以这一层要**变成仓库里的声明**，并由门禁钉住：
     · 每条有对应页的 skill 必须在这里写清 counterpart（URL + 依据）；
     · 每条**确实没有**对应页的，必须显式写 counterpart: null 并注明理由 ——
       "没有"也要是一个明确结论，不能是"忘了填"。

   ⚠️ counterpart 的判据（两条都过才算）：
     ① 语义上是不是同一件事（不是关键词蒙的）；
     ② 字段形态（kind 序列）能不能对上。
     实测里"中式广告板"能按关键词蒙到 5 个不同的知渔海报页，但字段形态一个都对不上 —— 那种不写。

   ⚠️ 本文件**只做对照与取证**，不参与渲染。渲染用的字段声明仍在 src/skills/imageSkills.js。
      这里存的是"我们这条抄的是知渔哪一页、抄到什么程度"。 */

export const QUANTV_IMAGE_BASE = 'https://laoyu.quantv.com';

/* ═══ 2026-09-19 批 P：URL 形态修正 ═══════════════════════════════════════════════════
   图片侧的 app 页在知渔是「/image-creation?id=…」，不是「/apps?id=…」——后者是**视频**市场的路由。
   实测（CDP，2026-09-19）：把图片 app 的 id 拼到 /apps 上，页面直接显示「应用不存在」；
   也就是说本文件上一版记的 28 条对照 URL 全都打不开，等于对照表没法复查。
   本批逐条改成 /image-creation?id=…，并用同一批 URL 把 34 个对照页 DOM 实采了一遍
   （docs/design/data/quantv-image-pages.json，errors=0）。
   门禁 test/quantv-image-parity-machine-0920 守着这条形态：对照页 URL 必须能被真的打开。 */

/* 对照记录：id → { counterpart, kind, note } */
export const QUANTV_IMAGE_COUNTERPARTS = Object.freeze({
  /* ── 内置 ?tool= 页（知渔的"精品推荐"六条，不是应用市场里的 app）─────────────── */
  'image.product_suite': { counterpart: QUANTV_IMAGE_BASE + '/image-creation?tool=product-listing-set', kind: 'builtin', note: '商品套图：3 块（基础信息【上传图片 0/6 + 市场 9 + 平台 5 + 语言 14】→ 产品卖点与设计风格 → 套图结构配置）' },
  'image.aplus': { counterpart: QUANTV_IMAGE_BASE + '/image-creation?tool=aplus-content', kind: 'builtin', note: 'A+内容：市场 13 档 / 语言 13 档（无「无文字」）/ 包含模块 已选 0/16' },
  'image.detail_page': { counterpart: QUANTV_IMAGE_BASE + '/image-creation?tool=detail-image', kind: 'builtin', note: '详情图：与 A+ 同构，但**没有**「包含模块」' },
  'image.copy': { counterpart: QUANTV_IMAGE_BASE + '/image-creation?tool=image-clone', kind: 'builtin', note: '图片复刻：商品信息 0/4 + 参考图 0/20 + 复刻程度 + 统一复刻要求 + 市场/平台/语言 + 模型选择 + 分辨率 + 比例 13 档' },
  'image.remove_bg': { counterpart: QUANTV_IMAGE_BASE + '/image-creation?tool=remove-background', kind: 'builtin', note: '去除背景：**零字段**（只有「最多上传 5 张图片」0/5 + 一个「+」+ CTA），无底色无比例' },
  'image.try_on': { counterpart: QUANTV_IMAGE_BASE + '/image-creation?tool=ai-outfit', kind: 'builtin', note: 'AI换装：模特选择 / 服装选择(套装|多件) / 上传衣服图 / Pose 参考(可选) / 背景参考(可选) / 模型选择 / 分辨率 / 比例 / 生成张数' },

  /* ── 应用市场 app（/image-creation?id=…）────────────────────────────────────────────── */
  'image.poster': { counterpart: QUANTV_IMAGE_BASE + '/image-creation?id=cmq0jkxl101sj11azdge8ngqt', kind: 'app', note: '电商海报设计：上传图片 + 产品卖点(可选) + 比例 + 分辨率（**不是**「中文海报一键生成」——那是 cn_poster 的对应页）' },
  'image.cn_poster': { counterpart: QUANTV_IMAGE_BASE + '/image-creation?id=cmpqiqghx002adwyrx6cvw3i1', kind: 'app', note: '中文海报一键生成：8 字段（主题/画面描述/用途 8/生成尺寸/字体 6/颜色 15/效果 18/分辨率）' },
  'image.similar': { counterpart: QUANTV_IMAGE_BASE + '/image-creation?id=cmpqiad3w0026dwyr95fylrw4', kind: 'app', note: '相似图生成：上传参考图 + 参考强度(低|中|高) + 比例 + 选择分辨率' },
  'image.callout_diagram': { counterpart: QUANTV_IMAGE_BASE + '/image-creation?id=cmpky78ec0011pdvyt1e5e8pm', kind: 'app', note: '爆款商品文字海报：主题 + 上传产品图(可选) + 画面描述 + 字体 6 + 生成尺寸 + 分辨率' },
  'image.giant_product': { counterpart: QUANTV_IMAGE_BASE + '/image-creation?id=cmrndn80w1vvrrykqgxrphqrh', kind: 'app', note: '夏季蔬果巨物场景化摄影：蔬菜水果名字(纯文本) + 替换指令 + 比例(3 档) + 清晰度' },
  'image.tropical_poster': { counterpart: QUANTV_IMAGE_BASE + '/image-creation?id=cmrvryywr3b2w3591pnmyaxhe', kind: 'app', note: '极简日系饮品海报：饮料名称 + 比例 + 清晰度（**无上传位**）' },
  'image.scene': { counterpart: QUANTV_IMAGE_BASE + '/image-creation?id=cmpl7953r00b3jwjxzwkhag4f', kind: 'app', note: '商品场景展示：上传商品图 + 修图指令 + 比例 + 分辨率' },
  'image.swap_bg': { counterpart: QUANTV_IMAGE_BASE + '/image-creation?id=cmpl7iimr00b5jwjxnnrdfai4', kind: 'app', note: '一键模特换背景：上传原模特图 + 上传场景图(可选) + 自定义输入背景提示词(选填) + 比例 + 分辨率' },
  'image.style_swap': { counterpart: QUANTV_IMAGE_BASE + '/image-creation?id=cmppcy7k6000bim82qe4yl0tw', kind: 'app', note: '图片换风格：上传参考图 + 风格选择(22 档) + 比例 + 选择分辨率' },
  'image.retouch': { counterpart: QUANTV_IMAGE_BASE + '/image-creation?id=cmppcoe3r0009im82ydjztcsh', kind: 'app', note: '一键美化图片：上传图片 + 修图指令 + 比例 + 分辨率' },
  'image.portrait': { counterpart: QUANTV_IMAGE_BASE + '/image-creation?id=cmppfyccq000ndwyrtv2u0u4k', kind: 'app', note: '人像变清晰：上传图片 + 修图指令 + 比例 + 分辨率' },
  'image.hairstyle': { counterpart: QUANTV_IMAGE_BASE + '/image-creation?id=cmpp6p258001efhl6oo4xjiro', kind: 'app', note: 'AI换发型：上传图片 + 图片编辑指令 + 比例 + 分辨率' },
  'image.pose': { counterpart: QUANTV_IMAGE_BASE + '/image-creation?id=cmpsc52yp0011ng26jjuddknu', kind: 'app', note: '人物姿势参考：上传高清模特图 + 上传姿势图 + 比例 + 选择分辨率（**两格都是上传位**）' },
  'image.explode': { counterpart: QUANTV_IMAGE_BASE + '/image-creation?id=cmrn3vq131i8qrykqz7okw2b2', kind: 'app', note: '电影级高端产品爆炸瞬间海报：上传图片（产品图）+ 替换指令 + 比例 + 清晰度' },
  'image.ice_ad': { counterpart: QUANTV_IMAGE_BASE + '/image-creation?id=cmrk7vgnm22yjah7dsv4sgij2', kind: 'app', note: '极地冰封巨型广告海报：上传图片（产品图）+ 品牌名 + 比例 + 清晰度' },
  'image.float_kv': { counterpart: QUANTV_IMAGE_BASE + '/image-creation?id=cmrj8ghjh1qa6ah7dihczkoth', kind: 'app', note: '蓝白降落伞悬浮产品创意3D渲染广告：上传图片（产品图）+ 替换指令 + 比例 + 清晰度' },
  'image.tvc_grid': { counterpart: QUANTV_IMAGE_BASE + '/image-creation?id=cmrk8h7e823fiah7d3r0xvlfr', kind: 'app', note: '汽水广告九宫格：上传图片（汽水图）+ 比例 + 清晰度' },
  'image.multi_angle': { counterpart: QUANTV_IMAGE_BASE + '/image-creation?id=cmpf6uqxo0003swk5zl14xuma', kind: 'app', note: '商品多角度多视图：上传原图(最多 8) + 选择视角(多选 6 档) + 细节补充 + 比例 + 分辨率' },
  'image.batch': { counterpart: QUANTV_IMAGE_BASE + '/image-creation?id=cmpsbc5ap000eng26uj3ux436', kind: 'app', note: '批量出图电商图：上传产品图 + 角色图 + 场景图 + 自定义提示词 + 比例(10 档) + 分辨率' },
  'image.floorplan_render': { counterpart: QUANTV_IMAGE_BASE + '/image-creation?id=cmr32rkqk01ae5bh7709a0bui', kind: 'app', note: '平面转建筑效果图：8 字段（参考图 / 建筑类型 6 / 建筑气质 4 / 场地环境 4 / 光影氛围 8 / 更多描述 / 比例 / 清晰度）' },
  'image.interior_style': { counterpart: QUANTV_IMAGE_BASE + '/image-creation?id=cmppdorzs0003dwyrv2aozl2t', kind: 'app', note: '装修风格转换：上传图片 + 家装指令 + 比例 + 分辨率' },
  'image.rough_interior': { counterpart: QUANTV_IMAGE_BASE + '/image-creation?id=cmppdls900001dwyrdxork3qk', kind: 'app', note: '毛坯家装设计：上传图片 + 选择装修风格(5) + 其他需求 + 比例 + 选择分辨率' },
  'image.furniture_swap': { counterpart: QUANTV_IMAGE_BASE + '/image-creation?id=cmppd5cn2000dim825vko4c1a', kind: 'app', note: '一键软硬装替换：上传图片 + 家装指令 + 比例 + 分辨率' },
  'image.interior_3d': { counterpart: QUANTV_IMAGE_BASE + '/image-creation?id=cmppe2d6y0007dwyrwhcmotn2', kind: 'app', note: '室内3D模型渲染：上传3D模型图（必选）+ 图片编辑指令 + 比例 + 分辨率' },
  'image.day_night_still': { counterpart: QUANTV_IMAGE_BASE + '/image-creation?id=cmppd7ak7000fim821wjqb8fo', kind: 'app', note: '日夜气候切换：上传图片 + 修图指令 + 比例 + 分辨率' },
  'image.render_quality': { counterpart: QUANTV_IMAGE_BASE + '/image-creation?id=cmppe3ram0009dwyrvqtp2b48', kind: 'app', note: '效果图质感提升：上传图片 + 后期指令 + 比例 + 分辨率' },
  'image.arch_grid': { counterpart: QUANTV_IMAGE_BASE + '/image-creation?id=cmr32say401aj5bh7lhjt0ulz', kind: 'app', note: '建筑九宫格分镜：6 字段（参考图 / 大师风格 9 / 光影调节 9 / 创意描述(可选) / 比例 / 清晰度）' },
  'image.white_bg': { counterpart: QUANTV_IMAGE_BASE + '/image-creation?id=cmpkwl86g000xpdvyabret02g', kind: 'app', note: '提取电商白底图：上传图片（最好是1：1的比例）+ 抠图模式(透明背景|白色背景) —— 与「去除背景」是**两页**' },

  /* ── 我们自有、知渔没有对应页（"没有"也是明确结论）────────────────────────────
     判据：关键词与字段形态**双路比对都不过**。
     ⚠️ 不要往这里硬塞 —— 塞错页比空着更糟（用户：「不要凭想象」）。 */
  'image.free': { counterpart: null, reason: '自由创作：知渔没有"空白输入框起步"的通用生图页' },
  'image.social_cover': { counterpart: null, reason: '社媒封面：知渔的"小红书爆款复刻"是复刻玩法，不是封面尺寸排版' },
  'image.live_ui': { counterpart: null, reason: '直播带货主图：知渔没有直播界面感的带货主图页' },
  'image.liquid_logo': { counterpart: null, reason: '液态 Logo 海报：知渔只有「Logo风格转换」（Icon/logo 渲染周边），语义与字段形态都不同' },
  'image.landscape_logo': { counterpart: null, reason: '地景 Logo 幻象：同上，知渔无对应' },
  'image.sticker_collage': { counterpart: null, reason: '贴纸现实拼贴：知渔有「时尚手账风女孩穿搭拆解贴纸」，但那是穿搭拆解、不是贴纸拼贴' },
  'image.showroom_still': { counterpart: null, reason: '展厅静物主视觉：知渔「电影级商业摄影」是通用商业摄影，字段形态对不上' },
  'image.mono_pastel_ad': { counterpart: null, reason: '单色糖果系广告：知渔无同名同义页' },
  'image.grain_ad_board': { counterpart: null, reason: '中式广告板：按关键词能蒙到 5 个知渔海报页，但字段形态一个都对不上 —— 不硬套' },
  'image.material': { counterpart: null, reason: '材质细节：知渔无独立的材质微距页' },
  'image.sku_series': { counterpart: null, reason: 'SKU 多色系列图：知渔「商品多角度多视图」是视角不是配色，语义不同' },
  'image.gift_scene': { counterpart: null, reason: '礼盒场景图：知渔无礼盒场景页' },
  'image.teardown': { counterpart: null, reason: '拆解工艺图：知渔无拆解页' },
  'image.diorama': { counterpart: null, reason: '微缩场景广告：知渔的 3D 类页面是模型渲染，不是微缩场景' },
  'image.brand_kv': { counterpart: null, reason: '品牌主视觉：知渔无品牌 KV 页' },
  'image.xhs_note': { counterpart: null, reason: '小红书图文：走的是我们自己的图文链路（嵌入工作台），知渔的「小红书爆款复刻」是图片复刻' },
});

/* 有对应页的那些（门禁用它来核对覆盖率） */
export function quantvCounterpartOf(skillId) {
  return QUANTV_IMAGE_COUNTERPARTS[skillId] || null;
}

export function imageSkillsWithCounterpart() {
  return Object.entries(QUANTV_IMAGE_COUNTERPARTS)
    .filter(([, v]) => v && v.counterpart)
    .map(([id]) => id);
}

export function imageSkillsWithoutCounterpart() {
  return Object.entries(QUANTV_IMAGE_COUNTERPARTS)
    .filter(([, v]) => v && v.counterpart === null)
    .map(([id]) => id);
}
