# Monetisation Compliance — ShapeKeeper

**Status:** active
**Last reviewed:** 2026-10-29
**Applies to:** every ShapeKeeper deployment (Vercel, Capacitor, local)

This file records _why_ the money surfaces are built the way they are. It is a
compliance record, not marketing copy. Change a money flow and you change this
file in the same commit — the same rule `COMPLIANCE.md` has carried since the
donation edition, applied now to a store that actually sells something.

**Design source of truth:** `SECURITY.md` (trust model) and `src/ui/UnlockGate.js`
(implementation). This file explains the *boundaries*; it does not restate the code.

## Model

ShapeKeeper is **free to play from level 1 to level 19**. Levels **20–100** are
opened by **one paid unlock**, bought once and held per device. No subscription,
no recurring charge, no advertising, no affiliate link.

Payment is **never processed inside the app**: the unlock button opens an external
checkout in a new tab (`noopener,noreferrer`). The app never handles card data.

## The entitlement, honestly described

- A licence key is validated against the seller's own licence endpoint
  (`POST /v1/licenses/validate`, Lemon Squeezy's documented Licence API). A key
  the seller reports invalid never sets the entitlement.
- The **raw key is kept in localStorage** (`shapekeeper_license.v1`) so the unlock
  can be re-validated after a refund. This is a deliberate trade-off, documented in
  `SECURITY.md`: the gate is **honest-buyer enforcement, not DRM**, and a local
  game can always be edited by its owner. It is stated here because a reader of
  the repository deserves to know it before selling anything.
- **Consequence to be honest about:** until a server-side entitlement exists, a
  refund only takes effect when the player next re-validates. The server-truth
  path (`convex/entitlements.ts` — hash + instance id, never the key) is the
  planned increment; it is not live.
- `convex/entitlements.ts` is present but **nothing writes to it yet**: the
  Lemon Squeezy webhook relay that records a paid order does not exist.

## Rules (each one binds the code)

| Rule | Implementation |
| --- | --- |
| Free tier is real | Levels 1–19 open to everyone, forever, no account, no prompt. |
| One payment, whole set | The unlock opens 20–100 together. No per-level purchase, no second tier. |
| Never process payment in-app | The CTA opens an **external** link in a new tab. No checkout, no card fields, no payment SDK in the bundle. |
| Existing players are grandfathered | A save that already reached past level 19 stays entitled (`unlockedLevel > FREE_LEVELS \|\| highestCompleted > FREE_LEVELS`). The 2026 donation edition promised all 100 levels; nobody loses access. |
| Fail closed | An unreadable or invalid key never sets the entitlement. |
| No dead buttons | `UNLOCK_CHECKOUT_URL` empty ⇒ the gate shows the price and says the store is not yet open, and renders **no buy button**. |
| Donations unlock nothing | The tip jar (`donate.html`) is separate and grants no content. |
| Gratitude is not a purchase | The 🧚 appears only after the player opens the donation page and confirms. |
| Nothing is inferred | Donor status comes only from the explicit "I donated" confirmation. |
| No nagging | At most one donation prompt per 5 completed levels, dismissible, never blocking play. |
| Price is stated in the store's currency | `ZAR 129.00` — the Lemon Squeezy store's currency is ZAR. Showing a USD figure to a ZAR store is a false price, not a translation. |

## Hosting: Hobby is not enough

Vercel's Fair Use Guidelines restrict the **Hobby** plan to non-commercial,
personal use, and list commercial usage as including *"any method of requesting or
processing payment from visitors of the site."* The only relevant carve-out is
*asking* for donations.

**Selling the level unlock is commercial usage.** ShapeKeeper must run on a
**Pro** plan (or another host) before `UNLOCK_CHECKOUT_URL` is pointed at the
live checkout. Their stated remedy for a breach is a paused deployment.
Re-verify the wording before going live — it is live policy, not a constant.

## Configuration

| Key | File | Effect |
| --- | --- | --- |
| `window.PAYWALL_ENABLED` | `config.js` | `true` = gate active. `false` = every level open (local/demo only). |
| `window.UNLOCK_CHECKOUT_URL` | `config.js` | External checkout. **Empty until the store is approved.** |
| `window.UNLOCK_PRICE_LABEL` | `config.js` | Price text, in the store's currency. |
| `window.LICENSE_VALIDATE_URL` | `config.js` | The seller's licence endpoint. |
| `window.DONATION_URL` | `config.js` | Tip jar target. Empty disables the prompt. |

The **price is set on the storefront**; the label in `config.js` mirrors it and
must match the store's currency.

## Store state (verified 2026-10-29, PM desk, live dashboard)

- Account: **LeBotha** (renamed from `PicKaBoo`).
- Active store: **#474582** — holds the ShapeKeeper rail.
- Archived stores: **#474579** (`lebotha-archive-1`), **#474581** (`lebotha-archive-2`).
- Product `1361446` (Shapekeeper) at **ZAR 129.00**; variant `2126128`; licences on;
  activation limit 3.
- No webhooks remain on any store; the fulfilment relay is not wired.

## Verification

- `tests/levels-progress.test.js` — free ceiling, gating above `FREE_LEVELS`,
  progression capping, grandfathering of existing saves.
- `tests/unlock-gate.test.js` — the flag, the licence validation, the local record.
- `tests/donation-prompt.test.js` — donation cadence and that donating unlocks nothing.

## Change log

- **2026-10-29** — Paid edition: levels 1–19 free, 20–100 behind one unlock
  (`FREE_LEVELS = 19`); existing saves grandfathered; price label corrected to the
  store's currency (ZAR); Vercel **Pro** required before the checkout link goes live.
- **2026-10-25** — Gratitude flow added: post-donation thank-you card, explicit
  donor confirmation, returning-donor gratitude variant.
