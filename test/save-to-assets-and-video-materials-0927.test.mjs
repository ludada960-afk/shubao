/* ═══ 门禁：存到我的资产 + 视频素材还原（2026-09-27 批 CD / CE）════════════════════════════════
   用户口径（逐字）：
   「有**导入到我的资产**里面的功能，我不知道我们应该有哪些功能会比较好，这个你要帮我想清楚呀。」
   「**我的资产这边没有办法选项目呀，本来就没有新建项目的渠道吧，能新建的只有画布呀，
     你到底自己有没有去核查呀**」⇒ 这条是**纠正我的错**：我上一轮说"让用户选一个项目"是错的，
     站里根本没有手动建项目的入口。核查结果写进了 `saveWorkToAssets.js` 的文件头。
   「**视频素材还原不要因为麻烦就不做**，只要用户体验是最佳的，对我们的架构不产生 bug，那就可以做。」

   这一组守四件事：
     ① 落点是**隐式建/复用项目**（照画布那条链路），且**幂等**（重复点不堆重复素材）；
     ② 只认"生成图"那种地址形态，取不到 id 的一律不收；
     ③ 视频「用这组参数」要把 `refs_json` 里的输入素材翻成 `{id,url}` 带回去（纯函数可验）；
     ④ 带回来的素材**真的会进这次生成**（合并点只有一处），且缺 id/url 的被丢掉。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { GENERATED_PROJECT_TITLE, assetUrlsOfWork, generatedAssetIdOf } from '../src/pages/Home/saveWorkToAssets.js';
import { normalizePresetMaterials, videoJobMaterials } from '../src/pages/VideoStudio/videoMaterialsModel.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFileSync(join(ROOT, relative), 'utf8');
const asset = hex => '/api/generated-assets/' + hex.repeat(64) + '.png';

test('① 存到资产：落点是**隐式建项目**（站里没有手动建项目的入口）+ 幂等', () => {
  const source = read('src/pages/Home/saveWorkToAssets.js');
  /* 事实核查：项目只由画布/视频那几条链路隐式产生；这里是照它们做 */
  assert.match(source, /没有让用户手动建项目的入口|没有手动建项目的入口/, '要把"核查结论"写在文件头（免得下一轮又有人提议让用户选项目）');
  assert.match(source, /GENERATED_PROJECT_TITLE = '生成作品'/, '落点项目用一句人话当名字（它会显示在资产卡的副标题里）');
  assert.match(source, /idempotencyKey: GENERATED_PROJECT_KEY/, '建项目要带固定幂等键（连点不会越建越多）');
  assert.match(source, /const found = \(Array\.isArray\(projects\) \? projects : \[\]\)[\s\S]{0,140}=== GENERATED_PROJECT_TITLE/,
    '先按标题找已有的那个项目，找不到才建');
  assert.match(source, /if \(known\.has\(item\.id\)\) \{ skipped \+= 1; continue; \}/, '已经在库里的图跳过（重复点是常态）');
  assert.match(source, /addToProjectAssetLibrary\(projectId, asset\.projectAssetId, true\)/, '注册之后要设成"在资产库可见"');
  /* kind 只有四种，生成图没有"通用图片"那一档 —— 照画布那条链路取 ecommerce，并写明理由 */
  assert.match(source, /kind: 'ecommerce'/, 'kind 取值与画布那条链路一致');
  assert.match(source, /PROJECT_KINDS|只有四种/, '要写明 kind 只有四档这件事');
});

test('② 只认生成图那种地址；取不到 id 的不收', () => {
  assert.equal(generatedAssetIdOf(asset('a')), 'a'.repeat(64) + '.png');
  assert.equal(generatedAssetIdOf('/api/generated-assets/' + 'a'.repeat(63) + '.png'), '', '位数不对的不认');
  assert.equal(generatedAssetIdOf('/api/video-assets/' + 'a'.repeat(64) + '.png'), '', '别的目录不认');
  assert.equal(generatedAssetIdOf('https://cdn.example.com/x.png'), '', '外站地址不认');
  assert.equal(generatedAssetIdOf(''), '');
  assert.deepEqual(
    assetUrlsOfWork([asset('a'), asset('a'), '/api/uploads/x.png', asset('b')]).map(item => item.id),
    ['a'.repeat(64) + '.png', 'b'.repeat(64) + '.png'],
    '去重 + 只留生成图',
  );
});

test('③ 视频素材还原：`refs_json` → 创作台能吃的 {id,url}（纯函数）', () => {
  const materials = normalizePresetMaterials({
    first: [{ id: 'a1', url: '/api/video-assets/a1.png' }],
    images: [{ id: 'a2', url: '/api/video-assets/a2.png', name: '产品图' }, { id: 'a3', url: '' }, { url: '/x.png' }, {}],
    videos: [],
  });
  assert.deepEqual(Object.keys(materials).sort(), ['audios', 'first', 'images', 'last', 'videos'], '五个方向都要在（缺的给空数组）');
  assert.deepEqual(materials.images.map(item => item.id), ['a2'], '缺 url / 缺 id 的一律丢掉（给打不开的卡比不给更糟）');
  assert.equal(materials.first[0].name, '首帧1', '没名字的给一个可读名（按它在哪个位置：首帧/尾帧/图片/视频/音频 + 序号）');
  assert.deepEqual(normalizePresetMaterials(null).images, [], '没有 materials 的老任务要退回空集合（不能 undefined）');
  /* 生成侧：把服务端的 references 翻成 materials（**纯函数**，直接跑） */
  const fromJob = videoJobMaterials({
    firstImage: 'f1', lastImage: 'l1',
    images: ['i1', 'i2'], videos: ['v1'], audios: ['a1', 'missing'],
    urls: { f1: '/api/video-assets/f1.png', l1: '/api/video-assets/l1.png', i1: '/api/video-assets/i1.png', i2: '/api/video-assets/i2.png', v1: '/api/video-assets/v1.mp4', a1: '/api/video-assets/a1.mp3' },
  });
  assert.deepEqual(fromJob.first.map(item => item.id), ['f1'], '首帧要带回来');
  assert.deepEqual(fromJob.last.map(item => item.id), ['l1'], '尾帧要带回来');
  assert.deepEqual(fromJob.images.map(item => item.id), ['i1', 'i2'], '参考图要带回来');
  assert.deepEqual(fromJob.videos.map(item => item.id), ['v1']);
  assert.deepEqual(fromJob.audios.map(item => item.id), ['a1'], 'urls 里没有地址的那个丢掉');
  assert.equal(fromJob.images[0].name, '图片1', '没名字的给一个可读名');
  const page = read('src/pages/MediaCreation/index.jsx');
  assert.match(page, /import \{ videoJobMaterials \} from '\.\.\/VideoStudio\/videoMaterialsModel\.js'/, '翻服务端 refs 的是那个纯模块');
  assert.match(page, /materials: videoJobMaterials\(job\.references\)/, '「用这组参数」要把素材一起带回去');
});

test('④ 带回来的素材真的进这次生成，且合并点只有一处', () => {
  const video = read('src/pages/VideoStudio/index.jsx');
  assert.match(video, /const \[restoredAssets, setRestoredAssets\] = useState\(\(\) => normalizePresetMaterials\(null\)\)/,
    '创作台要有"带回来的素材"这份状态');
  assert.match(video, /setRestoredAssets\(normalizePresetMaterials\(preset\.materials\)\)/, '「用这组参数」时写进去');
  assert.match(video, /\[\.\.\.restoredAssets\.first, \.\.\.uploadedFirst\]/, '首帧要合并（带回来的在前）');
  assert.match(video, /\[\.\.\.restoredAssets\.images, \.\.\.uploadedImages\]\.slice\(0, 9\)/, '图片要合并并有上限');
  assert.doesNotMatch(video, /restoredAssets\.images, \.\.\.uploadedImages\][^\n]*\n[^\n]*restoredAssets\.images/,
    '不许在第二处再合并一次（一处就好）');
  /* 素材数要把带回来的算上：否则"CTA 说没素材、提交里却有图"账实不符 */
  assert.match(video, /const assetCount = \(mode === 'frame' \? files\.first\.length \+ files\.last\.length : materialEntries\.length\) \+ restoredCount;/,
    '素材计数要包含带回来的素材');
  /* 界面上看得见、能逐张移除 */
  assert.match(video, /已带入的素材（\{rows\.length\}）/, '要有一条"已带入的素材"显示');
  assert.match(video, /onClick=\{\(\) => dropRestoredAsset\(key, item\.id\)\}/, '每张都能移除');
});
