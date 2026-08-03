export const SEGMENTATION_INPUT_SIZE = 320;
export const SEGMENTATION_MODEL_URL = '/models/u2netp-v1.onnx';
export const SEGMENTATION_MODEL_SHA256 = '309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8';

const CHANNEL_MEANS = [0.485, 0.456, 0.406];
const CHANNEL_DEVIATIONS = [0.229, 0.224, 0.225];

export function preprocessSegmentationImage(imageData) {
  const width = Number(imageData?.width);
  const height = Number(imageData?.height);
  const pixels = imageData?.data;
  if (!Number.isSafeInteger(width) || width <= 0 || !Number.isSafeInteger(height) || height <= 0
    || !pixels || pixels.length !== width * height * 4) {
    throw new TypeError('valid RGBA image data is required');
  }
  const pixelCount = width * height;
  const tensor = new Float32Array(pixelCount * 3);
  let maximum = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    maximum = Math.max(maximum, pixels[index], pixels[index + 1], pixels[index + 2]);
  }
  const denominator = maximum || 255;
  for (let index = 0; index < pixelCount; index += 1) {
    const sourceOffset = index * 4;
    for (let channel = 0; channel < 3; channel += 1) {
      tensor[channel * pixelCount + index] = (
        (pixels[sourceOffset + channel] / denominator) - CHANNEL_MEANS[channel]
      ) / CHANNEL_DEVIATIONS[channel];
    }
  }
  return tensor;
}

export function normalizeSegmentationOutput(values) {
  if (!values?.length) throw new TypeError('model output is required');
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
  }
  const output = new Uint8ClampedArray(values.length);
  const range = maximum - minimum;
  if (!Number.isFinite(range) || range <= Number.EPSILON) return output;
  for (let index = 0; index < values.length; index += 1) {
    output[index] = Math.round(((values[index] - minimum) / range) * 255);
  }
  return output;
}

function stageProgress(event) {
  const stage = String(event?.stage || 'preparing');
  if (stage === 'model-download') {
    const loaded = Math.max(0, Number(event.loaded) || 0);
    const total = Math.max(0, Number(event.total) || 0);
    const ratio = total > 0 ? Math.min(1, loaded / total) : 0;
    return { stage, percent: 3 + Math.round(ratio * 20), label: '准备智能抠图组件', coldStart: true };
  }
  if (stage === 'model-initialize') return { stage, percent: 25, label: '初始化智能抠图组件', coldStart: true };
  if (stage === 'ready') return { stage, percent: 28, label: '智能抠图组件已就绪', coldStart: false };
  if (stage === 'detecting') return { stage, percent: 35, label: '识别商品', coldStart: false };
  if (stage === 'segmenting') {
    const total = Math.max(1, Math.trunc(Number(event.total) || 1));
    const completed = Math.max(0, Math.min(total, Math.trunc(Number(event.completed) || 0)));
    return {
      stage,
      percent: 45 + Math.round((completed / total) * 35),
      label: `提取商品 ${Math.min(total, completed + 1)}/${total}`,
      detail: completed >= total ? '商品提取完成' : '',
      coldStart: false,
    };
  }
  if (stage === 'materializing') return { stage, percent: 86, label: '生成透明图层', coldStart: false };
  if (stage === 'complete') return { stage, percent: 100, label: '处理完成', coldStart: false };
  return { stage: 'preparing', percent: 1, label: '准备处理', coldStart: false };
}

export function reduceSegmentationProgress(current, event) {
  const stage = stageProgress(event);
  const next = { ...stage, ...event, percent: stage.percent, label: stage.label, coldStart: stage.coldStart };
  if (current && Number(current.percent) > next.percent) return current;
  return next;
}
