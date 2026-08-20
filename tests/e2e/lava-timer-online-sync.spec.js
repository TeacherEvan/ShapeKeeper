import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers/bootstrap.js';

/**
 * Task 8 (FR-6 / FR-1) end-to-end gate for the Lava Timer feature flag.
 *
 * The lava timer + sync resilience ship ON by default (set in index.html via
 * `window.FEATURE_* ?? true`). The bridge in game.js copies window.FEATURE_*
 * into the static FEATURE_FLAGS and exposes a live window.FEATURE_FLAGS mirror.
 *
 * This E2E's job: prove the window.FEATURE_* -> FEATURE_FLAGS bridge works both
 * ways — default-ON, explicit-ON, and explicit opt-out. Actual rendering (40%
 * opacity + countdown behind dots in an online match) is proven authoritatively
 * by tests/lava-timer-renders.test.js against the real Renderer.drawLavaTimerLayer().
 */

test.describe('lava timer feature flag gating', () => {
    test('defaults ON (shipped on) when no window flag is set', async ({ page }) => {
        await gotoApp(page);

        const flags = await page.evaluate(() => ({
            lava: window.FEATURE_FLAGS.FEATURE_LAVA_TIMER,
            sync: window.FEATURE_FLAGS.FEATURE_SYNC_RESILIENCE,
        }));
        expect(flags.lava).toBe(true);
        expect(flags.sync).toBe(true);
    });

    test('explicit window.FEATURE_LAVA_TIMER=true still flips the runtime flag', async ({
        page,
    }) => {
        await page.addInitScript(() => {
            window.FEATURE_LAVA_TIMER = true;
            window.FEATURE_SYNC_RESILIENCE = true;
        });
        await gotoApp(page);

        const flags = await page.evaluate(() => ({
            lava: window.FEATURE_FLAGS.FEATURE_LAVA_TIMER,
            sync: window.FEATURE_FLAGS.FEATURE_SYNC_RESILIENCE,
        }));
        expect(flags.lava).toBe(true);
        expect(flags.sync).toBe(true);
    });

    test('flag can be opted OUT via window.FEATURE_LAVA_TIMER=false', async ({ page }) => {
        await page.addInitScript(() => {
            window.FEATURE_LAVA_TIMER = false;
            window.FEATURE_SYNC_RESILIENCE = false;
        });
        await gotoApp(page);

        const flags = await page.evaluate(() => ({
            lava: window.FEATURE_FLAGS.FEATURE_LAVA_TIMER,
            sync: window.FEATURE_FLAGS.FEATURE_SYNC_RESILIENCE,
        }));
        expect(flags.lava).toBe(false);
        expect(flags.sync).toBe(false);
    });
});
