import React from 'react';
import { Check, Images, RectangleVertical } from 'lucide-react';

const RATIOS = [
  { id: '3:4', label: '3:4', note: '电商竖图' },
  { id: '4:5', label: '4:5', note: '社媒穿搭' },
  { id: '1:1', label: '1:1', note: '商城主图' },
  { id: '9:16', label: '9:16', note: '全屏展示' },
];

function currentConfig(sizing = {}) {
  const item = Array.isArray(sizing.images) ? sizing.images[0] : null;
  return {
    ratio: item?.targetRatio || item?.ratio || '3:4',
    count: Math.max(1, Math.min(4, Number(item?.count || 4))),
  };
}

export default function TryOnPlanPanel({ sizing, onSizingChange }) {
  const current = currentConfig(sizing);
  const update = next => {
    const ratio = next.ratio || current.ratio;
    const count = next.count || current.count;
    onSizingChange?.({
      smart: false,
      images: [{ key: 'main_3x4', label: '穿搭成片', count, ratio, targetRatio: ratio, cropPolicy: 'none' }],
    });
  };

  return (
    <div className="ec-tryon-plan-panel">
      <div className="ec-tryon-panel-block">
        <div className="ec-tryon-panel-label"><RectangleVertical size={13} /><div><strong>成片画幅</strong><span>优先选择能完整展示人物与商品关系的竖幅</span></div></div>
        <div className="ec-tryon-ratio-grid">
          {RATIOS.map(option => {
            const selected = current.ratio === option.id;
            return <button type="button" key={option.id} className={selected ? 'is-selected' : ''} onClick={() => update({ ratio: option.id })}><span>{option.label}</span><small>{option.note}</small>{selected && <Check size={12} />}</button>;
          })}
        </div>
      </div>
      <div className="ec-tryon-panel-block">
        <div className="ec-tryon-panel-label"><Images size={13} /><div><strong>生成张数</strong><span>第二步会为每张图安排不同姿态、景别与商品重点</span></div></div>
        <div className="ec-tryon-count-row">
          {[1, 2, 3, 4].map(count => <button type="button" key={count} className={current.count === count ? 'is-selected' : ''} onClick={() => update({ count })}>{count} 张</button>)}
        </div>
      </div>
      <div className="ec-tryon-shot-preview">
        {['全身穿搭', '动态姿态', '商品细节', '场景成片'].slice(0, current.count).map((label, index) => <span key={label}><b>{index + 1}</b>{label}</span>)}
      </div>
    </div>
  );
}
