import React, { useState, useEffect } from 'react';
import { Clock, Zap } from 'lucide-react';
import { IMAGES, CHAR_CYCLE } from '../../constants/images';
import { LOADING_STAGES, TIPS } from '../../constants/data';
import { CharImg } from '../../components/ui/index';
import { useApp } from '../../store/AppContext';

export default function LoadingView() {
  const { state } = useApp();
  const { genStage } = state;
  const [tipIdx, setTipIdx] = useState(() => Math.floor(Math.random() * TIPS.length));

  useEffect(() => {
    const t = setInterval(() => setTipIdx(i => (i + 1) % TIPS.length), 5000);
    return () => clearInterval(t);
  }, []);

  const stage = LOADING_STAGES[genStage] || LOADING_STAGES[0];
  const charKey = CHAR_CYCLE[tipIdx % CHAR_CYCLE.length];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{
        maxWidth: 'var(--max-width-xs)', margin: '0 auto',
        padding: '60px 20px', textAlign: 'center',
      }} className="animate-fade-in">
        <CharImg
          src={IMAGES[charKey]}
          alt={stage.label}
          size={160}
          float
        />

        <div style={{
          fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)',
          marginTop: 24, marginBottom: 6,
        }}>
          {stage.label}
        </div>

        <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-muted)', marginBottom: 28 }}>
          {stage.desc.replace('{n}', String(Math.min(genStage * 3 + 1, 9)))}
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 28, padding: '0 30px' }}>
          {LOADING_STAGES.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 5, borderRadius: 3,
              background: i <= genStage ? 'var(--red)' : 'var(--border)',
              transition: 'background 0.5s',
            }} />
          ))}
        </div>

        {/* Warning */}
        <div style={{
          background: '#FFF5F5', borderRadius: 'var(--radius-lg)',
          padding: '12px 18px', marginBottom: 24,
          fontSize: 'var(--text-sm)', color: '#C53030',
          display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
        }}>
          <Clock size={13} /> 生成中请勿刷新页面，否则会浪费1套额度
        </div>

        {/* Tip */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)', padding: '16px 20px', textAlign: 'left',
        }}>
          <div style={{
            fontSize: 'var(--text-xs)', color: 'var(--text-ghost)',
            marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Zap size={10} /> 小红书冷知识
          </div>
          <div style={{
            fontSize: 'var(--text-sm)', color: 'var(--text-secondary)',
            lineHeight: 'var(--leading-relaxed)', minHeight: 32,
            transition: 'opacity 0.3s',
          }}>
            {TIPS[tipIdx]}
          </div>
        </div>

        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-invisible)', marginTop: 20 }}>
          预计需要 15-30 秒
        </div>
      </div>
    </div>
  );
}
