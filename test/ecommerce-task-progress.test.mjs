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
import { readFileSync } from 'node:fs';

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
    quality_check: '正在优化',
    repairing: '正在优化',
    completed: '已完成',
    needs_review: '待补全',
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

test('image generation errors render inside the progress surface beside the affected image', () => {
  const source = readFileSync(new URL('../src/pages/Home/ec/DesignDirection.jsx', import.meta.url), 'utf8');
  assert.match(source, /className="ec-generation-progress"/);
  assert.match(source, /asset\.error/);
  assert.match(source, /role="alert"/);
});

test('global task dock lists every failed image with its own label and error', () => {
  const source = readFileSync(new URL('../src/components/task/TaskSidebar.jsx', import.meta.url), 'utf8');
  assert.match(source, /assetErrors\.map/);
  assert.match(source, /asset\.label/);
  assert.match(source, /asset\.error/);
  assert.doesNotMatch(source, /assetErrors\[0\]/);
  assert.match(source, /补全未完成图片/);
  assert.doesNotMatch(source, /整套未完成|未形成完整交付|重新生成整套/);
});

test('normalizes an asset with Asset Plan role and never exposes a provider state as its label', () => {
  const asset = normalizeEcommerceAsset({
    assetId: 'detail-1',
    status: 'quality_check',
    stableUrl: '/api/generated-assets/detail-1.png',
    plan: {
      role: 'detail_slice_feature',
      label: '细节特写',
      group: '详情图',
      ratio: '3:4',
      generationSize: '1536x2048',
    },
  });

  assert.deepEqual(asset, {
    id: 'detail-1',
    role: 'detail_slice_feature',
    label: '细节特写',
    displayName: '细节特写',
    group: '详情图',
    ratio: '3:4',
    size: '1536x2048',
    width: 1536,
    height: 2048,
    state: 'quality_check',
    userState: '正在优化',
    stableUrl: '/api/generated-assets/detail-1.png',
    previewUrl: '',
    error: '',
  });
  assert.doesNotMatch(asset.userState, /quality_check|provider/i);
});

test('keeps an older review image as a non-deliverable preview without exposing internal review language', () => {
  const asset = normalizeEcommerceAsset({
    assetId: 'review-1',
    state: 'needs_review',
    previewUrl: '/api/generated-assets/review-1.png',
  });
  assert.equal(asset.userState, '待补全');
  assert.equal(asset.previewUrl, '/api/generated-assets/review-1.png');
  assert.equal(asset.stableUrl, '');
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

test('direction refresh action survives page reload for the same owner draft and clears exactly once', () => {
  const {
    clearEcommerceDirectionRefreshAction,
    loadEcommerceDirectionRefreshAction,
    saveEcommerceDirectionRefreshAction,
  } = taskProgressModel;
  assert.equal(typeof clearEcommerceDirectionRefreshAction, 'function');
  assert.equal(typeof loadEcommerceDirectionRefreshAction, 'function');
  assert.equal(typeof saveEcommerceDirectionRefreshAction, 'function');
  const storage = memoryStorage();
  const now = 1_700_000_000_000;
  const identity = {
    ownerEmail: 'Owner@Example.COM',
    draftId: 'ec-draft-direction-refresh',
    actionId: 'ec-direction-refresh-action-1',
    createdAt: now,
    storage,
  };

  assert.equal(saveEcommerceDirectionRefreshAction(identity), true);
  assert.deepEqual(loadEcommerceDirectionRefreshAction({
    ownerEmail: 'owner@example.com',
    draftId: identity.draftId,
    now: now + 1,
    storage,
  }), {
    actionId: identity.actionId,
    createdAt: now,
  });
  assert.equal(loadEcommerceDirectionRefreshAction({
    ownerEmail: 'other@example.com',
    draftId: identity.draftId,
    now: now + 1,
    storage,
  }), null);
  assert.equal(clearEcommerceDirectionRefreshAction({
    ownerEmail: identity.ownerEmail,
    draftId: identity.draftId,
    actionId: 'different-action',
    storage,
  }), false);
  assert.equal(clearEcommerceDirectionRefreshAction(identity), true);
  assert.equal(loadEcommerceDirectionRefreshAction({ ...identity, now: now + 1 }), null);
});

test('fresh visits create a new draft even for the same owner and surface', () => {
  assert.equal(typeof taskProgressModel.loadOrCreateEcommerceDraft, 'function');
  assert.equal(typeof taskProgressModel.ecommerceDraftKey, 'function');

  const storage = memoryStorage();
  const now = 1_700_000_000_000;
  let createCalls = 0;
  const createDraftId = () => {
    createCalls += 1;
    return `draft-${createCalls}`;
  };

  taskProgressModel.saveEcommerceDraftReference({
    ownerEmail: 'owner@example.com',
    surface: 'EcStudio',
    draftId: 'legacy-draft',
    now,
    createdAt: now,
    storage,
  });

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
  assert.deepEqual(refreshed, { draftId: 'draft-2', createdAt: now + 1 });
  assert.notEqual(first.draftId, 'legacy-draft');
  assert.notEqual(otherOwner.draftId, first.draftId);
  assert.notEqual(otherSurface.draftId, first.draftId);
  assert.equal(createCalls, 4);
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

test('in-progress stable previews stay separate until a complete suite is accepted', () => {
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
    imageRecords: [{
      id: 'asset-1',
      stableUrl: '/api/generated-assets/asset-1.png',
      role: 'white_background',
      label: '白底首图',
      displayName: '白底首图',
      group: '白底图',
      ratio: '1:1',
      size: '2048x2048',
      width: 2048,
      height: 2048,
      state: 'completed',
    }],
  }), {
    status: 'completed',
    images: { 'asset-1': '/api/generated-assets/asset-1.png' },
    imageRecords: [{
      id: 'asset-1',
      key: 'asset-1',
      assetId: 'asset-1',
      url: '/api/generated-assets/asset-1.png',
      stableUrl: '/api/generated-assets/asset-1.png',
      role: 'white_background',
      label: '白底首图',
      displayName: '白底首图',
      name: '白底首图',
      group: '白底图',
      ratio: '1:1',
      size: '2048x2048',
      width: 2048,
      height: 2048,
      state: 'completed',
    }],
  });
  assert.equal(taskProgressModel.acceptEcommerceFinalResult({
    status: 'needs_review',
    images: { 'asset-1': '/api/generated-assets/asset-1.png' },
  }), null);
});

test('one plan item keeps one preview slot when a repaired stable URL replaces the first attempt', () => {
  const first = taskProgressModel.mergeEcommerceInProgressPreview({}, {
    id: 'main-1',
    stableUrl: '/api/generated-assets/first.png',
    role: 'main_text',
    label: '商品识别主图',
  });
  const repaired = taskProgressModel.mergeEcommerceInProgressPreview(first, {
    id: 'main-1',
    stableUrl: '/api/generated-assets/repaired.png',
    role: 'main_text',
    label: '商品识别主图',
  });

  assert.deepEqual(Object.keys(repaired), ['main-1']);
  assert.equal(repaired['main-1'].stableUrl, '/api/generated-assets/repaired.png');
});

test('only quality-approved completed assets are exposed as deliverable previews', () => {
  const base = { id: 'main-1', stableUrl: '/api/generated-assets/main-1.png' };
  assert.equal(taskProgressModel.isEcommerceAssetDeliverable({ ...base, state: 'completed' }), true);
  assert.equal(taskProgressModel.isEcommerceAssetDeliverable({ ...base, state: 'needs_review' }), false);
  assert.equal(taskProgressModel.isEcommerceAssetDeliverable({ ...base, state: 'quality_check' }), false);
  assert.equal(taskProgressModel.isEcommerceAssetDeliverable(base), false);
});

test('logged-out generation preflight requests an in-place login without creating a task', () => {
  assert.deepEqual(taskProgressModel.ecommerceLoginPreflight({ logged: false }), {
    allowed: false,
    action: { type: 'SHOW_LOGIN', show: true },
  });
  assert.deepEqual(taskProgressModel.ecommerceLoginPreflight({ logged: true }), {
    allowed: true,
    action: null,
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

test('analysis supplement uploads do not need a generation token while stale formal generation is rejected', () => {
  const analysisUpload = taskProgressModel.resolveEcommerceSupplementUpload({
    product: [{ assetId: 'product-1' }],
    reference: [{ assetId: 'reference-1' }],
  });
  assert.deepEqual(analysisUpload, {
    product: [{ assetId: 'product-1' }],
    reference: [{ assetId: 'reference-1' }],
  });

  const token = taskProgressModel.createEcommerceGenerationToken({
    ownerEmail: 'owner@example.com',
    draftId: 'draft-a',
  });
  assert.equal(taskProgressModel.resolveEcommerceSupplementUpload({
    product: [{ assetId: 'product-1' }],
    reference: [],
    generationToken: token,
    isGenerationCurrent: () => false,
  }), null);
});

test('missing generation context is explicit and an immediate work rotation aborts request A before B callbacks', () => {
  const contextError = taskProgressModel.createEcommerceGenerationPreconditionError();
  assert.equal(contextError.code, 'ECOMMERCE_GENERATION_CONTEXT_REQUIRED');
  assert.match(contextError.message, /登录|草稿/);

  const tokenRef = {
    current: taskProgressModel.createEcommerceGenerationToken({
      ownerEmail: 'owner@example.com',
      draftId: 'draft-a',
    }),
  };
  let aborted = 0;
  const abortRef = { current: { abort: () => { aborted += 1; } } };
  taskProgressModel.invalidateEcommerceGenerationRequest({ tokenRef, abortRef });

  assert.equal(tokenRef.current, null);
  assert.equal(abortRef.current, null);
  assert.equal(aborted, 1);
});

test('generation lifecycle controller aborts A on B rotation and ignores A callbacks before unmount aborts B', async () => {
  let aborted = 0;
  const lifecycle = taskProgressModel.createEcommerceGenerationLifecycleController({
    ownerEmail: 'owner@example.com',
    draftId: 'draft-a',
    createAbortController: () => ({
      signal: { kind: 'test-signal' },
      abort: () => { aborted += 1; },
    }),
  });
  const view = { preview: '', result: '' };
  const applyImage = (generation, url) => {
    if (lifecycle.isCurrent(generation.token)) view.preview = url;
  };
  const applyCompletion = (generation, value) => {
    if (lifecycle.isCurrent(generation.token)) view.result = value;
  };

  const requestA = lifecycle.begin();
  assert.equal(requestA.signal.kind, 'test-signal');
  let settleA;
  const lateA = new Promise(resolve => { settleA = resolve; }).then(({ image, result }) => {
    applyImage(requestA, image);
    applyCompletion(requestA, result);
  });
  lifecycle.rotate({ ownerEmail: 'owner@example.com', draftId: 'draft-b' });
  assert.equal(aborted, 1);

  settleA({ image: 'stable-a', result: 'complete-a' });
  await lateA;
  assert.deepEqual(view, { preview: '', result: '' });

  const requestB = lifecycle.begin();
  applyImage(requestB, 'stable-b');
  applyCompletion(requestB, 'complete-b');
  assert.deepEqual(view, { preview: 'stable-b', result: 'complete-b' });

  lifecycle.unmount();
  assert.equal(aborted, 2);
  applyImage(requestB, 'late-b');
  assert.equal(view.preview, 'stable-b');
});

test('generation lifecycle surfaces a missing context before a missing quote and restores UI loading', () => {
  const view = { loading: true, error: '' };
  const lifecycle = taskProgressModel.createEcommerceGenerationLifecycleController({
    ownerEmail: '',
    draftId: '',
  });
  const generation = taskProgressModel.startEcommerceGenerationLifecycle({
    lifecycle,
    quoteReady: false,
    onError: (error) => {
      view.loading = false;
      view.error = error.message;
    },
  });

  assert.equal(generation, null);
  assert.equal(view.loading, false);
  assert.match(view.error, /登录|草稿/);
});

test('task reference helpers reject malformed owner, draft, task, and record data', () => {
  const storage = memoryStorage();
  assert.equal(taskKey({ ownerEmail: '', draftId: 'ec-draft-1' }), '');
  assert.equal(taskKey({ ownerEmail: 'owner@example.com', draftId: '' }), '');
  assert.equal(saveEcommerceTaskReference({ ownerEmail: 'owner@example.com', draftId: 'ec-draft-1', taskId: '', storage }), false);
  storage.setItem(taskKey({ ownerEmail: 'owner@example.com', draftId: 'ec-draft-1' }), '{not-json');
  assert.equal(loadEcommerceTaskReference({ ownerEmail: 'owner@example.com', draftId: 'ec-draft-1', storage }), null);
});
