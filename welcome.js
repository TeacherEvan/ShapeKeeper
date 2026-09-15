/**
 * ShapeKeeper Welcome Screen Entry Point
 * Orchestrates all UI modules for the welcome screen
 */

import { LiveLobbyManager, getJoinParamsFromUrl } from './src/ui/LiveLobbyManager.js';
import {
    handleGameStateUpdate,
    handleRoomUpdate,
    initializeMenuNavigation,
    setMenuNavigationDependencies,
} from './src/ui/MenuNavigation.js';
import { initializeTheme } from './src/ui/ThemeManager.js';
import { WelcomeAnimation } from './src/ui/WelcomeAnimation.js';
import { showScreen } from './src/ui/ScreenTransition.js';

// Initialize core instances
let welcomeAnimation = null;
// Prefer the live manager for online mode; keep the legacy LobbyManager for
// any non-Convex fallback path (no backend available, local play, etc.).
let liveLobbyManager = new LiveLobbyManager();
let lobbyManager = liveLobbyManager; // alias used by MenuNavigation (online path)
let game = null;

console.log('[welcome] Module loaded, search:', window.location.search);
window.__welcomeModuleLoaded = true;

// Set dependencies for menu navigation
setMenuNavigationDependencies({
    lobbyManager,
    welcomeAnimation,
    game,
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

function initializeApp() {
    console.log('[welcome] initializeApp running, search:', window.location.search);
    try {
        // Initialize theme
        initializeTheme();

        // Initialize welcome animation
        welcomeAnimation = new WelcomeAnimation();

        // Update menu navigation dependencies with the animation instance
        setMenuNavigationDependencies({
            lobbyManager,
            welcomeAnimation,
            game,
        });

        // Initialize menu navigation
        initializeMenuNavigation();

        // Pre-fill the join screen from an invite link, if present.
        // `?join=LOBBY` on the URL jumps the user to the join screen with
        // the lobby name pre-filled.
        const joinParams = getJoinParamsFromUrl();
        console.log('[welcome] joinParams:', joinParams);
        if (joinParams) {
            prefillJoinScreen(joinParams);
        }
    } catch (err) {
        console.error('[welcome] initializeApp error:', err);
    }
}

/**
 * Move the user to the join screen and populate the lobby name input.
 * Called when the page loads with `?join=…` URL params.
 * @param {{roomCode: string, passcode: string|null}} params
 */
function prefillJoinScreen(params) {
    const codeInput = document.getElementById('joinRoomCode');
    const nameInput = document.getElementById('joinPlayerName');
    if (!codeInput) return;

    showScreen('joinScreen');

    codeInput.value = params.roomCode;
    if (nameInput) nameInput.focus();

    // Store the passcode on the lobbyManager for use when joining
    if (params.passcode && lobbyManager) {
        lobbyManager.passcode = params.passcode;
    }

    // Re-run the validation handler so the Join button enables.
    codeInput.dispatchEvent(new Event('input', { bubbles: true }));
    if (nameInput) nameInput.dispatchEvent(new Event('input', { bubbles: true }));
}

// Export for global access (needed for Convex integration)
window.handleRoomUpdate = handleRoomUpdate;
window.handleGameStateUpdate = handleGameStateUpdate;
