import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/pages/Home/CreationShowcase.jsx', import.meta.url), 'utf8');
const showcaseCss = await readFile(new URL('../src/pages/Home/CreationShowcase.css', import.meta.url), 'utf8');

test('XHS showcase reuses the shared publish modal contract', () => {
  assert.match(source, /import NoteModal from '\.\.\/\.\.\/NoteModal\.jsx'/);
  assert.match(source, /body_text: getXhsPublishBody\(entry\)/);
  assert.match(source, /hashtags: Array\.isArray\(entry\.tags\)/);
  assert.match(source, /initialImageIndex=\{initialIndex\}/);
  assert.match(source, /creation-showcase-body creation-showcase-content-body/);
  assert.match(source, /ec-product-suite-showcase xhs-case-showcase/);
  assert.match(source, /<p>\{getXhsPublishBody\(source\)\}<\/p>/);
  assert.match(source, /subMode === 'plog'/);
  assert.match(source, /案例暂未入库/);
  assert.doesNotMatch(source, /creation-showcase-content-facts/);
  assert.doesNotMatch(source, /creation-showcase-content-tabs/);
});

test('XHS case copy block aligns with ecommerce suite copy (centered, slightly low)', () => {
  // 对齐电商生图商品套图文案区的排版：纵向居中且顶部留白大于底部（46/28），
  // 文字块不贴顶；移动端保持同一节奏（34/20）。
  const rule = showcaseCss.match(/\.xhs-case-showcase \.creation-showcase-content-copy-shell \{[^}]*\}/)?.[0] || '';
  assert.match(rule, /display: flex;/);
  assert.match(rule, /flex-direction: column;/);
  assert.match(rule, /justify-content: center;/);
  assert.match(rule, /padding: 46px 26px 28px;/);
  assert.match(showcaseCss, /gap: 7px; padding: 34px 20px 20px;/);
});

test('XHS case section drops the single-case promotional headline', () => {
  // 案例区宣讲标题不得再绑定「厦门3天2夜」单案例；改为能力向通用文案，
  // 具体案例内容只出现在下方真实成品卡（GALLERY 数据本身）里。
  assert.doesNotMatch(source, /厦门\s*3\s*天\s*2\s*夜[^'\n]*发布/);
  assert.match(source, /title: '一句话，到一套能直接发布的图文'/);
  assert.match(source, /description: '封面、配图、标题、正文和标签一次成套生成。下方为真实生成的成品案例，可逐张检查、编辑后直接发布。'/);
});

test('XHS case images stream thumbnails so the real case is visible within 1-2s', () => {
  // 真实案例图走 /api/gallery-image 的 thumb 派生（服务端 w640 WebP，约百 KB、
  // 首跳 ~130ms，Cache-Control immutable），等价于公共 /images/.thumbs 缩略管线
  // 在画廊 API 图上的对应实现；封面 eager+high 保证首屏 1-2s 可见，其余懒加载。
  const img = source.match(/<ResponsiveImage className="creation-showcase-content-image-media"[^>]*>/)?.[0] || '';
  assert.match(img, /src=\{page\.src\}/);
  assert.match(img, /variant="thumb"/);
  assert.match(img, /priority=\{page\.index === 0\}/);
  assert.match(img, /loading=\{page\.index === 0 \? 'eager' : 'lazy'\}/);
  assert.match(img, /fetchPriority=\{page\.index === 0 \? 'high' : 'auto'\}/);
});
