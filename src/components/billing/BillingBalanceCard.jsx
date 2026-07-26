import React from 'react';
import styles from './Billing.module.css';
import { formatBillingUnits } from './billingUiModel.js';

function BalanceValue({ units, currency, unlimited }) {
  if (unlimited) return '无限内测';
  const billingUnits = currency === 'ec_points' ? Number(units || 0) * 1000 : units;
  return formatBillingUnits(billingUnits, currency);
}

export default function BillingBalanceCard({
  ecommercePoints = 0,
  contentSets = 0,
  unlimited = false,
  insufficient = false,
  insufficientText = '当前余额不足，请补充额度后继续',
}) {
  return (
    <section className={styles.balanceCard} aria-label="账户余额">
      <div className={styles.balanceHeader}>
        <div>
          <p className={styles.eyebrow}>账户额度</p>
          <h2 className={styles.balanceTitle}>{unlimited ? '无限内测' : '可用额度'}</h2>
        </div>
        {unlimited && <span className={styles.unlimitedBadge}>无限内测</span>}
      </div>
      <div className={styles.balanceGrid}>
        <div className={styles.balanceItem}>
          <span className={styles.balanceLabel}>电商生图</span>
          <strong className={styles.balanceValue}>
            <BalanceValue units={ecommercePoints} currency="ec_points" unlimited={unlimited} />
          </strong>
        </div>
        <div className={styles.balanceItem}>
          <span className={styles.balanceLabel}>小红书 / Plog</span>
          <strong className={styles.balanceValue}>
            <BalanceValue units={contentSets} currency="content_sets" unlimited={unlimited} />
          </strong>
        </div>
      </div>
      {insufficient && !unlimited && (
        <p className={styles.insufficientHint} role="status">
          {insufficientText}
        </p>
      )}
    </section>
  );
}
