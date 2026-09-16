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

/* 图片板块 7 个 Skill 的封面出图清单：照这个表出图即可，标题即卡片上显示的文字。 */
export const IMAGE_COVER_PLAN = [
  { skillId: 'image.free', template: 'hero-single', accent: 'neutral', subject: '一张风格鲜明的 AI 生成插画或摄影作品', title: '自由创作' },
  { skillId: 'image.poster', template: 'poster-style', accent: 'warm', subject: '一张文化活动的商业海报成品', title: '海报设计', subtitle: '版式与文字层级一起给' },
  { skillId: 'image.social_cover', template: 'poster-style', accent: 'accent', subject: '一张公众号或视频号的封面成品', title: '社媒封面', subtitle: '一眼看懂主题' },
  { skillId: 'image.product_suite', template: 'case-3up', accent: 'warm', subject: '同一款商品的三种电商成品图（白底、场景、卖点）', title: '电商套图', subtitle: '白底+场景+卖点成套' },
  { skillId: 'image.white_bg', template: 'hero-single', accent: 'cool', subject: '一件商品的白底主图，多角度呈现细节', title: '白底商品图' },
  { skillId: 'image.try_on', template: 'case-3up', accent: 'soft', subject: '同一位模特穿着商品的三张不同姿势照片', title: '模特试穿', subtitle: '姿势与场景可选' },
  { skillId: 'image.xhs_note', template: 'case-3up', accent: 'soft', subject: '一组小红书风格的种草图（封面 + 两张内页）', title: '小红书图文', subtitle: '真实感优先' },
];
