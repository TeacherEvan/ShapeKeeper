/**
 * ShapeKeeper runtime configuration.
 *
 * Loaded as a regular <script src="config.js"> (NOT inline) so the page
 * can be served with a strict Content-Security-Policy that disallows
 * 'unsafe-inline' for script-src. See vercel.json.
 *
 * window.CONVEX_URL — the Convex deployment the browser should connect to.
 *   For local development, override by setting window.CONVEX_URL in a
 *   separate <script> before this file, or by serving a different config.js
 *   on a different host.
 *
 * window.FEATURE_* — runtime feature flags. The runtime bridge in game.js
 *   copies window.FEATURE_* into the static FEATURE_FLAGS object. Setting
 *   a flag to false (e.g. window.FEATURE_LAVA_TIMER = false) before this
 *   file loads will opt that flag out for the rest of the session.
 */
(function configureShapeKeeper() {
    // Production backend. See README "Deployment" for the dev override path.
    if (typeof window.CONVEX_URL !== 'string' || window.CONVEX_URL.length === 0) {
        window.CONVEX_URL = 'https://precise-ladybug-504.convex.cloud';
    }
    if (typeof window.FEATURE_LAVA_TIMER !== 'boolean') {
        window.FEATURE_LAVA_TIMER = true;
    }
    if (typeof window.FEATURE_SYNC_RESILIENCE !== 'boolean') {
        window.FEATURE_SYNC_RESILIENCE = true;
    }

    // Paid unlock. Levels 1..19 are free; one purchase opens 20..100.
    // ON since 2026-10-29 (owner decision). Volume lane: R18 (~USD 1), the price
    // point chosen for quantity over margin. Paystack pays directly into the
    // owner's SA bank accounts, so no PayPal/Payoneer bridge is involved.
    // Amount in kobo, read by checkout.js before it opens the Paystack modal.
    if (typeof window.PAYSTACK_AMOUNT_KOBO !== 'number') {
        window.PAYSTACK_AMOUNT_KOBO = 1800;
    }
    if (typeof window.PAYWALL_ENABLED !== 'boolean') {
        window.PAYWALL_ENABLED = true;
    }
    // Public Paystack key is safe to ship. Set to pk_live_... for real payments;
    // while it is empty the gate keeps its buy button visibly disabled.
    if (typeof window.PAYSTACK_PUBLIC_KEY !== 'string') {
        window.PAYSTACK_PUBLIC_KEY = '';
    }
    // Enable the buy link only once a real public key has been configured.
    if (typeof window.UNLOCK_CHECKOUT_URL !== 'string') {
        window.UNLOCK_CHECKOUT_URL = window.PAYSTACK_PUBLIC_KEY ? '/checkout.html' : '';
    }
    if (typeof window.UNLOCK_PRICE_LABEL !== 'string') {
        window.UNLOCK_PRICE_LABEL = 'R18 (about $1) — once, every level';
    }
    // Convex HTTP actions are served from *.convex.site, NOT *.convex.cloud.
    if (typeof window.PAYSTACK_VERIFY_URL !== 'string') {
        window.PAYSTACK_VERIFY_URL = 'https://precise-ladybug-504.convex.site/paystack/verify';
    }
    if (typeof window.LICENSE_VALIDATE_URL !== 'string') {
        window.LICENSE_VALIDATE_URL = 'https://precise-ladybug-504.convex.site/license/validate';
    }

    // Optional tip jar. Every level is open; this never unlocks anything.
    // Replace with a Ko-fi / PayFast / Buy Me a Coffee URL when one exists.
    // Empty string disables the prompt entirely. The local page is a policy-safe
    // fallback until a real donation rail is connected.
    if (typeof window.DONATION_URL !== 'string') {
        window.DONATION_URL = 'donate.html';
    }
})();
