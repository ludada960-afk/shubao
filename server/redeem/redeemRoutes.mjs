/**
 * 兑换码路由（2026-09-10）
 *  POST /api/redeem            用户兑换（登录态）
 *  GET  /api/redeem/records    我的兑换记录
 *  POST /api/admin/redeem-codes 管理员建码（owner 权限）
 */
export function mountRedeemRoutes(app, { redeemService, authenticateOwner, authorizeAdmin } = {}) {
  if (!app || typeof app.post !== 'function') throw new TypeError('app must be an express instance');
  if (!redeemService || typeof redeemService.redeem !== 'function') throw new TypeError('redeemService is required');
  if (typeof authenticateOwner !== 'function') throw new TypeError('authenticateOwner(req) is required');

  const authorize = (req, res) => {
    try {
      const email = String(authenticateOwner(req) || '').trim().toLowerCase();
      if (!email) { res.status(401).json({ ok: false, error: '请先登录' }); return ''; }
      return email;
    } catch (error) {
      res.status(error?.status || 401).json({ ok: false, error: error?.message || '登录已失效，请重新登录' });
      return '';
    }
  };

  const sendRedeemError = (res, error) => {
    const code = error?.code || 'REDEEM_FAILED';
    const status = ['REDEEM_CODE_REQUIRED', 'REDEEM_CODE_INVALID', 'REDEEM_UNITS_INVALID'].includes(code) ? 400
      : ['REDEEM_CODE_NOT_FOUND', 'REDEEM_CODE_EXPIRED', 'REDEEM_CODE_EXHAUSTED', 'REDEEM_ALREADY_USED'].includes(code) ? 409
        : 400;
    return res.status(status).json({ ok: false, error: error?.message || '兑换失败', code });
  };

  app.post('/api/redeem', (req, res) => {
    const email = authorize(req, res);
    if (!email) return undefined;
    try {
      const result = redeemService.redeem({ ownerEmail: email, code: req.body?.code });
      return res.json({ ok: true, ...result });
    } catch (error) {
      return sendRedeemError(res, error);
    }
  });

  app.get('/api/redeem/records', (req, res) => {
    const email = authorize(req, res);
    if (!email) return undefined;
    return res.json({ ok: true, records: redeemService.listRecords({ ownerEmail: email, limit: req.query?.limit }) });
  });

  if (typeof authorizeAdmin === 'function') {
    app.post('/api/admin/redeem-codes', (req, res) => {
      const email = authorize(req, res);
      if (!email) return undefined;
      const access = authorizeAdmin(email);
      if (!access?.ok) return res.status(access?.status || 403).json({ ok: false, error: access?.error || '没有管理权限' });
      try {
        const code = redeemService.createCode({
          code: req.body?.code,
          grantUnits: Number(req.body?.grantUnits),
          currency: req.body?.currency,
          maxUses: Number(req.body?.maxUses) || 0,
          perUserLimit: Number(req.body?.perUserLimit) || 1,
          expiresAt: req.body?.expiresAt || null,
          note: req.body?.note || '',
          createdBy: email,
        });
        return res.status(201).json({ ok: true, code });
      } catch (error) {
        return sendRedeemError(res, error);
      }
    });
  }

  return { redeemService };
}
