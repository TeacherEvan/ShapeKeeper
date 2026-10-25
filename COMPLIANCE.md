# Donation Compliance

**Status:** active
**Last reviewed:** 2026-10-25
**Applies to:** every ShapeKeeper deployment (Vercel, Capacitor, local)

This file records _why_ the donation surface is built the way it is. It is a
compliance record, not marketing copy. Change the donation flow and you change
this file in the same commit.

## Model

ShapeKeeper is **free to play, with all levels open**. Donations are voluntary
gifts. There is no paywall, no premium tier, no advertising, no affiliate link,
and no purchase flow anywhere in the app.

## Why the boundaries are where they are

Vercel's Fair Use Guidelines (last updated 14 September 2026) restrict the Hobby
plan to **non-commercial, personal use**, and define commercial usage as:

> "Any Deployment that is used for the purpose of financial gain of anyone
> involved in any part of the production of the project … Examples include …
> Any method of requesting or processing payment from visitors of the site."

The same guidelines carry exactly one relevant exception:

> **"Asking for Donations does not fall under commercial usage."**

The exemption covers _asking_. It does not plainly cover _processing_. Every
boundary below is therefore kept on the safe side:

| Rule                         | Implementation                                                                                                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Asking is allowed            | The prompt only asks for a voluntary gift.                                                                                                                                                                               |
| Never process payment in-app | The target is an **external link** opened in a new tab (`noopener,noreferrer`). No checkout, no card fields, no payment SDK. `mailto:` is the current fallback until a provider is chosen.                               |
| No consideration             | Donating unlocks **nothing**. All 100 levels are already open; no mode, effect, or achievement is gated.                                                                                                                 |
| No advertised reward         | The ask never mentions a reward, tier, perk, badge, or unlock.                                                                                                                                                           |
| Gratitude is not a purchase  | The 🧚 appears only **after** the player opens the donation page and explicitly confirms, or on a later visit from a confirmed donor. It is never offered as an incentive, never a tier, and changes nothing functional. |
| Nothing is inferred          | Donor status is set only by the explicit “I donated” confirmation, never by clicking the link.                                                                                                                           |
| No nagging                   | At most one prompt per 5 completed levels, dismissible, and it never blocks play.                                                                                                                                        |
| No dead buttons              | An empty `window.DONATION_URL` disables the prompt entirely.                                                                                                                                                             |

## What is deliberately _not_ in this app

- No embedded payment processor.
- No donation-gated content or "donate to unlock" behaviour.
- No donor-only gameplay perks or cosmetics.
- No server-side donor records: the only state is a local flag on the player's
  own device.

## Configuration

`window.DONATION_URL` in `config.js`. Leave it empty to disable the prompt.
Use a hosted page (Wise, Ko-fi, PayFast, Buy Me a Coffee). Never embed a
checkout in the app.

## Verification

- `tests/donation-prompt.test.js` — cadence, dismissal, donor confirmation,
  returning-donor gratitude, and the invariant that donating writes only the
  donation key (no level progress, no unlocks).
- `tests/e2e/donation-prompt.spec.js` — real dialog in a browser: ask → thanks →
  confirmation → gratitude on the next visit.

## Change log

- **2026-10-25** — Gratitude flow added: post-donation thank-you card, explicit
  donor confirmation, and a returning-donor gratitude variant. Ask copy
  unchanged; the 🧚 is never advertised.
