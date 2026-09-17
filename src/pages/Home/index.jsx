import React, { useState, useRef, useEffect } from 'react';
import { MdAutoAwesome, MdEdit, MdPalette, MdShoppingCart, MdVideoLibrary } from 'react-icons/md';
import { useApp } from '../../store/AppContext';
import XhsContentMode from './XhsContentMode';
import EcMode from './EcMode';
import VideoStudioPage from '../VideoStudio';
import VisualCreationMode from './VisualCreationMode';
import DesignDirection from './ec/DesignDirection';
import GallerySection from './GallerySection';
import Footer from '../../components/layout/Footer';
import RecoveryShelf from './ec/RecoveryShelf';
import SkillEntryRow from '../../components/media/SkillEntryRow.jsx';
import { featuredSkills, hubPath, skillPath } from '../../skills/skillDirectory.js';

/* 首页每个板块摆几条精选推荐按钮。6 条是竞品首页那一排的量级：
   再多就要换行成两排，反而不像"挑一个就开始"；
   剩下的全部在总页面里（按钮行右侧那个「查看全部」）。 */
const SKILL_ENTRY_LIMIT = 6;
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

  const restoreGalleryCheckpoint = checkpoint => {
    restoreCheckpoint(checkpoint);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.getElementById('creation-workbench')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }));
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

          {/* ═══ 主模式切换：卡片本身就是工作台入口 ═══ */}
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
                    <span className="homepage-mode-card-title"><ModeIcon size={16} />{option.title}</span>
                    <span className="homepage-mode-card-visual">
                      <ModeCardImage src={option.src} alt={`${option.title}案例`} priority={index === 0} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>}


          {/* 原来这里有一行「或者，直接从技能库挑 + 两个按钮」，9-18 撤掉：
             用户批注 #1——「你为什么要把他们的按钮叠在卡片下面呢？我实在没理解呀，
             你这样的话连看都看不到呀」。技能入口现在**常驻在左侧导航**里（AppSidebar），
             首页不再重复一遍，也就不会再出现「按钮压在卡片下面看不见」的问题。 */}

          {/* ═══ 白色表面卡 / 设计方向确认 ═══ */}
          {!isXHS && !isVideo && !isVisual && ecStep === 2 && (
            <DesignDirection
              params={ecParamsRef.current}
              onBack={() => setEcStep(1)}
              onGenerated={() => setEcStep(3)}
            />
          )}
          <div id="creation-workbench" className="surface-card" style={{
            display: ecStep === 2 ? 'none' : undefined,
            marginTop: 20,
            background: isXHS || isVideo || isVisual ? 'var(--sb-neutral-0)' : 'transparent',
            boxShadow: isXHS || isVideo || isVisual ? undefined : 'none',
          }}>
            <div className="surface-card-inner">
              {isVideo ? <VideoStudioPage embedded inlineResult /> : isXHS ? <XhsContentMode compactMode xhsSubMode={xhsSubMode} setXhsSubMode={setXhsSubMode} recoveryCheckpoint={recoveryCheckpoint} /> : !isVisual ? (
                <EcMode ecStep={ecStep} setEcStep={setEcStep}
                  onStepChange={(params) => { ecParamsRef.current = params; }}
                  recoveryCheckpoint={recoveryCheckpoint}
                  initialRecipeId={state.creationLaunch?.recipeId || null} />
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
        <div className="homepage-shell" style={{ maxWidth: 1240, margin: '0 auto', padding: '0 20px' }}>
          <SkillEntryRow
            board={skillBoard}
            limit={SKILL_ENTRY_LIMIT}
            title={'精选推荐 · ' + (skillBoard === 'video' ? '视频生成' : '图片生成')}
            hint={skillBoard === 'video' ? '鼠标放上去看案例，点一下直接开始做视频' : '鼠标放上去看案例，点一下直接开始做图'}
            skills={featuredSkills({ board: skillBoard, limit: SKILL_ENTRY_LIMIT })}
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

        {/* 案例发现区 */}
        <GallerySection maxItems={48} onUseSameStyle={restoreGalleryCheckpoint} />
      </div>
      <Footer />
    </div>
  );
}