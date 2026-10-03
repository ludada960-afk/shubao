// test/image-provider-fallback-1004.test.mjs
// 门禁：图片兜底通道必须**保住档位**，不能静默降级（2026-10-04）。
//
// 生产取证（canvas_generation_jobs，用户 240485042@qq.com）：
//   · image2  六条全部 completed（provider_job_id = image2:primary:img_…）
//   · 2.5      一条都失败：PROVIDER_ERROR / "No available channel for model
//              image2-5-sunburst under group default (distributor)"
//   ⇒ 主通道 65535 的 2.5 通道没开；IP233 对**同一个密钥**是通的
//      （/v1/models 实测 200，能看到 gpt-image-2.5-sunburst 的 1k/2k/4k）。
//
// ⚠️ 这条门禁要挡的是**接兜底时最容易犯、又最难发现的错**：
//    兜底模型表若只按分辨率索引，2.5 的请求失败后会落到 image2 ——
//    用户要 2.5 拿回 2，**没有任何报错**，只是画质悄悄降了。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = fs.readFileSync(path.join(ROOT, 'server/index.mjs'), 'utf8');
const ADAPTER = fs.readFileSync(path.join(ROOT, 'server/ecommerceEngine/providerAdapter.mjs'), 'utf8');
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('① 适配器的键顺序：档位:分辨率 → 分辨率 → 模型', () => {
  /* 这一条是整套设计的地基：只要键写成"档位:分辨率"就能保住档位。 */
  const body = stripComments(ADAPTER);
  const order = [
    body.indexOf('MODEL_MAP[`${model}:${resolution}`]'),
    body.indexOf('MODEL_MAP[resolution]'),
    body.indexOf('MODEL_MAP[model]'),
  ];
  assert.ok(order.every(i => i > 0), '三种键形态都要支持');
  assert.deepEqual(order, [...order].sort((a, b) => a - b),
    '查找顺序必须是 档位:分辨率 → 分辨率 → 模型');
});

test('② 兜底模型表必须按**档位**登记两族，且 2.5 指向 sunburst', () => {
  const body = stripComments(INDEX);
  const map = body.match(/const IMG_BACKUP_MODELS = \{([\s\S]*?)\n\};/)?.[1] || '';
  for (const tier of ['image2', 'image2-5']) {
    for (const res of ['1K', '2K', '4K']) {
      assert.ok(map.includes(`'${tier}:${res}'`),
        `兜底表必须登记 '${tier}:${res}' —— 否则该档位的请求会掉到别的档位（静默降级）`);
    }
  }
  /* 2.5 必须是 sunburst（生产报的就是 image2-5-sunburst 没通道） */
  assert.match(map, /'image2-5:2K':[^']*'gpt-image-2\.5-sunburst-2k'/);
  assert.match(map, /'image2:2K':[^']*'gpt-image-2-2k'/);
});

test('③ 兜底通道要能接**另一家**供应商：独立密钥 + 独立协议', () => {
  const body = stripComments(INDEX);
  /* 同源同协议的 overflow 只能"换台机器"，接不了另一家；
     接另一家必须走 backup 那条（有独立 base/key/protocol）。 */
  assert.match(body, /const IMG_BACKUP_BASE = String\(process\.env\.IMAGE_BACKUP_BASE_URL/);
  assert.match(body, /const IMG_BACKUP_KEY = String\(process\.env\.IMAGE_BACKUP_API_KEY/);
  const adapter = body.match(/const createBackupImageAdapter = \(\) => createProviderAdapter\(\{([\s\S]*?)\}\);/)?.[1] || '';
  assert.match(adapter, /bearerToken: IMG_BACKUP_KEY/, '兜底用**自己的**密钥，不是主通道的');
  assert.match(adapter, /protocol: 'openai-images'/, 'IP233 这类走同步 OpenAI 图片接口');
  assert.match(body, /IMG_BACKUP_BASE && IMG_BACKUP_KEY[\s\S]{0,80}overflow: createBackupImageAdapter\(\)/,
    '配置齐全时兜底必须真的挂上');
});

test('④ 纯分辨率键保留为老部署兜底（不许破坏已有配置）', () => {
  const body = stripComments(INDEX);
  const map = body.match(/const IMG_BACKUP_MODELS = \{([\s\S]*?)\n\};/)?.[1] || '';
  for (const res of ['1K', '2K', '4K']) {
    assert.ok(map.includes(`'${res}'`), `纯分辨率键 '${res}' 必须保留`);
  }
  assert.match(map, /IMAGE_BACKUP_MODEL_1K/, '老环境变量仍然生效');
});
