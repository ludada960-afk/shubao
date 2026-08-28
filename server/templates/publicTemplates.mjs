// 4c183cd4 续命 P3 模板社区 - 公开模板目录 + 复制 API
//
// 设计:
//   * 数据源 = PUBLIC_TEMPLATE_CATALOG (server-side mirror of publicTemplates.js, 18 套)
//   * GET /api/templates/public?cat=&sort=&limit=&offset= -> 分页 + 筛选 + 排序
//   * POST /api/templates/:tplId/clone -> 调 projectStore.createProjectIdempotent(
//       kind: 'video', title: '模板 <name> 复制' ), usageStats.incrementDownload
//   * 鉴权: 公开 GET 无需登录, 复制需要 authenticateOwner
//   * usageStats 真持久化 likes/downloads
//
// 不做的事:
//   * 不写 db schema, 不改 projects 字段
//   * 不计费 (clone 是免费行为, 后续生成才计费)
//   * 不触发 AI 供应商调用

import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { loadUsageStats } from './usageStats.mjs';

export const PUBLIC_TEMPLATE_CATALOG = Object.freeze([
  { id: 'tpl-001', cat: 'product-main', name: '薯包经典白底', creator: '薯包官方', summary: '商品主图白底标准方案, 适合服饰/3C 通用主图' },
  { id: 'tpl-002', cat: 'product-main', name: '薯包高级暖光', creator: '薯包官方', summary: '主图暖光, 适合美妆/家居/食材等需要温度感的商品' },
  { id: 'tpl-003', cat: 'product-scene', name: '客厅一角', creator: '薯包官方', summary: '客厅一角静物场景, 适合家具/小家电/装饰画' },
  { id: 'tpl-004', cat: 'product-scene', name: '厨房台面', creator: '薯包官方', summary: '厨房台面场景, 适合厨电/餐具/食材' },
  { id: 'tpl-005', cat: 'video-hook', name: '文字飞入开场', creator: '薯包官方', summary: '3 秒文字飞入, 适合种草带货开场' },
  { id: 'tpl-006', cat: 'video-hook', name: '镜头推近开场', creator: '薯包官方', summary: '0.5 秒推近, 适合美妆/3C 焦点开场' },
  { id: 'tpl-007', cat: 'video-camera', name: '360 环绕', creator: '薯包官方', summary: '6 秒 360 度环绕, 适合立体商品展示' },
  { id: 'tpl-008', cat: 'video-camera', name: '推拉变焦', creator: '薯包官方', summary: '推拉变焦 (Dolly Zoom), 适合制造空间感' },
  { id: 'tpl-009', cat: 'video-end', name: 'logo 出场', creator: '薯包官方', summary: '结尾 logo 出现, 适合品牌收口' },
  { id: 'tpl-010', cat: 'video-end', name: '价格标签弹出', creator: '薯包官方', summary: '结尾价格标签, 适合促销 / 直播间切片' },
  { id: 'tpl-011', cat: 'tts', name: '知识口播', creator: '薯包官方', summary: '知识口播 8-12 秒, 适合科普/教程类视频' },
  { id: 'tpl-012', cat: 'tts', name: '种草带货', creator: '薯包官方', summary: '种草带货 10-15 秒, 适合电商短视频' },
  { id: 'tpl-013', cat: 'caption', name: '弹入弹跳', creator: '薯包官方', summary: '字幕弹入弹跳, 适合俏皮/年轻化内容' },
  { id: 'tpl-014', cat: 'caption', name: '打字机效果', creator: '薯包官方', summary: '字幕打字机效果, 适合知识/教程/故事' },
  { id: 'tpl-015', cat: 'font', name: '衬线大字', creator: '薯包官方', summary: '衬线大字标题, 适合调性内容/品牌' },
  { id: 'tpl-016', cat: 'font', name: '无衬线科技', creator: '薯包官方', summary: '无衬线科技字, 适合 3C / 工具类' },
  { id: 'tpl-017', cat: 'theme', name: '清新自然', creator: '薯包官方', summary: '清新自然主题, 适合生活方式/美妆/家居' },
  { id: 'tpl-018', cat: 'theme', name: '高级暗调', creator: '薯包官方', summary: '高级暗调主题, 适合数码/汽车/奢侈品' },
]);

export const PUBLIC_TEMPLATE_CATEGORIES = Object.freeze([
  { key: 'product-main', label: '商品主图' },
  { key: 'product-scene', label: '商品场景' },
  { key: 'video-hook', label: '视频开场' },
  { key: 'video-camera', label: '视频运镜' },
  { key: 'video-end', label: '视频结尾' },
  { key: 'tts', label: '真人语音' },
  { key: 'caption', label: '字幕动效' },
  { key: 'font', label: '字体排版' },
  { key: 'theme', label: '整体风格' },
]);

// 静态 baseLikes / baseDownloads, 与 src/constants/publicTemplates.js 保持一致
export const PUBLIC_TEMPLATE_BASE_USAGE = Object.freeze({
  'tpl-001': { likes: 142, downloads: 89 },
  'tpl-002': { likes: 128, downloads: 76 },
  'tpl-003': { likes: 96, downloads: 64 },
  'tpl-004': { likes: 88, downloads: 52 },
  'tpl-005': { likes: 145, downloads: 102 },
  'tpl-006': { likes: 132, downloads: 95 },
  'tpl-007': { likes: 110, downloads: 78 },
  'tpl-008': { likes: 98, downloads: 67 },
  'tpl-009': { likes: 86, downloads: 54 },
  'tpl-010': { likes: 78, downloads: 48 },
  'tpl-011': { likes: 120, downloads: 88 },
  'tpl-012': { likes: 105, downloads: 72 },
  'tpl-013': { likes: 92, downloads: 65 },
  'tpl-014': { likes: 84, downloads: 56 },
  'tpl-015': { likes: 76, downloads: 50 },
  'tpl-016': { likes: 68, downloads: 44 },
  'tpl-017': { likes: 110, downloads: 80 },
  'tpl-018': { likes: 95, downloads: 68 },
});

function baseLikesMap() {
  const out = Object.create(null);
  for (const id of Object.keys(PUBLIC_TEMPLATE_BASE_USAGE)) {
    out[id] = PUBLIC_TEMPLATE_BASE_USAGE[id].likes;
  }
  return out;
}

function baseDownloadsMap() {
  const out = Object.create(null);
  for (const id of Object.keys(PUBLIC_TEMPLATE_BASE_USAGE)) {
    out[id] = PUBLIC_TEMPLATE_BASE_USAGE[id].downloads;
  }
  return out;
}

function findTemplate(tplId) {
  if (!tplId) return null;
  return PUBLIC_TEMPLATE_CATALOG.find(t => t.id === tplId) || null;
}

function decorateUsage(template, stats) {
  if (!template) return template;
  const live = stats.snapshot(template.id);
  return { ...template, likes: live.likes, downloads: live.downloads };
}

export function listPublicTemplates({ stats, cat = 'all', sort = 'popular', limit, offset } = {}) {
  if (!stats) throw new TypeError('usage stats is required');
  let rows = PUBLIC_TEMPLATE_CATALOG.slice();
  if (cat && cat !== 'all') {
    rows = rows.filter(t => t.cat === cat);
  }
  rows = rows.map(t => decorateUsage(t, stats));
  if (sort === 'likes') {
    rows.sort((a, b) => b.likes - a.likes);
  } else if (sort === 'downloads') {
    rows.sort((a, b) => b.downloads - a.downloads);
  } else if (sort === 'newest') {
    // 静态目录没有 createdAt, 退化为按 id 倒序 (id 含数字后缀)
    rows.sort((a, b) => String(b.id).localeCompare(String(a.id)));
  } else {
    // popular = likes + 2*downloads 热度
    rows.sort((a, b) => (b.likes + 2 * b.downloads) - (a.likes + 2 * a.downloads));
  }
  const total = rows.length;
  const off = Math.max(0, Number(offset) || 0);
  const lim = Math.max(1, Math.min(50, Number(limit) || 18));
  const page = rows.slice(off, off + lim);
  return { items: page, total, offset: off, limit: lim, sort, cat };
}

export function getPublicTemplateWithUsage({ stats, tplId }) {
  if (!stats) throw new TypeError('usage stats is required');
  const tpl = findTemplate(tplId);
  if (!tpl) return null;
  return decorateUsage(tpl, stats);
}

export function listPopularTemplates({ stats, limit = 4 } = {}) {
  const { items } = listPublicTemplates({ stats, sort: 'popular', limit });
  return items;
}

export async function clonePublicTemplate({ stats, projectStore, ownerEmail, tplId, idempotencyKey }) {
  if (!stats) throw new TypeError('usage stats is required');
  if (!projectStore || typeof projectStore.createProjectIdempotent !== 'function') {
    throw new TypeError('projectStore.createProjectIdempotent is required');
  }
  if (!ownerEmail) {
    const err = new Error('owner is required');
    err.code = 'AUTH_SESSION_INVALID';
    throw err;
  }
  const tpl = findTemplate(tplId);
  if (!tpl) {
    const err = new Error('template not found');
    err.code = 'TEMPLATE_NOT_FOUND';
    throw err;
  }
  const finalKey = String(idempotencyKey || `tpl-clone-${tplId}-${randomUUID()}`).trim();
  const value = projectStore.createProjectIdempotent({
    ownerEmail,
    idempotencyKey: finalKey,
    kind: 'video',
    title: `模板 ${tpl.name} 复制`,
  });
  // 复制计数 = downloads 真持久化 (仅非 replayed 路径才增加)
  if (!value?.replayed) {
    await stats.incrementDownload(tplId);
  }
  const project = value?.project?.id ? value.project : value;
  const live = stats.snapshot(tplId);
  return {
    projectId: project?.id || null,
    templateId: tplId,
    templateName: tpl.name,
    templateCategory: tpl.cat,
    title: project?.title || `模板 ${tpl.name} 复制`,
    projectKind: project?.kind || 'video',
    downloads: live.downloads,
    likes: live.likes,
    replayed: Boolean(value?.replayed),
  };
}

export function loadDefaultUsageStats({ rootDir } = {}) {
  const filePath = resolve(rootDir || process.cwd(), 'server', 'templates', '.usage-stats.json');
  return loadUsageStats({
    filePath,
    baseLikes: baseLikesMap(),
    baseDownloads: baseDownloadsMap(),
  });
}

export function mountPublicTemplateRoutes(app, { authenticateOwner, projectStore, usageStats, runtime } = {}) {
  if (!app || typeof app.get !== 'function') throw new TypeError('app must be an express app');
  if (!projectStore) throw new TypeError('projectStore is required');
  if (!usageStats) throw new TypeError('usageStats is required');

  app.get('/api/templates/public', (req, res) => {
    try {
      const cat = typeof req.query.cat === 'string' ? req.query.cat.trim() : 'all';
      const sort = typeof req.query.sort === 'string' ? req.query.sort.trim() : 'popular';
      const limit = req.query.limit != null ? Number(req.query.limit) : 18;
      const offset = req.query.offset != null ? Number(req.query.offset) : 0;
      if (cat !== 'all' && !PUBLIC_TEMPLATE_CATEGORIES.find(c => c.key === cat)) {
        return res.status(400).json({ code: 'TEMPLATE_CAT_INVALID', error: '类目参数无效' });
      }
      const data = listPublicTemplates({ stats: usageStats, cat, sort, limit, offset });
      return res.json({
        ok: true,
        items: data.items,
        total: data.total,
        offset: data.offset,
        limit: data.limit,
        sort: data.sort,
        cat: data.cat,
        categories: PUBLIC_TEMPLATE_CATEGORIES,
      });
    } catch (error) {
      return res.status(500).json({ code: 'TEMPLATE_LIST_FAILED', error: error?.message || 'list failed' });
    }
  });

  app.get('/api/templates/public/:tplId', (req, res) => {
    try {
      const tpl = getPublicTemplateWithUsage({ stats: usageStats, tplId: req.params.tplId });
      if (!tpl) return res.status(404).json({ code: 'TEMPLATE_NOT_FOUND', error: '模板不存在' });
      return res.json({ ok: true, template: tpl });
    } catch (error) {
      return res.status(500).json({ code: 'TEMPLATE_GET_FAILED', error: error?.message || 'get failed' });
    }
  });

  app.post('/api/templates/public/:tplId/clone', async (req, res) => {
    try {
      if (typeof authenticateOwner !== 'function') {
        return res.status(500).json({ code: 'AUTH_UNAVAILABLE', error: 'auth not configured' });
      }
      let ownerEmail = '';
      try {
        const out = authenticateOwner(req);
        ownerEmail = typeof out === 'string' ? out : out?.email;
      } catch (authError) {
        if (authError?.code && /^AUTH_SESSION_/i.test(authError.code)) {
          return res.status(401).json({ code: authError.code, error: authError.message || '请先登录后再复制模板' });
        }
        throw authError;
      }
      if (!ownerEmail) {
        return res.status(401).json({ code: 'AUTH_SESSION_INVALID', error: '请先登录后再复制模板' });
      }
      const tplId = req.params.tplId;
      if (!findTemplate(tplId)) {
        return res.status(404).json({ code: 'TEMPLATE_NOT_FOUND', error: '模板不存在' });
      }
      const idempotencyKey = req.headers?.['idempotency-key'] || req.headers?.['Idempotency-Key'] || req.body?.idempotencyKey;
      const result = await clonePublicTemplate({
        stats: usageStats,
        projectStore,
        ownerEmail,
        tplId,
        idempotencyKey,
      });
      if (runtime?.log) runtime.log(`[public-templates] cloned ${tplId} -> project ${result.projectId} (replayed=${result.replayed})`);
      return res.status(result.replayed ? 200 : 201).json({ ok: true, ...result });
    } catch (error) {
      if (error?.code === 'TEMPLATE_NOT_FOUND') {
        return res.status(404).json({ code: 'TEMPLATE_NOT_FOUND', error: '模板不存在' });
      }
      if (error?.code === 'IDEMPOTENCY_CONFLICT') {
        return res.status(409).json({ code: 'IDEMPOTENCY_CONFLICT', error: '请求标识已用于其他项目, 请重新操作' });
      }
      if (error?.code === 'IDEMPOTENCY_KEY_REQUIRED') {
        return res.status(400).json({ code: 'IDEMPOTENCY_KEY_REQUIRED', error: '请求标识缺失, 请重试' });
      }
      return res.status(500).json({ code: 'TEMPLATE_CLONE_FAILED', error: error?.message || 'clone failed' });
    }
  });
}
