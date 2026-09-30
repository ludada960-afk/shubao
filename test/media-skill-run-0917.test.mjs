import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { IMAGE_SKILLS, getImageSkill } from '../src/skills/imageSkills.js';
import { VIDEO_CREATION_MODES } from '../src/pages/VideoStudio/videoStudioModel.js';
import {
  DEFAULT_IMAGE_MODEL,
  MAX_REFERENCE_IMAGES,
  SERVER_VISUAL_SKILL_IDS,
  buildSkillBrief,
  buildSkillRequest,
  isHandoffSkill,
  skillEmbedOf,
  skillRunKind,
  skillVideoMode,
  skillGenerationSettings,
  skillImages,
  skillPointsEstimate,
  validateSkillInput,
} from '../src/skills/skillRun.js';
import { generationUnits, imageModelResolutions } from '../src/services/imageModelCatalog.js';

/* ═══ Skill 运行契约（2026-09-17）═══════════════════════════════════════════════
   这一条守的是「工作台能不能真的出图」：字段 → 引擎参数 的翻译必须唯一、合法、可断言。
   为什么用测试守（而不是靠 review）：
     · 服务端对非法值**是静默回落**的（ratio→1:1、resolution→2K、skill_id→free），
       前端一旦拼错，用户看到的是"生成成功但不是我选的东西"——最难查的那类 bug；
     · 模型只认 image2（唯一有真实出图记录的档位），一旦有人手滑写进未验收的档位，
       就会重演 9-16「假模型」事故。 */

const UPLOAD_ROLES = new Set(['product', 'reference', 'person', 'scene', 'style']);

test('① 每条技能都带得出提示词与服务端视觉方向', () => {
  for (const skill of IMAGE_SKILLS) {
    assert.ok(typeof skill.brief === 'string' && skill.brief.length >= 20, '缺少 brief（提示词模板）：' + skill.id);
    assert.ok(SERVER_VISUAL_SKILL_IDS.includes(skill.visual), 'visual 必须是服务端白名单里的四个之一：' + skill.id + ' = ' + skill.visual);
  }
});

test('② brief 里的占位符必须都能对上字段（写错 key 会让提示词留空）', () => {
  /* ⚠️ 2026-09-27 批 DC：「概念视觉方案」的 `{{shots}}` **不是字段** —— 它是「本篇手法」
     那份可勾选清单**逐张注入**进提示词的变量（第 i 张只放第 i 种手法，见 skillRun.skillValuesForShot）。
     这类占位符必须在声明里**逐个登记**（skill.injectedBriefKeys），所以判据一个字没放宽：
     写错的 key 既不是字段、也不会被登记，照样判红。 */
  for (const skill of IMAGE_SKILLS) {
    const keys = new Set(skill.fields.map(field => field.key));
    for (const key of Array.isArray(skill.injectedBriefKeys) ? skill.injectedBriefKeys : []) keys.add(key);
    const used = [...skill.brief.matchAll(/\{\{(\w+)\}\}/g)].map(match => match[1]);
    for (const key of used) assert.ok(keys.has(key), 'brief 用了不存在的字段：' + skill.id + ' -> ' + key);
  }
  /* 自证：把登记过的 key 写错一位，必须仍被判红（证明这条不是"有登记就全放行"） */
  const concept = getImageSkill('image.concept_set');
  assert.ok(Array.isArray(concept.injectedBriefKeys) && concept.injectedBriefKeys.length > 0,
    '注入型占位符必须在声明里显式登记（不然下面那条自证没有作用对象）');
  const declared = new Set([...concept.fields.map(field => field.key), ...concept.injectedBriefKeys]);
  let caught = false;
  try {
    for (const key of [...concept.brief.replace('{{shots}}', '{{shot}}').matchAll(/\{\{(\w+)\}\}/g)].map(match => match[1])) {
      assert.ok(declared.has(key));
    }
  } catch { caught = true; }
  assert.equal(caught, true, '把 {{shots}} 写成 {{shot}} 之后没被判红 ⇒ 这条判据被登记表绕过去了');
});

test('③ 上传位必须声明张数与合法角色，且真的走 upload 档', () => {
  let uploadFields = 0;
  for (const skill of IMAGE_SKILLS) {
    for (const field of skill.fields) {
      if (field.kind !== 'upload') continue;
      uploadFields += 1;
      assert.ok(Number(field.maxImages) >= 1, '上传位必须有 maxImages：' + skill.id + '/' + field.key);
      assert.ok(UPLOAD_ROLES.has(field.role || 'product'), '上传角色必须是服务端白名单：' + skill.id + '/' + field.key);
    }
  }
  assert.ok(uploadFields >= 10, '图片侧应当有足量的上传位（实测套数：' + uploadFields + '）');
});

/* 2026-09-19 批 O-⑥：这条门禁换了**取样的 skill 字段**，判据没动。
   判据仍旧是那三件：用户填的内容真的进提示词 / 不留占位符 / 未填的可选字段不留半截标点。
   变的是 image.poster 的字段：本批按知渔「电商海报设计」把它从「主题 + 画面描述」改成
   「上传图片 + 产品卖点可选(points) + 比例 + 分辨率」——
   依据是用户第 19 轮「你抄的完全就没有对上」「全部去把这些子页面 1:1 的去把它们抄过来」。 */
test('④ 提示词真的把用户填的内容填进去，且不留半截标点', () => {
  const skill = getImageSkill('image.poster');
  const filled = buildSkillBrief(skill, { points: '买一送一，满99减30' });
  assert.match(filled, /买一送一/);
  assert.doesNotMatch(filled, /[{][{]/ , '不许把占位符原样喂给模型');
  /* 未填的可选字段不能留下「：。」这种断句 */
  const sparse = buildSkillBrief(skill, {});
  assert.doesNotMatch(sparse, /[，。；：][ ]*[，。；：]/);
  assert.doesNotMatch(sparse, /[{][{]/);
  /* 另一个技能再验一次：两个字段都要进提示词（免得只剩单字段覆盖） */
  const cn = getImageSkill('image.cn_poster');
  const cnFilled = buildSkillBrief(cn, { topic: '春季书展', prompt: '暖色灯光下的展台' });
  assert.match(cnFilled, /春季书展/);
  assert.match(cnFilled, /暖色灯光下的展台/);
  assert.doesNotMatch(cnFilled, /[{][{]/);
});

test('⑤ 图片：第一张主图进 image_url，其余进参考图，且有上限', () => {
  const skill = getImageSkill('image.swap_bg');
  const value = key => [{ url: 'https://cdn.example.com/' + key + '.png', status: 'ready', assetId: 'a-' + key, name: key }];
  const images = skillImages(skill, { assets: value('main'), backdrop: value('bg') });
  assert.equal(images.imageUrl, 'https://cdn.example.com/main.png');
  assert.deepEqual(images.referenceImages, ['https://cdn.example.com/bg.png']);
  /* 只有 ready 且带 url 的条目才算数：上传中/失败的不许进请求 */
  const pending = skillImages(skill, { assets: [{ url: '', status: 'uploading' }], backdrop: value('bg') });
  assert.equal(pending.imageUrl, '');
  assert.deepEqual(pending.referenceImages, []);
  assert.ok(MAX_REFERENCE_IMAGES <= 9, '服务端参考图上限是 9');
});

test('⑥ 生成参数：非法值在前端就被拦住，不许靠服务端静默回落', () => {
  const skill = getImageSkill('image.white_bg');
  const legal = skillGenerationSettings(skill, { ratio: '4:3', clarity: '2K', count: 3 });
  assert.equal(legal.ratio, '4:3');
  assert.equal(legal.resolution, '2K');
  assert.equal(legal.count, 3);
  assert.equal(legal.imageModel, DEFAULT_IMAGE_MODEL);
  /* ⚠️ 2026-09-30 换默认（用户拍板：「把默认都换成 2.5，这是长期比较好的做法」）。
     这一条原来守的是"只有 image2 有真实出图记录，换它要先拿出证据"——**证据已经在了**：
       · `image2-5-sunburst` 早在 2026-09-13 就接通上线（用户自己在线上跑真实生成验收）；
       · 上游路由 `gpt-image-2.5-sunburst-*`、计费 SKU `ec_image25_sunburst_{1k,2k,4k}` 齐全；
       · 1K/2K/4K 三档都支持（`imageModelResolutions('image2-5-sunburst')` = 1K/2K/4K），
         换默认**没有**带来任何清晰度档位的缺失。
     ⇒ 下面两条改成守"换默认之后仍然自洽"：默认必须可计费、且支持全三档。 */
  assert.equal(DEFAULT_IMAGE_MODEL, 'image2-5-sunburst', '全局默认 = GPT Image 2.5 Sunburst');
  assert.equal(generationUnits(DEFAULT_IMAGE_MODEL, '2K'), 1500,
    '默认档必须能被计费表查到单价（查不到 = 报价那一格会空）');
  assert.deepEqual(imageModelResolutions(DEFAULT_IMAGE_MODEL), ['1K', '2K', '4K'],
    '默认档必须支持全三档（否则换默认会悄悄砍掉一档清晰度）');
  assert.equal(legal.visualSkillId, 'free');
  /* 非法比例/清晰度：回落到合法默认，而不是把 '21:9x' 这种值发给服务端 */
  const bad = skillGenerationSettings(skill, { ratio: '21:9x', clarity: '8K', count: 99 });
  assert.equal(bad.ratio, '1:1');
  assert.equal(bad.resolution, '2K');
  /* ⚠️ 2026-09-19 批 I-9：上限 9 → **16**（判据跟着真实契约走，不是为了让测试变绿）。
     用户批注 #3-2 把张数的来源定成「选中多少个模块就是多少张」，
     而 A+ 内容有 16 个模块 —— 夹在 9 会变成"用户勾了 16 个、只出 9 张也只收 9 张的钱"，
     一个不报错不提示的静默少给。16 是当前声明源里模块数的上限；
     其它技能靠 countField(n) 自己声明（都 ≤ 9），所以抬这条不会放宽它们。
     这条断言守的东西没变：**非法值必须在前端被夹回合法区间**，只是那个区间变宽了。 */
  assert.equal(bad.count, 16, '数量必须夹在 1..16');
});

test('⑦ 积分预估与后端单价同源（按**默认档**的单价算，不写死数字）', () => {
  const skill = getImageSkill('image.white_bg');
  /* ⚠️ 2026-09-30：默认档从 image2 换成了 2.5 Sunburst（2K = 1.5 积分）。
     这条原来把 1/2/3 写死 —— 换默认之后必然对不上。
     ⇒ 改成从计费表取默认档的单价，**换默认时这条门禁自动跟着走**。 */
  const perK = generationUnits(DEFAULT_IMAGE_MODEL, '2K') / 1000;
  const per4K = generationUnits(DEFAULT_IMAGE_MODEL, '4K') / 1000;
  assert.ok(perK > 0 && per4K > 0, '自证：默认档 2K/4K 的单价都要能算出来');
  assert.equal(skillPointsEstimate(skill, { clarity: '2K', count: 1 }), perK);
  assert.equal(skillPointsEstimate(skill, { clarity: '4K', count: 1 }), per4K);
  assert.equal(skillPointsEstimate(skill, { clarity: '2K', count: 3 }), Number((perK * 3).toFixed(2)));
});

test('⑧ 必填校验能指出缺哪一项（给工作台做就近错误）', () => {
  const skill = getImageSkill('image.retouch');
  /* 比例/清晰度有声明默认值，不该被算成"没填"（这正是一次真实回归：界面有默认值、
     校验却按空值判，CTA 会一直是灰的）
     ═══ 2026-09-19 批 P：期望值从 ['素材'] 改成 ['上传图片','修图指令'] ═══════════════════
     判据没变（缺哪一项就报哪一项的**字段名**），变的是"这一页有哪些必填字段"这个事实：
     知渔「一键美化图片」逐字是 上传图片 [file 必填] + 修图指令 [multiText **必填**] + 比例 + 分辨率
     （docs/design/data/quantv-image-apps.json）。我们上一版叫「素材 / 要求」且要求是选填 ——
     照他们改完之后，空值下**两项都缺**才是对的。 */
  assert.equal(validateSkillInput(skill, {}).ok, false);
  assert.deepEqual(validateSkillInput(skill, {}).missing, ['上传图片', '修图指令']);
  const ok = validateSkillInput(skill, {
    assets: [{ url: 'https://cdn.example.com/a.png', status: 'ready' }],
    prompt: '把背景杂物清掉',
  });
  assert.equal(ok.ok, true);
});

test('⑨ 运行方式：单图就地出、套图单独一档、小红书/视频把既有工作台嵌进子页面', () => {
  /* 为什么必须分档而不是"是不是 handoff"一个布尔：
     套图走的是**多张、按套计价**的引擎，一旦掉进单图分支，就会按 1 积分发一次单图请求 ——
     既不是用户要的东西，也把计价搞错了。所以它必须有自己的一档。

     2026-09-17 用户改口径（原话）：「生成结果直接在工作台里面展示，不必像之前一样生成完
     就一定要跳进去画布里面……如果是在子页面的工作台生成的，结果就会在各自的子页面历史记录里面。」
     → 小红书图文与视频从 handoff 改成 **embed**：把这两条链路**各自已有的、跑通的工作台**
       整块嵌进子页面（不是重写一遍），结果与历史都留在本页。
     → 判据因此收敛成一条：**这一页能不能把链路跑完并交出结果**。跑得完就没资格把人踢走。 */
  assert.equal(skillRunKind(getImageSkill('image.product_suite')), 'suite');
  assert.equal(skillRunKind(getImageSkill('image.xhs_note')), 'embed');
  assert.equal(skillRunKind(getImageSkill('image.white_bg')), 'inline');
  assert.equal(skillRunKind(getImageSkill('image.retouch')), 'inline');
  assert.equal(skillRunKind({ pipeline: 'videoSmart' }), 'embed');
  /* 嵌哪一块由 skillEmbedOf 说了算，页面据此选组件 */
  assert.equal(skillEmbedOf(getImageSkill('image.xhs_note')), 'xhs');
  assert.equal(skillEmbedOf({ pipeline: 'videoFrame' }), 'video');
  assert.equal(skillEmbedOf(getImageSkill('image.white_bg')), '');
  /* ⚠️ 现在**没有任何技能**该走 handoff —— 它是留给"既跑不完、又没有组件可嵌"的出口。
     本条一旦挂掉，说明有人把 embed 又改回了"把人送去别处"，先读 skillRunKind 的注释再改。 */
  assert.equal(isHandoffSkill(getImageSkill('image.xhs_note')), false, '小红书图文已经能在子页面里跑完');
  assert.equal(isHandoffSkill({ pipeline: 'videoSmart' }), false, '视频工作台已经嵌进子页面');
  assert.equal(isHandoffSkill(getImageSkill('image.white_bg')), false, '白底图应当就地生成');
  /* 套图**不许**被当成 inline（这条是防回归的核心） */
  assert.notEqual(skillRunKind(getImageSkill('image.product_suite')), 'inline');
});

test('⑨b 视频技能 → 创作方式页签的映射必须落在真实存在的页签上', () => {
  /* 页签只有三档（videoStudioModel.VIDEO_CREATION_MODES = smart / frame / remake）：
     「全能参考」不是页签，而是 smart 档带素材后由 resolveVideoApiMode **算**出来的 API 模式。
     映射成 'reference' 会选中一个不存在的页签 —— 界面看着像没反应。 */
  const tabs = VIDEO_CREATION_MODES.map(item => item.id);
  for (const pipeline of ['videoSmart', 'videoFrame', 'videoRemake', 'videoReference']) {
    const mode = skillVideoMode({ pipeline });
    assert.ok(tabs.includes(mode), pipeline + ' → ' + mode + ' 必须是真实页签之一');
  }
  assert.equal(skillVideoMode({ pipeline: 'videoReference' }), 'smart', '参考链路落在 smart 档');
  assert.equal(skillVideoMode({ pipeline: 'videoFrame' }), 'frame');
  assert.equal(skillVideoMode({ pipeline: 'videoSmart' }), 'smart');
  /* 认不出来的 pipeline 给空串 —— 交回工作台自己的默认值，不硬塞一个错的模式 */
  assert.equal(skillVideoMode({ pipeline: 'nope' }), '');
  assert.equal(skillVideoMode(null), '');
});

test('⑩ 请求装配：creation_intent 固定 visual，request_key 带 run/slot（幂等靠它）', () => {
  const skill = getImageSkill('image.white_bg');
  const request = buildSkillRequest(skill, {
    assets: [{ url: 'https://cdn.example.com/p.png', status: 'ready' }],
    ratio: '1:1', clarity: '2K',
  }, { runId: 'run-1', slotIndex: 2 });
  assert.equal(request.creationIntent, 'visual');
  assert.equal(request.skillId, 'free');
  assert.equal(request.requestKey, 'run-1:3');
  assert.equal(request.imageUrl, 'https://cdn.example.com/p.png');
  assert.match(request.prompt, /白底/);
});

test('⑪ 字段渲染器必须实现 upload 档（否则上传位又是死按钮）', () => {
  const renderer = readFileSync('src/components/media/FieldRenderer.jsx', 'utf8');
  assert.match(renderer, /kind === 'upload'/);
  assert.match(renderer, /uploadEcommerceAsset/, '上传必须复用既有上传函数，不许另写一套');
  assert.match(renderer, /status: 'error'/, '失败必须留在原地可重试');
});
