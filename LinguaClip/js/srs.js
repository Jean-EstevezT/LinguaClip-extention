// js/srs.js

// FSRS-inspired constants
const HARD_INTERVAL_MULTIPLIER = 1.2;
const GOOD_INTERVAL_BASE = 2.5;
const EASY_BONUS = 1.3;
const MIN_DIFFICULTY = 0.3;
const MAX_DIFFICULTY = 1.0;

/**
 * Calculates the next state of a card based on the FSRS-inspired algorithm.
 * @param {object} card - The card object with stability and difficulty.
 * @param {string} rating - The user's rating ('again', 'hard', 'good', 'easy').
 * @returns {{stability: number, difficulty: number, due: string, isAgain: boolean}}
 */
export function calculateNextSRSState(card, rating) {
    let { stability, difficulty } = card;
    let nextDueDate = card.due;
    let isAgain = false;

    switch (rating) {
        case 'again':
            stability = 0;
            difficulty = Math.min(MAX_DIFFICULTY, difficulty + 0.2);
            isAgain = true;
            break;
        case 'hard':
            difficulty = Math.min(MAX_DIFFICULTY, difficulty + 0.15);
            stability = Math.max(1, stability * HARD_INTERVAL_MULTIPLIER);
            break;
        case 'good':
            difficulty = Math.max(MIN_DIFFICULTY, difficulty - 0.15);
            stability = stability < 1 ? 1 : stability * (GOOD_INTERVAL_BASE - difficulty);
            break;
        case 'easy':
            difficulty = Math.max(MIN_DIFFICULTY, difficulty - 0.2);
            stability = stability < 1 ? 4 : stability * (GOOD_INTERVAL_BASE - difficulty) * EASY_BONUS;
            break;
    }

    if (!isAgain) {
        const nextInterval = Math.round(stability);
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + nextInterval);
        nextDueDate = dueDate.toISOString();
    }

    return { stability, difficulty, due: nextDueDate, isAgain };
}