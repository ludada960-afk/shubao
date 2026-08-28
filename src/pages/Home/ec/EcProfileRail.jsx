import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Archive,
  BookOpen,
  Check,
  ChevronRight,
  Files,
  LoaderCircle,
  RefreshCw,
  Save,
} from 'lucide-react';
import { productProfileSummary } from './productProfileModel.js';
import { profileStatusLabel } from './productProfileShelfModel.js';
import './EcProfileRail.css';

// 素材聚合的分组口径：与档案资产弱关联角色一一对应。
export const PROFILE_MEDIA_GROUPS = [
  ['product', '商品图'],
  ['generated', '生成图'],
  ['reference', '参考图'],
  ['person', '模特'],
  ['scene', '场景'],
];

function groupLabel(role) {
  const found = PROFILE_MEDIA_GROUPS.find(([id]) => id === role);
  return found ? found[1] : '';
}

/**
 * 商品档案悬浮抽屉（基准：WeShop 工作台左缘滑出面板）：
 * 抽屉从左缘覆盖在编辑区之上，不参与 flex 布局，编辑区宽度零影响；
 * 唯一入口是底部生成设置栏的「当前商品」chip（ProductChip），本组件不再渲染任何独立入口钮。
 * 列表 tab = 档案卡片；详情 tab = 档案事实 + 素材聚合。
 * 层级契约：抽屉必须 Portal 到 body。若留在 .surface-card(z-index:4) 子树内，
 * fixed+z-index 会被祖先层叠上下文封顶，被 app-side-nav(200)/creative-nav(120)
 * 等页面浮层盖住（回归实证）；Portal 后抽屉 z-1300 高于页面浮层、低于全局模态
 * （tryon 预览 1800 / 图库 lightbox 9998+）。
 */
export default function EcProfileRail({
  open = true,
  tab = 'list',
  profiles = [],
  loading = false,
  saving = false,
  applying = '',
  error = '',
  activeProfileId = '',
  detailProfileId = '',
  detailMedia = [],
  detailLoading = false,
  onToggle,
  onTabChange,
  onRefresh,
  onSave,
  onSelect,
  onOpenDetail,
  onArchive,
} = {}) {
  // 悬浮抽屉：开启期间 Esc 直接收回，对齐头部平台的抽屉交互。
  useEffect(() => {
    if (!open) return undefined;
    const onKey = event => {
      if (event.key === 'Escape') onToggle?.();
    };
    globalThis.addEventListener?.('keydown', onKey);
    return () => globalThis.removeEventListener?.('keydown', onKey);
  }, [open, onToggle]);

  const detailProfile = profiles.find(profile => profile.profileId === detailProfileId) || null;
  const grouped = PROFILE_MEDIA_GROUPS.map(([role, label]) => [
    label,
    detailMedia.filter(item => item.role === role),
  ]).filter(([, items]) => items.length > 0);

  // Portal 到 body：脱离 .surface-card 等祖先层叠上下文，保证 fixed 层级不被封顶。
  const rail = (
    <aside
      id="ec-profile-rail"
      className={`ec-profile-rail${open ? ' is-open' : ' is-closed'}`}
      aria-label="商品档案侧栏"
    >
      {/* 入口收敛：抽屉不再提供左缘竖排入口钮，唯一入口是底部「当前商品」chip。 */}
      {open && <button type="button" className="ec-profile-rail-scrim" aria-label="关闭商品档案抽屉" title="点击空白处收起" onClick={onToggle} />}
      {open && (
        <div id="ec-profile-rail-panel" className="ec-profile-rail-panel">
          <div className="ec-profile-rail-head">
            <strong><BookOpen size={15} aria-hidden="true" /> 商品档案</strong>
            <span className="ec-profile-rail-count">{profiles.length}</span>
            <button type="button" className="ec-profile-rail-icon-button" onClick={onRefresh} disabled={loading} title="刷新商品档案" aria-label="刷新商品档案">
              <RefreshCw size={14} className={loading ? 'is-spinning' : ''} />
            </button>
            <button type="button" className="ec-profile-rail-icon-button" onClick={onToggle} title="收起商品档案抽屉" aria-label="收起商品档案抽屉">
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="ec-profile-rail-tabs" role="tablist" aria-label="商品档案视图">
            <button type="button" role="tab" aria-selected={tab === 'list'} className={tab === 'list' ? 'is-active' : ''} onClick={() => onTabChange?.('list')}>列表</button>
            <button type="button" role="tab" aria-selected={tab === 'detail'} className={tab === 'detail' ? 'is-active' : ''} onClick={() => onTabChange?.('detail')}>详情</button>
          </div>

          {error && <div className="ec-profile-rail-error" role="alert">{error}</div>}

          {tab === 'list' && (
            <div className="ec-profile-rail-body" role="tabpanel" aria-label="商品档案列表">
              {loading && profiles.length === 0 && <div className="ec-profile-rail-empty"><LoaderCircle size={15} className="is-spinning" />正在读取档案</div>}
              {!loading && profiles.length === 0 && <div className="ec-profile-rail-empty">还没有商品档案，先保存当前商品。</div>}
              {profiles.map(profile => (
                <div key={profile.profileId} className={`ec-profile-card${profile.profileId === activeProfileId ? ' is-current' : ''}`}>
                  <button
                    type="button"
                    className="ec-profile-card-main"
                    onClick={() => onOpenDetail?.(profile)}
                    disabled={Boolean(applying)}
                    title={`查看${profile.name}的素材聚合`}
                  >
                    <span className="ec-profile-card-avatar" aria-hidden="true">{String(profile.name || '商').slice(0, 1)}</span>
                    <span className="ec-profile-card-copy">
                      <span className="ec-profile-card-title">{profile.name}{profile.profileId === activeProfileId && <em className="ec-profile-card-badge">当前</em>}</span>
                      <span className="ec-profile-card-summary">{productProfileSummary(profile)}</span>
                      <span className="ec-profile-card-meta">
                        <span>{profileStatusLabel(profile.status)}</span>
                        <span><Files size={11} aria-hidden="true" /> {profile.assets?.length || 0} 个素材</span>
                      </span>
                    </span>
                  </button>
                  <div className="ec-profile-card-actions">
                    <button
                      type="button"
                      className={`ec-profile-card-use${profile.profileId === activeProfileId ? ' is-active' : ''}`}
                      onClick={() => onSelect?.(profile)}
                      disabled={Boolean(applying)}
                      aria-busy={applying === profile.profileId}
                    >
                      {applying === profile.profileId ? <LoaderCircle size={12} className="is-spinning" /> : profile.profileId === activeProfileId ? <Check size={12} /> : null}
                      {applying === profile.profileId ? '正在带入' : profile.profileId === activeProfileId ? '当前商品' : '设为当前'}
                    </button>
                    {profile.status === 'active' && (
                      <button type="button" className="ec-profile-rail-icon-button is-danger" onClick={() => onArchive?.(profile)} title={`归档${profile.name}`} aria-label={`归档${profile.name}`} disabled={Boolean(applying)}>
                        <Archive size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'detail' && (
            <div className="ec-profile-rail-body" role="tabpanel" aria-label="商品档案详情">
              {!detailProfile && <div className="ec-profile-rail-empty">在「列表」中选择一个档案，查看它的完整素材聚合。</div>}
              {detailProfile && (
                <>
                  <div className="ec-profile-detail-head">
                    <strong>{detailProfile.name}</strong>
                    <span>{[detailProfile.category, profileStatusLabel(detailProfile.status)].filter(Boolean).join(' · ')}</span>
                  </div>
                  {Object.keys(detailProfile.facts || {}).length > 0 && (
                    <dl className="ec-profile-detail-facts">
                      {Object.entries(detailProfile.facts).map(([key, value]) => (
                        <div key={key}><dt>{key}</dt><dd>{value}</dd></div>
                      ))}
                    </dl>
                  )}
                  {(detailProfile.variants?.length || 0) > 0 && (
                    <div className="ec-profile-detail-variants">{detailProfile.variants.length} 个 SKU 变体</div>
                  )}
                  <div className="ec-profile-detail-media-head">
                    <strong>素材聚合</strong>
                    <span>{detailLoading ? '正在读取素材…' : `${detailMedia.length} 个素材`}</span>
                  </div>
                  {detailLoading && detailMedia.length === 0 && <div className="ec-profile-rail-empty"><LoaderCircle size={15} className="is-spinning" />正在读取素材</div>}
                  {!detailLoading && grouped.length === 0 && <div className="ec-profile-rail-empty">该档案还没有可复用素材。</div>}
                  {grouped.map(([label, items]) => (
                    <section key={label} className="ec-profile-media-group" aria-label={`${label}素材`}>
                      <header>{label}<small>{items.length}</small></header>
                      <div className="ec-profile-media-grid">
                        {items.map((item, index) => (
                          <figure key={`${item.url}-${index}`}>
                            <img src={item.url} alt={`${label}${index + 1}`} width="120" height="120" loading="lazy" decoding="async" fetchpriority="auto" />
                            <figcaption>{item.label || groupLabel(item.role) || item.role}</figcaption>
                          </figure>
                        ))}
                      </div>
                    </section>
                  ))}
                  <button
                    type="button"
                    className="ec-profile-detail-apply"
                    onClick={() => onSelect?.(detailProfile)}
                    disabled={Boolean(applying)}
                    aria-busy={applying === detailProfile.profileId}
                  >
                    {applying === detailProfile.profileId ? <LoaderCircle size={13} className="is-spinning" /> : <Check size={13} />}
                    {applying === detailProfile.profileId ? '正在带入' : detailProfile.profileId === activeProfileId ? '已设为当前商品' : '应用此档案并带入主图'}
                  </button>
                </>
              )}
            </div>
          )}

          <div className="ec-profile-rail-footer">
            <button type="button" className="ec-profile-rail-save" onClick={onSave} disabled={saving}>
              {saving ? <LoaderCircle size={14} className="is-spinning" /> : <Save size={14} />}
              {saving ? '正在保存' : '保存当前商品'}
            </button>
            <span>生成结果会自动归入当前商品</span>
          </div>
        </div>
      )}
    </aside>
  );

  if (typeof document === 'undefined') return rail;
  return createPortal(rail, document.body);
}
