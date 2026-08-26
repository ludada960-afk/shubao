const NL = String.fromCharCode(10);
// server/services/visionBridge.mjs — 图像视觉桥（modlens 子进程封装）
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, readFile, rm } from 'node:fs/promises';

export async function analyzeImage({ imagePath, prompt } = {}) {
  if (!imagePath) throw new Error('imagePath required');
  const dir = await mkdtemp(join(tmpdir(), 'vision-'));
  const out = join(dir, 'result.json');
  try {
    const args = ['--yes', '@liustack/modlens', 'read', imagePath, '--output', out];
    if (prompt) { args.push('--prompt', prompt); }
    await new Promise((resolve, reject) => {
      const p = spawn('npx', args, { shell: process.platform === 'win32' });
      let stderr = '';
      p.stderr.on('data', d => { stderr += d.toString(); });
      p.on('close', code => code === 0 ? resolve() : reject(new Error('modlens exit ' + code + ' ' + stderr.slice(0, 400))));
      p.on('error', reject);
    });
    return JSON.parse(await readFile(out, 'utf8'));
  } finally {
    try { await rm(dir, { recursive: true, force: true }); } catch {}
  }
}

export function buildContextMessage({ result, annotations = [] } = {}) {
  if (!result) return '';
  const ocr = (result.ocr?.full_text || '').trim();
  const regions = Array.isArray(result.layout?.regions) ? result.layout.regions : [];
  const unc = Array.isArray(result.uncertainty) ? result.uncertainty : [];
  const sem = result.semantics || {};
  const ann = annotations.map((a, i) => (i + 1) + ') ' + (a.note || a.label || '(无说明)') + ' @' + (a.region || a.coords || '?')).join("\n");
  const lines = ['## 🖼 视觉桥（modlens）消息'];
  if (sem.scene) lines.push('**场景**: ' + sem.scene);
  if (sem.intent) lines.push('**意图**: ' + sem.intent);
  if (ocr) { lines.push(''); lines.push('**完整文字**: ' + ocr); }
  if (regions.length) { lines.push(''); lines.push('**区域(按阅读顺序)**:'); regions.forEach(r => lines.push('- #' + r.reading_order + ' ' + r.type + ': ' + r.text.slice(0, 120))); }
  if (ann) { lines.push(''); lines.push('**用户批注**:'); lines.push(ann); }
  if (unc.length) { lines.push(''); lines.push('**不确定性**: ' + unc.join('; ')); }
  return lines.join(nl);
}
