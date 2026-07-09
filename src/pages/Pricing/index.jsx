import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { PRICING_XHS, PRICING_EC } from '../../constants/data';
import Button from '../../components/ui/Button';
import { Card } from '../../components/ui/index';
import Footer from '../../components/layout/Footer';

const FAQ_CONTENT = {
  content: [
    { q: '每套套餐中的「套」是什么意思？', a: '每次输入一个创作主题，AI 生成完整的 1 篇文案 + 9 张配图，算消耗 1 套。' },
    { q: '生成的图片可以商用吗？', a: '可以。通过薯包AI生成的所有图片，用户拥有完整的商用使用权。' },
    { q: '可以退款吗？', a: '未使用的套餐额度可随时申请退款，已消耗的部分按比例扣除。' },
  ],
  ecommerce: [
    { q: '每套套餐中的「套」是什么意思？', a: '每次输入一个商品，AI 按你选的风格生成对应的商品图片，算消耗 1 套。' },
    { q: 'AI生成的电商商品图可以直接用吗？', a: '可以。生成的白底主图符合淘宝/京东/亚马逊主图规范。' },
    { q: '支持哪些平台？', a: '电商生图支持淘宝、京东、拼多多、小红书电商、抖音电商、亚马逊。' },
  ],
};

export default function PricingPage() {
  const { state, dispatch } = useApp();
  const [tab, setTab] = useState('content');
  const plans = tab === 'content' ? PRICING_XHS : PRICING_EC;
  const faqs = FAQ_CONTENT[tab];

  const buy = (p) => {
    if (!state.logged) { dispatch({ type: 'SHOW_LOGIN', show: true }); return; }
    dispatch({ type: 'ADD_CREDITS', amount: p.sets });
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '48px 28px' }}>
        <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--weight-heavy)', textAlign: 'center', margin: '0 0 6px' }}>
          定价
        </h1>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-hint)', textAlign: 'center', margin: '0 0 32px' }}>
          按套购买，不自动续费。两种套餐按你的需求选
        </p>

        {/* Tab */}
        <div style={{
          display: 'flex', justifyContent: 'center', margin: '0 auto 32px',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-full)',
          width: 'fit-content', overflow: 'hidden',
        }}>
          {[{ key: 'content', label: '📝 小红书图文' }, { key: 'ecommerce', label: '🛍️ 电商图生成' }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '10px 28px', fontSize: 'var(--text-base)',
              fontWeight: tab === t.key ? 'var(--weight-semibold)' : 'var(--weight-normal)',
              color: tab === t.key ? '#fff' : 'var(--text-secondary)',
              background: tab === t.key ? 'var(--red)' : '#fff',
              border: 'none', fontFamily: 'inherit', cursor: 'pointer',
              transition: 'all var(--duration-fast)',
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {plans.map((p, i) => (
            <Card key={i} style={{
              padding: 22, textAlign: 'center', position: 'relative',
              border: p.pop ? '2px solid var(--red)' : '1px solid var(--border)',
            }}>
              {p.pop && (
                <div style={{
                  position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)',
                  background: 'var(--red)', color: '#fff',
                  fontSize: 'var(--text-xs)', padding: '3px 14px',
                  borderRadius: 'var(--radius-md)', fontWeight: 'var(--weight-semibold)',
                }}>推荐</div>
              )}
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', marginBottom: 4 }}>{p.name}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-hint)', marginBottom: 14 }}>{p.desc}</div>
              <div style={{ fontSize: 32, fontWeight: 'var(--weight-heavy)', color: 'var(--red)', marginBottom: 4 }}>¥{p.price}</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-faint)', marginBottom: 4 }}>{p.sets}套</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-ghost)', marginBottom: 4 }}>每套约{p.imgs} · 约 ¥{p.per}/套</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-ghost)', marginBottom: 16 }}>单张可重生成 {p.regen}次/套</div>
              <Button primary={p.pop} full small onClick={() => buy(p)}>
                {p.pop ? <><Sparkles size={12} /> 立即购买</> : '选择'}
              </Button>
            </Card>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 'var(--text-xs)', color: 'var(--text-faint)', lineHeight: 'var(--leading-loose)' }}>
          所有套餐一次性购买，不清零，不限时间
        </div>

        {/* FAQ */}
        <div style={{ maxWidth: 640, margin: '40px auto 0', textAlign: 'left' }}>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', marginBottom: 16, textAlign: 'center' }}>
            常见问题
          </div>
          {faqs.map((faq, i) => (
            <details key={i} style={{ borderBottom: '1px solid var(--border)', padding: '14px 0', fontSize: 'var(--text-sm)' }}>
              <summary style={{ fontWeight: 'var(--weight-semibold)', cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
                {faq.q}
              </summary>
              <p style={{ margin: '8px 0 0', color: 'var(--text-hint)', lineHeight: 'var(--leading-relaxed)', fontSize: 'var(--text-sm)' }}>
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}
