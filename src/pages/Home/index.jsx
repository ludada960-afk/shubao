import React, { lazy, Suspense, useState, useRef, useEffect, useMemo } from 'react';
import { MdAutoAwesome, MdEdit, MdPalette, MdShoppingCart, MdVideoLibrary } from 'react-icons/md';
import { useApp } from '../../store/AppContext';
import VideoStudioPage from '../VideoStudio';
import VisualCreationMode from './VisualCreationMode';
import GallerySection from './GallerySection';
/* 批 J-⑨：首页案例表达区复用**既有**的那一块（小红书模式一直在用），不重写版式。 */
/* 批 T：CreationShowcase 的 import 一并撤掉（首页不再渲染它；组件本身留在
   XhsContentMode 里继续用，那边是 import 自己那份） */
/* 批 J：预览窗的「对应的那种界面」要的就是这一块案例真源（与下面那块案例区同源）。 */
import { productionCaseById } from './productionCaseCatalog.js';
import Footer from '../../components/layout/Footer';
import RecoveryShelf from './ec/RecoveryShelf';
import SkillEntryRow from '../../components/media/SkillEntryRow.jsx';
import { categoryOrderOf, featuredSkills, hubPath, skillPath, skillsOfBoard } from '../../skills/skillDirectory.js';

/* ═══ 批 CY-㊴ 之二十二（2026-10-01）：首页默认不渲染的三个模式，改成懒加载 ════════
   实测：首页落地页默认是 **视频工作台**（AppContext: mode 默认 'video'，
   而 modeOptions 只有「视频生成 / 图片生成」两项 —— 没有电商模式）。
   下面这三个组件只有切到 mode==='content' / 'ecommerce' 时才渲染
   （深链进技能子页面、或"做同款"/恢复链路），首页默认一次都不画：

     EcMode           1760 行  深链进电商套图 / 恢复链路
     XhsContentMode   1954 行  小红书图文 / plog 子页面
     DesignDirection 1189 行  电商的第 2 步（确认设计方案）

   它们被 import 进来就进了首屏包 —— 实测合计 144 KB 原始体积、白扛着。

   ⚠️ 两条纪律（之二十一用白屏换来的）：
   ① **每个 lazy 都必须有 Suspense**，否则切到那个模式时没有 fallback 直接报错。
   ② 改完**必须同时量渲染健康度**（DOM/文字/默认视频工作台还在不在）——
      只量字节的话，"页面崩了所以字节降了"会被误当成收益（那次差点就这么上线）。 */
const EcMode = lazy(() => import('./EcMode'));
const XhsContentMode = lazy(() => import('./XhsContentMode'));
const DesignDirection = lazy(() => import('./ec/DesignDirection'));

/** 懒加载时的占位：给高度 + 一句说明，别让那块地方"啪"地缩回去再撑开。 */
function ModeLoading({ label }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: 320,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 16px',
        fontSize: 13,
        fontWeight: 600,
        /* ⚠️ 不许写 '#8a93a0' 这种硬编码回退色 —— design-ratchet 棘轮会判红。
           这些 --sb-* token 都在设计体系里，缺了也不该退回魔数。 */
        color: 'var(--sb-ink-4)',
      }}
    >
      {label}…
    </div>
  );
}

/* ═══ 首页每个板块摆几条精选推荐按钮 ═══════════════════════════════════════════════
   2026-09-19 用户批注 #4：「这里的 skill 他们本身只是个按钮。它是像这样子排列成
   **9 个 skill 的按钮**作为入口。然后鼠标放上去的话，他们就会有下面的这个预览窗出来。」
   —— 所以是 9 条，一行滑过去（不折行）。取数仍是 skillDirectory.featuredSkills
   （精品位优先、不足时按声明顺序补齐），不手写清单。 */
/* 批 J-⑦：9 → 8。用户批注 #3-3 把 flova 的热门 skill 数清楚了：
   「他们是有两行的。他们**上面是5个按钮，下面是三个按钮**。」5 + 3 = 8。
   ⚠️ 配合 SkillEntryRow 的五列栅格：8 条正好落成上 5 下 3；写 9 的话第二行会变成 4 个。 */
/* ═══ 2026-09-19 批 M：**8 → 9**（用户新批注）═══════════════════════════════════════════════
   用户原话（对着 flova 的精选 Skills 两行圈出来）：「像这样去做，**9 个**，大小间距样式什么的，
   都要一致，文案图标按我们的来就行，然后**该空着的就空着先**。」
   —— 批 J-⑦ 当时数的是「上 5 下 3」= 8；这一轮用户明确说 **9**，按 9 走。
   flova 实测两行是 **5 + 4 = 9**（第一行 5 颗、第二行 4 颗，两行同心）。
   ⚠️ 一排仍靠按钮 min-width 200 保证只放得下 5 颗（5×200 + 4×10 = 1040 ≤ 1240 容器；
      6 颗要 1250 就折行）⇒ 9 条自然落成 **5 + 4**，与 flova 同形。
   ⚠️ 「该空着的就空着先」：取数仍只在声明源里做一次，凑不满 9 条就**空着**，不拿别的技能补位。 */
const SKILL_ENTRY_LIMIT = 9;
import { clearLegacyEcommerceDraftState } from './ec/ecommerceDraftStore';
import { useWorksSync } from '../../store/useWorksSync.js';

/**
 * 薯包AI 首页 — 灵图结构精确复刻
 * 白色卡片 → {干净内容区 + 底栏} 平行同级
 */
// 模式卡入口图：直接使用已入库的 .thumbs WebP 预览（约 20-35KB），加载失败回退 PNG 原图。
// width/height 提供内在尺寸（420×360），让浏览器在样式就绪前即可锁定比例，避免占位塌陷。
// 注意：先剥离 ?v= 缓存后缀再匹配，否则 query string 会让缩略解析落空、首屏直接拉源 PNG。
const MODE_CARD_THUMB_PATTERN = /^\/images\/(.+?)\.(?:png|jpe?g)$/i;

function modeCardThumb(src) {
  // 必须先剥掉 ?v= 缓存后缀再匹配：query string 会让以扩展名结尾锚定的缩略解析落空。
  const clean = String(src || '').split('?')[0];
  const match = clean.match(MODE_CARD_THUMB_PATTERN);
  return match ? '/images/.thumbs/' + match[1] + '.webp' : '';
}

function ModeCardImage({ src, alt, priority = false }) {
  const thumb = modeCardThumb(src);
  return (
    <img
      src={thumb || src}
      alt={alt}
      width="420"
      height="360"
      loading="eager"
      decoding="async"
      fetchpriority={priority ? 'high' : 'auto'}
      onError={event => {
        const image = event.currentTarget;
        if (thumb && image.getAttribute('src') === thumb) image.setAttribute('src', src);
      }}
    />
  );
}
export default function HomePage() {
  const { state, dispatch } = useApp();
  const { mode } = state;
  const isXHS = mode === 'content';
  const isVideo = mode === 'video';
  const isVisual = mode === 'visual';
  /* 首页的"精选推荐"按钮行必须跟着**当前板块**走：
     视频模式 → 视频技能；图片模式（视觉创作 / 电商生图 / 小红书图文）→ 图片技能。
     这几个模式都属于图片家族，只有 video 是视频板块。 */
  const skillBoard = isVideo ? 'video' : 'image';
  /* ═══ 2026-09-19 批 I-7（用户批注 #2-6，坐标 52.0% / 79.5%）══════════════════════════════
     原话：「你这里其实应该放的是像他们那样，**各个skill分类的切换区**和更多skill的按钮，
     这个按钮就是通向我们总图片页面和总视频页面的地方啊。」
     照 flova 实测（docs/design/52 §2.1）做那排分类页签，但**不手写清单** ——
     分类本来就声明在技能里（skill.category），所以页签跟着声明源自己走（与总页面同一份口径）。
     ⚠️ 「全部」那一档回到精品位（featuredSkills）：首页的第一眼仍然是"我们推荐什么"，
        切到某一档才展开那一档的全部技能。 */
  const [skillCategory, setSkillCategory] = useState('');
  const boardSkills = useMemo(() => skillsOfBoard(skillBoard), [skillBoard]);
  /* ═══ 2026-09-25 批 BQ：分类页签的顺序改成**与总页面同一份实现**（skillDirectory.categoryOrderOf）═══
     用户原话：「**精品推荐应该在前面呀**，你现在怎么是创意应用在最前面呀？」
     根因：声明文件第一条技能是「创意应用」，按声明顺序出分类就会把它排到精品推荐前面；
     而总页面早就把精品推荐提到最前了（它里面那段批注就是用户为这件事写的）——
     **两处各写一份判据 ⇒ 两处不一致**。现在两处都调 categoryOrderOf，只有一份规则。 */
  const skillCategories = useMemo(() => {
    const counts = new Map();
    for (const skill of boardSkills) {
      if (skill.tier === 'assistant') continue;   /* 辅助能力是被调用的"一步"，不进首页分类 */
      counts.set(skill.category, (counts.get(skill.category) || 0) + 1);
    }
    return categoryOrderOf(boardSkills).map(name => ({ name, count: counts.get(name) || 0 }));
  }, [boardSkills]);
  const rowSkills = useMemo(() => {
    if (!skillCategory) return featuredSkills({ board: skillBoard, limit: SKILL_ENTRY_LIMIT });
    return boardSkills
      .filter(skill => skill.tier !== 'assistant' && skill.category === skillCategory)
      .slice(0, 24);
  }, [skillCategory, boardSkills, skillBoard]);
  /* 换板块时那一档分类可能不存在了 —— 必须清掉，否则会停在一个空列表上。 */
  useEffect(() => { setSkillCategory(''); }, [skillBoard]);
  const [xhsSubMode, setXhsSubMode] = useState('content');
  const [ecStep, setEcStep] = useState(1);  // 三段式：1=参数配置, 2=设计方向确认, 3=无限画布
  const [recoveryCheckpoint, setRecoveryCheckpoint] = useState(null);
  const consumedLaunchRef = useRef('');
  const ecParamsRef = useRef({});  // 第一步收集的参数
  const modeShowcaseRef = useRef(null);

  /* ═══ 一级入口只剩两个：视频生成 / 图片生成 ═══════════════════════════════════
     用户 9-17 拍板「首页入口收敛成两张卡」，43 §3.1 的判据①也是这两张（视频放前面，用户批注 #1）。
     原来那四个模式没有消失，只是**换了入口**：
       · 电商生图 → 技能「电商商品套图」的子页面（/image-creation?id=image.product_suite）
       · 小红书图文 → 技能「小红书图文」的子页面
       · 自由创作 → 技能「自由创作」的子页面
     它们仍然可以从左侧导航与技能库进入，一条能力都没少。
     这两张卡负责的是「我要直接生成点什么」——所以下面就是提示词输入区，再下面是热门技能。 */
  /* ═══ 2026-09-24 批 BB：入口卡上的**说明行删掉**（用户改向，逐字）═════════════════════════════
     用户原话：「我之前让你去抄留影AI 他们的那个**图标和交互的形式**，不是让你在这个标题下面
     **再加一个副标题**呀。你干嘛要加副标题呢？你这样一加就显得**非常的臃肿**呀。
     而且你这样就把下面三张扇形张开的这种卡片给挤压下去了呀。」
     ⇒ 批 AV 加的那句 hint（"一段文字或一张图，出可投放的短片"）**整行删除**：
       用户要的是**图标 + 标题**（留影AI 那套的形），说明文字让卡面变臃肿、还把下面的三张素材卡挤下去。
       卡面回到"图标块 + 标题 + 预览图"，动效一个字没动（图标块铺渐变、标题转品牌色、底部能量条）。 */
  const modeOptions = [
    {
      mode: 'video',
      title: '视频生成',
      src: '/images/home/entry-video.png?v=20260812',
    },
    {
      mode: 'visual',
      title: '图片生成',
      src: '/images/home/entry-visual.png?v=20260812',
    },
  ];

  useEffect(() => {
    clearLegacyEcommerceDraftState();
  }, []);

  /* 作品列表同步走共用 hook（媒体板块页用的是同一份，避免"首页有历史、子页面没有"） */
  useWorksSync();

  // 当结果被清除（新建作品）时，重置步骤
  useEffect(() => {
    if (state.genState === 'idle' && ecStep !== 1) {
      setEcStep(1);
    }
  }, [state.genState]);

  /* ═══ 批 BK：**进首页一律回到视频生成**（用户原话，逐字）══════════════════════════════════════
     「还有就是为什么我现在每次从其他页面返回首页的话，你为什么是默认在这个图片生成这个页面上呢？
       我们现在**只要进入首页，都应该是在视频生成这个页面上**呀。」
     根因：mode 是全局 state，从首页点进图片/电商子页面后它一直停在那一档，返回首页（Home 重新挂载）
     时读到的还是上次那一档。⇒ 首页挂载时把它重置回 video。
     ⚠️ 深链优先：带 creationLaunch.mode 的入口（下面的 effect）在这一条之后执行，会覆盖成目标模式。 */
  useEffect(() => { dispatch({ type: 'SET_MODE', mode: 'video' }); }, [dispatch]);

  useEffect(() => {
    const launch = state.creationLaunch;
    if (!launch?.nonce || consumedLaunchRef.current === launch.nonce) return;
    consumedLaunchRef.current = launch.nonce;
    setEcStep(1);
    setRecoveryCheckpoint(null);
    if (launch.mode && state.mode !== launch.mode) dispatch({ type: 'SET_MODE', mode: launch.mode });
    if (launch.subMode) setXhsSubMode(launch.subMode);
    dispatch({ type: 'SET_CREATION_LAUNCH', launch: null });
    requestAnimationFrame(() => document.getElementById('creation-workbench')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }, [dispatch, state.creationLaunch, state.mode]);

  const restoreCheckpoint = checkpoint => {
    const kind = checkpoint?.project?.kind;
    setRecoveryCheckpoint(checkpoint);
    setEcStep(1);
    if (kind === 'visual') {
      dispatch({ type: 'SET_MODE', mode: 'visual' });
      requestAnimationFrame(() => requestAnimationFrame(() => {
        document.getElementById('creation-workbench')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }));
      return;
    }
    if (kind === 'xiaohongshu' || kind === 'plog') {
      dispatch({ type: 'SET_MODE', mode: 'content' });
      setXhsSubMode(kind === 'plog' ? 'plog' : 'content');
    } else {
      dispatch({ type: 'SET_MODE', mode: 'ecommerce' });
    }
  };

  /* ═══ 2026-09-26 批 BP-3：**「做同款」跳进「图片生成」总页面**（用户原话，逐字）══════════════
     用户原话：「我点击首页下面的案例区我点击做同款，为什么**还是有之前的四个板块**呢，这四个板块
     本来就不该再出现在任何地方了呀，然后**做同款你应该匹配到我们现在的图片生成的区域里面呀**」
     改前：只调 restoreCheckpoint 把首页**旧工作台**滚出来（#creation-workbench）——
     用户看到的就是那套老的四块电商流程，而且人还留在首页。
     改后：案例装进 creationLaunch（跨路由的唯一载体，画布/技能页都在用它），
     然后 NAVIGATE 到 image-creation —— 目标页负责落到对应技能子页面并把素材/提示词预填进去。
     ⚠️ 只预填、不生成：扣费仍要用户再点一次 CTA（charge-requires-confirmation）。 */
  const restoreGalleryCheckpoint = checkpoint => {
    dispatch({
      type: 'SET_CREATION_LAUNCH',
      launch: { kind: 'gallery-remix', nonce: Date.now() + '-remix', checkpoint },
    });
    dispatch({ type: 'NAVIGATE', page: 'image-creation' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: 'var(--sb-surface-page)', overflowX: 'clip', paddingBottom: 80 }}>
      <div className="creative-bg-glow" />

      <div style={{ position: 'relative', zIndex: 10 }}>
        {/* 标题区 */}
        <div className="homepage-shell" style={{ maxWidth: 1240, margin: '0 auto', padding: '24px 20px 0' }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 'var(--sb-radius-pill)', border: '1px solid var(--sb-border-default)', background: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: 900, color: 'var(--sb-ink-2)', boxShadow: 'var(--sb-shadow-sm)' }}>
              <MdAutoAwesome size={16} fill="#FBBF24" color="#F59E0B" />
              薯包 AI · <span style={{ opacity: 0.7 }}>智能视觉内容创作平台</span>
            </span>

            <h1 style={{ fontSize: 48, fontWeight: 900, lineHeight: 1.05, color: 'var(--sb-surface-inverse)', marginTop: 16, marginBottom: 0, letterSpacing: 'normal' }} className="homepage-h1">
              上传创意素材，生成<span className="hero-gradient-text">专业视觉</span>
            </h1>
            <style>{`@media (min-width:640px){.homepage-h1{font-size:48px!important}}@media(min-width:1024px){.homepage-h1{font-size:48px!important}}`}</style>

            <p style={{ margin: '12px auto 0', maxWidth: 860, fontSize: 16, fontWeight: 500, color: 'var(--sb-ink-3)' }} className="homepage-subtitle">
              从一张素材开始，生成能上架、能种草、能传播的专业视觉
            </p>
            <style>{`.homepage-subtitle{line-height:28px}@media(min-width:768px){.homepage-subtitle{font-size:16px!important;line-height:30px!important}}`}</style>
          </div>

          {!state.browserQa && <RecoveryShelf logged={state.logged} onRestore={restoreCheckpoint} />}

          {/* ═══ 顶级入口：视频生成 / 图片生成 两张**总页面**入口卡（2026-09-19 批 G 重做）══════
             ⚠️ 先说清楚这一块**为什么留着**（用户批注 #2-② / #7 的边界）：
               删的是「左边介绍文案 + 右边演示图」那块**案例台**（.visual-skill-stage，已删），
               以及它安排在「精选 skill 按钮」里的预览窗（已搬过去）；
               而用户同一条批注里明确说：「你目前来说就先做视频生成和电商生成的这两个总页面的
               **入口**就可以」—— 所以这两张**入口卡**是用户点名要保留的那两个入口，不是被否掉的那块。
             ⚠️ 本轮把它们**重做**了（用户批注 #7：「你这个就是个 demo 呀……没有任何的设计」）：
               · 拉直：原来 card-1 是 rotate(-6deg)、card-2 是 rotate(6deg)，hover 再转回来 ——
                 与同轮那句「不必向左歪、向右歪就是正常的放」正面冲突，整组旋转全删；
               · 对称：两张等宽等高、同一基线，中间一条 12px 的缝（原来是左右各歪各的、宽窄不一）；
               · 不再互相盖：原来 card-1 有 margin-right: -22px，两张卡是**叠**在一起的；
               · 标题从「压在图上的 10px 小字」改成卡内一行正常的 label + 右侧箭头（可读性）。
             形态：两张卡从下面那张白色工作台卡后面**露出一截**（这是有意的层次，不是穿模）——
             所以 .homepage-mode-showcase 的负 margin 与 .surface-card 的 z-index 是一对，不能只改一边。 */}
          {ecStep !== 2 && <div
            ref={modeShowcaseRef}
            className={`homepage-mode-showcase ${isXHS ? 'is-xhs' : isVideo ? 'is-video' : isVisual ? 'is-visual' : 'is-commerce'}`}
          >
            <div className="homepage-mode-cards" role="tablist" aria-label="创作模式">
              {modeOptions.map((option, index) => {
                const active = option.mode === mode;
                const ModeIcon = option.mode === 'video' ? MdVideoLibrary : option.mode === 'ecommerce' ? MdShoppingCart : option.mode === 'visual' ? MdPalette : MdEdit;
                return (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`homepage-mode-card card-${index + 1}${active ? ' is-active' : ''}`}
                    key={option.mode}
                    onClick={() => {
                      dispatch({ type: 'SET_MODE', mode: option.mode });
                      if (option.mode !== 'ecommerce') setEcStep(1);
                    }}
                  >
                    {/* ═══ 2026-09-24 批 BB：卡面回到**图标块 + 标题 + 预览图**（去掉那句说明）═══════
                        用户原话：「不是让你在这个标题下面再加一个副标题呀……一加就显得非常的臃肿，
                        而且把下面三张扇形张开的卡片给挤压下去了。」（批 AV 那句 hint 已删）
                        动效照留影AI 十二宫格那套（Home.css 里逐值写着）：悬停时图标块铺品牌渐变、
                        图标转白、标题转品牌色、底部 4px 能量条从左到右充满、右下角浮起一层柔光。 */}
                    <span className="homepage-mode-card-title">
                      <span className="homepage-mode-card-glyph" aria-hidden="true"><ModeIcon size={14} /></span>
                      <span className="homepage-mode-card-name">{option.title}</span>
                    </span>
                    <span className="homepage-mode-card-visual">
                      <ModeCardImage src={option.src} alt={`${option.title}案例`} priority={index === 0} />
                    </span>
                    <span className="homepage-mode-card-glow" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </div>}


          {/* 原来这里有一行「或者，直接从技能库挑 + 两个按钮」，9-18 撤掉：
             用户批注 #1——「你为什么要把他们的按钮叠在卡片下面呢？我实在没理解呀，
             你这样的话连看都看不到呀」。技能入口现在**常驻在左侧导航**里（AppSidebar），
             首页不再重复一遍，也就不会再出现「按钮压在卡片下面看不见」的问题。 */}

          {/* ═══ 白色表面卡 / 设计方向确认 ═══
              批 CY-㊴ 之二十二：DesignDirection 与上面两个一样，只在
              mode==='ecommerce' 且 ecStep===2 时才渲染（深链进电商、或"做同款"恢复链路），
              首页默认一次都不渲染 —— 1189 行白白进首屏包。
              改成 lazy 之后**必须**包 Suspense，否则切到这一步时会因为
              没有 fallback 而报错（之二十一就是踩这个坑白屏的）。 */}
          {!isXHS && !isVideo && !isVisual && ecStep === 2 && (
            <Suspense fallback={<ModeLoading label="正在打开设计面板" />}>
              <DesignDirection
                params={ecParamsRef.current}
                onBack={() => setEcStep(1)}
                onGenerated={() => setEcStep(3)}
              />
            </Suspense>
          )}
          <div id="creation-workbench" className="surface-card" style={{
            display: ecStep === 2 ? 'none' : undefined,
            marginTop: 20,
            background: isXHS || isVideo || isVisual ? 'var(--sb-neutral-0)' : 'transparent',
            boxShadow: isXHS || isVideo || isVisual ? undefined : 'none',
          }}>
            <div className="surface-card-inner">
              {isVideo ? <VideoStudioPage embedded inlineResult /> : isXHS ? <Suspense fallback={<ModeLoading label="正在打开图文工作台" />}><XhsContentMode compactMode xhsSubMode={xhsSubMode} setXhsSubMode={setXhsSubMode} recoveryCheckpoint={recoveryCheckpoint} /></Suspense> : !isVisual ? (<Suspense fallback={<ModeLoading label="正在打开电商套图" />}>
                <EcMode ecStep={ecStep} setEcStep={setEcStep}
                  onStepChange={(params) => { ecParamsRef.current = params; }}
                  recoveryCheckpoint={recoveryCheckpoint}
                  initialRecipeId={state.creationLaunch?.recipeId || null} /></Suspense>
              ) : null}
              <div hidden={!isVisual}><VisualCreationMode recoveryCheckpoint={recoveryCheckpoint} initialSkillId={state.creationLaunch?.skillId || null} /></div>
            </div>
          </div>
        </div>

        {/* ═══ 精选推荐（用户 9-17 口径的最终形态）═══
            位置：提示词输入区（上面的工作台卡）**下面**；形态：**一排按钮 + 悬停预览浮层**。
            用户原话：「把它们做成案例给做进去，就是按钮的形式，然后鼠标放到这些按钮上，
            它就会有那种预览框，然后用户点击这些按钮就会直接进入到他们对应的 Skill 页面里面去。」
            ⚠️ 必须**按当前板块过滤**（board）：以前这里把图片与视频混在一条里，
               于是"视频生成"模式下首页出现的是四张**图片**技能卡（实测就是这么错的）。
               图片板块下面只能有图片技能，视频板块下面只能有视频技能。
            数据源与总页面是同一份（skillDirectory.featuredSkills）——首页的"精选推荐"
            就是总页面顶部那一档，两处不许各写一份清单。 */}
        {/* ═══ 批 T（2026-09-21）：这一层与上方创作区之间**留出呼吸**（用户本轮原话）════════════
            原话：「然后上面的标签页……他们都基本上**贴到上面的提示词输入区**了。
            你为什么不保持一些**上下间距**呢？」
            实测（改前）：创作台底沿 y=1088、分类页签顶沿 y=1119 —— 只有 31px，
            而那一行本身高 44，视觉上就是"贴着"。
            ⇒ padding-top 0 → 34：加上 .skill-entry-row 自己的 gap(22)，标签页与按钮两行都松开了。 */}
        <div className="homepage-shell" style={{ maxWidth: 1240, margin: '0 auto', padding: '34px 20px 0' }}>
          <SkillEntryRow
            board={skillBoard}
            limit={SKILL_ENTRY_LIMIT}
            title={'精选推荐 · ' + (skillBoard === 'video' ? '视频生成' : '图片生成')}
            hint={skillBoard === 'video' ? '鼠标放上去看案例，点一下直接开始做视频' : '鼠标放上去看案例，点一下直接开始做图'}
            /* 每条技能补两样预览窗要用的东西（都从声明源取，页面不写死）：
                 · previewAssets：它的案例封面（最多 3 张）——没有案例就是空数组，
                   预览窗里如实显示「案例补充中」；
                 · detail：一句"它是干什么的"，优先用 outcome（能力描述），没有就用 summary。 */
            /* 批 I-7：这排页签取的是**声明源**（skillDirectory.skillsOfBoard），
               与总页面顶部那排分类同一份口径 —— 技能增删/换组，两处一起跟着走。 */
            categories={skillCategories}
            activeCategory={skillCategory}
            onCategory={setSkillCategory}
            /* ⚠️ 换分类时按新列表重取数（原来这两行写死了 featuredSkills，
               切了分类也还是那 9 条）。 */
            skills={rowSkills.map(skill => {
              /* ═══ 批 J（用户批注：箭头从下面那块案例区指到悬停预览窗）═══════════════════════
                 原话：「你这些**预览窗里面**，放入**对应的这种界面**，看我的箭头表示」——
                 箭头起点是页面上那块「左文案 + 右效果图」的案例区（有真实图片），
                 终点是 skill 按钮的悬停预览窗（当时是三个「案例补充中」的空框）。
                 改法：预览窗的图**优先用这条技能自己的案例**；自己没有就**退到本板块的真实案例**
                 （与下面那块案例区**同一个真源** productionCaseById），并**如实标注**它来自本板块 ——
                 绝不把别的技能的案例冒充成这条技能的结果（本站铁律：生成结果不许伪造）。 */
              const own = (Array.isArray(skill.cases) ? skill.cases : [])
                .map(item => ({ src: item.cover || '', label: item.title || '' }))
                .filter(item => item.src);
              /* ⚠️ 视频板块的案例**不是** catalog 里的某个 case id（'video' 会抛
                 「未知 · production case: video」并把整页打崩 —— 实测踩过），
                 它是那张工作台截图，与 CreationShowcase 的 VideoPreview **同一份素材**。
                 图片板块走真源 productCaseById，档位与案例区（套图 / 上身）保持一致。 */
              const boardAssets = skill.board === 'video'
                ? [{ src: '/images/home/workspace-video-v2.png', label: '视频工作台案例' }]
                : (productionCaseById(skill.pipeline === 'anything_tryon' ? 'tryon-angles' : 'product-suite').assets || [])
                  .map(item => ({ src: item.src || '', label: item.label || '' }))
                  .filter(item => item.src);
              const shown = own.length ? own : boardAssets;
              return {
                ...skill,
                detail: skill.outcome || '',
                previewAssets: shown.slice(0, 3),
                previewFromBoard: !own.length && boardAssets.length > 0,
              };
            })}
            moreHref={hubPath(skillBoard)}
            moreLabel={'查看全部' + (skillBoard === 'video' ? '视频' : '图片') + '技能'}
            onOpenSkill={skill => {
              const page = skill.board === 'video' ? 'video-creation' : 'image-creation';
              /* 先把地址换成深链，再切页面（刷新/分享/返回键都能落到同一处） */
              window.history.pushState({}, '', skillPath(skill));
              dispatch({ type: 'NAVIGATE', page });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </div>

        {/* ═══ 批 T（2026-09-21）：首页这一整块「案例表达区」**删除**（用户本轮原话，逐字）══════
            原话：「然后在下面这块：视频生成案例 / 从参考素材到可确认的成片方案 / 一句话描述镜头目标，
            系统先整理素材、节奏和交付规格，再进入生成。 / 视频创作 / 真实生成结果 / 案例仅用于展示能力 /
            素材分析 / 镜头方案 / 确认生成 这块**整体删掉，不要放这里**。」
            为什么删了不算丢功能：批 J-⑨ 当初把它搬回首页，是为了落实用户上一轮那句
            「你可以直接把**那一整个的板块拿过来，放到这下面的预览区里面去**呀」——
            落点是「**skill 按钮的悬停预览窗**」，而那一份早就搬进去了（SkillEntryRow 的
            .skill-preview：左介绍 + 右案例图，用的就是同一份素材）。首页再摆一份 =
            同一句话在一屏里说两遍，而且把真实案例网格（GallerySection）推得很远。
            ⚠️ 组件本身**没有删**：小红书图文模式（XhsContentMode）仍在用它，那边是它的正确位置。 */}

        {/* 案例发现区：真实案例网格 */}
        <GallerySection maxItems={48} onUseSameStyle={restoreGalleryCheckpoint} />
      </div>
      <Footer />
    </div>
  );
}