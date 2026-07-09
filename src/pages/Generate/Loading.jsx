import React, { useState, useEffect, useRef } from 'react';
import { Clock, Zap, ShoppingCart } from 'lucide-react';
import { IMAGES, CHAR_CYCLE } from '../../constants/images';
import { LOADING_STAGES, EC_LOADING_STAGES, TIPS, EC_TIPS } from '../../constants/data';
import { CharImg } from '../../components/ui/index';
import { useApp } from '../../store/AppContext';

export default function LoadingView() {
  const { state } = useApp();
  const { genStage, mode } = state;
  const [tipIdx, setTipIdx] = useState(() => Math.floor(Math.random() * (TIPS.length + EC_TIPS.length)));

  const isEC = mode === 'ecommerce';
  const stages = isEC ? EC_LOADING_STAGES : LOADING_STAGES;
  const tips = isEC ? EC_TIPS : TIPS;

  // 流水动效：当前进度条的高亮缓缓移动
  const [shimmerPos, setShimmerPos] = useState(0);
  const animRef = useRef(null);

  useEffect(() => {
    const animate = () => {
      setShimmerPos(p => (p >= 100 ? 0 : p + 1));
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTipIdx(i => (i + 1) % tips.length), 5000);
    return () => clearInterval(t);
  }, [tips.length]);

  const stage = stages[genStage] || stages[0];
  const charKey = CHAR_CYCLE[tipIdx % CHAR_CYCLE.length];

  // 计时器：让用户知道后台还在跑
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

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
          color: isEC ? 'var(--blue)' : 'var(--red)',
        }}>
          {stage.label}
        </div>

        <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-muted)', marginBottom: 28 }}>
          {stage.desc}
        </div>

        {/* 已等待时间 */}
        {elapsed >= 10 && (
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-faint)', marginTop: -20, marginBottom: 28 }}>
            已等待 {elapsed} 秒，每张图约需 25 秒…
          </div>
        )}

        {/* 流水动效进度条 */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 28, padding: '0 30px', position: 'relative' }}>
          {stages.map((_, i) => {
            const isActive = i <= genStage;
            const accentColor = isEC ? 'var(--blue)' : 'var(--red)';
            return (
              <div key={i} style={{
                flex: 1, height: 6, borderRadius: 3,
                background: isActive ? accentColor : 'var(--border)',
                position: 'relative',
                overflow: 'hidden',
                transition: 'background 0.5s',
              }}>
                {isActive && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: `linear-gradient(90deg,
                      transparent 0%,
                      rgba(255,255,255,0.4) ${shimmerPos}%,
                      transparent ${shimmerPos + 15}%
                    )`,
                    animation: 'none',
                  }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Warning — 强调额度浪费 */}
        <div style={{
          background: isEC ? '#EEF2FF' : '#FFF5F5', borderRadius: 'var(--radius-lg)',
          padding: '12px 18px', marginBottom: 24,
          fontSize: 'var(--text-sm)', color: isEC ? '#3730A3' : '#C53030',
          display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
          lineHeight: 1.6,
        }}>
          <Clock size={14} /> <strong>生成中请勿刷新页面</strong>，否则将浪费一次生成额度
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
            {isEC ? <ShoppingCart size={10} /> : <Zap size={10} />}
            {isEC ? ' 电商冷知识' : ' 小红书冷知识'}
          </div>
          <div style={{
            fontSize: 'var(--text-sm)', color: 'var(--text-secondary)',
            lineHeight: 'var(--leading-relaxed)', minHeight: 32,
            transition: 'opacity 0.3s',
          }}>
            {tips[tipIdx]}
          </div>
        </div>

        {/* 旋转小提示 */}
        <div style={{
          fontSize: 'var(--text-xs)', color: 'var(--text-invisible)',
          marginTop: 20, display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 6,
        }}>
          <span style={{
            display: 'inline-block', width: 6, height: 6,
            borderRadius: '50%', background: isEC ? 'var(--blue)' : 'var(--red)',
            opacity: 0.4, animation: 'pulse 1.5s infinite',
          }} />
          正在努力生成...
        </div>
      </div>
    </div>
  );
}
