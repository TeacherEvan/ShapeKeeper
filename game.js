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
    
    // Particle constants
    static PARTICLE_COUNT_SQUARE = 15;
    static PARTICLE_COUNT_MULTIPLIER_SPARKS = 30;
    static PARTICLE_COUNT_MULTIPLIER_SMOKE = 10;
    
    // Kiss emoji constants (reduced for performance)
    static KISS_EMOJI_MIN = 5;
    static KISS_EMOJI_MAX = 8;
    
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
        
        // Score multiplier system
        this.squareMultipliers = {}; // Store multipliers for each square
        this.revealedMultipliers = new Set(); // Track which squares have been clicked
        
        // Animated score counters
        this.displayedScores = { 1: 0, 2: 0 }; // Scores currently displayed (animated)
        this.scoreAnimationSpeed = 0.1; // How fast scores count up

        this.setupCanvas();
        this.initializeMultipliers(); // Initialize multipliers AFTER grid dimensions are set
        this.setupEventListeners();
        this.draw();
        this.updateUI();
        this.animate();
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
        
        // Initial check for populate button visibility
        this.updatePopulateButtonVisibility();
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
        if (dot && this.selectedDot && this.areAdjacent(this.selectedDot, dot)) {
            this.canvas.style.cursor = 'pointer';
        } else if (dot) {
            this.canvas.style.cursor = 'pointer';
        } else {
            this.canvas.style.cursor = 'default';
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

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Check if clicking on a completed square to reveal multiplier
        const clickedSquare = this.getSquareAtPosition(x, y);
        if (clickedSquare && this.squares[clickedSquare] && !this.revealedMultipliers.has(clickedSquare)) {
            this.revealMultiplier(clickedSquare);
            return;
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
                // Clicked non-adjacent dot - select the new dot
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
    
    revealMultiplier(squareKey) {
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
     * Consolidated method for drawing a line between two dots
     * Handles score updates, animations, and turn switching
     */
    drawLine(dot1, dot2) {
        const lineKey = this.getLineKey(dot1, dot2);

        if (!this.lines.has(lineKey)) {
            this.lines.add(lineKey);
            this.lineOwners.set(lineKey, this.currentPlayer); // Store line ownership permanently
            this.pulsatingLines.push({
                line: lineKey,
                player: this.currentPlayer,
                time: Date.now()
            });

            const completedSquares = this.checkForSquares(lineKey);

            if (completedSquares.length === 0) {
                this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
            } else {
                this.scores[this.currentPlayer] += completedSquares.length;
                completedSquares.forEach(squareKey => {
                    this.triggerSquareAnimation(squareKey);
                });
            }

            this.updateUI();
            this.checkGameOver();
            
            // Update populate button visibility
            this.updatePopulateButtonVisibility();
            
            // Clear selection and unlock after drawing line
            this.selectedDot = null;
            this.selectionLocked = false;
        }
    }

    handleTouchStart(e) {
        e.preventDefault();

        // Mark that we're handling touch events
        this.lastTouchTime = Date.now();

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

            // Check if tapping on a completed square to reveal multiplier
            const clickedSquare = this.getSquareAtPosition(x, y);
            if (clickedSquare && this.squares[clickedSquare] && !this.revealedMultipliers.has(clickedSquare)) {
                this.revealMultiplier(clickedSquare);
                this.activeTouches.delete(touch.identifier);
                continue;
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
                            // Non-adjacent dot tapped - select the new dot
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
    
    draw() {
        // Use logical dimensions for clearRect since context is scaled by DPR
        this.ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight);

        // Draw touch visuals (before other elements)
        this.drawTouchVisuals();

        // Draw lines
        for (const lineKey of this.lines) {
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
        }
    }

    drawParticles() {
        this.particles.forEach(p => {
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
    
    getLinePlayer(lineKey) {
        // Use stored line ownership for persistent color
        return this.lineOwners.get(lineKey) || 1;
    }

    animate() {
        // Update particles
        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.15; // Gravity
            p.life -= p.decay;
            return p.life > 0;
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
        
        // Update UI continuously for score animation
        this.updateUI();

        // Check if redraw is needed (animations or selected dot)
        const needsRedraw = this.particles.length > 0 || 
            this.squareAnimations.length > 0 || 
            this.touchVisuals.length > 0 || 
            this.kissEmojis.length > 0 ||
            this.pulsatingLines.length > 0 ||
            (this.multiplierAnimations && this.multiplierAnimations.length > 0) ||
            this.selectedDot;

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
        
        document.getElementById('player1Score').textContent = Math.floor(this.displayedScores[1]);
        document.getElementById('player2Score').textContent = Math.floor(this.displayedScores[2]);

        document.getElementById('player1Info').classList.toggle('active', this.currentPlayer === 1);
        document.getElementById('player2Info').classList.toggle('active', this.currentPlayer === 2);

        document.getElementById('player1Info').style.color = this.player1Color;
        document.getElementById('player2Info').style.color = this.player2Color;

        document.getElementById('turnIndicator').textContent = `Player ${this.currentPlayer}'s Turn`;
        document.getElementById('turnIndicator').style.color = this.currentPlayer === 1 ? this.player1Color : this.player2Color;
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
        const populateBtn = document.getElementById('populateBtn');
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

        const winnerText = winner === 0 ? "It's a Tie!" :
            `Player ${winner} Wins! (${this.scores[winner]} - ${this.scores[winner === 1 ? 2 : 1]})`;

        document.getElementById('winnerText').textContent = winnerText;
        document.getElementById('gameScreen').classList.remove('active');
        document.getElementById('winnerScreen').classList.add('active');
    }
}

let game = null;
