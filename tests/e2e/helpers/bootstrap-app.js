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

export async function gotoApp(page, { startupTimeoutMs = 250 } = {}) {
    await page.route(/https:\/\/unpkg\.com\/convex@.*\/dist\/browser\.bundle\.js/, (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/javascript',
            body: CONVEX_BROWSER_BUNDLE_STUB,
        })
    );

    await page.route('**/*', async (route) => {
        const request = route.request();
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
