/**
 * 图片过滤工具
 *
 * 去重、剔除水印/广告/图标、尺寸过滤
 * 严格按照「只保留商品主图/细节图/场景图」原则
 */

export function imageFilter(urls) {
  if (!urls || !urls.length) return [];

  const seen = new Set();
  const result = [];

  for (const url of urls) {
    if (!url || typeof url !== 'string') continue;

    const clean = url.trim().split('?')[0].split('#')[0];

    // 去重
    if (seen.has(clean)) continue;
    seen.add(clean);

    // 只接受 http/https
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) continue;

    // ── 跳过非商品图片 ──
    const lower = clean.toLowerCase();
    const skipPatterns = [
      // 广告/图标/logo
      '/icon/', '/logo/', '/banner/', '/badge/', '/watermark/',
      'icon.', 'logo.', 'badge.', 'sprite.',
      'favicon', 'transparent',
      // 认证/资质/法律相关
      'license', 'certificate', 'credential', 'legal',
      'business', 'zhizhao', 'yyzz',  // 营业执照
      'report', 'jubao',              // 举报
      'complain', 'rights', 'law',
      'register', 'icp', 'beian',
      // 页脚/店铺信息
      'footer', 'foot-', '-foot',
      'shop-info', 'shopinfo',
      'copyright',
      // 二维码/条形码
      'qrcode', 'qr_code', 'erweima',
      'barcode', 'barcode',
      // 用户头像/评价
      'avatar', 'user-pic', 'user_face',
      'rate', 'review', 'comment',
      // 推荐/相关商品（非当前商品）
      'recommend', 'relate', 'similar',
      'suggest', 'hot-', '/hot_',
      // 尺寸图标/按钮装饰
      'size-guide', 'size_chart',
      'return-', '售后',
      'service', 'guarantee',
    ];
    if (skipPatterns.some(p => lower.includes(p))) continue;

    // 限制总图片数不超过 30 张
    if (result.length >= 30) break;

    result.push(clean);
  }

  return result;
}

/**
 * 检测图片是否为水印/图标（基于文件名）
 */
export function isJunkImage(url) {
  if (!url) return true;
  const lower = url.toLowerCase();
  const junk = [
    '/watermark', 'watermark.', 'shuiyin', 'sy.',
    '/icon', 'icon_', '_icon',
    '/logo', 'logo.',
    'sprite.', 'sprite_',
    'banner_', '/banner/',
    'placeholder', 'loading.',
    'pixel.', 'tracker.', 'beacon.',
    'avatar', 'head_',
    'qr_code', 'erweima', 'qrcode',
    'recommend',
  ];
  return junk.some(j => lower.includes(j));
}
