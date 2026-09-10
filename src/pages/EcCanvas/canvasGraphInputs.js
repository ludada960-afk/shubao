/* ═══════ P0 · 边 = 数据通道 (能力地图 N2 / master-plan §3.3) ═══════
   现状: 手拉线只往 connections 里加一条边, 执行永远读 node.sourceNodeIds[0],
        边只是视觉关系 —— 图里的数据不流动。
   本模块把"入边"翻译成执行输入: 按入边顺序收集上游产物, 每个模态各自从 1 编号
   (master-plan §3.5.2 知渔规则: 入边顺序 = @图片1/@图片2 的编号顺序, 变量就是连线位置)。

   硬约束 (改这个文件前先读):
   - 纯函数 / 零外部依赖 / 无副作用: fetch、setState 一律留在 index.jsx;
   - 入边顺序 = connections 数组里"指向本节点"的边出现顺序 (用户建边顺序, 不排序);
   - 同一上游只算一次 (同一对节点可能同时有 derived + reference 两条边);
   - 没有入边时必须返回空结构, 调用方原样回退 sourceNodeIds[0] 老逻辑 —— 老图行为逐字节不变。*/

import { NODE_TYPE_KIND } from './canvasQuantvExtensions.js';

/* 文本类节点: NODE_TYPE_KIND 只登记了 text / text-composer, 字幕节点 (subtitle) 也是文本产物。*/
const TEXT_KINDS = new Set(['text', 'text-composer', 'subtitle']);

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|avi|mkv|m3u8)(?:[?#]|$)/i;
const AUDIO_EXT = /\.(mp3|wav|m4a|aac|ogg|flac|opus)(?:[?#]|$)/i;
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp|avif|tiff?|svg)(?:[?#]|$)/i;

/* output 里指向"产出节点"的引用最多再递归两层, 防手写脏数据成环。*/
const MAX_OUTPUT_DEPTH = 2;

export function createEmptyNodeInputs() {
  return { images: [], texts: [], videos: [], audios: [], sources: [] };
}

function cleanUrl(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/* 从产物地址猜模态: 只在 kind 说不清 (未知 kind / application 容器) 或与 kind 冲突时兜底。*/
function mediaTypeFromUrl(url) {
  if (!url) return '';
  if (VIDEO_EXT.test(url)) return 'video';
  if (AUDIO_EXT.test(url)) return 'audio';
  if (IMAGE_EXT.test(url)) return 'image';
  return '';
}

/* 上游节点产出的模态。复用 canvasQuantvExtensions 的 NODE_TYPE_KIND (端口类型系统的唯一真源),
   application 是容器节点 (类型不可靠), 交给产物地址判定。返回 '' = 无法判定。*/
function resolveNodeModality(node) {
  const kind = String(node?.kind || '');
  if (TEXT_KINDS.has(kind)) return 'text';
  const declared = NODE_TYPE_KIND[kind];
  if (declared === 'text' || declared === 'image' || declared === 'video' || declared === 'audio') return declared;
  return '';
}

/* 上游文本产物: 文本节点是 node.text, 生成文案落在 node.text / node.inputs.text。
   只认非空文本 (空白串当没有, 对齐 findUpstreamCanvasCopy 的判定)。*/
function resolveNodeText(node) {
  const candidates = [node?.text, node?.inputs?.text, node?.content, node?.output?.text];
  for (const candidate of candidates) {
    const text = typeof candidate === 'string' ? candidate.trim() : '';
    if (text) return text;
  }
  return '';
}

/* 上游媒体产物地址, 按"节点自己 > 多素材 assets > output 产物"的顺序去重收集。
   - 素材节点的产物在 node.url;
   - source_group 一个节点带多张图 (node.assets);
   - 处理/生成节点的产物在 node.output ({url} 或 {urls} 或 {nodeId/nodeIds} 指向产出节点)。*/
function resolveNodeProducedUrls(node, nodeById, depth = 0) {
  const urls = [];
  const push = value => {
    const url = cleanUrl(value);
    if (url && !urls.includes(url)) urls.push(url);
  };
  push(node?.url);
  for (const asset of Array.isArray(node?.assets) ? node.assets : []) push(asset?.url || asset?.stableUrl);
  const output = node?.output;
  if (output && typeof output === 'object') {
    for (const url of Array.isArray(output.urls) ? output.urls : []) push(url);
    push(output.url);
    if (depth < MAX_OUTPUT_DEPTH) {
      const producedIds = [
        ...(Array.isArray(output.nodeIds) ? output.nodeIds : []),
        output.nodeId,
      ];
      for (const producedId of producedIds) {
        const produced = nodeById.get(String(producedId || ''));
        if (!produced || produced === node) continue;
        for (const url of resolveNodeProducedUrls(produced, nodeById, depth + 1)) push(url);
      }
    }
  }
  return urls;
}

/* 一个上游节点贡献的产物列表 (可能多个: 套图节点输出 N 张图)。*/
function resolveUpstreamAssets(node, nodeById) {
  const modality = resolveNodeModality(node);
  if (modality === 'text') {
    const content = resolveNodeText(node);
    return content ? [{ type: 'text', content }] : [];
  }
  const assets = [];
  for (const url of resolveNodeProducedUrls(node, nodeById)) {
    /* 地址自带后缀时以地址为准 (视频节点挂 .mp4), 否则用节点声明的模态。*/
    const type = mediaTypeFromUrl(url) || modality;
    if (!type) continue;
    assets.push({ type, url });
  }
  return assets;
}

/* 主入口: 按入边顺序把上游输出收集成执行输入。
   返回 { images:[{nodeId,url,index}], texts:[{nodeId,content,index}],
          videos:[{nodeId,url,index}], audios:[{nodeId,url,index}], sources:[nodeId...] }
   index 是该模态内的 1-based 编号 (= @图片N / @文本N)。
   sources 记录所有能解析到节点的上游 id (含暂无产物的), 顺序同入边顺序。*/
export function collectNodeInputsFromEdges(node, connections = [], nodes = []) {
  const inputs = createEmptyNodeInputs();
  const nodeId = String(typeof node === 'string' ? node : node?.id || '');
  if (!nodeId) return inputs;

  const nodeById = new Map();
  for (const item of Array.isArray(nodes) ? nodes : []) {
    if (item?.id == null) continue;
    const key = String(item.id);
    if (!nodeById.has(key)) nodeById.set(key, item);
  }

  const seenSourceIds = new Set();
  for (const connection of Array.isArray(connections) ? connections : []) {
    if (!connection || typeof connection !== 'object') continue;
    const toId = String(connection.toNodeId || connection.to || '');
    if (toId !== nodeId) continue;
    const fromId = String(connection.fromNodeId || connection.from || '');
    if (!fromId || fromId === nodeId) continue;         /* 自环不是输入 */
    if (seenSourceIds.has(fromId)) continue;            /* 同一上游多条边只算一次, 编号不重复 */
    const upstream = nodeById.get(fromId);
    if (!upstream) continue;                            /* 悬空边 (上游已删) 忽略, 不炸执行 */
    seenSourceIds.add(fromId);
    inputs.sources.push(fromId);
    for (const asset of resolveUpstreamAssets(upstream, nodeById)) {
      if (asset.type === 'text') inputs.texts.push({ nodeId: fromId, content: asset.content, index: inputs.texts.length + 1 });
      else if (asset.type === 'video') inputs.videos.push({ nodeId: fromId, url: asset.url, index: inputs.videos.length + 1 });
      else if (asset.type === 'audio') inputs.audios.push({ nodeId: fromId, url: asset.url, index: inputs.audios.length + 1 });
      else inputs.images.push({ nodeId: fromId, url: asset.url, index: inputs.images.length + 1 });
    }
  }
  return inputs;
}
