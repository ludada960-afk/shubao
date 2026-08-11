import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/pages/Home/VisualCreationMode.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/pages/Home/VisualCreationMode.css', import.meta.url), 'utf8');

test('visual creation is a complete conversation-style image workbench', () => {
  assert.match(source, /VISUAL_CREATION_SKILLS/);
  assert.match(source, /uploadEcommerceAssets/);
  assert.match(source, /regenerateCanvasImage/);
  assert.match(source, /generationUnits/);
  assert.match(source, /saveWork/);
  assert.match(source, /buildVisualCanvasResult/);
  assert.match(source, /JPG、PNG、WebP/);
  assert.match(source, /最多 6 张/);
  assert.match(source, /placeholder=\{`描述你想生成的/);
  assert.match(source, /只重试失败项/);
  assert.match(source, /进入画布/);
  assert.match(source, /下载/);
  assert.match(source, /creationIntent:\s*'visual'/);
  assert.match(source, /自由创作，做出可继续编辑的视觉/);
  assert.doesNotMatch(source, /className="visual-skill-facts"/);
  assert.doesNotMatch(source, /<b>保留<\/b>|<b>适合<\/b>|<b>结果<\/b>/);
  assert.match(styles, /\.visual-skill-grid/);
  assert.match(styles, /width:\s*min\(1240px,\s*100%\)/);
  assert.match(styles, /\.visual-skill-stage/);
  assert.match(styles, /\.visual-creation-composer/);
  assert.match(styles, /@media \(max-width: 640px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});
