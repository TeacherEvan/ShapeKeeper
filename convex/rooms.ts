import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// Create a new room
export { createRoom } from './mutations/createRoom';

// Join an existing room
export { joinRoom } from './mutations/joinRoom';

// Leave a room
export { leaveRoom } from './mutations/leaveRoom';

// Toggle ready status
export { toggleReady } from './mutations/toggleReady';

// Update player settings (name, color)
export { updatePlayer } from './mutations/updatePlayer';

// Update grid size (host only). hostToken is the raw token returned by
export { updateGridSize } from './mutations/updateGridSize';
export { updateTurnDuration } from './mutations/updateTurnDuration';


// Get room by code (for joining)
export { getRoomByCode } from './queries/roomQueries';

// Get room state (for subscriptions). sessionId is optional; when supplied,
// the response includes isHost / isYou flags.
export { getRoom } from './queries/roomQueries';

// List open lobbies (for the JOIN LOBBY browser screen).
export { listOpenLobbies } from './queries/roomQueries';

// Start the game (host only)
export { startGame } from './mutations/startGame';
