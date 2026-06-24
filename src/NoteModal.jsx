import React, { useState, useEffect, useMemo } from "react";
const API = 'http://localhost:3099';
const proxyImg = (url)=>url?API+'/api/proxy-image?url='+encodeURIComponent(url):'';

/* XHS-style Note Modal - standalone, no JSX conflicts */
export default function NoteModal({ item, onClose, textRegen, onDownload, onItemUpdate, onRegenStart }) {
  const [imgIdx, setImgIdx] = useState(0);
  const [zoomActive, setZoomActive] = useState(false);
  const [rgIdx, setRgIdx] = useState(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  // 暂去掉遮罩文字，用原生图片代理（image-proxy 代码留着备用）
  const imgs = useMemo(() => {
    const a = [];
    try {
      if (item?.cover_url) a.push(proxyImg(item.cover_url));
      if (item?.image_urls && Array.isArray(item.image_urls))
        item.image_urls.forEach(function(u){ if(u) a.push(proxyImg(u)); });
    } catch(e) {}
    return a;
  }, [item]);

  const bodyText = item?.body_text || '';
  const tagStr = (item?.hashtags || []).join(' ');
  const maxI = imgs.length;

  useEffect(function() {
    function handler(e) {
      if (e.key === 'ArrowLeft' && maxI > 1) {
        setImgIdx(function(i){return Math.max(0,i-1);});
        e.preventDefault();
      }
      if (e.key === 'ArrowRight' && maxI > 1) {
        setImgIdx(function(i){return Math.min(maxI-1,i+1);});
        e.preventDefault();
      }
      if (e.key === 'Escape') { if (zoomActive) setZoomActive(false); else onClose(); e.preventDefault(); }
    }
    window.addEventListener('keydown', handler);
    return function() { window.removeEventListener('keydown', handler); };
  }, [maxI, zoomActive, onClose, imgs]);

  const regenSingle = async function(i) {
    if (!confirm('重新生成这张图片将消耗1次额度，确定？')) return;
    setRgIdx(i);
    if (typeof onRegenStart === 'function') onRegenStart(i);
    try {
      var p = '';
      if (i === 0 && item?.cover_prompt) p = item.cover_prompt;
      else if (i > 0 && item?.image_prompts) {
        var pi = item.image_prompts.find(function(pp){return pp.page_id === i});
        if (pi) p = pi.prompt;
      }
      if (!p) throw new Error('未找到该页的图片描述');
      var r = await fetch(API + '/api/regenerate-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: p, category: item?.category || '' })
      });
      if (!r.ok) throw new Error('请求失败');
      var d = await r.json();
      if (!d.url) throw new Error('生成失败');
      if (typeof onItemUpdate === 'function') {
        onItemUpdate(i, d.url, item?._inputText || '');
      }
    } catch(e) { alert('图片生成失败：' + e.message); }
    setRgIdx(null);
  };

  if (!item) return null;

  var leftArrow = String.fromCharCode(8249);
  var rightArrow = String.fromCharCode(8250);

  return React.createElement('div', {
    style: {
      position: 'fixed', inset: 0, zIndex: 900,
      background: 'rgba(0,0,0,.45)',
      WebkitBackdropFilter: 'blur(6px)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    },
    onClick: onClose
  },
    React.createElement('style', null, '@keyframes spin{to{transform:rotate(360deg)}}'),
    /* Zoom overlay */
    zoomActive ? React.createElement('div', {
      style: { position: 'fixed', inset: 0, zIndex: 9999, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' },
      onClick: function(e){ e.stopPropagation(); setZoomActive(false); }
    },
      imgIdx > 0 ? React.createElement('button', {
        onClick: function(e){ e.stopPropagation(); setImgIdx(function(i){return Math.max(0,i-1);}); },
        style: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, zIndex: 10 }
      }, leftArrow) : null,
      React.createElement('img', {
        src: imgs[imgIdx],
        style: { maxWidth: '85%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 },
        onClick: function(e){ e.stopPropagation(); setZoomActive(false); },
        loading: 'lazy'
      }),
      imgIdx < maxI - 1 ? React.createElement('button', {
        onClick: function(e){ e.stopPropagation(); setImgIdx(function(i){return Math.min(maxI-1,i+1);}); },
        style: { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, zIndex: 10 }
      }, rightArrow) : null
    ) : null,

    /* Modal */
    React.createElement('div', {
      onClick: function(e){ e.stopPropagation(); },
      style: {
        background: '#fff', borderRadius: 12, width: '94vw', maxWidth: 1100,
        height: '90vh', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.25)',
        animation: 'slideUp .25s ease', fontFamily: '-apple-system,PingFang SC,Noto Sans SC,sans-serif'
      }
    },
      /* Main: Image + Text */
      React.createElement('div', { style: { display: 'flex', gap: 0, flex: 1, overflow: 'hidden' } },
        /* LEFT: Image */
        React.createElement('div', { style: { flex: '0 0 63%', background: '#f5f5f5', display: 'flex', flexDirection: 'column' } },
          React.createElement('div', {
            style: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' },
            onMouseEnter: function(e){ e.currentTarget.querySelectorAll('.nhb').forEach(function(b){ b.style.opacity = '1' }); },
            onMouseLeave: function(e){ e.currentTarget.querySelectorAll('.nhb').forEach(function(b){ b.style.opacity = '0' }); },
            onWheel: function(e){
              if(e.deltaY > 0 && imgIdx < maxI - 1) setImgIdx(function(i){ return i + 1 });
              if(e.deltaY < 0 && imgIdx > 0) setImgIdx(function(i){ return i - 1 });
            }
          },
            imgs[imgIdx]
              ? React.createElement('div', { style: { position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', maxWidth: '100%', maxHeight: '100%' } },
                  React.createElement('img', { src: imgs[imgIdx], style: { maxWidth: '100%', maxHeight: 'calc(90vh - 100px)', objectFit: 'contain', cursor: 'pointer', display: 'block' }, onClick: function(){ setZoomActive(true) }, loading: 'eager' })
                )
              : React.createElement('div', { style: { color: '#ccc', fontSize: 13 } }, '暂无图片'),
            React.createElement('button', {
              className: 'nhb',
              onClick: function(){ regenSingle(imgIdx) },
              style: { position: 'absolute', left: 8, bottom: 8, background: 'rgba(0,0,0,.55)', WebkitBackdropFilter: 'blur(4px)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: 6, padding: '4px 8px', color: '#fff', fontSize: 10, cursor: 'pointer', zIndex: 5, opacity: 0, transition: 'opacity .15s', fontFamily: 'inherit' }
            }, rgIdx === imgIdx ? '⟳ 刷新中...' : '↻ 重新生成此图'),
            maxI > 1 ? React.createElement(React.Fragment, null,
              React.createElement('button', {
                className: 'nhb',
                onClick: function(e){ e.stopPropagation(); setImgIdx(function(i){ return Math.max(0, i-1) }); },
                style: { position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', width: 30, height: 30, borderRadius: '50%', background: 'rgba(0,0,0,.5)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, zIndex: 5, opacity: 0, transition: 'opacity .15s', pointerEvents: 'auto', lineHeight: 1 }
              }, String.fromCharCode(8249)),
              React.createElement('button', {
                className: 'nhb',
                onClick: function(e){ e.stopPropagation(); setImgIdx(function(i){ return Math.min(maxI-1, i+1) }); },
                style: { position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 30, height: 30, borderRadius: '50%', background: 'rgba(0,0,0,.5)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, zIndex: 5, opacity: 0, transition: 'opacity .15s', pointerEvents: 'auto', lineHeight: 1 }
              }, String.fromCharCode(8250))
            ) : null
          ),
	maxI > 1 ? React.createElement('div', { style: { display: 'flex', gap: 4, padding: '8px 12px', borderTop: '1px solid #eee', justifyContent: 'center', overflowX: 'auto' } },
            imgs.map(function(url, i){
              return React.createElement('div', {
                key: i,
                onClick: function(){ setImgIdx(function(){ return i }) },
                style: { flex: '0 0 auto', width: 36, height: 48, borderRadius: 4, overflow: 'hidden', border: i === imgIdx ? '2px solid #333' : '2px solid transparent', cursor: 'pointer', opacity: i === imgIdx ? 1 : .35, transition: 'all .12s' }
              }, React.createElement('img', { src: url, style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }, loading: 'lazy' }));
            })
          ) : null
        ),
        /* RIGHT: Text */
        React.createElement('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' } },
          React.createElement('div', { style: { flex: 1, overflowY: 'auto', padding: '16px 20px 0' } },
            React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid #f0f0f0' } },
              React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
                React.createElement('img', { src: '/images/cropped.png', style: { width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flex: '0 0 auto' } }),
                React.createElement('div', null,
                  React.createElement('div', { style: { fontSize: 15, fontWeight: 600, color: '#222' } }, '薯包AI'),
                  React.createElement('div', { style: { fontSize: 12, color: '#999' } }, 'AI创作 · 一键生成')
                )
              ),
              React.createElement('button', {
                onClick: onClose,
                style: { background: 'none', border: 'none', color: '#999', cursor: 'pointer', padding: 4 }
              }, React.createElement('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
                React.createElement('path', { d: 'M18 6L6 18' }),
                React.createElement('path', { d: 'M6 6l12 12' })
              ))
            ),
            React.createElement('h1', { style: { fontSize: 18, fontWeight: 700, lineHeight: 1.4, color: '#222', margin: '0 0 12px', fontFamily: '-apple-system,PingFang SC,Noto Sans SC,sans-serif' } }, item.title || ''),
            React.createElement('div', { style: { fontSize: 14.5, lineHeight: 1.85, color: '#444', marginBottom: 14 } }, bodyText.replace(/\\n/g,'\n').split('\n').map(function(line,i){return React.createElement('div',{key:i,style:{marginBottom:line.trim()?6:0,lineHeight:1.85}},line||' ')})),
            (item.hashtags || []).length > 0 ? React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 } },
              item.hashtags.map(function(t, i){
                return React.createElement('span', { key: i, style: { fontSize: 12, color: '#888', background: '#f5f5f5', padding: '4px 11px', borderRadius: 20 } }, t);
              })
            ) : null
          ),
          React.createElement('div', { style: { padding: '14px 20px', borderTop: '1px solid #f0f0f0', background: '#fff' } },
            React.createElement('div', { style: { display: 'flex', gap: 10 } },
              React.createElement('button', {
                onClick: function(){
                  var tx = (item.title || '') + '\n\n' + bodyText + '\n\n' + tagStr;
                  navigator.clipboard?.writeText(tx).then(function(){ setCopied(true); setTimeout(function(){ setCopied(false); }, 1500); }).catch(function(){});
                },
                style: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, background: copied ? '#e8f5e9' : '#f5f5f5', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500, color: copied ? '#2e7d32' : '#333', padding: '12px 6px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }
              }, copied ? '✅ 已复制' : '📋 复制全文'),
              textRegen ? React.createElement('button', {
                onClick: textRegen,
                style: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, background: '#f5f5f5', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500, color: '#333', padding: '12px 6px', cursor: 'pointer', fontFamily: 'inherit' }
              }, '↻ 重新生成文案') : null,
              React.createElement('button', {
                onClick: async function(){
                  setExporting(true);
                  try{if(typeof onDownload === 'function') await onDownload(item.cover_url, item.image_urls, item.title, item.body_text, item.hashtags);}catch(e){}
                  setExporting(false);
                },
                style: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, background: '#f5f5f5', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500, color: '#333', padding: '12px 6px', cursor: 'pointer', fontFamily: 'inherit' }
              }, exporting ? '⏳ 打包中...' : '⬇ 导出图文')
            )
          )
        )
      )
    )
  );
}
