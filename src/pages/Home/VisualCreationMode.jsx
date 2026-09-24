import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePanelScrollLock } from '../../components/ui/usePanelScrollLock.js';
import { Check, Info, LayoutTemplate, Layers3, Maximize2, Monitor, Palette, Sparkles, Type, WandSparkles } from 'lucide-react';
import {
  MdAutoAwesome,
  MdCropFree,
  MdLayers,
  MdCheckCircle,
  MdDownload,
  MdErrorOutline,
  MdHighQuality,
  MdImage,
  MdOpenInNew,
  MdRefresh,
  MdSend,
  MdTune,
  MdZoomOutMap,
  MdChevronLeft,
  MdChevronRight,
  MdClose,
} from 'react-icons/md';

import { useApp } from '../../store/AppContext';
import { proxyImg, uploadEcommerceAssets, regenerateCanvasImage, saveWork } from '../../services/api';
import { IMAGE_MODELS } from '../../services/imageModelCatalog.js';
import { handleGenerationAccessError } from '../../utils/generationAccess.js';
import ImageMentionPicker from '../../components/creation/ImageMentionPicker.jsx';
import { insertImageMentionAt } from '../../components/creation/imageMentionModel.js';
import { EcommerceAddCard, EcommerceImageCard } from './ec/components/EcommerceAssetCards.jsx';
import GenSettingsPanel from './ec/GenSettingsPanel.jsx';
/* 面板宽度的**唯一事实源**（ec/panelVisualLanguage.js）。
   此前本文件另有一份宽度表 { recipe: 440, specs: 500, settings: 460 } —— 那是「第二套真相」，
   同一个产品里同一类浮层面板却有三组宽度，正是用户说的「面板宽不统一」。
   现统一走 resolvePanelWidth（480 标准档 + 窄屏兜底），并接受 PANEL_WIDTH_TABLE 的审计。 */
import { resolvePanelWidth } from './ec/panelVisualLanguage.js';
import { IMAGE_RATIOS, imagePixelLabel } from '../../services/imageSizeCatalog.js';
import {
  VISUAL_CREATION_SKILLS,
  VISUAL_RATIO_OPTIONS,
  buildVisualCanvasResult,
  buildVisualWorkRecord,
  createVisualRun,
  updateVisualRunSlot,
  visualRetryIndexes,
  visualRunIsBusy,
  visualSkillById,
  resolveVisualSkillRatio,
  visualSkillDefaultRatio,
  visualGenerationEstimate,
} from './visualCreationModel.js';
import './VisualCreationMode.css';
import { IMAGE_PROMPT_LIMIT } from '../../constants/promptLimits.js';

/* ═══ 2026-09-19 批 H（用户批注 #3）：「张数应该多一些呀。正常来说，比如说一些电商用户，
   他可能就是几张他自己的产品图，后面就全部都是竞品的图了，那电商的竞品图可能有十几张、
   几十张的都有呀。你不应该过分的去限制呀。他上传的多，你就应该往右边去扩展呀。
   然后给他一条可以向右边滑动的那种滑动条就可以呀。」
   所以上传口从 6/3 放到 **30/12**（素材条本来就是横向滚动的，多了就往右排）。
   ⚠️ **上传口 ≠ 这次会带进生成的张数**：服务端 /api/generate 对 reference_images 的硬上限是 8
     （server/index.mjs：「if (!Array.isArray(referenceImages) || referenceImages.length > 8)」）。
     超出部分**会如实告诉用户**（见下面的 effective-reference-note），不做"传了 30 张只用 8 张
     却一声不吭"的事。上传口放开是为了让用户把竞品图一次性摆好、随时挑着用。 */
const MAX_REFERENCES = 30;
const MAX_STYLE_REFERENCES = 12;
/* 服务端能带进一次生成的参考图上限（与 server/index.mjs 的 8 对齐；见 skillRun.MAX_REFERENCE_IMAGES） */
const SERVER_REFERENCE_LIMIT = 8;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
/* ═══ 2026-09-19 用户批注 #2-②：首页案例台整块删掉，随之删掉"案例轮播"的三个常量
   （自动停留 9s / 手动停留 15s）与 showcaseLoadingPolicy —— 它们的唯一消费者是
   那块被删掉的展示位。删的是**轮播机制**，不是案例数据：
   selectedSkill.showcases 仍由 visualCreationModel 提供（深链子页面还要按 skill 取案例图），
   而首页的「左介绍 + 右案例」版式已整体搬进精选 skill 的悬停预览窗
   （components/media/SkillEntryRow.jsx，规格见 docs/design/52）。 */
function referenceId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/* 照小红书图文那套：ImageMentionPicker(insert) 把 @引用 插进 textarea 光标处 */
function insertMentionInTextarea(fieldRef, currentValue, setValue, label) {
  const field = fieldRef.current;
  const result = insertImageMentionAt(
    currentValue,
    label,
    field?.selectionStart,
    field?.selectionEnd,
  );
  if (result.value === currentValue) return;
  setValue(result.value);
  const restore = () => {
    field?.focus();
    field?.setSelectionRange?.(result.caret, result.caret);
  };
  if (globalThis.requestAnimationFrame) globalThis.requestAnimationFrame(restore);
  else globalThis.setTimeout?.(restore, 0);
}

/* 结果灯箱翻页：条目列表跟着 previewItem.items 走（打开时冻结的那一批），
   返回时**必须把 items 带上**，否则翻第二下就退化成单张了。 */
function stepPreview(current, direction) {
  const list = current?.items || (current ? [current] : []);
  if (list.length < 2) return current;
  const index = list.findIndex(item => item.src === current.src);
  return { ...list[(index + direction + list.length) % list.length], items: list };
}

function generationErrorMessage(error) {
  if (error?.name === 'AbortError') return '生成已取消';
  return error?.message || '图片生成失败，请稍后重试';
}

const VISUAL_RATIO_META = {
  '1:1': { shape: [24, 24], usage: '方形主视觉' },
  '3:4': { shape: [21, 28], usage: '竖版内容' },
  '4:3': { shape: [28, 21], usage: '横版画面' },
  '9:16': { shape: [18, 32], usage: '全屏竖版' },
  '16:9': { shape: [32, 18], usage: '宽屏横幅' },
  '21:9': { shape: [34, 15], usage: '超宽主视觉' },
};

const VISUAL_OPTION_ICONS = [Sparkles, Palette, LayoutTemplate, Layers3];
const VISUAL_PANEL_ICONS = [LayoutTemplate, Layers3, Type, Palette];
const VISUAL_OPTION_HINTS = {
  智能匹配: '由主体、场景与参考素材自动平衡',
  写实摄影: '控制真实光线、材质与空间关系',
  风格插画: '强化笔触、色彩与想象力表达',
  主标题优先: '先建立阅读焦点，再组织辅助信息',
  产品优先: '让主体占据最清晰的视觉位置',
  活动信息优先: '为活动内容预留明确的传播层级',
};

/* ═══ 批 J-⑪：比例图形改**中性 currentColor**（用户批注 #7-4 要照抄视频侧）═══════════════
   视频侧那套是 `.video-ratio-grid i { border: 2px solid currentColor }` —— 图形跟着**卡片文字色**走，
   选中时卡片文字转墨色、图形自然跟着转墨色，不需要第二个颜色源。
   ⚠️ 改前这里写死 #7c3aed（品牌紫）：既破了"选中态走中性墨色"（批 H-2 的裁定），
      又多了一处硬编码色值。现在整张卡片只有 currentColor 一个颜色源。 */
function VisualRatioShape({ ratio }) {
  const [width, height] = VISUAL_RATIO_META[ratio]?.shape || [24, 24];
  return (
    <svg className="visual-ratio-shape" width={width + 4} height={height + 4} viewBox={`0 0 ${width + 4} ${height + 4}`} aria-hidden="true">
      <rect x="2" y="2" width={width} height={height} rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function VisualRecipePanel({ selectedSkill, skillControl, updateSkillControl, panelValues, updatePanelValue, busy }) {
  return (
    <div className="visual-subpanel">
      <div className="visual-panel-section">
        <div className="visual-panel-section-heading"><Sparkles /><div><strong>{selectedSkill.control.label}</strong><small>决定这组画面的主导表达方式</small></div></div>
        <div className="visual-choice-list">
          {selectedSkill.control.options.map((option, index) => {
            const Icon = VISUAL_OPTION_ICONS[index % VISUAL_OPTION_ICONS.length];
            const selected = skillControl === option;
            const optionMeta = selectedSkill.control.optionMeta?.find(item => item.value === option);
            return (
              <button type="button" key={option} className={`visual-choice-card${optionMeta ? ' visual-style-option' : ''}${selected ? ' is-selected' : ''}`} onClick={() => !busy && updateSkillControl(option)} disabled={busy} aria-pressed={selected}>
                {/* ⚠️ 这里曾是**源图直引**：48×48 的图标位拉 5–7MB 的源 PNG。
                    实测 free-paper-city.png = 6.8MB，而同一个 icon 只需 w320（43KB，落盘缓存）—— 差 159 倍。
                    选项图共 14 张，用户把面板翻一遍原本要下 ~84MB（3Mbps 出口下 3 分多钟），
                    这正是「图片加载很慢」的主因之一（另一处同族问题见视觉创作面板的案例卡）。 */}
                {optionMeta ? <img className="visual-style-option-image" src={proxyImg(optionMeta.image, 'w320', 'webp')} alt="" width="48" height="48" loading="lazy" decoding="async" fetchpriority="auto" /> : <span className="visual-choice-icon"><Icon /></span>}
                <span className="visual-choice-copy"><strong>{option}</strong><small>{optionMeta?.description || VISUAL_OPTION_HINTS[option] || `为${selectedSkill.title}选择更明确的${selectedSkill.control.label}倾向`}</small></span>
                {selected && <Check className="visual-choice-check" />}
              </button>
            );
          })}
        </div>
      </div>
      {selectedSkill.panels?.map((panel, panelIndex) => {
        const PanelIcon = VISUAL_PANEL_ICONS[panelIndex % VISUAL_PANEL_ICONS.length];
        const currentValue = panelValues[panel.id] || panel.options[0];
        return (
          <div className="visual-panel-section" key={panel.id}>
            <div className="visual-panel-section-heading"><PanelIcon /><div><strong>{panel.label}</strong><small>只调整本次生成需要强调的局部规则</small></div></div>
            <div className="visual-choice-grid">
              {panel.options.map((option, index) => {
                const selected = currentValue === option;
                const Icon = VISUAL_OPTION_ICONS[(panelIndex + index + 1) % VISUAL_OPTION_ICONS.length];
                return <button type="button" key={option} className={`visual-choice-card visual-choice-card-compact${selected ? ' is-selected' : ''}`} onClick={() => !busy && updatePanelValue(panel.id, option)} disabled={busy} aria-pressed={selected}><span className="visual-choice-icon"><Icon /></span><span className="visual-choice-copy"><strong>{option}</strong></span>{selected && <Check className="visual-choice-check" />}</button>;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══ 2026-09-18 批 C（用户批注 6 / 11 / 12）═══════════════════════════════════
   用户原话：「最前面应该是选模型的面板，第二个是分辨率、尺寸和数量那些东西。」
   所以首页的底栏配置是**四档顺序**：模型 → 分辨率 → 尺寸 → 数量。
   落地方式：模型 + 分辨率同属"生成设置"面板（GenSettingsPanel，与电商生图同源），
   尺寸与数量各自一个面板 —— 于是触发条的先后顺序就是用户要的那个顺序，
   而每个面板仍然只讲一件事（一个面板里再分两个组会让"第二个是什么"变得含糊）。
   ⚠️ 子页面的精细配置不在这里：那个是 MediaCreation/** 的工作台，功能一个不少。 */
/* ═══ 2026-09-19 用户批注 #5-① / #6（第二次强调）：首页图片配置**只要两个面板** ═════════
   原话：「图片生成这里只要两个面板就可以了，一个是选模型的面板，另一个就是把这些尺寸啊、
   数量啊、清晰度啊集合到同一个面板里面的就可以了。你抄都不会抄吗？知渔那边的做法你不能抄吗」
   「你看你不能抄它这种样式吗？就直接打开就可以看到分辨率和尺寸这些东西，然后直接配置好就可以生成，
   这样是最快让用户生成的，就是要这样呀。」
   所以：分辨率 + 尺寸 + 数量**同一个面板一屏铺开**（照竞品那个『分辨率 / 图片尺寸』面板的形态：
   一行档位、点一下就好），不要再让用户为了一次生成点开三个面板。
   ⚠️ 分辨率仍走 GenSettingsPanel 的权威选项（跟模型能力绑定，1K/2K/4K 白名单不在本文件里另写）。 */
function VisualSpecsPanel({ selectedSkill, ratio, resolution, onRatioChange, onResolutionChange, busy }) {
  /* ═══ 批 J-⑪：画面尺寸给满六档（用户批注 #7-4 / #8 / #9）══════════════════════════════════
     用户原话：「他们会有**很多很多个尺寸的规格**可以给人选的，为什么你没有呢？
     **你只有这四个吗？**还有你为什么做的这么丑呢？」
     「（视频侧）**你照抄吧，我求求你了。**」
     改前：选项 = 该技能自己声明的 3~4 档 ⇒ 用户看到"四个"。
     现在：选项 = **能生成的六档**（imageSizeCatalog 里那张与服务端逐值一致的表，
          门禁 image-size-catalog-parity 第 ② 条逐个跑过 resolveGenerationSize，
          确认六档全都真的照做、没有任何一档会被静默回落）。
           技能自己的顺序只决定**默认值**（visualSkillDefaultRatio 取 ratios[0]，行为不变）。 */
  const options = VISUAL_RATIO_OPTIONS.filter(option => IMAGE_RATIOS.includes(option.id));
  const RES = [{ key: '1K', hint: '试方向' }, { key: '2K', hint: '推荐' }, { key: '4K', hint: '看细节' }];
  return (
    <div className="visual-subpanel">
      <div className="visual-panel-section">
        {/* ⚠️ 批 J-⑪（用户批注 #7-2）：分组标题下面那行小字**删除** ——「这里不需要有这些副标题」。
            分组标题只说这一组是什么；"越高越清晰、也越贵"是解释性文案，用户已经不需要被解释。 */}
        <div className="visual-panel-section-heading"><MdHighQuality /><div><strong>分辨率</strong></div></div>
        <div className="visual-spec-row">
          {RES.map(item => {
            const selected = resolution === item.key;
            return <button type="button" key={item.key} className={`visual-spec-chip${selected ? ' is-selected' : ''}`} onClick={() => !busy && onResolutionChange(item.key)} disabled={busy} aria-pressed={selected}><strong>{item.key}</strong><small>{item.hint}</small></button>;
          })}
        </div>
      </div>
      <div className="visual-panel-section">
        {/* ⚠️ 批 J-⑪（用户批注 #7-3）：同上，这一组的副标题也删掉 ——「这里也不要附标题」。 */}
        <div className="visual-panel-section-heading"><Monitor /><div><strong>画面尺寸</strong></div></div>
        {/* 卡片 = 比例图形 + 比例 + **真实像素尺寸**（照视频侧 .video-ratio-grid button 的做法：
            竖排居中、描边卡、选中走墨色）。像素值来自能生成的唯一真源，不是装饰。 */}
        <div className="visual-ratio-grid">
          {options.map(option => {
            const selected = ratio === option.id;
            return (
              <button
                type="button"
                key={option.id}
                className={'visual-ratio-card' + (selected ? ' is-selected' : '')}
                onClick={() => !busy && onRatioChange(option.id)}
                disabled={busy}
                aria-pressed={selected}
                aria-label={option.id + ' ' + imagePixelLabel(resolution, option.id)}
              >
                <span className="visual-ratio-shape-wrap"><VisualRatioShape ratio={option.id} /></span>
                <strong>{option.id}</strong>
                <small>{imagePixelLabel(resolution, option.id)}</small>
              </button>
            );
          })}
        </div>
      </div>
      {/* ⚠️ 2026-09-19 批 H（用户批注 #1）：「这个生成数量我觉得也不应该有，就是默认一张，
          因为其他家也是这么做的。」—— 「生成数量」整块（1/2/3/4 四张卡）删除，恒定 1 张。
          count 这个 state 仍然保留（值恒为 1），因为它一路带着 runId/slot 的语义，
          删掉它反而会牵动生成链路；只是用户不再有地方改它。 */}
      {/* ⚠️ 批 J-⑪（用户批注 #7-1）：「为什么会有这个描述呢？**这描述不要**。」
          面板底部那句「模型与分辨率会同步影响预计 AI 积分；生成前仍可随时调整。」**整块删除** ——
          积分本来就在生成按钮里写着，这句话既没告诉用户任何新东西，又把面板撑长。
          （Info 图标同时撤下：它只为这一句而存在。） */}
    </div>
  );
}


function getVisualPanelPosition(panelId, button) {
  const rect = button.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  /* 9-11 二轮用户批注: 面板打开要「一眼看全」— 提高目标高度, 并用满可用空间 (最多 92vh)
     注：**高度**按面板内容多寡分档是有依据的（内容量不同），
     而**宽度**没有这种依据（都是单/双列表单），故宽度统一走唯一真源。 */
  /* 面板高度只用来判断「要不要切紧凑档」—— 尺寸/数量两个面板内容少，目标高就小。
     ⚠️ 这里**不该**出现 width：宽度只有 resolvePanelWidth 一份真源。 */
  const desiredHeight = { recipe: 720, specs: 700, settings: 360 }[panelId] || 620;
  const width = resolvePanelWidth(viewportWidth);
  const left = Math.max(16, Math.min(rect.left + rect.width / 2 - width / 2, viewportWidth - width - 16));
  const gap = 10;
  const availableAbove = Math.max(0, rect.top - gap - 16);
  const availableBelow = Math.max(0, viewportHeight - rect.bottom - gap - 16);
  /* 9-11 二轮用户批注: 「一眼看全」优先 — 选空间更大的一侧;
     两侧都不够时允许面板越过触发条 (top:16 起, 最多 92vh), 不再强制在 396px 里滚动。 */
  const openAbove = viewportWidth <= 640 || availableAbove >= availableBelow;
  const availableSpace = openAbove ? availableAbove : availableBelow;
  /* ═══ 2026-09-16 用户批注（图10-①）═══
     原话：「自由创作这边的四个板块，你现在张开之后都不是一般能够看全，你现在下面都会有一小部分
     被截断，都需要往下滚动一下鼠标才能够看全所有的信息点，这个是违背我们逻辑的 ——
     我们的逻辑就是你张开这个面板必须能够看到所有的信息，你不需要让用户去滚动这个鼠标呀，
     你的适配逻辑必须要去做。」
     根因有两条，都在这里：
       ① maxHeight 被 Math.max(300, …) 托底，**可以大于该侧可用空间** → 面板直接超出视口被切；
       ② 即使不越界，也没有「内容装不下就用满整屏」的兜底 —— 于是 420px 的空间里塞 700px 的内容，
          只能用内部滚动承担，用户就得滚鼠标。
     修法：maxHeight 取「该侧空间」与「设计目标高」的较大者，再用「视口可用高」封顶；
     并在越过触发条时把面板整体夹进视口（上下各留 SAFE）——**永远不截断**。
     只有视口本身装不下目标高度时，才轮到面板内部滚动。 */
  /* ⚠️ 这里要同时满足两条看起来打架的用户要求，所以不能只挑一条：
     ① 面板**永远贴着触发按钮**开（9-12 批注：退化成覆盖层会盖住输入框左下角的 @ 按钮）；
     ② 内容**一屏看全**，不要让用户滚鼠标（图10-①）。
     只满足 ②（把面板撑到整屏）就会破坏 ①；只满足 ① 而把内容压在该侧空间里，内容就溢出要滚。
     解法：高度严格取该侧可用空间（**绝不越界、绝不被截断**），
           同时把「空间不够」这件事告诉内容 —— 面板切**紧凑档**（density=compact），
           由 CSS 收紧内边距与行高，把内容压进这块空间。
     兜底 160：触发条贴到视口边缘时（可用空间不足 160px）允许轻微越界，
           否则面板会退化成一个只能显示标题的窄条。 */
  /* ⚠️ 2026-09-16 二次返工（用户批注图7-①：「还是没有办法一版看全啊，还是有一个滚动条在这里」）：
     上一版把 desiredHeight(720/620/740) 也当成上限，于是**内容比它还高就开始滚** ——
     实测创作配方面板内容约 800px，被 720 的帽子卡住 → 用户仍然要滚。
     关键点：`max-height` **不会**把面板撑高，面板实际高度 = 内容高度（仅受 max-height 封顶），
     所以上限就该直接取**可用空间**：内容 500 就 500（不留空），内容 800 就 800（不滚动）。
     desiredHeight 从此只用来判断「要不要切紧凑档」，不再参与封顶。 */
  const maxHeight = Math.min(Math.round(viewportHeight * 0.92), Math.max(availableSpace || desiredHeight, 160));
  const compact = maxHeight < desiredHeight;
  return {
    left,
    top: openAbove ? undefined : Math.max(12, rect.bottom + gap),
    bottom: openAbove ? Math.max(12, viewportHeight - rect.top + gap) : undefined,
    width,
    maxHeight,
    compact,
    anchorX: rect.left + rect.width / 2,
  };
}

function selectedReferencePayload(assets) {
  return assets.map((asset, index) => {
    const isStyle = asset.bucket === 'style';
    const displayName = isStyle ? `风格参考 ${asset.bucketIndex}` : `我的素材 ${asset.bucketIndex}`;
    return {
      sourceNodeId: `visual-reference-${index + 1}`,
      assetId: asset.assetId,
      url: asset.url,
      displayName,
      mention: `@${displayName}`,
      role: isStyle ? 'reference' : 'source',
      order: index,
    };
  });
}

export default function VisualCreationMode({ recoveryCheckpoint = null, initialSkillId = null }) {
  const { state, dispatch, refreshBillingBalance } = useApp();
  const [skillId, setSkillId] = useState('free');
  const [prompt, setPrompt] = useState('');
  /* 9-13 二轮批注：跟小红书图文一致，上传区拆成「我的素材 ≤6」与「风格参考 ≤3」两个桶 */
  const [materials, setMaterials] = useState([]);
  const [styles, setStyles] = useState([]);
  const [imageModel, setImageModel] = useState('image2');
  const [ratio, setRatio] = useState('1:1');
  const [resolution, setResolution] = useState('2K');
  const [count, setCount] = useState(1);
  const [run, setRun] = useState(null);
  const [runConfig, setRunConfig] = useState(null);
  const [work, setWork] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  /* 9-13 二轮批注：超限/格式问题时给 toast（小红书同款顶部浮层），不静默丢弃 */
  const [toast, setToast] = useState(null);
  const [uploading, setUploading] = useState(false);
  /* 9-13 二轮批注：结果图灯箱。⚠️ 它现在的数据源**只有**本次生成出来的图 ——
     首页案例台删掉之后，这个灯箱不再承担"看案例"的职责（那是精选 skill 悬停窗的事），
     它只服务一件事：把刚生成的结果放大看清。 */
  const [previewItem, setPreviewItem] = useState(null);
  const [activeConfigPanel, setActiveConfigPanel] = useState(null);
  /* 9-11 二轮批注: 面板打开 → 页面锁滚, 滚轮只滚面板 */
  usePanelScrollLock(Boolean(activeConfigPanel));
  const [configPanelPos, setConfigPanelPos] = useState({
    left: 16,
    bottom: 100,
    width: 520,
    maxHeight: 420,
    anchorX: 260,
  });
  const [skillControlValues, setSkillControlValues] = useState(() => Object.fromEntries(
    VISUAL_CREATION_SKILLS.map(skill => [skill.id, skill.control?.options?.[0] || '']),
  ));
  const [panelValues, setPanelValues] = useState(() => Object.fromEntries(
    VISUAL_CREATION_SKILLS.flatMap(skill => (skill.panels || []).map(panel => [panel.id, panel.options?.[0] || ''])),
  ));
  const runRef = useRef(null);
  /* 9-12: 自由创作生成完成后自动进画布 —— 记录已自动进入过的 run，避免重复跳转 */
  const autoCanvasRunRef = useRef('');
  const materialsRef = useRef([]);
  const stylesRef = useRef([]);
  const materialInputRef = useRef(null);
  const styleInputRef = useRef(null);
  /* 9-13 二轮批注：恢复检查点时会跳过「切页重置画幅」，避免覆盖断点续传的画幅 */
  const restoreRatioRef = useRef(false);
  const promptRef = useRef(null);
  const abortRef = useRef(null);
  const configButtonRefs = useRef({});
  /* ═══ 批 BF：全屏（用户原话：「现在首尾帧和图片生成那边，他们都没有这个全屏按钮，
     这个你也要加上去」）—— 与视频侧同一套做法：
     · 状态从 fullscreenchange **读回来**，不在按钮里翻布尔（按 ESC 退出后界面会说反话）；
     · 浮层面板的挂载点跟着全屏元素走（挂 document.body 的浮层在全屏下根本不渲染）。 */
  const composerRef = useRef(null);
  const [fullscreen, setFullscreen] = useState(false);
  const restoredCheckpointRef = useRef('');

  const selectedSkill = visualSkillById(skillId);
  const busy = uploading || visualRunIsBusy(run);
  const retryIndexes = visualRetryIndexes(run);
  const successfulSlots = run?.slots?.filter(slot => slot.status === 'completed') || [];
  const canGenerate = Boolean(prompt.trim() || materials.length || styles.length);
  /* 一次生成里**真的会带进请求**的参考图张数（服务端上限 8）：
     超出部分如实写在 @引用行右侧，不让用户以为传了 30 张就用了 30 张。 */
  const readyReferenceCount = [...materials, ...styles].length;
  const serverCappedReferences = Math.max(0, readyReferenceCount - SERVER_REFERENCE_LIMIT);
  const generationEstimate = visualGenerationEstimate({ imageModel, resolution, count });
  const estimatedPoints = generationEstimate.points;
  /* 结果图灯箱的条目在打开时才冻结（openResultPreview），这样换 skill / 重新生成
     都不会让已经打开的那一屏错位。 */
  const previewItems = previewItem?.items || (previewItem ? [previewItem] : []);

  useEffect(() => {
    if (!initialSkillId || initialSkillId === skillId) return;
    setSkillId(visualSkillById(initialSkillId).id);
  }, [initialSkillId]);

  useEffect(() => {
    if (!previewItem) return undefined;
    /* 条目列表冻结在 previewItem.items 里（打开那一刻的快照），
       所以这个 effect 只依赖 previewItem —— 不会因为 run 每次渲染产生新数组而反复重挂监听。 */
    const move = direction => setPreviewItem(current => stepPreview(current, direction));
    const onKeyDown = event => {
      if (event.key === 'Escape') setPreviewItem(null);
      if (event.key === 'ArrowLeft') move(-1);
      if (event.key === 'ArrowRight') move(1);
    };
    globalThis.addEventListener?.('keydown', onKeyDown);
    return () => globalThis.removeEventListener?.('keydown', onKeyDown);
  }, [previewItem]);

  /* 打开结果灯箱：把当前这一批**生成成功**的图一起冻结进 items，左右键可连续翻看。 */
  const openResultPreview = slot => {
    const items = successfulSlots
      .filter(item => item.url)
      .map((item, index) => ({
        key: item.id,
        src: item.url,
        label: `${selectedSkill.title}结果 ${index + 1}`,
        alt: `${selectedSkill.title}结果 ${index + 1}`,
      }));
    const current = items.find(item => item.key === slot.id);
    if (current) setPreviewItem({ ...current, items });
  };
  const skillControl = skillControlValues[skillId] || selectedSkill.control?.options?.[0] || '';
  /* 照小红书图文那套：ImageMentionPicker 的 images 数组（name 生成 @参考图 N 标签）。
     9-13 二轮批注：我的素材按 source、风格参考按 style 传，与小红书 XhsSupplementDeck 一致 */
  const mentionImages = useMemo(() => [
    ...materials.map((reference, index) => ({
      id: reference.id,
      sourceNodeId: `visual-material-${index + 1}`,
      url: reference.previewUrl,
      name: `我的素材 ${index + 1}`,
      role: 'source',
    })),
    ...styles.map((reference, index) => ({
      id: reference.id,
      sourceNodeId: `visual-style-${index + 1}`,
      url: reference.previewUrl,
      name: `风格参考 ${index + 1}`,
      role: 'style',
    })),
  ], [materials, styles]);

  useEffect(() => {
    setPreviewItem(null);
    /* 9-13 二轮批注：切子页面时底部参数默认值按该板块最合适的画幅重置 */
    if (restoreRatioRef.current) {
      restoreRatioRef.current = false;
    } else {
      setRatio(visualSkillDefaultRatio(skillId));
      setCount(1);
    }
  }, [skillId]);

  useEffect(() => {
    const snapshot = recoveryCheckpoint?.version?.inputSnapshot;
    const checkpointId = recoveryCheckpoint?.version?.id || '';
    if (!snapshot || !checkpointId || restoredCheckpointRef.current === checkpointId) return;
    restoredCheckpointRef.current = checkpointId;
    const nextSkill = visualSkillById(snapshot.skillId);
    setSkillId(nextSkill.id);
    restoreRatioRef.current = true;
    setPrompt(String(snapshot.prompt || snapshot.text || '').slice(0, 3000));
    setImageModel(snapshot.imageModel || 'image2');
    setRatio(resolveVisualSkillRatio(nextSkill.id, snapshot.ratio || '1:1'));
    setResolution(snapshot.resolution || '2K');
    if (snapshot.skillControl) {
      setSkillControlValues(current => ({ ...current, [nextSkill.id]: snapshot.skillControl }));
    }
    if (snapshot.panelValues && typeof snapshot.panelValues === 'object') {
      setPanelValues(current => ({ ...current, ...snapshot.panelValues }));
    }
    const restoredMaterials = (Array.isArray(snapshot.referenceAssets) ? snapshot.referenceAssets : []).map((asset, index) => ({
      id: `restored-${checkpointId}-${index}`,
      name: asset.displayName || `我的素材 ${index + 1}`,
      previewUrl: asset.url,
      asset,
      file: null,
    })).filter(reference => reference.asset?.url);
    setMaterials(restoredMaterials.slice(0, MAX_REFERENCES));
    setStyles([]);
    setNotice('');
  }, [recoveryCheckpoint]);

  useEffect(() => {
    runRef.current = run;
  }, [run]);

  useEffect(() => {
    materialsRef.current = materials;
  }, [materials]);

  useEffect(() => {
    stylesRef.current = styles;
  }, [styles]);

  useEffect(() => () => {
    abortRef.current?.abort();
    for (const reference of [...materialsRef.current, ...stylesRef.current]) {
      if (reference.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(reference.previewUrl);
    }
  }, []);

  /* 9-13 二轮批注：toast 自动消失（照小红书 4s） */
  useEffect(() => {
    if (!toast) return undefined;
    const timer = globalThis.setTimeout(() => setToast(null), 4000);
    return () => globalThis.clearTimeout(timer);
  }, [toast]);

  /* 批 BF：全屏状态从 fullscreenchange **读回来**（与视频侧同一个 effect）——
     ESC 由浏览器接管，只在按钮里翻布尔的话退出后界面会说反话。 */
  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    sync();
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const node = composerRef.current;
    if (!node) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await node.requestFullscreen?.();
    } catch {
      /* 浏览器不允许（非用户手势 / 权限）时什么都不做，按钮标题里已写明这是全屏 */
    }
  }, []);

  const showToast = (message, type = 'error') => setToast({ message, type });

  const model = useMemo(
    () => IMAGE_MODELS.find(option => option.id === imageModel) || IMAGE_MODELS[0],
    [imageModel],
  );

  /* 9-13 二轮批注：按桶（material/style）上传，超限 toast 提示且不静默丢弃 */
  const appendFiles = (files, role = 'material') => {
    setError('');
    const isStyle = role === 'style';
    const max = isStyle ? MAX_STYLE_REFERENCES : MAX_REFERENCES;
    const noun = isStyle ? '风格参考' : '我的素材';
    const currentLength = isStyle ? styles.length : materials.length;
    const available = max - currentLength;
    const incoming = Array.from(files || []);
    if (available <= 0) {
      showToast(`${noun}最多 ${max} 张，已达上限`, 'error');
      clearFileInputs();
      return;
    }
    if (incoming.length > available) {
      showToast(`${noun}最多 ${max} 张，本次超出 ${incoming.length - available} 张，仅保留前 ${available} 张`, 'error');
    }
    const accepted = [];
    for (const file of incoming.slice(0, available)) {
      if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
        setError('仅支持 JPG、PNG 和 WebP 图片');
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setError('单张图片不能超过 15MB');
        continue;
      }
      accepted.push({
        id: referenceId(),
        file,
        name: file.name || (isStyle ? `风格参考 ${styles.length + accepted.length + 1}` : `我的素材 ${materials.length + accepted.length + 1}`),
        previewUrl: URL.createObjectURL(file),
        asset: null,
      });
    }
    if (accepted.length) {
      if (isStyle) setStyles(current => [...current, ...accepted].slice(0, MAX_STYLE_REFERENCES));
      else setMaterials(current => [...current, ...accepted].slice(0, MAX_REFERENCES));
    }
    clearFileInputs();
  };

  const clearFileInputs = () => {
    if (materialInputRef.current) materialInputRef.current.value = '';
    if (styleInputRef.current) styleInputRef.current.value = '';
  };

  const removeReference = (id, role) => {
    const setList = role === 'style' ? setStyles : setMaterials;
    setList(current => current.filter(reference => {
      if (reference.id !== id) return true;
      if (reference.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(reference.previewUrl);
      return false;
    }));
  };

  const ensureDurableReferences = async signal => {
    const current = [...materialsRef.current, ...stylesRef.current];
    const missing = current.filter(reference => !reference.asset);
    if (!missing.length) return current.map(reference => reference.asset).filter(Boolean);
    setUploading(true);
    try {
      const uploaded = await uploadEcommerceAssets(missing.map(reference => reference.file), 'reference', { signal });
      const uploadedById = new Map(missing.map((reference, index) => [reference.id, uploaded[index]]));
      const nextMaterials = materialsRef.current.map(reference => ({
        ...reference,
        asset: reference.asset || uploadedById.get(reference.id) || null,
      }));
      const nextStyles = stylesRef.current.map(reference => ({
        ...reference,
        asset: reference.asset || uploadedById.get(reference.id) || null,
      }));
      materialsRef.current = nextMaterials;
      stylesRef.current = nextStyles;
      setMaterials(nextMaterials);
      setStyles(nextStyles);
      return [...nextMaterials, ...nextStyles].map(reference => reference.asset).filter(Boolean);
    } finally {
      setUploading(false);
    }
  };

  const persistSuccessfulRun = async (completedRun, config) => {
    const hasSuccess = completedRun.slots.some(slot => slot.status === 'completed');
    if (!hasSuccess) return null;
    const nextWork = buildVisualWorkRecord({
      run: completedRun,
      prompt: config.originalPrompt || config.prompt,
      skillId: config.skillId,
      model: config.imageModel,
      ratio: config.ratio,
      resolution: config.resolution,
      referenceAssets: config.referenceAssets,
      skillControl: config.skillControl,
      panelValues: config.panelValues,
    });
    setWork(nextWork);
    dispatch({ type: 'SET_WORKS', works: [nextWork, ...(Array.isArray(state.works) ? state.works.filter(item => String(item._saveKey || item.id) !== String(nextWork._saveKey || nextWork.id)) : [])].slice(0, 50) });
    const saved = await saveWork(nextWork, state.phone);
    setNotice(saved ? '作品已保存，可下载或进入画布继续编辑' : '图片已完成，作品云端保存暂时失败');
    await refreshBillingBalance?.().catch(() => undefined);
    return nextWork;
  };

  const executeSlots = async (baseRun, indexes, config) => {
    let latest = indexes.reduce(
      (current, index) => updateVisualRunSlot(current, index, { status: 'generating', error: '' }),
      baseRun,
    );
    runRef.current = latest;
    setRun(latest);
    setError('');
    setNotice('');

    const referenceMetadata = selectedReferencePayload(config.referenceAssets);
    const primary = config.referenceAssets[0]?.url || '';
    const supplementary = config.referenceAssets.slice(1).map(asset => asset.url);
    const failures = [];

    await Promise.all(indexes.map(async index => {
      const slot = latest.slots[index];
      try {
        const result = await regenerateCanvasImage({
          prompt: config.prompt,
          imageUrl: primary,
          referenceImages: supplementary,
          references: referenceMetadata,
          ratio: config.ratio,
          resolution: config.resolution,
          imageModel: config.imageModel,
          requestKey: slot.requestKey,
          creationIntent: 'visual',
          skillId: config.skillId,
          includeMetadata: true,
          signal: abortRef.current?.signal,
        });
        latest = updateVisualRunSlot(latest, index, {
          status: 'completed',
          url: result.url,
          taskId: result.taskId,
          replay: result.replay,
          error: '',
        });
      } catch (slotError) {
        failures.push(slotError);
        latest = updateVisualRunSlot(latest, index, {
          status: 'failed',
          error: generationErrorMessage(slotError),
        });
      }
      runRef.current = latest;
      setRun(latest);
    }));

    await persistSuccessfulRun(latest, config);
    if (failures.length) {
      const accessResult = handleGenerationAccessError(failures[0], dispatch, {
        source: 'visual-creation',
        ownerEmail: state.phone,
        currency: 'ec_points',
        draftId: baseRun.id,
        action: {
          type: 'visual-creation',
          currency: 'ec_points',
          skillId: config.skillId,
          referenceAssetIds: config.referenceAssets.map(asset => asset.assetId).filter(Boolean),
        },
      });
      if (!accessResult) {
        setError(`${failures.length} 张图片未完成，可只重试失败项`);
      }
    }
    /* 9-12 用户要求：自由创作生成完成后**自动进画布**（与视频生成完成即进画布一致）。
       只在本次确有成功结果时进入，且每次生成只自动进一次；失败/全失败留在原地。 */
    const produced = latest?.slots?.filter(slot => slot.status === 'completed') || [];
    if (produced.length && autoCanvasRunRef.current !== latest?.id) {
      autoCanvasRunRef.current = latest?.id || '';
      try {
        openCanvasWithRun(latest);
      } catch { /* 自动进画布失败不打断用户，可手动点「进入画布」 */ }
    }
  };

  /* 抽成独立函数：手动按钮与「生成完成自动进入」共用同一条路径 */
  const openCanvasWithRun = targetRun => {
    const work = targetRun || run;
    if (!work) return false;
    dispatch({ type: 'SET_RESULT', result: buildVisualCanvasResult(work) });
    dispatch({ type: 'NAVIGATE', page: 'ec-canvas' });
    return true;
  };

  const startGeneration = async () => {
    if (!canGenerate) {
      setError('请先输入画面描述或上传参考素材');
      if (!prompt.trim()) promptRef.current?.focus();
      return;
    }
    if (!state.logged) {
      dispatch({ type: 'SHOW_LOGIN', show: true });
      return;
    }
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setError('');
    setNotice('');
    try {
      const durableAssets = await ensureDurableReferences(abortRef.current.signal);
      /* 9-13 二轮批注：参考素材带上桶语义（我的素材/风格参考），生成时按小红书语义命名 */
      const referenceSources = [
        ...materials.map((reference, index) => ({ asset: reference.asset, bucket: 'material', index })),
        ...styles.map((reference, index) => ({ asset: reference.asset, bucket: 'style', index })),
      ].filter(item => item.asset);
      const referenceAssets = referenceSources.map(item => ({
        ...item.asset,
        bucket: item.bucket,
        bucketIndex: item.index + 1,
      }));
      if (!durableAssets.length && referenceAssets.length) {
        throw new Error('参考素材上传失败，请重试');
      }
      const nextRun = createVisualRun({ count });
      const originalPrompt = prompt.trim();
      const selectedPanelValues = Object.fromEntries((selectedSkill.panels || []).map(panel => [panel.id, panelValues[panel.id] || panel.options?.[0] || '']));
      const panelInstruction = Object.entries(selectedPanelValues).map(([id, value]) => `${id}：${value}`).join('；');
      const config = {
        prompt: `${originalPrompt}\n创作模式：${selectedSkill.title}；${selectedSkill.control.label}：${skillControl}${panelInstruction ? `；扩展设置：${panelInstruction}` : ''}`,
        originalPrompt,
        skillId,
        skillControl,
        panelValues: selectedPanelValues,
        imageModel,
        ratio,
        resolution,
        referenceAssets,
      };
      setRunConfig(config);
      setWork(null);
      runRef.current = nextRun;
      setRun(nextRun);
      await executeSlots(nextRun, nextRun.slots.map((_, index) => index), config);
    } catch (generationError) {
      const accessResult = handleGenerationAccessError(generationError, dispatch, {
        source: 'visual-creation',
        ownerEmail: state.phone,
        currency: 'ec_points',
      });
      if (!accessResult) setError(generationErrorMessage(generationError));
    }
  };

  const retryFailed = async () => {
    if (!run || !runConfig || !retryIndexes.length || busy) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    await executeSlots(run, retryIndexes, runConfig);
  };

  const openCanvas = () => { openCanvasWithRun(run); };

  const updateSkillControl = value => {
    setSkillControlValues(current => ({ ...current, [skillId]: value }));
  };

  const updatePanelValue = (id, value) => {
    setPanelValues(current => ({ ...current, [id]: value }));
  };

  const repositionConfigPanel = useCallback(() => {
    if (!activeConfigPanel) return;
    const button = configButtonRefs.current[activeConfigPanel];
    if (!button) return;
    setConfigPanelPos(getVisualPanelPosition(activeConfigPanel, button));
  }, [activeConfigPanel]);

  useEffect(() => {
    if (!activeConfigPanel) return undefined;
    const closeOnEscape = event => {
      if (event.key === 'Escape') setActiveConfigPanel(null);
    };
    const closeOnOutsideClick = event => {
      const panel = document.getElementById('visual-floating-panel');
      const button = configButtonRefs.current[activeConfigPanel];
      if (panel?.contains(event.target) || button?.contains(event.target)) return;
      setActiveConfigPanel(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    const timer = window.setTimeout(() => window.addEventListener('mousedown', closeOnOutsideClick), 0);
    window.addEventListener('resize', repositionConfigPanel);
    window.addEventListener('scroll', repositionConfigPanel, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('mousedown', closeOnOutsideClick);
      window.removeEventListener('resize', repositionConfigPanel);
      window.removeEventListener('scroll', repositionConfigPanel, true);
    };
  }, [activeConfigPanel, repositionConfigPanel]);

  const toggleConfigPanel = panelId => {
    if (busy) return;
    if (activeConfigPanel === panelId) {
      setActiveConfigPanel(null);
      return;
    }
    const button = configButtonRefs.current[panelId];
    if (button) setConfigPanelPos(getVisualPanelPosition(panelId, button));
    setActiveConfigPanel(panelId);
  };

  const renderConfigPanel = () => {
    if (!activeConfigPanel) return null;
    const panelMeta = {
      /* 9-11 二轮用户批注: 面板头图标必须与下方触发按钮图标一致 */
      recipe: { title: `${selectedSkill.title}方向`, description: '调整本次最重要的画面侧重', icon: <MdAutoAwesome /> },
      specs: { title: '画面规格', description: '分辨率、尺寸与数量都在这一屏里配好', icon: <MdCropFree /> },
      settings: { title: '生图模型', description: '选择这次用哪个模型出图', icon: <MdHighQuality /> },
    }[activeConfigPanel];
    /* ⚠️ 上面这段说明只能放这里（JS 注释），不能写成 {/* … *\/} 塞进 createPortal 的参数位 ——
       createPortal(expr, container) 只接受表达式，那样写会直接编译失败
       （esbuild 门禁当场抓到：Expected ")" but found "id"）。
       面板按可用空间切紧凑档：内容压进可用高度，而不是让用户滚鼠标，
       也不是撑成全屏盖住输入区；用 data-* 属性而不是内联 CSS 变量去传递密度 ——
       用属性选择器匹配内联样式串时，各家浏览器对冒号后空格的序列化不一致，会静默失效。 */
    return createPortal(
      <div
        id="visual-floating-panel"
        className="visual-config-panel"
        data-density={configPanelPos.compact ? 'compact' : 'comfortable'}
        role="dialog"
        aria-label={panelMeta?.title || '生成配置面板'}
        style={{
          position: 'fixed',
          left: configPanelPos.left,
          top: configPanelPos.top,
          bottom: configPanelPos.bottom,
          width: configPanelPos.width,
          maxHeight: configPanelPos.maxHeight,
          zIndex: 1100,
          transformOrigin: 'bottom center',
          '--visual-panel-anchor-x': `${Math.max(28, Math.min(configPanelPos.width - 28, configPanelPos.anchorX - configPanelPos.left))}px`,
        }}
      >
        {/* ⚠️ 2026-09-19 批 H（用户批注 #3-② / #10）：
            「然后你这里为什么还要有这些标题之类这些东西呢？不需要呀。」
            「配置这边不就这三个维度吗？你要搞那么复杂干什么呢？还有那些多余的上面的标题什么的那些都不要呀。」
            面板顶部的**图标 + 标题 + 一句说明**整块删除 —— 用户点的是「画面规格」这颗按钮，
            面板是它的直接延伸，再来一行大字只是噪声。aria-label 仍然带着标题，读屏不受影响。 */}
        <div className="visual-config-panel-body">
          {activeConfigPanel === 'recipe' && <VisualRecipePanel selectedSkill={selectedSkill} skillControl={skillControl} updateSkillControl={updateSkillControl} panelValues={panelValues} updatePanelValue={updatePanelValue} busy={busy} />}
          {activeConfigPanel === 'specs' && <VisualSpecsPanel selectedSkill={selectedSkill} ratio={ratio} resolution={resolution} onRatioChange={setRatio} onResolutionChange={setResolution} busy={busy} />}
          {/* 模型面板：只留模型选择（清晰度已经挪进「画面规格」——用户要的是"打开就能看到
              分辨率和尺寸"，把它留在模型面板里等于逼用户点两次） */}
          {/* ⚠️ openModelList：用户批注 #3-①「点击这个按钮之后就应该是默认往下拉选模型呀」——
              面板一打开就是模型清单本身，不再让用户点第二次。 */}
          {activeConfigPanel === 'settings' && <GenSettingsPanel showHeader={false} openModelList value={{ imageModel, resolution }} onChange={next => { setImageModel(next.imageModel); setResolution(next.resolution); }} hideResolution />}
        </div>
      </div>,
      /* ⚠️ 与视频侧同一条理由（VideoStudio/index.jsx 的 renderFloatingPanel）：挂 document.body
         的浮层在全屏下根本不渲染（浏览器只画全屏元素这棵子树），全屏之后这两颗按钮点了没反应。 */
      fullscreen && composerRef.current ? composerRef.current : document.body,
    );
  };

  return (
      <section className="visual-creation" aria-label="图片生成工作区">
      {/* ═══ 2026-09-19 用户批注 #2-②（第三次强调，这次照做）═══════════════════════════
          原话：「上面这一块就是左边是介绍这个功能的文案、右边是几张演示图的？你都可以拿去直接
          应用在我们现在下面的那块精选 skill 那块地方做预览。**但是你这里就应该把它删掉呀，
          这里就不能有呀，你明白吗？现在首页这两块视频生成和图片生成的地方，它就只能是这种
          上传区和输入区，不要有这种预览的地方，预览的地方必须在他们下面的那些按钮里面做预览。**」
          所以：首页图片生成 = 上传区 + 输入区 + 配置条，**案例台整块删掉**。
          那份「左介绍 + 右案例图」的版式没有丢 —— 它会被搬到首页精选 skill 的**悬停预览窗**里
          （见 components/media/SkillEntryRow 与 docs/design/52）。
          ⚠️ selectedSkill / showcases 仍然保留：配方面板、提示词占位、深链 skillId 都还要用它们。 */}

      {/* ═══ 批 W（2026-09-21）：**标题区整块删除**（用户原话，逐字）══════════════════════════════
          原话：「你的视频生成和图片生成上面的标题文案：『视频生成 / 把创意素材变成吸引人的短片 /
          选择创作方式……』『图片生成 / 把一句话变成能用的图 / 上传素材或直接描述画面……』
          **这些都不要了，去掉之后，把下面的内容和功能适配上去**，
          不能因为去掉一块部分你就没把其他的内容适配了哦。」
          ⇒ 删掉这三行（角标 / 大标题 / 说明）。工作区的标题由**顶栏**承担（MediaCreation 的子页面
             顶栏本来就有技能名/板块名），所以信息没有丢；下面的暖色面直接接上（见 CSS 里
             `.visual-creation-composer` 的上间距那一处适配）。
          ⚠️ `id="visual-creation-title"` 这个锚点被 aria-labelledby 引用过，所以把标题名挪到
             工作区自己的 aria-label 上（读屏仍然知道这一块是什么），不留悬空引用。 */}

      <div ref={composerRef} className={'visual-creation-composer' + (fullscreen ? ' is-fullscreen' : '')}>
        {/* ═══ 素材上传区 + 输入区 + @引用：照抄小红书图文那套（ec-xhs-composer 暖色渐变面），只改文案 ═══ */}
        <div className="ec-xhs-composer visual-composer-surface">
          <div
            className="ec-xhs-media-column xhs-ecommerce-media-column visual-reference-zone"
            onDragOver={event => event.preventDefault()}
            onDrop={event => {
              event.preventDefault();
              if (!busy) appendFiles(event.dataTransfer.files);
            }}
          >
            {/* 9-13 三轮批注：媒体条照小红书 XhsSupplementDeck 的完整结构（ec-xhs-media-column 包媒体条），
                行内偏移与小红书逐项一致；素材区提示句已删，上限说明移入 @引用行 */}
            <div className="ec-xhs-media-strip xhs-ecommerce-media-strip visual-reference-list">
              {materials.map((reference, index) => (
                <EcommerceImageCard
                  key={reference.id}
                  role="product"
                  image={{ url: reference.previewUrl, status: 'loaded' }}
                  label={`我的素材 ${index + 1}`}
                  index={index}
                  onRemove={() => removeReference(reference.id, 'material')}
                />
              ))}
              {materials.length < MAX_REFERENCES && (
                <EcommerceAddCard
                  role="product"
                  label={materials.length ? '继续添加' : '我的素材'}
                  meta={materials.length ? '补充素材' : '主体与生活细节'}
                  title="添加我的素材"
                  onClick={() => { if (!busy) materialInputRef.current?.click(); }}
                />
              )}
              <span className="ec-xhs-multiply" aria-hidden="true">×</span>
              {styles.map((reference, index) => (
                <EcommerceImageCard
                  key={reference.id}
                  role="reference"
                  image={{ url: reference.previewUrl, status: 'loaded' }}
                  label={`风格参考 ${index + 1}`}
                  index={index}
                  onRemove={() => removeReference(reference.id, 'style')}
                />
              ))}
              {styles.length < MAX_STYLE_REFERENCES && (
                <EcommerceAddCard
                  role="reference"
                  label="风格参考"
                  meta="构图或色调"
                  optional
                  title="添加风格参考"
                  onClick={() => { if (!busy) styleInputRef.current?.click(); }}
                />
              )}
            </div>
            <input
              ref={materialInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              hidden
              onChange={event => appendFiles(event.target.files, 'material')}
            />
            <input
              ref={styleInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              hidden
              onChange={event => appendFiles(event.target.files, 'style')}
            />
          </div>

          <div
            className="ec-textarea-wrap ec-xhs-prompt visual-prompt-field"
            /* 点击容器 = 聚焦内部输入框的**鼠标便利**；键盘用户直接 Tab 到 textarea，容器无需可聚焦。
               role="group" 显式声明为容器，否则会被判为「假按钮」（可点却键盘不可达）。 */
            role="group"
            onClick={event => { if (event.target !== promptRef.current) promptRef.current?.focus(); }}
          >
            <textarea
              ref={promptRef}
              value={prompt}
              onChange={event => setPrompt(String(event.target.value || '').slice(0, IMAGE_PROMPT_LIMIT))}
              className="xhs-prompt-field"
              placeholder=""
              aria-label="画面描述"
              onPaste={event => {
                const files = Array.from(event.clipboardData?.files || []).filter(file => ACCEPTED_IMAGE_TYPES.has(file.type));
                if (files.length) { event.preventDefault(); appendFiles(files); }
              }}
            />
            {!prompt && (
              <div className="ec-textarea-placeholder ec-xhs-placeholder ec-xhs-prompt-hints" aria-hidden="true">
                <span className="ec-placeholder-line">{selectedSkill.promptHint ? `${selectedSkill.title}：${selectedSkill.promptHint}` : `描述你想生成的${selectedSkill.title}：主体、场景、构图、文字与限制条件...`}</span>
                {/* 9-13 二轮批注：两条示例按子页面各自独立（不再四个板块共用同一份） */}
                {(selectedSkill.promptExamples || []).map((example, index) => (
                  <span className={`ec-placeholder-line${index === 0 ? ' ec-xhs-example-first' : ''}`} key={example}>{example}</span>
                ))}
              </div>
            )}
          </div>

          <div className="ec-workbench-mention-row">
            <ImageMentionPicker
              images={mentionImages}
              selectionMode="insert"
              onToggle={image => insertMentionInTextarea(promptRef, prompt, setPrompt, image.label)}
            />
            {/* ⚠️ 2026-09-19 批 H（用户批注 #3）：「这一句不要放啊，你放这句干什么呢？用户不需要看这个的。
                素材和风格图你完全不用说有多少张呀？」
                —— 「我的素材 0/30 · 风格参考 0/12 · JPG/PNG/WebP」整行删除。
                格式与上限不再堆在界面上：能传什么格式由文件选择器的 accept 与错误提示承担，
                上限到了卡片自己会消失（继续添加那颗加号卡）。
                唯一保留的一句是**信息量不为零**的那句：当就绪的参考图超过服务端一次能吃下的张数时，
                告诉用户这次会用到几张（见 effective-reference-note）。 */}
            {serverCappedReferences > 0 && (
              <span className="visual-limit-note">
                本次会用到前 {SERVER_REFERENCE_LIMIT} 张参考图，多出的 {serverCappedReferences} 张这次不带上
              </span>
            )}
            {/* ═══ 批 BF：全屏（用户原话，逐字）══════════════════════════════════════════════════
                「现在**首尾帧和图片生成那边，他们都没有这个全屏按钮，这个你也要加上去**。」
                位置照视频侧：@ 这一行的**右端**（margin-left: auto），不额外占一行高度。 */}
            <div className="visual-materials-actions">
              <button type="button" className="visual-materials-fullscreen" aria-pressed={fullscreen} title={fullscreen ? '退出全屏' : '全屏创作台'} onClick={toggleFullscreen}><Maximize2 size={13} />{fullscreen ? '退出全屏' : '全屏'}</button>
            </div>
          </div>
        </div>

        {/* ═══ 底栏：左侧工具胶囊 + 右侧统一生成按钮（按钮内动态积分），照小红书图文那套 ═══ */}
        <div className="ec-workbench-actions xhs-template-actions visual-parameter-bar">
          <div className="ec-workbench-primary-row">
            {/* ⚠️ 触发条的**先后顺序就是用户要的配置顺序**（批注 12 原话：
                「最前面应该是选模型的面板，第二个是分辨率、尺寸和数量那些东西」）：
                 ① 生成设置 = 模型 + 分辨率（最前）
                 ② 画面尺寸 = 比例
                 ③ 生成数量
                 ④ 创作配方（本轮唯一的"非参数"控件，放最后，不占用户点名的那三档）
               改顺序时**必须连着改这里**，别只改面板实现 —— 用户看的是这条。 */}
            {/* ═══ 2026-09-19 用户批注 #5-①（第二次强调）：首页图片**只要两个面板** ═══════════
                原话：「一个是选模型的面板，另一个就是把这些尺寸啊、数量啊、清晰度啊集合到同一个
                面板里面的就可以了。」所以这里只剩两颗触发按钮：
                  ① 生图模型（只选模型）② 画面规格（分辨率 · 尺寸 · 数量，一屏配好）。
                原来的「创作配方」触发也一并撤下：用户批注 #5-② 明确说首页不该再有
                「自由创作」这类高度定制的入口（它们是跟别的 skill 平级的子页面）。
                配方面板本身仍然保留在组件里（深链指定技能时还会用到），只是首页不再暴露入口。 */}
            <div className="ec-workbench-tools xhs-template-tools visual-config-cluster" aria-label="生成配置">
              <button type="button" ref={element => { configButtonRefs.current.settings = element; }} className={`visual-config-trigger${activeConfigPanel === 'settings' ? ' is-open' : ''}`} aria-expanded={activeConfigPanel === 'settings'} onClick={() => toggleConfigPanel('settings')}>
                <MdHighQuality aria-hidden="true" />
                <span className="visual-config-trigger-copy"><small>生图模型</small><strong>{model.label}</strong></span>
                <MdTune aria-hidden="true" />
              </button>
              <button type="button" ref={element => { configButtonRefs.current.specs = element; }} className={`visual-config-trigger${activeConfigPanel === 'specs' ? ' is-open' : ''}`} aria-expanded={activeConfigPanel === 'specs'} onClick={() => toggleConfigPanel('specs')}>
                <MdCropFree aria-hidden="true" />
                {/* 触发按钮只体现「分辨率 + 比例」两个维度（数量恒为 1，不再上屏） */}
                <span className="visual-config-trigger-copy"><small>画面规格</small><strong>{resolution} · {ratio}</strong></span>
                <MdTune aria-hidden="true" />
              </button>
            </div>
            <button
              type="button"
              className="visual-generate-button shubao-gen-cta ec-workbench-next"
              title={`${model.label} ${resolution} · 预计 ${estimatedPoints} AI 积分`}
              onClick={startGeneration}
              disabled={!canGenerate || busy}
            >
              {busy ? <><span className="visual-spinner" />{uploading ? '上传中' : '生成中'}</> : <><MdSend />生成图片<span className="shubao-gen-cta-points">{estimatedPoints} 积分</span></>}
            </button>
          </div>
        </div>
        {renderConfigPanel()}
      </div>

      {(error || notice) && (
        <div className={`visual-feedback ${error ? 'is-error' : 'is-success'}`} role={error ? 'alert' : 'status'}>
          {error ? <MdErrorOutline /> : <MdCheckCircle />}
          <span>{error || notice}</span>
          {retryIndexes.length > 0 && !busy && (
            <button type="button" onClick={retryFailed}><MdRefresh />只重试失败项</button>
          )}
        </div>
      )}

      {run && (
        <div className="visual-results" aria-live="polite">
          <div className="visual-results-heading">
            <span><MdImage />生成结果 <small>{successfulSlots.length}/{run.slots.length}</small></span>
            {work && (
              <button type="button" onClick={openCanvas}><MdOpenInNew />进入画布</button>
            )}
          </div>
          <div className="visual-result-grid">
            {run.slots.map((slot, index) => (
              <article className={`visual-result-item is-${slot.status}`} key={slot.id}>
                {slot.url ? (
                  /* 9-13 二轮批注：结果图可点开放大（原来只能下载）。
                     放大镜按钮**只在 hover/focus 时浮出**，不占版面 —— 一屏看全的前提下
                     给"看清细节"留一条路，而不是把图做大。 */
                  <button type="button" className="visual-result-zoom" onClick={() => openResultPreview(slot)} aria-label={`放大查看${selectedSkill.title}结果 ${index + 1}`} title="放大查看">
                    <img src={slot.url} alt={`${selectedSkill.title}结果 ${index + 1}`} width="512" height="512" loading="lazy" decoding="async" fetchpriority="auto" />
                    <span className="visual-result-zoom-hint"><MdZoomOutMap aria-hidden="true" />放大</span>
                  </button>
                ) : slot.status === 'failed' ? (
                  <div className="visual-result-state"><MdErrorOutline /><span>{slot.error}</span></div>
                ) : (
                  <div className="visual-result-state"><span className="visual-spinner" /><span>{slot.status === 'generating' ? '正在生成' : '等待生成'}</span></div>
                )}
                <footer>
                  <span>图片 {index + 1}</span>
                  {slot.url && (
                    <a href={slot.url} download={`shubao-${run.id}-${index + 1}.png`} title="下载图片">
                      <MdDownload /><span>下载</span>
                    </a>
                  )}
                </footer>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* 9-13 二轮批注：超限/素材问题的顶部 toast（小红书同款位置与时长） */}
      {toast && (
        <div className="visual-toast" role="status" aria-live="polite" data-toast-type={toast.type}>{toast.message}</div>
      )}

      {/* 结果图灯箱：Escape 关、左右键翻（见上面的 keydown effect + 结果网格的放大按钮）。
          条目在打开那一刻冻结成 previewItem.items，所以这里只按 items 翻页。 */}
      {previewItem && (
        <div className="visual-preview-dialog" role="dialog" aria-modal="true" aria-label={previewItem.label} onMouseDown={event => {
          if (event.currentTarget === event.target) setPreviewItem(null);
        }}>
          <div className="visual-preview-dialog-content">
            <button type="button" className="visual-preview-close" aria-label="关闭预览" onClick={() => setPreviewItem(null)}><MdClose /></button>
            {previewItems.length > 1 && <>
              <button type="button" className="visual-preview-previous" aria-label="查看上一张" title="上一张" onClick={() => setPreviewItem(current => stepPreview(current, -1))}><MdChevronLeft /></button>
              <button type="button" className="visual-preview-next" aria-label="查看下一张" title="下一张" onClick={() => setPreviewItem(current => stepPreview(current, 1))}><MdChevronRight /></button>
            </>}
            <img src={previewItem.src} alt={previewItem.alt || previewItem.label} width="1024" height="1024" loading="eager" decoding="async" fetchpriority="high" />
            <strong>{previewItem.label}</strong>
          </div>
        </div>
      )}
    </section>
  );
}
