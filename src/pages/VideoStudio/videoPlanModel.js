const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|gif|avif)$/i;
const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v)$/i;
const AUDIO_EXTENSIONS = /\.(mp3|wav|m4a|aac|ogg|flac)$/i;

export const VIDEO_PLAN_LIMITS = Object.freeze({ images: 9, videos: 3, audios: 3, total: 12, requestBytes: 64 * 1024 * 1024 });

function clean(value, max = 160) {
  return String(value ?? '').trim().slice(0, max);
}
export function getVideoFileKind(file = {}) {
  const type = clean(file.type, 80).toLowerCase();
  const name = clean(file.name, 240).toLowerCase();
  if (type.startsWith('image/') || IMAGE_EXTENSIONS.test(name)) return 'image';
  if (type.startsWith('video/') || VIDEO_EXTENSIONS.test(name)) return 'video';
  if (type.startsWith('audio/') || AUDIO_EXTENSIONS.test(name)) return 'audio';
  return 'unknown';
}

function flattenFiles(files = {}) {
  const groups = [
    ['first', files.first || []],
    ['last', files.last || []],
    ['images', files.images || []],
    ['videos', files.videos || []],
    ['audios', files.audios || []],
  ];
  return groups.flatMap(([group, items]) => items.map((file, index) => ({
    group,
    index,
    file,
    kind: getVideoFileKind(file),
    name: clean(file.name, 80) || `${group}-${index + 1}`,
    size: Number(file.size) || 0,
  })));
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function rangeLabel(duration, start, end) {
  const safeStart = Math.max(0, Math.min(duration, start));
  const safeEnd = Math.max(safeStart + 1, Math.min(duration, end));
  return `${safeStart}-${safeEnd}s`;
}

function buildBeats(mode, duration, material) {
  const seconds = Math.max(4, Number(duration) || 8);
  const middleStart = Math.max(1, Math.floor(seconds * 0.22));
  const middleEnd = Math.max(middleStart + 1, Math.ceil(seconds * 0.78));
  const sourceLabel = material.length ? `${material.length} 个参考素材` : '提示词与模型默认场景';
  if (mode === 'frame') return [
    { time: rangeLabel(seconds, 0, 1), label: '起镜', detail: '锁定首帧主体、构图和视觉基调', source: '首帧图' },
    { time: rangeLabel(seconds, 1, seconds - 1), label: '转场', detail: '按提示词补齐动作、运镜与场景变化', source: '提示词' },
    { time: rangeLabel(seconds, seconds - 1, seconds), label: '落镜', detail: '收束到尾帧构图，避免主体漂移', source: '尾帧图' },
  ];
  if (mode === 'remake') return [
    { time: rangeLabel(seconds, 0, middleStart), label: '保留开场', detail: '提取参考视频的开场节奏与主体进入方式', source: '参考视频' },
    { time: rangeLabel(seconds, middleStart, middleEnd), label: '替换内容', detail: '把画面主体替换为你的图片素材，并保持动作逻辑', source: sourceLabel },
    { time: rangeLabel(seconds, middleEnd, seconds), label: '保留收束', detail: '延续参考视频的高潮、转场和结束节拍', source: '参考视频' },
  ];
  return [
    { time: rangeLabel(seconds, 0, middleStart), label: '建立画面', detail: '先交代主体、空间和第一视觉重点', source: sourceLabel },
    { time: rangeLabel(seconds, middleStart, middleEnd), label: '推进动作', detail: '按照提示词完成动作、运镜和节奏推进', source: '提示词' },
    { time: rangeLabel(seconds, middleEnd, seconds), label: '完成交付', detail: '回到清晰的主体结果，保留品牌与商品识别度', source: '模型推演' },
  ];
}

export function buildVideoPlan({ mode = 'smart', prompt = '', files = {}, duration = 8, ratio = '9:16', resolution = '720p', sound = true, product = null } = {}) {
  const assets = flattenFiles(files);
  const counts = assets.reduce((result, item) => {
    if (item.kind === 'image') result.images += 1;
    if (item.kind === 'video') result.videos += 1;
    if (item.kind === 'audio') result.audios += 1;
    return result;
  }, { images: 0, videos: 0, audios: 0 });
  const totalBytes = assets.reduce((sum, item) => sum + item.size, 0);
  const warnings = [];
  const blockers = [];
  const normalizedMode = ['smart', 'frame', 'remake'].includes(mode) ? mode : 'smart';
  const normalizedPrompt = clean(prompt, 1200);
  const material = assets.filter(item => item.kind !== 'unknown');
  const hasAudio = counts.audios > 0;
  const hasVisual = counts.images > 0 || counts.videos > 0;

  if (!normalizedPrompt) blockers.push({ code: 'prompt', title: '还没有镜头描述', detail: '至少写清主体、动作或镜头节奏。' });
  if (normalizedMode === 'frame' && (!files.first?.length || !files.last?.length)) {
    blockers.push({ code: 'frame-pair', title: '首尾帧还不完整', detail: '需要同时提供首帧图和尾帧图。' });
  }
  if (normalizedMode === 'remake' && (!files.images?.length || !files.videos?.length)) {
    blockers.push({ code: 'remake-pair', title: '重构素材还不完整', detail: '需要至少一张替换图片和一个参考视频。' });
  }
  if (!hasVisual && hasAudio) {
    blockers.push({ code: 'audio-only', title: '音频不能单独生成视频', detail: '再补一张图片或一段视频，让模型有可视化参考。' });
  }
  if (counts.images > VIDEO_PLAN_LIMITS.images) blockers.push({ code: 'image-limit', title: '图片素材超出上限', detail: `当前 ${counts.images} 张，最多 ${VIDEO_PLAN_LIMITS.images} 张。` });
  if (counts.videos > VIDEO_PLAN_LIMITS.videos) blockers.push({ code: 'video-limit', title: '视频素材超出上限', detail: `当前 ${counts.videos} 段，最多 ${VIDEO_PLAN_LIMITS.videos} 段。` });
  if (counts.audios > VIDEO_PLAN_LIMITS.audios) blockers.push({ code: 'audio-limit', title: '音频素材超出上限', detail: `当前 ${counts.audios} 段，最多 ${VIDEO_PLAN_LIMITS.audios} 段。` });
  if (material.length > VIDEO_PLAN_LIMITS.total) blockers.push({ code: 'total-limit', title: '参考素材总数超出上限', detail: `当前 ${material.length} 个，最多 ${VIDEO_PLAN_LIMITS.total} 个。` });
  if (totalBytes > VIDEO_PLAN_LIMITS.requestBytes) warnings.push({ code: 'payload-size', title: '素材体积较大', detail: `当前约 ${formatBytes(totalBytes)}，上传后会先转为引用地址；建议压缩超大视频以减少等待。` });
  if (normalizedMode === 'frame') warnings.push({ code: 'frame-ratio', title: '首尾帧会适配目标画幅', detail: `${ratio} 画幅与原图比例不一致时，边缘可能被裁切。` });
  if (hasAudio && !sound) warnings.push({ code: 'audio-reference', title: '已关闭生成声音', detail: '上传音频仍会作为节奏参考，但不会把它作为成片声音输出。' });
  if (product?.frameAudio === false && normalizedMode === 'frame' && sound) blockers.push({ code: 'frame-audio', title: '当前模型不支持首尾帧配音', detail: '关闭生成声音后再继续。' });
  if (assets.some(item => item.kind === 'unknown')) warnings.push({ code: 'unknown-file', title: '有素材类型无法识别', detail: '未识别的文件不会被发送给上游。' });

  const lane = normalizedMode === 'frame'
    ? 'first_last'
    : normalizedMode === 'remake'
      ? 'remake'
      : hasVisual || hasAudio ? 'multimodal_reference' : 'text_only';
  const laneLabels = {
    first_last: '首尾帧过渡',
    remake: '参考节奏重构',
    multimodal_reference: '多模态参考',
    text_only: '文字起步',
  };
  return {
    ready: blockers.length === 0,
    mode: normalizedMode,
    lane,
    laneLabel: laneLabels[lane],
    prompt: normalizedPrompt,
    counts,
    totalBytes,
    assets: material.map(item => ({ group: item.group, kind: item.kind, name: item.name })),
    materialMap: normalizedMode === 'frame'
      ? [{ label: '起点', detail: '首帧图', count: files.first?.length || 0 }, { label: '终点', detail: '尾帧图', count: files.last?.length || 0 }]
      : normalizedMode === 'remake'
        ? [{ label: '替换内容', detail: '图片素材', count: counts.images }, { label: '节奏来源', detail: '参考视频', count: counts.videos }, { label: '声音参考', detail: '音频素材', count: counts.audios }]
        : [{ label: '视觉参考', detail: counts.images || counts.videos ? '图片 / 视频' : '模型默认场景', count: counts.images + counts.videos }, { label: '声音参考', detail: hasAudio ? '音频素材' : sound ? '模型生成声音' : '关闭', count: counts.audios }],
    beats: buildBeats(normalizedMode, duration, material),
    warnings,
    blockers,
    output: { ratio, resolution, duration: Number(duration) || 8, sound: Boolean(sound) },
    cost: product?.quotes?.[Number(duration) <= 8 ? 'short' : 'long'] || null,
  };
}
