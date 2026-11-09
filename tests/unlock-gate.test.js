import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getValidateUrl, isPaywallEnabled, validateLicenseKey } from '../src/ui/UnlockGate.js';

describe('UnlockGate licence validation', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        localStorage.clear();
        window.PAYWALL_ENABLED = undefined;
        window.LICENSE_VALIDATE_URL = undefined;
    });

    afterEach(() => {
        global.fetch = originalFetch;
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

    it('accepts a key the seller reports valid', async () => {
        global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ valid: true }) }));
        await expect(validateLicenseKey('ABC-123')).resolves.toEqual({ valid: true, reason: '' });

        expect(global.fetch).toHaveBeenCalledTimes(1);
        const [url, init] = global.fetch.mock.calls[0];
        expect(url).toBe('https://api.lemonsqueezy.com/v1/licenses/validate');
        expect(init.method).toBe('POST');
        expect(init.body).toBe('license_key=ABC-123');
    });

    it('rejects a key the seller reports inactive', async () => {
        global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ valid: false }) }));
        const result = await validateLicenseKey('NOPE');
        expect(result.valid).toBe(false);
        expect(result.reason).toMatch(/not active/);
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
});
