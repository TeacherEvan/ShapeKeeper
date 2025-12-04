'use strict';

/**
 * ShapeKeeper Welcome Screen Animation
 * Implements flocking behavior (boids algorithm) with spatial partitioning for performance
 * 
 * TODO: [OPTIMIZATION] Consider using Web Workers for particle physics calculations
 * TODO: [OPTIMIZATION] Implement offscreen canvas for particle pre-rendering
 * @module WelcomeAnimation
 */

class WelcomeAnimation {
    constructor() {
        this.canvas = document.getElementById('welcomeCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.floatingParticles = []; // Renamed from 'dots' for semantic clarity
        this.particleCount = 150; // Total number of particles in animation
        this.animationFrameId = null; // Renamed for clarity
        this.isDimmed = false;
        this.spatialPartitionGrid = null; // Renamed for clarity
        this.partitionCellSize = 100; // Size of each cell in spatial grid
        
        this.initializeCanvas();
        this.createParticles();
        this.startAnimationLoop();
        
        // Handle window resize with debounced callback
        window.addEventListener('resize', () => this.handleViewportResize());
    }
    
    /**
     * Initialize canvas dimensions and spatial partitioning
     */
    initializeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.initializeSpatialPartitioning();
    }
    
    /**
     * Handle viewport resize events
     */
    handleViewportResize() {
        this.initializeCanvas();
    }
    
    /**
     * Initialize spatial partitioning grid for performance optimization
     * Reduces O(n²) neighbor lookups to O(n)
     */
    initializeSpatialPartitioning() {
        this.gridCols = Math.ceil(this.canvas.width / this.partitionCellSize);
        this.gridRows = Math.ceil(this.canvas.height / this.partitionCellSize);
        this.spatialPartitionGrid = Array(this.gridRows).fill(null).map(() => 
            Array(this.gridCols).fill(null).map(() => [])
        );
    }
    
    /**
     * Update spatial partition grid with current particle positions
     */
    updateSpatialPartitionGrid() {
        // Clear grid
        for (let row of this.spatialPartitionGrid) {
            for (let cell of row) {
                cell.length = 0;
            }
        }
        
        // Assign particles to grid cells
        for (let particle of this.floatingParticles) {
            const gridX = Math.floor(particle.x / this.partitionCellSize);
            const gridY = Math.floor(particle.y / this.partitionCellSize);
            if (gridX >= 0 && gridX < this.gridCols && gridY >= 0 && gridY < this.gridRows) {
                this.spatialPartitionGrid[gridY][gridX].push(particle);
            }
        }
    }
    
    /**
     * Get neighboring particles within the spatial partition
     * @param {Object} particle - The particle to find neighbors for
     * @returns {Array} Array of neighboring particles
     */
    getNeighboringParticles(particle) {
        const gridX = Math.floor(particle.x / this.partitionCellSize);
        const gridY = Math.floor(particle.y / this.partitionCellSize);
        const neighbors = [];
        
        // Check surrounding cells (3x3 grid around particle)
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const nx = gridX + dx;
                const ny = gridY + dy;
                if (nx >= 0 && nx < this.gridCols && ny >= 0 && ny < this.gridRows) {
                    neighbors.push(...this.spatialPartitionGrid[ny][nx]);
                }
            }
        }
        
        return neighbors;
    }
    
    /**
     * Transition animation to game screen (dimmed mode)
     */
    transitionToGameScreen() {
        const gameCanvas = document.getElementById('gameBackgroundCanvas');
        if (gameCanvas) {
            this.canvas = gameCanvas;
            this.ctx = gameCanvas.getContext('2d');
            this.isDimmed = true;
            this.initializeCanvas();
        }
    }
    
    /**
     * Transition animation back to main menu
     */
    transitionToMainMenu() {
        const welcomeCanvas = document.getElementById('welcomeCanvas');
        if (welcomeCanvas) {
            this.canvas = welcomeCanvas;
            this.ctx = welcomeCanvas.getContext('2d');
            this.isDimmed = false;
            this.initializeCanvas();
        }
    }
    
    // Legacy method names for backward compatibility
    moveToGameScreen() { this.transitionToGameScreen(); }
    moveBackToMainMenu() { this.transitionToMainMenu(); }
    
    /**
     * Create initial particle set with randomized properties
     */
    createParticles() {
        const particleColors = [
            '#FF0000', '#FF4500', '#FF6B00', '#FF8C00', '#FFA500',
            '#FFD700', '#FFFF00', '#00FF00', '#00FF7F', '#00FFFF',
            '#0080FF', '#0000FF', '#4B0082', '#8B00FF', '#FF00FF',
            '#FF1493', '#FF69B4', '#00CED1', '#20B2AA', '#3CB371',
            '#9370DB', '#BA55D3', '#FF6347', '#FF4500', '#DC143C'
        ];
        
        for (let i = 0; i < this.particleCount; i++) {
            this.floatingParticles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                color: particleColors[Math.floor(Math.random() * particleColors.length)],
                size: 3 + Math.random() * 4,
                neighborhoodRadius: 100,
                maxSpeed: 2,
                maxForce: 0.05
            });
        }
    }
    
    /**
     * Apply boids/flocking algorithm for fish-like movement
     * Optimized with spatial partitioning for O(n) performance
     * @param {Object} particle - The particle to apply flocking behavior to
     */
    applyFlockingBehavior(particle) {
        let separation = { x: 0, y: 0 };
        let alignment = { x: 0, y: 0 };
        let cohesion = { x: 0, y: 0 };
        let neighborCount = 0;
        
        // Get neighbors using spatial partitioning for better performance
        const nearbyParticles = this.getNeighboringParticles(particle);
        
        // Check neighbors (only nearby particles now, huge performance improvement)
        for (let other of nearbyParticles) {
            if (other === particle) continue;
            
            const dx = other.x - particle.x;
            const dy = other.y - particle.y;
            const distSq = dx * dx + dy * dy; // Use squared distance to avoid sqrt
            const maxDistSq = particle.neighborhoodRadius * particle.neighborhoodRadius;
            
            if (distSq < maxDistSq && distSq > 0) {
                neighborCount++;
                
                const dist = Math.sqrt(distSq);
                
                // Separation: steer away from neighbors
                if (dist < 25) {
                    separation.x -= dx / dist;
                    separation.y -= dy / dist;
                }
                
                // Alignment: steer towards average heading of neighbors
                alignment.x += other.vx;
                alignment.y += other.vy;
                
                // Cohesion: steer towards average position of neighbors
                cohesion.x += other.x;
                cohesion.y += other.y;
            }
        }
        
        if (neighborCount > 0) {
            // Average the alignment
            alignment.x /= neighborCount;
            alignment.y /= neighborCount;
            
            // Calculate cohesion center
            cohesion.x = cohesion.x / neighborCount - particle.x;
            cohesion.y = cohesion.y / neighborCount - particle.y;
        }
        
        // Apply forces with different weights
        const separationWeight = 1.5;
        const alignmentWeight = 1.0;
        const cohesionWeight = 1.0;
        
        particle.vx += separation.x * separationWeight * particle.maxForce;
        particle.vy += separation.y * separationWeight * particle.maxForce;
        particle.vx += alignment.x * alignmentWeight * particle.maxForce * 0.1;
        particle.vy += alignment.y * alignmentWeight * particle.maxForce * 0.1;
        particle.vx += cohesion.x * cohesionWeight * particle.maxForce * 0.01;
        particle.vy += cohesion.y * cohesionWeight * particle.maxForce * 0.01;
        
        // Limit speed
        const speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
        if (speed > particle.maxSpeed) {
            particle.vx = (particle.vx / speed) * particle.maxSpeed;
            particle.vy = (particle.vy / speed) * particle.maxSpeed;
        }
    }
    
    /**
     * Update all particle positions based on flocking behavior
     */
    updateParticlePositions() {
        // Update spatial grid for efficient neighbor lookups
        this.updateSpatialPartitionGrid();
        
        for (let particle of this.floatingParticles) {
            // Apply flocking behavior
            this.applyFlockingBehavior(particle);
            
            // Update position
            particle.x += particle.vx;
            particle.y += particle.vy;
            
            // Wrap around edges
            if (particle.x < 0) particle.x = this.canvas.width;
            if (particle.x > this.canvas.width) particle.x = 0;
            if (particle.y < 0) particle.y = this.canvas.height;
            if (particle.y > this.canvas.height) particle.y = 0;
        }
    }
    
    /**
     * Render particles to the canvas
     */
    renderParticles() {
        // Clear with slight fade for trail effect (dimmed in game mode)
        // Read background color from CSS variables for theme support
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const baseBg = isDark ? '26, 26, 46' : '255, 255, 255'; // --bg-primary RGB values
        const fadeAlpha = this.isDimmed ? 0.3 : 0.1;
        const bgColor = `rgba(${baseBg}, ${fadeAlpha})`;
        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw particles (dimmed in game mode)
        const particleAlpha = this.isDimmed ? 0.3 : 1.0;
        for (let particle of this.floatingParticles) {
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            
            if (this.isDimmed) {
                // Convert hex to rgba with reduced opacity
                const r = parseInt(particle.color.slice(1, 3), 16);
                const g = parseInt(particle.color.slice(3, 5), 16);
                const b = parseInt(particle.color.slice(5, 7), 16);
                this.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${particleAlpha})`;
            } else {
                this.ctx.fillStyle = particle.color;
            }
            this.ctx.fill();
        }
    }
    
    /**
     * Main animation loop
     */
    startAnimationLoop() {
        this.updateParticlePositions();
        this.renderParticles();
        this.animationFrameId = requestAnimationFrame(() => this.startAnimationLoop());
    }
    
    /**
     * Stop the animation loop
     */
    stopAnimation() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }
    
    // Legacy method for backward compatibility
    stop() { this.stopAnimation(); }
}

/**
 * Lobby Manager - Handles multiplayer lobby state
 * 
 * TODO: [OPTIMIZATION] Consider moving lobby state to Redis for scalability
 * TODO: [ARCHITECTURE] Implement WebSocket connection pooling for real-time updates
 * 
 * Note: This is a UI placeholder. Real multiplayer requires backend integration (Convex/Firebase/etc.)
 */
class LobbyManager {
    constructor() {
        this.roomCode = null;
        this.players = [];
        this.isHost = false;
        this.myPlayerId = null;
        this.gridSize = 5;
        this.isReady = false;
        
        // Default player colors for up to 6 players
        this.defaultColors = [
            '#FF0000', // Red
            '#0000FF', // Blue
            '#00FF00', // Green
            '#FF8C00', // Orange
            '#8B00FF', // Purple
            '#00FFFF'  // Cyan
        ];
    }
    
    /**
     * Generate a random 6-character room code
     * Uses characters that are easy to read and distinguish:
     * - Excludes I, O, 1, 0 to avoid confusion between similar-looking characters
     * @returns {string} A 6-character room code
     */
    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }
    
    createRoom(playerName) {
        this.roomCode = this.generateRoomCode();
        this.isHost = true;
        this.myPlayerId = 'player_1';
        this.players = [{
            id: this.myPlayerId,
            name: playerName || 'Host',
            color: this.defaultColors[0],
            isReady: false,
            isHost: true
        }];
        return this.roomCode;
    }
    
    joinRoom(roomCode, playerName) {
        // In a real implementation, this would connect to a server
        // For now, this is a UI demonstration
        this.roomCode = roomCode.toUpperCase();
        this.isHost = false;
        this.myPlayerId = `player_${Date.now()}`;
        
        // Calculate player index based on existing players + 1 for the new player
        // In real app, server would assign colors to avoid conflicts
        const playerIndex = this.players.length;
        const playerNumber = playerIndex + 1;
        
        this.players.push({
            id: this.myPlayerId,
            name: playerName || `Player ${playerNumber}`,
            color: this.defaultColors[playerIndex % this.defaultColors.length],
            isReady: false,
            isHost: false
        });
        
        return true;
    }
    
    leaveRoom() {
        this.roomCode = null;
        this.players = [];
        this.isHost = false;
        this.myPlayerId = null;
        this.isReady = false;
    }
    
    toggleReady() {
        this.isReady = !this.isReady;
        const myPlayer = this.players.find(p => p.id === this.myPlayerId);
        if (myPlayer) {
            myPlayer.isReady = this.isReady;
        }
        return this.isReady;
    }
    
    updateMyColor(color) {
        const myPlayer = this.players.find(p => p.id === this.myPlayerId);
        if (myPlayer) {
            myPlayer.color = color;
        }
    }
    
    updateMyName(name) {
        const myPlayer = this.players.find(p => p.id === this.myPlayerId);
        if (myPlayer) {
            myPlayer.name = name;
        }
    }
    
    setGridSize(size) {
        this.gridSize = size;
    }
    
    canStartGame() {
        // Need at least 2 players and all must be ready
        return this.players.length >= 2 && 
               this.players.every(p => p.isReady) &&
               this.isHost;
    }
    
    getPlayerCount() {
        return this.players.length;
    }
}

// Initialize welcome animation
let welcomeAnimation = null;
let lobbyManager = new LobbyManager();

// Theme management
function initializeTheme() {
    const savedTheme = localStorage.getItem('shapekeeper_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeButton(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('shapekeeper_theme', newTheme);
    updateThemeButton(newTheme);
}

function updateThemeButton(theme) {
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.textContent = theme === 'light' ? '🌙' : '☀️';
    }
}

// Start animation when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeTheme();
        welcomeAnimation = new WelcomeAnimation();
        initializeMenuNavigation();
    });
} else {
    initializeTheme();
    welcomeAnimation = new WelcomeAnimation();
    initializeMenuNavigation();
}

// Centralized fullscreen request function
function requestFullscreen() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {
            // Fullscreen not supported or denied
        });
    } else if (elem.webkitRequestFullscreen) { // Safari
        elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) { // IE11
        elem.msRequestFullscreen();
    } else if (elem.mozRequestFullScreen) { // Firefox
        elem.mozRequestFullScreen();
    }
}

// Centralized fullscreen exit function
function exitFullscreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
    } else if (document.webkitExitFullscreen) { // Safari
        document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) { // IE11
        document.msExitFullscreen();
    } else if (document.mozCancelFullScreen) { // Firefox
        document.mozCancelFullScreen();
    }
}

/**
 * Show a toast notification message
 * @param {string} message - The message to display
 * @param {string} type - The type of toast: 'info', 'success', 'warning', 'error'
 * @param {number} duration - Duration in milliseconds (default: 4000)
 */
function showToast(message, type = 'info', duration = 4000) {
    // Remove any existing toast
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) {
        existingToast.remove();
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `
        <span class="toast-message">${message}</span>
        <button class="toast-close">×</button>
    `;
    
    // Add to body
    document.body.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Close button handler
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    });
    
    // Auto-remove after duration
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }
    }, duration);
}

// Screen transition helper
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

let selectedGridSize = null;
let fullscreenTriggered = false;

/**
 * Handle room state updates from Convex subscription
 * This function is called whenever the room state changes on the server
 * @param {Object} roomState - Current room state from Convex
 */
function handleRoomUpdate(roomState) {
    if (!roomState) {
        // Room was deleted or doesn't exist
        showToast('Room no longer exists', 'warning');
        lobbyManager.leaveRoom();
        showScreen('mainMenuScreen');
        return;
    }
    
    // Update local lobby manager state from server
    lobbyManager.roomCode = roomState.roomCode;
    lobbyManager.gridSize = roomState.gridSize;
    
    // Get my session ID
    const mySessionId = window.ShapeKeeperConvex?.getSessionId();
    
    // Check if I'm the host (hostPlayerId is on room, not player)
    lobbyManager.isHost = roomState.hostPlayerId === mySessionId;
    
    // Find my player ID
    const myPlayer = roomState.players.find(p => p.sessionId === mySessionId);
    lobbyManager.myPlayerId = myPlayer?._id || null;
    lobbyManager.isReady = myPlayer?.isReady || false;
    
    // Update players list with server data
    // Add isHost by comparing sessionId with room's hostPlayerId
    lobbyManager.players = roomState.players.map((p, index) => ({
        id: p._id,
        name: p.name,
        color: p.color,
        isReady: p.isReady,
        isHost: p.sessionId === roomState.hostPlayerId,
        playerNumber: p.playerNumber || (index + 1)
    }));
    
    // Update grid size selection UI
    document.querySelectorAll('.lobby-grid-btn').forEach(btn => {
        btn.classList.toggle('selected', parseInt(btn.dataset.size) === roomState.gridSize);
    });
    
    // Update ready button state
    const readyBtn = document.getElementById('readyBtn');
    if (readyBtn) {
        readyBtn.textContent = lobbyManager.isReady ? 'Ready ✓' : 'Ready';
        readyBtn.classList.toggle('is-ready', lobbyManager.isReady);
    }
    
    // Check if game has started
    if (roomState.status === 'playing') {
        // Transition to game screen
        if (welcomeAnimation) {
            welcomeAnimation.moveToGameScreen();
        }
        
        showScreen('gameScreen');
        requestFullscreen();
        
        // Get player colors from room state (sorted by playerIndex)
        const sortedPlayers = roomState.players.sort((a, b) => a.playerIndex - b.playerIndex);
        const player1Color = sortedPlayers[0]?.color || '#FF0000';
        const player2Color = sortedPlayers[1]?.color || '#0000FF';
        
        // Find my player in the room
        const mySessionId = window.ShapeKeeperConvex?.getSessionId();
        const meInRoom = roomState.players.find(p => p.sessionId === mySessionId);
        
        // Initialize game with room settings and multiplayer mode
        game = new DotsAndBoxesGame(roomState.gridSize, player1Color, player2Color);
        game.isMultiplayer = true;
        // playerIndex is 0-based, convert to 1-based player number (1 or 2)
        game.myPlayerNumber = (meInRoom?.playerIndex ?? 0) + 1;
        
        console.log('[Game] Started as Player', game.myPlayerNumber, 'sessionId:', mySessionId);
        
        // Subscribe to game state updates
        window.ShapeKeeperConvex.subscribeToGameState(handleGameStateUpdate);
        
        showToast('Game started! You are Player ' + game.myPlayerNumber, 'success', 2000);
        return;
    }
    
    // Update UI if still in lobby
    updateLobbyUI();
}

/**
 * Handle game state updates from Convex subscription
 * This function is called whenever the game state changes on the server
 * @param {Object} gameState - Current game state from Convex
 */
function handleGameStateUpdate(gameState) {
    if (!gameState || !game) return;
    
    // Update current player turn (server uses 0-based index, game uses 1-based player number)
    // currentPlayerIndex 0 = Player 1, currentPlayerIndex 1 = Player 2
    // Use ?? instead of || because 0 is a valid value
    const serverPlayerIndex = gameState.room?.currentPlayerIndex ?? 0;
    game.currentPlayer = serverPlayerIndex + 1;
    
    console.log('[Game] State update - currentPlayerIndex:', serverPlayerIndex, 
                'currentPlayer:', game.currentPlayer, 
                'myPlayerNumber:', game.myPlayerNumber,
                'isMyTurn:', game.currentPlayer === game.myPlayerNumber);
    
    // Sync lines from server
    gameState.lines.forEach(line => {
        if (!game.lines.has(line.lineKey)) {
            game.lines.add(line.lineKey);
            // playerIndex is 0-based, convert to 1-based player number
            game.lineOwners.set(line.lineKey, line.playerIndex + 1);
            
            // Add line draw animation
            const [startDot, endDot] = game.parseLineKey(line.lineKey);
            game.lineDrawings.push({
                lineKey: line.lineKey,
                startDot,
                endDot,
                player: line.playerIndex + 1,
                startTime: Date.now(),
                duration: DotsAndBoxesGame.ANIMATION_LINE_DRAW_DURATION
            });
            
            // Add pulsating effect for new lines
            game.pulsatingLines.push({
                line: line.lineKey,
                player: line.playerIndex + 1,
                time: Date.now()
            });
            
            // Play line sound
            game.playLineSound();
        }
    });
    
    // Sync squares from server
    gameState.squares.forEach(square => {
        const key = square.squareKey;
        if (!game.squares[key]) {
            // playerIndex is 0-based, convert to 1-based player number
            game.squares[key] = square.playerIndex + 1;
            
            // Sync multiplier from server (generated server-side)
            if (square.multiplier) {
                game.squareMultipliers[key] = {
                    type: square.multiplier.type,
                    value: square.multiplier.value
                };
            }
            
            // Trigger the square animation (which handles particles and kiss emojis)
            game.triggerSquareAnimation(key);
            
            // Play square sound
            game.playSquareSound(game.comboCount);
        }
    });
    
    // Update scores from players array (playerIndex 0 = Player 1, playerIndex 1 = Player 2)
    const p1 = gameState.players?.find(p => p.playerIndex === 0);
    const p2 = gameState.players?.find(p => p.playerIndex === 1);
    game.scores[1] = p1?.score || 0;
    game.scores[2] = p2?.score || 0;
    
    // Check for game over
    if (gameState.room?.status === 'finished' && !game.isGameOver) {
        game.isGameOver = true;
        game.showWinner();
    }
    
    // Redraw and update UI
    game.draw();
    game.updateUI();
}

/**
 * Initialize all menu navigation and event listeners
 */
function initializeMenuNavigation() {
    // ========================================
    // Theme Toggle
    // ========================================
    
    document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);
    
    // ========================================
    // Main Menu Navigation
    // ========================================
    
    // Create Game button
    document.getElementById('createGameBtn').addEventListener('click', async () => {
        const playerName = document.getElementById('playerName')?.value || 'Host';
        const gridSize = lobbyManager.gridSize || 5;
        
        // Use Convex backend if available
        if (window.ShapeKeeperConvex) {
            showToast('Creating room...', 'info', 2000);
            const result = await window.ShapeKeeperConvex.createRoom(playerName, gridSize);
            
            if (result.error) {
                showToast('Error: ' + result.error, 'error');
                return;
            }
            
            // Subscribe to room updates
            window.ShapeKeeperConvex.subscribeToRoom(handleRoomUpdate);
            
            lobbyManager.roomCode = result.roomCode;
            lobbyManager.isHost = true;
            showToast('Room created: ' + result.roomCode, 'success', 3000);
        } else {
            // Fallback to local lobby manager
            lobbyManager.createRoom(playerName);
        }
        
        updateLobbyUI();
        showScreen('lobbyScreen');
    });
    
    // Join Game button
    document.getElementById('joinGameBtn').addEventListener('click', () => {
        showScreen('joinScreen');
    });
    
    // Local Play button
    document.getElementById('localPlayBtn').addEventListener('click', () => {
        showScreen('localSetupScreen');
    });
    
    // ========================================
    // Local Setup Screen
    // ========================================
    
    // Local grid size selection
    document.querySelectorAll('.local-grid-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.local-grid-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedGridSize = parseInt(btn.dataset.size);
            document.getElementById('startLocalGame').disabled = false;
            
            if (!fullscreenTriggered) {
                fullscreenTriggered = true;
                requestFullscreen();
            }
        });
    });
    
    // Back from local setup
    document.getElementById('backToMenuFromLocal').addEventListener('click', () => {
        showScreen('mainMenuScreen');
    });
    
    // Start local game
    document.getElementById('startLocalGame').addEventListener('click', () => {
        const player1Color = document.getElementById('player1Color').value;
        const player2Color = document.getElementById('player2Color').value;
        const hypotheticalsEnabled = document.getElementById('hypotheticalsToggle').checked;
        
        if (welcomeAnimation) {
            welcomeAnimation.moveToGameScreen();
        }
        
        showScreen('gameScreen');
        requestFullscreen();
        
        game = new DotsAndBoxesGame(selectedGridSize, player1Color, player2Color, { hypotheticalsEnabled });
    });
    
    // ========================================
    // Join Screen
    // ========================================
    
    // Room code input validation
    const joinRoomCodeInput = document.getElementById('joinRoomCode');
    const joinPlayerNameInput = document.getElementById('joinPlayerName');
    const joinRoomBtn = document.getElementById('joinRoomBtn');
    
    function validateJoinInputs() {
        const codeValid = joinRoomCodeInput.value.length === 6;
        const nameValid = joinPlayerNameInput.value.trim().length > 0;
        joinRoomBtn.disabled = !(codeValid && nameValid);
    }
    
    joinRoomCodeInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        validateJoinInputs();
    });
    
    joinPlayerNameInput.addEventListener('input', validateJoinInputs);
    
    // Back from join screen
    document.getElementById('backToMenuFromJoin').addEventListener('click', () => {
        showScreen('mainMenuScreen');
    });
    
    // Join room button
    joinRoomBtn.addEventListener('click', async () => {
        const roomCode = joinRoomCodeInput.value;
        const playerName = joinPlayerNameInput.value.trim();
        
        // Use Convex backend if available
        if (window.ShapeKeeperConvex) {
            showToast('Joining room...', 'info', 2000);
            const result = await window.ShapeKeeperConvex.joinRoom(roomCode, playerName);
            
            if (result.error) {
                showToast('Error: ' + result.error, 'error');
                return;
            }
            
            // Subscribe to room updates
            window.ShapeKeeperConvex.subscribeToRoom(handleRoomUpdate);
            
            lobbyManager.roomCode = roomCode.toUpperCase();
            lobbyManager.isHost = false;
            showToast('Joined room: ' + roomCode.toUpperCase(), 'success', 3000);
            updateLobbyUI();
            showScreen('lobbyScreen');
        } else {
            showToast('Multiplayer mode requires backend integration.', 'info', 5000);
        }
    });
    
    // ========================================
    // Lobby Screen
    // ========================================
    
    // Lobby grid size selection
    document.querySelectorAll('.lobby-grid-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!lobbyManager.isHost) return; // Only host can change
            
            const newSize = parseInt(btn.dataset.size);
            
            // Use Convex backend if available
            if (window.ShapeKeeperConvex) {
                const result = await window.ShapeKeeperConvex.updateGridSize(newSize);
                if (result.error) {
                    showToast('Error: ' + result.error, 'error');
                    return;
                }
                // UI will update via subscription
            } else {
                document.querySelectorAll('.lobby-grid-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                lobbyManager.setGridSize(newSize);
            }
        });
    });
    
    // Copy room code
    document.getElementById('copyCodeBtn').addEventListener('click', () => {
        const code = document.getElementById('roomCode').textContent;
        navigator.clipboard.writeText(code).then(() => {
            const btn = document.getElementById('copyCodeBtn');
            btn.textContent = '✓';
            btn.classList.add('copied');
            showToast('Room code copied to clipboard!', 'success', 2000);
            setTimeout(() => {
                btn.textContent = '📋';
                btn.classList.remove('copied');
            }, 2000);
        });
    });
    
    // Player name input
    document.getElementById('playerName').addEventListener('input', async (e) => {
        const newName = e.target.value.trim() || 'Player';
        lobbyManager.updateMyName(newName);
        
        // Sync to Convex if available
        if (window.ShapeKeeperConvex) {
            await window.ShapeKeeperConvex.updatePlayer({ name: newName });
        }
        updateLobbyUI();
    });
    
    // Player color input
    document.getElementById('playerColor').addEventListener('input', async (e) => {
        const newColor = e.target.value;
        lobbyManager.updateMyColor(newColor);
        
        // Sync to Convex if available
        if (window.ShapeKeeperConvex) {
            await window.ShapeKeeperConvex.updatePlayer({ color: newColor });
        }
        updateLobbyUI();
    });
    
    // Ready button
    document.getElementById('readyBtn').addEventListener('click', async () => {
        if (window.ShapeKeeperConvex) {
            const result = await window.ShapeKeeperConvex.toggleReady();
            if (result.error) {
                showToast('Error: ' + result.error, 'error');
                return;
            }
            const btn = document.getElementById('readyBtn');
            btn.textContent = result.isReady ? 'Ready ✓' : 'Ready';
            btn.classList.toggle('is-ready', result.isReady);
        } else {
            const isReady = lobbyManager.toggleReady();
            const btn = document.getElementById('readyBtn');
            btn.textContent = isReady ? 'Ready ✓' : 'Ready';
            btn.classList.toggle('is-ready', isReady);
            updateLobbyUI();
        }
    });
    
    // Start multiplayer game
    document.getElementById('startMultiplayerGame').addEventListener('click', async () => {
        if (window.ShapeKeeperConvex) {
            const result = await window.ShapeKeeperConvex.startGame();
            if (result.error) {
                showToast('Error: ' + result.error, 'error');
                return;
            }
            
            // Game will start via subscription update
            showToast('Starting game...', 'success', 2000);
        } else {
            if (!lobbyManager.canStartGame()) {
                showToast('All players must be ready to start!', 'warning');
                return;
            }
            showToast('Multiplayer game start requires backend integration.', 'info', 5000);
        }
    });
    
    // Leave lobby
    document.getElementById('leaveLobby').addEventListener('click', async () => {
        if (window.ShapeKeeperConvex) {
            await window.ShapeKeeperConvex.leaveRoom();
        }
        lobbyManager.leaveRoom();
        showScreen('mainMenuScreen');
    });
    
    // ========================================
    // Game Screen
    // ========================================
    
    // Exit game
    document.getElementById('exitGame').addEventListener('click', () => {
        exitFullscreen();
        showScreen('mainMenuScreen');
        game = null;
        
        if (welcomeAnimation) {
            welcomeAnimation.moveBackToMainMenu();
        }
    });
    
    // ========================================
    // Winner Screen
    // ========================================
    
    // Play again
    document.getElementById('playAgain').addEventListener('click', () => {
        showScreen('mainMenuScreen');
        
        if (welcomeAnimation) {
            welcomeAnimation.moveBackToMainMenu();
        }
    });
}

/**
 * Update lobby UI with current state
 */
function updateLobbyUI() {
    // Update room code
    document.getElementById('roomCode').textContent = lobbyManager.roomCode || '------';
    
    // Update player count
    document.getElementById('playerCount').textContent = lobbyManager.getPlayerCount();
    
    // Update players list
    const playersList = document.getElementById('playersList');
    playersList.innerHTML = '';
    
    lobbyManager.players.forEach((player, index) => {
        const entry = document.createElement('div');
        entry.className = 'player-entry';
        if (player.isReady) entry.classList.add('ready');
        if (player.isHost) entry.classList.add('host');
        
        entry.innerHTML = `
            <div class="player-color-dot" style="background-color: ${player.color}"></div>
            <span class="player-entry-name">${player.name}</span>
            ${player.isHost ? '<span class="host-badge">Host</span>' : ''}
            <span class="player-entry-status">${player.isReady ? '✓ Ready' : 'Not Ready'}</span>
        `;
        
        playersList.appendChild(entry);
    });
    
    // Update start button state
    document.getElementById('startMultiplayerGame').disabled = !lobbyManager.canStartGame();
    
    // Disable grid selection for non-hosts
    document.querySelectorAll('.lobby-grid-btn').forEach(btn => {
        btn.disabled = !lobbyManager.isHost;
        btn.style.opacity = lobbyManager.isHost ? '1' : '0.5';
    });
}
