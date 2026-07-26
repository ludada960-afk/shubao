import React from 'react';
import styles from './Billing.module.css';
import { formatLedgerEntry } from './billingUiModel.js';

function displayDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-CN');
}

export default function BillingHistoryList({ entries = [], emptyText = '暂无积分记录' }) {
  return (
    <section className={styles.historyCard} aria-label="积分记录">
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.eyebrow}>账务流水</p>
          <h2 className={styles.sectionTitle}>积分记录</h2>
        </div>
      </div>
      {entries.length === 0 ? (
        <p className={styles.emptyText}>{emptyText}</p>
      ) : (
        <ul className={styles.historyList}>
          {entries.map((entry, index) => {
            const formatted = formatLedgerEntry(entry);
            return (
              <li className={styles.historyRow} key={entry.id || `${entry.eventType || 'entry'}-${index}`}>
                <div className={styles.historyCopy}>
                  <strong>{formatted.label}</strong>
                  <span>{displayDate(entry.createdAt)}</span>
                </div>
                <span className={`${styles.historyAmount} ${styles[`tone${formatted.tone}`]}`}>
                  {formatted.amount}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
