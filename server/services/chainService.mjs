// server/services/chainService.mjs
// 4c183cd4 续命 P-G 画布 1-click chain — TapNow 旗舰模式
// 1 张参考图 + 1 句 prompt -> 自动输出多 Scene 视频
// 4 步状态机: 文案 -> 首帧 -> 视频 -> 音轨 + 字幕
// 集成 costBasis (1d6d17fa P2 成本核算) 4 步累计 cost/margin
// 集成 ttsBridge (9c5d01d5 P1 TTS 5 provider 桥) 真调语音合成
//
// 商业化价值: 极高 — 4c183cd4 时代 P0 视频板块核心, 跟 TapNow / Liblib 差异点.
// 调研来源: a8be4109 + 1b06168e, .superpowers/sdd/2026-08-28-v2-canvas-plan.md §4 P-G.
//
// 设计原则 (跟 vision/tts bridge 一脉相承):
//   - 不依赖任何外部 SDK / DB; 仅纯函数 + mock provider
//   - 真实接入时由业务方替换 adapter (像 ttsBridge 的 5 provider 模式)
//   - 账务由上层 walletService 接管, 本服务只算 cost & 出 chainState
//   - costBasis.computeCostSnapshot 给出 actualCostCny + theoreticalPriceCny + margin + health
//   - 失败不破坏链: 抛 codedError, 上层 catch 后给用户 deliberate retry 入口

import { computeCostSnapshot } from '../billing/costBasis.mjs';
import { synthesizeTTS, computeTTSCost, computeTTSCostSnapshot } from './ttsBridge.mjs';

// ── 4 步定义 (TapNow Agent 镜像) ──
export const CHAIN_STEPS = Object.freeze([
  { key: 'script',  label: '文案',     description: '从一句 prompt 派生 30-60s 视频脚本 (含 3-5 段分镜描述)' },
  { key: 'keyframe', label: '首帧',    description: '为每段分镜生成首帧参考图 (首段 + 末段)' },
  { key: 'video',    label: '视频',    description: '按分镜调用 videoProviders 出片 (首帧驱动)' },
  { key: 'audio',    label: '音轨+字幕', description: 'TTS 合成口播音频 + 字幕分段 (5 provider 桥)' },
]);

// 字幕风格 (v1 5 档, 跟 W4 音轨 UI 的 ttsBridge 风格兼容)
export const CHAIN_SUBTITLE_STYLES = Object.freeze([
  { key: 'simple',     label: '极简白字' },
  { key: 'highlight',  label: '关键词高亮' },
  { key: 'kinetic',    label: '动态字弹' },
  { key: 'cinema',     label: '电影底栏' },
  { key: 'reel',       label: '短视频竖屏' },
]);

// ── 工具函数 ──
function cleanString(value, max = 2000) {
  return String(value ?? '').trim().slice(0, max);
}

function codedError(code, message, status = 422, details = {}) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  Object.assign(err, details);
  return err;
}

function hashString(input) {
  // 轻量确定性 ID, 不引 crypto, 避免 startup 抖动
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = ((h << 5) - h) + input.charCodeAt(i);
    h |= 0;
  }
  return 'chain_' + Math.abs(h).toString(36);
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

// ── Step 1: 文案 (script) ──
// 输入: prompt + referenceImage + sceneCount
// 输出: 3-5 段分镜描述 + 每段时长 + 关键词
// mock 模式: 用 prompt hash 做确定性派生, 真接入时由 LLM adapter 替换.
export function deriveScript({ prompt = '', referenceImage = null, sceneCount = 3 } = {}) {
  const cleanPrompt = cleanString(prompt, 500);
  if (!cleanPrompt) throw codedError('CHAIN_PROMPT_REQUIRED', '请输入一句视频描述 (prompt 必填)', 400);
  const scenes = clampNumber(sceneCount, 1, 6, 3);
  const refTag = referenceImage ? '参考图驱动' : '纯 prompt 驱动';
  const promptWords = cleanPrompt.split(/[\s,，。.、]+/).filter(Boolean);
  const result = [];
  for (let i = 0; i < scenes; i += 1) {
    const theme = promptWords[i % promptWords.length] || `镜头${i + 1}`;
    result.push({
      index: i,
      theme: cleanString(theme, 60),
      durationSec: 6 + (i % 3) * 2, // 6 / 8 / 10s 错落, 跟 TapNow Enclosure/Breakthrough/Framing 对齐
      shot: i === 0 ? 'Enclosure' : (i === scenes - 1 ? 'Framing' : 'Breakthrough'),
      description: cleanString(`${cleanPrompt} / ${refTag} / 分镜 ${i + 1} (${theme})`, 280),
    });
  }
  return { scenes, script: result, totalDurationSec: result.reduce((a, b) => a + b.durationSec, 0) };
}

// ── Step 2: 首帧 (keyframe) ──
// 输入: step1.script + referenceImage
// 输出: 每段分镜的首帧 URL (mock 占位, 真接入时由 GPT-Image-2 / Nano Banana 替换)
export function deriveKeyframes({ script, referenceImage = null } = {}) {
  // 接受 deriveScript 返回值 { scenes, script: scenesArr, totalDurationSec }
  // 或直接的 scenes 数组 (兼容调用方)
  const scenesArr = Array.isArray(script) ? script : (Array.isArray(script?.script) ? script.script : null);
  if (!scenesArr || scenesArr.length === 0) {
    throw codedError('CHAIN_SCRIPT_REQUIRED', 'Step1 文案未产出, 请先执行 script 步骤', 500);
  }
  return scenesArr.map((scene, i) => {
    const seed = hashString(`${scene.description}:${referenceImage || 'no-ref'}:${i}`);
    return {
      sceneIndex: scene.index,
      shot: scene.shot,
      keyframeUrl: `/mock/chain-keyframe-${seed}.png`,
      keyframeRef: referenceImage || null,
      width: 1280,
      height: 720,
    };
  });
}

// ── Step 3: 视频 (video) ──
// 输入: step2.keyframes + 时长
// 输出: 每段分镜的视频任务 id (调 videoProviders 真出片, mock 也跑通)
// 真实 adapter: videoProviders.createVideoProviderRegistry().get(productId).submit/get
// 这里走 injected providerRegistry, 方便单测 mock; 默认 null 时用 mock id
export async function deriveVideos({
  keyframes = [],
  prompt = '',
  providerRegistry = null,
  productId = null,
  durationSec = 6,
  aspectRatio = '16:9',
  generateAudio = false,
} = {}) {
  if (!Array.isArray(keyframes) || keyframes.length === 0) {
    throw codedError('CHAIN_KEYFRAMES_REQUIRED', 'Step2 首帧未产出, 请先执行 keyframe 步骤', 500);
  }
  const product = productId || 'seedance-fast';
  const jobs = [];
  for (const kf of keyframes) {
    const taskId = hashString(`video:${kf.sceneIndex}:${prompt}:${product}`);
    let providerTask = null;
    if (providerRegistry && typeof providerRegistry.get === 'function') {
      const adapter = providerRegistry.get(product);
      if (adapter && typeof adapter.submit === 'function') {
        try {
          providerTask = await adapter.submit({
            prompt,
            first_frame_url: kf.keyframeUrl,
            duration: durationSec,
            aspect_ratio: aspectRatio,
            generate_audio: generateAudio,
          }, taskId);
        } catch (e) {
          // 视频 provider 失败不破坏整条链, 记 providerStatus=failed 供上层 decide
          jobs.push({
            sceneIndex: kf.sceneIndex,
            shot: kf.shot,
            taskId,
            productId: product,
            status: 'failed',
            progress: 0,
            downloadUrl: null,
            providerStatus: e?.providerStatus || 500,
            error: e?.message || String(e),
          });
          continue;
        }
      }
    }
    jobs.push({
      sceneIndex: kf.sceneIndex,
      shot: kf.shot,
      taskId: providerTask?.id || taskId,
      productId: product,
      status: 'processing',
      progress: providerTask?.progress ?? 0,
      downloadUrl: null,
      keyframeUrl: kf.keyframeUrl,
    });
  }
  return { videos: jobs, productId: product };
}

// ── Step 4: 音轨 + 字幕 (audio) ──
// 输入: step1.script + 4 参数 (text/referenceImage/audioSourceId/subtitleStyle) 里的 text
// 输出: TTS 合成结果 (provider/audioUrl/durationMs) + 字幕分段 (按 scene 切分)
export async function deriveAudio({
  script,
  text = null,
  voiceId = 'default',
  provider = null,
  lang = 'zh-CN',
  speed = 1.0,
  subtitleStyle = 'simple',
} = {}) {
  // 跟 deriveKeyframes 一致: 接受 deriveScript 返回值或直接的 scenes 数组
  const scenesArr = Array.isArray(script) ? script : (Array.isArray(script?.script) ? script.script : null);
  if (!scenesArr || scenesArr.length === 0) {
    throw codedError('CHAIN_SCRIPT_REQUIRED', 'Step1 文案未产出, 无法生成音轨', 500);
  }
  // 字幕样式合法化
  const validStyles = CHAIN_SUBTITLE_STYLES.map(s => s.key);
  if (!validStyles.includes(subtitleStyle)) {
    throw codedError('CHAIN_SUBTITLE_STYLE_INVALID', `字幕样式必须是 ${validStyles.join('/')} 之一`, 400);
  }
  // 优先用 text 参数, 否则用 script 拼接
  const narrationText = cleanString(text || scenesArr.map(s => s.description).join(' '), 4000);
  if (!narrationText) throw codedError('CHAIN_TEXT_REQUIRED', '音轨口播文本不能为空', 400);
  // 真调 ttsBridge (mock audio, 但 cost + provider 真实切换)
  const tts = await synthesizeTTS({
    text: narrationText,
    voiceId,
    provider,
    lang,
    speed,
    sku: 'chain_audio',
    itemUnits: 1, // 给 costSnapshot itemUnits=1, 避免 theoretical=0 致 health=breach
    withCostSnapshot: true,
  });
  // 字幕分段: 按 scene 等分 narrationText, 每段对应一个分镜
  const totalLen = narrationText.length;
  const perScene = Math.max(1, Math.floor(totalLen / scenesArr.length));
  const subtitles = scenesArr.map((scene, i) => {
    const start = i * perScene;
    const end = i === scenesArr.length - 1 ? totalLen : (i + 1) * perScene;
    return {
      sceneIndex: scene.index,
      start: start,
      end: end,
      text: cleanString(narrationText.slice(start, end), 200),
      style: subtitleStyle,
    };
  });
  return {
    tts,
    subtitles,
    subtitleStyle,
    textChars: narrationText.length,
  };
}

/* ── P0-4 独立字幕生成 (9-06): 视频节点派生字幕 → 自动生成字幕配置 ──
   从 deriveAudio 抽出来的纯字幕逻辑: 按 sceneCount 等分文本, 每段对应一个分镜。
   独立于 TTS, 可直接从画布 video 节点派生 "字幕动效" 动作调用。 */
export function generateCaption({ text, sceneCount = 3, style = 'simple', totalDurationMs = 8000 } = {}) {
  const narrationText = cleanString(text || '', 4000);
  if (!narrationText) throw codedError('CAPTION_TEXT_REQUIRED', '字幕文本不能为空', 400);
  const validStyles = CHAIN_SUBTITLE_STYLES.map(s => s.key);
  if (!validStyles.includes(style)) throw codedError('CAPTION_STYLE_INVALID', `字幕样式必须是 ${validStyles.join('/')} 之一`, 400);
  const scenes = Math.max(1, Math.min(12, Math.floor(sceneCount) || 1));
  const totalLen = narrationText.length;
  const perScene = Math.max(1, Math.floor(totalLen / scenes));
  const perSceneMs = Math.floor(totalDurationMs / scenes);
  const subtitles = [];
  for (let i = 0; i < scenes; i += 1) {
    const start = i * perScene;
    const end = i === scenes - 1 ? totalLen : (i + 1) * perScene;
    subtitles.push({
      sceneIndex: i,
      startChar: start,
      endChar: end,
      startTimeMs: i * perSceneMs,
      endTimeMs: i === scenes - 1 ? totalDurationMs : (i + 1) * perSceneMs,
      text: cleanString(narrationText.slice(start, end), 200),
      style,
    });
  }
  return { subtitles, subtitleStyle: style, textChars: totalLen, sceneCount: scenes, totalDurationMs };
}

// ── 4 步累计 cost (costBasis 集成) ──
// 每步一个 costSnapshot, 总和得出 chainCost; 4 步全 failed 时 health=breach.
export function aggregateCost(steps = []) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return { totalActualCostCny: 0, totalTheoreticalPriceCny: 0, totalGrossProfitCny: 0, margin: 0, health: 'breach', stepCount: 0 };
  }
  let actual = 0;
  let theoretical = 0;
  let profit = 0;
  let failedSteps = 0;
  for (const step of steps) {
    if (!step || !step.costSnapshot) {
      failedSteps += 1;
      continue;
    }
    actual += Number(step.costSnapshot.actualCostCny) || 0;
    theoretical += Number(step.costSnapshot.theoreticalPriceCny) || 0;
    profit += Number(step.costSnapshot.grossProfitCny) || 0;
    if (step.costSnapshot.health === 'breach') failedSteps += 1;
  }
  const margin = theoretical > 0 ? profit / theoretical : 0;
  const health = failedSteps === steps.length ? 'breach' : (failedSteps > 0 ? 'risk' : 'ok');
  return {
    totalActualCostCny: Number(actual.toFixed(6)),
    totalTheoreticalPriceCny: Number(theoretical.toFixed(6)),
    totalGrossProfitCny: Number(profit.toFixed(6)),
    margin: Number(margin.toFixed(4)),
    health,
    stepCount: steps.length,
    failedStepCount: failedSteps,
  };
}

// ── 单步 cost snapshot 包装 (对外复用) ──
export function buildStepCostSnapshot({ sku = 'chain_step', model = 'chain', itemUnits = 1, providerCostCnyOverride = 0 } = {}) {
  return computeCostSnapshot({
    sku,
    currency: 'ec_points',
    itemUnits,
    cost: { model, providerCostCnyOverride },
  });
}

// ── 主入口: 4 步状态机 ──
// 入参 4 个: text, referenceImage, audioSourceId, subtitleStyle
// 沿用规划: 1 张参考图 + 1 句 prompt -> 4 步 -> 多 Scene 视频
export async function executeChain({
  text = '',
  referenceImage = null,
  audioSourceId = null,
  subtitleStyle = 'simple',
  sceneCount = 3,
  productId = null,
  providerRegistry = null,
  voiceId = 'default',
  ttsProvider = null,
  lang = 'zh-CN',
  speed = 1.0,
  aspectRatio = '16:9',
  durationSec = 6,
  generateAudio = false,
} = {}) {
  const startedAt = new Date().toISOString();
  const stepResults = [];
  let failedStep = null;

  // ── Step 1: 文案 ──
  try {
    const script = deriveScript({ prompt: text, referenceImage, sceneCount });
    // 文案 step 算 token 成本 (mock 1 prompt ≈ 256 token)
    const scriptCost = buildStepCostSnapshot({
      sku: 'chain_script',
      model: 'chain-script-llm',
      itemUnits: 1,
      providerCostCnyOverride: 0.002, // mock 0.002 元/次
    });
    stepResults.push({ step: 'script', ok: true, data: script, costSnapshot: scriptCost });
  } catch (e) {
    failedStep = 'script';
    stepResults.push({ step: 'script', ok: false, error: e?.message || String(e), code: e?.code || 'CHAIN_SCRIPT_FAILED' });
    // 后续 3 步都依赖 script, 直接终止
    return buildChainResponse({ startedAt, stepResults, failedStep, subtitleStyle });
  }

  // ── Step 2: 首帧 ──
  let keyframes = [];
  try {
    const scriptData = stepResults[0].data;
    keyframes = deriveKeyframes({ script: scriptData, referenceImage });
    const keyframeCost = buildStepCostSnapshot({
      sku: 'chain_keyframe',
      model: 'gpt-image-2',
      itemUnits: keyframes.length,
      providerCostCnyOverride: 0.04 * keyframes.length, // mock 0.04 元/张
    });
    stepResults.push({ step: 'keyframe', ok: true, data: { keyframes }, costSnapshot: keyframeCost });
  } catch (e) {
    failedStep = 'keyframe';
    stepResults.push({ step: 'keyframe', ok: false, error: e?.message || String(e), code: e?.code || 'CHAIN_KEYFRAME_FAILED' });
    return buildChainResponse({ startedAt, stepResults, failedStep, subtitleStyle });
  }

  // ── Step 3: 视频 ──
  try {
    const videoResult = await deriveVideos({
      keyframes,
      prompt: text,
      providerRegistry,
      productId,
      durationSec,
      aspectRatio,
      generateAudio,
    });
    // 视频 step 按 GPU 时长算 cost (mock 1 scene = 8s, 0.005 元/s)
    const videoCost = buildStepCostSnapshot({
      sku: 'chain_video',
      model: productId || 'seedance-fast',
      itemUnits: videoResult.videos.length,
      providerCostCnyOverride: 0.04 * videoResult.videos.length, // mock 0.04 元/段 (含 GPU + 平台分成)
    });
    stepResults.push({ step: 'video', ok: true, data: videoResult, costSnapshot: videoCost });
  } catch (e) {
    failedStep = 'video';
    stepResults.push({ step: 'video', ok: false, error: e?.message || String(e), code: e?.code || 'CHAIN_VIDEO_FAILED' });
    return buildChainResponse({ startedAt, stepResults, failedStep, subtitleStyle });
  }

  // ── Step 4: 音轨 + 字幕 ──
  try {
    const audioResult = await deriveAudio({
      script: stepResults[0].data,
      text,
      voiceId,
      provider: ttsProvider,
      lang,
      speed,
      subtitleStyle,
    });
    // audio step 用 ttsBridge 自带 costSnapshot (含 margin/health)
    stepResults.push({ step: 'audio', ok: true, data: audioResult, costSnapshot: audioResult.tts.costSnapshot });
  } catch (e) {
    failedStep = 'audio';
    stepResults.push({ step: 'audio', ok: false, error: e?.message || String(e), code: e?.code || 'CHAIN_AUDIO_FAILED' });
    return buildChainResponse({ startedAt, stepResults, failedStep, subtitleStyle });
  }

  return buildChainResponse({ startedAt, stepResults, failedStep, subtitleStyle });
}

function buildChainResponse({ startedAt, stepResults, failedStep, subtitleStyle }) {
  const finishedAt = new Date().toISOString();
  const cost = aggregateCost(stepResults);
  return {
    ok: !failedStep,
    chainId: hashString(`${startedAt}:${stepResults.length}:${failedStep || 'all-ok'}`),
    steps: stepResults,
    cost,
    startedAt,
    finishedAt,
    failedStep,
    subtitleStyle,
    stepCount: stepResults.length,
  };
}

// ── HTTP 路由挂载 (跟 ttsBridge mount 模式对齐) ──
// authenticate: 复用项目 authenticateContentRequest
// 入参 4 个: text, referenceImage, audioSourceId, subtitleStyle (跟规划一致)
export function mountChainRoutes(app, { authenticate }) {
  if (!app) throw new Error('app required');
  if (typeof authenticate !== 'function') throw new Error('authenticate is required');

  const auth = (handler) => async (req, res) => {
    try {
      const email = authenticate(req);
      if (!email) {
        return res.status(401).json({ code: 'CHAIN_UNAUTHORIZED', error: '未登录' });
      }
      return handler(req, res, email);
    } catch (e) {
      const message = e && e.message ? e.message : String(e);
      if (e && (e.code === 'AUTH_SESSION_REQUIRED' || e.code === 'AUTH_INVALID' || e.status === 401)) {
        return res.status(401).json({ code: 'CHAIN_UNAUTHORIZED', error: message });
      }
      if (e && e.status) {
        return res.status(e.status).json({ code: e.code || 'CHAIN_FAILED', error: message });
      }
      return res.status(500).json({ code: 'CHAIN_AUTH_ERROR', error: message });
    }
  };

  app.get('/api/chain/capabilities', (_req, res) => {
    res.json({
      steps: CHAIN_STEPS,
      subtitleStyles: CHAIN_SUBTITLE_STYLES,
      ttsProviders: ['volcengine', 'elevenlabs', 'aliyun', 'azure', 'minimax'],
      note: 'P-G 画布 1-click chain MVP; 真实 provider 接入由业务方替换 adapter (跟 ttsBridge 5 provider 同模式).',
    });
  });

  app.post('/api/chain/execute', auth(async (req, res, email) => {
    const { text, referenceImage, audioSourceId, subtitleStyle } = req.body || {};
    try {
      const result = await executeChain({
        text: text || '',
        referenceImage: referenceImage || null,
        audioSourceId: audioSourceId || null,
        subtitleStyle: subtitleStyle || 'simple',
        // 默认参数走 mock 链路; 真实 product/voice 由前端的 chain/capabilities 选取
      });
      // cost 已在 result.cost 暴露, 上层付费链路 (ec-cron / paid-task) 拿到 result 后用
      // walletService.createHold + settleItem 落账, 本路由只算 cost 不写账 (避免重复扣费).
      return res.json({ ok: result.ok, chain: result, actor: email });
    } catch (e) {
      const message = e && e.message ? e.message : String(e);
      return res.status(e?.status || 500).json({ code: e?.code || 'CHAIN_EXECUTE_FAILED', error: message });
    }
  }));

  /* P0-4 独立字幕生成 (9-06): 视频节点派生 "字幕动效" 动作 → 自动生成字幕分段配置。
     文本优先来自上游 ready 文案, 回退到视频 prompt; sceneCount 决定分几段。 */
  app.post('/api/canvas/caption', auth(async (req, res, email) => {
    const { text, scene_count: sceneCount, style, duration_ms: durationMs } = req.body || {};
    try {
      const result = generateCaption({
        text: text || '',
        sceneCount: Number(sceneCount) || 3,
        style: style || 'simple',
        totalDurationMs: Number(durationMs) || 8000,
      });
      return res.json({ ok: true, caption: result, actor: email });
    } catch (e) {
      const message = e && e.message ? e.message : String(e);
      return res.status(e?.status || 400).json({ code: e?.code || 'CAPTION_FAILED', error: message });
    }
  }));
}
