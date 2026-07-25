import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeSseJson } from '../src/services/sse.js';

function readerFrom(chunks) {
  let index = 0;
  return {
    async read() {
      if (index >= chunks.length) return { done: true, value: undefined };
      return { done: false, value: new TextEncoder().encode(chunks[index++]) };
    },
  };
}

test('parses split SSE frames and keeps event payloads intact', async () => {
  const events = [];
  await consumeSseJson(readerFrom([
    'data: {"type":"progress","current":1}\n\n',
    'data: {"type":"compl',
    'ete","images":{"main":"/api/generated-assets/a.png"}}\n\n',
  ]), event => events.push(event));
  assert.deepEqual(events, [
    { type: 'progress', current: 1 },
    { type: 'complete', images: { main: '/api/generated-assets/a.png' } },
  ]);
});

test('rejects malformed JSON only for malformed SSE data lines', async () => {
  const events = [];
  await assert.rejects(
    consumeSseJson(readerFrom(['data: {broken}\n\n']), event => events.push(event)),
    /SSE 数据格式错误/
  );
  assert.equal(events.length, 0);
});
