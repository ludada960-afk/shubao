# Creative Navigation Hierarchy Refresh

Date: 2026-08-20

## Decision

Use a two-zone navigation panel built around one visual anchor and a readable text-first entry list. The panel must help a user choose a destination before it expresses product personality.

## Information hierarchy

- The top bar keeps the five creative domains and their labels.
- Each open panel has one domain anchor and one primary action.
- Destination links are numbered text rows with a title, short description, and directional affordance.
- Decorative visual treatment must not create a second competing click target.
- Video creation stays a single destination until the product has additional video categories.

## Interaction

- Preserve hover intent, the pointer bridge between trigger and panel, click-to-pin, Escape, arrow-key navigation, and mobile accordion behavior.
- Use motion for state feedback: panel entrance, active row emphasis, directional arrow movement, and a very small pointer-follow response on the single visual anchor.
- Do not move labels or hit areas under pointer-follow transforms.
- Respect `prefers-reduced-motion` and keep the panel usable without hover.

## Visual system

- Remove the current three-column decorative signature card.
- Increase panel padding, row height, and column separation so the menu reads as an intentional composition rather than a compressed card grid.
- Use the existing Phosphor icon dependency for a more expressive domain mark, but do not repeat icons on every destination row.
- Keep the owner-only admin action out of the navigation layout calculation; the creative navigation remains centered independently.

## Verification

- Cover the data contract and interaction contract with focused tests.
- Verify desktop hover-to-panel movement, pinned click state, keyboard navigation, outside close, and mobile accordion behavior.
- Verify reduced-motion CSS and production build before deployment.
