import { describe, expect, it } from 'vitest';
import * as games from '../convex/games.ts';
import * as rooms from '../convex/rooms.ts';

describe('Public Convex API Surface Contract', () => {
    it('only exports authorized public mutations and queries from games.ts', () => {
        const expectedGamesExports = [
            'drawLine',
            'endGame',
            'expireTurn',
            'getGameState',
            'populateLines',
            'requestRematch',
            'resetGame',
            'revealMultiplier',
            'tapSquare',
        ];
        const actualExports = Object.keys(games).sort();
        expect(actualExports).toEqual(expectedGamesExports);
    });

    it('only exports authorized public mutations and queries from rooms.ts', () => {
        const expectedRoomsExports = [
            'createRoom',
            'getRoom',
            'getRoomByCode',
            'joinRoom',
            'leaveRoom',
            'listOpenLobbies',
            'startGame',
            'toggleReady',
            'updateGridSize',
            'updatePlayer',
            'updateTurnDuration',
        ];
        const actualExports = Object.keys(rooms).sort();
        expect(actualExports).toEqual(expectedRoomsExports);
    });
});
