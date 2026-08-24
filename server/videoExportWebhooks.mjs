/**
 * VID-P3-07 export webhooks: subscription URL hygiene and deterministic,
 * provider-neutral payloads. Actual HTTP delivery stays with the worker;
 * these helpers never perform network I/O.
 */

const MAX_WEBHOOK_URL_LENGTH = 500;

function isPrivateIpv4(hostname) {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (!match) return false;
  const octets = match.slice(1).map(Number);
  if (octets.some(value => value > 255)) return true;
  const [a, b] = octets;
  return a === 10 || a === 127 || (a === 192 && b === 168)
    || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254) || a === 0;
}

/**
 * Only public https URLs are acceptable webhook targets. Returns
 * { ok, url } where url is the normalized href or null when rejected.
 */
export function normalizeWebhookUrl(input) {
  try {
    if (!input || typeof input !== 'string') return { ok: false, url: null };
    const trimmed = input.trim();
    if (!trimmed || trimmed.length > MAX_WEBHOOK_URL_LENGTH) return { ok: false, url: null };
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return { ok: false, url: null };
    const hostname = parsed.hostname.toLowerCase();
    if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')
      || isPrivateIpv4(hostname)) {
      return { ok: false, url: null };
    }
    return { ok: true, url: parsed.href };
  } catch {
    return { ok: false, url: null };
  }
}

/** Deterministic webhook payload for a completed export job. */
export function buildExportWebhookPayload(job) {
  if (!job || typeof job !== 'object' || Array.isArray(job)) return null;
  const text = value => String(value ?? '').trim().slice(0, 200) || null;
  return {
    type: 'video.export.completed',
    jobId: text(job.id),
    projectId: text(job.projectId),
    state: text(job.state),
    manifestHash: text(job.manifestHash),
    outputAssetId: text(job.outputAssetId),
    completedAt: text(job.completedAt),
  };
}