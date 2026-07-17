import React, { useState, useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { PRICING_XHS, PRICING_EC } from '../../constants/data';
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

/**
 * 套餐页 — 灵图风格弹窗式
 */
export default function PricingPage() {
  const { state, dispatch, fetchCredits } = useApp();
  const [tab, setTab] = useState('content');
  const plans = tab === 'content' ? PRICING_XHS : PRICING_EC;
  const faqs = FAQ_CONTENT[tab];

  const [payModal, setPayModal] = useState(null);
  const [payLoading, setPayLoading] = useState(false);
  const [paidSuccess, setPaidSuccess] = useState(false);

  useEffect(() => {
    if (window.location.search.includes('paid=1')) {
      setPaidSuccess(true);
      if (state.logged && state.phone) fetchCredits(state.phone);
      window.history.replaceState({}, '', '/pricing');
      setTimeout(() => setPaidSuccess(false), 5000);
    }
  }, []);

  const buy = (p) => {
    if (!state.logged) { dispatch({ type: 'SHOW_LOGIN', show: true }); return; }
    setPayModal(p);
  };

  const createOrder = async (type) => {
    if (!payModal) return;
    setPayLoading(true);
    try {
      const r = await fetch('/api/create-payment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: (tab === 'content' ? '📝小红书图文-' : '🛍️电商图-') + payModal.name,
          type, email: state.phone,
          sets: payModal.sets, amount: payModal.price,
        }),
      });
      const d = await r.json();
      if (d.code === 1 && d.url) {
        window.location.href = d.url;
      } else alert(d.error || '下单失败');
    } catch(e) { alert(e.message); }
    setPayLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '48px 20px' }}>
        {/* Header */}
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 30, fontWeight: 900, color: 'var(--accent)', marginBottom: 4 }}>
            创作权益
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>
            选择适合你的月度套餐
          </p>
        </div>

        {paidSuccess && (
          <div style={{ textAlign:'center', padding:'12px 20px', background:'#F0FFF4', border:'1px solid #68D391', borderRadius:12, marginBottom:20, fontSize:14, fontWeight:600, color:'#276749' }}>
            ✅ 支付成功！额度已到账，立即开始使用
          </div>
        )}

        {/* Tab pills */}
        <div style={{
          display: 'flex', gap: 4,
          background: 'rgba(0,0,0,0.04)',
          borderRadius: 12, padding: 4, marginBottom: 20,
        }}>
          {[
            { key: 'content', label: '月度套餐' },
            { key: 'ecommerce', label: '永久积分包' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                flex: 1, padding: '10px 0', border: 'none',
                background: tab === t.key ? '#fff' : 'transparent',
                borderRadius: 10, fontFamily: 'inherit',
                fontSize: 13, fontWeight: tab === t.key ? 900 : 600,
                color: tab === t.key ? 'var(--accent)' : 'var(--text-muted)',
                cursor: 'pointer',
                boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Pricing cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {plans.map((p, i) => {
            const colors = [
              'linear-gradient(135deg, #f59e0b, #f97316)',
              'linear-gradient(135deg, #6366f1, #8b5cf6)',
              'linear-gradient(135deg, #ec4899, #f43f5e)',
            ];
            return (
              <div key={i}
                onClick={() => buy(p)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: 18, borderRadius: 20,
                  border: p.pop ? '2px solid var(--accent)' : '1px solid var(--border)',
                  background: p.pop ? '#FAFAF9' : '#fff',
                  cursor: 'pointer', transition: 'all 0.15s',
                  position: 'relative',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = p.pop ? 'var(--accent)' : 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}>
                <span style={{
                  width: 44, height: 44, borderRadius: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: colors[i], flexShrink: 0,
                }}>
                  <Sparkles size={22} color="#fff" fill="#fff" />
                </span>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--accent)' }}>
                    {p.name}
                    {p.pop && (
                      <span style={{
                        fontSize: 9, fontWeight: 900, color: '#fff',
                        background: 'var(--accent)', padding: '2px 8px',
                        borderRadius: 6, marginLeft: 8, letterSpacing: 0.3,
                      }}>推荐</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {p.sets}套 · 每套{p.imgs} · 重生成{p.regen}次/套
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 1 }}>
                    约 ¥{p.per}/套
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--accent)', lineHeight: 1 }}>
                    ¥{p.price}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>/月</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Free trial */}
        <div style={{
          marginTop: 16, padding: '14px 16px', borderRadius: 16,
          background: 'linear-gradient(135deg, #F5F3FF, #EEF2FF)',
          border: '2px dashed #6366F1', textAlign: 'center',
        }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#4338CA', marginBottom: 2 }}>
            🎁 新用户免费体验 1 套
          </div>
          <div style={{ fontSize: 12, color: '#6366F1', marginBottom: 10, lineHeight: 1.5 }}>
            注册后免费使用一次。不收任何费用，无需绑定支付方式
          </div>
          <button onClick={() => {
            if (!state.logged) { dispatch({ type: 'SHOW_LOGIN', show: true }); return; }
            dispatch({ type: 'NAVIGATE', page: 'home' });
            if (tab === 'ecommerce') dispatch({ type: 'SET_MODE', mode: 'ecommerce' });
          }}
            style={{
              display: 'inline-block', padding: '8px 24px', borderRadius: 10,
              background: '#4338CA', color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit', border: 'none',
            }}>
            立即免费体验
          </button>
        </div>

        {/* Payment modal */}
        {payModal && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: 20,
          }} onClick={() => setPayModal(null)}>
            <div style={{
              background: '#fff', borderRadius: 20, maxWidth: 360,
              width: '100%', padding: 28, textAlign: 'center',
            }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--accent)', marginBottom: 4 }}>
                {payModal.name}
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>
                ¥{payModal.price} · {payModal.sets}套
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 14 }}>
                选择支付方式
              </div>
              <button onClick={() => createOrder('alipay')} disabled={payLoading}
                style={{
                  width: '100%', padding: '14px 0', borderRadius: 12,
                  border: '1px solid #1677FF', background: '#E6F4FF',
                  color: '#1677FF', fontSize: 15, fontWeight: 700,
                  cursor: payLoading ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', marginBottom: 10,
                }}>
                {payLoading ? '跳转支付中...' : '💰 支付宝支付'}
              </button>
              <button onClick={() => createOrder('wxpay')} disabled={payLoading}
                style={{
                  width: '100%', padding: '14px 0', borderRadius: 12,
                  border: '1px solid #07C160', background: '#F0FFF5',
                  color: '#07C160', fontSize: 15, fontWeight: 700,
                  cursor: payLoading ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                }}>
                💚 微信支付
              </button>
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 16, lineHeight: 1.5 }}>
                支付后将自动跳转回本站，额度实时到账<br />
                🔒 由 Stripe 安全支付，支持支付宝/微信
              </div>
            </div>
          </div>
        )}

        {/* FAQ */}
        <div style={{ maxWidth: 520, margin: '40px auto 0', textAlign: 'left' }}>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 16, textAlign: 'center', color: 'var(--accent)' }}>
            常见问题
          </div>
          {faqs.map((faq, i) => (
            <details key={i} style={{ borderBottom: '1px solid var(--border)', padding: '14px 0', fontSize: 14 }}>
              <summary style={{ fontWeight: 700, cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
                {faq.q}
              </summary>
              <p style={{ margin: '8px 0 0', color: 'var(--text-hint)', lineHeight: 1.7, fontSize: 13 }}>
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
