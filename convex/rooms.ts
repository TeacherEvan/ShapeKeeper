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
// createRoom; the server hashes it and compares against the room's
// hostTokenHash. Optional for backwards compat with rooms created before
// this deploy (the handler falls back to a sessionId-only check for those).
export { updateGridSize } from './mutations/updateGridSize';

// Update party mode (host only).
export { updatePartyMode } from './mutations/updatePartyMode';

// Get room by code (for joining)
export { getRoomByCode } from './queries/roomQueries';

// Get room state (for subscriptions). sessionId is optional; when supplied,
// the response includes isHost / isYou flags.
export { getRoom } from './queries/roomQueries';

// Start the game (host only)
export { startGame } from './mutations/startGame';
