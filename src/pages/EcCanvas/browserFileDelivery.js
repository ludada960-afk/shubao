import JSZip from 'jszip';

export function safeDeliveryName(value, format = 'PNG') {
  const base = String(value || '电商图片').trim().replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '-').replace(/[. ]+$/g, '') || '电商图片';
  return `${base}.${String(format || 'PNG').toLowerCase()}`;
}
export function deliveryStrategy({ mode = 'images', fileCount = 1, capabilities = {} } = {}) {
  if (mode === 'long-detail') return capabilities.saveFilePicker ? 'save-file' : 'single-download';
  if (capabilities.directoryPicker) return 'directory';
  return fileCount > 1 ? 'zip' : 'single-download';
}

function capabilities(windowObject) {
  return {
    directoryPicker: typeof windowObject?.showDirectoryPicker === 'function',
    saveFilePicker: typeof windowObject?.showSaveFilePicker === 'function',
  };
}

async function responseBlob(url, fetchImpl, proxyUrl) {
  const response = await fetchImpl(proxyUrl(url));
  if (!response.ok) throw new Error(`图片读取失败（${response.status}）`);
  return response.blob();
}

function triggerDownload({ href, filename, documentObject, revoke = false, urlObject = URL }) {
  const link = documentObject.createElement('a');
  link.href = href;
  link.download = filename;
  link.style.display = 'none';
  documentObject.body?.appendChild?.(link);
  link.click();
  link.remove?.();
  if (revoke) urlObject.revokeObjectURL(href);
}

function cancelled(error) {
  return error?.name === 'AbortError';
}

export async function saveIndividualImages(nodes, {
  format = 'PNG',
  productName = '商品',
  windowObject = globalThis,
  documentObject = globalThis.document,
  fetchImpl = globalThis.fetch,
  proxyUrl = value => value,
  urlObject = globalThis.URL,
} = {}) {
  const strategy = deliveryStrategy({ mode: 'images', fileCount: nodes.length, capabilities: capabilities(windowObject) });
  try {
    if (strategy === 'directory') {
      const directory = await windowObject.showDirectoryPicker({ mode: 'readwrite' });
      for (const node of nodes) {
        const handle = await directory.getFileHandle(safeDeliveryName(node.name || node.id, format), { create: true });
        const writable = await handle.createWritable();
        await writable.write(await responseBlob(node.url, fetchImpl, proxyUrl));
        await writable.close();
      }
      return { strategy, count: nodes.length };
    }
    if (strategy === 'zip') {
      const zip = new JSZip();
      for (const node of nodes) zip.file(safeDeliveryName(node.name || node.id, format), await responseBlob(node.url, fetchImpl, proxyUrl));
      const blob = await zip.generateAsync({ type: 'blob' });
      const href = urlObject.createObjectURL(blob);
      triggerDownload({ href, filename: `${productName}-电商图片.zip`, documentObject, revoke: true, urlObject });
      return { strategy, count: nodes.length };
    }
    triggerDownload({ href: proxyUrl(nodes[0].url), filename: safeDeliveryName(nodes[0].name || nodes[0].id, format), documentObject });
    return { strategy, count: 1 };
  } catch (error) {
    if (cancelled(error)) return { strategy, count: 0, cancelled: true };
    throw error;
  }
}

export async function saveLongDetailImage({ url, name = '商品-详情长图', format = 'PNG' }, {
  windowObject = globalThis,
  documentObject = globalThis.document,
  fetchImpl = globalThis.fetch,
  proxyUrl = value => value,
  urlObject = globalThis.URL,
} = {}) {
  const strategy = deliveryStrategy({ mode: 'long-detail', fileCount: 1, capabilities: capabilities(windowObject) });
  const filename = safeDeliveryName(name, format);
  try {
    if (strategy === 'save-file') {
      const handle = await windowObject.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: `${format} 图片`, accept: { [`image/${String(format).toLowerCase() === 'jpg' ? 'jpeg' : 'png'}`]: [`.${String(format).toLowerCase()}`] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(await responseBlob(url, fetchImpl, proxyUrl));
      await writable.close();
      return { strategy, count: 1 };
    }
    triggerDownload({ href: proxyUrl(url), filename, documentObject, urlObject });
    return { strategy, count: 1 };
  } catch (error) {
    if (cancelled(error)) return { strategy, count: 0, cancelled: true };
    throw error;
  }
}
