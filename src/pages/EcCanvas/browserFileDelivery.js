import JSZip from 'jszip';

export function safeDeliveryName(value, format = 'PNG') {
  const base = String(value || '电商图片')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '-')
    .replace(/[. ]+$/g, '') || '电商图片';
  return `${base}.${String(format || 'PNG').toLowerCase()}`;
}
export function deliveryStrategy({ mode = 'images', fileCount = 1, capabilities = {} } = {}) {
  if (mode === 'long-detail' || mode === 'single') {
    return capabilities.saveFilePicker ? 'save-file' : 'single-download';
  }
  if (capabilities.directoryPicker) return 'directory';
  return fileCount > 1 ? 'zip' : 'single-download';
}

function browserCapabilities(windowObject) {
  return {
    directoryPicker: typeof windowObject?.showDirectoryPicker === 'function',
    saveFilePicker: typeof windowObject?.showSaveFilePicker === 'function',
  };
}

function isCancelled(error) {
  return error?.name === 'AbortError';
}

function formatMime(format) {
  return String(format || 'PNG').toUpperCase() === 'JPG' ? 'image/jpeg' : 'image/png';
}

function uniqueFilenames(items, defaultFormat) {
  const counts = new Map();
  return items.map((item, index) => {
    const original = safeDeliveryName(item.name || item.id || `图片-${index + 1}`, item.format || defaultFormat);
    const count = counts.get(original) || 0;
    counts.set(original, count + 1);
    if (!count) return original;
    const dot = original.lastIndexOf('.');
    return `${original.slice(0, dot)}-${count + 1}${original.slice(dot)}`;
  });
}

function defaultDownloadBlob(blob, filename, {
  documentObject = globalThis.document,
  urlObject = globalThis.URL,
  schedule = globalThis.setTimeout,
} = {}) {
  if (!blob || !blob.size) throw new Error('下载内容为空');
  const href = urlObject.createObjectURL(blob);
  const link = documentObject.createElement('a');
  link.href = href;
  link.download = filename;
  link.style.display = 'none';
  documentObject.body?.appendChild?.(link);
  link.click();
  link.remove?.();
  schedule?.(() => urlObject.revokeObjectURL(href), 0);
}

export async function chooseDeliveryDestination(request = {}, {
  windowObject = globalThis,
} = {}) {
  const mode = request.mode || 'images';
  const fileCount = Math.max(1, Number(request.fileCount) || 1);
  const format = String(request.format || 'PNG').toUpperCase();
  const filename = request.filename || (mode === 'long-detail'
    ? safeDeliveryName(`${request.productName || '商品'}-详情长图`, format)
    : safeDeliveryName(request.productName || '商品', format));
  const strategy = deliveryStrategy({ mode, fileCount, capabilities: browserCapabilities(windowObject) });

  try {
    if (strategy === 'directory') {
      const handle = await windowObject.showDirectoryPicker({ mode: 'readwrite' });
      return { strategy, handle, name: handle.name || '所选文件夹' };
    }
    if (strategy === 'save-file') {
      const mime = formatMime(format);
      const extension = format === 'JPG' ? '.jpg' : '.png';
      const handle = await windowObject.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: `${format} 图片`, accept: { [mime]: [extension] } }],
      });
      return { strategy, handle, name: handle.name || filename, filename };
    }
    if (strategy === 'zip') {
      const fallbackName = `${request.productName || '商品'}-电商图片.zip`;
      return { strategy, name: fallbackName, filename: fallbackName, fallback: true };
    }
    return { strategy, name: filename, filename, fallback: true };
  } catch (error) {
    if (isCancelled(error)) return { strategy, cancelled: true };
    throw error;
  }
}

export async function prepareImageDeliverables(items, {
  format = 'PNG',
  fetchImpl = globalThis.fetch,
  proxyUrl = value => value,
  onProgress = () => {},
} = {}) {
  if (!Array.isArray(items) || !items.length) throw new Error('没有可导出的图片');
  const filenames = uniqueFilenames(items, format);
  const prepared = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item?.url) throw new Error(`第 ${index + 1} 张图片缺少有效地址`);
    const response = await fetchImpl(proxyUrl(item.url));
    if (!response?.ok) throw new Error(`图片读取失败（${response?.status || '网络错误'}）`);
    const headerType = String(response.headers?.get?.('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!headerType.startsWith('image/')) throw new Error(`第 ${index + 1} 个文件不是有效图片`);
    const blob = await response.blob();
    const blobType = String(blob?.type || headerType).split(';')[0].trim().toLowerCase();
    if (!blobType.startsWith('image/')) throw new Error(`第 ${index + 1} 个文件不是有效图片`);
    if (!Number(blob?.size)) throw new Error(`第 ${index + 1} 张图片内容为空`);
    prepared.push({
      id: item.id,
      filename: filenames[index],
      blob,
      contentType: blobType,
      size: blob.size,
    });
    onProgress({ completed: index + 1, total: items.length, phase: 'preparing' });
  }

  return prepared;
}

function validatePrepared(prepared) {
  if (!Array.isArray(prepared) || !prepared.length) throw new Error('没有已准备好的图片');
  for (const [index, item] of prepared.entries()) {
    if (!item?.filename || !item?.blob || !Number(item.blob.size || item.size)) {
      throw new Error(`第 ${index + 1} 张图片尚未准备完成`);
    }
    const type = String(item.contentType || item.blob.type || '').toLowerCase();
    if (!type.startsWith('image/')) throw new Error(`第 ${index + 1} 个文件不是有效图片`);
  }
}

async function writeToHandle(handle, blob) {
  let writable;
  try {
    writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
  } catch (error) {
    if (writable?.abort) {
      try {
        await writable.abort(error);
      } catch {
        // Preserve the original write error.
      }
    }
    throw error;
  }
}

export async function writePreparedDeliverables(destination, prepared, {
  zipFactory = () => new JSZip(),
  downloadBlob = null,
  documentObject = globalThis.document,
  urlObject = globalThis.URL,
  schedule = globalThis.setTimeout,
  onProgress = () => {},
} = {}) {
  validatePrepared(prepared);
  if (!destination?.strategy) throw new Error('请先选择保存位置');
  const deliverBlob = downloadBlob || ((blob, filename) => defaultDownloadBlob(blob, filename, { documentObject, urlObject, schedule }));

  if (destination.strategy === 'directory') {
    for (let index = 0; index < prepared.length; index += 1) {
      const item = prepared[index];
      const handle = await destination.handle.getFileHandle(item.filename, { create: true });
      await writeToHandle(handle, item.blob);
      onProgress({ completed: index + 1, total: prepared.length, phase: 'writing' });
    }
  } else if (destination.strategy === 'save-file') {
    if (prepared.length !== 1) throw new Error('单文件保存位置只能写入一张图片');
    await writeToHandle(destination.handle, prepared[0].blob);
    onProgress({ completed: 1, total: 1, phase: 'writing' });
  } else if (destination.strategy === 'zip') {
    const zip = zipFactory();
    for (const item of prepared) zip.file(item.filename, item.blob);
    const blob = await zip.generateAsync({ type: 'blob' });
    if (!Number(blob?.size)) throw new Error('压缩包内容为空');
    deliverBlob(blob, destination.filename || destination.name || '电商图片.zip');
    onProgress({ completed: prepared.length, total: prepared.length, phase: 'writing' });
  } else if (destination.strategy === 'single-download') {
    if (prepared.length !== 1) throw new Error('单文件下载只能包含一张图片');
    deliverBlob(prepared[0].blob, destination.filename || prepared[0].filename);
    onProgress({ completed: 1, total: 1, phase: 'writing' });
  } else {
    throw new Error('不支持的保存方式');
  }

  return { strategy: destination.strategy, count: prepared.length, destinationName: destination.name || '' };
}
