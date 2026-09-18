import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Play, Sparkles } from 'lucide-react';
import { availabilityLabel, coverOf } from '../../skills/skillDirectory.js';
import './SkillEntryRow.css';

/* ═══ SkillEntryRow：精选技能**按钮**行 + 悬停预览窗（2026-09-19 用户批注 #3 / #4）═══════
   用户原话（连着三条，缺一条都做不对）：
     · 「把他们做成像那家竞品一样。https://flova.tv/zh-CN/ 他们是按钮的形式去展示。
        然后鼠标放上去这些按钮，他们会有这个试一试的按钮出来。」
     · 「这里的 skill 他们本身只是个按钮。它是像这样子排列成 9 个 skill 的按钮作为入口。
        然后鼠标放上去的话，他们就会有下面的这个预览窗出来。」
     · 「预览窗里面你就直接拿我们现成的、我刚刚跟你说的左边是介绍、右边是图片的那个样式
        过来用就好了。过来这里当成预览窗里面的形式就可以了。」

   所以形态 = **flova 的机制** + **我们自己的内容版式**：
     ① 按钮：图标磁贴 + 名字，圆角矩形，横向排列（flova 实测：按钮高 60、圆角 14、
        图标 44×44、标题 14/700、间距 10；悬停时按钮本体**零位移**，只换边框/底色）；
     ② 「试一试」长在**按钮自己**的覆盖层上（flova 实测如此，不在浮窗里）；
     ③ 悬停 → 按钮**正下方**浮出预览窗（flova 实测：fixed + 定位到按钮下方、水平居中、间隙 10；
        移开有 ~300ms 延迟才关，不是立刻消失）；
     ④ 预览窗内容 = 我们那份「左介绍 + 右案例图」的版式（原本是首页的案例台，
        用户批注 #2-② 要求把它从首页删掉、搬到这里当预览窗）。

   ⚠️ 数据源与总页面网格、左侧栏完全同一份（featuredSkills / skillPath），三处不许各写一套。
   ⚠️ 没有案例的技能照旧出现在这里（预览里如实写「案例补充中」）——
      否则视频板块在用户跑出案例之前会一条入口都没有。 */
const CLOSE_DELAY_MS = 300;   /* flova 实测：移开后不立刻消失（Radix HoverCard 的 closeDelay 语义） */

export default function SkillEntryRow({
  board = 'image',
  title = '精选推荐',
  hint = '鼠标放上去看案例，点一下直接开始',
  skills = [],
  onOpenSkill = null,
  moreHref = '',
  moreLabel = '',
  /* ═══ 分类切换区（2026-09-19 批 I-7，用户批注 #2-6）═══════════════════════════════════
     原话：「你这里其实应该放的是像他们那样，**各个skill分类的切换区**和更多skill的按钮，
     这个按钮就是通向我们总图片页面和总视频页面的地方啊。」
     尺寸照 flova 实测（docs/design/52 §2.1）：整行高 44、文字 14px/600、
     两档之间是一条 1px 竖线（左右各 20px 边距）、选中档走品牌色。
     ⚠️ categories 由调用方从**声明源**算好传进来（首页传 skillDirectory.skillsOfBoard），
        这一层不自己造清单 —— 与总页面顶部那排分类同一份口径。 */
  categories = [],
  activeCategory = '',
  onCategory = null,
}) {
  const [activeId, setActiveId] = useState('');
  const [anchor, setAnchor] = useState(null);
  const closeTimer = useRef(null);
  const activeRef = useRef(null);
  const list = Array.isArray(skills) ? skills : [];
  const active = list.find(skill => skill.id === activeId) || null;

  const cancelClose = useCallback(() => {
    if (closeTimer.current) { globalThis.clearTimeout(closeTimer.current); closeTimer.current = null; }
  }, []);

  /* 定位：预览窗浮在**按钮正下方、水平居中**（flova 同款，间隙 10） */
  const place = useCallback(node => {
    const el = node || activeRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.min(600, globalThis.innerWidth - 32);
    const left = Math.max(16, Math.min(rect.left + rect.width / 2 - width / 2, globalThis.innerWidth - width - 16));
    /* ⚠️ 下方放不下就翻到按钮**上面**（预览窗约 200 高 + 页脚遮不住）。
       判据：下方剩余空间 < 240 且上方空间更大 —— 不翻的话靠页面底部的按钮会把浮窗压出视口。 */
    const estimated = 220;
    const below = globalThis.innerHeight - rect.bottom - 10;
    const above = rect.top - 10;
    const flip = below < estimated && above > below;
    setAnchor({
      left,
      top: flip ? undefined : rect.bottom + 10,
      bottom: flip ? globalThis.innerHeight - rect.top + 10 : undefined,
      width,
    });
  }, []);

  useEffect(() => {
    if (!activeId) return undefined;
    const onViewport = () => place();
    globalThis.addEventListener('resize', onViewport);
    globalThis.addEventListener('scroll', onViewport, true);
    const onKey = event => { if (event.key === 'Escape') setActiveId(''); };
    globalThis.addEventListener('keydown', onKey);
    return () => {
      globalThis.removeEventListener('resize', onViewport);
      globalThis.removeEventListener('scroll', onViewport, true);
      globalThis.removeEventListener('keydown', onKey);
    };
  }, [activeId, place]);

  useEffect(() => () => cancelClose(), [cancelClose]);
  if (!list.length) return null;

  const openPreview = (node, skill) => {
    cancelClose();
    activeRef.current = node;
    setActiveId(skill.id);
    place(node);
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = globalThis.setTimeout(() => setActiveId(''), CLOSE_DELAY_MS);
  };

  return (
    <section className="skill-entry-row" data-board={board} aria-label={title}>
      {/* ═══ 2026-09-19 批 J-⑧：分类页签 + 「更多 skill」在**同一行的两头**（用户批注 #4-3）═══
          原话：「你这个按钮肯定也不是放这里的呀，你没有看明白他们是怎么做的吗？
          flova 他们是放在 **skill 的分类这个地方的右边有个更多 skill 的按钮**。」
          改前：它单独占一行（.skill-entry-head），分类页签在它下面一行 —— 两行各说各的；
          而 flova 是**一行**：左边一排分类、右边一个「更多 skill」。
          ⚠️ 原来的 .skill-entry-head 因此**整块删掉**：标题与说明早就删了，
             它最后剩下的那件事就是把「更多」推到右边 —— 那件事现在由这一行自己做。 */}
      <header className="skill-entry-nav">
        {/* ═══ 2026-09-19 批 I-④（用户批注 #2-4 / #2-5）═══════════════════════════════════════
            原话：「然后这行字都不要，不能给用户看，**这些是给我交待的，不是给用户看的呀**。」
            以及：「这里的这行字不要。」
            删掉的是标题下面那行说明（hint）。它写的是**我们内部的交互说明**
            （"鼠标放上去看案例，点一下直接开始做图/做视频"）—— 那是写给我自己看的注解，
            不是给用户的产品文案。用户看到的是"这网站还要教我鼠标怎么用"。
            ⚠️ hint 这个 prop 保留但**不再渲染**：调用方还在传，删 prop 会让 useSkillEntryRow
               之类的调用点报 lint；下次清理时一起删。 */}
        {/* 分类切换区：照 flova 实测那排页签（不手写清单，档位来自声明源） */}
        {categories.length > 0 && (
          <div className="skill-entry-categories" role="tablist" aria-label={title + ' 技能分类'}>
            <button
              type="button"
              role="tab"
              aria-selected={!activeCategory}
              className={!activeCategory ? 'is-active' : ''}
              onClick={() => onCategory?.('')}
            >全部</button>
            {categories.map(item => (
              <button
                key={item.name}
                type="button"
                role="tab"
                aria-selected={activeCategory === item.name}
                className={activeCategory === item.name ? 'is-active' : ''}
                onClick={() => onCategory?.(item.name)}
              >{item.name}</button>
            ))}
          </div>
        )}
        {/* 更多 skill：就在分类页签的**右边**（用户批注 #4-3，flova 的做法） */}
        {moreHref && <a className="skill-entry-more" href={moreHref}>{moreLabel || '更多 skill'}<ArrowRight size={14} /></a>}
      </header>

      <div className="skill-entry-buttons">
        {list.map(skill => {
          const preview = coverOf(skill);
          const flag = availabilityLabel(skill);
          const isOpen = activeId === skill.id;
          return (
            <button
              key={skill.id}
              type="button"
              ref={node => { if (isOpen) activeRef.current = node; }}
              className={'skill-entry-button' + (isOpen ? ' is-open' : '')}
              aria-label={skill.name + ' · 试一试'}
              onMouseEnter={event => openPreview(event.currentTarget, skill)}
              onMouseLeave={scheduleClose}
              onFocus={event => openPreview(event.currentTarget, skill)}
              onBlur={scheduleClose}
              onClick={() => onOpenSkill?.(skill)}
            >
              <span className="skill-entry-glyph" aria-hidden="true">
                {preview.cover
                  ? <img src={preview.cover} alt="" loading="lazy" />
                  : <Play size={16} />}
              </span>
              <span className="skill-entry-name">{skill.name}</span>
              {flag && <span className="skill-entry-flag">{flag}</span>}
              {/* 遮罩（批 J-⑦）：覆盖整块按钮的毛玻璃层，试一试居中落在它上面。
                  ⚠️ aria-hidden：按钮自己的 aria-label 里已经有「· 试一试」，
                     这里再读一遍就是同一句话说两次。 */}
              <span className="skill-entry-try" aria-hidden="true">试一试<ArrowRight size={14} /></span>
            </button>
          );
        })}
      </div>

      {/* ═══ 2026-09-19 批 I-④（用户批注 #2-4，坐标 33.4% / 94.4%）═══════════════════════
          这一整段（.skill-entry-tip）**整块删除**。用户原话同上：
          「然后这行字都不要，不能给用户看，这些是给我交待的，不是给用户看的呀。」
          它同时承担了两个不该给用户看的角色：
            ① 默认文案是一句操作说明（"鼠标放上去看案例预览，点一下直接开始"）；
            ② 悬停后会变成「技能名 · summary」——但 summary 已经在上面的预览窗里出现，
               页面上再挂一条灰字只是噪声。
          触屏可达性没有因此丢：按钮本身就是入口（hover 从来只是桌面上的加速器）。 */}


      {active && anchor && createPortal(
        <div
          className="skill-preview"
          style={{ left: anchor.left, top: anchor.top, bottom: anchor.bottom, width: anchor.width }}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          role="dialog"
          aria-label={active.name + ' 预览'}
        >
          <div className="skill-preview-copy">
            <span className="skill-preview-eyebrow"><Sparkles size={13} />{active.name}</span>
            <strong>{active.summary}</strong>
            <p>{active.detail || active.outcome || '点「试一试」进入它自己的工作台，参数已经替你调好。'}</p>
            <span className="skill-preview-cta">进入「{active.name}」工作台<ArrowRight size={14} /></span>
            {/* 批 J：图来自本板块真源时**如实说一句**（不冒充成这条技能的结果）。
                ⚠️ 写在文案栏**里面** —— 放到两栏之间会把 grid 多撑出一行、右栏被挤下去。 */}
            {active.previewFromBoard && <p className="skill-preview-note">本板块真实案例 · 这条技能自己的案例还在补充</p>}
          </div>
          <div className="skill-preview-art" aria-hidden="true">
            {/* 没有案例时给**三格**占位（不是一格）—— 一格会让浮窗右栏塌成一条，
                三格才维持住"左介绍 + 右案例"的版式；每格都如实写「案例补充中」。 */}
            {(active.previewAssets && active.previewAssets.length
              ? active.previewAssets
              : [{ label: '案例补充中' }, { label: '案例补充中' }, { label: '案例补充中' }])
              .slice(0, 3)
              .map((item, index) => (
                <span className={'skill-preview-shot is-' + index} key={(item.src || item.label) + index}>
                  {item.src
                    ? <img src={item.src} alt="" loading="lazy" />
                    : <span className="skill-preview-blank"><Play size={14} />案例补充中</span>}
                </span>
              ))}
          </div>
        </div>,
        document.body,
      )}
    </section>
  );
}
