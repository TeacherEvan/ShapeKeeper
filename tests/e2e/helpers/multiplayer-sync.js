import { expect } from '@playwright/test';

import { createSharedMockMultiplayerPages } from './bootstrap.js';

export function trackPageErrors(page) {
    const pageErrors = [];
    const consoleErrors = [];

    page.on('pageerror', (error) => {
        pageErrors.push(error.message);
    });

    page.on('console', (message) => {
        if (message.type() === 'error') {
            consoleErrors.push(message.text());
        }
    });

    return { consoleErrors, pageErrors };
}

export function expectNoBrowserErrors(errorState) {
    expect(errorState.pageErrors).toEqual([]);
    expect(errorState.consoleErrors).toEqual([]);
}

export async function expectTurnIndicators({ hostPage, guestPage }, { hostText, guestText }) {
    await expect(hostPage.locator('#turnIndicator')).toHaveText(hostText);
    await expect(guestPage.locator('#turnIndicator')).toHaveText(guestText);
}

export async function bootstrapLobby(browser, options = {}) {
    const roomCode = options.roomCode || 'SYNC42';
    const session = await createSharedMockMultiplayerPages(browser, {
        roomCode,
        startupTimeoutMs: 1500,
        ...options,
    });

    const { hostPage, guestPage } = session;
    const hostErrors = trackPageErrors(hostPage);
    const guestErrors = trackPageErrors(guestPage);

    await hostPage.getByTestId('create-game-button').click();
    await expect(hostPage.getByTestId('lobby-screen')).toHaveClass(/active/);
    await expect(hostPage.getByTestId('room-code')).toHaveText(roomCode);

    await guestPage.getByTestId('join-game-button').click();
    await expect(guestPage.getByTestId('join-screen')).toHaveClass(/active/);
    await guestPage.getByTestId('join-room-code-input').fill(roomCode);
    await guestPage.getByTestId('join-player-name-input').fill('Guest');
    await guestPage.getByTestId('join-room-button').click();

    await expect(guestPage.getByTestId('lobby-screen')).toHaveClass(/active/);
    await expect(guestPage.getByTestId('players-list')).toContainText('Host');
    await expect(guestPage.getByTestId('players-list')).toContainText('Guest');
    await expect(hostPage.getByTestId('players-list')).toContainText('Guest');

    return {
        ...session,
        guestErrors,
        guestPage,
        hostErrors,
        hostPage,
        roomCode,
    };
}

export async function bootstrapLiveMatch(browser, options = {}) {
    const session = await bootstrapLobby(browser, options);
    const { hostPage, guestPage } = session;

    await hostPage.getByTestId('ready-button').click();
    await guestPage.getByTestId('ready-button').click();
    await expect(hostPage.getByTestId('start-multiplayer-game')).toBeEnabled();

    await hostPage.getByTestId('start-multiplayer-game').click();

    await expect(hostPage.getByTestId('game-screen')).toHaveClass(/active/);
    await expect(guestPage.getByTestId('game-screen')).toHaveClass(/active/);
    await expect(hostPage.getByTestId('startup-overlay')).toHaveAttribute(
        'data-startup-phase',
        'in_match'
    );
    await expect(guestPage.getByTestId('startup-overlay')).toHaveAttribute(
        'data-startup-phase',
        'in_match'
    );

    return session;
}
