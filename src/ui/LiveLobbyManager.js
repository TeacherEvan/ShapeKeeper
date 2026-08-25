/**
 * LiveLobbyManager — replacement for the placeholder LobbyManager when the
 * game is in online (Convex) mode. Subscribes to the live room state, holds
 * the silly passcode alongside the short room code, and exposes a tiny URL
 * builder for the invite link.
 *
 * IMPORTANT: this module is a thin state holder + URL helper. The Convex
 * round-trips (create/join/subscribe) live in `convex-client.js` /
 * `convex-client/subscriptions.js`. The lobby UI reads from this manager's
 * snapshot via `lobbyView.js`.
 *
 * @module ui/LiveLobbyManager
 */

export class LiveLobbyManager {
    constructor() {
        this.reset();
    }

    reset() {
        this.roomId = null;
        this.roomCode = null;
        this.passcode = null; // silly [Adjective][Animal] (e.g. "EasterPig"). null until set.
        this.hostSessionId = null;
        this.mySessionId = null;
        this.players = []; // [{sessionId, name, color, isReady, isConnected, playerIndex}]
        this.isHost = false;
        this.gridSize = 5;
        this.partyMode = false;
        this.status = 'idle'; // 'idle' | 'lobby' | 'playing' | 'finished'
        this._unsubscribe = null;
    }

    /**
     * Apply a snapshot received from a Convex subscription callback.
     * @param {object} snapshot  shape: { room, players }
     */
    applySnapshot({ room, players } = {}) {
        if (room) {
            this.roomId = room._id || this.roomId;
            this.roomCode = room.roomCode || this.roomCode;
            this.passcode = room.passcode || this.passcode; // may be undefined for legacy rooms
            this.hostSessionId = room.hostPlayerId || this.hostSessionId;
            this.gridSize = room.gridSize ?? this.gridSize;
            this.partyMode = room.partyMode ?? this.partyMode;
            this.status = room.status || this.status;
        }
        if (Array.isArray(players)) {
            this.players = players
                .slice()
                .sort((a, b) => (a.playerIndex ?? 0) - (b.playerIndex ?? 0))
                .map((p) => ({
                    sessionId: p.sessionId,
                    name: p.name,
                    color: p.color,
                    isReady: p.isReady,
                    isConnected: p.isConnected,
                    playerIndex: p.playerIndex,
                    isHost: p.sessionId === this.hostSessionId,
                }));
            const me = this.players.find((p) => p.sessionId === this.mySessionId);
            this.isHost = me ? me.isHost : false;
        }
    }

    setMySessionId(sessionId) {
        this.mySessionId = sessionId;
    }

    setIdentity({ roomId, roomCode, passcode, hostSessionId }) {
        if (roomId) this.roomId = roomId;
        if (roomCode) this.roomCode = roomCode;
        if (passcode) this.passcode = passcode;
        if (hostSessionId) this.hostSessionId = hostSessionId;
    }

    attachSubscription(unsubscribe) {
        if (typeof unsubscribe === 'function') {
            this._unsubscribe = unsubscribe;
        }
    }

    detachSubscription() {
        if (this._unsubscribe) {
            try {
                this._unsubscribe();
            } catch (err) {
                console.warn('[LiveLobbyManager] unsubscribe threw', err);
            }
            this._unsubscribe = null;
        }
    }

    /**
     * Build the invite URL for the current lobby. Safe to call before the room
     * is fully set up — returns null when roomCode is missing.
     * @param {object} [opts]
     * @param {string} [opts.base] Override the base URL (defaults to window.location.origin).
     * @returns {string|null}
     */
    buildInviteUrl({ base } = {}) {
        if (!this.roomCode) return null;
        const origin = base || (typeof window !== 'undefined' ? window.location.origin : '');
        if (!origin) return null;
        const params = new URLSearchParams({ join: this.roomCode });
        if (this.passcode) params.set('passcode', this.passcode);
        return `${origin.replace(/\/$/, '')}/?${params.toString()}`;
    }

    getPlayerCount() {
        return this.players.length;
    }

    canStartGame() {
        // The host can start when there are >= 2 players and at least the host is ready.
        if (!this.isHost) return false;
        if (this.players.length < 2) return false;
        return this.players.every((p) => p.isReady);
    }
}

/**
 * Read `?join=ROOMCODE&passcode=PASSCODE` from the current URL. Returns
 * `{ roomCode, passcode }` if both are present, `{ roomCode }` if only the
 * code is present, or null if neither is set. Used by `welcome.js` to
 * pre-fill the join screen from an invite link.
 *
 * @param {string} [search] Optional override (defaults to window.location.search).
 * @returns {{roomCode: string, passcode: string|null}|null}
 */
export function getJoinParamsFromUrl(search) {
    if (typeof search !== 'string') {
        if (typeof window === 'undefined' || !window.location) return null;
        search = window.location.search;
    }
    if (!search) return null;
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    const roomCode = params.get('join');
    if (!roomCode) return null;
    const passcode = params.get('passcode') || null;
    return { roomCode: roomCode.toUpperCase(), passcode };
}
