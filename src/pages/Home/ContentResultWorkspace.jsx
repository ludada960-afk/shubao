import React, { useMemo, useState } from 'react';
import { Check, Copy, Download, Maximize2, Sparkles, X } from 'lucide-react';
import ResponsiveImage from '../../components/ResponsiveImage.jsx';
import { contentResultPages } from './contentResultModel.js';
import './ContentResultWorkspace.css';

export default function ContentResultWorkspace({ item, onClose, onDownload, onSendToCanvas }) {
  const pages = useMemo(() => contentResultPages(item), [item]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const selected = pages[selectedIndex] || pages[0];
  const tags = Array.isArray(item?.hashtags) ? item.hashtags : [];

  const copyAll = async () => {
    const value = [item?.title, item?.body_text, tags.join(' ')].filter(Boolean).join('\n\n');
    await navigator.clipboard?.writeText(value);
    setCopied(true);
    globalThis.setTimeout?.(() => setCopied(false), 1500);
  };

  return (
    <div className="content-result-overlay" onClick={onClose}>
      <section className="content-result-workspace" onClick={event => event.stopPropagation()} aria-label="小红书发布成品">
        <header className="content-result-header"><div><span><Sparkles size={14} /> 已完成发布成品</span><h1>{item?.title || '小红书图文成品'}</h1><p>{item?._plogResult ? 'Plog 生活碎片' : '种草图文'} · {pages.length} 张图片 · 已保存每张图的生成提示词</p></div><button type="button" className="content-result-close" onClick={onClose} aria-label="关闭"><X size={18} /></button></header>
        <div className="content-result-layout">
          <section className="content-result-gallery" aria-label="九张配图">
            <div className="content-result-grid">{pages.map((page, index) => <button type="button" key={page.id} className={index === selectedIndex ? 'is-selected' : ''} onClick={() => setSelectedIndex(index)} aria-label={`查看第${index + 1}张`}><ResponsiveImage src={page.url} variant="thumb" ratio="3:4" alt={`第${index + 1}张`} imgStyle={{ objectFit: 'cover' }} /><span>{String(index + 1).padStart(2, '0')}</span></button>)}</div>
            {selected && <div className="content-result-prompt"><div><strong>第 {selected.index + 1} 张生成提示词</strong><span>{selected.prompt ? <><Check size={13} /> 已记录</> : '当前结果未返回提示词'}</span></div><p>{selected.prompt || '这张图片没有可展示的提示词记录。'}</p></div>}
          </section>
          <aside className="content-result-copy"><div className="content-result-copy-head"><span>可直接发布的文字</span><strong>{item?.title || '未命名笔记'}</strong></div><div className="content-result-body">{String(item?.body_text || '').split('\n').map((line, index) => <p key={`${line}-${index}`}>{line || ' '}</p>)}</div>{tags.length > 0 && <div className="content-result-tags">{tags.map(tag => <span key={tag}>{tag}</span>)}</div>}<div className="content-result-actions"><button type="button" onClick={copyAll}>{copied ? <><Check size={15} /> 已复制</> : <><Copy size={15} /> 复制文案</>}</button><button type="button" onClick={onDownload}><Download size={15} /> 导出整套</button>{onSendToCanvas && <button type="button" onClick={() => onSendToCanvas(item)}><Maximize2 size={15} /> 送入画板</button>}</div></aside>
        </div>
      </section>
    </div>
  );
}
