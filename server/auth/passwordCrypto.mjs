/**
 * P1 认证底座 — 密码哈希（node:crypto scrypt，零新增依赖）
 *
 * 内存参数调优：N=2^14(16384), r=8, p=1, keylen=32 → 单次哈希约占 16 MiB，
 * 在低频登录/找回密码场景下对事件循环与常驻内存都安全。
 * 存储格式：scrypt$<N>$<r>$<p>$<salt-b64url>$<hash-b64url>
 */
import { scrypt as scryptCallback, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

export const SCRYPT_PARAMS = Object.freeze({ N: 16384, r: 8, p: 1, keylen: 32 });
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export function assertPasswordPolicy(password) {
  if (typeof password !== 'string'
    || password.length < PASSWORD_MIN_LENGTH
    || password.length > PASSWORD_MAX_LENGTH) {
    const error = new Error(`密码长度需为 ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} 位`);
    error.code = 'AUTH_PASSWORD_INVALID';
    throw error;
  }
  return password;
}

export async function hashPassword(password, { salt = randomBytes(16) } = {}) {
  assertPasswordPolicy(password);
  const derived = await scrypt(password.normalize('NFKC'), salt, SCRYPT_PARAMS.keylen, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
    maxmem: 64 * 1024 * 1024,
  });
  return [
    'scrypt',
    SCRYPT_PARAMS.N,
    SCRYPT_PARAMS.r,
    SCRYPT_PARAMS.p,
    salt.toString('base64url'),
    Buffer.from(derived).toString('base64url'),
  ].join('$');
}

export async function verifyPassword(password, storedHash) {
  if (typeof storedHash !== 'string') return false;
  const parts = storedHash.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, nRaw, rRaw, pRaw, saltRaw, hashRaw] = parts;
  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)
    || N < 16384 || N > 4194304 || r < 8 || r > 64 || p < 1 || p > 8) {
    return false;
  }
  let expected;
  let salt;
  try {
    expected = Buffer.from(hashRaw, 'base64url');
    salt = Buffer.from(saltRaw, 'base64url');
  } catch {
    return false;
  }
  if (expected.length < 16 || salt.length < 8) return false;
  let derived;
  try {
    derived = await scrypt(String(password ?? '').normalize('NFKC'), salt, expected.length, {
      N, r, p, maxmem: 128 * 1024 * 1024,
    });
  } catch {
    return false;
  }
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
