// Verification: showScreen must not leave a focused element inside an
// aria-hidden screen. Reproduces the two transitions that previously threw
// "Blocked aria-hidden on a focused element" (localPlayBtn -> setup/game, and
// exitGame -> menu) and asserts the warning never appears in the console.
import { expect, test } from '@playwright/test';

import { gotoApp } from './helpers/bootstrap.js';

test('no aria-hidden focus warning on menu -> game transition', async ({ page }) => {
    const warnings = [];
    page.on('console', (msg) => {
        if (msg.type() === 'error' && /aria-hidden/.test(msg.text())) {
            warnings.push(msg.text());
        }
    });

    await gotoApp(page);
    await expect(page.locator('#localPlayBtn')).toBeVisible();
    await page.locator('#localPlayBtn').click();

    await expect(page.locator('#localSetupScreen')).toHaveClass(/active/);
    await page.locator('#localSetupScreen .local-grid-btn[data-size="5"]').click();
    await page.locator('#startLocalGame').click();

    await expect(page.getByTestId('game-screen')).toHaveClass(/active/);
    expect(warnings, `aria-hidden warnings:\n${warnings.join('\n')}`).toEqual([]);
});

test('no aria-hidden focus warning on exitGame -> menu transition', async ({ page }) => {
    const warnings = [];
    page.on('console', (msg) => {
        if (msg.type() === 'error' && /aria-hidden/.test(msg.text())) {
            warnings.push(msg.text());
        }
    });

    await gotoApp(page);
    await page.locator('#localPlayBtn').click();
    await page.locator('#localSetupScreen .local-grid-btn[data-size="5"]').click();
    await page.locator('#startLocalGame').click();
    await expect(page.getByTestId('game-screen')).toHaveClass(/active/);

    await page.locator('#exitGame').click();
    await expect(page.locator('#mainMenuScreen')).toHaveClass(/active/);
    expect(warnings, `aria-hidden warnings:\n${warnings.join('\n')}`).toEqual([]);
});
