/* 角色形象 & 图标映射 */
const _b = (n) => new URL('/images/' + encodeURIComponent(n), import.meta.url).href;

export const IMAGES = {
  appicon:     _b('logo-icon.webp'),
  logo_lg:     _b('LOGO.png'),
  /* ═══ 2026-09-24 批 BD：**品牌标推翻重做**（用户：「还是不对啊，你这个 LOGO 还不如之前的那个，
     算了，你不如重新推翻重新设计吧」）═══════════════════════════════════════════════════════════
     批 BC 用的是公共目录里那份现成资产（卡通吉祥物 + **红色手写字**）：红色手写字与全站的紫色语言
     打架、卡通感也太重，用户直接否掉。⇒ 现在拆成两件自己控制的东西：
       · **mark**：`scripts/brand-mark-build.mjs` 用 sharp 合成 —— 超椭圆圆角（32%）+
         吉祥物放大到占满磁贴 + 1px 品牌内环，**去掉原来那张图自带的灰色描边**（那就是"贴纸感"的来源）。
         输出 3x（180px）与 2x（120px）两份，30px 显示时有 6 倍余量，任何 DPI 都不糊。
       · **字标**：不再用现成图，也不再"只调字号字距" —— 按层级排版（薯包 800 + 分隔线 + AI 拉丁规格）。 */
  brandMark:   _b('brand-mark-3x.png'),
  brandMark2x: _b('brand-mark-2x.png'),
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
