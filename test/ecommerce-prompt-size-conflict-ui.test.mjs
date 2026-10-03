// test/ecommerce-prompt-size-conflict-ui.test.mjs
// 尺寸冲突提示条 —— 2026-10-04 用户决定移除，本文件从「断言它接上了」改为「断言它不许回来」
//
// 原先这里断言：DesignDirection 导入 detectSizingConflict、渲染 <PromptSizeConflictNotice>、
// 一键切换写进 sizingPatch 并进入生成链路。
//
// 为什么移除：全局口径已定为「档位优先于提示词语义」（见
// src/pages/EcCanvas/canvasAdaptiveRatio.js 的规则说明）。面板上用户选了哪一档就是哪一档，
// 不需要再问一遍；更不该给一个「把面板改成提示词里那个尺寸」的按钮 ——
// 那等于让提示词借 UI 绕过去赢，与档位优先直接矛盾。
// 用户原话：「不用解释了」。
//
// ⚠️ promptSizeConflict.js 里的 parseSizeMentions **仍在用**（自适应解析提示词里的尺寸，
//    见 canvasAdaptiveRatio.js 与 skillRun.js），删掉的只是冲突检测 UI。
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';

import { stripComments } from '../scripts/lib/token-scope.mjs';

const directionFile = readFileSync(new URL('../src/pages/Home/ec/DesignDirection.jsx', import.meta.url), 'utf8');
const detector = readFileSync(new URL('../src/pages/Home/ec/promptSizeConflict.js', import.meta.url), 'utf8');
const noticePath = new URL('../src/pages/Home/ec/PromptSizeConflictNotice.js', import.meta.url);

/* ⚠️ 必须**剥掉注释再断言**（与 test/nano-model-single-source.test.mjs 同一条教训）：
   下面 192~196 行的说明注释里就写着 sizingPatch / dismissedConflict 这些名字，
   而注释恰恰是这里最该保住的文字 —— 它们记着"为什么删"。不去掉注释等于逼着
   下一个删注释让门禁好看。 */
const direction = stripComments(directionFile);

test('尺寸冲突提示条已移除，且不许复活', () => {
  assert.equal(existsSync(noticePath), false, '组件已删，不得复活');
  assert.doesNotMatch(direction, /PromptSizeConflictNotice/, 'DesignDirection 不得再引用它');
  assert.doesNotMatch(direction, /detectSizingConflict/, '冲突检测 UI 已下线，不得再接回');
});

test('随之而来的死代码一并清掉（sizingPatch 已无写入方）', () => {
  assert.doesNotMatch(direction, /sizingPatch/, 'sizingPatch 原本只被那个按钮写入，没有写入方就该删');
  assert.doesNotMatch(direction, /dismissedConflict/, '同理');
  /* 面板配置仍照原样进入生成链路，只是不再被提示条改写 */
  assert.match(direction, /imageSelections: params\?\.imageSelections \|\| params\?\.sizing\?\.images \|\| null/);
});

test('parseSizeMentions 必须还在 —— 自适应靠它解析提示词里的尺寸', () => {
  /* 这个模块删不得。提醒一句：它的能力是「把提示词里的尺寸变成比例参数」，
     而不是「提示用户面板和提示词不一致」。后者已下线，前者还在用。 */
  assert.match(detector, /export function parseSizeMentions/, '自适应要靠它，删了自适应就瞎了');
  assert.doesNotMatch(detector, /fetch\(|XMLHttpRequest|axios/, '仍是纯本地解析，不发任何请求');
});

test('详情图等角色的比例口径没被动过', () => {
  assert.match(detector, /MAIN_SCOPED_KEYS = Object\.freeze\(\['main_text', 'main_3x4', 'white_bg', 'white_background', 'transparent', 'sku', 'main'\]\)/);
});
