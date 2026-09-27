/* ═══ 「存到我的资产」——把一条生成记录里的图收进资产库（2026-09-27 批 CD）══════════════════════
   用户口径（逐字）：「是不是会有……**导入到我的资产**里面的功能？」

   ── 先纠正我自己上一轮说错的一句话（已核查）──────────────────────────────────
   我上一轮写"或者让用户每次都选一个项目（多一步）"——**这句是错的**：
   这个站里**根本没有让用户手动建项目的入口**（用户上一轮点出来的正是这一点）。
   核查结果：
     · `projects` 只由几条链路**隐式**产生：画布媒体保存（`createProject({kind:'ecommerce'|'video',
       title:'Canvas 媒体项目', idempotencyKey:'canvas-media:…'})`）、视频项目/导演台/视频交付弹窗；
     · `project_assets.project_id` 是 **NOT NULL + 外键**（`server/projects/schema.mjs`）⇒
       资产**不可能**不挂在项目下，也就没有"无项目的资产"这种落点；
     · 「我的资产」那一栏是**跨项目**的资产视图（卡片上带所属项目名），没有项目选择器。
   ⇒ 所以正确做法是照**站内已有的隐式建项目**那套：**自动建/复用一个专属项目**（幂等键写死，
     重复点不会越建越多），再把生成图注册进去并设成"在资产库可见"。

   ── 为什么标题叫「生成作品」而 kind 选 ecommerce ──────────────────────────────
     · 标题给用户看（它会显示在这张资产的副标题里），所以用**人话**：「生成作品」；
     · `kind` 只有四种（ecommerce / xiaohongshu / plog / video，`projectStore.PROJECT_KINDS`），
       生成图**没有**"通用图片"这一档；画布那条链路对图片也是取 `ecommerce`，这里**照它**，
       保持一致而不是自创第五种 kind（那会把项目列表的语义弄乱）。
   ── 幂等 ────────────────────────────────────────────────────────────────────
     ① 项目：先按标题找，找不到才建，且 createProject 带固定 idempotencyKey；
     ② 资产：先看资产库里有没有同一个 `stableUrl`，有就跳过 —— 重复点不会堆一堆重复素材。 */
import {
  addToProjectAssetLibrary,
  createProject,
  listProjectAssetLibrary,
  listProjects,
  registerGeneratedAssetToProject,
} from '../../services/projects.js';

export const GENERATED_PROJECT_TITLE = '生成作品';
const GENERATED_PROJECT_KEY = 'generated-assets-project';

/* 生成图的地址形如 `/api/generated-assets/<64hex>.png`（与 billing/contentEntitlements 同一形态）。 */
const GENERATED_URL_RE = /\/api\/generated-assets\/([a-f0-9]{64}\.(?:jpg|png|webp))$/i;

export function generatedAssetIdOf(url) {
  const matched = GENERATED_URL_RE.exec(String(url || '').trim());
  return matched ? matched[1] : '';
}

/* 这条记录里**能进资产库**的图（去重、只认生成图那种地址）。 */
export function assetUrlsOfWork(urls = []) {
  const seen = new Set();
  const out = [];
  for (const url of Array.isArray(urls) ? urls : []) {
    const id = generatedAssetIdOf(url);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, url: String(url).trim() });
  }
  return out;
}

export async function ensureGeneratedProject() {
  const projects = await listProjects().catch(() => []);
  const found = (Array.isArray(projects) ? projects : [])
    .find(project => String(project?.title || '').trim() === GENERATED_PROJECT_TITLE);
  if (found?.id) return found.id;
  const created = await createProject({
    kind: 'ecommerce',
    title: GENERATED_PROJECT_TITLE,
    idempotencyKey: GENERATED_PROJECT_KEY,
  });
  if (!created?.id) throw new Error('暂时无法准备资产库，请稍后重试');
  return created.id;
}

/**
 * 把一组生成图存进「我的资产」。
 * @returns {{ added: number, skipped: number, failed: number }}
 */
export async function saveGeneratedUrlsToAssets(urls = [], { title = '' } = {}) {
  const items = assetUrlsOfWork(urls);
  if (!items.length) return { added: 0, skipped: 0, failed: 0 };
  const projectId = await ensureGeneratedProject();
  /* 已经在库里的（同一个 stableUrl）跳过 —— 重复点是常态（用户会连点两次确认） */
  const library = await listProjectAssetLibrary({ limit: 500 }).catch(() => []);
  const known = new Set((Array.isArray(library) ? library : [])
    .map(asset => generatedAssetIdOf(asset?.stableUrl || asset?.url || ''))
    .filter(Boolean));
  let added = 0;
  let skipped = 0;
  let failed = 0;
  for (const item of items) {
    if (known.has(item.id)) { skipped += 1; continue; }
    try {
      const asset = await registerGeneratedAssetToProject(projectId, {
        assetId: item.id,
        stableUrl: item.url,
        role: 'generated',
        metadata: { source: 'media-history', title: String(title || '').slice(0, 120) },
      });
      await addToProjectAssetLibrary(projectId, asset.projectAssetId, true);
      known.add(item.id);
      added += 1;
    } catch {
      failed += 1;
    }
  }
  return { added, skipped, failed };
}
