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

// Initialize core instances
let welcomeAnimation = null;
// Prefer the live manager for online mode; keep the legacy LobbyManager for
// any non-Convex fallback path (no backend available, local play, etc.).
let liveLobbyManager = new LiveLobbyManager();
let lobbyManager = liveLobbyManager; // alias used by MenuNavigation (online path)
let game = null;

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
    // `?join=ABC123&passcode=EasterPig` on the URL jumps the user to the
    // join screen with the inputs filled in and the button enabled.
    const joinParams = getJoinParamsFromUrl();
    if (joinParams) {
        prefillJoinScreen(joinParams);
    }
}

/**
 * Move the user to the join screen and populate the code/passcode/name
 * inputs. Called when the page loads with `?join=…` URL params.
 * @param {{roomCode: string, passcode: string|null}} params
 */
function prefillJoinScreen(params) {
    const joinScreen = document.getElementById('joinScreen');
    const codeInput = document.getElementById('joinRoomCode');
    const passcodeInput = document.getElementById('joinRoomPasscode');
    const nameInput = document.getElementById('joinPlayerName');
    if (!joinScreen || !codeInput) return;

    // Hide every other screen, show join.
    document.querySelectorAll('.screen').forEach((s) => {
        s.hidden = true;
        s.setAttribute('aria-hidden', 'true');
    });
    joinScreen.hidden = false;
    joinScreen.setAttribute('aria-hidden', 'false');

    codeInput.value = params.roomCode;
    if (passcodeInput) passcodeInput.value = params.passcode || '';
    if (nameInput) nameInput.focus();

    // Re-run the validation handler so the Join button enables.
    codeInput.dispatchEvent(new Event('input', { bubbles: true }));
    if (passcodeInput) passcodeInput.dispatchEvent(new Event('input', { bubbles: true }));
    if (nameInput) nameInput.dispatchEvent(new Event('input', { bubbles: true }));
}

// Export for global access (needed for Convex integration)
window.handleRoomUpdate = handleRoomUpdate;
window.handleGameStateUpdate = handleGameStateUpdate;
