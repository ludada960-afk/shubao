import { evaluateAsset } from './qualityGate.mjs';
import { canRetry } from './repairPlanner.mjs';

export const QC_CONFIG = Object.freeze({
  enabled: true,
  maxRetries: 2,
  autoRegen: true,
});

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function own(record, key) {
  return isRecord(record) && Object.hasOwn(record, key) ? record[key] : undefined;
}

function adapterFromLegacyVlm(vlmResult) {
  if (!isRecord(vlmResult)) return undefined;
  return async () => {
    const details = isRecord(own(vlmResult, 'details')) ? own(vlmResult, 'details') : {};
    const productAccuracy = Number(own(details, 'productAccuracy'));
    const verdict = typeof own(vlmResult, 'verdict') === 'string'
      ? own(vlmResult, 'verdict').trim().toLowerCase()
      : '';
    const passed = verdict
      ? verdict !== 'fail'
      : Number.isFinite(productAccuracy) && productAccuracy >= 70;
    return {
      passed,
      confidence: Number.isFinite(productAccuracy)
        ? Math.max(0, Math.min(1, productAccuracy / 100))
        : 0.5,
      issueCodes: passed ? [] : ['product_fidelity_failed'],
      details: {
        source: 'legacy_vlm',
        productAccuracy: Number.isFinite(productAccuracy) ? productAccuracy : null,
      },
    };
  };
}

export async function checkQuality(params = {}) {
  const safe = isRecord(params) ? params : {};
  const retryCount = Number.isInteger(own(safe, 'retryCount')) && own(safe, 'retryCount') >= 0
    ? own(safe, 'retryCount')
    : 0;
  const adapters = isRecord(own(safe, 'adapters')) ? { ...own(safe, 'adapters') } : {};
  if (!Object.hasOwn(adapters, 'productFidelity')) {
    const legacy = adapterFromLegacyVlm(own(safe, 'vlmResult'));
    if (legacy) adapters.productFidelity = legacy;
  }

  const verdict = await evaluateAsset({
    buffer: own(safe, 'buffer') ?? own(safe, 'imageBuffer'),
    role: own(safe, 'role') ?? own(safe, 'roleKey'),
    generationSize: own(safe, 'generationSize') ?? own(safe, 'expectedSize'),
    expectedFormat: own(safe, 'expectedFormat'),
    productTruth: own(safe, 'productTruth'),
    requiredText: own(safe, 'requiredText'),
    requiredLogos: own(safe, 'requiredLogos'),
  }, adapters);
  const shouldRetry = !verdict.passed
    && QC_CONFIG.autoRegen
    && canRetry(retryCount, verdict.repairAction);

  return {
    passed: verdict.passed,
    verdict: {
      ...verdict,
      imageId: typeof own(safe, 'roleKey') === 'string' ? own(safe, 'roleKey') : '',
      imageUrl: typeof own(safe, 'imageUrl') === 'string' ? own(safe, 'imageUrl') : '',
    },
    retryCount,
    shouldRetry,
    nextParams: shouldRetry ? {
      repairAction: verdict.repairAction,
      attempt: retryCount + 1,
      note: `Apply ${verdict.repairAction.type} for ${verdict.repairAction.focusIssueCodes.join(', ') || 'quality failure'}.`,
    } : null,
  };
}

export async function batchCheck(images, vlmResults = {}) {
  const safeImages = Array.isArray(images) ? images : [];
  const safeVlm = isRecord(vlmResults) ? vlmResults : {};
  const results = await Promise.all(safeImages.map((image) => checkQuality({
    ...image,
    vlmResult: typeof image?.roleKey === 'string' && Object.hasOwn(safeVlm, image.roleKey)
      ? safeVlm[image.roleKey]
      : undefined,
  })));
  return {
    results,
    allPassed: results.every((result) => result.passed),
    retryList: results.flatMap((result, originalIndex) => result.shouldRetry
      ? [{ originalIndex, ...result.nextParams }]
      : []),
  };
}

export function formatQualityReport(results) {
  const safeResults = Array.isArray(results) ? results : [];
  if (!safeResults.length) return 'No quality check performed.';

  const lines = ['╌╌╌ QUALITY REPORT ╌╌╌'];
  let passed = 0;
  for (const result of safeResults) {
    const verdict = isRecord(result?.verdict) ? result.verdict : {};
    const checks = isRecord(verdict.checks) ? verdict.checks : {};
    const failedChecks = Object.entries(checks)
      .filter(([, check]) => check?.status === 'fail')
      .map(([name, check]) => `${name}:${(check.issueCodes || []).join('|')}`);
    lines.push(`${result?.passed ? '✅' : '❌'} [${verdict.imageId || 'image'}] ${failedChecks.join(', ') || verdict.confidence || 'unknown'}`);
    if (result?.passed) passed += 1;
  }
  lines.push(`\nSummary: ${passed} passed, ${safeResults.length - passed} failed, ${safeResults.length} total`);
  return lines.join('\n');
}
