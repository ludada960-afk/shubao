import React, { useState, useRef } from 'react';
import { Sparkles, Settings, ChevronDown, ChevronUp, ImagePlus } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import EcExpertPanel from './EcExpertPanel';

/**
 * 电商生图模式 — 灵图风格输入区
 * 保留全部原有字段/功能
 * 输出：黄梯度区(网格) + 底栏(白层内/黄层外)
 */
export default function EcMode() {
  const { state, dispatch } = useApp();
  const [ecName, setEcName] = useState('');
  const [err, setErr] = useState('');
  const [expertOpen, setExpertOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const fileRef = useRef(null);

  const [refImages, setRefImages] = useState([]);
  const [refShots, setRefShots] = useState([]);
  const [refStyles, setRefStyles] = useState([]);
  const [productParams, setProductParams] = useState({ category: '', size: '', baseColor: '', accentColor: '', material: '', craft: '' });
  const [skus, setSkus] = useState([]);
  const [copywriting, setCopywriting] = useState({ plan: '', sellingPoints: '', qc: '', details: '', maintenance: '' });
  const [platform, setPlatform] = useState('淘宝');
  const [styleSkill, setStyleSkill] = useState('premium_minimal');

  const STYLE_SKILLS_LIST = [
    { key: 'premium_minimal', emoji: '⬜', name: '高级极简' },
    { key: 'lifestyle_scene', emoji: '🌿', name: '生活场景' },
    { key: 'fashion_editorial', emoji: '✨', name: '时尚杂志' },
    { key: 'warm_natural', emoji: '🌅', name: '自然暖调' },
    { key: 'tech_precision', emoji: '🔬', name: '科技精工' },
  ];

  const addRefImages = (newImgs) => {
    setRefImages(prev => [...prev, ...newImgs].slice(0, 10));
    const asShot = newImgs.map(url => ({ preview: url }));
    setRefShots(prev => [...prev, ...asShot].slice(0, 10));
  };

  const removeRefImage = (i) => {
    setRefImages(prev => { const next = [...prev]; next.splice(i, 1); return next; });
    setRefShots(prev => { const next = [...prev]; next.splice(i, 1); return next; });
  };

  const doGen = async () => {
    if (!ecName.trim()) { setErr('请输入商品描述'); return; }
    setErr(''); setGenerating(true);
    try {
      const preview = await fetch('/api/ecommerce-preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_name: ecName.trim(), category: productParams.category || '其他',
          selling_points: expertOpen ? copywriting.sellingPoints : '',
          has_material: expertOpen ? !!productParams.material : false,
          skus: expertOpen ? skus : [], reference_images: refImages,
          style_skill: styleSkill,
        }),
      });
      const d = await preview.json();
      if (d.product_name) {
        dispatch({ type: 'START_GEN' });
        dispatch({ type: 'SET_RESULT', result: { ...d, product_name: ecName.trim(), _ecResult: true } });
      }
    } catch (e) { setErr(e.message); }
    setGenerating(false);
  };

  const canGenerate = ecName.trim().length > 0;

  return (
    <div>
      {/* ═══ 内容区 — 暖色渐变（灵图风格）═══ */}
      <div style={{
        borderRadius: 20, margin: '12px 12px 0',
        background: 'linear-gradient(180deg, #FFF8F0 0%, #FFFBF5 40%, #FFFFFF 100%)',
        padding: '16px 18px 12px',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '112px minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
          {/* Left: Upload button */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => fileRef.current?.click()}
              style={{ position: 'relative', width: 86, height: 108, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 16, border: '2px dashed var(--border)', background: '#fff', boxShadow: '0 14px 36px rgba(57,45,26,0.10)', cursor: 'pointer', fontFamily: 'inherit', transform: 'rotate(-5deg)', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', overflow: 'hidden' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px) rotate(0deg)'; e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 20px 46px rgba(57,45,26,0.16)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'rotate(-5deg)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = '0 14px 36px rgba(57,45,26,0.10)'; }}>
              <span style={{ display: 'grid', width: 40, height: 40, placeItems: 'center', borderRadius: '50%', background: '#f8f3ea', color: 'var(--text-secondary)', boxShadow: '0 10px 24px rgba(57,45,26,0.12)' }}>
                <ImagePlus size={20} />
              </span>
              <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--text-secondary)' }}>加图</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>最多 10 张</span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden
              onChange={e => { const files = Array.from(e.target.files || []); addRefImages(files.map(f => URL.createObjectURL(f))); e.target.value = ''; }} />
          </div>
          {/* Right: Textarea */}
          <div style={{ minHeight: 208 }}>
            <textarea value={ecName} onChange={e => { setEcName(e.target.value); setErr(''); }}
              placeholder="描述主体、场景、风格与画面细节，可以上传参考图后补充想法。"
              style={{ width: '100%', minHeight: 208, border: 'none', background: 'transparent', fontSize: 15, lineHeight: '28px', color: 'var(--text-primary)', outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
          </div>
        </div>
        {refImages.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {refImages.map((src, i) => (
              <div key={i} style={{ position: 'relative', width: 52, height: 52, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', flexShrink: 0 }}>
                <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div onClick={() => removeRefImage(i)} style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 9 }}>✕</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ 底栏 — 风格选择 + 精修工坊 + 生成 ═══ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 16px 4px' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
          {/* 风格选择 pills */}
          {STYLE_SKILLS_LIST.map(s => {
            const active = styleSkill === s.key;
            return (
              <div key={s.key} onClick={() => setStyleSkill(s.key)}
                style={{
                  padding: '4px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap',
                  transition: 'all 0.12s', lineHeight: '20px',
                  background: active ? 'var(--accent)' : 'rgba(0,0,0,0.04)',
                  color: active ? '#fff' : 'var(--text-muted)',
                  fontWeight: active ? 700 : 500,
                  border: active ? '1px solid var(--accent)' : '1px solid transparent',
                }}>
                {s.emoji} {s.name}
              </div>
            );
          })}
          {/* 精修工坊按钮 */}
          <button onClick={() => setExpertOpen(!expertOpen)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 30, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-full)', background: '#fff', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
            <Settings size={12} /> 精修工坊 {expertOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
        </div>
        <button onClick={doGen} disabled={!canGenerate || generating}
          style={{
            width: 40, height: 40, borderRadius: '50%', border: 'none',
            background: canGenerate && !generating ? 'var(--accent)' : 'var(--border)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: canGenerate && !generating ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s',
            boxShadow: canGenerate && !generating ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
            opacity: generating ? 0.6 : 1,
            flexShrink: 0,
          }}>
          <Sparkles size={16} fill="#fff" />
        </button>
      </div>

      {expertOpen && (
        <div style={{ marginTop: 16 }}>
          <EcExpertPanel
            refShots={refShots} setRefShots={setRefShots}
            refStyles={refStyles} setRefStyles={setRefStyles}
            productParams={productParams} setProductParams={setProductParams}
            skus={skus} setSkus={setSkus}
            copywriting={copywriting} setCopywriting={setCopywriting}
            platform={platform} setPlatform={setPlatform}
          />
        </div>
      )}
      {err && <div style={{ padding: '10px 16px', marginTop: 12, background: '#FEF2F0', borderRadius: 12, color: 'var(--red)', fontSize: 13, fontWeight: 600 }}>{err}</div>}
    </div>
  );
}
