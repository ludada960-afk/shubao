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
      /* 2026-09-15 用户批注（图4-①「技能库怎么坏掉了」）：这里原先把 error.message 原样吐给前端，
         于是用户界面上出现的是英文 'A signed session token is required'。
         两类问题：① 用户看不懂；② 内部错误文案不该出现在用户可见面。
         现在鉴权失败统一给中文 + 稳定 errorCode（前端据此渲染「未登录」状态而不是红色报错）。 */
      const code = String(error?.code || '');
      const authFailure = code === 'AUTH_SESSION_REQUIRED'
        || code === 'AUTH_SESSION_UNAUTHORIZED'
        || error?.status === 401
        || error?.status === 403;
      res.status(error?.status || 401).json({
        ok: false,
        errorCode: authFailure ? (code || 'AUTH_SESSION_REQUIRED') : (code || 'SKILL_LIBRARY_UNAVAILABLE'),
        /* 面向用户的文案一律中文且稳定；机器可读的原因走 errorCode。
           本契约的测试③当场抓到过我自己的一处不一致：非鉴权分支仍在直出 error.message，
           那同样会把内部英文漏给用户 —— 已一并收口。 */
        error: authFailure ? '登录后即可使用技能库' : '技能库暂时不可用，请稍后重试',
      });
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
      groups: skillStore.listGroups({ ownerEmail: email }),
    });
  });

  // ── 分组管理（2026-09-10 用户反馈：技能需要分组）──
  app.get('/api/skill-groups', (req, res) => {
    const email = authorize(req, res);
    if (!email) return undefined;
    return res.json({ ok: true, groups: skillStore.listGroups({ ownerEmail: email }) });
  });

  app.post('/api/skill-groups', (req, res) => {
    const email = authorize(req, res);
    if (!email) return undefined;
    try {
      const group = skillStore.createGroup({ ownerEmail: email, name: req.body?.name, kind: req.body?.kind });
      return res.status(201).json({ ok: true, group });
    } catch (error) {
      return res.status(error?.status || 500).json({ ok: false, error: error?.message || '创建分组失败', errorCode: error?.code || '' });
    }
  });

  app.patch('/api/skill-groups/:id', (req, res) => {
    const email = authorize(req, res);
    if (!email) return undefined;
    try {
      const group = skillStore.renameGroup({ ownerEmail: email, id: req.params?.id, name: req.body?.name });
      if (!group) return res.status(404).json({ ok: false, error: '分组不存在' });
      return res.json({ ok: true, group });
    } catch (error) {
      return res.status(error?.status || 500).json({ ok: false, error: error?.message || '重命名失败', errorCode: error?.code || '' });
    }
  });

  app.delete('/api/skill-groups/:id', (req, res) => {
    const email = authorize(req, res);
    if (!email) return undefined;
    const group = skillStore.archiveGroup({ ownerEmail: email, id: req.params?.id });
    if (!group) return res.status(404).json({ ok: false, error: '分组不存在' });
    return res.json({ ok: true, group });
  });

  app.post('/api/skills', (req, res) => {
    const email = authorize(req, res);
    if (!email) return undefined;
    const validation = validateUserSkill(req.body || {});
    if (!validation.ok) return rejectValidation(res, validation);
    // 分组归属在服务端校验：不属于本人的 groupId 一律清空，不报错也不落脏数据
    validation.skill.groupId = skillStore.resolveGroupId({ ownerEmail: email, groupId: validation.skill.groupId });
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
    validation.skill.groupId = skillStore.resolveGroupId({ ownerEmail: email, groupId: validation.skill.groupId });
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

  // 内置技能详情（含完整提示词正文，供"派生为我的技能"使用；2026-09-10 用户反馈）
  app.get('/api/skills/builtin/:id', (req, res) => {
    const skill = getBuiltinSkill(decodeURIComponent(String(req.params?.id || '')));
    if (!skill) return res.status(404).json({ ok: false, error: '内置技能不存在' });
    return res.json({ ok: true, skill });
  });

  return { listBuiltinSkills };
}
