import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Clock3, RotateCcw, X } from 'lucide-react';
import {
  consumeRecoveryCheckpoint,
  dismissRecoveryCheckpoint,
  listRecoveryCheckpoints,
} from '../../../services/projects.js';
import './RecoveryShelf.css';

const KIND_LABELS = {
  ecommerce: '电商套图',
  xiaohongshu: '小红书图文',
  plog: 'Plog 图文',
};

const REASON_LABELS = {
  payment_required: '等待补充额度',
  generation_interrupted: '生成中断',
  session_interrupted: '操作中断',
};

export default function RecoveryShelf({ logged, onRestore }) {
  const [checkpoints, setCheckpoints] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!logged) {
      setCheckpoints([]);
      setExpanded(false);
      return;
    }
    try {
      setError('');
      setCheckpoints(await listRecoveryCheckpoints());
    } catch (requestError) {
      setError(requestError?.message || '暂时无法读取未完成任务');
    }
  }, [logged]);

  useEffect(() => { refresh(); }, [refresh]);

  const restore = async checkpoint => {
    setBusyId(checkpoint.id);
    setError('');
    try {
      const consumed = await consumeRecoveryCheckpoint(checkpoint.id);
      setCheckpoints(current => current.filter(item => item.id !== checkpoint.id));
      await onRestore?.(consumed);
    } catch (requestError) {
      setError(requestError?.message || '暂时无法继续该任务');
    } finally {
      setBusyId('');
    }
  };

  const dismiss = async checkpoint => {
    setBusyId(checkpoint.id);
    setError('');
    try {
      await dismissRecoveryCheckpoint(checkpoint.id);
      setCheckpoints(current => current.filter(item => item.id !== checkpoint.id));
    } catch (requestError) {
      setError(requestError?.message || '暂时无法关闭该任务');
    } finally {
      setBusyId('');
    }
  };

  // A transient fetch failure should not occupy the main workspace. Valid
  // checkpoints remain visible and recoverable when they are actually loaded.
  if (!logged || !checkpoints.length) return null;

  return (
    <section className="recovery-shelf" aria-label="未完成任务">
      <button
        type="button"
        className="recovery-shelf__toggle"
        onClick={() => setExpanded(value => !value)}
        aria-expanded={expanded}
      >
        <span className="recovery-shelf__title"><Clock3 size={16} /> 未完成任务</span>
        <span className="recovery-shelf__count">{checkpoints.length}</span>
        {expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
      </button>
      {expanded && (
        <div className="recovery-shelf__panel">
          {error && <p className="recovery-shelf__error" role="status">{error}</p>}
          {checkpoints.map(checkpoint => (
            <div className="recovery-shelf__item" key={checkpoint.id}>
              <div className="recovery-shelf__copy">
                <strong>{checkpoint.project?.title || KIND_LABELS[checkpoint.project?.kind] || '未完成创作'}</strong>
                <span>{REASON_LABELS[checkpoint.reason] || '可以继续处理'}</span>
              </div>
              <div className="recovery-shelf__actions">
                <button type="button" onClick={() => restore(checkpoint)} disabled={busyId === checkpoint.id}>
                  <RotateCcw size={15} /> 继续
                </button>
                <button type="button" className="recovery-shelf__dismiss" onClick={() => dismiss(checkpoint)} disabled={busyId === checkpoint.id} aria-label="放弃这个未完成任务" title="放弃这个未完成任务">
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
