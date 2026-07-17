import React, { useState, useRef } from 'react';
import { Sparkles, Upload, X, Settings, ChevronDown, ChevronUp, ImagePlus } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import EcExpertPanel from './EcExpertPanel';

/**
 * 电商生图模式 — 灵图风格输入区
 * 保留全部原有字段/功能，视觉层完全复刻灵图
 */
export default function EcMode() {
  const { state, dispatch } = useApp();
  const [ecName, setEcName] = useState('');
  const [err, setErr] = useState('');
  const [expertOpen, setExpertOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const fileRef = useRef(null);

  // 主区域参考图（简单模式也能上传）
  const [refImages, setRefImages] = useState([]);

  // 精修面板参数
  const [refShots, setRefShots] = useState([]);
  const [refStyles, setRefStyles] = useState([]);
  const [productParams, setProductParams] = useState({ category: '', size: '', baseColor: '', accentColor: '', material: '', craft: '' });
  const [skus, setSkus] = useState([]);
  const [copywriting, setCopywriting] = useState({ plan: '', sellingPoints: '', qc: '', details: '', maintenance: '' });
  const [platform, setPlatform] = useState('淘宝');

  // 同步主区域上传到精修面板的 refShots
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
    setErr('');
    setGenerating(true);
    try {
      const preview = await fetch('/api/ecommerce-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_name: ecName.trim(),
          category: productParams.category || '其他',
          selling_points: expertOpen ? copywriting.sellingPoints : '',
          has_material: expertOpen ? !!productParams.material : false,
          skus: expertOpen ? skus : [],
          reference_images: refImages,
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

  // 生成按钮是否可用
  const canGenerate = ecName.trim().length > 0;

  return (
    <div>
      {/* ⭐ 灵图风格 2列布局：左上传 + 右输入 */}
      <div style={{
        display: 'grid', gridTemplateColumns: '112px minmax(0, 1fr)',
        gap: 16, alignItems: 'start',
      }}>
        {/* Left: Upload button (lingtuai style) */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              position: 'relative', width: 90, height: 112,
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 6,
              borderRadius: 16, border: '2px dashed var(--border)',
              background: '#fff',
              boxShadow: '0 14px 36px rgba(57,45,26,0.10)',
              cursor: 'pointer', fontFamily: 'inherit',
              transform: 'rotate(-5deg)',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              overflow: 'hidden',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-4px) rotate(0deg)';
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.boxShadow = '0 20px 46px rgba(57,45,26,0.16)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'rotate(-5deg)';
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.boxShadow = '0 14px 36px rgba(57,45,26,0.10)';
            }}
          >
            <span style={{
              display: 'grid', width: 40, height: 40,
              placeItems: 'center',
              borderRadius: '50%',
              background: '#f8f3ea',
              color: 'var(--text-secondary)',
              boxShadow: '0 10px 24px rgba(57,45,26,0.12)',
              transition: 'transform 0.2s',
            }}
              className="upload-icon-rotate">
              <ImagePlus size={20} />
            </span>
            <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--text-secondary)' }}>
              加图
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>
              最多 10 张
            </span>
          </button>

          {/* Hidden file input */}
          <input ref={fileRef} type="file" accept="image/*" multiple hidden
            onChange={e => {
              const files = Array.from(e.target.files || []);
              const previews = files.map(f => URL.createObjectURL(f));
              addRefImages(previews);
              e.target.value = '';
            }} />
        </div>

        {/* Right: Textarea */}
        <div style={{ minHeight: 110 }}>
          <textarea
            value={ecName} onChange={e => { setEcName(e.target.value); setErr(''); }}
            placeholder="描述主体、场景、风格与画面细节，可以上传参考图后补充想法。"
            style={{
              width: '100%', minHeight: 110,
              border: 'none', background: 'transparent',
              fontSize: 15, lineHeight: 1.8,
              color: 'var(--text-primary)',
              outline: 'none', resize: 'none',
              fontFamily: 'inherit',
            }}
          />
        </div>
      </div>

      {/* Uploaded image previews */}
      {refImages.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {refImages.map((src, i) => (
            <div key={i} style={{
              position: 'relative', width: 56, height: 56,
              borderRadius: 12, overflow: 'hidden',
              border: '1px solid var(--border)',
              flexShrink: 0,
            }}>
              <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div onClick={() => removeRefImage(i)}
                style={{
                  position: 'absolute', top: 2, right: 2,
                  width: 18, height: 18, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.6)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', fontSize: 9,
                }}>✕</div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom bar: expert panel toggle + generate button */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 10, marginTop: 12,
        borderTop: '1px solid var(--border)',
        paddingTop: 12,
      }}>
        {/* Left: controls */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* Expert panel toggle */}
          <button
            onClick={() => setExpertOpen(!expertOpen)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              height: 40, padding: '0 14px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-full)',
              background: '#fff',
              fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
            <Settings size={14} />
            精修工坊
            {expertOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>

        {/* Right: Generate button */}
        <button onClick={doGen} disabled={!canGenerate || generating}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            height: 44, padding: '0 20px 0 14px',
            border: 'none', borderRadius: 'var(--radius-full)',
            background: canGenerate && !generating ? '#fff' : 'rgba(255,255,255,0.6)',
            fontSize: 14, fontWeight: 900,
            color: canGenerate && !generating ? 'var(--text-muted)' : 'var(--text-faint)',
            cursor: canGenerate && !generating ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
            boxShadow: canGenerate && !generating ? '0 14px 36px rgba(57,45,26,0.12)' : 'none',
            transition: 'all 0.2s',
            opacity: generating ? 0.6 : 1,
          }}
          onMouseEnter={e => {
            if (canGenerate && !generating) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 18px 44px rgba(57,45,26,0.18)';
            }
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'none';
            if (canGenerate && !generating) {
              e.currentTarget.style.boxShadow = '0 14px 36px rgba(57,45,26,0.12)';
            }
          }}>
          <span style={{
            display: 'grid', width: 34, height: 34,
            placeItems: 'center',
            borderRadius: '50%',
            background: canGenerate && !generating ? 'var(--accent)' : 'var(--text-faint)',
            color: '#fff',
            transition: 'all 0.2s',
          }}>
            <Sparkles size={16} fill="#fff" />
          </span>
          {generating ? '正在生成...' : '一键生成全套电商图'}
        </button>
      </div>

      {/* Expert Panel (collapsible) */}
      {expertOpen && (
        <div style={{ marginTop: 16 }}>
          <EcExpertPanel
            refShots={refShots}
            setRefShots={setRefShots}
            refStyles={refStyles}
            setRefStyles={setRefStyles}
            productParams={productParams}
            setProductParams={setProductParams}
            skus={skus}
            setSkus={setSkus}
            copywriting={copywriting}
            setCopywriting={setCopywriting}
            platform={platform}
            setPlatform={setPlatform}
          />
        </div>
      )}

      {/* Error */}
      {err && (
        <div style={{
          padding: '10px 16px', marginTop: 12,
          background: '#FEF2F0', borderRadius: 12,
          color: 'var(--red)', fontSize: 13, fontWeight: 600,
        }}>{err}</div>
      )}
    </div>
  );
}
