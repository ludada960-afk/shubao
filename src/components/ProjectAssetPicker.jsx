import React, { useState, useEffect, useCallback } from 'react';
import { listProjectAssetLibrary } from '../services/projects.js';
import { projectAssetToEcommerceImage } from '../services/api.js';

// 通用素材库选择弹窗：从统一素材库(project_assets)选取图片/视频/音频
// props: { open, onClose, onPick(assets), mediaKind='image', multi=true, title }
export default function ProjectAssetPicker({ open, onClose, onPick, mediaKind = 'image', multi = true, title = '从素材库选择' }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState([]);

  const load = useCallback(async (q) => {
    setLoading(true);
    setError('');
    try {
      const list = await listProjectAssetLibrary({ mediaKind, query: q || '', limit: 200 });
      setAssets(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err?.message || '素材库读取失败');
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [mediaKind]);

  useEffect(() => {
    if (open) {
      setSelected([]);
      load('');
    }
  }, [open, load]);

  if (!open) return null;

  const toggle = (asset) => {
    const key = asset.projectId + ':' + asset.projectAssetId;
    setSelected(current => {
      if (!multi) return current.some(a => (a.projectId + ':' + a.projectAssetId) === key) ? [] : [asset];
      return current.some(a => (a.projectId + ':' + a.projectAssetId) === key)
        ? current.filter(a => (a.projectId + ':' + a.projectAssetId) !== key)
        : [...current, asset];
    });
  };

  const confirm = () => {
    if (!selected.length) return;
    onPick(selected);
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: 'min(860px, 96vw)', maxHeight: '86vh', background: '#fff', borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid #edf0f3' }}>
          <strong style={{ fontSize: 14, color: '#1a1a1a' }}>{title}</strong>
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter') load(query); }}
            placeholder="搜索素材名称 / 项目 / ID"
            style={{ flex: 1, height: 32, padding: '0 10px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 12 }}
          />
          <button type="button" onClick={() => load(query)} style={{ height: 32, padding: '0 12px', border: 0, borderRadius: 7, background: '#7c3aed', color: '#fff', fontSize: 12, cursor: 'pointer' }}>搜索</button>
          <button type="button" onClick={onClose} aria-label="关闭" style={{ width: 30, height: 30, border: 0, borderRadius: 8, background: '#f3f4f6', cursor: 'pointer', fontSize: 13 }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#8a929d', fontSize: 12 }}>正在读取素材…</div>
          ) : error ? (
            <div role="alert" style={{ padding: 14, border: '1px solid #fecaca', borderRadius: 10, background: '#fff7f7', color: '#b42318', fontSize: 12 }}>{error}</div>
          ) : !assets.length ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#8a929d', fontSize: 12 }}>
              素材库暂无可用的{mediaKind === 'image' ? '图片' : mediaKind === 'video' ? '视频' : '音频'}素材。
              <br />提示：在作品卡片上点「加入素材库」，即可把生成结果收录进来复用。
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10 }}>
              {assets.map(asset => {
                const key = asset.projectId + ':' + asset.projectAssetId;
                const isPicked = selected.some(a => (a.projectId + ':' + a.projectAssetId) === key);
                const kind = String(asset.mediaKind || '').toLowerCase();
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggle(asset)}
                    style={{
                      position: 'relative', padding: 0, overflow: 'hidden', borderRadius: 10,
                      border: isPicked ? '2px solid #7c3aed' : '1px solid #e7eaee',
                      background: '#fff', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <div style={{ height: 96, display: 'grid', placeItems: 'center', overflow: 'hidden', background: kind === 'video' ? '#111827' : '#f4f5f7' }}>
                      {kind === 'image'
                        ? <img src={asset.stableUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : kind === 'video'
                          ? <video src={asset.playbackUrl || asset.stableUrl} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ fontSize: 22 }}>🎵</span>}
                    </div>
                    <div style={{ padding: '6px 8px' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11, fontWeight: 700, color: '#26313c' }}>
                        {(asset.metadata?.displayName || asset.assetId || '项目素材')}
                      </div>
                      <div style={{ marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10, color: '#8a929d' }}>
                        {asset.project?.title || asset.projectTitle || ''}
                      </div>
                    </div>
                    {isPicked && (
                      <span style={{ position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: '50%', background: '#7c3aed', color: '#fff', fontSize: 11, display: 'grid', placeItems: 'center' }}>✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid #edf0f3' }}>
          <span style={{ fontSize: 11, color: '#8a929d' }}>{multi ? ('已选 ' + selected.length + ' 项') : ''}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose} style={{ height: 34, padding: '0 14px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', fontSize: 12, cursor: 'pointer' }}>取消</button>
            <button type="button" onClick={confirm} disabled={!selected.length} style={{ height: 34, padding: '0 18px', border: 0, borderRadius: 8, background: selected.length ? '#7c3aed' : '#ddd', color: '#fff', fontSize: 12, fontWeight: 700, cursor: selected.length ? 'pointer' : 'default' }}>确定使用</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function projectAssetToEcommerceImages(assets, role) {
  return (Array.isArray(assets) ? assets : [])
    .map(asset => projectAssetToEcommerceImage(asset, role))
    .filter(Boolean);
}
