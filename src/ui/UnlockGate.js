/**
 * ShapeKeeper - Unlock Gate
 *
 * One purchase unlocks every level above `FREE_LEVELS`. This module owns the
 * purchase dialog, the licence-key redemption, and the entitlement record.
 *
 * Trust model — server truth (documented in SECURITY.md and COMPLIANCE.md):
 * - The licence key is sent ONCE to our own backend, which exchanges it with
 *   Lemon Squeezy for an instance id. The browser keeps the instance id and
 *   nothing else. **The raw key is never written to the player's disk.**
 * - The entitlement is checked against our backend, so a refund takes the
 *   access away without waiting for the player to re-validate by hand.
 * - If our backend cannot be reached, the gate falls back to asking Lemon
 *   Squeezy directly from the browser and grants a SESSION-ONLY entitlement:
 *   still no key on disk, but it does not survive a reload.
 * - A local game can always be edited by its owner. This is honest-buyer
 *   enforcement, not DRM.
 * - The interim build stored the raw key in localStorage to re-validate after
 *   a refund. That record is exchanged once and then erased.
 *
 * Disabled unless `window.PAYWALL_ENABLED === true`, so a build without a
 * working checkout keeps its current behaviour.
 */

import { FREE_LEVELS, LevelsProgress, MAX_LEVEL } from './LevelsProgress.js';

export const ENTITLEMENT_STORAGE_KEY = 'shapekeeper_entitlement.v1';
export const DEVICE_STORAGE_KEY = 'shapekeeper_device.v1';
/** The interim build's record: a raw licence key on disk. Read once, then erased. */
export const LEGACY_LICENSE_STORAGE_KEY = 'shapekeeper_license.v1';
export const DEFAULT_VALIDATE_URL = 'https://api.lemonsqueezy.com/v1/licenses/validate';
/** Lemon Squeezy's `[license_key]` link variable arrives as this query parameter. */
export const REDEEM_QUERY_PARAM = 'redeem';

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

/**
 * A stable per-browser id. Lemon Squeezy calls it the activation instance
 * name; it is what tells the server which device a key was activated on.
 */
export function getDeviceId() {
    try {
        const existing = window.localStorage.getItem(DEVICE_STORAGE_KEY);
        if (existing) return existing;
        const generated =
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        window.localStorage.setItem(DEVICE_STORAGE_KEY, generated);
        return generated;
    } catch {
        return 'unknown-device';
    }
}

function readStoredEntitlement() {
    try {
        const raw = window.localStorage.getItem(ENTITLEMENT_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.instanceId === 'string' && parsed.instanceId) return parsed;
        return null;
    } catch {
        return null;
    }
}

function writeStoredEntitlement(record) {
    try {
        window.localStorage.setItem(
            ENTITLEMENT_STORAGE_KEY,
            JSON.stringify({
                instanceId: record.instanceId,
                productId: record.productId ?? null,
                activatedAt: new Date().toISOString(),
            })
        );
    } catch (error) {
        console.warn('[UnlockGate] Could not persist the entitlement:', error);
    }
}

function clearStoredEntitlement() {
    try {
        window.localStorage.removeItem(ENTITLEMENT_STORAGE_KEY);
    } catch {
        /* nothing to do */
    }
}

/** Read the interim build's raw-key record. */
function readLegacyLicense() {
    try {
        const raw = window.localStorage.getItem(LEGACY_LICENSE_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return typeof parsed?.key === 'string' && parsed.key.length > 0 ? parsed.key : null;
    } catch {
        return null;
    }
}

/** Erase the raw key from disk. Once it has been exchanged, it has no business there. */
function purgeLegacyLicense() {
    try {
        window.localStorage.removeItem(LEGACY_LICENSE_STORAGE_KEY);
    } catch {
        /* nothing to do */
    }
}

function getConvex() {
    if (typeof window === 'undefined') return null;
    const shared = window.ShapeKeeperConvexShared;
    return shared && shared.api ? shared : null;
}

/**
 * Exchange the key on our backend. Returns:
 *   { available: false }                     — the backend could not be reached
 *   { available: true, active: true, ... }   — redeemed, instance id returned
 *   { available: true, active: false, reason } — the key is not good
 */
async function redeemOnServer(licenseKey) {
    const shared = getConvex();
    if (!shared || typeof shared.runMutation !== 'function') return { available: false };
    try {
        const result = await shared.runMutation(
            shared.api.entitlements.redeemEntitlement,
            { licenseKey, instanceName: getDeviceId() },
            'redeemEntitlement'
        );
        if (result && result.error) return { available: false, error: result.error };
        if (result && result.active === true) {
            return {
                available: true,
                active: true,
                instanceId: result.instanceId,
                productId: result.productId,
            };
        }
        if (result && result.active === false) {
            return { available: true, active: false, reason: result.reason || 'invalid_key' };
        }
        return { available: false };
    } catch (error) {
        return { available: false, error: error?.message };
    }
}

/** Ask our backend whether this instance still holds an entitlement. */
async function checkOnServer(instanceId) {
    const shared = getConvex();
    if (!shared || typeof shared.runQuery !== 'function') return { available: false };
    try {
        const result = await shared.runQuery(
            shared.api.entitlements.checkEntitlement,
            { instanceId },
            'checkEntitlement'
        );
        if (!result || result.error) return { available: false };
        return {
            available: true,
            active: result.active === true,
            productId: result.productId ?? null,
        };
    } catch (error) {
        return { available: false, error: error?.message };
    }
}

const REASON_MESSAGES = {
    malformed_key: 'Enter the licence key from your receipt.',
    key_not_found: 'That key is not active. Check your receipt, or contact support.',
    activation_limit_reached: 'That key is already active on the maximum number of devices.',
    key_expired: 'That key has expired.',
    key_disabled: 'That key was disabled.',
    key_refunded: 'That key belongs to a refunded order, so it cannot unlock the game.',
    product_not_allowed: 'That key is for a different product.',
    products_not_configured:
        'The unlock service is not fully configured yet. Please contact support.',
    license_service_unreachable: 'Could not reach the licence service. Check your connection.',
    rate_limited: 'Too many attempts. Wait a few minutes and try again.',
    activation_failed: 'That key could not be verified. Check your receipt, or contact support.',
};

function reasonMessage(reason) {
    return (
        REASON_MESSAGES[reason] ||
        'That key could not be verified. Check your receipt, or contact support.'
    );
}

/**
 * Fallback path: ask Lemon Squeezy directly from the browser. Used only when
 * our backend is unreachable. Grants a session-only entitlement — the key is
 * never written to disk.
 */
export async function validateWithLicenceEndpoint(key) {
    const trimmed = String(key || '').trim();
    if (!trimmed) return { valid: false, reason: 'Enter the licence key from your receipt.' };

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

/**
 * Redeem a licence key.
 *
 * Returns `{ valid, reason, entitlement }` where `entitlement` is
 * `'server'` (persisted as an instance id), `'session'` (the backend was
 * unreachable — not persisted) or absent (not redeemed).
 */
export async function validateLicenseKey(key) {
    const trimmed = String(key || '').trim();
    if (!trimmed) return { valid: false, reason: 'Enter the licence key from your receipt.' };

    const server = await redeemOnServer(trimmed);
    if (server.available) {
        if (server.active) {
            writeStoredEntitlement({ instanceId: server.instanceId, productId: server.productId });
            purgeLegacyLicense();
            return { valid: true, reason: '', entitlement: 'server' };
        }
        return { valid: false, reason: reasonMessage(server.reason) };
    }

    const direct = await validateWithLicenceEndpoint(trimmed);
    if (direct.valid) {
        // Session only: the key is used and forgotten, never stored.
        purgeLegacyLicense();
        return { valid: true, reason: '', entitlement: 'session' };
    }
    return { valid: false, reason: direct.reason };
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
    buy.textContent = getCheckoutUrl()
        ? 'Buy the unlock'
        : 'Checkout opens when the store is approved';
    buy.href = getCheckoutUrl() || '#';
    buy.target = '_blank';
    buy.rel = 'noopener noreferrer';
    if (!getCheckoutUrl()) {
        // No door yet: keep the price and the offer visible, but never present a
        // buy button that goes nowhere without saying so.
        buy.setAttribute('aria-disabled', 'true');
        buy.classList.add('unlock-gate-buy-pending');
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
        // The key has been exchanged; it is not kept anywhere on this device.
        input.value = '';
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
 * Best-effort check on load: an entitlement the backend no longer honours
 * (refund, chargeback) turns the access back off. A network failure leaves
 * the current state alone, so an offline player is not locked out of levels
 * they have paid for.
 */
export async function revalidateStoredLicense() {
    if (!isPaywallEnabled()) return { checked: false };

    const stored = readStoredEntitlement();
    if (stored) {
        const check = await checkOnServer(stored.instanceId);
        if (check.available) {
            LevelsProgress.setEntitled(check.active);
            if (!check.active) clearStoredEntitlement();
            return { checked: true, valid: check.active };
        }
        return { checked: false, valid: true };
    }

    // A record from the interim build: exchange it once, then erase the key.
    const legacy = readLegacyLicense();
    if (legacy) {
        const result = await validateLicenseKey(legacy);
        LevelsProgress.setEntitled(result.valid);
        return { checked: true, valid: result.valid };
    }

    return { checked: false };
}

/**
 * Lemon Squeezy can send the buyer straight back to the game with the key in
 * the URL (`?redeem=[license_key]`). The key is stripped from the address
 * before anything else can put it in history or a referrer header.
 */
export async function redeemFromUrl() {
    if (typeof window === 'undefined') return { redeemed: false };

    let key = null;
    try {
        key = new URLSearchParams(window.location.search).get(REDEEM_QUERY_PARAM);
    } catch {
        return { redeemed: false };
    }
    if (!key) return { redeemed: false };

    try {
        const url = new URL(window.location.href);
        url.searchParams.delete(REDEEM_QUERY_PARAM);
        window.history.replaceState({}, '', url.toString());
    } catch {
        /* stripping the parameter is best-effort */
    }

    const result = await validateLicenseKey(key);
    if (result.valid) {
        LevelsProgress.setEntitled(true);
        return { redeemed: true, entitled: true };
    }
    return { redeemed: true, entitled: false, reason: result.reason };
}

/**
 * Called once when the app starts: re-check a stored entitlement, and redeem
 * a key that arrived in the URL.
 */
export async function initEntitlement() {
    if (!isPaywallEnabled()) return { checked: false, redeemed: false };
    let checked = { checked: false };
    try {
        checked = await revalidateStoredLicense();
    } catch (error) {
        console.warn('[UnlockGate] Entitlement re-check failed:', error);
    }
    let redeemed = { redeemed: false };
    try {
        redeemed = await redeemFromUrl();
    } catch (error) {
        console.warn('[UnlockGate] URL redemption failed:', error);
    }
    return { checked: checked.checked, redeemed: redeemed.redeemed };
}
