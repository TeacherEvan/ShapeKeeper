import { GAME_CONSTANTS } from '../constants.js';

export function drawDots(game) {
    if (game.dotsCanvas) {
        game.ctx.drawImage(game.dotsCanvas, 0, 0, game.logicalWidth, game.logicalHeight);
        return;
    }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const dotColor = isDark ? '#CCCCCC' : '#333333';

    for (let row = 0; row < game.gridRows; row += 1) {
        for (let col = 0; col < game.gridCols; col += 1) {
            const x = game.offsetX + col * game.cellSize;
            const y = game.offsetY + row * game.cellSize;
            game.ctx.fillStyle = dotColor;
            game.ctx.beginPath();
            game.ctx.arc(x, y, GAME_CONSTANTS.DOT_RADIUS, 0, Math.PI * 2);
            game.ctx.fill();
        }
    }
}

export function drawSelectedDot(game) {
    if (!game.selectedDot) return;

    const x = game.offsetX + game.selectedDot.col * game.cellSize;
    const y = game.offsetY + game.selectedDot.row * game.cellSize;
    const playerColor = game.currentPlayer === 1 ? game.player1Color : game.player2Color;
    const glowPulse = 1 + Math.sin(Date.now() / 150) * 0.3;
    const pulseScale = 1 + Math.sin(Date.now() / 200) * 0.2;

    game.ctx.strokeStyle = playerColor + '60';
    game.ctx.lineWidth = 5;
    game.ctx.beginPath();
    game.ctx.arc(x, y, (GAME_CONSTANTS.DOT_RADIUS + 12) * glowPulse, 0, Math.PI * 2);
    game.ctx.stroke();

    game.ctx.strokeStyle = playerColor;
    game.ctx.lineWidth = 3;
    game.ctx.beginPath();
    game.ctx.arc(x, y, (GAME_CONSTANTS.DOT_RADIUS + 8) * pulseScale, 0, Math.PI * 2);
    game.ctx.stroke();

    game.ctx.lineWidth = 2;
    game.ctx.beginPath();
    game.ctx.arc(x, y, GAME_CONSTANTS.DOT_RADIUS + 5, 0, Math.PI * 2);
    game.ctx.stroke();

    game.ctx.fillStyle = playerColor;
    game.ctx.beginPath();
    game.ctx.arc(x, y, GAME_CONSTANTS.DOT_RADIUS * 2, 0, Math.PI * 2);
    game.ctx.fill();
}

export function drawKeyboardFocusDot(game) {
    if (!game.keyboardFocusDot) {
        return;
    }

    const isSelected =
        game.selectedDot &&
        game.selectedDot.row === game.keyboardFocusDot.row &&
        game.selectedDot.col === game.keyboardFocusDot.col;

    if (isSelected) {
        return;
    }

    const x = game.offsetX + game.keyboardFocusDot.col * game.cellSize;
    const y = game.offsetY + game.keyboardFocusDot.row * game.cellSize;
    const pulseScale = 1 + Math.sin(Date.now() / 180) * 0.12;

    game.ctx.save();
    game.ctx.strokeStyle = 'rgba(21, 101, 192, 0.95)';
    game.ctx.lineWidth = 3;
    game.ctx.setLineDash([6, 4]);
    game.ctx.beginPath();
    game.ctx.arc(x, y, (GAME_CONSTANTS.DOT_RADIUS + 10) * pulseScale, 0, Math.PI * 2);
    game.ctx.stroke();
    game.ctx.setLineDash([]);
    game.ctx.restore();
}
