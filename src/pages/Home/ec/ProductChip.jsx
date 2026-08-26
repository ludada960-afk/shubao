import React from 'react';
import { ChevronDown, PackageSearch } from 'lucide-react';

/**
 * 底部生成设置栏常驻「当前商品」chip —— 商品档案抽屉的唯一入口。
 * 点击不再弹自带选择器（旧双入口已废），而是呼出 WeShop 式左缘抽屉
 * （列表/详情/素材聚合统一在抽屉里，见 EcProfileRail）。
 * 视觉规格对齐邻近按钮体系：复用 .ec-config-trigger 的尺寸/圆角/描边/hover token，
 * has-profile → is-adjusted（已设置态）；行内 flex 布局由 .ec-product-chip 自身补齐，
 * 保证图标-文字-箭头与邻近触发钮完全同构。
 */
export default function ProductChip({ profile = null, loading = false, onOpen }) {
  return (
    <button
      type="button"
      className={`ec-config-trigger ec-product-chip${profile ? ' is-adjusted' : ''}`}
      aria-label={profile ? `当前商品：${profile.name}，点击打开商品档案` : '当前商品：未选择，点击打开商品档案'}
      aria-haspopup="dialog"
      aria-expanded={false}
      data-testid="ec-current-product-chip"
      onClick={onOpen}
    >
      <PackageSearch size={15} strokeWidth={1.8} aria-hidden="true" />
      <span className="ec-config-trigger-copy">
        <span>当前商品</span>
        <strong>{loading ? '读取中…' : profile ? profile.name : '未选择'}</strong>
      </span>
      <ChevronDown
        size={13}
        style={{
          opacity: 0.4,
          color: profile ? '#7162de' : 'var(--text-muted)',
          flexShrink: 0,
        }}
      />
    </button>
  );
}
