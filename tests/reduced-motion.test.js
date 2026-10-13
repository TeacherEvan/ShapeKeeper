// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prefersReducedMotion } from '../utils.js';
import { launchConfetti, launchFireworks } from '../ui-manager/celebrations.js';

describe('Accessibility: prefers-reduced-motion', () => {
    let originalMatchMedia;

    beforeEach(() => {
        originalMatchMedia = window.matchMedia;
        document.body.innerHTML = '';
    });

    afterEach(() => {
        window.matchMedia = originalMatchMedia;
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('returns true when media query matches reduce', () => {
        window.matchMedia = vi.fn().mockImplementation((query) => ({
            matches: query === '(prefers-reduced-motion: reduce)',
            media: query,
        }));

        expect(prefersReducedMotion()).toBe(true);
    });

    it('returns false when media query does not match', () => {
        window.matchMedia = vi.fn().mockImplementation((query) => ({
            matches: false,
            media: query,
        }));

        expect(prefersReducedMotion()).toBe(false);
    });

    it('suppresses confetti and fireworks when reduced motion is preferred', () => {
        window.matchMedia = vi.fn().mockImplementation(() => ({
            matches: true,
        }));

        launchConfetti('#4caf50');
        expect(document.getElementById('confettiCanvas')).toBeNull();

        launchFireworks('#4caf50');
        expect(document.getElementById('fireworksCanvas')).toBeNull();
        expect(document.body.children.length).toBe(0);
    });

    it('launches confetti and fireworks when reduced motion is not preferred', () => {
        window.matchMedia = vi.fn().mockImplementation(() => ({
            matches: false,
        }));

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
            createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
        }));
        HTMLCanvasElement.prototype.getContext = getContextMock;

        launchConfetti('#4caf50');
        expect(document.getElementById('confettiCanvas')).not.toBeNull();

        launchFireworks('#4caf50');
        expect(document.getElementById('fireworksCanvas')).not.toBeNull();
    });
});
