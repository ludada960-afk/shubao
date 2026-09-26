import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  PLAN_PREVIEW_SKU,
  composePlanPreview,
  fetchPlanPreviewBalance,
  fetchPlanPreviewOptions,
  planPreviewActionId,
  quotePlanPreview,
} from '../../services/planPreview.js';
import {
  appliedPlanText,
  customItemRow,
  itemRowsOf,
  planInputSignature,
  planPreviewSpecFor,
  preselectedDirections,
} from './planPreviewModel.js';
import './plan-preview.css';

/* ═══ 三步方案预览（批 K-C 图片侧「预览」/ 批 K-D 视频侧「代为撰写」）══════════════════════
   用户第 16 轮原话：「这两套东西**本质上都是一个设计方案**，只是在它里面**有不同的入口**。」
   ⇒ 所以这里是**一份组件、两个入口**（图片侧从配置面板的「预览」进，视频侧从提示词框旁进），
     只有文案不同（用户明说「文案表述可以不一样」），逻辑与布局完全一致。

   抄的是知渔「代为撰写」（docs/design/61-quantv-dawei-chuanxie.md）：
     ① 素材理解（**可编辑**，用户能纠偏）② 方向与偏好（三维档位）③ 方案预览（可改、确认后应用）
     点之前先弹计费确认（他们的弹窗原文：立即「代为撰写」/ 预计消耗积分 / 计费明细 /
     「实际扣费以任务成功结果为准，失败不扣对应项积分。」/ [取消][继续生成]）。

   ⚠️ 价格：**0.5 积分 / 次**，一次一个数（不按张、不按步叠加）—— 用户第 16 轮把定价权交给我时定的口径。 */

const COPY = {
  video: {
    entry: '代为撰写',
    confirmTitle: '立即「代为撰写」',
    steps: [
      { title: '分析素材', hint: '分析素材内容' },
      { title: '创作脚本', hint: '选择创作方向与脚本偏好' },
      { title: '预览脚本', hint: '确认脚本并应用' },
    ],
    loadingTitle: '正在分析素材',
    loadingHint: '正在分析上传图片并提炼商品洞察',
    loadingPool: ['正在提炼商品卖点和使用场景', '正在拆解画面里的关键信息', '正在识别素材中的主体与场景', '正在生成可转化为脚本的创意方向'],
    apply: '确认脚本并应用',
    detailName: '方案预览（素材理解 + 方向偏好 + 脚本生成）',
  },
  image: {
    entry: '生成预览',
    confirmTitle: '立即「生成预览」',
    steps: [
      { title: '素材理解', hint: '读懂每张素材' },
      { title: '方向与偏好', hint: '选择画面方向' },
      { title: '方案预览', hint: '确认方案并应用' },
    ],
    loadingTitle: '正在理解素材',
    loadingHint: '正在读你上传的图片并提炼画面要点',
    loadingPool: ['正在提炼商品卖点和使用场景', '正在拆解画面里的关键信息', '正在识别素材中的主体与场景', '正在生成可用的画面方向'],
    apply: '确认方案并应用',
    detailName: '方案预览（素材理解 + 方向偏好 + 方案生成）',
  },
};

function copyOf(surface) {
  return COPY[surface === 'video' ? 'video' : 'image'];
}

export default function PlanPreviewDialog({
  open,
  surface = 'image',
  skillName = '',
  /* ⚠️ 批 BW：**这条 skill 是谁**决定了"解析什么、问什么方向" ——
     服务端按它取 parseSpecs 里的声明（概念视觉方案因此不会去解析卖点/人群/参数）。
     首页那种没有具体 skill 的入口不传，退回通用档。 */
  skillId = '',
  prompt = '',
  materials = [],
  onClose,
  onApply,
  /* ⚠️ 降级出口：模型不可用时方案正文是空的，「确认并应用」按不了 ——
     不给出口就是一个**死胡同**（用户既没拿到方案、也走不到生成）。
     这一条实测踩到过：e2e 走到这里卡住，才发现对话框把主流程堵死了。
     跳过 = 不应用任何方案、直接回到原来的生成路径（没扣费，也没什么可应用的）。 */
  onSkip,
  /* 「手上有一份**没应用**的方案」——由本组件报给页面，页面据此在离开子页面时拦一下
     （用户口径：「用户退出这个子页面时提示他确定退出吗，这个方案或脚本会丢失」）。 */
  onPlanStateChange,
}) {
  const copy = copyOf(surface);
  const [stage, setStage] = useState('confirm');
  const [step, setStep] = useState(0);
  const [plan, setPlan] = useState(null);
  const [understanding, setUnderstanding] = useState([]);
  const [items, setItems] = useState([]);
  const [declared, setDeclared] = useState([]);
  const [direction, setDirection] = useState({});
  const [dimensions, setDimensions] = useState([]);
  const [balance, setBalance] = useState(null);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const runningRef = useRef(false);
  /* 这份方案是按**什么输入**生成的（只算弹窗外的那几样，见 planInputSignature）。
     关掉弹窗再打开时比对它：一样 ⇒ 把上一份方案原样摆回来（不请求、不扣费）。 */
  const signatureRef = useRef('');

  const inputSignature = useMemo(
    () => planInputSignature({ surface, skillId, skillName, prompt, materials }),
    [surface, skillId, skillName, prompt, materials],
  );
  /* ⚠️ 批 BW：**这条 skill 自己的解析方案在这里算**（声明源 `src/skills/parseSpecs.js` 在前端产物里）。
     算得出来就用它（步① 的行 + 步② 的档位，且**下发给服务端**）；
     算不出来（首页那种没有具体 skill 的入口）才回服务端取表面级通用档。 */
  const localSpec = useMemo(() => planPreviewSpecFor(skillId), [skillId]);

  useEffect(() => {
    if (!open) return undefined;
    /* ═══ 批 BX：**关掉再打开 = 回到同一份方案**（用户口径，逐字）═══════════════════════════
       「生成预览方案和生成脚本这种弹窗形式的，应该是用户可以关掉这个弹窗，但是**再点一次这个按钮
        可以回到这个弹窗里面**啊。」
       ⇒ 输入没变（还是那次生成时的需求与素材）就把上一份方案（含用户在步①/②/③ 改过的东西）
         原样摆回来：**不重新请求、不重复扣费**；输入变了才是新的一份（从计费确认重新走）。 */
    if (plan && signatureRef.current === inputSignature) {
      setStage('ready');
      setStep(0);
      setError('');
      return undefined;
    }
    setStage('confirm');
    setStep(0);
    setPlan(null);
    setError('');
    setItems([]);
    setUnderstanding((materials || []).slice(0, 6).map((item, index) => ({
      id: String(item?.id || 'material-' + (index + 1)),
      name: String(item?.name || '素材 ' + (index + 1)),
      understanding: '',
    })));
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, inputSignature]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    if (localSpec) {
      /* 步② 一打开就**默认选中每组的第一档**（门禁保证那是中性档"交系统判断"，
         或是这条 skill 已经声明过的默认值）—— 不让用户为了往下走而把每一组都点一遍。
         步① 的**行**也在这一刻建好（模型还没答时值为空）——
         "这条技能要解析什么"因此是**看得见**的，而不是等模型返回才知道。
         ⚠️ 批 BY：这里原来还会把 source（'override'/'family'）记进 state 给界面显示
            「按这条技能自己的解析方案」—— 那是内部说法，已按用户口径去掉，state 随之删掉。 */
      setDimensions(localSpec.directions);
      setDirection(preselectedDirections(localSpec.directions));
      setDeclared(localSpec.items);
      setItems(current => itemRowsOf(localSpec.items, [], current));
    } else {
      /* 没有具体 skill（首页入口）⇒ 取服务端的表面级通用档，解析条目为空（本来就没有"这条技能"）。 */
      fetchPlanPreviewOptions(surface).then(data => {
        if (cancelled) return;
        const list = Array.isArray(data?.directions) ? data.directions : [];
        setDimensions(list);
        setDirection(preselectedDirections(list));
        setDeclared([]);
      }).catch(() => {
        if (cancelled) return;
        setDimensions([]);
        setDeclared([]);
      });
    }
    fetchPlanPreviewBalance().then(value => { if (!cancelled) setBalance(value); }).catch(() => {});
    return () => { cancelled = true; };
  }, [open, surface, skillId, localSpec]);

  useEffect(() => {
    if (stage !== 'running') return undefined;
    const timer = setInterval(() => setTick(value => value + 1), 2600);
    return () => clearInterval(timer);
  }, [stage]);

  const run = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setStage('running');
    setError('');
    try {
      const quote = await quotePlanPreview();
      /* 用户在步① 改过的解析条目 = 已确认的结论，一并下发（服务端把它当**以此为准**的那一份）。 */
      const confirmedItems = (items || [])
        .map(item => ({ key: item.key, label: item.label, value: String(item.value || '').trim() }))
        .filter(item => item.value);
      const payload = {
        surface,
        skillId,
        skillName,
        prompt,
        direction,
        items: confirmedItems,
        /* 这条 skill 的解析项声明、档位与"是哪一套"（服务端据此组织模型请求，只做消毒不做解析） */
        specItems: localSpec?.items || [],
        directions: localSpec?.directions || [],
        specKey: localSpec?.key || '',
        specSource: localSpec?.source || '',
        materials: (materials || []).slice(0, 6).map((item, index) => ({
          id: String(item?.id || 'material-' + (index + 1)),
          name: String(item?.name || '素材 ' + (index + 1)),
          url: String(item?.url || ''),
        })),
        billingQuoteId: quote?.quoteId,
        billingActionId: planPreviewActionId({ surface, skillId, skillName, prompt, direction, materials, items: confirmedItems }),
      };
      const result = await composePlanPreview(payload);
      const composed = result?.plan || {};
      setPlan(composed);
      /* 记住"这份是按哪份输入生成的"——关掉再打开时比对它决定是摆回旧方案还是重新走一遍。 */
      signatureRef.current = inputSignature;
      if (Array.isArray(composed.materials) && composed.materials.length) setUnderstanding(composed.materials);
      /* 服务端回的是**声明源 + 模型结论**合并后的条目；用户自己加的行保留（见 itemRowsOf）。 */
      const specItems = Array.isArray(composed.items) && composed.items.length ? composed.items : declared;
      setItems(current => itemRowsOf(specItems, composed.items, current));
      if (specItems.length) setDeclared(specItems);
      setStep(0);
      setStage('ready');
    } catch (failure) {
      setError(failure?.message || '方案预览失败，请稍后重试（失败不扣积分）。');
      setStage('confirm');
    } finally {
      runningRef.current = false;
    }
  }, [surface, skillId, skillName, prompt, direction, materials, items, declared, localSpec, inputSignature]);

  /* ═══ 批 BX：把"手上有一份没应用的方案"报给页面 ═══════════════════════════════════════
     页面据此在**离开子页面**时拦一下（用户口径：「用户退出这个子页面时提示他确定退出吗，
     这个方案或脚本会丢失」）。判据是"已经生成出来了、还没写回工作台"——
     还在计费确认页（没生成）不算，已经应用/跳过也不算（那时东西已经在工作台里了）。 */
  useEffect(() => {
    onPlanStateChange?.(Boolean(plan) && stage === 'ready');
  }, [onPlanStateChange, plan, stage]);

  if (!open) return null;

  const patchUnderstanding = (index, value) => {
    setUnderstanding(current => current.map((item, position) => (
      position === index ? { ...item, understanding: value } : item
    )));
  };
  const patchItem = (index, value) => {
    setItems(current => current.map((item, position) => (position === index ? { ...item, value } : item)));
  };
  const dropItem = index => {
    setItems(current => current.filter((_, position) => position !== index));
  };
  const addItem = () => {
    setItems(current => [...current, customItemRow(current)]);
  };
  const pick = (key, value) => setDirection(current => ({ ...current, [key]: value }));
  const planText = plan?.plan?.promptText || '';
  const setPlanText = value => setPlan(current => (current ? { ...current, plan: { ...current.plan, promptText: value } } : current));
  /* 应用时把用户改过的解析结论并进正文（模型不知道这些修正，不并进去等于白改）。 */
  const applyPlan = () => onApply?.(appliedPlanText(planText, items, plan?.items), plan);

  return (
    <div className="plan-preview-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose?.(); }}>
      <section className="plan-preview-card" role="dialog" aria-modal="true" aria-label={copy.entry}>
        <header className="plan-preview-head">
          <strong>{stage === 'confirm' ? copy.confirmTitle : copy.entry}</strong>
          <button type="button" className="plan-preview-close" aria-label="关闭" onClick={onClose}>×</button>
        </header>

        {stage === 'confirm' && (
          <div className="plan-preview-confirm">
            <div className="plan-preview-cost">
              <div><span>预计消耗积分</span><strong>≈ 0.5 积分</strong></div>
              <div><span>当前可用积分</span><strong>{balance === null ? '—' : balance + ' 积分'}</strong></div>
            </div>
            <div className="plan-preview-detail">
              <p>计费明细</p>
              <ol>
                <li><span>1</span><b>{copy.detailName}</b><em>0.5 积分 / 次</em></li>
              </ol>
            </div>
            <p className="plan-preview-note">实际扣费以方案生成为准，失败不扣积分。素材数量不额外累加。</p>
            {error && <p className="plan-preview-error" role="alert">{error}</p>}
            <footer className="plan-preview-actions">
              <button type="button" className="plan-preview-btn" onClick={onClose}>取消</button>
              <button type="button" className="plan-preview-btn is-primary" onClick={run}>继续生成</button>
            </footer>
          </div>
        )}

        {stage === 'running' && (
          <div className="plan-preview-running" role="status">
            <span className="plan-preview-ring" aria-hidden />
            <strong>{copy.loadingTitle}</strong>
            <small>{tick % 2 === 0 ? copy.loadingHint : copy.loadingPool[tick % copy.loadingPool.length]}</small>
          </div>
        )}

        {stage === 'ready' && (
          <>
            <ol className="plan-preview-steps">
              {copy.steps.map((item, index) => (
                <li key={item.title} className={index === step ? 'is-active' : (index < step ? 'is-done' : '')}>
                  <span>{index < step ? '✓' : index + 1}</span>
                  <b>{item.title}</b>
                  <small>{item.hint}</small>
                </li>
              ))}
            </ol>

            <div className="plan-preview-body">
              {step === 0 && (
                <div className="plan-preview-materials">
                  <p className="plan-preview-body-title">{plan?.degraded ? '素材还没分析成功' : '素材理解'}</p>
                  {understanding.length === 0 && <p className="plan-preview-empty">这次没有上传素材，可以直接看方案。</p>}
                  {understanding.map((item, index) => (
                    <label className="plan-preview-material" key={item.id + '-' + index}>
                      {materials[index]?.previewUrl || materials[index]?.url
                        ? <img src={materials[index].previewUrl || materials[index].url} alt="" />
                        : <span className="plan-preview-material-blank" aria-hidden />}
                      <textarea
                        value={item.understanding}
                        placeholder={'素材 ' + (index + 1) + ' 的理解（可以改成你要的意思）'}
                        onChange={event => patchUnderstanding(index, event.target.value)}
                      />
                    </label>
                  ))}
                  {/* ═══ 2026-09-26 批 BW：**这条技能自己的解析条目** ═══════════════════════════
                      用户口径（逐字）：「用户输入他的提示词或者图片之后，你会有**解析的方案**吗？
                      **为什么我现在看起来就是一些标签而已啊**」「我要的是，**每个工作台 skill
                      有自己个性化的解析方案**啊，**不可能概念 skill 还解析什么卖点和产品特点吧**？」
                      ⇒ 一行一条（声明源出"解析什么"，模型出结论），可改、可删、可加 ——
                        加号在卡片底部（知渔那张卡的做法）。 */}
                  {items.length > 0 && (
                    <section className="plan-preview-items" aria-label="解析结果">
                      {/* ⚠️ 批 BY：卡片标题只说"这是什么"（用户口径：「不要让用户看到这种话」）——
                         原来这里写着「这条技能的解析结果（可以改、可以删、可以加）」，右上角还有一句
                         「按这条技能自己的解析方案」：前者是啰嗦的自我说明，后者是**我们内部的说法**
                         （"解析方案"是声明源里的概念，用户根本不知道它是什么），都去掉了。
                         行尾的 × 与卡片底部的「+ 添加一条」本身就是说明。 */}
                      <header className="plan-preview-items-head">
                        <p className="plan-preview-body-title">解析结果</p>
                      </header>
                      {items.map((item, index) => (
                        <div className="plan-preview-item" key={item.key}>
                          <b>{item.label}</b>
                          <textarea
                            value={item.value}
                            placeholder={item.hint || '这一项的结论（留空表示这次不解析它）'}
                            onChange={event => patchItem(index, event.target.value)}
                          />
                          <button type="button" className="plan-preview-item-drop" aria-label={'删除「' + item.label + '」这一条'} onClick={() => dropItem(index)}>×</button>
                        </div>
                      ))}
                      <button type="button" className="plan-preview-item-add" onClick={addItem}>+ 添加一条</button>
                    </section>
                  )}
                  {plan?.degraded && <p className="plan-preview-error" role="alert">{plan.reason || '分析模型暂不可用'}（失败不扣积分）</p>}
                </div>
              )}

              {step === 1 && (
                <div className="plan-preview-directions">
                  {dimensions.map(dimension => (
                    <div className="plan-preview-direction" key={dimension.key}>
                      <p className="plan-preview-body-title">{dimension.label}</p>
                      <div className="plan-preview-options">
                        {dimension.options.map(option => (
                          <button
                            key={option.value}
                            type="button"
                            className={direction[dimension.key] === option.value ? 'is-selected' : ''}
                            onClick={() => pick(dimension.key, option.value)}
                          >{option.label}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {dimensions.length === 0 && <p className="plan-preview-empty">方向选项读取中，稍后重试。</p>}
                </div>
              )}

              {step === 2 && (
                <div className="plan-preview-plan">
                  <p className="plan-preview-body-title">{plan?.plan?.title || copy.steps[2].title}</p>
                  {plan?.plan?.summary && <p className="plan-preview-summary">{plan.plan.summary}</p>}
                  {/* 正文按**章节**摆开（知渔那边也是「视频总览 / 场景与光线 / 字幕」这种分块），
                      不是一坨长文本 —— 每条技能解析出来的东西先看一眼，再读正文。 */}
                  {items.length > 0 && (
                    <section className="plan-preview-section">
                      <b>本次解析</b>
                      <ul className="plan-preview-facts">
                        {items.map(item => (
                          <li key={item.key}><span>{item.label}</span><em>{String(item.value || '').trim() || '（这次没解析出来）'}</em></li>
                        ))}
                      </ul>
                    </section>
                  )}
                  {Array.isArray(plan?.plan?.steps) && plan.plan.steps.length > 0 && (
                    <section className="plan-preview-section">
                      <b>分步</b>
                      <ol className="plan-preview-outline">
                        {plan.plan.steps.map(item => (
                          <li key={item.index}><b>{item.title}</b>{item.detail ? <span>{item.detail}</span> : null}</li>
                        ))}
                      </ol>
                    </section>
                  )}
                  <section className="plan-preview-section">
                    <b>{surface === 'video' ? '脚本正文' : '提示词正文'}</b>
                    <textarea
                      className="plan-preview-text"
                      value={planText}
                      placeholder="方案正文（可以直接改，改完再应用）"
                      onChange={event => setPlanText(event.target.value)}
                    />
                  </section>
                  {Array.isArray(plan?.plan?.notes) && plan.plan.notes.length > 0 && (
                    <section className="plan-preview-section">
                      <b>需要注意</b>
                      <ul className="plan-preview-notes">
                        {plan.plan.notes.map(note => <li key={note}>{note}</li>)}
                      </ul>
                    </section>
                  )}
                </div>
              )}
            </div>

            <footer className="plan-preview-actions">
              {/* ═══ 批 BX：**弹窗里不再放「重新生成方案」**（用户口径，逐字）═════════════════════
                  「怎么还有「重新生成方案」的按钮啊，我觉得不是只有哪些一键解析的按钮才能重新生成吗，
                   生成预览方案和生成脚本这种弹窗形式的，应该是用户可以**关掉这个弹窗**，但是
                   **再点一次这个按钮可以回到这个弹窗里面**啊。」
                  ⇒ 关掉 = 只是收起来（方案留着，再点入口按钮就回来，不重新请求也不重复扣费）；
                    真要从头再生成：**改工作台里的需求/素材，再点一次入口按钮** —— 那才是一份新方案。
                  ⚠️ 所以步① 左边的按钮文案是「关闭」而不是「取消」：这里没有"取消掉这份方案"这个动作。 */}
              <button type="button" className="plan-preview-btn" onClick={() => (step === 0 ? onClose?.() : setStep(step - 1))}>
                {step === 0 ? '关闭' : '上一步'}
              </button>
              {step < 2
                ? <button type="button" className="plan-preview-btn is-primary" onClick={() => setStep(step + 1)}>下一步</button>
                : (plan?.degraded
                  /* ═══ 2026-09-24 批 BA：**内容不合规时不许给「跳过方案，直接生成」** ═══════════════
                     用户口径：「有这种内容肯定是要**直接拒**的」。
                     降级有两种成因，界面上必须分开：
                       · 模型不可用 → 「跳过方案，直接生成」（需求本身没问题，只是方案没出来）；
                       · **内容不合规 → 不给这条路** —— 此时"直接生成"就是把刚被判违规的那段内容送出去，
                         而且"不许放点了必失败的东西"那条铁律也不许我们把按钮摆在那里。 */
                  ? (plan?.safety?.ok === false
                    ? <button type="button" className="plan-preview-btn is-primary" onClick={() => onClose?.()}>关闭</button>
                    : <button type="button" className="plan-preview-btn is-primary" onClick={() => onSkip?.()}>跳过方案，直接生成</button>)
                  : (
                    <button
                      type="button"
                      className="plan-preview-btn is-primary"
                      disabled={!String(planText || '').trim()}
                      onClick={applyPlan}
                    >{copy.apply}</button>
                  ))}
            </footer>
          </>
        )}
      </section>
    </div>
  );
}

export { PLAN_PREVIEW_SKU };
