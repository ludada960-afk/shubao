/* ═══ 2026-09-28 批 CY 门禁：**@ 按钮全站统一**（用户点名最重的一条）══════════════════════════════
   用户原话（逐字）：
   「这个@ 按钮为什么没有照首页那边的做法去做呢？真正的这种按钮，它是**向上张开面板**。然后要**映射你
    现在的这一个上传的素材的命名还有图标**等方案呀……我现在要求你把整个网站里面所有的这种 @ 按钮，
    就是不管是首页或者各种子页面或者画布里面涉及到的这个按钮，你都要**统一同一个类型的标准**。」
   「你看首页视频生成这边的 @ 按钮的张开面板这个逻辑其实做的已经挺好了，但是也存在一个问题。
    就是你**为什么没有映射到当前这个素材它的图片呢**？」
   「你看首页图片生成这边就是有的。他这个 @ 按钮的逻辑会更正确……包括张开的面板是**向上**的，
    然后这个**大小、宽度**这些东西你都要对齐呀。」
   判据分三层：
     ① **同一份实现**：首页（图片/视频）、子页面那一行、画布 —— 都用 `ImageMentionPicker`（不许再有第二套）；
     ② **同一套几何/行为**：34px 圆钮 / 面板宽 260 / **上方放不下才翻下**（默认向上）/ 无素材自动禁用变暗；
     ③ **同一套映射**：菜单行要显示素材**自己的名字 + 缩略图**（有画面的素材），音频才退回图标。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* ⚠️ 断言用**剥注释后的源码**：本仓规矩是"删掉的东西要在注释里留案底"，
   注释里必然出现被删标识符（如 `.media-field-meta-at-menu`），直接对原文断言"不得出现"会被自己的注释判红。 */
const stripComments = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const read = rel => readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
const readCode = rel => stripComments(read(rel));

test('CY-① 三处 @ 都是同一份实现（首页图片 / 首页视频 / 子页面那一行 / 画布）', () => {
  const picker = 'components/creation/ImageMentionPicker.jsx';
  for (const [file, why] of [
    ['src/pages/Home/VisualCreationMode.jsx', '首页·图片生成'],
    ['src/pages/VideoStudio/index.jsx', '首页·视频生成'],
    ['src/components/media/PromptMetaRow.jsx', '子页面那一行'],
    ['src/pages/EcCanvas/components/CanvasStudio.jsx', '画布（ComposerMention）'],
  ]) {
    assert.match(readCode(file), new RegExp(picker.split('/').pop().replace('.', '\\.')), why + ' 必须用共用件 ' + picker);
  }
  /* 子页面那一行**不许**再有自己写的那套菜单（往下开、纯文字 —— 批 CY 删掉的就是它） */
  assert.doesNotMatch(readCode('src/components/media/PromptMetaRow.jsx'), /media-field-meta-at-menu/,
    '自建 @ 菜单必须退役（批 CY）');
  assert.doesNotMatch(readCode('src/components/media/WorkbenchShell.css'), /\.media-field-meta-at\b/,
    '自建 @ 按钮的样式也要一起删（留着会让人以为还有第二套）');
});

test('CY-② 同一套几何与行为：34px 圆钮 / 宽 260 / 默认向上 / 空态禁用', () => {
  const css = read('src/components/creation/ImageMentionPicker.css');
  assert.match(css, /\.image-mention-trigger \{[^}]*width: 34px; height: 34px/, '触发按钮 34×34（全站同一档）');
  assert.match(css, /\.image-mention-trigger:disabled \{[^}]*opacity: \.45/, '无素材必须变暗（不是死按钮）');
  const jsx = read('src/components/creation/ImageMentionPicker.jsx');
  assert.match(jsx, /const width = 260;/, '面板宽度是定值 260（三处同一个宽度）');
  /* 「上方放不下才翻到下方」= 默认向上。改这条等于把"向上张开"这条用户口径推翻，必须同时改本判据。 */
  assert.match(jsx, /const top = roomAbove >= height \|\| roomBelow < height[\s\S]{0,120}rect\.top - height - gap/,
    '默认向上张开（roomAbove 够就放上面）');
  assert.match(jsx, /disabled=\{disabled \|\| !available\.length\}/, '没素材时按钮自己禁用');
});

test('CY-③ 同一套映射：菜单行显示素材自己的名字 + 缩略图（音频才用图标）', () => {
  /* 视频侧那一条自绘行是**唯一**带条件的实现（图片/视频/音频三种素材），单独验它。
     ⚠️ 验证边界（如实记）：**不可能**在探针里跑到"上传完成"那一步 —— 客户端走 tus 分片协议
     （`/api/video/uploads` + PATCH 分片 + `/api/video/upload-results/:id`），
     第一次跑 `.qa/cy-at-unify.mjs` 时 mock 一律回 {ok:true} ⇒ 素材拿不到 URL ⇒ 菜单行 `thumb:false`，
     看起来像"代码没改"。改用简单路径 `uploadMode:'direct'`（POST /api/video/assets）也不行：
     上传记录仍要经过 `startUpload` 的登录态与状态机。
     ⇒ 所以这里守**代码路径**（渲染分支 + 三个来源 + 调用方把 resolver 传进来了），
       **并在 RTK 里如实标注"视频侧缩略图 = 代码路径已验证，端到端未截图"**。
     真实端到端验证需要登录生产、真实上传一张图（那要用户在场），不在本批范围内。 */
  const src = read('src/pages/VideoStudio/index.jsx');
  assert.match(src, /export function renderVideoMentionItem\(item, resolveUpload = null\)/,
    '必须是可被门禁引用的具名导出（也说明它被当纯渲染函数对待）');
  const thumb = src.slice(src.indexOf('export function renderVideoMentionItem'), src.indexOf('const RATIOS ='));
  assert.match(thumb, /item\?\.thumb \|\| item\?\.file\?\.previewUrl \|\| item\?\.url \|\| \(resolveUpload/,
    '缩略图三个来源都要认（服务端缩略图 / 本地预览 / 上传记录里的素材 URL）—— 只认一种就会静默不出图');
  assert.match(thumb, /const hasThumb = Boolean\(thumb\) && item\?\.kind !== 'audio'/, '音频没有画面，不进缩略图分支');
  assert.match(thumb, /<ResponsiveImage/, '有图时渲染真实预览（与共用件默认行同一尺寸档）');
  assert.match(thumb, /<Icon size=\{15\} \/>/, '没图时退回类型图标（不是空白）');
  /* 调用方必须把 resolver 传进来，否则"上传记录的素材 URL"这一路永远空 */
  assert.match(src, /renderItem=\{item => renderVideoMentionItem\(item, file => uploadsRef\.current\?\.get\?\.\(file\)\?\.asset\?\.url/,
    '调用点必须传 resolver（素材 URL 只有组件作用域拿得到；这样也避开了 uploadFor 的 TDZ）');
});
