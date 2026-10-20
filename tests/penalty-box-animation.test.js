import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnimationSystem } from '../animation-system.js';
import { DotsAndBoxesGame } from '../dots-and-boxes-game.js';
import { drawPenaltyBoxAnimations } from '../renderer/effects.js';

const CANVAS_MOCK = () => ({
    scale() {},
    clearRect() {},
    fillRect() {},
    strokeRect() {},
    beginPath() {},
    arc() {},
    fill() {},
    stroke() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    clip() {},
    fillText() {},
    measureText: () => ({ width: 0 }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createLinearGradient: () => ({ addColorStop() {} }),
    drawImage() {},
    setLineDash() {},
});

describe('Penalty Box Animation & Sound', () => {
    beforeEach(() => {
        HTMLCanvasElement.prototype.getContext = CANVAS_MOCK;
        document.body.innerHTML = `
            <div id="gameScreen"><canvas id="gameCanvas"></canvas></div>
            <div id="player1Score"></div>
            <div id="player2Score"></div>
            <div id="player1Info"></div>
            <div id="player2Info"></div>
            <div id="turnIndicator"></div>
            <button id="populateBtn"></button>
            <div id="gameLoadingSkeleton"></div>
            <button id="undoBtn"></button>
            <button id="redoBtn"></button>
            <button id="saveLocalBtn"></button>
            <button id="replayBackBtn"></button>
            <button id="replayForwardBtn"></button>
            <button id="replayRestartBtn"></button>
            <button id="soundToggle"></button>
        `;
    });

    it('triggers and prunes penaltyBoxAnimation in AnimationSystem', () => {
        const anim = new AnimationSystem();
        expect(anim.penaltyBoxAnimations).toEqual([]);

        anim.triggerPenaltyBoxAnimation(
            '0,0',
            (key) => {
                const [row, col] = key.split(',').map(Number);
                return { row, col };
            },
            10,
            10,
            50,
            '#ff0000'
        );

        expect(anim.penaltyBoxAnimations.length).toBe(1);
        const entry = anim.penaltyBoxAnimations[0];
        expect(entry.squareKey).toBe('0,0');
        expect(entry.duration).toBe(1400);
        expect(entry.cellSize).toBe(50);
        expect(entry.playerColor).toBe('#ff0000');

        // Not pruned before 1400ms
        anim.updateAnimations(entry.startTime + 500);
        expect(anim.penaltyBoxAnimations.length).toBe(1);

        // Pruned after 1400ms
        anim.updateAnimations(entry.startTime + 1401);
        expect(anim.penaltyBoxAnimations.length).toBe(0);
    });

    it('renders penalty box animations via drawPenaltyBoxAnimations', () => {
        const ctx = {
            save: vi.fn(),
            restore: vi.fn(),
            translate: vi.fn(),
            rotate: vi.fn(),
            scale: vi.fn(),
            fillRect: vi.fn(),
            strokeRect: vi.fn(),
            fillText: vi.fn(),
        };
        const mockGame = {
            ctx,
            penaltyBoxAnimations: [
                {
                    squareKey: '0,0',
                    startTime: Date.now() - 300,
                    duration: 1400,
                    centerX: 100,
                    centerY: 100,
                    cellSize: 60,
                    playerColor: '#0000ff',
                },
            ],
        };

        drawPenaltyBoxAnimations(mockGame);
        expect(ctx.save).toHaveBeenCalled();
        expect(ctx.translate).toHaveBeenCalledWith(100, 100);
        expect(ctx.fillRect).toHaveBeenCalled();
        expect(ctx.strokeRect).toHaveBeenCalled();
        expect(ctx.restore).toHaveBeenCalled();
    });

    it('triggers penalty animation and AI speech bubble when AI completes 0.2x box', async () => {
        const game = new DotsAndBoxesGame({ cols: 3, rows: 3 }, '#ff0000', '#0000ff', {
            localMode: 'ai',
        });
        game.squareMultipliers = {
            '0,0': { type: 'multiplier', value: 0.2 },
        };
        game.scores = { 1: 5, 2: 9 };
        game.currentPlayer = 2; // AI turn

        vi.spyOn(game.animationSystem, 'triggerPenaltyBoxAnimation');
        vi.spyOn(game.soundManager, 'playPenaltySound');
        vi.spyOn(game.turnNoticeBubble, 'show');

        // Pre-draw 3 edges of square 0,0:
        // top: 0,0-0,1, left: 0,0-1,0, right: 0,1-1,1
        game.lines.add('0,0-0,1');
        game.lines.add('0,0-1,0');
        game.lines.add('0,1-1,1');

        // Draw bottom edge: 1,0-1,1 to complete square 0,0
        await game.drawLine({ row: 1, col: 0 }, { row: 1, col: 1 }, { source: 'ai' });

        expect(game.animationSystem.triggerPenaltyBoxAnimation).toHaveBeenCalledWith(
            '0,0',
            expect.any(Function),
            expect.any(Number),
            expect.any(Number),
            expect.any(Number),
            '#0000ff'
        );
        expect(game.soundManager.playPenaltySound).toHaveBeenCalled();
        expect(game.turnNoticeBubble.show).toHaveBeenCalledWith('ai-penalty');
        expect(game.scores[2]).toBe(2); // 10 * 0.2 = 2
    });
});
