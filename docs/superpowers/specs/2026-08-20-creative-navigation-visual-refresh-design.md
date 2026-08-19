# Creative Navigation Visual Refresh

## Goal

Make the creative navigation feel like the front door of a professional visual-production product for ordinary users, while keeping the owner-only administration entry out of the public layout. The navigation must explain the four creation domains quickly, preserve the existing direct-launch behavior, and remain stable on desktop, keyboard, reduced-motion, and mobile paths.

## Product Decisions

- The top bar is centered against the public viewport, not against the owner-only action group. The admin action remains conditional on the owner role and does not reserve space for ordinary users.
- The left-side global rail returns as a persistent, icon-led quick switcher for the four creation domains. It is a complementary navigation surface, not a duplicate list of every child tool.
- The desktop mega panel is compact and content-led: a domain identity rail, a dense entry matrix, and a restrained visual signature area. It must size to its content and never create a large empty right half.
- Video remains one entry in the video domain. No video subcategories are introduced in this change.
- The four domains use a single icon grammar with domain-specific visual signatures: commerce uses a modular product frame, video uses a frame/play motif, content uses a page/annotation motif, and free visual uses a generative orbit motif. Existing icon components remain the source of accessible SVG paths; CSS supplies the domain-specific geometry and motion.
- Hover opens with intent, pointer movement from trigger to panel remains safe, click pins the panel, and Escape/outside click/focus departure closes it. The panel must not disappear while the pointer is crossing its bridge.

## Layout

Desktop:

```text
brand                 centered creative domains                 account actions
                         [commerce][video][content][visual][workspace]

left rail       ┌────── domain identity ──────┬──── entry matrix ────┬─ signature ─┐
                │ title / description / CTA   │ real launch targets │ visual mark │
                └─────────────────────────────┴───────────────────────┴─────────────┘
```

- The topbar uses a public-centered grid so the creative navigation remains visually centered whether admin controls exist or not.
- The side rail has four labeled-on-hover icon buttons, 44px minimum hit areas, an active indicator, and a non-blocking tooltip. It is hidden only at the mobile breakpoint where the drawer becomes the single navigation surface.
- The panel uses a fixed maximum width with content-sized columns and a minimum height derived from the longest domain. Each entry has a visible icon tile, title, short description, and a directional affordance.
- The signature area uses CSS geometry rather than a heavy image or canvas. It includes a domain glyph, a small orbit/grid/film/page pattern, and a subtle pointer-follow highlight that is disabled under reduced motion.

## Interaction Contract

- Hover intent delay: 120ms open, 320ms close.
- Pointer-safe bridge: the trigger-to-panel gap is covered by an invisible hit area.
- Click on a trigger pins its current panel. Clicking the same trigger closes it.
- Moving between top-level triggers swaps the panel without closing the menu.
- Keyboard: ArrowLeft/ArrowRight changes domains, Enter/Space toggles, ArrowDown enters the first item, Escape returns focus to the trigger.
- Mobile uses the existing drawer/accordion pattern with the same group metadata and no hover-only behavior.
- All new decorative layers are `aria-hidden`; real controls keep button semantics and existing launch actions.

## Visual Tokens

- Base: warm paper `#fbf8f3`, ink `#27231f`, muted copy `#83776d`.
- Domain accents: commerce violet `#7657e8`, video cyan `#2e9da8`, content coral `#e06b67`, visual pink `#d25cae`.
- Signature surfaces use low-alpha accent tints, 1px translucent borders, and a restrained 18px radius to match the existing glass shell.
- Typography increases top-level navigation to 13px with 760 weight and panel titles to 20px; descriptions remain compact and readable.

## Verification

- Add focused static tests for owner-only admin rendering, restored side navigation, all four domain signature classes, content-sized panel structure, and preserved video single-entry behavior.
- Run the focused navigation/XHS tests, `npm run check`, production build, and browser checks at desktop and 390px mobile widths.
- Verify no horizontal overflow, no panel occlusion, no disappearing panel across the pointer bridge, keyboard Escape/focus return, and reduced-motion behavior.

