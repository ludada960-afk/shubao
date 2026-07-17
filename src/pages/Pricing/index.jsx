import React, { useState, useEffect } from 'react';
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
  const { state, dispatch, fetchCredits } = useApp();
  const [tab, setTab] = useState('content');
  const plans = tab === 'content' ? PRICING_XHS : PRICING_EC;
  const faqs = FAQ_CONTENT[tab];

  const [payModal, setPayModal] = useState(null);
  const [payUrl, setPayUrl] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [paidSuccess, setPaidSuccess] = useState(false);

  // 支付成功回调 ?paid=1
  useEffect(() => {
    if (window.location.search.includes('paid=1')) {
      setPaidSuccess(true);
      // 刷新额度
      if (state.logged && state.phone) fetchCredits(state.phone);
      // 清除 URL 参数
      window.history.replaceState({}, '', '/pricing');
      setTimeout(() => setPaidSuccess(false), 5000);
    }
  }, []);

  const buy = (p) => {
    if (!state.logged) { dispatch({ type: 'SHOW_LOGIN', show: true }); return; }
    setPayModal(p);
    setPayUrl('');
  };

  const createOrder = async (type) => {
    if (!payModal) return;
    setPayLoading(true);
    try {
      const r = await fetch('/api/create-payment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: (tab === 'content' ? '📝小红书图文-' : '🛍️电商图-') + payModal.name,
          type,
          email: state.phone,
          sets: payModal.sets,
          amount: payModal.price,
        }),
      });
      const d = await r.json();
      if (d.code === 1 && d.url) {
        // 跳转到 Stripe Checkout
        window.location.href = d.url;
      } else alert(d.error || '下单失败');
    } catch(e) { alert(e.message); }
    setPayLoading(false);
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

        {paidSuccess && (
          <div style={{ textAlign:'center', padding:'12px 20px', background:'#F0FFF4', border:'1px solid #68D391', borderRadius:12, marginBottom:20, fontSize:14, fontWeight:600, color:'#276749' }}>
            ✅ 支付成功！额度已到账，立即开始使用
          </div>
        )}

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

        <div style={{ maxWidth:500, margin:'32px auto 0', textAlign:'center', padding:'22px 20px', borderRadius:12, border:'2px dashed #6366F1', background:'linear-gradient(135deg,#F5F3FF,#EEF2FF)' }}>
          <div style={{ fontSize:17, fontWeight:700, color:'#4338CA', marginBottom:4 }}>🎁 新用户免费体验 1 套</div>
          <div style={{ fontSize:12, color:'#6366F1', marginBottom:14, lineHeight:1.6 }}>
            注册后免费使用一次。不收任何费用，无需绑定支付方式
          </div>
          <div onClick={() => {
            if (!state.logged) { dispatch({ type: 'SHOW_LOGIN', show: true }); return; }
            dispatch({ type: 'NAVIGATE', page: 'home' });
            if (tab === 'ecommerce') dispatch({ type: 'SET_MODE', mode: 'ecommerce' });
          }}
            style={{ display:'inline-block', padding:'9px 28px', borderRadius:8, background:'#4338CA', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
            立即免费体验
          </div>
        </div>

        <div style={{ textAlign:'center', marginTop:24, fontSize:12, color:'#999' }}>
          所有套餐一次性购买，不清零，不限时间
        </div>

        {payModal && (
          <div style={{ position:'fixed', inset:0, zIndex:99999, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
            onClick={() => { setPayModal(null); }}>
            <div style={{ background:'#fff', borderRadius:16, maxWidth:380, width:'100%', padding:24, textAlign:'center' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ fontSize:17, fontWeight:600, color:'#333', marginBottom:4 }}>{payModal.name}</div>
              <div style={{ fontSize:13, color:'#888', marginBottom:16 }}>¥{payModal.price} · {payModal.sets}套</div>

              <div>
                <div style={{ fontSize:14, fontWeight:500, color:'#555', marginBottom:14 }}>选择支付方式</div>
                <button onClick={() => createOrder('alipay')} disabled={payLoading}
                  style={{ width:'100%', padding:'14px 0', borderRadius:10, border:'1px solid #1677FF', background:'#E6F4FF', color:'#1677FF', fontSize:15, fontWeight:600, cursor: payLoading?'not-allowed':'pointer', fontFamily:'inherit', marginBottom:10 }}>
                  {payLoading ? '跳转支付中...' : '💰 支付宝支付'}
                </button>
                <button onClick={() => createOrder('wxpay')} disabled={payLoading}
                  style={{ width:'100%', padding:'14px 0', borderRadius:10, border:'1px solid #07C160', background:'#F0FFF5', color:'#07C160', fontSize:15, fontWeight:600, cursor: payLoading?'not-allowed':'pointer', fontFamily:'inherit' }}>
                  💚 微信支付
                </button>
              </div>

              <div style={{ fontSize:11, color:'#aaa', marginTop:16, lineHeight:1.5 }}>
                支付后将自动跳转回本站，额度实时到账<br/>
                🔒 由 Stripe 安全支付，支持支付宝/微信
              </div>
            </div>
          </div>
        )}

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
