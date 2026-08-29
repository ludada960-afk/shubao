// test/canvas-asset-quick-drag.test.mjs
// 4c183cd4 续命 P-H 画布 1-click 拖入素材 测试
//
// 覆盖:
//   1) ASSET_DRAG_SOURCES 常量三路
//   2) isAssetDragSource 校验
//   3) normalizeAssetDragPayload 拒绝无效 + 接受有效
//   4) pickProductProfileAssetPayloads 纯函数: profile → assets 列表
//   5) loadPublicTemplateDragPayloads fetch mock 路径
//   6) buildUserUploadDragPayload: dataURL / 非图片拒绝
//   7) importDragPayloadToProject: 委托到 importImageAssetToProject

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ASSET_DRAG_SOURCES,
  ASSET_DRAG_SOURCE_LABELS,
  ASSET_DRAG_PRESET_BUTTONS,
  isAssetDragSource,
  normalizeAssetDragPayload,
  pickProductProfileAssetPayloads,
  loadPublicTemplateDragPayloads,
  buildUserUploadDragPayload,
  importDragPayloadToProject,
} from '../src/services/projectAssetDrag.js';

// ─── 1. 常量 ──────────────────────────────────────────
test('ASSET_DRAG_SOURCES has the three required sources', () => {
  assert.equal(ASSET_DRAG_SOURCES.PRODUCT_PROFILE, 'product-profile');
  assert.equal(ASSET_DRAG_SOURCES.PUBLIC_TEMPLATE, 'public-template');
  assert.equal(ASSET_DRAG_SOURCES.USER_UPLOAD, 'user-upload');
  assert.equal(Object.keys(ASSET_DRAG_SOURCES).length, 3);
});

test('ASSET_DRAG_SOURCE_LABELS covers every source key', () => {
  for (const k of Object.values(ASSET_DRAG_SOURCES)) {
    assert.ok(ASSET_DRAG_SOURCE_LABELS[k], `missing label for ${k}`);
  }
});

test('ASSET_DRAG_PRESET_BUTTONS has three entries (商品档案 / 公共素材库 / 本地上传)', () => {
  assert.equal(ASSET_DRAG_PRESET_BUTTONS.length, 3);
  const keys = ASSET_DRAG_PRESET_BUTTONS.map((b) => b.key);
  assert.deepEqual(keys, [
    ASSET_DRAG_SOURCES.PRODUCT_PROFILE,
    ASSET_DRAG_SOURCES.PUBLIC_TEMPLATE,
    ASSET_DRAG_SOURCES.USER_UPLOAD,
  ]);
});

// ─── 2. isAssetDragSource ─────────────────────────────────
test('isAssetDragSource accepts only known sources', () => {
  assert.equal(isAssetDragSource('product-profile'), true);
  assert.equal(isAssetDragSource('public-template'), true);
  assert.equal(isAssetDragSource('user-upload'), true);
  assert.equal(isAssetDragSource('unknown'), false);
  assert.equal(isAssetDragSource(''), false);
  assert.equal(isAssetDragSource(null), false);
  assert.equal(isAssetDragSource(undefined), false);
  assert.equal(isAssetDragSource(42), false);
});

// ─── 3. normalizeAssetDragPayload ───────────────────────────
test('normalizeAssetDragPayload rejects null / missing source / missing ref', () => {
  assert.equal(normalizeAssetDragPayload(null), null);
  assert.equal(normalizeAssetDragPayload(undefined), null);
  assert.equal(normalizeAssetDragPayload({}), null);
  assert.equal(normalizeAssetDragPayload({ source: 'unknown', ref: 'r' }), null);
  assert.equal(normalizeAssetDragPayload({ source: 'product-profile' }), null);
  assert.equal(normalizeAssetDragPayload({ source: 'product-profile', ref: '  ' }), null);
});

test('normalizeAssetDragPayload normalizes a valid payload', () => {
  const out = normalizeAssetDragPayload({
    source: 'product-profile',
    ref: 'profile:abc#asset1',
    label: 'Hero Shot',
    mime: 'image/png',
    remoteUrl: 'https://example.com/x.png',
    dataUrl: 'data:image/png;base64,AAA',
  });
  assert.ok(out, 'expected normalized payload');
  assert.equal(out.source, 'product-profile');
  assert.equal(out.ref, 'profile:abc#asset1');
  assert.equal(out.label, 'Hero Shot');
  assert.equal(out.mime, 'image/png');
  assert.equal(out.remoteUrl, 'https://example.com/x.png');
  assert.equal(out.dataUrl, 'data:image/png;base64,AAA');
  assert.equal(out.thumbUrl, 'https://example.com/x.png');
});

test('normalizeAssetDragPayload falls back to remoteUrl for thumbUrl', () => {
  const out = normalizeAssetDragPayload({
    source: 'public-template',
    ref: 'tpl:tpl-001',
    remoteUrl: 'https://example.com/tpl.png',
  });
  assert.equal(out.thumbUrl, 'https://example.com/tpl.png');
  assert.equal(out.label, 'tpl:tpl-001'); // label falls back to raw ref (no prefix stripping)
});

// ─── 4. pickProductProfileAssetPayloads ─────────────────────
test('pickProductProfileAssetPayloads extracts image assets from a profile', () => {
  const profile = {
    id: 'p-1',
    assets: [
      { id: 'a1', kind: 'image', url: 'https://x/1.png', label: '正面' },
      { id: 'a2', kind: 'image', url: 'https://x/2.png', label: '侧面' },
      { id: 'a3', kind: 'document', url: 'https://x/3.pdf', label: '手册' },
    ],
  };
  const out = pickProductProfileAssetPayloads(profile);
  assert.equal(out.length, 2, 'document asset should be filtered out');
  assert.equal(out[0].source, 'product-profile');
  assert.equal(out[0].ref, 'profile:p-1#a1');
  assert.equal(out[0].label, '正面');
  assert.equal(out[0].remoteUrl, 'https://x/1.png');
});

test('pickProductProfileAssetPayloads respects max cap', () => {
  const profile = {
    id: 'p',
    assets: Array.from({ length: 30 }, (_, i) => ({
      id: `a${i}`,
      kind: 'image',
      url: `https://x/${i}.png`,
    })),
  };
  const out = pickProductProfileAssetPayloads(profile, { max: 5 });
  assert.equal(out.length, 5);
});

test('pickProductProfileAssetPayloads handles empty / invalid profile', () => {
  assert.deepEqual(pickProductProfileAssetPayloads(null), []);
  assert.deepEqual(pickProductProfileAssetPayloads({}), []);
  assert.deepEqual(pickProductProfileAssetPayloads({ id: 'p', assets: 'not-array' }), []);
  assert.deepEqual(pickProductProfileAssetPayloads({ id: '', assets: [] }), []);
});

test('pickProductProfileAssetPayloads accepts profileId alias', () => {
  const profile = { profileId: 'p-2', assets: [{ id: 'a1', kind: 'image', url: 'u' }] };
  const out = pickProductProfileAssetPayloads(profile);
  assert.equal(out.length, 1);
  assert.equal(out[0].ref, 'profile:p-2#a1');
});

// ─── 5. loadPublicTemplateDragPayloads (mock fetch) ────────
test('loadPublicTemplateDragPayloads uses injected fetch and maps items', async () => {
  const calls = [];
  const fakeFetch = async (url, opts) => {
    calls.push({ url, opts });
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          items: [
            { id: 'tpl-001', name: '白底主图', cat: 'product-main', thumbUrl: 'https://x/t1.png' },
            { id: 'tpl-002', name: '暖光主图', cat: 'product-main', thumbUrl: 'https://x/t2.png' },
            { id: 'tpl-003', name: '客厅场景', cat: 'product-scene' },
          ],
        };
      },
    };
  };
  const out = await loadPublicTemplateDragPayloads({
    cats: ['product-main', 'product-scene'],
    limit: 12,
    fetchImpl: fakeFetch,
  });
  assert.equal(out.length, 3);
  assert.equal(out[0].source, 'public-template');
  assert.equal(out[0].ref, 'tpl:tpl-001');
  assert.equal(out[0].label, '白底主图');
  assert.equal(out[0].thumbUrl, 'https://x/t1.png');
  assert.equal(out[0].cat, 'product-main');
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.includes('cat=product-main%2Cproduct-scene'));
  assert.ok(calls[0].url.includes('limit=12'));
});

test('loadPublicTemplateDragPayloads returns [] on non-ok response', async () => {
  const fakeFetch = async () => ({ ok: false, status: 500, async json() { return {}; } });
  const out = await loadPublicTemplateDragPayloads({ fetchImpl: fakeFetch });
  assert.deepEqual(out, []);
});

test('loadPublicTemplateDragPayloads returns [] when fetchImpl is null and global fetch missing', async () => {
  const saved = globalThis.fetch;
  if (saved) delete globalThis.fetch;
  try {
    const out = await loadPublicTemplateDragPayloads({ fetchImpl: null });
    assert.deepEqual(out, []);
  } finally {
    if (saved) globalThis.fetch = saved;
  }
});

test('loadPublicTemplateDragPayloads clamps limit to [1, 50]', async () => {
  const calls = [];
  const fakeFetch = async (url) => {
    calls.push(url);
    return { ok: true, status: 200, async json() { return { items: [] }; } };
  };
  await loadPublicTemplateDragPayloads({ limit: 9999, fetchImpl: fakeFetch });
  assert.ok(calls[0].includes('limit=50'));
  await loadPublicTemplateDragPayloads({ limit: 0, fetchImpl: fakeFetch });
  assert.ok(calls[1].includes('limit=1'));
});

// ─── 6. buildUserUploadDragPayload ─────────────────────────
test('buildUserUploadDragPayload rejects null file', async () => {
  await assert.rejects(() => buildUserUploadDragPayload(null), /请选择图片文件/);
});

test('buildUserUploadDragPayload rejects non-image mime', async () => {
  const file = { name: 'doc.pdf', type: 'application/pdf' };
  await assert.rejects(() => buildUserUploadDragPayload(file), /仅支持图片格式/);
});

// ─── 7. importDragPayloadToProject ─────────────────────────
test('importDragPayloadToProject rejects invalid payload', async () => {
  await assert.rejects(() => importDragPayloadToProject('p1', null), /素材信息不完整/);
  await assert.rejects(() => importDragPayloadToProject('p1', { source: 'unknown', ref: 'r' }), /素材信息不完整/);
  await assert.rejects(() => importDragPayloadToProject('', { source: 'product-profile', ref: 'r' }), /请选择项目/);
});

test('importDragPayloadToProject delegates to importImageAssetToProject with dataUrl', async () => {
  const calls = [];
  const fakeImporter = async (projectId, opts) => {
    calls.push({ projectId, opts });
    return { projectAssetId: 'pa-1' };
  };
  const payload = {
    source: 'user-upload',
    ref: 'local:foo.png#1',
    label: 'foo',
    mime: 'image/png',
    dataUrl: 'data:image/png;base64,AAA',
  };
  const out = await importDragPayloadToProject('p-1', payload, { importImageAssetToProject: fakeImporter });
  assert.deepEqual(out, { projectAssetId: 'pa-1' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].projectId, 'p-1');
  assert.equal(calls[0].opts.dataUrl, 'data:image/png;base64,AAA');
  assert.equal(calls[0].opts.label, 'foo');
});

test('importDragPayloadToProject uses remoteUrl when no dataUrl', async () => {
  const calls = [];
  const fakeImporter = async (projectId, opts) => {
    calls.push({ projectId, opts });
    return { ok: true };
  };
  const payload = {
    source: 'public-template',
    ref: 'tpl:tpl-001',
    label: 'tpl',
    remoteUrl: 'https://x/t.png',
  };
  await importDragPayloadToProject('p-2', payload, { importImageAssetToProject: fakeImporter });
  assert.equal(calls[0].opts.url, 'https://x/t.png');
  assert.ok(!('dataUrl' in calls[0].opts));
});

test('importDragPayloadToProject returns null when no importer provided', async () => {
  const out = await importDragPayloadToProject('p', { source: 'user-upload', ref: 'r', dataUrl: 'd' }, {});
  assert.equal(out, null);
});
