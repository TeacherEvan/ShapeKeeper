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
    } else if (elem.msRequestFullscreen) {
        // IE11
        elem.msRequestFullscreen();
    } else if (elem.mozRequestFullScreen) {
        // Firefox
        elem.mozRequestFullScreen();
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
    } else if (document.msExitFullscreen) {
        // IE11
        document.msExitFullscreen();
    } else if (document.mozCancelFullScreen) {
        // Firefox
        document.mozCancelFullScreen();
    }
}