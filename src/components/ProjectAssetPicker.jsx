import React, { useState, useEffect, useCallback } from 'react';
import { listProjectAssetLibrary } from '../services/projects.js';
import { projectAssetToEcommerceImage } from '../services/api.js';

// 通用资产库选择弹窗：从统一资产库(project_assets)选取图片/视频/音频
// props: { open, onClose, onPick(assets), mediaKind='image', multi=true, title }
export default function ProjectAssetPicker({ open, onClose, onPick, mediaKind = 'image', multi = true, title = '从资产库选择' }) {
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
      setError(err?.message || '资产库读取失败');
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 'var(--sb-z-modal)', background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: 'min(860px, 96vw)', maxHeight: '86vh', background: 'var(--sb-neutral-0)', borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sb-space-2-5)', padding: '12px 16px', borderBottom: '1px solid var(--sb-neutral-100)' }}>
          <strong style={{ fontSize: 14, color: 'var(--sb-ink-1)' }}>{title}</strong>
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter') load(query); }}
            placeholder="搜索素材名称 / 项目 / ID"
            style={{ flex: 1, height: 32, padding: '0 10px', border: '1px solid var(--sb-neutral-300)', borderRadius: 7, fontSize: 12 }}
          />
          <button type="button" onClick={() => load(query)} style={{ height: 32, padding: '0 12px', border: 0, borderRadius: 7, background: 'var(--sb-brand)', color: 'var(--sb-neutral-0)', fontSize: 12, cursor: 'pointer' }}>搜索</button>
          <button type="button" onClick={onClose} aria-label="关闭" style={{ width: 30, height: 30, border: 0, borderRadius: 8, background: 'var(--sb-neutral-100)', cursor: 'pointer', fontSize: 13 }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#8a929d', fontSize: 12 }}>正在读取素材…</div>
          ) : error ? (
            <div role="alert" style={{ padding: 14, border: '1px solid var(--sb-danger-border)', borderRadius: 8, background: '#fff7f7', color: '#b42318', fontSize: 12 }}>{error}</div>
          ) : !assets.length ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#8a929d', fontSize: 12 }}>
              资产库暂无可用的{mediaKind === 'image' ? '图片' : mediaKind === 'video' ? '视频' : '音频'}素材。
              <br />提示：在作品卡片上点「加入资产库」，即可把生成结果收录进来复用。
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 'var(--sb-space-2-5)' }}>
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
                      position: 'relative', padding: 0, overflow: 'hidden', borderRadius: 8,
                      border: isPicked ? '2px solid var(--sb-sel-line)' : '1px solid #e7eaee',
                      background: 'var(--sb-neutral-0)', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <div style={{ height: 96, display: 'grid', placeItems: 'center', overflow: 'hidden', background: kind === 'video' ? 'var(--sb-ink-1)' : '#f4f5f7' }}>
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
                      <span style={{ position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: '50%', background: 'var(--sb-brand)', color: 'var(--sb-neutral-0)', fontSize: 11, display: 'grid', placeItems: 'center' }}>✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {/* 9-16 用户批注：「你这两个按钮做的这么近也很奇怪啊。你似乎没有一个全局的意识呀。」
            → 底部操作区改用**全站统一规范** .ui-modal-footer / .ui-modal-footer-actions
              （按钮间距 12px、上间距 16px、内边距 20px、按钮 36px 高 / 最小宽 88px、
               次要左主要右、主次等重、禁用态有明确底色与文字色）。
              详见 src/styles/design-tokens.css 的 --footer-actions-* 与 .ui-modal-footer。 */}
        <div className="ui-modal-footer">
          <span className="ui-modal-footer-meta">{multi ? ('已选 ' + selected.length + ' 项') : ''}</span>
          <div className="ui-modal-footer-actions">
            <button type="button" className="ui-btn ui-btn-secondary" onClick={onClose}>取消</button>
            <button type="button" className="ui-btn ui-btn-primary" onClick={confirm} disabled={!selected.length}>确定使用</button>
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
