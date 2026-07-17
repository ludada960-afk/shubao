import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Upload, Image, Settings, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import EcExpertPanel from './EcExpertPanel';
import { generateEcommerce } from '../../services/api';

/**
 * 电商生图模式 — 统一入口（简单输入 + 折叠精修面板）
 * 简单模式：一句话输入 → 按预设自动生成
 * 专业模式：展开精修工坊面板 → 5步深度定制
 */
export default function EcMode() {
  const { state, dispatch } = useApp();
  const { logged, credits } = state;
  const [ecName, setEcName] = useState('');
  const [err, setErr] = useState('');
  const [expertOpen, setExpertOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  // 精修面板参数（上层透传）
  const [refShots, setRefShots] = useState([]);     // 实拍图
  const [refStyles, setRefStyles] = useState([]);    // 风格参考图
  const [productParams, setProductParams] = useState({ size: '', baseColor: '', accentColor: '', material: '', craft: '' });
  const [skus, setSkus] = useState([]);
  const [copywriting, setCopywriting] = useState({ plan: '', sellingPoints: '', qc: '', details: '', maintenance: '' });
  const [platform, setPlatform] = useState('淘宝');

  const doGen = async () => {
    if (!ecName.trim()) { setErr('请输入商品描述'); return; }
    setErr('');
    setGenerating(true);
    try {
      // 合并简单输入 + 精修面板参数
      const body = {
        productName: ecName.trim(),
        category: productParams.category || '其他',
        refImgs: refStyles.concat(refShots.map(s => s.preview)),
        platform,
        points: expertOpen ? copywriting.sellingPoints : '',
        skus: expertOpen ? skus : [],
        detailPlan: expertOpen && copywriting.plan ? copywriting.plan : null,
        maintenance: expertOpen ? copywriting.maintenance : '',
        material: expertOpen ? productParams.material : '',
      };
      // TODO：接入 generateEcommerce SSE 流
      // 临时 - 直接 call server preview 看参数是否正确
      const preview = await fetch('/api/ecommerce-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_name: ecName.trim(),
          category: productParams.category || '其他',
          selling_points: expertOpen ? copywriting.sellingPoints : '',
          has_material: expertOpen ? !!productParams.material : false,
          skus: expertOpen ? skus : [],
        }),
      });
      const d = await preview.json();
      if (d.product_name) {
        dispatch({ type: 'START_GEN' });
        dispatch({ type: 'SET_RESULT', result: { ...d, product_name: ecName.trim(), _ecResult: true } });
      }
    } catch (e) { setErr(e.message); }
    setGenerating(false);
  };

  return (
    <div>
      {/* 一句话输入 */}
      <div style={{ marginBottom: 16 }}>
        <textarea
          value={ecName} onChange={e => { setEcName(e.target.value); setErr(''); }}
          placeholder=" "
          style={{
            width: '100%', border: 'none', background: 'transparent',
            fontSize: 18, color: 'var(--text-primary)',
            outline: 'none', resize: 'none', minHeight: 60,
            lineHeight: 1.7,
          }}
        />
        <div style={{
          position: 'absolute', top: 0, left: 24, right: 24, pointerEvents: 'none',
          paddingTop: 22, display: ecName ? 'none' : 'block',
        }}>
          <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-hint)', marginBottom: 4 }}>
            ✍️ 一句话描述你的商品
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-faint)' }}>
            例如：白色陶瓷杯简约办公风 / 无线蓝牙耳机运动款
          </div>
        </div>
      </div>

      {/* 折叠精修面板入口 */}
      <div onClick={() => setExpertOpen(!expertOpen)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderRadius: 'var(--radius-md)',
          background: 'var(--accent-bg)', cursor: 'pointer',
          marginBottom: expertOpen ? 20 : 0,
          transition: 'all 0.2s',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Settings size={16} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>精修工坊</span>
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>— 专业参数自定义</span>
        </div>
        {expertOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>

      {/* 展开的精修面板 */}
      {expertOpen && (
        <EcExpertPanel
          refShots={refShots}
          setRefShots={setRefShots}
          refStyles={refStyles}
          setRefStyles={setRefStyles}
          productParams={productParams}
          setProductParams={setProductParams}
          skus={skus}
          setSkus={setSkus}
          copywriting={copywriting}
          setCopywriting={setCopywriting}
          platform={platform}
          setPlatform={setPlatform}
        />
      )}

      {err && <div style={{ padding: '10px 16px', marginTop: 12, background: 'var(--red-bg)', borderRadius: 'var(--radius-md)', color: 'var(--red)', fontSize: 13, fontWeight: 500 }}>{err}</div>}

      {/* 生成按钮 */}
      <button onClick={doGen} disabled={!ecName.trim() || generating}
        style={{
          width: '100%', marginTop: 20, display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 8,
          padding: '14px 24px', border: 'none',
          borderRadius: 'var(--radius-full)',
          background: !ecName.trim() ? 'var(--text-ghost)' : 'var(--accent)',
          color: '#fff', fontSize: 16, fontWeight: 600,
          cursor: !ecName.trim() ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          transition: 'all 0.2s',
          boxShadow: !ecName.trim() ? 'none' : 'var(--shadow-lg)',
        }}>
        <Sparkles size={18} />
        {generating ? '生成中...' : '一键生成全套电商图'}
      </button>

      <div style={{ textAlign: 'center', marginTop: 10, fontSize: 12, color: 'var(--text-faint)' }}>
        {!ecName.trim() ? '输入商品描述，无需参数也能一键出图' :
         '✨ 已进入专业模式 — AI 将根据参数精确生成'}
      </div>
    </div>
  );
}
