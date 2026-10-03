/* ═══ 2026-10-03 批 DE：图片子页面的「规格露不露」——**表由知渔实采派生，不许手改** ═════════════════════
   起因（用户 2026-10-03 截图 + 交接单第 3 节 ④）：批 1003 把「生图模型 / 画面规格」两颗触发器
   **全局注入**了 44 条图片技能，可知渔那几个内建页**根本没有这几格** ——
   证据在 docs/design/data/quantv-image-tools-20261003.json 的 `NOT_HAS` 字段里（逐页实采）：
     · 商品套图   NOT_HAS = 模型选择 / 分辨率 / 比例 / 生成张数
     · A+内容     NOT_HAS = 模型选择 / 分辨率 / 比例
     · 详情图     NOT_HAS = 模型选择 / 分辨率 / 比例      ← 批 1003 之后我们多了一颗「画面规格」
     · 图片复刻   有 模型选择 + 分辨率 + 比例，**没有**生成张数
     · AI换装     有 模型选择 + 分辨率 + 比例 + 生成张数
     · 去除背景   只有「最多上传 5 张图片」，零配置格

   ⚠️ **这张表的默认值与视频侧 videoSpecExposure 相反，这是有意的**：
     视频侧 fallback = 三项全不露（那 30 页逐页量过，知渔几乎不给规格格）；
     图片侧 49 条里有 43 条**没有对应页**（自有玩法），而用户 2026-10-03 明确要求
     「图片生成和视频生成**全局**都要去按这种方式去处理……几十个子页面都要去这样做呀」
     ⇒ 这里 fallback = **全露**，只有实采写了 NOT_HAS 的那几页才收。
     收窄必须有据：每一条都指向那份 json 里的哪一页，门禁会用同一份数据重新派生并逐条比对
     （与 test/video-spec-exposure-0924 同一条纪律：名单写两处必然漂移）。 */
export const IMAGE_SPEC_EXPOSURE = Object.freeze({
  'image.product_suite': { model: false, resolution: false, ratio: false, count: false },
  'image.aplus': { model: false, resolution: false, ratio: false, count: true },
  'image.detail_page': { model: false, resolution: false, ratio: false, count: true },
  /* 图片复刻：实采逐条列了「模型选择 / 分辨率」（两列并排）与「比例」14 档，
     **没有列 NOT_HAS** ⇒ 这一页四格都按"有"处理。
     ⚠️ 不要凭"块清单里没提到生成张数"就写 count:false —— 门禁会红（这正是它该干的事：
        实采没记的事不许我们替它下结论）。我们这一条本来也没有 count 字段，所以无关。 */
  'image.copy': { model: true, resolution: true, ratio: true, count: true },
  'image.try_on': { model: true, resolution: true, ratio: true, count: true },
  /* 去除背景：实采的 note 里写着「全页只有 1 个字段、无文本框、无下拉」，但那是**散文**，
     结构化字段 NOT_HAS 是空的 ⇒ 这里按派生口径记成"四格都有"。
     实际无影响：我们这一条**一条规格字段都没声明**，`configTriggersFor` 直接返回 null，
     界面不会因为这张表出现或消失任何控件。
     ⚠️ 别把散文当判据写进表里 —— 门禁只认 NOT_HAS，写进来必红（这正是它该拦的东西）。 */
  'image.remove_bg': { model: true, resolution: true, ratio: true, count: true },
});

/* 没有对应页的自有玩法：全露（见文件头「默认值相反」那段理由） */
export const IMAGE_SPEC_EXPOSURE_FALLBACK = Object.freeze({ model: true, resolution: true, ratio: true, count: true });

export function imageSpecExposureOf(skillId) {
  return IMAGE_SPEC_EXPOSURE[skillId] || IMAGE_SPEC_EXPOSURE_FALLBACK;
}

/* 声明里的字段键 → 这张表的四格（ratio / clarity / count / imageModel 四个名字两套，对齐在这里做一次） */
const EXPOSURE_BY_FIELD_KEY = Object.freeze({
  imageModel: 'model',
  clarity: 'resolution',
  ratio: 'ratio',
  count: 'count',
});

/** 这一格在知渔那一页**露不露**（按字段 key 问，页面与注入逻辑都不必再各自翻译一遍）。 */
export function imageFieldExposed(skillId, fieldKey) {
  const slot = EXPOSURE_BY_FIELD_KEY[fieldKey];
  if (!slot) return true;
  return imageSpecExposureOf(skillId)[slot] !== false;
}
