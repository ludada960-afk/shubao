// 时间线抽屉纯模型（P2）：trim 手柄接字段、候选换绑选项、导出清单摘要。
// 与服务端 videoExportManifest 的裁剪约束一致：0 ≤ trimStartMs < trimEndMs
// ≤ 镜头 durationMs。ffmpeg 真渲染留 P3，这里只产出清单。

export function activeTimelineClips(workbench = null) {
  return (Array.isArray(workbench?.timelineClips) ? workbench.timelineClips : [])
    .filter(clip => clip?.id && clip.status === 'active')
    .sort((left, right) => Number(left.position ?? 0) - Number(right.position ?? 0));
}

export function clipDurationMs(clip = null) {
  return Math.max(0, Number(clip?.trimEndMs) || 0) - Math.max(0, Number(clip?.trimStartMs) || 0);
}

export function timelineTotalDurationMs(clips = []) {
  return (Array.isArray(clips) ? clips : []).reduce((sum, clip) => sum + clipDurationMs(clip), 0);
}

// trim 手柄边界：上限取镜头时长（与服务端导出校验一致）。
export function clipTrimBounds(clip = null, shot = null) {
  const startMs = Math.max(0, Number(clip?.trimStartMs) || 0);
  const endMs = Math.max(startMs, Number(clip?.trimEndMs) || startMs);
  const maxMs = Math.max(500, Number(shot?.durationMs) || endMs);
  return { startMs, endMs, minMs: 0, maxMs };
}

// trim 手柄提交值校验：非法输入抛可读错误，合法返回 patch。
export function clampTrimPatch({ clip = null, shot = null, trimStartMs, trimEndMs } = {}) {
  const bounds = clipTrimBounds(clip, shot);
  const start = Math.round(Number(trimStartMs));
  const end = Math.round(Number(trimEndMs));
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) throw new Error('裁剪时间必须是整数毫秒');
  if (start < bounds.minMs) throw new Error('裁剪起点不能早于片段开头');
  if (end > bounds.maxMs) throw new Error('裁剪终点不能超过镜头时长');
  if (end - start < 200) throw new Error('裁剪后至少保留 0.2 秒');
  return { trimStartMs: start, trimEndMs: end };
}

// 候选换绑选项：当前镜头下除已绑候选外的可用视频候选。
export function clipRebindOptions(workbench = null, clip = null) {
  if (!clip?.shotId) return [];
  const shot = (Array.isArray(workbench?.shots) ? workbench.shots : []).find(item => item?.id === clip.shotId);
  return (Array.isArray(shot?.candidates) ? shot.candidates : [])
    .filter(candidate => candidate?.id && candidate.id !== clip.candidateId)
    .map(candidate => ({
      candidateId: candidate.id,
      label: '候选 ' + String(candidate.id).slice(-6),
      isCurrentSelected: shot.selectedCandidateId === candidate.id,
      previewUrl: candidate.playbackUrl || candidate.stableUrl || '',
    }));
}

// 导出清单摘要（manifest 完善的展示面；真渲染留 P3）。
export function exportManifestSummary(manifest = null) {
  if (!manifest || typeof manifest !== 'object') return null;
  const timeline = manifest.timeline || {};
  const clips = Array.isArray(timeline.clips) ? timeline.clips : [];
  const tracks = Array.isArray(manifest.audio?.tracks) ? manifest.audio.tracks : [];
  const cueCount = tracks.reduce((sum, track) => sum + (Array.isArray(track.subtitleCues) ? track.subtitleCues.length : 0), 0);
  return {
    manifestHash: String(manifest.manifestHash || ''),
    schemaVersion: Number(manifest.schemaVersion) || 1,
    options: manifest.options || {},
    clipCount: clips.length,
    totalDurationMs: Number(timeline.durationMs) || clips.reduce((sum, clip) => sum + (Number(clip.durationMs) || 0), 0),
    audioTrackCount: tracks.length,
    subtitleCueCount: cueCount,
    renderer: manifest.delivery?.renderer || 'external-worker',
    rendered: false, // P3 前清单不等于成片
    replayed: Boolean(manifest.replayed),
  };
}

// 导出前置检查：没有活动片段时给出可读阻断文案。
export function exportReadiness(workbench = null) {
  const clips = activeTimelineClips(workbench);
  if (!clips.length) return { ok: false, reason: '时间线还没有片段：先在镜头卡上把选定候选加入时间线' };
  return { ok: true, reason: '' };
}
