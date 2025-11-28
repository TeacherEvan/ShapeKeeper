'use strict';

/**
 * Welcome Screen Background Animation
 * Implements flocking behavior (boids algorithm) with spatial partitioning for performance
 */

class WelcomeAnimation {
    constructor() {
        this.canvas = document.getElementById('welcomeCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.dots = [];
        this.numDots = 150; // Hundreds of dots
        this.animationFrame = null;
        this.isDimmed = false;
        this.spatialGrid = null; // For spatial partitioning optimization
        this.gridCellSize = 100; // Size of each cell in spatial grid
        
        this.setupCanvas();
        this.initDots();
        this.animate();
        
        // Handle window resize
        window.addEventListener('resize', () => this.handleResize());
    }
    
    setupCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.initializeSpatialGrid();
    }
    
    handleResize() {
        this.setupCanvas();
    }
    
    // Spatial partitioning for performance optimization
    initializeSpatialGrid() {
        this.gridCols = Math.ceil(this.canvas.width / this.gridCellSize);
        this.gridRows = Math.ceil(this.canvas.height / this.gridCellSize);
        this.spatialGrid = Array(this.gridRows).fill(null).map(() => 
            Array(this.gridCols).fill(null).map(() => [])
        );
    }
    
    updateSpatialGrid() {
        // Clear grid
        for (let row of this.spatialGrid) {
            for (let cell of row) {
                cell.length = 0;
            }
        }
        
        // Assign dots to grid cells
        for (let dot of this.dots) {
            const gridX = Math.floor(dot.x / this.gridCellSize);
            const gridY = Math.floor(dot.y / this.gridCellSize);
            if (gridX >= 0 && gridX < this.gridCols && gridY >= 0 && gridY < this.gridRows) {
                this.spatialGrid[gridY][gridX].push(dot);
            }
        }
    }
    
    getNeighborDots(dot) {
        const gridX = Math.floor(dot.x / this.gridCellSize);
        const gridY = Math.floor(dot.y / this.gridCellSize);
        const neighbors = [];
        
        // Check surrounding cells (3x3 grid around dot)
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const nx = gridX + dx;
                const ny = gridY + dy;
                if (nx >= 0 && nx < this.gridCols && ny >= 0 && ny < this.gridRows) {
                    neighbors.push(...this.spatialGrid[ny][nx]);
                }
            }
        }
        
        return neighbors;
    }
    
    moveToGameScreen() {
        // Switch canvas to game screen
        const gameCanvas = document.getElementById('gameBackgroundCanvas');
        if (gameCanvas) {
            this.canvas = gameCanvas;
            this.ctx = gameCanvas.getContext('2d');
            this.isDimmed = true;
            this.setupCanvas();
        }
    }
    
    moveBackToMainMenu() {
        // Switch canvas back to main menu screen
        const welcomeCanvas = document.getElementById('welcomeCanvas');
        if (welcomeCanvas) {
            this.canvas = welcomeCanvas;
            this.ctx = welcomeCanvas.getContext('2d');
            this.isDimmed = false;
            this.setupCanvas();
        }
    }
    
    initDots() {
        const colors = [
            '#FF0000', '#FF4500', '#FF6B00', '#FF8C00', '#FFA500',
            '#FFD700', '#FFFF00', '#00FF00', '#00FF7F', '#00FFFF',
            '#0080FF', '#0000FF', '#4B0082', '#8B00FF', '#FF00FF',
            '#FF1493', '#FF69B4', '#00CED1', '#20B2AA', '#3CB371',
            '#9370DB', '#BA55D3', '#FF6347', '#FF4500', '#DC143C'
        ];
        
        for (let i = 0; i < this.numDots; i++) {
            this.dots.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: 3 + Math.random() * 4,
                neighborhoodRadius: 100,
                maxSpeed: 2,
                maxForce: 0.05
            });
        }
    }
    
    // Boids/Flocking algorithm for fish-like movement (optimized with spatial partitioning)
    applyFlockingBehavior(dot) {
        let separation = { x: 0, y: 0 };
        let alignment = { x: 0, y: 0 };
        let cohesion = { x: 0, y: 0 };
        let neighborCount = 0;
        
        // Get neighbors using spatial partitioning for better performance
        const nearbyDots = this.getNeighborDots(dot);
        
        // Check neighbors (only nearby dots now, huge performance improvement)
        for (let other of nearbyDots) {
            if (other === dot) continue;
            
            const dx = other.x - dot.x;
            const dy = other.y - dot.y;
            const distSq = dx * dx + dy * dy; // Use squared distance to avoid sqrt
            const maxDistSq = dot.neighborhoodRadius * dot.neighborhoodRadius;
            
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
            cohesion.x = cohesion.x / neighborCount - dot.x;
            cohesion.y = cohesion.y / neighborCount - dot.y;
        }
        
        // Apply forces with different weights
        const separationWeight = 1.5;
        const alignmentWeight = 1.0;
        const cohesionWeight = 1.0;
        
        dot.vx += separation.x * separationWeight * dot.maxForce;
        dot.vy += separation.y * separationWeight * dot.maxForce;
        dot.vx += alignment.x * alignmentWeight * dot.maxForce * 0.1;
        dot.vy += alignment.y * alignmentWeight * dot.maxForce * 0.1;
        dot.vx += cohesion.x * cohesionWeight * dot.maxForce * 0.01;
        dot.vy += cohesion.y * cohesionWeight * dot.maxForce * 0.01;
        
        // Limit speed
        const speed = Math.sqrt(dot.vx * dot.vx + dot.vy * dot.vy);
        if (speed > dot.maxSpeed) {
            dot.vx = (dot.vx / speed) * dot.maxSpeed;
            dot.vy = (dot.vy / speed) * dot.maxSpeed;
        }
    }
    
    updateDots() {
        // Update spatial grid for efficient neighbor lookups
        this.updateSpatialGrid();
        
        for (let dot of this.dots) {
            // Apply flocking behavior
            this.applyFlockingBehavior(dot);
            
            // Update position
            dot.x += dot.vx;
            dot.y += dot.vy;
            
            // Wrap around edges
            if (dot.x < 0) dot.x = this.canvas.width;
            if (dot.x > this.canvas.width) dot.x = 0;
            if (dot.y < 0) dot.y = this.canvas.height;
            if (dot.y > this.canvas.height) dot.y = 0;
        }
    }
    
    draw() {
        // Clear with slight fade for trail effect (dimmed in game mode)
        const fadeAlpha = this.isDimmed ? 0.15 : 0.1;
        const bgColor = this.isDimmed ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)';
        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw dots (dimmed in game mode)
        const dotAlpha = this.isDimmed ? 0.3 : 1.0;
        for (let dot of this.dots) {
            this.ctx.beginPath();
            this.ctx.arc(dot.x, dot.y, dot.size, 0, Math.PI * 2);
            
            if (this.isDimmed) {
                // Convert hex to rgba with reduced opacity
                const r = parseInt(dot.color.slice(1, 3), 16);
                const g = parseInt(dot.color.slice(3, 5), 16);
                const b = parseInt(dot.color.slice(5, 7), 16);
                this.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${dotAlpha})`;
            } else {
                this.ctx.fillStyle = dot.color;
            }
            this.ctx.fill();
        }
    }
    
    animate() {
        this.updateDots();
        this.draw();
        this.animationFrame = requestAnimationFrame(() => this.animate());
    }
    
    stop() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }
}

/**
 * Lobby Manager - Handles multiplayer lobby state
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

// Start animation when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        welcomeAnimation = new WelcomeAnimation();
        initializeMenuNavigation();
    });
} else {
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
 * Initialize all menu navigation and event listeners
 */
function initializeMenuNavigation() {
    // ========================================
    // Main Menu Navigation
    // ========================================
    
    // Create Game button
    document.getElementById('createGameBtn').addEventListener('click', () => {
        const playerName = 'Host';
        lobbyManager.createRoom(playerName);
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
        
        if (welcomeAnimation) {
            welcomeAnimation.moveToGameScreen();
        }
        
        showScreen('gameScreen');
        requestFullscreen();
        
        game = new DotsAndBoxesGame(selectedGridSize, player1Color, player2Color);
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
    joinRoomBtn.addEventListener('click', () => {
        const roomCode = joinRoomCodeInput.value;
        const playerName = joinPlayerNameInput.value.trim();
        
        // In a real implementation, this would validate with a server
        // For now, show a message that multiplayer requires backend
        showToast('Multiplayer mode requires backend integration. See MULTIPLAYER_PLANNING.md for details.', 'info', 5000);
        
        // For demo purposes, we could show the lobby
        // lobbyManager.joinRoom(roomCode, playerName);
        // updateLobbyUI();
        // showScreen('lobbyScreen');
    });
    
    // ========================================
    // Lobby Screen
    // ========================================
    
    // Lobby grid size selection
    document.querySelectorAll('.lobby-grid-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!lobbyManager.isHost) return; // Only host can change
            
            document.querySelectorAll('.lobby-grid-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            lobbyManager.setGridSize(parseInt(btn.dataset.size));
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
    document.getElementById('playerName').addEventListener('input', (e) => {
        lobbyManager.updateMyName(e.target.value.trim() || 'Player');
        updateLobbyUI();
    });
    
    // Player color input
    document.getElementById('playerColor').addEventListener('input', (e) => {
        lobbyManager.updateMyColor(e.target.value);
        updateLobbyUI();
    });
    
    // Ready button
    document.getElementById('readyBtn').addEventListener('click', () => {
        const isReady = lobbyManager.toggleReady();
        const btn = document.getElementById('readyBtn');
        btn.textContent = isReady ? 'Ready ✓' : 'Ready';
        btn.classList.toggle('is-ready', isReady);
        updateLobbyUI();
    });
    
    // Start multiplayer game
    document.getElementById('startMultiplayerGame').addEventListener('click', () => {
        if (!lobbyManager.canStartGame()) {
            showToast('All players must be ready to start!', 'warning');
            return;
        }
        
        // In a real implementation, this would sync with server
        showToast('Multiplayer game start requires backend integration. See MULTIPLAYER_PLANNING.md for details.', 'info', 5000);
    });
    
    // Leave lobby
    document.getElementById('leaveLobby').addEventListener('click', () => {
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
