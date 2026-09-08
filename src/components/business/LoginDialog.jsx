import React, { useEffect, useRef } from 'react';
import { X, Sparkles, Layers, Video, ShieldCheck } from 'lucide-react';
import { CharImg } from '../ui/index';
import { IMAGES } from '../../constants/images';

const FEATURES = [
  { icon: Sparkles, title: '电商套图', desc: '商品图 → 主图 / 场景图 / 详情图，一次生成成套交付' },
  { icon: Layers, title: '无限画布', desc: '素材派生串联，改一处、整条链跟着更新' },
  { icon: Video, title: '视频成片', desc: '文案 → 首帧 → 视频 → 配音字幕，节点化一次跑完' },
];

const CHIPS = ['电商套图', '万物上身', '智能分层', '无限画布', '视频成片', '文案生成'];

/**
 * 登录弹窗外壳 (2026-09-08 重构)
 * 左: 品牌叙事面板  右: 表单面板
 * 无障碍: role=dialog + aria-modal + 焦点陷阱 + Esc 关闭 + 背景滚动锁
 */
export default function LoginDialog({ onClose, labelledBy, children }) {
  const panelRef = useRef(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose?.(); return; }
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  return (
    <div className="ld-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose?.(); }}>
      <div className="ld-panel" role="dialog" aria-modal="true" aria-labelledby={labelledBy} ref={panelRef}>
        <aside className="ld-brand">
          <div className="ld-brand-top">
            <div className="ld-logo">
              <span className="ld-logo-mark"><CharImg src={IMAGES.wave} size={30} /></span>
              <span className="ld-logo-text">
                <strong>薯包 AI</strong>
                <small>Shubao Studio</small>
              </span>
            </div>
            <div>
              <h2 className="ld-headline">把一张商品图<br />变成<em>一整季</em>爆款素材</h2>
              <p className="ld-subhead">从上传商品到交付成品，电商套图、无限画布、视频成片一条链跑完，不用在十个工具之间来回搬素材。</p>
            </div>
            <div className="ld-features">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <div className="ld-feature" key={title}>
                  <span className="ld-feature-icon"><Icon size={17} /></span>
                  <div>
                    <strong>{title}</strong>
                    <span>{desc}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="ld-chips">
              {CHIPS.map(chip => <span className="ld-chip" key={chip}>{chip}</span>)}
            </div>
          </div>
          <div className="ld-brand-foot">
            <span><ShieldCheck size={13} /> 加密传输</span>
            <span>免密码登录</span>
            <span>验证码 10 分钟有效</span>
          </div>
        </aside>

        <section className="ld-form">
          <button type="button" className="ld-close" onClick={onClose} aria-label="关闭登录">
            <X size={17} />
          </button>
          {children}
        </section>
      </div>
    </div>
  );
}
