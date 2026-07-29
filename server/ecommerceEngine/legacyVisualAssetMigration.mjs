import { createHash } from 'node:crypto';

const SAFE_JOB_ID_RE = /^[a-z0-9][a-z0-9_.:-]{0,127}$/i;
const TRUSTED_SOURCE_RE = /^\/api\/(?:ec-temp-img\/[a-z0-9][a-z0-9_.-]*|generated-assets\/[a-f0-9]{64}\.(?:jpg|png|webp))$/i;
const GENERATED_SOURCE_RE = /^\/api\/generated-assets\/([a-f0-9]{64}\.(?:jpg|png|webp))$/i;
const CONTENT_TYPE_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function invalidInput(cause) {
  return Object.assign(new Error('历史图片无法读取，请重新上传'), {
    code: 'VISUAL_ANALYSIS_INVALID_INPUT',
    status: 400,
    retryable: false,
    ...(cause ? { cause } : {}),
  });
}

function unavailable(cause) {
  return Object.assign(new Error('图片分析服务暂时不可用'), {
    code: 'VISUAL_ANALYSIS_UNAVAILABLE',
    status: 503,
    retryable: true,
    ...(cause ? { cause } : {}),
  });
}

export function createLegacyVisualAssetMigration({
  imageInputReader,
  generatedAssetStore,
  getJob,
  getOwnedAsset,
} = {}) {
  if (!imageInputReader || typeof imageInputReader.read !== 'function') {
    throw new TypeError('imageInputReader.read is required');
  }
  if (!generatedAssetStore || typeof generatedAssetStore.persistBuffer !== 'function') {
    throw new TypeError('generatedAssetStore.persistBuffer is required');
  }
  if (typeof getJob !== 'function') throw new TypeError('getJob is required');
  if (typeof getOwnedAsset !== 'function') throw new TypeError('getOwnedAsset is required');

  return async function migrateLegacyVisualAsset({ source, type, index, jobId: jobIdInput } = {}) {
    const normalizedSource = cleanString(source);
    const jobId = cleanString(jobIdInput);
    if (!TRUSTED_SOURCE_RE.test(normalizedSource)
      || !SAFE_JOB_ID_RE.test(jobId)
      || !['product', 'reference'].includes(type)
      || !Number.isSafeInteger(index)
      || index < 0) {
      throw invalidInput();
    }

    let job;
    try {
      job = await getJob(jobId);
    } catch (error) {
      throw unavailable(error);
    }
    const ownerEmail = cleanString(job?.ownerEmail).toLowerCase();
    const alias = type === 'product' ? 'real_shots' : 'reference_images';
    const frozenGroup = job?.payload?.[alias];
    const frozenSource = Array.isArray(frozenGroup) ? cleanString(frozenGroup[index]) : '';
    if (job?.id !== jobId
      || job?.visualInputSchemaVersion !== null
      || !ownerEmail.includes('@')
      || frozenSource !== normalizedSource) {
      throw invalidInput();
    }

    let readSource = normalizedSource;
    const generatedMatch = GENERATED_SOURCE_RE.exec(normalizedSource);
    if (generatedMatch) {
      try {
        const owned = await getOwnedAsset({ ownerEmail, assetId: generatedMatch[1] });
        if (cleanString(owned?.assetId) !== generatedMatch[1]
          || cleanString(owned?.url) !== normalizedSource) {
          throw invalidInput();
        }
        readSource = owned.url;
      } catch (error) {
        if (error?.code === 'VISUAL_ANALYSIS_INVALID_INPUT') throw error;
        if (Number.isInteger(error?.status) && error.status >= 400 && error.status < 500) {
          throw invalidInput(error);
        }
        throw unavailable(error);
      }
    }

    let image;
    try {
      image = await imageInputReader.read(readSource);
    } catch (error) {
      throw invalidInput(error);
    }
    const buffer = image?.buffer;
    const contentType = cleanString(image?.contentType).toLowerCase();
    const extension = CONTENT_TYPE_EXTENSIONS[contentType];
    if (!Buffer.isBuffer(buffer) || buffer.length === 0 || !extension) throw invalidInput();

    const digest = createHash('sha256').update(buffer).digest('hex');
    const expectedId = `${digest}.${extension}`;
    let asset;
    try {
      asset = await generatedAssetStore.persistBuffer({
        buffer,
        contentType,
        taskId: jobId,
        label: `legacy-${type}-${index + 1}`,
      });
    } catch (error) {
      throw unavailable(error);
    }
    if (cleanString(asset?.id) !== expectedId
      || cleanString(asset?.url) !== `/api/generated-assets/${expectedId}`) {
      throw unavailable();
    }
    return { assetId: expectedId, url: asset.url };
  };
}
