// 4c183cd4 续命 P3 Flora 关注 (主线程亲自做, 子代理挂了 5+ 次)
import { dbQuery, dbRun, dbGet } from "../db.mjs";

export function createFloraFollowSchema(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS flora_follows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    follower_email TEXT NOT NULL,
    followee_email TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(follower_email, followee_email, kind)
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_flora_follows_follower ON flora_follows(follower_email)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_flora_follows_followee ON flora_follows(followee_email)`);
}

export function followFlora({ follower, followee, kind = "user" }) {
  if (!follower || !followee || follower === followee) throw new Error("flora invalid args");
  dbRun("INSERT OR IGNORE INTO flora_follows (follower_email, followee_email, kind) VALUES (?, ?, ?)", [follower, followee, kind]);
  return { ok: true, follower, followee, kind };
}

export function unfollowFlora({ follower, followee, kind = "user" }) {
  if (!follower || !followee) throw new Error("flora invalid args");
  const stmt = dbRun("DELETE FROM flora_follows WHERE follower_email = ? AND followee_email = ? AND kind = ?", [follower, followee, kind]);
  return { ok: true, removed: stmt.changes || 0, follower, followee, kind };
}

export function listFloraFollowers(followee, { kind = null } = {}) {
  if (!followee) throw new Error("flora missing followee");
  if (kind) {
    return dbQuery("SELECT follower_email, kind, created_at FROM flora_follows WHERE followee_email = ? AND kind = ? ORDER BY created_at DESC", [followee, kind]);
  }
  return dbQuery("SELECT follower_email, kind, created_at FROM flora_follows WHERE followee_email = ? ORDER BY created_at DESC", [followee]);
}

export function listFloraFollowing(follower, { kind = null } = {}) {
  if (!follower) throw new Error("flora missing follower");
  if (kind) {
    return dbQuery("SELECT followee_email, kind, created_at FROM flora_follows WHERE follower_email = ? AND kind = ? ORDER BY created_at DESC", [follower, kind]);
  }
  return dbQuery("SELECT followee_email, kind, created_at FROM flora_follows WHERE follower_email = ? ORDER BY created_at DESC", [follower]);
}

export function isFloraFollowing(follower, followee, kind = "user") {
  if (!follower || !followee) return false;
  const row = dbGet("SELECT 1 FROM flora_follows WHERE follower_email = ? AND followee_email = ? AND kind = ?", [follower, followee, kind]);
  return Boolean(row);
}

export function countFloraFollowers(followee) {
  if (!followee) return 0;
  const row = dbGet("SELECT COUNT(*) AS n FROM flora_follows WHERE followee_email = ?", [followee]);
  return row ? (row.n || 0) : 0;
}

export function countFloraFollowing(follower) {
  if (!follower) return 0;
  const row = dbGet("SELECT COUNT(*) AS n FROM flora_follows WHERE follower_email = ?", [follower]);
  return row ? (row.n || 0) : 0;
}

export function mountFloraRoutes(app, { db, authenticateOwner, requireAccountAccess = null } = {}) {
  if (!app || !db) throw new Error("app and db required");
  createFloraFollowSchema(db);

  const auth = (handler) => async (req, res) => {
    try {
      const result = typeof requireAccountAccess === "function" ? requireAccountAccess(req) : authenticateOwner(req);
      const email = typeof result === "string" ? result : result && result.email;
      if (!email) { res.status(401).json({ code: "AUTH_SESSION_UNAUTHORIZED", error: "未登录" }); return; }
      return handler(req, res, email);
    } catch (e) { res.status(500).json({ code: "FLORA_ERROR", error: e && e.message ? e.message : String(e) }); }
  };

  app.post("/api/flora/follow", auth((req, res, email) => {
    const { followee, kind } = req.body || {};
    if (!followee) return res.status(400).json({ code: "FLORA_FOLLOW_INVALID", error: "请指定关注对象" });
    const r = followFlora({ follower: email, followee, kind: kind || "user" });
    return res.json(r);
  }));

  app.delete("/api/flora/follow", auth((req, res, email) => {
    const { followee, kind } = req.body || req.query || {};
    if (!followee) return res.status(400).json({ code: "FLORA_FOLLOW_INVALID", error: "请指定关注对象" });
    const r = unfollowFlora({ follower: email, followee, kind: kind || "user" });
    return res.json(r);
  }));

  app.get("/api/flora/followers", auth((req, res, email) => {
    const followee = req.query && req.query.email ? req.query.email : email;
    const kind = req.query && req.query.kind;
    const list = listFloraFollowers(followee, { kind });
    return res.json({ followee, count: list.length, followers: list });
  }));

  app.get("/api/flora/following", auth((req, res, email) => {
    const follower = req.query && req.query.email ? req.query.email : email;
    const kind = req.query && req.query.kind;
    const list = listFloraFollowing(follower, { kind });
    return res.json({ follower, count: list.length, following: list });
  }));

  app.get("/api/flora/follow/check", auth((req, res, email) => {
    const followee = req.query && req.query.followee;
    const kind = req.query && req.query.kind;
    return res.json({ following: isFloraFollowing(email, followee, kind || "user") });
  }));
}
