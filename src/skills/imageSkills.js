/* ═══ 图片板块的 Skill 声明（单一事实源）═══════════════════════════════════════
   依据 docs/design/43-media-architecture.md §5 与 docs/design/44-p1c-image-hub-brief.md；
   能力盘参照竞品目录接口（2026-09-16 实访，104 个应用 / 8 个分组）——**参照结构，不抄表达**。

   ⚠️ 2026-09-19 批 R：**模型选择**这一格现在真的接上了（用户第 21 轮原话：
      「模型选择不用纠结啊，他们子页面的模型不也是首页的模型吗，直接引用就好了呀」）。
      仍照知渔的页面范围给 —— 他们的工作台里只有 3 页有「模型选择」：
        · 图片复刻（?tool=image-clone，select 一档「智能图片image」）
        · AI换装（?tool=ai-outfit，同上）
        · 即梦seedream5.0pro（app 页，radio 一档）—— 这个应用我们没有对应技能
      其余 101 个应用页**根本没有这一格**（证据：quantv-image-workbenches.json 逐字段）。
      所以不给全站每页都塞一个模型下拉 —— 那是我们自己的长相，不是他们的。
      选项目录引用 services/imageModelCatalog.js 那一份（首页同一个目录），不另立一份。
   ⚠️ availability 如实标注：'ready' = 现有链路已验证；'needs_ref' = 依赖参考图/图生图
      （链路已声明支持、尚未实测出片）。不许把没验证的写成能用。
   ⚠️ brief 是这个 skill 的**提示词模板**：{{字段key}} 会被工作台填进去。
      新增 skill 仍然只需要加一条声明，不写页面、不写控件。 */

import { SELECTABLE_IMAGE_MODELS, imageModelResolutions, DEFAULT_IMAGE_MODEL as CATALOG_DEFAULT_IMAGE_MODEL } from '../services/imageModelCatalog.js';
import { ADAPTIVE_RATIO, LAYOUT_FAMILY_NONE } from './skillRun.js';

export const SKILL_COMPLEXITIES = ['simple', 'standard', 'heavy'];
/* counts：一组「类型 × 张数」的步进器（2026-09-19 用户批注 #13）。
   竞品套图工作台选中「自定义配置」后展开的那组配置就是这个档位 ——
   它不是"另一个 stepper"，因为它一次渲染多行、并且自带一行合计。 */
/* cards = 整幅选项卡（知渔「套图结构配置」那两张 437x82 的卡，批 Q 新增）——
   与 segmented 的区别：说明写在卡里、整幅宽度、右上角一个 ✓。 */
/* 'config' = 2026-09-29 批 DC 续-8 新增：把一组生成设置收成**两颗触发器**（模型 / 画面规格）。
   它不是"又一种控件"，而是**把已有的几格收进一个浮层** —— 面板里那几格仍由 FieldRenderer 渲染
   原来的声明，所以药丸外观、折叠、必填标记、禁用逻辑一个字都没变。 */
export const FIELD_KINDS = ['select', 'segmented', 'cards', 'stepper', 'textarea', 'text', 'slot', 'upload', 'counts', 'config'];

/* ═══ 2026-09-19 批 R：「模型选择」的**唯一一份选项来源** ═══════════════════════════════════
   目录在 services/imageModelCatalog.js（首页的模型挑选器读的也是它）——
   这里只做两件事：把目录摊成 options、把「哪些模型不支持 4K」摊成 optionsFrom 的映射表。
   两张表**都是从目录算出来的**，不手写：目录里改了档位/上限，界面跟着变。 */
const MODEL_OPTIONS = SELECTABLE_IMAGE_MODELS.map(model => ({ value: model.id, label: model.label }));
/* 默认档 = **目录里声明的默认**（2026-09-30 起是 GPT Image 2.5 Sunburst）。
   ⚠️ 原来是 `SELECTABLE_IMAGE_MODELS[0].id`，也就是「**目录里排第一的那一档**」——
     把「默认是谁」和「菜单里谁排第一」这两件事**绑在了一起**：以后有人为了排序
     动了目录第一项，默认档就跟着静默变了。
   ⇒ 改成直接取 `DEFAULT_IMAGE_MODEL`，两者解耦；门禁
     test/image-model-selection-0921.test.mjs ② 也从「目录第一项 === 默认」改成
     「声明的默认 === skillRun.DEFAULT_IMAGE_MODEL」。 */
const DEFAULT_MODEL_ID = CATALOG_DEFAULT_IMAGE_MODEL;
/* 只收「档位不全」的模型（目前只有 Midjourney：上游只有 1K/2K）。
   全支持 1K/2K/4K 的模型不进表 —— 没限制就不写限制，免得将来目录改了三处对不上。 */
const MODEL_RESOLUTION_LIMITS = Object.fromEntries(
  SELECTABLE_IMAGE_MODELS
    .map(model => [model.id, imageModelResolutions(model.id)])
    .filter(entry => entry[1].length < 3),
);

/** 模型选择：**选项来自目录，价格来自目录**（换模型 → CTA 上的积分跟着变，
 *  因为 skillPointsEstimate 走的就是同一个 settings.imageModel）。 */
/* ═══ 2026-09-28 批 DC 续-7：加 `variant: 'model'`（用户批注图1-①）════════════════════════
   用户原话：「模型选择这个**你为什么不用其他地方那个选模型的样式呀**，你又自己发明了一个。」
   根因：FieldRenderer 的 `select` 分支渲染的是**原生 <select>**（无 logo、无描述、无选中勾），
   而首页与六个面板的模型挑选器是 `.sb-opt` 行（带 ModelLogo、badge、描述、勾）。
   ⇒ 声明侧只加一个 `variant` 标记，FieldRenderer 见到它就渲染成同一套 `.sb-opt` 行
     （ModelOptionRows 是**共用组件**，首页那边也换成它了）—— 全站只有一份实现。
   ⚠️ `kind` 仍然是 'select'：门禁 test/concept-set-workbench-0925 的 ⑧ 硬断言了这一条，
      改 kind 等于改测试口径，用户没让改口径。 */
const modelField = () => ({
  key: 'imageModel', label: '模型选择', kind: 'select', group: '生成设置',
  variant: 'model',
  options: MODEL_OPTIONS, default: DEFAULT_MODEL_ID, required: true,
  hint: '不同模型的画质取向与积分单价不同，选完后按钮上的积分会跟着变',
});
export const IMAGE_PIPELINES = [
  'visualCreation',   // 自由创作/海报/封面的既有链路（含参考图，单图同步）
  'ecommerceSuite',   // 电商套图（多分钟、多资产、带方案确认的既有流水线）
  'builtinSkill',     // 现有内置任务技能的画法（白底 / 试穿 / 场景 / 材质 / 多角度）
  'xhsNote',          // 小红书种草图文（既有 SSE 链路）
];

/* 共用档位：同一批选项只有一份定义（页面里不许再写第二份）。
   注意：只有 ratio / clarity 的 value 是机器可读的（要直接下发给引擎），
   其余选项的 value 就是中文本身 —— 它们只被填进提示词，不参与协议。 */
/* ═══ 2026-09-19 批 O-⑦：比例照知渔收成 **7 档**（含 2:3 / 3:2）═════════════════════════
   知渔的 ratio 字段原文（`inputConfigs` 逐字，docs/design/data/quantv-image-key-specs.json）：
     1:1方图 | 2:3竖版长图 | 3:2横版摄影 | 3:4竖版海报 | 4:3横版主图 | 9:16手机竖屏 | 16:9手机横屏
   顺序也照他们（1:1 → 2:3 → 3:2 → 3:4 → 4:3 → 9:16 → 16:9）。
   副说明本身有信息：「竖版海报 / 横版主图 / 手机竖屏」告诉用户这一档是给什么场景用的。
   ⚠️ 加档位**必须与引擎同时加**：服务端 LEGAL_IMAGE_SIZES 是权威，而
      "界面能给的恰好就是引擎认得的那几个"（src/services/imageSizeCatalog.js 第 9 行）——
      只改界面 = 用户选了被**静默回落成 1:1**（不报错、不提示）。
      本批已同步改：引擎尺寸表 + 客户端镜像 + skillRun.LEGAL_RATIOS + 尺寸门禁（4 处）。
      计费不用改：ecommerceBilling 的 SIZE_TO_RESOLUTION 就是遍历引擎那张表建的。 */
const RATIO = [
  { value: '1:1', label: '1:1 方图' },
  { value: '2:3', label: '2:3 竖版长图' },
  { value: '3:2', label: '3:2 横版摄影' },
  { value: '3:4', label: '3:4 竖版海报' },
  { value: '4:3', label: '4:3 横版主图' },
  { value: '9:16', label: '9:16 手机竖屏' },
  { value: '16:9', label: '16:9 手机横屏' },
];
/* ═══ 2026-09-19 批 P：分辨率/清晰度的**档位与写法逐页照知渔**══════════════════════════
   依据：docs/design/data/quantv-image-pages.json（34 个对照页 CDP 实采）+ catalog.json 的 inputConfigs。
   实测这**不是一套**档位，各页写法都不一样：
     · 三档「1K 标准 / 2K 高清 / 4K 超清」—— 电商海报设计 / 商品多角度多视图 / 批量出图 / 商品场景展示 / 一键模特换背景；
     · 三档**无空格**「1K标准 / 2K高清 / 4K超清」—— 电影级爆炸 / 极地冰封 / 悬浮主视觉 / 汽水广告九宫格 / 装修系五页；
     · 三档**只有数字**「1K / 2K / 4K」—— 平面转建筑效果图 / 建筑九宫格分镜；
     · 三档「1K 标清 / 2K 高清 / 4K 超清」—— 夏季蔬果巨物（他们写作"标清"）；
     · **两档**「2K 高清 / 4K 超清」—— 中文海报 / 相似图 / 毛坯家装 / 图片换风格 / 人物姿势参考 / 极简日系饮品。
   ⇒ 这一页给几档、叫什么，全部照那一页抄。值仍是 1K/2K/4K（引擎口径），只有**标签**照他们。
     默认值保持 2K（与 skillRun 的回落口径一致：界面显示什么，就跑什么）。 */
/* ═══ 2026-09-19 批 P：比例药丸**两种写法 + 两种顺序**（逐页实采）══════════════════════
   · 带后缀（1:1 方图 / 2:3 竖版长图 / …）—— 电商海报设计 / 商品场景展示 / 商品多角度多视图 /
     批量出图 / 一键模特换背景 / 中文海报那一类页面（我们的 RATIO）；
   · **只有数字**（1:1 / 2:3 / …）—— 电影级爆炸 / 极地冰封 / 悬浮主视觉 / 汽水广告九宫格 /
     平面转建筑效果图 / 建筑九宫格分镜（他们的建筑室内页与电商专区的"爆款配方"页都是这种）；
   · 顺序也不一样：中文海报 / 爆款商品文字海报这两页的实测顺序是
     1:1 → 4:3 → 3:4 → 3:2 → 2:3 → 16:9 → 9:16（与他们自己接口里的数组顺序不同，以页面为准）。
   值仍是 1:1/2:3/… （引擎口径），只有**标签与顺序**照他们。 */
const RATIO_BARE = [
  { value: '1:1', label: '1:1' },
  { value: '2:3', label: '2:3' },
  { value: '3:2', label: '3:2' },
  { value: '3:4', label: '3:4' },
  { value: '4:3', label: '4:3' },
  { value: '9:16', label: '9:16' },
  { value: '16:9', label: '16:9' },
];
const RATIO_SIZED = [
  { value: '1:1', label: '1:1方图' },
  { value: '4:3', label: '4:3横版主图' },
  { value: '3:4', label: '3:4竖版海报' },
  { value: '3:2', label: '3:2横版摄影' },
  { value: '2:3', label: '2:3竖版长图' },
  { value: '16:9', label: '16:9手机横屏' },
  { value: '9:16', label: '9:16手机竖屏' },
];
const CLARITY_3 = [
  { value: '1K', label: '1K 标准' },
  { value: '2K', label: '2K 高清' },
  { value: '4K', label: '4K 超清' },
];
const CLARITY_3_TIGHT = [
  { value: '1K', label: '1K标准' },
  { value: '2K', label: '2K高清' },
  { value: '4K', label: '4K超清' },
];
const CLARITY_3_PLAIN = [
  { value: '1K', label: '1K' },
  { value: '2K', label: '2K' },
  { value: '4K', label: '4K' },
];
const CLARITY_2 = [
  { value: '2K', label: '2K 高清' },
  { value: '4K', label: '4K 超清' },
];

/* 这两个字段在 20 多条技能里重复出现，**只能有一份定义**（含默认值）。
   默认值必须与 skillRun.js 的回落值一致：界面显示什么，就跑什么。 */
/* label 可改：知渔「爆款商品文字海报」「中文海报一键生成」这两页里，比例那一格的标题就叫
   「生成尺寸」（不是「比例」）—— 文案照他们。 */
/* ═══ 2026-09-29 批 CY-⑭：**所有图片技能子页的比例都补上「自适应」**（用户原话，逐字）══════════════
   「而且你不能只改这个画布里面的尺寸，就是我刚刚跟你说的这四块……的的确确他们也应该去做这个配置，
     可是这个配置它关乎的是我们**全局的问题**，就是我们首页的图片生成，视频生成，还有我们**各种 skill
     他们的子页面**……你是不是也得给他们加上这个自适应的这个选项进来呢？」
   改前只有 2 个技能（图片复刻 RATIO_CLONE / AI换装 RATIO_TRYON，批 R 照知渔逐档抄）有这一档，
   其余图片技能子页**一律没有** —— 同一件事、同一个竞品证据，在一个产品里出现两种做法。
   ⇒ 统一在 ratioField 这一层加，不再逐个列表去补（那是几十个复制粘贴的机会，漏一个就是又一次不一致）。

   ⚠️⚠️ **默认档也一并改成「自适应」**（2026-09-29 批 DC 续-8 推翻了下面这条旧裁定）：
     旧裁定（批 CY-⑪ 当时定死、这里如实留着）：「**只加选项，不改默认档**……否则等于把几十个技能的行为
       **一次性全改了**，用户没要求、也没有证据支持。」
     用户 2026-09-29 当面给了**更准的那一条**（逐字）：
       「然后比例这里我不是已经让你做了这个自适应吗？我觉得正常来说，你现在应该各种各样的子页面啊，
         首页的生图模型配置啊，还有画布里面的生图配置啊这些地方。**自适应应该是它默认的一个选项呀。**
         除非像这个**概念视觉方案**这里它是对于小红书这边做的一个标准适配，那这个 **3:4 就可以成为它的默认选项**。
         至于其他的地方，我觉得**大部分地方其实自适应才是他们比较需要默认的一个地方**吧。」

     ⇒ `default` 一律是 `ADAPTIVE_RATIO`；**唯一例外是概念视觉方案的 3:4**（小红书竖版签名）。
       那一条不是靠"排除法"实现的 —— 那是该技能自己**显式声明** `default: '3:4'`
       （见下面 `image.concept_set` 那一行），所以例外是**可见的、可数的**。
     ⚠️ 代价必须写清楚：自适应 = **按上传图实际宽高就近取档**。量不到图（没传参考图）时
       `nearestLegalRatio` 返回空 → 回落 `1:1`（skillRun 的 FALLBACK_RATIO）。
     ⚠️ 视频技能子页**不加**（ratioField 只在 imageSkills 里；而且
       `server/videoGeneration.mjs` 对非法比例是**硬 400**，不是静默回落 ——
       给视频加自适应会直接打断请求，那是另一件事、另一批）。
   ⚠️ `RATIO_CLONE` / `RATIO_TRYON`（图片复刻 / AI换装）本来就把自适应放在 options[0]，
     改完之后它们的默认档**不变** —— 也就是说"复刻/换装按原图尺寸走"这件事本来就已经是对的了。 */
const ratioField = (options = RATIO, label = '比例', group = '生成设置') => {
  const list = Array.isArray(options) ? options : [];
  const withAdaptive = list.some(item => item && item.value === ADAPTIVE_RATIO)
    ? list
    : [RATIO_ADAPTIVE, ...list];
  return {
    key: 'ratio',
    label,
    kind: 'segmented',
    group,
    options: withAdaptive,
    required: true,
    /* ★ 批 DC 续-8：默认档 = **自适应**（2026-09-29 用户口径）。
       需要固定默认的技能（如概念视觉方案的 3:4）**在自己的声明里显式写 `default`** 覆盖掉这一行 ——
       例外是可见的，而不是靠这里偷偷判断"谁是特例"。 */
    default: ADAPTIVE_RATIO,
  };
};
/* ═══ 2026-09-19 批 R：图片复刻 / AI换装这两页的比例**照知渔逐档抄**（含「自适应」）═════════
   知渔 ?tool=image-clone 实测（docs/design/data/quantv-image-builtin-pages.json）：
     自适应 / 1:1 / 3:2 / 2:3 / 16:9 / 9:16 / 5:4 / 4:5 / 4:3 / 3:4 / 21:9 / 9:21 / 2:1 / 1:2（14 档）
   我们**只给引擎认得的**（skillRun.LEGAL_RATIOS 十个 + 自适应）——非法值会被服务端
   **静默回落成 1:1**，多写一档就是给用户挖坑（RTK 批次三十六已定性）。
   如实缺的 3 档：9:21 / 2:1 / 1:2（引擎尺寸表里还没有这三个尺寸，要加得先定尺寸并实测上游收不收）。
   「自适应」不是"推荐一个固定比例"——知渔自己的 help 原文是
   「「自适应」将根据模特图自动匹配最接近的比例」，实现见 skillRun.nearestLegalRatio。 */
/* 批 CY-⑭：提到 ratioField 之前 —— 它的函数体在调用时要引用这个常量。 */
const RATIO_ADAPTIVE = { value: ADAPTIVE_RATIO, label: ADAPTIVE_RATIO };
/* 图片复刻：知渔那一页的 14 档，顺序照他们 —— 批 X 起**一档不缺**（引擎已补那三档） */
const RATIO_CLONE = [
  RATIO_ADAPTIVE,
  { value: '1:1', label: '1:1' }, { value: '3:2', label: '3:2' }, { value: '2:3', label: '2:3' },
  { value: '16:9', label: '16:9' }, { value: '9:16', label: '9:16' }, { value: '5:4', label: '5:4' },
  { value: '4:5', label: '4:5' }, { value: '4:3', label: '4:3' }, { value: '3:4', label: '3:4' },
  { value: '21:9', label: '21:9' }, { value: '9:21', label: '9:21' }, { value: '2:1', label: '2:1' },
  { value: '1:2', label: '1:2' },
];
/* AI换装：知渔那一页是 自适应 + 5 档，我们**一档不缺**（6 档全在引擎白名单里） */
const RATIO_TRYON = [
  RATIO_ADAPTIVE,
  { value: '1:1', label: '1:1' }, { value: '3:2', label: '3:2' }, { value: '2:3', label: '2:3' },
  { value: '16:9', label: '16:9' }, { value: '9:16', label: '9:16' },
];

/* ═══ 2026-09-18 批 F：跨境字段的**全部选项照竞品实测原文**══════════════════════════
   依据：CDP 实测（一次一标签、抓完即关），逐条原文见 docs/design/50-quantv-subpage-field-spec.md。
   用户原话：「你要真的去抓他们的字段名、全部选项、上传位数、按钮价格、编号交付清单，
   然后照着做，不要凭想象。」
   所以这三张表是**量出来的**，不是我想出来的：
     · 目标市场 9 档（套图版）/ 13 档（A+、详情图版，多出巴西·阿根廷·智利·墨西哥）
     · 目标平台 5 档（套图版淘宝在最前；详情图版京东在拼多多前 —— 顺序也照他们）
     · 语言 13 档 + 「无文字」（A+ 的原文里那一档就叫「无文字」；
       套图叫「无文字」，详情图没有这一档）
   ⚠️ 它们**只进提示词**，不改变引擎协议 —— 市场影响文案与合规习惯，语言决定画面里的文字。
      所以加档位是安全的（不会像比例那样被服务端静默回落）。 */
const MARKET_BASE = [
  { value: '中国', label: '中国' }, { value: '美国', label: '美国' }, { value: '欧洲', label: '欧洲' },
  { value: '东南亚', label: '东南亚' }, { value: '日本', label: '日本' }, { value: '韩国', label: '韩国' },
];
const MARKET_WIDE = [
  { value: '中国', label: '中国' }, { value: '欧洲', label: '欧洲' }, { value: '东南亚', label: '东南亚' },
  { value: '美国', label: '美国' }, { value: '日本', label: '日本' }, { value: '韩国', label: '韩国' },
  { value: '南非', label: '南非' }, { value: '新加坡', label: '新加坡' }, { value: '巴西', label: '巴西' },
  { value: '阿根廷', label: '阿根廷' }, { value: '智利', label: '智利' }, { value: '墨西哥', label: '墨西哥' },
  { value: '俄罗斯', label: '俄罗斯' },
];
/* 套图的目标市场是 9 档（含南非/新加坡/俄罗斯），A+ 与详情图是 13 档 —— 两版都照原文收着 */
const MARKET_SUITE = [
  { value: '中国', label: '中国' }, { value: '美国', label: '美国' }, { value: '欧洲', label: '欧洲' },
  { value: '东南亚', label: '东南亚' }, { value: '日本', label: '日本' }, { value: '韩国', label: '韩国' },
  { value: '南非', label: '南非' }, { value: '新加坡', label: '新加坡' }, { value: '俄罗斯', label: '俄罗斯' },
];
const LANGUAGE_FULL = [
  { value: 'English', label: 'English' }, { value: '简体中文', label: '简体中文' }, { value: '日本語', label: '日本語' },
  { value: '俄语', label: '俄语' }, { value: '韩语', label: '韩语' }, { value: '法语', label: '法语' },
  { value: '德语', label: '德语' }, { value: '泰语', label: '泰语' }, { value: '巴西语', label: '巴西语' },
  { value: '西班牙语', label: '西班牙语' }, { value: '越南语', label: '越南语' }, { value: '马来西亚语', label: '马来西亚语' },
  { value: '繁体中文', label: '繁体中文（必须使用2K及以上）' },
];
/* ═══ 批 P：图片复刻页的语言是 **11 档**（逐页实采）══════════════════════════════════
   ?tool=image-clone 的语言下拉实测只有：English / 简体中文 / 日本語 / 俄语 / 韩语 / 法语 /
   德语 / 泰语 / 巴西语 / 西班牙语 / 越南语 —— 比 A+/详情图少了「马来西亚语」，也比套图少了「无文字」。
   上一版我们照 LANGUAGE_FULL 给了 12 档（多一个马来西亚语），逐页比对时就被抓出来了。 */
const LANGUAGE_CLONE = LANGUAGE_FULL.filter(item => !['马来西亚语', '繁体中文'].includes(item.value));
const PLATFORM_SUITE = [
  { value: '淘宝', label: '淘宝' }, { value: '抖音', label: '抖音' }, { value: '小红书', label: '小红书' },
  { value: '拼多多', label: '拼多多' }, { value: '京东', label: '京东' },
];
const PLATFORM_WIDE = [
  { value: '淘宝', label: '淘宝' }, { value: '抖音', label: '抖音' }, { value: '小红书', label: '小红书' },
  { value: '京东', label: '京东' }, { value: '拼多多', label: '拼多多' },
];
/* 市场/语言用下拉（竞品是 select —— 9~13 档用 segmented 会撑成两三行药丸，
   那是"我们自己的长相"，不是他们的）。 */
const marketField = (options = MARKET_BASE) => ({ key: 'market', label: '目标市场', kind: 'select', group: '基础信息', options, default: options[0].value });
const languageField = (label = '文案语言', options = LANGUAGE_FULL) => ({ key: 'language', label, kind: 'select', group: '基础信息', options, default: options[0].value });
const platformField = (options = PLATFORM_SUITE) => ({ key: 'platform', label: '目标平台', kind: 'select', group: '基础信息', options, default: options[0].value });
/* optionsFrom：这一格的档位**跟着模型变**（批 R）——
   模型目录里写着哪些模型不支持 4K（目前只有 Midjourney），选了它这一格就只剩 1K/2K。
   没有这一条的话，界面会给出一个做不到的档：显示 4K、请求按 2K 跑（看着是 A、跑的是 B）。 */
const clarityField = ({ options = CLARITY_3, label = '分辨率' } = {}) => ({
  key: 'clarity', label, kind: 'segmented', group: '生成设置', options, required: true, default: '2K',
  optionsFrom: { key: 'imageModel', map: MODEL_RESOLUTION_LIMITS },
});
const countField = (max = 6) => ({ key: 'count', label: '生成数量', kind: 'stepper', group: '生成设置', min: 1, max });
/* 上传位的组名照竞品：他们的上传区就在「基础信息 → 上传图片」这一块里 */
/* 上传位：竞品在它下面还跟一串同组的字段（产品卖点 / 设计风格…），
   所以 uploadField 允许带一个 after（同组、紧跟其后的字段），顺序与竞品一致。 */
function uploadField({ after = [], ...extra } = {}) {
  const base = { key: 'assets', label: '素材', kind: 'upload', group: '上传图片', required: true, role: 'product', slotLabel: '上传商品图', ...extra };
  return after.length ? [base, ...after] : base;
}
/* 设计风格：竞品是三选一分段（AI推荐 / 参考排版 / 自定义要求），
   选中之后下面才是「AI推荐风格分析 · 0.10 积分」那颗付费按钮。
   ⚠️ 分析与出图是**两个付费动作**（他们 0.10 / 0.10，我们 0.2 / 按张）——
      这里只声明"有这一档"，按钮与计价落在工作台（价款必须写在按钮上）。 */
function styleFields(group) {
  return [
    { key: 'style', label: '设计风格', kind: 'segmented', group,
      options: [
        { value: 'AI推荐', label: 'AI推荐' },
        { value: '参考排版', label: '参考排版' },
        { value: '自定义要求', label: '自定义要求' },
      ], default: 'AI推荐' },
    /* ═══ 2026-09-19 批 I-8（用户批注 #2-1 / #3-1）：**切换必须真的换出东西** ═══════════════
       用户原话：「他们这里是有切换按钮的，你为什么切换按钮点了是没有反应的呢？」
       「你看，你应该每个skill工作台都去深度点击，看看他们各个按钮下面是什么反馈啊，
         **他这里切换过来是有上传区和设计要求这些元素的呀**。」
       根因：这颗「自定义风格要求」原来**一直挂在字段表里** —— 于是点「AI推荐」它也在这儿、
       点「自定义要求」它还是原样，用户看到的就是"这个切换点了没反应"。
       现在它只在选中「自定义要求」时才出现（visibleWhen 的判据写在声明源里，
       与 imageSkills 里「自定义配置」那条同源，不散在页面里）。 */
    /* ═══ 2026-09-19 批 Q：**三档各自的内容逐档照抄（CDP 逐个点过）** ═════════════════════
       用户批注 #3-1：「你这个地方怎么会没有这个输入框呢？他们是有输入框的呀，你没有输入框的话，
         那你这个 AI 推荐要推荐在哪里呢？你肯定要有一个输入框让 AI 推荐把结果给显示在里面呀。
         你现在是不是连这些按钮，它们背后的逻辑你都没有弄明白呀？」
       用户批注 #3-2：「而且你这两个按钮都没做这方面的工作呀。这两个按钮现在打开里面都是空的。」
       实测（.tmp/laoyu2/qy-suite-switch.mjs，三颗逐一点过）：
         · 点「参考排版」→ 出现**「风格/排版参考图（可选）0/5」上传框**
         · 点「自定义要求」→ 出现**「设计要求」文本框**
         · 点「AI推荐」  → 出现**「AI推荐风格分析 · 0.10 积分」按钮**，结论落进一个**可编辑输入框**
       ⇒ 上一版只有「自定义要求」有东西，另两档点开是空的 = 死切换。现在三档各有一份自己的内容。 */
    { key: 'styleRef', label: '风格/排版参考图（可选）',
      longLabelReason: '照知渔原文逐字：点「参考排版」之后出现的上传位就叫「风格/排版参考图（可选）」',
      kind: 'upload', group, maxImages: 5, role: 'reference',
      visibleWhen: { key: 'style', equals: '参考排版' },
      slotLabel: '上传参考图', hint: '上传你想参考的排版与风格，最多 5 张' },
    { key: 'styleNote', label: '设计要求',
      longLabelReason: '照知渔原文逐字：点「自定义要求」之后出现的文本框标题就叫「设计要求」',
      kind: 'textarea', rows: 3, group,
      visibleWhen: { key: 'style', equals: '自定义要求' },
      placeholder: '写清你想要的风格、材质、光线与排版要求' },
    { key: 'styleBrief', label: '设计风格要求',
      kind: 'textarea', rows: 3, group,
      visibleWhen: { key: 'style', equals: 'AI推荐' },
      /* ═══ 2026-09-29 批 DC 续-8：**推翻批 CY-⑪ 的「空态不渲染」**（同一位用户，两天后当面改回）══════════
         批 CY-⑪ 当时的原话（仍然成立的一半）：「他应该是一个一键解析风格的按钮**在中心**」——
         按钮的位置没错，那一条保留（见 WorkbenchShell 的 `.media-workbench-field-action`）。
         被推翻的是**"把输入框拿掉"**这一半。用户 2026-09-29 逐字：
           「你看他们的做法是这里会有一个相应的**提示词输入框的一个背景**。然后中间再去放这个一键生成的这个按钮。
             它的逻辑就是当用户点击这个按钮之后，它会生成出来的内容就是在这个框里面，然后是以**提示词输入区
             的那个形式**把内容输入在里面的。**用户可以随时去改这个你生成出来的文字。你现在的情况就做的是不对的，
             就是你把这个文字输入框给拿掉了。**」

         ⚠️ 支撑这次反转的证据在**竞品自己的 DOM 里**（docs/design/data/quantv-image-builtin-pages.json:46）：
           详情图那一页的顺序是 `爆款风格 / 参考·自定义风格 / **AI推荐风格选择** / 爆款风格分析 · 0.10积分`
           —— 那个**具名结论框在分析之前就在页面上**，按钮在它下面。
           批 CY-⑪ 那次"同类排查"是按 placeholder 措辞筛的（"点…后结论会写在这里"），
           结论正好搞反了：**措辞之所以那么写，正因为框一直在。**

         ⇒ 去掉 `hideWhenEmpty`（零新代码）：这一格直接继承 `textarea` 的完整渲染路径
           （TextareaControl + `@引用素材` + `放大` + 字数），与「自定义要求」的 `styleNote`
           **逐字同款** —— 正是用户说的"它跟第三个按钮的那个自定义要求，它们的逻辑其实是类似的"。

         ⚠️⚠️ 2026-09-29 批 DC 续-16 **更正**：上一条（连同我在 RTK 里据此写下的结论）说
           「`styleBrief` 的内容仍然**不进 brief 模板**（没有任何 brief 写 `{{styleBrief}}`）」——
           **那句话是假的**，而且是我照着一行**没核过**的注释向你复述的。
           实测三条电商 brief（`imageSkills.js:631 / 723 / 836`，批 CY-㒓 接的）**都写着**
           `{{?styleBrief}}风格要求：{{styleBrief}}。{{/styleBrief}}`；
           `buildSkillBrief`（`skillRun.js:329-332`）把 `{{?key}}…{{/key}}` 整段按值取舍；
           门禁 `test/skill-brief-reaches-user-input-0929.test.mjs:97-99` 逐字断言
           填了 `styleBrief:'柔和侧光'` ⇒ 提示词里必须出现「风格要求：柔和侧光」。
           ⇒ **这 0.2 积分买到的结论一直都发给了模型**，不需要新写接线。
           ⚠️ 记这条是因为它和连拍组那次是**同一个病**：注释里写「实测表明…」或「某某不读」时，
             没人去跑一遍就照着它决策。**注释里的这类断言必须能被一条命令验证。**

         ═══ 2026-09-29 批 DC 续-16：**锁住态**（用户第二次当面指出，这才是对的那一版）══════════════════
           「这个地方的确得有一个输入框，但是这个输入框它**不能是让用户能够随便在这里输入的**。
            他这个地方是要让用户点击这个一键解析的这个按钮之后，这个输入框才会被解锁出来，
            然后内容会自动生成在里面。这个输入框平时它是一个**被锁死的状态**，然后这个一键解析的
            按钮**出现在它的表面上**。……不然你现在这个情况，这个AI推荐和自定义要求，
            他们岂不就同样的逻辑了？」

           `gatedByAction` 就是这条口径：值为空 ⇒ `readOnly` + 按钮浮在框表面 + 下面那颗不重复出现；
           值非空 ⇒ 完全恢复可编辑。**锁不锁由「值是不是空」推导，不另开 state**，
           所以"用户把内容删光 ⇒ 自动回锁"与"退出页面 ⇒ 不留痕"都是免费的副产品。
           ⚠️ 为什么**不留存**（用户问过，理由写在这）：① 这 0.2 积分是用户真金白银买的，
             存下来等于换个页面白拿；② 参考图可能已经换了，一份对着旧图生成的结论留着是在骗模型。 */
      gatedByAction: 'style-analysis',
      /* 锁住时框里那颗按钮就是入口，所以 placeholder 不能再说"点上面的"——
         「上面」是上一版按钮在框**下面**时才对的措辞，现在按钮在框**表面**上。 */
      gatedPlaceholder: 'AI 分析完会把结论写在这里，写完可以直接改',
      placeholder: 'AI 分析完会把结论写在这里，写完可以直接改' },
  ];
}

/* ═══ 2026-09-25 批 BP：本账号的五个**实测色簇**与母体库（「概念视觉方案」用）══════════════
   色簇是批 BF 对竞品 41 张封面做 k-means 聚类**量出来的**（灰调大地 11/41 · 海蓝灰雾 9 ·
   柔雾浅粉 8 · 暖砂裸粉 7 · 深棕暗红 6）；下面每条母体都挂在其中一个色簇上 ——
   **母体决定色调**，这正是"每篇看着不一样、但一眼是同一个账号"的机制本身（docs/design/78/82）。
   ⚠️ 这五个色簇是**业务内容数据**（实测得到的账号色板），不是 UI 主题色 ——
      所以它们不归 `--sb-*` token 体系管，走 token 棘轮既有的人工登记路径（见提交说明）。
   ⚠️ 只在这里定义一次、由下面的 helper 拼出选项 —— 上一版把同一批 hex 在 20 个选项里抄了 20 遍。 */
const CONCEPT_PALETTES = {
  灰调大地: { main: '#94847A', aux: '#8F8E93 / #CAB3AE' },
  海蓝灰雾: { main: '#8B9EAB', aux: '#91B5CB / #C8DDE9' },
  柔雾浅粉: { main: '#BDB6BC', aux: '#EFD3CF / #E7B5B1' },
  暖砂裸粉: { main: '#BF9A8B', aux: '#D7C5AF / #F3D1AC' },
  深棕暗红: { main: '#765149', aux: '#88584A / #271A15' },
};

/* 20 条母体（docs/design/81 的种子表）：[母体名, 它挂的实测色簇] */
const CONCEPT_THEMES = [
  ['秋日限定', '灰调大地'], ['新中式清冷', '灰调大地'], ['无花果香', '灰调大地'], ['时髦底色', '灰调大地'],
  ['去看海', '海蓝灰雾'], ['夏日碎片', '海蓝灰雾'], ['浆果味盛夏', '海蓝灰雾'], ['把夏天留在身上', '海蓝灰雾'],
  ['你想要的粉色', '柔雾浅粉'], ['柔粉的秋', '柔雾浅粉'], ['蝴蝶振翅', '柔雾浅粉'], ['海边赴约', '柔雾浅粉'],
  ['落日柔光', '暖砂裸粉'], ['南法假日', '暖砂裸粉'], ['盛夏一场雨', '暖砂裸粉'], ['秋日松弛', '暖砂裸粉'],
  ['晚宴自带高光', '深棕暗红'], ['巧克力吻过的秋', '深棕暗红'], ['手握权力', '深棕暗红'], ['值得庆祝', '深棕暗红'],
];

/* 选项的 value = **进提示词的那句话**（概念 + 该簇的实测色板）。
   把色板写进 value（而不是再开一格让用户选第二次）是刻意的：`buildSkillBrief` 只做
   `{{key}}` 纯替换、没有查表能力 —— 写进 value 才能保证**概念与色板同源、永远不会对不上**，
   而且零额外逻辑、零额外 token（不必在提示词里再放一张对照表）。 */
const conceptThemeOptions = () => CONCEPT_THEMES.map(([name, cluster]) => {
  const palette = CONCEPT_PALETTES[cluster];
  return {
    value: '概念：' + name + '（主色 ' + cluster + ' ' + palette.main + '，辅 ' + palette.aux + '）',
    label: name + ' · ' + cluster,
  };
});

/* ═══ 2026-09-26 批 BW：十种手法与五个色簇**导出**，供预览步②（方向偏好）复用 ═══════════════
   预览的「方向偏好」与工作台的「本篇方案」必须给同一套选项 —— 两处各写一份的话，
   改了一处另一处就漂了（这个仓里已经踩过同类的坑：模型档位/分辨率夹取）。
   `value` = 手法名 + 执行定义（一起下发），`label` 只给人看短名。 */
export const CONCEPT_SHOT_OPTIONS = () => ([
  { value: '概念静物 —— 把主题的实体与产品重构进同一张静物，像把巧克力砖搭成一座建筑', label: '概念静物' },
  /* ⚠️ 2026-09-27 批 DB（M1）：这一条原来写「需要人时只出手部或背影，**绝不露脸**」——
     那是与 brief 同源的**绝对禁令**。实测（deep-dive §4.3）躯干腿 74 张 + 手 66 张 = 34.8% 的图里
     身体局部在场，而"绝不露脸"会把它们全砍掉。现在改成"只出现局部"，人物形态由 `{{person}}` 那六档说了算。 */
  { value: '场景叙事 —— 把产品放进一个真实生活场景，人物只出现局部（手、躯干、背影），不进画面中心', label: '场景叙事' },
  { value: '材质静物 —— 让产品躺在一种材质上（皮草、亚麻、砂石），靠触感说话', label: '材质静物' },
  { value: '平铺集合 —— 俯拍把产品与配饰摊开成一整套，像开箱摊在台面上', label: '平铺集合' },
  { value: '局部极特写 —— 只拍一处身体局部（嘴唇、手、颈），产品贴上去', label: '局部极特写' },
  { value: '超现实拼贴 —— 用屏幕、镜面或倒影做出里外两层', label: '超现实拼贴' },
  { value: '拼版页 —— 一张图里并排两三格不同画面，像杂志内页', label: '拼版页' },
  { value: '杂志版式 —— 照片加边框、年份与大量留白，像杂志跨页', label: '杂志版式' },
  { value: '户外自然光 —— 自然光实拍感，不在影棚里打灯', label: '户外自然光' },
  { value: '空镜 —— 画面里没有产品，只有主题氛围，作为一套里的呼吸页', label: '空镜' },
]);

/* ═══ 2026-09-27 批 DC（M2）：构图方向（每张一档）与版式族（每篇一档）════════════════════════
   依据：`docs/research/2026-09-27-aura-composition-direction.md`（402 张全量逐张判定）。数字原话：
     · 用户说的"一张左→右、一张右→左"**部分成立**：严格口径（同篇既有左→右又有右→左）**3/41 篇（7.3%）**；
       放宽到"主体一左一右" **9/41（22.0%）**，其中"同一主体/场景换到另一侧" **7/41（17.1%）**。
     · 全站**真有横向引导**的只有 **33/402（8.2%）**（左→右 10、右→左 23）；**63.7% 的图没有横向引导**；
       **镜面对称构图 69/402（17.2%）**——居中式大留白才是基本盘。
     · **"镜像成对"不成立**（客观配对只剩 4 组弱候选，目视怀疑的 23 组里 16 组被原图否定）
       ⇒ **不做"镜像成对"这个功能**（做了会让模型产出他不做的"工整镜像对"）。
     · 真正撑起"成套感"的是：**篇内"同版式族反复用" 74/402（18.4%），落在 21 篇**。
   ⇒ 两栏都按实测给默认值，并且**只给做得出来的档**（见各自的注释）。 */
export const CONCEPT_DIRECTION_OPTIONS = () => ([
  { value: '画面不做方向引导（主体居中、左右留白平衡）', label: '居中/无方向' },
  { value: '画面动势自左向右引导（人物或身体局部从左入画，视线与动作朝右）', label: '左→右' },
  { value: '画面动势自右向左引导（人物或身体局部从右入画，视线与动作朝左）', label: '右→左' },
  { value: '画面居中对称（左右近乎等量的平衡构图）', label: '居中对称' },
]);

/* 版式族：**每篇一档**，由版式层（客户端确定性拼版）消费。
   ⚠️ 它**不进提示词** —— 我们实测过：让模型"一次画一整张九宫格"会把分格线画歪、格内内容互相渗透，
      正确做法是先出 N 张单图、再在版式层拼（docs/design/90 §6.2）。

   ═══ 2026-09-28 批 DC 续-3：**改成可选、默认不拼、四族齐备**（用户当面纠错之后的重做）══════════
   用户原话（逐字）：「**版式族为什么一定要选呢，只有两个选项呀，是必须选吗**？……我感觉你好像一直
   是根据我说了什么就做什么，你有自己去调研他的各种风格策划吗……有没有我忽略的排版和布局和构图方式呢？」
   ⇒ 复核 402 张原始判定，确认他两点都对，而且错在我身上：
     · **必选是错的**：拼版只 **60/402（14.9%）**，**85% 的图是单图**（他把拼版当佐料、我当主菜）；
     · **默认"宫格"是错的**：本仓自己有一条规矩「默认档必须是中性档，不许拿一个具体取值冒充默认」，
       「构图方向」我守了（默认居中/无方向），这一栏却没守 ⇒ 现在默认 = 「不拼版」；
     · **选项集是"工程便利"冒充"数据"**：实测四种语法的规模是
       ①宫格 15+ 张（n20-1/n29-1/4/n32-1/n35-1/9/n36-3/n40-1/n19-1/n25-7/n31-3…）、
       ②宝丽来/白框画中画 **14 张 / 8 篇**（n22-2、n24-2/9、n26-7、n27-2、n29-2、n34-1/6/11、n23-5/9/10、n32-4）、
       ③品牌"信息图"版式 **14 张 / 6 篇**（n33-4/8、n35-6、n36-4/6/10、n20-2/9/12、n37-2/3/4、n38-3）、
       ④底片条 **3 张 / 3 篇**（n24-4、n27-1、n28-7）。
       而我上一版给的是 ①+④ —— **把最罕见的底片条选进来、把并列第二的②③挂起来当"下一批"**，
       选它的理由是"这两种我现在拼得出来"。现在四族齐备，底片条仍在（它有辨识度），
       但**不再有任何一族是"因为做不出来所以没有"**。
   ⚠️ 硬规则「至少 2 张」保留，但依据**改了**：它现在只表示"1 张拼不出东西"这条**渲染下限**
     （拼版的意义就是"把几张放进一个版式"）。原来拿"同族复用 74/402"给拼版侧当依据是**用错了地方** ——
     那条量的是"拍摄时同一个机位连着用几张"，属于出图侧，已经挪到「连拍组」那一栏去用。 */
export const CONCEPT_LAYOUT_FAMILIES = () => ([
  /* 中性档放第一位：`initialSkillValues` 取 options[0]（也显式写了 default），
     所以"什么都没选"时落在这一档上 —— 与实测的 85% 单图一致。 */
  /* ⚠️ 2026-09-28 批 DC 续-7：**hint 只讲这一族长什么样**（用户批注图2-②，原话：
     「这些你在你的输出结果这里告诉我就可以了，**不要在线上把这些文字打出来啊**」）。
     改前这里写着「实测他 85% 的图都是单图」「（他的第二大族）」—— 那是**我们的话**、
     是拿竞品做的内部分析，用户看不懂也不该在选版式的当场看。
     ⇒ 分析结论不删，**搬家**到结果区选版式族时的那一行（MediaCreation 的 resultArea），
        那才是"看完结果再决定拼不拼"的时刻。 */
  { value: LAYOUT_FAMILY_NONE, label: '不拼版', hint: '这一篇每张独立成图。想拼成一张，在结果区随时可以拼，免费。' },
  { value: '宫格', label: '宫格', hint: '几张排成整齐的格子（2×2 / 3×3），像杂志内页' },
  { value: '底片条', label: '底片条', hint: '像一条胶片：等宽的格并排，带齿孔与边框码' },
  { value: '宝丽来画中画', label: '宝丽来', hint: '白框/宝丽来相纸一张张叠在纸面上，带轻微旋转与投影' },
  { value: '品牌信息图', label: '信息图', hint: '每张做成一张版式卡：图 + 标题/正文排版（左图右文、词典卡、大字色块三种）' },
]);

/* 能拼的族（不含「不拼版」那一档）—— 版式层据此判"这一族拼不拼得出来"。 */
export const CONCEPT_COMPOSE_FAMILIES = () => CONCEPT_LAYOUT_FAMILIES()
  .filter(option => option.value !== LAYOUT_FAMILY_NONE)
  .map(option => option.value);

/* ═══ 2026-09-27 批 DC（M2）：「一套」= 一次勾 N 种手法 → 逐张出 N 张（按张计价）════════════
   用户原话（docs/design/90 §一-2）：「**「一套图片」可以按你说的做吧**」；§6.5 定的口径：
     「「一套」= 一张一张计价（N 张 = N 张的钱），按钮上写清单价与总额」。
   实现：把十种手法做成**这一条技能的可勾选清单**（`modules`）——
     界面上就是 A+ 那条「包含模块 已选 N/10」的同**一个**控件（WorkbenchShell 的 sections），
     勾几个 = 出几张 = 收几张的钱（张数由页面注入 effectiveValues.count，与 A+ 同一条链）。
   ⚠️ 为什么不另开一个字段做多选：① 勾选清单是这个仓**已有的**控件（不许新造第五种控件风格）；
     ② 十档多选药丸会被折成「更多」，而用户明确批过这种折叠（「更多，如果只有一个的话，
     那你为什么一定要有这个更多呢」）；③ 「勾几个出几张」这条链已经为 A+ 打通并有钱路门禁守着。
   `name` = 勾选清单上显示/勾的名字，`hint` = 清单里的那句说明，`value` = 这一张进提示词的定义。
   三者都由 CONCEPT_SHOT_OPTIONS **派生**（同一份来源，绝不写第二遍）。 */
export const CONCEPT_SHOT_MODULES = () => CONCEPT_SHOT_OPTIONS().map(option => {
  const [name, definition] = String(option.value).split(' —— ');
  return { name: option.label, hint: definition || option.value, value: option.value };
});

/* ═══ 2026-09-28 批 DC 续-7：三档规模预设 + **默认 6 张**（用户当场追问的那句）══════════════
   用户原话：「它到底生成的是一整套的小红书图片还是一张一张的生成呢？……**因为你这个工作台里面
     并没有给我张数呀。我根本就不知道你产出的到底是多少张？**」
   根因是**真缺陷**，不是表述问题：进页面时 `moduleOff` 把十种手法**全部关掉**（count=0、
     CTA 是灰的），而清单上唯一的数量提示是「已选 0/10」——「10」是**上限**不是**这一篇要出几张**，
     于是用户既看不出会出几张，也看不出是一次买一整篇还是一次买一张。
   ⇒ 修法是三件事：① 预设三档规模；② 默认按「标准」**勾好**（进页面即可提交）；
     ③ 张数写进清单标题与主按钮（见 WorkbenchShell / CTA）。
   依据（docs/research/2026-09-27-aura-deep-dive.md）：单篇 4~18 张、均值 10.3 张。
     「标准 6」= 均值偏保守一档：一次出 6 张已足够拼出 2×3 或两轮 3 张，
     而**按张计价**（6 张只付 6 张的钱）意味着这一档不贵、翻车成本低。
   ⚠️ 预设**不手写手法名单** = 稳定取 CONCEPT_SHOT_OPTIONS() 的**前 N 个**：
     手法表只有一份真相，将来增删档位，三档预设自动跟着对（手写名单必漂）。
   ⚠️ 「完整 10」= 全部十种，仍是**默认档位之外**的那一档（用户不想一次花十几积分时不必选它）。 */
export const CONCEPT_SHOT_PRESETS = () => ([
  { value: 'light', label: '轻量', count: 4, hint: '先出 4 张试一下手法与色调，满意再加' },
  { value: 'standard', label: '标准', count: 6, hint: '6 张够拼一整篇小红书图文' },
  { value: 'full', label: '完整', count: 10, hint: '十种手法全出，一篇出到 10 张' },
]);
/* 默认档 = 标准（用户已拍板）。取「声明顺序里 count === 6」的那一档，而不是写死下标 ——
   表改了顺序也不会静默指向别的档。 */
export const CONCEPT_DEFAULT_PRESET = 'standard';
export function conceptShotPresetValues(preset = CONCEPT_DEFAULT_PRESET) {
  const all = CONCEPT_SHOT_MODULES();
  const picked = CONCEPT_SHOT_PRESETS().find(item => item.value === preset);
  return all.slice(0, picked ? picked.count : 0).map(item => item.name);
}

/* ═══ 2026-09-27 批 DB（M1）：人物形态**六档**（替换那条"不出现面部"的绝对禁令）══════════════
   用户原话（90 号 §一-3 逐字）：「不要露脸这条太绝对」「他还是会有几个作品其实是有露脸的，
     模特有些是戴着墨镜的，有些是侧着脸的」。
   实测（docs/research/2026-09-27-aura-deep-dive.md §4.3，402 张**逐张**判定，方法见该文 §0.1）：
     完全没有人 206（51.2%）· 只有躯干/腿 74（18.4%）· 只有手/手臂 66（16.4%）· 下半脸 17（4.2%）
     · 戴墨镜 13（3.2%）· 被书/杂志完全挡住脸 8（2.0%）· 背影/后脑 8（2.0%）· 照片里的脸 7（1.7%）
     · 侧脸且眼睛可见 2（0.5%）· **正面脸只有 1（0.2%）**
   ⇒ 汇总：**完全没有头 346/402 = 86.1%**，但**身体局部在场的有 34.8%**（躯干腿 18.4% + 手 16.4%）；
     「不出现面部」这条比真人账号**更严**（用户说的"太绝对"成立），所以改成六档可选；
     默认档取**实测最高频**的「空镜」（206 张 = 51.2%，是唯一过半的一档）；
     **只有"正脸"保持禁令** —— 实测 1/402 = 0.2%，唯一一条站得住的硬约束。
   ⚠️ label 必须 ≤6 字（`test/concept-set-workbench-0925` ① 守着），所以括号里的限定写进 **value**
      （value 就是进提示词的那句话，与「主题意象」「手法」同一口径：选项值自带可执行措辞）。 */
export const CONCEPT_PERSON_OPTIONS = () => ([
  { value: '画面里不出现任何人物（空镜或纯静物）', label: '空镜' },
  { value: '人物只出现手或手臂，头部与其余身体全部出画', label: '手或手臂' },
  { value: '人物出现躯干与腿部，额头以上整体出画（画面里看不到头）', label: '躯干与腿' },
  { value: '人物只出现下半脸（唇、鼻、下巴），额头以上整体出画', label: '下半脸' },
  { value: '人物可以出现头部，但一律戴墨镜遮住眼睛，把墨镜当成造型元素', label: '戴墨镜' },
  { value: '人物只出现背影或侧脸（后脑、头发，或未正对镜头的侧影）', label: '背影或侧脸' },
  /* ═══ 第七档（2026-09-28 批 DC 续-3 新增）：**脸只以"画面里的照片"出现**══════════════════════
     实测 **7/402（1.7%）**（报告 §4.3 的「照片里的脸」；n23/n25 的脸只以宝丽来框、杂志页、
     广告牌的形式出现）。这一档的价值不是占比，而是它给了"想让人物在场、又不想破'不露脸'纪律"
     的第三种解法 —— 前两种（身体局部、墨镜）我们已经有了，这一种一直没有，而它正好与①的
     「宝丽来/白框画中画」是同一个母题（画中画）。 */
  { value: '人物的脸只作为「画面里的照片、杂志页或广告牌」出现（画中画），本人不出现在镜头前；相框或纸面本身是画面的一部分', label: '画中画' },
]);

/* 五个**实测色簇**（k-means 量出来的），value 里带主辅色值 —— 选它等于把色板一起定下来。 */
export const CONCEPT_PALETTE_OPTIONS = () => Object.entries(CONCEPT_PALETTES)
  .map(([cluster, palette]) => ({
    value: '色调：' + cluster + '（主色 ' + palette.main + '，辅 ' + palette.aux + '）',
    label: cluster,
  }));

export const IMAGE_SKILLS = [
  /* ═══ 2026-09-23 批 AB：删掉两条**纯我们自造、无任何外部依据**的页 ═══════════════════════
     用户原话：「**image.free（自由创作）、image.material（材质细节）这两个去掉**」。
     背景：批 AA 我把"知渔没有对应页"的 42 条与出处台账交叉了一遍，纯 ours（既没有知渔对应页、
     也没有官方用例/开源库背书）的恰好只有这两条 + 小红书图文 + 首尾帧；
     用户点名保留后两者（"我们原有的小红书图文…" / 首尾帧是三个入口之一），所以只删这两条。
     ⚠️ 删的是**技能卡与它的工作台声明**（申明失败选项不许存在）；
        自由创作这条链路本身（首页的 visualCreation 模式）不受影响，它是页面级模式，不是这张卡。 */
  /* ── 精品推荐：推荐位，封面只用图、不烤字（实测口径）──────────────────────── */
  {
    /* ═══ 2026-09-19 批 O-⑥：complexity 从 'simple' 改成 'standard' ═══════════════════════
       依据：知渔「中文海报一键生成」实测有 **8 个字段**
         （主题 / 画面描述 / 用途 8 档 / 生成尺寸 / 字体 6 档 / 颜色 15 档 / 效果 18 档 / 分辨率 2 档）。
       本仓判据是「simple 档字段不得超过 4 个」—— 一个 8 字段的工作台本来就不该标 simple。
       这不是为了让门禁过而放宽：字段数是**实测抄来的**，改的是"这一档有多复杂"这个判断。 */
    id: 'image.poster', board: 'image', name: '海报设计', category: '创意应用', complexity: 'standard',
    cover: { template: 'poster-style', accent: 'warm' },
    summary: '先立主视觉，再排信息层级', pipeline: 'visualCreation', availability: 'ready',
    visual: 'poster',
    brief: '设计一张电商海报：以我上传的这张商品图为主视觉。产品卖点：{{points}}。要求：单一视觉焦点、清晰的信息层级与阅读顺序，并留出安全的标题区；画面内的文字必须逐字准确，不得臆造文案、日期、价格或 logo。',
    /* ═══ 2026-09-19 批 O-⑥：**映射改正 + 字段照抄** ═══════════════════════════════════════
       ⚠️ 我原来的映射表把「海报设计」指到了「中文海报一键生成」—— **串页了**
          （中文海报一键生成 8 字段，是 image.cn_poster 的对应页）。
       它真正的对应页是知渔的「**电商海报设计**」，inputConfigs 逐字：
         上传图片 [file 必填] · 产品卖点（可选，不用很复杂，简单一点）[multiText **可选**] ·
         比例 [7 档] · 分辨率 [1K标准/2K高清/4K超清]
       ⇒ 我们原来是 主题 + 画面描述（两个自由文本框，没有上传位），与他们的**结构完全不同**：
          他们是"上传商品图 + 可选卖点"，我们却让用户凭空描述一张海报。按他们改。 */
    fields: [
      { key: 'assets', label: '上传图片', kind: 'upload', required: true, maxImages: 1, role: 'product', slotLabel: '上传商品图' },
      { key: 'points', label: '产品卖点（可选，不用很复杂，简单一点）',
        longLabelReason: '照知渔原文逐字：他们这一页的第二格标题就叫「产品卖点（可选，不用很复杂，简单一点）」',
        kind: 'textarea', rows: 2, placeholder: '买一送一，满99减30' },
      ratioField(),
      /* 批 P：照知渔「电商海报设计」这一页的写法 —— 三档「1K 标准 / 2K 高清 / 4K 超清」 */
      clarityField(),
    ],
    cases: [
      { id: 'tide', title: '潮汐标本 · 海岸线上的时间档案', cover: '/images/visual-recipes/cases/poster-tide-exhibition.png' },
    ], history: true,
  },
  {
    id: 'image.social_cover', board: 'image', name: '社媒封面', category: '创意应用', complexity: 'simple',
    cover: { template: 'poster-style', accent: 'accent' },
    summary: '缩略图里也看得清主题', pipeline: 'visualCreation', availability: 'ready',
    visual: 'social-cover',
    brief: '做一张社媒封面。主题：{{topic}}。画面：{{prompt}}。要求：缩到手机缩略图仍能一眼看懂主题，构图紧凑、焦点明确、留出安全的标题区；不要堆砌元素，不要出现二维码或水印。',
    fields: [
      { key: 'topic', label: '主题', kind: 'text', required: true },
      { key: 'prompt', label: '描述', kind: 'textarea', rows: 3 },
      ratioField(),
      { key: 'count', label: '数量', kind: 'stepper', min: 1, max: 6 },
    ],
    cases: [], history: true,
  },
  {
    featuredRank: 1,
    id: 'image.product_suite', board: 'image', name: '商品套图', category: '精品推荐', complexity: 'heavy',
    /* 批 J-⑭：这三条是**预览型**（竞品对应 CTA 也是「生成预览」）。
       previewStep = 点主按钮**先出预览、确认后才真出图扣费**。 */
    previewStep: true,
    /* 一键解析（照竞品做法：付费前置动作）。我们用现成的 /api/ecommerce/auto-recognize
       （视觉识别 + LLM 结构化），计费 SKU 是既有的 ec_ai_assistant = 200 units = **0.2 积分**，
       与竞品的 0.20 积分一致。fills 指向它回填哪个字段。 */
    parse: { fills: 'productParams', label: '一键解析商品信息' },
    cover: { template: 'case-3up', accent: 'warm' },
    summary: '主图、场景图、卖点图成套交付', pipeline: 'ecommerceSuite', availability: 'ready',
    visual: 'free',
    /* 批 CY-㉓：接上 `styleFields()` 给的那几格。
       事故经过（这次是我自己的疏漏，被用户一句「风格选择还有什么意义」问出来的）：
       这条 brief 从来**没有**读过 style/styleNote/styleBrief ——
       而界面上「产品卖点与设计风格」整组控件都在（爆款风格/参考·自定义/AI推荐 三个档
       + 两个文字框）。用户选完、写完、点生成、扣了钱，**模型一个字都没收到**。
       批 DC 续-8 恢复那个输入框时，我只对齐了**外观**，没查它的值去了哪。
       ⇒ 三段全部用**可选段**接上：没填就整段消失（否则空标签会变成「风格要求：」喂给模型）。 */
    brief: '围绕商品生成一套电商图。商品信息：{{productParams}}。目标市场：{{market}}；画面内文案语言：{{language}}。要求：先确保商品本身的结构、颜色、材质与文字被完整保留，再谈场景与氛围；符合{{platform}}的图片规范与目标市场的审美习惯。{{?style}}风格取向：{{style}}。{{/style}}{{?styleBrief}}风格要求：{{styleBrief}}。{{/styleBrief}}{{?styleNote}}设计要求：{{styleNote}}。{{/styleNote}}',
    /* 字段顺序 = 竞品实测顺序：上传图片 → 目标市场 → 目标平台 → 文案语言 →
       产品卖点与设计风格。分组名也照他们的区块名。 */
    fields: [
      /* ═══ 2026-09-19 批 O-⑨：**上传位并回「基础信息」组**（照知渔的分组结构）═══════════
         依据：知渔 ?tool=product-listing-set 实测（CDP 全文，docs/design/67 §2）左栏是
           「**基础信息**」【上传图片 0/6 → 目标市场 9 → 目标平台 5 → 文案语言 14】
           →「产品卖点与设计风格」→「套图结构配置」
         —— 上传位在**基础信息组里面**，不是独立的一组。
         我们原来把它单独拎出来当第一组，于是分组顺序与他们差一组（多一个「上传图片」头）。
         ⚠️ 上传位的 label 仍是「素材」（我们自己叫得顺），但**归组**必须与他们一致 ——
            分组是布局（要一模一样），字段名是文案（可以不一样）。 */
      /* ═══ 2026-09-19 批 Q：标题照知渔叫「上传图片」（他们那一页的字段标题就是这四个字），
         计数 0/6 由渲染器放在标题行右端；框内文案与两颗按钮由渲染器统一渲染（见 FieldRenderer）。 */
      { key: 'assets', label: '上传图片', longLabelReason: '照知渔原文逐字：他们这一页的字段标题就叫「上传图片」',
        kind: 'upload', group: '基础信息', required: true, maxImages: 6, role: 'product',
        slotLabel: '上传商品图', hint: '商品图会作为一组打包参考，最多 6 张' },
      marketField(MARKET_SUITE),
      /* ═══ 批 Q：目标平台 + 文案语言 **同一排**（知渔实测 212 + 13 + 212 = 437）══════════
         用户批注 #2-6：「这两个东西是在同一排的，你为什么要做成两排呢？……右边一大片全是白色的。」 */
      { ...platformField(PLATFORM_SUITE), span: 'half' },
      { ...languageField('文案语言', LANGUAGE_FULL.concat([{ value: '无文字', label: '无文字' }])), span: 'half' },
      /* ⚠️ 商品参数的真实 key 是 productParams（buildSuiteRun 从它的**第一行**取商品名），
         只有界面 label 改成竞品那份措辞 —— 改 key 会让套图拿不到商品名。 */
      { key: 'productParams', label: '产品卖点', kind: 'textarea', rows: 5, group: '产品卖点与设计风格', maxLength: 2000,
        placeholder: '产品名：\n核心卖点：\n适用人群：\n期望场景：\n尺寸参数：' },
      ...styleFields('产品卖点与设计风格'),
      /* 结构/规格是套图专有的重配置：默认按平台智能匹配，自定义面板在套图工作台里 ——
         这里如实说明，不做一个点了没反应的按钮 */
      /* ═══ 套图结构配置（2026-09-19 用户批注 #12 / #13 逐条照竞品）══════════════════════
         批注 #12：「你看它下面是什么东西？下面明明是智能匹配和自定义配置呀，你搞的是什么呀」
         批注 #13：「而且自定义配置选中之后，里面还有其他的配置可以做呀，这些你都没深度的调研吗」
         竞品实测：两张**大卡**（不是下拉、不是说明行）——
           · 智能匹配：AI智能分析商品图，匹配合适的 Listing 套图
           · 自定义配置：可自由调整各类型图片数量，至少选择 7 张
         选中「自定义配置」→ 下面展开按类型的张数步进器（他们：白底图 1 / 场景图 3 / 卖点图 3 /
         其他 0，末尾一行「当前共 7 张，至少 7 张」）。
         ⚠️ 与竞品的一处**有意差异**：他们的类型叫「白底图 / 场景图 / 卖点图 / 其他」，
            我们的类型由方案真源 IMAGE_TYPES 决定（白底首图 / 商品主图 / 透明 PNG / 详情图）——
            张数与报价都按这四个类型算，抄他们的名字会让面板与服务端方案对不上（钱的事）。 */
      /* 批 Q：hideLabel —— 知渔那一组只有**组标题「套图结构配置」+ 两张卡**，
         卡片上面没有第二个标题（我们原来多一行「套图结构」，就是多出来的东西）。
         label 仍然要写：声明契约要求非空、读屏也用它，只是**不画出来**。 */
      { key: 'structure', label: '套图结构', hideLabel: true, kind: 'cards', group: '套图结构配置', default: '智能匹配',
        /* ═══ 批 Q：说明文字**放进卡里**（知渔就是这么摆的），不要在卡下面另起一段 ═══════════
           用户批注 #3-3：「你不需要把这些说明写出来的，没有意义呀……他们也没有做这些呀」 */
        options: [
          { value: '智能匹配', label: '智能匹配', hint: 'AI智能分析商品图，匹配合适的 Listing 套图' },
          { value: '自定义配置', label: '自定义配置', hint: '可自由调整各类型图片数量，至少选择 7 张' },
        ] },
      /* ⚠️ 2026-09-19 批 G：这一组此前**只是显示**（没有消费者、没有默认值、没有校验），
          用户看到的是一排 0 且改了不影响出图 —— 典型的「装出来的功能」。本轮三处一起补：
            ① 每行给 default（白底 1 / 主图 3 / 透明 1 / 详情 2 = **7 张**，与竞品「至少 7 张」同档）；
            ② minTotal 提到 7，合计不足时 validateSkillInput 会拦住 CTA 并说明差多少；
            ③ skillRun.buildSuiteRun 把它当套图的图集来源（张数/报价/服务端方案三者同源）。 */
      { key: 'structureCounts', label: '各类型张数', kind: 'counts', group: '套图结构配置',
        visibleWhen: { key: 'structure', equals: '自定义配置' },
        required: true,
        minTotal: 7,
        /* 批 Q：每行去掉我们自己加的那句 hint —— 知渔那四行（白底图 / 场景图 / 卖点图 / 其他）
           只有类型名与 −/+，没有说明（用户批注 #3-5：「不要过多的添加其他的文案上去」）。 */
        rows: [
          { key: 'white_bg', label: '白底首图', max: 3, default: 1 },
          { key: 'main_text', label: '商品主图', max: 5, default: 3 },
          { key: 'transparent', label: '透明 PNG', max: 3, default: 1 },
          { key: 'detail', label: '详情图', max: 6, default: 2 },
        ] },
      /* ═══ 批 Q：删掉「规格」这一格 ═══════════════════════════════════════════════════
         用户批注 #3-5：「下面这些规格什么的，这些说明也完全没有意义，竞争对手没有的东西，
           我们就不要乱做，你明白吗？……只有文案上面你可以改变一下表述，
           但是你不要过多的添加其他的文案上去。」—— 知渔这一页没有「规格」字段。 */
    ],
    cases: [
      { id: 'scene', title: '场景卖点主图', cover: '/gallery/ecommerce/stainless-steel-sauce-container/01.webp' },
      { id: 'usage', title: '真实使用详情图', cover: '/gallery/ecommerce/stainless-steel-sauce-container/02.webp' },
      { id: 'size', title: '尺寸对比详情图', cover: '/gallery/ecommerce/stainless-steel-sauce-container/03.webp' },
    ], history: true,
  },

  {
    featuredRank: 2,
    id: 'image.aplus', board: 'image', name: 'A+内容', category: '精品推荐', complexity: 'standard',
    /* 批 J-⑭：这三条是**预览型**（竞品对应 CTA 也是「生成预览」）。
       previewStep = 点主按钮**先出预览、确认后才真出图扣费**。 */
    previewStep: true,
    parse: { fills: 'product', label: '一键解析商品信息' },
    cover: { template: 'case-3up', accent: 'accent' },
    summary: '图文并排的模块图，把卖点讲清楚', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'poster',
    /* 批 CY-㉓：`styleBrief`（AI推荐风格选择）与 `styleNote`（设计要求）两个文字框
       一直没有进这条 brief —— 界面上有、用户能写、内容到了提交那一刻被丢掉。
       两者都是可选，用**可选段**接：没填整段消失。 */
    brief: '做一套 A+ 内容模块图。商品与卖点：{{productParams}}。设计风格：{{style}}。{{?styleBrief}}风格要求：{{styleBrief}}。{{/styleBrief}}{{?styleNote}}设计要求：{{styleNote}}。{{/styleNote}}目标市场：{{market}}；目标平台：{{platform}}；画面内文案语言：{{language}}。要求：横向构图，图文并排（左图右文或上图下文），信息层级清楚、留出安全的文字区；画面内的文字必须逐字准确，不得臆造文案、参数、认证标识或 logo；商品本身的结构、颜色、材质与包装文字必须完整保留。',
    /* 字段顺序与措辞照竞品 A+ 页实测：上传图片 → 目标市场 → 目标平台 → 输出语言 →
       产品卖点与设计风格（核心卖点 + 爆款风格）。 */
    fields: [
      uploadField({ maxImages: 6, group: '基础信息' }),
      marketField(MARKET_WIDE),
      /* 批 Q：目标平台 + 输出语言**同一排**（与商品套图同一口径；知渔实测 212 + 13 + 212） */
      { ...platformField(PLATFORM_WIDE), span: 'half' },
      { ...languageField('输出语言', LANGUAGE_FULL), span: 'half' },
      { key: 'productParams', label: '核心卖点', kind: 'textarea', rows: 5, group: '产品卖点与设计风格', required: true,
        placeholder: '产品名：\n核心卖点：\n适用人群：\n期望场景：\n尺寸参数：' },
      /* ═══ 2026-09-19 批 Q：两档各自的**内容**照知渔深度点击实测 ═══════════════════════════
         实测（.tmp/qy-deepclick-theirs3.mjs）：
           · 选「爆款风格」   → 下面出现 **「AI推荐风格选择」**（AI 分析的结论栏）
           · 选「参考/自定义风格」→ 下面出现 **「风格/排版参考图（可选）0/5」上传框 + 「设计要求」文本框**
         我们上一版只有一个「自定义风格要求」挂在第二档上，第一档点开是空的（用户批注 #3-2）。 */
      { key: 'style', label: '爆款风格', kind: 'segmented', group: '产品卖点与设计风格', default: '爆款风格',
        options: [
          { value: '爆款风格', label: '爆款风格' },
          { value: '参考/自定义风格', label: '参考/自定义风格' },
        ] },
      /* 批 I-8：切到「参考/自定义风格」要有东西换出来（用户批注 #2-1 指着竞品那句
         「他这里切换过来是有上传区和设计要求这些元素的呀」）。
         竞品那边换出来的是「风格/排版参考图（0/5）」上传区 + 「设计要求」输入框；
         我们这一条技能本来就有上传位与自定义要求这两个字段，只是**原来没有跟切换联动**，
         所以点上去像死按钮。这里把「自定义风格要求」挂到这一档上。 */
      { key: 'styleRef', label: '风格/排版参考图（可选）',
        longLabelReason: '照知渔原文逐字：点「参考/自定义风格」之后出现的上传位就叫「风格/排版参考图（可选）」',
        kind: 'upload', group: '产品卖点与设计风格', maxImages: 5, role: 'reference',
        visibleWhen: { key: 'style', equals: '参考/自定义风格' },
        slotLabel: '上传参考图', hint: '上传你想参考的排版与风格，最多 5 张' },
      { key: 'styleNote', label: '设计要求',
        longLabelReason: '照知渔原文逐字：点「参考/自定义风格」之后出现的文本框标题就叫「设计要求」',
        kind: 'textarea', rows: 3, group: '产品卖点与设计风格',
        visibleWhen: { key: 'style', equals: '参考/自定义风格' },
        placeholder: '参考哪一套排版/风格，或直接写要求：奶油白背景、柔光棚拍、右上角留白放标题' },
      { key: 'styleBrief', label: 'AI推荐风格选择',
        longLabelReason: '照知渔原文逐字：选「爆款风格」时下面那一栏就叫「AI推荐风格选择」',
        kind: 'textarea', rows: 3, group: '产品卖点与设计风格',
        visibleWhen: { key: 'style', equals: '爆款风格' },
        /* 批 DC 续-8：与 styleFields 里的 styleBrief 同一条处置 —— 框**一直在**，
           AI 的结论写进去、用户随时能改（理由与用户原话见 styleFields 那段）。
           ⚠️ 竞品实采（docs/design/data/quantv-image-builtin-pages.json:46）里这一栏就叫
             「AI推荐风格选择」，且在分析之前就渲染在页面上。
           批 DC 续-16：加 `gatedByAction` 走**锁住态**（空 ⇒ 只读 + 按钮浮在表面；
           非空 ⇒ 可编辑）。完整口径、以及那句「结论一直都进了 brief」的更正，见 styleFields 那段。 */
        gatedByAction: 'style-analysis',
        gatedPlaceholder: 'AI 分析完会把结论写在这里，写完可以直接改',
        placeholder: 'AI 分析完会把结论写在这里，写完可以直接改' },
      /* ═══ 2026-09-19 批 I-10：这里**删掉了整块「生成设置」（比例 + 数量）**══════════════════
         用户批注 #3-2 原话：「而且这个**生成设置又是什么鬼**啊，**人家没有这个呀**，
           选中多少个模块就是多少张，并且对应他自己的模块主题不是吗，
           为什么要自己写多少张的数量呢？**比例的话我不懂，这个你要深度对比竞品和自己的skill去决定吧**。」
         我按用户的要求去对比了 —— **证据在我们自己的拆解文档里**（docs/design/50 第 214 行，
         CDP 实访竞品的 A+ 页）：竞品 A+ 的字段只有
           「目标市场 13 档 · 输出语言 14 档 · 包含模块 已选 0/16 · 爆款风格两档」
         —— **没有比例，也没有生成数量**。
         （同文档第 144 行的「生成设置 · 比例 16 档」是**另一个**页面（图片复刻）的，
           不是 A+ 的。所以"竞品有没有比例"这件事要按页面分开看，不能一刀切。）
         为什么 A+ 可以不要比例：这一套是 **16 个模块各自成图**，比例由模块自己的主题决定
         （首屏主视觉 / 卖点图 / 场景图 各有各的构图），给一个"全套统一比例"的旋钮本来就是假的。
         数量上一批已经删了（勾几个模块出几张）。
         ⚠️ 内部仍按 skillGenerationSettings 的默认值 1:1 下发 —— 服务端白名单之外的值会被
            **静默回落**，所以宁可留一个已知合法的默认，也不能让请求带空值。
         ⚠️ **只改 A+**：其它技能的比例档位不动（竞品别的页面确实有比例，见 50 号文档 144/183 行）。 */
    ],
    /* ═══ 「包含模块」：竞品 A+ 页那 16 条，**逐条原文**照抄（名称 + 它自己那句说明）═══
       实测来源见 docs/design/50-quantv-subpage-field-spec.md（CDP 实访，一次一标签）。
       他们那边是**可勾选**的（已选 0/16，勾几个出几个、价钱跟着变）；
       我们的张数与报价由方案算死（服务端建 hold 前会校验报价），照抄成可勾选会让
       报价与产出对不上 —— 这是钱的问题，所以做成**只读**清单（RTK 批次三十六已定性，
       门禁 test/workbench-quantv-parity-0918 第 ④ 条守着"不许照抄可勾选模块"）。
       清单内容与顺序照他们的 16 条，一条不少。 */
    modules: [
      { name: '首屏主视觉', hint: '传递核心价值' },
      { name: '核心卖点图', hint: '突出差异化优势' },
      { name: '使用场景图', hint: '呈现真实使用场景' },
      { name: '多角度图', hint: '多角度呈现外观' },
      { name: '场景氛围图', hint: '展示使用场景' },
      { name: '商品细节图', hint: '放大材质与工艺' },
      { name: '品牌故事图', hint: '传达品牌理念' },
      { name: '尺寸/容量/尺码图', hint: '展示规格信息' },
      { name: '效果对比图', hint: '使用前后效果对比' },
      { name: '详细规格/参数表', hint: '展示详细商品数据' },
      { name: '工艺制作图', hint: '展示工艺制作过程' },
      { name: '配件/赠品图', hint: '明确收货的所有物品' },
      { name: '系列展示图', hint: '多色或多SKU展示' },
      { name: '商品成分图', hint: '展示配方/材质/成分' },
      { name: '售后保障图', hint: '说明质保退换政策' },
      { name: '使用建议图', hint: '商品使用的注意事项' },
    ],
    /* 示例区的编号清单照竞品 A+ 页实测：01 功能总览图 02 技术细节图 03 生活方式图
       04 品牌主视觉 05 场景展示图 06 品牌故事图 */
    deliverables: [
      { name: '功能总览图', hint: '把产品的几项核心功能一次讲完' },
      { name: '技术细节图', hint: '放大结构、材质与做工' },
      { name: '生活方式图', hint: '放进真实使用场景' },
      { name: '品牌主视觉', hint: '统一的品牌调性与留白' },
      { name: '场景展示图', hint: '把商品放进它真正被使用的环境' },
      { name: '品牌故事图', hint: '讲清这个品牌为什么做这件产品' },
    ],
    cases: [], history: true,
  },
  {
    featuredRank: 3,
    id: 'image.detail_page', board: 'image', name: '详情图', category: '精品推荐', complexity: 'standard',
    /* 批 J-⑭：这三条是**预览型**（竞品对应 CTA 也是「生成预览」）。
       previewStep = 点主按钮**先出预览、确认后才真出图扣费**。 */
    previewStep: true,
    parse: { fills: 'product', label: '一键解析商品信息' },
    cover: { template: 'poster-style', accent: 'warm' },
    summary: '首屏、卖点、成分、参数，逐屏出图', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'poster',
    /* 批 CY-㉓：同 aplus —— `styleBrief` / `styleNote` 两个文字框一直没有进这条 brief。
       ⚠️ 详情图的默认档是 9:16（imageSkills.js:861 记着「保留固定竖版 9:16，不给自适应」，
          依据是 `ecommercePlanModel.js:67 defaultRatio:'9:16'` 与 brief 里写明的竖版长图），
          **本批不动那个默认档** —— 那是另一个话题，用户 9-29 单独判过。 */
    brief: '做一套电商详情页的模块图。商品与卖点：{{productParams}}。风格取向：{{style}}。{{?styleBrief}}风格要求：{{styleBrief}}。{{/styleBrief}}{{?styleNote}}设计要求：{{styleNote}}。{{/styleNote}}目标市场：{{market}}；目标平台：{{platform}}；画面内文案语言：{{language}}。要求：竖版长图构图，信息层级清楚（标题 → 主图 → 说明），阅读顺序自然；画面内文字逐字准确、不臆造；商品的结构、颜色、材质与包装文字必须完整保留。',
    /* 字段顺序与措辞照竞品详情图页实测：上传图片 → 目标市场 → 目标平台 → 输出语言 →
       产品卖点与设计风格（核心卖点 + 爆款风格）。 */
    fields: [
      uploadField({ maxImages: 6, group: '基础信息' }),
      marketField(MARKET_WIDE),
      /* 批 Q：目标平台 + 输出语言**同一排**（与商品套图同一口径；知渔实测 212 + 13 + 212） */
      { ...platformField(PLATFORM_WIDE), span: 'half' },
      { ...languageField('输出语言', LANGUAGE_FULL), span: 'half' },
      { key: 'productParams', label: '核心卖点', kind: 'textarea', rows: 5, group: '产品卖点与设计风格', required: true,
        placeholder: '建议包含以下信息生成更精准：\n1.产品名称\n2.核心卖点\n3.适用人群\n4.期望场景\n5.尺寸参数' },
      { key: 'style', label: '爆款风格', kind: 'segmented', group: '产品卖点与设计风格', default: '爆款风格',
        options: [
          { value: '爆款风格', label: '爆款风格' },
          { value: '参考/自定义风格', label: '参考/自定义风格' },
        ] },
      /* ═══ 2026-09-19 批 Q：两档各自的**内容**（照知渔详情图页深度点击实测）══════════════════
         · 爆款风格   → 「AI推荐风格选择」（分析结论栏，可改）
         · 参考/自定义风格 → 「风格/排版参考图（可选）0/5」+「设计要求」
         上一版这一条**两档点开都是空的**（用户批注 #3-2：「这两个按钮现在打开里面都是空的」）。 */
      { key: 'styleRef', label: '风格/排版参考图（可选）',
        longLabelReason: '照知渔原文逐字：点「参考/自定义风格」之后出现的上传位就叫「风格/排版参考图（可选）」',
        kind: 'upload', group: '产品卖点与设计风格', maxImages: 5, role: 'reference',
        visibleWhen: { key: 'style', equals: '参考/自定义风格' },
        slotLabel: '上传参考图', hint: '上传你想参考的排版与风格，最多 5 张' },
      { key: 'styleNote', label: '设计要求',
        longLabelReason: '照知渔原文逐字：点「参考/自定义风格」之后出现的文本框标题就叫「设计要求」',
        kind: 'textarea', rows: 3, group: '产品卖点与设计风格',
        visibleWhen: { key: 'style', equals: '参考/自定义风格' },
        placeholder: '参考哪一套排版/风格，或直接写要求：奶油白背景、柔光棚拍、右上角留白放标题' },
      { key: 'styleBrief', label: 'AI推荐风格选择',
        longLabelReason: '照知渔原文逐字：选「爆款风格」时下面那一栏就叫「AI推荐风格选择」',
        kind: 'textarea', rows: 3, group: '产品卖点与设计风格',
        visibleWhen: { key: 'style', equals: '爆款风格' },
        /* 批 DC 续-8：与 styleFields 里的 styleBrief 同一条处置 —— 框**一直在**，
           AI 的结论写进去、用户随时能改（理由与用户原话见 styleFields 那段）。
           ⚠️ 竞品实采（docs/design/data/quantv-image-builtin-pages.json:46）里这一栏就叫
             「AI推荐风格选择」，且在分析之前就渲染在页面上。
           批 DC 续-16：加 `gatedByAction` 走**锁住态**（空 ⇒ 只读 + 按钮浮在表面；
           非空 ⇒ 可编辑）。完整口径、以及那句「结论一直都进了 brief」的更正，见 styleFields 那段。 */
        gatedByAction: 'style-analysis',
        gatedPlaceholder: 'AI 分析完会把结论写在这里，写完可以直接改',
        placeholder: 'AI 分析完会把结论写在这里，写完可以直接改' },
      /* ⚠️ 2026-09-29 批 DC 续-9：详情图**保留固定默认 9:16**，不走自适应
         （用户 2026-09-29 逐字：「detail_page 的竖版都有实测依据，就不要自适应呀」）。
         依据是**本仓自己的电商侧**，不是"我觉得竖版好看"：
           · src/pages/Home/ec/ecommercePlanModel.js:67 `defaultRatio: '9:16'`，
             且 :159 起每一个详情图模块都是 `ratio: '9:16'`；
           · src/pages/EcCanvas/canvasState.js:48-53 六个 detail_slice_* 模块**逐个** 9:16；
           · src/pages/Home/ec/promptSizeConflict.js:17 把「竖版|长图|手机全屏」直接判成 9:16。
         改自适应会让这一页的默认档与它自己 brief 产出的那套方案**互相矛盾**
         （页面说 1:1、方案里全是 9:16）—— 那正是「看着是 A、跑的是 B」。 */
      { ...ratioField(), default: '9:16' },
      countField(6),
    ],
    /* 竞品详情图页的示例清单是「01 高效率销售转化详情页 02 场景氛围与情感共鸣详情页
       03 医学专研与极简信任详情页 04 产品规格参数图」——我们按单屏模块如实列。 */
    deliverables: [
      { name: '高效率销售转化详情页', hint: '首屏把卖点与购买理由说清' },
      { name: '场景氛围与情感共鸣详情页', hint: '把商品放进生活场景' },
      { name: '成分 / 材质说明详情页', hint: '讲清配方、材质与工艺' },
      { name: '产品规格参数图', hint: '尺寸、容量、型号一览' },
    ],
    cases: [], history: true,
  },

  /* ── 库里的爆款配方（第二批，2026-09-17）──────────────────────────────────
     全部来自 EvoLinkAI/awesome-gpt-image-2-API-and-Prompts（17,199★）的电商 / 广告创意用例，
     每条 brief 都是**照那条用例的原文结构**写的中文版（出处登记在 skillSources.js，
     原文提示词与自带素材在 docs/design/skill-recipe-library.json）。 */
  {
    id: 'image.live_ui', board: 'image', name: '直播带货主图', category: '电商专区', complexity: 'standard',
    cover: { template: 'poster-style', accent: 'accent' },
    summary: '一张图做出直播间的界面感', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'poster',
    brief: '做一张直播带货主图（界面感）：画面主体是主播举着{{product}}对着镜头介绍，笑容自然、眼神看镜头；左右两侧是品牌色块与{{brand}}字样，底部压一条促销信息条，右上角留出人气/点赞的数字位。整体像直播截屏但更精致，画面内文字逐字准确、不得臆造价格与销量数字。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 3, role: 'product', slotLabel: '上传商品图' },
      { key: 'product', label: '商品名', kind: 'text', required: true },
      { key: 'brand', label: '品牌名', kind: 'text', required: true, placeholder: '出现在画面两侧的字' },
      ratioField(),
      { key: 'count', label: '数量', kind: 'stepper', min: 1, max: 4 },
      /* 批 O-六：补「分辨率」—— 知渔这一页有这一档，我们原来没有 */
      clarityField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.callout_diagram', board: 'image', name: '卖点标注图解', category: '电商专区', complexity: 'standard',
    cover: { template: 'case-3up', accent: 'warm' },
    summary: '一根根引线把成分与卖点标出来', pipeline: 'visualCreation', availability: 'ready',
    visual: 'poster',
    brief: '做一张卖点标注图解：主视觉是{{product}}，画面描述：{{prompt}}。字体：{{font}}。要求：用细引线连到要强调的部位、每条引线配一行短标注，标注排版整齐、指向准确、字号统一，背景干净；画面内文字逐字准确，不得臆造数据与认证标识。',
    /* ═══ 2026-09-19 批 O-⑥：字段逐个照知渔（5 → 6）══════════════════════════════════════
       知渔「爆款商品文字海报」逐字：
         主题 [singleText 必填 help="海报上的标题文字"] · 上传产品图 [file **可选**] ·
         画面描述 [multiText 必填 ph="补充画面描述，让画面更丰富"] · 字体 [radio 必填 6 档] ·
         生成尺寸 [radio 必填 7 档] · 分辨率 [select 必填 1K标准/2K高清/4K超清]
       ⇒ 我们多一格「标注点」、少一格「字体」；而且他们的产品图是**可选**（不上传就靠描述写）。
          按他们改：主题 / 上传产品图（可选）/ 画面描述 / 字体 / 比例 / 分辨率。 */
    fields: [
      /* 批 Q：去掉我们自己加的 placeholder —— 知渔「爆款商品文字海报」那一格没有占位文案
         （用户：「竞争对手没有的东西，我们就不要乱做……不要过多的添加其他的文案上去」）。 */
      { key: 'product', label: '主题', kind: 'text', required: true, group: '主题与画面' },
      { key: 'assets', label: '上传产品图', kind: 'upload', maxImages: 1, role: 'product', group: '主题与画面', slotLabel: '上传商品图（可选，不上传就按描述画）' },
      { key: 'prompt', label: '画面描述', kind: 'textarea', rows: 3, required: true, group: '主题与画面', placeholder: '补充画面描述，让画面更丰富' },
      /* 批 P：知渔这一页的「字体」是**必填**（optional=false），我们原来没标必填 —— 照他们标上 */
      { key: 'font', label: '字体', kind: 'segmented', required: true, group: '主题与画面', options: [
        { value: '书法体', label: '书法体' }, { value: '无衬线体', label: '无衬线体' },
        { value: '霓虹灯字', label: '霓虹灯字' }, { value: '书写体', label: '书写体' },
        { value: '哥特体', label: '哥特体' }, { value: '自定义', label: '自定义' },
      ] },
      /* 批 P：他们这一格的标题是「生成尺寸」（不是「比例」）—— 文案照他们 */
      ratioField(RATIO_SIZED, '生成尺寸'),
      clarityField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.giant_product', board: 'image', name: '巨型产品广告', category: '电商专区', complexity: 'standard',
    cover: { template: 'poster-style', accent: 'accent' },
    summary: '把人放进巨型商品的尺度里', pipeline: 'visualCreation', availability: 'ready',
    visual: 'poster',
    brief: '极简商业广告：把{{subject}}放大成巨型装置，人物以自然姿态倚靠或站在它旁边形成尺度反差；单色渐变背景，镜面地板带柔和反射，棚拍光干净通透。画面要有一个明确的视觉焦点，空间关系可信，光线有来处；商品细节与包装文字必须清晰可辨。',
    /* ═══ 2026-09-19 批 O-⑥：字段逐个照知渔（6 → 4）══════════════════════════════════════
       知渔「夏季蔬果巨物场景化摄影」的 inputConfigs 逐字：
         蔬菜水果名字 [singleText 必填] · 替换指令 [multiText **hidden:true**] · 比例 [3:2/4:3/16:9] · 清晰度 [1K标清/2K高清/4K超清]
       我们原来是 素材/商品名/品牌字/比例/数量/分辨率 —— **多了两个他们没用的（品牌字、数量）**，
       而且他们的第一个字段是「蔬菜水果名字」（一个名字输入），不是上传位。按他们改。
       ═══ 2026-09-19 批 P：再核一层 —— **「替换指令」在知渔是 hidden:true** ═══════════════════
       逐页实采（docs/design/data/quantv-image-pages.json）里这一页左栏只有三格：
         蔬菜水果名字 * | 比例 * 3:2 4:3 16:9 | 清晰度 * 1K标清 2K高清 4K超清
       「替换指令」根本没渲染（他们拿它当内置提示词，不让用户改）。我们照抄成可见输入框是错的：
       用户会以为"这段长文案是我要写的"。⇒ 删掉这一格；比例收成他们那 3 档；清晰度照他们写「标清」。 */
    fields: [
      { key: 'subject', label: '蔬菜水果名字', longLabelReason: '照知渔原文逐字：他们这一页的第一个字段名就叫「蔬菜水果名字」（这是一个纯文本输入，不是上传位）',
        kind: 'text', required: true, group: '主题' },
      /* ⚠️ 2026-09-29 批 DC 续-9：**这一条保留固定默认 3:2，不走自适应**（用户 2026-09-29 逐字：
         「giant_product 的 3:2 和 detail_page 的竖版都有实测依据，就不要自适应呀。
           我都说了，**你需要有比例预设的就不要自适应**呀。」）
         依据不是"我觉得横版好看"，是**逐页实采**：知渔这一页的比例只有 3:2 / 4:3 / 16:9 三档
         （上面那段注释是原文），而 brief 要的是「巨型装置 + 尺度反差 + 镜面地板」的**横版商业广告** ——
         竖版装不下这种空间关系。全站只有这一条的比例是**收窄到 3 档**的，那就是"有比例预设"的样子。 */
      { ...ratioField([
        { value: '3:2', label: '3:2' },
        { value: '4:3', label: '4:3' },
        { value: '16:9', label: '16:9' },
      ]), default: '3:2' },
      clarityField({ label: '清晰度', options: [
        { value: '1K', label: '1K标清' },
        { value: '2K', label: '2K高清' },
        { value: '4K', label: '4K超清' },
      ] }),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.liquid_logo', board: 'image', name: '液态 Logo 海报', category: '创意应用', complexity: 'standard',
    cover: { template: 'poster-style', accent: 'cool' },
    summary: '品牌 logo 变成一滩会流动的液体', pipeline: 'visualCreation', availability: 'ready',
    visual: 'brand-kv',
    brief: '做一张品牌主视觉：{{brand}}的 logo 变成一滩有体积的液态物质——**轮廓必须仍然是品牌 logo 本身**（不是圆形、不是随便一团），表面有水珠与飞溅细节；周围是动态水花，背景压一行巨大的{{brand}}字，整体像高定时尚大片。画面里的字样必须逐字准确。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 1, role: 'reference', slotLabel: '上传品牌 logo 或主视觉参考' },
      { key: 'brand', label: '品牌名', kind: 'text', required: true },
      ratioField(),
      /* 批 O-六：补「分辨率」—— 知渔这一页有这一档，我们原来没有 */
      clarityField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.landscape_logo', board: 'image', name: '地景 Logo 幻象', category: '创意应用', complexity: 'standard',
    cover: { template: 'poster-style', accent: 'cool' },
    summary: '品牌形状藏进山川地貌里', pipeline: 'visualCreation', availability: 'ready',
    visual: 'brand-kv',
    brief: '做一张"潜意识广告"风景照：把{{brand}}的标志形状**藏进自然地貌本身**——由山脊、沙丘、海岸或雪原的走势自然构成，看起来像地形巧合，不是后期贴上去的图案；光线是自然环境光，画面里不出现任何文字与 logo 贴图。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 1, role: 'reference', slotLabel: '上传品牌标志参考（可选）' },
      { key: 'brand', label: '品牌名', kind: 'text', required: true },
      ratioField(),
      /* 批 O-六：补「分辨率」—— 知渔这一页有这一档，我们原来没有 */
      clarityField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.sticker_collage', board: 'image', name: '贴纸现实拼贴', category: '创意应用', complexity: 'simple',
    cover: { template: 'before-after', accent: 'soft' },
    summary: '在原图上贴满手绘贴纸与便签', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'free',
    /* 批 CY-㉓：`notes`（便签内容，如「NEW / 限时 / 主推款」）从来没有进过这条 brief ——
       用户写了想让贴纸上出现这些字，模型压根不知道。 */
    brief: '保持照片的主体、构图与背景**完全不动**，把它改造成"贴纸现实"拼贴：在画面上叠一层像实体贴纸、纸片剪贴与胶带便签的元素，位置略带错位与重叠，像手工剪贴簿；再混入手绘涂鸦（图标、箭头、下划线）。贴纸边缘要有真实投影。{{?notes}}便签上写这些字：{{notes}}。{{/notes}}',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 1, role: 'reference', slotLabel: '上传要改造的照片' },
      { key: 'notes', label: '便签内容', kind: 'textarea', rows: 2, placeholder: '例如：NEW / 限时 / 主推款' },
      ratioField(),
      /* 批 O-六：补「分辨率」—— 知渔这一页有这一档，我们原来没有 */
      clarityField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.showroom_still', board: 'image', name: '展厅静物主视觉', category: '创意应用', complexity: 'standard',
    cover: { template: 'hero-single', accent: 'neutral' },
    summary: '限定发售那种高级静物台面', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'brand-kv',
    brief: '做一张"展厅静物"主视觉，用来宣布限定发售：把{{product}}放在几何台面上，周围配少量呼应品牌的实物道具（{{props}}），背景是干净的展台墙面与柔和的顶光；配色以品牌色为主，构图克制、留白充足，像高端杂志的静物大片。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 2, role: 'product', slotLabel: '上传商品图' },
      { key: 'product', label: '商品名', kind: 'text', required: true },
      { key: 'props', label: '道具', kind: 'text', placeholder: '例如：金属托盘、亚克力方块、干花' },
      ratioField(),
      /* 批 O-六：补「分辨率」—— 知渔这一页有这一档，我们原来没有 */
      clarityField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.tropical_poster', board: 'image', name: '热带饮品海报', category: '电商专区', complexity: 'standard',
    cover: { template: 'poster-style', accent: 'warm' },
    summary: '夏天汽水那种亮到发光的海报', pipeline: 'visualCreation', availability: 'ready',
    visual: 'poster',
    brief: '做一张热带风饮品海报：{{drink}}居中偏右、略微左倾，瓶身挂满冰凉水珠，内部液体透出光感；背景是明亮的热带色块与水果切片，整体明亮、饱和度高、夏日氛围强，包装上的文字必须清晰准确。',
    /* ═══ 2026-09-19 批 O-⑥：字段逐个照知渔（6 → 3）══════════════════════════════════════
       知渔「极简日系饮品海报」的 inputConfigs 逐字：
         饮料名称 [singleText 必填] · 比例 [7 档] · 清晰度 [2K高清/4K超清]
       我们原来是 素材/商品名/水果元素/标语/比例/分辨率 —— **多三格**（上传位、水果元素、标语）。
       他们的这一页就是"给个名字直接出图"，照他们收成 3 格。 */
    /* ═══ 2026-09-19 批 P：这一页只剩两格 —— 他们的「比例」是 hidden:true ═════════════════
       逐页实采左栏：「饮料名称 * | 清晰度 * 2K高清 4K超清」—— 比例那一格根本没渲染
       （他们把它藏了，出图尺寸由内置提示词定）。我们原来照着 inputConfigs 摆了一格 7 档比例，
       用户选了它却不生效（服务端仍按他们那套出图）—— 就是我们最忌讳的"死控件"。⇒ 去掉。 */
    fields: [
      { key: 'drink', label: '饮料名称', longLabelReason: '照知渔原文逐字：他们这一页的字段名就叫「饮料名称」（纯文本输入，没有上传位）',
        kind: 'text', required: true, group: '主题' },
      clarityField({ label: '清晰度', options: CLARITY_2 }),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.mono_pastel_ad', board: 'image', name: '单色糖果系广告', category: '电商专区', complexity: 'standard',
    cover: { template: 'poster-style', accent: 'soft' },
    summary: '整张一个色，巨型品牌字压阵', pipeline: 'visualCreation', availability: 'ready',
    visual: 'poster',
    brief: '做一张单色系商业海报：整张图只用一个色系（{{tone}}），背景是巨大的{{brand}}无衬线粗体字几乎顶满画面高度，{{product}}放在字前作为视觉焦点，地面是高反光镜面、有柔和倒影；右上角留一小块品牌标位。画面内文字逐字准确、不得臆造。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 1, role: 'product', slotLabel: '上传商品图' },
      { key: 'product', label: '商品名', kind: 'text', required: true },
      { key: 'brand', label: '品牌字', kind: 'text', required: true },
      { key: 'tone', label: '色系', kind: 'segmented', default: '冷调单色', options: [
        { value: '冷调单色', label: '冷调' }, { value: '暖调单色', label: '暖调' },
        { value: '粉调单色', label: '粉调' }, { value: '中性灰', label: '中性' },
      ] },
      ratioField(),
      /* 批 O-六：补「分辨率」—— 知渔这一页有这一档，我们原来没有 */
      clarityField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.grain_ad_board', board: 'image', name: '中式广告板', category: '电商专区', complexity: 'standard',
    cover: { template: 'poster-style', accent: 'warm' },
    summary: '中文排版的电商广告板（一屏讲完）', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'poster',
    brief: '做一张中文电商广告板：{{product}}作为主视觉居右，左侧排中文标题{{title}}与三到四条短卖点（{{points}}），底部一条规格信息带（净含量 / 规格 / 卖点图标）；配色厚重（{{tone}}），中文用粗衬线或黑体、层级分明。所有中文必须逐字准确、笔画完整，不得臆造成分与认证。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 2, role: 'product', slotLabel: '上传商品图 / 包装图' },
      { key: 'product', label: '商品名', kind: 'text', required: true },
      { key: 'title', label: '中文主标题', kind: 'text', required: true, placeholder: '例如：核桃芝麻黑豆粉' },
      { key: 'points', label: '卖点', kind: 'textarea', rows: 3, placeholder: '每行一条短卖点' },
      { key: 'tone', label: '色调', kind: 'segmented', default: '黑金', options: [
        { value: '黑金', label: '黑金' }, { value: '米白', label: '米白' }, { value: '中国红', label: '中国红' },
      ] },
      ratioField(),
      /* 批 O-六：补「分辨率」—— 知渔这一页有这一档，我们原来没有 */
      clarityField(),
    ],
    cases: [], history: true,
  },

  /* ── 电商专区 ─────────────────────────────────────────────────────────── */
  {
    id: 'image.white_bg', board: 'image', name: '白底商品图', category: '电商专区', complexity: 'standard',
    cover: { template: 'hero-single', accent: 'cool' },
    summary: '干净白底，多角度呈现细节', pipeline: 'builtinSkill', availability: 'ready',
    visual: 'free',
    brief: '把商品从原图里抠出来，输出{{mode}}的白底/透明底商品图：商品完整居中、边缘锐利、比例真实，柔和的棚拍光影带出材质与体积感，保留商品自身的颜色、结构与文字；不要添加道具、场景或任何文字。',
    /* ═══ 2026-09-19 批 O-⑥：字段逐个照知渔（4 → 2）══════════════════════════════════════
       知渔「提取电商白底图」逐字只有 **2 格**：
         上传图片（最好是1：1的比例）[file 必填] · 抠图模式 [radio 必填：透明背景 | 白色背景]
       我们原来是 素材/比例/分辨率/数量 —— **多三格**（比例、分辨率、数量他们都没有）。
       ⚠️ 「抠图模式：透明背景 | 白色背景」正是我上一版从「去除背景」删掉的那一档 ——
          它属于**这一页**（知渔把"纯去背"和"去背后选底色"拆成两个页面）。现在归位。
       ⚠️ 这一页的 brief 也随之改成"抠图"语义（原来是"生成白底图"）。 */
    fields: [
      { key: 'assets', label: '上传图片（最好是1：1的比例）',
        longLabelReason: '照知渔原文逐字：他们这一页的上传位标题就叫「上传图片（最好是1：1的比例）」',
        /* 批 P：知渔这一页的上传位是 **maxImages=1**（一次一张），我们原来给了 6 —— 照他们收成 1 */
        kind: 'upload', required: true, maxImages: 1, role: 'product', slotLabel: '上传商品图' },
      { key: 'mode', label: '抠图模式', kind: 'segmented', required: true, group: '输出设置', options: [
        { value: '透明背景', label: '透明背景' }, { value: '白色背景', label: '白色背景' },
      ] },
    ],
    cases: [
      { id: 'white', title: '标准识别白底图', cover: '/gallery/ecommerce/baby-bottle-product-suite/01.webp' },
    ], history: true,
  },
  {
    id: 'image.scene', board: 'image', name: '场景种草图', category: '电商专区', complexity: 'standard',
    cover: { template: 'case-3up', accent: 'warm' },
    summary: '把商品放进真实使用场景', pipeline: 'builtinSkill', availability: 'ready',
    visual: 'free',
    brief: '把商品放进真实使用场景。{{scene}}。商品要保持可辨认的结构、颜色与材质，场景的光线、透视与投影要和商品对得上，像一张真实拍出来的生活照；不要出现文字或水印。',
    /* ═══ 2026-09-19 批 O-⑥：字段逐个照知渔（5 → 4）══════════════════════════════════════
       知渔「商品场景展示」逐字：
         上传商品图 [file 必填] · 修图指令 [multiText 必填（他们给了完整占位文案）] · 比例 [7 档] · 分辨率 [1K标准/2K高清/4K超清]
       我们多一格「数量」；而且他们的第二格叫「修图指令」且是一段多行指令（不是一个短场景词）—— 按他们改。 */
    fields: [
      /* 批 P：知渔这一页的上传位是 **maxImages=1**（一张商品图），我们原来给了 6 —— 照他们收成 1 */
      { key: 'assets', label: '上传商品图', kind: 'upload', required: true, maxImages: 1, role: 'product', slotLabel: '上传商品图' },
      { key: 'scene', label: '修图指令', kind: 'textarea', rows: 3, required: true,
        placeholder: '请输入商品展示图设计指令，如：设计一张展示图，突出产品的主要功能和特点，背景使用浅色调以突出产品，加入一些动态元素使图像更具吸引力，整体风格简洁大方，符合现代审美等。' },
      ratioField(),
      clarityField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.multi_angle', board: 'image', name: '多角度套图', category: '电商专区', complexity: 'standard',
    cover: { template: 'case-3up', accent: 'cool' },
    summary: '同一商品，多角度保持一致', pipeline: 'builtinSkill', availability: 'ready',
    visual: 'free',
    brief: '生成商品的多角度成套图，视角：{{angle}}。同一件商品在同一组光线与背景下的连拍感，比例、颜色与细节在各角度之间保持一致；不要改变商品结构。细节补充：{{detail}}。',
    /* ═══ 2026-09-19 批 P：整页照知渔重排（5 格 → 5 格，但**内容全不一样**）═══════════════
       知渔「商品多角度多视图」逐页实采左栏：
         上传原图 [file 必填，最多 **8** 张] · 选择视角（**多选**）[6 档：正面/侧面/背面/俯视/仰视/45度角] ·
         细节补充 [multiText **可选**，占位"补充描述，如商品材质、场景要求、光线风格等..."] ·
         比例 [7 档] · 分辨率 [1K 标准/2K 高清/4K 超清]
       我们的旧版：素材(最多 6) / 角度(只有 4 档：正面·侧面·背面·俯视，而且**单选**) / 比例 / 分辨率 / 数量。
       ⇒ 三处是"功能区两回事"：① 视角少两档且不能多选（他们的卖点就是"多选视角一次出多张"）；
          ② 没有「细节补充」这一格；③ 我们多一格「数量」，他们那页没有。全部照他们改。 */
    fields: [
      { key: 'assets', label: '上传原图', longLabelReason: '照知渔原文逐字：这一页的上传位标题就是「上传原图」',
        kind: 'upload', required: true, maxImages: 8, role: 'product', slotLabel: '上传商品图' },
      { key: 'angle', label: '选择视角（多选）', longLabelReason: '照知渔原文逐字：这一页第二格叫「选择视角（多选）」，括号里的"多选"是他们写的',
        kind: 'segmented', required: true, multiple: true, options: [
        { value: '正面', label: '正面' }, { value: '侧面', label: '侧面' },
        { value: '背面', label: '背面' }, { value: '俯视', label: '俯视' },
        { value: '仰视', label: '仰视' }, { value: '45度角', label: '45度角' },
      ] },
      { key: 'detail', label: '细节补充', kind: 'textarea', rows: 2,
        placeholder: '补充描述，如商品材质、场景要求、光线风格等...' },
      ratioField(),
      clarityField(),
    ],
    cases: [], history: true,
  },
  {
    featuredRank: 6,
    /* 命名对齐竞品（用户 9-18 批注 16）：「他们叫 AI 换装，我们也可以跟他们一样去叫 AI 换装」。 */
    id: 'image.try_on', board: 'image', name: 'AI换装', category: '精品推荐', complexity: 'standard',
    cover: { template: 'before-after', accent: 'soft' },
    summary: '把商品穿到模特身上，姿势场景可选', pipeline: 'builtinSkill', availability: 'ready',
    visual: 'free',
    brief: '把衣服穿到模特身上（{{mode}}）。保留模特的五官、身材比例与肤色；衣服要贴合身体、褶皱与垂坠自然，面料质感、图案与版型必须与衣服图一致，光线统一；不要改变衣服的颜色与图案。',
    /* ═══ 字段逐条照竞品实测（?tool=ai-outfit）══════════════════════════════════════
       模特选择（上传模特图 0/1）→ 服装选择（套装 / 多件）→ 上传衣服图 0/1 →
       Pose 参考（可选）→ 背景参考（可选）→ 模型 / 分辨率 / 比例 / 生成张数 1-4。
       上传文案原文：「点击或拖拽上传图片 · 支持 JPG、JPEG、PNG、WEBP，单张不超过 10 MB」
       ＋可选位写「可选素材，不上传也可生成」。
       ⚠️ 模特图必须排在**第一个 upload 位**：skillImages 取第一个位当主图（image_url），
          这条链路的语义是"把衣服穿到这个模特身上"，模特才是底图。
          竞品也是这么排的（模特在上、衣服在下）。 */
    fields: [
      { key: 'model', label: '上传模特图', kind: 'upload', group: '模特选择', maxImages: 1, role: 'person', required: true,
        slotLabel: '点击或拖拽上传图片', hint: '模特底图：衣服会穿到这张图上的人身上' },
      { key: 'mode', label: '服装选择', kind: 'segmented', group: '服装选择', default: '套装',
        options: [{ value: '套装', label: '套装' }, { value: '多件', label: '多件' }] },
      /* ═══ 2026-09-19 批 Q：服装选择的**两档各有内容**（知渔深度点击实测）════════════════════
         实测（.tmp/qy-deepclick-theirs3.mjs）：
           · 选「套装」→ 一格「上传衣服图」
           · 选「多件」→ **变成「上传上装」+「上传下装」两格**（一次传上下两件）
         我们上一版两档都是一格，点「多件」什么都不变 —— 又一颗没有反馈的切换（用户批注 #3-2 的同一类问题）。 */
      { key: 'assets', label: '上传衣服图', kind: 'upload', group: '服装选择', maxImages: 1, role: 'product', required: true,
        visibleWhen: { key: 'mode', equals: '套装' },
        slotLabel: '点击或拖拽上传图片', hint: '要穿上去的衣服：真实面料、图案与版型要保住' },
      { key: 'top', label: '上传上装', kind: 'upload', group: '服装选择', maxImages: 1, role: 'product',
        visibleWhen: { key: 'mode', equals: '多件' },
        slotLabel: '点击或拖拽上传图片', hint: '上装：衬衫 / 外套 / T 恤' },
      { key: 'bottom', label: '上传下装', kind: 'upload', group: '服装选择', maxImages: 1, role: 'product',
        visibleWhen: { key: 'mode', equals: '多件' },
        slotLabel: '点击或拖拽上传图片', hint: '下装：裤子 / 半裙' },
      { key: 'pose', label: '上传姿势参考图', longLabelReason: '照竞品原文逐字（他们 ?tool=ai-outfit 的上传位标题就叫这个）', kind: 'upload', group: 'Pose 参考（可选）', maxImages: 1, role: 'reference',
        slotLabel: '点击或拖拽上传图片', hint: '可选素材，不上传也可生成' },
      { key: 'backdrop', label: '上传背景参考图', longLabelReason: '照竞品原文逐字（他们 ?tool=ai-outfit 的上传位标题就叫这个）', kind: 'upload', group: '背景参考（可选）', maxImages: 1, role: 'scene',
        slotLabel: '点击或拖拽上传图片', hint: '可选素材，不上传也可生成' },
      /* ═══ 这一页照知渔逐格对齐（他们 ?tool=ai-outfit 的实测，见 docs/design/data/quantv-image-pages.json）═══
         他们的格子是：模特选择 → 服装选择（套装 / 多件）→ 上传衣服图 → Pose 参考（可选）→ 背景参考（可选）
                   → 模型选择 → 分辨率（1K / 2K / 4K）→ 比例（自适应 / 1:1 / 3:2 / 2:3 / 16:9 / 9:16）→ 生成张数（1-4）
         ⇒ 我们原来多一格「补充要求」（他们**没有**这一格，多出来的字段就是"没对上"）——批 Q 已删。
         ⇒ 批 R 补齐了最后两处差异：「模型选择」与比例里的「自适应」（原来不敢加的理由都已解决：
            模型现在真进请求、真参与计费；自适应按主图宽高就近取档，不是假档位）。 */
      modelField(),
      /* 裸档位同图片复刻页（他们 AI换装页的分辨率也是 1K / 2K / 4K） */
      clarityField({ options: CLARITY_3_PLAIN }),
      ratioField(RATIO_TRYON),
      { key: 'count', label: '生成张数', kind: 'stepper', group: '生成设置', min: 1, max: 4 },
    ],
    cases: [
      { id: 'source', title: '商品与模特原图', cover: '/images/home/ability-tryon-example-input.png' },
      { id: 'result', title: 'AI 试穿成品', cover: '/images/home/ability-tryon-example-output.png' },
    ], history: true,
  },
  {
    /* tier: assistant —— "批量"是**执行方式**（一次出多张），素材结构本身就是套图的变体；
       用户不会为了"批量"单独进一个页面，他是在套图/多角度里选一次出几张。 */
    tier: 'assistant', belongsTo: 'image.product_suite',
    /* 融合形态：**控件**。批量不是一种玩法，是"这一次出几张" —— 它长在各主技能的「数量」控件上
       （21 条主技能已声明），张数与报价同源（skillGenerationSettings.count + skillPointsEstimate）。 */
    fuses: {
      slot: 'field', into: ['*'], label: '数量',
      note: '批量＝各技能里的「数量」控件：一次出 N 张，报价按 N 倍算，扣费在点生成时发生',
    },
    id: 'image.batch', board: 'image', name: '批量商品图', category: '电商专区', complexity: 'standard',
    cover: { template: 'case-3up', accent: 'warm' },
    summary: '商品＋角色＋场景三份素材批量出图', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'free',
    brief: '用商品图、人物图与场景图合成电商成品图。补充要求：{{prompt}}。三份素材的主体特征都要保留：商品不变形、人物五官不漂移、场景光线与主体一致；不要出现文字。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 2, role: 'product', slotLabel: '上传商品图' },
      /* 批 P：知渔这一页三格素材**都是必填**（角色图 / 场景图 optional=false），我们原来没标必填 */
      { key: 'character', label: '上传角色图', longLabelReason: '照知渔原文逐字：这一页第二格叫「上传角色图」', kind: 'upload', maxImages: 2, required: true, role: 'person', slotLabel: '上传人物图' },
      { key: 'backdrop', label: '上传场景图', longLabelReason: '照知渔原文逐字：这一页第三格叫「上传场景图」', kind: 'upload', maxImages: 2, required: true, role: 'scene', slotLabel: '上传场景图' },
      { key: 'prompt', label: '自定义提示词', longLabelReason: '照知渔原文逐字：这一页第四格叫「自定义提示词」', kind: 'textarea', rows: 3, required: true },
      /* 批 P：知渔这一页的比例是 **10 档**（比常规 7 档多 4:5 小红书封面 / 5:4 产品主图 / 21:9 超横屏）——
         这三档我们引擎原来没有，本批连尺寸表一起加齐（见 modelCatalog.LEGAL_IMAGE_SIZES 批 P 注释）。 */
      ratioField([
        { value: '1:1', label: '1:1 方图' },
        { value: '2:3', label: '2:3 竖版长图' },
        { value: '3:2', label: '3:2 横版摄影' },
        { value: '3:4', label: '3:4 竖版海报' },
        { value: '4:3', label: '4:3 横版主图' },
        { value: '4:5', label: '4:5 小红书封面' },
        { value: '5:4', label: '5:4 产品主图' },
        { value: '9:16', label: '9:16 手机竖屏' },
        { value: '16:9', label: '16:9 手机横屏' },
        { value: '21:9', label: '21:9 超横屏' },
      ]),
      clarityField(),
    ],
    cases: [], history: true,
  },

  /* ── 爆款配方（2026-09-17 调研落地）─────────────────────────────────────
     来源：docs/research/2026-09-17-image-skill-candidates.md（22 条候选，全部带一手来源与热度证据）。
     这里只收「ready」档（纯提示词 + 1 张商品图即可跑）：GitHub 上被反复收录、B站/小红书有高热教程。
     ⚠️ 竞品把这些放在「电商专区」而不是精品推荐 —— 精品推荐留给日常交付的活（套图/A+/详情/白底），
        爆款配方是"偶尔来一发"的创意玩法，放在专区里逛得到、又不挤占首页那一排。 */
  {
    id: 'image.explode', board: 'image', name: '爆炸分解广告图', category: '电商专区', complexity: 'standard',
    cover: { template: 'hero-single', accent: 'warm' },
    summary: '商品在半空炸开，碎片与成分定格', pipeline: 'visualCreation', availability: 'ready',
    visual: 'free',
    brief: '商品广告：商品在空中炸开分解。主体碎裂成多个碎片向四周飞散，悬浮的残骸与颗粒定格在半空，逐层可见，电影慢动作瞬间，逼真物理，细微粉尘与液滴散落，戏剧性景深，高速摄影风格，中心主体锐利对焦，体积光，照片级真实；必须保留商品本身的形状、颜色、材质与包装文字，碎片不得遮住标签。',
    /* ═══ 2026-09-19 批 O-⑥：字段逐个照知渔（6 → 4）══════════════════════════════════════
       知渔「电影级高端产品爆炸瞬间海报」逐字：
         上传图片（产品图）[file 必填] · 替换指令 [multiText 必填] · 比例 [7 档] · 清晰度 [1K标准/2K高清/4K超清]
       我们多两格（商品名、数量）。 */
    /* ═══ 2026-09-19 批 P：**「替换指令」在知渔是 hidden:true**，页面上没有这一格 ═══════════
       逐页实采左栏：上传图片（产品图）| 比例 * 1:1 2:3 3:2 3:4 4:3 9:16 更多 | 清晰度 * 1K标准 2K高清 4K超清
       —— 三格，没有"替换指令"（那是他们的内置提示词）。照抄成可见输入框＝让用户以为这段要自己写。 */
    fields: [
      { key: 'assets', label: '上传图片（产品图）', longLabelReason: '照知渔原文逐字：他们这一页的上传位标题就叫「上传图片（产品图）」',
        kind: 'upload', required: true, maxImages: 1, role: 'product', slotLabel: '上传商品图' },
      /* 批 P：比例药丸只有数字（1:1 / 2:3 / …），照他们这一页 */
      ratioField(RATIO_BARE),
      clarityField({ label: '清晰度', options: CLARITY_3_TIGHT }),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.ice_ad', board: 'image', name: '极地冰封海报', category: '电商专区', complexity: 'standard',
    cover: { template: 'poster-style', accent: 'cool' },
    summary: '商品封进巨型冰块，超现实大场面', pipeline: 'visualCreation', availability: 'ready',
    visual: 'poster',
    brief: '超现实广告海报：商品被完整封存在一块巨大的透明冰块中央，置于广袤极地冰原，背景压一行巨大的品牌字「{{brand}}」，低角度仰拍突出体量感，体积光穿过冰体产生折射与内辉光，冰面裂纹细节，远处暴风雪氛围，电影级广告摄影，超现实商业大片；商品标签与轮廓必须保持清晰可辨，画面内文字逐字准确、不得臆造。',
    /* ═══ 2026-09-19 批 O-⑥：字段逐个照知渔（6 → 4）══════════════════════════════════════
       知渔「极地冰封巨型广告海报」逐字：
         上传图片（产品图）[file 必填] · 品牌名 [singleText 必填] · 比例 [7 档] · 清晰度 [1K标准/2K高清/4K超清]
       我们多两格（色调、数量），而他们的第二格是**品牌名** —— 按他们改。 */
    fields: [
      { key: 'assets', label: '上传图片（产品图）', longLabelReason: '照知渔原文逐字：他们这一页的上传位标题就叫「上传图片（产品图）」',
        kind: 'upload', required: true, maxImages: 1, role: 'product', slotLabel: '上传商品图' },
      { key: 'brand', label: '品牌名', kind: 'text', required: true },
      /* 批 P：比例药丸只有数字（照他们这一页） */
      ratioField(RATIO_BARE),
      clarityField({ label: '清晰度', options: CLARITY_3_TIGHT }),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.float_kv', board: 'image', name: '悬浮主视觉', category: '电商专区', complexity: 'standard',
    cover: { template: 'hero-single', accent: 'neutral' },
    summary: '产品悬浮 + 单向光，高级静物广告', pipeline: 'visualCreation', availability: 'ready',
    visual: 'brand-kv',
    brief: '高端产品摄影：商品悬浮于画面中央，强烈明暗对比与几何光影切割，大面积暗部保留，产品是唯一视觉焦点，柔和反射，真实摄影质感，品牌主视觉，无杂乱元素；商品结构与包装文字必须完整保留。画面要有一个明确的视觉焦点，空间关系可信，光线有来处。',
    /* ═══ 2026-09-19 批 O-⑥：字段逐个照知渔（6 → 4）══════════════════════════════════════
       知渔「蓝白降落伞悬浮产品创意3D渲染广告」逐字：
         上传图片（产品图）[file 必填] · 替换指令 [multiText 必填] · 比例 [7 档] · 清晰度 [1K标准/2K高清/4K超清]
       我们多两格（光影、背景自由文本），他们的第二格是**替换指令** —— 按他们改。 */
    /* ═══ 2026-09-19 批 P：**「替换指令」在知渔是 hidden:true**，页面上没有这一格 ═══════════
       逐页实采左栏：上传图片（产品图）| 比例 * 1:1 2:3 3:2 3:4 4:3 9:16 更多 | 清晰度 * 1K标准 2K高清 4K超清 */
    fields: [
      { key: 'assets', label: '上传图片（产品图）', longLabelReason: '照知渔原文逐字：他们这一页的上传位标题就叫「上传图片（产品图）」',
        kind: 'upload', required: true, maxImages: 1, role: 'product', slotLabel: '上传商品图' },
      /* 批 P：比例药丸只有数字（照他们这一页） */
      ratioField(RATIO_BARE),
      clarityField({ label: '清晰度', options: CLARITY_3_TIGHT }),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.tvc_grid', board: 'image', name: '九宫格 TVC 分镜', category: '电商专区', complexity: 'standard',
    cover: { template: 'case-3up', accent: 'accent' },
    summary: '一张图出 3×3 广告分镜板', pipeline: 'visualCreation', availability: 'ready',
    visual: 'poster',
    brief: '做一张九宫格广告分镜板（3×3）：同一个商品在九个镜头里依次出现。要求：每格是一帧独立画面，景别与机位有变化，整体色调统一，格与格之间有叙事顺序；商品在每一格里都保持结构、颜色与包装文字一致，画面内文字逐字准确。',
    /* ═══ 2026-09-19 批 O-⑥：字段逐个照知渔（5 → 3）══════════════════════════════════════
       知渔「汽水广告九宫格」的 inputConfigs 逐字：
         上传图片（汽水图）[file 必填] · 比例 [7 档] · 清晰度 [1K标准/2K高清/4K超清]
       我们多两格（商品名、九个镜头自由文本）—— 他们的镜头顺序由"九宫格"这个模板本身决定。 */
    fields: [
      { key: 'assets', label: '上传图片（汽水图）', longLabelReason: '照知渔原文逐字：他们这一页的上传位标题就叫「上传图片（汽水图）」',
        kind: 'upload', required: true, maxImages: 1, role: 'product', slotLabel: '上传商品图' },
      /* 批 P：这一页的比例药丸**只有数字**（1:1 / 2:3 / …），没有"方图/竖版长图"后缀 —— 照他们 */
      ratioField(RATIO_BARE),
      clarityField({ label: '清晰度', options: CLARITY_3_TIGHT }),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.sku_series', board: 'image', name: 'SKU 多色系列图', category: '电商专区', complexity: 'standard',
    cover: { template: 'case-3up', accent: 'soft' },
    summary: '同款不同配色，整齐排开', pipeline: 'visualCreation', availability: 'ready',
    visual: 'free',
    /* 批 CY-㉓：`layout`（排列：一字排开 / 两行网格 / 环形）是 **required: true** ——
       用户必须选一个才能提交，而这条 brief 从来没读过它 ⇒ 用户选了「两行网格」，
       模型收到的仍然是那句笼统的「有序排列」。**五种必填控件全丢，这是最后一处。** */
    brief: '做一张 SKU 多色系列图：同一款{{product}}的不同配色有序排列——{{colors}}。排列方式：{{layout}}。要求：排列整齐、间距一致，光影与质感完全一致，**只允许颜色不同**，结构与包装文字必须一致，背景干净；画面内不出现臆造的文字与价格。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 1, role: 'product', slotLabel: '上传商品图' },
      { key: 'product', label: '商品名', kind: 'text', required: true },
      { key: 'colors', label: '配色清单', kind: 'textarea', rows: 3, required: true, placeholder: '例如：雾霾蓝 / 奶油白 / 焦糖棕 / 松石绿' },
      { key: 'layout', label: '排列', kind: 'segmented', required: true, default: '一字排开', options: [
        { value: '一字排开', label: '一字排开' }, { value: '两行网格', label: '两行网格' }, { value: '环形', label: '环形' },
      ] },
      ratioField(),
      /* 批 O-六：补「分辨率」—— 知渔这一页有这一档，我们原来没有 */
      clarityField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.gift_scene', board: 'image', name: '礼盒场景图', category: '电商专区', complexity: 'simple',
    cover: { template: 'hero-single', accent: 'warm' },
    summary: '商品进礼盒/桌面场景，同风格可复制', pipeline: 'visualCreation', availability: 'ready',
    visual: 'free',
    brief: '把{{product}}放进{{scene}}里拍一张场景图。要求：商品是画面主角、位置自然、留白得当，环境光柔和有来处，材质与色彩克制统一，风格可以复制到同系列的其他商品上；商品结构与包装文字完整保留，不出现臆造的品牌与价格。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 1, role: 'product', slotLabel: '上传商品图' },
      { key: 'product', label: '商品名', kind: 'text', required: true },
      { key: 'scene', label: '场景', kind: 'textarea', rows: 3, required: true, placeholder: '例如：米色礼盒内衬丝带，旁边一支干花' },
      ratioField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.teardown', board: 'image', name: '拆解工艺图', category: '电商专区', complexity: 'standard',
    cover: { template: 'case-3up', accent: 'cool' },
    summary: '把商品拆成零件，讲清工艺', pipeline: 'visualCreation', availability: 'ready',
    visual: 'free',
    brief: '做一张工艺拆解图：把{{product}}拆成{{parts}}并列展示。要求：零件比例真实、排列有序、质感统一，像产品说明书里的爆炸图，背景干净；画面内文字逐字准确，不得臆造参数与认证标识。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 1, role: 'product', slotLabel: '上传商品图' },
      { key: 'product', label: '商品名', kind: 'text', required: true },
      { key: 'parts', label: '部件', kind: 'textarea', rows: 3, required: true, placeholder: '例如：鞋面 / 中底 / 大底 / 鞋带扣' },
      ratioField(),
      /* 批 O-六：补「分辨率」—— 知渔这一页有这一档，我们原来没有 */
      clarityField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.diorama', board: 'image', name: '微缩场景广告', category: '电商专区', complexity: 'standard',
    cover: { template: 'hero-single', accent: 'accent' },
    summary: '商品住进微缩立体世界', pipeline: 'visualCreation', availability: 'ready',
    visual: 'free',
    brief: '把{{product}}放进一个微缩立体场景（diorama）里：{{world}}。要求：微缩比例可信、材质分明（黏土/纸艺/树脂质感）、顶光或侧逆光塑形、浅景深，像手工模型摄影；商品本身的结构、颜色与包装文字必须保持真实可辨。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 1, role: 'product', slotLabel: '上传商品图' },
      { key: 'product', label: '商品名', kind: 'text', required: true },
      { key: 'world', label: '微缩世界', kind: 'textarea', rows: 3, required: true, placeholder: '例如：一间迷你咖啡馆，吧台、吊灯、木箱' },
      ratioField(),
      /* 批 O-六：补「分辨率」—— 知渔这一页有这一档，我们原来没有 */
      clarityField(),
    ],
    cases: [], history: true,
  },

  /* ── 创意应用 ─────────────────────────────────────────────────────────── */
  {
    id: 'image.brand_kv', board: 'image', name: '品牌主视觉', category: '创意应用', complexity: 'standard',
    cover: { template: 'hero-single', accent: 'accent' },
    summary: '把品牌调性扩成一套画面语言', pipeline: 'visualCreation', availability: 'ready',
    visual: 'brand-kv',
    brief: '做一张品牌主视觉。主题：{{topic}}。品牌：{{brand}}。画面：{{prompt}}。要求：不是一张孤立的图，而是一套能延展到其他版式的画面语言——构图、材质、光线、色板与图形节奏要统一；品牌标识与产品细节必须原样保留。',
    fields: [
      { key: 'topic', label: '主题', kind: 'text', required: true },
      { key: 'brand', label: '品牌', kind: 'text', placeholder: '品牌名或关键词' },
      { key: 'prompt', label: '描述', kind: 'textarea', rows: 3 },
      ratioField(),
      /* 批 O-六：补「分辨率」—— 知渔这一页有这一档，我们原来没有 */
      clarityField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.cn_poster', board: 'image', name: '中文海报', category: '创意应用', complexity: 'standard',
    cover: { template: 'poster-style', accent: 'warm' },
    summary: '中文标题与画面一起排', pipeline: 'visualCreation', availability: 'ready',
    visual: 'poster',
    brief: '设计一张中文海报。主题：{{topic}}。画面描述：{{prompt}}。用途：{{use}}。字体：{{font}}。颜色：{{color}}。效果：{{effect}}。要求：中文标题逐字准确、层级清楚，不出现错字或臆造文案，画面给标题留出安全区。',
    /* ═══ 2026-09-19 批 O-⑥c：**字段逐个照知渔补齐**（5 → 8）═════════════════════════════
       依据：用户第 19 轮「你**抄的完全就没有对上**」+「全部去把这些子页面 1:1 的去把它们抄过来」。
       知渔「中文海报一键生成」的 inputConfigs 逐字（.tmp/laoyu2/dump-cnposter 实测）：
         主题 [singleText 必填 ph="请输入海报主题"] · 画面描述 [multiText 必填 ph="补充画面描述，让画面更丰富"] ·
         用途 [radio 可选 8 档] · 生成尺寸 [radio 必填 7 档] · 字体 [radio 可选 6 档] ·
         颜色 [radio 可选 15 档] · 效果 [radio 可选 18 档] · 选择分辨率 [select 必填 2K高清/4K超清]
       ⇒ 我们原来只有 主题/描述/用途/字体/比例 五格，且**用途 4 档（他们 8）、字体 4 档（他们 6）、
          完全没有颜色与效果** —— 这三处就是"功能区完全两回事"。
       ⚠️ 「颜色」15 档与「效果」18 档照原文全收（他们这两档里都有「自定义」一项，也照收）；
          「生成尺寸」用我们的比例字段（值集已与知渔一致：7 档）；分辨率用 clarityField。
       ⚠️ 标签逐字用他们的写法（"书法体 / 无衬线体 / 霓虹灯字…"），不用我上一版自造的"黑体/宋体/圆体"。 */
    fields: [
      { key: 'topic', label: '主题', kind: 'text', required: true, placeholder: '请输入海报主题' },
      { key: 'prompt', label: '画面描述', kind: 'textarea', rows: 3, required: true, placeholder: '补充画面描述，让画面更丰富' },
      { key: 'use', label: '用途', kind: 'segmented', group: '画面设置', options: [
        { value: '电商促销', label: '电商促销' }, { value: '旅游宣传', label: '旅游宣传' },
        { value: '音乐节', label: '音乐节' }, { value: '艺术画展', label: '艺术画展' },
        { value: '发布会', label: '发布会' }, { value: '产品展示', label: '产品展示' },
        { value: '节日庆典', label: '节日庆典' }, { value: '自定义', label: '自定义' },
      ] },
      /* ═══ 2026-09-19 批 P：**「生成尺寸」在第 4 格，不在最后** ═══════════════════════════
         逐页实采（docs/design/data/quantv-image-pages.json）他们的左栏顺序是：
           主题 | 画面描述 | 用途(8) | **生成尺寸(7)** | 字体(6) | 颜色(15) | 效果(18) | 选择分辨率(2)
         我们原来是 主题/画面描述/用途/字体/颜色/效果/比例/分辨率 —— **尺寸掉到了最后**，
         用户按他们的顺序找尺寸会找不到。照他们的位置摆回第 4 格，标题也照他们叫「生成尺寸」。 */
      /* ⚠️ group 也写「画面设置」：工作台是按**分组**渲染的（同组的字段按声明顺序排），
         如果它落在「生成设置」组里，就会被排到字体/颜色/效果**后面**去 ——
         知渔那一页的顺序是 用途 → 生成尺寸 → 字体 → 颜色 → 效果，位置错了就等于没抄对。 */
      ratioField(RATIO_SIZED, '生成尺寸', '画面设置'),
      { key: 'font', label: '字体', kind: 'segmented', group: '画面设置', options: [
        { value: '书法体', label: '书法体' }, { value: '无衬线体', label: '无衬线体' },
        { value: '霓虹灯字', label: '霓虹灯字' }, { value: '书写体', label: '书写体' },
        { value: '哥特体', label: '哥特体' }, { value: '自定义', label: '自定义' },
      ] },
      { key: 'color', label: '颜色', kind: 'segmented', group: '画面设置', options: [
        { value: '金色', label: '金色' }, { value: '银色', label: '银色' }, { value: '红色', label: '红色' },
        { value: '蓝色', label: '蓝色' }, { value: '绿色', label: '绿色' }, { value: '紫色', label: '紫色' },
        { value: '橙色', label: '橙色' }, { value: '哑光', label: '哑光' }, { value: '亮光', label: '亮光' },
        { value: '黑色', label: '黑色' }, { value: '白色', label: '白色' }, { value: '灰色', label: '灰色' },
        { value: '棕色', label: '棕色' }, { value: '粉色', label: '粉色' }, { value: '自定义', label: '自定义' },
      ] },
      { key: 'effect', label: '效果', kind: 'segmented', group: '画面设置', options: [
        { value: '3D', label: '3D' }, { value: '2D', label: '2D' }, { value: '扁平化', label: '扁平化' },
        { value: '手绘', label: '手绘' }, { value: '水彩', label: '水彩' }, { value: '油画', label: '油画' },
        { value: '素描', label: '素描' }, { value: '黑白', label: '黑白' }, { value: '复古', label: '复古' },
        { value: '霓虹灯', label: '霓虹灯' }, { value: '渐变', label: '渐变' }, { value: '浮雕', label: '浮雕' },
        { value: '阴影', label: '阴影' }, { value: '发光', label: '发光' }, { value: '描边', label: '描边' },
        { value: '卡通', label: '卡通' }, { value: '插画', label: '插画' }, { value: '自定义', label: '自定义' },
      ] },
      /* 批 P：他们的分辨率是**两档**（2K高清 / 4K超清）且标题叫「选择分辨率」—— 照他们 */
      clarityField({ label: '选择分辨率', options: CLARITY_2 }),
    ],
    cases: [], history: true,
  },
  {
    /* 竞品「图片复刻」页的示例清单是「01 原图 02 原图 03 原图 04 复刻图 05 复刻图 06 复刻图」——
       成对展示"原图 → 复刻图"，我们也按这个口径交付（before/after 版式）。 */
    deliverables: [
      /* 竞品的示例编号清单是**成对**的：01 原图 02 原图 03 原图 04 复刻图 05 复刻图 06 复刻图。
         我们按同样的读法列：三张原图 → 三张复刻图（"你给 3 张，我照 3 张还你"）。 */
      { name: '原图', hint: '你上传的参考图，作为复刻基准（按参考图数量成组）' },
      { name: '原图', hint: '第二张参考图（同上）' },
      { name: '原图', hint: '第三张参考图（同上）' },
      { name: '复刻图', hint: '换掉商品与卖点，构图、版式与节奏保持不变' },
      { name: '复刻图', hint: '第二张成品（与上面对应）' },
      { name: '复刻图', hint: '第三张成品（与上面对应）' },
    ],
    /* 复刻程度照竞品做成二选一（他们：参考排版 / 高度复刻，各带一句说明）。
       ⚠️ 这里如实说清：两种口径的差别**体现在提示词的严格程度**上（图生图链路是同一条），
          不是在引擎里切了不同模型 —— 写清楚才不会让用户以为换了引擎。 */
    featuredRank: 4,
    id: 'image.copy', board: 'image', name: '图片复刻', category: '精品推荐', complexity: 'standard',
    cover: { template: 'before-after', accent: 'cool' },
    summary: '保住构图与节奏，换成自己的内容', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'free',
    /* ═══ 2026-09-21（用户第 22 轮）：**上传几张参考图就复刻几张** ═════════════════════════════
       用户原话（逐字）：「他这里的案例指的是上面 3 张原图分别对应下面 3 张的复刻结果啊，
         用户上传一张肯定就复刻一张，上传两张就复刻两张，上传 3 张就复刻 3 张不是吗？」
       知渔自己的示例区原文（2026-09-21 CDP 实采，见 docs/design/data/quantv-image-builtin-pages.json）：
         「上传风格参考图与商品图包，AI **按参考图数量**批量输出风格高度一致的商品主图。」
       示例区那张 3+3 的图是**配对示意**（01-03 原图 ↔ 04-06 复刻图），不是"固定出 6 张"——
       我们上一批把它读成固定 6 张，是错的（用户当场纠正）。
       ⇒ 声明 runsFollow = 'source'（上传参考图那一格）：一次点击 = 参考图几张就跑几次，
         第 i 次运行只带第 i 张参考图（skillRun.skillImages 按 slotIndex 取），
         商品图始终是主图；按钮上的积分按张数算（N 张 = N 积分，点之前就看得到）。
       ⚠️ 知渔那边 CTA 是**一口价 0.60 积分**（实测：上传 1/3/4 张商品图、1/3/6/11 张参考图，
          价格一个字没变）—— 他们是按次收费，我们是按张收费，价格口径本来就不同源。 */
    runsFollow: 'source',
    brief: '按参考图复刻一张新图，复刻程度：{{degree}}；统一复刻要求：{{rules}}。' +
      '（参考排版 = 只借排版与背景结构、人物关系，配色按商品本身来；高度复刻 = 连构图、版式、配色与细节一起复刻，只把商品与卖点换掉。）' +
      '内容必须是{{product}}本身，不要照搬参考图里的品牌与文字。' +
      '目标市场：{{market}}；目标平台：{{platform}}；画面内文案语言：{{language}}。',
    /* 字段顺序与措辞照竞品图片复刻页实测：
       商品信息 0/4（核心卖点*）→ 上传商品图 0/4（成组打包）→ 上传参考图 0/20 →
       复刻设置（复刻程度 + 统一复刻要求）→ 目标市场/目标平台/文案语言 → 生成设置。 */
    fields: [
      /* ⚠️ 上传商品图必须 required：它是这条链路的主图（skillImages 取第一个 upload 位当 image_url），
         不 required 的话「只填了卖点就能点生成」—— 那会跑成**文生图**，
         而这条技能叫"复刻"，用户要的是拿着他的商品图去图生图。竞品也是先要求上传商品图。 */
      { key: 'reference', label: '上传商品图', kind: 'upload', maxImages: 4, group: '商品信息', role: 'product', required: true,
        slotLabel: '点击或拖拽上传图片', hint: '商品图会作为一组打包参考，最多 4 张' },
      { key: 'product', label: '核心卖点', kind: 'textarea', rows: 5, group: '商品信息', required: true,
        placeholder: '建议包含以下信息生成更精准：\n1.产品名称\n2.核心卖点\n3.适用人群\n4.期望场景\n5.产品尺寸' },
      { key: 'source', label: '上传参考图', kind: 'upload', maxImages: 20, group: '参考图', role: 'reference',
        slotLabel: '点击或拖拽上传图片', hint: '风格参考，最多 20 张' },
      /* 复刻程度照竞品二选一（各带一句说明）；差别体现在提示词的严格程度（同一条图生图链路，不是换引擎） */
      { key: 'degree', label: '复刻程度', kind: 'segmented', group: '复刻设置', required: true, default: '参考排版', options: [
        { value: '参考排版', label: '参考排版' },
        { value: '高度复刻', label: '高度复刻' },
      ], hint: '参考排版：参考排版、背景结构与人物关系，配色按商品本身设计。高度复刻：复刻参考图构图、版式、配色与细节，替换商品和卖点。' },
      { key: 'rules', label: '统一复刻要求（选填）', longLabelReason: '照竞品原文逐字（他们 ?tool=image-clone 的字段名就是「统一复刻要求（选填）」）', kind: 'textarea', rows: 3, group: '复刻设置',
        placeholder: '例如：文案统一用英文、模特姿势保持不变、参考图不要替换商品色。' },
      marketField(MARKET_BASE),
      { ...platformField(PLATFORM_SUITE), span: 'half' },
      { ...languageField('文案语言', LANGUAGE_CLONE), span: 'half' },
      /* ═══ 批 R：这一页最后两格也照知渔补齐 ═══════════════════════════════════════════════
         他们的顺序是：… 文案语言 → **模型选择** → **分辨率**（1K/2K/4K）→ 比例（14 档，含自适应）。
         ⇒ 我们原来缺模型选择与分辨率两格、却多出一格「生成数量」（他们这一页**没有**张数档：
            一次出几张由他们的「生成图片」按钮那一档定），本批删掉，并补上缺的两格。
         ⚠️ 「生成数量」删掉后，批量能力仍在本技能里可达：出图后的结果区动作
            （相似图 / 再来一张）与套图结构那边都能一次出多张，不是把能力砍了。 */
      modelField(),
      /* 分辨率照知渔这一页的**裸档位**（他们实测就是 1K / 2K / 4K，没有「标准/高清/超清」后缀 ——
         证据 docs/design/data/quantv-image-builtin-pages.json 的 selects[4] 与 panelText 一致） */
      clarityField({ options: CLARITY_3_PLAIN }),
      ratioField(RATIO_CLONE),
    ],
    cases: [], history: true,
  },
  {
    /* tier: assistant —— 它不是"一个活儿"，而是"沿着一张参考图再多出几张"这种**运行方式**。
       竞品也没有单独的"相似图"入口：这是生成时的一个参数，不是用户会专门进来的页面。
       所以它不进首页精选与主档，只在「辅助能力」里可查（也可以直接开链接用）。 */
    tier: 'assistant', belongsTo: 'image.copy',
    /* 融合形态：**结果区动作**。任何一条出图技能出来后，都能"拿这张图再来一张相似的"。
       into 写 '*' 是有意的：相似图与内容无关，只与刚才那张图有关。 */
    fuses: {
      slot: 'result', into: ['*'], label: '再来一张相似的',
      note: '沿着刚才那张结果的画风再出一张变体（保留构图语言，不逐像素复制）',
    },
    id: 'image.similar', board: 'image', name: '相似图生成', category: '创意应用', complexity: 'simple',
    cover: { template: 'hero-single', accent: 'neutral' },
    summary: '沿着一张参考图再生成几张', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'free',
    brief: '沿用参考图的风格再生成一张，参考强度：{{strength}}。保留参考图的画面语言（构图习惯、光线、色调、质感），但不要逐像素复制；不要出现水印或 logo。',
    fields: [
      { key: 'reference', label: '参考图', kind: 'upload', required: true, maxImages: 1, role: 'reference', slotLabel: '上传参考图' },
      /* 批 O-⑥d：标签照知渔原文（他们这一档叫「参考强度」，值就是 低/中/高）
         批 P：这一格在知渔是**必填**（optional=false），我们原来没标必填 —— 照他们标上 */
      { key: 'strength', label: '参考强度', kind: 'segmented', required: true, group: '生成设置', options: [
        { value: '低', label: '低' }, { value: '中', label: '中' }, { value: '高', label: '高' },
      ] },
      ratioField(),
      /* 批 O-⑥d：补「选择分辨率」—— 知渔「相似图生成」的 inputConfigs 是 4 个字段
         （上传参考图 / 参考强度 / 比例 / 选择分辨率），我们原来缺最后一格 */
      /* 批 P：他们这一格是**两档**（2K高清 / 4K超清），标题就叫「选择分辨率」—— 照他们 */
      clarityField({ label: '选择分辨率', options: CLARITY_2 }),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.xhs_note', board: 'image', name: '小红书图文', category: '创意应用', complexity: 'standard',
    cover: { template: 'case-3up', accent: 'soft' },
    summary: '一组配图加标题正文，真实感优先', pipeline: 'xhsNote', availability: 'ready',
    visual: 'social-cover',
    brief: '围绕这个主题做一组小红书配图。主题：{{prompt}}。文风：{{style}}。要求：真实感优先，像手机随手拍出来的生活记录，不要做成广告海报；不出现水印与二维码。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 6, role: 'reference', slotLabel: '上传素材图' },
      { key: 'prompt', label: '描述', kind: 'textarea', rows: 3, placeholder: '例如：厦门 3 天 2 夜，第一次去怎么玩' },
      { key: 'style', label: '文风', kind: 'segmented', options: [
        { value: '真实分享', label: '真实分享' }, { value: '攻略清单', label: '攻略清单' },
        { value: '好物测评', label: '好物测评' }, { value: '生活记录', label: '生活记录' },
      ] },
      ratioField(),
      { key: 'count', label: '数量', kind: 'stepper', min: 1, max: 9 },
      /* 批 O-六：补「分辨率」—— 知渔这一页有这一档，我们原来没有 */
      clarityField(),
    ],
    cases: [], history: true,
  },

  /* ── 建筑家装（用户 9-17 明确要求做）──────────────────────────────────────
     竞品图片页 10 条都在这一档（平面转效果图 / 装修风格转换 / 毛坯家装设计 / 日夜气候切换 /
     一键软硬装替换 / 效果图质感提升 / 室内 3D 渲染 / 生成彩色平面图 / 建筑九宫格分镜 / AI 洗图）。
     我们照这个方向补齐：全部是**图生图**（给一张户型图 / 毛坯照 / 效果图，改出另一个版本），
     所以 availability 基本都是 'needs_ref'（依赖参考图），只有九宫格分镜可以纯文生图。
     ⚠️ 建筑与家装的**结构真实性**是这类技能的命门：墙体、门窗、层数、房间数量不许被模型自由发挥，
        所以每条 brief 里都写死了"结构不变"的约束。 */
  {
    id: 'image.floorplan_render', board: 'image', name: '平面转效果图', category: '建筑家装', complexity: 'standard',
    cover: { template: 'before-after', accent: 'cool' },
    summary: '一张户型图，长出一套三维效果图', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'free',
    brief: '把这张户型图转成三维建筑效果图。建筑类型：{{buildingType}}。建筑气质：{{buildingMood}}。场地环境：{{siteContext}}。光影氛围：{{lightMood}}。补充要求：{{notes}}。要求：房间数量、开间进深、门窗位置与户型图**完全一致**，家具按常规布局摆放且尺度合理，顶面、地面与墙面的材质统一，光线从窗户自然进入；不要新增或删减房间，不要改动承重结构，画面里不出现文字与尺寸标注。',
    /* ═══ 2026-09-19 批 O-⑥a：**字段逐个照知渔补齐**（4 → 8）═════════════════════════════
       依据：用户第 19 轮「你**抄的完全就没有对上**」+「全部去把这些子页面 1:1 的去把它们抄过来」。
       知渔「平面转建筑效果图」的 inputConfigs 逐字（docs/design/data/quantv-image-key-specs.json）：
         参考图 [file] · 建筑类型 [select: 别墅设计/住宅设计/办公建筑/商业建筑/校园建筑/博览建筑] ·
         建筑气质 [radio: 现代简约/精致曲线/典雅中式/稳重石材] ·
         场地环境 [radio: 住宅环境/城市街区/自然环境/滨水临湖] ·
         光影氛围 [radio: 晴朗日光/柔和逆光/写实静谧/阴天雾感/黎明晨光/夕阳暖光/夜景灯光/质感蓝调] ·
         更多描述 [multiText 可选] · 比例 [7 档] · 清晰度 [1K/2K/4K]
       ⇒ **我们原来把"建筑气质/场地环境/光影氛围"三个维度糊成了一格「空间与风格」文本域** ——
          这正是用户说的"功能区完全两回事"。现在按他们的四个维度**拆开**，并把「数量」去掉
          （他们这一页没有数量档；比例与清晰度我们已有对应字段）。
       ⚠️ 「更多描述」保留可选（原文就是 optional）。 */
    fields: [
      { key: 'assets', label: '参考图', kind: 'upload', required: true, maxImages: 1, role: 'reference', slotLabel: '上传户型图 / 平面图' },
      { key: 'buildingType', label: '建筑类型', kind: 'select', required: true, group: '建筑与场地', options: [
        { value: '别墅设计', label: '别墅设计' }, { value: '住宅设计', label: '住宅设计' },
        { value: '办公建筑', label: '办公建筑' }, { value: '商业建筑', label: '商业建筑' },
        { value: '校园建筑', label: '校园建筑' }, { value: '博览建筑', label: '博览建筑' },
      ] },
      { key: 'buildingMood', label: '建筑气质', kind: 'segmented', required: true, group: '建筑与场地', options: [
        { value: '现代简约', label: '现代简约' }, { value: '精致曲线', label: '精致曲线' },
        { value: '典雅中式', label: '典雅中式' }, { value: '稳重石材', label: '稳重石材' },
      ] },
      { key: 'siteContext', label: '场地环境', kind: 'segmented', required: true, group: '建筑与场地', options: [
        { value: '住宅环境', label: '住宅环境' }, { value: '城市街区', label: '城市街区' },
        { value: '自然环境', label: '自然环境' }, { value: '滨水临湖', label: '滨水临湖' },
      ] },
      /* 批 P：这一格实测是 **8 档全铺**（他们那页没有「更多」）—— maxVisible 显式声明 */
      { key: 'lightMood', label: '光影氛围', kind: 'segmented', required: true, group: '建筑与场地', maxVisible: 8, options: [
        { value: '晴朗日光', label: '晴朗日光' }, { value: '柔和逆光', label: '柔和逆光' },
        { value: '写实静谧', label: '写实静谧' }, { value: '阴天雾感', label: '阴天雾感' },
        { value: '黎明晨光', label: '黎明晨光' }, { value: '夕阳暖光', label: '夕阳暖光' },
        { value: '夜景灯光', label: '夜景灯光' }, { value: '质感蓝调', label: '质感蓝调' },
      ] },
      { key: 'notes', label: '更多描述', kind: 'textarea', rows: 2, group: '建筑与场地' },
      /* 批 P：这一页的比例是**只有数字的 7 档**，而且**铺满**（他们那页没出现「更多」）—— maxVisible 显式声明 */
      { ...ratioField(RATIO_BARE), maxVisible: 7 },
      /* 批 P：这一页的清晰度只有数字（1K / 2K / 4K），没有"标准/高清/超清"后缀 —— 照他们 */
      clarityField({ label: '清晰度', options: CLARITY_3_PLAIN }),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.interior_style', board: 'image', name: '装修风格转换', category: '建筑家装', complexity: 'standard',
    cover: { template: 'before-after', accent: 'warm' },
    summary: '同一个空间，换成另一种装修风格', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'free',
    brief: '把这张室内照片的装修风格改成「{{style}}」。要求：空间结构、门窗位置、房间尺寸与机位**完全不变**，只更换硬装材质、家具款式、软装与配色；光线方向与原图一致，材质质感真实（木纹、石材、织物可辨），不出现变形、穿模与多余文字。',
    fields: [
      { key: 'assets', label: '上传图片', kind: 'upload', required: true, maxImages: 1, role: 'reference', slotLabel: '上传空间照片' },
      /* 批 O-⑥：知渔「装修风格转换」的第二格是**自由指令**（multiText 必填，带完整占位文案），
         不是一个风格选择器 —— 按他们改成指令输入（判据：功能区一模一样） */
      { key: 'style', label: '家装指令', kind: 'textarea', rows: 3, required: true, placeholder: '请输入您的家装修改指令，如：将客厅的墙壁颜色改为浅蓝色，增加一些现代风格的家具，地板更换为木质地板等。' },
      ratioField(),
      /* 批 O-六：补「分辨率」—— 知渔这一页有这一档，我们原来没有 */
      clarityField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.rough_interior', board: 'image', name: '毛坯房设计', category: '建筑家装', complexity: 'standard',
    cover: { template: 'before-after', accent: 'soft' },
    summary: '毛坯现场照，直接出精装方案', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'free',
    brief: '把这张毛坯房照片做成精装完成后的样子。装修风格：{{style}}。其他需求：{{plan}}。要求：墙体、梁柱、门窗与管道位置**完全保留**，只在其上增加吊顶、地面、墙面饰面与家具；机位与透视不变，光线从原有窗户进入，材质真实、色温统一，不出现结构改动与文字标注。',
    /* ═══ 2026-09-19 批 O-⑥d：**字段逐个照知渔补齐**（4 → 5）═════════════════════════════
       依据：用户第 19 轮「你**抄的完全没有对上**」+「全部去把这些子页面 1:1 的去把它们抄过来」。
       知渔「毛坯家装设计」的 inputConfigs 逐字：
         上传图片 [file] · 选择装修风格 [radio 必填 5 档：轻奢奶油风/现代简约风/北欧风/中国风/工业复古风] ·
         其他需求 [multiText 可选 ph="描述您想要的其他装修需求..."] · 比例 [7 档] · 选择分辨率 [2K高清/4K超清]
       ⇒ 我们原来把"装修风格"这一档**整个丢了**（只有一个自由文本"设计要点"），还多了一档「数量」。
          现在按他们拆成「选择装修风格（5 档必填）+ 其他需求（可选）」，「数量」去掉（他们没有）。 */
    fields: [
      /* 批 P：知渔这一页的上传位是 **maxImages=1**（一张毛坯现场照），我们原来给了 2 */
      { key: 'assets', label: '上传图片', kind: 'upload', required: true, maxImages: 1, role: 'reference', slotLabel: '上传毛坯现场照' },
      { key: 'style', label: '选择装修风格', kind: 'segmented', required: true, group: '设计风格', options: [
        { value: '轻奢奶油风', label: '轻奢奶油风' }, { value: '现代简约风', label: '现代简约风' },
        { value: '北欧风', label: '北欧风' }, { value: '中国风', label: '中国风' },
        { value: '工业复古风', label: '工业复古风' },
      ] },
      { key: 'plan', label: '其他需求', kind: 'textarea', rows: 2, group: '设计风格', placeholder: '描述您想要的其他装修需求...' },
      ratioField(),
      /* 批 P：他们这一格是**两档**（2K高清 / 4K超清），标题叫「选择分辨率」 */
      clarityField({ label: '选择分辨率', options: CLARITY_2 }),
    ],
    cases: [], history: true,
  },
  {
    /* 批 O-⑥ 升档（有证据）：知渔「日夜气候切换」实测就是 4 字段（上传图片 / 一句指令 / 比例 / 分辨率），
       我们把这一档抄进来之后字段数就超过 simple 的 4 上限 —— 改的是"这一档有多复杂"这个判断，不是放宽门禁。 */
    id: 'image.day_night_still', board: 'image', name: '日夜气候切换', category: '建筑家装', complexity: 'standard',
    cover: { template: 'case-3up', accent: 'cool' },
    summary: '同一张图，出白天 / 黄昏 / 夜晚三版', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'free',
    brief: '把这张建筑 / 空间图改成「{{moment}}」的样子。要求：建筑结构、机位、构图与材质**完全不变**，只改变光线方向、色温、天空与阴影；室内灯光在夜景中要自然亮起并有真实反射，地面湿度与反光符合天气设定，不出现结构变化与文字。',
    fields: [
      { key: 'assets', label: '上传图片', kind: 'upload', required: true, maxImages: 1, role: 'reference', slotLabel: '上传建筑 / 空间图' },
      /* 批 O-⑥：知渔「日夜气候切换」的第二格是**修图指令**（multiText 必填）—— 按他们改 */
      { key: 'moment', label: '修图指令', kind: 'textarea', rows: 3, required: true,
        placeholder: '例如：把画面改成黄昏时分，暖橙色侧光，天空有渐变的晚霞' },
      ratioField(),
      /* 批 O-六：补「分辨率」—— 知渔这一页有这一档，我们原来没有 */
      clarityField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.furniture_swap', board: 'image', name: '软硬装替换', category: '建筑家装', complexity: 'standard',
    cover: { template: 'before-after', accent: 'accent' },
    summary: '结构不动，只换家具与饰面', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'free',
    brief: '保持这张空间图的结构与机位**完全不变**，把家具与饰面替换成：{{target}}。要求：只替换可移动家具、灯具、软装与墙地面饰面，墙体、门窗、梁柱与尺寸不动；新家具的比例与透视要和空间吻合，材质光影统一，不出现漂浮、穿模与文字。',
    fields: [
      { key: 'assets', label: '上传图片', kind: 'upload', required: true, maxImages: 1, role: 'reference', slotLabel: '上传空间图' },
      { key: 'target', label: '家装指令', kind: 'textarea', rows: 3, required: true, placeholder: '例如：布艺沙发换皮质沙发，地毯换木地板，主灯换轨道灯' },
      ratioField(),
      /* 批 O-六：补「分辨率」—— 知渔这一页有这一档，我们原来没有 */
      clarityField(),
    ],
    cases: [], history: true,
  },
  {
    /* tier: assistant —— 它的输入是**已经有的一张效果图**，产出是同一张图更高级的版本，
       属于出图后的收尾修饰（改反射/补阴影/去塑料感），不是独立创作入口。 */
    tier: 'assistant', belongsTo: 'image.interior_3d',
    /* 融合形态：**结果区动作**，只长在"产出效果图"的那几条建筑家装主技能上 ——
       别的品类的主技能没有"商业出图质感"这件事，硬挂上去只会让用户困惑。 */
    fuses: {
      slot: 'result', label: '提升质感',
      into: ['image.interior_3d', 'image.floorplan_render', 'image.interior_style', 'image.rough_interior', 'image.day_night_still'],
      note: '把刚出的这张效果图提到商业出图水准（改反射、补阴影、去塑料感），结构与机位不动',
    },
    /* 批 O-⑥ 升档（有证据）：知渔「效果图质感提升」实测就是 4 字段（上传图片 / 一句指令 / 比例 / 分辨率），
       我们把这一档抄进来之后字段数就超过 simple 的 4 上限 —— 改的是"这一档有多复杂"这个判断，不是放宽门禁。 */
    id: 'image.render_quality', board: 'image', name: '效果图质感提升', category: '建筑家装', complexity: 'standard',
    cover: { template: 'before-after', accent: 'neutral' },
    summary: '把普通效果图提到商业出图水准', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'free',
    /* 批 CY-㉓：`focus`（后期指令）是 **required: true** —— 用户**必须**填才能提交，
       而它从来没有进过这条 brief ⇒ 用户被强制要求写一段文字，写完被丢掉。
       这是本批四种里最严重的一种：其余三个至少不逼你填。
       这里用**裸占位符**而不是可选段：它本来就必填，标签「后期指令：」留着是对的。 */
    brief: '提升这张效果图的画面质感，不改变任何结构、家具与机位。后期指令：{{focus}}。要求：修正材质反射与粗糙度，让木纹、石材、金属、织物各自可辨；补足环境光遮蔽与柔和阴影，降低塑料感与噪点，提亮暗部但不死黑，整体色温统一、画面干净通透，达到商业出图水准。',
    fields: [
      { key: 'assets', label: '上传图片', kind: 'upload', required: true, maxImages: 1, role: 'reference', slotLabel: '上传效果图' },
      /* 批 O-⑥：知渔「效果图质感提升」的第二格是**后期指令**（multiText 必填）—— 按他们改 */
      { key: 'focus', label: '后期指令', kind: 'textarea', rows: 3, required: true,
        placeholder: '例如：增强金属与玻璃的反射、补上接触阴影、去掉塑料感' },
      ratioField(),
      /* 批 O-六：补「分辨率」—— 知渔这一页有这一档，我们原来没有 */
      clarityField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.interior_3d', board: 'image', name: '室内 3D 渲染', category: '建筑家装', complexity: 'standard',
    cover: { template: 'hero-single', accent: 'accent' },
    summary: '模型截图 / 白模，渲染成真实照片', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'free',
    brief: '把这张室内模型图 / 白模渲染成照片级实景：{{style}}。要求：结构、家具位置与机位**完全不变**，只为材质赋予真实的反射与粗糙度，加上自然光与人工光的混合照明、接触阴影与景深；材质层次分明、色温统一，不出现结构变化、文字与水印。',
    fields: [
      { key: 'assets', label: '上传3D模型图（必选）',
        longLabelReason: '照知渔原文逐字：他们这一页的上传位标题就叫「上传3D模型图（必选）」，括号里的"必选"是他们写在标题里的',
        kind: 'upload', required: true, maxImages: 1, role: 'reference', slotLabel: '上传模型图 / 白模' },
      /* 批 O-⑥：知渔「室内3D模型渲染」的第二格是**图片编辑指令**（multiText 必填）—— 按他们改 */
      { key: 'style', label: '图片编辑指令', kind: 'textarea', rows: 3, required: true,
        placeholder: '描述渲染风格、材质、光照等' },
      ratioField(),
      /* 批 O-六：补「分辨率」—— 知渔这一页有这一档，我们原来没有 */
      clarityField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.arch_grid', board: 'image', name: '建筑九宫格分镜', category: '建筑家装', complexity: 'standard',
    cover: { template: 'case-3up', accent: 'cool' },
    summary: '一张九宫格讲完一栋建筑', pipeline: 'visualCreation', availability: 'ready',
    visual: 'poster',
    brief: '做一张建筑九宫格分镜板（3×3）。大师风格：{{masterStyle}}。光影调节：{{lightTone}}。创意描述：{{notes}}。要求：九格是同一栋建筑的九个视角或时段，透视与结构一致，格与格之间有叙事顺序（远景 → 中景 → 细节 → 室内 → 夜景），色调统一，不出现文字、标注与水印。',
    /* ═══ 2026-09-19 批 O-⑥b：**字段逐个照知渔补齐**（3 → 6）═════════════════════════════
       依据：用户第 19 轮「你**抄的完全就没有对上**」+「全部去把这些子页面 1:1 的去把它们抄过来」。
       知渔「建筑九宫格分镜」的 inputConfigs 逐字（docs/design/data/quantv-image-key-specs.json）：
         参考图 [file] · 大师风格 [radio 9 档] · 光影调节 [radio 9 档] ·
         创意描述（可选）[multiText] · 比例 [7 档] · 清晰度 [1K/2K/4K]
       ⇒ 我们原来只有「九个镜头」一个自由文本域、且缺清晰度 —— 现在按他们的两档 radio 拆开。
       ⚠️ 「九个镜头」那个文本域**去掉**：知渔这一页没有它，镜头顺序由"九宫格"这个模板本身决定
          （他们的 brief 写在 app 的 systemPrompt 里）。多一格就是没对上。 */
    fields: [
      { key: 'assets', label: '参考图', kind: 'upload', required: true, maxImages: 1, role: 'reference', slotLabel: '上传建筑图' },
      /* 批 P：9 档实测**铺满**（他们那页没有「更多」）—— maxVisible 显式声明 */
      { key: 'masterStyle', label: '大师风格', kind: 'segmented', required: true, group: '风格与光影', maxVisible: 9, options: [
        { value: '韦斯·安德森', label: '韦斯·安德森风格' }, { value: '罗杰·迪金斯', label: '罗杰·迪金斯风格' },
        { value: '王家卫', label: '王家卫风格' }, { value: '克里斯托弗·诺兰', label: '克里斯托弗·诺兰风格' },
        { value: '宫崎骏', label: '宫崎骏风格' }, { value: '新海诚', label: '新海诚风格' },
        { value: '李安', label: '李安风格' }, { value: '大卫·芬奇', label: '大卫·芬奇风格' },
        { value: '丹尼斯·维伦纽瓦', label: '丹尼斯·维伦纽瓦风格' },
      ] },
      /* 批 P：9 档实测**铺满**（他们那页没有「更多」）—— maxVisible 显式声明 */
      { key: 'lightTone', label: '光影调节', kind: 'segmented', required: true, group: '风格与光影', maxVisible: 9, options: [
        { value: '自然光感', label: '自然光感' }, { value: '柔和逆光', label: '柔和逆光' },
        { value: '几何光影', label: '几何光影' }, { value: '暖调氛围', label: '暖调氛围' },
        { value: '蓝调时刻', label: '蓝调时刻' }, { value: '黄昏时刻', label: '黄昏时刻' },
        { value: '晨雾柔光', label: '晨雾柔光' }, { value: '夜晚时分', label: '夜晚时分' },
        { value: '明亮通透', label: '明亮通透' },
      ] },
      { key: 'notes', label: '创意描述（可选）',
        longLabelReason: '照知渔原文逐字：他们这一页的字段名就叫「创意描述（可选）」，括号里的"可选"是他们写在标题里的，不是我们加的',
        kind: 'textarea', rows: 2, group: '风格与光影' },
      /* 批 P：比例只有数字的 7 档，且实测**铺满**（没有「更多」）—— 照他们 */
      { ...ratioField(RATIO_BARE), maxVisible: 7 },
      /* 批 P：这一页的清晰度只有数字（1K / 2K / 4K）—— 照他们 */
      clarityField({ label: '清晰度', options: CLARITY_3_PLAIN }),
    ],
    cases: [], history: true,
  },

  /* ── 人像摄影 ─────────────────────────────────────────────────────────── */
  {
    id: 'image.portrait', board: 'image', name: '人像精修', category: '人像摄影', complexity: 'standard',
    cover: { template: 'before-after', accent: 'soft' },
    summary: '皮肤、光线与质感一起收拾干净', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'free',
    brief: '精修这张人像。要求：{{prompt}}。保留人物原本的五官特征与身份识别度，皮肤处理自然、保留质感与毛孔，光线过渡干净；不要过度磨皮，不要改变脸型。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 1, role: 'person', slotLabel: '上传人像图' },
      /* 批 P：知渔这一页的第二格是**必填**的「修图指令」（optional=false），我们原来没标必填 */
      { key: 'prompt', label: '修图指令', longLabelReason: '照知渔原文逐字：人像变清晰这一页的第二格叫「修图指令」', kind: 'textarea', rows: 3, required: true },
      ratioField(),
      clarityField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.hairstyle', board: 'image', name: '换发型', category: '人像摄影', complexity: 'standard',
    cover: { template: 'before-after', accent: 'soft' },
    summary: '保留五官，换一个发型', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'free',
    brief: '保留人物五官与脸型，按这条指令换发型：{{style}}。发丝走向、发量感与光线要自然可信，肤色与背景保持一致；不要改变人物的身份特征。',
    /* ═══ 2026-09-19 批 P：第二格照知渔改成**多行「图片编辑指令」**═══════════════════════════
       知渔「AI换发型」逐字：上传图片 [file] · 图片编辑指令 [multiText **必填**，
         默认值「给人物更换黑长直发型 发丝顺滑 自然垂落 发尾齐整」，
         占位「描述想要的发型和发色...」] · 比例 [7 档] · 分辨率 [1K 标准/2K 高清/4K 超清]
       我们原来是一格**单行**「发型」（还选填）—— 他们要的是一句完整的编辑指令（含发色、发质、
       走向），单行写不下，而且不填就跑（他们必填）。⇒ 改成多行 + 必填 + 照抄他们的默认值与占位。 */
    fields: [
      { key: 'assets', label: '上传图片', longLabelReason: '照知渔原文逐字：这一页的上传位标题就是「上传图片」', kind: 'upload', required: true, maxImages: 1, role: 'person', slotLabel: '上传人像图' },
      { key: 'style', label: '图片编辑指令', longLabelReason: '照知渔原文逐字：这一页第二格叫「图片编辑指令」',
        kind: 'textarea', rows: 2, required: true,
        default: '给人物更换黑长直发型 发丝顺滑 自然垂落 发尾齐整',
        placeholder: '描述想要的发型和发色...' },
      ratioField(),
      clarityField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.pose', board: 'image', name: '姿势生成', category: '人像摄影', complexity: 'standard',
    cover: { template: 'case-3up', accent: 'soft' },
    summary: '同一个人，换几种姿势', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'free',
    brief: '让同一个人换几种姿势：{{pose}}。保持五官、发型、体型与服装一致，只改变姿态与镜头角度，光线与背景保持同一套；不要出现多余的肢体。',
    fields: [
      /* ═══ 2026-09-19 批 O-⑥：字段逐个照知渔（5 → 4）══════════════════════════════════════
         知渔「人物姿势参考」逐字（**两格都是上传位，没有文本指令**）：
           上传高清模特图 [file 必填] · 上传姿势图 [file 必填] · 比例 [7 档] · 选择分辨率 [2K高清/4K超清]
         我们原来是 素材(1) + 「姿势」自由文本 + 比例 + 数量 + 分辨率 —— 语义整个不对：
         他们要的是**给一张姿势参考图**，我们却让用户用文字描述姿势。按他们改成两个上传位。 */
      { key: 'assets', label: '上传高清模特图', longLabelReason: '照知渔原文逐字：他们这一页的第一个上传位标题就叫「上传高清模特图」',
        kind: 'upload', required: true, maxImages: 1, role: 'person', slotLabel: '上传人物图' },
      { key: 'pose', label: '上传姿势图', kind: 'upload', required: true, maxImages: 1, role: 'reference', slotLabel: '上传姿势参考图' },
      ratioField(),
      /* 批 P：他们这一格是**两档**（2K高清 / 4K超清），标题叫「选择分辨率」 */
      clarityField({ label: '选择分辨率', options: CLARITY_2 }),
    ],
    cases: [], history: true,
  },

  /* ── 图片编辑：统一形态「一张图 + 一句要求」────────────────────────────── */
  {
    featuredRank: 5,
    id: 'image.remove_bg', board: 'image', name: '去除背景', category: '精品推荐', complexity: 'standard',
    cover: { template: 'hero-single', accent: 'cool' },
    summary: '去掉背景，出透明底或纯色底', pipeline: 'builtinSkill', availability: 'ready',
    /* 批 I-11：一键类技能的主按钮用**自己的动作名**，不用通用的「生成图片」——
       竞品这一页的主 CTA 原文就是「去除背景 / 消耗 0.40 积分」（见 docs/design/50 第 165 行）。
       按钮上写"要做的那件事"，比写"生成"更准确：这一条不是"生成一张新图"，
       是"把已有这张图的背景去掉"。 */
    ctaLabel: '去除背景',
    visual: 'free',
    brief: '去掉背景，只保留主体，输出透明底。主体边缘要干净，发丝与透明材质要处理好，不要残留原背景，也不要改变主体本身的颜色与结构。',
    /* ═══ 2026-09-19 批 O：**改回 1:1**（用户第 19 轮：「你抄的完全就没有对上」）═══════════
       知渔 ?tool=remove-background 实测（CDP 全文，docs/design/67 §2）**只有两样东西**：
         「最多上传 5 张图片」+ 0/5 计数 + 一个「+」上传位 → 一颗「去除背景 / 消耗 0.40 积分」
         → 「请先上传需要去除背景的图片」；右栏示例是「原图 ↔ 去背景后」两图对照。
       **没有底色，也没有比例。**
       我上一版多给了「底色（透明/白色/纯色）」和「比例」两档，理由是"多给的是能力，不是坑" ——
       但用户的判据是**一模一样**，多出来的字段就是"没对上"。
       而且知渔把这两件事分在**两个页面**：
         · ?tool=remove-background  去除背景 = 纯去背，无选项；
         · ?id=cmppkwl86g…（应用市场的「提取电商白底图」）才有「抠图模式：透明背景 | 白色背景」。
       所以这里**删掉**底色与比例，把「底色」搬到它真正属于的那一页（image.white_bg）。 */
    fields: [
      uploadField({ maxImages: 5, slotLabel: '点击或拖拽上传图片', hint: '最多上传 5 张图片，一次批量去背景' }),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.swap_bg', board: 'image', name: '换背景', category: '图片编辑', complexity: 'standard',
    cover: { template: 'before-after', accent: 'cool' },
    summary: '人物或商品留着，背景换掉', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'free',
    brief: '保留主体，把背景换成我给的这张（或按下面的要求）：{{prompt}}。主体的光线要与新背景对得上，投影方向一致，边缘融合自然；不要改变主体的形态与颜色。',
    /* ═══ 2026-09-19 批 O-⑥：字段逐个照知渔（标签与必填态对齐）══════════════════════════════
       知渔「一键模特换背景」逐字：
         上传原模特图 [file 必填] · 上传场景图 [file **可选**] ·
         自定义输入背景提示词（选填）[multiText 可选 ph="请输入背景的相关词" help="背景的相关词"] ·
         比例 [7 档] · 分辨率 [1K标准/2K高清/4K超清]
       字段数我们本来也是 5，差的是**标签与必填态**：他们第二格是可选、第三格标题带"（选填）"——
       照他们改（文案可以不一样，但"哪一格可选"是逻辑，必须一致）。 */
    fields: [
      { key: 'assets', label: '上传原模特图', longLabelReason: '照知渔原文逐字：他们这一页的上传位标题就叫「上传原模特图」',
        kind: 'upload', required: true, maxImages: 1, role: 'product', slotLabel: '上传原图' },
      { key: 'backdrop', label: '上传场景图', kind: 'upload', maxImages: 1, role: 'scene', slotLabel: '上传背景图（可选，不上传就按下面的词生成）' },
      { key: 'prompt', label: '自定义输入背景提示词（选填）',
        longLabelReason: '照知渔原文逐字：他们这一页的第三格标题就叫「自定义输入背景提示词（选填）」',
        kind: 'textarea', rows: 3, placeholder: '请输入背景的相关词' },
      ratioField(),
      clarityField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.retouch', board: 'image', name: '图片精修', category: '图片编辑', complexity: 'standard',
    cover: { template: 'before-after', accent: 'neutral' },
    summary: '一张图加一句要求，改到能用', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'free',
    brief: '按这个要求修图：{{prompt}}。只做要求的改动，画面其他部分保持原样；不要改变主体的结构、文字与颜色关系，不要添加原本不存在的东西。',
    fields: [
      { key: 'assets', label: '上传图片', longLabelReason: '照知渔原文逐字：一键美化图片这一页的上传位标题就是「上传图片」', kind: 'upload', required: true, maxImages: 1, role: 'product', slotLabel: '上传图片' },
      /* 批 P：知渔这一页第二格叫「修图指令」且**必填**（我们原来叫「要求」且选填） */
      { key: 'prompt', label: '修图指令', longLabelReason: '照知渔原文逐字：这一页第二格叫「修图指令」', kind: 'textarea', rows: 3, required: true, placeholder: '例如：把背景杂物清掉，光线调亮一点' },
      ratioField(),
      clarityField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.style_swap', board: 'image', name: '材质替换', category: '图片编辑', complexity: 'standard',
    cover: { template: 'before-after', accent: 'warm' },
    summary: '主体不动，换材质或风格', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'free',
    brief: '主体不动，把风格材质换成「{{material}}」。新材质的反光、纹理与质感要真实可信，并与环境光一致；保持主体的形状、比例与结构不变。',
    /* ═══ 2026-09-19 批 P：第二格照知渔换成**22 档「风格选择」**═══════════════════════════
       知渔「图片换风格」逐字（副标题就写着"保持结构不变更换风格材质"—— 与我们的"材质替换"是同一件事）：
         上传参考图 [file 必填] · 风格选择 [radio **必填 22 档**] · 比例 [7 档] · 选择分辨率 [2K高清/4K超清]
         22 档原文：精致韩漫 / 写实 / 新莫奈花园 / 中国红 / 赛博机械 / 3D / 玩偶 / 动画电影 / 可爱玩偶 /
                   丑萌粘土 / 陶瓷娃娃 / 浪漫光影 / 国风-水墨 / 精致美漫 / 莫奈花园 / 水彩风 / 水墨 /
                   梦幻 / 日漫 / 动漫 / 天使 / 油画
       我们原来是一格**单行自由文本「材质」**（还得用户自己打"磨砂陶瓷、原木"）——
       他们给的是 22 个点一下就换的风格（前 6 个铺开 + 「更多」收折，见 FieldRenderer 的收折规则）。 */
    fields: [
      { key: 'assets', label: '上传参考图', longLabelReason: '照知渔原文逐字：图片换风格这一页的上传位标题就是「上传参考图」', kind: 'upload', required: true, maxImages: 1, role: 'product', slotLabel: '上传图片' },
      { key: 'material', label: '风格选择', longLabelReason: '照知渔原文逐字：这一页第二格叫「风格选择」', kind: 'segmented', required: true, options: [
        { value: '精致韩漫', label: '精致韩漫' }, { value: '写实', label: '写实' },
        { value: '新莫奈花园', label: '新莫奈花园' }, { value: '中国红', label: '中国红' },
        { value: '赛博机械', label: '赛博机械' }, { value: '3D', label: '3D' },
        { value: '玩偶', label: '玩偶' }, { value: '动画电影', label: '动画电影' },
        { value: '可爱玩偶', label: '可爱玩偶' }, { value: '丑萌粘土', label: '丑萌粘土' },
        { value: '陶瓷娃娃', label: '陶瓷娃娃' }, { value: '浪漫光影', label: '浪漫光影' },
        { value: '国风-水墨', label: '国风-水墨' }, { value: '精致美漫', label: '精致美漫' },
        { value: '莫奈花园', label: '莫奈花园' }, { value: '水彩风', label: '水彩风' },
        { value: '水墨', label: '水墨' }, { value: '梦幻', label: '梦幻' },
        { value: '日漫', label: '日漫' }, { value: '动漫', label: '动漫' },
        { value: '天使', label: '天使' }, { value: '油画', label: '油画' },
      ] },
      ratioField(),
      /* 批 P：他们这一格是**两档**（2K高清 / 4K超清），标题叫「选择分辨率」 */
      clarityField({ label: '选择分辨率', options: CLARITY_2 }),
    ],
    cases: [], history: true,
  },

  /* ══════════════════════════════════════════════════════════════════════════════════════
     2026-09-25 批 BP：**「概念视觉方案」—— 为长期经营一个审美账号而定制的生产工作台**

     用户口径（逐字）：「你要不就直接做个这种子页面出来，后续我们可以长期用这个子页面来生成内容，
       最好是把我们刚刚说的这些策略你去定制一个专门为我这个账号风格和审美服务的工作台，
       **对外就是展示一个正常的子页面类型，只是对内其实是我日常要去生产内容的一个子页面工作台而已**。」

     ── 与其他 48 条图片技能的根本区别（一句话）───────────────────────────────
     别的技能是**一次生成一张成品**；这一条是**一套**：先定一个本篇的"概念与色板"，
     再逐张换"画面手法"出片，**一套里每张共用同一份方向，但手法刻意互不重复**。
     依据是本仓对竞品的**一手实测**（`.tmp/xhs/aura-palette/`，6 篇共 58 张内页图逐张看过，
     见 docs/design/82）：同一篇里 12 张的手法分别是概念静物 / 平铺 / 微距 / 场景叙事 /
     材质静物 / 超现实拼贴 —— 既不是同一构图的重复，也不是"一句模糊意象随手发挥"，
     而是**一组刻意不重复的构思，共用一套纪律**。

     ── 三层结构（模糊度各不相同，这是本技能的设计要点）─────────────────────
      ① 账号级审美纪律 = **写死在 brief 里**（不出现正脸 / 柔光 / 留白 / 无品牌 / 统一调色）——
         用户不用每次粘，这就是"对外是个正常子页面"的原因；它不可编辑，因为它是这个账号的签名。
         ⚠️ 2026-09-27 批 DB（M1）：「不露脸」**不在**这一层了 —— 实测它太绝对
            （见 CONCEPT_PERSON_OPTIONS 的注释与 §4.3 的数字），改成 ② 里可选的一档「人物形态」，
            这一层只留**唯一站得住的那条**：不出现正脸、不直视镜头（实测 1/402）。
      ② 本篇概念与色板 = 「主题意象」一格的**选项值自带实测色簇**（见下面的注释）；
         人物形态 = 「人物形态」一格（六档，默认空镜）。
      ③ 本张手法 = **「本篇手法」那份可勾选清单**（批 DC / M2 改）。
         改前：手法是一个单选字段，"一套 = 逐张换手法，每换一次点一次生成" —— 一篇 8~18 张
         就要手点 8~18 次；改成勾选清单后：勾 N 种 → **一次触发 N 次生成**（逐张、按张计费），
         结果归为**一篇**（同一个 run = 同一个 _saveKey，历史里一篇一张卡）。
         依据：用户「「一套图片」可以按你说的做吧」+ §6.5「一张一张计价（N 张 = N 张的钱）」。

     ── 为什么 option 的 value 要写成一句完整的话（不是技术债，是刻意的）────────
     `buildSkillBrief` 只做 `{{key}}` 的**纯字符串替换**，没有查表能力。
     把「母体的实测色簇」直接写进 option 的 value，可以让**概念与色板同源、永远不会对不上**，
     并且零额外逻辑、零额外 token（不必在提示词里再放一张对照表）。
     色簇取批 BF 对 41 张封面做 k-means 聚类的实测值（灰调大地 11/41 · 海蓝灰雾 9 ·
     柔雾浅粉 8 · 暖砂裸粉 7 · 深棕暗红 6）。

     ── 预览步（previewStep，三步方案预览）─────────────────────────────────
     用户明确要"里面看得见"：「那个你做了没有，做了的话**里面不就看得见吗**」。
     声明 previewStep 即自动获得既有的**三步方案预览**（素材理解 → 方向与偏好 → 方案预览），
     第三步的「方案正文」**看得见也改得动**，确认后写回文字字段再点生成。
     ⚠️ 这条同时改了 `test/image-preview-step-0919.test.mjs` 的"只有三条"断言 ——
        属**用户改口径**（他要求这个工作台带预览），不是放宽判据。 */
  {
    id: 'image.concept_set', board: 'image', name: '概念视觉方案', category: '创意应用', complexity: 'standard',
    /* ⚠️ 这一行必须**紧跟 id 附近**：`test/image-preview-step-0919` 用「id 与它之间不超过 400 字」
       的窗口来判定"这条技能声明了预览步"—— 放到长注释/长字段之后会**跑出窗口**（本批实测踩过一次）。
       ⚠️ 另外那条门禁是用**原文计数**判"有没有多出来"，所以**注释里不要写它的字面量**
          （写了会被算进去，实测就是这么红的）。 */
    previewStep: true,
    cover: { template: 'case-3up', accent: 'soft' },
    summary: '先定方向再逐张换手法，一套不重样',
    pipeline: 'visualCreation', availability: 'ready', visual: 'brand-kv',
    /* 服务端 `brand-kv` 的配方原文是「Create a refined campaign system, not an isolated decorative image:
       use coherent composition, materials, lighting, palette, and graphic…」——
       这正是"成套"要的口径，所以复用（服务端白名单里合法；未知 id 会被回落成 free）。 */
    /* ═══ 2026-09-27 批 DB（M1）：人物那一条从**绝对禁令**改成**六档变量**（用户改口径）══════════
       改前：「不出现面部，需要人时只出手部或背影局部」—— 比实测的真人账号还严，
         产出的会是"完全没有头"的图（实测 86.1% 是无头，但 34.8% 的图里身体局部在场）。
       改后：`{{person}}` 由用户在六档里选（默认 = 实测最高频的「空镜」），
         并**保留一条硬约束**「不出现正脸、不直视镜头」—— 实测正面脸 1/402（0.2%），是唯一站得住的一条。
       依据：用户原话 + docs/research/2026-09-27-aura-deep-dive.md §4.3（402 张逐张判定）。 */
    brief: '做一篇「概念视觉方案」的成套图，一篇里每张只换手法、其余全同。{{theme}}。本张手法：{{shots}}。{{series}}{{notes}}。整篇纪律，每一张都遵守：人物形态：{{person}}；构图方向：{{direction}}；不出现正脸、不直视镜头；高端编辑级质感、柔光为主；背景干净、留白充足，主体不超过画面 40%；画面内不出现任何品牌标识、包装文字或水印；整篇共用同一套颗粒与饱和度，像同一次拍摄出来的；材质真实可信，不要塑料感。',
    /* ═══ 本篇手法清单（可勾选）═══════════════════════════════════════════════════════════
       十种手法**全部来自对本仓竞品素材的一手实测**（docs/design/82 有逐张出处）；
       批 BW 起这份清单**导出**给预览步②复用（同一套选项，不写第二遍）；
       批 DC 起它同时是**这一篇要出几张**的骨架（勾 N 种 = N 张，见 CONCEPT_SHOT_MODULES 的注释）。
       ⚠️ 它不再是一个"单选手法字段"：那样界面上会出现两个手法控件（一个单选、一个勾选清单），
          用户不知道该看哪个 —— 手法只有一处可选，就是这份清单。 */
    modules: CONCEPT_SHOT_MODULES(),
    /* 2026-09-28 批 DC 续-7：三档规模预设（进页面按 standard 勾好 6 张，见 skillInitialModuleOff）。
       ⚠️ 只有这一条技能声明它 —— A+ 内容的 16 个内容模块**保持"默认一个都不勾"**（批 AW 用户拍板）。 */
    modulesPresets: CONCEPT_SHOT_PRESETS(),
    modulesTitle: '本篇手法',
    /* ⚠️ 2026-09-28 批 DC 续-7 写过一句话（第一句说清"这一篇一共几张"），
       **2026-09-29 批 DC 续-17 按用户要求删掉**（逐字：「然后像这两句描述说明我觉得没有太大
       必要，你可以删掉。」）—— 那一版把"按张计价/没跑成不扣那一张"写在按钮与清单之间，
       而**按钮下面本来就有**「这一步只出方案；确认后将出 6 张图 和一组发布文案」，
       两处说同一件事，读起来啰嗦。
       ⚠️ 这里必须写成**空串**而不是删掉这个键：页面侧 `typeof === 'string'` 才认"显式留空"，
          删掉键会落回那句通用兜底说明（那正是"想删也删不掉"的原因）。 */
    modulesNote: '',
    modulesGate: '请先勾选这一篇要出的手法',
    /* ⚠️ `{{shots}}` / `{{series}}` / `{{person}}` **都不是字段**了：它们是**逐张注入**的变量
       （第 i 张只放第 i 种手法、只有落在连拍组里的那几张才拿到 series 那句、
        人物形态按第 i 张自己的那一档 —— 批 DC 续-16 起 `person` 也不再是字段）。
       这里**显式登记**，好让 `media-skill-run-0917` ② 那条"brief 里的占位符必须对得上"的判据
       继续抓真写错的 key（既不放过 typo、也不误伤运行期注入）。
       ⚠️ 少登记一个的后果很具体：那条门禁会报「brief 用了不存在的字段：person」——
          它是对的，`person` 确实不在 `fields` 里了（本批第一次跑全量就撞到了）。 */
    injectedBriefKeys: ['shots', 'series', 'person'],
    /* 批 DC 续-15：清单每一行上加一颗「连拍」标记（别的技能的清单不适用，所以由技能自己声明）。 */
    modulesSeries: true,
    /* ═══ 批 DC 续-16：清单**插在「本篇方案」之后**（用户「你的连拍组去哪了呢」）════════════════════
       原来清单一律排在所有字段组之后，而这一页的「版式族」是四张长卡片，
       连拍药丸被压在底下 —— 滚过去才看得见，截图停在版式族与提交条之间就"找不到"了。
       ⚠️ **组名必须与下面 fields 里某一条的 `group` 逐字一致**；对不上时 WorkbenchShell
          会退回"排在最后"（不会把这块弄丢，但上移就失效了）。写错的后果是静默的，
          所以下面紧跟一条门禁（concept-set-post-0929）核对这个组名真的存在。 */
    modulesAfterGroup: '本篇方案',
    /* ═══ 2026-09-29 批 DC 续-16：**逐张的人物形态**（批 DC 续-16 推翻"整篇一档"）══════════════════
       用户 2026-09-29 逐字：「那是不是它出来的所有内容都会包含这些人物形态，构图方向，版式组等等的
       选好的选项呢？**那出来的作品岂不都千篇一律了？**」—— 旧实现确实如此（brief 里写死
       「整篇纪律，每一张都遵守：人物形态：{{person}}」）。

       权重 = **402 张逐张实测**，逐条可在**已入库**的调研文档里核对
       （`docs/research/2026-09-27-aura-deep-dive.md:346-359` 的判定表；记法见同文档 :100-113）：
         空镜 206 (51.2%) · 躯干与腿 74 (18.4%) · 只有手 66 (16.4%) · 下半脸 17 (4.2%)
         戴墨镜 13 (3.2%) · 背影 8 (2.0%) · 画中画 7 (1.7%) ·（侧脸 2 + 正脸 1 我们**不做**那两档）
       合计 400（另两张是 n7/n41 两条单图视频笔记，不参与篇内分布）。
       篇内混用率：**39 篇多图笔记里 34 篇 = 87.2%**（剩下 5 篇统一的都是 100% 空镜纯静物篇）。
       ⚠️ 原始逐张标注脚本 `.tmp/xhs/aura-deep-2026-09-27/classify.cjs` **不入库**（原始素材同理），
          但它已登记在同一份 deep-dive 的脚本表里（:486），与姊妹篇惯例一致 ——
          **引用一律指向上面那份入库文档**，不要只指一个别人打不开的临时目录。

       ⚠️ 只声明 `person`：**构图方向不做逐张化** —— 实测它篇内基本不变
         （只有 3/41 篇同时出现左→右与右→左），逐张化它等于造一个实测里不存在的形态。
       ⚠️ **版式族也不做逐张化**，理由是结构性的：拼版是「把 N 张合成**一张**」，
         `layoutSheetPlan` 一张画布一套背景/相纸/文件名，压根没有"第 3 张单独用宝丽来"这回事。
         它默认「不拼版」（实测 85% 的图是单图），逐张化只会把拼版引擎重写一遍而换不到任何东西。 */
    shotMix: {
      person: {
        '画面里不出现任何人物（空镜或纯静物）': 51.2,
        '人物出现躯干与腿部，额头以上整体出画（画面里看不到头）': 18.4,
        '人物只出现手或手臂，头部与其余身体全部出画': 16.4,
        '人物只出现下半脸（唇、鼻、下巴），额头以上整体出画': 4.2,
        '人物可以出现头部，但一律戴墨镜遮住眼睛，把墨镜当成造型元素': 3.2,
        '人物只出现背影或侧脸（后脑、头发，或未正对镜头的侧影）': 2.0,
        '人物的脸只作为「画面里的照片、杂志页或广告牌」出现（画中画），本人不出现在镜头前；相框或纸面本身是画面的一部分': 1.7,
      },
    },
    /* 逐张分配出来的形态要在清单每一行上**看得见、也改得动**（用户看得出这不是随机的）。 */
    modulesPerson: true,
    /* ⚠️ 2026-09-29 批 DC 续-8：这三格被「生成配置」那一行触发器**收进面板**了，但**声明仍在** ——
       它们是取值与报价的真源（默认比例、张数、尺寸、按钮上的积分都从这儿算）。
       提到字段数组外面，是为了让 `genConfig.specFields` 能**引用同一批对象**而不是复制一份 ——
       复制的话，改比例选项就要改两处，迟早改漏。 */
    fields: [
      /* ═══ 2026-09-28 批 DC 续-7：参考图**排第一**（用户批注图1-②，原话：
        「这个参考图放的太下面了，你看看其他所有的子页面，他们的参考图都是在最上面的」）════════
         站内约定是一个数字：44 个带 upload 的图片 skill 里 **41 个把上传区排第一**（视频侧 3/3 也是），
         这一条原来排在**第 7 位**，是全仓偏离最大的一个。
         ⇒ 移到这里。`groupFields` 按**组名首次出现**排序，所以组序也自动跟着改：
           第一组从「本篇方案」变成「素材」—— 上传在顶、正文在下，与其余子页面一致。 */
      { key: 'assets', label: '参考图', kind: 'upload', maxImages: 3, role: 'reference', group: '素材',
        slotLabel: '上传主体或风格锚', hint: '可选。上传 1~3 张作为这一套的主体与风格锚，最多 3 张' },
      /* ═══ 本篇张数（三档规模预设，2026-09-28 批 DC 续-7）════════════════════════════════════
         排在「本篇方案」组**第一位**、且就在下面那份勾选清单的上方 ——
         用户的原话是「**你这个工作台里面并没有给我张数呀**」，所以这一格必须在**看得见的地方**。
         它是既有 `segmented` 档（不许新造第五种控件），改它 = 把清单重置成对应的前 N 种手法
         （`applyConceptShotPreset`），用户仍可在下面清单里逐项增删。
         ⚠️ label 必须 ≤6 字（test/concept-set-workbench-0925 ① 守着）→「本篇张数」正好 4 个。 */
      { key: 'shotPreset', label: '本篇张数', kind: 'segmented', group: '本篇方案',
        default: CONCEPT_DEFAULT_PRESET,
        /* ⚠️ 2026-09-28 批 DC 续-7（真机截图后补）：这一栏是**三选一**，就该读成一行三颗。
           不声明的话默认列宽 minmax(min(140px,100%),1fr) 在 386px 的内容列里是 2 列 ⇒ 排成 2+1，
           第三颗孤零零占一行、右侧留一个洞。写 `columns: 3` 让 FieldRenderer 透出 data-columns。 */
        columns: 3,
        options: CONCEPT_SHOT_PRESETS().map(item => ({ value: item.value, label: `${item.label} ${item.count} 张`, hint: item.hint })),
        hint: '按张计价。选完自动勾好对应的手法，下面清单里可以再增删' },
      { key: 'theme', label: '主题意象', kind: 'select', required: true, group: '本篇方案',
        /* 20 条母体由 `conceptThemeOptions()` 拼出（色簇只在 CONCEPT_PALETTES 里定义一次）。 */
        options: conceptThemeOptions() },
      /* ═══ 2026-09-29 批 DC 续-16：**`person` 从字段数组里移出去了** ══════════════════════════════
         它不再是"全篇一档"的那个下拉，而是**清单每一行各自一档**（`shotMix` 声明 + 逐张分配，
         见本文件 `modulesPerson` / `shotMix` 那一段，以及 skillRun.skillShotMix）。
         移出字段数组的三个连带理由：
           ① 它一进 `fields`，`groupFields` 就会把它排成一个**全篇共用**的控件 ——
              而那正是用户说的「那出来的作品岂不都千篇一律了」；
           ② `required: true` + 全篇默认值这个组合只在"全篇一档"下才讲得通；
           ③ 清单里逐行显示之后，左栏再放一份**同名**的控件就是两处各记一份。
         ⚠️ 逐张分配出来的值仍然叫 `person`（brief 模板里的 `{{person}}` 一个字没改）——
            变的是**它按第几张取**，不是它在提示词里的位置。 */
      /* ═══ 构图方向（**全篇一档**，刻意不做逐张化）════════════════════════════════════════════
         默认 = **居中/无方向**（实测：63.7% 的图没有横向引导、真有横向引导的只有 8.2%）。
         ⚠️ 批 DC 续-16 **去掉了 `disabledWhen: {key:'person'}`**：人物形态逐张化之后，
           字段级判据接不上（"这一篇的人物形态"已经不存在了），留着就是一条**永不触发的死规则**。
         ⇒ 那条规则挪到了 `skillRun.skillValuesForShot` 里**逐张判**：这一张是空镜就把方向
           夹回「居中/无方向」（实测口径：静物本就没有横向引导）。
         ⚠️ 不做「镜像成对」那一档：实测 0 组可确证（4 组弱候选 / 16 组目视怀疑被原图否定）。 */
      { key: 'direction', label: '构图方向', kind: 'segmented', group: '本篇方案',
        default: CONCEPT_DIRECTION_OPTIONS()[0].value,
        options: CONCEPT_DIRECTION_OPTIONS(),
        hint: '全篇一档。清单里标成「空镜」的那几张会自动按居中/无方向出图，不吃这一栏' },
      /* ═══ 同机位连拍：**这一栏改成在清单里逐张标**（2026-09-29 批 DC 续-15，推翻批 DC 续-3）════════════
         实测依据（`docs/research/2026-09-27-aura-composition-direction.md` §四-3，报告原话）：
         「他的篇级做法是"**一个版式/机位连着用几张，每张换道具/换材质/换文案**"，而不是"每张都换构图"」
         —— 落在 21 篇的同机位簇里，**占比随阈值在 12%~27% 之间**（TH=0.14 时是 74/402 = 18.4%；
         ⚠️ 那个数**不是**稳定值，TH=0.12 → 11.7%、TH=0.16 → 26.9%，脚本默认 0.06 时只有 4 张。
         **引用一律写区间，不许把 18.4% 当确定值** —— 这是批 DC 续-15 起就存在的引用缺陷，
         批 DC 续-17 才查出来）。

         ⚠️⚠️ 批 DC 续-3 把这一栏做成「不做 / 前 2 张 / 前 3 张」，依据是一行注释：
           「为什么不做"任意挑哪几张"：那要再长一个多选控件，而**实测里连拍簇本来就是从第一张开始
             连着的**。」
           **用户 2026-09-29 当面推翻**（逐字）：「这个连拍组为什么一定要前两张三张呢，这样生成不就一定
             会占用到封面第一张图吗，**我们模仿的那个账号也是这样做的吗？**」

           **重算了那份原始聚类（`TH=0.14`，74/402 完全复现），那句依据不成立**：
             · 23 个簇里只有 **5 个**含首图（n4:1/7/8/10、n15:1/8、n29:1/4/5/6/7/8/10、
               n31:1/2/3/6/7、n36:1/5）；
             · **21 篇里 16 篇（76%）的封面根本不在连拍簇里**；按张数 **74 张里 54 张（73%）**
               所在簇**不含**首图；
             · 簇**不是开头连续段**，多是中段连着（n19: 3/4/5/7/10/11、n23: 4/5/9/11、n40: 2/3|4/5）；
             · 那 5 篇里首图在簇中时，它本身是**拼版页**而不是静物。
           ⇒ 「前 N 张」不但依据不成立，还**必然占用封面**（清单第 1 项就是概念静物）。

         ⇒ 现在**没有这一栏**：标记长在**本篇手法清单的每一行上**（复用已有的可勾选清单，
            不新造第五种控件）—— 用户勾哪几张，哪几张共享那条纪律。
            封面**不再被自动占用**；真要把封面放进连拍组，是用户自己标的。
            取值见 `values.seriesNames`（名字数组），注入见 `skillRun.skillSeriesClause`。 */
      /* 版式族（每篇一档）：只决定版式层**怎么拼**，不进提示词（见上方 CONCEPT_LAYOUT_FAMILIES）。
         ⚠️ 2026-09-28 起**默认「不拼版」**（用户指出"为什么一定要选"；实测 85% 的图是单图）。 */
      { key: 'layout', label: '版式族', kind: 'cards', group: '本篇方案',
        default: LAYOUT_FAMILY_NONE, options: CONCEPT_LAYOUT_FAMILIES() },
      /* 可选补充：占位符**单独成句**（模板里写成 `{{notes}}。整篇纪律…`）——
         这样它为空时不会留下「补充：」这种半截话（既有清理逻辑只压缩标点，删不掉词）。 */
      { key: 'notes', label: '补充', kind: 'textarea', rows: 2, group: '本篇方案',
        placeholder: '可选：这一篇还想强调什么（例如"要有水珠反光""道具用陶土与干枝"）' },
      /* ═══ 模型选择（2026-09-28 批 DC 续-5：用户点名"最火的不是 image2.5 吗，我不能用上吗"）═══
         之前这一页**锁死 image2**，理由是"唯一有真实出图记录的模型"；但 GPT Image 2.5（Sunburst/Flare）
         早在 9-13 就接通了（上游 gpt-image-2.5-sunburst/flare-*，计费 SKU/标签齐全），
         一直只在别的页面可选 —— 对这一页是"做出来了却不给用"。
         现在**开放**：选项/价格全部来自目录（modelField 这一份），默认仍是 GPT Image 2
         （通用主力 + 全场最便宜），选 2.5 时 CTA 上的积分自动变（1.5/张@2K）。
         ⚠️ 一篇 N 张仍然**同一个模型** —— 这一条不放开：混模型的颗粒不统一，
            "像同一次拍摄"就破了（这是锁模型的本意，锁的从来不是"用户不能选"）。 */
      modelField(),
      /* ⚠️ 比例默认档要**覆盖成 3:4** —— 这是本账号签名的一部分（实测 Aura 41 篇全是竖版），
         而 ratioField() 的兜底默认是 1:1。不覆盖的话，"默认值跑出来的是方图"就与签名不符。
         ⚠️ 2026-09-28 批 DC 续-7（用户批注图3-①，原话：「**这个分辨率它自己占了一整行**
           呀，我们这个生图的这个设置应该**两个控件在同一个行上面**」）：
           两格各 `span:'half'` 走**已存在**的两列机制（FieldRenderer 的 data-span →
           WorkbenchShell.css 的 grid-column: span 1），不新造第三种排法。
           比例标签同时换成 **RATIO_BARE**（纯「1:1 / 2:3 / …」）：半宽放不下 7 个长标签
           （「3:4 竖版海报」7 个字 × 7 档），而知渔的「平面转建筑效果图 / 建筑九宫格分镜」
           实测就是这种纯数字写法（imageSkills.js RATIO_BARE 上方的注释记着这次实采）。 */
      /* ⚠️ `maxVisible: 8` 是**真机截图后**加的：ratioField() 会给所有图片技能在前面插一档
         「自适应」（批 R），所以这一栏是 8 个选项；FieldRenderer 的默认折叠上限是 6
         （`options.length > limit + 1` 才折叠）⇒ 8 > 7 ⇒ 折成「6 颗 + 一颗『更多』」，
         **9:16 与 16:9 被藏起来了**。用户早就批过这种折叠
         （「更多，如果只有一个的话，那你为什么一定要有这个更多呢」），
         而这一栏的语义恰恰是"从比例里选一个"—— 藏两档就是让用户看不见可选项。
         现在标签已经换成纯数字（半宽放得下），一屏 4 行与原来一样高，没有代价。
         ⚠️ 2026-09-29 批 DC 续-8：下面那个 `genConfig` 按 **key** 引用这三格
            （`modelKey` / `specKeys`），所以这一段注释描述的仍是**实际生效的那三格**。
            ⚠️ 三格**仍然留在 fields 里** —— 它们是取值与报价的真源，`covers` 只影响**渲染**。 */
      { ...ratioField(RATIO_BARE), default: '3:4', maxVisible: 8 },
      { ...clarityField() },
      /* ═══ 2026-09-29 批 DC 续-8：把上面三格收成**两颗触发器**（生图模型 / 画面规格）════════════════
         用户 2026-09-29 逐字：
           「你不可以像首页这样就是做成一个**生图模型的按钮和面板**，还有一个**画面规格的一个按钮和面板**吗？
             你就只排两个按钮进去子页面里面不就好了吗？……**你为什么要把子页面的规划搞得乱七八糟呢？**」
         实测（真机截图，改之前的左栏）：8 行模型列表 + 8 档比例 + 3 档清晰度 = **近 700px**，
         一屏放不下、要滚，而且"生成设置"这一组看起来像一张参数表而不是一个能点的操作台。
         ⇒ `covers` 让 WorkbenchShell 把那三格**从左栏网格里剔掉**，原地只留这一行触发器。
         ⚠️⚠️ 那三格**仍然留在 fields 里**（上面三行一个字没删）—— 它们是**取值与报价的真源**：
            删掉的话 `initialSkillValues` 拿不到默认比例、`skillGenerationSettings` 算不出张数与尺寸、
            按钮上的报价也会跟着错。`covers` 只影响**渲染**，不影响**声明**。
         ⚠️ `modelField` / `specFields` 引用的是**上面那三个同一个对象**（不是复制），改选项只有一处。
         ⚠️ 这一格自己也必须在同一组里（`group: '生成设置'`），否则剔完那三格会连组标题一起消失。
         ⚠️ 本批**只给这一条技能**用（用户选择：先这一条落地验收，再全站铺）。
            铺的时候只改声明、不碰页面 —— 那是"声明驱动"这个设计的全部意义。 */
      { key: 'genConfig', label: '生成配置', kind: 'config', group: '生成设置',
        /* 组标题已经写着「生成设置」，这一格再画一遍「生成配置」就是同一句话说两遍 ——
           而且按 2026-09-29 的着重号口径，**可操作区**才该被强调，组标题不该压过它。
           这里只留两颗按钮（它们各自有小标题「生图模型 / 画面规格」），字段标题不画。 */
        hideLabel: true,
        covers: ['imageModel', 'ratio', 'clarity'],
        /* ⚠️ 这里只给**key**，不嵌整份字段对象 ——
           ① 嵌进去会出现「同一个 key 在这条技能里出现两次」（`skill-declaration-contract-0916` ②
              判的就是"同一 Skill 内 key 必须唯一"，那是对的：被收起的字段仍然是**字段**，
              再塞一份同样的对象进另一个字段，等于声明了两次）。
           ② 更重要的是**只有一份真相**：面板里要渲染的就是 fields 里那几条，按 key 取回即可，
              复制一份的话改比例选项就会漏改一处，而漏的那一处会静默不生效。 */
        modelKey: 'imageModel',
        specKeys: ['ratio', 'clarity'] },
    ],
    cases: [], history: true,
  },
];

/* ═══ 批 1003（2026-10-03）：把「模型选择 / 分辨率 / 比例」收进**两颗触发器** ═══════
   用户原话（逐字，批 DC 续-8 说过一次，批 1003 又追问「你为什么现在全部都要让它张开出来呢」）：
     「你不可以像首页这样就是做成一个**生图模型的按钮和面板**，还有一个**画面规格的一个按钮和面板**吗？
       你就只排两个按钮进去子页面里面不就好了吗？」
     「图片生成和视频生成**全局**都要去按这种方式去处理……几十个子页面都要去这样做呀。」

   为什么改这一处而不是逐条技能加声明：
     · `image.concept_set`（概念视觉方案）**已经是这个形态**了（批 DC 续-8 落地），
       样板与共用组件 `ConfigTriggers` 都在（FieldRenderer 的 `kind === 'config'` 分支）；
     · 但当时批注里明写着「本批**只给这一条技能**用（用户选择：先这一条落地验收，再全站铺）」，
       于是 **49 条图片技能里只有这 1 条**收起了，其余 42 条仍然把三格平铺在左栏。
     · 逐条手写 = 42 个出错机会（漏一条就是那个页面照旧张开）。
       而这套 UI 本来就是**声明驱动**的（`dropCoveredFields` 按 `covers` 剔网格），
       所以在这里统一注入，**只改一处**，漏不掉。

   降级形态是组件本来就有的：`ConfigTriggers` 收 `triggers` prop，
   `modelKey` 没声明时**只渲染一颗规格触发器**（批 DC 续-19）——
   46 条图片技能本来就没有模型选择器，不该为了统一硬塞一颗不存在的按钮。

   不动的：
     · `pipeline` 是 embed 的技能（`xhsNote` 等）—— 它们的左栏**不渲染通用字段网格**，
       注入的声明不会被渲染，等于白加；等需求 A 定了那批工作台再处理。
     · 已经有 config 声明的（`concept_set`）。
     · 三格一个都没有的（`product_suite` / `aplus` / `white_bg` / `multi_angle` / `remove_bg`）。 */
const CONFIG_TRIGGER_KEYS = ['imageModel', 'ratio', 'clarity'];
const CONFIG_TRIGGER_GROUP = '生成设置';

/** 与 skillRun.js 的 skillEmbedOf **同一份判据**，不是另写一遍。
    （skillEmbedOf: pipeline==='xhsNote' 或以 'video' 开头 ⇒ embed） */
function isEmbedPipeline(pipeline) {
  return pipeline === 'xhsNote' || (typeof pipeline === 'string' && pipeline.startsWith('video'));
}

function configTriggersFor(skill) {
  if (!skill || !Array.isArray(skill.fields)) return null;
  /* embed 的技能左栏**不渲染通用字段网格**，注入的声明不会被看到 —— 不做无用功。
     那批工作台本身要按需求 A 定制，等那一批定稿再处理。 */
  if (isEmbedPipeline(skill.pipeline)) return null;
  if (skill.fields.some(field => field && field.kind === 'config')) return null;   /* concept_set 已声明 */
  const keys = CONFIG_TRIGGER_KEYS.filter(key => skill.fields.some(field => field && field.key === key));
  if (!keys.length) return null;
  const hasModel = keys.includes('imageModel');
  /* 这一格必须与被收起的那几格**同组**，否则剔完那几格会连组标题一起消失 */
  const group = (skill.fields.find(field => field && keys.includes(field.key)) || {}).group || CONFIG_TRIGGER_GROUP;
  return {
    key: 'genConfig', label: '生成配置', kind: 'config', group,
    /* 组标题已经写着「生成设置」，两颗按钮各自带小标题，字段标题再画一遍就是同一句话说两遍 */
    hideLabel: true,
    covers: keys,
    /* 只给 key，不嵌整份字段对象：被收起的仍然是**字段**，
       面板里渲染的也是 fields 里那几条（FieldRenderer 的 config 分支按 key 取回）。
       嵌一份会出现「同一 key 在这条技能里出现两次」，且改选项会漏改一处。 */
    ...(hasModel ? { modelKey: 'imageModel' } : null),
    specKeys: keys.filter(key => key !== 'imageModel'),
  };
}

/* 原地改，不另开一个数组导出 ——
   另开 `IMAGE_SKILLS_WITH_CONFIG_TRIGGERS` 的话，每个 import 处都得记得换，
   漏一处那个页面就照旧张开，正是这次要消灭的现象。
   声明在模块加载时统一注入，所有既有 importer 自动生效。 */
export const IMAGE_SKILLS_WITH_CONFIG_TRIGGERS = (() => {
  const ids = [];
  for (const skill of IMAGE_SKILLS) {
    const declaration = configTriggersFor(skill);
    if (!declaration) continue;
    skill.fields = [...skill.fields, declaration];
    ids.push(skill.id);
  }
  return ids;
})();

/**
 * 一条 skill **用户看得见**的字段序列 —— 量的是界面，不是声明表。
 *
 * 为什么需要它：config 触发器把 ratio / clarity / imageModel 收进浮层后，
 * 声明表里**多了**一条 `genConfig`，但界面上是「三格 → 一行两颗按钮」，
 * 可见字段反而**没变多**。直接拿 `skill.fields.length` 去量复杂度，
 * 会把「换个容器」误判成「变复杂了」。
 *
 * 规则：剔掉 config 触发器本身，它 covers 的那几格照旧算（它们仍是字段，
 * 只是搬进了面板 —— 能力一条都没少）。**两边不许各写一份**，都从这里取。
 */
export function visibleFieldsOf(skill) {
  const fields = Array.isArray(skill && skill.fields) ? skill.fields : [];
  return fields.filter(field => !(field && field.kind === 'config'));
}

export const IMAGE_SKILL_CATEGORIES = [...new Set(IMAGE_SKILLS.map(skill => skill.category))];

export function getImageSkill(id) {
  const key = typeof id === 'string' ? id.trim() : '';
  /* __proto__ / constructor 这类键必须返回 null（声明表不是对象原型链） */
  if (!key || !key.startsWith('image.')) return null;
  return IMAGE_SKILLS.find(skill => skill.id === key) || null;
}
