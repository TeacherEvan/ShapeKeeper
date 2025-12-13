/**
 * ShapeKeeper Constants
 * All static configuration values used throughout the application
 * 
 * @module core/constants
 * @version 4.2.0
 * 
 * TODO: [OPTIMIZATION] Consider moving frequently-changed constants to a config file
 * TODO: [ARCHITECTURE] Consider using environment variables for deployment-specific values
 */

// =============================================================================
// GAME CONFIGURATION
// =============================================================================

/**
 * Game-wide configuration constants
 * @constant {Object} GAME
 */
export const GAME = {
    // Grid rendering
    DOT_RADIUS: 1.6,
    LINE_WIDTH: 6,
    CELL_SIZE_MIN: 8,
    CELL_SIZE_MAX: 40,
    GRID_OFFSET: 20,
    
    // Player configuration
    POPULATE_PLAYER_ID: 3,
    MAX_PLAYERS: 6,
    MIN_PLAYERS: 2,
    
    // Ghost line visibility
    GHOST_LINE_OPACITY: 0.3,
    
    // Default player colors
    PLAYER_COLORS: ['#FF0000', '#0000FF', '#00FF00', '#FF8C00', '#8B00FF', '#00FFFF']
};

// Legacy exports for backward compatibility
export const DOT_RADIUS = GAME.DOT_RADIUS;
export const LINE_WIDTH = GAME.LINE_WIDTH;
export const CELL_SIZE_MIN = GAME.CELL_SIZE_MIN;
export const CELL_SIZE_MAX = GAME.CELL_SIZE_MAX;
export const GRID_OFFSET = GAME.GRID_OFFSET;
export const POPULATE_PLAYER_ID = GAME.POPULATE_PLAYER_ID;

// =============================================================================
// ANIMATION TIMING (milliseconds)
// =============================================================================

export const ANIMATION = {
    SQUARE_DURATION: 600,
    KISS_DURATION: 1000,
    MULTIPLIER_DURATION: 2000,
    PULSATING_DURATION: 2000,
    LINE_DRAW_DURATION: 150,
    INVALID_FLASH_DURATION: 300,
    LINE_PULSE_DURATION: 2000
};

// =============================================================================
// PARTICLE SYSTEM
// =============================================================================

export const PARTICLES = {
    COUNT_SQUARE: 15,
    COUNT_MULTIPLIER_SPARKS: 30,
    COUNT_MULTIPLIER_SMOKE: 10,
    TRAIL_LENGTH: 8,
    AMBIENT_COUNT: 30,
    // Physics & rendering
    BURST_COUNT: 20,
    SPEED_MIN: 2,
    SPEED_MAX: 6,
    GRAVITY: 0.1,
    FRICTION: 0.98,
    RADIUS_MIN: 2,
    RADIUS_MAX: 6,
    DECAY_MIN: 0.015,
    DECAY_MAX: 0.03
};

// =============================================================================
// KISS EMOJI
// =============================================================================

export const KISS_EMOJI = {
    MIN: 5,
    MAX: 8
};

// =============================================================================
// COMBO SYSTEM
// =============================================================================

export const COMBO = {
    FLASH_THRESHOLD: 3,
    PULSE_THRESHOLD: 5,
    EPIC_THRESHOLD: 7
};

// =============================================================================
// SOUND FREQUENCIES (Hz)
// =============================================================================

export const SOUND_FREQ = {
    LINE_BASE: 440,
    SQUARE_BASE: 523,
    COMBO_BASE: 659
};

// =============================================================================
// TILE EFFECTS SYSTEM
// =============================================================================

export const TILE_EFFECTS = {
    // Configuration
    EFFECT_CHANCE: 0.2,    // 20% of squares have effects
    TRAP_CHANCE: 0.5,      // 50% traps, 50% powerups when effect exists
    
    // TRAPS (Red/Orange theme) - 10 effects
    traps: [
        {
            id: 'landmine',
            icon: '💣',
            name: 'Landmine!',
            description: 'BOOM! The area explodes! No one scores and you lose your turn.',
            color: '#FF4444',
            sound: 'explosion'
        },
        {
            id: 'secret',
            icon: '🔮',
            name: 'Reveal a Secret',
            description: 'Spill the tea! Share an embarrassing secret about yourself.',
            color: '#9C27B0',
            sound: 'mystical'
        },
        {
            id: 'hypothetical',
            icon: '🤔',
            name: 'Hypothetical',
            description: 'Answer the hypothetical question honestly!',
            color: '#FF9800',
            sound: 'thinking'
        },
        {
            id: 'drink',
            icon: '🍺',
            name: 'Drink!',
            description: 'Take a sip of your beverage! Cheers! 🍻',
            color: '#FFC107',
            sound: 'gulp'
        },
        {
            id: 'dared',
            icon: '🎯',
            name: "You're DARED!",
            description: 'Complete the dare or forfeit your next turn!',
            color: '#F44336',
            sound: 'dramatic'
        },
        {
            id: 'truth',
            icon: '🔥',
            name: "TRUTH TIME!",
            description: 'Answer a truth honestly or face the consequences!',
            color: '#FF5722',
            sound: 'reveal'
        },
        {
            id: 'reverse',
            icon: '🔄',
            name: 'Reverse!',
            description: 'Turn order is now reversed! Uno-style chaos!',
            color: '#E91E63',
            sound: 'whoosh'
        },
        {
            id: 'freeze',
            icon: '❄️',
            name: 'Frozen!',
            description: 'Brrr! Skip your next turn while you thaw out.',
            color: '#03A9F4',
            sound: 'freeze'
        },
        {
            id: 'swap_scores',
            icon: '🎭',
            name: 'Score Swap!',
            description: 'Your score gets swapped with the player on your left!',
            color: '#673AB7',
            sound: 'swap'
        },
        {
            id: 'ghost',
            icon: '👻',
            name: 'Ghost Mode',
            description: 'Your next 3 lines are invisible to opponents! Spooky!',
            color: '#607D8B',
            sound: 'ghost'
        },
        {
            id: 'chaos',
            icon: '🌪️',
            name: 'Chaos Storm!',
            description: 'All unclaimed squares are randomly redistributed!',
            color: '#FF5722',
            sound: 'storm'
        }
    ],
    
    // POWERUPS (Blue/Green theme) - 10 effects
    powerups: [
        {
            id: 'extra_turns',
            icon: '➕',
            name: '+2 Extra Moves!',
            description: 'Lucky you! Take 2 additional turns right now!',
            color: '#4CAF50',
            sound: 'powerup'
        },
        {
            id: 'steal_territory',
            icon: '🏴‍☠️',
            name: "Pirate's Plunder",
            description: 'Steal one of your opponent\'s squares and all connected to it!',
            color: '#2196F3',
            sound: 'pirate'
        },
        {
            id: 'dare_left',
            icon: '👈',
            name: 'Dare Left!',
            description: 'You get to DARE the player on your left! Make it good!',
            color: '#00BCD4',
            sound: 'challenge'
        },
        {
            id: 'physical_challenge',
            icon: '🤸',
            name: 'Physical Challenge!',
            description: 'The player on your right must do a silly physical challenge!',
            color: '#8BC34A',
            sound: 'fanfare'
        },
        {
            id: 'shield',
            icon: '🛡️',
            name: 'Shield Up!',
            description: 'Your next 3 completed squares are protected from stealing!',
            color: '#3F51B5',
            sound: 'shield'
        },
        {
            id: 'lightning',
            icon: '⚡',
            name: 'Lightning Strike!',
            description: 'POWER! Draw 2 lines at once on your next turn!',
            color: '#FFEB3B',
            sound: 'lightning'
        },
        {
            id: 'gift',
            icon: '🎁',
            name: 'Gift of Giving',
            description: 'Feeling generous? Give one of your squares to any player!',
            color: '#E91E63',
            sound: 'gift'
        },
        {
            id: 'oracle',
            icon: '🔍',
            name: "Oracle's Vision",
            description: 'See all hidden tile effects on the board for 10 seconds!',
            color: '#9C27B0',
            sound: 'reveal'
        },
        {
            id: 'double_points',
            icon: '✨',
            name: 'Lucky Star!',
            description: 'Your next 3 squares are worth DOUBLE points!',
            color: '#FFD700',
            sound: 'sparkle'
        },
        {
            id: 'wildcard',
            icon: '🌟',
            name: 'Wildcard!',
            description: 'Choose ANY powerup effect! The power is yours!',
            color: '#FF4081',
            sound: 'wildcard'
        }
    ]
};

// =============================================================================
// SOCIAL PROMPTS
// =============================================================================

export const HYPOTHETICALS = [
    "Would you rather fight 100 duck-sized horses or 1 horse-sized duck?",
    "Would you rather have unlimited money or unlimited time?",
    "Would you rather be able to fly or be invisible?",
    "Would you rather live without music or without movies?",
    "Would you rather always be 10 minutes late or 20 minutes early?",
    "Would you rather have a rewind button or a pause button for your life?",
    "Would you rather know how you die or when you die?",
    "Would you rather speak all languages or talk to animals?",
    "Would you rather give up social media forever or never watch TV again?",
    "Would you rather be famous for something bad or unknown for something great?"
];

export const DARES = [
    "Be Dared! (The group decides your fate)",
    "Dare the person to your right! (Make it good)"
];

export const TRUTHS = [
    "Receive a Truth! (The group asks you anything)",
    "Give a Truth! (Ask the person to your left anything)"
];

export const PHYSICAL_CHALLENGES = [
    "Do a dramatic slow-motion replay of capturing that square!",
    "Stand on one foot until your next turn!",
    "Touch your nose with your tongue (or try)!",
    "Do your best superhero pose!",
    "Give the player on your left a high five!",
    "Do the robot dance for 10 seconds!",
    "Spin around 3 times!",
    "Do an air guitar solo!",
    "Make the most ridiculous face you can!",
    "Do a victory dance right now!"
];

export const SHAPE_MESSAGES = [
    "Triangle Power! 🔺",
    "Three sides, infinite possibilities!",
    "Acute move! 😉",
    "You're looking sharp!",
    "Pyramid scheme? No, just points!",
    "Tri-umphant!",
    "Isosceles what you did there!",
    "Equilateral excellence!",
    "Pointy business!",
    "Geometry rules!"
];

// =============================================================================
// DEFAULT PLAYER COLORS
// =============================================================================

export const DEFAULT_COLORS = [
    '#FF0000', // Red
    '#0000FF', // Blue
    '#00FF00', // Green
    '#FF8C00', // Orange
    '#8B00FF', // Purple
    '#00FFFF'  // Cyan
];

// =============================================================================
// WELCOME ANIMATION
// =============================================================================

export const WELCOME_COLORS = [
    '#FF0000', '#FF4500', '#FF6B00', '#FF8C00', '#FFA500',
    '#FFD700', '#FFFF00', '#00FF00', '#00FF7F', '#00FFFF',
    '#0080FF', '#0000FF', '#4B0082', '#8B00FF', '#FF00FF',
    '#FF1493', '#FF69B4', '#00CED1', '#20B2AA', '#3CB371',
    '#9370DB', '#BA55D3', '#FF6347', '#FF4500', '#DC143C'
];
