/**
 * Lobby invite-link smoke tests.
 *
 * These are deliberately minimal — they exercise the new lobby surface
 * (URL pre-fill, invite-link button) without requiring a
 * full Convex deployment. The deeper host-creates/guest-joins E2E lives in
 * multiplayer-startup.spec.js.
 */
import { expect, test } from '@playwright/test';

test.describe('lobby invite link', () => {
    test('pre-fills the join screen from ?join= URL params', async ({ page }) => {
        await page.goto('/?join=ABC123');

        const codeInput = page.getByTestId('join-room-code-input');

        await expect(codeInput).toHaveValue('ABC123');
    });

    test('ignores the URL when no ?join param is present (no error)', async ({ page }) => {
        await page.goto('/');
        // Should land on the main menu; the join screen should not be visible.
        await expect(page.getByTestId('join-screen')).toBeHidden();
    });
});
