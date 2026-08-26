// 跨域投递对话框（P2 三入口共用壳）：EcCanvas 节点 / 电商套图成图卡 → 视频项目。
// 选目标项目（或新建）→ 可选绑某镜头首帧 → 逐个引用走既有
// createWorkbenchAsset + importProjectAssetVersion + approve + bindShot 链。
// 纯 UI + 既有 API：不新增任何服务端契约，不触碰账务。

import React, { useEffect, useMemo, useState } from 'react';
import { CircleAlert, Clapperboard, Film, LoaderCircle, Send } from 'lucide-react';
import { createProject, listProjects } from '../../services/projects.js';
import {
  approveWorkbenchAssetVersion,
  bindShotAssetVersion,
  createWorkbenchAsset,
  getVideoWorkbench,
  importProjectAssetVersion,
} from '../../services/videoWorkbench.js';
import {
  buildDeliveryMetadata,
  deliveryBindingRole,
  deliveryStepPlan,
  deliveryWorkbenchKind,
  shotFirstFrameChoices,
  validateDeliveryPlan,
  videoTargetProjects,
} from './videoDeliveryModel.js';
import './videoDeliveryShared.css';
import './videoDeliveryShared.css';

function newRequestId(prefix) {
  const uuid = globalThis.crypto?.randomUUID?.();
  return prefix + '-' + (uuid || Date.now() + '-' + Math.random().toString(36).slice(2));
}

export default function VideoProjectDeliveryDialog({
  open = false,
  refs = [],
  surface = '',
  onClose,
  onDelivered,
}) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [targetProjectId, setTargetProjectId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [bindShotId, setBindShotId] = useState('');
  const [shotChoices, setShotChoices] = useState([]);
  const [progress, setProgress] = useState(null); // {key, step, summary} 或 {done:true,count}

  const deliverables = useMemo(() => (Array.isArray(refs) ? refs.filter(Boolean) : []), [refs]);
  const targets = useMemo(() => videoTargetProjects(projects), [projects]);
  const planError = useMemo(() => validateDeliveryPlan({
    refs: deliverables.map(ref => ({ projectId: ref.projectId })),
    targetProjectId,
    surface,
  }), [deliverables, surface, targetProjectId]);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setLoading(true);
    listProjects()
      .then(rows => { if (active) setProjects(Array.isArray(rows) ? rows : []); })
      .catch(loadError => { if (active) setError(loadError?.message || '暂时无法读取项目'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open]);

  useEffect(() => {
    if (!open || !targetProjectId) { setShotChoices([]); setBindShotId(''); return undefined; }
    let active = true;
    getVideoWorkbench(targetProjectId)
      .then(workbench => { if (active) setShotChoices(shotFirstFrameChoices(workbench.shots)); })
      .catch(() => { if (active) setShotChoices([]); });
    return () => { active = false; };
  }, [open, targetProjectId]);

  useEffect(() => {
    if (!open) { setError(''); setProgress(null); setNewTitle(''); setBindShotId(''); setTargetProjectId(''); }
  }, [open]);

  if (!open) return null;

  async function handleCreateTarget() {
    const title = newTitle.trim().slice(0, 80);
    if (!title || busy) return;
    setBusy(true);
    setError('');
    try {
      const created = await createProject({ kind: 'video', title, idempotencyKey: newRequestId('video-delivery-project') });
      setProjects(current => [created, ...current.filter(item => item.id !== created.id)]);
      setTargetProjectId(created.id);
      setNewTitle('');
    } catch (createError) {
      setError(createError?.message || '暂时无法创建视频项目');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeliver() {
    if (busy || planError) return;
    setBusy(true);
    setError('');
    setProgress(null);
    const results = [];
    try {
      for (const ref of deliverables) {
        const steps = deliveryStepPlan(ref, { bindShotId });
        let asset = null;
        let version = null;
        for (const step of steps) {
          setProgress({ key: ref.name || ref.projectAssetId, step: step.step, summary: step.summary });
          if (step.step === 'create-asset') {
            asset = await createWorkbenchAsset(targetProjectId, {
              kind: deliveryWorkbenchKind(ref.mediaKind),
              name: ref.name || '来自画布的素材',
            });
          } else if (step.step === 'import-version') {
            version = await importProjectAssetVersion(targetProjectId, asset.id, {
              projectId: ref.projectId,
              projectAssetId: ref.projectAssetId,
              role: deliveryBindingRole(ref.mediaKind),
              expectedContentHash: ref.contentHash,
            }, buildDeliveryMetadata(ref, surface));
          } else if (step.step === 'approve') {
            await approveWorkbenchAssetVersion(targetProjectId, asset.id, {
              versionId: version.id,
              expectedRevision: asset.revision,
            });
          } else if (step.step === 'bind-shot') {
            await bindShotAssetVersion(targetProjectId, bindShotId, {
              assetId: asset.id,
              assetVersionId: version.id,
              role: 'first_frame',
            });
          }
        }
        results.push({ projectAssetId: ref.projectAssetId, assetId: asset.id, boundShotId: bindShotId || '' });
      }
      setProgress({ done: true, count: results.length });
      onDelivered?.({ projectId: targetProjectId, results });
    } catch (deliveryError) {
      setProgress(null);
      setError(deliveryError?.message || '投递没有完成，请稍后重试');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="vdd-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose?.(); }}>
      <section className="vdd-dialog" role="dialog" aria-modal="true" aria-labelledby="vdd-title">
        <header className="vdd-head">
          <span className="vdd-eyebrow"><Clapperboard size={14} />发往视频项目</span>
          <h2 id="vdd-title">把这 {deliverables.length} 个素材送进视频创作</h2>
          <button type="button" className="vdd-close" aria-label="关闭投递对话框" disabled={busy} onClick={() => onClose?.()}>×</button>
        </header>
        <div className="vdd-body">
          <ul className="vdd-ref-list" aria-label="待投递素材">
            {deliverables.map(ref => (
              <li key={ref.projectId + ':' + ref.projectAssetId}>
                <Film size={14} /><strong>{ref.name || ref.projectAssetId.slice(-8)}</strong>
                <small>{ref.mediaKind === 'video' ? '视频' : ref.mediaKind === 'audio' ? '音频' : '图片'}</small>
              </li>
            ))}
          </ul>
          {loading && <p className="vdd-hint">正在读取视频项目…</p>}
          <label className="vdd-field"><span>目标视频项目</span>
            <select value={targetProjectId} onChange={event => setTargetProjectId(event.target.value)} disabled={busy}>
              <option value="">选择视频项目</option>
              {targets.map(project => <option key={project.id} value={project.id}>{project.title || '未命名视频项目'}</option>)}
            </select>
          </label>
          <div className="vdd-create-row">
            <input value={newTitle} maxLength={80} placeholder="或新建视频项目" onChange={event => setNewTitle(event.target.value)} disabled={busy} />
            <button type="button" onClick={() => void handleCreateTarget()} disabled={busy || !newTitle.trim()}>新建</button>
          </div>
          {!!shotChoices.length && <label className="vdd-field"><span>绑为镜头首帧（可选）</span>
            <select value={bindShotId} onChange={event => setBindShotId(event.target.value)} disabled={busy}>
              <option value="">不绑定，仅入素材库</option>
              {shotChoices.map(choice => <option key={choice.shotId} value={choice.shotId}>{choice.label}</option>)}
            </select>
          </label>}
          {!targetProjectId && planError && <p className="vdd-warn"><CircleAlert size={13} />{planError}</p>}
          {error && <p className="vdd-error" role="alert"><CircleAlert size={13} />{error}</p>}
          {progress?.done && <p className="vdd-ok" role="status">已送达 {progress.count} 个素材，可在视频画布「从画布发来」中查看。</p>}
          {progress && !progress.done && <p className="vdd-progress" role="status"><LoaderCircle size={13} className="is-spinning" />{progress.key} · {progress.summary}</p>}
        </div>
        <footer className="vdd-foot">
          <small>投递只复制素材引用与确认状态；生成扣费仍走视频项目的方案审批门。</small>
          <button type="button" className="vdd-send" onClick={() => void handleDeliver()} disabled={busy || Boolean(planError)}>
            {busy ? <LoaderCircle size={14} className="is-spinning" /> : <Send size={14} />}发往视频项目
          </button>
        </footer>
      </section>
    </div>
  );
}
