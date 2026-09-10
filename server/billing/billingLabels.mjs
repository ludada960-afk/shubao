/**
 * 计费条目中文名（2026-09-10）
 * 单一事实源：SKU 目录 + 账本事件 → 用户可读的交易名称与计费细则。
 * 前端不自造文案，统一从 /api/billing/rules 与 /api/billing/transactions 拿。
 */
import { FEATURE_SKUS } from './catalog.mjs';

export const BILLING_CATEGORIES = Object.freeze([
  { key: 'image', label: '生图' },
  { key: 'canvas', label: '画布工具' },
  { key: 'text', label: '文案助手' },
  { key: 'video', label: '视频' },
  { key: 'content', label: '小红书 / Plog' },
  { key: 'account', label: '账户' },
]);

const CURRENCY_LABELS = Object.freeze({
  ec_points: '积分',
  content_sets: '内容集',
});

/**
 * 展示用金额：积分账本以 1/1000 为内部单位，其余币种（如内容集）按原值展示。
 * 单一事实源——前端不允许自己除 1000，否则非积分币种会显示成 "0 积分"。
 */
export function formatBillingAmount(units, currencyKey = 'ec_points') {
  const value = Number(units) || 0;
  const display = currencyKey === 'ec_points' ? value / 1000 : value;
  return display.toLocaleString('zh-Hans-CN', { maximumFractionDigits: 2 });
}

const SKU_LABELS = Object.freeze({
  ec_image_2k: { label: 'AI 商品图 · 2K', category: 'image', per: '张' },
  ec_image_4k: { label: 'AI 商品图 · 4K', category: 'image', per: '张' },
  ec_nano_flash_1k: { label: 'AI 商品图（轻量）· 1K', category: 'image', per: '张' },
  ec_nano_flash_2k: { label: 'AI 商品图（轻量）· 2K', category: 'image', per: '张' },
  ec_nano_flash_4k: { label: 'AI 商品图（轻量）· 4K', category: 'image', per: '张' },
  ec_nano_pro_1k: { label: 'AI 商品图（高清）· 1K', category: 'image', per: '张' },
  ec_nano_pro_2k: { label: 'AI 商品图（高清）· 2K', category: 'image', per: '张' },
  ec_nano_pro_4k: { label: 'AI 商品图（高清）· 4K', category: 'image', per: '张' },
  ec_ai_assistant: { label: 'AI 助手（分析 / 文案 / 画布文字）', category: 'text', per: '次' },
  ec_extension_analysis: { label: '插件 · 图片分析', category: 'image', per: '次' },
  ec_extension_basic: { label: '插件 · 基础套图', category: 'image', per: '次' },
  ec_extension_standard: { label: '插件 · 标准套图', category: 'image', per: '次' },
  ec_extension_complete: { label: '插件 · 完整套图', category: 'image', per: '次' },
  ec_reverse_prompt: { label: '反推提示词', category: 'canvas', per: '次' },
  ec_canvas_ocr: { label: '画布 · 文字识别', category: 'canvas', per: '次' },
  ec_remove_bg: { label: '画布 · 智能抠图', category: 'canvas', per: '次' },
  ec_direction_analysis: { label: '套图方向分析', category: 'image', per: '次' },
  ec_canvas_recognize: { label: '画布 · 商品识别', category: 'canvas', per: '次' },
  ec_preview_cover: { label: '小红书封面预览', category: 'content', per: '次' },
  ec_direction_refresh: { label: '套图方向刷新', category: 'image', per: '次' },
  ec_smart_layer: { label: '画布 · 智能图层', category: 'canvas', per: '次' },
  ec_layer_psd: { label: '画布 · PSD 分层导出', category: 'canvas', per: '次' },
  video_plan_analysis: { label: '视频方案分析', category: 'video', per: '次' },
  video_seedance_fast_short: { label: 'AI 视频 · 快试档', category: 'video', per: '条' },
  video_seedance_fast_long: { label: 'AI 视频 · 快试档', category: 'video', per: '条' },
  video_seedance_standard_short: { label: 'AI 视频 · 标准档', category: 'video', per: '条' },
  video_seedance_standard_long: { label: 'AI 视频 · 高品质档', category: 'video', per: '条' },
  xhs_image_set_2k: { label: '小红书图文套装（1 封面 + 8 配图）', category: 'content', per: '套' },
  content_full_set: { label: '小红书内容集', category: 'content', per: '套' },
});

const ACTION_LABELS = Object.freeze({
  regenerate_canvas_text: '画布文案重写',
  visual_create: '自由创作生成',
  regenerate: '画布重新生成',
  move_scale: '画布移动 / 缩放',
  'move-scale': '画布移动 / 缩放',
  retouch: '画布 AI 修图',
  extend: '画布 AI 扩图',
  translate: '画布 AI 翻译',
  upscale: '画布 AI 高清放大',
  analyze: '内容分析',
  polish: '文案润色',
  direction_refresh: '套图方向刷新',
  direction_analysis: '套图方向分析',
  video_plan_analysis: '视频方案分析',
  extension_analyze: '插件 · 图片分析',
  extension_regenerate: '插件 · 套图生成',
  preview_cover: '小红书封面预览',
});

const ACCOUNT_LABELS = Object.freeze({
  admin_grant: '管理员发放',
  admin_revoke: '管理员调整',
  redeem: '兑换码兑换',
  payment_order: '充值到账',
  paywall_order: '解锁支付',
  legacy_users_credits: '历史积分迁移',
});

export function skuLabel(sku) {
  const item = SKU_LABELS[String(sku || '')];
  return item ? item.label : '';
}

/** 计费细则：与 SKU 目录同源生成，永不漂移 */
export function buildBillingRules() {
  const groups = new Map(BILLING_CATEGORIES.map(category => [category.key, { ...category, items: [] }]));
  for (const [sku, feature] of Object.entries(FEATURE_SKUS)) {
    if (feature.public === false) continue;
    // 与公开目录同口径：内容集（content_sets）是遗留币种账本，不作为积分计费项展示
    if ((feature.currency ?? 'ec_points') !== 'ec_points') continue;
    const meta = SKU_LABELS[sku] || { label: sku, category: 'image', per: '次' };
    const group = groups.get(meta.category) || groups.get('image');
    const currencyKey = feature.currency ?? 'ec_points';
    const currencyLabel = CURRENCY_LABELS[currencyKey] || currencyKey;
    const unit = meta.per || '次';
    group.items.push({
      sku,
      label: meta.label,
      unit,
      units: feature.units,
      currency: currencyKey,
      currencyLabel,
      priceText: `${formatBillingAmount(feature.units, currencyKey)} ${currencyLabel}/${unit}`,
    });
  }
  for (const group of groups.values()) {
    group.items.sort((a, b) => a.units - b.units || a.label.localeCompare(b.label, 'zh-Hans-CN'));
  }
  return [...groups.values()].filter(group => group.items.length > 0);
}

function holdLabel({ idempotencyKey = '', metadata = {} } = {}) {
  const action = String(metadata.action || '').trim();
  if (action && ACTION_LABELS[action]) return ACTION_LABELS[action];
  if (action && ACTION_LABELS[action.replace(/-/g, '_')]) return ACTION_LABELS[action.replace(/-/g, '_')];
  if (String(idempotencyKey || '').startsWith('ec-hold:')) {
    const items = Array.isArray(metadata.items) ? metadata.items : [];
    const skus = [...new Set(items.map(item => String(item.sku || '')))].filter(Boolean);
    if (skus.length === 1 && skuLabel(skus[0])) return skuLabel(skus[0]);
    return 'AI 商品图生成';
  }
  if (String(idempotencyKey || '').startsWith('canvas-hold:')) return '画布 AI 处理';
  return '积分消耗';
}

/** 把账本流水聚合为用户可读的交易（hold+settle 合并为一笔，+0 结算行不单独展示） */
export function buildLedgerTransactions(entries = [], { limit = 30 } = {}) {
  const rows = (Array.isArray(entries) ? entries : []).slice();
  const holds = new Map();
  const transactions = [];
  const indexByFingerprintHold = new Map();
  for (const entry of rows) {
    const walletMeta = entry?.metadata?.['_walletService'] || {};
    let fingerprint = {};
    try { fingerprint = typeof walletMeta.fingerprint === 'string' ? JSON.parse(walletMeta.fingerprint) : (walletMeta.fingerprint || {}); } catch { fingerprint = {}; }
    const holdId = String(fingerprint.holdId || '');
    if (holdId) indexByFingerprintHold.set(entry.id, holdId);
    if (entry.eventType === 'hold') holds.set(entry.idempotencyKey || entry.id, { entry, holdId: entry.referenceId || '' });
  }
  const consumedByHold = new Map();
  const releasedByHold = new Map();
  for (const entry of rows) {
    if (entry.eventType !== 'settle') continue;
    const holdId = indexByFingerprintHold.get(entry.id) || '';
    const held = Number(entry.deltaHeld) || 0;
    if (held < 0) {
      consumedByHold.set(holdId, (consumedByHold.get(holdId) || 0) + (-held));
    }
  }
  for (const entry of rows) {
    if (entry.eventType !== 'release') continue;
    const holdId = indexByFingerprintHold.get(entry.id) || '';
    const back = Number(entry.deltaAvailable) || 0;
    if (back > 0) releasedByHold.set(holdId, (releasedByHold.get(holdId) || 0) + back);
  }

  const usedSettle = new Set();
  for (const entry of rows) {
    if (entry.eventType === 'hold') {
      const holdId = entry.referenceId || '';
      const settled = consumedByHold.get(holdId) || 0;
      const released = releasedByHold.get(holdId) || 0;
      let walletMeta = {};
      try { walletMeta = entry?.metadata?.['_walletService'] || {}; } catch {}
      let fingerprint = {};
      try { fingerprint = typeof walletMeta.fingerprint === 'string' ? JSON.parse(walletMeta.fingerprint) : (walletMeta.fingerprint || {}); } catch {}
      const metadata = fingerprint.metadata || {};
      const items = Array.isArray(fingerprint.items) ? fingerprint.items : [];
      const label = holdLabel({ idempotencyKey: entry.idempotencyKey, metadata: { ...metadata, items } });
      const spent = settled > 0 ? settled : Math.abs(Number(entry.deltaAvailable) || 0);
      transactions.push({
        id: entry.id,
        at: entry.createdAt,
        label,
        kind: released > 0 && settled === 0 ? 'refund' : 'spend',
        amount: -spent,
        balance: Number(entry.balanceAvailable) || 0,
        detail: released > 0 ? `已退还 ${formatBillingAmount(released, entry.currency || 'ec_points')}` : '',
      });
      continue;
    }
    if (entry.eventType === 'settle') {
      const holdId = indexByFingerprintHold.get(entry.id) || '';
      if (holds.size > 0 && holdId) continue; // 已并入 hold 交易
      continue;
    }
    if (entry.eventType === 'grant') {
      const ref = String(entry.referenceType || '');
      transactions.push({
        id: entry.id,
        at: entry.createdAt,
        label: ACCOUNT_LABELS[ref] || '积分发放',
        kind: 'gain',
        amount: Number(entry.deltaAvailable) || 0,
        balance: Number(entry.balanceAvailable) || 0,
        detail: '',
      });
    }
  }
  transactions.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  return transactions.slice(0, limit);
}
