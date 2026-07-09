# 薯包AI · Design System

> 小红书爆款图文一键生成工具 · 一句话主题，秒出标题 + 种草文案 + 9 张配图。
> 设计语言：**活泼可爱 · 果冻 3D · 暖色渐变** — 把小红书爆款方法论，装进一只会卖萌的小薯包。

This is the design system for **薯包AI (Shubao AI)**, a consumer SaaS that turns a one-line topic into a ready-to-post Xiaohongshu (小红书 / RED) note — viral title, 种草 (seeding) body copy, hashtag set, and a 9-image carousel. The brand persona is **小薯包**, a kawaii coral-red potato-bag mascot with a green sprout, blush cheeks and sparkly eyes.

The look is deliberately **playful and tactile**: chunky rounded "jelly" surfaces, soft clay-like 3D depth, warm coral gradients, springy bounce on every interaction, and the mascot showing up everywhere with idle float animations. It should feel like the cheerful, high-energy world of a小红书 explore feed.

---

## Sources

This system was authored from materials the client provided. Explore them to go deeper:

- **GitHub (existing v1, reference only):** https://github.com/ludada960-afk/shubao
  A React + Vite + Express implementation of the product (`shubao-final.jsx`). It holds the full product requirements, information architecture (home / gallery / pricing / works / result), real Chinese product copy, the gallery sample notes, pricing tiers, and loading-stage flow. **This design system is a fresh visual direction, not a fork** — we kept the IA and copy voice but rebuilt the aesthetic (3D depth, gradients, motion, mascot-forward layouts) from scratch.
- **Reference product the client likes:** https://hy.ithinkai.cn/ (one-click Xiaohongshu generation).
- **Brand assets:** 1 logo lockup + app icon, and **26 mascot illustrations** (`uploads/*.png`), now in `assets/`.

> Readers with access can clone the repo to study the production data model, prompt flow, and API. Nothing here assumes you have it.

---

## CONTENT FUNDAMENTALS — how 薯包AI writes

The product lives and dies on小红书 copywriting, so the UI copy mirrors that voice.

**Voice & tone**
- **Warm, energetic, slightly breathless** — like a friend who just found something amazing. Liberal use of "真的"、"绝了"、"谁懂啊"、"会谢" and other小红书 vernacular *inside generated content*; the **product chrome** (buttons, nav, settings) stays clean and friendly, not slangy.
- **Address the user as 你**, refer to the product/mascot as 薯包 / 小薯包. First-person "我" appears only inside sample note bodies (the creator voice).
- **Short, punchy, scannable.** Headlines are 6–14 chars. Benefit-first. Numbers everywhere ("9 张配图"、"15 秒出稿"、"¥42 / 20套").

**Casing & punctuation**
- Chinese full-width punctuation in body copy; numerals and units are half-width with a hair space ("100 块"、"85 分"). Currency is `¥` glued to the number ("¥42").
- Product nouns stay in English where the brand uses them: "AI"、"Clean Fit"、"Dirty"、"PDD".

**Emoji** — **yes, intentionally.** Emoji are core to the小红书 aesthetic and appear in:
- generated note titles & bodies (🔥📍☕🛏️🧴 etc. — topical, 1 per line max),
- quick-hint chips and category cues.
They are **mostly absent from product chrome** (nav, primary buttons) — there we use the line-icon set and the mascot instead. Sparkle "✦" is used decoratively as a brand motif.

**Examples (real product strings)**
- Hero: *"一句话主题，秒出爆款图文"* · *"输入任意主题或素材，薯包 AI 自动识别赛道…"*
- CTA: *"一键生成爆款图文"* · *"一键同款"* · *"立即购买"*
- Loading stages: *"研读素材 → 撰写文案 → 生成配图 → 质量检查 → 打包完成"*, each with a mascot pose.
- Reassurance microcopy: *"新用户免费体验 1 套 · 无需信用卡"* · *"按套收费，不搞自动续费"*
- Tips (小红书冷知识): *"标题带数字的笔记，点击率平均高出 47%"*.
- Sample note title: *"反向旅游🔥这5个小县城比大理舒服100倍"*.

---

## VISUAL FOUNDATIONS

**Color**
- **Primary = 薯包 coral red** `--coral-500 #FF4757` with a full 50→900 ramp. This is THE brand color — primary buttons, links, active nav, hearts/likes, category accents.
- **Accents:** sprout green `--sprout-500` (success, the leaf), sunshine yellow `--sun-500` (sparkles, emphasis, secondary CTA), blush pink `--blush-300` (soft fills, the cheeks), grape `--grape-500` (cool counter-tone for "cool" content categories like学习/数码).
- **Neutrals are warm, cream-tinted** (`--ink-*`, never pure gray) on a cream page (`--cream #FFFAF9`). Pure black is never used; darkest text is `--ink-900 #2B1A1C`.
- **Gradients are a signature, not a decoration tax.** Warm coral transitions (`--grad-brand`, `--grad-coral`, `--grad-sunset`) fill primary buttons, note covers, stat numbers (via `.sb-grad-text`), and page backdrops (`--grad-spotlight`, a soft radial coral+sun wash). Per-category gradients tint gallery covers. Avoid blue/purple gradients except the deliberate grape accent.

**Type**
- **Display:** `ZCOOL KuaiLe` (站酷快乐体) — rounded, bubbly, matches the logo wordmark. Used for all headings and the mascot's "voice."
- **Latin / numerals:** `Fredoka` (rounded) for "AI", prices, stats.
- **Body / UI:** `Noto Sans SC` (思源黑体). Running Chinese text breathes at `line-height: 1.75`.
- Headlines are big and confident; body stays 13–16px. (See `tokens/typography.css`.) **Substitution note:** the brand has no licensed custom font — these are the closest Google Fonts matches to the hand-drawn logo. Loaded via CDN `@import`; swap for self-hosted `@font-face` before shipping fully-offline HTML.

**Shape & spacing**
- **Very rounded.** Default radii are chunky: cards `--r-lg (24)`, buttons `--r-md (18)`, pills everywhere (`--r-pill`), plus an organic `--r-blob` for mascot framing. Nothing is sharp.
- 4px spacing scale (`--sp-1 … --sp-12`). Generous padding; airy feeds.

**Depth & 3D** (the headline requirement)
- **Clay / jelly elevation, not flat material.** Cards use `--clay-raised` (inset top highlight + soft warm drop) so surfaces feel puffy and pressable. Inputs use `--clay-inset` wells.
- **3D buttons** have a colored bottom "edge" (`--btn-3d-coral`) that compresses on press — the button physically depresses. Primary CTAs also carry a coral `--glow-*`.
- A `--gloss` overlay adds a top-light sheen to gradient surfaces (covers, chips).
- Shadows are **warm-tinted** (`rgba(120,40,50,…)`), never neutral black.

**Motion & interaction**
- **Springy and bouncy.** Default easing is `--ease-spring` (overshoot). Cards **lift** on hover (`translateY(-6px)` + bigger shadow); buttons **lift then depress**; icons **rotate/scale** playfully on hover; mascots **float/bob** continuously (`sb-float`, `sb-bob`); sparkles **twinkle** (`sb-twinkle`).
- **Hover state** = lift + shadow grow + (often) slight rotate/scale and a tint shift toward the lighter brand step. **Press state** = depress (lose the 3D edge) and shrink shadow. **Focus** = coral ring (`--ring-brand`).
- Hover reveals on gallery covers (a "查看全套" chip pops in). All motion respects `prefers-reduced-motion`.

**Imagery**
- The brand has **no photography** — the mascot illustrations *are* the imagery. Two illustration styles coexist: a clean flat style (logo, wave, jump) and a richer shaded/sketchy style (superhero, welcome) — both warm, saturated, cheerful, with white/transparent backgrounds. Place mascots on gradient or cream; never on busy backgrounds.
- Gallery "covers" are **colored gradient panels with the mascot floating on top** (a stand-in for the user's eventual real images) — this keeps the demo on-brand without fake photos.

**Layout rules**
- Sticky glass nav (`backdrop-filter: blur`) with translucent cream bg.
- Centered, max-width content columns (`--w-content/--w-wide`); feeds are 3–4 col grids.
- The mascot anchors emotional moments: hero, empty states, loaders, modals, errors, success.

---

## ICONOGRAPHY

- **UI glyphs:** the brand uses **[Lucide](https://lucide.dev)** — 24px, 2px rounded-stroke line icons (Sparkles, Heart, Copy, Download, Refresh, Hash, Eye, Bookmark, Share, etc.). Matches the soft rounded geometry of the brand. The v1 codebase used `lucide-react`; for self-contained HTML we inline a small Lucide-style subset in `ui_kits/website/icons.jsx`. **To use more icons, pull from the Lucide CDN** (`https://unpkg.com/lucide@latest`) rather than hand-drawing — keep stroke width at 2 and corners rounded.
- **No custom icon font / SVG sprite** exists in the brand.
- **Emoji** double as "icons" inside generated content and category cues (see Content Fundamentals) — but not in chrome.
- **The mascot is the brand's true icon system** — prefer a mascot pose over an abstract icon for any emotional/empty/status moment. 26 poses are catalogued in `assets/` and via the `Mascot` component (`Mascot.POSES`).
- Decorative **sparkle "✦"** is the recurring brand motif (loaders, badges, accents).

---

## INDEX — what's in this folder

**Foundations**
- `styles.css` — the single entry point consumers link (`@import`s only).
- `tokens/colors.css` · `typography.css` · `spacing.css` · `effects.css` · `fonts.css` · `base.css` — design tokens (153 of them) and base element styles.

**Components** (`components/`) — React primitives, exposed on `window.AIDesignSystem_67568f`:
- `core/` — **Button** (3D jelly CTA), **Card** (clay surface / note cover), **Badge**, **Tag** (#hashtag), **Avatar**, **Mascot** (animated brand character).
- `forms/` — **Input** (input + textarea), **Switch**.
- Each has `.jsx` + `.d.ts` + `.prompt.md`, with a `*.card.html` specimen per group.

**UI Kit** (`ui_kits/website/`) — interactive recreation of the薯包AI site: hero generator → loading → Xiaohongshu note result → gallery → pricing, with login/recharge modals. Entry: `index.html`. Screens are factored into `Nav / HomeScreen / GalleryScreen / PricingScreen / ResultScreen` + `icons.jsx` + `data.js`.

**Specimen cards** (`guidelines/`) — the cards shown in the Design System tab (colors, gradients, type, spacing, radii, 3D depth, motion, logo, mascot gallery).

**Brand assets** (`assets/`) — `logo-icon.webp`, `logo-wordmark.webp`, and `mascot-*.webp` (26 poses). Optimized to WebP (~400px, ~7× smaller than the source PNGs) for fast feed loading; originals remain in `uploads/`.

**`SKILL.md`** — lets this folder be used directly as an Agent Skill.

---

*Want changes? See the bold ASK at the end of the build summary — color energy, motion intensity, and font pairing are the easiest knobs to turn.*
