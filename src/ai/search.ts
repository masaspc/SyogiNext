import { applyMove } from '../core/apply';
import { effectiveDef } from '../core/defs';
import { legalMoves } from '../core/movegen';
import type { GameState, Move, Owner } from '../core/types';
import { evaluate } from './eval';

const WIN = 1_000_000;

class SearchTimeout extends Error {}

function moveOrderScore(state: GameState, move: Move): number {
  if (move.kind === 'drop') return 0;
  if (move.kind === 'active') {
    const target = state.board[move.target];
    return move.ability === 'snipe' && target ? effectiveDef(target).aiValue : 10;
  }
  let score = 0;
  for (const sq of [move.to, move.second, move.chain]) {
    if (sq == null) continue;
    const target = state.board[sq];
    if (target && target.owner !== state.turn) score += effectiveDef(target).aiValue;
  }
  if (move.promote) score += 50;
  return score;
}

function orderedMoves(state: GameState): Move[] {
  return legalMoves(state, state.turn)
    .map((move, index) => ({ move, index, score: moveOrderScore(state, move) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ move }) => move);
}

function minimax(
  state: GameState,
  depth: number,
  alphaStart: number,
  betaStart: number,
  pov: Owner,
  ply: number,
  deadline: number,
): number {
  if (performance.now() >= deadline) throw new SearchTimeout();
  if (state.winner) return state.winner === pov ? WIN - ply : -WIN + ply;
  if (depth === 0) return evaluate(state, pov, state.rngState ^ state.moveCount);
  const moves = orderedMoves(state);
  if (!moves.length) return evaluate(state, pov, state.rngState ^ state.moveCount);

  let alpha = alphaStart;
  let beta = betaStart;
  if (state.turn === pov) {
    let best = -Infinity;
    for (const move of moves) {
      best = Math.max(best, minimax(applyMove(state, move), depth - 1, alpha, beta, pov, ply + 1, deadline));
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = Infinity;
  for (const move of moves) {
    best = Math.min(best, minimax(applyMove(state, move), depth - 1, alpha, beta, pov, ply + 1, deadline));
    beta = Math.min(beta, best);
    if (alpha >= beta) break;
  }
  return best;
}

function searchDepth(state: GameState, pov: Owner, depth: number, deadline: number): Move {
  const moves = orderedMoves(state);
  if (!moves.length) throw new Error('no legal moves');
  const maximizing = state.turn === pov;
  let bestMove = moves[0];
  let bestScore = maximizing ? -Infinity : Infinity;
  let alpha = -Infinity;
  let beta = Infinity;
  for (const move of moves) {
    if (performance.now() >= deadline) throw new SearchTimeout();
    const score = minimax(applyMove(state, move), depth - 1, alpha, beta, pov, 1, deadline);
    if ((maximizing && score > bestScore) || (!maximizing && score < bestScore)) {
      bestScore = score;
      bestMove = move;
    }
    if (maximizing) alpha = Math.max(alpha, bestScore);
    else beta = Math.min(beta, bestScore);
  }
  return bestMove;
}

export function findBestMove(state: GameState, pov: Owner, depth: number, timeMs: number): Move {
  const moves = orderedMoves(state);
  if (!moves.length) throw new Error('no legal moves');
  const deadline = performance.now() + Math.max(1, timeMs);
  let completed = moves[0];
  for (let currentDepth = 1; currentDepth <= Math.max(1, depth); currentDepth++) {
    try {
      completed = searchDepth(state, pov, currentDepth, deadline);
    } catch (error) {
      if (error instanceof SearchTimeout) break;
      throw error;
    }
  }
  return completed;
}
