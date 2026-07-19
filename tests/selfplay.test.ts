import { describe, expect, it } from 'vitest';
import { findBestMove } from '../src/ai/search';
import { applyMove } from '../src/core/apply';
import { newGame } from '../src/core/board';
import { legalMoves } from '../src/core/movegen';
import { randInt } from '../src/core/rng';
import { enemySetupFor } from '../src/core/stages';
import type { GameState, Move } from '../src/core/types';

function assertInvariants(state: GameState): void {
  expect(state.board).toHaveLength(81);
  const pieces = state.board.filter((piece) => piece !== null);
  expect(pieces.length).toBeLessThanOrEqual(40);
  expect(new Set(pieces.map((piece) => piece.id)).size).toBe(pieces.length);
  const liveIds = new Set(pieces.map((piece) => piece.id));
  for (const id of Object.keys(state.petrified).map(Number)) expect(liveIds.has(id)).toBe(true);
  for (const owner of ['player', 'enemy'] as const) {
    for (const count of Object.values(state.hands[owner])) expect(count).toBeGreaterThan(0);
  }
  if (state.winner) {
    expect(legalMoves(state, 'player')).toEqual([]);
    expect(legalMoves(state, 'enemy')).toEqual([]);
  }
}

describe('全ステージ セルフプレイスモーク', () => {
  it('面1〜15を各50手まで進めても例外や状態破損がない', () => {
    for (let stage = 1; stage <= 15; stage++) {
      let state = newGame({}, enemySetupFor(stage), 1000 + stage);
      assertInvariants(state);
      for (let ply = 0; ply < 50 && !state.winner; ply++) {
        const moves = legalMoves(state, state.turn);
        if (!moves.length) break;
        let move: Move;
        if (state.turn === 'enemy') {
          move = findBestMove(state, 'enemy', 1, 50);
        } else {
          const chosen = randInt(state.rngState, moves.length);
          state = { ...state, rngState: chosen.state };
          move = moves[chosen.value];
        }
        state = applyMove(state, move);
        assertInvariants(state);
      }
    }
  }, 20_000);
});
