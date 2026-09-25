/* ══════════════════════════════════════════════════════════════════════════════════════════
   批 BM（2026-09-25）：把服务端的**平铺模型清单**折成「家族 → 型号 → 清晰度档位」三层。

   用户原话（逐字）：「你这个模型选择……**为什么 seedance 不放到一起呢？mini max 你也没有放到
   一起**。然后现在视频生成这里的模型……**为什么会有 720P 的特定模型呢？720P 应该在生成设置里面
   去选的呀**，用户在这里就只负责选相应的模型就可以了，然后参数是在生成设置里面去做的呀。」

   服务端为什么还是"一条产品一条价档"：计费 SKU 由产品 id 派生（video_${id}_${short|long}），
   720P 与 1080P 的上游成本不同 ⇒ 必须是两条产品（详见 server/videoCatalog.mjs 上方那段契约注释）。
   ⇒ 这一层做的事就是**在展示与选择上合并，在钱路上不动**：
        · 同一个 `variant` 的产品 → 下拉里**一行**；
        · 它们各自的分辨率 → 「生成设置 → 清晰度」里的档位药丸，选中哪档就切到那条产品
          （价格随之变化，按钮上的积分会实时跟着变 —— 档位不同价不同是事实，不藏）。

   ⚠️ 纯函数、零依赖，方便门禁直接断言（test/video-model-families-0925）。
   ══════════════════════════════════════════════════════════════════════════════════════════ */

/* 清晰度档位的展示顺序：低 → 高。用固定表而不是字符串排序
   （字典序下 '1080p' < '2k' 是错的，而 '480p' > '1080p' 更加错）。 */
const RESOLUTION_ORDER = ['480p', '720p', '1080p', '2k'];

export function resolutionRank(value) {
  const index = RESOLUTION_ORDER.indexOf(String(value || '').toLowerCase());
  return index < 0 ? RESOLUTION_ORDER.length : index;
}

export function sortResolutions(list = []) {
  const seen = new Set();
  const values = [];
  for (const item of list) {
    const value = String(item || '').toLowerCase();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    values.push(value);
  }
  return values.sort((a, b) => resolutionRank(a) - resolutionRank(b));
}

/* 主档 = 该型号里"含 720P（站内标准档）"的那一条，没有就取第一条。
   为什么要挑：型号行的名字、描述、档位标签只能写**一份**，必须挑代表档来写 ——
   通义万相那一组里 1080P 是偏档（只 5-9 秒），MiniMax 那组里 2K 是偏档（价格高一倍），
   拿它们当主档会让用户以为这就是该型号的常规形态。 */
function primaryOf(group) {
  return group.find(product => (product.resolutions || []).includes('720p')) || group[0];
}

export function buildVideoModelRows(products = []) {
  const rows = [];
  const byVariant = new Map();
  for (const product of Array.isArray(products) ? products : []) {
    if (!product) continue;
    /* 兜底：目录里万一有新产品漏了 variant（新增档位时忘了写），
       退化成"它自己一行" —— 分组降级，但绝不会两条产品挤进同一行丢档位。 */
    const variant = product.variant || product.id;
    let row = byVariant.get(variant);
    if (!row) {
      row = {
        variant,
        family: product.family || product.id,
        familyLabel: product.familyLabel || product.providerLabel || '其它',
        products: [],
      };
      byVariant.set(variant, row);
      rows.push(row);
    }
    row.products.push(product);
  }
  for (const row of rows) {
    row.products.sort((a, b) => resolutionRank(a.resolutions?.[0]) - resolutionRank(b.resolutions?.[0]));
    row.primary = primaryOf(row.products);
    row.label = row.primary.variantLabel || row.primary.label;
    row.tierLabel = row.primary.tierLabel;
    row.description = row.primary.description;
    row.resolutions = sortResolutions(row.products.flatMap(product => product.resolutions || []));
  }
  /* 家族分组：家族内保持目录顺序（同一家族的档位在目录里本来就是相邻写的），
     家族之间也保持目录顺序 —— 不额外排序，免得"用户刚记住的位置"每版都换。 */
  const families = [];
  const byFamily = new Map();
  for (const row of rows) {
    let family = byFamily.get(row.family);
    if (!family) {
      family = { key: row.family, label: row.familyLabel, rows: [] };
      byFamily.set(row.family, family);
      families.push(family);
    }
    family.rows.push(row);
  }
  return { rows, byVariant, families };
}

export function rowOfVariant(modelRows, variant) {
  if (!modelRows || !variant) return null;
  return modelRows.byVariant.get(variant) || null;
}

/* 某一档清晰度对应哪条产品：正好提供这一档的优先；都没有（理论上不会）回主档。
   ⚠️ 返回的是**产品对象**：调用方要用它的 id 去切 selectedProductId —— 切换后价格、
      时长上限、参考素材上限全部跟着这条产品走（与用户自己点模型那一行完全同一条路）。 */
export function productForResolution(row, resolution) {
  if (!row) return null;
  const value = String(resolution || '').toLowerCase();
  return row.products.find(product => (product.resolutions || []).includes(value)) || row.primary;
}
