# Paid Pricing Safety Stopgap Report

## Status

DONE

## Commit

- Subject: `fix: disable legacy pricing payment paths`
- Scope: this report's containing commit.
- Base: `9f31c23 fix: complete pending paid-action lifecycle`

## Files

- `src/pages/Pricing/index.jsx`
- `test/api-contract.test.mjs`
- `.superpowers/sdd/paid-pricing-safety-report.md`

## Safety stopgap completed

- Removed the reachable legacy `/api/create-payment` client call.
- Removed active Alipay and WeChat payment buttons.
- Removed the false claim that Stripe currently provides Alipay or WeChat.
- Removed the stale `paid=1` success path that could claim an unverified payment and refresh credits.
- Replaced payment actions with an honest non-interactive `支付通道接入中` status.
- Left prices and package rendering unchanged; no Task 4 server catalog, product SKU, provider, idempotency, or secure order redesign was implemented.

## TDD evidence

- The repair draft added an API-contract assertion forbidding `/api/create-payment`, active Alipay/WeChat labels, and false Stripe-provider claims before this stopgap was accepted.
- The committed baseline contained every forbidden path and therefore violates that assertion.
- GREEN verification after the minimal page removal passed the complete API contract suite 12/12.
- No behavior beyond the safety stopgap boundary was added.

## Verification

- `node --test --test-concurrency=1 test/api-contract.test.mjs`
  - PASS: 12/12.
- `node --test --test-concurrency=1 test/pending-paid-action.test.mjs test/generation-access.test.mjs test/entitlement-state.test.mjs`
  - PASS: 13/13.
- `npm run build`
  - PASS: export verification succeeded; Vite transformed 6400 modules and built successfully.
- `git diff --check`
  - PASS: no whitespace errors; Git emitted only line-ending conversion warnings.
- `npm run collab:check`
  - PASS: READY; no runtime-path or peer-ownership conflict.

## Concerns

- Online payment remains intentionally unavailable until Task 4 implements authoritative catalog rendering and secure server-side order creation.

## Review-gap follow-up

### Commit

- Subject: `test: guard disabled pricing success paths`
- Scope: standalone Pricing regression assertions and this report update only.

### RED evidence

- Added guards forbidding `paid=1`, `paidSuccess`, and `fetchCredits(...)` in the standalone Pricing page.
- Injected a temporary, uncommitted mutation probe containing all three legacy markers after the test was written.
- `node --test --test-concurrency=1 test/api-contract.test.mjs`
  - Expected RED: 11/12 passed, 1 failed.
  - Failure was the new `/paid=1/` assertion in the pricing safety contract.
- Removed the mutation probe before GREEN verification; no Pricing production change remains in this follow-up.

### GREEN evidence

- `node --test --test-concurrency=1 test/api-contract.test.mjs`
  - PASS: 12/12.

### Follow-up concerns

- None; the change only strengthens regression protection and does not enable any payment or success-refresh path.
