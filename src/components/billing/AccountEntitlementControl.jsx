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
          <small>AI 积分</small>
          <strong>{display.value}</strong>
        </span>
        {logged && <ArrowUpRight size={14} aria-hidden="true" className="account-entitlement-arrow" />}
      </button>
      </div>
      <style>{`
        .account-entitlement-control { display: inline-flex; align-items: center; min-width: 0; color: #fff; }
        .account-entitlement-control button { border: 0; font: inherit; cursor: pointer; }
        .account-entitlement-value { min-width: 0; display: inline-flex; align-items: center; gap: 7px; min-height: 40px; padding: 6px 10px; border: 1px solid rgba(255,255,255,.14) !important; border-radius: 9px; background: #17181c; color: inherit; text-align: left; box-shadow: 0 4px 14px rgba(20,22,28,.15); transition: background .15s, border-color .15s, transform .15s; }
        .account-entitlement-value:hover { background: #24262d; border-color: rgba(255,255,255,.28) !important; transform: translateY(-1px); }
        .account-entitlement-value > svg:first-child { color: #f3c969; }
        .account-entitlement-copy { min-width: 0; display: grid; gap: 1px; }
        .account-entitlement-copy small { color: #aeb3bf; font-size: 10px; line-height: 1; }
        .account-entitlement-copy strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #fff; font-size: 12px; line-height: 1.2; }
        .account-entitlement-arrow { color: #aeb3bf; margin-left: 2px; }
        .account-entitlement-control[data-state="error"] .account-entitlement-value { border-color: #d99b53 !important; }
        @media (max-width: 639px) {
          .topbar-actions .account-entitlement-control { gap: 2px; }
          .topbar-actions .account-entitlement-copy small { display: none; }
          .topbar-actions .account-entitlement-value { min-height: 34px; padding: 4px 7px; }
        }
      `}</style>
    </>
  );
}
