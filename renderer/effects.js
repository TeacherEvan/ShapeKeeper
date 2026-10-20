import { GAME_CONSTANTS } from '../constants.js';
import { prefersReducedMotion } from '../utils.js';

export function drawDynamicBackground(game) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const scoreDiff = game.scores[1] - game.scores[2];
    const targetHue = 220 + scoreDiff * 2;
    game.backgroundHue += (targetHue - game.backgroundHue) * 0.02;

    const time = Date.now() / 3000;

    const gradient = game.ctx.createRadialGradient(
        game.logicalWidth / 2 + Math.sin(time) * 30,
        game.logicalHeight / 2 + Math.cos(time * 0.7) * 20,
        0,
        game.logicalWidth / 2,
        game.logicalHeight / 2,
        Math.max(game.logicalWidth, game.logicalHeight) * 0.7
    );

    if (isDark) {
        gradient.addColorStop(0, `hsla(${game.backgroundHue}, 95%, 50%, 0.3)`);
        gradient.addColorStop(0.4, `hsla(${game.backgroundHue + 20}, 90%, 45%, 0.2)`);
        gradient.addColorStop(1, `hsla(${game.backgroundHue + 40}, 85%, 38%, 0.15)`);
    } else {
        gradient.addColorStop(0, `hsla(${game.backgroundHue}, 92%, 62%, 0.3)`);
        gradient.addColorStop(0.4, `hsla(${game.backgroundHue + 20}, 88%, 58%, 0.2)`);
        gradient.addColorStop(1, `hsla(${game.backgroundHue + 40}, 85%, 55%, 0.15)`);
    }

    game.ctx.fillStyle = gradient;
    game.ctx.fillRect(0, 0, game.logicalWidth, game.logicalHeight);

    drawSubtleGridPattern(game, isDark);
    drawFloatingGeometry(game, isDark, time);
}

function drawSubtleGridPattern(game, isDark) {
    const gridSize = 40;
    const lineColor = isDark ? 'rgba(100, 100, 140, 0.03)' : 'rgba(80, 80, 120, 0.02)';

    game.ctx.strokeStyle = lineColor;
    game.ctx.lineWidth = 0.5;

    const offsetX = (Date.now() / 2000) % gridSize;
    const offsetY = (Date.now() / 3000) % gridSize;

    game.ctx.beginPath();
    for (let x = -offsetX; x < game.logicalWidth + gridSize; x += gridSize) {
        game.ctx.moveTo(x, 0);
        game.ctx.lineTo(x, game.logicalHeight);
    }
    for (let y = -offsetY; y < game.logicalHeight + gridSize; y += gridSize) {
        game.ctx.moveTo(0, y);
        game.ctx.lineTo(game.logicalWidth, y);
    }
    game.ctx.stroke();
}

function drawFloatingGeometry(game, isDark, time) {
    // Skip in test environments where ctx.rotate may not exist (jsdom)
    if (typeof game.ctx.rotate !== 'function') return;

    if (!game.backgroundGeometry) {
        game.backgroundGeometry = [];
        const count = isDark ? 8 : 6;
        for (let i = 0; i < count; i++) {
            game.backgroundGeometry.push({
                x: Math.random() * game.logicalWidth,
                y: Math.random() * game.logicalHeight,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                size: 40 + Math.random() * 60,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.002,
                type: ['circle', 'square', 'triangle', 'hexagon'][Math.floor(Math.random() * 4)],
                opacity: 0.02 + Math.random() * 0.03,
                hue: 200 + Math.random() * 80,
            });
        }
    }

    for (const geo of game.backgroundGeometry) {
        geo.x += geo.vx;
        geo.y += geo.vy;
        geo.rotation += geo.rotationSpeed;

        if (geo.x < -geo.size) geo.x = game.logicalWidth + geo.size;
        if (geo.x > game.logicalWidth + geo.size) geo.x = -geo.size;
        if (geo.y < -geo.size) geo.y = game.logicalHeight + geo.size;
        if (geo.y > game.logicalHeight + geo.size) geo.y = -geo.size;

        game.ctx.save();
        game.ctx.translate(geo.x, geo.y);
        game.ctx.rotate(geo.rotation);
        game.ctx.globalAlpha = geo.opacity * (0.7 + 0.3 * Math.sin(time * 2 + geo.x * 0.01));
        game.ctx.strokeStyle = `hsla(${geo.hue}, 60%, ${isDark ? '70%' : '40%'}, 1)`;
        game.ctx.lineWidth = 1;
        game.ctx.fillStyle = `hsla(${geo.hue}, 60%, ${isDark ? '60%' : '50%'}, ${geo.opacity * 0.5})`;

        const s = geo.size;
        switch (geo.type) {
            case 'circle':
                game.ctx.beginPath();
                game.ctx.arc(0, 0, s, 0, Math.PI * 2);
                game.ctx.stroke();
                break;
            case 'square':
                game.ctx.strokeRect(-s, -s, s * 2, s * 2);
                break;
            case 'triangle':
                game.ctx.beginPath();
                game.ctx.moveTo(0, -s);
                game.ctx.lineTo(s * 0.866, s * 0.5);
                game.ctx.lineTo(-s * 0.866, s * 0.5);
                game.ctx.closePath();
                game.ctx.stroke();
                break;
            case 'hexagon':
                game.ctx.beginPath();
                for (let j = 0; j < 6; j++) {
                    const angle = (j / 6) * Math.PI * 2;
                    game.ctx.lineTo(Math.cos(angle) * s, Math.sin(angle) * s);
                }
                game.ctx.closePath();
                game.ctx.stroke();
                break;
        }
        game.ctx.restore();
    }
}

export function drawAmbientParticles(game) {
    const now = Date.now() / 1000;

    if (!game.ambientParticles || game.ambientParticles.length === 0) {
        game.ambientParticles = [];
        const count = 40;
        for (let i = 0; i < count; i++) {
            game.ambientParticles.push({
                x: Math.random() * game.logicalWidth,
                y: Math.random() * game.logicalHeight,
                baseX: Math.random() * game.logicalWidth,
                baseY: Math.random() * game.logicalHeight,
                phase: Math.random() * Math.PI * 2,
                size: 1.5 + Math.random() * 2.5,
                opacity: 0.15 + Math.random() * 0.25,
                speed: 0.3 + Math.random() * 0.4,
                amplitude: 20 + Math.random() * 40,
                type: ['circle', 'square'][Math.floor(Math.random() * 2)],
            });
        }
    }

    game.ambientParticles.forEach((particle) => {
        if (particle.baseX === undefined) {
            particle.baseX = particle.x ?? Math.random() * (game.logicalWidth || 800);
        }
        if (particle.baseY === undefined) {
            particle.baseY = particle.y ?? Math.random() * (game.logicalHeight || 600);
        }
        const speed = particle.speed ?? 0.35;
        const amplitude = particle.amplitude ?? 25;
        const phase = particle.phase ?? 0;

        const xOffset = Math.sin(now * speed + phase) * amplitude;
        const yOffset = Math.cos(now * speed * 0.7 + phase) * amplitude * 0.6;

        let x = particle.baseX + xOffset;
        let y = particle.baseY + yOffset;

        const logicalWidth = game.logicalWidth || 800;
        const logicalHeight = game.logicalHeight || 600;

        if (x < -10) particle.baseX = logicalWidth + 10;
        if (x > logicalWidth + 10) particle.baseX = -10;
        if (y < -10) particle.baseY = logicalHeight + 10;
        if (y > logicalHeight + 10) particle.baseY = -10;

        game.ctx.globalAlpha = (particle.opacity ?? 0.2) * (0.5 + 0.5 * Math.sin(now * 2 + phase));
        game.ctx.fillStyle = isDarkMode() ? '#64748b' : '#94a3b8';

        const size = particle.size ?? 2;
        if (particle.type === 'square') {
            game.ctx.fillRect(x - size, y - size, size * 2, size * 2);
        } else {
            game.ctx.beginPath();
            game.ctx.arc(x, y, size, 0, Math.PI * 2);
            game.ctx.fill();
        }
    });
    game.ctx.globalAlpha = 1;
}

function isDarkMode() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
}

export function drawTouchVisuals(game) {
    const now = Date.now();

    game.touchVisuals.forEach((visual) => {
        const age = now - visual.startTime;
        const progress = age / visual.duration;
        const alpha = 1 - progress;
        const radius = 10 + progress * 15;

        game.ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.6})`;
        game.ctx.lineWidth = 1.5;
        game.ctx.beginPath();
        game.ctx.arc(visual.x, visual.y, radius, 0, Math.PI * 2);
        game.ctx.stroke();

        game.ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
        game.ctx.beginPath();
        game.ctx.arc(visual.x, visual.y, 4, 0, Math.PI * 2);
        game.ctx.fill();
    });
}

export function drawHoverPreview(game) {
    if (!game.hoveredDot || !game.selectedDot) return;

    const x1 = game.offsetX + game.selectedDot.col * game.cellSize;
    const y1 = game.offsetY + game.selectedDot.row * game.cellSize;
    const x2 = game.offsetX + game.hoveredDot.col * game.cellSize;
    const y2 = game.offsetY + game.hoveredDot.row * game.cellSize;
    const playerColor = game.currentPlayer === 1 ? game.player1Color : game.player2Color;

    game.ctx.save();
    game.ctx.strokeStyle = playerColor + '40';
    game.ctx.lineWidth = GAME_CONSTANTS.LINE_WIDTH;
    game.ctx.lineCap = 'round';
    game.ctx.setLineDash([10, 10]);
    game.ctx.lineDashOffset = -((Date.now() / 50) % 20);
    game.ctx.beginPath();
    game.ctx.moveTo(x1, y1);
    game.ctx.lineTo(x2, y2);
    game.ctx.stroke();
    game.ctx.setLineDash([]);
    game.ctx.restore();
}

export function drawSelectionRibbon(game) {
    if (!game.selectionRibbon || !game.selectedDot) return;

    const now = Date.now();
    const toDot = game.selectionRibbon.to;
    const targetX =
        game.selectionRibbon.targetX ?? (toDot ? game.offsetX + toDot.col * game.cellSize : null);
    const targetY =
        game.selectionRibbon.targetY ?? (toDot ? game.offsetY + toDot.row * game.cellSize : null);
    if (targetX === null || targetY === null || isNaN(targetX) || isNaN(targetY)) return;

    const startX = game.offsetX + game.selectedDot.col * game.cellSize;
    const startY = game.offsetY + game.selectedDot.row * game.cellSize;
    const midX = (startX + targetX) / 2;
    const midY = (startY + targetY) / 2;
    const waveOffset = Math.sin(now / 200) * 10;
    const playerColor = game.currentPlayer === 1 ? game.player1Color : game.player2Color;

    game.ctx.save();
    game.ctx.strokeStyle = playerColor + '60';
    game.ctx.lineWidth = GAME_CONSTANTS.LINE_WIDTH * 1.5;
    game.ctx.lineCap = 'round';
    game.ctx.setLineDash([15, 25]);
    game.ctx.lineDashOffset = -((now / 30) % 40);
    game.ctx.beginPath();
    game.ctx.moveTo(startX, startY);
    game.ctx.quadraticCurveTo(midX + waveOffset, midY - waveOffset, targetX, targetY);
    game.ctx.stroke();
    game.ctx.setLineDash([]);
    game.ctx.restore();
}

export function drawComboFlash(game) {
    if (!game.comboFlashActive) return;

    const playerColor = game.currentPlayer === 1 ? game.player1Color : game.player2Color;
    game.ctx.save();
    game.ctx.fillStyle = playerColor + '15';
    game.ctx.fillRect(0, 0, game.logicalWidth, game.logicalHeight);
    game.ctx.restore();
    game.comboFlashActive = false;
}

export function drawParticles(game) {
    game.particles.forEach((particle) => {
        if (particle.trail && particle.trail.length > 1 && !particle.smoke) {
            for (let index = 0; index < particle.trail.length - 1; index += 1) {
                const trailAlpha = (index / particle.trail.length) * particle.life * 0.4;
                const trailSize = particle.size * (index / particle.trail.length);
                game.ctx.fillStyle =
                    particle.color +
                    Math.floor(trailAlpha * 255)
                        .toString(16)
                        .padStart(2, '0');
                game.ctx.beginPath();
                game.ctx.arc(
                    particle.trail[index].x,
                    particle.trail[index].y,
                    trailSize,
                    0,
                    Math.PI * 2
                );
                game.ctx.fill();
            }
        }

        if (particle.spark) {
            game.ctx.shadowColor = particle.color;
            game.ctx.shadowBlur = 10;
            game.ctx.fillStyle =
                particle.color +
                Math.floor(particle.life * 255)
                    .toString(16)
                    .padStart(2, '0');
            game.ctx.beginPath();
            game.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            game.ctx.fill();
            game.ctx.shadowBlur = 0;
            return;
        }

        if (particle.smoke) {
            game.ctx.fillStyle =
                particle.color +
                Math.floor(particle.life * 128)
                    .toString(16)
                    .padStart(2, '0');
            game.ctx.beginPath();
            game.ctx.arc(
                particle.x,
                particle.y,
                particle.size * (1.5 - particle.life * 0.5),
                0,
                Math.PI * 2
            );
            game.ctx.fill();
            return;
        }

        game.ctx.fillStyle =
            particle.color +
            Math.floor(particle.life * 255)
                .toString(16)
                .padStart(2, '0');
        game.ctx.beginPath();
        game.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        game.ctx.fill();
    });
}

export function drawSparkleEmojis(game) {
    const now = Date.now();

    game.sparkleEmojis.forEach((sparkle) => {
        const age = now - sparkle.startTime;
        if (age < 0) return;

        const progress = age / sparkle.duration;
        if (progress >= 1) return;

        const scaleProgress = progress < 0.5 ? progress * 2 : 1;
        const scale = (sparkle.scale || 1) * (0.5 + scaleProgress * 1.5);
        const alpha = progress < 0.5 ? 1 : 1 - (progress - 0.5) * 2;
        const yOffset = progress * -20;
        const xOffset = Math.sin(progress * Math.PI * 2) * 10;

        game.ctx.save();
        game.ctx.globalAlpha = alpha;
        game.ctx.font = `${game.cellSize * scale}px Arial`;
        game.ctx.textAlign = 'center';
        game.ctx.textBaseline = 'middle';
        game.ctx.fillText(sparkle.emoji || '✨', sparkle.x + xOffset, sparkle.y + yOffset);
        game.ctx.restore();
    });
}

export function drawMultiplierAnimations(game) {
    if (!game.multiplierAnimations) return;

    const now = Date.now();
    game.multiplierAnimations.forEach((animation) => {
        const age = now - animation.startTime;
        const progress = age / animation.duration;
        if (progress >= 1) return;

        const scale = 1 + progress * 2;
        const alpha = 1 - progress;
        const yOffset = -progress * 50;

        game.ctx.save();
        game.ctx.globalAlpha = alpha;
        game.ctx.shadowColor = '#FFD700';
        game.ctx.shadowBlur = 20;
        game.ctx.fillStyle = '#FFD700';
        game.ctx.font = `bold ${game.cellSize * scale}px Arial`;
        game.ctx.textAlign = 'center';
        game.ctx.textBaseline = 'middle';
        game.ctx.fillText(`x${animation.value}`, animation.centerX, animation.centerY + yOffset);
        game.ctx.shadowBlur = 0;
        game.ctx.restore();
    });
}

export function drawPenaltyBoxAnimations(game) {
    if (!game.penaltyBoxAnimations || game.penaltyBoxAnimations.length === 0) return;

    const now = Date.now();
    const reducedMotion = prefersReducedMotion();

    game.penaltyBoxAnimations.forEach((anim) => {
        const age = now - anim.startTime;
        const progress = Math.min(1, Math.max(0, age / anim.duration));
        if (progress >= 1) return;

        const { centerX, centerY, cellSize, playerColor } = anim;
        const halfSize = cellSize / 2;

        game.ctx.save();
        game.ctx.translate(centerX, centerY);

        let scale = 1;
        let wobble = 0;
        let alpha = 1;

        if (reducedMotion) {
            scale = 1;
            alpha = 1 - progress * 0.5;
        } else if (progress < 0.2) {
            // 0 - 280ms: shrink down to 0.2x with quick snap
            const p = progress / 0.2;
            scale = 1 - 0.8 * Math.sin(p * Math.PI * 0.5);
        } else if (progress < 0.6) {
            // 280ms - 840ms: wobble around 0.2x - 0.4x
            const p = (progress - 0.2) / 0.4;
            scale = 0.2 + 0.15 * Math.sin(p * Math.PI * 4);
            wobble = 0.1 * Math.sin(p * Math.PI * 6);
            game.ctx.rotate(wobble);
        } else {
            // 840ms - 1400ms: spring back to full size
            const p = (progress - 0.6) / 0.4;
            scale = 0.35 + 0.65 * (1 - Math.cos(p * Math.PI * 0.5));
            alpha = 1 - p * 0.4;
        }

        game.ctx.scale(scale, scale);

        // Draw deflating penalty box outline & fill
        game.ctx.fillStyle =
            progress < 0.5 ? 'rgba(255, 30, 80, 0.4)' : playerColor || 'rgba(0, 240, 255, 0.3)';
        game.ctx.strokeStyle = '#ff0055';
        game.ctx.lineWidth = 4 / Math.max(0.1, scale);
        game.ctx.shadowColor = '#ff0055';
        game.ctx.shadowBlur = 16;

        if (typeof game.ctx.fillRect === 'function') {
            game.ctx.fillRect(-halfSize, -halfSize, cellSize, cellSize);
        }
        if (typeof game.ctx.strokeRect === 'function') {
            game.ctx.strokeRect(-halfSize, -halfSize, cellSize, cellSize);
        }

        // Stamp "0.2x" in center of penalty box
        if (progress > 0.15) {
            const stampAlpha = progress < 0.8 ? 1 : (1 - progress) / 0.2;
            game.ctx.globalAlpha = stampAlpha * alpha;
            game.ctx.fillStyle = '#ffffff';
            game.ctx.font = `bold ${Math.max(12, cellSize * 0.45)}px sans-serif`;
            game.ctx.textAlign = 'center';
            game.ctx.textBaseline = 'middle';
            game.ctx.shadowColor = '#000000';
            game.ctx.shadowBlur = 8;
            game.ctx.fillText('0.2x', 0, 0);
        }

        game.ctx.restore();
    });
}
