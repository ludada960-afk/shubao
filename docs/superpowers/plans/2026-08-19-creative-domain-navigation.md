# Creative Domain Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fragile hover-only creative-domain navigation with a responsive, layered navigation viewport that exposes direct creation entry points without changing generation or billing behavior.

**Architecture:** Keep the static navigation configuration and AppContext wiring, but render the desktop panel through a `document.body` portal with viewport coordinates derived from the active trigger. Hover/focus previews a group, clicking a top-level trigger pins the panel open, and clicking a child entry performs navigation. A transparent bridge and pointer-aware close timer make the trigger and panel one continuous interaction surface. Mobile remains an accordion drawer.

**Tech Stack:** React 18, existing AppContext reducer, Lucide React, CSS media queries, native browser focus/keyboard events, existing Vite test/build scripts.

## Global Constraints

- Video navigation must expose only one `视频创作` entry; do not classify intelligent editing, first/last frame, or reference-video reconstruction in this menu.
- Do not modify server, billing, generation, canvas, or route contracts.
- Use existing navigation actions: `NAVIGATE`, `SET_MODE`, `OPEN_CANVAS`, `SET_LOGIN_INTENT`, and `SHOW_LOGIN`.
- Preserve the user-owned runtime changes listed in `RTK.md`; never stage runtime databases, uploads, `dist`, `.tmp`, or diagnostic files.
- Respect reduced motion, keyboard focus, 44px touch targets, and no horizontal overflow at 390px.
- A top-level domain click only opens or pins its panel; it never navigates directly to the first child.
- The desktop panel must not be positioned inside a trigger slot or depend on the home page stacking context.
- The panel closes on outside pointer interaction, Escape, or focus leaving the navigation; moving from trigger to panel keeps it open.

---

### Task 1: Navigation interaction regression contract

**Files:**
- Create: `src/components/layout/creativeDomainNavigation.js`
- Create: `test/creative-domain-navigation-interaction.test.mjs`

**Interfaces:**
- Produces source-level contracts for a portal-backed viewport and explicit top-level click semantics.

- [ ] **Step 1: Write failing tests** for `createPortal`, a fixed `.creative-nav-viewport`, pointer enter/leave retention, outside pointer close, and a trigger click that calls `toggleDesktopGroup` instead of `runTarget`.
- [ ] **Step 2: Run `node --test test/creative-domain-navigation-interaction.test.mjs` and confirm the old implementation fails these contracts.**
- [ ] **Step 3: Keep the existing static configuration unchanged and implement the interaction contract in the component and shell CSS.**
- [ ] **Step 4: Run the focused test and confirm all assertions pass.**
- [ ] **Step 5: Commit the interaction regression contract and implementation as `fix: stabilize creative navigation viewport interaction`.**

### Task 2: Desktop viewport and trigger behavior

**Files:**
- Create: `src/components/layout/CreativeDomainNav.jsx`
- Modify: `src/App.jsx`
- Modify: `src/styles/app-shell.css`
- Test: `test/creative-domain-navigation.test.mjs`

**Interfaces:**
- `CreativeDomainNav` consumes `state` and `dispatch` from `useApp`.
- It renders `nav.app-creative-nav`, a desktop trigger row, and a menu panel with `aria-expanded`/`aria-controls`.

- [ ] **Step 1: Render the active group with `createPortal(..., document.body)` inside `.creative-nav-viewport` and place it from the active trigger's `getBoundingClientRect()`.
- [ ] **Step 2: Add a `toggleDesktopGroup` click handler that pins an open group and leaves child actions in `runTarget`.
- [ ] **Step 3: Add a 260ms pointer-retention timer, a transparent bridge between trigger and panel, and document-level outside pointer/focus close.
- [ ] **Step 4: Raise the topbar stacking layer and make the default/open/active states visually explicit without shifting the page layout.
- [ ] **Step 5: Run focused tests, `npm run check`, and `npm run build`.**
- [ ] **Step 6: Commit as `fix: stabilize creative navigation viewport interaction`.**

### Task 3: Mobile drawer and accessibility behavior

**Files:**
- Modify: `src/components/layout/CreativeDomainNav.jsx`
- Modify: `src/styles/app-shell.css`
- Test: `test/creative-domain-navigation.test.mjs`

**Interfaces:**
- The same component switches to a drawer at 640px and exposes a close button, accordion groups, and fixed bottom action.

- [ ] **Step 1: Add tests for `aria-expanded`, Escape close, one-open-group accordion state, and the single video item.**
- [ ] **Step 2: Implement native key handling for Enter/Space, ArrowUp/ArrowDown, Home/End, and Escape without moving focus on ordinary hover.**
- [ ] **Step 3: Add the responsive drawer, backdrop, body scroll lock, touch target sizing, reduced-motion overrides, and focus-visible outlines.**
- [ ] **Step 4: Run focused tests and full `npm test`.**
- [ ] **Step 5: Commit as `feat: make creative navigation mobile accessible`.**

### Task 4: Browser verification and production release

**Files:**
- Modify: `docs/superpowers/specs/2026-08-19-creative-domain-navigation-design.md` only if verification reveals a contract correction.
- Modify: `.superpowers/sdd/progress.md` with the verified commit, production release, and residual risks.

**Interfaces:**
- No production interface changes; this task verifies the existing navigation destinations and visual states.

- [ ] **Step 1: Start the Vite dev server on an available port and open the homepage in a browser.**
- [ ] **Step 2: Verify desktop default, hover/open menu, direct click navigation, scroll compression, outside close, and canvas exclusion.**
- [ ] **Step 3: Verify 390px drawer, accordion, fixed bottom action, Escape close, no horizontal overflow, and console error count.**
- [ ] **Step 4: Run `npm test`, `npm run check`, `npm run build`, and `git diff --check`.**
- [ ] **Step 5: Record exact test/build evidence and remaining risks in the progress ledger.**
- [ ] **Step 6: Run `scripts/deploy-production.ps1 -ValidationProfile full -CanarySeconds 600 -PublicWarmupSeconds 180` and wait for health, real ecommerce, video contract, billing, and canary evidence before reporting success.**
