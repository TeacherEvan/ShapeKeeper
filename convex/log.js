/**
 * Debug logging helpers for the Convex backend.
 *
 * Production deployments should NOT log roomId / sessionId / playerName
 * to stdout (Convex forwards stdout to the dashboard, and accidental
 * log forwarders — Sentry, Datadog, etc. — would leak PII). The helpers
 * here gate console output behind a CONVEX_DEBUG env var.
 *
 * The default is OFF. Set CONVEX_DEBUG=1 (or any truthy value) in the
 * Convex dashboard's environment variables to enable verbose logging
 * during development.
 *
 * `error()` is intentionally always-on: a thrown condition is a
 * condition worth logging.
 */
const DEBUG_ENABLED = Boolean(
    typeof process !== 'undefined' &&
    process.env &&
    process.env.CONVEX_DEBUG &&
    process.env.CONVEX_DEBUG !== '0' &&
    process.env.CONVEX_DEBUG.toLowerCase() !== 'false'
);

export function log(scope, payload) {
    if (!DEBUG_ENABLED) return;
    if (payload === undefined) {
        console.log(`[${scope}]`);
    } else {
        console.log(`[${scope}]`, payload);
    }
}

export function warn(scope, payload) {
    if (!DEBUG_ENABLED) return;
    if (payload === undefined) {
        console.warn(`[${scope}]`);
    } else {
        console.warn(`[${scope}]`, payload);
    }
}

export function errorLog(scope, payload) {
    // Always-on. A thrown condition is worth logging even in prod.
    if (payload === undefined) {
        console.error(`[${scope}]`);
    } else if (payload instanceof Error) {
        console.error(`[${scope}]`, payload.message, payload.stack);
    } else {
        console.error(`[${scope}]`, payload);
    }
}
