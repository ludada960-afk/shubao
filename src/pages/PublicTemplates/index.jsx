// 4c183cd4 续命 P3 模板社区 - 主线程亲自做 UI 入口 (子代理 5 次都失败, 不再等)
import React, { useMemo, useState } from 'react';
import { PUBLIC_TEMPLATE_CATEGORIES, PUBLIC_TEMPLATES, popularTemplates, templatesByCategory } from '../../constants/publicTemplates.js';

const PublicTemplates = () => {
  const [cat, setCat] = useState('all');
  const items = useMemo(() => cat === 'all' ? PUBLIC_TEMPLATES : templatesByCategory(cat), [cat]);
  const popular = useMemo(() => popularTemplates(4), []);
  return (
    <section className="public-templates-page">
      <h1>公共模板库</h1>
      <p>9 类目 18 套, 都是站主原创, 抄 TapNow 公开模板 (commit d429b368)</p>
      <div className="popular-row">
        <h2>热门模板</h2>
        <ul>{popular.map(t => <li key={t.id}><span>{t.name}</span> <em>{t.likes} 赞</em></li>)}</ul>
      </div>
      <nav className="cat-bar">
        <button className={cat === 'all' ? 'is-on' : ''} onClick={() => setCat('all')}>全部</button>
        {PUBLIC_TEMPLATE_CATEGORIES.map(c => <button key={c.key} className={cat === c.key ? 'is-on' : ''} onClick={() => setCat(c.key)}>{c.label} ({c.count})</button>)}
      </nav>
      <ul className="grid">
        {items.map(t => <li key={t.id}><img src={t.thumb} alt={t.name} loading="lazy" width="320" height="200" /><strong>{t.name}</strong><small>{t.cat} · 创作者 {t.creator}</small><div>{t.likes} 赞 · {t.downloads} 下载</div></li>)}
      </ul>
    </section>
  );
};

export default PublicTemplates;