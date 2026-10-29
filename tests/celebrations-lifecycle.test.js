// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    hideGameOverSplash,
    launchConfetti,
    launchFireworks,
    stopCelebrationAnimations,
} from '../ui-manager/celebrations.js';

describe('Celebrations lifecycle and canvas management', () => {
    let cancelAnimSpy;
    let clearIntervalSpy;

    beforeEach(() => {
        document.body.innerHTML = '<div id="gameOverSplashOverlay" hidden></div>';
        cancelAnimSpy = vi.spyOn(window, 'cancelAnimationFrame');
        clearIntervalSpy = vi.spyOn(window, 'clearInterval');

        // Mock canvas context
        const getContextMock = vi.fn(() => ({
            clearRect: vi.fn(),
            save: vi.fn(),
            restore: vi.fn(),
            translate: vi.fn(),
            rotate: vi.fn(),
            fillRect: vi.fn(),
            beginPath: vi.fn(),
            arc: vi.fn(),
            fill: vi.fn(),
        }));
        HTMLCanvasElement.prototype.getContext = getContextMock;
    });

    afterEach(() => {
        stopCelebrationAnimations();
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('removes confetti and fireworks canvases when stopCelebrationAnimations is called', () => {
        launchConfetti('#4caf50');
        launchFireworks('#4caf50');

        expect(document.getElementById('confettiCanvas')).not.toBeNull();
        expect(document.getElementById('fireworksCanvas')).not.toBeNull();

        stopCelebrationAnimations();

        expect(document.getElementById('confettiCanvas')).toBeNull();
        expect(document.getElementById('fireworksCanvas')).toBeNull();
        expect(cancelAnimSpy).toHaveBeenCalled();
        expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('cleans up previous canvas if launchConfetti is called repeatedly', () => {
        launchConfetti('#ff0000');
        expect(document.querySelectorAll('#confettiCanvas').length).toBe(1);

        launchConfetti('#00ff00');
        expect(document.querySelectorAll('#confettiCanvas').length).toBe(1);
    });

    it('cleans up previous canvas and interval if launchFireworks is called repeatedly', () => {
        launchFireworks('#ff0000');
        expect(document.querySelectorAll('#fireworksCanvas').length).toBe(1);

        launchFireworks('#00ff00');
        expect(document.querySelectorAll('#fireworksCanvas').length).toBe(1);
    });

    it('hideGameOverSplash cleans up celebration animations', () => {
        launchConfetti('#ff0000');
        launchFireworks('#ff0000');

        const overlay = document.getElementById('gameOverSplashOverlay');
        overlay.hidden = false;

        hideGameOverSplash();

        expect(overlay.hidden).toBe(true);
        expect(document.getElementById('confettiCanvas')).toBeNull();
        expect(document.getElementById('fireworksCanvas')).toBeNull();
    });
});
