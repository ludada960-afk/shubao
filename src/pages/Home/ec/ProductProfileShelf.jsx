import React from 'react';
import { Archive, BookOpen, Check, LoaderCircle, Plus, RefreshCw, Save, X } from 'lucide-react';
import { productProfileSummary } from './productProfileModel.js';
import { profileStatusLabel } from './productProfileShelfModel.js';
import './ProductProfileShelf.css';

export default function ProductProfileShelf({
  open = false,
  profiles = [],
  loading = false,
  saving = false,
  applying = '',
  error = '',
  onToggle,
  onRefresh,
  onSave,
  onApply,
  onArchive,
} = {}) {
  return (
    <section className="ec-product-profile-shelf" aria-label="商品档案">
      <div className="ec-product-profile-toolbar">
        <button
          type="button"
          className={`ec-product-profile-trigger${open ? ' is-open' : ''}`}
          aria-expanded={open}
          aria-controls="ec-product-profile-panel"
          onClick={onToggle}
        >
          <BookOpen size={16} aria-hidden="true" />
          <span>商品档案</span>
          {profiles.length > 0 && <span className="ec-product-profile-count">{profiles.length}</span>}
        </button>
        <span className="ec-product-profile-hint">保存商品事实与 SKU，下次直接继续</span>
      </div>

      {open && (
        <div id="ec-product-profile-panel" className="ec-product-profile-panel" role="region" aria-label="商品档案列表">
          <div className="ec-product-profile-panel-head">
            <div>
              <strong>可复用商品档案</strong>
              <span>已有本地素材会保留，空槽可带入已验证图片</span>
            </div>
            <div className="ec-product-profile-panel-actions">
              <button type="button" className="ec-product-profile-icon-button" onClick={onRefresh} disabled={loading} title="刷新商品档案" aria-label="刷新商品档案">
                <RefreshCw size={15} className={loading ? 'is-spinning' : ''} />
              </button>
              <button type="button" className="ec-product-profile-icon-button" onClick={onToggle} title="关闭商品档案" aria-label="关闭商品档案">
                <X size={16} />
              </button>
            </div>
          </div>

          {error && <div className="ec-product-profile-error" role="alert">{error}</div>}
          {loading && profiles.length === 0 && <div className="ec-product-profile-empty"><LoaderCircle size={16} className="is-spinning" />正在读取档案</div>}
          {!loading && profiles.length === 0 && <div className="ec-product-profile-empty">还没有商品档案，先保存当前商品。</div>}

          {profiles.length > 0 && (
            <div className="ec-product-profile-list">
              {profiles.map(profile => (
                <div className="ec-product-profile-row" key={profile.profileId}>
                  <button type="button" className="ec-product-profile-apply" onClick={() => onApply?.(profile)} disabled={Boolean(applying)} aria-busy={applying === profile.profileId}>
                    <span className="ec-product-profile-row-title">{profile.name}</span>
                    <span className="ec-product-profile-row-summary">{productProfileSummary(profile)}</span>
                    <span className="ec-product-profile-row-meta">
                      <span className={profile.status === 'active' ? 'is-active' : ''}>{profileStatusLabel(profile.status)}</span>
                      <span>{profile.assets?.length || 0} 个素材引用</span>
                    </span>
                  </button>
                  <div className="ec-product-profile-row-actions">
                    <button type="button" className="ec-product-profile-use" onClick={() => onApply?.(profile)} title={`应用${profile.name}`} disabled={Boolean(applying)}>
                      {applying === profile.profileId ? <LoaderCircle size={14} className="is-spinning" /> : <Check size={14} />}{applying === profile.profileId ? '正在带入' : '应用'}
                    </button>
                    {profile.status === 'active' && <button type="button" className="ec-product-profile-icon-button is-danger" onClick={() => onArchive?.(profile)} title={`归档${profile.name}`} aria-label={`归档${profile.name}`} disabled={Boolean(applying)}><Archive size={14} /></button>}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="ec-product-profile-footer">
            <button type="button" className="ec-product-profile-save" onClick={onSave} disabled={saving}>
              {saving ? <LoaderCircle size={15} className="is-spinning" /> : <Save size={15} />}
              {saving ? '正在保存' : '保存当前商品'}
            </button>
            <span><Plus size={13} /> 档案只保存确认过的商品信息</span>
          </div>
        </div>
      )}
    </section>
  );
}
