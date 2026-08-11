import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AtSign, Check } from 'lucide-react';
import ResponsiveImage from '../ResponsiveImage.jsx';
import { buildImageMentions } from './imageMentionModel.js';
import './ImageMentionPicker.css';

function imageIdentity(image = {}) {
  return String(image.sourceNodeId || image.id || image.assetId || image.url || '');
}

export default function ImageMentionPicker({ images = [], selectedImages = [], onToggle, disabled = false, selectionMode = 'toggle', open: controlledOpen, onOpenChange }) {
  const [localOpen, setLocalOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState({});
  const available = useMemo(() => buildImageMentions(images), [images]);
  const selected = useMemo(() => buildImageMentions(selectedImages), [selectedImages]);
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
    <div ref={menuRef} className="image-mention-menu" style={menuStyle} role="menu" aria-label="引用参考图" onPointerDown={event => event.stopPropagation()}>
      <strong>引用参考图</strong>
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
          <ResponsiveImage src={image.url} alt="" variant="thumb" ratio={image.ratio || '1:1'} style={{ width: 34, height: 34 }} imgStyle={{ objectFit: 'contain' }} />
          <span><b>{selectedMention?.label || image.name || '图片'}</b><small>{image.role === 'product' ? '产品图' : '参考图'}</small></span>
          {!insertMode && active && <Check size={15} />}
        </button>;
      })}
    </div>,
    document.body,
  ) : null;

  return <div ref={rootRef} className="image-mention-picker" data-canvas-control="true">
    <button
      type="button"
      className={`image-mention-trigger ${open ? 'is-open' : ''}`}
      aria-label="引用图片"
      aria-expanded={open}
      disabled={disabled || !available.length}
      ref={triggerRef}
      onPointerDown={event => event.stopPropagation()}
      onClick={event => { event.stopPropagation(); setOpen(value => !value); }}
    ><AtSign size={15} /></button>
    {menu}
  </div>;
}
