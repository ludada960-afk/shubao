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
  assert.match(page, /workbenchMode/);
  assert.match(page, /workbenchPlanningOnly/);
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
    'getVideoWorkbenchPreflight',
    'previewVideoSkillTemplate',
    'previewVideoSkillRunExecution',
    'confirmVideoSkillCheckpoint',
    'createVideoWorkbenchGenerationDraft',
    'createShotRecoveryPlan',
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
    'createVideoExportManifest',
    'listVideoExportManifests',
    'getVideoExportManifest',
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
  assert.match(component, /video-project-planning-banner/);
  assert.match(component, /provider-neutral/);
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
  assert.match(component, /skillRun\?\.skillId/);
  assert.match(component, /skillRunId:\s*skillRun\.id/);
  assert.match(component, /查看创作过程/);
  assert.match(component, /已保存配方/);
  assert.match(component, /replayManifests/);
  assert.match(component, /创作过程预览/);
  assert.match(component, /replayManifestPreview\.shots/);
  assert.match(component, /exportManifest/);
  assert.match(component, /生成导出清单/);
  assert.match(component, /exportManifest\.manifest\?\.timeline\?\.durationMs/);
  assert.doesNotMatch(component, /exportManifest\.manifest\?\.durationMs\s*\?/);
  assert.match(component, /尚未调用渲染器\/供应商，不会扣积分/);
  assert.match(component, /下载 MP4 需接入渲染 worker/);
  assert.match(component, /handleCheckGenerationPlan/);
  assert.match(component, /handlePreflightGeneration/);
  assert.match(component, /workbenchPreflight/);
  assert.match(component, /handleCompileGenerationDraft/);
  assert.match(component, /generationDraft/);
  assert.match(component, /编译逐镜头草稿/);
  assert.match(component, /不会发起供应商任务或扣除积分/);
  assert.match(component, /onPlanApprovalChange/);
  assert.match(component, /workbenchPlan\?\.approval\?\.planHash/);
  assert.match(component, /视频生成计划/);
  assert.match(component, /continuityReview/);
  assert.match(component, /video-project-continuity-review/);
  assert.match(component, /镜头连续性/);
  assert.match(component, /video-project-generation-draft-meta/);
  assert.match(component, /handleCreateShotRecoveryPlan/);
  assert.match(component, /建立单镜头重拍计划/);
  assert.match(component, /不调用供应商 · 不扣积分/);
  assert.match(component, /生成草稿审计摘要/);
  assert.match(component, /连续性：/);
  assert.match(component, /预检摘要：/);
  assert.match(component, /提交前预检/);
  assert.match(component, /版权\/使用权|版权确认/);
  assert.match(component, /不会调用供应商，也不会扣除积分/);
  assert.match(component, /先看清步骤，再决定是否生成/);
  assert.match(component, /预览工作流/);
  assert.match(component, /不会调用供应商、不扣积分/);
  assert.match(component, /参考视频重构需要至少一个视频素材和一个替换图片素材/);
  assert.match(component, /skillRunExecutionPreview/);
  assert.match(component, /skillRun\.plan\?\.steps/);
  assert.match(component, /handleConfirmSkillCheckpoint/);
  assert.match(component, /确认节点/);
  assert.match(component, /next\.skillRuns/);
  assert.match(component, /previewVideoSkillRunExecution\(id, latestSkillRun\.id\)/);
  assert.match(component, /不会生成视频或扣除积分/);
  assert.match(component, /workbenchPlan\.quote\?\.points/);
  assert.match(component, /关闭过程预览/);
  assert.match(component, /setReplayManifestPreview\(null\);\s*setReplayManifest\(manifest\)/);
  assert.match(component, /setReplayManifest\(null\);\s*setReplayManifestPreview\(null\)/);
  assert.match(component, /复用为新项目/);
  assert.match(component, /manifestHash/);
  assert.match(component, /ShotDirectionFields/);
  assert.match(component, /normalizeShotDirectionValue\(shotDraft\.direction/);
  assert.match(component, /const direction = normalizeShotDirectionValue\(edit\.direction, edit\.cameraLanguage\)/);
  assert.match(component, /updateShotEdit\(shot,/);
  assert.match(component, /结构化镜头控制/);
  assert.match(component, /type="range"/);
  assert.match(styles, /video-project-band\.is-audio/);
  assert.match(styles, /video-project-plan/);
  assert.match(styles, /video-project-continuity-review/);
  assert.match(styles, /video-project-generation-draft-meta/);
  assert.match(styles, /video-project-recovery-row/);
  assert.match(styles, /video-project-recovery-status/);
  assert.match(styles, /video-project-preflight/);
  assert.match(component, /aria-busy=\{loading \|\| Boolean\(busy\)\}/);
  assert.match(component, /disabled=\{Boolean\(busy\)/);
  assert.match(component, /<video[^>]+preload="metadata"/);
  assert.match(component, /onError=\{\(\) => setFailed\(true\)\}/);
  assert.match(component, /视频预览不可用/);
  assert.match(component, /候选来源未核验|来源已核验|规划候选/);
  assert.match(component, /provenanceStatus/);
  assert.match(styles, /aspect-ratio/);
  assert.match(styles, /video-project-candidate-media\.is-unavailable/);
  assert.match(styles, /video-project-candidate-provenance/);
  assert.match(styles, /video-project-direction-grid/);
  assert.match(styles, /video-project-shot-form[^\{]*\s*\{[^}]*grid-template-columns/);
  assert.match(styles, /@media\s*\(max-width:\s*640px\)/);
  assert.doesNotMatch(styles, /font-size:\s*clamp\(/);
}
);
