/**
 * E2E for the in-game controls panel (double-tap-to-open).
 *
 * The panel is a mobile-first UX guard: the footer action buttons used to be
 * cut off by the device's bottom nav bar. They now live in a collapsible
 * panel that opens behind a small toggle button. Opening requires a
 * double-tap (UX guard against accidental triggers during gameplay);
 * closing is a single tap.
 */
import { expect, test } from '@playwright/test';

import { closeGameControls, openGameControls } from './helpers/bootstrap.js';

/** Start a local game on a 5x5 board; used by every test in this file. */
async function startLocalGameAt5x5(page) {
    await page.goto('/');
    await page.locator('#localPlayBtn').click();
    await expect(page.locator('#localSetupScreen')).toHaveClass(/active/);
    await page.locator('.local-grid-btn[data-size="5"]').click();
    await expect(page.locator('#startLocalGame')).toBeEnabled();
    await page.locator('#startLocalGame').click();
    await expect(page.getByTestId('game-screen')).toHaveClass(/active/);
}

test.describe('game controls panel (double-tap to open)', () => {
    test('the panel is hidden by default and the toggle is visible', async ({ page }) => {
        await startLocalGameAt5x5(page);

        const toggle = page.getByTestId('game-controls-toggle');
        await expect(toggle).toBeVisible();
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await expect(page.getByTestId('game-controls-panel')).toBeHidden();
    });

    test('a single tap only primes the toggle, does not open the panel', async ({ page }) => {
        await startLocalGameAt5x5(page);

        const toggle = page.getByTestId('game-controls-toggle');
        await toggle.click();
        // Still closed, but primed.
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await expect(toggle).toHaveClass(/primed/);
        await expect(page.getByTestId('game-controls-panel')).toBeHidden();
    });

    test('two taps within the window open the panel', async ({ page }) => {
        await startLocalGameAt5x5(page);

        const toggle = page.getByTestId('game-controls-toggle');
        await toggle.dblclick();
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await expect(page.getByTestId('game-controls-panel')).toBeVisible();
        // The action buttons are inside the panel.
        await expect(page.locator('#undoBtn')).toBeVisible();
        await expect(page.locator('#redoBtn')).toBeVisible();
        await expect(page.locator('#populateBtn')).toBeVisible();
    });

    test('a single tap on the toggle closes the panel', async ({ page }) => {
        await startLocalGameAt5x5(page);

        await openGameControls(page);
        await closeGameControls(page);
        await expect(page.getByTestId('game-controls-panel')).toBeHidden();
    });

    test('opening + closing is idempotent and round-trips cleanly', async ({ page }) => {
        await startLocalGameAt5x5(page);

        for (let i = 0; i < 3; i += 1) {
            await openGameControls(page);
            await expect(page.getByTestId('game-controls-panel')).toBeVisible();
            await closeGameControls(page);
            await expect(page.getByTestId('game-controls-panel')).toBeHidden();
        }
    });
});
