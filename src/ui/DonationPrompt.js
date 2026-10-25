/**
 * ShapeKeeper - optional donation prompt.
 *
 * A tip jar, not a paywall. All levels are already open. This module never
 * unlocks anything and never grants a functional perk. The only job is to ask,
 * to stay out of the way, and — after the player has chosen to donate — to say
 * thank you.
 *
 * Gratitude policy (see COMPLIANCE.md): the 🧚 appears only AFTER the player
 * opens the donation page and explicitly confirms, or on a later visit from a
 * player who already confirmed. It is never mentioned in the ask, is not a tier
 * or a perk, and changes nothing about the game.
 *
 * Config: window.DONATION_URL in config.js. Empty string disables the prompt.
 */

export const DONATION_PROMPT_EVERY_N_LEVELS = 5;
export const DONATION_PROMPT_STORAGE_KEY = 'shapekeeper_donation_prompt.v1';

const MODAL_ID = 'donationPromptOverlay';
const ASK_CARD_ID = 'donationAskCard';
const THANKS_CARD_ID = 'donationThanksCard';
const SURE_ID = 'donationSureBtn';
const LATER_ID = 'donationLaterBtn';
const CONFIRM_ID = 'donationConfirmBtn';
const THANKS_CLOSE_ID = 'donationThanksCloseBtn';

const THANKS_TITLE_ID = 'donationThanksTitle';
const THANKS_BODY_ID = 'donationThanksBody';

function emptyState() {
    return { lastPromptLevel: 0, donor: false, donatedAt: null, clickedAt: null };
}

function readState() {
    if (typeof window === 'undefined' || !window.localStorage) return emptyState();
    try {
        const raw = window.localStorage.getItem(DONATION_PROMPT_STORAGE_KEY);
        if (!raw) return emptyState();
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return emptyState();
        return {
            lastPromptLevel: Number.isFinite(Number(parsed.lastPromptLevel))
                ? Number(parsed.lastPromptLevel)
                : 0,
            donor: parsed.donor === true,
            donatedAt: typeof parsed.donatedAt === 'string' ? parsed.donatedAt : null,
            clickedAt: typeof parsed.clickedAt === 'string' ? parsed.clickedAt : null,
        };
    } catch {
        return emptyState();
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

/** True once the player has explicitly confirmed a donation on this device. */
export function isDonor() {
    return readState().donor === true;
}

/** Only call from an explicit confirmation — never inferred from a click. */
export function markDonor() {
    const state = readState();
    writeState({ ...state, donor: true, donatedAt: new Date().toISOString() });
}

function markPromptShown(level) {
    const state = readState();
    writeState({ ...state, lastPromptLevel: Number(level) || 0 });
}

function markDonationClicked() {
    const state = readState();
    writeState({ ...state, clickedAt: new Date().toISOString() });
}

export function shouldShowDonationPrompt(level, { force = false } = {}) {
    if (!getDonationUrl()) return false;
    if (force) return true;

    const lvl = Number(level);
    if (!Number.isFinite(lvl) || lvl < 1) return false;
    if (lvl % DONATION_PROMPT_EVERY_N_LEVELS !== 0) return false;

    return readState().lastPromptLevel !== lvl;
}

/**
 * Show the donation prompt if the level cadence allows it.
 *
 * Resolves to:
 *  - 'donated'   — the player opened the page and confirmed the donation
 *  - 'dismissed' — the player declined, closed, or cancelled the ask
 *  - 'thanked'   — a returning donor was shown the gratitude card
 *  - 'skipped'   — policy said no, or the modal markup is missing
 *
 * The caller must continue to the next level in every case: the prompt never
 * blocks play.
 *
 * @param {{ level: number, soundManager?: object, force?: boolean }} options
 * @returns {Promise<'donated'|'dismissed'|'thanked'|'skipped'>}
 */
export function maybeShowDonationPrompt({ level, soundManager = null, force = false } = {}) {
    return new Promise((resolve) => {
        if (typeof document === 'undefined') {
            resolve('skipped');
            return;
        }

        const overlay = document.getElementById(MODAL_ID);
        const askCard = document.getElementById(ASK_CARD_ID);
        const thanksCard = document.getElementById(THANKS_CARD_ID);
        const sure = document.getElementById(SURE_ID);
        const later = document.getElementById(LATER_ID);
        const confirm = document.getElementById(CONFIRM_ID);
        const thanksClose = document.getElementById(THANKS_CLOSE_ID);

        if (
            !overlay ||
            !askCard ||
            !thanksCard ||
            !sure ||
            !later ||
            !confirm ||
            !thanksClose ||
            !shouldShowDonationPrompt(level, { force })
        ) {
            resolve('skipped');
            return;
        }

        // A second click while the modal is already open must not stack prompts.
        if (!overlay.hidden) {
            resolve('skipped');
            return;
        }

        const donorView = isDonor();
        markPromptShown(level);

        const previousFocus = document.activeElement;
        let settled = false;
        let showingThanks = false;
        let returningDonor = false;

        const resetCards = () => {
            askCard.hidden = false;
            thanksCard.hidden = true;
            confirm.hidden = false;
            overlay.setAttribute('aria-labelledby', 'donationPromptTitle');
            overlay.setAttribute('aria-describedby', 'donationPromptBody');
            showingThanks = false;
        };

        const currentFocusables = () =>
            showingThanks ? [confirm, thanksClose].filter((el) => !el.hidden) : [sure, later];

        const finish = (result) => {
            if (settled) return;
            settled = true;
            overlay.hidden = true;
            resetCards();
            document.removeEventListener('keydown', onKeydown, true);
            sure.removeEventListener('click', onSure);
            later.removeEventListener('click', onLater);
            confirm.removeEventListener('click', onConfirm);
            thanksClose.removeEventListener('click', onThanksClose);
            if (previousFocus && typeof previousFocus.focus === 'function') {
                previousFocus.focus();
            }
            resolve(result);
        };

        const showThanks = (isReturningDonor) => {
            showingThanks = true;
            returningDonor = isReturningDonor;
            askCard.hidden = true;
            thanksCard.hidden = false;
            overlay.setAttribute('aria-labelledby', THANKS_TITLE_ID);
            overlay.setAttribute('aria-describedby', THANKS_BODY_ID);

            // A returning donor gets gratitude only; a fresh click still gets the
            // explicit "I donated" confirmation so we never infer it.
            confirm.hidden = isReturningDonor;

            const title = document.getElementById(THANKS_TITLE_ID);
            const body = document.getElementById(THANKS_BODY_ID);
            if (title) title.textContent = 'Thank you for the kindness';
            if (body) {
                body.textContent = isReturningDonor
                    ? 'You already support ShapeKeeper. This is gratitude, nothing more — every level stays free.'
                    : 'The donation page opened in a new tab. Nothing was unlocked — everything was already free.';
            }

            const target = isReturningDonor ? thanksClose : confirm;
            target.focus();
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
            markDonationClicked();
            showThanks(false);
        };

        const onLater = () => finish('dismissed');
        const onConfirm = () => {
            markDonor();
            finish('donated');
        };
        const onThanksClose = () => finish(returningDonor ? 'thanked' : 'dismissed');

        const onKeydown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                finish('dismissed');
                return;
            }
            if (event.key !== 'Tab') return;
            const focusables = currentFocusables();
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
        confirm.addEventListener('click', onConfirm);
        thanksClose.addEventListener('click', onThanksClose);
        document.addEventListener('keydown', onKeydown, true);

        overlay.hidden = false;
        soundManager?.ensureAudioContext?.();
        soundManager?.playDonationChime?.();

        // Choose the variant synchronously: the visible card must be correct on
        // the first paint, not one animation frame later.
        if (donorView) showThanks(true);

        const focusEntry = () => {
            if (donorView) thanksClose.focus();
            else sure.focus();
        };
        if (typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(focusEntry);
        } else {
            setTimeout(focusEntry, 0);
        }
    });
}
