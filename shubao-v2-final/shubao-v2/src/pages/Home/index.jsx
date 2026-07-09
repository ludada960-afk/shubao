import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Sparkles, Upload, ChevronRight, Pencil, ShoppingCart, Target, Palette, RefreshCw, Copy, Monitor, ShieldCheck } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { IMAGES } from '../../constants/images';
import { GALLERY, QUICK_HINTS, PRICING_XHS, PRICING_EC, EC_CATS, EC_STYLES } from '../../constants/data';
import { proxyImg, generateContent, generateEcommerce, saveWork, getTrialStatus, consumeTrial } from '../../services/api';
import { getSession } from '../../services/auth';
import { CharImg } from '../../components/ui/index';
import Button from '../../components/ui/Button';
import Footer from '../../components/layout/Footer';
import './Home.css';

export default function HomePage() {
  const { state, dispatch } = useApp();
  const { inputText, logged, credits, mode } = state;
  const [err, setErr] = useState('');
  const [refImages, setRefImages] = useState([]);
  const fileRef = useRef(null);
  const [trialRemaining, setTrialRemaining] = useState(0);

  // 电商 state
  const [ecName, setEcName] = useState('');
  const [ecCat, setEcCat] = useState('美妆护肤');
  const [ecStyles, setEcStyles] = useState(['白底主图', '场景图']);
  const [ecRefImgs, setEcRefImgs] = useState([]);
  const ecFileRef = useRef(null);

  const setMode = (m) => dispatch({ type: 'SET_MODE', mode: m });
  const setText = (t) => dispatch({ type: 'SET_INPUT', text: t });

  useEffect(() => {
    if (logged) {
      getSession().then(user => {
        if (user?.phone) getTrialStatus(user.phone).then(s => setTrialRemaining(s.freeRemaining || 0));
      });
    }
  }, [logged]);

  /* ── XHS 生成 ── */
  const doGenXHS = async () => {
    if (!inputText.trim()) return;
    const hasPaid = logged && credits > 0;
    const hasFree = logged && trialRemaining > 0;
    if (!logged) { dispatch({ type: 'SHOW_LOGIN', show: true }); return; }
    if (!hasPaid && !hasFree) { dispatch({ type: 'SHOW_PRICE', show: true }); return; }
    const usePreview = !hasPaid && hasFree;
    setErr('');
    dispatch({ type: 'START_GEN' });
    let stageTimer;
    try {
      let stg = 0;
      stageTimer = setInterval(() => { if (stg < 4) { stg++; dispatch({ type: 'SET_STAGE', stage: stg }); } }, usePreview ? 4000 : 6000);
      const result = await generateContent(inputText, refImages, {
        preview: usePreview,
        onImage: () => dispatch({ type: 'SET_STAGE', stage: 2 }),
        onProgress: (d) => { if (d.step === 'visual_planning') dispatch({ type: 'SET_STAGE', stage: 1 }); },
      });
      clearInterval(stageTimer);
      dispatch({ type: 'SET_STAGE', stage: 4 });
      const work = { ...result, _inputText: inputText, _saveKey: 'gen-' + Date.now(), _preview: usePreview, at: new Date().toLocaleDateString('zh-CN'), id: Date.now() };
      dispatch({ type: 'SET_RESULT', result: work });
      if (usePreview) {
        const session = await getSession();
        if (session?.phone) await consumeTrial(session.phone);
        setTrialRemaining(0);
      } else {
        saveWork(work);
        if (credits > 0) dispatch({ type: 'SET_CREDITS', credits: credits - 1 });
      }
    } catch (e) { clearInterval(stageTimer); setErr(e.message || '生成失败'); dispatch({ type: 'CLOSE_RESULT' }); }
  };

  /* ── EC 生成 ── */
  const doGenEC = async () => {
    if (!ecName.trim()) return;
    if (!logged) { dispatch({ type: 'SHOW_LOGIN', show: true }); return; }
    setErr('');
    dispatch({ type: 'START_GEN' });
    try {
      const data = await generateEcommerce({ productName: ecName, category: ecCat, refImgs: ecRefImgs, styles: ecStyles, platform: '淘宝', points: '' });
      dispatch({ type: 'CLOSE_RESULT' });
      // 简单展示结果（后续可做独立结果页）
      alert('电商图生成成功！共生成 ' + Object.keys(data.images || {}).length + ' 张图片');
    } catch (e) { setErr(e.message || '生成失败'); dispatch({ type: 'CLOSE_RESULT' }); }
  };

  const addRefImage = (files, setter, current, max) => {
    Array.from(files).slice(0, max - current.length).forEach(f => {
      const reader = new FileReader();
      reader.onload = (ev) => setter(p => p.length >= max ? p : [...p, ev.target.result]);
      reader.readAsDataURL(f);
    });
  };

  const toggleEcStyle = (s) => setEcStyles(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);

  const isXHS = mode === 'content';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ═══════ HERO ═══════ */}
      <section className="hero-section">
        <h1 className="hero-title">
          AI 一键生成<span className="hero-accent">爆款内容</span>
        </h1>
        <p className="hero-sub">
          小红书博主用它出图文，电商卖家用它做商品图 — 两条产品线，一个工具搞定
        </p>

        {/* Mode Tabs */}
        <div className="mode-tabs">
          <button className={`mode-tab ${isXHS ? 'active-xhs' : ''}`} onClick={() => setMode('content')}>
            <Pencil size={14} /> 小红书图文
          </button>
          <button className={`mode-tab ${!isXHS ? 'active-ec' : ''}`} onClick={() => setMode('ecommerce')}>
            <ShoppingCart size={14} /> 电商商品图
          </button>
        </div>

        {/* Input Card */}
        <div className="input-area">
          <div className={`input-card ${isXHS ? 'xhs-border' : 'ec-border'}`}>
            <div className="input-header">
              <div className={`input-dot ${isXHS ? 'red' : 'blue'}`} />
              <span>{isXHS ? '输入主题，一键生成' : '输入商品信息，生成商品图'}</span>
            </div>

            {/* XHS Panel */}
            {isXHS && (
              <div>
                <textarea
                  className="hero-textarea"
                  value={inputText}
                  onChange={e => setText(e.target.value)}
                  placeholder={"输入你想创作的主题，一句话就够了\n例如：厦门3天2夜旅游攻略、百元蓝牙耳机测评..."}
                />
                {/* 参考图 */}
                <div className="ref-images-row">
                  {refImages.map((src, i) => (
                    <div key={i} className="ref-thumb">
                      <img src={src} alt="" />
                      <div className="ref-remove" onClick={() => setRefImages(p => p.filter((_, j) => j !== i))}>×</div>
                    </div>
                  ))}
                  {refImages.length < 3 && (
                    <div className="ref-add" onClick={() => fileRef.current?.click()}>
                      <Upload size={14} />
                    </div>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => { addRefImage(e.target.files, setRefImages, refImages, 3); e.target.value = ''; }} />
                  <span className="ref-hint">参考图（可选，最多3张）</span>
                </div>
                {/* 标签云 */}
                <div className="tags-cloud">
                  {QUICK_HINTS.map((hint, i) => (
                    <button key={i} className="hint-tag" onClick={() => setText(hint)}>{hint}</button>
                  ))}
                </div>
                {err && <div className="error-bar">{err}</div>}
                <button className="gen-btn xhs" onClick={doGenXHS} disabled={!inputText.trim()}>
                  <Sparkles size={14} />
                  {!logged ? '登录后开始创作' : credits > 0 ? '一键生成爆款图文' : trialRemaining > 0 ? '免费预览（文案+封面）' : '购买套餐后创作'}
                </button>
                <div className="gen-hint">
                  {!logged ? '注册即送 1 次免费预览' : credits > 0 ? `剩余 ${credits} 套 · 1套 = 完整文案 + 9张配图` : trialRemaining > 0 ? '🎁 免费预览：AI 生成完整文案 + 1 张封面图' : '额度已用完，购买套餐解锁完整 9 张配图'}
                </div>
              </div>
            )}

            {/* EC Panel */}
            {!isXHS && (
              <div>
                <div className="ec-form">
                  <div className="ec-label">商品名称</div>
                  <input className="ec-input" value={ecName} onChange={e => setEcName(e.target.value)} placeholder="例如：高保湿精华液、无线蓝牙耳机..." />
                  <div className="ec-label">商品品类</div>
                  <div className="ec-chips">
                    {EC_CATS.map(c => (
                      <span key={c} className={`ec-chip ${ecCat === c ? 'on' : ''}`} onClick={() => setEcCat(c)}>{c}</span>
                    ))}
                  </div>
                  <div className="ec-label">生成风格（可多选）</div>
                  <div className="ec-chips">
                    {EC_STYLES.map(s => (
                      <span key={s} className={`ec-chip ${ecStyles.includes(s) ? 'on' : ''}`} onClick={() => toggleEcStyle(s)}>{s}</span>
                    ))}
                  </div>
                  <div className="ec-label">参考图（可选，最多5张）</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {ecRefImgs.map((src, i) => (
                      <div key={i} className="ref-thumb">
                        <img src={src} alt="" />
                        <div className="ref-remove" onClick={() => setEcRefImgs(p => p.filter((_, j) => j !== i))}>×</div>
                      </div>
                    ))}
                    {ecRefImgs.length < 5 && (
                      <div className="ref-add" onClick={() => ecFileRef.current?.click()}>
                        <Upload size={14} />
                      </div>
                    )}
                    <input ref={ecFileRef} type="file" accept="image/*" multiple hidden onChange={e => { addRefImage(e.target.files, setEcRefImgs, ecRefImgs, 5); e.target.value = ''; }} />
                  </div>
                </div>
                {err && <div className="error-bar">{err}</div>}
                <button className="gen-btn ec" onClick={doGenEC} disabled={!ecName.trim()}>
                  <Sparkles size={14} /> 生成电商图片
                </button>
                <div className="gen-hint">1套 = 按所选风格生成对应商品图，适配 6 大电商平台</div>
              </div>
            )}
          </div>

          {/* Stats Row */}
          <div className="stats-row">
            {isXHS ? (
              <>
                <div className="stat"><div className="stat-num red">15s</div><div className="stat-label">出图速度</div></div>
                <div className="stat"><div className="stat-num red">14</div><div className="stat-label">覆盖赛道</div></div>
                <div className="stat"><div className="stat-num red">9张</div><div className="stat-label">完整配图</div></div>
              </>
            ) : (
              <>
                <div className="stat"><div className="stat-num blue">4种</div><div className="stat-label">图片风格</div></div>
                <div className="stat"><div className="stat-num blue">6大</div><div className="stat-label">电商平台</div></div>
                <div className="stat"><div className="stat-num blue">GPT</div><div className="stat-label">Image 2</div></div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ═══════ DUAL SHOWCASE ═══════ */}
      <section className="section">
        <h2 className="section-title">两条产品线，看看效果</h2>
        <p className="section-sub">所有内容均由薯包AI一键生成</p>
        <div className="dual-grid">
          {/* XHS Column */}
          <div className="dual-col">
            <div className="dual-col-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="dual-col-tag" style={{ background: 'var(--red-bg)', color: '#C53030' }}>📝 小红书图文</span>
                <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>一句话 → 文案+9张图</span>
              </div>
              <span style={{ fontSize: 10, color: 'var(--red)', cursor: 'pointer' }} onClick={() => dispatch({ type: 'NAVIGATE', page: 'gallery' })}>
                更多 <ChevronRight size={10} />
              </span>
            </div>
            <div className="dual-col-body">
              <div className="mini-grid">
                {GALLERY.slice(0, 6).map(g => (
                  <div key={g.id} className="mini-card" onClick={() => {
                    dispatch({ type: 'SET_RESULT', result: { ...g, body_text: g.body, hashtags: g.tags, category: g.cat, _inputText: g.hint, _galleryItem: true } });
                  }}>
                    {g.cover_url ? (
                      <img className="mini-cover" src={proxyImg(g.cover_url)} alt="" loading="lazy" />
                    ) : (
                      <div className="mini-cover" style={{ background: g.grad }} />
                    )}
                    <div className="mini-title">{g.title}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* EC Column */}
          <div className="dual-col">
            <div className="dual-col-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="dual-col-tag" style={{ background: 'var(--blue-bg)', color: '#3730A3' }}>🛍️ 电商商品图</span>
                <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>商品照 → 白底/场景/详情</span>
              </div>
            </div>
            <div className="dual-col-body">
              <div className="ec-result-grid">
                {['⬜ 白底主图', '🌄 场景图', '📋 详情图', '🖼️ 组合图'].map((label, i) => (
                  <div key={i} className="ec-result-card">
                    <div className="ec-result-img" style={{ background: ['linear-gradient(135deg,#f8f8f8,#eee)','linear-gradient(135deg,#E8F5E9,#C8E6C9)','linear-gradient(135deg,#FFF3E0,#FFE0B2)','linear-gradient(135deg,#E3F2FD,#BBDEFB)'][i] }} />
                    <div className="ec-result-label">{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {['淘宝','京东','拼多多','小红书电商','抖音电商','亚马逊'].map(p => (
                  <span key={p} style={{ fontSize: 9, padding: '2px 8px', borderRadius: 4, background: '#f5f5f5', color: 'var(--text-hint)' }}>{p}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ FEATURES ═══════ */}
      <section className="section" style={{ paddingTop: 0 }}>
        <h2 className="section-title">核心能力</h2>
        <p className="section-sub">两条产品线共享的 AI 底层能力</p>
        <div className="features-grid">
          {[
            { Icon: Target, title: '智能赛道识别', desc: '自动判断内容类型，匹配最优生成策略', bg: 'var(--red-bg)', color: 'var(--red)' },
            { Icon: Palette, title: '多风格生成', desc: '小红书14赛道 + 电商4种图片风格', bg: 'var(--blue-bg)', color: 'var(--blue)' },
            { Icon: RefreshCw, title: '单张重生成', desc: '不满意单独刷新一张，不浪费整套额度', bg: '#E8F5E9', color: '#2E7D32' },
            { Icon: Copy, title: '一键复制导出', desc: '文案一键复制，图文打包ZIP下载', bg: '#FFF3E0', color: '#E65100' },
            { Icon: Monitor, title: '6大平台适配', desc: '电商图自动适配各平台主图尺寸规范', bg: '#F3E5F5', color: '#7B1FA2' },
            { Icon: ShieldCheck, title: '按套计费不套路', desc: '不自动续费，套餐不过期，用多少买多少', bg: '#f5f5f5', color: '#555' },
          ].map(({ Icon, title, desc, bg, color }, i) => (
            <div key={i} className="feature-card">
              <div className="feature-icon" style={{ background: bg, color }}><Icon size={15} /></div>
              <div className="feature-title">{title}</div>
              <div className="feature-desc">{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════ PRICING STRIP ═══════ */}
      <section className="section" style={{ paddingTop: 0 }}>
        <h2 className="section-title">定价</h2>
        <p className="section-sub">两种套餐独立计费，按需购买</p>
        <div className="pricing-row">
          <div className="pricing-col">
            <div className="pricing-header" style={{ color: 'var(--red)' }}>📝 小红书图文</div>
            <div className="pricing-plans">
              {PRICING_XHS.slice(0, 3).map((p, i) => (
                <div key={i} className={`plan-card ${p.pop ? 'pop-red' : ''}`} onClick={() => {
                  if (!logged) dispatch({ type: 'SHOW_LOGIN', show: true });
                  else dispatch({ type: 'ADD_CREDITS', amount: p.sets });
                }}>
                  <div className="plan-name">{p.name}</div>
                  <div className="plan-price red">¥{p.price}</div>
                  <div className="plan-detail">{p.sets}套 · {p.imgs}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="pricing-col">
            <div className="pricing-header" style={{ color: 'var(--blue)' }}>🛍️ 电商商品图</div>
            <div className="pricing-plans">
              {PRICING_EC.slice(0, 3).map((p, i) => (
                <div key={i} className={`plan-card ${p.pop ? 'pop-blue' : ''}`} onClick={() => {
                  if (!logged) dispatch({ type: 'SHOW_LOGIN', show: true });
                  else dispatch({ type: 'ADD_CREDITS', amount: p.sets });
                }}>
                  <div className="plan-name">{p.name}</div>
                  <div className="plan-price blue">¥{p.price}</div>
                  <div className="plan-detail">{p.sets}套 · {p.imgs}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: 8, fontSize: 10, color: 'var(--text-faint)' }}>
          所有套餐一次性购买，不清零，不限时间 ·{' '}
          <span style={{ color: 'var(--red)', cursor: 'pointer' }} onClick={() => dispatch({ type: 'NAVIGATE', page: 'pricing' })}>查看全部方案 →</span>
        </div>
      </section>

      {/* ═══════ CTA ═══════ */}
      <section style={{ textAlign: 'center', padding: '28px 20px 24px' }}>
        <CharImg src={IMAGES.jump} size={50} float />
        <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-heavy)', margin: '10px 0 4px' }}>一个工具，两种能力</h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-hint)', margin: '0 0 14px' }}>小红书博主和电商卖家都在用</p>
        <div className="cta-btns">
          <button className="cta-btn red" onClick={() => { setMode('content'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            生成小红书图文
          </button>
          <button className="cta-btn blue" onClick={() => { setMode('ecommerce'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            生成电商商品图
          </button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
