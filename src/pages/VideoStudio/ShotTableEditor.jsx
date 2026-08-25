import React, { useEffect, useState } from 'react';
import { Clapperboard, Plus, Save } from 'lucide-react';
import { updateStoryboardShot } from '../../services/videoWorkbench.js';

const HOOK_OPTIONS = ['visual-joke', 'reversal', 'suspense', 'tender', 'chase', 'reveal', 'callback', 'expression-beat'];
const EMPTY_ENTRY = { t: '', action: '', camera: '', space: '', audio: '', handoff: '' };

/**
 * VID-R3: structured six-column shot table editor (MiniMax-H3 style).
 * Fields: continuity link, reference anchors, hook type, per-second
 * directives (action/camera/space/audio/handoff) and the audio track.
 */
export default function ShotTableEditor({ projectId, shot, onSaved, onError }) {
  const direction = shot?.direction || {};
  const [draft, setDraft] = useState(() => ({
    continuityLink: direction.continuityLink || '',
    hookType: direction.hookType || '',
    refs: { ...(direction.refs || {}) },
    audioTrack: { ...(direction.audioTrack || {}) },
    perSecond: (direction.perSecond || []).map(item => ({ ...item })),
  }));
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState('');
  useEffect(() => {
    setDraft({
      continuityLink: direction.continuityLink || '',
      hookType: direction.hookType || '',
      refs: { ...(direction.refs || {}) },
      audioTrack: { ...(direction.audioTrack || {}) },
      perSecond: (direction.perSecond || []).map(item => ({ ...item })),
    });
    setSavedAt('');
    // Re-sync only when a different shot is opened; local typing must not be clobbered.
  }, [shot?.id]);
  const patchDraft = patch => setDraft(current => ({ ...current, ...patch }));
  const setEntry = (index, key, value) => {
    const next = draft.perSecond.map((entry, i) => (i === index ? { ...entry, [key]: value } : entry));
    patchDraft({ perSecond: next });
  };
  const save = async () => {
    if (saving || !shot?.id) return;
    setSaving(true);
    try {
      await updateStoryboardShot(projectId, shot.id, {
        expectedRevision: shot.revision,
        direction: { ...direction, ...draft },
      });
      setSavedAt('已保存');
      onSaved?.();
    } catch (cause) {
      onError?.(cause?.message || '保存分镜失败');
    } finally {
      setSaving(false);
    }
  };
  const refFields = [['landmark', '固定地标'], ['characterPositions', '人物位置'], ['exits', '退场状态'], ['lightingBaseline', '光位基线']];
  const audioFields = [['narration', '旁白'], ['dialogue', '对白'], ['sfx', '音效'], ['performanceNotes', '表演备注']];
  return (
    <div className="dw-shot-editor">
      <h3><Clapperboard size={13} /> 六列镜头表 · S{String((shot?.position ?? 0) + 1).padStart(2, '0')} <small>{(Number(shot?.durationMs) || 0) / 1000}s</small>{savedAt && <em className="dw-saved-flag">{savedAt}</em>}</h3>
      <label className="dw-field dw-field-wide">
        <span>连续性衔接 — 本镜如何承接上一镜的结束状态，并为下一镜铺垫</span>
        <textarea rows={2} value={draft.continuityLink} onChange={event => patchDraft({ continuityLink: event.target.value })} />
      </label>
      <div className="dw-field-row">
        <label className="dw-field">
          <span>Hook 类型</span>
          <select value={draft.hookType} onChange={event => patchDraft({ hookType: event.target.value })}>
            <option value="">未设置</option>
            {HOOK_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        {refFields.map(([key, label]) => (
          <label className="dw-field" key={key}>
            <span>{label}</span>
            <input value={draft.refs[key] || ''} onChange={event => patchDraft({ refs: { ...draft.refs, [key]: event.target.value } })} />
          </label>
        ))}
      </div>
      <div className="dw-per-second">
        <h4>每秒指令 — 动作 / 运镜 / 空间 / 音频线索 / 与下一秒交接</h4>
        {draft.perSecond.map((entry, index) => (
          <div className="dw-ps-row" key={index}>
            <input className="dw-ps-t" placeholder="0-1s" value={entry.t || ''} onChange={event => setEntry(index, 't', event.target.value)} />
            <input placeholder="动作/姿态" value={entry.action || ''} onChange={event => setEntry(index, 'action', event.target.value)} />
            <input placeholder="运镜" value={entry.camera || ''} onChange={event => setEntry(index, 'camera', event.target.value)} />
            <input placeholder="空间位置" value={entry.space || ''} onChange={event => setEntry(index, 'space', event.target.value)} />
            <input placeholder="音频线索" value={entry.audio || ''} onChange={event => setEntry(index, 'audio', event.target.value)} />
            <input placeholder="交接" value={entry.handoff || ''} onChange={event => setEntry(index, 'handoff', event.target.value)} />
            <button type="button" className="dw-ps-remove" aria-label="删除该条指令" onClick={() => patchDraft({ perSecond: draft.perSecond.filter((_, i) => i !== index) })}>×</button>
          </div>
        ))}
        <button type="button" className="dw-ps-add" onClick={() => patchDraft({ perSecond: [...draft.perSecond, { ...EMPTY_ENTRY }] })}><Plus size={12} /> 加一条指令</button>
      </div>
      <div className="dw-field-row">
        {audioFields.map(([key, label]) => (
          <label className="dw-field" key={key}>
            <span>{label}</span>
            <input value={draft.audioTrack[key] || ''} onChange={event => patchDraft({ audioTrack: { ...draft.audioTrack, [key]: event.target.value } })} />
          </label>
        ))}
      </div>
      <footer className="dw-editor-actions">
        <button type="button" className="dw-save-btn" disabled={saving} onClick={() => void save()}><Save size={13} />{saving ? '保存中…' : '保存镜头表'}</button>
      </footer>
    </div>
  );
}
