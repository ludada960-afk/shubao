/* 角色形象 & 图标映射 */
const _b = (n) => new URL('/images/' + encodeURIComponent(n), import.meta.url).href;

export const IMAGES = {
  appicon:     _b('logo-icon.webp'),
  logo_lg:     _b('LOGO.png'),
  /* ═══ 2026-09-24 批 BC：**完整的品牌标**（吉祥物 + 定制字形"薯包AI"）═════════════════════════════
     这份资产一直在 public/images 里躺着、从来没有被任何页面用过 —— 顶栏一直是"图标 + CSS 拼的文字"。
     用户连着两轮说「LOGO 和文字都特别的 low……薯包 AI 这几个字太过于简单了」，
     根因就是**用字体拼商标**：字体再调字距也拼不出字标（"包"字里那个表情就丢了）。
     调研也印证了这一点：Linear / Vercel / Raycast / Stripe / 可灵 的导航品牌标
     **没有一个是用 HTML 文本做的**，全都是单个 SVG/资产（把间距、基线、字距焊死在图里）。 */
  wordmark:    _b('logo-wordmark.webp'),
  scene:       _b('小薯包.png'),

  // 角色状态
  ready:       _b('准备好了吗？.png'),
  wave:        _b('视角挥手.png'),
  walk:        _b('侧面行走.png'),
  stand:       _b('写作.png'),
  sit:         _b('坐着.png'),
  jump:        _b('跳跃兴奋.png'),
  welcome:     _b('欢迎光临.png'),
  think:       _b('睡觉.png'),
  sleep:       _b('睡觉.png'),
  upgrade:     _b('升级提示.png'),
  loading:     _b('举重.png'),
  result:      _b('烹饪.png'),
  publish:     _b('冥想.png'),
  tip:         _b('跳舞.png'),
  banner:      _b('超级英雄.png'),
  idea:        _b('画廊策展人.png'),
  success:     _b('批准印章.png'),
  protect:     _b('摄影师.png'),
  surf:        _b('冲浪.png'),
  meditate:    _b('冥想.png'),
  cook:        _b('烹饪.png'),
  dance:       _b('跳舞.png'),
  done:        _b('完成.png'),
  superhero:   _b('超级英雄.png'),
  curator:     _b('画廊策展人.png'),
  inspect:     _b('检查.png'),
  photographer:_b('摄影师.png'),
  lift:        _b('举重.png'),
  empty:       _b('空状态.png'),
  error:       _b('错误状态.png'),
  crash:       _b('崩溃.png'),
  paint:       _b('绘画.png'),
  analyze:     _b('分析.png'),
};

// 加载动画角色轮播序列
export const CHAR_CYCLE = [
  'ready','wave','walk','stand','jump','sit','meditate',
  'cook','success','curator','analyze','surf','superhero',
  'paint','dance','welcome','lift','inspect','upgrade'
];
