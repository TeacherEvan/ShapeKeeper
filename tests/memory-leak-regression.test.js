import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DisposableRegistry } from '../src/lifecycle/DisposableRegistry.js';

/**
 * Memory Leak Regression Test (MVTH #1)
 *
 * Asserts that repeatedly registering and disposing window event listeners
 * through DisposableRegistry results in zero net growth: every `addEventListener`
 * on `window` is matched by a `removeEventListener` on `window` after dispose.
 *
 * This guards against the listener-leak vector described in P2-02
 * (unremoved global window event listeners). jsdom does not expose a
 * per-target `listenerCount`, so we instrument `window.addEventListener` /
 * `window.removeEventListener` and assert adds == removes across mount/unmount
 * cycles.
 */
describe('Memory Leak Regression — DisposableRegistry window listeners', () => {
    let addSpy;
    let removeSpy;

    beforeEach(() => {
        addSpy = vi.spyOn(window, 'addEventListener');
        removeSpy = vi.spyOn(window, 'removeEventListener');
        addSpy.mockClear();
        removeSpy.mockClear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    function resizeAdds() {
        return addSpy.mock.calls.filter(([type]) => type === 'resize').length;
    }

    function resizeRemoves() {
        return removeSpy.mock.calls.filter(([type]) => type === 'resize').length;
    }

    it('adds then removes the same number of window resize listeners across 50 mount/unmount cycles', () => {
        const cycles = 50;

        for (let i = 0; i < cycles; i++) {
            const registry = new DisposableRegistry();

            // Simulate game-state.js wiring a window resize listener.
            const resizeHandler = () => {};
            registry.addEventListener(window, 'resize', resizeHandler);

            // Simulate screen unmount / game destroy.
            registry.dispose();
        }

        expect(resizeAdds()).toBe(cycles);
        expect(resizeRemoves()).toBe(cycles);
        // Zero net growth: every add is matched by a remove.
        expect(resizeRemoves() - resizeAdds()).toBe(0);
    });

    it('leaves zero residual listeners: every add is matched by a remove after dispose', () => {
        const registry = new DisposableRegistry();
        registry.addEventListener(window, 'resize', () => {});
        registry.addEventListener(window, 'resize', () => {});
        registry.addEventListener(window, 'visibilitychange', () => {});
        registry.dispose();

        expect(resizeAdds()).toBe(2);
        expect(resizeRemoves()).toBe(2);
        expect(resizeRemoves() - resizeAdds()).toBe(0);
    });

    it('is idempotent: disposing twice does not double-remove or throw', () => {
        const registry = new DisposableRegistry();
        registry.addEventListener(window, 'resize', () => {});
        expect(() => registry.dispose()).not.toThrow();
        expect(() => registry.dispose()).not.toThrow();
        expect(resizeAdds()).toBe(1);
        expect(resizeRemoves()).toBe(1);
    });
});
