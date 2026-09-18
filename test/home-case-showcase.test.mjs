import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stripComments } from '../scripts/lib/token-scope.mjs';

/* ═══ 批 J-⑨：首页案例表达区复用**原来那一整块**（用户批注 #4-1 / #4-2，2026-09-19）═══════
   用户原话：
     「我是真的不知道你是怎么想的。我们**原来不是有这些案例在首页的这些板块这里**吗？
       你为什么**没有把原来的做法直接挪过来**呢。你为什么要自己重新做呢？」
     「原本在我们的图片上传区和提示词输入区的上面，它是有这些相关的案例表达区的，
       那些案例表达区**左边就是描述这个板块的作用和价值的文案，右边就是这些图片的生成效果**。
       你可以直接把那一整个的板块拿过来，放到这下面的预览区里面去呀。」
   契约：首页那一块必须是**既有组件**（CreationShowcase，小红书模式一直在用的那个），
   而不是"照着重画一遍"—— 门禁因此比"页面上有左文案右效果图"更强：
   它要证明这一块**与另一个模式共用同一个源文件**（一处实现，两处引用）。 */

const home = stripComments(readFileSync(new URL('../src/pages/Home/index.jsx', import.meta.url), 'utf8'));
const showcase = readFileSync(new URL('../src/pages/Home/CreationShowcase.jsx', import.meta.url), 'utf8');
const xhs = readFileSync(new URL('../src/pages/Home/XhsContentMode.jsx', import.meta.url), 'utf8');

test('J-⑨ 首页案例区复用既有 CreationShowcase，不另写一份版式', () => {
  assert.match(home, /import \{ CreationShowcase \} from '\.\/CreationShowcase\.jsx';/,
    '首页必须**import 那个既有组件**，不是在首页里再画一遍');
  assert.match(home, /<CreationShowcase mode=\{isVideo \? 'video' : isVisual \? 'visual' : 'ecommerce'\} \/>/,
    '按当前创作模式给 mode（各模式那份文案与真实素材都在组件自己里面）');
  /* 共用一份实现的最强证据：另一个模式页引用的是**同一个文件** */
  assert.match(xhs, /import CreationShowcase from '\.\/CreationShowcase\.jsx';/,
    '小红书模式引用的必须是同一个文件（两处一份实现）');
  /* 左文案 + 右效果图：这一块的骨架就是这两栏 */
  assert.match(showcase, /className="creation-showcase-copy"/);
  assert.match(showcase, /className="creation-showcase-visual"/);
  /* 三个模式各有自己那份"这个板块能给你什么"的文案（不写死一句话糊弄） */
  for (const mode of ['ecommerce', 'video', 'visual']) {
    assert.match(showcase, new RegExp('  ' + mode + ':'), '缺少 ' + mode + ' 的文案档');
  }
});

test('J-⑨ 真实案例网格（灵感发现 / 做同款）留在下面，没有被这一次改动删掉', () => {
  /* 本轮用户只说"把原来那块挪过来"，**没有一句说要删**真实案例区；
     删掉它等于回退一个已交付的功能，所以两块并存：上面讲板块价值，下面给真实案例。 */
  assert.match(home, /<GallerySection maxItems=\{48\} onUseSameStyle=\{restoreGalleryCheckpoint\} \/>/,
    '真实案例网格必须仍在首页上');
  const showcaseAt = home.indexOf('<CreationShowcase');
  const galleryAt = home.indexOf('<GallerySection');
  assert.ok(showcaseAt > 0 && galleryAt > showcaseAt, '顺序：先"这个板块能给你什么"，再"真实案例"');
  /* 小红书模式不重复渲染（它自己那一份已经在工作台里了） */
  assert.match(home, /\{!isXHS && \(/, '小红书模式不要出现第二块同款案例区');
});
