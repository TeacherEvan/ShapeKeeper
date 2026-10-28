/**
 * ShapeKeeper - Unlock Gate
 *
 * One purchase unlocks every level above `FREE_LEVELS`. This module owns the
 * purchase dialog, the licence-key check, and the local entitlement record.
 *
 * Trust model (deliberate, and documented in SECURITY.md):
 * - The key is verified against the seller's licence API, not against a string
 *   we ship. A key that the seller reports invalid never sets the entitlement.
 * - A local game can always be edited by its owner. This gate is honest-buyer
 *   enforcement, not DRM; the entitlement lives in the same localStorage record
 *   as the player's level progress.
 * - The raw key is kept only to allow re-validation after a refund. It is never
 *   sent anywhere except the seller's licence endpoint.
 *
 * Disabled unless `window.PAYWALL_ENABLED === true`, so the live build keeps its
 * current behaviour until a working checkout exists.
 */

import { FREE_LEVELS, LevelsProgress, MAX_LEVEL } from './LevelsProgress.js';

export const LICENSE_STORAGE_KEY = 'shapekeeper_license.v1';
export const DEFAULT_VALIDATE_URL = 'https://api.lemonsqueezy.com/v1/licenses/validate';

let dialog = null;
let statusEl = null;
let onUnlockedCallback = null;

export function isPaywallEnabled() {
    return typeof window !== 'undefined' && window.PAYWALL_ENABLED === true;
}

export function getCheckoutUrl() {
    const url = typeof window !== 'undefined' ? window.UNLOCK_CHECKOUT_URL : '';
    return typeof url === 'string' ? url : '';
}

export function getValidateUrl() {
    const url = typeof window !== 'undefined' ? window.LICENSE_VALIDATE_URL : '';
    return typeof url === 'string' && url ? url : DEFAULT_VALIDATE_URL;
}

export function getPriceLabel() {
    const label = typeof window !== 'undefined' ? window.UNLOCK_PRICE_LABEL : '';
    return typeof label === 'string' && label ? label : 'one payment, every level';
}

function readStoredLicense() {
    try {
        const raw = window.localStorage.getItem(LICENSE_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return typeof parsed.key === 'string' && parsed.key.length > 0 ? parsed : null;
    } catch {
        return null;
    }
}

function writeStoredLicense(key) {
    try {
        window.localStorage.setItem(
            LICENSE_STORAGE_KEY,
            JSON.stringify({ key, validatedAt: new Date().toISOString() })
        );
    } catch (error) {
        console.warn('[UnlockGate] Could not persist the licence locally:', error);
    }
}

/**
 * Ask the seller whether a key is live. Resolves to { valid, reason }.
 * Never throws: a network failure is reported as an unknown, not as a purchase.
 */
export async function validateLicenseKey(key) {
    const trimmed = String(key || '').trim();
    if (!trimmed) return { valid: false, reason: 'Enter the licence key from your receipt.' };

    // A hung request must not leave the dialog stuck on "Checking the key…".
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch(getValidateUrl(), {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({ license_key: trimmed }).toString(),
            signal: controller.signal,
        });
        if (!response.ok) {
            return {
                valid: false,
                reason: `The licence service answered ${response.status}. Try again.`,
            };
        }
        const data = await response.json();
        if (data && data.valid === true) return { valid: true, reason: '' };
        return {
            valid: false,
            reason: 'That key is not active. Check your receipt, or contact support.',
        };
    } catch {
        return {
            valid: false,
            reason: 'Could not reach the licence service. Check your connection.',
        };
    } finally {
        clearTimeout(timer);
    }
}

function setStatus(message, kind = 'info') {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.dataset.kind = kind;
}

function closeDialog() {
    if (!dialog) return;
    dialog.hidden = true;
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
}

function buildDialog() {
    dialog = document.createElement('dialog');
    dialog.className = 'unlock-gate';
    dialog.setAttribute('aria-labelledby', 'unlockGateTitle');
    dialog.dataset.testid = 'unlock-gate';

    const box = document.createElement('div');
    box.className = 'unlock-gate-box';

    const title = document.createElement('h2');
    title.id = 'unlockGateTitle';
    title.textContent = `Unlock levels ${FREE_LEVELS + 1}–${MAX_LEVEL}`;

    const copy = document.createElement('p');
    copy.className = 'unlock-gate-copy';
    copy.textContent = `Levels 1–${FREE_LEVELS} are free. One payment opens the remaining ${
        MAX_LEVEL - FREE_LEVELS
    } levels — no subscription, no second purchase.`;

    const price = document.createElement('p');
    price.className = 'unlock-gate-price';
    price.textContent = getPriceLabel();

    const buy = document.createElement('a');
    buy.className = 'unlock-gate-buy';
    buy.dataset.testid = 'unlock-gate-buy';
    buy.textContent = 'Buy the unlock';
    buy.href = getCheckoutUrl() || '#';
    buy.target = '_blank';
    buy.rel = 'noopener noreferrer';
    if (!getCheckoutUrl()) {
        buy.setAttribute('aria-disabled', 'true');
        buy.addEventListener('click', (event) => event.preventDefault());
    }

    const divider = document.createElement('p');
    divider.className = 'unlock-gate-divider';
    divider.textContent = 'Already bought it? Enter the key from your receipt.';

    const form = document.createElement('form');
    form.className = 'unlock-gate-form';

    const input = document.createElement('input');
    input.type = 'text';
    input.name = 'license_key';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.placeholder = 'Licence key';
    input.dataset.testid = 'unlock-gate-key';

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.textContent = 'Unlock';

    form.append(input, submit);

    statusEl = document.createElement('p');
    statusEl.className = 'unlock-gate-status';
    statusEl.setAttribute('role', 'status');
    statusEl.dataset.kind = 'info';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'unlock-gate-cancel';
    cancel.textContent = 'Not now';
    cancel.addEventListener('click', closeDialog);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        submit.disabled = true;
        setStatus('Checking the key…', 'info');
        const result = await validateLicenseKey(input.value);
        submit.disabled = false;
        if (!result.valid) {
            setStatus(result.reason, 'error');
            return;
        }
        writeStoredLicense(input.value.trim());
        LevelsProgress.setEntitled(true);
        setStatus('Unlocked. Every level is open.', 'success');
        if (typeof onUnlockedCallback === 'function') onUnlockedCallback();
        closeDialog();
    });

    box.append(title, copy, price, buy, divider, form, statusEl, cancel);
    dialog.append(box);
    document.body.append(dialog);
}

/**
 * Open the purchase dialog. `onUnlocked` runs after a successful key check so the
 * caller can re-render the level grid.
 */
export function openUnlockGate({ onUnlocked } = {}) {
    if (!isPaywallEnabled()) return false;
    if (!dialog) buildDialog();
    onUnlockedCallback = typeof onUnlocked === 'function' ? onUnlocked : null;
    setStatus('', 'info');
    dialog.hidden = false;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    return true;
}

/**
 * Best-effort check on load: a stored key that the seller now reports as invalid
 * (refund, chargeback) turns the entitlement back off. A network failure leaves
 * the current state alone so an offline player is not locked out of paid levels.
 */
export async function revalidateStoredLicense() {
    const stored = typeof window === 'undefined' ? null : readStoredLicense();
    if (!stored || !isPaywallEnabled()) return { checked: false };
    const result = await validateLicenseKey(stored.key);
    if (result.valid) {
        LevelsProgress.setEntitled(true);
        return { checked: true, valid: true };
    }
    if (result.reason.startsWith('Could not reach')) return { checked: false };
    LevelsProgress.setEntitled(false);
    return { checked: true, valid: false };
}
