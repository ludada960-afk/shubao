/* ══════════════════════════════════════════════════════════════════════════════
   EcAuto「去精修工坊微调」：以前是一个**空手跳转**（批 CY-㉑）

   改前：`onClick={() => dispatch({ type: 'NAVIGATE', page: 'ec-studio' })}`
   —— 只换页面，**不带任何东西**。而 EcStudio 挂载时读的是
   `loadOrCreateEcommerceDraft(...)`，**从不读任何传入载荷**（它的三个 useEffect
   只认 ownerEmail / workVersion）⇒ 用户点「微调」到了一个**空白配置页**，
   刚生成的图一张也没跟过去，手工重新传一遍。
   这与批 CY-⑰ 记的「EcAuto 结果是死胡同」是同一条线的最后一段。

   为什么不去修 EcStudio 让它接收素材？
   —— EcStudio 是**电商方案工作台**（上传商品 → 出方向 → 生成套图），
   它的入参形状是 draftId 体系，给它加一条新入口要动它的草稿轮转与三处重置逻辑，
   而用户点「微调」的**真实意图**是「把这张图拿去继续编辑」——
   真正干这件事的页面是 `image-creation`（MediaCreation），
   它**已经**有成熟的入参落地通道（work-remix / canvas-node-edit / gallery-remix），
   而且是用户 9 月亲自拍板「做同款应该匹配到我们现在的图片生成的区域里面」的那条路。

   ⇒ 所以这里**不新造第三条通道**，复用既有的 `canvas-node-edit` 那一个
   （MediaCreation:1604 已经认这个 kind，载荷形状 skillId / panelValues / prompt / title）。
   ⚠️ 只**预填、不触发生成**：扣费仍要用户在目标页再点一次「立即生成」
   （与 charge-requires-confirmation 一致，绝不静默扣钱）。
   ══════════════════════════════════════════════════════════════════════════════ */

const text = value => (typeof value === 'string' ? value.trim() : '');

/** EcAuto 的结果图 → 技能上传位的值（形状由 FieldRenderer 定义：只有 ready 且带 url 的算数）。 */
function uploadValue(images, name) {
  return (Array.isArray(images) ? images : [])
    .map((image, index) => ({ status: 'ready', url: text(image?.url || image), name: `${name}${index + 1}` }))
    .filter(item => item.url);
}

/**
 * EcAuto 的一键出图结果 → `canvas-node-edit` 的 launch 载荷。
 *
 * ⚠️ 关键约束（照抄 remixSeedValuesOf 的教训）：**只写该技能自己声明过的字段**。
 *    写进去一个不存在的 key，界面不显示、参数却照样下发 —— 那是本仓最贵的一类 bug。
 *
 * @param {object} results   EcAuto 的 results（`{ images: {label: url}, product_name }`）
 * @param {string} prompt    用户在 EcAuto 输入的那段描述
 * @param {string} skillId   目标技能 id
 * @param {object} skill     目标技能定义（读它自己声明的 fields）
 * @returns {object|null} launch；取不出素材或技能时返回 null（调用方要说人话，别静默跳）
 */
export function buildEcAutoStudioHandoff({ results, prompt, skillId, skill } = {}) {
  const images = results?.images || {};
  const urls = Object.values(images).map(text).filter(Boolean);
  if (!urls.length) return null;
  const fields = (skill && skill.fields) || [];
  if (!fields.length) return null;

  const seed = {};
  /* 第一个上传位吃全部结果图；只有一个上传位时多出来的图不再硬塞（塞进去界面也不显示） */
  const uploads = fields.filter(field => field.kind === 'upload');
  if (!uploads.length) return null;
  const primary = uploadValue(urls, '一键出图');
  if (!primary.length) return null;
  seed[uploads[0].key] = primary;

  /* 提示词落点：优先 productParams，否则第一个 textarea，再否则第一个 text/input */
  const promptText = text(prompt);
  if (promptText) {
    const target = fields.find(field => field.key === 'productParams')
      || fields.find(field => field.kind === 'textarea')
      || fields.find(field => field.kind === 'text' || field.kind === 'input');
    if (target) seed[target.key] = promptText;
  }

  return {
    kind: 'canvas-node-edit',
    skillId: text(skillId),
    panelValues: seed,
    prompt: promptText,
    title: text(results?.product_name) || text(prompt).slice(0, 24) || '一键出图结果',
  };
}

/** 这个 launch 能不能落地（技能存在 + 有图 + 有上传位）。给界面决定按钮渲不渲染用。 */
export function canOpenEcAutoStudioHandoff(skill) {
  return Boolean((skill?.fields || []).some(field => field.kind === 'upload'));
}
