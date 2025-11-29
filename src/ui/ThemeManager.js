/**
 * ShapeKeeper Theme Manager
 * Handles dark/light theme switching with localStorage persistence
 * @module ui/ThemeManager
 */

const STORAGE_KEY = 'shapekeeper_theme';
const DEFAULT_THEME = 'light';

/**
 * Initialize theme from localStorage or default
 */
export function initializeTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME;
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeButton(savedTheme);
}

/**
 * Toggle between light and dark themes
 */
export function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || DEFAULT_THEME;
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
    updateThemeButton(newTheme);
}

/**
 * Update theme toggle button icon
 * @param {string} theme - Current theme ('light' or 'dark')
 */
export function updateThemeButton(theme) {
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.textContent = theme === 'light' ? '🌙' : '☀️';
    }
}

/**
 * Get current theme
 * @returns {string} Current theme
 */
export function getCurrentTheme() {
    return document.documentElement.getAttribute('data-theme') || DEFAULT_THEME;
}

/**
 * Set specific theme
 * @param {string} theme - 'light' or 'dark'
 */
export function setTheme(theme) {
    if (theme !== 'light' && theme !== 'dark') {
        console.warn('[Theme] Invalid theme:', theme);
        return;
    }
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
    updateThemeButton(theme);
}
