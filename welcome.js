/**
 * ShapeKeeper Welcome Screen Entry Point
 * Orchestrates all UI modules for the welcome screen
 */

import { LobbyManager } from './src/ui/LobbyManager.js';
import { handleGameStateUpdate, handleRoomUpdate, initializeMenuNavigation, setMenuNavigationDependencies } from './src/ui/MenuNavigation.js';
import { initializeTheme } from './src/ui/ThemeManager.js';
import { WelcomeAnimation } from './src/ui/WelcomeAnimation.js';

// Initialize core instances
let welcomeAnimation = null;
let lobbyManager = new LobbyManager();
let game = null;

// Set dependencies for menu navigation
setMenuNavigationDependencies({
    lobbyManager,
    welcomeAnimation,
    game
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
        game
    });

    // Initialize menu navigation
    initializeMenuNavigation();
}

// Export for global access (needed for Convex integration)
window.handleRoomUpdate = handleRoomUpdate;
window.handleGameStateUpdate = handleGameStateUpdate;