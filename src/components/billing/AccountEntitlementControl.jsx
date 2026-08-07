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
      <button type="button" className="account-entitlement-purchase" onClick={onPurchase}>
        <Plus size={14} aria-hidden="true" />购买额度
      </button>
    </div>
  );
}
