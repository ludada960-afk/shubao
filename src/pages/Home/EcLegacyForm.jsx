import React, { useState, useRef } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { generateEcommerce, extractProductLink, proxyImg } from '../../services/api';
import { EC_CATS, EC_PLATFORMS } from '../../constants/data';

const LABEL = { fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 6, display: 'block' };
const INPUT = {
  width: '100%', padding: '10px 14px', border: '2px solid #e8e8e8', borderRadius: 8,
  fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.2s',
};
const BTN = {
  width: '100%', padding: '13px 0', border: 'none', borderRadius: 10,
  fontSize: 15, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
  background: '#6366F1', color: '#fff', transition: 'all 0.2s',
};
const SECTION = {
  background: '#fff', borderRadius: 12, padding: '20px 24px', marginBottom: 12,
  boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
};

export default function EcLegacyForm() {
  const { state, dispatch } = useApp();
  const [name, setName] = useState('');
  const [cat, setCat] = useState('美妆护肤');
  const [tier, setTier] = useState('basic');
  const [refImgs, setRefImgs] = useState([]);
  const [platform, setPlatform] = useState('淘宝');
  const [points, setPoints] = useState('');
  const [beauty, setBeauty] = useState(false);
  const [stylePack, setStylePack] = useState('');
  const [link, setLink] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [material, setMaterial] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [restrictions, setRestrictions] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const [sizeEnabled, setSizeEnabled] = useState(false);
  const [sizeW, setSizeW] = useState('');
  const [sizeH, setSizeH] = useState('');

  const addImage = (files) => {
    Array.from(files).slice(0, 5 - refImgs.length).forEach(f => {
      const reader = new FileReader();
      reader.onload = (ev) => setRefImgs(p => p.length >= 5 ? p : [...p, ev.target.result]);
      reader.readAsDataURL(f);
    });
  };

  const doGen = async () => {
    if (!name.trim()) return;
    setError('');
    setLoading(true);
    try {
      const data = await generateEcommerce({
        productName: name, category: cat, refImgs, tier, platform, points,
        beautyReport: beauty, stylePack: stylePack || null, material, targetAudience, restrictions,
        imageSize: sizeEnabled && sizeW && sizeH ? { width: +sizeW, height: +sizeH } : null,
      });
      setResult(data);
    } catch (e) {
      setError(e.message || '生成失败');
    }
    setLoading(false);
  };

  const downloadImg = (url, label) => {
    fetch(url?.startsWith('data:') ? url : proxyImg(url)).then(r => r.blob()).then(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${name}-${label}.png`;
      a.click();
    }).catch(() => {});
  };

  if (result) {
    const images = Object.entries(result.images || {});
    return (
      <div style={{ paddingTop: 4 }}>
        <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: 13, color: '#888' }}>商品：</span>
            <span style={{ fontWeight: 600 }}>{result.product_name}</span>
            <span style={{ fontSize: 12, color: '#999', marginLeft: 8 }}>{result.platform} · {result.category} · 共 {images.length} 张</span>
          </div>
          <button onClick={() => setResult(null)} style={{ ...BTN, width: 'auto', padding: '8px 20px', fontSize: 13 }}>继续生成</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {images.map(([label, url]) => (
            <div key={label} style={{ background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600, background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>{label}</div>
              <img src={url?.startsWith('data:') ? url : proxyImg(url)} alt={label} style={{ width: '100%', display: 'block', aspectRatio: '1/1', objectFit: 'cover' }} />
              <button onClick={() => downloadImg(url, label)} style={{ width: '100%', padding: '8px 0', border: 'none', borderTop: '1px solid #f0f0f0', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', background: '#fff', color: '#666' }}>⬇ 下载</button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ===== 表单 ===== */
  return (
    <div style={{ paddingTop: 4 }}>
      {/* 链接提取 */}
      <div style={{ ...SECTION, border: '1px solid #EEF2FF', background: '#F8FAFF' }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
          🔗 粘贴商品链接（可选 — AI 自动填充表单）
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={link} onChange={e => setLink(e.target.value)} placeholder="粘贴淘宝/京东/拼多多链接..."
            style={{ ...INPUT, flex: 1 }} />
          <button onClick={async () => {
            if (!link.trim() || extracting) return;
            setExtracting(true);
            try {
              const data = await extractProductLink(link.trim());
              if (data.title) setName(data.title);
              if (data.category && EC_CATS.includes(data.category)) setCat(data.category);
              if (data.sellingPoints?.length) setPoints(data.sellingPoints.join('\n'));
              if (data.materials) setMaterial(data.materials);
              if (data.images?.length) setRefImgs(data.images.slice(0, 5));
            } catch (e) { setError('提取失败：' + e.message); }
            setExtracting(false);
          }} disabled={extracting || !link.trim()} style={{
            padding: '0 16px', border: 'none', borderRadius: 8,
            background: extracting || !link.trim() ? '#ddd' : '#6366F1',
            color: '#fff', cursor: extracting || !link.trim() ? 'not-allowed' : 'pointer',
            fontSize: 13, fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap',
          }}>
            {extracting ? '分析中...' : '提取并填充'}
          </button>
        </div>
      </div>

      {error && <div style={{ background: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13, color: '#C53030' }}>{error}</div>}

      {/* 参考图 */}
      <div style={SECTION}>
        <div style={LABEL}>📸 商品参考图（可选，最多5张）</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {refImgs.map((src, i) => (
            <div key={i} style={{ position: 'relative', width: 60, height: 60, borderRadius: 8, overflow: 'hidden', border: '2px solid #f0f0f0' }}>
              <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div onClick={() => setRefImgs(p => p.filter((_, j) => j !== i))}
                style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: '#FF4757', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '2px solid #fff', fontWeight: 700 }}>×</div>
            </div>
          ))}
          {refImgs.length < 5 && (
            <div onClick={() => fileRef.current?.click()} style={{ width: 60, height: 60, borderRadius: 8, border: '2px dashed #ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ccc' }}>
              <Upload size={16} />
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" multiple hidden
            onChange={e => { addImage(e.target.files); e.target.value = ''; }} />
        </div>
      </div>

      {/* 基础信息 */}
      <div style={SECTION}>
        <div style={LABEL}>✏️ 基础信息</div>

        <div style={{ marginBottom: 12 }}>
          <div style={LABEL}>商品名称 <span style={{ color: '#E53E3E' }}>*</span></div>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="例如：高保湿精华液、无线蓝牙耳机..."
            style={INPUT} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={LABEL}>品类</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {EC_CATS.map(c => (
              <span key={c} onClick={() => setCat(c)} style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                background: cat === c ? '#6366F1' : '#f5f5f5',
                color: cat === c ? '#fff' : '#555', fontWeight: cat === c ? 600 : 400,
                border: 'none', fontFamily: 'inherit',
              }}>{c}</span>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={LABEL}>卖点文案（一行一个）</div>
          <textarea value={points} onChange={e => setPoints(e.target.value)}
            placeholder={"高保湿锁水\n24小时持久\n敏感肌适用"}
            style={{ ...INPUT, minHeight: 80, resize: 'vertical' }} rows={4} />
        </div>

        {tier === 'complete' && (<>
          <div style={{ marginBottom: 12 }}>
            <div style={LABEL}>材质/规格</div>
            <input value={material} onChange={e => setMaterial(e.target.value)} placeholder="玻尿酸、304不锈钢、纯棉 240g..." style={INPUT} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={LABEL}>目标人群</div>
            <input value={targetAudience} onChange={e => setTargetAudience(e.target.value)} placeholder="25-35岁女性、学生党..." style={INPUT} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={LABEL}>避免的内容</div>
            <input value={restrictions} onChange={e => setRestrictions(e.target.value)} placeholder="不要出现人物、不要手部特写..." style={INPUT} />
          </div>
        </>)}
      </div>

      {/* 生成配置 */}
      <div style={SECTION}>
        <div style={LABEL}>⚙️ 生成配置</div>

        {/* 视觉风格 */}
        <div style={{ marginBottom: 12 }}>
          <div style={LABEL}>视觉风格</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[
              { key: '', label: '通用电商', sub: '风格一致', emoji: '⚪' },
              { key: 'scene_selling', label: '场景卖点', sub: '让买家想象使用场景', emoji: '🌿' },
              { key: 'detail_selling', label: '卖点详情', sub: '减少客服咨询', emoji: '📋' },
              { key: 'ugc_trust', label: '真实感', sub: '提升信任度', emoji: '📱' },
              { key: 'brand_unified', label: '品牌统一', sub: '提升溢价', emoji: '💎' },
              { key: 'promo_sale', label: '促销活动', sub: '大促抓住眼球', emoji: '🏷️' },
            ].map(s => (
              <div key={s.key} onClick={() => setStylePack(s.key)} style={{
                border: `2px solid ${stylePack === s.key ? '#6366F1' : '#eee'}`,
                borderRadius: 10, padding: '10px 12px', cursor: 'pointer', textAlign: 'center',
                background: stylePack === s.key ? '#EEF2FF' : '#fff',
                transition: 'all 0.15s',
              }}>
                <div style={{ fontSize: 20 }}>{s.emoji}</div>
                <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>{s.label}</div>
                <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 平台 */}
        <div style={{ marginBottom: 12 }}>
          <div style={LABEL}>目标平台</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {['淘宝', '京东', '拼多多', '小红书电商', '抖音电商', '亚马逊'].map(p => (
              <span key={p} onClick={() => setPlatform(p)} style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                background: platform === p ? '#6366F1' : '#f5f5f5',
                color: platform === p ? '#fff' : '#555', fontWeight: platform === p ? 600 : 400,
                border: 'none', fontFamily: 'inherit',
              }}>{p}</span>
            ))}
          </div>
        </div>

        {/* 图片数量 */}
        <div style={{ marginBottom: 12 }}>
          <div style={LABEL}>图片数量</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { key: 'basic', label: '基础版', count: '3张', desc: '主图+卖点+场景' },
              { key: 'standard', label: '标准版', count: '5张', desc: '增加细节图+SKU' },
              { key: 'complete', label: '完整版', count: '9张', desc: '增加对比图+包装图' },
            ].map(t => (
              <div key={t.key} onClick={() => setTier(t.key)} style={{
                flex: 1, border: `2px solid ${tier === t.key ? '#6366F1' : '#eee'}`,
                borderRadius: 10, padding: '12px', cursor: 'pointer', textAlign: 'center',
                background: tier === t.key ? '#EEF2FF' : '#fff', transition: 'all 0.15s',
              }}>
                <div style={{ fontSize: 11, color: '#888' }}>{t.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: tier === t.key ? '#4338CA' : '#6366F1', lineHeight: 1.2, margin: '4px 0' }}>{t.count}</div>
                <div style={{ fontSize: 10, color: '#999' }}>{t.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 自定义尺寸 */}
        <div style={{ marginBottom: 12 }}>
          <div style={LABEL}>自定义尺寸（选填）</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#888', cursor: 'pointer', marginBottom: 6 }}>
            <input type="checkbox" checked={sizeEnabled} onChange={e => setSizeEnabled(e.target.checked)}
              style={{ accentColor: '#6366F1' }} />
            自定义宽高（不勾选则用 GPT 默认）
          </label>
          {sizeEnabled && (
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="number" value={sizeW} onChange={e => setSizeW(e.target.value)}
                placeholder="宽 px" style={{ ...INPUT, flex: 1 }} />
              <input type="number" value={sizeH} onChange={e => setSizeH(e.target.value)}
                placeholder="高 px" style={{ ...INPUT, flex: 1 }} />
            </div>
          )}
        </div>

        {cat === '美妆护肤' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#666', cursor: 'pointer', marginTop: 8 }}>
            <input type="checkbox" checked={beauty} onChange={e => setBeauty(e.target.checked)}
              style={{ accentColor: '#6366F1' }} />
            同时生成「美妆分析报告」信息图
          </label>
        )}
      </div>

      <button onClick={doGen} disabled={!name.trim() || loading} style={{
        ...BTN, background: (!name.trim() || loading) ? '#ddd' : '#6366F1',
        cursor: (!name.trim() || loading) ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        {loading ? <Loader2 size={16} className="animate-spin" /> : null}
        {loading ? '生成中...' : '🚀 生成商品图'}
      </button>
    </div>
  );
}
