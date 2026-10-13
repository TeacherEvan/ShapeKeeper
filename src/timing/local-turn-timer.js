/**
 * Local (hot-seat / vs-AI) turn timer. Pure and framework-free; `now` is
 * injectable so tests need no real clock. durationMs <= 0 => disabled.
 */
export function createLocalTurnTimer({ durationMs = 0, now = () => performance.now() } = {}) {
    const enabled = Number.isFinite(durationMs) && durationMs > 0;
    let running = false;
    let paused = false;
    let deadline = 0;
    let remainingAtPause = 0;
    let expiryConsumed = false;

    return {
        enabled,
        durationMs: enabled ? durationMs : 0,
        /** (Re)start a full turn. */
        start() {
            if (!enabled) return;
            running = true;
            paused = false;
            expiryConsumed = false;
            deadline = now() + durationMs;
        },
        stop() {
            running = false;
            paused = false;
        },
        pause() {
            if (!running || paused) return;
            remainingAtPause = Math.max(0, deadline - now());
            paused = true;
        },
        resume() {
            if (!running || !paused) return;
            deadline = now() + remainingAtPause;
            paused = false;
        },
        /** ms left, or null when disabled/stopped. */
        remainingMs() {
            if (!enabled || !running) return null;
            return paused ? remainingAtPause : Math.max(0, deadline - now());
        },
        /** true exactly once per started turn, when time has run out. */
        consumeExpiry() {
            if (!enabled || !running || paused || expiryConsumed) return false;
            if (now() < deadline) return false;
            expiryConsumed = true;
            return true;
        },
    };
}
