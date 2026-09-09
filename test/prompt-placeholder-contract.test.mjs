import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const homeCss = readFileSync(new URL('../src/pages/Home/Home.css', import.meta.url), 'utf8');

test('prompt placeholders disappear as soon as the user types (including IME composition)', () => {
  // 受控 textarea：有内容即隐藏自定义占位层
  assert.match(homeCss, /\.hero-textarea:not\(:placeholder-shown\) \+ \.custom-placeholder \{/);
  // 输入法组合期：预编辑文本已在 DOM，但受控状态尚未提交，也必须立刻隐藏
  assert.match(homeCss, /\.ec-textarea-wrap:has\(\.mention-prompt-field:not\(:empty\)\) \.ec-textarea-placeholder/);
  assert.match(homeCss, /\.ec-textarea-wrap:has\(textarea:not\(:placeholder-shown\)\) \.ec-textarea-placeholder/);
});
