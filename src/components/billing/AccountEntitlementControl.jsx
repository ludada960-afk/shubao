import React from 'react';
import { Coins, Plus, RefreshCw } from 'lucide-react';
import { accountEntitlementDisplay } from './accountEntitlementModel.js';

export default function AccountEntitlementControl({
  logged = false,
  ecPoints = 0,
  unlimited = false,
  refreshStatus = 'ready',
  onRefresh,
  onPurchase,
  onLogin,
  compact = false,
}) {
  const display = accountEntitlementDisplay({ logged, ecPoints, unlimited, refreshStatus });
  const isRefreshing = display.state === 'refreshing';
  const refresh = () => Promise.resolve(onRefresh?.()).catch(() => {});
  const openAccount = () => {
    if (!logged) onLogin?.();
    else refresh();
  };

  return (
    <>
      <div className={`account-entitlement-control ${compact ? 'is-compact' : ''}`} data-state={display.state}>
      <button
        type="button"
        className="account-entitlement-value"
        onClick={openAccount}
        aria-label={logged ? `账户额度：${display.value}，点击刷新` : '登录后查看额度'}
        title={logged ? (display.state === 'error' ? '额度刷新失败，点击重试' : '点击刷新账户额度') : '登录后查看额度'}
      >
        <Coins size={15} aria-hidden="true" />
        <span className="account-entitlement-copy">
          {!compact && <small>{display.label}</small>}
          <strong>{display.value}</strong>
        </span>
      </button>
      {logged && (
        <button
          type="button"
          className="account-entitlement-refresh"
          onClick={refresh}
          disabled={isRefreshing}
          aria-label="刷新账户额度"
          title="刷新账户额度"
        >
          <RefreshCw size={14} className={isRefreshing ? 'is-spinning' : ''} />
        </button>
      )}
      <button type="button" className="account-entitlement-purchase" onClick={onPurchase} title="购买额度">
        <Plus size={14} aria-hidden="true" />购买额度
      </button>
      </div>
      <style>{`
        .account-entitlement-control { display: inline-flex; align-items: center; gap: 4px; min-width: 0; color: var(--text-secondary, #45413d); }
        .account-entitlement-control button { border: 0; font: inherit; cursor: pointer; }
        .account-entitlement-value { min-width: 0; display: inline-flex; align-items: center; gap: 6px; min-height: 38px; padding: 5px 9px; border-radius: 7px; background: rgba(255,255,255,.72); color: inherit; text-align: left; }
        .account-entitlement-value:hover { background: rgba(255,255,255,.98); }
        .account-entitlement-copy { min-width: 0; display: grid; gap: 1px; }
        .account-entitlement-copy small { color: var(--text-muted, #78716c); font-size: 10px; line-height: 1; }
        .account-entitlement-copy strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--accent, #1c1917); font-size: 12px; line-height: 1.2; }
        .account-entitlement-refresh { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; padding: 0; border-radius: 6px; background: transparent; color: var(--text-muted, #78716c); }
        .account-entitlement-refresh:hover:not(:disabled) { background: rgba(0,0,0,.06); color: var(--accent, #1c1917); }
        .account-entitlement-refresh:disabled { cursor: wait; opacity: .55; }
        .account-entitlement-purchase { display: inline-flex; align-items: center; justify-content: center; gap: 4px; min-height: 34px; padding: 0 10px; border-radius: 7px; background: var(--accent, #1c1917); color: #fff; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .account-entitlement-purchase:hover { background: #2b2622; }
        .account-entitlement-control[data-state="error"] .account-entitlement-value { color: #b54708; background: #fff7ed; }
        .account-entitlement-control .is-spinning { animation: account-entitlement-spin .8s linear infinite; }
        @keyframes account-entitlement-spin { to { transform: rotate(360deg); } }
        @media (max-width: 639px) {
          .topbar-actions .account-entitlement-control { gap: 2px; }
          .topbar-actions .account-entitlement-copy small,
          .topbar-actions .account-entitlement-refresh { display: none; }
          .topbar-actions .account-entitlement-value { min-height: 34px; padding: 4px 7px; }
          .topbar-actions .account-entitlement-purchase { width: 34px; min-height: 34px; padding: 0; font-size: 0; }
        }
      `}</style>
    </>
  );
}
