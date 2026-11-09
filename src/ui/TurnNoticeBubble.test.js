import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    AI_PENALTY_QUIPS,
    TIMEOUT_QUIPS,
    TurnNoticeBubble,
    getNextRandomQuip,
} from './TurnNoticeBubble.js';

describe('TurnNoticeBubble', () => {
    let container;

    beforeEach(() => {
        vi.useFakeTimers();
        container = document.createElement('div');
        container.id = 'gameScreen';
        document.body.appendChild(container);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
        container.remove();
    });

    it('never repeats the same quip consecutively when alternatives exist', () => {
        let last = null;
        for (let i = 0; i < 20; i++) {
            const next = getNextRandomQuip(AI_PENALTY_QUIPS, last);
            expect(next).not.toBe(last);
            expect(AI_PENALTY_QUIPS).toContain(next);
            last = next;
        }

        last = null;
        for (let i = 0; i < 20; i++) {
            const next = getNextRandomQuip(TIMEOUT_QUIPS, last);
            expect(next).not.toBe(last);
            expect(TIMEOUT_QUIPS).toContain(next);
            last = next;
        }
    });

    it('renders ai-penalty speech bubble and automatically hides after 3 seconds', () => {
        const bubble = new TurnNoticeBubble(container);
        bubble.show('ai-penalty');

        const el = container.querySelector('#turnNoticeBubble');
        expect(el).not.toBeNull();
        expect(el.classList.contains('ai-penalty')).toBe(true);
        expect(el.classList.contains('active')).toBe(true);
        expect(el.innerHTML).toContain('🤖');

        // Fast-forward 2999ms: still active
        vi.advanceTimersByTime(2999);
        expect(el.classList.contains('active')).toBe(true);

        // Fast-forward to 3000ms: class removed
        vi.advanceTimersByTime(1);
        expect(el.classList.contains('active')).toBe(false);

        bubble.destroy();
        expect(container.querySelector('#turnNoticeBubble')).toBeNull();
    });

    it('renders timeout speech bubble with clock avatar', () => {
        const bubble = new TurnNoticeBubble(container);
        bubble.show('timeout');

        const el = container.querySelector('#turnNoticeBubble');
        expect(el).not.toBeNull();
        expect(el.classList.contains('timeout')).toBe(true);
        expect(el.classList.contains('active')).toBe(true);
        expect(el.innerHTML).toContain('⏰');

        bubble.destroy();
    });
});
