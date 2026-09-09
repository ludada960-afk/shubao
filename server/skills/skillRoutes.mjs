import { listBuiltinSkills, getBuiltinSkill } from './skillCatalog.mjs';
import { validateUserSkill } from './skillValidation.mjs';

/**
 * 技能库路由（2026-09-10）
 *  GET    /api/skills?kind=image   → { ok, builtin:[], mine:[] }
 *  POST   /api/skills              → 新建用户 skill
 *  PATCH  /api/skills/:id          → 更新（版本号 +1）
 *  DELETE /api/skills/:id          → 归档
 *
 * 契约：内置 skill 只读；用户 skill 只写 user_skills 表；
 *       所有写操作先过 validateUserSkill()（长度/字段/越权指令）。
 */
export function mountSkillRoutes(app, { skillStore, authenticateOwner } = {}) {
  if (!app || typeof app.get !== 'function') throw new TypeError('app must be an express instance');
  if (!skillStore || typeof skillStore.createSkill !== 'function') throw new TypeError('skillStore is required');
  if (typeof authenticateOwner !== 'function') throw new TypeError('authenticateOwner(req) is required');

  const authorize = (req, res) => {
    try {
      const email = String(authenticateOwner(req) || '').trim().toLowerCase();
      if (!email) {
        res.status(401).json({ ok: false, error: '登录信息无效' });
        return '';
      }
      return email;
    } catch (error) {
      res.status(error?.status || 401).json({ ok: false, error: error?.message || '登录已失效，请重新登录' });
      return '';
    }
  };

  const rejectValidation = (res, result) => res.status(400).json({
    ok: false,
    error: result.message,
    errorCode: result.errorCode,
    field: result.field || '',
  });

  app.get('/api/skills', (req, res) => {
    const email = authorize(req, res);
    if (!email) return undefined;
    const kind = String(req.query?.kind || '').trim();
    return res.json({
      ok: true,
      builtin: listBuiltinSkills(kind),
      mine: skillStore.listSkills({ ownerEmail: email, kind }),
    });
  });

  app.post('/api/skills', (req, res) => {
    const email = authorize(req, res);
    if (!email) return undefined;
    const validation = validateUserSkill(req.body || {});
    if (!validation.ok) return rejectValidation(res, validation);
    const skill = skillStore.createSkill({ ownerEmail: email, skill: validation.skill });
    return res.status(201).json({ ok: true, skill });
  });

  app.patch('/api/skills/:id', (req, res) => {
    const email = authorize(req, res);
    if (!email) return undefined;
    const existing = skillStore.getSkill({ ownerEmail: email, id: req.params?.id });
    if (!existing || existing.status !== 'active') {
      return res.status(404).json({ ok: false, error: '技能不存在或已归档' });
    }
    const validation = validateUserSkill({ ...existing, ...(req.body || {}) });
    if (!validation.ok) return rejectValidation(res, validation);
    const skill = skillStore.updateSkill({ ownerEmail: email, id: existing.id, skill: validation.skill });
    return res.json({ ok: true, skill });
  });

  app.delete('/api/skills/:id', (req, res) => {
    const email = authorize(req, res);
    if (!email) return undefined;
    const skill = skillStore.archiveSkill({ ownerEmail: email, id: req.params?.id });
    if (!skill) return res.status(404).json({ ok: false, error: '技能不存在或已归档' });
    return res.json({ ok: true, skill });
  });

  // 内置技能详情（供"派生为我的技能"使用）
  app.get('/api/skills/builtin/:id', (req, res) => {
    const skill = getBuiltinSkill(decodeURIComponent(String(req.params?.id || '')));
    if (!skill) return res.status(404).json({ ok: false, error: '内置技能不存在' });
    return res.json({ ok: true, skill });
  });

  return { listBuiltinSkills };
}
