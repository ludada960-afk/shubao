const STATUS_VALUES = new Set(['planned', 'verified', 'unverified-legacy']);

function clean(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function finiteCost(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 10000) / 10000 : null;
}

function cleanDate(value) {
  const normalized = clean(value, 80);
  if (!normalized) return '';
  const time = Date.parse(normalized);
  return Number.isFinite(time) ? new Date(time).toISOString() : '';
}

export function normalizeVideoProvenance(input = null, fallbackStatus = 'planned') {
  const source = input && typeof input === 'object' ? input : {};
  const requestedStatus = clean(source.status, 40) || clean(fallbackStatus, 40) || 'planned';
  const status = STATUS_VALUES.has(requestedStatus) ? requestedStatus : 'unverified-legacy';
  const value = { status };
  const provider = clean(source.provider, 120);
  const model = clean(source.model, 160);
  const requestId = clean(source.requestId, 240);
  const requestHash = clean(source.requestHash, 128);
  const catalogVersion = clean(source.catalogVersion, 160);
  const costCny = finiteCost(source.costCny);
  const generatedAt = cleanDate(source.generatedAt);
  const provenanceSource = clean(source.source, 80);

  if (provider) value.provider = provider;
  if (model) value.model = model;
  if (requestId) value.requestId = requestId;
  if (requestHash) value.requestHash = requestHash;
  if (catalogVersion) value.catalogVersion = catalogVersion;
  if (costCny !== null) value.costCny = costCny;
  if (generatedAt) value.generatedAt = generatedAt;
  if (provenanceSource) value.source = provenanceSource;

  if (status === 'verified') {
    const complete = value.provider && value.model && value.requestId
      && value.requestHash && value.catalogVersion && value.generatedAt
      && value.source === 'provider-attempt';
    if (!complete) return { status: 'unverified-legacy' };
  }
  if (status === 'planned') return { status: 'planned' };
  return value;
}

export function verifiedVideoProvenance({ provider, model, requestId, requestHash = '',
  catalogVersion, costCny, generatedAt, source = 'provider-attempt' } = {}) {
  return normalizeVideoProvenance({
    status: 'verified', provider, model, requestId, requestHash,
    catalogVersion, costCny, generatedAt, source,
  }, 'unverified-legacy');
}
