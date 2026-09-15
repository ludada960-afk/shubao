import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AtSign, Check } from 'lucide-react';
import ResponsiveImage from '../ResponsiveImage.jsx';
import { buildImageMentions } from './imageMentionModel.js';
import './ImageMentionPicker.css';

function imageIdentity(image = {}) {
  return String(image.sourceNodeId || image.id || image.assetId || image.url || '');
}

/* ═══════════════════════════════════════════════════════════════════════
   全站唯一的「@ 引用」入口（2026-09-16 升级）
   ═══════════════════════════════════════════════════════════════════════

   用户批注（图7-①）原话：
   「你视频生成这边的这个艾特键，为什么跟其他板块的艾特键不一样呢？我不是跟你说过了吗？
    你其他地方有一样的东西，你就要把它的逻辑给拿过来用啊。你现在其他板块的艾特键都不是这样做的呀。
    正常的情况应该是用户他没有上传任何东西的话，这个按钮它是暗的……你这是个死按钮呀！」

   实测根因（**不是**样式问题，是逻辑问题）：
   视频侧自己写了一套 @ 触发器 + 弹出菜单，而它的「点外面就关」判定是
   `if (!quickToolsRef.current?.contains(event.target)) setInlineMenu(null)` ——
   quickToolsRef 只包住底栏工具区，**包不住输入框下方那一行的 @ 菜单**。
   于是：pointerdown 落在菜单项上 → 判定「点了外面」→ 菜单卸载 → **click 事件永远不会触发**
   → 看起来就是「有素材、能点开、点了没反应 = 死按钮」。
   本组件早就把这件事做对了（rootRef + menuRef 双包含判定），所以正确修法是
   **把逻辑拿过来用**，而不是在视频侧再补一遍判定。

   为此加了四个可选口子，**默认行为一字未变**（电商生图与小红书图文不受影响）：
     · normalize     素材 → 可引用项。视频侧命名是「图片1/视频1/音频1」，电商侧是
                     「产品图N/参考图N」—— 命名规则不同，但组件只有一个。
     · renderItem    菜单每行长什么样。视频的音频没有缩略图，必须能自绘。
     · menuTitle     菜单标题文案。
     · triggerLabel  触发器 aria-label 文案。

   已内置、三处共用的行为：
     · **没素材 = 按钮自动禁用变暗**（`disabled={disabled || !available.length}`）；
     · 菜单 `createPortal` 到 body —— 不会被任何 overflow 容器裁掉；
     · 菜单项 `onPointerDown preventDefault` —— 保住输入框光标与选区；
     · 上下翻转定位（上方放不下就翻到下方），随滚动/resize 重算。 */

export default function ImageMentionPicker({
  images = [],
  selectedImages = [],
  onToggle,
  disabled = false,
  selectionMode = 'toggle',
  open: controlledOpen,
  onOpenChange,
  normalize = buildImageMentions,
  renderItem = null,
  menuTitle = '引用参考图',
  triggerLabel = '引用图片',
}) {
  const [localOpen, setLocalOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState({});
  const available = useMemo(() => normalize(images), [images, normalize]);
  const selected = useMemo(() => normalize(selectedImages), [selectedImages, normalize]);
  const selectedIds = useMemo(() => new Set(selected.map(imageIdentity)), [selected]);
  const insertMode = selectionMode === 'insert';
  const isControlled = typeof controlledOpen === 'boolean';
  const open = isControlled ? controlledOpen : localOpen;
  const setOpen = next => {
    const value = typeof next === 'function' ? next(open) : next;
    if (!isControlled) setLocalOpen(value);
    onOpenChange?.(value);
  };

  useEffect(() => {
    if (!open) return undefined;
    const close = event => {
      if (!rootRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  const updateMenuPosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 260;
    const height = Math.min(260, 48 + available.length * 48);
    const gap = 8;
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.left));
    const roomAbove = rect.top - gap;
    const roomBelow = window.innerHeight - rect.bottom - gap;
    const top = roomAbove >= height || roomBelow < height
      ? Math.max(8, rect.top - height - gap)
      : Math.min(window.innerHeight - height - 8, rect.bottom + gap);
    setMenuStyle({ left, top, width, maxHeight: Math.min(260, Math.max(160, window.innerHeight - 16)) });
  }, [available.length]);

  useEffect(() => {
    if (!open) return undefined;
    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  const menu = open && typeof document !== 'undefined' ? createPortal(
    <div ref={menuRef} className={'image-mention-menu' + (renderItem ? ' is-custom-item' : '')} style={menuStyle} role="menu" aria-label={menuTitle} onPointerDown={event => event.stopPropagation()}>
      <strong>{menuTitle}</strong>
      {available.map(image => {
        const active = selectedIds.has(imageIdentity(image));
        const selectedMention = selected.find(item => imageIdentity(item) === imageIdentity(image));
        return <button
          key={imageIdentity(image)}
          type="button"
          role={insertMode ? 'menuitem' : 'menuitemcheckbox'}
          {...(insertMode ? {} : { 'aria-checked': active })}
          onPointerDown={event => event.preventDefault()}
          onClick={event => {
            event.stopPropagation();
            onToggle?.(image);
            if (insertMode) setOpen(false);
          }}
        >
          {renderItem ? renderItem(image, { active, selectedMention }) : <React.Fragment>
            <ResponsiveImage src={image.url} alt="" variant="thumb" ratio={image.ratio || '1:1'} style={{ width: 34, height: 34 }} imgStyle={{ objectFit: 'contain' }} />
            <span><b>{selectedMention?.label || image.name || '图片'}</b><small>{image.role === 'product' ? '产品图' : '参考图'}</small></span>
            {!insertMode && active && <Check size={15} />}
          </React.Fragment>}
        </button>;
      })}
    </div>,
    document.body,
  ) : null;

  return <div ref={rootRef} className="image-mention-picker" data-canvas-control="true">
    <button
      type="button"
      className={`image-mention-trigger ${open ? 'is-open' : ''}`}
      aria-label={triggerLabel}
      aria-expanded={open}
      disabled={disabled || !available.length}
      ref={triggerRef}
      onPointerDown={event => event.stopPropagation()}
      onClick={event => { event.stopPropagation(); setOpen(value => !value); }}
    ><AtSign size={15} /></button>
    {menu}
  </div>;
}
