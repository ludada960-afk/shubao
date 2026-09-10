import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOTS = ['server', 'src', 'scripts'];
const EXTS = new Set(['.mjs', '.js', '.jsx', '.cjs', '.css']);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.') ) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (EXTS.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

test('source files are not collapsed into an escaped single line', () => {
  // 事故模式：用命令写文件时换行被写成字面量 \n，整个文件变成一两行超长文本，
  // 语法看起来还在但运行时必炸（server/billing/checkin.mjs 就是这么坏的）。
  const offenders = [];
  for (const file of ROOTS.flatMap(root => walk(root))) {
    const first = fs.readFileSync(file, 'utf8').split('\n')[0];
    if (first.length > 200 && first.includes('\\n')) offenders.push(file);
  }
  assert.deepEqual(offenders, [], 'these files look corrupted (escaped newlines): ' + offenders.join(', '));
});

test('the removed broken monthly-card check-in never comes back', () => {
  assert.equal(fs.existsSync('server/billing/checkin.mjs'), false);
  const index = fs.readFileSync('server/index.mjs', 'utf8');
  // 路由注册绝不能嵌在另一个 handler 里面：每来一次请求就会再注册一次，路由表会越滚越大。
  assert.equal(index.includes('/api/billing/checkin'), false);
  const generateStart = index.indexOf("app.post('/api/generate'");
  assert.ok(generateStart > -1, 'missing /api/generate route');
  const body = index.slice(generateStart, generateStart + 400);
  assert.equal(/app\.(post|get|put|delete)\(/.test(body.slice(body.indexOf('{') + 1)), false,
    'route registration nested inside a handler body');
});
