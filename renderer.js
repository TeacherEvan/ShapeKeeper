/**
 * ShapeKeeper - Renderer
 * All drawing and rendering functionality
 *
 * @version 4.3.0
 * @author Teacher Evan
 */

import { GAME_CONSTANTS } from './constants.js';
import { easeOutQuad, lerp } from './utils.js';

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

        this.drawSelectedDot();

        this.game.ctx.restore();
    }

    /**
     * Draw dynamic background gradient
     */
    drawDynamicBackground() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

        const scoreDiff = this.game.scores[1] - this.game.scores[2];
        const targetHue = 220 + scoreDiff * 2;
        this.game.backgroundHue += (targetHue - this.game.backgroundHue) * 0.02;

        const gradient = this.game.ctx.createRadialGradient(
            this.game.logicalWidth / 2,
            this.game.logicalHeight / 2,
            0,
            this.game.logicalWidth / 2,
            this.game.logicalHeight / 2,
            Math.max(this.game.logicalWidth, this.game.logicalHeight)
        );

        if (isDark) {
            gradient.addColorStop(0, `hsla(${this.game.backgroundHue}, 20%, 12%, 0.3)`);
            gradient.addColorStop(1, `hsla(${this.game.backgroundHue + 30}, 15%, 8%, 0.2)`);
        } else {
            gradient.addColorStop(0, `hsla(${this.game.backgroundHue}, 15%, 98%, 0.3)`);
            gradient.addColorStop(1, `hsla(${this.game.backgroundHue + 30}, 10%, 95%, 0.2)`);
        }

        this.game.ctx.fillStyle = gradient;
        this.game.ctx.fillRect(0, 0, this.game.logicalWidth, this.game.logicalHeight);
    }

    /**
     * Draw ambient particles
     */
    drawAmbientParticles() {
        const now = Date.now() / 1000;

        this.game.ambientParticles.forEach((p) => {
            const xOffset = Math.sin(now + p.phase) * 0.5;
            const yOffset = Math.cos(now * 0.7 + p.phase) * 0.3;

            this.game.ctx.fillStyle = `rgba(100, 100, 120, ${p.opacity})`;
            this.game.ctx.beginPath();
            this.game.ctx.arc(p.x + xOffset, p.y + yOffset, p.size, 0, Math.PI * 2);
            this.game.ctx.fill();
        });
    }

    /**
     * Draw touch visuals
     */
    drawTouchVisuals() {
        const now = Date.now();

        this.game.touchVisuals.forEach((tv) => {
            const age = now - tv.startTime;
            const progress = age / tv.duration;
            const alpha = 1 - progress;
            const radius = 10 + progress * 15;

            this.game.ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.6})`;
            this.game.ctx.lineWidth = 1.5;
            this.game.ctx.beginPath();
            this.game.ctx.arc(tv.x, tv.y, radius, 0, Math.PI * 2);
            this.game.ctx.stroke();

            this.game.ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
            this.game.ctx.beginPath();
            this.game.ctx.arc(tv.x, tv.y, 4, 0, Math.PI * 2);
            this.game.ctx.fill();
        });
    }

    /**
     * Draw hover preview line
     */
    drawHoverPreview() {
        if (!this.game.hoveredDot || !this.game.selectedDot) return;

        const x1 = this.game.offsetX + this.game.selectedDot.col * this.game.cellSize;
        const y1 = this.game.offsetY + this.game.selectedDot.row * this.game.cellSize;
        const x2 = this.game.offsetX + this.game.hoveredDot.col * this.game.cellSize;
        const y2 = this.game.offsetY + this.game.hoveredDot.row * this.game.cellSize;

        const playerColor = this.game.currentPlayer === 1 ? this.game.player1Color : this.game.player2Color;

        this.game.ctx.save();
        this.game.ctx.strokeStyle = playerColor + '40';
        this.game.ctx.lineWidth = GAME_CONSTANTS.LINE_WIDTH;
        this.game.ctx.lineCap = 'round';

        const dashOffset = (Date.now() / 50) % 20;
        this.game.ctx.setLineDash([10, 10]);
        this.game.ctx.lineDashOffset = -dashOffset;

        this.game.ctx.beginPath();
        this.game.ctx.moveTo(x1, y1);
        this.game.ctx.lineTo(x2, y2);
        this.game.ctx.stroke();

        this.game.ctx.setLineDash([]);
        this.game.ctx.restore();
    }

    /**
     * Draw selection ribbon
     */
    drawSelectionRibbon() {
        if (!this.game.selectionRibbon || !this.game.selectedDot) return;

        const now = Date.now();
        const { targetX, targetY } = this.game.selectionRibbon;

        const startX = this.game.offsetX + this.game.selectedDot.col * this.game.cellSize;
        const startY = this.game.offsetY + this.game.selectedDot.row * this.game.cellSize;

        const midX = (startX + targetX) / 2;
        const midY = (startY + targetY) / 2;
        const waveOffset = Math.sin(now / 200) * 10;

        const playerColor = this.game.currentPlayer === 1 ? this.game.player1Color : this.game.player2Color;

        this.game.ctx.save();
        this.game.ctx.strokeStyle = playerColor + '60';
        this.game.ctx.lineWidth = GAME_CONSTANTS.LINE_WIDTH * 1.5;
        this.game.ctx.lineCap = 'round';

        const dashOffset = (now / 30) % 40;
        this.game.ctx.setLineDash([15, 25]);
        this.game.ctx.lineDashOffset = -dashOffset;

        this.game.ctx.beginPath();
        this.game.ctx.moveTo(startX, startY);
        this.game.ctx.quadraticCurveTo(midX + waveOffset, midY - waveOffset, targetX, targetY);
        this.game.ctx.stroke();

        this.game.ctx.setLineDash([]);
        this.game.ctx.restore();
    }

    /**
     * Draw combo flash overlay
     */
    drawComboFlash() {
        if (!this.game.comboFlashActive) return;

        const playerColor = this.game.currentPlayer === 1 ? this.game.player1Color : this.game.player2Color;

        this.game.ctx.save();
        this.game.ctx.fillStyle = playerColor + '15';
        this.game.ctx.fillRect(0, 0, this.game.logicalWidth, this.game.logicalHeight);
        this.game.ctx.restore();

        this.game.comboFlashActive = false;
    }

    /**
     * Draw all lines
     */
    drawLines() {
        for (const lineKey of this.game.lines) {
            if (this.game.lineDrawings.some((anim) => anim.lineKey === lineKey)) {
                continue;
            }

            const [start, end] = this.game.gameLogic.parseLineKey(lineKey);
            const lineType = this.game.gameLogic.getLineType(start, end);

            const pulsating = this.game.pulsatingLines.find((p) => p.line === lineKey);
            const player = pulsating?.player || this.game.gameLogic.getLinePlayer(lineKey);

            const isGhostLine = this.game.ghostLines && this.game.ghostLines.has(lineKey);

            let lineColor =
                player === GAME_CONSTANTS.POPULATE_PLAYER_ID
                    ? this.game.populateColor
                    : player === 1
                      ? this.game.player1Color
                      : this.game.player2Color;

            if (isGhostLine) {
                this.game.ctx.save();
                this.game.ctx.globalAlpha = GAME_CONSTANTS.GHOST_LINE_OPACITY;
                this.game.ctx.setLineDash([5, 5]);
            }

            this.game.ctx.strokeStyle = lineColor;
            this.game.ctx.lineWidth = lineType === 'diagonal' ? GAME_CONSTANTS.LINE_WIDTH * 0.5 : GAME_CONSTANTS.LINE_WIDTH;
            this.game.ctx.lineCap = 'round';

            this.game.ctx.beginPath();
            this.game.ctx.moveTo(
                this.game.offsetX + start.col * this.game.cellSize,
                this.game.offsetY + start.row * this.game.cellSize
            );
            this.game.ctx.lineTo(
                this.game.offsetX + end.col * this.game.cellSize,
                this.game.offsetY + end.row * this.game.cellSize
            );
            this.game.ctx.stroke();

            if (isGhostLine) {
                this.game.ctx.setLineDash([]);
                this.game.ctx.restore();
            }
        }
    }

    /**
     * Draw line animations
     */
    drawLineAnimations() {
        const now = Date.now();

        this.game.lineDrawings.forEach((anim) => {
            const age = now - anim.startTime;
            const progress = Math.min(age / anim.duration, 1);
            const easedProgress = easeOutQuad(progress);

            const currentEndX = lerp(anim.startDot.x, anim.endDot.x, easedProgress);
            const currentEndY = lerp(anim.startDot.y, anim.endDot.y, easedProgress);

            const player = anim.player;
            this.game.ctx.strokeStyle =
                player === GAME_CONSTANTS.POPULATE_PLAYER_ID
                    ? this.game.populateColor
                    : player === 1
                      ? this.game.player1Color
                      : this.game.player2Color;
            this.game.ctx.lineWidth = GAME_CONSTANTS.LINE_WIDTH;
            this.game.ctx.lineCap = 'round';

            this.game.ctx.beginPath();
            this.game.ctx.moveTo(anim.startDot.x, anim.startDot.y);
            this.game.ctx.lineTo(currentEndX, currentEndY);
            this.game.ctx.stroke();
        });
    }

    /**
     * Draw invalid line flash
     */
    drawInvalidLineFlash() {
        if (!this.game.invalidLineFlash) return;

        const now = Date.now();
        const age = now - this.game.invalidLineFlash.startTime;
        const progress = age / this.game.invalidLineFlash.duration;

        if (progress >= 1) return;

        const { dot1, dot2 } = this.game.invalidLineFlash;
        const x1 = this.game.offsetX + dot1.col * this.game.cellSize;
        const y1 = this.game.offsetY + dot1.row * this.game.cellSize;
        const x2 = this.game.offsetX + dot2.col * this.game.cellSize;
        const y2 = this.game.offsetY + dot2.row * this.game.cellSize;

        const alpha = 1 - progress;
        this.game.ctx.save();
        this.game.ctx.strokeStyle = `rgba(255, 60, 60, ${alpha})`;
        this.game.ctx.lineWidth = GAME_CONSTANTS.LINE_WIDTH;
        this.game.ctx.lineCap = 'round';
        this.game.ctx.shadowColor = '#FF3C3C';
        this.game.ctx.shadowBlur = 15 * alpha;

        this.game.ctx.setLineDash([8, 8]);
        this.game.ctx.beginPath();
        this.game.ctx.moveTo(x1, y1);
        this.game.ctx.lineTo(x2, y2);
        this.game.ctx.stroke();
        this.game.ctx.setLineDash([]);
        this.game.ctx.restore();
    }

    /**
     * Draw squares
     */
    drawSquares() {
        for (const [squareKey, player] of Object.entries(this.game.squares)) {
            const { row, col } = this.game.gameLogic.parseSquareKey(squareKey);
            const x = this.game.offsetX + col * this.game.cellSize;
            const y = this.game.offsetY + row * this.game.cellSize;

            this.game.ctx.fillStyle = player === 1 ? this.game.player1Color + '40' : this.game.player2Color + '40';
            this.game.ctx.fillRect(x, y, this.game.cellSize, this.game.cellSize);

            this.game.ctx.fillStyle = player === 1 ? this.game.player1Color : this.game.player2Color;
            const fontSize = Math.max(8, Math.min(this.game.cellSize / 2, 20));
            this.game.ctx.font = `bold ${fontSize}px Arial`;
            this.game.ctx.textAlign = 'center';
            this.game.ctx.textBaseline = 'middle';
            this.game.ctx.fillText(player.toString(), x + this.game.cellSize / 2, y + this.game.cellSize / 2);
        }
    }

    /**
     * Draw squares with animations
     */
    drawSquaresWithAnimations() {
        const now = Date.now();

        for (const squareKey in this.game.squares) {
            const player = this.game.squares[squareKey];
            const color = player === 1 ? this.game.player1Color : this.game.player2Color;
            const { row, col } = this.game.gameLogic.parseSquareKey(squareKey);

            const x = this.game.offsetX + col * this.game.cellSize;
            const y = this.game.offsetY + row * this.game.cellSize;

            const animation = this.game.squareAnimations.find((a) => a.squareKey === squareKey);

            if (animation) {
                const age = now - animation.startTime;
                const progress = age / animation.duration;

                const easeProgress = easeOutQuad(progress);
                const scale = 0.3 + easeProgress * 0.7;
                const alpha = Math.min(progress * 2, 1);

                const glowIntensity = Math.sin(progress * Math.PI) * 0.5;
                this.game.ctx.shadowColor = color;
                this.game.ctx.shadowBlur = 20 * glowIntensity;

                this.game.ctx.save();
                this.game.ctx.translate(animation.centerX, animation.centerY);
                this.game.ctx.scale(scale, scale);
                this.game.ctx.translate(-animation.centerX, -animation.centerY);

                this.game.ctx.fillStyle =
                    color +
                    Math.floor(alpha * 0.25 * 255)
                        .toString(16)
                        .padStart(2, '0');
                this.game.ctx.fillRect(x, y, this.game.cellSize, this.game.cellSize);

                this.game.ctx.restore();
                this.game.ctx.shadowBlur = 0;
            }

            this.game.ctx.fillStyle = color;
            this.game.ctx.font = `bold ${this.game.cellSize * 0.4}px Arial`;
            this.game.ctx.textAlign = 'center';
            this.game.ctx.textBaseline = 'middle';
            this.game.ctx.fillText(player, x + this.game.cellSize / 2, y + this.game.cellSize / 2);

            if (this.game.revealedMultipliers.has(squareKey)) {
                const multiplierData = this.game.squareMultipliers[squareKey];
                if (multiplierData && multiplierData.type === 'multiplier') {
                    this.game.ctx.font = `bold ${this.game.cellSize * 0.25}px Arial`;
                    this.game.ctx.fillStyle = '#FFD700';
                    this.game.ctx.fillText(
                        `x${multiplierData.value}`,
                        x + this.game.cellSize / 2,
                        y + this.game.cellSize * 0.75
                    );
                }
            }

            this.drawTileEffectIndicator(squareKey, x, y, player);
        }

        this.drawHiddenEffectShimmers();
    }

    /**
     * Draw triangles with animations
     */
    drawTrianglesWithAnimations() {
        const now = Date.now();

        const effectIndicatorsDrawn = new Set();

        for (const triKey in this.game.triangles) {
            const player = this.game.triangles[triKey];
            const color = player === 1 ? this.game.player1Color : this.game.player2Color;

            const parts = triKey.replace('tri-', '').split('-');
            const vertices = parts.map((p) => {
                const [row, col] = p.split(',').map(Number);
                return { row, col };
            });

            const cellKey = this.game.gameLogic.getTriangleCellKey(vertices);

            const points = vertices.map((v) => ({
                x: this.game.offsetX + v.col * this.game.cellSize,
                y: this.game.offsetY + v.row * this.game.cellSize,
            }));

            const centerX = (points[0].x + points[1].x + points[2].x) / 3;
            const centerY = (points[0].y + points[1].y + points[2].y) / 3;

            const animation = this.game.squareAnimations.find(
                (a) => a.type === 'triangle' && a.key === triKey
            );

            this.game.ctx.save();

            if (animation) {
                const age = now - animation.startTime;
                const progress = age / animation.duration;

                const easeProgress = easeOutQuad(progress);
                const scale = 0.3 + easeProgress * 0.7;
                const alpha = Math.min(progress * 2, 1);

                const glowIntensity = Math.sin(progress * Math.PI) * 0.5;
                this.game.ctx.shadowColor = color;
                this.game.ctx.shadowBlur = 20 * glowIntensity;

                this.game.ctx.translate(centerX, centerY);
                this.game.ctx.scale(scale, scale);
                this.game.ctx.translate(-centerX, -centerY);

                this.game.ctx.fillStyle =
                    color +
                    Math.floor(alpha * 0.35 * 255)
                        .toString(16)
                        .padStart(2, '0');
            } else {
                this.game.ctx.fillStyle = color + '50';
            }

            this.game.ctx.beginPath();
            this.game.ctx.moveTo(points[0].x, points[0].y);
            this.game.ctx.lineTo(points[1].x, points[1].y);
            this.game.ctx.lineTo(points[2].x, points[2].y);
            this.game.ctx.closePath();
            this.game.ctx.fill();

            this.game.ctx.strokeStyle = color + '40';
            this.game.ctx.lineWidth = 1;
            this.game.ctx.clip();

            const minX = Math.min(points[0].x, points[1].x, points[2].x);
            const maxX = Math.max(points[0].x, points[1].x, points[2].x);
            const minY = Math.min(points[0].y, points[1].y, points[2].y);
            const maxY = Math.max(points[0].y, points[1].y, points[2].y);

            for (let i = minX - (maxY - minY); i < maxX + (maxY - minY); i += 4) {
                this.game.ctx.beginPath();
                this.game.ctx.moveTo(i, minY);
                this.game.ctx.lineTo(i + (maxY - minY), maxY);
                this.game.ctx.stroke();
            }

            this.game.ctx.restore();
            this.game.ctx.shadowBlur = 0;

            this.game.ctx.fillStyle = color;
            this.game.ctx.font = `bold ${this.game.cellSize * 0.3}px Arial`;
            this.game.ctx.textAlign = 'center';
            this.game.ctx.textBaseline = 'middle';
            this.game.ctx.fillText('▲', centerX, centerY);

            if (
                this.game.partyModeEnabled &&
                this.game.tileEffects[cellKey] &&
                !effectIndicatorsDrawn.has(cellKey)
            ) {
                const { row, col } = this.game.gameLogic.parseSquareKey(cellKey);
                const cellX = this.game.offsetX + col * this.game.cellSize;
                const cellY = this.game.offsetY + row * this.game.cellSize;
                this.drawTileEffectIndicator(cellKey, cellX, cellY, player);
                effectIndicatorsDrawn.add(cellKey);
            }
        }
    }

    /**
     * Draw tile effect indicator
     */
    drawTileEffectIndicator(squareKey, x, y, player) {
        const effectData = this.game.tileEffects[squareKey];
        if (!effectData) return;

        const { effect } = effectData;
        const isRevealed = this.game.revealedEffects.has(squareKey);
        const isActivated = this.game.activatedEffects.has(squareKey);

        this.game.effectShimmer = (this.game.effectShimmer + 0.05) % (Math.PI * 2);

        if (!isRevealed) {
            const shimmerAlpha = 0.3 + Math.sin(this.game.effectShimmer + x * 0.1) * 0.2;
            const shimmerColor = effectData.type === 'trap' ? '#FF6B6B' : '#6BCB77';

            this.game.ctx.save();
            this.game.ctx.shadowColor = shimmerColor;
            this.game.ctx.shadowBlur = 8 + Math.sin(this.game.effectShimmer) * 4;
            this.game.ctx.fillStyle =
                shimmerColor +
                Math.floor(shimmerAlpha * 80)
                    .toString(16)
                    .padStart(2, '0');
            this.game.ctx.beginPath();
            this.game.ctx.arc(
                x + this.game.cellSize / 2,
                y + this.game.cellSize / 2,
                this.game.cellSize * 0.15,
                0,
                Math.PI * 2
            );
            this.game.ctx.fill();
            this.game.ctx.restore();

            this.game.ctx.font = `bold ${this.game.cellSize * 0.3}px Arial`;
            this.game.ctx.fillStyle = shimmerColor;
            this.game.ctx.textAlign = 'center';
            this.game.ctx.textBaseline = 'middle';
            this.game.ctx.fillText('?', x + this.game.cellSize / 2, y + this.game.cellSize * 0.3);
        } else if (!isActivated) {
            const pulseScale = 1 + Math.sin(this.game.effectShimmer * 2) * 0.1;

            this.game.ctx.save();
            this.game.ctx.shadowColor = effect.color;
            this.game.ctx.shadowBlur = 15;

            this.game.ctx.fillStyle = effect.color + '40';
            this.game.ctx.beginPath();
            this.game.ctx.arc(
                x + this.game.cellSize / 2,
                y + this.game.cellSize * 0.7,
                this.game.cellSize * 0.25 * pulseScale,
                0,
                Math.PI * 2
            );
            this.game.ctx.fill();

            this.game.ctx.font = `${this.game.cellSize * 0.35 * pulseScale}px Arial`;
            this.game.ctx.textAlign = 'center';
            this.game.ctx.textBaseline = 'middle';
            this.game.ctx.fillText(effect.icon, x + this.game.cellSize / 2, y + this.game.cellSize * 0.7);

            this.game.ctx.font = `${this.game.cellSize * 0.12}px Arial`;
            this.game.ctx.fillStyle = effect.color;
            this.game.ctx.fillText('TAP', x + this.game.cellSize / 2, y + this.game.cellSize * 0.9);

            this.game.ctx.restore();
        } else {
            this.game.ctx.globalAlpha = 0.4;
            this.game.ctx.font = `${this.game.cellSize * 0.25}px Arial`;
            this.game.ctx.textAlign = 'center';
            this.game.ctx.textBaseline = 'middle';
            this.game.ctx.fillText(effect.icon, x + this.game.cellSize / 2, y + this.game.cellSize * 0.75);
            this.game.ctx.globalAlpha = 1;
        }
    }

    /**
     * Draw hidden effect shimmers
     */
    drawHiddenEffectShimmers() {
        if (!this.game.oracleVisionActive) return;

        for (const squareKey in this.game.tileEffects) {
            if (this.game.squares[squareKey]) continue;
            if (this.game.revealedEffects.has(squareKey)) continue;

            const effectData = this.game.tileEffects[squareKey];
            const { effect } = effectData;
            const { row, col } = this.game.gameLogic.parseSquareKey(squareKey);
            const x = this.game.offsetX + col * this.game.cellSize;
            const y = this.game.offsetY + row * this.game.cellSize;

            const pulseAlpha = 0.4 + Math.sin(this.game.effectShimmer) * 0.2;

            this.game.ctx.save();
            this.game.ctx.globalAlpha = pulseAlpha;
            this.game.ctx.shadowColor = effect.color;
            this.game.ctx.shadowBlur = 10;

            this.game.ctx.fillStyle = effect.color + '30';
            this.game.ctx.fillRect(x, y, this.game.cellSize, this.game.cellSize);

            this.game.ctx.font = `${this.game.cellSize * 0.4}px Arial`;
            this.game.ctx.textAlign = 'center';
            this.game.ctx.textBaseline = 'middle';
            this.game.ctx.fillText(effect.icon, x + this.game.cellSize / 2, y + this.game.cellSize / 2);

            this.game.ctx.restore();
        }
    }

    /**
     * Draw particles
     */
    drawParticles() {
        this.game.particles.forEach((p) => {
            if (p.trail && p.trail.length > 1 && !p.smoke) {
                for (let i = 0; i < p.trail.length - 1; i++) {
                    const trailAlpha = (i / p.trail.length) * p.life * 0.4;
                    const trailSize = p.size * (i / p.trail.length);

                    this.game.ctx.fillStyle =
                        p.color +
                        Math.floor(trailAlpha * 255)
                            .toString(16)
                            .padStart(2, '0');
                    this.game.ctx.beginPath();
                    this.game.ctx.arc(p.trail[i].x, p.trail[i].y, trailSize, 0, Math.PI * 2);
                    this.game.ctx.fill();
                }
            }

            if (p.spark) {
                this.game.ctx.shadowColor = p.color;
                this.game.ctx.shadowBlur = 10;
                this.game.ctx.fillStyle =
                    p.color +
                    Math.floor(p.life * 255)
                        .toString(16)
                        .padStart(2, '0');
                this.game.ctx.beginPath();
                this.game.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                this.game.ctx.fill();
                this.game.ctx.shadowBlur = 0;
            } else if (p.smoke) {
                this.game.ctx.fillStyle =
                    p.color +
                    Math.floor(p.life * 128)
                        .toString(16)
                        .padStart(2, '0');
                this.game.ctx.beginPath();
                this.game.ctx.arc(p.x, p.y, p.size * (1.5 - p.life * 0.5), 0, Math.PI * 2);
                this.game.ctx.fill();
            } else {
                this.game.ctx.fillStyle =
                    p.color +
                    Math.floor(p.life * 255)
                        .toString(16)
                        .padStart(2, '0');
                this.game.ctx.beginPath();
                this.game.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                this.game.ctx.fill();
            }
        });
    }

    /**
     * Draw sparkle emojis
     */
    drawSparkleEmojis() {
        const now = Date.now();

        this.game.sparkleEmojis.forEach((sparkle) => {
            const age = now - sparkle.startTime;
            if (age < 0) return;

            const progress = age / sparkle.duration;

            if (progress >= 1) return;

            const scaleProgress = progress < 0.5 ? progress * 2 : 1;
            const scale = (sparkle.scale || 1) * (0.5 + scaleProgress * 1.5);

            const alpha = progress < 0.5 ? 1 : 1 - (progress - 0.5) * 2;

            const yOffset = progress * -20;
            const xOffset = Math.sin(progress * Math.PI * 2) * 10;

            this.game.ctx.save();
            this.game.ctx.globalAlpha = alpha;
            this.game.ctx.font = `${this.game.cellSize * scale}px Arial`;
            this.game.ctx.textAlign = 'center';
            this.game.ctx.textBaseline = 'middle';
            this.game.ctx.fillText(sparkle.emoji || '✨', sparkle.x + xOffset, sparkle.y + yOffset);
            this.game.ctx.restore();
        });
    }

    /**
     * Draw multiplier animations
     */
    drawMultiplierAnimations() {
        if (!this.game.multiplierAnimations) return;

        const now = Date.now();
        this.game.multiplierAnimations.forEach((anim) => {
            const age = now - anim.startTime;
            const progress = age / anim.duration;

            if (progress >= 1) return;

            const scale = 1 + progress * 2;
            const alpha = 1 - progress;

            const yOffset = -progress * 50;

            this.game.ctx.save();
            this.game.ctx.globalAlpha = alpha;

            this.game.ctx.shadowColor = '#FFD700';
            this.game.ctx.shadowBlur = 20;
            this.game.ctx.fillStyle = '#FFD700';
            this.game.ctx.font = `bold ${this.game.cellSize * scale}px Arial`;
            this.game.ctx.textAlign = 'center';
            this.game.ctx.textBaseline = 'middle';
            this.game.ctx.fillText(`x${anim.value}`, anim.centerX, anim.centerY + yOffset);

            this.game.ctx.shadowBlur = 0;
            this.game.ctx.restore();
        });
    }

    /**
     * Draw dots
     */
    drawDots() {
        if (this.game.dotsCanvas) {
            this.game.ctx.drawImage(this.game.dotsCanvas, 0, 0, this.game.logicalWidth, this.game.logicalHeight);
        } else {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const dotColor = isDark ? '#CCCCCC' : '#333333';

            for (let row = 0; row < this.game.gridRows; row++) {
                for (let col = 0; col < this.game.gridCols; col++) {
                    const x = this.game.offsetX + col * this.game.cellSize;
                    const y = this.game.offsetY + row * this.game.cellSize;

                    this.game.ctx.fillStyle = dotColor;
                    this.game.ctx.beginPath();
                    this.game.ctx.arc(x, y, GAME_CONSTANTS.DOT_RADIUS, 0, Math.PI * 2);
                    this.game.ctx.fill();
                }
            }
        }
    }

    /**
     * Draw selected dot
     */
    drawSelectedDot() {
        if (!this.game.selectedDot) return;

        const x = this.game.offsetX + this.game.selectedDot.col * this.game.cellSize;
        const y = this.game.offsetY + this.game.selectedDot.row * this.game.cellSize;

        const playerColor = this.game.currentPlayer === 1 ? this.game.player1Color : this.game.player2Color;

        const glowPulse = 1 + Math.sin(Date.now() / 150) * 0.3;
        this.game.ctx.strokeStyle = playerColor + '60';
        this.game.ctx.lineWidth = 5;
        this.game.ctx.beginPath();
        this.game.ctx.arc(x, y, (GAME_CONSTANTS.DOT_RADIUS + 12) * glowPulse, 0, Math.PI * 2);
        this.game.ctx.stroke();

        const pulseScale = 1 + Math.sin(Date.now() / 200) * 0.2;
        this.game.ctx.strokeStyle = playerColor;
        this.game.ctx.lineWidth = 3;
        this.game.ctx.beginPath();
        this.game.ctx.arc(x, y, (GAME_CONSTANTS.DOT_RADIUS + 8) * pulseScale, 0, Math.PI * 2);
        this.game.ctx.stroke();

        this.game.ctx.lineWidth = 2;
        this.game.ctx.beginPath();
        this.game.ctx.arc(x, y, GAME_CONSTANTS.DOT_RADIUS + 5, 0, Math.PI * 2);
        this.game.ctx.stroke();

        this.game.ctx.fillStyle = playerColor;
        this.game.ctx.beginPath();
        this.game.ctx.arc(x, y, GAME_CONSTANTS.DOT_RADIUS * 2, 0, Math.PI * 2);
        this.game.ctx.fill();
    }
}