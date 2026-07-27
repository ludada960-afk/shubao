const CURRENCY_META = {
  ec_points: { divisor: 1000, label: 'AI 积分' },
  content_sets: { divisor: 1, label: '创作套数' },
};

const EVENT_LABELS = {
  purchase: '购买',
  grant: '赠送',
  hold: '冻结',
  settle: '结算',
  release: '释放',
  release_remainder: '释放余量',
  refund: '退款',
  expire: '到期',
  adjustment: '余额调整',
};

const POSITIVE_EVENTS = new Set(['purchase', 'grant', 'refund', 'release', 'release_remainder']);
const WARNING_EVENTS = new Set(['hold', 'expire']);

function currencyMeta(currency) {
  return CURRENCY_META[currency] || { divisor: 1, label: '计费单位' };
}

function numericUnits(units) {
  return typeof units === 'number' && Number.isFinite(units) ? units : 0;
}

function readableNumber(value) {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 3,
    useGrouping: false,
  }).format(value);
}

export function formatBillingUnits(units, currency) {
  const meta = currencyMeta(currency);
  return `${readableNumber(numericUnits(units) / meta.divisor)} ${meta.label}`;
}

export function formatBalanceDisplay(units, currency, unlimited = false) {
  return unlimited ? '不限额度' : formatBillingUnits(units, currency);
}

export function getBillingTone(eventType) {
  if (POSITIVE_EVENTS.has(eventType)) return 'positive';
  if (WARNING_EVENTS.has(eventType)) return 'warning';
  if (eventType === 'settle') return 'negative';
  return 'neutral';
}

function ledgerUnits(entry) {
  const available = numericUnits(entry?.deltaAvailable);
  const held = numericUnits(entry?.deltaHeld);
  switch (entry?.eventType) {
    case 'hold':
      return Math.abs(available || held);
    case 'release':
    case 'release_remainder':
      return Math.abs(available || held);
    case 'settle':
      return available || held;
    default:
      return available || held;
  }
}

function signedAmount(units, currency, showPlus) {
  const value = numericUnits(units);
  const formatted = formatBillingUnits(Math.abs(value), currency);
  if (showPlus && value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

export function formatLedgerEntry(entry = {}) {
  const eventType = entry.eventType || 'unknown';
  const units = ledgerUnits(entry);

  return {
    label: EVENT_LABELS[eventType] || '账务记录',
    amount: signedAmount(units, entry.currency, eventType !== 'hold'),
    tone: getBillingTone(eventType),
  };
}
