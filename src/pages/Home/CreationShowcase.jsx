import React, { useMemo, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Clapperboard, Maximize2, Sparkles } from 'lucide-react';
import ResponsiveImage from '../../components/ResponsiveImage.jsx';
import { GALLERY } from '../../constants/data';
import { productionCaseById } from './productionCaseCatalog.js';
import { normalizeShowcase } from './creationShowcaseModel.js';
import './CreationShowcase.css';

const COPY = {
  ecommerce: {
    'product-suite': { eyebrow: '真实套图案例', title: '从一款商品，到可直接投放的完整视觉', description: '保留商品结构与材质，再根据用途生成主图、场景图和详情表达。', label: '电商套图' },
    anything_tryon: { eyebrow: '真实上身案例', title: '商品与人物关系，一次生成完整', description: '商品素材负责细节，人物与环境负责呈现，适合快速建立可用的穿搭视觉。', label: '上身展示' },
  },
  video: { eyebrow: '视频生成案例', title: '从参考素材到可确认的成片方案', description: '一句话描述镜头目标，系统先整理素材、节奏和交付规格，再进入生成。', label: '视频创作' },
  content: { eyebrow: '发布成品案例', title: '一句话生成一套能直接发布的小红书图文', description: '图片、标题、正文和标签一起生成，9张图片在发布结构里统一呈现。', label: '种草图文' },
  plog: { eyebrow: '发布成品案例', title: '把生活素材整理成有情绪的 Plog', description: '保留真实生活感，同时让九宫格、标题、正文和标签形成完整发布成品。', label: 'Plog 生活碎片' },
  visual: { eyebrow: '能力案例', title: '一句话进入不同的视觉创作方向', description: '海报、社交封面、品牌主视觉和自由创作共用同一条输入路径，结果保持开放。', label: '自由创作' },
};

function assetListFor(mode, subMode, entry) {
  if (entry?.assets?.length) return entry.assets;
  if (mode === 'ecommerce') {
    const caseId = subMode === 'anything_tryon' ? 'tryon-angles' : 'product-suite';
    return productionCaseById(caseId).assets;
  }
  if (mode === 'video') return [{ id: 'video-workspace', src: '/images/home/workspace-video-v2.png', label: '视频工作台案例', ratio: '16:9' }];
  if (mode === 'visual') return productionCaseById('free').assets.slice(0, 3);
  return [];
}

function EcommercePreview({ assets, subMode }) {
  const composite = assets.find(item => item.displayRole === 'workflowBanner' || item.displayRole === 'finalComposite');
  const panels = assets.filter(item => item.displayRole === 'selectorPreview').slice(0, 3);
  const source = assets.find(item => item.role === 'source');
  const fallback = composite || panels[0] || source;
  return (
    <div className="creation-showcase-ecommerce-preview">
      <div className="creation-showcase-ecommerce-hero">
        <ResponsiveImage src={fallback?.src} variant="card" ratio={fallback?.ratio || '4:3'} alt={fallback?.label || '电商案例'} imgStyle={{ objectFit: 'cover' }} />
        <span className="creation-showcase-preview-badge">{subMode === 'anything_tryon' ? '商品 → 上身结果' : '商品 → 完整套图'}</span>
      </div>
      {panels.length > 0 && <div className="creation-showcase-ecommerce-panels">{panels.map(item => <div key={item.id}><ResponsiveImage src={item.src} variant="thumb" ratio={item.ratio || '3:4'} alt={item.label} /><span>{item.label}</span></div>)}</div>}
    </div>
  );
}

function ContentPreview({ plog = false, entry }) {
  const source = entry || GALLERY.find(item => item.id === (plog ? 'xm' : 'ep')) || GALLERY[0];
  const images = [source.cover_url, ...(source.image_urls || [])].filter(Boolean).slice(0, 9);
  return (
    <div className={`creation-showcase-content-preview${plog ? ' is-plog' : ''}`}>
      <div className="creation-showcase-content-images">
        {images.map((src, index) => <div className={`creation-showcase-content-image image-${index + 1}`} key={`${src}-${index}`}><ResponsiveImage src={src} variant="thumb" ratio="3:4" alt={`${source.title} 第${index + 1}张`} imgStyle={{ objectFit: 'cover' }} /><span>{index + 1}</span></div>)}
      </div>
      <div className="creation-showcase-content-copy">
        <span className="creation-showcase-content-platform">小红书 · {plog ? '生活碎片' : source.cat || '图文笔记'}</span>
        <strong>{source.title}</strong>
        <p>{String(source.body || '').split('\n').filter(Boolean).slice(0, 3).join(' ')}</p>
        <div className="creation-showcase-tags">{(source.tags || []).slice(0, 5).map(tag => <span key={tag}>{tag}</span>)}</div>
        <small><Sparkles size={12} /> 已生成 9 张配图 · 标题 · 正文 · 标签</small>
      </div>
    </div>
  );
}

function VideoPreview({ assets }) {
  const item = assets[0];
  return <div className="creation-showcase-video-preview"><div className="creation-showcase-video-frame"><ResponsiveImage src={item?.src} variant="card" ratio="16:9" alt="视频生成案例" /><span className="creation-showcase-play-mark"><Clapperboard size={20} /></span></div><div className="creation-showcase-video-chapters"><span>素材分析</span><ArrowRight size={14} /><span>镜头方案</span><ArrowRight size={14} /><span>确认生成</span></div></div>;
}

function VisualPreview({ assets, index, onChange }) {
  const items = assets.slice(0, 3);
  const item = items[index] || items[0];
  return <div className="creation-showcase-visual-preview"><div className="creation-showcase-visual-frame"><ResponsiveImage src={item?.src} variant="card" ratio={item?.ratio || '4:3'} alt={item?.label || '自由创作案例'} imgStyle={{ objectFit: 'cover' }} /><span>{item?.label}</span></div>{items.length > 1 && <div className="creation-showcase-preview-nav"><button type="button" aria-label="上一个案例" onClick={() => onChange((index - 1 + items.length) % items.length)}><ChevronLeft size={16} /></button><span>{index + 1} / {items.length}</span><button type="button" aria-label="下一个案例" onClick={() => onChange((index + 1) % items.length)}><ChevronRight size={16} /></button></div>}</div>;
}

export function CreationShowcase({ mode = 'content', subMode = '', entry }) {
  const showcase = normalizeShowcase({ mode, subMode, entry });
  const [visualIndex, setVisualIndex] = useState(0);
  const assets = useMemo(() => assetListFor(showcase.mode, showcase.subMode, entry), [showcase.mode, showcase.subMode, entry]);
  const copy = showcase.mode === 'content' && showcase.subMode === 'plog' ? COPY.plog : showcase.mode === 'ecommerce' ? COPY.ecommerce[showcase.subMode] || COPY.ecommerce['product-suite'] : COPY[showcase.mode];
  const contentEntry = entry?.content || entry;

  return (
    <section className={`creation-showcase creation-showcase-${showcase.mode}${showcase.subMode ? ` is-${showcase.subMode.replace(/_/g, '-')}` : ''}`} aria-label={`${copy.label}案例展示`}>
      <div className="creation-showcase-heading"><div><span className="creation-showcase-eyebrow">{copy.eyebrow}</span><h3>{copy.title}</h3><p>{copy.description}</p></div><span className="creation-showcase-output"><Sparkles size={14} /> {copy.label}</span></div>
      <div className="creation-showcase-body">
        <div className="creation-showcase-copy"><span>真实生成结果</span><strong>{showcase.mode === 'content' ? '图片和文章，一次交付' : copy.title}</strong><p>{showcase.mode === 'content' ? '不是单独给你几张图，而是一套可以直接检查、编辑和发布的内容成品。' : copy.description}</p><div className="creation-showcase-copy-footer"><span>案例仅用于展示能力</span><ArrowRight size={15} /></div></div>
        <div className="creation-showcase-visual">
          {showcase.mode === 'ecommerce' && <EcommercePreview assets={assets} subMode={showcase.subMode} />}
          {showcase.mode === 'content' && <ContentPreview plog={showcase.subMode === 'plog'} entry={contentEntry} />}
          {showcase.mode === 'video' && <VideoPreview assets={assets} />}
          {showcase.mode === 'visual' && <VisualPreview assets={assets} index={visualIndex} onChange={setVisualIndex} />}
        </div>
      </div>
    </section>
  );
}

export default CreationShowcase;
