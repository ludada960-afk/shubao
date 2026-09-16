import React, { useRef, useState } from 'react';
import { ImagePlus, RotateCcw } from 'lucide-react';

import MediaAssetCard from './MediaAssetCard.jsx';
import { uploadEcommerceAsset } from '../../services/api';

/* ═══ FieldRenderer：Skill 工作台的字段渲染器（唯一实现）══════════════════════════
   来源：docs/design/43-media-architecture.md §5（Skill 契约）与 §4.3（门禁化）。
   为什么必须有它：现在同一批配置（模型 / 清晰度 / 比例 / 数量）在 41 个面板文件里
   各写了一遍（实测 model 41 处、resolution 42 处、count 77 处、ratio 61 处），
   结果就是"图片侧和视频侧的控件长得不一样"。
   从今往后：**页面只声明字段，控件由这里统一渲染** —— 这也是能批量做 40+ 个 Skill 的前提
   （新增 Skill 只加声明，不加页面）。

   档位刻意保持少而够用：
     select / segmented / stepper / textarea / text —— 常见配置
     upload —— 上传位（图片）。**上传与失败重试都在这里统一实现**：
              先出本地预览（立刻可见），再上传换服务端地址；失败留在原地可主动重试，
              不做瞬时 Toast（本项目铁律：失败态必须就近、持久、可 deliberate retry）。
     slot   —— 打开一个面板的槽位（如「套图结构」），面板由调用方提供。

   ⚠️ upload 的值形状（唯一约定，页面不许自己拼）：
      Array<{ url, previewUrl?, name?, assetId?, status: 'uploading' | 'ready' | 'error', progress?, error? }>
      只有 status === 'ready' 且带 url 的条目会进入生成请求。 */
const REQUIRED_MARK = '*';

/* blob 预览地址在替换/移除时统一回收，避免长会话里泄漏 */
function revoke(item) {
  const url = item && item.previewUrl;
  if (url && String(url).startsWith('blob:') && typeof URL !== 'undefined' && URL.revokeObjectURL) {
    try { URL.revokeObjectURL(url); } catch { /* 已回收则忽略 */ }
  }
}

function UploadControl({ field, value, onChange, disabled }) {
  const inputRef = useRef(null);
  const items = Array.isArray(value) ? value : [];
  const maxImages = Math.max(1, Number(field.maxImages || 1));
  const multiple = maxImages > 1;
  const full = items.length >= maxImages;

  const patchAt = (index, next) => onChange(items.map((item, i) => (i === index ? { ...item, ...next } : item)));

  const uploadAt = async (index, file) => {
    if (!file) { patchAt(index, { status: 'error', error: '文件已失效，请重新选择' }); return; }
    try {
      const asset = await uploadEcommerceAsset({ file, role: field.role || 'product' });
      const url = String(asset?.url || asset?.stableUrl || '').trim();
      if (!url) throw new Error('上传后没有拿到可用地址');
      const previous = items[index];
      if (previous && previous.previewUrl !== url) revoke(previous);
      patchAt(index, { url, previewUrl: asset?.previewUrl || url, name: asset?.name || file.name, assetId: asset?.assetId || '', status: 'ready', progress: 100, error: '', file: undefined });
    } catch (error) {
      patchAt(index, { status: 'error', error: (error && error.message) || '上传失败' });
    }
  };

  const handleFiles = selected => {
    const files = Array.from(selected || []).filter(file => file && String(file.type || '').startsWith('image/'));
    if (!files.length) return;
    const room = Math.max(0, maxImages - items.length);
    const accepted = files.slice(0, room);
    if (!accepted.length) return;
    const start = items.length;
    const drafts = accepted.map(file => ({
      url: '',
      previewUrl: (typeof URL !== 'undefined' && URL.createObjectURL) ? URL.createObjectURL(file) : '',
      name: file.name,
      status: 'uploading',
      progress: 30,
      file,
    }));
    onChange([...items, ...drafts]);
    accepted.forEach((file, offset) => { uploadAt(start + offset, file); });
  };

  const removeAt = index => { revoke(items[index]); onChange(items.filter((_, i) => i !== index)); };

  return (
    <span className="media-field-upload" data-empty={items.length ? 'false' : 'true'}>
      {items.map((item, index) => (
        <span className="media-field-upload-item" key={(item.name || 'item') + '-' + index}>
          <MediaAssetCard
            kind="image"
            src={item.previewUrl || item.url || ''}
            label={item.status === 'error' ? '' : (item.name || '')}
            status={item.status === 'ready' ? 'ready' : (item.status === 'error' ? 'error' : 'uploading')}
            progress={item.status === 'uploading' ? (item.progress || 40) : 0}
            onRemove={() => removeAt(index)}
          />
          {item.status === 'error' && (
            <button type="button" className="media-field-upload-retry" onClick={() => { patchAt(index, { status: 'uploading', progress: 40, error: '' }); uploadAt(index, item.file); }}>
              <RotateCcw size={12} />{item.error || '重试'}
            </button>
          )}
        </span>
      ))}
      {!full && (
        <button type="button" className="media-field-upload-add" disabled={disabled} onClick={() => inputRef.current?.click()}>
          <ImagePlus size={18} />
          <span>{field.slotLabel || '添加图片'}</span>
          {multiple && <small>{items.length}/{maxImages}</small>}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        hidden
        onChange={event => { handleFiles(event.target.files); event.target.value = ''; }}
      />
    </span>
  );
}

function control(kind, field, value, onChange, disabled) {
  const id = 'field-' + field.key;
  const common = { id, disabled, 'aria-label': field.label };
  if (kind === 'select') {
    return (
      <select {...common} className="media-field-control" value={value ?? ''} onChange={event => onChange(event.target.value)}>
        {(field.options || []).map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    );
  }
  if (kind === 'segmented') {
    return (
      <span className="media-field-segmented" role="group" aria-label={field.label}>
        {(field.options || []).map(option => (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            aria-pressed={String(value) === String(option.value)}
            className={String(value) === String(option.value) ? 'is-active' : ''}
            onClick={() => onChange(option.value)}
          >{option.label}</button>
        ))}
      </span>
    );
  }
  if (kind === 'stepper') {
    const min = Number(field.min ?? 1);
    const max = Number(field.max ?? 99);
    const step = Number(field.step ?? 1);
    const current = Number(value ?? min);
    const clamp = next => Math.max(min, Math.min(max, next));
    return (
      <span className="media-field-stepper">
        <button type="button" disabled={disabled || current <= min} aria-label={(field.label || '') + ' 减少'} onClick={() => onChange(clamp(current - step))}>−</button>
        <output>{current}</output>
        <button type="button" disabled={disabled || current >= max} aria-label={(field.label || '') + ' 增加'} onClick={() => onChange(clamp(current + step))}>+</button>
      </span>
    );
  }
  if (kind === 'textarea') {
    return (
      <textarea
        {...common}
        className="media-field-control"
        rows={field.rows || 3}
        maxLength={field.maxLength || 2000}
        placeholder={field.placeholder || ''}
        value={value ?? ''}
        onChange={event => onChange(event.target.value)}
      />
    );
  }
  if (kind === 'upload') {
    return <UploadControl field={field} value={value} onChange={onChange} disabled={disabled} />;
  }
  if (kind === 'slot') {
    return (
      <button type="button" className="media-field-slot" disabled={disabled || !field.onPick} onClick={() => field.onPick?.()}>
        {field.slotLabel || '选择文件'}
      </button>
    );
  }
  return (
    <input
      {...common}
      type="text"
      className="media-field-control"
      maxLength={field.maxLength || 200}
      placeholder={field.placeholder || ''}
      value={value ?? ''}
      onChange={event => onChange(event.target.value)}
    />
  );
}

export default function FieldRenderer({ field = {}, value, onChange = () => {}, disabled = false }) {
  const kind = field.kind || 'text';
  return (
    <label className="media-field" data-kind={kind}>
      <span className="media-field-label">
        {field.label}
        {field.required ? <b aria-hidden="true">{REQUIRED_MARK}</b> : null}
      </span>
      {control(kind, field, value, onChange, disabled)}
      {field.hint ? <small className="media-field-hint">{field.hint}</small> : null}
    </label>
  );
}
