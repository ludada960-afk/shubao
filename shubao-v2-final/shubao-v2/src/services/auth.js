/**
 * 认证服务 - Supabase Auth 对接骨架
 *
 * 当前使用 localStorage 模拟，切换到 Supabase 只需：
 * 1. npm install @supabase/supabase-js
 * 2. 取消下面的注释，删除 mock 实现
 * 3. 在 .env 中配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY
 */

// ═══════ Supabase 真实实现（取消注释即可启用）═══════
//
// import { createClient } from '@supabase/supabase-js';
//
// const supabase = createClient(
//   import.meta.env.VITE_SUPABASE_URL,
//   import.meta.env.VITE_SUPABASE_ANON_KEY,
// );
//
// export async function sendOTP(phone) {
//   const { error } = await supabase.auth.signInWithOtp({ phone });
//   if (error) throw new Error(error.message);
//   return true;
// }
//
// export async function verifyOTP(phone, code) {
//   const { data, error } = await supabase.auth.verifyOtp({
//     phone, token: code, type: 'sms',
//   });
//   if (error) throw new Error(error.message);
//   return data.user;
// }
//
// export async function getSession() {
//   const { data } = await supabase.auth.getSession();
//   return data.session;
// }
//
// export async function signOut() {
//   await supabase.auth.signOut();
// }
//
// export function onAuthChange(callback) {
//   return supabase.auth.onAuthStateChange(callback);
// }

// ═══════ Mock 实现（当前使用）═══════

const STORAGE_KEY = 'sb-auth';

function getStored() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
}

export async function sendOTP(phone) {
  // Mock: 直接返回成功
  console.log('[auth-mock] 发送验证码到:', phone);
  return true;
}

export async function verifyOTP(phone, code) {
  // Mock: 任意验证码都通过
  const user = { id: 'mock-' + Date.now(), phone, nickname: '用户' + phone.slice(-4) };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  return user;
}

export async function getSession() {
  return getStored();
}

export async function signOut() {
  localStorage.removeItem(STORAGE_KEY);
}

export function onAuthChange(callback) {
  // Mock: 不支持实时监听
  return { unsubscribe: () => {} };
}
