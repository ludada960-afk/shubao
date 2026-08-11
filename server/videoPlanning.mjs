const MODES = new Set(['smart', 'frame', 'remake']);

function clean(value, max = 1200) {
  return String(value ?? '').trim().slice(0, max);
}

function list(value, max = 12) {
  return Array.isArray(value) ? value.slice(0, max) : [];
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function parseJsonObject(value) {
  const text = clean(value, 30_000).replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw Object.assign(new Error('视频方案分析返回了无效结果'), { code: 'VIDEO_PLAN_INVALID_RESPONSE', status: 502 });
  try {
    const parsed = JSON.parse(match[0]);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    return parsed;
  } catch (cause) {
    throw Object.assign(new Error('视频方案分析返回了无效 JSON', { cause }), { code: 'VIDEO_PLAN_INVALID_RESPONSE', status: 502 });
  }
}

function normalizeBeat(value, index, duration) {
  const beat = object(value);
  return {
    time: clean(beat.time, 24) || `${index === 0 ? 0 : Math.floor(duration * index / 3)}-${Math.ceil(duration * (index + 1) / 3)}s`,
    label: clean(beat.label, 40) || `镜头 ${index + 1}`,
    detail: clean(beat.detail, 240) || '根据素材与提示词推进镜头',
    source: clean(beat.source, 100) || '提示词',
    camera: clean(beat.camera, 120),
    audio: clean(beat.audio, 120),
  };
}

function normalizeAsset(value, index) {
  const asset = object(value);
  return {
    name: clean(asset.name, 100) || `素材 ${index + 1}`,
    role: clean(asset.role, 60) || '视觉参考',
    observations: list(asset.observations, 6).map(item => clean(item, 140)).filter(Boolean),
    retain: list(asset.retain, 5).map(item => clean(item, 120)).filter(Boolean),
    use: clean(asset.use, 200) || '作为镜头视觉参考',
    confidence: ['high', 'medium', 'low'].includes(asset.confidence) ? asset.confidence : 'medium',
  };
}

export function normalizeVideoPlanAnalysis(value, fallback = {}) {
  const parsed = object(value);
  const duration = Math.max(4, Math.min(30, Number(fallback.duration) || 8));
  const beats = list(parsed.beats, 6).map((beat, index) => normalizeBeat(beat, index, duration));
  if (beats.length < 3) {
    throw Object.assign(new Error('视频方案缺少完整镜头节奏'), { code: 'VIDEO_PLAN_INCOMPLETE', status: 502 });
  }
  const optimizedPrompt = clean(parsed.optimizedPrompt, 1200);
  if (!optimizedPrompt) {
    throw Object.assign(new Error('视频方案缺少可执行提示词'), { code: 'VIDEO_PLAN_INCOMPLETE', status: 502 });
  }
  return {
    summary: clean(parsed.summary, 240) || clean(fallback.prompt, 240),
    creativeStrategy: clean(parsed.creativeStrategy, 240),
    assets: list(parsed.assets, 16).map(normalizeAsset),
    beats,
    risks: list(parsed.risks, 8).map(item => clean(item, 180)).filter(Boolean),
    optimizedPrompt,
    analysisBasis: {
      imageFrames: Number(fallback.imageFrames) || 0,
      audioTracks: Number(fallback.audioTracks) || 0,
      videoTracks: Number(fallback.videoTracks) || 0,
      transcriptAvailable: false,
    },
  };
}

export function buildVideoPlanningRequest(input = {}) {
  const mode = MODES.has(input.mode) ? input.mode : 'smart';
  const manifest = list(input.manifest, 16).map((item, index) => ({
    index: index + 1,
    name: clean(item?.name, 100) || `素材 ${index + 1}`,
    kind: ['image', 'video', 'audio', 'video_frame'].includes(item?.kind) ? item.kind : 'unknown',
    role: clean(item?.role, 60),
    duration: Number.isFinite(Number(item?.duration)) ? Number(item.duration) : null,
    width: Number.isFinite(Number(item?.width)) ? Number(item.width) : null,
    height: Number.isFinite(Number(item?.height)) ? Number(item.height) : null,
    frameAt: Number.isFinite(Number(item?.frameAt)) ? Number(item.frameAt) : null,
    audioEnergy: list(item?.audioEnergy, 16).map(Number).filter(Number.isFinite),
    dynamics: clean(item?.dynamics, 40),
  }));
  const systemPrompt = `你是商业短视频导演和多模态素材分析师。你必须只依据用户提示词、素材清单和实际提供的关键帧做判断，不得虚构未看见的商品、人物、品牌、台词或音频语义。\n
目标是生成一份可以直接交给视频模型执行的方案。区分三类任务：smart=智能成片；frame=首尾帧过渡，必须严格守住起止构图；remake=爆款重构，只借鉴参考视频节奏和镜头结构，不复制人物、品牌或受版权保护内容。\n
音频只提供时长和能量曲线，没有语音转写；你只能判断节奏和动态，不能猜测歌词或台词。\n
返回严格 JSON：{"summary":"","creativeStrategy":"","assets":[{"name":"","role":"","observations":[""],"retain":[""],"use":"","confidence":"high|medium|low"}],"beats":[{"time":"0-3s","label":"","detail":"","source":"","camera":"","audio":""}],"risks":[""],"optimizedPrompt":""}。beats 至少 3 段，时间覆盖完整成片；optimizedPrompt 必须具体包含主体、动作、镜头、场景、节奏、素材引用和禁止项。`;
  const userPrompt = [
    `创作模式：${mode}`,
    `用户要求：${clean(input.prompt, 1200)}`,
    clean(input.negativePrompt, 1200) ? `明确禁止：${clean(input.negativePrompt, 1200)}` : '',
    `输出：${clean(input.ratio, 20)}，${Number(input.duration) || 8} 秒，${clean(input.resolution, 20)}，${input.sound === false ? '无生成声音' : '生成声音'}`,
    `素材清单：${JSON.stringify(manifest)}`,
    mode === 'remake' ? '重构要求：明确哪些节奏结构保留、哪些主体内容替换。' : '',
    mode === 'frame' ? '首尾帧要求：首段和末段必须分别对应首帧和尾帧，中间补齐连续运动。' : '',
  ].filter(Boolean).join('\n');
  return { systemPrompt, userPrompt, manifest, mode };
}

export function createVideoPlanningService({ completeText } = {}) {
  if (typeof completeText !== 'function') throw new TypeError('completeText is required');
  return {
    async analyze(input = {}) {
      const request = buildVideoPlanningRequest(input);
      const content = await completeText({
        systemPrompt: request.systemPrompt,
        userPrompt: request.userPrompt,
        images: list(input.images, 9),
        maxTokens: 2600,
        temperature: 0.15,
      });
      const counts = request.manifest.reduce((result, item) => {
        if (item.kind === 'video' || item.kind === 'video_frame') result.videoTracks += item.kind === 'video' ? 1 : 0;
        if (item.kind === 'audio') result.audioTracks += 1;
        if (item.kind === 'image' || item.kind === 'video_frame') result.imageFrames += 1;
        return result;
      }, { imageFrames: 0, videoTracks: 0, audioTracks: 0 });
      return normalizeVideoPlanAnalysis(parseJsonObject(content), { ...input, ...counts });
    },
  };
}
