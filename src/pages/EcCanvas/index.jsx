import React, { useEffect, useState } from 'react';
import { MdArrowBack, MdDownload, MdGridOn, MdCollections, MdAdd, MdDelete, MdOpenInNew } from 'react-icons/md';
import { useApp } from '../../store/AppContext';
import { saveWork, loadWorks } from '../../services/api';

/* ═══════ 标签映射（含商用释义）═══════ */
const LABEL_MAP = {
  white_bg: { title: '白底主图', group: '主图', ratio: '1:1', usage: '搜索结果首图，平台必备，白底突出产品，提升点击率' },
  main_text: { title: '场景主图 1:1', group: '主图', ratio: '1:1', usage: '搜索展示主力图，场景+卖点文案，吸引买家点击' },
  main_3x4: { title: '竖版主图 3:4', group: '主图', ratio: '3:4', usage: '抖音/小红书竖版流量，竖版构图更沉浸，利于转化' },
  transparent: { title: '透明PNG素材', group: '素材', ratio: '1:1', usage: '二次合成素材，可自由叠加任意背景，设计师必备' },
  sku: { title: 'SKU规格图', group: '规格', ratio: '1:1', usage: '颜色/尺码选择器展示图，降低买家决策成本，减少退货' },
  detail_slice_size: { title: '尺寸标注图', group: '详情', ratio: '3:4', usage: '详情页尺寸背书，精准尺码参考，降低因尺码不符退货率' },
  detail_slice_scene: { title: '场景使用图', group: '详情', ratio: '3:4', usage: '真实使用场景展示，帮助买家代入使用感，提升购买欲' },
  detail_slice_qc: { title: '质检报告图', group: '详情', ratio: '3:4', usage: '品质信任背书，降低买家疑虑，适用于食品/母婴/医疗类' },
  detail_slice_compare: { title: '优势对比图', group: '详情', ratio: '3:4', usage: '与竞品直观对比，突出差异化卖点，提升转化' },
  detail_slice_feature: { title: '细节功能图', group: '详情', ratio: '3:4', usage: '产品细节/工艺放大展示，建立品质感知，支撑定价溢价' },
  detail_slice_care: { title: '保养维护图', group: '详情', ratio: '3:4', usage: '使用注意事项说明，减少因误用导致的差评和退货' },
};

const PLATFORM_SIZES = {
  '淘宝': { '1:1': '1440×1440', '3:4': '1440×1920' },
  '京东': { '1:1': '1440×1440', '3:4': '1440×1920' },
  '拼多多': { '1:1': '1440×1440', '3:4': '1440×1920' },
  '小红书': { '1:1': '1440×1440', '3:4': '1440×1920' },
  '抖音': { '1:1': '1440×1440', '3:4': '1440×1920' },
  '亚马逊': { '1:1': '1000×1000', '3:4': '1500×2000' },
};

/* ═══════ 解析图片列表 ═══════ */
function parseImages(images, platform) {
  if (!images || typeof images !== 'object') return [];
  const entries = Array.isArray(images) ? images.map(i => [i.key || i.label || '', i.url]) : Object.entries(images);
  return entries.map(([label, url], i) => {
    const baseKey = label.replace(/_\d+$/, '');
    const info = LABEL_MAP[baseKey] || { title: label, group: '其他', ratio: '1:1', usage: '' };
    const size = (PLATFORM_SIZES[platform] || PLATFORM_SIZES['淘宝'])[info.ratio] || '1440×1440';
    return { label, url, title: info.title, group: info.group, ratio: info.ratio, size, usage: info.usage,
      displayLabel: info.title + (label !== baseKey ? ` ${label.replace(baseKey + '_', '#')}` : '') };
  });
}

/* ═══════ EcCanvas — 画布工作台 ═══════ */
export default function EcCanvas() {
  const { state, dispatch } = useApp();
  const result = state.result || {};
  const phone = state.phone || '';
  const [tab, setTab] = useState('current');
  const [pastWorks, setPastWorks] = useState([]);
  const [zoomImg, setZoomImg] = useState(null);

  // 当前作品的图片
  const currentImages = result.images || {};
  const imageList = parseImages(currentImages, result.platform || '淘宝');
  const hasCurrent = imageList.length > 0;

  // 加载历史作品（本地 + 服务器）
  const refreshWorks = async () => {
    const local = [];
    try { local.push(...JSON.parse(localStorage.getItem('shubao_ec_works') || '[]')); } catch {}
    try {
      console.log('[EC] 加载作品...');
      const server = await loadWorks('');
      console.log('[EC] 服务器返回', server?.length, '个作品');
      const ecWorks = server.filter(w => w._ecResult);
      console.log('[EC] 电商作品', ecWorks.length, '个');
      // 合并去重
      const names = new Set(local.map(w => w.name));
      for (const w of ecWorks) {
        if (!names.has(w.product_name)) {
          local.push({
            id: w.id || Date.now(),
            name: w.product_name,
            images: Array.isArray(w.images)
              ? w.images.map(i => ({ url: i.url, key: i.key, label: i.label || i.style || i.key }))
              : Object.entries(w.images || {}).map(([key, url]) => ({ url, key, label: key })),
            createdAt: w.at || '',
          });
        }
      }
    } catch (e) { console.error('[EC] 加载失败:', e.message); }
    console.log('[EC] 最终作品数:', local.length);
    setPastWorks(local);
  };

  useEffect(() => { refreshWorks(); }, []);

  // 保存当前作品
  useEffect(() => {
    if (!hasCurrent || !result.product_name) return;
    // 本地
    const local = [];
    try { local.push(...JSON.parse(localStorage.getItem('shubao_ec_works') || '[]')); } catch {}
    const isDupe = local.length > 0 && local[0].name === result.product_name && (Date.now() - (local[0].id || 0)) < 5000;
    if (!isDupe) {
      const newWork = { id: Date.now(), name: result.product_name, images: imageList.map(img => ({ url: img.url, key: img.label, label: img.displayLabel })), createdAt: new Date().toISOString() };
      local.unshift(newWork);
      localStorage.setItem('shubao_ec_works', JSON.stringify(local.slice(0, 50)));
    }
    // 服务器
    if (phone) {
      const serverWork = { product_name: result.product_name, category: result.category || '其他', platform: result.platform || '淘宝', _ecResult: true, at: new Date().toLocaleDateString('zh-CN'), images: imageList.map(img => ({ url: img.url, key: img.label, label: img.displayLabel, style: img.title })) };
      saveWork(serverWork, phone).catch(() => {});
    }
    refreshWorks();
  }, [hasCurrent, result.product_name]); // eslint-disable-line

  const handleBack = () => dispatch({ type: 'NAVIGATE', page: 'home' });
  const handleNewWork = () => { dispatch({ type: 'CLOSE_RESULT' }); dispatch({ type: 'NAVIGATE', page: 'home' }); };

  // 打开一个历史作品到画布
  const openWork = (work) => {
    let images = {};
    if (Array.isArray(work.images)) {
      work.images.forEach(img => { if (img.url) images[img.key || img.label || ''] = img.url; });
    } else {
      images = work.images || {};
    }
    dispatch({ type: 'SET_RESULT', result: { images, product_name: work.name || '历史作品', _ecResult: true, platform: '淘宝' } });
    setTab('current');
  };

  const downloadAll = () => {
    imageList.forEach((img, i) => {
      setTimeout(() => { const a = document.createElement('a'); a.href = img.url; a.download = `${result.product_name || 'ec'}_${img.label}.png`; a.click(); }, i * 300);
    });
  };

  const deleteWork = (id) => {
    const works = pastWorks.filter(w => w.id !== id);
    setPastWorks(works);
    localStorage.setItem('shubao_ec_works', JSON.stringify(works));
  };

  // ── 渲染 ──
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #f5f3ef)', color: 'var(--text-primary, #1a1a1a)' }}>
      {/* 顶部栏 */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, height: 52, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12 }}>
        <div onClick={handleBack} style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <MdArrowBack size={18} color="#666" />
        </div>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{tab === 'current' ? (result.product_name || '画布') : '我的作品'}</div>
        <div style={{ fontSize: 12, color: '#999' }}>{tab === 'current' ? `${imageList.length} 张图片` : `${pastWorks.length} 个作品`}</div>

        {/* Tab */}
        <div style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 10, background: 'rgba(0,0,0,0.04)', marginLeft: 12 }}>
          <div onClick={() => setTab('current')} style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: tab === 'current' ? '#fff' : 'transparent', color: tab === 'current' ? '#1a1a1a' : '#999', boxShadow: tab === 'current' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}>
            <MdGridOn size={13} style={{ marginRight: 3, verticalAlign: -1 }} />当前
          </div>
          <div onClick={() => setTab('past')} style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: tab === 'past' ? '#fff' : 'transparent', color: tab === 'past' ? '#1a1a1a' : '#999', boxShadow: tab === 'past' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}>
            <MdCollections size={13} style={{ marginRight: 3, verticalAlign: -1 }} />作品集
          </div>
        </div>

        {tab === 'current' && hasCurrent && (
          <div onClick={downloadAll} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, background: '#1a1a1a', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <MdDownload size={14} /> 全部下载
          </div>
        )}
        <div onClick={handleNewWork} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, background: 'linear-gradient(135deg, #7c3aed, #a78bfa)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginLeft: tab === 'current' && hasCurrent ? 6 : 'auto' }}>
          <MdAdd size={14} /> 新建
        </div>
      </div>

      {/* ── 当前作品 ── */}
      {tab === 'current' && (
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 16px' }}>
          {!hasCurrent ? (
            <div style={{ textAlign: 'center', padding: '80px 20px' }}>
              <div style={{ fontSize: 64, marginBottom: 16, opacity: 0.15 }}>🎨</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#999', marginBottom: 8 }}>画布是空的</div>
              <div style={{ fontSize: 13, color: '#bbb', marginBottom: 24 }}>去首页生成一套电商图，图片会自动出现在这里</div>
              <div onClick={handleNewWork} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 24px', borderRadius: 12, background: 'linear-gradient(135deg, #7c3aed, #a78bfa)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                <MdAdd size={16} /> 去生成
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
              {imageList.map((img, idx) => (
                <div key={idx} onClick={() => setZoomImg(img)} style={{ borderRadius: 14, overflow: 'hidden', cursor: 'pointer', background: '#fff', border: '1px solid rgba(0,0,0,0.06)', transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; }}>
                  <img src={img.url} alt={img.label} style={{ width: '100%', aspectRatio: img.ratio === '3:4' ? '3/4' : '1/1', objectFit: 'cover', display: 'block' }} />
                  <div style={{ padding: '8px 10px 10px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a' }}>{img.group} · {img.displayLabel}</div>
                    <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>{img.size}</div>
                    {img.usage && <div style={{ fontSize: 10, color: '#b45309', marginTop: 5, lineHeight: 1.5, background: 'rgba(180,83,9,0.05)', borderRadius: 6, padding: '4px 6px' }}>{img.usage}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 作品集 ── */}
      {tab === 'past' && (
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 16px' }}>
          {pastWorks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px' }}>
              <div style={{ fontSize: 64, marginBottom: 16, opacity: 0.15 }}>📁</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#999', marginBottom: 8 }}>还没有作品</div>
              <div style={{ fontSize: 13, color: '#bbb' }}>生成的电商图会自动保存到这里</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {pastWorks.map(work => (
                <div key={work.id} style={{ borderRadius: 16, overflow: 'hidden', background: '#fff', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  {/* 标题行 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{work.name}</div>
                      <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{work.images?.length || 0} 张图片</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <div onClick={() => openWork(work)} title="在画布中打开" style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(124,58,237,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#7c3aed' }}>
                        <MdOpenInNew size={14} />
                      </div>
                      <div onClick={() => { work.images?.forEach((img, i) => setTimeout(() => { const a = document.createElement('a'); a.href = img.url; a.download = `${work.name}_${i+1}.png`; a.click(); }, i * 300)); }} title="下载全部" style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#666' }}>
                        <MdDownload size={14} />
                      </div>
                      <div onClick={() => deleteWork(work.id)} title="删除" style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(239,68,68,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444' }}>
                        <MdDelete size={14} />
                      </div>
                    </div>
                  </div>
                  {/* 缩略图 */}
                  <div style={{ display: 'flex', gap: 6, padding: '0 14px 12px', overflowX: 'auto' }}>
                    {(work.images || []).slice(0, 6).map((img, i) => (
                      <img key={i} src={img.url} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(0,0,0,0.06)', flexShrink: 0, cursor: 'pointer' }} onClick={() => setZoomImg({ url: img.url, label: img.label || '' })} />
                    ))}
                    {(work.images?.length || 0) > 6 && (
                      <div style={{ width: 72, height: 72, borderRadius: 8, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#999', flexShrink: 0 }}>+{work.images.length - 6}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 灯箱 */}
      {zoomImg && (
        <div onClick={() => setZoomImg(null)} style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <img src={zoomImg.url} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 12 }} onClick={e => e.stopPropagation()} />
          <div onClick={() => setZoomImg(null)} style={{ position: 'absolute', top: 20, right: 20, width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 20, color: '#fff' }}>×</div>
        </div>
      )}
    </div>
  );
}
