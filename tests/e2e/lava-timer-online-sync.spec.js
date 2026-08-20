import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers/bootstrap.js';

/**
 * Task 8 (FR-6 / FR-1) end-to-end gate for the Lava Timer feature flag.
 *
 * Proves the plan's stated contract ("flags enabled via window.FEATURE_* at
 * runtime") actually flips the runtime flag — without the bridge in game.js,
 * these flags are permanently false and the lava clock is dead code in the
 * running app. The bridge exposes a live window.FEATURE_FLAGS mirror reflecting
 * the exact guard renderer.js:108 / turn-clock-controller.js:65 read.
 */

test.describe('lava timer feature flag gating', () => {
    test('FEATURE_LAVA_TIMER=true (via window) flips the runtime flag', async ({ page }) => {
        await page.addInitScript(() => {
            window.FEATURE_LAVA_TIMER = true;
            window.FEATURE_SYNC_RESILIENCE = true;
        });
        await gotoApp(page);

        // The bridge in game.js must have copied window.* into the live mirror.
        const flags = await page.evaluate(() => ({
            lava: window.FEATURE_FLAGS.FEATURE_LAVA_TIMER,
            sync: window.FEATURE_FLAGS.FEATURE_SYNC_RESILIENCE,
        }));
        expect(flags.lava).toBe(true);
        expect(flags.sync).toBe(true);
    });

    test('flag defaults OFF when window.FEATURE_LAVA_TIMER is not set', async ({ page }) => {
        await gotoApp(page);

        const flags = await page.evaluate(() => ({
            lava: window.FEATURE_FLAGS.FEATURE_LAVA_TIMER,
            sync: window.FEATURE_FLAGS.FEATURE_SYNC_RESILIENCE,
        }));
        expect(flags.lava).toBe(false);
        expect(flags.sync).toBe(false);
    });
});
