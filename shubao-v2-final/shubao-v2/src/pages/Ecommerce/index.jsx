import React, { useState, useRef } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { generateEcommerce, proxyImg } from '../../services/api';
import { EC_CATS, EC_STYLES, EC_PLATFORMS, EC_PLATFORM_DESC } from '../../constants/data';
import Button from '../../components/ui/Button';

export default function EcommercePage() {
  const { state, dispatch } = useApp();
  const [name, setName] = useState('');
  const [cat, setCat] = useState('美妆护肤');
  const [refImgs, setRefImgs] = useState([]);
  const [styles, setStyles] = useState(['白底主图', '场景图']);
  const [plat, setPlat] = useState('淘宝');
  const [points, setPoints] = useState('');
  const [gen, setGen] = useState('idle'); // idle | loading | result
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');
  const fileRef = useRef(null);

  const toggleStyle = (s) => setStyles(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);

  const addImage = (files) => {
    Array.from(files).slice(0, 5 - refImgs.length).forEach(f => {
      const reader = new FileReader();
      reader.onload = (ev) => setRefImgs(p => p.length >= 5 ? p : [...p, ev.target.result]);
      reader.readAsDataURL(f);
    });
  };

  const doGen = async () => {
    if (!name.trim()) return;
    setErr('');
    setGen('loading');
    try {
      const data = await generateEcommerce({
        productName: name, category: cat, refImgs, styles, platform: plat, points,
      });
      setResult(data);
      setGen('result');
    } catch (e) {
      setErr(e.message || '生成失败');
      setGen('idle');
    }
  };

  const downloadImg = (url, styleName) => {
    fetch(proxyImg(url)).then(r => r.blob()).then(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${name}-${styleName}.png`;
      a.click();
    });
  };

  return (
    <div style={{ maxWidth: 'var(--max-width-narrow)', margin: '0 auto', padding: '30px 28px' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--weight-heavy)', margin: '0 0 6px' }}>
          🛍️ 电商图生成
        </h1>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: 0 }}>
          上传商品图 → AI 自动生成白底主图 · 场景图 · 详情页 · 组合图
        </p>
      </div>

      {/* Loading */}
      {gen === 'loading' && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Loader2 size={44} style={{ color: 'var(--red)' }} className="animate-spin" />
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)', marginTop: 18, marginBottom: 4 }}>
            正在生成...
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            电商图片生成中（约15-30秒/张）
          </div>
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center', gap: 8 }}>
            {styles.map(s => (
              <span key={s} style={{
                fontSize: 'var(--text-xs)', padding: '4px 12px',
                background: 'var(--border-light)', borderRadius: 'var(--radius-md)',
              }}>{s}</span>
            ))}
          </div>
        </div>
      )}

      {/* Result */}
      {gen === 'result' && result && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>商品：</span>
              <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)' }}>{result.product_name}</span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-hint)', marginLeft: 8 }}>
                {result.platform} · {result.category}
              </span>
            </div>
            <Button small onClick={() => { setGen('idle'); setResult(null); }}>重新生成</Button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
            {Object.entries(result.images || {}).map(([style, url]) => (
              <div key={style} style={{
                background: '#fff', borderRadius: 'var(--radius-lg)', overflow: 'hidden',
                boxShadow: 'var(--shadow-md)',
              }}>
                <div style={{
                  background: 'var(--surface-raised)', padding: '10px 14px',
                  borderBottom: '1px solid var(--border)', fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--weight-semibold)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span>
                    {style === '白底主图' ? '⬜' : style === '场景图' ? '🌄' : style === '详情图' ? '📋' : '🖼️'} {style}
                  </span>
                  <span onClick={() => downloadImg(url, style)} style={{
                    fontSize: 'var(--text-xs)', color: 'var(--red)', cursor: 'pointer',
                  }}>⬇ 下载</span>
                </div>
                <img src={proxyImg(url)} alt={style} style={{
                  width: '100%', display: 'block', aspectRatio: '1/1', objectFit: 'cover',
                }} loading="lazy" />
              </div>
            ))}
          </div>
          {result.errors?.length > 0 && (
            <div style={{
              marginTop: 14, background: '#FFF5F5', borderRadius: 'var(--radius-md)',
              padding: '10px 14px', fontSize: 'var(--text-xs)', color: '#C53030',
            }}>
              {result.errors.map((e, i) => <div key={i}>⚠️ {e.style} 失败: {e.error}</div>)}
            </div>
          )}
        </div>
      )}

      {/* Form */}
      {gen === 'idle' && (
        <div style={{
          borderRadius: 'var(--radius-xl)', background: '#fff',
          padding: 24, boxShadow: 'var(--shadow-md)',
        }}>
          {err && <div style={{
            background: '#FFF5F5', border: '1px solid #FED7D7',
            borderRadius: 'var(--radius-md)', padding: '10px 14px',
            marginBottom: 14, fontSize: 'var(--text-sm)', color: '#C53030',
          }}>{err}</div>}

          {/* 商品名 */}
          <Field label="商品名称 *">
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="例如：高保湿精华液、无线蓝牙耳机、纯棉T恤..."
              style={inputStyle} />
          </Field>

          {/* 品类 */}
          <Field label="品类">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {EC_CATS.map(c => (
                <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Chip>
              ))}
            </div>
          </Field>

          {/* 参考图 */}
          <Field label="商品参考图（可选，最多5张）">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {refImgs.map((src, i) => (
                <div key={i} style={{ position: 'relative', width: 60, height: 60, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '2px solid var(--border)' }}>
                  <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div onClick={() => setRefImgs(p => p.filter((_, j) => j !== i))} style={{
                    position: 'absolute', top: -5, right: -5, width: 16, height: 16,
                    borderRadius: '50%', background: 'var(--red)', color: '#fff',
                    fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', border: '2px solid #fff', fontWeight: 700, lineHeight: 1,
                  }}>×</div>
                </div>
              ))}
              {refImgs.length < 5 && (
                <div onClick={() => fileRef.current?.click()} style={{
                  width: 60, height: 60, borderRadius: 'var(--radius-md)',
                  border: '2px dashed var(--border-hover)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-ghost)',
                }}>
                  <Upload size={16} />
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" multiple hidden
                onChange={e => { addImage(e.target.files); e.target.value = ''; }} />
            </div>
          </Field>

          {/* 风格 */}
          <Field label="生成风格（可多选）">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {EC_STYLES.map(s => (
                <Chip key={s} active={styles.includes(s)} onClick={() => toggleStyle(s)} outlined>
                  {s}{styles.includes(s) ? ' ✓' : ''}
                </Chip>
              ))}
            </div>
          </Field>

          {/* 平台 */}
          <Field label="目标平台">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {EC_PLATFORMS.map(p => (
                <Chip key={p} active={plat === p} onClick={() => setPlat(p)}>{p}</Chip>
              ))}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-faint)', marginTop: 4 }}>
              {EC_PLATFORM_DESC[plat] || plat} · 按平台规范适配图片尺寸
            </div>
          </Field>

          {/* 卖点 */}
          <Field label="卖点文案（可选）">
            <textarea value={points} onChange={e => setPoints(e.target.value)}
              placeholder="例如：高保湿、24小时持久、敏感肌适用..."
              style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }} />
          </Field>

          <button onClick={doGen} disabled={!name.trim()} style={{
            width: '100%', padding: '13px 0', border: 'none',
            borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-base)',
            fontWeight: 'var(--weight-semibold)', fontFamily: 'inherit',
            background: !name.trim() ? 'var(--border)' : 'var(--red)',
            color: '#fff', cursor: !name.trim() ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s', marginTop: 4,
          }}>
            🛍️ 生成电商图片
          </button>

          <div style={{
            marginTop: 16, background: '#FFF8F6', borderRadius: 'var(--radius-md)',
            padding: '12px 16px', fontSize: 'var(--text-xs)', color: 'var(--text-hint)', lineHeight: 1.8,
          }}>
            · GPT Image 2 生成，支持多参考图高保真合成<br />
            · 不同平台自动适配对应尺寸<br />
            · 上传商品图效果更好，建议3-5张不同角度实拍
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 子组件 ── */
function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{
        fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
        color: 'var(--text-secondary)', marginBottom: 6, display: 'block',
      }}>{label}</label>
      {children}
    </div>
  );
}

function Chip({ children, active, onClick, outlined }) {
  return (
    <button onClick={onClick} style={{
      padding: '7px 16px', borderRadius: 'var(--radius-md)',
      fontSize: 'var(--text-sm)', fontFamily: 'inherit', cursor: 'pointer',
      fontWeight: active ? 'var(--weight-semibold)' : 'var(--weight-normal)',
      background: active ? (outlined ? 'var(--red-bg)' : 'var(--red)') : (outlined ? '#fff' : 'var(--border-light)'),
      color: active ? (outlined ? 'var(--red)' : '#fff') : 'var(--text-secondary)',
      border: outlined ? (active ? '2px solid var(--red)' : '1px solid var(--border-hover)') : 'none',
      transition: 'all var(--duration-fast)',
    }}>
      {children}
    </button>
  );
}

const inputStyle = {
  width: '100%', padding: '12px 14px',
  border: '2px solid var(--border)', borderRadius: 'var(--radius-lg)',
  fontSize: 'var(--text-sm)', fontFamily: 'inherit', outline: 'none',
  boxSizing: 'border-box', transition: 'border-color 0.2s',
};
