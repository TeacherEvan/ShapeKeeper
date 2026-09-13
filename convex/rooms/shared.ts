/**
 * Generates a random 6-character alphanumeric code for the short, public room
 * identifier. Excludes visually ambiguous characters (I, O, 0, 1) so the code
 * is comfortable to read aloud / type.
 */
export function generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

/**
 * Word lists for the silly [Adjective][Animal] lobby passcode.
 *
 * Design intent (2026-08-25, product owner):
 *   - 50+ adjectives × 50+ animals = 2500+ combos, ~11 bits entropy
 *   - All lowercase, no numbers, no human names, no real places
 *   - Whimsical, kid-friendly, easy to say out loud ("EasterPig", "SillyRabbit")
 *   - Collision checked at runtime against the live `by_passcode` index; if the
 *     practical space saturates, extend either list rather than falling back to
 *     numbers or random letters.
 */
export const ADJECTIVES = [
    'silly', 'bubbly', 'wobbly', 'mighty', 'tiny', 'cosmic', 'crispy', 'dizzy',
    'eager', 'fancy', 'fluffy', 'fuzzy', 'giddy', 'goofy', 'jolly', 'jumpy',
    'lucky', 'mellow', 'nutty', 'perky', 'plucky', 'quirky', 'sassy', 'scruffy',
    'sleepy', 'sneaky', 'spooky', 'squishy', 'stinky', 'sunny', 'tippy', 'wiggly',
    'yappy', 'zany', 'brave', 'clever', 'dapper', 'dashing', 'easter', 'fabled',
    'gentle', 'glorious', 'happy', 'heroic', 'kindly', 'lavish', 'lively', 'merry',
    'noble', 'plump', 'prancy', 'snazzy', 'sparkly', 'spritely', 'starry', 'stormy',
    'toasty', 'twirly', 'wacky', 'whimsy',
];

export const ANIMALS = [
    'pig', 'rabbit', 'wombat', 'otter', 'panda', 'badger', 'beaver', 'bison',
    'buffalo', 'camel', 'chinchilla', 'cobra', 'crane', 'donkey', 'duck',
    'falcon', 'ferret', 'fox', 'gazelle', 'gecko', 'gorilla', 'hamster', 'hedgehog',
    'hippo', 'hyena', 'iguana', 'jaguar', 'koala', 'lemur', 'leopard', 'llama',
    'meerkat', 'mongoose', 'narwhal', 'ostrich', 'panther', 'pelican', 'pony', 'puffin',
    'python', 'quokka', 'raccoon', 'reindeer', 'sloth', 'snail', 'sparrow', 'squirrel',
    'stingray', 'tapir', 'toucan', 'walrus', 'weasel', 'yak', 'zebra', 'anteater',
    'armadillo', 'cougar', 'dingo', 'eland', 'ibis', 'marmot', 'ocelot', 'okapi',
];

/**
 * Returns a TitleCase [Adjective][Animal] passcode, e.g. "EasterPig", "SillyRabbit".
 * No numbers, no separators, no human names. Generated on the server per lobby
 * and never persisted in env, config, or any static file.
 */
export function generateSillyPasscode(): string {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    const cap = (w: string): string => w.charAt(0).toUpperCase() + w.slice(1);
    return cap(adj) + cap(animal);
}

export const DEFAULT_COLORS = ['#FF0000', '#0000FF', '#00FF00', '#FF8C00', '#8B00FF', '#00FFFF'];
