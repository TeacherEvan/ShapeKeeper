/**
 * ShapeKeeper - Effect System
 * Multipliers, opponent-tap, and turn messages
 *
 * @version 4.3.0
 */

import { announceTurnMessage, revealMultiplier, tapSquare } from './effect-system/gameplay.js';
import { initializeMultipliers } from './effect-system/init.js';

export class EffectSystem {
    constructor(game) {
        this.game = game;
    }

    /**
     * Initialize multipliers
     */
    initializeMultipliers() {
        initializeMultipliers(this);
    }

    /**
     * Reveal multiplier
     */
    async revealMultiplier(squareKey) {
        return revealMultiplier(this, squareKey);
    }

    /**
     * Opponent-tap mechanic: see `effect-system/gameplay.js#tapSquare`.
     * Exposed here so the input handler can call `game.tapSquare(key)`.
     */
    async tapSquare(squareKey) {
        return tapSquare(this, squareKey);
    }

    announceTurnMessage(text, color, durationMs = 2000) {
        announceTurnMessage(this, text, color, durationMs);
    }
}
