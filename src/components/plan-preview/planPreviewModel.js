/* ═══ 预览对话框里的**纯计算**（与 React 无关，门禁可直接跑）══════════════════════════════
   2026-09-26 批 BW：把"解析条目"这一层接进界面时，有三件事必须能单独验：
     ① 步① 的行从哪来（声明源的 label/hint + 模型给的 value）；
     ② 用户改过什么（决定"改完再点重新生成"要不要算另一份方案）；
     ③ 应用回工作台的那段正文里，要不要把用户的修正并进去。
   放在这里而不是对话框里，是因为对话框是 JSX，node 里只能读文本、不能真跑。

   ⚠️ **方案表在前端算**（`planPreviewSpecFor`），服务端只接收消毒后的结果：
      部署包只装 `dist server shared scripts`，**不含 `src/`** —— 服务端 import `src/` 会让
      生产进程起不来（批 BW 实测踩到：健康检查 60 次 connection refused，部署脚本自动回滚）。
      而 `src/skills/parseSpecs.js` 本来就被打进了前端产物，前端算它是零成本的。 */
import { parsePlanForSkill } from '../../skills/parseSpecs.js';

/* 一条 skill id ⇒ 它自己的解析方案（步① 的行 + 步② 的档位）。
   没有 skill（首页入口）/ 这条 skill 取不到方案 ⇒ null，界面退回服务端的表面级通用档。 */
export function planPreviewSpecFor(skillId) {
  const id = typeof skillId === 'string' ? skillId.trim() : '';
  if (!id) return null;
  const plan = parsePlanForSkill(id);
  if (!plan) return null;
  return {
    source: plan.spec.source,                     // 'override' | 'family'
    key: plan.spec.key,
    /* 下发给服务端的"要解析什么"（服务端据此组织模型请求）；label/hint 都在，模型只补 value。 */
    items: plan.spec.items.map(item => ({ key: item.key, label: item.label, hint: item.hint })),
    /* 下发给服务端的档位（含继承自工作台的那些），服务端只消毒、不再自己算一遍。 */
    directions: plan.directions.map(group => ({
      key: group.key,
      label: group.label,
      options: group.options.map(option => ({
        value: option.value,
        label: option.label,
        prompt: option.prompt || '',
        pinned: option.pinned === true,
      })),
    })),
  };
}

/* 步① 的行：**声明源出 label/hint，模型出 value**。
   · 第一次进预览（模型还没答）时 value 为空 —— 行照样在，用户看得见"这条技能要解析什么"。
   · 再点「重新生成方案」时：条目行的**服务端结论覆盖**，但用户自己加的行保留（key 以 custom- 开头），
     否则用户加的东西会被下一次生成悄悄吃掉。 */
export function itemRowsOf(declaredItems, planItems, previousRows = []) {
  const declared = Array.isArray(declaredItems) ? declaredItems : [];
  const answered = new Map((Array.isArray(planItems) ? planItems : []).map(item => [String(item?.key || ''), String(item?.value || '')]));
  const rows = declared.map(item => {
    const key = String(item?.key || '');
    return {
      key,
      label: String(item?.label || key),
      hint: String(item?.hint || ''),
      value: answered.has(key) ? answered.get(key) : '',
      custom: false,
    };
  });
  const keys = new Set(rows.map(row => row.key));
  for (const row of Array.isArray(previousRows) ? previousRows : []) {
    if (!row || keys.has(String(row.key || ''))) continue;
    if (!row.custom) continue;
    rows.push({ key: String(row.key || ''), label: String(row.label || ''), hint: '', value: String(row.value || ''), custom: true });
    keys.add(String(row.key || ''));
  }
  return rows;
}

/* 用户自己加的一行（知渔那张卡底部是「+ 添加一条」） */
export function customItemRow(rows) {
  const existing = (Array.isArray(rows) ? rows : []).filter(row => row?.custom).length;
  return { key: 'custom-' + (existing + 1), label: '补充要点', hint: '你自己要额外交代的一点（会一并进提示词）', value: '', custom: true };
}

/* 用户改过的行（相对模型给的结论）：决定 ① 要不要算另一份方案、② 应用时要不要并进正文。
   ⚠️ 只算**有值**的行 —— 空行是"模型这次没给"，不是用户的修正。 */
export function correctionsOf(rows, planItems) {
  const answered = new Map((Array.isArray(planItems) ? planItems : []).map(item => [String(item?.key || ''), String(item?.value || '').trim()]));
  const out = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = String(row?.key || '');
    const value = String(row?.value || '').trim();
    if (!key || !value) continue;
    const before = answered.has(key) ? answered.get(key) : '';
    if (value === before) continue;
    out.push({ key, label: String(row?.label || key), value });
  }
  return out;
}

/* 应用回工作台的正文 = 方案正文（用户可能又改过）+ **只有他改过的那些解析结论**。
   为什么要并：步① 的修正发生在方案生成之后，模型并不知道；不并进去等于用户的纠偏白改。
   为什么只并"改过的"：全并会让每条提示词后面都拖一串重复的解析，反而稀释正文。 */
export function appliedPlanText(planText, rows, planItems) {
  const body = String(planText || '').trim();
  const corrections = correctionsOf(rows, planItems);
  if (!corrections.length) return body;
  return body + '\n\n【按你的修正】\n' + corrections.map(item => '- ' + item.label + '：' + item.value).join('\n');
}

/* 方向组的默认选中值：每组第一档（服务端按门禁③ 组织过：中性档或已声明的默认档）。 */
export function preselectedDirections(dimensions) {
  const picked = {};
  for (const dimension of Array.isArray(dimensions) ? dimensions : []) {
    const first = dimension?.options?.[0];
    if (dimension?.key && first?.value) picked[dimension.key] = first.value;
  }
  return picked;
}

/* ═══ 离开子页面时的「方案会丢」判据（批 BX）════════════════════════════════════════════════
   放在这个**纯计算**模块里（而不是那个 hook 里）是为了能单独验：hook 文件要 import
   `DialogProvider.jsx`（JSX），node 起不来；判据本身是纯函数，放这里就能真跑。
   判据用**结构**而不是按钮文案：绑"返回 / 首页 / 我的作品"这种字，改一次文案就失效
   （与"假悬停""返回对齐"那几批同一个教训）——
      · 顶栏那颗「返回」= `button.topbar-back`（子页面最主要的出口）；
      · 左侧导航那一栏 = `.app-sidebar`（里面全是导航按钮）。
   ⚠️ **没覆盖**浏览器自身的后退键：这个 SPA 的后退走 App 的 popstate，
      从 `/image-creation?id=x` 退到 `/image-creation` 时 page 没变、页面也没有 popstate 监听，
      那是一条本来就不同步的路径，要拦它得改共享路由 —— 如实留着这个缺口。 */
export function isLeavingSubpage(target) {
  if (!target || typeof target.closest !== 'function') return false;
  if (target.closest('.topbar-back')) return true;
  return Boolean(target.closest('.app-sidebar'));
}

/* 确认框文案（用户口径：「用户退出这个子页面时提示他确定退出吗，这个方案或脚本会丢失」）：
   两个选项语义明确（留下 / 仍然离开），不显示右上角 X、点遮罩也不关 —— 与画布那次离开询问同一口径。 */
export const PLAN_LEAVE_CONFIRM = Object.freeze({
  title: '这份方案还没应用',
  message: '离开这个页面，它就不会留在工作台里了（生成时扣的积分不退）。要留下就先点「确认并应用」。',
  confirmLabel: '仍然离开',
  cancelLabel: '留在这页',
  hideClose: true,
  dismissBackdrop: false,
});
/* ═══ 2026-09-26 批 BX：**关掉弹窗不丢方案** ═══════════════════════════════════════════════
   用户口径（逐字）：「怎么还有「重新生成方案」的按钮啊……生成预览方案和生成脚本这种弹窗形式的，
   应该是用户可以关掉这个弹窗，但是**再点一次这个按钮可以回到这个弹窗里面**啊。」
   ⇒ 判据是"这份方案是按**什么输入**生成的"：只算**弹窗外**的那几样（表面 / skill / 需求正文 / 素材）。
     · 一模一样 ⇒ 再把弹窗打开时，把上一份方案（含用户改过的条目与正文）原样摆回来：**不请求、不扣费**；
     · 变了（用户改了工作台里的文字/换了素材）⇒ 那本来就该是一份新方案（这也是"重新生成"唯一的入口，
       即入口按钮本身；弹窗里不再放「重新生成方案」）。
   ⚠️ 用户在里面选的档位、改过的解析条目**不算**输入签名 —— 它们本来就是"这份方案的编辑"，
      算进去会导致"自己改一下就变成另一份"，与这条口径相反。 */
export function planInputSignature(input = {}) {
  return [
    input.surface || 'image',
    String(input.skillId || ''),
    String(input.skillName || ''),
    String(input.prompt || '').trim(),
    (input.materials || []).map(item => String(item?.id || item?.name || '')).join(','),
  ].join('\u0001');
}
