import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildDynamicXhsAnalysisRequest,
  buildDynamicXhsVisualRequest,
  buildDynamicPlogRequest,
  compileDynamicXhsVisual,
  createDynamicPlogFallback,
  createDynamicXhsFallback,
  deriveXhsCreativeDirection,
  normalizeDynamicXhsAnalysis,
  normalizeDynamicXhsVisual,
  normalizeDynamicPlogPlan,
} from '../server/xhsCreativePlanner.mjs';

test('creative direction is stable for retries and varies across new runs', () => {
  const first = deriveXhsCreativeDirection('run-a');
  assert.deepEqual(first, deriveXhsCreativeDirection('run-a'));
  const ids = ['run-a', 'run-b', 'run-c', 'run-d', 'run-e'].map(id => deriveXhsCreativeDirection(id).id);
  assert.ok(new Set(ids).size >= 3);
});

test('dynamic XHS analysis plans eight editable pages without fixed tracks', () => {
  const direction = deriveXhsCreativeDirection('run-a');
  const request = buildDynamicXhsAnalysisRequest({ text: '记录一次周末城市漫游', visionContext: '低饱和自然光', direction });
  assert.match(request.systemPrompt, /不按固定赛道模板/);
  assert.match(request.userPrompt, /恰好8个内容页/);
  const analysis = normalizeDynamicXhsAnalysis({
    topic: '城市记录', title: '周末城市漫游', body_text: '从街角开始记录。',
    pages: Array.from({ length: 8 }, (_, i) => ({ page_id: i + 1, title: `第${i + 1}页`, story: '真实内容' })),
  }, { direction });
  assert.equal(analysis.pages.length, 8);
  assert.equal(analysis.creative_direction, direction.id);
});

test('dynamic visual and Plog plans normalize to complete delivery shapes', () => {
  const direction = deriveXhsCreativeDirection('run-b');
  const analysis = normalizeDynamicXhsAnalysis({ title: '一篇记录', body_text: '正文', pages: Array.from({ length: 8 }, (_, i) => ({ page_id: i + 1, title: `页${i + 1}` })) }, { direction });
  const visualRequest = buildDynamicXhsVisualRequest({ analysis, direction });
  assert.match(visualRequest.userPrompt, /必须有8条image_prompts/);
  const visual = normalizeDynamicXhsVisual({ cover_prompt: '封面', visual_system: '编辑感', image_prompts: Array.from({ length: 8 }, (_, i) => ({ page_id: i + 1, prompt: `p${i + 1}` })) }, analysis, direction);
  assert.equal(visual.imagePrompts.length, 8);
  const plogRequest = buildDynamicPlogRequest({ text: '周末咖啡', scene: '居家日常', direction });
  assert.match(plogRequest.systemPrompt, /不使用固定赛道镜头库/);
  const plog = normalizeDynamicPlogPlan({ caption: '周末片段', lenses: Array.from({ length: 9 }, (_, i) => ({ zh: `镜头${i + 1}`, en: `shot ${i + 1}` })), copy_lines: Array.from({ length: 9 }, (_, i) => `句子${i + 1}`) });
  assert.equal(plog.lenses.length, 9);
  assert.equal(plog.copyLines.length, 9);
});

test('content planning can request complete JSON and legacy LLM failures use the verified gateway', () => {
  const server = fs.readFileSync(new URL('../server/index.mjs', import.meta.url), 'utf8');
  assert.match(server, /maxTokens\s*=\s*1500[\s\S]*Math\.min\(Math\.max\(Number\(maxTokens\)/);
  assert.match(server, /Vision gateway fallback:[\s\S]*callMiniLLM|callMiniLLM\(systemPrompt, \[\], String\(userContent/);
});

test('model-independent fallbacks preserve the nine-page contract without fixed tracks', () => {
  const direction = deriveXhsCreativeDirection('fallback-run');
  const analysis = createDynamicXhsFallback({
    text: '周末在图书馆看书。窗边光线很好。回家路上整理了笔记。',
    direction,
  });
  assert.equal(analysis.pages.length, 8);
  assert.equal(analysis.creative_direction, direction.id);
  assert.match(analysis.body_text, /图书馆/);

  const visual = compileDynamicXhsVisual({ analysis, direction });
  assert.match(visual.coverPrompt, new RegExp(analysis.title));
  assert.equal(visual.imagePrompts.length, 8);
  assert.equal(new Set(visual.imagePrompts.map(item => item.prompt)).size, 8);

  const plog = createDynamicPlogFallback({
    text: '咖啡店的下午。雨停后走回家。',
    direction,
    count: 9,
  });
  assert.equal(plog.lenses.length, 9);
  assert.equal(plog.copyLines.length, 9);
});

test('content generation keeps compact planning, complete-set retries and a long client stream window', () => {
  const server = fs.readFileSync(new URL('../server/index.mjs', import.meta.url), 'utf8');
  const client = fs.readFileSync(new URL('../src/services/api.js', import.meta.url), 'utf8');
  assert.match(server, /maxTokens:\s*6500/);
  assert.match(server, /return createDynamicXhsFallback/);
  assert.match(server, /return compileDynamicXhsVisual/);
  assert.match(server, /generateCompleteImageSet\(\{[\s\S]*label: 'plog-'/);
  assert.ok((server.match(/signal:\s*AbortSignal\.timeout\(45_000\)/g) || []).length >= 3);
  assert.match(client, /720000/);
  assert.match(client, /generateContentStream[\s\S]*headers:\s*signedSessionHeaders\(\{ 'Content-Type': 'application\/json' \}\)/);
});
