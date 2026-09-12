import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Plus, Pencil, Trash2, Loader2, ShieldCheck, ChevronDown, Eye, EyeOff } from 'lucide-react';

import {
  fetchSkillLibrary, createUserSkill, updateUserSkill, archiveUserSkill,
  createSkillGroup,
} from '../../../services/skills.js';
import { useModalScrollLock } from '../../../components/ui/useModalScrollLock.js';
import './skill-library.css';

const KINDS = Object.freeze([
  { value: 'image', label: '生图' },
  { value: 'video', label: '生视频' },
  { value: 'canvas', label: '画布' },
  { value: 'copy', label: '文案' },
]);

/* 9-12 用户批注：技能提示词要能写很多（skill 内容通常很长），上限 2000 → 8000；输入框也拉高。 */
const LIMITS = Object.freeze({ name: 40, summary: 80, body: 8000 });
const EMPTY_DRAFT = Object.freeze({ id: '', kind: 'image', name: '', summary: '', body: '', params: {}, groupId: '' });

/**
 * 技能库（2026-09-10 P0/P1；2026-09-10 二次改版）
 * - 一套 UI 承载全部技能类型（生图/生视频/画布/文案），不再为每种能力各做一套。
 * - 内置技能只读但带完整提示词正文：可"查看"、可"派生"（派生即拿到全部正文）。
 * - 新建/编辑可选四类之一，并可选分组（默认分组：主图/详情图/小红书/视频）。
 * - 保存前本地校验 + 服务端校验；越权提示词由服务端 SKILL_OVERRIDE_REJECTED 拦截。
 */
export default function SkillLibraryModal({ open, onClose, initialKind = 'image', onPick }) {
  const [kind, setKind] = useState(initialKind);
  const [state, setState] = useState({ loading: false, error: '', builtin: [], mine: [], groups: [] });
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  /* 9-11 用户批注: 提示不能一直挂着 → 4s 自动消失, 也可手动关掉 */
  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const [expandedBuiltin, setExpandedBuiltin] = useState('');
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [groupBusy, setGroupBusy] = useState(false);

  useModalScrollLock(open);

  useEffect(() => { if (open) setKind(initialKind); }, [open, initialKind]);

  const load = useCallback(async (nextKind = kind) => {
    setState(previous => ({ ...previous, loading: true, error: '' }));
    try {
      const library = await fetchSkillLibrary({ kind: nextKind });
      setState({ loading: false, error: '', builtin: library.builtin, mine: library.mine, groups: library.groups });
    } catch (error) {
      setState({ loading: false, error: error?.message || '技能库加载失败', builtin: [], mine: [], groups: [] });
    }
  }, [kind]);

  useEffect(() => { if (open) load(kind); }, [open, kind, load]);

  const editing = Boolean(draft.id);
  const groupsForKind = useMemo(() => (
    state.groups.filter(group => !group.kind || group.kind === kind)
  ), [state.groups, kind]);

  const canSave = useMemo(() => (
    draft.name.trim().length > 0
    && draft.name.trim().length <= LIMITS.name
    && draft.body.trim().length > 0
    && draft.body.trim().length <= LIMITS.body
    && draft.summary.trim().length <= LIMITS.summary
  ), [draft]);

  const patchDraft = useCallback(next => setDraft(previous => ({ ...previous, ...next })), []);

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true); setNotice('');
    try {
      const payload = {
        kind: draft.kind,
        name: draft.name.trim(),
        summary: draft.summary.trim(),
        body: draft.body.trim(),
        params: draft.params || {},
        groupId: draft.groupId || '',
      };
      if (editing) await updateUserSkill(draft.id, payload);
      else await createUserSkill(payload);
      setDraft(EMPTY_DRAFT);
      setNotice(editing ? '已更新技能' : '已创建技能');
      await load(kind);
    } catch (error) {
      setNotice(error?.message || '保存失败');
    }
    setSaving(false);
  };

  const handleArchive = async id => {
    setNotice('');
    try {
      await archiveUserSkill(id);
      if (draft.id === id) setDraft(EMPTY_DRAFT);
      setNotice('已归档技能');
      await load(kind);
    } catch (error) {
      setNotice(error?.message || '归档失败');
    }
  };

  const handleCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name || groupBusy) return;
    setGroupBusy(true);
    try {
      const group = await createSkillGroup(name, { kind });
      setNewGroupName('');
      setNewGroupOpen(false);
      patchDraft({ groupId: group.id });
      await load(kind);
    } catch (error) {
      setNotice(error?.message || '创建分组失败');
    }
    setGroupBusy(false);
  };

  const deriveBuiltin = skill => {
    setDraft({
      ...EMPTY_DRAFT,
      kind: skill.kind,
      name: `${skill.name} 副本`.slice(0, LIMITS.name),
      summary: skill.summary || '',
      body: skill.body || '',
      groupId: '',
    });
    setNotice(skill.body ? '已带入内置技能的完整提示词，可自由修改后保存' : '该内置技能暂无提示词正文，请自行填写');
  };

  const groupName = groupId => state.groups.find(group => group.id === groupId)?.name || '';

  if (!open) return null;

  return (
    <div className="skill-modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose?.(); }}>
      <div className="skill-modal" role="dialog" aria-modal="true" aria-label="技能库">
        <header className="skill-modal-head">
          <div>
            <strong>技能库</strong>
            <span>一套技能，覆盖生图 / 生视频 / 画布 / 文案；内置技能只读，可查看并派生完整提示词</span>
          </div>
          <button type="button" className="skill-icon-btn" onClick={onClose} aria-label="关闭技能库"><X size={16} /></button>
        </header>

        <div className="skill-kind-tabs" role="tablist" aria-label="技能类型">
          {KINDS.map(option => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={kind === option.value}
              className={kind === option.value ? 'is-active' : ''}
              onClick={() => { setKind(option.value); setDraft(EMPTY_DRAFT); setExpandedBuiltin(''); setNotice(''); }}
            >
              {option.label}
            </button>
          ))}
        </div>

        {state.error && <div className="skill-alert" role="alert">{state.error}</div>}
        {notice && <div className="skill-notice" role="status">{notice}<button type="button" className="skill-notice-close" aria-label="关闭提示" onClick={() => setNotice('')}>×</button></div>}

        <div className="skill-modal-body">
          <section className="skill-column">
            <div className="skill-column-head">
              <strong>内置技能</strong>
              <span>只读 · 可查看完整提示词 · 可派生</span>
            </div>
            <ul className="skill-list">
              {state.builtin.map(skill => (
                <li key={skill.id} className="skill-card">
                  <div className="skill-card-main">
                    <strong>{skill.name}</strong>
                    <p>{skill.summary}</p>
                    {expandedBuiltin === skill.id && (
                      <pre className="skill-card-body">{skill.body || '（该技能暂无提示词正文）'}</pre>
                    )}
                  </div>
                  <div className="skill-card-actions">
                    <button
                      type="button"
                      className="skill-mini-btn"
                      aria-label={expandedBuiltin === skill.id ? '收起提示词' : '查看提示词'}
                      onClick={() => setExpandedBuiltin(previous => (previous === skill.id ? '' : skill.id))}
                    >
                      {expandedBuiltin === skill.id ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                    {/* 9-11 用户批注: 内置技能就是给用户用的 — 直接「使用」, 不再强制派生副本;
                        「派生」= 复制一份到我的技能里再改 (可选) */}
                    {onPick && <button type="button" className="skill-mini-btn is-primary" onClick={() => onPick(skill)}>使用</button>}
                    <button type="button" className="skill-mini-btn" title="复制一份到「我的技能」再修改" onClick={() => deriveBuiltin(skill)}>派生</button>
                  </div>
                </li>
              ))}
              {!state.loading && !state.builtin.length && <li className="skill-empty">该类型暂无内置技能</li>}
            </ul>
          </section>

          <section className="skill-column">
            <div className="skill-column-head">
              <strong>我的技能</strong>
              <span>{state.mine.length} 个</span>
            </div>
            <ul className="skill-list">
              {state.mine.map(skill => (
                <li key={skill.id} className="skill-card">
                  <div className="skill-card-main">
                    <strong>{skill.name} <em>v{skill.version}</em></strong>
                    {skill.groupName && <span className="skill-group-tag">{skill.groupName}</span>}
                    <p>{skill.summary || '（无简介）'}</p>
                  </div>
                  <div className="skill-card-actions">
                    <button type="button" className="skill-mini-btn" aria-label={`编辑 ${skill.name}`} onClick={() => setDraft({ id: skill.id, kind: skill.kind, name: skill.name, summary: skill.summary || '', body: skill.body, params: skill.params || {}, groupId: skill.groupId || '' })}><Pencil size={12} /></button>
                    <button type="button" className="skill-mini-btn" aria-label={`归档 ${skill.name}`} onClick={() => handleArchive(skill.id)}><Trash2 size={12} /></button>
                    {onPick && Boolean(skill.body) && <button type="button" className="skill-mini-btn is-primary" onClick={() => onPick(skill)}>使用</button>}
                  </div>
                </li>
              ))}
              {!state.loading && !state.mine.length && <li className="skill-empty">还没有自建技能，右侧新建一个</li>}
            </ul>
          </section>

          <section className="skill-column is-editor">
            <div className="skill-column-head">
              <strong>{editing ? '编辑技能' : '新建技能'}</strong>
              <span>{editing ? `v${state.mine.find(item => item.id === draft.id)?.version || ''}` : ''}</span>
            </div>

            <label className="skill-field">
              <span>技能类型</span>
              <div className="skill-kind-picker" role="radiogroup" aria-label="选择技能类型">
                {KINDS.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={draft.kind === option.value}
                    className={draft.kind === option.value ? 'is-active' : ''}
                    onClick={() => patchDraft({ kind: option.value })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </label>

            <label className="skill-field">
              <span>所属分组</span>
              <div className="skill-group-picker">
                <select
                  value={draft.groupId}
                  onChange={event => patchDraft({ groupId: event.target.value })}
                >
                  <option value="">不放入分组</option>
                  {groupsForKind.map(group => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
                <button type="button" className="skill-mini-btn" onClick={() => { setNewGroupOpen(previous => !previous); }} aria-expanded={newGroupOpen}>
                  + 新建分组
                </button>
              </div>
              {newGroupOpen && (
                <div className="skill-new-group">
                  <input
                    value={newGroupName}
                    maxLength={20}
                    placeholder="分组名称，例如：数码产品"
                    onChange={event => setNewGroupName(event.target.value)}
                    onKeyDown={event => { if (event.key === 'Enter') handleCreateGroup(); }}
                  />
                  <button type="button" className="skill-mini-btn is-primary" disabled={!newGroupName.trim() || groupBusy} onClick={handleCreateGroup}>
                    {groupBusy ? <Loader2 size={12} className="skill-spin" /> : '创建'}
                  </button>
                </div>
              )}
              {draft.groupId && groupName(draft.groupId) && <em>已选分组：{groupName(draft.groupId)}</em>}
            </label>

            <label className="skill-field">
              <span>名称</span>
              <input
                value={draft.name}
                maxLength={LIMITS.name}
                placeholder="例如：场景氛围图"
                onChange={event => patchDraft({ name: event.target.value })}
              />
              <em>{draft.name.trim().length}/{LIMITS.name}</em>
            </label>

            <label className="skill-field">
              <span>简介</span>
              <input
                value={draft.summary}
                maxLength={LIMITS.summary}
                placeholder="一句话说明用途（选填）"
                onChange={event => patchDraft({ summary: event.target.value })}
              />
            </label>

            <label className="skill-field">
              <span>技能提示词</span>
              <textarea
                value={draft.body}
                maxLength={LIMITS.body}
                rows={14}
                placeholder={'- 模块名: 场景氛围图\n- 画面任务: 突出产品整体形象与核心气质'}
                onChange={event => patchDraft({ body: event.target.value })}
              />
              <em>{draft.body.trim().length}/{LIMITS.body}</em>
            </label>

            <p className="skill-hint">
              <ShieldCheck size={13} /> 技能只作用于风格与表达，不会覆盖商品事实、平台规则与计费；含"忽略以上规则"一类内容会被拒绝。
            </p>

            <div className="skill-editor-actions">
              {editing && <button type="button" className="skill-mini-btn" onClick={() => setDraft(EMPTY_DRAFT)}>取消编辑</button>}
              <button type="button" className="skill-save-btn" onClick={handleSave} disabled={!canSave || saving}>
                {saving ? <><Loader2 size={14} className="skill-spin" /> 保存中…</> : <><Plus size={14} /> {editing ? '保存修改' : '创建技能'}</>}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
