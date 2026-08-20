# Creative Navigation Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current split mega-panel with a centered destination selector whose child buttons use semantic, high-signal hover/focus motion.

**Architecture:** Keep the existing portal, pointer bridge, click pinning, keyboard handling, mobile drawer, and navigation actions. Replace the desktop panel's two-column intro/link layout with a single destination list. Store semantic icon and motion metadata beside each navigation item, render the existing Phosphor SVG icon inside each button, and use CSS keyframes scoped to the matching motion class. No new runtime animation dependency is introduced.

**Tech Stack:** React 18, existing AppContext actions, `@phosphor-icons/react`, Lucide React for utility controls, CSS keyframes/media queries, Node test runner, Vite.

## Global Constraints

- Video navigation must expose only one `视频创作` entry.
- Do not modify server, billing, generation, canvas, route, or production deployment contracts.
- The panel must be horizontally centered against the viewport and must not retain the old left identity rail or numbered child markers.
- Every child destination must render a semantic icon and a distinct hover/focus motion class.
- Motion must be visible on fine hover devices, usable on keyboard focus, touch-safe, and disabled by `prefers-reduced-motion: reduce`.
- Preserve click pinning, pointer bridge retention, Escape/outside close, arrow-key navigation, mobile accordion behavior, and direct-launch actions.
- Do not stage user-owned runtime files, `dist`, `.tmp`, uploads, databases, or diagnostic artifacts.

---

### Task 1: Lock the new navigation contract

**Files:**
- Modify: `src/components/layout/creativeDomainNavigation.js`
- Modify: `test/creative-domain-navigation-interaction.test.mjs`
- Modify: `test/app-shell-contract.test.mjs`

**Interfaces:**
- Navigation items gain `icon` and `motion` metadata consumed by `CreativeDomainNav`.
- Existing `action`, `launch`, group IDs, and single video item remain unchanged.

- [ ] **Step 1: Add failing assertions** for centered single-zone structure, no `creative-nav-panel-intro`, no `creative-nav-link-index`, semantic item metadata, and one video item.
- [ ] **Step 2: Run the focused tests and verify the old panel contract fails.**
- [ ] **Step 3: Add stable icon and motion metadata for every destination without changing actions.**
- [ ] **Step 4: Run the focused tests and verify the data contract passes.**
- [ ] **Step 5: Commit only the navigation data and test contract.**

### Task 2: Render destination buttons with semantic motion

**Files:**
- Modify: `src/components/layout/CreativeDomainNav.jsx`

**Interfaces:**
- `CreativeDomainNav` consumes `item.icon` and `item.motion` and renders one full-width button per destination.
- `runTarget(groupId, itemId)` remains the only launch path for child buttons.

- [ ] **Step 1: Replace the two-column panel render with a centered heading and destination list.**
- [ ] **Step 2: Map the metadata to Phosphor icon components and render the icon with `aria-hidden`.**
- [ ] **Step 3: Keep the existing pointer bridge, pinning, focus movement, Escape behavior, and mobile drawer unchanged.**
- [ ] **Step 4: Run focused component-contract tests and inspect the diff for unrelated action changes.**
- [ ] **Step 5: Commit the JSX behavior independently.**

### Task 3: Implement visible, restrained motion and centered layout

**Files:**
- Modify: `src/styles/app-shell.css`

**Interfaces:**
- Desktop `.creative-nav-panel` is a centered single-zone surface.
- `.creative-nav-link--layers`, `.creative-nav-link--tryon`, `.creative-nav-link--canvas`, `.creative-nav-link--film`, `.creative-nav-link--pages`, `.creative-nav-link--camera`, `.creative-nav-link--magic`, and `.creative-nav-link--workspace` provide distinct motion signatures.

- [ ] **Step 1: Remove the old intro/grid/index/signature layout rules from the desktop panel.**
- [ ] **Step 2: Add stable icon-stage dimensions, row hover/focus states, accent highlights, and per-motion keyframes.**
- [ ] **Step 3: Scope keyframes to fine hover/focus-capable devices and add reduced-motion overrides.**
- [ ] **Step 4: Add responsive tablet/mobile rules with no horizontal overflow and 44px minimum targets.**
- [ ] **Step 5: Run CSS contract tests, `npm run check`, and `npm run build`.**
- [ ] **Step 6: Commit the visual implementation.**

### Task 4: Browser verification and release gate

**Files:**
- Modify: `.superpowers/sdd/progress.md` with evidence only.

- [ ] **Step 1: Verify desktop ecommerce, video, content, visual, and workspace panels at 1440px.**
- [ ] **Step 2: Verify hover/focus motion is visually visible, pointer bridge retention works, click pinning works, and panel is centered.**
- [ ] **Step 3: Verify 390px mobile drawer, touch-safe behavior, reduced-motion CSS, Escape close, and no horizontal overflow.**
- [ ] **Step 4: Run full tracked tests, `npm run check`, `npm run build`, and `git diff --check`.**
- [ ] **Step 5: Since this change is limited to navigation JSX/data/CSS, use the automatic frontend validation profile; do not trigger the real ecommerce generation gate unless release scope classification reports a server/ecommerce change.**
- [ ] **Step 6: Deploy only through `scripts/deploy-production.ps1`, then verify public health, bundle, gallery/video contracts, billing, and the 600-second Canary.**
