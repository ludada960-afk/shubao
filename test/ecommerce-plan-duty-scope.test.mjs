import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAssetPlan } from '../server/ecommerceEngine/assetPlanner.mjs';
import { validatePlanContract } from '../server/ecommerceEngine/planContract.mjs';
import { normalizeLegacyRoleAlias } from '../server/ecommerceEngine/orchestrator.mjs';

const productTruth = {
  category: '保温杯',
  productName: '蓝色钛保温杯',
  sourceAssetIds: ['product-front'],
  confirmedFacts: { material: { value: '钛', source: 'user' } },
  uncertainFacts: [],
};

const campaignBible = { directionId: 'proof-first', title: 'Proof first', confirmed: true, referenceAssetIds: ['style-board'] };

// 用户实测配置：主图 1:1 ×5 + 详情 ×9 + 主图 3:4 ×3 = 17 张
const friendSizing = {
  smart: false,
  resolution: '2K',
  imageModel: 'nano-banana-pro',
  contentType: 'main',
  images: [
    { key: 'main_text', count: 5, ratio: '1:1', targetRatio: '1:1', cropPolicy: 'none', label: '商品主图' },
    { key: 'detail', count: 9, ratio: '9:16', targetRatio: '9:16', cropPolicy: 'none', label: '详情切片' },
    { key: 'main_3x4', count: 3, ratio: '3:4', targetRatio: '3:4', cropPolicy: 'none', label: '商品主图 3:4' },
  ],
};

test('multi-ratio hero suite plans and validates (user-reported first-generation failure)', () => {
  const plan = buildAssetPlan({
    productTruth,
    campaignBible,
    platform: 'taobao',
    sizing: friendSizing,
    skus: [],
  });
  assert.equal(plan.length, 17, '主图 5 + 详情 9 + 主图 3:4 3 应规划出 17 张');
  validatePlanContract(plan);
  const mainText = plan.filter(item => item.role === 'main_text');
  const main3x4 = plan.filter(item => item.role === 'main_3x4');
  assert.equal(mainText.length, 5);
  assert.equal(main3x4.length, 3);
  // 同一职责在不同放置位（1:1 与 3:4）必须被允许
  assert.ok(mainText[0].commercialDutyId !== main3x4[0].commercialDutyId);
});

test('same commercial duty is allowed across different roles but rejected within one role', () => {
  const base = {
    purpose: 'x',
    ratio: '1:1',
    targetRatio: '1:1',
    cropPolicy: 'none',
    platform: 'taobao',
    imageModel: 'nano-banana-pro',
    generationSize: { width: 2048, height: 2048 },
    exportTargets: [],
    generationMode: 'edit',
    productAssetIds: ['product-front'],
    styleReferenceIds: [],
    proofAssetIds: [],
    requiredFacts: [],
    riskLevel: 'low',
    qualityChecks: [],
    shotIntent: { type: 'product_hero', evidenceTier: 'safe', sceneFamily: 'studio', composition: 'centered', label: 'hero', camera: { azimuth: 'front' }, crop: 'full', interactionState: 'static' },
  };
  const sharedGoal = 'Establish immediate complete-product recognition.';
  const crossRole = [
    { ...base, id: 'main-text-1', role: 'main_text', commercialDutyId: 'maintext:productrecognition', communicationGoal: sharedGoal },
    { ...base, id: 'main-3x4-1', role: 'main_3x4', commercialDutyId: 'main3x4:productrecognition', communicationGoal: sharedGoal, shotIntent: { ...base.shotIntent, crop: 'tight' } },
  ];
  assert.doesNotThrow(() => validatePlanContract(crossRole), '不同角色的同一职责不应被判重复');

  const sameRole = [
    { ...base, id: 'main-text-1', role: 'main_text', commercialDutyId: 'maintext:productrecognition', communicationGoal: sharedGoal },
    { ...base, id: 'main-text-2', role: 'main_text', commercialDutyId: 'maintext:primarybenefit', communicationGoal: sharedGoal, shotIntent: { ...base.shotIntent, crop: 'tight' } },
  ];
  assert.throws(() => validatePlanContract(sameRole), /duplicate commercial duty/);
});

test('legacy hyphenated roles are normalized before duty lookup', () => {
  assert.equal(normalizeLegacyRoleAlias('main-3x4'), 'main_3x4');
  assert.equal(normalizeLegacyRoleAlias('main-text'), 'main_text');
  assert.equal(normalizeLegacyRoleAlias('white-bg'), 'white_background');
  assert.equal(normalizeLegacyRoleAlias('detail-slice-surface-finish'), 'detail_slice_surface-finish');
  assert.equal(normalizeLegacyRoleAlias('main_text'), 'main_text');
});
