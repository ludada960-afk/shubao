import React, { useEffect, useState, useCallback } from 'react';
import { MdArrowBack, MdDownload, MdGridOn, MdCollections, MdAdd, MdDelete } from 'react-icons/md';
import { useApp } from '../../store/AppContext';
import { saveWork } from '../../services/api';

/* ═══════ localStorage 持久化 ═══════ */
const WORKS_KEY = 'shubao_ec_works';
const loadLocalWorks = () => {
  try { return JSON.parse(localStorage.getItem(WORKS_KEY) || '[]'); } catch { return []; }
};
const saveLocalWorks = (works) => {
  try { localStorage.setItem(WORKS_KEY, JSON.stringify(works)); } catch {}
};

/* ═══════ 标签映射 ═══════ */
const LABEL_MAP = {
  white_bg: { title: '白底图', group: '主图', ratio: '1:1' },
  main_text: { title: '主图 1:1', group: '主图', ratio: '1:1' },
  main_3x4: { title: '主图 3:4', group: '主图', ratio: '3:4' },
  transparent: { title: '透明PNG', group: '素材', ratio: '1:1' },
  sku: { title: 'SKU规格图', group: '规格', ratio: '1:1' },
  detail_slice_size: { title: '尺寸标注', group: '详情', ratio: '3:4' },
  detail_slice_scene: { title: '场景拍摄', group: '详情', ratio: '3:4' },
  detail_slice_qc: { title: '质检报告', group: '详情', ratio: '3:4' },
  detail_slice_compare: { title: '优势对比', group: '详情', ratio: '3:4' },
  detail_slice_feature: { title: '细节功能', group: '详情', ratio: '3:4' },
  detail_slice_care: { title: '保养维护', group: '详情', ratio: '3:4' },
};

const PLATFORM_SIZES = {
  '淘宝': { '1:1': '1440×1440', '3:4': '1440×1920' },
  '京东': { '1:1': '1440×1440', '3:4': '1440×1920' },
  '拼多多': { '1:1': '1440×1440', '3:4': '1440×1920' },
  '小红书': { '1:1': '1440×1440', '3:4': '1440×1920' },
  '抖音': { '1:1': '1440×1440', '3:4': '1440×1920' },
  '亚马逊': { '1:1': '1000×1000', '3:4': '1500×2000' },
};

/* ═══════ EcCanvas — 网格画布 + 作品管理 ═══════ */
export default function EcCanvas() {
  const { state, dispatch } = useApp();
  const result = state.result || {};
  const images = result.images || {};
  const phone = state.phone || '';
  const [tab, setTab] = useState('current');
  const [pastWorks, setPastWorks] = useState([]);
  const [zoomImg, setZoomImg] = useState(null);
  const [saved, setSaved] = useState(false);

  // 解析图片列表
  const imageList = Object.entries(images).map(([label, url], i) => {
    const baseKey = label.replace(/_\d+$/, '');
    const info = LABEL_MAP[baseKey] || { title: label, group: '其他', ratio: '1:1' };
    const platform = result.platform || '淘宝';
    const size = (PLATFORM_SIZES[platform] || PLATFORM_SIZES['淘宝'])[info.ratio] || '1440×1440';
    return { label, url, title: info.title, group: info.group, ratio: info.ratio, size,
      displayLabel: info.title + (label !== baseKey ? ` ${label.replace(baseKey, '')}` : '') };
  });

  // 加载历史作品
  useEffect(() => { setPastWorks(loadLocalWorks()); }, []);

  // 保存作品到服务器
  useEffect(() => {
    if (saved || imageList.length === 0 || !result.product_name) return;
    setSaved(true);

    // 本地保存
    const works = loadLocalWorks();
    const newWork = {
      id: Date.now(),
      name: result.product_name || '未命名产品',
      images: imageList.map(img => ({ url: img.url, key: img.label, label: img.displayLabel, group: img.group, ratio: img.ratio, size: img.size })),
      createdAt: new Date().toISOString(),
    };
    const isDupe = works.length > 0 && works[0].name === newWork.name && (Date.now() - works[0].id) < 5000;
    if (!isDupe) {
      works.unshift(newWork);
      if (works.length > 50) works.length = 50;
      saveLocalWorks(works);
      setPastWorks(works);
    }

    // 服务器保存
    const doSave = async () => {
      try {
        const serverWork = {
          product_name: result.product_name || '未命名产品',
          category: result.category || '其他',
          platform: result.platform || '淘宝',
          _ecResult: true,
          at: new Date().toLocaleDateString('zh-CN'),
          images: imageList.map(img => ({ url: img.url, key: img.label, label: img.displayLabel, style: img.title, group: img.group, ratio: img.ratio, size: img.size })),
        };
        await saveWork(serverWork, phone || 'guest');
        console.log('[EC] 作品已保存到服务器:', result.product_name);
      } catch (e) {
        console.warn('[EC] 服务器保存失败:', e.message);
      }
    };
    doSave();
  }, [imageList.length > 0, result.product_name]); // eslint-disable-line

  const handleBack = () => dispatch({ type: 'NAVIGATE', page: 'home' });
  const handleNewWork = () => { dispatch({ type: 'CLOSE_RESULT' }); dispatch({ type: 'NAVIGATE', page: 'home' }); };

  const downloadAll = () => {
    imageList.forEach((img, i) => {
      setTimeout(() => { const a = document.createElement('a'); a.href = img.url; a.download = `${result.product_name || 'ec'}_${img.label}.png`; a.click(); }, i * 300);
    });
  };

  const deleteWork = (id) => {
    const works = pastWorks.filter(w => w.id !== id);
    setPastWorks(works);
    saveLocalWorks(works);
  };

  // ── 作品集视图 ──
  if (tab === 'past') {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0f1a', color: '#fff' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 100, height: 52, background: 'rgba(15,15,26,0.9)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12 }}>
          <div onClick={handleBack} style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <MdArrowBack size={18} color="rgba(255,255,255,0.6)" />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>我的作品</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>共 {pastWorks.length} 个</div>
          <div style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 10, background: 'rgba(255,255,255,0.06)', marginLeft: 12 }}>
            <div onClick={() => setTab('current')} style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>
              <MdGridOn size={13} style={{ marginRight: 3, verticalAlign: -1 }} />当前
            </div>
            <div onClick={() => setTab('past')} style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'rgba(167,139,250,0.2)', color: '#a78bfa' }}>
              <MdCollections size={13} style={{ marginRight: 3, verticalAlign: -1 }} />作品集
            </div>
          </div>
          <div onClick={handleNewWork} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, background: 'linear-gradient(135deg, #7c3aed, #a78bfa)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <MdAdd size={14} /> 新建
          </div>
        </div>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
          {pastWorks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px' }}>
              <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>📁</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.4)' }}>还没有历史作品</div>
            </div>
          ) : pastWorks.map(work => (
            <div key={work.id} style={{ borderRadius: 16, overflow: 'hidden', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{work.name}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{new Date(work.createdAt).toLocaleString('zh-CN')} · {work.images.length} 张</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div onClick={() => work.images.forEach((img, i) => setTimeout(() => { const a = document.createElement('a'); a.href = img.url; a.download = `${work.name}_${i+1}.png`; a.click(); }, i * 300))} style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: 'rgba(167,139,250,0.12)', color: '#a78bfa', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MdDownload size={12} /> 下载
                  </div>
                  <div onClick={() => deleteWork(work.id)} style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MdDelete size={12} /> 删除
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, padding: 12, overflowX: 'auto' }}>
                {work.images.slice(0, 10).map((img, i) => (
                  <img key={i} src={img.url} alt="" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── 当前作品视图 ──
  return (
    <div style={{ minHeight: '100vh', background: '#0f0f1a', color: '#fff' }}>
      {/* 顶部栏 */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, height: 52, background: 'rgba(15,15,26,0.9)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12 }}>
        <div onClick={handleBack} style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <MdArrowBack size={18} color="rgba(255,255,255,0.6)" />
        </div>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{result.product_name || '生成结果'}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{imageList.length} 张图片</div>
        <div style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 10, background: 'rgba(255,255,255,0.06)', marginLeft: 12 }}>
          <div onClick={() => setTab('current')} style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'rgba(167,139,250,0.2)', color: '#a78bfa' }}>
            <MdGridOn size={13} style={{ marginRight: 3, verticalAlign: -1 }} />当前
          </div>
          <div onClick={() => setTab('past')} style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>
            <MdCollections size={13} style={{ marginRight: 3, verticalAlign: -1 }} />作品集 ({pastWorks.length})
          </div>
        </div>
        <div onClick={downloadAll} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, background: '#a78bfa', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <MdDownload size={14} /> 全部下载
        </div>
      </div>

      {/* 图片网格 */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 16px' }}>
        {imageList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>🎨</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.4)' }}>暂无生成结果</div>
            <div onClick={handleBack} style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 24px', borderRadius: 12, background: 'linear-gradient(135deg, #7c3aed, #a78bfa)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              <MdAdd size={16} /> 去生成
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
            {imageList.map((img, idx) => (
              <div key={idx} onClick={() => setZoomImg(img)} style={{ borderRadius: 14, overflow: 'hidden', cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(124,58,237,0.15)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
                <img src={img.url} alt={img.label} style={{ width: '100%', aspectRatio: img.ratio === '3:4' ? '3/4' : '1/1', objectFit: 'cover', display: 'block' }} />
                <div style={{ padding: '8px 10px' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{img.group} · {img.displayLabel}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{img.size}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 灯箱 */}
      {zoomImg && (
        <div onClick={() => setZoomImg(null)} style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <img src={zoomImg.url} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 12, cursor: 'default' }} onClick={e => e.stopPropagation()} />
          <div onClick={() => setZoomImg(null)} style={{ position: 'absolute', top: 20, right: 20, width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 20, color: '#fff' }}>×</div>
        </div>
      )}

      {/* 底部固定按钮 */}
      <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
        <div onClick={handleNewWork} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 16, background: 'linear-gradient(135deg, #7c3aed, #a78bfa)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 32px rgba(124,58,237,0.4)' }}>
          <MdAdd size={18} /> 新建作品
        </div>
      </div>
    </div>
  );
}
