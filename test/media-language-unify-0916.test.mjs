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

test('① 视频侧素材卡与图片侧共用「扇形歪卡」语言', () => {
  /* 图片侧的权威数值：负外边距叠压 + 反向倾斜 + 上下错位 */
  assert.match(imageCss, /\.visual-skill-stage-outputs\.count-2 \.output-0 \{ transform: rotate\(-4deg\); \}/);
  assert.match(imageCss, /\.visual-skill-stage-outputs\.count-2 \.output-1 \{ z-index: 2; transform: rotate\(4deg\) translateY\(-5px\); \}/);
  /* 视频侧必须复用同一组数值，而不是自己发明一套 */
  assert.match(videoCss, /\.video-media-deck \.video-media-card \+ \.video-media-card \{ margin-left: -34px; \}/);
  assert.match(videoCss, /\.video-media-deck \.video-media-card:nth-child\(1\) \{ transform: rotate\(-4deg\); \}/);
  assert.match(videoCss, /\.video-media-deck \.video-media-card:nth-child\(2\) \{ z-index: 2; transform: rotate\(4deg\) translateY\(-5px\); \}/);
  /* 悬停「回正 + 抬起」 */
  assert.match(videoCss, /\.video-media-deck \.video-media-card:hover[\s\S]*?transform: rotate\(0deg\) translateY\(-4px\) scale\(1\.02\)/);
  /* 尊重减少动效偏好 */
  assert.match(videoCss, /prefers-reduced-motion[\s\S]*?\.video-media-deck \.video-media-card \{ transition: none; \}/);
});

test('④ 素材卡只有一份实现，且两个板块共用（图片侧与视频侧不得各写一套）', () => {
  const card = readFileSync('src/components/media/MediaAssetCard.jsx', 'utf8');
  const cardCss = readFileSync('src/components/media/MediaAssetCard.css', 'utf8');
  /* 扇形数值与图片侧同源 */
  assert.match(cardCss, /\.media-asset-card:nth-child\(1\) \{ transform: rotate\(-4deg\); \}/);
  assert.match(cardCss, /\.media-asset-card:nth-child\(2\) \{ z-index: 2; transform: rotate\(4deg\) translateY\(-5px\); \}/);
  assert.match(cardCss, /\.media-asset-card \+ \.media-asset-card \{ margin-left: -34px; \}/);
  /* 三种素材类型同一份实现（不是三个组件） */
  assert.match(card, /const KIND_ICON = \{ image: ImageIcon, video: Film, audio: FileAudio \};/);
  /* 样式只走 token：不得出现硬编码色值 */
  const hex = cardCss.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  assert.deepEqual(hex, [], '素材卡样式不得硬编码色值：' + hex.join(', '));
  /* 尊重减少动效偏好 */
  assert.match(cardCss, /prefers-reduced-motion[\s\S]*?\.media-asset-card \{ transition: none; \}/);
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
