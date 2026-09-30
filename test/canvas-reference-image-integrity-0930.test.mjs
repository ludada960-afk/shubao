// test/canvas-reference-image-integrity-0930.test.mjs
// 批 CY-㊴：生成时**不许静默丢掉参考图**（用户 2026-09-30 转述 240485042@qq.com 的内测反馈）
// ─────────────────────────────────────────────────────────────────────────────
// 用户原话：「当他把两个素材连到一起去进行生成图片的时候，他在生成图片的这个框的提示词
//   里面，他写到两张图要怎么去进行匹配进行创作，但是最终生成出来的效果，它会变成完全是
//   第一张图的样子。也就是说他根本就没有参考这两张图去进行新的生成…这个问题并不是
//   每次都会出现，好像是偶尔会出现。」
//
// 生产取证（works.db / canvas_generation_jobs，只读）：
//   该账号 40 条记录里有一批 inputCount=2 的两图生成请求，prompt 明确写了
//   「@参考图1 是目标参考图，@参考图2 是我的产品图」——
//   前端确实数到了两张。但 request_snapshot 是**脱敏**的（只存 prompt/张数/比例/模型，
//   一个图片 URL 都没有），所以它证明不了"第二张有没有发出去"，得看服务端。
//
// 服务端根因：读图循环里 `catch { if (第一张) throw }` —— 第二张读失败被**静默吞掉**，
// 请求照发、inputAssets 里只剩第一张 ⇒ 上游拿到的就是单图 ⇒ 结果"完全是第一张图"。
// "偶尔出现"也对得上：只在那张参考图 URL 恰好读不出来时才发生。
// 而且用户**以为**两张图都参与了，却为此付了一次积分 —— 比少一张更糟。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const service = read('server/canvasGenerationService.mjs');
const code = service.replace(/\/\*[\s\S]*?\*\//g, '');

test('① 任何一张输入图读不出来，都必须**停下并报错**，不许静默继续', () => {
  /* 旧写法：`catch (error) { if (input === request.visualInputs[0]) throw error; }`
     —— 第二张起失败就被吞掉，产出"完全是第一张图的样子"。 */
  assert.doesNotMatch(code, /catch \(error\) \{\s*if \(input === request\.visualInputs\[0\]\) throw error;\s*\}/,
    '不得再有"只有第一张读失败才抛"的静默吞异常写法');
  assert.match(code, /unreadableInputs/, '必须把读不出来的输入收集起来');
  assert.match(code, /if \(unreadableInputs\.length\) \{/, '收集到之后必须立刻失败');
  assert.match(code, /throw invalidRequest\(/, '失败要走 invalidRequest（用户能看到的产品级文案）');
});

test('② 失败文案要说清"这次停了"，不能让用户以为图都参与了', () => {
  assert.match(code, /不会只用剩下的图生成/, '部分失败时必须明确说本次已停止');
  assert.match(code, /原图读取失败，请重新上传素材后再试/, '全部失败时给出可执行的下一��');
});

test('③ 必须落一条服务端日志（只有用户文案没法排查）', () => {
  assert.match(code, /console\.error\('\[canvas\/regenerate\] 输入图读取失败：'/, '要有日志');
  assert.match(code, /requestId: request\.requestId/, '日志要带 requestId');
  assert.match(code, /firstUrl:/, '日志要带第一张失败图的 URL（截断），否则定位不了是哪张');
});

test('④ 前端确实把两张图都发出去了（别在下游找原因时忘了上游）', () => {
  /* 取证结论：inputCount=2 的请求存在，说明前端按"第一张=主图、其余=参考图"发了。
     这里钉住这个映射，防止有人只发第一张还以为是模型的问题。 */
  const page = read('src/pages/EcCanvas/index.jsx');
  const code2 = page.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(code2, /imageUrl: sourceNodes\[0\]\.url/, '第一张必须是主图');
  assert.match(code2, /referenceImages: sourceNodes\.slice\(1\)\.map\(node => node\.url\)/,
    '其余必须作为参考图一起发出去 —— 只发第一张正是用户看到的效果');
});

test('⑤ 服务端仍然把参考图拼进提示词（不是只塞进 inputAssets）', () => {
  assert.match(code, /Images 1 through \$\{resolvedInputs\.length - 1\} are indexed visual references/,
    '参考图必须在提示词里说明其序号与用途，否则模型不知道该按什么权重用');
  assert.match(code, /mentionNote/, '@提及必须与输入序号建立映射');
});
