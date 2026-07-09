---
name: shubao-design
description: Use this skill to generate well-branded interfaces and assets for 薯包AI (Shubao AI), the Xiaohongshu 爆款 image-text one-click generator — for production or throwaway prototypes/mocks. Contains brand guidelines, colors, type, fonts, the mascot illustration set, and reusable UI kit components. The aesthetic is playful, kawaii, jelly-3D, warm-coral-gradient.
user-invocable: true
---

# 薯包AI Design System — Skill

Read **README.md** in this skill first — it holds the full brand context, content voice, visual foundations, iconography, and a file index. Then explore the other files.

## Quick orientation
- **Tokens:** link `styles.css` (it `@import`s `tokens/*.css`). Use the CSS custom properties — coral ramp (`--coral-*`), gradients (`--grad-brand/coral/sunset`), warm inks (`--ink-*`), clay/3D shadows (`--clay-raised`, `--btn-3d-coral`, `--glow-coral`), springy motion (`--ease-spring`) and keyframes (`sb-float`, `sb-pop-in`, `sb-twinkle`).
- **Components:** React primitives in `components/` (Button, Card, Badge, Tag, Avatar, Mascot, Input, Switch). Read each `.prompt.md` for usage. In built HTML they live on `window.AIDesignSystem_67568f` after loading `_ds_bundle.js`.
- **Brand:** the coral potato mascot 小薯包 in `assets/mascot-*.webp` (26 poses) + logo. Use a mascot pose for every emotional / empty / loading / error / success moment.
- **UI kit:** `ui_kits/website/` is a full clickable recreation of the product — copy it as a starting point for product screens.

## How to work
- **Visual artifacts** (slides, mocks, throwaway prototypes): **copy the assets you need out** (mascots, logo) into your output folder and write static, self-contained HTML the user can open. Reference `styles.css` or inline the token values.
- **Production code:** copy assets and follow the rules here to design fluently in-brand.
- Stay on-voice: warm, energetic小红书 copy in content; clean friendly chrome; emoji in content not chrome; numbers and benefits up front.
- Lean into the brand's signatures: **warm coral gradients, chunky rounded jelly surfaces, soft 3D depth, springy hover/press motion, mascot everywhere.** Avoid blue/purple gradients, flat material shadows, sharp corners, pure-gray neutrals.

If invoked with no other guidance, ask the user what they want to build, ask a few focused questions, then act as an expert 薯包AI designer who outputs HTML artifacts *or* production code as needed.
