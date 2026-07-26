import React, { useMemo, useState } from 'react';
import { formatBillingUnits } from './billingUiModel.js';

function unitBalance(entitlement, currency) {
  if (entitlement?.unlimited) return Infinity;
  const value = currency === 'content_sets' ? entitlement?.contentSets : entitlement?.ecPoints;
  return Math.max(0, Number(value) || 0) * (currency === 'ec_points' ? 1000 : 1);
}

function enabledProviders(catalog) {
  const providers = catalog?.paymentProviders || catalog?.providers || [];
  return Array.isArray(providers) ? providers.filter(provider => provider?.enabled) : [];
}

export default function InsufficientBalanceModal({
  pendingAction,
  required = 0,
  available = 0,
  currency = 'ec_points',
  entitlement,
  catalog,
  onClose,
  onRefreshBalance,
  onResume,
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState('');
  const hasAuthoritativeQuote = required !== null && required !== undefined
    && available !== null && available !== undefined
    && Number.isFinite(Number(required)) && Number.isFinite(Number(available));
  const requiredUnits = hasAuthoritativeQuote ? Math.max(0, Number(required)) : 0;
  const displayedAvailable = hasAuthoritativeQuote ? Math.max(0, Number(available)) : 0;
  const shortfall = Math.max(0, requiredUnits - displayedAvailable);
  const providers = enabledProviders(catalog);
  const packages = useMemo(() => (catalog?.products || []).filter(product => product.currency === currency).slice(0, 3), [catalog, currency]);

  const refresh = async () => {
    setRefreshing(true);
    setNotice('');
    try {
      const updated = await onRefreshBalance?.();
      if (hasAuthoritativeQuote && unitBalance(updated, currency) >= requiredUnits) {
        setNotice('额度已满足，可以继续刚才的操作。');
      } else {
        setNotice('额度仍不足，当前工作会继续保留。');
      }
    } catch {
      setNotice('暂时无法刷新额度，当前工作已保留。');
    } finally {
      setRefreshing(false);
    }
  };

  const sufficient = hasAuthoritativeQuote && (entitlement?.unlimited || unitBalance(entitlement, currency) >= requiredUnits);

  return (
    <div role="dialog" aria-modal="true" aria-label="余额不足" style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(12,10,9,.48)' }}>
      <section style={{ position: 'relative', width: 'min(100%, 480px)', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', boxSizing: 'border-box', padding: 28, borderRadius: 24, background: '#fff', boxShadow: '0 28px 90px rgba(57,45,26,.24)' }}>
        <button aria-label="关闭余额不足提示" onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, border: 0, borderRadius: 999, width: 32, height: 32, cursor: 'pointer' }}>×</button>
        <h2 style={{ margin: 0, color: 'var(--text-primary, #1A1614)' }}>额度不足</h2>
        <p style={{ margin: '8px 0 18px', color: 'var(--text-muted, #6B6560)', lineHeight: 1.6 }}>当前图片、文字和设计方向都已保留。</p>

        <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: 0 }}>
          {[
            ['本次操作', hasAuthoritativeQuote ? formatBillingUnits(requiredUnits, currency) : '待确认'],
            ['当前余额', hasAuthoritativeQuote ? formatBillingUnits(displayedAvailable, currency) : '待确认'],
            ['还差', hasAuthoritativeQuote ? formatBillingUnits(shortfall, currency) : '待确认'],
          ].map(([label, value]) => <div key={label} style={{ padding: 12, borderRadius: 12, background: '#F5EFE4' }}><dt style={{ color: '#6B6560', fontSize: 12 }}>{label}</dt><dd style={{ margin: '5px 0 0', fontWeight: 700 }}>{value}</dd></div>)}
        </dl>

        <h3 style={{ margin: '22px 0 10px', fontSize: 15 }}>推荐套餐</h3>
        {packages.length ? <ul style={{ display: 'grid', gap: 8, margin: 0, padding: 0, listStyle: 'none' }}>{packages.map(product => <li key={product.sku} style={{ padding: 12, border: '1px solid #E7E5E4', borderRadius: 12 }}><strong>{formatBillingUnits(product.grantUnits, currency)}</strong><span style={{ float: 'right', color: '#6B6560' }}>¥{(Number(product.priceFen || 0) / 100).toFixed(2)}</span></li>)}</ul> : <p style={{ margin: 0, color: '#6B6560', fontSize: 13 }}>套餐信息加载中，请稍后刷新。</p>}

        {providers.length === 0 ? <p role="status" style={{ margin: '16px 0 0', padding: 12, borderRadius: 12, background: '#FFF7D6', color: '#7A5600', fontSize: 13 }}>支付通道暂未开放，暂不提供支付宝或微信支付。</p> : <p style={{ margin: '16px 0 0', color: '#6B6560', fontSize: 13 }}>请通过已启用的支付通道补充额度后刷新。</p>}
        {notice && <p role="status" style={{ margin: '12px 0 0', color: '#7A5600', fontSize: 13 }}>{notice}</p>}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={refresh} disabled={refreshing} style={{ flex: 1, minHeight: 42, border: '1px solid #1A1614', borderRadius: 12, background: '#fff', cursor: refreshing ? 'wait' : 'pointer' }}>{refreshing ? '正在刷新…' : '刷新余额'}</button>
          {sufficient && <button onClick={() => onResume?.(pendingAction)} style={{ flex: 1, minHeight: 42, border: 0, borderRadius: 12, background: '#1A1614', color: '#fff', cursor: 'pointer' }}>继续刚才的操作</button>}
        </div>
      </section>
    </div>
  );
}
