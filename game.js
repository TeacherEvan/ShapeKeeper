class DotsAndBoxesGame {
    // Configuration constants
    static DOT_RADIUS = 1.6;
    static LINE_WIDTH = 6; // 300% increase from original 2
    static CELL_SIZE_MIN = 8;
    static CELL_SIZE_MAX = 40;
    static GRID_OFFSET = 20;
    static POPULATE_PLAYER_ID = 3; // Player ID for populate feature lines
    
    // Animation constants
    static ANIMATION_SQUARE_DURATION = 600;
    static ANIMATION_KISS_DURATION = 1000;
    static ANIMATION_MULTIPLIER_DURATION = 2000;
    static ANIMATION_PULSATING_DURATION = 2000;
    static ANIMATION_LINE_DRAW_DURATION = 150; // Line draw animation duration
    static ANIMATION_INVALID_FLASH_DURATION = 300; // Invalid line flash duration
    
    // Particle constants
    static PARTICLE_COUNT_SQUARE = 15;
    static PARTICLE_COUNT_MULTIPLIER_SPARKS = 30;
    static PARTICLE_COUNT_MULTIPLIER_SMOKE = 10;
    static PARTICLE_TRAIL_LENGTH = 8; // Trail history length for particles
    static AMBIENT_PARTICLE_COUNT = 30; // Floating dust motes
    
    // Kiss emoji constants (reduced for performance)
    static KISS_EMOJI_MIN = 5;
    static KISS_EMOJI_MAX = 8;
    
    // Combo system constants
    static COMBO_FLASH_THRESHOLD = 3;
    static COMBO_PULSE_THRESHOLD = 5;
    static COMBO_EPIC_THRESHOLD = 7;
    
    // Sound frequencies (Hz)
    static SOUND_LINE_BASE = 440;
    static SOUND_SQUARE_BASE = 523;
    static SOUND_COMBO_BASE = 659;
    
    // Tile Effects System - Traps (negative) and Powerups (positive)
    static TILE_EFFECTS = {
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
    
    // Social prompts for party game effects
    static HYPOTHETICALS = [
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
    
    static DARES = [
        "Do your best impression of another player!",
        "Speak in an accent for the next 3 turns!",
        "Let another player post anything on your social media!",
        "Do 10 jumping jacks right now!",
        "Tell an embarrassing story about yourself!",
        "Let the player on your right give you a new nickname for the game!",
        "Sing the chorus of the last song you listened to!",
        "Do your best dance move for 10 seconds!",
        "Compliment every player sincerely!",
        "Keep your eyes closed until your next turn!",
        "Speak in third person for the next 3 turns!",
        "Make a funny face and hold it for 10 seconds!",
        "Do a backflip... or pretend to try!",
        "Tickle a pickle (find something to wiggle)!",
        "Speak in rhymes for your next 2 turns!"
    ];
    
    static PHYSICAL_CHALLENGES = [
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
    
    constructor(gridSize, player1Color, player2Color) {
        this.gridSize = gridSize;
        this.player1Color = player1Color;
        this.player2Color = player2Color;
        this.populateColor = this.generateRandomColor(); // Random 3rd color for populate feature
        this.currentPlayer = 1;
        this.scores = { 1: 0, 2: 0 };
        this.lines = new Set();
        this.squares = {};
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.dotRadius = DotsAndBoxesGame.DOT_RADIUS;
        this.lineWidth = DotsAndBoxesGame.LINE_WIDTH;
        this.selectedDot = null;
        this.pulsatingLines = [];
        this.lineOwners = new Map(); // Track which player drew each line

        // Multi-touch support
        this.activeTouches = new Map(); // Track multiple touches by identifier
        this.touchVisuals = []; // Visual feedback for touch points
        this.touchStartDot = null; // Track the dot where touch started
        
        // Selection persistence for problematic devices/extensions
        this.lastInteractionTime = 0;
        this.selectionLocked = false; // Prevent accidental deselection
        this.lastTouchTime = 0; // Track touch events to prevent mouse event interference

        // Animation system for completed squares
        this.squareAnimations = []; // Active square animations
        this.particles = []; // Particle effects for celebrations
        this.kissEmojis = []; // Kiss emoji animations for completed squares
        
        // Score multiplier system (legacy - replaced by tile effects)
        this.squareMultipliers = {}; // Store multipliers for each square
        this.revealedMultipliers = new Set(); // Track which squares have been clicked
        
        // Tile Effects System (traps & powerups)
        this.tileEffects = {}; // Store effects for each square position
        this.revealedEffects = new Set(); // Track which effects have been revealed
        this.activatedEffects = new Set(); // Track which effects have been activated
        this.pendingEffect = null; // Current effect waiting for user interaction
        this.effectModal = null; // Reference to effect modal DOM element
        this.oracleVisionActive = false; // Oracle's Vision powerup active
        this.oracleVisionTimeout = null; // Timeout for Oracle's Vision
        
        // Player status effects (from tile effects)
        this.playerEffects = {
            1: { frozenTurns: 0, shieldCount: 0, doublePointsCount: 0, ghostLines: 0, bonusTurns: 0, doubleLine: false },
            2: { frozenTurns: 0, shieldCount: 0, doublePointsCount: 0, ghostLines: 0, bonusTurns: 0, doubleLine: false }
        };
        
        // Effect animations
        this.effectAnimations = []; // Active effect-specific animations
        this.effectShimmer = 0; // Global shimmer phase for hidden effects
        
        // Animated score counters
        this.displayedScores = { 1: 0, 2: 0 }; // Scores currently displayed (animated)
        this.scoreAnimationSpeed = 0.1; // How fast scores count up
        
        // Phase 1 Animation Features (CounterPlan)
        this.lineDrawings = []; // Lines currently being animated
        this.shakeIntensity = 0; // Screen shake intensity
        this.shakeDecay = 0.9; // How fast shake decays
        this.invalidLineFlash = null; // Flash effect for invalid line attempts
        this.hoveredDot = null; // Currently hovered dot for preview
        
        // Phase 2: Motion Trails & Persistence
        this.selectionRibbon = null; // Flowing ribbon when selecting dots
        
        // Phase 3: Glow & Atmosphere
        this.ambientParticles = []; // Floating background dust motes
        this.backgroundHue = 220; // Dynamic background gradient hue
        
        // Phase 5: Combo System
        this.comboCount = 0; // Consecutive squares without turn switch
        this.lastComboPlayer = 0; // Track which player has the combo
        this.comboFlashActive = false; // Visual flash for combos
        this.screenPulse = 0; // Screen pulse intensity
        
        // Phase 6: Sound Design
        this.soundManager = null; // Web Audio API manager
        this.soundEnabled = true; // Toggle for sound effects
        
        // Multiplayer mode properties
        this.isMultiplayer = false; // Set to true when playing online
        this.myPlayerNumber = 1; // Which player number I am (1 or 2)
        this.isMyTurn = true; // Is it currently my turn to play
        
        // DOM element cache for performance
        this.domCache = {
            player1Score: document.getElementById('player1Score'),
            player2Score: document.getElementById('player2Score'),
            player1Info: document.getElementById('player1Info'),
            player2Info: document.getElementById('player2Info'),
            turnIndicator: document.getElementById('turnIndicator'),
            populateBtn: document.getElementById('populateBtn')
        };
        
        // UI update throttling
        this.lastUIUpdate = 0;
        this.uiUpdateInterval = 16; // ~60fps max for UI updates

        this.setupCanvas();
        this.initializeMultipliers(); // Initialize multipliers AFTER grid dimensions are set
        this.initializeTileEffects(); // Initialize tile effects (traps & powerups)
        this.initializeAmbientParticles(); // Phase 3: Initialize ambient particles
        this.initializeSoundManager(); // Phase 6: Initialize Web Audio
        this.createEffectModal(); // Create the effect reveal modal
        this.setupEventListeners();
        this.draw();
        this.updateUI();
        this.animate();
    }
    
    /**
     * Phase 6: Initialize Web Audio API for procedural sounds
     */
    initializeSoundManager() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.soundManager = {
                    ctx: null, // Lazy init on first user interaction
                    initialized: false
                };
            }
        } catch (e) {
            console.log('[Sound] Web Audio API not available');
            this.soundManager = null;
        }
    }
    
    /**
     * Phase 6: Ensure audio context is initialized (must be called from user gesture)
     */
    ensureAudioContext() {
        if (!this.soundManager || this.soundManager.initialized) return;
        
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.soundManager.ctx = new AudioContext();
            this.soundManager.initialized = true;
        } catch (e) {
            console.log('[Sound] Could not initialize audio context');
        }
    }
    
    /**
     * Phase 6: Play line draw sound (rising tone)
     */
    playLineSound() {
        if (!this.soundEnabled || !this.soundManager?.ctx) return;
        
        const ctx = this.soundManager.ctx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(DotsAndBoxesGame.SOUND_LINE_BASE, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(
            DotsAndBoxesGame.SOUND_LINE_BASE * 2, 
            ctx.currentTime + 0.1
        );
        
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
    }
    
    /**
     * Phase 6: Play square completion sound (chord)
     */
    playSquareSound(comboCount = 1) {
        if (!this.soundEnabled || !this.soundManager?.ctx) return;
        
        const ctx = this.soundManager.ctx;
        const baseFreq = DotsAndBoxesGame.SOUND_SQUARE_BASE * (1 + comboCount * 0.1);
        
        // Play a chord (root + major third + fifth)
        [1, 1.26, 1.5].forEach((mult, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(baseFreq * mult, ctx.currentTime);
            
            gain.gain.setValueAtTime(0.08, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            
            osc.connect(gain).connect(ctx.destination);
            osc.start(ctx.currentTime + i * 0.05);
            osc.stop(ctx.currentTime + 0.35);
        });
    }
    
    /**
     * Phase 6: Play invalid move sound (dissonant buzz)
     */
    playInvalidSound() {
        if (!this.soundEnabled || !this.soundManager?.ctx) return;
        
        const ctx = this.soundManager.ctx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.15);
        
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
    }
    
    /**
     * Phase 6: Play combo sound (escalating arpeggio)
     */
    playComboSound(comboLevel) {
        if (!this.soundEnabled || !this.soundManager?.ctx) return;
        
        const ctx = this.soundManager.ctx;
        const notes = [1, 1.26, 1.5, 2]; // Major arpeggio
        
        notes.slice(0, Math.min(comboLevel, 4)).forEach((mult, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(
                DotsAndBoxesGame.SOUND_COMBO_BASE * mult * (1 + comboLevel * 0.05), 
                ctx.currentTime
            );
            
            gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.08 + 0.2);
            
            osc.connect(gain).connect(ctx.destination);
            osc.start(ctx.currentTime + i * 0.08);
            osc.stop(ctx.currentTime + i * 0.08 + 0.25);
        });
    }
    
    /**
     * Phase 6: Play victory fanfare
     */
    playVictorySound() {
        if (!this.soundEnabled || !this.soundManager?.ctx) return;
        
        const ctx = this.soundManager.ctx;
        const melody = [523, 659, 784, 1047]; // C5, E5, G5, C6
        
        melody.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            
            gain.gain.setValueAtTime(0.08, ctx.currentTime + i * 0.15);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.3);
            
            osc.connect(gain).connect(ctx.destination);
            osc.start(ctx.currentTime + i * 0.15);
            osc.stop(ctx.currentTime + i * 0.15 + 0.35);
        });
    }
    
    /**
     * Phase 3: Initialize ambient floating particles
     */
    initializeAmbientParticles() {
        this.ambientParticles = [];
        for (let i = 0; i < DotsAndBoxesGame.AMBIENT_PARTICLE_COUNT; i++) {
            this.ambientParticles.push(this.createAmbientParticle());
        }
    }
    
    /**
     * Phase 3: Create a single ambient particle
     */
    createAmbientParticle(atEdge = false) {
        const w = this.logicalWidth || 800;
        const h = this.logicalHeight || 600;
        
        return {
            x: atEdge ? (Math.random() < 0.5 ? 0 : w) : Math.random() * w,
            y: Math.random() * h,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            size: 1 + Math.random() * 2,
            opacity: 0.1 + Math.random() * 0.15,
            phase: Math.random() * Math.PI * 2 // For sine wave motion
        };
    }

    /**
     * Generate a random color for the populate feature
     * Ensures it's visually distinct from player 1 and 2 colors
     * @returns {string} Hex color string
     */
    generateRandomColor() {
        // Generate random RGB values
        const r = Math.floor(Math.random() * 256);
        const g = Math.floor(Math.random() * 256);
        const b = Math.floor(Math.random() * 256);
        
        // Convert to hex
        const toHex = (val) => val.toString(16).padStart(2, '0').toUpperCase();
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    setupCanvas() {
        const container = this.canvas.parentElement;
        const maxWidth = container.clientWidth - 40;
        const maxHeight = container.clientHeight - 40;

        // Calculate optimal grid dimensions for landscape
        // If gridSize is passed as a single number, create landscape layout
        if (typeof this.gridSize === 'number') {
            const aspectRatio = maxWidth / maxHeight;

            // Optimize grid for landscape (width > height)
            if (aspectRatio > 1.5) {
                // Calculate cols and rows to fill landscape nicely
                const totalSquares = (this.gridSize - 1) * (this.gridSize - 1);
                this.gridCols = Math.ceil(Math.sqrt(totalSquares * aspectRatio));
                this.gridRows = Math.ceil(totalSquares / (this.gridCols - 1)) + 1;

                // Ensure we have at least the minimum dimensions
                this.gridCols = Math.max(this.gridCols, Math.ceil(this.gridSize * 1.2));
                this.gridRows = Math.max(this.gridRows, Math.ceil(this.gridSize * 0.6));
            } else {
                // Use square grid for non-landscape displays
                this.gridCols = this.gridSize;
                this.gridRows = this.gridSize;
            }
        } else {
            // If gridSize is an object with rows and cols
            this.gridCols = this.gridSize.cols || this.gridSize;
            this.gridRows = this.gridSize.rows || this.gridSize;
        }

        // Calculate cell size based on available space
        const cellSizeWidth = Math.floor(maxWidth / (this.gridCols - 1));
        const cellSizeHeight = Math.floor(maxHeight / (this.gridRows - 1));
        const cellSize = Math.min(cellSizeWidth, cellSizeHeight);

        // Allow smaller cell sizes now that dots are smaller
        this.cellSize = Math.max(DotsAndBoxesGame.CELL_SIZE_MIN, 
                                Math.min(cellSize, DotsAndBoxesGame.CELL_SIZE_MAX));
        const logicalWidth = (this.gridCols - 1) * this.cellSize + DotsAndBoxesGame.GRID_OFFSET * 2;
        const logicalHeight = (this.gridRows - 1) * this.cellSize + DotsAndBoxesGame.GRID_OFFSET * 2;
        
        // Store logical dimensions for use in draw() method
        this.logicalWidth = logicalWidth;
        this.logicalHeight = logicalHeight;
        
        // Account for device pixel ratio for crisp rendering on high-DPI displays
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = logicalWidth * dpr;
        this.canvas.height = logicalHeight * dpr;
        this.canvas.style.width = logicalWidth + 'px';
        this.canvas.style.height = logicalHeight + 'px';
        
        this.offsetX = DotsAndBoxesGame.GRID_OFFSET;
        this.offsetY = DotsAndBoxesGame.GRID_OFFSET;

        // Remove old event listeners if they exist
        const oldCanvas = this.canvas;
        const newCanvas = oldCanvas.cloneNode(true);
        oldCanvas.parentNode.replaceChild(newCanvas, oldCanvas);
        this.canvas = newCanvas;
        this.ctx = newCanvas.getContext('2d');
        
        // Scale context to match device pixel ratio (dpr already declared above)
        this.ctx.scale(dpr, dpr);

        // Multi-touch event listeners
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
        this.canvas.addEventListener('touchcancel', this.handleTouchEnd.bind(this), { passive: false });

        // Keep mouse support
        this.canvas.addEventListener('click', this.handleClick.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));

        // Add populate button listener
        this.setupPopulateButton();
    }

    initializeMultipliers() {
        // Calculate total number of squares
        const totalSquares = (this.gridRows - 1) * (this.gridCols - 1);
        
        // Create array of all square keys
        const allSquareKeys = [];
        for (let row = 0; row < this.gridRows - 1; row++) {
            for (let col = 0; col < this.gridCols - 1; col++) {
                allSquareKeys.push(`${row},${col}`);
            }
        }
        
        // Shuffle array for random distribution
        for (let i = allSquareKeys.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allSquareKeys[i], allSquareKeys[j]] = [allSquareKeys[j], allSquareKeys[i]];
        }
        
        // Calculate counts for each multiplier type
        // Distribute 100% of squares among multipliers (no more Truth or Dare)
        // Note: Math.floor may leave remainders, which are assigned to x2 below
        const counts = {
            'x2': Math.floor(totalSquares * 0.65),
            'x3': Math.floor(totalSquares * 0.20),
            'x4': Math.floor(totalSquares * 0.10),
            'x5': Math.floor(totalSquares * 0.04),
            'x10': Math.max(1, Math.floor(totalSquares * 0.01))
        };
        
        let index = 0;
        
        // Assign multipliers
        for (let i = 0; i < counts.x2; i++) {
            if (index < allSquareKeys.length) {
                this.squareMultipliers[allSquareKeys[index++]] = { type: 'multiplier', value: 2 };
            }
        }
        for (let i = 0; i < counts.x3; i++) {
            if (index < allSquareKeys.length) {
                this.squareMultipliers[allSquareKeys[index++]] = { type: 'multiplier', value: 3 };
            }
        }
        for (let i = 0; i < counts.x4; i++) {
            if (index < allSquareKeys.length) {
                this.squareMultipliers[allSquareKeys[index++]] = { type: 'multiplier', value: 4 };
            }
        }
        for (let i = 0; i < counts.x5; i++) {
            if (index < allSquareKeys.length) {
                this.squareMultipliers[allSquareKeys[index++]] = { type: 'multiplier', value: 5 };
            }
        }
        for (let i = 0; i < counts.x10; i++) {
            if (index < allSquareKeys.length) {
                this.squareMultipliers[allSquareKeys[index++]] = { type: 'multiplier', value: 10 };
            }
        }
        
        // Assign remaining squares to x2 multiplier to ensure 100% coverage
        while (index < allSquareKeys.length) {
            this.squareMultipliers[allSquareKeys[index++]] = { type: 'multiplier', value: 2 };
        }
    }
    
    /**
     * Initialize tile effects (traps and powerups) for the game board
     * ~20% of squares get effects, balanced between traps and powerups
     */
    initializeTileEffects() {
        const totalSquares = (this.gridRows - 1) * (this.gridCols - 1);
        
        // Create array of all square positions
        const allPositions = [];
        for (let row = 0; row < this.gridRows - 1; row++) {
            for (let col = 0; col < this.gridCols - 1; col++) {
                allPositions.push(`${row},${col}`);
            }
        }
        
        // Shuffle positions
        for (let i = allPositions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allPositions[i], allPositions[j]] = [allPositions[j], allPositions[i]];
        }
        
        // Calculate how many effects to place (~20% of squares)
        const effectCount = Math.max(4, Math.floor(totalSquares * 0.20));
        const trapsCount = Math.floor(effectCount / 2);
        const powerupsCount = effectCount - trapsCount;
        
        const traps = DotsAndBoxesGame.TILE_EFFECTS.traps;
        const powerups = DotsAndBoxesGame.TILE_EFFECTS.powerups;
        
        let index = 0;
        
        // Assign traps
        for (let i = 0; i < trapsCount && index < allPositions.length; i++) {
            const trap = traps[Math.floor(Math.random() * traps.length)];
            this.tileEffects[allPositions[index++]] = {
                type: 'trap',
                effect: trap,
                revealed: false,
                activated: false
            };
        }
        
        // Assign powerups
        for (let i = 0; i < powerupsCount && index < allPositions.length; i++) {
            const powerup = powerups[Math.floor(Math.random() * powerups.length)];
            this.tileEffects[allPositions[index++]] = {
                type: 'powerup',
                effect: powerup,
                revealed: false,
                activated: false
            };
        }
        
        console.log(`[TileEffects] Initialized ${effectCount} effects (${trapsCount} traps, ${powerupsCount} powerups)`);
    }
    
    /**
     * Create the effect modal DOM element for displaying trap/powerup reveals
     */
    createEffectModal() {
        // Check if modal already exists
        if (document.getElementById('effectModal')) {
            this.effectModal = document.getElementById('effectModal');
            return;
        }
        
        const modal = document.createElement('div');
        modal.id = 'effectModal';
        modal.className = 'effect-modal';
        modal.innerHTML = `
            <div class="effect-modal-content">
                <div class="effect-modal-header">
                    <span class="effect-icon"></span>
                    <h2 class="effect-title"></h2>
                </div>
                <p class="effect-description"></p>
                <div class="effect-prompt"></div>
                <div class="effect-actions">
                    <button class="effect-btn effect-btn-primary">Activate!</button>
                    <button class="effect-btn effect-btn-secondary" style="display: none;">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        this.effectModal = modal;
        
        // Add click handlers
        const primaryBtn = modal.querySelector('.effect-btn-primary');
        const secondaryBtn = modal.querySelector('.effect-btn-secondary');
        
        primaryBtn.addEventListener('click', () => this.activateCurrentEffect());
        secondaryBtn.addEventListener('click', () => this.closeEffectModal());
    }

    setupEventListeners() {
        window.addEventListener('resize', () => {
            this.setupCanvas();
            this.draw();
        });
    }

    setupPopulateButton() {
        // Setup populate button
        const populateBtn = document.getElementById('populateBtn');
        if (populateBtn) {
            populateBtn.addEventListener('click', () => this.handlePopulate());
        }
        
        // Setup sound toggle button
        const soundToggle = document.getElementById('soundToggle');
        if (soundToggle) {
            soundToggle.addEventListener('click', () => this.toggleSound());
        }
        
        // Initial check for populate button visibility
        this.updatePopulateButtonVisibility();
    }
    
    /**
     * Toggle sound effects on/off
     */
    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        const soundToggle = document.getElementById('soundToggle');
        if (soundToggle) {
            soundToggle.textContent = this.soundEnabled ? '🔊' : '🔇';
            soundToggle.classList.toggle('muted', !this.soundEnabled);
        }
    }

    getNearestDot(x, y) {
        const col = Math.round((x - this.offsetX) / this.cellSize);
        const row = Math.round((y - this.offsetY) / this.cellSize);

        if (row >= 0 && row < this.gridRows && col >= 0 && col < this.gridCols) {
            const dotX = this.offsetX + col * this.cellSize;
            const dotY = this.offsetY + row * this.cellSize;
            const distance = Math.sqrt(Math.pow(x - dotX, 2) + Math.pow(y - dotY, 2));

            if (distance <= this.cellSize * 0.5) {
                return { row, col };
            }
        }
        return null;
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const dot = this.getNearestDot(x, y);
        const oldHoveredDot = this.hoveredDot;
        
        if (dot && this.selectedDot && this.areAdjacent(this.selectedDot, dot)) {
            this.canvas.style.cursor = 'pointer';
            // Track hovered dot for preview line
            const lineKey = this.getLineKey(this.selectedDot, dot);
            if (!this.lines.has(lineKey)) {
                this.hoveredDot = dot;
            } else {
                this.hoveredDot = null;
            }
        } else if (dot) {
            this.canvas.style.cursor = 'pointer';
            this.hoveredDot = null;
        } else {
            this.canvas.style.cursor = 'default';
            this.hoveredDot = null;
        }
        
        // Redraw if hover state changed
        if ((oldHoveredDot?.row !== this.hoveredDot?.row) || 
            (oldHoveredDot?.col !== this.hoveredDot?.col)) {
            this.draw();
        }
    }

    areAdjacent(dot1, dot2) {
        const rowDiff = Math.abs(dot1.row - dot2.row);
        const colDiff = Math.abs(dot1.col - dot2.col);
        return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
    }

    getLineKey(dot1, dot2) {
        const [first, second] = [dot1, dot2].sort((a, b) =>
            a.row === b.row ? a.col - b.col : a.row - b.row
        );
        return `${first.row},${first.col}-${second.row},${second.col}`;
    }
    
    /**
     * Parse a line key string into start and end dot objects
     * @param {string} lineKey - Format: "row,col-row,col"
     * @returns {Array} [startDot, endDot]
     */
    parseLineKey(lineKey) {
        const [start, end] = lineKey.split('-').map(s => {
            const [row, col] = s.split(',').map(Number);
            return { row, col };
        });
        return [start, end];
    }
    
    /**
     * Parse a square key string into row and col
     * @param {string} squareKey - Format: "row,col"
     * @returns {Object} {row, col}
     */
    parseSquareKey(squareKey) {
        const [row, col] = squareKey.split(',').map(Number);
        return { row, col };
    }

    checkForSquares(lineKey) {
        const [start, end] = lineKey.split('-').map(s => {
            const [row, col] = s.split(',').map(Number);
            return { row, col };
        });

        const completedSquares = [];
        const isHorizontal = start.row === end.row;

        if (isHorizontal) {
            // Check square above
            if (start.row > 0) {
                const squareKey = `${start.row - 1},${Math.min(start.col, end.col)}`;
                if (this.isSquareComplete(start.row - 1, Math.min(start.col, end.col))) {
                    this.squares[squareKey] = this.currentPlayer;
                    completedSquares.push(squareKey);
                }
            }
            // Check square below
            if (start.row < this.gridRows - 1) {
                const squareKey = `${start.row},${Math.min(start.col, end.col)}`;
                if (this.isSquareComplete(start.row, Math.min(start.col, end.col))) {
                    this.squares[squareKey] = this.currentPlayer;
                    completedSquares.push(squareKey);
                }
            }
        } else {
            // Check square to the left
            if (start.col > 0) {
                const squareKey = `${Math.min(start.row, end.row)},${start.col - 1}`;
                if (this.isSquareComplete(Math.min(start.row, end.row), start.col - 1)) {
                    this.squares[squareKey] = this.currentPlayer;
                    completedSquares.push(squareKey);
                }
            }
            // Check square to the right
            if (start.col < this.gridCols - 1) {
                const squareKey = `${Math.min(start.row, end.row)},${start.col}`;
                if (this.isSquareComplete(Math.min(start.row, end.row), start.col)) {
                    this.squares[squareKey] = this.currentPlayer;
                    completedSquares.push(squareKey);
                }
            }
        }

        return completedSquares;
    }

    isSquareComplete(row, col) {
        const top = this.getLineKey({ row, col }, { row, col: col + 1 });
        const bottom = this.getLineKey({ row: row + 1, col }, { row: row + 1, col: col + 1 });
        const left = this.getLineKey({ row, col }, { row: row + 1, col });
        const right = this.getLineKey({ row, col: col + 1 }, { row: row + 1, col: col + 1 });

        return this.lines.has(top) && this.lines.has(bottom) &&
            this.lines.has(left) && this.lines.has(right) &&
            !this.squares[`${row},${col}`];
    }

    handleClick(e) {
        // === MOUSE CLICK HANDLER ===
        // Prevent mouse events that follow touch events (some devices fire both)
        const now = Date.now();
        if (now - this.lastTouchTime < 500) {
            return; // Ignore mouse events shortly after touch
        }
        
        // Prevent rapid duplicate events (common with Chrome extensions)
        if (now - this.lastInteractionTime < 50) {
            return; // Debounce rapid clicks
        }
        this.lastInteractionTime = now;
        
        // Phase 6: Ensure audio context on click
        this.ensureAudioContext();

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Check if clicking on a completed square to reveal effect or multiplier
        const clickedSquare = this.getSquareAtPosition(x, y);
        if (clickedSquare && this.squares[clickedSquare]) {
            // Check for tile effect first
            if (this.tileEffects[clickedSquare] && !this.revealedEffects.has(clickedSquare)) {
                this.revealTileEffect(clickedSquare);
                return;
            }
            // Fall back to multiplier reveal
            if (!this.revealedMultipliers.has(clickedSquare)) {
                this.revealMultiplier(clickedSquare);
                return;
            }
        }

        const dot = this.getNearestDot(x, y);
        if (!dot) {
            // Only deselect if clicking far from any dot
            if (!this.selectionLocked) {
                this.selectedDot = null;
                this.draw();
            }
            return;
        }

        if (!this.selectedDot) {
            // Select first dot
            this.selectedDot = dot;
            this.selectionLocked = true; // Lock selection until action is taken
            this.draw();
        } else if (this.selectedDot.row === dot.row && this.selectedDot.col === dot.col) {
            // Clicked same dot - deselect
            this.selectedDot = null;
            this.selectionLocked = false;
            this.draw();
        } else {
            if (this.areAdjacent(this.selectedDot, dot)) {
                this.drawLine(this.selectedDot, dot);
                this.selectionLocked = false; // Unlock after action
            } else {
                // Clicked non-adjacent dot - trigger invalid line flash
                this.triggerInvalidLineFlash(this.selectedDot, dot);
                // Select the new dot
                this.selectedDot = dot;
                this.selectionLocked = true;
            }
            
            this.draw();
        }
    }
    
    getSquareAtPosition(x, y) {
        // Convert screen coordinates to grid coordinates
        const col = Math.floor((x - this.offsetX) / this.cellSize);
        const row = Math.floor((y - this.offsetY) / this.cellSize);
        
        if (row >= 0 && row < this.gridRows - 1 && col >= 0 && col < this.gridCols - 1) {
            const squareKey = `${row},${col}`;
            return squareKey;
        }
        return null;
    }
    
    async revealMultiplier(squareKey) {
        // In multiplayer mode, only the square owner can reveal
        if (this.isMultiplayer) {
            const squareOwner = this.squares[squareKey];
            if (squareOwner !== this.myPlayerNumber) {
                // Not my square - can't reveal
                return;
            }
            
            // Send reveal to Convex backend
            if (window.ShapeKeeperConvex) {
                const result = await window.ShapeKeeperConvex.revealMultiplier(squareKey);
                if (result.error) {
                    console.error('[Game] Error revealing multiplier:', result.error);
                    return;
                }
                // Server will broadcast the update via subscription
                return;
            }
        }
        
        // Local game logic
        this.revealedMultipliers.add(squareKey);
        const multiplierData = this.squareMultipliers[squareKey];
        const player = this.squares[squareKey];
        
        if (multiplierData && multiplierData.type === 'multiplier') {
            // Apply multiplier to the score - MULTIPLY the score
            const currentScore = this.scores[player];
            const multiplierValue = multiplierData.value;
            this.scores[player] = currentScore * multiplierValue;
            
            // Trigger special animation
            this.triggerMultiplierAnimation(squareKey, multiplierValue);
            
            this.updateUI();
        }
        this.draw();
    }
    
    /**
     * Reveal a tile effect (trap or powerup) when clicking on a completed square
     */
    revealTileEffect(squareKey) {
        const effectData = this.tileEffects[squareKey];
        if (!effectData || this.revealedEffects.has(squareKey)) return;
        
        // Mark as revealed
        this.revealedEffects.add(squareKey);
        effectData.revealed = true;
        
        // Store pending effect for activation
        this.pendingEffect = {
            squareKey,
            effectData,
            player: this.squares[squareKey]
        };
        
        // Play reveal sound
        this.playEffectRevealSound(effectData.type);
        
        // Trigger reveal particles
        this.triggerEffectRevealParticles(squareKey, effectData);
        
        // Show the effect modal
        this.showEffectModal(effectData);
        
        this.draw();
    }
    
    /**
     * Show the effect modal with trap/powerup details
     */
    showEffectModal(effectData) {
        if (!this.effectModal) return;
        
        const effect = effectData.effect;
        const isTrap = effectData.type === 'trap';
        
        // Update modal content
        const icon = this.effectModal.querySelector('.effect-icon');
        const title = this.effectModal.querySelector('.effect-title');
        const description = this.effectModal.querySelector('.effect-description');
        const prompt = this.effectModal.querySelector('.effect-prompt');
        const primaryBtn = this.effectModal.querySelector('.effect-btn-primary');
        
        icon.textContent = effect.icon;
        title.textContent = effect.name;
        description.textContent = effect.description;
        
        // Set theme class
        this.effectModal.classList.remove('trap-theme', 'powerup-theme');
        this.effectModal.classList.add(isTrap ? 'trap-theme' : 'powerup-theme');
        
        // Add special prompts for social effects
        prompt.innerHTML = '';
        prompt.style.display = 'none';
        
        if (effect.id === 'hypothetical') {
            const question = DotsAndBoxesGame.HYPOTHETICALS[
                Math.floor(Math.random() * DotsAndBoxesGame.HYPOTHETICALS.length)
            ];
            prompt.innerHTML = `<div class="effect-question">"${question}"</div>`;
            prompt.style.display = 'block';
        } else if (effect.id === 'dared' || effect.id === 'dare_left') {
            const dare = DotsAndBoxesGame.DARES[
                Math.floor(Math.random() * DotsAndBoxesGame.DARES.length)
            ];
            prompt.innerHTML = `<div class="effect-dare">${dare}</div>`;
            prompt.style.display = 'block';
        } else if (effect.id === 'physical_challenge') {
            const challenge = DotsAndBoxesGame.PHYSICAL_CHALLENGES[
                Math.floor(Math.random() * DotsAndBoxesGame.PHYSICAL_CHALLENGES.length)
            ];
            prompt.innerHTML = `<div class="effect-challenge">${challenge}</div>`;
            prompt.style.display = 'block';
        }
        
        // Button text based on effect type
        primaryBtn.textContent = isTrap ? 'Accept Fate!' : 'Activate!';
        primaryBtn.style.background = effect.color;
        
        // Show modal with animation
        this.effectModal.classList.add('show');
    }
    
    /**
     * Close the effect modal
     */
    closeEffectModal() {
        if (this.effectModal) {
            this.effectModal.classList.remove('show');
            this.pendingEffect = null;
        }
    }
    
    /**
     * Activate the current pending effect
     */
    activateCurrentEffect() {
        if (!this.pendingEffect) {
            this.closeEffectModal();
            return;
        }
        
        const { squareKey, effectData, player } = this.pendingEffect;
        const effect = effectData.effect;
        
        // Mark as activated
        this.activatedEffects.add(squareKey);
        effectData.activated = true;
        
        // Play activation sound
        this.playEffectActivationSound(effectData.type, effect.id);
        
        // Execute the effect
        this.executeEffect(effect.id, effectData.type, player, squareKey);
        
        // Close modal
        this.closeEffectModal();
        
        // Update UI
        this.updateUI();
        this.draw();
    }
    
    /**
     * Execute the gameplay effect
     */
    executeEffect(effectId, effectType, player, squareKey) {
        const otherPlayer = player === 1 ? 2 : 1;
        
        switch (effectId) {
            // === TRAPS ===
            case 'landmine':
                // Remove the square, no one gets points
                delete this.squares[squareKey];
                this.scores[player] = Math.max(0, this.scores[player] - 1);
                this.triggerLandmineAnimation(squareKey);
                // Lose turn handled by not giving bonus
                break;
                
            case 'secret':
            case 'hypothetical':
            case 'drink':
            case 'dared':
                // Social effects - just display, honor system
                // Already shown in modal
                break;
                
            case 'reverse':
                // Visual effect only in 2-player (would affect multiplayer order)
                this.triggerReverseAnimation();
                break;
                
            case 'freeze':
                this.playerEffects[player].frozenTurns = 1;
                this.triggerFreezeAnimation(player);
                break;
                
            case 'swap_scores':
                const temp = this.scores[player];
                this.scores[player] = this.scores[otherPlayer];
                this.scores[otherPlayer] = temp;
                this.triggerSwapAnimation();
                break;
                
            case 'ghost':
                this.playerEffects[player].ghostLines = 3;
                break;
                
            case 'chaos':
                this.triggerChaosStorm();
                break;
                
            // === POWERUPS ===
            case 'extra_turns':
                this.playerEffects[player].bonusTurns += 2;
                this.triggerPowerupParticles(squareKey, '#4CAF50');
                break;
                
            case 'steal_territory':
                // For now, steal one random opponent square
                this.stealRandomSquare(player, otherPlayer);
                break;
                
            case 'dare_left':
            case 'physical_challenge':
                // Social effects - already shown in modal
                break;
                
            case 'shield':
                this.playerEffects[player].shieldCount = 3;
                this.triggerShieldAnimation(player);
                break;
                
            case 'lightning':
                this.playerEffects[player].doubleLine = true;
                this.triggerLightningAnimation();
                break;
                
            case 'gift':
                // For simplicity, give one point to opponent (diplomacy!)
                this.scores[otherPlayer] += 1;
                this.triggerGiftAnimation(otherPlayer);
                break;
                
            case 'oracle':
                this.activateOracleVision();
                break;
                
            case 'double_points':
                this.playerEffects[player].doublePointsCount = 3;
                this.triggerPowerupParticles(squareKey, '#FFD700');
                break;
                
            case 'wildcard':
                // For now, give +2 bonus turns (best powerup)
                this.playerEffects[player].bonusTurns += 2;
                this.triggerWildcardAnimation(squareKey);
                break;
        }
    }
    
    /**
     * Oracle's Vision - reveal all hidden effects temporarily
     */
    activateOracleVision() {
        this.oracleVisionActive = true;
        this.draw();
        
        // Clear any existing timeout
        if (this.oracleVisionTimeout) {
            clearTimeout(this.oracleVisionTimeout);
        }
        
        // Deactivate after 10 seconds
        this.oracleVisionTimeout = setTimeout(() => {
            this.oracleVisionActive = false;
            this.draw();
        }, 10000);
    }
    
    /**
     * Steal a random square from opponent
     */
    stealRandomSquare(player, opponent) {
        const opponentSquares = Object.entries(this.squares)
            .filter(([key, owner]) => owner === opponent)
            .map(([key]) => key);
        
        if (opponentSquares.length > 0) {
            const randomKey = opponentSquares[Math.floor(Math.random() * opponentSquares.length)];
            this.squares[randomKey] = player;
            this.scores[opponent]--;
            this.scores[player]++;
            this.triggerStealAnimation(randomKey);
        }
    }

    /**
     * Consolidated method for drawing a line between two dots
     * Handles score updates, animations, and turn switching
     * In multiplayer mode, sends the move to Convex backend
     */
    async drawLine(dot1, dot2) {
        const lineKey = this.getLineKey(dot1, dot2);
        
        // Phase 6: Ensure audio context is initialized on user interaction
        this.ensureAudioContext();

        // In multiplayer mode, check if it's my turn
        if (this.isMultiplayer) {
            this.isMyTurn = this.currentPlayer === this.myPlayerNumber;
            if (!this.isMyTurn) {
                // Not my turn - ignore the click
                return;
            }
            
            // Send move to Convex backend
            if (window.ShapeKeeperConvex) {
                const result = await window.ShapeKeeperConvex.drawLine(lineKey);
                if (result.error) {
                    console.error('[Game] Error drawing line:', result.error);
                    return;
                }
                // Server will broadcast the update via subscription
                // Local state will be updated by handleGameStateUpdate
                this.selectedDot = null;
                this.selectionLocked = false;
                this.selectionRibbon = null;
                return;
            }
        }

        // Local game logic (single player or fallback)
        if (!this.lines.has(lineKey)) {
            this.lines.add(lineKey);
            this.lineOwners.set(lineKey, this.currentPlayer); // Store line ownership permanently
            this.pulsatingLines.push({
                line: lineKey,
                player: this.currentPlayer,
                time: Date.now()
            });

            // Add line draw animation
            const [startDot, endDot] = this.parseLineKey(lineKey);
            this.lineDrawings.push({
                lineKey,
                startDot,
                endDot,
                player: this.currentPlayer,
                startTime: Date.now(),
                duration: DotsAndBoxesGame.ANIMATION_LINE_DRAW_DURATION
            });
            
            // Phase 6: Play line sound
            this.playLineSound();
            
            const completedSquares = this.checkForSquares(lineKey);

            if (completedSquares.length === 0) {
                // Reset combo on turn switch
                this.comboCount = 0;
                this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
            } else {
                this.scores[this.currentPlayer] += completedSquares.length;
                
                // Phase 5: Update combo system
                if (this.lastComboPlayer === this.currentPlayer) {
                    this.comboCount += completedSquares.length;
                } else {
                    this.comboCount = completedSquares.length;
                    this.lastComboPlayer = this.currentPlayer;
                }
                
                // Phase 5: Trigger combo effects
                if (this.comboCount >= DotsAndBoxesGame.COMBO_FLASH_THRESHOLD) {
                    this.comboFlashActive = true;
                    this.playComboSound(this.comboCount);
                }
                if (this.comboCount >= DotsAndBoxesGame.COMBO_PULSE_THRESHOLD) {
                    this.screenPulse = Math.min(this.comboCount * 0.3, 2);
                }
                if (this.comboCount >= DotsAndBoxesGame.COMBO_EPIC_THRESHOLD) {
                    // Epic mode: extra particles!
                    this.triggerEpicParticles();
                }
                
                completedSquares.forEach(squareKey => {
                    this.triggerSquareAnimation(squareKey);
                });
                
                // Phase 6: Play square sound
                this.playSquareSound(this.comboCount);
                
                // Trigger screen shake for multiple squares (Phase 1.3)
                if (completedSquares.length >= 2) {
                    this.shakeIntensity = completedSquares.length * 2;
                }
            }

            this.updateUI();
            this.checkGameOver();
            
            // Update populate button visibility
            this.updatePopulateButtonVisibility();
            
            // Clear selection and unlock after drawing line
            this.selectedDot = null;
            this.selectionLocked = false;
            this.selectionRibbon = null;
        }
    }
    
    /**
     * Phase 5: Trigger epic particle burst for high combos
     */
    triggerEpicParticles() {
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96E6A1', '#FFD93D', '#6BCB77'];
        
        for (let i = 0; i < 50; i++) {
            const angle = (Math.PI * 2 * i) / 50;
            const speed = 3 + Math.random() * 4;
            const color = colors[Math.floor(Math.random() * colors.length)];
            
            this.particles.push({
                x: this.logicalWidth / 2,
                y: this.logicalHeight / 2,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2,
                color,
                size: 2 + Math.random() * 3,
                life: 1.0,
                decay: 0.01 + Math.random() * 0.01,
                trail: []
            });
        }
    }

    handleTouchStart(e) {
        e.preventDefault();

        // Mark that we're handling touch events
        this.lastTouchTime = Date.now();
        
        // Phase 6: Ensure audio context on touch
        this.ensureAudioContext();

        // Debounce to prevent event conflicts with Chrome extensions
        const now = Date.now();
        if (now - this.lastInteractionTime < 50) {
            return;
        }
        this.lastInteractionTime = now;

        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            const rect = this.canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;

            // Store touch info
            this.activeTouches.set(touch.identifier, { x, y, startTime: Date.now() });

            // Add touch visual
            this.touchVisuals.push({
                x, y,
                id: touch.identifier,
                startTime: Date.now(),
                duration: 300
            });
        }

        this.draw();
    }

    handleTouchMove(e) {
        e.preventDefault();

        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            const rect = this.canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;

            // Update touch position
            if (this.activeTouches.has(touch.identifier)) {
                this.activeTouches.set(touch.identifier, {
                    x, y,
                    startTime: this.activeTouches.get(touch.identifier).startTime
                });
            }

            // Phase 2: Update selection ribbon during drag
            this.updateSelectionRibbon(x, y);

            // Do NOT update selected dot during move - only on touchend
            // This prevents selection loss on devices with sensitive touch screens
        }
    }

    handleTouchEnd(e) {
        e.preventDefault();

        // Mark touch interaction
        this.lastTouchTime = Date.now();

        // Debounce to prevent duplicate events
        const now = Date.now();
        if (now - this.lastInteractionTime < 50) {
            return;
        }
        this.lastInteractionTime = now;

        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            const rect = this.canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;

            // Check if tapping on a completed square to reveal effect or multiplier
            const clickedSquare = this.getSquareAtPosition(x, y);
            if (clickedSquare && this.squares[clickedSquare]) {
                // Check for tile effect first
                if (this.tileEffects[clickedSquare] && !this.revealedEffects.has(clickedSquare)) {
                    this.revealTileEffect(clickedSquare);
                    this.activeTouches.delete(touch.identifier);
                    continue;
                }
                // Fall back to multiplier reveal
                if (!this.revealedMultipliers.has(clickedSquare)) {
                    this.revealMultiplier(clickedSquare);
                    this.activeTouches.delete(touch.identifier);
                    continue;
                }
            }

            // Get the dot at the touch end position
            const endDot = this.getNearestDot(x, y);
            
            if (endDot) {
                const distance = Math.sqrt(
                    Math.pow(x - (this.offsetX + endDot.col * this.cellSize), 2) +
                    Math.pow(y - (this.offsetY + endDot.row * this.cellSize), 2)
                );
                
                // Only process if touch ended near a dot
                if (distance <= this.cellSize * 0.5) {
                    // Check for two-tap interaction to draw a line
                    if (this.selectedDot && (this.selectedDot.row !== endDot.row || this.selectedDot.col !== endDot.col)) {
                        // Different dot selected - check if adjacent
                        if (this.areAdjacent(this.selectedDot, endDot)) {
                            this.drawLine(this.selectedDot, endDot);
                            // Selection cleared and unlocked in drawLine()
                        } else {
                            // Non-adjacent dot tapped - trigger invalid line flash
                            this.triggerInvalidLineFlash(this.selectedDot, endDot);
                            // Select the new dot
                            this.selectedDot = endDot;
                            this.touchStartDot = endDot;
                            this.selectionLocked = true;
                        }
                    } else if (!this.selectedDot) {
                        // No dot selected - select this one
                        this.selectedDot = endDot;
                        this.touchStartDot = endDot;
                        this.selectionLocked = true;
                    } else {
                        // Same dot tapped - deselect
                        this.selectedDot = null;
                        this.touchStartDot = null;
                        this.selectionLocked = false;
                    }
                }
            }

            this.activeTouches.delete(touch.identifier);
        }

        // Clear selection ribbon on touch end
        this.selectionRibbon = null;

        // Redraw to show selection changes
        if (this.activeTouches.size === 0) {
            this.draw();
        }
    }

    updateSelectedDot(x, y) {
        const dot = this.getNearestDot(x, y);
        if (!dot) return;

        const distance = Math.sqrt(
            Math.pow(x - (this.offsetX + dot.col * this.cellSize), 2) +
            Math.pow(y - (this.offsetY + dot.row * this.cellSize), 2)
        );

        if (distance <= this.cellSize * 0.5) {
            this.selectedDot = dot;
            this.draw();
        }
    }

    triggerSquareAnimation(squareKey) {
        const { row, col } = this.parseSquareKey(squareKey);
        const centerX = this.offsetX + (col + 0.5) * this.cellSize;
        const centerY = this.offsetY + (row + 0.5) * this.cellSize;

        // Add MULTIPLE kiss emoji animations (dozens randomly placed)
        const kissCount = DotsAndBoxesGame.KISS_EMOJI_MIN + 
                         Math.floor(Math.random() * (DotsAndBoxesGame.KISS_EMOJI_MAX - DotsAndBoxesGame.KISS_EMOJI_MIN));
        for (let i = 0; i < kissCount; i++) {
            // Random position within and around the square
            const offsetRange = this.cellSize * 2;
            const randomX = centerX + (Math.random() - 0.5) * offsetRange;
            const randomY = centerY + (Math.random() - 0.5) * offsetRange;
            
            this.kissEmojis.push({
                x: randomX,
                y: randomY,
                startTime: Date.now() + Math.random() * 200, // Stagger start times
                duration: DotsAndBoxesGame.ANIMATION_KISS_DURATION + Math.random() * 500, // Varied durations
                scale: 0.5 + Math.random() * 0.5 // Varied sizes
            });
        }

        // Add square scale animation
        this.squareAnimations.push({
            squareKey,
            startTime: Date.now(),
            duration: DotsAndBoxesGame.ANIMATION_SQUARE_DURATION,
            centerX,
            centerY
        });

        // Create particle burst (scaled down for smaller cells)
        const playerColor = this.currentPlayer === 1 ? this.player1Color : this.player2Color;
        const particleCount = DotsAndBoxesGame.PARTICLE_COUNT_SQUARE;

        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount;
            const speed = 1 + Math.random() * 2; // Reduced from 2 + Math.random() * 3

            this.particles.push({
                x: centerX,
                y: centerY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: playerColor,
                size: 1.5 + Math.random() * 2, // Reduced from 3 + Math.random() * 4
                life: 1.0,
                decay: 0.015 + Math.random() * 0.01
            });
        }
    }
    
    triggerMultiplierAnimation(squareKey, multiplierValue) {
        const { row, col } = this.parseSquareKey(squareKey);
        const centerX = this.offsetX + (col + 0.5) * this.cellSize;
        const centerY = this.offsetY + (row + 0.5) * this.cellSize;
        
        // Add multiplier text animation with sparks and smoke
        this.multiplierAnimations = this.multiplierAnimations || [];
        this.multiplierAnimations.push({
            squareKey,
            value: multiplierValue,
            startTime: Date.now(),
            duration: DotsAndBoxesGame.ANIMATION_MULTIPLIER_DURATION,
            centerX,
            centerY
        });
        
        // Create sparks effect
        const sparkCount = DotsAndBoxesGame.PARTICLE_COUNT_MULTIPLIER_SPARKS;
        for (let i = 0; i < sparkCount; i++) {
            const angle = (Math.PI * 2 * i) / sparkCount;
            const speed = 2 + Math.random() * 3;
            
            this.particles.push({
                x: centerX,
                y: centerY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1, // Slight upward bias
                color: '#FFD700', // Gold color for multipliers
                size: 2 + Math.random() * 3,
                life: 1.0,
                decay: 0.01 + Math.random() * 0.01,
                spark: true
            });
        }
        
        // Create smoke effect
        const smokeCount = DotsAndBoxesGame.PARTICLE_COUNT_MULTIPLIER_SMOKE;
        for (let i = 0; i < smokeCount; i++) {
            this.particles.push({
                x: centerX + (Math.random() - 0.5) * this.cellSize,
                y: centerY,
                vx: (Math.random() - 0.5) * 0.5,
                vy: -1 - Math.random() * 1.5,
                color: '#888888',
                size: 5 + Math.random() * 5,
                life: 1.0,
                decay: 0.008,
                smoke: true
            });
        }
    }
    
    // === TILE EFFECT ANIMATIONS ===
    
    /**
     * Play sound when revealing a tile effect
     */
    playEffectRevealSound(type) {
        if (!this.soundEnabled || !this.soundManager?.ctx) return;
        
        const ctx = this.soundManager.ctx;
        const now = ctx.currentTime;
        
        if (type === 'trap') {
            // Ominous descending tone
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.5);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
            osc.connect(gain).connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.5);
        } else {
            // Magical ascending sparkle
            const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + i * 0.08);
                gain.gain.setValueAtTime(0.1, now + i * 0.08);
                gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.2);
                osc.connect(gain).connect(ctx.destination);
                osc.start(now + i * 0.08);
                osc.stop(now + i * 0.08 + 0.25);
            });
        }
    }
    
    /**
     * Play sound when activating an effect
     */
    playEffectActivationSound(type, effectId) {
        if (!this.soundEnabled || !this.soundManager?.ctx) return;
        
        const ctx = this.soundManager.ctx;
        const now = ctx.currentTime;
        
        // Special sounds for specific effects
        if (effectId === 'landmine') {
            // Explosion sound
            const noise = ctx.createBufferSource();
            const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < buffer.length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.1));
            }
            noise.buffer = buffer;
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            noise.connect(gain).connect(ctx.destination);
            noise.start(now);
        } else if (effectId === 'freeze') {
            // Ice crackle
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(2000, now);
            osc.frequency.exponentialRampToValueAtTime(500, now + 0.2);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.connect(gain).connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.2);
        }
    }
    
    /**
     * Trigger particles when revealing an effect
     */
    triggerEffectRevealParticles(squareKey, effectData) {
        const { row, col } = this.parseSquareKey(squareKey);
        const centerX = this.offsetX + (col + 0.5) * this.cellSize;
        const centerY = this.offsetY + (row + 0.5) * this.cellSize;
        const color = effectData.effect.color;
        
        // Burst of themed particles
        for (let i = 0; i < 20; i++) {
            const angle = (Math.PI * 2 * i) / 20;
            const speed = 2 + Math.random() * 2;
            
            this.particles.push({
                x: centerX,
                y: centerY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: color,
                size: 3 + Math.random() * 3,
                life: 1.0,
                decay: 0.02,
                trail: [],
                spark: effectData.type === 'powerup'
            });
        }
    }
    
    /**
     * Landmine explosion animation
     */
    triggerLandmineAnimation(squareKey) {
        const { row, col } = this.parseSquareKey(squareKey);
        const centerX = this.offsetX + (col + 0.5) * this.cellSize;
        const centerY = this.offsetY + (row + 0.5) * this.cellSize;
        
        // Big screen shake
        this.shakeIntensity = 15;
        
        // Explosion particles
        for (let i = 0; i < 50; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 3 + Math.random() * 5;
            
            this.particles.push({
                x: centerX,
                y: centerY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: ['#FF4444', '#FF8800', '#FFDD00'][Math.floor(Math.random() * 3)],
                size: 4 + Math.random() * 6,
                life: 1.0,
                decay: 0.02,
                trail: []
            });
        }
        
        // Smoke particles
        for (let i = 0; i < 20; i++) {
            this.particles.push({
                x: centerX + (Math.random() - 0.5) * this.cellSize,
                y: centerY + (Math.random() - 0.5) * this.cellSize,
                vx: (Math.random() - 0.5) * 2,
                vy: -2 - Math.random() * 2,
                color: '#333333',
                size: 8 + Math.random() * 8,
                life: 1.0,
                decay: 0.01,
                smoke: true
            });
        }
    }
    
    /**
     * Freeze animation
     */
    triggerFreezeAnimation(player) {
        // Ice blue particles across the screen
        for (let i = 0; i < 30; i++) {
            this.particles.push({
                x: Math.random() * this.logicalWidth,
                y: -20,
                vx: (Math.random() - 0.5) * 2,
                vy: 2 + Math.random() * 2,
                color: '#03A9F4',
                size: 3 + Math.random() * 4,
                life: 1.0,
                decay: 0.01,
                spark: true
            });
        }
    }
    
    /**
     * Score swap animation
     */
    triggerSwapAnimation() {
        this.shakeIntensity = 8;
        this.screenPulse = 1;
        
        // Swirling particles
        for (let i = 0; i < 40; i++) {
            const angle = (Math.PI * 2 * i) / 40;
            const radius = 50 + Math.random() * 50;
            
            this.particles.push({
                x: this.logicalWidth / 2 + Math.cos(angle) * radius,
                y: this.logicalHeight / 2 + Math.sin(angle) * radius,
                vx: Math.cos(angle + Math.PI / 2) * 3,
                vy: Math.sin(angle + Math.PI / 2) * 3,
                color: '#673AB7',
                size: 3 + Math.random() * 3,
                life: 1.0,
                decay: 0.015,
                trail: []
            });
        }
    }
    
    /**
     * Reverse turn order animation
     */
    triggerReverseAnimation() {
        this.screenPulse = 0.5;
        
        // Spinning arrow particles
        for (let i = 0; i < 20; i++) {
            const angle = (Math.PI * 2 * i) / 20;
            
            this.particles.push({
                x: this.logicalWidth / 2,
                y: this.logicalHeight / 2,
                vx: Math.cos(angle) * 4,
                vy: Math.sin(angle) * 4,
                color: '#E91E63',
                size: 4,
                life: 1.0,
                decay: 0.02,
                trail: []
            });
        }
    }
    
    /**
     * Chaos storm - redistribute squares
     */
    triggerChaosStorm() {
        // Get all squares
        const allSquares = Object.keys(this.squares);
        
        // Shuffle ownership
        const players = allSquares.map(key => this.squares[key]);
        for (let i = players.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [players[i], players[j]] = [players[j], players[i]];
        }
        
        // Reassign
        allSquares.forEach((key, i) => {
            this.squares[key] = players[i];
        });
        
        // Recalculate scores
        this.scores = { 1: 0, 2: 0 };
        Object.values(this.squares).forEach(player => {
            this.scores[player]++;
        });
        
        // Big visual effect
        this.shakeIntensity = 12;
        this.screenPulse = 1.5;
        
        // Tornado particles
        for (let i = 0; i < 60; i++) {
            const angle = (Math.PI * 2 * i) / 60;
            const radius = 30 + i * 2;
            
            this.particles.push({
                x: this.logicalWidth / 2 + Math.cos(angle) * radius,
                y: this.logicalHeight / 2 + Math.sin(angle) * radius,
                vx: Math.cos(angle + Math.PI / 2) * 5,
                vy: Math.sin(angle + Math.PI / 2) * 5 - 1,
                color: '#FF5722',
                size: 3 + Math.random() * 3,
                life: 1.0,
                decay: 0.015,
                trail: []
            });
        }
    }
    
    /**
     * Generic powerup particles
     */
    triggerPowerupParticles(squareKey, color) {
        const { row, col } = this.parseSquareKey(squareKey);
        const centerX = this.offsetX + (col + 0.5) * this.cellSize;
        const centerY = this.offsetY + (row + 0.5) * this.cellSize;
        
        for (let i = 0; i < 25; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 3;
            
            this.particles.push({
                x: centerX,
                y: centerY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1,
                color: color,
                size: 3 + Math.random() * 3,
                life: 1.0,
                decay: 0.015,
                spark: true,
                trail: []
            });
        }
    }
    
    /**
     * Shield activation animation
     */
    triggerShieldAnimation(player) {
        this.effectAnimations.push({
            type: 'shield',
            player,
            startTime: Date.now(),
            duration: 2000
        });
        
        // Blue shield particles
        for (let i = 0; i < 30; i++) {
            const angle = Math.random() * Math.PI * 2;
            
            this.particles.push({
                x: this.logicalWidth / 2,
                y: this.logicalHeight / 2,
                vx: Math.cos(angle) * 2,
                vy: Math.sin(angle) * 2,
                color: '#3F51B5',
                size: 4,
                life: 1.0,
                decay: 0.02,
                spark: true
            });
        }
    }
    
    /**
     * Lightning strike animation
     */
    triggerLightningAnimation() {
        this.screenPulse = 1;
        this.shakeIntensity = 5;
        
        // Yellow electric particles
        for (let i = 0; i < 40; i++) {
            this.particles.push({
                x: Math.random() * this.logicalWidth,
                y: 0,
                vx: (Math.random() - 0.5) * 4,
                vy: 5 + Math.random() * 5,
                color: '#FFEB3B',
                size: 2 + Math.random() * 3,
                life: 1.0,
                decay: 0.03,
                spark: true,
                trail: []
            });
        }
    }
    
    /**
     * Gift animation
     */
    triggerGiftAnimation(recipient) {
        // Hearts floating up
        for (let i = 0; i < 15; i++) {
            this.particles.push({
                x: this.logicalWidth / 2 + (Math.random() - 0.5) * 100,
                y: this.logicalHeight / 2,
                vx: (Math.random() - 0.5) * 2,
                vy: -2 - Math.random() * 2,
                color: '#E91E63',
                size: 4,
                life: 1.0,
                decay: 0.015,
                spark: true
            });
        }
    }
    
    /**
     * Steal territory animation
     */
    triggerStealAnimation(squareKey) {
        const { row, col } = this.parseSquareKey(squareKey);
        const centerX = this.offsetX + (col + 0.5) * this.cellSize;
        const centerY = this.offsetY + (row + 0.5) * this.cellSize;
        
        this.shakeIntensity = 5;
        
        // Pirate-themed particles
        for (let i = 0; i < 30; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 3;
            
            this.particles.push({
                x: centerX,
                y: centerY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: '#2196F3',
                size: 3 + Math.random() * 3,
                life: 1.0,
                decay: 0.02,
                trail: []
            });
        }
    }
    
    /**
     * Wildcard animation (rainbow!)
     */
    triggerWildcardAnimation(squareKey) {
        const { row, col } = this.parseSquareKey(squareKey);
        const centerX = this.offsetX + (col + 0.5) * this.cellSize;
        const centerY = this.offsetY + (row + 0.5) * this.cellSize;
        
        this.screenPulse = 1;
        
        // Rainbow particles
        const colors = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#8B00FF'];
        for (let i = 0; i < 40; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 4;
            
            this.particles.push({
                x: centerX,
                y: centerY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: 3 + Math.random() * 4,
                life: 1.0,
                decay: 0.015,
                spark: true,
                trail: []
            });
        }
    }
    
    draw() {
        // Use logical dimensions for clearRect since context is scaled by DPR
        this.ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight);
        
        // Phase 3: Draw dynamic background gradient
        this.drawDynamicBackground();
        
        // Phase 3: Draw ambient particles (behind everything)
        this.drawAmbientParticles();
        
        // Apply screen shake (Phase 1.3) and screen pulse (Phase 5)
        this.ctx.save();
        if (this.shakeIntensity > 0.1) {
            this.ctx.translate(
                (Math.random() - 0.5) * this.shakeIntensity,
                (Math.random() - 0.5) * this.shakeIntensity
            );
        }
        
        // Phase 5: Screen pulse effect for epic combos
        if (this.screenPulse > 0) {
            const pulseScale = 1 + this.screenPulse * 0.02;
            const centerX = this.logicalWidth / 2;
            const centerY = this.logicalHeight / 2;
            this.ctx.translate(centerX, centerY);
            this.ctx.scale(pulseScale, pulseScale);
            this.ctx.translate(-centerX, -centerY);
        }

        // Draw touch visuals (before other elements)
        this.drawTouchVisuals();
        
        // Draw hover preview line (Phase 1.4)
        this.drawHoverPreview();
        
        // Phase 2: Draw selection ribbon (flowing bezier)
        this.drawSelectionRibbon();
        
        // Phase 5: Draw combo flash overlay
        this.drawComboFlash();

        // Draw lines
        for (const lineKey of this.lines) {
            // Skip lines that are currently being animated
            if (this.lineDrawings.some(anim => anim.lineKey === lineKey)) {
                continue;
            }
            
            const [start, end] = this.parseLineKey(lineKey);

            const pulsating = this.pulsatingLines.find(p => p.line === lineKey);
            const player = pulsating?.player || this.getLinePlayer(lineKey);

            // Use populate color for player 3, otherwise use player 1 or 2 colors
            this.ctx.strokeStyle = player === DotsAndBoxesGame.POPULATE_PLAYER_ID ? this.populateColor : 
                                   (player === 1 ? this.player1Color : this.player2Color);
            this.ctx.lineWidth = this.lineWidth;
            this.ctx.lineCap = 'round';

            this.ctx.beginPath();
            this.ctx.moveTo(
                this.offsetX + start.col * this.cellSize,
                this.offsetY + start.row * this.cellSize
            );
            this.ctx.lineTo(
                this.offsetX + end.col * this.cellSize,
                this.offsetY + end.row * this.cellSize
            );
            this.ctx.stroke();
        }
        
        // Draw animated lines (Phase 1.2 - Line Draw Animation)
        this.drawLineAnimations();
        
        // Draw invalid line flash (Phase 1.4)
        this.drawInvalidLineFlash();

        // Draw completed squares
        for (const [squareKey, player] of Object.entries(this.squares)) {
            const { row, col } = this.parseSquareKey(squareKey);
            const x = this.offsetX + col * this.cellSize;
            const y = this.offsetY + row * this.cellSize;

            this.ctx.fillStyle = player === 1 ? this.player1Color + '40' : this.player2Color + '40';
            this.ctx.fillRect(x, y, this.cellSize, this.cellSize);

            this.ctx.fillStyle = player === 1 ? this.player1Color : this.player2Color;
            // Scale font size based on cell size
            const fontSize = Math.max(8, Math.min(this.cellSize / 2, 20));
            this.ctx.font = `bold ${fontSize}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(player.toString(), x + this.cellSize / 2, y + this.cellSize / 2);
        }

        // Draw completed squares with animations
        this.drawSquaresWithAnimations();

        // Draw particles on top
        this.drawParticles();

        // Draw kiss emojis
        this.drawKissEmojis();
        
        // Draw multiplier animations
        this.drawMultiplierAnimations();

        // Draw all dots AFTER lines so they appear on top
        for (let row = 0; row < this.gridRows; row++) {
            for (let col = 0; col < this.gridCols; col++) {
                const x = this.offsetX + col * this.cellSize;
                const y = this.offsetY + row * this.cellSize;

                this.ctx.fillStyle = '#333';
                this.ctx.beginPath();
                this.ctx.arc(x, y, this.dotRadius, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }

        // Draw selected dot with enhanced visibility
        if (this.selectedDot) {
            const x = this.offsetX + this.selectedDot.col * this.cellSize;
            const y = this.offsetY + this.selectedDot.row * this.cellSize;

            const playerColor = this.currentPlayer === 1 ? this.player1Color : this.player2Color;
            
            // Extra outer glow for large displays (BenQ boards)
            const glowPulse = 1 + Math.sin(Date.now() / 150) * 0.3;
            this.ctx.strokeStyle = playerColor + '60'; // Semi-transparent
            this.ctx.lineWidth = 5;
            this.ctx.beginPath();
            this.ctx.arc(x, y, (this.dotRadius + 12) * glowPulse, 0, Math.PI * 2);
            this.ctx.stroke();
            
            // Outer pulsing ring
            const pulseScale = 1 + Math.sin(Date.now() / 200) * 0.2;
            this.ctx.strokeStyle = playerColor;
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.arc(x, y, (this.dotRadius + 8) * pulseScale, 0, Math.PI * 2);
            this.ctx.stroke();

            // Inner solid ring
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(x, y, this.dotRadius + 5, 0, Math.PI * 2);
            this.ctx.stroke();

            // Redraw the dot itself to ensure it's visible
            this.ctx.fillStyle = playerColor;
            this.ctx.beginPath();
            this.ctx.arc(x, y, this.dotRadius * 2, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // Restore context after screen shake
        this.ctx.restore();
    }

    drawTouchVisuals() {
        const now = Date.now();

        this.touchVisuals.forEach(tv => {
            const age = now - tv.startTime;
            const progress = age / tv.duration;
            const alpha = 1 - progress;
            const radius = 10 + progress * 15; // Scaled down from 20 + progress * 30

            this.ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.6})`;
            this.ctx.lineWidth = 1.5; // Scaled down from 3
            this.ctx.beginPath();
            this.ctx.arc(tv.x, tv.y, radius, 0, Math.PI * 2);
            this.ctx.stroke();

            // Inner dot
            this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
            this.ctx.beginPath();
            this.ctx.arc(tv.x, tv.y, 4, 0, Math.PI * 2); // Scaled down from 8
            this.ctx.fill();
        });
    }

    drawSquaresWithAnimations() {
        const now = Date.now();

        for (const squareKey in this.squares) {
            const player = this.squares[squareKey];
            const color = player === 1 ? this.player1Color : this.player2Color;
            const { row, col } = this.parseSquareKey(squareKey);

            const x = this.offsetX + col * this.cellSize;
            const y = this.offsetY + row * this.cellSize;

            // Check if this square has an active animation
            const animation = this.squareAnimations.find(a => a.squareKey === squareKey);

            if (animation) {
                const age = now - animation.startTime;
                const progress = age / animation.duration;

                // Easing function (ease-out-back)
                const easeProgress = 1 - Math.pow(1 - progress, 3);
                const scale = 0.3 + easeProgress * 0.7;
                const alpha = Math.min(progress * 2, 1);

                // Glow effect
                const glowIntensity = Math.sin(progress * Math.PI) * 0.5;
                this.ctx.shadowColor = color;
                this.ctx.shadowBlur = 20 * glowIntensity;

                // Draw scaled square
                this.ctx.save();
                this.ctx.translate(animation.centerX, animation.centerY);
                this.ctx.scale(scale, scale);
                this.ctx.translate(-animation.centerX, -animation.centerY);

                this.ctx.fillStyle = color + Math.floor(alpha * 0.25 * 255).toString(16).padStart(2, '0');
                this.ctx.fillRect(x, y, this.cellSize, this.cellSize);

                this.ctx.restore();
                this.ctx.shadowBlur = 0;
            } else {
                // Normal square rendering
                this.ctx.fillStyle = color + '40';
                this.ctx.fillRect(x, y, this.cellSize, this.cellSize);
            }

            // Draw player number
            this.ctx.fillStyle = color;
            this.ctx.font = `bold ${this.cellSize * 0.4}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(player, x + this.cellSize / 2, y + this.cellSize / 2);
            
            // Draw multiplier indicator if revealed
            if (this.revealedMultipliers.has(squareKey)) {
                const multiplierData = this.squareMultipliers[squareKey];
                if (multiplierData && multiplierData.type === 'multiplier') {
                    this.ctx.font = `bold ${this.cellSize * 0.25}px Arial`;
                    this.ctx.fillStyle = '#FFD700';
                    this.ctx.fillText(`x${multiplierData.value}`, x + this.cellSize / 2, y + this.cellSize * 0.75);
                }
            }
            
            // Draw tile effect indicator
            this.drawTileEffectIndicator(squareKey, x, y, player);
        }
        
        // Draw hidden effect shimmer for uncompleted squares (Oracle's Vision or hint)
        this.drawHiddenEffectShimmers();
    }
    
    /**
     * Draw tile effect indicator on a completed square
     */
    drawTileEffectIndicator(squareKey, x, y, player) {
        const effectData = this.tileEffects[squareKey];
        if (!effectData) return;
        
        const effect = effectData.effect;
        const isRevealed = this.revealedEffects.has(squareKey);
        const isActivated = this.activatedEffects.has(squareKey);
        
        // Update shimmer phase
        this.effectShimmer = (this.effectShimmer + 0.05) % (Math.PI * 2);
        
        if (!isRevealed) {
            // Hidden effect - show subtle shimmer to indicate something is there
            const shimmerAlpha = 0.3 + Math.sin(this.effectShimmer + x * 0.1) * 0.2;
            const shimmerColor = effectData.type === 'trap' ? '#FF6B6B' : '#6BCB77';
            
            // Draw mysterious glow
            this.ctx.save();
            this.ctx.shadowColor = shimmerColor;
            this.ctx.shadowBlur = 8 + Math.sin(this.effectShimmer) * 4;
            this.ctx.fillStyle = shimmerColor + Math.floor(shimmerAlpha * 80).toString(16).padStart(2, '0');
            this.ctx.beginPath();
            this.ctx.arc(x + this.cellSize / 2, y + this.cellSize / 2, this.cellSize * 0.15, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
            
            // Draw question mark
            this.ctx.font = `bold ${this.cellSize * 0.3}px Arial`;
            this.ctx.fillStyle = shimmerColor;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('?', x + this.cellSize / 2, y + this.cellSize * 0.3);
        } else if (!isActivated) {
            // Revealed but not activated - show icon with glow
            const pulseScale = 1 + Math.sin(this.effectShimmer * 2) * 0.1;
            
            this.ctx.save();
            this.ctx.shadowColor = effect.color;
            this.ctx.shadowBlur = 15;
            
            // Background circle
            this.ctx.fillStyle = effect.color + '40';
            this.ctx.beginPath();
            this.ctx.arc(x + this.cellSize / 2, y + this.cellSize * 0.7, this.cellSize * 0.25 * pulseScale, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Effect icon
            this.ctx.font = `${this.cellSize * 0.35 * pulseScale}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(effect.icon, x + this.cellSize / 2, y + this.cellSize * 0.7);
            
            // "Tap to activate" hint
            this.ctx.font = `${this.cellSize * 0.12}px Arial`;
            this.ctx.fillStyle = effect.color;
            this.ctx.fillText('TAP', x + this.cellSize / 2, y + this.cellSize * 0.9);
            
            this.ctx.restore();
        } else {
            // Activated - show faded icon
            this.ctx.globalAlpha = 0.4;
            this.ctx.font = `${this.cellSize * 0.25}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(effect.icon, x + this.cellSize / 2, y + this.cellSize * 0.75);
            this.ctx.globalAlpha = 1;
        }
    }
    
    /**
     * Draw shimmer effects on squares with hidden effects (Oracle's Vision)
     */
    drawHiddenEffectShimmers() {
        if (!this.oracleVisionActive) return;
        
        // Show all hidden effects during Oracle's Vision
        for (const squareKey in this.tileEffects) {
            if (this.squares[squareKey]) continue; // Only show on uncompleted squares
            if (this.revealedEffects.has(squareKey)) continue;
            
            const effectData = this.tileEffects[squareKey];
            const effect = effectData.effect;
            const { row, col } = this.parseSquareKey(squareKey);
            const x = this.offsetX + col * this.cellSize;
            const y = this.offsetY + row * this.cellSize;
            
            // Draw preview of hidden effect
            const pulseAlpha = 0.4 + Math.sin(this.effectShimmer) * 0.2;
            
            this.ctx.save();
            this.ctx.globalAlpha = pulseAlpha;
            this.ctx.shadowColor = effect.color;
            this.ctx.shadowBlur = 10;
            
            // Semi-transparent background
            this.ctx.fillStyle = effect.color + '30';
            this.ctx.fillRect(x, y, this.cellSize, this.cellSize);
            
            // Icon
            this.ctx.font = `${this.cellSize * 0.4}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(effect.icon, x + this.cellSize / 2, y + this.cellSize / 2);
            
            this.ctx.restore();
        }
    }

    drawParticles() {
        this.particles.forEach(p => {
            // Phase 2: Draw particle trails first
            if (p.trail && p.trail.length > 1 && !p.smoke) {
                for (let i = 0; i < p.trail.length - 1; i++) {
                    const trailAlpha = (i / p.trail.length) * p.life * 0.4;
                    const trailSize = p.size * (i / p.trail.length);
                    
                    this.ctx.fillStyle = p.color + Math.floor(trailAlpha * 255).toString(16).padStart(2, '0');
                    this.ctx.beginPath();
                    this.ctx.arc(p.trail[i].x, p.trail[i].y, trailSize, 0, Math.PI * 2);
                    this.ctx.fill();
                }
            }
            
            if (p.spark) {
                // Draw sparks with glow effect
                this.ctx.shadowColor = p.color;
                this.ctx.shadowBlur = 10;
                this.ctx.fillStyle = p.color + Math.floor(p.life * 255).toString(16).padStart(2, '0');
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.shadowBlur = 0;
            } else if (p.smoke) {
                // Draw smoke with transparency
                this.ctx.fillStyle = p.color + Math.floor(p.life * 128).toString(16).padStart(2, '0');
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.size * (1.5 - p.life * 0.5), 0, Math.PI * 2);
                this.ctx.fill();
            } else {
                // Regular particles
                this.ctx.fillStyle = p.color + Math.floor(p.life * 255).toString(16).padStart(2, '0');
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                this.ctx.fill();
            }
        });
    }

    drawKissEmojis() {
        const now = Date.now();
        
        this.kissEmojis.forEach(kiss => {
            const age = now - kiss.startTime;
            if (age < 0) return; // Not started yet (staggered)
            
            const progress = age / kiss.duration;
            
            if (progress >= 1) return;
            
            // Ease-out for scale (grow then shrink slightly)
            const scaleProgress = progress < 0.5 ? progress * 2 : 1;
            const scale = (kiss.scale || 1) * (0.5 + scaleProgress * 1.5);
            
            // Fade out in second half
            const alpha = progress < 0.5 ? 1 : 1 - ((progress - 0.5) * 2);
            
            // Move upward and sideways slightly for variety
            const yOffset = progress * -20;
            const xOffset = Math.sin(progress * Math.PI * 2) * 10;
            
            this.ctx.save();
            this.ctx.globalAlpha = alpha;
            this.ctx.font = `${this.cellSize * scale}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('💋', kiss.x + xOffset, kiss.y + yOffset);
            this.ctx.restore();
        });
    }
    
    drawMultiplierAnimations() {
        if (!this.multiplierAnimations) return;
        
        const now = Date.now();
        this.multiplierAnimations.forEach(anim => {
            const age = now - anim.startTime;
            const progress = age / anim.duration;
            
            if (progress >= 1) return;
            
            // Scale up and fade out
            const scale = 1 + progress * 2;
            const alpha = 1 - progress;
            
            // Upward movement
            const yOffset = -progress * 50;
            
            this.ctx.save();
            this.ctx.globalAlpha = alpha;
            
            // Draw multiplier text with glow
            this.ctx.shadowColor = '#FFD700';
            this.ctx.shadowBlur = 20;
            this.ctx.fillStyle = '#FFD700';
            this.ctx.font = `bold ${this.cellSize * scale}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(`x${anim.value}`, anim.centerX, anim.centerY + yOffset);
            
            this.ctx.shadowBlur = 0;
            this.ctx.restore();
        });
    }
    
    /**
     * Phase 3: Draw dynamic background gradient
     */
    drawDynamicBackground() {
        // Check theme for dark mode support
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        
        // Shift hue based on score differential
        const scoreDiff = this.scores[1] - this.scores[2];
        const targetHue = 220 + scoreDiff * 2; // Subtle shift
        this.backgroundHue += (targetHue - this.backgroundHue) * 0.02;
        
        const gradient = this.ctx.createRadialGradient(
            this.logicalWidth / 2, this.logicalHeight / 2, 0,
            this.logicalWidth / 2, this.logicalHeight / 2, Math.max(this.logicalWidth, this.logicalHeight)
        );
        
        if (isDark) {
            // Dark theme: darker background
            gradient.addColorStop(0, `hsla(${this.backgroundHue}, 20%, 12%, 0.3)`);
            gradient.addColorStop(1, `hsla(${this.backgroundHue + 30}, 15%, 8%, 0.2)`);
        } else {
            // Light theme: original light background
            gradient.addColorStop(0, `hsla(${this.backgroundHue}, 15%, 98%, 0.3)`);
            gradient.addColorStop(1, `hsla(${this.backgroundHue + 30}, 10%, 95%, 0.2)`);
        }
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
    }
    
    /**
     * Phase 3: Draw ambient floating particles
     */
    drawAmbientParticles() {
        const now = Date.now() / 1000;
        
        this.ambientParticles.forEach(p => {
            // Calculate sine wave offset for gentle floating motion
            const xOffset = Math.sin(now + p.phase) * 0.5;
            const yOffset = Math.cos(now * 0.7 + p.phase) * 0.3;
            
            this.ctx.fillStyle = `rgba(100, 100, 120, ${p.opacity})`;
            this.ctx.beginPath();
            this.ctx.arc(p.x + xOffset, p.y + yOffset, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }
    
    /**
     * Phase 2: Draw selection ribbon (flowing bezier curve)
     */
    drawSelectionRibbon() {
        if (!this.selectionRibbon || !this.selectedDot) return;
        
        const now = Date.now();
        const { targetX, targetY } = this.selectionRibbon;
        
        const startX = this.offsetX + this.selectedDot.col * this.cellSize;
        const startY = this.offsetY + this.selectedDot.row * this.cellSize;
        
        // Calculate control points for bezier curve (slight wave)
        const midX = (startX + targetX) / 2;
        const midY = (startY + targetY) / 2;
        const waveOffset = Math.sin(now / 200) * 10;
        
        const playerColor = this.currentPlayer === 1 ? this.player1Color : this.player2Color;
        
        this.ctx.save();
        this.ctx.strokeStyle = playerColor + '60';
        this.ctx.lineWidth = this.lineWidth * 1.5;
        this.ctx.lineCap = 'round';
        
        // Animated dash pattern
        const dashOffset = (now / 30) % 40;
        this.ctx.setLineDash([15, 25]);
        this.ctx.lineDashOffset = -dashOffset;
        
        // Draw bezier curve
        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.quadraticCurveTo(midX + waveOffset, midY - waveOffset, targetX, targetY);
        this.ctx.stroke();
        
        this.ctx.setLineDash([]);
        this.ctx.restore();
    }
    
    /**
     * Phase 5: Draw combo flash overlay
     */
    drawComboFlash() {
        if (!this.comboFlashActive) return;
        
        const playerColor = this.currentPlayer === 1 ? this.player1Color : this.player2Color;
        
        // Flash overlay
        this.ctx.save();
        this.ctx.fillStyle = playerColor + '15';
        this.ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
        this.ctx.restore();
        
        this.comboFlashActive = false;
    }
    
    /**
     * Update selection ribbon position for touch/mouse drag
     */
    updateSelectionRibbon(x, y) {
        if (!this.selectedDot) {
            this.selectionRibbon = null;
            return;
        }
        
        const dot = this.getNearestDot(x, y);
        if (dot && this.areAdjacent(this.selectedDot, dot)) {
            const lineKey = this.getLineKey(this.selectedDot, dot);
            if (!this.lines.has(lineKey)) {
                this.selectionRibbon = {
                    targetX: this.offsetX + dot.col * this.cellSize,
                    targetY: this.offsetY + dot.row * this.cellSize
                };
                return;
            }
        }
        
        // If not near a valid dot, show ribbon to cursor position
        this.selectionRibbon = { targetX: x, targetY: y };
    }
    
    /**
     * Easing function: ease-out-quad
     * @param {number} t - Progress 0-1
     * @returns {number} Eased value 0-1
     */
    easeOutQuad(t) {
        return t * (2 - t);
    }
    
    /**
     * Linear interpolation
     * @param {number} start - Start value
     * @param {number} end - End value
     * @param {number} t - Progress 0-1
     * @returns {number} Interpolated value
     */
    lerp(start, end, t) {
        return start + (end - start) * t;
    }
    
    /**
     * Draw animated lines (Phase 1.2 - Line Draw Animation)
     * Lines animate from start to end dot
     */
    drawLineAnimations() {
        const now = Date.now();
        
        this.lineDrawings.forEach(anim => {
            const age = now - anim.startTime;
            const progress = Math.min(age / anim.duration, 1);
            const easedProgress = this.easeOutQuad(progress);
            
            // Get start and end positions
            const startX = this.offsetX + anim.startDot.col * this.cellSize;
            const startY = this.offsetY + anim.startDot.row * this.cellSize;
            const endX = this.offsetX + anim.endDot.col * this.cellSize;
            const endY = this.offsetY + anim.endDot.row * this.cellSize;
            
            // Calculate current end position based on animation progress
            const currentEndX = this.lerp(startX, endX, easedProgress);
            const currentEndY = this.lerp(startY, endY, easedProgress);
            
            // Draw the animated line
            const player = anim.player;
            this.ctx.strokeStyle = player === DotsAndBoxesGame.POPULATE_PLAYER_ID ? this.populateColor : 
                                   (player === 1 ? this.player1Color : this.player2Color);
            this.ctx.lineWidth = this.lineWidth;
            this.ctx.lineCap = 'round';
            
            this.ctx.beginPath();
            this.ctx.moveTo(startX, startY);
            this.ctx.lineTo(currentEndX, currentEndY);
            this.ctx.stroke();
        });
    }
    
    /**
     * Trigger invalid line flash effect (Phase 1.4)
     * @param {Object} dot1 - First dot
     * @param {Object} dot2 - Second dot (non-adjacent)
     */
    triggerInvalidLineFlash(dot1, dot2) {
        this.invalidLineFlash = {
            dot1,
            dot2,
            startTime: Date.now(),
            duration: DotsAndBoxesGame.ANIMATION_INVALID_FLASH_DURATION
        };
        
        // Phase 6: Play invalid sound
        this.ensureAudioContext();
        this.playInvalidSound();
        
        // Haptic feedback on mobile
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
    }
    
    /**
     * Draw invalid line flash effect (Phase 1.4)
     */
    drawInvalidLineFlash() {
        if (!this.invalidLineFlash) return;
        
        const now = Date.now();
        const age = now - this.invalidLineFlash.startTime;
        const progress = age / this.invalidLineFlash.duration;
        
        if (progress >= 1) {
            this.invalidLineFlash = null;
            return;
        }
        
        const { dot1, dot2 } = this.invalidLineFlash;
        const x1 = this.offsetX + dot1.col * this.cellSize;
        const y1 = this.offsetY + dot1.row * this.cellSize;
        const x2 = this.offsetX + dot2.col * this.cellSize;
        const y2 = this.offsetY + dot2.row * this.cellSize;
        
        // Red flash with fade out
        const alpha = 1 - progress;
        this.ctx.save();
        this.ctx.strokeStyle = `rgba(255, 60, 60, ${alpha})`;
        this.ctx.lineWidth = this.lineWidth;
        this.ctx.lineCap = 'round';
        this.ctx.shadowColor = '#FF3C3C';
        this.ctx.shadowBlur = 15 * alpha;
        
        // Draw dashed line
        this.ctx.setLineDash([8, 8]);
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.restore();
    }
    
    /**
     * Draw hover preview line (Phase 1.4 - Dot Hover Preview)
     */
    drawHoverPreview() {
        if (!this.hoveredDot || !this.selectedDot) return;
        
        const x1 = this.offsetX + this.selectedDot.col * this.cellSize;
        const y1 = this.offsetY + this.selectedDot.row * this.cellSize;
        const x2 = this.offsetX + this.hoveredDot.col * this.cellSize;
        const y2 = this.offsetY + this.hoveredDot.row * this.cellSize;
        
        const playerColor = this.currentPlayer === 1 ? this.player1Color : this.player2Color;
        
        this.ctx.save();
        this.ctx.strokeStyle = playerColor + '40'; // 25% opacity
        this.ctx.lineWidth = this.lineWidth;
        this.ctx.lineCap = 'round';
        
        // Flowing dash animation
        const dashOffset = (Date.now() / 50) % 20;
        this.ctx.setLineDash([10, 10]);
        this.ctx.lineDashOffset = -dashOffset;
        
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
        
        this.ctx.setLineDash([]);
        this.ctx.restore();
    }
    
    getLinePlayer(lineKey) {
        // Use stored line ownership for persistent color
        return this.lineOwners.get(lineKey) || 1;
    }

    animate() {
        // Phase 4: Update particles with enhanced physics
        this.particles = this.particles.filter(p => {
            // Phase 2: Update trail history
            if (!p.trail) p.trail = [];
            p.trail.push({ x: p.x, y: p.y });
            if (p.trail.length > DotsAndBoxesGame.PARTICLE_TRAIL_LENGTH) {
                p.trail.shift();
            }
            
            // Phase 4: Air resistance
            p.vx *= 0.98;
            p.vy *= 0.98;
            
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.15; // Gravity
            
            // Phase 4: Bounce at bottom boundary
            if (p.y > this.logicalHeight - 10 && !p.smoke) {
                p.y = this.logicalHeight - 10;
                p.vy *= -0.5; // Bounce with energy loss
                p.vx *= 0.8; // Friction on bounce
            }
            
            p.life -= p.decay;
            return p.life > 0;
        });
        
        // Phase 3: Update ambient particles
        this.ambientParticles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            
            // Wrap at boundaries
            if (p.x < -10) p.x = this.logicalWidth + 10;
            if (p.x > this.logicalWidth + 10) p.x = -10;
            if (p.y < -10) p.y = this.logicalHeight + 10;
            if (p.y > this.logicalHeight + 10) p.y = -10;
        });

        // Clean up old animations
        const now = Date.now();
        this.pulsatingLines = this.pulsatingLines.filter(pulsating =>
            now - pulsating.time < DotsAndBoxesGame.ANIMATION_PULSATING_DURATION
        );
        this.squareAnimations = this.squareAnimations.filter(anim =>
            now - anim.startTime < anim.duration
        );
        this.touchVisuals = this.touchVisuals.filter(tv =>
            now - tv.startTime < tv.duration
        );
        this.kissEmojis = this.kissEmojis.filter(kiss =>
            now - kiss.startTime < kiss.duration
        );
        
        // Clean up multiplier animations
        if (this.multiplierAnimations) {
            this.multiplierAnimations = this.multiplierAnimations.filter(anim =>
                now - anim.startTime < anim.duration
            );
        }
        
        // Clean up line draw animations (Phase 1.2)
        this.lineDrawings = this.lineDrawings.filter(anim =>
            now - anim.startTime < anim.duration
        );
        
        // Clean up invalid line flash (Phase 1.4)
        if (this.invalidLineFlash && (now - this.invalidLineFlash.startTime >= this.invalidLineFlash.duration)) {
            this.invalidLineFlash = null;
        }
        
        // Decay screen shake (Phase 1.3)
        if (this.shakeIntensity > 0.1) {
            this.shakeIntensity *= this.shakeDecay;
        } else {
            this.shakeIntensity = 0;
        }
        
        // Phase 5: Decay screen pulse
        if (this.screenPulse > 0.01) {
            this.screenPulse *= 0.92;
        } else {
            this.screenPulse = 0;
        }
        
        // Update UI continuously for score animation
        this.updateUI();

        // Check if redraw is needed (animations or selected dot)
        const needsRedraw = this.particles.length > 0 || 
            this.squareAnimations.length > 0 || 
            this.touchVisuals.length > 0 || 
            this.kissEmojis.length > 0 ||
            this.pulsatingLines.length > 0 ||
            (this.multiplierAnimations && this.multiplierAnimations.length > 0) ||
            this.lineDrawings.length > 0 ||
            this.invalidLineFlash ||
            this.shakeIntensity > 0 ||
            this.screenPulse > 0 ||
            this.hoveredDot ||
            this.selectionRibbon ||
            this.selectedDot ||
            this.ambientParticles.length > 0; // Always redraw for ambient particles

        // Redraw only if needed
        if (needsRedraw) {
            this.draw();
        }

        requestAnimationFrame(() => this.animate());
    }

    updateUI() {
        // Animate score counting
        const player1ScoreDiff = this.scores[1] - this.displayedScores[1];
        const player2ScoreDiff = this.scores[2] - this.displayedScores[2];
        
        // Only update scores if animating
        const scoresAnimating = Math.abs(player1ScoreDiff) > 0.1 || Math.abs(player2ScoreDiff) > 0.1;
        
        if (Math.abs(player1ScoreDiff) > 0.1) {
            this.displayedScores[1] += player1ScoreDiff * this.scoreAnimationSpeed;
        } else {
            this.displayedScores[1] = this.scores[1];
        }
        
        if (Math.abs(player2ScoreDiff) > 0.1) {
            this.displayedScores[2] += player2ScoreDiff * this.scoreAnimationSpeed;
        } else {
            this.displayedScores[2] = this.scores[2];
        }
        
        // Throttle DOM updates for performance
        const now = Date.now();
        if (now - this.lastUIUpdate < this.uiUpdateInterval && !scoresAnimating) {
            return;
        }
        this.lastUIUpdate = now;
        
        // Use cached DOM elements
        const { player1Score, player2Score, player1Info, player2Info, turnIndicator } = this.domCache;
        
        player1Score.textContent = Math.floor(this.displayedScores[1]);
        player2Score.textContent = Math.floor(this.displayedScores[2]);

        player1Info.classList.toggle('active', this.currentPlayer === 1);
        player2Info.classList.toggle('active', this.currentPlayer === 2);

        player1Info.style.color = this.player1Color;
        player2Info.style.color = this.player2Color;

        // Update turn indicator with multiplayer awareness
        if (this.isMultiplayer) {
            this.isMyTurn = this.currentPlayer === this.myPlayerNumber;
            turnIndicator.textContent = this.isMyTurn ? "Your Turn" : "Opponent's Turn";
        } else {
            turnIndicator.textContent = `Player ${this.currentPlayer}'s Turn`;
        }
        turnIndicator.style.color = this.currentPlayer === 1 ? this.player1Color : this.player2Color;
    }

    checkGameOver() {
        const totalSquares = (this.gridRows - 1) * (this.gridCols - 1);
        const completedSquares = Object.keys(this.squares).length;

        if (completedSquares === totalSquares) {
            setTimeout(() => this.showWinner(), 500);
        }
    }

    isGameOver() {
        const totalSquares = (this.gridRows - 1) * (this.gridCols - 1);
        const completedSquares = Object.keys(this.squares).length;
        return completedSquares === totalSquares;
    }
    
    /**
     * Get all possible lines (connections between adjacent dots)
     * @returns {Array} Array of line keys
     */
    getAllPossibleLines() {
        const allLines = [];
        
        // Generate all horizontal lines
        for (let row = 0; row < this.gridRows; row++) {
            for (let col = 0; col < this.gridCols - 1; col++) {
                const dot1 = { row, col };
                const dot2 = { row, col: col + 1 };
                allLines.push(this.getLineKey(dot1, dot2));
            }
        }
        
        // Generate all vertical lines
        for (let row = 0; row < this.gridRows - 1; row++) {
            for (let col = 0; col < this.gridCols; col++) {
                const dot1 = { row, col };
                const dot2 = { row: row + 1, col };
                allLines.push(this.getLineKey(dot1, dot2));
            }
        }
        
        return allLines;
    }
    
    /**
     * Check if drawing a line would complete any square
     * @param {string} lineKey - The line to check
     * @returns {boolean} True if the line would complete a square
     */
    wouldCompleteSquare(lineKey) {
        // Parse the line
        const [start, end] = lineKey.split('-').map(s => {
            const [row, col] = s.split(',').map(Number);
            return { row, col };
        });
        
        const isHorizontal = start.row === end.row;
        
        // Temporarily add the line to check
        this.lines.add(lineKey);
        
        let wouldComplete = false;
        
        if (isHorizontal) {
            // Check square above
            if (start.row > 0) {
                if (this.isSquareComplete(start.row - 1, Math.min(start.col, end.col))) {
                    wouldComplete = true;
                }
            }
            // Check square below
            if (!wouldComplete && start.row < this.gridRows - 1) {
                if (this.isSquareComplete(start.row, Math.min(start.col, end.col))) {
                    wouldComplete = true;
                }
            }
        } else {
            // Check square to the left
            if (start.col > 0) {
                if (this.isSquareComplete(Math.min(start.row, end.row), start.col - 1)) {
                    wouldComplete = true;
                }
            }
            // Check square to the right
            if (!wouldComplete && start.col < this.gridCols - 1) {
                if (this.isSquareComplete(Math.min(start.row, end.row), start.col)) {
                    wouldComplete = true;
                }
            }
        }
        
        // Remove the temporary line
        this.lines.delete(lineKey);
        
        return wouldComplete;
    }
    
    /**
     * Get all available lines that don't complete a square
     * @returns {Array} Array of safe line keys
     */
    getSafeLines() {
        const allPossibleLines = this.getAllPossibleLines();
        const safeLines = [];
        
        for (const lineKey of allPossibleLines) {
            // Skip lines that are already drawn
            if (this.lines.has(lineKey)) {
                continue;
            }
            
            // Check if this line would complete a square
            if (!this.wouldCompleteSquare(lineKey)) {
                safeLines.push(lineKey);
            }
        }
        
        return safeLines;
    }
    
    /**
     * Handle populate button click
     * Randomly connects 10% of available safe lines using a random 3rd color
     */
    handlePopulate() {
        const safeLines = this.getSafeLines();
        
        if (safeLines.length === 0) {
            this.updatePopulateButtonVisibility();
            return;
        }
        
        // Calculate 10% of safe lines (at least 1 if any exist)
        const lineCount = Math.max(1, Math.floor(safeLines.length * 0.1));
        
        // Shuffle and select random lines
        const shuffled = safeLines.sort(() => Math.random() - 0.5);
        const selectedLines = shuffled.slice(0, lineCount);
        
        // Draw the selected lines with player 3 (populate color)
        selectedLines.forEach(lineKey => {
            const [dot1, dot2] = this.parseLineKey(lineKey);
            
            // Add the line without triggering game logic
            this.lines.add(lineKey);
            this.lineOwners.set(lineKey, DotsAndBoxesGame.POPULATE_PLAYER_ID); // Use populate player ID
            this.pulsatingLines.push({
                line: lineKey,
                player: DotsAndBoxesGame.POPULATE_PLAYER_ID, // Use populate player ID
                time: Date.now()
            });
        });
        
        // Don't change turns - keep current player
        // Redraw the board
        this.draw();
        
        // Update button visibility
        this.updatePopulateButtonVisibility();
    }
    
    /**
     * Update populate button visibility based on available safe lines
     */
    updatePopulateButtonVisibility() {
        const populateBtn = this.domCache.populateBtn;
        if (!populateBtn) return;
        
        const safeLines = this.getSafeLines();
        
        if (safeLines.length === 0) {
            populateBtn.classList.add('hidden');
        } else {
            populateBtn.classList.remove('hidden');
        }
    }

    showWinner() {
        const winner = this.scores[1] > this.scores[2] ? 1 :
            this.scores[2] > this.scores[1] ? 2 : 0;

        const winnerColor = winner === 1 ? this.player1Color : 
                           winner === 2 ? this.player2Color : '#FFD700';
        
        // Phase 6: Play victory sound
        this.playVictorySound();
        
        // Build winner display
        const winnerScreen = document.getElementById('winnerScreen');
        const winnerText = document.getElementById('winnerText');
        const finalScores = document.getElementById('finalScores');
        
        // Set winner text with trophy
        if (winner === 0) {
            winnerText.innerHTML = `🤝 It's a Tie! 🤝`;
            winnerText.style.color = '#FFD700';
        } else {
            winnerText.innerHTML = `🏆 Player ${winner} Wins! 🏆`;
            winnerText.style.color = winnerColor;
        }
        
        // Build final scores display
        const players = [
            { num: 1, score: this.scores[1], color: this.player1Color },
            { num: 2, score: this.scores[2], color: this.player2Color }
        ].sort((a, b) => b.score - a.score);
        
        finalScores.innerHTML = players.map((p, i) => `
            <div class="final-score-entry ${p.num === winner ? 'winner' : ''}">
                <span class="final-score-rank">${i === 0 ? '🥇' : '🥈'}</span>
                <div class="final-score-color" style="background-color: ${p.color}"></div>
                <span class="final-score-name">Player ${p.num}</span>
                <span class="final-score-points" style="color: ${p.color}">${p.score}</span>
            </div>
        `).join('');
        
        // Transition screens
        document.getElementById('gameScreen').classList.remove('active');
        winnerScreen.classList.add('active');
        
        // Launch confetti celebration
        this.launchConfetti(winnerColor);
        
        // Phase 5: Launch fireworks for winner
        this.launchFireworks(winnerColor);
    }
    
    /**
     * Phase 5: Launch fireworks celebration animation
     * @param {string} accentColor - Primary color for fireworks
     */
    launchFireworks(accentColor) {
        const canvas = document.createElement('canvas');
        canvas.id = 'fireworksCanvas';
        canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10000;';
        document.body.appendChild(canvas);
        
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        const fireworks = [];
        const particles = [];
        const colors = [accentColor, '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1'];
        
        // Launch fireworks periodically
        let launchCount = 0;
        const launchInterval = setInterval(() => {
            if (launchCount >= 8) {
                clearInterval(launchInterval);
                return;
            }
            
            fireworks.push({
                x: canvas.width * (0.2 + Math.random() * 0.6),
                y: canvas.height,
                targetY: canvas.height * (0.2 + Math.random() * 0.3),
                vy: -12 - Math.random() * 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                exploded: false
            });
            launchCount++;
        }, 400);
        
        const animate = () => {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Update fireworks
            fireworks.forEach((fw, i) => {
                if (!fw.exploded) {
                    fw.y += fw.vy;
                    fw.vy += 0.2; // Gravity
                    
                    // Draw trail
                    ctx.beginPath();
                    ctx.arc(fw.x, fw.y, 3, 0, Math.PI * 2);
                    ctx.fillStyle = fw.color;
                    ctx.fill();
                    
                    // Explode at target
                    if (fw.y <= fw.targetY || fw.vy >= 0) {
                        fw.exploded = true;
                        
                        // Create explosion particles
                        for (let j = 0; j < 40; j++) {
                            const angle = (Math.PI * 2 * j) / 40;
                            const speed = 3 + Math.random() * 4;
                            particles.push({
                                x: fw.x,
                                y: fw.y,
                                vx: Math.cos(angle) * speed,
                                vy: Math.sin(angle) * speed,
                                color: fw.color,
                                life: 1,
                                decay: 0.015 + Math.random() * 0.01
                            });
                        }
                    }
                }
            });
            
            // Update particles
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.08; // Gravity
                p.vx *= 0.98; // Air resistance
                p.life -= p.decay;
                
                if (p.life > 0) {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
                    ctx.fillStyle = p.color + Math.floor(p.life * 255).toString(16).padStart(2, '0');
                    ctx.fill();
                } else {
                    particles.splice(i, 1);
                }
            }
            
            // Continue animation if there are still particles or fireworks
            if (particles.length > 0 || fireworks.some(f => !f.exploded)) {
                requestAnimationFrame(animate);
            } else {
                setTimeout(() => canvas.remove(), 1000);
            }
        };
        
        animate();
    }
    
    /**
     * Launch confetti celebration animation
     * @param {string} accentColor - Primary color for confetti
     */
    launchConfetti(accentColor) {
        const canvas = document.createElement('canvas');
        canvas.id = 'confettiCanvas';
        canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10001;';
        document.body.appendChild(canvas);
        
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        const confetti = [];
        const colors = [accentColor, '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96E6A1', '#DDA0DD', '#F7DC6F'];
        
        // Create confetti particles
        for (let i = 0; i < 150; i++) {
            confetti.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height - canvas.height,
                w: Math.random() * 10 + 5,
                h: Math.random() * 6 + 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                vx: Math.random() * 4 - 2,
                vy: Math.random() * 3 + 2,
                rotation: Math.random() * 360,
                rotationSpeed: Math.random() * 10 - 5,
                oscillationSpeed: Math.random() * 0.05 + 0.02,
                oscillationDistance: Math.random() * 40 + 20,
                startX: 0
            });
            confetti[i].startX = confetti[i].x;
        }
        
        let frame = 0;
        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            let activeCount = 0;
            confetti.forEach(c => {
                if (c.y < canvas.height + 50) {
                    activeCount++;
                    c.y += c.vy;
                    c.x = c.startX + Math.sin(frame * c.oscillationSpeed) * c.oscillationDistance;
                    c.rotation += c.rotationSpeed;
                    
                    ctx.save();
                    ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
                    ctx.rotate(c.rotation * Math.PI / 180);
                    ctx.fillStyle = c.color;
                    ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
                    ctx.restore();
                }
            });
            
            frame++;
            
            if (activeCount > 0 && frame < 300) {
                requestAnimationFrame(animate);
            } else {
                canvas.remove();
            }
        };
        
        animate();
    }
}

let game = null;
