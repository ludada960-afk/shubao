// test/video-upload-limit-and-message-1001.test.mjs
// 批 CY-㊴ 之十四（2026-10-01）
// 用户原话（两条，一条比一条重）：
//   ① 「我刚刚尝试了一下上传视频。等了非常久它才弹出来这个提示，然后素材上传不上来。
//       也就是说现在的上传通道是不太流畅的。」
//   ② 「而且还有就是你的提示，为什么都是英文呢？肯定要用中文来回答呀。」
//
// ① 的根因不是"上限太小"，是**同一个上限写了三份、只改了一份**：
//    tus 前两道关读 300MB ⇒ 整个文件按 5MB 一块全部传完；
//    最后一块 PATCH 触发 onUploadFinish → importUploadedAsset 撞上**仍是 50MB** 的
//    INPUT_LIMITS → 413。用户看到的就是"传了很久很久，最后才失败"。
// ② 的根因是 readableUploadError 判 `error.status` —— tus 的 DetailedError
//    **没有** .status，状态码在 `originalResponse.getStatus()`，所以恒为 0；
//    而它兜底又是 `return raw`，于是整段英文原样甩到界面上。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const limitsModule = read('server/mediaUploadLimits.mjs');
const generation = read('server/videoGeneration.mjs');
const uploadService = read('server/videoUploadService.mjs');
const serverIndex = read('server/index.mjs');
const nginx = read('scripts/nginx/shuimg.cn.conf');
const uploadClient = read('src/services/videoUploadClient.js');
const videoService = read('src/services/video.js');
const canvas = read('src/pages/EcCanvas/index.jsx');

test('① 上传体积上限只有一份真相：三处必须共用 mediaUploadLimits，不许各自写死', async () => {
  /* 判据不能只是"三处数字一样大"——那样下一个人照样能改一处漏两处。
     真正要守住的是**结构**：三处都必须从 server/mediaUploadLimits.mjs 取，
     任何一处再出现内联的字面量上限（`video: 50 * 1024 * 1024` 这类）就判失败。 */
  const INLINE_LIMIT = /(image|video|audio)\s*:\s*\d+\s*\*\s*1024\s*\*\s*1024/;

  assert.doesNotMatch(generation, INLINE_LIMIT,
    'server/videoGeneration.mjs 不许再内联写上限 —— 它是 onUploadFinish 真正把关的那一份，'
    + '内联就意味着 tus 前两道关与它可以不一致（这正是本次线上事故的形状）');
  assert.doesNotMatch(uploadService, INLINE_LIMIT,
    'server/videoUploadService.mjs 不许再内联写上限');
  assert.doesNotMatch(serverIndex, INLINE_LIMIT,
    'server/index.mjs 的直传通道不许再内联写上限');

  /* 三处都真的引用了共享模块 */
  assert.match(generation, /import \{[\s\S]*?MEDIA_UPLOAD_LIMITS[\s\S]*?\} from '\.\/mediaUploadLimits\.mjs'/,
    'videoGeneration.mjs 必须 import MEDIA_UPLOAD_LIMITS');
  assert.match(generation, /const INPUT_LIMITS = MEDIA_UPLOAD_LIMITS;/,
    'INPUT_LIMITS 必须**就是**共享上限本身（不是拷贝）');
  assert.match(uploadService, /const LIMITS = MEDIA_UPLOAD_LIMITS;/,
    'videoUploadService 的 LIMITS 必须就是共享上限本身');
  assert.match(serverIndex, /import \{ mediaUploadLimits \} from '\.\/mediaUploadLimits\.mjs'/,
    'server/index.mjs 必须从共享模块取 limits');
  assert.match(serverIndex, /const limits = mediaUploadLimits\(\);/,
    '直传通道的 limits 必须来自 mediaUploadLimits()');

  /* 权威值本身：视频必须真的够大（手机随手拍一段就上百 MB） */
  const { MEDIA_UPLOAD_LIMITS } = await import('../server/mediaUploadLimits.mjs');
  assert.equal(MEDIA_UPLOAD_LIMITS.video, 300 * 1024 * 1024,
    '视频上限必须是 300MB（50MB 时代"上传视频传不上去"）');
  assert.equal(MEDIA_UPLOAD_LIMITS.image, 10 * 1024 * 1024, '图片上限保持 10MB');
  assert.equal(MEDIA_UPLOAD_LIMITS.audio, 100 * 1024 * 1024, '音频上限 100MB');
  assert.ok(Object.isFrozen(MEDIA_UPLOAD_LIMITS), '上限必须冻结，防止运行期被改');
});

test('② nginx 必须比应用宽松：它不能先于应用返回 413（那是一张英文 HTML 错误页）', async () => {
  /* 用户看到"英文"的另一个来源：nginx 抢先拒绝时给的是 HTML 错误页，
     既不是中文也没有"上限是多少"。必须保证**应用**永远是第一个拒绝的地方。
     ⚠️ 2026-10-01 性能批：这条判据原来查的是 `/api/` 块里的那份，现已**只保留
     server 级一处**（两处各写一个数字，早晚只改一处 —— 上传上限就栽在这上面）。 */
  const { MEDIA_UPLOAD_LIMITS } = await import('../server/mediaUploadLimits.mjs');
  const occurrences = nginx.match(/client_max_body_size\s+\d+[mk]/g) || [];
  assert.equal(occurrences.length, 1,
    `client_max_body_size 必须**只有一处**（server 级），实际 ${occurrences.length} 处：${occurrences.join(' / ')}`);
  const bodySize = occurrences[0].match(/(\d+)([mk])/);
  const unit = bodySize[2] === 'k' ? 1024 : 1024 * 1024;
  const nginxBytes = Number(bodySize[1]) * unit;
  assert.ok(nginxBytes > MEDIA_UPLOAD_LIMITS.video,
    `nginx 的上限（${occurrences[0]}）必须大于应用上限（300MB），`
    + '否则 nginx 会先返回它自己的 413 HTML —— 用户看到的是英文错误页，不是中文提示');
});

test('③ 上传报错一律中文：拿用户截图里那条真实 tus 报错跑一遍', async () => {
  /* 关键事实（读 node_modules/tus-js-client/lib.esm/error.js 确认）：
     DetailedError 把状态码与响应体挂在 `originalResponse` 上（getStatus/getBody），
     **error 本身没有 .status**。上次只判 `error.status` ⇒ 恒为 0 ⇒ 兜底 `return raw`
     ⇒ 整段英文原样上屏。

     这条**不靠读源码猜**，而是把用户截图里那条报错按 tus 的真实形状造出来跑一遍，
     断言吐出来的是中文、且不含任何 tus 英文骨架。 */
  const { readableUploadError } = await import('../src/services/videoUploadClient.js');

  /* 用户 10-01 截图原文（PATCH /api/video/uploads/<uuid> → 413） */
  const REAL_TUS_ERROR = {
    message: 'tus: unexpected response while uploading chunk, originated from request '
      + '(method: PATCH, url: /api/video/uploads/43046f93-8f2f-415c-aade-746c2bb54f7d, '
      + 'response code: 413, response text: '
      + '{"code":"VIDEO_ASSET_SIZE_INVALID", error:"素材文件大小不符合要求"}, '
      + 'request id: n/a)',
    originalResponse: {
      getStatus: () => 413,
      getBody: () => '{"code":"VIDEO_ASSET_SIZE_INVALID","error":"素材文件有 128.4 MB，超过单文件上限 300 MB。请压缩后再传，或换一个更小的文件。"}',
    },
  };

  const message = readableUploadError(REAL_TUS_ERROR, 'video');

  assert.match(message, /[一-鿿]/, `必须吐出中文，实际：${message}`);
  assert.doesNotMatch(message, /originated from request|response code|request id/i,
    `tus 英文骨架漏进了用户可见文案：${message}`);
  assert.doesNotMatch(message, /^\s*tus:/, `tus 前缀漏进了用户可见文案：${message}`);
  assert.doesNotMatch(message, /\/api\/video\/uploads\//,
    `内部 URL 漏进了用户可见文案：${message}`);
  /* 服务端那条中文是权威口径（它知道真实上限），应当被原样采用 */
  assert.match(message, /超过单文件上限/, `应当采用服务端的中文提示，实际：${message}`);

  /* 无响应体时（网络层失败、nginx 抢先拒绝）也必须是中文 */
  for (const [name, error, kind] of [
    ['只有英文 message', { message: 'tus: failed to terminate upload' }, 'video'],
    ['纯状态码无正文', { message: 'whatever', originalResponse: { getStatus: () => 415, getBody: () => '' } }, 'video'],
    ['登录失效', { message: 'x', originalResponse: { getStatus: () => 401, getBody: () => '' } }, 'image'],
    ['空错误', {}, 'audio'],
    ['未知英文', { message: 'Something went totally wrong' }, 'video'],
    /* ⚠️ 这一条是真正的陷阱：nginx 抢先拒绝时响应体是 HTML、不是 JSON，
       于是走不到"采用服务端中文"那一支；而 tus 的 message 里**嵌着我们自己的中文**
       （response text 那一小段），所以"含中文"这个判据**为真** ——
       只查中文会把整段英文外壳 + 内部 URL 一起放行。
       实测：改动前这里吐出来的是完整的那句 tus 原文。 */
    ['中文嵌在英文外壳里（nginx HTML 拒绝）', {
      message: 'tus: unexpected response while uploading chunk, originated from request '
        + '(method: PATCH, url: /api/video/uploads/43046f93, response code: 413, '
        + 'response text: <html>413 Request Entity Too Large</html>, request id: n/a) '
        + '素材文件大小不符合要求',
      originalResponse: {
        getStatus: () => 413,
        getBody: () => '<html><head><title>413 Request Entity Too Large</title></head></html>',
      },
    }, 'video'],
  ]) {
    const text = readableUploadError(error, kind);
    assert.match(text, /[一-鿿]/, `${name} 必须给中文，实际：${text}`);
    assert.doesNotMatch(text, /tus:|originated from/i, `${name} 漏了英文：${text}`);
    assert.doesNotMatch(text, /\/api\/video\/uploads\//, `${name} 泄漏了内部 URL：${text}`);
    assert.doesNotMatch(text, /<html>/i, `${name} 把 nginx 的 HTML 错误页甩给了用户：${text}`);
  }

  /* 我们自己的中文提示要原样放行，不能被二次加工 */
  const own = readableUploadError({ message: '素材上传已取消' }, 'video');
  assert.equal(own, '素材上传已取消', '自家中文必须原样透传');

  /* 服务端 413 也要给"多大/上限多少/怎么办"，不是一句"大小不符合要求" */
  assert.doesNotMatch(generation, /素材文件大小不符合要求/,
    'server/videoGeneration.mjs 的 413 必须给可执行的中文（多大、上限、怎么缩小）');
  assert.match(generation, /function mediaTooLarge\(/,
    'videoGeneration.mjs 必须有统一的 mediaTooLarge 文案');
  assert.match(generation, /超过单文件上限/);
  assert.match(uploadService, /超过单文件上限/,
    'videoUploadService.mjs 的 413 也要同一句口径');
});

test('④ 画布路径必须把服务端公布的上限传下去（以前传的是 undefined）', () => {
  /* uploadVideoAsset 以前调 uploadVideoAssetResumable(file, kind) 不带 callbacks，
     于是 createVideoAssetUpload 里的 describeUploadTooLarge 只能退回兜底常量 ——
     服务端改过上限后，前端"上传前拦截"就在拿旧数字拦。 */
  assert.match(videoService, /limits:\s*callbacks\.limits \|\| capabilities\?\.uploadLimits/,
    'uploadVideoAsset 必须把 capabilities.uploadLimits 传进 callbacks');
  assert.match(videoService, /uploadVideoAssetResumable\(file, kind, options\)/,
    'tus 分支必须把 options 透传下去（以前第三个参数直接没了）');
  assert.match(videoService, /createVideoAssetUpload\(file, kind, \{ \.\.\.options, resumable: false \}\)/,
    '直传分支同样要带上 limits');
});

test('⑤ 上传全程有进度反馈（用户说的"上传通道不太流畅"）', () => {
  /* 300MB 视频要传好几分钟。以前这段时间屏幕上**一个数字都没有** ——
     用户既不知道在传、也不知道传到哪，唯一的信号是最后那条报错。 */
  assert.match(canvas, /ec-canvas-upload-progress/,
    '画布必须渲染上传进度');
  assert.match(canvas, /role="progressbar"/, '进度条要有 progressbar 语义（可访问性）');
  assert.match(canvas, /aria-live="polite"/, '进度要有 live region，读屏也能听到');
  assert.match(canvas, /已传|bytesUploaded/, '必须显示已传/总量，不只是百分比');
  assert.match(canvas, /percentText/, '百分比保留一位小数（取整会让慢网看起来像卡死）');

  /* 每条上传路径都要真的接上进度回调，而不是只渲染了个壳 */
  const videoUploads = canvas.match(/uploadVideoAsset\([^)]*'video'[^)]*\)/g) || [];
  assert.ok(videoUploads.length >= 2, '至少有替换与新增两条视频上传路径');
  for (const call of videoUploads) {
    assert.match(call, /makeUploadReporter\(/,
      `视频上传路径没有接进度回调：${call}`);
  }
  for (const call of canvas.match(/uploadVideoAsset\([^)]*'audio'[^)]*\)/g) || []) {
    assert.match(call, /makeUploadReporter\(/, `音频上传路径没有接进度回调：${call}`);
  }

  /* 失败路径必须清掉进度条，否则会留下一个永远转不完的 47% */
  assert.match(canvas, /finally \{[\s\S]{0,80}clearUploadProgress\(\)/,
    '每个上传 handler 的 finally 都要 clearUploadProgress()');
});
