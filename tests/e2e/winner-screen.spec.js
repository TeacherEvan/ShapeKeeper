import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers/bootstrap-app.js';

async function startLocalGame(page) {
    await gotoApp(page);
    await page.locator('#localPlayBtn').click();
    await page.locator('.local-grid-btn[data-size="5"]').click();
    await page.locator('#startLocalGame').click();
    await expect(page.getByTestId('game-screen')).toHaveClass(/active/);
    await expect(page.locator('#gameCanvas')).toBeVisible();
}

// Drive the genuine end-of-game path: fill every square so gameState.isGameOver()
// is true, then invoke the real checkGameOver() the app uses (500ms -> showWinner()).
async function forceGameOverWithScores(page, score1, score2) {
    await page.evaluate(
        ({ score1, score2 }) => {
            const game = window.__shapeKeeperActiveGame;
            const rows = game.gridRows;
            const cols = game.gridCols;
            // Claim all squares so isGameOver() returns true.
            for (let r = 0; r < rows - 1; r++) {
                for (let c = 0; c < cols - 1; c++) {
                    game.squares[`${r},${c}`] = 1;
                }
            }
            game.scores[1] = score1;
            game.scores[2] = score2;
            game.gameState.checkGameOver();
        },
        { score1, score2 }
    );
}

test.describe('Winner screen', () => {
    test('declares the higher-scoring player as winner', async ({ page }) => {
        await startLocalGame(page);
        await forceGameOverWithScores(page, 10, 4);

        const winnerScreen = page.locator('#winnerScreen');
        await expect(winnerScreen).toHaveClass(/active/, { timeout: 2000 });
        await expect(page.locator('#winnerText')).toContainText('Player 1 Wins');
    });

    test('declares a tie when scores are equal', async ({ page }) => {
        await startLocalGame(page);
        await forceGameOverWithScores(page, 6, 6);

        const winnerScreen = page.locator('#winnerScreen');
        await expect(winnerScreen).toHaveClass(/active/, { timeout: 2000 });
        await expect(page.locator('#winnerText')).toContainText("It's a Tie");
    });

    test('local rematch: clicking Play Again restarts game with same config and 0 scores', async ({
        page,
    }) => {
        await startLocalGame(page);
        await forceGameOverWithScores(page, 10, 4);

        const winnerScreen = page.locator('#winnerScreen');
        await expect(winnerScreen).toHaveClass(/active/, { timeout: 2000 });

        await page.locator('#playAgain').click();

        const gameScreen = page.getByTestId('game-screen');
        await expect(gameScreen).toHaveClass(/active/);
        await expect(winnerScreen).not.toHaveClass(/active/);

        const state = await page.evaluate(() => {
            const game = window.__shapeKeeperActiveGame;
            return {
                p1Score: game.scores[1],
                p2Score: game.scores[2],
                turnDurationMs: game.turnDurationMs,
                gridRows: game.gridRows,
            };
        });
        expect(state.p1Score).toBe(0);
        expect(state.p2Score).toBe(0);
        expect(state.gridRows).toBe(5);
    });

    test('clicking Main Menu returns to main menu', async ({ page }) => {
        await startLocalGame(page);
        await forceGameOverWithScores(page, 10, 4);

        const winnerScreen = page.locator('#winnerScreen');
        await expect(winnerScreen).toHaveClass(/active/, { timeout: 5000 });

        await page.locator('#winnerMainMenu').click();

        await expect(page.locator('#mainMenuScreen')).toHaveClass(/active/);
        await expect(winnerScreen).not.toHaveClass(/active/);
    });
});
