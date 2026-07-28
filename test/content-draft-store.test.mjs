import test from 'node:test';
import assert from 'node:assert/strict';
import { clearContentDraft, loadContentDraft, saveContentDraft } from '../src/utils/contentDraftStore.js';

test('content drafts preserve editable fields but never serialize raw reference data', () => {
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };

  saveContentDraft({
    ownerEmail: 'Creator@example.com',
    source: 'plog',
    draftId: 'content-plog-42',
    draft: {
      text: '下班后的咖啡时间',
      style: 'ins-minimal',
      layout: 'casual',
      coverVariant: 'collage',
      referenceAssetIds: ['asset-42', 'data:image/png;base64,unsafe', 'blob:unsafe'],
      refImage: new File(['raw'], 'reference.png', { type: 'image/png' }),
    },
  }, { storage });

  assert.deepEqual(loadContentDraft({ ownerEmail: 'creator@example.com', source: 'plog' }, { storage }), {
    draftId: 'content-plog-42',
    text: '下班后的咖啡时间',
    style: 'ins-minimal',
    layout: 'casual',
    coverVariant: 'collage',
    referenceAssetIds: ['asset-42'],
  });
  assert.doesNotMatch([...values.values()].join(''), /data:|blob:|base64|reference\.png/);
});

test('a completed content cycle clears only its own stored recovery reference', () => {
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  const ownerEmail = 'creator@example.com';
  saveContentDraft({ ownerEmail, source: 'plog', draftId: 'plog-1', draft: { text: '旧任务' } }, { storage });
  saveContentDraft({ ownerEmail, source: 'xhs-content', draftId: 'xhs-1', draft: { text: '另一个任务' } }, { storage });

  assert.equal(clearContentDraft({ ownerEmail, source: 'plog' }, { storage }), true);
  assert.equal(loadContentDraft({ ownerEmail, source: 'plog' }, { storage }), null);
  assert.equal(loadContentDraft({ ownerEmail, source: 'xhs-content' }, { storage })?.text, '另一个任务');
});
