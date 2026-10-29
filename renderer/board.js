import { GAME_CONSTANTS } from '../constants.js';
import { isMineMultiplier } from '../effect-system/mines.js';
import { easeOutQuad, lerp } from '../utils.js';

export function drawLines(game) {
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

        const lineColor =
            player === GAME_CONSTANTS.POPULATE_PLAYER_ID
                ? game.populateColor
                : player === 1
                  ? game.player1Color
                  : game.player2Color;

        if (isGhostLine) {
            game.ctx.save();
            game.ctx.globalAlpha = GAME_CONSTANTS.GHOST_LINE_OPACITY;
            game.ctx.setLineDash([5, 5]);
        }

        game.ctx.strokeStyle = lineColor;
        game.ctx.lineWidth =
            lineType === 'diagonal' ? GAME_CONSTANTS.LINE_WIDTH * 0.5 : GAME_CONSTANTS.LINE_WIDTH;
        game.ctx.lineCap = 'round';
        game.ctx.beginPath();
        game.ctx.moveTo(
            game.offsetX + start.col * game.cellSize,
            game.offsetY + start.row * game.cellSize
        );
        game.ctx.lineTo(
            game.offsetX + end.col * game.cellSize,
            game.offsetY + end.row * game.cellSize
        );
        game.ctx.stroke();

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

        game.ctx.strokeStyle =
            player === GAME_CONSTANTS.POPULATE_PLAYER_ID
                ? game.populateColor
                : player === 1
                  ? game.player1Color
                  : game.player2Color;
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
    for (const [squareKey, player] of Object.entries(game.squares)) {
        const { row, col } = game.gameLogic.parseSquareKey(squareKey);
        const x = game.offsetX + col * game.cellSize;
        const y = game.offsetY + row * game.cellSize;
        // A fired mine also draws a bomb in the lower-left of the box, so its
        // owner number shrinks to keep the two glyphs from colliding on the
        // 38 px cells a level-100 board gets on a phone.
        const isMine =
            game.revealedMultipliers?.has(squareKey) &&
            isMineMultiplier(game.squareMultipliers?.[squareKey]);

        game.ctx.fillStyle = player === 1 ? game.player1Color + '40' : game.player2Color + '40';
        game.ctx.fillRect(x, y, game.cellSize, game.cellSize);
        game.ctx.fillStyle = player === 1 ? game.player1Color : game.player2Color;
        game.ctx.font = `bold ${Math.max(
            8,
            Math.min(game.cellSize / (isMine ? 3.4 : 2), 20)
        )}px Arial`;
        game.ctx.textAlign = 'center';
        game.ctx.textBaseline = 'middle';
        game.ctx.fillText(player.toString(), x + game.cellSize / 2, y + game.cellSize / 2);
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

    for (const squareKey in game.squares) {
        const player = game.squares[squareKey];
        const color = player === 1 ? game.player1Color : game.player2Color;
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
            const glowIntensity = Math.sin(progress * Math.PI) * 0.5;

            game.ctx.shadowColor = color;
            game.ctx.shadowBlur = 20 * glowIntensity;
            game.ctx.save();
            game.ctx.translate(animation.centerX, animation.centerY);
            game.ctx.scale(scale, scale);
            game.ctx.translate(-animation.centerX, -animation.centerY);
            game.ctx.fillStyle =
                color +
                Math.floor(alpha * 0.25 * 255)
                    .toString(16)
                    .padStart(2, '0');
            game.ctx.fillRect(x, y, game.cellSize, game.cellSize);
            game.ctx.restore();
            game.ctx.shadowBlur = 0;
        }

        const multiplierData = game.squareMultipliers?.[squareKey];
        const isMine = game.revealedMultipliers?.has(squareKey) && isMineMultiplier(multiplierData);

        game.ctx.fillStyle = color;
        // Keep the owner number clear of the bomb on small boards.
        game.ctx.font = `bold ${game.cellSize * (isMine ? 0.28 : 0.4)}px Arial`;
        game.ctx.textAlign = 'center';
        game.ctx.textBaseline = 'middle';
        game.ctx.fillText(player, x + game.cellSize / 2, y + game.cellSize / 2);

        if (isMine) {
            // A fired mine keeps a permanent 💣 so the box reads as
            // "this one was mined" instead of "I did something wrong".
            const bombSize = Math.max(10, Math.min(game.cellSize * 0.26, 26));
            game.ctx.font = `${bombSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", Arial`;
            game.ctx.textAlign = 'center';
            game.ctx.textBaseline = 'middle';
            game.ctx.fillText('💣', x + game.cellSize * 0.22, y + game.cellSize * 0.74);

            // Keep the penalty value readable without stealing the box.
            game.ctx.font = `bold ${Math.max(7, game.cellSize * 0.16)}px Arial`;
            game.ctx.fillStyle = '#FFD700';
            game.ctx.textAlign = 'right';
            game.ctx.textBaseline = 'top';
            game.ctx.fillText('×0.2', x + game.cellSize - 3, y + 3);
            game.ctx.textAlign = 'center';
            game.ctx.textBaseline = 'middle';
        } else if (multiplierData && multiplierData.type === 'multiplier') {
            game.ctx.font = `bold ${game.cellSize * 0.25}px Arial`;
            game.ctx.fillStyle = '#FFD700';
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
