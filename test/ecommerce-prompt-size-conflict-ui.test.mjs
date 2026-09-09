import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const direction = readFileSync(new URL('../src/pages/Home/ec/DesignDirection.jsx', import.meta.url), 'utf8');
const detector = readFileSync(new URL('../src/pages/Home/ec/promptSizeConflict.js', import.meta.url), 'utf8');
const notice = readFileSync(new URL('../src/pages/Home/ec/PromptSizeConflictNotice.js', import.meta.url), 'utf8');

test('prompt vs panel size conflict is surfaced before generation without extra API calls', () => {
  // 纯本地检测模块被真实接入
  assert.match(direction, /import \{ detectSizingConflict \} from '\.\/promptSizeConflict\.js'/);
  assert.match(direction, /detectSizingConflict\(\{/);
  // 检测只依赖提示词与面板配置，不发起任何网络请求
  assert.doesNotMatch(detector, /fetch\(|XMLHttpRequest|axios/);
  // 冲突必须对用户可见，且给出一键切换（渲染在独立纯展示组件里）
  assert.match(direction, /<PromptSizeConflictNotice/);
  assert.match(notice, /提示词里提到/);
  assert.match(notice, /把主图改为/);
  // 一键切换写进 sizingPatch，并真正进入报价/生成链路
  assert.match(direction, /const \[sizingPatch, setSizingPatch\] = useState\(null\)/);
  assert.match(direction, /sizing: \{ \.\.\.effectiveSizing, contentType: commerceContext\.contentType \}/);
  assert.match(direction, /imageSelections: sizingPatch\?\.images \|\|/);
  // 提示词只是"意图"，面板仍是硬参数事实源：不解析后直接覆盖比例
  assert.doesNotMatch(direction, /promptText\s*\.\s*match\([^)]*\)\s*;?\s*$/m);
});

test('detail ratios are never silently rewritten by the one-click suggestion', () => {
  assert.match(detector, /MAIN_SCOPED_KEYS = Object\.freeze\(\['main_text', 'main_3x4', 'white_bg', 'white_background', 'transparent', 'sku', 'main'\]\)/);
});
