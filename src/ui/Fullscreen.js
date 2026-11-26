/**
 * Fullscreen utilities for ShapeKeeper
 * @module ui/Fullscreen
 */

/**
 * Request fullscreen mode
 */
export function requestFullscreen() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {
            // Fullscreen not supported or denied
        });
    } else if (elem.webkitRequestFullscreen) {
        // Safari
        elem.webkitRequestFullscreen();
    }
}

/**
 * Exit fullscreen mode
 */
export function exitFullscreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
    } else if (document.webkitExitFullscreen) {
        // Safari
        document.webkitExitFullscreen();
    }
}
