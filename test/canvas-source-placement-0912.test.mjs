// test/canvas-source-placement-0912.test.mjs
// 2026-09-12 用户批注（二次）：上传素材除了排在原图下面，**还不能互相重叠**。
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSourceStackPlacement } from '../src/pages/EcCanvas/canvasStudioModel.js';

test('新素材排在已有来源的下面（不压在原图上）', () => {
  const [slot] = resolveSourceStackPlacement({
    anchor: { x: 1000, y: 200 },
    existingSourceNodes: [{ x: 704, y: 200, w: 240, h: 240 }],
    entries: [{ w: 240, h: 260 }],
  });
  assert.equal(slot.x, 704, '与已有来源同一列');
  assert.ok(slot.y >= 200 + 240 + 28, 'y 必须在原图下方，实际 ' + slot.y);
});

test('被别的节点占住时继续往下让位，绝不重叠', () => {
  const blocker = { x: 704, y: 440, w: 240, h: 300 };
  const [slot] = resolveSourceStackPlacement({
    anchor: { x: 1000, y: 200 },
    existingSourceNodes: [],
    existingNodes: [blocker],
    entries: [{ w: 240, h: 240 }],
  });
  const overlap = slot.x < blocker.x + blocker.w && slot.x + 240 > blocker.x
    && slot.y < blocker.y + blocker.h && slot.y + 240 > blocker.y;
  assert.equal(overlap, false, '不得与已有节点重叠: ' + JSON.stringify(slot));
});

test('一次上传多张：彼此之间也不重叠，依次向下', () => {
  const slots = resolveSourceStackPlacement({
    anchor: { x: 1000, y: 100 },
    entries: [{ w: 240, h: 240 }, { w: 240, h: 260 }, { w: 264, h: 72 }],
  });
  assert.equal(slots.length, 3);
  for (let i = 1; i < slots.length; i += 1) {
    assert.ok(slots[i].y > slots[i - 1].y, '第 ' + i + ' 个必须在上一个下方');
  }
  assert.equal(new Set(slots.map(s => s.x)).size, 1, '同一列');
});
