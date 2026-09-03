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
})();
