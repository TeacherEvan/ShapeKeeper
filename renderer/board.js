import { GAME_CONSTANTS } from '../constants.js';
import { easeOutQuad, lerp } from '../utils.js';

export function drawLines(game) {
    for (const lineKey of game.lines) {
        if (game.lineDrawings.some((animation) => animation.lineKey === lineKey)) {
            continue;
        }

        const [start, end] = game.gameLogic.parseLineKey(lineKey);
        const lineType = game.gameLogic.getLineType(start, end);
        const pulsating = game.pulsatingLines.find((pulse) => pulse.line === lineKey);
        const player = pulsating?.player || game.gameLogic.getLinePlayer(lineKey);
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

        game.ctx.fillStyle = player === 1 ? game.player1Color + '40' : game.player2Color + '40';
        game.ctx.fillRect(x, y, game.cellSize, game.cellSize);
        game.ctx.fillStyle = player === 1 ? game.player1Color : game.player2Color;
        game.ctx.font = `bold ${Math.max(8, Math.min(game.cellSize / 2, 20))}px Arial`;
        game.ctx.textAlign = 'center';
        game.ctx.textBaseline = 'middle';
        game.ctx.fillText(player.toString(), x + game.cellSize / 2, y + game.cellSize / 2);
    }
}

export function drawSquaresWithAnimations(game) {
    const now = Date.now();

    for (const squareKey in game.squares) {
        const player = game.squares[squareKey];
        const color = player === 1 ? game.player1Color : game.player2Color;
        const { row, col } = game.gameLogic.parseSquareKey(squareKey);
        const x = game.offsetX + col * game.cellSize;
        const y = game.offsetY + row * game.cellSize;
        const animation = game.squareAnimations.find((item) => item.squareKey === squareKey);

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

        game.ctx.fillStyle = color;
        game.ctx.font = `bold ${game.cellSize * 0.4}px Arial`;
        game.ctx.textAlign = 'center';
        game.ctx.textBaseline = 'middle';
        game.ctx.fillText(player, x + game.cellSize / 2, y + game.cellSize / 2);

        if (game.revealedMultipliers.has(squareKey)) {
            const multiplierData = game.squareMultipliers[squareKey];
            if (multiplierData && multiplierData.type === 'multiplier') {
                game.ctx.font = `bold ${game.cellSize * 0.25}px Arial`;
                game.ctx.fillStyle = '#FFD700';
                game.ctx.fillText(
                    `x${multiplierData.value}`,
                    x + game.cellSize / 2,
                    y + game.cellSize * 0.75
                );
            }
        }

        drawTileEffectIndicator(game, squareKey, x, y, player);
    }

    drawHiddenEffectShimmers(game);
}

export function drawTrianglesWithAnimations(game) {
    const now = Date.now();
    const effectIndicatorsDrawn = new Set();

    for (const triangleKey in game.triangles) {
        const player = game.triangles[triangleKey];
        const color = player === 1 ? game.player1Color : game.player2Color;
        const vertices = triangleKey
            .replace('tri-', '')
            .split('-')
            .map((pair) => {
                const [row, col] = pair.split(',').map(Number);
                return { row, col };
            });

        const cellKey = game.gameLogic.getTriangleCellKey(vertices);
        const points = vertices.map((vertex) => ({
            x: game.offsetX + vertex.col * game.cellSize,
            y: game.offsetY + vertex.row * game.cellSize,
        }));
        const centerX = (points[0].x + points[1].x + points[2].x) / 3;
        const centerY = (points[0].y + points[1].y + points[2].y) / 3;
        const animation = game.squareAnimations.find(
            (item) => item.type === 'triangle' && item.key === triangleKey
        );

        game.ctx.save();

        if (animation) {
            const age = now - animation.startTime;
            const progress = age / animation.duration;
            const easeProgress = easeOutQuad(progress);
            const scale = 0.3 + easeProgress * 0.7;
            const alpha = Math.min(progress * 2, 1);
            const glowIntensity = Math.sin(progress * Math.PI) * 0.5;

            game.ctx.shadowColor = color;
            game.ctx.shadowBlur = 20 * glowIntensity;
            game.ctx.translate(centerX, centerY);
            game.ctx.scale(scale, scale);
            game.ctx.translate(-centerX, -centerY);
            game.ctx.fillStyle =
                color +
                Math.floor(alpha * 0.35 * 255)
                    .toString(16)
                    .padStart(2, '0');
        } else {
            game.ctx.fillStyle = color + '50';
        }

        game.ctx.beginPath();
        game.ctx.moveTo(points[0].x, points[0].y);
        game.ctx.lineTo(points[1].x, points[1].y);
        game.ctx.lineTo(points[2].x, points[2].y);
        game.ctx.closePath();
        game.ctx.fill();

        game.ctx.strokeStyle = color + '40';
        game.ctx.lineWidth = 1;
        game.ctx.clip();

        const minX = Math.min(points[0].x, points[1].x, points[2].x);
        const maxX = Math.max(points[0].x, points[1].x, points[2].x);
        const minY = Math.min(points[0].y, points[1].y, points[2].y);
        const maxY = Math.max(points[0].y, points[1].y, points[2].y);

        for (let position = minX - (maxY - minY); position < maxX + (maxY - minY); position += 4) {
            game.ctx.beginPath();
            game.ctx.moveTo(position, minY);
            game.ctx.lineTo(position + (maxY - minY), maxY);
            game.ctx.stroke();
        }

        game.ctx.restore();
        game.ctx.shadowBlur = 0;
        game.ctx.fillStyle = color;
        game.ctx.font = `bold ${game.cellSize * 0.3}px Arial`;
        game.ctx.textAlign = 'center';
        game.ctx.textBaseline = 'middle';
        game.ctx.fillText('▲', centerX, centerY);

        if (
            game.partyModeEnabled &&
            game.tileEffects[cellKey] &&
            !effectIndicatorsDrawn.has(cellKey)
        ) {
            const { row, col } = game.gameLogic.parseSquareKey(cellKey);
            drawTileEffectIndicator(
                game,
                cellKey,
                game.offsetX + col * game.cellSize,
                game.offsetY + row * game.cellSize,
                player
            );
            effectIndicatorsDrawn.add(cellKey);
        }
    }
}

export function drawTileEffectIndicator(game, squareKey, x, y) {
    const effectData = game.tileEffects[squareKey];
    if (!effectData) return;

    const { effect } = effectData;
    const isRevealed = game.revealedEffects.has(squareKey);
    const isActivated = game.activatedEffects.has(squareKey);
    game.effectShimmer = (game.effectShimmer + 0.05) % (Math.PI * 2);

    if (!isRevealed) {
        const shimmerAlpha = 0.3 + Math.sin(game.effectShimmer + x * 0.1) * 0.2;
        const shimmerColor = effectData.type === 'trap' ? '#FF6B6B' : '#6BCB77';

        game.ctx.save();
        game.ctx.shadowColor = shimmerColor;
        game.ctx.shadowBlur = 8 + Math.sin(game.effectShimmer) * 4;
        game.ctx.fillStyle =
            shimmerColor +
            Math.floor(shimmerAlpha * 80)
                .toString(16)
                .padStart(2, '0');
        game.ctx.beginPath();
        game.ctx.arc(
            x + game.cellSize / 2,
            y + game.cellSize / 2,
            game.cellSize * 0.15,
            0,
            Math.PI * 2
        );
        game.ctx.fill();
        game.ctx.restore();

        game.ctx.font = `bold ${game.cellSize * 0.3}px Arial`;
        game.ctx.fillStyle = shimmerColor;
        game.ctx.textAlign = 'center';
        game.ctx.textBaseline = 'middle';
        game.ctx.fillText('?', x + game.cellSize / 2, y + game.cellSize * 0.3);
        return;
    }

    if (!isActivated) {
        const pulseScale = 1 + Math.sin(game.effectShimmer * 2) * 0.1;

        game.ctx.save();
        game.ctx.shadowColor = effect.color;
        game.ctx.shadowBlur = 15;
        game.ctx.fillStyle = effect.color + '40';
        game.ctx.beginPath();
        game.ctx.arc(
            x + game.cellSize / 2,
            y + game.cellSize * 0.7,
            game.cellSize * 0.25 * pulseScale,
            0,
            Math.PI * 2
        );
        game.ctx.fill();
        game.ctx.font = `${game.cellSize * 0.35 * pulseScale}px Arial`;
        game.ctx.textAlign = 'center';
        game.ctx.textBaseline = 'middle';
        game.ctx.fillText(effect.icon, x + game.cellSize / 2, y + game.cellSize * 0.7);
        game.ctx.font = `${game.cellSize * 0.12}px Arial`;
        game.ctx.fillStyle = effect.color;
        game.ctx.fillText('TAP', x + game.cellSize / 2, y + game.cellSize * 0.9);
        game.ctx.restore();
        return;
    }

    game.ctx.globalAlpha = 0.4;
    game.ctx.font = `${game.cellSize * 0.25}px Arial`;
    game.ctx.textAlign = 'center';
    game.ctx.textBaseline = 'middle';
    game.ctx.fillText(effect.icon, x + game.cellSize / 2, y + game.cellSize * 0.75);
    game.ctx.globalAlpha = 1;
}

export function drawHiddenEffectShimmers(game) {
    if (!game.oracleVisionActive) return;

    for (const squareKey in game.tileEffects) {
        if (game.squares[squareKey] || game.revealedEffects.has(squareKey)) continue;

        const effectData = game.tileEffects[squareKey];
        const { effect } = effectData;
        const { row, col } = game.gameLogic.parseSquareKey(squareKey);
        const x = game.offsetX + col * game.cellSize;
        const y = game.offsetY + row * game.cellSize;
        const pulseAlpha = 0.4 + Math.sin(game.effectShimmer) * 0.2;

        game.ctx.save();
        game.ctx.globalAlpha = pulseAlpha;
        game.ctx.shadowColor = effect.color;
        game.ctx.shadowBlur = 10;
        game.ctx.fillStyle = effect.color + '30';
        game.ctx.fillRect(x, y, game.cellSize, game.cellSize);
        game.ctx.font = `${game.cellSize * 0.4}px Arial`;
        game.ctx.textAlign = 'center';
        game.ctx.textBaseline = 'middle';
        game.ctx.fillText(effect.icon, x + game.cellSize / 2, y + game.cellSize / 2);
        game.ctx.restore();
    }
}
