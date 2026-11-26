export { gotoApp } from './bootstrap-app.js';
export { openGameControls, closeGameControls } from './game-controls.js';
export { installMockMultiplayer } from './bootstrap-local-multiplayer.js';
export {
    createSharedMockMultiplayerPages,
    installSharedMockMultiplayer,
} from './bootstrap-shared-multiplayer.js';

export async function openLocalSetupScreen(page) {
    await page.evaluate(async () => {
        const { showScreen } = await import('/src/ui/ScreenTransition.js');
        showScreen('localSetupScreen');
    });
    await page.locator('#localSetupScreen').waitFor({ state: 'visible' });
}
