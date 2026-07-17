import React, { useState, useRef } from 'react';
import { Sparkles, Upload, X, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import EcExpertPanel from './EcExpertPanel';

/**
 * 电商生图模式 — 统一入口（简单输入 + 主区域参考图 + 折叠精修面板）
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
    // 同步到精修面板
    const asShot = newImgs.map(url => ({ preview: url }));
    setRefShots(prev => [...prev, ...asShot].slice(0, 10));
  };

  const removeRefImage = (i) => {
    setRefImages(prev => {
      const next = [...prev]; next.splice(i, 1); return next;
    });
    setRefShots(prev => {
      const next = [...prev]; next.splice(i, 1); return next;
    });
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

  return (
    <div>
      {/* 一句话输入 */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <textarea
          value={ecName} onChange={e => { setEcName(e.target.value); setErr(''); }}
          placeholder=" "
          style={{
            width: '100%', border: 'none', background: 'transparent',
            fontSize: 18, color: 'var(--text-primary)',
            outline: 'none', resize: 'none', minHeight: 52,
            lineHeight: 1.7,
          }}
        />
        {!ecName && (
          <div style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
            <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-hint)', marginBottom: 4 }}>
              ✍️ 一句话描述你的商品
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-faint)' }}>
              例如：白色陶瓷杯简约办公风 / 无线蓝牙耳机运动款
            </div>
          </div>
        )}
      </div>

      {/* ⭐ 主区域参考图上传（简单模式也可用） */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div onClick={() => fileRef.current?.click()}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 18px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--border)',
              background: 'rgba(255,255,255,0.6)',
              cursor: 'pointer', fontSize: 13, fontWeight: 500,
              color: 'var(--text-muted)',
              transition: 'all 0.12s',
            }}>
            <Upload size={15} />
            上传参考图
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            上传商品实拍图、尺寸图，AI 参照生成更精准
          </span>
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden
          onChange={e => {
            const files = Array.from(e.target.files || []);
            const previews = files.map(f => URL.createObjectURL(f));
            addRefImages(previews);
            e.target.value = '';
          }} />
        {refImages.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {refImages.map((src, i) => (
              <div key={i} style={{
                position: 'relative', width: 64, height: 64,
                borderRadius: 'var(--radius-sm)', overflow: 'hidden',
                border: '1px solid var(--border)',
              }}>
                <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div onClick={() => removeRefImage(i)}
                  style={{
                    position: 'absolute', top: 1, right: 1,
                    width: 16, height: 16, borderRadius: '50%',
                    background: 'var(--text-muted)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', fontSize: 8, opacity: 0.8,
                  }}>✕</div>
              </div>
            ))}
            {refImages.length < 10 && (
              <div onClick={() => fileRef.current?.click()}
                style={{
                  width: 64, height: 64,
                  borderRadius: 'var(--radius-sm)',
                  border: '2px dashed var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--text-faint)', fontSize: 18,
                }}>+</div>
            )}
          </div>
        )}
      </div>

      {/* 精修工坊入口 */}
      <div onClick={() => setExpertOpen(!expertOpen)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', borderRadius: 'var(--radius-md)',
          background: 'var(--accent-bg)', cursor: 'pointer',
          marginBottom: 0,
          transition: 'all 0.2s',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Settings size={15} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
            精修工坊
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
            — 需要更多控制？展开深度定制参数
          </span>
        </div>
        {expertOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </div>

      {expertOpen && (
        <div style={{ marginTop: 12 }}>
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

      {err && <div style={{ padding: '10px 16px', marginTop: 12, background: 'var(--red-bg)', borderRadius: 'var(--radius-md)', color: 'var(--red)', fontSize: 13, fontWeight: 500 }}>{err}</div>}

      <button onClick={doGen} disabled={!ecName.trim() || generating}
        className="btn-pill btn-primary"
        style={{
          width: '100%', marginTop: 18, height: 48, fontSize: 16,
          opacity: !ecName.trim() ? 0.45 : 1,
        }}>
        <Sparkles size={18} />
        {generating ? '正在生成...' : '一键生成全套电商图'}
      </button>

      <div style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: 'var(--text-faint)' }}>
        {expertOpen
          ? '✨ 专业模式 — 按你的精确参数生成'
          : refImages.length > 0
            ? `📷 已上传 ${refImages.length} 张参考图，AI 将参照实拍图生成`
            : '输入商品描述，可上传参考图让生成更精准'}
      </div>
    </div>
  );
}
