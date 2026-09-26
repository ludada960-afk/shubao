import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImagePlus, Library, Maximize2, RotateCcw, Sparkles, Video as VideoIcon, X } from 'lucide-react';
import MentionPromptField from '../../components/creation/MentionPromptField.jsx';
import MediaAssetCard from '../../components/media/MediaAssetCard.jsx';
import ProjectAssetPicker from '../ProjectAssetPicker.jsx';
import VideoRegionPicker from './VideoRegionPicker.jsx';
import './VideoWorkbench.css';

/* ═══ VideoWorkbench：视频 skill 子页面的**左栏工作台**（按声明源渲染）═══════════════
   用户第 18 轮原话（逐字）：
     「他们这些 skill 页面……**每个工作台都是不一样的呀**，你现在完全没抄，
       用的依然是我们之前首页的视频生成版本糊弄我……**对应的一比一去抄啊**」
     「就是这**每个页面你都要点进去抄**呀」
   ⇒ 本组件是唯一渲染入口，块全部来自 src/skills/videoWorkbenches.js 的声明源，
     页面里不许再写死任何一块（用户第 19 轮：「全部去统一你的标准去照抄」）。

   块的形态照知渔实测（docs/design/64 §8，数值见 VideoWorkbench.css 的注释）：
     · upload —— 白卡 + 标题 + 计数 0/6 + 2px 虚线框（点击或拖拽上传图片 / 支持 … / [选择文件][从资产库选择]）
     · chips  —— 字段标签 + 一排等宽胶囊（知渔：144×46，一行 3 颗）
     · text   —— 标题 + 付费动作（生成脚本）+ @ 提示 + 计数 0/5000 + 输入区 + 空态两行
     · panel  —— 付费动作（AI分析 / 解析素材），价钱写在按钮上
     · note   —— 带圆点的要求清单（知渔「参考视频要求」那四行）
     · tags   —— 只读胶囊行（知渔「适合上传的视频」那五颗）

   ⚠️ 付费动作**只接站内已有的 SKU**（生成脚本→ec_plan_preview 0.5 积分；AI分析→video_plan_analysis 1 积分），
      不新增任何收费项；接不通的一律 wired:false + 原因，渲染成静态说明行而不是按钮。 */

function fileKindOf(file) {
  const type = String(file?.type || '');
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  return 'image';
}

function SlotUpload({
  block, files, disabled, uploadFor, retryUpload, onFiles, onPreview,
}) {
  const inputRef = useRef(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const max = Number(block.max || 1);
  const full = files.length >= max;
  const multiple = max > 1;
  const isVideo = String(block.accept || '').includes('video');

  const pickLibrary = assets => {
    /* 资产库里选中的已经是服务端稳定地址 —— 先取回二进制再走**同一条上传链路**，
       这样生成请求里拿到的仍然是一个真实可用的素材地址（不另开第二条通路）。 */
    const picked = Array.isArray(assets) ? assets : [];
    Promise.all(picked.slice(0, Math.max(0, max - files.length)).map(async asset => {
      const url = String(asset?.stableUrl || asset?.url || '');
      if (!url) return null;
      const response = await fetch(url);
      if (!response.ok) throw new Error('资产读取失败');
      const blob = await response.blob();
      const name = String(asset?.name || asset?.fileName || (isVideo ? '资产视频' : '资产图片'));
      return new File([blob], name, { type: blob.type || (isVideo ? 'video/mp4' : 'image/png') });
    })).then(items => {
      const ready = items.filter(Boolean);
      if (ready.length) onFiles(ready);
    }).catch(() => {});
  };

  return (
    <div
      className={'video-wb-upload' + (dragging ? ' is-dragging' : '')}
      data-empty={files.length ? 'false' : 'true'}
      onDragOver={event => { if (disabled) return; event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={event => {
        if (disabled) return;
        event.preventDefault();
        setDragging(false);
        const dropped = Array.from(event.dataTransfer?.files || [])
          .filter(file => (isVideo ? fileKindOf(file) === 'video' : fileKindOf(file) === 'image'));
        if (dropped.length) onFiles(dropped.slice(0, Math.max(0, max - files.length)));
      }}
    >
      {files.map((file, index) => {
        const entry = uploadFor?.(file);
        return (
          <span className="video-wb-upload-item" key={(file.name || 'item') + '-' + index}>
            <MediaAssetCard
              kind={isVideo ? 'video' : 'image'}
              src={entry?.asset?.url || entry?.previewUrl || ''}
              label={entry?.status === 'error' ? '' : (file.name || '')}
              status={entry?.status === 'error' ? 'error' : (entry?.status === 'uploading' ? 'uploading' : 'ready')}
              progress={entry?.status === 'uploading' ? (entry.progress || 40) : 0}
              onRemove={() => onFiles(files.filter((_, i) => i !== index), { replace: true })}
            />
            {entry?.status === 'error' && (
              <button type="button" className="video-wb-upload-retry" onClick={() => retryUpload?.(file, isVideo ? 'video' : 'image')}>
                <RotateCcw size={12} />重试
              </button>
            )}
          </span>
        );
      })}
      {!full && (
        <>
          <button type="button" className="video-wb-upload-add" disabled={disabled} onClick={() => inputRef.current?.click()}>
            {isVideo ? <VideoIcon size={16} /> : <ImagePlus size={16} />}
            {block.actions?.[0] || '选择文件'}
          </button>
          <button type="button" className="video-wb-upload-library" disabled={disabled} onClick={() => setLibraryOpen(true)}>
            <Library size={15} />{block.actions?.[1] || '从资产库选择'}
          </button>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={block.accept || 'image/*'}
        multiple={multiple}
        hidden
        onChange={event => {
          const picked = Array.from(event.target.files || []);
          event.target.value = '';
          if (picked.length) onFiles(picked.slice(0, Math.max(0, max - files.length)));
        }}
      />
      <small className="video-wb-upload-hint">{block.hint || '点击或拖拽上传图片'}</small>
      <small className="video-wb-upload-accept">{block.acceptHint || ''}</small>
      <ProjectAssetPicker
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        mediaKind={isVideo ? 'video' : 'image'}
        multi={multiple}
        title={(block.title || '素材') + ' · 从资产库选择'}
        onPick={pickLibrary}
      />
    </div>
  );
}

/* ═══ 2026-09-26 批 CB：脚本输入 + 「放大」（用户本轮批注，逐字）══════════════════════════════════
   原话：「我跟你说过很多遍了，你应该去抄他们的做法呀。他们不是还有一个**放大的按钮**吗？
   你这个按钮也没有做上去呀？**图片生成那边我记得是有的呀，视频生成这边为什么没有呢**？」
   ⇒ 图片侧的实现是 FieldRenderer 的 TextareaControl（.media-field-expand + 居中模态，
     样式与几何全部复用，不新造一套）。这里照同一形态抄一份，只有一处不同：
     内联编辑器仍是 MentionPromptField（脚本里带 @ 素材胶囊），放大框里也用同一个组件 ——
     换成裸 textarea 会把 `@[名字](id)` 的标记直接露给用户（那是"两套东西"的开端）。
   ⚠️ 它必须是个**独立组件**：useState 不能写在 blocks.map 里（hooks 规则，写错整页崩）。 */
function ScriptField({
  id, value, mentions, maxLength, placeholder, className, disabled, onChange, onFilesPasted, fieldRef, label,
}) {
  const [expanded, setExpanded] = useState(false);
  const text = String(value || '');
  const field = (
    <MentionPromptField
      id={id}
      ref={fieldRef}
      value={value}
      mentions={mentions}
      maxLength={maxLength}
      onChange={onChange}
      onFilesPasted={onFilesPasted || undefined}
      placeholder={placeholder}
      className={className}
    />
  );
  return (
    <span className="media-field-textarea">
      {field}
      <button
        type="button"
        className="media-field-expand"
        disabled={disabled}
        aria-label={(label || '脚本') + '放大编辑'}
        title="放大编辑"
        onClick={() => setExpanded(true)}
      ><Maximize2 size={13} />放大</button>
      {expanded && createPortal(
        <div
          className="media-field-expand-modal"
          role="dialog"
          aria-modal="true"
          aria-label={(label || '脚本') + '放大编辑'}
          onMouseDown={event => { if (event.target === event.currentTarget) setExpanded(false); }}
        >
          <div className="media-field-expand-body">
            <header>
              <strong>{label || '脚本'}</strong>
              <span>{text.length}/{maxLength}</span>
              <button type="button" className="media-field-expand-close" aria-label="关闭放大编辑" onClick={() => setExpanded(false)}><X size={16} /></button>
            </header>
            <MentionPromptField
              value={value}
              mentions={mentions}
              maxLength={maxLength}
              onChange={onChange}
              onFilesPasted={onFilesPasted || undefined}
              placeholder={placeholder}
              className={(className || '') + ' is-expanded-field'}
            />
            <footer><button type="button" className="media-field-expand-done" onClick={() => setExpanded(false)}>完成</button></footer>
          </div>
        </div>,
        document.body,
      )}
    </span>
  );
}

export default function VideoWorkbench({
  workbench = null,
  groupTitle = '参数配置',
  /* ═══ 批 T（2026-09-21）：**按块存的文本值** ═══════════════════════════════════════════════
     为什么要有它：原来所有 text 块共用同一个 `prompt`（"每页只有一个文本格"是当时的前提）。
     用户本轮要求把知渔「门店信息」那一格补上（它自己的页面上在「门店信息」标题下有一个
     458×149 的可编辑输入框，占位是四段式），于是同一页出现**两个**文本格 ——
     共用一份状态会让两格互相镜像（在 A 里打字，B 里也出现同样的话）。
     ⇒ prompt 仍然是"主文本格"（补充说明/脚本，走既有的 prompt/onPromptChange），
       其它文本格按 block.key 存进 blockValues；两个口子都保留，既有调用点一个不用改。 */
  blockValues = {},
  onBlockValueChange = () => {},
  slots = {},
  onSlotFiles = () => {},
  /* ═══ 2026-09-25 批 AM：**时长为实**的两样 ═══════════════════════════════════════════════
     ① slotPreviews —— 槽位里已上传素材的可播地址（key = block.key）。区域框选要在**用户上传的
        那条视频**上拖框，所以它需要原始文件的临时地址（对象 URL 或服务端资产地址）；
     ② regions / onRegionsChange —— 框选结果按**源像素**存在页面上（服务端 delogo 直接用）。 */
  slotPreviews = {},
  regions = [],
  onRegionsChange = () => {},
  prompt = '',
  onPromptChange = () => {},
  values = {},
  onValueChange = () => {},
  /* ═══ 2026-09-26 批 AR：**选项覆写**（页面按能力放开某个默认不可选的档）═══════════════════════
     唯一用途：去字幕页的「自动标记」在服务端报告"可用"之前是**不可选**的（合同写在声明源里），
     可用之后由页面把它放开 —— 判据形如 `{ 'markMode:auto': { disabled: false } }`。
     ⚠️ 为什么不由渲染层自己问能力：渲染层只认声明源（本文件头部的纪律），
        能力是页面的事（它才拿得到 capabilities）；这里只做"按 key 覆写"这一件机械的事。 */
  optionOverrides = {},
  mentions = [],
  promptFieldRef = null,
  promptMaxLength = 0,
  onFilesPasted = null,
  disabled = false,
  uploadFor = null,
  retryUpload = null,
  onRunAction = () => {},
}) {
  const blocks = useMemo(() => (workbench?.blocks || []), [workbench]);
  if (!blocks.length) return null;
  return (
    /* ═══ 2026-09-19 批 Q-⑥：**整块包进「参数配置」组**（照知渔视频子页面实测）══════════════
       知渔那一页左栏是「参数配置」一个组头，底下才是 参考图（要求：人视图）/ 比例 这些字段；
       我们原来把每个块各自当成一个**组**（组标题 = 块标题），于是页面上看不到「参数配置」，
       而且块标题用的是**组标题**那一档字（比字段名还轻）。
       ⇒ 外面包一个组、块标题改用字段标题那一档（.media-field-label，14.672/500 近黑）。 */
    <section className="media-workbench-group video-workbench-blocks" data-workbench={workbench?.source || 'local'}>
      {/* ═══ 批 S：这一行组头**照知渔逐页计数**决定要不要渲染 ══════════════════════════════════
          知渔视频侧 32 个子页面全文检索：25 条有「参数配置」、7 条没有（6 条路由页 + 趣味脱口秀）。
          批 Q-⑥ 那一版是按 **app 页**实测加的，于是路由型的四条（视频创作 / 爆款复刻 /
          探店视频 / 内容替换）也顶了一个他们的页面上没有的组头。
          ⇒ groupTitle 为空串时**不渲染这一行**（外层 section 与两列网格保留，布局不受影响）；
            判据由页面从对照表派生传入（quantvVideoShowsParamGroup），这里不做任何猜测。 */}
      {groupTitle ? <h3 className="media-workbench-group-title"><span>{groupTitle}</span></h3> : null}
      <div className="media-workbench-fields">
      {blocks.map((block, index) => {
        if (block.kind === 'upload') {
          const files = slots[block.key] || [];
          return (
            <section className="media-workbench-group video-wb-block" key={block.key}>
              <h3 className="media-field-label">
                <span>{block.title}</span>
                <span className="video-wb-count">{files.length}/{block.max}</span>
              </h3>
              {block.note && <p className="media-workbench-group-note">{block.note}</p>}
              <SlotUpload
                block={block}
                files={files}
                disabled={disabled}
                uploadFor={uploadFor}
                retryUpload={retryUpload}
                onFiles={(next, options) => onSlotFiles(block.key, next, options)}
                onPreview={null}
              />
            </section>
          );
        }
        if (block.kind === 'chips') {
          const current = values[block.bind] ?? '';
          return (
            <section className="media-workbench-group video-wb-block" key={block.key}>
              {/* 知渔有的控件**没有标题**（「换模特 / 换产品」那两颗药丸上方是一片空白）——
                  声明里写 hideLabel: true，标题仍留给读屏（aria-label），只是不画出来。 */}
              {!block.hideLabel && (
                <h3 className="media-field-label">
                  <span>{block.title}{block.required && <i className="video-wb-required" aria-hidden="true">*</i>}</span>
                </h3>
              )}
              <span className="media-field-segmented video-wb-chips" role="group" aria-label={block.title}>
                {(block.options || []).map(option => {
                  /* 选项覆写（见 props 注释）：只允许改 disabled —— 其余字段一律以声明源为准，
                     免得页面从这里偷偷改标签/取值，那会让"界面写的"与"声明里写的"两处漂移。 */
                  const override = optionOverrides[`${block.key}:${option.value}`] || {};
                  const optionDisabled = option.disabled === true && override.disabled !== false;
                  return (
                    <button
                      key={String(option.value)}
                      type="button"
                      /* ⚠️ 批 AM：单个选项也可以**不可选**（自动标记那一档没接通时）。
                         与"接不通的付费动作渲染成静态说明行"同一条纪律：
                         **不许把点了没有反应 / 点了报错的东西做成能点的选项**。 */
                      disabled={disabled || optionDisabled}
                      title={optionDisabled ? (override.reason || option.reason || '暂未开放') : (option.note || '')}
                      aria-pressed={String(current) === String(option.value)}
                      className={String(current) === String(option.value) ? 'is-active' : ''}
                      onClick={() => onValueChange(block.bind, option.value)}
                    >{option.label}</button>
                  );
                })}
              </span>
              {/* 每个选项自己的说明行（知渔在两颗胶囊下面各写了一句用途）；
                  不可选的档位把**原因**也写出来 —— 用户看得到"为什么现在不能选"。 */}
              {(block.options || []).some(option => option.note || option.reason) && (
                <ul className="video-wb-option-notes">
                  {(block.options || []).filter(option => option.note || option.reason).map(option => (
                    <li key={`note-${String(option.value)}`} className={option.disabled ? 'is-off' : ''}>
                      <strong>{option.label}</strong>
                      <span>{option.note}</span>
                      {option.disabled && <em>{option.reason || '暂未开放'}</em>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        }
        if (block.kind === 'text') {
          const action = block.action;
          /* 主文本格（补充说明 / 脚本）走 prompt；其它文本格（门店信息这类）走 blockValues */
          const isPrimary = block.key === 'prompt';
          const value = isPrimary ? prompt : String(blockValues[block.key] || '');
          const change = isPrimary ? onPromptChange : next => onBlockValueChange(block.key, next);
          return (
            <section className="media-workbench-group video-wb-block" key={block.key}>
              <h3 className="media-field-label"><span>{block.title}</span></h3>
              {action && (
                <div className="media-workbench-paid-actions">
                  {action.wired ? (
                    <div className="media-workbench-paid-item">
                      <button
                        type="button"
                        className="media-workbench-paid"
                        disabled={disabled}
                        onClick={() => onRunAction(action.key)}
                      >
                        <span><Sparkles size={13} />{action.label}</span>
                        {action.points != null && <em>{action.points} 积分</em>}
                      </button>
                      {action.note && <small className="media-workbench-paid-note">{action.note}</small>}
                    </div>
                  ) : (
                    <span className="media-workbench-paid is-off">
                      <span>{action.label}</span>
                      {action.points != null && <em>{action.points} 积分</em>}
                      <small>{action.reason || '暂未开放'}</small>
                    </span>
                  )}
                </div>
              )}
              <div className="video-wb-mention-hint">{block.mentionHint}</div>
              <ScriptField
                id={`video-workbench-prompt-${index}`}
                label={block.title}
                value={value}
                mentions={mentions}
                maxLength={promptMaxLength}
                disabled={disabled}
                onChange={change}
                onFilesPasted={onFilesPasted}
                placeholder={block.placeholder || ''}
                fieldRef={isPrimary ? promptFieldRef : undefined}
                /* 与创作台里的提示词框**同一个类名**：@ 提及的蓝色胶囊样式由 .video-prompt-mentions 给，
                   两处必须长得一样（这一条也是端到端脚本读提示词的锚点） */
                className="video-prompt-mentions video-wb-prompt"
              />
              <div className="video-wb-counter">{value.length} / {block.max}</div>
              {value.length >= Number(block.max || 0) && <div className="video-wb-counter is-full">已到字数上限</div>}
              {block.emptyTitle && !String(value || '').trim() && (
                <div className="video-wb-empty">
                  <strong>{block.emptyTitle}</strong>
                  <small>{block.emptyHint}</small>
                </div>
              )}
            </section>
          );
        }
        if (block.kind === 'panel') {
          return (
            <section className="media-workbench-group video-wb-block" key={block.key}>
              <h3 className="media-field-label"><span>{block.title}</span></h3>
              {block.note && <p className="media-workbench-group-note">{block.note}</p>}
              <div className="media-workbench-paid-actions">
                {(block.actions || []).map(action => (action.wired ? (
                  <div className="media-workbench-paid-item" key={action.key}>
                    <button type="button" className="media-workbench-paid" disabled={disabled} onClick={() => onRunAction(action.key)}>
                      <span><Sparkles size={13} />{action.label}</span>
                      {action.points != null && <em>{action.points} 积分</em>}
                    </button>
                    {action.note && <small className="media-workbench-paid-note">{action.note}</small>}
                  </div>
                ) : (
                  <span className="media-workbench-paid is-off" key={action.key}>
                    <span>{action.label}</span>
                    {action.points != null && <em>{action.points} 积分</em>}
                    <small>{action.reason || '暂未开放'}</small>
                  </span>
                )))}
              </div>
            </section>
          );
        }
        if (block.kind === 'note') {
          return (
            <section className="media-workbench-group video-wb-block" key={block.key}>
              <h3 className="media-field-label"><span>{block.title}</span></h3>
              <ul className="video-wb-notes">
                {(block.items || []).map(item => (
                  <li key={item.label}><i aria-hidden="true">•</i><span><strong>{item.label}</strong>{item.detail}</span></li>
                ))}
              </ul>
            </section>
          );
        }
        if (block.kind === 'tags') {
          return (
            <section className="media-workbench-group video-wb-block" key={block.key}>
              <h3 className="media-field-label"><span>{block.title}</span></h3>
              <div className="video-wb-tags">
                {(block.items || []).map(item => <span key={item}>{item}</span>)}
              </div>
            </section>
          );
        }
        if (block.kind === 'static') {
          /* 知渔有些行是**纯文案**：例如去字幕页的「视频模型 · 智能去字幕」（实采里它只是文本，
             不在 panelButtons 里 ⇒ 不是可选控件）。照它的位置与内容画出来，但不给选 ——
             这比"干脆不画"更接近那一页，也比"画成选择器"诚实（本地方案没有模型可选）。 */
          return (
            <section className="media-workbench-group video-wb-block" key={block.key}>
              <div className="video-wb-static">
                <span>{block.title}</span>
                <strong>{block.value}</strong>
              </div>
            </section>
          );
        }
        if (block.kind === 'region') {
          /* 区域框选（去字幕那一页的手动标记）：在**上面那个上传块**选中/上传的那条视频上拖框。 */
          const sourceKey = block.for || '';
          const preview = slotPreviews[sourceKey] || '';
          return (
            <section className="media-workbench-group video-wb-block" key={block.key}>
              <h3 className="media-field-label"><span>{block.title}</span></h3>
              <VideoRegionPicker
                videoUrl={preview}
                regions={regions}
                onChange={onRegionsChange}
                hint={block.hint || ''}
                disabled={disabled}
              />
            </section>
          );
        }
        return null;
      })}
      </div>
    </section>
  );
}
