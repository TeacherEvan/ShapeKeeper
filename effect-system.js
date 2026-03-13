/**
 * ShapeKeeper - Effect System
 * Tile effects, player effects, and modal management
 *
 * @version 4.3.0
 * @author Teacher Evan
 */

import {
    activateCurrentEffect,
    announceTurnMessage,
    executeEffect,
    revealMultiplier,
    revealMultiplierForCell,
} from './effect-system/gameplay.js';
import { initializeMultipliers, initializeTileEffects } from './effect-system/init.js';
import {
    closeEffectModal,
    createEffectModal,
    showEffectModal,
    showShapeMessage,
} from './effect-system/modal.js';

export class EffectSystem {
    constructor(game) {
        this.game = game;
        this.effectModal = null;
        this.pendingEffect = null;
        this.oracleVisionActive = false;
        this.oracleVisionTimeout = null;
        this.effectShimmer = 0;

        this.createEffectModal();
    }

    /**
     * Initialize multipliers (legacy system)
     */
    initializeMultipliers() {
        initializeMultipliers(this);
    }

    /**
     * Initialize tile effects
     */
    initializeTileEffects() {
        initializeTileEffects(this);
    }

    /**
     * Create the effect modal
     */
    createEffectModal() {
        createEffectModal(this);
    }

    /**
     * Reveal tile effect
     */
    revealTileEffect(squareKey) {
        const effectData = this.game.tileEffects[squareKey];
        if (!effectData || this.game.revealedEffects.has(squareKey)) return;

        this.game.revealedEffects.add(squareKey);
        effectData.revealed = true;

        this.pendingEffect = {
            squareKey,
            effectData,
            player: this.game.gameLogic.getCellOwnerForEffects(squareKey),
        };

        this.game.soundManager.playEffectRevealSound(effectData.type);
        this.game.particleSystem.createEffectParticles(
            squareKey,
            effectData,
            this.game.gameLogic.parseSquareKey
        );

        this.showEffectModal(effectData);
        this.game.draw();
    }

    /**
     * Show effect modal
     */
    showEffectModal(effectData) {
        showEffectModal(this, effectData);
    }

    /**
     * Close effect modal
     */
    closeEffectModal() {
        closeEffectModal(this);
    }

    /**
     * Activate current effect
     */
    activateCurrentEffect() {
        activateCurrentEffect(this);
    }

    /**
     * Execute effect
     */
    executeEffect(effectId, effectType, player, squareKey) {
        executeEffect(this, effectId, effectType, player, squareKey);
    }

    /**
     * Reveal multiplier
     */
    async revealMultiplier(squareKey) {
        return revealMultiplier(this, squareKey);
    }

    /**
     * Reveal multiplier for cell
     */
    revealMultiplierForCell(cellKey) {
        revealMultiplierForCell(this, cellKey);
    }

    /**
     * Show shape message
     */
    showShapeMessage(cellKey) {
        showShapeMessage(this, cellKey);
    }

    announceTurnMessage(text, color, durationMs = 2000) {
        announceTurnMessage(this, text, color, durationMs);
    }
}
