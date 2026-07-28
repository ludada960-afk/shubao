function mappedError(error, mapError) {
  if (error?.code === 'WORK_NOT_FOUND') {
    return { status: 404, body: { code: 'WORK_NOT_FOUND', error: '作品不存在' } };
  }
  if (typeof mapError === 'function') return mapError(error);
  return {
    status: Number(error?.status) || 500,
    body: { code: error?.code || 'WORKS_ERROR', error: '作品操作失败' },
  };
}

export function mountWorkRoutes(app, deps = {}) {
  const {
    authenticateOwner,
    mapError,
    listWorks,
    listTrash,
    saveOwnedWork,
    deleteOwnedWork,
    restoreOwnedWork,
  } = deps;
  if (!app || typeof app.get !== 'function' || typeof app.post !== 'function') throw new TypeError('app is required');
  for (const [name, value] of Object.entries({ authenticateOwner, listWorks, listTrash, saveOwnedWork, deleteOwnedWork, restoreOwnedWork })) {
    if (typeof value !== 'function') throw new TypeError(`${name} is required`);
  }

  const handle = operation => async (req, res) => {
    try {
      const ownerEmail = authenticateOwner(req);
      return await operation(req, res, ownerEmail);
    } catch (error) {
      const mapped = mappedError(error, mapError);
      return res.status(mapped.status).json(mapped.body);
    }
  };

  app.get('/api/works', handle((req, res, ownerEmail) => res.json(listWorks(ownerEmail))));
  app.get('/api/trash', handle((req, res, ownerEmail) => res.json(listTrash(ownerEmail))));
  app.post('/api/save-work', handle((req, res, ownerEmail) => {
    if (!req.body?.work || typeof req.body.work !== 'object') {
      return res.status(400).json({ code: 'WORK_REQUIRED', error: '缺少作品内容' });
    }
    const work = { ...req.body.work, _phone: ownerEmail };
    const saveKey = saveOwnedWork(work, ownerEmail);
    return res.json({ ok: true, _saveKey: saveKey });
  }));
  app.post('/api/delete-work', handle((req, res, ownerEmail) => {
    const saveKey = String(req.body?._saveKey || '').trim();
    if (!saveKey) return res.status(400).json({ code: 'WORK_KEY_REQUIRED', error: '缺少作品标识' });
    if (!deleteOwnedWork(saveKey, ownerEmail)) {
      return res.status(404).json({ code: 'WORK_NOT_FOUND', error: '作品不存在' });
    }
    return res.json({ ok: true, _saveKey: saveKey });
  }));
  app.post('/api/restore-work', handle((req, res, ownerEmail) => {
    const saveKey = String(req.body?._saveKey || '').trim();
    if (!saveKey) return res.status(400).json({ code: 'WORK_KEY_REQUIRED', error: '缺少作品标识' });
    if (!restoreOwnedWork(saveKey, ownerEmail)) {
      return res.status(404).json({ code: 'WORK_NOT_FOUND', error: '作品不存在' });
    }
    return res.json({ ok: true, _saveKey: saveKey });
  }));
  app.post('/api/migrate-works', handle((req, res) => res.status(410).json({
    code: 'LEGACY_WORK_MIGRATION_RETIRED',
    error: '旧版作品迁移入口已停用',
  })));
}
