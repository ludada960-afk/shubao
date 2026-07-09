import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Sparkles, Upload, ChevronRight, Pencil, ShoppingCart, Target, Palette, RefreshCw, Copy, Monitor, ShieldCheck, ChevronDown, Eye, Check, X, RotateCcw as RotateIcon } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { IMAGES } from '../../constants/images';
import { GALLERY, QUICK_HINTS, PRICING_XHS, PRICING_EC, EC_CATS } from '../../constants/data';
import { proxyImg, generateContent, generateEcommerce, generateEcommercePreview, extractProductLink, regenerateImage, saveWork, getTrialStatus, consumeTrial } from '../../services/api';
import { getSession } from '../../services/auth';
import { CharImg } from '../../components/ui/index';
import Button from '../../components/ui/Button';
import Footer from '../../components/layout/Footer';
import './Home.css';

// 提取会话守卫（模块级，跨 StrictMode 双渲染保持状态）
let _extractSessionToken = null;

export default function HomePage() {
  const { state, dispatch } = useApp();
  const { inputText, logged, credits, mode } = state;
  const [err, setErr] = useState('');
  const [refImages, setRefImages] = useState([]);
  const fileRef = useRef(null);
  const [trialRemaining, setTrialRemaining] = useState(0);

  const [ecName, setEcName] = useState('');
  const [ecCat, setEcCat] = useState('美妆护肤');
  const [ecRefImgs, setEcRefImgs] = useState([]);
  const [ecStylePack, setEcStylePack] = useState('');
  const [ecSelections, setEcSelections] = useState([]);
  const [ecPlatform, setEcPlatform] = useState('淘宝');
  const [ecPoints, setEcPoints] = useState('');       // 逗号/分号/换行分隔
  const [ecBeauty, setEcBeauty] = useState(false);
  const [ecLink, setEcLink] = useState('');
  const [ecExtracting, setEcExtracting] = useState(false);
  const [ecMaterial, setEcMaterial] = useState('');
  const [ecTargetAudience, setEcTargetAudience] = useState('');
  const [ecRestrictions, setEcRestrictions] = useState('');
  const [ecCollapsed, setEcCollapsed] = useState(false); // 图片配置折叠
  const [showExtractGuide, setShowExtractGuide] = useState(false); // 提取引导弹窗
  const [toast, setToast] = useState(null); // { message, type: 'success'|'error' }
  const [extractingProduct, setExtractingProduct] = useState(false); // 书签数据反推加载中
  const ecFileRef = useRef(null);

  // Toast 自动消失
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // 平台尺寸映射（与后端同步）
  const PLATFORM_DIMS = {
    '淘宝': { '1:1': [800,800], '3:4': [750,1000] },
    '京东': { '1:1': [800,800], '3:4': [790,1024] },
    '拼多多': { '1:1': [480,480], '3:4': [750,1000] },
    '小红书电商': { '1:1': [800,800], '3:4': [1242,1660] },
    '抖音电商': { '1:1': [800,800], '3:4': [720,960] },
    '亚马逊': { '1:1': [1000,1000], '3:4': [2000,2000] },
  };
  const IMG_RATIOS = { white_bg:'1:1', main_text:'1:1', scene:'3:4', detail:'3:4', composite:'3:4', sku:'1:1', comparison:'3:4', package:'3:4', beauty_report:'3:4', transparent:'1:1' };
  const getDim = (key) => PLATFORM_DIMS[ecPlatform]?.[IMG_RATIOS[key] || '1:1'] || [800,800];
  // 生成流程状态: config → preview → generating → result
  const [genPhase, setGenPhase] = useState('config');
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

  // 图片类型定义
  // 主类型 — 电商常用图片类型
  const MAIN_TYPES = [
    { key:'white_bg', label:'白底图', emoji:'⬜', maxCount:3, desc:'纯白底+产品居中，无文字无水印无模特。平台首图合规必备' },
    { key:'main_text', label:'主图文案', emoji:'🖼️', maxCount:3, desc:'白底图上叠加促销文案/角标/价格标签。淘宝/京东/拼多多主图可选' },
    { key:'scene', label:'场景图', emoji:'🌄', maxCount:4, desc:'产品融入真实使用环境，自然光影。详情页提升购买欲' },
    { key:'detail', label:'详情图', emoji:'📋', maxCount:6, desc:'产品细节特写+中文标注callout。卖点/材质/功能一图讲清楚' },
    { key:'composite', label:'组合图', emoji:'🖼️', maxCount:2, desc:'一张图=主图+细节+场景三合一。品牌展示、套装展示专用' },
  ];
  // 特殊类型 — 按需选配
  const SPECIAL_TYPES = [
    { key:'comparison', label:'效果对比', emoji:'↔️', maxCount:2, desc:'使用前/后左右对比，结果说话最有说服力' },
    { key:'sku', label:'多规格展示', emoji:'🎨', maxCount:3, desc:'不同颜色/尺寸放在一张图里，挑款不用来回翻' },
    { key:'package', label:'包装组合', emoji:'📦', maxCount:2, desc:'全套产品+包装+配件一起展示' },
    { key:'transparent', label:'透明PNG素材', emoji:'🎯', maxCount:1, desc:'去底透明图，可导入 PS/Canva 自己排版' },
    { key:'beauty_report', label:'美妆分析报告', emoji:'📊', maxCount:1, desc:'肤质分析+产品推荐+试色矩阵（美妆专用）' },
  ];
  const ALL_TYPES = [...MAIN_TYPES, ...SPECIAL_TYPES];
  // 根据 key 取中文标签
  const ecLabel = (key) => ALL_TYPES.find(t => t.key === key)?.label || key;
  // 提取基础 key（detail_2 → detail）
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
      const type = IMAGE_TYPES.find(t => t.key === key);
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

  // 执行链接提取
  const doExtractLink = async () => {
    if (!ecLink.trim() || ecExtracting) return;
    setEcExtracting(true);
    setErr('');
    try {
      const d = await extractProductLink(ecLink.trim());
      // 统计提取到了什么
      const hasTitle = !!d.title;
      const hasImages = !!(d.images?.length);
      const hasPoints = !!(d.sellingPoints?.length);
      const hasStyle = !!(d.stylePack && d.styleConfidence >= 4);
      const hasCat = !!d.category;
      const anyData = hasTitle || hasImages || hasPoints || hasStyle || hasCat;

      if (hasTitle) setEcName(d.title);
      if (hasCat) setEcCat(d.category);
      if (d.sellingPoints?.length) setEcPoints(d.sellingPoints.join(', '));
      if (d.materials) setEcMaterial(d.materials);
      if (d.images?.length) setEcRefImgs(d.images.slice(0, 5));
      if (hasStyle) setEcStylePack(d.stylePack);
      if (d.imageTypes?.length) {
        setEcSelections(d.imageTypes.map(t => ({
          key: t.key, count: t.count || 1,
          width: getDim(t.key)[0], height: getDim(t.key)[1],
        })));
      }

      if (anyData) {
        // 有数据就说具体提取到了什么
        const parts = [];
        if (hasTitle) parts.push('名称');
        if (hasImages) parts.push(`${d.images.length}张参考图`);
        if (hasPoints) parts.push(`${d.sellingPoints.length}个卖点`);
        if (hasStyle) parts.push('风格');
        setToast({ message: `✅ 已提取${parts.join('、')}`, type: 'success' });
      } else {
        setErr('未能提取到商品信息，请检查链接或手动填写');
      }
    } catch (e) { setErr('提取失败：' + e.message); }
    setEcExtracting(false);
  };

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
    // if (!logged) { dispatch({ type: 'SHOW_LOGIN', show: true }); return; } // 测试环境跳过登录
    setErr('');
    setGenPhase('generating');
    dispatch({ type: 'START_GEN' });
    // 只在开始时推进 0→1，stage 2/3 由 API 完成触发
    const stageTimers = [
      setTimeout(() => dispatch({ type: 'SET_STAGE', stage: 1 }), 2000),
    ];
    try {
      const data = await generateEcommerce({
        productName: ecName, category: ecCat, refImgs: ecRefImgs, imageSelections: ecSelections,
        platform: ecPlatform, points: ecPoints, beautyReport: !!ecSelections.find(s => s.key === 'beauty_report'),
        stylePack: ecStylePack || null, material: ecMaterial,
        targetAudience: ecTargetAudience, restrictions: ecRestrictions,
        imageSize: null,
      stageTimers.forEach(t => clearTimeout(t));
      // API 返回后：品质优化(1.5s) → 打包完成(600ms) → 结果页
      dispatch({ type: 'SET_STAGE', stage: 2 });
      await new Promise(r => setTimeout(r, 1500));
      dispatch({ type: 'SET_STAGE', stage: 3 });
      await new Promise(r => setTimeout(r, 600));
      dispatch({ type: 'CLOSE_RESULT' });
      setEcResults(data);
      setGenPhase('result');
      // 自动保存到作品
      saveWork({
        ...data,
        _ecResult: true,
        _saveKey: 'ec-' + Date.now(),
        product_name: ecName,
        category: ecCat,
        platform: ecPlatform,
        at: new Date().toLocaleDateString('zh-CN'),
        images: data.images || {},
      });
    } catch (e) {
      stageTimers.forEach(t => clearTimeout(t));
      setErr(e.message || '生成失败');
      setGenPhase('config');
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
    // 渐进式进度：0→1→2→3→4（只由实际进展驱动，不用虚假定时器）
    const stageTimers = [
      setTimeout(() => dispatch({ type: 'SET_STAGE', stage: 1 }), 3000),
      setTimeout(() => dispatch({ type: 'SET_STAGE', stage: 2 }), 10000),
    ];
    try {
      const result = await generateContent(inputText, [], { preview: usePreview });
      stageTimers.forEach(t => clearTimeout(t));
      // API 返回后：品质优化(1.5s) → 打包完成(800ms) → 结果页
      dispatch({ type: 'SET_STAGE', stage: 3 });
      await new Promise(r => setTimeout(r, 1500));
      dispatch({ type: 'SET_STAGE', stage: 4 });
      await new Promise(r => setTimeout(r, 800));
      const work = { ...result, _inputText: inputText, _saveKey: 'gen-' + Date.now(), _preview: usePreview, _trialLocked: isTrial, at: new Date().toLocaleDateString('zh-CN'), id: Date.now() };
      dispatch({ type: 'SET_RESULT', result: work });
      if (isTrial) { const session = await getSession(); if (session?.phone) await consumeTrial(session.phone); setTrialRemaining(0); }
      else if (isPaid) { saveWork(work); dispatch({ type: 'SET_CREDITS', credits: credits - 1 }); }
    } catch (e) { stageTimers.forEach(t => clearTimeout(t)); setErr(e.message || '生成失败'); dispatch({ type: 'CLOSE_RESULT' }); }
  };

  const addRefImage = (files, setter, current, max) => {
    Array.from(files).slice(0, max - current.length).forEach(f => {
      const reader = new FileReader();
      reader.onload = (ev) => setter(p => p.length >= max ? p : [...p, ev.target.result]);
      reader.readAsDataURL(f);
    });
  };

  const isXHS = mode === 'content';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
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
      <section className="hero-section">
        <h1 className="hero-title">AI 一键生成<span className="hero-accent">爆款内容</span></h1>
        <p className="hero-sub">小红书博主用它出图文，电商卖家用它做商品图 — 两条产品线，一个工具搞定</p>
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

            {!isXHS && genPhase === 'config' && (
              <div className="ec-form">
                {/* 🔗 爆款复刻 — 可选 */}
                <div className="ec-section ec-section-highlight">
                  <div className="ec-section-title">
                    🔗 爆款复刻 <span className="ec-link-tag">可选</span>
                    <span className="ec-section-hint">粘贴爆款商品链接 → AI 自动分析出商品信息，一键复刻同款商品图的风格和布局。省时省力，直接照着爆款出图</span>
                  </div>
                  <div className="ec-link-inner">
                    <input className="ec-link-input" value={ecLink} onChange={e => setEcLink(e.target.value)} placeholder="粘贴淘宝/京东/拼多多 商品链接，AI 自动填充..." />
                    <button className="ec-link-btn" onClick={() => setShowExtractGuide(true)}>
                      🚀 提取并自动填充
                    </button>
                  </div>
                  <div className="ec-link-benefits">
                    <span>✅ 识别商品名称</span>
                    <span>✅ 分析品类</span>
                    <span>✅ 提取卖点</span>
                    <span>✅ 获取参考图</span>
                    <span>✅ 匹配视觉风格</span>
                  </div>
                </div>

                {/* 爆款复刻: 提取引导弹窗 */}
                {showExtractGuide && (
                  <div className="ec-guide-overlay" onClick={() => setShowExtractGuide(false)}>
                    <div className="ec-guide-modal" onClick={e => e.stopPropagation()}>
                      <button className="ec-guide-close" onClick={() => setShowExtractGuide(false)}>x</button>
                      <div className="ec-guide-title">安装薯包AI提取插件</div>
                      <p className="ec-guide-subtitle">在淘宝/京东/拼多多页面点一下插件，商品信息自动提取到薯包AI。</p>

                      <div className="ec-guide-download-wrap">
                        <a className="ec-guide-download-btn" href="/extensions/shubao-extractor.zip" download>
                          下载插件
                        </a>
                        <span className="ec-guide-download-hint">470KB · 装一次永久用 · 不占电脑性能</span>
                      </div>

                      {/* ── 使用步骤预览 ── */}
                      <div className="ec-guide-preview-section">
                        <div className="ec-guide-preview-title">安装后怎么用</div>
                        <div className="ec-guide-preview-steps">
                          <div className="ec-guide-preview-card">
                            <div className="ec-guide-preview-card-header">① 打开商品页，点插件图标</div>
                            <div className="ec-guide-preview-card-body">
                              <div className="ec-guide-popup-mock">
                                <div className="ec-gpm-header">薯包AI 商品提取器</div>
                                <div className="ec-gpm-content">
                                  <div className="ec-gpm-status">已识别商品信息</div>
                                  <div className="ec-gpm-field"><span className="ec-gpm-label">商品名称</span><span className="ec-gpm-val">高保湿精华液 50ml</span></div>
                                  <div className="ec-gpm-field"><span className="ec-gpm-label">商品图</span><span className="ec-gpm-val"><span className="ec-gpm-thumb" /><span className="ec-gpm-thumb" /><span className="ec-gpm-thumb" /></span></div>
                                  <div className="ec-gpm-field"><span className="ec-gpm-label">卖点</span><span className="ec-gpm-val"><span className="ec-gpm-tag">高保湿</span><span className="ec-gpm-tag">敏感肌</span><span className="ec-gpm-tag">24h持久</span></span></div>
                                </div>
                                <div className="ec-gpm-btn">发送到薯包AI</div>
                              </div>
                            </div>
                            <div className="ec-guide-preview-card-desc">💡 插件会自动滚动页面触发懒加载，无需手动操作</div>
                          </div>
                          <div className="ec-guide-preview-arrow">→</div>
                          <div className="ec-guide-preview-card">
                            <div className="ec-guide-preview-card-header">② 点击「发送到薯包AI」</div>
                            <div className="ec-guide-preview-card-body" style={{display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 20px',background:'#FAFAFA',borderRadius:8,minHeight:160}}>
                              <div style={{textAlign:'center'}}>
                                <div style={{fontSize:32,marginBottom:8}}>📤</div>
                                <div style={{fontSize:13,color:'#333',fontWeight:600}}>一键发送</div>
                                <div style={{fontSize:11,color:'#999',marginTop:4}}>后台处理中...</div>
                              </div>
                            </div>
                            <div className="ec-guide-preview-card-desc">数据安全暂存，自动跳回薯包AI</div>
                          </div>
                          <div className="ec-guide-preview-arrow">→</div>
                          <div className="ec-guide-preview-card">
                            <div className="ec-guide-preview-card-header">③ 回到薯包AI，自动填好</div>
                            <div className="ec-guide-preview-card-body" style={{display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 20px',background:'#F5F3FF',borderRadius:8,minHeight:160}}>
                              <div style={{textAlign:'center'}}>
                                <div style={{fontSize:32,marginBottom:8}}>✅</div>
                                <div style={{fontSize:13,color:'#4338CA',fontWeight:600}}>信息已自动填充</div>
                                <div style={{fontSize:11,color:'#888',marginTop:4}}>名称 · 品类 · 图片 · 风格均已填好</div>
                              </div>
                            </div>
                            <div className="ec-guide-preview-card-desc">所有字段已填好，直接预览生成</div>
                          </div>
                        </div>
                      </div>

                      {/* ── 安装教程 ── */}
                      <details className="ec-guide-details">
                        <summary>Chrome / Edge 详细安装教程（点击展开）</summary>
                        <div className="ec-guide-browser-tabs">
                          <div className="ec-guide-browser-col">
                            <div className="ec-guide-browser-title">
                              <span style={{background:'#2563EB',color:'#fff',borderRadius:4,padding:'1px 8px',fontSize:10,marginRight:6}}>Chrome</span>
                              安装步骤
                            </div>
                            <div className="ec-guide-browser-steps">
                              <span><strong>①</strong> 下载ZIP并解压到电脑（右键 → 解压到当前文件夹）</span>
                              <span><strong>②</strong> 地址栏输入 <kbd>chrome://extensions</kbd> 回车</span>
                              <span><strong>③</strong> 打开右上角「开发者模式」</span>
                              <span><strong>④</strong> 点击「加载已解压的扩展程序」</span>
                              <span><strong>⑤</strong> 选择解压出来的 <kbd>shubao-extractor</kbd> 文件夹</span>
                              <span><strong>⑥</strong> 安装完成，插件图标会出现</span>
                            </div>
                            <div className="ec-guide-tip" style={{marginTop:8,fontSize:11,color:'#666',background:'#FEF3C7',padding:'8px 12px',borderRadius:6,lineHeight:1.6}}>
                              💡 <strong>使用技巧：</strong>插件会自动滚动触发懒加载，点插件就能提取到最全图片。
                            </div>
                          </div>
                          <div className="ec-guide-browser-col">
                            <div className="ec-guide-browser-title">
                              <span style={{background:'#059669',color:'#fff',borderRadius:4,padding:'1px 8px',fontSize:10,marginRight:6}}>Edge</span>
                              安装步骤
                            </div>
                            <div className="ec-guide-browser-steps">
                              <span><strong>①</strong> 下载ZIP并解压到电脑（右键 → 解压到当前文件夹）</span>
                              <span><strong>②</strong> 地址栏输入 <kbd>edge://extensions</kbd> 回车</span>
                              <span><strong>③</strong> 打开左下角「开发人员模式」</span>
                              <span><strong>④</strong> 点击「加载解压缩的扩展」</span>
                              <span><strong>⑤</strong> 选择解压出来的 <kbd>shubao-extractor</kbd> 文件夹</span>
                              <span><strong>⑥</strong> 安装完成，插件图标会出现</span>
                            </div>
                            <div className="ec-guide-tip" style={{marginTop:8,fontSize:11,color:'#666',background:'#FEF3C7',padding:'8px 12px',borderRadius:6,lineHeight:1.6}}>
                              💡 <strong>使用技巧：</strong>操作一样——点插件就行，页面自动滚动加载所有图片。
                            </div>
                          </div>
                        </div>
                      </details>

                      <div className="ec-guide-actions">
                        <button className="ec-guide-btn primary" onClick={() => setShowExtractGuide(false)}>
                          安装好了，开始使用
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 📸 参考图（选填·最多5张） */}
                <div className="ec-section">
                  <div className="ec-section-title">
                    📸 商品参考图 <span className="ec-section-tag">选填</span>
                    <span className="ec-section-hint">上传你已有的商品实拍图（最多 8 张），AI 参考实物生成更还原的效果图。</span>
                  </div>
                  <div className="ec-ref-advice">
                    💡 <strong>怎么拍最好？</strong> 不同角度各 1 张（正面+侧面+细节）效果最好；只有 1-2 张也可以，AI 会尽量还原
                  </div>
                  <div className="ec-ref-grid">
                    {[0,1,2,3,4,5,6,7].map(i => (
                      <div key={i} className={`ec-ref-slot ${i < ecRefImgs.length ? 'filled' : ''}`}
                        onClick={() => { if (i < ecRefImgs.length) setEcRefImgs(p => p.filter((_, j) => j !== i)); else if (ecRefImgs.length < 8) ecFileRef.current?.click(); }}>
                        {i < ecRefImgs.length ? (
                          <><img src={ecRefImgs[i]} alt="" className="ec-ref-img" /><div className="ec-ref-remove">×</div></>
                        ) : (
                          <div className="ec-ref-empty"><Upload size={18} /><span>{i === 0 ? '正面' : i === 1 ? '侧面' : i === 2 ? '细节' : i === 3 ? '角度' : i === 4 ? '包装' : i === 5 ? '场景' : '其他'}</span></div>
                        )}
                      </div>
                    ))}
                    <input ref={ecFileRef} type="file" accept="image/*" multiple hidden onChange={e => { addRefImage(e.target.files, setEcRefImgs, ecRefImgs, 8); e.target.value = ''; }} />
                    <span className="ec-ref-badge">{ecRefImgs.length}/8 张</span>
                  </div>
                </div>

                {/* ✏️ 商品信息 */}
                <div className="ec-section">
                  <div className="ec-section-title">✏️ 商品信息</div>
                  <div className="ec-info-fields">
                    <div className="ec-field-primary">
                      <label className="ec-label-lg">商品名称 <span className="ec-required">*</span></label>
                      <input className="ec-input-primary" value={ecName} onChange={e => setEcName(e.target.value)} placeholder="例如：高保湿精华液、无线蓝牙耳机、智能手表..." />
                    </div>
                    <div className="ec-field-primary">
                      <label className="ec-label-lg">品类</label>
                      <div className="ec-cat-pills">{EC_CATS.map(c => (<span key={c} className={`ec-cat-pill ${ecCat === c ? 'on' : ''}`} onClick={() => setEcCat(c)}>{c}</span>))}</div>
                    </div>
                    <div className="ec-field-primary">
                      <label className="ec-label-lg">卖点文案</label>
                      <div className="ec-points-input-wrap">
                        <input className="ec-points-input" value={ecPoints} onChange={e => setEcPoints(e.target.value)} placeholder="输入卖点，用逗号或分号隔开，例如：高保湿锁水, 24小时持久, 敏感肌适用" />
                      </div>
                      {parsePoints(ecPoints).length > 0 && (
                        <div className="ec-points-tags">{parsePoints(ecPoints).map((p, i) => (<span key={i} className="ec-point-tag">{p}</span>))}</div>
                      )}
                      <div className="ec-field-hint">💡 每个卖点会生成一张对应的卖点解说图，建议填 2-4 个卖点</div>
                    </div>
                    {/* 扩展信息（材质+人群+限制）— 用紧凑布局 */}
                    <div className="ec-ext-info">
                      <div><label className="ec-label-sm">材质/规格 <span className="ec-optional">(选填)</span></label><input className="ec-input-sm" value={ecMaterial} onChange={e => setEcMaterial(e.target.value)} placeholder="玻尿酸、304不锈钢..." /></div>
                      <div><label className="ec-label-sm">目标人群 <span className="ec-optional">(选填)</span></label><input className="ec-input-sm" value={ecTargetAudience} onChange={e => setEcTargetAudience(e.target.value)} placeholder="25-35岁女性、运动爱好者..." /></div>
                      <div><label className="ec-label-sm">限制条件 <span className="ec-optional">(选填)</span></label><input className="ec-input-sm" value={ecRestrictions} onChange={e => setEcRestrictions(e.target.value)} placeholder="避免什么内容、品牌禁忌..." /></div>
                    </div>
                  </div>
                </div>

                {/* 🎨 视觉风格 — 6 种风格 + 价值传达 */}
                <div className="ec-section">
                  <div className="ec-section-title">
                    🎨 视觉风格
                    <span className="ec-section-hint">选择一种风格，所有生成的图片视觉统一。选完后下面的「图片数量」会根据风格自动推荐</span>
                  </div>
                  <div className="ec-style-grid">
                    {[
                      {key:'', label:'官方主图风格', sub:'纯白背景 · 产品居中', desc:'适合所有电商平台的首图和白底图。专业棚拍光线突出产品本身，买家搜索时一眼看到的就是清晰的产品外观。支持叠加促销角标。', img:'/images/style-packs/standard.jpg'},
                      {key:'scene_selling', label:'场景种草风格', sub:'融入环境 · 激发购买欲', desc:'把产品放到真实使用场景中，买家下意识会想象自己也在用。适合详情页和社交媒体推广，让图片自己说话。', img:'/images/style-packs/scene.jpg'},
                      {key:'promo_sale', label:'促销大促风格', sub:'促销配色 · 吸引点击', desc:'促销氛围配色+预留价格/折扣位。双11、618、新品首发时用，买家一眼识别"有优惠"。', img:'/images/style-packs/promo.jpg'},
                      {key:'ugc_trust', label:'真实买家感', sub:'手机实拍感 · 降低广告感', desc:'像真实买家随手拍的照片，不是精修广告图。适合详情页信任区，降低买家"怕买回来不一样"的顾虑。', img:'/images/style-packs/ugc.jpg'},
                      {key:'brand_unified', label:'品牌质感风格', sub:'统一色板 · 提升溢价', desc:'多款商品共用一套视觉体系（色板/光线/背景），放在店铺里像同一品牌出品。适合精品店、品牌路线。', img:'/images/style-packs/brand.jpg'},
                      {key:'detail_selling', label:'卖点解说风格', sub:'信息图排版 · 卖点一目了然', desc:'每张图讲一个核心卖点，配图标+标注文字。适合卖点明确、需要减少客服咨询量的商品。', img:'/images/style-packs/detail.jpg'},
                    ].map(s => (
                      <div key={s.key} className={`ec-style-card ${ecStylePack === s.key ? 'on' : ''}`} onClick={() => setEcStylePack(s.key)}>
                        <img src={s.img} alt={s.label} className="ec-style-img" loading="lazy" />
                        <div className="ec-style-body">
                          <div className="ec-style-name">{s.label}</div>
                          <span className="ec-style-subtag">{s.sub}</span>
                          <div className="ec-style-divider" />
                          <div className="ec-style-detail">{s.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ⚙️ 图片配置（折叠式：包含平台 + 图片数量+尺寸） */}
                <div className="ec-section">
                  <div className="ec-section-title ec-collapsible-header" onClick={() => setEcCollapsed(!ecCollapsed)}>
                    <span>⚙️ 图片配置</span>
                    <span className="ec-config-summary">{totalImageCount} 张图 · {ecPlatform} · {ecCollapsed ? '展开' : '收起'} <ChevronDown size={14} style={{ transform: ecCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: '0.2s' }} /></span>
                  </div>
                  {!ecCollapsed && (
                    <div>
                      {/* 平台选择 — 放在配置内 */}
                      <div className="ec-config-row">
                        <label className="ec-label-md">目标平台</label>
                        <div className="ec-platform-pills">{['淘宝','京东','拼多多','小红书电商','抖音电商','亚马逊'].map(p => (
                          <span key={p} className={`ec-platform-pill ${ecPlatform === p ? 'on' : ''}`} onClick={() => setEcPlatform(p)}>{p}</span>
                        ))}</div>
                      </div>
                      {/* 图片类型 + 数量 + 独立尺寸 */}
                      <div className="ec-config-row">
                        <label className="ec-label-md">要生成的图片</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 2 }}>⬇ 核心类型（推荐）</div>
                          {MAIN_TYPES.map(t => {
                            const sel = ecSelections.find(s => s.key === t.key);
                            const count = sel?.count || 0;
                            const w = sel?.width || getDim(t.key)[0];
                            const h = sel?.height || getDim(t.key)[1];
                            const isEditingSize = sel?.editingSize || false;
                            return (
                              <div key={t.key} className={`ec-imgtype-row ${count > 0 ? 'active' : ''}`}>
                                <div className="ec-imgtype-info">
                                  <span className="ec-imgtype-emoji">{t.emoji}</span>
                                  <div>
                                    <span className="ec-imgtype-label">{t.label}</span>
                                    {t.mandatory && <span className="ec-imgtype-badge">必选</span>}
                                    <span className="ec-imgtype-desc">{t.desc}</span>
                                  </div>
                                </div>
                                <div className="ec-imgtype-controls">
                                  {isEditingSize ? (
                                    <div className="ec-imgtype-dim-edit"
                                      onBlur={e => {
                                        if (!e.currentTarget.contains(e.relatedTarget)) {
                                          setEcSelections(prev => prev.map(s => s.key === t.key ? { ...s, editingSize: false } : s));
                                        }
                                      }}
                                      tabIndex={-1}>
                                      <input className="ec-dim-input" type="number" min={100} max={9999}
                                        value={w} onChange={e => updateDimension(t.key, 'width', e.target.value)} />
                                      <span className="ec-dim-x">×</span>
                                      <input className="ec-dim-input" type="number" min={100} max={9999}
                                        value={h} onChange={e => updateDimension(t.key, 'height', e.target.value)} />
                                    </div>
                                  ) : (
                                    <div className="ec-imgtype-dim"
                                      onClick={() => {
                                        setEcSelections(prev => prev.map(s => s.key === t.key ? { ...s, editingSize: !s.editingSize } : s));
                                      }}
                                      title="点击修改尺寸">
                                      <span className="ec-dim-label">{w}×{h}</span>
                                    </div>
                                  )}
                                  <button className="ec-imgtype-btn" onClick={() => updateSelection(t.key, -1)}
                                    disabled={count <= 0 || (t.mandatory && count <= 1)}>−</button>
                                  <input className="ec-imgtype-input" type="number" min={t.mandatory ? 1 : 0}
                                    max={t.maxCount} value={count}
                                    onChange={e => {
                                      const v = parseInt(e.target.value) || 0;
                                      const clamped = Math.min(Math.max(v, t.mandatory ? 1 : 0), t.maxCount);
                                      setEcSelections(prev => {
                                        if (clamped === 0 && !t.mandatory) return prev.filter(s => s.key !== t.key);
                                        const exist = prev.find(s => s.key === t.key);
                                        const dim = getDim(t.key);
                                        if (exist) return prev.map(s => s.key === t.key ? { ...s, count: clamped } : s);
                                        return [...prev, { key: t.key, count: clamped, width: dim[0], height: dim[1] }];
                                      });
                                    }} />
                                  <button className="ec-imgtype-btn" onClick={() => updateSelection(t.key, 1)}
                                    disabled={count >= t.maxCount}>+</button>
                                </div>
                              </div>
                            );
                          })}
                        
                          {/* 进阶类型 */}
                          <div style={{ fontSize:11, color:'var(--text-faint)', marginTop:10, marginBottom:2 }}>⬇ 进阶类型（按需勾选）</div>
                          {SPECIAL_TYPES.map(t => {
                            const sel = ecSelections.find(s => s.key === t.key);
                            const count = sel?.count || 0;
                            const w = sel?.width || getDim(t.key)[0];
                            const h = sel?.height || getDim(t.key)[1];
                            return (
                              <div key={t.key} className={`ec-imgtype-row ${count > 0 ? 'active' : ''}`}>
                                <div className="ec-imgtype-info">
                                  <span className="ec-imgtype-emoji">{t.emoji}</span>
                                  <div>
                                    <span className="ec-imgtype-label">{t.label}</span>
                                    <span className="ec-imgtype-desc">{t.desc}</span>
                                  </div>
                                </div>
                                <div className="ec-imgtype-controls">
                                  <div className="ec-imgtype-dim">
                                    <span className="ec-dim-label">{w}x{h}</span>
                                  </div>
                                  <button className="ec-imgtype-btn" onClick={() => updateSelection(t.key, -1)}
                                    disabled={count <= 0}>-</button>
                                  <input className="ec-imgtype-input" type="number" min={0}
                                    max={t.maxCount} value={count}
                                    onChange={e => {
                                      const v = parseInt(e.target.value) || 0;
                                      const clamped = Math.min(Math.max(v, 0), t.maxCount);
                                      setEcSelections(prev => {
                                        if (clamped === 0) return prev.filter(s => s.key !== t.key);
                                        const dim = getDim(t.key);
                                        const exist = prev.find(s => s.key === t.key);
                                        if (exist) return prev.map(s => s.key === t.key ? { ...s, count: clamped } : s);
                                        return [...prev, { key: t.key, count: clamped, width: dim[0], height: dim[1] }];
                                      });
                                    }} />
                                  <button className="ec-imgtype-btn" onClick={() => updateSelection(t.key, 1)}
                                    disabled={count >= t.maxCount}>+</button>
                                </div>
                              </div>
                            );
                          })}
</div>
                      </div>
                    </div>
                  )}
                </div>

                {err && <div className="ec-error-bar">{err}</div>}
                <div className="ec-footer">
                  <div className="ec-footer-left">
                    <span className="ec-count-badge">{totalImageCount} 张图</span>
                    <span className="ec-count-hint">预览确认后可调整每张图的生成逻辑</span>
                  </div>
                  <button className="ec-preview-btn" onClick={doPreviewOutline} disabled={!ecName.trim() || ecOutlineLoading}>
                    <Eye size={16} /> {ecOutlineLoading ? '生成大纲中...' : '👀 预览生成大纲'}
                  </button>
                </div>
              </div>
            )}

            {/* ═══════ 预览大纲阶段 ═══════ */}
            {!isXHS && genPhase === 'preview' && (
              <div className="ec-form">
                <div className="ec-preview-header">
                  <div className="ec-preview-title">📋 生成大纲 — 共 {ecOutline.length} 张图</div>
                  <div className="ec-preview-sub">每张图都可以自定义生成逻辑，确认后再开始生成</div>
                </div>
                {/* 参考图总览条 — 让用户清楚看到所有提取到的参考图 */}
                {ecRefImgs.length > 0 && (
                  <div className="ec-preview-ref-strip">
                    <div className="ec-preview-ref-strip-title">📸 参考图（共 {ecRefImgs.length} 张 — 每张生成图均参考了这些实物图）</div>
                    <div className="ec-preview-ref-strip-imgs">
                      {ecRefImgs.map((src, i) => (
                        <div key={i} className="ec-preview-ref-strip-item" onClick={() => setEcPreviewLightbox(src)}>
                          <img src={src} alt="" className="ec-preview-ref-strip-img" />
                          <span className="ec-preview-ref-strip-label">参考 {i + 1}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {ecOutline.map((item, idx) => (
                  <div key={idx} className="ec-preview-card">
                    <div className="ec-preview-card-body">
                      {/* 左侧：参考图 — 大，可点击放大 */}
                      {item.refImageIndex >= 0 && item.refImageIndex < ecRefImgs.length && (
                        <div className="ec-preview-ref" onClick={() => setEcPreviewLightbox(ecRefImgs[item.refImageIndex])}>
                          <img src={ecRefImgs[item.refImageIndex]} alt="" className="ec-preview-ref-img" />
                          <span className="ec-preview-ref-label">参考图 {item.refImageIndex + 1}</span>
                        </div>
                      )}
                      {/* 右侧：标题 + 卖点 + prompt */}
                      <div className="ec-preview-content">
                        <div className="ec-preview-card-header">
                          <span className="ec-preview-num">图 {idx + 1}</span>
                          <span>{item.emoji || '🖼️'}</span>
                          <span className="ec-preview-label">{item.label}</span>
                          {item.sellingPoint && <span className="ec-preview-point">「{item.sellingPoint}」</span>}
                        </div>
                        <div className="ec-preview-prompt">
                          <textarea className="ec-prompt-textarea" value={item.userPrompt}
                            onChange={e => updateOutlinePrompt(idx, e.target.value)} rows={4} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {err && <div className="ec-error-bar">{err}</div>}
                <div className="ec-footer">
                  <button className="ec-back-btn" onClick={() => setGenPhase('config')}><X size={16} /> 返回修改</button>
                  <button className="ec-preview-btn" onClick={doGenEC} style={{ background: '#059669' }}>
                    <Check size={16} /> 确认生成 {ecOutline.length} 张图
                  </button>
                </div>
              </div>
            )}

            {/* ═══════ 生成结果阶段 ═══════ */}
            {!isXHS && genPhase === 'result' && ecResults && (
              <div className="ec-form">
                <div className="ec-preview-header">
                  <div className="ec-preview-title" style={{ color: '#059669' }}>✅ 生成完成</div>
                  <div className="ec-preview-sub">共生成 {Object.keys(ecResults.images || {}).length} 张图，点击「重新生成」可单独调整某张</div>
                </div>
                <div className="ec-result-grid">
                  {Object.entries(ecResults.images || {}).map(([label, url]) => (
                    <div key={label} className="ec-result-card">
                      <div className="ec-result-img-wrap" style={{ cursor:'zoom-in' }} onClick={() => setEcLightbox(url)}>
                        <img src={url} alt={label} className="ec-result-img-full" loading="lazy" />
                      </div>
                      <div className="ec-result-card-body">
                        <div className="ec-result-label">{ecLabel(baseKey(label))}</div>
                        {ecRegenEdit.visible && ecRegenEdit.label === label ? (
                          <div className="ec-regen-edit">
                            <textarea className="ec-regen-textarea" value={ecRegenEdit.prompt}
                              onChange={e => setEcRegenEdit(p => ({ ...p, prompt: e.target.value }))}
                              rows={3} placeholder="修改生成逻辑，AI 将按新描述重新绘制..."
                            />
                            <div className="ec-regen-actions">
                              <button className="ec-regen-cancel" onClick={() => setEcRegenEdit({ label: null, prompt: '', visible: false })}>
                                取消
                              </button>
                              <button className="ec-regen-confirm" onClick={() => doRegenerateImage(label, ecRegenEdit.prompt)}
                                disabled={ecRegeneratingKey === label}>
                                {ecRegeneratingKey === label ? '生成中...' : '✅ 确认重新生成'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="ec-result-prompt-trunc">
                              {ecOutline.find(o => o.key === baseKey(label) || o.label === label)?.userPrompt?.slice(0, 80) || ''}
                            </div>
                            <button className="ec-regen-btn" onClick={() => {
                              const prompt = ecOutline.find(o => o.key === baseKey(label) || o.label === label)?.userPrompt || '';
                              setEcRegenEdit({ label, prompt, visible: true });
                            }}>
                              <RotateIcon size={13} /> 编辑并重新生成
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {ecResults.errors?.length > 0 && (
                  <div className="ec-error-bar" style={{ background: '#FFF8F0', borderColor: '#FDDCB5', color: '#C05621' }}>
                    部分图片生成失败：{ecResults.errors.map(e => ecLabel(baseKey(e.style || e.key || ''))).join('、')}
                  </div>
                )}
                <div className="ec-footer">
                  <button className="ec-back-btn" onClick={() => { setGenPhase('config'); setEcResults(null); }}>
                    ← 继续生成新图
                  </button>
                </div>
              </div>
            )}

            {/* 图片放大查看 */}
            {ecLightbox && (
              <div className="ec-lightbox-overlay" onClick={() => setEcLightbox(null)}>
                <img src={ecLightbox} className="ec-lightbox-img" alt="放大查看" />
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

      <section className="section">
        <h2 className="section-title">两条产品线，看看效果</h2>
        <p className="section-sub">所有内容均由薯包AI一键生成</p>
        <div className="dual-grid">
          <div className="dual-col">
            <div className="dual-col-header">
              <div style={{ display:'flex', alignItems:'center', gap:6 }}><span className="dual-col-tag" style={{ background:'var(--red-bg)', color:'#C53030' }}>📝 小红书图文</span><span style={{ fontSize:10, color:'var(--text-faint)' }}>一句话 → 文案+9张图</span></div>
              <span style={{ fontSize:10, color:'var(--red)', cursor:'pointer' }} onClick={() => dispatch({ type:'NAVIGATE', page:'gallery' })}>更多 <ChevronRight size={10} /></span>
            </div>
            <div className="dual-col-body">
              <div className="mini-grid">{GALLERY.slice(0,6).map(g => (
                <div key={g.id} className="mini-card" onClick={() => dispatch({ type:'SET_RESULT', result:{...g, body_text:g.body, hashtags:g.tags, category:g.cat, _inputText:g.hint, _galleryItem:true} })}>
                  {g.cover_url ? <img className="mini-cover" src={proxyImg(g.cover_url)} alt="" loading="lazy" /> : <div className="mini-cover" style={{ background:g.grad }} />}
                  <div className="mini-title">{g.title}</div>
                </div>
              ))}</div>
            </div>
          </div>
          <div className="dual-col">
            <div className="dual-col-header">
              <div style={{ display:'flex', alignItems:'center', gap:6 }}><span className="dual-col-tag" style={{ background:'var(--blue-bg)', color:'#3730A3' }}>🛍️ 电商商品图</span><span style={{ fontSize:10, color:'var(--text-faint)' }}>商品照 → 白底/场景/详情</span></div>
            </div>
            <div className="dual-col-body">
              <div className="ec-result-grid">{['⬜ 白底主图','🌄 场景图','📋 详情图','🖼️ 组合图'].map((l,i) => (
                <div key={i} className="ec-result-card"><div className="ec-result-img" style={{ background:['linear-gradient(135deg,#f8f8f8,#eee)','linear-gradient(135deg,#E8F5E9,#C8E6C9)','linear-gradient(135deg,#FFF3E0,#FFE0B2)','linear-gradient(135deg,#E3F2FD,#BBDEFB)'][i]}} /><div className="ec-result-label">{l}</div></div>
              ))}</div>
              <div style={{ marginTop:8, display:'flex', flexWrap:'wrap', gap:4 }}>{['淘宝','京东','拼多多','小红书电商','抖音电商','亚马逊'].map(p => <span key={p} style={{ fontSize:9, padding:'2px 8px', borderRadius:4, background:'#f5f5f5', color:'var(--text-hint)' }}>{p}</span>)}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop:0 }}>
        <h2 className="section-title">核心能力</h2>
        <p className="section-sub">两条产品线共享的 AI 底层能力</p>
        <div className="features-grid">
          {[
            { Icon:Target, title:'智能赛道识别', desc:'自动判断内容类型，匹配最优生成策略', bg:'var(--red-bg)', color:'var(--red)' },
            { Icon:Palette, title:'多风格生成', desc:'小红书14赛道 + 电商4种图片风格', bg:'var(--blue-bg)', color:'var(--blue)' },
            { Icon:RefreshCw, title:'单张重生成', desc:'不满意单独刷新一张，不浪费整套额度', bg:'#E8F5E9', color:'#2E7D32' },
            { Icon:Copy, title:'一键复制导出', desc:'文案一键复制，图文打包ZIP下载', bg:'#FFF3E0', color:'#E65100' },
            { Icon:Monitor, title:'6大平台适配', desc:'电商图自动适配各平台主图尺寸规范', bg:'#F3E5F5', color:'#7B1FA2' },
            { Icon:ShieldCheck, title:'按套计费不套路', desc:'不自动续费，套餐不过期，用多少买多少', bg:'#f5f5f5', color:'#555' },
          ].map(({Icon,title,desc,bg,color},i) => (
            <div key={i} className="feature-card">
              <div className="feature-icon" style={{ background:bg, color }}><Icon size={15} /></div>
              <div className="feature-title">{title}</div>
              <div className="feature-desc">{desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="section" style={{ paddingTop:0 }}>
        <h2 className="section-title">定价</h2>
        <p className="section-sub">两种套餐独立计费，按需购买</p>
        <div className="pricing-row">
          <div className="pricing-col">
            <div className="pricing-header" style={{ color:'var(--red)' }}>📝 小红书图文</div>
            <div className="pricing-plans">{PRICING_XHS.slice(0,3).map((p,i) => (
              <div key={i} className={`plan-card ${p.pop?'pop-red':''}`} onClick={() => { if(!logged) dispatch({ type:'SHOW_LOGIN', show:true }); else dispatch({ type:'ADD_CREDITS', amount:p.sets }); }}>
                <div className="plan-name">{p.name}</div><div className="plan-price red">¥{p.price}</div><div className="plan-detail">{p.sets}套 · {p.imgs}</div>
              </div>
            ))}</div>
          </div>
          <div className="pricing-col">
            <div className="pricing-header" style={{ color:'var(--blue)' }}>🛍️ 电商商品图</div>
            <div className="pricing-plans">{PRICING_EC.slice(0,3).map((p,i) => (
              <div key={i} className={`plan-card ${p.pop?'pop-blue':''}`} onClick={() => { if(!logged) dispatch({ type:'SHOW_LOGIN', show:true }); else dispatch({ type:'ADD_CREDITS', amount:p.sets }); }}>
                <div className="plan-name">{p.name}</div><div className="plan-price blue">¥{p.price}</div><div className="plan-detail">{p.sets}套 · {p.imgs}</div>
              </div>
            ))}</div>
          </div>
        </div>
        <div style={{ textAlign:'center', marginTop:8, fontSize:10, color:'var(--text-faint)' }}>所有套餐一次性购买，不清零，不限时间 · <span style={{ color:'var(--red)', cursor:'pointer' }} onClick={() => dispatch({ type:'NAVIGATE', page:'pricing' })}>查看全部方案 →</span></div>
      </section>

      <section style={{ textAlign:'center', padding:'28px 20px 24px' }}>
        <CharImg src={IMAGES.jump} size={50} float />
        <h2 style={{ fontSize:'var(--text-2xl)', fontWeight:'var(--weight-heavy)', margin:'10px 0 4px' }}>一个工具，两种能力</h2>
        <p style={{ fontSize:'var(--text-sm)', color:'var(--text-hint)', margin:'0 0 14px' }}>小红书博主和电商卖家都在用</p>
        <div className="cta-btns">
          <button className="cta-btn red" onClick={() => { setMode('content'); window.scrollTo({ top:0, behavior:'smooth' }); }}>生成小红书图文</button>
          <button className="cta-btn blue" onClick={() => { setMode('ecommerce'); window.scrollTo({ top:0, behavior:'smooth' }); }}>生成电商商品图</button>
        </div>
      </section>

      {/* 参考图放大查看 Lightbox */}
      {ecPreviewLightbox && (
        <div className="ec-lightbox-overlay" onClick={() => setEcPreviewLightbox(null)}>
          <div className="ec-lightbox-content" onClick={e => e.stopPropagation()}>
            <button className="ec-lightbox-close" onClick={() => setEcPreviewLightbox(null)}>×</button>
            <img src={ecPreviewLightbox} alt="参考图放大" className="ec-lightbox-img" />
            <div className="ec-lightbox-hint">点击空白处关闭</div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
