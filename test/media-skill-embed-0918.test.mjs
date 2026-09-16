import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { stripComments } from '../scripts/lib/token-scope.mjs';

/* ═══ 子页面就地跑完（2026-09-17 用户改口径）══════════════════════════════════════
   用户原话：「生成结果直接在工作台里面展示，不必像之前一样生成完就一定要跳进去画布里面……
   如果是在子页面的工作台生成的，结果就会在各自的子页面历史记录里面。」

   这一条守的是**接线**（而不是那条链路本身跑不跑得通）：
     ① 小红书图文 / 视频的既有工作台真的被嵌进了子页面（不是又写了一份壳）；
     ② 嵌入形态下结果与历史都留在本页（结果台要渲染、历史要按技能筛）；
     ③ 换技能必须重挂载（否则上一条技能的提示词/素材会串到下一次生成里 —— 那是会花钱的串味）；
     ④ 本机任务标记只是**展示用标签**，绝不许沾到计费、幂等、重试。

   为什么用测试守：这几处接线一处断了都不会报错，只会表现为"点了没反应"或"结果不见了"，
   而那正是用户最反感、也最难查的那类 bug。 */

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const media = read('src/pages/MediaCreation/index.jsx');
const shell = read('src/components/media/WorkbenchShell.jsx');
const workbench = read('src/pages/Home/SkillWorkbench.jsx');
const video = read('src/pages/VideoStudio/index.jsx');
const xhs = read('src/pages/Home/XhsContentMode.jsx');
const tags = read('src/pages/VideoStudio/videoJobTags.js');

test('① 两条重流程都嵌进子页面：组件是既有那一份，不是又写一个壳', () => {
  /* 嵌进来的必须是首页在用的同一个组件（import 路径唯一）——
     另写一份"子页面专用版"就等于把两条链路维护两遍，用户下一个批注会打在错的那一份上。 */
  assert.match(media, /import XhsContentMode from '\.\.\/Home\/XhsContentMode\.jsx'/);
  assert.match(media, /import VideoStudioPage from '\.\.\/VideoStudio\/index\.jsx'/);
  assert.match(media, /<XhsContentMode key=\{skill\.id\} compactMode historySkillId=\{skill\.id\} \/>/);
  assert.match(media, /<VideoStudioPage[\s\S]{0,240}?embedded[\s\S]{0,240}?inlineResult/);
  /* 首页用的也是这两个组件（同一份实现） */
  const home = read('src/pages/Home/index.jsx');
  /* 首页那条也传了 inlineResult（生成完就地看成片），所以只锁"用的是同一个组件的嵌入形态" */
  assert.match(home, /<VideoStudioPage embedded[^>]*\/>/);
  assert.match(home, /<XhsContentMode compactMode/);
});

test('② 换技能必须重挂载嵌进来的工作台（否则参数会串味，且会花钱）', () => {
  /* ⚠️ 先剥注释再数：解释"为什么要 key"的那段注释里必然写着 key={skill.id}，
     把注释算成用法就是在惩罚"把来龙去脉写清楚"（本项目已有过同类教训）。 */
  const strippedMedia = stripComments(media);
  const keys = strippedMedia.match(/key=\{skill\.id\}/g) || [];
  assert.equal(keys.length, 2, '两块嵌入组件都要带 key（图文 + 视频各一处）');
});

test('③ 嵌入形态下结果留在本页：结果台要渲染，且不许自动跳进画布', () => {
  const stripped = stripComments(video);
  /* inlineResult 打开时，结果台（成片播放器 + 生成记录）必须渲染 */
  assert.match(stripped, /{!\(?embedded|embedded|\).{0,80}inlineResult[sS]{0,120}video-result-workbench/);
  assert.match(media, /inlineResult/);
  /* 按技能落创作方式页签（映射本身由 media-skill-run-0917 第 ⑨b 条守） */
  assert.match(media, /initialMode=\{skillVideoMode\(skill\)\}/);
  /* ═══ 自动跳画布：只在"生成发生在哪一页"上做区分 ═══
     用户 9-17：「生成结果直接在工作台里面展示，不必像之前一样生成完就一定要跳进去画布里面。
     唯一需要跳进去画布的，可能只有首页那个视频生成/图片生成的输入框。」
     → 子页面传 autoOpenCanvas={false}（结果留在成片台，想去画布点那个显式按钮）；
       首页与独立路由保持默认（9-12 已确认的"完成即自动进入"）。
     这条必须守：video 侧那个 useEffect 一旦无条件跑，用户在子页面刚出片就被弹出这一页，
     历史、结果台、刚生成的成片全看不见了 —— 而且**看起来像"功能没做"**，最难查。 */
  assert.match(stripComments(media), /autoOpenCanvas=\{false\}/, '子页面必须关掉自动跳画布');
  assert.match(stripComments(video), /if \(!autoOpenCanvas\) return;/, '自动跳必须接受开关');
  assert.match(stripComments(video), /autoOpenCanvas = true/, '默认保持"完成即自动进入"（首页与独立路由不变）');
});

test('④ 历史这一块：图文按 mediaSkillId、视频按本机标记，两边都不许丢记录', () => {
  /* 图文作品带的身份 —— 少了它，图文生成完不会出现在这条技能的历史里 */
  assert.match(xhs, /mediaSkillId: historySkillId, visualSkillId: historySkillId/);
  /* 图文作品的图在 cover_url / image_urls 里，必须走 contentResultModel 解析，
     按 work.images 读只会得到 0 张、然后被 filter 静默丢掉。 */
  assert.match(media, /isContentResult\(work\) \? contentResultPages\(work\)/);
  assert.match(media, /videoJobsOfSkill\(videoJobs, skill\?\.id\)/);
  /* 历史条目：没有可还原的参数就不放「用这组参数」按钮（点了只弹一句"无法还原"是坑） */
  assert.match(workbench, /\{?\(item\.values \|\| item\.restore\)/);
  /* 视频历史能还原提示词与规格 */
  assert.match(media, /setVideoSeed\(\{ \.\.\.item\.restore\.videoJob \}\)/);
  assert.match(video, /if \(typeof preset\.prompt === 'string'\) setPrompt\(preset\.prompt\)/);
});

test('⑤ 本机任务标记只是展示标签：不许出现在计费 / 幂等 / 重试判断里', () => {
  /* 标记的唯一用途 = 子页面历史筛选。它一旦被拿去参与计费或幂等判断，
     换台设备/清缓存就会变成"重复扣费"或"任务丢了"——那是钱的问题，不是显示问题。 */
  assert.match(tags, /不参与任何计费、幂等、重试判断/);
  const billingFiles = [
    'src/services/api.js',
    'src/services/billing.js',
    'src/pages/VideoStudio/index.jsx',
  ];
  for (const path of billingFiles) {
    const source = stripComments(read(path));
    assert.doesNotMatch(source, /videoJobSkill\(/, path + ' 不许用本机标记做判断');
  }
  /* 视频侧只允许"创建成功后打标"这一处调用 */
  const tagCalls = stripComments(video).match(/tagVideoJob\(/g) || [];
  assert.equal(tagCalls.length, 1, 'tagVideoJob 只允许在创建成功后调用一次');
  assert.match(video, /if \(skillTag\) tagVideoJob\(result\.job\.id, skillTag\)/);
});
