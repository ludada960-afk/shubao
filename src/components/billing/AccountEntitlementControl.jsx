import React from 'react';
import { Coins, ArrowUpRight } from 'lucide-react';
import { accountEntitlementDisplay } from './accountEntitlementModel.js';

export default function AccountEntitlementControl({
  logged = false,
  ecPoints = 0,
  unlimited = false,
  refreshStatus = 'ready',
  onPurchase,
  onLogin,
  onOpenMemberCenter,
  compact = false,
}) {
  const display = accountEntitlementDisplay({ logged, ecPoints, unlimited, refreshStatus });
  const openAccount = () => {
    if (!logged) onLogin?.();
    else onPurchase?.();
  };

  return (
    <>
      <div className={`account-entitlement-control ${compact ? 'is-compact' : ''}`} data-state={display.state}>
      <button
        type="button"
        className="account-entitlement-value"
        onClick={openAccount}
        aria-label={logged ? `AI 积分：${display.value}，点击充值额度` : '登录后查看额度'}
        title={logged ? '点击充值额度' : '登录后查看额度'}
      >
        <Coins size={15} aria-hidden="true" />
        <span className="account-entitlement-copy">
          {/* 2026-10-03 用户批注（第二次说同一件事，这次说清了要什么）：
              「206.4 上面不是有个 AI 积分吗，这个**保留**；
                然后 206.4 右边的 AI 积分几个字**去掉**，避免重复；
                高度跟原来一样，宽度适配紧一点…**首页和各个页面也全局去改**。」

              ⚠️ 上一轮（2026-10-02）我把这个 `<small>` 在 compact 下**藏起来**了 ——
                **方向反了**：该保留的是这行小字，该去掉的是数字后面那串。
                而那串的根源不在这个组件，在 `accountEntitlementModel`：
                原来 `value` 是 `"206.4 AI 积分"` 整串。已在那边改成只给数字。
              ⇒ 这里恢复成**始终**显示（不分 compact），
                 高度由 CSS 的 min-height 保持不变，宽度自然收紧。
                 语义一字不少：aria-label / title 里都写着「AI 积分」。 */}
          <small>AI 积分</small>
          <strong>{display.value}</strong>
        </span>
        {logged && <ArrowUpRight size={14} aria-hidden="true" className="account-entitlement-arrow" />}
      </button>
      </div>
      {logged && onOpenMemberCenter && (
        <button
          type="button"
          className="account-member-entry"
          onClick={onOpenMemberCenter}
          aria-label="打开会员中心"
          title="会员中心"
        >
          会员中心
        </button>
      )}
      <style>{`
        .account-entitlement-control { display: inline-flex; align-items: center; min-width: 0; color: var(--sb-neutral-0); }
        .account-entitlement-control button { border: 0; font: inherit; cursor: pointer; }
        .account-entitlement-value { min-width: 0; display: inline-flex; align-items: center; gap: 8; min-height: 40px; padding: 6px 10px; border: 1px solid rgba(255,255,255,.14) !important; border-radius: 8px; background: #17181c; color: inherit; text-align: left; box-shadow: 0 4px 14px rgba(20,22,28,.15); transition: background .15s, border-color .15s, transform .15s; }
        /* 2026-10-03：compact（画布顶栏那种横向空间紧张的地方）**只**收紧内边距与间距 ——
           用户原话：「**高度**还是要跟原来这样一样，但是宽度肯定就要适配紧一点了」。
           ⇒ 这里不再写 min-height（主态的 40px 就是全站高度）。 */
        .account-entitlement-control.is-compact .account-entitlement-value { gap: 5; padding: 4px 9px; }
        .account-entitlement-value:hover { background: var(--sb-neutral-900); border-color: rgba(255,255,255,.28) !important; transform: translateY(-1px); }
        .account-entitlement-value > svg:first-child { color: #f3c969; }
        /* 2026-10-03 用户批注：「你图标和积分之间要留点空间啊，然后整体适配上要再做一次调整，
   全部的这个积分按钮都要一起做调整」。
   之前 gap:1px 是把图标和「AI 积分 / 数字」两行挤在一起排的，
   去掉数字后面的重复单位之后行数没变、视觉上就更挤了。
   ⇒ 上下留 2px、图标与文字块之间由 .account-entitlement-value 的 gap 承担（8px）。 */
.account-entitlement-copy { min-width: 0; display: grid; gap: 2px; justify-items: end; }
        .account-entitlement-copy small { color: #aeb3bf; font-size: 10px; line-height: 1; }
        .account-member-entry { margin-left: 8px; min-height: 40px; padding: 6px 12px; border: 1px solid rgba(255,255,255,.14) !important; border-radius: 8px; background: #17181c; color: var(--sb-neutral-0); font-size: 12px; font-weight: 600; cursor: pointer; transition: background .15s, border-color .15s; }
        .account-member-entry:hover { background: var(--sb-neutral-900); border-color: rgba(255,255,255,.28) !important; }
        .account-entitlement-copy strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--sb-neutral-0); font-size: 12px; line-height: 1.2; }
        .account-entitlement-arrow { color: #aeb3bf; margin-left: 2px; }
        .account-entitlement-value:hover .account-entitlement-copy small { color: #d9dde7; }
        .account-entitlement-value:hover .account-entitlement-copy strong { color: var(--sb-neutral-0); }
        .account-entitlement-value:hover .account-entitlement-arrow { color: #d9dde7; }
        .account-entitlement-control[data-state="error"] .account-entitlement-value { border-color: #d99b53 !important; }
        @media (max-width: 639px) {
          .topbar-actions .account-entitlement-control { flex: 0 0 38px; }
          .topbar-actions .account-entitlement-copy { display: none; }
          .topbar-actions .account-entitlement-arrow { display: none; }
          .topbar-actions .account-entitlement-value {
            width: 38px;
            min-height: 38px;
            padding: 0;
            justify-content: center;
          }
        }
      `}</style>
    </>
  );
}
