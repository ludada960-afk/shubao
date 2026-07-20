import React, { useState, useEffect, useRef } from 'react';
import { MdAutoAwesome, MdArrowBack, MdRefresh, MdCheck, MdAddPhotoAlternate } from 'react-icons/md';
import { getDesignDirections, generateEcommerce, saveWork, polishECText } from '../../../services/api';
import { useApp } from '../../../store/AppContext';

/* ═══════ 设计方向确认页（三段式第二步）═══ */
export default function DesignDirection({ params, onBack, onGenerated }) {
  const { state, dispatch } = useApp();
  const [loading, setLoading] = useState(true);
  const [loadStage, setLoadStage] = useState(0); // 0=产品分析, 1=参考图分析, 2=生成方案
  const [directions, setDirections] = useState([]);
  const [selected, setSelected] = useState(0);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [polishing, setPolishing] = useState(false);

  // 补充输入
  const [extraDesc, setExtraDesc] = useState(params?.description || '');
  // 补充上传图片
  const [extraImages, setExtraImages] = useState([]);
  const extraImgRef = useRef(null);

  useEffect(() => {
    loadDirections();
  }, []);

  const loadDirections = async () => {
    setLoading(true);
    setError('');
    setLoadStage(0);
    try {
      const timer1 = setTimeout(() => setLoadStage(1), 2000);
      const timer2 = setTimeout(() => setLoadStage(2), 4000);

      // 补充图片转 base64 并合并到 ref_shots
      const extraBase64 = (await Promise.all(extraImages.map(img => new Promise(resolve => {
        if (img.url.startsWith('data:')) { resolve(img.url); return; }
        fetch(img.url).then(r => r.blob()).then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        }).catch(() => resolve(null));
      })))).filter(Boolean);

      const res = await getDesignDirections({
        product_name: params?.productName || params?.description?.slice(0, 20) || '商品',
        description: extraDesc || params?.description || '',
        category: params?.category || '其他',
        real_shots: params?.realShots || [],
        ref_shots: [...(params?.refShots || []), ...extraBase64],
        platform: params?.platform || 'smart',
        style_skill: params?.styleSkill || 'smart',
        product_params: params?.productParams || {},
        skus: params?.skus || [],
        copywriting: params?.copywriting || {},
      });

      clearTimeout(timer1);
      clearTimeout(timer2);
      setLoadStage(3);

      setDirections(res.directions || []);
      setAnalysis(res.analysis || null);
      if (res.directions?.length) setSelected(0);
    } catch (e) {
      setError(e.message || '加载失败');
    }
    setLoading(false);
  };

  /* ── AI 润色文案 ── */
  const handlePolish = async () => {
    if (!extraDesc.trim() || polishing) return;
    setPolishing(true);
    try {
      const result = await polishECText({ text: extraDesc, product_name: params?.productName || '商品', category: params?.category || '其他' });
      if (result?.polished) setExtraDesc(result.polished);
    } catch (e) { console.warn('[polish]', e.message); }
    setPolishing(false);
  };

  /* ── 补充图片上传 ── */
  const handleExtraImgUpload = (e) => {
    const files = Array.from(e.target.files || []);
    setExtraImages(prev => [...prev, ...files.map(f => ({ url: URL.createObjectURL(f), file: f }))]);
  };

  /* ── 确认方向 → 生成 ── */
  const handleConfirm = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const dir = directions[selected];
      const result = await generateEcommerce({
        productName: params?.productName || params?.description?.slice(0, 20) || '商品',
        category: params?.category || '其他',
        points: params?.copywriting?.sellingPoints || params?.description || '',
        platform: params?.platform || '淘宝',
        refImgs: [...(params?.refShots || [])],
        realShots: [...(params?.realShots || [])],
        skus: params?.skus || [],
        detailPlan: params?.copywriting?.detailPlan || {},
        maintenance: params?.copywriting?.maintenance || '',
        material: params?.productParams?.material || '',
        onProgress: (d) => { /* SSE progress events */ },
        onImage: (d) => { /* SSE image events */ },
      });
      if (result && (result.images || result.product_name)) {
        const finalResult = { ...result, product_name: params?.productName || '商品', _ecResult: true, _direction: dir, category: params?.category || '其他', platform: params?.platform || '淘宝' };

        // ★ 立即保存到服务器作品集
        const phone = state.phone || 'guest';
        const imageEntries = Object.entries(finalResult.images || {});
        const serverWork = {
          product_name: finalResult.product_name,
          category: finalResult.category,
          platform: finalResult.platform,
          _ecResult: true,
          at: new Date().toLocaleDateString('zh-CN'),
          images: imageEntries.map(([key, url]) => ({ url, key, label: key, style: key })),
        };
        try {
          await saveWork(serverWork, phone);
          console.log('[EC] ★ 作品已保存到服务器:', finalResult.product_name);
        } catch (e) {
          console.warn('[EC] 服务器保存失败:', e.message);
        }

        // 存储结果到全局 state 并跳转到画布
        dispatch({ type: 'SET_RESULT', result: finalResult });
        dispatch({ type: 'NAVIGATE', page: 'ec-canvas' });
        onGenerated?.();
      } else {
        setError('生成失败，请重试');
      }
    } catch (e) {
      setError(e.message || '生成失败');
    }
    setGenerating(false);
  };

  const LOAD_STAGES = [
    { label: 'VLM 解析产品图', desc: '锁定外形、材质、配色...' },
    { label: 'VLM 解析参考图', desc: '提取光影氛围、布景调性...' },
    { label: '生成设计方案', desc: 'AI 设计师构思差异化方向...' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 100 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 16px' }}>
        {/* ── 顶部导航 ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div onClick={onBack} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '8px 14px', borderRadius: 12,
            background: '#fff', border: '1px solid rgba(0,0,0,0.08)',
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
            color: 'var(--text-secondary)', transition: 'all 0.15s',
          }}>
            <MdArrowBack size={16} /> 返回
          </div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1a1a1a' }}>
            确认设计方向
          </h2>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 4 }}>
            AI 已为你的产品设计了多套视觉方案
          </span>
        </div>

        {/* ── 加载进度 ── */}
        {loading && (
          <div style={{
            background: '#fff', borderRadius: 16, padding: '32px 28px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
            border: '1px solid rgba(0,0,0,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <MdAutoAwesome size={20} style={{ color: '#7c3aed', animation: 'spin 1.5s linear infinite' }} />
              <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>AI 正在分析产品并设计方案…</span>
            </div>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            {LOAD_STAGES.map((stage, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 0',
                opacity: loadStage >= i ? 1 : 0.35,
                transition: 'opacity 0.4s',
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                  background: loadStage > i ? '#22c55e' : loadStage === i ? '#7c3aed' : '#e5e7eb',
                  color: loadStage >= i ? '#fff' : '#9ca3af',
                  transition: 'all 0.3s',
                }}>
                  {loadStage > i ? '✓' : i + 1}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: loadStage >= i ? '#1a1a1a' : '#9ca3af' }}>{stage.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{stage.desc}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── 错误 ── */}
        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12,
            padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 13, color: '#dc2626' }}>{error}</span>
            <div onClick={loadDirections} style={{
              marginLeft: 'auto', padding: '4px 12px', borderRadius: 8,
              background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
            }}>重试</div>
          </div>
        )}

        {/* ── 方向卡片 ── */}
        {!loading && directions.length > 0 && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 24 }}>
              {directions.map((dir, i) => {
                const active = selected === i;
                return (
                  <div key={dir.id} onClick={() => setSelected(i)}
                    style={{
                      background: '#fff', borderRadius: 16, padding: 0,
                      cursor: 'pointer', overflow: 'hidden',
                      border: `2px solid ${active ? '#1a1a1a' : 'rgba(0,0,0,0.06)'}`,
                      boxShadow: active ? '0 4px 20px rgba(0,0,0,0.12)' : '0 2px 8px rgba(0,0,0,0.04)',
                      transition: 'all 0.2s',
                      position: 'relative',
                    }}>
                    {/* 色调预览条 */}
                    <div style={{
                      height: 6,
                      background: dir.preview_colors?.length
                        ? `linear-gradient(90deg, ${dir.preview_colors.join(', ')})`
                        : 'linear-gradient(90deg, #f5f5f5, #333)',
                    }} />

                    <div style={{ padding: '16px 18px' }}>
                      {/* 标题 + 选中标记 */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1a1a1a' }}>{dir.title}</h3>
                        {active && (
                          <div style={{
                            width: 22, height: 22, borderRadius: '50%',
                            background: '#1a1a1a', color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}><MdCheck size={14} /></div>
                        )}
                      </div>

                      {/* 视觉调性标签 */}
                      {dir.visual_tone && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                          {dir.visual_tone.split(/[·/、]/).map((t, j) => (
                            <span key={j} style={{
                              padding: '2px 8px', borderRadius: 6,
                              background: active ? 'rgba(26,26,26,0.06)' : 'rgba(0,0,0,0.03)',
                              fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
                            }}>{t.trim()}</span>
                          ))}
                        </div>
                      )}

                      {/* 描述 */}
                      <p style={{
                        margin: 0, fontSize: 13, lineHeight: 1.6,
                        color: 'var(--text-secondary)',
                        display: '-webkit-box', WebkitLineClamp: 4,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>{dir.description}</p>

                      {/* 色块预览 */}
                      {dir.preview_colors?.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
                          {dir.preview_colors.map((c, j) => (
                            <div key={j} style={{
                              width: 24, height: 24, borderRadius: 6,
                              background: c, border: '1px solid rgba(0,0,0,0.08)',
                            }} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── 底部二次调整区 ── */}
            <div style={{
              background: '#fff', borderRadius: 16, padding: '18px 20px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
              border: '1px solid rgba(0,0,0,0.06)',
              marginBottom: 20,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', marginBottom: 12 }}>补充调整</div>

              {/* 补充上传图片 */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 8 }}>
                  补充参考图 <span style={{ fontWeight: 400 }}>· 追加产品图或竞品图，AI 重新优化方向</span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {extraImages.map((img, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                      <img src={img.url} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)' }} />
                      <div onClick={() => setExtraImages(prev => prev.filter((_, idx) => idx !== i))}
                        style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, cursor: 'pointer' }}>×</div>
                    </div>
                  ))}
                  <div onClick={() => extraImgRef.current?.click()}
                    style={{ width: 56, height: 56, borderRadius: 8, border: '2px dashed rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, cursor: 'pointer', transition: 'all 0.15s', background: '#fafafa' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#7c3aed'; e.currentTarget.style.background = 'rgba(124,58,237,0.04)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)'; e.currentTarget.style.background = '#fafafa'; }}>
                    <MdAddPhotoAlternate size={16} style={{ color: '#aaa' }} />
                    <span style={{ fontSize: 8, color: '#bbb', fontWeight: 600 }}>添加图片</span>
                  </div>
                  <input ref={extraImgRef} type="file" accept="image/*" multiple hidden onChange={handleExtraImgUpload} />
                </div>
              </div>

              {/* 补充描述 + AI 润色 */}
              <div style={{ position: 'relative' }}>
                <textarea value={extraDesc} onChange={e => setExtraDesc(e.target.value)}
                  placeholder="补充描述或修改需求…AI 会根据你的调整重新优化方向"
                  style={{
                    width: '100%', minHeight: 64, padding: '10px 14px', paddingRight: 90, borderRadius: 10,
                    border: '1px solid rgba(0,0,0,0.08)', background: 'rgba(0,0,0,0.01)',
                    fontSize: 13, lineHeight: 1.6, color: '#1a1a1a',
                    outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box',
                  }} />
                {/* AI 润色按钮 */}
                <div onClick={handlePolish}
                  style={{
                    position: 'absolute', right: 8, top: 8,
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '5px 10px', borderRadius: 8,
                    background: polishing ? '#e5e5e5' : 'linear-gradient(135deg, #7c3aed, #a78bfa)',
                    color: '#fff', fontSize: 11, fontWeight: 700, cursor: polishing ? 'wait' : 'pointer',
                    transition: 'all 0.15s', whiteSpace: 'nowrap',
                    opacity: extraDesc.trim() ? 1 : 0.4, pointerEvents: extraDesc.trim() ? 'auto' : 'none',
                  }}>
                  <MdAutoAwesome size={12} style={{ animation: polishing ? 'spin 1s linear infinite' : 'none' }} />
                  {polishing ? '润色中…' : 'AI 润色'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <div onClick={loadDirections}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '8px 16px', borderRadius: 10,
                    border: '1.5px solid rgba(0,0,0,0.1)',
                    cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    color: 'var(--text-secondary)', transition: 'all 0.15s',
                  }}>
                  <MdRefresh size={14} /> 重新生成方向
                </div>
              </div>
            </div>

            {/* ── 确认按钮 ── */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button onClick={handleConfirm} disabled={generating}
                style={{
                  padding: '14px 48px', borderRadius: 25,
                  border: 'none', fontSize: 16, fontWeight: 800,
                  fontFamily: 'inherit',
                  background: generating ? '#ddd' : 'linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #f59e0b 100%)',
                  color: '#fff', cursor: generating ? 'not-allowed' : 'pointer',
                  boxShadow: generating ? 'none' : '0 6px 24px rgba(124,58,237,0.35)',
                  transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                {generating ? (
                  <><MdAutoAwesome size={18} style={{ animation: 'spin 1s linear infinite' }} /> 生成中…</>
                ) : (
                  <>确认方向，开始生成 <span style={{ fontSize: 18 }}>→</span></>
                )}
              </button>
            </div>
          </>
        )}

        {/* ── 无方向数据 ── */}
        {!loading && !error && directions.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '60px 20px',
            color: 'var(--text-muted)', fontSize: 14,
          }}>
            <p>未生成设计方向，请检查输入后重试</p>
            <div onClick={loadDirections} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '8px 18px', borderRadius: 10,
              background: '#1a1a1a', color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              marginTop: 12,
            }}>重试</div>
          </div>
        )}
      </div>
    </div>
  );
}
