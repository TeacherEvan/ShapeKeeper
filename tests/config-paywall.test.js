import { afterEach, describe, expect, it } from 'vitest';

/**
 * The payment platform is not ready yet. The level gate stays in the source
 * tree (archived, reapply-ready) but config.js must leave it OFF so all 100
 * levels remain playable.
 */
describe('runtime config — archived level paywall', () => {
    afterEach(() => {
        delete window.PAYWALL_ENABLED;
    });

    it('defaults PAYWALL_ENABLED to false', async () => {
        delete window.PAYWALL_ENABLED;

        await import('../config.js');

        expect(window.PAYWALL_ENABLED).toBe(false);
    });
});
