import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

/* ═══ 媒体板块「同一套语言」门禁（2026-09-16 P0，起因为用户批注 图#2 / 图#5）═══════
   用户要的是：图片生成与视频生成两个板块，**素材卡 / 布局 / 按钮必须是同一套设计语言**。
   本批先收口两件可验证的事，并锁死防漂移：
     ① 上传素材卡：视频侧复用图片侧「扇形歪卡」的同一组数值（负外边距叠压 + 反向倾斜 + 错位）；
     ② 声音：主流程不再问用户「要不要生成声音」，默认出声音（上游 generate_audio 默认 true）。
   为什么用源码断言：跨板块一致性靠 review 记不住，靠测试才守得住。
     ③ 命名：视频侧收素材的入口统一叫「全能参考」（它收的正是图片/视频/音频三类，
        用户批注：「应该是叫做全能参考吧」）。 */

const videoCss = readFileSync('src/pages/VideoStudio/VideoStudio.css', 'utf8');
const videoIndex = readFileSync('src/pages/VideoStudio/index.jsx', 'utf8');
const imageCss = readFileSync('src/pages/Home/VisualCreationMode.css', 'utf8');

test('① 视频侧素材卡与图片侧共用「对齐卡片」语言（同尺寸 / 同间距 / 零倾斜 / 横向排）', () => {
  /* 视频侧已选态复用唯一实现 MediaAssetCard（尺寸与视觉由组件自带），
     视频侧只保留空态"加号卡"的排布规则 —— 不得再手写第二套已选卡实现。 */
  assert.doesNotMatch(videoIndex, /video-media-caption|video-media-remove/, '视频侧不得再手写已选素材卡（应交给 MediaAssetCard）');
  assert.match(videoIndex, /import MediaAssetCard from '\.\.\/\.\.\/components\/media\/MediaAssetCard\.jsx';/);
  /* ═══ 倾斜：门禁改判据（2026-09-19 批 I-⑥），理由是用户把口径**按档位拆开了** ═══════════
     本门禁原来断言的是「视频侧素材带一律零倾斜」。用户第 14 轮批注原话：
       「之前这两张卡片不是左右歪的吗，你为什么要改呀，你应该改回去啊，
         之前左右对称歪才是对的呀，视频生成那边要抄的就是这边的样式呀，
         **只是智能成片那边不要歪而已**，首尾帧和图片生成都应该是左右歪的，
         然后样式要统一这种呀，一模一样就好。」
     —— 三档口径：图片侧（我的素材 / 风格参考）**歪**；视频侧**首尾帧歪**；视频侧**智能成片不歪**。
     所以判据从「视频侧一律零倾斜」改成**按档位分别断言**：
       · .video-material-strip（智能成片 / 爆款重构那三张素材卡）→ 仍然**零倾斜**
         （用户说的"不要歪"就是这一档，一个字节没松）；
       · .video-media-deck.is-frame（首尾帧那两格）→ **必须**有 ±5° 对称倾斜（新增要求）。
     这不是放宽标准，是把原本混在一起的两档拆开写清。
     ⚠️ 断言必须**只看素材卡自己的规则块**：这两个文件里还有别处的 rotate
     （箭头 rotate(45deg)、spinner rotate(360deg)、以及首页电商案例台的扇形摆法），
     拿全文扫会误判成"素材卡又歪了"，进而逼着下一轮去改那些不相干的东西。 */
  const rulesMatching = (css, needle) => {
    const out = [];
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let match;
    while ((match = re.exec(css))) if (match[1].includes(needle)) out.push(match[2]);
    return out.join('\n');
  };
  assert.doesNotMatch(rulesMatching(videoCss, 'video-media-picker'), /rotate\(/, '视频侧素材卡不许再倾斜');
  /* 「智能成片 / 爆款重构」那一档：三张素材卡仍然零倾斜（用户口径里"不要歪"的就是这一档）。
     ⚠️ 原来这里还断言 video-media-deck 整块零倾斜 —— 首尾帧两格现在**要求**歪，
        所以那条整块断言被下面的正向断言取代（见上）。 */
  assert.doesNotMatch(rulesMatching(videoCss, 'video-material-strip'), /rotate\(/, '视频素材带（智能成片/爆款重构三卡）不许倾斜');
  /* 首尾帧两格：±5° **对称**倾斜，照图片侧同款角度与方向（用户批注 #1-5 / #2-1） */
  assert.match(videoCss, /\.video-media-deck\.is-frame > div:nth-of-type\(1\) \{ transform: rotate\(-5deg\); \}/, '首帧格必须 -5°');
  assert.match(videoCss, /\.video-media-deck\.is-frame > div:nth-of-type\(2\) \{ transform: rotate\(5deg\); \}/, '尾帧格必须 +5°（与首帧对称）');
  /* 对称歪的两格之间那个乘号：复用图片侧同一个节点，不许另造一个长得像的 */
  assert.match(videoIndex, /<span className="ec-xhs-multiply" aria-hidden="true">×<\/span>/, '首尾帧中间必须有乘号（复用图片侧 .ec-xhs-multiply）');
  /* 图片侧（我的素材 / 风格参考）：±5° 对称歪，且方向与上面首尾帧一致 */
  const imageHomeCss = readFileSync('src/pages/Home/Home.css', 'utf8');
  assert.match(imageHomeCss, /\.ec-xhs-card-product \{ transform: rotate\(-5deg\); \}/, '图片侧"我的素材"必须 -5°');
  assert.match(imageHomeCss, /\.ec-xhs-card-reference \{ transform: rotate\(5deg\); \}/, '图片侧"风格参考"必须 +5°（左右对称）');
  assert.doesNotMatch(rulesMatching(videoCss, 'media-asset-card'), /rotate\(/, '视频侧已选素材卡不许再倾斜');
  /* 图片侧：上传卡（ec-xhs-upload-card 一族）本身不倾斜；倾斜的是首页那张"两卡对比"的展示位，
     不在本门禁的射程里 —— 这里只守住素材卡规则块。 */
  assert.doesNotMatch(rulesMatching(imageCss, 'media-asset-card'), /rotate\(/, '图片侧素材卡不许再倾斜');
  /* 悬停只抬起（不旋转、不缩放：横排里缩放会让后面的卡跟着跳） */
  assert.match(videoCss, /\.video-media-deck \.video-media-picker:hover,[\s\S]{0,120}transform: translateY\(-4px\);/);
  /* 空态"加号卡"与已选卡同尺寸档，否则加号卡放进去的一瞬间整排会跳 */
  assert.match(videoCss, /\.video-media-picker \{ width: 136px; flex-basis: 136px; \}/);
});

test('④ 素材卡只有一份实现，且两个板块共用（图片侧与视频侧不得各写一套）', () => {
  const card = readFileSync('src/components/media/MediaAssetCard.jsx', 'utf8');
  const cardCss = readFileSync('src/components/media/MediaAssetCard.css', 'utf8');
  /* 对齐卡片数值与图片侧同源：同尺寸（148 档）+ 零倾斜 + 卡间是间距不是负外边距叠压。
     ⚠️ 叠压会让"上传了 8 张"看起来像 3 张 —— 这正是用户说"素材过于多就要有滑动条"要解决的问题。 */
  assert.match(cardCss, /\.media-asset-card \{[^}]*flex: 0 0 148px;/);
  assert.doesNotMatch(cardCss, /rotate\(/, '素材卡不许再倾斜');
  assert.doesNotMatch(cardCss, /margin-left: -/, '卡与卡之间不许再用负外边距叠压');
  assert.match(cardCss, /\.media-asset-card:hover,[\s\S]{0,120}transform: translateY\(-4px\);/);
  /* 三种素材类型同一份实现（不是三个组件） */
  assert.match(card, /const KIND_ICON = \{ image: ImageIcon, video: Film, audio: FileAudio \};/);
  /* 样式只走 token：不得出现硬编码色值 */
  const hex = cardCss.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  assert.deepEqual(hex, [], '素材卡样式不得硬编码色值：' + hex.join(', '));
  /* 尊重减少动效偏好 */
  assert.match(cardCss, /prefers-reduced-motion[\s\S]*?\.media-asset-card \{ transition: none; \}/);
});

test('⑥ 案例卡只有一份实现：统一 4:3 封面、视频预览懒加载且静音、样式零硬编码色', () => {
  const card = readFileSync('src/components/media/CaseCard.jsx', 'utf8');
  const cardCss = readFileSync('src/components/media/CaseCard.css', 'utf8');
  /* ═══ 2026-09-19 批 L-8 **改判**（依据 docs/design/63-batch-L-annotations.md 图2-①）═══════════
     用户第 17 轮原话：「（flova.tv/zh-CN）我这次**直接圈出来给你**，你知道要怎么抄了吗？
     你就 **1:1 的去抄他们**就好了……最多就是里面的**文案改一下**就行了……然后里面的**预览就是……
     用我们之前的那些**左边文字，右边是几张案例图**的样式放上去就好了。」
     ⇒ 原来的「4:3 封面铺满 + 标题压在下沿渐变上」被换成**横版两栏**（左文字 / 右案例图），
       所以 4:3 这条判据作废；新契约是"两栏栅格 + 右栏是图片位"。 */
  assert.match(cardCss, /\.media-case-card-hit \{[^}]*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 42%\)/,
    '案例卡是**左文字 + 右案例图**两栏（批 L-8）');
  assert.match(cardCss, /\.media-case-card-cover \{[^}]*grid-column: 2/, '右栏是图片位');
  assert.match(cardCss, /\.media-case-card-caption \{[^}]*grid-column: 1/, '左栏是文字位');
  /* 视频案例：进入视口 + hover 才播、静音、循环、只取元数据 */
  assert.match(card, /new IntersectionObserver/, '视频案例必须懒加载（进入视口才准备）');
  /* 9-17 用户口径变更：竞品视频板块的卡是**真的在播**（他们的 <video> 带 autoplay），
     我们照做但更省 —— 进视口才播、离开视口立刻暂停（屏幕外的视频不偷跑流量与解码），
     prefers-reduced-motion 下退回"只 hover 播"。判据随之改成这条新口径。 */
  assert.match(card, /const shouldPlay = Boolean\(video\) && inView && \(hovering \|\| !REDUCED_MOTION\(\)\);/);
  assert.match(card, /setInView\(entry.isIntersecting\)/, '视口外必须能停下来（旧实现只在进入时置 true）');
  assert.match(card, /muted loop playsInline preload="metadata"/);
  /* 同一时刻最多一条在播（防止几十条视频同时占用带宽） */
  assert.match(card, /querySelectorAll\('video\[data-case-preview\]'\)/);
  /* 样式零硬编码色值 + 可点元素有 hover 态 */
  const hex = cardCss.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  assert.deepEqual(hex, [], '案例卡样式不得硬编码色值：' + hex.join(', '));
  assert.match(cardCss, /\.media-case-card-hit:hover \.media-case-card-cover/);
  assert.match(cardCss, /prefers-reduced-motion[\s\S]*?\.media-case-card-cover \{ transition: none; \}/);
});

test('⑦ 工作台骨架与字段渲染各只有一份实现，字段不得再手写控件', () => {
  const shell = readFileSync('src/components/media/WorkbenchShell.jsx', 'utf8');
  const field = readFileSync('src/components/media/FieldRenderer.jsx', 'utf8');
  const shellCss = readFileSync('src/components/media/WorkbenchShell.css', 'utf8');
  /* 骨架：左配置 + 右「示例/历史」双页签 + 左栏底部 CTA（实测结构） */
  assert.match(shell, /className="media-workbench-left"/);
  assert.match(shell, /className="media-workbench-right"/);
  assert.match(shell, /\{ key: 'cases', label: '示例' \}, \{ key: 'history', label: '历史' \}/);
  assert.match(shell, /className="media-workbench-cta"/);
  /* 字段必须经 FieldRenderer，页面不得自己写控件 */
  assert.match(shell, /import FieldRenderer from '\.\/FieldRenderer\.jsx';/);
  assert.match(shell, /<FieldRenderer field=\{field\}/);
  /* 字段渲染器支持的档位（够用即可，不许无限扩张） */
  for (const kind of ['select', 'segmented', 'stepper', 'textarea', 'slot']) {
    assert.match(field, new RegExp("kind === '" + kind + "'"), 'FieldRenderer 必须支持 ' + kind);
  }
  /* 必填标记：实测他们用 * 标注（字段名极简） */
  assert.match(field, /const REQUIRED_MARK = '\*';/);
  /* 样式零硬编码色值 + 可点元素有 hover */
  const hex = shellCss.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  assert.deepEqual(hex, [], '工作台样式不得硬编码色值：' + hex.join(', '));
  assert.match(shellCss, /\.media-workbench-submit:hover/);
});

test('⑤ 素材在上、提示词在下（布局唯一）', () => {
  /* 用户批注：不要学"左边上传区、右边输入区"那套；我们自己的做法是上面素材卡、下面提示词。 */
  assert.match(videoCss, /\.video-content-composer \{\s*display: grid;\s*gap: 0;\s*\}/, 'composer 必须是单列 grid（素材在上、提示词在下）');
  assert.doesNotMatch(videoCss, /\.video-content-composer \{[^}]*grid-template-columns/, 'composer 不得改成左右两列');
  const composer = videoIndex.indexOf('<section className="video-materials"');
  const input = videoIndex.indexOf('<div className="video-composer-input">');
  assert.ok(composer > 0 && input > composer, 'DOM 顺序必须是 素材 → 提示词');
});

test('③ 素材区不再有自己的标题行（既不叫「全能参考」，也不叫「上传素材」）', () => {
  /* ═══ 2026-09-19 批 I-⑦：门禁改判据（用户批注 #1-3，坐标 27.1% / 34.8%）═══════════════
     原来这条要求入口叫「全能参考」。用户第 14 轮原话：
       「这里要么叫智能成品，要么叫全能参考，**不要冲突啊**。」
     冲突是实打实的：上面那排模式页签叫「智能成片」，下面这块素材区却顶着一个
     「全能参考」—— 一块区域挂着另一个模式的名字，用户分不清自己在哪一档。
     现在：素材区就按它的 aria-label 叫「上传素材」；"我在哪一档"由上面那排页签独家承担。
     （「全能参考」这个名字本身没被否定，被否定的是**它出现在这里**。） */
  /* ⚠️ 2026-09-19 批 I-⑦ 二次改判据：用户把「换个名字」也否掉了。
     先按 #1-3 改成了「上传素材」，紧接着 #1-7 原话：
       「这里也不该有文字啊，**上面选中切换区就好了呀**。」
     —— 要的不是"换个名字"，是**这一行整个不该存在**：
        "我在哪一档""这一档收什么"上面那排页签与每张卡自己的文案已经说完。
     所以判据从「必须叫 X」改成**两个名字都不许出现**（负向断言，比原来更严）。 */
  assert.doesNotMatch(videoIndex, /<strong>全能参考<\/strong>/, '「全能参考」不得再作为素材区标题（它与模式页签「智能成片」冲突）');
  assert.doesNotMatch(videoIndex, /<strong>上传素材<\/strong>/, '素材区不许再有标题行（用户 #1-7：这里也不该有文字）');
  /* 右侧那组**动作**按钮必须留着（它们不是说明文字） */
  assert.match(videoIndex, /className="video-materials-actions"/, '清空素材 / 全屏这组动作按钮不得被一起删掉');
});

test('② 主流程不再询问「要不要生成声音」，默认出声音', () => {
  assert.doesNotMatch(videoIndex, /key: 'sound', label: '声音'/, '「声音」面板不得再出现在主流程配置里');
  assert.match(videoIndex, /const \[sound, setSound\] = useState\(true\)/, 'sound 必须默认 true');
  assert.match(videoIndex, /generateAudio: sound/, '上游参数仍要真实下发');
  assert.match(videoIndex, /selectedProduct\.frameAudio === false\) setSound\(false\)/, '产品不支持首尾帧声音时仍要自动关');
});

/* ═══ ⑧ 案例卡的悬停进度条（用户批注 #6，照 liuyingai 实测抄，2026-09-19 批 H-6）══════════
   用户原话：「当你的鼠标滑动过去任何一个按钮上面……你下面这条进度条还会从左往右充满。
   然后你的鼠标离开的话……它下面的进度条会从右往左再变回去。这个速度会非常的快。」
   ⚠️ 关于「速度非常快」这一点，实测与用户描述**不一致**：liuyingai 的 computed 与 5 点采样
      都是 **700ms**（400ms 时走了 87.2%），没有找到任何更短的配置。
      所以这里按**实测值**抄（0.7s），没有为了迎合那句描述去改短 —— 抄就该抄实测。
   判据守的是「机制」而不是「某个数值」：
     ① 高 4px、贴卡底、圆角 0；② 默认 width:0 → 悬停 width:100%；
     ③ **靠 width 过渡，不是 transform/scaleX**（他们也是 width）；
     ④ transition 的 property/duration/timing 三项都对得上；
     ⑤ 纯装饰：aria-hidden + pointer-events:none；⑥ 减少动效偏好下不做过渡。 */
test("⑧ 案例卡悬停进度条：宽度过渡的 4px 渐变条，与 liuyingai 实测同一套机制", () => {
  const card = readFileSync("src/components/media/CaseCard.jsx", "utf8");
  const cardCss = readFileSync("src/components/media/CaseCard.css", "utf8");
  /* ① 元素与无障碍：它是装饰，不能抢点击、不能进无障碍树 */
  assert.match(card, /<span className="media-case-card-progress" aria-hidden="true" \/>/);
  /* ② 尺寸与位置 */
  assert.match(cardCss, /\.media-case-card-progress \{[^}]*height: 4px;/);
  assert.match(cardCss, /\.media-case-card-progress \{[^}]*left: 0;[^}]*bottom: 0;/);
  assert.match(cardCss, /\.media-case-card-progress \{[^}]*pointer-events: none;/);
  /* ③ 默认收、悬停满 —— 而且**必须**是 width，不是 transform */
  assert.match(cardCss, /\.media-case-card-progress \{[^}]*width: 0;/);
  assert.match(cardCss, /\.media-case-card-hit:hover \.media-case-card-progress,[\s\S]{0,80}width: 100%;/);
  assert.match(cardCss, /\.media-case-card-hit:focus-visible \.media-case-card-progress \{ width: 100%; \}/, "键盘用户同样能看到它充满");
  const barRule = cardCss.slice(cardCss.indexOf(".media-case-card-progress {"), cardCss.indexOf(".media-case-card-hit:hover .media-case-card-progress"));
  assert.doesNotMatch(barRule, /transform/, "liuyingai 用的是 width 过渡，不是 scaleX —— 照抄机制");
  assert.doesNotMatch(barRule, /scaleX/, "同上");
  /* ④ 过渡三件套（实测值：width / 0.7s / cubic-bezier(.4,0,.2,1)） */
  assert.match(barRule, /transition: width \.7s cubic-bezier\(\.4, 0, \.2, 1\);/);
  /* ⑤ 渐变必须是**我们自己的**品牌档，不是他们那对 #0076F5 → #7D28CC */
  assert.match(barRule, /linear-gradient\(to right, var\(--sb-brand-500\), var\(--sb-brand-700\)\)/);
  assert.doesNotMatch(cardCss, /#0076F5|#7D28CC/i, "不抄他们的品牌色，否则站里会出现两套紫");
  /* ⑥ 减少动效：这一条**必须在主规则之后**（媒体查询不加特异性，谁在后面谁赢） */
  const reduceIdx = cardCss.lastIndexOf("@media (prefers-reduced-motion: reduce)");
  const mainIdx = cardCss.indexOf(".media-case-card-progress {");
  assert.ok(reduceIdx > mainIdx, "减少动效的覆盖必须写在主规则之后，否则会被主规则盖掉（等于失效）");
  assert.match(cardCss.slice(reduceIdx), /\.media-case-card-progress \{ transition: none; \}/);
});
