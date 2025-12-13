/**
 * ShapeKeeper Module System
 * Main entry point for ES6 modules with lazy loading and code splitting
 *
 * @module shapekeeper
 * @version 4.2.0
 *
 * TODO: [OPTIMIZATION] Consider implementing Web Workers for particle physics
 * TODO: [OPTIMIZATION] Implement offscreen canvas for static background rendering
 * TODO: [ARCHITECTURE] Consider using IndexedDB for game state persistence
 */

// Core utilities and constants - always loaded (small bundle)
export * from './core/index.js';

// Sound system
export { SoundManager } from './sound/index.js';

// Visual effects
export { ParticleSystem, TileEffectsManager } from './effects/index.js';

// Animation systems
export { KissEmojiSystem, SquareAnimationSystem } from './animations/index.js';

// Game logic
export { GameState, InputHandler, MultiplierSystem } from './game/index.js';

// UI systems
export * from './ui/index.js';

/**
 * Module version - follows semver
 */
export const VERSION = '4.2.0';

/**
 * Lazy load heavy modules on-demand for optimal initial load performance
 * Uses dynamic imports for code splitting - only loads modules when needed
 *
 * @async
 * @param {HTMLCanvasElement} gameCanvas - Main game canvas element
 * @returns {Promise<GameSystemsBundle>} Initialized game systems bundle
 *
 * @example
 * const systems = await createGameSystems(document.getElementById('gameCanvas'));
 * systems.sound.playLineSound();
 * systems.particles.createBurst(100, 100, '#FF0000');
 */
export async function createGameSystems(gameCanvas) {
    // TODO: [PERFORMANCE] Consider implementing a loading progress callback
    // TODO: [OPTIMIZATION] Add module preloading hints via <link rel="modulepreload">

    // Dynamic imports for lazy loading (ES6 pattern)
    // Each import creates a separate chunk when bundled
    const [
        { SoundManager },
        { ParticleSystem },
        { TileEffectsManager },
        { KissEmojiSystem },
        { SquareAnimationSystem },
        { InputHandler },
        { MultiplierSystem },
        { GameState },
    ] = await Promise.all([
        import('./sound/SoundManager.js'),
        import('./effects/ParticleSystem.js'),
        import('./effects/TileEffects.js'),
        import('./animations/KissEmojiSystem.js'),
        import('./animations/SquareAnimations.js'),
        import('./game/InputHandler.js'),
        import('./game/MultiplierSystem.js'),
        import('./game/GameState.js'),
    ]);

    return {
        soundManager: new SoundManager(),
        particleRenderer: new ParticleSystem(gameCanvas),
        tileEffectsController: new TileEffectsManager(),
        kissEmojiAnimator: new KissEmojiSystem(),
        squareAnimationController: new SquareAnimationSystem(),
        inputController: new InputHandler(gameCanvas),
        multiplierController: new MultiplierSystem(),
        gameStateManager: new GameState(),
    };
}

/**
 * Preload critical assets before game start
 * Call this during loading screen for smoother gameplay start
 *
 * @async
 * @returns {Promise<void>}
 */
export async function preloadCriticalAssets() {
    // TODO: [OPTIMIZATION] Add actual asset preloading when assets are added
    // TODO: [PERFORMANCE] Consider using the Fetch API with cache hints

    // Preload modules that will be needed immediately
    await Promise.all([
        import('./sound/SoundManager.js'),
        import('./effects/ParticleSystem.js'),
        import('./game/GameState.js'),
    ]);
}

/**
 * @typedef {Object} GameSystemsBundle
 * @property {SoundManager} soundManager - Audio system controller
 * @property {ParticleSystem} particleRenderer - Visual particle effects system
 * @property {TileEffectsManager} tileEffectsController - Tile effects (traps/powerups)
 * @property {KissEmojiSystem} kissEmojiAnimator - Kiss emoji animation system
 * @property {SquareAnimationSystem} squareAnimationController - Square completion animations
 * @property {InputHandler} inputController - Touch/mouse input handler
 * @property {MultiplierSystem} multiplierController - Score multiplier system
 * @property {GameState} gameStateManager - Core game state management
 */
