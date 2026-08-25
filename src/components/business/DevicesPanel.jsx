/**
 * P2 设备管理 — “我的设备”折叠区块
 *
 * 列出当前账号的活跃会话（GET /api/auth/sessions），支持逐台吊销
 * （DELETE /api/auth/sessions/:sessionId）。自包含取数，宿主只需挂载。
 */
import React, { useState, useCallback, useEffect } from 'react';
import { MdDevices, MdDeleteOutline, MdExpandMore, MdExpandLess } from 'react-icons/md';
import { fetchAuthSessions, revokeAuthSession } from '../../services/auth';

const DEVICE_LABELS = {
  register: '注册会话',
  exchange: '存量换发',
  'legacy-exchange': '存量换发',
  'legacy-migration': '历史迁移',
};

function describeDevice(session) {
  if (!session?.device) return '未知设备';
  if (session.device.startsWith('oauth:')) return `${DEVICE_LABELS[session.device] || ''} ${session.device.slice(6)} 登录`.trim();
  return DEVICE_LABELS[session.device] || session.device;
}

function formatTime(value) {
  const ts = Date.parse(value || '');
  if (!Number.isFinite(ts)) return '';
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function DevicesPanel() {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setSessions(await fetchAuthSessions());
    } catch (e) {
      setError(e?.message || '获取设备列表失败');
      setSessions([]);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const revoke = async sessionId => {
    setBusyId(sessionId);
    setError('');
    try {
      await revokeAuthSession(sessionId);
      await load();
    } catch (e) {
      setError(e?.message || '吊销失败');
    }
    setBusyId('');
  };

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 12,
      background: '#fff', overflow: 'hidden',
    }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 12px', border: 0, background: 'transparent',
          cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
          fontWeight: 700, color: 'var(--text-secondary)',
        }}
      >
        <MdDevices size={15} />
        我的设备
        <span style={{ flex: 1 }} />
        {open ? <MdExpandLess size={16} /> : <MdExpandMore size={16} />}
      </button>

      {open && (
        <div style={{ padding: '0 12px 12px', fontSize: 12 }}>
          {!sessions && !error && (
            <div style={{ color: 'var(--text-muted)', padding: '4px 0' }}>正在加载设备列表…</div>
          )}
          {error && (
            <div role="status" style={{ color: '#C53030', padding: '4px 0' }}>{error}</div>
          )}
          {Array.isArray(sessions) && sessions.length === 0 && !error && (
            <div style={{ color: 'var(--text-muted)', padding: '4px 0' }}>暂无活跃设备。</div>
          )}
          {Array.isArray(sessions) && sessions.map(session => (
            <div key={session.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 0', borderTop: '1px solid var(--border)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>
                  {describeDevice(session)}
                  {session.current && (
                    <span style={{
                      marginLeft: 6, fontSize: 10, fontWeight: 900,
                      color: '#fff', background: 'var(--accent)',
                      borderRadius: 6, padding: '1px 6px',
                    }}>本机</span>
                  )}
                </div>
                <div style={{ color: 'var(--text-hint)', marginTop: 2 }}>
                  {[session.ip, formatTime(session.createdAt)].filter(Boolean).join(' · ')}
                </div>
              </div>
              {!session.current && (
                <button
                  type="button"
                  onClick={() => revoke(session.id)}
                  disabled={busyId === session.id}
                  title="退出该设备登录"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    border: '1px solid var(--border)', borderRadius: 8,
                    background: '#fff', color: '#C53030', fontSize: 11,
                    fontWeight: 700, padding: '5px 8px', cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <MdDeleteOutline size={13} />
                  {busyId === session.id ? '撤销中…' : '下线'}
                </button>
              )}
            </div>
          ))}
          {Array.isArray(sessions) && sessions.some(s => s.current) && (
            <div style={{ color: 'var(--text-invisible)', paddingTop: 6 }}>
              当前设备无法在本机下线；可使用退出登录。
            </div>
          )}
        </div>
      )}
    </div>
  );
}
