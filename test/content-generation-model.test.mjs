import test from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptAuthoritativeContentCompletion,
  buildContentPendingAction,
  createContentDraftId,
} from '../src/pages/contentGenerationModel.js';

test('content pending actions retain only an owned draft and reference asset IDs', () => {
  const draftId = createContentDraftId({ ownerEmail: 'Creator@example.com', source: 'plog' });
  const action = buildContentPendingAction({
    type: 'plog',
    draftId,
    referenceAssetIds: ['asset-1', 'data:image/png;base64,not-allowed', 'blob:unsafe'],
    text: '周末咖啡',
    style: 'ins-minimal',
    layout: 'casual',
    coverVariant: 'collage',
  });

  assert.deepEqual(action, {
    type: 'plog',
    currency: 'ec_points',
    draftId,
    referenceAssetIds: ['asset-1'],
  });
  assert.doesNotMatch(JSON.stringify(action), /File|Blob|base64|data:|blob:|周末咖啡|ins-minimal/);
});

test('each new content cycle gets a distinct draft id instead of reconnecting an earlier task', () => {
  const first = createContentDraftId({ ownerEmail: 'Creator@example.com', source: 'plog' });
  const second = createContentDraftId({ ownerEmail: 'Creator@example.com', source: 'plog' });

  assert.match(first, /^content-plog-/);
  assert.match(second, /^content-plog-/);
  assert.notEqual(first, second);
});

test('only an explicit complete event with stable assets can produce a paid content result', () => {
  const stable = '/api/generated-assets/a'.padEnd(88, '1');
  const event = {
    type: 'complete',
    title: '夏日通勤',
    cover_url: stable,
    image_urls: [stable.replace(/1$/, '2')],
    billing: { currency: 'content_sets', status: 'settled', balance: 2, unlimited: false },
  };

  assert.deepEqual(acceptAuthoritativeContentCompletion(event), {
    status: 'settled',
    contentSets: 2,
    unlimited: false,
    result: event,
  });
  assert.equal(acceptAuthoritativeContentCompletion({ ...event, type: 'image' }), null);
  assert.equal(acceptAuthoritativeContentCompletion({ ...event, cover_url: 'https://temporary.example/image.png' }), null);
  assert.equal(acceptAuthoritativeContentCompletion({ ...event, billing: { ...event.billing, status: 'released' } }), null);
});

test('preview completion remains free and cannot manufacture a content-set balance', () => {
  const preview = {
    type: 'complete',
    cover_url: '/api/generated-assets/preview-1',
    image_urls: [],
    billing: { currency: 'content_sets', status: 'preview', balance: 999, unlimited: false },
  };
  assert.deepEqual(acceptAuthoritativeContentCompletion(preview), {
    status: 'preview',
    contentSets: null,
    unlimited: false,
    result: preview,
  });
});

test('unified ecommerce-point completion exposes the authoritative point balance', () => {
  const stable = '/api/generated-assets/a'.padEnd(88, '1');
  const event = {
    type: 'complete',
    cover_url: stable,
    image_urls: [stable.replace(/1$/, '2')],
    billing: { currency: 'ec_points', status: 'settled', balance: 96000, unlimited: false },
  };

  assert.deepEqual(acceptAuthoritativeContentCompletion(event), {
    status: 'settled',
    ecPoints: 96000,
    unlimited: false,
    result: event,
  });
});

test('timeout and released failure events never become a debit or a successful result', () => {
  const failed = {
    type: 'error',
    error: '生成超时',
    generationId: 'timeout-42',
    billing: { currency: 'content_sets', status: 'released', balance: 3, unlimited: false },
  };
  assert.equal(acceptAuthoritativeContentCompletion(failed), null);
});
