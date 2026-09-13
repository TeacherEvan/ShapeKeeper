/**
 * Tests for the double-tap-to-open game controls panel state machine.
 *
 * The toggle is a UX guard: a single tap should NOT open the panel because
 * users can accidentally brush the toggle during gameplay. Two taps within
 * a short window open it. Closing is one tap (no double-tap to close) so
 * getting back to gameplay is friction-free.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createGameControlsPanel } from './GameControlsPanel.js';

describe('GameControlsPanel — initial state', () => {
    it('starts closed', () => {
        const panel = createGameControlsPanel({});
        expect(panel.isOpen()).toBe(false);
    });
});

describe('GameControlsPanel — open via double-tap', () => {
    let panel;
    let now;
    beforeEach(() => {
        now = 0;
        panel = createGameControlsPanel({ now: () => now });
    });

    it('a single tap does NOT open the panel', () => {
        panel.tap();
        expect(panel.isOpen()).toBe(false);
        expect(panel.isPrimed()).toBe(true);
    });

    it('two taps within the window open the panel', () => {
        panel.tap();
        now = 200;
        panel.tap();
        expect(panel.isOpen()).toBe(true);
        expect(panel.isPrimed()).toBe(false);
    });

    it('two taps spaced too far apart do NOT open the panel', () => {
        panel.tap();
        now = 800; // default window is 500ms
        panel.tap();
        expect(panel.isOpen()).toBe(false);
    });

    it('after the window expires, the next single tap re-primes (does not open)', () => {
        panel.tap();
        now = 800;
        panel.tap(); // not within window
        expect(panel.isOpen()).toBe(false);
        expect(panel.isPrimed()).toBe(true); // new tap is now the primed tap
    });
});

describe('GameControlsPanel — close', () => {
    it('a single tap closes an open panel', () => {
        const now = vi.fn(() => 0);
        const panel = createGameControlsPanel({ now });
        panel.tap();
        panel.tap(); // open
        expect(panel.isOpen()).toBe(true);
        panel.tap(); // close (single tap, no double-tap required)
        expect(panel.isOpen()).toBe(false);
    });

    it('closing an already-closed panel is a no-op (idempotent)', () => {
        const panel = createGameControlsPanel({});
        panel.close();
        expect(panel.isOpen()).toBe(false);
    });
});

describe('GameControlsPanel — onChange callback', () => {
    it('fires on open', () => {
        const onChange = vi.fn();
        const now = () => 0;
        const panel = createGameControlsPanel({ now, onChange });
        panel.tap();
        panel.tap();
        expect(onChange).toHaveBeenCalledWith({ isOpen: true });
    });

    it('fires on close', () => {
        const onChange = vi.fn();
        const now = () => 0;
        const panel = createGameControlsPanel({ now, onChange });
        panel.tap();
        panel.tap(); // open
        panel.tap(); // close
        expect(onChange).toHaveBeenLastCalledWith({ isOpen: false });
    });

    it('does NOT fire on a primed-but-not-opened tap (no state change)', () => {
        const onChange = vi.fn();
        const now = () => 0;
        const panel = createGameControlsPanel({ now, onChange });
        panel.tap();
        expect(onChange).not.toHaveBeenCalled();
    });
});

describe('GameControlsPanel — custom window', () => {
    it('respects a custom double-tap window', () => {
        let now = 0;
        const panel = createGameControlsPanel({ now: () => now, windowMs: 1000 });
        panel.tap();
        now = 900;
        panel.tap(); // within 1000ms
        expect(panel.isOpen()).toBe(true);
    });
});
