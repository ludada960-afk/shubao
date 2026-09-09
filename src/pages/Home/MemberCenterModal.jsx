import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Coins, Gift, Wand2, ShieldCheck, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

import { useApp } from '../../store/AppContext';
import { fetchSkillLibrary } from '../../services/skills.js';
import { redeemCode } from '../../services/redeem.js';
import SkillLibraryModal from './ec/SkillLibraryModal.jsx';
import './member-center.css';

/**
 * 会员中心（2026-09-10 P4）
 * 把分散的个人资产收进一个地方：账号资料 / 积分与明细 / 我的技能 / 兑换码 / 安全。
 * 只读展示 + 兑换码写入；不重复实现已存在的账务与改密流程，直接复用 AppContext。
 */
export default function MemberCenterModal({ open, onClose }) {
  const { state, refreshBillingLedger, refreshBillingBalance } = useApp();
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [skills, setSkills] = useState([]);
  const [skillOpen, setSkillOpen] = useState(false);

  const email = state.phone || '';
  const balance = useMemo(() => {
    if (state.unlimited) return '不限';
    const units = Number(state.ecPoints ?? state.credits ?? 0);
    return Number.isFinite(units) ? String(units) : '0';
  }, [state.unlimited, state.ecPoints, state.credits]);
  const ledger = Array.isArray(state.billingLedger) ? state.billingLedger.slice(0, 8) : [];

  const loadSkills = useCallback(async () => {
    try {
      const library = await fetchSkillLibrary({ kind: 'image' });
      setSkills(library.mine || []);
    } catch { setSkills([]); }
  }, []);

  useEffect(() => {
    if (!open) return;
    setMessage(''); setError('');
    refreshBillingBalance?.({ force: true }).catch(() => {});
    refreshBillingLedger?.({ limit: 8 }).catch(() => {});
    loadSkills();
  }, [open, refreshBillingBalance, refreshBillingLedger, loadSkills]);

  const handleRedeem = async () => {
    const value = code.trim();
    if (!value || redeeming) return;
    setRedeeming(true); setError(''); setMessage('');
    try {
      const result = await redeemCode(value);
      setMessage(`兑换成功，+ ${result.units} AI 积分`);
      setCode('');
      refreshBillingBalance?.({ force: true }).catch(() => {});
      refreshBillingLedger?.({ limit: 8 }).catch(() => {});
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
            <span>在一个地方管理账号、积分、技能与兑换</span>
          </div>
          <button type="button" className="member-icon-btn" onClick={onClose} aria-label="关闭会员中心"><X size={16} /></button>
        </header>

        <div className="member-body">
          <section className="member-card">
            <div className="member-card-title"><ShieldCheck size={14} /><strong>账户资料</strong></div>
            <dl className="member-list">
              <div><dt>账号</dt><dd>{email || '未登录'}</dd></div>
              <div><dt>昵称</dt><dd>{email ? email.split('@')[0] : '—'}</dd></div>
            </dl>
          </section>

          <section className="member-card">
            <div className="member-card-title"><Coins size={14} /><strong>积分</strong></div>
            <div className="member-balance">{balance}<em>AI 积分</em></div>
            <ul className="member-ledger">
              {ledger.map((entry, index) => (
                <li key={entry.id || index}>
                  <span>{entry.referenceType || entry.eventType || '记录'}</span>
                  <b className={Number(entry.deltaAvailable) >= 0 ? 'is-plus' : 'is-minus'}>
                    {Number(entry.deltaAvailable) >= 0 ? '+' : ''}{Number(entry.deltaAvailable) || 0}
                  </b>
                </li>
              ))}
              {!ledger.length && <li className="member-empty">暂无积分明细</li>}
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
