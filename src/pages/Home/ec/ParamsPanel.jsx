import React, { useState } from 'react';
import { Check, Shapes, Ruler, Palette, Pipette, Layers3, Hammer } from 'lucide-react';
import ResizableTextarea from './ResizableTextarea.jsx';
import {
  SPACING,
  FONT_SIZE,
  CONTROL_HEIGHT,
  RADIUS,
  groupTitleStyle,
  inputStyle,
  sectionStyle,
} from './panelVisualLanguage.js';

const CATEGORIES = ['美妆护肤', '3C数码', '家居日用', '服饰鞋包', '食品饮料', '母婴用品', '宠物用品', '运动户外', '汽车用品', '图书文具', '珠宝配饰', '其他'];

/* ═══════ 商品信息面板 ═══════
   2026-09-15 用户批注①（子项 2/3）：
   「这些输入区都特别小……每一个输入框右下角还是得有一个可以拉伸的按钮」
   「你这些面板最好宽度都是统一的 …… 里面还有很多按钮逻辑、内容逻辑，
    要相应适配，要从全局逻辑考虑。」

   ── 语义重排（原来是一坨平铺，没有主次）──
   分组 1「商品归类」：品类 —— 决定后续平台规则与文案口径的第一性问题，单独成组
   分组 2「外观与材质」：尺寸 / 底色 / 点缀色 / 材质 —— 决定画面「长什么样」
   分组 3「工艺与其它」：工艺说明（单行）+ 其它补充（多行，带拉伸手柄）
     —— 这是本面板唯一的自由文本入口，必须能拉高（工厂资料往往成段）
   分组标题 13/700，字段标签 12/600，输入框统一 36px 高 / 8 圆角。 */

function GroupTitle({ icon: Icon, children }) {
  return (
    <div style={groupTitleStyle}>
      <Icon size={14} color="var(--accent, #7c3aed)" style={{ flexShrink: 0 }} />
      <span>{children}</span>
    </div>
  );
}

function FieldLabel({ icon: Icon, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sp1, fontSize: FONT_SIZE.fieldLabel, fontWeight: 600, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
      <Icon size={12} color="var(--accent, #7c3aed)" style={{ flexShrink: 0 }} />
      <span>{children}</span>
    </div>
  );
}

export default function ParamsPanel({ params, onChange, mode = 'product', available = null }) {
  const [catOpen, setCatOpen] = useState(false);
  const set = (key, val) => onChange({ ...params, [key]: val });

  const appearanceFields = mode === 'tryon' ? [
    { key: 'baseColor', label: '必须保留的颜色', icon: Palette, ph: '例：炭灰、米白、酒红' },
    { key: 'material', label: '商品材质', icon: Layers3, ph: '羊毛 / 真皮 / 金属 / 雪纺' },
    { key: 'size', label: '尺码与比例', icon: Ruler, ph: '宽松版 / 标准版 / 商品尺寸' },
  ] : [
    { key: 'size', label: '产品尺寸', icon: Ruler, ph: '长×宽×高 (cm)' },
    { key: 'baseColor', label: '底色/主色', icon: Palette, ph: '白色 / #F5F0EB' },
    { key: 'accentColor', label: '点缀色', icon: Pipette, ph: '金色 / 玫瑰金' },
    { key: 'material', label: '材质', icon: Layers3, ph: '陶瓷 / 硅胶 / 不锈钢' },
  ];

  return (
    <div style={{ padding: 0 }}>
      <div style={{ padding: `${SPACING.sp6}px ${SPACING.sp5}px`, display: 'flex', flexDirection: 'column', gap: SPACING.sp4 }}>

        {/* ── 分组 1：商品归类 ── */}
        <div style={sectionStyle}>
          <GroupTitle icon={Shapes}>{mode === 'tryon' ? '商品类型' : '商品归类'}</GroupTitle>
          <div style={{ position: 'relative' }}>
            <input
              aria-label={mode === 'tryon' ? '商品类型' : '品类'}
              value={params.category || ''}
              onChange={e => set('category', e.target.value)}
              onFocus={() => setCatOpen(true)}
              onBlur={() => setTimeout(() => setCatOpen(false), 200)}
              placeholder={mode === 'tryon' ? '服饰 / 鞋包 / 配饰...' : '美妆护肤 / 3C数码...'}
              style={inputStyle}
            />
            {catOpen && (
              <div className="ec-inline-option-menu" style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                marginTop: SPACING.sp1, background: '#fff', border: '1px solid rgba(45,41,38,0.10)',
                borderRadius: RADIUS.control, boxShadow: '0 8px 30px rgba(0,0,0,0.1)',
                padding: SPACING.sp1, display: 'flex', flexWrap: 'wrap', gap: SPACING.sp1,
                maxHeight: 168, overflowY: 'auto',
              }}>
                {CATEGORIES.map(c => (
                  <div key={c} onClick={() => { set('category', c); setCatOpen(false); }}
                    style={{
                      padding: `${SPACING.sp1}px ${SPACING.sp2}px`, borderRadius: 6, fontSize: FONT_SIZE.helper, cursor: 'pointer',
                      background: params.category === c ? '#1F1D1A' : 'rgba(0,0,0,0.04)',
                      color: params.category === c ? '#fff' : 'var(--text-secondary)',
                      fontWeight: params.category === c ? 600 : 400,
                      transition: 'all 0.15s',
                    }}>{c}</div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── 分组 2：外观与材质（2 列） ── */}
        <div style={sectionStyle}>
          <GroupTitle icon={Palette}>外观与材质</GroupTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACING.sp3 }}>
            {appearanceFields.map(f => (
              <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sp2 }}>
                <FieldLabel icon={f.icon}>{f.label}</FieldLabel>
                <input
                  aria-label={f.label}
                  value={params[f.key] || ''}
                  onChange={e => set(f.key, e.target.value)}
                  placeholder={f.ph}
                  style={inputStyle}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ── 分组 3：工艺与其它 ── */}
        <div style={sectionStyle}>
          <GroupTitle icon={Hammer}>{mode === 'tryon' ? '版型与工艺' : '工艺与其它'}</GroupTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sp2 }}>
            <FieldLabel icon={Hammer}>{mode === 'tryon' ? '版型与工艺' : '工艺说明'}</FieldLabel>
            <input
              aria-label={mode === 'tryon' ? '版型与工艺' : '工艺说明'}
              value={params.craft || ''}
              onChange={e => set('craft', e.target.value)}
              placeholder={mode === 'tryon' ? '廓形、垂坠、刺绣、五金细节' : '磨砂 / 抛光 / 浮雕'}
              style={inputStyle}
            />
          </div>
          {/* 多行补充：工厂资料往往成段，必须能拉高 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sp2 }}>
            <FieldLabel icon={Shapes}>其它补充（选填）</FieldLabel>
            <ResizableTextarea
              aria-label="其它补充"
              value={params.extraNotes || ''}
              onChange={e => set('extraNotes', e.target.value)}
              available={available}
              minHeight={80}
              maxHeight={280}
              placeholder="包装形式、配件清单、同类竞品差异、禁止出现的结构…"
            />
          </div>
        </div>

        {mode === 'tryon' && (() => {
          const preservePrinciples = [
            ['preserveMaterial', '锁定材质纹理', '强化材质、垂坠、反光与表面纹理约束，降低换装后质感漂移。'],
            ['preservePattern', '锁定图案与标识', '强化印花、织纹、五金和标识位置约束，减少图案被重绘。'],
            ['consistentPersonScene', '保持人物与场景', '强化人物身份、姿态、环境与光线连续性，适合批量生成同组穿搭。'],
          ];
          return <div className="ec-tryon-principles" aria-label="万物上身生成原则">
            {preservePrinciples.map(([key, label, description], index) => (
              <div key={key} className="ec-tryon-principle">
                <span className="ec-tryon-principle-index">0{index + 1}</span>
                <span className="ec-tryon-principle-check"><Check size={13} /></span>
                <span><strong>{label}</strong><small>{description}</small></span>
              </div>
            ))}
          </div>;
        })()}
      </div>
    </div>
  );
}
