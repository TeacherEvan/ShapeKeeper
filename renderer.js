/**
 * ShapeKeeper - Renderer
 * All drawing and rendering functionality
 *
 * @version 4.3.0
 * @author Teacher Evan
 */

import {
    drawHiddenEffectShimmers,
    drawInvalidLineFlash,
    drawLineAnimations,
    drawLines,
    drawSquares,
    drawSquaresWithAnimations,
    drawTileEffectIndicator,
    drawTrianglesWithAnimations,
} from './renderer/board.js';
import {
    drawAmbientParticles,
    drawComboFlash,
    drawDynamicBackground,
    drawHoverPreview,
    drawMultiplierAnimations,
    drawParticles,
    drawSelectionRibbon,
    drawSparkleEmojis,
    drawTouchVisuals,
} from './renderer/effects.js';
import { drawDots, drawKeyboardFocusDot, drawSelectedDot } from './renderer/markers.js';

export class Renderer {
    constructor(game) {
        this.game = game;
    }

    /**
     * Main draw function
     */
    draw() {
        this.game.ctx.clearRect(0, 0, this.game.logicalWidth, this.game.logicalHeight);

        this.drawDynamicBackground();
        this.drawAmbientParticles();

        this.game.ctx.save();
        if (this.game.shakeIntensity > 0.1) {
            this.game.ctx.translate(
                (Math.random() - 0.5) * this.game.shakeIntensity,
                (Math.random() - 0.5) * this.game.shakeIntensity
            );
        }

        if (this.game.screenPulse > 0) {
            const pulseScale = 1 + this.game.screenPulse * 0.02;
            const centerX = this.game.logicalWidth / 2;
            const centerY = this.game.logicalHeight / 2;
            this.game.ctx.translate(centerX, centerY);
            this.game.ctx.scale(pulseScale, pulseScale);
            this.game.ctx.translate(-centerX, -centerY);
        }

        this.drawTouchVisuals();
        this.drawHoverPreview();
        this.drawSelectionRibbon();
        this.drawComboFlash();

        this.drawLines();
        this.drawLineAnimations();
        this.drawInvalidLineFlash();

        this.drawSquares();
        this.drawSquaresWithAnimations();
        this.drawTrianglesWithAnimations();

        this.drawParticles();
        this.drawSparkleEmojis();
        this.drawMultiplierAnimations();

        this.drawDots();

        this.drawKeyboardFocusDot();
        this.drawSelectedDot();

        this.game.ctx.restore();
    }

    /**
     * Draw dynamic background gradient
     */
    drawDynamicBackground() {
        drawDynamicBackground(this.game);
    }

    /**
     * Draw ambient particles
     */
    drawAmbientParticles() {
        drawAmbientParticles(this.game);
    }

    /**
     * Draw touch visuals
     */
    drawTouchVisuals() {
        drawTouchVisuals(this.game);
    }

    /**
     * Draw hover preview line
     */
    drawHoverPreview() {
        drawHoverPreview(this.game);
    }

    /**
     * Draw selection ribbon
     */
    drawSelectionRibbon() {
        drawSelectionRibbon(this.game);
    }

    /**
     * Draw combo flash overlay
     */
    drawComboFlash() {
        drawComboFlash(this.game);
    }

    /**
     * Draw all lines
     */
    drawLines() {
        drawLines(this.game);
    }

    /**
     * Draw line animations
     */
    drawLineAnimations() {
        drawLineAnimations(this.game);
    }

    /**
     * Draw invalid line flash
     */
    drawInvalidLineFlash() {
        drawInvalidLineFlash(this.game);
    }

    /**
     * Draw squares
     */
    drawSquares() {
        drawSquares(this.game);
    }

    /**
     * Draw squares with animations
     */
    drawSquaresWithAnimations() {
        drawSquaresWithAnimations(this.game);
    }

    /**
     * Draw triangles with animations
     */
    drawTrianglesWithAnimations() {
        drawTrianglesWithAnimations(this.game);
    }

    /**
     * Draw tile effect indicator
     */
    drawTileEffectIndicator(squareKey, x, y, player) {
        drawTileEffectIndicator(this.game, squareKey, x, y, player);
    }

    /**
     * Draw hidden effect shimmers
     */
    drawHiddenEffectShimmers() {
        drawHiddenEffectShimmers(this.game);
    }

    /**
     * Draw particles
     */
    drawParticles() {
        drawParticles(this.game);
    }

    /**
     * Draw sparkle emojis
     */
    drawSparkleEmojis() {
        drawSparkleEmojis(this.game);
    }

    /**
     * Draw multiplier animations
     */
    drawMultiplierAnimations() {
        drawMultiplierAnimations(this.game);
    }

    /**
     * Draw dots
     */
    drawDots() {
        drawDots(this.game);
    }

    /**
     * Draw selected dot
     */
    drawSelectedDot() {
        drawSelectedDot(this.game);
    }

    drawKeyboardFocusDot() {
        drawKeyboardFocusDot(this.game);
    }
}
