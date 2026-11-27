import { GAME_CONSTANTS } from '../constants.js';
import { isMineMultiplier } from '../effect-system/mines.js';
import { easeOutQuad, formatHexAlpha, lerp } from '../utils.js';

function isDarkTheme() {
    return (
        typeof document === 'undefined' ||
        document.documentElement?.getAttribute?.('data-theme') !== 'light'
    );
}

export function resolveBoardColor(hex, dark = isDarkTheme()) {
    if (!dark) {
        const lower = typeof hex === 'string' ? hex.toLowerCase() : '';
        if (lower === '#ef4444' || lower === '#ff4d6d') return '#c81e32';
        if (lower === '#3b82f6' || lower === '#5c9bff') return '#1d4ed8';
    }
    return hex;
}

export function getPlayerColor(game, player) {
    if (player === GAME_CONSTANTS.POPULATE_PLAYER_ID) {
        return game.populateColor;
    }
    const raw =
        game.playerColors?.[player] ?? (player === 1 ? game.player1Color : game.player2Color);
    return resolveBoardColor(raw);
}

export function drawBoardFrame(game) {
    const ctx = game.ctx;
    if (
        !ctx ||
        typeof ctx.beginPath !== 'function' ||
        typeof ctx.roundRect !== 'function' ||
        game.offsetX == null ||
        game.offsetY == null ||
        !game.gridCols ||
        !game.gridRows
    ) {
        return;
    }

    const dark = isDarkTheme();
    const pad = Math.min(GAME_CONSTANTS.GRID_OFFSET - 2, Math.max(12, game.cellSize * 0.22));
    const boardW = (game.gridCols - 1) * game.cellSize;
    const boardH = (game.gridRows - 1) * game.cellSize;
    const x = game.offsetX - pad;
    const y = game.offsetY - pad;
    const w = boardW + pad * 2;
    const h = boardH + pad * 2;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 18);
    ctx.fillStyle = dark ? 'rgba(10, 16, 31, 0.72)' : 'rgba(250, 250, 254, 0.78)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = dark ? 'rgba(232, 244, 255, 0.12)' : 'rgba(19, 26, 46, 0.12)';
    ctx.stroke();
    ctx.restore();
}

export function drawLines(game) {
    const dark = isDarkTheme();
    // Precompute lookups once (O(n)) so per-line checks are O(1) instead of O(n^2).
    const lineDrawingKeys = new Set(game.lineDrawings.map((a) => a.lineKey));
    const pulsatingByLine = new Map();
    for (const pulse of game.pulsatingLines) {
        pulsatingByLine.set(pulse.line, pulse.player);
    }

    for (const lineKey of game.lines) {
        if (lineDrawingKeys.has(lineKey)) {
            continue;
        }

        const [start, end] = game.gameLogic.parseLineKey(lineKey);
        const lineType = game.gameLogic.getLineType(start, end);
        const pulsatingPlayer = pulsatingByLine.get(lineKey);
        const player = pulsatingPlayer ?? game.gameLogic.getLinePlayer(lineKey);
        const isGhostLine = game.ghostLines && game.ghostLines.has(lineKey);

        const lineColor = getPlayerColor(game, player);
        const coreWidth =
            lineType === 'diagonal' ? GAME_CONSTANTS.LINE_WIDTH * 0.5 : GAME_CONSTANTS.LINE_WIDTH;
        const x1 = game.offsetX + start.col * game.cellSize;
        const y1 = game.offsetY + start.row * game.cellSize;
        const x2 = game.offsetX + end.col * game.cellSize;
        const y2 = game.offsetY + end.row * game.cellSize;

        if (isGhostLine) {
            game.ctx.save();
            game.ctx.globalAlpha = GAME_CONSTANTS.GHOST_LINE_OPACITY;
            game.ctx.setLineDash([5, 5]);
        } else {
            // Soft outer halo pass (no shadowBlur loop)
            game.ctx.save();
            game.ctx.globalAlpha = 0.3;
            game.ctx.strokeStyle = lineColor;
            game.ctx.lineWidth = coreWidth * 1.9;
            game.ctx.lineCap = 'round';
            game.ctx.beginPath();
            game.ctx.moveTo(x1, y1);
            game.ctx.lineTo(x2, y2);
            game.ctx.stroke();
            game.ctx.restore();
        }

        game.ctx.strokeStyle = lineColor;
        game.ctx.lineWidth = coreWidth;
        game.ctx.lineCap = 'round';
        game.ctx.beginPath();
        game.ctx.moveTo(x1, y1);
        game.ctx.lineTo(x2, y2);
        game.ctx.stroke();

        if (!isGhostLine) {
            // Hairline specular along the upper edge of the stroke: a jewel,
            // not a flat 4px plastic strip. Three cheap passes, no shadowBlur.
            game.ctx.save();
            game.ctx.globalAlpha = dark ? 0.26 : 0.4;
            game.ctx.strokeStyle = '#ffffff';
            game.ctx.lineWidth = Math.max(1, coreWidth * 0.2);
            game.ctx.lineCap = 'round';
            game.ctx.beginPath();
            game.ctx.moveTo(x1, y1 - coreWidth * 0.18);
            game.ctx.lineTo(x2, y2 - coreWidth * 0.18);
            game.ctx.stroke();
            game.ctx.restore();
        }

        if (isGhostLine) {
            game.ctx.setLineDash([]);
            game.ctx.restore();
        }
    }
}

export function drawLineAnimations(game) {
    const now = Date.now();

    game.lineDrawings.forEach((animation) => {
        const age = now - animation.startTime;
        const progress = Math.min(age / animation.duration, 1);
        const easedProgress = easeOutQuad(progress);
        const currentEndX = lerp(animation.startDot.x, animation.endDot.x, easedProgress);
        const currentEndY = lerp(animation.startDot.y, animation.endDot.y, easedProgress);
        const player = animation.player;

        game.ctx.strokeStyle = getPlayerColor(game, player);
        game.ctx.lineWidth = GAME_CONSTANTS.LINE_WIDTH;
        game.ctx.lineCap = 'round';
        game.ctx.beginPath();
        game.ctx.moveTo(animation.startDot.x, animation.startDot.y);
        game.ctx.lineTo(currentEndX, currentEndY);
        game.ctx.stroke();
    });
}

export function drawInvalidLineFlash(game) {
    if (!game.invalidLineFlash) return;

    const now = Date.now();
    const age = now - game.invalidLineFlash.startTime;
    const progress = age / game.invalidLineFlash.duration;
    if (progress >= 1) return;

    const { dot1, dot2 } = game.invalidLineFlash;
    const x1 = game.offsetX + dot1.col * game.cellSize;
    const y1 = game.offsetY + dot1.row * game.cellSize;
    const x2 = game.offsetX + dot2.col * game.cellSize;
    const y2 = game.offsetY + dot2.row * game.cellSize;

    game.ctx.save();
    game.ctx.strokeStyle = `rgba(255, 60, 60, ${1 - progress})`;
    game.ctx.lineWidth = GAME_CONSTANTS.LINE_WIDTH;
    game.ctx.lineCap = 'round';
    game.ctx.shadowColor = '#FF3C3C';
    game.ctx.shadowBlur = 15 * (1 - progress);
    game.ctx.setLineDash([8, 8]);
    game.ctx.beginPath();
    game.ctx.moveTo(x1, y1);
    game.ctx.lineTo(x2, y2);
    game.ctx.stroke();
    game.ctx.setLineDash([]);
    game.ctx.restore();
}

export function drawSquares(game) {
    const dark = isDarkTheme();
    const inset = Math.max(2, game.cellSize * 0.08);
    const tileSize = Math.max(4, game.cellSize - inset * 2);
    const radius = Math.max(4, Math.min(10, game.cellSize * 0.14));

    for (const [squareKey, player] of Object.entries(game.squares)) {
        const { row, col } = game.gameLogic.parseSquareKey(squareKey);
        const x = game.offsetX + col * game.cellSize;
        const y = game.offsetY + row * game.cellSize;
        const color = getPlayerColor(game, player);

        if (typeof game.ctx.beginPath === 'function' && typeof game.ctx.roundRect === 'function') {
            game.ctx.save();
            game.ctx.beginPath();
            game.ctx.roundRect(x + inset, y + inset, tileSize, tileSize, radius);
            game.ctx.fillStyle = formatHexAlpha(color, dark ? 0.22 : 0.18);
            game.ctx.fill();
            game.ctx.lineWidth = 1;
            game.ctx.strokeStyle = formatHexAlpha(color, dark ? 0.48 : 0.4);
            game.ctx.stroke();
            // Top-edge inset sheen gives the claimed tile a tactile lip.
            game.ctx.strokeStyle = formatHexAlpha('#ffffff', dark ? 0.16 : 0.5);
            game.ctx.beginPath();
            game.ctx.moveTo(x + inset + radius, y + inset + 1);
            game.ctx.lineTo(x + inset + tileSize - radius, y + inset + 1);
            game.ctx.stroke();
            game.ctx.restore();
        } else {
            game.ctx.fillStyle = formatHexAlpha(color, dark ? 0.22 : 0.18);
            game.ctx.fillRect(x, y, game.cellSize, game.cellSize);
        }
    }
}

export function drawSquaresWithAnimations(game) {
    const now = Date.now();

    // Precompute square-animation lookup once (O(n)) instead of a per-square
    // `.find` (O(n^2) across all squares each frame).
    const animationBySquare = new Map();
    for (const item of game.squareAnimations) {
        animationBySquare.set(item.squareKey, item);
    }

    const dark = isDarkTheme();

    for (const squareKey in game.squares) {
        const player = game.squares[squareKey];
        const color = getPlayerColor(game, player);
        const { row, col } = game.gameLogic.parseSquareKey(squareKey);
        const x = game.offsetX + col * game.cellSize;
        const y = game.offsetY + row * game.cellSize;
        const animation = animationBySquare.get(squareKey);

        if (animation) {
            const age = now - animation.startTime;
            const progress = age / animation.duration;
            const easeProgress = easeOutQuad(progress);
            const scale = 0.3 + easeProgress * 0.7;
            const alpha = Math.min(progress * 2, 1);

            game.ctx.save();
            game.ctx.translate(animation.centerX, animation.centerY);
            game.ctx.scale(scale, scale);
            game.ctx.translate(-animation.centerX, -animation.centerY);
            game.ctx.fillStyle = formatHexAlpha(color, alpha * 0.22);
            game.ctx.fillRect(x, y, game.cellSize, game.cellSize);
            game.ctx.restore();
        }

        const multiplierData = game.squareMultipliers?.[squareKey];
        const isMine = game.revealedMultipliers?.has(squareKey) && isMineMultiplier(multiplierData);

        game.ctx.fillStyle = color;
        // Single crisp owner numeral pass in Space Grotesk (fixes double-drawn ghosted Arial).
        game.ctx.font = `700 ${Math.max(10, Math.round(game.cellSize * (isMine ? 0.28 : 0.36)))}px "Space Grotesk", sans-serif`;
        game.ctx.textAlign = 'center';
        game.ctx.textBaseline = 'middle';
        game.ctx.fillText(String(player), x + game.cellSize / 2, y + game.cellSize / 2);

        if (isMine) {
            // A fired mine keeps a permanent 💣 so the box reads as
            // "this one was mined" instead of "I did something wrong".
            const bombSize = Math.max(10, Math.min(game.cellSize * 0.26, 26));
            game.ctx.font = `${bombSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
            game.ctx.textAlign = 'center';
            game.ctx.textBaseline = 'middle';
            game.ctx.fillText('💣', x + game.cellSize * 0.22, y + game.cellSize * 0.74);

            // Keep the penalty value readable without stealing the box.
            game.ctx.font = `700 ${Math.max(7, Math.round(game.cellSize * 0.16))}px "Space Mono", monospace`;
            game.ctx.fillStyle = dark ? '#fdcf64' : '#7c4912';
            game.ctx.textAlign = 'right';
            game.ctx.textBaseline = 'top';
            game.ctx.fillText('×0.2', x + game.cellSize - 3, y + 3);
            game.ctx.textAlign = 'center';
            game.ctx.textBaseline = 'middle';
        } else if (multiplierData && multiplierData.type === 'multiplier') {
            game.ctx.font = `700 ${Math.max(9, Math.round(game.cellSize * 0.24))}px "Space Mono", monospace`;
            game.ctx.fillStyle = dark ? '#fdcf64' : '#7c4912';
            game.ctx.fillText(
                `x${multiplierData.value}`,
                x + game.cellSize / 2,
                y + game.cellSize * 0.75
            );
        }

        // Opponent-tap indicator: a small ✋ in the top-right of the square,
        // visible to BOTH players (it's a public signal that this box was
        // successfully tapped — the owner can see the threat, the tapper
        // can see their hit land). Only shown when the square has been tapped
        // AND the multiplier has not been revealed yet.
        if (
            !game.revealedMultipliers.has(squareKey) &&
            game.squareTaps &&
            (game.squareTaps[squareKey] ?? 0) > 0
        ) {
            const tapFontSize = Math.max(10, Math.min(game.cellSize * 0.35, 22));
            game.ctx.font = `${tapFontSize}px Arial`;
            game.ctx.textAlign = 'right';
            game.ctx.textBaseline = 'top';
            // Soft red on the hand to signal "you've been hit" — visible
            // without obscuring the owner label.
            game.ctx.fillStyle = 'rgba(255, 80, 80, 0.9)';
            game.ctx.fillText('✋', x + game.cellSize - 4, y + 4);
            // Reset text alignment for the next draw.
            game.ctx.textAlign = 'center';
            game.ctx.textBaseline = 'middle';
        }
    }
}
