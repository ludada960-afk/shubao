import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
/* ⚠️ 断言前一律**剥掉注释** —— 这批的注释里正好写着被禁掉的那行原文
   （解释"根因就在下面那一行"），不剥就会自己撞自己。这已是本会话第三次。 */
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
const video = strip(read('src/pages/VideoStudio/index.jsx'));
const card = strip(read('src/pages/Home/ec/components/EcommerceAssetCards.jsx'));

/* ══════════════════════════════════════════════════════════════════════════════
   批 CY-㉜：首尾帧不显示缩略图 + 素材卡上冒出英文状态词
   （用户 2026-09-30 在图6/图7 上点的两条）
   ══════════════════════════════════════════════════════════════════════════════ */

test('① 首尾帧的缩略图必须接上「上传记录里的资产 URL」这个来源', () => {
  /* 根因：`files.first/last` 存的是 `<input type=file>` 给的**裸 File 对象**
     （`replaceFiles` 直接把 `Array.from(event.target.files)` 塞进 state），
     而浏览器 `File` 上**既没有 `previewUrl` 也没有 `url`**
     ⇒ `src` 恒为 '' ⇒ `MediaAssetCard` 走「无 src → 只画类型图标」那条分支
     ⇒ 用户看到的就是一个空卡片（他原话：「它就只是一个卡片而已」）。
     对照**能正常显示**的普通素材那条路（VideoStudio 的 materialEntries 分支）：
         item.previewUrl || item.url || uploadFor(item.file)?.asset?.url || ''
     —— 缺的正是第三个来源。 */
  assert.match(
    video,
    /src=\{file\.previewUrl \|\| file\.url \|\| uploadUrl \|\| ''\}/,
    'FilePicker 的 src 必须接上 uploadUrl（上传完成后的资产地址）',
  );
  assert.match(video, /label="上传首帧图"[\s\S]{0,400}?uploadUrl=\{uploadFor\(files\.first\[0\]\)\?\.asset\?\.url \|\| ''\}/,
    '首帧必须把上传记录的 URL 传进去');
  assert.match(video, /label="上传尾帧图"[\s\S]{0,400}?uploadUrl=\{uploadFor\(files\.last\[0\]\)\?\.asset\?\.url \|\| ''\}/,
    '尾帧必须把上传记录的 URL 传进去');
  assert.match(video, /function FilePicker\(\{[^}]*uploadUrl/,
    'FilePicker 的签名里必须声明 uploadUrl，否则传了也不会用');
});

test('② 普通素材那条「能显示缩略图」的路必须原样保留（别把好的改坏）', () => {
  assert.match(video, /image=\{\{ url: item\.previewUrl \|\| item\.url \|\| uploadFor\(item\.file\)\?\.asset\?\.url \|\| '', status: mediaCardStatus\(item\.file\) \}\}/,
    '普通素材的第三个来源（上传记录 URL）必须仍在');
});

test('③ 素材卡状态角标不许把内部枚举原样渲染（用户看到的是「ready」）', () => {
  assert.doesNotMatch(card, /\{image\.status\}/,
    '不得直接渲染 image.status 的原始字符串 —— 调用方传的是内部枚举（ready / loaded）');
  assert.match(card, /STATUS_LABEL\[/, '必须经 STATUS_LABEL 查表后再渲染');
  assert.match(card, /export const STATUS_LABEL = Object\.freeze\(/, 'STATUS_LABEL 必须导出，便于门禁直接断言');
});

test('④ 查不到的状态**整个不渲染**（宁可没有角标，也不要漏一个英文单词）', () => {
  assert.match(card, /const statusLabel = STATUS_LABEL\[String\(image\?\.status \|\| ''\)\.toLowerCase\(\)\] \|\| '';/,
    '查不到必须回落成空串');
  assert.match(card, /\{statusLabel && <span className="ec-xhs-card-status">\{statusLabel\}<\/span>\}/,
    '空串时不得渲染角标元素');
});

test('⑤ STATUS_LABEL 必须覆盖各调用方真实传入的取值，且**全是中文**', () => {
  const block = /export const STATUS_LABEL = Object\.freeze\(\{([\s\S]*?)\}\);/.exec(card);
  assert.ok(block, '必须能解析出 STATUS_LABEL 的内容');
  const entries = [...block[1].matchAll(/(\w+):\s*'([^']+)'/g)].map(m => [m[1], m[2]]);
  assert.ok(entries.length >= 4, `至少要覆盖几个常见状态，实际 ${entries.length}`);
  for (const [key, label] of entries) {
    assert.match(label, /[\u4e00-\u9fff]/, `${key} 的标签必须是中文，当前是「${label}」`);
  }
  // VideoStudio 的 mediaCardStatus() 会返回 ready / uploading / error
  for (const key of ['ready', 'uploading', 'error']) {
    assert.ok(entries.some(([k]) => k === key), `STATUS_LABEL 必须覆盖 "${key}"`);
  }
  // XhsContentMode 传的是 loaded
  assert.ok(entries.some(([k]) => k === 'loaded'), 'STATUS_LABEL 必须覆盖 "loaded"');
});

test('⑥ 视频侧 @ 菜单的缩略图判据不受影响（那是另一条路，已有门禁）', () => {
  /* renderVideoMentionItem 是 @ 菜单那条路（批 CY 修过），本批**没动**它。
     钉住，免得有人以为「首尾帧没缩略图」就把 @ 菜单那条也一起改了。 */
  assert.match(video, /export function renderVideoMentionItem/);
  assert.match(video, /item\?\.thumb \|\| item\?\.file\?\.previewUrl \|\| item\?\.url/,
    '@ 菜单的缩略图判据必须原样保留');
});
