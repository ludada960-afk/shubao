import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { VIDEO_SKILLS } from '../src/skills/videoSkills.js';
import { VIDEO_WORKBENCHES } from '../src/skills/videoWorkbenches.js';
import {
  QUANTV_VIDEO_COUNTERPARTS,
  QUANTV_VIDEO_PAGES,
  videoSkillsWithCounterpart,
  videoSkillsWithoutCounterpart,
} from '../src/skills/quantvVideoParity.js';

/* ═══ 视频侧「skill ↔ 知渔子页面」**机检门禁**（批 P，2026-09-19）═══════════════════════
   用户第 20 轮原话（逐字）：
     「你要确认，视频生成和图片生成的各个子页面对应知渔的各个子页面，
       分别去对应他们的工作台做专属设计」
     「工作台该滑动的地方要滑动，要选项的地方要选项，该切换的地方要切换，抄到位」
   上一版的问题：42 条工作台里**只有 8 种形态**，而且 8 条自有玩法被硬指到「灯具展示」那一页
   （借用 URL 充数）—— 用户一眼就看出来是糊弄。本批改成如实二分：
     · 有对应页的（15 条：11 条 kind=page + 4 条 kind=shape）→ 工作台的字段形态与那一页**逐值对齐**；
     · 自有的（27 条）→ source: null + sourceNote 写清为什么没有，不再借 URL。
   数据源是实采落库的两份证据：
     · docs/design/data/quantv-video-workbenches.json（25 个 enabled app 的 inputConfigs）
     · docs/design/data/quantv-video-pages.json（31 个子页面的 DOM 全文 + 按钮 + CTA） */

const evidence = JSON.parse(readFileSync(new URL('../docs/design/data/quantv-video-workbenches.json', import.meta.url), 'utf8'));
const pages = JSON.parse(readFileSync(new URL('../docs/design/data/quantv-video-pages.json', import.meta.url), 'utf8'));
const appById = new Map(evidence.apps.map(app => [app.id, app]));
const norm = value => String(value ?? '').replace(/[\s（）()：:，,。、\[\]【】·\-]/g, '');

test('① 对照表覆盖全部 56 条视频 skill：有对应页的写 URL，自有的写理由', () => {
  const ids = VIDEO_SKILLS.map(skill => skill.id);
  const mapped = Object.keys(QUANTV_VIDEO_COUNTERPARTS);
  assert.deepEqual(mapped.filter(id => !ids.includes(id)), [], '对照表里有仓库里不存在的 skill');
  assert.deepEqual(ids.filter(id => !mapped.includes(id)), [], '有 skill 没进对照表');
  /* ═══ 2026-09-23 批 AA：42 → **56**（+14 条照知渔补齐的页）═══════════════════════════════
     用户原话：「你不如**全抄知渔**的视频生成和图片生成的 skill 子页面…**工作台直接照抄他的就好**，
     其他你自己硬造的子页面我觉得**就去掉吧**，**尽可能跟他一致**。」
     ⇒ 本轮把知渔"建筑室内"那 10 页（淋浴 / 台盆 / 灯具 / 餐桌展示、浴室洗漱、书房学习、
       卧室就寝、餐厅聚餐、室内装修、家装布置）+ "电商带货"那 4 页（三条短剧风格 + 趣味脱口秀）
       逐字段照抄进来。判据没变（对照表要覆盖全部 skill、有对应页写 URL、自有写理由），
       变的是**条数**：有对应页 16 → 30，自有 26 条不变。
     ═══ 2026-09-25 批 AM：56 → **58**（+2 条本地方案：视频高清 / 视频字幕去除）══════════════
     用户原话：「难道你没有什么比如 github 上的一些开源项目可以实现吗，**为什么一切都要追究模型呢**」
     —— 这两条不走上游模型（本机 ffmpeg scale / delogo），但它们**有知渔的对应页**
     （/video-high-definition 与 /video-subtitle-removal，都是路由页）⇒ 判据没变：
     有对应页写 URL + 字段形态照那一页，变的是条数（有对应页 30 → 32，自有 26 条不变）。 */
  assert.equal(ids.length, 58, '视频 skill 数量变了');
  /* 32 = 25 条 kind:'page'/'app'（知渔有同一件事的页面）+ 5 条 kind:'shape'（同形态，玩法不同）
          + 2 条本地方案的知渔路由页（批 AM） */
  assert.equal(videoSkillsWithCounterpart().length, 32, '有对应页的条数变了');
  assert.equal(videoSkillsWithoutCounterpart().length, 26, '自有玩法的条数变了');
  for (const id of videoSkillsWithoutCounterpart()) {
    const reason = QUANTV_VIDEO_COUNTERPARTS[id].reason || '';
    assert.ok(reason.length >= 8, id + ' 写了 counterpart: null 但没写清为什么');
  }
  /* 知渔视频侧 31 个子页面一条不少（用户：「就是这每个页面你都要点进去抄呀」） */
  assert.equal(QUANTV_VIDEO_PAGES.length, 31, '知渔视频子页面清单必须是 31 条');
  assert.equal(pages.pages.length, 32, 'DOM 实采必须是 32 条（31 个子页面 + 内容替换 app 页）');
  for (const page of pages.pages) assert.ok(!page.err, page.title + ' 的实采失败了');
});

test('② 工作台的 source 与对照表**逐条一致**（不许借 URL 充数）', () => {
  for (const [id, record] of Object.entries(QUANTV_VIDEO_COUNTERPARTS)) {
    const spec = VIDEO_WORKBENCHES[id];
    if (!record.counterpart) {
      if (VIDEO_SKILLS.find(skill => skill.id === id)?.tier === 'assistant') {
        /* 辅助能力没有自己的子页面 ⇒ 不该有工作台（长在别的技能的创作台上，见 fuses） */
        assert.equal(spec, undefined, id + ' 是辅助能力，不该占一个工作台');
        continue;
      }
      assert.ok(spec, id + ' 没有工作台声明');
      assert.equal(spec.source, null, id + ' 是自有玩法，不许借知渔的 URL 充数（上一版就是这么干的）');
      assert.ok(String(spec.sourceNote || '').length >= 10, id + ' 要在 sourceNote 里写清"为什么没有对应页"');
      continue;
    }
    assert.ok(spec, id + ' 有对应页却没有工作台');
    assert.equal(spec.source, record.counterpart, id + ' 的工作台 source 与对照表不一致');
    assert.ok(QUANTV_VIDEO_PAGES.includes(record.counterpart), id + ' 的 URL 不在 31 条实采清单里');
  }
});

test('③ 对到 app 页的 23 条：字段数 / 上传位数 / 比例档 / 时长档 与那一页逐值相等', () => {
  const problems = [];
  let compared = 0;
  for (const [id, record] of Object.entries(QUANTV_VIDEO_COUNTERPARTS)) {
    if (!record.counterpart || !record.counterpart.includes('/apps?id=')) continue;
    const app = appById.get(record.counterpart.split('id=')[1]);
    assert.ok(app, id + ' 指向的 app 不在实采目录里');
    const spec = VIDEO_WORKBENCHES[id];
    const theirFiles = app.inputConfigs.filter(field => field.type === 'file');
    const theirRatio = app.inputConfigs.find(field => field.title.trim() === '比例');
    const theirDuration = app.inputConfigs.find(field => /^时长/.test(field.title.trim()));
    const ourUploads = spec.blocks.filter(block => block.kind === 'upload');
    const ourRatio = spec.blocks.find(block => block.kind === 'chips' && block.title === '比例');
    const ourDuration = spec.blocks.find(block => block.kind === 'chips' && /^时长/.test(block.title));
    if (spec.blocks.length !== app.inputConfigs.length) problems.push(id + '：块数 ' + spec.blocks.length + ' vs 那一页字段数 ' + app.inputConfigs.length);
    if (ourUploads.length !== theirFiles.length) problems.push(id + '：上传块 ' + ourUploads.length + ' vs 他们 ' + theirFiles.length);
    for (let i = 0; i < Math.min(ourUploads.length, theirFiles.length); i++) {
      if (ourUploads[i].max !== theirFiles[i].maxImages) problems.push(id + '：第 ' + (i + 1) + ' 个上传位上限 ' + ourUploads[i].max + ' vs ' + theirFiles[i].maxImages);
    }
    if (theirRatio) {
      if (!ourRatio) problems.push(id + '：缺「比例」');
      else {
        const mine = ourRatio.options.map(option => norm(option.label));
        const theirs = theirRatio.options.map(norm);
        if (mine.join('|') !== theirs.join('|')) problems.push(id + '：比例档位\n      我们 ' + mine.join(' / ') + '\n      他们 ' + theirs.join(' / '));
      }
    } else if (ourRatio) problems.push(id + '：我们多了「比例」（那一页没有）');
    if (theirDuration) {
      if (!ourDuration) problems.push(id + '：缺「时长」');
      else {
        const mine = ourDuration.options.map(option => norm(option.label));
        const theirs = theirDuration.options.map(norm);
        if (mine.join('|') !== theirs.join('|')) problems.push(id + '：时长档位 我们 ' + mine.join('/') + ' vs 他们 ' + theirs.join('/'));
      }
    }
    compared++;
  }
  assert.equal(compared, 23, '参与机检的 app 对照条数变了：' + compared);
  assert.deepEqual(problems, [], '与知渔对应页对不上的地方：\n  ' + problems.join('\n  '));
});

test('④ 对到路由页的 4 条：工作台的文案与那一页 DOM 实采对得上', () => {
  const byTitle = new Map(pages.pages.map(page => [page.title, page]));
  const textOf = title => byTitle.get(title).panelText || '';
  /* 视频创作：0 / 6 + 0 / 10000 + 「输入视频脚本，使用 @ 指定参考素材，或」+ 代为撰写 */
  const smart = VIDEO_WORKBENCHES['video.smart'];
  assert.match(textOf('视频创作'), /0 \/ 6/, '视频创作页要有 0 / 6 的图片计数');
  assert.match(textOf('视频创作'), /0 \/ 10000/, '视频创作页要有 0 / 10000 的脚本计数');
  assert.equal(smart.blocks[0].max, 6, '智能成片的上传位是 6');
  assert.equal(smart.blocks[1].max, 10000, '智能成片的脚本文本是 10000');
  assert.match(smart.blocks[1].placeholder, /输入视频脚本，使用 @ 指定参考素材/, '占位文案照那一页');
  assert.equal(smart.blocks[1].action.key, 'script', '脚本格上要有「代为撰写」那颗付费动作');
  /* 爆款复刻：参考视频要求 4 条 + 适合上传的视频 5 个 */
  const remake = VIDEO_WORKBENCHES['video.remake'];
  const rules = remake.blocks.find(block => block.kind === 'note');
  const kinds = remake.blocks.find(block => block.kind === 'tags');
  assert.equal(rules.items.length, 4, '参考视频要求 4 条（照那一页）');
  assert.equal(kinds.items.length, 5, '适合上传的视频 5 个（照那一页）');
  assert.match(textOf('爆款复刻'), /15 秒以内/, '那页原文要写着 15 秒以内');
  /* 探店视频：探店素材 0/6 + 模特选择 0/3 + 生成脚本 + 空态 */
  const tour = VIDEO_WORKBENCHES['video.store_tour'];
  assert.equal(tour.blocks[0].max, 6, '探店素材 6 张');
  assert.equal(tour.blocks[2].max, 3, '模特选择 3 张');
  assert.match(tour.blocks[3].emptyTitle, /暂未生成脚本/, '空态文案照那一页');
  assert.match(textOf('探店视频'), /暂未生成脚本/, '那页原文有这条空态');
  /* 内容替换：参考视频（最长支持15秒）+ 背景图那句原文 + 换模特/换产品 两颗切换 */
  const swap = VIDEO_WORKBENCHES['video.content_swap'];
  assert.match(swap.blocks[0].title, /参考视频（最长支持15秒）/, '标题照那一页');
  assert.match(swap.blocks[2].title, /未上传则不替换背景/, '背景图那句照那一页');
  const mode = swap.blocks[3];
  assert.equal(mode.kind, 'chips', '换模特/换产品 必须是可切换的两颗药丸（用户：该切换的地方要切换）');
  assert.equal(mode.bind, 'swapMode', '切换必须绑到真的会进请求的 swapMode');
  assert.deepEqual(mode.options.map(option => option.label), ['换模特', '换产品'], '顺序照那一页（换模特在前）');
  assert.match(textOf('内容替换(路由页)'), /换模特/, '那页原文有换模特');
});
