// server/templates/workflowTemplateStore.mjs
// P2 业务资产层 — 工作流模板 store（better-sqlite3；in-memory 可测）。
//
// 迁移风格（镜像 server/canvas/graphRunSchema.mjs + server/billing/canvasBilledActionStore.mjs）：
//   CREATE TABLE IF NOT EXISTS + PRAGMA table_info 守卫的 ALTER TABLE ADD COLUMN
//   （旧库缺列自动补齐，新库 no-op，重复调用全程幂等）。
//
// 口径：
//   - graph_json = {nodes[], connections[]} 唯一真源（spec §2）；pricing_json 仅展示用
//     （铁律③ 单一价格真源：实际结算永远走 P1 执行器 + 计费 catalog，pricing_json 绝不参与扣费）。
//   - 邮箱一律小写归一（同 billing store 口径）。
//   - usage_count 只经 incrementUsage（实例化成功）累加；种子一律 0，禁止占位假数（master-plan §153 红线）。
//
// 不变式：
//   ① 不确认不扣费：模板只供图结构，收费发生在节点动作层（P1 graph run / 计费目录）。
//   ② 老文档只读可用：迁移纯增量 + 幂等，永不改写既有行。
//   ③ 单一价格真源：见上。

import { randomUUID as nodeRandomUUID } from 'node:crypto';

/* P3 音视频节点 kind（P1 buildRunPlan 不识别 → 诚实门控；T4/T5 因此本期不可扣费运行，不 mock）。 */
export const P3_GRAPH_KINDS = Object.freeze(['video-composer', 'tts', 'lip-sync', 'video', 'audio']);

/* 模板 graph 是否含 P3 音视频节点（T4/T5 前端据此渲染“待 P3”灰态 + 禁止发起扣费运行）。 */
export function graphRequiresAudioVideo(graph = {}) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const kinds = new Set(P3_GRAPH_KINDS);
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue;
    const kind = node.actionId || node.kind;
    if (kind && kinds.has(kind)) return true;
  }
  return false;
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEmail(value) {
  return cleanString(value).toLowerCase();
}

/* 防御性 JSON 解析（source-hygiene safe）：legacy / 损坏数据回落 fallback，绝不抛。 */
function parseDefensive(value, fallback) {
  if (value == null) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/* graph_json 落库前归一：只保留 {nodes[], connections[]}（spec §2 唯一真源口径）。 */
function sanitizeGraph(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { nodes: [], connections: [] };
  return {
    nodes: Array.isArray(value.nodes) ? value.nodes : [],
    connections: Array.isArray(value.connections) ? value.connections : [],
  };
}

/* pricing_json 落库前归一：{estimatedUnits:number, note:string}（展示用；兼容 spec 的 unitNote 键名）。 */
function sanitizePricing(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out = {};
  const units = Number(value.estimatedUnits);
  if (Number.isFinite(units)) out.estimatedUnits = units;
  const note = cleanString(value.note || value.unitNote).slice(0, 500);
  if (note) out.note = note;
  return out;
}

function codedError(message, code, status) {
  return Object.assign(new Error(message), { code, status });
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/i;

/* 列清单（名称 + 旧库缺列时的 ADD COLUMN 定义）——迁移幂等的唯一依据。
   注意：CREATE TABLE 承载 PK/UNIQUE 约束；ALTER ADD COLUMN 只带普通定义（SQLite 限制）。 */
const TEMPLATE_COLUMNS = [
  ['template_id', "TEXT NOT NULL DEFAULT ''"],
  ['slug', "TEXT NOT NULL DEFAULT ''"],
  ['name', "TEXT NOT NULL DEFAULT ''"],
  ['category', "TEXT NOT NULL DEFAULT ''"],
  ['description', "TEXT NOT NULL DEFAULT ''"],
  ['author_email', "TEXT NOT NULL DEFAULT ''"],
  ['is_built_in', 'INTEGER NOT NULL DEFAULT 0'],
  ['is_public', 'INTEGER NOT NULL DEFAULT 0'],
  ['graph_json', "TEXT NOT NULL DEFAULT '{}'"],
  ['pricing_json', "TEXT NOT NULL DEFAULT '{}'"],
  ['usage_count', 'INTEGER NOT NULL DEFAULT 0'],
  ['like_count', 'INTEGER NOT NULL DEFAULT 0'],
  ['created_at', "TEXT NOT NULL DEFAULT ''"],
  ['updated_at', "TEXT NOT NULL DEFAULT ''"],
];
const LIKE_COLUMNS = [
  ['template_id', "TEXT NOT NULL"],
  ['owner_email', "TEXT NOT NULL"],
  ['created_at', "TEXT NOT NULL DEFAULT ''"],
];

function ensureColumns(db, table, columns) {
  const existing = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name));
  for (const [name, definition] of columns) {
    if (existing.has(name)) continue;
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  }
}

function rowToTemplate(row) {
  if (!row) return null;
  /* 防御性解析：graph_json/pricing_json 读路径永不因 legacy 脏数据崩溃。 */
  const graph = parseDefensive(row.graph_json, { nodes: [], connections: [] });
  const pricing = parseDefensive(row.pricing_json, {});
  return {
    templateId: row.template_id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    description: row.description,
    authorEmail: row.author_email,
    isBuiltIn: row.is_built_in === 1,
    isPublic: row.is_public === 1,
    graph,
    pricing,
    requiresAudioVideo: graphRequiresAudioVideo(graph),
    usageCount: Number(row.usage_count) || 0,
    likeCount: Number(row.like_count) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createWorkflowTemplateStore(db, {
  now = Date.now,
  randomUUID = nodeRandomUUID,
} = {}) {
  if (!db || typeof db.prepare !== 'function' || typeof db.exec !== 'function' || typeof db.transaction !== 'function') {
    throw new TypeError('a better-sqlite3 database is required');
  }
  if (typeof now !== 'function' || typeof randomUUID !== 'function') {
    throw new TypeError('now and randomUUID must be functions');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS workflow_templates (
      template_id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      author_email TEXT NOT NULL DEFAULT '',
      is_built_in INTEGER NOT NULL DEFAULT 0,
      is_public INTEGER NOT NULL DEFAULT 0,
      graph_json TEXT NOT NULL DEFAULT '{}',
      pricing_json TEXT NOT NULL DEFAULT '{}',
      usage_count INTEGER NOT NULL DEFAULT 0,
      like_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_workflow_templates_list
      ON workflow_templates(is_public, category, updated_at);
    CREATE INDEX IF NOT EXISTS idx_workflow_templates_author
      ON workflow_templates(author_email);
    CREATE TABLE IF NOT EXISTS workflow_template_likes (
      template_id TEXT NOT NULL,
      owner_email TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (template_id, owner_email)
    );
  `);
  ensureColumns(db, 'workflow_templates', TEMPLATE_COLUMNS);
  ensureColumns(db, 'workflow_template_likes', LIKE_COLUMNS);

  const statements = {
    selectById: db.prepare('SELECT * FROM workflow_templates WHERE template_id = ?'),
    selectBySlug: db.prepare('SELECT * FROM workflow_templates WHERE slug = ?'),
    insertTemplate: db.prepare(`
      INSERT INTO workflow_templates (
        template_id, slug, name, category, description, author_email,
        is_built_in, is_public, graph_json, pricing_json,
        usage_count, like_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
    `),
    updateTemplate: db.prepare(`
      UPDATE workflow_templates
      SET name = ?, category = ?, description = ?, graph_json = ?, pricing_json = ?, updated_at = ?
      WHERE template_id = ?
    `),
    bumpUsage: db.prepare(`
      UPDATE workflow_templates SET usage_count = usage_count + 1, updated_at = ?
      WHERE template_id = ?
    `),
    syncLikeCount: db.prepare(`
      UPDATE workflow_templates SET like_count = ?, updated_at = ? WHERE template_id = ?
    `),
    likeCount: db.prepare('SELECT COUNT(*) AS count FROM workflow_template_likes WHERE template_id = ?'),
    selectLike: db.prepare('SELECT template_id FROM workflow_template_likes WHERE template_id = ? AND owner_email = ?'),
    insertLike: db.prepare(`
      INSERT OR IGNORE INTO workflow_template_likes (template_id, owner_email, created_at) VALUES (?, ?, ?)
    `),
    deleteLike: db.prepare('DELETE FROM workflow_template_likes WHERE template_id = ? AND owner_email = ?'),
  };

  function currentTimeIso() {
    const value = now();
    const timestamp = value instanceof Date ? value.getTime() : value;
    if (!Number.isFinite(timestamp)) throw new TypeError('store clock must return a finite timestamp');
    return new Date(timestamp).toISOString();
  }

  /* 解析 template_id 或 slug（调用方两种都合法）；找不到抛 404。 */
  function resolveTemplate(ref) {
    const key = cleanString(ref);
    if (!key) throw new TypeError('template id or slug is required');
    const row = statements.selectById.get(key) || statements.selectBySlug.get(key);
    if (!row) throw codedError('workflow template not found', 'WORKFLOW_TEMPLATE_NOT_FOUND', 404);
    return row;
  }

  return {
    /* list({public, ownerEmail, category})：
       - ownerEmail -> author_email=?（public 缺省仍要 is_public=1；public===false 才放开私有）
       - public===false 且无 ownerEmail -> 全量（路由只在“已登录”时放行该口径）
       - 缺省 -> 仅公开 */
    list(options = {}) {
      const { ownerEmail, category, public: isPublic } = options;
      const clauses = [];
      const params = [];
      const owner = normalizeEmail(ownerEmail);
      if (owner) {
        clauses.push('author_email = ?');
        params.push(owner);
        if (isPublic !== false) clauses.push('is_public = 1');
      } else if (isPublic !== false) {
        clauses.push('is_public = 1');
      }
      if (category) {
        clauses.push('category = ?');
        params.push(cleanString(category));
      }
      const sql = `SELECT * FROM workflow_templates${clauses.length ? ' WHERE ' + clauses.join(' AND ') : ''}
        ORDER BY is_built_in DESC, usage_count DESC, updated_at DESC, slug ASC`;
      return db.prepare(sql).all(...params).map(rowToTemplate);
    },

    /* 按 slug 或 template_id 取；找不到 null（路由层据此 404，避免泄露私有模板存在性）。 */
    get(slugOrId) {
      const key = cleanString(slugOrId);
      if (!key) return null;
      return rowToTemplate(statements.selectById.get(key) || statements.selectBySlug.get(key));
    },

    /* 按 slug upsert。slug 被他人占用 -> 409 WORKFLOW_TEMPLATE_SLUG_TAKEN（seedBuiltIn 依此永不覆盖）。 */
    create(input = {}) {
      const slug = cleanString(input.slug);
      if (slug && !SLUG_RE.test(slug)) {
        throw codedError('template slug is invalid', 'WORKFLOW_TEMPLATE_INVALID_INPUT', 400);
      }
      const name = cleanString(input.name);
      const category = cleanString(input.category);
      if (!name || !category) {
        throw codedError('template name and category are required', 'WORKFLOW_TEMPLATE_INVALID_INPUT', 400);
      }
      const finalSlug = slug || `tpl-${cleanString(randomUUID()).replace(/-/g, '').slice(0, 10)}`;
      const author = normalizeEmail(input.authorEmail);
      const graphJson = JSON.stringify(sanitizeGraph(input.graph));
      const pricingJson = JSON.stringify(sanitizePricing(input.pricing));
      const nowIso = currentTimeIso();
      const existing = statements.selectBySlug.get(finalSlug);
      if (existing) {
        if (author && existing.author_email !== author) {
          throw codedError('template slug is taken by another author', 'WORKFLOW_TEMPLATE_SLUG_TAKEN', 409);
        }
        statements.updateTemplate.run(name, category, cleanString(input.description), graphJson, pricingJson, nowIso, existing.template_id);
        return rowToTemplate(statements.selectBySlug.get(finalSlug));
      }
      const templateId = cleanString(input.templateId) || cleanString(randomUUID());
      const isBuiltIn = input.isBuiltIn ? 1 : 0;
      const isPublic = input.isPublic === undefined ? (input.isBuiltIn ? 1 : 0) : (input.isPublic ? 1 : 0);
      statements.insertTemplate.run(
        templateId, finalSlug, name, category, cleanString(input.description), author,
        isBuiltIn, isPublic, graphJson, pricingJson, nowIso, nowIso,
      );
      return rowToTemplate(statements.selectBySlug.get(finalSlug));
    },

    /* 实例化成功才 +1（真数口径）。返回 {usageCount}。 */
    incrementUsage(templateId) {
      const row = resolveTemplate(templateId);
      statements.bumpUsage.run(currentTimeIso(), row.template_id);
      return { usageCount: Number(statements.selectById.get(row.template_id).usage_count) || 0 };
    },

    /* 点赞幂等（INSERT OR IGNORE，双击不重复计数）：返回 {liked, likeCount}。
       幂等性：连续两次调用 like_count 保持 1。 */
    toggleLike(templateId, ownerEmail) {
      const row = resolveTemplate(templateId);
      const owner = normalizeEmail(ownerEmail);
      if (!owner) throw new TypeError('owner email is required');
      const run = db.transaction(() => {
        const nowIso = currentTimeIso();
        statements.insertLike.run(row.template_id, owner, nowIso); // INSERT OR IGNORE -> 幂等
        const liked = Boolean(statements.selectLike.get(row.template_id, owner));
        const likeCount = Number(statements.likeCount.get(row.template_id).count) || 0;
        statements.syncLikeCount.run(likeCount, nowIso, row.template_id);
        return { liked, likeCount };
      });
      return run.immediate();
    },

    /* 取消点赞（UI 侧可选；幂等：没有记录时 no-op）。返回 {liked:false, likeCount}。 */
    unlike(templateId, ownerEmail) {
      const row = resolveTemplate(templateId);
      const owner = normalizeEmail(ownerEmail);
      if (!owner) throw new TypeError('owner email is required');
      const run = db.transaction(() => {
        const nowIso = currentTimeIso();
        statements.deleteLike.run(row.template_id, owner);
        const likeCount = Number(statements.likeCount.get(row.template_id).count) || 0;
        statements.syncLikeCount.run(likeCount, nowIso, row.template_id);
        return { liked: false, likeCount };
      });
      return run.immediate();
    },

    /* 内置播种（幂等）：slug 缺失才插入，已存在 slug 永不覆盖（graph/pricing 原样保留）。
       返回 {seeded:[slugs], skipped:[slugs]}。 */
    seedBuiltIn(templates) {
      const seed = db.transaction((items) => {
        const seeded = [];
        const skipped = [];
        for (const item of Array.isArray(items) ? items : []) {
          const slug = cleanString(item?.slug);
          if (!slug || !cleanString(item?.name)) continue; // 脏条目静默跳过，不炸启动
          if (statements.selectBySlug.get(slug)) {
            skipped.push(slug);
            continue;
          }
          const nowIso = currentTimeIso();
          const templateId = cleanString(item?.templateId) || cleanString(randomUUID());
          statements.insertTemplate.run(
            templateId,
            slug,
            cleanString(item.name),
            cleanString(item.category) || 'general',
            cleanString(item.description),
            normalizeEmail(item.authorEmail) || 'system',
            1,
            item.isPublic === false ? 0 : 1,
            JSON.stringify(sanitizeGraph(item.graph)),
            JSON.stringify(sanitizePricing(item.pricing)),
            nowIso,
            nowIso,
          );
          seeded.push(slug);
        }
        return { seeded, skipped };
      });
      return seed.immediate(templates);
    },
  };
}
