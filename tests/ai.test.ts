import { describe, expect, it } from 'vitest';
import { findBestMove } from '../src/ai/search';
import { applyMove } from '../src/core/apply';
import { findRoyals, newGame } from '../src/core/board';
import { legalMoves } from '../src/core/movegen';
import { sqOf } from '../src/core/types';
import { bare, put } from './helpers';

describe('AI探索', () => {
  it('1手で取れる敵王を必ず取る', () => {
    const s = bare();
    const rookSq = sqOf(4, 4);
    const kingSq = sqOf(4, 7);
    put(s, rookSq, 'rook', 'player');
    put(s, kingSq, 'king', 'enemy');
    put(s, sqOf(8, 8), 'king', 'player');
    const move = findBestMove(s, 'player', 2, 500);
    expect(move).toMatchObject({ kind: 'move', from: rookSq, to: kingSq });
  });

  it('深度2では次の手で自王を取られる手を選ばない', () => {
    const s = bare();
    put(s, sqOf(8, 4), 'king', 'player');
    put(s, sqOf(0, 4), 'rook', 'enemy');
    put(s, sqOf(4, 4), 'gold', 'player');
    put(s, sqOf(0, 8), 'king', 'enemy');
    const move = findBestMove(s, 'player', 2, 1000);
    const next = applyMove(s, move);
    const playerRoyal = findRoyals(next, 'player')[0];
    const enemyCanCaptureRoyal = legalMoves(next, 'enemy').some(
      (m) => m.kind === 'move' && (m.to === playerRoyal || m.second === playerRoyal || m.chain === playerRoyal),
    );
    expect(enemyCanCaptureRoyal).toBe(false);
  });

  it('初期局面の深度3探索が2秒以内に返る', () => {
    const s = newGame({}, {}, 123);
    const started = performance.now();
    const move = findBestMove(s, 'player', 3, 1500);
    expect(move).toBeDefined();
    expect(performance.now() - started).toBeLessThan(2000);
  });

  it('同一状態からは決定的に同じ手を返す', () => {
    const s = newGame({}, {}, 456);
    expect(findBestMove(s, 'player', 2, 1000)).toEqual(findBestMove(s, 'player', 2, 1000));
  });
});
