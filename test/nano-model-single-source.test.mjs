// test/nano-model-single-source.test.mjs
// 契约：**nano 两档的上游模型名只能在一处声明**。
// ─────────────────────────────────────────────────────────────────────────────
// 起因是一次真实故障（2026-09-15 第 18 轮）：
//   · `modelCatalog.selectGenerationModel` 里写死 'gemini-2.5-flash-image'；
//   · 供应商把该模型下架，换成了 'gemini-3.1-flash-image'；
//   · 适配器用**自己的**默认值做白名单校验 → 两边各写一份、谁也不知道对方写的是什么；
//   · 结果：用户选 nano-banana-2 得到「模型当前不可用」。
//
// 现在收成一处：`NANO_UPSTREAM_MODELS`（provider 适配器导出，目录引用）。
//
// ⚠️ 本契约初版**判据太粗**，当场被抓出两处假阳性，写在这里提醒下一个人：
//   ① 它把**注释里**的旧名字也算成了用法 —— 而那几行注释恰恰是在解释这个 bug 的由来，
//      是知识库里最该保住的文字（与 legacy-token-family「剥注释再计数」是同一条教训）；
//   ② 它把**别族**的模型 id（如 advanced 族的 'gemini-3-image'）也当成了 nano 的名字。
//   → 修正：先剥注释（复用 scripts/lib/token-scope.mjs 的同一份实现），且只认 nano 形态
//      `gemini-<版本>-(flash|pro)-image`。
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { NANO_UPSTREAM_MODELS } from '../server/ecommerceEngine/nanoBananaProviderAdapter.mjs';
import { stripComments } from '../scripts/lib/token-scope.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WATCHED = [
  'server/ecommerceEngine/modelCatalog.mjs',
  'server/ecommerceEngine/nanoBananaProviderAdapter.mjs',
];
const DECLARED = new Set(Object.values(NANO_UPSTREAM_MODELS));
/** nano 形态：gemini-<版本>-(flash|pro)-image（不含别族的 gemini-3-image 之类） */
const NANO_SHAPED = /'(gemini-[0-9][a-z0-9.]*-(?:flash|pro)-image)'/g;

/** 找出「nano 形态、但不在声明里」的字面量；**先剥注释**（导出以便自证） */
export function findStrayModelLiterals(text) {
  const out = [];
  for (const m of stripComments(text).matchAll(NANO_SHAPED)) if (!DECLARED.has(m[1])) out.push(m[1]);
  return out;
}

test('① 检测器自证：过期名字必须抓得到', () => {
  assert.deepEqual(
    findStrayModelLiterals("if (x) return 'gemini-2.5-flash-image';"),
    ['gemini-2.5-flash-image'],
    '过期名字必须被抓出来（这正是当初那个 bug 的形态）',
  );
  assert.deepEqual(findStrayModelLiterals('return NANO_UPSTREAM_MODELS.flash;'), [], '引用声明的写法不得误报');
});

test('①b 检测器自证：注释里的旧名字不算用法，别族的模型 id 也不算', () => {
  assert.deepEqual(
    findStrayModelLiterals("/* 曾写死 'gemini-2.5-flash-image'，已改为引用声明 */"),
    [],
    '注释是说明文字，不是用法 —— 否则门禁在奖励「删注释让数字好看」',
  );
  assert.deepEqual(findStrayModelLiterals("GEMINI_3_IMAGE: 'gemini-3-image',"), [],
    '别族的模型 id 不属本契约管（它有自己的声明）');
});

test('② 声明的两档必须不同，且都是 nano 形态的名字', () => {
  assert.notEqual(NANO_UPSTREAM_MODELS.flash, NANO_UPSTREAM_MODELS.pro, '两档指向同一个上游模型 = 「换档」是假的');
  for (const [tier, name] of Object.entries(NANO_UPSTREAM_MODELS)) {
    assert.ok(DECLARED.has(name), tier + ' 的名字不在声明集合里：' + name);
    assert.match(name, /^gemini-[0-9][a-z0-9.]*-(flash|pro)-image$/, tier + ' 的名字形态不对：' + name);
  }
});

test('③ 受管文件里不得出现「不在声明里」的 nano 上游模型名', () => {
  const offenders = [];
  for (const rel of WATCHED) {
    for (const name of findStrayModelLiterals(readFileSync(path.join(ROOT, rel), 'utf8'))) {
      offenders.push(rel + ' → ' + name);
    }
  }
  assert.deepEqual(offenders, [],
    '以下位置写了不在 NANO_UPSTREAM_MODELS 里的 nano 上游模型名（供应商下架后会变成「模型当前不可用」）：' +
    offenders.join(' / ') + ' —— 正确做法：改 NANO_UPSTREAM_MODELS 一处，其余引用它。');
});