import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('the shared ecommerce workbench inserts real image mentions on home and step two', async () => {
  const workbench = await readFile(new URL('../src/pages/Home/ec/EcommerceWorkbench.jsx', import.meta.url), 'utf8');
  const direction = await readFile(new URL('../src/pages/Home/ec/DesignDirection.jsx', import.meta.url), 'utf8');

  assert.match(workbench, /ImageMentionPicker/);
  assert.match(workbench, /promptFieldRef\.current\?\.insertMention\(image\.label\)/);
  assert.match(workbench, /<MentionPromptField ref=\{promptFieldRef\}/);
  assert.match(workbench, /deck\.productRail\.map/);
  assert.match(workbench, /role: ['"]product['"]/);
  assert.match(workbench, /deck\.referenceRail\.map/);
  assert.match(workbench, /role: ['"]reference['"]/);
  assert.match(direction, /<EcommerceWorkbench/);
});

test('the mention picker preserves the editor selection before inserting on first click', async () => {
  const field = await readFile(new URL('../src/components/creation/MentionPromptField.jsx', import.meta.url), 'utf8');
  const picker = await readFile(new URL('../src/components/creation/ImageMentionPicker.jsx', import.meta.url), 'utf8');

  assert.match(field, /useImperativeHandle/);
  assert.match(field, /insertMention/);
  assert.match(field, /selectionRangeRef/);
  assert.match(picker, /onPointerDown=\{event => event\.preventDefault\(\)\}/);
  assert.match(field, /onBeforeInput=\{rememberSelection\}/);
  assert.match(field, /onCompositionStart/);
  assert.match(field, /onCompositionEnd/);
  assert.match(field, /rememberSelection\(\);[\s\S]*?onChange\?\./);
});

test('Xiaohongshu and Plog prompts share the image mention picker', async () => {
  const source = await readFile(new URL('../src/pages/Home/XhsContentMode.jsx', import.meta.url), 'utf8');

  assert.match(source, /ImageMentionPicker/);
  assert.match(source, /insertMentionInTextarea/);
  assert.match(source, /insertImageMentionAt/);
  assert.match(source, /xhsPromptRef/);
  assert.match(source, /plogPromptRef/);
  assert.doesNotMatch(source, /appendImageMention\(inputText, image\.label\)/);
  assert.doesNotMatch(source, /appendImageMention\(plogText, image\.label\)/);
});

test('video and canvas mention pickers insert at the remembered caret', async () => {
  const [video, canvasStudio, canvasPage, picker] = await Promise.all([
    readFile(new URL('../src/pages/VideoStudio/index.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/EcCanvas/components/CanvasStudio.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/creation/ImageMentionPicker.jsx', import.meta.url), 'utf8'),
  ]);

  assert.match(video, /promptFieldRef\.current\?\.insertMention\(file\.label\)/);
  assert.match(video, /<MentionPromptField[\s\S]*?ref=\{promptFieldRef\}/);
  /* 2026-09-16：视频那段自写的 @ 菜单已删除，改用全站共用的 ImageMentionPicker ——
     「保住输入框光标/选区」的 preventDefault 跟着实现搬进了共用组件：判据不变，位置变了。 */
  assert.match(picker, /onPointerDown=\{event => event\.preventDefault\(\)\}/, '菜单项必须 preventDefault（保住输入框选区）');
  assert.match(video, /<ImageMentionPicker/, '视频侧必须用共用 @ 组件（不再自写一套）');
  assert.match(canvasStudio, /promptFieldRef\.current\?\.insertMention\(source\.label\)/);
  assert.match(canvasStudio, /skipPromptInsert:\s*true/);
  assert.match(canvasPage, /options\.skipPromptInsert/);
});
