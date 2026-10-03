/* ═══════════════════════════════════════════════════════════════════════════
   尺寸里的「自适应」—— 2026-09-29 批 CY-⑭（画布 + 首页共用一份实现）
   ═══════════════════════════════════════════════════════════════════════════

   用户原话（逐字，这是他对"自适应"的完整设想）：
     「关于图片的尺寸，这个点我认为我们其实有一个可以商讨的空间。就是是不是应该在尺寸的**最前面**
       加入一个**自适应**的一个选项，我看我们的竞品他们都是有这个选项的。如果有这个选项的话，背后的逻辑
       应该怎么做呢？你有没有去深度的想过这个问题呀？我觉得他的逻辑应该是**由他那个模型去判断**生成出来
       的图片或者视频他们是什么样的一个尺寸吧？还有就是**用户他们自己在提示词里面写了一个什么样的尺寸**，
       所以最终生成出来就是会按用户的提示词里面写到的尺寸去生成出来，**那他的这个选项就应该匹配到这个
       自适应的这个选项上**呀。
       因为目前的情况是用户生成出来的作品，你在这个尺寸这里面它是会默认到一个比如说 1:1 之类的这种尺寸上。
       可是实际上当用户他真的有在提示词里面写到他需要这张作品生成成一张什么样尺寸的图片的时候，
       你却把它套到了这个 1:1 上，我觉得就很不对。」

   竞品证据（用户自己截的图，不是我们推测的）：
     · 知渔**图片生成**有「自适应」→ 我们跟。
     · 知渔**视频生成没有**「自适应」→ 视频侧不做。
   视频侧还有一个硬约束：上游 `server/videoGeneration.mjs` 对不在白名单里的比例直接 **400 拒绝**
   （不是静默回落），而且 `test/quantv-video-parity-machine-0920.test.mjs` 逐字比对着知渔的视频比例档。
   ⇒ **本批只给图片侧加「自适应」**，与用户提供的竞品证据一致。

   解析顺序（就是用户描述的那条链，优先级从高到低）：
     ① 提示词里**明确写了**尺寸/比例（`parseSizeMentions`：`16:9` / `1920x1080` / 「竖版」「横屏」…）
     ② 参考图的**实测宽高**就近取一档（`nearestLegalRatio`，与技能侧同一实现）
     ③ 都没有 → 1:1
   纯函数、零网络、零 API 消耗（用户问「有没有成本」——这里是 0）。

   另外一条用户点名的事实性不满，本模块也一并解决：
     「目前的情况是用户生成出来的作品，你在这个尺寸这里面它是会默认到一个比如说 1:1」
     ⇒ 选了「自适应」之后，**结果回来时应当自己落到真实那一档**，
       而不是永远显示 1:1。这由 index.jsx 的 `handleMediaNaturalSize` 承担
       （批 CY-⑭ 那一半：节点按素材真实比例改写 ratio）——两半合起来才闭环。
   ═══════════════════════════════════════════════════════════════════════════ */

import { parseSizeMentions } from '../Home/ec/promptSizeConflict.js';
import { nearestLegalRatio, ADAPTIVE_RATIO, FALLBACK_RATIO } from '../../skills/skillRun.js';

export { ADAPTIVE_RATIO };

/**
 * 「自适应」→ 具体比例。
 *
 * ⚠️ 2026-10-04 起**不在生产链路上**，只为测试与调试保留，**不要把它接回去**。
 *   自适应的新口径是「**不指定比例**，交给上游按内容分配宽高」
 *   （见 resolveProtocolRatio 与 modelCatalog.resolveGenerationSize 的 autoRatio）。
 *   本函数第 ② 步"按参考图实测宽高就近取一档"正是被用户否掉的那条 ——
 *   他把 2200×1927（1.142）的原图传进来，我们自作主张吸到 5:4，比例变形 9.5%。
 *   留在这里是为了让"我们为什么不再按参考图取档"这件事在代码里查得到。
 *
 * @param {object} input
 * @param {string} input.prompt        提示词（用户可能写了尺寸）
 * @param {{width:number,height:number}|null} input.referenceBox 参考图实测宽高
 * @returns {{ratio:string, source:'prompt'|'reference'|'fallback', raw:string}}
 */
export function resolveAdaptiveRatio({ prompt = '', referenceBox = null } = {}) {
  /* ① 提示词里明确写了尺寸 —— 用户明确表达过的意图，优先于任何自动判断 */
  const mentioned = parseSizeMentions(prompt)[0];
  if (mentioned?.ratio) {
    return { ratio: mentioned.ratio, source: 'prompt', raw: mentioned.raw };
  }
  /* ② 参考图的实测宽高 */
  const fromBox = nearestLegalRatio(referenceBox?.width, referenceBox?.height);
  if (fromBox) return { ratio: fromBox, source: 'reference', raw: '' };
  /* ③ 都没有 */
  return { ratio: FALLBACK_RATIO, source: 'fallback', raw: '' };
}

/**
 * 把「用户当前选的比例」翻译成**协议比例**（真正进请求的那个值）。
 * 显式档原样返回；只有「自适应」才需要解析。
 * 纯函数，门禁直接断言。
 *
 * ⚠️ 2026-10-03 补：显式档**也要过合法性**。用户反馈「自适配会自动篡改尺寸、
 *   先后产出不一致」，追下来根因之一在这里：`handleMediaNaturalSize` 会把节点的
 *   `ratio` 写成**精确值**（如 '2304:1856'，那是它用来记录素材真实比例的地方），
 *   而这个字段同时又是「下一次生成的面板比例」的取值来源。于是精确值被原样发到服务端，
 *   它不在合法档表里 —— 服务端要么 400（本次收紧后），要么静默回落 1:1（收紧前）。
 * ⇒ 任何不像合法档的值都**就近吸附**到合法档，而不是原样透传。
 */
export function resolveProtocolRatio({ ratio = '', prompt = '' } = {}) {
  const asked = String(ratio || '').trim();
  /* ── 规则只有三条（用户 2026-10-04 拍板）──────────────────────────────
     ① 用户选了具体档位  → 照做，一个字不改。
     ② 提示词里写了尺寸   → 按它（用户明确表达的意图，比档位更硬）。
     ③ 其余（自适应）    → **不指定比例**，交给上游按内容自己分配宽高。
     ─────────────────────────────────────────────────────────────────
     ③ 是这一版的重点。此前这里是"按参考图实测宽高就近取一档"，那正是用户
     投诉的"自适配自动篡改我的尺寸"：他把原图 2200×1927（1.142）贴进来，
     我们自作主张吸到 5:4，比例变形 9.5%。
     实测依据（2026-10-04，本项目自己付费跑）：
       · image2 不传 size  → 一律 2048x2048 方图
       · nano  不传 aspect → 1376x768 横图（内容相关，横构图合理）
     竞品的自适应档正是这个口径：「固定总像素量级 + 模型按内容分配宽高」。
     画质档（1K/2K/4K）照传 —— 那才是"固定总像素量级"。 */
  if (asked && asked !== ADAPTIVE_RATIO) {
    /* 显式档也要过合法性：`handleMediaNaturalSize` 会把节点 ratio 写成 '2304:1856'
       这种精确值，而它又是下一次生成的面板比例来源，原样外发会被服务端拒。
       合法档代入会原样返回（对数距离 0），所以这里一律吸附即可。 */
    return nearestLegalRatioFromText(asked) || FALLBACK_RATIO;
  }
  const mentioned = parseSizeMentions(prompt || '')[0]?.ratio || '';
  return mentioned || '';
}

/** 把一段比例文本（'5:4' / '5：4' / '5x4' / '2304:1856'）就近吸附成合法档。 */
function nearestLegalRatioFromText(text) {
  const match = String(text || '').trim().match(/^(\d{1,5})\s*[:：x×]\s*(\d{1,5})$/i);
  if (!match) return '';
  return nearestLegalRatio(Number(match[1]), Number(match[2]));
}

/**
 * 从一组源节点算出协议比例 —— 画布上**每一条**出图路径都必须过它。
 *
 * ⚠️ 为什么是模块级而不是组件里的 useCallback（2026-10-03 修）：
 *   此前只有 `index.jsx` 的 `protocolRatioFor` 一个 useCallback 做了转换，而它定义在
 *   组件中部；工作流节点、inpaint/transform、节点重生成、文本驱动出图这 4 类调用点
 *   都在它**之前**。若直接引用它就得把函数体前移或塞进那些位置的 deps 数组 ——
 *   后者正是 2026-09-02 那次整页白屏的成因（TDZ：定义在后面却被 deps 引用）。
 *   模块级 import 没有这个问题，且能真正做到"一处实现、所有路径共用"。
 *
 *   这几处漏转换的实际后果不是"少了功能"，而是**静默给错结果**：
 *   '自适应' 原样进请求体 → 服务端 resolveGenerationSize 判定它不在尺寸表里 →
 *   回落到 1:1（不报错、不提示）。用户在面板上选了自适应，拿到的是 1:1。
 *
 * @param {object} input
 * @param {string} input.ratio         面板当前选中的那一档（可能是 ADAPTIVE_RATIO）
 * @param {string} input.prompt        提示词，自适应时用于解析用户写明的尺寸
 * @param {Array}  input.sourceNodes   源节点，用于按实测宽高就近取一档
 * @returns {string} 真正进请求体的比例
 */
/**
 * 从一组源节点算出协议比例 —— 画布上**每一条**出图路径都必须过它。
 *
 * ⚠️ 为什么是模块级而不是组件里的 useCallback（2026-10-03 修）：
 *   此前只有 `index.jsx` 的 `protocolRatioFor` 一个 useCallback 做了转换，而它定义在
 *   组件中部；工作流节点、inpaint/transform、节点重生成、文本驱动出图这 4 类调用点
 *   都在它**之前**。若直接引用它就得把函数前移或塞进那些位置的 deps 数组 ——
 *   那正是 2026-09-02 那次整页白屏的成因（TDZ：定义在后面却被 deps 引用）。
 *   模块级 import 没有这个问题，且能真正做到"一处实现、所有路径共用"。
 *
 * ⚠️ 为什么"取第一个能量的节点"而不是"取第一个节点"（用户 2026-10-03 反馈）：
 *   `normalizeCanvasNode` 不给 naturalWidth / ratio / size 任何默认值，它们只在
 *   图片 `onLoad` 之后才被 `handleMediaNaturalSize` 填上。所以旧写法
 *   `list.find(...) || list[0]` 里的 `list[0]` 在图还没加载完时是**量不出尺寸**的，
 *   而点生成的那一刻图加载没加载完是随机的 ⇒ 同一个合成器，先点一次是 1:1、
 *   过几秒再点一次就变成参考图那一档。这正是用户说的"先后产出的尺寸不一致"。
 *   ⇒ 量不出来的节点直接跳过；全都量不出来就走 fallback，不再"猜"第一个。
 *
 *   仍然**不用** node.w / node.h 兜底：那是节点在画布上的显示框，用户可以随便拉，
 *   拿它当素材真实比例会把"我拖了一下框"变成"出图比例变了"。
 */
export function protocolRatioForNodes({ ratio = '', prompt = '' } = {}) {
  /* ⚠️ sourceNodes 参数**故意不再参与**（2026-10-04）。它曾经是"按参考图实测宽高
     就近取一档"的来源，也就是用户说的"自作主张替他匹配最近的标准尺寸"。
     现在自适应一律不指定比例，参考图再大再小都不影响 —— 只有提示词里写了尺寸才算。
     保留这个形参是为了**不改动 6 处调用点**；它只是被忽略。 */
  return resolveProtocolRatio({ ratio: String(ratio || '').trim(), prompt: prompt || '' });
}

/* 2026-10-04 删除了 referenceBoxOf / boxFromRatioText：它们只服务于「按参考图实测宽高
   就近取一档」，而那条规则已被移除（自适应改为不指定比例）。留着就是死代码。 */

/** 「自适应」这一档在**尺寸列表**里排在第一位（用户：「是不是应该在尺寸的最前面加入」）。 */
export function withAdaptiveRatioOption(options, { adaptiveLabel = ADAPTIVE_RATIO } = {}) {
  const list = Array.isArray(options) ? options : [];
  if (list.some(item => (typeof item === 'string' ? item : item?.value) === adaptiveLabel)) return list;
  return [adaptiveLabel, ...list];
}
