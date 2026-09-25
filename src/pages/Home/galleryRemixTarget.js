/* ══════════════════════════════════════════════════════════════════════════════════════════════
   批 BP-3：「做同款」的目标与种子（纯函数，页面与门禁共用同一份判断）

   用户原话（逐字）：
     「就是我点击首页下面的案例区我点击做同款，为什么还是有之前的四个板块呢，这四个板块本来就
      不该再出现在任何地方了呀，然后**做同款你应该匹配到我们现在的图片生成的区域里面呀**」

   改前：点「做同款」只调 `restoreCheckpoint` 把首页**旧的工作台**滚出来（`#creation-workbench`），
   于是用户看到的是那套老的四块电商流程 —— 那正是用户说"不该再出现"的东西。
   改后：**跳进「图片生成」总页面**，并落到该案例对应的**技能子页面**，把案例的素材与提示词带过去。
   ⚠️ 一切只预填、**不触发生成**：扣费仍要用户再点一次 CTA（与 charge-requires-confirmation 一致）。 */

/* 案例 → 技能子页面。取不到就返回空串 ⇒ 落到「图片生成」Hub（也比留在旧工作台正确）。 */
const ECOMMERCE_RECIPE_SKILL = {
  product_suite: 'image.product_suite',
  anything_tryon: 'image.try_on',
};

/* 视觉创作那几条的 skillId（案例 replay 里的写法是短名，不是技能 id） */
const VISUAL_SKILL = {
  poster: 'image.poster',
  'social-cover': 'image.social_cover',
  'brand-kv': 'image.brand_kv',
};

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** 这个案例应该落到哪条图片技能（空串 = 没有对应的技能，落 Hub）。 */
export function remixSkillIdOf(checkpoint) {
  const project = checkpoint?.project || {};
  const snapshot = checkpoint?.version?.inputSnapshot || {};
  const kind = text(project.kind);
  if (kind === 'ecommerce') {
    const recipeId = text(snapshot.abilityRecipe?.id) || 'product_suite';
    return ECOMMERCE_RECIPE_SKILL[recipeId] || '';
  }
  if (kind === 'visual') return VISUAL_SKILL[text(snapshot.skillId)] || '';
  if (kind === 'xiaohongshu' || kind === 'plog') return 'image.xhs_note';
  return '';
}

/* 案例里的图片 → 技能上传位的值（形状由 FieldRenderer 定义：只有 ready 且带 url 的才算数） */
function uploadValue(images, name) {
  return (Array.isArray(images) ? images : [])
    .map((image, index) => ({ status: 'ready', url: text(image?.url || image), name: `${name}${index + 1}` }))
    .filter(item => item.url);
}

/**
 * 把案例快照映射成这条技能的**初始值**。
 * ⚠️ 只写该技能自己声明过的字段（key 不在 fields 里的一律丢掉）——
 *    写进去一个不存在的 key，界面不显示、参数却下发（本仓最贵的那类 bug）。
 */
export function remixSeedValuesOf(skill, checkpoint) {
  const snapshot = checkpoint?.version?.inputSnapshot || {};
  const fields = (skill && skill.fields) || [];
  const seed = {};
  const uploads = fields.filter(field => field.kind === 'upload');
  if (uploads.length) {
    const product = uploadValue(snapshot.productImages, '案例素材');
    const reference = uploadValue(snapshot.referenceImages || snapshot.referenceImages?.map?.(() => null), '参考图');
    const pool = product.length ? product : reference;
    const secondary = product.length ? reference : [];
    /* 第一个上传位吃主素材；其余上传位按顺序吃参考图（套图只有一个上传位，换装有两个角色位） */
    uploads.forEach((field, index) => {
      const value = index === 0 ? pool : secondary;
      if (value.length) seed[field.key] = value;
    });
  }
  const promptText = text(snapshot.prompt) || text(snapshot.text) || text(snapshot.description);
  if (promptText) {
    /* 文案落点：优先 `productParams`（套图/详情那条链读它），否则第一个 textarea，再否则第一个文本字段 */
    const target = fields.find(field => field.key === 'productParams')
      || fields.find(field => field.kind === 'textarea')
      || fields.find(field => field.kind === 'text' || field.kind === 'input');
    if (target) seed[target.key] = promptText;
  }
  /* 比例/分辨率这类"可选还原"：案例带了就带上，没带就保持默认（不猜） */
  if (text(snapshot.ratio)) {
    const ratioField = fields.find(field => field.key === 'ratio' && (field.kind === 'segmented' || field.kind === 'select'));
    if (ratioField) seed.ratio = text(snapshot.ratio);
  }
  return seed;
}
