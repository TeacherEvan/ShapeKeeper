import { getDotRenderRadius, prefersReducedMotion } from '../utils.js';
import { getPlayerColor } from './board.js';

export function drawDots(game) {
    if (game.dotsCanvas) {
        game.ctx.drawImage(game.dotsCanvas, 0, 0, game.logicalWidth, game.logicalHeight);
        return;
    }

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const shadowColor = isDark ? 'rgba(0, 0, 0, 0.42)' : 'rgba(20, 24, 33, 0.16)';
    const collarColor = isDark ? 'rgba(245, 183, 39, 0.24)' : 'rgba(20, 24, 33, 0.14)';
    const coreColor = isDark ? '#f8fafc' : '#182030';
    const glintColor = isDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(255, 255, 255, 0.55)';
    const dotRadius = getDotRenderRadius(game.cellSize, game.isTouchDevice);

    for (let row = 0; row < game.gridRows; row += 1) {
        for (let col = 0; col < game.gridCols; col += 1) {
            const x = game.offsetX + col * game.cellSize;
            const y = game.offsetY + row * game.cellSize;

            game.ctx.fillStyle = shadowColor;
            game.ctx.beginPath();
            game.ctx.arc(x, y + 1, dotRadius + 2.1, 0, Math.PI * 2);
            game.ctx.fill();

            game.ctx.fillStyle = collarColor;
            game.ctx.beginPath();
            game.ctx.arc(x, y, dotRadius + 2, 0, Math.PI * 2);
            game.ctx.fill();

            game.ctx.fillStyle = coreColor;
            game.ctx.beginPath();
            game.ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
            game.ctx.fill();

            if (dotRadius >= 3) {
                game.ctx.fillStyle = glintColor;
                game.ctx.beginPath();
                game.ctx.arc(
                    x - dotRadius * 0.28,
                    y - dotRadius * 0.28,
                    Math.max(0.9, dotRadius * 0.28),
                    0,
                    Math.PI * 2
                );
                game.ctx.fill();
            }
        }
    }
}

export function drawSelectedDot(game) {
    if (!game.selectedDot) return;

    const dotRadius = getDotRenderRadius(game.cellSize, game.isTouchDevice);
    const x = game.offsetX + game.selectedDot.col * game.cellSize;
    const y = game.offsetY + game.selectedDot.row * game.cellSize;
    const playerColor = getPlayerColor(game, game.currentPlayer);
    const reduced = prefersReducedMotion();
    const now = Date.now();
    const glowPulse = reduced ? 1 : 1 + Math.sin(now / 150) * 0.24;
    const pulseScale = reduced ? 1 : 1 + Math.sin(now / 200) * 0.14;
    const reticleAngle = reduced ? 0 : (now / 1600) % (Math.PI * 2);
    const outerGlowRadius = dotRadius + (game.isTouchDevice ? 16 : 12);
    const middleRingRadius = dotRadius + (game.isTouchDevice ? 10 : 8);
    const innerRingRadius = dotRadius + (game.isTouchDevice ? 7 : 5);
    const fillRadius = Math.max(
        dotRadius * (game.isTouchDevice ? 2.4 : 1.9),
        game.isTouchDevice ? 8.5 : 5.5
    );

    game.ctx.save();
    game.ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    game.ctx.beginPath();
    game.ctx.arc(x, y, innerRingRadius + 1.5, 0, Math.PI * 2);
    game.ctx.fill();

    game.ctx.strokeStyle = playerColor + '55';
    game.ctx.lineWidth = game.isTouchDevice ? 5 : 4;
    game.ctx.beginPath();
    game.ctx.arc(x, y, outerGlowRadius * glowPulse, 0, Math.PI * 2);
    game.ctx.stroke();

    game.ctx.strokeStyle = playerColor;
    game.ctx.lineWidth = game.isTouchDevice ? 3.5 : 2.5;
    game.ctx.beginPath();
    game.ctx.arc(x, y, middleRingRadius * pulseScale, 0, Math.PI * 2);
    game.ctx.stroke();

    // Precision rotating astrolabe lock-on crosshair ticks
    if (typeof game.ctx.translate === 'function' && typeof game.ctx.rotate === 'function') {
        game.ctx.save();
        game.ctx.translate(x, y);
        game.ctx.rotate(reticleAngle);
        game.ctx.strokeStyle = playerColor;
        game.ctx.lineWidth = 2;
        game.ctx.lineCap = 'round';
        const tickInner = middleRingRadius * pulseScale + 2;
        const tickOuter = tickInner + 5;
        game.ctx.beginPath();
        for (let k = 0; k < 4; k++) {
            const a = (k * Math.PI) / 2;
            const ca = Math.cos(a);
            const sa = Math.sin(a);
            game.ctx.moveTo(ca * tickInner, sa * tickInner);
            game.ctx.lineTo(ca * tickOuter, sa * tickOuter);
        }
        game.ctx.stroke();
        game.ctx.restore();
    }

    game.ctx.lineWidth = 2;
    game.ctx.beginPath();
    game.ctx.arc(x, y, innerRingRadius, 0, Math.PI * 2);
    game.ctx.stroke();

    game.ctx.fillStyle = playerColor;
    game.ctx.beginPath();
    game.ctx.arc(x, y, fillRadius, 0, Math.PI * 2);
    game.ctx.fill();
    game.ctx.restore();
}

export function drawKeyboardFocusDot(game) {
    if (!game.keyboardFocusDot || !game.showKeyboardFocusRing) {
        return;
    }

    const isSelected =
        game.selectedDot &&
        game.selectedDot.row === game.keyboardFocusDot.row &&
        game.selectedDot.col === game.keyboardFocusDot.col;

    if (isSelected) {
        return;
    }

    const isDark =
        typeof document === 'undefined' ||
        document.documentElement?.getAttribute?.('data-theme') !== 'light';
    const dotRadius = getDotRenderRadius(game.cellSize, game.isTouchDevice);
    const x = game.offsetX + game.keyboardFocusDot.col * game.cellSize;
    const y = game.offsetY + game.keyboardFocusDot.row * game.cellSize;
    const pulseScale = 1 + Math.sin(Date.now() / 180) * 0.12;

    game.ctx.save();
    game.ctx.strokeStyle = isDark ? 'rgba(245, 183, 39, 0.95)' : 'rgba(29, 78, 216, 0.92)';
    game.ctx.lineWidth = 3;
    game.ctx.setLineDash([6, 4]);
    game.ctx.beginPath();
    game.ctx.arc(x, y, (dotRadius + 10) * pulseScale, 0, Math.PI * 2);
    game.ctx.stroke();
    game.ctx.setLineDash([]);
    game.ctx.restore();
}
