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

/* ── 墓碑（过期记录）────────────────────────────────────────────────────────
   服务端到期后不再整行删，而是清空媒体字段 + 记 `expired_at`（批 CA）。
   前端据此：**留一张灰卡说清"已过期"**，但不给"用这组参数/下载/看大图"——
   文件已经回收了，给了就是点了没反应的坑。 */
export const EXPIRED_BADGE = '已过期';
export const EXPIRED_NOTE = '这条记录已过期（生成记录保留 7 天），图片文件已清理，无法再打开或下载。';

export function isExpiredWork(work) {
  return Boolean(work && (work._expired === true || String(work.expired_at || work.expiredAt || '').trim()));
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

/* ── 按日期分组（今天 / 昨天 / 更早）──────────────────────────────────────────
   用户口径：「它的**排版**……是不是也得加进去呢？我们现在这个**我的资产**还有**画布里面的新建画布**
   功能他们那里其实已经做过很多相关的一些 UI 或者交互方面的设计了」——
   画布库（`CanvasLibraryModal`）就是这么分组的，这里**照它**来，不另发明一套。

   ⚠️ 一个正在被遵守的判断（用户上一轮点出来的）：那条历史是**按技能**筛的（图片技能的页面只有图片、
   视频技能的页面只有视频），所以**不做"全部/图片/视频"的类型筛选** —— 那在单类型列表里没有意义。
   分组则相反：同一条技能会生成很多次，按天分组是真有用的。 */
export function groupHistoryByDay(items = [], now = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  const dayOf = value => {
    /* ⚠️ `new Date(String(dateObj))` 会把 "Sat Sep 27 2026 …" 里**第一个空格换成 T**，
       结果解析失败 → "今天/昨天"这两个标签永远不会出现（门禁① 抓出来的真实缺陷）。 */
    const date = value instanceof Date ? value : new Date(String(value || '').replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) return '';
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  };
  const todayKey = dayOf(now);
  const yesterdayKey = dayOf(new Date(now.getTime() - 86400000));
  const buckets = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const key = dayOf(item?.createdAt || item?.created_at || item?.at || '') || 'unknown';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(item);
  }
  return [...buckets.entries()]
    /* ⚠️ 取不到时间的（'unknown'）**永远排最后**：按字符串倒序它会排到最前（'u' > '2'），
       那样"更早的那一堆"会盖在今天上面 —— 门禁① 就是拿这条抓出来的。 */
    .sort((left, right) => {
      if (left[0] === 'unknown') return 1;
      if (right[0] === 'unknown') return -1;
      return String(right[0]).localeCompare(String(left[0]));
    })
    .map(([key, list]) => ({
      key,
      label: key === todayKey ? '今天' : key === yesterdayKey ? '昨天' : (key === 'unknown' ? '更早' : key.slice(5).replace('-', ' 月 ') + ' 日'),
      items: list,
    }));
}
