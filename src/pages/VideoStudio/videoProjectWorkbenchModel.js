const SUPPORTED_UPLOAD_KINDS = new Set(['image', 'video', 'audio']);

function timeValue(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function stableNewestFirst(items, dateKey = 'updatedAt') {
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => timeValue(right.item?.[dateKey]) - timeValue(left.item?.[dateKey])
      || left.index - right.index)
    .map(entry => entry.item);
}

export function videoProjects(projects = []) {
  const source = Array.isArray(projects) ? projects : [];
  const active = [];
  const completed = [];
  source.forEach(project => {
    if (!project?.id || project.kind !== 'video') return;
    (project.status === 'completed' ? completed : active).push(project);
  });
  return [...stableNewestFirst(active), ...stableNewestFirst(completed)];
}

export function availableUploadedAssets(uploadRecords = []) {
  const seen = new Set();
  return (Array.isArray(uploadRecords) ? uploadRecords : []).filter(record => {
    const asset = record?.asset;
    const id = String(asset?.id || '').trim();
    if (record?.status !== 'completed' || !id || !SUPPORTED_UPLOAD_KINDS.has(asset?.kind) || seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
}

export function approvedAssetVersions(workbench) {
  const assets = Array.isArray(workbench?.assets) ? workbench.assets : [];
  return assets.flatMap(asset => {
    const versions = Array.isArray(asset?.versions) ? asset.versions : [];
    const version = versions.find(item => item?.id === asset?.approvedVersionId);
    return version ? [{ asset, version }] : [];
  });
}

export function approvedAudioAssetVersions(workbench) {
  return approvedAssetVersions(workbench).filter(({ asset, version }) =>
    (asset?.kind === 'voice' || asset?.kind === 'music')
    && String(version?.mimeType || '').toLowerCase().startsWith('audio/'));
}

export function audioTrackForAsset(workbench, assetId, assetVersionId) {
  const tracks = Array.isArray(workbench?.audioTracks) ? workbench.audioTracks : [];
  return tracks.find(track => track?.assetId === assetId && track?.assetVersionId === assetVersionId) || null;
}

export function audioTrackDurationMs(workbench) {
  const clips = Array.isArray(workbench?.timelineClips) ? workbench.timelineClips : [];
  const duration = clips.filter(clip => clip?.status === 'active').reduce((max, clip) =>
    Math.max(max, Number(clip?.trimEndMs) || 0), 0);
  return Math.min(120000, Math.max(500, duration || 500));
}

function nextPosition(items = []) {
  const positions = (Array.isArray(items) ? items : [])
    .map(item => Number(item?.position))
    .filter(Number.isSafeInteger);
  return positions.length ? Math.max(...positions) + 1 : 0;
}

export const nextShotPosition = shots => nextPosition(shots);
export const nextTimelinePosition = clips => nextPosition(clips);

export function selectedCandidateForShot(shot) {
  if (!shot?.selectedCandidateId || !Array.isArray(shot.candidates)) return null;
  return shot.candidates.find(candidate => candidate?.id === shot.selectedCandidateId) || null;
}

export function candidateJobsForProject(jobs = [], projectId = '') {
  const target = String(projectId || '').trim();
  const seen = new Set();
  return stableNewestFirst((Array.isArray(jobs) ? jobs : []).filter(job => {
    const id = String(job?.id || '').trim();
    if (!target || !id || seen.has(id) || job?.projectId !== target || job?.status !== 'completed') return false;
    seen.add(id);
    return true;
  }));
}

export function workbenchStageSummary(workbench) {
  if (!workbench?.project?.id && workbench !== null) {
    const hasProjection = Array.isArray(workbench?.assets) || Array.isArray(workbench?.shots);
    if (!hasProjection) return { stage: 'project', counts: null };
  }
  if (!workbench) return { stage: 'project', counts: null };
  const assets = Array.isArray(workbench.assets) ? workbench.assets : [];
  const shots = Array.isArray(workbench.shots) ? workbench.shots : [];
  const clips = Array.isArray(workbench.timelineClips) ? workbench.timelineClips : [];
  const approvedAssets = approvedAssetVersions(workbench);
  const selectedShots = shots.filter(shot => selectedCandidateForShot(shot));
  const activeShotIds = new Set(clips.filter(clip => clip?.status === 'active').map(clip => clip.shotId));
  const counts = {
    assets: assets.length,
    approvedAssets: approvedAssets.length,
    shots: shots.length,
    selectedShots: selectedShots.length,
    timelineClips: clips.length,
  };
  let stage = 'ready';
  if (!approvedAssets.length) stage = 'assets';
  else if (!shots.length) stage = 'shots';
  else if (selectedShots.length < shots.length) stage = 'candidates';
  else if (selectedShots.some(shot => !activeShotIds.has(shot.id))) stage = 'timeline';
  return { stage, counts };
}
