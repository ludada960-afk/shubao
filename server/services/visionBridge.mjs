// server/services/visionBridge.mjs — 跨模型视觉桥（provider-agnostic + keyring 轮换）
// 任何 VLM（qwen-vl/gpt-4o/claude/gemini/minimax-vl…）都可接入,只改 keyring 配置.
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';

// 解码 keyring 中的 base64 key
function decode(b64) { try { return Buffer.from(b64, 'base64').toString('utf8'); } catch { return ''; } }

// 加载本地 keyring (不入 git)
let _keyring = null;
function loadKeyring() {
  if (_keyring) return _keyring;
  const p = join(process.cwd(), '.env.d', 'vision-keyring.json');
  if (!existsSync(p)) return { vlm_providers: [], rotation: { strategy: 'failover', cooldownSec: 0 } };
  try {
    const raw = JSON.parse(readFileSync(p, 'utf8'));
    raw.vlm_providers = (raw.vlm_providers || []).map((v) => ({ ...v, apiKey: decode(v.apiKey) }));
    _keyring = raw;
  } catch { _keyring = { vlm_providers: [] }; }
  return _keyring;
}

// 轮换索引 (round-robin)
let _rrIndex = 0;
function pickProvider() {
  const ks = loadKeyring().vlm_providers.filter((v) => v.apiKey);
  if (!ks.length) return null;
  const strategy = loadKeyring().rotation?.strategy || 'round-robin';
  if (strategy === 'round-robin') { const p = ks[_rrIndex % ks.length]; _rrIndex++; return p; }
  // 简化: 权重=API key 后两位十六进制
  const sum = ks.reduce((a, p) => a + (p.weight || 50), 0);
  let r = Math.random() * sum; for (const p of ks) { r -= (p.weight || 50); if (r <= 0) return p; }
  return ks[0];
}

// 调 modlens 子进程（用选中 provider 的 baseUrl/model/apiKey）
export async function analyzeImage({ imagePath, prompt, preferredProvider } = {}) {
  if (!imagePath) throw new Error('imagePath required');
  const dir = await mkdtemp(join(tmpdir(), 'vision-'));
  const out = join(dir, 'result.json');
  const provider = preferredProvider ? loadKeyring().vlm_providers.find((p) => p.name === preferredProvider) : pickProvider();
  if (!provider) throw new Error('no VLM provider configured in .env.d/vision-keyring.json');
  const env = { ...process.env, MODLENS_API_KEY: provider.apiKey, MODLENS_BASE_URL: provider.baseUrl, MODLENS_MODEL: provider.model };
  try {
    const args = ['--yes', '@liustack/modlens', 'analyze', '-i', imagePath, '-o', out, '--timeout', '180000'];
    if (prompt) args.push('--prompt', prompt);
    await new Promise((resolve, reject) => {
      const p = spawn('npx', args, { shell: process.platform === 'win32', env });
      let stderr = '';
      p.stderr.on('data', (d) => { stderr += d.toString(); });
      p.on('close', (code) => code === 0 ? resolve() : reject(new Error('modlens ' + provider.name + ' exit ' + code + ' ' + stderr.slice(0, 300))));
      p.on('error', reject);
    });
    return JSON.parse(await readFile(out, 'utf8'));
  } finally { try { await rm(dir, { recursive: true, force: true }); } catch {} }
}

const NL = String.fromCharCode(10);
export function buildContextMessage({ result, annotations = [] } = {}) {
  if (!result) return '';
  const ocr = (result.ocr && result.ocr.full_text || '').trim();
  const regions = Array.isArray(result.layout && result.layout.regions) ? result.layout.regions : [];
  const unc = Array.isArray(result.uncertainty) ? result.uncertainty : [];
  const sem = result.semantics || {};
  const ann = annotations.map((a, i) => (i + 1) + ') ' + (a.note || a.label || '(无说明)') + ' @' + (a.region || a.coords || '?')).join(NL);
  const lines = ['## 🖼 视觉桥（modlens vision）消息'];
  if (sem.scene) lines.push('**场景**: ' + sem.scene);
  if (sem.intent) lines.push('**意图**: ' + sem.intent);
  if (ocr) { lines.push(''); lines.push('**完整文字**: ' + ocr); }
  if (regions.length) { lines.push(''); lines.push('**区域(按阅读顺序)**:'); regions.forEach((r) => lines.push('- #' + r.reading_order + ' ' + r.type + ': ' + r.text.slice(0, 120))); }
  if (ann) { lines.push(''); lines.push('**用户批注**:'); lines.push(ann); }
  if (unc.length) { lines.push(''); lines.push('**不确定性**: ' + unc.join('; ')); }
  return lines.join(NL);
}

// 列出可用 provider
export function listProviders() {
  return loadKeyring().vlm_providers.map((p) => ({ name: p.name, label: p.label, model: p.model, weight: p.weight || 50, hint: p.dailyLimitHint || '' }));
}
