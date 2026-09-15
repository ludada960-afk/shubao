import React, { useState } from 'react';
import { Check, Shapes, Ruler, Palette, Pipette, Layers3, Hammer } from 'lucide-react';
import {
  SPACING,
  FONT_SIZE,
  inputStyle,
  fieldStackStyle,
} from './panelVisualLanguage.js';
import { FieldLabel } from './PanelPrimitives.jsx';

const CATEGORIES = ['美妆护肤', '3C数码', '家居日用', '服饰鞋包', '食品饮料', '母婴用品', '宠物用品', '运动户外', '汽车用品', '图书文具', '珠宝配饰', '其他'];

/* ═══════ 商品信息面板 ═══════
   2026-09-15 用户批注①（子项 2/3）：
   「这些输入区都特别小……每一个输入框右下角还是得有一个可以拉伸的按钮」
   「你这些面板最好宽度都是统一的 …… 里面还有很多按钮逻辑、内容逻辑，
    要相应适配，要从全局逻辑考虑。」

   ── 结构（2026-09-15 用户批注图5 之后）──
   本面板不再有分组大标题，只有**字段标签 + 控件**两层：
     品类 · 产品尺寸 / 底色主色 / 点缀色 / 材质（2 列）· 工艺说明
   理由见下方各段注释：大标题与字段标签是同一层级的信息写两遍。
   输入框统一走 inputStyle（36 高 / 8 圆角 / token 配色），标签走 fieldLabelStyle（主次阶梯）。 */
/* 本面板的 FieldLabel 改为共用 PanelPrimitives 的那一个（12/600/ink-2 + 12px 图标）。
   原先这里自己写死一套 12/600/ink-2 —— 与 TEXT_ROLE 是两份真相，改阶梯时必然漏一处。 */

export default function ParamsPanel({ params, onChange, mode = 'product' }) {
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

        {/* ── 品类 ──
            2026-09-15 用户批注（图5-①）：删掉「商品归类 / 外观与材质 / 工艺与其它」三个大标题。
            用户原话：「这几块我觉得没有太大必要，因为你其实下面已经有相关的这些选项是干什么的，
            你都已经给他们一个小标题了呀，上面再加一个大标题，信息点是重复的。」
            —— 每个框本来就有自己的字段标签，再加一层分组大标题 = 同一层级信息写两遍。
            这一格本来只有大标题、没有字段标签，所以**把它降级成字段标签**，
            而不是直接删掉（否则输入框就变成没有名字的裸框）。 */}
        <div style={fieldStackStyle}>
          <FieldLabel icon={Shapes}>{mode === 'tryon' ? '商品类型' : '品类'}</FieldLabel>
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
                marginTop: SPACING.sp1, background: 'var(--sb-surface-card)', border: '1px solid var(--sb-border-default)',
                borderRadius: 'var(--sb-radius-control)', boxShadow: 'var(--sb-shadow-lg)',
                padding: SPACING.sp1, display: 'flex', flexWrap: 'wrap', gap: SPACING.sp1,
                maxHeight: 168, overflowY: 'auto',
              }}>
                {CATEGORIES.map(c => (
                  <button key={c} type="button" className="a11y-reset"
                    aria-pressed={params.category === c} aria-label={`分类 ${c}`}
                    onClick={() => { set('category', c); setCatOpen(false); }}
                    style={{
                      padding: `${SPACING.sp1}px ${SPACING.sp2}px`, borderRadius: 'var(--sb-radius-chip)', fontSize: FONT_SIZE.helper, cursor: 'pointer',
                      background: params.category === c ? 'var(--sb-state-selected-bg)' : 'var(--sb-state-hover-bg)',
                      color: params.category === c ? 'var(--sb-state-selected-ink)' : 'var(--sb-text-secondary)',
                      fontWeight: params.category === c ? 600 : 400,
                      transition: 'all 0.15s',
                    }}>{c}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── 外观与材质（2 列，各自带字段标签） ── */}
        <div style={fieldStackStyle}>
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

        {/* ── 工艺说明 ──
            2026-09-15 用户批注（图5-②）：**「其它补充」整块删除**。
            用户原话：「而且你这里怎么还有一个其他补充呀？我觉得完全没有必要呀。因为你这个
            其他补充的话，你像里面还有什么避免出现的元素这些东西，这个你后面那个按钮不是里面
            都有吗？」—— 「避免出现的元素」已在内容规范面板承接反向约束，这里再开一个自由文本框，
            等于同一件事有两个入口，用户不知道该写哪个。
            params.extraNotes 字段保留在数据层（历史草稿仍可读），只是不再在本面板上屏。 */}
        <div style={fieldStackStyle}>
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
