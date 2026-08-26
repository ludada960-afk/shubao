import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  CHAT_TWEAK_CHIPS,
  composeTweakPrompt,
  confirmedDecisionPromptParts,
  decisionQueueItems,
  DECISION_CARDS,
  emptyDecisionState,
  shotEventGroups,
  tweakRegenerationReady,
} from '../src/pages/VideoStudio/directorPanelModel.js';

const source = path => readFile(new URL(path, import.meta.url), 'utf8');

test('decision cards: four cards with explicit options and unconfirmed-by-default state', () => {
  assert.deepEqual(DECISION_CARDS.map(card => card.id), ['perspective', 'style', 'pace', 'weight']);
  assert.ok(DECISION_CARDS.every(card => Array.isArray(card.options) && card.options.length >= 2));
  assert.ok(DECISION_CARDS.some(card => card.title === '镜权重'));

  const fresh = decisionQueueItems(emptyDecisionState());
  assert.equal(fresh.length, 4);
  assert.ok(fresh.every(item => !item.confirmed && item.value === ''));

  // 未确认不扣费的契约面：未确认的决策绝不进入提示词片段。
  const state = emptyDecisionState();
  state.values.perspective = 'high_angle';
  assert.deepEqual(confirmedDecisionPromptParts(state), []);
});

test('decision confirmation: only confirmed non-empty decisions feed the generation prompt', () => {
  const state = emptyDecisionState();
  state.values.perspective = 'high_angle';
  state.values.style = 'cinematic';
  state.confirmed.style = true;
  const parts = confirmedDecisionPromptParts(state);
  assert.deepEqual(parts, ['风格：电影感']);
  state.confirmed.perspective = true;
  assert.deepEqual(confirmedDecisionPromptParts(state), ['视角：俯拍', '风格：电影感']);

  const items = decisionQueueItems(state);
  assert.equal(items.find(item => item.id === 'style').confirmed, true);
  assert.equal(items.find(item => item.id === 'pace').valueLabel, '');
});

test('event stream: grouped per shot with retryable failures and estimated cost labels', () => {
  const shots = [
    { id: 's1', position: 0, purpose: '开场' },
    { id: 's2', position: 1, purpose: '特写' },
  ];
  const trackedJobs = {
    j1: { jobId: 'j1', shotId: 's2', status: 'processing', progress: 42 },
    j2: { jobId: 'j2', shotId: 's1', status: 'failed', error: '上游超时' },
    j3: { jobId: 'j3', shotId: 's1', status: 'completed', progress: 100 },
    orphan: { jobId: 'orphan', shotId: 'ghost', status: 'queued' },
  };
  const groups = shotEventGroups({ shots, trackedJobs, planShots: [{ id: 's1', cost: { points: 12 } }] });
  assert.equal(groups.length, 3); // 按镜分组，未知镜头也保留（就近可见）
  assert.equal(groups[0].shotId, 's1');
  assert.equal(groups[0].points, 12);
  const failed = groups[0].events.find(event => event.tone === 'failed');
  assert.equal(failed.retryable, true);
  assert.match(failed.text, /上游超时/);
  assert.ok(groups[0].events.some(event => event.tone === 'done' && /候选已回挂/.test(event.text)));
  assert.ok(groups[1].events[0].tone === 'running');
  assert.match(groups[1].label, /镜头 02/);
  assert.equal(shotEventGroups({ shots, trackedJobs: {} }).length, 0);
});

test('chat tweaks: camera-move chips inject into regenerated prompt; gate enforced', () => {
  assert.equal(CHAT_TWEAK_CHIPS.length, 7);
  assert.ok(CHAT_TWEAK_CHIPS.some(([id]) => id === 'dolly_in'));

  const composed = composeTweakPrompt({
    basePrompt: '展示产品细节',
    instruction: '结尾停在 logo',
    chipIds: ['dolly_in', 'orbit'],
  });
  assert.match(composed, /^展示产品细节。运镜：推进→环绕。结尾停在 logo$/);
  assert.equal(composeTweakPrompt({ basePrompt: '', instruction: '', chipIds: [] }), '');
  assert.doesNotMatch(composeTweakPrompt({ basePrompt: 'x', chipIds: ['bogus'] }), /undefined/);

  assert.equal(tweakRegenerationReady({ prompt: '', gatePhase: 'approved' }).ok, false);
  assert.match(tweakRegenerationReady({ prompt: 'x', gatePhase: 'ready' }).reason, /批准生成方案/);
  assert.equal(tweakRegenerationReady({ prompt: 'x', gatePhase: 'approved' }).ok, true);
});

test('contract: inspector renders three labeled sections inside the canvas workbench', async () => {
  const jsx = await source('../src/pages/VideoStudio/VideoCanvasWorkbench.jsx');
  assert.match(jsx, /data-testid="decision-card-queue"/);
  assert.match(jsx, /data-testid="task-event-stream"/);
  assert.match(jsx, /data-testid="chat-tweaks"/);
  assert.match(jsx, /决策卡队列/);
  assert.match(jsx, /任务事件流/);
  assert.match(jsx, /改稿对话/);
  // 未确认不扣费文案必须出现在决策卡分区
  assert.match(jsx, /未确认不扣费|未确认.*不产生任何扣费/s);
  // 就近重试 + 预估扣费标注
  assert.match(jsx, /就近重试/);
  assert.match(jsx, /积分（预估）/);
});
