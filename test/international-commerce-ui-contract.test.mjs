import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createSmartConfiguration } from '../src/pages/Home/ec/workbenchState.js';
import { buildEcommercePendingAction, resolveSizingImages } from '../src/pages/Home/ec/ecommercePlanModel.js';
import { normalizeCommerceContext } from '../src/pages/Home/ec/internationalCommerceRegistry.js';

const ecMode = readFileSync(new URL('../src/pages/Home/EcMode.jsx', import.meta.url), 'utf8');
const sizingPanel = readFileSync(new URL('../src/pages/Home/ec/SizingPanel.jsx', import.meta.url), 'utf8');
const commerceRegistry = readFileSync(new URL('../src/pages/Home/ec/internationalCommerceRegistry.js', import.meta.url), 'utf8');
const designDirection = readFileSync(new URL('../src/pages/Home/ec/DesignDirection.jsx', import.meta.url), 'utf8');
const orchestrator = readFileSync(new URL('../server/ecommerceEngine/orchestrator.mjs', import.meta.url), 'utf8');
const canvasStudio = readFileSync(new URL('../src/pages/EcCanvas/components/CanvasStudio.jsx', import.meta.url), 'utf8');
const canvasPage = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
const worksPage = readFileSync(new URL('../src/pages/Works/index.jsx', import.meta.url), 'utf8');

test('smart configuration carries the global commerce context', () => {
  const configuration = createSmartConfiguration();
  assert.deepEqual(configuration.commerceContext, {
    platform: 'smart',
    contentType: 'main',
    targetLanguage: 'visual',
  });
  assert.deepEqual(normalizeCommerceContext(configuration.commerceContext), {
    platform: 'smart',
    contentType: 'main',
    targetLanguage: 'visual',
    locale: 'und',
    policyVersion: 'global-commerce-v1',
  });
});

test('content type changes smart image defaults without changing the detail ratio contract', () => {
  const detail = resolveSizingImages('amazon', { smart: true, images: [], contentType: 'detail' });
  assert.ok(detail.some(image => image.key === 'detail'));
  assert.ok(detail.every(image => image.key === 'detail' || image.key === 'sku'));
  assert.ok(detail.filter(image => image.key === 'detail').every(image => image.ratio === '9:16'));
});

test('platform picker exposes grouped markets, target language and content type controls', () => {
  assert.match(sizingPanel, /COMMERCE_PLATFORMS/);
  assert.match(sizingPanel, /国内平台/);
  assert.match(sizingPanel, /跨境平台/);
  assert.match(sizingPanel, /目标语言/);
  assert.match(commerceRegistry, /无文字（纯视觉）/);
  assert.match(sizingPanel, /COMMERCE_CONTENT_TYPES/);
  assert.match(ecMode, /targetLanguage/);
  assert.match(ecMode, /contentType/);
});

test('pending generation and orchestration preserve the same commerce context', () => {
  const pending = buildEcommercePendingAction({
    platform: 'amazon',
    commerceContext: { platform: 'amazon', contentType: 'detail', targetLanguage: 'en' },
    sizing: { smart: true, images: [], resolution: '2K', contentType: 'detail' },
  });
  assert.deepEqual(pending.commerceContext, {
    platform: 'amazon',
    contentType: 'detail',
    targetLanguage: 'en',
    locale: 'en-US',
    policyVersion: 'global-commerce-v1',
  });
  assert.match(designDirection, /commerceContext/);
  assert.match(designDirection, /targetLanguage/);
  assert.match(designDirection, /contentType/);
  assert.match(orchestrator, /normalizeCommerceContext/);
  assert.match(orchestrator, /commerceContext/);
  assert.match(canvasStudio, /onTargetLanguageChange/);
  assert.match(canvasStudio, /onContentTypeChange/);
  assert.match(canvasPage, /commerce_context/);
  assert.match(canvasPage, /targetLanguage/);
  assert.match(worksPage, /COMMERCE_LANGUAGES/);
});
