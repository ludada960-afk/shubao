import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/components/business/Modals.jsx', import.meta.url), 'utf8');

test('login keeps an explicit email-edit action during OTP cooldown and clears development copy', () => {
  assert.match(source, /修改邮箱/);
  assert.doesNotMatch(source, /mockMode|本地开发模式/);
});

test('production dialogs do not use blocking browser prompts', () => {
  assert.doesNotMatch(source, /window\.(?:alert|confirm|prompt)/);
});
