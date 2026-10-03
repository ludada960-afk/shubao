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
   它要证明这一块**与另一个模式共用同一个源文件**（一处实现，两处引用）。

   ═══ 2026-09-21 批 T **改判**（同一份用户口径的下半句被用户自己推翻了）══════════════════════
   用户本轮原话（逐字）：
     「然后在下面这块：视频生成案例 / 从参考素材到可确认的成片方案 / 一句话描述镜头目标，
     系统先整理素材、节奏和交付规格，再进入生成。 / 视频创作 / 真实生成结果 / 案例仅用于展示能力 /
     素材分析 / 镜头方案 / 确认生成 这块**整体删掉，不要放这里**。」
   ⇒ 上一版那句「可以直接把那一整个的板块拿过来，**放到这下面的预览区里面去**」的落点是
     **skill 按钮的悬停预览窗**（早就搬进去了，用的是同一份素材）；首页再摆一份 =
     同一句话在一屏里说两遍。所以首页不再渲染它，而组件本身与小红书模式那份引用**一个字没动**。
   新判据：① 首页**不再**渲染 CreationShowcase；
          ② 组件仍然存在、仍被小红书模式引用（"一处实现"这条判据没变，只是首页不再是它的引用方）。 */

const home = stripComments(readFileSync(new URL('../src/pages/Home/index.jsx', import.meta.url), 'utf8'));
const showcase = readFileSync(new URL('../src/pages/Home/CreationShowcase.jsx', import.meta.url), 'utf8');
const xhs = readFileSync(new URL('../src/pages/Home/XhsContentMode.jsx', import.meta.url), 'utf8');

/* ═══ 2026-10-03 **再次改判**（用户第三次就这件事表态）══════════════════════════════
   用户原话（逐字）：
     「现在工作台里面这些子页面里有引用旧版首页的那些板块，**给重做重做成我们现在这些
       子页面的样式**，然后旧版首页那几块东西，你就把它们给删掉吧，避免后面会有一些
       **互相引用或者互相映射导致的混乱**。」
     「旧版首页那几块东西……**电商生图、万物上升、自由创作、海报封面那些，
       还有小红书图文和 plog**。」

   批 T（2026-09-21）当时的落点是"首页不再渲染、但子页面那份引用原样保留" ——
   那时候用户的顾虑是"同一句话在一屏里说两遍"。**现在顾虑变了**：
   旧版首页版块活在**子页面**里，会与子页面互相引用/映射，越改越乱。

   ⇒ 判据跟着改：不仅首页不能引用它，**子页面也不能再引用它**。
     `test/xhs-workbench-ui` 那条同步反转。
     ⚠️ 本组件文件（CreationShowcase.jsx）**暂不删**：它是「一处实现」的历史载体，
        删文件属于另一件事、且会被别处引用链波及；本轮先切断**子页面对它的引用**，
        让它回到真正的孤儿状态，再由下一轮决定文件去留。 */
test('J-⑨（批 1003 再次改判）旧版首页案例表达区**子页面也不再引用**', () => {
  assert.doesNotMatch(home, /<CreationShowcase/,
    '首页不渲染这一块');
  assert.doesNotMatch(home, /import \{ CreationShowcase \}/,
    '首页不 import 它（否则是死引用）');
  /* 本轮新增：子页面同样不许再挂旧版首页那一块 */
  assert.doesNotMatch(xhs, /import CreationShowcase from '\.\/CreationShowcase\.jsx';/,
    '小红书图文子页面不得再 import 旧版首页的案例表达区');
  assert.doesNotMatch(xhs, /<CreationShowcase/,
    '小红书图文子页面不得再渲染旧版首页的案例表达区');
  /* 切掉之后，它自己的功能控件必须还在 —— 不能连功能一起删 */
  assert.match(xhs, /<XhsInputTemplate/,
    '上传 / 文案 / @提及 / 生成 这些真功能控件必须保留');
  assert.match(xhs, /<XhsModeSelector/,
    '「种草图文 / Plog 生活碎片」切换必须保留');
  /* 左文案 + 右效果图：组件本体没被改瘦（本轮只切引用，不动实现） */
  assert.match(showcase, /className="creation-showcase-copy"/);
  assert.match(showcase, /className="creation-showcase-visual"/);
  for (const mode of ['ecommerce', 'video', 'visual']) {
    assert.match(showcase, new RegExp('  ' + mode + ':'), '缺少 ' + mode + ' 的文案档');
  }
});

test('J-⑨（批 T）真实案例网格（灵感发现 / 做同款）仍在首页', () => {
  /* 用户本轮只否掉了"案例表达区"那一块，**没有一句说删真实案例网格** ——
     它现在是首页唯一的案例入口，必须留着。 */
  assert.match(home, /<GallerySection maxItems=\{48\} onUseSameStyle=\{restoreGalleryCheckpoint\} \/>/,
    '真实案例网格必须仍在首页上');
});

