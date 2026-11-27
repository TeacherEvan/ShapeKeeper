/**
 * GameControlsPanel — the double-tap-to-open state machine for the in-game
 * action buttons (Undo/Redo/Save/Replay/Sound/Populate).
 *
 * The state machine:
 *   - `closed` (initial): a single tap PRimes the toggle; the button shows a
 *     primed style and a short pulse animation to teach the user the pattern.
 *   - `primed`: a second tap within `windowMs` (default 500) opens the panel.
 *     A tap after the window expires falls back to the closed state (and
 *     the tap is treated as a fresh prime).
 *   - `open`: a single tap CLOSES the panel. No double-tap required to close
 *     — getting back to gameplay should be friction-free.
 *
 * The factory returns a plain object — no DOM dependencies — so it can be
 * unit-tested with a fake `now` and no jsdom. The DOM binding (button +
 * panel) lives in `src/ui/menu/eventBindings.js`.
 *
 * @module ui/GameControlsPanel
 */

/**
 * @param {object} opts
 * @param {() => number} [opts.now]      Injectable clock (default: Date.now).
 * @param {number}       [opts.windowMs] Double-tap window in ms (default 500).
 * @param {(state: {isOpen: boolean}) => void} [opts.onChange]
 *        Fired whenever `isOpen` transitions. Used by the binding layer to
 *        sync the DOM (aria-expanded, hidden attribute, .primed class).
 */
export function createGameControlsPanel({ now = () => Date.now(), windowMs = 500, onChange } = {}) {
    let open = false;
    let primed = false;
    let lastTapAt = 0;

    function setOpen(next) {
        if (open === next) return;
        open = next;
        if (open) primed = false; // consumed the prime
        if (typeof onChange === 'function') onChange({ isOpen: open });
    }

    return {
        isOpen() {
            return open;
        },
        isPrimed() {
            return primed;
        },
        /**
         * A user tap on the toggle button. Decision tree:
         *   - open: close
         *   - closed + primed + within window: open (consume the prime)
         *   - closed + (not primed OR past window): prime (do not open)
         */
        tap() {
            const t = now();
            if (open) {
                setOpen(false);
                return { action: 'close' };
            }
            if (primed && t - lastTapAt <= windowMs) {
                setOpen(true);
                return { action: 'open' };
            }
            primed = true;
            lastTapAt = t;
            return { action: 'prime' };
        },
        /** Programmatic close (e.g. when leaving the game screen). */
        close() {
            setOpen(false);
            primed = false;
        },
        /** Expose the window for UI tests / introspection. */
        windowMs,
    };
}

/**
 * Bind a `GameControlsPanel` to the toggle button + panel DOM nodes.
 * Returns a teardown function that removes the click listener.
 *
 * @param {object} panel  Result of `createGameControlsPanel`.
 * @param {HTMLElement} toggleBtn
 * @param {HTMLElement} panelEl
 */
export function bindGameControlsPanel(panel, toggleBtn, panelEl) {
    if (!panel || !toggleBtn || !panelEl) return () => {};

    const labelEl = toggleBtn.querySelector('.controls-toggle-label');
    const defaultLabel = labelEl ? labelEl.textContent : 'Controls';
    let primeTimer = null;

    const clearPrimeTimer = () => {
        if (primeTimer) {
            clearTimeout(primeTimer);
            primeTimer = null;
        }
    };

    const syncDom = () => {
        const isOpen = panel.isOpen();
        const primed = panel.isPrimed();
        toggleBtn.setAttribute('aria-expanded', String(isOpen));
        panelEl.hidden = !isOpen;
        toggleBtn.classList.toggle('primed', primed);
        if (labelEl) {
            labelEl.textContent = primed && !isOpen ? 'Tap again' : defaultLabel;
        }
    };

    syncDom();

    const onTap = () => {
        clearPrimeTimer();
        const result = panel.tap();
        syncDom();
        if (result?.action === 'prime') {
            primeTimer = setTimeout(() => {
                primeTimer = null;
                if (!panel.isOpen()) {
                    panel.close();
                    syncDom();
                }
            }, panel.windowMs || 500);
        }
    };

    toggleBtn.addEventListener('click', onTap);

    return () => {
        clearPrimeTimer();
        toggleBtn.removeEventListener('click', onTap);
    };
}
