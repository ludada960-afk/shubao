import React, { useEffect, useState } from 'react';
import { MdAutoAwesome, MdLogin, MdRefresh, MdShoppingCart, MdEdit } from 'react-icons/md';
import { useApp } from '../../store/AppContext';
import { IMAGES } from '../../constants/images';
import { loadWorks, proxyImg } from '../../services/api';
import { EC_PLATFORM_SPECS } from '../../constants/data';
import { normalizeWorkImages } from '../../utils/workImages.js';
import { stableWorkKey } from '../../utils/workRecords.js';
import { Card, CharImg, EmptyState } from '../../components/ui/index';
import Button from '../../components/ui/Button';
import Footer from '../../components/layout/Footer';
import { formatRetentionStatus } from './retentionModel.js';

const TABS = [
  { key: 'xhs', label: '小红书图文' },
  { key: 'ec', label: '电商商品图' },
];

const EC_STYLE_ICONS = { '白底主图': '⬜', '场景图': '🌄', '详情图': '📋', '组合图': '🖼️' };
const getEcImages = work => normalizeWorkImages(work?.images);
const EC_GENERATION_STATUS = {
  generating: { label: '正在生成', background: '#EEF2FF', color: '#4338CA' },
  needs_review: { label: '需要确认', background: '#FFF7E8', color: '#A15C00' },
  completed: { label: '已完成', background: '#EAF8F0', color: '#177B48' },
};

export default function WorksPage() {
  const { state, dispatch } = useApp();
  const { works, logged, mode, phone } = state;
  const [tab, setTab] = useState(mode === 'ecommerce' ? 'ec' : 'xhs');

  const refresh = async () => {
    const serverWorks = (await loadWorks(phone)).map(work => work._ecResult
      ? { ...work, images: normalizeWorkImages(work.images) }
      : work);
    dispatch({ type: 'SET_WORKS', works: serverWorks });
  };

  useEffect(() => { if (logged) refresh(); }, [logged, phone]);

  const xhsWorks = works.filter(w => !w._ecResult);
  const ecWorks = works.filter(w => w._ecResult);
  const currentWorks = tab === 'xhs' ? xhsWorks : ecWorks;

  const viewWork = (w) => {
    if (!getEcImages(w).length) return;
    // 规范化图片格式后跳转到画布
    const images = Object.fromEntries(getEcImages(w).map((image, index) => [
      image.key || image.label || `image_${index + 1}`,
      image.url,
    ]));
    const normalized = {
      ...w,
      images,
      canvasImportId: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      product_name: w.product_name || w.name || '历史作品',
      _ecResult: true,
      platform: w.platform || '淘宝',
    };
    dispatch({ type: 'SET_RESULT', result: normalized });
    dispatch({ type: 'NAVIGATE', page: 'ec-canvas' });
  };

  const styleIcon = (s) => EC_STYLE_ICONS[s] || '🖼️';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '48px 28px' }}>
        {/* 未登录提示 */}
        {!logged ? (
          <div style={{ textAlign:'center', padding:'80px 0' }}>
            <div style={{ fontSize:48, marginBottom:16 }}>🔒</div>
            <h2 style={{ fontSize:'var(--text-2xl)', fontWeight:'var(--weight-bold)', margin:'0 0 8px' }}>登录后查看作品</h2>
            <p style={{ fontSize:'var(--text-base)', color:'var(--text-hint)', margin:'0 0 24px' }}>你的作品已保存到云端，登录即可随时查看</p>
            <button onClick={() => dispatch({ type: 'SHOW_LOGIN', show: true })}
              style={{
                padding:'12px 32px', borderRadius:10, border:'none', background:'#e84142', color:'#fff',
                fontSize:15, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
              }}>
              立即登录
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 6 }}>
              <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--weight-heavy)', margin: 0 }}>我的作品</h1>
          <button onClick={refresh} style={{
            background: 'var(--border-light)', border: 'none', borderRadius: 'var(--radius-md)',
            padding: '6px 12px', fontSize: 'var(--text-sm)', color: 'var(--text-muted)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit',
          }}>
            <MdRefresh size={12} /> 刷新
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 0,
          marginBottom: 28, marginTop: 16,
        }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => {
              setTab(t.key);
              dispatch({ type: 'SET_MODE', mode: t.key === 'ec' ? 'ecommerce' : 'content' });
            }} style={{
              padding: '10px 28px', fontSize: 'var(--text-sm)', fontWeight: tab === t.key ? 700 : 500,
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: tab === t.key
                ? (t.key === 'xhs' ? '#FFF5F5' : '#EEF2FF')
                : 'var(--border-light)',
              color: tab === t.key
                ? (t.key === 'xhs' ? '#C53030' : '#3730A3')
                : 'var(--text-muted)',
              borderBottom: tab === t.key
                ? `3px solid ${t.key === 'xhs' ? 'var(--red)' : 'var(--blue)'}`
                : '3px solid transparent',
              transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {t.key === 'xhs' ? <MdEdit size={14} /> : <MdShoppingCart size={14} />}
              {t.label}
              <span style={{
                fontSize: 10, background: tab === t.key ? (t.key === 'xhs' ? '#FED7D7' : '#C7D2FE') : '#e0e0e0',
                color: tab === t.key ? (t.key === 'xhs' ? '#C53030' : '#3730A3') : '#999',
                padding: '1px 7px', borderRadius: 10, marginLeft: 2,
              }}>
                {t.key === 'xhs' ? xhsWorks.length : ecWorks.length}
              </span>
            </button>
          ))}
        </div>

        {/* Empty state */}
        {!currentWorks.length ? (
          <EmptyState
            image={IMAGES.empty}
            title={logged ? '暂无作品' : '登录后查看作品'}
            desc={
              tab === 'xhs'
                ? '还没有小红书图文作品，去首页创作第一套吧'
                : '还没有电商商品图作品，去首页生成吧'
            }
            action={
              logged
                ? <Button primary onClick={() => dispatch({ type: 'NAVIGATE', page: 'home' })}>
                    <MdAutoAwesome size={14} /> 开始创作
                  </Button>
                : <Button primary onClick={() => dispatch({ type: 'SHOW_LOGIN', show: true })}>
                    <MdLogin size={14} /> 登录查看作品
                  </Button>
            }
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: 14 }}>
            {currentWorks.map((w, i) => {
              const ecImages = w._ecResult ? getEcImages(w) : [];
              const status = EC_GENERATION_STATUS[w.generationStatus] || EC_GENERATION_STATUS.completed;
              const retention = formatRetentionStatus(w.retention);
              const canOpen = (!w._ecResult || ecImages.length > 0) && retention.available;
              return (
              <Card key={stableWorkKey(w, `work-${i}`)} hover={canOpen} onClick={canOpen ? () => viewWork(w) : undefined} style={{
                padding: 16, display: 'flex', gap: 14, alignItems: 'center',
              }}>
                {/* ═══ XHS 作品卡片 ═══ */}
                {!w._ecResult ? (
                  <>
                    {w.cover_url ? (
                      <img src={proxyImg(w.cover_url)} alt=""
                        style={{ width: 56, height: 75, borderRadius: 'var(--radius-md)', objectFit: 'cover', flex: '0 0 auto' }} />
                    ) : (
                      <div style={{
                        width: 56, height: 75, borderRadius: 'var(--radius-md)', background: 'var(--border-light)',
                        flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                      }}>📄</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="truncate-2" style={{
                        fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)',
                        lineHeight: 1.5, marginBottom: 4,
                      }}>{w.title}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--text-ghost)' }}>
                        <span>{w.category}</span>
                        <span>{w.at}</span>
                      </div>
                      {w.cover_url && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-invisible)', marginTop: 2 }}>
                        {w.image_urls?.length || 0}张配图
                      </div>}
                    </div>
                  </>
                ) : (
                  /* ═══ EC 作品卡片 ═══ */
                  <>
                    {ecImages[0]?.url ? (
                      <img src={proxyImg(ecImages[0].url)} alt=""
                        style={{ width: 56, height: 56, borderRadius: 'var(--radius-md)', objectFit: 'cover', flex: '0 0 auto' }} />
                    ) : (
                      <div style={{
                        width: 56, height: 56, borderRadius: 'var(--radius-md)',
                        background: 'linear-gradient(135deg, #EEF2FF, #E0E7FF)',
                        flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                      }}>🛍️</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="truncate-1" style={{
                        fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)',
                        lineHeight: 1.5, marginBottom: 4,
                      }}>{w.product_name}</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 2 }}>
                        <span style={{
                          fontSize: 10, background: 'var(--blue-bg)', color: '#4338CA',
                          padding: '1px 7px', borderRadius: 4, fontWeight: 600,
                        }}>{w.category}</span>
                        <span style={{
                          fontSize: 10, background: '#f5f5f5', color: '#666',
                          padding: '1px 7px', borderRadius: 4,
                        }}>
                          {(EC_PLATFORM_SPECS[w.platform] || {}).name || w.platform}
                        </span>
                        <span style={{
                          fontSize: 10, background: status.background, color: status.color,
                          padding: '1px 7px', borderRadius: 4, fontWeight: 700,
                        }}>{status.label}</span>
                        <span style={{
                          fontSize: 10, background: retention.available ? '#EEF7F1' : '#FFF3E8',
                          color: retention.available ? '#177B48' : '#A15C00', padding: '1px 7px', borderRadius: 4,
                        }}>{retention.label}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--text-ghost)' }}>
                        <span>
                          {ecImages.length}张 ·{' '}
                          {ecImages.map(i => i.style || i.label || i.key).map(s => styleIcon(s)).join(' ')}
                        </span>
                        <span>{w.at}</span>
                      </div>
                    </div>
                  </>
                )}
              </Card>
              );
            })}
          </div>
            )}
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}
