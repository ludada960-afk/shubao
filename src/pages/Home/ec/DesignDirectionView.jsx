import React, { useState } from 'react';
import { MdArrowBack, MdAutoAwesome, MdAutoFixHigh, MdCheck } from 'react-icons/md';

const MOCK_DIRECTIONS = [
  {
    id: 1,
    title: '产品主视觉',
    subtitle: '纯净白底 · 产品聚焦',
    description: '采用纯白背景搭配柔和底部阴影，以45°经典角度展示产品全貌。光线从左上方打入，营造立体质感。画面干净利落，突出产品本身的材质与设计细节，适合电商主图与搜索结果页。',
    outputs: ['白底主图 ×2', '场景主图 ×1', '细节特写 ×1'],
    mood: 'linear-gradient(135deg, #f5f5f5 0%, #ffffff 50%, #fafafa 100%)',
  },
  {
    id: 2,
    title: '卖点强化展示',
    subtitle: '功能图解 · 信息层次',
    description: '在产品实拍基础上叠加简洁的图文排版，用图标+短文案标注核心卖点。采用分层构图：产品居中，卖点环绕分布，视觉动线清晰。适合详情页首屏与社交媒体种草图。',
    outputs: ['卖点图解 ×2', '功能对比 ×1', '参数展示 ×1'],
    mood: 'linear-gradient(135deg, #ede9fe 0%, #e0e7ff 50%, #f0f4ff 100%)',
  },
  {
    id: 3,
    title: '生活化场景',
    subtitle: '氛围感 · 代入使用场景',
    description: '将产品置入真实生活场景中，搭配自然光与生活道具。通过环境氛围传达产品调性，让消费者产生"我也想要"的购买欲。色调温暖舒适，光影自然真实。',
    outputs: ['场景图 ×2', '氛围图 ×1', '使用场景 ×1'],
    mood: 'linear-gradient(135deg, #fef3c7 0%, #fed7aa 50%, #fde68a 100%)',
  },
  {
    id: 4,
    title: '细节质感特写',
    subtitle: '微距 · 材质纹理',
    description: '微距镜头聚焦产品材质细节：纹理、缝线、Logo、接口等。浅景深虚化背景，强光影突出质感层次。传达工艺品质感，增强消费者对产品质量的信心。',
    outputs: ['材质特写 ×2', '工艺细节 ×1', 'Logo特写 ×1'],
    mood: 'linear-gradient(135deg, #1a1a2e 0%, #2d2d44 50%, #404060 100%)',
  },
];

/**
 * DesignDirectionView — step 2 of the wizard.
 * Shows AI-analyzed design directions for user selection.
 *
 * Props:
 *   onBack       — return to step 1
 *   onConfirm    — confirm direction and start generation
 *   directions   — array of direction objects (falls back to mock)
 *   productName  — the product name/description from step 1
 *   onRegenerate — callback when user modifies params and wants new directions
 */
export default function DesignDirectionView({ onBack, onConfirm, directions, productName, onRegenerate }) {
  const [selectedId, setSelectedId] = useState(null);
  const dirs = directions?.length ? directions : MOCK_DIRECTIONS;

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f1a', color: '#fff', paddingBottom: 40 }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div onClick={onBack}
          style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}>
          <MdArrowBack size={18} color="rgba(255,255,255,0.6)" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>选择设计方向</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>AI 已分析您的产品并规划多套设计方案</div>
        </div>
      </div>

      {/* Header */}
      <div style={{ padding: '28px 24px 8px', maxWidth: 900, margin: '0 auto' }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.3, marginBottom: 6 }}>
          <span style={{ color: '#a78bfa' }}>AI</span> 已解析您的产品与需求
        </h2>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
          为您规划了 {dirs.length} 套差异化设计方向，请选择其一继续生成整套电商素材
        </p>
        {productName && (
          <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)' }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>产品：</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#a78bfa' }}>{productName}</span>
          </div>
        )}
      </div>

      {/* Direction cards */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {dirs.map(dir => {
          const selected = selectedId === dir.id;
          return (
            <div key={dir.id} onClick={() => setSelectedId(dir.id)}
              style={{
                display: 'flex', borderRadius: 16, overflow: 'hidden', cursor: 'pointer',
                border: selected ? '2px solid #a78bfa' : '1px solid rgba(255,255,255,0.08)',
                background: selected ? 'rgba(167,139,250,0.06)' : 'rgba(255,255,255,0.03)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { if (!selected) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
              onMouseLeave={e => { if (!selected) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}>
              {/* Left: mood swatch */}
              <div style={{ width: 140, flexShrink: 0, background: dir.mood, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{
                  width: 60, height: 60, borderRadius: 14,
                  background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, fontWeight: 800, color: 'rgba(255,255,255,0.7)',
                }}>
                  {dir.id}
                </div>
              </div>
              {/* Right: content */}
              <div style={{ flex: 1, padding: '16px 20px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: selected ? '#a78bfa' : 'rgba(255,255,255,0.9)' }}>{dir.title}</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>·</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{dir.subtitle}</span>
                  {selected && (
                    <div style={{ marginLeft: 'auto', width: 22, height: 22, borderRadius: '50%', background: '#a78bfa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <MdCheck size={13} color="#fff" />
                    </div>
                  )}
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.7, color: 'rgba(255,255,255,0.5)', margin: '0 0 10px' }}>{dir.description}</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {dir.outputs.map((o, i) => (
                    <span key={i} style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.45)' }}>
                      {o}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom action */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 24px' }}>
        <button onClick={() => selectedId && onConfirm(selectedId)}
          disabled={!selectedId}
          style={{
            width: '100%', height: 52, borderRadius: 14, border: 'none',
            background: selectedId
              ? 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 50%, #c4b5fd 100%)'
              : 'rgba(255,255,255,0.06)',
            color: selectedId ? '#fff' : 'rgba(255,255,255,0.25)',
            fontSize: 16, fontWeight: 700, cursor: selectedId ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: selectedId ? '0 4px 24px rgba(124,58,237,0.3)' : 'none',
          }}>
          <MdAutoAwesome size={18} />
          确认方向 · 开始生成全套素材
        </button>
      </div>
    </div>
  );
}
