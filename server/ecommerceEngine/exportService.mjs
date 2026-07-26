import crypto from 'node:crypto';

import sharp from 'sharp';

import { ASSET_ID_RE } from './assetUpload.mjs';
import {
  PLATFORM_POLICY_REGISTRY_VERSION,
  getPlatformPolicy,
} from './platformPolicies.mjs';

export const EXPORT_TRANSFORM_VERSION = 'ecommerce-export-v1';

const REQUEST_FIELDS = new Set(['sourceAssetId', 'target']);
const TARGET_FIELDS = new Set([
  'platform',
  'categoryScope',
  'role',
  'ratio',
  'width',
  'height',
  'format',
  'maxFileBytes',
  'fit',
  'policyVersion',
  'fingerprint',
]);
const OUTPUT_FORMATS = new Set(['jpg', 'png', 'webp']);

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

function selector(value, fallback = '') {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!normalized) return fallback;
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(normalized)) {
    throw httpError('平台导出目标无效', 400, 'EXPORT_TARGET_INVALID');
  }
  return normalized;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function ratioFor(width, height) {
  const gcd = (left, right) => (right === 0 ? left : gcd(right, left % right));
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
}

function normalizedFormat(value) {
  const format = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (format === 'jpeg') return 'jpg';
  return OUTPUT_FORMATS.has(format) ? format : '';
}

function policyVersion(policy) {
  const verifiedAt = typeof policy?.verifiedAt === 'string' ? policy.verifiedAt.trim() : '';
  return /^\d{4}-\d{2}(?:-\d{2})?$/.test(verifiedAt)
    ? verifiedAt.replaceAll('-', '.')
    : PLATFORM_POLICY_REGISTRY_VERSION;
}

function canonicalTarget(target) {
  return {
    platform: target.platform,
    categoryScope: target.categoryScope,
    role: target.role,
    ratio: target.ratio,
    width: target.width,
    height: target.height,
    format: target.format,
    maxFileBytes: target.maxFileBytes,
    fit: target.fit,
    policyVersion: target.policyVersion,
  };
}

function withFingerprint(target) {
  const canonical = canonicalTarget(target);
  return {
    ...canonical,
    fingerprint: sha256(`${EXPORT_TRANSFORM_VERSION}\0${JSON.stringify(canonical)}`),
  };
}

function validateRequestBody(body) {
  if (!isRecord(body) || Object.keys(body).some(key => !REQUEST_FIELDS.has(key))) {
    throw httpError('导出请求无效', 400, 'EXPORT_REQUEST_INVALID');
  }
  if (!Object.hasOwn(body, 'sourceAssetId') || !Object.hasOwn(body, 'target')) {
    throw httpError('导出请求无效', 400, 'EXPORT_REQUEST_INVALID');
  }
  if (!isRecord(body.target) || Object.keys(body.target).some(key => !TARGET_FIELDS.has(key))) {
    throw httpError('导出请求无效', 400, 'EXPORT_REQUEST_INVALID');
  }
  return {
    sourceAssetId: validateAssetId(body.sourceAssetId),
    target: body.target,
  };
}

function initializeSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ecommerce_exports (
      idempotency_key TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      source_asset_id TEXT NOT NULL,
      target_fingerprint TEXT NOT NULL,
      transform_fingerprint TEXT NOT NULL,
      output_asset_id TEXT NOT NULL,
      response_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ecommerce_exports_owner_transform
      ON ecommerce_exports(owner_email, source_asset_id, target_fingerprint, transform_fingerprint);
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

function listPolicyTargets(policy, { requestedPlatform, requestedRole, requestedCategory, sourceWidth, sourceHeight }) {
  const platform = selector(policy?.platform, requestedPlatform);
  const role = selector(policy?.role, requestedRole);
  const categoryScope = selector(policy?.categoryScope, requestedCategory);
  const sizes = Array.isArray(policy?.exportSizes) ? policy.exportSizes : [];
  const formats = Array.isArray(policy?.formats) ? policy.formats : [];
  const maxFileBytes = Number(policy?.maxFileBytes);
  if (!sizes.length || !formats.length || !Number.isSafeInteger(maxFileBytes) || maxFileBytes <= 0) {
    throw httpError('服务端平台策略无效', 500, 'EXPORT_POLICY_INVALID');
  }
  const version = policyVersion(policy);
  const sourceRatio = ratioFor(sourceWidth, sourceHeight);
  const targets = [];
  const seen = new Set();
  for (const size of sizes) {
    const width = Number(size?.width);
    const height = Number(size?.height);
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)
      || width <= 0 || height <= 0 || width > 20_000 || height > 20_000) {
      throw httpError('服务端平台策略无效', 500, 'EXPORT_POLICY_INVALID');
    }
    const ratio = ratioFor(width, height);
    for (const candidate of formats) {
      const format = normalizedFormat(candidate);
      if (!format) throw httpError('服务端平台策略无效', 500, 'EXPORT_POLICY_INVALID');
      const key = `${width}x${height}:${format}`;
      if (seen.has(key)) continue;
      seen.add(key);
      targets.push(withFingerprint({
        platform,
        categoryScope,
        role,
        ratio,
        width,
        height,
        format,
        maxFileBytes,
        fit: sourceRatio === ratio ? 'inside' : 'cover',
        policyVersion: version,
      }));
    }
  }
  return targets;
}

function sameTarget(left, right) {
  if (!isRecord(right)) return false;
  return JSON.stringify({ ...canonicalTarget(right), fingerprint: right.fingerprint })
    === JSON.stringify({ ...canonicalTarget(left), fingerprint: left.fingerprint });
}

export function createEcommerceExportService({
  db,
  generatedAssetStore,
  assetUploadService,
  platformPolicyResolver = getPlatformPolicy,
  sharpImpl = sharp,
  now = Date.now,
  maxSourcePixels = 80_000_000,
} = {}) {
  if (!db || typeof db.exec !== 'function' || typeof db.prepare !== 'function') {
    throw new TypeError('a better-sqlite3 database is required');
  }
  if (!generatedAssetStore || typeof generatedAssetStore.persistBuffer !== 'function'
    || typeof generatedAssetStore.read !== 'function') {
    throw new TypeError('generatedAssetStore persistBuffer and read are required');
  }
  if (!assetUploadService || typeof assetUploadService.getOwnedAsset !== 'function') {
    throw new TypeError('assetUploadService.getOwnedAsset is required');
  }
  if (typeof platformPolicyResolver !== 'function') {
    throw new TypeError('platformPolicyResolver must be a function');
  }
  if (typeof sharpImpl !== 'function') throw new TypeError('sharpImpl must be a function');
  if (!Number.isSafeInteger(maxSourcePixels) || maxSourcePixels <= 0) {
    throw new TypeError('maxSourcePixels must be a positive safe integer');
  }
  initializeSchema(db);

  const statements = {
    replay: db.prepare('SELECT response_json FROM ecommerce_exports WHERE idempotency_key = ?'),
    insert: db.prepare(`
      INSERT INTO ecommerce_exports (
        idempotency_key, owner_email, source_asset_id, target_fingerprint,
        transform_fingerprint, output_asset_id, response_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(idempotency_key) DO NOTHING
    `),
  };

  function generatedOwnershipRows(assetId) {
    try {
      return db.prepare(`
        SELECT DISTINCT j.owner_email
        FROM ecommerce_job_assets AS a
        JOIN ecommerce_jobs AS j ON j.id = a.job_id
        WHERE a.stable_url = ?
      `).all(`/api/generated-assets/${assetId}`);
    } catch (error) {
      if (/no such table/i.test(error?.message || '')) return [];
      throw error;
    }
  }

  async function resolveSource(owner, assetId) {
    let uploaded;
    let uploadedOwnershipError;
    try {
      uploaded = await assetUploadService.getOwnedAsset({
        ownerEmail: owner,
        assetId,
      });
    } catch (error) {
      if (error?.code === 'ASSET_OWNER_MISMATCH') uploadedOwnershipError = error;
      else if (error?.code !== 'ASSET_NOT_FOUND') throw error;
    }
    if (uploaded) {
      if (uploaded.kind !== 'original') {
        throw httpError('预览图不能作为平台导出源', 400, 'EXPORT_SOURCE_INVALID');
      }
      const stored = await generatedAssetStore.read(assetId);
      if (!stored?.buffer) throw httpError('导出源已失效', 404, 'EXPORT_SOURCE_NOT_FOUND');
      return {
        assetId,
        sourceKind: 'uploaded',
        role: uploaded.role,
        buffer: stored.buffer,
      };
    }

    const owners = generatedOwnershipRows(assetId)
      .map(row => String(row.owner_email || '').trim().toLowerCase())
      .filter(Boolean);
    if (!owners.includes(owner)) {
      if (uploadedOwnershipError || owners.length) {
        throw uploadedOwnershipError || httpError('无权访问该素材', 403, 'ASSET_OWNER_MISMATCH');
      }
      throw httpError('导出源不存在', 404, 'EXPORT_SOURCE_NOT_FOUND');
    }
    const stored = await generatedAssetStore.read(assetId);
    if (!stored?.buffer) throw httpError('导出源已失效', 404, 'EXPORT_SOURCE_NOT_FOUND');
    return {
      assetId,
      sourceKind: 'generated',
      role: '',
      buffer: stored.buffer,
    };
  }

  async function inspectSource(source) {
    let metadata;
    try {
      metadata = await sharpImpl(source.buffer, {
        failOn: 'error',
        limitInputPixels: maxSourcePixels,
        unlimited: false,
      }).metadata();
    } catch {
      throw httpError('导出源图片无效或尺寸不安全', 422, 'EXPORT_SOURCE_INVALID');
    }
    const width = Number(metadata.width);
    const height = Number(metadata.height);
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)
      || width <= 0 || height <= 0 || width * height > maxSourcePixels) {
      throw httpError('导出源图片无效或尺寸不安全', 422, 'EXPORT_SOURCE_INVALID');
    }
    if (!['jpeg', 'png', 'webp'].includes(metadata.format)) {
      throw httpError('导出源格式不受支持', 415, 'EXPORT_SOURCE_INVALID');
    }
    return { width, height, format: metadata.format };
  }

  async function resolveTargets({ ownerEmail, sourceAssetId, platform, role, category }) {
    const owner = normalizeOwner(ownerEmail);
    const assetId = validateAssetId(sourceAssetId);
    const source = await resolveSource(owner, assetId);
    const metadata = await inspectSource(source);
    const requestedPlatform = selector(platform);
    const requestedRole = selector(role, 'main');
    const requestedCategory = selector(category, 'all');
    if (!requestedPlatform) throw httpError('缺少导出平台', 400, 'EXPORT_TARGET_INVALID');
    const policy = platformPolicyResolver(requestedPlatform, requestedRole, requestedCategory);
    if (!isRecord(policy)) throw httpError('服务端平台策略无效', 500, 'EXPORT_POLICY_INVALID');
    return {
      owner,
      source,
      metadata,
      targets: listPolicyTargets(policy, {
        requestedPlatform,
        requestedRole,
        requestedCategory,
        sourceWidth: metadata.width,
        sourceHeight: metadata.height,
      }),
    };
  }

  async function listTargets(input = {}) {
    const resolved = await resolveTargets(input);
    return resolved.targets.map(target => ({ ...target }));
  }

  async function renderExport(source, target) {
    const background = { r: 255, g: 255, b: 255, alpha: target.role === 'white_background' ? 1 : 0 };
    let pipeline = sharpImpl(source.buffer, {
      failOn: 'error',
      limitInputPixels: maxSourcePixels,
      unlimited: false,
    })
      .rotate()
      .resize({
        width: target.width,
        height: target.height,
        fit: target.fit === 'cover' ? 'cover' : 'contain',
        position: 'centre',
        kernel: 'lanczos3',
        background,
      });

    if (target.role === 'white_background' || target.format === 'jpg') {
      pipeline = pipeline.flatten({ background: { r: 255, g: 255, b: 255 } });
    }
    if (target.format === 'jpg') {
      pipeline = pipeline.jpeg({
        quality: 90,
        chromaSubsampling: '4:4:4',
        mozjpeg: false,
        optimizeCoding: false,
      });
    } else if (target.format === 'png') {
      pipeline = pipeline.png({
        compressionLevel: 9,
        adaptiveFiltering: false,
        palette: false,
      });
    } else {
      pipeline = pipeline.webp({ quality: 90, effort: 4 });
    }

    let output;
    try {
      output = await pipeline.toBuffer({ resolveWithObject: true });
    } catch {
      throw httpError('平台导出处理失败', 422, 'EXPORT_TRANSFORM_FAILED');
    }
    const expectedFormat = target.format === 'jpg' ? 'jpeg' : target.format;
    if (output.info.width !== target.width
      || output.info.height !== target.height
      || output.info.format !== expectedFormat) {
      throw httpError('平台导出结果校验失败', 422, 'EXPORT_OUTPUT_INVALID');
    }
    if (!output.data.length || output.data.length > target.maxFileBytes) {
      throw httpError('平台导出文件超过服务端限制', 422, 'EXPORT_FILE_TOO_LARGE');
    }
    return {
      buffer: output.data,
      width: output.info.width,
      height: output.info.height,
      format: output.info.format,
      mimeType: expectedFormat === 'jpeg' ? 'image/jpeg' : `image/${expectedFormat}`,
      byteSize: output.data.length,
    };
  }

  async function createExport({ ownerEmail, body } = {}) {
    const owner = normalizeOwner(ownerEmail);
    const request = validateRequestBody(body);
    const requestedTarget = request.target;
    const resolved = await resolveTargets({
      ownerEmail: owner,
      sourceAssetId: request.sourceAssetId,
      platform: requestedTarget.platform,
      role: requestedTarget.role,
      category: requestedTarget.categoryScope,
    });
    const target = resolved.targets.find(candidate => sameTarget(candidate, requestedTarget));
    if (!target) throw httpError('平台导出目标已失效或被篡改', 400, 'EXPORT_TARGET_INVALID');

    const transformFingerprint = sha256(JSON.stringify({
      version: EXPORT_TRANSFORM_VERSION,
      sourceAssetId: request.sourceAssetId,
      targetFingerprint: target.fingerprint,
    }));
    const idempotencyKey = sha256(`${owner}\0${transformFingerprint}`);
    const replay = parseStoredResponse(statements.replay.get(idempotencyKey)?.response_json);
    if (replay) return replay;

    const output = await renderExport(resolved.source, target);
    const stored = await generatedAssetStore.persistBuffer({
      buffer: output.buffer,
      contentType: output.mimeType,
      taskId: idempotencyKey,
      label: `${target.platform}-${target.role}`,
    });
    const response = {
      assetId: stored.id,
      url: stored.url,
      sourceAssetId: request.sourceAssetId,
      sourceKind: resolved.source.sourceKind,
      targetFingerprint: target.fingerprint,
      transformFingerprint,
      transformVersion: EXPORT_TRANSFORM_VERSION,
      policyVersion: target.policyVersion,
      platform: target.platform,
      categoryScope: target.categoryScope,
      role: target.role,
      width: output.width,
      height: output.height,
      format: output.format,
      mimeType: output.mimeType,
      byteSize: output.byteSize,
    };
    const timestampValue = now();
    const timestamp = new Date(timestampValue instanceof Date ? timestampValue.getTime() : timestampValue).toISOString();
    statements.insert.run(
      idempotencyKey,
      owner,
      request.sourceAssetId,
      target.fingerprint,
      transformFingerprint,
      stored.id,
      JSON.stringify(response),
      timestamp,
    );
    return parseStoredResponse(statements.replay.get(idempotencyKey)?.response_json) || response;
  }

  return {
    listTargets,
    createExport,
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

export function createEcommerceExportRouteHandlers({ exportService } = {}) {
  if (!exportService || typeof exportService.createExport !== 'function') {
    throw new TypeError('exportService.createExport is required');
  }
  return {
    async create(req, res) {
      try {
        const result = await exportService.createExport({
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
