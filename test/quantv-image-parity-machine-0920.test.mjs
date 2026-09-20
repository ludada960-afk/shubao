import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { IMAGE_SKILLS } from '../src/skills/imageSkills.js';
import {
  QUANTV_IMAGE_COUNTERPARTS,
  imageSkillsWithCounterpart,
  imageSkillsWithoutCounterpart,
} from '../src/skills/quantvImageParity.js';

/* ═══ 图片侧「skill ↔ 知渔对应页」**机检门禁**（批 P，2026-09-19）═══════════════════════
   用户第 20 轮原话（逐字）：
     「你要确认，视频生成和图片生成的各个子页面对应知渔的各个子页面，
       分别去对应他们的工作台做专属设计」
     「工作台该滑动的地方要滑动，要选项的地方要选项，该切换的地方要切换，抄到位」
   以及第 19 轮：「你不要凭想象……你要真的去抓他们的字段名、全部选项、上传位数」。
   —— 上一轮我口头上说"字段 SAME 30 / DIFF 0"，但那个脚本**只比了字段个数**
      （.tmp/laoyu2/cmp-fields.mjs 里就一句 ours.length === theirs.length）。
      个数相等而里面装的东西完全不同，正是用户说的"你抄的完全就没有对上"。
      本门禁改成**逐字段逐值**比对：字段数 / 控件类型 / 档位数 / **档位文案** / 上传位数 / 必填，
      数据源是实采落库的 docs/design/data/quantv-image-apps.json（104 个 app 的 inputConfigs）。

   ⚠️ hidden:true 的字段**不参与比对** —— 知渔页面上不渲染它们（例如「夏季蔬果巨物」的
      「替换指令」就是 hidden，页面上只有三格）。我们照抄成可见输入框是错的。 */

const evidence = JSON.parse(readFileSync(new URL('../docs/design/data/quantv-image-apps.json', import.meta.url), 'utf8'));
const pages = JSON.parse(readFileSync(new URL('../docs/design/data/quantv-image-pages.json', import.meta.url), 'utf8'));
const appById = new Map(evidence.apps.map(app => [app.id, app]));
const pageBySkill = new Map(pages.pages.map(page => [page.skill, page]));

/* 我们的 kind ↔ 知渔的 type：知渔界面上 radio 与 select **都是药丸**
   （实测：中文海报的「选择分辨率」type=select 也是药丸、批量出图的「比例」也是药丸），
   所以这两类在结构比对里等价。 */
const KIND_TO_TYPES = {
  upload: ['file'],
  text: ['singleText'],
  textarea: ['multiText'],
  segmented: ['radio', 'select'],
  select: ['select', 'radio'],
  stepper: ['number'],
  counts: ['counts'],
  slot: ['slot'],
};
const norm = value => String(value ?? '').replace(/[\s（）()：:，,。、\[\]【】·\-]/g, '');

/* 唯一一处**故意不一致**：知渔「图片换风格」的分辨率第一档他们打成了「2K高i请」（错别字）。
   照抄错别字没有意义（用户口径：「文案和表达你可以稍微改一改」），所以这一条按"我们写对"记录。 */
const WORDING_EXCEPTIONS = { 'image.style_swap': ['2K高清'] };

test('① 对照表覆盖全部图片 skill：有对应页的写 URL，没有的写理由（没有也是明确结论）', () => {
  const ids = IMAGE_SKILLS.map(skill => skill.id);
  const mapped = Object.keys(QUANTV_IMAGE_COUNTERPARTS);
  assert.deepEqual(mapped.filter(id => !ids.includes(id)), [], '对照表里有仓库里不存在的 skill');
  assert.deepEqual(ids.filter(id => !mapped.includes(id)), [], '有 skill 没进对照表（漏填 = 上一轮的问题）');
  assert.equal(ids.length, 50, '图片 skill 数量变了，对照表要同步');
  assert.equal(imageSkillsWithCounterpart().length, 34, '有对应页的条数变了');
  assert.equal(imageSkillsWithoutCounterpart().length, 16, '自有玩法的条数变了');
  for (const id of imageSkillsWithoutCounterpart()) {
    const reason = QUANTV_IMAGE_COUNTERPARTS[id].reason || '';
    assert.ok(reason.length >= 8, id + ' 写了 counterpart: null 但没写清为什么（"没有"也要是明确结论）');
  }
});

test('② 对照页 URL 形态正确，且都在实采清单里（打不开的 URL = 对照表没法复查）', () => {
  /* ⚠️ 上一版 28 条全写成了 /apps?id=… —— 那是**视频**市场的路由，
     图片 app 拼上去页面显示「应用不存在」（CDP 实测）。本批逐条改成 /image-creation?id=… */
  for (const [id, record] of Object.entries(QUANTV_IMAGE_COUNTERPARTS)) {
    if (!record.counterpart) continue;
    assert.match(record.counterpart, /^https:\/\/laoyu\.quantv\.com\/image-creation\?(id|tool)=/, id + ' 的对照页 URL 形态不对');
    if (record.kind === 'app') {
      const appId = record.counterpart.split('id=')[1];
      assert.ok(appById.has(appId), id + ' 指向的 app 不在实采目录里：' + appId);
    }
  }
  /* 34 个对照页都真的抓到了 DOM（errors=0），这是"URL 打得开"的证据 */
  assert.equal(pages.pages.length, 34, '对照页实采条数变了');
  for (const page of pages.pages) {
    assert.ok(!page.err, page.skill + ' 的对照页实采失败：' + page.err);
    assert.ok((page.panelText || '').length > 30, page.skill + ' 的对照页没抓到左栏内容');
  }
});

test('③ 有对应页的 28 条：字段数 / 控件 / 档位数 / 档位文案 / 上传上限 / 必填 逐值相等', () => {
  const diffs = [];
  let compared = 0;
  for (const skill of IMAGE_SKILLS) {
    const record = QUANTV_IMAGE_COUNTERPARTS[skill.id];
    if (!record || !record.counterpart || record.kind !== 'app') continue;
    const app = appById.get(record.counterpart.split('id=')[1]);
    const theirs = app.fields.filter(field => !field.hidden).map(field => ({
      label: field.title,
      type: field.type,
      count: field.options.length || null,
      labels: field.options.map(norm),
      max: field.maxImages,
      required: !field.optional,
    }));
    const ours = (skill.fields || []).map(field => ({
      label: field.label,
      kind: field.kind,
      count: Array.isArray(field.options) ? field.options.length : null,
      labels: Array.isArray(field.options) ? field.options.map(option => norm(option.label)) : null,
      max: field.maxImages ?? null,
      required: !!field.required,
    }));
    const allowed = WORDING_EXCEPTIONS[skill.id] || [];
    const problems = [];
    if (ours.length !== theirs.length) problems.push('字段数 ' + ours.length + ' vs ' + theirs.length);
    for (let i = 0; i < Math.max(ours.length, theirs.length); i++) {
      const mine = ours[i];
      const their = theirs[i];
      const at = '#' + (i + 1);
      if (!mine) { problems.push(at + ' 缺「' + their.label + '」'); continue; }
      if (!their) { problems.push(at + ' 多「' + mine.label + '」'); continue; }
      if (!(KIND_TO_TYPES[mine.kind] || []).includes(their.type)) problems.push(at + ' 控件 ' + mine.label + '：我们 ' + mine.kind + ' / 他们 ' + their.type);
      if (mine.count != null && their.count != null && mine.count !== their.count) problems.push(at + ' 档位数 ' + mine.label + '：' + mine.count + ' vs ' + their.count);
      if (mine.max != null && their.max != null && mine.max !== their.max) problems.push(at + ' 上传上限 ' + mine.label + '：' + mine.max + ' vs ' + their.max);
      if (mine.required !== their.required) problems.push(at + ' ' + mine.label + '：他们' + (their.required ? '必填' : '可选') + ' / 我们' + (mine.required ? '必填' : '可选'));
      if (mine.labels && their.labels && mine.labels.length === their.labels.length) {
        for (let k = 0; k < mine.labels.length; k++) {
          if (mine.labels[k] === their.labels[k]) continue;
          if (allowed.includes(mine.labels[k])) continue;
          problems.push(at + ' 档位文案 ' + mine.label + ' 第 ' + (k + 1) + ' 档：他们「' + their.labels[k] + '」/ 我们「' + mine.labels[k] + '」');
        }
      }
    }
    compared++;
    if (problems.length) diffs.push(skill.id + ' ↔ 「' + app.title + '」\n    ' + problems.join('\n    '));
  }
  assert.equal(compared, 28, '参与机检的 app 对照条数变了：' + compared);
  assert.deepEqual(diffs, [], '与知渔对应页对不上的地方：\n  ' + diffs.join('\n  '));
});
/* ═══ 6 个内置页（?tool=）════════════════════════════════════════════════════════════════
   内置页没有 inputConfigs 接口，字段只能从 DOM 取（docs/design/data/quantv-image-builtin-pages.json，
   CDP 实采：左栏全文 + 原生 select 的全部选项）。这里比对**机器可判**的那部分：
   三个跨境下拉（目标市场 / 目标平台 / 语言）的全部选项逐值相等，以及上传位数。
   ⚠️ 2026-09-19 批 R：原来这里写着「模型选择与自适应比例**故意不抄**」，现在**两条都补上了**
      （用户第 21 轮原话：「模型选择不用纠结啊，他们子页面的模型不也是首页的模型吗，直接引用就好了呀，
        比例里的「自适应」……各个 skill 他们自己有最适配的方案吗，有的话就可以作为自适应去做吧？」）。
      两条各自的落地方式不一样，所以下面的断言也不一样：
        · 模型选择：我们**引用自己的模型目录**（services/imageModelCatalog.js，与首页同一个），
          档位文案不是他们的 —— 所以只断言"这一格在、且选项来自目录"，逐档相等由
          test/image-model-selection-0921.test.mjs 守。
        · 自适应：知渔自己的 help 原文就是「「自适应」将根据模特图自动匹配最接近的比例」，
          我们照这个语义实现（skillRun.nearestLegalRatio），档位照他们排在第一档。 */
const builtin = JSON.parse(readFileSync(new URL('../docs/design/data/quantv-image-builtin-pages.json', import.meta.url), 'utf8'));
const builtinBySkill = new Map(builtin.pages.map(page => [page.skill, page]));
const skillById = new Map(IMAGE_SKILLS.map(skill => [skill.id, skill]));
const fieldOptions = (skillId, key) => {
  const field = (skillById.get(skillId).fields || []).find(item => item.key === key);
  assert.ok(field, skillId + ' 缺字段 ' + key);
  return (field.options || []).map(option => norm(option.label));
};

test('④ 内置页：三个跨境下拉的全部选项逐值相等（知渔原文），上传位数一致', () => {
  const cases = [
    ['image.product_suite', 0, 1, 2],
    ['image.aplus', 0, 1, 2],
    ['image.detail_page', 0, 1, 2],
    ['image.copy', 0, 1, 2],
  ];
  for (const [skillId, m, p, l] of cases) {
    const page = builtinBySkill.get(skillId);
    assert.ok(page && !page.error, skillId + ' 的内置页没抓到');
    assert.deepEqual(fieldOptions(skillId, 'market'), page.selects[m].map(norm), skillId + ' 的目标市场档位与知渔不一致');
    assert.deepEqual(fieldOptions(skillId, 'platform'), page.selects[p].map(norm), skillId + ' 的目标平台档位与知渔不一致');
    assert.deepEqual(fieldOptions(skillId, 'language'), page.selects[l].map(norm), skillId + ' 的语言档位与知渔不一致');
  }
  /* 语言三页各不相同（套图 14 含「无文字」/ A+ 与详情图 13 / 图片复刻 11）—— 这正是"逐页抄"的证据 */
  assert.equal(fieldOptions('image.product_suite', 'language').length, 14, '套图语言应为 14 档（含「无文字」）');
  assert.equal(fieldOptions('image.aplus', 'language').length, 13, 'A+ 语言应为 13 档');
  assert.equal(fieldOptions('image.copy', 'language').length, 11, '图片复刻语言应为 11 档（比 A+ 少「马来西亚语」）');
  /* AI 换装的生成张数是 1-4（他们页面的 select 就是这四档） */
  const tryOn = builtinBySkill.get('image.try_on');
  const countField2 = skillById.get('image.try_on').fields.find(field => field.key === 'count');
  assert.equal(countField2.max, tryOn.selects[2].length, 'AI 换装的生成张数上限要与知渔一致（1-4）');
  /* ═══ 批 R：图片复刻 / AI换装这两页的「模型选择」与比例「自适应」逐档对齐 ═══════════════
     知渔 ?tool=image-clone 的比例实测（本文件引用的同一份实采数据，先从 panelText 里核一遍：
     下面这张 theirsRatio 表里的每一档都必须真的出现在他们的页面上，避免"我记错了"。） */
  for (const skillId of ['image.copy', 'image.try_on']) {
    const page = builtinBySkill.get(skillId);
    const modelIndex = page.selects.findIndex(options => options.length === 1 && options[0] === '智能图片image');
    const clarityIndex = page.selects.findIndex(options => options.join('/') === '1K/2K/4K');
    assert.ok(modelIndex >= 0, skillId + '：知渔这一页有「模型选择」这一格');
    assert.ok(clarityIndex >= 0, skillId + '：知渔这一页有「分辨率」这一格（1K/2K/4K）');
    assert.ok(skillById.get(skillId).fields.some(field => field.key === 'imageModel'), skillId + '：我们也要有模型选择这一格');
    assert.deepEqual(fieldOptions(skillId, 'clarity'), page.selects[clarityIndex].map(norm), skillId + '：分辨率档位与知渔逐档一致');
  }
  /* 比例：他们有多少档、我们就照着给（引擎认得的那些），一档不多一档不少 */
  const ENGINE_GAP = ['9:21', '2:1', '1:2'];   /* 引擎尺寸表里还没有这三个尺寸（见声明源注释） */
  const RATIO_EVIDENCE = {
    'image.copy': ['自适应', '1:1', '3:2', '2:3', '16:9', '9:16', '5:4', '4:5', '4:3', '3:4', '21:9', '9:21', '2:1', '1:2'],
    'image.try_on': ['自适应', '1:1', '3:2', '2:3', '16:9', '9:16'],
  };
  for (const [skillId, theirsRatio] of Object.entries(RATIO_EVIDENCE)) {
    const page = builtinBySkill.get(skillId);
    for (const value of theirsRatio) {
      assert.ok(page.panelText.includes(value), skillId + '：知渔这一页的比例里应当有「' + value + '」（实采原文变了要重新核）');
    }
    assert.deepEqual(fieldOptions(skillId, 'ratio'), theirsRatio.filter(value => !ENGINE_GAP.includes(value)).map(norm),
      skillId + '：我们的比例档位 = 他们那些档位里引擎认得的部分（缺的只有尺寸表还没补的三档）');
  }
  /* 去除背景：知渔写「最多上传 5 张图片 / 0/5」，我们也是 5 */
  const removeBg = skillById.get('image.remove_bg').fields.find(field => field.key === 'assets');
  assert.match(builtinBySkill.get('image.remove_bg').panelText, /最多上传 5 张图片/, '内置页原文要写着 5 张');
  assert.equal(removeBg.maxImages, 5, '去除背景的上传上限应为 5（知渔原文）');
});
