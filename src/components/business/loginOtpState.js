export function createLoginOtpState() {
  return {
    email: '',
    code: '',
    step: 'email',
    resendAt: 0,
    hasActiveCode: false,
  };
}

export function remainingResendSeconds(resendAt, now = Date.now()) {
  return Math.max(0, Math.ceil((Number(resendAt || 0) - Number(now || 0)) / 1000));
}

export function loginOtpReducer(state, action) {
  const current = state || createLoginOtpState();
  switch (action?.type) {
    case 'SET_EMAIL':
      return { ...current, email: action.email || '' };
    case 'SET_CODE':
      return { ...current, code: String(action.code || '').slice(0, 6) };
    case 'CODE_SENT':
      return {
        ...current,
        code: '',
        step: 'code',
        hasActiveCode: true,
        resendAt: Number(action.now || Date.now()) + Number(action.cooldownMs || 60_000),
      };
    case 'EDIT_EMAIL':
      return { ...current, code: '', step: 'email' };
    case 'RETURN_TO_CODE':
      return current.hasActiveCode ? { ...current, code: '', step: 'code' } : current;
    case 'RESET':
      return createLoginOtpState();
    default:
      return current;
  }
}
