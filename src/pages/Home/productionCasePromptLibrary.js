const PRODUCT_LOCK = '严格保持输入商品一致：珍珠白真无线入耳式耳机、香槟金金属装饰、圆角珍珠白充电盒；耳机与充电盒的结构、数量、颜色、材质和比例不得改变。';
const OUTPUT_LOCK = '高级真实电商摄影，奶白、暖金、浅灰配色，中文信息准确克制；不得出现品牌 Logo、价格、水印、虚构认证或未经提供的参数。';

export const EARBUD_SUITE_REPLAY_PROMPT = `${PRODUCT_LOCK} 生成一套统一、真实、可投放的商品主视觉、结构解析、人物佩戴、清晰通话与续航细节图，并编排为完整电商套图。${OUTPUT_LOCK}`;

export const EARBUD_DETAIL_PROMPTS = Object.freeze({
  'earbuds-suite-panel-identity': `${PRODUCT_LOCK} 生成 3:4 商品身份主视觉：完整打开的充电盒与两只耳机形成清楚尺度关系，柔和高调棚拍和香槟金光线建立高级感。${OUTPUT_LOCK}`,
  'earbuds-suite-panel-usage': `${PRODUCT_LOCK} 生成 3:4 自然佩戴使用图：成年女性在安静通勤环境中佩戴耳机，脸部、耳朵与完整耳机清晰可见，突出舒适与降噪使用感，不能只展示手部。${OUTPUT_LOCK}`,
  'earbuds-suite-panel-structure': `${PRODUCT_LOCK} 生成 3:4 声学结构解析图：用专业爆炸视图展示声学腔体、动圈与金属网孔，同时保留一只完整耳机用于结构对照。${OUTPUT_LOCK}`,
  'earbuds-suite-panel-scene': `${PRODUCT_LOCK} 生成 3:4 清晰通话场景：成年女性在真实会议或居家环境中佩戴耳机，人物、耳机与空间关系自然，脸部和佩戴状态清楚。${OUTPUT_LOCK}`,
  'earbuds-suite-panel-function': `${PRODUCT_LOCK} 生成 3:4 续航与佩戴详情图：完整充电盒、耳机和耳部佩戴细节共同解释便携充电与轻盈佩戴，不编造数字。${OUTPUT_LOCK}`,
});

export const EARBUD_COMPOSITE_REQUEST_KEY_V3 = 'showcase-20260815-earbuds-composite-v3';
export const EARBUD_USAGE_REQUEST_KEY_V4 = 'showcase-20260815-earbuds-model-usage-v4';

export const EARBUD_COMPOSITE_PROMPT_V3 = `[Goal]
Create one premium 4:3 ecommerce result board from the five supplied pearl-white and champagne-gold earbud detail panels. Preserve the exact earbud and charging-case structure, quantity, colors, materials, and proportions from the inputs.

[Composition]
Fill the canvas densely. Arrange four complete detail panels across the upper and middle field as a shallow directional fan, each with a restrained clockwise tilt and visible depth. Make the central panel dominant while keeping every panel readable and uncropped. Place one large open charging case and two complete loose earbuds in the lower foreground. Use a single champagne-gold light trail flowing from lower left to upper right to unify the motion.

[Typography]
At lower right, design two compact icon-and-type benefit lockups with the exact Chinese text “高效出图” and “专业排版”. Typography must feel intentionally designed, aligned with the tilt direction, legible, and secondary to the product.

[Visual system]
Premium realistic ecommerce photography, pearl white, warm champagne gold, and light gray; soft luminous depth, controlled reflections, crisp product edges, restrained shadows.

[Do not]
No large empty side margins, no upright equal-width panel row, no duplicated panels, no cropped product, no illegible text, no brand logo, no price, no watermark, and no unprovided specifications.`;

export const EARBUD_USAGE_PROMPT_V3 = `[Goal]
Create a premium 3:4 ecommerce usage portrait for the exact pearl-white and champagne-gold earbuds shown in the supplied references.

[Subject]
An adult East Asian woman in a quiet bright interior, framed from upper torso to head, with her face clearly visible and one ear turned slightly toward camera. The pearl-white earbud is visibly worn in her ear and its champagne-gold detail remains clear. Her expression is calm and natural.

[Composition and lighting]
Natural window light, refined warm-neutral wardrobe, realistic skin and hair, clean background depth. Make the face, ear, and worn earbud the visual focus. Keep comfortable margins without shrinking the subject.

[Do not]
Do not show only a hand, do not hide or crop the face, do not change the earbud structure or color, do not add extra earbuds, text, logos, watermarks, prices, or unprovided claims.`;
