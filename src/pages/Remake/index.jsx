/**
 * 薯包AI · AI 复刻页面
 *
 * 浏览器插件提取图片 → AI 分析展示 → 用户替换商品 → 重新生成
 */

import React, { useState, useEffect, useCallback } from 'react';
import { MdArrowBack, MdAutoAwesome, MdRefresh, MdDownload } from 'react-icons/md';
import { useApp } from '../../store/AppContext';
const EXT_API = '';
import Button from '../../components/ui/Button';
import Footer from '../../components/layout/Footer';

const EC_TIERS = [
  { key: 'basic', label: '基础版', count: 3, desc: '白底主图+卖点+场景' },
  { key: 'standard', label: '标准版', count: 5, desc: '+细节+第二卖点' },
  { key: 'complete', label: '完整版', count: 9, desc: '+对比+规格+包装' },
];

const EC_PLATFORMS = ['淘宝', '京东', '拼多多', '小红书电商', '抖音电商', '亚马逊'];

export default function RemakePage() {
  const { dispatch } = useApp();

  // Task state
  const [taskId, setTaskId] = useState('');
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState('');

  // User input
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('美妆护肤');
  const [sellingPoints, setSellingPoints] = useState('');
  const [tier, setTier] = useState('basic');
  const [platform, setPlatform] = useState('淘宝');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [prevProductName, setPrevProductName] = useState('');

  // Parse taskId from URL hash or search params
  useEffect(() => {
    // 从 hash 中提取：#/remake?task=xxx
    const hash = window.location.hash;
    const m = hash.match(/task=([a-z0-9_]+)/);
    if (m) {
      setTaskId(m[1]);
      return;
    }
    // 从查询参数中提取：?task=xxx
    const params = new URLSearchParams(window.location.search);
    const t = params.get('task');
    if (t) setTaskId(t);
  }, []);

  // Poll task status
  const pollTask = useCallback(async (id) => {
    setPolling(true);
    try {
      const res = await fetch(`${EXT_API}/api/extension/task/${id}`);
      const data = await res.json();
      if (data.ok) {
        setTask(data);
        // Update user input from original title
        if (data.title && !productName) {
          setProductName(data.title);
          setPrevProductName(data.title);
        }
        // If completed, stop polling
        if (data.status === 'completed' || data.status === 'failed') {
          setPolling(false);
          if (data.status === 'completed') setGenerated(true);
        }
        return data;
      }
    } catch (err) {
      console.error('Poll failed:', err);
    }
    setPolling(false);
    return null;
  }, [productName]);

  // Start polling when taskId is set
  useEffect(() => {
    if (!taskId) return;
    const interval = setInterval(async () => {
      const result = await pollTask(taskId);
      if (result?.status === 'completed' || result?.status === 'failed') {
        clearInterval(interval);
      }
    }, 2000);
    // Immediate first poll
    pollTask(taskId);
    return () => clearInterval(interval);
  }, [taskId, pollTask]);

  // 触发 AI 分析
  const startAnalysis = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${EXT_API}/api/extension/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });
      const data = await res.json();
      if (!data.ok) setError(data.error || '分析失败');
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  // 自动触发分析（当图片下载完成后）
  useEffect(() => {
    if (task?.status === 'downloaded' && taskId) {
      startAnalysis();
    }
  }, [task?.status]);

  // 重新生成
  const handleGenerate = async () => {
    if (!productName.trim()) return;
    setGenerating(true);
    setError('');
    try {
      const res = await fetch(`${EXT_API}/api/extension/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          productName: productName.trim(),
          category,
          sellingPoints: sellingPoints.split('\n').filter(Boolean).map(s => s.trim()),
          tier,
          platform,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || '生成失败');
      } else {
        // 开始轮询
        setGenerated(false);
        // Re-trigger polling
        const interval = setInterval(async () => {
          const result = await pollTask(taskId);
          if (result?.status === 'completed' || result?.status === 'failed') {
            clearInterval(interval);
            setGenerating(false);
          }
        }, 2000);
      }
    } catch (err) {
      setError(err.message);
      setGenerating(false);
    }
  };

  // Status display
  const statusBadge = () => {
    if (!task) return <span className="rmk-badge" style={{ background: '#f3f4f6', color: '#6b7280' }}>等待中</span>;
    const status = task.status;
    switch (status) {
      case 'pending':     return <span className="rmk-badge" style={{ background: '#fef9c3', color: '#854d0e' }}>排队中</span>;
      case 'downloading': return <span className="rmk-badge" style={{ background: '#dbeafe', color: '#1e40af' }}>下载图片中 ({task.progress}%)</span>;
      case 'downloaded':  return <span className="rmk-badge" style={{ background: '#dcfce7', color: '#166534' }}>下载完成 ✓</span>;
      case 'analyzing':   return <span className="rmk-badge" style={{ background: '#fef9c3', color: '#854d0e' }}>AI 分析中 ({task.progress}%)</span>;
      case 'analyzed':    return <span className="rmk-badge" style={{ background: '#dcfce7', color: '#166534' }}>分析完成 ✓</span>;
      case 'generating':  return <span className="rmk-badge" style={{ background: '#fef9c3', color: '#854d0e' }}>生成中 ({task.progress}%)</span>;
      case 'completed':   return <span className="rmk-badge" style={{ background: '#dcfce7', color: '#166534' }}>✅ 生成完成</span>;
      case 'failed':      return <span className="rmk-badge" style={{ background: '#fee2e2', color: '#991b1b' }}>❌ 失败</span>;
      default:            return <span className="rmk-badge" style={{ background: '#f3f4f6', color: '#6b7280' }}>{status}</span>;
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '32px 20px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <button onClick={() => dispatch({ type: 'NAVIGATE', page: 'home' })} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
            color: 'var(--text-muted)', fontSize: 18,
          }}><MdArrowBack size={20} /></button>
          <div>
            <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-heavy)', margin: 0 }}>
              🎨 AI 复刻
            </h1>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-hint)', margin: '2px 0 0' }}>
              分析竞品图片 → 替换成你的商品 → 一键生成
            </p>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            {statusBadge()}
          </div>
        </div>

        {error && (
          <div style={{
            padding: '10px 16px', background: '#fee2e2', color: '#991b1b',
            borderRadius: 'var(--radius-md)', marginBottom: 20, fontSize: 'var(--text-sm)',
          }}>{error}</div>
        )}

        {!taskId && (
          <div style={{
            padding: '60px 20px', textAlign: 'center', color: 'var(--text-hint)',
            border: '2px dashed var(--border-light)', borderRadius: 'var(--radius-lg)',
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🛒</div>
            <h2 style={{ fontSize: 'var(--text-xl)', margin: '0 0 8px' }}>还没有任务</h2>
            <p style={{ fontSize: 'var(--text-sm)', maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>
              使用浏览器插件从电商页面提取商品图片，
              <br />然后插件会自动跳转到这个页面。
            </p>
            <div style={{ marginTop: 20, fontSize: 'var(--text-xs)', color: 'var(--border-light)' }}>
              已安装插件？打开淘宝/京东/Amazon 商品页，点击插件按钮即可开始
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
              <input id="manualTaskId" placeholder="或手动输入任务编号"
                style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-light)', fontSize: 12, width: 220, fontFamily: 'inherit' }} />
              <button onClick={() => {
                const v = document.getElementById('manualTaskId')?.value?.trim();
                if (v) { setTaskId(v); setError(''); }
              }} style={{
                padding: '8px 16px', borderRadius: 6, border: 'none',
                background: '#7c3aed', color: '#fff', fontSize: 12,
                cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
              }}>继续</button>
            </div>
          </div>
        )}

        {/* Loading */}
        {taskId && (!task || task.status === 'pending' || task.status === 'downloading') && (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <MdRefresh size={32} className="spin" style={{ color: 'var(--blue)', marginBottom: 16 }} />
            <p style={{ color: 'var(--text-hint)' }}>正在下载图片并分析中...</p>
            {task && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-invisible)', marginTop: 4 }}>
              {task.downloadedImages?.length || 0}/{task.imageCount || 0} 张已下载
            </p>}
          </div>
        )}

        {/* Analyzed - show analysis results + replace form */}
        {task?.analysis && (
          <>
            {/* Original images with analysis */}
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)', marginBottom: 12 }}>
                原图分析 ({task.analysis.images?.length || 0} 张)
              </h2>
              <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
                {(task.analysis.images || []).map((img, i) => (
                  <div key={i} style={{
                    minWidth: 200, maxWidth: 240, flex: '0 0 auto',
                    background: '#fff', borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)', overflow: 'hidden',
                  }}>
                    {/* Thumbnail */}
                    <div style={{
                      width: '100%', height: 160, background: '#f5f5f5',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden',
                    }}>
                      <img src={img.url} alt=""
                        onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.textContent = '📷'; }}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    {/* Analysis */}
                    <div style={{ padding: '10px 12px', fontSize: 'var(--text-xs)', lineHeight: 1.5 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 'var(--text-sm)' }}>
                        {img.subject?.slice(0, 30) || `图片 ${i + 1}`}
                      </div>
                      <div style={{ color: 'var(--text-hint)' }}>
                        <div>📐 {img.layout}</div>
                        <div>💡 {img.lighting}</div>
                        <div>🎨 {img.background}</div>
                        <div>🎭 {img.mood}</div>
                        {img.colors?.length > 0 && (
                          <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
                            {img.colors.slice(0, 4).map((c, ci) => (
                              <span key={ci} style={{
                                display: 'inline-block', width: 14, height: 14, borderRadius: '50%',
                                background: c, border: '1px solid #ddd',
                              }} title={c} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Replacement Form */}
            <div style={{
              background: '#fff', borderRadius: 'var(--radius-lg)',
              border: '2px solid var(--blue)', padding: 24, marginBottom: 28,
            }}>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)', marginBottom: 16 }}>
                🔄 替换成你的商品
              </h2>

              <div style={{ display: 'grid', gap: 14 }}>
                <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                  商品名称
                  <input value={productName} onChange={e => setProductName(e.target.value)}
                    placeholder="输入你的商品名称"
                    style={{
                      display: 'block', width: '100%', marginTop: 4, padding: '10px 14px',
                      borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)',
                      fontSize: 'var(--text-base)', fontFamily: 'inherit',
                    }} />
                </label>

                <div style={{ display: 'flex', gap: 14 }}>
                  <label style={{ flex: 1, fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                    品类
                    <select value={category} onChange={e => setCategory(e.target.value)}
                      style={{
                        display: 'block', width: '100%', marginTop: 4, padding: '10px 14px',
                        borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)',
                        fontSize: 'var(--text-base)', fontFamily: 'inherit', background: '#fff',
                      }}>
                      {['美妆护肤', '数码3C', '食品饮料', '服饰穿搭', '家居生活', '母婴用品', '宠物用品', '其他'].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ flex: 1, fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                    目标平台
                    <select value={platform} onChange={e => setPlatform(e.target.value)}
                      style={{
                        display: 'block', width: '100%', marginTop: 4, padding: '10px 14px',
                        borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)',
                        fontSize: 'var(--text-base)', fontFamily: 'inherit', background: '#fff',
                      }}>
                      {EC_PLATFORMS.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                  卖点文案（一行一个卖点）
                  <textarea value={sellingPoints} onChange={e => setSellingPoints(e.target.value)}
                    placeholder="例如：&#10;128G 超大存储&#10;续航 15 小时&#10;军工级防摔"
                    rows={3}
                    style={{
                      display: 'block', width: '100%', marginTop: 4, padding: '10px 14px',
                      borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)',
                      fontSize: 'var(--text-base)', fontFamily: 'inherit', resize: 'vertical',
                    }} />
                </label>

                {/* Tier selector */}
                <div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 8 }}>生成等级</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {EC_TIERS.map(t => (
                      <span key={t.key} onClick={() => setTier(t.key)} style={{
                        padding: '8px 16px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                        fontSize: 'var(--text-sm)', fontWeight: tier === t.key ? 700 : 500,
                        background: tier === t.key ? 'var(--blue-bg)' : 'var(--border-light)',
                        color: tier === t.key ? '#3730A3' : 'var(--text-muted)',
                        border: tier === t.key ? '2px solid var(--blue)' : '2px solid transparent',
                        transition: 'all .1s',
                      }}>
                        {t.label} <span style={{ fontSize: 10, opacity: 0.7 }}>({t.count}张)</span>
                        <div style={{ fontSize: 10, opacity: 0.6, fontWeight: 400, marginTop: 2 }}>{t.desc}</div>
                      </span>
                    ))}
                  </div>
                </div>

                <button onClick={handleGenerate} disabled={generating || !productName.trim()} style={{
                  padding: '14px 0', borderRadius: 'var(--radius-lg)', border: 'none',
                  fontSize: 'var(--text-base)', fontWeight: 700, fontFamily: 'inherit',
                  cursor: generating ? 'not-allowed' : 'pointer',
                  background: generating ? 'var(--border-light)' : 'linear-gradient(135deg, #7c3aed, #6366f1)',
                  color: generating ? 'var(--text-muted)' : '#fff',
                  boxShadow: generating ? 'none' : '0 3px 12px rgba(99,102,241,.3)',
                  marginTop: 8, transition: 'all .15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                  {generating ? <MdRefresh size={18} className="spin" /> : <MdAutoAwesome size={18} />}
                  {generating ? '生成中，请稍候...' : '🚀 一键复刻生成'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Generated Results */}
        {task?.generatedImages?.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)', marginBottom: 12 }}>
              ✨ 生成结果 ({task.generatedImages.filter(g => g.url).length}/{task.generatedImages.length})
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {task.generatedImages.map((img, i) => (
                <div key={i} style={{
                  background: '#fff', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-light)', overflow: 'hidden',
                }}>
                  {img.url ? (
                    <img src={img.url} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover' }} />
                  ) : (
                    <div style={{
                      width: '100%', aspectRatio: '1/1', background: '#f3f4f6',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--text-hint)', fontSize: 'var(--text-sm)',
                    }}>{img.error || '生成失败'}</div>
                  )}
                  <div style={{ padding: '6px 10px', fontSize: 'var(--text-xs)', color: 'var(--text-hint)' }}>
                    {img.group} · {img.style}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Force trigger analysis if downloaded */}
        {task?.status === 'downloaded' && (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <Button primary onClick={startAnalysis} disabled={loading}>
              <MdAutoAwesome size={14} /> {loading ? '分析中...' : '启动 AI 分析'}
            </Button>
          </div>
        )}

      </div>
      <Footer />
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}
