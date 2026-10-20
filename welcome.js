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
import { HomePager } from './src/ui/home/HomePager.js';
import { AmbientSoundscape } from './src/audio/AmbientSoundscape.js';

// Initialize core instances
let welcomeAnimation = null;
let homePager = null;
let soundscape = null;
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

    // Initialize ambient soundscape
    soundscape = new AmbientSoundscape();
    window.ambientSoundscape = soundscape;

    // Initialize welcome animation
    welcomeAnimation = new WelcomeAnimation();
    window.welcomeAnimation = welcomeAnimation;

    // Connect animation interactions to hypnotic soundscape
    welcomeAnimation.onInteraction((event) => {
        if (soundscape) {
            soundscape.handleInteraction(event);
        }
    });

    // Initialize home pager for sideways sliding
    const homeMenuLayer = document.getElementById('homeMenuLayer');
    const mainMenuScreen = document.getElementById('mainMenuScreen');
    const returnBtn = document.getElementById('sideScreenReturnBtn');
    const pagerDotsContainer = document.getElementById('homePagerDots');

    const updatePagerUI = (pos) => {
        if (returnBtn) {
            returnBtn.hidden = pos === 0;
        }
        if (pagerDotsContainer) {
            pagerDotsContainer.querySelectorAll('.pager-dot').forEach((dot) => {
                const dotPage = Number(dot.dataset.page);
                dot.classList.toggle('active', dotPage === pos);
            });
        }
        if (welcomeAnimation) {
            welcomeAnimation.setSideScreenActive(pos !== 0);
        }
    };

    if (homeMenuLayer && mainMenuScreen) {
        homePager = new HomePager(homeMenuLayer, {
            container: mainMenuScreen,
            isSpriteTouchedFn: (x, y) =>
                Boolean(welcomeAnimation && welcomeAnimation.hitTestSprite(x, y)),
            onPageChange: (pos) => updatePagerUI(pos),
        });
        window.homePager = homePager;

        if (returnBtn) {
            returnBtn.addEventListener('click', () => {
                if (homePager) homePager.goTo(0);
            });
        }

        if (pagerDotsContainer) {
            pagerDotsContainer.addEventListener('click', (e) => {
                const dot = e.target.closest('.pager-dot');
                if (dot && homePager) {
                    homePager.goTo(Number(dot.dataset.page));
                }
            });
        }
    }

    // Reset pager and fade soundscape when switching away from main menu
    window.addEventListener('shapekeeper:screenChanged', (e) => {
        if (e.detail?.screenId !== 'mainMenuScreen') {
            if (homePager) homePager.reset();
            updatePagerUI(0);
            if (soundscape) soundscape.fadeOut(1);
        }
    });

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
