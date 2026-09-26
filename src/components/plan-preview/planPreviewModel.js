/* ═══ 预览对话框里的**纯计算**（与 React 无关，门禁可直接跑）══════════════════════════════
   2026-09-26 批 BW：把"解析条目"这一层接进界面时，有三件事必须能单独验：
     ① 步① 的行从哪来（声明源的 label/hint + 模型给的 value）；
     ② 用户改过什么（决定"改完再点重新生成"要不要算另一份方案）；
     ③ 应用回工作台的那段正文里，要不要把用户的修正并进去。
   放在这里而不是对话框里，是因为对话框是 JSX，node 里只能读文本、不能真跑。 */

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
