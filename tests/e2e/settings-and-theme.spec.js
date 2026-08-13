import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers/bootstrap-app.js';

test.describe('Settings: theme and sound toggles', () => {
    test('theme toggle switches between light and dark and persists to localStorage', async ({
        page,
    }) => {
        await gotoApp(page);

        const root = page.locator('html');
        // default theme is light
        await expect(root).toHaveAttribute('data-theme', 'light');

        const themeToggle = page.locator('#themeToggle');
        await expect(themeToggle).toHaveAttribute('aria-label', 'Switch to dark mode');

        await themeToggle.click();
        await expect(root).toHaveAttribute('data-theme', 'dark');
        await expect(themeToggle).toHaveAttribute('aria-label', 'Switch to light mode');

        const stored = await page.evaluate(() =>
            localStorage.getItem('shapekeeper_theme')
        );
        expect(stored).toBe('dark');

        // reload and confirm persistence
        await page.reload();
        await expect(root).toHaveAttribute('data-theme', 'dark');
    });

    test('sound toggle flips muted state and icon', async ({ page }) => {
        // soundToggle lives in the in-game HUD, so start a local game first
        await gotoApp(page);
        await page.locator('#localPlayBtn').click();
        await page.locator('.local-grid-btn[data-size="5"]').click();
        await page.locator('#startLocalGame').click();
        await expect(page.getByTestId('game-screen')).toHaveClass(/active/);

        const soundToggle = page.locator('#soundToggle');
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
