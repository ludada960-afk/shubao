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
  /* ⚠️ 零倾斜：两个板块的素材卡都不许再有 rotate —— 这是用户本轮最直接的一句否定。
     断言必须**只看素材卡自己的规则块**：这两个文件里还有别处的 rotate
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
  assert.doesNotMatch(rulesMatching(videoCss, 'video-media-deck'), /rotate\(/, '视频侧素材带不许再倾斜');
  assert.doesNotMatch(rulesMatching(videoCss, 'video-material-strip'), /rotate\(/, '视频素材带不许再倾斜');
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
  /* 实测口径：统一 4:3 封面（风格一致的机械保证） */
  assert.match(cardCss, /aspect-ratio: 4 \/ 3/);
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

test('③ 收素材的入口统一叫「全能参考」', () => {
  assert.match(videoIndex, /<strong>全能参考<\/strong>/, '视频侧素材入口必须叫「全能参考」');
  assert.doesNotMatch(videoIndex, /<strong>上传素材<\/strong>/, '旧的「上传素材」标题不得再作为入口名');
});

test('② 主流程不再询问「要不要生成声音」，默认出声音', () => {
  assert.doesNotMatch(videoIndex, /key: 'sound', label: '声音'/, '「声音」面板不得再出现在主流程配置里');
  assert.match(videoIndex, /const \[sound, setSound\] = useState\(true\)/, 'sound 必须默认 true');
  assert.match(videoIndex, /generateAudio: sound/, '上游参数仍要真实下发');
  assert.match(videoIndex, /selectedProduct\.frameAudio === false\) setSound\(false\)/, '产品不支持首尾帧声音时仍要自动关');
});
