import { GAME_CONSTANTS } from '../constants.js';

export function drawDynamicBackground(game) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const scoreDiff = game.scores[1] - game.scores[2];
    const targetHue = 220 + scoreDiff * 2;
    game.backgroundHue += (targetHue - game.backgroundHue) * 0.02;

    const gradient = game.ctx.createRadialGradient(
        game.logicalWidth / 2,
        game.logicalHeight / 2,
        0,
        game.logicalWidth / 2,
        game.logicalHeight / 2,
        Math.max(game.logicalWidth, game.logicalHeight)
    );

    if (isDark) {
        gradient.addColorStop(0, `hsla(${game.backgroundHue}, 20%, 12%, 0.3)`);
        gradient.addColorStop(1, `hsla(${game.backgroundHue + 30}, 15%, 8%, 0.2)`);
    } else {
        gradient.addColorStop(0, `hsla(${game.backgroundHue}, 15%, 98%, 0.3)`);
        gradient.addColorStop(1, `hsla(${game.backgroundHue + 30}, 10%, 95%, 0.2)`);
    }

    game.ctx.fillStyle = gradient;
    game.ctx.fillRect(0, 0, game.logicalWidth, game.logicalHeight);
}

export function drawAmbientParticles(game) {
    const now = Date.now() / 1000;

    game.ambientParticles.forEach((particle) => {
        const xOffset = Math.sin(now + particle.phase) * 0.5;
        const yOffset = Math.cos(now * 0.7 + particle.phase) * 0.3;

        game.ctx.fillStyle = `rgba(100, 100, 120, ${particle.opacity})`;
        game.ctx.beginPath();
        game.ctx.arc(particle.x + xOffset, particle.y + yOffset, particle.size, 0, Math.PI * 2);
        game.ctx.fill();
    });
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
    const { targetX, targetY } = game.selectionRibbon;
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
