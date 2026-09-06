/* P0-1 派生即执行 (master-plan §4, 9-06): "生成文案"动作的纯函数层。
   点完派生菜单即自动带源素材发起文案请求, 不再让用户手动填 prompt。
   P0-2: "生成视频"composer 的 prompt 自动引用上游文案节点 (若链条里有)。
   只放纯函数, 副作用 (fetch/setState) 留在 index.jsx, 保证可被 node:test 覆盖。 */

/* 默认卖点文案指令: 无用户输入时也足够产出可用的电商文案。 */
export const CANVAS_COPYWRITING_PROMPT = '请根据参考商品图提炼电商卖点文案：突出商品核心卖点、使用场景与目标人群，写成一段可直接放进详情页头部的种草文案，120 字以内，不要使用分点符号。';

/* 沿派生连线向上 (to -> from) 找最近的可用文案节点。
   只认 kind==='text' 且 status==='ready' 且 text 非空:
   running/error 的文案节点是 P0-1 自动执行的中间态, 不能当上游输入 (防时序污染)。 */
export function findUpstreamCanvasCopy({ nodes = [], connections = [], nodeId, maxDepth = 8 } = {}) {
  const nodeById = new Map(nodes.filter(node => node?.id).map(node => [String(node.id), node]));
  const seen = new Set([String(nodeId || '')]);
  let frontier = [String(nodeId || '')];
  for (let depth = 0; depth < maxDepth && frontier.length; depth += 1) {
    const next = [];
    for (const current of frontier) {
      for (const connection of connections) {
        const fromId = String(connection?.fromNodeId || connection?.from || '');
        const toId = String(connection?.toNodeId || connection?.to || '');
        if (toId !== current || !fromId || seen.has(fromId)) continue;
        seen.add(fromId);
        const node = nodeById.get(fromId);
        if (node?.kind === 'text' && node?.status === 'ready' && String(node.text || '').trim()) {
          return { nodeId: fromId, text: String(node.text).trim() };
        }
        next.push(fromId);
      }
    }
    frontier = next;
  }
  return null;
}

/* 组装 /api/canvas/regenerate-text 请求参数。
   图/视频源: url 进 referenceImages; 文本源: 内容拼进 prompt; direction 策划有则拼入。 */
export function buildCanvasCopywritingRequest({ source } = {}) {
  const promptParts = [CANVAS_COPYWRITING_PROMPT];
  const referenceImages = [];
  const sourceUrl = String(source?.url || '').trim();
  if (sourceUrl) referenceImages.push(sourceUrl);
  const sourceText = String(source?.text || '').trim();
  if (sourceText) promptParts.push(`参考已有文案基调：\n${sourceText}`);
  const direction = source?.direction;
  if (direction) {
    const directionText = [direction.purpose, direction.composition, direction.copy]
      .map(part => String(part || '').trim())
      .filter(Boolean)
      .join('；');
    if (directionText) promptParts.push(`画面策划参考：${directionText}`);
  }
  return { prompt: promptParts.filter(Boolean).join('\n'), referenceImages, references: [] };
}

/* /api/canvas/regenerate-text 返回 { text } (api.js 已校验非空, 这里再兜底一次)。 */
export function normalizeCanvasCopywritingResult(data) {
  const text = String(data?.text || '').trim();
  if (!text) {
    const error = new Error(data?.error || '文案生成失败');
    throw error;
  }
  return text;
}

/* P0-2: 视频 composer 的 prompt 来源 = 最近上游文案; 没有就返回 '' (composer 保持默认)。 */
export function resolveDerivedVideoPrompt({ nodes, connections, sourceNodeId } = {}) {
  const upstream = findUpstreamCanvasCopy({ nodes, connections, nodeId: sourceNodeId });
  return upstream ? upstream.text : '';
}

/* ── P0-3 TTS 配音执行链 ── */

/* 兜底口播稿: 视频既无上游文案也无 prompt 时, TTS 链仍可完整跑通 (验收: 视频→TTS→可播放音频节点)。 */
export const CANVAS_TTS_DEFAULT_SCRIPT = '为这条营销视频配一段 15 秒以内的口播旁白，突出商品核心卖点、使用场景与行动号召，语气自然有感染力。';

/* TTS 文本来源优先级: 上游 ready 文案(口播稿正源) > 视频/节点 prompt > 默认口播稿。 */
export function buildCanvasTtsRequest({ source, upstream } = {}) {
  const text = String(upstream?.text || '').trim()
    || String(source?.inputs?.prompt || source?.prompt || '').trim()
    || CANVAS_TTS_DEFAULT_SCRIPT;
  return { text, provider: null };
}

/* 把 /api/tts/synthesize 的 tts 结果组装成画布 audio 节点 (字段约定对齐上传音频节点:
   kind 'audio' + url 可播 + 264x72 + showMeta)。 */
export function normalizeCanvasAudioNodeFromTts({ tts, sourceNode, position = {}, nodeId, now = Date.now() } = {}) {
  const audioUrl = String(tts?.audioUrl || '').trim();
  if (!audioUrl) {
    throw new Error(tts?.error || 'TTS 未返回音频地址');
  }
  const provider = String(tts?.provider || 'default');
  const name = `TTS 配音 · ${provider}`;
  return {
    id: nodeId || `audio_tts_${now}`,
    kind: 'audio',
    provenance: 'derived',
    status: 'ready',
    url: audioUrl,
    name,
    displayLabel: name,
    group: sourceNode?.group || '音频',
    role: '配音',
    x: Number.isFinite(position.x) ? position.x : (Number(sourceNode?.x) || 0) + (Number(sourceNode?.w) || 360) + 28,
    y: Number.isFinite(position.y) ? position.y : (Number(sourceNode?.y) || 0),
    w: 264,
    h: 72,
    sourceNodeIds: sourceNode?.id ? [sourceNode.id] : [],
    editable: true,
    showMeta: true,
    durationMs: Number(tts?.durationMs) || null,
    ttsProvider: provider,
    billingCost: Number(tts?.costCny) || 0,
  };
}

/* ── P0-4 字幕动效执行链 ── */

export const CANVAS_CAPTION_STYLES = Object.freeze([
  { key: 'simple', label: '极简白字' },
  { key: 'highlight', label: '关键词高亮' },
  { key: 'kinetic', label: '动态字弹' },
  { key: 'cinema', label: '电影底栏' },
  { key: 'reel', label: '短视频竖屏' },
]);

/* 组装 /api/canvas/caption 请求参数。文本优先取上游 ready 文案, 回退视频 prompt。 */
export function buildCanvasCaptionRequest({ source, upstream, sceneCount = 3, style = 'simple', durationMs = 8000 } = {}) {
  const text = String(upstream?.text || '').trim()
    || String(source?.inputs?.prompt || source?.prompt || '').trim()
    || '';
  return {
    text,
    scene_count: Math.max(1, Math.min(12, Math.floor(sceneCount) || 3)),
    style: String(style || 'simple'),
    duration_ms: Math.max(1000, Math.floor(durationMs) || 8000),
  };
}

/* 把 /api/canvas/caption 返回的 caption 结果组装成画布 subtitle 节点数据。 */
export function normalizeCanvasSubtitleNodes({ caption, sourceNode, position = {}, nodeId, now = Date.now() } = {}) {
  if (!caption || !Array.isArray(caption.subtitles) || caption.subtitles.length === 0) {
    throw new Error(caption?.error || '字幕生成未返回有效分段');
  }
  const sid = nodeId || `subtitle_${now}`;
  const first = caption.subtitles[0];
  const name = `字幕动效 · ${caption.subtitleStyle || 'simple'} · ${caption.subtitles.length}段`;
  return {
    id: sid,
    kind: 'subtitle',
    provenance: 'derived',
    status: 'ready',
    name,
    displayLabel: name,
    group: sourceNode?.group || '应用节点',
    role: '字幕',
    x: Number.isFinite(position.x) ? position.x : (Number(sourceNode?.x) || 0) + (Number(sourceNode?.w) || 360) + 28,
    y: Number.isFinite(position.y) ? position.y : (Number(sourceNode?.y) || 0) + (Number(sourceNode?.h) || 240) + 16,
    w: 280,
    h: Math.max(60, caption.subtitles.length * 28),
    sourceNodeIds: sourceNode?.id ? [sourceNode.id] : [],
    editable: true,
    showMeta: true,
    actionId: 'application-caption',
    captionStyle: caption.subtitleStyle || 'simple',
    subtitles: caption.subtitles,
    sceneCount: caption.sceneCount || caption.subtitles.length,
    textChars: caption.textChars || 0,
    durationMs: caption.totalDurationMs || 0,
    firstText: first?.text || '',
  };
}
