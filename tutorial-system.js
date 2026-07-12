import { showToast } from './src/ui/Toast.js';
import { announceStatus } from './src/ui/AccessibilityAnnouncer.js';

const TUTORIAL_STEPS = [
    {
        id: 'select-first-dot',
        title: 'Step 1: Select your first dot',
        message: 'Click the glowing top-left dot to begin your first move.',
        requiredDot: { row: 0, col: 0 },
    },
    {
        id: 'draw-first-line',
        title: 'Step 2: Draw a line',
        message: 'Now connect the first two top dots to draw your first line.',
        requiredLineKey: '0,0-0,1',
    },
    {
        id: 'complete-square',
        title: 'Step 3: Complete a square',
        message: 'Finish the highlighted square by drawing its final open side.',
        requiredLineKey: '0,1-1,1',
    },
    {
        id: 'bonus-turn',
        title: 'Step 4: Bonus turn and scoring',
        message:
            'Great! Completing a square gives you 1 point and a bonus turn. You keep playing while you keep completing shapes.',
        isInfoStep: true,
    },
];

function dotsEqual(first, second) {
    return Boolean(first && second) && first.row === second.row && first.col === second.col;
}

export class TutorialSystem {
    constructor(game, options = {}) {
        this.game = game;
        this.options = options;
        this.active = false;
        this.stepIndex = 0;
        this.boundSkip = () => this.handleSkip();
        this.boundExit = () => this.handleExit();
        this.boundContinue = () => this.handleContinue();
        this.dom = this.resolveDom();

        if (options.enabled) {
            this.start();
        }
    }

    resolveDom() {
        return {
            overlay: document.getElementById('tutorialOverlay'),
            title: document.getElementById('tutorialTitle'),
            message: document.getElementById('tutorialMessage'),
            step: document.getElementById('tutorialStepLabel'),
            skipBtn: document.getElementById('tutorialSkipBtn'),
            exitBtn: document.getElementById('tutorialExitBtn'),
            continueBtn: document.getElementById('tutorialContinueBtn'),
        };
    }

    getCurrentStep() {
        return TUTORIAL_STEPS[this.stepIndex] || null;
    }

    getSnapshot() {
        return {
            active: this.active,
            completed: !this.active && this.stepIndex >= TUTORIAL_STEPS.length,
            stepIndex: this.stepIndex,
            stepId: this.getCurrentStep()?.id || null,
        };
    }

    isActive() {
        return this.active;
    }

    start() {
        if (this.active) {
            return;
        }

        this.active = true;
        this.stepIndex = 0;
        this.prepareTutorialBoard();
        this.attachListeners();
        this.render();
        showToast('Tutorial started. Follow each step to learn the basics.', 'info', 2500);
    }

    prepareTutorialBoard() {
        this.game.lines.clear();
        this.game.lineOwners.clear();
        this.game.squares = {};
        this.game.scores = { 1: 0, 2: 0 };
        this.game.currentPlayer = 1;
        this.game.selectedDot = null;
        this.game.selectionLocked = false;
        this.game.selectionRibbon = null;
        this.game.moveHistory = [];
        this.game.redoHistory = [];
        this.game.replayIndex = 0;

        const seededLines = [
            this.game.getLineKey({ row: 0, col: 0 }, { row: 1, col: 0 }),
            this.game.getLineKey({ row: 1, col: 0 }, { row: 1, col: 1 }),
        ];

        seededLines.forEach((lineKey) => {
            this.game.lines.add(lineKey);
            this.game.lineOwners.set(lineKey, 0);
            this.game.animationSystem.addPulsatingLine(lineKey, 0, false);
        });

        this.game.uiManager.updateUI();
        this.game.uiManager.updatePopulateButtonVisibility();
        this.game.uiManager.updateUndoRedoControls();
        this.game.uiManager.updateReplayControls();
    }

    attachListeners() {
        this.dom.skipBtn?.addEventListener('click', this.boundSkip);
        this.dom.exitBtn?.addEventListener('click', this.boundExit);
        this.dom.continueBtn?.addEventListener('click', this.boundContinue);
    }

    detachListeners() {
        this.dom.skipBtn?.removeEventListener('click', this.boundSkip);
        this.dom.exitBtn?.removeEventListener('click', this.boundExit);
        this.dom.continueBtn?.removeEventListener('click', this.boundContinue);
    }

    canSelectDot(dot) {
        if (!this.active) {
            return true;
        }

        const step = this.getCurrentStep();
        if (!step) {
            return true;
        }

        if (step.id === 'select-first-dot' && !dotsEqual(dot, step.requiredDot)) {
            showToast('Start with the top-left dot for this step.', 'warning', 1800);
            return false;
        }

        if (
            step.id === 'draw-first-line' &&
            !dotsEqual(dot, { row: 0, col: 0 }) &&
            !dotsEqual(dot, { row: 0, col: 1 })
        ) {
            showToast('Use one of the top two dots to draw the guided line.', 'warning', 1800);
            return false;
        }

        if (
            step.id === 'complete-square' &&
            !dotsEqual(dot, { row: 0, col: 1 }) &&
            !dotsEqual(dot, { row: 1, col: 1 })
        ) {
            showToast('Use the highlighted square corner dots for this step.', 'warning', 1800);
            return false;
        }

        return true;
    }

    onDotSelected(dot) {
        if (!this.active) {
            return;
        }

        const step = this.getCurrentStep();
        if (step?.id === 'select-first-dot' && dotsEqual(dot, step.requiredDot)) {
            this.advance('Nice! Dot selected.');
        }
    }

    canDrawLine(dot1, dot2) {
        if (!this.active) {
            return true;
        }

        const step = this.getCurrentStep();
        if (step?.isInfoStep) {
            showToast('Use Continue, Skip Tutorial, or Exit Tutorial to proceed.', 'info', 1800);
            return false;
        }
        if (!step?.requiredLineKey) {
            return true;
        }

        const lineKey = this.game.getLineKey(dot1, dot2);
        if (lineKey !== step.requiredLineKey) {
            showToast('Follow the guided line for this step.', 'warning', 1800);
            return false;
        }
        return true;
    }

    onMoveResolved({ lineKey, completedSquaresCount }) {
        if (!this.active) {
            return;
        }

        const step = this.getCurrentStep();
        if (!step) {
            return;
        }

        if (step.id === 'draw-first-line' && lineKey === step.requiredLineKey) {
            this.advance('Great! You drew a valid line.');
            return;
        }

        if (step.id === 'complete-square' && completedSquaresCount > 0) {
            this.advance('Excellent! You completed a square.');
        }
    }

    handleContinue() {
        if (!this.active) {
            return;
        }

        const step = this.getCurrentStep();
        if (step?.id === 'bonus-turn') {
            this.finish('Tutorial completed. Starting a fresh normal local match.', 'success', {
                resetBoard: true,
            });
        }
    }

    handleSkip() {
        if (!this.active) {
            return;
        }
        this.finish('Tutorial skipped. Starting a normal local match.', 'info', {
            resetBoard: true,
        });
        this.options.onSkip?.();
    }

    handleExit() {
        if (!this.active) {
            return;
        }
        this.finish('Exited tutorial and returned to menu.', 'info');
        this.options.onExit?.();
    }

    advance(message) {
        this.stepIndex += 1;
        this.render();
        if (message) {
            showToast(message, 'success', 1800);
        }
    }

    finish(message, toastType = 'info', { resetBoard = false } = {}) {
        this.active = false;
        this.stepIndex = TUTORIAL_STEPS.length;
        this.render();
        this.detachListeners();
        if (resetBoard) {
            this.resetBoardForNormalMatch();
        }
        if (message) {
            showToast(message, toastType, 2200);
        }
    }

    resetBoardForNormalMatch() {
        this.game.gameState.initializeGameState();
        this.game.effectSystem.initializeMultipliers();
        this.game.effectSystem.initializeTileEffects();
        this.game.initialLocalSnapshot = this.game.captureMoveSnapshot();
        this.game.moveHistory = [];
        this.game.redoHistory = [];
        this.game.replayIndex = 0;
        this.game.uiManager.updateUI();
        this.game.uiManager.updatePopulateButtonVisibility();
        this.game.uiManager.updateUndoRedoControls();
        this.game.uiManager.updateReplayControls();
        this.game.draw();
    }

    render() {
        const step = this.getCurrentStep();
        const { overlay, title, message, step: stepEl, continueBtn } = this.dom;
        if (!overlay) {
            return;
        }

        if (!this.active || !step) {
            overlay.classList.add('hidden');
            overlay.dataset.tutorialStep = 'inactive';
            return;
        }

        overlay.classList.remove('hidden');
        overlay.dataset.tutorialStep = step.id;
        if (title) {
            title.textContent = step.title;
        }
        if (message) {
            message.textContent = step.message;
        }
        if (stepEl) {
            stepEl.textContent = `Step ${this.stepIndex + 1} of ${TUTORIAL_STEPS.length}`;
        }

        if (continueBtn) {
            continueBtn.hidden = !step.isInfoStep;
        }

        announceStatus(`${step.title}. ${step.message}`);
    }
}
