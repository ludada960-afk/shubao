import crypto from 'node:crypto';
import fs from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { FileStore } from '@tus/file-store';
import { Server } from '@tus/server';

const DEFAULT_PATH = '/api/video/uploads';
const RESULT_PATH = '/api/video/upload-results/';
const DEFAULT_EXPIRATION_MS = 24 * 60 * 60 * 1000;
const LIMITS = Object.freeze({
  image: 10 * 1024 * 1024,
  video: 50 * 1024 * 1024,
  audio: 15 * 1024 * 1024,
});
const CONTENT_TYPES = Object.freeze({
  image: new Set(['image/jpeg', 'image/png', 'image/webp']),
  video: new Set(['video/mp4', 'video/webm', 'video/quicktime']),
  audio: new Set(['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/webm']),
});

function clean(value, max = 500) {
  return String(value || '').trim().slice(0, max);
}

function normalizedOwner(value) {
  return clean(value, 320).toLowerCase();
}

function tusError(status, code, message) {
  return Object.assign(new Error(message), {
    status_code: status,
    body: JSON.stringify({ code, error: message }),
  });
}

function publicBaseUrl(req) {
  const proto = clean(req.headers['x-forwarded-proto'] || 'http', 30).split(',')[0].trim();
  const host = clean(req.headers.host, 300);
  return host ? `${proto}://${host}` : '';
}

async function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

function serializeSession(row) {
  if (!row) return null;
  return {
    id: row.id,
    kind: row.kind,
    contentType: row.content_type,
    fileName: row.file_name,
    bytes: Number(row.bytes || 0),
    offset: Number(row.offset || 0),
    sha256: row.actual_sha256 || '',
    status: row.status,
    expiresAt: Number(row.expires_at || 0),
    createdAt: Number(row.created_at || 0),
    completedAt: Number(row.completed_at || 0),
    error: row.error || '',
  };
}

export function createVideoUploadService({
  db,
  directory,
  path = DEFAULT_PATH,
  expirationMs = DEFAULT_EXPIRATION_MS,
  now = Date.now,
  importAsset,
} = {}) {
  if (!db) throw new Error('video upload database is required');
  if (!directory) throw new Error('video upload directory is required');
  if (typeof importAsset !== 'function') throw new Error('video upload asset importer is required');
  fs.mkdirSync(directory, { recursive: true });
  db.exec(`
    CREATE TABLE IF NOT EXISTS video_upload_sessions (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      kind TEXT NOT NULL,
      content_type TEXT NOT NULL,
      file_name TEXT NOT NULL DEFAULT '',
      bytes INTEGER NOT NULL,
      offset INTEGER NOT NULL DEFAULT 0,
      expected_sha256 TEXT NOT NULL DEFAULT '',
      actual_sha256 TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'uploading',
      asset_id TEXT NOT NULL DEFAULT '',
      asset_json TEXT NOT NULL DEFAULT '',
      error TEXT NOT NULL DEFAULT '',
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      completed_at INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_video_upload_sessions_owner ON video_upload_sessions(owner_email, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_video_upload_sessions_expiry ON video_upload_sessions(status, expires_at);
  `);

  const store = new FileStore({
    directory,
    expirationPeriodInMilliseconds: expirationMs,
  });
  const sessionById = db.prepare('SELECT * FROM video_upload_sessions WHERE id = ?');
  const ownedSession = db.prepare('SELECT * FROM video_upload_sessions WHERE id = ? AND owner_email = ?');
  const insertSession = db.prepare(`INSERT INTO video_upload_sessions (
    id, owner_email, kind, content_type, file_name, bytes, expected_sha256, status, expires_at, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, 'uploading', ?, ?)`);
  const updateOffset = db.prepare('UPDATE video_upload_sessions SET offset = ?, expires_at = ? WHERE id = ?');
  const markCompleted = db.prepare(`UPDATE video_upload_sessions SET
    offset = bytes, actual_sha256 = ?, status = 'completed', asset_id = ?, asset_json = ?, error = '', completed_at = ?
    WHERE id = ?`);
  const markFailed = db.prepare("UPDATE video_upload_sessions SET actual_sha256 = ?, status = ?, error = ?, completed_at = ? WHERE id = ?");
  const markExpired = db.prepare("UPDATE video_upload_sessions SET status = 'expired', error = '上传已过期' WHERE id = ? AND status = 'uploading'");

  function ownerFromWebRequest(req) {
    const nativeRequest = req.runtime?.node?.req;
    return normalizedOwner(nativeRequest?._userEmail || nativeRequest?.headers?.['x-test-owner']);
  }

  function requireOwner(req) {
    const owner = ownerFromWebRequest(req);
    if (!owner) throw tusError(401, 'VIDEO_UPLOAD_OWNER_REQUIRED', '登录已失效，请重新登录');
    return owner;
  }

  const tusServer = new Server({
    path,
    datastore: store,
    relativeLocation: true,
    respectForwardedHeaders: true,
    maxSize: LIMITS.video,
    allowedHeaders: ['Authorization', 'X-Video-Upload-Owner'],
    namingFunction: () => crypto.randomUUID(),
    async onIncomingRequest(req, uploadId) {
      const owner = requireOwner(req);
      if (!uploadId || req.method === 'POST') return;
      const row = sessionById.get(uploadId);
      if (!row || row.owner_email !== owner) throw tusError(404, 'VIDEO_UPLOAD_NOT_FOUND', '上传不存在');
      if (row.status === 'expired') throw tusError(410, 'VIDEO_UPLOAD_EXPIRED', '上传已过期');
      if (row.status === 'checksum_failed' || row.status === 'failed') {
        throw tusError(409, 'VIDEO_UPLOAD_NOT_RESUMABLE', '上传已终止，请重新选择文件');
      }
    },
    async onUploadCreate(req, upload) {
      const owner = requireOwner(req);
      const metadata = upload.metadata || {};
      const kind = clean(metadata.kind, 20).toLowerCase();
      const contentType = clean(metadata.filetype, 100).toLowerCase().split(';')[0];
      const fileName = clean(metadata.filename, 300);
      const expectedSha256 = clean(metadata.sha256, 64).toLowerCase();
      const bytes = Number(upload.size);
      if (!Object.hasOwn(LIMITS, kind)) throw tusError(400, 'VIDEO_ASSET_KIND_INVALID', '素材类型不支持');
      if (!CONTENT_TYPES[kind].has(contentType)) throw tusError(415, 'VIDEO_ASSET_TYPE_INVALID', '素材文件格式不支持');
      if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > LIMITS[kind]) {
        throw tusError(413, 'VIDEO_ASSET_SIZE_INVALID', '素材文件大小不符合要求');
      }
      if (expectedSha256 && !/^[a-f0-9]{64}$/.test(expectedSha256)) {
        throw tusError(400, 'VIDEO_ASSET_CHECKSUM_INVALID', '素材校验信息无效');
      }
      const createdAt = now();
      insertSession.run(upload.id, owner, kind, contentType, fileName, bytes, expectedSha256, createdAt + expirationMs, createdAt);
      return { metadata: { ...metadata, owner, kind, filetype: contentType, filename: fileName, sha256: expectedSha256 } };
    },
    async onUploadFinish(req, upload) {
      const owner = requireOwner(req);
      const row = ownedSession.get(upload.id, owner);
      if (!row) throw tusError(404, 'VIDEO_UPLOAD_NOT_FOUND', '上传不存在');
      if (row.status === 'completed' && row.asset_json) return {};
      const sourcePath = resolve(upload.storage?.path || resolve(directory, upload.id));
      const actualSha256 = await sha256File(sourcePath);
      if (row.expected_sha256 && row.expected_sha256 !== actualSha256) {
        markFailed.run(actualSha256, 'checksum_failed', '素材校验失败，请重新上传', now(), upload.id);
        throw tusError(422, 'VIDEO_ASSET_CHECKSUM_MISMATCH', '素材校验失败，请重新上传');
      }
      try {
        const asset = await importAsset({
          ownerEmail: owner,
          kind: row.kind,
          contentType: row.content_type,
          fileName: row.file_name,
          sourcePath,
          bytes: row.bytes,
          sha256: actualSha256,
          publicBaseUrl: publicBaseUrl(req.runtime?.node?.req || { headers: {} }),
        });
        markCompleted.run(actualSha256, asset.id, JSON.stringify(asset), now(), upload.id);
        return { headers: { 'X-Video-Asset-Id': asset.id } };
      } catch (error) {
        markFailed.run(actualSha256, 'failed', clean(error?.message || '素材入库失败', 500), now(), upload.id);
        throw tusError(error?.status || 500, error?.code || 'VIDEO_ASSET_IMPORT_FAILED', error?.message || '素材入库失败');
      }
    },
  });

  let closed = false;
  tusServer.on('POST_RECEIVE', (_req, upload) => {
    if (closed) return;
    updateOffset.run(Number(upload.offset || 0), now() + expirationMs, upload.id);
  });

  function nativeOwner(req) {
    return normalizedOwner(req._userEmail || req.headers['x-test-owner']);
  }

  function writeJson(res, status, payload) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
  }

  function handleResult(req, res, id) {
    const owner = nativeOwner(req);
    if (!owner) return writeJson(res, 401, { code: 'VIDEO_UPLOAD_OWNER_REQUIRED', error: '登录已失效，请重新登录' });
    const row = ownedSession.get(id, owner);
    if (!row) return writeJson(res, 404, { code: 'VIDEO_UPLOAD_NOT_FOUND', error: '上传不存在' });
    const upload = serializeSession(row);
    if (row.status === 'expired') return writeJson(res, 410, { upload, error: row.error });
    if (row.status === 'checksum_failed') return writeJson(res, 422, { upload, error: row.error });
    if (row.status === 'failed') return writeJson(res, 500, { upload, error: row.error });
    const asset = row.asset_json ? JSON.parse(row.asset_json) : null;
    return writeJson(res, row.status === 'completed' ? 200 : 202, { upload, asset });
  }

  async function handle(req, res) {
    const requestUrl = new URL(req.url || '/', 'http://video-upload.local');
    if (requestUrl.pathname.startsWith(RESULT_PATH)) {
      return handleResult(req, res, decodeURIComponent(requestUrl.pathname.slice(RESULT_PATH.length)));
    }
    return tusServer.handle(req, res);
  }

  async function cleanExpiredUploads(input = {}) {
    const limit = Math.max(1, Math.min(200, Number(input?.limit) || 50));
    const rows = db.prepare("SELECT id FROM video_upload_sessions WHERE status = 'uploading' AND expires_at <= ? ORDER BY expires_at, rowid LIMIT ?").all(now(), limit);
    for (const row of rows) {
      markExpired.run(row.id);
      await store.remove(row.id).catch(() => {});
    }
    await tusServer.cleanUpExpiredUploads().catch(() => 0);
    return rows.length;
  }

  const cleanupTimer = setInterval(() => void cleanExpiredUploads(), Math.min(expirationMs, 60 * 60 * 1000));
  cleanupTimer.unref?.();

  return {
    handle,
    handleResult,
    cleanExpiredUploads,
    getResult(ownerEmail, id) {
      const row = ownedSession.get(id, normalizedOwner(ownerEmail));
      return row ? { upload: serializeSession(row), asset: row.asset_json ? JSON.parse(row.asset_json) : null } : null;
    },
    close() {
      closed = true;
      clearInterval(cleanupTimer);
    },
  };
}
