/* ═══ 视频素材的两种形状转换（2026-09-27 批 CE）════════════════════════════════════════════════
   用户口径（逐字）：「而且重新生成是不是也要像做同款那样，**把素材和提示词和配置都填回去工作台**呢？」
   —— 这一块专门负责"**把素材带回去**"这件事的两个纯函数（页面与 gate 共用，放这里 node 才跑得起来：
   `.jsx` 文件 node 直接 import 会报 ERR_UNKNOWN_FILE_EXTENSION）。

   ── 两种形状 ─────────────────────────────────────────────────────────────
     ① 服务端任务记录的 `references`（`video_jobs.refs_json`）：
        `{ firstImage, lastImage, images: [id], videos: [id], audios: [id], urls: { id: url } }`
     ② 创作台提交时用的资产对象：`{ id, url, name }`（与**上传链路产出的形状一致**，
        所以带回来的素材能直接并进提交的 refs，不需要另开一条路径）。
   两个方向各一个函数：服务端 refs → 创作台（`videoJobMaterials`）、
   创作台 preset → 内部状态（`normalizePresetMaterials`，做校验与兜底）。 */

const RESTORED_KEYS = ['first', 'last', 'images', 'videos', 'audios'];
const KIND_LABEL = { first: '首帧', last: '尾帧', images: '图片', videos: '视频', audios: '音频' };

function emptyMaterials() {
  return { first: [], last: [], images: [], videos: [], audios: [] };
}

/* 创作台内部状态：`{first|last|images|videos|audios: [{id,url,name}]}`。
   ⚠️ 缺 id 或缺 url 的一律丢掉（给一张打不开的素材卡比不给更糟）；没有 materials 时给**空集合**
      （不能返回 undefined —— 调用方是 setState）。 */
export function normalizePresetMaterials(materials) {
  const source = materials && typeof materials === 'object' ? materials : {};
  const out = emptyMaterials();
  for (const key of RESTORED_KEYS) {
    const list = Array.isArray(source[key]) ? source[key] : [];
    out[key] = list
      .map((item, index) => ({
        id: String(item?.id || '').trim(),
        url: String(item?.url || '').trim(),
        name: String(item?.name || '').trim() || KIND_LABEL[key] + (index + 1),
      }))
      .filter(item => item.id && item.url);
  }
  return out;
}

/* 服务端任务记录 `references` → 创作台能吃的形状（同样的校验）。 */
export function videoJobMaterials(references) {
  const refs = references && typeof references === 'object' ? references : {};
  const urls = refs.urls && typeof refs.urls === 'object' ? refs.urls : {};
  const toItems = (ids, key) => (Array.isArray(ids) ? ids : [])
    .map(String)
    .filter(id => id && urls[id])
    .map((id, index) => ({ id, url: String(urls[id]), name: KIND_LABEL[key] + (index + 1) }));
  return {
    first: toItems(refs.firstImage ? [refs.firstImage] : [], 'first'),
    last: toItems(refs.lastImage ? [refs.lastImage] : [], 'last'),
    images: toItems(refs.images, 'images'),
    videos: toItems(refs.videos, 'videos'),
    audios: toItems(refs.audios, 'audios'),
  };
}

export function restoredAssetCount(materials, mode) {
  const list = materials && typeof materials === 'object' ? materials : {};
  const count = key => (Array.isArray(list[key]) ? list[key].length : 0);
  return mode === 'frame' ? count('first') + count('last') : count('images') + count('videos') + count('audios');
}
