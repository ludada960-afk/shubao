/**
 * 薯包AI · 一键出图
 * 极简电商商品图生成 — 选平台 + 输入内容 → 直接出合规套图
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkle, CaretRight, Download, ArrowsClockwise, Lightning } from '@phosphor-icons/react';
import { useApp } from '../../store/AppContext';
import { IMAGES } from '../../constants/images';
import { proxyImg, autoGenerate, saveWork } from '../../services/api';
import { canvasEntryActionsForResults, resultItemsFromImageMap } from '../EcCanvas/sendResultsToCanvas.js';
import { buildEcAutoStudioHandoff, canOpenEcAutoStudioHandoff } from './ecAutoStudioHandoff.js';
import { getImageSkill } from '../../skills/imageSkills.js';
import { handleGenerationAccessError } from '../../utils/generationAccess.js';
import { CharImg } from '../../components/ui/index';
import Footer from '../../components/layout/Footer';
import { createEcommerceDraftId } from '../Home/ec/ecommercePlanModel.js';
import {
  ECOMMERCE_DRAFT_SURFACES,
  acceptEcommerceFinalResult,
  createEcommerceGenerationLifecycleController,
  loadOrCreateEcommerceDraft,
  mergeEcommerceInProgressPreview,
  rotateEcommerceDraft,
} from '../Home/ec/ecommerceTaskProgressModel.js';

const Sparkles = Sparkle;
const Zap = Lightning;
const RotateCcw = ArrowsClockwise;
const ChevronRight = CaretRight;

const PLATFORMS = [
  { key: '淘宝', label: '淘宝/天猫', emoji: '🟠', desc: '800×800白底主图 + 详情分段' },
  { key: '京东', label: '京东', emoji: '🛒', desc: '800×800白底主图 + 详情分段' },
  { key: '拼多多', label: '拼多多', emoji: '🟢', desc: '750×750白底主图 + 详情分段' },
  { key: '抖音', label: '抖音小店', emoji: '🎵', desc: '800×800主图 + 促销文案 + 详情' },
  { key: '亚马逊', label: 'Amazon', emoji: '🌐', desc: '1000×1000+纯白底6张，无文字' },
  { key: '小红书', label: '小红书种草', emoji: '📕', desc: '1080×1440场景种草图3张' },
];

let observedEcommerceWorkVersion = 0;

/* 批 CY-㉑：「去精修工坊微调」落到哪条技能。
   与 galleryRemixTarget.ECOMMERCE_RECIPE_SKILL 里 `product_suite` 的落点一致 ——
   一键出图出的就是商品套图，落到同一条技能，用户看到的是同一套表单。 */
const EC_AUTO_HANDOFF_SKILL_ID = 'image.product_suite';

export default function EcAutoPage() {
  const { state, dispatch, fetchCredits } = useApp();
  const ownerEmail = String(state.email || state.phone || '').trim().toLowerCase();
  const workVersion = Number(state._workVersion || 0);
  const [platform, setPlatform] = useState('淘宝');
  const [input, setInput] = useState('');
  /* D11 键盘可达：输入区 textarea 抑制了 UA 轮廓，焦点可见性由外层容器承担 */
  const [focused, setInputFocused] = useState(false);
  const [genState, setGenState] = useState('idle'); // idle | generating | done
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const textRef = useRef(null);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);
  const [draftId, setDraftId] = useState(() => loadOrCreateEcommerceDraft({
    ownerEmail,
    surface: ECOMMERCE_DRAFT_SURFACES.EC_AUTO,
    createDraftId: createEcommerceDraftId,
  })?.draftId || '');
  const [inProgressPreview, setInProgressPreview] = useState({});
  const [genProgress, setGenProgress] = useState('');
  const generationTokenRef = useRef(null);
  const generationAbortRef = useRef(null);
  const observedWorkVersionRef = useRef(workVersion);
  const generationLifecycleRef = useRef(null);
  if (!generationLifecycleRef.current) {
    generationLifecycleRef.current = createEcommerceGenerationLifecycleController({
      ownerEmail,
      draftId,
      tokenRef: generationTokenRef,
      abortRef: generationAbortRef,
    });
  }
  const generationLifecycle = generationLifecycleRef.current;
  generationLifecycle.syncContext({ ownerEmail, draftId });
  if (workVersion > observedWorkVersionRef.current) {
    generationLifecycle.invalidate();
    observedWorkVersionRef.current = workVersion;
  }
  const beginGeneration = (options) => generationLifecycle.begin(options);
  const isGenerationCurrent = (token) => generationLifecycle.isCurrent(token);

  useEffect(() => {
    generationLifecycle.invalidate();
    const active = loadOrCreateEcommerceDraft({
      ownerEmail,
      surface: ECOMMERCE_DRAFT_SURFACES.EC_AUTO,
      createDraftId: createEcommerceDraftId,
    });
    setDraftId(active?.draftId || '');
    setResults(null);
    setInProgressPreview({});
    setGenProgress('');
    setError('');
    setGenState('idle');
  }, [ownerEmail]);

  useEffect(() => {
    if (!workVersion || workVersion <= observedEcommerceWorkVersion) return;
    observedEcommerceWorkVersion = workVersion;
    generationLifecycle.invalidate();
    const rotated = rotateEcommerceDraft({
      ownerEmail,
      surface: ECOMMERCE_DRAFT_SURFACES.EC_AUTO,
      currentDraftId: draftId,
      createDraftId: createEcommerceDraftId,
    });
    if (!rotated?.draftId) return;
    setDraftId(rotated.draftId);
    setResults(null);
    setInProgressPreview({});
    setGenState('idle');
    setGenProgress('');
    setError('');
  }, [draftId, ownerEmail, workVersion]);

  useEffect(() => () => {
    generationLifecycle.unmount();
  }, []);

  // 生成计时器
  useEffect(() => {
    if (genState === 'generating') {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [genState]);

  const selectedPlatform = PLATFORMS.find(p => p.key === platform);

  // 自动调整 textarea 高度
  useEffect(() => {
    if (textRef.current) {
      textRef.current.style.height = 'auto';
      textRef.current.style.height = textRef.current.scrollHeight + 'px';
    }
  }, [input]);

  const handleGenerate = async () => {
    if (!input.trim() || genState === 'generating') return;
    const generation = beginGeneration({
      onPreconditionError: (preconditionError) => {
        setError(preconditionError.message);
        setGenState('idle');
      },
    });
    if (!generation) {
      return;
    }
    const { token: generationToken, signal: generationSignal } = generation;
    setGenState('generating');
    setError('');
    setResults(null);
    setInProgressPreview({});
    setGenProgress('');
    dispatch({ type: 'START_GEN' });
    try {
      const data = await autoGenerate({
        platform,
        input: input.trim(),
        email: state.phone,
        draftId,
        signal: generationSignal,
        isCurrent: () => isGenerationCurrent(generationToken),
        onProgress: (task) => {
          if (!isGenerationCurrent(generationToken)) return;
          const progress = task?.message || task?.step || task?.assets?.find(asset => asset.userState)?.userState;
          if (progress) setGenProgress(progress);
        },
        /* 2026-09-20 裁定②：自动补跑的事前告知（不允许静默扣）。 */
        onNotice: (notice) => {
          if (!isGenerationCurrent(generationToken)) return;
          if (notice?.text) setGenProgress(notice.text);
        },
        onImage: (image) => {
          if (!isGenerationCurrent(generationToken)) return;
          const url = image?.stableUrl || image?.url;
          if (!image?.id || !url) return;
          setInProgressPreview(previous => mergeEcommerceInProgressPreview(previous, { ...image, url }));
          setGenProgress(`已生成: ${image.label || image.role || image.id}`);
        },
      });
      if (!isGenerationCurrent(generationToken)) return;
      const finalResult = acceptEcommerceFinalResult(data);
      if (!finalResult) throw new Error('任务尚未完成或没有稳定图片，请稍后继续生成');
      setResults(finalResult);
      setInProgressPreview({});
      /* 批 CY-⑮：这一页以前**完全不调 saveWork**（`rg saveWork src/pages/EcAuto` 零命中），
         所以「一键出图」出来的作品**不进「我的作品」**——刷新一下就没了。
         同一个产品里两条等价产图路径：MediaCreation 与 EcStudio 都会存，只有这里不存。
         ⚠️ saveWork 失败时**返回 null 不抛**（services/api.js:1826），所以必须自己判返回值、
            明确告诉用户，否则就是"看起来成功了、其实没存"。
         这里用本页已有的 setError 通道（不新造状态），且只在**真的没存住**时才提示。 */
      try {
        const saved = await saveWork({
          ...finalResult,
          _ecResult: true,
          _saveKey: 'eca-' + Date.now(),
          at: new Date().toLocaleDateString('zh-CN'),
        }, state.phone);
        if (!saved) setError('图片已生成，但没能存进「我的作品」—— 请先下载保存，别刷新这一页');
      } catch (saveError) {
        setError('图片已生成，但没能存进「我的作品」—— 请先下载保存，别刷新这一页');
        if (import.meta.env?.DEV) console.warn('[ec-auto] saveWork 失败', saveError);
      }
      fetchCredits(state.phone);
      setGenState('done');
      dispatch({ type: 'CLOSE_RESULT' });
    } catch (e) {
      if (!isGenerationCurrent(generationToken)) return;
      const accessResult = handleGenerationAccessError(e, dispatch, {
        source: 'ecommerce-auto',
        message: '当前平台、商品描述和参考图片都已保留，充值后可以继续生成。',
      });
      setError(accessResult ? '' : (e.message || '生成失败，请重试'));
      setGenState('idle');
      dispatch({ type: 'CLOSE_RESULT' });
    } finally {
      if (isGenerationCurrent(generationToken)) {
        generationLifecycle.release(generationToken);
      }
    }
  };

  const startNewProduct = () => {
    generationLifecycle.invalidate();
    const rotated = rotateEcommerceDraft({
      ownerEmail,
      surface: ECOMMERCE_DRAFT_SURFACES.EC_AUTO,
      currentDraftId: draftId,
      createDraftId: createEcommerceDraftId,
    });
    if (!rotated?.draftId) return;
    setDraftId(rotated.draftId);
    setResults(null);
    setInProgressPreview({});
    setGenProgress('');
    setError('');
    setInput('');
    setGenState('idle');
  };

  // 下载单张
  const downloadImage = (url, name) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
  };

  // 全部下载
  /* ═══ 批 CY-⑰：结果送到画布（这一条路径以前是死胡同）═════════════════════════════════════
     EcAuto 的结果区只有「全部下载」+「重新生成」+「去精修工坊微调」——
     出了图**没有任何一个去处能把它们接回创作流程**（连精修工坊也只是跳到一个空白配置页）。
     这里补上与 MediaCreation / EcStudio 同一条出口：SET_CREATION_LAUNCH + OPEN_CANVAS。 */
  const sendAllResultsToCanvas = () => {
    const actions = canvasEntryActionsForResults(
      resultItemsFromImageMap(results?.images || {}, { prefix: '一键出图' }),
      /* ⚠️ 这一页没有 productName state，商品名就是用户填的那段 input（原变量名是 `input`）。
         写错名字就是又一次"用了没声明的标识符" —— 见 jsx-undefined-identifiers 门禁。 */
      { title: String(input || '').trim().slice(0, 40) || '一键出图结果' },
    );
    if (!actions.length) { setError('还没有可送到画布的图，先生成一次'); return; }
    for (const action of actions) dispatch(action);
  };

  /* ═══ 批 CY-㉑：「去精修工坊微调」以前是**空手跳转** ══════════════════════════════════════
     原来只有 `dispatch({type:'NAVIGATE', page:'ec-studio'})` —— 换页面，不带任何东西。
     而 EcStudio 挂载时只读 `loadOrCreateEcommerceDraft(...)`，**从不读传入载荷**
     （它的三个 useEffect 只认 ownerEmail / workVersion）⇒ 用户点「微调」到了一个**空白配置页**，
     刚生成的图一张也没跟过去，得手工重传一遍。
     ⇒ 走 `image-creation`（MediaCreation）那条**已经存在**的入参落地通道
     （canvas-node-edit：work-remix 的同一个形状，MediaCreation:1604 已经认这个 kind）。
     ⚠️ 只预填、**不触发生成**：扣费仍在目标页由用户点「立即生成」时才发生。 */
  const openStudioHandoff = () => {
    const skill = getImageSkill(EC_AUTO_HANDOFF_SKILL_ID);
    const launch = buildEcAutoStudioHandoff({
      results,
      prompt: input,
      skillId: EC_AUTO_HANDOFF_SKILL_ID,
      skill,
    });
    if (!launch) {
      setError(canOpenEcAutoStudioHandoff(skill)
        ? '还没有可微调的结果图，先生成一次'
        : '这条技能暂时没有上传位，没法把图带过去微调');
      return;
    }
    dispatch({ type: 'SET_CREATION_LAUNCH', launch });
    dispatch({ type: 'NAVIGATE', page: 'image-creation' });
  };

  const downloadAll = () => {
    if (!results?.images) return;
    Object.entries(results.images).forEach(([label, url]) => {
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = url;
        a.download = `${results.product_name || '商品'}-${label}.png`;
        a.click();
      }, 200);
    });
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFB' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px' }}>
        {/* 顶部导航 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          {/* 原则 4.1：Logo 是「回首页」导航动作 → 真控件 button。
              .a11y-reset 承接 UA 默认外观归零；display:flex/gap 保持原内联样式 → 视觉零变化。 */}
          <button type="button" className="a11y-reset" aria-label="返回首页"
            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
            onClick={() => dispatch({ type: 'NAVIGATE', page: 'home' })}>
            <CharImg src={IMAGES.appicon} size={28} float />
            <span style={{ fontSize: 'var(--sb-text-xl)', fontWeight: 650, color: 'var(--sb-danger)', fontFamily: '-apple-system,"PingFang SC",sans-serif' }}>
              薯包AI
            </span>
            <span style={{ fontSize: 'var(--sb-text-xs)', color: 'var(--sb-ink-4)', marginLeft: 4, background: 'var(--sb-neutral-100)', padding: '2px 8px', borderRadius: 'var(--sb-radius-xs)' }}>
              一键出图
            </span>
          </button>
          <button onClick={() => dispatch({ type: 'NAVIGATE', page: 'ec-studio' })}
            style={{
              fontSize: 'var(--sb-text-sm)', color: 'var(--sb-ink-3)', background: 'var(--sb-neutral-0)', border: '1px solid var(--sb-neutral-200)',
              borderRadius: 'var(--sb-radius-md)', padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--sb-brand-700)'; e.currentTarget.style.color = 'var(--sb-brand-700)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--sb-neutral-200)'; e.currentTarget.style.color = 'var(--sb-ink-3)'; }}>
            🔧 精修工坊
          </button>
        </div>

        {/* 平台选择 */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 'var(--sb-text-sm)', color: 'var(--sb-ink-3)', marginBottom: 8, fontWeight: 500 }}>选择平台</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PLATFORMS.map(p => (
              <button key={p.key} onClick={() => setPlatform(p.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--sb-space-1-5)',
                  padding: '10px 16px', borderRadius: 'var(--sb-radius-lg)',
                  border: platform === p.key ? '2px solid var(--sb-brand-700)' : '1px solid var(--sb-neutral-200)',
                  background: platform === p.key ? 'var(--sb-brand-50)' : 'var(--sb-neutral-0)',
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.15s',
                  flex: '0 0 auto',
                }}>
                <span style={{ fontSize: 'var(--sb-text-xl)' }}>{p.emoji}</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 'var(--sb-text-md)', fontWeight: platform === p.key ? 600 : 500, color: platform === p.key ? 'var(--sb-brand-700)' : '#444' }}>
                    {p.label}
                  </div>
                  <div style={{ fontSize: 'var(--sb-text-2xs)', color: platform === p.key ? '#7C7CFF' : 'var(--sb-ink-4)', marginTop: 1 }}>
                    {p.desc}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 输入区 —— D11：无边框 textarea 的焦点可见性由容器承担（焦点环落在外层卡片，
             既清晰可见，又不改动 textarea 自身的盒模型） */}
        <div style={{
          background: 'var(--sb-neutral-0)', borderRadius: 'var(--sb-radius-lg)', padding: 20,
          boxShadow: focused ? 'var(--sb-shadow-ring)' : '0 1px 6px rgba(12,10,9,0.04)',
          border: '1px solid var(--sb-neutral-150)',
          marginBottom: 16,
          transition: 'box-shadow var(--sb-dur-fast, 160ms) ease',
        }}>
          <textarea ref={textRef}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            value={input} onChange={e => setInput(e.target.value)}
            placeholder={platform === '亚马逊' ? '输入商品英文描述...\n\n例如：Stainless steel water bottle 500ml, minimalist design'
              : `描述你的商品，AI自动生成全套商品图...\n\n短句：白色陶瓷杯简约风办公用、无线蓝牙耳机入耳式\n或输入详细描述，AI按需求生成全套商品图`}
            style={{
              width: '100%', minHeight: 80, maxHeight: 240,
              border: 'none', outline: '0 solid transparent', resize: 'none',
              fontSize: 'var(--sb-text-md)', lineHeight: 1.7, color: 'var(--sb-ink-1)',
              fontFamily: 'inherit', padding: 0,
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <div style={{ display: 'flex', gap: 'var(--sb-space-1-5)', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--sb-text-xs)', color: 'var(--sb-ink-5)' }}>
                {input.length}字 · {/^https?:\/\//i.test(input.trim()) ? '🔗 链接模式' : input.trim().length >= 80 ? '📝 详细模式 · 按描述生成' : '✏️ 标准模式 · 一句话生成'}
              </span>
            </div>
            <button onClick={handleGenerate} disabled={!input.trim() || genState === 'generating'}
              style={{
                display: 'flex', alignItems: 'center', gap: 'var(--sb-space-1-5)',
                padding: '10px 24px', borderRadius: 'var(--sb-radius-lg)',
                background: !input.trim() ? 'var(--sb-neutral-200)' : 'var(--sb-brand-700)',
                color: 'var(--sb-neutral-0)', border: 'none', fontSize: 'var(--sb-text-md)', fontWeight: 600,
                cursor: !input.trim() ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', transition: 'all 0.15s',
                boxShadow: !input.trim() ? 'none' : '0 2px 10px var(--sb-brand-a32)',
              }}
              onMouseEnter={e => { if (input.trim()) e.currentTarget.style.opacity = '0.92'; }}
              onMouseLeave={e => { if (input.trim()) e.currentTarget.style.opacity = '1'; }}>
              {genState === 'generating' ? <><Zap size={15} className="animate-spin" /> 生成中...</>
                : <><Sparkles size={15} /> 一键生成全套图</>}
            </button>
          </div>
        </div>

        {/* 生成中 */}
        {genState === 'generating' && (
          <div style={{
            background: 'var(--sb-neutral-0)', borderRadius: 'var(--sb-radius-lg)', padding: 28,
            boxShadow: '0 1px 6px rgba(12,10,9,0.04)', border: '1px solid var(--sb-neutral-150)',
            marginBottom: 16, textAlign: 'center',
          }}>
            <div style={{
              width: 40, height: 40, border: '3px solid var(--sb-brand-100)', borderTopColor: 'var(--sb-brand-700)',
              borderRadius: '50%', animation: 'spin 0.8s linear infinite',
              margin: '0 auto 14px',
            }} />
            <div style={{ fontSize: 'var(--sb-text-lg)', fontWeight: 600, color: 'var(--sb-ink-1)', marginBottom: 4 }}>✨ AI 正在生成商品图...</div>
            <div style={{ fontSize: 'var(--sb-text-sm)', color: 'var(--sb-ink-4)' }}>
              {input.trim().length >= 80 && !/^https?:\/\//i.test(input.trim())
                ? '完整prompt模式 · 原样执行'
                : `${selectedPlatform?.label || platform}标准套餐 · 每张约需25秒`}
              {elapsed >= 10 && ` · 已等待 ${elapsed} 秒`}
            </div>
            {genProgress && <div style={{ marginTop: 8, fontSize: 'var(--sb-text-sm)', color: 'var(--sb-brand-700)' }}>{genProgress}</div>}
            {Object.keys(inProgressPreview).length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 14 }}>
                {Object.values(inProgressPreview).map(image => (
                  <img key={image.id} src={proxyImg(image.url)} alt={image.label || image.role || image.id}
                    style={{ width: 76, height: 76, objectFit: 'cover', borderRadius: 'var(--sb-radius-md)', border: '1px solid var(--sb-brand-200)' }} />
                ))}
              </div>
            )}
            {elapsed >= 30 && (
              <div style={{ fontSize: 'var(--sb-text-xs)', color: 'var(--sb-warning)', marginTop: 8, background: '#FFFBEB', padding: '6px 12px', borderRadius: 'var(--sb-radius-md)', display: 'inline-block' }}>
                多张图片正在并行生成，请稍候...
              </div>
            )}
          </div>
        )}

        {genState !== 'generating' && Object.keys(inProgressPreview).length > 0 && (
          <div style={{ background: 'var(--sb-neutral-0)', borderRadius: 'var(--sb-radius-lg)', padding: 20, marginBottom: 16, border: '1px solid var(--sb-brand-200)' }}>
            <div style={{ fontSize: 'var(--sb-text-md)', fontWeight: 600, color: 'var(--sb-brand-700)', marginBottom: 10 }}>生成中预览 · 任务仍可继续</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.values(inProgressPreview).map(image => (
                <img key={image.id} src={proxyImg(image.url)} alt={image.label || image.role || image.id}
                  style={{ width: 92, height: 92, objectFit: 'cover', borderRadius: 'var(--sb-radius-md)' }} />
              ))}
            </div>
          </div>
        )}

        {/* 结果 */}
        {error && (
          <div style={{
            background: 'var(--sb-danger-soft)', borderRadius: 'var(--sb-radius-lg)', padding: '12px 16px',
            fontSize: 'var(--sb-text-md)', color: 'var(--sb-danger-hover)', marginBottom: 16,
          }}>{error}</div>
        )}

        {results && (
          <div style={{
            background: 'var(--sb-neutral-0)', borderRadius: 'var(--sb-radius-lg)', padding: 20,
            boxShadow: '0 1px 6px rgba(12,10,9,0.04)', border: '1px solid var(--sb-neutral-150)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 'var(--sb-text-lg)', fontWeight: 600, color: '#1e1e2e' }}>
                  ✅ 生成完成
                </div>
                <div style={{ fontSize: 'var(--sb-text-sm)', color: 'var(--sb-ink-4)', marginTop: 2 }}>
                  {Object.keys(results.images || {}).length} 张图 · {results.raw_mode ? '完整prompt模式' : `${selectedPlatform?.label || platform} 标准`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={downloadAll}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '8px 16px', borderRadius: 'var(--sb-radius-md)',
                    background: 'var(--sb-brand-50)', color: 'var(--sb-brand-700)', border: 'none',
                    fontSize: 'var(--sb-text-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  <Download size={13} /> 全部下载
                </button>
                <button onClick={startNewProduct}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '8px 14px', borderRadius: 'var(--sb-radius-md)',
                    background: 'var(--sb-neutral-100)', color: 'var(--sb-ink-3)', border: 'none',
                    fontSize: 'var(--sb-text-sm)', cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  <RotateCcw size={13} /> 重新生成
                </button>
                {/* 批 CY-⑰：这一条产图路径以前是**死胡同** —— 出了图除了「全部下载」没有第二个去处，
                    而功能等价的 MediaCreation / EcStudio 都有「送到画布」。 */}
                <button onClick={sendAllResultsToCanvas}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '8px 14px', borderRadius: 'var(--sb-radius-md)',
                    background: 'var(--sb-neutral-0)', color: 'var(--sb-ink-3)',
                    border: '1px solid var(--sb-neutral-200)',
                    fontSize: 'var(--sb-text-sm)', cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  全部送到画布
                </button>
              </div>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: 12,
            }}>
              {Object.entries(results.images || {}).map(([label, url]) => (
                <div key={label} style={{
                  background: '#f8f8f8', borderRadius: 'var(--sb-radius-lg)', overflow: 'hidden',
                  border: '1px solid var(--sb-neutral-100)',
                }}>
                  <div style={{
                    width: '100%', aspectRatio: '1/1',
                    background: 'var(--sb-neutral-0)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden',
                  }}>
                    <img src={proxyImg(url)} alt={label} style={{
                      width: '100%', height: '100%', objectFit: 'contain',
                      display: 'block',
                    }} loading="lazy" />
                  </div>
                  <div style={{
                    padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    borderTop: '1px solid var(--sb-neutral-100)',
                  }}>
                    <span style={{ fontSize: 'var(--sb-text-xs)', fontWeight: 600, color: 'var(--sb-ink-3)' }}>{label}</span>
                    <button onClick={() => downloadImage(url, `${label}.png`)} style={{
                      fontSize: 'var(--sb-text-2xs)', color: 'var(--sb-brand-700)', cursor: 'pointer',
                      padding: '3px 8px', borderRadius: 'var(--sb-radius-xs)',
                      background: 'var(--sb-brand-50)', border: 'none', fontWeight: 500, fontFamily: 'inherit',
                    }}>
                      下载
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* 底栏 */}
            <div style={{
              marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--sb-neutral-100)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontSize: 'var(--sb-text-sm)', color: 'var(--sb-ink-4)',
            }}>
              <span>
                {results.raw_mode
                  ? '📝 使用完整prompt模式生成，AI原样执行'
                  : `📐 尺寸已适配 ${platform} 平台规范，可直接上架`}
              </span>
              {/* 批 CY-㉑：改前是 `onClick={() => dispatch({type:'NAVIGATE', page:'ec-studio'})}`
                  —— 只换页面、不带任何东西，而 EcStudio 并不读传入载荷
                  ⇒ 到了那边是一张空白配置页，刚出的图一张也没跟过去。
                  现在把结果图与提示词一起带进图片生成的对应技能页。 */}
              <button onClick={openStudioHandoff}
                style={{
                  background: 'none', border: 'none', color: 'var(--sb-brand-700)',
                  cursor: 'pointer', fontSize: 'var(--sb-text-sm)', fontWeight: 500, fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 3,
                }}>
                带着这批图去精修 <ChevronRight size={12} />
              </button>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
