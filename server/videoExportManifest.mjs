import crypto from 'node:crypto';

const ALLOWED_FORMATS = new Set(['mp4', 'webm']);
const ALLOWED_RESOLUTIONS = new Set(['720p', '1080p', '4k']);
const ALLOWED_FPS = new Set([24, 25, 30, 50, 60]);

function invalid(message) {
  const error = new Error(message);
  error.code = 'INVALID_VIDEO_EXPORT';
  return error;
}

function requiredString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw invalid(`${label}不能为空`);
  return value.trim();
}

function finiteNumber(value, label, { min = -Infinity, max = Infinity, integer = false } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw invalid(`${label}无效`);
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(value);
}

function hashManifest(manifest) {
  return crypto.createHash('sha256').update(canonicalJson(manifest)).digest('hex');
}

export function videoExportManifestHash(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw invalid('导出清单无效');
  const { manifestHash: _manifestHash, ...payload } = manifest;
  return hashManifest(payload);
}

export function assertVideoExportManifestIntegrity(manifest, expectedHash = '') {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    const error = invalid('导出清单完整性校验失败');
    error.code = 'EXPORT_MANIFEST_INTEGRITY_INVALID';
    throw error;
  }
  const actualHash = videoExportManifestHash(manifest);
  if (!manifest.manifestHash || manifest.manifestHash !== actualHash
    || (expectedHash && expectedHash !== actualHash)) {
    const error = invalid('导出清单完整性校验失败');
    error.code = 'EXPORT_MANIFEST_INTEGRITY_INVALID';
    throw error;
  }
  return true;
}

function normalizeOptions(options = {}, projectTitle = '') {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw invalid('导出选项无效');
  const format = options.format === undefined ? 'mp4' : String(options.format).trim().toLowerCase();
  const resolution = options.resolution === undefined ? '720p' : String(options.resolution).trim().toLowerCase();
  const fps = options.fps === undefined ? 30 : Number(options.fps);
  const includeAudio = options.includeAudio === undefined ? true : options.includeAudio;
  const title = options.title === undefined ? String(projectTitle || '').trim() : String(options.title).trim();
  if (!ALLOWED_FORMATS.has(format)) throw invalid('导出格式不支持');
  if (!ALLOWED_RESOLUTIONS.has(resolution)) throw invalid('导出分辨率不支持');
  if (!ALLOWED_FPS.has(fps)) throw invalid('帧率不支持');
  if (typeof includeAudio !== 'boolean') throw invalid('音频选项无效');
  return { format, resolution, fps, includeAudio, title };
}

function normalizeSubtitleCues(cues) {
  if (cues === undefined || cues === null) return [];
  if (!Array.isArray(cues) || cues.length > 200) throw invalid('字幕数据无效');
  let previousEnd = -1;
  return cues.map((cue) => {
    if (!cue || typeof cue !== 'object') throw invalid('字幕数据无效');
    const startMs = finiteNumber(cue.startMs, '字幕起点', { min: 0, integer: true });
    const endMs = finiteNumber(cue.endMs, '字幕终点', { min: 1, integer: true });
    const text = typeof cue.text === 'string' ? cue.text.trim().slice(0, 240) : '';
    if (!text || endMs <= startMs || startMs < previousEnd) throw invalid('字幕时间或文本无效');
    previousEnd = endMs;
    return { startMs, endMs, text };
  });
}

function normalizeBeatMarkers(markers) {
  if (markers === undefined || markers === null) return [];
  if (!Array.isArray(markers)) throw invalid('节拍标记无效');
  let previous = -1;
  return markers.map((marker) => {
    const value = finiteNumber(Number(marker), '节拍标记', { min: 0, integer: true });
    if (value < previous) throw invalid('节拍标记顺序无效');
    previous = value;
    return value;
  });
}

function findShot(shots, shotId) {
  const shot = shots.find((item) => item && item.id === shotId);
  if (!shot) throw invalid('时间线镜头不存在');
  return shot;
}

function findCandidate(shot, candidateId) {
  const candidates = Array.isArray(shot.candidates) ? shot.candidates : [];
  const candidate = candidates.find((item) => item && item.id === candidateId);
  if (!candidate) throw invalid('时间线候选不存在');
  if (candidate.status && !['available', 'ready', 'selected'].includes(candidate.status)) throw invalid('候选不可用');
  return candidate;
}

function normalizeCandidate(candidate) {
  const mimeType = requiredString(candidate.mimeType, '候选媒体类型').toLowerCase();
  if (!mimeType.startsWith('video/')) throw invalid('候选必须是视频');
  return {
    outputAssetId: requiredString(candidate.outputAssetId, '候选资产'),
    contentHash: requiredString(candidate.contentHash, '候选内容哈希'),
    mimeType,
  };
}

function normalizeAudioTrack(track, assets) {
  if (!track || typeof track !== 'object') throw invalid('音频轨道无效');
  const asset = (Array.isArray(assets) ? assets : []).find((item) => item && item.id === track.assetId);
  if (!asset) throw invalid('音频资产不存在');
  const version = (Array.isArray(asset.versions) ? asset.versions : []).find((item) => item && item.id === track.assetVersionId);
  if (!version || asset.approvedVersionId !== version.id) throw invalid('音频版本未审核');
  const mimeType = requiredString(version.mimeType, '音频媒体类型').toLowerCase();
  if (!mimeType.startsWith('audio/')) throw invalid('轨道必须是音频');
  const startMs = finiteNumber(track.startMs, '音频起点', { min: 0, integer: true });
  const durationMs = finiteNumber(track.durationMs, '音频时长', { min: 1, integer: true });
  const volume = finiteNumber(track.volume === undefined ? 1 : track.volume, '音量', { min: 0, max: 2 });
  const language = typeof track.language === 'string' ? track.language.trim() : '';
  const voiceAnchor = typeof track.voiceAnchor === 'string' ? track.voiceAnchor.trim() : '';
  return {
    id: requiredString(track.id, '音频轨道'),
    kind: track.kind === 'voice' ? 'voice' : 'music',
    assetId: requiredString(asset.id, '音频资产'),
    assetVersionId: requiredString(version.id, '音频版本'),
    contentHash: requiredString(version.contentHash, '音频内容哈希'),
    mimeType,
    startMs,
    durationMs,
    volume,
    muted: Boolean(track.muted),
    language,
    voiceAnchor,
    beatMarkers: normalizeBeatMarkers(track.beatMarkers),
    subtitleCues: normalizeSubtitleCues(track.subtitleCues).map((cue) => {
      if (cue.endMs > durationMs) throw invalid('字幕超出音频轨道时长');
      return cue;
    }),
  };
}

function normalizeTimeline(workbench) {
  const clips = Array.isArray(workbench.timelineClips) ? workbench.timelineClips : [];
  if (!clips.length) throw invalid('时间线没有有效片段');
  const shots = Array.isArray(workbench.shots) ? workbench.shots : [];
  const seenPositions = new Set();
  const normalized = clips.map((clip) => {
    if (!clip || typeof clip !== 'object' || clip.status !== 'active') throw invalid('时间线没有有效片段');
    const position = finiteNumber(clip.position, '时间线位置', { min: 0, integer: true });
    if (seenPositions.has(position)) throw invalid('时间线位置重复');
    seenPositions.add(position);
    const shot = findShot(shots, clip.shotId);
    const candidate = findCandidate(shot, clip.candidateId);
    const trimStartMs = finiteNumber(clip.trimStartMs, '裁剪起点', { min: 0, integer: true });
    const trimEndMs = finiteNumber(clip.trimEndMs, '裁剪终点', { min: 1, integer: true });
    const shotDurationMs = finiteNumber(shot.durationMs, '镜头时长', { min: 1, integer: true });
    if (trimEndMs <= trimStartMs || trimEndMs > shotDurationMs) throw invalid('裁剪范围超过镜头时长');
    return {
      id: requiredString(clip.id, '时间线片段'),
      position,
      shotId: requiredString(shot.id, '镜头'),
      purpose: typeof shot.purpose === 'string' ? shot.purpose.trim() : '',
      candidateId: requiredString(candidate.id, '候选'),
      trimStartMs,
      trimEndMs,
      durationMs: trimEndMs - trimStartMs,
      muted: Boolean(clip.muted),
      candidate: normalizeCandidate(candidate),
    };
  });
  normalized.sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  return { durationMs: normalized.reduce((sum, clip) => sum + clip.durationMs, 0), clips: normalized };
}

export function buildVideoExportManifest({ workbench, options = {} } = {}) {
  if (!workbench || typeof workbench !== 'object') throw invalid('工作台数据无效');
  const project = workbench.project;
  if (!project || project.kind !== 'video') throw invalid('项目不是视频项目');
  const normalizedOptions = normalizeOptions(options, project.title);
  const timeline = normalizeTimeline(workbench);
  const audioTracks = normalizedOptions.includeAudio
    ? (Array.isArray(workbench.audioTracks) ? workbench.audioTracks : []).map((track) => normalizeAudioTrack(track, workbench.assets))
    : [];
  const manifest = {
    schemaVersion: 1,
    kind: 'video-export-manifest',
    options: normalizedOptions,
    timeline,
    audio: { includeAudio: normalizedOptions.includeAudio, tracks: audioTracks },
    delivery: {
      status: 'manifest_ready',
      renderer: 'external-worker',
      providerSubmission: false,
      billingMutation: false,
    },
  };
  return { ...manifest, manifestHash: videoExportManifestHash(manifest) };
}

export { invalid as videoExportError };
