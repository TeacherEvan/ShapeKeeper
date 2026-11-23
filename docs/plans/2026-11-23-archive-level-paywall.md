# Archive the level payment lock (2026-11-23)

## Decision

The payment platform is not ready. The level gate is **archived, not deleted**:
`config.js` now ships `window.PAYWALL_ENABLED = false`, so levels 1–100 are all
playable. Every gate module, checkout handler, Convex verify action and e2e
spec remains in the repository so the lock can be reapplied with a config
change once a real payment rail is live.

## What changed

- `config.js` — default `PAYWALL_ENABLED` flipped `true` → `false`, with an
  archive note. Paystack amount/key/verify URLs are left intact but inert.
- `tests/config-paywall.test.js` — regression gate for the archived default.
- `tests/e2e/paywall-level-gate.spec.js` — the two gated-path tests now force
  the flag on with `addInitScript`; the "all levels open" test uses the shipped
  default instead of overriding it.
- `AGENTS.md` — Levels invariant updated to describe the archived state.

## How to reapply

1. Configure a valid Paystack public key in `config.js`
   (`window.PAYSTACK_PUBLIC_KEY = 'pk_live_…'`) and verify it with a test
   initialize call. The 24-hex values seen in the dashboard screenshot were
   rejected; real keys are 40 hex.
2. Set `window.PAYWALL_ENABLED = true` in `config.js` (or in an overriding
   deployment config loaded before it).
3. Confirm `window.UNLOCK_CHECKOUT_URL` resolves to `/checkout.html`; it is
   derived from the public key and stays empty while the key is empty.
4. Run `npx vitest run tests/config-paywall.test.js` — it will fail by design
   once the flag is on; remove or invert that archived-default gate as part of
   the reapply commit.
5. Run `npm run test:e2e -- tests/e2e/paywall-level-gate.spec.js` and the full
   repo quality gates before shipping.

## Non-goals

- No paywall/convex handler files were deleted.
- No save data or entitlement logic was migrated; grandfathering of saves past
  level 19 remains as documented in `AGENTS.md`.
- No deployment or push was performed.
