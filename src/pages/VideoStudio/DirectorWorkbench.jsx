import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Clapperboard,
  Film,
  FolderKanban,
  Images,
  LoaderCircle,
  Lock,
  LockOpen,
  Music2,
  Plus,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wand2,
} from 'lucide-react';
import { useApp } from '../../store/AppContext.jsx';
import { createProject, listProjects } from '../../services/projects.js';
import {
  getVideoSkillTemplates,
  getVideoWorkbench,
  lockWorkbenchAssetVersion,
  unlockWorkbenchAssetVersion,
} from '../../services/videoWorkbench.js';
import './DirectorWorkbench.css';

const CONSISTENCY_GROUPS = [
  { key: 'character_card', label: '角色卡', icon: UserRound, hint: '锁定主角形象，跨镜头一致' },
  { key: 'scene_card', label: '场景卡', icon: Images, hint: '锁定环境与连续性地标' },
  { key: 'anchor_image', label: '锚定图', icon: Sparkles, hint: '产品/主视觉锚定参考' },
  { key: 'material', label: '素材', icon: Film, hint: '图片 / 视频 / 音频原始素材' },
];

function groupAssets(assets = []) {
  const groups = Object.fromEntries(CONSISTENCY_GROUPS.map(g => [g.key, []]));
  for (const asset of assets) {
    const kind = asset?.assetKind || asset?.kind || 'material';
    (groups[kind] || groups.material).push(asset);
  }
  return groups;
}

export default function DirectorWorkbench({ capabilities }) {
  const { state } = useApp();
  const mode = capabilities?.workbenchMode === 'live' ? 'live' : 'planning';
  const planningOnly = capabilities?.workbenchPlanningOnly !== false;
  const [projects, setProjects] = useState([]);
  const [projectsError, setProjectsError] = useState('');
  const [projectId, setProjectId] = useState('');
  const [workbench, setWorkbench] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [stage, setStage] = useState('storyboard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [lockBusy, setLockBusy] = useState('');

  const loadProjects = useCallback(async () => {
    try {
      setProjectsError('');
      const list = await listProjects();
      setProjects(list);
      setProjectId(current => current || (list[0]?.id ? String(list[0].id) : ''));
    } catch (cause) {
      setProjectsError(cause?.message || '项目列表暂时不可用');
    }
  }, []);

  useEffect(() => { void loadProjects(); }, [loadProjects]);

  useEffect(() => {
    if (!projectId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([
      getVideoWorkbench(projectId),
      getVideoSkillTemplates(projectId).catch(() => []),
    ]).then(([wb, tpls]) => {
      if (cancelled) return;
      setWorkbench(wb);
      setTemplates(tpls);
    }).catch(cause => {
      if (!cancelled) setError(cause?.message || '导演台数据暂时不可用');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  const shots = workbench?.shots || [];
  const clips = workbench?.timelineClips || [];
  const grouped = useMemo(() => groupAssets(workbench?.assets || []), [workbench]);
  const totalDuration = useMemo(() => clips.reduce((sum, clip) => sum + (Number(clip.durationSeconds || clip.duration) || 0), 0), [clips]);

  const toggleLock = useCallback(async (asset) => {
    if (!asset?.id || lockBusy) return;
    const versions = Array.isArray(asset.versions) ? asset.versions : [];
    const approvedVersion = versions.find(v => v.id === asset.approvedVersionId)
      || versions[versions.length - 1];
    const lockedNow = Boolean(approvedVersion?.lockedAt);
    setLockBusy(asset.id);
    setError('');
    try {
      if (lockedNow) {
        await unlockWorkbenchAssetVersion(projectId, asset.id, { expectedRevision: asset.revision });
      } else {
        if (!approvedVersion?.id) throw new Error('该资产还没有可锁定的版本，请先上传素材');
        await lockWorkbenchAssetVersion(projectId, asset.id, {
          versionId: approvedVersion.id,
          expectedRevision: asset.revision,
        });
      }
      const wb = await getVideoWorkbench(projectId);
      setWorkbench(wb);
    } catch (cause) {
      setError(cause?.message || '一致性锁定操作失败');
    } finally {
      setLockBusy('');
    }
  }, [lockBusy, projectId]);
  const handleCreateProject = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    try {
      const suffix = new Date().toISOString().slice(5, 16).replace('T', ' ');
      const project = await createProject({ name: `新导演台项目 ${suffix}`, kind: 'video' });
      await loadProjects();
      if (project?.id) setProjectId(String(project.id));
    } catch (cause) {
      setError(cause?.message || '创建项目失败');
    } finally {
      setCreating(false);
    }
  }, [creating, loadProjects]);

  return (
    <section className="dw-root" aria-label="视频导演台">
      <header className="dw-topbar">
        <div className="dw-title"><Wand2 size={17} /><strong>导演台</strong><span className={'dw-mode dw-mode-' + mode}>{mode === 'live' ? 'LIVE 可生成' : 'PLANNING 规划模式'}</span>{planningOnly && mode !== 'live' && <span className="dw-planning-note">规划模式不扣积分、不发起付费生成</span>}</div>
        <div className="dw-project-picker">
          <FolderKanban size={15} />
          <select value={projectId} onChange={event => setProjectId(event.target.value)} aria-label="选择视频项目">
            {projects.map(p => <option key={p.id} value={String(p.id)}>{p.name || ('项目 ' + p.id)}</option>)}
          </select>
          <button type="button" className="dw-new-project" disabled={creating} onClick={() => void handleCreateProject()}><Plus size={14} />{creating ? '创建中' : '新建'}</button>
        </div>
      </header>

      {!state.logged && <p className="dw-empty">登录后即可使用导演台管理你的视频项目。</p>}
      {state.logged && projectsError && <p className="dw-error">{projectsError}</p>}
      {state.logged && error && <p className="dw-error">{error}</p>}

      {state.logged && (
        loading && !workbench
          ? <p className="dw-loading"><LoaderCircle size={16} className="dw-spin" /> 正在载入项目…</p>
          : projectId ? (
            <div className="dw-columns">
              <aside className="dw-pane dw-consistency" aria-label="一致性库">
                <h2><ShieldCheck size={14} /> 一致性库</h2>
                {CONSISTENCY_GROUPS.map(group => {
                  const Icon = group.icon;
                  const items = grouped[group.key];
                  return (
                    <div key={group.key} className="dw-group">
                      <h3><Icon size={13} /> {group.label}<small>{items.length}</small></h3>
                      <p className="dw-group-hint">{group.hint}</p>
                      {items.length ? <ul>{items.slice(0, 6).map(item => {
                        const versions = Array.isArray(item.versions) ? item.versions : [];
                        const approvedVersion = versions.find(v => v.id === item.approvedVersionId) || versions[versions.length - 1];
                        const locked = Boolean(approvedVersion?.lockedAt);
                        return (
                          <li key={item.id || item.assetId} className="dw-asset-item">
                            <span className="dw-asset-name">{item.name || item.title || item.label || (item.kind || '资产')}</span>
                            <button
                              type="button"
                              className={'dw-lock-btn' + (locked ? ' is-locked' : '')}
                              disabled={lockBusy === item.id}
                              title={locked ? '解除一致性锁定' : '锁定当前批准版本为一致性锚'}
                              onClick={() => void toggleLock(item)}
                            >
                              {lockBusy === item.id ? <LoaderCircle size={12} className="dw-spin" /> : locked ? <Lock size={12} /> : <LockOpen size={12} />}
                              {locked ? '已锁' : '锁定'}
                            </button>
                          </li>
                        );
                      })}{items.length > 6 && <li className="dw-more">…共 {items.length} 项</li>}</ul> : <p className="dw-none">暂无</p>}
                    </div>
                  );
                })}
                <div className="dw-group">
                  <h3><Music2 size={13} /> 音乐<small>{(grouped.music || []).length}</small></h3>
                  <p className="dw-group-hint">BGM 与音轨引用</p>
                </div>
              </aside>

              <main className="dw-pane dw-center">
                <nav className="dw-stage-switch" role="tablist">
                  <button type="button" role="tab" aria-selected={stage === 'storyboard'} className={stage === 'storyboard' ? 'active' : ''} onClick={() => setStage('storyboard')}><Clapperboard size={14} /> 分镜板 · {shots.length}</button>
                  <button type="button" role="tab" aria-selected={stage === 'timeline'} className={stage === 'timeline' ? 'active' : ''} onClick={() => setStage('timeline')}><Film size={14} /> 时间线 · {clips.length}</button>
                </nav>
                {stage === 'storyboard' ? (
                  shots.length ? (
                    <div className="dw-shot-grid">
                      {shots.map((shot, index) => (
                        <article key={shot.id || index} className="dw-shot-card">
                          <header><span className="dw-shot-no">S{String(index + 1).padStart(2, '0')}</span><strong>{shot.title || shot.purpose || '未命名镜头'}</strong></header>
                          <footer>
                            <span>{Number(shot.durationSeconds || shot.duration) || 6}s</span>
                            {shot.status && <em className={'dw-shot-status dw-st-' + shot.status}>{shot.status}</em>}
                          </footer>
                          {(shot.prompt || shot.creativeIntent) && <p>{String(shot.prompt || shot.creativeIntent).slice(0, 90)}</p>}
                        </article>
                      ))}
                    </div>
                  ) : <div className="dw-placeholder"><Clapperboard size={22} /><strong>分镜板还是空的</strong><span>用右侧「导演技能」启动一次分镜拆解；规划模式下不会产生任何费用。</span></div>
                ) : (
                  clips.length ? (
                    <ol className="dw-timeline">
                      {clips.map((clip, index) => <li key={clip.id || index}><strong>T{index + 1}</strong><span>{clip.shotId || clip.candidateId || '片段'}</span><small>{Number(clip.durationSeconds || clip.duration) || 0}s</small></li>)}
                    </ol>
                  ) : <div className="dw-placeholder"><Film size={22} /><strong>时间线还没有内容</strong><span>批准候选镜头后会自动装配到这里。</span></div>
                )}
              </main>

              <aside className="dw-pane dw-assistant" aria-label="导演助手">
                <h2><Sparkles size={14} /> 导演技能</h2>
                {templates.length ? (
                  <ul className="dw-template-list">
                    {templates.slice(0, 8).map(tpl => (
                      <li key={tpl.id || tpl.templateId}>
                        <strong>{tpl.name || tpl.templateId}</strong>
                        {tpl.description && <p>{String(tpl.description).slice(0, 70)}</p>}
                      </li>
                    ))}
                  </ul>
                ) : <p className="dw-none">当前项目暂无可用模板。</p>}
                <div className="dw-assistant-note">
                  <ShieldCheck size={13} />
                  <p>导演台遵循「先锁一致性 → 再拆分镜 → 自检通过才生成」的流程。规划模式下一切只读不扣费。</p>
                </div>
              </aside>
            </div>
          ) : <p className="dw-empty">还没有视频项目——点右上角「新建」开始第一个导演台项目。</p>
      )}

      {state.logged && projectId && (
        <footer className="dw-footer">
          <span>镜头 {shots.length}</span><i />
          <span>时间线片段 {clips.length}</span><i />
          <span>总时长 {totalDuration}s</span><i />
          <span>一致性资产 {workbench?.assets?.length || 0}</span>
        </footer>
      )}
    </section>
  );
}
