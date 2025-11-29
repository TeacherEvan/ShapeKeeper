/**
 * ShapeKeeper Module System
 * Main entry point for ES6 modules
 * @module shapekeeper
 */

// Core utilities and constants
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
 * Module version
 */
export const VERSION = '4.1.0';

/**
 * Quick setup helper for modular game initialization
 * @param {HTMLCanvasElement} canvas - Game canvas
 * @returns {Object} Initialized systems
 */
export function createGameSystems(canvas) {
    // Dynamic imports for lazy loading (ES6 pattern)
    return Promise.all([
        import('./sound/SoundManager.js'),
        import('./effects/ParticleSystem.js'),
        import('./effects/TileEffects.js'),
        import('./animations/KissEmojiSystem.js'),
        import('./animations/SquareAnimations.js'),
        import('./game/InputHandler.js'),
        import('./game/MultiplierSystem.js'),
        import('./game/GameState.js')
    ]).then(([
        { SoundManager },
        { ParticleSystem },
        { TileEffectsManager },
        { KissEmojiSystem },
        { SquareAnimationSystem },
        { InputHandler },
        { MultiplierSystem },
        { GameState }
    ]) => ({
        sound: new SoundManager(),
        particles: new ParticleSystem(canvas),
        tileEffects: new TileEffectsManager(),
        kissEmojis: new KissEmojiSystem(),
        animations: new SquareAnimationSystem(),
        input: new InputHandler(canvas),
        multipliers: new MultiplierSystem(),
        state: new GameState()
    }));
}
