import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = async path => readFile(new URL(path, import.meta.url), 'utf8');

test('reachable XHS and Plog flows do not trust client credits or local trial counters', async () => {
  const xhs = await source('../src/pages/Home/XhsContentMode.jsx');
  const plog = await source('../src/pages/Plog/index.jsx');

  assert.doesNotMatch(xhs, /credits\s*-\s*1/);
  assert.doesNotMatch(xhs, /trialRemaining/);
  assert.doesNotMatch(xhs, /SET_CREDITS/);
  assert.doesNotMatch(plog, /credits\s*-\s*1|trialRemaining|SET_CREDITS/);
});

test('XHS and both reachable Plog entrypoints make reference-only content-set paywall actions without auto-saving prior forms', async () => {
  const xhs = await source('../src/pages/Home/XhsContentMode.jsx');
  const plog = await source('../src/pages/Plog/index.jsx');

  for (const [name, page] of [
    ['XHS', xhs],
    ['home Plog', xhs],
    ['standalone Plog', plog],
  ]) {
    assert.match(page, /currency:\s*'content_sets'/, `${name} must select content sets`);
    assert.match(page, /draftId:\s*\w+DraftId/, `${name} must persist a stable draft reference`);
    assert.match(page, /buildContentPendingAction\(/, `${name} must not place raw form data in pending storage`);
    assert.doesNotMatch(page, /loadContentDraft\(|saveContentDraft\(/, `${name} must not auto-restore or persist a completed form`);
  }
  assert.doesNotMatch(xhs, /handleGenerationAccessError\(e,\s*dispatch,\s*\{\s*source:\s*'xhs-content',\s*message:/s);
  assert.doesNotMatch(xhs, /handleGenerationAccessError\(e,\s*dispatch,\s*\{\s*source:\s*'xhs-plog',\s*message:/s);
  assert.doesNotMatch(plog, /handleGenerationAccessError\(e,\s*dispatch,\s*\{\s*source:\s*'plog',\s*message:/s);
});

test('content results use only authoritative complete events and refresh the signed balance', async () => {
  const xhs = await source('../src/pages/Home/XhsContentMode.jsx');
  const plog = await source('../src/pages/Plog/index.jsx');

  for (const [name, page] of [['XHS', xhs], ['standalone Plog', plog]]) {
    assert.match(page, /acceptAuthoritativeContentCompletion\(/, `${name} must reject false local success`);
    assert.match(page, /refreshBillingBalance\(\)/, `${name} must refresh an authoritative content balance`);
  }
  assert.match(xhs, /const usePreview\s*=\s*!logged/);
  assert.match(plog, /const usePreview\s*=\s*!state\.logged/);
});
