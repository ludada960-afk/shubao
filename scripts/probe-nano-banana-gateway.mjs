import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

import { createNanoBananaProviderAdapter } from '../server/ecommerceEngine/nanoBananaProviderAdapter.mjs';

const BASE_URL = 'https://api.change2pro.com';
const FLASH_MODEL = 'gemini-3.1-flash-image';
const PRO_MODEL = 'gemini-3-pro-image';

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
  const response = await fetchImpl(`${String(baseUrl).replace(/\/+$/, '')}/v1/models`, {
    headers: { Authorization: `Bearer ${apiKey}`, 'x-goog-api-key': apiKey },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error('Nano Banana model discovery failed');
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
