import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ECOMMERCE_TASK_REFERENCE_TTL_MS,
  clearEcommerceTaskReference,
  loadEcommerceTaskReference,
  normalizeEcommerceAsset,
  saveEcommerceTaskReference,
  taskKey,
} from '../src/pages/Home/ec/ecommerceTaskProgressModel.js';
import * as taskProgressModel from '../src/pages/Home/ec/ecommerceTaskProgressModel.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
}

test('normalizes every server asset state into a user-safe Chinese state', () => {
  const expected = {
    queued: '等待生成',
    draft: '等待生成',
    submitted: '正在生成',
    polling: '正在生成',
    downloading: '正在生成',
    quality_check: '质量检查',
    repairing: '正在修复',
    completed: '已完成',
    needs_review: '需要确认',
    failed: '失败',
    cancelled: '失败',
  };

  for (const [state, userState] of Object.entries(expected)) {
    assert.equal(normalizeEcommerceAsset({ assetId: `asset-${state}`, status: state }).userState, userState, state);
  }
  assert.equal(normalizeEcommerceAsset({ assetId: 'active', status: 'provider_waiting' }).userState, '正在生成');
  assert.equal(normalizeEcommerceAsset({ assetId: 'active-completion', status: 'completion_pending' }).userState, '正在生成');
  assert.equal(normalizeEcommerceAsset({ assetId: 'active-complete', status: 'complete_pending' }).userState, '正在生成');
  assert.equal(normalizeEcommerceAsset({ assetId: 'unknown-completed', status: 'provider_completed' }).userState, '失败');
  assert.equal(normalizeEcommerceAsset({ assetId: 'final', status: 'provider_finished', error: 'bad output' }).userState, '失败');
  assert.equal(normalizeEcommerceAsset({ assetId: 'unknown-final', status: 'provider_finished' }).userState, '失败');
});

test('normalizes an asset with Asset Plan role and never exposes a provider state as its label', () => {
  const asset = normalizeEcommerceAsset({
    assetId: 'detail-1',
    status: 'quality_check',
    stableUrl: '/api/generated-assets/detail-1.png',
    plan: { role: 'detail_slice_feature', label: '细节特写' },
  });

  assert.deepEqual(asset, {
    id: 'detail-1',
    role: 'detail_slice_feature',
    label: '细节特写',
    state: 'quality_check',
    userState: '质量检查',
    stableUrl: '/api/generated-assets/detail-1.png',
    error: '',
  });
  assert.doesNotMatch(asset.userState, /quality_check|provider/i);
});

test('task references are owner and draft isolated, versioned, and expire safely', () => {
  const storage = memoryStorage();
  const now = 1_700_000_000_000;
  const ownerEmail = 'Owner@Example.COM';
  const draftId = 'ec-draft-123';

  assert.equal(taskKey({ ownerEmail, draftId }), taskKey({ ownerEmail: 'owner@example.com', draftId }));
  assert.equal(saveEcommerceTaskReference({ ownerEmail, draftId, taskId: 'task-1', createdAt: now, storage }), true);
  assert.deepEqual(loadEcommerceTaskReference({ ownerEmail: 'owner@example.com', draftId, now, storage }), {
    taskId: 'task-1',
    createdAt: now,
  });
  assert.equal(loadEcommerceTaskReference({ ownerEmail: 'other@example.com', draftId, now, storage }), null);
  assert.equal(loadEcommerceTaskReference({ ownerEmail, draftId: 'ec-draft-other', now, storage }), null);

  storage.setItem(taskKey({ ownerEmail, draftId }), JSON.stringify({
    version: 1,
    ownerEmail: 'other@example.com',
    draftId,
    taskId: 'foreign-task',
    createdAt: now,
  }));
  assert.equal(loadEcommerceTaskReference({ ownerEmail, draftId, now, storage }), null);
  storage.setItem(taskKey({ ownerEmail, draftId }), JSON.stringify({
    version: 1,
    ownerEmail: 'other@example.com',
    draftId,
    taskId: 'foreign-task',
    createdAt: now,
  }));
  assert.equal(clearEcommerceTaskReference({ ownerEmail, draftId, taskId: 'foreign-task', storage }), false);

  assert.equal(saveEcommerceTaskReference({ ownerEmail, draftId, taskId: 'task-2', createdAt: now, storage }), true);
  assert.equal(loadEcommerceTaskReference({ ownerEmail, draftId, now: now + ECOMMERCE_TASK_REFERENCE_TTL_MS + 1, storage }), null);
  assert.equal(saveEcommerceTaskReference({ ownerEmail, draftId, taskId: 'task-3', createdAt: now, storage }), true);
  assert.equal(clearEcommerceTaskReference({ ownerEmail, draftId, taskId: 'wrong-task', storage }), false);
  assert.equal(clearEcommerceTaskReference({ ownerEmail, draftId, taskId: 'task-3', storage }), true);
  assert.equal(loadEcommerceTaskReference({ ownerEmail, draftId, now, storage }), null);
});

test('task references reject timestamps from the future instead of extending their lifetime', () => {
  const storage = memoryStorage();
  const now = 1_700_000_000_000;
  assert.equal(saveEcommerceTaskReference({
    ownerEmail: 'owner@example.com',
    draftId: 'ec-draft-future',
    taskId: 'task-future',
    createdAt: now + 1,
    storage,
  }), true);
  assert.equal(loadEcommerceTaskReference({ ownerEmail: 'owner@example.com', draftId: 'ec-draft-future', now, storage }), null);
});

test('active drafts survive refresh for the same owner and surface but never cross either boundary', () => {
  assert.equal(typeof taskProgressModel.loadOrCreateEcommerceDraft, 'function');
  assert.equal(typeof taskProgressModel.ecommerceDraftKey, 'function');

  const storage = memoryStorage();
  const now = 1_700_000_000_000;
  let createCalls = 0;
  const createDraftId = () => {
    createCalls += 1;
    return `draft-${createCalls}`;
  };

  const first = taskProgressModel.loadOrCreateEcommerceDraft({
    ownerEmail: 'Owner@Example.COM',
    surface: 'EcStudio',
    now,
    storage,
    createDraftId,
  });
  const refreshed = taskProgressModel.loadOrCreateEcommerceDraft({
    ownerEmail: 'owner@example.com',
    surface: 'EcStudio',
    now: now + 1,
    storage,
    createDraftId,
  });
  const otherOwner = taskProgressModel.loadOrCreateEcommerceDraft({
    ownerEmail: 'other@example.com',
    surface: 'EcStudio',
    now,
    storage,
    createDraftId,
  });
  const otherSurface = taskProgressModel.loadOrCreateEcommerceDraft({
    ownerEmail: 'owner@example.com',
    surface: 'EcAuto',
    now,
    storage,
    createDraftId,
  });

  assert.deepEqual(first, { draftId: 'draft-1', createdAt: now });
  assert.deepEqual(refreshed, { draftId: 'draft-1', createdAt: now });
  assert.notEqual(otherOwner.draftId, first.draftId);
  assert.notEqual(otherSurface.draftId, first.draftId);
  assert.equal(createCalls, 3);
  assert.match(taskProgressModel.ecommerceDraftKey({ ownerEmail: 'owner@example.com', surface: 'EcStudio' }), /ecstudio/);
});

test('active draft records reject foreign, malformed, expired, and future records', () => {
  assert.equal(typeof taskProgressModel.loadEcommerceDraftReference, 'function');
  assert.equal(typeof taskProgressModel.saveEcommerceDraftReference, 'function');

  const storage = memoryStorage();
  const now = 1_700_000_000_000;
  const key = taskProgressModel.ecommerceDraftKey({ ownerEmail: 'owner@example.com', surface: 'EcStudio' });

  storage.setItem(key, JSON.stringify({
    version: 1,
    ownerEmail: 'other@example.com',
    surface: 'EcStudio',
    draftId: 'foreign-draft',
    createdAt: now,
  }));
  assert.equal(taskProgressModel.loadEcommerceDraftReference({
    ownerEmail: 'owner@example.com',
    surface: 'EcStudio',
    now,
    storage,
  }), null);

  assert.equal(taskProgressModel.saveEcommerceDraftReference({
    ownerEmail: 'owner@example.com',
    surface: 'EcStudio',
    draftId: 'future-draft',
    createdAt: now + 1,
    storage,
  }), true);
  assert.equal(taskProgressModel.loadEcommerceDraftReference({
    ownerEmail: 'owner@example.com',
    surface: 'EcStudio',
    now,
    storage,
  }), null);

  assert.equal(taskProgressModel.saveEcommerceDraftReference({
    ownerEmail: 'owner@example.com',
    surface: 'EcStudio',
    draftId: 'expired-draft',
    createdAt: now - taskProgressModel.ECOMMERCE_DRAFT_REFERENCE_TTL_MS - 1,
    storage,
  }), true);
  assert.equal(taskProgressModel.loadEcommerceDraftReference({
    ownerEmail: 'owner@example.com',
    surface: 'EcStudio',
    now,
    storage,
  }), null);
});

test('explicit draft rotation clears only the matching old task before activating a new draft', () => {
  assert.equal(typeof taskProgressModel.rotateEcommerceDraft, 'function');

  const storage = memoryStorage();
  const now = 1_700_000_000_000;
  taskProgressModel.saveEcommerceDraftReference({
    ownerEmail: 'owner@example.com',
    surface: 'EcStudio',
    draftId: 'draft-old',
    createdAt: now,
    storage,
  });
  saveEcommerceTaskReference({
    ownerEmail: 'owner@example.com',
    draftId: 'draft-old',
    taskId: 'task-needs-review',
    createdAt: now,
    storage,
  });
  saveEcommerceTaskReference({
    ownerEmail: 'other@example.com',
    draftId: 'draft-old',
    taskId: 'other-task',
    createdAt: now,
    storage,
  });

  const next = taskProgressModel.rotateEcommerceDraft({
    ownerEmail: 'owner@example.com',
    surface: 'EcStudio',
    currentDraftId: 'draft-old',
    now: now + 1,
    storage,
    createDraftId: () => 'draft-new',
  });

  assert.deepEqual(next, { draftId: 'draft-new', createdAt: now + 1 });
  assert.equal(loadEcommerceTaskReference({ ownerEmail: 'owner@example.com', draftId: 'draft-old', now: now + 1, storage }), null);
  assert.equal(loadEcommerceTaskReference({ ownerEmail: 'other@example.com', draftId: 'draft-old', now: now + 1, storage })?.taskId, 'other-task');
  assert.deepEqual(taskProgressModel.loadEcommerceDraftReference({
    ownerEmail: 'owner@example.com',
    surface: 'EcStudio',
    now: now + 1,
    storage,
  }), next);
});

test('a needs-review task is removed from the old draft and a subsequent task is written under the rotated draft', () => {
  assert.equal(typeof taskProgressModel.rotateEcommerceDraft, 'function');

  const storage = memoryStorage();
  const now = 1_700_000_000_000;
  taskProgressModel.saveEcommerceDraftReference({
    ownerEmail: 'owner@example.com',
    surface: 'EcAuto',
    draftId: 'draft-review',
    createdAt: now,
    storage,
  });
  saveEcommerceTaskReference({
    ownerEmail: 'owner@example.com',
    draftId: 'draft-review',
    taskId: 'task-review',
    createdAt: now,
    storage,
  });

  const rotated = taskProgressModel.rotateEcommerceDraft({
    ownerEmail: 'owner@example.com',
    surface: 'EcAuto',
    currentDraftId: 'draft-review',
    now: now + 1,
    storage,
    createDraftId: () => 'draft-next',
  });
  saveEcommerceTaskReference({
    ownerEmail: 'owner@example.com',
    draftId: rotated.draftId,
    taskId: 'task-next',
    createdAt: now + 1,
    storage,
  });

  assert.equal(loadEcommerceTaskReference({ ownerEmail: 'owner@example.com', draftId: 'draft-review', now: now + 1, storage }), null);
  assert.equal(loadEcommerceTaskReference({ ownerEmail: 'owner@example.com', draftId: 'draft-next', now: now + 1, storage })?.taskId, 'task-next');
});

test('in-progress stable previews stay separate until a completed or needs-review result is accepted', () => {
  assert.equal(typeof taskProgressModel.mergeEcommerceInProgressPreview, 'function');
  assert.equal(typeof taskProgressModel.acceptEcommerceFinalResult, 'function');

  const preview = taskProgressModel.mergeEcommerceInProgressPreview({}, {
    id: 'asset-1',
    stableUrl: '/api/generated-assets/asset-1.png',
    role: 'main_text',
    label: '主图',
  });
  assert.deepEqual(Object.keys(preview), ['asset-1']);
  assert.equal(taskProgressModel.acceptEcommerceFinalResult({
    status: 'quality_check',
    images: { 'asset-1': '/api/generated-assets/asset-1.png' },
  }), null);
  assert.equal(taskProgressModel.acceptEcommerceFinalResult({
    status: 'polling',
    images: { 'asset-1': '/api/generated-assets/asset-1.png' },
  }), null);
  assert.deepEqual(taskProgressModel.acceptEcommerceFinalResult({
    status: 'completed',
    images: { 'asset-1': '/api/generated-assets/asset-1.png' },
  }), {
    status: 'completed',
    images: { 'asset-1': '/api/generated-assets/asset-1.png' },
  });
  assert.deepEqual(taskProgressModel.acceptEcommerceFinalResult({
    status: 'needs_review',
    images: { 'asset-1': '/api/generated-assets/asset-1.png' },
  }), {
    status: 'needs_review',
    images: { 'asset-1': '/api/generated-assets/asset-1.png' },
  });
});

test('late generation A image and completion cannot write after owner-draft rotation to generation B', async () => {
  let currentToken = taskProgressModel.createEcommerceGenerationToken({
    ownerEmail: 'Owner@Example.COM',
    draftId: 'draft-a',
  });
  const tokenA = currentToken;
  const effects = {
    preview: [],
    result: null,
    stage: 0,
    saved: 0,
    navigated: 0,
  };
  let releaseA;
  const requestA = new Promise(resolve => {
    releaseA = () => {
      if (!taskProgressModel.isEcommerceGenerationTokenCurrent(tokenA, {
        currentToken,
        ownerEmail: 'owner@example.com',
        draftId: 'draft-a',
      })) return resolve();
      effects.preview.push('A-image');
      effects.result = 'A-result';
      effects.stage = 3;
      effects.saved += 1;
      effects.navigated += 1;
      resolve();
    };
  });

  currentToken = taskProgressModel.createEcommerceGenerationToken({
    ownerEmail: 'owner@example.com',
    draftId: 'draft-b',
  });
  releaseA();
  await requestA;

  assert.deepEqual(effects, {
    preview: [],
    result: null,
    stage: 0,
    saved: 0,
    navigated: 0,
  });
  assert.equal(taskProgressModel.isEcommerceGenerationTokenCurrent(tokenA, {
    currentToken,
    ownerEmail: 'owner@example.com',
    draftId: 'draft-b',
  }), false);
  assert.equal(taskProgressModel.isEcommerceGenerationTokenCurrent(currentToken, {
    currentToken,
    ownerEmail: 'owner@example.com',
    draftId: 'draft-b',
  }), true);
});

test('task reference helpers reject malformed owner, draft, task, and record data', () => {
  const storage = memoryStorage();
  assert.equal(taskKey({ ownerEmail: '', draftId: 'ec-draft-1' }), '');
  assert.equal(taskKey({ ownerEmail: 'owner@example.com', draftId: '' }), '');
  assert.equal(saveEcommerceTaskReference({ ownerEmail: 'owner@example.com', draftId: 'ec-draft-1', taskId: '', storage }), false);
  storage.setItem(taskKey({ ownerEmail: 'owner@example.com', draftId: 'ec-draft-1' }), '{not-json');
  assert.equal(loadEcommerceTaskReference({ ownerEmail: 'owner@example.com', draftId: 'ec-draft-1', storage }), null);
});
