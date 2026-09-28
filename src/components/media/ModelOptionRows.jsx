import React from 'react';
import { Check } from 'lucide-react';
import { SELECTABLE_IMAGE_MODELS, normalizeImageModel } from '../../services/imageModelCatalog.js';
import { brandLogo } from '../../services/modelLogos.js';
import ModelLogo from '../ModelLogo.jsx';

/* ═══ 模型挑选器的**唯一一份实现**（2026-09-28 批 DC 续-7）════════════════════════════════════
   改前全站有两份：首页/六个面板的 `.sb-opt` 行（带 ModelLogo、badge、描述、选中勾）与
   工作台里 FieldRenderer 的**原生 `<select>`**（无 logo、无描述、无勾）——
   用户 2026-09-28 当面点名（批注图1-①，原话）：
     「模型选择这个**你为什么不用其他地方那个选模型的样式呀**，你又自己发明了一个。」
   ⇒ 抽成本组件，**首页那一侧也换成它**（消灭第二份真相）：
     · 视觉 = 原 `.sb-opt` 行（design-tokens-v3.css §18，hover/selected 全套已在 CSS 里）；
     · 描述写法照 GenSettingsPanel 的两档（'full' 自动换行铺满 / false 一行短描述）；
     · 选中项右侧**打钩**（用户批注 #5-② 要求），未选中项保留同宽占位，行宽不跳。
   ⚠️ 只搬**视觉与结构**，`selectModel` 那一侧的"换模型要夹取清晰度"仍由调用方负责
      （那是生成设置面板的职责，工作台那一侧由 reconcileFieldValues 负责）—— 组件本身无业务。 */

/** 一行里的 logo（**一层，不是两层**：2026-09-16 用户批注图1-① 修过一次"图标有两层框"）。 */
function modelIcon(model, size) {
  return (
    <span className="ec-model-mark" style={{ width: size, height: size }}>
      <ModelLogo logo={brandLogo(model.brand)} size={size} radius={Math.round(size * 0.28)} style={{ display: 'block' }} />
    </span>
  );
}

/** 一行里的文字：模型名 + 徽章一行、描述一行。名过长时**裁切不省略**（用户拍板）。 */
function modelRow(model, active, showDesc) {
  return (
    <span style={{ minWidth: 0, flex: 1 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--sb-space-2)', minWidth: 0 }}>
        <strong style={{
          fontSize: 'var(--sb-text-xs)',
          fontWeight: 'var(--sb-weight-semibold)',
          color: active ? 'var(--sb-state-selected-ink)' : 'var(--sb-text-primary)',
          overflow: 'hidden', whiteSpace: 'nowrap',
        }}>{model.label}</strong>
        <span style={{
          fontSize: 'var(--sb-text-2xs)',
          color: active ? 'var(--sb-state-selected-ink)' : 'var(--sb-text-hint)',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>{model.badge}</span>
      </span>
      {showDesc && (
        <span style={{
          display: 'block',
          marginTop: 'var(--sb-space-1)',
          fontSize: 'var(--sb-text-2xs)',
          color: 'var(--sb-text-muted)',
          whiteSpace: showDesc === 'full' ? 'normal' : 'nowrap',
          lineHeight: showDesc === 'full' ? 1.45 : undefined,
          overflow: 'hidden',
        }}>{showDesc === 'full' ? (model.description || model.shortDescription) : (model.shortDescription || model.description)}</span>
      )}
    </span>
  );
}

/**
 * 模型列表。`models` 不给就取**目录里的全部可选模型**（含当前项）。
 * @param desc 'full' = 完整描述自动换行；false = 一行短描述（默认）
 */
export default function ModelOptionRows({ models, value, onPick, desc = false, iconSize = 28, disabled = false }) {
  const current = normalizeImageModel(value);
  /* ⚠️ 默认**含当前项**：这个组件有两类调用方，口径不同，差别由**调用方**决定，不在这里替人做主 ——
     · 工作台（FieldRenderer）：这一组行**就是**控件本身，没有别的按钮显示当前选中了谁 ⇒ 必须含它（靠打钩表示选中）；
     · 生成设置面板（GenSettingsPanel）：触发按钮上已经写着当前模型，展开列表里再出现一次就是重复
       （用户批注图6-⑨「去掉模型下拉顶部重复的『当前模型』项」）⇒ 那一侧传过滤后的 listModels 进来。
     门禁 test/workbench-panel-ux-0915 ㉒ 咬的就是这一条分工。 */
  const list = Array.isArray(models) && models.length ? models : SELECTABLE_IMAGE_MODELS;
  return (
    <div className="sb-opt-list" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--sb-space-2)' }}>
      {list.map(model => {
        const active = current === model.id;
        return (
          <button
            key={model.id}
            type="button"
            className="sb-opt"
            aria-pressed={active}
            /* 语义标记：这一行的模型 id 挂在 DOM 上，页面与端到端都靠它问"现在选的是哪一档"，
               不必去反解按钮文字（模型名会改，文字不是稳定键）。 */
            data-model-id={model.id}
            disabled={disabled}
            onClick={() => onPick?.(model)}
            /* 行高 ≥44px：用户「点击区不许缩水」 */
            style={{ minHeight: 'var(--sb-control-touch)' }}
          >
            {modelIcon(model, iconSize)}
            {modelRow(model, active, desc)}
            {active
              ? <Check size={15} aria-hidden="true" style={{ flexShrink: 0, marginLeft: 'auto', color: 'var(--sb-state-selected-ink)' }} />
              : <span aria-hidden="true" style={{ flexShrink: 0, marginLeft: 'auto', width: 15, height: 15 }} />}
          </button>
        );
      })}
    </div>
  );
}
