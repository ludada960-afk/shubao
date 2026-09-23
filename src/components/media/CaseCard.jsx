import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronRight, Play, Sparkles } from 'lucide-react';

/* ═══ CaseCard：案例卡（图片板块与视频板块共用，唯一实现）═════════════════════════
   2026-09-16/17 用 CDP 直连竞品（已登录态）扒到的**卡片真实结构**，逐条照抄机制：
     · 卡片 = 4:3 圆角 16、白底、1px 细边、柔和投影；hover 上浮 2px + 阴影加深
     · **封面铺满整张卡**（不是"图在上面、文字在下面"的两段式）
     · 封面之上压一层**自下而上的白色渐变**（他们写的是 from-white，不是黑遮罩）
     · 底部一行：标题 14px 半粗 + 副标题 11px 一行截断 + 右侧一个 › 箭头
     · **封面可以是视频**：他们的卡片直接放 <video>（autoplay/loop/muted/playsinline/preload=metadata），
       所以视频板块的卡是"真的在播"的（他们的原话：这些视频有在播放的）。
   我们与他们的差别只有一处、且是**更省**的做法：
     他们 autoplay 全部卡片（含屏幕外的）；我们**只在卡片进入视口时播放、离开视口立刻暂停**。
     观感一样（在看的都在动），但屏幕外的不会偷跑流量与解码。
     另外尊重 prefers-reduced-motion：不开自动播放，只在 hover 时播。
   图片卡与视频卡**同一份实现**，差别只有传不传 video。 */

const REDUCED_MOTION = () => typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function CaseCard({
  title = '',
  subtitle = '',
  cover = '',
  video = '',
  poster = '',
  badge = '',
  onOpen = null,
  className = '',
  /* ⚠️ 复刻 / 修图 / 换背景这类 skill 的案例**一张图说不清它干什么** ——
     竞品实测（43 §10.2）：他们的复刻类示例一律做成「原图 ↔ AI 作品」两图对照。
     所以卡片支持第二种封面形态：给 before 就走对照版式（左原图 → 右成品），
     没给就还是原来的单图封面。两种形态共用同一张卡、同一套遮罩与标题。 */
  before = '',
  /* ═══ 字标位（没有案例图时的封面）══════════════════════════════════════════════
     accent：skill 声明的色系（warm / cool / soft / neutral，见各 skill 的 cover.accent）；
     monogram：名字前两字。两者都只在**没有案例图**时才会被用到。 */
  accent = 'neutral',
  monogram = '',
  /* ═══ 批 M：**按钮的预览窗**要用到的案例图（最多 3 张）══════════════════════════════════════
     用户第 17 轮追加批注原话：「**也不只是视频的 hub 啊，视频和图片生成的按钮预览窗都要用这个样式
     去做啊**……是我们**电商生图、万物上身、小红书图文、自由创作、封面设计、海报**这些都有做」；
     追问后确认：「把之前做的这块**拿来当预览窗展示**就可以，**对应相应的 skill 进去**，
     其他的就**先占位**就好，后续我会自己跑完给你的」。
     ⇒ 形态 = 首页那一块「左文案 + 右案例图」；没有案例就**三格占位**并如实写"案例补充中"（不许放假图）。 */
  previewShots = [],
}) {
  const articleRef = useRef(null);
  const videoRef = useRef(null);
  const [inView, setInView] = useState(false);
  const [hovering, setHovering] = useState(false);
  /* ═══ 2026-09-24 批 AV：预览窗的两个新状态（用户图一 / 图五 的两条批注）═══════════════════════
     ① `shotRatio`：预览窗里那张图的实际宽高比。用户原话：「你是一个正方形的图片，1:1 的这种图片。
        你放进来之后，你下面的那部分是会被截断的，因为你的预览窗是长方形的……是不是其实比如说
        用居中来展示会更好呢」⇒ 不再用固定 16:9 去裁它：**框跟着图走**（读 naturalWidth/Height，
        夹在 3:4 与 16:9 之间），配 object-fit: contain + 居中 —— 方图就得到方框，既不裁也不留空带。
     ② `align`：预览窗该往哪边对齐。用户原话：「我搞不明白你为什么鼠标放上去之后，整个案例不是
        居中在你这个窗口的……因为你现在是往右边挤的，导致其实会有一部分案例是没办法展示全的，
        它会被右边给截断」⇒ 悬停时量一次卡片位置：卡片靠右就把浮窗右对齐，靠左就左对齐，
        中间那种才居中 —— 三种都不出视口（下面 place() 里给了判据）。 */
  const [shotRatio, setShotRatio] = useState(0);
  const [align, setAlign] = useState('left');

  /* 预览窗的对齐判据：浮窗宽 440（与 CSS 的 min(440px, 92vw) 同值），留 16 的安全边 */
  const placePreview = () => {
    const node = articleRef.current;
    if (!node || typeof globalThis.innerWidth !== 'number') return;
    const rect = node.getBoundingClientRect();
    const width = Math.min(440, globalThis.innerWidth - 32);
    const center = rect.left + rect.width / 2;
    const room = globalThis.innerWidth - 16;
    if (center + width / 2 > room) setAlign('right');
    else if (center - width / 2 < 16) setAlign('left');
    else setAlign('center');
  };

  useEffect(() => {
    const node = articleRef.current;
    if (!node || !video) return undefined;
    if (typeof IntersectionObserver !== 'function') { setInView(true); return undefined; }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => setInView(entry.isIntersecting));
    }, { rootMargin: '120px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [video]);

  /* 进入视口就播、离开就停；hover 时一定在播。减少动效偏好下只 hover 播。 */
  const shouldPlay = Boolean(video) && inView && (hovering || !REDUCED_MOTION());

  /* 悬停时量一次卡片位置决定浮窗往哪边对齐；滚动/改变窗口时重新量 */
  useEffect(() => {
    if (!hovering) return undefined;
    placePreview();
    const onViewport = () => placePreview();
    globalThis.addEventListener('resize', onViewport);
    globalThis.addEventListener('scroll', onViewport, true);
    return () => {
      globalThis.removeEventListener('resize', onViewport);
      globalThis.removeEventListener('scroll', onViewport, true);
    };
  }, [hovering]);

  useEffect(() => {
    const node = videoRef.current;
    if (!node) return;
    if (shouldPlay) {
      /* 同一时刻只留一条在播（防止几十条视频一起占带宽与解码） */
      document.querySelectorAll('video[data-case-preview]').forEach(other => {
        if (other !== node) other.pause();
      });
      const played = node.play();
      if (played?.catch) played.catch(() => {});
    } else {
      node.pause();
    }
  }, [shouldPlay]);

  return (
    <article
      ref={articleRef}
      className={['media-case-card', className].filter(Boolean).join(' ')}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <button type="button" className="media-case-card-hit" onClick={() => onOpen?.()} aria-label={title ? title + '（查看案例）' : '查看案例'}>
        <span className="media-case-card-cover">
          {before && cover ? (
            <span className="media-case-card-compare">
              <img src={before} alt={(title || '案例') + ' · 原图'} loading="lazy" />
              <span className="media-case-card-compare-arrow" aria-hidden="true"><ArrowRight size={13} /></span>
              <img src={cover} alt={(title || '案例') + ' · 成品'} loading="lazy" />
            </span>
          ) : video ? (
            <video
              ref={videoRef}
              data-case-preview
              src={video}
              poster={poster || cover || undefined}
              /* 门禁逐字断言这一串：静音 + 循环 + 内联播放 + 只取元数据（不整包下载） */
              muted loop playsInline preload="metadata"
            />
          ) : cover ? (
            <img src={cover} alt={title} loading="lazy" />
          ) : (
            /* ═══ 没有案例封面时的**字标位**（2026-09-19 批 G 重做）═════════════════════
               原来是"一块灰底 + 居中一行小字"。批 E 把卡放大到 260 以后，
               总页面上 88/92 张卡都没有案例图 —— 一整片灰底看着就是加载失败，
               用户的原话是「你这个就是个 demo 呀……没有任何的设计」。
               现在：按 skill 声明的 accent 铺一层同族浅渐变，中间放一个**两字字标**
               （品牌浅色调，当水印用，不跟标题抢读），右下角留一枚小胶囊写「案例补充中」。
               诚实信息一个不少（没有案例就说没有案例），但看上去是**刻意的字标位**，
               不是一张坏图。⚠️ 有案例图的卡一个字都没动。 */
            <span className="media-case-card-blank" data-accent={accent}>
              {monogram && <span className="media-case-card-monogram" aria-hidden="true">{monogram}</span>}
              <span className="media-case-card-blank-note"><Play size={12} />案例补充中</span>
            </span>
          )}
          {video && !shouldPlay && <span className="media-case-card-play" aria-hidden="true"><Play size={16} /></span>}
        </span>
        {/* 自下而上的白色渐变：标题压在它上面才读得清（实测同款） */}
        <span className="media-case-card-veil" aria-hidden="true" />
        {badge && <span className="media-case-card-badge">{badge}</span>}
        <span className="media-case-card-caption">
          <span className="media-case-card-titles">
            <span className="media-case-card-title">{title}</span>
            {subtitle && <span className="media-case-card-subtitle">{subtitle}</span>}
          </span>
          <span className="media-case-card-arrow" aria-hidden="true"><ChevronRight size={14} /></span>
        </span>
        {/* ═══ 悬停时从左往右充满的 4px 渐变条（2026-09-19 批 H-6，用户批注 #6）═══════════
            用户原话：「当你的鼠标滑动过去任何一个按钮上面……你下面这条进度条还会从左往右充满。
            然后你的鼠标离开的话……它下面的进度条会从右往左再变回去。」
            这是照着 liuyingai 实测抄的（docs/design/54）：
              · 高 4px、绝对定位 bottom:0 / left:0、圆角 0；
              · 默认 width:0，悬停 width:100% —— **是 width 过渡，不是 transform / scaleX**（实测确认）；
              · transition: width .7s cubic-bezier(.4, 0, .2, 1)（实测 computed 与 5 点采样都是 700ms）；
              · 左边缘钉死不动 ⇒ 进入时右边缘向右推进（左→右充满），离开时收缩（右→左收回）。
            ⚠️ 唯一不照抄的地方是**颜色**：他们用 #0076F5 → #7D28CC（他们的品牌色），
              我们用 --sb-brand-500 → --sb-brand-700 —— 抄形状不抄品牌色，否则站里会出现两套紫。
            ⚠️ 它是纯装饰：aria-hidden + pointer-events:none，不抢点击、不进无障碍树。 */}
        <span className="media-case-card-progress" aria-hidden="true" />
      </button>
      {/* ═══ 批 M：**按钮预览窗**（左文案 + 右案例图）══════════════════════════════════════════
          悬停时浮在卡片上方。内容**跟着这条 skill 走**（名字 / 一句说明 / 它的案例图）；
          没有案例图的技能**三格占位**并如实写「案例补充中」—— 本站铁律：不许放假图。
          ⚠️ 它挂在 <article> 里（不是 <button> 里）：浮窗里有文字，塞进按钮会让
             "按钮的可读名字"变成一大段；而且点击仍然只走按钮那一层。 */}
      {hovering && (
        <div
          className="media-case-card-preview"
          data-align={align}
          role="dialog"
          aria-label={(title || '技能') + ' 预览'}
        >
          {/* ═══ 2026-09-23 批 Z-②：与首页那份预览窗**同步改成上图下文**（用户图七）═══════════
              首页一份（SkillEntryRow）、子页面一份（这里），两处必须同一门语言 ——
              长相不一致，用户看到的就是"你又在两个地方做了两套"。
              ⚠️ 2026-09-24 批 AV：框**跟着图的长宽比走**（用户图一：「正方形的图片放进来，
                 下面那部分会被截断……用居中来展示会不会更好」）—— 读 naturalWidth/Height，
                 夹在 3:4 与 16:9 之间，配 object-fit: contain 居中：方图得到方框，不裁不留空。 */}
          <div className="media-case-card-preview-art" aria-hidden="true">
            {previewShots && previewShots[0]
              ? (
                <span
                  className="media-case-card-preview-shot"
                  style={shotRatio ? { aspectRatio: String(shotRatio) } : undefined}
                >
                  <img
                    src={previewShots[0]}
                    alt=""
                    loading="lazy"
                    onLoad={event => {
                      const { naturalWidth, naturalHeight } = event.currentTarget;
                      if (!naturalWidth || !naturalHeight) return;
                      const ratio = naturalWidth / naturalHeight;
                      /* 夹在 3:4(0.75) 与 16:9(1.78) 之间：极端竖图/长图都不至于把浮窗撑变形 */
                      setShotRatio(Math.min(16 / 9, Math.max(3 / 4, ratio)));
                    }}
                  />
                </span>
              )
              : <span className="media-case-card-preview-shot is-blank"><Play size={12} />案例补充中</span>}
          </div>
          {/* ═══ 2026-09-24 批 AV：预览窗正文只留两行（用户图一 / 图五 的批注）══════════════════
              用户原话：「这个部分完全不需要有啊。已经说了很多遍了就是。**预览窗里面只需要展示
              它是一个什么 Skill 的名字。还有他这张图片的主题就可以了**。」
              ⇒ 删掉「进入「XX」工作台 →」那一行，也删掉标签行（"案例还在补充"与图上的占位重复）。
                留下的是：技能名（eyebrow）+ 这张图的主题（strong）。 */}
          <div className="media-case-card-preview-body">
            <span className="media-case-card-preview-eyebrow"><Sparkles size={13} />{title}</span>
            {subtitle ? <strong>{subtitle}</strong> : null}
          </div>
        </div>
      )}
    </article>
  );
}
