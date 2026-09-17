import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImagePlus, Library, Maximize2, RotateCcw, X } from 'lucide-react';

import MediaAssetCard from './MediaAssetCard.jsx';
import ProjectAssetPicker from '../ProjectAssetPicker.jsx';
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

/* 上传位的说明文案：**照竞品实测原文**（43 §10.2「上传卡文案统一」）——
   他们每一张上传卡下面都写着同一句，用户一眼就知道能传什么、能传多大，
   不用先失败一次才知道。我们原来什么都没写。 */
const UPLOAD_HINT = '支持 JPG、JPEG、PNG，单张不超过 10MB';
/* 竞品实测文案（43 §10.2 + 9-17 复核）：上传卡都写着「点击或拖拽上传图片」+「最多 N 张」。
   两件事一起做才有意义：写了"可拖拽"就得真的能拖 —— 只写不做就是给自己挖坑。 */
const uploadCopy = maxImages => '点击或拖拽上传图片 · 最多 ' + maxImages + ' 张';

function UploadControl({ field, value, onChange, disabled }) {
  const inputRef = useRef(null);
  /* ⚠️ 上传位有**两个**入口（竞品实测：选择文件 / 从资产库选择）：
     只给「选择文件」的话，用户上一轮刚生成的成品想再用一次就得先下载再上传 ——
     而资产库里的东西本来就是可以直接引用的。 */
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const items = Array.isArray(value) ? value : [];
  /* ⚠️ 上传是异步的：回调回来时闭包里的 items 已经是旧数组了。
     曾经因此把"上传完成"写回成**上传之前**的数组 —— 缩略图上传成功后消失（E2E 抓到）。
     所以所有改动都基于 itemsRef（随每次提交同步更新），而不是渲染期的闭包。 */
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);
  const commit = next => { itemsRef.current = next; onChange(next); };

  const maxImages = Math.max(1, Number(field.maxImages || 1));
  const multiple = maxImages > 1;
  const full = items.length >= maxImages;

  const patchAt = (index, next) => {
    const base = itemsRef.current;
    if (index < 0 || index >= base.length) return;
    commit(base.map((item, i) => (i === index ? { ...item, ...next } : item)));
  };

  const uploadAt = async (index, file) => {
    if (!file) { patchAt(index, { status: 'error', error: '文件已失效，请重新选择' }); return; }
    try {
      const asset = await uploadEcommerceAsset({ file, role: field.role || 'product' });
      const url = String(asset?.url || asset?.stableUrl || '').trim();
      if (!url) throw new Error('上传后没有拿到可用地址');
      const previous = itemsRef.current[index];
      if (previous && previous.previewUrl !== url) revoke(previous);
      patchAt(index, { url, previewUrl: asset?.previewUrl || url, name: asset?.name || file.name, assetId: asset?.assetId || '', status: 'ready', progress: 100, error: '', file: undefined });
    } catch (error) {
      patchAt(index, { status: 'error', error: (error && error.message) || '上传失败' });
    }
  };

  const handleFiles = selected => {
    const files = Array.from(selected || []).filter(file => file && String(file.type || '').startsWith('image/'));
    if (!files.length) return;
    const base = itemsRef.current;
    const accepted = files.slice(0, Math.max(0, maxImages - base.length));
    if (!accepted.length) return;
    const start = base.length;
    const drafts = accepted.map(file => ({
      url: '',
      previewUrl: (typeof URL !== 'undefined' && URL.createObjectURL) ? URL.createObjectURL(file) : '',
      name: file.name,
      status: 'uploading',
      progress: 30,
      file,
    }));
    commit([...base, ...drafts]);
    accepted.forEach((file, offset) => { uploadAt(start + offset, file); });
  };

  const removeAt = index => {
    const base = itemsRef.current;
    revoke(base[index]);
    commit(base.filter((_, i) => i !== index));
  };

  return (
    <span
      className={'media-field-upload' + (dragging ? ' is-dragging' : '')}
      data-empty={items.length ? 'false' : 'true'}
      /* 拖拽上传：与「选择文件」共用同一条 handleFiles（不另写一条上传逻辑） */
      onDragOver={event => { if (disabled) return; event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={event => {
        if (disabled) return;
        event.preventDefault();
        setDragging(false);
        const dropped = Array.from(event.dataTransfer?.files || []).filter(file => /^image\//.test(file.type));
        if (dropped.length) handleFiles(dropped);
      }}
    >
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
        <>
          <button type="button" className="media-field-upload-add" disabled={disabled} onClick={() => inputRef.current?.click()}>
            <ImagePlus size={18} />
            <span>{field.slotLabel || '选择文件'}</span>
            {multiple && <small>{items.length}/{maxImages}</small>}
          </button>
          {/* 第二个入口：从资产库选（与竞品一致）。选中的资产已经是服务端稳定地址，
              直接进生成请求，不重新上传一遍。 */}
          <button type="button" className="media-field-upload-library" disabled={disabled} onClick={() => setLibraryOpen(true)}>
            <Library size={15} />从资产库选择
          </button>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        hidden
        onChange={event => { handleFiles(event.target.files); event.target.value = ''; }}
      />
      <small className="media-field-upload-hint">{uploadCopy(maxImages) + ' · ' + UPLOAD_HINT}</small>
      <ProjectAssetPicker
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        mediaKind="image"
        multi={multiple}
        title={(field.slotLabel || '素材') + ' · 从资产库选择'}
        onPick={assets => {
          const picked = (Array.isArray(assets) ? assets : [])
            .map(asset => ({
              url: String(asset?.stableUrl || asset?.url || ''),
              assetId: String(asset?.projectAssetId || asset?.assetId || ''),
              name: String(asset?.name || '资产库素材'),
              status: 'ready',
            }))
            .filter(item => item.url);
          if (picked.length) commit([...itemsRef.current, ...picked].slice(0, maxImages));
          setLibraryOpen(false);
        }}
      />
    </span>
  );
}

/* 多行文本 + 「放大」：放大框要有自己的开合状态，所以单独成一个组件
   （control() 是普通函数，不能在它里面用 useState —— 那是 hooks 规则，会整页崩）。 */
function TextareaControl({ field, value, onChange, disabled }) {
  const [expanded, setExpanded] = useState(false);
  const id = 'field-' + field.key;
  const common = { id, disabled, 'aria-label': field.label };
  return (
    <span className="media-field-textarea">
      <textarea
        {...common}
        className="media-field-control"
        rows={field.rows || 3}
        maxLength={field.maxLength || 2000}
        placeholder={field.placeholder || ''}
        value={value ?? ''}
        onChange={event => onChange(event.target.value)}
      />
      {/* 「放大」：竞品在卖点框右上角那一颗 —— 点开一个居中的大编辑框。
          为什么值得做：他们的 placeholder 是一份**多行字段模板**（产品名/核心卖点/…），
          在 150px 高的框里写五段字确实憋屈；他们做了放大，我们也得有。 */}
      {field.expandable !== false && (
        <button
          type="button"
          className="media-field-expand"
          disabled={disabled}
          aria-label={(field.label || '文本') + '放大编辑'}
          title="放大编辑"
          onClick={() => setExpanded(true)}
        ><Maximize2 size={13} />放大</button>
      )}
      {expanded && createPortal(
        <div
          className="media-field-expand-modal"
          role="dialog"
          aria-modal="true"
          aria-label={(field.label || '文本') + '放大编辑'}
          onMouseDown={event => { if (event.target === event.currentTarget) setExpanded(false); }}
        >
          <div className="media-field-expand-body">
            <header>
              <strong>{field.label || '编辑'}</strong>
              <span>{String(value ?? '').length}/{field.maxLength || 2000}</span>
              <button type="button" className="media-field-expand-close" aria-label="关闭放大编辑" onClick={() => setExpanded(false)}><X size={16} /></button>
            </header>
            <textarea
              autoFocus
              className="media-field-control"
              maxLength={field.maxLength || 2000}
              placeholder={field.placeholder || ''}
              value={value ?? ''}
              onChange={event => onChange(event.target.value)}
              onKeyDown={event => { if (event.key === 'Escape') setExpanded(false); }}
            />
            <footer>
              <button type="button" className="media-field-expand-done" onClick={() => setExpanded(false)}>完成</button>
            </footer>
          </div>
        </div>,
        document.body,
      )}
    </span>
  );
}

/* ═══ counts：一组「类型 × 张数」的步进器（2026-09-19 用户批注 #13）════════════════════
   竞品套图工作台底部那两张大卡「智能匹配 / 自定义配置」，选中**自定义配置**之后
   下面会展开一组按类型配张数的步进器（用户原话：「自定义配置选中之后，里面还有其他的配置
   可以做呀，这些你都没深度的调研吗」）。
   本档位就是那一组：每一行 = 类型名 + 一句用途 + 张数步进器；末尾一行合计，
   合计数字直接来自用户当前的选择（**不是**写死的文案）。
   ⚠️ 类型取值范围由**声明源**给（field.rows），这里不写死任何业务类型 ——
      图片类型是方案真源 IMAGE_TYPES 的事，控件只负责渲染。 */
function CountsControl({ field, value, onChange, disabled }) {
  const rows = Array.isArray(field.rows) ? field.rows : [];
  /* ⚠️ 值的形状由 skillRun.initialSkillValues 落地（counts 分支把每行的 default 播种进去），
     这里的 row.default 是**兜底**：万一某条调用方没走 initialSkillValues，
     也不至于把整组显示成 0（那会让用户以为"它坏了"）。 */
  const current = value && typeof value === 'object' ? value : {};
  const countOf = row => Math.max(0, Number(current[row.key] ?? row.default) || 0);
  const total = rows.reduce((sum, row) => sum + countOf(row), 0);
  const minTotal = Math.max(1, Number(field.minTotal) || 1);
  const setOne = (key, next) => {
    const max = Math.max(0, Number(rows.find(row => row.key === key)?.max) || 9);
    const clamped = Math.max(0, Math.min(max, next));
    onChange({ ...current, [key]: clamped });
  };
  return (
    <span className="media-field-counts">
      {rows.map(row => {
        const count = countOf(row);
        const max = Math.max(0, Number(row.max) || 9);
        return (
          <span className="media-field-count-row" key={row.key}>
            <span className="media-field-count-copy">
              <strong>{row.label}{row.smart ? <em>AI智能匹配</em> : null}</strong>
              {row.hint ? <small>{row.hint}</small> : null}
            </span>
            <span className="media-field-stepper">
              <button type="button" disabled={disabled || count <= 0} aria-label={row.label + ' 减少'} onClick={() => setOne(row.key, count - 1)}>−</button>
              <output>{count}</output>
              <button type="button" disabled={disabled || count >= max} aria-label={row.label + ' 增加'} onClick={() => setOne(row.key, count + 1)}>+</button>
            </span>
          </span>
        );
      })}
      <p className="media-field-counts-total" data-ok={total >= minTotal ? 'true' : 'false'}>
        当前共 <b>{total}</b> 张{minTotal > 1 ? '，至少 ' + minTotal + ' 张' : ''}
      </p>
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
  if (kind === 'textarea') return <TextareaControl field={field} value={value} onChange={onChange} disabled={disabled} />;
  if (kind === 'counts') {
    return <CountsControl field={field} value={value} onChange={onChange} disabled={disabled} />;
  }
  if (kind === 'upload') {
    return <UploadControl field={field} value={value} onChange={onChange} disabled={disabled} />;
  }
  if (kind === 'slot') {
    /* 没有面板可开的槽位**不做成一个点了没反应的按钮** —— 那是死控件。
       如实告诉用户"这一步在别处配置"，把入口指向真正能改的地方。 */
    if (!field.onPick) {
      return <span className="media-field-slot is-static">{field.slotLabel || '待配置'}</span>;
    }
    return (
      <button type="button" className="media-field-slot" disabled={disabled} onClick={() => field.onPick()}>
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

export default function FieldRenderer({ field = {}, value, onChange = () => {}, disabled = false, values = null }) {
  const kind = field.kind || 'text';
  /* ═══ visibleWhen：字段的条件显示（2026-09-19 用户批注 #13）═════════════════════════
     竞品的「自定义配置」选中之后才会展开下面那组张数配置 —— 未选中时它不该占地方。
     判据写在**声明源**里（field.visibleWhen = { key, equals }），不散在页面里。 */
  if (field.visibleWhen && values && String(values[field.visibleWhen.key] ?? '') !== String(field.visibleWhen.equals ?? '')) {
    return null;
  }
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