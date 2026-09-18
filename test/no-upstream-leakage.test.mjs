// test/no-upstream-leakage.test.mjs
// 2026-09-21 「上游泄漏」门禁 —— 用户铁律：
//   「绝不能向用户暴露 上游 / 供应商 / 备用通道 / 中转站 / 任务号 / 内部域名 / 密钥名 / 内部服务标识。」
//   一旦泄漏，用户直接看到「我们在转卖别人的能力」= 信任级事故。
//
// 设计要点（与既有 provider-failover-observability-0912 互补，不重复）：
//   · 既有测试只扫 2 个 server 文件的全部中文字符串（粗粒度）；
//   · 本测试只扫【用户可见面】，避免「全仓 grep」式的噪音淹没真缺陷。
//
// 判据（对应 00-principles 原则 §12「指标必须测量判据本身」）：
//   缺陷 = 用户能在界面上读到「谁在背后供货」。
//   合规 = provider / upstream 作为变量名、注释、服务端日志、开发者控制台出现。
//   「模型名」是故意展示给用户的（视频模型下拉即标准答案），不算泄漏；
//   泄漏仅当它同时暴露了「供货方是谁」。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/* ═══════════════ 1. 用户可见面提取器 ═══════════════
   只认这六类，其余一律不看（避免噪音）：
     a) JSX 文本节点           >文本<
     b) JSX 属性文本           aria-label / title / placeholder / alt = "..."
     c) 上屏 API 调用          setToast / setError / showToast / alert / setErr(...)
     d) 页面标题 / 下载名      document.title= / a.download= / download="..."
     e) 后端上屏字段           res.json({ message|error|detail|reason: '...' })
*/
/* 裁定③：属性值分三种写法，处理方式不同 ——
   · title="字面量"      → 是文案，扫
   · title={'字面量'}    → 是文案，扫（去掉花括号后取其中字符串）
   · title={变量或表达式} → **不是文案**，只扫其中【字符串字面量的内部】；
     变量名 / 属性名 / 表达式片段一律不算（否则每个叫 fallback 的局部变量都会误报一次，
     门禁很快会因噪音被关掉）。 */
const ATTR_PLAIN_RE = /\b(aria-label|title|placeholder|alt)\s*=\s*"([^"]*)"/g;
const ATTR_BRACE_RE = /\b(aria-label|title|placeholder|alt)\s*=\s*\{([^}]*)\}/g;
/* JSX 表达式里的字符串字面量：'…' / "…" / `…`（模板里只取静态部分） */
const STRING_LITERAL_RE = /(['"`])([^'"`]{2,200})\1/g;
const TEXT_RE = />([^<>{}]{2,200})</g;
const TOAST_RE = /\b(setToast|setError|setErr|showToast|alert|setHint|setMessage)\s*\(\s*(['"`])([^'"`]{2,200})/g;
const DL_RE = /\b(a\.download|document\.title)\s*=\s*(['"`])([^'"`]{1,200})/g;
const DLATTR_RE = /\bdownload\s*=\s*(["'{])([^"'}]{1,200})/g;
const SERVER_FIELD_RE = /\b(message|error|detail|reason)\s*:\s*(['"`])([^'"`]{2,200})/g;

export function extractVisibleSurfaces(source) {
  const out = [];
  const lines = source.split(/\r?\n/);
  lines.forEach((line, index) => {
    const lineNo = index + 1;
    const push = (kind, text) => {
      const value = String(text || '').trim();
      if (!value || value.length < 2) return;
      if (/[{}]/.test(value)) return;
      /* 同一行同一文案可能被多条正则命中（如 setError('x') 同时命中 TOAST 与 TEXT），去重 */
      if (out.some(item => item.line === lineNo && item.text === value)) return;
      out.push({ line: lineNo, kind, text: value });
    };
    let m;
    /* ① 纯字符串属性：整体都是文案 */
    ATTR_PLAIN_RE.lastIndex = 0;
    while ((m = ATTR_PLAIN_RE.exec(line))) push(m[1], m[2]);
    /* ② `attr={ … }`：只取花括号内【字符串字面量】，变量/表达式片段不取 */
    ATTR_BRACE_RE.lastIndex = 0;
    while ((m = ATTR_BRACE_RE.exec(line))) {
      let lit;
      STRING_LITERAL_RE.lastIndex = 0;
      while ((lit = STRING_LITERAL_RE.exec(m[2]))) push(m[1], lit[2]);
    }
    TEXT_RE.lastIndex = 0;
    while ((m = TEXT_RE.exec(line))) push('text', m[1]);
    TOAST_RE.lastIndex = 0;
    while ((m = TOAST_RE.exec(line))) push('toast', m[3]);
    DL_RE.lastIndex = 0;
    while ((m = DL_RE.exec(line))) push('filename', m[3]);
    DLATTR_RE.lastIndex = 0;
    while ((m = DLATTR_RE.exec(line))) push('filename', m[2]);
    SERVER_FIELD_RE.lastIndex = 0;
    while ((m = SERVER_FIELD_RE.exec(line))) push('server-field', m[3]);
  });
  return out;
}

/* ═══════════════ 2. 按证据建立的禁用词表 ═══════════════
   每条注明「为什么它是泄漏」。不含裸 provider/upstream/fallback 的变量名场景 ——
   那些只在【作为上屏文本】时才算，由提取器先行过滤。
*/
export const LEAK_RULES = [
  { id: 'upstream-cn', re: /上游/, why: '直接暴露供应链上游' },
  { id: 'supplier-cn', re: /供应商|供货|供方/, why: '直接暴露供货关系' },
  { id: 'relay-cn', re: /中转|中转站/, why: '暴露中转/转售链路' },
  { id: 'backup-channel', re: /备用通道|备份通道|备用供应商/, why: '暴露存在备用供货方' },
  { id: 'channel-cn', re: /通道/, why: '「通道」在本项目语境多指供货链路，需逐条判定' },
  { id: 'task-no', re: /任务号|工单号/, why: '暴露内部任务/工单标识' },
  { id: 'task-id-lit', re: /\btask[_-]?id\b/i, why: '内部任务标识' },
  { id: 'provider-word', re: /\bprovider\b/i, why: '英文供应商字样直接上屏' },
  { id: 'upstream-word', re: /\bupstream\b/i, why: '英文上游字样直接上屏' },
  { id: 'vendor-word', re: /\bvendor\b/i, why: '英文供货商字样直接上屏' },
  { id: 'fallback-word', re: /\bfallback\b/i, why: '暴露存在备选链路' },
  { id: 'internal-host', re: /localhost:|127\.0\.0\.1|0\.0\.0\.0|192\.168\.|10\.\d+\.\d+\.\d+/, why: '内网域名/端口' },
  { id: 'secret-name', re: /\b(API_KEY|APIKEY|SECRET_KEY|ACCESS_TOKEN|LLM_KEY|MINI_KEY)\b/, why: '密钥变量名' },
  { id: 'internal-service', re: /\b(IP233|Change2Pro|change2pro)\b/, why: '第三方供货平台名（内部服务标识）' },
];

/* ═══════════════ 3. 登记豁免表（白名单 + 理由） ═══════════════
   键格式：'相对路径:行:规则id'。必须写清「为什么用户看到它是可接受的」。
*/
export const ALLOWLIST = {
  'src/pages/Legal/index.jsx:54:supplier-cn': '隐私政策法定披露：告知数据会传给模型服务商，未点名任何具体厂商，属用户知情权',
  /* ⚠️ 豁免表按**行号**做键，所以 AdminConsole 里插/删行必须同步搬这张表。
     2026-09-19 批 K-B：SKU_LABELS 末尾追加了 6 条新档 + 2 行注释（+8 行），
     下面 AdminConsole 的键已整体 +8（原 211/313/330/331/334/360/333 → 219/321/338/339/342/368/341）。 */
  'src/pages/AdminConsole/index.jsx:219:supplier-cn': '管理后台 owner-only（App.jsx 路由 admin + 服务端 requireOwner），用户端不可达',
  'src/pages/AdminConsole/index.jsx:219:channel-cn': '管理后台 owner-only：视频模型通道分组标题',
  'src/pages/AdminConsole/index.jsx:321:upstream-cn': '管理后台 owner-only：上游单价运维字段',
  'src/pages/AdminConsole/index.jsx:338:upstream-cn': '管理后台 owner-only：上游成本账本',
  'src/pages/AdminConsole/index.jsx:339:upstream-cn': '管理后台 owner-only：上游累计扣费',
  'src/pages/AdminConsole/index.jsx:342:upstream-cn': '管理后台 owner-only：上游请求计数',
  'src/pages/AdminConsole/index.jsx:368:upstream-cn': '管理后台 owner-only：上游成本汇总',
  'src/pages/AdminConsole/index.jsx:368:channel-cn': '管理后台 owner-only：支付通道费',
  'src/pages/AdminConsole/index.jsx:341:provider-word': '管理后台 owner-only：aria-label 拼接 provider.label',
};

/* ═══════════════ 4. 扫描实现 ═══════════════ */
function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (/^(node_modules|\.git|dist|build|\.next)$/.test(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (/\.(jsx|js|mjs|html)$/.test(name)) acc.push(full);
  }
  return acc;
}

export function scanFiles(files, rootDir) {
  const hits = [];
  for (const file of files) {
    const rel = relative(rootDir, file).replace(/\\/g, '/');
    const source = readFileSync(file, 'utf8');
    for (const surface of extractVisibleSurfaces(source)) {
      for (const rule of LEAK_RULES) {
        if (!rule.re.test(surface.text)) continue;
        const key = rel + ':' + surface.line + ':' + rule.id;
        if (ALLOWLIST[key]) continue;
        hits.push({ file: rel, line: surface.line, kind: surface.kind, rule: rule.id, why: rule.why, text: surface.text });
      }
    }
  }
  return hits;
}

/* 裁定①：浏览器插件是【用户安装、用户能看到的界面】，其 popup/注入 UI 文案属于用户可见面，
   必须纳入扫描。三个扩展目录都在 git 跟踪内。 */
const PLUGIN_DIRS = ['extensions/shubao-extractor', 'shubao-extension', 'shubao-extractor'];
const SRC_FILES = walk(join(ROOT, 'src'));
const SERVER_FILES = walk(join(ROOT, 'server'));
const PLUGIN_FILES = PLUGIN_DIRS.flatMap(dir => {
  const abs = join(ROOT, dir);
  try { return walk(abs); } catch { return []; }
});
const SOURCE_FILES = [...SRC_FILES, ...SERVER_FILES, ...PLUGIN_FILES];

/* ═══════════════ 5. 测试用例 ═══════════════ */

test('门禁：用户可见面不得出现上游 / 供货 / 内部标识', () => {
  const hits = scanFiles(SOURCE_FILES, ROOT);
  const message = hits
    .slice(0, 25)
    .map(h => h.file + ':' + h.line + ' [' + h.rule + '] ' + h.text.slice(0, 60) + '  <- ' + h.why)
    .join('\n');
  assert.deepEqual(hits, [], '用户可见面泄漏 ' + hits.length + ' 处：\n' + message);
});

test('检测器自证 ①：静态泄漏文案必须变红', () => {
  const fixture = 'export default () => <div title="上游供应商 A 通道">备用通道已切换</div>;';
  const surfaces = extractVisibleSurfaces(fixture);
  const rules = LEAK_RULES.filter(r => surfaces.some(s => r.re.test(s.text)));
  assert.ok(rules.length >= 2, '至少命中 2 条规则，实测 ' + rules.length);
  assert.ok(rules.some(r => r.id === 'upstream-cn'), '命中 上游');
  assert.ok(rules.some(r => r.id === 'backup-channel'), '命中 备用通道');
});

test('检测器自证 ②：toast / aria-label / 下载名三条通道都要能抓到', () => {
  const toast = extractVisibleSurfaces("setError('上游供应商失败')");
  assert.equal(toast.length, 1, 'toast 通道抓到 1 条，实测 ' + toast.length);
  assert.equal(toast[0].kind, 'toast');
  assert.match(toast[0].text, /上游/);

  const aria = extractVisibleSurfaces('<button aria-label="备用通道切换" />');
  assert.equal(aria.length, 1);
  assert.equal(aria[0].kind, 'aria-label');

  const dl = extractVisibleSurfaces("a.download = '上游任务号.png'");
  assert.equal(dl.length, 1);
  assert.equal(dl[0].kind, 'filename');
  assert.match(dl[0].text, /任务号/);
});

test('检测器自证 ③：合规形态不得误报（变量名 / 注释 / 日志 / 模型名）', () => {
  const benign = [
    'const upstreamProvider = pickVendor();',
    '// 主的 gpt-image-2 通道提交失败时改用备用通道（用户无感）',
    "console.warn('[video-generation] provider failover', job.id);",
    'const model = { id: "veo-3", label: "Veo 3", provider: "google" };',
    'throw httpError(502, VIDEO_PROVIDER_FAILED);',
    "res.json({ error: '视频生成失败，请稍后重试' });",
  ];
  for (const snippet of benign) {
    const surfaces = extractVisibleSurfaces(snippet);
    const leaked = LEAK_RULES.filter(r => surfaces.some(s => r.re.test(s.text)));
    assert.deepEqual(leaked.map(r => r.id), [], '误报：' + snippet + ' -> ' + leaked.map(r => r.id).join(','));
  }
});

test('检测器自证 ③b：属性值是 JS 表达式时，只认字符串字面量内部（裁定③）', () => {
  /* 变量名 fallback 是局部变量语义，不得因名字里含 fallback 而命中。
     注意：该表达式里确实有一个合法字面量 '电商案例'，提取器应只取它、且它不含禁用词。 */
  const exprVar = extractVisibleSurfaces("<ResponsiveImage alt={fallback?.label || '电商案例'} />");
  assert.deepEqual(exprVar.map(item => item.text), ['电商案例'],
    '只应提取字符串字面量本身，变量名/表达式片段不得进入，实测 ' + JSON.stringify(exprVar));
  assert.deepEqual(LEAK_RULES.filter(rule => exprVar.some(item => rule.re.test(item.text))).map(rule => rule.id), [],
    '局部变量名 fallback 不得触发 fallback-word 规则');

  /* 但表达式【字符串字面量内部】出现禁用词，仍然要命中 */
  const exprLit = extractVisibleSurfaces("<img alt={x || '上游任务号'} />");
  assert.equal(exprLit.length, 1, '字符串字面量内部命中 1 条');
  assert.equal(exprLit[0].text, '上游任务号');

  /* 纯字符串属性照常命中 */
  const plain = extractVisibleSurfaces('<img alt="备用通道" />');
  assert.equal(plain.length, 1);
  assert.equal(plain[0].text, '备用通道');
});

test('检测器自证 ④：豁免表非空且每条都有理由', () => {
  const entries = Object.entries(ALLOWLIST);
  assert.ok(entries.length > 0, '豁免表不得为空');
  for (const [key, reason] of entries) {
    assert.ok(reason && reason.length >= 8, key + ' 的豁免理由过短或缺失');
  }
});

test('检测器自证 ⑤：豁免精确到「文件:行:规则」，不得整文件放行', () => {
  for (const key of Object.keys(ALLOWLIST)) {
    const parts = key.split(':');
    assert.equal(parts.length, 3, '豁免键必须是 文件:行:规则id 三段式 -> ' + key);
    assert.match(parts[1], /^\d+$/, '第二段必须是行号 -> ' + key);
    assert.ok(LEAK_RULES.some(r => r.id === parts[2]), '第三段必须是已知规则 id -> ' + key);
  }
});

test('门禁覆盖面：至少扫到 src/ 与 server/ 两侧', () => {
  const rels = SOURCE_FILES.map(f => relative(ROOT, f).replace(/\\/g, '/'));
  assert.ok(rels.some(r => r.startsWith('src/')), '覆盖 src/');
  assert.ok(rels.some(r => r.startsWith('server/')), '覆盖 server/');
  assert.ok(rels.length > 100, '扫描面应覆盖全站源文件，实测 ' + rels.length);
});