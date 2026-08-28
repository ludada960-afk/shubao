import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyProductProfileFactsToPlog,
  applyProductProfileFactsToXhs,
  buildProductProfilePromptTail,
  profileTextList,
} from '../src/pages/Home/ec/crossModeProductProfile.js';

test('buildProductProfilePromptTail flattens facts in stable visual order', () => {
  const tail = buildProductProfilePromptTail({
    name: '便携水杯',
    category: '家居',
    facts: {
      material: '陶瓷',
      dimensions: '350ml',
      baseColor: '白色',
      accentColor: '莫兰迪蓝',
      sellingPoints: '轻便耐热 · 24h保温',
      usage: '办公室下午茶',
      targetAudience: '都市白领',
    },
  });
  assert.match(tail, /商品: 便携水杯/);
  assert.match(tail, /类目: 家居/);
  assert.match(tail, /材质: 陶瓷/);
  assert.match(tail, /规格: 350ml/);
  assert.match(tail, /主色: 白色/);
  assert.match(tail, /配色: 莫兰迪蓝/);
  assert.match(tail, /卖点: 轻便耐热 · 24h保温/);
  assert.match(tail, /场景: 办公室下午茶/);
  assert.match(tail, /人群: 都市白领/);
});

test('buildProductProfilePromptTail tolerates missing facts and stringly fields', () => {
  const tail = buildProductProfilePromptTail({ name: '  极简款  ' });
  assert.equal(tail, '商品: 极简款');
  assert.equal(buildProductProfilePromptTail({}), '');
  assert.equal(buildProductProfilePromptTail(null), '');
});

test('profileTextList splits by both half-width and full-width separators', () => {
  assert.deepEqual(profileTextList('保湿,24h；持久\n便携'), ['保湿', '24h', '持久', '便携']);
  assert.deepEqual(profileTextList(''), []);
  assert.deepEqual(profileTextList(null), []);
});

test('applyProductProfileFactsToXhs writes back XhsContentMode ec state setters', () => {
  const calls = {
    productName: '',
    category: '',
    sellingPoints: '',
    material: '',
    targetAudience: '',
    restrictions: '',
  };
  const setters = {
    setEcName: value => { calls.productName = value; },
    setEcCat: value => { calls.category = value; },
    setEcProductPoints: value => { calls.sellingPoints = value; },
    setEcMaterial: value => { calls.material = value; },
    setEcTargetAudience: value => { calls.targetAudience = value; },
    setEcRestrictions: value => { calls.restrictions = value; },
  };
  const result = applyProductProfileFactsToXhs({
    name: '极简水杯',
    category: '家居',
    facts: {
      material: '陶瓷',
      craft: '磨砂釉',
      sellingPoints: '轻便,24h保温\n易清洁',
      targetAudience: '都市白领',
      restrictions: '不可微波',
    },
  }, setters);
  assert.equal(result.ok, true);
  assert.equal(calls.productName, '极简水杯');
  assert.equal(calls.category, '家居');
  assert.equal(calls.sellingPoints, '轻便, 24h保温, 易清洁');
  assert.equal(calls.material, '陶瓷 · 磨砂釉');
  assert.equal(calls.targetAudience, '都市白领');
  assert.equal(calls.restrictions, '不可微波');
});

test('applyProductProfileFactsToXhs falls back to facts.category when profile.category is missing', () => {
  const calls = { category: '' };
  applyProductProfileFactsToXhs({ name: 'x', facts: { category: '美妆' } }, {
    setEcCat: v => { calls.category = v; },
  });
  assert.equal(calls.category, '美妆');
});

test('applyProductProfileFactsToXhs returns ok=false when no setter matches or no facts exist', () => {
  const result = applyProductProfileFactsToXhs({ name: 'x' }, {});
  assert.equal(result.ok, false);
  assert.deepEqual(result.applied, []);

  const empty = applyProductProfileFactsToXhs({}, { setEcName: () => undefined });
  assert.equal(empty.ok, false);
});

test('applyProductProfileFactsToXhs skips missing setter keys gracefully', () => {
  // 部分 setEcXxx 不存在时, 不抛错, 仍然写入可写入的字段。
  const calls = { name: '' };
  const result = applyProductProfileFactsToXhs({ name: '单品' }, {
    setEcName: v => { calls.name = v; },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.applied, ['productName']);
  assert.equal(calls.name, '单品');
});

test('applyProductProfileFactsToPlog appends the tail to the existing prompt', () => {
  let captured = '独居日常｜周末宅家看书喝咖啡';
  const setText = value => { captured = typeof value === 'function' ? value(captured) : value; };
  const ok = applyProductProfileFactsToPlog({
    name: '陶瓷马克杯',
    category: '家居',
    facts: { material: '陶瓷', baseColor: '白色', sellingPoints: '轻便' },
  }, setText);
  assert.equal(ok, true);
  assert.match(captured, /^独居日常｜周末宅家看书喝咖啡\n\n商品: 陶瓷马克杯/);
  assert.match(captured, /卖点: 轻便/);
});

test('applyProductProfileFactsToPlog does not duplicate tail if already present', () => {
  const tail = buildProductProfilePromptTail({
    name: '陶瓷马克杯',
    facts: { material: '陶瓷' },
  });
  const original = `独居日常\n\n${tail}`;
  let captured = original;
  const setText = value => { captured = typeof value === 'function' ? value(captured) : value; };
  applyProductProfileFactsToPlog({ name: '陶瓷马克杯', facts: { material: '陶瓷' } }, setText);
  assert.equal(captured, original);
});

test('applyProductProfileFactsToPlog returns false for empty profile facts', () => {
  let captured = 'keep';
  const setText = value => { captured = typeof value === 'function' ? value(captured) : value; };
  assert.equal(applyProductProfileFactsToPlog({}, setText), false);
  assert.equal(captured, 'keep');
  assert.equal(applyProductProfileFactsToPlog(null, setText), false);
});
