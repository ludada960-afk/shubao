import React, { useEffect } from 'react';
import { Sparkles, LogIn, RefreshCw } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { IMAGES } from '../../constants/images';
import { loadWorks, proxyImg } from '../../services/api';
import { Card, CharImg, EmptyState } from '../../components/ui/index';
import Button from '../../components/ui/Button';
import Footer from '../../components/layout/Footer';

export default function WorksPage() {
  const { state, dispatch } = useApp();
  const { works, logged } = state;

  const refresh = () => loadWorks().then(w => dispatch({ type: 'SET_WORKS', works: w }));

  useEffect(() => { refresh(); }, []);

  const viewWork = (w) => {
    dispatch({ type: 'SET_RESULT', result: w });
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '48px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 6 }}>
          <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--weight-heavy)', margin: 0 }}>我的作品</h1>
          <button onClick={refresh} style={{
            background: 'var(--border-light)', border: 'none', borderRadius: 'var(--radius-md)',
            padding: '6px 12px', fontSize: 'var(--text-sm)', color: 'var(--text-muted)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit',
          }}>
            <RefreshCw size={12} /> 刷新
          </button>
        </div>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-hint)', textAlign: 'center', margin: '0 0 32px' }}>
          {works.length ? `${works.length}个作品` : '还没有作品，去创作第一套爆款图文吧'}
        </p>

        {!works.length ? (
          <EmptyState
            image={IMAGES.empty}
            title={logged ? '暂无作品' : '登录后查看作品'}
            desc={logged ? '去首页创作第一套爆款图文吧' : '登录后，生成的内容会自动保存到这里'}
            action={
              logged
                ? <Button primary onClick={() => dispatch({ type: 'NAVIGATE', page: 'home' })}><Sparkles size={14} /> 开始创作</Button>
                : <Button primary onClick={() => dispatch({ type: 'SHOW_LOGIN', show: true })}><LogIn size={14} /> 登录查看作品</Button>
            }
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {works.map((w, i) => (
              <Card key={w.id || i} hover onClick={() => viewWork(w)} style={{
                padding: 16, display: 'flex', gap: 14, alignItems: 'center',
              }}>
                {w.cover_url ? (
                  <img src={proxyImg(w.cover_url)} alt=""
                    style={{ width: 56, height: 75, borderRadius: 'var(--radius-md)', objectFit: 'cover', flex: '0 0 auto' }} />
                ) : (
                  <div style={{
                    width: 56, height: 75, borderRadius: 'var(--radius-md)', background: 'var(--border-light)',
                    flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                  }}>📄</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="truncate-2" style={{
                    fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)',
                    lineHeight: 1.5, marginBottom: 4,
                  }}>{w.title}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--text-ghost)' }}>
                    <span>{w.category}</span>
                    <span>{w.at}</span>
                  </div>
                  {w.cover_url && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-invisible)', marginTop: 2 }}>
                    {w.image_urls?.length || 0}张配图
                  </div>}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
