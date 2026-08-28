import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Check, ChevronDown, LoaderCircle, PackageSearch, RefreshCw, X } from 'lucide-react';
import { listProductProfiles } from '../../../services/projects.js';
import { productProfileSummary } from './productProfileModel.js';
import './crossModeProductProfile.css';

export {
  applyProductProfileFactsToPlog,
  applyProductProfileFactsToXhs,
  buildProductProfilePromptTail,
} from './crossModeProductProfile.js';

// ── 共享: useProductProfiles() ──
// 拉取当前用户的 active 档案列表 + 错误态; 自动忽略未登录场景。
// 各 mode 各自调一次即可, 服务端 /api/product-profiles 有缓存, 重复调用不消耗额外预算。
export function useProductProfiles({ status = 'active', limit = 50, autoLoad = true } = {}) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const next = await listProductProfiles({ status, limit });
      setProfiles(Array.isArray(next) ? next : []);
    } catch (fetchError) {
      setError(fetchError?.message || '暂时无法读取商品档案');
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, [status, limit]);

  useEffect(() => {
    if (autoLoad) {
      refresh();
    }
  }, [autoLoad, refresh]);

  return { profiles, loading, error, refresh };
}

// ── 共享: ProductProfilePicker ──
// 跨 mode 复用的轻量级 chip + popover 选择器; 点击 chip 展开档案列表,
// 选中后调用 onSelect(profile), 由各 mode 决定如何把事实写回自己的 state。
// 设计上不复用 EcMode 的 portal 抽屉 (z-index 1300 与浮层互相干扰),
// 改为 inline popover, 配合各 mode 自身的页面布局。
export default function ProductProfilePicker({
  profiles = [],
  loading = false,
  error = '',
  activeProfileId = '',
  onSelect,
  onRefresh,
  accentColor = '#7c3aed',
  triggerLabel = '当前商品',
  emptyHint = '暂未保存商品档案, 请先在电商工作台保存一个商品档案',
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = event => {
      if (!rootRef.current || rootRef.current.contains(event.target)) return;
      setOpen(false);
    };
    const onKey = event => {
      if (event.key === 'Escape') setOpen(false);
    };
    globalThis.document?.addEventListener?.('mousedown', onClick);
    globalThis.addEventListener?.('keydown', onKey);
    return () => {
      globalThis.document?.removeEventListener?.('mousedown', onClick);
      globalThis.removeEventListener?.('keydown', onKey);
    };
  }, [open]);

  const activeProfile = profiles.find(profile => profile.profileId === activeProfileId) || null;
  const triggerActive = Boolean(activeProfile);
  const applyAndClose = profile => {
    if (!profile) return;
    onSelect?.(profile);
    setOpen(false);
  };

  return (
    <div className="cm-profile-picker" ref={rootRef}>
      <button
        type="button"
        className={`cm-profile-picker-trigger${triggerActive ? ' is-active' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
        style={triggerActive ? { borderColor: accentColor, color: accentColor } : undefined}
      >
        <PackageSearch size={14} strokeWidth={1.8} aria-hidden="true" />
        <span className="cm-profile-picker-copy">
          <span className="cm-profile-picker-eyebrow">{triggerLabel}</span>
          <strong>
            {loading ? '读取中…' : activeProfile ? activeProfile.name : '未选择 · 点击选用档案'}
          </strong>
        </span>
        <ChevronDown size={12} aria-hidden="true" style={{ opacity: 0.5 }} />
      </button>
      {open && (
        <div className="cm-profile-picker-pop" role="listbox" aria-label="商品档案列表">
          <div className="cm-profile-picker-head">
            <strong><BookOpen size={13} aria-hidden="true" /> 商品档案</strong>
            <span className="cm-profile-picker-count">{profiles.length}</span>
            <button
              type="button"
              className="cm-profile-picker-icon"
              onClick={() => onRefresh?.()}
              disabled={loading}
              title="刷新商品档案"
              aria-label="刷新商品档案"
            >
              <RefreshCw size={12} className={loading ? 'is-spinning' : ''} />
            </button>
            <button
              type="button"
              className="cm-profile-picker-icon"
              onClick={() => setOpen(false)}
              title="收起选择器"
              aria-label="收起选择器"
            >
              <X size={12} />
            </button>
          </div>
          {error && <div className="cm-profile-picker-error" role="alert">{error}</div>}
          {loading && profiles.length === 0 && (
            <div className="cm-profile-picker-empty"><LoaderCircle size={13} className="is-spinning" />正在读取档案</div>
          )}
          {!loading && profiles.length === 0 && (
            <div className="cm-profile-picker-empty">{emptyHint}</div>
          )}
          {profiles.length > 0 && (
            <ul className="cm-profile-picker-list">
              {profiles.map(profile => {
                const isCurrent = profile.profileId === activeProfileId;
                return (
                  <li key={profile.profileId} className={`cm-profile-picker-item${isCurrent ? ' is-current' : ''}`}>
                    <button
                      type="button"
                      onClick={() => applyAndClose(profile)}
                      aria-pressed={isCurrent}
                    >
                      <span className="cm-profile-picker-avatar" aria-hidden="true">
                        {String(profile.name || '商').slice(0, 1)}
                      </span>
                      <span className="cm-profile-picker-text">
                        <span className="cm-profile-picker-title">
                          {profile.name}
                          {isCurrent && <em>当前</em>}
                        </span>
                        <span className="cm-profile-picker-summary">
                          {productProfileSummary(profile) || '已保存的档案'}
                        </span>
                      </span>
                      {isCurrent && <Check size={13} aria-hidden="true" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
