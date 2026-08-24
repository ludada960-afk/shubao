import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CANDIDATE_SELECTION_OPERATIONS,
  buildCandidateSelectionStats,
  normalizeCandidateSelectionEvents,
} from '../server/videoCandidateLearning.mjs';

const selectionEvent = (shotId, candidateId, selectedAt, operation = 'select_shot_candidate') =>
  ({ ownerEmail: 'o@x.com', projectId: 'p1', shotId, candidateId, operation, selectedAt });

test('selection normalization keeps bounded explicit-choice rows and drops everything else', () => {
  const rows = normalizeCandidateSelectionEvents([
    selectionEvent('shot-a', 'cand-1', '2026-08-22T08:00:00Z'),
    selectionEvent('shot-a', 'cand-2', '2026-08-22T09:00:00Z', 'apply_candidate_to_timeline'),
    selectionEvent('shot-a', 'cand-3', '2026-08-22T10:00:00Z', 'register_candidate'),
    selectionEvent('shot-a', 'cand-4', '2026-08-22T11:00:00Z', 'generation_completed'),
    { ownerEmail: '', projectId: 'p1', shotId: 's', candidateId: 'c', operation: 'select_shot_candidate', selectedAt: 'x' },
    'garbage',
    null,
  ]);
  assert.equal(rows.length, 2, 'only explicit selection operations count as preference');
  assert.deepEqual(CANDIDATE_SELECTION_OPERATIONS, new Set(['select_shot_candidate', 'apply_candidate_to_timeline']));
  assert.equal(normalizeCandidateSelectionEvents(Array.from({ length: 1500 }, (_, i) =>
    selectionEvent(`s-${i}`, `c-${i}`, '2026-08-22T08:00:00Z'))).length, 1000);
  assert.equal(normalizeCandidateSelectionEvents('not-an-array').length, 0);
});

test('selection stats aggregate per-candidate counts and per-shot preference with recency tie-break', () => {
  const stats = buildCandidateSelectionStats(normalizeCandidateSelectionEvents([
    selectionEvent('shot-a', 'cand-1', '2026-08-20T08:00:00Z'),
    selectionEvent('shot-a', 'cand-1', '2026-08-21T08:00:00Z'),
    selectionEvent('shot-a', 'cand-2', '2026-08-21T09:00:00Z'),
    selectionEvent('shot-a', 'cand-2', '2026-08-22T09:00:00Z'),
    selectionEvent('shot-b', 'cand-3', '2026-08-22T10:00:00Z'),
  ]));
  assert.equal(stats.attemptsConsidered, 5);
  assert.deepEqual(stats.candidates['shot-a:cand-1'], { shotId: 'shot-a', candidateId: 'cand-1', selectionCount: 2, lastSelectedAt: '2026-08-21T08:00:00Z' });
  assert.equal(stats.preferredByShot['shot-a'], 'cand-2', 'tie on count breaks by most recent');
  assert.equal(stats.preferredByShot['shot-b'], 'cand-3');
});

test('mere generations without an explicit selection never become preferences', () => {
  const stats = buildCandidateSelectionStats(normalizeCandidateSelectionEvents([
    selectionEvent('shot-a', 'gen-1', '2026-08-20T08:00:00Z', 'register_candidate'),
    selectionEvent('shot-a', 'gen-1', '2026-08-20T09:00:00Z', 'generation_completed'),
  ]));
  assert.equal(stats.attemptsConsidered, 0);
  assert.deepEqual(stats.candidates, {});
  assert.deepEqual(stats.preferredByShot, {});
});