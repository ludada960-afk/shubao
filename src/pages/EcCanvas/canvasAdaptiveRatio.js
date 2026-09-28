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
 */
export function resolveProtocolRatio({ ratio = '', prompt = '', referenceBox = null, fallback = FALLBACK_RATIO } = {}) {
  const asked = String(ratio || '').trim();
  if (asked && asked !== ADAPTIVE_RATIO) return asked;
  return resolveAdaptiveRatio({ prompt, referenceBox }).ratio || fallback;
}

/** 「自适应」这一档在**尺寸列表**里排在第一位（用户：「是不是应该在尺寸的最前面加入」）。 */
export function withAdaptiveRatioOption(options, { adaptiveLabel = ADAPTIVE_RATIO } = {}) {
  const list = Array.isArray(options) ? options : [];
  if (list.some(item => (typeof item === 'string' ? item : item?.value) === adaptiveLabel)) return list;
  return [adaptiveLabel, ...list];
}
