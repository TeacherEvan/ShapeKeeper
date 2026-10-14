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

    // Invite-link deep link (?join=CODE): open lobbies are joined straight
    // from the browser, but an old-style invite link still jumps directly
    // into that lobby. The menu event bindings pick up this event and run
    // the join (they own the Convex wiring).
    const joinParams = getJoinParamsFromUrl();
    if (joinParams) {
        window.dispatchEvent(new CustomEvent('shapekeeper:joinFromUrl', { detail: joinParams }));
    }
}

// Export for global access (needed for Convex integration)
window.handleRoomUpdate = handleRoomUpdate;
window.handleGameStateUpdate = handleGameStateUpdate;
