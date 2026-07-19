import React, { useState, useEffect } from 'react';
import { MdLogin, MdAutoAwesome, MdAutorenew, MdClose } from 'react-icons/md';
import { Modal, CharImg } from '../ui/index';
import Button from '../ui/Button';
import { IMAGES } from '../../constants/images';
import { PRICING_XHS, PRICING_EC } from '../../constants/data';
import { useApp } from '../../store/AppContext';
import { sendOTP, verifyOTP } from '../../services/auth';
import { registerTrial } from '../../services/api';

/* ═══════ Login Modal ═══════ */
export function LoginModal() {
  const { state, dispatch, fetchCredits } = useApp();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('email'); // email | code
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [mockMode, setMockMode] = useState(false);

  if (!state.showLogin) return null;

  const close = () => { dispatch({ type: 'SHOW_LOGIN', show: false }); setStep('email'); setErr(''); };

  const handleSendCode = async () => {
    if (!email.trim() || !email.includes('@')) { setErr('请输入正确的邮箱地址'); return; }
    setLoading(true); setErr('');
    try {
      const result = await sendOTP(email.trim());
      setMockMode(!!result.mock);
      setStep('code');
    } catch (e) { setErr(e.message); }
    setLoading(false);
  };

  const handleVerify = async () => {
    if (!code.trim()) { setErr('请输入验证码'); return; }
    setLoading(true); setErr('');
    try {
      await verifyOTP(email.trim(), code.trim());
      dispatch({ type: 'SET_LOGGED', logged: true, phone: email.trim() });
      setTimeout(() => { fetchCredits(email.trim()); }, 100);
      close();
    } catch (e) { setErr(e.message); }
    setLoading(false);
  };

  return (
    <Modal onClose={close}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <CharImg src={IMAGES.wave} size={64} />
        <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', marginTop: 10 }}>
          登录薯包AI
        </div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-hint)', marginTop: 4 }}>
          AI 小红书内容创作 + 电商商品图生成
        </div>
      </div>

      {err && <div style={{
        background: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: 'var(--radius-md)',
        padding: '8px 14px', marginBottom: 12, fontSize: 'var(--text-sm)', color: '#C53030',
      }}>{err}</div>}

      <input
        placeholder="邮箱地址"
        value={email}
        onChange={e => setEmail(e.target.value)}
        disabled={step === 'code'}
        style={{
          width: '100%', padding: '12px 16px',
          border: '1.5px solid var(--border)', borderRadius: 'var(--radius-lg)',
          fontSize: 'var(--text-base)', marginBottom: 10,
          boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
          opacity: step === 'code' ? 0.6 : 1,
        }}
      />

      {step === 'code' ? (
        <input
          placeholder="验证码"
          value={code}
          onChange={e => setCode(e.target.value)}
          maxLength={6}
          autoFocus
          style={{
            width: '100%', padding: '12px 16px',
            border: '1.5px solid var(--border)', borderRadius: 'var(--radius-lg)',
            fontSize: 'var(--text-base)', marginBottom: 20,
            boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
          }}
        />
      ) : (
        <div style={{ height: 10 }} />
      )}

      <Button primary full onClick={step === 'email' ? handleSendCode : handleVerify} disabled={loading}>
        {loading ? <MdAutorenew size={15} className="animate-spin" /> : <MdLogin size={15} />}
        {step === 'email' ? ' 发送验证码' : ' 登录 / 注册'}
      </Button>

      {mockMode && step === 'code' && (
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <span style={{ fontSize: 'var(--text-xs)', color: '#999', background: '#f5f5f5', padding: '3px 10px', borderRadius: 4 }}>
            ⚡ mock 模式 · 验证码为 <strong>123456</strong>
          </span>
        </div>
      )}

      {step === 'code' && (
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-ghost)', cursor: 'pointer' }}
            onClick={() => setStep('phone')}>
            ← 换个手机号
          </span>
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: 12, fontSize: 'var(--text-xs)', color: 'var(--text-invisible)' }}>
        登录后可把作品保存到个人作品集
      </div>
    </Modal>
  );
}

/* ═══════ Pricing Modal (灵图风格) ═══════ */
export function PricingModal() {
  const { state, dispatch, fetchCredits } = useApp();
  const [tab, setTab] = useState('content');
  const [payModal, setPayModal] = useState(null);
  const [payLoading, setPayLoading] = useState(false);

  if (!state.showPrice) return null;
  const close = () => dispatch({ type: 'SHOW_PRICE', show: false });
  const plans = tab === 'content' ? PRICING_XHS : PRICING_EC;

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
    <>
      {/* Overlay */}
      <div onClick={close}
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          animation: 'fadeIn 0.15s ease',
        }} />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 9999,
        width: 'calc(100% - 32px)', maxWidth: 480,
        maxHeight: 'calc(100vh - 40px)',
        overflowY: 'auto',
        background: '#fff',
        borderRadius: 24,
        boxShadow: '0 28px 90px rgba(0,0,0,0.2)',
        padding: 28,
        animation: 'scaleIn 0.15s ease',
      }}>
        {/* Close button */}
        <button onClick={close}
          style={{
            position: 'absolute', top: 16, right: 16,
            width: 32, height: 32, borderRadius: '50%',
            border: 'none', background: '#f5f5f5',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#999', fontFamily: 'inherit',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#e0e0e0'; e.currentTarget.style.color = '#333'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#f5f5f5'; e.currentTarget.style.color = '#999'; }}>
          <MdClose size={16} />
        </button>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h3 style={{
            fontSize: 22, fontWeight: 900,
            color: 'var(--accent)',
            marginBottom: 4,
          }}>
            创作权益
          </h3>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>
            选择适合你的月度套餐
          </p>
        </div>

        {/* Tab pills */}
        <div style={{
          display: 'flex', gap: 4,
          background: 'rgba(0,0,0,0.04)',
          borderRadius: 12, padding: 4,
          marginBottom: 20,
        }}>
          {[
            { key: 'content', label: '月度套餐' },
            { key: 'ecommerce', label: '永久积分包' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                flex: 1, padding: '10px 0',
                border: 'none', background: tab === t.key ? '#fff' : 'transparent',
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
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: 16,
                  padding: 18,
                  borderRadius: 20,
                  border: p.pop ? '2px solid var(--accent)' : '1px solid var(--border)',
                  background: p.pop ? '#FAFAF9' : '#fff',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  position: 'relative',
                }}
                onClick={() => buy(p)}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = p.pop ? 'var(--accent)' : 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}>
                {/* Small gradient icon */}
                <span style={{
                  width: 44, height: 44, borderRadius: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: colors[i],
                  flexShrink: 0,
                }}>
                  <MdAutoAwesome size={22} color="#fff" fill="#fff" />
                </span>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--accent)' }}>
                    {p.name}
                    {p.pop && (
                      <span style={{
                        fontSize: 9, fontWeight: 900, color: '#fff',
                        background: 'var(--accent)',
                        padding: '2px 8px', borderRadius: 6, marginLeft: 8,
                        letterSpacing: 0.3,
                      }}>推荐</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, fontWeight: 500 }}>
                    {p.sets}套 · 每套{p.imgs} · 重生成{p.regen}次/套
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 1 }}>
                    约 ¥{p.per}/套
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{
                    fontSize: 26, fontWeight: 900,
                    color: 'var(--accent)',
                    lineHeight: 1,
                  }}>
                    ¥{p.price}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    /月
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Free trial */}
        <div style={{
          marginTop: 16,
          padding: '14px 16px',
          borderRadius: 16,
          background: 'linear-gradient(135deg, #F5F3FF, #EEF2FF)',
          border: '2px dashed #6366F1',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#4338CA', marginBottom: 2 }}>
            🎁 新用户免费体验 1 套
          </div>
          <div style={{ fontSize: 12, color: '#6366F1', marginBottom: 10, lineHeight: 1.5 }}>
            注册后免费使用一次。不收任何费用，无需绑定支付方式
          </div>
          <button onClick={() => {
            if (!state.logged) { dispatch({ type: 'SHOW_LOGIN', show: true }); return; }
            close();
            dispatch({ type: 'NAVIGATE', page: 'home' });
            if (tab === 'ecommerce') dispatch({ type: 'SET_MODE', mode: 'ecommerce' });
          }}
            style={{
              display: 'inline-block', padding: '8px 24px', borderRadius: 10,
              background: '#4338CA', color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit', border: 'none',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#3730A3'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#4338CA'; e.currentTarget.style.transform = 'none'; }}>
            立即免费体验
          </button>
        </div>
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
                transition: 'all 0.12s',
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

            <div style={{
              fontSize: 11, color: 'var(--text-faint)', marginTop: 16, lineHeight: 1.5,
            }}>
              支付后将自动跳转回本站，额度实时到账<br />
              🔒 由 Stripe 安全支付，支持支付宝/微信
            </div>
          </div>
        </div>
      )}
    </>
  );
}
