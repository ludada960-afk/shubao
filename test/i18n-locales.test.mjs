// test/i18n-locales.test.mjs
// 薯包 P-H 国际化基础 (4c183cd4 续命): 5 语 60 文案完整性 + 关键文案值正确性 + useT 入口
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_LOCALE,
  LOCALE_META,
  STRINGS,
  SUPPORTED_LOCALES,
  listKeys,
  translate,
  validateLocale,
} from '../src/i18n/locales.js';

import {
  useT,
  useLocale,
  switchLocale,
  getCurrentLocale,
} from '../src/i18n/useT.js';

test('i18n: 5 语均受支持', () => {
  assert.deepEqual(SUPPORTED_LOCALES, ['zh-CN', 'en-US', 'ja-JP', 'ko-KR', 'es-ES']);
  assert.equal(SUPPORTED_LOCALES.length, 5);
  assert.equal(DEFAULT_LOCALE, 'zh-CN');
});

test('i18n: 6 大类 × 10 key = 60 关键文案', () => {
  const keys = listKeys();
  assert.equal(keys.length, 60);
  for (const cat of ['nav', 'common', 'video', 'ec', 'error', 'locale']) {
    assert.ok(STRINGS[cat], `category ${cat} exists`);
    assert.equal(Object.keys(STRINGS[cat]).length, 10, `category ${cat} has 10 keys`);
  }
  for (const k of keys) {
    assert.ok(k.includes('.'), `key '${k}' has dot separator`);
  }
});

test('i18n: 5 语每一语都完整 (60/60)', () => {
  for (const loc of SUPPORTED_LOCALES) {
    const r = validateLocale(loc);
    assert.equal(r.total, 60, `${loc} total=60`);
    assert.equal(r.complete, true, `${loc} complete: missing=${JSON.stringify(r.missing)}`);
    assert.equal(r.missing.length, 0);
  }
});

test('i18n: 关键文案值正确性 (跨 5 语抽样)', () => {
  const samples = [
    ['nav.home', 'en-US', 'Home'],
    ['nav.home', 'ja-JP', 'ホーム'],
    ['nav.home', 'ko-KR', '홈'],
    ['nav.home', 'es-ES', 'Inicio'],
    ['common.confirm', 'en-US', 'Confirm'],
    ['video.create_button', 'en-US', 'Generate Video'],
    ['video.create_button', 'ja-JP', '動画を生成'],
    ['video.create_button', 'ko-KR', '비디오 생성'],
    ['ec.white_bg', 'en-US', 'White Background'],
    ['ec.white_bg', 'es-ES', 'Fondo blanco'],
    ['error.network_error', 'en-US', 'Network error'],
    ['error.quota_exceeded', 'ja-JP', 'クォータ超過'],
    ['locale.welcome', 'en-US', 'Welcome to Shubao'],
    ['locale.tagline', 'ko-KR', 'AI 창작 플랫폼'],
  ];
  for (const [k, loc, expect] of samples) {
    assert.equal(translate(k, loc), expect, `${k} @ ${loc} = ${expect}`);
  }
});

test('i18n: translate 默认 locale = zh-CN', () => {
  assert.equal(translate('nav.home'), '首页');
  assert.equal(translate('common.cancel'), '取消');
});

test('i18n: translate fallback 行为', () => {
  // 不存在的 locale -> 走 zh-CN
  assert.equal(translate('nav.home', 'fr-FR'), '首页');
  // 不存在的 category -> 原 key 返
  assert.equal(translate('foo.bar', 'en-US'), 'foo.bar');
  // 不存在的 subkey -> 原 key 返
  assert.equal(translate('nav.nothing', 'en-US'), 'nav.nothing');
  // key 缺段 -> 原 key 返
  assert.equal(translate('no-dot', 'en-US'), 'no-dot');
  // 空字符串 -> '' (无 key)
  assert.equal(translate('', 'en-US'), '');
  // null / undefined -> 返回 key 自身 (回退实现)
  assert.equal(translate(null, 'en-US'), null);
  assert.equal(translate(undefined, 'en-US'), undefined);
});

test('i18n: LOCALE_META 5 语完整', () => {
  for (const loc of SUPPORTED_LOCALES) {
    const m = LOCALE_META[loc];
    assert.ok(m, `meta ${loc} exists`);
    assert.equal(m.code, loc);
    assert.ok(typeof m.label === 'string' && m.label.length > 0);
    assert.equal(m.dir, 'ltr');
  }
});

test('i18n: useT 入口导出 (不调用 hook, 仅校验 module 形状)', () => {
  assert.equal(typeof useT, 'function');
  assert.equal(typeof useLocale, 'function');
  assert.equal(typeof switchLocale, 'function');
  assert.equal(typeof getCurrentLocale, 'function');
  const cur = getCurrentLocale();
  assert.ok(SUPPORTED_LOCALES.indexOf(cur) !== -1, `current locale '${cur}' is supported`);
});

test('i18n: 5 语均无空字符串 (sanity)', () => {
  for (const cat of Object.keys(STRINGS)) {
    for (const sub of Object.keys(STRINGS[cat])) {
      for (const loc of SUPPORTED_LOCALES) {
        const v = STRINGS[cat][sub][loc];
        assert.ok(typeof v === 'string' && v.length > 0, `${cat}.${sub} @ ${loc} non-empty`);
      }
    }
  }
});
