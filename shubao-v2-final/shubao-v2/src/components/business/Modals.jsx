import React, { useState } from 'react';
import { LogIn, Sparkles, Loader2 } from 'lucide-react';
import { Modal, CharImg } from '../ui/index';
import Button from '../ui/Button';
import { IMAGES } from '../../constants/images';
import { PRICING_XHS, PRICING_EC } from '../../constants/data';
import { useApp } from '../../store/AppContext';
import { sendOTP, verifyOTP } from '../../services/auth';
import { registerTrial } from '../../services/api';

/* ═══════ Login Modal ═══════ */
export function LoginModal() {
  const { state, dispatch } = useApp();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('phone'); // phone | code
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  if (!state.showLogin) return null;

  const close = () => { dispatch({ type: 'SHOW_LOGIN', show: false }); setStep('phone'); setErr(''); };

  const handleSendCode = async () => {
    if (!phone.trim() || phone.length < 11) { setErr('请输入正确的手机号'); return; }
    setLoading(true); setErr('');
    try {
      await sendOTP(phone);
      setStep('code');
    } catch (e) { setErr(e.message); }
    setLoading(false);
  };

  const handleVerify = async () => {
    if (!code.trim()) { setErr('请输入验证码'); return; }
    setLoading(true); setErr('');
    try {
      await verifyOTP(phone, code);
      // 注册免费预览额度
      const trial = await registerTrial(phone);
      dispatch({ type: 'SET_LOGGED', logged: true });
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
        placeholder="手机号"
        value={phone}
        onChange={e => setPhone(e.target.value)}
        maxLength={11}
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

      <Button primary full onClick={step === 'phone' ? handleSendCode : handleVerify} disabled={loading}>
        {loading ? <Loader2 size={15} className="animate-spin" /> : <LogIn size={15} />}
        {step === 'phone' ? ' 获取验证码' : ' 登录 / 注册'}
      </Button>

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

/* ═══════ Pricing Modal ═══════ */
export function PricingModal() {
  const { state, dispatch } = useApp();
  const [tab, setTab] = useState('content');

  if (!state.showPrice) return null;
  const close = () => dispatch({ type: 'SHOW_PRICE', show: false });
  const plans = tab === 'content' ? PRICING_XHS : PRICING_EC;

  return (
    <Modal onClose={close} width={440}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <CharImg src={IMAGES.upgrade} size={64} />
        <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', marginTop: 8 }}>
          选择套餐
        </div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-hint)' }}>
          按套购买，不自动续费
        </div>
      </div>

      {/* Tab */}
      <div style={{
        display: 'flex', gap: 0, margin: '0 auto 16px',
        border: '1px solid var(--border)', borderRadius: 'var(--radius-full)',
        width: 'fit-content', overflow: 'hidden',
      }}>
        {[
          { key: 'content', label: '📝 小红书图文' },
          { key: 'ecommerce', label: '🛍️ 电商图生成' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '7px 20px', fontSize: 'var(--text-sm)',
              fontWeight: tab === t.key ? 'var(--weight-semibold)' : 'var(--weight-normal)',
              color: tab === t.key ? '#fff' : 'var(--text-secondary)',
              background: tab === t.key ? 'var(--red)' : '#fff',
              border: 'none', fontFamily: 'inherit', cursor: 'pointer',
              transition: `all var(--duration-fast)`,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Plans */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {plans.map((p, i) => (
          <div
            key={i}
            onClick={() => {
              dispatch({ type: 'ADD_CREDITS', amount: p.sets });
              close();
            }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', borderRadius: 'var(--radius-lg)',
              border: p.pop ? '2px solid var(--red)' : '1px solid var(--border)',
              background: p.pop ? 'var(--red-bg)' : '#fff',
              cursor: 'pointer',
              transition: `all var(--duration-fast)`,
            }}
          >
            <div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)' }}>
                {p.name}
                {p.pop && (
                  <span style={{
                    fontSize: 9, color: '#fff', background: 'var(--red)',
                    padding: '2px 6px', borderRadius: 4, marginLeft: 6,
                  }}>推荐</span>
                )}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-hint)', marginTop: 2 }}>
                {p.sets}套 · {p.imgs} · 重生成{p.regen}次/套
              </div>
            </div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-heavy)', color: 'var(--red)' }}>
              ¥{p.price}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
