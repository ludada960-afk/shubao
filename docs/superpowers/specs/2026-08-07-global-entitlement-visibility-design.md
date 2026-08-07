# Global Entitlement Visibility Design

Date: 2026-08-07

Status: Approved for implementation

## Goal

Make the signed-in account's available AI credits visible before any billable
action, with identical values and refresh behavior on the homepage and
infinite canvas. Packages remain a purchase mechanism, not a substitute for
the available balance.

## Product Decision

Use one compact, reusable account-entitlement control in the two application
shells:

- `TopBar` serves every non-canvas page, including the homepage, works, and
  pricing pages.
- `CanvasTopBar` serves the infinite canvas.

The control shows the authoritative `ecPoints` balance, labels it `AI 积分`,
and has three distinct actions:

1. click the balance area to manually refresh;
2. click `购买额度` to open the existing pricing flow;
3. show `登录后查看额度` when signed out, which opens the existing login flow.

Unlimited access is rendered as `无限额度`, never as a numeric zero or a
locally invented balance. A loading state is rendered while the authoritative
balance is being refreshed. A refresh failure keeps the last known balance and
offers an explicit retry without changing billable behavior.

## Architecture

Create a presentational `AccountEntitlementControl` component with no billing
calculation and no local deduction. It consumes `logged`, `ecPoints`,
`unlimited`, an `isRefreshing` signal, plus callbacks for refresh, pricing,
and login. Its only source of truth remains `AppContext.refreshBillingBalance`,
which already guards against stale responses after account switching.

`AppContext` gains explicit balance-refresh state so all renderers describe
the same pending and error states. It refreshes on successful authentication,
existing generation/payment completion paths, and user-triggered refreshes;
the control additionally refreshes on first mount and when the document
returns to the foreground. It does not poll continuously and does not make a
client-side balance mutation.

`TopBar` and `CanvasTopBar` compose the shared control. The current `套餐`
buttons are renamed to `购买额度` and remain commands that open the existing
pricing modal. On narrow screens, the canvas control remains visible as a
compact icon-plus-value control; secondary labels may collapse but the balance
and its accessible name remain present.

## State and Error Rules

- The account sees a value only from the last server-confirmed entitlement.
- A pending refresh never resets a known balance to zero.
- Failed refresh leaves the known value visible and exposes retry via the same
  control; it does not show an error as an empty balance.
- Signed-out users cannot see a synthetic balance. The control opens login.
- A session change invalidates in-flight refreshes through the existing request
  epoch gate, so another account's balance cannot flash in the UI.
- Pricing and insufficient-balance flows continue to use existing server-side
  quotes and billing settlement. This feature does not alter prices, holds, or
  settlement semantics.

## Visual and Interaction Rules

- Account balance is a quiet operational control, not a decorative marketing
  badge. It stays adjacent to `购买额度` in both shell headers.
- The control has a stable width suitable for `999999` credits and an unlimited
  label, so refreshes do not shift nearby canvas commands.
- Refresh uses the familiar refresh icon and is described through a tooltip and
  `aria-label`; purchase remains an icon-plus-text command.
- Homepage and other non-canvas pages inherit the same state from `TopBar`.
- Canvas presentation uses the existing canvas topbar density and responsive
  CSS, retaining export and new-generation commands without overlap.

## Verification

Automated coverage must prove:

- the display formats numeric and unlimited entitlements without client-side
  unit conversion errors;
- the control contains accessible refresh, purchase, and login behavior;
- both `TopBar` and `CanvasTopBar` render the same shared control;
- signed-in headers request an authoritative refresh while signed-out headers
  do not;
- pending and failed refresh states preserve the last confirmed balance;
- mobile canvas layout keeps balance, export, and new-generation commands
  reachable without horizontal overflow.

Browser acceptance covers desktop `1440x1000` and mobile `390x844`, signed-in
and signed-out states, manual refresh, the purchase modal, canvas navigation,
and a post-generation balance refresh. Production release continues through
`scripts/deploy-production.ps1` with existing health, billing, ecommerce
generation, Canary, and public-audit gates.

## Non-Goals

- Adding a new payment provider or changing package prices.
- Exposing local browser cache as a balance source.
- Continuously polling the billing API.
- Changing how holds, settlement, refund, or task retries work.
