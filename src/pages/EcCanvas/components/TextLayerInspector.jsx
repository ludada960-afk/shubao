import React, { useEffect, useState } from 'react';
import {
  MdClose,
  MdFormatAlignCenter,
  MdFormatAlignLeft,
  MdFormatAlignRight,
  MdSave,
  MdTextFields,
} from 'react-icons/md';

const ALIGNMENTS = [
  ['left', MdFormatAlignLeft, '左对齐'],
  ['center', MdFormatAlignCenter, '居中'],
  ['right', MdFormatAlignRight, '右对齐'],
];

export default function TextLayerInspector({ layer, position = {}, ocrMode = false, ocrBlocks = null, ocrLoading = false, saving = false, error = '', onRecognize, onSave, onClose }) {
  const [draft, setDraft] = useState(layer);
  const [ocrDraft, setOcrDraft] = useState(ocrBlocks || []);

  useEffect(() => setDraft(layer), [layer]);
  useEffect(() => setOcrDraft(ocrBlocks || []), [ocrBlocks]);
  if (!draft) return null;

  const updateNumber = (key, value) => {
    const number = Number(value);
    setDraft(current => ({ ...current, [key]: Number.isFinite(number) ? number : current[key] }));
  };

  return (
    <aside
      aria-label="文字图层检查器"
      style={{ position: 'fixed', zIndex: 10004, width: 'min(310px, calc(100vw - 36px))', boxSizing: 'border-box', background: '#fff', border: '1px solid rgba(0,0,0,.1)', borderRadius: 8, boxShadow: '0 16px 42px rgba(15,23,42,.18)', padding: 14, ...position }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <MdTextFields size={18} color="#0f766e" />
        <strong style={{ fontSize: 13, color: '#1f2937', flex: 1 }}>{ocrMode ? '图片文字' : '文字图层'}</strong>
        <button type="button" onClick={onClose} title="关闭" aria-label="关闭文字图层" style={{ width: 28, height: 28, border: 0, borderRadius: 6, background: '#f3f4f6', color: '#6b7280', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><MdClose size={16} /></button>
      </div>

      {ocrMode ? (
        <div style={{ display: 'grid', gap: 9, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#6b7280' }}>{ocrLoading ? '正在识别图片里的文字…' : '识别到的文字可直接修改，保存后会生成一张新图片。'}</div>
          {!ocrLoading && ocrDraft.map((block, index) => <label key={block.id || index} style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#4b5563' }}>
            文字 {index + 1}
            <textarea value={block.text || ''} onChange={event => setOcrDraft(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item))} rows={2} maxLength={400} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 6, padding: '9px 10px', border: '1px solid #d1d5db', borderRadius: 7, resize: 'vertical', font: '12px/1.55 inherit', color: '#111827' }} />
          </label>)}
          {!ocrLoading && !ocrDraft.length && <button type="button" onClick={onRecognize} style={{ height: 32, border: '1px solid #d1d5db', borderRadius: 7, background: '#fff', color: '#4b5563', cursor: 'pointer', fontSize: 11 }}>重新识别</button>}
        </div>
      ) : (
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#4b5563', marginBottom: 12 }}>
          文案
          <textarea value={draft.text} onChange={event => setDraft(current => ({ ...current, text: event.target.value }))} rows={4} maxLength={4000} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 6, padding: '9px 10px', border: '1px solid #d1d5db', borderRadius: 7, resize: 'vertical', font: '12px/1.55 inherit', color: '#111827' }} />
        </label>
      )}

      {!ocrMode && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#4b5563' }}>
          字号
          <input type="number" min="8" max="512" step="1" value={draft.fontSize} onChange={event => updateNumber('fontSize', event.target.value)} style={{ display: 'block', width: '100%', height: 34, boxSizing: 'border-box', marginTop: 6, padding: '0 8px', border: '1px solid #d1d5db', borderRadius: 7 }} />
        </label>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#4b5563' }}>
          行高
          <input type="number" min="0.5" max="3" step="0.1" value={draft.lineHeight} onChange={event => updateNumber('lineHeight', event.target.value)} style={{ display: 'block', width: '100%', height: 34, boxSizing: 'border-box', marginTop: 6, padding: '0 8px', border: '1px solid #d1d5db', borderRadius: 7 }} />
        </label>
      </div>}

      {!ocrMode && <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#4b5563', marginBottom: 6 }}>对齐</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
          {ALIGNMENTS.map(([value, Icon, label]) => (
            <button key={value} type="button" title={label} aria-label={label} onClick={() => setDraft(current => ({ ...current, align: value }))} style={{ height: 32, border: draft.align === value ? '1px solid #0f766e' : '1px solid #e5e7eb', borderRadius: 7, background: draft.align === value ? '#ecfdf5' : '#fff', color: draft.align === value ? '#0f766e' : '#6b7280', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon size={17} /></button>
          ))}
        </div>
      </div>}

      {!ocrMode && <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 11, fontWeight: 700, color: '#4b5563', marginBottom: 14 }}>
        颜色
        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <input type="color" value={draft.color.slice(0, 7)} onChange={event => setDraft(current => ({ ...current, color: event.target.value }))} aria-label="文字颜色" style={{ width: 34, height: 30, padding: 2, border: '1px solid #d1d5db', borderRadius: 6, background: '#fff' }} />
          <input value={draft.color} onChange={event => setDraft(current => ({ ...current, color: event.target.value }))} aria-label="颜色值" maxLength={9} style={{ width: 82, height: 30, boxSizing: 'border-box', padding: '0 7px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 11 }} />
        </span>
      </label>}

      {!ocrMode && <div style={{ fontSize: 10, color: '#6b7280', marginBottom: error ? 8 : 12 }}>字体：系统安全字体</div>}
      {error && <div role="alert" style={{ fontSize: 11, color: '#b91c1c', marginBottom: 10 }}>{error}</div>}
      <button type="button" disabled={saving || ocrLoading || (ocrMode && !ocrDraft.length)} onClick={() => onSave?.(ocrMode ? { ocrBlocks: ocrDraft } : draft)} style={{ width: '100%', height: 36, border: 0, borderRadius: 7, background: saving || ocrLoading ? '#9ca3af' : '#0f766e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, fontWeight: 800, cursor: saving ? 'wait' : 'pointer' }}>
        <MdSave size={16} /> {saving ? '保存中' : ocrMode ? '替换图片文字' : '保存新版本'}
      </button>
    </aside>
  );
}
