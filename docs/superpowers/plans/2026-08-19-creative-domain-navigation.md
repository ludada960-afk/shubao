# Creative Domain Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the icon-only global navigation with a responsive creative-domain navigation that exposes direct creation entry points without changing generation or billing behavior.

**Architecture:** Add a focused `CreativeDomainNav` component with static navigation configuration and local open/scroll/mobile state. Wire existing AppContext actions through small navigation callbacks, render it from `App.jsx` for non-canvas pages, and remove the old four-item global SideNav. Keep the legacy unused `Navbar` untouched unless build or import analysis proves it is active.

**Tech Stack:** React 18, existing AppContext reducer, Lucide React, CSS media queries, native browser focus/keyboard events, existing Vite test/build scripts.

## Global Constraints

- Video navigation must expose only one `视频创作` entry; do not classify intelligent editing, first/last frame, or reference-video reconstruction in this menu.
- Do not modify server, billing, generation, canvas, or route contracts.
- Use existing navigation actions: `NAVIGATE`, `SET_MODE`, `OPEN_CANVAS`, `SET_LOGIN_INTENT`, and `SHOW_LOGIN`.
- Preserve the user-owned runtime changes listed in `RTK.md`; never stage runtime databases, uploads, `dist`, `.tmp`, or diagnostic files.
- Respect reduced motion, keyboard focus, 44px touch targets, and no horizontal overflow at 390px.

---

### Task 1: Navigation configuration and behavior tests

**Files:**
- Create: `src/components/layout/creativeDomainNavigation.js`
- Create: `test/creative-domain-navigation.test.mjs`

**Interfaces:**
- Produces `CREATIVE_NAV_GROUPS`, `getNavigationTarget(groupId, itemId)`, and `isNavigationGroupActive(groupId, state)`.
- Each item has `{ id, label, description, icon, target }`; each target is a serializable action descriptor or a callback key consumed by the component.

- [ ] **Step 1: Write failing tests** for the five groups, the single video item, the free-visual item labels, and active-state mapping.
- [ ] **Step 2: Run `npm test -- --runInBand test/creative-domain-navigation.test.mjs` and confirm failure because the module does not exist.**
- [ ] **Step 3: Implement the static configuration and pure helpers with no React or side effects.**
- [ ] **Step 4: Run the focused test and confirm all assertions pass.**
- [ ] **Step 5: Commit the configuration and test as `feat: define creative domain navigation model`.**

### Task 2: Desktop navigation component

**Files:**
- Create: `src/components/layout/CreativeDomainNav.jsx`
- Modify: `src/App.jsx`
- Modify: `src/styles/app-shell.css`
- Test: `test/creative-domain-navigation.test.mjs`

**Interfaces:**
- `CreativeDomainNav` consumes `state` and `dispatch` from `useApp`.
- It renders `nav.app-creative-nav`, a desktop trigger row, and a menu panel with `aria-expanded`/`aria-controls`.

- [ ] **Step 1: Extend the focused tests with the required DOM contract strings and keep them failing for the missing component.**
- [ ] **Step 2: Implement the component with 80ms open and 180ms close timers, outside-pointer close, click-to-navigate, and existing login intent behavior.**
- [ ] **Step 3: Add the desktop material layer, active states, menu columns, focus styles, and no-layout-shift compressed state.**
- [ ] **Step 4: Replace `SideNav` rendering in `App.jsx` with `CreativeDomainNav`; do not render it for `ec-canvas`.**
- [ ] **Step 5: Run focused tests, `npm run check`, and `npm run build`.**
- [ ] **Step 6: Commit as `feat: add creative domain mega navigation`.**

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

### Task 4: Browser verification and cleanup

**Files:**
- Modify: `docs/superpowers/specs/2026-08-19-creative-domain-navigation-design.md` only if verification reveals a contract correction.
- Modify: `.superpowers/sdd/progress.md` with the verified commit and residual risks.

**Interfaces:**
- No production interface changes; this task verifies the existing navigation destinations and visual states.

- [ ] **Step 1: Start the Vite dev server on an available port and open the homepage in a browser.**
- [ ] **Step 2: Verify desktop default, hover/open menu, direct click navigation, scroll compression, outside close, and canvas exclusion.**
- [ ] **Step 3: Verify 390px drawer, accordion, fixed bottom action, Escape close, no horizontal overflow, and console error count.**
- [ ] **Step 4: Run `npm test`, `npm run check`, `npm run build`, and `git diff --check`.**
- [ ] **Step 5: Record exact test/build evidence and remaining risks in the progress ledger; do not deploy without explicit request.**
