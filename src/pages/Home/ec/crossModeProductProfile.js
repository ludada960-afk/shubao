// 跨 mode 商品档案复用 - 纯函数层
//
// 4c183cd4 时代 product_profile 只服务 EcMode; XHS 模式 (XhsContentMode) 与
// Plog 模式 (Plog) 各自维护独立 productName/卖点/规格 state, 提示词完全
// 脱离档案事实, 出现「电商店铺与小红书图文用的是不同商品档案, 跨 mode 失忆」
// 的体验问题。P2 续命: 在不破坏 EcMode 既有抽屉交互的前提下, 给 XHS/Plog
// 增加轻量级 chip 入口, 选中档案后把 name + 卖点 + 规格 + 材质/颜色 拼到
// 提示词, 供跨 mode 复用。
//
// 复用面: productProfileSummary (档案事实摘要), applyProductProfileToEditor
// (档案 → EcState 的注入, 由 EcMode 自行调用), 以下三个 injectors 仅负责
// 把 facts 翻译成不同 mode 期望的字段集合, 供 jsx 渲染层与 node test 共享。

export function profileText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function profileTextList(value, separator = /[,，;；\n]+/) {
  return profileText(value).split(separator).map(part => part.trim()).filter(Boolean);
}

// 把档案 facts 摊平成「商品名 · 类目 · 卖点 · 规格 · 材质 · 颜色」一行, 供
// XHS/Plog 模式直接拼到 prompt 后面。Plog 拼入「场景描述」尾部, XHS 拼到
// productName 旁边, 文案/详情图语境下不破坏生成风格。
export function buildProductProfilePromptTail(profile = {}) {
  const facts = profile?.facts && typeof profile.facts === 'object' ? profile.facts : {};
  const segments = [];
  const name = profileText(profile?.name);
  if (name) segments.push(`商品: ${name}`);
  const category = profileText(profile?.category);
  if (category) segments.push(`类目: ${category}`);
  const material = profileText(facts.material);
  if (material) segments.push(`材质: ${material}`);
  const dimensions = profileText(facts.dimensions);
  if (dimensions) segments.push(`规格: ${dimensions}`);
  const baseColor = profileText(facts.baseColor);
  if (baseColor) segments.push(`主色: ${baseColor}`);
  const accentColor = profileText(facts.accentColor);
  if (accentColor) segments.push(`配色: ${accentColor}`);
  const sellingPoints = profileText(facts.sellingPoints);
  if (sellingPoints) segments.push(`卖点: ${sellingPoints}`);
  const usage = profileText(facts.usage);
  if (usage) segments.push(`场景: ${usage}`);
  const targetAudience = profileText(facts.targetAudience);
  if (targetAudience) segments.push(`人群: ${targetAudience}`);
  return segments.join(' · ');
}

// XHS 模式注入: 把档案 facts 写回 XhsContentMode 的电商子模式 state
// (ecName/ecCat/ecProductPoints/ecMaterial/ecTargetAudience/ecRestrictions),
// 跨 mode 复用 productProfile → XHS 域 productName 桥接。卖点数组转字符串。
// 返回 { ok, applied } 表示是否成功 + 写入了哪些字段, 便于 UI 反馈。
export function applyProductProfileFactsToXhs(profile = {}, setters = {}) {
  if (!profile) return { ok: false, applied: [] };
  const facts = profile.facts && typeof profile.facts === 'object' ? profile.facts : {};
  const applied = [];
  const name = profileText(profile.name);
  if (name && typeof setters.setEcName === 'function') {
    setters.setEcName(name);
    applied.push('productName');
  }
  const category = profileText(profile.category) || profileText(facts.category);
  if (category && typeof setters.setEcCat === 'function') {
    setters.setEcCat(category);
    applied.push('category');
  }
  const points = profileTextList(facts.sellingPoints);
  if (points.length && typeof setters.setEcProductPoints === 'function') {
    setters.setEcProductPoints(points.join(', '));
    applied.push('sellingPoints');
  }
  const materialBits = [profileText(facts.material), profileText(facts.craft)]
    .filter(Boolean)
    .join(' · ');
  if (materialBits && typeof setters.setEcMaterial === 'function') {
    setters.setEcMaterial(materialBits);
    applied.push('material');
  }
  const audience = profileText(facts.targetAudience);
  if (audience && typeof setters.setEcTargetAudience === 'function') {
    setters.setEcTargetAudience(audience);
    applied.push('targetAudience');
  }
  const restrictions = profileText(facts.restrictions);
  if (restrictions && typeof setters.setEcRestrictions === 'function') {
    setters.setEcRestrictions(restrictions);
    applied.push('restrictions');
  }
  return { ok: applied.length > 0, applied };
}

// Plog 模式注入: Plog 输入只有一个 text 字段, 把档案事实以「商品: ...」
// 尾巴拼到原 prompt 后面, 保留用户原场景描述, 跨 mode 复用 productProfile
// → Plog 域 prompt 桥接。如果用户已选过同一条 tail, 不重复拼接。
export function applyProductProfileFactsToPlog(profile = {}, setText) {
  if (typeof setText !== 'function' || !profile) return false;
  const tail = buildProductProfilePromptTail(profile);
  if (!tail) return false;
  setText(current => {
    const currentText = profileText(current);
    if (!currentText) return tail;
    if (currentText.includes(tail)) return currentText;
    return `${currentText}\n\n${tail}`;
  });
  return true;
}
