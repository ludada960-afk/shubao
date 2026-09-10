import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Coins, Gift, Wand2, Loader2, CheckCircle2, AlertCircle, Receipt, ChevronDown } from 'lucide-react';

import { useApp } from '../../store/AppContext';
import { fetchSkillLibrary } from '../../services/skills.js';
import { redeemCode } from '../../services/redeem.js';
import { fetchBillingTransactions, fetchBillingRules } from '../../services/billing.js';
import SkillLibraryModal from './ec/SkillLibraryModal.jsx';
import { useModalScrollLock } from '../../components/ui/useModalScrollLock.js';
import './member-center.css';

/**
 * 会员中心（2026-09-10 P4；2026-09-10 二次改版）
 * - 移除"账户资料"（用户反馈无信息量）；积分明细改为中文交易视图 + 全站计费细则。
 * - 交易与细则均由服务端聚合生成（/api/billing/transactions 与 /api/billing/rules），
 *   前端不自造文案，保证与 SKU 目录永不漂移。
 */
export default function MemberCenterModal({ open, onClose }) {
  const { state, refreshBillingBalance } = useApp();
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [skills, setSkills] = useState([]);
  const [skillOpen, setSkillOpen] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [ruleGroups, setRuleGroups] = useState([]);
  const [rulesOpen, setRulesOpen] = useState(false);

  useModalScrollLock(open);

  const balance = useMemo(() => {
    if (state.unlimited) return '不限';
    const units = Number(state.ecPoints ?? state.credits ?? 0);
    return Number.isFinite(units) ? (units / 1000).toFixed(units % 1000 === 0 ? 0 : 1) : '0';
  }, [state.unlimited, state.ecPoints, state.credits]);

  const loadSkills = useCallback(async () => {
    try {
      const library = await fetchSkillLibrary({ kind: 'image' });
      setSkills(library.mine || []);
    } catch { setSkills([]); }
  }, []);

  const loadBilling = useCallback(async () => {
    try {
      const [tx, rules] = await Promise.all([
        fetchBillingTransactions({ limit: 12 }),
        fetchBillingRules(),
      ]);
      setTransactions(tx);
      setRuleGroups(rules);
    } catch { /* 明细加载失败不阻塞弹窗 */ }
  }, []);

  useEffect(() => {
    if (!open) return;
    setMessage(''); setError('');
    refreshBillingBalance?.({ force: true }).catch(() => {});
    loadSkills();
    loadBilling();
  }, [open, refreshBillingBalance, loadSkills, loadBilling]);

  const handleRedeem = async () => {
    const value = code.trim();
    if (!value || redeeming) return;
    setRedeeming(true); setError(''); setMessage('');
    try {
      const result = await redeemCode(value);
      setMessage(`兑换成功，+ ${result.units} AI 积分`);
      setCode('');
      refreshBillingBalance?.({ force: true }).catch(() => {});
      loadBilling();
    } catch (redeemError) {
      setError(redeemError?.message || '兑换失败');
    }
    setRedeeming(false);
  };

  if (!open) return null;

  return (
    <div className="member-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose?.(); }}>
      <div className="member-modal" role="dialog" aria-modal="true" aria-label="会员中心">
        <header className="member-head">
          <div>
            <strong>会员中心</strong>
            <span>积分、技能与兑换，集中管理</span>
          </div>
          <button type="button" className="member-icon-btn" onClick={onClose} aria-label="关闭会员中心"><X size={16} /></button>
        </header>

        <div className="member-body">
          <section className="member-card is-wide">
            <div className="member-card-title"><Coins size={14} /><strong>积分</strong><span className="member-card-sub">花在哪了，一目了然</span></div>
            <div className="member-balance-row">
              <div className="member-balance">{balance}<em>AI 积分</em></div>
              <button type="button" className="member-link" onClick={() => setRulesOpen(previous => !previous)} aria-expanded={rulesOpen}>
                <Receipt size={12} /> 计费细则 <ChevronDown size={12} className={rulesOpen ? 'is-open' : ''} />
              </button>
            </div>
            {rulesOpen && (
              <div className="member-rules">
                {ruleGroups.map(group => (
                  <div key={group.key} className="member-rule-group">
                    <strong>{group.label}</strong>
                    <ul>
                      {group.items.map(item => (
                        <li key={item.sku}>
                          <span>{item.label}</span>
                          <b>{(item.units / 1000).toLocaleString('zh-Hans-CN', { maximumFractionDigits: 1 })} 积分/{item.unit}</b>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
            <ul className="member-ledger">
              {transactions.map(entry => (
                <li key={entry.id}>
                  <span>{entry.label}{entry.detail ? <em className="member-ledger-sub">{entry.detail}</em> : null}</span>
                  <time>{String(entry.at || '').slice(5, 16).replace('T', ' ')}</time>
                  <b className={entry.amount >= 0 ? 'is-plus' : 'is-minus'}>
                    {entry.amount >= 0 ? '+' : ''}{(entry.amount / 1000).toLocaleString('zh-Hans-CN', { maximumFractionDigits: 1 })}
                  </b>
                </li>
              ))}
              {!transactions.length && <li className="member-empty">暂无积分明细</li>}
            </ul>
          </section>

          <section className="member-card">
            <div className="member-card-title"><Wand2 size={14} /><strong>我的技能</strong><button type="button" className="member-link" onClick={() => setSkillOpen(true)}>管理</button></div>
            <ul className="member-ledger">
              {skills.slice(0, 6).map(skill => (
                <li key={skill.id}><span>{skill.name}</span><b>v{skill.version}</b></li>
              ))}
              {!skills.length && <li className="member-empty">还没有自建技能</li>}
            </ul>
          </section>

          <section className="member-card">
            <div className="member-card-title"><Gift size={14} /><strong>兑换码</strong></div>
            <div className="member-redeem">
              <input
                value={code}
                placeholder="输入兑换码"
                onChange={event => { setCode(event.target.value.toUpperCase()); setError(''); }}
                onKeyDown={event => { if (event.key === 'Enter') handleRedeem(); }}
              />
              <button type="button" onClick={handleRedeem} disabled={!code.trim() || redeeming}>
                {redeeming ? <><Loader2 size={14} className="member-spin" /> 兑换中</> : '兑换'}
              </button>
            </div>
            {message && <p className="member-ok"><CheckCircle2 size={13} />{message}</p>}
            {error && <p className="member-err"><AlertCircle size={13} />{error}</p>}
          </section>
        </div>

        <SkillLibraryModal open={skillOpen} onClose={() => { setSkillOpen(false); loadSkills(); }} initialKind="image" />
      </div>
    </div>
  );
}
