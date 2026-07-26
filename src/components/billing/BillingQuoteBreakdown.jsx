import React from 'react';
import styles from './Billing.module.css';
import { formatBillingUnits } from './billingUiModel.js';

export default function BillingQuoteBreakdown({ items = [], totalUnits = 0, currency = 'ec_points' }) {
  return (
    <section className={styles.quoteCard} aria-label="本次报价">
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.eyebrow}>本次报价</p>
          <h2 className={styles.sectionTitle}>预计消耗</h2>
        </div>
        <strong className={styles.quoteTotal}>{formatBillingUnits(totalUnits, currency)}</strong>
      </div>
      {items.length > 0 ? (
        <ul className={styles.quoteList}>
          {items.map((item, index) => (
            <li className={styles.quoteRow} key={item.id || item.key || `${item.label || 'item'}-${index}`}>
              <span>{item.label || item.name || '收费项目'}</span>
              <span>{formatBillingUnits(item.units ?? 0, currency)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.mutedText}>暂无收费项目</p>
      )}
    </section>
  );
}
