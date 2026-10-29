import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    DEVICE_STORAGE_KEY,
    ENTITLEMENT_STORAGE_KEY,
    LEGACY_LICENSE_STORAGE_KEY,
    getValidateUrl,
    isPaywallEnabled,
    redeemFromUrl,
    revalidateStoredLicense,
    validateLicenseKey,
} from '../src/ui/UnlockGate.js';
import { LevelsProgress } from '../src/ui/LevelsProgress.js';

/**
 * The gate's whole job is to grant levels to a buyer and nothing else. These
 * tests pin the three things that make that true:
 *
 * 1. A key is redeemed on OUR backend, which decides.
 * 2. The raw licence key is never written to the player's disk.
 * 3. A backend that cannot be reached must not turn into a purchase.
 */

function stubBackend(handlers) {
    window.ShapeKeeperConvexShared = {
        api: {
            entitlements: {
                redeemEntitlement: 'entitlements/redeemEntitlement',
                checkEntitlement: 'entitlements/checkEntitlement',
            },
        },
        runMutation: vi.fn(
            handlers.runMutation ?? (async () => ({ active: false, reason: 'key_not_found' }))
        ),
        runQuery: vi.fn(handlers.runQuery ?? (async () => ({ active: false, productId: null }))),
    };
    return window.ShapeKeeperConvexShared;
}

describe('UnlockGate licence redemption', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        localStorage.clear();
        window.PAYWALL_ENABLED = undefined;
        window.LICENSE_VALIDATE_URL = undefined;
        delete window.ShapeKeeperConvexShared;
        window.history.replaceState({}, '', '/');
    });

    afterEach(() => {
        global.fetch = originalFetch;
        delete window.ShapeKeeperConvexShared;
        vi.restoreAllMocks();
    });

    it('stays off unless the flag is exactly true', () => {
        expect(isPaywallEnabled()).toBe(false);
        window.PAYWALL_ENABLED = 'true';
        expect(isPaywallEnabled()).toBe(false);
        window.PAYWALL_ENABLED = true;
        expect(isPaywallEnabled()).toBe(true);
    });

    it('defaults to the seller licence endpoint', () => {
        expect(getValidateUrl()).toBe('https://api.lemonsqueezy.com/v1/licenses/validate');
    });

    it('redeems on our backend and stores the instance id, never the key', async () => {
        const backend = stubBackend({
            runMutation: vi.fn(async () => ({
                active: true,
                instanceId: 'inst-42',
                productId: '1361446',
            })),
        });

        const result = await validateLicenseKey('ABC-123');

        expect(result.valid).toBe(true);
        expect(result.entitlement).toBe('server');
        expect(backend.runMutation).toHaveBeenCalledTimes(1);

        const stored = JSON.parse(localStorage.getItem(ENTITLEMENT_STORAGE_KEY));
        expect(stored.instanceId).toBe('inst-42');
        expect(stored.productId).toBe('1361446');

        // The key must appear nowhere in local storage.
        const everything = JSON.stringify(localStorage);
        expect(everything).not.toContain('ABC-123');
    });

    it('sends a stable device id with the redemption', async () => {
        const backend = stubBackend({
            runMutation: vi.fn(async () => ({
                active: true,
                instanceId: 'inst-42',
                productId: '1361446',
            })),
        });

        await validateLicenseKey('ABC-123');
        const firstArgs = backend.runMutation.mock.calls[0][1];
        expect(firstArgs.instanceName).toBeTruthy();
        expect(firstArgs.licenseKey).toBe('ABC-123');
        expect(localStorage.getItem(DEVICE_STORAGE_KEY)).toBe(firstArgs.instanceName);
    });

    it('rejects a key the backend refuses, without touching the network', async () => {
        stubBackend({
            runMutation: vi.fn(async () => ({ active: false, reason: 'key_not_found' })),
        });
        global.fetch = vi.fn();

        const result = await validateLicenseKey('NOPE');

        expect(result.valid).toBe(false);
        expect(result.reason).toMatch(/not active/);
        expect(global.fetch).not.toHaveBeenCalled();
        expect(localStorage.getItem(ENTITLEMENT_STORAGE_KEY)).toBeNull();
    });

    it('reports an activation limit in plain words', async () => {
        stubBackend({
            runMutation: vi.fn(async () => ({ active: false, reason: 'activation_limit_reached' })),
        });
        const result = await validateLicenseKey('ABC-123');
        expect(result.reason).toMatch(/maximum number of devices/);
    });

    it('falls back to the seller endpoint when our backend is unreachable', async () => {
        stubBackend({
            runMutation: vi.fn(async () => ({ error: 'connection refused' })),
        });
        global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ valid: true }) }));

        const result = await validateLicenseKey('ABC-123');

        expect(result.valid).toBe(true);
        expect(result.entitlement).toBe('session');
        expect(global.fetch).toHaveBeenCalledTimes(1);

        // A session-only entitlement still leaves no key on disk.
        expect(JSON.stringify(localStorage)).not.toContain('ABC-123');
    });

    it('does not turn a network failure into a purchase', async () => {
        global.fetch = vi.fn(async () => {
            throw new Error('offline');
        });
        const result = await validateLicenseKey('ABC-123');
        expect(result.valid).toBe(false);
        expect(result.reason).toMatch(/Could not reach/);
    });

    it('refuses an empty key without touching the network', async () => {
        global.fetch = vi.fn();
        const result = await validateLicenseKey('   ');
        expect(result.valid).toBe(false);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('exchanges the interim build’s stored key and then erases it', async () => {
        localStorage.setItem(
            LEGACY_LICENSE_STORAGE_KEY,
            JSON.stringify({ key: 'LEGACY-KEY', validatedAt: '2026-10-01T00:00:00.000Z' })
        );
        stubBackend({
            runMutation: vi.fn(async () => ({
                active: true,
                instanceId: 'inst-7',
                productId: '1361446',
            })),
        });

        const result = await validateLicenseKey('LEGACY-KEY');

        expect(result.valid).toBe(true);
        expect(localStorage.getItem(LEGACY_LICENSE_STORAGE_KEY)).toBeNull();
        expect(JSON.stringify(localStorage)).not.toContain('LEGACY-KEY');
    });
});

describe('UnlockGate entitlement checks', () => {
    beforeEach(() => {
        localStorage.clear();
        window.PAYWALL_ENABLED = true;
        delete window.ShapeKeeperConvexShared;
        window.history.replaceState({}, '', '/');
    });

    afterEach(() => {
        delete window.ShapeKeeperConvexShared;
        vi.restoreAllMocks();
    });

    it('turns the entitlement off when the backend no longer honours it', async () => {
        const setEntitled = vi.spyOn(LevelsProgress, 'setEntitled');
        localStorage.setItem(
            ENTITLEMENT_STORAGE_KEY,
            JSON.stringify({ instanceId: 'inst-42', productId: '1361446' })
        );
        stubBackend({
            runQuery: vi.fn(async () => ({ active: false, productId: null })),
        });

        const result = await revalidateStoredLicense();

        expect(result).toEqual({ checked: true, valid: false });
        expect(setEntitled).toHaveBeenCalledWith(false);
        expect(localStorage.getItem(ENTITLEMENT_STORAGE_KEY)).toBeNull();
    });

    it('keeps the entitlement when the backend cannot be reached', async () => {
        const setEntitled = vi.spyOn(LevelsProgress, 'setEntitled');
        localStorage.setItem(
            ENTITLEMENT_STORAGE_KEY,
            JSON.stringify({ instanceId: 'inst-42', productId: '1361446' })
        );
        stubBackend({
            runQuery: vi.fn(async () => ({ error: 'offline' })),
        });

        const result = await revalidateStoredLicense();

        expect(result.checked).toBe(false);
        expect(setEntitled).not.toHaveBeenCalled();
        expect(localStorage.getItem(ENTITLEMENT_STORAGE_KEY)).not.toBeNull();
    });

    it('redeems a key that arrives in the URL and strips it from the address', async () => {
        window.history.replaceState({}, '', '/?redeem=URL-KEY-123');
        const setEntitled = vi.spyOn(LevelsProgress, 'setEntitled');
        stubBackend({
            runMutation: vi.fn(async () => ({
                active: true,
                instanceId: 'inst-9',
                productId: '1361446',
            })),
        });

        const result = await redeemFromUrl();

        expect(result).toEqual({ redeemed: true, entitled: true });
        expect(setEntitled).toHaveBeenCalledWith(true);
        expect(window.location.search).not.toContain('URL-KEY-123');
        expect(JSON.stringify(localStorage)).not.toContain('URL-KEY-123');
    });

    it('does nothing when the URL carries no key', async () => {
        const backend = stubBackend({});
        const result = await redeemFromUrl();
        expect(result).toEqual({ redeemed: false });
        expect(backend.runMutation).not.toHaveBeenCalled();
    });
});
