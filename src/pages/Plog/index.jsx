import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../../store/AppContext';
import { IMAGES } from '../../constants/images';
import { CharImg } from '../../components/ui/index';
import Footer from '../../components/layout/Footer';

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
  const { state, dispatch } = useApp();
  const [text, setText] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('ins-minimal');
  const [selectedLayout, setSelectedLayout] = useState('casual');
  const [selectedCover, setSelectedCover] = useState('collage');
  const [refImage, setRefImage] = useState(null);
  const [refPreview, setRefPreview] = useState('');
  const [genState, setGenState] = useState('idle');
  const [results, setResults] = useState(null);
  const [err, setErr] = useState('');
  const [lightbox, setLightbox] = useState(null);
  const [lightboxList, setLightboxList] = useState([]);
  const [lightboxIdx, setLightboxIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState({ current: 0, total: 9 });
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (genState === 'loading') {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [genState]);

  // ── 参考图上传 ──
  const handleRefFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) { setErr('图片太大，请选择5MB以内的图片'); return; }
    setErr('');
    setRefImage(file);
    setRefPreview(URL.createObjectURL(file));
  }, []);

  const handleFileChange = useCallback((e) => { handleRefFile(e.target.files?.[0]); e.target.value = ''; }, [handleRefFile]);

  useEffect(() => {
    const handlePaste = (e) => { const f = e.clipboardData?.files?.[0]; if (f) handleRefFile(f); };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleRefFile]);

  const clearRef = useCallback(() => {
    if (refPreview) URL.revokeObjectURL(refPreview);
    setRefImage(null);
    setRefPreview('');
  }, [refPreview]);

  const readFileAsBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // ── 生成 ──
  const handleGenerate = async () => {
    if (!text.trim()) return;
    setErr('');
    setGenState('loading');
    setResults(null);
    setProgress({ current: 0, total: 9 });
    dispatch({ type: 'START_GEN' });
    try {
      const body = { text: text.trim(), style: selectedStyle, layout: selectedLayout, coverVariant: selectedCover };
      if (refImage) body.refImage = await readFileAsBase64(refImage);
      const res = await fetch('/api/plog-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('请求失败');
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '', result = { cover_url: '', image_urls: [], copyLines: [], caption: '', scene: '', style: '', layout: '' };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const d = JSON.parse(line.slice(6));
            if (d.type === 'progress') {
              const stageMap = { scene: 1, lens: 1, tone: 1, generating: 2 };
              dispatch({ type: 'SET_STAGE', stage: stageMap[d.step] || 1 });
              if (d.current !== undefined) setProgress({ current: d.current, total: d.total || 9 });
            } else if (d.type === 'image') {
              if (d.id === 'cover') result.cover_url = d.url;
              else result.image_urls.push(d.url);
            } else if (d.type === 'complete') {
              Object.assign(result, d);
              result.image_count = d.image_urls?.length || 0;
            } else if (d.type === 'error') {
              throw new Error(d.error || '生成失败');
            }
          } catch(e) { if (e.message && !e.message.includes('JSON')) throw e; }
        }
      }
      setResults(result);
      setGenState('done');
      dispatch({ type: 'CLOSE_RESULT' });
    } catch (e) {
      setErr(e.message || '生成失败');
      setGenState('idle');
      dispatch({ type: 'CLOSE_RESULT' });
    }
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const allImages = results ? [
    ...(results.cover_url ? [{ label: '封面', url: results.cover_url, isCover: true }] : []),
    ...(results.image_urls || []).map((url, i) => ({ label: `图${i + 1}`, url, isCover: false }))
  ] : [];

  // ══════════════════════════════════════════
  //  每种排版的 CSS 渲染组件
  // ══════════════════════════════════════════

  /** 碎片风：3列网格+旋转+白边 */
  const LayoutCasual = ({ images, onOpen }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
      {images.map((item, i) => (
        <div key={i} onClick={() => onOpen(i)}
          style={{
            aspectRatio: '3/4', borderRadius: 6, overflow: 'hidden', cursor: 'pointer',
            background: '#fff', position: 'relative',
            transform: `rotate(${i % 2 === 0 ? -0.5 : 0.5}deg)`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            border: '3px solid white',
          }}>
          <img src={item.url} alt={item.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
        </div>
      ))}
    </div>
  );

  /** 拍立得风：白边+旋转+阴影 */
  const LayoutPolaroid = ({ images, onOpen }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
      {images.map((item, i) => {
        const rot = [-2, 1.5, -1, 2.5, -1.5, 1, -2.5, 2, -1][i] || 0;
        return (
          <div key={i} onClick={() => onOpen(i)}
            style={{
              cursor: 'pointer',
              transform: `rotate(${rot}deg)`,
              transition: 'transform 0.2s',
              filter: 'sepia(0.05)',
            }}>
            <div style={{
              background: '#fffdf7', padding: '6px 6px 22px 6px', borderRadius: 2,
              boxShadow: '0 3px 10px rgba(0,0,0,0.12)',
            }}>
              <div style={{ aspectRatio: '3/4', overflow: 'hidden', background: '#f0ebe0' }}>
                <img src={item.url} alt={item.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  /** 电影感：黑边+字幕条 */
  const LayoutCinematic = ({ images, onOpen }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, background: '#111', borderRadius: 12, padding: 14 }}>
      {images.map((item, i) => (
        <div key={i} onClick={() => onOpen(i)} style={{ cursor: 'pointer' }}>
          {/* 宽幅 + 上下黑边 */}
          <div style={{
            background: '#000', borderRadius: 4, overflow: 'hidden', padding: '0 0',
            position: 'relative',
          }}>
            <div style={{ aspectRatio: '3/4', maxHeight: 260, margin: '0 auto', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={item.url} alt={item.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
            </div>
            {/* 底部字幕条 */}
            <div style={{
              position: 'absolute', bottom: 8, left: 0, right: 0,
              textAlign: 'center', padding: '4px 16px',
            }}>
              <div style={{
                display: 'inline-block', background: 'rgba(0,0,0,0.75)', color: '#fff',
                fontSize: 10, padding: '3px 14px', borderRadius: 2,
                fontStyle: 'italic', letterSpacing: 0.5, fontFamily: 'serif',
              }}>
                {CINEMATIC_SUBTITLES[i % CINEMATIC_SUBTITLES.length]}
              </div>
            </div>
          </div>
          {/* 页码 */}
          <div style={{ textAlign: 'center', fontSize: 9, color: '#555', marginTop: 4, letterSpacing: 2 }}>
            {String(i + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
          </div>
        </div>
      ))}
    </div>
  );

  /** 手账风：纸张纹理+贴纸+撕纸边 */
  const LayoutJournal = ({ images, onOpen }) => {
    const stickers = JOURNAL_STICKERS;
    return (
      <div style={{
        background: '#F5F0E8', borderRadius: 12, padding: 16,
        position: 'relative', boxShadow: 'inset 0 0 30px rgba(0,0,0,0.03)',
      }}>
        {/* 纸张纹理 SVG */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, position: 'relative', zIndex: 1 }}>
          {images.map((item, i) => {
            const rot = [-1, 1.2, -0.8, 1.5, -1.2, 0.8, -1.8, 1, -0.5][i] || 0;
            const sticker = stickers[i % stickers.length];
            return (
              <div key={i} onClick={() => onOpen(i)} style={{
                cursor: 'pointer',
                transform: `rotate(${rot}deg)`,
                position: 'relative',
              }}>
                {/* 撕纸边缘效果（使用不规则边框） */}
                <div style={{
                  background: '#fff', borderRadius: '2px 4px 4px 2px',
                  padding: 3, position: 'relative',
                  boxShadow: '1px 2px 6px rgba(0,0,0,0.08)',
                }}>
                  <div style={{ aspectRatio: '3/4', overflow: 'hidden' }}>
                    <img src={item.url} alt={item.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                  </div>
                </div>
                {/* 贴纸 */}
                <div style={{
                  position: 'absolute', top: -6, right: -4, fontSize: 16,
                  transform: `rotate(${[-10, 8, -5, 12, -8, 6, -12, 10, -6][i]}deg)`,
                  filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.15))',
                }}>{sticker}</div>
                {/* 手写标签（交替位置） */}
                {i % 3 === 1 && (
                  <div style={{
                    position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)',
                    fontSize: 7, color: '#888', background: '#fffde7', padding: '1px 6px',
                    borderRadius: 1, whiteSpace: 'nowrap', border: '0.5px solid #ddd',
                  }}>📌 {['今日份', '小确幸', '记录'][i % 3]}</div>
                )}
                {/* 虚线（装饰） */}
                {i > 0 && i % 3 === 0 && (
                  <div style={{
                    position: 'absolute', top: '50%', left: -8, width: 6, height: 1,
                    borderTop: '1px dashed #ccc',
                  }} />
                )}
              </div>
            );
          })}
        </div>
        {/* 底部装饰线 */}
        <div style={{
          marginTop: 16, borderTop: '1px dashed #ddd',
          display: 'flex', justifyContent: 'center', gap: 8, paddingTop: 8,
        }}>
          {['🌸', '📅', '✉️'].map((s, i) => (
            <span key={i} style={{ fontSize: 11, opacity: 0.6 }}>{s}</span>
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
          <div onClick={() => onOpen(0)} style={{
            marginBottom: 16, cursor: 'pointer', position: 'relative',
            background: '#f8f8f8', borderRadius: 8, overflow: 'hidden',
          }}>
            <div style={{ aspectRatio: '3/4', maxHeight: 340 }}>
              <img src={cover.url} alt="封面" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
            </div>
            {/* 杂志风格大标题覆盖 */}
            <div style={{
              position: 'absolute', bottom: 20, left: 16,
              color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}>
              <div style={{ fontSize: 10, letterSpacing: 3, opacity: 0.7, marginBottom: 4, fontFamily: 'serif' }}>FEATURE</div>
              <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2, fontFamily: 'serif' }}>
                {results?.caption?.split('｜')[0] || '生活碎片'}
              </div>
            </div>
          </div>
        )}
        {/* 内容页 —— 3列极简 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {rest.map((item, i) => (
            <div key={i} onClick={() => onOpen(i + 1)}
              style={{
                cursor: 'pointer',
              }}>
              <div style={{
                aspectRatio: '3/4', overflow: 'hidden', borderRadius: 4,
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}>
                <img src={item.url} alt={item.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
              </div>
              {/* 极小页码 */}
              <div style={{
                fontSize: 8, color: '#bbb', textAlign: 'right', marginTop: 3,
                fontFamily: 'serif', letterSpacing: 1,
              }}>
                {String(i + 2).padStart(2, '0')}
              </div>
            </div>
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
    <div style={{ minHeight: '100vh', background: '#FAFAFA' }}>
      <div style={{ maxWidth: 500, margin: '0 auto', padding: '24px 16px 80px' }}>
        {/* 导航 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <CharImg src={IMAGES.appicon} size={28} float />
          <span style={{ fontSize: 17, fontWeight: 650 }}>📒 Plog 生活碎片</span>
          <span style={{ fontSize: 11, color: '#888', background: '#F0F0F0', padding: '2px 8px', borderRadius: 4 }}>全新</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => dispatch({ type: 'NAVIGATE', page: 'home' })}
            style={{ fontSize: 12, color: '#999', cursor: 'pointer', border: 'none', background: 'none', fontFamily: 'inherit' }}>← 返回</button>
        </div>

        {/* ── 输入区 ── */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 20, border: '1px solid #eee', marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 10 }}>✍️ 描述你的生活场景</div>
          <textarea value={text} onChange={e => setText(e.target.value)}
            placeholder="例如：独居日常｜周末宅家看书喝咖啡"
            style={{ width: '100%', minHeight: 68, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #ddd', fontSize: 14, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
            onFocus={e => e.target.style.borderColor = '#999'}
            onBlur={e => e.target.style.borderColor = '#ddd'} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {EXAMPLE_PROMPTS.map((p, i) => (
              <div key={i} onClick={() => setText(p)}
                style={{ fontSize: 11, color: '#666', background: '#F5F5F5', padding: '3px 10px', borderRadius: 12, cursor: 'pointer', whiteSpace: 'nowrap', border: '1px solid #eee' }}>
                {p}
              </div>
            ))}
          </div>
        </div>

        {/* ── 排版选择 ── */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 20, border: '1px solid #eee', marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 10 }}>🎭 选择排版</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {Object.entries(LAYOUT_TEMPLATES).map(([key, t]) => {
              const active = selectedLayout === key;
              return (
                <div key={key} onClick={() => { setSelectedLayout(key); if (key !== 'casual') setSelectedCover('collage'); }}
                  style={{
                    padding: '10px 8px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                    border: active ? '2px solid #333' : '2px solid #eee',
                    background: active ? '#f5f5f5' : '#fff', transition: 'all .12s',
                  }}>
                  <div style={{ fontSize: 20, marginBottom: 2 }}>{t.emoji}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: active ? '#333' : '#666' }}>{t.name}</div>
                  <div style={{ fontSize: 9, color: '#aaa', marginTop: 2, lineHeight: 1.3 }}>{t.desc}</div>
                  {t.tag && <div style={{ fontSize: 8, color: '#E85D5D', marginTop: 2 }}>{t.tag}</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── 封面变体 ── */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 20, border: '1px solid #eee', marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 10 }}>📰 封面样式</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {Object.entries(COVER_VARIANTS).map(([key, c]) => {
              const active = selectedCover === key;
              return (
                <div key={key} onClick={() => setSelectedCover(key)}
                  style={{
                    padding: '8px 4px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                    border: active ? '2px solid #333' : '2px solid #eee',
                    background: active ? '#f5f5f5' : '#fff',
                  }}>
                  <div style={{ fontSize: 18 }}>{c.icon}</div>
                  <div style={{ fontSize: 10, fontWeight: 500, color: active ? '#333' : '#666', marginTop: 2 }}>{c.name}</div>
                  <div style={{ fontSize: 8, color: '#aaa', marginTop: 1 }}>{c.desc}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── 风格选择 ── */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 20, border: '1px solid #eee', marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 10 }}>🎨 色调风格</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {Object.entries(PLOG_STYLES).map(([key, s]) => {
              const active = selectedStyle === key;
              return (
                <div key={key} onClick={() => setSelectedStyle(key)}
                  style={{
                    padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                    border: active ? '2px solid ' + s.accent : '2px solid #eee',
                    background: active ? s.color + '60' : '#fff',
                  }}>
                  <div style={{ fontSize: 16 }}>{s.emoji}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: active ? s.accent : '#333' }}>{s.name}</div>
                  <div style={{ fontSize: 9, color: '#999', marginTop: 1 }}>{s.desc}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── 参考图上传 ── */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 20, border: '1px solid #eee', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>📷 参考图（可选）</span>
            <span style={{ fontSize: 10, color: '#aaa' }}>拖入或粘贴</span>
          </div>
          {!refPreview ? (
            <div onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#999'; }}
              onDragLeave={e => { e.currentTarget.style.borderColor = '#ddd'; }}
              onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#ddd'; handleRefFile(e.dataTransfer?.files?.[0]); }}
              style={{ border: '2px dashed #ddd', borderRadius: 12, padding: '20px 16px', textAlign: 'center', cursor: 'pointer', transition: 'all .15s' }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>🖼️</div>
              <div style={{ fontSize: 11, color: '#999' }}>点击或拖入参考图</div>
              <div style={{ fontSize: 10, color: '#ccc', marginTop: 2 }}>AI 将自动统一色调</div>
            </div>
          ) : (
            <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden' }}>
              <img src={refPreview} alt="参考图" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 12 }} />
              <div onClick={clearRef}
                style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 12 }}>✕</div>
              <div style={{ position: 'absolute', bottom: 6, left: 6, fontSize: 9, color: '#fff', background: 'rgba(0,0,0,0.5)', padding: '1px 8px', borderRadius: 3 }}>色调参考</div>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
        </div>

        {/* ── 生成按钮 ── */}
        <div style={{ marginBottom: 14 }}>
          <button onClick={handleGenerate} disabled={!text.trim() || genState === 'loading'}
            style={{
              width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
              background: !text.trim() || genState === 'loading' ? '#ddd' : '#333',
              color: '#fff', fontSize: 15, fontWeight: 600, cursor: !text.trim() || genState === 'loading' ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', letterSpacing: 0.5,
            }}>
            {genState === 'loading'
              ? `🖼️ 生成中 ${progress.current}/${progress.total} · ${elapsed}秒`
              : `🎨 生成 ${LAYOUT_TEMPLATES[selectedLayout].name} Plog`}
          </button>
        </div>

        {err && (
          <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: '#FFF5F5', border: '1px solid #FECACA', color: '#DC2626', fontSize: 12 }}>{err}</div>
        )}

        {/* ── 加载中 ── */}
        {genState === 'loading' && (
          <div style={{ textAlign: 'center', padding: 32, color: '#888' }}>
            <div style={{ width: 32, height: 32, border: '3px solid #eee', borderTopColor: '#333', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <div style={{ fontSize: 12 }}>正在绘制 {progress.current}/{progress.total}...</div>
          </div>
        )}

        {/* ── 结果展示 ── */}
        {results && genState === 'done' && (
          <div>
            {/* caption + copy */}
            <div style={{ background: '#fff', borderRadius: 16, padding: 20, border: '1px solid #eee', marginBottom: 14 }}>
              {results.caption && (
                <div style={{ fontSize: 14, fontWeight: 600, color: '#333', marginBottom: 8, lineHeight: 1.5 }}>{results.caption}</div>
              )}
              {results.copyLines?.length > 0 && (
                <div>
                  {results.copyLines.map((line, i) => (
                    <div key={i} style={{
                      fontSize: 11, color: '#888', lineHeight: 1.7,
                      paddingLeft: 10, borderLeft: '2px solid #ddd', marginBottom: 3,
                    }}>{line}</div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 8, fontSize: 9, color: '#bbb', display: 'flex', gap: 8 }}>
                <span>📍 {results.scene}</span>
                <span>🎨 {PLOG_STYLES[results.style]?.name || results.style}</span>
                <span>🎭 {LAYOUT_TEMPLATES[results.layout]?.name || results.layout}</span>
              </div>
            </div>

            {/* 排版渲染 */}
            {allImages.length > 0 && renderLayout(allImages, (idx) => {
              setLightbox(allImages[idx].url);
              setLightboxList(allImages);
              setLightboxIdx(idx);
            })}

            {/* 按钮 */}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => {
                allImages.forEach((item, i) => {
                  const a = document.createElement('a');
                  a.href = item.url;
                  a.download = `plog-${String(i + 1).padStart(2, '0')}.jpg`;
                  a.click();
                });
              }}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid #ddd', background: '#fff', color: '#333', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                💾 下载全部
              </button>
              <button onClick={() => { setGenState('idle'); setResults(null); }}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', background: '#333', color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                重新生成
              </button>
            </div>
          </div>
        )}

        {/* ── 灯箱 ── */}
        {lightbox && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setLightbox(null)}>
            {lightboxIdx > 0 && (
              <div onClick={(e) => { e.stopPropagation(); const ni = lightboxIdx - 1; setLightbox(lightboxList[ni].url); setLightboxIdx(ni); }}
                style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: 20, zIndex: 1 }}>‹</div>
            )}
            {lightboxIdx < lightboxList.length - 1 && (
              <div onClick={(e) => { e.stopPropagation(); const ni = lightboxIdx + 1; setLightbox(lightboxList[ni].url); setLightboxIdx(ni); }}
                style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: 20, zIndex: 1 }}>›</div>
            )}
            <img src={lightbox} style={{ maxWidth: '90%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 6 }} alt="" />
          </div>
        )}

        <div style={{ marginTop: 40 }}><Footer /></div>
      </div>
    </div>
  );
}
