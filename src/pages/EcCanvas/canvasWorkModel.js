import { inferWorkType, mergeWorkCollections } from '../../utils/workRecords.js';
import { normalizeWorkImages } from '../../utils/workImages.js';
import { attachCanvasProjectAssetRef, buildCanvasAssetRef, collectCanvasProjectAssetRefs } from './canvasAssetReferenceModel.js';

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizedOwner(value) {
  return cleanString(value).toLowerCase();
}

function displayName(work = {}) {
  return cleanString(work.product_name || work.name || work.title) || '历史作品';
}

function allWorkImages(work = {}) {
  const candidates = [
    ...normalizeWorkImages(work.images),
    ...normalizeWorkImages(work.cover_url ? [work.cover_url] : []),
    ...normalizeWorkImages(work.image_urls),
    ...normalizeWorkImages((Array.isArray(work.pages) ? work.pages : []).map(page => page?.image_url || page?.url || page)),
  ];
  const seen = new Set();
  return candidates.filter(image => {
    if (!image?.url || seen.has(image.url)) return false;
    seen.add(image.url);
    return true;
  });
}

function mediaAssetCandidates(work = {}, nodes = []) {
  return [
    ...(Array.isArray(work.mediaAssets) ? work.mediaAssets : []),
    ...(Array.isArray(work.projectAssetRefs) ? work.projectAssetRefs : []),
    ...(Array.isArray(nodes) ? nodes : []),
  ];
}

function canonicalImageInputs(work = {}, projectAssetRefs = []) {
  const existing = normalizeWorkImages(work.productAssets || work.product_assets || work.productImages || work.source_images || work.sourceImages);
  if (existing.length) return existing;
  if (allWorkImages(work).length) return [];
  return projectAssetRefs
    .filter(ref => ref?.mediaKind === 'image')
    .map(ref => ({
      ...ref,
      url: ref.stableUrl,
      stableUrl: ref.stableUrl,
      projectAssetId: ref.projectAssetId,
    }));
}

export function collectCanvasMediaAssets(work = {}, nodes = []) {
  const seen = new Set();
  return mediaAssetCandidates(work, nodes).map(candidate => {
    const ref = buildCanvasAssetRef(candidate);
    if (!ref || !['video', 'audio'].includes(ref.mediaKind)) return null;
    const key = `${ref.projectId}:${ref.projectAssetId}:${ref.contentHash}`;
    if (seen.has(key)) return null;
    seen.add(key);
    const playbackUrl = cleanString(candidate?.playbackUrl || candidate?.url || candidate?.src);
    const name = cleanString(candidate?.name || candidate?.displayName || candidate?.label || candidate?.metadata?.displayName);
    return {
      ...ref,
      url: playbackUrl || ref.stableUrl,
      ...(playbackUrl ? { playbackUrl } : {}),
      ...(name ? { name, displayName: name } : {}),
      ...(Number.isFinite(Number(candidate?.duration)) && Number(candidate.duration) > 0
        ? { duration: Number(candidate.duration) }
        : {}),
    };
  }).filter(Boolean);
}

export function durableCanvasMediaAssets(work = {}, nodes = []) {
  return collectCanvasMediaAssets(work, nodes).map(asset => {
    const { playbackUrl, ...durable } = asset;
    return { ...durable, url: durable.stableUrl };
  });
}

function workVideoUrl(work = {}) {
  return cleanString(work.video_url || work.videoUrl || work.video?.url || work._videoResult?.url)
    || cleanString(collectCanvasMediaAssets(work).find(asset => asset.mediaKind === 'video')?.url);
}

function projectVideoAssetRef(work = {}) {
  const candidates = [
    work.projectAssetRef,
    work.video?.projectAssetRef,
    ...(Array.isArray(work.projectAssetRefs) ? work.projectAssetRefs : []),
  ];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object' || !cleanString(candidate.stableUrl || candidate.stable_url)
      || !cleanString(candidate.contentHash || candidate.content_hash)
      || !cleanString(candidate.mimeType || candidate.mime_type)) continue;
    const ref = buildCanvasAssetRef(candidate);
    if (ref?.mediaKind === 'video') return ref;
  }
  return null;
}

export function canvasVideoAsset(work = {}) {
  const url = workVideoUrl(work);
  if (!url) return null;
  const ref = projectVideoAssetRef(work);
  const assetId = cleanString(ref?.assetId || work.videoAssetId || work.assetId || work.id || work.taskId);
  return {
    ...(ref || {}),
    id: assetId,
    assetId,
    url,
    ...(ref ? { playbackUrl: url } : {}),
    name: cleanString(work.product_name || work.title || work.name || work.prompt) || '视频作品',
  };
}

export function canvasVideoResultPatch(job = {}) {
  const video = {
    ...job,
    videoUrl: job.resultUrl || job.videoUrl,
    videoAssetId: job.resultAssetId || job.videoAssetId,
    name: job.name || job.product_name || job.prompt,
  };
  const asset = canvasVideoAsset(video);
  if (!asset) return null;
  const ref = projectVideoAssetRef(video);
  return {
    url: asset.url,
    videoAssetId: asset.assetId,
    ...(ref ? { projectAssetRef: ref } : {}),
  };
}

export function canvasWorkCategory(work = {}) {
  return collectCanvasMediaAssets(work).length ? 'video' : inferWorkType(work);
}

export function filterCanvasWorks(works = [], category = 'all') {
  const list = Array.isArray(works) ? works : [];
  return category === 'all' ? list : list.filter(work => canvasWorkCategory(work) === category);
}

function normalizePanelWork(work = {}) {
  const images = allWorkImages(work);
  const workType = canvasWorkCategory(work);
  const videoUrl = workVideoUrl(work);
  const mediaAssets = collectCanvasMediaAssets(work);
  const projectAssetRefs = collectCanvasProjectAssetRefs({ work });
  if (!images.length && !videoUrl && !mediaAssets.length && !projectAssetRefs.length) return null;
  return {
    ...work,
    id: work.id || work.taskId || work._saveKey || images[0]?.url || videoUrl || Date.now(),
    name: displayName(work),
    product_name: cleanString(work.product_name) || displayName(work),
    platform: cleanString(work.platform) || '淘宝',
    images,
    videoUrl,
    video: work.video || (videoUrl ? { url: videoUrl } : null),
    projectAssetRefs,
    productAssets: canonicalImageInputs(work, projectAssetRefs),
    mediaAssets,
    createdAt: work.createdAt || work.at || '',
    workType,
  };
}

export function normalizeCanvasWorkPanel({ localWorks = [], serverWorks = [], ownerEmail = '' } = {}) {
  const owner = normalizedOwner(ownerEmail);
  const ownedLocalWorks = owner
    ? (Array.isArray(localWorks) ? localWorks : []).filter(work => normalizedOwner(work?._phone) === owner)
    : [];
  return mergeWorkCollections(serverWorks, ownedLocalWorks)
    .map(normalizePanelWork)
    .filter(Boolean);
}

export function buildCanvasImportResult(work = {}, { importId } = {}) {
  const imageRecords = allWorkImages(work);
  const mediaAssets = collectCanvasMediaAssets(work);
  const videoUrl = workVideoUrl(work);
  const projectAssetRefs = collectCanvasProjectAssetRefs({ work });
  const images = Object.fromEntries(imageRecords.map((image, index) => [
    image.key || image.label || `image_${index + 1}`,
    image.url,
  ]));
  const result = {
    ...work,
    images,
    imageRecords,
    videoUrl,
    video_url: videoUrl,
    video: work.video || (videoUrl ? { url: videoUrl } : null),
    mediaAssets,
    productAssets: canonicalImageInputs(work, projectAssetRefs),
    product_name: displayName(work),
    _ecResult: true,
    workType: canvasWorkCategory(work),
    platform: cleanString(work.platform) || '淘宝',
    _saveKey: work._saveKey || '',
    canvasImportId: importId || globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
  };
  result.projectAssetRefs = collectCanvasProjectAssetRefs({ work: result });
  return result;
}

export function canvasOutputImages(result = {}) {
  const imageRecords = normalizeWorkImages(result.imageRecords);
  return imageRecords.length ? imageRecords : normalizeWorkImages(result.images);
}

export function collectCanvasWorkImages({ baseImages = [], nodes = [] } = {}) {
  const images = normalizeWorkImages(baseImages);
  const seen = new Set(images.map(image => image.url));
  const outputKinds = new Set(['output', 'image-composer']);
  for (const node of Array.isArray(nodes) ? nodes : []) {
    const url = cleanString(node?.url);
    const complete = node?.status === 'ready' || node?.status === 'success';
    if (!url || !complete || !outputKinds.has(node?.kind) || seen.has(url)) continue;
    seen.add(url);
    images.push(attachCanvasProjectAssetRef({
      key: cleanString(node.assetId || node.id) || `canvas_${images.length + 1}`,
      label: cleanString(node.displayLabel || node.name) || '画布创作',
      displayName: cleanString(node.displayLabel || node.name) || '画布创作',
      url,
      role: cleanString(node.role),
      group: cleanString(node.group) || '画布创作',
      ratio: cleanString(node.ratio),
      size: cleanString(node.size),
      source: 'canvas',
    }, node));
  }
  return images;
}

export function canvasWorkOutputFingerprint(nodes = []) {
  const outputKinds = new Set(['output', 'image-composer']);
  return (Array.isArray(nodes) ? nodes : [])
    .filter(node => outputKinds.has(node?.kind) && ['ready', 'success'].includes(node?.status))
    .map(node => cleanString(node?.url))
    .filter(Boolean)
    .sort()
    .join('\n');
}
