/**
 * Screen-specific event binding helpers for the menu runtime.
 *
 * The monolithic `bindMenuEventHandlers` has been decomposed into three
 * domain controller modules (see src/ui/menu/):
 *   - localSetupEvents.js   local game setup (AI, timer, grid, start/load)
 *   - lobbyEvents.js        room create/join, open-lobby browser, invites
 *   - sessionEvents.js      session lifecycle (start/leave/exit/rematch)
 *
 * This file remains the single composition entry point imported by
 * MenuNavigation.js, preserving the public `bindMenuEventHandlers(deps)` API.
 */

import { toggleTheme } from '../ThemeManager.js';

import { bindLocalSetupEvents } from './localSetupEvents.js';
import { bindLobbyEvents } from './lobbyEvents.js';
import { bindSessionEvents } from './sessionEvents.js';

export function bindMenuEventHandlers(deps) {
    // Generic main-menu wiring (not owned by any single domain module).
    document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);

    // Domain controllers.
    bindLocalSetupEvents(deps);
    bindLobbyEvents(deps);
    bindSessionEvents(deps);
}
