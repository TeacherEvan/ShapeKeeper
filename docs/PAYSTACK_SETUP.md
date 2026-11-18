# ShapeKeeper payments — Paystack setup (South Africa)

Volume lane: **R18 once (~$1)** unlocks levels 20–100. Paystack pays directly into a
South African bank account — no PayPal/Payoneer bridge and no FX step. Fees:
2% on Capitec Pay / Ozow EFT (no fixed fee) or 2.9% + R1 on cards. Payouts are free.

## 1. Paystack account (owner does this — needs ID + bank details)

1. Register at <https://paystack.com> as a South African business (sole proprietor is fine).
2. Complete KYC: ID document, proof of address, and ONE settlement bank account
   (Standard Bank, ABSA, Capitec or FNB — all are supported).
3. Once approved, copy the **public key** (`pk_live_...`) and **secret key** (`sk_live_...`)
   from Settings → API Keys & Webhooks. Use `pk_test_`/`sk_test_` first while testing.

> Never paste the secret key into chat, a repo file, or config.js. It belongs only in
> the Convex deployment environment (step 2).

## 2. Convex environment (run in the ShapeKeeper repo)

```bash
cd ~/github/workspaces/ShapeKeeper
npx convex env set PAYSTACK_SECRET_KEY sk_live_XXXXXXXX      # or sk_test_ for testing
npx convex env set PAYSTACK_AMOUNT_KOBO 1800                # R18.00 — must match checkout
npx convex env set PAYSTACK_CURRENCY ZAR                     # default ZAR; both server paths check it
npx convex codegen
npx convex deploy
```

Verify the env vars landed: `npx convex env list` (shows names; values stay masked).

## 3. Publish the public key

Edit `config.js`, set:

```js
window.PAYSTACK_PUBLIC_KEY = 'pk_live_XXXXXXXX';   // or pk_test_ while testing
```

Do **not** put the secret key here — public keys are safe to ship, secret keys are not.

## 4. Webhook (refunds + authoritative success)

In Paystack dashboard → Settings → API Keys & Webhooks, add:

- **Webhook URL:** `https://precise-ladybug-504.convex.site/paystack/webhook`
- **Events:** `charge.success`, `charge.refunded`

The webhook signature is verified with HMAC-SHA512 against `PAYSTACK_SECRET_KEY`.

## 5. Deploy the site

```bash
npx vercel --prod
```

`vercel.json` already allows `js.paystack.co` in the CSP.

## 6. Test the whole loop

1. Set **test** keys in steps 2–3 and deploy.
2. Open `/checkout.html`, pay with Paystack's test card, and note the reference.
3. The page should display an `SK-XXXX-XXXX-XXXX-XXXX` key.
4. Open the game, reach the level-19 win screen, open the unlock gate, paste the key.
5. Levels 20+ should open. Refresh and confirm the key still validates.
6. Repeat step 2 with the same reference — the **same** key must come back (idempotency).

## 7. Go live

Swap `sk_test_`→`sk_live_` and `pk_test_`→`pk_live_`, redeploy Convex + Vercel,
and run one real R18 payment before sharing the link.

## How the entitlement works

- `POST /paystack/verify` calls Paystack's verify API server-side and checks all
  three: `status=success`, the exact amount (1800 kobo) AND the currency (ZAR).
  The webhook applies the same check. Then one licence is minted per reference.
- A SHA-256 hash of the key is stored in Convex `paystackLicences`; the game only
  ever sends the raw key to `POST /license/validate`, which answers `{valid}`.
- No public Convex query reads the licence table, so keys cannot be harvested.
- `charge.refunded` writes a refund tombstone BEFORE revoking, so a refund that
  arrives before the licence exists cannot be undone by an out-of-order
  `charge.success`. Validation then returns `{valid:false}`.
- Both server paths check amount **and currency**, so 1800 subunits of a cheaper
  currency cannot buy a full R18 licence.
- After payment the reference is kept in the URL fragment and sessionStorage (never
  a query string), so a refresh re-displays the same key without leaking it.
- This is honest-buyer enforcement, not DRM (documented in SECURITY.md).

## Fee comparison that drove this decision (per $1 sale)

| Route | Fee | You keep | Payout |
|---|---|---|---|
| Paystack (EFT/Capitec) | 2%, no fixed fee | ~98% | Direct to SA bank |
| Paystack (card) | 2.9% + R1 | ~92% | Direct to SA bank |
| itch.io | 2.9% + $0.30 + 10% | ~57% | PayPal/Payoneer bridge + FX |
| Lemon Squeezy | 5% + $0.50 (~55%) | ~44% | Bridge + FX |

Lemon Squeezy is still wired into `UnlockGate.js` as a fallback; it is simply far
too expensive at a $1 price point.
