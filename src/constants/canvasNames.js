// 4c183cd4 续命 P-B 电影分镜命名 (P-B / 1-2 天)
// 6 类: Enclosure (取景) / Breakthrough (突破) / Framing (构图) / CloseUp (特写) / Tracking (跟拍) / Overture (前奏/候选)
// 任务里给的示例包含 Voice/Caption/Sequence, 全部 6 类入表; 真实画布节点 kind = image / video / audio, 其它类供未来扩展。

export const CANVAS_SHOT_PREFIXES = Object.freeze({
  // 任务规范: image -> Enclosure, video -> Breakthrough, audio -> Voice
  image: 'Enclosure',
  video: 'Breakthrough',
  audio: 'Voice',
  // 5-6 类按任务规范保留, 当前画布尚未用到, 但保持表完整, 后续 type='text'/'group' 上线即生效
  text: 'Caption',
  group: 'Sequence',
  // P-B 6 类齐全, 留一档给特写 / 跟拍以匹配 cinematic shot list 习惯
  close_up: 'CloseUp',
  tracking: 'Tracking',
  // shot 节点 = 镜头取景 (Framing), candidate 节点 = 候选 (Overture/前奏)
  shot: 'Framing',
  candidate: 'Overture',
  // workbench 端 audio 节点细分子类: voice / music
  voice: 'Voice',
  music: 'Track',
});

// 给定 kind / sub-kind / source, 返回「Enclosure-001」形式。counter 在调用方维护以保证同会话内单调递增。
export function formatCanvasShotName(prefix, counter) {
  const safePrefix = CANVAS_SHOT_PREFIXES[prefix] || 'Shot';
  const safeCounter = Number.isFinite(Number(counter)) && Number(counter) > 0
    ? Math.floor(Number(counter))
    : 1;
  // 3 位补零, 跟任务示例保持一致; 同时支持大于 999 的批次
  const padded = String(safeCounter).padStart(3, '0');
  return `${safePrefix}-${padded}`;
}

// 把 5 个现有节点 kind 映射到对应分镜前缀。
// 调用方根据 source (upload/library/workbench/shot/candidate) + subKind 决定选哪一档。
export function resolveShotPrefix({ kind, subKind = null, source = null, type = null } = {}) {
  // shot / candidate 节点 (type 维度优先)
  if (type === 'shot' || source === 'shot') return 'shot';
  if (type === 'candidate' || source === 'candidate') return 'candidate';
  // audio workbench 子类细分
  if (kind === 'audio') {
    if (subKind === 'voice') return 'voice';
    if (subKind === 'music') return 'music';
    return 'audio';
  }
  // image / video 默认
  if (kind === 'image' || kind === 'video') return kind;
  // text / group 留给未来
  if (kind === 'text' || kind === 'group') return kind;
  // 兜底: 走 Enclosure (取景) 保持乐观默认
  return 'image';
}
