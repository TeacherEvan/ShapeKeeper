/**
 * ShapeKeeper - Disposable Resource Registry
 * Manages event listeners, timeouts, animation frame loops, and disposable resources.
 */

export class DisposableRegistry {
    constructor() {
        this.timeouts = new Set();
        this.rafs = new Set();
        this.eventListeners = new Set();
        this.disposables = new Set();
        this.cleanups = new Set();
        this.isDisposed = false;
    }

    /**
     * Track a setTimeout timer ID.
     * @param {number|any} timeoutId
     * @returns {number|any}
     */
    addTimeout(timeoutId) {
        if (this.isDisposed) {
            clearTimeout(timeoutId);
            return timeoutId;
        }
        this.timeouts.add(timeoutId);
        return timeoutId;
    }

    /**
     * Track a requestAnimationFrame ID.
     * @param {number} rafId
     * @returns {number}
     */
    addRAF(rafId) {
        if (this.isDisposed) {
            cancelAnimationFrame(rafId);
            return rafId;
        }
        this.rafs.add(rafId);
        return rafId;
    }

    /**
     * Add and track an event listener on a target.
     * @param {EventTarget} target
     * @param {string} type
     * @param {EventListenerOrEventListenerObject} listener
     * @param {boolean|AddEventListenerOptions} [options]
     */
    addEventListener(target, type, listener, options) {
        if (!target || typeof target.addEventListener !== 'function') {
            return;
        }

        if (this.isDisposed) {
            return;
        }

        target.addEventListener(type, listener, options);
        this.eventListeners.add({ target, type, listener, options });
    }

    /**
     * Register a disposable object implementing .dispose() or .destroy().
     * @param {{ dispose?: () => void, destroy?: () => void }} disposable
     * @returns {any}
     */
    addDisposable(disposable) {
        if (!disposable) return disposable;
        if (this.isDisposed) {
            if (typeof disposable.dispose === 'function') {
                disposable.dispose();
            } else if (typeof disposable.destroy === 'function') {
                disposable.destroy();
            }
            return disposable;
        }
        this.disposables.add(disposable);
        return disposable;
    }

    /**
     * Register a custom cleanup function.
     * @param {() => void} callback
     */
    addCleanup(callback) {
        if (typeof callback !== 'function') return;
        if (this.isDisposed) {
            try {
                callback();
            } catch (e) {
                console.error('[DisposableRegistry] Cleanup error:', e);
            }
            return;
        }
        this.cleanups.add(callback);
    }

    /**
     * Dispose all tracked resources cleanly and idempotently.
     */
    dispose() {
        if (this.isDisposed) {
            return;
        }
        this.isDisposed = true;

        // Clear timeouts
        for (const timeoutId of this.timeouts) {
            clearTimeout(timeoutId);
        }
        this.timeouts.clear();

        // Cancel animation frames
        for (const rafId of this.rafs) {
            cancelAnimationFrame(rafId);
        }
        this.rafs.clear();

        // Remove event listeners
        for (const { target, type, listener, options } of this.eventListeners) {
            try {
                target.removeEventListener(type, listener, options);
            } catch (e) {
                console.warn('[DisposableRegistry] Failed to remove event listener:', e);
            }
        }
        this.eventListeners.clear();

        // Dispose sub-objects
        for (const item of this.disposables) {
            try {
                if (typeof item.dispose === 'function') {
                    item.dispose();
                } else if (typeof item.destroy === 'function') {
                    item.destroy();
                }
            } catch (e) {
                console.error('[DisposableRegistry] Failed to dispose item:', e);
            }
        }
        this.disposables.clear();

        // Run cleanups
        for (const cleanup of this.cleanups) {
            try {
                cleanup();
            } catch (e) {
                console.error('[DisposableRegistry] Error running cleanup callback:', e);
            }
        }
        this.cleanups.clear();
    }
}
