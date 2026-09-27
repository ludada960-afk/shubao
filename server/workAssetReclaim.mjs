/* ═══ 过期作品的媒体回收（2026-09-26 批 CA）══════════════════════════════════════════════════
   用户口径（逐字）：「保留期要不要清理，其实**取决于我们服务器压力大不大**，我觉得如果生成太多
   肯定是要清理的，但**你留下一张灰卡 + 已过期这个会影响服务器内存吗**……这块你说成本会比较低，那你就做吧。」

   ── 先说清一件事：清理这件事在线上**从来没有真的发生过** ───────────────────────────
   实测（2026-09-26 生产）：
     · `[retention] startup sweep {... "dryRun":true}` —— 启动只做**统计**，
       因为 `RETENTION_PURGE_ENABLED` 没在生产环境里设过；界面却一直写着「作品保留 7 天」；
     · 就算把 purge 打开，原实现也**只删数据库行**（`DELETE FROM works`），
       **一个图片文件都不删** —— 而占空间的正是文件：`server/generated-assets` = **7.5 GB / 2047 个文件**。
   ⇒ 所以这一批做两件事，缺一不可：
       ① **墓碑**（灰卡）：到期不再整行删，改成"清空媒体字段 + 记 `expired_at`"，
          让历史里能如实显示「已过期」，回答用户"我的东西哪去了"；
       ② **回收文件**：把这条作品**独占**的图片文件删掉（这是真正恢复空间的那一步）。

   ── 删除的安全边界（宁可少删，绝不误删）──────────────────────────────────────
   · 只处理 `/api/generated-assets/<64hex>.(png|jpg|webp)` 这一种地址形态；
   · 文件名必须逐字匹配这个正则（防目录穿越：`../`、绝对路径、查询串一律不认）；
   · **引用计数**：只要还有**别的未过期作品**、**项目资产（我的资产）**、**视频资产**引用它，就不删；
   · 只删 `generated-assets` 目录里的文件 —— 上传件、项目资产、视频产物都不在这个目录，天然不会被碰到；
   · 白名单作者的作品**根本不进这条流程**（`pruneExpiredWorks` 先按白名单过滤）。

   决策部分是**纯函数**（`planAssetReclaim`），所以能拿门禁直接跑；真正删文件的那层很薄。 */
import { existsSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

/* 我们**唯一**认的资产地址形态。⚠️ 与 server/billing/contentEntitlements.mjs 里的同名正则同源，
   改一处就要改另一处（门禁会核对这两处逐字一致）。 */
export const GENERATED_ASSET_URL_RE = /^\/api\/generated-assets\/([a-f0-9]{64}\.(?:jpg|png|webp))$/;

/* 把一条作品记录里出现过的**媒体地址**都收集出来（封面 / 多图 / pages / payload 里嵌的 JSON…）。
   ⚠️⚠️ 这里的"字符串也可能是 JSON"必须处理 —— 这是**生产 dry-run 抓出来的真缺陷**：
     数据库里的行是**原始行**（`image_urls` / `pages` / `payload` 都是 **JSON 字符串**），
     第一版只对整串做锚定正则（`^/api/generated-assets/…$`）⇒ **一个候选都找不到**，
     于是"清理"会变成"立了墓碑、文件一个没删"——空间问题根本没解决（实测：可删文件 = 0）。
   ⇒ 现在：字符串先当单个地址试；不像地址就看它像不像 JSON，是 JSON 就解析后递归（带深度上限）。 */
const MAX_DEPTH = 8;

export function collectWorkAssetUrls(work) {
  const found = new Set();
  const push = (value, depth = 0) => {
    if (depth > MAX_DEPTH) return;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      const matched = GENERATED_ASSET_URL_RE.exec(trimmed);
      if (matched) { found.add(matched[1]); return; }
      const head = trimmed[0];
      if (head === '{' || head === '[') {
        try { push(JSON.parse(trimmed), depth + 1); } catch { /* 不是 JSON 就算了 */ }
      }
      return;
    }
    if (Array.isArray(value)) { for (const item of value) push(item, depth + 1); return; }
    if (value && typeof value === 'object') { for (const item of Object.values(value)) push(item, depth + 1); }
  };
  if (!work || typeof work !== 'object') return [];
  for (const key of ['cover_url', 'coverUrl', 'image_urls', 'imageRecords', 'images', 'pages', 'url', 'poster', 'video_url', 'resultUrl',
    /* 原始行里图片地址多半就在 payload 这个 JSON 字符串里（实测：165 条里 70 条） */
    'payload', 'replay', 'projectAssetRefs', 'productAssets', 'referenceAssets', 'mediaAssets']) {
    push(work[key]);
  }
  return [...found];
}

/**
 * 决定"哪些文件可以删" —— 纯函数，不碰磁盘。
 * @param {object} input
 * @param {Array}  input.expiredWorks  已判定过期、准备回收的作品
 * @param {Array}  input.liveWorks     仍在保留期内的作品（**它们的引用要保留**）
 * @param {Array}  input.otherRefs     其它引用者（项目资产 / 视频资产 / 画布…）里的资产地址
 * @returns {{ deletable: string[], keptByLive: string[], keptByOthers: string[] }}
 */
export function planAssetReclaim({ expiredWorks = [], liveWorks = [], otherRefs = [] } = {}) {
  const candidates = new Set();
  for (const work of expiredWorks) for (const name of collectWorkAssetUrls(work)) candidates.add(name);

  const protectedNames = new Set();
  const keptByOthers = new Set();
  for (const name of candidates) {
    for (const work of liveWorks) {
      if (collectWorkAssetUrls(work).includes(name)) { protectedNames.add(name); break; }
    }
  }
  const others = new Set();
  for (const ref of otherRefs) for (const name of collectWorkAssetUrls({ url: ref })) others.add(name);
  for (const name of candidates) {
    if (protectedNames.has(name)) continue;
    if (others.has(name)) keptByOthers.add(name);
  }
  const deletable = [...candidates].filter(name => !protectedNames.has(name) && !keptByOthers.has(name)).sort();
  return { deletable, keptByLive: [...protectedNames].sort(), keptByOthers: [...keptByOthers].sort() };
}

/**
 * 真删（薄薄一层）：只删 `assetDir` 下、名字逐字匹配正则的那些文件。
 * @returns {{ deleted: string[], bytes: number, missing: string[] }}
 */
export function deleteAssetFiles(names = [], assetDir = '') {
  const deleted = [];
  const missing = [];
  let bytes = 0;
  if (!assetDir) return { deleted, bytes, missing };
  for (const name of names) {
    if (!/^[a-f0-9]{64}\.(?:jpg|png|webp)$/.test(String(name || ''))) continue;   // 双保险：绝不拼路径
    const file = join(assetDir, name);
    if (!existsSync(file)) { missing.push(name); continue; }
    try {
      bytes += statSync(file).size;
      unlinkSync(file);
      deleted.push(name);
    } catch {
      /* 单个文件删不掉（权限/占用）不该让整轮回收失败：留着下一轮再来。 */
    }
  }
  return { deleted, bytes, missing };
}
