import assert from 'node:assert/strict';
import test from 'node:test';

import {
  chooseDeliveryDestination,
  prepareImageDeliverables,
  writePreparedDeliverables,
} from '../src/pages/EcCanvas/browserFileDelivery.js';

function imageResponse(body = 'pixels', type = 'image/png', status = 200) {
  const blob = new Blob([body], { type });
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: name => name.toLowerCase() === 'content-type' ? type : null },
    blob: async () => blob,
  };
}

test('destination selection never opens a writable stream', async () => {
  let writableCalls = 0;
  const directory = {
    name: '交付目录',
    getFileHandle: async () => {
      writableCalls += 1;
      throw new Error('must not write while choosing');
    },
  };

  const destination = await chooseDeliveryDestination(
    { mode: 'images', fileCount: 2, productName: '水杯', format: 'PNG' },
    { windowObject: { showDirectoryPicker: async () => directory } },
  );

  assert.equal(destination.strategy, 'directory');
  assert.equal(destination.name, '交付目录');
  assert.equal(destination.handle, directory);
  assert.equal(writableCalls, 0);
});
test('picker cancellation is returned without converting it into an export error', async () => {
  const error = new Error('cancelled');
  error.name = 'AbortError';
  const destination = await chooseDeliveryDestination(
    { mode: 'single', fileCount: 1, filename: '主图.png', format: 'PNG' },
    { windowObject: { showSaveFilePicker: async () => { throw error; } } },
  );
  assert.equal(destination.cancelled, true);
});

test('preparation validates status image MIME and non-zero bytes', async t => {
  await t.test('rejects an unsuccessful response', async () => {
    await assert.rejects(
      prepareImageDeliverables([{ url: '/missing', name: '主图' }], { fetchImpl: async () => imageResponse('', 'image/png', 404) }),
      /图片读取失败.*404/,
    );
  });

  await t.test('rejects non-image payloads', async () => {
    await assert.rejects(
      prepareImageDeliverables([{ url: '/html', name: '主图' }], { fetchImpl: async () => imageResponse('<html>', 'text/html') }),
      /不是有效图片/,
    );
  });

  await t.test('rejects zero-byte images', async () => {
    await assert.rejects(
      prepareImageDeliverables([{ url: '/empty', name: '主图' }], { fetchImpl: async () => imageResponse('', 'image/png') }),
      /图片内容为空/,
    );
  });
});

test('all suite images are prepared before the first file is created', async () => {
  const events = [];
  const prepared = await prepareImageDeliverables([
    { url: '/one', name: '主图' },
    { url: '/two', name: '详情图' },
  ], {
    fetchImpl: async url => {
      events.push(`fetch:${url}`);
      return imageResponse(url);
    },
  });

  const destination = {
    strategy: 'directory',
    name: '交付目录',
    handle: {
      getFileHandle: async filename => {
        events.push(`file:${filename}`);
        return {
          createWritable: async () => ({
            write: async () => events.push(`write:${filename}`),
            close: async () => events.push(`close:${filename}`),
          }),
        };
      },
    },
  };
  const result = await writePreparedDeliverables(destination, prepared);

  assert.equal(result.count, 2);
  assert.deepEqual(events.slice(0, 2), ['fetch:/one', 'fetch:/two']);
  assert.equal(events.findIndex(event => event.startsWith('file:')) > 1, true);
});

test('an open writable stream is aborted when writing fails', async () => {
  const events = [];
  const prepared = [{ filename: '主图.png', blob: new Blob(['pixels'], { type: 'image/png' }), size: 6, contentType: 'image/png' }];
  const destination = {
    strategy: 'save-file',
    name: '主图.png',
    handle: {
      createWritable: async () => ({
        write: async () => { events.push('write'); throw new Error('disk full'); },
        abort: async () => events.push('abort'),
        close: async () => events.push('close'),
      }),
    },
  };

  await assert.rejects(writePreparedDeliverables(destination, prepared), /disk full/);
  assert.deepEqual(events, ['write', 'abort']);
});

test('fallback delivery writes validated blobs through ZIP or a single object URL', async t => {
  const prepared = [
    { filename: '主图.png', blob: new Blob(['one'], { type: 'image/png' }), size: 3, contentType: 'image/png' },
    { filename: '详情图.png', blob: new Blob(['two'], { type: 'image/png' }), size: 3, contentType: 'image/png' },
  ];

  await t.test('ZIP fallback contains image files only', async () => {
    const files = [];
    const downloads = [];
    const destination = { strategy: 'zip', name: '水杯-电商图片.zip', filename: '水杯-电商图片.zip' };
    const result = await writePreparedDeliverables(destination, prepared, {
      zipFactory: () => ({
        file: (name, blob) => files.push([name, blob]),
        generateAsync: async () => new Blob(['zip-bytes'], { type: 'application/zip' }),
      }),
      downloadBlob: (blob, filename) => downloads.push([blob, filename]),
    });
    assert.deepEqual(files.map(([name]) => name), ['主图.png', '详情图.png']);
    assert.equal(downloads[0][1], '水杯-电商图片.zip');
    assert.equal(result.count, 2);
  });

  await t.test('single fallback downloads the prepared blob instead of its remote URL', async () => {
    const downloads = [];
    const destination = { strategy: 'single-download', name: '主图.png', filename: '主图.png' };
    await writePreparedDeliverables(destination, prepared.slice(0, 1), {
      downloadBlob: (blob, filename) => downloads.push([blob, filename]),
    });
    assert.equal(downloads[0][0], prepared[0].blob);
    assert.equal(downloads[0][1], '主图.png');
  });
});
