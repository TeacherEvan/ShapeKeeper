import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DisposableRegistry } from '../src/lifecycle/DisposableRegistry.js';
import { DotsAndBoxesGame } from '../dots-and-boxes-game.js';

describe('DisposableRegistry', () => {
    let registry;

    beforeEach(() => {
        vi.useFakeTimers();
        registry = new DisposableRegistry();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('clears registered timeouts upon dispose', () => {
        const spy = vi.fn();
        const timeoutId = setTimeout(spy, 1000);
        registry.addTimeout(timeoutId);

        registry.dispose();
        vi.advanceTimersByTime(2000);

        expect(spy).not.toHaveBeenCalled();
    });

    it('cancels registered animation frames upon dispose', () => {
        const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame');
        const rafId = 12345;
        registry.addRAF(rafId);

        registry.dispose();

        expect(cancelSpy).toHaveBeenCalledWith(rafId);
    });

    it('removes registered event listeners upon dispose', () => {
        const target = document.createElement('div');
        const listener = vi.fn();

        registry.addEventListener(target, 'click', listener);
        target.dispatchEvent(new MouseEvent('click'));
        expect(listener).toHaveBeenCalledTimes(1);

        registry.dispose();
        target.dispatchEvent(new MouseEvent('click'));
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('disposes registered disposable objects with dispose() or destroy()', () => {
        const disposableObj = { dispose: vi.fn() };
        const destroyableObj = { destroy: vi.fn() };

        registry.addDisposable(disposableObj);
        registry.addDisposable(destroyableObj);

        registry.dispose();

        expect(disposableObj.dispose).toHaveBeenCalledTimes(1);
        expect(destroyableObj.destroy).toHaveBeenCalledTimes(1);
    });

    it('executes arbitrary cleanup callbacks upon dispose', () => {
        const cleanup = vi.fn();
        registry.addCleanup(cleanup);

        registry.dispose();

        expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it('is idempotent on multiple dispose() calls', () => {
        const cleanup = vi.fn();
        const disposableObj = { dispose: vi.fn() };
        const target = document.createElement('button');
        const listener = vi.fn();

        registry.addCleanup(cleanup);
        registry.addDisposable(disposableObj);
        registry.addEventListener(target, 'click', listener);

        registry.dispose();
        registry.dispose();

        expect(cleanup).toHaveBeenCalledTimes(1);
        expect(disposableObj.dispose).toHaveBeenCalledTimes(1);
    });
});

describe('DotsAndBoxesGame Lifecycle & Teardown', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <canvas id="gameCanvas" width="800" height="600"></canvas>
            <button id="populateBtn"></button>
            <button id="undoBtn"></button>
            <button id="redoBtn"></button>
            <button id="restartBtn"></button>
            <button id="saveLocalBtn"></button>
            <button id="replayBackBtn"></button>
            <button id="replayForwardBtn"></button>
            <button id="replayRestartBtn"></button>
            <button id="soundToggle"></button>
            <button id="exitGame"></button>
            <div id="playerTurn"></div>
            <div id="player1Score"></div>
            <div id="player2Score"></div>
            <div id="player1Info"></div>
            <div id="player2Info"></div>
            <div id="turnIndicator"></div>
            <div id="gameLoadingSkeleton"></div>
        `;

        window.devicePixelRatio = 1;
        navigator.maxTouchPoints = 0;
        window.matchMedia = vi.fn().mockReturnValue({ matches: false });

        HTMLCanvasElement.prototype.getContext = () => ({
            scale: () => {},
            clearRect: () => {},
            fillRect: () => {},
            beginPath: () => {},
            arc: () => {},
            fill: () => {},
            stroke: () => {},
            moveTo: () => {},
            lineTo: () => {},
            closePath: () => {},
            save: () => {},
            restore: () => {},
            translate: () => {},
            clip: () => {},
            fillText: () => {},
            measureText: () => ({ width: 0 }),
            createRadialGradient: () => ({
                addColorStop: () => {},
            }),
            createLinearGradient: () => ({
                addColorStop: () => {},
            }),
            drawImage: () => {},
            setLineDash: () => {},
        });
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('destroys active timers, animation frame loops, and event listeners cleanly', () => {
        const cancelRafSpy = vi.spyOn(window, 'cancelAnimationFrame');
        const game = new DotsAndBoxesGame(3, '#ff0000', '#0000ff', { localMode: 'pass' });
        expect(game.disposables).toBeInstanceOf(DisposableRegistry);

        game.destroy();

        expect(cancelRafSpy).toHaveBeenCalled();
        expect(game.isDestroyed).toBe(true);
    });

    it('handles multiple game creation and teardown cycles without active leaks', () => {
        const games = [];
        for (let i = 0; i < 5; i++) {
            const game = new DotsAndBoxesGame(3, '#ff0000', '#0000ff', { localMode: 'pass' });
            games.push(game);
        }

        games.forEach((game) => {
            game.destroy();
            expect(game.isDestroyed).toBe(true);
        });
    });
});
