/**
 * 邮箱验证码服务
 * 使用 QQ 邮箱 SMTP 发送验证码
 *
 * 配置方式：
 * 1. 开启 QQ 邮箱 SMTP：https://service.mail.qq.com/detail/0/75
 * 2. 生成授权码：设置 → 账户 → 生成授权码
 * 3. 在 .env 中配置：
 *    MAIL_USER=你的QQ@qq.com
 *    MAIL_PASS=你的授权码（不是QQ密码）
 */

import nodemailer from 'nodemailer';

// 验证码存储（内存，重启清空）
const codeStore = new Map();

// 清理过期验证码（每 5 分钟）
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of codeStore) {
    if (now > val.expiresAt) codeStore.delete(key);
  }
}, 300000);

// 初始化邮件发送器（懒加载）
let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASS;
  if (!user || !pass) return null;
  transporter = nodemailer.createTransport({
    host: 'smtp.qq.com',
    port: 465,
    secure: true,
    auth: { user, pass },
  });
  return transporter;
}

// 生成随机验证码
function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 位数字
}

/**
 * 发送验证码到邮箱
 */
export async function sendVerificationCode(email) {
  const transport = getTransporter();
  if (!transport) {
    if (process.env.NODE_ENV === 'production') {
      const error = new Error('内测登录邮件尚未配置，请联系管理员');
      error.statusCode = 503;
      throw error;
    }
    console.warn('[mail] SMTP 未配置，使用 mock 模式');
    // 未配置时存储 mock 码 "123456"
    codeStore.set(email, { code: '123456', expiresAt: Date.now() + 300000 });
    return { mock: true };
  }

  // 频率限制：同邮箱 60 秒内只能发一次
  const existing = codeStore.get(email);
  if (existing && Date.now() < existing.nextSendAt) {
    throw new Error('请 60 秒后再试');
  }

  const code = generateCode();
  codeStore.set(email, {
    code,
    expiresAt: Date.now() + 300000, // 5 分钟过期
    nextSendAt: Date.now() + 60000,  // 60 秒重发限制
  });

  await transport.sendMail({
    from: `"薯包AI" <${process.env.MAIL_USER}>`,
    to: email,
    subject: '薯包AI 登录验证码',
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <div style="font-size: 24px; font-weight: 700; margin-bottom: 16px;">📱 薯包AI</div>
        <div style="color: #666; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
          你的登录验证码是：
        </div>
        <div style="font-size: 36px; font-weight: 800; letter-spacing: 8px; text-align: center;
             color: #e84142; background: #FFF5F5; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          ${code}
        </div>
        <div style="color: #999; font-size: 12px;">
          验证码 5 分钟内有效，请勿泄露给他人。
        </div>
      </div>
    `,
  });

  return { ok: true };
}

/**
 * 验证邮箱验证码
 */
export function verifyCode(email, code) {
  const stored = codeStore.get(email);
  if (!stored) return { ok: false, error: '验证码不存在或已过期' };
  if (Date.now() > stored.expiresAt) {
    codeStore.delete(email);
    return { ok: false, error: '验证码已过期' };
  }
  if (stored.code !== code) return { ok: false, error: '验证码错误' };
  codeStore.delete(email);
  return { ok: true, email };
}
