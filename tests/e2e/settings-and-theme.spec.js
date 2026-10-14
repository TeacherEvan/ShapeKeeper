import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers/bootstrap-app.js';
import { openGameControls } from './helpers/bootstrap.js';

test.describe('Settings: theme and sound toggles', () => {
    test('theme toggle switches between light and dark and persists to localStorage', async ({
        page,
    }) => {
        await gotoApp(page);

        const root = page.locator('html');
        // default theme is the cosmic void (dark)
        await expect(root).toHaveAttribute('data-theme', 'dark');

        const themeToggle = page.locator('#themeToggle');
        await expect(themeToggle).toHaveAttribute('aria-label', 'Switch to light mode');

        await themeToggle.click();
        await expect(root).toHaveAttribute('data-theme', 'light');
        await expect(themeToggle).toHaveAttribute('aria-label', 'Switch to dark mode');

        const stored = await page.evaluate(() => localStorage.getItem('shapekeeper_theme'));
        expect(stored).toBe('light');

        // reload and confirm persistence
        await page.reload();
        await expect(root).toHaveAttribute('data-theme', 'light');
    });

    test('sound toggle flips muted state and icon', async ({ page }) => {
        // soundToggle lives in the in-game HUD, so start a local game first
        await gotoApp(page);
        await page.locator('#localPlayBtn').click();
        await expect(page.locator('#localSetupScreen')).toHaveClass(/active/);
        await page.locator('.local-grid-btn[data-size="5"]').click();
        await page.locator('#startLocalGame').click();
        await expect(page.getByTestId('game-screen')).toHaveClass(/active/);

        const soundToggle = page.locator('#soundToggle');
        await openGameControls(page);
        // initial state: enabled -> 🔊, not muted
        await expect(soundToggle).toHaveText('🔊');
        await expect(soundToggle).not.toHaveClass(/muted/);

        await soundToggle.click();
        await expect(soundToggle).toHaveText('🔇');
        await expect(soundToggle).toHaveClass(/muted/);

        await soundToggle.click();
        await expect(soundToggle).toHaveText('🔊');
        await expect(soundToggle).not.toHaveClass(/muted/);
    });
});
