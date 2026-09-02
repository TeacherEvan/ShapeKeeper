import { log, errorLog, warn } from '../log';

// re-export the .js implementation so the .ts importers (and Convex
// tsc) use the same crypto-strong generator the Vitest suite exercises.
export {
    generateRoomCode,
    generateSecureRoomCode,
    ROOM_CODE_CHARSET,
    ROOM_CODE_LENGTH,
} from './shared-utils.js';

export const DEFAULT_COLORS = ['#FF0000', '#0000FF', '#00FF00', '#FF8C00', '#8B00FF', '#00FFFF'];
