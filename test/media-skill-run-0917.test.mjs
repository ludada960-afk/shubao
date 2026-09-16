import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { IMAGE_SKILLS, getImageSkill } from '../src/skills/imageSkills.js';
import {
  DEFAULT_IMAGE_MODEL,
  MAX_REFERENCE_IMAGES,
  SERVER_VISUAL_SKILL_IDS,
  buildSkillBrief,
  buildSkillRequest,
  isHandoffSkill,
  skillRunKind,
  skillGenerationSettings,
  skillImages,
  skillPointsEstimate,
  validateSkillInput,
} from '../src/skills/skillRun.js';

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
  for (const skill of IMAGE_SKILLS) {
    const keys = new Set(skill.fields.map(field => field.key));
    const used = [...skill.brief.matchAll(/\{\{(\w+)\}\}/g)].map(match => match[1]);
    for (const key of used) assert.ok(keys.has(key), 'brief 用了不存在的字段：' + skill.id + ' -> ' + key);
  }
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

test('④ 提示词真的把用户填的内容填进去，且不留半截标点', () => {
  const skill = getImageSkill('image.poster');
  const filled = buildSkillBrief(skill, { topic: '夏夜爵士音乐节', prompt: '暖色灯光下的一支萨克斯' });
  assert.match(filled, /夏夜爵士音乐节/);
  assert.match(filled, /暖色灯光下的一支萨克斯/);
  assert.doesNotMatch(filled, /\{\{/, '不许把占位符原样喂给模型');
  /* 未填的可选字段不能留下「：。」这种断句 */
  const sparse = buildSkillBrief(skill, { topic: '春季书展' });
  assert.doesNotMatch(sparse, /[，。；：]\s*[，。；：]/);
  assert.doesNotMatch(sparse, /\{\{/);
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
  assert.equal(DEFAULT_IMAGE_MODEL, 'image2', '只有 image2 有真实出图记录，换它要先拿出证据');
  assert.equal(legal.visualSkillId, 'free');
  /* 非法比例/清晰度：回落到合法默认，而不是把 '21:9x' 这种值发给服务端 */
  const bad = skillGenerationSettings(skill, { ratio: '21:9x', clarity: '8K', count: 99 });
  assert.equal(bad.ratio, '1:1');
  assert.equal(bad.resolution, '2K');
  assert.equal(bad.count, 9, '数量必须夹在 1..9');
});

test('⑦ 积分预估与后端单价同源（image2 2K 单张 = 1 积分）', () => {
  const skill = getImageSkill('image.white_bg');
  assert.equal(skillPointsEstimate(skill, { clarity: '2K', count: 1 }), 1);
  assert.equal(skillPointsEstimate(skill, { clarity: '4K', count: 1 }), 2);
  assert.equal(skillPointsEstimate(skill, { clarity: '2K', count: 3 }), 3);
});

test('⑧ 必填校验能指出缺哪一项（给工作台做就近错误）', () => {
  const skill = getImageSkill('image.retouch');
  /* 比例/清晰度有声明默认值，不该被算成"没填"（这正是一次真实回归：界面有默认值、
     校验却按空值判，CTA 会一直是灰的） */
  assert.equal(validateSkillInput(skill, {}).ok, false);
  assert.deepEqual(validateSkillInput(skill, {}).missing, ['素材']);
  const ok = validateSkillInput(skill, {
    assets: [{ url: 'https://cdn.example.com/a.png', status: 'ready' }],
    prompt: '把背景杂物清掉',
  });
  assert.equal(ok.ok, true);
});

test('⑨ 运行方式三态：单图就地出、套图单独一档、小红书/视频回既有工作台', () => {
  /* 为什么必须是三态而不是"是不是 handoff"一个布尔：
     套图走的是**多张、按套计价**的引擎，一旦掉进单图分支，就会按 1 积分发一次单图请求 ——
     既不是用户要的东西，也把计价搞错了。所以它必须有自己的一档。 */
  assert.equal(skillRunKind(getImageSkill('image.product_suite')), 'suite');
  assert.equal(skillRunKind(getImageSkill('image.xhs_note')), 'handoff');
  assert.equal(skillRunKind(getImageSkill('image.white_bg')), 'inline');
  assert.equal(skillRunKind(getImageSkill('image.retouch')), 'inline');
  assert.equal(skillRunKind({ pipeline: 'videoSmart' }), 'handoff');
  assert.equal(isHandoffSkill(getImageSkill('image.xhs_note')), true, '小红书图文是 SSE 套图流水线');
  assert.equal(isHandoffSkill(getImageSkill('image.white_bg')), false, '白底图应当就地生成');
  /* 套图**不许**被当成 inline（这条是防回归的核心） */
  assert.notEqual(skillRunKind(getImageSkill('image.product_suite')), 'inline');
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
