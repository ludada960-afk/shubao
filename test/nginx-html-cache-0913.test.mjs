// test/nginx-html-cache-0913.test.mjs
// 2026-09-13 生产事故（用户：站点打不开了）：
//   静态资源 1 年 immutable 缓存，但 index.html 没有任何缓存头 → 浏览器启发式缓存旧 HTML，
//   部署后旧 HTML 指向已被替换的 chunk → 页面直接打不开（白屏/加载失败）。
//   修法：HTML 走 no-cache 协商缓存；hashed 资源保持长缓存。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const raw = readFileSync(new URL('../scripts/nginx/shuimg.cn.conf', import.meta.url), 'utf8');

/* ⚠️ nginx 注释是 `#` 到行尾，**必须先剥掉**再拿正则去匹。
   这次就栽在这上面：2026-10-01 我在这个文件里写了几段解释性的 `#` 注释，
   注释里出现了 `expires 1y`、`gzip_types` 这些字样，于是
     · 「不许再出现 expires 1y」判成了我自己的注释里有
     · 「gzip_types 缺了 text/css」匹配到了注释里那句"被注释掉了"，没匹配到真配置
   （同一个坑 design-ratchet.mjs 早就为 CSS 写过 stripComments，这里是 nginx 版。） */
const conf = raw.replace(/^[ \t]*#[^\n]*$/gm, '');

test('index.html 不允许被缓存住（强制协商缓存）', () => {
  const block = conf.match(/location = \/index\.html \{([\s\S]*?)\n    \}/);
  assert.ok(block, '存在 index.html 专属 location');
  assert.match(block[1], /Cache-Control "no-cache, must-revalidate"/, 'HTML 必须协商缓存');
});

test('SPA 回退路径同样不允许启发式缓存', () => {
  const root = conf.match(/location \/ \{([\s\S]*?)\n    \}/);
  assert.ok(root, '存在根 location');
  assert.match(root[1], /Cache-Control "no-cache, must-revalidate"/, '回退也要 no-cache');
  assert.match(root[1], /try_files \$uri \$uri\/ \/index\.html/, 'SPA 回退保留');
});

test('hashed 静态资源仍然长缓存（immutable），且只有一行 Cache-Control', () => {
  const assets = conf.match(/location ~\* \\\.\(js\|css[^{]*\{([\s\S]*?)\n    \}/);
  assert.ok(assets, '资源 location 存在');
  /* 2026-10-01 性能批：原来是 `expires 1y;` **加** `add_header Cache-Control
     "public, immutable"`。`expires` 自己就会发一个 `Cache-Control: max-age=…`，
     于是响应里出现**两个** Cache-Control 头（线上实测确认），格式不合法。
     现在合成一行，语义不变（1 年 + immutable）。 */
  assert.match(assets[1], /add_header Cache-Control "public, max-age=31536000, immutable" always;/,
    '静态资源必须是「一行」Cache-Control：1 年 + immutable');
  assert.doesNotMatch(assets[1], /expires\s+1y/,
    '不要再用 `expires 1y` —— 它会额外发一个 Cache-Control，与 add_header 叠成两个头');
  const cacheHeaders = assets[1].match(/Cache-Control/g) || [];
  assert.equal(cacheHeaders.length, 1,
    `Cache-Control 只允许出现一次，实际 ${cacheHeaders.length} 次`);
});

test('静态资源的扩展名清单必须包含 webp（实测漏了，导致每次都重拉）', () => {
  /* 2026-10-01 实测线上：
       /images/logo.png        -> 1 年 immutable            [对]
       /images/logo-icon.webp  -> no-cache, must-revalidate [错]
     而这个站点的图几乎全是 .webp（图库缩略图、首页入口图），
     也就是说每次打开页面都要把这些图重新跟服务器确认一遍。 */
  /* 用 [^)]* 会停在这一组扩展名里的**第一个**右括号后面（`(js|css|…` 就断了），
     所以必须一路吃到行尾的 `)$ {` 再倒着取整组。 */
  const assets = conf.match(/location ~\* \\\.\(([^)]*)\)\$ \{/);
  assert.ok(assets, '找得到静态资源 location');
  const types = assets[1].split('|');
  for (const required of ['js', 'css', 'png', 'webp', 'woff2', 'wasm']) {
    assert.ok(types.includes(required),
      `静态资源扩展名清单缺了 ${required}（实际：${types.join('|')}）`);
  }
});

/* ═══ 2026-10-01 性能批：gzip_types ══════════════════════════════════════════════
   用户原话：「我感觉我在整个网站各个地方进行操作，都会有所延迟」。
   线上实测（显式声明 Accept-Encoding 之后）：
     /                        -> content-encoding: gzip   [唯一被压的]
     /assets/index-*.js        -> 715693 字节，无 content-encoding
     /assets/style-*.css       -> 864374 字节，无 content-encoding
     /api/video/capabilities  ->  15143 字节，无 content-encoding
   原因是 nginx.conf 里那行 `gzip_types ...` **被注释掉了**，
   于是只有默认的 text/html 会压。首屏那两个文件压后 251KB + 138KB
   ⇒ 1.58MB 变 389KB，每次冷启动白传 1.2MB。 */
test('gzip_types 必须覆盖 js/css/json（否则首屏资源全程不压缩）', () => {
  assert.match(conf, /^\s*gzip on;/m, 'gzip 必须开');
  const types = conf.match(/gzip_types([^;]*);/);
  assert.ok(types, '必须有显式的 gzip_types');
  const list = types[1];
  for (const required of ['text/css', 'application/javascript', 'application/json', 'application/wasm']) {
    assert.ok(list.includes(required),
      `gzip_types 缺了 ${required} —— 这类响应会以原始体积发出去`);
  }
  /* 刻意不压图片：png/jpg/webp 压不动，白烧 CPU */
  assert.doesNotMatch(list, /image\/(?!svg)/,
    '不要把 image/* 放进 gzip_types（压不动，纯浪费 CPU）');
  assert.match(list, /image\/svg\+xml/, 'svg 是文本，压得动，要留');
});
