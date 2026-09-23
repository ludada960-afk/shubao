import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { VIDEO_SKILLS } from '../src/skills/videoSkills.js';
import { QUANTV_VIDEO_COUNTERPARTS } from '../src/skills/quantvVideoParity.js';
import { VIDEO_SPEC_EXPOSURE, SPEC_EXPOSURE_FALLBACK, specExposureOf } from '../src/skills/videoSpecExposure.js';

/* ═══ 2026-09-24 批 AF：视频子页面的「规格暴露」必须与知渔那一页一致 ═══════════════════════════
   用户原话（本轮的方向性批评）：
     「你为什么还有这种**模型 / 清晰度 / 时长都全部做进去**的情况呢，我不是说了所有子页面
      **一比一对应**知渔的视频生成和图片生成的页面吗，还有这种情况出现说明还是没有对齐呀，
      你要**深度的全面核查**解决对齐呀」

   核查（可复跑，下面的 ①）拿知渔 32 页的实采全文逐页检索这三格，结果：
     · 清晰度：知渔 **0 页**有，我们 **30 页**全给了；
     · 模型：知渔 5 页有，我们 25 页给了；
     · 时长：知渔 6 页有，我们 24 页给了。
   ⇒ 声明表 VIDEO_SPEC_EXPOSURE 由证据派生，这里用**同一份实采数据重新派生并逐条比对**，
     所以手改表格必红（"名单写两处必然漂移"那条老教训）。 */

const norm = value => String(value || '').replace(/[\s（）()：:，,。、*]/g, '');

function deriveFromEvidence() {
  const raw = JSON.parse(readFileSync(new URL('../docs/design/data/quantv-video-pages.json', import.meta.url), 'utf8'));
  const pages = Array.isArray(raw) ? raw : raw.pages;
  const byUrl = new Map(pages.map(page => [String(page.url || ''), page]));
  const derived = {};
  for (const skill of VIDEO_SKILLS) {
    const counterpart = QUANTV_VIDEO_COUNTERPARTS[skill.id]?.counterpart;
    if (!counterpart) continue;
    const text = norm(byUrl.get(counterpart)?.panelText || '');
    derived[skill.id] = {
      model: text.includes('视频模型') || text.includes('模型'),
      clarity: text.includes('清晰度') || text.includes('分辨率'),
      duration: text.includes('时长'),
    };
  }
  return derived;
}

test('① 规格暴露表与知渔实采一致（手改必红）', () => {
  const derived = deriveFromEvidence();
  assert.deepEqual(Object.keys(VIDEO_SPEC_EXPOSURE).sort(), Object.keys(derived).sort(),
    '有对应页的技能集合变了（对照表或实采数据动过）');
  for (const [id, want] of Object.entries(derived)) {
    assert.deepEqual(VIDEO_SPEC_EXPOSURE[id], want,
      `${id} 的规格暴露与知渔那一页不一致（我们应 ${JSON.stringify(want)}）`);
  }
});

test('② 核查结论的样本量自证：知渔几乎没有这几格', () => {
  const rows = Object.values(VIDEO_SPEC_EXPOSURE);
  /* ═══ 2026-09-25 批 AM：**判据跟着事实走**（本地方案那两页进来了）══════════════════════════
     原来这条写「知渔没有任何一页有清晰度」，那是**30 个上游技能页**的核查结论。
     批 AM 新增的两条本地方案同样有知渔对应页，其中「视频高清」那一页**确实有**输出分辨率
     （"视频设置 · 输出分辨率 720p/1080p/2k"）—— 于是"0 页"这句话不再成立。
     判据改成逐条说清楚：**有清晰度的那一页就是视频高清**（别的页仍一页都没有），
     它不是例外而是事实：知渔的高清页本来就是给用户选输出分辨率的。
     ⚠️ 这不是放宽：`clarity: true` 的落点是**那一页自己的字段块**（见 videoWorkbenches 的
        resolution chips），创作台不再重复画一格（见 VideoStudio 的 pageOwnsField 判据）。 */
  const clarityRows = Object.entries(VIDEO_SPEC_EXPOSURE).filter(([, row]) => row.clarity).map(([id]) => id);
  assert.deepEqual(clarityRows, ['video.upscale'], '知渔侧只有「视频高清」那一页有分辨率/清晰度这一格');
  assert.ok(rows.filter(row => row.model).length <= 6, '知渔只有个位数页面有「模型」格');
  assert.ok(rows.filter(row => row.duration).length <= 8, '知渔只有个位数页面有「时长」格');
  assert.ok(rows.length >= 28, '有对应页的技能应 ≥28 条，实际 ' + rows.length);
});

test('③ 取用接口稳定：未登记的技能走"三项都不暴露"的 fallback', () => {
  assert.deepEqual(specExposureOf('video.__nope__'), SPEC_EXPOSURE_FALLBACK);
  assert.deepEqual(specExposureOf(undefined), SPEC_EXPOSURE_FALLBACK);
  /* 知渔没有对应页的自有玩法（26 条）也走 fallback —— 与其所属那族的形态一致 */
  const own = VIDEO_SKILLS.filter(skill => !QUANTV_VIDEO_COUNTERPARTS[skill.id]?.counterpart);
  assert.ok(own.length >= 20, '自有玩法应有 20+ 条，实际 ' + own.length);
  for (const skill of own) {
    assert.deepEqual(specExposureOf(skill.id), SPEC_EXPOSURE_FALLBACK, skill.id + ' 应走 fallback');
  }
});
