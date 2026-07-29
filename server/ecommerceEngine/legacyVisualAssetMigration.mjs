import { createHash } from 'node:crypto';

const SAFE_JOB_ID_RE = /^[a-z0-9][a-z0-9_.:-]{0,127}$/i;
const TRUSTED_SOURCE_RE = /^\/api\/(?:ec-temp-img\/[a-z0-9][a-z0-9_.-]*|generated-assets\/[a-f0-9]{64}\.(?:jpg|png|webp))$/i;
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

export function createLegacyVisualAssetMigration({ imageInputReader, generatedAssetStore } = {}) {
  if (!imageInputReader || typeof imageInputReader.read !== 'function') {
    throw new TypeError('imageInputReader.read is required');
  }
  if (!generatedAssetStore || typeof generatedAssetStore.persistBuffer !== 'function') {
    throw new TypeError('generatedAssetStore.persistBuffer is required');
  }

  return async function migrateLegacyVisualAsset({ source, type, index, job } = {}) {
    const normalizedSource = cleanString(source);
    const jobId = cleanString(job?.id);
    const ownerEmail = cleanString(job?.ownerEmail).toLowerCase();
    if (!TRUSTED_SOURCE_RE.test(normalizedSource)
      || !SAFE_JOB_ID_RE.test(jobId)
      || !ownerEmail.includes('@')
      || !['product', 'reference'].includes(type)
      || !Number.isSafeInteger(index)
      || index < 0) {
      throw invalidInput();
    }

    try {
      const image = await imageInputReader.read(normalizedSource);
      const buffer = image?.buffer;
      const contentType = cleanString(image?.contentType).toLowerCase();
      const extension = CONTENT_TYPE_EXTENSIONS[contentType];
      if (!Buffer.isBuffer(buffer) || buffer.length === 0 || !extension) throw invalidInput();

      const digest = createHash('sha256').update(buffer).digest('hex');
      const expectedId = `${digest}.${extension}`;
      const asset = await generatedAssetStore.persistBuffer({
        buffer,
        contentType,
        taskId: jobId,
        label: `legacy-${type}-${index + 1}`,
      });
      if (cleanString(asset?.id) !== expectedId
        || cleanString(asset?.url) !== `/api/generated-assets/${expectedId}`) {
        throw invalidInput();
      }
      return { assetId: expectedId, url: asset.url };
    } catch (error) {
      if (error?.code === 'VISUAL_ANALYSIS_INVALID_INPUT') throw error;
      throw invalidInput(error);
    }
  };
}
