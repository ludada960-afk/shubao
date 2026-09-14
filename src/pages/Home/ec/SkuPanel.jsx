import React from 'react';
import { Plus, CheckCircle2, Package } from 'lucide-react';
import ResizableTextarea from './ResizableTextarea.jsx';
import {
  SPACING,
  FONT_SIZE,
  CONTROL_HEIGHT,
  RADIUS,
  groupTitleStyle,
  helperTextStyle,
  inputStyle,
  sectionStyle,
} from './panelVisualLanguage.js';

/* ═══════ SKU 变体面板 ═══════
   2026-09-15 用户批注①（子项 2/3）：面板宽度统一 + 内部控件加强 + 多行框可拉。

   重排逻辑（宽度从 540 收到统一 480 后必须「相应适配」，不能粗暴截断）：
   · 变体卡片内 4 个字段原来是一行 4 列（540px 时每列 ~110px，本就拥挤）；
     收窄到 480 后改为 2×2 网格（每列 ~180px），标签与输入都放得下。
   · 「生成数量」与「删除」并为卡片底栏一行，主次分明。
   · 变体卡片改为独立分组容器（卡片圆角 12 / 内边距 12，分组间距 16）。
   · 每个变体可写「变体说明」（多行、带右下角拉伸手柄）——
     用户填 SKU 时经常要标注差异事实（尺寸/容量/材质），必须有地方写。 */

function GroupTitle({ icon: Icon, children }) {
  return (
    <div style={groupTitleStyle}>
      <Icon size={14} style={{ flexShrink: 0 }} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

function FieldLabel({ children }) {
  return (
    <div style={{ fontSize: FONT_SIZE.fieldLabel, fontWeight: 600, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{children}</div>
  );
}

export default function SkuPanel({ skus, onChange, sizing, onSizingChange, available = null }) {
  const add = () => onChange([...skus, { id: Date.now(), color: '', size: '', capacity: '', dimLabel: '', count: 1, note: '' }]);
  const upd = (id, key, val) => onChange(skus.map(s => s.id === id ? { ...s, [key]: val } : s));
  const rm = (id) => onChange(skus.filter(s => s.id !== id));

  // SKU 是独立的商品事实；生成时会自动加入对应的 SKU 规格图。
  const totalSkuImages = skus.reduce((a, s) => a + (s.count || 1), 0);
  const fields = [
    { key: 'color', label: '颜色', ph: '月岩白' },
    { key: 'size', label: '规格/尺码', ph: 'M / 100ml' },
    { key: 'capacity', label: '容量/数量', ph: '500ml / 3件装' },
    { key: 'dimLabel', label: '标注尺寸', ph: '20×10×5cm' },
  ];

  return (
    <div style={{ padding: 0 }}>
      <div style={{ padding: `${SPACING.sp6}px ${SPACING.sp5}px`, display: 'flex', flexDirection: 'column', gap: SPACING.sp4 }}>

        {/* ── 联动状态提示（信息块，不是可选项） ── */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: SPACING.sp2,
          padding: `${SPACING.sp2}px ${SPACING.sp3}px`,
          background: 'var(--sb-success-bg)', borderRadius: 'var(--sb-radius-control)',
          border: '1px solid var(--sb-success-line)',
        }}>
          <CheckCircle2 size={14} color="var(--sb-success)" style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ ...helperTextStyle, color: 'var(--sb-success)' }}>填写颜色、规格或容量后，系统会自动生成对应的 SKU 变体图。</span>
        </div>

        {/* ── 变体列表 ── */}
        {skus.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sp3 }}>
            {skus.map((sku, idx) => (
              <div key={sku.id} style={{
                display: 'flex', flexDirection: 'column', gap: SPACING.sp3,
                background: 'var(--sb-surface-tint)', borderRadius: 'var(--sb-radius-card)',
                padding: 'var(--sb-space-3)', border: '1px solid var(--sb-border-subtle)',
              }}>
                {/* 卡片标题行：序号 + 生成数量 + 删除 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sp2 }}>
                  <span style={{ fontSize: FONT_SIZE.fieldLabel, fontWeight: 700, color: 'var(--text-primary)' }}>变体 #{idx + 1}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: SPACING.sp2 }}>
                    <span style={helperTextStyle}>生成</span>
                    <input type="number" min="1" max="10" aria-label={`变体 ${idx + 1} 生成数量`}
                      value={sku.count}
                      onChange={e => upd(sku.id, 'count', parseInt(e.target.value) || 1)}
                      style={{ ...inputStyle, width: 56, height: CONTROL_HEIGHT.compact, textAlign: 'center', padding: '0 4px' }} />
                    <span style={helperTextStyle}>张</span>
                    <button type="button" aria-label={`删除变体 ${idx + 1}`} onClick={() => rm(sku.id)}
                      style={{
                        fontSize: 'var(--sb-text-2xs)', fontWeight: 'var(--sb-weight-semibold)', color: 'var(--sb-danger)', cursor: 'pointer',
                        height: CONTROL_HEIGHT.compact, padding: `0 ${SPACING.sp2}px`, borderRadius: 'var(--sb-radius-chip)',
                        border: 0, background: 'transparent', fontFamily: 'inherit',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--sb-danger-bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >删除</button>
                  </span>
                </div>

                {/* 四个事实字段：2×2（480px 面板下每列约 180px，放得下中文标签与内容） */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACING.sp3 }}>
                  {fields.map(f => (
                    <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sp1 }}>
                      <FieldLabel>{f.label}</FieldLabel>
                      <input value={sku[f.key] || ''} onChange={e => upd(sku.id, f.key, e.target.value)}
                        aria-label={`变体 ${idx + 1} ${f.label}`}
                        placeholder={f.ph} style={{ ...inputStyle, height: CONTROL_HEIGHT.compact }} />
                    </div>
                  ))}
                </div>

                {/* 变体说明：多行 + 右下角拉伸手柄 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sp1 }}>
                  <FieldLabel>变体说明（选填）</FieldLabel>
                  <ResizableTextarea
                    aria-label={`变体 ${idx + 1} 说明`}
                    value={sku.note || ''}
                    onChange={e => upd(sku.id, 'note', e.target.value)}
                    available={available}
                    minHeight={64}
                    maxHeight={220}
                    placeholder="该变体与其它规格的差异事实，例：磨砂黑 / 仅 500ml / 含硅胶密封圈"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── 添加按钮 ── */}
        <button type="button" onClick={add}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: SPACING.sp1,
            height: CONTROL_HEIGHT.large, borderRadius: RADIUS.control, fontFamily: 'inherit',
            border: '1.5px dashed var(--sb-border-strong)',
            color: 'var(--text-muted)', background: 'transparent',
            fontSize: FONT_SIZE.body, fontWeight: 600, cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--sb-border-strong)'; e.currentTarget.style.color = 'var(--sb-text-primary)'; e.currentTarget.style.background = 'var(--sb-state-hover-bg)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--sb-border-strong)'; e.currentTarget.style.color = 'var(--sb-text-muted)'; e.currentTarget.style.background = 'transparent'; }}>
          <Plus size={15} /> 添加 SKU 变体
        </button>

        {/* ── 底部统计 ── */}
        <div style={{
          paddingTop: 'var(--sb-space-3)', borderTop: '1px solid var(--sb-border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          ...helperTextStyle,
        }}>
          <span>变体数：<b style={{ color: 'var(--text-primary)' }}>{skus.length}</b> 个</span>
          <span>将生成：<b style={{ color: 'var(--text-primary)' }}>{totalSkuImages}</b> 张 SKU 图</span>
        </div>
      </div>
    </div>
  );
}
