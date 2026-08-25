import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  allowedGenerationModes,
  buildCanvasEdges,
  buildCanvasNodes,
  CAMERA_MOVE_CHIPS,
  CANVAS_GENERATION_MODES,
  defaultCanvasLayout,
  marqueeSelectAssetNodes,
  materialNaming,
  planPointsRange,
  pointsEstimateRange,
  resolveCanvasApiMode,
  schemeGate,
  shotGenerationReadiness,
} from '../src/pages/VideoStudio/videoCanvasModel.js';

const source = path => readFile(new URL(path, import.meta.url), 'utf8');

test('canvas nodes: three node kinds with stable ids and deterministic layout', () => {
  const uploads = [{ asset: { id: 'va1', kind: 'image', url: 'https://x/1' }, file: { name: 'hero.png' } }];
  const libraryAssets = [{ projectAssetId: 'pa9', mediaKind: 'image', name: '参考图', sourceProject: { id: 'p1' } }];
  const workbench = {
    assets: [{ id: 'wa1', kind: 'product', name: '商品主图', approvedVersionId: 'wv1', versions: [{ id: 'wv1', stableUrl: 'https://x/2' }] }],
    shots: [
      { id: 's1', position: 0, purpose: '开场', prompt: '展示产品', durationMs: 6000, bindings: [{ assetId: 'wa1', role: 'first_frame' }], candidates: [{ id: 'c1', stableUrl: 'https://x/v.mp4' }], selectedCandidateId: 'c1' },
      { id: 's2', position: 1, purpose: '特写', durationMs: 5000 },
    ],
  };
  const nodes = buildCanvasNodes({ uploads, libraryAssets, workbench });

  assert.ok(nodes.some(node => node.type === 'asset' && node.id === 'asset:upload:va1'));
  assert.ok(nodes.some(node => node.type === 'asset' && node.source === 'library' && node.projectAssetId === 'pa9'));
  assert.ok(nodes.some(node => node.type === 'asset' && node.source === 'workbench' && node.id === 'asset:workbench:wa1'));
  assert.ok(nodes.some(node => node.type === 'shot' && node.id === 'shot:s2'));
  const candidate = nodes.find(node => node.type === 'candidate');
  assert.equal(candidate.id, 'candidate:s1:c1');
  assert.equal(candidate.selected, true);

  // 已导入的上传素材不再重复出节点（由已确认素材卡表达）
  const importedAgain = buildCanvasNodes({
    uploads,
    workbench: { assets: [{ id: 'waX', approvedVersionId: 'wvX', versions: [{ id: 'wvX', sourceProjectAssetId: 'va1' }] }] },
  });
  assert.ok(!importedAgain.some(node => node.id === 'asset:upload:va1'));

  const positions = defaultCanvasLayout(nodes);
  const again = defaultCanvasLayout(buildCanvasNodes({ uploads, libraryAssets, workbench }));
  assert.deepEqual(positions, again);
  for (const node of nodes) {
    const position = positions[node.id];
    assert.ok(position && Number.isFinite(position.x) && Number.isFinite(position.y));
    if (node.type === 'candidate') {
      assert.ok(position.y > positions['shot:' + node.shotId].y);
    }
  }

  // 框选只命中素材类节点
  const laidOut = nodes.map(node => ({ ...node, ...positions[node.id] }));
  const rect = { x: 20, y: 30, width: 400, height: 400 };
  const picked = marqueeSelectAssetNodes(laidOut, rect);
  assert.ok(picked.length > 0);
  assert.ok(picked.every(id => String(id).startsWith('asset:')));
  assert.deepEqual(marqueeSelectAssetNodes(laidOut, null), []);
});

test('canvas edges: continuation plus first/last frame links stay visual-only', () => {
  const workbench = {
    shots: [
      { id: 's2', position: 1, bindings: [] },
      { id: 's1', position: 0, bindings: [{ assetId: 'wa1', role: 'first_frame' }, { assetId: 'wa2', role: 'style' }], firstFrameRef: { projectAssetId: 'pa1' }, lastFrameRef: { projectAssetId: 'pa2' } },
    ],
  };
  const edges = buildCanvasEdges(workbench);
  const continueEdge = edges.find(edge => edge.kind === 'continuation');
  assert.equal(continueEdge.label, '续写');
  assert.equal(continueEdge.from, 'shot:s1');
  assert.equal(continueEdge.to, 'shot:s2');
  const firstFrame = edges.find(edge => edge.kind === 'first_frame' && edge.from === 'asset:workbench:wa1');
  assert.ok(firstFrame, 'binding first_frame edge exists');
  const refChain = edges.filter(edge => Boolean(edge.fromProjectAssetId));
  assert.deepEqual(refChain.map(edge => edge.label).sort(), ['尾帧', '首帧链']);
});

test('generation bar: four modes gate by selection composition', () => {
  assert.equal(CANVAS_GENERATION_MODES.length, 4);
  assert.deepEqual(CANVAS_GENERATION_MODES.map(mode => mode.id), ['smart', 'reference', 'frame', 'remake']);
  assert.match(CANVAS_GENERATION_MODES[0].label, /文生/);
  assert.match(CANVAS_GENERATION_MODES[1].label, /图生|多图参考/);
  assert.match(CANVAS_GENERATION_MODES[2].label, /首尾帧链/);

  const image = { type: 'asset', kind: 'image', videoAssetId: 'a' };
  const video = { type: 'asset', kind: 'video', videoAssetId: 'b' };
  const audioOnly = [{ type: 'asset', kind: 'audio' }];

  assert.deepEqual(allowedGenerationModes([]), { smart: true, reference: false, frame: false, remake: false });
  assert.deepEqual(allowedGenerationModes([image]), { smart: true, reference: true, frame: false, remake: false });
  assert.equal(allowedGenerationModes([image, image]).frame, true);
  assert.equal(allowedGenerationModes([image, video]).remake, true);
  assert.equal(allowedGenerationModes(audioOnly).reference, false);

  assert.equal(resolveCanvasApiMode('smart', []), 'script');
  assert.equal(resolveCanvasApiMode('smart', [image]), 'reference');
  assert.equal(resolveCanvasApiMode('frame', [image, image]), 'frame');

  const chipIds = CAMERA_MOVE_CHIPS.map(chip => chip[0]);
  assert.ok(chipIds.includes('dolly_in') && chipIds.includes('tracking') && chipIds.length >= 5);
});

test('approval gate: no billing task before explicit approval', () => {
  assert.equal(schemeGate(null).phase, 'idle');
  assert.equal(schemeGate({ status: 'blocked', blockers: [{ code: 'X' }] }).phase, 'blocked');
  const ready = { status: 'ready', planHash: 'hash-1' };
  assert.equal(schemeGate(ready).phase, 'ready');
  assert.equal(schemeGate(ready).canApprove, true);
  const approved = { ...ready, approval: { planHash: 'hash-1' } };
  const gate = schemeGate(approved);
  assert.equal(gate.phase, 'approved');
  assert.equal(gate.approvedPlanHash, 'hash-1');
  // 哈希不一致视为未批准
  assert.equal(schemeGate({ ...approved, planHash: 'hash-2' }).phase, 'ready');

  assert.equal(shotGenerationReadiness(gate, {}).ok, true);
  assert.equal(shotGenerationReadiness(schemeGate(null), {}).ok, false);
  assert.match(shotGenerationReadiness(schemeGate(ready), {}).reason, /未批准生成方案前不会创建扣费任务/);
  assert.match(shotGenerationReadiness(gate, { planningOnly: true }).reason, /PLANNING 模式只做规划，不产生扣费任务/);
});

test('credit estimate range keeps billing visibility on plan card and shot nodes', () => {
  assert.deepEqual(pointsEstimateRange({ quotes: { short: { points: 12 }, long: { points: 30 } } }), { minPoints: 12, maxPoints: 30 });
  assert.deepEqual(pointsEstimateRange(null), null);
  const range = planPointsRange({
    quote: { points: 18 },
    routeRecommendation: { candidates: [{ eligible: true, estimatedPoints: 15.4 }, { eligible: true, estimatedPoints: 42 }] },
  });
  assert.deepEqual(range, { minPoints: 16, maxPoints: 42 });
  assert.equal(planPointsRange({ quote: { points: 9 } }).maxPoints, 9);
});

test('「产品图N」objective naming migrates into the left asset bring-in card', () => {
  const named = materialNaming([
    { kind: 'image', name: 'IMG_001.png' },
    { kind: 'video', name: 'clip.mov' },
    { kind: 'image', name: 'IMG_002.png' },
    { kind: 'audio', name: 'bgm.mp3' },
  ]);
  assert.deepEqual(named.map(item => item.objectiveName), ['产品图1', '视频1', '产品图2', '音频1']);
  assert.equal(named[0].badge, '商品图 × 参考图');
});

test('canvas workbench component wires the minimal P1 surface without touching EcCanvas', async () => {
  const component = await source('../src/pages/VideoStudio/VideoCanvasWorkbench.jsx');
  const model = await source('../src/pages/VideoStudio/videoCanvasModel.js');
  const styles = await source('../src/pages/VideoStudio/VideoCanvasWorkbench.css');

  // 三类卡片 + 拖拽摆位
  assert.match(component, /type === 'asset'/);
  assert.match(component, /type === 'candidate'/);
  assert.match(component, /className={?"?vcb-node is-shot/);
  assert.match(styles, /\.vcb-node\.is-shot \{/);
  assert.match(component, /setInteraction\(\{ kind: 'drag'/);
  assert.match(component, /handleNodePointerDown/);
  assert.match(styles, /\.vcb-node \{/);
  assert.match(styles, /\.vcb-stage \{/);
  assert.doesNotMatch(component, /EcCanvas/);
  assert.doesNotMatch(model, /EcCanvas/);

  // 框选 → 生成条（四模式 + 运镜 chips）
  assert.match(component, /marqueeSelectAssetNodes\(laidOutNodes, currentRect\)/);
  assert.match(component, /aria-label="画布生成条"/);
  assert.match(component, /CANVAS_GENERATION_MODES\.map/);
  assert.match(component, /CAMERA_MOVE_CHIPS\.map/);
  assert.match(component, /modeAvailability\[mode\.id\]/);
  assert.match(styles, /\.vcb-generation-bar \{/);
  assert.match(styles, /\.vcb-camera-chips \{/);
  assert.match(styles, /\.vcb-marquee \{/);
  assert.match(model, /export const CANVAS_GENERATION_MODES/);
  assert.match(model, /export const CAMERA_MOVE_CHIPS/);

  // 连线（续写 / 首尾帧）视觉层
  assert.match(component, /buildCanvasEdges\(workbench\)/);
  assert.match(component, /vcb-edge is-/);
  assert.match(styles, /\.vcb-edge\.is-continuation \{[^}]*dasharray/);
  assert.match(model, /续写/);

  // 单镜流：复用现有生成链 + 候选回挂 + 就近重试
  assert.match(component, /createVideoJob\(\{/);
  assert.match(component, /workbenchPlanHash:\s*gate\.approvedPlanHash/);
  assert.match(component, /quoteBillingAction\(\{ sku: skuQuote\.sku, quantity: 1 \}\)/);
  assert.match(component, /importJobCandidate\(projectId, entry\.shotId, \{ generationJobId: next\.id \}\)/);
  assert.match(component, /getVideoJob\(entry\.jobId\)/);
  assert.match(component, /initiateShotGeneration/);
  assert.match(component, /shotErrors\[node\.shotId\]/);
  assert.match(component, /onClick=\{\(\) => void initiateShotGeneration\(shot\)\}>重试</);
  assert.match(component, /OPEN_PAYWALL/);
  assert.match(component, /selectShotCandidate/);
  assert.match(component, /updateStoryboardShot/);
  assert.match(component, /createStoryboardShot/);

  // 左栏：意图输入 + 方案卡 + 审批门 + 积分预估区间
  assert.match(component, /一句话目标/);
  assert.match(component, /卖点/);
  assert.match(component, /比例/);
  assert.match(component, /data-testid="credit-estimate-range"/);
  assert.match(component, /积分预估区间/);
  assert.match(component, /planPointsRange|\.\.\./);
  assert.match(component, /approveVideoWorkbenchPlan/);
  assert.match(component, /createVideoWorkbenchGenerationDraft/);
  assert.match(component, /getVideoWorkbenchPlan/);
  assert.match(component, /批准生成/);
  assert.match(component, /未批准前不会产生扣费任务/);
  assert.match(component, /schemeGate\(plan\)/);
  assert.match(component, /shotGenerationReadiness\(gate, \{ planningOnly \}\)/);
  assert.match(component, /PLANNING · 规划不扣费/);

  // 「产品图N」命名迁入左栏
  assert.match(component, /materialNaming\(/);
  assert.match(component, /\{row\.objectiveName\}/);
  assert.match(component, /商品图 × 参考图/);
  assert.match(model, /产品图/);

  // 左栏素材带入保留导入并确认的持久化链（与旧瀑布一致）
  assert.match(component, /handleImportUpload/);
  assert.match(component, /handleImportLibrary/);
  for (const command of ['createWorkbenchAsset', 'importWorkbenchAssetVersion', 'importProjectAssetVersion', 'approveWorkbenchAssetVersion']) {
    assert.match(component, new RegExp(command));
  }
  assert.match(component, /expectedRevision: asset\.revision/);
  assert.match(component, /videoAssetId: upload\.asset\.id/);
  assert.match(component, /sourceProjectAssetRef|expectedContentHash/);
});

test('waterfall three-band layout is feature-flagged off behind the canvas default', async () => {
  const page = await source('../src/pages/VideoStudio/index.jsx');
  assert.match(page, /import VideoCanvasWorkbench from '\.\/VideoCanvasWorkbench\.jsx'/);
  assert.match(page, /import VideoProjectWorkbench from '\.\/VideoProjectWorkbench\.jsx'/);
  assert.match(
    page,
    /!embedded && capabilities\.directorUi !== true && capabilities\.workbenchEnabled && state\.logged && \([\s\S]*?capabilities\.waterfallWorkbench === true\s*\?\s*<VideoProjectWorkbench[\s\S]*?:\s*<VideoCanvasWorkbench/,
  );
  assert.match(page, /products=\{products\}/);
  assert.match(page, /uploadRecords=\{uploadRecords\}/);
  assert.match(page, /onPlanApprovalChange=\{setActiveVideoPlanHash\}/);
});
