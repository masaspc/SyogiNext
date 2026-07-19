import { describe, it, expect } from 'vitest';
import { applyMove } from '../src/core/apply';
import { sqOf } from '../src/core/types';
import { bare, put } from './helpers';

describe('applyMove', () => {
  it('捕獲で通常駒が持ち駒になる(成銀→銀)', () => {
    const s = bare();
    put(s, sqOf(4, 4), 'rook', 'player');
    put(s, sqOf(4, 6), 'silver', 'enemy', { promoted: true });
    const s2 = applyMove(s, { kind: 'move', from: sqOf(4, 4), to: sqOf(4, 6), promote: false });
    expect(s2.board[sqOf(4, 6)]!.defId).toBe('rook');
    expect(s2.hands.player['silver']).toBe(1);
    expect(s2.turn).toBe('enemy');
    expect(s2.moveCount).toBe(1);
    // 元のstateは不変
    expect(s.board[sqOf(4, 4)]!.defId).toBe('rook');
    expect(s.hands.player['silver']).toBeUndefined();
  });

  it('王を取ると勝ち', () => {
    const s = bare();
    put(s, sqOf(4, 4), 'rook', 'player');
    put(s, sqOf(0, 4), 'king', 'enemy');
    const s2 = applyMove(s, { kind: 'move', from: sqOf(4, 4), to: sqOf(0, 4), promote: false });
    expect(s2.winner).toBe('player');
    expect(s2.events.some((e) => e.t === 'win')).toBe(true);
  });

  it('成りが適用される', () => {
    const s = bare();
    put(s, sqOf(3, 4), 'pawn', 'player');
    const s2 = applyMove(s, { kind: 'move', from: sqOf(3, 4), to: sqOf(2, 4), promote: true });
    expect(s2.board[sqOf(2, 4)]!.promoted).toBe(true);
  });

  it('打ちが適用され持ち駒が減る', () => {
    const s = bare();
    s.hands.player = { pawn: 2 };
    const s2 = applyMove(s, { kind: 'drop', defId: 'pawn', to: sqOf(5, 5) });
    expect(s2.board[sqOf(5, 5)]!.defId).toBe('pawn');
    expect(s2.board[sqOf(5, 5)]!.owner).toBe('player');
    expect(s2.hands.player['pawn']).toBe(1);
  });

  it('敵の手番でも適用できる', () => {
    const s = bare();
    s.turn = 'enemy';
    put(s, sqOf(2, 4), 'pawn', 'enemy');
    const s2 = applyMove(s, { kind: 'move', from: sqOf(2, 4), to: sqOf(3, 4), promote: false });
    expect(s2.board[sqOf(3, 4)]!.owner).toBe('enemy');
    expect(s2.turn).toBe('player');
  });

  it('石化は持ち主の手番が終わると解除される', () => {
    const s = bare();
    const victim = put(s, sqOf(4, 4), 'gold', 'player');
    put(s, sqOf(6, 0), 'pawn', 'player');
    put(s, sqOf(2, 0), 'pawn', 'enemy');
    s.petrified[victim.id] = 1;
    // playerの手番終了で解除
    const s2 = applyMove(s, { kind: 'move', from: sqOf(6, 0), to: sqOf(5, 0), promote: false });
    expect(s2.petrified[victim.id]).toBeUndefined();
  });
});
