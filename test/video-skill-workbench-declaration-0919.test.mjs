import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { stripComments } from '../scripts/lib/token-scope.mjs';
import { VIDEO_SKILLS } from '../src/skills/videoSkills.js';
import { VIDEO_WORKBENCHES, VIDEO_WORKBENCH_TABS, getVideoWorkbench } from '../src/skills/videoWorkbenches.js';

/* ═══ 视频侧「skill → 工作台规格」声明源（批 N，2026-09-19）════════════════════════════
   用户第 18 轮原话（逐字）：
     「你为什么没办法进入 https://laoyu.quantv.com/store-visit-video 他们这些 skill 页面去抄他们的工作台呢，
       **每个工作台都是不一样的呀**，你现在完全没抄，用的依然是我们之前首页的视频生成版本糊弄我，
       我说的明明是抄他们**所有的各个视频生成的子页面**啊，**对应的一比一去抄**啊」
     「就是这**每个页面你都要点进去抄**呀……你之前做图片生成的那些子页面的时候明明都可以做到啊」
   用户第 19 轮又补：「视频生成和图片生成他们的这两边的 skill 子页面是**类似的逻辑**，
       都是要去抄他们的工作台和案例区的。所以你现在就**全部去统一你的标准去照抄**就对了。」

   取证：docs/design/64-quantv-video-skill-pages.md §8 —— 知渔 20 个视频 skill 子页面的**逐字抄录**
        （CDP 实访，原文/计数上限/上传限制/占位文案/模型与视频设置/主 CTA 与预计积分）。
   本门禁守四件事：
     ① **每条主档视频 skill 都有自己的工作台**（不许再"所有子页面共用一个通用创作台"）；
     ② 工作台**逐条写着它抄的是知渔哪一页**（source），且知渔那 20 条 URL 一条不少地出现在声明源里；
     ③ 上传块的两个入口与竞品同款文案、且写了可拖拽就真的能拖（与图片侧同一条判据）；
     ④ **不许放假按钮**：接不通的付费动作一律 wired 缺省 + reason，页面渲染成静态说明行。 */

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
/* ⚠️ 这里**不能**用 stripComments：渲染器里有 'image 斜杠星号' 这个 accept 字面量，
   而 stripComments 不是字符串感知的 —— 它会把那个字面量里的「斜杠星号」当成注释开头，
   一路吞到下一个「星号斜杠」为止（实测把「点击或拖拽上传图片」那一整段都抹成了空白，
   门禁于是报"文案不在"，而文案其实在）。所以这里读**原文**，
   并且断言写成**精确的 JSX 表达式**（不是散字），避免命中的是注释里的同名文字。 */
const component = read('src/components/media/VideoWorkbench.jsx');
const studio = stripComments(read('src/pages/VideoStudio/index.jsx'));
const media = stripComments(read('src/pages/MediaCreation/index.jsx'));
const spec = read('docs/design/64-quantv-video-skill-pages.md');

/* 知渔视频 skill 子页面 —— **31 条**（docs/design/64 §8 抄录表）。
   ⚠️ 本轮**更正**：上一版只列了 20 条（用户给的 19 条 + 本轮补的「短剧风格」），
      实测 /apps 的「视频制作」区一共 **31 张卡片**（.tmp/laoyu2/video-apps-urls.json 逐张点开拿到），
      漏掉的 11 条是建筑室内第二批（室内装修/卧室就寝/餐厅聚餐/家装布置/建筑生长/植物生长/
      建筑分镜电影制作/商业热闹/寒冬降临/建筑图转视频）+ 创意应用的趣味脱口秀。
      用户第 18 轮原话：「就是这**每个页面你都要点进去抄**呀」⇒ 一条都不能少。 */
const QUANTV_PAGES = [
  'https://laoyu.quantv.com/ai-video',
  'https://laoyu.quantv.com/content-replace',
  'https://laoyu.quantv.com/store-visit-video',
  'https://laoyu.quantv.com/video-recreation',
  'https://laoyu.quantv.com/digital-human',
  'https://laoyu.quantv.com/video-high-definition',
  'https://laoyu.quantv.com/video-subtitle-removal',
  'https://laoyu.quantv.com/apps?id=cmr94utrm000b2xm0zvqfb49a',
  'https://laoyu.quantv.com/apps?id=cmr1w7wvz00z914i3f5h4hifu',
  'https://laoyu.quantv.com/apps?id=cmr1w7twq00z514i3hw6s0clk',
  'https://laoyu.quantv.com/apps?id=cmr1w7qqt00z314i3r4rnmzfs',
  'https://laoyu.quantv.com/apps?id=cmra7sgh009eg9vzgzwmnn68g',
  'https://laoyu.quantv.com/apps?id=cmra7o96y09cj9vzg3oml6su6',
  'https://laoyu.quantv.com/apps?id=cmra7k5zy09am9vzg3m52gaud',
  'https://laoyu.quantv.com/apps?id=cmra7fik209979vzgmz2vpwy7',
  'https://laoyu.quantv.com/apps?id=cmr97klck001i9vzg58za4env',
  'https://laoyu.quantv.com/apps?id=cmr9777qu013q2xm0qrvn3cdi',
  'https://laoyu.quantv.com/apps?id=cmr973iuh011n2xm0giaodt4m',
  'https://laoyu.quantv.com/apps?id=cmr96y3mb00ys2xm0z0y7540a',
  'https://laoyu.quantv.com/apps?id=cmr96q1ai00u82xm0zp8dhinr',
  /* ── 第二批 11 条（本轮补全）────────────────────────────────────────────── */
  'https://laoyu.quantv.com/apps?id=cmr96eilw00p42xm0uocpkuwp',
  'https://laoyu.quantv.com/apps?id=cmr96b5p400mb2xm006sh9o35',
  'https://laoyu.quantv.com/apps?id=cmr965qf700k52xm0d3q3g1dv',
  'https://laoyu.quantv.com/apps?id=cmr960avj00j52xm0cv4e527q',
  'https://laoyu.quantv.com/apps?id=cmr95whex00hm2xm0mxtqjly9',
  'https://laoyu.quantv.com/apps?id=cmr95g674008o2xm0e6tk58ne',
  'https://laoyu.quantv.com/apps?id=cmr1w901f011114i3dyig00lf',
  'https://laoyu.quantv.com/apps?id=cmr1w8xhw010z14i3i9kz9a7q',
  'https://laoyu.quantv.com/apps?id=cmr1w8rja010u14i3hpueua4o',
  'https://laoyu.quantv.com/apps?id=cmr1w8lt2010q14i3bfmj1xvn',
  'https://laoyu.quantv.com/apps?id=cmr1w7n9000z114i3rvzyd4c8',
];

/* 这三条是**辅助能力**（tier: assistant），它们没有自己的子页面 ——
   运镜是创作台里的一个控件、延长续写当前没有能力、画面修改长在爆款复刻里。
   所以它们不需要工作台（fuses.slot 已经写明归宿）。 */
const ASSISTANT_IDS = VIDEO_SKILLS.filter(skill => skill.tier === 'assistant').map(skill => skill.id);

test('① 每条主档视频 skill 都有自己的工作台（不许所有子页面共用一个通用创作台）', () => {
  const mains = VIDEO_SKILLS.filter(skill => skill.tier !== 'assistant').map(skill => skill.id);
  assert.ok(mains.length >= 30, '主档视频 skill 数量对不上：' + mains.length);
  for (const id of mains) {
    const spec2 = getVideoWorkbench(id);
    assert.ok(spec2, id + ' 没有工作台声明 —— 子页面又会退回"首页那套通用创作台"（用户说的"糊弄"）');
    assert.ok(Array.isArray(spec2.blocks), id + ' 的 blocks 必须是数组');
  }
  /* 辅助能力不该有自己的工作台（它们的归宿是控件 / 融合，见 fuses） */
  for (const id of ASSISTANT_IDS) {
    assert.equal(VIDEO_WORKBENCHES[id], undefined, id + ' 是辅助能力，不该占一个工作台');
  }
  /* 工作台之间**必须真的不一样**：如果每条都长一个样，那就是没抄。
     批 P：统计范围从"只有借了知渔 URL 的"改成**全部工作台** —— 上一版正是这条筛选让我
     把自有玩法都硬指到一个 URL 上（凑够形态数），现在如实统计。 */
  const shapes = new Set(Object.values(VIDEO_WORKBENCHES)
    .map(item => item.blocks.map(block => block.kind + ':' + (block.title || '')).join('|')));
  assert.ok(shapes.size >= 20, '工作台形态只有 ' + shapes.size + ' 种 —— 用户要的是"每个工作台都不一样"');
});

/* ═══ 批 P：这条门禁**判据变了**（不是放宽，是改正）═══════════════════════════════════
   上一版要求**每一条**工作台都写着知渔 URL —— 于是我把 8 条自有玩法都指到了「灯具展示」那一页充数。
   用户第 20 轮要的是"对应知渔的各个子页面"，不是"每条都硬找一个页面"。
   现在：有对应页的（16 条）必须写 URL 且 URL 在 31 条实采清单里；自有的（26 条）必须 source: null
   + sourceNote 讲清为什么没有。逐条口径在 src/skills/quantvVideoParity.js，机检在
   test/quantv-video-parity-machine-0920.test.mjs（那份是对着实采证据比字段的）。 */
test('② 工作台的出处如实二分：有对应页的写 URL，自有的写清为什么没有', () => {
  const used = new Set();
  for (const [id, item] of Object.entries(VIDEO_WORKBENCHES)) {
    if (item.source) {
      assert.ok(String(item.source).startsWith('https://laoyu.quantv.com/'), id + ' 的取证出处不是知渔的 URL');
      used.add(item.source);
      continue;
    }
    assert.equal(item.source ?? null, null, id + ' 的 source 必须是 null（不许借 URL 充数）');
    assert.ok(String(item.sourceNote || '').length >= 10, id + ' 没写清"为什么知渔没有对应页"');
  }
  /* 我们**用到**的知渔页面必须是实采清单里的真页面 */
  for (const url of used) assert.ok(QUANTV_PAGES.includes(url), url + ' 不在 31 条实采清单里');
  /* 实采清单本身必须完整：31 条 URL 一条不少地落在抄录档里 */
  for (const url of QUANTV_PAGES) assert.ok(spec.includes(url), '抄录档里缺 ' + url);
  assert.match(spec, /cmr1w7qqt00z314i3r4rnmzfs/, '「短剧风格」那条 URL 必须进抄录档');
  /* 首尾帧如实标注"知渔没有对应页"（用户点名的玩法，知渔确实没有） */
  const frames = getVideoWorkbench('video.frame');
  assert.ok(frames.sourceNote, '首尾帧要如实写明知渔没有对应页');
});

test('③ 上传块：两个入口 + 竞品同款文案，且写了可拖拽就真的能拖', () => {
  /* 断言精确到 JSX 表达式 —— 注释里也有同样的中文，散字匹配会命中注释（等于没守） */
  assert.match(component, /\{block\.actions\?\.\[0\] \|\| '选择文件'\}/, '第一颗按钮的原文必须是「选择文件」');
  assert.match(component, /\{block\.actions\?\.\[1\] \|\| '从资产库选择'\}/, '第二颗按钮的原文必须是「从资产库选择」');
  assert.match(component, /\{block\.hint \|\| '点击或拖拽上传图片'\}/, '上传提示的原文必须是「点击或拖拽上传图片」');
  assert.match(component, /className="video-wb-upload-accept"/, '第二行说明（支持 …）必须渲染');
  assert.match(component, /onDrop=\{event => \{/, '写了可拖拽就必须实现 onDrop');
  assert.match(component, /onDragOver=\{event => \{/, '拖拽要有 onDragOver');
  assert.match(component, /onFiles\(dropped\.slice/, '拖进来的文件必须走与「选择文件」同一条逻辑');
  assert.match(component, /accept=\{block\.accept \|\| 'image\/\*'\}/, '接受类型由声明源给（视频块要收视频）');
  /* 知渔 20 条页面里出现的**逐字**文案：这些是我们照抄的锚点，改文案可以，改逻辑不行 */
  for (const phrase of ['点击或拖拽上传图片', '单张不超过 10MB', '选择文件', '从资产库选择']) {
    assert.ok(spec.includes(phrase), '抄录档里必须有竞品原文「' + phrase + '」');
  }
});

test('④ 不许放假按钮：付费动作要么接通、要么如实写原因', () => {
  /* 声明源里每个 action 必须有 wired 或 reason 二者之一 */
  for (const [id, item] of Object.entries(VIDEO_WORKBENCHES)) {
    for (const block of item.blocks) {
      const actions = block.kind === 'panel' ? (block.actions || []) : (block.action ? [block.action] : []);
      for (const action of actions) {
        if (action.wired) {
          /* 接通的只允许走站内**已有**的 SKU —— 不新增收费项（用户铁律） */
          assert.ok(['dawei', 'analyze'].includes(action.wired), id + ' 的动作 ' + action.label + ' 走了没登记的通路');
          assert.equal(typeof action.points, 'number', id + ' 的付费动作必须写明积分（价格不许让人猜）');
        } else {
          assert.ok(String(action.reason || '').length >= 4, id + ' 的动作 ' + action.label + ' 既没接通也没写原因（= 死按钮）');
        }
      }
    }
  }
  /* 页面侧：接不通的动作渲染成静态说明行，不是按钮 */
  assert.match(component, /media-workbench-paid is-off/, '接不通的动作必须是静态说明行');
  assert.match(component, /action\.reason \|\| '暂未开放'/, '说明行要写出原因');
});

test('⑤ 接线：子页面按这条 skill 的声明渲染，首页与独立路由不受影响', () => {
  assert.match(media, /getVideoWorkbench\(skill\.id\)/, 'MediaCreation 必须按 skill 取工作台规格');
  assert.match(studio, /workbench = null/, 'VideoStudioPage 要接收 workbench');
  assert.match(studio, /const workbenchMode = Boolean\(embedded && workbench/, '只有嵌入形态 + 有声明时才切工作台');
  assert.match(studio, /\{!workbenchMode && <section className="video-materials"/, '没有声明时保持原样（首页/独立路由一个像素不动）');
  assert.match(studio, /<VideoWorkbench/, '页面必须渲染声明源，不许写死块');
  /* 槽位素材必须真的进生成请求 —— 否则"抄了界面但没接线"，那是假功能 */
  assert.match(studio, /images: \[\.\.\.files\.images, \.\.\.slotImageFiles\]/, '槽位素材必须进生成请求');
  /* ⚠️ 2026-09-25 批 AM：**判据跟着事实改**（不是放宽）——
     原来写 `Object.values(slotFiles).forEach`（那时槽位只有图片，种类恒为 image）。
     本地方案的上传位是**视频**（视频高清 / 去字幕的源片），一律传成 image 会被服务端 415 拒收，
     所以改成按 **block 声明的 accept** 判种类：`Object.entries(slotFiles).forEach` + slotKindOf。
     这条守的还是原来那件事：槽位素材走**同一条**上传链路（不是另开一条通路）。 */
  assert.match(studio, /Object\.entries\(slotFiles\)\.forEach/, '槽位素材必须走同一条上传链路');
  assert.match(studio, /slotKindOf\(slotKey\)/, '槽位种类必须按块声明判（视频槽位不能当图片传）');
});

test('⑥ 案例区：知渔页签已取证；我们不改名（用户把这一栏叫「历史」）', () => {
  /* 知渔实测：路由型三条 / 广场型两条 —— 作为**取证**留档，门禁对着抄录档校验 */
  assert.deepEqual(VIDEO_WORKBENCH_TABS.route, ['作品示例', '我的作品', '教学示例']);
  assert.deepEqual(VIDEO_WORKBENCH_TABS.market, ['作品示例', '我的作品']);
  assert.match(spec, /作品示例 \/ 我的作品 \/ 教学示例/, '抄录档要写出竞品的页签名');
  /* ⚠️ **不照搬这三个名字**：用户原话把这一栏叫「历史」，把「我的作品」留给左侧导航那一项
     （「一方面是会在工作台右边的**历史**里面展示自己这个 skill 生成的历史记录，
        另一方面**同时也**会进入**我的作品**里面去」）。改名会与左侧导航撞车。 */
  assert.equal(getVideoWorkbench('video.store_tour').tabs, undefined, '不许把竞品页签名当成我们要渲染的文案');
  const workbench = read('src/pages/Home/SkillWorkbench.jsx');
  assert.doesNotMatch(workbench, /tabs=\{tabs\}/, '页面不许按竞品页签名改名（用户口径：「历史」）');
  /* 用户第 19 轮原话：「案例区这边可以先空着……你现在放的案例也不对」⇒ 声明源里不许塞假案例 */
  for (const [id, item] of Object.entries(VIDEO_WORKBENCHES)) {
    assert.equal(item.cases, undefined, id + ' 不许在声明源里放案例（用户要求先空着，素材他后续给）');
  }
});
