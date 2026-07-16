/**
 * 薯包AI · 精修工坊 — 重构版
 * 智能一键框 + 5 步精细配置
 */
import React, { useState, useRef } from 'react';
import { Upload, Sparkle, Package, Gear, Download, MagicWand } from '@phosphor-icons/react';
import { useApp } from '../../store/AppContext';
import { proxyImg, generateEcommerce, generateEcommercePreview, autoRecognizeEcommerce, stitchLongImage, saveWork, regenerateImage } from '../../services/api';
import { EC_CATS, EC_PLATFORM_DIMS, EC_DETAIL_SLICES, EC_SKU_FIELDS } from '../../constants/data';
import { IMAGES } from '../../constants/images';
import { CharImg } from '../../components/ui/index';
import Footer from '../../components/layout/Footer';

// ── 平台尺寸 helper ──
const DIMS = Object.fromEntries(
  Object.entries(EC_PLATFORM_DIMS).map(([p, v]) => [p, { 1: v['1:1'], 3: v['3:4'] }])
);
const dimSize = (p, ratio) => {
  const r = DIMS[p]?.[ratio === '3:4' ? 3 : 1] || [1440, 1440];
  return { w: r[0], h: r[1] };
};

const SX = {
  card: { background: '#fff', borderRadius: 12, border: '1px solid #E0E0E6', padding: '28px 32px' },
  label: { fontSize: 14, fontWeight: 600, color: '#2D2D3A', marginBottom: 8, display: 'block' },
  input: {
    width: '100%', padding: '11px 14px', border: '1.5px solid #D0D0D8', borderRadius: 8,
    fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
    background: '#fff', transition: 'border-color .15s', color: '#2D2D3A',
  },
  h3: { fontSize: 16, fontWeight: 600, color: '#2D2D3A', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 },
  hint: { fontSize: 13, color: '#666', lineHeight: 1.7 },
  stepNum: {
    width: 26, height: 26, borderRadius: '50%', background: '#4338CA', color: '#fff',
    fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
};

const EMPTY_SKU = { color: '', size: '', capacity: '', dimLabel: '' };
const EMPTY_DETAIL_PLAN = {
  sizeAnnot: true, scene: true, qc: false, compare: false, feature: true,
  notes: { sizeAnnot: '', scene: '', qc: '', compare: '', feature: '' },
};
const PLAN_KEY_BY_SLICE = {
  detail_slice_size: 'sizeAnnot',
  detail_slice_scene: 'scene',
  detail_slice_qc: 'qc',
  detail_slice_compare: 'compare',
  detail_slice_feature: 'feature',
};
const SLICE_KEY_BY_PLAN = {
  sizeAnnot: 'detail_slice_size',
  scene: 'detail_slice_scene',
  qc: 'detail_slice_qc',
  compare: 'detail_slice_compare',
  feature: 'detail_slice_feature',
};

export default function EcStudioPage() {
  const { dispatch } = useApp();
  const [smartBrief, setSmartBrief] = useState('');
  const [realShots, setRealShots] = useState([]);
  const [refShots, setRefShots] = useState([]);
  const [product, setProduct] = useState({ name: '', category: '', material: '', dimensions: '' });
  const [skus, setSkus] = useState([{ ...EMPTY_SKU }]);
  const [detailPlan, setDetailPlan] = useState({
    ...EMPTY_DETAIL_PLAN,
    notes: { ...EMPTY_DETAIL_PLAN.notes },
  });
  const [maintenance, setMaintenance] = useState('');
  const [platform, setPlatform] = useState('淘宝');

  const [showPlugin, setShowPlugin] = useState(false);
  const [phase, setPhase] = useState('config'); // config | preview | result
  const [ol, setOl] = useState([]);
  const [olLoad, setOlLoad] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const [recognizing, setRecognizing] = useState(false);
  const [lb, setLb] = useState(null);
  const [stitching, setStitching] = useState(false);
  const [stitchUrl, setStitchUrl] = useState(null);
  const [regKey, setRegKey] = useState('');
  const [regEdit, setRegEdit] = useState({ l: null, p: '', v: false });
  const fReal = useRef(null);
  const fRef = useRef(null);

  const name = product.name;
  const setName = (v) => setProduct((p) => ({ ...p, name: v }));

  // ── 上传图片 helper ──
  const addImg = (files, setter, cur, max) => {
    Array.from(files).slice(0, max - cur.length).forEach((f) => {
      const r = new FileReader();
      r.onload = (e) => setter((p) => (p.length >= max ? p : [...p, e.target.result]));
      r.readAsDataURL(f);
    });
  };

  // ── 智能识别 → 回填 5 步字段 ──
  const goRecognize = async () => {
    if (!smartBrief.trim() && refShots.length === 0) {
      setErr('请填写描述或上传参考图');
      return;
    }
    setRecognizing(true);
    setErr('');
    try {
      const r = await autoRecognizeEcommerce({ smartBrief: smartBrief.trim(), refShots });
      if (r.product) {
        setProduct((p) => ({ ...p, ...r.product, name: r.product.name || p.name }));
      }
      if (Array.isArray(r.skus) && r.skus.length) {
        setSkus(r.skus.map((s) => ({ ...EMPTY_SKU, ...s })));
      }
      if (r.detailPlan) {
        setDetailPlan({
          ...EMPTY_DETAIL_PLAN,
          ...r.detailPlan,
          notes: { ...EMPTY_DETAIL_PLAN.notes, ...(r.detailPlan.notes || {}) },
        });
      }
      if (r.maintenance) setMaintenance(r.maintenance);
    } catch (e) {
      setErr('AI 识别失败：' + (e.message || ''));
    }
    setRecognizing(false);
  };

  // ── SKU 行增删改 ──
  const addSkuRow = () => setSkus((p) => (p.length >= 20 ? p : [...p, { ...EMPTY_SKU }]));
  const delSkuRow = (i) => setSkus((p) => p.filter((_, j) => j !== i));
  const updSku = (i, field, v) => setSkus((p) => p.map((s, j) => (j === i ? { ...s, [field]: v } : s)));

  // ── 详情切片勾选 + 备注 ──
  const toggleSlice = (key) => setDetailPlan((p) => ({ ...p, [key]: !p[key] }));
  const updSliceNote = (key, v) =>
    setDetailPlan((p) => ({ ...p, notes: { ...p.notes, [key]: v } }));

  // ── 构建默认 selections（提交给后端） ──
  const buildSelections = () => {
    const sel = [
      { key: 'white_bg', count: 1 },
      { key: 'main_text', count: 5 },
      { key: 'main_3x4', count: 5 },
      { key: 'transparent', count: 1 },
    ];
    const validSkus = skus.filter((s) => s.color || s.size || s.capacity || s.dimLabel);
    if (validSkus.length) sel.push({ key: 'sku', count: validSkus.length });
    Object.entries(SLICE_KEY_BY_PLAN).forEach(([planKey, sliceKey]) => {
      if (detailPlan[planKey]) {
        sel.push({ key: sliceKey, count: 1, sliceNote: detailPlan.notes[planKey] || '' });
      }
    });
    if (maintenance.trim()) {
      sel.push({ key: 'detail_slice_care', count: 1, sliceNote: maintenance.trim() });
    }
    return sel;
  };

  const total = buildSelections().reduce((s, i) => s + (i.count || 1), 0);

  // ── 预览大纲 ──
  const goPreview = async () => {
    if (!name.trim()) return;
    setOlLoad(true);
    setErr('');
    try {
      const d = await generateEcommercePreview({
        productName: name.trim(),
        category: product.category,
        points: product.material || '',
        refCount: refShots.length,
        hasMaterial: !!product.material,
        imageSelections: buildSelections(),
        skus,
        detailPlan,
        maintenance,
      });
      const o = (d.outline || []).map((i, idx) => ({
        ...i,
        userPrompt: i.outlineText || '',
        refImageIndex: refShots.length > 0 ? idx % refShots.length : -1,
      }));
      setOl(o);
      setPhase('preview');
    } catch (e) {
      setErr('预览失败: ' + (e.message || ''));
    }
    setOlLoad(false);
  };

  // ── 生成 ──
  const goGen = async () => {
    if (!name.trim()) return;
    setErr('');
    dispatch({ type: 'START_GEN' });
    await new Promise((r) => setTimeout(r, 100));
    dispatch({ type: 'SET_STAGE', stage: 1 });
    await new Promise((r) => setTimeout(r, 100));
    try {
      const d = await generateEcommerce({
        productName: name,
        category: product.category,
        refImgs: refShots,
        realShots,
        platform,
        points: product.material || '',
        skus,
        detailPlan,
        maintenance,
        material: product.material,
        restrictions: '',
        imageSelections: buildSelections(),
      });
      dispatch({ type: 'SET_STAGE', stage: 2 });
      await new Promise((r) => setTimeout(r, 800));
      dispatch({ type: 'SET_STAGE', stage: 3 });
      await new Promise((r) => setTimeout(r, 600));
      dispatch({ type: 'CLOSE_RESULT' });
      setPhase('result');
      setRes(d);
      setStitchUrl(null);
      saveWork({
        ...d,
        _ecResult: true,
        _saveKey: 'ec-' + Date.now(),
        product_name: name,
        category: product.category,
        platform,
        at: new Date().toLocaleDateString('zh-CN'),
        images: d.images || {},
      });
    } catch (e) {
      const msg = e.message || '';
      setErr(
        '生成失败: ' +
          (msg.includes('Image API error') ? '图片API暂时不可用，请稍后重试' : msg.slice(0, 100))
      );
      setPhase('config');
      dispatch({ type: 'CLOSE_RESULT' });
    }
  };

  // ── 单图重生成 ──
  const goRegen = async (l, p) => {
    if (regKey) return;
    setRegKey(l);
    try {
      const url = await regenerateImage(p || '', product.category);
      if (url) {
        setRes((prev) =>
          prev ? { ...prev, images: { ...prev.images, [l]: url } } : prev
        );
      }
    } catch (e) {
      alert('重生成失败: ' + (e.message || ''));
    }
    setRegKey('');
    setRegEdit({ l: null, p: '', v: false });
  };

  // ── 拼长图（详情切片） ──
  const goStitch = async () => {
    const sliceUrls = Object.entries(res?.images || {})
      .filter(([k]) => k.includes('detail_slice'))
      .map(([, u]) => u);
    if (sliceUrls.length < 2) {
      setErr('至少需要 2 张详情切片才能拼长图');
      return;
    }
    setStitching(true);
    setErr('');
    try {
      const r = await stitchLongImage(sliceUrls);
      setStitchUrl(r.url);
    } catch (e) {
      setErr('拼长图失败：' + (e.message || ''));
    }
    setStitching(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F6F7F9' }}>
      <div style={{ maxWidth: 'var(--max-width-narrow)', margin: '0 auto', padding: '32px 24px 80px' }}>
        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
            onClick={() => dispatch({ type: 'NAVIGATE', page: 'home' })}
          >
            <CharImg src={IMAGES.appicon} size={32} float />
            <span style={{ fontSize: 18, fontWeight: 650, color: '#E53E3E' }}>薯包AI</span>
            <span
              style={{
                fontSize: 12, color: '#6366F1', background: '#EEF2FF', padding: '3px 10px',
                borderRadius: 6, fontWeight: 500,
              }}
            >
              精修工坊
            </span>
          </div>
          <button
            onClick={() => {
              dispatch({ type: 'NAVIGATE', page: 'home' });
              dispatch({ type: 'SET_MODE', mode: 'ecommerce' });
            }}
            style={{
              fontSize: 13, color: '#6366F1', background: '#EEF2FF', border: '1px solid #C7D2FE',
              borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', fontWeight: 500,
            }}
          >
            <Sparkle weight="fill" size={14} /> 一键出图
          </button>
        </div>

        {err && (
          <div
            style={{
              background: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: 8,
              padding: '12px 16px', marginBottom: 20, fontSize: 14, color: '#C53030',
              lineHeight: 1.5,
            }}
          >
            {err}
          </div>
        )}

        {/* ═══════ CONFIG ═══════ */}
        {phase === 'config' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* ① 插件导入卡片（保留不动） */}
            <div style={SX.card}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: 52, height: 52, borderRadius: 12,
                    background: 'linear-gradient(135deg,#EEF2FF,#E0E7FF)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, color: '#4338CA',
                  }}
                >
                  <Package weight="fill" size={26} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={SX.h3}>🔄 一键复刻爆款商品图</h3>
                  <p style={{ ...SX.hint, marginBottom: 16 }}>
                    看到别人的商品图好看又卖得好？装插件 → 去爆款商品页点一下 → 自动抓取商品名称、多张商品图、卖点文案。
                    <strong>然后直接用薯包AI生成你自己商品的同款风格图片</strong>。
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setShowPlugin(true)}
                      style={{
                        padding: '9px 20px', borderRadius: 8, background: '#4338CA', color: '#fff',
                        border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6,
                        boxShadow: '0 2px 8px rgba(67,56,202,.2)',
                      }}
                    >
                      📥 下载插件
                    </button>
                    <span style={{ fontSize: 12, color: '#aaa' }}>
                      470KB · Chrome/Edge · 装一次永久用
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                {['抓取爆款商品名称', '抓取多张商品图', '提取卖点与价格', '复刻同款视觉风格'].map((t) => (
                  <span
                    key={t}
                    style={{
                      fontSize: 12, color: '#166534', background: '#F0FDF4',
                      padding: '4px 10px', borderRadius: 6, fontWeight: 500,
                    }}
                  >
                    ✅ {t}
                  </span>
                ))}
              </div>
            </div>

            {/* 插件 Modal（保留不动） */}
            {showPlugin && (
              <div
                style={{
                  position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.45)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
                }}
                onClick={() => setShowPlugin(false)}
              >
                <div
                  style={{ background: '#fff', borderRadius: 16, maxWidth: 460, width: '100%', padding: 24 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      marginBottom: 18,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <img src={IMAGES.appicon} alt="" style={{ width: 36, height: 36, borderRadius: 8 }} />
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: '#1a1a2e' }}>
                          安装薯包AI提取插件
                        </div>
                        <div style={{ fontSize: 11, color: '#999' }}>470KB · Chrome / Edge 浏览器</div>
                      </div>
                    </div>
                    <div
                      onClick={() => setShowPlugin(false)}
                      style={{
                        width: 26, height: 26, borderRadius: '50%', background: '#f0f0f0',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: '#888', fontSize: 14, lineHeight: 1, flexShrink: 0,
                      }}
                    >
                      ✕
                    </div>
                  </div>
                  <a
                    href="/extensions/shubao-extractor.zip"
                    download
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                      background: '#F5F3FF', borderRadius: 10, textDecoration: 'none', marginBottom: 18,
                    }}
                  >
                    <div
                      style={{
                        width: 40, height: 40, borderRadius: 8, background: '#4338CA',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: 18,
                      }}
                    >
                      ⬇
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>下载插件 ZIP 包</div>
                      <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>
                        470KB · 解压后加载到浏览器即可使用
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 12, fontWeight: 600, color: '#4338CA', background: '#fff',
                        padding: '6px 14px', borderRadius: 6, border: '1px solid #C7D2FE',
                      }}
                    >
                      下载
                    </span>
                  </a>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 10 }}>
                    安装步骤
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      '下载 ZIP 包并解压到电脑上的任意文件夹',
                      '地址栏输入 chrome://extensions 或 edge://extensions',
                      '开启右上角「开发者模式」',
                      '点击「加载已解压的扩展程序」→ 选中解压好的文件夹',
                      '打开任意商品页 → 点浏览器右上角的薯包图标 → 自动提取商品信息，一键发送到精修工坊 🎉',
                    ].map((t, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex', gap: 10, alignItems: 'flex-start',
                          padding: '8px 12px',
                          background: i === 4 ? 'linear-gradient(135deg,#F5F3FF,#EDE9FE)' : '#FAFBFC',
                          borderRadius: 8, border: `1px solid ${i === 4 ? '#C7D2FE' : '#EEEFF2'}`,
                        }}
                      >
                        <div
                          style={{
                            width: 22, height: 22, borderRadius: '50%',
                            background: i === 4 ? '#7C3AED' : '#4338CA',
                            color: '#fff', fontSize: 11, fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, marginTop: 1,
                          }}
                        >
                          {i + 1}
                        </div>
                        <div style={{ fontSize: 12, color: '#555', lineHeight: 1.6 }}>{t}</div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowPlugin(false)}
                    style={{
                      width: '100%', padding: '12px 0', border: 'none', borderRadius: 8,
                      background: '#4338CA', color: '#fff', fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit', marginTop: 16,
                    }}
                  >
                    安装好了，开始使用
                  </button>
                </div>
              </div>
            )}

            {/* 智能一键框 */}
            <div
              style={{
                ...SX.card,
                background: 'linear-gradient(135deg,#EEF2FF,#F5F3FF)',
                borderColor: '#C7D2FE',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <MagicWand weight="fill" size={20} style={{ color: '#4338CA' }} />
                <h3 style={{ ...SX.h3, marginBottom: 0 }}>📝 智能一键</h3>
                <span style={{ fontSize: 12, color: '#6366F1', fontWeight: 400 }}>
                  用一段话描述想要的商品图，AI 自动填下方 5 步
                </span>
              </div>
              <textarea
                value={smartBrief}
                onChange={(e) => setSmartBrief(e.target.value)}
                placeholder="例：我要卖一款月岩白的无线蓝牙耳机，材质亲肤硅胶，有3个颜色，主打降噪和长续航，需要尺寸标注和场景图，保养就是避免进水…"
                rows={3}
                style={{
                  ...SX.input, minHeight: 80, resize: 'vertical', fontSize: 14, lineHeight: 1.6,
                }}
                onFocus={(e) => (e.target.style.borderColor = '#6366F1')}
                onBlur={(e) => (e.target.style.borderColor = '#D0D0D8')}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                <button
                  onClick={goRecognize}
                  disabled={recognizing}
                  style={{
                    padding: '10px 20px', borderRadius: 8, background: '#4338CA', color: '#fff',
                    border: 'none', fontSize: 13, fontWeight: 600,
                    cursor: recognizing ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    opacity: recognizing ? 0.6 : 1,
                  }}
                >
                  <Sparkle weight="fill" size={14} /> {recognizing ? 'AI 识别中...' : '🤖 AI 自动识别'}
                </button>
                <span style={{ fontSize: 12, color: '#888', alignSelf: 'center' }}>
                  识别后自动填到下方 5 步，可手动改
                </span>
              </div>
            </div>

            {/* ① 实拍图 */}
            <div style={SX.card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={SX.stepNum}>1</div>
                <h3 style={{ ...SX.h3, marginBottom: 0 }}>上传产品多角度实拍图</h3>
              </div>
              <p style={{ ...SX.hint, marginBottom: 16 }}>
                推荐角度：正面 / 45°侧面 / 细节 / 包装 / 场景。AI 会以这些实拍为准生成，最多 10 张。
              </p>
              <ImageUploader
                imgs={realShots}
                setImgs={setRealShots}
                max={10}
                onPick={() => fReal.current?.click()}
                onDel={(i) => setRealShots((p) => p.filter((_, j) => j !== i))}
                onPreview={setLb}
              />
              <input
                ref={fReal}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  addImg(e.target.files, setRealShots, realShots, 10);
                  e.target.value = '';
                }}
              />
            </div>

            {/* ② 参考图 */}
            <div style={SX.card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={SX.stepNum}>2</div>
                <h3 style={{ ...SX.h3, marginBottom: 0 }}>上传目标参考图</h3>
                <span style={{ fontSize: 12, color: '#bbb' }}>选填 · 最多 5 张</span>
              </div>
              <p style={{ ...SX.hint, marginBottom: 16 }}>
                想模仿的风格 / 竞品爆款图，AI 会学习它的视觉调性。
              </p>
              <ImageUploader
                imgs={refShots}
                setImgs={setRefShots}
                max={5}
                onPick={() => fRef.current?.click()}
                onDel={(i) => setRefShots((p) => p.filter((_, j) => j !== i))}
                onPreview={setLb}
              />
              <input
                ref={fRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  addImg(e.target.files, setRefShots, refShots, 5);
                  e.target.value = '';
                }}
              />
            </div>

            {/* ③ 规格 + SKU */}
            <div style={SX.card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={SX.stepNum}>3</div>
                <h3 style={{ ...SX.h3, marginBottom: 0 }}>产品尺寸颜色规格</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={SX.label}>
                    商品名称 <span style={{ color: '#E53E3E' }}>*</span>
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="高保湿精华液、无线蓝牙耳机…"
                    style={SX.input}
                    onFocus={(e) => (e.target.style.borderColor = '#6366F1')}
                    onBlur={(e) => (e.target.style.borderColor = '#D0D0D8')}
                  />
                </div>
                <div>
                  <label style={SX.label}>品类</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {EC_CATS.map((c) => (
                      <span
                        key={c}
                        onClick={() => setProduct((p) => ({ ...p, category: c }))}
                        style={{
                          padding: '6px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                          fontFamily: 'inherit', border: '1.5px solid',
                          background: product.category === c ? '#EEF2FF' : '#fff',
                          borderColor: product.category === c ? '#6366F1' : '#DDDDE3',
                          color: product.category === c ? '#4338CA' : '#888',
                          fontWeight: product.category === c ? 600 : 400,
                        }}
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={SX.label}>尺寸标注（长×宽×高 cm）</label>
                  <input
                    value={product.dimensions}
                    onChange={(e) => setProduct((p) => ({ ...p, dimensions: e.target.value }))}
                    placeholder="20×10×5"
                    style={SX.input}
                    onFocus={(e) => (e.target.style.borderColor = '#6366F1')}
                    onBlur={(e) => (e.target.style.borderColor = '#D0D0D8')}
                  />
                </div>
                <div>
                  <label style={SX.label}>材质 / 工艺</label>
                  <input
                    value={product.material}
                    onChange={(e) => setProduct((p) => ({ ...p, material: e.target.value }))}
                    placeholder="亲肤硅胶、304不锈钢…"
                    style={SX.input}
                    onFocus={(e) => (e.target.style.borderColor = '#6366F1')}
                    onBlur={(e) => (e.target.style.borderColor = '#D0D0D8')}
                  />
                </div>
              </div>

              {/* SKU 变体表 */}
              <div style={{ marginTop: 8 }}>
                <div
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: 8,
                  }}
                >
                  <label style={{ ...SX.label, marginBottom: 0 }}>
                    SKU 变体配置（每行 = 一张 SKU 规格图）
                  </label>
                  <button
                    onClick={addSkuRow}
                    style={{
                      padding: '5px 12px', borderRadius: 6, background: '#EEF2FF',
                      color: '#4338CA', border: '1px solid #C7D2FE', fontSize: 12,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    + 添加变体
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {skus.map((s, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex', gap: 8, alignItems: 'center', padding: '8px',
                        background: '#FAFBFC', borderRadius: 8, border: '1px solid #EEEEF2',
                      }}
                    >
                      <span style={{ fontSize: 12, color: '#888', minWidth: 28 }}>#{i + 1}</span>
                      {EC_SKU_FIELDS.map((f) => (
                        <input
                          key={f.key}
                          value={s[f.key]}
                          onChange={(e) => updSku(i, f.key, e.target.value)}
                          placeholder={f.placeholder}
                          maxLength={f.maxLen}
                          style={{
                            flex: 1, padding: '7px 10px', border: '1px solid #DDDDE3',
                            borderRadius: 6, fontSize: 12, fontFamily: 'inherit', outline: 'none',
                            boxSizing: 'border-box',
                          }}
                          onFocus={(e) => (e.target.style.borderColor = '#6366F1')}
                          onBlur={(e) => (e.target.style.borderColor = '#DDDDE3')}
                        />
                      ))}
                      {skus.length > 1 && (
                        <button
                          onClick={() => delSkuRow(i)}
                          style={{
                            width: 24, height: 24, borderRadius: 6, background: '#fff',
                            border: '1px solid #DDDDE3', color: '#FF4757', cursor: 'pointer',
                            fontSize: 14, flexShrink: 0,
                          }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 6 }}>
                  颜色名 ≤4 字，AI 严格按你填的生成，不自创。
                </div>
              </div>
            </div>

            {/* ④ 详情策划 */}
            <div style={SX.card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={SX.stepNum}>4</div>
                <h3 style={{ ...SX.h3, marginBottom: 0 }}>详情页策划思路</h3>
                <span style={{ fontSize: 12, color: '#bbb' }}>
                  勾选 = 生成一张详情切片（1440 宽）
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {EC_DETAIL_SLICES.filter((s) => s.key !== 'detail_slice_care').map((s) => {
                  const planKey = PLAN_KEY_BY_SLICE[s.key];
                  const checked = detailPlan[planKey];
                  return (
                    <div
                      key={s.key}
                      style={{
                        padding: '10px 12px', borderRadius: 8,
                        border: `1px solid ${checked ? '#C7D2FE' : '#EEEEF2'}`,
                        background: checked ? '#F5F3FF' : '#FAFBFC',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input
                          type="checkbox"
                          checked={!!checked}
                          onChange={() => toggleSlice(planKey)}
                          style={{ width: 16, height: 16, cursor: 'pointer' }}
                        />
                        <span
                          style={{
                            fontSize: 14, fontWeight: 600,
                            color: checked ? '#4338CA' : '#555',
                          }}
                        >
                          {s.emoji} {s.label}
                        </span>
                        <span style={{ fontSize: 12, color: '#888' }}>{s.desc}</span>
                      </div>
                      {checked && (
                        <input
                          value={detailPlan.notes[planKey] || ''}
                          onChange={(e) => updSliceNote(planKey, e.target.value)}
                          placeholder="补一句自定义文案（选填）"
                          style={{
                            width: '100%', marginTop: 8, padding: '7px 10px',
                            border: '1px solid #DDDDE3', borderRadius: 6, fontSize: 12,
                            fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                          }}
                          onFocus={(e) => (e.target.style.borderColor = '#6366F1')}
                          onBlur={(e) => (e.target.style.borderColor = '#DDDDE3')}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ⑤ 保养维护 */}
            <div style={SX.card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={SX.stepNum}>5</div>
                <h3 style={{ ...SX.h3, marginBottom: 0 }}>保养维护描述</h3>
              </div>
              <p style={{ ...SX.hint, marginBottom: 12 }}>
                用一句话写保养方式，AI 生成 1 张保养说明切片。
              </p>
              <textarea
                value={maintenance}
                onChange={(e) => setMaintenance(e.target.value)}
                placeholder="避免暴晒、温水手洗、存放干燥处…"
                rows={2}
                style={{ ...SX.input, minHeight: 56, resize: 'vertical', fontSize: 13 }}
                onFocus={(e) => (e.target.style.borderColor = '#6366F1')}
                onBlur={(e) => (e.target.style.borderColor = '#D0D0D8')}
              />
            </div>

            {/* 平台选择 + 生成 */}
            <div style={SX.card}>
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 12,
                }}
              >
                <h3 style={{ ...SX.h3, marginBottom: 0 }}>
                  <Gear weight="fill" size={18} style={{ color: '#666' }} /> 目标平台
                </h3>
                <span style={{ fontSize: 14, color: '#999' }}>共 {total} 张</span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {['淘宝', '京东', '拼多多', '小红书电商', '抖音电商', '亚马逊'].map((p) => {
                  const d = dimSize(p, '1:1');
                  return (
                    <span
                      key={p}
                      onClick={() => setPlatform(p)}
                      style={{
                        padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                        fontFamily: 'inherit', border: '1.5px solid',
                        background: platform === p ? '#EEF2FF' : '#fff',
                        borderColor: platform === p ? '#6366F1' : '#DDDDE3',
                        color: platform === p ? '#4338CA' : '#888',
                        fontWeight: platform === p ? 600 : 400,
                      }}
                    >
                      {p} · {d.w}×{d.h}
                    </span>
                  );
                })}
              </div>
              <button
                onClick={goPreview}
                disabled={!name.trim() || olLoad}
                style={{
                  width: '100%', padding: '16px 0', border: 'none', borderRadius: 12,
                  fontSize: 16, fontWeight: 700, fontFamily: 'inherit',
                  cursor: !name.trim() || olLoad ? 'not-allowed' : 'pointer',
                  background: !name.trim() || olLoad ? '#E0E0E0' : '#4338CA',
                  color: '#fff',
                  boxShadow: !name.trim() || olLoad ? 'none' : '0 4px 16px rgba(67,56,202,.3)',
                }}
              >
                {olLoad ? '生成大纲中...' : `预览并生成（${total} 张）`}
              </button>
            </div>
          </div>
        )}

        {/* ═══════ PREVIEW ═══════ */}
        {phase === 'preview' && (
          <div style={SX.card}>
            <h3 style={{ ...SX.h3, marginBottom: 4 }}>📋 生成大纲 — 共 {ol.length} 张图</h3>
            <p style={{ ...SX.hint, marginBottom: 20 }}>
              每张图可自定义生成逻辑，确认后开始生成
            </p>
            {refShots.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
                  参考图（{refShots.length} 张）
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {refShots.map((s, i) => (
                    <div
                      key={i}
                      style={{
                        width: 44, height: 44, borderRadius: 6, overflow: 'hidden',
                        border: '1px solid #E8E8EC', cursor: 'pointer',
                      }}
                      onClick={() => setLb(s)}
                    >
                      <img src={s} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {ol.map((item, idx) => (
              <div
                key={idx}
                style={{
                  marginBottom: 10, padding: '12px 16px', borderRadius: 8,
                  background: '#F8F9FA', border: '1px solid #EEEEF2',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span
                    style={{
                      width: 24, height: 24, borderRadius: 6, background: '#4338CA', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, flexShrink: 0,
                    }}
                  >
                    {idx + 1}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>
                    {item.emoji || ''} {item.label}
                  </span>
                </div>
                <textarea
                  value={item.userPrompt}
                  onChange={(e) => {
                    const v = e.target.value;
                    setOl((p) => p.map((o, i) => (i === idx ? { ...o, userPrompt: v } : o)));
                  }}
                  style={{
                    width: '100%', padding: '8px 12px', border: '1px solid #DDDDE3',
                    borderRadius: 6, fontSize: 12, fontFamily: 'inherit', outline: 'none',
                    resize: 'vertical', minHeight: 40, boxSizing: 'border-box', background: '#fff',
                  }}
                  rows={2}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button
                onClick={() => setPhase('config')}
                style={{
                  flex: 1, padding: '13px 0', borderRadius: 8, border: '1.5px solid #DDDDE3',
                  background: '#fff', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit',
                  color: '#666', fontWeight: 500,
                }}
              >
                ← 返回修改
              </button>
              <button
                onClick={goGen}
                style={{
                  flex: 2, padding: '13px 0', borderRadius: 8, border: 'none',
                  background: '#059669', color: '#fff', cursor: 'pointer', fontSize: 14,
                  fontWeight: 600, fontFamily: 'inherit',
                  boxShadow: '0 2px 8px rgba(5,150,105,.2)',
                }}
              >
                ✅ 确认生成 {ol.length} 张
              </button>
            </div>
          </div>
        )}

        {/* ═══════ RESULT ═══════ */}
        {phase === 'result' && res && (
          <div style={SX.card}>
            <div
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <div>
                <span style={{ fontSize: 16, fontWeight: 600, color: '#059669' }}>✅ 生成完成</span>
                <span style={{ fontSize: 13, color: '#999', marginLeft: 8 }}>
                  {Object.keys(res.images || {}).length} 张图
                </span>
              </div>
              <button
                onClick={() => {
                  setPhase('config');
                  setRes(null);
                  setStitchUrl(null);
                }}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: '1px solid #DDDDE3',
                  background: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
                  color: '#888',
                }}
              >
                继续生成
              </button>
            </div>
            {/* 拼长图按钮 */}
            {Object.keys(res.images || {}).some((k) => k.includes('detail_slice')) && (
              <div
                style={{
                  background: '#F5F3FF', borderRadius: 8, padding: '12px 16px',
                  marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontSize: 13, color: '#4338CA', fontWeight: 500 }}>
                  📦 详情切片可拼成长图（微信分享用）
                </span>
                <button
                  onClick={goStitch}
                  disabled={stitching}
                  style={{
                    padding: '8px 16px', borderRadius: 6, background: '#4338CA', color: '#fff',
                    border: 'none', fontSize: 12, fontWeight: 600,
                    cursor: stitching ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                    opacity: stitching ? 0.6 : 1,
                  }}
                >
                  {stitching ? '拼接中...' : '🔗 拼成长图'}
                </button>
                {stitchUrl && (
                  <a
                    href={proxyImg(stitchUrl)}
                    download
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: '8px 16px', borderRadius: 6, background: '#059669',
                      color: '#fff', textDecoration: 'none', fontSize: 12, fontWeight: 600,
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    <Download weight="fill" size={14} /> 下载长图
                  </a>
                )}
                {stitchUrl && (
                  <img
                    src={proxyImg(stitchUrl)}
                    alt="长图预览"
                    style={{
                      width: '100%', marginTop: 8, borderRadius: 8, border: '1px solid #EEE',
                    }}
                  />
                )}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {Object.entries(res.images || {}).map(([l, u]) => (
                <div
                  key={l}
                  style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #EEEEF2' }}
                >
                  <div style={{ cursor: 'zoom-in' }} onClick={() => setLb(u)}>
                    <img
                      src={proxyImg(u)}
                      alt={l}
                      style={{
                        width: '100%', display: 'block', aspectRatio: '1/1',
                        objectFit: 'contain', background: '#f8f8f8',
                      }}
                      loading="lazy"
                    />
                  </div>
                  <div
                    style={{
                      padding: '10px 12px', display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', borderTop: '1px solid #EEEEF2',
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>{l}</span>
                    {regEdit.v && regEdit.l === l ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => setRegEdit({ l: null, p: '', v: false })}
                          style={{
                            fontSize: 11, padding: '4px 10px', borderRadius: 6,
                            border: '1px solid #DDDDE3', background: '#fff', cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          取消
                        </button>
                        <button
                          onClick={() => goRegen(l, regEdit.p)}
                          disabled={!!regKey}
                          style={{
                            fontSize: 11, padding: '4px 10px', borderRadius: 6, border: 'none',
                            background: '#4338CA', color: '#fff', cursor: 'pointer',
                            fontFamily: 'inherit', opacity: regKey ? 0.5 : 1,
                          }}
                        >
                          {regKey ? '...' : '重新生成'}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          const p =
                            ol.find((o) => o.key === l.replace(/_\d+$/, '') || o.label === l)
                              ?.userPrompt || '';
                          setRegEdit({ l, p, v: true });
                        }}
                        style={{
                          fontSize: 11, color: '#4338CA', cursor: 'pointer',
                          padding: '4px 10px', borderRadius: 6, background: '#EEF2FF',
                          border: 'none', fontFamily: 'inherit',
                        }}
                      >
                        重新生成
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lightbox */}
        {lb && (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 1001, background: 'rgba(0,0,0,.92)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
            onClick={() => setLb(null)}
          >
            <img
              src={lb.startsWith('data:') ? lb : proxyImg(lb)}
              style={{
                maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 12,
              }}
              alt=""
            />
          </div>
        )}

        <div style={{ marginTop: 48 }}>
          <Footer />
        </div>
      </div>
    </div>
  );
}

// ── 图片上传小组件（实拍图/参考图共用） ──
function ImageUploader({ imgs, max, onPick, onDel, onPreview }) {
  return (
    <>
      {imgs.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {imgs.map((s, i) => (
            <div
              key={i}
              style={{
                position: 'relative', width: 72, height: 72, borderRadius: 8, overflow: 'hidden',
                border: '1px solid #E8E8EC', cursor: 'pointer',
              }}
              onClick={() => onPreview(s)}
            >
              <img src={s} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onDel(i);
                }}
                style={{
                  position: 'absolute', top: 2, right: 2, width: 18, height: 18,
                  borderRadius: '50%', background: '#FF4757', color: '#fff', fontSize: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', border: 'none', fontWeight: 700,
                }}
              >
                ×
              </div>
            </div>
          ))}
        </div>
      )}
      <div
        onClick={onPick}
        style={{
          border: '2px dashed #DDDDE3', borderRadius: 10, padding: '24px',
          textAlign: 'center', cursor: 'pointer', background: '#FAFBFC',
          transition: 'all .15s', color: '#bbb',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#6366F1';
          e.currentTarget.style.background = '#F5F3FF';
          e.currentTarget.style.color = '#6366F1';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#DDDDE3';
          e.currentTarget.style.background = '#FAFBFC';
          e.currentTarget.style.color = '#bbb';
        }}
      >
        <Upload
          weight="fill"
          size={22}
          style={{ display: 'block', margin: '0 auto 6px', color: 'inherit' }}
        />
        <div style={{ fontSize: 13, fontWeight: 500, color: 'inherit' }}>
          点击上传（{imgs.length}/{max}）
        </div>
      </div>
    </>
  );
}
