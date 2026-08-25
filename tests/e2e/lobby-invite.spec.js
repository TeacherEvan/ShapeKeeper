/**
 * Lobby invite-link smoke tests.
 *
 * These are deliberately minimal — they exercise the new lobby surface
 * (URL pre-fill, invite-link button, passcode rendering) without requiring a
 * full Convex deployment. The deeper host-creates/guest-joins E2E lives in
 * multiplayer-startup.spec.js.
 */
import { expect, test } from '@playwright/test';

import { gotoApp } from './helpers/bootstrap.js';

test.describe('lobby invite link', () => {
    test('pre-fills the join screen from ?join=…&passcode=… URL params', async ({ page }) => {
        await page.goto('/?join=ABC123&passcode=EasterPig');

        const codeInput = page.getByTestId('join-room-code-input');
        const passcodeInput = page.getByTestId('join-room-passcode-input');

        await expect(codeInput).toHaveValue('ABC123');
        await expect(passcodeInput).toHaveValue('EasterPig');
    });

    test('uppercases a lowercase room code in the pre-fill', async ({ page }) => {
        await page.goto('/?join=abc123&passcode=sillyrabbit');
        await expect(page.getByTestId('join-room-code-input')).toHaveValue('ABC123');
    });

    test('ignores the URL when no ?join= param is present (no error)', async ({ page }) => {
        await page.goto('/');
        // Should land on the main menu; the join screen should not be visible.
        await expect(page.getByTestId('join-screen')).toBeHidden();
    });

    test('passcode input is present on the join screen', async ({ page }) => {
        await page.goto('/?join=ABC123');
        await expect(page.getByTestId('join-room-passcode-input')).toBeVisible();
    });
});
