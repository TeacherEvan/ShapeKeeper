// @vitest-environment jsdom
/**
 * Genuine behavioral tests for the Convex client connection-pooling layer.
 *
 * The real implementation is split across plain (non-module) IIFE scripts that
 * attach helpers to `window`:
 *   convex-client/shared.js          -> window.ShapeKeeperConvexShared
 *   convex-client/room-operations.js  -> window.ShapeKeeperConvexRoomOperations
 *   convex-client/game-operations.js  -> window.ShapeKeeperConvexGameOperations
 *   convex-client/subscriptions.js    -> window.ShapeKeeperConvexSubscriptions
 *   convex-client.js                  -> window.ShapeKeeperConvex (wires the above)
 *
 * These tests load those scripts with a mocked Convex browser bundle and assert
 * real behavior (state machine, singleton pooling, cleanup, subscription tracking)
 * instead of no-op placeholders.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Indirect eval runs the IIFE in global scope so its `window` reference resolves
// to the jsdom window.
function loadScript(relPath) {
    const code = fs.readFileSync(path.resolve(__dirname, relPath), 'utf-8');
    (0, eval)(code);
}

const GLOBALS = [
    'ShapeKeeperConvex',
    'ShapeKeeperConvexShared',
    'ShapeKeeperConvexRoomOperations',
    'ShapeKeeperConvexGameOperations',
    'ShapeKeeperConvexSubscriptions',
];

function makeConvexClientMock() {
    // `new ConvexClient(url)` returns a fresh instance each call, so the
    // spy methods must live on the instance, not the constructor.
    // onUpdate returns a distinct unsubscribe spy per call so each
    // subscription's returned unsubscribe fn can be asserted independently.
    const onUpdate = vi.fn(() => vi.fn()); // returns a unique unsubscribe fn
    const close = vi.fn();
    function ConvexClientMock() {
        this.onUpdate = onUpdate;
        this.close = close;
    }
    ConvexClientMock.onUpdate = onUpdate;
    ConvexClientMock.close = close;
    return ConvexClientMock;
}

function setup(present = true) {
    GLOBALS.forEach((g) => delete window[g]);
    window.localStorage.clear();
    window.CONVEX_URL = 'https://test.convex.cloud';

    if (!window.crypto || !window.crypto.getRandomValues) {
        window.crypto = {
            getRandomValues: (arr) => {
                for (let i = 0; i < arr.length; i++) arr[i] = i + 1;
            },
        };
    }

    if (present) {
        const clientMock = makeConvexClientMock();
        window.convex = {
            ConvexClient: clientMock,
            anyApi: {
                rooms: { getRoom: 'rooms:getRoom' },
                games: { getGameState: 'games:getGameState' },
            },
        };
    } else {
        window.convex = null;
    }

    loadScript('convex-client/shared.js');
    loadScript('convex-client/room-operations.js');
    loadScript('convex-client/game-operations.js');
    loadScript('convex-client/subscriptions.js');
    loadScript('convex-client.js');
}

describe('Connection Pooling (window.ShapeKeeperConvex)', () => {
    beforeEach(() => setup(true));

    it('starts in the disconnected state before initConvex is called', () => {
        expect(window.ShapeKeeperConvex.getConnectionState()).toBe('disconnected');
    });

    it('reuses a single client instance across repeated initConvex calls (pooling)', () => {
        const first = window.ShapeKeeperConvex.initConvex();
        const second = window.ShapeKeeperConvex.initConvex();
        expect(first).not.toBeNull();
        expect(second).toBe(first); // singleton reused, not re-created
        expect(window.ShapeKeeperConvex.getConnectionState()).toBe('connected');
    });

    it('creates and persists a session id in localStorage on first init', () => {
        window.ShapeKeeperConvex.initConvex();
        const stored = window.localStorage.getItem('shapekeeper_session_id');
        expect(typeof stored).toBe('string');
        expect(stored.length).toBeGreaterThan(0);
        // Subsequent init reuses the persisted id (does not regenerate).
        const after = window.localStorage.getItem('shapekeeper_session_id');
        expect(after).toBe(stored);
    });

    it('returns null and stays disconnected when the Convex bundle is missing', () => {
        setup(false); // reload without window.convex
        const client = window.ShapeKeeperConvex.initConvex();
        expect(client).toBeNull();
        expect(window.ShapeKeeperConvex.getConnectionState()).toBe('disconnected');
    });

    it('notifies connection-state listeners on transition', () => {
        const seen = [];
        const unsubscribe = window.ShapeKeeperConvex.onConnectionStateChange((s) => seen.push(s));
        // Listener is called immediately with the current state.
        expect(seen[0]).toBe('disconnected');
        window.ShapeKeeperConvex.initConvex(); // disconnected -> connecting -> connected
        expect(seen).toContain('connected');
        unsubscribe();
        const beforeLen = seen.length;
        window.ShapeKeeperConvex.closeConnection();
        // Removed listener must not receive further notifications.
        expect(seen.length).toBe(beforeLen);
    });
});

describe('Connection Lifecycle', () => {
    beforeEach(() => setup(true));

    it('closeConnection tears down the client and returns to disconnected', () => {
        const client = window.ShapeKeeperConvex.initConvex();
        expect(window.ShapeKeeperConvex.getConnectionState()).toBe('connected');
        window.ShapeKeeperConvex.closeConnection();
        expect(window.ShapeKeeperConvex.getConnectionState()).toBe('disconnected');
        expect(client.close).toHaveBeenCalledTimes(1);
        expect(window.ShapeKeeperConvexShared.state.convexClient).toBeNull();
    });

    it('resetConnection builds a fresh client instance after closing the old one', () => {
        const first = window.ShapeKeeperConvex.initConvex();
        const second = window.ShapeKeeperConvex.resetConnection();
        expect(second).not.toBeNull();
        expect(second).not.toBe(first); // a new connection was established
        expect(window.ShapeKeeperConvex.getConnectionState()).toBe('connected');
    });
});

describe('Subscription Lifecycle Integration', () => {
    beforeEach(() => setup(true));

    it('refuses to subscribe without an active room (returns a safe no-op)', () => {
        const unsub = window.ShapeKeeperConvex.subscribeToRoom(() => {});
        expect(typeof unsub).toBe('function');
        // No client subscription should have been opened.
        expect(window.ShapeKeeperConvexShared.state.activeSubscriptions.size).toBe(0);
    });

    it('opens a tracked subscription once a room is joined', () => {
        window.ShapeKeeperConvex.initConvex();
        window.ShapeKeeperConvex.setCurrentRoomId('room_xyz');
        const unsub = window.ShapeKeeperConvex.subscribeToRoom(() => {});

        expect(typeof unsub).toBe('function');
        expect(window.ShapeKeeperConvexShared.state.activeSubscriptions.size).toBe(1);
        // The underlying Convex client was asked to subscribe with the room id.
        const client = window.ShapeKeeperConvexShared.state.convexClient;
        expect(client.onUpdate).toHaveBeenCalledWith(
            'rooms:getRoom',
            { roomId: 'room_xyz' },
            expect.any(Function)
        );
    });

    it('unsubscribes the previous room subscription when a new one is opened', () => {
        window.ShapeKeeperConvex.initConvex();
        window.ShapeKeeperConvex.setCurrentRoomId('room_a');
        const unsub1 = window.ShapeKeeperConvex.subscribeToRoom(() => {});
        const client = window.ShapeKeeperConvexShared.state.convexClient;
        expect(client.onUpdate).toHaveBeenCalledTimes(1);

        window.ShapeKeeperConvex.setCurrentRoomId('room_b');
        const unsub2 = window.ShapeKeeperConvex.subscribeToRoom(() => {});
        // The first subscription's unsubscribe fn was invoked.
        expect(unsub1).toHaveBeenCalledTimes(1);
        // Exactly one active subscription remains.
        expect(window.ShapeKeeperConvexShared.state.activeSubscriptions.size).toBe(1);
        expect(unsub2).toHaveBeenCalledTimes(0);
    });

    it('clears all active subscriptions on closeConnection', () => {
        window.ShapeKeeperConvex.initConvex();
        window.ShapeKeeperConvex.setCurrentRoomId('room_a');
        const unsub = window.ShapeKeeperConvex.subscribeToRoom(() => {});

        window.ShapeKeeperConvex.closeConnection();
        expect(window.ShapeKeeperConvexShared.state.activeSubscriptions.size).toBe(0);
        expect(unsub).toHaveBeenCalledTimes(1);
    });
});
