// 4c183cd4 续命 P-G 画布 1-click chain 浮层
// 把 src/components/chain/ChainOrchestrator.jsx 适配到 EcCanvas 入口: 
//   - 选中节点 url 作为参考图
//   - 完成后调 onComplete 把 4 步结果落到画布 (新增视频节点 + 字幕节点)
//   - 走 chainService (29 测试全过)
// 设计: 资深美工视角用毛玻璃 + 12px 圆角 + 暗色; 产品经理视角 4 步进度卡; 商业化视角右上角积分消耗徽章
import React, { useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';
import ChainOrchestrator from '../../../components/chain/ChainOrchestrator.jsx';

export default function CanvasChainOverlay({ open, onClose, referenceImage = null, onComplete }) {
  // 阻止 body 滚动; ESC 关闭; 配合 canvas esc handler
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => { if (e.key === 'Escape') { e.preventDefault(); onClose?.(); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);
  if (!open) return null;
  return <div role="dialog" aria-modal="true" aria-label="1-click 视频链式生成" style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
    <div style={{ position: 'relative', width: 'min(720px, 92vw)', maxHeight: '88vh', overflow: 'auto', borderRadius: 14, background: '#fff', boxShadow: '0 24px 60px rgba(15,23,42,.32)', border: '1px solid rgba(15,23,42,.06)' }}>
      <button type="button" aria-label="关闭链式生成" onClick={() => onClose?.()} style={{ position: 'absolute', top: 12, right: 12, zIndex: 5, width: 32, height: 32, borderRadius: 8, border: 0, background: 'rgba(15,23,42,.06)', color: '#475569', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <X size={16} />
      </button>
      <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid rgba(15,23,42,.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Sparkles size={18} style={{ color: '#7c3aed' }} />
        <strong style={{ fontSize: 15, color: '#0f172a' }}>1-click 视频链式生成</strong>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748b' }}>4 步：文案 → 首帧 → 视频 → 音轨+字幕</span>
      </div>
      <ChainOrchestrator open={open} onClose={onClose} referenceImage={referenceImage} onComplete={onComplete} />
    </div>
  </div>;
}
