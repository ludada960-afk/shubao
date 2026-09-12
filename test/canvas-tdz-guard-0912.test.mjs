// test/canvas-tdz-guard-0912.test.mjs
// 2026-09-12 血泪教训：画布组件里 useCallback 的「声明顺序」会决定进画布会不会崩。
// 我在 showToast 之前声明了 applyPlanLaunch，并在依赖里引用 showToast →
// 进画布瞬间 TDZ 抛错（Cannot access 'showToast' before initialization），整个画布崩掉，
// 用户只看到「空画布 + toast」。本地 QA 通道 ?qa=ec-plan-launch 才抓到。
// 本文件防止同类错误再犯：凡是在依赖里引用 showToast 的 useCallback，声明位置必须在 showToast 之后。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
const lines = source.split('\n');

const declarationLine = pattern => {
  const index = lines.findIndex(line => line.includes(pattern));
  return index < 0 ? -1 : index + 1;
};

test('showToast 与依赖它的 useCallback 的声明顺序正确（防 TDZ 崩画布）', () => {
  const showToastLine = declarationLine('const showToast = useCallback');
  assert.ok(showToastLine > 0, 'showToast 必须存在');
  const offenders = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].includes('useCallback')) continue;
    /* 找到该 useCallback 的依赖行 */
    let depLine = -1;
    for (let j = i; j < Math.min(i + 80, lines.length); j += 1) {
      if (/^\s*\},\s*\[[^\]]*\]\);?\s*$/.test(lines[j])) { depLine = j; break; }
    }
    if (depLine < 0) continue;
    if (!lines.slice(i, depLine + 1).some(line => /\[.*showToast.*\]/.test(line))) continue;
    if (lines[i].includes('const showToast = useCallback')) continue;
    if (i + 1 < showToastLine) offenders.push((i + 1) + ': ' + lines[i].trim().slice(0, 60));
  }
  assert.deepEqual(offenders, [], '以下 useCallback 在 showToast 之前声明却依赖它，会 TDZ 崩画布: ' + offenders.join(' | '));
});

test('本地验收通道存在（?qa=ec-plan-launch），仅 DEV 生效', () => {
  const qa = readFileSync(new URL('../src/pages/EcCanvas/canvasBrowserQaState.js', import.meta.url), 'utf8');
  assert.match(qa, /const PLAN_LAUNCH_QA_QUERY_VALUE = 'ec-plan-launch'/);
  const app = readFileSync(new URL('../src/store/AppContext.jsx', import.meta.url), 'utf8');
  assert.match(app, /enabled: import\.meta\.env\.DEV/, 'QA 通道仅 DEV 生效，线上不可命中');
});
