import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/login-dialog.css', import.meta.url), 'utf8');

test('login dialog keeps the card width but narrows the inner content column', () => {
  // 卡片宽度不变（用户确认宽度可以）
  assert.match(css, /\.ld-card \{[^}]*width: min\(600px, 100%\)/s);
  // 内部内容列收窄到 400px，且窄屏有 28px 下限
  assert.match(css, /\.ld-head \{[^}]*padding: 32px clamp\(28px, calc\(\(100% - 400px\) \/ 2\), 110px\) 0;/s);
  assert.match(css, /\.ld-body \{[^}]*padding: 26px clamp\(28px, calc\(\(100% - 400px\) \/ 2\), 110px\) 26px;/s);
  // 单一均匀背景色不变（此前修过的"背景重叠"回归护栏）。
  // 2026-09-20 §11：取值由自造 rgba 收敛到 L1 浮层实底 token（单一来源），护栏语义不变。
  assert.match(css, /\.ld-card \{[^}]*background-color: var\(--sb-surface-panel-solid\)/s);
  assert.ok(!/backdrop-filter/.test(css), '§11：登录遮罩与卡片均不得用 backdrop-filter');
});
