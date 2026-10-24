/**
 * ShapeKeeper - optional donation prompt.
 *
 * A tip jar, not a paywall. All levels are already open. This module never
 * unlocks anything, never records a donor status, and never changes the UI
 * for people who donate. The only job is to ask, and to stay out of the way.
 *
 * Config: window.DONATION_URL in config.js. Empty string disables the prompt.
 */

export const DONATION_PROMPT_EVERY_N_LEVELS = 5;
export const DONATION_PROMPT_STORAGE_KEY = 'shapekeeper_donation_prompt.v1';

const MODAL_ID = 'donationPromptOverlay';
const SURE_ID = 'donationSureBtn';
const LATER_ID = 'donationLaterBtn';

function readState() {
    if (typeof window === 'undefined' || !window.localStorage) {
        return { lastPromptLevel: 0 };
    }
    try {
        const raw = window.localStorage.getItem(DONATION_PROMPT_STORAGE_KEY);
        if (!raw) return { lastPromptLevel: 0 };
        const parsed = JSON.parse(raw);
        return {
            lastPromptLevel: Number.isFinite(Number(parsed.lastPromptLevel))
                ? Number(parsed.lastPromptLevel)
                : 0,
        };
    } catch {
        return { lastPromptLevel: 0 };
    }
}

function writeState(state) {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        window.localStorage.setItem(DONATION_PROMPT_STORAGE_KEY, JSON.stringify(state));
    } catch {
        // A full/blocked localStorage must never break the game.
    }
}

export function getDonationUrl() {
    if (typeof window === 'undefined') return '';
    const raw = typeof window.DONATION_URL === 'string' ? window.DONATION_URL.trim() : '';
    if (!raw) return '';
    try {
        const parsed = new URL(raw, window.location?.href || 'https://shape-keeper.vercel.app/');
        if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) return '';
        return raw;
    } catch {
        return '';
    }
}

export function shouldShowDonationPrompt(level, { force = false } = {}) {
    if (!getDonationUrl()) return false;
    if (force) return true;

    const lvl = Number(level);
    if (!Number.isFinite(lvl) || lvl < 1) return false;
    if (lvl % DONATION_PROMPT_EVERY_N_LEVELS !== 0) return false;

    return readState().lastPromptLevel !== lvl;
}

function markPromptShown(level) {
    writeState({ lastPromptLevel: Number(level) || 0 });
}

/**
 * Show the donation prompt if the level cadence allows it.
 *
 * Resolves to 'donated', 'dismissed', or 'skipped'. The caller should continue
 * to the next level in every case — the prompt must never block play.
 *
 * @param {{ level: number, soundManager?: object, force?: boolean }} options
 * @returns {Promise<'donated'|'dismissed'|'skipped'>}
 */
export function maybeShowDonationPrompt({ level, soundManager = null, force = false } = {}) {
    return new Promise((resolve) => {
        if (typeof document === 'undefined') {
            resolve('skipped');
            return;
        }

        const overlay = document.getElementById(MODAL_ID);
        const sure = document.getElementById(SURE_ID);
        const later = document.getElementById(LATER_ID);
        if (!overlay || !sure || !later || !shouldShowDonationPrompt(level, { force })) {
            resolve('skipped');
            return;
        }

        // A second click while the modal is already open must not stack prompts.
        if (!overlay.hidden) {
            resolve('skipped');
            return;
        }

        markPromptShown(level);
        const previousFocus = document.activeElement;
        let settled = false;

        const finish = (result) => {
            if (settled) return;
            settled = true;
            overlay.hidden = true;
            document.removeEventListener('keydown', onKeydown, true);
            sure.removeEventListener('click', onSure);
            later.removeEventListener('click', onLater);
            if (previousFocus && typeof previousFocus.focus === 'function') {
                previousFocus.focus();
            }
            resolve(result);
        };

        const onSure = () => {
            const url = getDonationUrl();
            if (url) {
                try {
                    window.open(url, '_blank', 'noopener,noreferrer');
                } catch {
                    // A blocked popup should not strand the player on the modal.
                }
            }
            finish('donated');
        };

        const onLater = () => finish('dismissed');

        const onKeydown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                finish('dismissed');
                return;
            }
            if (event.key !== 'Tab') return;
            const focusables = [sure, later];
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        sure.addEventListener('click', onSure);
        later.addEventListener('click', onLater);
        document.addEventListener('keydown', onKeydown, true);

        overlay.hidden = false;
        soundManager?.ensureAudioContext?.();
        soundManager?.playDonationChime?.();

        // Wait one frame so the card is visible before moving focus.
        const focusSure = () => sure.focus();
        if (typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(focusSure);
        } else {
            setTimeout(focusSure, 0);
        }
    });
}
