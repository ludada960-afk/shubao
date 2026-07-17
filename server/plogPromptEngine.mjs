/**
 * 薯包AI · Plog 生活氛围感引擎
 * 与种草工作流完全隔离，独立提示词/镜头/排版/文案体系
 * v2 — 新增5种排版模板 + 4种封面变体 + LLM镜头微调
 */

// ── 风格包 ──
export const PLOG_STYLES = {
  'ins-minimal': {
    name: 'Ins 极简风',
    emoji: '🤍',
    desc: '低饱和·干净通透·大面积留白',
    tone: 'Desaturated (-15%), clean whites, soft natural light, airy feel, minimal editing, low contrast, neutral shadows',
    text: '推荐',
  },
  'korean-clear': {
    name: '韩系清透',
    emoji: '🫧',
    desc: '冷调清透·亮白·水光感',
    tone: 'Cool tone 4800K, bright airy, slight aqua tint, glass skin effect, dewy highlights, pale blue-pink cast',
    text: '适合美妆/日常/穿搭',
  },
  'japanese-cream': {
    name: '日系奶油',
    emoji: '🍦',
    desc: '暖黄调·柔光·奶油质感',
    tone: 'Warm cream tone 5200K, soft glow, slight bloom, milky highlights, gentle warmth, kodak portra feel',
    text: '适合居家/书桌/咖啡',
  },
  'film-vintage': {
    name: '胶片复古',
    emoji: '🎞️',
    desc: '褪色·颗粒感·暖橙调',
    tone: 'Film grain subtle, faded colors (-20%), slight vignette, warm orange tint, analog look, light leaks subtle',
    text: '适合旅行/街拍/日落',
  },
};

// ── 排版模板 ──
export const LAYOUT_TEMPLATES = {
  'casual': {
    name: '碎片风',
    emoji: '📸',
    desc: '随意随手拍·白边·轻微旋转',
    coverRule: 'photo collage style (2-3 images arranged), large centered title in handwritten Chinese font, polaroid-style white borders around photos, stickers decorative. NO English title.',
    contentRule: 'Single photo with thin white border (polaroid style), generous negative space (40% empty area), handwritten-style Chinese text annotation in bottom or side margin. Warm casual feel. NO grid. NO bullet points. NO numbered lists.',
    tag: '经典',
  },
  'polaroid': {
    name: '拍立得风',
    emoji: '📷',
    desc: '宝丽来白边·手写标签·微微褪色',
    coverRule: '3 polaroid photos taped on a cream paper background, each with white frame and handwritten Chinese labels below. Stickers and washi tape deco. Casual collage feel. Retro warm tone.',
    contentRule: 'Polaroid-style photo. Wide white bottom border (1/4 of image height). Handwritten Chinese text directly on the white border. Faded warm color, slight vignette. Authentic instant camera film look. Matte finish.',
    tag: '🔥热门',
  },
  'cinematic': {
    name: '电影感',
    emoji: '🎬',
    desc: '宽幅裁剪·字幕条·故事板',
    coverRule: 'Cinematic wide landscape scene (2.35:1 aspect) with black letterbox bars top and bottom. White subtitle text at bottom bar, like film subtitles. Moody atmospheric lighting. Film grain subtle.',
    contentRule: 'Cinematic composition. 2.35:1 letterbox framing with black bars. Subtle film grain. Each image tells one story beat — wide establishing shot, medium, or close-up. Movie still aesthetic. Consistent LUT color grade throughout set.',
    tag: '🔥热门',
  },
  'journal': {
    name: '手账风',
    emoji: '📔',
    desc: '纸张纹理·贴纸·虚线·便签',
    coverRule: 'Scrapbook journal cover. Paper texture background. Hand-drawn decorative border. Washi tape holding photos. Doodles, stickers, and date stamp. Collage of 2-3 elements. Creamy paper tones.',
    contentRule: 'Scrapbook journal page. Cream paper texture background. Photo with torn or deckled edges, not straight cut. Hand-drawn arrows and circles overlaying photo. Small sticker or stamp deco. Dotted line divider. Washi tape accent. No product, no ad. Cozy analog journaling aesthetic.',
    tag: '',
  },
  'magazine': {
    name: '杂志风',
    emoji: '✨',
    desc: '极简留白·大标题·高级感',
    coverRule: 'Minimalist editorial cover. Very large Chinese title taking 40% of space. One small elegant photo in bottom half or corner. Generous white space (60%). Thin sans-serif elegant text. No clutter. High-end lifestyle magazine feel.',
    contentRule: 'Editorial photography style. One single subject per page. 60% negative space. Minimal composition. Clean lines, no clutter. One small Chinese text label in corner. Magazine-standard photography: sharp, well-composed, intentional. NO decorative elements. NO stickers. Pure sophisticated minimalism.',
    tag: '',
  },
};

// ── 封面变体 ──
export const COVER_VARIANTS = {
  'collage': { name: '拼贴封面', desc: '多图拼贴+大标题', icon: '🖼️' },
  'big-text': { name: '大字封面', desc: '纯色底+大字号标题', icon: '🔤' },
  'full-image': { name: '全图封面', desc: '单张大图+标题叠加', icon: '🌅' },
  'polaroid-cover': { name: '拍立得封面', desc: '单张拍立得+手写标题', icon: '📸' },
};

// ── Plog 专属赛道（仅生活记录类） ──
export const PLOG_CATEGORIES = [
  '居家日常', '晨间生活', '城市漫游', '旅行碎片',
  '美食日常', '通勤碎片', '书桌氛围感', '日落夜景', '宠物日常',
  '咖啡下午茶', '周末碎片', '独居日记',
];

// ── 预定义镜头库（结构化可扩展） ──
// 每个场景对应 8-10 个碎片化镜头，避免 LLM 随机发挥产生重复/商业化内容
export const SCENE_LENSES = {
  '居家日常': [
    { en: 'A cozy corner of a sofa with warm afternoon light casting soft shadows on a knitted throw blanket. First-person perspective of lounging at home.', zh: '沙发角落+午后光影' },
    { en: 'A ceramic coffee mug close-up on a wooden side table, shallow depth of field, rim light from window.', zh: '咖啡杯+木桌特写' },
    { en: 'Close-up of a houseplant leaf with water droplets, soft natural light filtering through sheer curtains.', zh: '绿植叶片+水珠' },
    { en: 'A cluttered desk corner — an open magazine, a lit candle, scattered pens, warm lamp glow.', zh: '书桌碎片+台灯暖光' },
    { en: 'View from a window — tree branches outside, soft overcast sky, window frame in foreground.', zh: '窗外风景+窗框前景' },
    { en: 'Texture of a knitted blanket or throw pillow, macro shot showing fabric weaves, soft focus.', zh: '织物纹理特写' },
    { en: 'A mirror reflection showing a corner of the room, slightly tilted frame, candid feel.', zh: '镜子反光+房间一角' },
    { en: 'A warm lamp or candle against a dark wall, bokeh lights in background.', zh: '暖光/烛光+虚化背景' },
    { en: 'Feet on a rug, bottom-up perspective, casual slippers, natural floor lighting.', zh: '地面视角+慵懒感' },
  ],
  '晨间生活': [
    { en: 'Sunlight streaming through a window onto a bed sheet, warm golden hour light.', zh: '晨光洒在床单上' },
    { en: 'A breakfast table setting — a croissant, coffee, fresh fruit, morning newspaper.', zh: '早餐桌+面包咖啡' },
    { en: 'A toothbrush and skincare products neatly arranged on a marble bathroom counter.', zh: '洗漱台+护肤品排列' },
    { en: 'Steam rising from a hot cup of tea or coffee, backlit by morning sun.', zh: '热饮蒸气+逆光' },
    { en: 'An open window with breeze moving sheer curtains, soft motion blur.', zh: '窗帘飘动+微风感' },
    { en: 'Close-up of fresh flowers in a simple vase, soft morning light.', zh: '晨花+清新色调' },
    { en: 'A person holding a warm mug, hands wrapped around it, cozy sweater sleeve visible.', zh: '捧杯的手+毛衣袖口' },
    { en: 'Alarm clock on a nightstand showing early morning time, soft blur background.', zh: '床头闹钟+晨间时间' },
    { en: 'A journal or notebook open on a bed, pen resting on pages, gentle morning light.', zh: '晨间日记+翻开的本子' },
  ],
  '咖啡下午茶': [
    { en: 'Close-up of latte art on a small table, steam wisps visible, warm cafe lighting.', zh: '咖啡拉花+蒸汽特写' },
    { en: 'A slice of cake or pastry on a ceramic plate, side angle, soft natural light.', zh: '蛋糕甜点侧面' },
    { en: 'Window seat with dappled light falling on a wooden table surface, salt and pepper shakers.', zh: '窗边光影+桌面细节' },
    { en: 'A hand holding a coffee cup, first-person perspective, outside cafe visible in background.', zh: '手持咖啡杯(第一视角)' },
    { en: 'Cafe interior — empty chairs, warm pendant lights, cozy atmosphere, candid shot.', zh: '咖啡馆环境空镜' },
    { en: 'A menu board or chalkboard with handwritten specials, blurred background.', zh: '菜单黑板+虚化背景' },
    { en: 'Coffee beans scattered on a wooden surface, macro, deep brown tones.', zh: '咖啡豆散落+棕色系' },
    { en: 'Checkered tablecloth texture, a teaspoon resting on it, soft overhead light.', zh: '格纹桌布+茶匙' },
    { en: 'A small vase with a single flower on a cafe table, window reflection visible.', zh: '桌上小花+窗影反射' },
  ],
  '城市漫游': [
    { en: 'Looking up at buildings — sky visible between tall structures, dramatic perspective.', zh: '抬头看建筑+天空缝隙' },
    { en: 'A street sign or shop sign against a pastel-colored wall, typography focus.', zh: '路牌/店招+彩色墙面' },
    { en: 'A cobblestone or brick street with fallen leaves, shallow depth of field.', zh: '石板路+落叶' },
    { en: 'A bicycle parked against a fence or wall, morning or evening light.', zh: '街边自行车+光影' },
    { en: 'A street vendor or food stall from a distance, blurred motion of passersby.', zh: '街边小摊(远距离)' },
    { en: 'Reflection of buildings in a puddle or window glass.', zh: '建筑倒影+水面/玻璃' },
    { en: 'A person walking away, candid back shot, street in soft focus.', zh: '行人背影+街道虚化' },
    { en: 'Traffic light or street lamp against a pastel evening sky.', zh: '红绿灯/路灯+暮色天空' },
    { en: 'A cat or dog sitting on a street corner, caught in natural light.', zh: '街角小动物+自然光' },
  ],
  '旅行碎片': [
    { en: 'A suitcase or bag on a hotel bed, travel documents scattered, natural window light.', zh: '行李箱+酒店房间' },
    { en: 'A passport, ticket, or map spread on a table, travel memorabilia.', zh: '护照/票根+旅行记忆' },
    { en: 'A train or airplane window view — clouds, landscape, or passing scenery.', zh: '车窗/飞机窗+窗外风景' },
    { en: 'Local street food close-up — authentic, not styled, natural market lighting.', zh: '当地小吃特写(不摆盘)' },
    { en: 'An architectural detail — corner of a building, colorful tiles, unique doors.', zh: '建筑细节+彩窗/门' },
    { en: 'A harbor, coastline, or mountain view from a viewpoint, natural haze.', zh: '海港/山景(从高处)' },
    { en: 'Museum or gallery interior — a painting, glass case, or hallway, one visitor.', zh: '博物馆/美术馆一角' },
    { en: 'A hand holding a camera or phone taking a picture, first-person POV.', zh: '手持相机/手机拍照' },
    { en: 'Night market scene — string lights, blur of people, warm glow.', zh: '夜市灯光+人流虚化' },
  ],
  '美食日常': [
    { en: 'A steaming bowl of noodles or soup, chopsticks resting on rim, top-down angle.', zh: '热汤面+俯拍' },
    { en: 'A colorful salad or fruit bowl with vibrant natural ingredients, side lighting.', zh: '沙拉/水果碗+侧光' },
    { en: 'Hands preparing ingredients — cutting vegetables, flour dust, rustic kitchen.', zh: '备菜的手+食材散落' },
    { en: 'A cooking pan with sizzling food, steam rising, action shot.', zh: '锅里滋滋响+热气' },
    { en: 'An open cookbook on a kitchen counter, worn pages, recipe notes.', zh: '翻开的菜谱+便签条' },
    { en: 'A small dining table set for one — placemat, chopsticks, simple meal.', zh: '一人食餐桌+简餐' },
    { en: 'A glass of water or drink with condensation droplets, fresh mint garnish.', zh: '冰饮杯+水珠特写' },
    { en: 'Kitchen window with herbs on the sill, soft morning light.', zh: '厨房窗台+窗边香草' },
    { en: 'A wooden cutting board with bread crumbs and a butter knife, rustic.', zh: '面包板+面包屑+黄油刀' },
  ],
  '通勤碎片': [
    { en: 'A crowded subway car or bus interior, warm interior lights, candid.', zh: '地铁/公交车厢内' },
    { en: 'A hand holding a metro card or phone with transit app, first-person.', zh: '刷卡的手/手机屏' },
    { en: 'A pair of shoes (sneakers or loafers) on a moving escalator step.', zh: '扶梯上的鞋子' },
    { en: 'A coffee cup in a cup holder on a train window ledge, passing landscape.', zh: '窗边咖啡+流动风景' },
    { en: 'A street intersection during rush hour — blurred cars, red taillights.', zh: '十字路口+车流虚化' },
    { en: 'An umbrella or raincoat on a rainy morning, wet pavement reflections.', zh: '雨伞/雨衣+湿路面' },
    { en: 'Earbuds or headphones on a seat, train station platform behind.', zh: '座位上的耳机+月台背景' },
    { en: 'A commuter reading a book or phone on public transit, portrait crop.', zh: '通勤读书/刷手机的人' },
    { en: 'A paper or digital transit pass close-up, blurred background of a station.', zh: '交通卡+站台虚化' },
  ],
  '书桌氛围感': [
    { en: 'A desk lamp shining on an open notebook, warm light pool, late night.', zh: '台灯下+摊开的笔记本' },
    { en: 'A fountain pen or pencil resting on handwritten notes, macro.', zh: '钢笔/铅笔+手写笔记' },
    { en: 'A stack of books with colorful spines, soft side light, shallow DOF.', zh: '书堆+彩色书脊' },
    { en: 'A cup of tea next to a laptop, steam rising, warm cozy vibe.', zh: '茶杯+笔记本电脑' },
    { en: 'Sticky notes or Polaroid photos pinned on a cork board, string lights.', zh: '便签墙+软木板+串灯' },
    { en: 'A cat sleeping on a desk, papers scattered around it, cute chaos.', zh: '桌上睡着的猫+纸片' },
    { en: 'A wristwatch or analog clock on a desk, soft focus on time.', zh: '手表+桌面时钟' },
    { en: 'A plant and a small speaker on a desk corner, aesthetic arrangement.', zh: '桌角绿植+音箱' },
    { en: 'A person typing on a laptop, hands on keyboard, screen glow on fingers.', zh: '打字的手+键盘+屏幕光' },
  ],
  '日落夜景': [
    { en: 'A sunset sky through a window or from a balcony, gradient pink-orange-purple.', zh: '窗外日落+渐变色天空' },
    { en: 'City skyline at twilight, warm building lights against blue hour sky.', zh: '城市天际线+蓝调时刻' },
    { en: 'String lights or lanterns in an outdoor setting, bokeh in foreground.', zh: '串灯/灯笼+光斑虚化' },
    { en: 'A silhouette of a person or tree against a colorful sunset sky.', zh: '夕阳下的剪影' },
    { en: 'A glass of wine or drink in dim evening light, candle nearby.', zh: '酒杯+烛光+暗调' },
    { en: 'Car taillight trails on a road at night, long exposure effect.', zh: '车流尾灯+长曝光' },
    { en: 'Moon and stars visible in a clear night sky, tree branch silhouette.', zh: '月亮+星空+树枝剪影' },
    { en: 'Neon sign or storefront light reflecting on a wet street.', zh: '霓虹灯+湿路面倒影' },
    { en: 'A balcony or rooftop at night with a city view, warm blanket visible.', zh: '阳台夜景+毛毯一角' },
  ],
  '宠物日常': [
    { en: 'A cat or dog sleeping curled up, soft fur texture, warm light.', zh: '宠物蜷睡+毛发质感' },
    { en: 'Pet paw on a blanket or floor, macro, soft focus background.', zh: '宠物爪爪+微距' },
    { en: 'A pet looking out a window, back view, silhouetted against light.', zh: '宠物看窗外+逆光剪影' },
    { en: 'Pet toys scattered on the floor, playful mess, natural home light.', zh: '宠物玩具散落+居家感' },
    { en: 'A pet eating from a bowl, top-down view, cute eating posture.', zh: '宠物吃饭+俯拍' },
    { en: 'A pet on a sofa or bed blending into cushions, cozy.', zh: '宠物窝沙发/床+融化感' },
    { en: 'Close-up of pet nose or eyes, extreme macro, intimate.', zh: '宠物鼻子/眼睛微距' },
    { en: 'A pet with owner hands visible — petting or holding, soft bonding moment.', zh: '宠物+主人的手(互动)' },
    { en: 'Pet silhouette against a sunset or window light, dramatic lighting.', zh: '宠物剪影+夕阳逆光' },
  ],
};

// 默认镜头（当场景无法分类时使用）
const DEFAULT_LENSES = SCENE_LENSES['居家日常'];

// ── 默认色调（无参考图时使用） ──
const DEFAULT_TONE = {
  dominantHex: '#F5E6D0',
  saturation: 0.35,
  temperature: 5200,
  description: 'Warm cream tone, soft natural light, slightly desaturated, gentle warmth',
  rgb: { r: 245, g: 230, b: 208 },
};

// ── 场景分类 ──
const SCENE_KEYWORDS = {
  '居家日常': /居家|宅家|客厅|房间|沙发|周末在家|独居|房间布置|出租屋/i,
  '晨间生活': /晨间|早晨|早安|起床|早餐|morning|早起/i,
  '城市漫游': /城市|漫游|街头|探店|压马路|步行|逛街|citywalk|扫街|街头摄影/i,
  '旅行碎片': /旅行|旅游|旅行碎片|旅途|机场|高铁|自驾|度假|酒店|民宿|游记/i,
  '咖啡下午茶': /咖啡|下午茶|探店|cafe|咖啡馆|咖啡店|面包|甜品|蛋糕|拿铁|brunch/i,
  '美食日常': /美食|做饭|下厨|家常菜|食谱|一人食|便当|晚餐|午餐|吃饭|自己做饭/i,
  '通勤碎片': /通勤|上班|下班|地铁|公交|打工人|路上|早高峰|晚高峰/i,
  '书桌氛围感': /书桌|学习|工作|办公|阅读|看书|笔记|写东西|作业|考研|study/i,
  '日落夜景': /日落|黄昏|夜景|傍晚|晚霞|夕阳|夜幕|蓝调|霓虹|夜晚/i,
  '宠物日常': /猫|狗|宠物|猫咪|狗狗|撸猫|遛狗|主子|毛孩子|喵|汪/i,
};

/**
 * 分类 Plog 场景
 */
export function classifyScene(text) {
  for (const [category, regex] of Object.entries(SCENE_KEYWORDS)) {
    if (regex.test(text)) return category;
  }
  // 兜底：如果包含食物关键词
  if (/吃|喝|饮|食|餐|味|甜|香|菜/.test(text)) return '美食日常';
  // 兜底：如果包含地点关键词
  if (/街|路|门|号|店|馆|园|场|站/.test(text)) return '城市漫游';
  return '居家日常'; // 默认
}

/**
 * 获取场景镜头（可被 LLM 微调）
 */
export function getLensesForScene(scene, count = 9) {
  const lenses = SCENE_LENSES[scene] || DEFAULT_LENSES;
  // 如果镜头数不足，循环补齐
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(lenses[i % lenses.length]);
  }
  return result.slice(0, count);
}

// ── 色值工具 ──

/** 色相到RGB（用于从色相环生成近似色） */
function hslToRgb(h, s, l) {
  h /= 360;
  s /= 100;
  l /= 100;
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : { r: 245, g: 230, b: 208 };
}

/**
 * 从参考图提取色调信息
 */
export async function extractToneFromImage(base64Image, callMiniLLM) {
  if (!base64Image) return { ...DEFAULT_TONE };
  try {
    const systemPrompt = `你是一个专业摄影色调分析师。分析这张图片的色调特征，只输出JSON。`;
    const userPrompt = `分析这张图片的色调特征，严格按照以下JSON格式输出（不要多余文字）：
{
  "dominantHex": "主色值(HEX)",
  "saturation": "饱和度(0-1的小数)",
  "temperature": "色温(K值，2500-7500)",
  "description": "25字以内色调简要描述，例如"暖黄调低饱和柔光"",
  "rgb": [R,G,B]
}`;
    const raw = await callMiniLLM(systemPrompt, base64Image, userPrompt);
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      const parsed = JSON.parse(m[0]);
      const rgb = parsed.rgb || (parsed.dominantHex ? hexToRgb(parsed.dominantHex) : null);
      return {
        dominantHex: parsed.dominantHex || DEFAULT_TONE.dominantHex,
        saturation: typeof parsed.saturation === 'number' ? parsed.saturation : DEFAULT_TONE.saturation,
        temperature: typeof parsed.temperature === 'number' ? parsed.temperature : DEFAULT_TONE.temperature,
        description: parsed.description || DEFAULT_TONE.description,
        rgb: rgb ? { r: rgb[0] || rgb.r, g: rgb[1] || rgb.g, b: rgb[2] || rgb.b } : DEFAULT_TONE.rgb,
      };
    }
  } catch (e) {
    console.error('[plog-tone] 色调分析失败:', e.message);
  }
  return { ...DEFAULT_TONE };
}

/**
 * 生成色调基准图的 SVG 内容（转 base64 后用 image 参数传入）
 * 使用 gradient + solid 色块来引导模型色调
 */
export function buildToneCard(toneInfo) {
  const { rgb, saturation, temperature } = toneInfo;
  const { r, g, b } = rgb;
  // 根据色温调整冷暖偏移
  const warmth = temperature > 5000 ? 'rgba(255,200,150,0.15)' : 'rgba(200,220,255,0.10)';
  const satAdjust = Math.max(0.3, saturation);
  const centerR = Math.round(r * (1 - satAdjust) + 245 * satAdjust);
  const centerG = Math.round(g * (1 - satAdjust) + 235 * satAdjust);
  const centerB = Math.round(b * (1 - satAdjust) + 220 * satAdjust);
  const centerHex = rgbToHex(centerR, centerG, centerB);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <defs>
    <radialGradient id="g" cx="50%" cy="45%" r="70%">
      <stop offset="0%" stop-color="${centerHex}"/>
      <stop offset="60%" stop-color="${rgbToHex(r, g, b)}"/>
      <stop offset="100%" stop-color="${rgbToHex(
        Math.max(0, r - 40), Math.max(0, g - 40), Math.max(0, b - 40)
      )}"/>
    </radialGradient>
    <filter id="noise">
      <feTurbulence type="fractalNoise" baseFrequency="1.5" numOctaves="3" result="noise"/>
      <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise"/>
      <feBlend in="SourceGraphic" in2="grayNoise" mode="multiply"/>
    </filter>
  </defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <rect width="512" height="512" fill="${warmth}"/>
</svg>`;
}

// ── 封面变体 prompt 规则 ──
function getCoverPromptRule(coverVariant, layoutDef) {
  const baseRule = layoutDef.coverRule;
  switch (coverVariant) {
    case 'big-text':
      return 'Minimalist cover with solid color background (using tone color). Very large handwritten Chinese title (80px) centered, occupying 60% of image. One small polaroid photo pinned at bottom-right corner. Clean, bold, editorial. No English.';
    case 'full-image':
      return 'Full-bleed single photo covering entire image. Semi-transparent gradient overlay at bottom half. Chinese title overlaid in white, large serif font. Film-style letterbox bars top and bottom. Moody, atmospheric.';
    case 'polaroid-cover':
      return 'Single polaroid-style photo centered on a warm cream paper background. Wide white bottom border. Handwritten Chinese title directly on the white border in marker pen. Polaroid frame shadow. Retro instant camera aesthetic.';
    default:
      return baseRule;
  }
}

/**
 * 构建 Plog 单张图片的 GPT-Image-2 提示词
 */
export function buildPlogPrompt({ lens, style, toneInfo, isCover, index, totalCount, category, layout, coverVariant }) {
  const styleDef = PLOG_STYLES[style] || PLOG_STYLES['ins-minimal'];
  const layoutDef = LAYOUT_TEMPLATES[layout] || LAYOUT_TEMPLATES['casual'];
  const toneDesc = toneInfo?.description || DEFAULT_TONE.description;

  // 基础前缀：Plog 风格，绝不出种草/产品图
  const basePrefix = 'Lifestyle photography, casual snapshot aesthetic, Xiaohongshu Plog style. ' +
    'NO product showcase. NO commercial advertising. NO beauty测评. NO fashion种草. ' +
    'NO price tags. NO ingredient list. NO ratings. ' +
    'Real life candid moment. ';

  // 色调控制（带 layout 差异化）
  const toneIntensity = layout === 'cinematic' ? 'enhanced contrast, moody shadows, ' :
    layout === 'polaroid' ? 'faded warm (-10% saturation), matte finish, ' :
    'average saturation, natural color rendition, ';
  const toneSegment = toneDesc + ', ' + toneIntensity + 'natural lighting. ';

  // 排版规则
  const layoutRule = isCover
    ? getCoverPromptRule(coverVariant, layoutDef)
    : layoutDef.contentRule;

  // 实际镜头描述
  const lensDesc = lens?.en || lens?.zh || 'Aesthetic everyday moment, natural lighting';

  // 完整提示
  if (isCover) {
    return `${basePrefix}${toneSegment}${styleDef.tone}. ${layoutRule} ${lensDesc}`;
  }
  return `${basePrefix}${toneSegment}${styleDef.tone}. ${lensDesc}. ${layoutRule}`;
}

/**
 * LLM 微调镜头描述——让预定义镜头更贴合用户输入的具体场景
 * 保持镜头结构但丰富细节，避免 LLM 从头生成导致重复/商品化
 */
export async function enrichLensesWithLLM(lenses, userText, scene, callLLM) {
  if (!userText) return lenses;
  try {
    const lensZhList = lenses.map((l, i) => `${i + 1}. ${l.zh}`).join('\n');
    const prompt = `用户输入: "${userText}"（场景: ${scene}）
预定义镜头列表：
${lensZhList}
任务：为每个镜头增加 2-3 个画面细节词，保持镜头本质不变，让内容更贴合用户场景。
格式：按顺序输出数字+描述，例如：
1. 沙发角落+午后光影+猫咪蜷睡+咖啡杯
2. 咖啡杯+木桌特写+窗边+蒸汽
只输出修改后的列表，不要输出其他文字。`;
    const raw = await callLLM('你是小红书 Plog 镜头设计师，只输出镜头列表。', prompt, { temperature: 0.5, maxTokens: 1000 });
    const lines = raw.trim().split('\n').filter(l => /^\d+[\.\、]/.test(l.trim()));
    if (lines.length >= 3) {
      return lenses.map((lens, i) => {
        const enriched = lines.find(l => l.trim().startsWith(String(i + 1) + '.') || l.trim().startsWith(String(i + 1) + '、'));
        if (enriched) {
          const detail = enriched.replace(/^\d+[\.\、]\s*/, '').trim();
          return {
            zh: detail,
            en: lens.en + ', ' + detail.replace(/[+＋]/g, ', '),
          };
        }
        return lens;
      });
    }
  } catch (e) {
    console.error('[plog-enrich] 镜头微调失败:', e.message);
  }
  return lenses;
}

/**
 * 生成 Plog 配套情绪文案
 */
export function generatePlogCopy(category, lenses, toneInfo) {
  const copyTemplates = {
    '居家日常': ['宅家的日子，舒服就好。', '阳光和猫，就是最好的周末。', '什么都不做，也是一种充电。'],
    '晨间生活': ['早安，今天也是被阳光叫醒的一天。', '慢慢吃早餐，慢慢生活。', '清晨的光，总是格外温柔。'],
    '咖啡下午茶': ['一杯咖啡，一段安静时光。', '偷得浮生半日闲。', '咖啡香是城市的香水。'],
    '城市漫游': ['在熟悉的城市里迷路。', '每条街都有它的故事。', '走走停停，用腳步丈量城市。'],
    '旅行碎片': ['把沿途的风景，装进口袋里。', '旅途中最美的不是风景，是心情。', '收集每一个城市的黄昏。'],
    '美食日常': ['好好吃饭，是对生活最大的尊重。', '食物是最好的治愈。', '自己做的饭，最香。'],
    '通勤碎片': ['每天的路，都是新的风景。', '通勤路上，耳机是世界的开关。', '繁忙的城市，也在认真生活。'],
    '书桌氛围感': ['书桌是另一个世界。', '灯光下的书页，是最安心的陪伴。', '学习到深夜，月亮陪你。'],
    '日落夜景': ['日落的颜色，今天也很努力。', '夜晚的城市，有另一种美。', '月亮是今晚的灯。'],
    '宠物日常': ['毛孩子的日常，就是我的日常。', '有猫有狗，人生赢家。', '今天也是被小猫咪治愈的一天。'],
  };

  const temps = copyTemplates[category] || copyTemplates['居家日常'];

  // 为每张图分配文案（可循环）
  return lenses.map((_, i) => temps[i % temps.length]);
}

/**
 * 生成 Plog 整体 caption
 */
export function generatePlogCaption(category, scene, style) {
  const styleName = PLOG_STYLES[style]?.name || '日常';
  const captions = {
    '居家日常': '宅家碎片 ｜ 普通日子里的光 🏠',
    '晨间生活': '早 ｜ 一日之计在于晨 🌤️',
    '咖啡下午茶': '下午三点 ｜ 咖啡和时间都刚好 ☕',
    '城市漫游': 'Citywalk ｜ 城市漫游日记 🚶',
    '旅行碎片': '旅行碎片 ｜ 把风景装进口袋 ✈️',
    '美食日常': '好好吃饭 ｜ 食物是最好的治愈 🍳',
    '通勤碎片': '通勤路上 ｜ 碎片时间里的风景 🚇',
    '书桌氛围感': '书桌一角 ｜ 灯光下的世界 📖',
    '日落夜景': '日落收集者 ｜ 今天的颜色也很努力 🌅',
    '宠物日常': '猫狗日记 ｜ 毛孩子统治世界 🐱',
  };
  return captions[category] || `生活碎片 ｜ ${styleName}日常 ✨`;
}
