// 4c183cd4 续命 P-H 画布 1-click 拖入素材 (3 路: 商品档案 / 公共素材库 / 用户上传)
//
// 1-click 拖入 = 用户在悬浮按钮里点一下, 直接拉出可拖动的"素材卡",
// 用户把它拖到画布节点(ImageNode)或 EcStudio 的 ImageUploader 区域即可落入。
//
// 3 路素材来源:
//   1) 商品档案 (listProductProfiles)  → 选 profile → 取其 assets
//   2) 公共素材库 (listPublicTemplates) → 选 template cover/reference (用 /api/templates/public)
//   3) 用户上传 (uploadEcommerceAsset) → 浏览器本地 File 走 multipart
//
// 落点 API 约定: 拖入成功后, 落点会调 onDropAsset({source, ref, blobUrl, dataUrl})。
// 1-click 拖入的 API 客户端不直接写后端 (沿用既有 services: projects.js, api.js, publicTemplates 路径),
// 这里只暴露"哪三路、按 source 分类、获取可用素材"的纯函数, 供 UI 使用。
//
// 不做的事:
//   * 不写后端路由 (复用既有 /api/product-profiles, /api/templates/public, /api/ecommerce/upload)
//   * 不修改 projects.js / api.js
//   * 不直接调 drop target, 只暴露 data

import {
  listProductProfiles,
  getProductProfile,
  listProjectAssetLibrary,
} from './projects.js';
import { uploadEcommerceAsset, proxyImg } from './api.js';

export const ASSET_DRAG_SOURCES = Object.freeze({
  PRODUCT_PROFILE: 'product-profile',
  PUBLIC_TEMPLATE: 'public-template',
  USER_UPLOAD: 'user-upload',
});

export const ASSET_DRAG_SOURCE_LABELS = Object.freeze({
  [ASSET_DRAG_SOURCES.PRODUCT_PROFILE]: '商品档案',
  [ASSET_DRAG_SOURCES.PUBLIC_TEMPLATE]: '公共素材库',
  [ASSET_DRAG_SOURCES.USER_UPLOAD]: '本地上传',
});

// ── 工具函数 ────────────────────────────────────────────────────────────

export function isAssetDragSource(value) {
  return Object.values(ASSET_DRAG_SOURCES).includes(value);
}

export function normalizeAssetDragPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const source = String(payload.source || '').trim();
  if (!isAssetDragSource(source)) return null;
  const ref = String(payload.ref || '').trim();
  if (!ref) return null;
  const label = String(payload.label || ref).trim();
  const mime = String(payload.mime || '').trim();
  const dataUrl = typeof payload.dataUrl === 'string' ? payload.dataUrl : '';
  const remoteUrl = typeof payload.remoteUrl === 'string' ? payload.remoteUrl : '';
  const thumbUrl = typeof payload.thumbUrl === 'string' ? payload.thumbUrl : remoteUrl;
  return { source, ref, label, mime, dataUrl, remoteUrl, thumbUrl };
}

// ── 路 1: 商品档案 ────────────────────────────────────────────────────
//
// 流程:
//   1. 调 listProductProfiles() 拿 profile 列表
//   2. 用户选一个 profile → 调 getProductProfile(id) 拿 detail
//   3. 提取 profile.assets 数组里 image 类型素材, 转成 1-click 拖入 payload
//
// 返回 [{ source, ref, label, mime, remoteUrl, thumbUrl, dataUrl: '' }]
//
export function pickProductProfileAssetPayloads(profile, { max = 12 } = {}) {
  if (!profile || typeof profile !== 'object') return [];
  const profileId = String(profile.id || profile.profileId || '').trim();
  if (!profileId) return [];
  const assets = Array.isArray(profile.assets) ? profile.assets : [];
  const out = [];
  for (const asset of assets) {
    if (!asset || typeof asset !== 'object') continue;
    const assetId = String(asset.id || asset.assetId || '').trim();
    if (!assetId) continue;
    const kind = String(asset.kind || asset.role || 'image').trim().toLowerCase();
    if (kind && !['image', 'product', 'reference', 'main', 'cover'].includes(kind) && kind !== 'image') continue;
    const remoteUrl = String(asset.url || asset.stableUrl || asset.thumbUrl || '').trim();
    const thumbUrl = String(asset.thumbUrl || asset.url || remoteUrl).trim();
    const mime = String(asset.mime || asset.mimeType || '').trim();
    const label = String(asset.label || asset.title || `${profileId} ${assetId}`).trim();
    out.push({
      source: ASSET_DRAG_SOURCES.PRODUCT_PROFILE,
      ref: `profile:${profileId}#${assetId}`,
      label,
      mime,
      remoteUrl,
      thumbUrl: thumbUrl || remoteUrl,
      dataUrl: '',
    });
    if (out.length >= max) break;
  }
  return out;
}

export async function loadProductProfileDragPayloads({ status = 'active', limit = 50 } = {}) {
  const profiles = await listProductProfiles({ status, limit });
  if (!Array.isArray(profiles) || profiles.length === 0) return [];
  const all = [];
  for (const profile of profiles) {
    const detail = await getProductProfile(profile.id || profile.profileId);
    const payloads = pickProductProfileAssetPayloads(detail);
    for (const payload of payloads) all.push(payload);
  }
  return all;
}

// ── 路 2: 公共素材库 ────────────────────────────────────────────────────
//
// 公共素材库 (/api/templates/public) 主要是视频/文本类模板, 但部分 cat
// (product-main / product-scene) 提供 image-style 参考; 我们把它们封装成可拖入的
// payload, 拖入时拿到 thumbUrl 即可。
//
// 这里直接 fetch, 不强行 import server-only 模块。
//
export async function loadPublicTemplateDragPayloads({
  cats = ['product-main', 'product-scene'],
  limit = 12,
  fetchImpl = typeof fetch === 'function' ? fetch.bind(globalThis) : null,
} = {}) {
  const fetcher = fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  if (!fetcher) return [];
  const url = '/api/templates/public?cat=' + encodeURIComponent(cats.join(',')) + '&limit=' + Math.max(1, Math.min(limit, 50));
  const response = await fetcher(url, { headers: { Accept: 'application/json' } });
  if (!response || !response.ok) return [];
  const body = await response.json().catch(() => null);
  if (!body || typeof body !== 'object') return [];
  const items = Array.isArray(body.items) ? body.items : Array.isArray(body.templates) ? body.templates : [];
  return items.slice(0, limit).map((item) => {
    const tplId = String(item.id || item.tplId || '').trim();
    if (!tplId) return null;
    const remoteUrl = String(item.thumbUrl || item.previewUrl || item.cover || '').trim();
    const label = String(item.name || tplId).trim();
    const cat = String(item.cat || '').trim();
    return {
      source: ASSET_DRAG_SOURCES.PUBLIC_TEMPLATE,
      ref: `tpl:${tplId}`,
      label,
      mime: 'image/*',
      remoteUrl,
      thumbUrl: remoteUrl,
      dataUrl: '',
      cat,
    };
  }).filter(Boolean);
}

// ── 路 3: 用户上传 (本机 File → dataURL → 可拖入) ──────────────────────
//
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('请选择图片文件'));
    if (!/^image\//.test(String(file.type || ''))) return reject(new Error('仅支持图片格式'));
    const reader = new FileReader();
    reader.onload = (e) => resolve(String(e.target?.result || ''));
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });
}

export async function buildUserUploadDragPayload(file) {
  if (!file) throw new Error('请选择图片文件');
  const dataUrl = await fileToDataUrl(file);
  const name = String(file.name || '本地上传').trim();
  return {
    source: ASSET_DRAG_SOURCES.USER_UPLOAD,
    ref: `local:${name}#${Date.now()}`,
    label: name,
    mime: String(file.type || '').trim(),
    remoteUrl: '',
    thumbUrl: dataUrl,
    dataUrl,
  };
}

// ── 1-click 拖入 → 真正落到项目素材库 ───────────────────────────────────
//
// 1-click 拖入的"落点"通常只是把 dataURL/URL 推给画布节点的 onDrop handler。
// 如果落点需要持久化到项目素材库, 走 listProjectAssetLibrary / importImageAssetToProject。
// 这里 export 一个轻量 helper: 把 payload 调 importImageAssetToProject。
//
export async function importDragPayloadToProject(projectId, payload, deps = {}) {
  const normalized = normalizeAssetDragPayload(payload);
  if (!normalized) throw new Error('素材信息不完整');
  if (!projectId) throw new Error('请选择项目');
  const { importImageAssetToProject } = deps;
  if (typeof importImageAssetToProject !== 'function') return null;
  if (normalized.dataUrl) {
    return importImageAssetToProject(projectId, { dataUrl: normalized.dataUrl, label: normalized.label });
  }
  if (normalized.remoteUrl) {
    return importImageAssetToProject(projectId, { url: normalized.remoteUrl, label: normalized.label });
  }
  return null;
}

// ── 摘要: 给 UI 1-click 按钮的"三路入口" ───────────────────────────────
//
export const ASSET_DRAG_PRESET_BUTTONS = Object.freeze([
  { key: ASSET_DRAG_SOURCES.PRODUCT_PROFILE, label: '从商品档案', icon: '📦' },
  { key: ASSET_DRAG_SOURCES.PUBLIC_TEMPLATE, label: '从公共素材库', icon: '🎨' },
  { key: ASSET_DRAG_SOURCES.USER_UPLOAD, label: '本地上传', icon: '⬆️' },
]);

// 暴露给 test 用的 internal helper
export const __testing = {
  pickProductProfileAssetPayloads,
  isAssetDragSource,
  normalizeAssetDragPayload,
  buildUserUploadDragPayload,
};
