// test/download-filenames-0929.test.mjs
// 2026-09-29 批 CY-⑮。CY-⑭ 只收掉了画布导出那一处；这一条把**全站**下载文件名钉住。
//
// 前提事实（逐个查实，不是推断）：
//   本站每张生成图的 URL 形如 `/api/generated-assets/<64位sha256>.png`
//   （`saveWorkToAssets.js:36` 的正则 + `server/index.mjs:659` 的路由），
//   而**该路由只设 Content-Type / Cache-Control，不设 Content-Disposition**
//   ⇒ `<a href=… download>` **不带值**时，浏览器取 URL 最后一段当文件名 ⇒ 落盘就是那串 sha。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const SRC = new URL('../src/', import.meta.url).pathname.replace(/^\//, '');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/* 递归列出 src 下所有 jsx/js/mjs */
function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, out); continue; }
    if (/\.(jsx?|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}
const allFiles = walk(SRC);

/* ═══ ① 不许再有裸 download 指向生成资源 URL ══════════════════════════════════════════════
   裸 `download`（不带值）只在一个地方是安全的：href 是**固定路径**（如扩展包 zip）。
   一旦 href 来自 generated-assets（URL 末段是 sha256），文件名就是那串哈希。 */
test('没有「裸 download + 生成资源 URL」的组合（那会落盘成 sha256）', () => {
  const offenders = [];
  for (const f of allFiles) {
    const code = strip(readFileSync(f, 'utf8'));
    /* `<a … download>` 或 `<a … download={...}>` 都可能；只抓**紧邻 href 的裸 download** */
    const bare = /href=\{?([^}\n]*)>?\}?[\s\S]{0,120}?\sdownload(\s|>|\n)/g;
    for (const m of code.matchAll(bare)) {
      const href = m[1] || '';
      /* 固定字面路径（/extensions/…）是安全的 */
      if (/^\s*["'`]\//.test(href)) continue;
      if (/\.(zip|mp4|webm)["'`]/.test(href)) continue;
      offenders.push(`${f}  href=${href.slice(0, 70)}`);
    }
  }
  assert.deepEqual(offenders, [], '这些下载按钮没有文件名，用户会拿到哈希/URL 末段：\n  ' + offenders.join('\n  '));
});

/* ═══ ② 不许把内部 id 写进用户可见的文件名 ════════════════════════════════════════════════ */
test('文件名里不许出现内部 id / 哈希 / 商品兜底', () => {
  const checks = [
    ['src/pages/Home/VisualCreationMode.jsx', /download=\{`shubao-\$\{run\.id\}/, 'run.id（visual-<uuid>）漏进了文件名'],
    ['src/pages/EcCanvas/index.jsx', /product_name \|\| '商品'/, '通用画布的交付兜底名仍是「商品」'],
    ['src/NoteModal.jsx', /`\$\{item\.product_name\}-/, 'product_name 没有兜底（会落盘成 undefined-xxx.png）'],
    ['src/pages/MediaCreation/index.jsx', /<a[^>]*download>\s*<Download/, '「下载第一张」仍是裸 download'],
    ['src/pages/EcStudio/index.jsx', /href=\{proxyImg\(stitchUrl\)\}\s*\n\s*download\s*\n/, '「下载长图」仍是裸 download'],
  ];
  for (const [file, re, why] of checks) {
    assert.ok(!re.test(strip(read(file))), `${file}：${why}`);
  }
});

/* ═══ ③ 收掉之后必须**真的用上了**有意义的材料 ══════════════════════════════════════════════ */
test('四处都改成了 downloadFileName（不是把裸 download 删掉了事）', () => {
  const expectations = [
    ['src/pages/MediaCreation/index.jsx', '下载第一张', /download=\{downloadFileName\(\{[^}]*skillName/],
    ['src/pages/EcStudio/index.jsx', '下载长图', /download=\{downloadFileName\(\{[^}]*长图/],
    ['src/pages/Home/VisualCreationMode.jsx', '首页结果格', /download=\{downloadFileName\(\{[^}]*selectedSkill/],
  ];
  for (const [file, label, re] of expectations) {
    assert.match(strip(read(file)), re, `${file}（${label}）必须走 downloadFileName`);
  }
});

/* ═══ ④ 共用工具本身要够用 ════════════════════════════════════════════════════════════════════ */
test('downloadFileName 存在且语义正确（它是这一批的共同依赖）', () => {
  const m = read('src/pages/Home/mediaHistoryModel.js');
  assert.match(m, /export function downloadFileName\(/, '必须导出 downloadFileName');
  /* 非法字符清洗走的是提取出来的 UNSAFE 常量（第一版按字面量断言，量错了写法不是行为） */
  assert.match(m, /const UNSAFE =/, '非法文件名字符表必须是具名常量（可被门禁引用）');
  assert.match(m, /replace\(UNSAFE, '_'\)[\s\S]{0,40}\.slice\(0, 40\)/,
    '必须清洗非法文件名字符 + 限长（Windows 路径上限）');
  assert.match(m, /count > 1 \? base \+ '-' \+ \(index \+ 1\)/, '多张时才编号');
  /* 已知局限：它**不**识别哈希。画布那条链走的是 deliveryNameFor（有哈希判定），
     这里如实登记，避免下一个人误以为 downloadFileName 已经能挡哈希。 */
  const delivery = read('src/pages/EcCanvas/deliveryNameModel.js');
  assert.match(delivery, /export function looksLikeContentHash/, '画布链的哈希判定在 deliveryNameModel');
  assert.ok(!/looksLikeContentHash/.test(m), 'downloadFileName 本身不判哈希 —— 传进去之前要自己先挑过');
});
