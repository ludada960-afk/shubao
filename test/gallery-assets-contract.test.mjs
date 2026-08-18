import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('..', import.meta.url);
const galleryRoot = fileURLToPath(new URL('../薯包出品', import.meta.url));
const dataSource = readFileSync(new URL('../src/constants/data.js', import.meta.url), 'utf8');
const galleryProgram = dataSource
  .replace(/^(?:import[^\n]+\n)+/, '')
  .replace('export const GALLERY =', 'const GALLERY =')
  .split('\n/* ═══════ 热门主题')[0]
  .concat('\nglobalThis.__gallery = GALLERY;');
const galleryContext = {
  galleryImg: (id, file) => `/api/gallery-image?id=${encodeURIComponent(id)}&file=${encodeURIComponent(file)}`,
};
vm.runInNewContext(galleryProgram, galleryContext);
const GALLERY = galleryContext.__gallery;
const folderById = {
  xm: '熬夜总结🔥厦门3天2夜精华攻略！人均800+玩到爽！',
  ep: '实测5款百元蓝牙耳机🔥闭眼入不踩雷',
  crab: '人均80吃帝王蟹🦀？这家大排档也太狠了',
  jk: '3套JK制服搭配🔥附价格参考！甜酷风',
  skincare: '25岁精简护肤🔥3步养出透亮肌！别再叠',
  pilates: '30天居家普拉提🔥腰围缩了5cm！',
  livingroom: '500元爆改极简客厅😱朋友都以为花了几万',
  rent: '实测300元出租屋改造🆘效果真的绝了',
  aitools: '实测推荐🔥这5款AI工具让我效率翻倍！',
  mealprep: '打工人带饭一周🔥月省800元💰5分钟',
  books: '改变认知的6本好书🔥读完格局直接炸裂',
  tv2026: '格局炸裂🤯2026年必看国产剧清单🔥',
  english: '考研英语85分不是梦🔥学姐3个月提分秘',
  selfmedia: '裸辞做自媒体🔥3个月收入破万，我做了什么',
};

test('every inspiration image URL resolves to a versioned source asset', () => {
  assert.equal(GALLERY.length, 14);
  let referencedImages = 0;
  for (const item of GALLERY) {
    const folder = folderById[item.id];
    assert.ok(folder, `missing catalog folder for ${item.id}`);
    const urls = [item.cover_url, ...(item.image_urls || [])];
    for (const value of urls) {
      const url = new URL(value, 'https://shuimg.cn');
      assert.equal(url.pathname, '/api/gallery-image');
      assert.equal(url.searchParams.get('id'), item.id);
      const file = basename(url.searchParams.get('file') || '');
      const target = join(galleryRoot, folder, file);
      assert.equal(existsSync(target), true, `${item.id}/${file} is missing`);
      assert.ok(statSync(target).size > 1000, `${item.id}/${file} is empty`);
      referencedImages += 1;
    }
  }
  assert.equal(referencedImages, 117);
  assert.equal(readdirSync(galleryRoot, { withFileTypes: true }).filter(entry => entry.isDirectory()).length, 14);
});

test('every built-in xiaohongshu case has one prompt-only replay file', () => {
  for (const item of GALLERY) {
    const folder = folderById[item.id];
    const promptPath = join(galleryRoot, folder, '提示词.txt');
    assert.equal(existsSync(promptPath), true, `${item.id} is missing 提示词.txt`);
    const prompt = readFileSync(promptPath, 'utf8').trim();
    assert.ok(prompt, `${item.id} has an empty replay prompt`);
    assert.equal(prompt.split(/\r?\n/).length, 1, `${item.id} replay prompt must be one line`);
    assert.equal(item.promptOnlyReplay, true, `${item.id} is not marked prompt-only`);
  }
});

test('production deployment owns, validates, and rolls back the complete gallery asset set', () => {
  const deploy = readFileSync(new URL('../scripts/deploy-production.ps1', import.meta.url), 'utf8');
  assert.match(deploy, /galleryAssets/i);
  assert.match(deploy, /galleryDirectoryName\s*=\s*-join \[char\[\]\]\(34223, 21253, 20986, 21697\)/);
  assert.match(deploy, /verify-production-gallery\.mjs/);
  assert.match(deploy, /remoteBackup[^\n]*galleryDirectoryName|galleryDirectoryName[^\n]*remoteBackup/);
});
