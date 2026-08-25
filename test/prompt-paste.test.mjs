import test from 'node:test';
import assert from 'node:assert/strict';

import { extractPastedMediaFiles } from '../src/components/creation/promptPaste.js';

function fakeFile(name, type, size = 10, lastModified = 1) {
  return { name, type, size, lastModified };
}

test('extracts media files from clipboardData.files and keeps order', () => {
  const image = fakeFile('a.png', 'image/png');
  const video = fakeFile('b.mp4', 'video/mp4');
  const audio = fakeFile('c.wav', 'audio/wav');
  const files = extractPastedMediaFiles({ files: [image, video, audio] });
  assert.deepEqual(files, [image, video, audio]);
});

test('drops non-media payloads such as text or pdf drops', () => {
  const files = extractPastedMediaFiles({
    files: [fakeFile('notes.txt', 'text/plain'), fakeFile('doc.pdf', 'application/pdf')],
  });
  assert.equal(files.length, 0);
});

test('accepts media detected by extension when mime type is empty', () => {
  const screenshot = fakeFile('截图 2026-08-25.PNG', '');
  assert.deepEqual(extractPastedMediaFiles({ files: [screenshot] }), [screenshot]);
});

test('falls back to clipboard items for screenshot tools that skip files', () => {
  const image = fakeFile('clipboard-image.png', 'image/png', 7, 7);
  const dataTransfer = {
    items: [
      { kind: 'string', type: 'text/plain' },
      { kind: 'file', getAsFile: () => image },
      { kind: 'file', getAsFile: () => null },
    ],
  };
  assert.deepEqual(extractPastedMediaFiles(dataTransfer), [image]);
});

test('deduplicates items fallback against repeated clipboard entries', () => {
  const image = fakeFile('clip.png', 'image/png', 3, 3);
  const dataTransfer = {
    items: [
      { kind: 'file', getAsFile: () => image },
      { kind: 'file', getAsFile: () => fakeFile('clip.png', 'image/png', 3, 3) },
    ],
  };
  assert.equal(extractPastedMediaFiles(dataTransfer).length, 1);
});

test('returns empty arrays for missing or empty data transfers', () => {
  assert.deepEqual(extractPastedMediaFiles(null), []);
  assert.deepEqual(extractPastedMediaFiles({}), []);
});
