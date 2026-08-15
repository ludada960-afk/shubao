import assert from 'node:assert/strict';
import test from 'node:test';

import { ecommerceGallerySlides } from '../src/gallery/ecommerceGalleryModel.js';

test('gallery slide uses the exact generation prompt instead of display copy', () => {
  const [slide] = ecommerceGallerySlides({
    cover_url: '/hero.png',
    prompt: '整套复用提示词',
    images: [{
      url: '/hero.png',
      label: '完整成片',
      prompt: '真实生产提示词：把五张详情图排成倾斜扇面。',
      description: '面向用户的简短卖点。',
      role: 'finalComposite',
    }],
  });

  assert.equal(slide.isCover, true);
  assert.equal(slide.prompt, '真实生产提示词：把五张详情图排成倾斜扇面。');
  assert.equal(slide.description, '面向用户的简短卖点。');
});

test('gallery slides keep distinct prompts for every production output', () => {
  const slides = ecommerceGallerySlides({
    cover_url: '/cover.png',
    prompt: '整套提示词',
    images: [
      { url: '/cover.png', label: '总览', prompt: '总览真实提示词' },
      { url: '/detail.png', label: '结构解析', prompt: '结构解析真实提示词' },
    ],
  });

  assert.deepEqual(slides.map(slide => slide.prompt), ['总览真实提示词', '结构解析真实提示词']);
  assert.equal(new Set(slides.map(slide => slide.url)).size, 2);
});

test('legacy slides label their fallback instead of inventing a generation prompt', () => {
  const [slide] = ecommerceGallerySlides({ images: [['旧图', '/legacy.png']] });
  assert.equal(slide.prompt, '此历史案例未保存单图生成提示词。');
  assert.equal(slide.description, '此历史案例仅保留了图片，没有单图说明。');
});
