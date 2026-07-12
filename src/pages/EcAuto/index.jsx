/**
 * 薯包AI · 一键出图
 * 极简电商商品图生成 — 选平台 + 输入内容 → 直接出合规套图
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkle, CaretRight, Download, ArrowsClockwise, Lightning } from '@phosphor-icons/react';
import { useApp } from '../../store/AppContext';
import { IMAGES } from '../../constants/images';
import { proxyImg, autoGenerate } from '../../services/api';
import { CharImg } from '../../components/ui/index';
import Footer from '../../components/layout/Footer';

const PLATFORMS = [
  { key: '淘宝', label: '淘宝/天猫', emoji: '🟠', desc: '800×800白底主图 + 详情分段' },
  { key: '京东', label: '京东', emoji: '🛒', desc: '800×800白底主图 + 详情分段' },
  { key: '拼多多', label: '拼多多', emoji: '🟢', desc: '750×750白底主图 + 详情分段' },
  { key: '抖音', label: '抖音小店', emoji: '🎵', desc: '800×800主图 + 促销文案 + 详情' },
  { key: '亚马逊', label: 'Amazon', emoji: '🌐', desc: '1000×1000+纯白底6张，无文字' },
  { key: '小红书', label: '小红书种草', emoji: '📕', desc: '1080×1440场景种草图3张' },
];

export default function EcAutoPage() {
  const { state, dispatch } = useApp();
  const [platform, setPlatform] = useState('淘宝');
  const [input, setInput] = useState('');
  const [genState, setGenState] = useState('idle'); // idle | generating | done
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const textRef = useRef(null);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  // 生成计时器
  useEffect(() => {
    if (genState === 'generating') {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [genState]);

  const selectedPlatform = PLATFORMS.find(p => p.key === platform);

  // 自动调整 textarea 高度
  useEffect(() => {
    if (textRef.current) {
      textRef.current.style.height = 'auto';
      textRef.current.style.height = textRef.current.scrollHeight + 'px';
    }
  }, [input]);

  const handleGenerate = async () => {
    if (!input.trim()) return;
    setGenState('generating');
    setError('');
    dispatch({ type: 'START_GEN' });
    try {
      const data = await autoGenerate({ platform, input: input.trim() });
      setResults(data);
      setGenState('done');
      dispatch({ type: 'CLOSE_RESULT' });
    } catch (e) {
      setError(e.message || '生成失败，请重试');
      setGenState('idle');
      dispatch({ type: 'CLOSE_RESULT' });
    }
  };

  // 下载单张
  const downloadImage = (url, name) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
  };

  // 全部下载
  const downloadAll = () => {
    if (!results?.images) return;
    Object.entries(results.images).forEach(([label, url]) => {
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = url;
        a.download = `${results.product_name || '商品'}-${label}.png`;
        a.click();
      }, 200);
    });
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFB' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px' }}>
        {/* 顶部导航 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
            onClick={() => dispatch({ type: 'NAVIGATE', page: 'home' })}>
            <CharImg src={IMAGES.appicon} size={28} float />
            <span style={{ fontSize: 17, fontWeight: 650, color: '#E53E3E', fontFamily: '-apple-system,"PingFang SC",sans-serif' }}>
              薯包AI
            </span>
            <span style={{ fontSize: 11, color: '#999', marginLeft: 4, background: '#f0f0f0', padding: '2px 8px', borderRadius: 4 }}>
              一键出图
            </span>
          </div>
          <button onClick={() => dispatch({ type: 'NAVIGATE', page: 'ec-studio' })}
            style={{
              fontSize: 12, color: '#666', background: '#fff', border: '1px solid #e0e0e0',
              borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#4338CA'; e.currentTarget.style.color = '#4338CA'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0e0e0'; e.currentTarget.style.color = '#666'; }}>
            🔧 精修工坊
          </button>
        </div>

        {/* 平台选择 */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 8, fontWeight: 500 }}>选择平台</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PLATFORMS.map(p => (
              <button key={p.key} onClick={() => setPlatform(p.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '10px 16px', borderRadius: 10,
                  border: platform === p.key ? '2px solid #4338CA' : '1px solid #e8e8e8',
                  background: platform === p.key ? '#F5F3FF' : '#fff',
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.15s',
                  flex: '0 0 auto',
                }}>
                <span style={{ fontSize: 18 }}>{p.emoji}</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: platform === p.key ? 600 : 500, color: platform === p.key ? '#4338CA' : '#444' }}>
                    {p.label}
                  </div>
                  <div style={{ fontSize: 10, color: platform === p.key ? '#7C7CFF' : '#999', marginTop: 1 }}>
                    {p.desc}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 输入区 */}
        <div style={{
          background: '#fff', borderRadius: 14, padding: 20,
          boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
          border: '1px solid #eee',
          marginBottom: 16,
        }}>
          <textarea ref={textRef}
            value={input} onChange={e => setInput(e.target.value)}
            placeholder={platform === '亚马逊' ? '输入商品英文描述...\n\n例如：Stainless steel water bottle 500ml, minimalist design'
              : `描述你的商品，AI自动生成全套商品图...\n\n短句：白色陶瓷杯简约风办公用、无线蓝牙耳机入耳式\n或输入详细描述，AI按需求生成全套商品图`}
            style={{
              width: '100%', minHeight: 80, maxHeight: 240,
              border: 'none', outline: 'none', resize: 'none',
              fontSize: 14, lineHeight: 1.7, color: '#333',
              fontFamily: 'inherit', padding: 0,
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#bbb' }}>
                {input.length}字 · {/^https?:\/\//i.test(input.trim()) ? '🔗 链接模式' : input.trim().length >= 80 ? '📝 详细模式 · 按描述生成' : '✏️ 标准模式 · 一句话生成'}
              </span>
            </div>
            <button onClick={handleGenerate} disabled={!input.trim() || genState === 'generating'}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 24px', borderRadius: 10,
                background: !input.trim() ? '#e0e0e0' : '#4338CA',
                color: '#fff', border: 'none', fontSize: 14, fontWeight: 600,
                cursor: !input.trim() ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', transition: 'all 0.15s',
                boxShadow: !input.trim() ? 'none' : '0 2px 10px rgba(67,56,202,0.25)',
              }}
              onMouseEnter={e => { if (input.trim()) e.currentTarget.style.opacity = '0.92'; }}
              onMouseLeave={e => { if (input.trim()) e.currentTarget.style.opacity = '1'; }}>
              {genState === 'generating' ? <><Zap size={15} className="animate-spin" /> 生成中...</>
                : <><Sparkles size={15} /> 一键生成全套图</>}
            </button>
          </div>
        </div>

        {/* 生成中 */}
        {genState === 'generating' && (
          <div style={{
            background: '#fff', borderRadius: 14, padding: 28,
            boxShadow: '0 1px 6px rgba(0,0,0,0.04)', border: '1px solid #eee',
            marginBottom: 16, textAlign: 'center',
          }}>
            <div style={{
              width: 40, height: 40, border: '3px solid #E0E7FF', borderTopColor: '#4338CA',
              borderRadius: '50%', animation: 'spin 0.8s linear infinite',
              margin: '0 auto 14px',
            }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: '#333', marginBottom: 4 }}>✨ AI 正在生成商品图...</div>
            <div style={{ fontSize: 12, color: '#999' }}>
              {input.trim().length >= 80 && !/^https?:\/\//i.test(input.trim())
                ? '完整prompt模式 · 原样执行'
                : `${selectedPlatform?.label || platform}标准套餐 · 每张约需25秒`}
              {elapsed >= 10 && ` · 已等待 ${elapsed} 秒`}
            </div>
            {elapsed >= 30 && (
              <div style={{ fontSize: 11, color: '#F59E0B', marginTop: 8, background: '#FFFBEB', padding: '6px 12px', borderRadius: 8, display: 'inline-block' }}>
                多张图片正在并行生成，请稍候...
              </div>
            )}
          </div>
        )}

        {/* 结果 */}
        {error && (
          <div style={{
            background: '#FFF5F5', borderRadius: 10, padding: '12px 16px',
            fontSize: 13, color: '#C53030', marginBottom: 16,
          }}>{error}</div>
        )}

        {results && (
          <div style={{
            background: '#fff', borderRadius: 14, padding: 20,
            boxShadow: '0 1px 6px rgba(0,0,0,0.04)', border: '1px solid #eee',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#1e1e2e' }}>
                  ✅ 生成完成
                </div>
                <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                  {Object.keys(results.images || {}).length} 张图 · {results.raw_mode ? '完整prompt模式' : `${selectedPlatform?.label || platform} 标准`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={downloadAll}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '8px 16px', borderRadius: 8,
                    background: '#EEF2FF', color: '#4338CA', border: 'none',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  <Download size={13} /> 全部下载
                </button>
                <button onClick={() => { setResults(null); setInput(''); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '8px 14px', borderRadius: 8,
                    background: '#f5f5f5', color: '#666', border: 'none',
                    fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  <RotateCcw size={13} /> 重新生成
                </button>
              </div>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: 12,
            }}>
              {Object.entries(results.images || {}).map(([label, url]) => (
                <div key={label} style={{
                  background: '#f8f8f8', borderRadius: 10, overflow: 'hidden',
                  border: '1px solid #f0f0f0',
                }}>
                  <div style={{
                    width: '100%', aspectRatio: '1/1',
                    background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden',
                  }}>
                    <img src={proxyImg(url)} alt={label} style={{
                      width: '100%', height: '100%', objectFit: 'contain',
                      display: 'block',
                    }} loading="lazy" />
                  </div>
                  <div style={{
                    padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    borderTop: '1px solid #f5f5f5',
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#666' }}>{label}</span>
                    <button onClick={() => downloadImage(url, `${label}.png`)} style={{
                      fontSize: 10, color: '#4338CA', cursor: 'pointer',
                      padding: '3px 8px', borderRadius: 4,
                      background: '#EEF2FF', border: 'none', fontWeight: 500, fontFamily: 'inherit',
                    }}>
                      下载
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* 底栏 */}
            <div style={{
              marginTop: 16, paddingTop: 14, borderTop: '1px solid #f5f5f5',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontSize: 12, color: '#999',
            }}>
              <span>
                {results.raw_mode
                  ? '📝 使用完整prompt模式生成，AI原样执行'
                  : `📐 尺寸已适配 ${platform} 平台规范，可直接上架`}
              </span>
              <button onClick={() => dispatch({ type: 'NAVIGATE', page: 'ec-studio' })}
                style={{
                  background: 'none', border: 'none', color: '#4338CA',
                  cursor: 'pointer', fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 3,
                }}>
                去精修工坊微调 <ChevronRight size={12} />
              </button>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
