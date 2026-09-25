/* 批 BO：**分辨率支持审计** —— 我们所有能接入的视频通道，上游到底支持哪些分辨率？
   数据源：上游 `GET https://api-new.ip233.com/api/pricing`（今天从生产机用 VIDEO_API_KEY 抓到，
   落档 .tmp/bm6/upstream-pricing.json，pricing_version=ip233-route-v2）。
   为什么要这份表：用户问「除 720p 之外到底该开 480 还是 1080？能不能同时都有？1080 是不是都有？」
   —— 答案只能从上游每条通道自己写的说明里逐条核，不能猜。 */
import fs from 'node:fs';

const pricing = JSON.parse(fs.readFileSync('.tmp/bm6/upstream-pricing.json', 'utf8'));
const rows = new Map(pricing.data.map(r => [r.model_name, r]));

/* 项目目录里"能接入"的产品 → 它走的上游路由（routeId） */
const PRODUCTS = [
  ['seedance_fast', 'agv-seedance2.0fast', '720p'],
  ['seedance_standard', 'seedance-2.0', '720p'],
  ['sd_js900', 'sd-2.0-js900', '720p'],
  ['sd_js', 'sd-2.0-js', '720p'],
  ['seedance_25', 'sd-2.5-js2', '720p'],
  ['seedance_mini', 'seedance-2.0-mini', '720p,480p'],
  ['seedance_1080p', 'seedance-2.0-1080p', '1080p(隐藏)'],
  ['minimax_h3_768p', 'minimax-h3', '720p,480p(本轮)'],
  ['minimax_h3_2k', 'xn-minimax-h3', '2k'],
  ['wan_standard', 'xn-wan3.0', '720p,480p'],
  ['wan_1080p', 'xn-wan3.0', '1080p'],
  ['kling_standard', 'kling-3.0', '720p'],
  ['kling_pro', 'kling-3.0-pro', '720p'],
  ['grok_fast', 'grok-imagine-video', '720p(隐藏)'],
  ['veo_fast', 'veo-3.1-fast', '720p(隐藏)'],
];

const RES = /(\d{3,4}p)/gi;
console.log('产品 | 上游路由 | 目录现状 | 上游说明里出现过的分辨率 | 原文');
console.log('---|---|---|---|---');
for (const [id, route, current] of PRODUCTS) {
  const row = rows.get(route);
  const desc = String(row?.description || '');
  const found = [...new Set((desc.match(RES) || []).map(s => s.toLowerCase()))].sort();
  console.log([id, route, current, found.length ? found.join('/') : '（说明里没写）', desc.slice(0, 96).replace(/\|/g, '/')].join(' | '));
}

console.log('\n=== 上游有没有专门的"分辨率档位/参数"字段 ===');
const sample = rows.get('xn-wan3.0');
console.log('xn-wan3.0 的全部键：', Object.keys(sample).join(', '));
console.log('是否有 api_doc / parameters 字段：',
  Object.keys(sample).some(k => /doc|param|resolution/i.test(k)) ? '有' : '**没有**（只有 description 一句自然语言 + 单价）');

console.log('\n=== 有没有别的模型能出 1080p / 2K（全站 115 条里的视频类） ===');
const videoish = pricing.data.filter(r => Array.isArray(r.supported_endpoint_types) && r.supported_endpoint_types.includes('openai-video'));
for (const row of videoish) {
  const desc = String(row.description || '');
  const found = [...new Set((desc.match(/\d{3,4}p/gi) || []).map(s => s.toLowerCase()))].sort().join('/');
  console.log([row.model_name, row.model_price, found || '（未写）'].join(' | '));
}
