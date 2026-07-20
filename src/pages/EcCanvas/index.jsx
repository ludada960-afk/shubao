import React, { useCallback, useRef, useEffect, useState } from 'react';
import { Tldraw } from '@tldraw/tldraw';
import '@tldraw/tldraw/tldraw.css';
import { MdArrowBack, MdDownload, MdGridOn, MdCollections, MdAdd, MdDelete } from 'react-icons/md';
import { useApp } from '../../store/AppContext';
import { saveWork } from '../../services/api';
import ContextMenu from './ContextMenu';

/* ═══════ localStorage 持久化 ═══════ */
const WORKS_KEY = 'shubao_ec_works';
const loadWorks = () => {
  try { return JSON.parse(localStorage.getItem(WORKS_KEY) || '[]'); } catch { return []; }
};
const saveWorksToStorage = (works) => {
  try { localStorage.setItem(WORKS_KEY, JSON.stringify(works)); } catch {}
};

/* ═══════ 标签映射（含类型+尺寸信息）═══ */
const LABEL_MAP = {
  white_bg: { title: '白底图', group: '主图', ratio: '1:1', desc: '纯白底·无文字·首图必选' },
  main_text: { title: '主图 1:1', group: '主图', ratio: '1:1', desc: '白底+促销文案·卖点展示' },
  main_3x4: { title: '主图 3:4', group: '主图', ratio: '3:4', desc: '竖版多角度·移动端优先' },
  transparent: { title: '透明PNG', group: '素材', ratio: '1:1', desc: '去底透明·二次设计用' },
  sku: { title: 'SKU规格图', group: '规格', ratio: '1:1', desc: '变体颜色/规格展示' },
  detail_slice_size: { title: '尺寸标注', group: '详情', ratio: '3:4', desc: '引线标注产品尺寸' },
  detail_slice_scene: { title: '场景拍摄', group: '详情', ratio: '3:4', desc: '真实使用环境展示' },
  detail_slice_qc: { title: '质检报告', group: '详情', ratio: '3:4', desc: '合格证/检测信息' },
  detail_slice_compare: { title: '优势对比', group: '详情', ratio: '3:4', desc: 'vs同款差异化对比' },
  detail_slice_feature: { title: '细节功能', group: '详情', ratio: '3:4', desc: '功能点callout标注' },
  detail_slice_care: { title: '保养维护', group: '详情', ratio: '3:4', desc: '使用保养说明' },
};

/* ═══════ 平台尺寸映射 ═════ PLATFORM_SIZES */
const PLATFORM_SIZES = {
  '淘宝': { '1:1': '1440×1440', '3:4': '1440×1920' },
  '京东': { '1:1': '1440×1440', '3:4': '1440×1920' },
  '拼多多': { '1:1': '1440×1440', '3:4': '1440×1920' },
  '小红书': { '1:1': '1440×1440', '3:4': '1440×1920' },
  '抖音': { '1:1': '1440×1440', '3:4': '1440×1920' },
  '亚马逊': { '1:1': '1000×1000', '3:4': '1500×2000' },
};

/* ═══════ EcCanvas — 无限画布工作台 + 作品管理 ═══════ */
export default function EcCanvas() {
  const { state, dispatch } = useApp();
  const result = state.result || {};
  const images = result.images || {};
  const phone = state.phone || '';
  const [loaded, setLoaded] = useState(false);
  const editorRef = useRef(null);
  const [tab, setTab] = useState('current'); // 'current' | 'past'
  const [pastWorks, setPastWorks] = useState([]);

  // 从 result.images 提取所有图片
  const imageList = Object.entries(images).map(([label, url], i) => {
    const baseKey = label.replace(/_\d+$/, '');
    const info = LABEL_MAP[baseKey] || { title: label, group: '其他', ratio: '1:1', desc: '' };
    const platform = result.platform || '淘宝';
    const size = (PLATFORM_SIZES[platform] || PLATFORM_SIZES['淘宝'])[info.ratio] || '1440×1440';
    return {
      label,
      url,
      title: info.title,
      group: info.group,
      ratio: info.ratio,
      size,
      desc: info.desc,
      displayLabel: info.title + (label !== baseKey ? ` ${label.replace(baseKey, '')}` : ''),
      index: i,
    };
  });

  // 加载历史作品
  useEffect(() => { setPastWorks(loadWorks()); }, []);

  // 当有生成结果时，自动保存到作品集（服务器 + 本地）
  useEffect(() => {
    if (imageList.length > 0 && result.product_name) {
      const works = loadWorks();
      // 避免重复保存（5秒内相同名称）
      const isDupe = works.length > 0 && works[0].name === result.product_name
        && (Date.now() - works[0].id) < 5000;
      if (isDupe) return;

      // 本地保存
      const newWork = {
        id: Date.now(),
        name: result.product_name || '未命名产品',
        images: imageList.map(img => ({ url: img.url, key: img.label, label: img.displayLabel, group: img.group, ratio: img.ratio, size: img.size })),
        createdAt: new Date().toISOString(),
      };
      works.unshift(newWork);
      if (works.length > 50) works.length = 50;
      saveWorksToStorage(works);
      setPastWorks(works);

      // 服务器保存（格式与 Works 页面兼容）
      if (phone) {
        const serverWork = {
          product_name: result.product_name || '未命名产品',
          category: result.category || '其他',
          platform: result.platform || '淘宝',
          _ecResult: true,
          at: new Date().toLocaleDateString('zh-CN'),
          images: imageList.map(img => ({
            url: img.url,
            key: img.label,
            label: img.displayLabel,
            style: img.title,
            group: img.group,
            ratio: img.ratio,
            size: img.size,
          })),
        };
        saveWork(serverWork, phone).then(r => {
          console.log('[EC] 作品已保存到服务器:', result.product_name);
        }).catch(e => console.warn('[EC] 保存到服务器失败:', e.message));
      } else {
        console.warn('[EC] 无法保存到服务器: 未登录');
      }
    }
  }, [imageList.length, result.product_name]);

  // 右键菜单状态
  const [ctxMenu, setCtxMenu] = useState({ visible: false, x: 0, y: 0, image: null });

  // 全局右键监听
  useEffect(() => {
    const handler = (e) => {
      const img = e.target.closest('img');
      if (img && img.src) {
        e.preventDefault();
        const matchedImage = imageList.find(il => il.url === img.src);
        setCtxMenu({ visible: true, x: e.clientX, y: e.clientY, image: matchedImage || null });
      }
    };
    window.addEventListener('contextmenu', handler);
    return () => window.removeEventListener('contextmenu', handler);
  }, [imageList]);

  // 画布加载后自动布局图片
  const handleMount = useCallback((editor) => {
    editorRef.current = editor;
    if (loaded) return;

    setTimeout(() => {
      if (!editor || imageList.length === 0) { setLoaded(true); return; }

      const CARD_W = 300;
      const GAP = 40;
      const COLS = Math.min(imageList.length, 4);

      imageList.forEach((img, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        const x = col * (CARD_W + GAP);
        const y = row * (CARD_W + GAP + 40);

        const assetId = editor.createAssetId();
        editor.createAssets([{
          id: assetId,
          type: 'image',
          typeName: 'asset',
          props: {
            name: img.title,
            src: img.url,
            w: CARD_W,
            h: CARD_W,
            mimeType: 'image/png',
            isUploaded: true,
          },
        }]);

        const shapeId = editor.createShapeId();
        editor.createShapes([{
          id: shapeId,
          type: 'image',
          x,
          y,
          props: { assetId, w: CARD_W, h: CARD_W },
        }]);

        const textId = editor.createShapeId();
        editor.createShapes([{
          id: textId,
          type: 'text',
          x,
          y: y + CARD_W + 8,
          props: { text: `${img.group} · ${img.displayLabel} · ${img.size}`, size: 's', font: 'draw', color: 'black' },
        }]);
      });

      editor.zoomToFit({ animation: { duration: 500 } });
      setLoaded(true);
    }, 300);
  }, [imageList, loaded]);

  const handleBack = () => {
    dispatch({ type: 'NAVIGATE', page: 'home' });
  };

  const handleNewWork = () => {
    dispatch({ type: 'CLOSE_RESULT' });
    dispatch({ type: 'NAVIGATE', page: 'home' });
  };

  const handleDownloadAll = async () => {
    for (const img of imageList) {
      if (!img.url) continue;
      const a = document.createElement('a');
      a.href = img.url;
      a.download = `${img.title}.png`;
      a.click();
      await new Promise(r => setTimeout(r, 200));
    }
  };

  const handleDownloadWork = (work) => {
    work.images.forEach((img, i) => {
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = img.url;
        a.download = `${work.name}_${img.label || i + 1}.png`;
        a.click();
      }, i * 300);
    });
  };

  const handleDeleteWork = (id) => {
    const works = pastWorks.filter(w => w.id !== id);
    setPastWorks(works);
    saveWorksToStorage(works);
  };

  const handleCtxAction = (action) => {
    const img = ctxMenu.image;
    if (!img) return;
    switch (action) {
      case 'export': {
        const a = document.createElement('a');
        a.href = img.url;
        a.download = `${img.title}.png`;
        a.click();
        break;
      }
      case 'redraw':
        alert('局部重绘功能开发中…');
        break;
      default:
        alert(`${img.title} — 该功能开发中…`);
    }
  };

  // ── 作品集视图 ──
  if (tab === 'past') {
    return (
      <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#0f0f1a', color: '#fff', overflow: 'auto' }}>
        {/* 顶部栏 */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 100,
          height: 52, background: 'rgba(15,15,26,0.9)', backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12,
        }}>
          <div onClick={handleBack}
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}>
            <MdArrowBack size={18} color="rgba(255,255,255,0.6)" />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>我的作品</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>共 {pastWorks.length} 个作品</div>

          {/* Tab 切换 */}
          <div style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 10, background: 'rgba(255,255,255,0.06)', marginLeft: 12 }}>
            <div onClick={() => setTab('current')}
              style={{
                padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: 'transparent', color: 'rgba(255,255,255,0.4)',
              }}>
              <MdGridOn size={13} style={{ marginRight: 3, verticalAlign: -1 }} />当前
            </div>
            <div onClick={() => setTab('past')}
              style={{
                padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: 'rgba(167,139,250,0.2)', color: '#a78bfa',
              }}>
              <MdCollections size={13} style={{ marginRight: 3, verticalAlign: -1 }} />作品集
            </div>
          </div>

          <div onClick={handleNewWork}
            style={{
              marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 14px', borderRadius: 8,
              background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
              color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>
            <MdAdd size={14} /> 新建
          </div>
        </div>

        {/* 作品列表 */}
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
          {pastWorks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px' }}>
              <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>📁</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.4)' }}>还没有历史作品</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', marginTop: 8 }}>生成的电商图会自动保存到这里</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {pastWorks.map(work => (
                <div key={work.id} style={{
                  borderRadius: 16, overflow: 'hidden',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  {/* 作品标题行 */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{work.name}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                        {new Date(work.createdAt).toLocaleString('zh-CN')} · {work.images.length} 张
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <div onClick={() => handleDownloadWork(work)}
                        style={{
                          padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                          background: 'rgba(167,139,250,0.12)', color: '#a78bfa', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                        <MdDownload size={12} /> 下载全部
                      </div>
                      <div onClick={() => handleDeleteWork(work.id)}
                        style={{
                          padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                          background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                        <MdDelete size={12} /> 删除
                      </div>
                    </div>
                  </div>
                  {/* 缩略图 */}
                  <div style={{ display: 'flex', gap: 8, padding: 12, overflowX: 'auto' }}>
                    {work.images.slice(0, 10).map((img, i) => (
                      <img key={i} src={img.url} alt={img.key}
                        style={{
                          width: 100, height: 100, objectFit: 'cover', borderRadius: 10,
                          border: '1px solid rgba(255,255,255,0.08)', flexShrink: 0,
                        }} />
                    ))}
                    {work.images.length > 10 && (
                      <div style={{
                        width: 100, height: 100, borderRadius: 10,
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, color: 'rgba(255,255,255,0.3)', flexShrink: 0,
                      }}>
                        +{work.images.length - 10}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── 画布视图 ──
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#f8f9fa' }}>
      {/* ── 顶部工具栏 ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 52,
        background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.08)',
        display: 'flex', alignItems: 'center', padding: '0 16px',
        zIndex: 100, gap: 12,
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}>
        {/* 返回 */}
        <div onClick={handleBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '6px 12px', borderRadius: 8,
            border: '1px solid rgba(0,0,0,0.1)',
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
            color: 'var(--text-secondary)', transition: 'all 0.15s',
          }}>
          <MdArrowBack size={16} /> 返回
        </div>

        {/* 标题 */}
        <div style={{ fontSize: 15, fontWeight: 800, color: '#1a1a1a' }}>
          电商素材工作台
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {imageList.length} 张素材 · 双指缩放/拖拽画布 · 右键图片查看 AI 能力
        </div>

        {/* Tab 切换 */}
        <div style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 10, background: 'rgba(0,0,0,0.04)', marginLeft: 12 }}>
          <div onClick={() => setTab('current')}
            style={{
              padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: 'rgba(0,0,0,0.08)', color: '#1a1a1a',
            }}>
            <MdGridOn size={13} style={{ marginRight: 3, verticalAlign: -1 }} />当前
          </div>
          <div onClick={() => setTab('past')}
            style={{
              padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: 'transparent', color: 'var(--text-muted)',
            }}>
            <MdCollections size={13} style={{ marginRight: 3, verticalAlign: -1 }} />作品集 ({pastWorks.length})
          </div>
        </div>

        {/* 右侧操作 */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div onClick={handleDownloadAll}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 14px', borderRadius: 8,
              background: '#1a1a1a', color: '#fff',
              cursor: 'pointer', fontSize: 12, fontWeight: 600,
              transition: 'all 0.15s',
            }}>
            <MdDownload size={14} /> 全部下载
          </div>
        </div>
      </div>

      {/* ── tldraw 画布 ── */}
      <div style={{ position: 'absolute', top: 52, left: 0, right: 0, bottom: 0 }}>
        <Tldraw
          onMount={handleMount}
          hideUi={false}
          components={{}}
        />
      </div>

      {/* ── 空状态 ── */}
      {imageList.length === 0 && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center', color: 'var(--text-muted)',
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎨</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>暂无生成结果</div>
          <div style={{ fontSize: 13 }}>请先完成图片生成</div>
          <div onClick={handleBack} style={{
            marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '10px 24px', borderRadius: 12,
            background: '#1a1a1a', color: '#fff',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>返回生成</div>
        </div>
      )}

      {/* ── 右键菜单 ── */}
      <ContextMenu
        visible={ctxMenu.visible}
        x={ctxMenu.x}
        y={ctxMenu.y}
        onClose={() => setCtxMenu(prev => ({ ...prev, visible: false }))}
        onAction={handleCtxAction}
      />
    </div>
  );
}
