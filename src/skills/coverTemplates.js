/* ═══ 封面模板与提示词（案例墙的产线定义）═══════════════════════════════════════
   依据 docs/design/43-media-architecture.md §6 与用户批注（图 #13）：
   「后期你要根据不同的板块去设计不同的封面模板……你把每一类的封面它的整体的提示词给到我，
    我去生成之后自己在后台上传上来」。
   实测口径（知渔）：封面**统一 4:3**、卡片上只有封面 + 标题，
   所以"风格一致"不是靠审美，是靠**同一比例 + 同一版式 + 同族色相**机械保证。
   本文件只做两件事：① 声明三个模板族的版式与槽位；② 用槽位拼出**可直接使用的出图提示词**。
   ⚠️ 这里只定义"怎么出封面"，不涉及 CSS/渲染 —— 案例卡的渲染是 CaseCard（唯一实现）。 */

export const COVER_ASPECT = '4:3';
export const COVER_SIZE = { width: 1600, height: 1200 };

/* 三个模板族：够用就好，不追求多（模板越多越难保持一致）。 */
export const COVER_TEMPLATES = [
  {
    id: 'case-3up',
    name: '案例三拼',
    useFor: ['电商商品套图', '模特上身 / 试穿', '小红书种草图文'],
    layout: '左侧标题区（占比约 1/3）+ 右侧三张成品图错落排列，三图轻微倾斜、彼此叠压',
    slots: ['subject', 'accent', 'title', 'subtitle'],
  },
  {
    id: 'hero-single',
    name: '主体单图',
    useFor: ['自由创作', '白底商品图'],
    layout: '整幅主体成品图铺满，左上角留白给标题，右下角留一个小角标位',
    slots: ['subject', 'accent', 'title'],
  },
  {
    id: 'poster-style',
    name: '海报满幅',
    useFor: ['海报设计', '社媒封面'],
    layout: '整幅以成品海报为主视觉，底部压一条半透明标题条，标题与副标题左对齐',
    slots: ['subject', 'accent', 'title', 'subtitle'],
  },
  {
    /* 第 4 类：修图 / 复刻 / 试穿 / 去背景这类"输入决定输出"的 skill，
       单张成品说不清它干什么 —— 实测竞品的「提取电商白底图」封面就是原图 → 箭头 → 白底成品。
       43 §10.4 也写了：复刻/修图类 skill 的示例一律做 before/after。 */
    id: 'before-after',
    name: '原图对比',
    useFor: ['模特上身 / 试穿', '图片复刻', '去背景', '修图增强'],
    layout: '左右并置：左边原图、右边 AI 成品，中间一个箭头；两张图等大、同一底色',
    slots: ['subject', 'accent', 'title'],
  },
];

/* 色相分组：同组同色温，跨组一眼能区分（实测他们也是这么分区的）。 */
export const COVER_ACCENTS = {
  warm: { name: '暖调', hint: '米杏、陶土、暖白，适合电商与商业海报' },
  soft: { name: '柔调', hint: '奶油、雾粉、浅灰，适合人像与生活场景' },
  cool: { name: '冷调', hint: '雾蓝、灰绿、冷白，适合白底与修图类' },
  accent: { name: '高饱和', hint: '品牌紫为主点缀，适合社媒封面与活动海报' },
  neutral: { name: '中性', hint: '黑白灰为主，只留一个点缀色，适合自由创作' },
};

export const COVER_STYLE_RULES = [
  '统一 4:3（1600×1200），四角不得出现水印、logo、二维码',
  '标题最多 8 个汉字，副标题最多 16 个汉字；标题字号明显大于副标题',
  '同一套封面的字体气质必须一致（标题用无衬线粗体，副标题用同族常规字重）',
  '留白不少于画面的 18%，保证缩到 274×205 的卡片尺寸时仍然认得出主体',
  '画面里不出现任何模型名、价格、积分或促销文案（那些由界面渲染，不进封面）',
];

/* 槽位 → 中文提示词片段。拼出来的提示词可以直接丢给任意生图模型。 */
export function buildCoverPrompt({ template = 'case-3up', accent = 'neutral', subject = '商品', title = '', subtitle = '' } = {}) {
  const tpl = COVER_TEMPLATES.find(item => item.id === template) || COVER_TEMPLATES[0];
  const tone = COVER_ACCENTS[accent] || COVER_ACCENTS.neutral;
  const lines = [
    '【用途】生成一张 4:3（1600×1200）的案例封面图，用于 AI 创作平台的案例墙卡片。',
    '【版式】' + tpl.layout + '。',
    '【主体】' + subject + '。主体清晰、边缘干净，居中偏右，右侧留出标题区。',
    '【色相】' + tone.name + '：' + tone.hint + '。',
    '【文字】' + (title ? '主标题「' + title + '」' : '主标题留白由后期排版') + (subtitle ? '，副标题「' + subtitle + '」' : '') + '。标题用无衬线粗体，左对齐。',
    '【风格】商业级棚拍质感，柔和棚光 + 轻微景深，画面干净、有呼吸感，缩到 274×205 依然辨识度强。',
    '【禁止】不要水印、logo、二维码、价格、积分、模型名；不要拼贴边框；不要超过两种字体气质。',
    '【留白】不少于画面 18%。',
  ];
  return lines.join('\n');
}

/* 图片板块各 Skill 的封面计划：照这个表出图即可，标题即卡片上显示的文字。
   封面素材来自该 skill 的 cases（见 coverTilesFor）——先有计划、后补案例，缺案例时产线会跳过并报"待补"。 */
export const IMAGE_COVER_PLAN = [
  /* 精品推荐（推荐位：封面只用图、不烤字） */
  { skillId: 'image.free', template: 'hero-single', accent: 'neutral', subject: '一张风格鲜明的生成插画或摄影作品', title: '自由创作' },
  { skillId: 'image.poster', template: 'poster-style', accent: 'warm', subject: '一张已经排好信息层级的海报成品', title: '海报设计', subtitle: '主视觉先行，信息其次' },
  { skillId: 'image.social_cover', template: 'poster-style', accent: 'accent', subject: '一张移动端缩略图里也读得清的封面成品', title: '社媒封面', subtitle: '小图也能一眼看懂' },
  { skillId: 'image.product_suite', template: 'case-3up', accent: 'warm', subject: '同一款商品的三种电商成品图（白底、场景、卖点）', title: '电商套图', subtitle: '白底+场景+卖点成套' },
  /* 电商专区 */
  { skillId: 'image.white_bg', template: 'hero-single', accent: 'cool', subject: '一件商品的白底主图，细节清楚', title: '白底商品图' },
  { skillId: 'image.scene', template: 'case-3up', accent: 'warm', subject: '同一商品在真实使用场景里的三张成品图', title: '场景种草图', subtitle: '放进真实生活里' },
  { skillId: 'image.material', template: 'case-3up', accent: 'cool', subject: '同一商品材质与工艺的三张微距特写', title: '材质细节', subtitle: '放大看工艺' },
  { skillId: 'image.multi_angle', template: 'case-3up', accent: 'cool', subject: '同一商品正面、侧面与俯视的多角度成套图', title: '多角度套图', subtitle: '一套看全整件' },
  { skillId: 'image.try_on', template: 'before-after', accent: 'soft', subject: '商品平铺图与模特穿着成品的对照画面', title: '模特试穿', subtitle: '上身效果先看见' },
  { skillId: 'image.batch', template: 'case-3up', accent: 'warm', subject: '商品、人物与场景三份素材合成的一组成品图', title: '批量商品图', subtitle: '三种素材一起出' },
  /* 创意应用 */
  { skillId: 'image.brand_kv', template: 'hero-single', accent: 'accent', subject: '一张统一的品牌主视觉成品画面', title: '品牌主视觉' },
  { skillId: 'image.cn_poster', template: 'poster-style', accent: 'warm', subject: '一张中文标题与画面一起排好的海报成品', title: '中文海报', subtitle: '中文标题一起排' },
  { skillId: 'image.copy', template: 'before-after', accent: 'cool', subject: '参考图与复刻成品的并排对照画面', title: '图文复刻', subtitle: '保住构图换内容' },
  { skillId: 'image.similar', template: 'hero-single', accent: 'neutral', subject: '由一张参考图延展出的同风格成品画面', title: '相似图生成' },
  { skillId: 'image.xhs_note', template: 'case-3up', accent: 'soft', subject: '一组小红书种草图（封面加两张内页）', title: '小红书图文', subtitle: '真实感优先' },
  /* 人像摄影 */
  { skillId: 'image.portrait', template: 'before-after', accent: 'soft', subject: '人像原片与精修成品的并排对照画面', title: '人像精修', subtitle: '皮肤光线一起收拾' },
  { skillId: 'image.hairstyle', template: 'before-after', accent: 'soft', subject: '同一个人换发型前后的并排对照画面', title: '换发型', subtitle: '保留五官换发型' },
  { skillId: 'image.pose', template: 'case-3up', accent: 'soft', subject: '同一个人三种姿势的三张成品照片', title: '姿势生成', subtitle: '一个人多个姿势' },
  /* 图片编辑 */
  { skillId: 'image.remove_bg', template: 'hero-single', accent: 'cool', subject: '去掉背景后的透明底与纯色底商品图', title: '去除背景' },
  { skillId: 'image.swap_bg', template: 'before-after', accent: 'cool', subject: '原背景与替换后背景的并排对照画面', title: '换背景', subtitle: '主体留着换背景' },
  { skillId: 'image.retouch', template: 'before-after', accent: 'neutral', subject: '修图前后同一张画面的并排对照', title: '图片精修', subtitle: '一句话改到能用' },
  { skillId: 'image.style_swap', template: 'before-after', accent: 'warm', subject: '主体不变、材质替换前后的并排对照画面', title: '材质替换', subtitle: '主体不动换材质' },
  /* ── 2026-09-17 新增（批次三十二）：A+/详情页 + 8 条爆款配方 + 8 条建筑家装 ──
     封面计划是**用户自己去跑案例时用的出图配方**（原话：「你把每一类的封面它的整体的提示词给到我，
     我去生成之后自己在后台上传上来」），所以每条都要写清"这张封面该长什么样"，
     而且版式必须选对：成套类走 case-3up、单图类走 hero-single、
     **改图类（平面转效果图 / 风格转换 / 毛坯 / 换软装 / 提质感）走 before-after** ——
     这类 skill 单张成品说不清它干什么（43 §10.4 的实测口径）。 */
  { skillId: 'image.aplus', template: 'case-3up', accent: 'accent', subject: '同一个商品的图文模块排版成品（左图右文、标题清晰）', title: 'A+内容图', subtitle: '图文并排讲卖点' },
  { skillId: 'image.detail_page', template: 'poster-style', accent: 'warm', subject: '一张竖版详情页模块成品（标题 + 主图 + 说明）', title: '详情页模块', subtitle: '首屏卖点成分逐屏' },
  { skillId: 'image.explode', template: 'hero-single', accent: 'warm', subject: '商品在半空炸开、碎片与成分定格的广告画面', title: '爆炸分解', subtitle: '碎片与成分定格' },
  { skillId: 'image.ice_ad', template: 'poster-style', accent: 'cool', subject: '商品被封在巨型冰块中的超现实广告海报', title: '极地冰封', subtitle: '封进冰块的大场面' },
  { skillId: 'image.float_kv', template: 'hero-single', accent: 'neutral', subject: '商品悬浮、单向侧光切过的高级静物广告画面', title: '悬浮主视觉', subtitle: '一束光切出高级感' },
  { skillId: 'image.tvc_grid', template: 'case-3up', accent: 'accent', subject: '同一商品的九格广告分镜板（3×3、含时间码）', title: '九宫格分镜', subtitle: '一张图九个镜头' },
  { skillId: 'image.sku_series', template: 'case-3up', accent: 'soft', subject: '同款商品不同配色整齐排列的系列图', title: 'SKU多色图', subtitle: '只换颜色不换结构' },
  { skillId: 'image.gift_scene', template: 'hero-single', accent: 'warm', subject: '商品放在礼盒与桌面场景中的成品图', title: '礼盒场景', subtitle: '同风格可批量复制' },
  { skillId: 'image.teardown', template: 'case-3up', accent: 'cool', subject: '商品拆成零件并列展示的工艺拆解图', title: '拆解工艺图', subtitle: '拆开讲清工艺' },
  { skillId: 'image.diorama', template: 'hero-single', accent: 'accent', subject: '商品置于微缩立体场景中的模型感广告画面', title: '微缩场景', subtitle: '住进微缩世界' },
  { skillId: 'image.floorplan_render', template: 'before-after', accent: 'cool', subject: '户型平面图与三维室内效果图的并排对照', title: '平面转效果图', subtitle: '户型图长出三维' },
  { skillId: 'image.interior_style', template: 'before-after', accent: 'warm', subject: '同一空间两种装修风格的并排对照画面', title: '风格转换', subtitle: '结构不动换风格' },
  { skillId: 'image.rough_interior', template: 'before-after', accent: 'soft', subject: '毛坯现场与精装完成效果的并排对照', title: '毛坯房设计', subtitle: '毛坯直接出精装' },
  { skillId: 'image.day_night_still', template: 'case-3up', accent: 'cool', subject: '同一栋建筑白天、黄昏与夜晚的三张成品', title: '日夜切换', subtitle: '一张图三种天光' },
  { skillId: 'image.furniture_swap', template: 'before-after', accent: 'accent', subject: '结构不变、家具与饰面替换前后的并排对照', title: '软硬装替换', subtitle: '只换家具不拆墙' },
  { skillId: 'image.render_quality', template: 'before-after', accent: 'neutral', subject: '普通效果图与质感提升之后的并排对照', title: '质感提升', subtitle: '塑料感变商业级' },
  { skillId: 'image.interior_3d', template: 'hero-single', accent: 'accent', subject: '白模渲染成照片级室内实景的成品画面', title: '室内3D渲染', subtitle: '白模变实景照片' },
  { skillId: 'image.arch_grid', template: 'case-3up', accent: 'cool', subject: '同一栋建筑的九个视角九宫格分镜板', title: '建筑分镜', subtitle: '一张图讲完一栋楼' },
];

/* 视频板块各 Skill 的封面计划：与 docs/design/45-cover-shotlist.md 同一张表。
   ⚠️ 2026-09-17 起技能数已不止 10 条（批次三十二新增 8 条建筑家装），
      这张表必须**跟着声明源走**：加一条 skill 就要加一条封面计划，缺一条门禁就拦。 */
export const VIDEO_COVER_PLAN = [
  { skillId: 'video.smart', template: 'case-3up', accent: 'accent', subject: '一段商品短片的三个关键帧（开场、特写、收束）', title: '智能成片', subtitle: '一句话起步' },
  { skillId: 'video.frame', template: 'case-3up', accent: 'cool', subject: '同一镜头首帧与尾帧的对比画面', title: '首尾帧', subtitle: '锁定起点与终点' },
  { skillId: 'video.remake', template: 'case-3up', accent: 'warm', subject: '参考片节奏与替换后成片的对照画面', title: '爆款复刻', subtitle: '保住节奏换内容' },
  { skillId: 'video.image_to_video', template: 'hero-single', accent: 'warm', subject: '一件商品静图与它动起来后的画面并置', title: '图生视频' },
  { skillId: 'video.product_motion', template: 'hero-single', accent: 'warm', subject: '商品旋转、光影扫过的动态瞬间', title: '商品动态' },
  { skillId: 'video.content_swap', template: 'case-3up', accent: 'soft', subject: '同一段动作里人物被替换前后的对照画面', title: '内容替换', subtitle: '一键换人' },
  { skillId: 'video.model_runway', template: 'hero-single', accent: 'soft', subject: '模特转身迈步、衣摆飘动的瞬间', title: '模特动态' },
  { skillId: 'video.camera_move', template: 'case-3up', accent: 'accent', subject: '同一场景下推、移、环绕三种运镜的画面', title: '运镜控制', subtitle: '指定镜头怎么走' },
  { skillId: 'video.extend', template: 'case-3up', accent: 'cool', subject: '同一镜头前后两段连续画面的衔接', title: '延长续写' },
  { skillId: 'video.festival_spot', template: 'poster-style', accent: 'accent', subject: '节日氛围中的商品短片关键画面', title: '节日短片', subtitle: '节点氛围+商品' },
  /* ── 建筑家装（用户 9-17 明确要求做的一档）──
     视频封面按竞品做法是**一段真在播的短片**（他们的卡里就是 <video>），
     所以这里给的是一张 poster + 三个关键帧的说明；案例由用户自己跑出来再替换。 */
  { skillId: 'video.space_tour', template: 'case-3up', accent: 'cool', subject: '镜头沿动线穿过客厅、餐厅、主卧的三个关键帧', title: '空间漫游', subtitle: '镜头走一遍空间' },
  { skillId: 'video.light_shift', template: 'case-3up', accent: 'warm', subject: '同一空间清晨、正午、黄昏、夜晚的四帧光线对比', title: '光线变化', subtitle: '机位不动光在走' },
  { skillId: 'video.day_night', template: 'case-3up', accent: 'cool', subject: '同一场景白天、黄昏、夜晚、雨夜的四帧对比', title: '日夜切换', subtitle: '一场戏四种天气' },
  { skillId: 'video.furnishing_in', template: 'case-3up', accent: 'soft', subject: '空房到家具软装依次落位的三个关键帧', title: '软装进场', subtitle: '空房变样板间' },
  { skillId: 'video.floorplan_grow', template: 'case-3up', accent: 'accent', subject: '户型图到三维空间生长的三个关键帧', title: '户型生长', subtitle: '户型图长成空间' },
  { skillId: 'video.building_grow', template: 'hero-single', accent: 'cool', subject: '建筑从地基逐层长成的三个关键帧', title: '建筑生长', subtitle: '一层层长起来' },
  { skillId: 'video.plant_grow', template: 'hero-single', accent: 'soft', subject: '植物抽芽、展叶、开花的三帧连续画面', title: '植物生长', subtitle: '时间加速的生长' },
  { skillId: 'video.interior_story', template: 'case-3up', accent: 'warm', subject: '人物在空间里一天活动的三个关键帧', title: '空间叙事', subtitle: '一支片讲一天' },
  /* ── 调研落地的爆款玩法（2026-09-17，17 条）──
     来源同上（docs/research/2026-09-17-video-skill-candidates.md）。
     视频封面按竞品做法最终会替换成**一段真在播的短片**（他们卡里就是 <video>），
     所以这里先给 poster 出图配方，等用户跑出成片再换成 mp4。 */
  { skillId: 'video.traffic_swap', template: 'case-3up', accent: 'accent', subject: '同一个人在同一路口三套穿搭的换装关键帧', title: '红绿灯换装', subtitle: '红灯一亮换一套' },
  { skillId: 'video.car_weekly', template: 'case-3up', accent: 'soft', subject: '车内固定机位下七套穿搭依次切换的关键帧', title: '车内换装', subtitle: '一周七套穿搭' },
  { skillId: 'video.outfit_transition', template: 'case-3up', accent: 'accent', subject: '卡点转场换装的连续三帧画面', title: '变装转场', subtitle: '卡着音乐换装' },
  { skillId: 'video.fog_reveal', template: 'hero-single', accent: 'cool', subject: '手指擦开雾气后商品从模糊变清晰的一帧', title: '擦雾出产品', subtitle: '擦开雾气露出来' },
  { skillId: 'video.one_image_showcase', template: 'case-3up', accent: 'warm', subject: '一张商品图裂变成多格展示的关键帧', title: '一图裂变', subtitle: '一张图变一组镜头' },
  { skillId: 'video.product_explode', template: 'hero-single', accent: 'warm', subject: '商品在空中炸开、零件悬浮的动态关键帧', title: '产品爆炸', subtitle: '炸开再合回去' },
  { skillId: 'video.snack_unbox', template: 'case-3up', accent: 'warm', subject: '拆袋、倒出与捏起零食的三个关键帧', title: '零食开箱', subtitle: '拆开就想吃' },
  { skillId: 'video.tech_rotate', template: 'hero-single', accent: 'cool', subject: '数码产品在台面上旋转展示的连续帧', title: '3C旋转展示', subtitle: '转一圈看细节' },
  { skillId: 'video.food_craving', template: 'hero-single', accent: 'warm', subject: '食物拉丝、爆汁、冒热气的微距关键帧', title: '馋感特写', subtitle: '把馋劲拍出来' },
  { skillId: 'video.tech_tvc', template: 'case-3up', accent: 'cool', subject: '暗场光束到产品特写与使用场景的三帧', title: '3C产品TVC', subtitle: '一支完整广告片' },
  { skillId: 'video.home_goods_demo', template: 'case-3up', accent: 'soft', subject: '居家场景里拿出、使用与收纳商品的三帧', title: '家居演示', subtitle: '在家里用一遍' },
  { skillId: 'video.beauty_macro', template: 'hero-single', accent: 'soft', subject: '膏体质地与上脸后皮肤状态的微距关键帧', title: '美妆特写', subtitle: '微距讲质感' },
  { skillId: 'video.street_style', template: 'case-3up', accent: 'warm', subject: '街头走动、转身与细节展示的三个关键帧', title: '街拍带货', subtitle: '走两步演版型' },
  { skillId: 'video.ai_styling', template: 'case-3up', accent: 'soft', subject: '同一位模特换上多套服装的关键帧', title: 'AI模特换装', subtitle: '同一个人换几套' },
  { skillId: 'video.book_selling', template: 'case-3up', accent: 'warm', subject: '书页翻动与封面收束的三个关键帧', title: '图书带货', subtitle: '翻页讲一本书' },
  { skillId: 'video.food_asmr', template: 'hero-single', accent: 'warm', subject: '近距离食物与餐具的高收音画面', title: '吃播ASMR', subtitle: '声音画面一起上' },
  { skillId: 'video.store_tour', template: 'case-3up', accent: 'accent', subject: '从店门口到货架再到重点商品的三帧', title: '探店漫游', subtitle: '推门走一圈' },
  { skillId: 'video.multi_angle_showcase', template: 'case-3up', accent: 'cool', subject: '同一商品正面、侧面与细节的三帧', title: '多角度展示', subtitle: '一次讲完各个面' },
  { skillId: 'video.product_placement', template: 'case-3up', accent: 'warm', subject: '商品被自然放进原片场景的三个关键帧', title: '产品植入', subtitle: '放进已有视频里' },
  { skillId: 'video.scene_edit', template: 'before-after', accent: 'accent', subject: '同一画面修改前后的并排对照（只换指定元素）', title: '画面修改', subtitle: '只改指定的那一处' },
  { skillId: 'video.storyboard_to_video', template: 'case-3up', accent: 'accent', subject: '分镜脚本与对应成片的三帧对照', title: '分镜转视频', subtitle: '按脚本逐格拍' },
  { skillId: 'video.text_consistency', template: 'case-3up', accent: 'warm', subject: '四个款式依次定格、包装文字全程清晰的三帧', title: '文字一致性', subtitle: '包装文字不糊' },
  { skillId: 'video.scene_stitch', template: 'case-3up', accent: 'accent', subject: '首帧主图与左右两个场景无缝拼接的三帧', title: '多场景拼接', subtitle: '一张图带出多个场景' },
  { skillId: 'video.beat_mashup', template: 'case-3up', accent: 'soft', subject: '多张图跟着鼓点依次切换的三个关键帧', title: '卡点混剪', subtitle: '跟着音乐卡点走' },
];

/* 两板块合表：封面产线（scripts/build-skill-covers.mjs）与门禁都读这一份，
   保证「声明里有几条 Skill，磁盘上就有几张封面」。 */
export const ALL_COVER_PLAN = [...IMAGE_COVER_PLAN, ...VIDEO_COVER_PLAN];

export const COVER_ASSET_DIR = 'public/skill-covers';
export const COVER_ROUTE_PREFIX = '/skill-covers';

/* 封面文件名 = cover-<skillId>.svg（例：cover-image.poster.svg，见 45 的归档约定）。
   归一化掉 id 里可能出现的路径分隔符，避免生成物越出资产目录。 */
export function coverFileName(skillId) {
  const key = String(skillId == null ? '' : skillId).trim().replace(/[\\/]+/g, '-');
  return 'cover-' + key + '.svg';
}

export function coverRoute(skillId) {
  return COVER_ROUTE_PREFIX + '/' + coverFileName(skillId);
}

export function getCoverPlan(skillId) {
  const key = String(skillId == null ? '' : skillId).trim();
  return ALL_COVER_PLAN.find(item => item.skillId === key) || null;
}


/* ── 封面素材从哪来：**从 skill 自己的案例（cases）来** ─────────────────────────
   2026-09-16 用户指正：「他们的排版应该是基于里面生成案例去做的封面，不是直接做封面」。
   所以这里不另立一套"封面素材表"——封面必须由该 skill 的 cases 排出来：
     · 推荐位（category = 精品推荐）：封面**不烤字**，纯案例图，标题交给卡片底部的遮罩；
     · 其它专区：封面**烤字，字在上方**（竞品的字都在上面，下面是遮罩标题）。
   这条规则让"封面"与"点进去看到的案例"永远是同一批素材 —— 用户不会被封面骗进去。
   版式（由 cover.template 指定）：
     · case-3up     三张案例错落叠压（成套类：电商套图 / 多角度 / 穿搭套图）
     · hero-single  一张案例为主体（单图类：白底图 / 商品动态 / 模特动态）
     · poster-style 一整幅案例铺满（海报 / 社媒封面 / 节日短片 —— 案例本身就是完整画面）
     · before-after 原图 → 成品（修图 / 复刻 / 试穿，43 §10.4 要求我们这么做） */

/* 每种版式需要几张案例：不够就不能出封面（否则会出现缺角的封面）。 */
export const COVER_LAYOUT_TILES = { 'case-3up': 3, 'before-after': 2, 'hero-single': 1, 'poster-style': 1 };

export function coverLayoutOf(skill) {
  const template = skill && skill.cover ? skill.cover.template : '';
  return COVER_LAYOUT_TILES[template] ? template : 'hero-single';
}

/* 推荐位不烤字：竞品实测如此（推荐板块的封面没有标题文字）。 */
export function coverShowTitle(skill) {
  return (skill && skill.category) !== '精品推荐';
}

/* 封面用的案例图：按版式取前 N 条案例；不足则返回空（由门禁拦下，不许出半张封面）。 */
export function coverTilesFor(skill) {
  const need = COVER_LAYOUT_TILES[coverLayoutOf(skill)] || 1;
  const cases = Array.isArray(skill && skill.cases) ? skill.cases : [];
  const tiles = cases.map(item => item && item.cover).filter(Boolean);
  return tiles.length >= need ? tiles.slice(0, need) : [];
}

/* 出图任务：只认"案例够用"的 skill。 */
export function coverJobsFor(skills) {
  const jobs = [];
  const blocked = [];
  for (const skill of skills || []) {
    const tiles = coverTilesFor(skill);
    if (!tiles.length) { blocked.push({ skillId: skill.id, need: COVER_LAYOUT_TILES[coverLayoutOf(skill)], have: (skill.cases || []).length }); continue; }
    const plan = getCoverPlan(skill.id);
    jobs.push({
      skillId: skill.id,
      layout: coverLayoutOf(skill),
      accent: (plan && plan.accent) || 'neutral',
      title: (plan && plan.title) || skill.name,
      /* 卡片底部遮罩上的副标题（竞品实测：标题下一行小字，一行截断） */
      subtitle: String(skill.summary || '').trim(),
      showTitle: coverShowTitle(skill),
      tiles,
    });
  }
  return { jobs, blocked };
}