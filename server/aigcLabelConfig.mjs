// server/aigcLabelConfig.mjs
// 显式/隐式标识里**共用**的字面量，单独放一个文件，避免两边各写一份又漂移
// （前端 AIComplianceWatermark.jsx / 后端 aiCompliance.mjs 已经为「法律条款」漂移过一次）。
//
// ⚠️ 待与 GB 45438-2025 对齐 —— 角标上的文字属于**显著提示标识**的呈现内容，
//    具体写法国标有规定，本次未取得全文。见 server/aigcStamp.mjs 文件顶部同一条警告。

/** 角标上显示的提示文字。 */
export const PRODUCER_LABEL = 'AI 生成';

/** 角标默认位置。左下角：显著但不压商品主体，也不破坏平台要求的白底。 */
export const DEFAULT_LABEL_POSITION = 'bottom-left';
