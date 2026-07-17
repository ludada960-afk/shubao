import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Sparkles, Upload, ChevronRight, Pencil, ShoppingCart, Target, Palette, RefreshCw, Copy, Monitor, ShieldCheck, ChevronDown, ChevronUp, Eye, Check, X, RotateCcw as RotateIcon, Lightbulb, Settings, ImagePlus } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { IMAGES } from '../../constants/images';
import { GALLERY, QUICK_HINTS, PRICING_XHS, PRICING_EC, EC_CATS, EC_PLATFORM_DIMS, EC_IMG_RATIOS, EC_MAIN_TYPES } from '../../constants/data';
// 兼容：旧版首页电商 tab 仍引用已删除的 EC_ADV_TYPES / EC_STYLE_PACKS。
// 用本地 stub 保持旧 tab 的运行行为不变（type-shape 与常量同名；服务端忽略 stylePack）。
const EC_ADV_TYPES = [
  { key:'scene',        label:'使用场景图', emoji:'🌿', mandatory:false, defaultCount:0, maxCount:4, desc:'产品出现在真实使用环境中' },
  { key:'detail',       label:'详情图',     emoji:'📋', mandatory:false, defaultCount:0, maxCount:6, desc:'每张讲一个卖点' },
  { key:'feature',      label:'卖点解说图', emoji:'💬', mandatory:false, defaultCount:0, maxCount:6, desc:'在白底/场景上加卖点标注' },
  { key:'composite',    label:'组合图',     emoji:'🎁', mandatory:false, defaultCount:0, maxCount:2, desc:'全家福 / 套装组合' },
  { key:'package',      label:'包装图',     emoji:'📦', mandatory:false, defaultCount:0, maxCount:2, desc:'外包装 / 配件 / 标签' },
  { key:'macro',        label:'特写图',     emoji:'🔍', mandatory:false, defaultCount:0, maxCount:3, desc:'材质/工艺微距' },
  { key:'comparison',   label:'对比图',     emoji:'⚖️', mandatory:false, defaultCount:0, maxCount:2, desc:'vs 同款 / 自家多色' },
];
const EC_STYLE_PACKS = [
  { key:'scene_selling', label:'场景种草', subtitle:'卖场景', desc:'产品放在真实使用场景里', img:'', ar:'1/1' },
  { key:'detail_selling',label:'卖点图解', subtitle:'卖功能', desc:'每张图讲一个核心卖点',    img:'', ar:'1/1' },
  { key:'ugc_trust',     label:'买家秀风', subtitle:'真实感',desc:'模拟用户晒单的口吻',       img:'', ar:'1/1' },
  { key:'brand_unified', label:'品牌统一', subtitle:'统一感',desc:'全套视觉风格一致',          img:'', ar:'1/1' },
  { key:'promo_sale',    label:'促销热卖', subtitle:'促销感',desc:'价格/优惠/抢购角标',        img:'', ar:'1/1' },
  { key:'',              label:'无风格（默认）', subtitle:'自动',desc:'AI 自由发挥',         img:'', ar:'1/1' },
];
import { proxyImg, generateContent, generateEcommerce, generateEcommercePreview, regenerateImage, saveWork, getTrialStatus, consumeTrial } from '../../services/api';
import { getSession } from '../../services/auth';
import { CharImg } from '../../components/ui/index';
import Button from '../../components/ui/Button';
import './Home.css';

// 提取会话守卫（模块级，跨 StrictMode 双渲染保持状态）
let _extractSessionToken = null;

export default function HomePage({ inlineMode, compactMode, renderMode }) {
  const { state, dispatch } = useApp();
  const { inputText, logged, credits, mode } = state;
  const [err, setErr] = useState('');
  const [refImages, setRefImages] = useState([]);
  const fileRef = useRef(null);
  const [trialRemaining, setTrialRemaining] = useState(0);
  // 小红书子模式：content(种草) / plog(生活碎片)
  const [xhsSubMode, setXhsSubMode] = useState('content');

  // Plog 专属状态
  const [plogText, setPlogText] = useState('');
  const [plogStyle, setPlogStyle] = useState('ins-minimal');
  const [plogLayout, setPlogLayout] = useState('casual');
  const [plogRefImg, setPlogRefImg] = useState(null);
  const [plogRefPreview, setPlogRefPreview] = useState('');
  const plogFileRef = useRef(null);

  const [ecName, setEcName] = useState('');
  const [ecCat, setEcCat] = useState('美妆护肤');
  const [ecRefImgs, setEcRefImgs] = useState([]);
  const [ecStylePack, setEcStylePack] = useState('');
  const [ecSelections, setEcSelections] = useState([]);
  const [ecPlatform, setEcPlatform] = useState('淘宝');
  const [ecPoints, setEcPoints] = useState('');       // 逗号/分号/换行分隔
  const [ecBeauty, setEcBeauty] = useState(false);
  const [ecMaterial, setEcMaterial] = useState('');
  const [ecTargetAudience, setEcTargetAudience] = useState('');
  const [ecRestrictions, setEcRestrictions] = useState('');
  const [ecCollapsed, setEcCollapsed] = useState(false); // 图片配置折叠
  const [toast, setToast] = useState(null);
  const [topicsOpen, setTopicsOpen] = useState(false);
  const [plogOptionsOpen, setPlogOptionsOpen] = useState(false);
  const [extractingProduct, setExtractingProduct] = useState(false); // 插件数据反推加载中
  const ecFileRef = useRef(null);
  const [showRefModal, setShowRefModal] = useState(false);

  // Toast 自动消失
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // 平台尺寸映射（共享常量）
  const ALL_TYPES = [...EC_MAIN_TYPES, ...EC_ADV_TYPES];
  const getDim = (key) => EC_PLATFORM_DIMS[ecPlatform]?.[EC_IMG_RATIOS[key] || '1:1'] || [800,800];
  // 生成流程状态: config → preview → generating → result
  const [genPhase, setGenPhase] = useState('config');
  const [genECLoading, setGenECLoading] = useState(false);
  const [ecLoadingMsg, setEcLoadingMsg] = useState('');
  const [ecOutline, setEcOutline] = useState([]);       // 大纲列表（含用户编辑后的 prompt）
  const [ecOutlineLoading, setEcOutlineLoading] = useState(false);
  const [ecResults, setEcResults] = useState(null);      // 生成结果
  const [ecRegeneratingKey, setEcRegeneratingKey] = useState('');
  const [ecRegenEdit, setEcRegenEdit] = useState({ label: null, prompt: '', visible: false }); // 重生成prompt编辑器
  const [ecLightbox, setEcLightbox] = useState(null); // 图片放大查看
  const [ecPreviewLightbox, setEcPreviewLightbox] = useState(null); // 参考图放大查看

  const setMode = (m) => dispatch({ type: 'SET_MODE', mode: m });
  const setText = (t) => dispatch({ type: 'SET_INPUT', text: t });

  useEffect(() => {
    if (logged) {
      getSession().then(user => {
        if (user?.phone) getTrialStatus(user.phone).then(s => setTrialRemaining(s.freeRemaining || 0));
      });
    }
  }, [logged]);

  // 检查书签工具返回的提取数据
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('extract_token');
    if (!token) return;
    // 模块级守卫：防 React StrictMode 双渲染导致第二个实例读取已删除的数据
    if (_extractSessionToken === token) return;
    _extractSessionToken = token;

    // 先切到电商 tab 并显示加载状态
    setMode('ecommerce');
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
    setEcCat(''); // 清掉默认「美妆护肤」，避免智能推荐误加美妆报告
    setExtractingProduct(true);

    (async () => {
      try {
        const { getExtractData } = await import('../../services/api');
        // 轮询等待分析（最多 12 次 × 2s = 24 秒，覆盖 Vision 下载+分析时间）
        let d = null;
        for (let i = 0; i < 12; i++) {
          d = await getExtractData(token);
          if (!d || !d.ok) break;
          if (d.ready) break;
          await new Promise(r => setTimeout(r, 2000));
        }
        // 如果轮询结束还没 ready，再取一次（此时 data 应有图+卖点，只差 analysis）
        if ((!d || !d.ok || !d.ready) && token) {
          const last = await getExtractData(token);
          if (last && last.ok) d = last;
        }

        if (d && d.ok && d.title) {
          setEcName(d.title);
          // 有反推结果 → 自动配置参数
          if (d.analysis) {
            if (d.analysis.category) setEcCat(d.analysis.category);
            if (d.analysis.stylePack) setEcStylePack(d.analysis.stylePack);
            if (d.analysis.material) setEcMaterial(d.analysis.material);
            if (d.analysis.keySellingPoints?.length) setEcPoints(d.analysis.keySellingPoints.join(', '));
          } else {
            // 没反推结果 → 不污染默认类目（避免默认「美妆护肤」导致美妆报告）
            setEcCat('');
          }
          // sellingPoints 直接从 POST 数据来，analysis 没有也能用
          if (d.sellingPoints?.length && !d.analysis?.keySellingPoints?.length) setEcPoints(d.sellingPoints.join(', '));
          if (d.images?.length) setEcRefImgs(d.images.slice(0, 8));

          setExtractingProduct(false);
          // 统计提取了哪些信息
          const extracted = [];
          if (d.analysis?.category) extracted.push(`品类·${d.analysis.category}`);
          if (d.analysis?.stylePack) extracted.push('风格');
          if (d.sellingPoints?.length || d.analysis?.keySellingPoints?.length) extracted.push('卖点');
          if (d.images?.length) extracted.push(`${d.images.length}张参考图`);
          setToast({
            message: d.analysis
              ? `✅ 已提取「${d.title.slice(0, 16)}」— ${extracted.join('、')}`
              : `✅ 已提取「${d.title.slice(0, 18)}」— ${extracted.join('、')}，分析完成后将自动更新`,
            type: 'success',
          });

          // 如果分析还没完成，后台继续等，完成后自动更新表单
          if (!d.analysis) {
            (async function waitAnalysis() {
              try {
                for (let i = 0; i < 15; i++) {
                  await new Promise(r => setTimeout(r, 3000));
                  const upd = await getExtractData(token);
                  if (!upd || !upd.ok) break;
                  if (upd.analysis) {
                    if (upd.analysis.category) setEcCat(upd.analysis.category);
                    if (upd.analysis.stylePack) setEcStylePack(upd.analysis.stylePack);
                    if (upd.analysis.material) setEcMaterial(upd.analysis.material);
                    if (upd.analysis.keySellingPoints?.length) setEcPoints(upd.analysis.keySellingPoints.join(', '));
                    setToast({ message: `✅ 视觉分析完成：${upd.analysis.category} · 风格已自动匹配`, type: 'success' });
                    break;
                  }
                }
              } catch (_) {}
            })();
          }
        } else {
          // 没标题但有其他数据
          const hasImages = !!(d && d.ok && d.images?.length);
          const hasPoints = !!(d && d.ok && d.sellingPoints?.length);
          const anyData = d && d.ok && (hasImages || hasPoints);

          if (anyData) {
            if (d.images?.length) setEcRefImgs(d.images.slice(0, 8));
            setEcName('未命名商品');
            setEcCat('');
            setExtractingProduct(false);
            const parts = [];
            if (hasImages) parts.push(`${d.images.length}张参考图`);
            if (hasPoints) parts.push(`${d.sellingPoints.length}个卖点`);
            setToast({ message: `✅ 已提取${parts.join('、')}，填写商品名称即可生成`, type: 'success' });
          } else {
            // 真正的无数据
            setExtractingProduct(false);
            if (d && d.ok) {
              setToast({ message: '⚠️ 提取到商品数据为空，请用爆款复刻或手动填写', type: 'error' });
            } else {
              setToast({ message: '⚠️ 数据读取失败，请刷新页面或手动填写', type: 'error' });
            }
          }
        }
        window.history.replaceState({}, '', window.location.pathname);
      } catch (e) {
        setExtractingProduct(false);
        console.warn('书签数据读取失败', e);
        setToast({ message: '⚠️ 数据读取失败，请手动填写', type: 'error' });
      }
    })();
  }, []);
  const ecLabel = (key) => ALL_TYPES.find(t => t.key === key)?.label || key;
  const baseKey = (k) => k.replace(/_\d+$/, '');

  // 解析卖点文案（逗号/分号/换行分隔）
  const parsePoints = (str) => str.split(/[,;，；\n]+/).map(s => s.trim()).filter(Boolean);

  // 智能推荐 — 每个风格包推荐贴合其核心用途的图片类型
  // 切换风格包时清空旧推荐，不混合保留
  const prevStyleRef = useRef(ecStylePack);
  // 每个风格包推荐一套完整的默认图片组，覆盖主图+核心配图
  useEffect(() => {
    const points = parsePoints(ecPoints);
    const pointsCount = points.length;
    const recs = [];
    const dim = (key) => { const d = getDim(key); return { width:d[0], height:d[1] }; };

    switch (ecStylePack) {
      case 'scene_selling':
        // 场景种草：场景图为主 + 白底图兜底
        recs.push({ key:'scene', count:2, ...dim('scene'), reason:'场景种草风格，2 张不同使用场景' });
        recs.push({ key:'white_bg', count:1, ...dim('white_bg'), reason:'保留 1 张白底图作为平台首图' });
        if (pointsCount) recs.push({ key:'detail', count:Math.min(pointsCount, 2), ...dim('detail'), reason:'搭配场景的详情图，每张讲一个卖点' });
        break;
      case 'detail_selling':
        // 卖点解说：白底图 + 每卖点一张详情图
        recs.push({ key:'white_bg', count:1, ...dim('white_bg'), reason:'白底图作为搜索首图' });
        if (pointsCount) recs.push({ key:'detail', count:Math.min(pointsCount, 4), ...dim('detail'), reason:'每张详情图聚焦一个卖点，配中文标注讲清楚' });
        else recs.push({ key:'detail', count:2, ...dim('detail'), reason:'详情图展示产品核心卖点与细节' });
        break;
      case 'ugc_trust':
        // 真实买家感：场景图 + 白底图
        recs.push({ key:'scene', count:2, ...dim('scene'), reason:'真实感场景图，看起来像买家实拍' });
        recs.push({ key:'white_bg', count:1, ...dim('white_bg'), reason:'留一张白底图，平台搜索需要' });
        break;
      case 'brand_unified':
        // 品牌质感：组合图 + 白底图 + 场景图
        recs.push({ key:'composite', count:1, ...dim('composite'), reason:'组合图=主图+细节+场景三合一，品牌展示核心' });
        recs.push({ key:'white_bg', count:1, ...dim('white_bg'), reason:'干净的白底图保持搜索可见' });
        recs.push({ key:'scene', count:1, ...dim('scene'), reason:'品牌调性场景图' });
        break;
      case 'promo_sale':
        // 促销大促：主图文案 + 详情图标价格
        recs.push({ key:'main_text', count:1, ...dim('main_text'), reason:'主图带促销文案角标，大促吸引点击' });
        if (pointsCount) recs.push({ key:'detail', count:Math.min(pointsCount, 2), ...dim('detail'), reason:'详情图标价格/折扣信息' });
        break;
      default:
        // 官方主图风格：白底图为主
        recs.push({ key:'white_bg', count:2, ...dim('white_bg'), reason:'官方主图风格，纯白底棚拍，不同角度各一张' });
        if (pointsCount) recs.push({ key:'detail', count:Math.min(pointsCount, 1), ...dim('detail'), reason:'配 1 张卖点详情图' });
        break;
    }

    const styleChanged = prevStyleRef.current !== ecStylePack;
    prevStyleRef.current = ecStylePack;
    setEcSelections(prev => {
      if (styleChanged) return [...recs];
      const recMap = new Map(recs.map(r => [r.key, r]));
      const manual = prev.filter(p => !recMap.has(p.key));
      return [...manual, ...recs];
    });
  }, [ecPoints, ecMaterial, ecRefImgs.length, ecCat, ecStylePack, ecPlatform]);

  const updateSelection = (key, delta) => {
    setEcSelections(prev => {
      const existing = prev.find(s => s.key === key);
      const type = ALL_TYPES.find(t => t.key === key);
      if (!type) return prev;
      if (existing) {
        const newCount = existing.count + delta;
        if (newCount <= 0) return prev.filter(s => s.key !== key);
        if (type.mandatory && newCount < 1) return prev;
        return prev.map(s => s.key === key ? { ...s, count: Math.min(newCount, type.maxCount) } : s);
      }
      if (delta > 0) return [...prev, { key, count: delta }];
      return prev;
    });
  };

  // 更新图片类型的自定义尺寸
  const updateDimension = (key, dimKey, value) => {
    setEcSelections(prev => {
      const v = Math.max(100, Math.min(9999, parseInt(value) || 0));
      return prev.map(s => s.key === key ? { ...s, [dimKey]: v } : s);
    });
  };

  // 链接提取已交由插件处理，不再使用服务端解析

  // 计算总生成张数
  const totalImageCount = ecSelections.reduce((sum, s) => sum + s.count, 0);

  // 预览大纲
  const doPreviewOutline = async () => {
    if (!ecName.trim()) return;
    // if (!logged) { dispatch({ type: 'SHOW_LOGIN', show: true }); return; } // 测试环境跳过登录
    setEcOutlineLoading(true);
    setErr('');
    try {
      const data = await generateEcommercePreview({
        productName: ecName.trim(),
        category: ecCat,
        points: ecPoints.trim(),
        refCount: ecRefImgs.length,
        hasMaterial: !!ecMaterial,
        stylePack: ecStylePack || null,
      });
      // 按用户当前的 ecSelections 过滤大纲，去掉用户取消的图片类型
      const keptCounts = {};
      const outlined = (data.outline || [])
        .filter(item => {
          const sel = ecSelections.find(s => s.key === item.key);
          if (!sel) return false; // 用户没选 → 去掉
          keptCounts[item.key] = (keptCounts[item.key] || 0) + 1;
          return keptCounts[item.key] <= sel.count; // 超过用户选择的张数 → 去掉
        })
        .map((item, idx) => ({
          ...item,
          userPrompt: item.outlineText || '',
          refImageIndex: ecRefImgs.length > 0 ? (idx % ecRefImgs.length) : -1,
        }));
      setEcOutline(outlined);
      setGenPhase('preview');
      setTimeout(() => {
        const el = document.querySelector('.ec-preview-header');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    } catch (e) {
      setErr('预览失败: ' + (e.message || '请稍后重试'));
    }
    setEcOutlineLoading(false);
  };

  // 更新大纲中某张的提示词
  const updateOutlinePrompt = (idx, text) => {
    setEcOutline(prev => prev.map((item, i) => i === idx ? { ...item, userPrompt: text } : item));
  };

  const doGenEC = async () => {
    if (!ecName.trim()) return;
    setErr('');
    dispatch({ type: 'START_GEN' });
    dispatch({ type: 'SET_STAGE', stage: 1 });
    setGenECLoading(true);
    setEcLoadingMsg('正在分析商品信息...');
    try {
      // 判断输入类型
      const isRaw = ecName.trim().length >= 80;

      if (isRaw) {
        // 详细模式
        setEcLoadingMsg('详细模式，按描述精确执行...');
        const { regenerateImage } = await import('../../services/api');
        const images = {};
        for (let i = 0; i < 5; i++) {
          setEcLoadingMsg(`正在生成第 ${i+1}/5 张...`);
          try {
            const url = await regenerateImage(ecName.trim(), '');
            if (url) images[`图${i+1}`] = url;
          } catch(e) {}
        }
        setEcResults({ images, errors: [], product_name: ecName.trim().slice(0, 20), raw_mode: true });
      } else {
        // 标准模式
        setEcLoadingMsg('正在调用 AI 生成商品图...');
        const data = await generateEcommerce({
          productName: ecName.trim(),
          category: ecCat,
          platform: ecPlatform,
          points: ecPoints,
          refImgs: ecRefImgs,
          stylePack: null,
          beautyReport: false,
          material: ecMaterial,
          tier:'basic',
          imageSelections: ecSelections,
          imageSize: null,
        });
        setEcResults(data);
        // 自动保存
        try {
          const { saveWork } = await import('../../services/api');
          saveWork({ ...data, _ecResult: true, _saveKey: 'ec-'+Date.now(), product_name: ecName, category: ecCat, platform: ecPlatform, at: new Date().toLocaleDateString('zh-CN'), images: data.images || {} }, state.phone);
        } catch(e) {}
      }
      dispatch({ type: 'SET_STAGE', stage: 2 });
      await new Promise(r => setTimeout(r, 800));
      setGenECLoading(false);
      dispatch({ type: 'CLOSE_RESULT' });
      setGenPhase('result');
    } catch (e) {
      setErr('生成失败: ' + (e.message || '未知错误'));
      setGenECLoading(false);
      dispatch({ type: 'CLOSE_RESULT' });
    }
  };

  // 单张重生成
  const doRegenerateImage = async (label, editedPrompt) => {
    if (ecRegeneratingKey) return;
    setEcRegeneratingKey(label);
    try {
      const prompt = editedPrompt || ecOutline.find(o => o.key === baseKey(label) || o.label === label)?.userPrompt || '';
      const url = await regenerateImage(prompt, ecCat);
      if (url) {
        setEcResults(prev => prev ? { ...prev, images: { ...prev.images, [label]: url } } : prev);
      }
    } catch (e) {
      alert('重生成失败: ' + (e.message || '请重试'));
    }
    setEcRegeneratingKey('');
    setEcRegenEdit({ label: null, prompt: '', visible: false });
  };

  const doGenXHS = async () => {
    if (!inputText.trim()) return;
    if (logged && credits === 0 && trialRemaining === 0) { dispatch({ type: 'SHOW_PRICE', show: true }); return; }
    const isPaid = logged && credits > 0;
    const isTrial = logged && credits === 0 && trialRemaining > 0;
    const usePreview = !logged;
    setErr('');
    dispatch({ type: 'START_GEN' });
    try {
      // SSE 流式回调：用后端真实进度替换假定时器
      const result = await generateContent(inputText, [], {
        preview: usePreview,
        onProgress: (d) => {
          if (d.step === 'content_analysis' || d.step === 'visual_planning')
            dispatch({ type: 'SET_STAGE', stage: 1 });
          else if (d.step === 'generating_images')
            dispatch({ type: 'SET_STAGE', stage: 2 });
          else if (d.step === 'assembling')
            dispatch({ type: 'SET_STAGE', stage: 3 });
        },
      });
      dispatch({ type: 'SET_STAGE', stage: 4 });
      await new Promise(r => setTimeout(r, 800));
      const work = { ...result, _inputText: inputText, _saveKey: 'gen-' + Date.now(), _preview: usePreview, _trialLocked: isTrial, at: new Date().toLocaleDateString('zh-CN'), id: Date.now() };
      dispatch({ type: 'SET_RESULT', result: work });
      if (isTrial) { const session = await getSession(); if (session?.phone) await consumeTrial(session.phone); setTrialRemaining(0); }
      else if (isPaid) { saveWork(work, state.phone); dispatch({ type: 'SET_CREDITS', credits: credits - 1 }); }
    } catch (e) { setErr(e.message || '生成失败'); dispatch({ type: 'CLOSE_RESULT' }); }
  };

  const readFileAsBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const doGenPlog = async () => {
    if (!plogText.trim()) return;
    setErr('');
    dispatch({ type: 'START_GEN' });
    try {
      const body = { text: plogText.trim(), style: plogStyle, layout: plogLayout, coverVariant: 'collage' };
      if (plogRefImg) body.refImage = await readFileAsBase64(plogRefImg);
      const res = await fetch('/api/plog-generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('请求失败');
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '', result = { cover_url: '', image_urls: [], copyLines: [], caption: '' };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const d = JSON.parse(line.slice(6));
            if (d.type === 'progress') {
              const stageMap = { scene: 1, lens: 1, tone: 1, generating: 2 };
              dispatch({ type: 'SET_STAGE', stage: stageMap[d.step] || 1 });
            } else if (d.type === 'image') {
              if (d.id === 'cover') result.cover_url = d.url;
              else result.image_urls.push(d.url);
              dispatch({ type: 'SET_STAGE', stage: 2 });
            } else if (d.type === 'complete') {
              Object.assign(result, d);
            } else if (d.type === 'error') throw new Error(d.error || '生成失败');
          } catch(e) { if (e.message && !e.message.includes('JSON')) throw e; }
        }
      }
      const work = { ...result, _plogResult: true, _saveKey: 'plog-' + Date.now(), images: { cover: result.cover_url } };
      dispatch({ type: 'SET_RESULT', result: work });
    } catch (e) { setErr(e.message || '生成失败'); dispatch({ type: 'CLOSE_RESULT' }); }
  };

  const addRefImage = (files, setter, current, max) => {
    Array.from(files).slice(0, max - current.length).forEach(f => {
      const reader = new FileReader();
      reader.onload = (ev) => setter(p => p.length >= max ? p : [...p, ev.target.result]);
      reader.readAsDataURL(f);
    });
  };

  const isXHS = mode === 'content';

  /* ═════ compactMode: 纯 XHS 输入表单（无页面外壳、无 hero、无 EC）═════ */
  if (compactMode) {
    return (
      <div>
        {/* ═══ 黄梯度区 — 仅包裹网格+折叠项（在白层内） ═══ */}
        <div style={{
          borderRadius: 24, minHeight: 224,
          background: 'radial-gradient(circle at 18% 18%, rgba(244,234,219,0.86), transparent 34%), linear-gradient(135deg, rgba(251,248,241,0.94), rgba(255,255,255,0.88))',
          padding: '12px 20px',
        }}>
        {/* 子模式切换 */}
        <div style={{ display:'flex', gap:3, margin:'0 0 12px', padding:3, background:'rgba(0,0,0,0.04)', borderRadius:12, height:44 }}>
          <div onClick={() => setXhsSubMode('content')}
            style={{
              flex:1, padding:'10px 0', borderRadius:10, cursor:'pointer', fontSize:14, fontWeight: xhsSubMode === 'content' ? 900 : 500,
              textAlign:'center', transition:'all .12s',
              background: xhsSubMode === 'content' ? '#fff' : 'transparent',
              color: xhsSubMode === 'content' ? 'var(--accent)' : 'var(--text-muted)',
              boxShadow: xhsSubMode === 'content' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              lineHeight:'24px',
            }}>
            种草图文
          </div>
          <div onClick={() => setXhsSubMode('plog')}
            style={{
              flex:1, padding:'10px 0', borderRadius:10, cursor:'pointer', fontSize:14, fontWeight: xhsSubMode === 'plog' ? 900 : 500,
              textAlign:'center', transition:'all .12s',
              background: xhsSubMode === 'plog' ? '#fff' : 'transparent',
              color: xhsSubMode === 'plog' ? '#BE185D' : 'var(--text-muted)',
              boxShadow: xhsSubMode === 'plog' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              lineHeight:'24px',
            }}>
            Plog 生活碎片
          </div>
        </div>

        {/* 种草图文（灵图精确尺寸：86×108上传按钮 + 208px textarea + 16px gap） */}
        {xhsSubMode === 'content' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'112px minmax(0,1fr)', gap:16 }}>
              <div>
                <button onClick={() => fileRef.current?.click()}
                  style={{
                    width:86, height:108,
                    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6,
                    borderRadius:16, border:'2px dashed var(--border)', background:'#fff',
                    boxShadow:'0 14px 36px rgba(57,45,26,0.10)',
                    cursor:'pointer', fontFamily:'inherit',
                    transform:'rotate(-5deg)', transition:'all 0.2s',
                    overflow:'hidden',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform='translateY(-4px) rotate(0deg)'; e.currentTarget.style.borderColor='var(--accent)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform='rotate(-5deg)'; e.currentTarget.style.borderColor='var(--border)'; }}>
                  <span style={{ display:'grid', width:40, height:40, placeItems:'center', borderRadius:'50%', background:'#f8f3ea', color:'var(--text-secondary)', boxShadow:'0 10px 24px rgba(57,45,26,0.12)' }}>
                    <ImagePlus size={20} />
                  </span>
                  <span style={{ fontSize:12, fontWeight:900, color:'var(--text-secondary)' }}>加图</span>
                  <span style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)' }}>最多 3 张</span>
                </button>
                <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => { addRefImage(e.target.files, setRefImages, refImages, 3); e.target.value=''; }} />
              </div>

              <div>
                <textarea value={inputText} onChange={e => { setText(e.target.value); setErr(''); }}
                  placeholder="描述主体、场景、风格与画面细节，可以上传参考图后补充想法。"
                  style={{
                    width:'100%', minHeight:208, border:'none', background:'transparent',
                    fontSize:15, lineHeight:'28px', color:'var(--text-primary)',
                    outline:'none', resize:'none', fontFamily:'inherit',
                  }} />
              </div>
            </div>

            {/* 已上传图片预览 */}
            {refImages.length > 0 && (
              <div style={{ display:'flex', gap:8, marginTop:8, flexWrap:'wrap' }}>
                {refImages.map((src, i) => (
                  <div key={i} style={{ position:'relative', width:52, height:52, borderRadius:10, overflow:'hidden', border:'1px solid var(--border)', flexShrink:0 }}>
                    <img src={src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    <div onClick={() => setRefImages(p => p.filter((_,j) => j!==i))}
                      style={{ position:'absolute', top:1, right:1, width:16, height:16, borderRadius:'50%', background:'rgba(0,0,0,0.6)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:8 }}>✕</div>
                  </div>
                ))}
              </div>
            )}

            {/* 热门主题 — 折叠pill */}
            <div style={{ marginTop: 12 }}>
              <button onClick={() => setTopicsOpen(!topicsOpen)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  height: 36, padding: '0 14px',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--border)', background: '#fff',
                  fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                <Lightbulb size={14} /> 热门主题
                {topicsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {topicsOpen && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {QUICK_HINTS.map((h, i) => (
                    <button key={i} onClick={() => setText(h)}
                      style={{
                        padding: '6px 14px', borderRadius: 'var(--radius-full)',
                        border: '1px solid var(--border-light)', background: '#fff',
                        fontSize: 12, fontWeight: 500, cursor: 'pointer',
                        color: 'var(--text-secondary)', fontFamily: 'inherit',
                        transition: 'all 0.12s', whiteSpace: 'nowrap',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = '#f8f3ea'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = '#fff'; }}>
                      {h}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Plog（相同外壳：86×108上传+208px textarea+16px gap） */}
        {xhsSubMode === 'plog' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'112px minmax(0,1fr)', gap:16 }}>
              <div>
                <button onClick={() => plogFileRef.current?.click()}
                  style={{
                    width:86, height:108,
                    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6,
                    borderRadius:16, border:'2px dashed var(--border)', background:'#fff',
                    boxShadow:'0 14px 36px rgba(57,45,26,0.10)',
                    cursor:'pointer', fontFamily:'inherit',
                    transform:'rotate(-5deg)', transition:'all 0.2s',
                    overflow:'hidden',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform='translateY(-4px) rotate(0deg)'; e.currentTarget.style.borderColor='var(--accent)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform='rotate(-5deg)'; e.currentTarget.style.borderColor='var(--border)'; }}>
                  <span style={{ display:'grid', width:40, height:40, placeItems:'center', borderRadius:'50%', background:'#f8f3ea', color:'var(--text-secondary)', boxShadow:'0 10px 24px rgba(57,45,26,0.12)' }}>
                    <ImagePlus size={20} />
                  </span>
                  <span style={{ fontSize:12, fontWeight:900, color:'var(--text-secondary)' }}>加图</span>
                  <span style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)' }}>最多 1 张</span>
                </button>
                <input ref={plogFileRef} type="file" accept="image/*" hidden onChange={e => { const f=e.target.files?.[0]; if(f){setPlogRefImg(f);setPlogRefPreview(URL.createObjectURL(f));} e.target.value=''; }} />
              </div>

              <div>
                <textarea value={plogText} onChange={e => setPlogText(e.target.value)}
                  placeholder="描述你的生活场景"
                  style={{
                    width:'100%', minHeight:208, border:'none', background:'transparent',
                    fontSize:15, lineHeight:'28px', color:'var(--text-primary)',
                    outline:'none', resize:'none', fontFamily:'inherit',
                  }} />

                {/* Plog 参考图预览 + 风格/排版选择 */}
                <div style={{ marginTop:12 }}>
                  {plogRefPreview ? (
                    <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:10 }}>
                      <div style={{ position:'relative', width:52, height:52, borderRadius:10, overflow:'hidden', border:'1px solid var(--border)' }}>
                        <img src={plogRefPreview} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                        <div onClick={() => { setPlogRefImg(null); setPlogRefPreview(''); }}
                          style={{ position:'absolute', top:-4, right:-4, width:18, height:18, borderRadius:'50%', background:'#FF3B5C', color:'#fff', fontSize:10, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', border:'2px solid #fff', fontWeight:700 }}>×</div>
                      </div>
                      <span style={{ fontSize:12, color:'var(--text-muted)' }}>参考图</span>
                    </div>
                  ) : (
                    <div style={{ fontSize:11, color:'var(--text-faint)', marginBottom:10 }}>
                      📷 可上传 1 张参考图，AI 自动统一整组色调
                    </div>
                  )}

                  {/* Plog 设置 — 折叠面板 */}
                  <button onClick={() => setPlogOptionsOpen(!plogOptionsOpen)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      height: 36, padding: '0 14px',
                      borderRadius: 'var(--radius-full)',
                      border: '1px solid var(--border)', background: '#fff',
                      fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
                      cursor: 'pointer', fontFamily: 'inherit',
                      transition: 'all 0.12s', marginTop: 10,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                    <Palette size={14} /> Plog 设置
                    {plogOptionsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                  {plogOptionsOpen && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize:12, fontWeight:900, color:'var(--text-muted)', marginBottom:6, letterSpacing:0.3 }}>🎨 选择色调风格</div>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
                        {[
                          { k:'ins-minimal', label:'🤍 Ins极简', color:'#555' },
                          { k:'korean-clear', label:'💎 韩系清透', color:'#4A6FA5' },
                          { k:'japanese-cream', label:'🍦 日系奶油', color:'#B8956A' },
                          { k:'film-vintage', label:'🎞️ 胶片复古', color:'#8B6F47' },
                        ].map(s => {
                          const active = plogStyle === s.k;
                          return (
                            <div key={s.k} onClick={() => setPlogStyle(s.k)}
                              style={{
                                padding:'5px 12px', borderRadius:8, cursor:'pointer', fontSize:11, whiteSpace:'nowrap',
                                transition:'all .12s', lineHeight:'20px',
                                background: active ? s.color : 'rgba(0,0,0,0.04)',
                                color: active ? '#fff' : 'var(--text-muted)',
                                fontWeight: active ? 700 : 500,
                                border: active ? '1px solid ' + s.color : '1px solid transparent',
                              }}>
                              {s.label}
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ fontSize:12, fontWeight:900, color:'var(--text-muted)', marginBottom:6, letterSpacing:0.3 }}>📐 选择排版样式</div>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
                        {[
                          { k:'casual', label:'📸 碎片风' },
                          { k:'polaroid', label:'📷 拍立得' },
                          { k:'cinematic', label:'🎬 电影感' },
                          { k:'journal', label:'📔 手账风' },
                          { k:'magazine', label:'✨ 杂志风' },
                        ].map(t => {
                          const active = plogLayout === t.k;
                          return (
                            <div key={t.k} onClick={() => setPlogLayout(t.k)}
                              style={{
                                padding:'5px 12px', borderRadius:8, cursor:'pointer', fontSize:11, whiteSpace:'nowrap',
                                transition:'all .12s', lineHeight:'20px',
                                background: active ? '#BE185D' : 'rgba(0,0,0,0.04)',
                                color: active ? '#fff' : 'var(--text-muted)',
                                fontWeight: active ? 700 : 500,
                                border: active ? '1px solid #BE185D' : '1px solid transparent',
                              }}>
                              {t.label}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        </div>
        {/* ═══ 底栏（在白层内、黄层外）═══ */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginTop:8, borderTop:'1px solid var(--border)', paddingTop:8 }}>
          {/* Left: padding only (content mode has no pills in bar) */}
          <div />

          {/* Right: Generate button — 灵图: h-50px, white, shadow, icon circle 44x44 */}
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {xhsSubMode === 'plog' && (
              <div style={{ fontSize:11, color:'var(--text-faint)', textAlign:'right', lineHeight:1.4 }}>
                {!plogText.trim()
                  ? '✏️ 输入场景描述后即可生成 9 张生活碎片'
                  : '✨ 1套 = 9 张 Plog 碎片 + 情绪文案'}
              </div>
            )}
            <button onClick={xhsSubMode === 'content' ? doGenXHS : doGenPlog}
              disabled={xhsSubMode === 'content' ? !inputText.trim() : !plogText.trim()}
              style={{
                display:'flex', alignItems:'center', gap:8,
                height:54, padding:'0 14px 0 20px', border:'none', borderRadius:'var(--radius-full)',
                background:'#fff', fontSize:15, fontWeight:900,
                color:'var(--text-muted)', cursor:'pointer', fontFamily:'inherit',
                boxShadow:'0 14px 36px rgba(57,45,26,0.12)',
                transition:'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                whiteSpace:'nowrap',
                opacity: (xhsSubMode === 'content' ? !inputText.trim() : !plogText.trim()) ? 0.45 : 1,
              }}
              onMouseEnter={e => { if (!(xhsSubMode === 'content' ? !inputText.trim() : !plogText.trim())) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 20px 50px rgba(57,45,26,0.18)'; } }}
              onMouseLeave={e => { if (!(xhsSubMode === 'content' ? !inputText.trim() : !plogText.trim())) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 14px 36px rgba(57,45,26,0.12)'; } }}>
              <span style={{ display:'grid', width:44, height:44, placeItems:'center', borderRadius:'50%', background:'var(--accent)', color:'#fff' }}>
                <Sparkles size={18} fill="#fff" />
              </span>
              {xhsSubMode === 'content'
                ? '一键生成爆款图文'
                : '🎨 生成' + (['碎片风','拍立得','电影感','手账风','杂志风'][['casual','polaroid','cinematic','journal','magazine'].indexOf(plogLayout)] || '碎片风') + ' Plog'}
            </button>
          </div>
        </div>

        {/* Hint text for content mode */}
        {xhsSubMode === 'content' && (
          <div style={{ fontSize:11, color:'var(--text-faint)', marginTop:6, textAlign:'right' }}>
            {!inputText.trim() ? '输入创作主题，AI 生成完整图文' : '✨ 1套 = 完整文案 + 9 张配图'}
          </div>
        )}

        {/* Error */}
        {err && <div style={{ padding:'8px 14px', marginTop:10, background:'#FEF2F0', borderRadius:10, color:'var(--red)', fontSize:13, fontWeight:600 }}>{err}</div>}
      </div>
    );
  }

  return (
    <div style={inlineMode ? { position: 'relative', zIndex: 10 } : { minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Toast 通知 */}
      {toast && (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
          background: toast.type === 'success' ? '#065F46' : '#991B1B',
          color: '#fff', padding: '12px 24px', borderRadius: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          fontSize: 14, fontWeight: 500, maxWidth: '90vw',
          animation: 'slideDown 0.3s ease',
        }}>{toast.message}</div>
      )}
      {/* 商品反推加载遮罩 */}
      {extractingProduct && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(255,255,255,0.9)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
        }}>
          <div className="loading-spinner" style={{
            width: 40, height: 40, border: '3px solid #E5E7EB', borderTopColor: '#6366F1',
            borderRadius: '50%', animation: 'spin 0.8s linear infinite',
          }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: '#374151' }}>🔄 正在分析商品图片...</div>
          <div style={{ fontSize: 12, color: '#9CA3AF' }}>AI 正在识别类目、风格、颜色、材质等参数</div>
        </div>
      )}
      <section className="hero-section" style={{ paddingTop: 40 }}>
        <div style={{
          display:'inline-flex', alignItems:'center', gap:4,
          padding:'3px 12px', borderRadius:20, background:'#FFF0F0', color:'#e84142',
          fontSize:11, fontWeight:600, letterSpacing:0.5, marginBottom:12,
        }}>
          <span style={{ width:5, height:5, borderRadius:'50%', background:'#e84142', display:'inline-block' }} />
          AI 图文创作工具
        </div>
        <h1 className="hero-title">AI 一键生成<span className="hero-accent">爆款内容</span></h1>
        <p className="hero-sub">小红书博主用它做图文，电商卖家用它出商品图</p>
        <div className="mode-tabs">
          <button className={`mode-tab ${isXHS ? 'active-xhs' : ''}`} onClick={() => setMode('content')}><Pencil size={14} /> 小红书图文</button>
          <button className={`mode-tab ${!isXHS ? 'active-ec' : ''}`} onClick={() => setMode('ecommerce')}><ShoppingCart size={14} /> 电商商品图</button>
        </div>
        <div className="input-area">
          <div className={`input-card ${isXHS ? 'xhs-border' : 'ec-border'}`}>
            <div className="input-header">
              <div className={`input-dot ${isXHS ? 'red' : 'blue'}`} />
              <span>{isXHS ? '输入主题，一键生成' : '输入商品信息，生成商品图'}</span>
            </div>

            {isXHS && (
              <div>
                {/* 子模式切换 */}
                <div style={{ display:'flex', gap:3, margin:'12px 16px', padding:3, background:'#e8e8e8', borderRadius:10 }}>
                  <div onClick={() => setXhsSubMode('content')}
                    style={{
                      flex:1, padding:'8px 0', borderRadius:7, cursor:'pointer', fontSize:12, fontWeight:500,
                      textAlign:'center', transition:'all .12s', letterSpacing:0.3,
                      background: xhsSubMode === 'content' ? '#fff' : 'transparent',
                      color: xhsSubMode === 'content' ? '#e84142' : '#888',
                      boxShadow: xhsSubMode === 'content' ? '0 1px 6px rgba(0,0,0,0.12)' : 'none',
                      border: xhsSubMode === 'content' ? '1px solid rgba(0,0,0,0.04)' : '1px solid transparent',
                      position:'relative',
                    }}
                    onMouseEnter={e => { if(xhsSubMode !== 'content') e.currentTarget.style.background = '#f0f0f0'; }}
                    onMouseLeave={e => { if(xhsSubMode !== 'content') e.currentTarget.style.background = 'transparent'; }}>
                    种草图文
                    <div style={{
                      position:'absolute', bottom:-1, left:'50%', transform:'translateX(-50%)',
                      width: xhsSubMode === 'content' ? 16 : 0, height:2.5, borderRadius:2,
                      background:'#e84142', transition:'all .2s',
                    }} />
                  </div>
                  <div onClick={() => setXhsSubMode('plog')}
                    style={{
                      flex:1, padding:'8px 0', borderRadius:7, cursor:'pointer', fontSize:12, fontWeight:500,
                      textAlign:'center', transition:'all .12s', letterSpacing:0.3,
                      background: xhsSubMode === 'plog' ? '#fff' : 'transparent',
                      color: xhsSubMode === 'plog' ? '#c2185b' : '#888',
                      boxShadow: xhsSubMode === 'plog' ? '0 1px 6px rgba(0,0,0,0.12)' : 'none',
                      border: xhsSubMode === 'plog' ? '1px solid rgba(0,0,0,0.04)' : '1px solid transparent',
                      position:'relative',
                    }}
                    onMouseEnter={e => { if(xhsSubMode !== 'plog') e.currentTarget.style.background = '#f0f0f0'; }}
                    onMouseLeave={e => { if(xhsSubMode !== 'plog') e.currentTarget.style.background = 'transparent'; }}>
                    Plog 生活碎片
                    <div style={{
                      position:'absolute', bottom:-1, left:'50%', transform:'translateX(-50%)',
                      width: xhsSubMode === 'plog' ? 16 : 0, height:2.5, borderRadius:2,
                      background:'#c2185b', transition:'all .2s',
                    }} />
                  </div>
                </div>
                {xhsSubMode === 'content' && (
                  <div>
                    <div className="hero-textarea-wrap">
                      <textarea className="hero-textarea" value={inputText} onChange={e => setText(e.target.value)} placeholder=" " />
                      <div className="custom-placeholder">
                        <div className="ph-main">✍️ 在这里输入创作主题，一句话就够了…</div>
                        <div className="ph-sub">例如：厦门3天2夜旅游攻略、百元蓝牙耳机测评</div>
                      </div>
                    </div>
                    <div className="ref-images-row">
                      {refImages.map((src, i) => (
                        <div key={i} className="ref-thumb"><img src={src} alt="" /><div className="ref-remove" onClick={() => setRefImages(p => p.filter((_, j) => j !== i))}>×</div></div>
                      ))}
                      {refImages.length < 3 && <div className="ref-add" onClick={() => fileRef.current?.click()}><Upload size={14} /></div>}
                      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => { addRefImage(e.target.files, setRefImages, refImages, 3); e.target.value = ''; }} />
                      <span className="ref-hint">参考图（可选，最多3张）</span>
                    </div>
                    <div className="tags-cloud-wrap">
                      <div className="tags-hint"><span>💡 试试这些热门主题，点击即可填入</span></div>
                      <div className="tags-cloud">{QUICK_HINTS.map((h, i) => (<button key={i} className="hint-tag" onClick={() => setText(h)}>{h}</button>))}</div>
                    </div>
                    {err && <div className="error-bar">{err}</div>}
                    {logged && credits === 0 && trialRemaining === 0 ? (
                      <button className="gen-btn xhs" onClick={() => dispatch({ type: 'SHOW_PRICE', show: true })}><Sparkles size={14} /> 购买套餐继续使用</button>
                    ) : (
                      <button className="gen-btn xhs" onClick={doGenXHS} disabled={!inputText.trim()}>
                        <Sparkles size={14} /> {!logged ? '免费预览（文案+封面）' : credits > 0 ? '一键生成爆款图文' : '🎁 免费试玩生成'}
                      </button>
                    )}
                    <div className="gen-hint">{!logged ? '🎁 免费预览：AI 生成完整文案 + 1 张封面图 — 登录后解锁全部 9 张配图' : credits > 0 ? `剩余 ${credits} 套 · 1套 = 完整文案 + 9张配图` : trialRemaining > 0 ? '🎁 免费试玩：完整生成 9 张配图（仅展示封面）— 充值解锁全部' : '已用完免费次数 · 购买套餐继续使用'}</div>
                  </div>
                )}
                {xhsSubMode === 'plog' && (
                  <div>
                    {/* 输入 */}
                    <div className="hero-textarea-wrap">
                      <textarea className="hero-textarea" value={plogText} onChange={e => setPlogText(e.target.value)} placeholder=" " />
                      <div className="custom-placeholder">
                        <div className="ph-main">📝 描述你的生活场景</div>
                        <div className="ph-sub">例如：独居日常｜周末宅家看书喝咖啡</div>
                      </div>
                    </div>
                    {/* 参考图（与种草图文一样的样式） */}
                    <div className="ref-images-row" style={{ borderBottom:'none', padding:'12px 16px', background:'#FAFBFC', borderTop:'1.5px solid var(--border)' }}>
                      {plogRefPreview ? (
                        <div style={{ position:'relative', width:60, height:60, borderRadius:8, overflow:'hidden', border:'2px solid #ddd', flex:'0 0 auto' }}>
                          <img src={plogRefPreview} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                          <div onClick={() => { setPlogRefImg(null); setPlogRefPreview(''); }}
                            style={{ position:'absolute', top:-5, right:-5, width:18, height:18, borderRadius:'50%', background:'#FF3B5C', color:'#fff', fontSize:11, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', border:'2px solid #fff', fontWeight:700, lineHeight:1 }}>×</div>
                        </div>
                      ) : (
                        <div onClick={() => plogFileRef.current?.click()}
                          style={{ width:60, height:60, borderRadius:8, border:'2px dashed #ccc', display:'flex', alignItems:'center', justifyContent:'center', color:'#999', cursor:'pointer', fontSize:20, background:'#fff', flex:'0 0 auto' }}>
                          +
                        </div>
                      )}
                      <span style={{ fontSize:13, color:'#999' }}>参考图（可选，AI自动统一整组色调）</span>
                      <input ref={plogFileRef} type="file" accept="image/*" hidden onChange={e => {
                        const f=e.target.files?.[0]; if(f){setPlogRefImg(f);setPlogRefPreview(URL.createObjectURL(f));}
                        e.target.value='';
                      }} />
                    </div>
                    {/* 风格 + 排版设置 */}
                    <div className="tags-cloud-wrap" style={{ borderTop:'none', padding:'8px 16px 10px' }}>
                      <div className="tags-hint"><span>🎨 选择色调风格</span></div>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
                        {[
                          { k:'ins-minimal', label:'🤍 Ins极简', color:'#555' },
                          { k:'korean-clear', label:'💎 韩系清透', color:'#4A6FA5' },
                          { k:'japanese-cream', label:'🍦 日系奶油', color:'#B8956A' },
                          { k:'film-vintage', label:'🎞️ 胶片复古', color:'#8B6F47' },
                        ].map(s => {
                          const active = plogStyle === s.k;
                          return (
                            <div key={s.k} onClick={() => setPlogStyle(s.k)}
                              style={{
                                padding:'4px 10px', borderRadius:8, cursor:'pointer', fontSize:11, whiteSpace:'nowrap',
                                transition:'all .12s', lineHeight:'20px',
                                background: active ? s.color : '#f5f5f5',
                                color: active ? '#fff' : '#666',
                                boxShadow: active ? '0 1px 4px ' + s.color + '50' : 'none',
                                border: active ? '1px solid ' + s.color : '1px solid #eee',
                              }}
                              onMouseEnter={e => { if(!active) { e.currentTarget.style.borderColor = '#ccc'; } }}
                              onMouseLeave={e => { if(!active) { e.currentTarget.style.borderColor = '#eee'; } }}>
                              {s.label}
                            </div>
                          );
                        })}
                      </div>
                      <div className="tags-hint" style={{ marginTop:4 }}><span>📐 选择排版样式</span></div>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                        {[
                          { k:'casual', label:'📸 碎片风' },
                          { k:'polaroid', label:'📷 拍立得' },
                          { k:'cinematic', label:'🎬 电影感' },
                          { k:'journal', label:'📔 手账风' },
                          { k:'magazine', label:'✨ 杂志风' },
                        ].map(t => {
                          const active = plogLayout === t.k;
                          return (
                            <div key={t.k} onClick={() => setPlogLayout(t.k)}
                              style={{
                                padding:'4px 10px', borderRadius:8, cursor:'pointer', fontSize:11, transition:'all .12s',
                                background: active ? '#BE185D' : '#fff',
                                color: active ? '#fff' : '#BE185D',
                                border: active ? '1px solid #BE185D' : '1px solid #f0d4df',
                                fontWeight: active ? 600 : 400,
                              }}
                              onMouseEnter={e => { if(!active) { e.currentTarget.style.background = '#fdf2f8'; e.currentTarget.style.borderColor = '#BE185D'; } }}
                              onMouseLeave={e => { if(!active) { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#f0d4df'; } }}>
                              {t.label}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {err && <div className="error-bar">{err}</div>}
                    <button className="gen-btn xhs" onClick={doGenPlog} disabled={!plogText.trim()}
                      style={{ background: !plogText.trim() ? 'var(--border)' : 'linear-gradient(135deg,#BE185D,#DB2777)' }}>
                      🎨 生成{['碎片风','拍立得','电影感','手账风','杂志风'][['casual','polaroid','cinematic','journal','magazine'].indexOf(plogLayout)] || '碎片风'} Plog
                    </button>
                    <div className="gen-hint">{!plogText.trim() ? '✏️ 输入场景描述后即可生成 9 张生活碎片' : '✨ 1套 = 9 张 Plog 碎片 + 情绪文案'}</div>
                  </div>
                )}

              </div>
            )}

            {!isXHS && (
              <div style={{ padding:'0 0 16px' }}>
                {/* 平台选择 — 横向滑动 */}
                <div style={{ display:'flex', gap:8, padding:'14px 16px', borderBottom:'1.5px solid var(--border)', background:'#FAFBFC', alignItems:'center', overflowX:'auto', flexWrap:'nowrap', WebkitOverflowScrolling:'touch' }}>
                  {['淘宝','京东','拼多多','抖音','小红书','亚马逊'].map(p => (
                    <span key={p} className={`ec-cat-pill ${ecPlatform === p ? 'on' : ''}`} onClick={() => setEcPlatform(p)}
                      style={{ flexShrink:0 }}>
                      {p === '淘宝' ? '🟠' : p === '京东' ? '🛒' : p === '拼多多' ? '🟢' : p === '抖音' ? '🎵' : p === '小红书' ? '📕' : '🌐'} {p}
                    </span>
                  ))}
                  <span style={{ marginLeft:'auto', fontSize:12, color:'#4338CA', cursor:'pointer', whiteSpace:'nowrap', padding:'5px 12px', borderRadius:6, background:'#EEF2FF', fontWeight:500, transition:'all 0.12s', border:'1px solid #C7D2FE', flexShrink:0 }}
                    onClick={() => dispatch({ type:'NAVIGATE', page:'ec-studio' })}
                    onMouseEnter={e => { e.currentTarget.style.background = '#C7D2FE'; e.currentTarget.style.borderColor = '#818CF8'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#EEF2FF'; e.currentTarget.style.borderColor = '#C7D2FE'; }}>
                    🔧 精修工坊
                  </span>
                </div>

                {/* 输入框 */}
                <div className="hero-textarea-wrap">
                  <textarea className="hero-textarea" value={ecName} onChange={e => setEcName(e.target.value)} placeholder=" " />
                  <div className="custom-placeholder">
                    <div className="ph-main">
                      ✍️ 描述你的商品，AI 自动生成全套商品图
                    </div>
                    <div className="ph-sub">
                      例如：白色陶瓷杯简约办公风、无线蓝牙耳机入耳式...<br />
                      也可输入详细描述，AI按需求生成全套商品图
                    </div>
                  </div>
                </div>

                {/* 参考图 — 弹窗上传 */}
                <div className="ref-images-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
                    <button onClick={() => setShowRefModal(true)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 14px', borderRadius: 8,
                        border: '1px solid #e0e0e0', background: '#fff',
                        cursor: 'pointer', fontSize: 12, color: '#555',
                        fontFamily: 'inherit', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#4338CA'; e.currentTarget.style.color = '#4338CA'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0e0e0'; e.currentTarget.style.color = '#555'; }}>
                      <Upload size={13} /> 上传商品参考图
                      {ecRefImgs.length > 0 && <span style={{ background: '#EEF2FF', color: '#4338CA', fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 10 }}>{ecRefImgs.length}</span>}
                    </button>
                    <span className="ref-hint">正面照最有用，1 张也能出图</span>
                  </div>
                  {ecRefImgs.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, overflowX: 'auto', paddingBottom: 4, flexWrap: 'nowrap' }}>
                      {ecRefImgs.map((src, i) => (
                        <div key={i} style={{ position:'relative', width:68, height:68, borderRadius:8, overflow:'hidden', border:'1px solid #e0e0e0', flexShrink:0, cursor:'pointer' }}
                          onClick={() => setEcPreviewLightbox(src)}>
                          <img src={src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                          <div onClick={e => { e.stopPropagation(); setEcRefImgs(p => p.filter((_, j) => j !== i)); }}
                            style={{ position:'absolute', top:2, right:2, width:18, height:18, borderRadius:'50%', background:'#FF4757', color:'#fff', fontSize:10, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', border:'none', fontWeight:700, lineHeight:1, boxShadow:'0 1px 3px rgba(0,0,0,0.3)' }}>×</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 卖点+材质 — 与 tags-cloud-wrap 相同的 padding 和分隔线 */}
                <div style={{ display:'flex', gap:10, padding:'12px 16px', borderBottom:'1.5px solid var(--border)' }}>
                  <input className="ec-link-input" value={ecPoints} onChange={e => setEcPoints(e.target.value)}
                    placeholder="卖点（逗号分隔）例如：高保湿, 24小时持久" style={{ flex:2 }} />
                  <input className="ec-link-input" value={ecMaterial} onChange={e => setEcMaterial(e.target.value)}
                    placeholder="材质/规格（选填）" style={{ flex:1 }} />
                </div>

                {err && <div className="error-bar">{err}</div>}
                <button className="gen-btn" onClick={doGenEC} disabled={!ecName.trim() || genECLoading}
                  style={{ margin:'12px 16px', width:'calc(100% - 32px)', display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'11px 24px', border:'none', borderRadius:10, background: genECLoading ? '#999' : '#4338CA', color:'#fff', fontSize:14, fontWeight:600, cursor: genECLoading ? 'not-allowed' : 'pointer', fontFamily:'inherit', boxShadow: genECLoading ? 'none' : '0 4px 16px rgba(67,56,202,0.25)' }}>
                  <Sparkles size={15} /> {genECLoading ? '生成中...' : '一键生成全套电商图'}
                </button>
                <div className="gen-hint" style={{ padding:'0 16px', marginTop:8, color:'#888', fontSize:12 }}>
                  {!ecName.trim() ? '输入商品描述，AI自动生成全套商品图' :
                   ecName.trim().length >= 80 ? '📝 详细模式 · 按描述精确执行' :
                   '📐 标准模式 · AI 自动生成全套套图'}
                </div>

                {genECLoading && (
                  <div style={{ margin:'12px 16px', padding:'14px 16px', background:'#F5F3FF', borderRadius:10, textAlign:'center' }}>
                    <div style={{ width:32, height:32, border:'2px solid #E0E7FF', borderTopColor:'#4338CA', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 10px' }} />
                    <div style={{ fontSize:13, color:'#4338CA', fontWeight:500 }}>{ecLoadingMsg}</div>
                  </div>
                )}
              </div>
            )}
            {!isXHS && genPhase === 'result' && ecResults && (
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <div style={{ fontSize:15, fontWeight:600, color:'#059669' }}>✅ 生成完成</div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={() => { setGenPhase('config'); setEcResults(null); }}
                      style={{ padding:'6px 14px', borderRadius:6, border:'1px solid #e0e0e0', background:'#fff', cursor:'pointer', fontSize:12, fontFamily:'inherit', color:'#666' }}>
                      继续生成
                    </button>
                    <button onClick={() => dispatch({ type: 'NAVIGATE', page: 'ec-studio' })}
                      style={{ padding:'6px 14px', borderRadius:6, border:'1px solid #4338CA', background:'#EEF2FF', cursor:'pointer', fontSize:12, fontFamily:'inherit', color:'#4338CA', fontWeight:500 }}>
                      去精修工坊
                    </button>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(120px,1fr))', gap:10 }}>
                  {Object.entries(ecResults.images||{}).map(([label,url]) => (
                    <div key={label} style={{ background:'#f8f8f8', borderRadius:8, overflow:'hidden', border:'1px solid #f0f0f0' }}>
                      <div style={{ aspectRatio:'1/1', background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', cursor:'pointer' }}
                        onClick={() => setEcLightbox(url)}>
                        <img src={proxyImg(url)} alt={label} style={{ width:'100%', height:'100%', objectFit:'contain' }} loading="lazy" />
                      </div>
                      <div style={{ padding:'6px 8px', display:'flex', justifyContent:'space-between', alignItems:'center', borderTop:'1px solid #f0f0f0' }}>
                        <span style={{ fontSize:10, fontWeight:600, color:'#666' }}>{ecLabel(baseKey(label))}</span>
                        <button onClick={() => { const a=document.createElement('a'); a.href=url; a.download=label+'.png'; a.click(); }}
                          style={{ fontSize:9, padding:'2px 6px', borderRadius:4, background:'#EEF2FF', border:'none', color:'#4338CA', cursor:'pointer', fontWeight:500, fontFamily:'inherit' }}>
                          下载
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {ecLightbox && (
                  <div style={{ position:'fixed', inset:0, zIndex:99999, background:'rgba(0,0,0,0.92)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}
                    onClick={() => setEcLightbox(null)}>
                    <img src={ecLightbox} style={{ maxWidth:'90%', maxHeight:'90vh', objectFit:'contain', borderRadius:8 }} alt="" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="stats-row">
          {isXHS ? (
            <><div className="stat"><div className="stat-num red">15s</div><div className="stat-label">出图速度</div></div><div className="stat"><div className="stat-num red">14</div><div className="stat-label">覆盖赛道</div></div><div className="stat"><div className="stat-num red">9张</div><div className="stat-label">完整配图</div></div></>
          ) : (
            <><div className="stat"><div className="stat-num blue">6种</div><div className="stat-label">视觉风格</div></div><div className="stat"><div className="stat-num blue">6大</div><div className="stat-label">电商平台</div></div><div className="stat"><div className="stat-num blue">9种</div><div className="stat-label">图片类型</div></div></>
          )}
        </div>
      </section>

      {/* 参考图放大查看 Lightbox */}
      {ecPreviewLightbox && (
        <div className="ec-lightbox-overlay" style={{ zIndex: 999999 }} onClick={() => setEcPreviewLightbox(null)}>
          <div className="ec-lightbox-content" onClick={e => e.stopPropagation()}>
            <button className="ec-lightbox-close" onClick={() => setEcPreviewLightbox(null)}>×</button>
            <img src={ecPreviewLightbox} alt="参考图放大" className="ec-lightbox-img" />
            <div className="ec-lightbox-hint">点击空白处关闭</div>
          </div>
        </div>
      )}

      {/* 上传参考图弹窗 */}
      {showRefModal && (
        <div style={{ position:'fixed', inset:0, zIndex:99999, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={() => setShowRefModal(false)}>
          <div style={{ background:'#fff', borderRadius:16, maxWidth:600, width:'100%', maxHeight:'85vh', overflow:'auto', padding:28 }}
            onClick={e => e.stopPropagation()}>
            {/* 头部 */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <div style={{ fontSize:17, fontWeight:600, color:'#333' }}>📸 上传商品实拍图</div>
              <div onClick={() => setShowRefModal(false)} style={{ width:28, height:28, borderRadius:'50%', background:'#f5f5f5', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#999', fontSize:16, lineHeight:1 }}>✕</div>
            </div>

            {/* 主体 */}
            <div style={{ marginBottom:16 }}>
              {/* 上传区 — 居中 */}
              <div onClick={() => ecFileRef.current?.click()} style={{
                border:'2px dashed #d0d0d0', borderRadius:12, padding:'36px 20px',
                textAlign:'center', cursor:'pointer', marginBottom:12,
                background:'#FAFBFC', transition:'all 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#4338CA'; e.currentTarget.style.background = '#F5F3FF'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#d0d0d0'; e.currentTarget.style.background = '#FAFBFC'; }}>
                <Upload size={28} style={{ color:'#bbb', marginBottom:8 }} />
                <div style={{ fontSize:15, fontWeight:600, color:'#555' }}>点击上传商品参考图</div>
              </div>
              <div style={{ fontSize:11, color:'#bbb', textAlign:'center', marginBottom:16, lineHeight:1.6 }}>
                支持 JPG / PNG / WebP，每张不超过 5MB<br />
                建议 1:1 或 3:4 比例，产品居中、背景简洁效果最好
              </div>
              <input ref={ecFileRef} type="file" accept="image/*" multiple hidden onChange={e => { addRefImage(e.target.files, setEcRefImgs, ecRefImgs, 10); e.target.value=''; }} />

              {/* 已上传 — 显示在下方 */}
              {ecRefImgs.length > 0 && (
                <div>
                  <div style={{ fontSize:13, fontWeight:500, color:'#555', marginBottom:10 }}>已上传 {ecRefImgs.length}/10 张</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                    {ecRefImgs.map((src, i) => (
                      <div key={i} style={{ position:'relative', aspectRatio:'1/1', borderRadius:8, overflow:'hidden', border:'1px solid #e8e8e8', cursor:'pointer' }}
                        onClick={() => setEcPreviewLightbox(src)}>
                        <img src={src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                        <div onClick={e => { e.stopPropagation(); setEcRefImgs(p => p.filter((_, j) => j !== i)); }}
                          style={{ position:'absolute', top:-4, right:-4, width:20, height:20, borderRadius:'50%', background:'#FF4757', color:'#fff', fontSize:10, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', border:'2px solid #fff', fontWeight:700, lineHeight:1 }}>×</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 拍摄建议 */}
            <div style={{ background:'#F5F3FF', borderRadius:10, padding:14, marginBottom:20 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#4338CA', marginBottom:8 }}>🎯 什么样的图最有用？</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px 16px', fontSize:12, color:'#555', lineHeight:1.8 }}>
                <span>• <b>正面照</b> — 产品整体外观</span>
                <span>• <b>侧面45°</b> — 展示立体感</span>
                <span>• <b>细节特写</b> — 材质/工艺放大</span>
                <span>• <b>包装图</b> — 外包装+配件</span>
                <span>• <b>使用场景</b> — 模拟真实环境</span>
                <span>• <b>多角度</b> — 背面/顶部/底部</span>
              </div>
              <div style={{ fontSize:11, color:'#888', marginTop:8 }}>只要 1 张正面照也能出图，拍得越清晰 AI 效果越好</div>
            </div>

            <button onClick={() => setShowRefModal(false)}
              style={{ width:'100%', padding:'12px 0', border:'none', borderRadius:10, background:'#4338CA', color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
              完成 ({ecRefImgs.length} 张)
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
