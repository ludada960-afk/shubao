import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { MdLogin, MdAutoAwesome, MdAutorenew, MdClose, MdLockOutline } from 'react-icons/md';
import { FaGithub } from 'react-icons/fa';
import { Modal, CharImg } from '../ui/index';
import Button from '../ui/Button';
import LoginDialog from './LoginDialog.jsx';
import OtpCodeInput from './OtpCodeInput.jsx';
import { AlertCircle, ArrowRight, CheckCircle2, Gift, Loader2, Lock, LogIn, Mail, MessageCircle, Smartphone } from 'lucide-react';
import '../../styles/login-dialog.css';
import { IMAGES } from '../../constants/images';
import { PRICING_PLANS } from '../../constants/data';
import { useApp } from '../../store/AppContext';
import {
  sendOTP,
  verifyOTP,
  fetchAuthProviders,
  beginOAuthLogin,
  forgotPassword,
} from '../../services/auth';
import InsufficientBalanceModal from '../billing/InsufficientBalanceModal.jsx';
import PricingModalRefactored from './PricingModal.jsx';
import '../../styles/pricing-modal.css';
import { resolvePendingActionCurrency } from '../../utils/generationAccess.js';
import BillingBalanceCard from '../billing/BillingBalanceCard.jsx';
import {
  buildPricingPlans,
  createPricingModalViewState,
  createOrderRequest,
  enabledPaymentProviders,
  formatPaymentProviderLabel,
  formatCatalogGrant,
  formatCatalogPrice,
  transitionPricingModalView,
} from '../billing/pricingCatalogModel.js';
import { createBillingOrder, fetchBillingOrder, waitForBillingOrder } from '../../services/billing.js';
import {
  clearPendingPaymentOrder,
  createPendingPaymentOrder,
  isTerminalPaymentOrderStatus,
  loadPendingPaymentOrder,
  savePendingPaymentOrder,
} from '../../utils/pendingPaymentOrder.js';
import { createLoginOtpState, loginOtpReducer, remainingResendSeconds } from './loginOtpState.js';

/* ═══════ Login Modal (2026-09-08 重构: 双栏品牌面板 + 分段 OTP + 登录/注册 Tab) ═══════ */
export function LoginModal() {
  const { state, dispatch, fetchCredits } = useApp();
  const [otp, updateOtp] = useReducer(loginOtpReducer, undefined, createLoginOtpState);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [now, setNow] = useState(Date.now());
  const [oauthProviders, setOauthProviders] = useState([]);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  /* 9-06 市场化: 邀请码注册通道 (UI 先行, 后端接入时随 verify 请求提交) + 协议勾选 */
  const [inviteCode, setInviteCode] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(true);
  const [termsInvalid, setTermsInvalid] = useState(false);
  /* 9-06 登录重构: 手机号/邮箱双通道 (手机号后端桩, 短信备案后接通) */
  const [loginChannel, setLoginChannel] = useState('email');
  const [authMode, setAuthMode] = useState('login');
  const [phone, setPhone] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [codeInvalid, setCodeInvalid] = useState(false);
  const { email, code, step } = otp;
  const resendSeconds = remainingResendSeconds(otp.resendAt, now);

  const close = useCallback(() => {
    dispatch({ type: 'SHOW_LOGIN', show: false });
    updateOtp({ type: 'RESET' });
    setLoading(false);
    setErr('');
    setForgotMode(false);
    setForgotEmail('');
    setForgotMsg('');
    setForgotLoading(false);
    setEmailTouched(false);
    setCodeInvalid(false);
    setTermsInvalid(false);
  }, [dispatch]);

  useEffect(() => {
    if (!state.showLogin || resendSeconds <= 0) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [state.showLogin, resendSeconds]);

  // P2：弹窗打开时拉取可用第三方登录方式（未配置凭据的服务端不返回对应按钮）。
  useEffect(() => {
    if (!state.showLogin) return undefined;
    let active = true;
    fetchAuthProviders()
      .then(list => { if (active) setOauthProviders(Array.isArray(list) ? list : []); })
      .catch(() => { if (active) setOauthProviders([]); });
    return () => { active = false; };
  }, [state.showLogin]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const emailInvalid = emailTouched && email.trim().length > 0 && !emailValid;
  const isRegister = authMode === 'register';
  const titleId = 'ld-login-title';

  if (!state.showLogin) return null;

  const handleGithubLogin = () => {
    beginOAuthLogin('github').catch(e => setErr(e?.message || 'GitHub 登录暂不可用'));
  };

  const handleForgotSubmit = async () => {
    if (!forgotEmail.trim() || !forgotEmail.includes('@')) {
      setForgotMsg('请输入正确的邮箱地址');
      return;
    }
    setForgotLoading(true);
    setForgotMsg('');
    try {
      await forgotPassword(forgotEmail.trim());
      setForgotMsg('如果该邮箱已注册，重置链接已发送，请前往邮箱查收。');
    } catch (e) {
      setForgotMsg(e?.message || '提交失败，请稍后再试');
    }
    setForgotLoading(false);
  };

  const handleSendCode = async () => {
    setEmailTouched(true);
    if (loginChannel === 'phone') { setErr('手机号通道备案中，请先用邮箱验证码登录'); return; }
    if (!emailValid) { setErr('请输入正确的邮箱地址'); return; }
    setLoading(true); setErr('');
    try {
      const result = await sendOTP(email.trim());
      updateOtp({
        type: 'CODE_SENT',
        now: Date.now(),
        cooldownMs: Math.max(0, result.retryAfterSeconds) * 1000,
      });
    } catch (e) {
      setErr(/failed to fetch/i.test(e?.message || '') ? '网络请求失败，请检查网络后重试（如果你在本地测试页面，请访问 shuimg.cn）' : e.message);
    }
    setLoading(false);
  };

  const handleEmailChange = (nextEmail) => {
    setErr('');
    updateOtp(step === 'code'
      ? { type: 'BEGIN_LOGIN', email: nextEmail }
      : { type: 'SET_EMAIL', email: nextEmail });
  };

  const handleVerify = async () => {
    if (!agreedTerms) {
      setTermsInvalid(true);
      setErr('请先阅读并勾选同意《用户服务协议》和《隐私政策》');
      return;
    }
    if (code.trim().length < 6) {
      setCodeInvalid(true);
      setErr('请输入 6 位验证码');
      return;
    }
    setLoading(true); setErr('');
    try {
      const user = await verifyOTP(email.trim(), code.trim());
      dispatch({ type: 'SET_LOGGED', logged: true, phone: user.email });
      setTimeout(() => { fetchCredits(user.email); }, 100);
      if (state.loginIntent?.destination) {
        if (state.loginIntent.canvasTab) dispatch({ type: 'OPEN_CANVAS', tab: state.loginIntent.canvasTab });
        else dispatch({ type: 'NAVIGATE', page: state.loginIntent.destination });
        dispatch({ type: 'SET_LOGIN_INTENT', intent: null });
      }
      close();
    } catch (e) {
      setCodeInvalid(true);
      setErr(/failed to fetch/i.test(e?.message || '') ? '网络请求失败，请检查网络后重试（如果你在本地测试页面，请访问 shuimg.cn）' : e.message);
    }
    setLoading(false);
  };

  // ── P2：忘记密码子流程（输邮箱 → forgot-password，响应恒定防枚举）──
  if (forgotMode) {
    return (
      <LoginDialog onClose={close} labelledBy={titleId}>
        <div>
          <span className="ld-eyebrow">账号恢复</span>
          <h2 className="ld-title" id={titleId}>找回密码</h2>
          <p className="ld-desc">输入注册邮箱，我们会发送一封重置链接邮件。</p>
        </div>

        {err && <div className="ld-alert" role="alert"><AlertCircle size={15} /><span>{err}</span></div>}

        <div className="ld-field">
          <span className="ld-field-label"><span>邮箱</span></span>
          <span className="ld-input-wrap">
            <span className="ld-input-icon"><Mail size={17} /></span>
            <input
              id="ld-forgot-email"
              className="ld-input"
              type="email"
              placeholder="邮箱地址"
              autoComplete="email"
              autoFocus
              value={forgotEmail}
              onChange={e => setForgotEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleForgotSubmit(); }}
            />
          </span>
        </div>

        <button type="button" className={'ld-cta' + (forgotLoading ? ' is-busy' : '')} onClick={handleForgotSubmit} disabled={forgotLoading}>
          {forgotLoading ? <><Loader2 size={16} className="ld-spin" /> 发送中…</> : <>发送重置链接 <ArrowRight size={16} /></>}
        </button>

        {forgotMsg && (
          <div className="ld-alert" role="status" style={{ background: '#f0f9f2', borderColor: '#cfe9d6', color: '#2f6b41' }}>
            <CheckCircle2 size={15} /><span>{forgotMsg}</span>
          </div>
        )}

        <div className="ld-actions-row" style={{ justifyContent: 'center' }}>
          <button type="button" className="ld-ghost-link" onClick={() => { setForgotMode(false); setForgotMsg(''); setErr(''); }}>
            返回登录
          </button>
        </div>
        <div className="ld-foot"><Lock size={12} /><span>为防账号枚举，无论邮箱是否注册都会返回相同提示</span></div>
      </LoginDialog>
    );
  }

  return (
    <LoginDialog onClose={close} labelledBy={titleId}>
      <div>
        <span className="ld-eyebrow">{isRegister ? '新用户注册' : '账号登录'}</span>
        <h2 className="ld-title" id={titleId}>{isRegister ? '创建你的创作账号' : '欢迎回来'}</h2>
        <p className="ld-desc">
          {isRegister ? '验证邮箱即完成注册，不需要设置密码。' : '验证邮箱后即可继续创作，全程免密码。'}
        </p>
      </div>

      {/* 登录 / 注册 主 Tab */}
      <div className="ld-tabs" role="tablist" aria-label="登录或注册">
        {[['login', '登录'], ['register', '注册']].map(([id, name]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={authMode === id}
            className={'ld-tab' + (authMode === id ? ' is-active' : '')}
            onClick={() => { setAuthMode(id); setErr(''); if (id === 'register') setInviteOpen(true); }}
          >
            {name}
          </button>
        ))}
      </div>

      {/* 通道切换: 邮箱 / 手机号 */}
      <div className="ld-channels">
        <button
          type="button"
          className={'ld-channel' + (loginChannel === 'email' ? ' is-active' : '')}
          aria-pressed={loginChannel === 'email'}
          onClick={() => { setLoginChannel('email'); setErr(''); }}
        >
          <Mail size={14} /> 邮箱验证码
        </button>
        <button
          type="button"
          className={'ld-channel' + (loginChannel === 'phone' ? ' is-active' : '')}
          aria-pressed={loginChannel === 'phone'}
          onClick={() => { setLoginChannel('phone'); setErr(''); }}
        >
          <Smartphone size={14} /> 手机号
        </button>
      </div>

      {err && <div className="ld-alert" role="alert"><AlertCircle size={15} /><span>{err}</span></div>}

      {loginChannel === 'phone' ? (
        <div className="ld-stub">
          <strong>手机号通道正在备案</strong>
          <p>短信签名与通道备案通过后即可开通。当前请先用邮箱验证码登录，功能完全一致。</p>
          <span className="ld-input-wrap">
            <span className="ld-input-icon"><Smartphone size={17} /></span>
            <input
              className="ld-input"
              type="tel"
              inputMode="tel"
              placeholder="手机号通道备案中"
              value={phone}
              disabled
              onChange={e => setPhone(e.target.value)}
            />
          </span>
          <button type="button" className="ld-cta" onClick={() => { setLoginChannel('email'); setErr(''); }}>
            先用邮箱登录 <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        <>
          <div className="ld-field">
            <span className="ld-field-label">
              <span>邮箱</span>
              {step === 'code' && <small>验证码已发送</small>}
            </span>
            <span className="ld-input-wrap">
              <span className="ld-input-icon"><Mail size={17} /></span>
              <input
                placeholder="邮箱地址"
                autoFocus
                id="ld-email"
                className={'ld-input' + (emailInvalid ? ' is-invalid' : '')}
                type="email"
                autoComplete="email"
                inputMode="email"
                spellCheck={false}
                value={email}
                disabled={step === 'code'}
                aria-invalid={emailInvalid || undefined}
                aria-describedby="ld-email-hint"
                onChange={e => handleEmailChange(e.target.value)}
                onBlur={() => setEmailTouched(true)}
                onKeyDown={e => { if (e.key === 'Enter') { if (step === 'email') handleSendCode(); else handleVerify(); } }}
              />
              {step === 'code' && (
                <span className="ld-input-suffix">
                  <button type="button" className="ld-inline-action" onClick={() => updateOtp({ type: 'BEGIN_LOGIN', email })}>
                    修改邮箱
                  </button>
                </span>
              )}
            </span>
            <span className={'ld-hint' + (emailInvalid ? ' is-invalid' : (emailValid && step === 'email' ? ' is-valid' : ''))} id="ld-email-hint">
              {emailInvalid
                ? '邮箱格式不正确，请检查后重试'
                : step === 'code'
                  ? `验证码已发送至 ${email}，10 分钟内有效`
                  : '我们只发送一次性验证码，不保存密码'}
            </span>
          </div>

          {step === 'email' && otp.hasActiveCode && (
            <div className="ld-actions-row" style={{ justifyContent: 'flex-start' }}>
              <button type="button" className="ld-ghost-link" onClick={() => updateOtp({ type: 'RETURN_TO_CODE' })}>
                返回填写已发送的验证码
              </button>
            </div>
          )}

          {step === 'code' && (
            <div className="ld-field">
              <span className="ld-field-label">
                <span>验证码</span>
                <small>{resendSeconds > 0 ? `${resendSeconds}s 后可重发` : '可重新发送'}</small>
              </span>
              <OtpCodeInput
                value={code}
                onChange={next => { setCodeInvalid(false); updateOtp({ type: 'SET_CODE', code: next }); }}
                onComplete={() => { if (!loading) handleVerify(); }}
                onEnter={handleVerify}
                autoFocus
                disabled={loading}
                invalid={codeInvalid}
                label="邮箱验证码"
                describedBy="ld-email-hint"
              />
              <span className="ld-actions-row">
                <button
                  type="button"
                  className="ld-ghost-link"
                  onClick={resendSeconds > 0 || loading ? undefined : handleSendCode}
                  disabled={resendSeconds > 0 || loading}
                  style={{ color: resendSeconds > 0 ? '#a8a29c' : undefined, textDecoration: 'none', cursor: resendSeconds > 0 ? 'default' : 'pointer' }}
                >
                  {resendSeconds > 0 ? `重新发送（${resendSeconds}s）` : '重新发送验证码'}
                </button>
                <button type="button" className="ld-ghost-link" onClick={() => { setForgotMode(true); setErr(''); }}>
                  收不到验证码？
                </button>
              </span>
            </div>
          )}

          {step === 'code' && !inviteOpen && (
            <button type="button" className="ld-invite-toggle" onClick={() => setInviteOpen(true)}>
              <Gift size={14} /> 有邀请码？点这里填写
            </button>
          )}
          {(inviteOpen || isRegister) && (
            <div className="ld-field ld-invite">
              <span className="ld-field-label"><span>邀请码</span><small>选填</small></span>
              <span className="ld-input-wrap">
                <span className="ld-input-icon"><Gift size={17} /></span>
                <input
                  className="ld-input"
                  type="text"
                  placeholder="邀请码（选填）"
                  autoComplete="off"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value)}
                />
              </span>
            </div>
          )}
        </>
      )}

      {loginChannel === 'email' && (
        <button
          type="button"
          className={'ld-cta' + (loading ? ' is-busy' : '')}
          onClick={step === 'email' ? handleSendCode : handleVerify}
          disabled={loading}
        >
          {loading
            ? <><Loader2 size={16} className="ld-spin" /> {step === 'email' ? '发送中…' : '登录中…'}</>
            : step === 'email'
              ? <>{isRegister ? '获取注册验证码' : '获取验证码'} <ArrowRight size={16} /></>
              : <><LogIn size={16} /> {isRegister ? '注册并登录' : '登录 / 注册'}</>}
        </button>
      )}

      {/* 第三方登录 (微信为占位通道; GitHub 由服务端凭据决定是否返回) */}
      <div className="ld-divider">或</div>
      <div className="ld-oauth">
        <button type="button" className="ld-oauth-btn is-wechat" onClick={() => setErr('微信登录正在接入，即将开放')}>
          <MessageCircle size={17} /> 微信登录
        </button>
        {oauthProviders.some(provider => provider.id === 'github') && (
          <button type="button" className="ld-oauth-btn" onClick={handleGithubLogin}>
            <FaGithub size={16} /> GitHub
          </button>
        )}
      </div>

      {/* 服务条款 / 隐私政策 (ICP 备案必需; /terms /privacy 页面已上线) */}
      <label className={'ld-terms' + (termsInvalid ? ' is-invalid' : '')}>
        <input
          type="checkbox"
          checked={agreedTerms}
          onChange={e => { setAgreedTerms(e.target.checked); if (e.target.checked) setTermsInvalid(false); }}
        />
        <span>
          我已阅读并同意
          <a href="/terms" target="_blank" rel="noreferrer">《用户服务协议》</a>和
          <a href="/privacy" target="_blank" rel="noreferrer">《隐私政策》</a>
        </span>
      </label>

      <div className="ld-foot">
        <Lock size={12} />
        <span>登录后作品自动保存到个人作品集 · <a href="/">先逛逛首页</a></span>
      </div>
    </LoginDialog>
  );
}

// 4c183cd4 续命 P-Canvas 主线程亲自救 (1f64aa42 后): App.jsx 还在 `import { LoginModal, PricingModal }` + `<PricingModal />`,
// 1f64aa42 删了老 PricingModalLegacy 函数但没补 export, 这里重命名 Modals 函数为 PricingModal 让 App.jsx 仍能 <PricingModal />
export function PricingModal() {
  const { state, dispatch, refreshBillingBalance } = useApp();
  if (!state.showPrice) return null;
  // 4c183cd4 续命 8-30 主线程真浏览器截图验证修复: 之前参数顺序错 (PRICING_PLANS 当 catalog, billingCatalog 当 metadata), buildPricingPlans 的 catalog 是产品列表 (priceFen/grantUnits/validityDays), metadata 是 fallback (sku/name/desc/pop), 反过来才对. 而且 currency 必须传 primaryCurrency, 否则 validCatalogProduct 拒绝所有 product. 修后 4 档套餐 (基础/专业/团队/工作室) + 2 个月卡礼包 会渲染.
  const plans = useMemo(() => buildPricingPlans(state.billingCatalog || null, PRICING_PLANS, state.billingCatalog?.billing?.primaryCurrency), [state.billingCatalog]);
  const providers = useMemo(() => enabledPaymentProviders(state.billingCatalog || []), [state.billingCatalog]);
  const [payModal, setPayModal] = useState(null);
  const [payLoading, setPayLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('');
  const [paymentOrder, setPaymentOrder] = useState(null);
  // 4c183cd4 续命 P-Modals (主线程亲自补 1f64aa42 + 07741c29 + b515a6b2 漏的 4c183cd4 时代老 PricingModalLegacy 状态):
  // 4c183cd4 老函数里 useRef 4 个 + useState 1 个 + 若干事件 handler (close / closePayment / createOrder) 都漏了
  // 当前简化 07741c29 版本只用 modalView 的 setter (PricingModalRefactored.onClose 调 transitionPricingModalView)
  // paymentAbortRef / paymentKeysRef / paymentCheckoutRef / restoredPaymentKeyRef 在简化版里没有引用, 不加 (避免死代码)
  // close / closePayment / createOrder 在 JSX 里直接用, 必须声明
  const [modalView, setModalView] = useState(() => createPricingModalViewState({
    interrupted: state.priceReason === 'INSUFFICIENT_CREDITS',
    pendingAction: state.pendingPaidAction,
    priceReason: state.priceReason,
  }));
  // 8-31 恢复 InsufficientBalanceModal 渲染: 积分不足时保留创作, 充值/刷新后返回继续。
  const pendingAction = modalView.pendingAction;
  const close = () => dispatch({ type: 'SHOW_PRICE', show: false });
  const closePayment = () => {
    setPayModal(null);
  };
  const createOrder = async (provider) => {
    if (!payModal) return;
    setPayLoading(true);
    setPaymentStatus('');
    try {
      const requestKey = `${payModal.sku}:${provider.id}`;
      const idempotencyKey = createOrderRequest({ productSku: payModal.sku, provider: provider.id }).idempotencyKey;
      const response = await createBillingOrder(createOrderRequest({
        productSku: payModal.sku,
        provider: provider.id,
        idempotencyKey,
      }));
      const order = response?.order || response;
      setPaymentOrder(order);
      if (isTerminalPaymentOrderStatus(order?.status)) {
        clearPendingPaymentOrder();
      } else if (state.phone) {
        savePendingPaymentOrder(createPendingPaymentOrder({
          ownerEmail: state.phone,
          orderId: order.id,
          productSku: payModal.sku,
          provider: provider.id,
          idempotencyKey,
          status: order.status || 'pending',
          checkout: order?.checkout,
        }));
      }
      setPaymentStatus(order?.status === 'credited'
        ? '支付已到账,当前工作已保留,关闭窗口即可继续创作。'
        : '订单已创建,请在 5 分钟内完成支付;关闭此窗口当前工作仍会保留。');
    } catch (error) {
      if (error?.name !== 'AbortError') {
        setPaymentStatus('订单创建失败,请稍后重试或换一种支付方式。');
      }
    } finally {
      setPayLoading(false);
    }
  };
  const buy = (plan) => {
    if (!state.logged) { dispatch({ type: 'SHOW_LOGIN', show: true }); return; }
    setPaymentStatus('');
    setPaymentOrder(null);
    setPayModal(plan);
  };
  return (
    <>
      {/* Overlay */}
      <div onClick={close}
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(15, 23, 42, 0.45)',
        }} />

      {/* Modal - 外层 shell 只负责居中定位 + 滚容器, 不设样式 (避免双层) */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 9999,
        maxHeight: 'calc(100vh - 40px)',
        overflowY: 'auto',
        overflowX: 'hidden',
        scrollbarWidth: 'none',
        animation: 'scaleIn 0.15s ease',
      }} className="pricing-modal-scroll-shell">
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

          {/* 4c183cd4 续命 PricingModal (4 视角重构 - 替代 4c183cd4 时代 inline style) */}
          {/* 4c183cd4 续命 P-Modals (主线程亲自加 4c183cd4 时代 1af0762d0 漏的 show prop 透传): 外层 L312 已守 state.showPrice, 这里再透传给 PricingModalRefactored 作为第二层保险 */}
          <PricingModalRefactored
            show={state.showPrice}
            plans={plans}
            providers={providers}
            onBuy={buy}
            onClose={() => { setModalView(current => transitionPricingModalView(current, 'CANCEL')); close(); }}
            isLogged={state.logged}
            ecPoints={state.ecPoints}
            ecPointsExpiring={state.ecPointsExpiring}
            ecPointsExpiresAt={state.ecPointsExpiresAt}
            unlimited={state.unlimited}
          />

          {/* 8-31 恢复 InsufficientBalanceModal: 积分不足时工作已保留, 充值/刷新后返回继续创作.
              由 OPEN_PAYWALL / RESTORE_PENDING_PAID_ACTION 带入的 pendingAction 驱动. */}
          {modalView.mode === 'insufficient' && pendingAction && (
            <InsufficientBalanceModal
              pendingAction={pendingAction}
              required={pendingAction?.billing?.required}
              available={pendingAction?.billing?.available}
              currency={resolvePendingActionCurrency({
                currency: state.billingCatalog?.billing?.primaryCurrency,
                action: pendingAction?.action,
                source: pendingAction?.source,
              })}
              entitlement={{ ecPoints: state.ecPoints, contentSets: state.contentSets, unlimited: state.unlimited }}
              catalog={state.billingCatalog}
              onClose={close}
              onRefreshBalance={async () => {
                const ent = await refreshBillingBalance();
                return ent || null;
              }}
              onResume={close}
              onViewPlans={() => setModalView(current => transitionPricingModalView(current, 'VIEW_PLANS'))}
            />
          )}
      </div>

      {/* Payment modal */}
      {payModal && (providers.length > 0 || paymentOrder) && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: 20,
        }} onClick={closePayment}>
          <div style={{
            background: '#fff', borderRadius: 20, maxWidth: 360,
            width: '100%', padding: 28, textAlign: 'center',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--accent)', marginBottom: 4 }}>
              {payModal.name}
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>
              ¥{formatCatalogPrice(payModal.priceFen)} · {formatCatalogGrant(payModal)}
            </div>

            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 14 }}>
              选择支付方式
            </div>

            {providers.length > 0 ? <div style={{ display: 'grid', gap: 10 }}>
              {providers.map(provider => (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => createOrder(provider)}
                  disabled={payLoading || paymentOrder?.status === 'pending' || paymentOrder?.status === 'paid'}
                  style={{ width: '100%', padding: '12px 0', borderRadius: 12, border: 0, background: '#1f2937', color: '#fff', fontSize: 13, fontWeight: 800, cursor: payLoading ? 'wait' : 'pointer' }}
                >
                  {payLoading ? '正在创建安全订单…' : `使用 ${formatPaymentProviderLabel(provider.id)}`}
                </button>
              ))}
            </div> : <div role="status" style={{ padding: 10, borderRadius: 10, background: 'var(--accent-bg)', color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.6 }}>
              微信支付 / 支付宝 通道已配置；订单通过扫码完成，3-5 秒内自动入账。
            </div>}

            <div style={{
              fontSize: 11, color: 'var(--text-faint)', marginTop: 16, lineHeight: 1.5,
            }}>
              完成购买后会自动刷新额度，关闭此窗口即可回到刚才的创作位置。
            </div>

            {paymentOrder?.checkout?.url && (
              <button type="button" onClick={() => window.open(paymentOrder.checkout.url, '_blank', 'noopener,noreferrer')} style={{ marginTop: 12, width: '100%', minHeight: 40, border: '1px solid #1A1614', borderRadius: 10, background: '#fff', color: '#1A1614', cursor: 'pointer', fontWeight: 700 }}>
                重新打开支付页
              </button>
            )}

            {paymentStatus && <div style={{ marginTop: 12, fontSize: 12, lineHeight: 1.5, color: '#73510D', background: '#FFF8E7', borderRadius: 10, padding: 10 }}>{paymentStatus}</div>}
          </div>
        </div>
      )}
    </>
  );
}