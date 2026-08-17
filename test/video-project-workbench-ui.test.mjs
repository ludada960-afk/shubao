import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = path => readFile(new URL(path, import.meta.url), 'utf8');

test('standalone video studio gates the project workbench and passes durable inputs', async () => {
  const [page, styles] = await Promise.all([
    source('../src/pages/VideoStudio/index.jsx'),
    source('../src/pages/VideoStudio/VideoStudio.css'),
  ]);

  assert.match(page, /import VideoProjectWorkbench from '.\/VideoProjectWorkbench\.jsx'/);
  assert.match(page, /const \[uploadRevision, setUploadRevision\] = useState\(0\)/);
  assert.match(page, /capabilities\.workbenchEnabled/);
  assert.match(page, /\}, \[state\.logged\]\);/);
  assert.match(page, /!embedded && capabilities\.workbenchEnabled && state\.logged/);
  assert.match(page, /<VideoProjectWorkbench/);
  assert.match(page, /uploadRecords=\{uploadRecords\}/);
  assert.match(page, /jobs=\{history\}/);
  assert.match(page, /onProjectChange=\{setActiveVideoProjectId\}/);
  assert.match(page, /onPlanApprovalChange=\{setActiveVideoPlanHash\}/);
  assert.match(page, /workbenchPlanHash:\s*activeVideoPlanHash\s*\|\|\s*undefined/);
  assert.match(page, /projectId:\s*activeVideoProjectId\s*\|\|\s*undefined/);
  assert.match(page, /className="video-result-workbench"/);
  assert.doesNotMatch(page, /className="video-workbench"/);
  assert.match(styles, /\.video-result-workbench/);
  assert.doesNotMatch(styles, /\.video-workbench\s*\{/);
});

test('project workbench exposes real persisted stages without provider controls or forged media facts', async () => {
  const [component, styles] = await Promise.all([
    source('../src/pages/VideoStudio/VideoProjectWorkbench.jsx'),
    source('../src/pages/VideoStudio/VideoProjectWorkbench.css'),
  ]);

  for (const label of ['项目', '素材', '分镜', '候选', '时间线', '交付']) {
    assert.match(component, new RegExp(label));
  }
  for (const command of [
    'listProjects',
    'getVideoWorkbench',
    'getVideoWorkbenchPlan',
    'createVideoWorkbenchGenerationDraft',
    'createWorkbenchAsset',
    'importWorkbenchAssetVersion',
    'approveWorkbenchAssetVersion',
    'createStoryboardShot',
    'bindShotAssetVersion',
    'importJobCandidate',
    'selectShotCandidate',
    'addTimelineClip',
    'updateTimelineClip',
    'upsertVideoProjectMemoryFact',
    'removeVideoProjectMemoryFact',
    'createVideoAudioTrack',
    'updateVideoAudioTrack',
    'createVideoReplayManifest',
    'listVideoReplayManifests',
    'getVideoReplayManifest',
    'cloneVideoReplayManifest',
  ]) {
    assert.match(component, new RegExp(command));
  }
  for (const projection of [
    'videoProjects',
    'availableUploadedAssets',
    'approvedAssetVersions',
    'candidateJobsForProject',
    'nextShotPosition',
    'nextTimelinePosition',
    'selectedCandidateForShot',
    'workbenchStageSummary',
  ]) {
    assert.match(component, new RegExp(projection));
  }

  assert.match(component, /videoAssetId:\s*upload\.asset\.id/);
  assert.match(component, /generationJobId:\s*job\.id/);
  assert.match(component, /expectedRevision:\s*asset\.revision/);
  assert.match(component, /expectedRevision:\s*shot\.revision/);
  assert.doesNotMatch(component, /stableUrl\s*:/);
  assert.doesNotMatch(component, /contentHash\s*:/);
  assert.doesNotMatch(component, /mimeType\s*:/);
  assert.doesNotMatch(component, /模型选择|供应商模型|供应商下拉/);
  assert.match(component, /内容已在其他位置更新|刷新后重试/);
  assert.match(component, /aria-label="视频项目工作台"/);
  assert.match(component, /项目记忆/);
  assert.match(component, /workbench\?\.memory/);
  assert.match(component, /expectedRevision:\s*fact\.revision/);
  assert.match(component, /removeVideoProjectMemoryFact\(projectId, fact\.key, fact\.revision\)/);
  assert.match(component, /声音与字幕/);
  assert.match(component, /approvedAudioAssetVersions/);
  assert.match(component, /加入音轨/);
  assert.match(component, /取消静音|静音/);
  assert.match(component, /handleSetAudioVolume/);
  assert.match(component, /handleMoveTimelineClip/);
  assert.match(component, /handleToggleTimelineClip/);
  assert.match(component, /起点/);
  assert.match(component, /终点/);
  assert.match(component, /保存创作配方/);
  assert.match(component, /查看创作过程/);
  assert.match(component, /已保存配方/);
  assert.match(component, /replayManifests/);
  assert.match(component, /创作过程预览/);
  assert.match(component, /replayManifestPreview\.shots/);
  assert.match(component, /handleCheckGenerationPlan/);
  assert.match(component, /handleCompileGenerationDraft/);
  assert.match(component, /generationDraft/);
  assert.match(component, /编译逐镜头草稿/);
  assert.match(component, /不会发起供应商任务或扣除积分/);
  assert.match(component, /onPlanApprovalChange/);
  assert.match(component, /workbenchPlan\?\.approval\?\.planHash/);
  assert.match(component, /视频生成计划/);
  assert.match(component, /不会生成视频或扣除积分/);
  assert.match(component, /workbenchPlan\.quote\?\.points/);
  assert.match(component, /关闭过程预览/);
  assert.match(component, /setReplayManifestPreview\(null\);\s*setReplayManifest\(manifest\)/);
  assert.match(component, /setReplayManifest\(null\);\s*setReplayManifestPreview\(null\)/);
  assert.match(component, /复用为新项目/);
  assert.match(component, /manifestHash/);
  assert.match(component, /type="range"/);
  assert.match(styles, /video-project-band\.is-audio/);
  assert.match(styles, /video-project-plan/);
  assert.match(component, /aria-busy=\{loading \|\| Boolean\(busy\)\}/);
  assert.match(component, /disabled=\{Boolean\(busy\)/);
  assert.match(component, /<video[^>]+preload="metadata"/);
  assert.match(styles, /aspect-ratio/);
  assert.match(styles, /@media\s*\(max-width:\s*640px\)/);
  assert.doesNotMatch(styles, /font-size:\s*clamp\(/);
}
);
