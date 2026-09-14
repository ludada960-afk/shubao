import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../../store/AppContext';
import { IMAGES } from '../../constants/images';
import { CharImg } from '../../components/ui/index';
import Footer from '../../components/layout/Footer';
import { generatePlogContent, saveWork, uploadEcommerceAssets } from '../../services/api';
import { handleGenerationAccessError } from '../../utils/generationAccess.js';
import {
  acceptAuthoritativeContentCompletion,
  buildContentPendingAction,
  createContentDraftId,
} from '../contentGenerationModel.js';
import SupplementAssetDeck from '../Home/ec/components/SupplementAssetDeck.jsx';
import ProductProfilePicker, { applyProductProfileFactsToPlog, useProductProfiles } from '../Home/ec/crossModeProductProfile.jsx';

/* ═══════════════════════════════════════════════════════════════════════════
   硬编码例外说明（本文件唯一一处，逐条声明）

   下列硬编码**不是 app chrome，而是「被渲染出来的作品本身」**：
     · PLOG_STYLES 的 color / accent（第 18–21 行）—— 用户所选「色调风格」的**渲染色值**，
       会作为参数发给后端参与出图（generatePlogContent），改 token 会导致出图结果改变，
       属于**业务内容**而非界面样式；
     · Layout* 系列（碎片风/拍立得/电影感/手账/杂志）里的 #fffdf7 / #111 / #F5F0E8 / #fffde7 等
       —— 这些是**作品预览画布**（模拟拍立得白边、电影宽银幕黑底、手账纸纹、便签纸），
       与作品最终产物一一对应，同样不能 token 化，否则预览与实际出图不一致。

   除上述之外，本文件的界面 chrome（底色/卡片/按钮/输入/文案/描边/圆角/间距）
   已 100% 走 --sb-* token。 */
// ── 风格包 ──
const PLOG_STYLES = {
  'ins-minimal': { name: 'Ins 极简风', emoji: '🤍', desc: '低饱和·干净通透·大面积留白', color: '#E8E8E8', accent: '#555' },
  'korean-clear': { name: '韩系清透', emoji: '💎', desc: '冷调清透·亮白·水光感', color: '#DCE8F5', accent: '#4A6FA5' },
  'japanese-cream': { name: '日系奶油', emoji: '🍦', desc: '暖黄调·柔光·奶油质感', color: '#F5E6D0', accent: '#B8956A' },
  'film-vintage': { name: '胶片复古', emoji: '🎞️', desc: '褪色·颗粒感·暖橙调', color: '#E8D5C0', accent: '#8B6F47' },
};

// ── 排版模板（与后端同步） ──
const LAYOUT_TEMPLATES = {
  'casual': { name: '碎片风', emoji: '📸', desc: '随意随手拍·白边·轻微旋转', tag: '经典' },
  'polaroid': { name: '拍立得风', emoji: '📷', desc: '宝丽来白边·手写标签·微微褪色', tag: '🔥热门' },
  'cinematic': { name: '电影感', emoji: '🎬', desc: '宽幅裁剪·字幕条·故事板', tag: '🔥热门' },
  'journal': { name: '手账风', emoji: '📔', desc: '纸张纹理·贴纸·虚线·便签', tag: '' },
  'magazine': { name: '杂志风', emoji: '✨', desc: '极简留白·大标题·高级感', tag: '' },
};

// ── 封面变体（与后端同步） ──
const COVER_VARIANTS = {
  'collage': { name: '拼贴封面', desc: '多图拼贴+大标题', icon: '🖼️' },
  'big-text': { name: '大字封面', desc: '纯色底+大字号标题', icon: '🔤' },
  'full-image': { name: '全图封面', desc: '单张大图+标题叠加', icon: '🌅' },
  'polaroid-cover': { name: '拍立得封面', desc: '单张拍立得+手写标题', icon: '📸' },
};

const EXAMPLE_PROMPTS = [
  '独居日常｜周末宅家看书喝咖啡',
  '城市漫游｜扫街偶遇一家温暖小店',
  '旅行碎片｜在大理古城发呆的下午',
  '咖啡下午茶｜窗边的阳光和拿铁',
  '日落的颜色｜今天的天空也很努力',
];

// ── 每种排版的电影感字幕库 ──
const CINEMATIC_SUBTITLES = [
  '有些日子，适合慢慢过。',
  '城市很大，我的世界很小。',
  '光穿过树叶的样子，像电影。',
  '今天的云，是橘子味的。',
  '路过很多风景，还是喜欢这里。',
  '风很温柔，日子也是。',
  '拍下一瞬间，留住永恒。',
  '平凡的日子，闪着光。',
  '晚安，今天的我。',
];

// ── 手账风的贴纸元素 ──
const JOURNAL_STICKERS = ['🌸', '⭐', '✿', '♡', '✧', '☕', '📎', '🧷', '✂️', '📌', '💫', '🕊️'];

export default function PlogPage() {
  const { state, dispatch, refreshBillingBalance } = useApp();
  const ownerEmail = String(state.email || state.phone || '').trim().toLowerCase();
  const [text, setText] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('ins-minimal');
  const [selectedLayout, setSelectedLayout] = useState('casual');
  const [selectedCover, setSelectedCover] = useState('collage');
  const [styleImages, setStyleImages] = useState([]);
  const [sourceImages, setSourceImages] = useState([]);
  const [genState, setGenState] = useState('idle');
  const [results, setResults] = useState(null);
  const [err, setErr] = useState('');
  const [lightbox, setLightbox] = useState(null);
  const [lightboxList, setLightboxList] = useState([]);
  const [lightboxIdx, setLightboxIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState({ current: 0, total: 9 });
  const timerRef = useRef(null);
  const [plogDraftId, setPlogDraftId] = useState(() => createContentDraftId({ ownerEmail, source: 'plog' }));
  const [referenceAssetIds, setReferenceAssetIds] = useState([]);
  const [sourceAssetIds, setSourceAssetIds] = useState([]);

  // 跨 mode 商品档案 (P2 续命 4c183cd4): 同一份 product_profile 覆盖 Plog 模式,
  // 选中档案后把 name + 卖点 + 规格 + 材质/颜色 拼到 text 尾部, 不再要求用户在 Plog
  // 模式下重新输入商品事实。
  const plogProfile = useProductProfiles({ status: 'active', limit: 50, autoLoad: Boolean(state.logged) });
  const [activePlogProfileId, setActivePlogProfileId] = useState('');

  useEffect(() => {
    setPlogDraftId(createContentDraftId({ ownerEmail, source: 'plog' }));
    setText('');
    setSelectedStyle('ins-minimal');
    setSelectedLayout('casual');
    setSelectedCover('collage');
    setReferenceAssetIds([]);
    setSourceAssetIds([]);
    setStyleImages([]);
    setSourceImages([]);
  }, [ownerEmail]);

  useEffect(() => {
    if (genState === 'loading') {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [genState]);

  // ── 生成 ──
  const handleGenerate = async () => {
    if (!text.trim()) return;
    const usePreview = !state.logged;
    let ownedReferenceAssetIds = [...referenceAssetIds, ...sourceAssetIds];
    let ownedStyleAssetIds = referenceAssetIds;
    let ownedSourceAssetIds = sourceAssetIds;
    setErr('');
    setGenState('loading');
    setResults(null);
    setProgress({ current: 0, total: 9 });
    dispatch({ type: 'START_GEN' });
    try {
      if (!usePreview && (styleImages.length || sourceImages.length)) {
        const [styleUploads, sourceUploads] = await Promise.all([
          styleImages.length ? uploadEcommerceAssets(styleImages, 'style') : Promise.resolve([]),
          sourceImages.length ? uploadEcommerceAssets(sourceImages, 'reference') : Promise.resolve([]),
        ]);
        ownedStyleAssetIds = styleUploads.map(asset => asset.assetId);
        ownedSourceAssetIds = sourceUploads.map(asset => asset.assetId);
        ownedReferenceAssetIds = [...ownedStyleAssetIds, ...ownedSourceAssetIds];
        setReferenceAssetIds(ownedStyleAssetIds);
        setSourceAssetIds(ownedSourceAssetIds);
      }
      const result = await generatePlogContent({
        text: text.trim(),
        style: selectedStyle,
        layout: selectedLayout,
        coverVariant: selectedCover,
        referenceAssets: {
          style: usePreview ? styleImages : ownedStyleAssetIds,
          source: usePreview ? sourceImages : ownedSourceAssetIds,
        },
        referenceAssetIds: ownedReferenceAssetIds,
        preview: usePreview,
      }, {
        onProgress: d => {
          const stageMap = { scene: 1, lens: 1, tone: 1, generating: 2 };
          dispatch({ type: 'SET_STAGE', stage: stageMap[d.step] || 1 });
          if (d.current !== undefined) setProgress({ current: d.current, total: d.total || 9 });
        },
      });
      const accepted = acceptAuthoritativeContentCompletion(result);
      if (!accepted) throw new Error('服务端尚未完成稳定作品交付，请稍后重试');
      const plogCopy = Array.isArray(accepted.result.copyLines) ? accepted.result.copyLines.join('\n') : accepted.result.copyLines;
      const normalizedResult = {
        ...accepted.result,
        _inputText: text,
        title: accepted.result.title || accepted.result.caption || text.trim().slice(0, 42),
        body_text: accepted.result.body_text || plogCopy || accepted.result.caption || '',
        hashtags: accepted.result.hashtags || [],
      };
      setResults(normalizedResult);
      setGenState('done');
      dispatch({ type: 'CLOSE_RESULT' });
      if (state.logged) {
        await saveWork({
          ...normalizedResult,
          _plogResult: true,
          _saveKey: `plog-${Date.now()}`,
          images: { cover: accepted.result.cover_url },
        }, state.phone).catch(() => null);
        await refreshBillingBalance().catch(() => undefined);
        dispatch({ type: 'CLEAR_PAYWALL' });
      }
    } catch (e) {
      const accessResult = handleGenerationAccessError(e, dispatch, {
        source: 'plog',
        currency: 'ec_points',
        draftId: plogDraftId,
        action: buildContentPendingAction({
          type: 'plog',
          draftId: plogDraftId,
          referenceAssetIds: ownedReferenceAssetIds,
          billingCurrency: 'ec_points',
        }),
      });
      setErr(accessResult ? '' : (e.message || '生成失败'));
      setGenState('idle');
      dispatch({ type: 'CLOSE_RESULT' });
    }
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const addRoleFiles = useCallback((role, files) => {
    const selected = Array.from(files || []).filter(file => file?.type?.startsWith('image/'));
    const max = role === 'style' ? 3 : 6;
    const setter = role === 'style' ? setStyleImages : setSourceImages;
    const resetIds = role === 'style' ? setReferenceAssetIds : setSourceAssetIds;
    resetIds([]);
    selected.slice(0, max).forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        setErr('图片太大，请选择5MB以内的图片');
        return;
      }
      const reader = new FileReader();
      reader.onload = event => setter(current => current.length >= max ? current : [...current, event.target.result]);
      reader.readAsDataURL(file);
    });
  }, []);

  const removeRoleFile = useCallback((role, index) => {
    (role === 'style' ? setStyleImages : setSourceImages)(current => current.filter((_, itemIndex) => itemIndex !== index));
    (role === 'style' ? setReferenceAssetIds : setSourceAssetIds)([]);
  }, []);

  const allImages = results ? [
    ...(results.cover_url ? [{ label: '封面', url: results.cover_url, isCover: true }] : []),
    ...(results.image_urls || []).map((url, i) => ({ label: `图${i + 1}`, url, isCover: false }))
  ] : [];

  // ══════════════════════════════════════════
  //  每种排版的 CSS 渲染组件
  // ══════════════════════════════════════════

  /** 碎片风：3列网格+旋转+白边 */
  const LayoutCasual = ({ images, onOpen }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sb-space-1)' }}>
      {images.map((item, i) => (
        /* D11：裸 div onClick → button（可键盘 Tab 聚焦 + Enter 打开）。
           注意：本元素的 #fff / rgba 属**作品预览画布**（拍立得白边），见文件头例外说明。 */
        <button key={i} type="button" className="sb-focusable" aria-label={`查看第 ${i + 1} 张`} onClick={() => onOpen(i)}
          style={{
            aspectRatio: '3/4', borderRadius: 'var(--sb-radius-sm)', overflow: 'hidden', cursor: 'pointer',
            background: '#fff', position: 'relative', border: '1px solid rgba(12,10,9,0.06)', padding: 0,
            transform: `rotate(${i % 2 === 0 ? -0.5 : 0.5}deg)`,
            boxShadow: '0 1px 3px rgba(12,10,9,0.08)',
            outlineOffset: 3,
          }}>
          <img src={item.url} alt={item.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} width="160" height="200" loading="lazy" decoding="async" fetchpriority="auto" />
        </button>
      ))}
    </div>
  );

  /** 拍立得风：白边+旋转+阴影 */
  const LayoutPolaroid = ({ images, onOpen }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sb-space-2)' }}>
      {images.map((item, i) => {
        const rot = [-2, 1.5, -1, 2.5, -1.5, 1, -2.5, 2, -1][i] || 0;
        return (
          /* D11：裸 div onClick → button（可 Tab 聚焦 + Enter 打开）。
             内联重置 button 的 UA 默认外观（背景/边框/内边距/字体/对齐），外观零变化。 */
          <button key={i} type="button" className="sb-focusable" aria-label={`查看第 ${i + 1} 张`} onClick={() => onOpen(i)}
            style={{
              cursor: 'pointer',
              transform: `rotate(${rot}deg)`,
              transition: 'transform 0.2s',
              filter: 'sepia(0.05)',
              appearance: 'none', background: 'none', border: 'none', padding: 0, margin: 0,
              font: 'inherit', color: 'inherit', textAlign: 'inherit', display: 'block',
            }}>
            <div style={{
              background: '#fffdf7', padding: '6px 6px 22px 6px', borderRadius: 'var(--sb-radius-xs)',
              boxShadow: '0 3px 10px rgba(12,10,9,0.12)',
            }}>
              <div style={{ aspectRatio: '3/4', overflow: 'hidden', background: '#f0ebe0' }}>
                <img src={item.url} alt={item.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} width="160" height="200" loading="lazy" decoding="async" fetchpriority="auto" />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );

  /** 电影感：黑边+字幕条 */
  const LayoutCinematic = ({ images, onOpen }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sb-space-3)', background: '#111', borderRadius: 'var(--sb-radius-lg)', padding: 14 }}>
      {images.map((item, i) => (
        <button key={i} type="button" className="sb-focusable" aria-label={`查看第 ${i + 1} 张`} onClick={() => onOpen(i)}
          style={{
            cursor: 'pointer', appearance: 'none', background: 'none', border: 'none', padding: 0, margin: 0,
            font: 'inherit', color: 'inherit', textAlign: 'inherit', display: 'block', width: '100%',
          }}>
          {/* 宽幅 + 上下黑边 */}
          <div style={{
            background: '#000', borderRadius: 'var(--sb-radius-xs)', overflow: 'hidden', padding: '0 0',
            position: 'relative',
          }}>
            <div style={{ aspectRatio: '3/4', maxHeight: 260, margin: '0 auto', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={item.url} alt={item.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} width="160" height="200" loading="lazy" decoding="async" fetchpriority="auto" />
            </div>
            {/* 底部字幕条 */}
            <div style={{
              position: 'absolute', bottom: 8, left: 0, right: 0,
              textAlign: 'center', padding: '4px 16px',
            }}>
              <div style={{
                display: 'inline-block', background: 'rgba(12,10,9,0.75)', color: '#fff',
                fontSize: 'var(--sb-text-2xs)', padding: '3px 14px', borderRadius: 'var(--sb-radius-xs)',
                fontStyle: 'italic', letterSpacing: 0.5, fontFamily: 'serif',
              }}>
                {CINEMATIC_SUBTITLES[i % CINEMATIC_SUBTITLES.length]}
              </div>
            </div>
          </div>
          {/* 页码 */}
          <div style={{ textAlign: 'center', fontSize: 'var(--sb-text-2xs)', color: '#555', marginTop: 4, letterSpacing: 2 }}>
            {String(i + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
          </div>
        </button>
      ))}
    </div>
  );

  /** 手账风：纸张纹理+贴纸+撕纸边 */
  const LayoutJournal = ({ images, onOpen }) => {
    const stickers = JOURNAL_STICKERS;
    return (
      <div style={{
        background: '#F5F0E8', borderRadius: 'var(--sb-radius-lg)', padding: 16,
        position: 'relative', boxShadow: 'inset 0 0 30px rgba(12,10,9,0.03)',
      }}>
        {/* 纸张纹理 SVG */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sb-space-2)', position: 'relative', zIndex: 1 }}>
          {images.map((item, i) => {
            const rot = [-1, 1.2, -0.8, 1.5, -1.2, 0.8, -1.8, 1, -0.5][i] || 0;
            const sticker = stickers[i % stickers.length];
            return (
              <button key={i} type="button" className="sb-focusable" aria-label={`查看第 ${i + 1} 张`} onClick={() => onOpen(i)} style={{
                cursor: 'pointer',
                transform: `rotate(${rot}deg)`,
                position: 'relative',
                appearance: 'none', background: 'none', border: 'none', padding: 0, margin: 0,
                font: 'inherit', color: 'inherit', textAlign: 'inherit', display: 'block',
              }}>
                {/* 撕纸边缘效果（使用不规则边框） */}
                <div style={{
                  background: '#fff', borderRadius: '2px 4px 4px 2px',
                  padding: 3, position: 'relative',
                  boxShadow: '1px 2px 6px rgba(12,10,9,0.08)',
                }}>
                  <div style={{ aspectRatio: '3/4', overflow: 'hidden' }}>
                    <img src={item.url} alt={item.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} width="160" height="200" loading="lazy" decoding="async" fetchpriority="auto" />
                  </div>
                </div>
                {/* 贴纸 */}
                <div style={{
                  position: 'absolute', top: -6, right: -4, fontSize: 'var(--sb-text-lg)',
                  transform: `rotate(${[-10, 8, -5, 12, -8, 6, -12, 10, -6][i]}deg)`,
                  filter: 'drop-shadow(0 1px 1px rgba(12,10,9,0.15))',
                }}>{sticker}</div>
                {/* 手写标签（交替位置） */}
                {i % 3 === 1 && (
                  <div style={{
                    position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)',
                    fontSize: 'var(--sb-text-2xs)', color: '#888', background: '#fffde7', padding: '1px 6px',
                    borderRadius: 'var(--sb-radius-xs)', whiteSpace: 'nowrap', border: '0.5px solid #ddd',
                  }}>📌 {['今日份', '小确幸', '记录'][i % 3]}</div>
                )}
                {/* 虚线（装饰） */}
                {i > 0 && i % 3 === 0 && (
                  <div style={{
                    position: 'absolute', top: '50%', left: -8, width: 6, height: 1,
                    borderTop: '1px dashed #ccc',
                  }} />
                )}
              </button>
            );
          })}
        </div>
        {/* 底部装饰线 */}
        <div style={{
          marginTop: 16, borderTop: '1px dashed #ddd',
          display: 'flex', justifyContent: 'center', gap: 'var(--sb-space-2)', paddingTop: 8,
        }}>
          {['🌸', '📅', '✉️'].map((s, i) => (
            <span key={i} style={{ fontSize: 'var(--sb-text-xs)', opacity: 0.6 }}>{s}</span>
          ))}
        </div>
      </div>
    );
  };

  /** 杂志风：封面大图+极简网格 */
  const LayoutMagazine = ({ images, onOpen }) => {
    // 封面（第一张）占 2 格宽度
    const cover = images[0];
    const rest = images.slice(1);
    return (
      <div>
        {/* 封面 —— 大图 */}
        {cover && (
          <button type="button" className="sb-focusable" aria-label="查看第 1 张（封面）" onClick={() => onOpen(0)} style={{
            marginBottom: 16, cursor: 'pointer', position: 'relative',
            background: '#f8f8f8', borderRadius: 'var(--sb-radius-md)', overflow: 'hidden',
            appearance: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', textAlign: 'inherit', display: 'block', width: '100%',
          }}>
            <div style={{ aspectRatio: '3/4', maxHeight: 340 }}>
              <img src={cover.url} alt="封面" style={{ width: '100%', height: '100%', objectFit: 'cover' }} width="320" height="400" loading="lazy" decoding="async" fetchpriority="auto" />
            </div>
            {/* 杂志风格大标题覆盖 */}
            <div style={{
              position: 'absolute', bottom: 20, left: 16,
              color: '#fff', textShadow: '0 2px 8px rgba(12,10,9,0.3)',
            }}>
              <div style={{ fontSize: 'var(--sb-text-2xs)', letterSpacing: 3, opacity: 0.7, marginBottom: 4, fontFamily: 'serif' }}>FEATURE</div>
              <div style={{ fontSize: 'var(--sb-text-xl)', fontWeight: 700, lineHeight: 1.2, fontFamily: 'serif' }}>
                {results?.caption?.split('｜')[0] || '生活碎片'}
              </div>
            </div>
          </button>
        )}
        {/* 内容页 —— 3列极简 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sb-space-2)' }}>
          {rest.map((item, i) => (
            <button key={i} type="button" className="sb-focusable" aria-label={`查看第 ${i + 2} 张`} onClick={() => onOpen(i + 1)}
              style={{
                cursor: 'pointer', background: 'none', border: 'none', padding: 0, font: 'inherit',
              }}>
              <div style={{
                aspectRatio: '3/4', overflow: 'hidden', borderRadius: 'var(--sb-radius-xs)',
                boxShadow: '0 1px 4px rgba(12,10,9,0.04)',
              }}>
                <img src={item.url} alt={item.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} width="160" height="200" loading="lazy" decoding="async" fetchpriority="auto" />
              </div>
              {/* 极小页码 */}
              <div style={{
                fontSize: 'var(--sb-text-2xs)', color: '#bbb', textAlign: 'right', marginTop: 3,
                fontFamily: 'serif', letterSpacing: 1,
              }}>
                {String(i + 2).padStart(2, '0')}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  // ── 排版路由 ──
  const renderLayout = (images, onOpen) => {
    const layoutMap = {
      'casual': LayoutCasual,
      'polaroid': LayoutPolaroid,
      'cinematic': LayoutCinematic,
      'journal': LayoutJournal,
      'magazine': LayoutMagazine,
    };
    const Comp = layoutMap[selectedLayout] || LayoutCasual;
    return <Comp images={images} onOpen={onOpen} />;
  };

  return (
    /* 9-16 surface 分层 + 全量 token 化（docs/design/40-decisions.md D4/D6/D7/D11）：
       ① 底色由冷灰 #FAFAFA 改为暖白页面面 --sb-surface-page（D4：暖黑体系，冷灰与全站无关）；
       ② 面板/卡片/描边/圆角/间距全部走 --sb-*，不再有硬编码；
       ③ 按 D7，下面各区块不再各自套一张纯白卡，改为「分组留白 + 分组标题」。 */
    <div style={{ minHeight: '100vh', background: 'var(--sb-surface-page)' }}>
      <div style={{ maxWidth: 500, margin: '0 auto', padding: 'var(--sb-space-6) var(--sb-space-4) var(--sb-space-16)' }}>
        {/* 导航 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sb-space-3)', marginBottom: 'var(--sb-space-6)' }}>
          <CharImg src={IMAGES.appicon} size={28} float />
          <span style={{ fontSize: 'var(--sb-text-lg)', fontWeight: 'var(--sb-weight-semibold)', color: 'var(--sb-ink-1)' }}>📒 Plog 生活碎片</span>
          <span style={{ fontSize: 'var(--sb-text-xs)', color: 'var(--sb-ink-3)', background: 'var(--sb-surface-tint)', padding: '2px var(--sb-space-2)', borderRadius: 'var(--sb-radius-xs)' }}>全新</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => dispatch({ type: 'NAVIGATE', page: 'home' })} className="sb-focusable"
            style={{ fontSize: 'var(--sb-text-xs)', color: 'var(--sb-ink-3)', cursor: 'pointer', border: 'none', background: 'none', fontFamily: 'inherit', borderRadius: 'var(--sb-radius-sm)', padding: 'var(--sb-space-1) var(--sb-space-2)' }}>← 返回</button>
        </div>

        {/* ── 输入区 ── */}
        {/* D7：不再套白卡，改用「分组留白 + 分组标题」。 */}
        <section className="sb-group">
          <h2 className="sb-group-title">✍️ 描述你的生活场景</h2>
          {/* D11：输入框补焦点态（原为裸 outline:none + 手改 borderColor，键盘用户看不到焦点）。 */}
          <textarea value={text} onChange={e => setText(e.target.value)}
            placeholder="例如：独居日常｜周末宅家看书喝咖啡"
            className="sb-focusable"
            style={{ width: '100%', minHeight: 68, padding: 'var(--sb-space-3)', borderRadius: 'var(--sb-radius-lg)', border: '1px solid var(--sb-border-default)', background: 'var(--sb-surface-sunken)', fontSize: 'var(--sb-text-md)', fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box', color: 'var(--sb-ink-1)' }} />
          <div style={{ display: 'flex', gap: 'var(--sb-space-2)', flexWrap: 'wrap', marginTop: 'var(--sb-space-3)' }}>
            {EXAMPLE_PROMPTS.map((p, i) => (
              /* D11：裸 div onClick → button（可键盘聚焦） */
              <button key={i} type="button" onClick={() => setText(p)} className="sb-focusable"
                style={{ fontSize: 'var(--sb-text-xs)', color: 'var(--sb-ink-2)', background: 'var(--sb-surface-tint)', padding: 'var(--sb-space-1) var(--sb-space-3)', borderRadius: 'var(--sb-radius-pill)', cursor: 'pointer', whiteSpace: 'nowrap', border: '1px solid var(--sb-border-subtle)', fontFamily: 'inherit' }}>
                {p}
              </button>
            ))}
          </div>
          {/* 跨 mode 商品档案 (P2 续命 4c183cd4): 从电商工作台已保存的档案里选用一个,
              选中后把 name + 卖点 + 规格 + 材质/颜色 拼到 text 尾部, Plog 也复用同一份事实。 */}
          <div style={{ marginTop: 'var(--sb-space-3)' }}>
            <ProductProfilePicker
              profiles={plogProfile.profiles}
              loading={plogProfile.loading}
              error={plogProfile.error}
              activeProfileId={activePlogProfileId}
              onRefresh={plogProfile.refresh}
              onSelect={profile => {
                const ok = applyProductProfileFactsToPlog(profile, setText);
                if (ok) setActivePlogProfileId(profile.profileId);
              }}
              accentColor="var(--sb-ink-brand)"
              triggerLabel="当前商品"
              emptyHint="暂未保存商品档案, 请先在电商工作台保存一个商品档案"
            />
          </div>
        </section>

        {/* ── 排版选择 ── D7：分组留白 + 标题；D2：选中用 ring，不加粗边框（无布局抖动） */}
        <section className="sb-group">
          <h2 className="sb-group-title">🎭 选择排版</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sb-space-2)' }}>
            {Object.entries(LAYOUT_TEMPLATES).map(([key, t]) => {
              const active = selectedLayout === key;
              return (
                <button key={key} type="button" className="sb-focusable"
                  onClick={() => { setSelectedLayout(key); if (key !== 'casual') setSelectedCover('collage'); }}
                  aria-pressed={active}
                  style={{
                    padding: 'var(--sb-space-3) var(--sb-space-2)', borderRadius: 'var(--sb-radius-lg)', cursor: 'pointer', textAlign: 'center',
                    border: '1px solid ' + (active ? 'var(--sb-state-selected-line)' : 'var(--sb-border-subtle)'),
                    background: active ? 'var(--sb-state-selected-bg)' : 'var(--sb-surface-sunken)',
                    boxShadow: active ? 'var(--sb-shadow-ring)' : 'none',
                    transition: 'background var(--sb-dur-fast, .12s) ' + 'var(--sb-ease-out, ease), box-shadow var(--sb-dur-fast, .12s) ' + 'var(--sb-ease-out, ease)',
                    fontFamily: 'inherit',
                  }}>
                  <div style={{ fontSize: 'var(--sb-text-xl)', marginBottom: 2 }}>{t.emoji}</div>
                  <div style={{ fontSize: 'var(--sb-text-xs)', fontWeight: 'var(--sb-weight-semibold)', color: active ? 'var(--sb-state-selected-ink)' : 'var(--sb-ink-2)' }}>{t.name}</div>
                  <div style={{ fontSize: 'var(--sb-text-2xs, 10px)', color: 'var(--sb-ink-4)', marginTop: 2, lineHeight: 1.4 }}>{t.desc}</div>
                  {t.tag && <div style={{ fontSize: 'var(--sb-text-2xs, 10px)', color: 'var(--sb-ink-danger)', marginTop: 2 }}>{t.tag}</div>}
                </button>
              );
            })}
          </div>
        </section>

        {/* ── 封面变体 ── D7 分组 */}
        <section className="sb-group">
          <h2 className="sb-group-title">📰 封面样式</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--sb-space-2)' }}>
            {Object.entries(COVER_VARIANTS).map(([key, c]) => {
              const active = selectedCover === key;
              return (
                <button key={key} type="button" className="sb-focusable" onClick={() => setSelectedCover(key)} aria-pressed={active}
                  style={{
                    padding: 'var(--sb-space-2) var(--sb-space-1)', borderRadius: 'var(--sb-radius-md)', cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit',
                    border: '1px solid ' + (active ? 'var(--sb-state-selected-line)' : 'var(--sb-border-subtle)'),
                    background: active ? 'var(--sb-state-selected-bg)' : 'var(--sb-surface-sunken)',
                    boxShadow: active ? 'var(--sb-shadow-ring)' : 'none',
                  }}>
                  <div style={{ fontSize: 'var(--sb-text-xl)' }}>{c.icon}</div>
                  <div style={{ fontSize: 'var(--sb-text-2xs, 10px)', fontWeight: 'var(--sb-weight-medium, 500)', color: active ? 'var(--sb-state-selected-ink)' : 'var(--sb-ink-2)', marginTop: 2 }}>{c.name}</div>
                  <div style={{ fontSize: 'var(--sb-text-2xs, 10px)', color: 'var(--sb-ink-4)', marginTop: 1 }}>{c.desc}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── 风格选择 ── D7 分组 */}
        <section className="sb-group">
          <h2 className="sb-group-title">🎨 色调风格</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sb-space-2)' }}>
            {Object.entries(PLOG_STYLES).map(([key, s]) => {
              const active = selectedStyle === key;
              return (
                <button key={key} type="button" className="sb-focusable" onClick={() => setSelectedStyle(key)} aria-pressed={active}
                  style={{
                    padding: 'var(--sb-space-3)', borderRadius: 'var(--sb-radius-lg)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                    border: '1px solid ' + (active ? 'var(--sb-state-selected-line)' : 'var(--sb-border-subtle)'),
                    background: active ? 'var(--sb-state-selected-bg)' : 'var(--sb-surface-sunken)',
                    boxShadow: active ? 'var(--sb-shadow-ring)' : 'none',
                  }}>
                  <div style={{ fontSize: 'var(--sb-text-lg)' }}>{s.emoji}</div>
                  <div style={{ fontSize: 'var(--sb-text-xs)', fontWeight: 'var(--sb-weight-semibold)', color: active ? 'var(--sb-state-selected-ink)' : 'var(--sb-ink-2)' }}>{s.name}</div>
                  <div style={{ fontSize: 'var(--sb-text-2xs, 10px)', color: 'var(--sb-ink-4)', marginTop: 1 }}>{s.desc}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── 参考素材上传 ── */}
        <SupplementAssetDeck
          productImages={sourceImages.map((url, index) => ({ id: `plog-source-${index}`, url, status: 'loaded', isAdded: true }))}
          referenceImages={styleImages.map((url, index) => ({ id: `plog-style-${index}`, url, status: 'loaded', isAdded: true }))}
          onAddProductImages={files => addRoleFiles('source', files)}
          onAddReferenceImages={files => addRoleFiles('style', files)}
          onRemoveProductImage={image => removeRoleFile('source', sourceImages.findIndex(url => url === image?.url))}
          onRemoveReferenceImage={image => removeRoleFile('style', styleImages.findIndex(url => url === image?.url))}
          productTitle="生活素材"
          productHint="保留人物、空间与生活细节"
          referenceTitle="风格参考"
          referenceHint="借鉴构图、色调与版式，不复制主体"
          productColor="#be185d"
          referenceColor="#8b5cf6"
          maxProductImages={6}
          maxReferenceImages={3}
        />

        {/* ── 生成按钮 ──
            D1：主 CTA 改品牌紫（原 #333 纯黑是"第三套皮肤"，与全站不符）；
            D6：圆角 12px 走 --sb-radius-lg；D11：补焦点态；禁用态用明确配色而非裸 #ddd。 */}
        <div style={{ marginBottom: 'var(--sb-space-4)' }}>
          <button onClick={handleGenerate} disabled={!text.trim() || genState === 'loading'} className="sb-focusable"
            style={{
              width: '100%', height: 'var(--sb-control-h-xl)', borderRadius: 'var(--sb-radius-lg)', border: 'none',
              background: !text.trim() || genState === 'loading' ? 'var(--sb-state-disabled-bg)' : 'var(--sb-brand-600)',
              color: !text.trim() || genState === 'loading' ? 'var(--sb-state-disabled-ink)' : 'var(--sb-ink-on-dark)',
              fontSize: 'var(--sb-text-md)', fontWeight: 'var(--sb-weight-semibold)',
              cursor: !text.trim() || genState === 'loading' ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', letterSpacing: 0.3,
              transition: 'background var(--sb-dur-fast, .12s) var(--sb-ease-out, ease)',
            }}>
            {genState === 'loading'
              ? `🖼️ 生成中 ${progress.current}/${progress.total} · ${elapsed}秒`
              : `🎨 生成 ${LAYOUT_TEMPLATES[selectedLayout].name} Plog`}
          </button>
        </div>

        {err && (
          /* D10：错误文字用 --sb-ink-danger（暖底上对比度达标），底色用 --sb-danger-soft。 */
          <div style={{ marginBottom: 'var(--sb-space-4)', padding: 'var(--sb-space-3)', borderRadius: 'var(--sb-radius-lg)', background: 'var(--sb-danger-soft)', border: '1px solid var(--sb-danger-border)', color: 'var(--sb-ink-danger)', fontSize: 'var(--sb-text-xs)' }}>{err}</div>
        )}

        {/* ── 加载中 ── */}
        {genState === 'loading' && (
          <div style={{ textAlign: 'center', padding: 'var(--sb-space-8)', color: 'var(--sb-ink-3)' }}>
            <div style={{ width: 32, height: 32, border: '3px solid var(--sb-border-subtle)', borderTopColor: 'var(--sb-brand-600)', borderRadius: 'var(--sb-radius-pill)', animation: 'spin 0.8s linear infinite', margin: '0 auto var(--sb-space-3)' }} />
            <div style={{ fontSize: 'var(--sb-text-xs)' }}>正在绘制 {progress.current}/{progress.total}...</div>
          </div>
        )}

        {/* ── 结果展示 ── */}
        {results && genState === 'done' && (
          <div>
            {/* caption + copy */}
            <section className="sb-group" style={{ background: 'var(--sb-surface-card)', borderRadius: 'var(--sb-radius-xl)', padding: 'var(--sb-space-5)', border: '1px solid var(--sb-border-subtle)' }}>
              {results.caption && (
                <div style={{ fontSize: 'var(--sb-text-md)', fontWeight: 'var(--sb-weight-semibold)', color: 'var(--sb-ink-1)', marginBottom: 'var(--sb-space-2)', lineHeight: 1.5 }}>{results.caption}</div>
              )}
              {results.copyLines?.length > 0 && (
                <div>
                  {results.copyLines.map((line, i) => (
                    <div key={i} style={{
                      fontSize: 'var(--sb-text-xs)', color: 'var(--sb-ink-3)', lineHeight: 1.7,
                      paddingLeft: 'var(--sb-space-3)', borderLeft: '2px solid var(--sb-border-default)', marginBottom: 'var(--sb-space-1)',
                    }}>{line}</div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 'var(--sb-space-2)', fontSize: 'var(--sb-text-2xs, 10px)', color: 'var(--sb-ink-4)', display: 'flex', gap: 'var(--sb-space-2)' }}>
                <span>📍 {results.scene}</span>
                <span>🎨 {PLOG_STYLES[results.style]?.name || results.style}</span>
                <span>🎭 {LAYOUT_TEMPLATES[results.layout]?.name || results.layout}</span>
              </div>
              {results.reference_usage && (
                <div style={{ marginTop: 'var(--sb-space-3)', paddingTop: 'var(--sb-space-2)', borderTop: '1px solid var(--sb-border-subtle)', fontSize: 'var(--sb-text-2xs, 10px)', color: 'var(--sb-ink-4)', lineHeight: 1.55 }}>
                  {results.reference_usage}
                </div>
              )}
            </section>

            {/* 排版渲染 */}
            {allImages.length > 0 && renderLayout(allImages, (idx) => {
              setLightbox(allImages[idx].url);
              setLightboxList(allImages);
              setLightboxIdx(idx);
            })}

            {/* 按钮 — 9-18（P0）改用契约类（原为自写 flex + 自写 gap + 自写按钮外观）。 */}
            <div className="ui-modal-footer">
              <div className="ui-modal-footer-actions" style={{ width: '100%' }}>
                <button type="button" className="ui-btn ui-btn-secondary" style={{ flex: '1 1 auto' }} onClick={() => {
                  allImages.forEach((item, i) => {
                    const a = document.createElement('a');
                    a.href = item.url;
                    a.download = `plog-${String(i + 1).padStart(2, '0')}.jpg`;
                    a.click();
                  });
                }}>
                  💾 下载全部
                </button>
                <button type="button" className="ui-btn ui-btn-primary" style={{ flex: '1 1 auto' }} onClick={() => { setGenState('idle'); setResults(null); }}>
                  重新生成
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── 灯箱 ──
            D11：遮罩是可点关闭区，div 键盘不可达 → button + UA 默认外观归零（外观零变化）。
            内外层不再依赖 stopPropagation：改为 onMouseDown 校验 target。 */}
        {lightbox && (
          <button type="button" aria-label="关闭预览" className="a11y-backdrop"
            style={{ position: 'fixed', inset: 0, zIndex: 'var(--sb-z-top)', background: 'rgba(12,10,9,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseDown={(event) => { if (event.target === event.currentTarget) setLightbox(null); }}>
            {/* D11：灯箱翻页由裸 div onClick 改为 button（可键盘聚焦 + 有焦点环）。
                此处 rgba(255,255,255,0.1) 属**深色遮罩上的玻璃层**，是 D4 许可的遮罩类例外。 */}
            {lightboxIdx > 0 && (
              <button type="button" aria-label="上一张" className="sb-focusable" onClick={(e) => { e.stopPropagation(); const ni = lightboxIdx - 1; setLightbox(lightboxList[ni].url); setLightboxIdx(ni); }}
                style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', width: 36, height: 36, borderRadius: 'var(--sb-radius-pill)', border: 'none', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--sb-ink-on-dark)', fontSize: 'var(--sb-text-xl)', zIndex: 1 }}>‹</button>
            )}
            {lightboxIdx < lightboxList.length - 1 && (
              <button type="button" aria-label="下一张" className="sb-focusable" onClick={(e) => { e.stopPropagation(); const ni = lightboxIdx + 1; setLightbox(lightboxList[ni].url); setLightboxIdx(ni); }}
                style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', width: 36, height: 36, borderRadius: 'var(--sb-radius-pill)', border: 'none', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--sb-ink-on-dark)', fontSize: 'var(--sb-text-xl)', zIndex: 1 }}>›</button>
            )}
            <img src={lightbox} width="1024" height="1024" loading="eager" decoding="async" fetchpriority="high" style={{ maxWidth: '90%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 'var(--sb-radius-sm)' }} alt="" />
          </button>
        )}

        <div style={{ marginTop: 40 }}><Footer /></div>
      </div>
    </div>
  );
}
