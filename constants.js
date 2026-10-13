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
    PARTICLE_POOL_SIZE: 200, // Max pooled (reused) particles to cap GC churn
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

    // Lava timer particle engine (FR-1 / NFR-1)
    LAVA_PARTICLE_COUNT: 24,
    LAVA_PARTICLE_RADIUS_MIN: 6,
    LAVA_PARTICLE_RADIUS_MAX: 16,
    LAVA_PARTICLE_SPEED: 0.6,
    LAVA_OPACITY: 0.4, // Hard cap: lava never obscures dots (NFR-2)
    LAVA_URGENCY_THRESHOLD_MS: 5000, // <=5s left -> escalate
    LAVA_URGENCY_SPEED_SCALE: 1.85,
    LAVA_URGENCY_BUOYANCY: 0.08,
    LAVA_BOUNCE_DAMPING: 0.88, // vx/vy *= 0.88 on elastic reflection
};

// Feature flags (FR-6). Default OFF; enabled via window.FEATURE_* at runtime.
export const FEATURE_FLAGS = {
    FEATURE_LAVA_TIMER: false,
    FEATURE_SYNC_RESILIENCE: false,
};

// Turn / network timing (FR-2, FR-3)
export const TIMING_CONSTANTS = {
    TURN_DURATION_MS: 10000, // 10s countdown
    LAG_PAUSE_THRESHOLD_MS: 600, // packet/heartbeat latency above this pauses clock
    CLOCK_OFFSET_EMA_ALPHA: 0.2, // smoothing factor (0.2 new, 0.8 old)
    COUNTDOWN_QUANTIZE_MS: 100, // display quantized to 0.1s
    SNAPSHOT_TTL_MS: 48 * 60 * 60 * 1000, // purge snapshots older than 48h (FR-4)
    SNAPSHOT_PREFIX: 'shapekeeper.online.snapshots.', // localStorage key prefix (FR-4)
};

export const HYPOTHETICALS = [
    'Would you rather fight 100 duck-sized horses or 1 horse-sized duck?',
    'Would you rather have unlimited money or unlimited time?',
    'Would you rather be able to fly or be invisible?',
    'Would you rather live without music or without movies?',
    'Would you rather always be 10 minutes late or 20 minutes early?',
    'Would you rather have a rewind button or a pause button for your life?',
    'Would you rather know how you die or when you die?',
    'Would you rather speak all languages or talk to animals',
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
