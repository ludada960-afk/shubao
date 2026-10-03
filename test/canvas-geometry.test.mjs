import assert from 'node:assert/strict';
import test from 'node:test';

import { cubicEdgePath, getNodePortCenter, layoutAssetLanes, mediaHeightForRatio, CANVAS_CARD_FOOTER_H } from '../src/pages/EcCanvas/canvasGeometry.js';

test('model geometry keeps a node port synchronized with its rectangle (9-11: 端点=加号中心, 外偏 17px)', () => {
  const node = { x: 10, y: 20, w: 200, h: 100 };
  /* 2026-10-02：y 从 70 改成 **整卡**中线。
     用户批注：「为什么你右边这些图片的线都没拉到加号上呢，你现在都是偏移加号上下面的呀」
     根因：端口 CSS 是 `top:50%`，参照物是**整张卡片**（媒体 + footer）；
     而这里原来算的是「只有媒体」的中线 ⇒ 端点比加号高了半个 footer。
     业界四家一致取**整卡**中线（React Flow top:50% / tldraw 完整 bounds /
     Excalidraw 完整 AABB / Draw.io exitY=0.5），**CSS 是对的，错的是模型**。
     横向不变：输入 = 左缘外 17px (10-17=-7)，输出 = 右缘外 17px (210+17=227)。 */
  const midY = 20 + (100 + CANVAS_CARD_FOOTER_H) / 2;
  assert.deepEqual(getNodePortCenter(node, 'input'), { x: -7, y: midY });
  assert.deepEqual(getNodePortCenter(node, 'output'), { x: 227, y: midY });
  assert.equal(cubicEdgePath({ x: 227, y: midY }, { x: 410, y: 130 }),
    `M 227 ${midY} C 318.5 ${midY}, 318.5 130, 410 130`);
});

test('asset lanes retain ratio geometry and place same-category outputs horizontally', () => {
  const nodes = layoutAssetLanes({
    sourceNode: { x: 30, w: 248 },
    assets: [
      { id: 'white-a', group: '白底图', ratio: '1:1' },
      { id: 'main-a', group: '主图', ratio: '1:1' },
      { id: 'main-b', group: '主图', ratio: '3:4' },
      { id: 'detail-a', group: '详情图', ratio: '3:4' },
    ],
  });
  const main = nodes.filter(node => node.group === '主图');
  assert.ok(nodes.find(node => node.id === 'white-a').y < main[0].y);
  assert.equal(main[0].y, main[1].y);
  assert.ok(main[1].x > main[0].x);
  assert.equal(main[1].h, mediaHeightForRatio('3:4', main[1].w));
  assert.ok(nodes.find(node => node.id === 'detail-a').y > main[0].y);
});
