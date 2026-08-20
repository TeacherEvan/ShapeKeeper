import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers/bootstrap.js';

/**
 * Task 8 (FR-6 / FR-1) end-to-end gate for the Lava Timer feature flag.
 *
 * This E2E's unique job: prove the plan's stated contract ("flags enabled via
 * window.FEATURE_* at runtime") actually flips the runtime guard. Without the
 * bridge in game.js the flags are permanently false and the lava clock is dead
 * code in the running app. The bridge exposes a live window.FEATURE_FLAGS mirror.
 *
 * NOTE: actual rendering (40% opacity + countdown behind dots in an online
 * match) is proven authoritatively by tests/lava-timer-renders.test.js against
 * the real Renderer.drawLavaTimerLayer(); we do not re-assert drawing here to
 * avoid exposing internal modules on window.
 */

test.describe('lava timer feature flag gating', () => {
    test('FEATURE_LAVA_TIMER=true (via window) flips the runtime flag', async ({ page }) => {
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
