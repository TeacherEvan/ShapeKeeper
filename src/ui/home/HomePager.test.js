import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomePager, resolveSwipe } from './HomePager.js';

describe('resolveSwipe', () => {
    it('returns currentPosition when width is non-positive or missing', () => {
        expect(resolveSwipe({ dx: 100, dy: 0, dtMs: 100, currentPosition: 0, width: 0 })).toBe(0);
        expect(resolveSwipe({ dx: 100, dy: 0, dtMs: 100, currentPosition: 0, width: -50 })).toBe(0);
    });

    it('ignores vertical drags where absDx < 1.4 * absDy', () => {
        const result = resolveSwipe({
            dx: 50,
            dy: 50,
            dtMs: 100,
            currentPosition: 0,
            width: 500,
        });
        expect(result).toBe(0);
    });

    it('moves right (to +1) on leftward drag exceeding distance threshold', () => {
        const result = resolveSwipe({
            dx: -150,
            dy: 10,
            dtMs: 1000,
            currentPosition: 0,
            width: 500, // 150/500 = 0.3 > 0.2
        });
        expect(result).toBe(1);
    });

    it('moves left (to -1) on rightward drag exceeding distance threshold', () => {
        const result = resolveSwipe({
            dx: 150,
            dy: 10,
            dtMs: 1000,
            currentPosition: 0,
            width: 500,
        });
        expect(result).toBe(-1);
    });

    it('moves on fast flick even if distance is small', () => {
        const result = resolveSwipe({
            dx: -60,
            dy: 5,
            dtMs: 80, // 60/80 = 0.75 px/ms > 0.45
            currentPosition: 0,
            width: 1000,
        });
        expect(result).toBe(1);
    });

    it('clamps at boundaries -1 and +1', () => {
        expect(
            resolveSwipe({
                dx: -300,
                dy: 0,
                dtMs: 200,
                currentPosition: 1,
                width: 500,
            })
        ).toBe(1);

        expect(
            resolveSwipe({
                dx: 300,
                dy: 0,
                dtMs: 200,
                currentPosition: -1,
                width: 500,
            })
        ).toBe(-1);
    });
});

describe('HomePager', () => {
    let container;
    let menuLayer;
    let welcomeContainer;

    beforeEach(() => {
        container = document.createElement('section');
        container.id = 'mainMenuScreen';
        container.setAttribute('aria-hidden', 'false');

        menuLayer = document.createElement('div');
        menuLayer.id = 'homeMenuLayer';

        welcomeContainer = document.createElement('div');
        welcomeContainer.className = 'welcome-container';
        const button = document.createElement('button');
        button.id = 'localPlayBtn';
        welcomeContainer.appendChild(button);

        menuLayer.appendChild(welcomeContainer);
        container.appendChild(menuLayer);
        document.body.appendChild(container);
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('initializes at position 0 with welcome-container accessible', () => {
        const pager = new HomePager(menuLayer, { container });
        expect(pager.position).toBe(0);
        expect(welcomeContainer.hasAttribute('inert')).toBe(false);
        expect(welcomeContainer.getAttribute('aria-hidden')).toBe('false');
        pager.destroy();
    });

    it('goTo(1) slides menu layer to the left and makes welcome container inert', () => {
        const onPageChange = vi.fn();
        const pager = new HomePager(menuLayer, { container, onPageChange });

        pager.goTo(1);
        expect(pager.position).toBe(1);
        expect(menuLayer.style.transform).toBe('translateX(-100vw)');
        expect(welcomeContainer.hasAttribute('inert')).toBe(true);
        expect(welcomeContainer.getAttribute('aria-hidden')).toBe('true');
        expect(onPageChange).toHaveBeenCalledWith(1);
        pager.destroy();
    });

    it('goTo(-1) slides menu layer to the right and makes welcome container inert', () => {
        const pager = new HomePager(menuLayer, { container });

        pager.goTo(-1);
        expect(pager.position).toBe(-1);
        expect(menuLayer.style.transform).toBe('translateX(100vw)');
        expect(welcomeContainer.hasAttribute('inert')).toBe(true);
        expect(welcomeContainer.getAttribute('aria-hidden')).toBe('true');
        pager.destroy();
    });

    it('reset() returns to position 0 without animation', () => {
        const pager = new HomePager(menuLayer, { container });
        pager.goTo(1);
        expect(pager.position).toBe(1);

        pager.reset();
        expect(pager.position).toBe(0);
        expect(menuLayer.style.transform).toBe('translateX(0vw)');
        expect(welcomeContainer.hasAttribute('inert')).toBe(false);
        pager.destroy();
    });

    it('navigates with ArrowLeft and ArrowRight keys', () => {
        const pager = new HomePager(menuLayer, { container });

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        expect(pager.position).toBe(1);

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        expect(pager.position).toBe(0);

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        expect(pager.position).toBe(-1);
        pager.destroy();
    });

    it('does not start dragging when isSpriteTouchedFn returns true', () => {
        const isSpriteTouchedFn = vi.fn().mockReturnValue(true);
        const pager = new HomePager(menuLayer, { container, isSpriteTouchedFn });

        container.dispatchEvent(
            new MouseEvent('pointerdown', {
                clientX: 200,
                clientY: 200,
                bubbles: true,
            })
        );

        expect(pager.isDragging).toBe(false);
        expect(isSpriteTouchedFn).toHaveBeenCalledWith(200, 200);
        pager.destroy();
    });

    it('does not start dragging when clicking on a button', () => {
        const pager = new HomePager(menuLayer, { container });
        const button = welcomeContainer.querySelector('#localPlayBtn');

        button.dispatchEvent(
            new MouseEvent('pointerdown', {
                clientX: 100,
                clientY: 100,
                bubbles: true,
            })
        );

        expect(pager.isDragging).toBe(false);
        pager.destroy();
    });
});
