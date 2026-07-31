import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

import { createProviderAdapter } from '../server/ecommerceEngine/providerAdapter.mjs';
import { createVlmClient } from '../server/ecommerceEngine/vlmClient.mjs';

const IMAGE_BASE_URL = 'https://task-api-1-cn.65535.space';
const VISION_BASE_URL = 'https://puppyrouter.com';
const IMAGE_MODEL = 'gpt-image-2';
const VISION_MODEL = 'gpt-5.6-luna';
const MAX_RESULT_BYTES = 25 * 1024 * 1024;

function validSecret(value) {
  return typeof value === 'string'
    && value.trim().length >= 24
    && !/[\r\n\0]/.test(value);
}

export function validateProbeSecrets({ imageApiKey, visionApiKey } = {}) {
  if (!validSecret(imageApiKey)) throw new Error('image gateway credential is invalid');
  if (!validSecret(visionApiKey)) throw new Error('vision gateway credential is invalid');
  return {
    imageApiKey: imageApiKey.trim(),
    visionApiKey: visionApiKey.trim(),
  };
}

async function stage(label, operation) {
  try {
    return await operation();
  } catch {
    throw new Error(`${label} failed`);
  }
}

async function fetchJson(fetchImpl, url, apiKey, timeoutMs = 30_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    if (!response?.ok) throw new Error('request rejected');
    const body = await response.json();
    if (body === null || typeof body !== 'object') throw new Error('invalid JSON response');
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

function listedModelIds(body) {
  const records = Array.isArray(body?.data)
    ? body.data
    : Array.isArray(body?.models)
      ? body.models
      : [];
  return new Set(records.map(record => (
    typeof record === 'string' ? record : record?.id ?? record?.name
  )).filter(value => typeof value === 'string' && value.trim()).map(value => value.trim()));
}

function requireModel(body, model) {
  if (!listedModelIds(body).has(model)) throw new Error('required model is not listed');
}

export async function createProbeImage(sharpImpl = sharp) {
  const width = 512;
  const height = 512;
  const channels = 3;
  const pixels = Buffer.alloc(width * height * channels, 255);
  for (let y = 128; y < 384; y += 1) {
    for (let x = 128; x < 384; x += 1) {
      const offset = (y * width + x) * channels;
      pixels[offset] = 220;
      pixels[offset + 1] = 20;
      pixels[offset + 2] = 60;
    }
  }
  return sharpImpl(pixels, { raw: { width, height, channels } }).png().toBuffer();
}

export async function inspectGeneratedImage(buffer, sharpImpl = sharp) {
  const metadata = await sharpImpl(buffer).metadata();
  const format = typeof metadata?.format === 'string' ? metadata.format.toLowerCase() : '';
  const width = Number(metadata?.width);
  const height = Number(metadata?.height);
  if (!['png', 'jpeg', 'webp'].includes(format)
    || !Number.isSafeInteger(width) || width < 512
    || !Number.isSafeInteger(height) || height < 512) {
    throw new Error('generated image metadata is invalid');
  }
  return { format, width, height };
}

function validateResultUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('generated result URL is invalid'); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
    throw new Error('generated result URL is unsafe');
  }
  return url.href;
}

async function downloadResult(fetchImpl, outputUrl) {
  const response = await fetchImpl(validateResultUrl(outputUrl), {
    method: 'GET',
    redirect: 'error',
  });
  if (!response?.ok) throw new Error('generated result download was rejected');
  const declaredLength = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESULT_BYTES) {
    throw new Error('generated result is too large');
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_RESULT_BYTES) throw new Error('generated result size is invalid');
  return buffer;
}

export async function probeGateways({
  imageApiKey,
  visionApiKey,
  imageBaseUrl = IMAGE_BASE_URL,
  visionBaseUrl = VISION_BASE_URL,
  imageModel = IMAGE_MODEL,
  visionModel = VISION_MODEL,
  fetchImpl = fetch,
  adapterFactory = createProviderAdapter,
  vlmFactory = createVlmClient,
  createProbeImageImpl = createProbeImage,
  inspectImageImpl = inspectGeneratedImage,
  idempotencyKey = `gateway-probe-${randomUUID()}`,
} = {}) {
  const secrets = validateProbeSecrets({ imageApiKey, visionApiKey });
  const normalizedImageBase = String(imageBaseUrl || '').replace(/\/+$/, '');
  const normalizedVisionBase = String(visionBaseUrl || '').replace(/\/+$/, '');

  const imageModels = await stage('image model discovery', () => (
    fetchJson(fetchImpl, `${normalizedImageBase}/v1/models`, secrets.imageApiKey)
  ));
  await stage('image model validation', async () => requireModel(imageModels, imageModel));

  const sourceBuffer = await stage('probe image preparation', () => createProbeImageImpl());
  if (!Buffer.isBuffer(sourceBuffer) || !sourceBuffer.length) {
    throw new Error('probe image preparation failed');
  }
  const sourceDataUri = `data:image/png;base64,${sourceBuffer.toString('base64')}`;

  const visionClient = vlmFactory({
    fetchImpl,
    apiKey: secrets.visionApiKey,
    baseUrl: normalizedVisionBase,
    model: visionModel,
    timeoutMs: 90_000,
  });
  const visionResult = await stage('vision image-input probe', () => visionClient.analyzeJson({
    systemPrompt: 'Return only one JSON object. Do not use Markdown.',
    userPrompt: 'Inspect the image. Return exactly {"probe":"ok","visibleColor":"red"} when a red square is visible.',
    images: [sourceDataUri],
  }));
  if (visionResult?.probe !== 'ok') throw new Error('vision image-input validation failed');

  const adapter = adapterFactory({
    baseUrl: normalizedImageBase,
    bearerToken: secrets.imageApiKey,
    protocol: 'native-tasks',
    submitPath: '/v1/tasks',
    pollPath: '/v1/tasks/{id}',
    pollIntervalMs: 2_000,
    fetchImpl,
  });
  const submitted = await stage('image task submission', () => adapter.submitEdit({
    idempotencyKey,
    prompt: 'Preserve the centered red square exactly. Produce a clean white-background ecommerce-style verification image with no text and no extra objects.',
    modelRoute: { model: imageModel, size: '1024x1024', async: true, mode: 'edit' },
    inputAssets: [{
      buffer: sourceBuffer,
      contentType: 'image/png',
      fileName: 'gateway-probe.png',
    }],
  }));
  const completed = await stage('image task polling', () => (
    adapter.pollUntilReady(submitted.jobId, { maxPolls: 240 })
  ));
  if (completed?.status !== 'completed' || !completed?.outputUrl) {
    throw new Error('image task validation failed');
  }
  const resultBuffer = await stage('image result download', () => (
    downloadResult(fetchImpl, completed.outputUrl)
  ));
  const metadata = await stage('image result inspection', () => inspectImageImpl(resultBuffer));

  return {
    image: {
      model: imageModel,
      status: 'completed',
      ...metadata,
      bytes: resultBuffer.length,
    },
    vision: { model: visionModel, status: 'completed' },
  };
}

async function run() {
  const result = await probeGateways({
    imageApiKey: process.env.SHUBAO_IMAGE_API_KEY,
    visionApiKey: process.env.SHUBAO_VISION_API_KEY,
  });
  console.log(JSON.stringify(result));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  run().catch((error) => {
    console.error(`Gateway probe failed: ${error.message}`);
    process.exitCode = 1;
  });
}
