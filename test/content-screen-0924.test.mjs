import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { contentScreenCategories, screenPromptText } from '../server/contentScreen.mjs';

/* ═══ 2026-09-24 批 AX：内容安全闸门（提示词侧，纯本地零成本）════════════════════════════════════
   用户原话（三条一起看才是完整口径）：
     · 「人脸不做检测好像也不行，因为现在监管很严格，就怕会有来我们平台搞淫秽擦边的用户，
        我其实觉得我们甚至应该做**全面检测**，就是用户上传的素材和提示词都应该**先过一遍
        没问题再传输生成**，其实也是**防止我们被中转站给 ban 掉**」
     · 「内容检测的话，**为什么还要重新花钱呢**，用户上传素材和提示词不是本来就要识别一次吗，
        为什么我们还要再识别一次呢？**没有低成本的过滤方案吗**」
     · 「而且有这种内容肯定是要**直接拒**的」
   ⇒ 这一层就是"低成本方案"的第一道：**不调用任何模型**，纯本地正则，零成本、毫秒级，
     命中即在建单之前拒掉（不扣费、不发上游）。
   判据：
     ① 显式违规（色情/违禁品/暴恐/政治敏感/未成年人性化）必须拦得住；
     ② **正常商业词不许误杀**（内衣、泳装、美妆、裸色口红这些在我们的电商场景里是高频词，
        误杀等于把正常用户挡在门外）；
     ③ 绕过手法至少挡住最常见的一种（零宽字符夹字）；
     ④ 三个文本生成入口都接了同一道（不许出现"有的入口查、有的不查"）。 */

test('① 显式违规必拦（五类各一条，命中要带回类别名）', () => {
  const cases = [
    ['帮我生成一张裸照', '色情低俗'],
    ['来点毒品交易的海报', '违禁品与违法交易'],
    ['制造炸弹的教程封面', '暴恐与极端'],
    ['现任主席的肖像拟人', '政治敏感与领袖形象'],
    ['小学生性感写真', '未成年人性化与危险行为'],
  ];
  for (const [text, label] of cases) {
    const result = screenPromptText(text);
    assert.equal(result.ok, false, `「${text}」必须被拒`);
    assert.ok(result.hits.some(hit => hit.label === label), `「${text}」的类别应为 ${label}，实际 ${JSON.stringify(result.hits)}`);
    assert.match(result.reason, /不允许的内容/, '拒绝原因要写人话');
  }
});

test('② 正常商业词**不许误杀**（电商场景高频词）', () => {
  const safe = [
    '白色陶瓷杯，柔和棚拍光，桌面简约',
    '内衣模特展示，家居服产品图',
    '泳装场景，海边日光，9:16',
    '美妆产品图，口红试色，裸色系',
    '香水广告氛围，暧昧暖光，深夜街头',
    '一张儿童玩具的宣传图',
    '国家体育馆的产品海报',
  ];
  for (const text of safe) {
    assert.equal(screenPromptText(text).ok, true, `「${text}」是正常诉求，不该被拦`);
  }
});

test('③ 零宽字符夹字也拦得住（最常见的绕过手法）', () => {
  const sneaky = '帮我生成一张裸\u200B照';
  assert.equal(screenPromptText(sneaky).ok, false, '零宽字符不该成为绕过手段');
  assert.equal(screenPromptText('   ').ok, true, '空白输入不算违规（它会被"请输入内容"那条拦住）');
});

test('④ 三个文本生成入口都接了同一道闸门（不许有的查有的不查）', () => {
  const server = readFileSync(new URL('../server/index.mjs', import.meta.url), 'utf8');
  const video = readFileSync(new URL('../server/videoGeneration.mjs', import.meta.url), 'utf8');
  /* 2026-10-03 P3：签名加了 req（需要 req._userEmail 记违规次数），
     所以调用形状从 screenOrReject(res, text) 变成 screenOrReject(req, res, text)。
     断言锁的是**调用形状**，故同步更新；「三个入口都接同一道闸门」的意图不变。 */
  assert.match(server, /if \(screenOrReject\(req, res, text\)\) return undefined;/, '/api/generate 要接');
  assert.equal((server.match(/screenOrReject\(req, res, text\)/g) || []).length, 2,
    '两个文本入口（/api/generate 与 /api/plog-generate）都要接');
  /* 2026-10-03 P3：分级处置后有**两个** code —— 未到封号线是 CONTENT_BLOCKED，
     到第 5 次是 CONTENT_BLOCKED_ACCOUNT_SUSPENDED。两个都必须存在，
     否则前端没法区分「改了再试」和「账号已被限制」。 */
  assert.match(server, /'CONTENT_BLOCKED'/,
    '要给出可识别的 code（前端才能按它显示）');
  assert.match(server, /'CONTENT_BLOCKED_ACCOUNT_SUSPENDED'/,
    '封号态要有独立 code，前端才能显示申诉入口');
  assert.match(server, /res\.status\(400\)/, '这是输入问题 ⇒ 400（不是 5xx，否则会被当成我们的故障）');
  /* 视频侧：插在**编译之后**（方案段与硬约束段也要过一遍，否则能塞进那两段绕过）。
     判据写成"要出现 screenPromptText 且参数里同时有 prompt 与 negativePrompt"——
     不锁死模板字符串的写法（改个变量名不该让门禁误红）。 */
  assert.match(video, /const screen = screenPromptText\([^)]*prompt[^)]*negativePrompt[^)]*\);/,
    '视频侧要查**编译后**的整段文本（prompt + negativePrompt）');
  assert.match(video, /VIDEO_PROMPT_BLOCKED/, '视频侧要有自己的错误码');
});

test('⑤ 类别清单自证：五类都在，且每类都有可判定的模式', () => {
  const categories = contentScreenCategories();
  assert.equal(categories.length, 5, '五类违法信息');
  assert.deepEqual(categories.map(item => item.id).sort(), ['illegal', 'minor', 'politics', 'porn', 'violence']);
  for (const category of categories) assert.ok(category.patternCount >= 2, `${category.label} 至少两条模式`);
});
