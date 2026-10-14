import { performance } from 'perf_hooks';
import { findOptimalMinimaxMove } from '../../../src/ai/MinimaxEngine.js';

function create30x30Board(fillRatio = 0.45) {
    const gridRows = 30;
    const gridCols = 30;
    const allLines = [];

    // Horizontal lines: r in [0, 29], c in [0, 28]
    for (let r = 0; r < gridRows; r++) {
        for (let c = 0; c < gridCols - 1; c++) {
            allLines.push(`${r},${c}-${r},${c + 1}`);
        }
    }
    // Vertical lines: r in [0, 28], c in [0, 29]
    for (let r = 0; r < gridRows - 1; r++) {
        for (let c = 0; c < gridCols; c++) {
            allLines.push(`${r},${c}-${r + 1},${c}`);
        }
    }

    const lines = new Set();
    // Deterministic pseudo-random placement to simulate mid-game
    let seed = 42;
    const rand = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 0xffffffff;
    };

    const targetPlaced = Math.floor(allLines.length * fillRatio);
    const shuffled = [...allLines].sort(() => rand() - 0.5);
    for (let i = 0; i < targetPlaced; i++) {
        lines.add(shuffled[i]);
    }

    const gameLogic = {
        game: {
            gridRows,
            gridCols,
            lines,
            squares: {},
            claimedCells: new Set(),
            lineOwners: new Map(),
            currentPlayer: 2,
            aiPlayerNumber: 2,
        },
        getAllPossibleLines() {
            return allLines;
        },
        wouldCompleteSquare() {
            return false;
        },
    };

    return { gameLogic, lines, gridRows, gridCols };
}

async function runBenchmark() {
    console.log('Running AI Benchmark on 30x30 grid (mid-game)...');
    const { gameLogic, lines, gridRows, gridCols } = create30x30Board(0.45);
    const times = [];

    for (let i = 0; i < 20; i++) {
        const start = performance.now();
        const move = findOptimalMinimaxMove(gameLogic, lines, gridRows, gridCols, 2);
        const duration = performance.now() - start;
        times.push(duration);
        console.log(`Move ${i + 1}/20: ${duration.toFixed(2)} ms (move: ${move})`);
        if (move) {
            lines.add(move);
        }
    }

    times.sort((a, b) => a - b);
    const min = times[0];
    const max = times[times.length - 1];
    const avg = times.reduce((s, t) => s + t, 0) / times.length;
    // p95 index = floor(20 * 0.95) = 19
    const p95Index = Math.min(Math.floor(times.length * 0.95), times.length - 1);
    const p95 = times[p95Index];

    console.log('\n--- AI Benchmark Results ---');
    console.log(`Runs: ${times.length}`);
    console.log(`Min: ${min.toFixed(2)} ms`);
    console.log(`Avg: ${avg.toFixed(2)} ms`);
    console.log(`Max: ${max.toFixed(2)} ms`);
    console.log(`p95: ${p95.toFixed(2)} ms`);
    console.log(`p95 <= 500 ms: ${p95 <= 500}`);
}

runBenchmark().catch((err) => {
    console.error('Benchmark failed:', err);
    process.exit(1);
});
