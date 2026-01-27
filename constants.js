/**
 * ShapeKeeper - Game Constants
 * Static constants and configurations for the Dots and Boxes game
 *
 * @version 4.3.0
 * @author Teacher Evan
 */

export const GAME_CONSTANTS = {
    // Configuration constants
    DOT_RADIUS: 1.6,
    LINE_WIDTH: 6, // 300% increase from original 2
    CELL_SIZE_MIN: 8,
    CELL_SIZE_MAX: 40,
    GRID_OFFSET: 20,
    POPULATE_PLAYER_ID: 3, // Player ID for populate feature lines
    GHOST_LINE_OPACITY: 0.3, // Opacity for ghost lines (invisible to opponent)

    // Animation constants - tuned for 60fps smoothness
    ANIMATION_SQUARE_DURATION: 600,
    ANIMATION_KISS_DURATION: 1000,
    ANIMATION_MULTIPLIER_DURATION: 2000,
    ANIMATION_PULSATING_DURATION: 2000,
    ANIMATION_LINE_DRAW_DURATION: 150, // Line draw animation duration
    ANIMATION_INVALID_FLASH_DURATION: 300, // Invalid line flash duration

    // Particle constants - balanced for performance
    PARTICLE_COUNT_SQUARE: 15,
    PARTICLE_COUNT_MULTIPLIER_SPARKS: 30,
    PARTICLE_COUNT_MULTIPLIER_SMOKE: 10,
    PARTICLE_TRAIL_LENGTH: 8, // Trail history length for particles
    AMBIENT_PARTICLE_COUNT: 30, // Floating dust motes

    // Star/sparkle emoji constants (reduced for performance)
    SPARKLE_EMOJI_MIN: 5,
    SPARKLE_EMOJI_MAX: 8,
    SPARKLE_EMOJIS: ['✨', '⭐', '🌟'], // Stars and sparkles

    // Combo system constants
    COMBO_FLASH_THRESHOLD: 3,
    COMBO_PULSE_THRESHOLD: 5,
    COMBO_EPIC_THRESHOLD: 7,

    // Sound frequencies (Hz)
    SOUND_LINE_BASE: 440,
    SOUND_SQUARE_BASE: 523,
    SOUND_COMBO_BASE: 659,
};

export const TILE_EFFECTS = {
    // TRAPS (Red/Orange theme) - 10 effects
    traps: [
        {
            id: 'landmine',
            icon: '💣',
            name: 'Landmine!',
            description: 'BOOM! The area explodes! No one scores and you lose your turn.',
            color: '#FF4444',
            sound: 'explosion',
        },
        {
            id: 'secret',
            icon: '🔮',
            name: 'Reveal a Secret',
            description: 'Spill the tea! Share an embarrassing secret about yourself.',
            color: '#9C27B0',
            sound: 'mystical',
        },
        {
            id: 'hypothetical',
            icon: '🤔',
            name: 'Hypothetical',
            description: 'Answer the hypothetical question honestly!',
            color: '#FF9800',
            sound: 'thinking',
        },
        {
            id: 'drink',
            icon: '🍺',
            name: 'Drink!',
            description: 'Take a sip of your beverage! Cheers! 🍻',
            color: '#FFC107',
            sound: 'gulp',
        },
        {
            id: 'dared',
            icon: '🎯',
            name: "You're DARED!",
            description: 'Complete the dare or forfeit your next turn!',
            color: '#F44336',
            sound: 'dramatic',
        },
        {
            id: 'truth',
            icon: '🔥',
            name: 'TRUTH TIME!',
            description: 'Answer a truth honestly or face the consequences!',
            color: '#FF5722',
            sound: 'reveal',
        },
        {
            id: 'reverse',
            icon: '🔄',
            name: 'Reverse!',
            description: 'Turn order is now reversed! Uno-style chaos!',
            color: '#E91E63',
            sound: 'whoosh',
        },
        {
            id: 'freeze',
            icon: '❄️',
            name: 'Frozen!',
            description: 'Brrr! Skip your next turn while you thaw out.',
            color: '#03A9F4',
            sound: 'freeze',
        },
        {
            id: 'swap_scores',
            icon: '🎭',
            name: 'Score Swap!',
            description: 'Your score gets swapped with the player on your left!',
            color: '#673AB7',
            sound: 'swap',
        },
        {
            id: 'ghost',
            icon: '👻',
            name: 'Ghost Mode',
            description: 'Your next 3 lines are invisible to opponents! Spooky!',
            color: '#607D8B',
            sound: 'ghost',
        },
        {
            id: 'chaos',
            icon: '🌪️',
            name: 'Chaos Storm!',
            description: 'All unclaimed squares are randomly redistributed!',
            color: '#FF5722',
            sound: 'storm',
        },
    ],
    // POWERUPS (Blue/Green theme) - 10 effects
    powerups: [
        {
            id: 'extra_turns',
            icon: '➕',
            name: '+2 Extra Moves!',
            description: 'Lucky you! Take 2 additional turns right now!',
            color: '#4CAF50',
            sound: 'powerup',
        },
        {
            id: 'steal_territory',
            icon: '🏴‍☠️',
            name: "Pirate's Plunder",
            description: "Steal one of your opponent's squares and all connected to it!",
            color: '#2196F3',
            sound: 'pirate',
        },
        {
            id: 'dare_left',
            icon: '👈',
            name: 'Dare Left!',
            description: 'You get to DARE the player on your left! Make it good!',
            color: '#00BCD4',
            sound: 'challenge',
        },
        {
            id: 'physical_challenge',
            icon: '🤸',
            name: 'Physical Challenge!',
            description: 'The player on your right must do a silly physical challenge!',
            color: '#8BC34A',
            sound: 'fanfare',
        },
        {
            id: 'shield',
            icon: '🛡️',
            name: 'Shield Up!',
            description: 'Your next 3 completed squares are protected from stealing!',
            color: '#3F51B5',
            sound: 'shield',
        },
        {
            id: 'lightning',
            icon: '⚡',
            name: 'Lightning Strike!',
            description: 'POWER! Draw 2 lines at once on your next turn!',
            color: '#FFEB3B',
            sound: 'lightning',
        },
        {
            id: 'gift',
            icon: '🎁',
            name: 'Gift of Giving',
            description: 'Feeling generous? Give one of your squares to any player!',
            color: '#E91E63',
            sound: 'gift',
        },
        {
            id: 'oracle',
            icon: '🔍',
            name: "Oracle's Vision",
            description: 'See all hidden tile effects on the board for 10 seconds!',
            color: '#9C27B0',
            sound: 'reveal',
        },
        {
            id: 'double_points',
            icon: '✨',
            name: 'Lucky Star!',
            description: 'Your next 3 squares are worth DOUBLE points!',
            color: '#FFD700',
            sound: 'sparkle',
        },
        {
            id: 'wildcard',
            icon: '🌟',
            name: 'Wildcard!',
            description: 'Choose ANY powerup effect! The power is yours!',
            color: '#FF4081',
            sound: 'wildcard',
        },
    ],
};

export const SHAPE_MESSAGES = [
    'Triangle Power! 🔺',
    'Three sides, infinite possibilities!',
    'Acute move! 😉',
    "You're looking sharp!",
    'Pyramid scheme? No, just points!',
    'Tri-umphant!',
    'Isosceles what you did there!',
    'Equilateral excellence!',
    'Pointy business!',
    'Geometry rules!',
];

export const HYPOTHETICALS = [
    'Would you rather fight 100 duck-sized horses or 1 horse-sized duck?',
    'Would you rather have unlimited money or unlimited time?',
    'Would you rather be able to fly or be invisible?',
    'Would you rather live without music or without movies?',
    'Would you rather always be 10 minutes late or 20 minutes early?',
    'Would you rather have a rewind button or a pause button for your life?',
    'Would you rather know how you die or when you die?',
    'Would you rather speak all languages or talk to animals?',
    'Would you rather give up social media forever or never watch TV again?',
    'Would you rather be famous for something bad or unknown for something great?',
];

export const DARES = [
    'Be Dared! (The group decides your fate)',
    'Dare the person to your right! (Make it good)',
];

export const TRUTHS = [
    'Receive a Truth! (The group asks you anything)',
    'Give a Truth! (Ask the person to your left anything)',
];

export const PHYSICAL_CHALLENGES = [
    'Do a dramatic slow-motion replay of capturing that square!',
    'Stand on one foot until your next turn!',
    'Touch your nose with your tongue (or try)!',
    'Do your best superhero pose!',
    'Give the player on your left a high five!',
    'Do the robot dance for 10 seconds!',
    'Spin around 3 times!',
    'Do an air guitar solo!',
    'Make the most ridiculous face you can!',
    'Do a victory dance right now!',
];