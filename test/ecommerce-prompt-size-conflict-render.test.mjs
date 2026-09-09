import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import PromptSizeConflictNotice from '../src/pages/Home/ec/PromptSizeConflictNotice.js';
import { detectSizingConflict } from '../src/pages/Home/ec/promptSizeConflict.js';

const panel = [
  { key: 'main_text', count: 5, ratio: '1:1' },
  { key: 'detail', count: 9, ratio: '9:16' },
];

test('notice renders the mentioned ratio, the panel ratios and both actions', () => {
  const { conflicts } = detectSizingConflict({ promptText: '做成 16:9 横版主图', images: panel });
  const html = renderToStaticMarkup(React.createElement(PromptSizeConflictNotice, {
    conflict: conflicts[0],
    onApply: () => {},
    onDismiss: () => {},
  }));
  assert.match(html, /提示词里提到「16:9 横版」/);
  assert.match(html, /当前套图配置是 1:1 \/ 9:16/);
  assert.match(html, /把主图改为 16:9/);
  assert.match(html, /忽略/);
  assert.match(html, /详情保持不变/);
});

test('notice renders nothing without a conflict', () => {
  const html = renderToStaticMarkup(React.createElement(PromptSizeConflictNotice, { conflict: null }));
  assert.equal(html, '');
});

test('notice omits the apply action when no main-scoped image can take the ratio', () => {
  const detailOnly = [{ key: 'detail', count: 4, ratio: '9:16' }];
  const { conflicts } = detectSizingConflict({ promptText: '要 1:1 方形', images: detailOnly });
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].canApply, false);
  const html = renderToStaticMarkup(React.createElement(PromptSizeConflictNotice, { conflict: conflicts[0] }));
  assert.doesNotMatch(html, /把主图改为/);
  assert.match(html, /忽略/);
});
