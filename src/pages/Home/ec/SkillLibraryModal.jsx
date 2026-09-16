import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { X, Plus, Pencil, Trash2, Loader2, ShieldCheck, ChevronDown, Eye, EyeOff } from 'lucide-react';

import {
  fetchSkillLibrary, createUserSkill, updateUserSkill, archiveUserSkill,
  createSkillGroup,
} from '../../../services/skills.js';
import { useApp } from '../../../store/AppContext';
import { useModalScrollLock } from '../../../components/ui/useModalScrollLock.js';
import ResizableTextarea from './ResizableTextarea.jsx';
import './skill-library.css';

const KINDS = Object.freeze([
  { value: 'image', label: '生图' },
  { value: 'video', label: '生视频' },
  { value: 'canvas', label: '画布' },
  { value: 'copy', label: '文案' },
]);

/* 9-12 用户批注：技能提示词要能写很多（skill 内容通常很长），上限 2000 → 8000；输入框也拉高。 */
const LIMITS = Object.freeze({ name: 40, summary: 80, body: 8000 });

/* ═══ 技能提示词输入框：能吃满栏内剩余空间（2026-09-16 用户批注图6-①）═══
   用户原话：「你这边的技能提示词是不是又出问题了呀？你为什么搞这么小呢？
   你这个框明显是可以往下拉满的呀。下面留那么多空白，要干嘛呢？」
   根因：available / maxHeight 是按**视口高度百分比**拍的死值
   （0.34 / 0.46 × innerHeight ≈ 276 / 374），而编辑栏里实际有 ~600px 空白。
   现在改成**实测**：栏高 − 输入框以上的内容 − 底部提示与按钮组 − 留白。 */
const KIND_HINT = Object.freeze({
  image: '技能只作用于风格与表达，不会覆盖商品事实、平台规则与计费；含"忽略以上规则"一类内容会被拒绝。',
  /* 2026-09-16 用户批注（图6-②）：「你加这句话是要干嘛呢？……可是他这里是个生视频的地方呀，
     你加这句话有什么意义吗？……总而言之就是不能这样子驴头不对马嘴啊！」
     —— 同一句说明原本四个技能类型共用，于是生视频里出现「覆盖商品事实」，语义完全对不上。 */
  video: '技能只作用于镜头语言与表现方式，不会覆盖你上传的素材事实、平台规则与计费；含"忽略以上规则"一类内容会被拒绝。',
  canvas: '技能只作用于画面风格与结构，不会覆盖画布上的素材事实、平台规则与计费；含"忽略以上规则"一类内容会被拒绝。',
  copy: '技能只作用于文案语气与结构，不会覆盖商品事实、平台规则与计费；含"忽略以上规则"一类内容会被拒绝。',
});
const EMPTY_DRAFT = Object.freeze({ id: '', kind: 'image', name: '', summary: '', body: '', params: {}, groupId: '' });

/**
 * 技能库（2026-09-10 P0/P1；2026-09-10 二次改版）
 * - 一套 UI 承载全部技能类型（生图/生视频/画布/文案），不再为每种能力各做一套。
 * - 内置技能只读但带完整提示词正文：可"查看"、可"派生"（派生即拿到全部正文）。
 * - 新建/编辑可选四类之一，并可选分组（默认分组：主图/详情图/小红书/视频）。
 * - 保存前本地校验 + 服务端校验；越权提示词由服务端 SKILL_OVERRIDE_REJECTED 拦截。
 */
export default function SkillLibraryModal({ open, onClose, initialKind = 'image', onPick }) {
  const { dispatch } = useApp();
  const [kind, setKind] = useState(initialKind);
  /* needsLogin：未登录是**一种正常状态**，不是错误。
     2026-09-15 用户批注（图4-①「技能库怎么坏掉了」）：此前把服务端的英文原文
     （'A signed session token is required'）直接当红色横幅显示，用户看到的就是「坏了」。
     实测链路是好的（skills.js 发 Authorization: Bearer，服务端 contentBilling 认这个头），
     失败原因就是「当时没有 token」—— 所以要做的是把这种情况**讲清楚并给出登录入口**。 */
  const [state, setState] = useState({ loading: false, error: '', needsLogin: false, builtin: [], mine: [], groups: [] });
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  /* 提示词框能长到多高：**实测**编辑栏剩余空间，不再用视口百分比拍脑袋
     （见文件头注释：原先 0.34/0.46 × innerHeight 只给出 ~276px，下面留了 ~600px 空白）。 */
  const editorColumnRef = useRef(null);
  const [bodyAvailable, setBodyAvailable] = useState(320);
  /* ⚠️ 必须声明在下面这个 useLayoutEffect **之前**：依赖数组在渲染期求值，
     若它在效果之后才声明，React 读依赖时会抛
     `ReferenceError: Cannot access 'editing' before initialization`（TDZ），
     整页直接落到错误边界（2026-09-16 线上白屏事故的根因，见 RTK 批次二十）。 */
  const editing = Boolean(draft.id);
  useLayoutEffect(() => {
    if (!open) return undefined;
    const measure = () => {
      const column = editorColumnRef.current;
      const field = column?.querySelector('.skill-field:has(.rsz-textarea)');
      if (!column || !field) return;
      const columnBottom = column.getBoundingClientRect().bottom;
      const fieldTop = field.getBoundingClientRect().top;
      const used = (column.querySelector('.skill-editor-actions')?.offsetHeight || 0)
        + (column.querySelector('.skill-hint')?.offsetHeight || 0)
        + 40;
      setBodyAvailable(Math.max(132, Math.round(columnBottom - fieldTop - used)));
    };
    measure();
    globalThis.addEventListener('resize', measure);
    return () => globalThis.removeEventListener('resize', measure);
  }, [open, kind, editing]);
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
      const authRequired = error?.status === 401 || error?.status === 403
        || error?.errorCode === 'AUTH_SESSION_REQUIRED'
        || error?.errorCode === 'AUTH_SESSION_UNAUTHORIZED';
      setState({
        loading: false,
        needsLogin: authRequired,
        error: authRequired ? '' : (error?.message || '技能库加载失败'),
        builtin: [], mine: [], groups: [],
      });
    }
  }, [kind]);

  useEffect(() => { if (open) load(kind); }, [open, kind, load]);

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

        {/* 未登录 = 正常状态，给入口而不给报错（用户批注图4-①） */}
        {state.needsLogin && (
          <div className="skill-login-required" role="status">
            <ShieldCheck aria-hidden="true" size={18} />
            <div className="skill-login-required-copy">
              <strong>技能库需要登录后使用</strong>
              <span>内置技能只读、可查看完整提示词；自建技能保存在你的账号里。</span>
            </div>
            <button
              type="button"
              className="skill-login-required-action"
              onClick={() => { onClose?.(); dispatch({ type: 'SHOW_LOGIN', show: true }); }}
            >
              立即登录
            </button>
          </div>
        )}
        {!state.needsLogin && state.error && <div className="skill-alert" role="alert">{state.error}</div>}
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
              {!state.loading && !state.needsLogin && !state.builtin.length && <li className="skill-empty">该类型暂无内置技能</li>}
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
              {!state.loading && !state.needsLogin && !state.mine.length && <li className="skill-empty">还没有自建技能，右侧新建一个</li>}
            </ul>
          </section>

          <section className="skill-column is-editor" ref={editorColumnRef}>
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
              {/* 2026-09-15 用户批注①（图2-②）：「右下角确实有一个可以拉动的手柄，
                  但我一拉就直接往下面截断了，根本没有办法拉动」。
                  根因是 CSS resize:vertical 与 flex 弹性项( height:100% )互相覆写，
                  再叠加父级 overflow:hidden → 拉出来的高度被裁掉。
                  改用受控的 ResizableTextarea：拖拽直接改 state 高度，
                  flex 不再覆写；上限吃到栏内可用空间，超出则栏内滚动。 */}
              <ResizableTextarea
                aria-label="技能提示词"
                value={draft.body}
                maxLength={LIMITS.body}
                rows={14}
                /* 技能库是弹窗不是浮层面板：给一个基于视口的合理上限，
                   保证拉到顶之前按钮组仍留在可视区内（超出由栏内滚动兜底）。 */
                available={bodyAvailable}
                minHeight={132}
                maxHeight={bodyAvailable}
                placeholder={'- 模块名: 场景氛围图\n- 画面任务: 突出产品整体形象与核心气质'}
                onChange={event => patchDraft({ body: event.target.value })}
              />
              <em>{draft.body.trim().length}/{LIMITS.body}</em>
            </label>

            <p className="skill-hint">
              <ShieldCheck size={13} /> {KIND_HINT[kind] || KIND_HINT.image}
            </p>

            {/* 9-18（P0）「值对了，覆盖面没到」——原先只是把 token 名抄进自写规则，
                没有挂契约类。现改用 .ui-modal-footer-actions / .ui-btn，
                按钮高度/最小宽/圆角/主次/禁用态全部由契约提供。 */}
            <div className="ui-modal-footer skill-editor-actions">
              <div className="ui-modal-footer-actions">
                {editing && <button type="button" className="ui-btn ui-btn-secondary" onClick={() => setDraft(EMPTY_DRAFT)}>取消编辑</button>}
                <button type="button" className="ui-btn ui-btn-primary" onClick={handleSave} disabled={!canSave || saving}>
                  {saving ? <><Loader2 size={14} className="skill-spin" /> 保存中…</> : <><Plus size={14} /> {editing ? '保存修改' : '创建技能'}</>}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
