/**
 * Room and authoritative game-state reconciliation helpers.
 */

import { DotsAndBoxesGame } from '../../../dots-and-boxes-game.js';

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
        showToast('Room no longer exists', 'warning');
        lobbyManager.leaveRoom();
        showScreen('mainMenuScreen');
        return;
    }

    multiplayerStartup.setLastRoomState(roomState);
    lobbyManager.roomCode = roomState.roomCode;
    lobbyManager.gridSize = roomState.gridSize;

    const mySessionId = window.ShapeKeeperConvex?.getSessionId();
    const nextIsHost = roomState.hostPlayerId === mySessionId;
    const previousGameIsHost = game?.isMultiplayer ? game.isHost : null;
    lobbyManager.isHost = nextIsHost;

    const myPlayer = roomState.players.find((player) => player.sessionId === mySessionId);
    lobbyManager.myPlayerId = myPlayer?._id || null;
    lobbyManager.isReady = myPlayer?.isReady || false;

    if (game?.isMultiplayer) {
        game.isHost = nextIsHost;
        game.uiManager?.updatePopulateButtonVisibility();

        if (
            roomState.status === 'playing' &&
            previousGameIsHost !== null &&
            previousGameIsHost !== nextIsHost &&
            nextIsHost
        ) {
            showToast('Host left the match. You are now the host.', 'info', 2500);
        }
    }

    lobbyManager.players = roomState.players.map((player, index) => ({
        id: player._id,
        name: player.name,
        color: player.color,
        isReady: player.isReady,
        isHost: player.sessionId === roomState.hostPlayerId,
        playerNumber: player.playerNumber || index + 1,
    }));

    const lobbyPartyModeToggle = document.getElementById('lobbyPartyModeToggle');
    if (lobbyPartyModeToggle) {
        lobbyPartyModeToggle.checked = roomState.partyMode !== false;
        lobbyPartyModeToggle.disabled = !lobbyManager.isHost;
    }

    document.querySelectorAll('.lobby-grid-btn').forEach((btn) => {
        btn.classList.toggle('selected', parseInt(btn.dataset.size) === roomState.gridSize);
    });

    const readyBtn = document.getElementById('readyBtn');
    if (readyBtn) {
        readyBtn.textContent = lobbyManager.isReady ? 'Ready ✓' : 'Ready';
        readyBtn.classList.toggle('is-ready', lobbyManager.isReady);
    }

    if (roomState.status === 'playing') {
        if (
            multiplayerStartup.getSnapshot().phase !== STARTUP_STATES.IN_MATCH &&
            !multiplayerStartup.getSnapshot().startupBeganAt
        ) {
            initializeMultiplayerGame(roomState);
        }
        return;
    }

    if (roomState.status === 'lobby') {
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

    gameState.lines.forEach((line) => {
        if (!game.lines.has(line.lineKey)) {
            game.lines.add(line.lineKey);

            const displayPlayerIndex =
                line.playerIndex === 2 ? DotsAndBoxesGame.POPULATE_PLAYER_ID : line.playerIndex + 1;

            game.lineOwners.set(line.lineKey, displayPlayerIndex);

            const [startDot, endDot] = game.parseLineKey(line.lineKey);
            game.lineDrawings.push({
                lineKey: line.lineKey,
                startDot,
                endDot,
                player: displayPlayerIndex,
                startTime: Date.now(),
                duration: DotsAndBoxesGame.ANIMATION_LINE_DRAW_DURATION,
            });

            game.pulsatingLines.push({
                line: line.lineKey,
                player: displayPlayerIndex,
                time: Date.now(),
            });

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

            game.triggerSquareAnimation(key, square.playerIndex + 1);
            game.playSquareSound(game.comboCount);
        }
    });

    const p1 = gameState.players?.find((player) => player.playerIndex === 0);
    const p2 = gameState.players?.find((player) => player.playerIndex === 1);
    game.scores[1] = p1?.score || 0;
    game.scores[2] = p2?.score || 0;

    game.uiManager.updatePopulateButtonVisibility();

    if (gameState.room?.status === 'finished' && !game.isGameOver) {
        game.isGameOver = true;
        game.showWinner();
    }

    game.draw();
    game.uiManager.updateUI();

    if (isFirstAuthoritativeState) {
        game.uiManager.displayLoadingSkeleton(false);
        setStartupState(STARTUP_STATES.IN_MATCH, { visible: false });
        showToast('Live match synchronized!', 'success', 2000);
    }
}
