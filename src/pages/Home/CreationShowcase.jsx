import React, { useMemo, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Clapperboard, Maximize2, Sparkles } from 'lucide-react';
import ResponsiveImage from '../../components/ResponsiveImage.jsx';
import NoteModal from '../../NoteModal.jsx';
import { GALLERY } from '../../constants/data';
import { productionCaseById } from './productionCaseCatalog.js';
import { normalizeShowcase } from './creationShowcaseModel.js';
import { buildXhsPublishPages, getXhsPublishBody } from './xhsPublishPreviewModel.js';
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

function ContentPreview({ entry, plog = false, onOpen }) {
  if (plog || !entry) {
    return (
      <div className="creation-showcase-content-empty">
        <span className="creation-showcase-empty-mark"><Sparkles size={18} /></span>
        <strong>案例暂未入库</strong>
        <p>生成第一套生活碎片后，这里会展示九宫格、情绪文案和发布结构。</p>
        <small>当前不使用虚构案例</small>
      </div>
    );
  }
  const source = entry;
  const pages = buildXhsPublishPages(source);
  return (
    <div className="creation-showcase-content-preview">
      <div className="creation-showcase-content-images">
        {pages.map(page => <button type="button" className={`creation-showcase-content-image image-${page.index + 1}`} key={`${page.src}-${page.index}`} onClick={() => onOpen?.(page.index)} aria-label={`放大查看${page.alt}`}><ResponsiveImage src={page.src} variant="thumb" ratio="3:4" alt={page.alt} loading="eager" fetchPriority={page.index === 0 ? 'high' : 'auto'} imgStyle={{ objectFit: 'cover' }} /><span>{page.index + 1}</span></button>)}
      </div>
      <div className="creation-showcase-content-copy">
        <span className="creation-showcase-content-platform">小红书 · {source.cat || '图文笔记'}</span>
        <strong>{source.title}</strong>
        <p>{getXhsPublishBody(source).split('\n').filter(Boolean).slice(0, 4).join(' ')}</p>
        <div className="creation-showcase-tags">{(source.tags || []).map(tag => <span key={tag}>{tag}</span>)}</div>
        <button type="button" className="creation-showcase-content-open" onClick={() => onOpen?.(0)}><Maximize2 size={13} />查看完整发布预览</button>
        <small><Sparkles size={12} /> 已生成 9 张配图 · 标题 · 正文 · 标签</small>
      </div>
    </div>
  );
}

function XhsPublishPreview({ entry, initialIndex = 0, onClose }) {
  const item = useMemo(() => {
    if (!entry) return null;
    return {
      ...entry,
      body_text: getXhsPublishBody(entry),
      hashtags: Array.isArray(entry.tags) ? entry.tags : [],
      _galleryItem: true,
      _galleryType: 'content',
    };
  }, [entry, initialIndex]);

  if (!item || buildXhsPublishPages(item).length === 0) return null;
  return <NoteModal item={item} initialImageIndex={initialIndex} onClose={onClose} />;
}

function ContentShowcase({ entry, subMode = 'content' }) {
  const [previewIndex, setPreviewIndex] = useState(null);
  const isPlog = subMode === 'plog';
  const active = isPlog
    ? {
        eyebrow: 'Plog · 案例位',
        title: '生活素材整理成一套有情绪的记录',
        description: 'Plog 真实案例暂未入库。上传生活素材并完成第一次生成后，这里会替换成真实的九宫格和文案成品。',
        entry: null,
        facts: [['01', '图片结构', '9 张生活碎片'], ['02', '内容交付', '情绪文案与标签'], ['03', '当前状态', '案例暂未入库']],
      }
    : {
        eyebrow: '小红书图文 · 真实案例',
        title: '厦门 3 天 2 夜，一套图文直接发布',
        description: '从一句旅行主题开始，统一生成封面、行程图片、标题、正文和标签，用户可以直接检查和编辑。',
        entry: entry || GALLERY.find(item => item.id === 'xm'),
        facts: [['01', '图片结构', '9 张发布配图'], ['02', '内容交付', '标题 · 正文 · 标签'], ['03', '使用方式', '检查后直接发布']],
      };
  return (
    <section className={`creation-showcase creation-showcase-content${isPlog ? ' is-plog' : ''}`} aria-label="小红书图文与Plog案例展示">
      <div className="creation-showcase-heading">
        <div><span className="creation-showcase-eyebrow">发布成品案例</span><h3>一句话生成一套能直接发布的小红书内容</h3><p>图片、标题、正文和标签一起生成，按发布结构统一检查。</p></div>
        <span className="creation-showcase-output"><Sparkles size={14} />内容创作</span>
      </div>
      <div className="creation-showcase-body creation-showcase-content-body">
        <div className="creation-showcase-copy creation-showcase-content-copy-shell">
          <span>{active.eyebrow}</span>
          <strong>{active.title}</strong>
          <p>{active.description}</p>
          <div className="creation-showcase-copy-footer"><span>案例仅用于展示能力</span><ArrowRight size={15} /></div>
        </div>
        <div className="creation-showcase-visual creation-showcase-content-visual"><ContentPreview entry={active.entry} plog={active.id === 'plog-empty'} onOpen={active.id === 'plog-empty' ? undefined : setPreviewIndex} /></div>
      </div>
      <div className="creation-showcase-content-facts" aria-label="案例交付内容">
        {active.facts.map(([number, label, value]) => <div key={number}><span>{number}</span><small>{label}</small><strong>{value}</strong></div>)}
      </div>
      {active.entry && previewIndex !== null && <XhsPublishPreview entry={active.entry} initialIndex={previewIndex} onClose={() => setPreviewIndex(null)} />}
    </section>
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
  if (mode === 'content') return <ContentShowcase entry={entry?.content || entry} subMode={subMode} />;
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
          {showcase.mode === 'video' && <VideoPreview assets={assets} />}
          {showcase.mode === 'visual' && <VisualPreview assets={assets} index={visualIndex} onChange={setVisualIndex} />}
        </div>
      </div>
    </section>
  );
}

export default CreationShowcase;
