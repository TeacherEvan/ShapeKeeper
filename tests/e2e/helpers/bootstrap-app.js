const CONVEX_BROWSER_BUNDLE_STUB = `
window.convex = {
    ConvexClient: function MockConvexClient() {
        return {
            mutation: async () => ({}),
            query: async () => null,
            onUpdate: () => () => {},
            close() {},
        };
    },
    anyApi: {
        rooms: {
            createRoom: 'rooms.createRoom',
            getRoom: 'rooms.getRoom',
            getRoomByCode: 'rooms.getRoomByCode',
            joinRoom: 'rooms.joinRoom',
            leaveRoom: 'rooms.leaveRoom',
            listOpenLobbies: 'rooms.listOpenLobbies',
            startGame: 'rooms.startGame',
            toggleReady: 'rooms.toggleReady',
            updateGridSize: 'rooms.updateGridSize',
            updatePartyMode: 'rooms.updatePartyMode',
            updatePlayer: 'rooms.updatePlayer',
        },
        games: {
            drawLine: 'games.drawLine',
            endGame: 'games.endGame',
            getGameState: 'games.getGameState',
            populateLines: 'games.populateLines',
            resetGame: 'games.resetGame',
            revealMultiplier: 'games.revealMultiplier',
        },
    },
};
`;

const CONVEX_BUNDLE_URL = /^https:\/\/unpkg\.com\/convex@.*\/dist\/browser\.bundle\.js$/;

export async function gotoApp(page, { startupTimeoutMs = 250 } = {}) {
    // One catch-all route, deliberately: Playwright dispatches each request to
    // the most recently registered matching handler, and a handler that calls
    // route.continue() does NOT fall through to earlier ones. Splitting the
    // bundle stub into its own route silently handed the script to the real
    // CDN, so the app booted against a live Convex deployment and every
    // backend-backed action (CREATE LOBBY / JOIN LOBBY) hung forever.
    await page.route('**/*', async (route) => {
        const request = route.request();

        if (CONVEX_BUNDLE_URL.test(request.url())) {
            await route.fulfill({
                status: 200,
                contentType: 'application/javascript',
                body: CONVEX_BROWSER_BUNDLE_STUB,
            });
            return;
        }

        if (request.resourceType() === 'document') {
            const response = await route.fetch();
            let html = await response.text();
            html = html.replace(
                /<script[^>]*src="https:\/\/unpkg\.com\/convex@[^"]*\/dist\/browser\.bundle\.js"[^>]*integrity="[^"]*"[^>]*>/,
                '<script src="https://unpkg.com/convex@1.42.3/dist/browser.bundle.js" crossorigin="anonymous"></script>'
            );
            await route.fulfill({
                status: 200,
                contentType: 'text/html',
                body: html,
            });
            return;
        }
        route.continue();
    });

    await page.addInitScript(
        ({ startupTimeoutOverride }) => {
            window.__SHAPEKEEPER_STARTUP_TIMEOUT_MS = startupTimeoutOverride;
            const noopAsync = async () => {};

            if (typeof document.exitFullscreen !== 'function') {
                document.exitFullscreen = noopAsync;
            }

            if (typeof Element.prototype.requestFullscreen !== 'function') {
                Element.prototype.requestFullscreen = noopAsync;
            }

            if (!navigator.clipboard) {
                Object.defineProperty(navigator, 'clipboard', {
                    configurable: true,
                    value: { writeText: noopAsync },
                });
            }
        },
        { startupTimeoutOverride: startupTimeoutMs }
    );

    await page.goto('/');
}
