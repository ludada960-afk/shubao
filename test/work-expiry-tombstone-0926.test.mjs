/* ═══ 门禁：到期**墓碑 + 媒体回收**（2026-09-26 批 CA）══════════════════════════════════════════
   用户口径（逐字）：「保留期要不要清理，其实**取决于我们服务器压力大不大**，我觉得如果生成太多肯定是要
   清理的，但**你留下一张灰卡 + 已过期这个会影响服务器内存吗**」「这块你说成本会比较低，那你就做吧。」

   这一批要守四件事：
     ① **回收决策是纯函数、可验**：只有"过期作品独占"的文件才删；别的作品还在用的一律保留；
     ② **绝不误删**：地址必须逐字匹配 `/api/generated-assets/<64hex>.(png|jpg|webp)`，
        `../`、绝对路径、别的目录（上传件/项目资产/视频产物）一律不认；
     ③ 到期处理从"整行删"改成"**清空媒体字段 + 记 expired_at**"，墓碑只留"有过这么一次"；
     ④ 界面把过期记录渲染成**灰卡 + 已过期**，并且**不给**还原/下载/看大图（文件已回收，给了就是坑）。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { collectWorkAssetUrls, deleteAssetFiles, planAssetReclaim } from '../server/workAssetReclaim.mjs';
import { EXPIRED_BADGE, EXPIRED_NOTE, isExpiredWork } from '../src/pages/Home/mediaHistoryModel.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFileSync(join(ROOT, relative), 'utf8');
const asset = char => '/api/generated-assets/' + char.repeat(64) + '.png';

test('① 只删"过期作品独占"的文件：别的作品还在用的一个都不动', () => {
  const plan = planAssetReclaim({
    expiredWorks: [{ cover_url: asset('a'), image_urls: [asset('b'), asset('c')] }],
    liveWorks: [{ image_urls: [asset('b')] }],
    otherRefs: [asset('c')],
  });
  assert.deepEqual(plan.deletable, [asset('a').replace('/api/generated-assets/', '')], '只有 a 该删');
  assert.deepEqual(plan.keptByLive, [asset('b').replace('/api/generated-assets/', '')], 'b 被未过期作品引用 → 保留');
  assert.deepEqual(plan.keptByOthers, [asset('c').replace('/api/generated-assets/', '')], 'c 被项目资产引用 → 保留');
  /* 自证：把引用计数拿掉（无脑删过期记录里的全部地址），第一条必须红 */
  const naive = ['a', 'b', 'c'].map(name => name.repeat(64) + '.png');
  assert.notEqual(naive.length, plan.deletable.length, '如果不过滤引用关系，这组断言就不成立 ⇒ 判据不是空转');
});

test('② 绝不误删：只认那一种地址形态，别的目录/穿越路径一律不碰', () => {
  const work = {
    cover_url: '/api/generated-assets/' + 'd'.repeat(64) + '.png',
    image_urls: [
      '/api/generated-assets/../../etc/passwd',
      'https://evil.example.com/api/generated-assets/' + 'e'.repeat(64) + '.png',
      '/api/video-assets/' + 'f'.repeat(64) + '.mp4',
      '/api/generated-assets/SHORT.png',
      '/api/generated-assets/' + 'a'.repeat(63) + '.png',
    ],
  };
  assert.deepEqual(collectWorkAssetUrls(work), ['d'.repeat(64) + '.png'], '只有合法的那一条被收下');
  /* deleteAssetFiles 自己有第二道闸（名字不合法直接跳过）+ 只拼 assetDir 下的路径 */
  const files = deleteAssetFiles(['../../etc/passwd', 'd'.repeat(64) + '.png', 'not-a-name'], join(ROOT, 'definitely-not-here'));
  assert.deepEqual(files.deleted, []);
  assert.deepEqual(files.missing, ['d'.repeat(64) + '.png'], '合法名字但文件不存在 → 记 missing，不报错');
  /* ⚠️ 自证：`x` 不是十六进制字符，所以 'x'.repeat(64)+'.png' 会被第二道闸挡掉 —— 
     这条断言本身也是"非法名字不认"的样本（第一版我拿它当"合法名字"用，判据当场红）。 */
  assert.deepEqual(deleteAssetFiles(['x'.repeat(64) + '.png'], join(ROOT, 'definitely-not-here')).missing, []);
  const guard = read('server/workAssetReclaim.mjs');
  assert.match(guard, /if \(!\/\^\[a-f0-9\]\{64\}\\.\(\?:jpg\|png\|webp\)\$\/\.test\(String\(name \|\| ''\)\)\) continue;/,
    '删文件前必须再校验一次文件名（防目录穿越的第二道闸）');
});

test('③ 到期不再整行删：清空媒体字段 + 记 expired_at（墓碑）', () => {
  const source = read('server/worksRetention.mjs');
  assert.match(source, /UPDATE works SET expired_at = \?, cover_url = '', image_urls = '\[\]', pages = '\[\]'/,
    '到期要写成墓碑（清空媒体字段）而不是删行');
  assert.doesNotMatch(source, /DELETE FROM works WHERE id = \?/, '不许再整行删掉（那会让用户以为东西凭空消失）');
  /* ⚠️ 源码里这行 SQL 是**写在单引号字符串里**的，所以文件文本里带反斜杠转义 —— 判据要按文件原文写。 */
  assert.match(source, /COALESCE\(expired_at, \\'\\'\) = \\'\\'/, '已经过期的记录不该被反复扫出来处理');
  assert.match(source, /collectOtherAssetRefs\(db\)/, '要按"其它引用者"过滤（我的资产 / 视频产物）');
  /* 迁移：works 表要有 expired_at 列 */
  assert.match(read('server/db.mjs'), /ALTER TABLE works ADD COLUMN expired_at TEXT DEFAULT ''/, '缺列要能自动补上');
  assert.match(read('server/db.mjs'), /row\.expired_at \? \{ expired_at: row\.expired_at, _expired: true \}/,
    '读取时要把墓碑标记带给前端');
});

test('④ 界面：过期记录是灰卡 + 已过期，且不给还原/下载/看大图', () => {
  assert.equal(isExpiredWork({ _expired: true }), true);
  assert.equal(isExpiredWork({ expired_at: '2026-09-26 10:00:00' }), true);
  assert.equal(isExpiredWork({ title: 'x' }), false);
  assert.equal(EXPIRED_BADGE, '已过期');
  assert.match(EXPIRED_NOTE, /无法再打开或下载/, '说明要讲清后果');
  const page = read('src/pages/MediaCreation/index.jsx');
  assert.match(page, /const expired = isExpiredWork\(work\);/, '历史要把墓碑认出来');
  assert.match(page, /cover: expired \? '' : \(urls\[0\] \|\| ''\)/, '过期的不给封面（文件已经没了）');
  assert.match(page, /downloads: expired \? \[\] : urls/, '过期的不给下载');
  assert.match(page, /values: expired \? null :/, '过期的不给"用这组参数"（面板值也一起清掉了）');
  assert.match(page, /\.filter\(item => item\.cover \|\| item\.expired\)/, '没有封面但过期的记录要留在列表里（不然又是"凭空消失"）');
  const workbench = read('src/pages/Home/SkillWorkbench.jsx');
  /* ⚠️ 批 CB：历史列表改成按天分组后，组内每一项叫 `row` —— 判据跟着改锚点。 */
  assert.match(workbench, /row\.expired \?/, '工作台要按"过期"换一种渲染（灰卡）');
  assert.match(workbench, /已过期/, '灰卡上要写"已过期"');
});
