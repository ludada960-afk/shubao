import React, { useState, useRef, useCallback } from 'react';
import './VisionFeedback.css';

const DEFAULT_PROMPT = '重点关注：UI 缺陷、文字、布局、配色、交互盲点与可读性。';

function VisionFeedback() {
  const [image, setImage] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [busy, setBusy] = useState(false);
  const [context, setContext] = useState('');
  const [rawSummary, setRawSummary] = useState(null);
  const [error, setError] = useState('');
  const [dragStart, setDragStart] = useState(null);
  const [pendingBox, setPendingBox] = useState(null);
  const imgRef = useRef(null);
  const fileRef = useRef(null);

  const onFile = useCallback((f) => {
    if (!f) return;
    if (!/^image\//.test(f.type)) { setError('仅支持图片文件'); return; }
    setError('');
    const reader = new FileReader();
    reader.onload = (e) => setImage({ url: e.target.result, name: f.name, file: f });
    reader.readAsDataURL(f);
    setAnnotations([]);
    setContext('');
  }, []);

  const localCoords = (evt) => {
    const r = imgRef.current.getBoundingClientRect();
    const x = Math.round(((evt.clientX - r.left) / r.width) * 100);
    const y = Math.round(((evt.clientY - r.top) / r.height) * 100);
    return { x, y };
  };

  const onImgDown = (evt) => {
    if (!image) return;
    const { x, y } = localCoords(evt);
    setDragStart({ x, y });
    setPendingBox({ x, y, w: 0, h: 0 });
  };
  const onImgMove = (evt) => {
    if (!dragStart) return;
    const { x, y } = localCoords(evt);
    const bx = Math.min(dragStart.x, x), by = Math.min(dragStart.y, y);
    const bw = Math.abs(x - dragStart.x), bh = Math.abs(y - dragStart.y);
    setPendingBox({ x: bx, y: by, w: bw, h: bh });
  };
  const onImgUp = () => {
    if (pendingBox && pendingBox.w > 2 && pendingBox.h > 2) {
      const note = window.prompt('这一区域要改什么？\n（说明问题/期望/参考）', '');
      if (note && note.trim()) {
        setAnnotations((arr) => [...arr, { id: Date.now() + Math.random(), region: pendingBox, note: note.trim() }]);
      }
    }
    setDragStart(null); setPendingBox(null);
  };

  const removeAnn = (id) => setAnnotations((arr) => arr.filter((a) => a.id !== id));

  const submit = async () => {
    if (!image) return;
    setBusy(true); setError(''); setContext(''); setRawSummary(null);
    try {
      const fd = new FormData();
      fd.append('image', image.file);
      fd.append('annotations', JSON.stringify(annotations.map((a) => ({ note: a.note, region: 'x' + a.region.x + '%,y' + a.region.y + '%,w' + a.region.w + '%,h' + a.region.h + '%' }))));
      fd.append('prompt', prompt);
      const res = await fetch('/api/vision/annotate', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || '请求失败');
      setContext(json.contextMessage);
      setRawSummary({ ocr_chars: (json.raw && json.raw.ocr && json.raw.ocr.full_text || '').length, regions: (json.raw && json.raw.layout && json.raw.layout.regions || []).length });
    } catch (e) {
      setError(e.message || '分析失败');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!context) return;
    try { await navigator.clipboard.writeText(context); setError('已复制到剪贴板'); } catch { setError('复制失败，请手动选择'); }
  };

  return (
    <div className="vision-feedback">
      <header className="vision-head">
        <h2>视觉协同反馈（modlens）</h2>
        <p>上传截图 → 拖框批注 → 生成结构化上下文 → 复制粘贴给薯包AI</p>
      </header>

      <div className="vision-controls">
        <input ref={fileRef} type="file" accept="image/*" onChange={(e) => onFile(e.target.files && e.target.files[0])} style={{ display: 'none' }} />
        <button type="button" className="vision-btn" onClick={() => fileRef.current && fileRef.current.click()}>选择图片</button>
        <textarea className="vision-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} />
        <button type="button" className="vision-btn primary" disabled={!image || busy} onClick={submit}>{busy ? '分析中…' : '生成 AI 上下文'}</button>
      </div>

      {error && <div className="vision-alert">{error}</div>}

      <div className="vision-stage" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files && e.dataTransfer.files[0]); }}>
        {!image && (
          <div className="vision-empty" onClick={() => fileRef.current && fileRef.current.click()}>
            <strong>拖入截图 / 点击上传</strong>
            <small>PNG / JPG / WebP / GIF · 最大 12MB</small>
          </div>
        )}
        {image && (
          <div className="vision-canvas">
            <img ref={imgRef} src={image.url} alt="待批注" draggable={false}
              onMouseDown={onImgDown} onMouseMove={onImgMove} onMouseUp={onImgUp} onMouseLeave={onImgUp} />
            {annotations.map((a) => (
              <div key={a.id} className="vision-annot" style={{ left: a.region.x + '%', top: a.region.y + '%', width: a.region.w + '%', height: a.region.h + '%' }}>
                <span className="vision-annot-tag">#{annotations.indexOf(a) + 1}</span>
                <span className="vision-annot-note">{a.note}</span>
                <button type="button" className="vision-annot-rm" onClick={() => removeAnn(a.id)}>×</button>
              </div>
            ))}
            {pendingBox && pendingBox.w > 1 && <div className="vision-pending" style={{ left: pendingBox.x + '%', top: pendingBox.y + '%', width: pendingBox.w + '%', height: pendingBox.h + '%' }} />}
          </div>
        )}
      </div>

      {annotations.length > 0 && (
        <div className="vision-list">
          <h3>批注清单（{annotations.length}）</h3>
          <ol>{annotations.map((a, i) => <li key={a.id}><span className="vision-list-num">#{i + 1}</span> {a.note} <small>({a.region.x},{a.region.y} {a.region.w}×{a.region.h})</small></li>)}</ol>
        </div>
      )}

      {context && (
        <div className="vision-result">
          <div className="vision-result-head">
            <h3>已生成 AI 上下文</h3>
            <button type="button" className="vision-btn" onClick={copy}>复制</button>
          </div>
          {rawSummary && <div className="vision-summary">OCR {rawSummary.ocr_chars} 字符 / 区域 {rawSummary.regions} 个</div>}
          <pre className="vision-context">{context}</pre>
        </div>
      )}
    </div>
  );
}

export default VisionFeedback;
