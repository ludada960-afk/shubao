import React from 'react';
import styles from './Billing.module.css';
import { formatBillingUnits } from './billingUiModel.js';

export default function BillingPriceBadge({ units = 0, currency = 'ec_points', compact = false }) {
  const label = formatBillingUnits(units, currency);
  return (
    <span
      className={`${styles.priceBadge} ${compact ? styles.priceBadgeCompact : ''}`}
      aria-label={`预计消耗 ${label}`}
    >
      {label}
    </span>
  );
}
