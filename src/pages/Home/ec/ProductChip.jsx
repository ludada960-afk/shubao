import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, PackageSearch } from 'lucide-react';
import { productProfileSummary } from './productProfileModel.js';

/**
 * 底部生成设置栏的常驻「当前商品」chip：可见、可点，弹出档案选择器。
 * 选中后全局生效（主图槽位/生成后自动归档）。
 */
export default function ProductChip({ profile = null, profiles = [], loading = false, onSelect }) {
  const [open, setOpen] = useState(false);
  const chipRef = useRef(null);
  const popRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = event => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onClick = event => {
      if (chipRef.current?.contains(event.target)) return;
      if (popRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    globalThis.addEventListener?.('keydown', onKey);
    const timer = setTimeout(() => globalThis.addEventListener?.('mousedown', onClick), 0);
    return () => {
      globalThis.removeEventListener?.('keydown', onKey);
      globalThis.removeEventListener?.('mousedown', onClick);
      clearTimeout(timer);
    };
  }, [open]);

  const rect = chipRef.current?.getBoundingClientRect();
  const popLeft = rect ? Math.max(8, Math.min(rect.left, (globalThis.innerWidth || 0) - 292)) : 0;
  const popBottom = rect ? (globalThis.innerHeight || 0) - rect.top + 8 : 0;

  return (
    <>
      <button
        ref={chipRef}
        type="button"
        className={`ec-product-chip${profile ? ' has-profile' : ''}`}
        aria-label={profile ? `当前商品：${profile.name}，点击切换` : '当前商品：未选择，点击选择商品档案'}
        aria-expanded={open}
        aria-haspopup="listbox"
        data-testid="ec-current-product-chip"
        onClick={() => setOpen(previous => !previous)}
      >
        <PackageSearch size={14} aria-hidden="true" />
        <span className="ec-product-chip-copy">
          <span>当前商品</span>
          <strong>{loading ? '读取中…' : profile ? profile.name : '未选择'}</strong>
        </span>
        <ChevronDown size={12} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .18s ease' }} />
      </button>
      {open && createPortal(
        <div
          ref={popRef}
          className="ec-product-chip-pop"
          role="listbox"
          aria-label="选择当前商品档案"
          style={{ left: popLeft, bottom: popBottom }}
        >
          {!profiles.length && <div className="ec-product-chip-empty">还没有商品档案；在左侧「商品档案」保存一次即可复用。</div>}
          {profiles.map(item => (
            <button
              key={item.profileId}
              type="button"
              role="option"
              aria-selected={item.profileId === profile?.profileId}
              className={item.profileId === profile?.profileId ? 'is-active' : ''}
              onClick={() => {
                onSelect?.(item);
                setOpen(false);
              }}
            >
              <span className="ec-product-chip-item-copy">
                <strong>{item.name}</strong>
                <span>{productProfileSummary(item)}</span>
              </span>
              {item.profileId === profile?.profileId && <Check size={13} />}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
