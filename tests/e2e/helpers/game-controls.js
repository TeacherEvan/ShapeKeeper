/**
 * Helper for the in-game controls panel.
 *
 * The panel is hidden by default and requires a double-tap on the toggle
 * button to open (UX guard against accidental triggers during gameplay).
 * In tests we open it once with `openGameControls(page)` so subsequent
 * `page.locator('#undoBtn').click()` (etc.) calls don't fail because the
 * button is hidden.
 */
export async function openGameControls(page) {
    // Idempotent: if the panel is already open (e.g. a previous test left it
    // that way), do nothing. Otherwise double-tap the toggle to open it.
    const panel = page.locator('#gameControlsPanel');
    if (await panel.isVisible().catch(() => false)) return;
    const toggle = page.locator('#gameControlsToggleBtn');
    // Two clicks within the 500ms window -> opens the panel. Using dblclick
    // (not two separate .click() calls) so the interval is well under the
    // window even on a slow CI runner.
    await toggle.dblclick();
    await panel.waitFor({ state: 'visible' });
}

export async function closeGameControls(page) {
    const panel = page.locator('#gameControlsPanel');
    if (!(await panel.isVisible().catch(() => false))) return;
    const toggle = page.locator('#gameControlsToggleBtn');
    // Closing is a single tap once the panel is open.
    await toggle.click();
    await panel.waitFor({ state: 'hidden' });
}
