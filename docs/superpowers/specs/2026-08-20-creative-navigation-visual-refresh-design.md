# Creative Navigation Visual Refresh

## Goal

Make the creative navigation feel like the front door of a professional visual-production product for ordinary users, while keeping the owner-only administration entry out of the public layout. The navigation must explain the four creation domains quickly, preserve the existing direct-launch behavior, and make every child entry feel like a deliberate visual tool rather than a numbered text row.

## Product Decisions

- The top bar is centered against the public viewport, not against the owner-only action group. The admin action remains conditional on the owner role and does not reserve space for ordinary users.
- The desktop panel is a centered, single-zone destination selector. The previous domain identity rail, large category mark, entry count, numbered markers, and duplicated start button are removed so the actual destinations carry the hierarchy.
- Video remains one entry in the video domain. No video subcategories are introduced in this change.
- Every child destination receives a semantic icon and a distinct motion signature: commerce suite layers separate, try-on content shifts into place, canvas framing expands, video film advances, content pages turn, and visual creation emits a restrained wand/spark response. Existing Phosphor icon components remain the source of accessible SVG paths; CSS supplies the domain-specific motion without adding a runtime animation dependency.
- Hover opens with intent, pointer movement from trigger to panel remains safe, click pins the panel, and Escape/outside click/focus departure closes it. The panel must not disappear while the pointer is crossing its bridge.

## Layout

Desktop:

```text
brand                 centered creative domains                 account actions
                         [commerce][video][content][visual][workspace]

                         +--------- centered viewport ---------+
                         |  选择创作方向                         |
                         |  [animated icon]  商品套图          -> |
                         |  [animated icon]  万物上身          -> |
                         |  [animated icon]  电商画布          -> |
                         +--------------------------------------+
```

- The topbar uses a public-centered grid so the creative navigation remains visually centered whether admin controls exist or not.
- The old left-side identity rail is removed from the expanded panel. The global side rail, where present elsewhere in the shell, remains a separate quick-switching surface and is not duplicated inside this panel.
- The panel uses a fixed maximum width, is horizontally centered against the viewport, and sizes to the longest destination list. Each entry is one full-width button with a visible semantic icon, title, short description, and directional affordance.
- The visual signature lives inside each entry icon. Idle icons are quiet; hover/focus changes the accent, reveals a layered highlight, and runs the destination-specific motion. No generic numbered marker or decorative right-side card is used.

## Interaction Contract

- Hover intent delay: 120ms open, 320ms close.
- Pointer-safe bridge: the trigger-to-panel gap is covered by an invisible hit area.
- Click on a trigger pins its current panel. Clicking the same trigger closes it.
- Moving between top-level triggers swaps the panel without closing the menu.
- Keyboard: ArrowLeft/ArrowRight changes domains, Enter/Space toggles, ArrowDown enters the first item, Escape returns focus to the trigger.
- Mobile uses the existing drawer/accordion pattern with the same group metadata and no hover-only behavior.
- All icon animation layers are `aria-hidden`; real controls keep button semantics and existing launch actions. Hover-only motion is scoped to `(hover: hover) and (pointer: fine)` and `prefers-reduced-motion: reduce` disables transforms and keyframes.

## Visual Tokens

- Base: warm paper `#fbf8f3`, ink `#27231f`, muted copy `#83776d`.
- Domain accents: commerce violet `#7657e8`, video cyan `#2e9da8`, content coral `#e06b67`, visual pink `#d25cae`.
- Destination rows use low-alpha accent tints, 1px translucent borders, and a restrained 18px radius to match the existing glass shell.
- Typography increases top-level navigation to 13px with 760 weight and panel titles to 20px; descriptions remain compact and readable.

## Verification

- Add focused static tests for owner-only admin rendering, centered single-zone panel structure, destination-specific icon/motion metadata, removal of numbered markers, and preserved video single-entry behavior.
- Run the focused navigation/XHS tests, `npm run check`, production build, and browser checks at desktop and 390px mobile widths.
- Verify no horizontal overflow, no panel occlusion, no disappearing panel across the pointer bridge, keyboard Escape/focus return, visible hover/focus motion, and reduced-motion behavior.
