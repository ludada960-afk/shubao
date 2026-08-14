import crypto from 'node:crypto';

import sharp from 'sharp';

const DEFAULT_MAX_ORIGINAL_BYTES = 15 * 1024 * 1024;
const DEFAULT_MAX_INPUT_PIXELS = 40_000_000;
const DEFAULT_MAX_DIMENSION = 12_000;
const DEFAULT_PREVIEW_SIZE = 512;
const ASSET_ID_RE = /^[a-f0-9]{64}\.(?:jpg|png|webp)$/;
const REQUEST_FIELDS = new Set(['data', 'role', 'declaredMimeType']);
const ROLES = new Set(['product', 'reference', 'style', 'proof', 'person', 'scene']);
const FORMAT_DETAILS = Object.freeze({
  jpeg: { extension: 'jpg', mimeType: 'image/jpeg' },
  png: { extension: 'png', mimeType: 'image/png' },
  webp: { extension: 'png', mimeType: 'image/png', normalize: true },
  heif: { extension: 'png', mimeType: 'image/png', normalize: true },
});

function httpError(message, status, code) {
  return Object.assign(new Error(message), { status, code });
}

function isRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeOwner(ownerEmail) {
  const owner = typeof ownerEmail === 'string' ? ownerEmail.trim().toLowerCase() : '';
  if (!owner || !owner.includes('@')) throw httpError('登录信息无效', 401, 'AUTH_REQUIRED');
  return owner;
}

function validateAssetId(assetId) {
  if (typeof assetId !== 'string' || !ASSET_ID_RE.test(assetId)) {
    throw httpError('素材 ID 无效', 400, 'ASSET_ID_INVALID');
  }
  return assetId;
}

function validateRequestBody(body) {
  if (!isRecord(body)) throw httpError('上传请求无效', 400, 'ASSET_REQUEST_INVALID');
  const keys = Object.keys(body);
  if (keys.some(key => !REQUEST_FIELDS.has(key)) || !Object.hasOwn(body, 'data')) {
    throw httpError('上传请求无效', 400, 'ASSET_REQUEST_INVALID');
  }
  if (Object.hasOwn(body, 'declaredMimeType') && typeof body.declaredMimeType !== 'string') {
    throw httpError('上传请求无效', 400, 'ASSET_REQUEST_INVALID');
  }
  const role = validateRole(Object.hasOwn(body, 'role') ? body.role : 'product');
  return {
    data: body.data,
    role,
  };
}

function validateRole(value) {
  if (typeof value !== 'string' || !ROLES.has(value.trim().toLowerCase())) {
    throw httpError('素材角色无效', 400, 'ASSET_REQUEST_INVALID');
  }
  return value.trim().toLowerCase();
}

function decodedLengthUpperBound(base64) {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function decodeBase64(data, maxBytes) {
  if (typeof data !== 'string' || !data.trim()) {
    throw httpError('图片内容为空', 400, 'ASSET_EMPTY');
  }
  const value = data.trim();
  const match = /^data:([^;,]+);base64,([\s\S]*)$/i.exec(value);
  const encoded = (match ? match[2] : value).replace(/\s/g, '');
  if (!encoded) throw httpError('图片内容为空', 400, 'ASSET_EMPTY');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 === 1) {
    throw httpError('Base64 图片内容无效', 400, 'ASSET_BASE64_INVALID');
  }
  const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=');
  if (decodedLengthUpperBound(padded) > maxBytes) {
    throw httpError('图片文件过大', 413, 'ASSET_FILE_TOO_LARGE');
  }
  const buffer = Buffer.from(padded, 'base64');
  if (!buffer.length) throw httpError('图片内容为空', 400, 'ASSET_EMPTY');
  if (buffer.length > maxBytes) throw httpError('图片文件过大', 413, 'ASSET_FILE_TOO_LARGE');
  const canonical = buffer.toString('base64').replace(/=+$/, '');
  if (canonical !== padded.replace(/=+$/, '')) {
    throw httpError('Base64 图片内容无效', 400, 'ASSET_BASE64_INVALID');
  }
  return buffer;
}

function initializeSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ecommerce_asset_uploads (
      idempotency_key TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      original_asset_id TEXT NOT NULL,
      preview_asset_id TEXT NOT NULL,
      role TEXT NOT NULL,
      response_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ecommerce_asset_uploads_owner
      ON ecommerce_asset_uploads(owner_email, original_asset_id);

    CREATE TABLE IF NOT EXISTS ecommerce_asset_records (
      owner_email TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      upload_key TEXT NOT NULL,
      kind TEXT NOT NULL,
      source_asset_id TEXT NOT NULL DEFAULT '',
      mime_type TEXT NOT NULL,
      format TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      byte_size INTEGER NOT NULL,
      role TEXT NOT NULL,
      stable_url TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (owner_email, asset_id, upload_key)
    );
    CREATE INDEX IF NOT EXISTS idx_ecommerce_asset_records_asset
      ON ecommerce_asset_records(asset_id);
    CREATE INDEX IF NOT EXISTS idx_ecommerce_asset_records_owner
      ON ecommerce_asset_records(owner_email, asset_id);
  `);
}

function parseStoredResponse(value) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function publicRecord(row) {
  if (!row) return null;
  return {
    assetId: row.asset_id,
    url: row.stable_url,
    kind: row.kind,
    ...(row.source_asset_id ? { sourceAssetId: row.source_asset_id } : {}),
    mimeType: row.mime_type,
    format: row.format,
    width: row.width,
    height: row.height,
    byteSize: row.byte_size,
    role: row.role,
  };
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function createEcommerceAssetUploadService({
  db,
  generatedAssetStore,
  sharpImpl = sharp,
  now = Date.now,
  maxOriginalBytes = DEFAULT_MAX_ORIGINAL_BYTES,
  maxInputPixels = DEFAULT_MAX_INPUT_PIXELS,
  maxDimension = DEFAULT_MAX_DIMENSION,
  previewSize = DEFAULT_PREVIEW_SIZE,
} = {}) {
  if (!db || typeof db.exec !== 'function' || typeof db.prepare !== 'function') {
    throw new TypeError('a better-sqlite3 database is required');
  }
  if (!generatedAssetStore || typeof generatedAssetStore.persistBuffer !== 'function'
    || typeof generatedAssetStore.read !== 'function') {
    throw new TypeError('generatedAssetStore persistBuffer and read are required');
  }
  if (typeof sharpImpl !== 'function') throw new TypeError('sharpImpl must be a function');
  for (const [name, value] of Object.entries({
    maxOriginalBytes,
    maxInputPixels,
    maxDimension,
    previewSize,
  })) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new TypeError(`${name} must be a positive safe integer`);
    }
  }
  initializeSchema(db);

  const statements = {
    replay: db.prepare('SELECT response_json FROM ecommerce_asset_uploads WHERE idempotency_key = ?'),
    insertUpload: db.prepare(`
      INSERT INTO ecommerce_asset_uploads (
        idempotency_key, owner_email, original_asset_id, preview_asset_id,
        role, response_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(idempotency_key) DO NOTHING
    `),
    insertRecord: db.prepare(`
      INSERT INTO ecommerce_asset_records (
        owner_email, asset_id, upload_key, kind, source_asset_id,
        mime_type, format, width, height, byte_size, role, stable_url, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(owner_email, asset_id, upload_key) DO NOTHING
    `),
    ownedRecord: db.prepare(`
      SELECT * FROM ecommerce_asset_records
      WHERE owner_email = ? AND asset_id = ?
      ORDER BY CASE kind WHEN 'original' THEN 0 ELSE 1 END, created_at
      LIMIT 1
    `),
    anyRecord: db.prepare('SELECT owner_email FROM ecommerce_asset_records WHERE asset_id = ? LIMIT 1'),
  };

  const persistMetadata = db.transaction(({
    idempotencyKey,
    owner,
    original,
    preview,
    role,
    response,
    timestamp,
  }) => {
    statements.insertUpload.run(
      idempotencyKey,
      owner,
      original.assetId,
      preview.assetId,
      role,
      JSON.stringify(response),
      timestamp,
    );
    for (const asset of [original, preview]) {
      statements.insertRecord.run(
        owner,
        asset.assetId,
        idempotencyKey,
        asset.kind,
        asset.sourceAssetId || '',
        asset.mimeType,
        asset.format,
        asset.width,
        asset.height,
        asset.byteSize,
        asset.role,
        asset.url,
        timestamp,
      );
    }
  });

  async function inspectOriginal(buffer) {
    let metadata;
    try {
      metadata = await sharpImpl(buffer, {
        failOn: 'error',
        limitInputPixels: maxInputPixels,
        unlimited: false,
      }).metadata();
    } catch (error) {
      if (/pixel limit|dimensions|width|height|too large/i.test(error?.message || '')) {
        throw httpError('图片尺寸不安全', 413, 'ASSET_DIMENSIONS_UNSAFE');
      }
      throw httpError('图片内容无法解码', 422, 'ASSET_IMAGE_INVALID');
    }
    const details = FORMAT_DETAILS[metadata.format];
    if (!details) throw httpError('暂不支持这种图片格式，请转换为 JPEG、PNG、WebP 或 AVIF 后重试', 415, 'ASSET_FORMAT_UNSUPPORTED');
    const width = Number(metadata.width);
    const height = Number(metadata.height);
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
      throw httpError('图片尺寸无效', 422, 'ASSET_IMAGE_INVALID');
    }
    if (width > maxDimension || height > maxDimension || width * height > maxInputPixels) {
      throw httpError('图片尺寸不安全', 413, 'ASSET_DIMENSIONS_UNSAFE');
    }
    return {
      format: details.normalize ? 'png' : metadata.format,
      mimeType: details.mimeType,
      width,
      height,
      sourceFormat: metadata.format === 'heif' && metadata.compression === 'av1' ? 'avif' : metadata.format,
      normalize: Boolean(details.normalize),
    };
  }

  async function normalizeOriginal(buffer, metadata) {
    if (!metadata.normalize) return buffer;
    try {
      return await sharpImpl(buffer, {
        failOn: 'error',
        limitInputPixels: maxInputPixels,
        unlimited: false,
      }).rotate().png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
    } catch {
      throw httpError('图片转换失败，请换一张图片后重试', 422, 'ASSET_NORMALIZATION_FAILED');
    }
  }

  async function createPreview(buffer) {
    try {
      const output = await sharpImpl(buffer, {
        failOn: 'error',
        limitInputPixels: maxInputPixels,
        unlimited: false,
      })
        .rotate()
        .resize({
          width: previewSize,
          height: previewSize,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 82, effort: 4 })
        .toBuffer({ resolveWithObject: true });
      return {
        buffer: output.data,
        width: output.info.width,
        height: output.info.height,
      };
    } catch {
      throw httpError('图片内容无法安全解码', 422, 'ASSET_IMAGE_INVALID');
    }
  }

  async function persistUpload({ owner, role, buffer }) {
    if (!Buffer.isBuffer(buffer) || !buffer.length) {
      throw httpError('图片内容为空', 400, 'ASSET_EMPTY');
    }
    if (buffer.length > maxOriginalBytes) {
      throw httpError('图片文件过大', 413, 'ASSET_FILE_TOO_LARGE');
    }
    const metadata = await inspectOriginal(buffer);
    const originalBuffer = await normalizeOriginal(buffer, metadata);
    const idempotencyKey = sha256(Buffer.concat([
      Buffer.from('ecommerce-upload-v1\0'),
      Buffer.from(owner),
      Buffer.from('\0'),
      Buffer.from(role),
      Buffer.from('\0'),
      originalBuffer,
    ]));
    const replay = parseStoredResponse(statements.replay.get(idempotencyKey)?.response_json);
    if (replay) return replay;

    const previewOutput = await createPreview(buffer);
    const originalStored = await generatedAssetStore.persistBuffer({
      buffer: originalBuffer,
      contentType: metadata.mimeType,
      taskId: idempotencyKey,
      label: 'ecommerce-original',
    });
    const previewStored = await generatedAssetStore.persistBuffer({
      buffer: previewOutput.buffer,
      contentType: 'image/webp',
      taskId: idempotencyKey,
      label: 'ecommerce-preview',
    });
    const original = {
      assetId: originalStored.id,
      url: originalStored.url,
      kind: 'original',
      mimeType: metadata.mimeType,
      format: metadata.normalize ? 'png' : metadata.format,
      width: metadata.width,
      height: metadata.height,
      byteSize: originalBuffer.length,
      role,
      ...(metadata.normalize ? { sourceFormat: metadata.sourceFormat, normalized: true } : {}),
    };
    const preview = {
      assetId: previewStored.id,
      url: previewStored.url,
      kind: 'preview',
      sourceAssetId: original.assetId,
      mimeType: 'image/webp',
      format: 'webp',
      width: previewOutput.width,
      height: previewOutput.height,
      byteSize: previewOutput.buffer.length,
      role,
    };
    const response = { original, preview };
    const timestampValue = now();
    const timestamp = new Date(timestampValue instanceof Date ? timestampValue.getTime() : timestampValue).toISOString();
    persistMetadata({
      idempotencyKey,
      owner,
      original,
      preview,
      role,
      response,
      timestamp,
    });
    return parseStoredResponse(statements.replay.get(idempotencyKey)?.response_json) || response;
  }

  async function upload({ ownerEmail, body } = {}) {
    const owner = normalizeOwner(ownerEmail);
    const request = validateRequestBody(body);
    return persistUpload({
      owner,
      role: request.role,
      buffer: decodeBase64(request.data, maxOriginalBytes),
    });
  }

  async function uploadBuffer({ ownerEmail, role = 'product', buffer } = {}) {
    return persistUpload({
      owner: normalizeOwner(ownerEmail),
      role: validateRole(role),
      buffer,
    });
  }

  async function getOwnedAsset({ ownerEmail, assetId } = {}) {
    const owner = normalizeOwner(ownerEmail);
    const safeAssetId = validateAssetId(assetId);
    const owned = statements.ownedRecord.get(owner, safeAssetId);
    if (owned) return publicRecord(owned);
    if (statements.anyRecord.get(safeAssetId)) {
      throw httpError('无权访问该素材', 403, 'ASSET_OWNER_MISMATCH');
    }
    throw httpError('素材不存在', 404, 'ASSET_NOT_FOUND');
  }

  return {
    upload,
    uploadBuffer,
    getOwnedAsset,
  };
}

function respondWithError(res, error) {
  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599
    ? error.status
    : 500;
  const body = {
    error: status === 500 ? '服务器内部错误，请稍后重试' : String(error?.message || '请求失败'),
  };
  if (typeof error?.code === 'string' && error.code) body.code = error.code;
  return res.status(status).json(body);
}

export function createEcommerceAssetRouteHandlers({ assetUploadService } = {}) {
  if (!assetUploadService || typeof assetUploadService.upload !== 'function') {
    throw new TypeError('assetUploadService.upload is required');
  }
  return {
    async upload(req, res) {
      try {
        const result = Buffer.isBuffer(req?.body)
          ? await assetUploadService.uploadBuffer({
              ownerEmail: req?._userEmail,
              role: req?.headers?.['x-ecommerce-asset-role'] || 'product',
              buffer: req.body,
            })
          : await assetUploadService.upload({
              ownerEmail: req?._userEmail,
              body: req?.body,
            });
        return res.status(201).json(result);
      } catch (error) {
        return respondWithError(res, error);
      }
    },
  };
}

export { ASSET_ID_RE };
