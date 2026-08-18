import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildVideoPlanningRequest,
  createVideoPlanningService,
  normalizeVideoPlanAnalysis,
} from '../server/videoPlanning.mjs';
import { normalizeShotDirection } from '../server/videoShotDirection.mjs';

test('shot direction normalizes researched cinematography controls without mutating input', () => {
  const source = {
    shotScale: 'macro',
    cameraAngle: 'overhead',
    cameraMove: 'dolly_in',
    lighting: 'rembrandt',
    primaryAction: '手指打开耳机盒',
    continuity: { axis: 'screen_left_to_right', gaze: 'toward_camera', screenDirection: 'left_to_right', transition: 'match_cut' },
    negativePrompt: '不要改变产品结构',
  };
  const normalized = normalizeShotDirection(source);
  assert.deepEqual(source, {
    shotScale: 'macro',
    cameraAngle: 'overhead',
    cameraMove: 'dolly_in',
    lighting: 'rembrandt',
    primaryAction: '手指打开耳机盒',
    continuity: { axis: 'screen_left_to_right', gaze: 'toward_camera', screenDirection: 'left_to_right', transition: 'match_cut' },
    negativePrompt: '不要改变产品结构',
  });
  assert.equal(normalized.shotScale, source.shotScale);
  assert.equal(normalized.cameraAngle, source.cameraAngle);
  assert.equal(normalized.cameraMove, source.cameraMove);
  assert.equal(normalized.lighting, source.lighting);
  assert.equal(normalized.primaryAction, source.primaryAction);
  assert.deepEqual(normalized.continuity, source.continuity);
  assert.equal(normalized.negativePrompt, source.negativePrompt);
  assert.equal(normalizeShotDirection({ shotScale: 'invented', cameraMove: 'bad' }).shotScale, 'medium');
  assert.equal(normalizeShotDirection({ shotScale: 'invented', cameraMove: 'bad' }).cameraMove, 'static');
  assert.equal(normalizeShotDirection({ primaryAction: 'x'.repeat(400) }).primaryAction.length, 240);
});

test('video planning request distinguishes the three creation modes and forbids invented facts', () => {
  for (const mode of ['smart', 'frame', 'remake']) {
    const request = buildVideoPlanningRequest({
      mode,
      prompt: '保留商品外观，镜头自然推进',
      duration: 8,
      ratio: '9:16',
      resolution: '720p',
      manifest: [{ name: 'reference.mp4', kind: 'video', role: 'videos', duration: 6 }],
    });
    assert.equal(request.mode, mode);
    assert.match(request.systemPrompt, /不得虚构未看见的商品、人物、品牌、台词或音频语义/);
    assert.match(request.systemPrompt, /smart=智能成片/);
    assert.match(request.systemPrompt, /frame=首尾帧过渡/);
    assert.match(request.systemPrompt, /remake=爆款重构/);
    assert.match(request.systemPrompt, /shotScale/);
    assert.match(request.systemPrompt, /primaryAction/);
    assert.match(request.userPrompt, new RegExp(`创作模式：${mode}`));
  }
});

test('video plan normalization rejects incomplete beats and missing executable prompt', () => {
  assert.throws(() => normalizeVideoPlanAnalysis({
    beats: [{ time: '0-2s', label: '开场', detail: '主体入画' }],
    optimizedPrompt: '主体入画',
  }), error => error.code === 'VIDEO_PLAN_INCOMPLETE');

  assert.throws(() => normalizeVideoPlanAnalysis({
    beats: [{}, {}, {}],
    optimizedPrompt: '',
  }), error => error.code === 'VIDEO_PLAN_INCOMPLETE');
});

test('video planning service forwards inspected frames and reports its analysis basis', async () => {
  let request;
  const service = createVideoPlanningService({
    completeText: async input => {
      request = input;
      return JSON.stringify({
        summary: '商品短片',
        creativeStrategy: '先展示细节，再进入使用场景',
        assets: [{ name: 'product.png', role: '商品', observations: ['浅色瓶身'], retain: ['瓶身比例'], use: '首镜头特写', confidence: 'high' }],
        beats: [
          { time: '0-2s', label: '建立商品', detail: '商品特写', source: 'product.png' },
          { time: '2-6s', label: '推进动作', detail: '镜头进入场景', source: 'reference.mp4', direction: { shotScale: 'wide', cameraMove: 'tracking', primaryAction: '人物走入画面' } },
          { time: '6-8s', label: '完成交付', detail: '稳定回到商品', source: 'product.png' },
        ],
        risks: ['参考视频与输出画幅不同'],
        optimizedPrompt: '保持浅色瓶身比例，从商品特写平滑推进到使用场景，禁止改变标签结构。',
      });
    },
  });
  const plan = await service.analyze({
    mode: 'smart',
    prompt: '生成商品短片',
    duration: 8,
    images: ['data:image/jpeg;base64,abc'],
    manifest: [
      { name: 'product.png', kind: 'image', role: 'images', width: 800, height: 800 },
      { name: 'reference.mp4', kind: 'video', role: 'videos', duration: 6 },
      { name: 'reference-frame.jpg', kind: 'video_frame', role: 'videos_keyframe', frameAt: 3 },
      { name: 'music.mp3', kind: 'audio', role: 'audios', duration: 8, audioEnergy: [0.1, 0.4] },
    ],
  });
  assert.deepEqual(request.images, ['data:image/jpeg;base64,abc']);
  assert.equal(plan.analysisBasis.imageFrames, 2);
  assert.equal(plan.analysisBasis.videoTracks, 1);
  assert.equal(plan.analysisBasis.audioTracks, 1);
  assert.equal(plan.analysisBasis.transcriptAvailable, false);
  assert.equal(plan.beats.length, 3);
  assert.equal(plan.beats[1].direction.shotScale, 'wide');
  assert.equal(plan.beats[1].direction.cameraMove, 'tracking');
  assert.equal(plan.beats[1].direction.primaryAction, '人物走入画面');
  assert.equal(plan.beats[0].direction.shotScale, 'medium');
});
