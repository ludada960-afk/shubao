import React from 'react';

/* ═══ FieldRenderer：Skill 工作台的字段渲染器（唯一实现）══════════════════════════
   来源：docs/design/43-media-architecture.md §5（Skill 契约）与 §4.3（门禁化）。
   为什么必须有它：现在同一批配置（模型 / 清晰度 / 比例 / 数量）在 41 个面板文件里
   各写了一遍（实测 model 41 处、resolution 42 处、count 77 处、ratio 61 处），
   结果就是"图片侧和视频侧的控件长得不一样"。
   从今往后：**页面只声明字段，控件由这里统一渲染** —— 这也是能批量做 40+ 个 Skill 的前提
   （新增 Skill 只加声明，不加页面）。
   支持的类型刻意保持少而够用：select / segmented / stepper / textarea / text / slot（上传位）。 */
const REQUIRED_MARK = '*';

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
  if (kind === 'slot') {
    return (
      <button type="button" className="media-field-slot" disabled={disabled} onClick={() => field.onPick?.()}>
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
