import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContentCanvasResult } from '../src/utils/contentCanvasHandoff.js';

test('content handoff copies stable images with provenance and never carries billing authority', () => {
  const result = buildContentCanvasResult({
    workId: 'work-1', title: '夏日杯子', source: 'xhs-content',
    cover_url: '/api/generated-assets/cover.png',
    image_urls: ['/api/generated-assets/page-1.png'],
    billing: { balance: 10 }, credits: 99,
    projectId: 'project-1',
    sourceVersionId: 'source-1',
    resultVersionId: 'result-1',
    projectAssetRefs: [{
      projectId: 'project-1', projectAssetId: 'asset-1', assetId: 'asset-1',
      contentHash: 'hash-1', stableUrl: '/api/generated-assets/cover.png', mimeType: 'image/png', mediaKind: 'image',
    }],
  });
  assert.equal(result._ecResult, true);
  assert.equal(result.source_content.workId, 'work-1');
  assert.deepEqual(result.images.map(image => image.label), ['内容封面', '内容配图 1']);
  assert.equal(result.images.every(image => image.group === '素材'), true);
  assert.equal('billing' in result, false);
  assert.equal('credits' in result, false);
  assert.equal(result.projectId, 'project-1');
  assert.equal(result.images[0].assetRef.projectAssetId, 'asset-1');
});

test('content handoff rejects a result without stable asset urls', () => {
  assert.throws(() => buildContentCanvasResult({ title: '空作品' }), /稳定图片/);
});
