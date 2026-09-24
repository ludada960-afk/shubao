/* ═══ 上游内容策略拒绝的**翻译层**（2026-09-24 批 BA，doc 75 §三.2）══════════════════════════════
   用户口径（原话，与 docs/design/75 一起看才是完整要求）：
     「有这种内容肯定是要**直接拒**的」
     「用户上传的素材和提示词都应该先过一遍没问题再传输生成，其实也是**防止我们被中转站给 ban 掉**」
     「**为什么还要重新花钱呢**……没有低成本的过滤方案吗」
   第一阶段（批 AX）已经在**出站之前**用本地词表拦掉了"写明了要什么"的那一类（零成本）。
   这一层处理的是**漏过去之后**的事：上游（中转站 / 火山）自己按内容政策把这一单拒了，而现在
   我们把它当成"我们的故障"透给用户 —— 用户看到的是"生成失败，请重试"，于是他会**原样再点一次**，
   同一份内容再撞一次墙（既解决不了问题，又白烧一次上游调用）。

   这一层的做法只有两件事：
     ① **认出来**：命中即换成一句用户能照着做的中文（"更换素材或提示词"），不是"失败了"；
     ② **不再重试**：内容问题重试一百次也是同一个结果，所以 retryable=false，
        视频侧还要**跳过备用网关**（备用网关执行的是同一套内容政策）。

   ⚠️ 判据是**上游返回体里的文本**（我们早就在收的那段 detail），**不是某个字段名** ——
      这一条要说清楚，因为本仓的铁律是"不许猜上游字段名"：
        · 上游没有给内容违规一个稳定、可依赖的错误码（中转站返回的是 OpenAI 风格的
          `{ error: { message } }`，message 是各家模型自己的措辞；火山 MediaKit 是中文文案）；
        · 我们没有、也不打算凭空发明一个字段 —— 判据只用**已经拿到手的原始文本**，
          命中不了就**一个字都不改**（行为与从前逐字节相同）。
      ⇒ 词表刻意保守：宁可漏判（用户看到原来的失败文案），也不误判（把"额度不足"说成"内容违规"，
        那会让用户去改一份本来没问题的素材）。
      ⇒ 反向护栏 NON_POLICY_PATTERNS：文本里同时出现"配额/限流/超时/参数错误/模型不存在"这类
        明确的**非内容**故障词时，一律不判为内容拒绝。 */

/* 用户侧那一句话（视频与图片共用同一句：用户只需要知道"换素材"这一个动作）
   ⚠️ 措辞有一条**红线**（test/provider-backup-routes-0912 与 provider-failover-observability-0912
      逐字守着）：面向用户的文案**不许出现「上游 / 备用 / 供应商 / provider」**这类实现词 ——
      用户不需要知道我们后面挂了谁。所以这里写"内容审核"，不写"上游内容审核"。 */
export const CONTENT_REJECTION_MESSAGE = '素材或提示词未通过内容审核，请更换后重试（这次没有扣费）';

/* 内容政策措辞（英文族：OpenAI 兼容网关与 Gemini 两套在中文中转站上都会原样透出） */
const POLICY_PATTERNS = Object.freeze([
  /content[_ -]?polic/i,
  /safety[_ -]?(?:system|filter|check|violation|setting)/i,
  /(?:blocked|rejected|flagged|denied)[^.\n]{0,48}(?:safety|polic|moderation|prohibited)/i,
  /\bmoderation\b|moderated/i,
  /prohibited[_ -]?(?:content|use)/i,
  /nsfw|explicit[_ -]?content|sexual[_ -]?content|sexually[_ -]?explicit/i,
  /* 中文族：国内中转站与火山 MediaKit 自己的文案 */
  /内容(?:审核|政策|安全|规范|合规)/,
  /审核(?:不通过|未通过|失败|拒绝)/,
  /违规(?:内容|信息|素材|图片|文案)?/,
  /敏感(?:内容|信息|词|素材)/,
  /不符合(?:内容)?(?:规范|政策|要求)/,
  /涉(?:黄|政|暴|恐|毒)/,
  /(?:色情|低俗|淫秽|裸露|血腥|恐怖)内容/,
]);

/* 反向护栏：这些词出现时，这一单的失败原因**不是**内容政策（别把用户往"改素材"那条路上带）。
   ⚠️ 只收**具体到参数**的那些词。`invalid_request_error` **不能**收进来 —— 那是 OpenAI 兼容
      网关给**所有** 400 用的通用 type，内容拒绝的报文里就带着它（收了它会把真正的内容拒绝漏判，
      而漏判的代价是用户原样再撞一次）。 */
const NON_POLICY_PATTERNS = Object.freeze([
  /quota|insufficient|余额不足|额度不足|欠费/i,
  /rate[_ -]?limit|too many requests|请求(?:过于)?频繁|限流/i,
  /timeout|timed out|超时/i,
  /not[_ -]?found|model[_ -]?name|不存在|未找到/i,
  /invalid[_ -]?(?:duration|size|ratio|aspect|parameter|argument|resolution)|参数(?:错误|无效|非法)/i,
  /unauthorized|invalid[_ -]?api[_ -]?key|鉴权|密钥/i,
]);

/**
 * 这段上游文本是不是"内容政策拒绝"。
 * @param {object} input
 * @param {number} [input.status] 上游 HTTP 状态（拿不到时传 0 / 省略）
 * @param {string} [input.detail] 上游返回体里我们能拿到的原始文本（我们已经在收的那段）
 * @returns {{ rejected: boolean, matched: string, detail: string }}
 */
export function classifyContentRejection({ status = 0, detail = '' } = {}) {
  const text = typeof detail === 'string' ? detail : String(detail || '');
  const code = Number(status);
  const result = { rejected: false, matched: '', detail: text.slice(0, 300) };
  if (!text.trim()) return result;
  /* 只认"客户端侧"的状态码与**轮询终态**（status 缺省为 0 的那条路）：
     5xx 是上游自己的故障，不该借内容政策的名义拦下用户（那两类要照旧走重试）。 */
  if (code && !(code === 400 || code === 403 || code === 404 || code === 422)) return result;
  if (NON_POLICY_PATTERNS.some(pattern => pattern.test(text))) return result;
  const hit = POLICY_PATTERNS.find(pattern => pattern.test(text));
  if (!hit) return result;
  return { ...result, rejected: true, matched: String(hit) };
}

/** 按内容拒绝造一个**不重试**的错误（providers 与作业流水线共用同一形状）
 *  ⚠️ HTTP 语义取 **400 而不是 5xx**（与 doc 75 第一阶段同一条纪律）：这是**客户端的输入问题**，
 *     不是我们的故障 —— 上游监控/告警看到 5xx 会当成我们的错，而这一类必须让人一眼看出
 *     "是内容不合规，不是服务坏了"。 */
export function contentRejectionError(detail = '', { status = 0, cause = null } = {}) {
  const error = Object.assign(new Error(CONTENT_REJECTION_MESSAGE), {
    status: 400,
    code: 'CONTENT_REJECTED',
    retryable: false,
    contentRejected: true,
    providerStatus: Number(status) || 0,
    providerDetail: String(detail || '').slice(0, 300),
  });
  if (cause) error.cause = cause;
  return error;
}

/** 这个错误是不是内容拒绝（作业流水线据此改用户文案 / 跳过备用网关） */
export function isContentRejectionError(error) {
  return Boolean(error && (error.contentRejected === true || error.code === 'CONTENT_REJECTED'));
}
