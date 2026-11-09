/**
 * HomePager - Handles sideways sliding of the home screen menu layer
 *
 * Positions:
 * - -1: Left side screen (buttonless, sprites only)
 * -  0: Center screen (ShapeKeeper home menu)
 * - +1: Right side screen (buttonless, sprites only)
 *
 * @module ui/home/HomePager
 */

export function resolveSwipe({ dx, dy, dtMs, currentPosition, width }) {
    if (!width || width <= 0) return currentPosition;

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Must be predominantly horizontal
    if (absDx < 1.4 * absDy) {
        return currentPosition;
    }

    const velocity = dtMs > 0 ? absDx / dtMs : 0;
    const distanceRatio = absDx / width;

    let delta = 0;
    if (distanceRatio > 0.2 || velocity > 0.45) {
        // Dragging left (negative dx) moves toward +1 (right screen)
        // Dragging right (positive dx) moves toward -1 (left screen)
        delta = dx < 0 ? 1 : -1;
    }

    const newPos = Math.max(-1, Math.min(1, currentPosition + delta));
    return newPos;
}

/** Pointer travel (px) before a press is judged to be a swipe or a scroll. */
export const DRAG_DEAD_ZONE_PX = 8;
/** Fraction of finger travel the layer follows once past the first/last page. */
export const RUBBER_BAND_FACTOR = 0.35;

/**
 * Rubber-band the layer at the ends. Valid offsets run from -width (page +1)
 * to +width (page -1); dragging beyond that still moves, but with growing
 * resistance, which tells the finger "no more pages" without a dead stop.
 */
export function applyRubberBand(offsetPx, width) {
    if (!width || width <= 0) return offsetPx;
    if (offsetPx > width) return width + (offsetPx - width) * RUBBER_BAND_FACTOR;
    if (offsetPx < -width) return -width + (offsetPx + width) * RUBBER_BAND_FACTOR;
    return offsetPx;
}

export class HomePager {
    constructor(menuLayerEl, options = {}) {
        this.menuLayer = menuLayerEl || document.getElementById('homeMenuLayer');
        this.container = options.container || document.getElementById('mainMenuScreen');
        this.position = 0; // -1, 0, or 1
        this.isDragging = false;
        this.axisLocked = false;
        this.startX = 0;
        this.startY = 0;
        this.startTime = 0;
        this.currentDx = 0;
        this.currentDy = 0;
        this.onPageChange = options.onPageChange || null;
        this.isSpriteTouchedFn = options.isSpriteTouchedFn || (() => false);

        this.boundPointerDown = this.handlePointerDown.bind(this);
        this.boundPointerMove = this.handlePointerMove.bind(this);
        this.boundPointerUp = this.handlePointerUp.bind(this);
        this.boundKeyDown = this.handleKeyDown.bind(this);

        this.attach();
    }

    attach() {
        if (!this.container) return;
        this.container.addEventListener('pointerdown', this.boundPointerDown, { passive: false });
        window.addEventListener('pointermove', this.boundPointerMove, { passive: false });
        window.addEventListener('pointerup', this.boundPointerUp);
        window.addEventListener('pointercancel', this.boundPointerUp);
        window.addEventListener('keydown', this.boundKeyDown);
        this.updateLayerTransform(false);
    }

    handlePointerDown(e) {
        // Only active when mainMenuScreen is active
        if (!this.container || this.container.getAttribute('aria-hidden') === 'true') return;
        if (this.container.hidden) return;

        // If pointer is clicking an interactive button/input on the home menu, don't drag
        if (
            e.target &&
            (e.target.closest('button') || e.target.closest('a') || e.target.closest('input'))
        ) {
            return;
        }

        // If pointer clicked directly on a sprite and we are dragging a sprite, allow sprite handling
        if (this.isSpriteTouchedFn(e.clientX, e.clientY)) {
            return;
        }

        this.isDragging = true;
        this.axisLocked = false;
        this.startX = e.clientX;
        this.startY = e.clientY;
        this.startTime = performance.now();
        this.currentDx = 0;
        this.currentDy = 0;

        if (this.menuLayer) {
            this.menuLayer.style.transition = 'none';
        }
    }

    handlePointerMove(e) {
        if (!this.isDragging) return;

        this.currentDx = e.clientX - this.startX;
        this.currentDy = e.clientY - this.startY;

        // Decide the gesture's axis once, after a small dead zone. A vertical
        // drag is not ours: hand it back instead of wobbling the menu sideways.
        if (!this.axisLocked) {
            if (Math.hypot(this.currentDx, this.currentDy) < DRAG_DEAD_ZONE_PX) return;
            if (Math.abs(this.currentDx) < 1.4 * Math.abs(this.currentDy)) {
                this.isDragging = false;
                this.currentDx = 0;
                this.currentDy = 0;
                this.updateLayerTransform(true);
                return;
            }
            this.axisLocked = true;
        }

        const width = window.innerWidth || 800;
        const baseOffset = -this.position * width;
        const totalOffset = applyRubberBand(baseOffset + this.currentDx, width);

        if (this.menuLayer) {
            this.menuLayer.style.transform = `translateX(${totalOffset}px)`;
        }
    }

    handlePointerUp(e) {
        if (!this.isDragging) return;
        this.isDragging = false;

        // A cancelled pointer (browser took over the gesture) must not turn a
        // half-finished drag into a page change: spring back where we were.
        if (e && e.type === 'pointercancel') {
            this.goTo(this.position, true);
            return;
        }

        const dtMs = performance.now() - this.startTime;
        const width = window.innerWidth || 800;

        const newPos = resolveSwipe({
            dx: this.currentDx,
            dy: this.currentDy,
            dtMs,
            currentPosition: this.position,
            width,
        });

        this.goTo(newPos, true);
    }

    handleKeyDown(e) {
        if (!this.container || this.container.getAttribute('aria-hidden') === 'true') return;
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;

        if (e.key === 'ArrowLeft') {
            this.goTo(Math.max(-1, this.position - 1), true);
        } else if (e.key === 'ArrowRight') {
            this.goTo(Math.min(1, this.position + 1), true);
        }
    }

    goTo(targetPosition, smooth = true) {
        const clamped = Math.max(-1, Math.min(1, targetPosition));
        const changed = clamped !== this.position;
        this.position = clamped;

        this.updateLayerTransform(smooth);

        if (changed && typeof this.onPageChange === 'function') {
            this.onPageChange(this.position);
        }
    }

    updateLayerTransform(smooth = true) {
        if (!this.menuLayer) return;

        this.menuLayer.style.transition = smooth
            ? 'transform 380ms cubic-bezier(0.16, 1, 0.3, 1)'
            : 'none';
        // -1 position -> menu moves right (+100vw), showing blank screen on left
        // +1 position -> menu moves left (-100vw), showing blank screen on right
        const offsetPercent = -this.position * 100;
        this.menuLayer.style.transform = `translateX(${offsetPercent}vw)`;

        // When on side screens, make menu container inert
        const menuContainer = this.menuLayer.querySelector('.welcome-container');
        if (menuContainer) {
            if (this.position !== 0) {
                menuContainer.setAttribute('inert', '');
                menuContainer.setAttribute('aria-hidden', 'true');
            } else {
                menuContainer.removeAttribute('inert');
                menuContainer.setAttribute('aria-hidden', 'false');
            }
        }
    }

    reset() {
        this.goTo(0, false);
    }

    destroy() {
        if (this.container) {
            this.container.removeEventListener('pointerdown', this.boundPointerDown);
        }
        window.removeEventListener('pointermove', this.boundPointerMove);
        window.removeEventListener('pointerup', this.boundPointerUp);
        window.removeEventListener('pointercancel', this.boundPointerUp);
        window.removeEventListener('keydown', this.boundKeyDown);
    }
}
