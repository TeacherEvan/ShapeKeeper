# Dogfood QA Report

**Target:** https://shapekeeper.vercel.app (primary) + http://localhost:8888 (local fallback)
**Date:** 2026-09-20
**Scope:** Full site — landing, navigation, lobby, local play, multiplayer, game screen, interactive elements, console errors
**Tester:** Hermes Agent (automated exploratory QA)
**Output:** docs/Dogfood/screenshots/ + docs/Dogfood/report.md

---

## Executive Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 1 |
| 🟠 High | 0 |
| 🟡 Medium | 1 |
| 🔵 Low | 0 |
| **Total** | **2** |

**Overall Assessment:** The deployed production URL (https://shapekeeper.vercel.app) is completely unreachable (404 for all tested paths), making the application unusable for end users. The local build works correctly with no critical functional or console errors.

---

## Issues

### Issue #1: Deployed Production Site Returns 404

| Field | Value |
|-------|-------|
| **Severity** | Critical |
| **Category** | Functional |
| **URL** | https://shapekeeper.vercel.app/ |

**Description:**
The deployed Vercel instance at https://shapekeeper.vercel.app returns a 404 "NOT_FOUND" page for the root path (`/`) and all tested sub-paths (`/index.html`, `/lobby`, `/game`). The 404 page states: "This page doesn't exist. It may have been moved, removed, or never existed. Go back. 404 DEPLOYMENT_NOT_FOUND." This indicates the Vercel deployment either failed, was removed, or the domain is not properly mapped to the current build.

**Steps to Reproduce:**
1. Navigate to https://shapekeeper.vercel.app/
2. Observe 404 "NOT_FOUND" response
3. Test additional paths: `/index.html`, `/lobby`, `/game`
4. All return the same 404

**Expected Behavior:**
The deployed URL should serve the ShapeKeeper landing page (`index.html`) and all application routes, allowing users to access local play, lobby creation, and multiplayer features.

**Actual Behavior:**
Every request to the deployed domain returns a Vercel 404 page with status message `404 DEPLOYMENT_NOT_FOUND`. The application is entirely inaccessible to users via the public URL.

**Screenshot:**
MEDIA:docs/Dogfood/screenshots/01-landing-404.png
MEDIA:docs/Dogfood/screenshots/11-deployed-404-analysis.png

**Console Errors** (if applicable):
No browser console errors — the 404 is a server-level deployment failure, not a client-side JS error. The response is a static Vercel error page.

---

### Issue #2: Local Site Functional but Requires Manual Server Startup

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Category** | UX |
| **URL** | http://localhost:8888/ (local server) |

**Description:**
The local version of ShapeKeeper (`index.html` served via Python HTTP server on localhost:8888) loads correctly and all core flows (main menu, local play setup, lobby creation, join screen, game screen, theme toggle, exit) work without errors. However, the primary target URL provided (`https://shapekeeper.vercel.app`) is broken, meaning users cannot access the application without manually running a local server. This creates a significant accessibility/availability gap.

**Steps to Reproduce:**
1. Start local server (`python3 -m http.server 8888`)
2. Navigate to http://localhost:8888/
3. Click "START GAME" → local setup loads correctly
4. Select grid size (5x5) → button activates
5. Click "Start Game" → game screen renders
6. Click "CREATE LOBBY" → lobby created with room code `WBCJRY`
7. Click theme toggle → theme changes without errors
8. Click "Exit" → returns to main menu

**Expected Behavior:**
The deployed public URL should be the primary access point, allowing users to play the game without setting up a local development environment.

**Actual Behavior:**
Only localhost works. The deployed site is down. The application requires manual server startup for any interaction.

**Screenshot:**
MEDIA:docs/Dogfood/screenshots/02-local-landing.png
MEDIA:docs/Dogfood/screenshots/03-local-landing-viewport.png
MEDIA:docs/Dogfood/screenshots/04-local-setup.png
MEDIA:docs/Dogfood/screenshots/05-local-setup-full.png
MEDIA:docs/Dogfood/screenshots/06-create-lobby.png
MEDIA:docs/Dogfood/screenshots/07-join-screen.png
MEDIA:docs/Dogfood/screenshots/08-local-game-start.png
MEDIA:docs/Dogfood/screenshots/09-theme-toggled.png
MEDIA:docs/Dogfood/screenshots/10-full-flow-corrected.png

**Console Errors** (if applicable):
No uncaught exceptions, no unhandled promise rejections, no 4xx/5xx network errors in console during local testing. Console shows expected Convex initialization logs (`Connection state: disconnected → connecting → connected`) and subscription messages. Zero errors, zero warnings across all tested flows.

---

## Issues Summary Table

| # | Title | Severity | Category | URL |
|---|-------|----------|----------|-----|
| 1 | Deployed production site returns 404 for all paths | Critical | Functional | https://shapekeeper.vercel.app/ |
| 2 | Application only accessible via manual local server | Medium | UX | http://localhost:8888/ |

---

## Testing Coverage

### Pages Tested
- https://shapekeeper.vercel.app/ (primary — 404)
- https://shapekeeper.vercel.app/index.html (404)
- https://shapekeeper.vercel.app/lobby (404)
- https://shapekeeper.vercel.app/game (404)
- http://localhost:8888/ (local landing — works)
- Local Play Setup (`/` → `#localPlayBtn` → `#localSetupScreen`)
- Lobby / Multiplayer (`/` → `#createGameBtn` → `#lobbyScreen`)
- Join Screen (`/` → `#joinGameBtn` → `#joinScreen`)
- Game Screen (local play with 5x5 grid)
- Theme toggle (`#themeToggle`)
- Exit / Back navigation

### Features Tested
- Main navigation buttons (START GAME, CREATE LOBBY, JOIN LOBBY)
- Theme toggle interaction
- Grid size selection (5x5, 10x10, 20x20, 30x30)
- Player name input (`#playerName`)
- Room code display (`#roomCode`)
- Copy invite link button (`#copyInviteLinkBtn`)
- Ready / Start multiplayer buttons (`#readyBtn`, `#startMultiplayerGame`)
- Join room input (`#joinRoomCode`, `#joinRoomPasscode`, `#joinPlayerName`)
- Game board canvas (`#gameCanvas`)
- Exit game (`#exitGame`)
- Console error monitoring (continuous)
- Full multi-step user flow (menu → setup → game → exit)

### Not Tested / Out of Scope
- Actual multiplayer online gameplay (requires 2+ clients with valid Convex backend)
- AI opponent difficulty levels (easy/medium/hard) — UI present but gameplay not fully validated
- Replay / Undo / Redo controls (buttons present, not exercised in depth)
- Achievement unlocking (no achievements unlocked during brief test)
- Mobile/responsive layout testing (tested at 1280x720 desktop viewport only)
- Performance/load time under stress
- Security audit (XSS, CSP bypass attempts)
- Accessibility audit beyond basic aria-label checks (no screen reader test performed)
- Convex backend error scenarios (offline mode, server downtime)

### Blockers
- **Critical blocker:** Deployed production URL (`https://shapekeeper.vercel.app`) is non-functional (404). All public-facing testing was blocked; testing was performed against local server (`http://localhost:8888/`) as a fallback.
- No blockers encountered during local testing.

---

## Notes

- The 404 response from Vercel (`404 DEPLOYMENT_NOT_FOUND`) strongly suggests the deployment was deleted, the domain mapping is broken, or the build was never successfully published to this domain. This should be investigated in the Vercel dashboard.
- No JavaScript errors were detected in any tested flow. The Convex client connects properly (`connected`), subscribes to room updates, and handles state transitions (idle → creating_or_joining_room → room_subscribed) cleanly.
- All interactive elements (buttons, inputs, selects) respond as expected. The `startLocalGame` button is properly disabled until a grid size is selected, demonstrating correct form-state management.
- The `browser_vision`-style annotated analysis (simulated via Playwright full-page screenshots and manual element mapping) shows clean layout: no overlapping elements, no broken images, no missing labels on core interactive components.
- The `invite-link-section` and `copyInviteLinkBtn` render properly with the room code `WBCJRY` visible in the lobby.
- Recommendation: Fix the Vercel deployment and verify the domain mapping before any user-facing release. Once deployed, repeat this full-site dogfood pass to confirm the 404 is resolved and all online multiplayer flows work end-to-end.
