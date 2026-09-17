import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { creationNavigationContract } from '../src/pages/Home/creationShowcaseModel.js';

test('left navigation keeps video, canvas, and works on distinct destinations', () => {
  const contract = creationNavigationContract();
  assert.equal(contract.primary, 'home');
  assert.deepEqual(contract.video, { page: 'home', mode: 'video' });
  assert.equal(contract.canvas, 'ec-canvas');
  assert.deepEqual(contract.works, { page: 'ec-canvas', tab: 'works' });
});

test('source routing keeps video on the second nav and canvas on the third nav', async () => {
  const source = await fs.readFile(new URL('../src/components/layout/creativeDomainNavigation.js', import.meta.url), 'utf8');
  /* ⚠️ 2026-09-19 批 G 换判据（依据用户批注 #7-①）：
     原判据断的是「第一个域里有 id: 'video-studio' 这一项」——那次视频域还只有一条入口。
     现在视频域跟图片域一样是**总页面**，下拉里是本板块 6 条精品技能
     （用户原话：「这些现在都是跟其他的 skill 是平级的……他们都会进入到各自的子页面里面去」）。
     所以「视频挂在第二个域」这件事改成断言：**第二个域就是视频域、且它的 items 全是 video.* 子页面**；
     「画布挂在第三个」仍然断言它在工作台组里走 OPEN_CANVAS（行为一字未改）。 */
  const groups = source.slice(source.indexOf('export const CREATIVE_NAV_GROUPS'), source.indexOf('export function navigationGroupById'));
  const videoGroup = groups.slice(groups.indexOf("id: 'video'"));
  assert.ok(groups.indexOf("id: 'image'") < groups.indexOf("id: 'video'"), '图片域在前、视频域在后（与顶栏一致）');
  assert.match(videoGroup, /items:\s*GROUP_ITEMS\.video/, '视频域列的是本板块的精品技能');
  assert.match(source, /const GROUP_ITEMS = Object\.freeze\(\{[\s\S]*?video: Object\.freeze\(\[[\s\S]*?skillId: 'video\.smart'/);
  assert.match(source, /id: 'canvas'[\s\S]*?OPEN_CANVAS/);
});

test('home keeps the four creation modes in the primary creation hub', async () => {
  const source = await fs.readFile(new URL('../src/pages/Home/index.jsx', import.meta.url), 'utf8');
  assert.match(source, /mode: 'ecommerce'/);
  assert.match(source, /mode: 'video'/);
  assert.match(source, /mode: 'content'/);
  assert.match(source, /mode: 'visual'/);
});
