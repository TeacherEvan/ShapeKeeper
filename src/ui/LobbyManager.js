/**
 * Lobby Manager - Handles multiplayer lobby state
 *
 * TODO: [OPTIMIZATION] Consider moving lobby state to Redis for scalability
 * TODO: [ARCHITECTURE] Implement WebSocket connection pooling for real-time updates
 *
 * Note: This is a UI placeholder. Real multiplayer requires backend integration (Convex/Firebase/etc.)
 * @module ui/LobbyManager
 */

export class LobbyManager {
    constructor() {
        this.roomCode = null;
        this.players = [];
        this.isHost = false;
        this.myPlayerId = null;
        this.gridSize = 5;
        this.isReady = false;

        // Default player colors for up to 6 players
        this.defaultColors = [
            '#FF0000', // Red
            '#0000FF', // Blue
            '#00FF00', // Green
            '#FF8C00', // Orange
            '#8B00FF', // Purple
            '#00FFFF', // Cyan
        ];
    }

    /**
     * Generate a random 6-character room code
     * Uses characters that are easy to read and distinguish:
     * - Excludes I, O, 1, 0 to avoid confusion between similar-looking characters
     * @returns {string} A 6-character room code
     */
    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    createRoom(playerName) {
        this.roomCode = this.generateRoomCode();
        this.isHost = true;
        this.myPlayerId = 'player_1';
        this.players = [
            {
                id: this.myPlayerId,
                name: playerName || 'Host',
                color: this.defaultColors[0],
                isReady: false,
                isHost: true,
            },
        ];
        return this.roomCode;
    }

    joinRoom(roomCode, playerName) {
        // In a real implementation, this would connect to a server
        // For now, this is a UI demonstration
        this.roomCode = roomCode.toUpperCase();
        this.isHost = false;
        this.myPlayerId = `player_${Date.now()}`;

        // Calculate player index based on existing players + 1 for the new player
        // In real app, server would assign colors to avoid conflicts
        const playerIndex = this.players.length;
        const playerNumber = playerIndex + 1;

        this.players.push({
            id: this.myPlayerId,
            name: playerName || `Player ${playerNumber}`,
            color: this.defaultColors[playerIndex % this.defaultColors.length],
            isReady: false,
            isHost: false,
        });

        return true;
    }

    leaveRoom() {
        this.roomCode = null;
        this.players = [];
        this.isHost = false;
        this.myPlayerId = null;
        this.isReady = false;
    }

    toggleReady() {
        this.isReady = !this.isReady;
        const myPlayer = this.players.find((p) => p.id === this.myPlayerId);
        if (myPlayer) {
            myPlayer.isReady = this.isReady;
        }
        return this.isReady;
    }

    updateMyColor(color) {
        const myPlayer = this.players.find((p) => p.id === this.myPlayerId);
        if (myPlayer) {
            myPlayer.color = color;
        }
    }

    updateMyName(name) {
        const myPlayer = this.players.find((p) => p.id === this.myPlayerId);
        if (myPlayer) {
            myPlayer.name = name;
        }
    }

    setGridSize(size) {
        this.gridSize = size;
    }

    canStartGame() {
        // Need at least 2 players and all must be ready
        return this.players.length >= 2 && this.players.every((p) => p.isReady) && this.isHost;
    }

    getPlayerCount() {
        return this.players.length;
    }
}
