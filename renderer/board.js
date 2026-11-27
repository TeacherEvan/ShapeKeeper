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
    const pad = Math.min(
        Math.max(8, GAME_CONSTANTS.GRID_OFFSET - 7),
        Math.max(10, game.cellSize * 0.18)
    );
    const boardW = (game.gridCols - 1) * game.cellSize;
    const boardH = (game.gridRows - 1) * game.cellSize;
    const x = game.offsetX - pad;
    const y = game.offsetY - pad;
    const w = boardW + pad * 2;
    const h = boardH + pad * 2;

    ctx.save();
    // Soft ambient under-glow behind the sculpted board slate
    if (typeof ctx.createRadialGradient === 'function') {
        const gcx = x + w / 2;
        const gcy = y + h / 2;
        const glow = ctx.createRadialGradient(
            gcx,
            gcy,
            Math.min(w, h) * 0.2,
            gcx,
            gcy,
            Math.max(w, h) * 0.85
        );
        glow.addColorStop(0, dark ? 'rgba(92, 155, 255, 0.08)' : 'rgba(140, 85, 0, 0.05)');
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(x - 24, y - 24, w + 48, h + 48);
    }

    // Ground contact shadow
    ctx.beginPath();
    ctx.roundRect(x - 4, y + 1, w + 8, h + 8, 20);
    ctx.fillStyle = dark ? 'rgba(0, 0, 0, 0.36)' : 'rgba(20, 24, 33, 0.09)';
    ctx.fill();

    // Chamfered outer relic bezel (stays strictly inside [3, logicalWidth - 3])
    ctx.beginPath();
    ctx.roundRect(x - 4, y - 4, w + 8, h + 8, 20);
    ctx.fillStyle = dark ? 'rgba(11, 15, 24, 0.92)' : 'rgba(235, 229, 216, 0.86)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = dark ? 'rgba(245, 183, 39, 0.24)' : 'rgba(140, 85, 0, 0.22)';
    ctx.stroke();

    // Four burnished-gold architectural corner brackets (13px L-ticks)
    const bx1 = x - 4;
    const by1 = y - 4;
    const bx2 = x + w + 4;
    const by2 = y + h + 4;
    const arm = 13;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = dark ? 'rgba(245, 183, 39, 0.52)' : 'rgba(140, 85, 0, 0.44)';
    ctx.beginPath();
    ctx.moveTo(bx1 + 6, by1 + arm + 6);
    ctx.lineTo(bx1 + 6, by1 + 6);
    ctx.lineTo(bx1 + arm + 6, by1 + 6);
    ctx.moveTo(bx2 - arm - 6, by1 + 6);
    ctx.lineTo(bx2 - 6, by1 + 6);
    ctx.lineTo(bx2 - 6, by1 + arm + 6);
    ctx.moveTo(bx1 + 6, by2 - arm - 6);
    ctx.lineTo(bx1 + 6, by2 - 6);
    ctx.lineTo(bx1 + arm + 6, by2 - 6);
    ctx.moveTo(bx2 - arm - 6, by2 - 6);
    ctx.lineTo(bx2 - 6, by2 - 6);
    ctx.lineTo(bx2 - 6, by2 - arm - 6);
    ctx.stroke();

    // Recessed inner playing basin
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 18);
    if (typeof ctx.createLinearGradient === 'function') {
        const basinGrad = ctx.createLinearGradient(x, y, x, y + h);
        basinGrad.addColorStop(0, dark ? 'rgba(19, 27, 44, 0.94)' : 'rgba(255, 254, 251, 0.96)');
        basinGrad.addColorStop(1, dark ? 'rgba(13, 19, 32, 0.94)' : 'rgba(245, 241, 231, 0.95)');
        ctx.fillStyle = basinGrad;
    } else {
        ctx.fillStyle = dark ? 'rgba(17, 23, 36, 0.92)' : 'rgba(255, 253, 249, 0.95)';
    }
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = dark ? 'rgba(246, 243, 235, 0.14)' : 'rgba(20, 24, 33, 0.14)';
    ctx.stroke();

    // Subtle specular top lip on the recessed basin
    ctx.beginPath();
    ctx.moveTo(x + 18, y + 1);
    ctx.lineTo(x + w - 18, y + 1);
    ctx.strokeStyle = dark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.95)';
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
            // 4-pass jewel filament stroke (no shadowBlur loop):
            // 1) ambient bleed -> 2) luminous halo -> 3) body -> 4) specular core
            game.ctx.save();
            game.ctx.lineCap = 'round';
            game.ctx.strokeStyle = lineColor;
            game.ctx.globalAlpha = dark ? 0.14 : 0.1;
            game.ctx.lineWidth = coreWidth * 2.5;
            game.ctx.beginPath();
            game.ctx.moveTo(x1, y1);
            game.ctx.lineTo(x2, y2);
            game.ctx.stroke();

            game.ctx.globalAlpha = dark ? 0.34 : 0.24;
            game.ctx.lineWidth = coreWidth * 1.55;
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
            game.ctx.save();
            game.ctx.globalAlpha = dark ? 0.44 : 0.56;
            game.ctx.strokeStyle = '#ffffff';
            game.ctx.lineWidth = Math.max(1.2, coreWidth * 0.32);
            game.ctx.lineCap = 'round';
            game.ctx.beginPath();
            game.ctx.moveTo(x1, y1 - coreWidth * 0.14);
            game.ctx.lineTo(x2, y2 - coreWidth * 0.14);
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
    const dark = isDarkTheme();
    const coreWidth = GAME_CONSTANTS.LINE_WIDTH;

    game.lineDrawings.forEach((animation) => {
        const age = now - animation.startTime;
        const progress = Math.min(age / animation.duration, 1);
        const easedProgress = easeOutQuad(progress);
        const currentEndX = lerp(animation.startDot.x, animation.endDot.x, easedProgress);
        const currentEndY = lerp(animation.startDot.y, animation.endDot.y, easedProgress);
        const lineColor = getPlayerColor(game, animation.player);

        game.ctx.save();
        game.ctx.lineCap = 'round';
        game.ctx.strokeStyle = lineColor;
        game.ctx.globalAlpha = dark ? 0.32 : 0.22;
        game.ctx.lineWidth = coreWidth * 1.6;
        game.ctx.beginPath();
        game.ctx.moveTo(animation.startDot.x, animation.startDot.y);
        game.ctx.lineTo(currentEndX, currentEndY);
        game.ctx.stroke();

        game.ctx.globalAlpha = 1;
        game.ctx.lineWidth = coreWidth;
        game.ctx.beginPath();
        game.ctx.moveTo(animation.startDot.x, animation.startDot.y);
        game.ctx.lineTo(currentEndX, currentEndY);
        game.ctx.stroke();

        game.ctx.globalAlpha = dark ? 0.48 : 0.58;
        game.ctx.strokeStyle = '#ffffff';
        game.ctx.lineWidth = Math.max(1.2, coreWidth * 0.3);
        game.ctx.beginPath();
        game.ctx.moveTo(animation.startDot.x, animation.startDot.y - coreWidth * 0.14);
        game.ctx.lineTo(currentEndX, currentEndY - coreWidth * 0.14);
        game.ctx.stroke();

        // Blazing comet-tip orb at the active drawing head
        game.ctx.globalAlpha = 0.45;
        game.ctx.fillStyle = lineColor;
        game.ctx.beginPath();
        game.ctx.arc(currentEndX, currentEndY, coreWidth * 1.45, 0, Math.PI * 2);
        game.ctx.fill();

        game.ctx.globalAlpha = 0.95;
        game.ctx.fillStyle = '#ffffff';
        game.ctx.beginPath();
        game.ctx.arc(currentEndX, currentEndY, coreWidth * 0.52, 0, Math.PI * 2);
        game.ctx.fill();
        game.ctx.restore();
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
            const tx = x + inset;
            const ty = y + inset;
            game.ctx.save();
            game.ctx.beginPath();
            game.ctx.roundRect(tx, ty, tileSize, tileSize, radius);

            if (typeof game.ctx.createLinearGradient === 'function') {
                const tileGrad = game.ctx.createLinearGradient(
                    tx,
                    ty,
                    tx + tileSize,
                    ty + tileSize
                );
                tileGrad.addColorStop(0, formatHexAlpha(color, dark ? 0.34 : 0.24));
                tileGrad.addColorStop(0.5, formatHexAlpha(color, dark ? 0.22 : 0.15));
                tileGrad.addColorStop(1, formatHexAlpha(color, dark ? 0.11 : 0.1));
                game.ctx.fillStyle = tileGrad;
            } else {
                game.ctx.fillStyle = formatHexAlpha(color, dark ? 0.24 : 0.18);
            }
            game.ctx.fill();

            // Faceted crystal corner glint clipped inside the rounded stained-glass tile
            if (typeof game.ctx.clip === 'function') {
                game.ctx.save();
                game.ctx.clip();
                game.ctx.beginPath();
                game.ctx.moveTo(tx, ty);
                game.ctx.lineTo(tx + tileSize * 0.65, ty);
                game.ctx.lineTo(tx, ty + tileSize * 0.65);
                game.ctx.closePath();
                game.ctx.fillStyle = formatHexAlpha('#ffffff', dark ? 0.08 : 0.28);
                game.ctx.fill();
                game.ctx.restore();
            }

            game.ctx.beginPath();
            game.ctx.roundRect(tx, ty, tileSize, tileSize, radius);
            game.ctx.lineWidth = 1.5;
            game.ctx.strokeStyle = formatHexAlpha(color, dark ? 0.68 : 0.54);
            game.ctx.stroke();

            // Top-edge specular sheen gives the claimed tile a tactile lip.
            game.ctx.lineWidth = 1;
            game.ctx.strokeStyle = formatHexAlpha('#ffffff', dark ? 0.24 : 0.62);
            game.ctx.beginPath();
            game.ctx.moveTo(tx + radius, ty + 1);
            game.ctx.lineTo(tx + tileSize - radius, ty + 1);
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
        const cx = x + game.cellSize / 2;
        const cy = y + game.cellSize / 2;

        if (
            typeof game.ctx.beginPath === 'function' &&
            typeof game.ctx.arc === 'function' &&
            game.cellSize >= 26
        ) {
            const crestR = Math.max(10, Math.min(26, game.cellSize * 0.23));
            game.ctx.save();
            game.ctx.beginPath();
            game.ctx.arc(cx, cy, crestR, 0, Math.PI * 2);
            game.ctx.fillStyle = dark ? 'rgba(11, 14, 20, 0.58)' : 'rgba(255, 253, 249, 0.84)';
            game.ctx.fill();
            game.ctx.lineWidth = 1.25;
            game.ctx.strokeStyle = isMine ? '#ff6b7a' : formatHexAlpha(color, dark ? 0.72 : 0.58);
            game.ctx.stroke();
            game.ctx.restore();
        }

        game.ctx.fillStyle = color;
        // Single crisp owner numeral pass in Oxanium
        game.ctx.font = `800 ${Math.max(10, Math.round(game.cellSize * (isMine ? 0.26 : 0.34)))}px "Oxanium", "Space Grotesk", sans-serif`;
        game.ctx.textAlign = 'center';
        game.ctx.textBaseline = 'middle';
        game.ctx.fillText(String(player), cx, cy);

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
