/* ═══ 生成记录（历史）的**纯计算**：状态标签 + 下载文件名（2026-09-26 批 BZ）══════════════════
   放在这里而不是页面里，是因为页面是 JSX、node 里只能读文本不能真跑；这两件事又都需要门禁
   逐条钉住（用户口径：「他们是不是也得有一个**遮罩的标签**这样？那这个标签应该备注是什么呢？」）。

   ── 状态标签（卡片左上角那枚遮罩标签）──────────────────────────────────────
     · 只标**状态**，不标类型：视频卡会自己播、图片卡是静的，一眼分得出来，贴"图片/视频"是噪音；
     · **正常不显示**（有成品就是干净的一张卡），只有"不正常"才说明情况；
     · 文案必须是用户的话，**不许把服务端状态词原样透传**（改前会冒出英文状态）。
   用户看得懂的只有这三档，见表；没见过的一律按"生成中"兜底，但仍然不透露英文原文。 */
const QUEUED = ['queued', 'pending', 'waiting', 'created'];
const FAILED = ['failed', 'error', 'canceled', 'cancelled', 'rejected'];

export function videoStatusLabel(status) {
  const value = String(status || '').trim().toLowerCase();
  if (!value) return '生成中';
  if (QUEUED.includes(value)) return '排队中';
  if (FAILED.includes(value)) return '生成失败';
  return '生成中';
}

/* ── 下载文件名 ────────────────────────────────────────────────────────────
   用户下到本地要认得出"这是哪一次、第几张"：
     · 用作品标题（去掉路径不安全字符、截断到 40 字），标题为空时退回技能名；
     · **一组多张时带序号**（`标题-1.png`），单张时不带；
     · 扩展名从地址里读；读不出来时按"成片=mp4 / 其余=png"兜底。 */
const UNSAFE = /[\\/:*?"<>|]+/g;
const EXT = /\.(png|jpe?g|webp|gif|mp4|mov|webm)(?:\?|$)/i;

export function downloadFileName({ title = '', fallback = '作品', url = '', index = 0, count = 1, video = '' } = {}) {
  const base = String(title || fallback || '作品').replace(UNSAFE, '_').trim().slice(0, 40) || '作品';
  const matched = String(url).match(EXT);
  const ext = (matched ? matched[1] : (count === 1 && video ? 'mp4' : 'png')).toLowerCase();
  return count > 1 ? base + '-' + (index + 1) + '.' + ext : base + '.' + ext;
}
