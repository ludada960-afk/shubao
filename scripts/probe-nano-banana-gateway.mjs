import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';
import sharp from 'sharp';

import { createNanoBananaProviderAdapter, NANO_UPSTREAM_MODELS } from '../server/ecommerceEngine/nanoBananaProviderAdapter.mjs';

const BASE_URL = 'https://api.forkc2p.com';
/* 上游模型名只从声明处取，不在本文件再写一份字面量。
   2026-10-03：本文件原写死 'gemini-2.5-flash-image'，而供应商早已把它换成
   'gemini-3.1-flash-image' —— 于是 discoverModels 永远报「模型不可用」，
   探针变成一个必然失败的工具。正确做法就是引用 NANO_UPSTREAM_MODELS，
   与 test/nano-model-single-source.test.mjs 的契约一致。 */
const FLASH_MODEL = NANO_UPSTREAM_MODELS.flash;
const PRO_MODEL = NANO_UPSTREAM_MODELS.pro;

function validatedSecret(value) {
  const candidate = String(value || '').trim();
  if (candidate.length < 40 || /[\r\n\0]/.test(candidate)) {
    throw new Error('Nano Banana gateway credential is invalid');
  }
  return candidate;
}

function listedModelIds(payload) {
  const entries = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.models) ? payload.models : [];
  return new Set(entries.map(entry => String(entry?.id || entry?.name || entry || '').replace(/^models\//, '')).filter(Boolean));
}

async function discoverModels({ apiKey, baseUrl = BASE_URL, fetchImpl = fetch }) {
  const url = `${String(baseUrl).replace(/\/+$/, '')}/v1/models`;
  let payload = {};
  let ok = false;
  try {
    const response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${apiKey}`, 'x-goog-api-key': apiKey },
    });
    payload = await response.json().catch(() => ({}));
    ok = response.ok;
  } catch (error) {
    // Node fetch 受沙箱/环境限制时，回退到系统 curl（PowerShell 环境可访问外网）
    try {
      const out = execSync(`curl -s -H "Authorization: Bearer ${apiKey}" -H "x-goog-api-key: ${apiKey}" "${url}"`, { encoding: 'utf8', timeout: 15000 });
      payload = JSON.parse(out);
      ok = !payload?.error;
    } catch (curlError) {
      throw new Error(`Nano Banana model discovery failed: ${error?.message || curlError?.message}`);
    }
  }
  if (!ok) throw new Error('Nano Banana model discovery failed');
  const models = listedModelIds(payload);
  for (const model of [FLASH_MODEL, PRO_MODEL]) {
    if (!models.has(model)) throw new Error(`Required Nano Banana model is unavailable: ${model}`);
  }
  return models;
}

export async function probeNanoBananaGateway({
  apiKey,
  baseUrl = BASE_URL,
  fetchImpl = fetch,
  generate = false,
} = {}) {
  const secret = validatedSecret(apiKey);
  await discoverModels({ apiKey: secret, baseUrl, fetchImpl });
  if (!generate) return { status: 'available', models: [FLASH_MODEL, PRO_MODEL] };

  const stored = new Map();
  const generatedAssetStore = {
    async persistBuffer({ buffer, contentType }) {
      const id = `nano-probe-${randomUUID()}`;
      stored.set(id, { buffer, contentType });
      return { id };
    },
    async read(id) {
      return stored.get(id) || null;
    },
  };
  const adapter = createNanoBananaProviderAdapter({
    apiKey: secret,
    baseUrl,
    generatedAssetStore,
    publicBaseUrl: 'http://127.0.0.1',
    fetchImpl,
  });
  const submitted = await adapter.submitEdit({
    idempotencyKey: `nano-probe-${randomUUID()}`,
    prompt: 'Generate a clean 1:1 ecommerce verification image of one red cube centered on a pure white background. No text, no shadow, no extra objects.',
    modelRoute: {
      imageModel: 'nano-banana-2',
      model: FLASH_MODEL,
      provider: 'nano-banana',
      resolution: '1K',
      ratio: '1:1',
    },
    inputAssets: [],
  });
  const asset = stored.get(submitted.jobId);
  if (!asset?.buffer?.length) throw new Error('Nano Banana generation returned no persisted image');
  const metadata = await sharp(asset.buffer).metadata();
  if (!['png', 'jpeg', 'webp'].includes(String(metadata.format || '').toLowerCase())
    || Number(metadata.width) < 512 || Number(metadata.height) < 512) {
    throw new Error('Nano Banana generated image is invalid');
  }
  return {
    status: 'completed',
    model: FLASH_MODEL,
    format: metadata.format,
    width: metadata.width,
    height: metadata.height,
  };
}

async function run(argv = process.argv.slice(2)) {
  if (argv.length > 1 || (argv.length === 1 && !['--validate-only', '--generate'].includes(argv[0]))) {
    throw new Error('usage: node probe-nano-banana-gateway.mjs [--validate-only|--generate]');
  }
  const apiKey = validatedSecret(process.env.SHUBAO_NANO_BANANA_API_KEY);
  if (argv[0] === '--validate-only') {
    console.log('Nano Banana credential format passed');
    return;
  }
  const result = await probeNanoBananaGateway({ apiKey, generate: argv[0] === '--generate' });
  console.log(JSON.stringify(result));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  run().catch((error) => {
    console.error(`Nano Banana gateway probe failed: ${error.message}`);
    process.exitCode = 1;
  });
}
