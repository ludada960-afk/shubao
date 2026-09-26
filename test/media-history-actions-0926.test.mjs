/* ═══ 门禁：生成记录的**状态标签 / 下载 / 时间 / 保留期**（2026-09-26 批 BZ）════════════════════
   用户口径（逐字）：
   「我不知道你生成之后是在哪里呢？是在历史那个地方吗？然后它会配备哪些功能呢？……
     比如说是不是会有**重刷**的功能？有**删除**的功能，有**下载**的功能，有**导入到我的资产**里面的功能……
     还有就是他们是不是也得有一个**遮罩的标签**这样？那这个标签应该备注是什么呢？……
     它的**排版**，它的**时间**这些东西是不是也得加进去呢？」

   这一批落地的是其中"先说清事实"的那几件（设计稿见 docs/design/86）：
     ① 视频记录**也要有时间**（改前只有 `秒数 · 分辨率 · 比例`）；
     ② 状态标签统一成三档中文，**正常不显示**、**不许透传英文状态**；
     ③ **下载**：有可下的东西才给按钮；文件名能认出"哪一次、第几张"；
     ④ 保留期那句是**事实**（7 天），与「我的作品」工作区那句、与服务端保留期**三处一致**。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { downloadFileName, videoStatusLabel } from '../src/pages/Home/mediaHistoryModel.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFileSync(join(ROOT, relative), 'utf8');

test('① 状态标签只有三档中文，且**不许透传服务端状态**', () => {
  assert.equal(videoStatusLabel('queued'), '排队中');
  assert.equal(videoStatusLabel('pending'), '排队中');
  assert.equal(videoStatusLabel('processing'), '生成中');
  assert.equal(videoStatusLabel('running'), '生成中');
  assert.equal(videoStatusLabel('failed'), '生成失败');
  assert.equal(videoStatusLabel('cancelled'), '生成失败');
  assert.equal(videoStatusLabel(''), '生成中');
  /* 没见过的状态：兜底成中文，**不许把英文原样吐出去** */
  const unknown = videoStatusLabel('some_new_provider_state');
  assert.equal(unknown, '生成中');
  assert.doesNotMatch(unknown, /[a-z]/i, '状态标签里不许出现英文（用户看不懂）');
  /* 页面里不许再出现"直接拼服务端状态"的写法（改前那行就是这么冒英文的） */
  const page = read('src/pages/MediaCreation/index.jsx');
  assert.match(page, /badge: done \? '' : videoStatusLabel\(job\.status\)/, '未完成的视频记录要过状态映射');
  assert.doesNotMatch(page, /badge: done \? '' : String\(job\.status/, '又直接把服务端状态拼上去了');
  /* 自证：把映射换成"原样返回"，第一条断言必须红 */
  const broken = (status) => String(status || '生成中');
  assert.notEqual(broken('queued'), '排队中', '如果标签是原样透传，上面那条就不成立 ⇒ 这条判据不是空转');
});

test('② 视频记录也要有时间（与图片记录同一口径）', () => {
  const page = read('src/pages/MediaCreation/index.jsx');
  const videoBlock = page.slice(page.indexOf('const fromVideos'), page.indexOf('return [...fromVideos'));
  assert.match(videoBlock, /formatWorkTime\(job\.createdAt/, '视频记录的副标题里要带上时间');
  assert.match(videoBlock, /subtitle: \[seconds \? seconds \+ ' 秒' : '', job\.resolution \|\| '', job\.aspectRatio \|\| job\.aspect_ratio \|\| '', time\]/,
    '时间排在规格后面（`秒数 · 分辨率 · 比例 · 时间`），与图片那条 `N 张 · 时间` 同一读法');
  const imageBlock = page.slice(page.indexOf('const time = formatWorkTime(work'), page.indexOf('const fromVideos'));
  /* ⚠️ 批 CA：图片那条的副标题多了一档"过期"（`已过期 · 时间`），所以判据改成"两条分支都在、都带 time"。 */
  assert.match(imageBlock, /\[urls\.length \? urls\.length \+ ' 张' : '', time\]/, '在保留期内的口径没变');
  assert.match(imageBlock, /\['已过期', time\]/, '过期的那种也要说清是哪一天过期的（同一条读法）');
});

test('③ 下载：有可下的东西才给按钮；文件名认得出是哪一次、第几张', () => {
  /* 文件名 */
  assert.equal(downloadFileName({ title: '秋日限定', url: 'https://shuimg.cn/a/b.png', index: 0, count: 3 }), '秋日限定-1.png');
  assert.equal(downloadFileName({ title: '秋日限定', url: 'https://shuimg.cn/a/b.png', index: 2, count: 3 }), '秋日限定-3.png');
  assert.equal(downloadFileName({ title: '秋日限定', url: 'https://shuimg.cn/a/b.png', index: 0, count: 1 }), '秋日限定.png');
  assert.equal(downloadFileName({ title: '一条 15 秒口播', url: 'https://shuimg.cn/v/x.mp4', count: 1, video: 'https://shuimg.cn/v/x.mp4' }), '一条 15 秒口播.mp4');
  /* 地址里读不出扩展名时：单条成片按 mp4、其余按 png */
  assert.equal(downloadFileName({ title: 'x', url: 'https://shuimg.cn/api/generated-assets/abc', count: 1, video: 'v' }), 'x.mp4');
  assert.equal(downloadFileName({ title: 'x', url: 'https://shuimg.cn/api/generated-assets/abc', count: 1 }), 'x.png');
  /* 标题里的路径不安全字符要被清掉（否则本地存不下来） */
  assert.equal(downloadFileName({ title: 'a/b:c*d?e"f<g>h|i', url: '.png', count: 1 }), 'a_b_c_d_e_f_g_h_i.png');
  /* 标题为空退回技能名；都为空才用兜底词 */
  assert.equal(downloadFileName({ title: '', fallback: '概念视觉方案', url: 'a.png', count: 1 }), '概念视觉方案.png');
  assert.equal(downloadFileName({ url: 'a.png', count: 1 }), '作品.png');
  /* 按钮：只有真的有东西可下才出现
     ⚠️ 批 CB：历史列表改成按天分组后，组内每一项叫 `row`（不再是 `item`）—— 判据跟着改锚点。 */
  const workbench = read('src/pages/Home/SkillWorkbench.jsx');
  assert.match(workbench, /\(row\.cover \|\| row\.video \|\| \(Array\.isArray\(row\.downloads\) && row\.downloads\.length\)\)\s*\n?\s*&& <button type="button" className="skill-history-download"/,
    '没出片/没有结果的记录不许给「下载」（点了没反应就是坑）');
  assert.match(workbench, /onHistoryDownload\?\.\(row\)/, '按钮要接到页面传下来的处理器');
  /* 页面侧：图片整组都下、视频下成片
     ⚠️ 批 CA：过期的记录不给下载（文件已回收）—— 判据里带上这一档。 */
  const page = read('src/pages/MediaCreation/index.jsx');
  assert.match(page, /downloads: expired \? \[\] : urls,/, '图片记录要带上整组地址（过期的那种不给下）');
  assert.match(page, /downloads: done \? \[job\.resultUrl\] : \[\],/, '视频记录只在出片后带地址');
  assert.match(page, /anchor\.download = downloadFileName\(/, '文件名走共用实现');
  assert.match(page, /onHistoryDownload=\{downloadHistory\}/, '页面要把处理器传给工作台');
});

test('④ 保留期那句话是**事实**：与工作区、与服务端三处一致', () => {
  const workbench = read('src/pages/Home/SkillWorkbench.jsx');
  const workspace = read('src/pages/EcCanvas/index.jsx');
  const server = read('server/worksRetention.mjs');
  const days = Number((server.match(/DEFAULT_RETENTION_DAYS = (\d+)/) || [])[1]);
  assert.ok(days > 0, '读不到服务端默认保留天数 ⇒ 这条判据失效了');
  assert.match(workbench, new RegExp('生成记录保留 ' + days + ' 天'), '历史面板顶部要如实写保留期');
  assert.match(workspace, new RegExp('作品保留 ' + days + ' 天'), '工作区那句也要是同一个数');
  /* 自证：把服务端天数换成 30，上面两条正则就都不再匹配 —— 说明这三处是真的绑在一起的 */
  assert.doesNotMatch(workbench, new RegExp('生成记录保留 30 天'), '保留天数不是写死的两份，而是跟着服务端读出来的');
});
