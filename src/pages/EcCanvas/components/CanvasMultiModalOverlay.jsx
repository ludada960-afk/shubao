// 4c183cd4 续命 P-A 画布三方多模态串联 浮层
// 把 src/components/business/MultiModalEntry.jsx 适配到 EcCanvas 入口: 
//   - 选中节点 url 作为参考图
//   - 完成后调 onComplete 把多模态结果落到画布 (视频/音频/商品档案)
//   - 走 multiModalService.mjs
// 设计: 资深美工视角用毛玻璃 + 12px 圆角 + 暗色; 产品经理视角显示「视频+音频+商品档案」3 路并行; 商业化视角右上角积分消耗徽章
import React, { useEffect } from 'react';
import { Camera, Volume2, Package, X } from 'lucide-react';
import MultiModalEntry from '../../../components/business/MultiModalEntry.jsx';

export default function CanvasMultiModalOverlay({ open, onClose, referenceImage = null, defaultProjectKind = 'video', onComplete }) {
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => { if (e.key === 'Escape') { e.preventDefault(); onClose?.(); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);
  if (!open) return null;
  return <div role="dialog" aria-modal="true" aria-label="三方多模态串联" style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
    <div style={{ position: 'relative', width: 'min(760px, 94vw)', maxHeight: '88vh', overflow: 'auto', borderRadius: 14, background: '#fff', boxShadow: '0 24px 60px rgba(15,23,42,.32)', border: '1px solid rgba(15,23,42,.06)' }}>
      <button type="button" aria-label="关闭多模态串联" onClick={() => onClose?.()} style={{ position: 'absolute', top: 12, right: 12, zIndex: 5, width: 32, height: 32, borderRadius: 8, border: 0, background: 'rgba(15,23,42,.06)', color: '#475569', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <X size={16} />
      </button>
      <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid rgba(15,23,42,.06)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 999, background: 'rgba(124,58,237,.08)', color: '#7c3aed', fontSize: 11, fontWeight: 600 }}>
          <Camera size={12} />视频
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 999, background: 'rgba(59,130,246,.08)', color: '#1d4ed8', fontSize: 11, fontWeight: 600 }}>
          <Volume2 size={12} />音频
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 999, background: 'rgba(16,185,129,.08)', color: '#047857', fontSize: 11, fontWeight: 600 }}>
          <Package size={12} />商品档案
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748b' }}>三方多模态串联 → 落画布节点 + 作品档案</span>
      </div>
      <MultiModalEntry open={open} onClose={onClose} referenceImage={referenceImage} defaultProjectKind={defaultProjectKind} onComplete={onComplete} />
    </div>
  </div>;
}
