/**
 * VID-P3-06 candidate learning: preference signals are derived exclusively
 * from explicit human candidate selections. A mere generation, registration,
 * or delivery event is never treated as a preference.
 */

export const CANDIDATE_SELECTION_OPERATIONS = new Set([
  'select_shot_candidate',
  'apply_candidate_to_timeline',
]);

export const CANDIDATE_SELECTION_LIMIT = 1000;

function clean(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

function validTimestamp(value) {
  const text = String(value ?? '').trim();
  return text && Number.isFinite(Date.parse(text)) ? text : null;
}

/**
 * Keep only bounded rows whose operation is an explicit selection. Invalid
 * entries are dropped silently so stats never fail on noisy history.
 */
export function normalizeCandidateSelectionEvents(input = []) {
  const rows = Array.isArray(input) ? input.slice(0, CANDIDATE_SELECTION_LIMIT) : [];
  const normalized = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const ownerEmail = clean(row.ownerEmail, 200);
    const projectId = clean(row.projectId, 200);
    const shotId = clean(row.shotId, 200);
    const candidateId = clean(row.candidateId, 256);
    const operation = clean(row.operation, 80);
    const selectedAt = validTimestamp(row.selectedAt);
    if (!ownerEmail || !projectId || !shotId || !candidateId || !selectedAt) continue;
    if (!CANDIDATE_SELECTION_OPERATIONS.has(operation)) continue;
    normalized.push({ ownerEmail, projectId, shotId, candidateId, operation, selectedAt });
  }
  return normalized;
}

/**
 * Aggregate explicit selections: per-candidate counts with the latest
 * selection time, and a per-shot preferred candidate (count first, most
 * recent selection breaks ties; deterministic id order as final tie-break).
 */
export function buildCandidateSelectionStats(input = []) {
  const rows = Array.isArray(input) ? input : [];
  const candidates = new Map();
  for (const row of rows) {
    const key = `${row.shotId}:${row.candidateId}`;
    const entry = candidates.get(key) || {
      shotId: row.shotId, candidateId: row.candidateId, selectionCount: 0, lastSelectedAt: null,
    };
    entry.selectionCount += 1;
    if (!entry.lastSelectedAt || Date.parse(row.selectedAt) > Date.parse(entry.lastSelectedAt)) {
      entry.lastSelectedAt = row.selectedAt;
    }
    candidates.set(key, entry);
  }
  const preferredByShot = {};
  const ordered = [...candidates.values()].sort((left, right) =>
    String(left.shotId).localeCompare(String(right.shotId))
      || String(left.candidateId).localeCompare(String(right.candidateId)));
  for (const entry of ordered) {
    const current = preferredByShot[entry.shotId];
    if (!current) {
      preferredByShot[entry.shotId] = entry.candidateId;
      continue;
    }
    const currentEntry = candidates.get(`${entry.shotId}:${current}`);
    const better = entry.selectionCount > currentEntry.selectionCount
      || (entry.selectionCount === currentEntry.selectionCount
        && Date.parse(entry.lastSelectedAt) > Date.parse(currentEntry.lastSelectedAt));
    if (better) preferredByShot[entry.shotId] = entry.candidateId;
  }
  const product = {};
  for (const [key, entry] of [...candidates.entries()].sort((left, right) => left[0].localeCompare(right[0]))) {
    product[key] = entry;
  }
  return { attemptsConsidered: rows.length, candidates: product, preferredByShot };
}