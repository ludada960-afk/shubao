import crypto from 'node:crypto';

function normalizeOwner(value) {
  return String(value || '').trim().toLowerCase();
}
function parse(value, fallback) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

function codedError(code, message) {
  return Object.assign(new Error(message), { code });
}

function revisionFromRow(row) {
  if (!row) return null;
  return {
    revision: row.revision,
    layers: parse(row.layers, []),
    backgroundAssetId: row.background_asset_id,
    renderedAssetId: row.rendered_asset_id,
    createdAt: row.created_at,
  };
}

export function createCompositionStore(db, {
  randomUUID = crypto.randomUUID,
  now = () => new Date(),
} = {}) {
  const timestamp = () => {
    const value = now();
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) throw new TypeError('now must return a valid date');
    return date.toISOString();
  };
  const documentRow = (ownerEmail, documentId) => db.prepare(`SELECT * FROM composition_documents
    WHERE id = ? AND owner_email = ?`).get(documentId, normalizeOwner(ownerEmail));
  const mapDocument = row => {
    if (!row) return null;
    const revision = revisionFromRow(db.prepare(`SELECT * FROM composition_revisions
      WHERE document_id = ? AND revision = ?`).get(row.id, row.revision));
    return {
      id: row.id,
      ownerEmail: row.owner_email,
      projectId: row.project_id,
      versionId: row.version_id,
      width: row.width,
      height: row.height,
      colorSpace: row.color_space,
      revision: row.revision,
      layers: revision?.layers || [],
      backgroundAssetId: revision?.backgroundAssetId || null,
      renderedAssetId: revision?.renderedAssetId || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  };

  const api = {
    createDocument({ ownerEmail, projectId, versionId, width, height, colorSpace = 'srgb', backgroundAssetId = null, layers = [] }) {
      const owner = normalizeOwner(ownerEmail);
      if (!Number.isSafeInteger(width) || width <= 0 || !Number.isSafeInteger(height) || height <= 0) {
        throw new TypeError('width and height must be positive integers');
      }
      const project = db.prepare('SELECT id FROM projects WHERE id = ? AND owner_email = ? AND deleted_at IS NULL').get(projectId, owner);
      const version = db.prepare('SELECT id FROM project_versions WHERE id = ? AND project_id = ?').get(versionId, projectId);
      if (!project || !version) throw codedError('PROJECT_NOT_FOUND', 'project version not found');
      const id = randomUUID();
      const createdAt = timestamp();
      db.transaction(() => {
        db.prepare(`INSERT INTO composition_documents
          (id, owner_email, project_id, version_id, width, height, color_space, revision, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`).run(id, owner, projectId, versionId, width, height, colorSpace, createdAt, createdAt);
        db.prepare(`INSERT INTO composition_revisions
          (document_id, revision, layers, background_asset_id, created_at) VALUES (?, 1, ?, ?, ?)`)
          .run(id, JSON.stringify(layers || []), backgroundAssetId, createdAt);
      })();
      return api.getDocument({ ownerEmail: owner, documentId: id });
    },

    getDocument({ ownerEmail, documentId }) {
      return mapDocument(documentRow(ownerEmail, documentId));
    },

    saveRevision({ ownerEmail, documentId, expectedRevision, layers, backgroundAssetId = undefined }) {
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) throw new TypeError('expectedRevision must be a positive integer');
      return db.transaction(() => {
        const row = documentRow(ownerEmail, documentId);
        if (!row) throw codedError('DOCUMENT_NOT_FOUND', 'composition document not found');
        if (row.revision !== expectedRevision) throw codedError('VERSION_CONFLICT', 'composition revision changed');
        const current = revisionFromRow(db.prepare('SELECT * FROM composition_revisions WHERE document_id = ? AND revision = ?').get(documentId, expectedRevision));
        const nextRevision = expectedRevision + 1;
        const createdAt = timestamp();
        db.prepare(`INSERT INTO composition_revisions
          (document_id, revision, layers, background_asset_id, created_at) VALUES (?, ?, ?, ?, ?)`)
          .run(documentId, nextRevision, JSON.stringify(layers || []), backgroundAssetId === undefined ? current?.backgroundAssetId : backgroundAssetId, createdAt);
        const changed = db.prepare(`UPDATE composition_documents SET revision = ?, updated_at = ?
          WHERE id = ? AND owner_email = ? AND revision = ?`).run(nextRevision, createdAt, documentId, normalizeOwner(ownerEmail), expectedRevision).changes;
        if (changed !== 1) throw codedError('VERSION_CONFLICT', 'composition revision changed');
        return api.getDocument({ ownerEmail, documentId });
      })();
    },

    listRevisions({ ownerEmail, documentId }) {
      if (!documentRow(ownerEmail, documentId)) return [];
      return db.prepare('SELECT * FROM composition_revisions WHERE document_id = ? ORDER BY revision ASC').all(documentId).map(revisionFromRow);
    },

    linkRenderedAsset({ ownerEmail, documentId, revision, renderedAssetId }) {
      if (!documentRow(ownerEmail, documentId)) throw codedError('DOCUMENT_NOT_FOUND', 'composition document not found');
      const changed = db.prepare(`UPDATE composition_revisions SET rendered_asset_id = ?
        WHERE document_id = ? AND revision = ?`).run(renderedAssetId, documentId, revision).changes;
      if (changed !== 1) throw codedError('VERSION_NOT_FOUND', 'composition revision not found');
      return revisionFromRow(db.prepare('SELECT * FROM composition_revisions WHERE document_id = ? AND revision = ?').get(documentId, revision));
    },
  };

  return api;
}
