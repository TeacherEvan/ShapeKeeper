/**
 * Room and authoritative game-state reconciliation helpers.
 */

import { DotsAndBoxesGame } from '../../../dots-and-boxes-game.js';
import { createTurnClockController } from '../../timing/turn-clock-controller.js';
import { showScreen } from '../ScreenTransition.js';
import { announceStatus } from '../AccessibilityAnnouncer.js';

// turnClockController is module-scoped, reset on new match.
let turnClockController = null;
let announcedRematchVote = false;

export function handleRoomStateUpdate(roomState, deps) {
    const {
        multiplayerStartup,
        STARTUP_STATES,
        lobbyManager,
        getGame,
        initializeMultiplayerGame,
        setStartupState,
        updateLobbyUI,
        clearSubscriptions,
        resetStartupState,
        setActiveGame,
        showScreen,
        showToast,
    } = deps;

    const game = getGame();

    if (!roomState) {
        resetStartupState();
        clearSubscriptions({ room: true, gameState: true });
        setActiveGame(null);
        turnClockController?.clear();
        turnClockController = null;
        window.ShapeKeeperTurnClock = null;
        showToast('Room no longer exists', 'warning');
        lobbyManager.leaveRoom();
        showScreen('mainMenuScreen');
        return;
    }

    // Support both { room: {...}, players: [...] } and flat { roomCode, players, ... } shapes
    const normalizedRoom = roomState.room
        ? {
              ...roomState.room,
              players: roomState.players ?? roomState.room.players ?? [],
              rematchVoteCount: roomState.rematchVoteCount ?? roomState.room.rematchVoteCount,
          }
        : roomState;
    const effectiveRoomState = {
        ...normalizedRoom,
        players: normalizedRoom.players ?? [],
    };

    multiplayerStartup.setLastRoomState(effectiveRoomState);
    lobbyManager.roomCode = effectiveRoomState.roomCode;
    lobbyManager.gridSize = effectiveRoomState.gridSize;
    // Allowed Time: mirror the room's configured turn countdown (seconds)
    // into the lobby manager so the control reflects it for everyone.
    if (typeof effectiveRoomState.turnDurationSeconds === 'number') {
        lobbyManager.turnDurationSeconds = effectiveRoomState.turnDurationSeconds;
    } else if (typeof effectiveRoomState.turnDurationMs === 'number') {
        lobbyManager.turnDurationSeconds = Math.round(effectiveRoomState.turnDurationMs / 1000);
    }

    const mySessionId = window.ShapeKeeperConvex?.getSessionId?.();
    const myPlayer =
        effectiveRoomState.players.find((player) => player.isYou) ||
        (mySessionId
            ? effectiveRoomState.players.find((player) => player.sessionId === mySessionId)
            : null);

    const nextIsHost =
        typeof effectiveRoomState.isHost === 'boolean'
            ? effectiveRoomState.isHost
            : Boolean(
                  myPlayer?.isHost ||
                  (mySessionId &&
                      effectiveRoomState.hostPlayerId &&
                      effectiveRoomState.hostPlayerId === mySessionId)
              );
    const previousGameIsHost = game?.isMultiplayer ? game.isHost : null;
    lobbyManager.isHost = nextIsHost;

    lobbyManager.myPlayerId = myPlayer?._id || null;
    lobbyManager.isReady = myPlayer?.isReady || false;

    if (game?.isMultiplayer) {
        game.isHost = nextIsHost;

        game.uiManager?.updatePopulateButtonVisibility();

        if (
            effectiveRoomState.status === 'playing' &&
            previousGameIsHost !== null &&
            previousGameIsHost !== nextIsHost &&
            nextIsHost
        ) {
            showToast('Host left the match. You are now the host.', 'info', 2500);
        }
    }

    lobbyManager.players = effectiveRoomState.players.map((player, index) => ({
        id: player._id,
        sessionId: player.sessionId,
        name: player.name,
        color: player.color,
        isReady: player.isReady,
        isYou: Boolean(player.isYou || (mySessionId && player.sessionId === mySessionId)),
        isHost:
            typeof player.isHost === 'boolean'
                ? player.isHost
                : Boolean(
                      effectiveRoomState.hostPlayerId &&
                      player.sessionId === effectiveRoomState.hostPlayerId
                  ),
        playerIndex: player.playerIndex ?? index,
        playerNumber: player.playerNumber || (player.playerIndex ?? index) + 1,
    }));

    document.querySelectorAll('.lobby-grid-btn').forEach((btn) => {
        btn.classList.toggle(
            'selected',
            parseInt(btn.dataset.size) === effectiveRoomState.gridSize
        );
    });

    const lobbyTurnTimer = document.getElementById('lobbyTurnTimer');
    if (lobbyTurnTimer) {
        lobbyTurnTimer.value = String(effectiveRoomState.turnDurationMs ?? 0);
        lobbyTurnTimer.disabled = !effectiveRoomState.isHost;
    }

    const readyBtn = document.getElementById('readyBtn');
    if (readyBtn) {
        readyBtn.textContent = lobbyManager.isReady ? 'Ready ✓' : 'Ready';
        readyBtn.classList.toggle('is-ready', lobbyManager.isReady);
    }

    if (effectiveRoomState.status === 'playing') {
        if (
            multiplayerStartup.getSnapshot().phase !== STARTUP_STATES.IN_MATCH &&
            !multiplayerStartup.getSnapshot().startupBeganAt
        ) {
            initializeMultiplayerGame(effectiveRoomState);
        }
        return;
    }

    if (effectiveRoomState.status === 'lobby') {
        if (lobbyManager.canStartGame()) {
            setStartupState(STARTUP_STATES.ROOM_READY_TO_START, { visible: false });
        } else if (multiplayerStartup.getSnapshot().phase !== STARTUP_STATES.IDLE) {
            setStartupState(STARTUP_STATES.ROOM_SUBSCRIBED, { visible: false });
        }
    }

    updateLobbyUI();
}

export function handleAuthoritativeGameState(gameState, deps) {
    const { multiplayerStartup, STARTUP_STATES, getGame, setStartupState, showToast } = deps;
    const game = getGame();

    if (!gameState || !game) {
        return;
    }

    const firstStateResult = multiplayerStartup.markFirstAuthoritativeState();
    const { isFirstAuthoritativeState } = firstStateResult;
    if (isFirstAuthoritativeState) {
        console.log('[Startup] First authoritative game state received', {
            startupDurationMs: firstStateResult.startupDurationMs,
            retryCount: firstStateResult.retryCount,
        });
    }

    const serverPlayerIndex = gameState.room?.currentPlayerIndex ?? 0;
    game.currentPlayer = serverPlayerIndex + 1;

    // FR-2 / FR-3: feed authoritative turn timing into the clock controller and
    // keep the live countdown on the game object.
    if (!turnClockController) {
        turnClockController = createTurnClockController(game);
        window.ShapeKeeperTurnClock = turnClockController;
    }
    turnClockController.onAuthoritativeRoom(gameState.room);
    turnClockController.tick();

    console.log(
        '[Game] State update - currentPlayerIndex:',
        serverPlayerIndex,
        'currentPlayer:',
        game.currentPlayer,
        'myPlayerNumber:',
        game.myPlayerNumber,
        'isMyTurn:',
        game.currentPlayer === game.myPlayerNumber
    );

    if (gameState.room?.status === 'playing' && game.gameOverHandled) {
        game.gameOverHandled = false;
        game.lines?.clear?.();
        game.lineOwners?.clear?.();
        game.lineDrawings = [];
        game.pulsatingLines = [];
        game.squares = {};
        game.squareMultipliers = {};
        if (game.squareTaps) game.squareTaps = {};
        game.revealedMultipliers?.clear?.();
        game.claimedCells?.clear?.();
        game.scores[1] = 0;
        game.scores[2] = 0;
        const btn = document.getElementById('playAgain');
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Play Again';
        }
        showScreen('gameScreen');
    }

    gameState.lines.forEach((line) => {
        if (!game.lines.has(line.lineKey)) {
            game.lines.add(line.lineKey);

            const displayPlayerIndex =
                line.playerIndex === 2 ? DotsAndBoxesGame.POPULATE_PLAYER_ID : line.playerIndex + 1;

            game.lineOwners.set(line.lineKey, displayPlayerIndex);

            const [startDot, endDot] = game.parseLineKey(line.lineKey);
            if (game.animationSystem?.addLineDrawing) {
                game.animationSystem.addLineDrawing(
                    line.lineKey,
                    startDot,
                    endDot,
                    displayPlayerIndex,
                    false,
                    game.offsetX,
                    game.offsetY,
                    game.cellSize
                );
            } else {
                game.lineDrawings.push({
                    lineKey: line.lineKey,
                    startDot: {
                        x: game.offsetX + startDot.col * game.cellSize,
                        y: game.offsetY + startDot.row * game.cellSize,
                    },
                    endDot: {
                        x: game.offsetX + endDot.col * game.cellSize,
                        y: game.offsetY + endDot.row * game.cellSize,
                    },
                    player: displayPlayerIndex,
                    startTime: Date.now(),
                    duration: DotsAndBoxesGame.ANIMATION_LINE_DRAW_DURATION,
                });
            }

            if (game.animationSystem?.addPulsatingLine) {
                game.animationSystem.addPulsatingLine(line.lineKey, displayPlayerIndex, false);
            } else {
                game.pulsatingLines.push({
                    line: line.lineKey,
                    player: displayPlayerIndex,
                    time: Date.now(),
                });
            }

            game.playLineSound();
        }
    });

    gameState.squares.forEach((square) => {
        const key = square.squareKey;
        if (!game.squares[key]) {
            game.squares[key] = square.playerIndex + 1;

            if (square.multiplier) {
                game.squareMultipliers[key] = {
                    type: square.multiplier.type,
                    value: square.multiplier.value,
                };
            }

            // Track taps per-square for the visual ✋ indicator. The renderer
            // reads game.squareTaps; missing key is treated as 0.
            if (game.squareTaps) {
                game.squareTaps[key] = square.taps ?? 0;
            }

            game.triggerSquareAnimation(key, square.playerIndex + 1);
            game.playSquareSound(game.comboCount);
        } else if (game.squareTaps && (square.taps ?? 0) > (game.squareTaps[key] ?? 0)) {
            // The square was already known to us, but a NEW tap has landed.
            // Update the local counter (so the renderer can show ✋) and
            // refresh the effective multiplier from the server so the next
            // reveal uses the right value. We do NOT trigger a re-animation
            // — taps should feel snappy and lightweight, not a re-claim.
            game.squareTaps[key] = square.taps ?? 0;
            if (square.effectiveMultiplier) {
                game.squareMultipliers[key] = {
                    type: square.effectiveMultiplier.type,
                    value: square.effectiveMultiplier.value,
                };
            }
        }
    });

    const p1 = gameState.players?.find((player) => player.playerIndex === 0);
    const p2 = gameState.players?.find((player) => player.playerIndex === 1);
    game.scores[1] = p1?.score || 0;
    game.scores[2] = p2?.score || 0;

    game.uiManager.updatePopulateButtonVisibility();

    if (gameState.room?.status === 'finished') {
        if (!game.gameOverHandled) {
            game.gameOverHandled = true;
            game.showWinner();
        }
        if ((gameState.room.rematchVoteCount ?? 0) > 0 && !announcedRematchVote) {
            const isWinnerScreenActive =
                document.getElementById('winnerScreen')?.classList?.contains('active') &&
                !document.getElementById('winnerScreen')?.hidden;
            if (isWinnerScreenActive) {
                announcedRematchVote = true;
                announceStatus('Opponent wants a rematch');
            }
        }
    } else {
        announcedRematchVote = false;
    }

    game.draw();
    game.uiManager.updateUI();

    if (isFirstAuthoritativeState) {
        game.uiManager.displayLoadingSkeleton(false);
        setStartupState(STARTUP_STATES.IN_MATCH, { visible: false });
        showToast('Live match synchronized!', 'success', 2000);
    }
}
