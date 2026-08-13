import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Ban,
  Check,
  ChevronRight,
  CircleDollarSign,
  Coins,
  Database,
  ExternalLink,
  FileText,
  Image,
  LoaderCircle,
  Palette,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingUp,
  UserPlus,
  Users,
  Video,
  WalletCards,
  X,
} from 'lucide-react';
import { useApp } from '../../store/AppContext.jsx';
import {
  adjustAdminCredits,
  createAdminAccount,
  fetchAdminAccounts,
  fetchAdminAudit,
  fetchAdminMonitoring,
  fetchAdminSummary,
  ledgerUnitsToVisiblePoints,
  updateAdminAccount,
  updateAdminPermissions,
} from '../../services/admin.js';
import { buildUnitEconomicsRows, selectConservativeProduct } from './unitEconomicsModel.js';
import './AdminConsole.css';

const FEATURES = [
  { id: 'ecommerce_image', label: '电商生图', description: '商品套图、试穿与电商画布', icon: Image },
  { id: 'video_generation', label: '视频生成', description: '营销视频与视频画布', icon: Video },
  { id: 'content_generation', label: '小红书图文', description: '小红书图文与 Plog 套图', icon: FileText },
  { id: 'visual_creation', label: '自由创作', description: '海报与通用视觉创作', icon: Palette },
];

const ROLE_LABELS = { owner: '主管理员', admin: '管理员', tester: '内测账号', member: '正式用户' };
const STATUS_LABELS = { active: '正常', invited: '待启用', suspended: '已停用' };
const ACTION_LABELS = {
  'account.create': '创建账号',
  'account.update': '更新账号',
  'account.permissions.replace': '调整权限',
  'credits.grant': '发放额度',
  'credits.revoke': '回收额度',
};

function uid(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || Date.now()}`;
}

function money(value) {
  return `¥${Number(value || 0).toFixed(2)}`;
}

function preciseMoney(value) {
  const amount = Number(value || 0);
  const decimals = Math.abs(amount) > 0 && Math.abs(amount) < 0.01 ? 6 : 4;
  return `¥${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: decimals })}`;
}

function points(value) {
  return ledgerUnitsToVisiblePoints(value).toLocaleString('zh-CN', { maximumFractionDigits: 3 });
}

function visiblePoints(value) {
  return Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 3 });
}

function dateTime(value) {
  if (!value) return '暂无';
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleString('zh-CN', { hour12: false }) : value;
}

function Metric({ icon: Icon, label, value, detail, tone = '' }) {
  return <article className={`admin-metric ${tone}`}>
    <span className="admin-metric-icon"><Icon size={18} /></span>
    <div><small>{label}</small><strong>{value}</strong><span>{detail}</span></div>
  </article>;
}

function EmptyState({ title, detail }) {
  return <div className="admin-empty"><Activity size={22} /><strong>{title}</strong><span>{detail}</span></div>;
}

const JOB_STATUS_LABELS = {
  queued: '排队中', pending: '待处理', analyzing: '分析中', generating: '生成中',
  submitting: '提交中', processing: '处理中', completed: '已完成', done: '已完成',
  needs_review: '待复核', failed: '失败', cancelled: '已取消',
};

const SERVICE_LABELS = {
  ecommerce_image: '电商生图', video_generation: '视频生成', content_generation: '小红书图文',
};

const SKU_LABELS = {
  ec_image_2k: '电商生图 · 2K',
  ec_image_4k: '电商生图 · 4K',
  ec_nano_flash_1k: 'Nano Banana 2 Flash · 1K',
  ec_nano_flash_2k: 'Nano Banana 2 Flash · 2K',
  ec_nano_flash_4k: 'Nano Banana 2 Flash · 4K',
  ec_nano_pro_1k: 'Nano Banana Pro · 1K',
  ec_nano_pro_2k: 'Nano Banana Pro · 2K',
  ec_nano_pro_4k: 'Nano Banana Pro · 4K',
  xhs_image_set_2k: '小红书图文 · 2K 套图',
  video_seedance_fast_short: 'Seedance 2.0 Fast · 短片',
  video_seedance_fast_long: 'Seedance 2.0 Fast · 长片',
  video_seedance_standard_short: 'Seedance 2.0 Standard · 短片',
  video_seedance_standard_long: 'Seedance 2.0 Standard · 长片',
  video_minimax_h3_2k_short: 'MiniMax H3 2K · 短片',
  video_minimax_h3_2k_long: 'MiniMax H3 2K · 长片',
  video_plan_analysis: '视频生成前方案分析',
  ec_reverse_prompt: '电商 · 反推素材',
  ec_ai_assistant: 'AI 助手 · 识别与文案',
  ec_extension_analysis: '扩展 · 竞品分析套装',
  ec_extension_basic: '扩展 · 基础复刻套装',
  ec_extension_standard: '扩展 · 标准复刻套装',
  ec_extension_complete: '扩展 · 完整复刻套装',
  ec_canvas_ocr: 'Canvas · 图片文字识别',
  ec_remove_bg: '电商 · 抠图',
  ec_direction_refresh: '电商 · 方向刷新',
  ec_smart_layer: '电商 · 智能图层',
  ec_layer_psd: '电商 · PSD 图层',
};

const PRODUCT_LABELS = {
  ec_trial_990: '体验包 · ¥9.90 / 30 积分', ec_starter_29: '入门包 · ¥29 / 105 积分',
  ec_growth_79: '进阶包 · ¥79 / 295 积分', ec_studio_199: '工作室包 · ¥199 / 760 积分',
};
const ECONOMICS_FEATURES = [
  'ec_image_2k', 'ec_image_4k', 'ec_nano_flash_1k', 'ec_nano_flash_2k', 'ec_nano_flash_4k',
  'ec_nano_pro_1k', 'ec_nano_pro_2k', 'ec_nano_pro_4k', 'video_seedance_fast_short',
  'video_seedance_fast_long', 'video_seedance_standard_short', 'video_seedance_standard_long',
];

function jobStatusLabel(status) {
  return JOB_STATUS_LABELS[status] || status || '未知';
}

function skuLabel(sku) {
  return SKU_LABELS[sku] || sku || '未命名动作';
}

function queueValue(queue, key) {
  return Number(queue?.[key] || 0).toLocaleString('zh-CN');
}

function MonitoringPanel({ monitoring }) {
  const runtime = monitoring?.runtime || {};
  const jobs = monitoring?.jobs?.totals || {};
  const routes = monitoring?.providerRoutes || [];
  const tasks = monitoring?.recentTasks || [];
  const failures = monitoring?.recentFailures || [];
  const videoQueue = runtime.video || {};
  return <section className="admin-monitoring-band" aria-labelledby="admin-monitoring-title">
    <div className="admin-band-heading"><div><span>运行监控</span><h2 id="admin-monitoring-title">生成服务实时状态</h2></div><small>{monitoring?.generatedAt ? `更新于 ${dateTime(monitoring.generatedAt)}` : '暂无运行数据'}</small></div>
    <div className="admin-runtime-grid">
      <article><span className="admin-runtime-icon image"><Image size={16} /></span><div><small>图片队列</small><strong>{queueValue(runtime.imageQueue, 'active')} 处理中</strong><span>{queueValue(runtime.imageQueue, 'queued')} 个排队 · 并发 {queueValue(runtime.imageQueue, 'concurrency')}</span></div></article>
      <article><span className="admin-runtime-icon ecommerce"><Activity size={16} /></span><div><small>电商任务</small><strong>{queueValue(runtime.ecommerce, 'activeJobs')} 个运行中</strong><span>{queueValue(jobs.active, 'active')} 个全局活跃任务</span></div></article>
      <article><span className="admin-runtime-icon video"><Video size={16} /></span><div><small>视频队列</small><strong>{queueValue(videoQueue, 'running')} 处理中</strong><span>{queueValue(videoQueue, 'queued')} 个排队 · {queueValue(routes, 'length')} 条路由</span></div></article>
      <article><span className="admin-runtime-icon failure"><Ban size={16} /></span><div><small>终态失败率</small><strong>{((Number(jobs.failureRate || 0)) * 100).toFixed(1)}%</strong><span>{Number(jobs.failed || 0).toLocaleString('zh-CN')} 个失败 / {Number(jobs.completed || 0).toLocaleString('zh-CN')} 个完成</span></div></article>
    </div>
    <div className="admin-monitoring-grid">
      <div className="admin-monitoring-section"><div className="admin-band-heading compact"><div><span>供应商与路由</span><h3>视频模型通道</h3></div></div>{routes.length ? <div className="admin-route-list">{routes.map(route => <article key={`${route.routeId}:${route.productId}`}><div><strong>{route.label || route.productId || route.routeId}</strong><small>{route.routeId}</small></div><span className={`admin-route-status ${route.availability || (route.configured ? 'ready' : 'unavailable')}`}>{route.availability || (route.configured ? 'ready' : 'unavailable')}</span><dl><div><dt>处理中</dt><dd>{route.queue?.running ?? route.active ?? 0}</dd></div><div><dt>排队</dt><dd>{route.queue?.queued ?? 0}</dd></div><div><dt>失败率</dt><dd>{((Number(route.failureRate || 0)) * 100).toFixed(1)}%</dd></div></dl></article>)}</div> : <EmptyState title="暂无视频路由" detail="配置上游凭据后会显示真实通道状态" />}</div>
      <div className="admin-monitoring-section"><div className="admin-band-heading compact"><div><span>失败诊断</span><h3>高频失败原因</h3></div></div>{failures.length ? <div className="admin-failure-list">{failures.map(item => <article key={`${item.service}:${item.failureClass}:${item.message}`}><span>{item.count}</span><div><strong>{SERVICE_LABELS[item.service] || item.service}</strong><small>{item.message}</small></div></article>)}</div> : <EmptyState title="暂无失败记录" detail="出现失败任务后会在这里聚合原因" />}</div>
    </div>
    <div className="admin-monitoring-section admin-recent-tasks"><div className="admin-band-heading compact"><div><span>任务追踪</span><h3>最近任务</h3></div><small>{tasks.length} 条</small></div>{tasks.length ? <div className="admin-task-list">{tasks.slice(0, 10).map(task => <article key={`${task.service}:${task.id}`} className={task.error ? 'has-error' : ''}><span className={`admin-task-dot ${task.status}`} /><div><strong>{SERVICE_LABELS[task.service] || task.service}</strong><small>{task.id} · {task.ownerEmail}</small>{task.error && <p><b>{task.failureClass || '失败原因'}</b>{task.error}</p>}</div><span className={`admin-task-status ${task.status}`}>{jobStatusLabel(task.status)}</span><time>{dateTime(task.updatedAt)}</time></article>)}</div> : <EmptyState title="暂无任务记录" detail="用户提交生成任务后会显示在这里" />}</div>
  </section>;
}

function routePrice(route) {
  if (route.unitPriceText) return route.unitPriceText;
  return `${preciseMoney(route.unitPriceCny)} / ${route.billingUnit || '次'}`;
}

function routeStateLabel(status) {
  return { connected: '生产接入', configured: '已配置', candidate: '候选报价' }[status] || status;
}

function RouteTable({ routes, compact = false }) {
  return <div className="admin-upstream-table-wrap"><table className="admin-upstream-table">
    <thead><tr><th>来源 / 模型</th><th>用途</th><th>上游单价</th><th>站内扣分</th>{!compact && <th>已结算</th>}<th>依据与状态</th></tr></thead>
    <tbody>{routes.map(route => <tr key={route.id}>
      <td><strong>{route.model}</strong><small>{route.providerLabel}</small></td>
      <td>{route.purpose}<small>{route.billingUnit}</small></td>
      <td><strong>{routePrice(route)}</strong></td>
      <td>{route.appActions?.length ? <div className="admin-action-price-list">{route.appActions.map(action => <span key={action.sku}><b>{skuLabel(action.sku)}</b>{visiblePoints(action.points)} 积分 · 结算成本 {preciseMoney(action.providerCostCny)}</span>)}</div> : <span className="admin-muted">未接入，不扣分</span>}</td>
      {!compact && <td><strong>{Number(route.localSettledActions || 0).toLocaleString('zh-CN')} 次</strong><small>{preciseMoney(route.localSettledCostCny)}</small></td>}
      <td><span className={`admin-ledger-state ${route.status}`}>{routeStateLabel(route.status)}</span><small>{route.health || route.notes}</small></td>
    </tr>)}</tbody>
  </table></div>;
}

function UpstreamLedgerPanel({ ledger }) {
  if (!ledger) return null;
  const activeRoutes = ledger.routes?.filter(route => route.status !== 'candidate') || [];
  const candidateRoutes = ledger.routes?.filter(route => route.status === 'candidate') || [];
  return <section className="admin-upstream-band" aria-labelledby="admin-upstream-title">
    <div className="admin-band-heading"><div><span>上游成本账本</span><h2 id="admin-upstream-title">API 单价、扣费与站内结算</h2></div><small>人工核验于 {dateTime(ledger.verifiedAt)}</small></div>
    <div className="admin-ledger-policy"><Database size={18} /><div><strong>{ledger.currencyPolicy}</strong><span>{ledger.scopeNote}</span></div><dl><div><dt>上游累计扣费</dt><dd>{preciseMoney(ledger.providerReportedSpendCny)}</dd></div><div><dt>本应用结算成本</dt><dd>{preciseMoney(ledger.localSettledCostCny)}</dd></div></dl></div>
    <div className="admin-provider-grid">{ledger.providers?.map(provider => <article key={provider.id}>
      <header><div><span className={`admin-provider-dot ${provider.monitoring?.tone}`} /><strong>{provider.label}</strong></div><a href={provider.dashboardUrl} target="_blank" rel="noreferrer" aria-label={`打开 ${provider.label} 后台`}><ExternalLink size={15} /></a></header>
      <div className="admin-provider-money"><div><small>账户余额</small><strong>{preciseMoney(provider.balanceCny)}</strong></div><div><small>今日扣费</small><strong>{preciseMoney(provider.todaySpendCny)}</strong></div><div><small>累计扣费</small><strong>{preciseMoney(provider.reportedSpendCny)}</strong></div><div><small>上游请求</small><strong>{Number(provider.reportedRequests || 0).toLocaleString('zh-CN')}</strong></div></div>
      <dl className="admin-reconciliation"><div><dt>本应用可归因</dt><dd>{preciseMoney(provider.localAttributedCostCny)}</dd></div><div><dt>口径差额</dt><dd>{preciseMoney(provider.referenceDifferenceCny)}</dd></div></dl>
      <p>{provider.accountEvidence}</p>
      <footer><span className={`admin-provider-health ${provider.monitoring?.tone}`}>{provider.monitoring?.label}</span><small>{provider.monitoring?.detail}</small></footer>
    </article>)}</div>
    <div className="admin-upstream-routes"><div className="admin-band-heading compact"><div><span>正在使用</span><h3>生产路由与站内价格</h3></div><small>{activeRoutes.length} 条接入或已配置路由</small></div><RouteTable routes={activeRoutes} /></div>
    {!!candidateRoutes.length && <details className="admin-candidate-routes"><summary><span><strong>查看候选模型报价</strong><small>仅用于选型，不代表已经接入或可自动切换</small></span><ChevronRight size={17} /></summary><RouteTable routes={candidateRoutes} compact /></details>}
  </section>;
}

function UnitEconomicsPanel({ catalog }) {
  const conservative = selectConservativeProduct(catalog?.products);
  const [basisSku, setBasisSku] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [revenueMode, setRevenueMode] = useState('paid');
  const selectedBasis = basisSku || conservative?.sku || '';
  const rows = useMemo(() => buildUnitEconomicsRows({ catalog, basisSku: selectedBasis, quantity, revenueMode, featureSkus: ECONOMICS_FEATURES }), [catalog, selectedBasis, quantity, revenueMode]);
  if (!catalog || !rows.length) return null;
  return <section className="admin-unit-economics" aria-labelledby="admin-unit-economics-title">
    <div className="admin-band-heading"><div><span>单次生成怎么算</span><h2 id="admin-unit-economics-title">图片与视频利润明细</h2></div><small>估算表与下方历史真实结算分开统计</small></div>
    <div className="admin-economics-controls">
      <label><span>收入基准套餐</span><select value={selectedBasis} onChange={event => setBasisSku(event.target.value)}>{catalog.products.map(product => <option value={product.sku} key={product.sku}>{PRODUCT_LABELS[product.sku] || product.sku}{product.sku === conservative?.sku ? ' · 保守基准' : ''}</option>)}</select></label>
      <label><span>连续生成数量</span><input type="number" min="1" max="100" value={quantity} onChange={event => setQuantity(Math.max(1, Math.min(100, Number(event.target.value) || 1)))} /></label>
      <div className="admin-economics-mode" role="group" aria-label="收入类型"><button type="button" className={revenueMode === 'paid' ? 'active' : ''} onClick={() => setRevenueMode('paid')}>付费积分</button><button type="button" className={revenueMode === 'gift' ? 'active' : ''} onClick={() => setRevenueMode('gift')}>赠送积分</button></div>
      <p>{revenueMode === 'gift' ? '赠送积分不计现金营收，表中利润即本次运营补贴。' : `每积分现金收入 ${preciseMoney(rows[0]?.pointRevenueCny)}，支付通道费按 ${(Number(catalog.paymentFeeRate || 0) * 100).toFixed(0)}% 估算。`}</p>
    </div>
    <div className="admin-economics-table-wrap"><table className="admin-economics-table"><thead><tr><th>生成动作</th><th>积分</th><th>预计营收</th><th>上游成本</th><th>支付通道费</th><th>预计利润</th><th>利润率</th></tr></thead><tbody>{rows.map(row => <tr key={row.sku}><td><strong>{skuLabel(row.sku)}</strong><small>{row.quantity} 次生成合计</small></td><td>{visiblePoints(row.points)}</td><td>{preciseMoney(row.revenueCny)}</td><td>{preciseMoney(row.providerCostCny)}</td><td>{preciseMoney(row.paymentFeeCny)}</td><td className={row.profitCny >= 0 ? 'is-profit' : 'is-subsidy'}><strong>{preciseMoney(row.profitCny)}</strong></td><td>{row.margin === null ? '补贴' : `${(row.margin * 100).toFixed(1)}%`}</td></tr>)}</tbody></table></div>
  </section>;
}

function AccountEditor({ account, actorEmail, onClose, onChanged }) {
  const [draft, setDraft] = useState(() => ({
    role: account.role,
    status: account.status,
    notes: account.notes || '',
    expiresAt: account.expiresAt ? account.expiresAt.slice(0, 10) : '',
    permissions: [...account.permissions],
  }));
  const [credit, setCredit] = useState({ operation: 'grant', currency: 'ec_points', amount: '', reason: '' });
  const [saving, setSaving] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const selfOwner = account.email === actorEmail && account.role === 'owner';

  const mutate = async (kind, work) => {
    setSaving(kind);
    setMessage({ type: '', text: '' });
    try {
      const result = await work();
      const next = result.account || result.adjustment || result;
      setMessage({ type: 'success', text: kind === 'credits' ? '额度已写入真实账本' : '账号配置已保存' });
      await onChanged(next);
    } catch (error) {
      setMessage({ type: 'error', text: error.message || '操作失败' });
    } finally {
      setSaving('');
    }
  };

  const saveProfile = () => mutate('profile', () => updateAdminAccount(account.email, {
    role: draft.role,
    status: draft.status,
    notes: draft.notes,
    expiresAt: draft.expiresAt || null,
    reason: '管理后台更新账号配置',
    idempotencyKey: uid('account-update'),
  }));

  const savePermissions = () => mutate('permissions', () => updateAdminPermissions(account.email, {
    permissions: draft.permissions,
    reason: '管理后台调整板块权限',
    idempotencyKey: uid('permissions-update'),
  }));

  const submitCredits = event => {
    event.preventDefault();
    if (!credit.amount || !credit.reason.trim()) {
      setMessage({ type: 'error', text: '请填写额度和调整原因' });
      return;
    }
    mutate('credits', () => adjustAdminCredits(account.email, {
      ...credit,
      idempotencyKey: uid(`credits-${credit.operation}`),
    })).then(() => setCredit(current => ({ ...current, amount: '', reason: '' })));
  };

  const togglePermission = feature => {
    setDraft(current => ({
      ...current,
      permissions: current.permissions.includes(feature)
        ? current.permissions.filter(item => item !== feature)
        : [...current.permissions, feature],
    }));
  };

  return <aside className="admin-drawer" aria-label={`${account.email} 账号设置`}>
    <header className="admin-drawer-header">
      <div><span className="admin-avatar">{account.email.slice(0, 1).toUpperCase()}</span><div><strong>{account.email}</strong><small>{ROLE_LABELS[account.role]} · {STATUS_LABELS[account.status]}</small></div></div>
      <button type="button" className="admin-icon-button" aria-label="关闭账号设置" onClick={onClose}><X size={18} /></button>
    </header>

    <div className="admin-drawer-scroll">
      {message.text && <div className={`admin-inline-message ${message.type}`}>{message.type === 'success' ? <Check size={15} /> : <Ban size={15} />}{message.text}</div>}

      <section className="admin-editor-section">
        <div className="admin-section-heading"><div><strong>账号状态</strong><span>控制登录身份、有效期和备注</span></div></div>
        <div className="admin-field-grid">
          <label><span>账号角色</span><select value={draft.role} disabled={selfOwner} onChange={event => setDraft({ ...draft, role: event.target.value })}><option value="tester">内测账号</option><option value="member">正式用户</option><option value="admin">管理员</option>{account.role === 'owner' && <option value="owner">主管理员</option>}</select></label>
          <label><span>使用状态</span><select value={draft.status} disabled={selfOwner} onChange={event => setDraft({ ...draft, status: event.target.value })}><option value="active">正常</option><option value="invited">待启用</option><option value="suspended">停用</option></select></label>
          <label><span>到期日期</span><input type="date" value={draft.expiresAt} onChange={event => setDraft({ ...draft, expiresAt: event.target.value })} /></label>
          <label className="wide"><span>内部备注</span><input value={draft.notes} maxLength={500} placeholder="例如：第一轮电商内测" onChange={event => setDraft({ ...draft, notes: event.target.value })} /></label>
        </div>
        {selfOwner && <p className="admin-field-note">主管理员不能停用或降级自己的账号，防止管理后台被锁死。</p>}
        <button type="button" className="admin-secondary-button" disabled={Boolean(saving)} onClick={saveProfile}>{saving === 'profile' ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />}保存账号状态</button>
      </section>

      <section className="admin-editor-section">
        <div className="admin-section-heading"><div><strong>板块权限</strong><span>可以任意组合四个创作板块</span></div><small>{draft.permissions.length}/4</small></div>
        <div className="admin-permission-list">
          {FEATURES.map(feature => {
            const Icon = feature.icon;
            const enabled = draft.permissions.includes(feature.id);
            return <button type="button" key={feature.id} className={enabled ? 'is-enabled' : ''} onClick={() => togglePermission(feature.id)}><span><Icon size={17} /></span><div><strong>{feature.label}</strong><small>{feature.description}</small></div><i>{enabled && <Check size={13} />}</i></button>;
          })}
        </div>
        <button type="button" className="admin-secondary-button" disabled={Boolean(saving)} onClick={savePermissions}>{saving === 'permissions' ? <LoaderCircle className="spin" size={15} /> : <ShieldCheck size={15} />}保存板块权限</button>
      </section>

      <section className="admin-editor-section">
        <div className="admin-section-heading"><div><strong>额度账本</strong><span>每次调整都会留下不可变审计记录</span></div></div>
        <div className="admin-balance-row"><div><small>AI 积分</small><strong>{points(account.balances.ec_points.availableUnits)}</strong><span>冻结 {points(account.balances.ec_points.heldUnits)}</span></div><div><small>内容套数</small><strong>{account.balances.content_sets.availableUnits}</strong><span>冻结 {account.balances.content_sets.heldUnits}</span></div></div>
        <form className="admin-credit-form" onSubmit={submitCredits}>
          <div className="admin-segmented"><button type="button" className={credit.operation === 'grant' ? 'active' : ''} onClick={() => setCredit({ ...credit, operation: 'grant' })}><Plus size={14} />发放积分</button><button type="button" className={credit.operation === 'revoke' ? 'active danger' : ''} onClick={() => setCredit({ ...credit, operation: 'revoke' })}><Ban size={14} />回收积分</button></div>
          <div className="admin-field-grid">
            <label><span>额度类型</span><select value={credit.currency} onChange={event => setCredit({ ...credit, currency: event.target.value })}><option value="ec_points">AI 积分</option><option value="content_sets">内容套数</option></select></label>
            <label><span>{credit.currency === 'ec_points' ? '积分数量' : '套数'}</span><input type="number" min="0.001" step={credit.currency === 'ec_points' ? '0.001' : '1'} value={credit.amount} placeholder="例如 100" onChange={event => setCredit({ ...credit, amount: event.target.value })} /></label>
            <label className="wide"><span>调整原因</span><input value={credit.reason} maxLength={500} placeholder="例如：发放第二轮内测额度" onChange={event => setCredit({ ...credit, reason: event.target.value })} /></label>
          </div>
          <button type="submit" className={`admin-primary-button ${credit.operation === 'revoke' ? 'danger' : ''}`} disabled={Boolean(saving)}>{saving === 'credits' ? <LoaderCircle className="spin" size={15} /> : <Coins size={15} />}{credit.operation === 'grant' ? '确认发放' : '确认回收'}</button>
        </form>
      </section>

      <section className="admin-editor-section admin-usage-section">
        <div className="admin-section-heading"><div><strong>真实使用结果</strong><span>按已经结算的 AI 操作聚合</span></div></div>
        <dl><div><dt>累计消耗</dt><dd>{points(account.usage.pointsConsumed)} 积分</dd></div><div><dt>应用成本</dt><dd>{money(account.usage.providerCostCny)}</dd></div><div><dt>理论收入</dt><dd>{money(account.usage.theoreticalRevenueCny)}</dd></div><div><dt>理论贡献</dt><dd>{money(account.usage.theoreticalContributionCny)}</dd></div><div><dt>已结算操作</dt><dd>{account.usage.actionCount}</dd></div><div><dt>最近活动</dt><dd>{dateTime(account.usage.lastActivityAt)}</dd></div></dl>
      </section>
    </div>
  </aside>;
}

function CreateAccountDialog({ onClose, onCreated }) {
  const [form, setForm] = useState({ email: '', role: 'tester', notes: '', permissions: FEATURES.map(item => item.id), points: '100', reason: '邀请内测并发放初始额度' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result = await createAdminAccount({
        email: form.email,
        role: form.role,
        status: 'active',
        notes: form.notes,
        permissions: form.permissions,
        reason: form.reason,
        idempotencyKey: uid('account-create'),
      });
      if (Number(form.points) > 0) {
        await adjustAdminCredits(result.account.email, {
          operation: 'grant', currency: 'ec_points', amount: form.points,
          reason: form.reason, idempotencyKey: uid('initial-credit'),
        });
      }
      await onCreated(result.account.email);
    } catch (nextError) {
      setError(nextError.message || '账号创建失败');
    } finally {
      setSaving(false);
    }
  };

  const toggle = id => setForm(current => ({ ...current, permissions: current.permissions.includes(id) ? current.permissions.filter(item => item !== id) : [...current.permissions, id] }));

  return <div className="admin-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><form className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="create-account-title" onSubmit={submit}>
    <header><div><span><UserPlus size={17} /></span><div><h2 id="create-account-title">新增测试账号</h2><p>一次完成账号、板块权限和初始积分配置</p></div></div><button type="button" className="admin-icon-button" aria-label="关闭" onClick={onClose}><X size={18} /></button></header>
    <div className="admin-dialog-body">
      {error && <div className="admin-inline-message error"><Ban size={15} />{error}</div>}
      <div className="admin-field-grid">
        <label className="wide"><span>登录邮箱</span><input required type="email" value={form.email} placeholder="tester@example.com" onChange={event => setForm({ ...form, email: event.target.value })} /></label>
        <label><span>账号角色</span><select value={form.role} onChange={event => setForm({ ...form, role: event.target.value })}><option value="tester">内测账号</option><option value="member">正式用户</option><option value="admin">管理员</option></select></label>
        <label><span>初始 AI 积分</span><input required type="number" min="0" step="0.001" value={form.points} onChange={event => setForm({ ...form, points: event.target.value })} /></label>
        <label className="wide"><span>内部备注</span><input value={form.notes} placeholder="例如：视频方向内测" onChange={event => setForm({ ...form, notes: event.target.value })} /></label>
      </div>
      <fieldset><legend>开放板块</legend><div className="admin-dialog-permissions">{FEATURES.map(feature => <label key={feature.id}><input type="checkbox" checked={form.permissions.includes(feature.id)} onChange={() => toggle(feature.id)} /><span>{feature.label}</span></label>)}</div></fieldset>
      <label className="admin-reason-field"><span>操作原因</span><input required value={form.reason} onChange={event => setForm({ ...form, reason: event.target.value })} /></label>
    </div>
    <footer><button type="button" className="admin-secondary-button" onClick={onClose}>取消</button><button type="submit" className="admin-primary-button" disabled={saving}>{saving ? <LoaderCircle className="spin" size={15} /> : <UserPlus size={15} />}创建并发放</button></footer>
  </form></div>;
}

export default function AdminConsolePage() {
  const { state, dispatch } = useApp();
  const [summary, setSummary] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [audit, setAudit] = useState([]);
  const [monitoring, setMonitoring] = useState(null);
  const [query, setQuery] = useState('');
  const [selectedEmail, setSelectedEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const isAdmin = state.accountAccess?.role === 'owner';

  const load = useCallback(async ({ quiet = false } = {}) => {
    quiet ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const [nextSummary, nextAccounts, nextAudit, nextMonitoring] = await Promise.all([
        fetchAdminSummary(),
        fetchAdminAccounts({ limit: 100 }),
        fetchAdminAudit({ limit: 30 }),
        fetchAdminMonitoring({ limit: 30 }),
      ]);
      setSummary(nextSummary);
      setAccounts(nextAccounts.accounts || []);
      setAudit(nextAudit.entries || []);
      setMonitoring(nextMonitoring);
    } catch (nextError) {
      setError(nextError.message || '管理后台加载失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { if (isAdmin) void load(); }, [isAdmin, load]);

  useEffect(() => {
    if (!isAdmin) return undefined;
    const timer = setInterval(() => { void load({ quiet: true }); }, 30_000);
    return () => clearInterval(timer);
  }, [isAdmin, load]);

  const filteredAccounts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return accounts;
    return accounts.filter(account => account.email.includes(needle) || account.notes?.toLowerCase().includes(needle));
  }, [accounts, query]);
  const selectedAccount = accounts.find(account => account.email === selectedEmail) || null;
  const metrics = summary?.metrics || {};

  const reloadAndKeep = async email => {
    await load({ quiet: true });
    if (email?.email) setSelectedEmail(email.email);
  };

  if (!isAdmin) return <main className="admin-denied"><ShieldCheck size={30} /><h1>管理后台</h1><p>当前账号没有管理权限。</p><button type="button" onClick={() => dispatch({ type: 'NAVIGATE', page: 'home' })}>返回创作台</button></main>;

  return <main className="admin-console">
    <header className="admin-console-header">
      <div><span className="admin-console-kicker"><ShieldCheck size={15} />薯包运营中心</span><h1>管理后台</h1><p>账号、权限、积分、成本和利润使用同一套真实账本。</p></div>
      <div className="admin-header-actions"><button type="button" className="admin-secondary-button" disabled={refreshing} onClick={() => load({ quiet: true })}><RefreshCw className={refreshing ? 'spin' : ''} size={15} />刷新数据</button><button type="button" className="admin-primary-button" onClick={() => setShowCreate(true)}><UserPlus size={15} />新增账号</button></div>
    </header>

    {error && <div className="admin-page-error"><Ban size={17} /><span>{error}</span><button type="button" onClick={() => load()}>重试</button></div>}
    {loading ? <div className="admin-loading"><LoaderCircle className="spin" size={24} /><span>正在读取真实账本...</span></div> : <>
      <section className="admin-overview" aria-labelledby="admin-overview-title">
        <div className="admin-band-heading"><div><span>运营总览</span><h2 id="admin-overview-title">当前内测经营结果</h2></div><small>仅统计已经结算的 AI 操作</small></div>
        <div className="admin-metrics">
          <Metric icon={Users} label="已配置账号" value={metrics.accountsTotal || 0} detail={`${metrics.accountsActive || 0} 个正常使用`} />
          <Metric icon={WalletCards} label="累计消耗" value={`${points(metrics.pointsConsumed)} 积分`} detail={`${metrics.settledActions || 0} 次已结算操作`} />
          <Metric icon={CircleDollarSign} label="应用结算成本" value={money(metrics.providerCostCny)} detail="按 AI 动作结算时的成本快照" tone="cost" />
          <Metric icon={TrendingUp} label="理论贡献" value={money(metrics.theoreticalContributionCny)} detail={metrics.theoreticalMargin === null || metrics.theoreticalMargin === undefined ? '暂无收入数据' : `理论毛利率 ${(metrics.theoreticalMargin * 100).toFixed(1)}%`} tone="profit" />
        </div>
        <div className="admin-finance-strip" aria-label="成本与利润">
          <div><small>理论收入</small><strong>{money(metrics.theoreticalRevenueCny)}</strong><span>按积分面值核算</span></div>
          <div><small>现金收入</small><strong>{money(metrics.cashRevenueCny)}</strong><span>仅计算真实购买归因</span></div>
          <div><small>内测补贴</small><strong>{money(metrics.promoSubsidyCny)}</strong><span>赠送积分形成的成本补贴</span></div>
          <div><small>失败/退回</small><strong>{metrics.failedOrReleasedActions || 0}</strong><span>失败率 {((metrics.failureRate || 0) * 100).toFixed(1)}%</span></div>
        </div>
      </section>

      <UnitEconomicsPanel catalog={summary?.unitEconomicsCatalog} />

      <UpstreamLedgerPanel ledger={summary?.upstreamLedger} />

      <MonitoringPanel monitoring={monitoring} />

      <section className="admin-accounts-band" aria-labelledby="admin-accounts-title">
        <div className="admin-band-heading"><div><span>账号与权限</span><h2 id="admin-accounts-title">内测账号</h2></div><label className="admin-search"><Search size={15} /><input value={query} placeholder="搜索邮箱或备注" onChange={event => setQuery(event.target.value)} /></label></div>
        <div className="admin-table-wrap"><table className="admin-account-table"><thead><tr><th>账号</th><th>角色</th><th>权限</th><th>AI 积分</th><th>应用成本</th><th>状态</th><th aria-label="操作" /></tr></thead><tbody>{filteredAccounts.map(account => <tr key={account.email} className={selectedEmail === account.email ? 'is-selected' : ''} onClick={() => setSelectedEmail(account.email)}><td><strong>{account.email}</strong><small>{account.notes || '未填写备注'}</small></td><td>{ROLE_LABELS[account.role]}</td><td><div className="admin-feature-dots" aria-label={`${account.permissions.length} 个权限`}>{FEATURES.map(feature => <i key={feature.id} className={account.permissions.includes(feature.id) ? 'on' : ''} title={feature.label} />)}</div></td><td>{points(account.balances.ec_points.availableUnits)}</td><td>{money(account.usage.providerCostCny)}</td><td><span className={`admin-status ${account.status}`}>{STATUS_LABELS[account.status]}</span></td><td><button type="button" className="admin-row-open" aria-label={`管理 ${account.email}`}><ChevronRight size={17} /></button></td></tr>)}</tbody></table>{!filteredAccounts.length && <EmptyState title="没有匹配账号" detail="调整搜索条件或新增内测账号" />}</div>
      </section>

      <section className="admin-insights-grid">
        <div className="admin-insight-section"><div className="admin-band-heading compact"><div><span>成本与利润</span><h2>按板块核算</h2></div></div>{summary?.byFeature?.length ? <div className="admin-breakdown-list">{summary.byFeature.map(item => <div key={item.feature}><span>{FEATURES.find(feature => feature.id === item.feature)?.label || item.feature}</span><strong>{money(item.provider_cost_cny)}</strong><small>{points(item.points_consumed)} 积分 · {item.actions} 次 · 贡献 {money(item.theoretical_contribution_cny)}</small></div>)}</div> : <EmptyState title="暂无结算成本" detail="用户完成 AI 生成后会自动记录" />}</div>
        <div className="admin-insight-section"><div className="admin-band-heading compact"><div><span>操作审计</span><h2>最近管理动作</h2></div></div>{audit.length ? <div className="admin-audit-list">{audit.slice(0, 8).map(entry => <article key={entry.id}><i /><div><strong>{ACTION_LABELS[entry.action] || entry.action}</strong><span>{entry.targetEmail}</span><small>{entry.reason} · {dateTime(entry.createdAt)}</small></div></article>)}</div> : <EmptyState title="暂无审计记录" detail="账号和积分调整都会记录在这里" />}</div>
      </section>

      <section className="admin-sku-band" aria-labelledby="admin-sku-title">
        <div className="admin-band-heading"><div><span>精细核算</span><h2 id="admin-sku-title">按模型与动作</h2></div><small>应用成本取动作结算快照，收入取积分面值</small></div>
        {summary?.bySku?.length ? <div className="admin-sku-table-wrap"><table className="admin-sku-table"><thead><tr><th>动作 / 模型</th><th>板块</th><th>次数</th><th>消耗</th><th>应用成本</th><th>理论收入</th><th>贡献 / 毛利率</th></tr></thead><tbody>{summary.bySku.map(item => <tr key={`${item.sku}:${item.provider}:${item.model}`}><td><strong>{skuLabel(item.sku)}</strong><small>{item.model || item.sku} · {item.provider}</small></td><td>{SERVICE_LABELS[item.feature] || item.feature}</td><td>{item.actions}</td><td>{points(item.points_consumed)} 积分</td><td>{money(item.provider_cost_cny)}</td><td>{money(item.theoretical_revenue)}</td><td><strong>{money(item.theoretical_contribution_cny)}</strong><small>{item.theoretical_margin === null ? '暂无收入' : `${(item.theoretical_margin * 100).toFixed(1)}%`}</small></td></tr>)}</tbody></table></div> : <EmptyState title="暂无模型动作记录" detail="完成一次真实 AI 操作后，这里会显示具体 SKU、模型、成本与利润" />}
      </section>
    </>}

    {selectedAccount && <AccountEditor account={selectedAccount} actorEmail={state.accountAccess.email} onClose={() => setSelectedEmail('')} onChanged={reloadAndKeep} />}
    {showCreate && <CreateAccountDialog onClose={() => setShowCreate(false)} onCreated={async email => { setShowCreate(false); await load({ quiet: true }); setSelectedEmail(email); }} />}
  </main>;
}
